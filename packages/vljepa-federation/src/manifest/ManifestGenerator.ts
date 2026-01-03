/**
 * ManifestGenerator - Generate module manifests
 * Create manifests for remote modules
 */

import type { ModuleManifest, ManifestModule } from "../types.js";

export class ManifestGenerator {
  /**
   * Generate manifest from module info
   */
  generate(config: {
    name: string;
    version: string;
    modules: Array<{
      name: string;
      url: string;
      hash: string;
      size: number;
    }>;
    dependencies?: Record<string, string>;
  }): ModuleManifest {
    const manifestModules: ManifestModule[] = config.modules.map(m => ({
      name: m.name,
      url: m.url,
      version: config.version,
      hash: m.hash,
      size: m.size,
    }));

    return {
      name: config.name,
      version: config.version,
      modules: manifestModules,
      dependencies: config.dependencies || {},
      timestamp: Date.now(),
    };
  }

  /**
   * Generate manifest from remote entry
   */
  async generateFromEntry(entryUrl: string): Promise<ModuleManifest> {
    const response = await fetch(entryUrl);
    const entry = await response.json();

    return this.generate({
      name: entry.name,
      version: entry.version,
      modules: entry.modules || [],
      dependencies: entry.shared || {},
    });
  }

  /**
   * Generate bundle hash
   */
  async generateHash(content: string | ArrayBuffer): Promise<string> {
    const encoder = new TextEncoder();
    const data =
      typeof content === "string"
        ? encoder.encode(content)
        : new Uint8Array(content);

    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  }

  /**
   * Calculate module size
   */
  calculateSize(content: string | ArrayBuffer): number {
    return typeof content === "string"
      ? new Blob([content]).size
      : content.byteLength;
  }

  /**
   * Generate manifest for multiple modules
   */
  generateMulti(config: {
    name: string;
    version: string;
    entries: Array<{
      moduleName: string;
      url: string;
      content: string | ArrayBuffer;
    }>;
    dependencies?: Record<string, string>;
  }): ModuleManifest {
    const modules: ManifestModule[] = [];

    for (const entry of config.entries) {
      const hashPromise = this.generateHash(entry.content);
      const size = this.calculateSize(entry.content);

      // Note: In real implementation, this would be async
      // For now, use a placeholder hash
      modules.push({
        name: entry.moduleName,
        url: entry.url,
        version: config.version,
        hash: "pending", // Would be await hashPromise
        size,
      });
    }

    return {
      name: config.name,
      version: config.version,
      modules,
      dependencies: config.dependencies || {},
      timestamp: Date.now(),
    };
  }

  /**
   * Update manifest
   */
  update(
    manifest: ModuleManifest,
    updates: {
      addModules?: ManifestModule[];
      removeModules?: string[];
      updateDependencies?: Record<string, string>;
    }
  ): ModuleManifest {
    let modules = [...manifest.modules];

    // Add new modules
    if (updates.addModules) {
      modules = [...modules, ...updates.addModules];
    }

    // Remove modules
    if (updates.removeModules) {
      modules = modules.filter(m => !updates.removeModules!.includes(m.name));
    }

    return {
      ...manifest,
      modules,
      dependencies: {
        ...manifest.dependencies,
        ...updates.updateDependencies,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Validate manifest
   */
  validate(manifest: ModuleManifest): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!manifest.name) {
      errors.push("Manifest name is required");
    }

    if (!manifest.version) {
      errors.push("Manifest version is required");
    }

    if (!Array.isArray(manifest.modules)) {
      errors.push("Modules must be an array");
    } else {
      for (const module of manifest.modules) {
        if (!module.name) {
          errors.push(`Module name is required`);
        }
        if (!module.url) {
          errors.push(`Module ${module.name}: URL is required`);
        }
        if (!module.hash) {
          errors.push(`Module ${module.name}: Hash is required`);
        }
        if (typeof module.size !== "number") {
          errors.push(`Module ${module.name}: Size must be a number`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Export manifest to JSON
   */
  export(manifest: ModuleManifest): string {
    return JSON.stringify(manifest, null, 2);
  }

  /**
   * Import manifest from JSON
   */
  import(json: string): ModuleManifest {
    return JSON.parse(json);
  }

  /**
   * Compare two manifests
   */
  compare(
    manifest1: ModuleManifest,
    manifest2: ModuleManifest
  ): {
    versionChanged: boolean;
    modulesAdded: string[];
    modulesRemoved: string[];
    modulesChanged: string[];
  } {
    const modules1 = new Map(manifest1.modules.map(m => [m.name, m]));
    const modules2 = new Map(manifest2.modules.map(m => [m.name, m]));

    const modulesAdded: string[] = [];
    const modulesRemoved: string[] = [];
    const modulesChanged: string[] = [];

    // Check for added and changed modules
    for (const [name, module] of modules2) {
      const oldModule = modules1.get(name);
      if (!oldModule) {
        modulesAdded.push(name);
      } else if (oldModule.hash !== module.hash) {
        modulesChanged.push(name);
      }
    }

    // Check for removed modules
    for (const [name] of modules1) {
      if (!modules2.has(name)) {
        modulesRemoved.push(name);
      }
    }

    return {
      versionChanged: manifest1.version !== manifest2.version,
      modulesAdded,
      modulesRemoved,
      modulesChanged,
    };
  }

  /**
   * Generate manifest URL
   */
  generateManifestUrl(baseUrl: string, name: string, version: string): string {
    const cleanBase = baseUrl.replace(/\/$/, "");
    return `${cleanBase}/${name}/${version}/manifest.json`;
  }

  /**
   * Extract module name from manifest URL
   */
  extractNameFromUrl(url: string): string | null {
    const match = url.match(/\/([^/]+)\/[^/]+\/manifest\.json$/);
    return match ? match[1] : null;
  }

  /**
   * Extract version from manifest URL
   */
  extractVersionFromUrl(url: string): string | null {
    const match = url.match(/\/[^/]+\/([^/]+)\/manifest\.json$/);
    return match ? match[1] : null;
  }
}

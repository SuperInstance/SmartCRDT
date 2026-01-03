/**
 * VersionManifest - Track module versions across releases
 * Manage version history and compatibility
 */

import type {
  ModuleManifest,
  VersionManifest as IVersionManifest,
} from "../types.js";

export class VersionManifestManager {
  private manifests: Map<string, IVersionManifest> = new Map();

  /**
   * Register manifest for a module
   */
  register(manifest: ModuleManifest): void {
    const key = this.getModuleKey(manifest.name);

    if (!this.manifests.has(key)) {
      this.manifests.set(key, {
        versions: {},
        latest: manifest.version,
        compatible: [],
      });
    }

    const versionManifest = this.manifests.get(key)!;
    versionManifest.versions[manifest.version] = manifest;

    // Update latest if newer
    if (this.isNewerVersion(manifest.version, versionManifest.latest)) {
      versionManifest.latest = manifest.version;
    }

    // Update compatible versions
    this.updateCompatibleVersions(key, manifest.version);
  }

  /**
   * Get manifest for specific version
   */
  get(name: string, version: string): ModuleManifest | undefined {
    const key = this.getModuleKey(name);
    const versionManifest = this.manifests.get(key);
    return versionManifest?.versions[version];
  }

  /**
   * Get latest manifest
   */
  getLatest(name: string): ModuleManifest | undefined {
    const key = this.getModuleKey(name);
    const versionManifest = this.manifests.get(key);
    if (!versionManifest) {
      return undefined;
    }
    return versionManifest.versions[versionManifest.latest];
  }

  /**
   * Get all versions for a module
   */
  getAllVersions(name: string): string[] {
    const key = this.getModuleKey(name);
    const versionManifest = this.manifests.get(key);
    if (!versionManifest) {
      return [];
    }
    return Object.keys(versionManifest.versions).sort((a, b) =>
      this.compareVersions(b, a)
    );
  }

  /**
   * Get compatible versions for a module
   */
  getCompatibleVersions(name: string): string[] {
    const key = this.getModuleKey(name);
    const versionManifest = this.manifests.get(key);
    return versionManifest?.compatible || [];
  }

  /**
   * Check if version exists
   */
  hasVersion(name: string, version: string): boolean {
    const manifest = this.get(name, version);
    return manifest !== undefined;
  }

  /**
   * Get latest version string
   */
  getLatestVersion(name: string): string | undefined {
    const key = this.getModuleKey(name);
    return this.manifests.get(key)?.latest;
  }

  /**
   * Get module key
   */
  private getModuleKey(name: string): string {
    return name;
  }

  /**
   * Compare two versions
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split(".").map(Number);
    const parts2 = v2.split(".").map(Number);

    const maxLength = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < maxLength; i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;

      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }

    return 0;
  }

  /**
   * Check if v1 is newer than v2
   */
  private isNewerVersion(v1: string, v2: string): boolean {
    return this.compareVersions(v1, v2) > 0;
  }

  /**
   * Update compatible versions list
   */
  private updateCompatibleVersions(key: string, version: string): void {
    const versionManifest = this.manifests.get(key);
    if (!versionManifest) {
      return;
    }

    // Get all versions with same major version
    const majorVersion = version.split(".")[0];
    const compatible = Object.keys(versionManifest.versions).filter(v =>
      v.startsWith(majorVersion)
    );

    versionManifest.compatible = compatible;
  }

  /**
   * Find compatible version for a range
   */
  findCompatibleVersion(name: string, range: string): string | undefined {
    const versions = this.getAllVersions(name);

    // Simple semver matching (would use semver library in production)
    if (range.startsWith("^")) {
      const version = range.substring(1);
      const majorVersion = version.split(".")[0];
      return versions.find(v => v.startsWith(majorVersion) && v >= version);
    }

    if (range.startsWith("~")) {
      const version = range.substring(1);
      const majorMinor = version.split(".").slice(0, 2).join(".");
      return versions.find(v => v.startsWith(majorMinor) && v >= version);
    }

    // Exact match
    if (versions.includes(range)) {
      return range;
    }

    return undefined;
  }

  /**
   * Get version diff between two versions
   */
  getVersionDiff(
    name: string,
    from: string,
    to: string
  ): "major" | "minor" | "patch" | null {
    const fromParts = from.split(".").map(Number);
    const toParts = to.split(".").map(Number);

    if (toParts[0] !== fromParts[0]) {
      return "major";
    }
    if (toParts[1] !== fromParts[1]) {
      return "minor";
    }
    if (toParts[2] !== fromParts[2]) {
      return "patch";
    }

    return null;
  }

  /**
   * List all modules
   */
  listModules(): string[] {
    return Array.from(this.manifests.keys());
  }

  /**
   * Get all manifests for a module
   */
  getAllManifests(name: string): ModuleManifest[] {
    const key = this.getModuleKey(name);
    const versionManifest = this.manifests.get(key);
    if (!versionManifest) {
      return [];
    }
    return Object.values(versionManifest.versions);
  }

  /**
   * Export version manifest
   */
  export(name: string): IVersionManifest | undefined {
    const key = this.getModuleKey(name);
    const versionManifest = this.manifests.get(key);
    if (!versionManifest) {
      return undefined;
    }

    return {
      versions: { ...versionManifest.versions },
      latest: versionManifest.latest,
      compatible: [...versionManifest.compatible],
    };
  }

  /**
   * Import version manifest
   */
  import(name: string, versionManifest: IVersionManifest): void {
    for (const version of Object.keys(versionManifest.versions)) {
      this.register(versionManifest.versions[version]);
    }
  }

  /**
   * Clear all manifests
   */
  clear(): void {
    this.manifests.clear();
  }

  /**
   * Clear manifests for a module
   */
  clearModule(name: string): void {
    const key = this.getModuleKey(name);
    this.manifests.delete(key);
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalModules: number;
    totalVersions: number;
    versionsPerModule: Record<string, number>;
  } {
    const versionsPerModule: Record<string, number> = {};
    let totalVersions = 0;

    for (const [key, versionManifest] of this.manifests) {
      const count = Object.keys(versionManifest.versions).length;
      versionsPerModule[key] = count;
      totalVersions += count;
    }

    return {
      totalModules: this.manifests.size,
      totalVersions,
      versionsPerModule,
    };
  }
}

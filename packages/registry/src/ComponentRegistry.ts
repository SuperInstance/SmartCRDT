/**
 * @lsi/registry - Component Registry Implementation
 *
 * Manages modular, pullable AI infrastructure components.
 * Inspired by Ollama's model registry, npm, and Docker.
 */

import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import yaml from "js-yaml";
import semver from "semver";
import {
  ComponentManifest,
  ComponentInfo,
  ComponentRegistryEntry,
  RegistryIndex,
  RegistryConfig,
  InstallOptions,
  DownloadOptions,
  DownloadProgress,
  DependencyResolutionResult,
  ResolutionError,
  CompatibilityResult,
  VerificationResult,
  RegistryStatistics,
  ComponentUpdateInfo,
  RegistryHealthResult,
  InstalledComponent,
  SearchResult,
  ComponentSearchQuery,
  RegistryErrorCode,
  RegistryError,
  ComponentDependency,
  RemoteRegistryConfig,
} from "./types.js";

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_REGISTRY_URL = "https://github.com/SuperInstance/components";
const LOCAL_REGISTRY_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE || "~",
  ".aequor"
);
const REGISTRY_INDEX_FILE = "index.json";
const MANIFESTS_DIR = "manifests";
const ARCHIVES_DIR = "archives";
const COMPONENTS_DIR = "components";
const ACTIVE_DIR = "active";

// ============================================================================
// COMPONENT REGISTRY CLASS
// ============================================================================

/**
 * Component Registry
 *
 * Manages component discovery, download, installation, and lifecycle.
 */
export class ComponentRegistry {
  private config: RegistryConfig;
  private localPath: string;
  private indexPath: string;
  private manifestsPath: string;
  private archivesPath: string;
  private componentsPath: string;
  private activePath: string;

  constructor(config?: Partial<RegistryConfig>) {
    this.config = this.buildConfig(config);
    this.localPath = this.config.local_path || LOCAL_REGISTRY_PATH;
    this.indexPath = path.join(this.localPath, "registry", REGISTRY_INDEX_FILE);
    this.manifestsPath = path.join(this.localPath, "registry", MANIFESTS_DIR);
    this.archivesPath = path.join(this.localPath, "registry", ARCHIVES_DIR);
    this.componentsPath = path.join(this.localPath, COMPONENTS_DIR);
    this.activePath = path.join(this.componentsPath, ACTIVE_DIR);
  }

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  /**
   * Initialize registry directory structure
   */
  async initialize(): Promise<void> {
    const dirs = [
      path.join(this.localPath, "registry"),
      this.manifestsPath,
      this.archivesPath,
      this.componentsPath,
      this.activePath,
      path.join(this.localPath, "config"),
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }

    // Initialize empty index if not exists
    const indexExists = await this.fileExists(this.indexPath);
    if (!indexExists) {
      const emptyIndex: RegistryIndex = {
        version: "1.0.0",
        last_updated: new Date().toISOString(),
        components: [],
      };
      await this.saveIndex(emptyIndex);
    }
  }

  // ========================================================================
  // COMPONENT LISTING
  // ========================================================================

  /**
   * List all components in the registry
   */
  async list(options?: {
    include_installed?: boolean;
    type?: string;
    stability?: string;
  }): Promise<ComponentInfo[]> {
    const index = await this.loadIndex();

    let components = index.components;

    // Filter by type
    if (options?.type) {
      components = components.filter((c) => c.type === options.type);
    }

    // Filter by stability
    if (options?.stability) {
      components = components.filter((c) => c.stability === options.stability);
    }

    // Add installation status if requested
    if (options?.include_installed) {
      const installed = await this.listInstalled();
      const installedMap = new Map(
        installed.map((i) => [i.name, i.version])
      );

      components = components.map((c) => ({
        ...c,
        installed: installedMap.has(c.name),
        current_version: installedMap.get(c.name),
        update_available: installedMap.has(c.name)
          ? semver.gt(c.latest_version, installedMap.get(c.name)!)
          : false,
      }));
    }

    return components;
  }

  /**
   * List installed components
   */
  async listInstalled(): Promise<InstalledComponent[]> {
    const componentsDir = this.componentsPath;
    const dirs = await fs.readdir(componentsDir, { withFileTypes: true });

    const installed: InstalledComponent[] = [];

    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;
      if (dir.name === ACTIVE_DIR) continue;

      const manifestPath = path.join(componentsDir, dir.name, "manifest.yaml");
      const manifestExists = await this.fileExists(manifestPath);

      if (!manifestExists) continue;

      try {
        const manifestContent = await fs.readFile(manifestPath, "utf-8");
        const manifest = yaml.load(manifestContent) as ComponentManifest;

        // Extract version from directory name (format: name@version)
        const match = dir.name.match(/^(.+)@(.+)$/);
        if (!match) continue;

        const [, name, version] = match;

        const stats = await fs.stat(path.join(this.componentsPath, dir.name));

        installed.push({
          name,
          version,
          path: path.join(this.componentsPath, dir.name),
          installed_at: stats.mtime.toISOString(),
          manifest,
          active: await this.isActive(name),
        });
      } catch (error) {
        // Skip invalid components
        continue;
      }
    }

    return installed;
  }

  // ========================================================================
  // COMPONENT SEARCH
  // ========================================================================

  /**
   * Search for components
   */
  async search(query: ComponentSearchQuery): Promise<SearchResult[]> {
    const components = await this.list({ include_installed: true });

    const searchTerm = query.query.toLowerCase();

    const results: SearchResult[] = [];

    for (const component of components) {
      let score = 0;
      const matchedFields: (
        | "name"
        | "description"
        | "keywords"
        | "type"
      )[] = [];

      // Match in name (highest weight)
      if (component.name.toLowerCase().includes(searchTerm)) {
        score += component.name === searchTerm ? 1.0 : 0.7;
        matchedFields.push("name");
      }

      // Match in description (medium weight)
      if (component.description.toLowerCase().includes(searchTerm)) {
        score += 0.5;
        matchedFields.push("description");
      }

      // Match in keywords (medium weight)
      if (
        component.keywords.some((k) => k.toLowerCase().includes(searchTerm))
      ) {
        score += 0.4;
        matchedFields.push("keywords");
      }

      // Match in type (low weight)
      if (component.type.toLowerCase().includes(searchTerm)) {
        score += 0.2;
        matchedFields.push("type");
      }

      if (score > 0) {
        results.push({
          ...component,
          score: Math.min(score, 1.0),
          matched_fields: matchedFields,
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Apply filters
    let filtered = results;

    if (query.type) {
      filtered = filtered.filter((r) => r.type === query.type);
    }

    if (query.stability) {
      filtered = filtered.filter((r) => r.stability === query.stability);
    }

    if (query.category) {
      filtered = filtered.filter((r) => r.category === query.category);
    }

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 20;

    return filtered.slice(offset, offset + limit);
  }

  // ========================================================================
  // COMPONENT INFO
  // ========================================================================

  /**
   * Get component details
   */
  async get(name: string, version?: string): Promise<ComponentManifest> {
    const index = await this.loadIndex();

    const component = index.components.find((c) => c.name === name);

    if (!component) {
      throw new RegistryError(
        RegistryErrorCode.COMPONENT_NOT_FOUND,
        `Component not found: ${name}`
      );
    }

    const targetVersion = version || component.latest_version;

    if (!component.versions.includes(targetVersion)) {
      throw new RegistryError(
        RegistryErrorCode.VERSION_NOT_FOUND,
        `Version not found: ${name}@${targetVersion}`
      );
    }

    // Try to load from local cache
    const cachedManifest = await this.loadCachedManifest(name, targetVersion);
    if (cachedManifest) {
      return cachedManifest;
    }

    // Otherwise, fetch from remote registry
    return this.fetchManifest(name, targetVersion);
  }

  /**
   * Get component info (lightweight)
   */
  async info(name: string): Promise<ComponentInfo> {
    const index = await this.loadIndex();

    const component = index.components.find((c) => c.name === name);

    if (!component) {
      throw new RegistryError(
        RegistryErrorCode.COMPONENT_NOT_FOUND,
        `Component not found: ${name}`
      );
    }

    const installed = await this.listInstalled();
    const installedComponent = installed.find((i) => i.name === name);

    return {
      name: component.name,
      latest_version: component.latest_version,
      versions: component.versions,
      type: component.type,
      description: component.description,
      keywords: component.keywords,
      stability: component.stability,
      category: component.category,
      installed: !!installedComponent,
      current_version: installedComponent?.version,
      update_available: installedComponent
        ? semver.gt(component.latest_version, installedComponent.version)
        : false,
    };
  }

  // ========================================================================
  // COMPONENT DOWNLOAD
  // ========================================================================

  /**
   * Download component
   */
  async download(
    name: string,
    options?: DownloadOptions
  ): Promise<string> {
    const manifest = await this.get(name, options?.version);
    const version = manifest.version;

    // Check if already downloaded
    const archivePath = path.join(
      this.archivesPath,
      `${name}@${version}.tar.gz`
    );

    if (!options?.force && (await this.fileExists(archivePath))) {
      return archivePath;
    }

    // Download archive
    if (!manifest.download?.archive?.url) {
      throw new RegistryError(
        RegistryErrorCode.DOWNLOAD_FAILED,
        `No download URL for component: ${name}@${version}`
      );
    }

    const url = manifest.download.archive.url;

    // Simulate download (in real implementation, use fetch/got)
    const onProgress = options?.on_progress;
    onProgress?.({
      downloaded: 0,
      total: 100,
      percentage: 0,
      operation: "downloading",
    });

    // Download file
    // In real implementation: await this.downloadFile(url, archivePath, onProgress);

    onProgress?.({
      downloaded: 100,
      total: 100,
      percentage: 100,
      operation: "downloading",
    });

    // Verify checksum if provided
    if (manifest.download.archive.sha256 && !options?.skip_verify) {
      const verification = await this.verifyChecksum(
        archivePath,
        manifest.download.archive.sha256
      );

      if (!verification.verified) {
        await fs.unlink(archivePath);
        throw new RegistryError(
          RegistryErrorCode.CHECKSUM_MISMATCH,
          `Checksum mismatch for ${name}@${version}`,
          { expected: manifest.download.archive.sha256 }
        );
      }
    }

    return archivePath;
  }

  // ========================================================================
  // COMPONENT INSTALLATION
  // ========================================================================

  /**
   * Install component
   */
  async install(
    name: string,
    options?: InstallOptions
  ): Promise<InstalledComponent> {
    const manifest = await this.get(name, options?.version);
    const version = manifest.version;

    // Dry run
    if (options?.dry_run) {
      return {
        name,
        version,
        path: path.join(this.componentsPath, `${name}@${version}`),
        installed_at: new Date().toISOString(),
        manifest,
        active: false,
      };
    }

    // Check if already installed
    const installed = await this.listInstalled();
    const existing = installed.find((i) => i.name === name && i.version === version);

    if (existing && !options?.force) {
      return existing;
    }

    // Resolve dependencies
    if (!options?.skip_dependencies) {
      const resolution = await this.resolveDependencies(manifest);

      if (!resolution.success) {
        throw new RegistryError(
          RegistryErrorCode.DEPENDENCY_CONFLICT,
          `Dependency resolution failed for ${name}`,
          { errors: resolution.errors }
        );
      }

      // Install dependencies first
      for (const dep of resolution.components) {
        if (dep.name === name) continue; // Skip self

        const depInstalled = installed.find(
          (i) => i.name === dep.name && i.version === dep.version
        );

        if (!depInstalled) {
          await this.install(dep.name, { ...options, version: dep.version });
        }
      }
    }

    // Download component
    const archivePath = await this.download(name, options);

    // Extract component
    const installPath = path.join(this.componentsPath, `${name}@${version}`);

    await fs.mkdir(installPath, { recursive: true });

    // Extract archive
    // In real implementation: await this.extractArchive(archivePath, installPath);

    // Save manifest
    const manifestPath = path.join(installPath, "manifest.yaml");
    await fs.writeFile(
      manifestPath,
      yaml.dump(manifest),
      "utf-8"
    );

    // Cache manifest
    const cachedManifestPath = path.join(
      this.manifestsPath,
      `${name}@${version}.yaml`
    );
    await fs.writeFile(
      cachedManifestPath,
      yaml.dump(manifest),
      "utf-8"
    );

    // Create symlink if active
    if (options?.active !== false) {
      await this.setActive(name, version);
    }

    // Run post-install hooks
    if (manifest.install?.post_install) {
      for (const hook of manifest.install.post_install) {
        await this.runHook(installPath, hook);
      }
    }

    return {
      name,
      version,
      path: installPath,
      installed_at: new Date().toISOString(),
      manifest,
      active: true,
    };
  }

  // ========================================================================
  // DEPENDENCY RESOLUTION
  // ========================================================================

  /**
   * Resolve component dependencies
   */
  async resolveDependencies(
    manifest: ComponentManifest
  ): Promise<DependencyResolutionResult> {
    const resolved: Array<{
      name: string;
      version: string;
      manifest: ComponentManifest;
    }> = [];
    const errors: ResolutionError[] = [];
    const seen = new Set<string>();
    const resolving = new Set<string>();

    const resolve = async (
      name: string,
      constraint: string,
      parent?: string
    ): Promise<void> => {
      const key = `${name}@${constraint}`;

      if (seen.has(key)) return;
      if (resolving.has(key)) {
        errors.push({
          component: name,
          type: "circular",
          message: `Circular dependency detected: ${name}`,
        });
        return;
      }

      resolving.add(key);

      try {
        const depManifest = await this.get(name);

        // Find best matching version
        const version = this.selectVersion(
          depManifest.version,
          constraint
        );

        if (!version) {
          errors.push({
            component: name,
            type: "constraint",
            message: `No version satisfying ${constraint}`,
          });
          return;
        }

        resolved.push({
          name,
          version,
          manifest: depManifest,
        });

        seen.add(key);

        // Resolve transitive dependencies
        if (depManifest.dependencies) {
          for (const dep of depManifest.dependencies) {
            if (dep.required) {
              await resolve(dep.name, dep.version, name);
            }
          }
        }
      } catch (error) {
        errors.push({
          component: name,
          type: "not_found",
          message: (error as Error).message,
        });
      } finally {
        resolving.delete(key);
      }
    };

    // Resolve direct dependencies
    if (manifest.dependencies) {
      for (const dep of manifest.dependencies) {
        if (dep.required) {
          await resolve(dep.name, dep.version, manifest.name);
        }
      }
    }

    return {
      components: resolved,
      success: errors.length === 0,
      errors,
    };
  }

  /**
   * Select best version matching constraint
   */
  private selectVersion(current: string, constraint: string): string | null {
    if (semver.satisfies(current, constraint)) {
      return current;
    }

    // In real implementation, query available versions
    // For now, return current if it satisfies constraint
    return semver.satisfies(current, constraint) ? current : null;
  }

  // ========================================================================
  // COMPATIBILITY CHECKING
  // ========================================================================

  /**
   * Check component compatibility
   */
  async checkCompatibility(
    manifest: ComponentManifest
  ): Promise<CompatibilityResult> {
    const issues: string[] = [];
    let compatible = true;

    // Check platform compatibility
    const platform = process.platform;
    if (
      manifest.compatibility?.platforms &&
      !manifest.compatibility.platforms.includes(platform)
    ) {
      compatible = false;
      issues.push(`Platform ${platform} not supported`);
    }

    // Check architecture compatibility
    const arch = process.arch;
    if (
      manifest.compatibility?.arch &&
      !manifest.compatibility.arch.includes(arch)
    ) {
      compatible = false;
      issues.push(`Architecture ${arch} not supported`);
    }

    // Check Node.js compatibility
    if (manifest.compatibility?.node) {
      const nodeVersion = process.version;
      if (!semver.satisfies(nodeVersion, manifest.compatibility.node)) {
        compatible = false;
        issues.push(
          `Node.js ${manifest.compatibility.node} required, have ${nodeVersion}`
        );
      }
    }

    // Check dependency compatibility
    if (manifest.dependencies) {
      for (const dep of manifest.dependencies) {
        try {
          const depManifest = await this.get(dep.name);
          const version = this.selectVersion(
            depManifest.version,
            dep.version
          );

          if (!version) {
            compatible = false;
            issues.push(
              `Dependency ${dep.name}@${dep.version} not satisfiable`
            );
          }
        } catch (error) {
          compatible = false;
          issues.push(`Dependency ${dep.name} not found`);
        }
      }
    }

    return {
      compatible,
      platform: {
        compatible: manifest.compatibility?.platforms?.includes(platform) ?? true,
        platform,
      },
      arch: {
        compatible: manifest.compatibility?.arch?.includes(arch) ?? true,
        arch,
      },
      issues,
    };
  }

  // ========================================================================
  // VERIFICATION
  // ========================================================================

  /**
   * Verify component integrity
   */
  async verify(
    manifest: ComponentManifest
  ): Promise<VerificationResult> {
    const errors: string[] = [];
    let verified = true;

    // Verify manifest structure
    const manifestValidation = this.validateManifest(manifest);
    if (!manifestValidation.passed) {
      verified = false;
      errors.push(...manifestValidation.errors);
    }

    // Verify checksums if available
    if (manifest.download?.archive?.sha256) {
      const archivePath = path.join(
        this.archivesPath,
        `${manifest.name}@${manifest.version}.tar.gz`
      );

      if (await this.fileExists(archivePath)) {
        const checksumResult = await this.verifyChecksum(
          archivePath,
          manifest.download.archive.sha256
        );

        if (!checksumResult.verified) {
          verified = false;
          errors.push("Checksum verification failed");
        }
      }
    }

    // Verify signatures if available
    if (manifest.metadata?.signatures) {
      // In real implementation, verify PGP signatures
      // For now, just note that signatures exist
    }

    return {
      verified,
      manifest: manifestValidation,
      errors,
    };
  }

  /**
   * Validate manifest structure
   */
  private validateManifest(manifest: ComponentManifest): {
    passed: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Required fields
    if (!manifest.name) {
      errors.push("Missing required field: name");
    }

    if (!manifest.version) {
      errors.push("Missing required field: version");
    }

    if (!manifest.description) {
      errors.push("Missing required field: description");
    }

    if (!manifest.type) {
      errors.push("Missing required field: type");
    }

    if (!manifest.language) {
      errors.push("Missing required field: language");
    }

    // Version format
    if (manifest.version && !semver.valid(manifest.version)) {
      errors.push(`Invalid semver: ${manifest.version}`);
    }

    return {
      passed: errors.length === 0,
      errors,
    };
  }

  /**
   * Verify file checksum
   */
  private async verifyChecksum(
    filePath: string,
    expected: string
  ): Promise<{ verified: boolean; actual: string }> {
    const content = await fs.readFile(filePath);
    const hash = createHash("sha256");
    hash.update(content);
    const actual = hash.digest("hex");

    return {
      verified: actual === expected,
      actual,
    };
  }

  // ========================================================================
  // UPDATE MANAGEMENT
  // ========================================================================

  /**
   * Check for component updates
   */
  async checkUpdates(name?: string): Promise<ComponentUpdateInfo[]> {
    const installed = await this.listInstalled();
    const updates: ComponentUpdateInfo[] = [];

    for (const component of installed) {
      if (name && component.name !== name) continue;

      try {
        const info = await this.info(component.name);

        if (semver.gt(info.latest_version, component.version)) {
          updates.push({
            name: component.name,
            current_version: component.version,
            latest_version: info.latest_version,
            update_available: true,
          });
        }
      } catch (error) {
        // Skip components that can't be checked
        continue;
      }
    }

    return updates;
  }

  /**
   * Update component
   */
  async update(
    name: string,
    options?: InstallOptions
  ): Promise<InstalledComponent> {
    const installed = await this.listInstalled();
    const existing = installed.find((i) => i.name === name);

    if (!existing) {
      throw new RegistryError(
        RegistryErrorCode.COMPONENT_NOT_FOUND,
        `Component not installed: ${name}`
      );
    }

    const info = await this.info(name);

    if (!info.update_available) {
      return existing;
    }

    // Install new version
    const updated = await this.install(name, {
      ...options,
      version: info.latest_version,
    });

    return updated;
  }

  // ========================================================================
  // COMPONENT UNINSTALLATION
  // ========================================================================

  /**
   * Uninstall component
   */
  async uninstall(name: string, version?: string): Promise<void> {
    const installed = await this.listInstalled();

    // Find components to uninstall
    const toUninstall = version
      ? installed.filter((i) => i.name === name && i.version === version)
      : installed.filter((i) => i.name === name);

    if (toUninstall.length === 0) {
      throw new RegistryError(
        RegistryErrorCode.COMPONENT_NOT_FOUND,
        `Component not installed: ${name}${version ? `@${version}` : ""}`
      );
    }

    // Check for dependents
    const dependents = await this.findDependents(name, version);
    if (dependents.length > 0) {
      throw new RegistryError(
        RegistryErrorCode.UNINSTALL_FAILED,
        `Cannot uninstall ${name}: required by ${dependents.join(", ")}`,
        { dependents }
      );
    }

    // Remove symlinks
    await this.removeActive(name);

    // Remove component directories
    for (const component of toUninstall) {
      await fs.rm(component.path, { recursive: true, force: true });
    }
  }

  /**
   * Find components that depend on this component
   */
  private async findDependents(
    name: string,
    version?: string
  ): Promise<string[]> {
    const installed = await this.listInstalled();
    const dependents: string[] = [];

    for (const component of installed) {
      if (component.manifest.dependencies) {
        for (const dep of component.manifest.dependencies) {
          if (dep.name === name) {
            if (!version || semver.satisfies(version, dep.version)) {
              dependents.push(component.name);
            }
          }
        }
      }
    }

    return dependents;
  }

  // ========================================================================
  // ACTIVE COMPONENT MANAGEMENT
  // ========================================================================

  /**
   * Set component as active
   */
  async setActive(name: string, version: string): Promise<void> {
    const linkPath = path.join(this.activePath, name);
    const targetPath = path.join(this.componentsPath, `${name}@${version}`);

    // Remove existing link
    if (await this.fileExists(linkPath)) {
      await fs.unlink(linkPath);
    }

    // Create symlink
    await fs.symlink(targetPath, linkPath);
  }

  /**
   * Remove active symlink
   */
  private async removeActive(name: string): Promise<void> {
    const linkPath = path.join(this.activePath, name);

    if (await this.fileExists(linkPath)) {
      await fs.unlink(linkPath);
    }
  }

  /**
   * Check if component is active
   */
  private async isActive(name: string): Promise<boolean> {
    const linkPath = path.join(this.activePath, name);
    return await this.fileExists(linkPath);
  }

  // ========================================================================
  // REGISTRY INDEX MANAGEMENT
  // ========================================================================

  /**
   * Load registry index
   */
  private async loadIndex(): Promise<RegistryIndex> {
    const indexExists = await this.fileExists(this.indexPath);

    if (!indexExists) {
      return {
        version: "1.0.0",
        last_updated: new Date().toISOString(),
        components: [],
      };
    }

    const content = await fs.readFile(this.indexPath, "utf-8");
    return JSON.parse(content) as RegistryIndex;
  }

  /**
   * Save registry index
   */
  private async saveIndex(index: RegistryIndex): Promise<void> {
    await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2), "utf-8");
  }

  /**
   * Update registry index from remote
   */
  async updateIndex(): Promise<void> {
    // In real implementation, fetch from remote registry
    // For now, just update timestamp
    const index = await this.loadIndex();
    index.last_updated = new Date().toISOString();
    await this.saveIndex(index);
  }

  // ========================================================================
  // MANIFEST CACHING
  // ========================================================================

  /**
   * Load cached manifest
   */
  private async loadCachedManifest(
    name: string,
    version: string
  ): Promise<ComponentManifest | null> {
    const manifestPath = path.join(
      this.manifestsPath,
      `${name}@${version}.yaml`
    );

    if (!(await this.fileExists(manifestPath))) {
      return null;
    }

    const content = await fs.readFile(manifestPath, "utf-8");
    return yaml.load(content) as ComponentManifest;
  }

  /**
   * Fetch manifest from remote registry
   */
  private async fetchManifest(
    name: string,
    version: string
  ): Promise<ComponentManifest> {
    // In real implementation, fetch from remote registry URL
    // For now, throw error
    throw new RegistryError(
      RegistryErrorCode.COMPONENT_NOT_FOUND,
      `Manifest not found in cache: ${name}@${version}`
    );
  }

  // ========================================================================
  // REGISTRY STATISTICS
  // ========================================================================

  /**
   * Get registry statistics
   */
  async getStatistics(): Promise<RegistryStatistics> {
    const index = await this.loadIndex();
    const installed = await this.listInstalled();

    const componentsByType: Record<string, number> = {};
    const componentsByStability: Record<string, number> = {};

    for (const component of index.components) {
      componentsByType[component.type] =
        (componentsByType[component.type] || 0) + 1;
      componentsByStability[component.stability] =
        (componentsByStability[component.stability] || 0) + 1;
    }

    const updates = await this.checkUpdates();

    return {
      total_components: index.components.length,
      installed_components: installed.length,
      available_updates: updates.length,
      total_size_mb: 0, // Calculate from actual files
      cache_size_mb: 0, // Calculate from actual files
      components_by_type: componentsByType as any,
      components_by_stability: componentsByStability as any,
    };
  }

  // ========================================================================
  // REGISTRY HEALTH CHECK
  // ========================================================================

  /**
   * Check registry health
   */
  async healthCheck(): Promise<RegistryHealthResult[]> {
    const results: RegistryHealthResult[] = [];

    for (const registry of this.config.registries) {
      if (!registry.enabled) continue;

      const startTime = Date.now();

      try {
        // In real implementation, ping registry URL
        // For now, just simulate
        await new Promise((resolve) => setTimeout(resolve, 10));

        results.push({
          registry: registry.name,
          healthy: true,
          response_time_ms: Date.now() - startTime,
        });
      } catch (error) {
        results.push({
          registry: registry.name,
          healthy: false,
          error: (error as Error).message,
        });
      }
    }

    return results;
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Build default configuration
   */
  private buildConfig(config?: Partial<RegistryConfig>): RegistryConfig {
    return {
      local_path: LOCAL_REGISTRY_PATH,
      verify_signatures: true,
      verify_checksums: true,
      registries: [
        {
          name: "official",
          url: DEFAULT_REGISTRY_URL,
          priority: 1,
          enabled: true,
        },
      ],
      ...config,
    };
  }

  /**
   * Run installation hook
   */
  private async runHook(componentPath: string, hook: string): Promise<void> {
    // In real implementation, execute hook script
    // For now, just log
    console.log(`Running hook: ${hook} in ${componentPath}`);
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create component registry instance
 */
export async function createComponentRegistry(
  config?: Partial<RegistryConfig>
): Promise<ComponentRegistry> {
  const registry = new ComponentRegistry(config);
  await registry.initialize();
  return registry;
}

/**
 * Get global component registry instance
 */
let globalRegistry: ComponentRegistry | null = null;

export async function getGlobalRegistry(): Promise<ComponentRegistry> {
  if (!globalRegistry) {
    globalRegistry = await createComponentRegistry();
  }
  return globalRegistry;
}

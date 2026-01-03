/**
 * @lsi/app-registry - App Registry Implementation
 *
 * Manages application discovery, installation, and lifecycle.
 * Builds on the component registry to provide complete app management.
 */

import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import yaml from "js-yaml";
import semver from "semver";
import type { ComponentRegistry } from "@lsi/registry";
import type {
  AppManifest,
  AppInfo,
  AppRegistryEntry,
  AppRegistryIndex,
  InstalledApp,
  InstallOptions,
  InstallResult,
  RunOptions,
  UninstallOptions,
  AppHealth,
  SearchResult,
  AppSearchQuery,
  AppUpdateInfo,
  RegistryStatistics,
  ManifestValidationResult,
  HardwareCompatibilityResult,
  AppRegistryConfig,
  AppComponentDependency,
  HealthCheckConfig,
} from "./types.js";

import {
  AppRegistryErrorCode,
  AppRegistryError,
} from "./types.js";

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_REGISTRY_URL = "https://github.com/SuperInstance/apps";
const LOCAL_APPS_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE || "~",
  ".aequor",
  "apps"
);
const REGISTRY_INDEX_FILE = "index.json";
const MANIFESTS_DIR = "manifests";
const INSTALLED_DIR = "installed";
const CONFIG_DIR = "config";
const DATA_DIR = "data";
const LOGS_DIR = "logs";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse RAM string to bytes
 */
function parseRAMSize(ram: string): number {
  const match = ram.match(/^(\d+(?:\.\d+)?)\s*(GB|Gi|MB|Mi)?$/i);
  if (!match) {
    throw new Error(`Invalid RAM size: ${ram}`);
  }

  const value = parseFloat(match[1]);
  const unit = (match[2] || "GB").toUpperCase();

  const multiplier =
    unit === "GB" || unit === "GI" ? 1024 * 1024 * 1024 : 1024 * 1024;

  return Math.floor(value * multiplier);
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)}${units[unitIndex]}`;
}

// ============================================================================
// APP REGISTRY CLASS
// ============================================================================

/**
 * App Registry
 *
 * Manages application discovery, download, installation, and lifecycle.
 */
export class AppRegistry {
  private componentRegistry: any;  // ComponentRegistry - use any to avoid import issues
  private config: AppRegistryConfig;
  private localAppsPath: string;
  private indexPath: string;
  private manifestsPath: string;
  private installedPath: string;
  private configPath: string;
  private dataPath: string;
  private logsPath: string;

  constructor(config?: Partial<AppRegistryConfig>) {
    this.config = this.buildConfig(config);
    this.localAppsPath = this.config.local_apps_dir || LOCAL_APPS_PATH;
    this.indexPath = path.join(this.localAppsPath, REGISTRY_INDEX_FILE);
    this.manifestsPath = path.join(this.localAppsPath, MANIFESTS_DIR);
    this.installedPath = path.join(this.localAppsPath, INSTALLED_DIR);
    this.configPath = path.join(this.localAppsPath, CONFIG_DIR);
    this.dataPath = path.join(this.localAppsPath, DATA_DIR);
    this.logsPath = path.join(this.localAppsPath, LOGS_DIR);

    this.componentRegistry = null as any;  // Will be initialized when @lsi/registry is available
  }

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  /**
   * Initialize registry directory structure
   */
  async initialize(): Promise<void> {
    const dirs = [
      this.localAppsPath,
      this.manifestsPath,
      this.installedPath,
      this.configPath,
      this.dataPath,
      this.logsPath,
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }

    // Initialize component registry (if available)
    // Note: ComponentRegistry integration requires @lsi/registry package
    // For now, skip this initialization

    // Initialize empty index if not exists
    const indexExists = await this.fileExists(this.indexPath);
    if (!indexExists) {
      const emptyIndex: AppRegistryIndex = {
        version: "1.0.0",
        last_updated: new Date().toISOString(),
        total_apps: 0,
        apps: [],
        categories: [
          "ai-assistant",
          "development",
          "analytics",
          "education",
          "productivity",
          "integration",
          "infrastructure",
        ],
      };
      await this.saveIndex(emptyIndex);
    }
  }

  // ========================================================================
  // APP LISTING
  // ========================================================================

  /**
   * List all available apps
   */
  async list(options?: {
    category?: string;
    include_installed?: boolean;
    stability?: string;
  }): Promise<AppInfo[]> {
    const index = await this.loadIndex();

    let apps = index.apps;

    // Filter by category
    if (options?.category) {
      apps = apps.filter((app) => app.category === options.category);
    }

    // Filter by stability
    if (options?.stability) {
      apps = apps.filter((app) => app.stability === options.stability);
    }

    // Add installation status if requested
    if (options?.include_installed) {
      const installed = await this.listInstalled();
      const installedMap = new Map(
        installed.map((app) => [app.name, app])
      );

      apps = apps.map((app) => {
        const installedApp = installedMap.get(app.name);
        return {
          ...app,
          installed: !!installedApp,
          current_version: installedApp?.version,
          update_available: installedApp
            ? semver.gt(app.latest_version, installedApp.version)
            : false,
          health: installedApp?.health || 'unknown',
        };
      });
    }

    return apps;
  }

  /**
   * List installed apps
   */
  async listInstalled(): Promise<InstalledApp[]> {
    const apps: InstalledApp[] = [];

    try {
      const dirs = await fs.readdir(this.installedPath, { withFileTypes: true });

      for (const dir of dirs) {
        if (!dir.isDirectory()) continue;

        const manifestPath = path.join(this.installedPath, dir.name, "app-manifest.yaml");
        const manifestExists = await this.fileExists(manifestPath);

        if (!manifestExists) continue;

        try {
          const manifestContent = await fs.readFile(manifestPath, "utf-8");
          const manifest = yaml.load(manifestContent) as AppManifest;

          // Get status
          const status = await this.getAppStatus(manifest.metadata.name);
          const stats = await fs.stat(path.join(this.installedPath, dir.name));

          apps.push({
            name: manifest.metadata.name,
            version: manifest.metadata.version,
            path: path.join(this.installedPath, dir.name),
            installed_at: stats.mtime.toISOString(),
            manifest,
            running: status.running,
            pid: status.pid,
            port: status.port,
            health: status.health,
          });
        } catch (error) {
          // Skip invalid apps
          continue;
        }
      }
    } catch (error) {
      // Directory doesn't exist yet
      return [];
    }

    return apps;
  }

  // ========================================================================
  // APP SEARCH
  // ========================================================================

  /**
   * Search for apps
   */
  async search(query: AppSearchQuery): Promise<SearchResult[]> {
    const apps = await this.list({ include_installed: true });

    const searchTerm = query.query.toLowerCase();
    const results: SearchResult[] = [];

    for (const app of apps) {
      let score = 0;
      const matchedFields: (
        | "name"
        | "description"
        | "keywords"
        | "category"
      )[] = [];

      // Match in name (highest weight)
      if (app.name.toLowerCase().includes(searchTerm)) {
        score += app.name === searchTerm ? 1.0 : 0.7;
        matchedFields.push("name");
      }

      // Match in description (medium weight)
      if (app.description.toLowerCase().includes(searchTerm)) {
        score += 0.5;
        matchedFields.push("description");
      }

      // Match in keywords (medium weight)
      if (app.keywords.some((k) => k.toLowerCase().includes(searchTerm))) {
        score += 0.4;
        matchedFields.push("keywords");
      }

      // Match in category (low weight)
      if (app.category.toLowerCase().includes(searchTerm)) {
        score += 0.2;
        matchedFields.push("category");
      }

      if (score > 0) {
        results.push({
          ...app,
          score: Math.min(score, 1.0),
          matched_fields: matchedFields,
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Apply filters
    let filtered = results;

    if (query.category) {
      filtered = filtered.filter((r) => r.category === query.category);
    }

    if (query.stability) {
      filtered = filtered.filter((r) => r.stability === query.stability);
    }

    if (query.installed !== undefined) {
      filtered = filtered.filter((r) => r.installed === query.installed);
    }

    if (query.min_rating) {
      filtered = filtered.filter((r) => (r.rating || 0) >= query.min_rating!);
    }

    if (query.min_downloads) {
      filtered = filtered.filter((r) => (r.downloads || 0) >= query.min_downloads!);
    }

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 20;

    return filtered.slice(offset, offset + limit);
  }

  // ========================================================================
  // APP INFO
  // ========================================================================

  /**
   * Get app manifest
   */
  async getManifest(name: string, version?: string): Promise<AppManifest> {
    // Try installed version first
    const installed = await this.listInstalled();
    const installedApp = installed.find((app) => app.name === name);

    if (installedApp && (!version || installedApp.version === version)) {
      return installedApp.manifest;
    }

    // Try cached manifest
    const targetVersion = version || await this.getLatestVersion(name);
    if (!targetVersion) {
      throw new AppRegistryError(
        AppRegistryErrorCode.APP_NOT_FOUND,
        `App not found: ${name}`
      );
    }

    const cachedManifest = await this.loadCachedManifest(name, targetVersion);
    if (cachedManifest) {
      return cachedManifest;
    }

    // Fetch from remote registry
    return this.fetchManifest(name, targetVersion);
  }

  /**
   * Get app info (lightweight)
   */
  async info(name: string): Promise<AppInfo> {
    const index = await this.loadIndex();

    const app = index.apps.find((a) => a.name === name);

    if (!app) {
      throw new AppRegistryError(
        AppRegistryErrorCode.APP_NOT_FOUND,
        `App not found: ${name}`
      );
    }

    const installed = await this.listInstalled();
    const installedApp = installed.find((a) => a.name === name);

    return {
      ...app,
      installed: !!installedApp,
      current_version: installedApp?.version,
      update_available: installedApp
        ? semver.gt(app.latest_version, installedApp.version)
        : false,
      health: installedApp?.health || 'unknown',
    };
  }

  // ========================================================================
  // MANIFEST VALIDATION
  // ========================================================================

  /**
   * Validate app manifest
   */
  validateManifest(manifest: AppManifest): ManifestValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!manifest.apiVersion) {
      errors.push("Missing required field: apiVersion");
    }

    if (manifest.kind !== "App") {
      errors.push(`Invalid kind: ${manifest.kind} (expected "App")`);
    }

    if (!manifest.metadata?.name) {
      errors.push("Missing required field: metadata.name");
    }

    if (!manifest.metadata?.version) {
      errors.push("Missing required field: metadata.version");
    } else if (!semver.valid(manifest.metadata.version)) {
      errors.push(`Invalid semver: ${manifest.metadata.version}`);
    }

    if (!manifest.metadata?.description) {
      errors.push("Missing required field: metadata.description");
    }

    if (!manifest.category) {
      errors.push("Missing required field: category");
    }

    if (!manifest.components || manifest.components.length === 0) {
      warnings.push("No components specified - app may not be functional");
    }

    // Validate components
    if (manifest.components) {
      for (const component of manifest.components) {
        if (!component.name) {
          errors.push("Component missing name");
        }
        if (!component.version) {
          errors.push(`Component ${component.name} missing version`);
        }
      }
    }

    // Validate startup config if present
    if (manifest.startup) {
      if (!manifest.startup.entry_point) {
        errors.push("Startup config missing entry_point");
      }
      if (!manifest.startup.health_check?.endpoint) {
        warnings.push("Startup config missing health_check endpoint");
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ========================================================================
  // HARDWARE COMPATIBILITY
  // ========================================================================

  /**
   * Check hardware compatibility
   */
  async checkHardwareCompatibility(
    manifest: AppManifest
  ): Promise<HardwareCompatibilityResult> {
    const issues: string[] = [];
    let compatible = true;

    const result: HardwareCompatibilityResult = {
      compatible: true,
      issues: [],
    };

    // Check RAM
    if (manifest.requirements?.min_ram) {
      const requiredRAM = parseRAMSize(manifest.requirements.min_ram);
      const availableRAM = this.getAvailableRAM();

      result.ram = {
        required: formatBytes(requiredRAM),
        available: formatBytes(availableRAM),
        compatible: availableRAM >= requiredRAM,
      };

      if (!result.ram.compatible) {
        compatible = false;
        issues.push(
          `Insufficient RAM: ${result.ram.available} < ${result.ram.required}`
        );
      }
    }

    // Check CPU cores
    if (manifest.requirements?.cpu_cores) {
      const availableCores = this.getCPUCores();

      result.cpu = {
        required: manifest.requirements.cpu_cores,
        available: availableCores,
        compatible: availableCores >= manifest.requirements.cpu_cores,
      };

      if (!result.cpu.compatible) {
        compatible = false;
        issues.push(
          `Insufficient CPU cores: ${result.cpu.available} < ${result.cpu.required}`
        );
      }
    }

    // Check GPU
    if (manifest.requirements?.gpu) {
      const hasGPU = this.hasGPU();

      result.gpu = {
        required: true,
        available: hasGPU,
        compatible: hasGPU,
      };

      if (!result.gpu.compatible) {
        compatible = false;
        issues.push("GPU required but not available");
      }
    }

    result.compatible = compatible;
    result.issues = issues;

    return result;
  }

  // ========================================================================
  // APP INSTALLATION
  // ========================================================================

  /**
   * Install app
   */
  async install(
    name: string,
    options: InstallOptions = {}
  ): Promise<InstallResult> {
    const onProgress = options.on_progress || (() => {});

    try {
      // Progress: Resolving
      onProgress({
        stage: "resolving",
        percentage: 0,
        message: `Resolving app: ${name}`,
      });

      // Fetch manifest
      const manifest = await this.getManifest(name, options.version);

      // Validate manifest
      const validation = this.validateManifest(manifest);
      if (!validation.valid) {
        throw new AppRegistryError(
          AppRegistryErrorCode.INVALID_MANIFEST,
          `Invalid manifest: ${validation.errors.join(", ")}`,
          { errors: validation.errors }
        );
      }

      // Check if already installed
      const installed = await this.listInstalled();
      const existing = installed.find(
        (app) => app.name === name && app.version === manifest.metadata.version
      );

      if (existing && !options.force) {
        return {
          app: name,
          version: manifest.metadata.version,
          path: existing.path,
          componentsInstalled: [],
          configPath: this.getConfigPath(name),
          success: false,
          errors: [`Already installed: ${name}@${manifest.metadata.version}`],
          warnings: [],
        };
      }

      // Check hardware compatibility
      if (!options.skip_hardware_check) {
        const hwResult = await this.checkHardwareCompatibility(manifest);
        if (!hwResult.compatible) {
          throw new AppRegistryError(
            AppRegistryErrorCode.HARDWARE_INCOMPATIBLE,
            `Hardware requirements not met: ${hwResult.issues.join(", ")}`,
            { issues: hwResult.issues }
          );
        }
      }

      // Progress: Downloading
      onProgress({
        stage: "downloading",
        percentage: 10,
        message: "Downloading app manifest",
      });

      // Resolve component dependencies
      const componentsToInstall = await this.resolveComponentDependencies(
        manifest.components
      );

      // Progress: Installing components
      onProgress({
        stage: "installing_components",
        percentage: 20,
        message: `Installing ${componentsToInstall.length} components`,
      });

      const installedComponents: string[] = [];

      for (let i = 0; i < componentsToInstall.length; i++) {
        const component = componentsToInstall[i];
        const componentProgress = 20 + (i / componentsToInstall.length) * 40;

        onProgress({
          stage: "installing_components",
          percentage: componentProgress,
          message: `Installing component: ${component.name}@${component.version}`,
        });

        try {
          // Check if component is already installed
          // Note: This requires ComponentRegistry from @lsi/registry
          // For now, simulate component installation
          const isInstalled = false; // Simulated check

          if (!isInstalled) {
            // In production: await this.componentRegistry.install(component.name, { version: component.version, active: true });
            installedComponents.push(component.name);
          } else {
            installedComponents.push(`${component.name} (already installed)`);
          }
        } catch (error) {
          if (component.required) {
            throw new AppRegistryError(
              AppRegistryErrorCode.DEPENDENCY_CONFLICT,
              `Failed to install required component: ${component.name}`,
              { error: (error as Error).message }
            );
          }
        }
      }

      // Progress: Configuring
      onProgress({
        stage: "configuring",
        percentage: 70,
        message: "Creating app directory",
      });

      // Create app directory
      const appDir = path.join(
        this.installedPath,
        `${name}@${manifest.metadata.version}`
      );
      await fs.mkdir(appDir, { recursive: true });

      // Save manifest
      const manifestPath = path.join(appDir, "app-manifest.yaml");
      await fs.writeFile(manifestPath, yaml.dump(manifest), "utf-8");

      // Cache manifest
      const cachedManifestPath = path.join(
        this.manifestsPath,
        `${name}@${manifest.metadata.version}.yaml`
      );
      await fs.writeFile(cachedManifestPath, yaml.dump(manifest), "utf-8");

      // Generate config
      const config = this.generateConfig(manifest, options);
      const configFilePath = this.getConfigPath(name);
      await fs.mkdir(path.dirname(configFilePath), { recursive: true });
      await fs.writeFile(configFilePath, JSON.stringify(config, null, 2), "utf-8");

      // Create data directory
      const appDataPath = path.join(this.dataPath, name);
      await fs.mkdir(appDataPath, { recursive: true });

      // Create logs directory
      const appLogsPath = path.join(this.logsPath, name);
      await fs.mkdir(appLogsPath, { recursive: true });

      // Progress: Complete
      onProgress({
        stage: "complete",
        percentage: 100,
        message: `Installed ${name}@${manifest.metadata.version}`,
      });

      return {
        app: name,
        version: manifest.metadata.version,
        path: appDir,
        componentsInstalled: installedComponents,
        configPath: configFilePath,
        success: true,
        errors: [],
        warnings: validation.warnings,
      };
    } catch (error) {
      if (error instanceof AppRegistryError) {
        throw error;
      }

      throw new AppRegistryError(
        AppRegistryErrorCode.INSTALL_FAILED,
        `Installation failed: ${(error as Error).message}`,
        { originalError: (error as Error).stack }
      );
    }
  }

  // ========================================================================
  // APP LIFECYCLE
  // ========================================================================

  /**
   * Run installed app
   */
  async run(name: string, options: RunOptions = {}): Promise<void> {
    const manifest = await this.getManifest(name);

    // Get installed path
    const installed = await this.listInstalled();
    const app = installed.find((a) => a.name === name);

    if (!app) {
      throw new AppRegistryError(
        AppRegistryErrorCode.NOT_INSTALLED,
        `App not installed: ${name}`
      );
    }

    if (app.running) {
      throw new AppRegistryError(
        AppRegistryErrorCode.ALREADY_RUNNING,
        `App already running: ${name} (PID: ${app.pid})`
      );
    }

    // Validate components are installed
    for (const component of manifest.components) {
      if (component.required) {
        // Note: This requires ComponentRegistry from @lsi/registry
        // For now, skip validation in standalone mode
        // In production, check: const info = await this.componentRegistry.info(component.name);
      }
    }

    // In a real implementation, this would:
    // 1. Load the app's entry point
    // 2. Start components in dependency order
    // 3. Execute the app
    // 4. Monitor health

    console.log(`Would run app: ${name}`);
    console.log(`Entry point: ${manifest.startup?.entry_point || "Not specified"}`);
    console.log(`Working directory: ${options.cwd || app.path}`);
  }

  /**
   * Stop running app
   */
  async stop(name: string): Promise<void> {
    const installed = await this.listInstalled();
    const app = installed.find((a) => a.name === name);

    if (!app) {
      throw new AppRegistryError(
        AppRegistryErrorCode.NOT_INSTALLED,
        `App not installed: ${name}`
      );
    }

    if (!app.running) {
      throw new AppRegistryError(
        AppRegistryErrorCode.NOT_RUNNING,
        `App not running: ${name}`
      );
    }

    // In a real implementation, this would:
    // 1. Send SIGTERM to the process
    // 2. Wait for graceful shutdown
    // 3. Force kill if needed
    // 4. Update app status

    console.log(`Would stop app: ${name}`);
  }

  /**
   * Check app health
   */
  async health(name: string): Promise<AppHealth> {
    const manifest = await this.getManifest(name);
    const installed = await this.listInstalled();
    const app = installed.find((a) => a.name === name);

    if (!app) {
      throw new AppRegistryError(
        AppRegistryErrorCode.NOT_INSTALLED,
        `App not installed: ${name}`
      );
    }

    const healthCheck = manifest.startup?.health_check;
    const components: AppHealth["components"] = [];

    // Check component health
    for (const component of manifest.components) {
      try {
        // In a real implementation, this would check actual component health
        components.push({
          name: component.name,
          version: component.version,
          status: "healthy",
        });
      } catch (error) {
        components.push({
          name: component.name,
          version: component.version,
          status: "unhealthy",
          error: (error as Error).message,
        });
      }
    }

    // Perform health check
    let status: AppHealth["status"] = "healthy";
    const issues: string[] = [];

    if (healthCheck) {
      // In a real implementation, this would make an HTTP request
      // const response = await fetch(`http://localhost:${app.port}${healthCheck.endpoint}`);
    }

    return {
      name,
      status,
      uptime: app.running ? 0 : 0, // Calculate from process start time
      pid: app.pid,
      port: app.port,
      components,
      last_check: new Date().toISOString(),
      issues,
    };
  }

  // ========================================================================
  // APP UNINSTALLATION
  // ========================================================================

  /**
   * Uninstall app
   */
  async uninstall(name: string, options: UninstallOptions = {}): Promise<void> {
    const installed = await this.listInstalled();
    const app = installed.find((a) => a.name === name);

    if (!app) {
      throw new AppRegistryError(
        AppRegistryErrorCode.NOT_INSTALLED,
        `App not installed: ${name}`
      );
    }

    // Stop if running
    if (app.running && options.stop !== false) {
      await this.stop(name);
    }

    // Remove app directory
    await fs.rm(app.path, { recursive: true, force: true });

    // Remove config
    const configPath = this.getConfigPath(name);
    if (await this.fileExists(configPath)) {
      await fs.unlink(configPath);
    }

    // Purge data if requested
    if (options.purge) {
      const appDataPath = path.join(this.dataPath, name);
      if (await this.fileExists(appDataPath)) {
        await fs.rm(appDataPath, { recursive: true, force: true });
      }

      const appLogsPath = path.join(this.logsPath, name);
      if (await this.fileExists(appLogsPath)) {
        await fs.rm(appLogsPath, { recursive: true, force: true });
      }
    }
  }

  // ========================================================================
  // UPDATE MANAGEMENT
  // ========================================================================

  /**
   * Check for app updates
   */
  async checkUpdates(name?: string): Promise<AppUpdateInfo[]> {
    const installed = await this.listInstalled();
    const updates: AppUpdateInfo[] = [];

    for (const app of installed) {
      if (name && app.name !== name) continue;

      try {
        const info = await this.info(app.name);

        if (semver.gt(info.latest_version, app.version)) {
          updates.push({
            name: app.name,
            current_version: app.version,
            latest_version: info.latest_version,
            update_available: true,
          });
        }
      } catch (error) {
        // Skip apps that can't be checked
        continue;
      }
    }

    return updates;
  }

  /**
   * Update app
   */
  async update(name: string, options?: InstallOptions): Promise<InstallResult> {
    const installed = await this.listInstalled();
    const existing = installed.find((a) => a.name === name);

    if (!existing) {
      throw new AppRegistryError(
        AppRegistryErrorCode.NOT_INSTALLED,
        `App not installed: ${name}`
      );
    }

    const info = await this.info(name);

    if (!info.update_available) {
      return {
        app: name,
        version: existing.version,
        path: existing.path,
        componentsInstalled: [],
        configPath: this.getConfigPath(name),
        success: true,
        errors: [],
        warnings: ["Already up to date"],
      };
    }

    // Uninstall old version
    await this.uninstall(name, { stop: true, purge: false });

    // Install new version
    return this.install(name, {
      ...options,
      version: info.latest_version,
    });
  }

  // ========================================================================
  // REGISTRY INDEX MANAGEMENT
  // ========================================================================

  /**
   * Load registry index
   */
  private async loadIndex(): Promise<AppRegistryIndex> {
    const indexExists = await this.fileExists(this.indexPath);

    if (!indexExists) {
      return {
        version: "1.0.0",
        last_updated: new Date().toISOString(),
        total_apps: 0,
        apps: [],
        categories: [
          "ai-assistant",
          "development",
          "analytics",
          "education",
          "productivity",
          "integration",
          "infrastructure",
        ],
      };
    }

    const content = await fs.readFile(this.indexPath, "utf-8");
    return JSON.parse(content) as AppRegistryIndex;
  }

  /**
   * Save registry index
   */
  private async saveIndex(index: AppRegistryIndex): Promise<void> {
    await fs.writeFile(
      this.indexPath,
      JSON.stringify(index, null, 2),
      "utf-8"
    );
  }

  /**
   * Update registry index from remote
   */
  async updateIndex(): Promise<void> {
    // In a real implementation, fetch from remote registry
    const index = await this.loadIndex();
    index.last_updated = new Date().toISOString();
    await this.saveIndex(index);
  }

  // ========================================================================
  // STATISTICS
  // ========================================================================

  /**
   * Get registry statistics
   */
  async getStatistics(): Promise<RegistryStatistics> {
    const index = await this.loadIndex();
    const installed = await this.listInstalled();
    const updates = await this.checkUpdates();

    const appsByCategory: Record<string, number> = {};
    const appsByStability: Record<string, number> = {};

    for (const app of index.apps) {
      appsByCategory[app.category] = (appsByCategory[app.category] || 0) + 1;
      appsByStability[app.stability] = (appsByStability[app.stability] || 0) + 1;
    }

    const runningAppsCount = installed.filter((app) => app.running).length;

    return {
      total_apps: index.total_apps,
      installed_apps: installed.length,
      running_apps: runningAppsCount,
      available_updates: updates.length,
      total_size_mb: 0, // Calculate from actual files
      apps_by_category: appsByCategory as any,
      apps_by_stability: appsByStability as any,
    };
  }

  // ========================================================================
  // PRIVATE HELPER METHODS
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
  private buildConfig(config?: Partial<AppRegistryConfig>): AppRegistryConfig {
    return {
      local_apps_dir: LOCAL_APPS_PATH,
      verify_manifests: true,
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
   * Load cached manifest
   */
  private async loadCachedManifest(
    name: string,
    version: string
  ): Promise<AppManifest | null> {
    const manifestPath = path.join(
      this.manifestsPath,
      `${name}@${version}.yaml`
    );

    if (!(await this.fileExists(manifestPath))) {
      return null;
    }

    const content = await fs.readFile(manifestPath, "utf-8");
    return yaml.load(content) as AppManifest;
  }

  /**
   * Fetch manifest from remote registry
   */
  private async fetchManifest(
    name: string,
    version: string
  ): Promise<AppManifest> {
    // In a real implementation, fetch from remote registry URL
    throw new AppRegistryError(
      AppRegistryErrorCode.APP_NOT_FOUND,
      `Manifest not found in cache: ${name}@${version}`
    );
  }

  /**
   * Get latest version of app
   */
  private async getLatestVersion(name: string): Promise<string | null> {
    const index = await this.loadIndex();
    const app = index.apps.find((a) => a.name === name);
    return app?.latest_version || null;
  }

  /**
   * Resolve component dependencies
   */
  private async resolveComponentDependencies(
    components: AppComponentDependency[]
  ): Promise<Array<{ name: string; version: string; required: boolean }>> {
    const resolved: Array<{ name: string; version: string; required: boolean }> = [];

    for (const component of components) {
      if (component.required) {
        // In a real implementation, use the resolver to find best version
        resolved.push({
          name: component.name,
          version: component.version,
          required: component.required,
        });
      }
    }

    return resolved;
  }

  /**
   * Generate app configuration
   */
  private generateConfig(
    manifest: AppManifest,
    options: InstallOptions
  ): Record<string, unknown> {
    const config: Record<string, unknown> = {
      ...manifest.configuration,
      ...options.config,
    };

    // Add component configurations
    if (manifest.components) {
      for (const component of manifest.components) {
        if (component.configuration) {
          config[component.name] = component.configuration;
        }
      }
    }

    return config;
  }

  /**
   * Get config file path for app
   */
  private getConfigPath(name: string): string {
    return path.join(this.configPath, `${name}.json`);
  }

  /**
   * Get app status
   */
  private async getAppStatus(
    name: string
  ): Promise<{ running: boolean; pid?: number; port?: number; health: InstalledApp["health"] }> {
    // In a real implementation, check if process is running
    // For now, return default
    return {
      running: false,
      health: 'unknown',
    };
  }

  /**
   * Get available RAM
   */
  private getAvailableRAM(): number {
    // In a real implementation, use os.totalmem() and os.freemem()
    return 8 * 1024 * 1024 * 1024; // 8GB default
  }

  /**
   * Get CPU cores
   */
  private getCPUCores(): number {
    // In a real implementation, use os.cpus()
    return 4; // 4 cores default
  }

  /**
   * Check if GPU is available
   */
  private hasGPU(): boolean {
    // In a real implementation, check for GPU
    return false;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create app registry instance
 */
export async function createAppRegistry(
  config?: Partial<AppRegistryConfig>
): Promise<AppRegistry> {
  const registry = new AppRegistry(config);
  await registry.initialize();
  return registry;
}

/**
 * Get global app registry instance
 */
let globalRegistry: AppRegistry | null = null;

export async function getGlobalRegistry(): Promise<AppRegistry> {
  if (!globalRegistry) {
    globalRegistry = await createAppRegistry();
  }
  return globalRegistry;
}

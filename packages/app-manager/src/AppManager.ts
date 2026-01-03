/**
 * @lsi/app-manager - App Lifecycle Management
 *
 * Manages the complete lifecycle of Aequor apps:
 * - Pull apps from registry
 * - Resolve component dependencies
 * - Configure and run apps
 * - Enhance apps with advanced components
 * - Monitor app health
 * - Remove apps and cleanup
 */

import * as fs from "fs-extra";
import * as path from "path";
import * as yaml from "yaml";
import semver from "semver";
import chalk from "chalk";
import ora from "ora";
import { ComponentRegistry, getGlobalRegistry } from "@lsi/registry";
import {
  AppManifest,
  AppState,
  AppStatus,
  AppInfo,
  InstalledApp,
  ComponentAppState,
  AppHealthStatus,
  HealthCheckResult,
  PullOptions,
  PullProgress,
  RunOptions,
  EnhanceOptions,
  AppSearchQuery,
  AppSearchResult,
  AppManagerError,
  AppManagerErrorCode,
  AppComponentReference,
} from "./types.js";

// ============================================================================
// CONSTANTS
// ============================================================================

const APPS_DIR = "apps";
const MANIFEST_FILENAME = "app-manifest.yaml";
const STATE_FILENAME = "app-state.json";

// ============================================================================
// APP MANAGER CLASS
// ============================================================================

/**
 * App Manager
 *
 * Manages app lifecycle including pull, run, enhance, and remove operations.
 */
export class AppManager {
  private registry: ComponentRegistry;
  private appsPath: string;

  constructor(registry?: ComponentRegistry) {
    this.registry = registry;
    this.appsPath = path.join(
      process.env.HOME || process.env.USERPROFILE || "~",
      ".aequor",
      APPS_DIR
    );
  }

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  /**
   * Initialize app manager
   */
  async initialize(): Promise<void> {
    // Ensure apps directory exists
    await fs.ensureDir(this.appsPath);

    // Initialize registry if not provided
    if (!this.registry) {
      this.registry = await getGlobalRegistry();
    }
  }

  // ========================================================================
  // APP PULLING
  // ========================================================================

  /**
   * Pull app from registry
   */
  async pull(appName: string, options: PullOptions = {}): Promise<AppState> {
    const spinner = ora({
      text: `Pulling app: ${appName}`,
      color: "cyan",
    }).start();

    try {
      // Report progress
      const reportProgress = (progress: PullProgress) => {
        spinner.text = progress.message;
        options.onProgress?.(progress);
      };

      // Load app manifest
      reportProgress({
        app: appName,
        operation: "resolving",
        downloaded: 0,
        total: 1,
        progress: 0,
        message: `Resolving app manifest: ${appName}`,
      });

      const manifest = await this.loadAppManifest(appName, options.version);

      // Resolve components
      reportProgress({
        app: appName,
        operation: "resolving",
        downloaded: 0,
        total: manifest.components.length,
        progress: 10,
        message: `Resolving ${manifest.components.length} components`,
      });

      const componentRefs = options.includeAdvanced
        ? [...manifest.components, ...(manifest.advanced_components || [])]
        : manifest.components;

      const resolvedComponents = await this.resolveComponents(
        componentRefs,
        {
          skipDependencies: options.skipDependencies,
        }
      );

      // Download components
      reportProgress({
        app: appName,
        operation: "downloading",
        downloaded: 0,
        total: resolvedComponents.length,
        progress: 20,
        message: `Downloading ${resolvedComponents.length} components`,
      });

      const installedComponents: ComponentAppState[] = [];
      for (let i = 0; i < resolvedComponents.length; i++) {
        const component = resolvedComponents[i];

        reportProgress({
          app: appName,
          operation: "downloading",
          component: component.name,
          downloaded: i,
          total: resolvedComponents.length,
          progress: 20 + Math.floor((i / resolvedComponents.length) * 60),
          message: `Downloading component: ${component.name}@${component.version}`,
        });

        if (!options.dryRun) {
          const installed = await this.registry.install(component.name, {
            version: component.version,
            skip_dependencies: options.skipDependencies,
          });

          installedComponents.push({
            name: installed.name,
            version: installed.version,
            status: "resolved",
            advanced: this.isAdvancedComponent(manifest, component.name),
            path: installed.path,
          });
        }
      }

      // Create app directory
      const appPath = path.join(this.appsPath, `${appName}@${manifest.metadata.version}`);
      await fs.ensureDir(appPath);

      // Save manifest
      const manifestPath = path.join(appPath, MANIFEST_FILENAME);
      if (!options.dryRun) {
        await fs.writeFile(manifestPath, yaml.stringify(manifest), "utf-8");
      }

      // Create initial state
      const appState: AppState = {
        name: appName,
        version: manifest.metadata.version,
        status: options.dryRun ? "resolved" : "configured",
        path: appPath,
        components: installedComponents,
        updated_at: new Date(),
      };

      // Save state
      const statePath = path.join(appPath, STATE_FILENAME);
      if (!options.dryRun) {
        await fs.writeFile(statePath, JSON.stringify(appState, null, 2), "utf-8");
      }

      reportProgress({
        app: appName,
        operation: "complete",
        downloaded: resolvedComponents.length,
        total: resolvedComponents.length,
        progress: 100,
        message: `Successfully pulled app: ${appName}`,
      });

      spinner.succeed(chalk.green(`Successfully pulled app: ${appName}`));

      return appState;
    } catch (error) {
      spinner.fail(chalk.red(`Failed to pull app: ${appName}`));
      throw error;
    }
  }

  // ========================================================================
  // APP RUNNING
  // ========================================================================

  /**
   * Run app
   */
  async run(appName: string, options: RunOptions = {}): Promise<void> {
    const spinner = ora({
      text: `Starting app: ${appName}`,
      color: "cyan",
    }).start();

    try {
      // Load app state
      const appState = await this.getAppState(appName);

      if (!appState) {
        throw new AppManagerError(
          "APP_NOT_FOUND",
          `App not found: ${appName}. Run 'aequor app pull ${appName}' first.`
        );
      }

      // Check if already running
      if (appState.status === "running") {
        spinner.warn(chalk.yellow(`App already running: ${appName}`));
        return;
      }

      // Load manifest
      const manifest = await this.loadAppManifestFromPath(appState.path);

      // Apply configuration overrides
      const config = this.applyConfigOverrides(manifest, options);

      // Validate configuration
      await this.validateConfiguration(config);

      // Start components
      spinner.text = `Starting ${appState.components.length} components`;

      for (const component of appState.components) {
        await this.startComponent(component, config);
      }

      // Update state
      appState.status = "running";
      appState.updated_at = new Date();
      appState.pid = process.pid;

      const statePath = path.join(appState.path, STATE_FILENAME);
      await fs.writeFile(statePath, JSON.stringify(appState, null, 2), "utf-8");

      spinner.succeed(
        chalk.green(`App started: ${appName}`) +
          chalk.gray(` (PID: ${appState.pid})`)
      );

      // Print app info
      this.printAppInfo(manifest, appState);
    } catch (error) {
      spinner.fail(chalk.red(`Failed to start app: ${appName}`));
      throw error;
    }
  }

  /**
   * Stop app
   */
  async stop(appName: string): Promise<void> {
    const spinner = ora({
      text: `Stopping app: ${appName}`,
      color: "cyan",
    }).start();

    try {
      const appState = await this.getAppState(appName);

      if (!appState) {
        throw new AppManagerError(
          "APP_NOT_FOUND",
          `App not found: ${appName}`
        );
      }

      if (appState.status !== "running") {
        spinner.warn(chalk.yellow(`App not running: ${appName}`));
        return;
      }

      // Stop components
      for (const component of appState.components) {
        await this.stopComponent(component);
      }

      // Update state
      appState.status = "stopped";
      appState.updated_at = new Date();
      appState.pid = undefined;

      const statePath = path.join(appState.path, STATE_FILENAME);
      await fs.writeFile(statePath, JSON.stringify(appState, null, 2), "utf-8");

      spinner.succeed(chalk.green(`App stopped: ${appName}`));
    } catch (error) {
      spinner.fail(chalk.red(`Failed to stop app: ${appName}`));
      throw error;
    }
  }

  // ========================================================================
  // APP ENHANCEMENT
  // ========================================================================

  /**
   * Enhance app with advanced components
   */
  async enhance(appName: string, options: EnhanceOptions): Promise<AppState> {
    const spinner = ora({
      text: `Enhancing app: ${appName}`,
      color: "cyan",
    }).start();

    try {
      // Load app manifest
      const manifest = await this.loadAppManifest(appName);

      if (!manifest.advanced_components || manifest.advanced_components.length === 0) {
        spinner.warn(chalk.yellow(`No advanced components available for: ${appName}`));
        return await this.getAppState(appName);
      }

      // Filter components to add
      const componentsToAdd = manifest.advanced_components.filter((ac) =>
        options.components.includes(ac.name)
      );

      if (componentsToAdd.length === 0) {
        spinner.warn(chalk.yellow(`No matching advanced components found`));
        return await this.getAppState(appName);
      }

      // Preview changes
      if (options.dryRun) {
        spinner.info(chalk.cyan(`Would add ${componentsToAdd.length} advanced component(s):`));
        for (const component of componentsToAdd) {
          console.log(chalk.gray(`  - ${component.name}@${component.version}`));
          if (component.description) {
            console.log(chalk.gray(`    ${component.description}`));
          }
        }
        return await this.getAppState(appName);
      }

      // Install advanced components
      spinner.text = `Installing ${componentsToAdd.length} advanced component(s)`;

      for (const component of componentsToAdd) {
        spinner.text = `Installing component: ${component.name}`;
        await this.registry.install(component.name, {
          version: component.version,
          skip_dependencies: options.skipDependencies,
        });
      }

      // Update app state
      const appState = await this.getAppState(appName);
      if (appState) {
        for (const component of componentsToAdd) {
          const installed = await this.registry.info(component.name);
          appState.components.push({
            name: component.name,
            version: installed.current_version || installed.latest_version,
            status: "resolved",
            advanced: true,
            path: "", // Will be filled by registry
          });
        }

        const statePath = path.join(appState.path, STATE_FILENAME);
        await fs.writeFile(statePath, JSON.stringify(appState, null, 2), "utf-8");
      }

      spinner.succeed(
        chalk.green(`Enhanced app with ${componentsToAdd.length} advanced component(s):`)
      );
      for (const component of componentsToAdd) {
        console.log(chalk.gray(`  ✓ ${component.name}`));
      }

      return appState;
    } catch (error) {
      spinner.fail(chalk.red(`Failed to enhance app: ${appName}`));
      throw error;
    }
  }

  // ========================================================================
  // APP LISTING
  // ========================================================================

  /**
   * List all installed apps
   */
  async list(): Promise<AppInfo[]> {
    const appsDir = await fs.readdir(this.appsPath, { withFileTypes: true });
    const apps: AppInfo[] = [];

    for (const dir of appsDir) {
      if (!dir.isDirectory()) continue;

      const manifestPath = path.join(this.appsPath, dir.name, MANIFEST_FILENAME);
      const manifestExists = await fs.pathExists(manifestPath);

      if (!manifestExists) continue;

      try {
        const manifestContent = await fs.readFile(manifestPath, "utf-8");
        const manifest = yaml.parse(manifestContent) as AppManifest;

        const statePath = path.join(this.appsPath, dir.name, STATE_FILENAME);
        const stateExists = await fs.pathExists(statePath);

        let currentVersion: string | undefined;
        let running = false;

        if (stateExists) {
          const stateContent = await fs.readFile(statePath, "utf-8");
          const state = JSON.parse(stateContent) as AppState;
          currentVersion = state.version;
          running = state.status === "running";
        }

        apps.push({
          name: manifest.metadata.name,
          latest_version: manifest.metadata.version,
          versions: [manifest.metadata.version],
          category: manifest.category,
          description: manifest.metadata.description,
          keywords: manifest.metadata.keywords || [],
          installed: true,
          current_version: currentVersion,
          update_available: false, // TODO: Check for updates
          component_count: manifest.components.length,
          advanced_component_count: manifest.advanced_components?.length || 0,
        });
      } catch (error) {
        // Skip invalid apps
        continue;
      }
    }

    return apps;
  }

  /**
   * Get app status
   */
  async status(appName: string, includeHealth = false): Promise<AppState> {
    const appState = await this.getAppState(appName);

    if (!appState) {
      throw new AppManagerError(
        "APP_NOT_FOUND",
        `App not found: ${appName}`
      );
    }

    if (includeHealth) {
      appState.health = await this.checkHealth(appState);
    }

    return appState;
  }

  // ========================================================================
  // APP REMOVAL
  // ========================================================================

  /**
   * Remove app
   */
  async remove(appName: string, keepData = false): Promise<void> {
    const spinner = ora({
      text: `Removing app: ${appName}`,
      color: "cyan",
    }).start();

    try {
      const appState = await this.getAppState(appName);

      if (!appState) {
        throw new AppManagerError(
          "APP_NOT_FOUND",
          `App not found: ${appName}`
        );
      }

      // Stop if running
      if (appState.status === "running") {
        await this.stop(appName);
      }

      // Remove app directory
      if (!keepData) {
        await fs.remove(appState.path);
      } else {
        // Keep data but remove state
        const statePath = path.join(appState.path, STATE_FILENAME);
        await fs.remove(statePath);
      }

      spinner.succeed(chalk.green(`App removed: ${appName}`));
    } catch (error) {
      spinner.fail(chalk.red(`Failed to remove app: ${appName}`));
      throw error;
    }
  }

  // ========================================================================
  // APP SEARCH
  // ========================================================================

  /**
   * Search for apps
   */
  async search(query: AppSearchQuery): Promise<AppSearchResult[]> {
    const installed = await this.list();
    const searchTerm = query.query.toLowerCase();

    const results: AppSearchResult[] = [];

    for (const app of installed) {
      let score = 0;
      const matchedFields: ("name" | "description" | "keywords" | "category")[] = [];

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

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 20;

    return filtered.slice(offset, offset + limit);
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  /**
   * Load app manifest from registry
   */
  private async loadAppManifest(
    appName: string,
    version?: string
  ): Promise<AppManifest> {
    // For now, check if manifest exists locally
    // In production, this would fetch from a remote app registry
    const manifestPath = path.join(this.appsPath, `${appName}@${version || "latest"}`, MANIFEST_FILENAME);

    if (await fs.pathExists(manifestPath)) {
      const content = await fs.readFile(manifestPath, "utf-8");
      return yaml.parse(content) as AppManifest;
    }

    // If not found locally, throw error
    // In production, this would query the remote app registry
    throw new AppManagerError(
      "APP_NOT_FOUND",
      `App manifest not found: ${appName}${version ? `@${version}` : ""}`
    );
  }

  /**
   * Load app manifest from path
   */
  private async loadAppManifestFromPath(appPath: string): Promise<AppManifest> {
    const manifestPath = path.join(appPath, MANIFEST_FILENAME);
    const content = await fs.readFile(manifestPath, "utf-8");
    return yaml.parse(content) as AppManifest;
  }

  /**
   * Get app state
   */
  private async getAppState(appName: string): Promise<AppState | null> {
    const appsDir = await fs.readdir(this.appsPath, { withFileTypes: true });

    for (const dir of appsDir) {
      if (!dir.isDirectory()) continue;
      if (!dir.name.startsWith(appName + "@")) continue;

      const statePath = path.join(this.appsPath, dir.name, STATE_FILENAME);
      if (!(await fs.pathExists(statePath))) continue;

      const content = await fs.readFile(statePath, "utf-8");
      return JSON.parse(content) as AppState;
    }

    return null;
  }

  /**
   * Resolve component dependencies
   */
  private async resolveComponents(
    components: AppComponentReference[],
    options: { skipDependencies?: boolean } = {}
  ): Promise<Array<{ name: string; version: string }>> {
    const resolved: Array<{ name: string; version: string }> = [];

    for (const component of components) {
      // Get component info
      const info = await this.registry.info(component.name);

      // Find best matching version
      const version = this.selectVersion(
        info.latest_version,
        component.version
      );

      if (!version) {
        throw new AppManagerError(
          "COMPONENT_RESOLUTION_FAILED",
          `No version satisfying ${component.version} for component: ${component.name}`
        );
      }

      resolved.push({
        name: component.name,
        version,
      });
    }

    return resolved;
  }

  /**
   * Select best version matching constraint
   */
  private selectVersion(current: string, constraint: string): string | null {
    if (semver.satisfies(current, constraint)) {
      return current;
    }
    return null;
  }

  /**
   * Check if component is advanced
   */
  private isAdvancedComponent(manifest: AppManifest, componentName: string): boolean {
    return manifest.advanced_components?.some((ac) => ac.name === componentName) ?? false;
  }

  /**
   * Apply configuration overrides
   */
  private applyConfigOverrides(manifest: AppManifest, options: RunOptions): AppManifest {
    const config = { ...manifest };

    // Apply environment override
    if (options.environment) {
      config.configuration = {
        ...config.configuration,
        environment: options.environment,
      };
    }

    // Apply port override
    if (options.port) {
      config.networking = {
        ...config.networking,
        port: options.port,
      };
    }

    // Apply log level override
    if (options.logLevel) {
      config.configuration = {
        ...config.configuration,
        log_level: options.logLevel,
      };
    }

    // Apply metrics override
    if (options.enableMetrics !== undefined) {
      config.configuration = {
        ...config.configuration,
        enable_metrics: options.enableMetrics,
      };
    }

    // Apply tracing override
    if (options.enableTracing !== undefined) {
      config.configuration = {
        ...config.configuration,
        enable_tracing: options.enableTracing,
      };
    }

    return config;
  }

  /**
   * Validate configuration
   */
  private async validateConfiguration(manifest: AppManifest): Promise<void> {
    // Check if port is available
    if (manifest.networking?.port) {
      const portAvailable = await this.isPortAvailable(manifest.networking.port);
      if (!portAvailable) {
        throw new AppManagerError(
          "PORT_IN_USE",
          `Port ${manifest.networking.port} is already in use`
        );
      }
    }

    // Check if paths are writable
    if (manifest.storage?.data_path) {
      const writable = await this.isPathWritable(manifest.storage.data_path);
      if (!writable) {
        throw new AppManagerError(
          "PATH_NOT_WRITABLE",
          `Data path is not writable: ${manifest.storage.data_path}`
        );
      }
    }
  }

  /**
   * Start component
   */
  private async startComponent(
    component: ComponentAppState,
    config: AppManifest
  ): Promise<void> {
    // In production, this would start the component
    // For now, just mark as running
    component.status = "running";
  }

  /**
   * Stop component
   */
  private async stopComponent(component: ComponentAppState): Promise<void> {
    // In production, this would stop the component
    component.status = "stopped";
  }

  /**
   * Check app health
   */
  private async checkHealth(appState: AppState): Promise<AppHealthStatus> {
    const results: HealthCheckResult[] = [];
    const componentsHealth: Record<string, boolean> = {};

    for (const component of appState.components) {
      // In production, this would perform actual health checks
      componentsHealth[component.name] = true;
    }

    return {
      healthy: Object.values(componentsHealth).every((h) => h),
      components: componentsHealth,
      last_check: new Date(),
      results,
    };
  }

  /**
   * Check if port is available
   */
  private async isPortAvailable(port: number): Promise<boolean> {
    // In production, this would check if port is actually available
    // For now, just return true
    return true;
  }

  /**
   * Check if path is writable
   */
  private async isPathWritable(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Print app info
   */
  private printAppInfo(manifest: AppManifest, state: AppState): void {
    console.log("");
    console.log(chalk.cyan.bold(manifest.metadata.name));
    console.log(chalk.gray(`━`.repeat(50)));
    console.log(chalk.gray(`Version: ${manifest.metadata.version}`));
    console.log(chalk.gray(`Category: ${manifest.category}`));
    console.log(chalk.gray(`Components: ${state.components.length}`));

    if (manifest.networking?.port) {
      console.log("");
      console.log(chalk.green.bold(`🌐 http://localhost:${manifest.networking.port}`));
    }

    console.log("");
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export * from "./types.js";

/**
 * @fileoverview Module Loader - Dynamic module loading with version negotiation
 * @author Aequor Project - Round 18 Agent 3
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Module loading strategy
 */
export type LoadStrategy = "eager" | "lazy" | "on-demand";

/**
 * Module state
 */
export type ModuleState = "unloaded" | "loading" | "loaded" | "failed";

/**
 * Module source location
 */
export interface ModuleSource {
  type: "local" | "remote" | "cdn" | "registry";
  url: string;
  scope?: string; // For webpack module federation
  module?: string; // Module name
}

/**
 * Module version information
 */
export interface ModuleVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
  toString(): string;
}

/**
 * Module manifest
 */
export interface ModuleManifest {
  id: string;
  name: string;
  version: ModuleVersion;
  source: ModuleSource;
  dependencies: string[]; // Module IDs
  peerDependencies: string[];
  exports: string[]; // Exported symbols
  size?: number; // Bytes
  hash?: string; // Content hash
  loadStrategy: LoadStrategy;
  state: ModuleState;
}

/**
 * Loaded module instance
 */
export interface LoadedModule {
  id: string;
  manifest: ModuleManifest;
  exports: unknown;
  loadTime: number; // milliseconds
  error?: Error;
}

/**
 * Module loading options
 */
export interface ModuleLoadOptions {
  timeout?: number; // milliseconds
  retries?: number;
  cache?: boolean;
  version?: string; // Specific version to load
  strategy?: LoadStrategy;
  signal?: AbortSignal;
}

/**
 * Module registry entry
 */
export interface RegistryEntry {
  manifest: ModuleManifest;
  instance?: LoadedModule;
  loadPromise?: Promise<LoadedModule>;
  lastUsed?: Date;
  loadCount?: number;
  state?: "unloaded" | "loading" | "loaded" | "error";
}

/**
 * Cache entry
 */
export interface CacheEntry {
  module: LoadedModule;
  timestamp: Date;
  hits: number;
}

/**
 * Loading metrics
 */
export interface LoadMetrics {
  totalModules: number;
  loadedModules: number;
  failedModules: number;
  totalLoadTime: number; // milliseconds
  avgLoadTime: number;
  cacheHits: number;
  cacheMisses: number;
}

/**
 * Configuration for ModuleLoader
 */
export interface ModuleLoaderConfig {
  cacheEnabled?: boolean;
  cacheTTL?: number; // milliseconds
  defaultTimeout?: number;
  maxRetries?: number;
  enablePreload?: boolean;
  enableVersionNegotiation?: boolean;
  fallbackURL?: string;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_LOADER_CONFIG: Required<
  Omit<ModuleLoaderConfig, "fallbackURL">
> = {
  cacheEnabled: true,
  cacheTTL: 3600000, // 1 hour
  defaultTimeout: 10000, // 10 seconds
  maxRetries: 3,
  enablePreload: true,
  enableVersionNegotiation: true,
};

// ============================================================================
// MODULE VERSION
// ============================================================================

/**
 * Parse semver string to ModuleVersion
 */
export function parseVersion(version: string): ModuleVersion {
  const match = version.match(
    /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?(?:\+([a-zA-Z0-9.-]+))?$/
  );
  if (!match) {
    throw new Error(`Invalid version string: ${version}`);
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4],
    build: match[5],
    toString() {
      let result = `${this.major}.${this.minor}.${this.patch}`;
      if (this.prerelease) result += `-${this.prerelease}`;
      if (this.build) result += `+${this.build}`;
      return result;
    },
  };
}

/**
 * Compare two versions
 * @returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export function compareVersions(v1: ModuleVersion, v2: ModuleVersion): number {
  if (v1.major !== v2.major) return v1.major > v2.major ? 1 : -1;
  if (v1.minor !== v2.minor) return v1.minor > v2.minor ? 1 : -1;
  if (v1.patch !== v2.patch) return v1.patch > v2.patch ? 1 : -1;
  return 0;
}

/**
 * Check if version satisfies semver range
 */
export function satisfiesVersion(
  version: ModuleVersion,
  range: string
): boolean {
  // Simple semver implementation for common ranges
  if (range === "*") return true;

  const match = range.match(/^(\^|~|>=|>|<=|<|=)?(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return false;

  const operator = match[1] || "=";
  const min: ModuleVersion = {
    major: parseInt(match[2], 10),
    minor: parseInt(match[3], 10),
    patch: parseInt(match[4], 10),
    toString() {
      return `${this.major}.${this.minor}.${this.patch}`;
    },
  };

  const cmp = compareVersions(version, min);

  switch (operator) {
    case "^":
      // Compatible with version (major must match, minor >=)
      return version.major === min.major && cmp >= 0;
    case "~":
      // Approximately equivalent to version (major.minor must match)
      return version.major === min.major && version.minor === min.minor;
    case ">=":
      return cmp >= 0;
    case ">":
      return cmp > 0;
    case "<=":
      return cmp <= 0;
    case "<":
      return cmp < 0;
    case "=":
    default:
      return cmp === 0;
  }
}

// ============================================================================
// MODULE LOADER
// ============================================================================

/**
 * ModuleLoader - Dynamic module loading with caching and version negotiation
 *
 * Handles loading remote and local modules with support for:
 * - Module Federation (webpack)
 * - Version negotiation
 * - Caching with TTL
 * - Retry logic
 * - Preloading
 */
export class ModuleLoader {
  private config: Required<Omit<ModuleLoaderConfig, "fallbackURL">>;
  private registry: Map<string, RegistryEntry> = new Map();
  private cache: Map<string, CacheEntry> = new Map();
  private metrics: LoadMetrics = {
    totalModules: 0,
    loadedModules: 0,
    failedModules: 0,
    totalLoadTime: 0,
    avgLoadTime: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  constructor(config?: ModuleLoaderConfig) {
    this.config = {
      ...DEFAULT_LOADER_CONFIG,
      ...config,
    };

    // Start cache cleanup interval
    if (this.config.cacheEnabled) {
      setInterval(() => this.cleanupCache(), 60000); // Every minute
    }
  }

  /**
   * Register a module manifest
   */
  register(manifest: ModuleManifest): void {
    const entry: RegistryEntry = {
      manifest,
      state: "unloaded",
    };
    this.registry.set(manifest.id, entry);
    this.metrics.totalModules++;
  }

  /**
   * Load a module by ID
   */
  async load(
    moduleId: string,
    options?: ModuleLoadOptions
  ): Promise<LoadedModule> {
    const entry = this.registry.get(moduleId);
    if (!entry) {
      throw new Error(`Module not registered: ${moduleId}`);
    }

    // Check cache
    if (this.config.cacheEnabled) {
      const cached = this.cache.get(moduleId);
      if (
        cached &&
        Date.now() - cached.timestamp.getTime() < this.config.cacheTTL
      ) {
        cached.hits++;
        this.metrics.cacheHits++;
        return cached.module;
      }
      this.metrics.cacheMisses++;
    }

    // Check if already loading
    if (entry.loadPromise) {
      return entry.loadPromise;
    }

    // Check if already loaded
    if (entry.instance) {
      entry.lastUsed = new Date();
      entry.loadCount = (entry.loadCount || 0) + 1;
      return entry.instance;
    }

    // Load the module
    const opts = {
      timeout: this.config.defaultTimeout,
      retries: this.config.maxRetries,
      cache: true,
      version: (options?.version) || "latest",
      ...(options ?? {}),
    };

    entry.loadPromise = this.loadWithRetry(entry.manifest, opts);
    const module = await entry.loadPromise;
    entry.loadPromise = undefined;
    entry.instance = module;
    entry.lastUsed = new Date();
    entry.loadCount = 1;

    // Cache the result
    if (this.config.cacheEnabled && !module.error) {
      this.cache.set(moduleId, {
        module,
        timestamp: new Date(),
        hits: 1,
      });
    }

    // Update metrics
    this.metrics.loadedModules++;
    this.metrics.totalLoadTime += module.loadTime;
    this.metrics.avgLoadTime =
      this.metrics.totalLoadTime / this.metrics.loadedModules;

    return module;
  }

  /**
   * Load multiple modules in parallel
   */
  async loadMultiple(
    moduleIds: string[],
    options?: ModuleLoadOptions
  ): Promise<LoadedModule[]> {
    const promises = moduleIds.map(id => this.load(id, options));
    return Promise.all(promises);
  }

  /**
   * Preload modules (load in background)
   */
  async preload(moduleIds: string[]): Promise<void> {
    if (!this.config.enablePreload) {
      return;
    }

    // Load with low priority
    const promises = moduleIds.map(async id => {
      try {
        await this.load(id, { timeout: 30000 }); // Longer timeout for preload
      } catch (error) {
        console.warn(`Failed to preload module: ${id}`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Unload a module from cache
   */
  unload(moduleId: string): void {
    const entry = this.registry.get(moduleId);
    if (entry) {
      entry.instance = undefined;
      entry.loadPromise = undefined;
    }
    this.cache.delete(moduleId);
  }

  /**
   * Check if a module is loaded
   */
  isLoaded(moduleId: string): boolean {
    const entry = this.registry.get(moduleId);
    return entry?.instance !== undefined;
  }

  /**
   * Get module manifest
   */
  getManifest(moduleId: string): ModuleManifest | undefined {
    return this.registry.get(moduleId)?.manifest;
  }

  /**
   * Get all registered manifests
   */
  getAllManifests(): ModuleManifest[] {
    return Array.from(this.registry.values()).map(e => e.manifest);
  }

  /**
   * Get loading metrics
   */
  getMetrics(): LoadMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear the module cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Negotiate version with server
   */
  async negotiateVersion(
    moduleId: string,
    requestedVersion: string
  ): Promise<ModuleVersion | null> {
    if (!this.config.enableVersionNegotiation) {
      return null;
    }

    const entry = this.registry.get(moduleId);
    if (!entry) {
      return null;
    }

    // In a real implementation, this would query the server
    // For now, return the requested version if it satisfies constraints
    try {
      const requested = parseVersion(requestedVersion);
      const current = entry.manifest.version;

      if (satisfiesVersion(current, requestedVersion)) {
        return current;
      }

      return requested;
    } catch (error) {
      console.warn(`Version negotiation failed for ${moduleId}:`, error);
      return null;
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Load module with retry logic
   */
  private async loadWithRetry(
    manifest: ModuleManifest,
    options: Required<Omit<ModuleLoadOptions, "signal" | "strategy">> & {
      signal?: AbortSignal;
      strategy?: LoadStrategy;
    }
  ): Promise<LoadedModule> {
    const { timeout, retries, signal, version, strategy } = options;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this.loadModule(manifest, timeout, signal);
      } catch (error) {
        lastError = error as Error;
        if (attempt < retries) {
          // Exponential backoff
          await new Promise(resolve =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }

    return {
      id: manifest.id,
      manifest,
      exports: null,
      loadTime: timeout,
      error: lastError || new Error("Unknown load error"),
    };
  }

  /**
   * Load a single module
   */
  private async loadModule(
    manifest: ModuleManifest,
    timeout: number,
    signal?: AbortSignal
  ): Promise<LoadedModule> {
    const startTime = Date.now();

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Module load timeout")), timeout);
    });

    // Create abort promise
    let abortPromise: Promise<never> | undefined;
    if (signal) {
      abortPromise = new Promise<never>((_, reject) => {
        signal.addEventListener("abort", () =>
          reject(new Error("Load aborted"))
        );
      });
    }

    try {
      // Race between load, timeout, and abort
      const exports = await Promise.race([
        this.loadFromSource(manifest),
        timeoutPromise,
        ...(abortPromise ? [abortPromise] : []),
      ]);

      return {
        id: manifest.id,
        manifest,
        exports,
        loadTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        id: manifest.id,
        manifest,
        exports: null,
        loadTime: Date.now() - startTime,
        error: error as Error,
      };
    }
  }

  /**
   * Load module from its source
   */
  private async loadFromSource(manifest: ModuleManifest): Promise<unknown> {
    const { source } = manifest;

    switch (source.type) {
      case "local":
        return this.loadLocalModule(manifest);

      case "remote":
        return this.loadRemoteModule(manifest);

      case "cdn":
        return this.loadCDNModule(manifest);

      case "registry":
        return this.loadRegistryModule(manifest);

      default:
        throw new Error(
          `Unsupported source type: ${(source as { type: string }).type}`
        );
    }
  }

  /**
   * Load local module (already bundled)
   */
  private async loadLocalModule(manifest: ModuleManifest): Promise<unknown> {
    // For local modules, assume they're already available in the bundle
    // This would typically use dynamic import()
    const modulePath = manifest.source.url;
    try {
      const module = await import(/* @vite-ignore */ modulePath);
      return module.default || module;
    } catch (error) {
      throw new Error(`Failed to load local module ${manifest.id}: ${error}`);
    }
  }

  /**
   * Load remote module via Module Federation
   */
  private async loadRemoteModule(manifest: ModuleManifest): Promise<unknown> {
    const { url, scope, module } = manifest.source;

    // Initialize Module Federation container
    await this.initializeRemoteContainer(url, scope || "default");

    // Load module from container
    const container = (window as any)[scope || "default"];
    if (!container) {
      throw new Error(`Remote container not found: ${scope}`);
    }

    const factory = await container.get(module || manifest.name);
    return factory();
  }

  /**
   * Load module from CDN
   */
  private async loadCDNModule(manifest: ModuleManifest): Promise<unknown> {
    const url = manifest.source.url;

    // Check if already loaded
    if (document.querySelector(`script[src="${url}"]`)) {
      return (window as any)[manifest.name];
    }

    // Load script
    await this.loadScript(url);

    return (window as any)[manifest.name];
  }

  /**
   * Load module from registry
   */
  private async loadRegistryModule(manifest: ModuleManifest): Promise<unknown> {
    // Fetch manifest and module from registry
    const response = await fetch(manifest.source.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch from registry: ${response.statusText}`);
    }

    const moduleData = await response.json();
    return moduleData;
  }

  /**
   * Initialize Module Federation remote container
   */
  private async initializeRemoteContainer(
    url: string,
    scope: string
  ): Promise<void> {
    const scriptUrl = `${url}/remoteEntry.js`;

    // Check if already loaded
    if ((window as any)[scope]) {
      return;
    }

    // Load remote entry script
    await this.loadScript(scriptUrl);

    // Initialize container
    const container = (window as any)[scope];
    if (container && container.init) {
      // Check if webpack share scopes are available
      const webpackShareScopes = (globalThis as any).__webpack_share_scopes__;
      if (webpackShareScopes && webpackShareScopes.default) {
        await container.init(webpackShareScopes.default);
      } else {
        // Fallback for non-webpack environments
        await container.init({});
      }
    }
  }

  /**
   * Load a script tag dynamically
   */
  private loadScript(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
      document.head.appendChild(script);
    });
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [id, entry] of this.cache) {
      if (now - entry.timestamp.getTime() > this.config.cacheTTL) {
        this.cache.delete(id);
      }
    }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a module loader with default configuration
 */
export function createModuleLoader(config?: ModuleLoaderConfig): ModuleLoader {
  return new ModuleLoader(config);
}

/**
 * Create module manifest
 */
export function createManifest(
  id: string,
  name: string,
  version: string,
  source: ModuleSource,
  exports: string[],
  loadStrategy: LoadStrategy = "lazy"
): ModuleManifest {
  return {
    id,
    name,
    version: parseVersion(version),
    source,
    dependencies: [],
    peerDependencies: [],
    exports,
    loadStrategy,
    state: "unloaded",
  };
}

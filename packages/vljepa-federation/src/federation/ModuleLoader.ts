/**
 * ModuleLoader - Load modules with different strategies
 * Supports eager, lazy, prefetch, and priority loading
 */

import type {
  ModuleLoadResult,
  LoaderConfig,
  LoadingStrategy,
  ModuleInfo,
} from "../types.js";

export class ModuleLoader {
  private config: LoaderConfig;
  private cache: Map<string, ModuleLoadResult> = new Map();
  private preloadQueue: Set<string> = new Set();
  private loading: Map<string, Promise<ModuleLoadResult>> = new Map();

  constructor(config: Partial<LoaderConfig> = {}) {
    this.config = {
      strategy: config.strategy || "lazy",
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
      fallback: config.fallback || "",
    };
  }

  /**
   * Load a module with configured strategy
   */
  async loadModule(
    moduleFactory: () => Promise<any>,
    moduleInfo: Partial<ModuleInfo>
  ): Promise<ModuleLoadResult> {
    const moduleId = moduleInfo.id || moduleInfo.name || "unknown";

    // Check cache first
    const cached = this.cache.get(moduleId);
    if (cached) {
      return { ...cached, cached: true };
    }

    // Check if already loading
    const loadingPromise = this.loading.get(moduleId);
    if (loadingPromise) {
      return loadingPromise;
    }

    // Load based on strategy
    const loadPromise = this.loadWithStrategy(moduleFactory, moduleInfo);

    this.loading.set(moduleId, loadPromise);

    try {
      const result = await loadPromise;
      this.cache.set(moduleId, result);
      return result;
    } finally {
      this.loading.delete(moduleId);
    }
  }

  /**
   * Load module with configured strategy
   */
  private async loadWithStrategy(
    moduleFactory: () => Promise<any>,
    moduleInfo: Partial<ModuleInfo>
  ): Promise<ModuleLoadResult> {
    switch (this.config.strategy) {
      case "eager":
        return this.loadEager(moduleFactory, moduleInfo);
      case "lazy":
        return this.loadLazy(moduleFactory, moduleInfo);
      case "prefetch":
        return this.loadPrefetch(moduleFactory, moduleInfo);
      case "priority":
        return this.loadPriority(moduleFactory, moduleInfo);
      default:
        return this.loadLazy(moduleFactory, moduleInfo);
    }
  }

  /**
   * Load module eagerly (immediately)
   */
  private async loadEager(
    moduleFactory: () => Promise<any>,
    moduleInfo: Partial<ModuleInfo>
  ): Promise<ModuleLoadResult> {
    const startTime = Date.now();

    try {
      const module = await this.loadWithRetry(moduleFactory);

      return {
        module,
        version: moduleInfo.version || "unknown",
        loadTime: Date.now() - startTime,
        cached: false,
      };
    } catch (error) {
      if (this.config.fallback) {
        return this.loadFallback(moduleInfo);
      }
      throw error;
    }
  }

  /**
   * Load module lazily (on demand)
   */
  private async loadLazy(
    moduleFactory: () => Promise<any>,
    moduleInfo: Partial<ModuleInfo>
  ): Promise<ModuleLoadResult> {
    const startTime = Date.now();

    try {
      // Use requestIdleCallback if available for non-critical loading
      if (typeof requestIdleCallback !== "undefined") {
        return new Promise((resolve, reject) => {
          requestIdleCallback(
            async () => {
              try {
                const module = await this.loadWithRetry(moduleFactory);
                resolve({
                  module,
                  version: moduleInfo.version || "unknown",
                  loadTime: Date.now() - startTime,
                  cached: false,
                });
              } catch (error) {
                if (this.config.fallback) {
                  resolve(this.loadFallback(moduleInfo));
                } else {
                  reject(error);
                }
              }
            },
            { timeout: this.config.timeout }
          );
        });
      } else {
        // Fallback to immediate load
        return this.loadEager(moduleFactory, moduleInfo);
      }
    } catch (error) {
      if (this.config.fallback) {
        return this.loadFallback(moduleInfo);
      }
      throw error;
    }
  }

  /**
   * Prefetch module (load in background)
   */
  private async loadPrefetch(
    moduleFactory: () => Promise<any>,
    moduleInfo: Partial<ModuleInfo>
  ): Promise<ModuleLoadResult> {
    const startTime = Date.now();

    try {
      // Load in background without blocking
      const loadPromise = this.loadWithRetry(moduleFactory);

      // Don't await - let it load in background
      loadPromise.then(module => {
        this.cache.set(moduleInfo.id || moduleInfo.name || "unknown", {
          module,
          version: moduleInfo.version || "unknown",
          loadTime: Date.now() - startTime,
          cached: false,
        });
      });

      // Return immediately with pending status
      return {
        module: null,
        version: moduleInfo.version || "unknown",
        loadTime: 0,
        cached: false,
      };
    } catch (error) {
      // Silently fail for prefetch
      return {
        module: null,
        version: moduleInfo.version || "unknown",
        loadTime: 0,
        cached: false,
      };
    }
  }

  /**
   * Load module with priority (skip queue)
   */
  private async loadPriority(
    moduleFactory: () => Promise<any>,
    moduleInfo: Partial<ModuleInfo>
  ): Promise<ModuleLoadResult> {
    const startTime = Date.now();

    try {
      // Priority loading: use immediate load with higher timeout
      const originalTimeout = this.config.timeout;
      this.config.timeout *= 2;

      const module = await this.loadWithRetry(moduleFactory);

      this.config.timeout = originalTimeout;

      return {
        module,
        version: moduleInfo.version || "unknown",
        loadTime: Date.now() - startTime,
        cached: false,
      };
    } catch (error) {
      if (this.config.fallback) {
        return this.loadFallback(moduleInfo);
      }
      throw error;
    }
  }

  /**
   * Load with retry logic
   */
  private async loadWithRetry(
    moduleFactory: () => Promise<any>,
    attempt: number = 0
  ): Promise<any> {
    try {
      return await Promise.race([
        moduleFactory(),
        this.timeoutPromise(this.config.timeout),
      ]);
    } catch (error) {
      if (attempt < this.config.retries) {
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await this.delay(delay);
        return this.loadWithRetry(moduleFactory, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Load fallback module
   */
  private async loadFallback(
    moduleInfo: Partial<ModuleInfo>
  ): Promise<ModuleLoadResult> {
    // Return a placeholder or fallback module
    return {
      module: this.createFallbackModule(moduleInfo),
      version: "fallback",
      loadTime: 0,
      cached: false,
    };
  }

  /**
   * Create fallback module
   */
  private createFallbackModule(moduleInfo: Partial<ModuleInfo>): any {
    return {
      __fallback: true,
      __module: moduleInfo.name || "unknown",
      render: () => null, // React fallback
    };
  }

  /**
   * Timeout promise
   */
  private timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Module load timeout")), ms);
    });
  }

  /**
   * Preload multiple modules
   */
  async preloadModules(
    factories: Array<{
      factory: () => Promise<any>;
      info: Partial<ModuleInfo>;
    }>
  ): Promise<Map<string, ModuleLoadResult>> {
    const results = new Map<string, string>();

    // Mark modules for preload
    for (const { info } of factories) {
      const moduleId = info.id || info.name || "unknown";
      this.preloadQueue.add(moduleId);
      results.set(moduleId, moduleId);
    }

    // Load modules in parallel
    await Promise.allSettled(
      factories.map(({ factory, info }) => this.loadModule(factory, info))
    );

    // Return loaded results
    const loadedResults = new Map<string, ModuleLoadResult>();
    for (const moduleId of results.keys()) {
      const result = this.cache.get(moduleId);
      if (result) {
        loadedResults.set(moduleId, result);
      }
    }

    return loadedResults;
  }

  /**
   * Check if module is cached
   */
  isCached(moduleId: string): boolean {
    return this.cache.has(moduleId);
  }

  /**
   * Get cached module
   */
  getCached(moduleId: string): ModuleLoadResult | undefined {
    return this.cache.get(moduleId);
  }

  /**
   * Clear cache
   */
  clearCache(moduleId?: string): void {
    if (moduleId) {
      this.cache.delete(moduleId);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Set loading strategy
   */
  setStrategy(strategy: LoadingStrategy): void {
    this.config.strategy = strategy;
  }

  /**
   * Get current strategy
   */
  getStrategy(): LoadingStrategy {
    return this.config.strategy;
  }

  /**
   * Set timeout
   */
  setTimeout(timeout: number): void {
    this.config.timeout = timeout;
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Get preload queue size
   */
  getPreloadQueueSize(): number {
    return this.preloadQueue.size;
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset loader
   */
  reset(): void {
    this.cache.clear();
    this.preloadQueue.clear();
    this.loading.clear();
  }
}

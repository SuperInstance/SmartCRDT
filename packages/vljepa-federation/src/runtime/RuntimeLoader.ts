/**
 * RuntimeLoader - Load modules at runtime
 * Dynamic module loading with error handling and retries
 */

import type {
  ModuleInfo,
  ModuleLoadResult,
  RuntimeConfig,
  ModuleFactory,
} from "../types.js";

export class RuntimeLoader {
  private config: RuntimeConfig;
  private factories: Map<string, ModuleFactory> = new Map();
  private loading: Map<string, Promise<any>> = new Map();
  private loadErrors: Map<string, Error[]> = new Map();

  constructor(config: Partial<RuntimeConfig> = {}) {
    this.config = {
      cacheSize: config.cacheSize || 50,
      preloadModules: config.preloadModules || [],
      maxRetries: config.maxRetries || 3,
      timeout: config.timeout || 30000,
    };
  }

  /**
   * Load a module at runtime
   */
  async load(
    id: string,
    factory: ModuleFactory,
    info: Partial<ModuleInfo> = {}
  ): Promise<ModuleLoadResult> {
    // Check if already loading
    const loadingPromise = this.loading.get(id);
    if (loadingPromise) {
      return loadingPromise;
    }

    const startTime = Date.now();

    const loadPromise = this.loadWithRetry(id, factory, info);
    this.loading.set(id, loadPromise);

    try {
      const result = await loadPromise;
      return {
        ...result,
        loadTime: Date.now() - startTime,
      };
    } finally {
      this.loading.delete(id);
    }
  }

  /**
   * Load with retry logic
   */
  private async loadWithRetry(
    id: string,
    factory: ModuleFactory,
    info: Partial<ModuleInfo>,
    attempt: number = 0
  ): Promise<ModuleLoadResult> {
    try {
      const module = await Promise.race([
        factory(),
        this.timeoutPromise(this.config.timeout),
      ]);

      // Clear errors on success
      this.loadErrors.delete(id);

      return {
        module,
        version: info.version || "unknown",
        loadTime: 0,
        cached: false,
      };
    } catch (error) {
      // Track error
      if (!this.loadErrors.has(id)) {
        this.loadErrors.set(id, []);
      }
      this.loadErrors.get(id)!.push(error as Error);

      // Retry if allowed
      if (attempt < this.config.maxRetries) {
        const delay = this.calculateBackoff(attempt);
        await this.delay(delay);
        return this.loadWithRetry(id, factory, info, attempt + 1);
      }

      throw new Error(
        `Failed to load module ${id} after ${attempt + 1} attempts: ${error}`
      );
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt), 10000);
  }

  /**
   * Timeout promise
   */
  private timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Load timeout")), ms);
    });
  }

  /**
   * Register a module factory
   */
  registerFactory(id: string, factory: ModuleFactory): void {
    this.factories.set(id, factory);
  }

  /**
   * Unregister a factory
   */
  unregisterFactory(id: string): void {
    this.factories.delete(id);
  }

  /**
   * Load using registered factory
   */
  async loadRegistered(
    id: string,
    info?: Partial<ModuleInfo>
  ): Promise<ModuleLoadResult> {
    const factory = this.factories.get(id);
    if (!factory) {
      throw new Error(`No factory registered for module: ${id}`);
    }
    return this.load(id, factory, info);
  }

  /**
   * Preload modules
   */
  async preload(
    factories: Map<string, ModuleFactory>,
    infos?: Map<string, Partial<ModuleInfo>>
  ): Promise<Map<string, ModuleLoadResult>> {
    const results = new Map<string, ModuleLoadResult>();

    const promises = Array.from(factories.entries()).map(
      async ([id, factory]) => {
        try {
          const info = infos?.get(id);
          const result = await this.load(id, factory, info);
          results.set(id, result);
        } catch (error) {
          console.warn(`Failed to preload module ${id}:`, error);
        }
      }
    );

    await Promise.allSettled(promises);

    return results;
  }

  /**
   * Batch load modules
   */
  async batchLoad(
    requests: Array<{
      id: string;
      factory: ModuleFactory;
      info?: Partial<ModuleInfo>;
    }>
  ): Promise<Map<string, ModuleLoadResult>> {
    const results = new Map<string, ModuleLoadResult>();

    await Promise.all(
      requests.map(async ({ id, factory, info }) => {
        try {
          const result = await this.load(id, factory, info);
          results.set(id, result);
        } catch (error) {
          console.warn(`Failed to load module ${id}:`, error);
        }
      })
    );

    return results;
  }

  /**
   * Check if module is loading
   */
  isLoading(id: string): boolean {
    return this.loading.has(id);
  }

  /**
   * Get loading modules
   */
  getLoadingModules(): string[] {
    return Array.from(this.loading.keys());
  }

  /**
   * Get load errors for a module
   */
  getLoadErrors(id: string): Error[] {
    return this.loadErrors.get(id) || [];
  }

  /**
   * Get all load errors
   */
  getAllLoadErrors(): Map<string, Error[]> {
    return new Map(this.loadErrors);
  }

  /**
   * Clear errors for a module
   */
  clearErrors(id: string): void {
    this.loadErrors.delete(id);
  }

  /**
   * Clear all errors
   */
  clearAllErrors(): void {
    this.loadErrors.clear();
  }

  /**
   * Get config
   */
  getConfig(): RuntimeConfig {
    return { ...this.config };
  }

  /**
   * Update config
   */
  updateConfig(config: Partial<RuntimeConfig>): void {
    this.config = { ...this.config, ...config };
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
    this.loading.clear();
    this.loadErrors.clear();
  }
}

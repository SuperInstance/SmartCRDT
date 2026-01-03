/**
 * FallbackProvider - Provide fallback modules on load failure
 * Graceful degradation when modules fail to load
 */

import type { FallbackConfig, ModuleInfo } from "../types.js";

export class FallbackProvider {
  private fallbacks: Map<string, FallbackModule> = new Map();
  private globalFallback?: FallbackModule;

  /**
   * Register fallback for a module
   */
  register(moduleId: string, fallback: FallbackModule): void {
    this.fallbacks.set(moduleId, fallback);
  }

  /**
   * Set global fallback
   */
  setGlobalFallback(fallback: FallbackModule): void {
    this.globalFallback = fallback;
  }

  /**
   * Get fallback for a module
   */
  get(moduleId: string): FallbackModule | undefined {
    return this.fallbacks.get(moduleId) || this.globalFallback;
  }

  /**
   * Get fallback with default
   */
  getWithDefault(
    moduleId: string,
    defaultFallback?: FallbackModule
  ): FallbackModule {
    return (
      this.get(moduleId) ||
      defaultFallback ||
      this.createDefaultFallback(moduleId)
    );
  }

  /**
   * Create default fallback module
   */
  private createDefaultFallback(moduleId: string): FallbackModule {
    return {
      module: {
        render: () => null,
        init: async () => {},
        destroy: () => {},
      },
      placeholder: true,
      message: `Module ${moduleId} failed to load`,
    };
  }

  /**
   * Create error fallback
   */
  createErrorFallback(moduleId: string, error: Error): FallbackModule {
    return {
      module: {
        render: () => {
          const div = document.createElement("div");
          div.className = "module-error";
          div.textContent = `Failed to load ${moduleId}: ${error.message}`;
          return div;
        },
        init: async () => {},
        destroy: () => {},
      },
      placeholder: true,
      message: error.message,
      error,
    };
  }

  /**
   * Create loading fallback
   */
  createLoadingFallback(moduleId: string): FallbackModule {
    return {
      module: {
        render: () => {
          const div = document.createElement("div");
          div.className = "module-loading";
          div.textContent = `Loading ${moduleId}...`;
          return div;
        },
        init: async () => {},
        destroy: () => {},
      },
      placeholder: true,
      message: `Loading ${moduleId}`,
    };
  }

  /**
   * Wrap module load with fallback
   */
  async withFallback<T>(
    moduleId: string,
    loader: () => Promise<T>,
    config?: FallbackConfig
  ): Promise<T | any> {
    try {
      return await loader();
    } catch (error) {
      if (config?.gracefulDegradation) {
        const fallback = this.getWithDefault(
          moduleId,
          config.fallbackUrl
            ? this.createURLFallback(config.fallbackUrl)
            : undefined
        );

        console.warn(`Module ${moduleId} failed, using fallback:`, error);

        if (fallback.module) {
          return fallback.module;
        }

        throw error;
      }

      throw error;
    }
  }

  /**
   * Create URL-based fallback
   */
  private createURLFallback(url: string): FallbackModule {
    return {
      module: null,
      placeholder: true,
      message: `Attempting fallback load from ${url}`,
      fallbackUrl: url,
    };
  }

  /**
   * Check if fallback is available
   */
  hasFallback(moduleId: string): boolean {
    return this.fallbacks.has(moduleId) || this.globalFallback !== undefined;
  }

  /**
   * Unregister fallback
   */
  unregister(moduleId: string): boolean {
    return this.fallbacks.delete(moduleId);
  }

  /**
   * Clear all fallbacks
   */
  clear(): void {
    this.fallbacks.clear();
    this.globalFallback = undefined;
  }

  /**
   * Get all fallback module IDs
   */
  getFallbackIds(): string[] {
    return Array.from(this.fallbacks.keys());
  }

  /**
   * Create retry mechanism with fallback
   */
  async withRetryAndFallback<T>(
    moduleId: string,
    loader: () => Promise<T>,
    maxRetries: number = 3,
    config?: FallbackConfig
  ): Promise<T | any> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await loader();
      } catch (error) {
        lastError = error as Error;
        console.warn(`Attempt ${attempt + 1} failed for ${moduleId}:`, error);

        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          await this.delay(delay);
        }
      }
    }

    // All retries failed, use fallback
    if (config?.gracefulDegradation) {
      const fallback = this.getWithDefault(moduleId);
      console.warn(`All retries failed for ${moduleId}, using fallback`);

      if (fallback.module) {
        return fallback.module;
      }
    }

    throw lastError || new Error(`Module ${moduleId} failed to load`);
  }

  /**
   * Create circuit breaker pattern
   */
  createCircuitBreaker(
    moduleId: string,
    threshold: number = 5,
    timeout: number = 60000
  ): {
    execute: (loader: () => Promise<any>) => Promise<any>;
    isOpen: () => boolean;
    reset: () => void;
  } {
    let failures = 0;
    let lastFailureTime = 0;
    let open = false;

    return {
      execute: async (loader: () => Promise<any>) => {
        if (open && Date.now() - lastFailureTime < timeout) {
          // Circuit is open, use fallback
          const fallback = this.getWithDefault(moduleId);
          return fallback.module;
        }

        // Reset circuit breaker if timeout passed
        if (open && Date.now() - lastFailureTime >= timeout) {
          open = false;
          failures = 0;
        }

        try {
          const result = await loader();
          failures = 0;
          return result;
        } catch (error) {
          failures++;
          lastFailureTime = Date.now();

          if (failures >= threshold) {
            open = true;
            console.warn(`Circuit breaker opened for ${moduleId}`);
          }

          const fallback = this.getWithDefault(moduleId);
          if (fallback.module) {
            return fallback.module;
          }

          throw error;
        }
      },

      isOpen: () => open,

      reset: () => {
        failures = 0;
        open = false;
      },
    };
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create progressive fallback chain
   */
  createFallbackChain(
    ...fallbacks: Array<(error: Error) => FallbackModule | null>
  ): {
    get: (error: Error) => FallbackModule | null;
  } {
    return {
      get: (error: Error) => {
        for (const factory of fallbacks) {
          const fallback = factory(error);
          if (fallback) {
            return fallback;
          }
        }
        return null;
      },
    };
  }
}

/**
 * Fallback module
 */
export interface FallbackModule {
  module: any;
  placeholder?: boolean;
  message?: string;
  error?: Error;
  fallbackUrl?: string;
}

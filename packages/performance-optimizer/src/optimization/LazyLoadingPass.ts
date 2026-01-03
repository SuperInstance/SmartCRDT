/**
 * Lazy Loading Pass - Dynamic imports and code splitting optimization
 *
 * Features:
 * - Dynamic import utilities
 * - Code splitting helpers
 * - Lazy loading decorators
 * - Prefetching and preloading
 * - Loading state management
 */

import { performance } from 'perf_hooks';

/**
 * Loading state
 */
export type LoadingState = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * Lazy load result
 */
export interface LazyLoadResult<T> {
  data: T;
  loadingTime: number;
  cached: boolean;
}

/**
 * Lazy module options
 */
export interface LazyModuleOptions<T> {
  importer: () => Promise<T>;
  prefetch?: boolean;
  preload?: boolean;
  timeout?: number;
  retries?: number;
  onLoadingStart?: () => void;
  onLoadingSuccess?: (data: T) => void;
  onLoadingError?: (error: Error) => void;
}

/**
 * Lazy module state
 */
export interface LazyModuleState<T> {
  state: LoadingState;
  data?: T;
  error?: Error;
  loadTime?: number;
  timestamp?: number;
}

/**
 * Lazy module loader
 */
export class LazyModule<T> {
  private options: LazyModuleOptions<T>;
  private state: LazyModuleState<T> = {
    state: 'idle',
  };
  private loadPromise?: Promise<T>;

  constructor(options: LazyModuleOptions<T>) {
    this.options = options;

    if (options.preload) {
      this.load();
    }

    if (options.prefetch) {
      this.prefetch();
    }
  }

  /**
   * Load the module
   */
  async load(): Promise<T> {
    // Return cached data if already loaded
    if (this.state.state === 'loaded' && this.state.data) {
      return this.state.data;
    }

    // Return existing promise if loading
    if (this.loadPromise) {
      return this.loadPromise;
    }

    // Start loading
    this.state.state = 'loading';
    this.options.onLoadingStart?.();

    const startTime = performance.now();

    this.loadPromise = this.executeLoad();

    try {
      const data = await this.loadPromise;
      const loadTime = performance.now() - startTime;

      this.state = {
        state: 'loaded',
        data,
        loadTime,
        timestamp: Date.now(),
      };

      this.options.onLoadingSuccess?.(data);
      return data;
    } catch (error) {
      this.state = {
        state: 'error',
        error: error as Error,
      };
      this.options.onLoadingError?.(error as Error);
      throw error;
    } finally {
      this.loadPromise = undefined;
    }
  }

  /**
   * Execute load with retries
   */
  private async executeLoad(): Promise<T> {
    const maxRetries = this.options.retries ?? 0;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (this.options.timeout) {
          return await this.withTimeout(this.options.importer(), this.options.timeout);
        } else {
          return await this.options.importer();
        }
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError;
  }

  /**
   * Add timeout to promise
   */
  private async withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Load timeout after ${timeout}ms`)), timeout)
      ),
    ]);
  }

  /**
   * Prefetch the module (load in background)
   */
  async prefetch(): Promise<void> {
    if (this.state.state === 'idle') {
      this.load().catch(() => {
        // Ignore errors during prefetch
      });
    }
  }

  /**
   * Get current state
   */
  getState(): LazyModuleState<T> {
    return { ...this.state };
  }

  /**
   * Check if loaded
   */
  isLoaded(): boolean {
    return this.state.state === 'loaded';
  }

  /**
   * Get data if loaded
   */
  getData(): T | undefined {
    return this.state.data;
  }

  /**
   * Reset the module (force reload next time)
   */
  reset(): void {
    this.state = {
      state: 'idle',
    };
    this.loadPromise = undefined;
  }
}

/**
 * Create lazy module
 */
export function createLazyModule<T>(options: LazyModuleOptions<T>): LazyModule<T> {
  return new LazyModule<T>(options);
}

/**
 * Lazy loading decorator for class properties
 */
export function Lazy<T>(
  importer: () => Promise<T>,
  options?: Partial<LazyModuleOptions<T>>
): PropertyDecorator {
  return function (target: any, propertyKey: string | symbol) {
    let lazyModule: LazyModule<T> | undefined;

    const getter = function () {
      if (!lazyModule) {
        lazyModule = new LazyModule<T>({
          importer,
          ...options,
        });
      }
      return lazyModule;
    };

    Object.defineProperty(target, propertyKey, {
      get: getter,
      set: undefined,
      enumerable: true,
      configurable: true,
    });
  };
}

/**
 * Code splitting utility
 */
export class CodeSplitter {
  private chunks: Map<string, LazyModule<any>> = new Map();
  private loadingStrategy: 'eager' | 'lazy' | 'preload' = 'lazy';

  constructor(strategy: 'eager' | 'lazy' | 'preload' = 'lazy') {
    this.loadingStrategy = strategy;
  }

  /**
   * Register a chunk
   */
  registerChunk<T>(
    name: string,
    importer: () => Promise<T>,
    options?: Partial<LazyModuleOptions<T>>
  ): LazyModule<T> {
    const lazyModule = new LazyModule<T>({
      importer,
      preload: this.loadingStrategy === 'eager' || this.loadingStrategy === 'preload',
      prefetch: this.loadingStrategy === 'preload',
      ...options,
    });

    this.chunks.set(name, lazyModule);
    return lazyModule;
  }

  /**
   * Load a chunk
   */
  async loadChunk<T>(name: string): Promise<T> {
    const chunk = this.chunks.get(name) as LazyModule<T> | undefined;
    if (!chunk) {
      throw new Error(`Chunk '${name}' not found`);
    }
    return chunk.load();
  }

  /**
   * Prefetch a chunk
   */
  prefetchChunk(name: string): void {
    const chunk = this.chunks.get(name);
    if (chunk) {
      chunk.prefetch();
    }
  }

  /**
   * Prefetch all chunks
   */
  prefetchAll(): void {
    for (const chunk of this.chunks.values()) {
      chunk.prefetch();
    }
  }

  /**
   * Get chunk state
   */
  getChunkState(name: string): LazyModuleState<any> | undefined {
    const chunk = this.chunks.get(name);
    return chunk?.getState();
  }

  /**
   * Get all chunk states
   */
  getAllChunkStates(): Map<string, LazyModuleState<any>> {
    const states = new Map<string, LazyModuleState<any>>();
    for (const [name, chunk] of this.chunks.entries()) {
      states.set(name, chunk.getState());
    }
    return states;
  }

  /**
   * Reset a chunk
   */
  resetChunk(name: string): void {
    const chunk = this.chunks.get(name);
    if (chunk) {
      chunk.reset();
    }
  }

  /**
   * Clear all chunks
   */
  clear(): void {
    this.chunks.clear();
  }
}

/**
 * Dynamic import wrapper with timing
 */
export async function dynamicImport<T>(
  importer: () => Promise<T>,
  timeout?: number
  ): Promise<LazyLoadResult<T>> {
  const startTime = performance.now();

  const promise = importer();
  const data = timeout
    ? Promise.race([
        promise,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(`Import timeout after ${timeout}ms`)), timeout)
        ),
      ])
    : promise;

  const result = await data;
  const loadingTime = performance.now() - startTime;

  return {
    data: result,
    loadingTime,
    cached: false,
  };
}

/**
 * Batch dynamic import
 */
export async function batchDynamicImport<T>(
  importers: Array<() => Promise<T>>,
  timeout?: number
): Promise<LazyLoadResult<T>[]> {
  const startTime = performance.now();

  const promises = importers.map((importer) =>
    timeout
      ? Promise.race([
          importer(),
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`Import timeout after ${timeout}ms`)), timeout)
          ),
        ])
      : importer()
  );

  const results = await Promise.all(promises);
  const loadingTime = performance.now() - startTime;

  return results.map((data) => ({
    data,
    loadingTime,
    cached: false,
  }));
}

/**
 * Lazy loading pass optimizer
 */
export class LazyLoadingPass {
  private static codeSplitters: Map<string, CodeSplitter> = new Map();

  /**
   * Create or get a code splitter
   */
  static getCodeSplitter(name: string, strategy?: 'eager' | 'lazy' | 'preload'): CodeSplitter {
    if (!this.codeSplitters.has(name)) {
      this.codeSplitters.set(name, new CodeSplitter(strategy));
    }
    return this.codeSplitters.get(name)!;
  }

  /**
   * Get all code splitter states
   */
  static getAllStates(): Map<string, Map<string, LazyModuleState<any>>> {
    const states = new Map<string, Map<string, LazyModuleState<any>>>();
    for (const [name, splitter] of this.codeSplitters.entries()) {
      states.set(name, splitter.getAllChunkStates());
    }
    return states;
  }

  /**
   * Generate loading report
   */
  static generateLoadingReport(): string {
    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push('LAZY LOADING REPORT');
    lines.push('='.repeat(80));
    lines.push('');

    for (const [splitterName, splitter] of this.codeSplitters.entries()) {
      const states = splitter.getAllChunkStates();

      lines.push(`Code Splitter: ${splitterName}`);
      lines.push(`  Total Chunks: ${states.size}`);

      let loaded = 0;
      let loading = 0;
      let errors = 0;
      let totalLoadTime = 0;

      for (const [chunkName, state] of states.entries()) {
        lines.push(`  Chunk: ${chunkName}`);
        lines.push(`    State: ${state.state}`);
        if (state.loadTime) {
          lines.push(`    Load Time: ${state.loadTime.toFixed(2)}ms`);
          totalLoadTime += state.loadTime;
        }

        if (state.state === 'loaded') loaded++;
        else if (state.state === 'loading') loading++;
        else if (state.state === 'error') errors++;
      }

      lines.push(`  Summary:`);
      lines.push(`    Loaded: ${loaded}`);
      lines.push(`    Loading: ${loading}`);
      lines.push(`    Errors: ${errors}`);
      lines.push(`    Total Load Time: ${totalLoadTime.toFixed(2)}ms`);
      lines.push('');
    }

    lines.push('='.repeat(80));

    return lines.join('\n');
  }
}

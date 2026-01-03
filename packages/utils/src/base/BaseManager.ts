/**
 * BaseManager - Abstract base class for all manager classes
 *
 * Provides common lifecycle, configuration, statistics, and state management
 * to eliminate code duplication across 48+ manager classes in the codebase.
 *
 * @example
 * ```typescript
 * interface MyConfig {
 *   timeout: number;
 *   maxRetries: number;
 * }
 *
 * interface MyStats {
 *   requestsProcessed: number;
 *   averageLatency: number;
 * }
 *
 * interface MyState {
 *   isActive: boolean;
 *   currentMode: string;
 * }
 *
 * class MyManager extends BaseManager<MyConfig, MyStats, MyState> {
 *   protected getDefaultConfig(): MyConfig {
 *     return { timeout: 30000, maxRetries: 3 };
 *   }
 *
 *   protected initializeStats(): MyStats {
 *     return { requestsProcessed: 0, averageLatency: 0 };
 *   }
 *
 *   protected initializeState(): MyState {
 *     return { isActive: false, currentMode: 'idle' };
 *   }
 *
 *   async initialize(): Promise<void> {
 *     this.state.isActive = true;
 *     this.initialized = true;
 *   }
 *
 *   async dispose(): Promise<void> {
 *     this.state.isActive = false;
 *     this.disposed = true;
 *   }
 * }
 * ```
 */

import type { ConfigValidator } from "../config/ConfigBuilder.js";

// Simple EventEmitter implementation for portability
class EventEmitter {
  private events: Map<string | symbol, Set<Function>> = new Map();

  on(event: string | symbol, listener: Function): this {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(listener);
    return this;
  }

  off(event: string | symbol, listener: Function): this {
    const listeners = this.events.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
    return this;
  }

  once(event: string | symbol, listener: Function): this {
    const onceWrapper = (...args: unknown[]) => {
      this.off(event, onceWrapper);
      listener(...args);
    };
    return this.on(event, onceWrapper);
  }

  emit(event: string | symbol, ...args: unknown[]): boolean {
    const listeners = this.events.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(...args);
        } catch {
          // Ignore errors in listeners
        }
      }
      return true;
    }
    return false;
  }

  removeAllListeners(event?: string | symbol): this {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
    return this;
  }
}

/**
 * Base manager options
 */
export interface BaseManagerOptions {
  /** Enable debug logging */
  debug?: boolean;
  /** Custom logger instance */
  logger?: Console;
  /** Enable lifecycle events */
  enableEvents?: boolean;
}

/**
 * Lifecycle event types
 */
export type LifecycleEvent =
  | { type: "initialized"; timestamp: number }
  | { type: "started"; timestamp: number }
  | { type: "stopped"; timestamp: number }
  | { type: "disposed"; timestamp: number }
  | { type: "config_updated"; timestamp: number; updates: unknown }
  | { type: "error"; timestamp: number; error: Error };

/**
 * Abstract base class for all manager classes
 */
export abstract class BaseManager<
  TConfig extends Record<string, unknown>,
  TStats extends Record<string, number | string | boolean>,
  TState extends Record<string, unknown>,
> {
  protected config: TConfig;
  protected stats: TStats;
  protected state: TState;
  protected initialized: boolean = false;
  protected disposed: boolean = false;
  protected logger: Console;
  protected eventEmitter: EventEmitter;
  protected enableEvents: boolean;

  constructor(
    protected defaultConfig: TConfig,
    config?: Partial<TConfig>,
    options?: BaseManagerOptions
  ) {
    this.config = this.mergeWithDefaults(config);
    this.stats = this.initializeStats();
    this.state = this.initializeState();

    const opts = { debug: false, enableEvents: true, ...options };
    this.logger =
      opts.logger ??
      (opts.debug ? console : { ...console, log: () => {}, debug: () => {} });
    this.enableEvents = opts.enableEvents ?? true;
    this.eventEmitter = new EventEmitter();
  }

  /**
   * Initialize the manager (must be called after construction)
   */
  abstract initialize(): Promise<void>;

  /**
   * Dispose of resources and cleanup
   */
  abstract dispose(): Promise<void>;

  /**
   * Start the manager
   */
  async start(): Promise<void> {
    if (this.initialized && !this.disposed) {
      this.emit({ type: "started", timestamp: Date.now() });
      return;
    }
    throw new Error("Manager must be initialized before starting");
  }

  /**
   * Stop the manager
   */
  async stop(): Promise<void> {
    if (!this.disposed) {
      this.emit({ type: "stopped", timestamp: Date.now() });
    }
  }

  /**
   * Get current configuration (read-only copy)
   */
  getConfig(): Readonly<TConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<TConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...updates };
    this.emit({ type: "config_updated", timestamp: Date.now(), updates });
    this.logger.debug("Config updated:", {
      old: oldConfig,
      new: this.config,
      updates,
    });
  }

  /**
   * Validate current configuration
   */
  validateConfig(validator: ConfigValidator<TConfig>): boolean {
    try {
      return validator(this.config);
    } catch (error) {
      this.emit({
        type: "error",
        timestamp: Date.now(),
        error: error as Error,
      });
      return false;
    }
  }

  /**
   * Get current statistics (read-only copy)
   */
  getStats(): Readonly<TStats> {
    return { ...this.stats };
  }

  /**
   * Reset statistics to initial values
   */
  resetStats(): void {
    this.stats = this.initializeStats();
    this.logger.debug("Statistics reset");
  }

  /**
   * Get current state (read-only copy)
   */
  getState(): Readonly<TState> {
    return { ...this.state };
  }

  /**
   * Check if manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if manager is disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Register event listener
   */
  on(event: string, listener: (...args: unknown[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  /**
   * Unregister event listener
   */
  off(event: string, listener: (...args: unknown[]) => void): void {
    this.eventEmitter.off(event, listener);
  }

  /**
   * Register one-time event listener
   */
  once(event: string, listener: (...args: unknown[]) => void): void {
    this.eventEmitter.once(event, listener);
  }

  /**
   * Get default configuration (must be implemented by subclass)
   */
  protected abstract getDefaultConfig(): TConfig;

  /**
   * Initialize statistics (must be implemented by subclass)
   */
  protected abstract initializeStats(): TStats;

  /**
   * Initialize state (must be implemented by subclass)
   */
  protected abstract initializeState(): TState;

  /**
   * Merge user config with defaults (deep merge for nested objects)
   */
  protected mergeWithDefaults(config?: Partial<TConfig>): TConfig {
    const defaults = this.getDefaultConfig();
    if (!config) {
      return { ...defaults };
    }

    // Deep merge for nested objects
    return this.deepMerge(defaults, config);
  }

  /**
   * Deep merge two objects
   */
  protected deepMerge<T>(target: T, source: Partial<T>): T {
    const result = { ...target } as T;

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const sourceValue = source[key];
        const targetValue = (result as Record<string, unknown>)[key];

        if (
          sourceValue &&
          typeof sourceValue === "object" &&
          !Array.isArray(sourceValue) &&
          targetValue &&
          typeof targetValue === "object" &&
          !Array.isArray(targetValue)
        ) {
          (result as Record<string, unknown>)[key] = this.deepMerge(
            targetValue as Record<string, unknown>,
            sourceValue as Partial<Record<string, unknown>>
          );
        } else {
          (result as Record<string, unknown>)[key] = sourceValue;
        }
      }
    }

    return result;
  }

  /**
   * Emit lifecycle event
   */
  protected emit(event: LifecycleEvent): void {
    if (this.enableEvents) {
      this.eventEmitter.emit(event.type, event);
    }
  }

  /**
   * Emit custom event
   */
  protected emitCustom(event: string, data: unknown): void {
    if (this.enableEvents) {
      this.eventEmitter.emit(event, data);
    }
  }

  /**
   * Parse environment variable (internal helper)
   */
  protected static parseEnvValue(value: string): unknown {
    // Try parsing as JSON first
    if (
      (value.startsWith("{") && value.endsWith("}")) ||
      (value.startsWith("[") && value.endsWith("]"))
    ) {
      try {
        return JSON.parse(value);
      } catch {
        // Not valid JSON, return as string
      }
    }

    // Try parsing as number
    if (/^-?\d+\.?\d*$/.test(value)) {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        return num;
      }
    }

    // Try parsing as boolean
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;

    // Return as string
    return value;
  }

  /**
   * Log error with event emission
   */
  protected handleError(error: Error, context?: string): void {
    this.logger.error(`Error${context ? ` in ${context}` : ""}:`, error);
    this.emit({ type: "error", timestamp: Date.now(), error });
  }

  /**
   * Increment a counter stat
   */
  protected incrementStat<K extends keyof TStats>(key: K, value = 1): void {
    const current = this.stats[key];
    if (typeof current === "number") {
      (this.stats[key] as unknown) = current + value;
    }
  }

  /**
   * Update a stat value
   */
  protected updateStat<K extends keyof TStats>(key: K, value: TStats[K]): void {
    this.stats[key] = value;
  }

  /**
   * Create a snapshot of current state
   */
  createSnapshot(): {
    config: TConfig;
    stats: TStats;
    state: TState;
    timestamp: number;
  } {
    return {
      config: { ...this.config },
      stats: { ...this.stats },
      state: { ...this.state },
      timestamp: Date.now(),
    };
  }

  /**
   * Restore from snapshot
   */
  restoreSnapshot(snapshot: {
    config: TConfig;
    stats: TStats;
    state: TState;
  }): void {
    this.config = { ...snapshot.config };
    this.stats = { ...snapshot.stats };
    this.state = { ...snapshot.state } as TState;
  }
}

/**
 * Convenience function to create a manager instance
 */
export function createManager<T extends BaseManager<any, any, any>>(
  ManagerClass: new (...args: unknown[]) => T,
  ...args: unknown[]
): T {
  return new ManagerClass(...args);
}

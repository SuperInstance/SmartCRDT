/**
 * @lsi/langgraph-state - State Middleware
 *
 * Pre/post state change hooks, state transformation, logging, and analytics.
 */

import type {
  StateMiddleware,
  StateMiddlewareContext,
  StateEvent,
  StateEventPayload,
} from "./types.js";

/**
 * Middleware manager
 */
export class StateMiddlewareManager {
  private preMiddleware: StateMiddleware[];
  private postMiddleware: StateMiddleware[];
  private middleware: StateMiddleware[];

  constructor() {
    this.preMiddleware = [];
    this.postMiddleware = [];
    this.middleware = [];
  }

  /**
   * Add pre-state change middleware
   */
  public usePre(middleware: StateMiddleware): void {
    this.preMiddleware.push(middleware);
  }

  /**
   * Add post-state change middleware
   */
  public usePost(middleware: StateMiddleware): void {
    this.postMiddleware.push(middleware);
  }

  /**
   * Add general middleware (executes in both phases)
   */
  public use(middleware: StateMiddleware): void {
    this.middleware.push(middleware);
  }

  /**
   * Execute pre-middleware chain
   */
  public async executePre(context: StateMiddlewareContext): Promise<void> {
    const chain = [...this.middleware, ...this.preMiddleware];
    await this.executeChain(chain, context);
  }

  /**
   * Execute post-middleware chain
   */
  public async executePost(context: StateMiddlewareContext): Promise<void> {
    const chain = [...this.middleware, ...this.postMiddleware];
    await this.executeChain(chain, context);
  }

  /**
   * Clear all middleware
   */
  public clear(): void {
    this.preMiddleware.length = 0;
    this.postMiddleware.length = 0;
    this.middleware.length = 0;
  }

  /**
   * Remove middleware by name
   */
  public remove(middleware: StateMiddleware): void {
    const index = this.middleware.indexOf(middleware);
    if (index >= 0) {
      this.middleware.splice(index, 1);
    }
  }

  private async executeChain(
    middleware: StateMiddleware[],
    context: StateMiddlewareContext
  ): Promise<void> {
    let index = 0;

    const executeNext = async (): Promise<void> => {
      if (index >= middleware.length) {
        return;
      }

      const mw = middleware[index++];
      await mw(context, executeNext);
    };

    await executeNext();
  }
}

/**
 * Logging middleware
 */
export class LoggingMiddleware {
  private logger: (message: string, ...args: unknown[]) => void;
  private includeState: boolean;

  constructor(
    logger?: (message: string, ...args: unknown[]) => void,
    includeState: boolean = false
  ) {
    this.logger = logger || console.log;
    this.includeState = includeState;
  }

  public middleware(): StateMiddleware {
    return async (
      context: StateMiddlewareContext,
      next: () => Promise<void>
    ): Promise<void> => {
      const { phase, transition, manager } = context;

      this.logger(
        `[State:${phase.toUpperCase()}] ${transition.id}`,
        `Scope: ${transition.scope}`,
        `Trigger: ${transition.trigger}`,
        `Version: ${transition.fromState.toString()} → ${transition.toState.toString()}`
      );

      if (this.includeState) {
        this.logger("[State:current]", context.state);
        if (context.nextState) {
          this.logger("[State:next]", context.nextState);
        }
      }

      const startTime = Date.now();

      await next();

      const duration = Date.now() - startTime;
      this.logger(`[State:${phase.toUpperCase()}] Completed in ${duration}ms`);
    };
  }
}

/**
 * Analytics middleware
 */
export class AnalyticsMiddleware {
  private metrics: Map<string, AnalyticsMetric>;

  constructor() {
    this.metrics = new Map();
  }

  public middleware(): StateMiddleware {
    return async (
      context: StateMiddlewareContext,
      next: () => Promise<void>
    ): Promise<void> => {
      const startTime = Date.now();
      const startSize = this.estimateSize(context.state);

      await next();

      const duration = Date.now() - startTime;
      const endSize = context.nextState
        ? this.estimateSize(context.nextState)
        : startSize;

      // Record metrics
      this.recordMetric({
        transitionId: context.transition.id,
        scope: context.transition.scope,
        trigger: context.transition.trigger,
        phase: context.phase,
        duration,
        stateSize: startSize,
        stateSizeDelta: endSize - startSize,
        changes: context.transition.changes.length,
        timestamp: new Date(),
      });
    };
  }

  /**
   * Get all metrics
   */
  public getMetrics(): AnalyticsMetric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get metrics by scope
   */
  public getMetricsByScope(scope: string): AnalyticsMetric[] {
    return this.getMetrics().filter(m => m.scope === scope);
  }

  /**
   * Get metrics by trigger
   */
  public getMetricsByTrigger(trigger: string): AnalyticsMetric[] {
    return this.getMetrics().filter(m => m.trigger === trigger);
  }

  /**
   * Get average duration
   */
  public getAverageDuration(): number {
    const metrics = this.getMetrics();
    if (metrics.length === 0) return 0;

    const total = metrics.reduce((sum, m) => sum + m.duration, 0);
    return total / metrics.length;
  }

  /**
   * Get percentile duration
   */
  public getPercentileDuration(percentile: number): number {
    const metrics = this.getMetrics()
      .map(m => m.duration)
      .sort((a, b) => a - b);

    if (metrics.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * metrics.length) - 1;
    return metrics[index];
  }

  /**
   * Clear metrics
   */
  public clearMetrics(): void {
    this.metrics.clear();
  }

  private recordMetric(metric: AnalyticsMetric): void {
    this.metrics.set(metric.transitionId, metric);
  }

  private estimateSize(state: unknown): number {
    return JSON.stringify(state).length;
  }
}

/**
 * Analytics metric
 */
export interface AnalyticsMetric {
  transitionId: string;
  scope: string;
  trigger: string;
  phase: string;
  duration: number;
  stateSize: number;
  stateSizeDelta: number;
  changes: number;
  timestamp: Date;
}

/**
 * Validation middleware
 */
export class ValidationMiddleware {
  private validator: (state: unknown) => { valid: boolean; errors: string[] };
  private throwOnError: boolean;

  constructor(
    validator: (state: unknown) => { valid: boolean; errors: string[] },
    throwOnError: boolean = false
  ) {
    this.validator = validator;
    this.throwOnError = throwOnError;
  }

  public middleware(): StateMiddleware {
    return async (
      context: StateMiddlewareContext,
      next: () => Promise<void>
    ): Promise<void> => {
      // Validate current state
      const currentState =
        context.phase === "pre"
          ? context.state
          : context.nextState || context.state;
      const result = this.validator(currentState);

      if (!result.valid) {
        const error = new Error(
          `State validation failed:\n${result.errors.map(e => `  - ${e}`).join("\n")}`
        );

        if (this.throwOnError) {
          throw error;
        } else {
          console.error("[ValidationMiddleware]", error.message);
        }
      }

      await next();
    };
  }
}

/**
 * Transformation middleware
 */
export class TransformationMiddleware {
  private transformers: Map<string, StateTransformer>;

  constructor() {
    this.transformers = new Map();
  }

  /**
   * Register transformer for a path
   */
  public register(
    path: string,
    transformer: (value: unknown) => unknown
  ): void {
    this.transformers.set(path, transformer);
  }

  /**
   * Unregister transformer
   */
  public unregister(path: string): void {
    this.transformers.delete(path);
  }

  public middleware(): StateMiddleware {
    return async (
      context: StateMiddlewareContext,
      next: () => Promise<void>
    ): Promise<void> => {
      // Apply transformations before state change
      if (context.phase === "pre" && context.nextState) {
        context.nextState = this.applyTransformations(
          context.nextState
        ) as Record<string, unknown>;
      }

      await next();
    };
  }

  private applyTransformations(state: unknown): unknown {
    if (typeof state !== "object" || state === null) {
      return state;
    }

    const result = { ...state };

    for (const [path, transformer] of this.transformers) {
      const value = this.getValueAtPath(result, path);
      if (value !== undefined) {
        const transformed = transformer(value);
        this.setValueAtPath(result, path, transformed);
      }
    }

    return result;
  }

  private getValueAtPath(obj: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce((current: unknown, key: string) => {
      return typeof current === "object" && current !== null
        ? (current as Record<string, unknown>)[key]
        : undefined;
    }, obj);
  }

  private setValueAtPath(
    obj: Record<string, unknown>,
    path: string,
    value: unknown
  ): void {
    const keys = path.split(".");
    const lastKey = keys.pop()!;
    const target = keys.reduce(
      (current: Record<string, unknown>, key: string) => {
        if (!(key in current) || typeof current[key] !== "object") {
          current[key] = {};
        }
        return current[key] as Record<string, unknown>;
      },
      obj
    );
    target[lastKey] = value;
  }
}

/**
 * State transformer function
 */
export type StateTransformer = (value: unknown) => unknown;

/**
 * Rate limiting middleware
 */
export class RateLimitMiddleware {
  private requests: Map<string, number[]>;
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number = 1000, maxRequests: number = 100) {
    this.requests = new Map();
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  public middleware(): StateMiddleware {
    return async (
      context: StateMiddlewareContext,
      next: () => Promise<void>
    ): Promise<void> => {
      const key = `${context.transition.scope}:${context.transition.trigger}`;

      if (!this.checkLimit(key)) {
        throw new Error(`Rate limit exceeded for ${key}`);
      }

      await next();
    };
  }

  private checkLimit(key: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];

    // Remove old timestamps outside the window
    const validTimestamps = timestamps.filter(ts => now - ts < this.windowMs);

    if (validTimestamps.length >= this.maxRequests) {
      return false;
    }

    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);

    return true;
  }

  /**
   * Clear rate limit data
   */
  public clear(): void {
    this.requests.clear();
  }
}

/**
 * State snapshot middleware
 */
export class SnapshotMiddleware {
  private snapshotTriggers: Map<string, SnapshotTrigger>;

  constructor() {
    this.snapshotTriggers = new Map();
  }

  /**
   * Register snapshot trigger
   */
  public registerTrigger(
    name: string,
    trigger: (context: StateMiddlewareContext) => boolean
  ): void {
    this.snapshotTriggers.set(name, trigger);
  }

  /**
   * Unregister snapshot trigger
   */
  public unregisterTrigger(name: string): void {
    this.snapshotTriggers.delete(name);
  }

  public middleware(
    snapshotCallback: (context: StateMiddlewareContext) => void
  ): StateMiddleware {
    return async (
      context: StateMiddlewareContext,
      next: () => Promise<void>
    ): Promise<void> => {
      await next();

      // Check snapshot triggers after state change
      if (context.phase === "post") {
        for (const [name, trigger] of this.snapshotTriggers) {
          if (trigger(context)) {
            snapshotCallback(context);
          }
        }
      }
    };
  }
}

/**
 * Snapshot trigger function
 */
export type SnapshotTrigger = (context: StateMiddlewareContext) => boolean;

/**
 * Error handling middleware
 */
export class ErrorHandlingMiddleware {
  private errorHandler?: (
    error: Error,
    context: StateMiddlewareContext
  ) => void;
  private rethrow: boolean;

  constructor(rethrow: boolean = true) {
    this.rethrow = rethrow;
  }

  public onError(
    handler: (error: Error, context: StateMiddlewareContext) => void
  ): void {
    this.errorHandler = handler;
  }

  public middleware(): StateMiddleware {
    return async (
      context: StateMiddlewareContext,
      next: () => Promise<void>
    ): Promise<void> => {
      try {
        await next();
      } catch (error) {
        if (this.errorHandler) {
          this.errorHandler(error as Error, context);
        }

        if (this.rethrow) {
          throw error;
        }
      }
    };
  }
}

/**
 * Caching middleware
 */
export class CacheMiddleware {
  private cache: Map<string, CacheEntry>;
  private ttl: number;

  constructor(ttl: number = 5000) {
    this.cache = new Map();
    this.ttl = ttl;
  }

  public middleware(): StateMiddleware {
    return async (
      context: StateMiddlewareContext,
      next: () => Promise<void>
    ): Promise<void> => {
      const cacheKey = this.getCacheKey(context);

      if (context.phase === "pre") {
        // Check cache
        const entry = this.cache.get(cacheKey);
        if (entry && Date.now() - entry.timestamp < this.ttl) {
          // Use cached state
          context.nextState = entry.state as Record<string, unknown>;
          return;
        }
      }

      await next();

      if (context.phase === "post" && context.nextState) {
        // Cache the result
        this.cache.set(cacheKey, {
          state: context.nextState,
          timestamp: Date.now(),
        });
      }
    };
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear expired cache entries
   */
  public clearExpired(): void {
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= this.ttl) {
        this.cache.delete(key);
      }
    }
  }

  private getCacheKey(context: StateMiddlewareContext): string {
    return `${context.transition.scope}:${context.transition.trigger}:${JSON.stringify(context.transition.changes)}`;
  }
}

/**
 * Cache entry
 */
export interface CacheEntry {
  state: unknown;
  timestamp: number;
}

/**
 * Event emitter middleware
 */
export class EventEmitterMiddleware {
  private listeners: Map<StateEvent, Set<EventListener>>;

  constructor() {
    this.listeners = new Map();
  }

  /**
   * Add event listener
   */
  public on(event: StateEvent, listener: EventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  /**
   * Remove event listener
   */
  public off(event: StateEvent, listener: EventListener): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  public middleware(): StateMiddleware {
    return async (
      context: StateMiddlewareContext,
      next: () => Promise<void>
    ): Promise<void> => {
      // Emit pre-change event
      if (context.phase === "pre") {
        this.emit("state:change", {
          type: "state:change",
          timestamp: new Date(),
          data: { phase: "pre", transition: context.transition },
          source: "middleware",
        });
      }

      await next();

      // Emit post-change event
      if (context.phase === "post") {
        this.emit("state:change", {
          type: "state:change",
          timestamp: new Date(),
          data: { phase: "post", transition: context.transition },
          source: "middleware",
        });
      }
    };
  }

  private emit(event: StateEvent, payload: StateEventPayload): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(payload);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      }
    }
  }
}

/**
 * Event listener function
 */
export type EventListener = (
  payload: StateEventPayload
) => void | Promise<void>;

/**
 * Factory functions for common middleware
 */
export function createLoggingMiddleware(
  logger?: (message: string, ...args: unknown[]) => void,
  includeState?: boolean
): StateMiddleware {
  const middleware = new LoggingMiddleware(logger, includeState);
  return middleware.middleware();
}

export function createAnalyticsMiddleware(): AnalyticsMiddleware {
  return new AnalyticsMiddleware();
}

export function createValidationMiddleware(
  validator: (state: unknown) => { valid: boolean; errors: string[] },
  throwOnError?: boolean
): StateMiddleware {
  const middleware = new ValidationMiddleware(validator, throwOnError);
  return middleware.middleware();
}

export function createTransformationMiddleware(): TransformationMiddleware {
  return new TransformationMiddleware();
}

export function createRateLimitMiddleware(
  windowMs?: number,
  maxRequests?: number
): StateMiddleware {
  const middleware = new RateLimitMiddleware(windowMs, maxRequests);
  return middleware.middleware();
}

export function createSnapshotMiddleware(
  snapshotCallback: (context: StateMiddlewareContext) => void
): SnapshotMiddleware {
  const middleware = new SnapshotMiddleware();
  middleware.middleware(snapshotCallback);
  return middleware;
}

export function createErrorHandlingMiddleware(
  rethrow?: boolean
): StateMiddleware {
  const middleware = new ErrorHandlingMiddleware(rethrow);
  return middleware.middleware();
}

export function createCacheMiddleware(ttl?: number): StateMiddleware {
  const middleware = new CacheMiddleware(ttl);
  return middleware.middleware();
}

export function createEventEmitterMiddleware(): EventEmitterMiddleware {
  return new EventEmitterMiddleware();
}

/**
 * Compose multiple middleware into one
 */
export function composeMiddleware(
  ...middleware: StateMiddleware[]
): StateMiddleware {
  return async (
    context: StateMiddlewareContext,
    next: () => Promise<void>
  ): Promise<void> => {
    let index = 0;

    const executeNext = async (): Promise<void> => {
      if (index >= middleware.length) {
        await next();
        return;
      }

      const mw = middleware[index++];
      await mw(context, executeNext);
    };

    await executeNext();
  };
}

/**
 * @lsi/utils - Shared utilities for Aequor Platform
 *
 * This package provides common utilities to eliminate code duplication
 * across 48+ Manager classes and save ~4,300 lines of code.
 *
 * @example
 * ```typescript
 * import { BaseManager, ConfigBuilder, RetryHelper, StatsTracker } from '@lsi/utils';
 *
 * // Use BaseManager for your managers
 * class MyManager extends BaseManager<MyConfig, MyStats, MyState> { ... }
 *
 * // Use ConfigBuilder for configuration
 * const config = new ConfigBuilder(defaults)
 *   .set('timeout', 60000)
 *   .validate(c => c.apiKey.length > 0, 'API key required')
 *   .build();
 *
 * // Use RetryHelper for retry logic
 * const result = await RetryHelper.withRetry(async () => { ... }, { maxAttempts: 3 });
 *
 * // Use StatsTracker for statistics
 * const tracker = new StatsTracker({ requests: 0, errors: 0 });
 * tracker.increment('requests');
 * ```
 */

// Base exports
export { BaseManager, createManager } from "./base/BaseManager.js";
export type { BaseManagerOptions, LifecycleEvent } from "./base/BaseManager.js";

// Config exports
export {
  ConfigBuilder,
  buildConfig,
  mergeConfig,
} from "./config/ConfigBuilder.js";
export type {
  ConfigValidator,
  ConfigValidationError,
} from "./config/ConfigBuilder.js";

// Retry exports
export {
  RetryHelper,
  retry,
  withRetry,
  CircuitBreaker,
  createCircuitBreaker,
  createStandardCircuitBreaker,
} from "./retry/index.js";
export type {
  RetryOptions,
  RetryResult,
  RetryStats,
} from "./retry/RetryHelper.js";
export type {
  CircuitBreakerOptions,
  CircuitBreakerStats,
  CircuitState,
} from "./retry/CircuitBreaker.js";

// Stats exports
export {
  StatsTracker,
  createStatsTracker,
  createStandardTracker,
} from "./stats/StatsTracker.js";
export type { TimeWindow, StatsTrackerOptions } from "./stats/StatsTracker.js";

// Lifecycle exports
export {
  LifecycleManager,
  withLifecycle,
  createLifecycle,
} from "./lifecycle/LifecycleManager.js";
export type {
  LifecycleState,
  LifecycleEvent as LifecycleEventType,
  LifecycleHooks,
  LifecycleManagerOptions,
} from "./lifecycle/LifecycleManager.js";

// Re-export RetryError for convenience
export { RetryError } from "./retry/RetryHelper.js";
export { CircuitBreakerError } from "./retry/CircuitBreaker.js";

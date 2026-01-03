/**
 * @lsi/learning - Learning and Adaptation System for SuperInstance
 *
 * This package enables SuperInstance to learn from usage patterns, hardware
 * characteristics, and user behavior over time.
 *
 * ## Privacy Guarantees
 *
 * - All learning data stays local
 * - No telemetry sent to cloud
 * - Profile encrypted at rest
 * - User can view/delete all learned data
 * - Opt-out mechanism available
 *
 * ## Usage
 *
 * ```ts
 * import { createLearningEngine } from '@lsi/learning';
 *
 * const engine = await createLearningEngine('./data');
 *
 * // Record query outcomes
 * await engine.recordQuery(
 *   'What is the capital of France?',
 *   { destination: 'local', complexity: 0.3, confidence: 0.8, reason: 'Simple query' },
 *   { latency: 150, success: true, cached: false, model: 'llama2' }
 * );
 *
 * // Get routing recommendations
 * const recommendation = engine.getRoutingRecommendation({
 *   text: 'Explain quantum computing',
 * });
 * console.log(recommendation);
 * // { destination: 'cloud', confidence: 0.9, reason: 'High complexity' }
 *
 * // Get hardware configuration
 * const hwConfig = engine.getHardwareConfig();
 * console.log(hwConfig);
 * // { maxConcurrentQueries: 4, cacheSize: 1000000000, enableGPU: false, ... }
 *
 * // Shutdown
 * await engine.shutdown();
 * ```
 */

// Types
export type {
  LearningProfile,
  HardwareProfile,
  UsageProfile,
  PerformanceProfile,
  PreferenceProfile,
  TelemetryEntry,
  RoutingDestination,
  RoutingDecision,
  QueryOutcome,
  RoutingRecommendation,
  HardwareConfig,
  LearningConfig,
  Query,
  QueryContext,
  LearningStatistics,
  LearningResult,
} from './types.js';

// Core classes
export { LearningEngine, createLearningEngine } from './LearningEngine.js';
export { TelemetryCollector, createTelemetryCollector } from './TelemetryCollector.js';
export { HardwareProfiler, createHardwareProfiler, quickDetect } from './HardwareProfiler.js';

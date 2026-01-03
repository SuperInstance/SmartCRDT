/**
 * Cache Warming System - Main Export
 *
 * Exports all cache warming components for easy importing.
 *
 * @example
 * ```ts
 * import {
 *   PatternLearner,
 *   AdvancedCacheWarmer,
 *   PredictivePreloader,
 *   WarmingProgressTracker,
 *   createConsoleTracker,
 *   getDefaultStaticQueries,
 *   getDefaultWarmingConfig,
 * } from '@lsi/cascade/cache-warming';
 * ```
 */

// Pattern Learning
export { PatternLearner, DEFAULT_PATTERN_LEARNER_CONFIG } from "./PatternLearner.js";

// Advanced Cache Warming
export {
  AdvancedCacheWarmer,
  getDefaultStaticQueries,
  getDefaultWarmingConfig,
} from "./AdvancedCacheWarmer.js";

// Predictive Preloading
export {
  PredictivePreloader,
  DEFAULT_PREDICTIVE_PRELOADER_CONFIG,
} from "./PredictivePreloader.js";

// Progress Tracking
export {
  WarmingProgressTracker,
  createConsoleTracker,
} from "./WarmingProgressTracker.js";

// Legacy Cache Warmer (for backward compatibility)
export { CacheWarmer, getCommonQueries, DEFAULT_CACHE_WARMER_CONFIG } from "./CacheWarmer.js";

// Re-export types from protocol
export type {
  WarmingStrategyType,
  WarmingStrategy,
  StaticWarmingConfig,
  HistoricalWarmingConfig,
  PredictiveWarmingConfig,
  HybridWarmingConfig,
  AdaptiveWarmingConfig,
  QueryPattern,
  PatternCluster,
  PatternLearningResult,
  WarmingStage,
  WarmingProgress,
  WarmingProgressCallback,
  CacheWarmingResult,
  WarmingEffectiveness,
  CacheWarmingConfig,
  PatternLearnerConfig,
  QueryLogEntry,
  CommonQueryDataset,
  DomainKnowledgeBase,
  QueryPrediction,
  MarkovState,
  NeuralPredictionConfig,
} from "@lsi/protocol";

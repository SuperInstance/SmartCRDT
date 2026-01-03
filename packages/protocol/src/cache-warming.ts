/**
 * Cache Warming Protocol Types
 *
 * Protocol types for proactive cache warming strategies that improve
 * cold-start performance and maintain high hit rates.
 *
 * Key Features:
 * - Multiple warming strategies (static, historical, predictive, hybrid, adaptive)
 * - Query pattern learning and analysis
 * - Progress tracking and reporting
 * - Warmup effectiveness metrics
 */

// ============================================================================
// WARMING STRATEGY TYPES
// ============================================================================

/**
 * Warming strategy type enumeration
 */
export type WarmingStrategyType =
  | "static" // Predefined common queries
  | "historical" // Learned from past queries
  | "predictive" // ML-based prediction
  | "hybrid" // Combination of strategies
  | "adaptive"; // Adjusts based on performance

/**
 * Cache warming strategy configuration
 */
export interface WarmingStrategy {
  /** Strategy type */
  type: WarmingStrategyType;
  /** Priority of this strategy (higher = preferred) */
  priority: number;
  /** Maximum number of queries to warm from this strategy */
  maxQueries?: number;
  /** Strategy-specific configuration */
  config?: Record<string, unknown>;
}

/**
 * Static warming strategy configuration
 */
export interface StaticWarmingConfig {
  /** Seed queries to preload */
  seedQueries: string[];
  /** Query categories and their weights */
  categories: Record<string, number>;
}

/**
 * Historical warming strategy configuration
 */
export interface HistoricalWarmingConfig {
  /** Path to query log file */
  logPath?: string;
  /** Number of recent queries to consider */
  recentQueryCount: number;
  /** Minimum frequency threshold (0-1) */
  minFrequency: number;
  /** Time window for historical analysis (ms) */
  timeWindow: number;
}

/**
 * Predictive warming strategy configuration
 */
export interface PredictiveWarmingConfig {
  /** ML model type for prediction */
  modelType: "frequency" | "markov" | "temporal" | "ensemble" | "neural";
  /** Prediction confidence threshold (0-1) */
  confidenceThreshold: number;
  /** Maximum predictions to generate */
  maxPredictions: number;
  /** Training data size */
  trainingSize: number;
}

/**
 * Hybrid warming strategy configuration
 */
export interface HybridWarmingConfig {
  /** List of strategies to combine */
  strategies: WarmingStrategy[];
  /** Combination method */
  method: "weighted" | "voting" | "cascading";
  /** Weights for each strategy (if weighted) */
  weights?: Record<string, number>;
}

/**
 * Adaptive warming strategy configuration
 */
export interface AdaptiveWarmingConfig {
  /** Base strategy to start with */
  baseStrategy: WarmingStrategy;
  /** Target hit rate threshold */
  targetHitRate: number;
  /** Adjustment interval (ms) */
  adjustmentInterval: number;
  /** Strategies to switch between */
  availableStrategies: WarmingStrategy[];
}

// ============================================================================
// QUERY PATTERN TYPES
// ============================================================================

/**
 * Query pattern extracted from logs
 */
export interface QueryPattern {
  /** The query pattern (can be templated) */
  pattern: string;
  /** Frequency of this pattern */
  frequency: number;
  /** Average similarity score */
  avgSimilarity: number;
  /** Last seen timestamp */
  lastSeen: number;
  /** Query types in this pattern */
  queryTypes: string[];
  /** Example queries matching this pattern */
  examples: string[];
}

/**
 * Query pattern cluster
 */
export interface PatternCluster {
  /** Cluster ID */
  id: string;
  /** Patterns in this cluster */
  patterns: QueryPattern[];
  /** Cluster centroid (semantic) */
  centroid: number[];
  /** Cluster size */
  size: number;
  /** Cluster priority */
  priority: number;
}

/**
 * Pattern learning result
 */
export interface PatternLearningResult {
  /** Number of patterns learned */
  patternCount: number;
  /** Number of clusters created */
  clusterCount: number;
  /** Learning duration (ms) */
  duration: number;
  /** Top patterns by frequency */
  topPatterns: QueryPattern[];
}

// ============================================================================
// WARMING PROGRESS TYPES
// ============================================================================

/**
 * Warming progress stage
 */
export type WarmingStage =
  | "initializing"
  | "loading_patterns"
  | "generating_predictions"
  | "warming_cache"
  | "verifying"
  | "complete"
  | "failed";

/**
 * Warming progress information
 */
export interface WarmingProgress {
  /** Current stage */
  stage: WarmingStage;
  /** Progress percentage (0-100) */
  progress: number;
  /** Number of queries warmed */
  queriesWarmed: number;
  /** Total queries to warm */
  totalQueries: number;
  /** Current strategy being used */
  currentStrategy: WarmingStrategyType;
  /** Estimated time remaining (ms) */
  estimatedTimeRemaining?: number;
  /** Warming start time */
  startTime: number;
  /** Current hit rate (if available) */
  currentHitRate?: number;
}

/**
 * Warming progress callback
 */
export type WarmingProgressCallback = (progress: WarmingProgress) => void;

// ============================================================================
// WARMING RESULT TYPES
// ============================================================================

/**
 * Cache warming result with detailed metrics
 */
export interface CacheWarmingResult {
  /** Whether warming was successful */
  success: boolean;
  /** Number of successfully warmed queries */
  successful: number;
  /** Number of failed queries */
  failed: number;
  /** Total duration (ms) */
  duration: number;
  /** Strategy used */
  strategy: WarmingStrategyType;
  /** Final cache hit rate */
  finalHitRate: number;
  /** Initial cache hit rate */
  initialHitRate: number;
  /** Hit rate improvement */
  hitRateImprovement: number;
  /** Memory usage (bytes) */
  memoryUsage: number;
  /** Queries that failed */
  failedQueries?: Array<{ query: string; error: string }>;
  /** Warming progress snapshots */
  progressSnapshots?: WarmingProgress[];
  /** Effectiveness score (0-1) */
  effectiveness: number;
}

/**
 * Warming effectiveness metrics
 */
export interface WarmingEffectiveness {
  /** Hit rate achieved (0-1) */
  hitRate: number;
  /** Target hit rate (0-1) */
  targetHitRate: number;
  /** Whether target was achieved */
  targetAchieved: boolean;
  /** Warmup time (ms) */
  warmupTime: number;
  /** Target warmup time (ms) */
  targetWarmupTime: number;
  /** Whether time target was achieved */
  timeTargetAchieved: boolean;
  /** Memory usage (bytes) */
  memoryUsage: number;
  /** Target memory usage (bytes) */
  targetMemoryUsage: number;
  /** Whether memory target was achieved */
  memoryTargetAchieved: boolean;
  /** Overall effectiveness score (0-1) */
  score: number;
}

// ============================================================================
// WARMING CONFIGURATION
// ============================================================================

/**
 * Cache warming configuration
 */
export interface CacheWarmingConfig {
  /** Warming strategies to use (in priority order) */
  strategies: WarmingStrategy[];
  /** Enable progress tracking */
  enableProgressTracking?: boolean;
  /** Progress callback */
  progressCallback?: WarmingProgressCallback;
  /** Batch size for warming */
  batchSize?: number;
  /** Delay between batches (ms) */
  delayBetweenBatches?: number;
  /** Maximum warmup time (ms) */
  maxWarmupTime?: number;
  /** Target hit rate (0-1) */
  targetHitRate?: number;
  /** Target memory usage (bytes) */
  targetMemoryUsage?: number;
  /** Enable adaptive warming */
  enableAdaptive?: boolean;
  /** Query log path for historical learning */
  queryLogPath?: string;
  /** Enable pattern learning */
  enablePatternLearning?: boolean;
}

/**
 * Pattern learner configuration
 */
export interface PatternLearnerConfig {
  /** Minimum pattern frequency (0-1) */
  minFrequency: number;
  /** Pattern similarity threshold (0-1) */
  similarityThreshold: number;
  /** Maximum patterns to learn */
  maxPatterns: number;
  /** Enable temporal analysis */
  enableTemporalAnalysis: boolean;
  /** Time window for analysis (ms) */
  timeWindow: number;
  /** Clustering enabled */
  enableClustering: boolean;
  /** Maximum clusters */
  maxClusters: number;
}

// ============================================================================
// WARMING SOURCE TYPES
// ============================================================================

/**
 * Query log entry
 */
export interface QueryLogEntry {
  /** Query text */
  query: string;
  /** Timestamp */
  timestamp: number;
  /** Session ID */
  sessionId: string;
  /** Query result */
  result?: unknown;
  /** Hit or miss */
  cacheHit: boolean;
  /** Query type */
  queryType?: string;
  /** Latency (ms) */
  latency?: number;
}

/**
 * Common query dataset
 */
export interface CommonQueryDataset {
  /** Dataset name */
  name: string;
  /** Dataset version */
  version: string;
  /** Queries in the dataset */
  queries: Array<{
    /** Query text */
    query: string;
    /** Category */
    category: string;
    /** Frequency weight */
    weight: number;
  }>;
}

/**
 * Domain-specific knowledge base
 */
export interface DomainKnowledgeBase {
  /** Domain name */
  domain: string;
  /** Common queries for this domain */
  commonQueries: string[];
  /** Query templates */
  templates: string[];
  /** Domain-specific patterns */
  patterns: QueryPattern[];
}

// ============================================================================
// PREDICTIVE MODEL TYPES
// ============================================================================

/**
 * Query prediction result
 */
export interface QueryPrediction {
  /** Predicted query */
  query: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Predicted time of use */
  predictedTime: number;
  /** Reasoning for prediction */
  reasoning: string;
}

/**
 * Markov chain state for query prediction
 */
export interface MarkovState {
  /** Previous queries */
  history: string[];
  /** Current query */
  current: string;
  /** Next likely queries */
  nextQueries: Array<{
    query: string;
    probability: number;
  }>;
}

/**
 * Neural network prediction config
 */
export interface NeuralPredictionConfig {
  /** Input sequence length */
  sequenceLength: number;
  /** Embedding dimension */
  embeddingDim: number;
  /** Hidden layer sizes */
  hiddenLayers: number[];
  /** Training epochs */
  epochs: number;
  /** Learning rate */
  learningRate: number;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate cache warming configuration
 */
export function validateWarmingConfig(
  config: CacheWarmingConfig
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.strategies || config.strategies.length === 0) {
    errors.push("At least one warming strategy must be specified");
  }

  for (const strategy of config.strategies) {
    if (!strategy.type) {
      errors.push("Strategy must have a type");
    }
    if (typeof strategy.priority !== "number" || strategy.priority < 0) {
      errors.push("Strategy priority must be a non-negative number");
    }
  }

  if (config.targetHitRate !== undefined) {
    if (config.targetHitRate < 0 || config.targetHitRate > 1) {
      errors.push("Target hit rate must be between 0 and 1");
    }
  }

  if (config.batchSize !== undefined && config.batchSize < 1) {
    errors.push("Batch size must be at least 1");
  }

  if (
    config.delayBetweenBatches !== undefined &&
    config.delayBetweenBatches < 0
  ) {
    errors.push("Delay between batches must be non-negative");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate warming result
 */
export function validateWarmingResult(
  result: CacheWarmingResult
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof result.success !== "boolean") {
    errors.push("Result must have success boolean");
  }

  if (result.successful < 0) {
    errors.push("Successful count must be non-negative");
  }

  if (result.failed < 0) {
    errors.push("Failed count must be non-negative");
  }

  if (result.duration < 0) {
    errors.push("Duration must be non-negative");
  }

  if (result.finalHitRate < 0 || result.finalHitRate > 1) {
    errors.push("Final hit rate must be between 0 and 1");
  }

  if (result.effectiveness < 0 || result.effectiveness > 1) {
    errors.push("Effectiveness must be between 0 and 1");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate warming effectiveness score
 */
export function calculateEffectiveness(
  result: CacheWarmingResult,
  targets: {
    hitRate: number;
    warmupTime: number;
    memoryUsage: number;
  }
): WarmingEffectiveness {
  const hitRateAchieved = result.finalHitRate >= targets.hitRate;
  const timeTargetAchieved = result.duration <= targets.warmupTime;
  const memoryTargetAchieved = result.memoryUsage <= targets.memoryUsage;

  // Calculate score as weighted average of achievements
  const hitRateScore = Math.min(result.finalHitRate / targets.hitRate, 1.0);
  const timeScore = Math.min(targets.warmupTime / result.duration, 1.0);
  const memoryScore = Math.min(targets.memoryUsage / result.memoryUsage, 1.0);

  const score = hitRateScore * 0.5 + timeScore * 0.3 + memoryScore * 0.2;

  return {
    hitRate: result.finalHitRate,
    targetHitRate: targets.hitRate,
    targetAchieved: hitRateAchieved,
    warmupTime: result.duration,
    targetWarmupTime: targets.warmupTime,
    timeTargetAchieved,
    memoryUsage: result.memoryUsage,
    targetMemoryUsage: targets.memoryUsage,
    memoryTargetAchieved,
    score,
  };
}

/**
 * AdvancedCacheWarmer - Multi-strategy cache warming system
 *
 * Implements multiple cache warming strategies for high hit rates:
 *
 * 1. Static Seeds - Preload common queries
 * 2. Historical Patterns - Learn from past queries
 * 3. Predictive - ML-based prediction (Markov chains, frequency)
 * 4. Hybrid - Combine multiple strategies
 * 5. Adaptive - Adjust based on hit rate
 *
 * Features:
 * - Progress tracking with detailed metrics
 * - Batch processing with rate limiting
 * - Automatic strategy selection
 * - Warmup effectiveness scoring
 * - Memory-aware warming
 *
 * Example:
 * ```ts
 * const warmer = new AdvancedCacheWarmer(cache, router, {
 *   strategies: [
 *     { type: 'static', priority: 1, config: { seedQueries: [...] } },
 *     { type: 'historical', priority: 2, config: { logPath: './logs' } },
 *   ],
 *   targetHitRate: 0.6,
 * });
 * const result = await warmer.warm();
 * console.log(`Hit rate: ${result.finalHitRate}, Memory: ${result.memoryUsage} bytes`);
 * ```
 */

import type {
  CacheWarmingConfig,
  CacheWarmingResult,
  WarmingStrategy,
  WarmingStrategyType,
  WarmingProgress,
  WarmingStage,
  WarmingProgressCallback,
  QueryLogEntry,
  StaticWarmingConfig,
  HistoricalWarmingConfig,
  PredictiveWarmingConfig,
  HybridWarmingConfig,
  AdaptiveWarmingConfig,
  QueryPattern,
  QueryPrediction,
  calculateEffectiveness,
} from "@lsi/protocol";
import { validateWarmingConfig } from "@lsi/protocol";
import { PatternLearner } from "./PatternLearner.js";
import type { SemanticCache } from "../refiner/SemanticCache.js";
import type { CascadeRouter } from "../router/CascadeRouter.js";

/**
 * Warming session state
 */
interface WarmingSession {
  startTime: number;
  initialHitRate: number;
  queriesWarmed: number;
  queriesFailed: number;
  currentStrategy: WarmingStrategyType;
  progressSnapshots: WarmingProgress[];
  memoryUsage: number;
}

/**
 * Query generator function type
 */
type QueryGenerator = AsyncGenerator<string, void, unknown>;

/**
 * AdvancedCacheWarmer - Multi-strategy cache warming
 */
export class AdvancedCacheWarmer {
  private cache: SemanticCache;
  private router: CascadeRouter;
  private config: CacheWarmingConfig;
  private patternLearner: PatternLearner;
  private activeSession: WarmingSession | null = null;
  private abortController: AbortController | null = null;

  constructor(
    cache: SemanticCache,
    router: CascadeRouter,
    config: CacheWarmingConfig
  ) {
    // Validate configuration
    const validation = validateWarmingConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid warming config: ${validation.errors.join(", ")}`);
    }

    this.cache = cache;
    this.router = router;
    this.config = config;

    // Initialize pattern learner
    this.patternLearner = new PatternLearner({
      minFrequency: 0.05,
      similarityThreshold: 0.85,
      maxPatterns: 100,
      enableTemporalAnalysis: true,
      enableClustering: true,
    });
  }

  /**
   * Warm cache using configured strategies
   *
   * Executes warming strategies in priority order and tracks progress.
   *
   * @returns Warming result with detailed metrics
   */
  async warm(): Promise<CacheWarmingResult> {
    // Initialize warming session
    this.activeSession = {
      startTime: Date.now(),
      initialHitRate: this.getCurrentHitRate(),
      queriesWarmed: 0,
      queriesFailed: 0,
      currentStrategy: "static",
      progressSnapshots: [],
      memoryUsage: 0,
    };

    this.abortController = new AbortController();

    try {
      // Sort strategies by priority
      const sortedStrategies = [...this.config.strategies].sort(
        (a, b) => b.priority - a.priority
      );

      // Execute each strategy
      for (const strategy of sortedStrategies) {
        if (this.abortController.signal.aborted) {
          break;
        }

        this.activeSession.currentStrategy = strategy.type;
        await this.executeStrategy(strategy);
      }

      // Calculate final metrics
      const duration = Date.now() - this.activeSession.startTime;
      const finalHitRate = this.getCurrentHitRate();
      const memoryUsage = this.getMemoryUsage();

      const result: CacheWarmingResult = {
        success: !this.abortController.signal.aborted,
        successful: this.activeSession.queriesWarmed,
        failed: this.activeSession.queriesFailed,
        duration,
        strategy: this.activeSession.currentStrategy,
        finalHitRate,
        initialHitRate: this.activeSession.initialHitRate,
        hitRateImprovement: finalHitRate - this.activeSession.initialHitRate,
        memoryUsage,
        progressSnapshots: this.activeSession.progressSnapshots,
        effectiveness: this.calculateEffectivenessScore(
          finalHitRate,
          duration,
          memoryUsage
        ),
      };

      return result;
    } catch (error) {
      return {
        success: false,
        successful: this.activeSession.queriesWarmed,
        failed: this.activeSession.queriesFailed,
        duration: Date.now() - this.activeSession.startTime,
        strategy: this.activeSession.currentStrategy,
        finalHitRate: this.getCurrentHitRate(),
        initialHitRate: this.activeSession.initialHitRate,
        hitRateImprovement: 0,
        memoryUsage: this.getMemoryUsage(),
        effectiveness: 0,
      };
    } finally {
      this.activeSession = null;
      this.abortController = null;
    }
  }

  /**
   * Execute a single warming strategy
   *
   * @param strategy - Strategy to execute
   */
  private async executeStrategy(strategy: WarmingStrategy): Promise<void> {
    this.updateProgress("warming_cache", 0, strategy.type);

    switch (strategy.type) {
      case "static":
        await this.executeStaticStrategy(strategy.config as StaticWarmingConfig);
        break;

      case "historical":
        await this.executeHistoricalStrategy(
          strategy.config as HistoricalWarmingConfig
        );
        break;

      case "predictive":
        await this.executePredictiveStrategy(
          strategy.config as PredictiveWarmingConfig
        );
        break;

      case "hybrid":
        await this.executeHybridStrategy(strategy.config as HybridWarmingConfig);
        break;

      case "adaptive":
        await this.executeAdaptiveStrategy(
          strategy.config as AdaptiveWarmingConfig
        );
        break;

      default:
        console.warn(`Unknown strategy type: ${strategy.type}`);
    }
  }

  /**
   * Execute static warming strategy
   *
   * @param config - Static warming configuration
   */
  private async executeStaticStrategy(config: StaticWarmingConfig): Promise<void> {
    const queries = config.seedQueries;

    await this.warmQueries(queries, async (query, index, total) => {
      this.updateProgress("warming_cache", (index / total) * 100, "static");
    });
  }

  /**
   * Execute historical warming strategy
   *
   * @param config - Historical warming configuration
   */
  private async executeHistoricalStrategy(
    config: HistoricalWarmingConfig
  ): Promise<void> {
    this.updateProgress("loading_patterns", 0, "historical");

    // Load query logs
    const queryLogs = await this.loadQueryLogs(config.logPath);
    if (queryLogs.length === 0) {
      console.warn("No query logs found for historical warming");
      return;
    }

    // Learn patterns
    const learningResult = await this.patternLearner.learnFromLogs(queryLogs);

    console.log(
      `[AdvancedCacheWarmer] Learned ${learningResult.patternCount} patterns`
    );

    // Extract queries from patterns
    const queries: string[] = [];
    for (const pattern of learningResult.topPatterns) {
      queries.push(...pattern.examples);
    }

    // Warm with learned patterns
    await this.warmQueries(queries, async (query, index, total) => {
      this.updateProgress("warming_cache", (index / total) * 100, "historical");
    });
  }

  /**
   * Execute predictive warming strategy
   *
   * @param config - Predictive warming configuration
   */
  private async executePredictiveStrategy(
    config: PredictiveWarmingConfig
  ): Promise<void> {
    this.updateProgress("generating_predictions", 0, "predictive");

    // Load historical data for training
    const queryLogs = await this.loadQueryLogs(this.config.queryLogPath);

    // Learn patterns
    await this.patternLearner.learnFromLogs(queryLogs);

    // Generate predictions
    const predictions = this.generatePredictions(config, queryLogs);

    // Extract queries from predictions
    const queries = predictions
      .filter(p => p.confidence >= config.confidenceThreshold)
      .slice(0, config.maxPredictions)
      .map(p => p.query);

    // Warm with predictions
    await this.warmQueries(queries, async (query, index, total) => {
      this.updateProgress("warming_cache", (index / total) * 100, "predictive");
    });
  }

  /**
   * Execute hybrid warming strategy
   *
   * @param config - Hybrid warming configuration
   */
  private async executeHybridStrategy(config: HybridWarmingConfig): Promise<void> {
    const allQueries: string[] = [];

    // Execute each sub-strategy
    for (const strategy of config.strategies) {
      const queries = await this.generateQueriesForStrategy(strategy);
      allQueries.push(...queries);
    }

    // Deduplicate and warm
    const uniqueQueries = Array.from(new Set(allQueries));
    await this.warmQueries(uniqueQueries, async (query, index, total) => {
      this.updateProgress("warming_cache", (index / total) * 100, "hybrid");
    });
  }

  /**
   * Execute adaptive warming strategy
   *
   * @param config - Adaptive warming configuration
   */
  private async executeAdaptiveStrategy(
    config: AdaptiveWarmingConfig
  ): Promise<void> {
    let currentStrategy = config.baseStrategy;
    let iteration = 0;
    const maxIterations = config.availableStrategies.length;

    while (iteration < maxIterations) {
      // Execute current strategy
      await this.executeStrategy(currentStrategy);

      // Check if target hit rate achieved
      const currentHitRate = this.getCurrentHitRate();
      if (currentHitRate >= config.targetHitRate) {
        console.log(
          `[AdvancedCacheWarmer] Target hit rate ${config.targetHitRate} achieved`
        );
        break;
      }

      // Switch to next strategy
      const nextStrategyIndex =
        (config.availableStrategies.indexOf(currentStrategy) + 1) %
        config.availableStrategies.length;
      currentStrategy = config.availableStrategies[nextStrategyIndex];
      iteration++;

      // Wait before next iteration
      await this.delay(config.adjustmentInterval);
    }
  }

  /**
   * Warm queries with progress tracking
   *
   * @param queries - Queries to warm
   * @param progressCallback - Progress callback
   */
  private async warmQueries(
    queries: string[],
    progressCallback?: (query: string, index: number, total: number) => Promise<void>
  ): Promise<void> {
    const batchSize = this.config.batchSize ?? 10;
    const delay = this.config.delayBetweenBatches ?? 100;

    for (let i = 0; i < queries.length; i += batchSize) {
      if (this.abortController?.signal.aborted) {
        break;
      }

      const batch = queries.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(async query => {
          try {
            // Route query through router (will cache result)
            await this.router.route(query, {
              timestamp: Date.now(),
              sessionId: "warmup",
              query,
            });

            if (this.activeSession) {
              this.activeSession.queriesWarmed++;
            }

            return { success: true };
          } catch (error) {
            if (this.activeSession) {
              this.activeSession.queriesFailed++;
            }
            return {
              success: false,
              query,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        })
      );

      // Call progress callback
      if (progressCallback) {
        await progressCallback(queries[i] || "", i, queries.length);
      }

      // Delay between batches
      if (i + batchSize < queries.length) {
        await this.delay(delay);
      }

      // Check memory usage
      if (this.config.targetMemoryUsage) {
        const currentMemory = this.getMemoryUsage();
        if (currentMemory > this.config.targetMemoryUsage) {
          console.warn(
            `[AdvancedCacheWarmer] Memory limit reached: ${currentMemory} bytes`
          );
          break;
        }
      }
    }
  }

  /**
   * Generate queries for a strategy
   *
   * @param strategy - Strategy to generate queries for
   * @returns Array of queries
   */
  private async generateQueriesForStrategy(
    strategy: WarmingStrategy
  ): Promise<string[]> {
    switch (strategy.type) {
      case "static":
        return (strategy.config as StaticWarmingConfig).seedQueries;

      case "historical": {
        const config = strategy.config as HistoricalWarmingConfig;
        const queryLogs = await this.loadQueryLogs(config.logPath);
        const learningResult = await this.patternLearner.learnFromLogs(queryLogs);
        return learningResult.topPatterns.flatMap(p => p.examples);
      }

      case "predictive": {
        const config = strategy.config as PredictiveWarmingConfig;
        const queryLogs = await this.loadQueryLogs(this.config.queryLogPath);
        await this.patternLearner.learnFromLogs(queryLogs);
        const predictions = this.generatePredictions(config, queryLogs);
        return predictions.map(p => p.query);
      }

      default:
        return [];
    }
  }

  /**
   * Generate predictions using configured model
   *
   * @param config - Predictive configuration
   * @param queryLogs - Historical query logs
   * @returns Array of predictions
   */
  private generatePredictions(
    config: PredictiveWarmingConfig,
    queryLogs: QueryLogEntry[]
  ): QueryPrediction[] {
    const predictions: QueryPrediction[] = [];

    switch (config.modelType) {
      case "frequency": {
        // Frequency-based prediction
        const patterns = this.patternLearner.getPatterns();
        for (const pattern of patterns.slice(0, config.maxPredictions)) {
          predictions.push({
            query: pattern.pattern,
            confidence: pattern.frequency,
            predictedTime: Date.now() + 60000, // 1 minute from now
            reasoning: `High frequency pattern (${pattern.frequency.toFixed(2)})`,
          });
        }
        break;
      }

      case "markov": {
        // Markov chain prediction
        const recentQueries = queryLogs
          .slice(-10)
          .map(log => log.query);
        const nextQueries = this.patternLearner.predictNextQueries(recentQueries);

        for (const pred of nextQueries) {
          predictions.push({
            query: pred.query,
            confidence: pred.confidence,
            predictedTime: Date.now() + 60000,
            reasoning: `Markov chain prediction (confidence: ${pred.confidence.toFixed(2)})`,
          });
        }
        break;
      }

      case "neural": {
        // Placeholder for neural network prediction
        // Would require training a neural model
        console.warn("Neural prediction not yet implemented, using frequency");
        const patterns = this.patternLearner.getPatterns();
        for (const pattern of patterns.slice(0, config.maxPredictions)) {
          predictions.push({
            query: pattern.pattern,
            confidence: pattern.frequency,
            predictedTime: Date.now() + 60000,
            reasoning: "Frequency-based (neural placeholder)",
          });
        }
        break;
      }
    }

    return predictions;
  }

  /**
   * Load query logs from file
   *
   * @param path - Path to query log file
   * @returns Array of query log entries
   */
  private async loadQueryLogs(path?: string): Promise<QueryLogEntry[]> {
    if (!path) {
      // Return empty logs if no path specified
      return [];
    }

    try {
      // In a real implementation, this would read from the file system
      // For now, return empty array
      console.warn(`[AdvancedCacheWarmer] Query log loading not implemented for path: ${path}`);
      return [];
    } catch (error) {
      console.error(`[AdvancedCacheWarmer] Failed to load query logs:`, error);
      return [];
    }
  }

  /**
   * Update warming progress
   *
   * @param stage - Current warming stage
   * @param progress - Progress percentage (0-100)
   * @param strategy - Current strategy
   */
  private updateProgress(
    stage: WarmingStage,
    progress: number,
    strategy: WarmingStrategyType
  ): void {
    if (!this.activeSession || !this.config.enableProgressTracking) {
      return;
    }

    const progressData: WarmingProgress = {
      stage,
      progress: Math.max(0, Math.min(100, progress)),
      queriesWarmed: this.activeSession.queriesWarmed,
      totalQueries: this.activeSession.queriesWarmed + this.activeSession.queriesFailed,
      currentStrategy: strategy,
      startTime: this.activeSession.startTime,
      currentHitRate: this.getCurrentHitRate(),
    };

    this.activeSession.progressSnapshots.push(progressData);

    // Call progress callback if provided
    if (this.config.progressCallback) {
      this.config.progressCallback(progressData);
    }
  }

  /**
   * Get current cache hit rate
   *
   * @returns Current hit rate (0-1)
   */
  private getCurrentHitRate(): number {
    const stats = this.cache.getStats();
    return stats.hitRate;
  }

  /**
   * Get memory usage of cache
   *
   * @returns Memory usage in bytes
   */
  private getMemoryUsage(): number {
    // Estimate memory usage
    // In a real implementation, this would use actual memory metrics
    const stats = this.cache.getStats();
    const avgEntrySize = 1024; // 1KB per entry estimate
    return stats.size * avgEntrySize;
  }

  /**
   * Calculate effectiveness score
   *
   * @param hitRate - Final hit rate
   * @param duration - Warmup duration
   * @param memoryUsage - Memory usage
   * @returns Effectiveness score (0-1)
   */
  private calculateEffectivenessScore(
    hitRate: number,
    duration: number,
    memoryUsage: number
  ): number {
    const targetHitRate = this.config.targetHitRate ?? 0.6;
    const targetDuration = 30000; // 30 seconds
    const targetMemory = this.config.targetMemoryUsage ?? 524288000; // 500MB

    const hitRateScore = Math.min(hitRate / targetHitRate, 1.0);
    const durationScore = Math.min(targetDuration / duration, 1.0);
    const memoryScore = Math.min(targetMemory / memoryUsage, 1.0);

    return hitRateScore * 0.5 + durationScore * 0.3 + memoryScore * 0.2;
  }

  /**
   * Abort warming operation
   */
  abort(): void {
    this.abortController?.abort();
  }

  /**
   * Check if warming is in progress
   */
  isWarming(): boolean {
    return this.activeSession !== null;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get pattern learner instance
   */
  getPatternLearner(): PatternLearner {
    return this.patternLearner;
  }
}

/**
 * Default static seed queries
 */
export function getDefaultStaticQueries(): string[] {
  return [
    // Programming (20%)
    "What is JavaScript?",
    "How do I write a for loop?",
    "Explain recursion",
    "What is a closure?",
    "How do I parse JSON?",
    "What is async/await?",
    "Explain map, filter, reduce",
    "How do I handle errors?",
    "What is TypeScript?",
    "How do I debug code?",

    // General Knowledge (30%)
    "What is the capital of France?",
    "Who wrote Romeo and Juliet?",
    "What is the speed of light?",
    "What is the largest ocean?",
    "Who painted the Mona Lisa?",
    "What is photosynthesis?",
    "Who was the first person on the moon?",
    "What is the currency of Japan?",
    "What is the tallest mountain?",
    "What is the chemical symbol for gold?",

    // How-To (25%)
    "How do I bake a cake?",
    "How do I change a tire?",
    "How do I tie a tie?",
    "How do I write a resume?",
    "How do I create a website?",
    "How do I learn a new language?",
    "How do I take a screenshot?",
    "How do I backup my computer?",
    "How do I meditate?",
    "How do I make coffee?",

    // Comparison (15%)
    "Python vs JavaScript?",
    "Mac vs PC?",
    "iOS vs Android?",
    "SQL vs NoSQL?",
    "React vs Angular?",
    "Git vs SVN?",
    "REST vs GraphQL?",
    "Vue vs React?",

    // Debugging (10%)
    "Why is my code not working?",
    "How do I fix a syntax error?",
    "What does null pointer exception mean?",
    "Why is my program slow?",
    "What does 404 error mean?",
  ];
}

/**
 * Default warming configuration
 */
export function getDefaultWarmingConfig(): CacheWarmingConfig {
  return {
    strategies: [
      {
        type: "static",
        priority: 1,
        config: {
          seedQueries: getDefaultStaticQueries(),
          categories: {
            programming: 0.2,
            general: 0.3,
            "how-to": 0.25,
            comparison: 0.15,
            debugging: 0.1,
          },
        },
      },
    ],
    enableProgressTracking: true,
    batchSize: 10,
    delayBetweenBatches: 100,
    maxWarmupTime: 30000,
    targetHitRate: 0.6,
    targetMemoryUsage: 524288000, // 500MB
    enableAdaptive: false,
    enablePatternLearning: true,
  };
}

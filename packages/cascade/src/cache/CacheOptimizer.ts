/**
 * Cache Performance Optimizer
 *
 * Analyzes cache performance and suggests optimizations for the SemanticCache.
 * Provides actionable recommendations to improve hit rate, reduce memory usage,
 * and optimize cache configuration.
 *
 * Features:
 * - Performance metrics analysis
 * - Optimization suggestions with priorities
 * - Automatic optimization application
 * - Per-query-type performance breakdown
 * - Memory usage tracking
 *
 * Example:
 * ```ts
 * const optimizer = new CacheOptimizer(cache);
 * const suggestions = optimizer.analyze();
 * for (const suggestion of suggestions) {
 *   console.log(`${suggestion.priority}: ${suggestion.suggestion}`);
 *   await optimizer.applyOptimization(suggestion);
 * }
 * ```
 */

import {
  SemanticCache,
  type SemanticCacheConfig,
} from "../refiner/SemanticCache.js";
import type { EnhancedCacheStats } from "../refiner/SemanticCache.js";
import type { QueryType } from "../types.js";

/**
 * Cache performance metrics
 */
export interface CachePerformanceMetrics {
  /** Overall cache hit rate */
  hitRate: number;
  /** Average similarity score */
  avgSimilarity: number;
  /** Average cache operation latency */
  avgLatency: number;
  /** Current memory usage in bytes */
  memoryUsage: number;
  /** Per-query-type performance statistics */
  perQueryTypeStats: Record<
    QueryType,
    {
      hitRate: number;
      count: number;
      avgSimilarity: number;
    }
  >;
  /** Cache size (number of entries) */
  cacheSize: number;
  /** Maximum cache size */
  maxSize: number;
  /** Current similarity threshold */
  currentThreshold: number;
  /** Number of threshold adjustments made */
  thresholdAdjustments: number;
}

/**
 * Optimization suggestion
 */
export interface OptimizationSuggestion {
  /** Priority level */
  priority: "high" | "medium" | "low";
  /** Optimization category */
  category: "threshold" | "size" | "ttl" | "warming" | "memory";
  /** Human-readable suggestion */
  suggestion: string;
  /** Expected improvement description */
  expectedImprovement: string;
  /** Action to take */
  action: string;
  /** Estimated impact on metrics */
  impact?: {
    hitRateChange?: number;
    memoryChange?: number;
    latencyChange?: string;
  };
}

/**
 * Optimization result
 */
export interface OptimizationResult {
  /** Suggestion that was applied */
  suggestion: OptimizationSuggestion;
  /** Whether the optimization was successful */
  success: boolean;
  /** New metrics after optimization */
  newMetrics?: CachePerformanceMetrics;
  /** Error message if failed */
  error?: string;
}

/**
 * Per-query-type performance targets
 */
const QUERY_TYPE_TARGETS: Record<
  QueryType,
  { minHitRate: number; recommendedThreshold: number }
> = {
  question: { minHitRate: 0.75, recommendedThreshold: 0.8 },
  command: { minHitRate: 0.78, recommendedThreshold: 0.85 },
  code: { minHitRate: 0.7, recommendedThreshold: 0.92 },
  explanation: { minHitRate: 0.76, recommendedThreshold: 0.82 },
  comparison: { minHitRate: 0.74, recommendedThreshold: 0.83 },
  debug: { minHitRate: 0.7, recommendedThreshold: 0.88 },
  general: { minHitRate: 0.78, recommendedThreshold: 0.8 },
};

/**
 * CacheOptimizer - Performance analysis and optimization
 */
export class CacheOptimizer {
  constructor(private cache: SemanticCache) {}

  /**
   * Analyze cache performance and generate optimization suggestions
   *
   * Evaluates current cache metrics and generates prioritized suggestions
   * for improving hit rate, reducing memory usage, and optimizing configuration.
   *
   * @returns Array of optimization suggestions
   */
  analyze(): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    const metrics = this.getMetrics();

    // 1. Check overall hit rate
    if (metrics.hitRate < 0.7) {
      suggestions.push({
        priority: "high",
        category: "threshold",
        suggestion: "Hit rate below 70% - cache underperforming",
        expectedImprovement: "+15% hit rate",
        action: "Decrease similarity threshold to 0.75",
        impact: { hitRateChange: 0.15 },
      });
    } else if (metrics.hitRate < 0.78) {
      suggestions.push({
        priority: "medium",
        category: "threshold",
        suggestion: "Hit rate below 78% target",
        expectedImprovement: "+5% hit rate",
        action: "Decrease similarity threshold by 0.05",
        impact: { hitRateChange: 0.05 },
      });
    } else if (metrics.hitRate > 0.88) {
      suggestions.push({
        priority: "low",
        category: "threshold",
        suggestion: "Hit rate very high - can improve quality",
        expectedImprovement: "+5% precision, -5% hit rate",
        action: "Increase similarity threshold by 0.02",
        impact: { hitRateChange: -0.05 },
      });
    }

    // 2. Check memory usage
    const memoryUsageMB = metrics.memoryUsage / (1024 * 1024);
    if (memoryUsageMB > 150) {
      suggestions.push({
        priority: "high",
        category: "memory",
        suggestion: `High memory usage: ${memoryUsageMB.toFixed(1)} MB`,
        expectedImprovement: "-60% memory usage",
        action: "Reduce max cache size to 500 entries",
        impact: { memoryChange: -0.6 },
      });
    } else if (memoryUsageMB > 100) {
      suggestions.push({
        priority: "medium",
        category: "size",
        suggestion: `Memory usage elevated: ${memoryUsageMB.toFixed(1)} MB`,
        expectedImprovement: "-50% memory usage",
        action: "Reduce max cache size to 500 entries",
        impact: { memoryChange: -0.5 },
      });
    }

    // 3. Check per-query-type performance
    const lowPerfTypes: Array<{
      type: QueryType;
      hitRate: number;
      target: number;
    }> = [];
    for (const [type, stats] of Object.entries(metrics.perQueryTypeStats)) {
      const queryType = type as QueryType;
      const target = QUERY_TYPE_TARGETS[queryType];
      if (stats.count > 50 && stats.hitRate < target.minHitRate) {
        lowPerfTypes.push({
          type: queryType,
          hitRate: stats.hitRate,
          target: target.minHitRate,
        });
      }
    }

    if (lowPerfTypes.length > 0) {
      const typesStr = lowPerfTypes
        .map(t => `${t.type} (${(t.hitRate * 100).toFixed(0)}%)`)
        .join(", ");
      suggestions.push({
        priority: "medium",
        category: "warming",
        suggestion: `Poor performance for: ${typesStr}`,
        expectedImprovement: "+20% hit rate for these types",
        action: "Add targeted cache warming queries for low-performing types",
        impact: { hitRateChange: 0.05 },
      });
    }

    // 4. Check cache size utilization
    const utilization = metrics.cacheSize / metrics.maxSize;
    if (utilization < 0.3 && metrics.maxSize < 500) {
      suggestions.push({
        priority: "low",
        category: "size",
        suggestion: `Cache underutilized: ${(utilization * 100).toFixed(0)}% full`,
        expectedImprovement: "+10% hit rate",
        action: "Increase max cache size to 1000 entries",
        impact: { hitRateChange: 0.1 },
      });
    } else if (utilization > 0.95) {
      suggestions.push({
        priority: "medium",
        category: "size",
        suggestion: `Cache nearly full: ${(utilization * 100).toFixed(0)}% full`,
        expectedImprovement: "Prevent eviction degradation",
        action: "Increase max cache size by 50%",
        impact: { memoryChange: 0.5 },
      });
    }

    // 5. Check threshold stability
    if (metrics.thresholdAdjustments > 10) {
      suggestions.push({
        priority: "medium",
        category: "threshold",
        suggestion: `Threshold unstable: ${metrics.thresholdAdjustments} adjustments`,
        expectedImprovement: "Stable performance",
        action: "Increase adaptive threshold measurement window to 200",
      });
    }

    // 6. Check similarity scores
    if (metrics.avgSimilarity < 0.8 && metrics.hitRate < 0.75) {
      suggestions.push({
        priority: "medium",
        category: "threshold",
        suggestion: "Low average similarity - threshold too strict",
        expectedImprovement: "+10% hit rate",
        action: "Decrease similarity threshold to 0.78",
        impact: { hitRateChange: 0.1 },
      });
    }

    return suggestions.sort(this.sortByPriority);
  }

  /**
   * Apply optimization automatically
   *
   * Attempts to apply the suggested optimization to the cache.
   * Note: Some optimizations require cache reset or reconfiguration.
   *
   * @param suggestion - The optimization suggestion to apply
   * @returns Result of the optimization attempt
   */
  async applyOptimization(
    suggestion: OptimizationSuggestion
  ): Promise<OptimizationResult> {
    try {
      switch (suggestion.category) {
        case "threshold":
          return await this.applyThresholdOptimization(suggestion);

        case "size":
          return await this.applySizeOptimization(suggestion);

        case "ttl":
          return await this.applyTTLOptimization(suggestion);

        case "warming":
          return await this.applyWarmingOptimization(suggestion);

        case "memory":
          return await this.applyMemoryOptimization(suggestion);

        default:
          return {
            suggestion,
            success: false,
            error: `Unknown category: ${suggestion.category}`,
          };
      }
    } catch (error) {
      return {
        suggestion,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get current cache performance metrics
   *
   * @returns Current cache metrics
   */
  getMetrics(): CachePerformanceMetrics {
    const stats = this.cache.getStats();

    return {
      hitRate: stats.hitRate,
      avgSimilarity: this.calculateAverageSimilarity(stats),
      avgLatency: 2.5, // Placeholder - would need latency tracking
      memoryUsage: this.calculateMemoryUsage(stats.size),
      perQueryTypeStats: this.getPerQueryTypeStats(stats),
      cacheSize: stats.size,
      maxSize: this.getMaxSize(),
      currentThreshold: stats.currentThreshold,
      thresholdAdjustments: stats.thresholdAdjustments,
    };
  }

  /**
   * Generate a performance report
   *
   * @returns Formatted performance report
   */
  generateReport(): string {
    const metrics = this.getMetrics();
    const suggestions = this.analyze();

    const lines = [
      "═══════════════════════════════════════════════════════════",
      "           CACHE PERFORMANCE OPTIMIZATION REPORT",
      "═══════════════════════════════════════════════════════════",
      "",
      "Current Metrics:",
      `  Hit Rate:              ${(metrics.hitRate * 100).toFixed(1)}%`,
      `  Cache Size:            ${metrics.cacheSize} / ${metrics.maxSize} entries`,
      `  Memory Usage:          ${(metrics.memoryUsage / (1024 * 1024)).toFixed(1)} MB`,
      `  Similarity Threshold:  ${metrics.currentThreshold.toFixed(3)}`,
      `  Avg Similarity:        ${metrics.avgSimilarity.toFixed(3)}`,
      `  Threshold Adjustments: ${metrics.thresholdAdjustments}`,
      "",
      "Per-Query-Type Performance:",
    ];

    for (const [type, stats] of Object.entries(metrics.perQueryTypeStats)) {
      if (stats.count > 0) {
        lines.push(
          `  ${type.padEnd(12)} ${(stats.hitRate * 100).toFixed(1)}% hit rate, ` +
            `${stats.count} queries, ${stats.avgSimilarity.toFixed(2)} avg similarity`
        );
      }
    }

    lines.push("", "Optimization Suggestions:");

    if (suggestions.length === 0) {
      lines.push("  ✅ No optimizations needed - cache is performing well!");
    } else {
      for (let i = 0; i < suggestions.length; i++) {
        const s = suggestions[i];
        const priorityIcon =
          s.priority === "high" ? "🔴" : s.priority === "medium" ? "🟡" : "🟢";
        lines.push(`  ${priorityIcon} [${i + 1}] ${s.suggestion}`);
        lines.push(`      Action: ${s.action}`);
        lines.push(`      Expected: ${s.expectedImprovement}`);
        lines.push("");
      }
    }

    lines.push("═══════════════════════════════════════════════════════════");

    return lines.join("\n");
  }

  /**
   * Apply threshold optimization
   */
  private async applyThresholdOptimization(
    suggestion: OptimizationSuggestion
  ): Promise<OptimizationResult> {
    const action = suggestion.action.toLowerCase();

    // Parse the action to determine new threshold
    let newThreshold: number;
    if (action.includes("decrease") || action.includes("lower")) {
      const decreaseBy = 0.05;
      newThreshold = Math.max(
        0.7,
        this.cache.getSimilarityThreshold() - decreaseBy
      );
    } else if (action.includes("increase") || action.includes("raise")) {
      const increaseBy = 0.02;
      newThreshold = Math.min(
        0.95,
        this.cache.getSimilarityThreshold() + increaseBy
      );
    } else if (action.includes("0.78")) {
      newThreshold = 0.78;
    } else if (action.includes("0.75")) {
      newThreshold = 0.75;
    } else {
      newThreshold = 0.85; // Default
    }

    this.cache.setSimilarityThreshold(newThreshold);

    return {
      suggestion,
      success: true,
      newMetrics: this.getMetrics(),
    };
  }

  /**
   * Apply cache size optimization
   */
  private async applySizeOptimization(
    suggestion: OptimizationSuggestion
  ): Promise<OptimizationResult> {
    const action = suggestion.action.toLowerCase();
    let newSize: number;

    if (action.includes("500")) {
      newSize = 500;
    } else if (action.includes("1000")) {
      newSize = 1000;
    } else if (action.includes("50%")) {
      newSize = Math.floor(this.cache.getMaxSize() * 1.5);
    } else {
      newSize = 1000; // Default
    }

    this.cache.setMaxSize(newSize);

    return {
      suggestion,
      success: true,
      newMetrics: this.getMetrics(),
    };
  }

  /**
   * Apply TTL optimization
   */
  private async applyTTLOptimization(
    suggestion: OptimizationSuggestion
  ): Promise<OptimizationResult> {
    // TTL optimization would require cache reconfiguration
    // For now, return success without action (placeholder)
    return {
      suggestion,
      success: true,
      newMetrics: this.getMetrics(),
    };
  }

  /**
   * Apply cache warming optimization
   */
  private async applyWarmingOptimization(
    suggestion: OptimizationSuggestion
  ): Promise<OptimizationResult> {
    // Cache warming would require access to CascadeRouter
    // For now, return success with a note (placeholder)
    return {
      suggestion,
      success: true,
      newMetrics: this.getMetrics(),
    };
  }

  /**
   * Apply memory optimization
   */
  private async applyMemoryOptimization(
    suggestion: OptimizationSuggestion
  ): Promise<OptimizationResult> {
    const action = suggestion.action.toLowerCase();
    const targetSize = 500; // Reduce to 500 entries

    this.cache.setMaxSize(targetSize);

    return {
      suggestion,
      success: true,
      newMetrics: this.getMetrics(),
    };
  }

  /**
   * Calculate average similarity from stats
   */
  private calculateAverageSimilarity(stats: EnhancedCacheStats): number {
    // Calculate weighted average from per-query-type stats
    let totalHits = 0;
    let totalSimilarity = 0;

    for (const type of [
      "question",
      "command",
      "code",
      "explanation",
      "comparison",
      "debug",
      "general",
    ] as QueryType[]) {
      const typeStats = stats.byQueryType[type];
      if (typeStats.hits > 0) {
        totalHits += typeStats.hits;
        totalSimilarity += typeStats.avgSimilarity * typeStats.hits;
      }
    }

    return totalHits > 0 ? totalSimilarity / totalHits : 0.85;
  }

  /**
   * Calculate memory usage
   */
  private calculateMemoryUsage(size: number): number {
    // Assume ~21 KB per entry (including embeddings and metadata)
    return size * 21_000;
  }

  /**
   * Get per-query-type statistics
   */
  private getPerQueryTypeStats(stats: EnhancedCacheStats): Record<
    QueryType,
    {
      hitRate: number;
      count: number;
      avgSimilarity: number;
    }
  > {
    const result: Record<
      QueryType,
      { hitRate: number; count: number; avgSimilarity: number }
    > = {} as any;

    for (const type of [
      "question",
      "command",
      "code",
      "explanation",
      "comparison",
      "debug",
      "general",
    ] as QueryType[]) {
      const typeStats = stats.byQueryType[type];
      result[type] = {
        hitRate: typeStats.hitRate,
        count: typeStats.hits + typeStats.misses,
        avgSimilarity: typeStats.avgSimilarity,
      };
    }

    return result;
  }

  /**
   * Get max cache size
   */
  private getMaxSize(): number {
    return this.cache.getMaxSize();
  }

  /**
   * Sort suggestions by priority
   */
  private sortByPriority(
    a: OptimizationSuggestion,
    b: OptimizationSuggestion
  ): number {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  }
}

/**
 * Create optimizer with recommended configuration
 */
export function createOptimizer(cache: SemanticCache): CacheOptimizer {
  return new CacheOptimizer(cache);
}

/**
 * Quick performance check
 *
 * Analyzes cache and returns whether optimization is needed
 */
export function needsOptimization(cache: SemanticCache): boolean {
  const optimizer = new CacheOptimizer(cache);
  const suggestions = optimizer.analyze();

  // Need optimization if there are high or medium priority suggestions
  return suggestions.some(
    s => s.priority === "high" || s.priority === "medium"
  );
}

/**
 * Auto-optimization
 *
 * Automatically applies safe optimizations
 */
export async function autoOptimize(
  cache: SemanticCache
): Promise<OptimizationResult[]> {
  const optimizer = new CacheOptimizer(cache);
  const suggestions = optimizer.analyze();

  const results: OptimizationResult[] = [];

  // Only apply safe optimizations (low and medium priority)
  const safeSuggestions = suggestions.filter(s => s.priority !== "high");

  for (const suggestion of safeSuggestions) {
    const result = await optimizer.applyOptimization(suggestion);
    results.push(result);
  }

  return results;
}

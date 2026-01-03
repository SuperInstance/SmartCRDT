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
import { SemanticCache } from "../refiner/SemanticCache.js";
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
    perQueryTypeStats: Record<QueryType, {
        hitRate: number;
        count: number;
        avgSimilarity: number;
    }>;
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
 * CacheOptimizer - Performance analysis and optimization
 */
export declare class CacheOptimizer {
    private cache;
    constructor(cache: SemanticCache);
    /**
     * Analyze cache performance and generate optimization suggestions
     *
     * Evaluates current cache metrics and generates prioritized suggestions
     * for improving hit rate, reducing memory usage, and optimizing configuration.
     *
     * @returns Array of optimization suggestions
     */
    analyze(): OptimizationSuggestion[];
    /**
     * Apply optimization automatically
     *
     * Attempts to apply the suggested optimization to the cache.
     * Note: Some optimizations require cache reset or reconfiguration.
     *
     * @param suggestion - The optimization suggestion to apply
     * @returns Result of the optimization attempt
     */
    applyOptimization(suggestion: OptimizationSuggestion): Promise<OptimizationResult>;
    /**
     * Get current cache performance metrics
     *
     * @returns Current cache metrics
     */
    getMetrics(): CachePerformanceMetrics;
    /**
     * Generate a performance report
     *
     * @returns Formatted performance report
     */
    generateReport(): string;
    /**
     * Apply threshold optimization
     */
    private applyThresholdOptimization;
    /**
     * Apply cache size optimization
     */
    private applySizeOptimization;
    /**
     * Apply TTL optimization
     */
    private applyTTLOptimization;
    /**
     * Apply cache warming optimization
     */
    private applyWarmingOptimization;
    /**
     * Apply memory optimization
     */
    private applyMemoryOptimization;
    /**
     * Calculate average similarity from stats
     */
    private calculateAverageSimilarity;
    /**
     * Calculate memory usage
     */
    private calculateMemoryUsage;
    /**
     * Get per-query-type statistics
     */
    private getPerQueryTypeStats;
    /**
     * Get max cache size
     */
    private getMaxSize;
    /**
     * Sort suggestions by priority
     */
    private sortByPriority;
}
/**
 * Create optimizer with recommended configuration
 */
export declare function createOptimizer(cache: SemanticCache): CacheOptimizer;
/**
 * Quick performance check
 *
 * Analyzes cache and returns whether optimization is needed
 */
export declare function needsOptimization(cache: SemanticCache): boolean;
/**
 * Auto-optimization
 *
 * Automatically applies safe optimizations
 */
export declare function autoOptimize(cache: SemanticCache): Promise<OptimizationResult[]>;
//# sourceMappingURL=CacheOptimizer.d.ts.map
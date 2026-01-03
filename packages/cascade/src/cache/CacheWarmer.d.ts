/**
 * Cache Warmer - Pre-populate cache with common queries
 *
 * Cache warming improves cold-start performance by pre-loading
 * the cache with expected common queries. This reduces initial
 * cache misses and improves perceived performance.
 *
 * Features:
 * - Batch processing with configurable sizes
 * - Delay between batches to avoid overwhelming the system
 * - Error handling and reporting
 * - Default common query sets by category
 *
 * Example:
 * ```ts
 * const warmer = new CacheWarmer(router, {
 *   commonQueries: CacheWarmer.getDefaultCommonQueries(),
 *   batchSize: 10,
 *   delayBetweenBatches: 100,
 * });
 * const result = await warmer.warm();
 * console.log(`Warmed ${result.successful} queries in ${result.duration}ms`);
 * ```
 */
import { CascadeRouter } from "../router/CascadeRouter.js";
import type { QueryContext } from "../types.js";
/**
 * Cache warmer configuration
 */
export interface CacheWarmerConfig {
    /** Common queries to warm the cache with */
    commonQueries: string[];
    /** Number of queries to process per batch */
    batchSize?: number;
    /** Delay between batches in milliseconds */
    delayBetweenBatches?: number;
    /** Optional context for routing */
    context?: QueryContext;
}
/**
 * Cache warming result
 */
export interface CacheWarmingResult {
    /** Number of successfully warmed queries */
    successful: number;
    /** Number of failed queries */
    failed: number;
    /** Total duration in milliseconds */
    duration: number;
    /** Queries that failed (if any) */
    failedQueries?: Array<{
        query: string;
        error: string;
    }>;
}
/**
 * CacheWarmer - Pre-populate cache with common queries
 */
export declare class CacheWarmer {
    private router;
    private config;
    constructor(router: CascadeRouter, config: CacheWarmerConfig);
    /**
     * Warm cache with common queries
     *
     * Processes queries in batches with delays between batches
     * to avoid overwhelming the system. Returns statistics
     * about the warming process.
     *
     * @returns Cache warming statistics
     */
    warm(): Promise<CacheWarmingResult>;
    /**
     * Warm cache progressively in background
     *
     * Starts warming without blocking. Useful for startup initialization.
     * Returns a promise that resolves when warming is complete.
     *
     * @returns Promise that resolves when warming is complete
     */
    warmInBackground(): Promise<CacheWarmingResult>;
    /**
     * Get default common queries for warming
     *
     * Returns a curated list of common queries across different
     * categories: programming, general knowledge, how-to questions,
     * and debugging scenarios.
     *
     * @returns Default common queries array
     */
    static getDefaultCommonQueries(): string[];
    /**
     * Get programming-specific queries for warming
     *
     * Returns queries focused on programming and software development.
     *
     * @returns Programming queries array
     */
    static getProgrammingQueries(): string[];
    /**
     * Get general knowledge queries for warming
     *
     * Returns queries focused on general knowledge and facts.
     *
     * @returns General knowledge queries array
     */
    static getGeneralKnowledgeQueries(): string[];
    /**
     * Delay helper
     */
    private delay;
}
/**
 * Get common queries for cache warming
 * Alias for getDefaultCommonQueries for easier import
 */
export declare function getCommonQueries(): string[];
/**
 * Default configuration
 */
export declare const DEFAULT_CACHE_WARMER_CONFIG: Partial<CacheWarmerConfig>;
//# sourceMappingURL=CacheWarmer.d.ts.map
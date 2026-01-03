/**
 * @lsi/cascade - Preference Pair Generator for ORPO Training
 *
 * Generates preference pairs from shadow logs for ORPO (Odds Ratio Preference Optimization) training.
 *
 * Format: (query, chosen, rejected)
 * - chosen: Better response (higher quality, lower cost, lower latency)
 * - rejected: Worse response (lower quality, higher cost, higher latency)
 *
 * The generator analyzes shadow logs to find queries with multiple responses,
 * scores each response based on quality, cost, and latency, and generates
 * preference pairs where the "chosen" response is superior to the "rejected".
 *
 * Usage:
 * ```typescript
 * const generator = new PreferencePairGenerator({
 *   qualityWeight: 1.0,
 *   costWeight: 0.1,
 *   latencyWeight: 0.01,
 *   cacheBonusWeight: 0.05,
 *   minScoreDifference: 0.1,
 * });
 * const pairs = generator.generateFromLogs(shadowLogs);
 * const orpoData = generator.exportForORPO(pairs);
 * ```
 */
import { ShadowLogEntry } from "./ShadowLogger.js";
/**
 * Preference pair for ORPO training
 *
 * Represents a comparison between two responses to the same query,
 * where one is preferred over the other.
 */
export interface PreferencePair {
    /** Original query (may be redacted) */
    query: string;
    /** Better response (chosen) */
    chosen: string;
    /** Worse response (rejected) */
    rejected: string;
    /** Metadata for chosen response */
    chosenMetadata: {
        model: string;
        cost: number;
        latency: number;
        quality: number;
        backend: "local" | "cloud";
        score: number;
    };
    /** Metadata for rejected response */
    rejectedMetadata: {
        model: string;
        cost: number;
        latency: number;
        quality: number;
        backend: "local" | "cloud";
        score: number;
    };
    /** Why this pair was chosen */
    reason: string;
}
/**
 * Scoring configuration for preference pair generation
 */
export interface ScoringConfig {
    /** Weight for quality score (higher is better) */
    qualityWeight: number;
    /** Weight for cost penalty (lower is better) */
    costWeight: number;
    /** Weight for latency penalty (lower is better) */
    latencyWeight: number;
    /** Bonus for cached responses */
    cacheBonusWeight: number;
    /** Minimum score difference to create a pair */
    minScoreDifference: number;
}
/**
 * PreferencePairGenerator - Generate ORPO training data from shadow logs
 *
 * Analyzes shadow logs to create preference pairs for training.
 * The scoring balances:
 * - Quality (higher is better)
 * - Cost (lower is better)
 * - Latency (lower is better)
 * - Cache bonus (cached responses are faster)
 */
export declare class PreferencePairGenerator {
    private config;
    /**
     * Create a new PreferencePairGenerator
     *
     * @param config - Optional scoring configuration
     */
    constructor(config?: Partial<ScoringConfig>);
    /**
     * Generate preference pairs from shadow logs
     *
     * Groups logs by query, scores each response, and creates
     * preference pairs by comparing the best and worst responses.
     *
     * @param logs - Shadow log entries
     * @returns Array of preference pairs
     */
    generateFromLogs(logs: ShadowLogEntry[]): PreferencePair[];
    /**
     * Group shadow logs by normalized query
     *
     * Normalizes queries to group semantically similar queries together.
     * Removes punctuation, converts to lowercase, and normalizes whitespace.
     *
     * @param logs - Shadow log entries
     * @returns Map of normalized query to log entries
     */
    private groupByQuery;
    /**
     * Normalize query text for grouping
     *
     * - Convert to lowercase
     * - Remove punctuation
     * - Normalize whitespace
     * - Remove common stopwords
     *
     * @param query - Original query
     * @returns Normalized query
     */
    private normalizeQuery;
    /**
     * Calculate score for a shadow log entry
     *
     * Score = quality - (cost * costWeight) - (latency * latencyWeight) + cacheBonus
     *
     * Higher scores indicate better responses.
     * Quality is estimated from metadata or defaults to 0.5.
     *
     * @param entry - Shadow log entry
     * @returns Score breakdown
     */
    private calculateScore;
    /**
     * Generate human-readable reason for preference
     *
     * @param chosenScore - Score of chosen response
     * @param rejectedScore - Score of rejected response
     * @returns Explanation of why chosen was preferred
     */
    private generateReason;
    /**
     * Export preference pairs in ORPO format
     *
     * Converts preference pairs to JSONL format for ORPO training.
     * Each line is a JSON object with: prompt, chosen, rejected
     *
     * @param pairs - Preference pairs
     * @returns JSONL-formatted string
     */
    exportForORPO(pairs: PreferencePair[]): string;
    /**
     * Export preference pairs with metadata
     *
     * Includes full metadata for analysis and debugging.
     *
     * @param pairs - Preference pairs
     * @returns JSONL-formatted string with metadata
     */
    exportWithMetadata(pairs: PreferencePair[]): string;
    /**
     * Calculate statistics about preference pairs
     *
     * @param pairs - Preference pairs
     * @returns Statistics object
     */
    calculateStats(pairs: PreferencePair[]): {
        total: number;
        avgChosenQuality: number;
        avgRejectedQuality: number;
        avgScoreDifference: number;
        backendDistribution: {
            local: number;
            cloud: number;
        };
    };
    /**
     * Filter preference pairs by quality threshold
     *
     * Only includes pairs where the chosen response has a minimum quality score.
     *
     * @param pairs - Preference pairs
     * @param minQuality - Minimum quality threshold (0-1)
     * @returns Filtered preference pairs
     */
    filterByQuality(pairs: PreferencePair[], minQuality: number): PreferencePair[];
    /**
     * Filter preference pairs by cost difference
     *
     * Only includes pairs where there's a significant cost difference.
     *
     * @param pairs - Preference pairs
     * @param minDiff - Minimum cost difference
     * @returns Filtered preference pairs
     */
    filterByCostDifference(pairs: PreferencePair[], minDiff: number): PreferencePair[];
    /**
     * Balance preference pairs by backend
     *
     * Ensures roughly equal representation of local and cloud chosen responses.
     * If only one backend is present, returns all pairs.
     *
     * @param pairs - Preference pairs
     * @returns Balanced preference pairs
     */
    balanceByBackend(pairs: PreferencePair[]): PreferencePair[];
}
/**
 * Convenience function to create preference pairs from logs
 *
 * @param logs - Shadow log entries
 * @returns Array of preference pairs
 */
export declare function generatePreferencePairs(logs: ShadowLogEntry[]): PreferencePair[];
/**
 * Convenience function to export pairs in ORPO format
 *
 * @param pairs - Preference pairs
 * @returns JSONL-formatted string
 */
export declare function exportForORPO(pairs: PreferencePair[]): string;
//# sourceMappingURL=PreferencePairGenerator.d.ts.map
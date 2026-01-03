/**
 * QuickFlowRouter - Fast-path routing for low-volume scenarios
 *
 * Optimized for minimal overhead in the Quick Flow tier (< 10 RPM).
 * Skips complexity analysis, emotional intelligence, and caching.
 * Direct routing decision based on simple heuristics.
 *
 * Features:
 * - Ultra-low latency routing (< 20ms overhead)
 * - Simple local vs cloud decision
 * - No cache writes (read-only optional)
 * - Minimal logging
 * - Prefers local models
 *
 * Example:
 * ```ts
 * const router = new QuickFlowRouter();
 * const decision = await router.route(query);
 * // Fast decision: local or cloud based on query length
 * ```
 */
import type { TierRouter, RoutingDecision } from "./types.js";
interface QuickFlowStats extends Record<string, unknown> {
    totalRequests: number;
    localRequests: number;
    cloudRequests: number;
    averageLatency: number;
}
/**
 * QuickFlowRouter - Minimal overhead fast-path router
 */
export declare class QuickFlowRouter implements TierRouter {
    private stats;
    /**
     * Route a request using fast-path logic
     *
     * Decision criteria:
     * - Query length < 100 chars → local
     * - Query length >= 100 chars → cloud
     * - No complexity analysis
     * - No emotional intelligence
     * - No caching writes
     */
    route(request: string, context?: Record<string, unknown>): Promise<RoutingDecision>;
    /**
     * Check if this router can handle the request
     * Quick flow can handle any request (it's the fallback)
     */
    canHandle(request: string): boolean;
    /**
     * Get estimated latency for this router
     */
    getEstimatedLatency(): number;
    /**
     * Get router statistics
     */
    getStats(): QuickFlowStats;
    /**
     * Update average latency
     */
    private updateAverageLatency;
    /**
     * Reset statistics
     */
    resetStats(): void;
}
export {};
//# sourceMappingURL=QuickFlowRouter.d.ts.map
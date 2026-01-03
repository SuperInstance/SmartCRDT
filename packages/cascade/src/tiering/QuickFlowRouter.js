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
/**
 * QuickFlowRouter - Minimal overhead fast-path router
 */
export class QuickFlowRouter {
    stats = {
        totalRequests: 0,
        localRequests: 0,
        cloudRequests: 0,
        averageLatency: 0,
    };
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
    async route(request, context) {
        const startTime = performance.now();
        this.stats.totalRequests++;
        // Simple heuristic based on query length
        const isLocal = request.length < 100;
        if (isLocal) {
            this.stats.localRequests++;
            const latency = performance.now() - startTime;
            this.updateAverageLatency(latency);
            return {
                route: "local",
                confidence: 0.8,
                estimatedLatency: 20,
                estimatedCost: 0,
                tier: "quick",
                preferLocal: true,
                skipRefinement: true,
                notes: ["Quick Flow: Short query - using local model"],
            };
        }
        else {
            this.stats.cloudRequests++;
            const latency = performance.now() - startTime;
            this.updateAverageLatency(latency);
            return {
                route: "cloud",
                confidence: 0.7,
                estimatedLatency: 200,
                estimatedCost: 0.01,
                tier: "quick",
                notes: ["Quick Flow: Longer query - using cloud model"],
            };
        }
    }
    /**
     * Check if this router can handle the request
     * Quick flow can handle any request (it's the fallback)
     */
    canHandle(request) {
        return true;
    }
    /**
     * Get estimated latency for this router
     */
    getEstimatedLatency() {
        return 20; // Sub-20ms overhead
    }
    /**
     * Get router statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Update average latency
     */
    updateAverageLatency(newLatency) {
        const count = this.stats.totalRequests;
        this.stats.averageLatency =
            (this.stats.averageLatency * (count - 1) + newLatency) / count;
    }
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalRequests: 0,
            localRequests: 0,
            cloudRequests: 0,
            averageLatency: 0,
        };
    }
}
//# sourceMappingURL=QuickFlowRouter.js.map
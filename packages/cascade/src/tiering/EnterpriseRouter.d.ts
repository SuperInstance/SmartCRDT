/**
 * EnterpriseRouter - Advanced routing for high-volume scenarios
 *
 * Handles high-volume scenarios with advanced features like:
 * - Priority queue management
 * - Batch processing
 * - Full CascadeRouter functionality
 * - Advanced caching strategies
 * - Custom routing rules
 *
 * Example:
 * ```ts
 * const router = new EnterpriseRouter(cascadeRouter);
 * const decision = await router.routeWithQueue(request, 'high');
 * ```
 */
import type { TierRouter, RoutingDecision, PriorityLevel } from "./types.js";
import type { RouteDecision, QueryContext } from "../types.js";
import { RequestQueue } from "./RequestQueue.js";
import { CascadeRouter } from "../router/CascadeRouter.js";
interface EnterpriseRouterConfig {
    maxQueueSize?: number;
    enableBatching?: boolean;
    batchSize?: number;
    batchTimeout?: number;
    enablePrefetch?: boolean;
    customRules?: RoutingRule[];
}
interface RoutingRule {
    name: string;
    condition: (request: string, context?: QueryContext) => boolean;
    action: Partial<RouteDecision>;
}
/**
 * EnterpriseRouter - High-volume advanced routing
 */
export declare class EnterpriseRouter implements TierRouter {
    private cascadeRouter;
    private queue;
    private config;
    private batch;
    private batchTimer;
    private processingBatch;
    private stats;
    constructor(cascadeRouter: CascadeRouter, config?: EnterpriseRouterConfig);
    /**
     * Route a request directly (no queuing)
     */
    route(request: string, context?: Record<string, unknown>): Promise<RoutingDecision>;
    /**
     * Route a request with queue support
     *
     * If queue is enabled and the system is under load, the request
     * will be queued. Otherwise, it's processed directly.
     */
    routeWithQueue(request: string, priority?: PriorityLevel, context?: QueryContext): Promise<RoutingDecision>;
    /**
     * Batch multiple requests together for efficiency
     */
    routeBatch(requests: Array<{
        request: string;
        context?: QueryContext;
    }>): Promise<RoutingDecision[]>;
    /**
     * Add request to batch for delayed processing
     */
    addToBatch(request: string, context?: QueryContext): Promise<RoutingDecision>;
    /**
     * Process accumulated batch
     */
    private processBatch;
    /**
     * Apply custom routing rules
     */
    private applyCustomRules;
    /**
     * Check if router can handle request
     */
    canHandle(request: string): boolean;
    /**
     * Get estimated latency
     */
    getEstimatedLatency(): number;
    /**
     * Get router statistics
     */
    getStats(): {
        queueStats: import("./types.js").QueueStats;
        currentBatchSize: number;
        totalRequests: number;
        queuedRequests: number;
        directRequests: number;
        batchProcessed: number;
        averageLatency: number;
        totalLatency: number;
    };
    /**
     * Update average latency
     */
    private updateLatency;
    /**
     * Get queue instance for advanced operations
     */
    getQueue(): RequestQueue;
    /**
     * Process next item from queue
     */
    processNextFromQueue(): Promise<RoutingDecision | null>;
    /**
     * Reset statistics
     */
    resetStats(): void;
    /**
     * Clean up resources
     */
    destroy(): void;
}
/**
 * Default enterprise configuration
 */
export declare const DEFAULT_ENTERPRISE_CONFIG: Required<EnterpriseRouterConfig>;
export {};
//# sourceMappingURL=EnterpriseRouter.d.ts.map
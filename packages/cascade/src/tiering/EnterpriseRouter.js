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
import { RequestQueue } from "./RequestQueue.js";
/**
 * EnterpriseRouter - High-volume advanced routing
 */
export class EnterpriseRouter {
    cascadeRouter;
    queue;
    config;
    batch = [];
    batchTimer = null;
    processingBatch = false;
    // Statistics
    stats = {
        totalRequests: 0,
        queuedRequests: 0,
        directRequests: 0,
        batchProcessed: 0,
        averageLatency: 0,
        totalLatency: 0,
    };
    constructor(cascadeRouter, config = {}) {
        this.cascadeRouter = cascadeRouter;
        this.config = {
            maxQueueSize: config.maxQueueSize ?? 1000,
            enableBatching: config.enableBatching ?? true,
            batchSize: config.batchSize ?? 10,
            batchTimeout: config.batchTimeout ?? 50,
            enablePrefetch: config.enablePrefetch ?? false,
            customRules: config.customRules ?? [],
        };
        this.queue = new RequestQueue(this.config.maxQueueSize);
    }
    /**
     * Route a request directly (no queuing)
     */
    async route(request, context) {
        const startTime = performance.now();
        this.stats.totalRequests++;
        this.stats.directRequests++;
        // Apply custom rules first
        const customDecision = this.applyCustomRules(request, context);
        if (customDecision) {
            const latency = performance.now() - startTime;
            this.updateLatency(latency);
            return {
                ...customDecision,
                tier: "enterprise",
                estimatedLatency: customDecision.estimatedLatency || 100,
            };
        }
        // Use CascadeRouter for full decision
        const decision = await this.cascadeRouter.route(request, context);
        const latency = performance.now() - startTime;
        this.updateLatency(latency);
        return {
            ...decision,
            tier: "enterprise",
            notes: [...(decision.notes || []), "Enterprise: Full routing enabled"],
        };
    }
    /**
     * Route a request with queue support
     *
     * If queue is enabled and the system is under load, the request
     * will be queued. Otherwise, it's processed directly.
     */
    async routeWithQueue(request, priority = "normal", context) {
        const queueStats = this.queue.getStats();
        // If queue is short, process directly
        if (queueStats.length < 5) {
            return this.route(request, context);
        }
        // Otherwise, add to queue
        this.stats.queuedRequests++;
        const result = this.queue.enqueue({
            request,
            priority,
            timestamp: Date.now(),
            sessionId: context?.sessionId,
            userId: context?.userId,
            context: context,
        });
        if (!result.success) {
            // Queue full, process directly
            return this.route(request, context);
        }
        // Wait for queue processing
        return new Promise(resolve => {
            const checkQueue = () => {
                const next = this.queue.peek();
                if (next && next.request === request) {
                    this.queue.dequeue();
                    this.route(request, context).then(resolve);
                }
                else {
                    setTimeout(checkQueue, 10);
                }
            };
            checkQueue();
        });
    }
    /**
     * Batch multiple requests together for efficiency
     */
    async routeBatch(requests) {
        const startTime = performance.now();
        // Process all requests
        const decisions = await Promise.all(requests.map(({ request, context }) => this.route(request, context)));
        const processingTime = performance.now() - startTime;
        this.stats.batchProcessed += requests.length;
        return decisions;
    }
    /**
     * Add request to batch for delayed processing
     */
    async addToBatch(request, context) {
        return new Promise(resolve => {
            this.batch.push({ request, context, resolve });
            // Start batch timer if not already running
            if (!this.batchTimer && !this.processingBatch) {
                this.batchTimer = setTimeout(() => this.processBatch(), this.config.batchTimeout);
            }
            // Process batch if full
            if (this.batch.length >= this.config.batchSize) {
                if (this.batchTimer) {
                    clearTimeout(this.batchTimer);
                    this.batchTimer = null;
                }
                this.processBatch();
            }
        });
    }
    /**
     * Process accumulated batch
     */
    async processBatch() {
        if (this.processingBatch || this.batch.length === 0) {
            return;
        }
        this.processingBatch = true;
        const currentBatch = this.batch.splice(0, this.config.batchSize);
        try {
            const decisions = await this.routeBatch(currentBatch.map(({ request, context }) => ({
                request,
                context: context,
            })));
            // Resolve all promises
            decisions.forEach((decision, i) => {
                currentBatch[i].resolve(decision);
            });
        }
        finally {
            this.processingBatch = false;
            // Start new timer if more items in batch
            if (this.batch.length > 0 && !this.batchTimer) {
                this.batchTimer = setTimeout(() => this.processBatch(), this.config.batchTimeout);
            }
        }
    }
    /**
     * Apply custom routing rules
     */
    applyCustomRules(request, context) {
        for (const rule of this.config.customRules) {
            if (rule.condition(request, context)) {
                return {
                    ...rule.action,
                    tier: "enterprise",
                    notes: [`Applied custom rule: ${rule.name}`],
                };
            }
        }
        return null;
    }
    /**
     * Check if router can handle request
     */
    canHandle(request) {
        return true; // Enterprise router handles everything
    }
    /**
     * Get estimated latency
     */
    getEstimatedLatency() {
        const stats = this.queue.getStats();
        return 100 + stats.estimatedWaitTime; // Base latency + queue wait
    }
    /**
     * Get router statistics
     */
    getStats() {
        return {
            ...this.stats,
            queueStats: this.queue.getStats(),
            currentBatchSize: this.batch.length,
        };
    }
    /**
     * Update average latency
     */
    updateLatency(latency) {
        this.stats.totalLatency += latency;
        this.stats.averageLatency =
            this.stats.totalLatency / this.stats.totalRequests;
    }
    /**
     * Get queue instance for advanced operations
     */
    getQueue() {
        return this.queue;
    }
    /**
     * Process next item from queue
     */
    async processNextFromQueue() {
        const next = this.queue.dequeue();
        if (!next) {
            return null;
        }
        return this.route(next.request, next.context);
    }
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalRequests: 0,
            queuedRequests: 0,
            directRequests: 0,
            batchProcessed: 0,
            averageLatency: 0,
            totalLatency: 0,
        };
    }
    /**
     * Clean up resources
     */
    destroy() {
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }
        this.queue.clear();
    }
}
/**
 * Default enterprise configuration
 */
export const DEFAULT_ENTERPRISE_CONFIG = {
    maxQueueSize: 1000,
    enableBatching: true,
    batchSize: 10,
    batchTimeout: 50,
    enablePrefetch: false,
    customRules: [],
};
//# sourceMappingURL=EnterpriseRouter.js.map
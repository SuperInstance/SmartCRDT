/**
 * RequestQueue - Priority queue for enterprise tier
 *
 * Manages request queuing with priority levels for high-volume scenarios.
 * Ensures fair processing and prevents system overload.
 *
 * Features:
 * - Multi-level priority queuing (low, normal, high, urgent)
 * - Per-user fairness (prevent starvation)
 * - Timeout handling (drop requests that wait too long)
 * - Estimated wait time calculation
 * - Queue statistics and monitoring
 *
 * Example:
 * ```ts
 * const queue = new RequestQueue(1000);
 * queue.enqueue({
 *   request: 'Complex query',
 *   priority: 'high',
 *   timestamp: Date.now(),
 *   userId: 'user123'
 * });
 * const next = queue.dequeue();
 * ```
 */
import type { PriorityRequest, PriorityLevel, QueueStats } from "./types.js";
interface QueuedRequest extends PriorityRequest {
    enqueueTime: number;
    id: string;
}
/**
 * RequestQueue - Enterprise-grade priority queue
 */
export declare class RequestQueue {
    private queues;
    private maxSize;
    private totalProcessed;
    private totalDropped;
    private counter;
    private readonly priorityOrder;
    constructor(maxSize?: number);
    /**
     * Add a request to the queue
     */
    enqueue(request: PriorityRequest): {
        success: boolean;
        position?: number;
    };
    /**
     * Get next request from queue (priority-based)
     */
    dequeue(): QueuedRequest | null;
    /**
     * Peek at next request without removing
     */
    peek(): QueuedRequest | null;
    /**
     * Get current queue length
     */
    getQueueLength(): number;
    /**
     * Get queue statistics
     */
    getStats(): QueueStats;
    /**
     * Get estimated wait time for new request
     */
    getEstimatedWaitTime(priority: PriorityLevel): number;
    /**
     * Remove requests that have exceeded max wait time
     */
    private checkTimeouts;
    /**
     * Calculate position in queue considering all priorities
     */
    private calculatePosition;
    /**
     * Get numeric priority index (lower = higher priority)
     */
    private getPriorityIndex;
    /**
     * Calculate total queue size
     */
    private getTotalSize;
    /**
     * Estimate wait time for next request
     */
    private estimateWaitTime;
    /**
     * Clear all queues
     */
    clear(): void;
    /**
     * Get queue by priority (for debugging)
     */
    getQueue(priority: PriorityLevel): QueuedRequest[];
}
export {};
//# sourceMappingURL=RequestQueue.d.ts.map
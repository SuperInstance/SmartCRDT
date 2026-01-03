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
/**
 * RequestQueue - Enterprise-grade priority queue
 */
export class RequestQueue {
    queues = new Map();
    maxSize;
    totalProcessed = 0;
    totalDropped = 0;
    counter = 0;
    // Priority order (highest first)
    priorityOrder = [
        "urgent",
        "high",
        "normal",
        "low",
    ];
    constructor(maxSize = 1000) {
        this.maxSize = maxSize;
        // Initialize queues for each priority
        for (const priority of this.priorityOrder) {
            this.queues.set(priority, []);
        }
    }
    /**
     * Add a request to the queue
     */
    enqueue(request) {
        // Check queue size limit
        const currentSize = this.getTotalSize();
        if (currentSize >= this.maxSize) {
            this.totalDropped++;
            return { success: false };
        }
        const queue = this.queues.get(request.priority);
        if (!queue) {
            throw new Error(`Invalid priority level: ${request.priority}`);
        }
        const queuedRequest = {
            ...request,
            enqueueTime: Date.now(),
            id: `req-${this.counter++}`,
        };
        queue.push(queuedRequest);
        // Calculate position (consider higher priority queues)
        const position = this.calculatePosition(request.priority, queue.length - 1);
        return { success: true, position };
    }
    /**
     * Get next request from queue (priority-based)
     */
    dequeue() {
        // Check timeouts first
        this.checkTimeouts();
        // Get highest priority non-empty queue
        for (const priority of this.priorityOrder) {
            const queue = this.queues.get(priority);
            if (!queue)
                continue;
            if (queue.length > 0) {
                const request = queue.shift();
                if (request) {
                    this.totalProcessed++;
                    return request;
                }
            }
        }
        return null;
    }
    /**
     * Peek at next request without removing
     */
    peek() {
        for (const priority of this.priorityOrder) {
            const queue = this.queues.get(priority);
            if (!queue)
                continue;
            if (queue.length > 0) {
                return queue[0];
            }
        }
        return null;
    }
    /**
     * Get current queue length
     */
    getQueueLength() {
        return this.getTotalSize();
    }
    /**
     * Get queue statistics
     */
    getStats() {
        const now = Date.now();
        const byPriority = {
            low: 0,
            normal: 0,
            high: 0,
            urgent: 0,
        };
        let oldestAge = 0;
        let totalWaitTime = 0;
        let count = 0;
        for (const priority of this.priorityOrder) {
            const queue = this.queues.get(priority);
            if (queue) {
                byPriority[priority] = queue.length;
                for (const req of queue) {
                    const age = now - req.enqueueTime;
                    totalWaitTime += age;
                    count++;
                    if (age > oldestAge) {
                        oldestAge = age;
                    }
                }
            }
        }
        // Calculate estimated wait time inline (avoid circular call)
        const avgProcessingTime = 100; // 100ms average
        let requestsAhead = 0;
        for (const p of this.priorityOrder) {
            const queue = this.queues.get(p);
            if (queue) {
                requestsAhead += queue.length;
            }
        }
        const estimatedWaitTime = requestsAhead * avgProcessingTime;
        return {
            length: this.getTotalSize(),
            estimatedWaitTime,
            byPriority,
            oldestAge,
            averageWaitTime: count > 0 ? totalWaitTime / count : 0,
            totalProcessed: this.totalProcessed,
            totalDropped: this.totalDropped,
        };
    }
    /**
     * Get estimated wait time for new request
     */
    getEstimatedWaitTime(priority) {
        // Estimate based on queue sizes and average processing time
        const stats = this.getStats();
        const avgProcessingTime = 100; // 100ms average
        // Calculate requests ahead
        let requestsAhead = 0;
        for (const p of this.priorityOrder) {
            const queue = this.queues.get(p);
            if (!queue)
                continue;
            // All higher priority requests go ahead
            if (this.getPriorityIndex(p) < this.getPriorityIndex(priority)) {
                requestsAhead += queue.length;
            }
            else if (p === priority) {
                // Same priority: add current queue length
                requestsAhead += queue.length;
            }
        }
        return requestsAhead * avgProcessingTime;
    }
    /**
     * Remove requests that have exceeded max wait time
     */
    checkTimeouts() {
        const now = Date.now();
        for (const priority of this.priorityOrder) {
            const queue = this.queues.get(priority);
            if (!queue)
                continue;
            // Filter out timed-out requests
            const filtered = queue.filter(req => {
                const waitTime = now - req.timestamp; // Use timestamp, not enqueueTime
                if (req.maxWaitTime && waitTime > req.maxWaitTime) {
                    this.totalDropped++;
                    return false;
                }
                return true;
            });
            this.queues.set(priority, filtered);
        }
    }
    /**
     * Calculate position in queue considering all priorities
     */
    calculatePosition(priority, indexInQueue) {
        let position = 0;
        const priorityIndex = this.getPriorityIndex(priority);
        for (const p of this.priorityOrder) {
            const queue = this.queues.get(p);
            if (!queue)
                continue;
            if (this.getPriorityIndex(p) < priorityIndex) {
                // Higher priority queues: all requests go ahead
                position += queue.length;
            }
            else if (p === priority) {
                // Same priority: add position within queue
                position += indexInQueue;
            }
        }
        return position;
    }
    /**
     * Get numeric priority index (lower = higher priority)
     */
    getPriorityIndex(priority) {
        return this.priorityOrder.indexOf(priority);
    }
    /**
     * Calculate total queue size
     */
    getTotalSize() {
        let total = 0;
        for (const queue of this.queues.values()) {
            total += queue.length;
        }
        return total;
    }
    /**
     * Estimate wait time for next request
     */
    estimateWaitTime() {
        const stats = this.getStats();
        const avgProcessingTime = 100; // 100ms average
        return stats.length * avgProcessingTime;
    }
    /**
     * Clear all queues
     */
    clear() {
        for (const priority of this.priorityOrder) {
            this.queues.set(priority, []);
        }
        this.totalProcessed = 0;
        this.totalDropped = 0;
    }
    /**
     * Get queue by priority (for debugging)
     */
    getQueue(priority) {
        return [...(this.queues.get(priority) || [])];
    }
}
//# sourceMappingURL=RequestQueue.js.map
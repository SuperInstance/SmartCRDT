/**
 * Priority Queue
 *
 * Thread-safe priority queue for managing pending worker requests
 * with fair scheduling within priority levels.
 */

import type { QueuedRequest, Priority } from "./types.js";

/**
 * Priority order mapping (higher number = higher priority)
 */
const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
};

/**
 * Priority Queue for managing pending worker requests
 */
export class PriorityQueue {
  private queues: Map<Priority, QueuedRequest[]>;
  private requestCounter: number;
  private maxDepth: number;
  private maxWaitTime: number;

  /**
   * Create a new priority queue
   */
  constructor(maxDepth: number = 100, maxWaitTime: number = 60000) {
    this.queues = new Map();
    this.requestCounter = 0;
    this.maxDepth = maxDepth;
    this.maxWaitTime = maxWaitTime;

    // Initialize queues for all priority levels
    (Object.keys(PRIORITY_ORDER) as Priority[]).forEach(priority => {
      this.queues.set(priority, []);
    });
  }

  /**
   * Add a request to the queue
   */
  enqueue(request: QueuedRequest): boolean {
    const totalDepth = this.getTotalDepth();

    // Check max depth
    if (totalDepth >= this.maxDepth) {
      return false;
    }

    const queue = this.queues.get(request.priority);
    if (!queue) {
      return false;
    }

    queue.push(request);
    this.requestCounter++;

    // Set up timeout for the request
    this.setupRequestTimeout(request);

    return true;
  }

  /**
   * Dequeue the highest priority request
   */
  dequeue(): QueuedRequest | null {
    // Check priorities in order
    const priorities: Priority[] = ["critical", "high", "normal", "low"];

    for (const priority of priorities) {
      const queue = this.queues.get(priority);
      if (queue && queue.length > 0) {
        return queue.shift() || null;
      }
    }

    return null;
  }

  /**
   * Dequeue a request from a specific priority level
   */
  dequeueFromPriority(priority: Priority): QueuedRequest | null {
    const queue = this.queues.get(priority);
    if (!queue || queue.length === 0) {
      return null;
    }

    return queue.shift() || null;
  }

  /**
   * Get the total queue depth across all priorities
   */
  getTotalDepth(): number {
    let depth = 0;
    this.queues.forEach(queue => {
      depth += queue.length;
    });
    return depth;
  }

  /**
   * Get queue depth for a specific priority
   */
  getDepth(priority: Priority): number {
    return this.queues.get(priority)?.length || 0;
  }

  /**
   * Get queue depth for all priorities
   */
  getAllDepths(): Record<Priority, number> {
    const depths: Partial<Record<Priority, number>> = {};
    this.queues.forEach((queue, priority) => {
      depths[priority] = queue.length;
    });
    return depths as Record<Priority, number>;
  }

  /**
   * Remove a request from the queue by ID
   */
  remove(requestId: string): boolean {
    for (const [, queue] of this.queues) {
      const index = queue.findIndex(req => req.requestId === requestId);
      if (index !== -1) {
        const [removed] = queue.splice(index, 1);
        if (removed.timeout) {
          clearTimeout(removed.timeout);
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Remove all requests from the queue
   */
  clear(): number {
    let count = 0;
    this.queues.forEach(queue => {
      count += queue.length;
      queue.forEach(req => {
        if (req.timeout) {
          clearTimeout(req.timeout);
        }
      });
      queue.length = 0;
    });
    return count;
  }

  /**
   * Get total number of requests enqueued
   */
  getTotalEnqueued(): number {
    return this.requestCounter;
  }

  /**
   * Peek at the next request without removing it
   */
  peek(): QueuedRequest | null {
    const priorities: Priority[] = ["critical", "high", "normal", "low"];

    for (const priority of priorities) {
      const queue = this.queues.get(priority);
      if (queue && queue.length > 0) {
        return queue[0];
      }
    }

    return null;
  }

  /**
   * Get all requests in the queue (for monitoring/debugging)
   */
  getAllRequests(): QueuedRequest[] {
    const allRequests: QueuedRequest[] = [];
    this.queues.forEach(queue => {
      allRequests.push(...queue);
    });
    return allRequests;
  }

  /**
   * Get requests that have exceeded max wait time
   */
  getExpiredRequests(): QueuedRequest[] {
    const now = Date.now();
    const expired: QueuedRequest[] = [];

    this.queues.forEach(queue => {
      queue.forEach(req => {
        if (now - req.queuedAt > this.maxWaitTime) {
          expired.push(req);
        }
      });
    });

    return expired;
  }

  /**
   * Clean up expired requests
   */
  cleanExpiredRequests(): number {
    const expired = this.getExpiredRequests();
    let cleaned = 0;

    expired.forEach(req => {
      if (this.remove(req.requestId)) {
        req.reject(new Error(`Request timed out after ${this.maxWaitTime}ms`));
        cleaned++;
      }
    });

    return cleaned;
  }

  /**
   * Update max queue depth
   */
  setMaxDepth(maxDepth: number): void {
    this.maxDepth = maxDepth;
  }

  /**
   * Update max wait time
   */
  setMaxWaitTime(maxWaitTime: number): void {
    this.maxWaitTime = maxWaitTime;
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    totalDepth: number;
    depths: Record<Priority, number>;
    totalEnqueued: number;
    maxDepth: number;
    maxWaitTime: number;
    oldestRequestAge: number;
  } {
    const now = Date.now();
    const oldestRequest = this.getOldestRequest();

    return {
      totalDepth: this.getTotalDepth(),
      depths: this.getAllDepths(),
      totalEnqueued: this.getTotalEnqueued(),
      maxDepth: this.maxDepth,
      maxWaitTime: this.maxWaitTime,
      oldestRequestAge: oldestRequest ? now - oldestRequest.queuedAt : 0,
    };
  }

  /**
   * Get the oldest request in the queue
   */
  private getOldestRequest(): QueuedRequest | null {
    let oldest: QueuedRequest | null = null;

    this.queues.forEach(queue => {
      queue.forEach(req => {
        if (!oldest || req.queuedAt < oldest.queuedAt) {
          oldest = req;
        }
      });
    });

    return oldest;
  }

  /**
   * Set up timeout for a request
   */
  private setupRequestTimeout(request: QueuedRequest): void {
    request.timeout = setTimeout(() => {
      if (this.remove(request.requestId)) {
        request.reject(
          new Error(
            `Request ${request.requestId} timed out after ${this.maxWaitTime}ms`
          )
        );
      }
    }, this.maxWaitTime);
  }

  /**
   * Create a queued request from parameters
   */
  static createRequest(
    workerCount: number,
    priority: Priority,
    timeout?: number
  ): QueuedRequest {
    return {
      requestId: `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      priority,
      queuedAt: Date.now(),
      resolve: () => {}, // Placeholder
      reject: () => {}, // Placeholder
      workerCount,
      timeout: timeout || 60000,
    };
  }
}

/**
 * PriorityQueue - Priority queue for SSE events
 *
 * Implements a priority queue for SSE events with support for
 * multiple clients and priority-based ordering.
 */

import type { SSEEvent, EventPriority, PriorityItem } from "./types.js";
import { getPriorityScore } from "./types.js";

/**
 * Client queue state
 */
interface ClientQueue {
  /** Client identifier */
  clientId: string;
  /** Priority items */
  items: PriorityItem[];
  /** Maximum queue size */
  maxSize: number;
  /** Total enqueued */
  totalEnqueued: number;
  /** Total dequeued */
  totalDequeued: number;
  /** Total dropped (due to overflow) */
  totalDropped: number;
  /** Next order counter */
  nextOrder: number;
}

/**
 * Dequeue result
 */
export interface DequeueResult {
  /** Event that was dequeued */
  event: SSEEvent | null;
  /** Priority of the event */
  priority: EventPriority | null;
  /** Queue size after dequeue */
  queueSize: number;
  /** Whether queue is now empty */
  isEmpty: boolean;
}

/**
 * Bulk dequeue result
 */
export interface BulkDequeueResult {
  /** Events dequeued */
  events: SSEEvent[];
  /** Count of events */
  count: number;
  /** Remaining queue size */
  remaining: number;
}

/**
 * PriorityQueue - Main class
 */
export class PriorityQueue {
  private queues: Map<string, ClientQueue>;
  private defaultMaxSize: number;

  constructor(defaultMaxSize: number = 1000) {
    this.queues = new Map();
    this.defaultMaxSize = defaultMaxSize;
  }

  /**
   * Enqueue an event with priority for a client
   */
  enqueue(
    clientId: string,
    event: SSEEvent,
    priority?: EventPriority
  ): boolean {
    const queue = this.getOrCreateQueue(clientId);

    // Check if queue is full
    if (queue.items.length >= queue.maxSize) {
      queue.totalDropped++;
      return false;
    }

    const item: PriorityItem = {
      priority: priority || event.priority || "normal",
      score: getPriorityScore(priority || event.priority || "normal"),
      data: event,
      order: queue.nextOrder++,
    };

    queue.items.push(item);
    queue.totalEnqueued++;

    // Reorder based on priority
    this.heapifyUp(queue.items, queue.items.length - 1);

    return true;
  }

  /**
   * Enqueue multiple events
   * Returns number of events successfully enqueued
   */
  enqueueMultiple(
    clientId: string,
    events: Array<{ event: SSEEvent; priority?: EventPriority }>
  ): number {
    let enqueued = 0;
    for (const { event, priority } of events) {
      if (this.enqueue(clientId, event, priority)) {
        enqueued++;
      }
    }
    return enqueued;
  }

  /**
   * Dequeue highest priority event for a client
   */
  dequeue(clientId: string): DequeueResult {
    const queue = this.queues.get(clientId);
    if (!queue || queue.items.length === 0) {
      return {
        event: null,
        priority: null,
        queueSize: 0,
        isEmpty: true,
      };
    }

    // Get highest priority item (first in heap)
    const item = queue.items[0];

    // Swap with last and remove
    const last = queue.items.pop()!;
    if (queue.items.length > 0) {
      queue.items[0] = last;
      this.heapifyDown(queue.items, 0);
    }

    queue.totalDequeued++;

    return {
      event: item.data,
      priority: item.priority,
      queueSize: queue.items.length,
      isEmpty: queue.items.length === 0,
    };
  }

  /**
   * Dequeue multiple events
   */
  dequeueMultiple(clientId: string, count: number): BulkDequeueResult {
    const events: SSEEvent[] = [];
    for (let i = 0; i < count; i++) {
      const result = this.dequeue(clientId);
      if (!result.event) break;
      events.push(result.event);
    }

    const queue = this.queues.get(clientId);

    return {
      events,
      count: events.length,
      remaining: queue?.items.length || 0,
    };
  }

  /**
   * Peek at highest priority event without removing
   */
  peek(clientId: string): PriorityItem | null {
    const queue = this.queues.get(clientId);
    if (!queue || queue.items.length === 0) {
      return null;
    }
    return queue.items[0];
  }

  /**
   * Get queue size for a client
   */
  getQueueSize(clientId: string): number {
    const queue = this.queues.get(clientId);
    return queue?.items.length || 0;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(clientId: string): boolean {
    const queue = this.queues.get(clientId);
    return !queue || queue.items.length === 0;
  }

  /**
   * Clear queue for a client
   */
  clearQueue(clientId: string): void {
    const queue = this.queues.get(clientId);
    if (queue) {
      queue.items = [];
    }
  }

  /**
   * Remove queue for a client
   */
  removeQueue(clientId: string): void {
    this.queues.delete(clientId);
  }

  /**
   * Set max queue size for a client
   */
  setMaxSize(clientId: string, size: number): void {
    const queue = this.getOrCreateQueue(clientId);
    queue.maxSize = size;

    // Trim if over new limit
    while (queue.items.length > size) {
      this.removeLowestPriority(queue);
    }
  }

  /**
   * Get queue statistics
   */
  getQueueStats(clientId: string): {
    size: number;
    maxSize: number;
    totalEnqueued: number;
    totalDequeued: number;
    totalDropped: number;
    utilization: number;
  } | null {
    const queue = this.queues.get(clientId);
    if (!queue) {
      return null;
    }

    return {
      size: queue.items.length,
      maxSize: queue.maxSize,
      totalEnqueued: queue.totalEnqueued,
      totalDequeued: queue.totalDequeued,
      totalDropped: queue.totalDropped,
      utilization: queue.maxSize > 0 ? queue.items.length / queue.maxSize : 0,
    };
  }

  /**
   * Get all events from queue (without removing)
   */
  getAllEvents(clientId: string): SSEEvent[] {
    const queue = this.queues.get(clientId);
    if (!queue) {
      return [];
    }
    return queue.items.map(item => item.data);
  }

  /**
   * Get events by priority level
   */
  getEventsByPriority(clientId: string, priority: EventPriority): SSEEvent[] {
    const queue = this.queues.get(clientId);
    if (!queue) {
      return [];
    }
    return queue.items
      .filter(item => item.priority === priority)
      .map(item => item.data);
  }

  /**
   * Get priority distribution
   */
  getPriorityDistribution(clientId: string): Record<EventPriority, number> {
    const queue = this.queues.get(clientId);
    if (!queue) {
      return { critical: 0, high: 0, normal: 0, low: 0 };
    }

    const distribution: Record<EventPriority, number> = {
      critical: 0,
      high: 0,
      normal: 0,
      low: 0,
    };

    for (const item of queue.items) {
      distribution[item.priority]++;
    }

    return distribution;
  }

  /**
   * Update priority of an event in the queue
   */
  updatePriority(
    clientId: string,
    eventPredicate: (event: SSEEvent) => boolean,
    newPriority: EventPriority
  ): number {
    const queue = this.queues.get(clientId);
    if (!queue) {
      return 0;
    }

    let updated = 0;
    for (const item of queue.items) {
      if (eventPredicate(item.data)) {
        item.priority = newPriority;
        item.score = getPriorityScore(newPriority);
        updated++;
      }
    }

    // Rebuild heap if any updates
    if (updated > 0) {
      this.buildHeap(queue.items);
    }

    return updated;
  }

  /**
   * Remove events matching predicate
   */
  removeEvents(
    clientId: string,
    predicate: (event: SSEEvent) => boolean
  ): number {
    const queue = this.queues.get(clientId);
    if (!queue) {
      return 0;
    }

    const initialSize = queue.items.length;
    queue.items = queue.items.filter(item => !predicate(item.data));

    // Rebuild heap
    this.buildHeap(queue.items);

    return initialSize - queue.items.length;
  }

  /**
   * Get all client IDs with queues
   */
  getClientIds(): string[] {
    return Array.from(this.queues.keys());
  }

  /**
   * Get global statistics
   */
  getGlobalStats(): {
    totalClients: number;
    totalEvents: number;
    totalEnqueued: number;
    totalDequeued: number;
    totalDropped: number;
    averageUtilization: number;
    maxUtilization: number;
  } {
    const queues = Array.from(this.queues.values());

    const totalEvents = queues.reduce((sum, q) => sum + q.items.length, 0);
    const totalEnqueued = queues.reduce((sum, q) => sum + q.totalEnqueued, 0);
    const totalDequeued = queues.reduce((sum, q) => sum + q.totalDequeued, 0);
    const totalDropped = queues.reduce((sum, q) => sum + q.totalDropped, 0);

    const utilizations = queues.map(q =>
      q.maxSize > 0 ? q.items.length / q.maxSize : 0
    );
    const averageUtilization =
      utilizations.length > 0
        ? utilizations.reduce((sum, u) => sum + u, 0) / utilizations.length
        : 0;
    const maxUtilization =
      utilizations.length > 0 ? Math.max(...utilizations) : 0;

    return {
      totalClients: queues.length,
      totalEvents,
      totalEnqueued,
      totalDequeued,
      totalDropped,
      averageUtilization,
      maxUtilization,
    };
  }

  /**
   * Clear all queues
   */
  clear(): void {
    this.queues.clear();
  }

  /**
   * Get or create queue for client
   */
  private getOrCreateQueue(clientId: string): ClientQueue {
    if (!this.queues.has(clientId)) {
      this.queues.set(clientId, {
        clientId,
        items: [],
        maxSize: this.defaultMaxSize,
        totalEnqueued: 0,
        totalDequeued: 0,
        totalDropped: 0,
        nextOrder: 0,
      });
    }
    return this.queues.get(clientId)!;
  }

  /**
   * Remove lowest priority item from queue
   */
  private removeLowestPriority(queue: ClientQueue): void {
    if (queue.items.length === 0) {
      return;
    }

    // Find lowest priority (last in heap)
    let lowestIndex = 0;
    for (let i = 1; i < queue.items.length; i++) {
      if (this.compare(queue.items[i], queue.items[lowestIndex]) < 0) {
        lowestIndex = i;
      }
    }

    queue.items.splice(lowestIndex, 1);
    queue.totalDropped++;

    // Rebuild heap
    this.buildHeap(queue.items);
  }

  /**
   * Compare two priority items (returns > 0 if a has higher priority)
   */
  private compare(a: PriorityItem, b: PriorityItem): number {
    // Higher score = higher priority
    if (a.score !== b.score) {
      return a.score - b.score;
    }
    // Tie-breaker: lower order = higher priority (FIFO)
    return b.order - a.order;
  }

  /**
   * Heapify up (used after insert)
   */
  private heapifyUp(items: PriorityItem[], index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.compare(items[index], items[parentIndex]) > 0) {
        // Swap
        [items[index], items[parentIndex]] = [items[parentIndex], items[index]];
        index = parentIndex;
      } else {
        break;
      }
    }
  }

  /**
   * Heapify down (used after remove)
   */
  private heapifyDown(items: PriorityItem[], index: number): void {
    const length = items.length;
    while (true) {
      let highest = index;
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;

      if (
        leftChild < length &&
        this.compare(items[leftChild], items[highest]) > 0
      ) {
        highest = leftChild;
      }
      if (
        rightChild < length &&
        this.compare(items[rightChild], items[highest]) > 0
      ) {
        highest = rightChild;
      }

      if (highest !== index) {
        [items[index], items[highest]] = [items[highest], items[index]];
        index = highest;
      } else {
        break;
      }
    }
  }

  /**
   * Build heap from array
   */
  private buildHeap(items: PriorityItem[]): void {
    // Start from last non-leaf node and heapify down
    for (let i = Math.floor(items.length / 2) - 1; i >= 0; i--) {
      this.heapifyDown(items, i);
    }
  }

  /**
   * Get queue age statistics
   */
  getQueueAgeStats(clientId: string): {
    oldestAge: number | null;
    newestAge: number | null;
    averageAge: number | null;
  } | null {
    const queue = this.queues.get(clientId);
    if (!queue || queue.items.length === 0) {
      return null;
    }

    const now = Date.now();
    const ages = queue.items.map(item => now - (item.data.timestamp || now));

    return {
      oldestAge: Math.max(...ages),
      newestAge: Math.min(...ages),
      averageAge: ages.reduce((sum, age) => sum + age, 0) / ages.length,
    };
  }

  /**
   * Merge events from another client's queue
   */
  mergeQueues(sourceClientId: string, targetClientId: string): number {
    const sourceQueue = this.queues.get(sourceClientId);
    if (!sourceQueue) {
      return 0;
    }

    let merged = 0;
    for (const item of sourceQueue.items) {
      if (this.enqueue(targetClientId, item.data, item.priority)) {
        merged++;
      }
    }

    // Clear source queue
    this.clearQueue(sourceClientId);

    return merged;
  }

  /**
   * Set default max size for new queues
   */
  setDefaultMaxSize(size: number): void {
    this.defaultMaxSize = size;
  }
}

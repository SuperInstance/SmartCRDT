/**
 * Replay Buffer
 *
 * Stores and prioritizes examples for replay including:
 * - Priority-based sampling
 * - FIFO eviction when full
 * - Priority updates
 */

import type {
  TrainingExample,
  ReplayBuffer as IReplayBuffer,
} from "../types.js";

interface BufferEntry {
  example: TrainingExample;
  priority: number;
  timestamp: number;
}

export class ReplayBuffer implements IReplayBuffer {
  private buffer: Map<string, BufferEntry> = new Map();
  private maxSize: number;
  private currentSize: number = 0;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  /**
   * Add example to buffer with priority
   */
  add(example: TrainingExample, priority: number): void {
    // If already exists, update priority
    if (this.buffer.has(example.id)) {
      const entry = this.buffer.get(example.id)!;
      entry.priority = Math.max(entry.priority, priority);
      entry.timestamp = Date.now();
      return;
    }

    // If buffer is full, evict lowest priority entry
    if (this.currentSize >= this.maxSize) {
      this.evictLowestPriority();
    }

    this.buffer.set(example.id, {
      example,
      priority,
      timestamp: Date.now(),
    });
    this.currentSize++;
  }

  /**
   * Sample batch of examples based on priority
   */
  sample(batchSize: number): TrainingExample[] {
    if (this.buffer.size === 0) {
      return [];
    }

    const entries = Array.from(this.buffer.values());

    // Sort by priority (higher priority first)
    entries.sort((a, b) => b.priority - a.priority);

    // Sample top-k or random with priority weighting
    const sampled = entries.slice(0, batchSize);

    return sampled.map(e => e.example);
  }

  /**
   * Update priority of an example
   */
  updatePriority(id: string, priority: number): void {
    const entry = this.buffer.get(id);
    if (entry) {
      entry.priority = priority;
    }
  }

  /**
   * Clear buffer
   */
  clear(): void {
    this.buffer.clear();
    this.currentSize = 0;
  }

  /**
   * Get current buffer size
   */
  size(): number {
    return this.buffer.size;
  }

  /**
   * Evict lowest priority entry
   */
  private evictLowestPriority(): void {
    let minPriority = Infinity;
    let minId: string | null = null;

    for (const [id, entry] of this.buffer.entries()) {
      if (entry.priority < minPriority) {
        minPriority = entry.priority;
        minId = id;
      }
    }

    if (minId) {
      this.buffer.delete(minId);
      this.currentSize--;
    }
  }

  /**
   * Get buffer statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    utilization: number;
    avgPriority: number;
    minPriority: number;
    maxPriority: number;
  } {
    if (this.buffer.size === 0) {
      return {
        size: 0,
        maxSize: this.maxSize,
        utilization: 0,
        avgPriority: 0,
        minPriority: 0,
        maxPriority: 0,
      };
    }

    const priorities = Array.from(this.buffer.values()).map(e => e.priority);
    const avgPriority =
      priorities.reduce((sum, p) => sum + p, 0) / priorities.length;

    return {
      size: this.buffer.size,
      maxSize: this.maxSize,
      utilization: this.buffer.size / this.maxSize,
      avgPriority,
      minPriority: Math.min(...priorities),
      maxPriority: Math.max(...priorities),
    };
  }

  /**
   * Sample with priority probability (higher priority = more likely to be sampled)
   */
  sampleProportional(batchSize: number): TrainingExample[] {
    if (this.buffer.size === 0) {
      return [];
    }

    const entries = Array.from(this.buffer.values());
    const totalPriority = entries.reduce((sum, e) => sum + e.priority, 0);

    if (totalPriority === 0) {
      // Uniform sampling if all priorities are 0
      const shuffled = entries.sort(() => Math.random() - 0.5);
      return shuffled.slice(0, batchSize).map(e => e.example);
    }

    const sampled: TrainingExample[] = [];

    for (let i = 0; i < batchSize && entries.length > 0; i++) {
      const rand = Math.random() * totalPriority;
      let cumulative = 0;

      for (let j = 0; j < entries.length; j++) {
        cumulative += entries[j].priority;

        if (rand <= cumulative) {
          sampled.push(entries[j].example);
          totalPriority -= entries[j].priority;
          entries.splice(j, 1);
          break;
        }
      }
    }

    return sampled;
  }
}

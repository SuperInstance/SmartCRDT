/**
 * @file dead-letter.ts - Dead letter queue for failed tasks
 * @package @lsi/langgraph-errors
 */

import type { DeadLetterEntry, AgentError } from "./types.js";

/**
 * Generate unique entry ID
 */
function generateEntryId(): string {
  return `dle_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Dead letter queue for failed tasks
 */
export class DeadLetterQueue {
  private queue: Map<string, DeadLetterEntry>;
  private maxSize: number;
  private archived: Map<string, DeadLetterEntry>;

  constructor(maxSize: number = 1000) {
    this.queue = new Map();
    this.archived = new Map();
    this.maxSize = maxSize;
  }

  /**
   * Add failed task to dead letter queue
   */
  add<T>(task: T, error: AgentError, maxRetries: number = 3): string {
    const entry: DeadLetterEntry<T> = {
      id: generateEntryId(),
      task,
      error,
      timestamp: Date.now(),
      retry_count: 0,
      max_retries: maxRetries,
      archived: false,
    };

    // Check max size
    if (this.queue.size >= this.maxSize) {
      // Remove oldest entry
      const oldestKey = this.queue.keys().next().value;
      if (oldestKey) {
        this.queue.delete(oldestKey);
      }
    }

    this.queue.set(entry.id, entry);
    console.warn(`Task added to dead letter queue: ${entry.id}`);

    return entry.id;
  }

  /**
   * Get entry by ID
   */
  get(id: string): DeadLetterEntry | undefined {
    return this.queue.get(id);
  }

  /**
   * Get all entries
   */
  getAll(): DeadLetterEntry[] {
    return Array.from(this.queue.values());
  }

  /**
   * Get entries by agent ID
   */
  getByAgent(agentId: string): DeadLetterEntry[] {
    return Array.from(this.queue.values()).filter(
      entry => entry.error.agent_id === agentId
    );
  }

  /**
   * Get entries by error category
   */
  getByCategory(category: string): DeadLetterEntry[] {
    return Array.from(this.queue.values()).filter(
      entry => entry.error.category === category
    );
  }

  /**
   * Get entries by time range
   */
  getByTimeRange(startTime: number, endTime: number): DeadLetterEntry[] {
    return Array.from(this.queue.values()).filter(
      entry => entry.timestamp >= startTime && entry.timestamp <= endTime
    );
  }

  /**
   * Retry a failed task
   */
  async retry<T>(
    id: string,
    retryFn: (task: T) => Promise<unknown>
  ): Promise<{ success: boolean; error?: Error }> {
    const entry = this.queue.get(id);

    if (!entry) {
      throw new Error(`Entry not found: ${id}`);
    }

    if (entry.retry_count >= entry.max_retries) {
      return {
        success: false,
        error: new Error("Max retries exceeded"),
      };
    }

    entry.retry_count++;

    try {
      await retryFn(entry.task as T);
      this.queue.delete(id);
      return { success: true };
    } catch (error) {
      if (entry.retry_count >= entry.max_retries) {
        // Archive entry
        this.archive(id);
      }
      return {
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * Retry all entries
   */
  async retryAll<T>(
    retryFn: (task: T) => Promise<unknown>
  ): Promise<{ total: number; successful: number; failed: number }> {
    const entries = Array.from(this.queue.values());
    let successful = 0;
    let failed = 0;

    for (const entry of entries) {
      const result = await this.retry(entry.id, retryFn);
      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    }

    return {
      total: entries.length,
      successful,
      failed,
    };
  }

  /**
   * Retry entries for a specific agent
   */
  async retryByAgent<T>(
    agentId: string,
    retryFn: (task: T) => Promise<unknown>
  ): Promise<{ total: number; successful: number; failed: number }> {
    const entries = this.getByAgent(agentId);
    let successful = 0;
    let failed = 0;

    for (const entry of entries) {
      const result = await this.retry(entry.id, retryFn);
      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    }

    return {
      total: entries.length,
      successful,
      failed,
    };
  }

  /**
   * Archive an entry
   */
  archive(id: string): void {
    const entry = this.queue.get(id);

    if (entry) {
      entry.archived = true;
      this.archived.set(id, entry);
      this.queue.delete(id);
      console.warn(`Task archived: ${id}`);
    }
  }

  /**
   * Get archived entries
   */
  getArchived(): DeadLetterEntry[] {
    return Array.from(this.archived.values());
  }

  /**
   * Remove entry from queue
   */
  remove(id: string): boolean {
    return this.queue.delete(id);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.queue.clear();
  }

  /**
   * Clear archived entries
   */
  clearArchived(): void {
    this.archived.clear();
  }

  /**
   * Get queue statistics
   */
  getStatistics(): {
    queueSize: number;
    archivedSize: number;
    maxSize: number;
    byAgent: Record<string, number>;
    byCategory: Record<string, number>;
    avgRetries: number;
  } {
    const entries = Array.from(this.queue.values());
    const byAgent: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    let totalRetries = 0;

    for (const entry of entries) {
      byAgent[entry.error.agent_id] = (byAgent[entry.error.agent_id] || 0) + 1;
      byCategory[entry.error.category] =
        (byCategory[entry.error.category] || 0) + 1;
      totalRetries += entry.retry_count;
    }

    return {
      queueSize: this.queue.size,
      archivedSize: this.archived.size,
      maxSize: this.maxSize,
      byAgent,
      byCategory,
      avgRetries: entries.length > 0 ? totalRetries / entries.length : 0,
    };
  }

  /**
   * Set max size
   */
  setMaxSize(size: number): void {
    this.maxSize = size;

    // Trim queue if necessary
    while (this.queue.size > this.maxSize) {
      const oldestKey = this.queue.keys().next().value;
      if (oldestKey) {
        this.queue.delete(oldestKey);
      }
    }
  }

  /**
   * Persist queue to storage (placeholder)
   */
  async persist(): Promise<void> {
    // In a real implementation, this would persist to a database or file
    console.log(`Persisting ${this.queue.size} entries to storage`);
  }

  /**
   * Load queue from storage (placeholder)
   */
  async load(): Promise<void> {
    // In a real implementation, this would load from a database or file
    console.log("Loading entries from storage");
  }

  /**
   * Export entries to JSON
   */
  export(): string {
    const data = {
      queue: Array.from(this.queue.values()),
      archived: Array.from(this.archived.values()),
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import entries from JSON
   */
  import(json: string): void {
    try {
      const data = JSON.parse(json);
      if (data.queue) {
        for (const entry of data.queue) {
          this.queue.set(entry.id, entry);
        }
      }
      if (data.archived) {
        for (const entry of data.archived) {
          this.archived.set(entry.id, entry);
        }
      }
    } catch (error) {
      console.error("Failed to import dead letter queue:", error);
    }
  }

  /**
   * Create inspection report
   */
  createReport(): string {
    const stats = this.getStatistics();
    const entries = Array.from(this.queue.values());

    let report = "=== Dead Letter Queue Report ===\n\n";
    report += `Queue Size: ${stats.queueSize}/${stats.maxSize}\n`;
    report += `Archived: ${stats.archivedSize}\n`;
    report += `Average Retries: ${stats.avgRetries.toFixed(2)}\n\n`;

    report += "By Agent:\n";
    for (const [agentId, count] of Object.entries(stats.byAgent)) {
      report += `  ${agentId}: ${count}\n`;
    }

    report += "\nBy Category:\n";
    for (const [category, count] of Object.entries(stats.byCategory)) {
      report += `  ${category}: ${count}\n`;
    }

    report += "\nRecent Entries:\n";
    for (const entry of entries.slice(-10)) {
      report += `  [${entry.id}] ${entry.error.agent_id} - ${entry.error.message}\n`;
    }

    return report;
  }
}

/**
 * Singleton instance
 */
export const deadLetterQueue = new DeadLetterQueue();

/**
 * Convenience function to add to dead letter queue
 */
export function addToDeadLetterQueue<T>(
  task: T,
  error: AgentError,
  maxRetries?: number
): string {
  return deadLetterQueue.add(task, error, maxRetries);
}

/**
 * Convenience function to retry a failed task
 */
export async function retryFromDeadLetterQueue<T>(
  id: string,
  retryFn: (task: T) => Promise<unknown>
): Promise<{ success: boolean; error?: Error }> {
  return deadLetterQueue.retry(id, retryFn);
}

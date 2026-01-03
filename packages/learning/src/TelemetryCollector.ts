/**
 * TelemetryCollector - Collect and manage query telemetry
 *
 * Collects telemetry data about queries, routes, and outcomes.
 * All data stays local and is written to disk periodically.
 *
 * Privacy guarantees:
 * - Data never leaves the local machine
 * - Queries can be hashed for sensitive data
 * - User can view/delete all telemetry data
 * - Automatic data retention management
 */

import type {
  TelemetryEntry,
  LearningConfig,
} from './types.js';
import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * Telemetry collector options
 */
export interface TelemetryCollectorOptions {
  /** Data directory */
  dataDir: string;
  /** Maximum entries in memory buffer */
  maxMemoryEntries?: number;
  /** Flush interval (ms) */
  flushInterval?: number;
  /** Whether to hash queries for privacy */
  hashQueries?: boolean;
}

/**
 * Telemetry collector
 *
 * Collects telemetry data in memory and periodically flushes to disk.
 * Data is organized by date in daily log files.
 */
export class TelemetryCollector {
  private buffer: TelemetryEntry[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private dataDir: string;
  private maxMemoryEntries: number;
  private flushInterval: number;
  private hashQueries: boolean;

  constructor(options: TelemetryCollectorOptions) {
    this.dataDir = options.dataDir;
    this.maxMemoryEntries = options.maxMemoryEntries ?? 1000;
    this.flushInterval = options.flushInterval ?? 60000; // 1 minute
    this.hashQueries = options.hashQueries ?? false;
  }

  /**
   * Start the telemetry collector
   */
  async start(): Promise<void> {
    // Ensure telemetry directory exists
    await fs.mkdir(join(this.dataDir, 'telemetry'), { recursive: true });

    // Start periodic flush
    this.flushTimer = setInterval(() => {
      this.flush().catch(err => {
        console.error('Telemetry flush error:', err);
      });
    }, this.flushInterval);
  }

  /**
   * Stop the telemetry collector
   */
  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }

  /**
   * Record a telemetry entry
   */
  async record(entry: TelemetryEntry): Promise<void> {
    // Hash query if privacy mode enabled
    if (this.hashQueries) {
      entry = {
        ...entry,
        query: this.hashQuery(entry.query),
      };
    }

    this.buffer.push(entry);

    // Flush if buffer is full
    if (this.buffer.length >= this.maxMemoryEntries) {
      await this.flush();
    }
  }

  /**
   * Get recent telemetry entries
   */
  async getRecent(duration: number): Promise<TelemetryEntry[]> {
    const cutoff = Date.now() - duration;
    const entries: TelemetryEntry[] = [];

    // Load entries from disk
    const dates = this.getRecentDates(duration);
    for (const date of dates) {
      const filepath = this.getTelemetryFilepath(date);
      try {
        const content = await fs.readFile(filepath, 'utf-8');
        const lines = content.split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const entry = JSON.parse(line) as TelemetryEntry;
            if (entry.timestamp >= cutoff) {
              entries.push(entry);
            }
          } catch {
            // Skip malformed entries
          }
        }
      } catch (err) {
        // File doesn't exist or can't be read
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw err;
        }
      }
    }

    // Add in-memory entries
    for (const entry of this.buffer) {
      if (entry.timestamp >= cutoff) {
        entries.push(entry);
      }
    }

    return entries;
  }

  /**
   * Get telemetry statistics
   */
  async getStats(duration?: number): Promise<{
    totalEntries: number;
    bufferEntries: number;
    diskEntries: number;
    oldestEntry?: number;
    newestEntry?: number;
  }> {
    const entries = duration ? await this.getRecent(duration) : [];
    const allEntries = await this.getRecent(365 * 24 * 60 * 60 * 1000); // Last year

    return {
      totalEntries: entries.length,
      bufferEntries: this.buffer.length,
      diskEntries: allEntries.length - this.buffer.length,
      oldestEntry: allEntries[0]?.timestamp,
      newestEntry: allEntries[allEntries.length - 1]?.timestamp,
    };
  }

  /**
   * Delete old telemetry data
   */
  async prune(retentionDays: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const telemetryDir = join(this.dataDir, 'telemetry');
    const files = await fs.readdir(telemetryDir);
    let deletedCount = 0;

    for (const file of files) {
      const match = file.match(/^(\d{4}-\d{2}-\d{2})\.jsonl$/);
      if (match) {
        const fileDate = new Date(match[1]);
        if (fileDate < cutoff) {
          const filepath = join(telemetryDir, file);
          await fs.unlink(filepath);
          deletedCount++;
        }
      }
    }

    return deletedCount;
  }

  /**
   * Clear all telemetry data
   */
  async clear(): Promise<void> {
    this.buffer = [];
    const telemetryDir = join(this.dataDir, 'telemetry');
    try {
      const files = await fs.readdir(telemetryDir);
      for (const file of files) {
        await fs.unlink(join(telemetryDir, file));
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }

  /**
   * Flush buffer to disk
   */
  private async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    // Group entries by date
    const entriesByDate = new Map<string, TelemetryEntry[]>();
    for (const entry of this.buffer) {
      const date = new Date(entry.timestamp).toISOString().split('T')[0];
      const entries = entriesByDate.get(date) ?? [];
      entries.push(entry);
      entriesByDate.set(date, entries);
    }

    // Write each date's entries to its file
    for (const [date, entries] of entriesByDate) {
      const filepath = this.getTelemetryFilepath(date);
      const content = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
      await fs.appendFile(filepath, content);
    }

    this.buffer = [];
  }

  /**
   * Get telemetry filepath for a date
   */
  private getTelemetryFilepath(date: string): string {
    return join(this.dataDir, 'telemetry', `${date}.jsonl`);
  }

  /**
   * Get recent dates for a duration
   */
  private getRecentDates(duration: number): string[] {
    const dates: string[] = [];
    const days = Math.ceil(duration / (24 * 60 * 60 * 1000));
    const now = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }

    return dates;
  }

  /**
   * Hash a query for privacy
   */
  private hashQuery(query: string): string {
    // Simple hash - in production use crypto.createHash
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `hash:${Math.abs(hash).toString(36)}`;
  }
}

/**
 * Create a telemetry collector with default options
 */
export async function createTelemetryCollector(
  dataDir: string,
  config?: Partial<TelemetryCollectorOptions>
): Promise<TelemetryCollector> {
  const collector = new TelemetryCollector({
    dataDir,
    ...config,
  });

  await collector.start();
  return collector;
}

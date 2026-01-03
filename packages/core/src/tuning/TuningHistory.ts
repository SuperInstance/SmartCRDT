/**
 * @lsi/core/tuning - TuningHistory for Aequor Cognitive Orchestration Platform
 *
 * Tuning history storage with:
 * - Recording tuning actions
 * - Retrieving history by parameter
 * - Finding best values
 * - Manual change tracking
 * - Persistence support
 */

import { TuningHistoryEntry, PerformanceMetrics } from "./AutoTuner.js";

/**
 * TuningHistory - Stores and manages tuning history
 *
 * The TuningHistory maintains a record of all tuning actions,
 * enabling learning from past adjustments and rollback capability.
 */
export class TuningHistory {
  private storage: Map<string, TuningHistoryEntry[]>;
  private maxHistorySize: number;
  private persistEnabled: boolean;
  private persistKey: string;

  constructor(
    maxHistorySize: number = 1000,
    persistEnabled: boolean = false,
    persistKey: string = "lsi:tuning:history"
  ) {
    this.storage = new Map();
    this.maxHistorySize = maxHistorySize;
    this.persistEnabled = persistEnabled;
    this.persistKey = persistKey;

    // Load from persistence if enabled
    if (this.persistEnabled) {
      this.loadFromPersistence();
    }
  }

  /**
   * Record tuning action
   */
  async record(entry: TuningHistoryEntry): Promise<void> {
    const entries = this.storage.get(entry.parameter) || [];
    entries.push(entry);

    // Limit history size
    if (entries.length > this.maxHistorySize) {
      entries.shift();
    }

    this.storage.set(entry.parameter, entries);

    // Persist if enabled
    if (this.persistEnabled) {
      await this.saveToPersistence();
    }
  }

  /**
   * Get all history
   */
  async getAll(): Promise<TuningHistoryEntry[]> {
    const all: TuningHistoryEntry[] = [];
    for (const entries of this.storage.values()) {
      all.push(...entries);
    }
    return all.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get history for specific parameter
   */
  async getParameterHistory(parameter: string): Promise<TuningHistoryEntry[]> {
    const entries = this.storage.get(parameter) || [];
    return [...entries].sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get recent history (last N entries)
   */
  async getRecentHistory(count: number = 100): Promise<TuningHistoryEntry[]> {
    const all = await this.getAll();
    return all.slice(-count);
  }

  /**
   * Get history in time range
   */
  async getHistoryInRange(
    startTime: number,
    endTime: number
  ): Promise<TuningHistoryEntry[]> {
    const all = await this.getAll();
    return all.filter(
      entry => entry.timestamp >= startTime && entry.timestamp <= endTime
    );
  }

  /**
   * Get successful tuning actions
   */
  async getSuccessfulHistory(
    parameter?: string
  ): Promise<TuningHistoryEntry[]> {
    let entries: TuningHistoryEntry[];

    if (parameter) {
      entries = await this.getParameterHistory(parameter);
    } else {
      entries = await this.getAll();
    }

    return entries.filter(e => e.successful === true);
  }

  /**
   * Get failed tuning actions
   */
  async getFailedHistory(parameter?: string): Promise<TuningHistoryEntry[]> {
    let entries: TuningHistoryEntry[];

    if (parameter) {
      entries = await this.getParameterHistory(parameter);
    } else {
      entries = await this.getAll();
    }

    return entries.filter(e => e.successful === false);
  }

  /**
   * Get best value for parameter
   */
  async getBestValue(parameter: string): Promise<number | null> {
    const entries = await this.getParameterHistory(parameter);
    const successful = entries.filter(
      e => e.successful === true && e.improvement !== undefined
    );

    if (successful.length === 0) {
      return null;
    }

    // Group by value and calculate average improvement
    const byValue = new Map<number, number[]>();
    for (const entry of successful) {
      const improvements = byValue.get(entry.newValue) || [];
      if (entry.improvement !== undefined) {
        improvements.push(entry.improvement);
      }
      byValue.set(entry.newValue, improvements);
    }

    // Find value with best average improvement
    let bestValue: number | null = null;
    let bestAvgImprovement = -Infinity;

    for (const [value, improvements] of byValue) {
      const avgImprovement =
        improvements.reduce((a, b) => a + b, 0) / improvements.length;
      if (avgImprovement > bestAvgImprovement) {
        bestAvgImprovement = avgImprovement;
        bestValue = value;
      }
    }

    return bestValue;
  }

  /**
   * Get improvement statistics for parameter
   */
  async getImprovementStats(parameter: string): Promise<{
    average: number;
    min: number;
    max: number;
    count: number;
  } | null> {
    const entries = await this.getParameterHistory(parameter);
    const successful = entries.filter(
      e => e.successful === true && e.improvement !== undefined
    );

    if (successful.length === 0) {
      return null;
    }

    const improvements = successful
      .map(e => e.improvement!)
      .filter(
        (improvement): improvement is number => improvement !== undefined
      );

    const average =
      improvements.reduce((a, b) => a + b, 0) / improvements.length;
    const min = Math.min(...improvements);
    const max = Math.max(...improvements);

    return { average, min, max, count: improvements.length };
  }

  /**
   * Get tuning frequency for parameter
   */
  async getTuningFrequency(
    parameter: string,
    timeWindowMs: number = 3600000
  ): Promise<number> {
    const entries = await this.getParameterHistory(parameter);
    const now = Date.now();
    const recentEntries = entries.filter(
      e => now - e.timestamp <= timeWindowMs
    );
    return recentEntries.length;
  }

  /**
   * Check if parameter was recently tuned
   */
  async wasRecentlyTuned(
    parameter: string,
    timeWindowMs: number = 300000
  ): Promise<boolean> {
    const entries = await this.getParameterHistory(parameter);
    if (entries.length === 0) {
      return false;
    }

    const lastEntry = entries[entries.length - 1];
    const timeSinceLastTune = Date.now() - lastEntry.timestamp;
    return timeSinceLastTune <= timeWindowMs;
  }

  /**
   * Get last tuning time for parameter
   */
  async getLastTuningTime(parameter: string): Promise<number | null> {
    const entries = await this.getParameterHistory(parameter);
    if (entries.length === 0) {
      return null;
    }

    const lastEntry = entries[entries.length - 1];
    return lastEntry.timestamp;
  }

  /**
   * Record manual change
   */
  async recordManualChange(parameter: string, value: number): Promise<void> {
    const entries = await this.getParameterHistory(parameter);
    const oldValue =
      entries.length > 0 ? entries[entries.length - 1].newValue : value;

    const entry: TuningHistoryEntry = {
      timestamp: Date.now(),
      parameter,
      oldValue,
      newValue: value,
      performanceBefore: await this.measureCurrentPerformance(),
      improvement: 0,
      successful: true,
      manual: true,
    };

    await this.record(entry);
  }

  /**
   * Clear history for parameter
   */
  async clearParameterHistory(parameter: string): Promise<void> {
    this.storage.delete(parameter);

    if (this.persistEnabled) {
      await this.saveToPersistence();
    }
  }

  /**
   * Clear all history
   */
  async clearAll(): Promise<void> {
    this.storage.clear();

    if (this.persistEnabled) {
      await this.saveToPersistence();
    }
  }

  /**
   * Export history as JSON
   */
  async exportAsJSON(): Promise<string> {
    const all = await this.getAll();
    return JSON.stringify(all, null, 2);
  }

  /**
   * Import history from JSON
   */
  async importFromJSON(json: string): Promise<void> {
    const entries = JSON.parse(json) as TuningHistoryEntry[];

    for (const entry of entries) {
      await this.record(entry);
    }
  }

  /**
   * Get summary statistics
   */
  async getSummary(): Promise<{
    totalTunings: number;
    successfulTunings: number;
    failedTunings: number;
    parametersTuned: number;
    mostTunedParameter: string | null;
    averageImprovement: number;
  }> {
    const all = await this.getAll();
    const successful = all.filter(e => e.successful === true);
    const failed = all.filter(e => e.successful === false);

    const parameters = new Set(all.map(e => e.parameter));

    // Find most tuned parameter
    const parameterCounts = new Map<string, number>();
    for (const entry of all) {
      parameterCounts.set(
        entry.parameter,
        (parameterCounts.get(entry.parameter) || 0) + 1
      );
    }

    let mostTunedParameter: string | null = null;
    let maxCount = 0;
    for (const [param, count] of parameterCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostTunedParameter = param;
      }
    }

    // Calculate average improvement
    const improvements = successful
      .filter(e => e.improvement !== undefined)
      .map(e => e.improvement!);

    const averageImprovement =
      improvements.length > 0
        ? improvements.reduce((a, b) => a + b, 0) / improvements.length
        : 0;

    return {
      totalTunings: all.length,
      successfulTunings: successful.length,
      failedTunings: failed.length,
      parametersTuned: parameters.size,
      mostTunedParameter,
      averageImprovement,
    };
  }

  /**
   * Load from persistence
   */
  private loadFromPersistence(): void {
    try {
      const storage = (
        globalThis as {
          localStorage?: {
            getItem: (key: string) => string | null;
            setItem: (key: string, value: string) => void;
          };
        }
      ).localStorage;
      if (storage) {
        const data = storage.getItem(this.persistKey);
        if (data) {
          const entries = JSON.parse(data) as TuningHistoryEntry[];
          for (const entry of entries) {
            const paramName = entry.parameter;
            const existing = this.storage.get(paramName) || [];
            existing.push(entry);
            this.storage.set(paramName, existing);
          }
        }
      }
    } catch (error) {
      console.error("[TuningHistory] Error loading from persistence:", error);
    }
  }

  /**
   * Save to persistence
   */
  private async saveToPersistence(): Promise<void> {
    try {
      const storage = (
        globalThis as {
          localStorage?: {
            getItem: (key: string) => string | null;
            setItem: (key: string, value: string) => void;
          };
        }
      ).localStorage;
      if (storage) {
        const all: TuningHistoryEntry[] = [];
        for (const entries of this.storage.values()) {
          all.push(...entries);
        }
        storage.setItem(this.persistKey, JSON.stringify(all));
      }
    } catch (error) {
      console.error("[TuningHistory] Error saving to persistence:", error);
    }
  }

  /**
   * Measure current performance (placeholder)
   */
  private async measureCurrentPerformance(): Promise<PerformanceMetrics> {
    // In a real implementation, this would gather actual metrics
    return {
      latency: { p50: 100, p95: 200, p99: 300 },
      throughput: 50,
      errorRate: 0.01,
      qualityScore: 0.9,
      costPerRequest: 0.001,
      resourceUsage: {
        memoryMB: 512,
        cpuPercent: 30,
      },
    };
  }
}

/**
 * Create a TuningHistory
 */
export function createTuningHistory(
  maxHistorySize?: number,
  persistEnabled?: boolean,
  persistKey?: string
): TuningHistory {
  return new TuningHistory(maxHistorySize, persistEnabled, persistKey);
}

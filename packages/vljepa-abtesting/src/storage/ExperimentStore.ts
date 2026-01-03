/**
 * @fileoverview ExperimentStore - Storage implementations for experiments
 * @author Aequor Project - Round 23 Agent 2
 * @version 1.0.0
 */

import type {
  Experiment,
  MetricValue,
  ConversionData,
  EngagementData,
  A2UIEvent,
  ExperimentStorage,
  ResultStorage,
  EventStorage,
} from "../types.js";

// ============================================================================
// COMBINED STORAGE
// ============================================================================

/**
 * CombinedStorage - Unified storage for all A/B testing data
 */
export class CombinedStorage
  implements ExperimentStorage, ResultStorage, EventStorage
{
  private experiments: Map<string, Experiment> = new Map();
  private metrics: Map<string, MetricValue[]> = new Map();
  private conversions: Map<string, ConversionData[]> = new Map();
  private engagements: Map<string, EngagementData[]> = new Map();
  private events: Map<string, A2UIEvent[]> = new Map();

  // ============================================================================
  // EXPERIMENT STORAGE
  // ============================================================================

  async getExperiment(id: string): Promise<Experiment | null> {
    return this.experiments.get(id) || null;
  }

  async saveExperiment(experiment: Experiment): Promise<void> {
    this.experiments.set(experiment.id, experiment);
  }

  async deleteExperiment(id: string): Promise<void> {
    this.experiments.delete(id);
    this.metrics.delete(id);
    this.conversions.delete(id);
    this.engagements.delete(id);
    this.events.delete(id);
  }

  async listExperiments(filter?: { status?: string }): Promise<Experiment[]> {
    let experiments = Array.from(this.experiments.values());
    if (filter?.status) {
      experiments = experiments.filter(e => e.status === filter.status);
    }
    return experiments.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  // ============================================================================
  // RESULT STORAGE
  // ============================================================================

  async saveMetric(value: MetricValue): Promise<void> {
    const key = `${value.experiment}:${value.variant}`;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    this.metrics.get(key)!.push(value);
  }

  async getMetrics(
    experimentId: string,
    variantId?: string
  ): Promise<MetricValue[]> {
    if (variantId) {
      return this.metrics.get(`${experimentId}:${variantId}`) || [];
    }

    const results: MetricValue[] = [];
    for (const [key, values] of this.metrics) {
      if (key.startsWith(experimentId + ":")) {
        results.push(...values);
      }
    }
    return results;
  }

  async saveConversion(conversion: ConversionData): Promise<void> {
    const key = `${conversion.experimentId}:${conversion.variantId}`;
    if (!this.conversions.has(key)) {
      this.conversions.set(key, []);
    }
    this.conversions.get(key)!.push(conversion);
  }

  async getConversions(
    experimentId: string,
    variantId?: string
  ): Promise<ConversionData[]> {
    if (variantId) {
      return this.conversions.get(`${experimentId}:${variantId}`) || [];
    }

    const results: ConversionData[] = [];
    for (const [key, values] of this.conversions) {
      if (key.startsWith(experimentId + ":")) {
        results.push(...values);
      }
    }
    return results;
  }

  async saveEngagement(engagement: EngagementData): Promise<void> {
    const key = `${engagement.experimentId}:${engagement.variantId}`;
    if (!this.engagements.has(key)) {
      this.engagements.set(key, []);
    }
    this.engagements.get(key)!.push(engagement);
  }

  async getEngagement(
    experimentId: string,
    variantId?: string
  ): Promise<EngagementData[]> {
    if (variantId) {
      return this.engagements.get(`${experimentId}:${variantId}`) || [];
    }

    const results: EngagementData[] = [];
    for (const [key, values] of this.engagements) {
      if (key.startsWith(experimentId + ":")) {
        results.push(...values);
      }
    }
    return results;
  }

  async clearResults(experimentId: string): Promise<void> {
    for (const key of this.metrics.keys()) {
      if (key.startsWith(experimentId + ":")) {
        this.metrics.delete(key);
      }
    }
    for (const key of this.conversions.keys()) {
      if (key.startsWith(experimentId + ":")) {
        this.conversions.delete(key);
      }
    }
    for (const key of this.engagements.keys()) {
      if (key.startsWith(experimentId + ":")) {
        this.engagements.delete(key);
      }
    }
  }

  // ============================================================================
  // EVENT STORAGE
  // ============================================================================

  async saveEvent(event: A2UIEvent): Promise<void> {
    const key = event.experimentId || "unknown";
    if (!this.events.has(key)) {
      this.events.set(key, []);
    }
    this.events.get(key)!.push(event);
  }

  async getEvents(experimentId: string, userId?: string): Promise<A2UIEvent[]> {
    const events = this.events.get(experimentId) || [];
    if (userId) {
      return events.filter(e => e.userId === userId);
    }
    return events;
  }

  async clearEvents(experimentId: string): Promise<void> {
    this.events.delete(experimentId);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /** Clear all data (for testing) */
  clear(): void {
    this.experiments.clear();
    this.metrics.clear();
    this.conversions.clear();
    this.engagements.clear();
    this.events.clear();
  }

  /** Get storage size (for testing) */
  size(): {
    experiments: number;
    metrics: number;
    conversions: number;
    engagements: number;
    events: number;
  } {
    let metrics = 0;
    let conversions = 0;
    let engagements = 0;
    let events = 0;

    for (const arr of this.metrics.values()) metrics += arr.length;
    for (const arr of this.conversions.values()) conversions += arr.length;
    for (const arr of this.engagements.values()) engagements += arr.length;
    for (const arr of this.events.values()) events += arr.length;

    return {
      experiments: this.experiments.size,
      metrics,
      conversions,
      engagements,
      events,
    };
  }
}

// ============================================================================
// PERSISTED STORAGE (localStorage-based)
// ============================================================================

/**
 * LocalStorageStorage - Browser-based persistent storage
 */
export class LocalStorageStorage implements ExperimentStorage, ResultStorage {
  private prefix = "abtest_";

  private getKey(type: string, id: string): string {
    return `${this.prefix}${type}_${id}`;
  }

  // ============================================================================
  // EXPERIMENT STORAGE
  // ============================================================================

  async getExperiment(id: string): Promise<Experiment | null> {
    if (typeof window === "undefined") return null;

    const data = localStorage.getItem(this.getKey("exp", id));
    if (!data) return null;

    try {
      const exp = JSON.parse(data);
      // Convert date strings back to Date objects
      exp.createdAt = new Date(exp.createdAt);
      exp.updatedAt = new Date(exp.updatedAt);
      if (exp.duration?.start)
        exp.duration.start = new Date(exp.duration.start);
      if (exp.duration?.end) exp.duration.end = new Date(exp.duration.end);
      return exp;
    } catch {
      return null;
    }
  }

  async saveExperiment(experiment: Experiment): Promise<void> {
    if (typeof window === "undefined") return;

    localStorage.setItem(
      this.getKey("exp", experiment.id),
      JSON.stringify(experiment)
    );
  }

  async deleteExperiment(id: string): Promise<void> {
    if (typeof window === "undefined") return;

    localStorage.removeItem(this.getKey("exp", id));

    // Also delete associated data
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(`${this.prefix}data_${id}`)) {
        localStorage.removeItem(key);
      }
    }
  }

  async listExperiments(filter?: { status?: string }): Promise<Experiment[]> {
    if (typeof window === "undefined") return [];

    const experiments: Experiment[] = [];
    const keys = Object.keys(localStorage);

    for (const key of keys) {
      if (key.startsWith(`${this.prefix}exp_`)) {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            const exp = JSON.parse(data);
            exp.createdAt = new Date(exp.createdAt);
            exp.updatedAt = new Date(exp.updatedAt);
            if (exp.duration?.start)
              exp.duration.start = new Date(exp.duration.start);
            if (exp.duration?.end)
              exp.duration.end = new Date(exp.duration.end);

            if (!filter?.status || exp.status === filter.status) {
              experiments.push(exp);
            }
          } catch {
            // Skip invalid entries
          }
        }
      }
    }

    return experiments.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  // ============================================================================
  // RESULT STORAGE
  // ============================================================================

  async saveMetric(value: MetricValue): Promise<void> {
    if (typeof window === "undefined") return;

    const key = this.getKey(
      "data",
      `${value.experiment}:${value.variant}:metrics`
    );
    const existing = localStorage.getItem(key);
    const metrics = existing ? JSON.parse(existing) : [];
    metrics.push(value);
    localStorage.setItem(key, JSON.stringify(metrics));
  }

  async getMetrics(
    experimentId: string,
    variantId?: string
  ): Promise<MetricValue[]> {
    if (typeof window === "undefined") return [];

    if (variantId) {
      const key = this.getKey("data", `${experimentId}:${variantId}:metrics`);
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    }

    const results: MetricValue[] = [];
    const prefix = `${this.prefix}data_${experimentId}:`;
    const keys = Object.keys(localStorage);

    for (const key of keys) {
      if (key.startsWith(prefix) && key.endsWith(":metrics")) {
        const data = localStorage.getItem(key);
        if (data) {
          results.push(...JSON.parse(data));
        }
      }
    }

    return results;
  }

  async saveConversion(conversion: ConversionData): Promise<void> {
    if (typeof window === "undefined") return;

    const key = this.getKey(
      "data",
      `${conversion.experimentId}:${conversion.variantId}:conversions`
    );
    const existing = localStorage.getItem(key);
    const conversions = existing ? JSON.parse(existing) : [];
    conversions.push(conversion);
    localStorage.setItem(key, JSON.stringify(conversions));
  }

  async getConversions(
    experimentId: string,
    variantId?: string
  ): Promise<ConversionData[]> {
    if (typeof window === "undefined") return [];

    if (variantId) {
      const key = this.getKey(
        "data",
        `${experimentId}:${variantId}:conversions`
      );
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    }

    const results: ConversionData[] = [];
    const prefix = `${this.prefix}data_${experimentId}:`;
    const keys = Object.keys(localStorage);

    for (const key of keys) {
      if (key.startsWith(prefix) && key.endsWith(":conversions")) {
        const data = localStorage.getItem(key);
        if (data) {
          results.push(...JSON.parse(data));
        }
      }
    }

    return results;
  }

  async saveEngagement(engagement: EngagementData): Promise<void> {
    if (typeof window === "undefined") return;

    const key = this.getKey(
      "data",
      `${engagement.experimentId}:${engagement.variantId}:engagements`
    );
    const existing = localStorage.getItem(key);
    const engagements = existing ? JSON.parse(existing) : [];
    engagements.push(engagement);
    localStorage.setItem(key, JSON.stringify(engagements));
  }

  async getEngagement(
    experimentId: string,
    variantId?: string
  ): Promise<EngagementData[]> {
    if (typeof window === "undefined") return [];

    if (variantId) {
      const key = this.getKey(
        "data",
        `${experimentId}:${variantId}:engagements`
      );
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    }

    const results: EngagementData[] = [];
    const prefix = `${this.prefix}data_${experimentId}:`;
    const keys = Object.keys(localStorage);

    for (const key of keys) {
      if (key.startsWith(prefix) && key.endsWith(":engagements")) {
        const data = localStorage.getItem(key);
        if (data) {
          results.push(...JSON.parse(data));
        }
      }
    }

    return results;
  }

  async clearResults(experimentId: string): Promise<void> {
    if (typeof window === "undefined") return;

    const prefix = `${this.prefix}data_${experimentId}:`;
    const keys = Object.keys(localStorage);

    for (const key of keys) {
      if (key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create in-memory storage
 */
export function createInMemoryStorage(): CombinedStorage {
  return new CombinedStorage();
}

/**
 * Create localStorage-based storage (browser only)
 */
export function createLocalStorageStorage(): LocalStorageStorage {
  return new LocalStorageStorage();
}

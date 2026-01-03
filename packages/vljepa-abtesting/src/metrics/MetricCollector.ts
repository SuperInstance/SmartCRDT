/**
 * @fileoverview MetricCollector - Collect and track A/B test metrics
 * @author Aequor Project - Round 23 Agent 2
 * @version 1.0.0
 */

import type {
  MetricValue,
  MetricType,
  MetricSummary,
  ConversionData,
  EngagementData,
  ResultStorage,
} from "../types.js";

// ============================================================================
// METRIC COLLECTOR
// ============================================================================

/**
 * MetricCollector - Collect and aggregate metrics for A/B tests
 *
 * Tracks conversions, engagement, revenue, and custom metrics.
 */
export class MetricCollector {
  private storage: ResultStorage;
  private metricBuffer: Map<string, MetricValue[]> = new Map();
  private bufferSize = 100;

  constructor(storage: ResultStorage, bufferSize?: number) {
    this.storage = storage;
    if (bufferSize) {
      this.bufferSize = bufferSize;
    }
  }

  /**
   * Record a metric value
   */
  async recordMetric(value: MetricValue): Promise<void> {
    const key = `${value.experiment}:${value.variant}`;

    // Buffer the metric
    if (!this.metricBuffer.has(key)) {
      this.metricBuffer.set(key, []);
    }
    const buffer = this.metricBuffer.get(key)!;
    buffer.push(value);

    // Flush if buffer is full
    if (buffer.length >= this.bufferSize) {
      await this.flushBuffer(key);
    }
  }

  /**
   * Record a conversion
   */
  async recordConversion(conversion: ConversionData): Promise<void> {
    // Also record as a metric
    await this.recordMetric({
      name: "conversion",
      type: "conversion",
      value: conversion.value || 1,
      timestamp: conversion.timestamp,
      userId: conversion.userId,
      variant: conversion.variantId,
      experiment: conversion.experimentId,
      metadata: conversion.metadata,
    });

    await this.storage.saveConversion(conversion);
  }

  /**
   * Record an engagement event
   */
  async recordEngagement(engagement: EngagementData): Promise<void> {
    // Record as individual metrics
    await this.recordMetric({
      name: "duration",
      type: "engagement",
      value: engagement.duration,
      timestamp: engagement.timestamp,
      userId: engagement.userId,
      variant: engagement.variantId,
      experiment: engagement.experimentId,
      metadata: engagement.metadata,
    });

    await this.recordMetric({
      name: "interactions",
      type: "engagement",
      value: engagement.interactions,
      timestamp: engagement.timestamp,
      userId: engagement.userId,
      variant: engagement.variantId,
      experiment: engagement.experimentId,
      metadata: engagement.metadata,
    });

    await this.recordMetric({
      name: "page_views",
      type: "engagement",
      value: engagement.pageViews,
      timestamp: engagement.timestamp,
      userId: engagement.userId,
      variant: engagement.variantId,
      experiment: engagement.experimentId,
      metadata: engagement.metadata,
    });

    await this.storage.saveEngagement(engagement);
  }

  /**
   * Track a goal completion
   */
  async trackGoal(
    experimentId: string,
    variantId: string,
    userId: string,
    goalId: string,
    value?: number
  ): Promise<void> {
    await this.recordMetric({
      name: `goal_${goalId}`,
      type: "conversion",
      value: value || 1,
      timestamp: Date.now(),
      userId,
      variant: variantId,
      experiment: experimentId,
      metadata: { goalId },
    });
  }

  /**
   * Get metric summary for a variant
   */
  async getMetricSummary(
    experimentId: string,
    variantId: string,
    metricName: string
  ): Promise<MetricSummary | null> {
    const metrics = await this.storage.getMetrics(experimentId, variantId);
    const filtered = metrics.filter(m => m.name === metricName);

    if (filtered.length === 0) {
      return null;
    }

    return this.calculateSummary(filtered);
  }

  /**
   * Get all metric summaries for a variant
   */
  async getAllMetricSummaries(
    experimentId: string,
    variantId: string
  ): Promise<Map<string, MetricSummary>> {
    const metrics = await this.storage.getMetrics(experimentId, variantId);
    const summaries = new Map<string, MetricSummary>();

    // Group by metric name
    const grouped = new Map<string, MetricValue[]>();
    for (const metric of metrics) {
      if (!grouped.has(metric.name)) {
        grouped.set(metric.name, []);
      }
      grouped.get(metric.name)!.push(metric);
    }

    // Calculate summaries
    for (const [name, values] of grouped) {
      summaries.set(name, this.calculateSummary(values));
    }

    return summaries;
  }

  /**
   * Get conversion rate for a variant
   */
  async getConversionRate(
    experimentId: string,
    variantId: string
  ): Promise<number> {
    const conversions = await this.storage.getConversions(
      experimentId,
      variantId
    );
    const uniqueUsers = new Set(conversions.map(c => c.userId));

    if (uniqueUsers.size === 0) {
      return 0;
    }

    const converted = uniqueUsers.size;
    // Need total unique users from metrics
    const metrics = await this.storage.getMetrics(experimentId, variantId);
    const totalUsers = new Set(metrics.map(m => m.userId)).size;

    return totalUsers > 0 ? converted / totalUsers : 0;
  }

  /**
   * Get average engagement metrics
   */
  async getAverageEngagement(
    experimentId: string,
    variantId: string
  ): Promise<{ duration: number; interactions: number; pageViews: number }> {
    const engagements = await this.storage.getEngagement(
      experimentId,
      variantId
    );

    if (engagements.length === 0) {
      return { duration: 0, interactions: 0, pageViews: 0 };
    }

    const totalDuration = engagements.reduce((sum, e) => sum + e.duration, 0);
    const totalInteractions = engagements.reduce(
      (sum, e) => sum + e.interactions,
      0
    );
    const totalPageViews = engagements.reduce((sum, e) => sum + e.pageViews, 0);

    return {
      duration: totalDuration / engagements.length,
      interactions: totalInteractions / engagements.length,
      pageViews: totalPageViews / engagements.length,
    };
  }

  /**
   * Flush buffered metrics to storage
   */
  async flushBuffer(key?: string): Promise<void> {
    if (key) {
      const buffer = this.metricBuffer.get(key);
      if (buffer) {
        for (const metric of buffer) {
          await this.storage.saveMetric(metric);
        }
        this.metricBuffer.delete(key);
      }
    } else {
      // Flush all buffers
      for (const [bufferKey, buffer] of this.metricBuffer) {
        for (const metric of buffer) {
          await this.storage.saveMetric(metric);
        }
      }
      this.metricBuffer.clear();
    }
  }

  /**
   * Clear all metrics for an experiment
   */
  async clearMetrics(experimentId: string): Promise<void> {
    await this.storage.clearResults(experimentId);
    this.metricBuffer.clear();
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Calculate summary statistics for metrics
   */
  private calculateSummary(values: MetricValue[]): MetricSummary {
    const numericValues = values.map(v => v.value).sort((a, b) => a - b);
    const count = numericValues.length;
    const sum = numericValues.reduce((a, b) => a + b, 0);
    const mean = sum / count;
    const variance =
      numericValues.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / count;
    const stdDev = Math.sqrt(variance);

    const median = this.calculatePercentile(numericValues, 50);

    return {
      metricId: values[0].name,
      variantId: values[0].variant,
      count,
      sum,
      mean,
      variance,
      stdDev,
      min: numericValues[0],
      max: numericValues[count - 1],
      median,
      percentiles: {
        p25: this.calculatePercentile(numericValues, 25),
        p75: this.calculatePercentile(numericValues, 75),
        p90: this.calculatePercentile(numericValues, 90),
        p95: this.calculatePercentile(numericValues, 95),
        p99: this.calculatePercentile(numericValues, 99),
      },
    };
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(
    sortedValues: number[],
    percentile: number
  ): number {
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (upper >= sortedValues.length) {
      return sortedValues[sortedValues.length - 1];
    }

    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }
}

// ============================================================================
// CONVERSION TRACKER
// ============================================================================

/**
 * ConversionTracker - Track conversion events
 */
export class ConversionTracker {
  private collector: MetricCollector;

  constructor(collector: MetricCollector) {
    this.collector = collector;
  }

  /**
   * Track a conversion event
   */
  async trackConversion(
    experimentId: string,
    variantId: string,
    userId: string,
    converted: boolean,
    value?: number,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.collector.recordConversion({
      userId,
      variantId,
      experimentId,
      converted,
      value,
      timestamp: Date.now(),
      metadata,
    });
  }

  /**
   * Track purchase
   */
  async trackPurchase(
    experimentId: string,
    variantId: string,
    userId: string,
    revenue: number,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.trackConversion(experimentId, variantId, userId, true, revenue, {
      ...metadata,
      type: "purchase",
    });
  }

  /**
   * Track signup
   */
  async trackSignup(
    experimentId: string,
    variantId: string,
    userId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.trackConversion(experimentId, variantId, userId, true, 1, {
      ...metadata,
      type: "signup",
    });
  }

  /**
   * Track click-through
   */
  async trackClick(
    experimentId: string,
    variantId: string,
    userId: string,
    targetUrl: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.trackConversion(experimentId, variantId, userId, true, 1, {
      ...metadata,
      type: "click",
      targetUrl,
    });
  }
}

// ============================================================================
// ENGAGEMENT TRACKER
// ============================================================================

/**
 * EngagementTracker - Track user engagement
 */
export class EngagementTracker {
  private collector: MetricCollector;
  private sessions: Map<
    string,
    { startTime: number; interactions: number; pageViews: number }
  > = new Map();

  constructor(collector: MetricCollector) {
    this.collector = collector;
  }

  /**
   * Start a session
   */
  startSession(userId: string): void {
    this.sessions.set(userId, {
      startTime: Date.now(),
      interactions: 0,
      pageViews: 0,
    });
  }

  /**
   * Track an interaction
   */
  trackInteraction(
    userId: string,
    experimentId: string,
    variantId: string
  ): void {
    const session = this.sessions.get(userId);
    if (session) {
      session.interactions++;
    }
  }

  /**
   * Track a page view
   */
  trackPageView(userId: string, experimentId: string, variantId: string): void {
    const session = this.sessions.get(userId);
    if (session) {
      session.pageViews++;
    }
  }

  /**
   * End a session and record engagement
   */
  async endSession(
    userId: string,
    experimentId: string,
    variantId: string
  ): Promise<void> {
    const session = this.sessions.get(userId);
    if (!session) {
      return;
    }

    const duration = Date.now() - session.startTime;

    await this.collector.recordEngagement({
      userId,
      variantId,
      experimentId,
      duration,
      interactions: session.interactions,
      pageViews: session.pageViews,
      timestamp: Date.now(),
    });

    this.sessions.delete(userId);
  }
}

// ============================================================================
// IN-MEMORY STORAGE (Default implementation)
// ============================================================================

/**
 * In-memory storage for metrics (for development/testing)
 */
export class InMemoryResultStorage implements ResultStorage {
  private metrics: Map<string, MetricValue[]> = new Map();
  private conversions: Map<string, ConversionData[]> = new Map();
  private engagements: Map<string, EngagementData[]> = new Map();

  private getKey(experimentId: string, variantId?: string): string {
    return variantId ? `${experimentId}:${variantId}` : experimentId;
  }

  async saveMetric(value: MetricValue): Promise<void> {
    const key = this.getKey(value.experiment, value.variant);
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    this.metrics.get(key)!.push(value);
  }

  async getMetrics(
    experimentId: string,
    variantId?: string
  ): Promise<MetricValue[]> {
    const key = this.getKey(experimentId, variantId);
    const results: MetricValue[] = [];

    if (variantId) {
      return this.metrics.get(key) || [];
    }

    // Get all metrics for experiment
    for (const [k, values] of this.metrics) {
      if (k.startsWith(experimentId + ":")) {
        results.push(...values);
      }
    }
    return results;
  }

  async saveConversion(conversion: ConversionData): Promise<void> {
    const key = this.getKey(conversion.experimentId, conversion.variantId);
    if (!this.conversions.has(key)) {
      this.conversions.set(key, []);
    }
    this.conversions.get(key)!.push(conversion);
  }

  async getConversions(
    experimentId: string,
    variantId?: string
  ): Promise<ConversionData[]> {
    const key = this.getKey(experimentId, variantId);
    if (variantId) {
      return this.conversions.get(key) || [];
    }

    const results: ConversionData[] = [];
    for (const [k, values] of this.conversions) {
      if (k.startsWith(experimentId + ":")) {
        results.push(...values);
      }
    }
    return results;
  }

  async saveEngagement(engagement: EngagementData): Promise<void> {
    const key = this.getKey(engagement.experimentId, engagement.variantId);
    if (!this.engagements.has(key)) {
      this.engagements.set(key, []);
    }
    this.engagements.get(key)!.push(engagement);
  }

  async getEngagement(
    experimentId: string,
    variantId?: string
  ): Promise<EngagementData[]> {
    const key = this.getKey(experimentId, variantId);
    if (variantId) {
      return this.engagements.get(key) || [];
    }

    const results: EngagementData[] = [];
    for (const [k, values] of this.engagements) {
      if (k.startsWith(experimentId + ":")) {
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

  /** Clear all data (for testing) */
  clear(): void {
    this.metrics.clear();
    this.conversions.clear();
    this.engagements.clear();
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a metric collector with default in-memory storage
 */
export function createMetricCollector(bufferSize?: number): MetricCollector {
  const storage = new InMemoryResultStorage();
  return new MetricCollector(storage, bufferSize);
}

/**
 * Create a conversion tracker
 */
export function createConversionTracker(
  collector: MetricCollector
): ConversionTracker {
  return new ConversionTracker(collector);
}

/**
 * Create an engagement tracker
 */
export function createEngagementTracker(
  collector: MetricCollector
): EngagementTracker {
  return new EngagementTracker(collector);
}

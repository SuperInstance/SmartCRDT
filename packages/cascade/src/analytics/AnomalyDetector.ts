/**
 * AnomalyDetector - Cache behavior anomaly detection
 *
 * Detects unusual patterns in cache behavior using statistical analysis
 * and machine learning techniques.
 *
 * Features:
 * - Hit rate drop detection
 * - Latency spike detection
 * - Memory leak detection
 * - Eviction storm detection
 * - Similarity distribution shift detection
 * - Query pattern change detection
 * - Confidence scoring
 * - Automatic alerting
 */

import type {
  Anomaly,
  AnomalyDetectionConfig,
  AnomalyDetectionResult,
  AnomalySeverity,
  AnomalyType,
  CacheMetricsSnapshot,
  HistoricalDataPoint,
} from "@lsi/protocol";

/**
 * Baseline statistics for anomaly detection
 */
interface BaselineStatistics {
  /** Mean value */
  mean: number;
  /** Standard deviation */
  stdDev: number;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Sample count */
  count: number;
  /** Calculated at timestamp */
  calculatedAt: number;
}

/**
 * AnomalyDetector - Statistical anomaly detection for cache metrics
 */
export class AnomalyDetector {
  private config: AnomalyDetectionConfig;
  private baseline: BaselineStatistics | null = null;
  private activeAnomalies: Map<string, Anomaly> = new Map();
  private anomalyHistory: Anomaly[] = [];
  private detectionHistory: HistoricalDataPoint[] = [];

  constructor(config: AnomalyDetectionConfig) {
    this.config = config;
  }

  /**
   * Detect anomalies in current metrics
   */
  detect(snapshot: CacheMetricsSnapshot): AnomalyDetectionResult {
    const anomalies: Anomaly[] = [];
    const now = Date.now();

    // Update baseline if not set or needs recalculation
    this.updateBaseline();

    // Detect hit rate drop
    const hitRateAnomaly = this.detectHitRateDrop(snapshot);
    if (hitRateAnomaly) {
      anomalies.push(hitRateAnomaly);
    }

    // Detect latency spike
    const latencyAnomaly = this.detectLatencySpike(snapshot);
    if (latencyAnomaly) {
      anomalies.push(latencyAnomaly);
    }

    // Detect memory leak
    const memoryAnomaly = this.detectMemoryLeak(snapshot);
    if (memoryAnomaly) {
      anomalies.push(memoryAnomaly);
    }

    // Detect eviction storm
    const evictionAnomaly = this.detectEvictionStorm(snapshot);
    if (evictionAnomaly) {
      anomalies.push(evictionAnomaly);
    }

    // Detect similarity shift
    const similarityAnomaly = this.detectSimilarityShift(snapshot);
    if (similarityAnomaly) {
      anomalies.push(similarityAnomaly);
    }

    // Detect pattern change
    const patternAnomaly = this.detectPatternChange(snapshot);
    if (patternAnomaly) {
      anomalies.push(patternAnomaly);
    }

    // Update active anomalies
    this.updateActiveAnomalies(anomalies);

    // Add to history
    this.anomalyHistory.push(...anomalies);
    this.trimHistory();

    // Calculate counts
    const activeCount = this.activeAnomalies.size;
    const criticalCount = Array.from(this.activeAnomalies.values()).filter(
      (a) => a.severity === "critical"
    ).length;

    return {
      anomalies,
      totalCount: this.anomalyHistory.length,
      activeCount,
      criticalCount,
      timestamp: now,
      nextDetectionTime: now + this.config.detectionWindow,
    };
  }

  /**
   * Get all active anomalies
   */
  getActiveAnomalies(): Anomaly[] {
    return Array.from(this.activeAnomalies.values());
  }

  /**
   * Get anomaly history
   */
  getHistory(limit?: number): Anomaly[] {
    const history = this.anomalyHistory.slice().sort((a, b) => b.detectedAt - a.detectedAt);
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Resolve an anomaly
   */
  resolveAnomaly(anomalyId: string): void {
    const anomaly = this.activeAnomalies.get(anomalyId);
    if (anomaly) {
      anomaly.active = false;
      anomaly.resolvedAt = Date.now();
      this.activeAnomalies.delete(anomalyId);
    }
  }

  /**
   * Update baseline statistics
   */
  private updateBaseline(): void {
    if (this.detectionHistory.length < 10) {
      return; // Need more data
    }

    const recentPoints = this.detectionHistory.slice(-this.config.baselineWindow);
    const hitRates = recentPoints.map((p) => p.hitRate);

    this.baseline = this.calculateBaseline(hitRates);
  }

  /**
   * Detect hit rate drop
   */
  private detectHitRateDrop(snapshot: CacheMetricsSnapshot): Anomaly | null {
    if (!this.baseline) {
      return null;
    }

    const current = snapshot.hitRate.overall;
    const expected = this.baseline.mean;
    const deviation = expected - current;
    const deviationPercent = deviation / expected;

    if (deviationPercent < this.config.hitRateDropThreshold) {
      return null;
    }

    return this.createAnomaly({
      type: "hit_rate_drop",
      severity: this.calculateSeverity(deviationPercent),
      currentValue: current,
      expectedValue: expected,
      deviation,
      deviationPercent,
      description: `Hit rate dropped by ${(deviationPercent * 100).toFixed(1)}% from baseline`,
      relatedMetrics: ["hitRate", "cacheHits", "cacheMisses"],
      suggestedActions: [
        "Check similarity threshold - may be too strict",
        "Review recent query patterns for changes",
        "Verify cache warming is effective",
      ],
    });
  }

  /**
   * Detect latency spike
   */
  private detectLatencySpike(snapshot: CacheMetricsSnapshot): Anomaly | null {
    if (!this.baseline) {
      return null;
    }

    const current = snapshot.latency.p95;
    const expected = this.baseline.mean;
    const deviation = current - expected;
    const deviationPercent = deviation / expected;

    if (deviationPercent < this.config.latencySpikeMultiplier - 1) {
      return null;
    }

    return this.createAnomaly({
      type: "latency_spike",
      severity: this.calculateSeverity(deviationPercent),
      currentValue: current,
      expectedValue: expected,
      deviation,
      deviationPercent,
      description: `P95 latency increased by ${(deviationPercent * 100).toFixed(1)}% from baseline`,
      relatedMetrics: ["latency", "p95Latency", "p99Latency"],
      suggestedActions: [
        "Check for external service dependencies",
        "Review cache size and memory usage",
        "Examine eviction rate - may be causing cache thrashing",
      ],
    });
  }

  /**
   * Detect memory leak
   */
  private detectMemoryLeak(snapshot: CacheMetricsSnapshot): Anomaly | null {
    if (snapshot.memory.trend !== "growing") {
      return null;
    }

    const growthRate = this.calculateMemoryGrowthRate(snapshot);

    if (growthRate < this.config.memoryGrowthRate) {
      return null;
    }

    return this.createAnomaly({
      type: "memory_leak",
      severity: growthRate > 0.2 ? "critical" : "high",
      currentValue: snapshot.memory.currentUsage,
      expectedValue: snapshot.memory.peakUsage * 0.8,
      deviation: snapshot.memory.currentUsage - snapshot.memory.peakUsage * 0.8,
      deviationPercent: growthRate,
      description: `Memory growing at ${(growthRate * 100).toFixed(1)}%/minute - possible leak`,
      relatedMetrics: ["memoryUsage", "cacheSize", "evictionRate"],
      suggestedActions: [
        "Review cache size limits and eviction policy",
        "Check for entry size changes",
        "Investigate potential memory leaks in cache entries",
      ],
    });
  }

  /**
   * Detect eviction storm
   */
  private detectEvictionStorm(snapshot: CacheMetricsSnapshot): Anomaly | null {
    const currentRate = snapshot.entries.evictionRate;

    if (currentRate < this.config.evictionStormThreshold) {
      return null;
    }

    return this.createAnomaly({
      type: "eviction_storm",
      severity: currentRate > 50 ? "critical" : "high",
      currentValue: currentRate,
      expectedValue: 1,
      deviation: currentRate - 1,
      deviationPercent: (currentRate - 1) / 1,
      description: `High eviction rate: ${currentRate.toFixed(1)} evictions/second`,
      relatedMetrics: ["evictionRate", "cacheSize", "hitRate"],
      suggestedActions: [
        "Increase cache size if memory allows",
        "Adjust TTL to reduce entry expiration",
        "Review cache warming strategy",
      ],
    });
  }

  /**
   * Detect similarity distribution shift
   */
  private detectSimilarityShift(snapshot: CacheMetricsSnapshot): Anomaly | null {
    if (!this.baseline) {
      return null;
    }

    const current = snapshot.similarity.average;
    const expected = this.baseline.mean;
    const deviation = Math.abs(current - expected);
    const stdDevs = this.baseline.stdDev > 0 ? deviation / this.baseline.stdDev : 0;

    if (stdDevs < this.config.similarityShiftThreshold) {
      return null;
    }

    return this.createAnomaly({
      type: "similarity_shift",
      severity: stdDevs > 3 ? "high" : "medium",
      currentValue: current,
      expectedValue: expected,
      deviation,
      deviationPercent: stdDevs,
      description: `Similarity distribution shifted by ${stdDevs.toFixed(1)} standard deviations`,
      relatedMetrics: ["similarity", "hitRate", "threshold"],
      suggestedActions: [
        "Review query patterns - may have changed",
        "Consider adaptive threshold adjustment",
        "Check embedding model for changes",
      ],
    });
  }

  /**
   * Detect query pattern change
   */
  private detectPatternChange(snapshot: CacheMetricsSnapshot): Anomaly | null {
    const repetitionRate = snapshot.patterns.repetitionRate;
    const expectedRate = 0.3; // 30% is typical
    const deviation = Math.abs(repetitionRate - expectedRate);
    const deviationPercent = deviation / expectedRate;

    if (deviationPercent < 0.5) {
      return null; // Less than 50% change
    }

    const direction = repetitionRate < expectedRate ? "decreased" : "increased";

    return this.createAnomaly({
      type: "pattern_change",
      severity: deviationPercent > 0.8 ? "medium" : "low",
      currentValue: repetitionRate,
      expectedValue: expectedRate,
      deviation,
      deviationPercent,
      description: `Query repetition rate ${direction} by ${(deviationPercent * 100).toFixed(1)}%`,
      relatedMetrics: ["repetitionRate", "hitRate", "queryFrequency"],
      suggestedActions: [
        "Analyze new query patterns",
        "Update cache warming strategy",
        "Consider threshold adjustment for new patterns",
      ],
    });
  }

  /**
   * Create anomaly object
   */
  private createAnomaly(params: {
    type: AnomalyType;
    severity: AnomalySeverity;
    currentValue: number;
    expectedValue: number;
    deviation: number;
    deviationPercent: number;
    description: string;
    relatedMetrics: string[];
    suggestedActions: string[];
  }): Anomaly {
    const confidence = this.calculateConfidence(params.deviationPercent);

    return {
      id: this.generateAnomalyId(),
      detectedAt: Date.now(),
      type: params.type,
      severity: params.severity,
      description: params.description,
      currentValue: params.currentValue,
      expectedValue: params.expectedValue,
      deviation: params.deviation,
      deviationPercent: params.deviationPercent,
      confidence,
      relatedMetrics: params.relatedMetrics,
      suggestedActions: params.suggestedActions,
      active: true,
    };
  }

  /**
   * Calculate anomaly severity
   */
  private calculateSeverity(deviationPercent: number): AnomalySeverity {
    if (deviationPercent > 1.0) {
      return "critical";
    } else if (deviationPercent > 0.5) {
      return "high";
    } else if (deviationPercent > 0.2) {
      return "medium";
    } else {
      return "low";
    }
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(deviationPercent: number): number {
    // Higher deviation = higher confidence
    const rawConfidence = Math.min(1, deviationPercent / 2);
    return Math.max(this.config.minConfidence, rawConfidence);
  }

  /**
   * Calculate memory growth rate
   */
  private calculateMemoryGrowthRate(snapshot: CacheMetricsSnapshot): number {
    // Simplified: use trend information
    if (snapshot.memory.trend === "growing") {
      // Estimate growth rate based on usage and trend
      const current = snapshot.memory.currentUsage;
      const peak = snapshot.memory.peakUsage;
      return (current / peak - 1) * 2; // Approximate %/minute
    }
    return 0;
  }

  /**
   * Calculate baseline statistics
   */
  private calculateBaseline(values: number[]): BaselineStatistics {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return {
      mean,
      stdDev,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length,
      calculatedAt: Date.now(),
    };
  }

  /**
   * Update active anomalies
   */
  private updateActiveAnomalies(newAnomalies: Anomaly[]): void {
    // Mark existing anomalies as inactive if not in new list
    const newIds = new Set(newAnomalies.map((a) => a.id));
    for (const [id, anomaly] of this.activeAnomalies) {
      if (!newIds.has(id)) {
        anomaly.active = false;
        anomaly.resolvedAt = Date.now();
        this.activeAnomalies.delete(id);
      }
    }

    // Add new anomalies
    for (const anomaly of newAnomalies) {
      this.activeAnomalies.set(anomaly.id, anomaly);
    }
  }

  /**
   * Generate unique anomaly ID
   */
  private generateAnomalyId(): string {
    return `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Trim anomaly history
   */
  private trimHistory(): void {
    const maxSize = 1000;
    while (this.anomalyHistory.length > maxSize) {
      this.anomalyHistory.shift();
    }
  }

  /**
   * Add detection data point
   */
  addDetectionDataPoint(point: HistoricalDataPoint): void {
    this.detectionHistory.push(point);

    // Keep only recent history
    const maxHistory = Math.floor(
      this.config.baselineWindow / (60 * 1000) * 2
    );
    while (this.detectionHistory.length > maxHistory) {
      this.detectionHistory.shift();
    }
  }

  /**
   * Get baseline statistics
   */
  getBaseline(): BaselineStatistics | null {
    return this.baseline;
  }

  /**
   * Reset detector state
   */
  reset(): void {
    this.baseline = null;
    this.activeAnomalies.clear();
    this.anomalyHistory = [];
    this.detectionHistory = [];
  }
}

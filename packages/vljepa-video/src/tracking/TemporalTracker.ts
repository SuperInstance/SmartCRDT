/**
 * @lsi/vljepa-video/tracking/TemporalTracker
 *
 * Temporal tracker for tracking temporal patterns in video streams.
 *
 * @version 1.0.0
 */

import type { VideoFrame, ProcessedFrame } from "../types.js";

/**
 * Temporal pattern
 */
export interface TemporalPattern {
  /** Pattern type */
  type: "periodic" | "trending" | "burst" | "anomaly";

  /** Pattern confidence */
  confidence: number;

  /** Pattern duration (frames) */
  duration: number;

  /** Pattern frequency (for periodic) */
  frequency?: number;

  /** Pattern direction (for trending) */
  direction?: "increasing" | "decreasing";

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Temporal tracking result
 */
export interface TemporalResult {
  /** Frame identifier */
  frameId: number;

  /** Timestamp */
  timestamp: number;

  /** Temporal patterns detected */
  patterns: TemporalPattern[];

  /** Temporal context (recent embeddings) */
  context: Float32Array[];

  /** Predicted next embedding */
  predicted?: Float32Array;

  /** Anomaly score */
  anomalyScore: number;
}

/**
 * Temporal tracker
 *
 * Tracks temporal patterns and provides predictions.
 */
export class TemporalTracker {
  private embeddingHistory: Array<{
    embedding: Float32Array;
    timestamp: number;
    frameId: number;
  }> = [];
  private maxHistory: number = 30;
  private anomalyThreshold: number = 0.5;

  /**
   * Update with new embedding
   */
  update(frameId: number, embedding: Float32Array): TemporalResult {
    const timestamp = performance.now();

    // Add to history
    this.embeddingHistory.push({ embedding, timestamp, frameId });

    // Trim history
    if (this.embeddingHistory.length > this.maxHistory) {
      this.embeddingHistory.shift();
    }

    // Get temporal context
    const context = this.getContext(5);

    // Detect patterns
    const patterns = this.detectPatterns();

    // Predict next embedding
    const predicted = this.predictNext();

    // Calculate anomaly score
    const anomalyScore = this.calculateAnomalyScore(embedding);

    return {
      frameId,
      timestamp,
      patterns,
      context,
      predicted,
      anomalyScore,
    };
  }

  /**
   * Get temporal context
   */
  getContext(windowSize: number = 5): Float32Array[] {
    const start = Math.max(0, this.embeddingHistory.length - windowSize);
    return this.embeddingHistory.slice(start).map(h => h.embedding);
  }

  /**
   * Detect temporal patterns
   */
  private detectPatterns(): TemporalPattern[] {
    const patterns: TemporalPattern[] = [];

    if (this.embeddingHistory.length < 3) {
      return patterns;
    }

    // Calculate temporal differences
    const diffs: number[] = [];
    for (let i = 1; i < this.embeddingHistory.length; i++) {
      const diff = this.calculateEmbeddingDiff(
        this.embeddingHistory[i].embedding,
        this.embeddingHistory[i - 1].embedding
      );
      diffs.push(diff);
    }

    // Detect periodic pattern
    const periodicPattern = this.detectPeriodicPattern(diffs);
    if (periodicPattern) {
      patterns.push(periodicPattern);
    }

    // Detect trending pattern
    const trendingPattern = this.detectTrendingPattern(diffs);
    if (trendingPattern) {
      patterns.push(trendingPattern);
    }

    // Detect burst pattern
    const burstPattern = this.detectBurstPattern(diffs);
    if (burstPattern) {
      patterns.push(burstPattern);
    }

    return patterns;
  }

  /**
   * Detect periodic pattern
   */
  private detectPeriodicPattern(diffs: number[]): TemporalPattern | null {
    if (diffs.length < 6) {
      return null;
    }

    // Calculate autocorrelation
    const autocorr = this.calculateAutocorrelation(diffs);

    // Find peaks
    const peaks: number[] = [];
    for (let i = 1; i < autocorr.length - 1; i++) {
      if (autocorr[i] > autocorr[i - 1] && autocorr[i] > autocorr[i + 1]) {
        peaks.push(i);
      }
    }

    // Check if there's a consistent period
    if (peaks.length >= 2) {
      const periods: number[] = [];
      for (let i = 1; i < peaks.length; i++) {
        periods.push(peaks[i] - peaks[i - 1]);
      }

      const avgPeriod = periods.reduce((a, b) => a + b, 0) / periods.length;
      const variance =
        periods.reduce((sum, p) => sum + (p - avgPeriod) ** 2, 0) /
        periods.length;
      const stdDev = Math.sqrt(variance);

      // Consistent period if low variance
      if (stdDev < avgPeriod * 0.3) {
        return {
          type: "periodic",
          confidence: Math.min(1, autocorr[peaks[0]]),
          duration: diffs.length,
          frequency: avgPeriod,
        };
      }
    }

    return null;
  }

  /**
   * Detect trending pattern
   */
  private detectTrendingPattern(diffs: number[]): TemporalPattern | null {
    if (diffs.length < 5) {
      return null;
    }

    // Calculate linear regression
    const n = diffs.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += diffs[i];
      sumXY += i * diffs[i];
      sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    let ssRes = 0;
    let ssTot = 0;
    const meanY = sumY / n;

    for (let i = 0; i < n; i++) {
      const yPred = slope * i + intercept;
      ssRes += (diffs[i] - yPred) ** 2;
      ssTot += (diffs[i] - meanY) ** 2;
    }

    const rSquared = 1 - ssRes / ssTot;

    // Check if significant trend
    if (rSquared > 0.7) {
      return {
        type: "trending",
        confidence: rSquared,
        duration: diffs.length,
        direction: slope > 0 ? "increasing" : "decreasing",
      };
    }

    return null;
  }

  /**
   * Detect burst pattern
   */
  private detectBurstPattern(diffs: number[]): TemporalPattern | null {
    if (diffs.length < 3) {
      return null;
    }

    // Calculate mean and std dev
    const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const variance =
      diffs.reduce((sum, d) => sum + (d - mean) ** 2, 0) / diffs.length;
    const stdDev = Math.sqrt(variance);

    // Look for spikes (> 2 std dev from mean)
    const threshold = mean + 2 * stdDev;
    const spikes = diffs.filter(d => d > threshold);

    if (spikes.length > 0) {
      return {
        type: "burst",
        confidence: Math.min(1, spikes.length / diffs.length),
        duration: diffs.length,
        metadata: { spikeCount: spikes.length, threshold },
      };
    }

    return null;
  }

  /**
   * Predict next embedding
   */
  private predictNext(): Float32Array | null {
    if (this.embeddingHistory.length < 2) {
      return null;
    }

    const prev =
      this.embeddingHistory[this.embeddingHistory.length - 2].embedding;
    const curr =
      this.embeddingHistory[this.embeddingHistory.length - 1].embedding;
    const predicted = new Float32Array(curr.length);

    // Simple linear extrapolation
    for (let i = 0; i < curr.length; i++) {
      const diff = curr[i] - prev[i];
      predicted[i] = curr[i] + diff;
    }

    return predicted;
  }

  /**
   * Calculate anomaly score
   */
  private calculateAnomalyScore(embedding: Float32Array): number {
    if (this.embeddingHistory.length < 3) {
      return 0;
    }

    // Calculate average difference to recent embeddings
    let totalDiff = 0;
    const context = this.getContext(5);

    for (const contextEmbedding of context) {
      totalDiff += this.calculateEmbeddingDiff(embedding, contextEmbedding);
    }

    const avgDiff = totalDiff / context.length;

    // Normalize to 0-1 range
    return Math.min(1, avgDiff / this.anomalyThreshold);
  }

  /**
   * Calculate embedding difference
   */
  private calculateEmbeddingDiff(
    emb1: Float32Array,
    emb2: Float32Array
  ): number {
    let diff = 0;
    const len = Math.min(emb1.length, emb2.length);

    for (let i = 0; i < len; i++) {
      diff += Math.abs(emb1[i] - emb2[i]);
    }

    return diff / len;
  }

  /**
   * Calculate autocorrelation
   */
  private calculateAutocorrelation(series: number[]): number[] {
    const n = series.length;
    const mean = series.reduce((a, b) => a + b, 0) / n;
    const variance =
      series.reduce((sum, val) => sum + (val - mean) ** 2, 0) / n;

    if (variance === 0) {
      return new Array(n).fill(0);
    }

    const autocorr: number[] = [];
    for (let lag = 0; lag < n; lag++) {
      let sum = 0;
      for (let i = 0; i < n - lag; i++) {
        sum += (series[i] - mean) * (series[i + lag] - mean);
      }
      autocorr.push(sum / ((n - lag) * variance));
    }

    return autocorr;
  }

  /**
   * Get temporal statistics
   */
  getStats(): {
    historyLength: number;
    avgEmbeddingDiff: number;
    detectedPatterns: string[];
    anomalyRate: number;
  } {
    if (this.embeddingHistory.length < 2) {
      return {
        historyLength: this.embeddingHistory.length,
        avgEmbeddingDiff: 0,
        detectedPatterns: [],
        anomalyRate: 0,
      };
    }

    // Calculate average embedding difference
    let totalDiff = 0;
    let count = 0;

    for (let i = 1; i < this.embeddingHistory.length; i++) {
      totalDiff += this.calculateEmbeddingDiff(
        this.embeddingHistory[i].embedding,
        this.embeddingHistory[i - 1].embedding
      );
      count++;
    }

    const avgDiff = totalDiff / count;

    // Count anomalies
    let anomalies = 0;
    for (const entry of this.embeddingHistory) {
      const score = this.calculateAnomalyScore(entry.embedding);
      if (score > this.anomalyThreshold) {
        anomalies++;
      }
    }

    return {
      historyLength: this.embeddingHistory.length,
      avgEmbeddingDiff: avgDiff,
      detectedPatterns: [],
      anomalyRate: anomalies / this.embeddingHistory.length,
    };
  }

  /**
   * Clear history
   */
  clear(): void {
    this.embeddingHistory = [];
  }

  /**
   * Set anomaly threshold
   */
  setAnomalyThreshold(threshold: number): void {
    this.anomalyThreshold = threshold;
  }
}

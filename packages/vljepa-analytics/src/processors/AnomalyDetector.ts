/**
 * AnomalyDetector - Detects anomalies in metrics
 */

import type { Anomaly, AnomalyConfig, AnomalyAlgorithm } from "../types.js";

export class AnomalyDetector {
  private config: AnomalyConfig;

  constructor(config: Partial<AnomalyConfig> = {}) {
    this.config = {
      algorithm: config.algorithm ?? "zscore",
      sensitivity: config.sensitivity ?? 0.8,
      windowSize: config.windowSize ?? 20,
      minDataPoints: config.minDataPoints ?? 10,
    };
  }

  /**
   * Detect anomalies in data
   */
  detect(
    metric: string,
    data: Array<{ timestamp: number; value: number }>
  ): Anomaly[] {
    if (data.length < this.config.minDataPoints) {
      return [];
    }

    switch (this.config.algorithm) {
      case "zscore":
        return this.detectZScore(metric, data);
      case "iqr":
        return this.detectIQR(metric, data);
      case "moving_average":
        return this.detectMovingAverage(metric, data);
      default:
        return [];
    }
  }

  /**
   * Z-score based anomaly detection
   */
  private detectZScore(
    metric: string,
    data: Array<{ timestamp: number; value: number }>
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const values = data.map(d => d.value);

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;
    const stdDev = Math.sqrt(variance);

    const threshold = stdDev * 3; // 3 sigma

    for (let i = 0; i < data.length; i++) {
      const zScore = stdDev > 0 ? (data[i].value - mean) / stdDev : 0;

      if (Math.abs(zScore) > 3) {
        anomalies.push({
          id: this.generateId(),
          metric,
          timestamp: data[i].timestamp,
          value: data[i].value,
          expected: mean,
          deviation: Math.abs(zScore),
          score: Math.min(1, Math.abs(zScore) / 3),
          severity: Math.abs(zScore) > 4 ? "high" : "medium",
          description: `Value ${data[i].value} is ${zScore > 0 ? "above" : "below"} expected (z-score: ${zScore.toFixed(2)})`,
        });
      }
    }

    return anomalies;
  }

  /**
   * IQR (Interquartile Range) based anomaly detection
   */
  private detectIQR(
    metric: string,
    data: Array<{ timestamp: number; value: number }>
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const values = [...data.map(d => d.value)].sort((a, b) => a - b);

    const q1Index = Math.floor(values.length * 0.25);
    const q3Index = Math.floor(values.length * 0.75);
    const q1 = values[q1Index];
    const q3 = values[q3Index];
    const iqr = q3 - q1;

    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    for (const point of data) {
      if (point.value < lowerBound || point.value > upperBound) {
        anomalies.push({
          id: this.generateId(),
          metric,
          timestamp: point.timestamp,
          value: point.value,
          expected: (q1 + q3) / 2,
          deviation: Math.abs(point.value - (q1 + q3) / 2),
          score: Math.min(1, Math.abs(point.value - (q1 + q3) / 2) / iqr),
          severity:
            Math.abs(point.value - (q1 + q3) / 2) > 2 * iqr ? "high" : "medium",
          description: `Value ${point.value} is outside normal range [${lowerBound.toFixed(2)}, ${upperBound.toFixed(2)}]`,
        });
      }
    }

    return anomalies;
  }

  /**
   * Moving average based anomaly detection
   */
  private detectMovingAverage(
    metric: string,
    data: Array<{ timestamp: number; value: number }>
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const window = this.config.windowSize;

    for (let i = window; i < data.length; i++) {
      const windowData = data.slice(i - window, i);
      const avg = windowData.reduce((sum, d) => sum + d.value, 0) / window;
      const stdDev = Math.sqrt(
        windowData.reduce((sum, d) => sum + Math.pow(d.value - avg, 2), 0) /
          window
      );

      const current = data[i];
      const zScore = stdDev > 0 ? (current.value - avg) / stdDev : 0;

      if (Math.abs(zScore) > 3) {
        anomalies.push({
          id: this.generateId(),
          metric,
          timestamp: current.timestamp,
          value: current.value,
          expected: avg,
          deviation: Math.abs(zScore),
          score: Math.min(1, Math.abs(zScore) / 3),
          severity: Math.abs(zScore) > 4 ? "high" : "medium",
          description: `Value ${current.value} deviates from moving average ${avg.toFixed(2)}`,
        });
      }
    }

    return anomalies;
  }

  /**
   * Update config
   */
  updateConfig(updates: Partial<AnomalyConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get anomaly score for a value
   */
  getAnomalyScore(
    value: number,
    history: number[]
  ): { score: number; isAnomaly: boolean } {
    if (history.length < this.config.minDataPoints) {
      return { score: 0, isAnomaly: false };
    }

    const mean = history.reduce((a, b) => a + b, 0) / history.length;
    const variance =
      history.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      history.length;
    const stdDev = Math.sqrt(variance);

    const zScore = stdDev > 0 ? Math.abs(value - mean) / stdDev : 0;
    const score = Math.min(1, zScore / 3);

    return {
      score,
      isAnomaly: score > 1 - this.config.sensitivity,
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `anomaly-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

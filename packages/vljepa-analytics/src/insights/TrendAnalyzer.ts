/**
 * TrendAnalyzer - Analyzes trends in metrics over time
 */

import type { QueryOptions, DateRange } from "../types.js";

export interface TrendData {
  metric: string;
  direction: "up" | "down" | "stable";
  slope: number;
  correlation: number;
  confidence: number;
  startDate: Date;
  endDate: Date;
}

export interface SeasonalityData {
  metric: string;
  period: "daily" | "weekly" | "monthly";
  strength: number;
  pattern: number[];
}

export class TrendAnalyzer {
  /**
   * Analyze trend
   */
  analyzeTrend(
    data: Array<{ timestamp: number; value: number }>
  ): TrendData | null {
    if (data.length < 2) return null;

    const n = data.length;
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumX2 = 0;

    for (let i = 0; i < n; i++) {
      const x = i;
      const y = data[i].value;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const yMean = sumY / n;
    let ssRes = 0,
      ssTot = 0;

    for (let i = 0; i < n; i++) {
      const y = data[i].value;
      const yPred = slope * i + intercept;
      ssRes += Math.pow(y - yPred, 2);
      ssTot += Math.pow(y - yMean, 2);
    }

    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;
    const correlation = Math.sqrt(Math.max(0, rSquared));

    return {
      metric: "",
      direction: slope > 0.01 ? "up" : slope < -0.01 ? "down" : "stable",
      slope,
      correlation,
      confidence: correlation,
      startDate: new Date(data[0].timestamp),
      endDate: new Date(data[data.length - 1].timestamp),
    };
  }

  /**
   * Detect seasonality
   */
  detectSeasonality(
    data: Array<{ timestamp: number; value: number }>,
    period: "daily" | "weekly" | "monthly" = "weekly"
  ): SeasonalityData | null {
    if (
      data.length < period === "daily" ? 24 : period === "weekly" ? 7 * 24 : 30
    ) {
      return null;
    }

    // Group by period
    const buckets = new Map<number, number[]>();
    const periodMs =
      period === "daily"
        ? 24 * 60 * 60 * 1000
        : period === "weekly"
          ? 7 * 24 * 60 * 60 * 1000
          : 30 * 24 * 60 * 60 * 1000;

    for (const point of data) {
      const bucket =
        Math.floor(point.timestamp / periodMs) %
        (period === "daily" ? 24 : period === "weekly" ? 7 : 30);
      if (!buckets.has(bucket)) {
        buckets.set(bucket, []);
      }
      buckets.get(bucket)!.push(point.value);
    }

    // Calculate pattern
    const pattern: number[] = [];
    for (let i = 0; i < buckets.size; i++) {
      const values = buckets.get(i) || [];
      pattern.push(
        values.length > 0
          ? values.reduce((a, b) => a + b, 0) / values.length
          : 0
      );
    }

    // Calculate seasonality strength
    const mean = pattern.reduce((a, b) => a + b, 0) / pattern.length;
    const variance =
      pattern.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      pattern.length;
    const strength = variance > 0 ? Math.sqrt(variance) / mean : 0;

    return {
      metric: "",
      period,
      strength: Math.min(1, strength),
      pattern,
    };
  }

  /**
   * Compare trends
   */
  compareTrends(
    trend1: TrendData,
    trend2: TrendData
  ): {
    diverging: boolean;
    convergenceRate: number;
  } {
    const diverging =
      (trend1.direction === "up" && trend2.direction === "down") ||
      (trend1.direction === "down" && trend2.direction === "up");

    const convergenceRate = Math.abs(trend1.slope - trend2.slope);

    return {
      diverging,
      convergenceRate,
    };
  }

  /**
   * Forecast values
   */
  forecast(
    data: Array<{ timestamp: number; value: number }>,
    periods: number
  ): Array<{ timestamp: number; value: number; confidence: number }> {
    const trend = this.analyzeTrend(data);
    if (!trend) return [];

    const lastTimestamp = data[data.length - 1].timestamp;
    const interval =
      data.length > 1 ? data[1].timestamp - data[0].timestamp : 1;
    const lastValue = data[data.length - 1].value;

    const forecast: Array<{
      timestamp: number;
      value: number;
      confidence: number;
    }> = [];

    for (let i = 1; i <= periods; i++) {
      const timestamp = lastTimestamp + i * interval;
      const value = lastValue + trend.slope * i * data.length;

      forecast.push({
        timestamp,
        value,
        confidence: trend.correlation * Math.pow(0.95, i), // Decay confidence
      });
    }

    return forecast;
  }

  /**
   * Detect change points
   */
  detectChangePoints(
    data: Array<{ timestamp: number; value: number }>,
    windowSize: number = 10
  ): Array<{ index: number; timestamp: number; magnitude: number }> {
    const changePoints: Array<{
      index: number;
      timestamp: number;
      magnitude: number;
    }> = [];

    for (let i = windowSize; i < data.length - windowSize; i++) {
      const before = data.slice(i - windowSize, i).map(d => d.value);
      const after = data.slice(i, i + windowSize).map(d => d.value);

      const meanBefore = before.reduce((a, b) => a + b, 0) / before.length;
      const meanAfter = after.reduce((a, b) => a + b, 0) / after.length;

      const magnitude = Math.abs(meanAfter - meanBefore) / (meanBefore || 1);

      if (magnitude > 0.1) {
        // 10% change threshold
        changePoints.push({
          index: i,
          timestamp: data[i].timestamp,
          magnitude,
        });
      }
    }

    return changePoints;
  }

  /**
   * Calculate moving average
   */
  calculateMovingAverage(
    data: Array<{ timestamp: number; value: number }>,
    window: number
  ): Array<{ timestamp: number; value: number; smoothed: number }> {
    const result: Array<{
      timestamp: number;
      value: number;
      smoothed: number;
    }> = [];

    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - window + 1);
      const windowData = data.slice(start, i + 1);
      const smoothed =
        windowData.reduce((sum, d) => sum + d.value, 0) / windowData.length;

      result.push({
        timestamp: data[i].timestamp,
        value: data[i].value,
        smoothed,
      });
    }

    return result;
  }
}

/**
 * Forecaster - Forecasts future metric values based on historical data
 */

import type { DateRange } from "../types.js";

export interface ForecastData {
  metric: string;
  forecasts: Array<{
    timestamp: number;
    value: number;
    lowerBound: number;
    upperBound: number;
    confidence: number;
  }>;
  method: "linear" | "moving_average" | "exponential_smoothing";
  accuracy: number;
  dateRange: DateRange;
}

export class Forecaster {
  /**
   * Generate forecast
   */
  forecast(
    data: Array<{ timestamp: number; value: number }>,
    periods: number,
    method: "linear" | "moving_average" | "exponential_smoothing" = "linear"
  ): ForecastData {
    const forecasts =
      method === "linear"
        ? this.linearForecast(data, periods)
        : method === "moving_average"
          ? this.movingAverageForecast(data, periods)
          : this.exponentialSmoothingForecast(data, periods);

    // Calculate accuracy on historical data
    const accuracy = this.calculateAccuracy(data, method);

    return {
      metric: "",
      forecasts,
      method,
      accuracy,
      dateRange: {
        start: new Date(data[0]?.timestamp || Date.now()),
        end: new Date(forecasts[forecasts.length - 1]?.timestamp || Date.now()),
      },
    };
  }

  /**
   * Linear regression forecast
   */
  private linearForecast(
    data: Array<{ timestamp: number; value: number }>,
    periods: number
  ): Array<{
    timestamp: number;
    value: number;
    lowerBound: number;
    upperBound: number;
    confidence: number;
  }> {
    if (data.length < 2) return [];

    const n = data.length;
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += data[i].value;
      sumXY += i * data[i].value;
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate standard error
    let se = 0;
    for (let i = 0; i < n; i++) {
      const predicted = slope * i + intercept;
      se += Math.pow(data[i].value - predicted, 2);
    }
    se = Math.sqrt(se / (n - 2));

    const forecasts = [];
    const interval =
      data.length > 1 ? data[1].timestamp - data[0].timestamp : 1;

    for (let i = 1; i <= periods; i++) {
      const x = n + i - 1;
      const value = slope * x + intercept;
      const margin =
        1.96 *
        se *
        Math.sqrt(1 + 1 / n + Math.pow(x - data.length / 2, 2) / sumX2);

      forecasts.push({
        timestamp: data[data.length - 1].timestamp + i * interval,
        value,
        lowerBound: value - margin,
        upperBound: value + margin,
        confidence: Math.max(0, 1 - i * 0.05), // Decreasing confidence
      });
    }

    return forecasts;
  }

  /**
   * Moving average forecast
   */
  private movingAverageForecast(
    data: Array<{ timestamp: number; value: number }>,
    periods: number,
    window: number = 5
  ): Array<{
    timestamp: number;
    value: number;
    lowerBound: number;
    upperBound: number;
    confidence: number;
  }> {
    if (data.length < window) return [];

    const forecasts = [];
    const interval =
      data.length > 1 ? data[1].timestamp - data[0].timestamp : 1;

    for (let i = 1; i <= periods; i++) {
      const start = Math.max(0, data.length - window);
      const windowData = data.slice(start);
      const avg =
        windowData.reduce((sum, d) => sum + d.value, 0) / windowData.length;
      const std = Math.sqrt(
        windowData.reduce((sum, d) => sum + Math.pow(d.value - avg, 2), 0) /
          windowData.length
      );

      forecasts.push({
        timestamp: data[data.length - 1].timestamp + i * interval,
        value: avg,
        lowerBound: avg - 1.96 * std,
        upperBound: avg + 1.96 * std,
        confidence: Math.max(0, 1 - i * 0.1),
      });
    }

    return forecasts;
  }

  /**
   * Exponential smoothing forecast
   */
  private exponentialSmoothingForecast(
    data: Array<{ timestamp: number; value: number }>,
    periods: number,
    alpha: number = 0.3
  ): Array<{
    timestamp: number;
    value: number;
    lowerBound: number;
    upperBound: number;
    confidence: number;
  }> {
    if (data.length < 2) return [];

    // Calculate smoothed values
    const smoothed = [data[0].value];
    for (let i = 1; i < data.length; i++) {
      smoothed.push(alpha * data[i].value + (1 - alpha) * smoothed[i - 1]);
    }

    // Calculate residuals
    const residuals = data.map((d, i) => d.value - smoothed[i]);
    const std = Math.sqrt(
      residuals.reduce((sum, r) => sum + r * r, 0) / residuals.length
    );

    const forecasts = [];
    const interval =
      data.length > 1 ? data[1].timestamp - data[0].timestamp : 1;
    let lastSmoothed = smoothed[smoothed.length - 1];

    for (let i = 1; i <= periods; i++) {
      // For exponential smoothing, forecast is the last smoothed value
      const value = lastSmoothed;

      forecasts.push({
        timestamp: data[data.length - 1].timestamp + i * interval,
        value,
        lowerBound: value - 1.96 * std,
        upperBound: value + 1.96 * std,
        confidence: Math.max(0, 1 - i * 0.08),
      });
    }

    return forecasts;
  }

  /**
   * Calculate forecast accuracy using backtesting
   */
  private calculateAccuracy(
    data: Array<{ timestamp: number; value: number }>,
    method: string
  ): number {
    if (data.length < 10) return 0;

    // Use last 20% of data for validation
    const splitIndex = Math.floor(data.length * 0.8);
    const trainData = data.slice(0, splitIndex);
    const testData = data.slice(splitIndex);

    // Generate forecasts for test period
    const forecasts =
      method === "linear"
        ? this.linearForecast(trainData, testData.length)
        : method === "moving_average"
          ? this.movingAverageForecast(trainData, testData.length)
          : this.exponentialSmoothingForecast(trainData, testData.length);

    // Calculate MAPE (Mean Absolute Percentage Error)
    let mape = 0;
    let validPoints = 0;

    for (let i = 0; i < Math.min(forecasts.length, testData.length); i++) {
      if (testData[i].value !== 0) {
        mape += Math.abs(
          (testData[i].value - forecasts[i].value) / testData[i].value
        );
        validPoints++;
      }
    }

    return validPoints > 0 ? Math.max(0, 1 - mape / validPoints) : 0;
  }

  /**
   * Compare forecast methods
   */
  compareMethods(
    data: Array<{ timestamp: number; value: number }>,
    periods: number
  ): Array<{
    method: "linear" | "moving_average" | "exponential_smoothing";
    accuracy: number;
    recommended: boolean;
  }> {
    const methods: Array<
      "linear" | "moving_average" | "exponential_smoothing"
    > = ["linear", "moving_average", "exponential_smoothing"];

    const results = methods.map(method => ({
      method,
      accuracy: this.calculateAccuracy(data, method),
      recommended: false,
    }));

    // Mark best method as recommended
    const best = results.reduce((prev, current) =>
      current.accuracy > prev.accuracy ? current : prev
    );
    best.recommended = true;

    return results;
  }

  /**
   * Detect seasonality in data
   */
  detectSeasonality(data: Array<{ timestamp: number; value: number }>): {
    detected: boolean;
    period: number | null;
    strength: number;
  } {
    // Simple autocorrelation-based seasonality detection
    const maxLag = Math.min(100, Math.floor(data.length / 2));
    const values = data.map(d => d.value);

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;

    if (variance === 0) return { detected: false, period: null, strength: 0 };

    let bestLag = 0;
    let bestCorrelation = 0;

    for (let lag = 1; lag <= maxLag; lag++) {
      let correlation = 0;
      for (let i = 0; i < values.length - lag; i++) {
        correlation += (values[i] - mean) * (values[i + lag] - mean);
      }
      correlation /= (values.length - lag) * variance;

      if (Math.abs(correlation) > Math.abs(bestCorrelation)) {
        bestCorrelation = correlation;
        bestLag = lag;
      }
    }

    return {
      detected: Math.abs(bestCorrelation) > 0.3,
      period: bestLag > 0 ? bestLag : null,
      strength: Math.abs(bestCorrelation),
    };
  }
}

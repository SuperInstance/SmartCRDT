/**
 * ThresholdChecker - Checks metric values against thresholds
 */

import type { AlertRule, AlertSeverity } from "../types.js";

export interface ThresholdCheckResult {
  triggered: boolean;
  severity: AlertSeverity;
  message: string;
  actualValue: number;
  threshold: number | [number, number];
  condition: string;
  deviation?: number;
}

export class ThresholdChecker {
  /**
   * Check a single threshold
   */
  check(value: number, rule: AlertRule): ThresholdCheckResult {
    const threshold = rule.threshold;
    let triggered = false;
    let deviation: number | undefined;

    switch (rule.condition) {
      case "gt":
        triggered = value > (threshold as number);
        deviation = triggered ? value - (threshold as number) : undefined;
        break;
      case "lt":
        triggered = value < (threshold as number);
        deviation = triggered ? (threshold as number) - value : undefined;
        break;
      case "eq":
        triggered = value === (threshold as number);
        break;
      case "gte":
        triggered = value >= (threshold as number);
        deviation = triggered ? value - (threshold as number) : undefined;
        break;
      case "lte":
        triggered = value <= (threshold as number);
        deviation = triggered ? (threshold as number) - value : undefined;
        break;
      case "outside":
        triggered =
          value < (threshold as [number, number])[0] ||
          value > (threshold as [number, number])[1];
        if (triggered) {
          deviation =
            value < (threshold as [number, number])[0]
              ? (threshold as [number, number])[0] - value
              : value - (threshold as [number, number])[1];
        }
        break;
      case "inside":
        triggered =
          value >= (threshold as [number, number])[0] &&
          value <= (threshold as [number, number])[1];
        break;
    }

    return {
      triggered,
      severity: rule.severity,
      message: this.formatMessage(rule, value, triggered),
      actualValue: value,
      threshold,
      condition: rule.condition,
      deviation,
    };
  }

  /**
   * Check multiple thresholds
   */
  checkMultiple(value: number, rules: AlertRule[]): ThresholdCheckResult[] {
    return rules
      .filter(rule => rule.enabled)
      .map(rule => this.check(value, rule))
      .filter(result => result.triggered);
  }

  /**
   * Format alert message
   */
  private formatMessage(
    rule: AlertRule,
    value: number,
    triggered: boolean
  ): string {
    const threshold = rule.threshold;
    const operator = this.getOperatorLabel(rule.condition);

    if (triggered) {
      return `${rule.name}: ${rule.metric} is ${value.toFixed(2)}, which is ${operator} threshold ${threshold}`;
    }

    return `${rule.name}: ${rule.metric} is ${value.toFixed(2)}`;
  }

  /**
   * Get operator label
   */
  private getOperatorLabel(condition: string): string {
    const labels: Record<string, string> = {
      gt: "greater than",
      lt: "less than",
      eq: "equal to",
      gte: "greater than or equal to",
      lte: "less than or equal to",
      outside: "outside",
      inside: "inside",
    };

    return labels[condition] || condition;
  }

  /**
   * Calculate dynamic threshold based on historical data
   */
  calculateDynamicThreshold(
    history: number[],
    stdDevs: number = 2
  ): { lower: number; upper: number; mean: number } {
    const mean = history.reduce((a, b) => a + b, 0) / history.length;
    const variance =
      history.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      history.length;
    const stdDev = Math.sqrt(variance);

    return {
      lower: mean - stdDevs * stdDev,
      upper: mean + stdDevs * stdDev,
      mean,
    };
  }

  /**
   * Check percentage change
   */
  checkPercentageChange(
    currentValue: number,
    previousValue: number,
    thresholdPercent: number,
    severity: AlertSeverity = "warning"
  ): ThresholdCheckResult | null {
    if (previousValue === 0) return null;

    const changePercent =
      ((currentValue - previousValue) / previousValue) * 100;
    const triggered = Math.abs(changePercent) >= thresholdPercent;

    return {
      triggered,
      severity,
      message: triggered
        ? `Value changed by ${changePercent.toFixed(1)}% (threshold: ${thresholdPercent}%)`
        : `Value changed by ${changePercent.toFixed(1)}%`,
      actualValue: currentValue,
      threshold: thresholdPercent,
      condition: changePercent > 0 ? "gt" : "lt",
      deviation: changePercent,
    };
  }

  /**
   * Check rate of change
   */
  checkRateOfChange(
    values: number[],
    maxRate: number,
    timeWindow: number
  ): ThresholdCheckResult | null {
    if (values.length < 2) return null;

    const recentValues = values.slice(-timeWindow);
    const rates = [];

    for (let i = 1; i < recentValues.length; i++) {
      const rate = Math.abs(recentValues[i] - recentValues[i - 1]);
      rates.push(rate);
    }

    const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
    const triggered = avgRate > maxRate;

    return {
      triggered,
      severity: triggered ? "warning" : "info",
      message: triggered
        ? `Average rate of change (${avgRate.toFixed(2)}) exceeds threshold (${maxRate})`
        : `Rate of change is normal`,
      actualValue: avgRate,
      threshold: maxRate,
      condition: "gt",
      deviation: triggered ? avgRate - maxRate : undefined,
    };
  }

  /**
   * Check for stale data
   */
  checkStaleData(lastUpdate: number, maxAge: number): ThresholdCheckResult {
    const age = Date.now() - lastUpdate;
    const triggered = age > maxAge;

    return {
      triggered,
      severity: triggered ? "warning" : "info",
      message: triggered
        ? `Data is stale (${Math.floor(age / 1000)}s old, max: ${maxAge / 1000}s)`
        : "Data is fresh",
      actualValue: age,
      threshold: maxAge,
      condition: "gt",
      deviation: triggered ? age - maxAge : undefined,
    };
  }

  /**
   * Predict threshold breach
   */
  predictBreach(
    history: number[],
    threshold: number,
    periods: number = 5
  ): {
    willBreach: boolean;
    predictedPeriod?: number;
    confidence: number;
  } | null {
    if (history.length < 3) return null;

    // Simple linear regression
    const n = history.length;
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += history[i];
      sumXY += i * history[i];
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared for confidence
    const yMean = sumY / n;
    let ssRes = 0,
      ssTot = 0;

    for (let i = 0; i < n; i++) {
      const yPred = slope * i + intercept;
      ssRes += Math.pow(history[i] - yPred, 2);
      ssTot += Math.pow(history[i] - yMean, 2);
    }

    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    // Predict future values
    for (let i = 1; i <= periods; i++) {
      const predicted = slope * (n + i - 1) + intercept;

      if (predicted > threshold) {
        return {
          willBreach: true,
          predictedPeriod: i,
          confidence: Math.max(0, Math.min(1, rSquared)),
        };
      }
    }

    return { willBreach: false, confidence: rSquared };
  }
}

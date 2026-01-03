/**
 * @fileoverview Model drift detection
 * @description Detects accuracy, data, and concept drift in deployed models
 */

import type {
  DriftDetectorConfig,
  DriftReport,
  DriftType,
  DriftSeverity,
  DriftRecommendation,
  DriftStatistics,
} from "../types.js";

/**
 * Sliding window for metrics tracking
 */
interface MetricsWindow {
  values: number[];
  maxSize: number;
}

/**
 * Drift detector for model monitoring
 */
export class DriftDetector {
  private config: DriftDetectorConfig;
  private baselineWindow: MetricsWindow;
  private currentWindow: MetricsWindow;
  private alertHistory: DriftReport[];

  constructor(config: DriftDetectorConfig) {
    this.config = config;
    this.baselineWindow = { values: [], maxSize: config.windowSize };
    this.currentWindow = { values: [], maxSize: config.windowSize };
    this.alertHistory = [];
  }

  /**
   * Set baseline metrics
   * @param values Baseline metric values
   */
  setBaseline(values: number[]): void {
    this.baselineWindow.values = values.slice(-this.baselineWindow.maxSize);
  }

  /**
   * Add current metric value
   * @param value Current metric value
   */
  addCurrentValue(value: number): void {
    this.currentWindow.values.push(value);
    if (this.currentWindow.values.length > this.currentWindow.maxSize) {
      this.currentWindow.values.shift();
    }
  }

  /**
   * Detect drift
   * @param modelId Model ID
   * @param version Model version
   * @returns Drift report or undefined if not enough data
   */
  async detectDrift(
    modelId: string,
    version: string
  ): Promise<DriftReport | undefined> {
    if (this.baselineWindow.values.length < this.config.minSamples) {
      return undefined;
    }

    if (this.currentWindow.values.length < this.config.minSamples) {
      return undefined;
    }

    const baselineMean = this.mean(this.baselineWindow.values);
    const currentMean = this.mean(this.currentWindow.values);
    const baselineStd = this.std(this.baselineWindow.values);
    const currentStd = this.std(this.currentWindow.values);

    // Detect drift based on method
    let detected = false;
    let driftMagnitude = 0;
    let pValue = 1;
    let statistics: DriftStatistics;

    switch (this.config.method) {
      case "ks_test":
        ({ detected, driftMagnitude, pValue, statistics } =
          this.performKSTest());
        break;
      case "chi_square":
        ({ detected, driftMagnitude, pValue, statistics } =
          this.performChiSquareTest());
        break;
      case "psi":
        ({ detected, driftMagnitude, pValue, statistics } =
          this.calculatePSI());
        break;
      case "kl_divergence":
        ({ detected, driftMagnitude, pValue, statistics } =
          this.calculateKLDivergence());
        break;
      case "adaptive":
        ({ detected, driftMagnitude, pValue, statistics } =
          this.performAdaptiveTest());
        break;
      default:
        ({ detected, driftMagnitude, pValue, statistics } = this.performZTest(
          baselineMean,
          currentMean,
          baselineStd,
          currentStd
        ));
    }

    if (!detected) {
      return undefined;
    }

    // Determine drift type and severity
    const driftType = this.classifyDriftType(baselineMean, currentMean);
    const severity = this.classifySeverity(driftMagnitude);
    const recommendation = this.generateRecommendation(driftType, severity);

    const report: DriftReport = {
      model: modelId,
      version,
      detected: true,
      driftType,
      severity,
      baseline: baselineMean,
      current: currentMean,
      drift: driftMagnitude,
      pValue,
      detectedAt: Date.now(),
      affected: [this.config.metric],
      recommendation,
      statistics,
    };

    this.alertHistory.push(report);

    // Send alert if configured
    if (this.config.alertOnDrift && this.config.alertWebhook) {
      await this.sendAlert(report);
    }

    return report;
  }

  /**
   * Perform Kolmogorov-Smirnov test
   * @returns Test results
   */
  private performKSTest(): {
    detected: boolean;
    driftMagnitude: number;
    pValue: number;
    statistics: DriftStatistics;
  } {
    const combined = [
      ...this.baselineWindow.values,
      ...this.currentWindow.values,
    ];
    combined.sort((a, b) => a - b);

    const n1 = this.baselineWindow.values.length;
    const n2 = this.currentWindow.values.length;

    // Calculate empirical CDFs and KS statistic
    let maxD = 0;
    let cdf1 = 0;
    let cdf2 = 0;
    let i1 = 0;
    let i2 = 0;

    for (const value of combined) {
      while (i1 < n1 && this.baselineWindow.values[i1] <= value) {
        cdf1++;
        i1++;
      }
      while (i2 < n2 && this.currentWindow.values[i2] <= value) {
        cdf2++;
        i2++;
      }
      const d = Math.abs(cdf1 / n1 - cdf2 / n2);
      maxD = Math.max(maxD, d);
    }

    // Approximate p-value
    const criticalValue = 1.36 * Math.sqrt((n1 + n2) / (n1 * n2));
    const detected = maxD > criticalValue || maxD > this.config.threshold;
    const pValue = 2 * Math.exp((-2 * maxD * maxD * n1 * n2) / (n1 + n2));

    return {
      detected,
      driftMagnitude: maxD,
      pValue,
      statistics: {
        statistic: maxD,
        pValue,
        confidenceInterval: [maxD - 0.05, maxD + 0.05],
        effectSize: maxD,
        sampleSize: n1 + n2,
      },
    };
  }

  /**
   * Perform chi-square test
   * @returns Test results
   */
  private performChiSquareTest(): {
    detected: boolean;
    driftMagnitude: number;
    pValue: number;
    statistics: DriftStatistics;
  } {
    // Bin the data
    const bins = this.createBins();
    const baselineBinned = this.binData(this.baselineWindow.values, bins);
    const currentBinned = this.binData(this.currentWindow.values, bins);

    // Calculate chi-square statistic
    let chiSquare = 0;
    for (let i = 0; i < bins.length - 1; i++) {
      const expected = baselineBinned[i];
      const observed = currentBinned[i];
      if (expected > 0) {
        chiSquare += Math.pow(observed - expected, 2) / expected;
      }
    }

    const degreesOfFreedom = bins.length - 2;
    const pValue = 1 - this.chiSquareCDF(chiSquare, degreesOfFreedom);
    const detected = pValue < 0.05 || chiSquare > this.config.threshold * 100;

    return {
      detected,
      driftMagnitude: chiSquare / degreesOfFreedom,
      pValue,
      statistics: {
        statistic: chiSquare,
        pValue,
        confidenceInterval: [
          chiSquare - 1.96 * Math.sqrt(2 * degreesOfFreedom),
          chiSquare + 1.96 * Math.sqrt(2 * degreesOfFreedom),
        ],
        effectSize: Math.sqrt(
          chiSquare /
            (this.baselineWindow.values.length +
              this.currentWindow.values.length)
        ),
        sampleSize:
          this.baselineWindow.values.length + this.currentWindow.values.length,
      },
    };
  }

  /**
   * Calculate Population Stability Index (PSI)
   * @returns Test results
   */
  private calculatePSI(): {
    detected: boolean;
    driftMagnitude: number;
    pValue: number;
    statistics: DriftStatistics;
  } {
    const bins = this.createBins();
    const baselineBinned = this.binData(this.baselineWindow.values, bins);
    const currentBinned = this.binData(this.currentWindow.values, bins);

    const baselineTotal = this.baselineWindow.values.length;
    const currentTotal = this.currentWindow.values.length;

    let psi = 0;
    for (let i = 0; i < bins.length - 1; i++) {
      const expectedPct = baselineBinned[i] / baselineTotal;
      const actualPct = currentBinned[i] / currentTotal;

      if (expectedPct > 0 && actualPct > 0) {
        psi += (actualPct - expectedPct) * Math.log(actualPct / expectedPct);
      }
    }

    const detected = psi > this.config.threshold;
    const pValue = Math.exp(-psi); // Rough approximation

    return {
      detected,
      driftMagnitude: psi,
      pValue,
      statistics: {
        statistic: psi,
        pValue,
        confidenceInterval: [psi - 0.1, psi + 0.1],
        effectSize: psi,
        sampleSize: baselineTotal + currentTotal,
      },
    };
  }

  /**
   * Calculate KL divergence
   * @returns Test results
   */
  private calculateKLDivergence(): {
    detected: boolean;
    driftMagnitude: number;
    pValue: number;
    statistics: DriftStatistics;
  } {
    const bins = this.createBins();
    const baselineBinned = this.binData(this.baselineWindow.values, bins);
    const currentBinned = this.binData(this.currentWindow.values, bins);

    const baselineTotal = this.baselineWindow.values.length;
    const currentTotal = this.currentWindow.values.length;

    let kl = 0;
    for (let i = 0; i < bins.length - 1; i++) {
      const p = baselineBinned[i] / baselineTotal;
      const q = currentBinned[i] / currentTotal;

      if (p > 0 && q > 0) {
        kl += p * Math.log(p / q);
      }
    }

    const detected = kl > this.config.threshold;
    const pValue = Math.exp(-kl);

    return {
      detected,
      driftMagnitude: kl,
      pValue,
      statistics: {
        statistic: kl,
        pValue,
        confidenceInterval: [kl - 0.1, kl + 0.1],
        effectSize: kl,
        sampleSize: baselineTotal + currentTotal,
      },
    };
  }

  /**
   * Perform adaptive test (combines multiple methods)
   * @returns Test results
   */
  private performAdaptiveTest(): {
    detected: boolean;
    driftMagnitude: number;
    pValue: number;
    statistics: DriftStatistics;
  } {
    // Run all tests and combine results
    const ksResult = this.performKSTest();
    const psiResult = this.calculatePSI();
    const zResult = this.performZTest(
      this.mean(this.baselineWindow.values),
      this.mean(this.currentWindow.values),
      this.std(this.baselineWindow.values),
      this.std(this.currentWindow.values)
    );

    // Combine p-values using Fisher's method
    const chi2 =
      -2 *
      (Math.log(ksResult.pValue) +
        Math.log(psiResult.pValue) +
        Math.log(zResult.pValue));
    const combinedPValue = 1 - this.chiSquareCDF(chi2, 6);

    // Weighted average of drift magnitudes
    const driftMagnitude =
      (ksResult.driftMagnitude +
        psiResult.driftMagnitude +
        zResult.driftMagnitude) /
      3;

    const detected =
      combinedPValue < 0.05 || driftMagnitude > this.config.threshold;

    return {
      detected,
      driftMagnitude,
      pValue: combinedPValue,
      statistics: {
        statistic: chi2,
        pValue: combinedPValue,
        confidenceInterval: [driftMagnitude - 0.05, driftMagnitude + 0.05],
        effectSize: driftMagnitude,
        sampleSize:
          this.baselineWindow.values.length + this.currentWindow.values.length,
      },
    };
  }

  /**
   * Perform simple z-test
   * @param baselineMean Baseline mean
   * @param currentMean Current mean
   * @param baselineStd Baseline std
   * @param currentStd Current std
   * @returns Test results
   */
  private performZTest(
    baselineMean: number,
    currentMean: number,
    baselineStd: number,
    currentStd: number
  ): {
    detected: boolean;
    driftMagnitude: number;
    pValue: number;
    statistics: DriftStatistics;
  } {
    const n1 = this.baselineWindow.values.length;
    const n2 = this.currentWindow.values.length;

    const pooledStd = Math.sqrt(
      ((n1 - 1) * baselineStd * baselineStd +
        (n2 - 1) * currentStd * currentStd) /
        (n1 + n2 - 2)
    );

    const se = pooledStd * Math.sqrt(1 / n1 + 1 / n2);
    const z = (currentMean - baselineMean) / se;

    const pValue = 2 * (1 - this.normalCDF(Math.abs(z)));
    const detected = pValue < 0.05 || Math.abs(z) > this.config.threshold * 10;

    // Effect size (Cohen's d)
    const effectSize = se > 0 ? (currentMean - baselineMean) / se : 0;
    const driftMagnitude = Math.abs(effectSize);

    return {
      detected,
      driftMagnitude,
      pValue,
      statistics: {
        statistic: z,
        pValue,
        confidenceInterval: [
          currentMean - baselineMean - 1.96 * se,
          currentMean - baselineMean + 1.96 * se,
        ],
        effectSize,
        sampleSize: n1 + n2,
      },
    };
  }

  /**
   * Create bins for histogram-based tests
   * @returns Bin boundaries
   */
  private createBins(): number[] {
    const allValues = [
      ...this.baselineWindow.values,
      ...this.currentWindow.values,
    ];
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const numBins = 10;

    const bins: number[] = [];
    const step = (max - min) / numBins;

    for (let i = 0; i <= numBins; i++) {
      bins.push(min + i * step);
    }

    return bins;
  }

  /**
   * Bin data into histogram
   * @param data Data values
   * @param bins Bin boundaries
   * @returns Binned counts
   */
  private binData(data: number[], bins: number[]): number[] {
    const counts = new Array(bins.length - 1).fill(0);

    for (const value of data) {
      for (let i = 0; i < bins.length - 1; i++) {
        if (value >= bins[i] && value < bins[i + 1]) {
          counts[i]++;
          break;
        }
      }
    }

    return counts;
  }

  /**
   * Classify drift type
   * @param baselineMean Baseline mean
   * @param currentMean Current mean
   * @returns Drift type
   */
  private classifyDriftType(
    baselineMean: number,
    currentMean: number
  ): DriftType {
    if (this.config.metric.startsWith("accuracy")) {
      return "accuracy";
    } else if (
      this.config.metric.startsWith("input.") ||
      this.config.metric.startsWith("feature.")
    ) {
      return "data";
    } else if (this.config.metric.startsWith("prediction.")) {
      return "prediction";
    }
    return "accuracy"; // Default
  }

  /**
   * Classify drift severity
   * @param magnitude Drift magnitude
   * @returns Severity level
   */
  private classifySeverity(magnitude: number): DriftSeverity {
    if (magnitude > 0.5) {
      return "critical";
    } else if (magnitude > 0.3) {
      return "high";
    } else if (magnitude > 0.15) {
      return "medium";
    }
    return "low";
  }

  /**
   * Generate recommendation
   * @param driftType Drift type
   * @param severity Severity level
   * @returns Recommendation
   */
  private generateRecommendation(
    driftType: DriftType,
    severity: DriftSeverity
  ): DriftRecommendation {
    if (severity === "critical") {
      return "rollback";
    } else if (severity === "high") {
      return driftType === "data" ? "investigate" : "retrain";
    } else if (severity === "medium") {
      return driftType === "accuracy" ? "retrain" : "monitor";
    }
    return "monitor";
  }

  /**
   * Send alert webhook
   * @param report Drift report
   */
  private async sendAlert(report: DriftReport): Promise<void> {
    if (!this.config.alertWebhook) {
      return;
    }

    try {
      await fetch(this.config.alertWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      });
    } catch (error) {
      console.error("Failed to send drift alert:", error);
    }
  }

  /**
   * Calculate mean
   * @param values Values
   * @returns Mean
   */
  private mean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate standard deviation
   * @param values Values
   * @returns Standard deviation
   */
  private std(values: number[]): number {
    const m = this.mean(values);
    return Math.sqrt(
      values.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / values.length
    );
  }

  /**
   * Standard normal CDF
   * @param x Value
   * @returns CDF value
   */
  private normalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1 / (1 + p * x);
    const y =
      1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1 + sign * y);
  }

  /**
   * Chi-squared CDF approximation
   * @param x Chi-squared value
   * @param k Degrees of freedom
   * @returns CDF value
   */
  private chiSquareCDF(x: number, k: number): number {
    if (x <= 0) return 0;
    if (k === 2) {
      return 1 - Math.exp(-x / 2);
    }
    const z = Math.pow(x / k, 1 / 3) - (1 - 2 / (9 * k));
    const sigma = Math.sqrt(2 / (9 * k));
    return this.normalCDF(z / sigma);
  }

  /**
   * Get alert history
   * @param limit Maximum number of alerts
   * @returns Alert history
   */
  getAlertHistory(limit = 100): DriftReport[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Clear alert history
   */
  clearAlertHistory(): void {
    this.alertHistory = [];
  }

  /**
   * Reset detector
   */
  reset(): void {
    this.baselineWindow.values = [];
    this.currentWindow.values = [];
  }

  /**
   * Get detector state
   * @returns Current state
   */
  getState(): {
    baselineSize: number;
    currentSize: number;
    alertCount: number;
  } {
    return {
      baselineSize: this.baselineWindow.values.length,
      currentSize: this.currentWindow.values.length,
      alertCount: this.alertHistory.length,
    };
  }
}

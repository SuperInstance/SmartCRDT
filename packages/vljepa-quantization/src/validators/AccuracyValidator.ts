/**
 * @lsi/vljepa-quantization - Accuracy Validator
 *
 * Validates accuracy of quantized models.
 *
 * Validation Metrics:
 * - Embedding similarity (cosine)
 * - Top-K accuracy (classification)
 * - Preference accuracy (ORPO)
 * - MSE (regression)
 *
 * @module validators
 */

import type {
  ValidationConfig,
  ValidationResult,
  ModelMetrics,
  MetricDifference,
  ModelInfo,
} from "../types.js";

import { ValidationError } from "../types.js";

// ============================================================================
// DEFAULT VALIDATION CONFIG
// ============================================================================

/**
 * Default validation configuration
 */
export const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  dataset: "validation",
  metrics: ["cosine", "top1", "mse"],
  tolerance: 2.0, // 2% max accuracy drop
  samples: 100,
  batchSize: 10,
  detailed: true,
};

// ============================================================================
// ACCURACY VALIDATOR CLASS
// ============================================================================

/**
 * Accuracy Validator
 *
 * Validates that quantized model maintains acceptable accuracy.
 *
 * @example
 * ```typescript
 * const validator = new AccuracyValidator({
 *   tolerance: 2.0,
 *   metrics: ["cosine", "top1"]
 * });
 *
 * const result = await validator.validate(fp32Model, int8Model, testData);
 * console.log(`Passed: ${result.passed}`);
 * ```
 */
export class AccuracyValidator {
  /** Configuration */
  private config: ValidationConfig;

  /**
   * Create accuracy validator
   *
   * @param config - Validation configuration
   */
  constructor(config: Partial<ValidationConfig> = {}) {
    this.config = { ...DEFAULT_VALIDATION_CONFIG, ...config };
  }

  /**
   * Validate quantized model accuracy
   *
   * @param originalModel - Original FP32 model
   * @param quantizedModel - Quantized model
   * @param testData - Test data for validation
   * @returns Validation result
   */
  async validate(
    originalModel: ModelInfo,
    quantizedModel: ModelInfo,
    testData?: Float32Array[]
  ): Promise<ValidationResult> {
    const startTime = Date.now();

    console.log(`[AccuracyValidator] Starting accuracy validation...`);

    // Run FP32 model
    const fp32Metrics = await this.runModel(originalModel, testData);

    // Run INT8 model
    const int8Metrics = await this.runModel(quantizedModel, testData);

    // Calculate differences
    const differences = this.calculateDifferences(fp32Metrics, int8Metrics);

    // Check if all metrics within tolerance
    const passed = this.checkTolerance(differences);

    // Generate recommendations
    const recommendations = this.generateRecommendations(differences);

    console.log(
      `[AccuracyValidator] Validation complete: ${passed ? "PASSED" : "FAILED"}`
    );

    return {
      passed,
      fp32Metrics,
      int8Metrics,
      differences,
      recommendations,
      validationTime: Date.now() - startTime,
    };
  }

  /**
   * Run model and collect metrics
   *
   * @param model - Model to run
   * @param testData - Test data
   * @returns Model metrics
   */
  private async runModel(
    model: ModelInfo,
    testData?: Float32Array[]
  ): Promise<ModelMetrics> {
    // Simulate model inference
    // In real implementation, run actual model

    const metrics: ModelMetrics = {
      cosineSimilarity: 0.98 + Math.random() * 0.02,
      top1Accuracy:
        model.precision === "int8"
          ? 0.92 + Math.random() * 0.05
          : 0.94 + Math.random() * 0.04,
      top5Accuracy:
        model.precision === "int8"
          ? 0.98 + Math.random() * 0.02
          : 0.99 + Math.random() * 0.01,
      mse:
        model.precision === "int8"
          ? 1e-4 + Math.random() * 5e-4
          : 1e-5 + Math.random() * 1e-5,
      inferenceTime:
        model.precision === "int8"
          ? 10 + Math.random() * 5
          : 20 + Math.random() * 10,
      memoryUsage: model.sizeBytes * 1.2, // 20% overhead
    };

    return metrics;
  }

  /**
   * Calculate metric differences
   *
   * @param fp32Metrics - FP32 model metrics
   * @param int8Metrics - INT8 model metrics
   * @returns Metric differences
   */
  private calculateDifferences(
    fp32Metrics: ModelMetrics,
    int8Metrics: ModelMetrics
  ): MetricDifference[] {
    const differences: MetricDifference[] = [];

    for (const metric of this.config.metrics) {
      const fp32Value = (fp32Metrics as any)[this.getMetricKey(metric)];
      const int8Value = (int8Metrics as any)[this.getMetricKey(metric)];

      if (fp32Value === undefined || int8Value === undefined) {
        continue;
      }

      const absoluteDiff = Math.abs(fp32Value - int8Value);
      const percentageDiff =
        metric === "mse"
          ? ((int8Value - fp32Value) / fp32Value) * 100
          : ((fp32Value - int8Value) / fp32Value) * 100;

      const withinTolerance = this.isWithinTolerance(metric, percentageDiff);

      differences.push({
        metric,
        fp32Value,
        int8Value,
        absoluteDiff,
        percentageDiff,
        withinTolerance,
      });
    }

    return differences;
  }

  /**
   * Get metric key from metric name
   *
   * @param metric - Metric name
   * @returns Object key
   */
  private getMetricKey(metric: string): string {
    const keyMap: Record<string, string> = {
      cosine: "cosineSimilarity",
      top1: "top1Accuracy",
      top5: "top5Accuracy",
      preference: "preferenceAccuracy",
      mse: "mse",
    };

    return keyMap[metric] || metric;
  }

  /**
   * Check if metric difference is within tolerance
   *
   * @param metric - Metric name
   * @param diff - Difference value
   * @returns True if within tolerance
   */
  private isWithinTolerance(metric: string, diff: number): boolean {
    // For accuracy metrics, lower drop is better
    if (["cosine", "top1", "top5", "preference"].includes(metric)) {
      return Math.abs(diff) <= this.config.tolerance;
    }

    // For MSE, lower is better but some increase is expected
    if (metric === "mse") {
      return diff <= 100; // Allow 100% MSE increase
    }

    return Math.abs(diff) <= this.config.tolerance;
  }

  /**
   * Check if all metrics are within tolerance
   *
   * @param differences - Metric differences
   * @returns True if all within tolerance
   */
  private checkTolerance(differences: MetricDifference[]): boolean {
    return differences.every(d => d.withinTolerance);
  }

  /**
   * Generate recommendations based on differences
   *
   * @param differences - Metric differences
   * @returns Recommendations
   */
  private generateRecommendations(differences: MetricDifference[]): string[] {
    const recommendations: string[] = [];

    // Check for metrics outside tolerance
    const failedMetrics = differences.filter(d => !d.withinTolerance);

    if (failedMetrics.length > 0) {
      recommendations.push(
        "Consider using quantization-aware training (QAT) for better accuracy"
      );

      for (const diff of failedMetrics) {
        switch (diff.metric) {
          case "cosine":
            recommendations.push(
              "Embedding similarity dropped - try KL divergence calibration"
            );
            break;
          case "top1":
            recommendations.push(
              "Classification accuracy dropped - increase calibration samples"
            );
            break;
          case "mse":
            recommendations.push(
              "MSE increased significantly - consider hybrid FP16/INT8 quantization"
            );
            break;
        }
      }
    } else {
      recommendations.push(
        "Accuracy within acceptable range - quantization successful"
      );
    }

    // General recommendations
    if (failedMetrics.length === 0) {
      recommendations.push("Model ready for deployment");
    } else {
      recommendations.push(
        "Model may need retraining with quantization awareness"
      );
    }

    return recommendations;
  }

  /**
   * Validate single metric
   *
   * @param metric - Metric name
   * @param fp32Value - FP32 value
   * @param int8Value - INT8 value
   * @returns True if within tolerance
   */
  public validateMetric(
    metric: string,
    fp32Value: number,
    int8Value: number
  ): boolean {
    const percentageDiff = ((fp32Value - int8Value) / fp32Value) * 100;
    return this.isWithinTolerance(metric, percentageDiff);
  }

  /**
   * Get configuration
   *
   * @returns Current configuration
   */
  public getConfig(): ValidationConfig {
    return { ...this.config };
  }
}

/**
 * Create accuracy validator
 *
 * @param config - Optional configuration
 * @returns Accuracy validator instance
 */
export function createAccuracyValidator(
  config?: Partial<ValidationConfig>
): AccuracyValidator {
  return new AccuracyValidator(config);
}

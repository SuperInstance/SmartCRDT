/**
 * @lsi/vljepa-quantization - Percentile Calibrator
 *
 * Percentile-based calibration strategy for quantization.
 *
 * Robust calibration using percentiles:
 * - Ignores extreme outliers
 * - Uses configurable percentile (e.g., 99.9th)
 * - Balanced between accuracy and robustness
 *
 * Best for:
 * - Distributions with outliers
 * - Robust calibration needs
 * - Production models
 *
 * Trade-offs:
 * - More robust than min-max
 * - Faster than KL divergence
 * - May leave some range unused
 *
 * @module calibrators
 */

import type {
  CalibrationConfig,
  CalibrationResult,
  CalibrationMetrics,
} from "../types.js";

import { CalibrationError } from "../types.js";

// ============================================================================
// PERCENTILE CALIBRATOR CONFIG
// ============================================================================

/**
 * Percentile calibrator configuration
 */
export interface PercentileCalibratorConfig {
  /** Percentile to use for calibration (e.g., 99.9) */
  percentile: number;

  /** Whether to use symmetric percentiles */
  symmetric: boolean;

  /** Whether to clip values to percentile range */
  clip: boolean;
}

/**
 * Default percentile calibrator configuration
 */
export const DEFAULT_PERCENTILE_CONFIG: PercentileCalibratorConfig = {
  percentile: 99.9,
  symmetric: true,
  clip: true,
};

// ============================================================================
// PERCENTILE CALIBRATOR CLASS
// ============================================================================

/**
 * Percentile Calibrator
 *
 * Uses percentile-based range for robust calibration.
 *
 * Algorithm:
 * 1. Sort activation values
 * 2. Find values at target percentile(s)
 * 3. Use those as min/max for quantization
 *
 * Symmetric mode:
 * - Uses (100 - percentile)/2 and 100 - (100 - percentile)/2
 * - E.g., 99.9 percentile uses 0.05th and 99.95th percentiles
 *
 * Asymmetric mode:
 * - Uses 0th and given percentile
 * - Better for asymmetric distributions
 *
 * @example
 * ```typescript
 * const calibrator = new PercentileCalibrator({
 *   percentile: 99.9,
 *   symmetric: true
 * });
 *
 * const result = await calibrator.calibrate(activations);
 * ```
 */
export class PercentileCalibrator {
  /** Configuration */
  private config: PercentileCalibratorConfig;

  /** Base calibration config */
  private baseConfig: Required<CalibrationConfig>;

  /** Computed percentiles cache */
  private percentileCache: Map<string, Record<number, number>> = new Map();

  /**
   * Create percentile calibrator
   *
   * @param config - Percentile-specific configuration
   * @param baseConfig - Base calibration configuration
   */
  constructor(
    config: Partial<PercentileCalibratorConfig> = {},
    baseConfig: Partial<CalibrationConfig> = {}
  ) {
    this.config = { ...DEFAULT_PERCENTILE_CONFIG, ...config };
    this.baseConfig = {
      samples: baseConfig.samples ?? 100,
      batchSize: baseConfig.batchSize ?? 10,
      method: "percentile",
      percentile: baseConfig.percentile ?? this.config.percentile,
      histogramBins: baseConfig.histogramBins ?? 2048,
      seed: baseConfig.seed ?? Date.now(),
    };
  }

  /**
   * Calibrate using percentile strategy
   *
   * @param activations - Activation values to calibrate
   * @param layerName - Optional layer name for caching
   * @returns Calibration result
   */
  async calibrate(
    activations: Float32Array,
    layerName?: string
  ): Promise<CalibrationResult> {
    const startTime = Date.now();

    // Step 1: Sort activations for percentile computation
    const sorted = new Float32Array(activations);
    sorted.sort();

    // Step 2: Compute percentiles
    const percentiles = this.computePercentiles(sorted);

    // Cache percentiles if layer name provided
    if (layerName) {
      this.percentileCache.set(layerName, percentiles);
    }

    // Step 3: Determine min and max from percentiles
    let minVal: number;
    let maxVal: number;

    if (this.config.symmetric) {
      // Use symmetric percentiles
      const lowerP = (100 - this.config.percentile) / 2;
      const upperP = 100 - lowerP;

      minVal = percentiles[lowerP];
      maxVal = percentiles[upperP];
    } else {
      // Use 0 and target percentile
      minVal = percentiles[0];
      maxVal = percentiles[this.config.percentile];
    }

    // Step 4: Calculate statistics
    const mean = this.calculateMean(activations);
    const stdDev = this.calculateStdDev(activations, mean);

    // Step 5: Calculate scale and zero point
    const qmin = -128;
    const qmax = 127;

    const scale = (maxVal - minVal) / (qmax - qmin);
    const zeroPoint = Math.round(qmin - minVal / scale);
    const clampedZeroPoint = Math.max(qmin, Math.min(qmax, zeroPoint));

    return {
      scale: new Float32Array([scale]),
      zeroPoint: new Int8Array([clampedZeroPoint]),
      metrics: {
        minVal: minVal,
        maxVal: maxVal,
        mean,
        stdDev,
        percentiles,
      },
      calibrationTime: Date.now() - startTime,
    };
  }

  /**
   * Compute percentiles from sorted values
   *
   * @param sorted - Sorted activation values
   * @returns Map of percentile to value
   */
  private computePercentiles(sorted: Float32Array): Record<number, number> {
    const percentiles: Record<number, number> = {};

    // Compute common percentiles
    const commonPercentiles = [
      0, 0.01, 0.1, 1, 5, 10, 25, 50, 75, 90, 95, 99, 99.9, 99.99, 100,
    ];

    for (const p of commonPercentiles) {
      percentiles[p] = this.getPercentile(sorted, p);
    }

    // Also compute configured percentile
    if (this.config.symmetric) {
      const lowerP = (100 - this.config.percentile) / 2;
      const upperP = 100 - lowerP;

      percentiles[lowerP] = this.getPercentile(sorted, lowerP);
      percentiles[upperP] = this.getPercentile(sorted, upperP);
    } else {
      percentiles[this.config.percentile] = this.getPercentile(
        sorted,
        this.config.percentile
      );
    }

    return percentiles;
  }

  /**
   * Get value at specific percentile
   *
   * @param sorted - Sorted values
   * @param percentile - Percentile (0-100)
   * @returns Value at percentile
   */
  private getPercentile(sorted: Float32Array, percentile: number): number {
    if (sorted.length === 0) {
      throw new CalibrationError(
        "Cannot compute percentile of empty array",
        "EMPTY_ARRAY"
      );
    }

    if (percentile <= 0) {
      return sorted[0];
    }

    if (percentile >= 100) {
      return sorted[sorted.length - 1];
    }

    // Linear interpolation method
    const index = (percentile / 100) * (sorted.length - 1);
    const lowerIndex = Math.floor(index);
    const upperIndex = Math.ceil(index);
    const fraction = index - lowerIndex;

    if (upperIndex >= sorted.length) {
      return sorted[sorted.length - 1];
    }

    // Interpolate between adjacent values
    return (
      sorted[lowerIndex] + fraction * (sorted[upperIndex] - sorted[lowerIndex])
    );
  }

  /**
   * Calibrate with adaptive percentile selection
   *
   * Automatically selects optimal percentile based on distribution.
   *
   * @param activations - Activation values
   * @param layerName - Optional layer name
   * @returns Calibration result with selected percentile
   */
  async calibrateAdaptive(
    activations: Float32Array,
    layerName?: string
  ): Promise<CalibrationResult & { selectedPercentile: number }> {
    const startTime = Date.now();

    // Analyze distribution characteristics
    const analysis = this.analyzeDistribution(activations);

    // Select percentile based on analysis
    let selectedPercentile: number;

    if (analysis.hasOutliers) {
      // Use higher percentile to exclude outliers
      selectedPercentile = 99.99;
    } else if (analysis.isBounded) {
      // Distribution is bounded, use 100th percentile
      selectedPercentile = 100;
    } else if (analysis.isNarrow) {
      // Narrow distribution, can use lower percentile
      selectedPercentile = 99.9;
    } else {
      // Default
      selectedPercentile = 99.95;
    }

    // Temporarily override config
    const originalPercentile = this.config.percentile;
    this.config.percentile = selectedPercentile;

    // Calibrate with selected percentile
    const result = await this.calibrate(activations, layerName);

    // Restore original config
    this.config.percentile = originalPercentile;

    return {
      ...result,
      selectedPercentile,
    };
  }

  /**
   * Analyze distribution characteristics
   *
   * @param activations - Activation values
   * @returns Distribution analysis
   */
  private analyzeDistribution(activations: Float32Array): {
    hasOutliers: boolean;
    isBounded: boolean;
    isNarrow: boolean;
    skewness: number;
    kurtosis: number;
  } {
    // Compute basic statistics
    let sum = 0;
    let sumSquared = 0;
    let sumCubed = 0;
    let sumQuad = 0;

    for (let i = 0; i < activations.length; i++) {
      const val = activations[i];
      sum += val;
      sumSquared += val * val;
      sumCubed += val * val * val;
      sumQuad += val * val * val * val;
    }

    const n = activations.length;
    const mean = sum / n;
    const variance = sumSquared / n - mean * mean;
    const stdDev = Math.sqrt(Math.max(0, variance));

    // Skewness (third standardized moment)
    const skewness =
      stdDev > 0
        ? (sumCubed / n - 3 * mean * variance - mean ** 3) / Math.pow(stdDev, 3)
        : 0;

    // Kurtosis (fourth standardized moment)
    const kurtosis =
      stdDev > 0
        ? (sumQuad / n -
            (4 * mean * sumCubed) / n +
            6 * mean * mean * variance -
            3 * mean ** 4) /
            Math.pow(stdDev, 4) -
          3
        : 0;

    // Check for outliers using IQR method
    const sorted = new Float32Array(activations);
    sorted.sort();

    const q1 = this.getPercentile(sorted, 25);
    const q3 = this.getPercentile(sorted, 75);
    const iqr = q3 - q1;
    const lowerBound = q1 - 3 * iqr;
    const upperBound = q3 + 3 * iqr;

    const hasOutliers =
      sorted[0] < lowerBound || sorted[sorted.length - 1] > upperBound;

    // Check if distribution is bounded (close to uniform min/max)
    const range = sorted[sorted.length - 1] - sorted[0];
    const effectiveRange = q3 - q1;
    const isBounded = effectiveRange < 0.5 * range;

    // Check if distribution is narrow (low variance)
    const isNarrow = stdDev < 0.1 * Math.abs(mean);

    return {
      hasOutliers,
      isBounded,
      isNarrow,
      skewness,
      kurtosis,
    };
  }

  /**
   * Calculate mean of values
   *
   * @param values - Input values
   * @returns Mean
   */
  private calculateMean(values: Float32Array): number {
    let sum = 0;

    for (let i = 0; i < values.length; i++) {
      sum += values[i];
    }

    return sum / values.length;
  }

  /**
   * Calculate standard deviation
   *
   * @param values - Input values
   * @param mean - Pre-computed mean
   * @returns Standard deviation
   */
  private calculateStdDev(values: Float32Array, mean: number): number {
    let sumSquares = 0;

    for (let i = 0; i < values.length; i++) {
      const diff = values[i] - mean;
      sumSquares += diff * diff;
    }

    return Math.sqrt(sumSquares / values.length);
  }

  /**
   * Get cached percentiles for a layer
   *
   * @param layerName - Layer name
   * @returns Percentiles or undefined
   */
  public getCachedPercentiles(
    layerName: string
  ): Record<number, number> | undefined {
    return this.percentileCache.get(layerName);
  }

  /**
   * Clear percentile cache
   */
  public clearCache(): void {
    this.percentileCache.clear();
  }

  /**
   * Get configuration
   *
   * @returns Current configuration
   */
  public getConfig(): PercentileCalibratorConfig {
    return { ...this.config };
  }

  /**
   * Get base configuration
   *
   * @returns Base calibration configuration
   */
  public getBaseConfig(): Required<CalibrationConfig> {
    return { ...this.baseConfig };
  }

  /**
   * Update configuration
   *
   * @param config - Partial configuration to update
   */
  public updateConfig(config: Partial<PercentileCalibratorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create percentile calibrator
 *
 * @param config - Optional percentile-specific configuration
 * @param baseConfig - Optional base configuration
 * @returns Percentile calibrator instance
 */
export function createPercentileCalibrator(
  config?: Partial<PercentileCalibratorConfig>,
  baseConfig?: Partial<CalibrationConfig>
): PercentileCalibrator {
  return new PercentileCalibrator(config, baseConfig);
}

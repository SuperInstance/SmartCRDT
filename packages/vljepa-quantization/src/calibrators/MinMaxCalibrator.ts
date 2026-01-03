/**
 * @lsi/vljepa-quantization - Min-Max Calibrator
 *
 * Min-max calibration strategy for quantization.
 *
 * Simplest calibration method:
 * - Finds min and max activation values
 * - Uses full INT8 range [-128, 127]
 * - Fast but sensitive to outliers
 *
 * Best for:
 * - Well-behaved distributions
 * - Quick calibration
 * - Models with bounded activations
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
// MIN-MAX CALIBRATOR CLASS
// ============================================================================

/**
 * Min-Max Calibrator
 *
 * Simple calibration using min/max values.
 *
 * Formula:
 * - scale = (max - min) / (qmax - qmin)
 * - zero_point = qmin - round(min / scale)
 *
 * Where qmin = -128, qmax = 127 for INT8.
 *
 * @example
 * ```typescript
 * const calibrator = new MinMaxCalibrator();
 * const result = await calibrator.calibrate(activations);
 * console.log(`Scale: ${result.scale[0]}`);
 * ```
 */
export class MinMaxCalibrator {
  /** Configuration */
  private config: Required<CalibrationConfig>;

  /** Accumulated statistics */
  private stats: Map<string, { min: number; max: number; count: number }> =
    new Map();

  /**
   * Create min-max calibrator
   *
   * @param config - Calibration configuration
   */
  constructor(config: Partial<CalibrationConfig> = {}) {
    this.config = {
      samples: config.samples ?? 100,
      batchSize: config.batchSize ?? 10,
      method: "min_max",
      percentile: config.percentile ?? 99.9,
      histogramBins: config.histogramBins ?? 2048,
      seed: config.seed ?? Date.now(),
    };
  }

  /**
   * Calibrate using min-max strategy
   *
   * @param activations - Activation values to calibrate
   * @param layerName - Layer name (for multi-layer tracking)
   * @returns Calibration result
   */
  async calibrate(
    activations: Float32Array,
    layerName?: string
  ): Promise<CalibrationResult> {
    const startTime = Date.now();

    // Find min and max
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let sumSquares = 0;

    for (let i = 0; i < activations.length; i++) {
      const val = activations[i];

      if (val < min) min = val;
      if (val > max) max = val;

      sum += val;
      sumSquares += val * val;
    }

    // Validate range
    if (min === max) {
      throw new CalibrationError(
        `Constant tensor detected (min=${min}, max=${max}). Cannot calibrate.`,
        "CONSTANT_TENSOR",
        { layerName }
      );
    }

    // Calculate statistics
    const mean = sum / activations.length;
    const variance = sumSquares / activations.length - mean * mean;
    const stdDev = Math.sqrt(Math.max(0, variance));

    // Calculate scale and zero point
    const qmin = -128;
    const qmax = 127;

    const scale = (max - min) / (qmax - qmin);
    const zeroPoint = Math.round(qmin - min / scale);

    // Clamp zero point to INT8 range
    const clampedZeroPoint = Math.max(qmin, Math.min(qmax, zeroPoint));

    // Update statistics
    if (layerName) {
      this.stats.set(layerName, { min, max, count: activations.length });
    }

    return {
      scale: new Float32Array([scale]),
      zeroPoint: new Int8Array([clampedZeroPoint]),
      metrics: {
        minVal: min,
        maxVal: max,
        mean,
        stdDev,
      },
      calibrationTime: Date.now() - startTime,
    };
  }

  /**
   * Calibrate with percentile trimming
   *
   * Trims outliers before computing min/max for more robust calibration.
   *
   * @param activations - Activation values
   * @param percentile - Percentile to use (e.g., 99.9 uses 0.05th and 99.95th percentiles)
   * @param layerName - Optional layer name
   * @returns Calibration result
   */
  async calibrateWithPercentile(
    activations: Float32Array,
    percentile: number = 99.9,
    layerName?: string
  ): Promise<CalibrationResult> {
    const startTime = Date.now();

    // Compute percentiles
    const sorted = new Float32Array(activations);
    sorted.sort();

    const lowerPercentile = (100 - percentile) / 2;
    const upperPercentile = 100 - lowerPercentile;

    const lowerIdx = Math.floor((lowerPercentile / 100) * sorted.length);
    const upperIdx = Math.floor((upperPercentile / 100) * sorted.length);

    const min = sorted[Math.max(0, lowerIdx)];
    const max = sorted[Math.min(sorted.length - 1, upperIdx)];

    // Calculate statistics on full range
    let sum = 0;
    let sumSquares = 0;

    for (let i = 0; i < activations.length; i++) {
      sum += activations[i];
      sumSquares += activations[i] * activations[i];
    }

    const mean = sum / activations.length;
    const variance = sumSquares / activations.length - mean * mean;
    const stdDev = Math.sqrt(Math.max(0, variance));

    // Calculate scale and zero point
    const qmin = -128;
    const qmax = 127;

    const scale = (max - min) / (qmax - qmin);
    const zeroPoint = Math.round(qmin - min / scale);
    const clampedZeroPoint = Math.max(qmin, Math.min(qmax, zeroPoint));

    const percentiles: Record<number, number> = {
      [lowerPercentile]: min,
      [upperPercentile]: max,
      50: sorted[Math.floor(sorted.length / 2)], // Median
    };

    return {
      scale: new Float32Array([scale]),
      zeroPoint: new Int8Array([clampedZeroPoint]),
      metrics: {
        minVal: min,
        maxVal: max,
        mean,
        stdDev,
        percentiles,
      },
      calibrationTime: Date.now() - startTime,
    };
  }

  /**
   * Calibrate multiple batches incrementally
   *
   * Useful for large datasets that don't fit in memory.
   *
   * @param batches - Array of activation batches
   * @param layerName - Optional layer name
   * @returns Calibration result
   */
  async calibrateBatches(
    batches: Float32Array[],
    layerName?: string
  ): Promise<CalibrationResult> {
    // Accumulate min/max across batches
    let globalMin = Infinity;
    let globalMax = -Infinity;
    let totalSum = 0;
    let totalSumSquares = 0;
    let totalCount = 0;

    for (const batch of batches) {
      for (let i = 0; i < batch.length; i++) {
        const val = batch[i];

        if (val < globalMin) globalMin = val;
        if (val > globalMax) globalMax = val;

        totalSum += val;
        totalSumSquares += val * val;
        totalCount++;
      }
    }

    const mean = totalSum / totalCount;
    const variance = totalSumSquares / totalCount - mean * mean;
    const stdDev = Math.sqrt(Math.max(0, variance));

    const qmin = -128;
    const qmax = 127;

    const scale = (globalMax - globalMin) / (qmax - qmin);
    const zeroPoint = Math.round(qmin - globalMin / scale);
    const clampedZeroPoint = Math.max(qmin, Math.min(qmax, zeroPoint));

    return {
      scale: new Float32Array([scale]),
      zeroPoint: new Int8Array([clampedZeroPoint]),
      metrics: {
        minVal: globalMin,
        maxVal: globalMax,
        mean,
        stdDev,
      },
      calibrationTime: 0,
    };
  }

  /**
   * Get accumulated statistics
   *
   * @returns Statistics by layer
   */
  public getStats(): Map<string, { min: number; max: number; count: number }> {
    return new Map(this.stats);
  }

  /**
   * Clear accumulated statistics
   */
  public clear(): void {
    this.stats.clear();
  }

  /**
   * Get configuration
   *
   * @returns Current configuration
   */
  public getConfig(): Required<CalibrationConfig> {
    return { ...this.config };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create min-max calibrator
 *
 * @param config - Optional configuration
 * @returns MinMax calibrator instance
 */
export function createMinMaxCalibrator(
  config?: Partial<CalibrationConfig>
): MinMaxCalibrator {
  return new MinMaxCalibrator(config);
}

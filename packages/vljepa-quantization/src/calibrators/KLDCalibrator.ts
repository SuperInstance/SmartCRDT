/**
 * @lsi/vljepa-quantization - KL Divergence Calibrator
 *
 * KL (Kullback-Leibler) divergence calibration strategy.
 *
 * Minimizes information loss during quantization:
 * - Builds histogram of activation distribution
 * - Finds optimal quantization range minimizing KL divergence
 * - More accurate than min-max, slower
 *
 * Best for:
 * - Complex distributions
 * - When accuracy is critical
 * - Models with long-tailed distributions
 *
 * Reference:
 * "TensorFlow Quantization" - Uses KL divergence for optimal calibration
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
// KLD CALIBRATOR CONFIG
// ============================================================================

/**
 * KL divergence calibrator configuration
 */
export interface KLDCalibratorConfig {
  /** Number of histogram bins */
  numBins: number;

  /** Minimum percentile to try */
  minPercentile: number;

  /** Maximum percentile to try */
  maxPercentile: number;

  /** Step size for percentile search */
  percentileStep: number;

  /** Target KL divergence threshold */
  targetKLD: number;
}

/**
 * Default KLD calibrator configuration
 */
export const DEFAULT_KLD_CONFIG: KLDCalibratorConfig = {
  numBins: 2048,
  minPercentile: 99.9,
  maxPercentile: 100.0,
  percentileStep: 0.05,
  targetKLD: 0.01,
};

// ============================================================================
// HISTOGRAM STRUCTURE
// ============================================================================

/**
 * Histogram for distribution analysis
 */
export interface Histogram {
  /** Bin counts */
  counts: number[];

  /** Bin edges */
  edges: number[];

  /** Total count */
  total: number;

  /** Minimum value */
  min: number;

  /** Maximum value */
  max: number;
}

// ============================================================================
// KL DIVERGENCE CALIBRATOR CLASS
// ============================================================================

/**
 * KL Divergence Calibrator
 *
 * Minimizes information loss using KL divergence.
 *
 * Algorithm:
 * 1. Build histogram of activation distribution
 * 2. For each candidate range:
 *    a. Quantize histogram
 *    b. Compute KL divergence between original and quantized
 * 3. Select range with minimal KL divergence
 *
 * @example
 * ```typescript
 * const calibrator = new KLDCalibrator({
 *   numBins: 2048,
 *   targetKLD: 0.01
 * });
 *
 * const result = await calibrator.calibrate(activations);
 * console.log(`KLD Score: ${result.metrics.kldScore}`);
 * ```
 */
export class KLDCalibrator {
  /** Configuration */
  private config: KLDCalibratorConfig;

  /** Base calibration config */
  private baseConfig: Required<CalibrationConfig>;

  /**
   * Create KL divergence calibrator
   *
   * @param config - KLD-specific configuration
   * @param baseConfig - Base calibration configuration
   */
  constructor(
    config: Partial<KLDCalibratorConfig> = {},
    baseConfig: Partial<CalibrationConfig> = {}
  ) {
    this.config = { ...DEFAULT_KLD_CONFIG, ...config };
    this.baseConfig = {
      samples: baseConfig.samples ?? 100,
      batchSize: baseConfig.batchSize ?? 10,
      method: "kld",
      percentile: baseConfig.percentile ?? 99.9,
      histogramBins: baseConfig.histogramBins ?? this.config.numBins,
      seed: baseConfig.seed ?? Date.now(),
    };
  }

  /**
   * Calibrate using KL divergence minimization
   *
   * @param activations - Activation values to calibrate
   * @param layerName - Optional layer name
   * @returns Calibration result
   */
  async calibrate(
    activations: Float32Array,
    layerName?: string
  ): Promise<CalibrationResult> {
    const startTime = Date.now();

    // Step 1: Build histogram
    const histogram = this.buildHistogram(activations);

    // Step 2: Find optimal range using KL divergence
    const optimalRange = this.findOptimalRange(histogram);

    // Step 3: Calculate statistics
    const mean = this.calculateMean(activations);
    const stdDev = this.calculateStdDev(activations, mean);

    // Step 4: Calculate scale and zero point
    const qmin = -128;
    const qmax = 127;

    const scale = (optimalRange.max - optimalRange.min) / (qmax - qmin);
    const zeroPoint = Math.round(qmin - optimalRange.min / scale);
    const clampedZeroPoint = Math.max(qmin, Math.min(qmax, zeroPoint));

    return {
      scale: new Float32Array([scale]),
      zeroPoint: new Int8Array([clampedZeroPoint]),
      metrics: {
        minVal: optimalRange.min,
        maxVal: optimalRange.max,
        mean,
        stdDev,
        kldScore: optimalRange.kldScore,
      },
      calibrationTime: Date.now() - startTime,
    };
  }

  /**
   * Build histogram from activations
   *
   * @param activations - Input values
   * @returns Histogram
   */
  private buildHistogram(activations: Float32Array): Histogram {
    // Find min and max
    let min = Infinity;
    let max = -Infinity;

    for (let i = 0; i < activations.length; i++) {
      if (activations[i] < min) min = activations[i];
      if (activations[i] > max) max = activations[i];
    }

    // Create histogram bins
    const numBins = this.config.numBins;
    const counts = new Array(numBins).fill(0);
    const edges = new Array(numBins + 1);
    const binWidth = (max - min) / numBins;

    for (let i = 0; i <= numBins; i++) {
      edges[i] = min + i * binWidth;
    }

    // Fill histogram
    for (let i = 0; i < activations.length; i++) {
      const val = activations[i];
      let binIdx = Math.floor((val - min) / binWidth);

      // Clamp to valid range
      binIdx = Math.max(0, Math.min(numBins - 1, binIdx));
      counts[binIdx]++;
    }

    return {
      counts,
      edges,
      total: activations.length,
      min,
      max,
    };
  }

  /**
   * Find optimal quantization range minimizing KL divergence
   *
   * @param histogram - Input histogram
   * @returns Optimal range with KLD score
   */
  private findOptimalRange(histogram: Histogram): {
    min: number;
    max: number;
    kldScore: number;
  } {
    let bestRange = {
      min: histogram.min,
      max: histogram.max,
      kldScore: Infinity,
    };

    // Try different percentiles
    for (
      let p = this.config.minPercentile;
      p <= this.config.maxPercentile;
      p += this.config.percentileStep
    ) {
      // Calculate range at this percentile
      const cumsum = this.computeCumulativeSum(histogram.counts);
      const totalCount = histogram.total;

      const minIdx = this.findPercentileIndex(
        cumsum,
        totalCount,
        (100 - p) / 2
      );
      const maxIdx = this.findPercentileIndex(
        cumsum,
        totalCount,
        100 - (100 - p) / 2
      );

      const minVal = histogram.edges[minIdx];
      const maxVal = histogram.edges[maxIdx + 1];

      // Quantize histogram to this range
      const quantizedHist = this.quantizeHistogram(histogram, minVal, maxVal);

      // Compute KL divergence
      const kld = this.computeKLDivergence(histogram, quantizedHist);

      if (kld < bestRange.kldScore) {
        bestRange = { min: minVal, max: maxVal, kldScore: kld };

        // Early stop if we hit target
        if (kld < this.config.targetKLD) {
          break;
        }
      }
    }

    return bestRange;
  }

  /**
   * Compute cumulative sum of array
   *
   * @param arr - Input array
   * @returns Cumulative sum
   */
  private computeCumulativeSum(arr: number[]): number[] {
    const cumsum = new Array(arr.length);
    cumsum[0] = arr[0];

    for (let i = 1; i < arr.length; i++) {
      cumsum[i] = cumsum[i - 1] + arr[i];
    }

    return cumsum;
  }

  /**
   * Find index at given percentile
   *
   * @param cumsum - Cumulative sum array
   * @param total - Total count
   * @param percentile - Percentile (0-100)
   * @returns Index
   */
  private findPercentileIndex(
    cumsum: number[],
    total: number,
    percentile: number
  ): number {
    const target = (percentile / 100) * total;

    for (let i = 0; i < cumsum.length; i++) {
      if (cumsum[i] >= target) {
        return i;
      }
    }

    return cumsum.length - 1;
  }

  /**
   * Quantize histogram to target range
   *
   * @param histogram - Original histogram
   * @param minVal - Target min value
   * @param maxVal - Target max value
   * @returns Quantized histogram
   */
  private quantizeHistogram(
    histogram: Histogram,
    minVal: number,
    maxVal: number
  ): Histogram {
    const numBins = 256; // INT8 range
    const counts = new Array(numBins).fill(0);
    const edges = new Array(numBins + 1);
    const binWidth = (maxVal - minVal) / numBins;

    for (let i = 0; i <= numBins; i++) {
      edges[i] = minVal + i * binWidth;
    }

    // Redistribute original histogram into quantized bins
    for (let i = 0; i < histogram.counts.length; i++) {
      const val = (histogram.edges[i] + histogram.edges[i + 1]) / 2;

      if (val < minVal || val > maxVal) {
        // Outside range, add to edge bins
        if (val < minVal) {
          counts[0] += histogram.counts[i];
        } else {
          counts[numBins - 1] += histogram.counts[i];
        }
      } else {
        let binIdx = Math.floor((val - minVal) / binWidth);
        binIdx = Math.max(0, Math.min(numBins - 1, binIdx));
        counts[binIdx] += histogram.counts[i];
      }
    }

    return {
      counts,
      edges,
      total: histogram.total,
      min: minVal,
      max: maxVal,
    };
  }

  /**
   * Compute KL divergence between two histograms
   *
   * KL(P||Q) = sum(P(x) * log(P(x) / Q(x)))
   *
   * @param hist1 - First histogram (P)
   * @param hist2 - Second histogram (Q)
   * @returns KL divergence score
   */
  private computeKLDivergence(hist1: Histogram, hist2: Histogram): number {
    let kld = 0;

    // Normalize to probabilities
    const p: number[] = [];
    const q: number[] = [];

    for (let i = 0; i < hist1.counts.length; i++) {
      p.push(hist1.counts[i] / hist1.total);
    }

    for (let i = 0; i < hist2.counts.length; i++) {
      q.push(hist2.counts[i] / hist2.total);
    }

    // Align distributions (map hist1 bins to hist2 bins)
    for (let i = 0; i < hist1.counts.length; i++) {
      const pVal = hist1.counts[i] / hist1.total;

      if (pVal === 0) continue;

      // Map hist1 bin to hist2 bin
      const val1 = (hist1.edges[i] + hist1.edges[i + 1]) / 2;

      if (val1 < hist2.min || val1 > hist2.max) {
        // Outside quantized range
        kld += pVal * Math.log(pVal / 1e-10);
        continue;
      }

      const binWidth = (hist2.max - hist2.min) / hist2.counts.length;
      let binIdx = Math.floor((val1 - hist2.min) / binWidth);
      binIdx = Math.max(0, Math.min(hist2.counts.length - 1, binIdx));

      const qVal = hist2.counts[binIdx] / hist2.total;

      if (qVal === 0) {
        kld += pVal * Math.log(pVal / 1e-10);
      } else {
        kld += pVal * Math.log(pVal / qVal);
      }
    }

    return kld;
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
   * Get configuration
   *
   * @returns Current configuration
   */
  public getConfig(): KLDCalibratorConfig {
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
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create KL divergence calibrator
 *
 * @param config - Optional KLD-specific configuration
 * @param baseConfig - Optional base configuration
 * @returns KLD calibrator instance
 */
export function createKLDCalibrator(
  config?: Partial<KLDCalibratorConfig>,
  baseConfig?: Partial<CalibrationConfig>
): KLDCalibrator {
  return new KLDCalibrator(config, baseConfig);
}

/**
 * @lsi/vljepa-quantization - Calibration Dataset
 *
 * Dataset management for model calibration during quantization.
 *
 * Purpose:
 * - Representative data for computing quantization parameters
 * - Efficient sampling strategies
 * - Caching for faster repeated calibration
 *
 * @module calibrators
 */

import type { ModelInfo } from "../types.js";

// ============================================================================
// CALIBRATION DATASET CONFIG
// ============================================================================

/**
 * Calibration dataset configuration
 */
export interface CalibrationDatasetConfig {
  /** Number of samples to use */
  numSamples: number;

  /** Sampling strategy */
  strategy: "random" | "stratified" | "importance";

  /** Random seed */
  seed?: number;

  /** Whether to cache samples */
  cache: boolean;

  /** Data source path */
  sourcePath?: string;
}

/**
 * Default calibration dataset configuration
 */
export const DEFAULT_CALIBRATION_DATASET_CONFIG: CalibrationDatasetConfig = {
  numSamples: 100,
  strategy: "random",
  cache: true,
};

// ============================================================================
// CALIBRATION SAMPLE
// ============================================================================

/**
 * Single calibration sample
 */
export interface CalibrationSample {
  /** Sample ID */
  id: string;

  /** Input data (e.g., image, text) */
  input: Float32Array;

  /** Expected output (optional, for validation) */
  expectedOutput?: Float32Array;

  /** Sample metadata */
  metadata?: {
    source: string;
    category?: string;
    difficulty?: "easy" | "medium" | "hard";
  };
}

// ============================================================================
// CALIBRATION DATASET CLASS
// ============================================================================

/**
 * Calibration Dataset
 *
 * Manages representative data for computing quantization parameters.
 *
 * Guidelines:
 * - Use diverse, representative samples
 * - 100-1000 samples typically sufficient
 * - Cover expected input distribution
 *
 * @example
 * ```typescript
 * const dataset = new CalibrationDataset({
 *   numSamples: 100,
 *   strategy: "random"
 * });
 *
 * await dataset.loadFromPath("./calibration_data");
 * const samples = dataset.getSamples();
 * ```
 */
export class CalibrationDataset {
  /** Configuration */
  private config: CalibrationDatasetConfig;

  /** Calibration samples */
  private samples: CalibrationSample[] = [];

  /** Sample cache */
  private cache: Map<string, Float32Array> = new Map();

  /** Random seed */
  private seed: number;

  /**
   * Create calibration dataset
   *
   * @param config - Dataset configuration
   */
  constructor(config: Partial<CalibrationDatasetConfig> = {}) {
    this.config = { ...DEFAULT_CALIBRATION_DATASET_CONFIG, ...config };
    this.seed = this.config.seed || Date.now();
  }

  /**
   * Load calibration data from path
   *
   * @param path - Path to calibration data
   */
  async loadFromPath(path: string): Promise<void> {
    console.log(`[CalibrationDataset] Loading from ${path}...`);

    // In real implementation, load actual data from disk
    // For now, simulate loading
    await this.generateMockData();

    console.log(`[CalibrationDataset] Loaded ${this.samples.length} samples`);
  }

  /**
   * Generate mock calibration data
   */
  private async generateMockData(): Promise<void> {
    const { numSamples, strategy } = this.config;

    this.samples = [];

    for (let i = 0; i < numSamples; i++) {
      const size = 768 + Math.floor(Math.random() * 1000); // VL-JEPA embedding size
      const input = new Float32Array(size);

      // Generate random input data
      for (let j = 0; j < size; j++) {
        input[j] = (Math.random() - 0.5) * 2;
      }

      this.samples.push({
        id: `sample_${i}`,
        input,
        metadata: {
          source: "generated",
          difficulty:
            Math.random() > 0.6
              ? "hard"
              : Math.random() > 0.3
                ? "medium"
                : "easy",
        },
      });
    }
  }

  /**
   * Add sample to dataset
   *
   * @param sample - Sample to add
   */
  addSample(sample: CalibrationSample): void {
    this.samples.push(sample);
  }

  /**
   * Add multiple samples
   *
   * @param samples - Samples to add
   */
  addSamples(samples: CalibrationSample[]): void {
    this.samples.push(...samples);
  }

  /**
   * Get samples from dataset
   *
   * @param count - Number of samples to get (default: all)
   * @returns Array of samples
   */
  getSamples(count?: number): CalibrationSample[] {
    const num = count ?? this.samples.length;

    switch (this.config.strategy) {
      case "random":
        return this.getRandomSamples(num);
      case "stratified":
        return this.getStratifiedSamples(num);
      case "importance":
        return this.getImportanceSamples(num);
      default:
        return this.samples.slice(0, num);
    }
  }

  /**
   * Get random samples
   *
   * @param count - Number of samples
   * @returns Random samples
   */
  private getRandomSamples(count: number): CalibrationSample[] {
    const shuffled = this.shuffle([...this.samples]);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  /**
   * Get stratified samples (by difficulty)
   *
   * @param count - Number of samples
   * @returns Stratified samples
   */
  private getStratifiedSamples(count: number): CalibrationSample[] {
    // Group by difficulty
    const easy = this.samples.filter(s => s.metadata?.difficulty === "easy");
    const medium = this.samples.filter(
      s => s.metadata?.difficulty === "medium"
    );
    const hard = this.samples.filter(s => s.metadata?.difficulty === "hard");

    // Sample evenly from each group
    const perGroup = Math.floor(count / 3);

    const result: CalibrationSample[] = [];

    result.push(...this.shuffle(easy).slice(0, perGroup));
    result.push(...this.shuffle(medium).slice(0, perGroup));
    result.push(...this.shuffle(hard).slice(0, perGroup));

    // Fill remaining with any samples
    const remaining = count - result.length;
    if (remaining > 0) {
      result.push(...this.shuffle(this.samples).slice(0, remaining));
    }

    return result;
  }

  /**
   * Get importance-based samples
   *
   * Samples with higher "importance" (harder, more diverse) are prioritized.
   *
   * @param count - Number of samples
   * @returns Importance-weighted samples
   */
  private getImportanceSamples(count: number): CalibrationSample[] {
    // Score each sample by importance
    const scored = this.samples.map(sample => ({
      sample,
      score: this.calculateImportance(sample),
    }));

    // Sort by score (descending)
    scored.sort((a, b) => b.score - a.score);

    // Return top samples
    return scored.slice(0, count).map(s => s.sample);
  }

  /**
   * Calculate sample importance score
   *
   * @param sample - Sample to score
   * @returns Importance score
   */
  private calculateImportance(sample: CalibrationSample): number {
    let score = 0;

    // Difficulty factor
    if (sample.metadata?.difficulty === "hard") {
      score += 3;
    } else if (sample.metadata?.difficulty === "medium") {
      score += 2;
    } else {
      score += 1;
    }

    // Size diversity factor
    const size = sample.input.length;
    if (size > 1000) {
      score += 2;
    } else if (size > 500) {
      score += 1;
    }

    // Variance factor (higher variance = more informative)
    const variance = this.calculateVariance(sample.input);
    score += Math.min(variance * 10, 2);

    return score;
  }

  /**
   * Calculate variance of array
   *
   * @param arr - Input array
   * @returns Variance
   */
  private calculateVariance(arr: Float32Array): number {
    if (arr.length === 0) return 0;

    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
      sum += arr[i];
    }
    const mean = sum / arr.length;

    let sumSquared = 0;
    for (let i = 0; i < arr.length; i++) {
      const diff = arr[i] - mean;
      sumSquared += diff * diff;
    }

    return sumSquared / arr.length;
  }

  /**
   * Shuffle array using Fisher-Yates
   *
   * @param arr - Array to shuffle
   * @returns Shuffled array
   */
  private shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.seededRandom() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Seeded random number generator
   *
   * @returns Random number [0, 1)
   */
  private seededRandom(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  /**
   * Get batch of samples
   *
   * @param batchSize - Batch size
   * @param numBatches - Number of batches
   * @returns Array of batches
   */
  getBatches(batchSize: number, numBatches?: number): CalibrationSample[][] {
    const samples = this.getSamples(
      numBatches ? batchSize * numBatches : undefined
    );
    const batches: CalibrationSample[][] = [];

    for (let i = 0; i < samples.length; i += batchSize) {
      batches.push(samples.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Get dataset statistics
   *
   * @returns Dataset stats
   */
  getStats(): {
    totalSamples: number;
    avgSize: number;
    minSize: number;
    maxSize: number;
    difficultyDistribution: Record<string, number>;
  } {
    if (this.samples.length === 0) {
      return {
        totalSamples: 0,
        avgSize: 0,
        minSize: 0,
        maxSize: 0,
        difficultyDistribution: {},
      };
    }

    const sizes = this.samples.map(s => s.input.length);
    const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    const minSize = Math.min(...sizes);
    const maxSize = Math.max(...sizes);

    const difficultyDistribution: Record<string, number> = {
      easy: 0,
      medium: 0,
      hard: 0,
    };

    for (const sample of this.samples) {
      const diff = sample.metadata?.difficulty || "medium";
      difficultyDistribution[diff]++;
    }

    return {
      totalSamples: this.samples.length,
      avgSize,
      minSize,
      maxSize,
      difficultyDistribution,
    };
  }

  /**
   * Clear dataset
   */
  clear(): void {
    this.samples = [];
    this.cache.clear();
  }

  /**
   * Get configuration
   *
   * @returns Current configuration
   */
  public getConfig(): CalibrationDatasetConfig {
    return { ...this.config };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create calibration dataset
 *
 * @param config - Optional configuration
 * @returns Calibration dataset instance
 */
export function createCalibrationDataset(
  config?: Partial<CalibrationDatasetConfig>
): CalibrationDataset {
  return new CalibrationDataset(config);
}

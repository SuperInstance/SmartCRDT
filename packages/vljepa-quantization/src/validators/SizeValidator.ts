/**
 * @lsi/vljepa-quantization - Size Validator
 *
 * Validates model size reduction from quantization.
 *
 * Metrics:
 * - Model size (bytes)
 * - Size reduction ratio
 * - Compression ratio
 *
 * @module validators
 */

import type { ModelInfo, QuantizationResult } from "../types.js";

/**
 * Size validation result
 */
export interface SizeValidationResult {
  /** Original size */
  originalSize: number;

  /** Quantized size */
  quantizedSize: number;

  /** Size reduction ratio */
  sizeReduction: number;

  /** Target reduction */
  targetReduction: number;

  /** Target achieved */
  targetAchieved: boolean;

  /** Memory saved */
  memorySaved: number;
}

/**
 * Size validator
 */
export class SizeValidator {
  private targetReduction: number;

  constructor(targetReduction: number = 4.0) {
    this.targetReduction = targetReduction;
  }

  /**
   * Validate size reduction
   *
   * @param quantizationResult - Quantization result
   * @returns Size validation result
   */
  async validateSize(
    quantizationResult: QuantizationResult
  ): Promise<SizeValidationResult> {
    const originalSize = quantizationResult.originalModel.sizeBytes;
    const quantizedSize = quantizationResult.quantizedModel.sizeBytes;
    const sizeReduction = originalSize / quantizedSize;

    return {
      originalSize,
      quantizedSize,
      sizeReduction,
      targetReduction: this.targetReduction,
      targetAchieved: sizeReduction >= this.targetReduction,
      memorySaved: originalSize - quantizedSize,
    };
  }

  /**
   * Calculate size reduction
   *
   * @param originalSize - Original model size
   * @param quantizedSize - Quantized model size
   * @returns Size reduction ratio
   */
  calculateSizeReduction(originalSize: number, quantizedSize: number): number {
    return originalSize / quantizedSize;
  }

  /**
   * Format size for display
   *
   * @param bytes - Size in bytes
   * @returns Formatted string
   */
  formatSize(bytes: number): string {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}

/**
 * Create size validator
 *
 * @param targetReduction - Target size reduction ratio
 * @returns Size validator instance
 */
export function createSizeValidator(targetReduction?: number): SizeValidator {
  return new SizeValidator(targetReduction);
}

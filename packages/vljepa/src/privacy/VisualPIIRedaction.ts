/**
 * VisualPIIRedaction - Visual PII redaction using VL-JEPA embeddings
 *
 * This module implements visual PII (Personally Identifiable Information) redaction
 * for VL-JEPA. It detects and redacts sensitive information in visual data before
 * processing, ensuring privacy without sacrificing functionality.
 *
 * ## Novel Approach: Embedding-Based Redaction
 *
 * Traditional redaction uses pixel-based detection (face detection, OCR). This has
 * limitations: false positives, missed PII, poor performance on edge devices.
 *
 * VL-JEPA enables a novel approach:
 * 1. **Semantic Understanding**: Embeddings capture semantic meaning of regions
 * 2. **Privacy-Aware Detection**: Detect "privacy-sensitive" regions without rules
 * 3. **Adaptive Redaction**: Redaction strategy based on embedding similarity
 * 4. **Learned Privacy**: Train on privacy-labeled datasets
 *
 * ## Redaction Strategies
 *
 * 1. **Pixel Blur**: Gaussian blur over PII regions
 * 2. **Solid Mask**: Black/colored rectangles over PII
 * 3. **Embedding Replacement**: Replace PII embeddings with generic ones
 * 4. **Selective Encoding**: Skip PII regions in encoding
 *
 * ## Architecture
 *
 * ```
 * Input Frame → PII Detection → Redaction → VL-JEPA Encoding → Output
 *                    ↓                  ↓
 *              Bounding Boxes     Redacted Frame
 *                    ↓                  ↓
 *             Face/Text/Doc      Processed by VL-JEPA
 *             Detection          (PII removed)
 * ```
 *
 * @packageDocumentation
 */

import { BoundingBox, VisualPIIType } from "./VisualPrivacyAnalyzer";

/**
 * Redaction strategy to apply
 */
export enum RedactionStrategy {
  /** Blur the region (Gaussian blur) */
  BLUR = "blur",

  /** Solid black rectangle */
  BLACKOUT = "blackout",

  /** Solid colored rectangle (distinguishable as redacted) */
  MASK = "mask",

  /** Pixelate the region (mosaic) */
  PIXELATE = "pixelate",

  /** Remove region entirely (transparent) */
  REMOVE = "remove",

  /** Replace with generic placeholder image */
  PLACEHOLDER = "placeholder",
}

/**
 * Redaction region with applied strategy
 */
export interface RedactionRegion {
  /** Bounding box of region to redact */
  box: BoundingBox;

  /** Strategy to apply */
  strategy: RedactionStrategy;

  /** Color for mask strategy (hex) */
  maskColor?: string;

  /** Blur radius for blur strategy (pixels) */
  blurRadius?: number;

  /** Pixelation block size for pixelate strategy (pixels) */
  pixelateSize?: number;
}

/**
 * Result of PII redaction
 */
export interface RedactionResult {
  /** Redacted image data */
  redactedFrame: ImageData;

  /** Regions that were redacted */
  redactedRegions: RedactionRegion[];

  /** Original PII that was detected */
  detectedPII: BoundingBox[];

  /** Percentage of frame redacted */
  redactionPercentage: number;

  /** Whether redaction was successful */
  success: boolean;

  /** Any errors that occurred */
  errors: string[];
}

/**
 * Configuration for Visual PII Redactor
 */
export interface VisualPIIRedactionConfig {
  /** Default redaction strategy */
  defaultStrategy: RedactionStrategy;

  /** Maximum percentage of frame that can be redacted (0-100) */
  maxRedactionPercentage: number;

  /** Enable confidence thresholding */
  confidenceThreshold: number;

  /** Specific strategies for PII types */
  piiTypeStrategies: {
    [key in VisualPIIType]?: RedactionStrategy;
  };

  /** Blur radius for blur strategy (pixels) */
  defaultBlurRadius: number;

  /** Pixelation block size (pixels) */
  defaultPixelateSize: number;

  /** Mask color (hex) */
  defaultMaskColor: string;

  /** Enable quality checks after redaction */
  enableQualityCheck: boolean;

  /** Minimum redaction size (pixels, ignore smaller) */
  minRedactionSize: number;
}

/**
 * Quality metrics for redaction
 */
export interface RedactionQuality {
  /** Whether PII is adequately obscured (0-1) */
  obscurationScore: number;

  /** Whether frame is still usable for VL-JEPA (0-1) */
  usabilityScore: number;

  /** Overall quality score (0-1) */
  overallScore: number;

  /** Quality issues detected */
  issues: string[];
}

/**
 * VisualPIIRedactor - Redact PII from visual data
 *
 * This redactor uses VL-JEPA embeddings to intelligently detect and redact
 * PII in visual frames while preserving usability for downstream tasks.
 *
 * ## Example
 *
 * ```typescript
 * const redactor = new VisualPIIRedactor({
 *   defaultStrategy: RedactionStrategy.BLUR,
 *   maxRedactionPercentage: 30,
 * });
 *
 * // Detect PII
 * const detectedPII = await detector.detect(frame);
 *
 * // Redact PII
 * const result = await redactor.redact(frame, detectedPII);
 *
 * // Use redacted frame for VL-JEPA
 * const embedding = await vljepa.encode(result.redactedFrame);
 * ```
 */
export class VisualPIIRedactor {
  private config: Required<VisualPIIRedactionConfig>;

  constructor(config: VisualPIIRedactionConfig) {
    this.config = {
      defaultStrategy: config.defaultStrategy,
      maxRedactionPercentage: config.maxRedactionPercentage ?? 30,
      confidenceThreshold: config.confidenceThreshold ?? 0.7,
      piiTypeStrategies: config.piiTypeStrategies ?? {},
      defaultBlurRadius: config.defaultBlurRadius ?? 15,
      defaultPixelateSize: config.defaultPixelateSize ?? 10,
      defaultMaskColor: config.defaultMaskColor ?? "#FF0000",
      enableQualityCheck: config.enableQualityCheck ?? true,
      minRedactionSize: config.minRedactionSize ?? 100, // 10x10 pixels
    };
  }

  /**
   * Redact PII from visual frame
   *
   * @param frame - Original frame
   * @param detectedPII - PII detected in frame
   * @returns Redaction result
   */
  async redact(
    frame: ImageData,
    detectedPII: BoundingBox[]
  ): Promise<RedactionResult> {
    const errors: string[] = [];
    const redactedRegions: RedactionRegion[] = [];

    try {
      // Filter by confidence threshold
      const filteredPII = detectedPII.filter(
        pii => pii.confidence >= this.config.confidenceThreshold
      );

      // Filter by minimum size
      const sizedPII = filteredPII.filter(pii => {
        const width = pii.width * frame.width;
        const height = pii.height * frame.height;
        return width * height >= this.config.minRedactionSize;
      });

      // Check max redaction percentage
      const totalArea = sizedPII.reduce(
        (sum, pii) => sum + pii.width * pii.height,
        0
      );
      const redactionPercentage = totalArea * 100;

      if (redactionPercentage > this.config.maxRedactionPercentage) {
        errors.push(
          `Redaction percentage ${redactionPercentage.toFixed(1)}% ` +
            `exceeds maximum ${this.config.maxRedactionPercentage}%`
        );
        return {
          redactedFrame: frame,
          redactedRegions: [],
          detectedPII: sizedPII,
          redactionPercentage,
          success: false,
          errors,
        };
      }

      // Create redaction regions
      for (const pii of sizedPII) {
        const strategy =
          this.config.piiTypeStrategies[pii.type] ??
          this.config.defaultStrategy;

        redactedRegions.push({
          box: pii,
          strategy,
          blurRadius: this.config.defaultBlurRadius,
          pixelateSize: this.config.defaultPixelateSize,
          maskColor: this.config.defaultMaskColor,
        });
      }

      // Apply redactions
      let redactedFrame = this.cloneImageData(frame);
      for (const region of redactedRegions) {
        redactedFrame = this.applyRedaction(redactedFrame, region);
      }

      // Quality check (optional)
      if (this.config.enableQualityCheck) {
        const quality = this.checkQuality(redactedFrame, redactedRegions);
        if (quality.overallScore < 0.5) {
          errors.push(`Poor redaction quality: ${quality.issues.join(", ")}`);
        }
      }

      return {
        redactedFrame,
        redactedRegions,
        detectedPII: sizedPII,
        redactionPercentage,
        success: true,
        errors,
      };
    } catch (error) {
      errors.push(
        `Redaction failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return {
        redactedFrame: frame,
        redactedRegions: [],
        detectedPII,
        redactionPercentage: 0,
        success: false,
        errors,
      };
    }
  }

  /**
   * Redact a single region
   *
   * @param frame - Frame to redact
   * @param region - Region to redact
   * @returns Redacted frame
   */
  async redactRegion(
    frame: ImageData,
    region: RedactionRegion
  ): Promise<ImageData> {
    return this.applyRedaction(frame, region);
  }

  /**
   * Batch redact multiple frames
   *
   * @param frames - Frames to redact
   * @param detectedPII - PII for each frame
   * @returns Redaction results
   */
  async redactBatch(
    frames: ImageData[],
    detectedPII: BoundingBox[][]
  ): Promise<RedactionResult[]> {
    const results: RedactionResult[] = [];

    for (let i = 0; i < frames.length; i++) {
      const result = await this.redact(frames[i], detectedPII[i] || []);
      results.push(result);
    }

    return results;
  }

  /**
   * Check redaction quality
   *
   * @param frame - Redacted frame
   * @param regions - Regions that were redacted
   * @returns Quality metrics
   */
  checkQuality(frame: ImageData, regions: RedactionRegion[]): RedactionQuality {
    const issues: string[] = [];

    // Check obscuration (simple heuristic: variance in redacted regions)
    let obscurationSum = 0;
    for (const region of regions) {
      const box = region.box;
      const x = Math.floor(box.x * frame.width);
      const y = Math.floor(box.y * frame.height);
      const w = Math.floor(box.width * frame.width);
      const h = Math.floor(box.height * frame.height);

      // Calculate variance in redacted region
      const variance = this.calculateRegionVariance(frame, x, y, w, h);

      // Low variance means good obscuration
      obscurationSum += 1 - Math.min(variance / 1000, 1);
    }

    const obscurationScore =
      regions.length > 0 ? obscurationSum / regions.length : 1;

    // Check usability (percentage of frame not redacted)
    const redactedArea = regions.reduce(
      (sum, r) => sum + r.box.width * r.box.height,
      0
    );
    const usabilityScore = 1 - Math.min(redactedArea, 1);

    // Overall score (weighted average)
    const overallScore = obscurationScore * 0.6 + usabilityScore * 0.4;

    // Generate issues
    if (obscurationScore < 0.7) {
      issues.push("PII may not be adequately obscured");
    }
    if (usabilityScore < 0.5) {
      issues.push("Too much frame redacted, may impact usability");
    }

    return {
      obscurationScore,
      usabilityScore,
      overallScore,
      issues,
    };
  }

  /**
   * Update redaction configuration
   *
   * @param config - Partial configuration updates
   */
  updateConfig(config: Partial<VisualPIIRedactionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<VisualPIIRedactionConfig> {
    return { ...this.config };
  }

  /**
   * Apply redaction to frame
   *
   * @param frame - Frame to redact
   * @param region - Region to redact
   * @returns Redacted frame
   */
  private applyRedaction(frame: ImageData, region: RedactionRegion): ImageData {
    const { box, strategy } = region;

    // Convert normalized coordinates to pixels
    const x = Math.floor(box.x * frame.width);
    const y = Math.floor(box.y * frame.height);
    const w = Math.floor(box.width * frame.width);
    const h = Math.floor(box.height * frame.height);

    // Apply strategy
    switch (strategy) {
      case RedactionStrategy.BLUR:
        return this.applyBlur(
          frame,
          x,
          y,
          w,
          h,
          region.blurRadius ?? this.config.defaultBlurRadius
        );

      case RedactionStrategy.BLACKOUT:
        return this.applyMask(frame, x, y, w, h, "#000000");

      case RedactionStrategy.MASK:
        return this.applyMask(
          frame,
          x,
          y,
          w,
          h,
          region.maskColor ?? this.config.defaultMaskColor
        );

      case RedactionStrategy.PIXELATE:
        return this.applyPixelate(
          frame,
          x,
          y,
          w,
          h,
          region.pixelateSize ?? this.config.defaultPixelateSize
        );

      case RedactionStrategy.REMOVE:
        return this.applyRemove(frame, x, y, w, h);

      case RedactionStrategy.PLACEHOLDER:
        return this.applyPlaceholder(frame, x, y, w, h);

      default:
        return frame;
    }
  }

  /**
   * Apply Gaussian blur to region
   *
   * @param frame - Frame to blur
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param w - Width
   * @param h - Height
   * @param radius - Blur radius
   * @returns Blurred frame
   */
  private applyBlur(
    frame: ImageData,
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number
  ): ImageData {
    const result = this.cloneImageData(frame);
    const data = result.data;
    const originalData = frame.data;

    // Simple box blur (approximation of Gaussian)
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        if (px < 0 || px >= frame.width || py < 0 || py >= frame.height) {
          continue;
        }

        let rSum = 0,
          gSum = 0,
          bSum = 0,
          count = 0;

        // Sample pixels in radius
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = px + dx;
            const ny = py + dy;

            if (nx >= 0 && nx < frame.width && ny >= 0 && ny < frame.height) {
              const idx = (ny * frame.width + nx) * 4;
              rSum += originalData[idx];
              gSum += originalData[idx + 1];
              bSum += originalData[idx + 2];
              count++;
            }
          }
        }

        const idx = (py * frame.width + px) * 4;
        data[idx] = rSum / count;
        data[idx + 1] = gSum / count;
        data[idx + 2] = bSum / count;
        // Alpha unchanged
      }
    }

    return result;
  }

  /**
   * Apply solid mask to region
   *
   * @param frame - Frame to mask
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param w - Width
   * @param h - Height
   * @param color - Mask color (hex)
   * @returns Masked frame
   */
  private applyMask(
    frame: ImageData,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string
  ): ImageData {
    const result = this.cloneImageData(frame);
    const data = result.data;

    // Parse hex color
    const hex = color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Apply mask
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        if (px >= 0 && px < frame.width && py >= 0 && py < frame.height) {
          const idx = (py * frame.width + px) * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          // Alpha unchanged
        }
      }
    }

    return result;
  }

  /**
   * Apply pixelation to region
   *
   * @param frame - Frame to pixelate
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param w - Width
   * @param h - Height
   * @param blockSize - Size of pixelation blocks
   * @returns Pixelated frame
   */
  private applyPixelate(
    frame: ImageData,
    x: number,
    y: number,
    w: number,
    h: number,
    blockSize: number
  ): ImageData {
    const result = this.cloneImageData(frame);
    const data = result.data;
    const originalData = frame.data;

    // Apply pixelation
    for (let py = y; py < y + h; py += blockSize) {
      for (let px = x; px < x + w; px += blockSize) {
        // Calculate average color for block
        let rSum = 0,
          gSum = 0,
          bSum = 0,
          count = 0;

        for (let by = 0; by < blockSize && py + by < y + h; by++) {
          for (let bx = 0; bx < blockSize && px + bx < x + w; bx++) {
            const nx = px + bx;
            const ny = py + by;

            if (nx >= 0 && nx < frame.width && ny >= 0 && ny < frame.height) {
              const idx = (ny * frame.width + nx) * 4;
              rSum += originalData[idx];
              gSum += originalData[idx + 1];
              bSum += originalData[idx + 2];
              count++;
            }
          }
        }

        const rAvg = rSum / count;
        const gAvg = gSum / count;
        const bAvg = bSum / count;

        // Fill block with average color
        for (let by = 0; by < blockSize && py + by < y + h; by++) {
          for (let bx = 0; bx < blockSize && px + bx < x + w; bx++) {
            const nx = px + bx;
            const ny = py + by;

            if (nx >= 0 && nx < frame.width && ny >= 0 && ny < frame.height) {
              const idx = (ny * frame.width + nx) * 4;
              data[idx] = rAvg;
              data[idx + 1] = gAvg;
              data[idx + 2] = bAvg;
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Remove region (set to transparent)
   *
   * @param frame - Frame to modify
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param w - Width
   * @param h - Height
   * @returns Modified frame
   */
  private applyRemove(
    frame: ImageData,
    x: number,
    y: number,
    w: number,
    h: number
  ): ImageData {
    const result = this.cloneImageData(frame);
    const data = result.data;

    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        if (px >= 0 && px < frame.width && py >= 0 && py < frame.height) {
          const idx = (py * frame.width + px) * 4;
          data[idx + 3] = 0; // Set alpha to 0 (transparent)
        }
      }
    }

    return result;
  }

  /**
   * Apply placeholder pattern to region
   *
   * @param frame - Frame to modify
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param w - Width
   * @param h - Height
   * @returns Modified frame
   */
  private applyPlaceholder(
    frame: ImageData,
    x: number,
    y: number,
    w: number,
    h: number
  ): ImageData {
    const result = this.cloneImageData(frame);
    const data = result.data;

    // Create a checkerboard pattern (gray/red)
    const color1 = { r: 128, g: 128, b: 128 };
    const color2 = { r: 200, g: 50, b: 50 };
    const patternSize = 8;

    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        if (px >= 0 && px < frame.width && py >= 0 && py < frame.height) {
          const idx = (py * frame.width + px) * 4;
          const pattern =
            (Math.floor(px / patternSize) + Math.floor(py / patternSize)) %
              2 ===
            0;
          const color = pattern ? color1 : color2;

          data[idx] = color.r;
          data[idx + 1] = color.g;
          data[idx + 2] = color.b;
        }
      }
    }

    return result;
  }

  /**
   * Calculate variance in region (for quality check)
   *
   * @param frame - Frame to analyze
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param w - Width
   * @param h - Height
   * @returns Variance
   */
  private calculateRegionVariance(
    frame: ImageData,
    x: number,
    y: number,
    w: number,
    h: number
  ): number {
    const data = frame.data;
    let sum = 0;
    let count = 0;

    // Calculate mean
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        if (px >= 0 && px < frame.width && py >= 0 && py < frame.height) {
          const idx = (py * frame.width + px) * 4;
          const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
          sum += brightness;
          count++;
        }
      }
    }

    const mean = sum / count;

    // Calculate variance
    let varianceSum = 0;
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        if (px >= 0 && px < frame.width && py >= 0 && py < frame.height) {
          const idx = (py * frame.width + px) * 4;
          const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
          varianceSum += (brightness - mean) ** 2;
        }
      }
    }

    return varianceSum / count;
  }

  /**
   * Clone ImageData
   *
   * @param frame - Frame to clone
   * @returns Cloned frame
   */
  private cloneImageData(frame: ImageData): ImageData {
    return new ImageData(
      new Uint8ClampedArray(frame.data),
      frame.width,
      frame.height
    );
  }
}

/**
 * Create default redaction configuration
 *
 * @returns Default configuration
 */
export function createDefaultRedactionConfig(): VisualPIIRedactionConfig {
  return {
    defaultStrategy: RedactionStrategy.BLUR,
    maxRedactionPercentage: 30,
    confidenceThreshold: 0.7,
    piiTypeStrategies: {
      [VisualPIIType.FACE]: RedactionStrategy.BLUR,
      [VisualPIIType.TEXT]: RedactionStrategy.MASK,
      [VisualPIIType.DOCUMENT]: RedactionStrategy.BLACKOUT,
      [VisualPIIType.SCREEN]: RedactionStrategy.BLUR,
      [VisualPIIType.FINANCIAL]: RedactionStrategy.BLACKOUT,
      [VisualPIIType.MEDICAL]: RedactionStrategy.BLACKOUT,
      [VisualPIIType.CONTACT]: RedactionStrategy.MASK,
      [VisualPIIType.LOCATION]: RedactionStrategy.MASK,
    },
    defaultBlurRadius: 15,
    defaultPixelateSize: 10,
    defaultMaskColor: "#FF4444",
    enableQualityCheck: true,
    minRedactionSize: 100,
  };
}

/**
 * Data Augmentation
 *
 * Data augmentation utilities for curriculum learning
 */

import type { TrainingExample, ImageData } from "../types.js";

export class DataAugmentation {
  /**
   * Apply random augmentation to example
   */
  static augment(
    example: TrainingExample,
    options: {
      rotate?: boolean;
      flip?: boolean;
      brightness?: number;
      contrast?: number;
      noise?: number;
    } = {}
  ): TrainingExample {
    let imageData = { ...example.imageData };

    if (options.rotate) {
      imageData = this.rotate(imageData, Math.random() * 360);
    }

    if (options.flip) {
      imageData = this.flip(imageData, Math.random() > 0.5);
    }

    if (options.brightness) {
      imageData = this.adjustBrightness(
        imageData,
        (Math.random() - 0.5) * options.brightness
      );
    }

    if (options.contrast) {
      imageData = this.adjustContrast(
        imageData,
        1 + (Math.random() - 0.5) * options.contrast
      );
    }

    if (options.noise) {
      imageData = this.addNoise(imageData, options.noise);
    }

    return {
      ...example,
      imageData,
    };
  }

  /**
   * Rotate image
   */
  private static rotate(imageData: ImageData, angle: number): ImageData {
    // Simplified rotation - just return original for now
    return imageData;
  }

  /**
   * Flip image horizontally or vertically
   */
  private static flip(imageData: ImageData, horizontal: boolean): ImageData {
    const { width, height, channels, data } = imageData;
    const flipped = new Uint8Array(data.length);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIdx = (y * width + x) * channels;
        const dstIdx = horizontal
          ? (y * width + (width - 1 - x)) * channels
          : ((height - 1 - y) * width + x) * channels;

        for (let c = 0; c < channels; c++) {
          flipped[dstIdx + c] = data[srcIdx + c];
        }
      }
    }

    return { width, height, channels, data: flipped };
  }

  /**
   * Adjust brightness
   */
  private static adjustBrightness(
    imageData: ImageData,
    adjustment: number
  ): ImageData {
    const { data } = imageData;
    const adjusted = new Uint8Array(data.length);

    for (let i = 0; i < data.length; i++) {
      adjusted[i] = Math.max(0, Math.min(255, data[i] + adjustment * 255));
    }

    return { ...imageData, data: adjusted };
  }

  /**
   * Adjust contrast
   */
  private static adjustContrast(
    imageData: ImageData,
    factor: number
  ): ImageData {
    const { data } = imageData;
    const adjusted = new Uint8Array(data.length);
    const mean = 128;

    for (let i = 0; i < data.length; i++) {
      adjusted[i] = Math.max(
        0,
        Math.min(255, mean + factor * (data[i] - mean))
      );
    }

    return { ...imageData, data: adjusted };
  }

  /**
   * Add Gaussian noise
   */
  private static addNoise(imageData: ImageData, stdDev: number): ImageData {
    const { data } = imageData;
    const noisy = new Uint8Array(data.length);

    for (let i = 0; i < data.length; i++) {
      const noise = this.gaussianRandom() * stdDev * 255;
      noisy[i] = Math.max(0, Math.min(255, data[i] + noise));
    }

    return { ...imageData, data: noisy };
  }

  /**
   * Generate Gaussian random number (Box-Muller transform)
   */
  private static gaussianRandom(): number {
    let u = 0,
      v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  /**
   * Mix two examples (mixup augmentation)
   */
  static mixup(
    example1: TrainingExample,
    example2: TrainingExample,
    alpha: number = 0.2
  ): TrainingExample[] {
    const lambda = Math.random() * alpha + (1 - alpha);

    // Mix embeddings
    const embedding = new Float32Array(example1.embedding.length);
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] =
        lambda * example1.embedding[i] + (1 - lambda) * example2.embedding[i];
    }

    // Create mixed example
    const mixedExample: TrainingExample = {
      id: `mixed_${example1.id}_${example2.id}`,
      stageId: example1.stageId,
      imageData: example1.imageData,
      embedding,
      metadata: {
        labels: [...example1.metadata.labels, ...example2.metadata.labels],
        attributes: {
          ...example1.metadata.attributes,
          ...example2.metadata.attributes,
        },
      },
      difficulty:
        lambda * example1.difficulty + (1 - lambda) * example2.difficulty,
      timestamp: Date.now(),
    };

    return [mixedExample];
  }

  /**
   * Cutmix augmentation
   */
  static cutmix(
    example1: TrainingExample,
    example2: TrainingExample,
    beta: number = 1.0
  ): TrainingExample {
    // Simplified cutmix - return example1 with adjusted embedding
    const lambda = Math.random() * beta + (1 - beta);

    const embedding = new Float32Array(example1.embedding.length);
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] =
        lambda * example1.embedding[i] + (1 - lambda) * example2.embedding[i];
    }

    return {
      ...example1,
      embedding,
    };
  }
}

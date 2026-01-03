/**
 * Image Preprocessing for X-Encoder (Vision Transformer)
 *
 * Handles conversion of UI frames (ImageData, Canvas, etc.) into
 * normalized tensors suitable for Vision Transformer processing.
 *
 * Key Features:
 * - Resize images to standard size (224x224)
 * - Normalize pixel values to [0, 1] or [-1, 1]
 * - Convert ImageData to Float32Array tensors
 * - Support batch processing
 * - Data augmentation for training
 *
 * @packageDocumentation
 */

// Polyfill for browser APIs in Node.js environment
if (typeof document === "undefined") {
  (globalThis as any).document = {
    createElement: (tag: string) => ({
      width: 0,
      height: 0,
      getContext: () => null,
    }),
  };
}

/**
 * Image size specification
 */
export interface ImageSize {
  width: number;
  height: number;
}

/**
 * Preprocessing options
 */
export interface PreprocessingOptions {
  /** Target size for resizing */
  targetSize: ImageSize;
  /** Normalization mode: '01' for [0,1], '11' for [-1,1], 'imagenet' for ImageNet stats */
  normalization: "01" | "11" | "imagenet";
  /** Whether to maintain aspect ratio (add padding if needed) */
  maintainAspectRatio: boolean;
  /** Padding color (for aspect ratio maintenance) */
  paddingColor: { r: number; g: number; b: number };
}

/**
 * Preprocessed image tensor
 */
export interface PreprocessedImage {
  /** Tensor data (C x H x W layout) */
  tensor: Float32Array;
  /** Image dimensions */
  size: ImageSize;
  /** Original size before preprocessing */
  originalSize: ImageSize;
}

/**
 * Default preprocessing options for VL-JEPA X-Encoder
 */
export const DEFAULT_PREPROCESSING_OPTIONS: PreprocessingOptions = {
  targetSize: { width: 224, height: 224 },
  normalization: "imagenet",
  maintainAspectRatio: false,
  paddingColor: { r: 128, g: 128, b: 128 },
};

/**
 * Image Preprocessor
 *
 * Converts various image formats into normalized tensors for ViT processing.
 */
export class ImagePreprocessor {
  private options: PreprocessingOptions;

  /**
   * ImageNet mean and std for normalization
   * These values are standard for models trained on ImageNet
   */
  private static readonly IMAGENET_MEAN = [0.485, 0.456, 0.406];
  private static readonly IMAGENET_STD = [0.229, 0.224, 0.225];

  constructor(options?: Partial<PreprocessingOptions>) {
    this.options = {
      ...DEFAULT_PREPROCESSING_OPTIONS,
      ...options,
    };
  }

  /**
   * Preprocess an ImageData object
   *
   * @param imageData - ImageData to preprocess
   * @param options - Override options for this specific preprocessing
   * @returns Preprocessed image tensor
   */
  preprocess(
    imageData: ImageData,
    options?: Partial<PreprocessingOptions>
  ): PreprocessedImage {
    const opts = options ? { ...this.options, ...options } : this.options;
    const originalSize = { width: imageData.width, height: imageData.height };

    // Step 1: Resize if needed
    const resized = this.resize(
      imageData,
      opts.targetSize,
      opts.maintainAspectRatio
    );

    // Step 2: Convert to tensor (C x H x W layout)
    const tensor = this.toTensor(resized);

    // Step 3: Normalize
    const normalized = this.normalize(tensor, opts.normalization);

    return {
      tensor: normalized,
      size: opts.targetSize,
      originalSize,
    };
  }

  /**
   * Preprocess an HTMLCanvasElement
   *
   * @param canvas - Canvas element to preprocess
   * @param options - Override options
   * @returns Preprocessed image tensor
   */
  preprocessCanvas(
    canvas: HTMLCanvasElement,
    options?: Partial<PreprocessingOptions>
  ): PreprocessedImage {
    const imageData = canvas
      .getContext("2d")
      ?.getImageData(0, 0, canvas.width, canvas.height);

    if (!imageData) {
      throw new Error("Failed to get ImageData from canvas");
    }

    return this.preprocess(imageData, options);
  }

  /**
   * Batch preprocess multiple images
   *
   * @param images - Array of ImageData
   * @returns Array of preprocessed images
   */
  preprocessBatch(images: ImageData[]): PreprocessedImage[] {
    return images.map(img => this.preprocess(img));
  }

  /**
   * Resize ImageData to target size
   *
   * @param imageData - Source image
   * @param targetSize - Target dimensions
   * @param maintainAspectRatio - Whether to maintain aspect ratio with padding
   * @returns Resized ImageData
   */
  resize(
    imageData: ImageData,
    targetSize: ImageSize,
    maintainAspectRatio: boolean
  ): ImageData {
    const { width: srcWidth, height: srcHeight } = imageData;
    const { width: dstWidth, height: dstHeight } = targetSize;

    // If already target size, return as-is
    if (srcWidth === dstWidth && srcHeight === dstHeight) {
      return imageData;
    }

    // Create canvas for resizing
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    canvas.width = dstWidth;
    canvas.height = dstHeight;

    if (maintainAspectRatio) {
      // Calculate scaling to fit within target size
      const scale = Math.min(dstWidth / srcWidth, dstHeight / srcHeight);
      const scaledWidth = Math.round(srcWidth * scale);
      const scaledHeight = Math.round(srcHeight * scale);

      // Calculate padding
      const padX = Math.floor((dstWidth - scaledWidth) / 2);
      const padY = Math.floor((dstHeight - scaledHeight) / 2);

      // Fill with padding color
      ctx.fillStyle = `rgb(${this.options.paddingColor.r}, ${this.options.paddingColor.g}, ${this.options.paddingColor.b})`;
      ctx.fillRect(0, 0, dstWidth, dstHeight);

      // Draw scaled image
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = scaledWidth;
      tempCanvas.height = scaledHeight;
      const tempCtx = tempCanvas.getContext("2d")!;
      tempCtx.drawImage(
        this.imageDataToCanvas(imageData),
        0,
        0,
        scaledWidth,
        scaledHeight
      );

      ctx.drawImage(tempCanvas, padX, padY);
    } else {
      // Direct resize
      ctx.drawImage(
        this.imageDataToCanvas(imageData),
        0,
        0,
        dstWidth,
        dstHeight
      );
    }

    return ctx.getImageData(0, 0, dstWidth, dstHeight);
  }

  /**
   * Convert ImageData to Float32Array tensor (C x H x W layout)
   *
   * @param imageData - ImageData to convert
   * @returns Float32Array tensor with shape (3, H, W)
   */
  toTensor(imageData: ImageData): Float32Array {
    const { width, height, data } = imageData;
    const tensor = new Float32Array(3 * height * width);

    // Convert from H x W x C (RGBA) to C x H x W (RGB only)
    for (let c = 0; c < 3; c++) {
      for (let h = 0; h < height; h++) {
        for (let w = 0; w < width; w++) {
          const srcIdx = (h * width + w) * 4 + c;
          const dstIdx = c * height * width + h * width + w;
          tensor[dstIdx] = data[srcIdx];
        }
      }
    }

    return tensor;
  }

  /**
   * Normalize tensor to specified range
   *
   * @param tensor - Input tensor
   * @param mode - Normalization mode
   * @returns Normalized tensor
   */
  normalize(
    tensor: Float32Array,
    mode: "01" | "11" | "imagenet"
  ): Float32Array {
    const normalized = new Float32Array(tensor.length);
    const totalPixels = tensor.length / 3;

    switch (mode) {
      case "01":
        // Normalize to [0, 1]
        for (let i = 0; i < tensor.length; i++) {
          normalized[i] = tensor[i] / 255.0;
        }
        break;

      case "11":
        // Normalize to [-1, 1]
        for (let i = 0; i < tensor.length; i++) {
          normalized[i] = (tensor[i] / 255.0) * 2.0 - 1.0;
        }
        break;

      case "imagenet":
        // ImageNet normalization: (x/255 - mean) / std
        for (let c = 0; c < 3; c++) {
          const mean = ImagePreprocessor.IMAGENET_MEAN[c];
          const std = ImagePreprocessor.IMAGENET_STD[c];
          for (let i = 0; i < totalPixels; i++) {
            const idx = c * totalPixels + i;
            normalized[idx] = (tensor[idx] / 255.0 - mean) / std;
          }
        }
        break;

      default:
        throw new Error(`Unknown normalization mode: ${mode}`);
    }

    return normalized;
  }

  /**
   * Denormalize tensor back to pixel values
   *
   * @param tensor - Normalized tensor
   * @param mode - Original normalization mode
   * @returns Denormalized tensor (0-255 range)
   */
  denormalize(
    tensor: Float32Array,
    mode: "01" | "11" | "imagenet"
  ): Float32Array {
    const denormalized = new Float32Array(tensor.length);
    const totalPixels = tensor.length / 3;

    switch (mode) {
      case "01":
        // From [0, 1] to [0, 255]
        for (let i = 0; i < tensor.length; i++) {
          denormalized[i] = tensor[i] * 255.0;
        }
        break;

      case "11":
        // From [-1, 1] to [0, 255]
        for (let i = 0; i < tensor.length; i++) {
          denormalized[i] = (tensor[i] + 1.0) * 127.5;
        }
        break;

      case "imagenet":
        // From ImageNet normalized to [0, 255]
        for (let c = 0; c < 3; c++) {
          const mean = ImagePreprocessor.IMAGENET_MEAN[c];
          const std = ImagePreprocessor.IMAGENET_STD[c];
          for (let i = 0; i < totalPixels; i++) {
            const idx = c * totalPixels + i;
            denormalized[idx] = (tensor[idx] * std + mean) * 255.0;
          }
        }
        break;

      default:
        throw new Error(`Unknown normalization mode: ${mode}`);
    }

    return denormalized;
  }

  /**
   * Apply data augmentation for training
   *
   * @param imageData - Source image
   * @param seed - Random seed for reproducibility
   * @returns Augmented ImageData
   */
  augment(imageData: ImageData, seed?: number): ImageData {
    // Seeded random for reproducibility
    let randomVal: () => number;
    if (seed !== undefined) {
      // Simple seeded random
      let s = seed;
      randomVal = () => {
        s = Math.sin(s) * 10000;
        return s - Math.floor(s);
      };
    } else {
      randomVal = Math.random;
    }

    const { width, height, data } = imageData;
    const augmented = new ImageData(width, height);
    augmented.data.set(data);

    // Random horizontal flip (50% chance)
    if (randomVal() > 0.5) {
      this.horizontalFlip(augmented);
    }

    // Random color jitter (20% chance)
    if (randomVal() > 0.8) {
      this.colorJitter(augmented, randomVal);
    }

    return augmented;
  }

  /**
   * Horizontal flip (in-place)
   */
  private horizontalFlip(imageData: ImageData): void {
    const { width, height, data } = imageData;
    const temp = new Uint8ClampedArray(data);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIdx = (y * width + x) * 4;
        const dstIdx = (y * width + (width - 1 - x)) * 4;
        data[dstIdx] = temp[srcIdx];
        data[dstIdx + 1] = temp[srcIdx + 1];
        data[dstIdx + 2] = temp[srcIdx + 2];
        data[dstIdx + 3] = temp[srcIdx + 3];
      }
    }
  }

  /**
   * Color jitter (in-place)
   */
  private colorJitter(imageData: ImageData, random: () => number): void {
    const { data } = imageData;
    const brightness = (random() - 0.5) * 0.2; // +/- 10%
    const contrast = 1 + (random() - 0.5) * 0.2; // +/- 10%
    const saturation = 1 + (random() - 0.5) * 0.2; // +/- 10%

    for (let i = 0; i < data.length; i += 4) {
      // Apply brightness
      data[i] = Math.min(255, Math.max(0, data[i] + brightness * 255));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + brightness * 255));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + brightness * 255));

      // Apply contrast
      data[i] = Math.min(255, Math.max(0, (data[i] - 128) * contrast + 128));
      data[i + 1] = Math.min(
        255,
        Math.max(0, (data[i + 1] - 128) * contrast + 128)
      );
      data[i + 2] = Math.min(
        255,
        Math.max(0, (data[i + 2] - 128) * contrast + 128)
      );

      // Apply saturation (simple approximation)
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = Math.min(
        255,
        Math.max(0, gray + saturation * (data[i] - gray))
      );
      data[i + 1] = Math.min(
        255,
        Math.max(0, gray + saturation * (data[i + 1] - gray))
      );
      data[i + 2] = Math.min(
        255,
        Math.max(0, gray + saturation * (data[i + 2] - gray))
      );
    }
  }

  /**
   * Convert ImageData to HTMLCanvasElement (helper for resize)
   */
  private imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext("2d")!;
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  /**
   * Get preprocessing options
   */
  getOptions(): PreprocessingOptions {
    return { ...this.options };
  }

  /**
   * Update preprocessing options
   */
  setOptions(options: Partial<PreprocessingOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Quick preprocessing utility function
 *
 * @param imageData - ImageData to preprocess
 * @param targetSize - Target size (default: 224x224)
 * @returns Preprocessed tensor
 */
export function preprocessImage(
  imageData: ImageData,
  targetSize: ImageSize = { width: 224, height: 224 }
): Float32Array {
  const preprocessor = new ImagePreprocessor({ targetSize });
  return preprocessor.preprocess(imageData).tensor;
}

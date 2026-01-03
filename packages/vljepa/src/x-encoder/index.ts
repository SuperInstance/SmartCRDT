/**
 * X-Encoder Module Index
 *
 * Vision Transformer encoder for VL-JEPA.
 * Exports all X-Encoder components and utilities.
 *
 * @packageDocumentation
 */

// Main X-Encoder
export {
  XEncoder,
  createXEncoder,
  encodeImage,
  encodeImageBatch,
  validateXEncoderConfig,
  estimateMemoryUsage,
  getSupportedFormats,
  isFormatSupported,
  type XEncoderResult,
} from "./XEncoder.js";

// Preprocessing
export {
  ImagePreprocessor,
  preprocessImage,
  type ImageSize,
  type PreprocessingOptions,
  type PreprocessedImage,
  DEFAULT_PREPROCESSING_OPTIONS,
} from "./Preprocessing.js";

// Patch Embedding
export {
  PatchEmbedding,
  createPatchEmbedding,
  calculateNumPatches,
  validatePatchConfig,
  type PatchEmbeddingConfig,
  type PatchEmbeddingOutput,
} from "./PatchEmbedding.js";

// Vision Transformer
export {
  VisionTransformer,
  createVisionTransformer,
  createVisionTransformerFromConfig,
  validateViTConfig,
  MultiHeadAttention,
  FeedForwardNetwork,
  TransformerLayer,
  type VisionTransformerConfig,
  type TransformerLayerConfig,
  type TransformerOutput,
} from "./VisionTransformer.js";

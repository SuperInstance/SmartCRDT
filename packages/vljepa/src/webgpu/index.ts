/**
 * @lsi/vljepa/webgpu - WebGPU Acceleration for VL-JEPA
 *
 * WebGPU-accelerated components for VL-JEPA enabling sub-100ms
 * inference in the browser.
 *
 * Components:
 * - WebGPUContext: WebGPU device and resource management
 * - BufferManager: GPU memory management with pooling
 * - XEncoderGPU: GPU-accelerated vision encoder
 * - PredictorGPU: GPU-accelerated predictor
 * - ComputeShaders: WGSL compute kernels
 *
 * @version 1.0.0
 */

// WebGPUContext exports
export {
  WebGPUContext,
  createWebGPUContext,
  checkWebGPUCompatibility,
} from "./WebGPUContext.js";

export type {
  WebGPUConfig,
  WebGPUInitResult,
  WebGPUMetrics,
} from "./WebGPUContext.js";

// BufferManager exports
export { BufferManager, TensorBuffer } from "./BufferManager.js";

export type { BufferOptions, BufferStats } from "./BufferManager.js";

// XEncoderGPU exports
export { XEncoderGPU, createXEncoderGPU } from "./XEncoderGPU.js";

export type { XEncoderOptions, XEncoderMetrics } from "./XEncoderGPU.js";

// PredictorGPU exports
export { PredictorGPU, createPredictorGPU } from "./PredictorGPU.js";

export type { PredictorOptions, PredictorMetrics } from "./PredictorGPU.js";

// ComputeShaders exports
export {
  EMBEDDING_DIM,
  HIDDEN_DIM,
  MAX_SEQ_LEN,
  NUM_HEADS,
  HEAD_DIM,
  getMatMulShader,
  getBatchMatMulShader,
  getLayerNormShader,
  getAttentionShader,
  getPatchEmbedShader,
  getPositionEmbedShader,
  getGELUShader,
  getReLUInt as getReLUShader,
  getSwishShader,
  getConcatShader,
  getMLPShader,
  getAddShader,
  getMulShader,
  getScaleShader,
  getCopyShader,
  DEFAULT_MATMUL_SHADER,
  DEFAULT_LAYER_NORM_SHADER,
  DEFAULT_PATCH_EMBED_SHADER,
  DEFAULT_GELU_SHADER,
  DEFAULT_CONCAT_SHADER,
  DEFAULT_MLP_SHADER,
} from "./ComputeShaders.js";

/**
 * @lsi/webgpu-compute - WebGPU Compute Shaders for Aequor Platform
 *
 * GPU-accelerated compute operations using WebGPU.
 * Provides high-performance shaders and kernels for ML operations.
 *
 * @version 1.0.0
 */

// ============================================================================
// TYPES
// ============================================================================

export * from "./types.js";

// ============================================================================
// CORE MANAGERS
// ============================================================================

export {
  BufferManager,
  TensorBuffer,
  createBufferManager,
} from "./BufferManager.js";

export {
  ComputeShaderManager,
  ComputeOperation,
  createComputeShaderManager,
  validateWGSL,
  compute,
} from "./ComputeShaderManager.js";

// ============================================================================
// SHADERS
// ============================================================================

export {
  // Matrix shaders
  getMatMulShader,
  getBatchMatMulShader,
  getMatVecMulShader,
  getOuterProductShader,
  getTransposeShader,
  getMatAddShader,
  getMatScalarMulShader,
  getMatHadamardShader,
  DEFAULT_MATMUL_SHADERS,
  getMatMulShaderForShapes,
} from "./shaders/MatMulShader.js";

export {
  // Vector shaders
  getVectorAddShader,
  getVectorSubShader,
  getVectorMulShader,
  getVectorDivShader,
  getVectorDotShader,
  getVectorCrossShader,
  getVectorNormalizeShader,
  getVectorMagnitudeShader,
  getVectorL1DistanceShader,
  getVectorL2DistanceShader,
  getCosineSimilarityShader,
  getVectorScaleShader,
  getVectorClampShader,
  getVectorOpShader,
  DEFAULT_VECTOR_SHADERS,
} from "./shaders/VectorShader.js";

export {
  // Reduction shaders
  getSumReductionShader,
  getMinReductionShader,
  getMaxReductionShader,
  getArgminReductionShader,
  getArgmaxReductionShader,
  getMeanReductionShader,
  getProductReductionShader,
  getAllReduceShader,
  getAxisReductionShader,
  getReductionShader,
  DEFAULT_REDUCTION_SHADERS,
} from "./shaders/ReductionShader.js";

export {
  // Embedding shaders
  getCosineSimilaritySearchShader,
  getEuclideanDistanceSearchShader,
  getManhattanDistanceSearchShader,
  getEmbeddingNormalizeShader,
  getEmbeddingConcatShader,
  getEmbeddingAverageShader,
  getKMeansAssignmentShader,
  getSimilarityMatrixShader,
  getEmbeddingProjectionShader,
  getSimilarityShader,
  DEFAULT_EMBEDDING_SHADERS,
} from "./shaders/EmbeddingShader.js";

export {
  // Neural network shaders
  getReLUShader,
  getGELUShader,
  getSwishShader,
  getSigmoidShader,
  getTanhShader,
  getLeakyReLUShader,
  getSoftmaxShader,
  getMaxPool2DShader,
  getAvgPool2DShader,
  getLayerNormShader,
  getDropoutShader,
  getActivationShader,
  DEFAULT_NEURAL_SHADERS,
} from "./shaders/NeuralShader.js";

export {
  // Shader index and utilities
  getShader,
  SHADER_CATEGORIES,
  MATRIX_OPERATIONS,
  VECTOR_OPERATIONS,
  REDUCTION_OPERATIONS,
  EMBEDDING_OPERATIONS,
  NEURAL_OPERATIONS,
} from "./shaders/index.js";

// ============================================================================
// KERNELS
// ============================================================================

export { MatMulKernel, createMatMulKernel } from "./kernels/MatMulKernel.js";

// ============================================================================
// SHADER BUILDER
// ============================================================================

export {
  ShaderBuilder,
  ShaderTemplate,
  createElementwiseShader,
  createMapShader,
  createReduceShader,
  createStencilShader,
  composeShaders,
  optimizeShader,
  validateShader,
  createDefaultTemplates,
} from "./ShaderBuilder.js";

// ============================================================================
// INTEGRATION
// ============================================================================

export {
  VLJEPAGPUAccelerator,
  EmbeddingCache,
  GPUPipelineBuilder,
  createVLJEPAGPUAccelerator,
  createEmbeddingCache,
  batchCosineSimilarity,
} from "./integration.js";

// ============================================================================
// WEBGPU CONTEXT
// ============================================================================

/**
 * WebGPU context implementation
 *
 * Provides WebGPU device and context management.
 */
export class WebGPUContextImpl {
  private device: GPUDevice | null = null;
  private adapter: GPUAdapter | null = null;
  private config: any;
  private isLostValue: boolean = false;

  constructor(config: any = {}) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (!navigator.gpu) {
      throw new Error("WebGPU not supported");
    }

    this.adapter = await navigator.gpu.requestAdapter({
      powerPreference: this.config.powerPreference || "high-performance",
    });

    if (!this.adapter) {
      throw new Error("Failed to get GPU adapter");
    }

    this.device = await this.adapter.requestDevice({
      requiredFeatures: this.config.requiredFeatures || [],
      requiredLimits: this.config.requiredLimits || {},
    });

    this.device.lost.then(info => {
      console.error("WebGPU device lost:", info);
      this.isLostValue = true;
    });
  }

  getDevice(): GPUDevice {
    if (!this.device) {
      throw new Error("WebGPU not initialized");
    }
    return this.device;
  }

  getAdapter(): GPUAdapter {
    if (!this.adapter) {
      throw new Error("WebGPU not initialized");
    }
    return this.adapter;
  }

  get queue(): GPUQueue {
    return this.getDevice().queue;
  }

  get isLost(): boolean {
    return this.isLostValue;
  }

  createCommandEncoder(label?: string): GPUCommandEncoder {
    return this.getDevice().createCommandEncoder({ label });
  }

  submit(commandBuffers: GPUCommandBuffer[]): void {
    this.queue.submit(commandBuffers);
  }

  async readBuffer(buffer: GPUBuffer, size: number): Promise<ArrayBuffer> {
    const device = this.getDevice();

    // Create staging buffer
    const stagingBuffer = device.createBuffer({
      size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    // Copy buffer to staging
    const encoder = this.createCommandEncoder("read-buffer");
    encoder.copyBufferToBuffer(buffer, 0, stagingBuffer, 0, size);
    this.submit([encoder.finish()]);

    // Map staging buffer and read
    await stagingBuffer.mapAsync(GPUMapMode.READ);
    const data = stagingBuffer.getMappedRange();

    // Copy to new ArrayBuffer
    const result = data.slice(0);

    stagingBuffer.unmap();
    stagingBuffer.destroy();

    return result;
  }

  destroyBuffer(buffer: GPUBuffer): void {
    buffer.destroy();
  }

  async getAdapterInfo(): Promise<GPUAdapterInfo> {
    const adapter = this.getAdapter();
    return adapter.requestAdapterInfo();
  }

  async getMemoryInfo(): Promise<any> {
    // WebGPU doesn't provide direct memory info yet
    // Return estimated info
    return {
      totalMemory: 4 * 1024 * 1024 * 1024, // 4GB estimate
      usedMemory: 0,
      freeMemory: 4 * 1024 * 1024 * 1024,
      usagePercentage: 0,
    };
  }

  dispose(): void {
    if (this.device) {
      this.device.destroy();
      this.device = null;
    }
    this.isLostValue = true;
  }
}

/**
 * Create WebGPU context
 *
 * @param config - Context configuration
 * @returns WebGPU context instance
 */
export async function createWebGPUContext(
  config?: any
): Promise<WebGPUContextImpl> {
  const context = new WebGPUContextImpl(config);
  await context.initialize();
  return context;
}

// ============================================================================
// VERSION
// ============================================================================

export const VERSION = "1.0.0";

/**
 * Package metadata
 */
export const PACKAGE_INFO = {
  name: "@lsi/webgpu-compute",
  version: VERSION,
  description: "GPU-accelerated compute shaders for VL-JEPA and ML operations",
  author: "Aequor Platform Team",
  license: "MIT",
} as const;

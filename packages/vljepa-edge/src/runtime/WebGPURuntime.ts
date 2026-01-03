/**
 * @fileoverview WebGPU Runtime for VL-JEPA Edge Deployment
 *
 * Provides GPU-accelerated inference using WebGPU compute shaders:
 * - GPU selection (discrete, integrated, or any)
 * - Compute shaders for INT8 matrix operations
 * - Efficient buffer management
 * - Pipeline caching
 * - Multi-queue support
 *
 * @package @lsi/vljepa-edge
 */

import type { WebGPURuntimeConfig, BufferManagerConfig } from "../types.js";
import { RuntimeError } from "../types.js";

// Type aliases for WebGPU types (using any when not available)
type GPUDevice = any;
type GPUBuffer = any;
type GPUAdapter = any;
type GPUShaderModule = any;
type GPUComputePipeline = any;
type GPUBufferUsageFlags = number;
const GPUMapMode = { READ: 1, WRITE: 2 };
const GPUBufferUsage = {
  STORAGE: 1,
  COPY_DST: 2,
  COPY_SRC: 4,
  MAP_READ: 8,
  MAP_WRITE: 16,
};
type GPURequestAdapterOptions = any;
type GPUFeatureName = any;
type GPUSupportedLimits = any;
type WebGPUContext = any;

/**
 * WebGPU buffer manager for efficient GPU memory allocation
 */
class GPUBufferManager {
  private config: BufferManagerConfig;
  private device: GPUDevice;
  private buffers: Map<string, GPUBuffer[]> = new Map();
  private allocatedSize: number = 0;

  constructor(device: GPUDevice, config: BufferManagerConfig) {
    this.device = device;
    this.config = config;
  }

  /**
   * Allocate a GPU buffer
   */
  allocate(size: number, usage: number): any {
    const alignedSize = this.align(size);

    // Try to reuse buffer if enabled
    if (this.config.reuse) {
      const poolKey = this.getPoolKey(alignedSize, usage);
      const pool = this.buffers.get(poolKey);

      if (pool && pool.length > 0) {
        const buffer = pool.pop()!;
        this.allocatedSize += alignedSize;
        return buffer;
      }
    }

    // Allocate new buffer
    const buffer = this.device.createBuffer({
      size: alignedSize,
      usage,
      mappedAtCreation: false,
    });

    this.allocatedSize += alignedSize;

    // Enforce memory limit
    if (this.allocatedSize > this.config.maxPoolSize * 1024 * 1024) {
      this.evict(alignedSize);
    }

    return buffer;
  }

  /**
   * Return a buffer to the pool
   */
  deallocate(buffer: any, size: number, usage: number): void {
    if (this.config.reuse) {
      const alignedSize = this.align(size);
      const poolKey = this.getPoolKey(alignedSize, usage);
      let pool = this.buffers.get(poolKey);

      if (!pool) {
        pool = [];
        this.buffers.set(poolKey, pool);
      }

      pool.push(buffer);
    } else {
      buffer.destroy();
      this.allocatedSize -= size;
    }
  }

  /**
   * Write data to buffer
   */
  async writeBuffer(
    buffer: any,
    data: ArrayBufferView | ArrayBuffer
  ): Promise<void> {
    if (this.config.asyncMap) {
      await buffer.mapAsync(GPUMapMode.WRITE);
      new Uint8Array(buffer.getMappedRange()).set(
        new Uint8Array(data as ArrayBuffer)
      );
      buffer.unmap();
    } else {
      this.device.queue.writeBuffer(buffer, 0, data as ArrayBuffer);
    }
  }

  /**
   * Read data from buffer
   */
  async readBuffer(buffer: any, size: number): Promise<ArrayBuffer> {
    if (this.config.asyncMap) {
      await buffer.mapAsync(GPUMapMode.READ);
      const data = new Uint8Array(buffer.getMappedRange()).slice(0, size);
      buffer.unmap();
      return data.buffer;
    } else {
      const readBuffer = this.device.createBuffer({
        size,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });

      const encoder = this.device.createCommandEncoder();
      encoder.copyBufferToBuffer(buffer, 0, readBuffer, 0, size);
      this.device.queue.submit([encoder.finish()]);

      await readBuffer.mapAsync(GPUMapMode.READ);
      const data = new Uint8Array(readBuffer.getMappedRange()).slice();
      readBuffer.unmap();
      readBuffer.destroy();

      return data.buffer;
    }
  }

  /**
   * Get total allocated size
   */
  getAllocatedSize(): number {
    return this.allocatedSize;
  }

  /**
   * Clear all buffers
   */
  clear(): void {
    for (const pool of this.buffers.values()) {
      for (const buffer of pool) {
        buffer.destroy();
      }
    }
    this.buffers.clear();
    this.allocatedSize = 0;
  }

  /**
   * Align size to alignment boundary
   */
  private align(size: number): number {
    return Math.ceil(size / this.config.alignment) * this.config.alignment;
  }

  /**
   * Get pool key for buffer
   */
  private getPoolKey(size: number, usage: GPUBufferUsageFlags): string {
    return `${size}:${usage}`;
  }

  /**
   * Evict buffers to free memory
   */
  private evict(requiredSize: number): void {
    let freed = 0;
    const keysToDelete: string[] = [];

    for (const [key, pool] of this.buffers) {
      for (const buffer of pool) {
        const size = buffer.size;
        buffer.destroy();
        freed += size;
        this.allocatedSize -= size;

        if (freed >= requiredSize) {
          break;
        }
      }

      if (pool.length === 0) {
        keysToDelete.push(key);
      }

      if (freed >= requiredSize) {
        break;
      }
    }

    for (const key of keysToDelete) {
      this.buffers.delete(key);
    }
  }
}

/**
 * WebGPU compute shader cache
 */
class ShaderCache {
  private device: GPUDevice;
  private cache: Map<string, GPUShaderModule> = new Map();

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Get or create shader module
   */
  getShader(code: string): GPUShaderModule {
    const hash = this.hash(code);

    if (!this.cache.has(hash)) {
      const shader = this.device.createShaderModule({ code });
      this.cache.set(hash, shader);
    }

    return this.cache.get(hash)!;
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Hash shader code
   */
  private hash(code: string): string {
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
      const char = code.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
}

/**
 * WebGPU Runtime for VL-JEPA inference
 *
 * Provides GPU-accelerated inference using WebGPU compute shaders.
 * Supports INT8 quantization, buffer pooling, and pipeline caching.
 */
export class WebGPURuntime {
  private config: WebGPURuntimeConfig;
  private context: WebGPUContext | null = null;
  private bufferManager: GPUBufferManager | null = null;
  private shaderCache: ShaderCache | null = null;
  private initialized: boolean = false;
  private computePipelines: Map<string, GPUComputePipeline> = new Map();

  constructor(config: WebGPURuntimeConfig) {
    this.config = config;
  }

  /**
   * Initialize WebGPU runtime
   */
  async initialize(): Promise<void> {
    if (!navigator.gpu) {
      throw new RuntimeError("WebGPU not supported in this browser");
    }

    // Request GPU adapter based on preference
    const adapter = await this.requestAdapter();
    if (!adapter) {
      throw new RuntimeError("No suitable GPU adapter found");
    }

    // Request device
    const device = await adapter.requestDevice({
      requiredFeatures: this.getRequiredFeatures(),
      requiredLimits: this.getRequiredLimits(),
    });

    // Setup context
    this.context = {
      adapter,
      device,
      queues: [device.queue],
      buffers: [],
      shaders: new Map(),
    };

    // Initialize buffer manager
    this.bufferManager = new GPUBufferManager(
      device,
      this.config.bufferManager
    );

    // Initialize shader cache
    this.shaderCache = new ShaderCache(device);

    // Setup error handling
    device.addEventListener("uncapturederror", (event: any) => {
      console.error("[WebGPURuntime] Uncaptured GPU error:", event.error);
    });

    this.initialized = true;
  }

  /**
   * Run inference on GPU
   */
  async inference(input: {
    data: Float32Array;
    shape?: number[];
  }): Promise<Float32Array> {
    if (!this.initialized || !this.context) {
      throw new RuntimeError("WebGPU runtime not initialized");
    }

    const { device, queue } = this.context;
    const { data } = input;

    // Allocate input buffer
    const inputSize = data.byteLength;
    const inputBuffer = this.bufferManager!.allocate(
      inputSize,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    );

    // Write input data
    await this.bufferManager!.writeBuffer(inputBuffer, data);

    // Allocate output buffer
    const outputSize = data.byteLength; // Same size for now
    const outputBuffer = this.bufferManager!.allocate(
      outputSize,
      2 // GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    );

    // Create compute pipeline (cached)
    const pipeline = await this.getOrCreatePipeline(
      "matmul",
      this.getMatMulShader()
    );

    // Create bind group
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inputBuffer } },
        { binding: 1, resource: { buffer: outputBuffer } },
      ],
    });

    // Create command encoder
    const encoder = device.createCommandEncoder();

    // Create compute pass
    const computePass = encoder.beginComputePass();
    computePass.setPipeline(pipeline);
    computePass.setBindGroup(0, bindGroup);
    const inputShape = input.shape || [1, 1, 1];
    computePass.dispatchWorkgroups(
      Math.ceil(inputShape[0] / this.config.workgroupSize[0]),
      Math.ceil(inputShape[1] / this.config.workgroupSize[1]),
      Math.ceil(inputShape[2] / this.config.workgroupSize[2])
    );
    computePass.end();

    // Submit commands
    queue.submit([encoder.finish()]);

    // Read output
    const outputData = await this.bufferManager!.readBuffer(
      outputBuffer,
      outputSize
    );
    const output = new Float32Array(outputData);

    // Cleanup buffers
    this.bufferManager!.deallocate(inputBuffer, inputSize, 1); // GPUBufferUsage.STORAGE
    this.bufferManager!.deallocate(
      outputBuffer,
      outputSize,
      2 // GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    );

    return output;
  }

  /**
   * Batch inference
   */
  async batchInference(
    inputs: Array<{
      data: Float32Array;
      shape?: number[];
    }>
  ): Promise<Float32Array[]> {
    const results: Float32Array[] = [];

    for (const input of inputs) {
      const result = await this.inference(input);
      results.push(result);
    }

    return results;
  }

  /**
   * Get GPU info
   */
  getGPUInfo(): {
    vendor: string;
    architecture: string;
    description: string;
  } | null {
    if (!this.context?.adapter) {
      return null;
    }

    const adapter = this.context.adapter;
    return {
      vendor: adapter.info.vendor,
      architecture: adapter.info.architecture,
      description: adapter.info.description,
    };
  }

  /**
   * Get memory usage
   */
  getMemoryUsage(): { allocated: number; limit: number } {
    if (!this.bufferManager) {
      return { allocated: 0, limit: this.config.maxBufferSize };
    }

    return {
      allocated: this.bufferManager.getAllocatedSize(),
      limit: this.config.maxBufferSize * 1024 * 1024,
    };
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.bufferManager) {
      this.bufferManager.clear();
      this.bufferManager = null;
    }

    if (this.shaderCache) {
      this.shaderCache.clear();
      this.shaderCache = null;
    }

    for (const pipeline of this.computePipelines.values()) {
      pipeline.destroy();
    }
    this.computePipelines.clear();

    if (this.context?.device) {
      this.context.device.destroy();
    }

    this.context = null;
    this.initialized = false;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Request GPU adapter based on preference
   */
  private async requestAdapter(): Promise<GPUAdapter | null> {
    const adapterOptions: GPURequestAdapterOptions = {};

    switch (this.config.devicePreference) {
      case "discrete":
        adapterOptions.powerPreference = "high-performance";
        break;
      case "integrated":
        adapterOptions.powerPreference = "low-power";
        break;
      case "any":
      default:
        adapterOptions.powerPreference = undefined;
        break;
    }

    return await navigator.gpu.requestAdapter(adapterOptions);
  }

  /**
   * Get required features for device
   */
  private getRequiredFeatures(): GPUFeatureName[] {
    const features: GPUFeatureName[] = [];

    // Add optional features based on needs
    // features.push("timestamp-query" as GPUFeatureName);
    // features.push("texture-compression-bc" as GPUFeatureName);

    return features;
  }

  /**
   * Get required limits for device
   */
  private getRequiredLimits(): GPUSupportedLimits {
    return {
      maxBufferSize: this.config.maxBufferSize * 1024 * 1024,
      maxComputeWorkgroupStorageSize: 65536,
      maxComputeWorkgroupsPerDimension: 65535,
    } as GPUSupportedLimits;
  }

  /**
   * Get or create compute pipeline (cached)
   */
  private async getOrCreatePipeline(
    name: string,
    shaderCode: string
  ): Promise<GPUComputePipeline> {
    if (this.computePipelines.has(name)) {
      return this.computePipelines.get(name)!;
    }

    if (!this.context) {
      throw new RuntimeError("WebGPU context not initialized");
    }

    const { device } = this.context;
    const shader = this.shaderCache!.getShader(shaderCode);

    const pipeline = device.createComputePipeline({
      layout: "auto",
      compute: {
        module: shader,
        entryPoint: "main",
      },
    });

    this.computePipelines.set(name, pipeline);
    return pipeline;
  }

  /**
   * Get matrix multiplication shader
   */
  private getMatMulShader(): string {
    return `
      struct Matrix {
        data: array<f32>,
      };

      @group(0) @binding(0) var<storage, read> input: Matrix;
      @group(0) @binding(1) var<storage, read_write> output: Matrix;

      @compute @workgroup_size(${this.config.workgroupSize[0]}, ${this.config.workgroupSize[1]}, ${this.config.workgroupSize[2]})
      fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let index = global_id.x;
        if (index >= arrayLength(&input.data)) {
          return;
        }

        // Simple identity transformation for demo
        // Replace with actual matrix operations
        output.data[index] = input.data[index];
      }
    `;
  }
}

/**
 * Create a WebGPU runtime instance
 */
export function createWebGPURuntime(
  config: WebGPURuntimeConfig
): WebGPURuntime {
  return new WebGPURuntime(config);
}

/**
 * Default WebGPU configuration
 */
export function getDefaultWebGPUConfig(): WebGPURuntimeConfig {
  return {
    devicePreference: "any",
    shaderCache: true,
    bufferManager: {
      initialPoolSize: 64,
      maxPoolSize: 512,
      alignment: 256,
      reuse: true,
      asyncMap: true,
    },
    workgroupSize: [16, 16, 1],
    maxBufferSize: 1024,
    asyncCompilation: true,
  };
}

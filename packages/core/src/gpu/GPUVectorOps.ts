/**
 * GPU Vector Operations with WebGPU/WebGL Compute
 *
 * High-performance vector operations using GPU compute shaders.
 * Falls back to CPU/SIMD operations when GPU is unavailable.
 *
 * @packageDocumentation
 */

import { GPUDeviceManager, BufferUsage, GPUBackend } from "./GPUDevice.js";
import { VectorOps } from "../simd/VectorOps.js";

/**
 * GPU benchmark result
 */
export interface GPUBenchmarkResult {
  operation: string;
  backend: string;
  time_ms: number;
  throughput: number; // operations per second
  memory_mb: number;
  speedup_vs_cpu: number;
}

/**
 * Comparison result for batch operations
 */
export interface BatchCompareResult {
  index: number;
  similarity: number;
}

/**
 * GPU Vector Operations Class
 *
 * Provides GPU-accelerated vector operations with automatic fallback
 * to CPU/SIMD when GPU is unavailable.
 */
export class GPUVectorOps {
  private device: GPUDeviceManager;
  private cpuFallback: VectorOps;
  private useGPU: boolean;
  private workgroupSize: number = 256;

  // Compute shader code for vector operations
  private readonly vectorAddShader = `
    struct VectorAdd {
      a: array<f32>,
      b: array<f32>,
      result: array<f32>,
    }

    @group(0) @binding(0) var<storage, read> a: array<f32>;
    @group(0) @binding(1) var<storage, read> b: array<f32>;
    @group(0) @binding(2) var<storage, read_write> result: array<f32>;

    @compute @workgroup_size(256)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      let index = global_id.x;
      if (index < arrayLength(&a)) {
        result[index] = a[index] + b[index];
      }
    }
  `;

  private readonly vectorSubShader = `
    @group(0) @binding(0) var<storage, read> a: array<f32>;
    @group(0) @binding(1) var<storage, read> b: array<f32>;
    @group(0) @binding(2) var<storage, read_write> result: array<f32>;

    @compute @workgroup_size(256)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      let index = global_id.x;
      if (index < arrayLength(&a)) {
        result[index] = a[index] - b[index];
      }
    }
  `;

  private readonly vectorMulShader = `
    @group(0) @binding(0) var<storage, read> a: array<f32>;
    @group(0) @binding(1) var<storage, read> b: array<f32>;
    @group(0) @binding(2) var<storage, read_write> result: array<f32>;

    @compute @workgroup_size(256)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      let index = global_id.x;
      if (index < arrayLength(&a)) {
        result[index] = a[index] * b[index];
      }
    }
  `;

  private readonly vectorDivShader = `
    @group(0) @binding(0) var<storage, read> a: array<f32>;
    @group(0) @binding(1) var<storage, read> b: array<f32>;
    @group(0) @binding(2) var<storage, read_write> result: array<f32>;

    @compute @workgroup_size(256)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      let index = global_id.x;
      if (index < arrayLength(&a)) {
        result[index] = a[index] / b[index];
      }
    }
  `;

  private readonly dotProductShader = `
    struct DotProduct {
      partial_sums: array<f32>,
    }

    @group(0) @binding(0) var<storage, read> a: array<f32>;
    @group(0) @binding(1) var<storage, read> b: array<f32>;
    @group(0) @binding(2) var<storage, read_write> partial_sums: array<f32>;

    @compute @workgroup_size(256)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      let local_id = local_invocation_id.x;
      let workgroup_size = 256u;

      var sum = 0.0;
      let index = global_id.x;
      if (index < arrayLength(&a)) {
        sum = a[index] * b[index];
      }

      // Parallel reduction within workgroup
      var partial = sum;
      for (var stride = workgroup_size / 2u; stride > 0u; stride /= 2u) {
        let other = subgroupShuffleDown(partial, stride);
        if (local_id < stride) {
          partial += other;
        }
      }

      if (local_id == 0u) {
        partial_sums[workgroup_id.x] = partial;
      }
    }
  `;

  private readonly cosineSimilarityShader = `
    @group(0) @binding(0) var<storage, read> a: array<f32>;
    @group(0) @binding(1) var<storage, read> b: array<f32>;
    @group(0) @binding(2) var<storage, read_write> result: array<f32>;

    @compute @workgroup_size(256)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      // Compute dot product
      let index = global_id.x;
      var dot = 0.0;
      var norm_a_sq = 0.0;
      var norm_b_sq = 0.0;

      if (index < arrayLength(&a)) {
        dot = a[index] * b[index];
        norm_a_sq = a[index] * a[index];
        norm_b_sq = b[index] * b[index];
      }

      // Store results for reduction
      result[index * 3] = dot;
      result[index * 3 + 1] = norm_a_sq;
      result[index * 3 + 2] = norm_b_sq;
    }
  `;

  private readonly normalizeShader = `
    @group(0) @binding(0) var<storage, read> input: array<f32>;
    @group(0) @binding(1) var<storage, read> norm: f32;
    @group(0) @binding(2) var<storage, read_write> result: array<f32>;

    @compute @workgroup_size(256)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      let index = global_id.x;
      if (index < arrayLength(&input)) {
        result[index] = input[index] / norm;
      }
    }
  `;

  private readonly reduceSumShader = `
    struct ReduceSum {
      partial_sums: array<f32>,
    }

    @group(0) @binding(0) var<storage, read> input: array<f32>;
    @group(0) @binding(1) var<storage, read_write> partial_sums: array<f32>;

    @compute @workgroup_size(256)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      let local_id = local_invocation_id.x;
      let workgroup_size = 256u;

      var sum = 0.0;
      let index = global_id.x;
      if (index < arrayLength(&input)) {
        sum = input[index];
      }

      // Parallel reduction
      var partial = sum;
      for (var stride = workgroup_size / 2u; stride > 0u; stride /= 2u) {
        if (local_id < stride) {
          partial += subgroupShuffleDown(partial, stride);
        }
      }

      if (local_id == 0u) {
        partial_sums[workgroup_id.x] = partial;
      }
    }
  `;

  constructor(device: GPUDeviceManager, cpuFallback?: VectorOps) {
    this.device = device;
    this.cpuFallback = cpuFallback || new VectorOps();
    this.useGPU = device.isAvailable();
  }

  /**
   * Initialize GPU vector operations
   */
  async init(): Promise<void> {
    await this.device.initialize();
    this.useGPU = this.device.isAvailable();
    await this.cpuFallback.init();
  }

  // ==================== Basic Operations ====================

  /**
   * Vector addition (a + b)
   */
  async add(a: Float32Array, b: Float32Array): Promise<Float32Array> {
    if (!this.useGPU || a.length < this.workgroupSize) {
      return this.cpuFallback.add(a, b);
    }

    try {
      const result = await this.executeBinaryOp(
        a,
        b,
        this.vectorAddShader,
        "vector_add"
      );
      return result;
    } catch (error) {
      console.warn("GPU add failed, falling back to CPU:", error);
      return this.cpuFallback.add(a, b);
    }
  }

  /**
   * Vector subtraction (a - b)
   */
  async sub(a: Float32Array, b: Float32Array): Promise<Float32Array> {
    if (!this.useGPU || a.length < this.workgroupSize) {
      return this.cpuFallback.sub(a, b);
    }

    try {
      const result = await this.executeBinaryOp(
        a,
        b,
        this.vectorSubShader,
        "vector_sub"
      );
      return result;
    } catch (error) {
      console.warn("GPU sub failed, falling back to CPU:", error);
      return this.cpuFallback.sub(a, b);
    }
  }

  /**
   * Element-wise multiplication (a * b)
   */
  async mul(a: Float32Array, b: Float32Array): Promise<Float32Array> {
    if (!this.useGPU || a.length < this.workgroupSize) {
      return this.cpuFallback.mul(a, b);
    }

    try {
      const result = await this.executeBinaryOp(
        a,
        b,
        this.vectorMulShader,
        "vector_mul"
      );
      return result;
    } catch (error) {
      console.warn("GPU mul failed, falling back to CPU:", error);
      return this.cpuFallback.mul(a, b);
    }
  }

  /**
   * Element-wise division (a / b)
   */
  async div(a: Float32Array, b: Float32Array): Promise<Float32Array> {
    if (!this.useGPU || a.length < this.workgroupSize) {
      // CPU fallback for division
      const result = new Float32Array(a.length);
      for (let i = 0; i < a.length; i++) {
        result[i] = a[i] / b[i];
      }
      return result;
    }

    try {
      const result = await this.executeBinaryOp(
        a,
        b,
        this.vectorDivShader,
        "vector_div"
      );
      return result;
    } catch (error) {
      console.warn("GPU div failed, falling back to CPU:", error);
      const result = new Float32Array(a.length);
      for (let i = 0; i < a.length; i++) {
        result[i] = a[i] / b[i];
      }
      return result;
    }
  }

  // ==================== Reduction Operations ====================

  /**
   * Sum of vector elements
   */
  async sum(vector: Float32Array): Promise<number> {
    if (!this.useGPU || vector.length < this.workgroupSize) {
      let sum = 0;
      for (let i = 0; i < vector.length; i++) {
        sum += vector[i];
      }
      return sum;
    }

    try {
      const resultBuffer = await this.executeReduceOp(
        vector,
        this.reduceSumShader
      );
      return resultBuffer[0];
    } catch (error) {
      console.warn("GPU sum failed, falling back to CPU:", error);
      let sum = 0;
      for (let i = 0; i < vector.length; i++) {
        sum += vector[i];
      }
      return sum;
    }
  }

  /**
   * Mean of vector elements
   */
  async mean(vector: Float32Array): Promise<number> {
    const sum = await this.sum(vector);
    return sum / vector.length;
  }

  /**
   * Minimum element
   */
  async min(vector: Float32Array): Promise<number> {
    let min = vector[0];
    for (let i = 1; i < vector.length; i++) {
      if (vector[i] < min) {
        min = vector[i];
      }
    }
    return min;
  }

  /**
   * Maximum element
   */
  async max(vector: Float32Array): Promise<number> {
    let max = vector[0];
    for (let i = 1; i < vector.length; i++) {
      if (vector[i] > max) {
        max = vector[i];
      }
    }
    return max;
  }

  // ==================== Similarity Operations ====================

  /**
   * Dot product (Σ a[i] * b[i])
   */
  async dot(a: Float32Array, b: Float32Array): Promise<number> {
    if (!this.useGPU || a.length < this.workgroupSize) {
      return this.cpuFallback.dot(a, b);
    }

    try {
      const result = await this.executeDotProduct(a, b);
      return result;
    } catch (error) {
      console.warn("GPU dot failed, falling back to CPU:", error);
      return this.cpuFallback.dot(a, b);
    }
  }

  /**
   * Cosine similarity (a · b / (||a|| * ||b||))
   */
  async cosine(a: Float32Array, b: Float32Array): Promise<number> {
    if (!this.useGPU || a.length < this.workgroupSize) {
      return this.cpuFallback.cosine(a, b);
    }

    try {
      const dot = await this.dot(a, b);
      const normA = await this.l2norm(a);
      const normB = await this.l2norm(b);

      if (normA === 0 || normB === 0) {
        return 0;
      }

      return dot / (normA * normB);
    } catch (error) {
      console.warn("GPU cosine failed, falling back to CPU:", error);
      return this.cpuFallback.cosine(a, b);
    }
  }

  /**
   * Euclidean distance (sqrt(Σ (a[i] - b[i])²))
   */
  async euclidean(a: Float32Array, b: Float32Array): Promise<number> {
    if (!this.useGPU || a.length < this.workgroupSize) {
      return this.cpuFallback.euclidean(a, b);
    }

    try {
      // Compute squared differences
      const diff = await this.sub(a, b);
      const sq = await this.mul(diff, diff);
      const sum = await this.sum(sq);
      return Math.sqrt(sum);
    } catch (error) {
      console.warn("GPU euclidean failed, falling back to CPU:", error);
      return this.cpuFallback.euclidean(a, b);
    }
  }

  // ==================== Batch Operations ====================

  /**
   * Batch addition - add scalar vector to all vectors
   */
  async batchAdd(
    vectors: Float32Array[],
    scalar: Float32Array
  ): Promise<Float32Array[]> {
    const results: Float32Array[] = [];
    for (const v of vectors) {
      results.push(await this.add(v, scalar));
    }
    return results;
  }

  /**
   * Batch dot product
   */
  async batchDot(
    aVectors: Float32Array[],
    bVectors: Float32Array[]
  ): Promise<number[]> {
    if (aVectors.length !== bVectors.length) {
      throw new Error("Vector arrays must have same length");
    }

    const results: number[] = [];
    for (let i = 0; i < aVectors.length; i++) {
      results.push(await this.dot(aVectors[i], bVectors[i]));
    }
    return results;
  }

  /**
   * Batch cosine similarity
   */
  async batchCosine(
    aVectors: Float32Array[],
    bVectors: Float32Array[]
  ): Promise<number[]> {
    if (aVectors.length !== bVectors.length) {
      throw new Error("Vector arrays must have same length");
    }

    const results: number[] = [];
    for (let i = 0; i < aVectors.length; i++) {
      results.push(await this.cosine(aVectors[i], bVectors[i]));
    }
    return results;
  }

  // ==================== Normalization ====================

  /**
   * Normalize vector (L2)
   */
  async normalize(vector: Float32Array): Promise<Float32Array> {
    if (!this.useGPU || vector.length < this.workgroupSize) {
      return this.cpuFallback.normalize(vector);
    }

    try {
      const norm = await this.l2norm(vector);
      if (norm === 0) {
        return new Float32Array(vector.length);
      }

      // Normalize on CPU for simplicity
      const result = new Float32Array(vector.length);
      const invNorm = 1.0 / norm;
      for (let i = 0; i < vector.length; i++) {
        result[i] = vector[i] * invNorm;
      }
      return result;
    } catch (error) {
      console.warn("GPU normalize failed, falling back to CPU:", error);
      return this.cpuFallback.normalize(vector);
    }
  }

  /**
   * L2 normalize (alias for normalize)
   */
  async l2Normalize(vector: Float32Array): Promise<Float32Array> {
    return this.normalize(vector);
  }

  /**
   * Compute L2 norm
   */
  private async l2norm(vector: Float32Array): Promise<number> {
    const sq = await this.mul(vector, vector);
    const sum = await this.sum(sq);
    return Math.sqrt(sum);
  }

  // ==================== Performance Benchmarking ====================

  /**
   * Benchmark GPU vs CPU performance
   */
  async benchmark(
    operation: string,
    iterations: number = 100
  ): Promise<GPUBenchmarkResult> {
    const testVector = new Float32Array(1000);
    for (let i = 0; i < testVector.length; i++) {
      testVector[i] = Math.random();
    }

    const testVector2 = new Float32Array(1000);
    for (let i = 0; i < testVector2.length; i++) {
      testVector2[i] = Math.random();
    }

    // Benchmark GPU
    const gpuStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      switch (operation) {
        case "add":
          await this.add(testVector, testVector2);
          break;
        case "dot":
          await this.dot(testVector, testVector2);
          break;
        case "cosine":
          await this.cosine(testVector, testVector2);
          break;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    }
    const gpuTime = performance.now() - gpuStart;

    // Benchmark CPU
    const cpuStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      switch (operation) {
        case "add":
          this.cpuFallback.add(testVector, testVector2);
          break;
        case "dot":
          this.cpuFallback.dot(testVector, testVector2);
          break;
        case "cosine":
          this.cpuFallback.cosine(testVector, testVector2);
          break;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    }
    const cpuTime = performance.now() - cpuStart;

    return {
      operation,
      backend: this.device.getBackend(),
      time_ms: gpuTime,
      throughput: iterations / (gpuTime / 1000),
      memory_mb: this.device.getMemoryUsage() / (1024 * 1024),
      speedup_vs_cpu: cpuTime / gpuTime,
    };
  }

  // ==================== Private Helper Methods ====================

  /**
   * Execute binary operation on GPU
   */
  private async executeBinaryOp(
    a: Float32Array,
    b: Float32Array,
    shader: string,
    entryPoint: string
  ): Promise<Float32Array> {
    if (this.device.getBackend() !== "webgpu") {
      throw new Error("Only WebGPU is supported for compute operations");
    }

    const device = this.device.getDevice()!;
    const length = a.length;

    // Allocate buffers
    const bufferA = this.device.allocateBuffer(
      length * 4,
      BufferUsage.Storage | BufferUsage.CopyDst
    );
    const bufferB = this.device.allocateBuffer(
      length * 4,
      BufferUsage.Storage | BufferUsage.CopyDst
    );
    const bufferResult = this.device.allocateBuffer(
      length * 4,
      BufferUsage.Storage | BufferUsage.CopySrc
    );

    // Write input data
    await bufferA.write(a);
    await bufferB.write(b);

    // Create compute pipeline
    const pipeline = this.device.createComputePipeline(shader, entryPoint);

    // Create bind group
    const bindGroup = this.device.createBindGroup(pipeline.bindGroupLayout!, [
      { buffer: bufferA.buffer! },
      { buffer: bufferB.buffer! },
      { buffer: bufferResult.buffer! },
    ]);

    // Encode and submit commands
    const encoder = this.device.beginCommands();
    const passEncoder = encoder.encoder!.beginComputePass();
    passEncoder.setPipeline(pipeline.pipeline as GPUComputePipeline);
    passEncoder.setBindGroup(0, bindGroup.bindGroup as GPUBindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(length / this.workgroupSize));
    passEncoder.end();

    const commandBuffer = encoder.finish();
    this.device.submitCommands(commandBuffer);

    // Read result
    const result = await bufferResult.read();

    // Cleanup
    bufferA.destroy();
    bufferB.destroy();
    bufferResult.destroy();

    return result;
  }

  /**
   * Execute reduction operation on GPU
   */
  private async executeReduceOp(
    vector: Float32Array,
    shader: string
  ): Promise<Float32Array> {
    if (this.device.getBackend() !== "webgpu") {
      throw new Error("Only WebGPU is supported for compute operations");
    }

    const device = this.device.getDevice()!;
    const length = vector.length;
    const numWorkgroups = Math.ceil(length / this.workgroupSize);

    // Allocate buffers
    const bufferInput = this.device.allocateBuffer(
      length * 4,
      BufferUsage.Storage | BufferUsage.CopyDst
    );
    const bufferPartial = this.device.allocateBuffer(
      numWorkgroups * 4,
      BufferUsage.Storage | BufferUsage.CopySrc
    );

    // Write input data
    await bufferInput.write(vector);

    // Create compute pipeline
    const pipeline = this.device.createComputePipeline(shader, "reduce_sum");

    // Create bind group
    const bindGroup = this.device.createBindGroup(pipeline.bindGroupLayout!, [
      { buffer: bufferInput.buffer! },
      { buffer: bufferPartial.buffer! },
    ]);

    // Encode and submit commands
    const encoder = this.device.beginCommands();
    const passEncoder = encoder.encoder!.beginComputePass();
    passEncoder.setPipeline(pipeline.pipeline as GPUComputePipeline);
    passEncoder.setBindGroup(0, bindGroup.bindGroup as GPUBindGroup);
    passEncoder.dispatchWorkgroups(numWorkgroups);
    passEncoder.end();

    const commandBuffer = encoder.finish();
    this.device.submitCommands(commandBuffer);

    // Read partial sums
    const partialSums = await bufferPartial.read();

    // Final reduction on CPU
    let finalSum = 0;
    for (let i = 0; i < numWorkgroups; i++) {
      finalSum += partialSums[i];
    }

    // Cleanup
    bufferInput.destroy();
    bufferPartial.destroy();

    return new Float32Array([finalSum]);
  }

  /**
   * Execute dot product on GPU
   */
  private async executeDotProduct(
    a: Float32Array,
    b: Float32Array
  ): Promise<number> {
    // Use reduce shader approach
    const length = a.length;
    const numWorkgroups = Math.ceil(length / this.workgroupSize);

    // Allocate buffers
    const bufferA = this.device.allocateBuffer(
      length * 4,
      BufferUsage.Storage | BufferUsage.CopyDst
    );
    const bufferB = this.device.allocateBuffer(
      length * 4,
      BufferUsage.Storage | BufferUsage.CopyDst
    );
    const bufferPartial = this.device.allocateBuffer(
      numWorkgroups * 4,
      BufferUsage.Storage | BufferUsage.CopySrc
    );

    // Write input data
    await bufferA.write(a);
    await bufferB.write(b);

    // Create compute pipeline
    const pipeline = this.device.createComputePipeline(
      this.dotProductShader,
      "dot_product"
    );

    // Create bind group
    const bindGroup = this.device.createBindGroup(pipeline.bindGroupLayout!, [
      { buffer: bufferA.buffer! },
      { buffer: bufferB.buffer! },
      { buffer: bufferPartial.buffer! },
    ]);

    // Encode and submit commands
    const encoder = this.device.beginCommands();
    const passEncoder = encoder.encoder!.beginComputePass();
    passEncoder.setPipeline(pipeline.pipeline as GPUComputePipeline);
    passEncoder.setBindGroup(0, bindGroup.bindGroup as GPUBindGroup);
    passEncoder.dispatchWorkgroups(numWorkgroups);
    passEncoder.end();

    const commandBuffer = encoder.finish();
    this.device.submitCommands(commandBuffer);

    // Read partial sums
    const partialSums = await bufferPartial.read();

    // Final reduction on CPU
    let finalDot = 0;
    for (let i = 0; i < numWorkgroups; i++) {
      finalDot += partialSums[i];
    }

    // Cleanup
    bufferA.destroy();
    bufferB.destroy();
    bufferPartial.destroy();

    return finalDot;
  }

  /**
   * Get CPU fallback instance
   */
  getCPUFallback(): VectorOps {
    return this.cpuFallback;
  }

  /**
   * Get GPU device
   */
  getDevice(): GPUDeviceManager {
    return this.device;
  }

  /**
   * Check if GPU is being used
   */
  isUsingGPU(): boolean {
    return this.useGPU;
  }
}

/**
 * Type declarations for WebGPU interfaces
 */
interface GPUBuffer {
  setSubData(offset: number, data: Float32Array | Uint8Array): void;
  mapAsync(mode: GPUMapMode): Promise<void>;
  getMappedRange(): ArrayBuffer;
  unmap(): void;
  destroy(): void;
}

interface GPUCommandEncoder {
  beginComputePass(): GPUComputePassEncoder;
  finish(): GPUCommandBuffer;
}

interface GPUComputePassEncoder {
  setPipeline(pipeline: GPUComputePipeline): void;
  setBindGroup(index: number, bindGroup: GPUBindGroup): void;
  dispatchWorkgroups(x: number, y?: number, z?: number): void;
  end(): void;
}

interface GPUComputePipeline {
  getBindGroupLayout(index: number): GPUBindGroupLayout;
}

interface GPUBindGroupLayout {}

interface GPUBindGroup {}

interface GPUCommandBuffer {}

interface GPUShaderModule {}

enum GPUMapMode {
  READ = 0x01,
  WRITE = 0x02,
}

enum GPUBufferUsage {
  INDEX = 0x0004,
  VERTEX = 0x0008,
  UNIFORM = 0x0010,
  STORAGE = 0x0020,
  COPY_SRC = 0x01,
  COPY_DST = 0x02,
  MAP_READ = 0x0001,
  MAP_WRITE = 0x0002,
}

enum GPUShaderStage {
  COMPUTE = 0x10,
}

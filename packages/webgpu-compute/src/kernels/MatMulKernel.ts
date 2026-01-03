/**
 * @lsi/webgpu-compute/kernels/MatMulKernel - Matrix Multiplication Kernel
 *
 * High-level interface for GPU-accelerated matrix multiplication.
 *
 * @version 1.0.0
 */

import type {
  WebGPUContext,
  MatrixShape,
  ComputeResult,
  MatMulConfig,
} from "../types.js";
import { ComputeShaderManager } from "../ComputeShaderManager.js";
import { BufferManager } from "../BufferManager.js";
import {
  getMatMulShader,
  getBatchMatMulShader,
  getTransposeShader,
} from "../shaders/MatMulShader.js";

/**
 * Matrix multiplication kernel
 *
 * Provides high-level interface for matrix multiplication on GPU.
 */
export class MatMulKernel {
  private context: WebGPUContext;
  private shaderManager: ComputeShaderManager;
  private bufferManager: BufferManager;
  private disposed: boolean = false;

  constructor(context: WebGPUContext) {
    this.context = context;
    this.shaderManager = new ComputeShaderManager(context);
    this.bufferManager = new BufferManager(context);
  }

  /**
   * Multiply two matrices: C = A * B
   *
   * @param a - Left matrix (M x K)
   * @param b - Right matrix (K x N)
   * @param config - Configuration
   * @returns Compute result with output matrix
   */
  async multiply(
    a: Float32Array,
    b: Float32Array,
    config: Partial<MatMulConfig> = {}
  ): Promise<ComputeResult> {
    const M = config.leftMatrix?.rows ?? Math.sqrt(a.length);
    const K = config.leftMatrix?.cols ?? Math.sqrt(a.length);
    const N = config.rightMatrix?.cols ?? Math.sqrt(b.length);

    // Validate input sizes
    if (a.length !== M * K) {
      throw new Error(
        `Left matrix size mismatch: expected ${M * K}, got ${a.length}`
      );
    }
    if (b.length !== K * N) {
      throw new Error(
        `Right matrix size mismatch: expected ${K * N}, got ${b.length}`
      );
    }

    // Create buffers
    const bufferA = this.bufferManager.createBuffer("matmul-a", a, {
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const bufferB = this.bufferManager.createBuffer("matmul-b", b, {
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const bufferC = this.bufferManager.createStorageBuffer(
      "matmul-c",
      M * N * 4
    );

    // Create shader
    const shaderCode = getMatMulShader(M, K, N);
    const shader = await this.shaderManager.createShaderModule(
      "matmul-shader",
      shaderCode
    );

    // Create pipeline
    const pipeline = this.shaderManager.createComputePipeline(
      "matmul-pipeline",
      shader
    );

    // Create bind group
    const device = this.context.getDevice();
    const bindGroup = device.createBindGroup({
      layout: pipeline.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: bufferA } },
        { binding: 1, resource: { buffer: bufferB } },
        { binding: 2, resource: { buffer: bufferC } },
      ],
    });

    // Calculate workgroups
    const workgroupX = Math.ceil(M / 16);
    const workgroupY = Math.ceil(N / 16);

    // Execute
    const result = await this.shaderManager.execute(
      pipeline,
      [bindGroup],
      { x: workgroupX, y: workgroupY, z: 1 },
      bufferC,
      M * N * 4
    );

    // Cleanup
    this.bufferManager.destroyBuffer("matmul-a");
    this.bufferManager.destroyBuffer("matmul-b");
    this.bufferManager.destroyBuffer("matmul-c");

    return result;
  }

  /**
   * Batch multiply matrices
   *
   * @param a - Batch of left matrices
   * @param b - Batch of right matrices
   * @param config - Configuration
   * @returns Compute result with output matrices
   */
  async batchMultiply(
    a: Float32Array[],
    b: Float32Array[],
    config: Partial<MatMulConfig> = {}
  ): Promise<ComputeResult> {
    const batchSize = a.length;
    if (batchSize !== b.length) {
      throw new Error("Batch size mismatch between A and B");
    }

    const M = config.leftMatrix?.rows ?? Math.sqrt(a[0].length);
    const K = config.leftMatrix?.cols ?? Math.sqrt(a[0].length);
    const N = config.rightMatrix?.cols ?? Math.sqrt(b[0].length);

    // Flatten batches
    const flatA = new Float32Array(batchSize * M * K);
    const flatB = new Float32Array(batchSize * K * N);

    for (let i = 0; i < batchSize; i++) {
      flatA.set(a[i], i * M * K);
      flatB.set(b[i], i * K * N);
    }

    // Create buffers
    const bufferA = this.bufferManager.createBuffer("batch-matmul-a", flatA);
    const bufferB = this.bufferManager.createBuffer("batch-matmul-b", flatB);
    const bufferC = this.bufferManager.createStorageBuffer(
      "batch-matmul-c",
      batchSize * M * N * 4
    );

    // Create shader
    const shaderCode = getBatchMatMulShader(batchSize, M, K, N);
    const shader = await this.shaderManager.createShaderModule(
      "batch-matmul-shader",
      shaderCode
    );

    // Create pipeline
    const pipeline = this.shaderManager.createComputePipeline(
      "batch-matmul-pipeline",
      shader
    );

    // Create bind group
    const device = this.context.getDevice();
    const bindGroup = device.createBindGroup({
      layout: pipeline.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: bufferA } },
        { binding: 1, resource: { buffer: bufferB } },
        { binding: 2, resource: { buffer: bufferC } },
      ],
    });

    // Calculate workgroups
    const workgroupX = Math.ceil(M / 16);
    const workgroupY = Math.ceil(N / 16);
    const workgroupZ = batchSize;

    // Execute
    const result = await this.shaderManager.execute(
      pipeline,
      [bindGroup],
      { x: workgroupX, y: workgroupY, z: workgroupZ },
      bufferC,
      batchSize * M * N * 4
    );

    // Cleanup
    this.bufferManager.destroyBuffer("batch-matmul-a");
    this.bufferManager.destroyBuffer("batch-matmul-b");
    this.bufferManager.destroyBuffer("batch-matmul-c");

    return result;
  }

  /**
   * Transpose matrix
   *
   * @param a - Input matrix
   * @param shape - Input shape
   * @returns Compute result with transposed matrix
   */
  async transpose(a: Float32Array, shape: MatrixShape): Promise<ComputeResult> {
    const { rows: M, cols: N } = shape;

    if (a.length !== M * N) {
      throw new Error(
        `Matrix size mismatch: expected ${M * N}, got ${a.length}`
      );
    }

    // Create buffers
    const bufferA = this.bufferManager.createBuffer("transpose-a", a);
    const bufferB = this.bufferManager.createStorageBuffer(
      "transpose-b",
      M * N * 4
    );

    // Create shader
    const shaderCode = getTransposeShader(M, N);
    const shader = await this.shaderManager.createShaderModule(
      "transpose-shader",
      shaderCode
    );

    // Create pipeline
    const pipeline = this.shaderManager.createComputePipeline(
      "transpose-pipeline",
      shader
    );

    // Create bind group
    const device = this.context.getDevice();
    const bindGroup = device.createBindGroup({
      layout: pipeline.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: bufferA } },
        { binding: 1, resource: { buffer: bufferB } },
      ],
    });

    // Calculate workgroups
    const workgroupX = Math.ceil(M / 16);
    const workgroupY = Math.ceil(N / 16);

    // Execute
    const result = await this.shaderManager.execute(
      pipeline,
      [bindGroup],
      { x: workgroupX, y: workgroupY, z: 1 },
      bufferB,
      M * N * 4
    );

    // Cleanup
    this.bufferManager.destroyBuffer("transpose-a");
    this.bufferManager.destroyBuffer("transpose-b");

    return result;
  }

  /**
   * Dispose of kernel
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.shaderManager.dispose();
    this.bufferManager.dispose();
    this.disposed = true;
  }

  /**
   * Get buffer manager
   */
  getBufferManager(): BufferManager {
    return this.bufferManager;
  }

  /**
   * Get shader manager
   */
  getShaderManager(): ComputeShaderManager {
    return this.shaderManager;
  }
}

/**
 * Create matrix multiplication kernel
 *
 * @param context - WebGPU context
 * @returns MatMul kernel instance
 */
export function createMatMulKernel(context: WebGPUContext): MatMulKernel {
  return new MatMulKernel(context);
}

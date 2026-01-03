/**
 * @lsi/webgpu-compute/ComputeShaderManager - GPU Compute Shader Management
 *
 * Manages compute shader creation, compilation, and execution.
 * Provides high-level interface for GPU compute operations.
 *
 * Key Features:
 * - Shader module creation and caching
 * - Compute pipeline management
 * - Efficient dispatch operations
 * - Bind group management
 * - Output reading and validation
 *
 * @version 1.0.0
 */

import type {
  WebGPUContext,
  ComputeShader,
  ComputePipeline,
  ComputeResult,
  DispatchConfig,
  WorkgroupSize,
  BindGroupConfig,
  ShaderCompilationError,
  DispatchError,
  ComputeStats,
} from "./types.js";

/**
 * Compute Shader Manager
 *
 * High-level interface for managing compute shaders and pipelines.
 */
export class ComputeShaderManager {
  private context: WebGPUContext;
  private shaders: Map<string, ComputeShader> = new Map();
  private pipelines: Map<string, ComputePipeline> = new Map();
  private stats: ComputeStats;
  private disposed: boolean = false;

  constructor(context: WebGPUContext) {
    this.context = context;

    this.stats = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      totalDataTransferred: 0,
      totalWorkgroupsDispatched: 0,
    };
  }

  /**
   * Create shader module from WGSL code
   *
   * @param id - Unique shader identifier
   * @param code - WGSL shader source code
   * @param entryPoint - Entry point function name (default: "main")
   * @returns Compute shader
   */
  async createShaderModule(
    id: string,
    code: string,
    entryPoint: string = "main"
  ): Promise<ComputeShader> {
    if (this.disposed) {
      throw new Error("ComputeShaderManager is disposed");
    }

    const device = this.context.getDevice();

    // Check if shader already exists
    if (this.shaders.has(id)) {
      return this.shaders.get(id)!;
    }

    // Create shader module
    const module = device.createShaderModule({ code });

    // Get compilation info
    const compilationInfo = await module.getCompilationInfo();

    // Check for errors
    const errors = compilationInfo.messages.filter(m => m.type === "error");
    if (errors.length > 0) {
      const errorMessages = errors
        .map(e => `Line ${e.lineNum}: ${e.message}`)
        .join("\n");
      throw new ShaderCompilationError(
        `Shader compilation failed for ${id}:\n${errorMessages}`,
        compilationInfo
      );
    }

    const shader: ComputeShader = {
      module,
      code,
      entryPoint,
      label: id,
      compilationInfo,
    };

    // Cache shader
    this.shaders.set(id, shader);

    return shader;
  }

  /**
   * Get shader by ID
   *
   * @param id - Shader identifier
   * @returns Compute shader or undefined
   */
  getShader(id: string): ComputeShader | undefined {
    return this.shaders.get(id);
  }

  /**
   * Check if shader exists
   *
   * @param id - Shader identifier
   * @returns Whether shader exists
   */
  hasShader(id: string): boolean {
    return this.shaders.has(id);
  }

  /**
   * Create compute pipeline from shader
   *
   * @param id - Unique pipeline identifier
   * @param shader - Compute shader or shader ID
   * @param bindGroupLayout - Bind group layout (optional, auto-generated if not provided)
   * @returns Compute pipeline
   */
  createComputePipeline(
    id: string,
    shader: ComputeShader | string,
    bindGroupLayout?: GPUBindGroupLayout
  ): ComputePipeline {
    if (this.disposed) {
      throw new Error("ComputeShaderManager is disposed");
    }

    const device = this.context.getDevice();

    // Check if pipeline already exists
    if (this.pipelines.has(id)) {
      return this.pipelines.get(id)!;
    }

    // Get shader
    const shaderObj =
      typeof shader === "string" ? this.shaders.get(shader) : shader;
    if (!shaderObj) {
      throw new Error(`Shader not found: ${shader}`);
    }

    // Create pipeline layout
    const pipelineLayout = bindGroupLayout
      ? device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] })
      : "auto";

    // Create compute pipeline
    const pipeline = device.createComputePipeline({
      layout: pipelineLayout,
      compute: {
        module: shaderObj.module,
        entryPoint: shaderObj.entryPoint,
      },
    });

    // Get bind group layout if not provided
    const layout = bindGroupLayout ?? pipeline.getBindGroupLayout(0);

    const pipelineObj: ComputePipeline = {
      shader: shaderObj,
      layout: pipelineLayout,
      bindGroupLayout: layout,
      pipeline,
      label: id,
    };

    // Cache pipeline
    this.pipelines.set(id, pipelineObj);

    return pipelineObj;
  }

  /**
   * Get pipeline by ID
   *
   * @param id - Pipeline identifier
   * @returns Compute pipeline or undefined
   */
  getPipeline(id: string): ComputePipeline | undefined {
    return this.pipelines.get(id);
  }

  /**
   * Check if pipeline exists
   *
   * @param id - Pipeline identifier
   * @returns Whether pipeline exists
   */
  hasPipeline(id: string): boolean {
    return this.pipelines.has(id);
  }

  /**
   * Create bind group
   *
   * @param pipeline - Compute pipeline
   * @param config - Bind group configuration
   * @returns Bind group
   */
  createBindGroup(
    pipeline: ComputePipeline,
    config: BindGroupConfig
  ): GPUBindGroup {
    const device = this.context.getDevice();

    const bindings = config.bindings.map(b => ({
      binding: b.binding,
      resource: {
        buffer: b.buffer,
        offset: b.offset ?? 0,
        size: b.size,
      },
    }));

    return device.createBindGroup({
      layout: pipeline.bindGroupLayout,
      entries: bindings,
      label: config.label,
    });
  }

  /**
   * Dispatch compute operation
   *
   * @param pipeline - Compute pipeline
   * @param bindGroups - Bind groups to use
   * @param workgroups - Workgroup count
   * @returns Command buffer (needs to be submitted)
   */
  dispatch(
    pipeline: ComputePipeline,
    bindGroups: GPUBindGroup[],
    workgroups: WorkgroupSize
  ): GPUCommandBuffer {
    if (this.disposed) {
      throw new Error("ComputeShaderManager is disposed");
    }

    const commandEncoder =
      this.context.createCommandEncoder("compute-dispatch");
    const passEncoder = commandEncoder.beginComputePass();

    passEncoder.setPipeline(pipeline.pipeline);
    bindGroups.forEach((bg, index) => {
      passEncoder.setBindGroup(index, bg);
    });
    passEncoder.dispatchWorkgroups(
      workgroups.x,
      workgroups.y ?? 1,
      workgroups.z ?? 1
    );
    passEncoder.end();

    return commandEncoder.finish();
  }

  /**
   * Dispatch and submit immediately
   *
   * @param pipeline - Compute pipeline
   * @param bindGroups - Bind groups to use
   * @param workgroups - Workgroup count
   */
  dispatchSubmit(
    pipeline: ComputePipeline,
    bindGroups: GPUBindGroup[],
    workgroups: WorkgroupSize
  ): void {
    const commandBuffer = this.dispatch(pipeline, bindGroups, workgroups);
    this.context.submit([commandBuffer]);
  }

  /**
   * Execute compute operation and read output
   *
   * @param pipeline - Compute pipeline
   * @param bindGroups - Bind groups to use
   * @param workgroups - Workgroup count
   * @param outputBuffer - Buffer to read output from
   * @param outputSize - Size of output in bytes
   * @returns Compute result with output data
   */
  async execute(
    pipeline: ComputePipeline,
    bindGroups: GPUBindGroup[],
    workgroups: WorkgroupSize,
    outputBuffer: GPUBuffer,
    outputSize: number
  ): Promise<ComputeResult> {
    const startTime = performance.now();

    try {
      // Dispatch and submit
      this.dispatchSubmit(pipeline, bindGroups, workgroups);

      // Read output
      const outputData = await this.context.readBuffer(
        outputBuffer,
        outputSize
      );

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Update stats
      this.stats.totalOperations++;
      this.stats.successfulOperations++;
      this.stats.totalExecutionTime += executionTime;
      this.stats.averageExecutionTime =
        this.stats.totalExecutionTime / this.stats.totalOperations;
      this.stats.totalDataTransferred += outputSize;
      this.stats.totalWorkgroupsDispatched +=
        (workgroups.x ?? 1) * (workgroups.y ?? 1) * (workgroups.z ?? 1);

      return {
        success: true,
        data: new Float32Array(outputData),
        executionTime,
        metadata: {
          workgroupsDispatched:
            (workgroups.x ?? 1) * (workgroups.y ?? 1) * (workgroups.z ?? 1),
        },
      };
    } catch (error) {
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Update stats
      this.stats.totalOperations++;
      this.stats.failedOperations++;

      return {
        success: false,
        executionTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Read output from buffer
   *
   * @param buffer - GPU buffer to read from
   * @param size - Size to read in bytes
   * @returns Promise resolving to Float32Array
   */
  async readOutput(buffer: GPUBuffer, size: number): Promise<Float32Array> {
    const data = await this.context.readBuffer(buffer, size);
    return new Float32Array(data.buffer, data.byteOffset, size / 4);
  }

  /**
   * Get statistics
   *
   * @returns Current statistics
   */
  getStats(): ComputeStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      totalDataTransferred: 0,
      totalWorkgroupsDispatched: 0,
    };
  }

  /**
   * Clear all cached shaders and pipelines
   */
  clearCache(): void {
    this.shaders.clear();
    this.pipelines.clear();
  }

  /**
   * Dispose of shader manager
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.clearCache();
    this.disposed = true;
  }
}

/**
 * Compute operation helper
 *
 * Simplifies common compute operations.
 */
export class ComputeOperation {
  private manager: ComputeShaderManager;
  private pipeline: ComputePipeline;

  constructor(manager: ComputeShaderManager, pipeline: ComputePipeline) {
    this.manager = manager;
    this.pipeline = pipeline;
  }

  /**
   * Execute operation with input/output buffers
   *
   * @param inputs - Input buffers
   * @param output - Output buffer
   * @param workgroups - Workgroup count
   * @returns Compute result
   */
  async execute(
    inputs: GPUBuffer[],
    output: GPUBuffer,
    workgroups: WorkgroupSize
  ): Promise<ComputeResult> {
    const device = this.manager["context"].getDevice();
    const outputSize = output.size;

    // Create bind group
    const bindings: Array<{ binding: number; buffer: GPUBuffer }> = [];
    inputs.forEach((buf, idx) => {
      bindings.push({ binding: idx, buffer: buf });
    });
    bindings.push({ binding: inputs.length, buffer: output });

    const bindGroup = device.createBindGroup({
      layout: this.pipeline.bindGroupLayout,
      entries: bindings.map(b => ({
        binding: b.binding,
        resource: { buffer: b.buffer },
      })),
    });

    // Execute
    return this.manager.execute(
      this.pipeline,
      [bindGroup],
      workgroups,
      output,
      outputSize
    );
  }

  /**
   * Dispatch operation (no output read)
   *
   * @param inputs - Input buffers
   * @param output - Output buffer
   * @param workgroups - Workgroup count
   */
  dispatch(
    inputs: GPUBuffer[],
    output: GPUBuffer,
    workgroups: WorkgroupSize
  ): void {
    const device = this.manager["context"].getDevice();

    // Create bind group
    const bindings: Array<{ binding: number; buffer: GPUBuffer }> = [];
    inputs.forEach((buf, idx) => {
      bindings.push({ binding: idx, buffer: buf });
    });
    bindings.push({ binding: inputs.length, buffer: output });

    const bindGroup = device.createBindGroup({
      layout: this.pipeline.bindGroupLayout,
      entries: bindings.map(b => ({
        binding: b.binding,
        resource: { buffer: b.buffer },
      })),
    });

    // Dispatch
    this.manager.dispatchSubmit(this.pipeline, [bindGroup], workgroups);
  }
}

/**
 * Shader cache configuration
 */
export interface ShaderCacheConfig {
  /** Maximum number of cached shaders */
  maxShaders?: number;
  /** Maximum number of cached pipelines */
  maxPipelines?: number;
  /** Whether to enable automatic cleanup */
  enableCleanup?: boolean;
  /** Cleanup interval in milliseconds */
  cleanupInterval?: number;
}

/**
 * Create compute shader manager with configuration
 *
 * @param context - WebGPU context
 * @param config - Cache configuration
 * @returns Configured shader manager
 */
export function createComputeShaderManager(
  context: WebGPUContext,
  config?: ShaderCacheConfig
): ComputeShaderManager {
  const manager = new ComputeShaderManager(context);

  // Setup periodic cleanup if enabled
  if (config?.enableCleanup && config.cleanupInterval) {
    setInterval(() => {
      // Cleanup logic would go here
      // For now, we just let the manager handle it
    }, config.cleanupInterval);
  }

  return manager;
}

/**
 * Validate WGSL code
 *
 * @param code - WGSL code to validate
 * @param device - GPU device
 * @returns Validation result
 */
export async function validateWGSL(
  code: string,
  device: GPUDevice
): Promise<{
  valid: boolean;
  errors: Array<{ line: number; message: string }>;
}> {
  const module = device.createShaderModule({ code });
  const info = await module.getCompilationInfo();

  const errors = info.messages
    .filter(m => m.type === "error")
    .map(m => ({ line: m.lineNum, message: m.message }));

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create simple compute operation
 *
 * Helper function to create a one-shot compute operation.
 *
 * @param context - WebGPU context
 * @param shaderCode - WGSL shader code
 * @param inputs - Input buffers
 * @param outputSize - Output buffer size
 * @param workgroups - Workgroup count
 * @returns Compute result
 */
export async function compute(
  context: WebGPUContext,
  shaderCode: string,
  inputs: GPUBuffer[],
  outputSize: number,
  workgroups: WorkgroupSize
): Promise<ComputeResult> {
  const manager = new ComputeShaderManager(context);

  // Create shader
  const shader = await manager.createShaderModule("temp-shader", shaderCode);

  // Create pipeline
  const pipeline = manager.createComputePipeline("temp-pipeline", shader);

  // Create output buffer
  const device = context.getDevice();
  const outputBuffer = device.createBuffer({
    size: outputSize,
    usage:
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_SRC |
      GPUBufferUsage.COPY_DST,
  });

  // Create bind group
  const bindings: Array<{ binding: number; buffer: GPUBuffer }> = [];
  inputs.forEach((buf, idx) => {
    bindings.push({ binding: idx, buffer: buf });
  });
  bindings.push({ binding: inputs.length, buffer: outputBuffer });

  const bindGroup = device.createBindGroup({
    layout: pipeline.bindGroupLayout,
    entries: bindings.map(b => ({
      binding: b.binding,
      resource: { buffer: b.buffer },
    })),
  });

  // Execute
  const result = await manager.execute(
    pipeline,
    [bindGroup],
    workgroups,
    outputBuffer,
    outputSize
  );

  // Cleanup
  outputBuffer.destroy();
  manager.dispose();

  return result;
}

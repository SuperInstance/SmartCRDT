/**
 * @lsi/vljepa/webgpu/WebGPUContext - WebGPU Context Management
 *
 * Manages WebGPU device initialization, compute pipeline creation,
 * and resource lifecycle for VL-JEPA GPU acceleration.
 *
 * Key Features:
 * - WebGPU adapter/device initialization
 * - Compute pipeline caching
 * - Error handling and fallback support
 * - Performance monitoring
 *
 * @see https://web.dev/blog/webgpu-supported-major-browsers
 * @version 1.0.0
 */

/**
 * WebGPU configuration options
 */
export interface WebGPUConfig {
  /** Power preference for adapter selection */
  powerPreference?: "high-performance" | "low-power";

  /** Required features */
  requiredFeatures?: GPUFeatureName[];

  /** Required limits */
  requiredLimits?: Record<string, number>;

  /** Enable performance monitoring */
  enableProfiling?: boolean;

  /** Maximum buffer size in bytes */
  maxBufferSize?: number;

  /** Enable shader debugging */
  debugShaders?: boolean;
}

/**
 * WebGPU initialization result
 */
export interface WebGPUInitResult {
  success: boolean;
  device?: GPUDevice;
  adapter?: GPUAdapter;
  adapterInfo?: GPUAdapterInfo;
  error?: string;
}

/**
 * Compute pipeline cache entry
 */
interface CachedPipeline {
  pipeline: GPUComputePipeline;
  timestamp: number;
  useCount: number;
}

/**
 * Performance metrics
 */
export interface WebGPUMetrics {
  pipelineCreationTime: number;
  totalPipelineCreations: number;
  cachedPipelineHits: number;
  totalDispatchCalls: number;
  bufferAllocations: number;
  bufferDeallocations: number;
  currentBufferCount: number;
  peakBufferCount: number;
}

/**
 * WebGPU Context Manager
 *
 * Manages WebGPU device, adapter, and compute pipeline lifecycle.
 * Provides caching and performance monitoring for GPU operations.
 */
export class WebGPUContext {
  private adapter: GPUAdapter | null = null;
  private device: GPUDevice | null = null;
  private adapterInfo: GPUAdapterInfo | null = null;
  private config: WebGPUConfig;
  private pipelineCache: Map<string, CachedPipeline> = new Map();
  private metrics: WebGPUMetrics;
  private initialized: boolean = false;
  private lostPromise: Promise<GPUDeviceLostInfo> | null = null;

  constructor(config: WebGPUConfig = {}) {
    this.config = {
      powerPreference: "high-performance",
      enableProfiling: true,
      maxBufferSize: 256 * 1024 * 1024, // 256MB default
      debugShaders: false,
      ...config,
    };

    this.metrics = {
      pipelineCreationTime: 0,
      totalPipelineCreations: 0,
      cachedPipelineHits: 0,
      totalDispatchCalls: 0,
      bufferAllocations: 0,
      bufferDeallocations: 0,
      currentBufferCount: 0,
      peakBufferCount: 0,
    };
  }

  /**
   * Initialize WebGPU device
   *
   * @returns Initialization result
   */
  async initialize(): Promise<WebGPUInitResult> {
    if (this.initialized && this.device) {
      return {
        success: true,
        device: this.device,
        adapter: this.adapter!,
        adapterInfo: this.adapterInfo!,
      };
    }

    // Check WebGPU support
    if (!navigator.gpu) {
      return {
        success: false,
        error:
          "WebGPU is not supported in this browser. " +
          "Please use Chrome 113+, Edge 113+, or Firefox Nightly.",
      };
    }

    try {
      // Request GPU adapter
      const adapterDescriptor: GPURequestAdapterOptions = {
        powerPreference: this.config.powerPreference,
      };

      this.adapter = await navigator.gpu.requestAdapter(adapterDescriptor);

      if (!this.adapter) {
        return {
          success: false,
          error: "No GPU adapter found. " + "Your GPU may not support WebGPU.",
        };
      }

      // Get adapter info
      this.adapterInfo = await this.adapter.requestAdapterInfo();

      // Request device
      const deviceDescriptor: GPUDeviceDescriptor = {
        requiredFeatures: this.config.requiredFeatures,
        requiredLimits: this.config.requiredLimits,
      };

      this.device = await this.adapter.requestDevice(deviceDescriptor);

      // Set up device lost handler
      this.lostPromise = this.device.lost.then(info => {
        console.error("WebGPU device lost:", info);
        this.initialized = false;
        this.device = null;
      });

      this.initialized = true;

      return {
        success: true,
        device: this.device,
        adapter: this.adapter,
        adapterInfo: this.adapterInfo,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get WebGPU device (throws if not initialized)
   *
   * @returns GPU device
   * @throws Error if device not initialized
   */
  getDevice(): GPUDevice {
    if (!this.device) {
      throw new Error(
        "WebGPU device not initialized. Call initialize() first."
      );
    }
    return this.device;
  }

  /**
   * Get GPU adapter (throws if not initialized)
   *
   * @returns GPU adapter
   * @throws Error if adapter not initialized
   */
  getAdapter(): GPUAdapter {
    if (!this.adapter) {
      throw new Error(
        "WebGPU adapter not initialized. Call initialize() first."
      );
    }
    return this.adapter;
  }

  /**
   * Get adapter information
   *
   * @returns Adapter info or null
   */
  getAdapterInfo(): GPUAdapterInfo | null {
    return this.adapterInfo;
  }

  /**
   * Check if WebGPU is available
   *
   * @returns Whether WebGPU is supported
   */
  static isAvailable(): boolean {
    return typeof navigator !== "undefined" && "gpu" in navigator;
  }

  /**
   * Check if context is initialized
   *
   * @returns Whether context is initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.device !== null;
  }

  /**
   * Get compute pipeline with caching
   *
   * @param shaderCode - WGSL shader code
   * @param label - Pipeline label for debugging
   * @returns Compute pipeline
   */
  getComputePipeline(shaderCode: string, label?: string): GPUComputePipeline {
    if (!this.device) {
      throw new Error("WebGPU device not initialized");
    }

    // Check cache
    const cacheKey = this.hashShaderCode(shaderCode);
    const cached = this.pipelineCache.get(cacheKey);

    if (cached) {
      cached.useCount++;
      this.metrics.cachedPipelineHits++;
      return cached.pipeline;
    }

    // Create new pipeline
    const startTime = this.config.enableProfiling ? performance.now() : 0;

    const shaderModule = this.device.createShaderModule({
      code: shaderCode,
      label: label ? `${label}-shader` : undefined,
    });

    const pipeline = this.device.createComputePipeline({
      compute: {
        module: shaderModule,
        entryPoint: "main",
      },
      label: label,
    });

    // Cache pipeline
    this.pipelineCache.set(cacheKey, {
      pipeline,
      timestamp: Date.now(),
      useCount: 1,
    });

    if (this.config.enableProfiling && startTime) {
      this.metrics.pipelineCreationTime += performance.now() - startTime;
      this.metrics.totalPipelineCreations++;
    }

    return pipeline;
  }

  /**
   * Create buffer with tracking
   *
   * @param size - Buffer size in bytes
   * @param usage - Buffer usage flags
   * @param label - Buffer label for debugging
   * @returns GPU buffer
   */
  createBuffer(
    size: number,
    usage: GPUBufferUsageFlags,
    label?: string
  ): GPUBuffer {
    if (!this.device) {
      throw new Error("WebGPU device not initialized");
    }

    if (this.config.maxBufferSize && size > this.config.maxBufferSize) {
      throw new Error(
        `Buffer size ${size} exceeds maximum ${this.config.maxBufferSize}`
      );
    }

    const buffer = this.device.createBuffer({
      size,
      usage,
      label,
      mappedAtCreation: (usage & GPUBufferUsage.MAP_WRITE) !== 0,
    });

    this.metrics.bufferAllocations++;
    this.metrics.currentBufferCount++;
    this.metrics.peakBufferCount = Math.max(
      this.metrics.peakBufferCount,
      this.metrics.currentBufferCount
    );

    return buffer;
  }

  /**
   * Destroy buffer with tracking
   *
   * @param buffer - Buffer to destroy
   */
  destroyBuffer(buffer: GPUBuffer): void {
    buffer.destroy();
    this.metrics.bufferDeallocations++;
    this.metrics.currentBufferCount--;
  }

  /**
   * Create bind group layout
   *
   * @param entries - Bind group layout entries
   * @returns Bind group layout
   */
  createBindGroupLayout(
    entries: GPUBindGroupLayoutEntry[]
  ): GPUBindGroupLayout {
    if (!this.device) {
      throw new Error("WebGPU device not initialized");
    }

    return this.device.createBindGroupLayout({ entries });
  }

  /**
   * Create pipeline layout
   *
   * @param bindGroupLayouts - Bind group layouts
   * @returns Pipeline layout
   */
  createPipelineLayout(
    bindGroupLayouts: GPUBindGroupLayout[]
  ): GPUPipelineLayout {
    if (!this.device) {
      throw new Error("WebGPU device not initialized");
    }

    return this.device.createPipelineLayout({ bindGroupLayouts });
  }

  /**
   * Create command encoder
   *
   * @param label - Command encoder label
   * @returns Command encoder
   */
  createCommandEncoder(label?: string): GPUCommandEncoder {
    if (!this.device) {
      throw new Error("WebGPU device not initialized");
    }

    return this.device.createCommandEncoder({ label });
  }

  /**
   * Submit commands to queue
   *
   * @param commandBuffers - Command buffers to submit
   */
  submit(commandBuffers: GPUCommandBuffer[]): void {
    if (!this.device) {
      throw new Error("WebGPU device not initialized");
    }

    this.device.queue.submit(commandBuffers);
  }

  /**
   * Write buffer to queue
   *
   * @param buffer - Buffer to write
   * @param bufferOffset - Offset in buffer
   * @param data - Data to write
   * @param dataOffset - Offset in data
   * @param size - Size to write
   */
  writeBuffer(
    buffer: GPUBuffer,
    bufferOffset: number,
    data: BufferSource | SharedArrayBuffer,
    dataOffset?: number,
    size?: number
  ): void {
    if (!this.device) {
      throw new Error("WebGPU device not initialized");
    }

    this.device.queue.writeBuffer(buffer, bufferOffset, data, dataOffset, size);
  }

  /**
   * Read buffer from GPU
   *
   * @param buffer - Buffer to read
   * @param size - Size to read in bytes
   * @returns Promise resolving to data
   */
  async readBuffer(buffer: GPUBuffer, size: number): Promise<ArrayBuffer> {
    if (!this.device) {
      throw new Error("WebGPU device not initialized");
    }

    // Create staging buffer for reading
    const stagingBuffer = this.device.createBuffer({
      size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    // Copy buffer to staging buffer
    const commandEncoder = this.device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(buffer, 0, stagingBuffer, 0, size);
    this.device.queue.submit([commandEncoder.finish()]);

    // Map and read staging buffer
    await stagingBuffer.mapAsync(GPUMapMode.READ);
    const data = stagingBuffer.getMappedRange().slice(0);
    stagingBuffer.unmap();
    stagingBuffer.destroy();

    return data;
  }

  /**
   * Wait for all queued operations to complete
   *
   * @returns Promise that resolves when all operations complete
   */
  async onWorkDone(): Promise<void> {
    if (!this.device) {
      throw new Error("WebGPU device not initialized");
    }

    await this.device.queue.onSubmittedWorkDone();
  }

  /**
   * Get performance metrics
   *
   * @returns Metrics object
   */
  getMetrics(): WebGPUMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      pipelineCreationTime: 0,
      totalPipelineCreations: 0,
      cachedPipelineHits: 0,
      totalDispatchCalls: 0,
      bufferAllocations: 0,
      bufferDeallocations: 0,
      currentBufferCount: this.metrics.currentBufferCount,
      peakBufferCount: this.metrics.peakBufferCount,
    };
  }

  /**
   * Clear pipeline cache
   *
   * @param olderThan - Remove pipelines older than this timestamp (ms)
   */
  clearPipelineCache(olderThan?: number): void {
    if (olderThan === undefined) {
      this.pipelineCache.clear();
      return;
    }

    const now = Date.now();
    for (const [key, value] of this.pipelineCache.entries()) {
      if (now - value.timestamp > olderThan) {
        this.pipelineCache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   *
   * @returns Cache stats
   */
  getCacheStats(): {
    size: number;
    totalUses: number;
    hitRate: number;
    oldestEntry: number | null;
  } {
    let totalUses = 0;
    let oldestTimestamp: number | null = null;

    for (const entry of this.pipelineCache.values()) {
      totalUses += entry.useCount;
      if (oldestTimestamp === null || entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
    }

    const totalRequests =
      this.metrics.totalPipelineCreations + this.metrics.cachedPipelineHits;
    const hitRate =
      totalRequests > 0 ? this.metrics.cachedPipelineHits / totalRequests : 0;

    return {
      size: this.pipelineCache.size,
      totalUses,
      hitRate,
      oldestEntry: oldestTimestamp,
    };
  }

  /**
   * Dispose of WebGPU resources
   */
  dispose(): void {
    // Destroy all cached pipelines (they hold shader modules)
    this.pipelineCache.clear();

    // Destroy device
    if (this.device) {
      this.device.destroy();
      this.device = null;
    }

    this.adapter = null;
    this.adapterInfo = null;
    this.initialized = false;
  }

  /**
   * Hash shader code for cache key
   *
   * @param code - WGSL shader code
   * @returns Hash string
   */
  private hashShaderCode(code: string): string {
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
 * Create default WebGPU context
 *
 * @returns WebGPU context instance
 */
export async function createWebGPUContext(
  config?: WebGPUConfig
): Promise<WebGPUContext> {
  const context = new WebGPUContext(config);
  const result = await context.initialize();

  if (!result.success) {
    throw new Error(`Failed to initialize WebGPU: ${result.error}`);
  }

  return context;
}

/**
 * Check WebGPU compatibility
 *
 * @returns Compatibility result
 */
export async function checkWebGPUCompatibility(): Promise<{
  supported: boolean;
  adapterInfo?: GPUAdapterInfo;
  error?: string;
  recommendedConfig?: WebGPUConfig;
}> {
  if (!WebGPUContext.isAvailable()) {
    return {
      supported: false,
      error: "WebGPU is not supported in this browser",
    };
  }

  try {
    const context = new WebGPUContext();
    const result = await context.initialize();

    if (!result.success) {
      return {
        supported: false,
        error: result.error,
      };
    }

    // Determine recommended config based on adapter
    const recommendedConfig: WebGPUConfig = {
      powerPreference: "high-performance",
      enableProfiling: true,
    };

    // Adjust config for integrated GPUs
    if (
      result.adapterInfo?.architecture?.toLowerCase().includes("integrated")
    ) {
      recommendedConfig.powerPreference = "low-power";
      recommendedConfig.maxBufferSize = 128 * 1024 * 1024; // 128MB for integrated
    }

    context.dispose();

    return {
      supported: true,
      adapterInfo: result.adapterInfo,
      recommendedConfig,
    };
  } catch (error) {
    return {
      supported: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

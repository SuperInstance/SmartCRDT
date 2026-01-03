/**
 * @lsi/webgpu-compute/BufferManager - GPU Buffer Management for Compute Operations
 *
 * Manages GPU buffer allocation, deallocation, pooling, and data transfer.
 * Provides efficient memory management for compute operations.
 *
 * Key Features:
 * - Buffer pooling for reduced allocation overhead
 * - Automatic buffer lifecycle management
 * - Efficient CPU <-> GPU data transfer
 * - Memory usage tracking and limits
 * - Automatic cleanup on dispose
 *
 * @version 1.0.0
 */

import type {
  WebGPUContext,
  BufferOptions,
  BufferPoolEntry,
  BufferStats,
  BufferView,
  ComputeDataType,
  BufferAllocationError,
} from "./types.js";

/**
 * GPU Buffer Manager
 *
 * Manages GPU buffer allocation with pooling for performance.
 */
export class BufferManager {
  private context: WebGPUContext;
  private buffers: Map<string, GPUBuffer> = new Map();
  private bufferPool: BufferPoolEntry[] = [];
  private stats: BufferStats;
  private maxPoolSize: number = 100;
  private maxPoolMemory: number = 256 * 1024 * 1024; // 256MB pool limit
  private disposed: boolean = false;

  constructor(
    context: WebGPUContext,
    maxPoolSize?: number,
    maxPoolMemory?: number
  ) {
    this.context = context;
    if (maxPoolSize !== undefined) {
      this.maxPoolSize = maxPoolSize;
    }
    if (maxPoolMemory !== undefined) {
      this.maxPoolMemory = maxPoolMemory;
    }

    this.stats = {
      totalBuffers: 0,
      pooledBuffers: 0,
      activeBuffers: 0,
      totalMemory: 0,
      pooledMemory: 0,
      activeMemory: 0,
      allocations: 0,
      deallocations: 0,
      poolHits: 0,
      poolMisses: 0,
    };
  }

  /**
   * Create GPU buffer
   *
   * @param id - Unique buffer identifier
   * @param data - Data to upload (optional)
   * @param options - Buffer creation options
   * @returns GPU buffer
   */
  createBuffer(
    id: string,
    data?: Float32Array | Uint8Array | Int32Array,
    options?: Partial<BufferOptions>
  ): GPUBuffer {
    if (this.disposed) {
      throw new Error("BufferManager is disposed");
    }

    const device = this.context.getDevice();

    // Check if buffer already exists
    if (this.buffers.has(id)) {
      const existing = this.buffers.get(id)!;
      if (!data) {
        return existing;
      }
      // If data provided, destroy and recreate
      this.destroyBuffer(id);
    }

    // Determine buffer size
    const size = data?.byteLength ?? options?.size ?? 0;
    if (size === 0) {
      throw new Error("Buffer size must be specified or data must be provided");
    }

    // Determine usage flags
    const usage =
      options?.usage ?? GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;

    // Try to get from pool
    const pooled = this.getFromPool(size, usage);
    let buffer: GPUBuffer;

    if (pooled) {
      buffer = pooled.buffer;
      this.stats.poolHits++;

      // Write data if provided
      if (data) {
        device.queue.writeBuffer(buffer, 0, data);
      }
    } else {
      // Create new buffer
      buffer = device.createBuffer({
        size,
        usage: usage | GPUBufferUsage.COPY_DST,
        mappedAtCreation: data !== undefined,
        label: options?.label ?? id,
      });

      // Upload data if provided
      if (data) {
        const srcArray = new Uint8Array(
          data.buffer,
          data.byteOffset,
          data.byteLength
        );
        new Uint8Array(buffer.getMappedRange()).set(srcArray);
        buffer.unmap();
      }

      this.stats.allocations++;
      this.stats.totalMemory += size;
      this.stats.poolMisses++;
    }

    // Track buffer
    this.buffers.set(id, buffer);
    this.stats.totalBuffers = this.buffers.size;
    this.stats.activeBuffers++;
    this.stats.activeMemory += size;

    return buffer;
  }

  /**
   * Create buffer from typed array
   *
   * @param id - Buffer identifier
   * @param data - Typed array data
   * @param options - Buffer options
   * @returns GPU buffer
   */
  createBufferFromArray<T extends Float32Array | Uint8Array | Int32Array>(
    id: string,
    data: T,
    options?: Partial<BufferOptions>
  ): GPUBuffer {
    return this.createBuffer(id, data, options);
  }

  /**
   * Create storage buffer
   *
   * @param id - Buffer identifier
   * @param size - Buffer size in bytes
   * @param label - Buffer label
   * @returns GPU buffer
   */
  createStorageBuffer(id: string, size: number, label?: string): GPUBuffer {
    return this.createBuffer(id, undefined, {
      size,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
      label: label ?? `${id}-storage`,
    });
  }

  /**
   * Create uniform buffer
   *
   * @param id - Buffer identifier
   * @param size - Buffer size in bytes
   * @param label - Buffer label
   * @returns GPU buffer
   */
  createUniformBuffer(id: string, size: number, label?: string): GPUBuffer {
    return this.createBuffer(id, undefined, {
      size,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label: label ?? `${id}-uniform`,
    });
  }

  /**
   * Create vertex buffer
   *
   * @param id - Buffer identifier
   * @param data - Vertex data
   * @param label - Buffer label
   * @returns GPU buffer
   */
  createVertexBuffer(
    id: string,
    data: Float32Array,
    label?: string
  ): GPUBuffer {
    return this.createBuffer(id, data, {
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      label: label ?? `${id}-vertex`,
    });
  }

  /**
   * Get buffer by ID
   *
   * @param id - Buffer identifier
   * @returns GPU buffer or undefined
   */
  getBuffer(id: string): GPUBuffer | undefined {
    return this.buffers.get(id);
  }

  /**
   * Check if buffer exists
   *
   * @param id - Buffer identifier
   * @returns Whether buffer exists
   */
  hasBuffer(id: string): boolean {
    return this.buffers.has(id);
  }

  /**
   * Destroy buffer
   *
   * @param id - Buffer identifier
   * @param poolable - Whether to pool for reuse (default: false)
   */
  destroyBuffer(id: string, poolable: boolean = false): void {
    const buffer = this.buffers.get(id);
    if (!buffer) {
      return;
    }

    const size = buffer.size;

    if (poolable && this.canPool(size)) {
      // Return to pool
      this.bufferPool.push({
        buffer,
        size,
        usage: buffer.usage,
        lastUsed: Date.now(),
        inUse: false,
        label: id,
      });

      this.stats.pooledBuffers++;
      this.stats.pooledMemory += size;
    } else {
      // Destroy buffer
      buffer.destroy();
      this.context.destroyBuffer(buffer);
      this.stats.deallocations++;
      this.stats.totalMemory -= size;
    }

    // Remove from tracking
    this.buffers.delete(id);
    this.stats.totalBuffers = this.buffers.size;
    this.stats.activeBuffers--;
    this.stats.activeMemory -= size;
  }

  /**
   * Read buffer data from GPU
   *
   * @param id - Buffer identifier
   * @param size - Size to read in bytes
   * @returns Promise resolving to ArrayBuffer
   */
  async readBuffer(id: string, size?: number): Promise<ArrayBuffer> {
    const buffer = this.buffers.get(id);
    if (!buffer) {
      throw new Error(`Buffer not found: ${id}`);
    }

    const readSize = size ?? buffer.size;
    return this.context.readBuffer(buffer, readSize);
  }

  /**
   * Read buffer as Float32Array
   *
   * @param id - Buffer identifier
   * @param count - Number of float32 elements to read
   * @returns Promise resolving to Float32Array
   */
  async readBufferAsFloat32(id: string, count?: number): Promise<Float32Array> {
    const buffer = this.buffers.get(id);
    if (!buffer) {
      throw new Error(`Buffer not found: ${id}`);
    }

    const size = count !== undefined ? count * 4 : buffer.size;
    const data = await this.context.readBuffer(buffer, size);
    return new Float32Array(data.buffer, data.byteOffset, size / 4);
  }

  /**
   * Read buffer as Uint8Array
   *
   * @param id - Buffer identifier
   * @param count - Number of uint8 elements to read
   * @returns Promise resolving to Uint8Array
   */
  async readBufferAsUint8(id: string, count?: number): Promise<Uint8Array> {
    const buffer = this.buffers.get(id);
    if (!buffer) {
      throw new Error(`Buffer not found: ${id}`);
    }

    const size = count ?? buffer.size;
    const data = await this.context.readBuffer(buffer, size);
    return new Uint8Array(data.buffer, data.byteOffset, size);
  }

  /**
   * Write data to buffer
   *
   * @param id - Buffer identifier
   * @param data - Data to write
   * @param offset - Offset in buffer (bytes)
   */
  writeBuffer(
    id: string,
    data: Float32Array | Uint8Array | Int32Array,
    offset: number = 0
  ): void {
    const buffer = this.buffers.get(id);
    if (!buffer) {
      throw new Error(`Buffer not found: ${id}`);
    }

    const device = this.context.getDevice();
    device.queue.writeBuffer(buffer, offset, data);
  }

  /**
   * Copy data between buffers
   *
   * @param srcId - Source buffer ID
   * @param dstId - Destination buffer ID
   * @param size - Size to copy in bytes
   * @param srcOffset - Source offset
   * @param dstOffset - Destination offset
   */
  copyBuffer(
    srcId: string,
    dstId: string,
    size: number,
    srcOffset: number = 0,
    dstOffset: number = 0
  ): void {
    const src = this.buffers.get(srcId);
    const dst = this.buffers.get(dstId);

    if (!src || !dst) {
      throw new Error("Source or destination buffer not found");
    }

    const commandEncoder = this.context.createCommandEncoder("copy-buffer");
    commandEncoder.copyBufferToBuffer(src, srcOffset, dst, dstOffset, size);
    this.context.submit([commandEncoder.finish()]);
  }

  /**
   * Create buffer view
   *
   * @param id - Buffer ID
   * @param offset - Offset in bytes
   * @param size - Size in bytes
   * @returns Buffer view
   */
  createBufferView(id: string, offset: number, size: number): BufferView {
    const buffer = this.buffers.get(id);
    if (!buffer) {
      throw new Error(`Buffer not found: ${id}`);
    }

    return { buffer, offset, size };
  }

  /**
   * Create multiple buffers at once
   *
   * @param configs - Array of {id, data, options}
   * @returns Map of buffer IDs to GPU buffers
   */
  createBuffers(
    configs: Array<{
      id: string;
      data?: Float32Array | Uint8Array;
      options?: Partial<BufferOptions>;
    }>
  ): Map<string, GPUBuffer> {
    const result = new Map<string, GPUBuffer>();

    for (const config of configs) {
      const buffer = this.createBuffer(config.id, config.data, config.options);
      result.set(config.id, buffer);
    }

    return result;
  }

  /**
   * Destroy all buffers
   */
  destroyAllBuffers(): void {
    for (const id of this.buffers.keys()) {
      this.destroyBuffer(id, false);
    }
    this.clearPool();
  }

  /**
   * Get buffer statistics
   *
   * @returns Current statistics
   */
  getStats(): BufferStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics counters
   */
  resetStats(): void {
    this.stats.allocations = 0;
    this.stats.deallocations = 0;
    this.stats.poolHits = 0;
    this.stats.poolMisses = 0;
  }

  /**
   * Clear buffer pool
   */
  clearPool(): void {
    for (const entry of this.bufferPool) {
      entry.buffer.destroy();
      this.context.destroyBuffer(entry.buffer);
      this.stats.deallocations++;
      this.stats.totalMemory -= entry.size;
      this.stats.pooledMemory -= entry.size;
    }

    this.bufferPool = [];
    this.stats.pooledBuffers = 0;
  }

  /**
   * Clean up old pooled buffers
   *
   * @param maxAge - Maximum age in milliseconds (default: 5 minutes)
   */
  cleanupPool(maxAge: number = 5 * 60 * 1000): void {
    const now = Date.now();
    const toRemove: number[] = [];

    for (let i = 0; i < this.bufferPool.length; i++) {
      const entry = this.bufferPool[i];

      if (!entry.inUse && now - entry.lastUsed > maxAge) {
        toRemove.push(i);
      }
    }

    // Remove from end to maintain indices
    for (const idx of toRemove.reverse()) {
      const entry = this.bufferPool.splice(idx, 1)[0];
      entry.buffer.destroy();
      this.context.destroyBuffer(entry.buffer);
      this.stats.deallocations++;
      this.stats.totalMemory -= entry.size;
      this.stats.pooledMemory -= entry.size;
      this.stats.pooledBuffers--;
    }
  }

  /**
   * Pre-allocate buffers for common sizes
   *
   * @param sizes - Array of buffer sizes to pre-allocate
   */
  warmupPool(sizes: number[]): void {
    const device = this.context.getDevice();

    for (const size of sizes) {
      if (this.bufferPool.length >= this.maxPoolSize) {
        break;
      }

      const buffer = device.createBuffer({
        size,
        usage:
          GPUBufferUsage.STORAGE |
          GPUBufferUsage.COPY_DST |
          GPUBufferUsage.COPY_SRC,
        label: `warmup-buffer-${size}`,
        mappedAtCreation: false,
      });

      this.bufferPool.push({
        buffer,
        size,
        usage:
          GPUBufferUsage.STORAGE |
          GPUBufferUsage.COPY_DST |
          GPUBufferUsage.COPY_SRC,
        lastUsed: Date.now(),
        inUse: false,
        label: `warmup-buffer-${size}`,
      });

      this.stats.pooledBuffers++;
      this.stats.pooledMemory += size;
      this.stats.totalMemory += size;
    }
  }

  /**
   * Dispose of buffer manager
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.destroyAllBuffers();
    this.disposed = true;
  }

  /**
   * Get buffer from pool
   *
   * @param size - Required buffer size
   * @param usage - Required usage flags
   * @returns Pooled buffer entry or undefined
   */
  private getFromPool(
    size: number,
    usage: GPUBufferUsageFlags
  ): BufferPoolEntry | undefined {
    // Find available buffer with matching size and usage
    for (let i = 0; i < this.bufferPool.length; i++) {
      const entry = this.bufferPool[i];

      if (
        !entry.inUse &&
        entry.size >= size &&
        (entry.usage & usage) === usage
      ) {
        // Remove from pool
        this.bufferPool.splice(i, 1);
        entry.inUse = true;
        entry.lastUsed = Date.now();

        this.stats.pooledBuffers--;
        this.stats.pooledMemory -= entry.size;

        return entry;
      }
    }

    return undefined;
  }

  /**
   * Check if buffer can be pooled
   *
   * @param size - Buffer size in bytes
   * @returns Whether buffer can be pooled
   */
  private canPool(size: number): boolean {
    return (
      this.bufferPool.length < this.maxPoolSize &&
      this.stats.pooledMemory + size < this.maxPoolMemory
    );
  }
}

/**
 * Tensor buffer for ML operations
 *
 * Specialized buffer for tensor storage with shape information.
 */
export class TensorBuffer {
  private manager: BufferManager;
  private id: string;
  private shape: number[];
  private dtype: ComputeDataType;
  private size: number;

  constructor(
    manager: BufferManager,
    id: string,
    shape: number[],
    dtype: ComputeDataType = "float32"
  ) {
    this.manager = manager;
    this.id = id;
    this.shape = shape;
    this.dtype = dtype;

    // Calculate total size
    this.size = shape.reduce((a, b) => a * b, 1);
    const bytesPerElement = this.getBytesPerElement(dtype);
    this.size *= bytesPerElement;
  }

  /**
   * Allocate tensor buffer
   *
   * @param data - Initial data
   * @returns GPU buffer
   */
  allocate(data?: Float32Array | Uint8Array | Int32Array): GPUBuffer {
    const usage =
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_DST |
      GPUBufferUsage.COPY_SRC;
    return this.manager.createBuffer(this.id, data, { size: this.size, usage });
  }

  /**
   * Read tensor data
   *
   * @returns Promise resolving to tensor data
   */
  async read(): Promise<Float32Array | Uint8Array | Int32Array> {
    const elementCount = this.shape.reduce((a, b) => a * b, 1);

    switch (this.dtype) {
      case "float32":
        return this.manager.readBufferAsFloat32(this.id, elementCount);
      case "uint8":
        return this.manager.readBufferAsUint8(this.id, elementCount);
      default:
        const buffer = await this.manager.readBuffer(this.id, this.size);
        return new Float32Array(buffer.buffer, buffer.byteOffset, elementCount);
    }
  }

  /**
   * Write tensor data
   *
   * @param data - Data to write
   */
  write(data: Float32Array | Uint8Array | Int32Array): void {
    this.manager.writeBuffer(this.id, data);
  }

  /**
   * Get tensor shape
   *
   * @returns Tensor shape
   */
  getShape(): number[] {
    return [...this.shape];
  }

  /**
   * Get tensor size in bytes
   *
   * @returns Size in bytes
   */
  getSize(): number {
    return this.size;
  }

  /**
   * Get tensor data type
   *
   * @returns Data type
   */
  getDtype(): ComputeDataType {
    return this.dtype;
  }

  /**
   * Reshape tensor (creates new view, doesn't reallocate)
   *
   * @param newShape - New shape
   * @returns New TensorBuffer with same underlying buffer
   */
  reshape(newShape: number[]): TensorBuffer {
    const newSize = newShape.reduce((a, b) => a * b, 1);
    const currentSize = this.shape.reduce((a, b) => a * b, 1);

    if (newSize !== currentSize) {
      throw new Error(
        `Cannot reshape: size mismatch (${currentSize} -> ${newSize})`
      );
    }

    return new TensorBuffer(this.manager, this.id, newShape, this.dtype);
  }

  /**
   * Destroy tensor buffer
   */
  destroy(): void {
    this.manager.destroyBuffer(this.id);
  }

  /**
   * Get bytes per element for data type
   */
  private getBytesPerElement(dtype: ComputeDataType): number {
    switch (dtype) {
      case "float32":
      case "int32":
      case "uint32":
        return 4;
      case "float16":
      case "int16":
      case "uint16":
        return 2;
      case "int8":
      case "uint8":
        return 1;
      default:
        return 4;
    }
  }
}

/**
 * Buffer pool configuration
 */
export interface BufferPoolConfig {
  /** Maximum number of pooled buffers */
  maxPoolSize?: number;
  /** Maximum pool memory in bytes */
  maxPoolMemory?: number;
  /** Warmup buffer sizes */
  warmupSizes?: number[];
  /** Cleanup interval in milliseconds */
  cleanupInterval?: number;
}

/**
 * Create buffer manager with configuration
 *
 * @param context - WebGPU context
 * @param config - Pool configuration
 * @returns Configured buffer manager
 */
export function createBufferManager(
  context: WebGPUContext,
  config?: BufferPoolConfig
): BufferManager {
  const manager = new BufferManager(
    context,
    config?.maxPoolSize,
    config?.maxPoolMemory
  );

  // Warmup pool if sizes provided
  if (config?.warmupSizes) {
    manager.warmupPool(config.warmupSizes);
  }

  // Setup periodic cleanup
  if (config?.cleanupInterval) {
    setInterval(() => {
      manager.cleanupPool();
    }, config.cleanupInterval);
  }

  return manager;
}

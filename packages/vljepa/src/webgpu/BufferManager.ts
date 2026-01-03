/**
 * @lsi/vljepa/webgpu/BufferManager - GPU Memory Management for VL-JEPA
 *
 * Manages GPU buffer allocation, deallocation, and data transfer.
 * Provides automatic memory pooling and cleanup for efficient GPU usage.
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

import type { WebGPUContext } from "./WebGPUContext.js";

/**
 * Buffer creation options
 */
export interface BufferOptions {
  /** Buffer usage flags */
  usage: GPUBufferUsageFlags;

  /** Buffer size in bytes */
  size: number;

  /** Buffer label for debugging */
  label?: string;

  /** Whether to map at creation (for write-only buffers) */
  mappedAtCreation?: boolean;

  /** Whether to pool this buffer for reuse */
  poolable?: boolean;
}

/**
 * Buffer pool entry
 */
interface BufferPoolEntry {
  buffer: GPUBuffer;
  size: number;
  usage: GPUBufferUsageFlags;
  lastUsed: number;
  inUse: boolean;
}

/**
 * Buffer statistics
 */
export interface BufferStats {
  totalBuffers: number;
  pooledBuffers: number;
  activeBuffers: number;
  totalMemory: number; // bytes
  pooledMemory: number; // bytes
  activeMemory: number; // bytes
  allocations: number;
  deallocations: number;
  poolHits: number;
  poolMisses: number;
}

/**
 * GPU Buffer Manager
 *
 * Manages GPU buffer allocation with pooling for performance.
 */
export class BufferManager {
  private webgpu: WebGPUContext;
  private buffers: Map<string, GPUBuffer> = new Map();
  private bufferPool: BufferPoolEntry[] = [];
  private stats: BufferStats;
  private maxPoolSize: number = 50; // Maximum number of pooled buffers
  private maxPoolMemory: number = 128 * 1024 * 1024; // 128MB pool limit

  constructor(webgpu: WebGPUContext) {
    this.webgpu = webgpu;

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
    data?: Float32Array | Uint8Array,
    options?: Partial<BufferOptions>
  ): GPUBuffer {
    const device = this.webgpu.getDevice();

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
    } else {
      // Create new buffer
      buffer = device.createBuffer({
        size,
        usage: usage | GPUBufferUsage.COPY_DST,
        mappedAtCreation: data !== undefined,
        label: options?.label ?? id,
      });

      this.stats.allocations++;
      this.stats.totalMemory += size;
      this.stats.poolMisses++;
    }

    // Upload data if provided
    if (data) {
      if (pooled) {
        // For pooled buffers, use writeBuffer
        device.queue.writeBuffer(buffer, 0, data);
      } else {
        // For newly created mapped buffer, copy directly
        new Uint8Array(buffer.getMappedRange()).set(
          data instanceof Float32Array
            ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
            : data
        );
        buffer.unmap();
      }
    }

    // Track buffer
    this.buffers.set(id, buffer);
    this.stats.totalBuffers = this.buffers.size;
    this.stats.activeBuffers++;
    this.stats.activeMemory += size;

    return buffer;
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
   * @param poolable - Whether to pool for reuse (default: from options)
   */
  destroyBuffer(id: string, poolable?: boolean): void {
    const buffer = this.buffers.get(id);
    if (!buffer) {
      return;
    }

    // Check if poolable
    const shouldPool = poolable ?? false;
    const size = buffer.size;

    if (shouldPool && this.canPool(size)) {
      // Return to pool
      this.bufferPool.push({
        buffer,
        size,
        usage: buffer.usage,
        lastUsed: Date.now(),
        inUse: false,
      });

      this.stats.pooledBuffers++;
      this.stats.pooledMemory += size;
    } else {
      // Destroy buffer
      buffer.destroy();
      this.webgpu.destroyBuffer(buffer);
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
   * @returns Promise resolving to Float32Array
   */
  async readBuffer(id: string, size?: number): Promise<Float32Array> {
    const buffer = this.buffers.get(id);
    if (!buffer) {
      throw new Error(`Buffer not found: ${id}`);
    }

    const readSize = size ?? buffer.size;
    const data = await this.webgpu.readBuffer(buffer, readSize);

    return new Float32Array(data.buffer, data.byteOffset, readSize / 4);
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
    data: Float32Array | Uint8Array,
    offset: number = 0
  ): void {
    const buffer = this.buffers.get(id);
    if (!buffer) {
      throw new Error(`Buffer not found: ${id}`);
    }

    const device = this.webgpu.getDevice();
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

    const commandEncoder = this.webgpu.createCommandEncoder("copy-buffer");
    commandEncoder.copyBufferToBuffer(src, srcOffset, dst, dstOffset, size);
    this.webgpu.submit([commandEncoder.finish()]);
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
      this.webgpu.destroyBuffer(entry.buffer);
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
      this.webgpu.destroyBuffer(entry.buffer);
      this.stats.deallocations++;
      this.stats.totalMemory -= entry.size;
      this.stats.pooledMemory -= entry.size;
      this.stats.pooledBuffers--;
    }
  }

  /**
   * Dispose of buffer manager
   */
  dispose(): void {
    this.destroyAllBuffers();
    this.clearPool();
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
 * Buffer allocation helper for tensor storage
 */
export class TensorBuffer {
  private manager: BufferManager;
  private id: string;
  private shape: number[];
  private dtype: "float32" | "float16";
  private size: number;

  constructor(
    manager: BufferManager,
    id: string,
    shape: number[],
    dtype: "float32" | "float16" = "float32"
  ) {
    this.manager = manager;
    this.id = id;
    this.shape = shape;
    this.dtype = dtype;

    // Calculate total size
    this.size = shape.reduce((a, b) => a * b, 1);
    if (dtype === "float16") {
      this.size *= 2; // 2 bytes per float16
    } else {
      this.size *= 4; // 4 bytes per float32
    }
  }

  /**
   * Allocate tensor buffer
   *
   * @param data - Initial data
   * @returns GPU buffer
   */
  allocate(data?: Float32Array): GPUBuffer {
    const usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
    return this.manager.createBuffer(this.id, data, { size: this.size, usage });
  }

  /**
   * Read tensor data
   *
   * @returns Promise resolving to tensor data
   */
  async read(): Promise<Float32Array> {
    const readSize = this.shape.reduce((a, b) => a * b, 1);
    return this.manager.readBuffer(this.id, readSize * 4);
  }

  /**
   * Write tensor data
   *
   * @param data - Data to write
   */
  write(data: Float32Array): void {
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
   * Destroy tensor buffer
   */
  destroy(): void {
    this.manager.destroyBuffer(this.id);
  }
}

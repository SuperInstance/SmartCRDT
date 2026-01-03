/**
 * @lsi/webgpu-examples/utils/BufferUtils
 *
 * GPU buffer creation and management utilities.
 */

/**
 * Buffer creation options
 */
export interface BufferOptions {
  /** Buffer usage flags */
  usage?: GPUBufferUsageFlags;
  /** Label for debugging */
  label?: string;
  /** Map at creation for write */
  mappedAtCreation?: boolean;
}

/**
 * Create a GPU buffer
 *
 * @param device - GPU device
 * @param size - Buffer size in bytes
 * @param usage - Buffer usage flags
 * @param label - Optional label
 * @returns GPU buffer
 */
export function createBuffer(
  device: GPUDevice,
  size: number,
  usage: GPUBufferUsageFlags,
  label?: string
): GPUBuffer {
  return device.createBuffer({
    size,
    usage,
    label
  });
}

/**
 * Create a storage buffer
 *
 * @param device - GPU device
 * @param size - Buffer size in bytes
 * @param label - Optional label
 * @returns Storage buffer
 */
export function createStorageBuffer(
  device: GPUDevice,
  size: number,
  label?: string
): GPUBuffer {
  return createBuffer(device, size, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, label);
}

/**
 * Create a uniform buffer
 *
 * @param device - GPU device
 * @param size - Buffer size in bytes
 * @param label - Optional label
 * @returns Uniform buffer
 */
export function createUniformBuffer(
  device: GPUDevice,
  size: number,
  label?: string
): GPUBuffer {
  return createBuffer(device, size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, label);
}

/**
 * Create a staging buffer for readback
 *
 * @param device - GPU device
 * @param size - Buffer size in bytes
 * @param label - Optional label
 * @returns Staging buffer
 */
export function createStagingBuffer(
  device: GPUDevice,
  size: number,
  label?: string
): GPUBuffer {
  return createBuffer(
    device,
    size,
    GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_READ,
    label
  );
}

/**
 * Write data to a buffer
 *
 * @param device - GPU device
 * @param buffer - Buffer to write to
 * @param data - Data to write
 * @param offset - Optional offset in buffer
 */
export function writeBuffer(
  device: GPUDevice,
  buffer: GPUBuffer,
  data: BufferSource,
  offset: number = 0
): void {
  device.queue.writeBuffer(buffer, offset, data);
}

/**
 * Write an array to a buffer
 *
 * @param device - GPU device
 * @param buffer - Buffer to write to
 * @param array - Typed array to write
 * @param offset - Optional offset in buffer
 */
export function writeArray<T extends ArrayBufferView>(
  device: GPUDevice,
  buffer: GPUBuffer,
  array: T,
  offset: number = 0
): void {
  writeBuffer(device, buffer, array.buffer, offset);
}

/**
 * Read data from a buffer
 *
 * @param device - GPU device
 * @param buffer - Buffer to read from
 * @param size - Size to read in bytes
 * @returns Promise resolving to array buffer
 */
export async function readBuffer(
  device: GPUDevice,
  buffer: GPUBuffer,
  size: number
): Promise<ArrayBuffer> {
  // Create staging buffer
  const stagingBuffer = createStagingBuffer(device, size);

  // Copy to staging buffer
  const commandEncoder = device.createCommandEncoder();
  commandEncoder.copyBufferToBuffer(buffer, 0, stagingBuffer, 0, size);
  device.queue.submit([commandEncoder.finish()]);

  // Map and read
  await stagingBuffer.mapAsync(GPUMapMode.READ);
  const data = stagingBuffer.getMappedRange().slice(0);
  stagingBuffer.unmap();
  stagingBuffer.destroy();

  return data;
}

/**
 * Read a typed array from a buffer
 *
 * @param device - GPU device
 * @param buffer - Buffer to read from
 * @param type - Typed array constructor
 * @param count - Number of elements to read
 * @returns Promise resolving to typed array
 */
export async function readArray<T extends ArrayBufferView>(
  device: GPUDevice,
  buffer: GPUBuffer,
  type: new (buffer: ArrayBuffer, byteOffset?: number, length?: number) => T,
  count: number
): Promise<T> {
  const elementSize = type.BYTES_PER_ELEMENT;
  const size = elementSize * count;
  const data = await readBuffer(device, buffer, size);
  return new type(data);
}

/**
 * Copy data between buffers
 *
 * @param device - GPU device
 * @param src - Source buffer
 * @param dst - Destination buffer
 * @param size - Size to copy in bytes
 * @param srcOffset - Source offset
 * @param dstOffset - Destination offset
 */
export function copyBuffer(
  device: GPUDevice,
  src: GPUBuffer,
  dst: GPUBuffer,
  size: number,
  srcOffset: number = 0,
  dstOffset: number = 0
): void {
  const commandEncoder = device.createCommandEncoder();
  commandEncoder.copyBufferToBuffer(src, srcOffset, dst, dstOffset, size);
  device.queue.submit([commandEncoder.finish()]);
}

/**
 * Create a buffer from typed array data
 *
 * @param device - GPU device
 * @param data - Typed array data
 * @param usage - Buffer usage flags
 * @param label - Optional label
 * @returns GPU buffer with data written
 */
export function createBufferFromData<T extends ArrayBufferView>(
  device: GPUDevice,
  data: T,
  usage: GPUBufferUsageFlags,
  label?: string
): GPUBuffer {
  const buffer = createBuffer(device, data.byteLength, usage, label);
  writeArray(device, buffer, data);
  return buffer;
}

/**
 * Create a storage buffer from typed array
 *
 * @param device - GPU device
 * @param data - Typed array data
 * @param label - Optional label
 * @returns Storage buffer with data
 */
export function createStorageFromData<T extends ArrayBufferView>(
  device: GPUDevice,
  data: T,
  label?: string
): GPUBuffer {
  return createBufferFromData(
    device,
    data,
    GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    label
  );
}

/**
 * Destroy a buffer
 *
 * @param buffer - Buffer to destroy
 */
export function destroyBuffer(buffer: GPUBuffer): void {
  buffer.destroy();
}

/**
 * Calculate buffer size for given type and count
 *
 * @param type - Typed array constructor
 * @param count - Number of elements
 * @returns Size in bytes
 */
export function calculateBufferSize<T extends ArrayBufferView>(
  type: new (...args: any[]) => T,
  count: number
): number {
  const dummy = new type(1);
  return dummy.byteLength * count;
}

/**
 * Create multiple buffers at once
 *
 * @param device - GPU device
 * @param configs - Array of buffer configurations
 * @returns Array of GPU buffers
 */
export function createBuffers(
  device: GPUDevice,
  configs: Array<{ size: number; usage: GPUBufferUsageFlags; label?: string }>
): GPUBuffer[] {
  return configs.map(config => createBuffer(device, config.size, config.usage, config.label));
}

/**
 * Buffer pool for reusing buffers
 */
export class BufferPool {
  private device: GPUDevice;
  private pools: Map<number, GPUBuffer[]> = new Map();
  private maxPoolSize: number;

  constructor(device: GPUDevice, maxPoolSize: number = 10) {
    this.device = device;
    this.maxPoolSize = maxPoolSize;
  }

  /**
   * Acquire a buffer from the pool
   *
   * @param size - Buffer size in bytes
   * @param usage - Buffer usage flags
   * @returns Buffer from pool or newly created
   */
  acquire(size: number, usage: GPUBufferUsageFlags): GPUBuffer {
    const key = size;
    const pool = this.pools.get(key);

    if (pool && pool.length > 0) {
      return pool.pop()!;
    }

    return createBuffer(this.device, size, usage);
  }

  /**
   * Release a buffer back to the pool
   *
   * @param buffer - Buffer to release
   */
  release(buffer: GPUBuffer): void {
    const size = buffer.size;
    const key = size;
    let pool = this.pools.get(key);

    if (!pool) {
      pool = [];
      this.pools.set(key, pool);
    }

    if (pool.length < this.maxPoolSize) {
      pool.push(buffer);
    } else {
      buffer.destroy();
    }
  }

  /**
   * Clear all pools
   */
  clear(): void {
    for (const pool of this.pools.values()) {
      for (const buffer of pool) {
        buffer.destroy();
      }
    }
    this.pools.clear();
  }

  /**
   * Get pool statistics
   */
  getStats(): { totalBuffers: number; poolSizes: Record<number, number> } {
    const poolSizes: Record<number, number> = {};
    let totalBuffers = 0;

    for (const [size, pool] of this.pools.entries()) {
      poolSizes[size] = pool.length;
      totalBuffers += pool.length;
    }

    return { totalBuffers, poolSizes };
  }
}

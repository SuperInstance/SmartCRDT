/**
 * @lsi/webgpu-multi - Data Distributor
 *
 * Distributes data across multiple GPU devices and gathers results.
 */

import type { GPUDevice, DataDistribution, ArrayBuffer } from "./types.js";

/**
 * Data Distributor for multi-GPU data management
 */
export class DataDistributor {
  private dataChunks: Map<string, ArrayBuffer[]> = new Map();
  private replicationCache: Map<string, Map<string, ArrayBuffer>> = new Map();

  /**
   * Split data into chunks for distribution across devices
   */
  splitData(
    data: ArrayBuffer,
    deviceCount: number,
    alignment: number = 64
  ): ArrayBuffer[] {
    const chunks: ArrayBuffer[] = [];
    const totalBytes = data.byteLength;
    const bytesPerDevice = Math.ceil(totalBytes / deviceCount);

    // Align chunk size
    const alignedBytesPerDevice =
      Math.ceil(bytesPerDevice / alignment) * alignment;

    for (let i = 0; i < deviceCount; i++) {
      const start = i * alignedBytesPerDevice;
      const end = Math.min(start + alignedBytesPerDevice, totalBytes);
      const chunkSize = end - start;

      if (chunkSize <= 0) {
        chunks.push(new ArrayBuffer(0));
        continue;
      }

      const chunk = data.slice(start, end);
      chunks.push(chunk);
    }

    return chunks;
  }

  /**
   * Split data into chunks of specific size
   */
  splitDataBySize(
    data: ArrayBuffer,
    chunkSize: number,
    alignment: number = 64
  ): ArrayBuffer[] {
    const chunks: ArrayBuffer[] = [];
    const alignedChunkSize = Math.ceil(chunkSize / alignment) * alignment;
    const totalBytes = data.byteLength;

    for (let offset = 0; offset < totalBytes; offset += alignedChunkSize) {
      const end = Math.min(offset + alignedChunkSize, totalBytes);
      const chunk = data.slice(offset, end);
      chunks.push(chunk);
    }

    return chunks;
  }

  /**
   * Create a data distribution
   */
  createDistribution(
    data: ArrayBuffer,
    devices: GPUDevice[],
    replicate: boolean = false,
    alignment: number = 64
  ): DataDistribution {
    const chunks = this.splitData(data, devices.length, alignment);

    const distribution: DataDistribution = {
      chunks,
      assignments: devices,
      replicate,
      replicationFactor: replicate ? Math.min(devices.length, 2) : 1,
      alignment,
    };

    return distribution;
  }

  /**
   * Distribute data to devices (upload to GPU)
   */
  async distributeToDevices(
    distribution: DataDistribution
  ): Promise<Map<string, GPUBuffer>> {
    const buffers = new Map<string, GPUBuffer>();

    for (let i = 0; i < distribution.chunks.length; i++) {
      const chunk = distribution.chunks[i];
      const device = distribution.assignments[i];

      if (chunk.byteLength === 0) continue;

      // Create buffer and upload data
      const buffer = device.device.createBuffer({
        size: chunk.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
      });

      new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(chunk));
      buffer.unmap();

      buffers.set(device.device_id, buffer);
    }

    return buffers;
  }

  /**
   * Gather data from devices (download from GPU)
   */
  async gatherFromDevices(
    devices: GPUDevice[],
    buffers: Map<string, GPUBuffer>
  ): Promise<ArrayBuffer> {
    const chunks: ArrayBuffer[] = [];

    for (const device of devices) {
      const buffer = buffers.get(device.device_id);
      if (!buffer) continue;

      // Read back buffer
      const readBuffer = device.device.createBuffer({
        size: buffer.size,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });

      const commandEncoder = device.device.createCommandEncoder();
      commandEncoder.copyBufferToBuffer(buffer, 0, readBuffer, 0, buffer.size);

      device.device.queue.submit([commandEncoder.finish()]);
      await device.device.queue.onSubmittedWorkDone();

      await readBuffer.mapAsync(GPUMapMode.READ);
      const chunk = readBuffer.getMappedRange().slice(0);
      readBuffer.unmap();

      chunks.push(chunk);
    }

    // Concatenate chunks
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const result = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }

    return result.buffer;
  }

  /**
   * Replicate data across multiple devices
   */
  async replicateData(
    data: ArrayBuffer,
    devices: GPUDevice[],
    replicationFactor: number = 2
  ): Promise<Map<string, GPUBuffer>> {
    const buffers = new Map<string, GPUBuffer>();

    // Replicate to first N devices
    const replicateTo = devices.slice(0, replicationFactor);

    for (const device of replicateTo) {
      const buffer = device.device.createBuffer({
        size: data.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
      });

      new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(data));
      buffer.unmap();

      buffers.set(device.device_id, buffer);
    }

    return buffers;
  }

  /**
   * Create distributed buffers
   */
  createDistributedBuffers(
    sizes: number[],
    devices: GPUDevice[],
    usage: GPUBufferUsageFlags = GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_DST
  ): Map<string, GPUBuffer[]> {
    const buffers = new Map<string, GPUBuffer[]>();

    for (let i = 0; i < devices.length; i++) {
      const device = devices[i];
      const deviceBuffers: GPUBuffer[] = [];

      for (const size of sizes) {
        const buffer = device.device.createBuffer({
          size,
          usage,
        });
        deviceBuffers.push(buffer);
      }

      buffers.set(device.device_id, deviceBuffers);
    }

    return buffers;
  }

  /**
   * Create shared buffers (if peer access is supported)
   */
  createSharedBuffer(
    size: number,
    devices: GPUDevice[],
    usage: GPUBufferUsageFlags = GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_DST
  ): GPUBuffer | null {
    // WebGPU doesn't have true shared buffers
    // Create on first device and plan for copies
    const primaryDevice = devices[0];
    return primaryDevice.device.createBuffer({ size, usage });
  }

  /**
   * Transfer data between devices
   */
  async transferBetweenDevices(
    data: ArrayBuffer,
    fromDevice: GPUDevice,
    toDevice: GPUDevice
  ): Promise<GPUBuffer> {
    // Create source buffer
    const sourceBuffer = fromDevice.device.createBuffer({
      size: data.byteLength,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
      mappedAtCreation: true,
    });
    new Uint8Array(sourceBuffer.getMappedRange()).set(new Uint8Array(data));
    sourceBuffer.unmap();

    // Create destination buffer
    const destBuffer = toDevice.device.createBuffer({
      size: data.byteLength,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    });

    // Use staging buffer for transfer
    const stagingBuffer = fromDevice.device.createBuffer({
      size: data.byteLength,
      usage:
        GPUBufferUsage.MAP_READ |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    });

    // Copy to staging
    const copyEncoder = fromDevice.device.createCommandEncoder();
    copyEncoder.copyBufferToBuffer(
      sourceBuffer,
      0,
      stagingBuffer,
      0,
      data.byteLength
    );
    fromDevice.device.queue.submit([copyEncoder.finish()]);
    await fromDevice.device.queue.onSubmittedWorkDone();

    // Map staging and copy to destination
    await stagingBuffer.mapAsync(GPUMapMode.READ);
    const stagingData = stagingBuffer.getMappedRange().slice(0);
    stagingBuffer.unmap();

    // Upload to destination
    const destBufferMapped = toDevice.device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Uint8Array(destBufferMapped.getMappedRange()).set(
      new Uint8Array(stagingData)
    );
    destBufferMapped.unmap();

    return destBufferMapped;
  }

  /**
   * Broadcast data to all devices
   */
  async broadcastToAll(
    data: ArrayBuffer,
    devices: GPUDevice[]
  ): Promise<Map<string, GPUBuffer>> {
    const buffers = new Map<string, GPUBuffer>();

    for (const device of devices) {
      const buffer = device.device.createBuffer({
        size: data.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
      });

      new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(data));
      buffer.unmap();

      buffers.set(device.device_id, buffer);
    }

    return buffers;
  }

  /**
   * Scatter data to devices
   */
  async scatterData(
    data: ArrayBuffer[],
    devices: GPUDevice[]
  ): Promise<Map<string, GPUBuffer>> {
    const buffers = new Map<string, GPUBuffer>();

    for (let i = 0; i < Math.min(data.length, devices.length); i++) {
      const chunk = data[i];
      const device = devices[i];

      const buffer = device.device.createBuffer({
        size: chunk.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
      });

      new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(chunk));
      buffer.unmap();

      buffers.set(device.device_id, buffer);
    }

    return buffers;
  }

  /**
   * Gather scattered data from devices
   */
  async gatherScatteredData(
    devices: GPUDevice[],
    bufferMap: Map<string, GPUBuffer>
  ): Promise<Map<string, ArrayBuffer>> {
    const results = new Map<string, ArrayBuffer>();

    for (const device of devices) {
      const buffer = bufferMap.get(device.device_id);
      if (!buffer) continue;

      const readBuffer = device.device.createBuffer({
        size: buffer.size,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });

      const commandEncoder = device.device.createCommandEncoder();
      commandEncoder.copyBufferToBuffer(buffer, 0, readBuffer, 0, buffer.size);
      device.device.queue.submit([commandEncoder.finish()]);
      await device.device.queue.onSubmittedWorkDone();

      await readBuffer.mapAsync(GPUMapMode.READ);
      const data = readBuffer.getMappedRange().slice(0);
      readBuffer.unmap();

      results.set(device.device_id, data);
    }

    return results;
  }

  /**
   * Reduce data from all devices (sum)
   */
  async reduceSum(
    devices: GPUDevice[],
    buffers: Map<string, GPUBuffer>,
    targetDevice: GPUDevice
  ): Promise<GPUBuffer> {
    // Gather all data first
    const gathered = await this.gatherFromDevices(devices, buffers);

    // Perform sum reduction on CPU (simplified)
    const data = new Float32Array(gathered);
    const reduced = new Float32Array(data.length / devices.length);

    for (let i = 0; i < reduced.length; i++) {
      reduced[i] = 0;
      for (let d = 0; d < devices.length; d++) {
        reduced[i] += data[i + d * reduced.length] || 0;
      }
    }

    // Upload to target device
    const result = targetDevice.device.createBuffer({
      size: reduced.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });

    new Float32Array(result.getMappedRange()).set(reduced);
    result.unmap();

    return result;
  }

  /**
   * Free distributed buffers
   */
  freeBuffers(buffers: Map<string, GPUBuffer>): void {
    for (const buffer of buffers.values()) {
      buffer.destroy();
    }
    buffers.clear();
  }

  /**
   * Cache replicated data
   */
  cacheReplicatedData(key: string, data: Map<string, ArrayBuffer>): void {
    this.replicationCache.set(key, data);
  }

  /**
   * Get cached replicated data
   */
  getCachedData(key: string): Map<string, ArrayBuffer> | undefined {
    return this.replicationCache.get(key);
  }

  /**
   * Clear replication cache
   */
  clearCache(): void {
    this.replicationCache.clear();
  }

  /**
   * Calculate optimal chunk size based on data and devices
   */
  calculateOptimalChunkSize(
    dataSize: number,
    deviceCount: number,
    alignment: number = 64
  ): number {
    const baseSize = Math.ceil(dataSize / deviceCount);
    return Math.ceil(baseSize / alignment) * alignment;
  }

  /**
   * Validate data distribution
   */
  validateDistribution(distribution: DataDistribution): boolean {
    if (distribution.chunks.length !== distribution.assignments.length) {
      return false;
    }

    let totalSize = 0;
    for (const chunk of distribution.chunks) {
      totalSize += chunk.byteLength;
    }

    return totalSize > 0;
  }
}

/**
 * Default data distributor instance
 */
export const defaultDataDistributor = new DataDistributor();

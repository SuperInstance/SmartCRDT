/**
 * @lsi/webgpu-memory - Buffer Transfer
 *
 * Optimized data upload/download between host and device memory.
 * Uses staging buffers for efficient transfers.
 */

import type { TransferOptions, StagingBuffer } from "./types.js";
import { GPUDevice, GPUBuffer, GPUBufferUsage, GPUMapMode } from "./types.js";

/**
 * Default transfer options
 */
const DEFAULT_TRANSFER_OPTIONS: TransferOptions = {
  useStaging: true,
  stagingSize: 4 * 1024 * 1024, // 4MB
  wait: true,
  timeout: 5000,
};

/**
 * Handles data transfer between host and GPU
 */
export class BufferTransfer {
  private device: GPUDevice;
  private stagingBuffers: StagingBuffer[] = [];
  private maxStagingBuffers: number = 4;
  private stagingBufferSize: number;
  private options: TransferOptions;

  constructor(device: GPUDevice, options?: Partial<TransferOptions>) {
    this.device = device;
    this.options = { ...DEFAULT_TRANSFER_OPTIONS, ...options };
    this.stagingBufferSize = this.options.stagingSize!;
  }

  /**
   * Upload data to GPU buffer
   */
  async uploadToGPU(
    buffer: GPUBuffer,
    data: ArrayBufferView | ArrayBuffer,
    offset: number = 0
  ): Promise<void> {
    const byteLength =
      data instanceof ArrayBuffer ? data.byteLength : data.byteLength;

    // Write directly for small transfers
    if (!this.options.useStaging || byteLength < 4096) {
      this.device.queue.writeBuffer(buffer, offset, data);
      return;
    }

    // Use staging buffer for large transfers
    const staging = this.getStagingBuffer(byteLength);
    this.device.queue.writeBuffer(staging.buffer, 0, data);

    // Copy from staging to destination
    const commandEncoder = this.device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(
      staging.buffer,
      0,
      buffer,
      offset,
      byteLength
    );

    const commands = commandEncoder.finish();
    this.device.queue.submit([commands]);

    // Wait for completion if requested
    if (this.options.wait) {
      await this.waitForCompletion();
    }

    this.releaseStagingBuffer(staging);
  }

  /**
   * Download data from GPU buffer
   */
  async downloadFromGPU(
    buffer: GPUBuffer,
    size: number,
    offset: number = 0
  ): Promise<ArrayBuffer> {
    // Create staging buffer for download
    const staging = this.device.createBuffer({
      size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      mappedAtCreation: false,
    });

    // Copy from GPU to staging
    const commandEncoder = this.device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(buffer, offset, staging, 0, size);

    const commands = commandEncoder.finish();
    this.device.queue.submit([commands]);

    // Map staging buffer and read data
    await staging.mapAsync(GPUMapMode.READ);
    const data = staging.getMappedRange().slice(0);

    staging.unmap();
    staging.destroy();

    return data;
  }

  /**
   * Buffer-to-buffer copy
   */
  copyBuffer(
    srcBuffer: GPUBuffer,
    dstBuffer: GPUBuffer,
    size: number,
    srcOffset: number = 0,
    dstOffset: number = 0
  ): void {
    const commandEncoder = this.device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(
      srcBuffer,
      srcOffset,
      dstBuffer,
      dstOffset,
      size
    );

    const commands = commandEncoder.finish();
    this.device.queue.submit([commands]);
  }

  /**
   * Upload to multiple buffers at once
   */
  async uploadBatch(
    uploads: Array<{
      buffer: GPUBuffer;
      data: ArrayBufferView;
      offset?: number;
    }>
  ): Promise<void> {
    const commandEncoder = this.device.createCommandEncoder();

    for (const upload of uploads) {
      const byteLength = upload.data.byteLength;
      const staging = this.getStagingBuffer(byteLength);

      this.device.queue.writeBuffer(staging.buffer, 0, upload.data);

      commandEncoder.copyBufferToBuffer(
        staging.buffer,
        0,
        upload.buffer,
        upload.offset || 0,
        byteLength
      );

      this.releaseStagingBuffer(staging);
    }

    const commands = commandEncoder.finish();
    this.device.queue.submit([commands]);

    if (this.options.wait) {
      await this.waitForCompletion();
    }
  }

  /**
   * Get staging buffer from pool
   */
  private getStagingBuffer(size: number): StagingBuffer {
    // Find available staging buffer
    for (const staging of this.stagingBuffers) {
      if (!staging.inUse && staging.size >= size) {
        staging.inUse = true;
        staging.lastUsed = Date.now();
        return staging;
      }
    }

    // Create new staging buffer
    const stagingSize = Math.max(size, this.stagingBufferSize);
    const buffer = this.device.createBuffer({
      size: stagingSize,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    const staging: StagingBuffer = {
      buffer,
      inUse: true,
      size: stagingSize,
      lastUsed: Date.now(),
    };

    this.stagingBuffers.push(staging);

    // Limit number of staging buffers
    if (this.stagingBuffers.length > this.maxStagingBuffers) {
      this.cleanupStagingBuffers();
    }

    return staging;
  }

  /**
   * Release staging buffer back to pool
   */
  private releaseStagingBuffer(staging: StagingBuffer): void {
    staging.inUse = false;
  }

  /**
   * Cleanup unused staging buffers
   */
  private cleanupStagingBuffers(): void {
    const now = Date.now();
    const maxAge = 30000; // 30 seconds

    this.stagingBuffers = this.stagingBuffers.filter(staging => {
      if (!staging.inUse && now - staging.lastUsed > maxAge) {
        staging.buffer.destroy();
        return false;
      }
      return true;
    });
  }

  /**
   * Wait for GPU operations to complete
   */
  async waitForCompletion(): Promise<void> {
    // TODO: Use proper fence/checkpoint when available
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  /**
   * Destroy transfer manager
   */
  destroy(): void {
    for (const staging of this.stagingBuffers) {
      staging.buffer.destroy();
    }
    this.stagingBuffers = [];
  }
}

/**
 * Streaming upload for large datasets
 */
export class StreamingUploader {
  private device: GPUDevice;
  private transfer: BufferTransfer;
  private chunkSize: number;

  constructor(device: GPUDevice, chunkSize: number = 1024 * 1024) {
    this.device = device;
    this.chunkSize = chunkSize;
    this.transfer = new BufferTransfer(device);
  }

  /**
   * Upload data in chunks
   */
  async uploadChunked(
    buffer: GPUBuffer,
    data: Uint8Array,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const totalChunks = Math.ceil(data.length / this.chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * this.chunkSize;
      const end = Math.min(start + this.chunkSize, data.length);
      const chunk = data.slice(start, end);

      await this.transfer.uploadToGPU(buffer, chunk, start);

      if (onProgress) {
        onProgress((i + 1) / totalChunks);
      }
    }
  }

  destroy(): void {
    this.transfer.destroy();
  }
}

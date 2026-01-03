/**
 * @lsi/webgpu-examples/getting-started/03-buffer-operations
 *
 * Buffer Operations - Buffer read, write, and copy operations.
 * This example demonstrates how to:
 * - Create various types of buffers
 * - Write data to buffers
 * - Read data from buffers
 * - Copy data between buffers
 */

import { initializeWebGPU, getDefaultConfig, disposeWebGPU } from '../utils/WebGPUUtils.js';
import {
  createStorageBuffer,
  createUniformBuffer,
  createStagingBuffer,
  writeBuffer,
  readBuffer,
  copyBuffer
} from '../utils/BufferUtils.js';

/**
 * Buffer operations example
 *
 * @returns Promise resolving to operation results
 */
export async function bufferOperations(): Promise<{
  writeSuccess: boolean;
  readSuccess: boolean;
  copySuccess: boolean;
  data: Float32Array;
}> {
  // Initialize WebGPU
  const config = getDefaultConfig();
  const result = await initializeWebGPU(config);

  if (!result.success || !result.device) {
    throw new Error(`Failed to initialize WebGPU: ${result.error}`);
  }

  const device = result.device;
  const data = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);
  let writeSuccess = false;
  let readSuccess = false;
  let copySuccess = false;

  try {
    // 1. Create storage buffer and write data
    const storageBuffer = createStorageBuffer(device, data.byteLength, 'storage-buffer');
    writeBuffer(device, storageBuffer, data);
    writeSuccess = true;
    console.log('Write operation successful');

    // 2. Read data from buffer
    const readData = await readBuffer(device, storageBuffer, data.byteLength);
    const readArray = new Float32Array(readData);
    readSuccess = true;
    console.log('Read data:', readArray);

    // 3. Create another buffer and copy data
    const targetBuffer = createStorageBuffer(device, data.byteLength, 'target-buffer');
    copyBuffer(device, storageBuffer, targetBuffer, data.byteLength);
    copySuccess = true;
    console.log('Copy operation successful');

    // Verify copy
    const copiedData = await readBuffer(device, targetBuffer, data.byteLength);
    const copiedArray = new Float32Array(copiedData);
    console.log('Copied data:', copiedArray);

    // Clean up
    storageBuffer.destroy();
    targetBuffer.destroy();
  } finally {
    disposeWebGPU(device);
  }

  return { writeSuccess, readSuccess, copySuccess, data };
}

/**
 * Run buffer operations example
 */
export async function runBufferOperations(): Promise<void> {
  const results = await bufferOperations();

  console.log('\n=== Buffer Operations Results ===');
  console.log('Write Success:', results.writeSuccess);
  console.log('Read Success:', results.readSuccess);
  console.log('Copy Success:', results.copySuccess);
  console.log('Data:', results.data);
}

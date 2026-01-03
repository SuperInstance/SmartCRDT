/**
 * @lsi/webgpu-examples/getting-started/01-hello-webgpu
 *
 * Hello WebGPU - Basic WebGPU setup and initialization.
 * This example demonstrates how to:
 * - Check WebGPU availability
 * - Initialize WebGPU device
 * - Display adapter information
 */

import {
  isWebGPUAvailable,
  initializeWebGPU,
  getDefaultConfig,
  formatAdapterInfo,
  disposeWebGPU
} from '../utils/WebGPUUtils.js';

/**
 * Hello WebGPU example
 *
 * @returns Promise resolving to success status and info
 */
export async function helloWebGPU(): Promise<{
  success: boolean;
  message: string;
  adapterInfo?: string;
}> {
  console.log('Hello WebGPU!');

  // Check WebGPU availability
  if (!isWebGPUAvailable()) {
    return {
      success: false,
      message: 'WebGPU is not supported in this browser. ' +
               'Please use Chrome 113+, Edge 113+, or Firefox Nightly.'
    };
  }

  console.log('WebGPU is supported!');

  // Initialize WebGPU
  const config = getDefaultConfig();
  const result = await initializeWebGPU(config);

  if (!result.success || !result.device || !result.adapterInfo) {
    return {
      success: false,
      message: `Failed to initialize WebGPU: ${result.error}`
    };
  }

  console.log('WebGPU initialized successfully!');
  console.log(formatAdapterInfo(result.adapterInfo));

  const adapterInfo = formatAdapterInfo(result.adapterInfo);

  // Clean up
  disposeWebGPU(result.device);

  return {
    success: true,
    message: 'WebGPU initialized successfully!',
    adapterInfo
  };
}

/**
 * Run the example in a browser environment
 */
export async function runHelloWebGPU(): Promise<void> {
  const result = await helloWebGPU();

  if (result.success) {
    console.log(result.message);
    console.log(result.adapterInfo);
  } else {
    console.error(result.message);
  }
}

// For Node.js compatibility (non-browser environments)
if (typeof navigator === 'undefined') {
  (globalThis as any).navigator = {
    gpu: null
  };
}

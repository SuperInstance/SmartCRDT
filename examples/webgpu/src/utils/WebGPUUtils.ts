/**
 * @lsi/webgpu-examples/utils/WebGPUUtils
 *
 * WebGPU initialization and utility functions.
 * Provides helpers for device initialization, feature detection, and common operations.
 */

/**
 * WebGPU configuration options
 */
export interface WebGPUConfig {
  /** Power preference for adapter selection */
  powerPreference?: 'high-performance' | 'low-power';

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
 * Check if WebGPU is available in the current browser
 *
 * @returns True if WebGPU is supported
 */
export function isWebGPUAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

/**
 * Initialize WebGPU with the given configuration
 *
 * @param config - WebGPU configuration
 * @returns Initialization result
 */
export async function initializeWebGPU(config: WebGPUConfig = {}): Promise<WebGPUInitResult> {
  // Check WebGPU support
  if (!isWebGPUAvailable()) {
    return {
      success: false,
      error: 'WebGPU is not supported in this browser. ' +
             'Please use Chrome 113+, Edge 113+, or Firefox Nightly.'
    };
  }

  try {
    // Request GPU adapter
    const adapterDescriptor: GPURequestAdapterOptions = {
      powerPreference: config.powerPreference || 'high-performance'
    };

    const adapter = await navigator.gpu!.requestAdapter(adapterDescriptor);

    if (!adapter) {
      return {
        success: false,
        error: 'No GPU adapter found. Your GPU may not support WebGPU.'
      };
    }

    // Get adapter info
    const adapterInfo = await adapter.requestAdapterInfo();

    // Request device
    const deviceDescriptor: GPUDeviceDescriptor = {
      requiredFeatures: config.requiredFeatures,
      requiredLimits: config.requiredLimits
    };

    const device = await adapter.requestDevice(deviceDescriptor);

    return {
      success: true,
      device,
      adapter,
      adapterInfo
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Get GPU adapter information as a readable string
 *
 * @param adapterInfo - Adapter info from WebGPU
 * @returns Formatted adapter information
 */
export function formatAdapterInfo(adapterInfo: GPUAdapterInfo): string {
  return [
    `Vendor: ${adapterInfo.vendor}`,
    `Architecture: ${adapterInfo.architecture}`,
    `Device: ${adapterInfo.device}`,
    `Description: ${adapterInfo.description}`
  ].join('\n');
}

/**
 * Check if specific features are supported
 *
 * @param adapter - GPU adapter
 * @param features - Features to check
 * @returns Object indicating which features are supported
 */
export async function checkFeaturesSupported(
  adapter: GPUAdapter,
  features: GPUFeatureName[]
): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {};
  const supportedFeatures = adapter.features;

  for (const feature of features) {
    result[feature] = supportedFeatures.has(feature);
  }

  return result;
}

/**
 * Get adapter limits
 *
 * @param adapter - GPU adapter
 * @returns Adapter limits
 */
export async function getAdapterLimits(adapter: GPUAdapter): Promise<GPUSupportedLimits> {
  return adapter.limits;
}

/**
 * Create a default WebGPU configuration
 *
 * @returns Default configuration
 */
export function getDefaultConfig(): WebGPUConfig {
  return {
    powerPreference: 'high-performance',
    enableProfiling: true,
    maxBufferSize: 256 * 1024 * 1024, // 256MB default
    debugShaders: false
  };
}

/**
 * Create a low-power configuration for integrated GPUs
 *
 * @returns Low-power configuration
 */
export function getLowPowerConfig(): WebGPUConfig {
  return {
    powerPreference: 'low-power',
    enableProfiling: true,
    maxBufferSize: 128 * 1024 * 1024, // 128MB for integrated
    debugShaders: false
  };
}

/**
 * Dispose of WebGPU resources
 *
 * @param device - GPU device to destroy
 */
export function disposeWebGPU(device?: GPUDevice): void {
  if (device) {
    device.destroy();
  }
}

/**
 * Wait for all queued GPU operations to complete
 *
 * @param device - GPU device
 * @returns Promise that resolves when all operations complete
 */
export async function waitForGPU(device: GPUDevice): Promise<void> {
  await device.queue.onSubmittedWorkDone();
}

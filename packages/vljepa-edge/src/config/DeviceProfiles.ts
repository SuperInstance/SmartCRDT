/**
 * @fileoverview Device Profiles for VL-JEPA Edge Deployment
 *
 * Predefined device profiles for optimal configuration:
 * - High-end desktop
 * - Mid-range desktop
 * - Low-end desktop
 * - Flagship mobile
 * - Mid-range mobile
 * - Budget mobile
 * - Tablet
 *
 * @package @lsi/vljepa-edge
 */

import type { DeviceProfile, BrowserRuntimeConfig } from "../types.js";

/**
 * Predefined device profiles
 */
export const DeviceProfiles: Record<
  | "desktop-high-end"
  | "desktop-mid-range"
  | "desktop-low-end"
  | "mobile-flagship"
  | "mobile-mid-range"
  | "mobile-budget"
  | "tablet",
  DeviceProfile
> = {
  "desktop-high-end": {
    name: "desktop-high-end",
    tier: "high",
    recommendedRuntime: "webgpu",
    batchSize: 8,
    quantization: "fp32",
    modelSize: "large",
    performanceScore: 95,
  },
  "desktop-mid-range": {
    name: "desktop-mid-range",
    tier: "medium",
    recommendedRuntime: "hybrid",
    batchSize: 4,
    quantization: "fp16",
    modelSize: "medium",
    performanceScore: 65,
  },
  "desktop-low-end": {
    name: "desktop-low-end",
    tier: "low",
    recommendedRuntime: "wasm",
    batchSize: 1,
    quantization: "int8",
    modelSize: "small",
    performanceScore: 35,
  },
  "mobile-flagship": {
    name: "mobile-flagship",
    tier: "high",
    recommendedRuntime: "webgpu",
    batchSize: 4,
    quantization: "fp16",
    modelSize: "medium",
    performanceScore: 85,
  },
  "mobile-mid-range": {
    name: "mobile-mid-range",
    tier: "medium",
    recommendedRuntime: "hybrid",
    batchSize: 2,
    quantization: "int8",
    modelSize: "small",
    performanceScore: 55,
  },
  "mobile-budget": {
    name: "mobile-budget",
    tier: "low",
    recommendedRuntime: "wasm",
    batchSize: 1,
    quantization: "int8",
    modelSize: "small",
    performanceScore: 25,
  },
  tablet: {
    name: "tablet",
    tier: "medium",
    recommendedRuntime: "hybrid",
    batchSize: 4,
    quantization: "fp16",
    modelSize: "medium",
    performanceScore: 70,
  },
};

/**
 * Runtime configurations for each device profile
 */
export const RuntimeConfigs: Record<
  keyof typeof DeviceProfiles,
  BrowserRuntimeConfig
> = {
  "desktop-high-end": {
    modelPath: "./models/vljepa-large-fp32",
    useWebGPU: true,
    useWebWorkers: true,
    cacheStrategy: "hybrid",
    memoryLimit: 4096,
    maxBatchSize: 8,
    preloadModels: true,
    logging: { enabled: true, level: "info" },
  },
  "desktop-mid-range": {
    modelPath: "./models/vljepa-medium-fp16",
    useWebGPU: true,
    useWebWorkers: true,
    cacheStrategy: "hybrid",
    memoryLimit: 2048,
    maxBatchSize: 4,
    preloadModels: true,
    logging: { enabled: true, level: "info" },
  },
  "desktop-low-end": {
    modelPath: "./models/vljepa-small-int8",
    useWebGPU: false,
    useWebWorkers: true,
    cacheStrategy: "indexeddb",
    memoryLimit: 1024,
    maxBatchSize: 1,
    preloadModels: false,
    logging: { enabled: true, level: "warn" },
  },
  "mobile-flagship": {
    modelPath: "./models/vljepa-medium-fp16",
    useWebGPU: true,
    useWebWorkers: false,
    cacheStrategy: "indexeddb",
    memoryLimit: 512,
    maxBatchSize: 4,
    preloadModels: true,
    logging: { enabled: false },
  },
  "mobile-mid-range": {
    modelPath: "./models/vljepa-small-int8",
    useWebGPU: true,
    useWebWorkers: false,
    cacheStrategy: "indexeddb",
    memoryLimit: 256,
    maxBatchSize: 2,
    preloadModels: false,
    logging: { enabled: false },
  },
  "mobile-budget": {
    modelPath: "./models/vljepa-small-int8",
    useWebGPU: false,
    useWebWorkers: false,
    cacheStrategy: "memory",
    memoryLimit: 128,
    maxBatchSize: 1,
    preloadModels: false,
    logging: { enabled: false },
  },
  tablet: {
    modelPath: "./models/vljepa-medium-fp16",
    useWebGPU: true,
    useWebWorkers: true,
    cacheStrategy: "hybrid",
    memoryLimit: 1024,
    maxBatchSize: 4,
    preloadModels: true,
    logging: { enabled: true, level: "info" },
  },
};

/**
 * Get device profile by name
 */
export function getDeviceProfile(
  profileName: keyof typeof DeviceProfiles
): DeviceProfile {
  return DeviceProfiles[profileName];
}

/**
 * Get runtime configuration by profile name
 */
export function getRuntimeConfig(
  profileName: keyof typeof DeviceProfiles
): BrowserRuntimeConfig {
  return RuntimeConfigs[profileName];
}

/**
 * Get optimal profile based on capabilities
 */
export function getOptimalProfile(capabilities: {
  webGPU: boolean;
  memory: number;
  cores: number;
  isMobile: boolean;
}): DeviceProfile {
  const { webGPU, memory, cores, isMobile } = capabilities;

  // High-end device
  if (webGPU && memory >= 4096 && cores >= 8) {
    return isMobile
      ? DeviceProfiles["mobile-flagship"]
      : DeviceProfiles["desktop-high-end"];
  }

  // Mid-range device
  if (memory >= 2048 && cores >= 4) {
    return isMobile
      ? DeviceProfiles["mobile-mid-range"]
      : DeviceProfiles["desktop-mid-range"];
  }

  // Low-end device
  if (isMobile) {
    return DeviceProfiles["mobile-budget"];
  }

  return DeviceProfiles["desktop-low-end"];
}

/**
 * Auto-detect device profile
 */
export async function autoDetectProfile(): Promise<DeviceProfile> {
  // Check WebGPU
  const hasWebGPU = "gpu" in navigator;

  // Check memory
  const memory = performance.memory
    ? performance.memory.jsHeapSizeLimit / (1024 * 1024)
    : 2048;

  // Check CPU cores
  const cores = navigator.hardwareConcurrency || 4;

  // Check if mobile
  const isMobile = /Mobile|Android|iPhone/i.test(navigator.userAgent);

  return getOptimalProfile({
    webGPU: hasWebGPU,
    memory,
    cores,
    isMobile,
  });
}

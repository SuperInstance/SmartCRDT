/**
 * @fileoverview VL-JEPA Edge Deployment - Main Entry Point
 *
 * Complete on-device deployment system for VL-JEPA on edge devices.
 *
 * @package @lsi/vljepa-edge
 * @version 1.0.0
 */

// ============================================================================
// RUNTIME EXPORTS
// ============================================================================

export {
  BrowserRuntime,
  createBrowserRuntime,
} from "./runtime/BrowserRuntime.js";

export {
  WebGPURuntime,
  createWebGPURuntime,
  getDefaultWebGPUConfig,
} from "./runtime/WebGPURuntime.js";

export {
  WASMRuntime,
  createWASMRuntime,
  getDefaultWASMConfig,
} from "./runtime/WASMRuntime.js";

export {
  HybridRuntime,
  createHybridRuntime,
  getDefaultHybridConfig,
} from "./runtime/HybridRuntime.js";

// ============================================================================
// COMPATIBILITY EXPORTS
// ============================================================================

export {
  CapabilityDetector,
  detectCapabilities,
  getDeviceProfile as getProfileFromDetector,
  supportsWebGPU,
  supportsSIMD,
  supportsMultiThreading,
  getBestRuntime,
  DeviceProfiles as CapabilityDeviceProfiles,
} from "./compatibility/CapabilityDetector.js";

// ============================================================================
// MANAGER EXPORTS
// ============================================================================

export {
  ModelManager,
  createModelManager,
  getDefaultModelManagerConfig,
} from "./managers/ModelManager.js";

export {
  CacheManager,
  createCacheManager,
  getDefaultCacheManagerConfig,
} from "./managers/CacheManager.js";

// ============================================================================
// MONITORING EXPORTS
// ============================================================================

export {
  PerformanceMonitor,
  createPerformanceMonitor,
  getDefaultPerformanceMonitorConfig,
} from "./monitoring/PerformanceMonitor.js";

// ============================================================================
// SECURITY EXPORTS
// ============================================================================

export {
  SecureContextManager,
  Sandbox,
  DataPartitioning,
  createSecureContextManager,
  createSandbox,
  createDataPartitioning,
  getDefaultSecureContextConfig,
  getDefaultSandboxConfig,
} from "./security/SecureContext.js";

// ============================================================================
// DEPLOYMENT EXPORTS
// ============================================================================

export {
  StaticDeployer,
  CDNDeployer,
  EdgeWorkerDeployer,
  createStaticDeployer,
  createCDNDeployer,
  createEdgeWorkerDeployer,
  getDefaultStaticDeploymentConfig,
  getDefaultCDNDeploymentConfig,
  getDefaultEdgeWorkerDeploymentConfig,
} from "./deployers/StaticDeployer.js";

// ============================================================================
// CONFIG EXPORTS
// ============================================================================

export {
  DeviceProfiles as ConfigDeviceProfiles,
  RuntimeConfigs,
  getDeviceProfile as getProfileFromConfig,
  getRuntimeConfig,
  getOptimalProfile,
  autoDetectProfile,
} from "./config/DeviceProfiles.js";

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  // Result types
  InferenceResult,
  HealthCheckResult,
  ProgressCallback,

  // Configuration types
  BrowserRuntimeConfig,
  WebGPURuntimeConfig,
  WASMRuntimeConfig,
  HybridRuntimeConfig,

  // Device types
  DeviceCapabilities,
  DeviceProfile,
  GPUInfo,

  // Management types
  ModelManagerConfig,
  ModelInfo,
  CacheManagerConfig,
  CacheEntry,

  // Monitoring types
  PerformanceMonitorConfig,
  PerformanceMetrics,

  // Security types
  SecureContextConfig,
  SandboxConfig,

  // Deployment types
  StaticDeploymentConfig,
  CDNDeploymentConfig,
  EdgeWorkerDeploymentConfig,

  // Config types
  PredefinedDeviceProfile,
  DeviceProfileConfig,

  // Error types
  RuntimeError,
  ModelLoadError,
  CacheError,
  CapabilityError,
  SecurityError,
} from "./types.js";

// Re-export error classes
export {
  EdgeDeploymentError,
  RuntimeError as RuntimeErrorClass,
  ModelLoadError as ModelLoadErrorClass,
  CacheError as CacheErrorClass,
  CapabilityError as CapabilityErrorClass,
  SecurityError as SecurityErrorClass,
} from "./types.js";

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

import type { BrowserRuntimeConfig } from "./types.js";
import { BrowserRuntime } from "./runtime/BrowserRuntime.js";
import { CapabilityDetector } from "./compatibility/CapabilityDetector.js";

/**
 * VL-JEPA Edge Deployment Factory
 */
export class VLJEPADeployment {
  private runtime: BrowserRuntime | null = null;
  private detector: CapabilityDetector;

  constructor() {
    this.detector = new CapabilityDetector();
  }

  async initialize(config?: Partial<BrowserRuntimeConfig>): Promise<void> {
    const capabilities = await this.detector.detect();
    const profile = capabilities.profile;

    const runtimeConfig: BrowserRuntimeConfig = {
      modelPath: config?.modelPath ?? "./models/vljepa",
      useWebGPU: config?.useWebGPU ?? profile.recommendedRuntime !== "wasm",
      useWebWorkers: config?.useWebWorkers ?? capabilities.workers,
      cacheStrategy:
        config?.cacheStrategy ??
        (profile.tier === "high" ? "hybrid" : "indexeddb"),
      memoryLimit: config?.memoryLimit ?? capabilities.memory,
      maxBatchSize: config?.maxBatchSize ?? profile.batchSize,
      preloadModels: config?.preloadModels ?? false,
      logging: config?.logging ?? { enabled: true, level: "info" },
    };

    this.runtime = new BrowserRuntime(runtimeConfig);
    await this.runtime.initialize();
  }

  getRuntime(): BrowserRuntime {
    if (!this.runtime) {
      throw new Error("Runtime not initialized. Call initialize() first.");
    }
    return this.runtime;
  }

  async getCapabilities() {
    return await this.detector.detect();
  }

  async getProfile() {
    return await this.detector.getProfile();
  }

  async dispose(): Promise<void> {
    if (this.runtime) {
      await this.runtime.dispose();
      this.runtime = null;
    }
  }
}

/**
 * Create VL-JEPA edge deployment
 */
export function createVLJEPADeployment(): VLJEPADeployment {
  return new VLJEPADeployment();
}

// ============================================================================
// VERSION
// ============================================================================

export const VERSION = "1.0.0";

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  VERSION,
  createVLJEPADeployment,
};

/**
 * @fileoverview Capability Detector for VL-JEPA Edge Deployment
 *
 * Detects device capabilities and recommends optimal configuration:
 * - WebGPU support and GPU info
 * - WebAssembly features (SIMD, multi-threading)
 * - Web Worker and Service Worker support
 * - Memory and CPU information
 * - Device profiling (high/medium/low tier)
 *
 * @package @lsi/vljepa-edge
 */

import type { DeviceCapabilities, DeviceProfile, GPUInfo } from "../types.js";

/**
 * Capability Detector for VL-JEPA edge deployment
 *
 * Detects device capabilities and generates optimal profiles
 * for runtime selection and configuration.
 */
export class CapabilityDetector {
  private cachedCapabilities: DeviceCapabilities | null = null;
  private detectionPromise: Promise<DeviceCapabilities> | null = null;

  /**
   * Detect device capabilities
   */
  async detect(): Promise<DeviceCapabilities> {
    // Return cached result if available
    if (this.cachedCapabilities) {
      return this.cachedCapabilities;
    }

    // Return ongoing detection if in progress
    if (this.detectionPromise) {
      return await this.detectionPromise;
    }

    // Start detection
    this.detectionPromise = this.performDetection();

    try {
      const capabilities = await this.detectionPromise;
      this.cachedCapabilities = capabilities;
      return capabilities;
    } finally {
      this.detectionPromise = null;
    }
  }

  /**
   * Get device profile based on capabilities
   */
  async getProfile(): Promise<DeviceProfile> {
    const capabilities = await this.detect();
    return this.generateProfile(capabilities);
  }

  /**
   * Check if WebGPU is available
   */
  hasWebGPU(): boolean {
    return "gpu" in navigator;
  }

  /**
   * Check if WebAssembly is available
   */
  hasWebAssembly(): boolean {
    return typeof WebAssembly === "object";
  }

  /**
   * Check if Web Workers are available
   */
  hasWorkers(): boolean {
    return typeof Worker === "function";
  }

  /**
   * Check if Service Workers are available
   */
  hasServiceWorkers(): boolean {
    return "serviceWorker" in navigator;
  }

  /**
   * Check if IndexedDB is available
   */
  hasIndexedDB(): boolean {
    return "indexedDB" in window;
  }

  /**
   * Get GPU information
   */
  async getGPUInfo(): Promise<GPUInfo | undefined> {
    if (!this.hasWebGPU()) {
      return undefined;
    }

    try {
      const adapter = await navigator.gpu!.requestAdapter();
      if (!adapter) {
        return undefined;
      }

      const info = adapter.info;
      const features = adapter.features;
      const limits = adapter.limits;

      return {
        vendor: info.vendor,
        renderer: info.description,
        adapter: {
          vendor: info.vendor,
          architecture: info.architecture,
          device: info.device,
          description: info.description,
        },
        vram: this.estimateVRAM(limits),
        features: Array.from(features),
        limits: limits,
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Get estimated available memory in MB
   */
  getAvailableMemory(): number {
    if (performance.memory) {
      return (
        (performance.memory.jsHeapSizeLimit -
          performance.memory.usedJSHeapSize) /
        (1024 * 1024)
      );
    }

    // Default estimates based on device tier
    const ua = navigator.userAgent;
    if (
      ua.includes("Mobile") ||
      ua.includes("Android") ||
      ua.includes("iPhone")
    ) {
      return 512; // 512MB for mobile
    }
    return 2048; // 2GB for desktop
  }

  /**
   * Get number of CPU cores
   */
  getCores(): number {
    return navigator.hardwareConcurrency || 4;
  }

  /**
   * Clear cached capabilities
   */
  clearCache(): void {
    this.cachedCapabilities = null;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Perform capability detection
   */
  private async performDetection(): Promise<DeviceCapabilities> {
    const webGPU = this.hasWebGPU();
    const webAssembly = this.hasWebAssembly();
    const workers = this.hasWorkers();
    const serviceWorkers = this.hasServiceWorkers();
    const indexedDB = this.hasIndexedDB();

    const gpu = webGPU ? await this.getGPUInfo() : undefined;
    const memory = this.getAvailableMemory();
    const cores = this.getCores();

    const profile = this.generateProfile({
      webGPU,
      webAssembly,
      workers,
      serviceWorkers,
      indexedDB,
      gpu,
      memory,
      cores,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      hardwareConcurrency: cores,
      profile: {
        name: "auto-detected",
        tier: "medium",
        recommendedRuntime: webGPU ? "webgpu" : "wasm",
        batchSize: 4,
        quantization: "fp32",
        modelSize: "medium",
        performanceScore: 50,
      },
    });

    return {
      webGPU,
      webAssembly,
      workers,
      serviceWorkers,
      indexedDB,
      gpu,
      memory,
      cores,
      profile,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      hardwareConcurrency: cores,
    };
  }

  /**
   * Generate device profile from capabilities
   */
  private generateProfile(capabilities: DeviceCapabilities): DeviceProfile {
    const { webGPU, gpu, memory, cores, userAgent } = capabilities;

    // Determine tier based on capabilities
    let tier: "high" | "medium" | "low" = "low";
    let performanceScore = 0;

    // WebGPU availability (40 points)
    if (webGPU && gpu) {
      performanceScore += 40;
      tier = "medium";
    }

    // Memory (30 points)
    if (memory >= 4096) {
      performanceScore += 30;
    } else if (memory >= 2048) {
      performanceScore += 20;
    } else if (memory >= 1024) {
      performanceScore += 10;
    }

    // CPU cores (20 points)
    if (cores >= 8) {
      performanceScore += 20;
    } else if (cores >= 4) {
      performanceScore += 15;
    } else {
      performanceScore += 10;
    }

    // Discrete GPU (10 points)
    if (gpu?.adapter?.architecture?.toLowerCase().includes("discrete")) {
      performanceScore += 10;
    }

    // Determine tier based on score
    if (performanceScore >= 80) {
      tier = "high";
    } else if (performanceScore >= 50) {
      tier = "medium";
    } else {
      tier = "low";
    }

    // Determine recommended runtime
    let recommendedRuntime: "webgpu" | "wasm" | "hybrid";
    if (webGPU && tier === "high") {
      recommendedRuntime = "webgpu";
    } else if (webGPU && tier === "medium") {
      recommendedRuntime = "hybrid";
    } else {
      recommendedRuntime = "wasm";
    }

    // Determine batch size
    const batchSize = tier === "high" ? 8 : tier === "medium" ? 4 : 1;

    // Determine quantization
    const quantization: "int8" | "fp16" | "fp32" =
      tier === "low" ? "int8" : tier === "medium" ? "fp16" : "fp32";

    // Determine model size
    const modelSize: "small" | "medium" | "large" =
      tier === "low" ? "small" : tier === "medium" ? "medium" : "large";

    // Generate profile name
    const isMobile = /Mobile|Android|iPhone/i.test(userAgent);
    const name = isMobile ? `mobile-${tier}` : `desktop-${tier}`;

    return {
      name,
      tier,
      recommendedRuntime,
      batchSize,
      quantization,
      modelSize,
      performanceScore,
    };
  }

  /**
   * Estimate VRAM from GPU limits
   */
  private estimateVRAM(limits: any | undefined): number {
    if (!limits) {
      return 0;
    }

    // Estimate based on max buffer size
    // This is a rough estimate
    const maxBufferSize = limits.maxBufferSize || 0;
    return Math.floor(maxBufferSize / (1024 * 1024));
  }
}

/**
 * Device profile presets
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
 * Detect device capabilities and return profile
 */
export async function detectCapabilities(): Promise<DeviceCapabilities> {
  const detector = new CapabilityDetector();
  return await detector.detect();
}

/**
 * Get device profile
 */
export async function getDeviceProfile(): Promise<DeviceProfile> {
  const detector = new CapabilityDetector();
  return await detector.getProfile();
}

/**
 * Check if device supports WebGPU
 */
export function supportsWebGPU(): boolean {
  return "gpu" in navigator;
}

/**
 * Check if device supports WebAssembly SIMD
 */
export async function supportsSIMD(): Promise<boolean> {
  try {
    const simdBytes = new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10,
      1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
    ]);
    await WebAssembly.compile(simdBytes);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if device supports WebAssembly multi-threading
 */
export async function supportsMultiThreading(): Promise<boolean> {
  // Check for SharedArrayBuffer (required for multi-threading)
  return typeof SharedArrayBuffer !== "undefined";
}

/**
 * Get best runtime for device
 */
export async function getBestRuntime(): Promise<"webgpu" | "wasm" | "hybrid"> {
  const profile = await getDeviceProfile();
  return profile.recommendedRuntime;
}

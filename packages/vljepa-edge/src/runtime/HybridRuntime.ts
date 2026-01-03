/**
 * @fileoverview Hybrid Runtime for VL-JEPA Edge Deployment
 *
 * Provides automatic fallback between WebGPU and WASM:
 * - Auto-detects best runtime
 * - Graceful fallback on errors
 * - Performance monitoring
 * - Adaptive runtime selection
 *
 * @package @lsi/vljepa-edge
 */

import type { HybridRuntimeConfig, InferenceResult } from "../types.js";
import { RuntimeError } from "../types.js";
import { WebGPURuntime } from "./WebGPURuntime.js";
import { WASMRuntime } from "./WASMRuntime.js";

/**
 * Hybrid Runtime for VL-JEPA inference
 *
 * Automatically selects between WebGPU and WASM based on:
 * - Device capabilities
 * - Performance metrics
 * - Error rates
 * - Resource availability
 */
export class HybridRuntime {
  private config: HybridRuntimeConfig;
  private webgpu: WebGPURuntime;
  private wasm: WASMRuntime;
  private currentRuntime: "webgpu" | "wasm" = "webgpu";
  private performanceScore: Map<"webgpu" | "wasm", number> = new Map();
  private errorCounts: Map<"webgpu" | "wasm", number> = new Map();
  private lastFallbackTime: number = 0;
  private initialized: boolean = false;

  constructor(config: HybridRuntimeConfig) {
    this.config = config;
    this.webgpu = new WebGPURuntime(config.webgpu);
    this.wasm = new WASMRuntime(config.wasm);
    this.performanceScore.set("webgpu", 100);
    this.performanceScore.set("wasm", 50);
    this.errorCounts.set("webgpu", 0);
    this.errorCounts.set("wasm", 0);
  }

  /**
   * Initialize hybrid runtime
   */
  async initialize(): Promise<void> {
    try {
      // Try WebGPU first
      await this.webgpu.initialize();
      this.currentRuntime = "webgpu";
      this.initialized = true;
    } catch (error) {
      console.warn(
        "[HybridRuntime] WebGPU initialization failed, using WASM:",
        error
      );
      await this.wasm.initialize();
      this.currentRuntime = "wasm";
      this.initialized = true;
    }
  }

  /**
   * Run inference with automatic fallback
   */
  async inference(input: {
    data: Float32Array;
    shape: number[];
  }): Promise<InferenceResult> {
    if (!this.initialized) {
      throw new RuntimeError("Hybrid runtime not initialized");
    }

    const startTime = performance.now();
    const runtime = this.selectRuntime();

    try {
      const result = await this.runInference(runtime, input);
      const latency = performance.now() - startTime;

      // Update performance score
      this.updatePerformanceScore(runtime, latency);

      return {
        embedding: result,
        confidence: 0.95,
        latency,
        memory: this.getCurrentMemory(),
        device: {
          runtime: runtime,
          tier: runtime === "webgpu" ? "high" : "medium",
          gpu:
            runtime === "webgpu"
              ? this.webgpu.getGPUInfo()?.description
              : undefined,
        },
        metadata: {
          timestamp: Date.now(),
          modelVersion: "1.0.0",
          quantization: "fp32",
          cached: false,
          batchSize: 1,
        },
      };
    } catch (error) {
      // Increment error count
      const errors = this.errorCounts.get(runtime)!;
      this.errorCounts.set(runtime, errors + 1);

      // Auto fallback if enabled
      if (this.config.autoFallback && this.shouldFallback(runtime)) {
        return await this.fallbackInference(input);
      }

      throw error;
    }
  }

  /**
   * Batch inference
   */
  async batchInference(
    inputs: Array<{
      data: Float32Array;
      shape: number[];
    }>
  ): Promise<InferenceResult[]> {
    const results: InferenceResult[] = [];

    for (const input of inputs) {
      const result = await this.inference(input);
      results.push(result);
    }

    return results;
  }

  /**
   * Get current runtime
   */
  getCurrentRuntime(): "webgpu" | "wasm" {
    return this.currentRuntime;
  }

  /**
   * Get performance scores
   */
  getPerformanceScores(): { webgpu: number; wasm: number } {
    return {
      webgpu: this.performanceScore.get("webgpu") || 0,
      wasm: this.performanceScore.get("wasm") || 0,
    };
  }

  /**
   * Get error counts
   */
  getErrorCounts(): { webgpu: number; wasm: number } {
    return {
      webgpu: this.errorCounts.get("webgpu") || 0,
      wasm: this.errorCounts.get("wasm") || 0,
    };
  }

  /**
   * Force runtime switch
   */
  forceRuntime(runtime: "webgpu" | "wasm"): void {
    this.currentRuntime = runtime;
  }

  /**
   * Reset performance scores
   */
  resetPerformanceScores(): void {
    this.performanceScore.set("webgpu", 100);
    this.performanceScore.set("wasm", 50);
    this.errorCounts.set("webgpu", 0);
    this.errorCounts.set("wasm", 0);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.webgpu.dispose();
    this.wasm.dispose();
    this.initialized = false;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Select best runtime based on scores and configuration
   */
  private selectRuntime(): "webgpu" | "wasm" {
    const webgpuScore = this.performanceScore.get("webgpu") || 0;
    const wasmScore = this.performanceScore.get("wasm") || 0;
    const threshold = this.config.fallbackThreshold;

    // Check if WebGPU score is above threshold
    if (webgpuScore >= threshold) {
      return "webgpu";
    }

    // Use WASM if WebGPU score is too low
    if (wasmScore > webgpuScore) {
      return "wasm";
    }

    return this.currentRuntime;
  }

  /**
   * Check if should fallback to other runtime
   */
  private shouldFallback(runtime: "webgpu" | "wasm"): boolean {
    const errors = this.errorCounts.get(runtime) || 0;
    const now = Date.now();
    const timeSinceLastFallback = now - this.lastFallbackTime;

    // Check fallback cooldown
    if (timeSinceLastFallback < this.config.fallbackCooldown) {
      return false;
    }

    // Check error threshold
    return errors > 3;
  }

  /**
   * Fallback to alternative runtime
   */
  private async fallbackInference(input: {
    data: Float32Array;
    shape: number[];
  }): Promise<InferenceResult> {
    const fallbackRuntime =
      this.currentRuntime === "webgpu" ? "wasm" : "webgpu";

    console.warn(
      `[HybridRuntime] Falling back from ${this.currentRuntime} to ${fallbackRuntime}`
    );

    this.currentRuntime = fallbackRuntime;
    this.lastFallbackTime = Date.now();

    // Initialize fallback runtime if needed
    if (fallbackRuntime === "wasm") {
      try {
        await this.wasm.initialize();
      } catch {
        // Already initialized or error
      }
    }

    return await this.inference(input);
  }

  /**
   * Run inference on specific runtime
   */
  private async runInference(
    runtime: "webgpu" | "wasm",
    input: { data: Float32Array; shape?: number[] }
  ): Promise<Float32Array> {
    if (runtime === "webgpu") {
      return await this.webgpu.inference(input);
    } else {
      return await this.wasm.inference(input);
    }
  }

  /**
   * Update performance score based on latency
   */
  private updatePerformanceScore(
    runtime: "webgpu" | "wasm",
    latency: number
  ): void {
    // Score inversely proportional to latency
    // Lower latency = higher score
    const baseScore = 100;
    const latencyFactor = Math.max(0, 1 - latency / 1000); // Decay over 1s
    const newScore = baseScore * latencyFactor;

    // Smooth update (exponential moving average)
    const currentScore = this.performanceScore.get(runtime) || 50;
    const alpha = 0.3; // Smoothing factor
    const smoothedScore = alpha * newScore + (1 - alpha) * currentScore;

    this.performanceScore.set(runtime, smoothedScore);
  }

  /**
   * Get current memory usage
   */
  private getCurrentMemory(): number {
    if (this.currentRuntime === "webgpu") {
      return this.webgpu.getMemoryUsage().allocated / (1024 * 1024);
    } else {
      return this.wasm.getMemoryUsage().used / (1024 * 1024);
    }
  }
}

/**
 * Create a hybrid runtime instance
 */
export function createHybridRuntime(
  config: HybridRuntimeConfig
): HybridRuntime {
  return new HybridRuntime(config);
}

/**
 * Default hybrid configuration
 */
export function getDefaultHybridConfig(): HybridRuntimeConfig {
  return {
    webgpu: {
      devicePreference: "any",
      shaderCache: true,
      bufferManager: {
        initialPoolSize: 64,
        maxPoolSize: 512,
        alignment: 256,
        reuse: true,
        asyncMap: true,
      },
      workgroupSize: [16, 16, 1],
      maxBufferSize: 1024,
      asyncCompilation: true,
    },
    wasm: {
      memoryPageSize: 256,
      maxMemoryPages: 4096,
      useSIMD: true,
      useMultiThreading: navigator.hardwareConcurrency || 4,
      useBulkMemory: true,
      useSaturatedFloatToInt: true,
    },
    fallbackThreshold: 40,
    autoFallback: true,
    fallbackCooldown: 5000,
  };
}

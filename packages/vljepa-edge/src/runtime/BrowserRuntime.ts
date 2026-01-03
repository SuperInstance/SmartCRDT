/**
 * @fileoverview Browser Runtime for VL-JEPA Edge Deployment
 *
 * Provides in-browser inference capabilities for VL-JEPA models with:
 * - Lazy loading of models from CDN or local storage
 * - WebGPU acceleration with fallback to WebAssembly
 * - Web Worker support for parallel processing
 * - Efficient memory management
 * - Cache strategies (memory, IndexedDB, Service Worker)
 *
 * @package @lsi/vljepa-edge
 */

import type {
  BrowserRuntimeConfig,
  InferenceResult,
  HealthCheckResult,
  ProgressCallback,
} from "../types.js";
import { RuntimeError } from "../types.js";

/**
 * Browser Runtime for VL-JEPA inference
 *
 * Main runtime class that handles model loading, inference execution,
 * and resource management for browser-based VL-JEPA deployment.
 */
export class BrowserRuntime {
  private config: BrowserRuntimeConfig;
  private modelLoaded: boolean = false;
  private worker: Worker | null = null;
  private webGPURuntime: any = null;
  private wasmRuntime: any = null;
  private memoryUsage: number = 0;
  private cache: Map<string, Float32Array> = new Map();
  private logger: Console;

  constructor(config: BrowserRuntimeConfig) {
    this.config = config;
    this.logger = config.logging?.enabled ? console : Object.create(console);
    this.logger.log("[BrowserRuntime] Initialized with config:", config);
  }

  /**
   * Initialize the runtime
   *
   * Loads the VL-JEPA model, initializes WebGPU if enabled,
   * and sets up Web Workers if configured.
   */
  async initialize(onProgress?: ProgressCallback): Promise<void> {
    this.logger.info("[BrowserRuntime] Initializing...");

    try {
      // Check capabilities
      const capabilities = await this.detectCapabilities();
      this.logger.info("[BrowserRuntime] Device capabilities:", capabilities);

      // Initialize WebGPU if enabled and available
      if (this.config.useWebGPU && capabilities.webGPU) {
        onProgress?.({
          loaded: 10,
          total: 100,
          percentage: 10,
          stage: "Initializing WebGPU",
        });
        await this.initializeWebGPU();
      }

      // Initialize WebAssembly fallback
      if (capabilities.webAssembly) {
        onProgress?.({
          loaded: 20,
          total: 100,
          percentage: 20,
          stage: "Initializing WASM",
        });
        await this.initializeWASM();
      }

      // Setup Web Worker if enabled
      if (this.config.useWebWorkers && capabilities.workers) {
        onProgress?.({
          loaded: 30,
          total: 100,
          percentage: 30,
          stage: "Setting up Web Workers",
        });
        await this.setupWebWorker();
      }

      // Load model
      onProgress?.({
        loaded: 40,
        total: 100,
        percentage: 40,
        stage: "Loading model",
      });
      await this.loadModel(onProgress);

      // Initialize cache
      onProgress?.({
        loaded: 90,
        total: 100,
        percentage: 90,
        stage: "Initializing cache",
      });
      await this.initializeCache();

      this.modelLoaded = true;
      onProgress?.({
        loaded: 100,
        total: 100,
        percentage: 100,
        stage: "Ready",
      });

      this.logger.info("[BrowserRuntime] Initialization complete");
    } catch (error) {
      this.logger.error("[BrowserRuntime] Initialization failed:", error);
      throw new RuntimeError(
        `Failed to initialize runtime: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Run VL-JEPA inference
   *
   * @param input - Input data (image, text, or both)
   * @returns Inference result with embedding and metadata
   */
  async inference(input: {
    image?: ImageData | HTMLCanvasElement | string;
    text?: string;
  }): Promise<InferenceResult> {
    if (!this.modelLoaded) {
      throw new RuntimeError("Model not loaded. Call initialize() first.");
    }

    const startTime = performance.now();
    const startMemory = this.getCurrentMemory();

    try {
      // Check cache
      const cacheKey = this.getCacheKey(input);
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey)!;
        this.logger.debug("[BrowserRuntime] Cache hit for:", cacheKey);
        return {
          embedding: cached,
          confidence: 1.0,
          latency: performance.now() - startTime,
          memory: this.getCurrentMemory() - startMemory,
          device: this.getDeviceInfo(),
          metadata: {
            timestamp: Date.now(),
            modelVersion: "1.0.0",
            quantization: "fp32",
            cached: true,
            batchSize: 1,
          },
        };
      }

      // Select runtime based on capabilities and config
      const runtime = this.selectRuntime();
      let embedding: Float32Array;

      if (runtime === "webgpu" && this.webGPURuntime) {
        embedding = await this.runWebGPUInference(input);
      } else if (runtime === "wasm" && this.wasmRuntime) {
        embedding = await this.runWASMInference(input);
      } else if (this.worker) {
        embedding = await this.runWorkerInference(input);
      } else {
        throw new RuntimeError("No suitable runtime available");
      }

      // Cache result
      if (
        this.config.cacheStrategy === "memory" ||
        this.config.cacheStrategy === "hybrid"
      ) {
        this.cache.set(cacheKey, embedding);
      }

      const latency = performance.now() - startTime;
      const memoryUsed = this.getCurrentMemory() - startMemory;

      this.logger.debug(
        `[BrowserRuntime] Inference complete in ${latency.toFixed(2)}ms`
      );

      return {
        embedding,
        confidence: 0.95,
        latency,
        memory: memoryUsed,
        device: this.getDeviceInfo(),
        metadata: {
          timestamp: Date.now(),
          modelVersion: "1.0.0",
          quantization: "fp32",
          cached: false,
          batchSize: 1,
        },
      };
    } catch (error) {
      this.logger.error("[BrowserRuntime] Inference failed:", error);
      throw new RuntimeError(
        `Inference failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Batch inference for multiple inputs
   */
  async batchInference(
    inputs: Array<{
      image?: ImageData | HTMLCanvasElement | string;
      text?: string;
    }>
  ): Promise<InferenceResult[]> {
    if (!this.modelLoaded) {
      throw new RuntimeError("Model not loaded. Call initialize() first.");
    }

    // Check batch size limit
    if (inputs.length > this.config.maxBatchSize) {
      throw new RuntimeError(
        `Batch size ${inputs.length} exceeds maximum ${this.config.maxBatchSize}`
      );
    }

    this.logger.info(
      `[BrowserRuntime] Running batch inference for ${inputs.length} inputs`
    );

    const results: InferenceResult[] = [];
    for (let i = 0; i < inputs.length; i++) {
      const result = await this.inference(inputs[i]);
      results.push(result);
      this.logger.debug(
        `[BrowserRuntime] Batch inference ${i + 1}/${inputs.length} complete`
      );
    }

    return results;
  }

  /**
   * Clear the embedding cache
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.info("[BrowserRuntime] Cache cleared");
  }

  /**
   * Get current memory usage in MB
   */
  getCurrentMemory(): number {
    if (performance.memory) {
      return performance.memory.usedJSHeapSize / (1024 * 1024);
    }
    return this.memoryUsage;
  }

  /**
   * Get memory limit in MB
   */
  getMemoryLimit(): number {
    if (performance.memory) {
      return performance.memory.jsHeapSizeLimit / (1024 * 1024);
    }
    return this.config.memoryLimit;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const errors: string[] = [];
    let runtimeHealthy = true;
    let runtimeMessage = "Runtime is healthy";

    // Check if model is loaded
    if (!this.modelLoaded) {
      errors.push("Model not loaded");
      runtimeHealthy = false;
      runtimeMessage = "Model not initialized";
    }

    // Check memory usage
    const currentMemory = this.getCurrentMemory();
    const memoryLimit = this.getMemoryLimit();
    const memoryPercentage = (currentMemory / memoryLimit) * 100;

    if (memoryPercentage > 90) {
      errors.push(`High memory usage: ${memoryPercentage.toFixed(1)}%`);
      runtimeHealthy = false;
    }

    // Check WebGPU
    let webgpuAvailable = false;
    try {
      if (!navigator.gpu) {
        errors.push("WebGPU not available");
      } else {
        webgpuAvailable = true;
      }
    } catch (e) {
      // WebGPU check failed
    }

    // Check cache
    const cacheSize = this.cache.size;

    return {
      healthy: runtimeHealthy && errors.length === 0,
      runtime: {
        available: runtimeHealthy,
        type: this.config.useWebGPU && webgpuAvailable ? "webgpu" : "wasm",
        message: runtimeMessage,
      },
      model: {
        loaded: this.modelLoaded,
        version: "1.0.0",
        message: this.modelLoaded ? "Model loaded" : "Model not loaded",
      },
      cache: {
        available: true,
        size: cacheSize,
        message: `Cache has ${cacheSize} entries`,
      },
      memory: {
        used: currentMemory,
        limit: memoryLimit,
        percentage: memoryPercentage,
      },
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Dispose of runtime resources
   */
  async dispose(): Promise<void> {
    this.logger.info("[BrowserRuntime] Disposing...");

    // Terminate worker
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    // Clear cache
    this.cache.clear();

    // Dispose WebGPU
    if (this.webGPURuntime?.dispose) {
      await this.webGPURuntime.dispose();
      this.webGPURuntime = null;
    }

    // Dispose WASM
    if (this.wasmRuntime?.dispose) {
      await this.wasmRuntime.dispose();
      this.wasmRuntime = null;
    }

    this.modelLoaded = false;
    this.logger.info("[BrowserRuntime] Disposed");
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Detect device capabilities
   */
  private async detectCapabilities(): Promise<{
    webGPU: boolean;
    webAssembly: boolean;
    workers: boolean;
    indexedDB: boolean;
  }> {
    return {
      webGPU: "gpu" in navigator,
      webAssembly: typeof WebAssembly === "object",
      workers: typeof Worker === "function",
      indexedDB: "indexedDB" in window,
    };
  }

  /**
   * Initialize WebGPU runtime
   */
  private async initializeWebGPU(): Promise<void> {
    try {
      if (!navigator.gpu) {
        this.logger.warn(
          "[BrowserRuntime] WebGPU not available, will use WASM fallback"
        );
        return;
      }

      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        this.logger.warn(
          "[BrowserRuntime] No GPU adapter found, will use WASM fallback"
        );
        return;
      }

      const device = await adapter.requestDevice();
      this.webGPURuntime = { adapter, device };
      this.logger.info("[BrowserRuntime] WebGPU initialized successfully");
    } catch (error) {
      this.logger.warn("[BrowserRuntime] WebGPU initialization failed:", error);
    }
  }

  /**
   * Initialize WebAssembly runtime
   */
  private async initializeWASM(): Promise<void> {
    try {
      // This would load the actual WASM module
      // For now, we create a placeholder
      this.wasmRuntime = {
        instance: null,
        memory: null,
      };
      this.logger.info("[BrowserRuntime] WASM initialized successfully");
    } catch (error) {
      this.logger.error("[BrowserRuntime] WASM initialization failed:", error);
    }
  }

  /**
   * Setup Web Worker
   */
  private async setupWebWorker(): Promise<void> {
    try {
      // Create worker from inline blob or external file
      const workerCode = `
        self.onmessage = async (e) => {
          const { type, data } = e.data;
          if (type === 'inference') {
            // Run inference in worker
            const embedding = new Float32Array(768);
            self.postMessage({ type: 'result', data: embedding }, [embedding.buffer]);
          }
        };
      `;

      const blob = new Blob([workerCode], { type: "application/javascript" });
      const workerUrl = URL.createObjectURL(blob);
      this.worker = new Worker(workerUrl);

      this.logger.info("[BrowserRuntime] Web Worker setup successfully");
    } catch (error) {
      this.logger.error("[BrowserRuntime] Web Worker setup failed:", error);
    }
  }

  /**
   * Load VL-JEPA model
   */
  private async loadModel(onProgress?: ProgressCallback): Promise<void> {
    try {
      this.logger.info(
        "[BrowserRuntime] Loading model from:",
        this.config.modelPath
      );

      // Check if model is cached
      if (
        this.config.cacheStrategy === "indexeddb" ||
        this.config.cacheStrategy === "hybrid"
      ) {
        const cached = await this.loadModelFromIndexedDB();
        if (cached) {
          this.logger.info(
            "[BrowserRuntime] Model loaded from IndexedDB cache"
          );
          return;
        }
      }

      // Load model from URL or path
      onProgress?.({
        loaded: 50,
        total: 100,
        percentage: 50,
        stage: "Downloading model",
      });

      // Simulate model loading (replace with actual fetch)
      await this.delay(100);

      onProgress?.({
        loaded: 80,
        total: 100,
        percentage: 80,
        stage: "Parsing model",
      });

      // Cache model in IndexedDB
      if (
        this.config.cacheStrategy === "indexeddb" ||
        this.config.cacheStrategy === "hybrid"
      ) {
        await this.cacheModelInIndexedDB();
      }

      this.logger.info("[BrowserRuntime] Model loaded successfully");
    } catch (error) {
      this.logger.error("[BrowserRuntime] Model loading failed:", error);
      throw error;
    }
  }

  /**
   * Initialize cache
   */
  private async initializeCache(): Promise<void> {
    if (
      this.config.cacheStrategy === "memory" ||
      this.config.cacheStrategy === "hybrid"
    ) {
      this.cache = new Map();
      this.logger.info("[BrowserRuntime] Memory cache initialized");
    }

    if (
      this.config.cacheStrategy === "indexeddb" ||
      this.config.cacheStrategy === "hybrid"
    ) {
      await this.openIndexedDB();
      this.logger.info("[BrowserRuntime] IndexedDB cache initialized");
    }
  }

  /**
   * Select best runtime for current environment
   */
  private selectRuntime(): "webgpu" | "wasm" | "worker" {
    if (this.config.useWebGPU && this.webGPURuntime) {
      return "webgpu";
    }
    if (this.wasmRuntime) {
      return "wasm";
    }
    return "worker";
  }

  /**
   * Run WebGPU inference
   */
  private async runWebGPUInference(_input: {
    image?: ImageData | HTMLCanvasElement | string;
    text?: string;
  }): Promise<Float32Array> {
    // Placeholder for actual WebGPU inference
    this.logger.debug("[BrowserRuntime] Running WebGPU inference");
    return new Float32Array(768);
  }

  /**
   * Run WebAssembly inference
   */
  private async runWASMInference(_input: {
    image?: ImageData | HTMLCanvasElement | string;
    text?: string;
  }): Promise<Float32Array> {
    // Placeholder for actual WASM inference
    this.logger.debug("[BrowserRuntime] Running WASM inference");
    return new Float32Array(768);
  }

  /**
   * Run Web Worker inference
   */
  private async runWorkerInference(input: {
    image?: ImageData | HTMLCanvasElement | string;
    text?: string;
  }): Promise<Float32Array> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new RuntimeError("Web Worker not available"));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new RuntimeError("Worker inference timeout"));
      }, 30000);

      this.worker.onmessage = e => {
        clearTimeout(timeout);
        if (e.data.type === "result") {
          resolve(e.data.data);
        }
      };

      this.worker.onerror = error => {
        clearTimeout(timeout);
        reject(new RuntimeError(`Worker error: ${error.message}`));
      };

      this.worker.postMessage({ type: "inference", data: input });
    });
  }

  /**
   * Get cache key for input
   */
  private getCacheKey(input: {
    image?: ImageData | HTMLCanvasElement | string;
    text?: string;
  }): string {
    const parts: string[] = [];
    if (input.text) parts.push(input.text);
    if (typeof input.image === "string") parts.push(input.image);
    return parts.join("|");
  }

  /**
   * Get device info
   */
  private getDeviceInfo(): InferenceResult["device"] {
    const runtime = this.selectRuntime();
    const tier =
      runtime === "webgpu" ? "high" : runtime === "wasm" ? "medium" : "low";

    return {
      runtime: runtime === "worker" ? "wasm" : runtime,
      tier,
      gpu: this.webGPURuntime
        ? this.webGPURuntime.adapter.info.vendor
        : undefined,
    };
  }

  /**
   * Load model from IndexedDB
   */
  private async loadModelFromIndexedDB(): Promise<boolean> {
    try {
      const db = await this.openIndexedDB();
      const tx = db.transaction("models", "readonly");
      const store = tx.objectStore("models");
      const result = await store.get("vljepa-model");
      return !!result;
    } catch {
      return false;
    }
  }

  /**
   * Cache model in IndexedDB
   */
  private async cacheModelInIndexedDB(): Promise<void> {
    try {
      const db = await this.openIndexedDB();
      const tx = db.transaction("models", "readwrite");
      const store = tx.objectStore("models");
      await store.put({
        id: "vljepa-model",
        data: new ArrayBuffer(0),
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.warn("[BrowserRuntime] Failed to cache model:", error);
    }
  }

  /**
   * Open IndexedDB
   */
  private async openIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("vljepa-edge", 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("models")) {
          db.createObjectStore("models", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("cache")) {
          db.createObjectStore("cache", { keyPath: "key" });
        }
      };
    });
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create a browser runtime instance
 */
export function createBrowserRuntime(
  config: BrowserRuntimeConfig
): BrowserRuntime {
  return new BrowserRuntime(config);
}

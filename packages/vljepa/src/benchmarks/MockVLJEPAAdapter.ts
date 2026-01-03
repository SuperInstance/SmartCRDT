/**
 * Mock VL-JEPA Adapter for Testing
 *
 * Simulates VL-JEPA inference without requiring actual model weights
 * Used for benchmarking and testing
 */

import type {
  VLJEPABenchmarkResult,
  BenchmarkConfiguration,
  UIFrameBenchmark,
  UserIntentBenchmark,
  GoalPredictionBenchmark,
} from "./types";

/**
 * Mock VL-JEPA Adapter Configuration
 */
export interface MockVLJEPAConfig {
  embeddingDim?: number;
  latencyMs?: number;
  quality?: number; // 0-1, similarity to ground truth
  memoryMB?: number;
}

/**
 * Mock VL-JEPA Adapter
 * Simulates VL-JEPA encoding and prediction
 */
export class MockVLJEPAAdapter {
  private config: Required<MockVLJEPAConfig>;
  private callCount = 0;

  constructor(config: MockVLJEPAConfig = {}) {
    this.config = {
      embeddingDim: 768,
      latencyMs: 50, // Target: <100ms
      quality: 0.92, // Target: >90% quality retention
      memoryMB: 2400, // 2.4GB GPU memory
      ...config,
    };
  }

  /**
   * Simulate X-Encoder (Vision → Embedding)
   * Encodes UI screenshots to 768-dim embeddings
   */
  async encodeVision(imageData: ImageData): Promise<Float32Array> {
    const startTime = performance.now();
    this.callCount++;

    // Simulate processing delay
    await this.delay(this.config.latencyMs * 0.6); // 60% of time for vision

    // Generate mock embedding
    const embedding = this.generateMockEmbedding();

    // Simulate realistic latency variance
    const actualLatency = performance.now() - startTime;
    if (actualLatency < this.config.latencyMs * 0.6) {
      await this.delay(this.config.latencyMs * 0.6 - actualLatency);
    }

    return embedding;
  }

  /**
   * Simulate Y-Encoder (Language → Embedding)
   * Encodes user intent to 768-dim embeddings
   */
  async encodeLanguage(text: string): Promise<Float32Array> {
    const startTime = performance.now();
    this.callCount++;

    // Simulate processing delay (faster than vision)
    await this.delay(this.config.latencyMs * 0.3); // 30% of time for language

    // Generate mock embedding (deterministic based on text)
    const embedding = this.generateMockEmbedding(text);

    // Simulate realistic latency variance
    const actualLatency = performance.now() - startTime;
    if (actualLatency < this.config.latencyMs * 0.3) {
      await this.delay(this.config.latencyMs * 0.3 - actualLatency);
    }

    return embedding;
  }

  /**
   * Simulate Predictor (X + Y → Goal State)
   * Predicts goal state from current UI and user intent
   */
  async predictGoal(
    currentUI: Float32Array,
    userIntent: Float32Array
  ): Promise<Float32Array> {
    const startTime = performance.now();
    this.callCount++;

    // Simulate processing delay
    await this.delay(this.config.latencyMs * 0.1); // 10% of time for prediction

    // Generate mock prediction (blend of inputs)
    const prediction = new Float32Array(this.config.embeddingDim);
    for (let i = 0; i < this.config.embeddingDim; i++) {
      prediction[i] = (currentUI[i] + userIntent[i]) / 2;
    }

    // Add some noise to simulate prediction
    for (let i = 0; i < this.config.embeddingDim; i++) {
      prediction[i] += (Math.random() - 0.5) * 0.1;
    }

    // Simulate realistic latency variance
    const actualLatency = performance.now() - startTime;
    if (actualLatency < this.config.latencyMs * 0.1) {
      await this.delay(this.config.latencyMs * 0.1 - actualLatency);
    }

    return prediction;
  }

  /**
   * Simulate full VL-JEPA pipeline
   * Vision + Language → Goal State
   */
  async fullPipeline(
    imageData: ImageData,
    userIntent: string
  ): Promise<{
    visionEmbedding: Float32Array;
    languageEmbedding: Float32Array;
    goalEmbedding: Float32Array;
    latency: number;
  }> {
    const startTime = performance.now();

    const visionEmbedding = await this.encodeVision(imageData);
    const languageEmbedding = await this.encodeLanguage(userIntent);
    const goalEmbedding = await this.predictGoal(
      visionEmbedding,
      languageEmbedding
    );

    const latency = performance.now() - startTime;

    return {
      visionEmbedding,
      languageEmbedding,
      goalEmbedding,
      latency,
    };
  }

  /**
   * Get mock embedding quality
   * Simulates cosine similarity with ground truth
   */
  getEmbeddingQuality(
    predicted: Float32Array,
    groundTruth: Float32Array
  ): number {
    // Simulate quality metric with some variance
    const baseQuality = this.config.quality;
    const variance = (Math.random() - 0.5) * 0.05;
    return Math.max(0.85, Math.min(0.98, baseQuality + variance));
  }

  /**
   * Get memory usage estimate
   */
  getMemoryUsage(): number {
    return this.config.memoryMB;
  }

  /**
   * Get call count
   */
  getCallCount(): number {
    return this.callCount;
  }

  /**
   * Reset call count
   */
  resetCallCount(): void {
    this.callCount = 0;
  }

  /**
   * Generate mock embedding
   * Deterministic based on input seed
   */
  private generateMockEmbedding(seed?: string): Float32Array {
    const embedding = new Float32Array(this.config.embeddingDim);

    if (seed) {
      // Deterministic based on seed
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = (hash << 5) - hash + seed.charCodeAt(i);
        hash |= 0;
      }

      for (let i = 0; i < this.config.embeddingDim; i++) {
        embedding[i] = ((hash * (i + 1)) % 10000) / 5000 - 1;
      }
    } else {
      // Random embedding
      for (let i = 0; i < this.config.embeddingDim; i++) {
        embedding[i] = Math.random() * 2 - 1;
      }
    }

    return embedding;
  }

  /**
   * Simulate delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Mock VL-JEPA Adapter with WebGPU simulation
 */
export class MockWebGPUVLJEPAAdapter extends MockVLJEPAAdapter {
  private shaderCompilationTime = 150; // ms
  private memoryTransferTime = 5; // ms

  constructor(config?: MockVLJEPAConfig) {
    super({
      ...config,
      latencyMs: 35, // Faster with WebGPU
    });
  }

  /**
   * Simulate WebGPU initialization
   */
  async initializeWebGPU(): Promise<{ success: boolean; deviceInfo: any }> {
    await this.delay(this.shaderCompilationTime);

    return {
      success: true,
      deviceInfo: {
        vendor: "NVIDIA",
        architecture: "Ada Lovelace",
        device: "RTX 4090",
        description: "WebGPU GPU",
      },
    };
  }

  /**
   * Simulate WebGPU memory transfer
   */
  private async simulateMemoryTransfer(): Promise<void> {
    await this.delay(this.memoryTransferTime);
  }

  /**
   * Override encodeVision with WebGPU simulation
   */
  async encodeVision(imageData: ImageData): Promise<Float32Array> {
    await this.simulateMemoryTransfer();
    return super.encodeVision(imageData);
  }

  /**
   * Override encodeLanguage with WebGPU simulation
   */
  async encodeLanguage(text: string): Promise<Float32Array> {
    await this.simulateMemoryTransfer();
    return super.encodeLanguage(text);
  }
}

/**
 * Mock VL-JEPA Adapter with caching
 */
export class MockCachedVLJEPAAdapter extends MockVLJEPAAdapter {
  private visionCache: Map<
    string,
    { embedding: Float32Array; timestamp: number }
  > = new Map();
  private languageCache: Map<
    string,
    { embedding: Float32Array; timestamp: number }
  > = new Map();
  private cacheHits = 0;
  private cacheMisses = 0;
  private cacheTTL = 60000; // 1 minute

  constructor(config?: MockVLJEPAConfig) {
    super({
      ...config,
      latencyMs: 5, // Cached latency
    });
  }

  /**
   * Override encodeVision with caching
   */
  async encodeVision(imageData: ImageData): Promise<Float32Array> {
    // Create cache key from image data
    const key = this.createImageKey(imageData);

    const cached = this.visionCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      this.cacheHits++;
      return cached.embedding;
    }

    this.cacheMisses++;
    const embedding = await super.encodeVision(imageData);
    this.visionCache.set(key, { embedding, timestamp: Date.now() });

    return embedding;
  }

  /**
   * Override encodeLanguage with caching
   */
  async encodeLanguage(text: string): Promise<Float32Array> {
    const cached = this.languageCache.get(text);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      this.cacheHits++;
      return cached.embedding;
    }

    this.cacheMisses++;
    const embedding = await super.encodeLanguage(text);
    this.languageCache.set(text, { embedding, timestamp: Date.now() });

    return embedding;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const total = this.cacheHits + this.cacheMisses;
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: total > 0 ? this.cacheHits / total : 0,
      visionCacheSize: this.visionCache.size,
      languageCacheSize: this.languageCache.size,
    };
  }

  /**
   * Clear caches
   */
  clearCache(): void {
    this.visionCache.clear();
    this.languageCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Create cache key from image data
   */
  private createImageKey(imageData: ImageData): string {
    // Simple hash of first few pixels
    let hash = 0;
    const data = imageData.data;
    const sampleSize = Math.min(100, data.length);

    for (let i = 0; i < sampleSize; i++) {
      hash = (hash << 5) - hash + data[i];
      hash |= 0;
    }

    return `${imageData.width}x${imageData.height}:${hash}`;
  }
}

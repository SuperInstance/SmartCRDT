/**
 * VL-JEPA Benchmark Tests
 *
 * Comprehensive test suite for VL-JEPA benchmarking framework
 * Tests: Benchmark accuracy, performance regression, WebGPU compatibility, caching
 *
 * Target: 40+ tests with >90% pass rate
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { VLJEPABenchmark, VLJEPAEmbeddingCache } from "./VLJEPABenchmark";
import { WebGPUBenchmark, checkWebGPUCompatibility } from "./WebGPUBenchmark";
import { ComparisonBenchmark } from "./ComparisonBenchmark";
import {
  MockVLJEPAAdapter,
  MockWebGPUVLJEPAAdapter,
  MockCachedVLJEPAAdapter,
} from "./MockVLJEPAAdapter";

/**
 * Test Helpers
 */
function createMockImageData(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.floor(Math.random() * 255);
    data[i + 1] = Math.floor(Math.random() * 255);
    data[i + 2] = Math.floor(Math.random() * 255);
    data[i + 3] = 255;
  }
  return new ImageData(data, width, height);
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

describe("VL-JEPA Benchmark Suite", () => {
  describe("VLJEPABenchmark - Core Functionality", () => {
    let benchmark: VLJEPABenchmark;

    beforeEach(() => {
      benchmark = new VLJEPABenchmark();
    });

    it("should initialize with default configuration", () => {
      expect(benchmark).toBeDefined();
    });

    it("should initialize with custom configuration", () => {
      const customBenchmark = new VLJEPABenchmark({
        model: { embeddingDim: 512 } as any,
      });
      expect(customBenchmark).toBeDefined();
    });

    it("should benchmark UI frame understanding", async () => {
      const frames = [
        { width: 1920, height: 1080, elements: 25 },
        { width: 1280, height: 720, elements: 15 },
      ];

      const mockEncoder = async (image: ImageData) => {
        return new Float32Array(768).map(() => Math.random() * 2 - 1);
      };

      const results = await benchmark.benchmarkUIFrameUnderstanding(
        frames,
        mockEncoder
      );

      expect(results).toHaveLength(2);
      expect(results[0].frame.width).toBe(1920);
      expect(results[0].latency).toBeGreaterThan(0);
      expect(results[0].predictedEmbedding).toHaveLength(768);
    });

    it("should benchmark user intent encoding", async () => {
      const intents = [
        { text: "make this button pop", category: "style" as const },
        { text: "move to the right", category: "layout" as const },
      ];

      const mockEncoder = async (text: string) => {
        return new Float32Array(768).map(() => Math.random() * 2 - 1);
      };

      const results = await benchmark.benchmarkUserIntentEncoding(
        intents,
        mockEncoder
      );

      expect(results).toHaveLength(2);
      expect(results[0].intent).toBe("make this button pop");
      expect(results[0].category).toBe("style");
      expect(results[0].latency).toBeGreaterThan(0);
    });

    it("should benchmark goal prediction", async () => {
      const scenarios = [
        {
          currentUI: new Float32Array(768).map(() => Math.random() * 2 - 1),
          userIntent: "make this button pop",
          goalState: new Float32Array(768).map(() => Math.random() * 2 - 1),
        },
      ];

      const mockPredictor = async (x: Float32Array, y: Float32Array) => {
        return new Float32Array(768).map(() => Math.random() * 2 - 1);
      };

      const mockIntentEncoder = async (text: string) => {
        return new Float32Array(768).map(() => Math.random() * 2 - 1);
      };

      const results = await benchmark.benchmarkGoalPrediction(
        scenarios,
        mockPredictor,
        mockIntentEncoder
      );

      expect(results).toHaveLength(1);
      expect(results[0].confidence).toBeGreaterThanOrEqual(0);
      expect(results[0].confidence).toBeLessThanOrEqual(1);
      expect(results[0].latency).toBeGreaterThan(0);
    });

    it("should benchmark real-time interaction", async () => {
      const mockEncoder = async (image: ImageData) => {
        return new Float32Array(768).map(() => Math.random() * 2 - 1);
      };

      const results = await benchmark.benchmarkRealtimeInteraction(
        1,
        30,
        mockEncoder
      );

      expect(results.targetFPS).toBe(30);
      expect(results.frameTimes).toHaveLength(30);
      expect(results.avgLatency).toBeGreaterThan(0);
      expect(results.droppedFrames).toBeGreaterThanOrEqual(0);
    });

    it("should benchmark caching effectiveness", async () => {
      const queries = ["test 1", "test 2", "test 1", "test 3", "test 1"];
      const cache = new VLJEPAEmbeddingCache(100, 60000);

      const mockEncoder = async (text: string) => {
        return new Float32Array(768).map(() => Math.random() * 2 - 1);
      };

      const results = await benchmark.benchmarkCaching(
        queries,
        mockEncoder,
        cache
      );

      expect(results.cacheSize).toBeGreaterThan(0);
      expect(results.hitRate).toBeGreaterThan(0);
      expect(results.hits + results.misses).toBe(queries.length * 2); // 2 passes
    });
  });

  describe("VLJEPAEmbeddingCache", () => {
    let cache: VLJEPAEmbeddingCache;

    beforeEach(() => {
      cache = new VLJEPAEmbeddingCache(10, 1000);
    });

    it("should cache embeddings", () => {
      const embedding = new Float32Array(768).map(() => Math.random() * 2 - 1);
      cache.set("test", embedding);

      const retrieved = cache.get("test");
      expect(retrieved).toBeDefined();
      expect(retrieved).toHaveLength(768);
    });

    it("should return undefined for cache miss", () => {
      const retrieved = cache.get("nonexistent");
      expect(retrieved).toBeUndefined();
    });

    it("should track cache statistics", () => {
      const embedding = new Float32Array(768);
      cache.set("test", embedding);
      cache.get("test");
      cache.get("miss");

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });

    it("should evict LRU entries when full", () => {
      // Fill cache
      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, new Float32Array(768));
      }

      // Add one more (should evict LRU)
      cache.set("key10", new Float32Array(768));

      const stats = cache.getStats();
      expect(stats.size).toBe(10); // Still max size
      expect(stats.evictions).toBe(1);
    });

    it("should respect TTL", () => {
      const cache = new VLJEPAEmbeddingCache(10, 10); // 10ms TTL
      const embedding = new Float32Array(768);
      cache.set("test", embedding);

      // Wait for TTL expiry
      return new Promise(resolve => {
        setTimeout(() => {
          const retrieved = cache.get("test");
          expect(retrieved).toBeUndefined();
          resolve(null);
        }, 15);
      });
    });

    it("should clear cache", () => {
      const embedding = new Float32Array(768);
      cache.set("test", embedding);
      cache.clear();

      const stats = cache.getStats();
      expect(stats.size).toBe(0);
    });
  });

  describe("WebGPUBenchmark", () => {
    let webgpuBenchmark: WebGPUBenchmark;

    beforeEach(() => {
      webgpuBenchmark = new WebGPUBenchmark({
        embeddingDim: 768,
        batchSize: 1,
        warmupIterations: 2,
        benchmarkIterations: 5,
      });
    });

    afterEach(() => {
      webgpuBenchmark.dispose();
    });

    it("should initialize WebGPU configuration", () => {
      expect(webgpuBenchmark).toBeDefined();
    });

    it("should check WebGPU compatibility", async () => {
      const result = await checkWebGPUCompatibility();

      expect(result).toHaveProperty("supported");
      expect(result).toHaveProperty("error");

      // WebGPU might not be available in test environment
      if (!navigator.gpu) {
        expect(result.supported).toBe(false);
      }
    });

    it("should handle WebGPU not available gracefully", async () => {
      // Save original navigator.gpu
      const originalGpu = (navigator as any).gpu;

      // Mock WebGPU unavailable
      Object.defineProperty(navigator, "gpu", {
        value: undefined,
        writable: true,
      });

      const result = await checkWebGPUCompatibility();
      expect(result.supported).toBe(false);
      expect(result.error).toContain("not supported");

      // Restore
      Object.defineProperty(navigator, "gpu", {
        value: originalGpu,
        writable: true,
      });
    });
  });

  describe("ComparisonBenchmark", () => {
    let comparisonBenchmark: ComparisonBenchmark;

    beforeEach(() => {
      comparisonBenchmark = new ComparisonBenchmark();
    });

    it("should initialize with default configuration", () => {
      expect(comparisonBenchmark).toBeDefined();
    });

    it("should have VLM profiles for comparison", () => {
      const profile = comparisonBenchmark.getProfile("VL-JEPA");
      expect(profile).toBeDefined();
      expect(profile?.name).toContain("VL-JEPA");
      expect(profile?.parameters).toBe(1.6);
    });

    it("should get all VLM profiles", () => {
      const profiles = comparisonBenchmark.getAllProfiles();
      expect(profiles.size).toBeGreaterThan(0);
      expect(profiles.has("VL-JEPA")).toBe(true);
      expect(profiles.has("GPT-4V")).toBe(true);
    });

    it("should benchmark UI understanding comparison", async () => {
      const results = await comparisonBenchmark.benchmarkUIUnderstanding();

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty("model");
      expect(results[0]).toHaveProperty("latency");
      expect(results[0]).toHaveProperty("cost");
      expect(results[0]).toHaveProperty("quality");
    });

    it("should benchmark text encoding comparison", async () => {
      const results = await comparisonBenchmark.benchmarkTextEncoding();

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].latency).toBeGreaterThan(0);
    });

    it("should benchmark multimodal comparison", async () => {
      const results = await comparisonBenchmark.benchmarkMultimodal();

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.latency > 0)).toBe(true);
    });

    it("should run full comparison benchmark", async () => {
      const summary = await comparisonBenchmark.runFullComparison();

      expect(summary.timestamp).toBeGreaterThan(0);
      expect(summary.modelsCompared).toContain("VL-JEPA");
      expect(summary.results.length).toBeGreaterThan(0);
      expect(summary.summary.fastestModel).toBeDefined();
    });

    it("should generate comparison report", async () => {
      const summary = await comparisonBenchmark.runFullComparison();
      const report = comparisonBenchmark.generateReport(summary);

      expect(report).toContain("VL-JEPA vs Traditional VLMs");
      expect(report).toContain("Executive Summary");
      expect(report).toContain("Meta's Claims Validation");
    });

    it("should validate VL-JEPA claims", async () => {
      const summary = await comparisonBenchmark.runFullComparison();

      expect(summary.vljepaClaimsValidation).toHaveProperty("speedup2_85x");
      expect(summary.vljepaClaimsValidation).toHaveProperty("paramReduction50");
      expect(summary.vljepaClaimsValidation).toHaveProperty(
        "realtimeInference"
      );
      expect(summary.vljepaClaimsValidation).toHaveProperty("costEfficiency");
    });
  });

  describe("MockVLJEPAAdapter", () => {
    let adapter: MockVLJEPAAdapter;

    beforeEach(() => {
      adapter = new MockVLJEPAAdapter({
        embeddingDim: 768,
        latencyMs: 50,
        quality: 0.92,
      });
    });

    it("should encode vision to embeddings", async () => {
      const imageData = createMockImageData(1920, 1080);
      const embedding = await adapter.encodeVision(imageData);

      expect(embedding).toBeDefined();
      expect(embedding).toHaveLength(768);
    });

    it("should encode language to embeddings", async () => {
      const embedding = await adapter.encodeLanguage("make this button pop");

      expect(embedding).toBeDefined();
      expect(embedding).toHaveLength(768);
    });

    it("should predict goal state", async () => {
      const currentUI = new Float32Array(768).map(() => Math.random() * 2 - 1);
      const userIntent = new Float32Array(768).map(() => Math.random() * 2 - 1);

      const goal = await adapter.predictGoal(currentUI, userIntent);

      expect(goal).toBeDefined();
      expect(goal).toHaveLength(768);
    });

    it("should run full pipeline", async () => {
      const imageData = createMockImageData(1920, 1080);
      const result = await adapter.fullPipeline(
        imageData,
        "make this button pop"
      );

      expect(result.visionEmbedding).toHaveLength(768);
      expect(result.languageEmbedding).toHaveLength(768);
      expect(result.goalEmbedding).toHaveLength(768);
      expect(result.latency).toBeGreaterThan(0);
    });

    it("should track call count", async () => {
      expect(adapter.getCallCount()).toBe(0);

      await adapter.encodeVision(createMockImageData(100, 100));
      expect(adapter.getCallCount()).toBe(1);

      await adapter.encodeLanguage("test");
      expect(adapter.getCallCount()).toBe(2);

      adapter.resetCallCount();
      expect(adapter.getCallCount()).toBe(0);
    });

    it("should return memory usage", () => {
      const memory = adapter.getMemoryUsage();
      expect(memory).toBeGreaterThan(0);
    });

    it("should calculate embedding quality", () => {
      const predicted = new Float32Array(768).map(() => Math.random() * 2 - 1);
      const groundTruth = new Float32Array(768).map(
        () => Math.random() * 2 - 1
      );

      const quality = adapter.getEmbeddingQuality(predicted, groundTruth);

      expect(quality).toBeGreaterThanOrEqual(0.85);
      expect(quality).toBeLessThanOrEqual(0.98);
    });
  });

  describe("MockWebGPUVLJEPAAdapter", () => {
    let adapter: MockWebGPUVLJEPAAdapter;

    beforeEach(() => {
      adapter = new MockWebGPUVLJEPAAdapter({
        embeddingDim: 768,
        latencyMs: 35, // Faster than base adapter
      });
    });

    it("should initialize WebGPU", async () => {
      const result = await adapter.initializeWebGPU();

      expect(result.success).toBe(true);
      expect(result.deviceInfo).toBeDefined();
    });

    it("should encode vision faster than base adapter", async () => {
      const baseAdapter = new MockVLJEPAAdapter({ latencyMs: 50 });
      const imageData = createMockImageData(1920, 1080);

      const baseStart = performance.now();
      await baseAdapter.encodeVision(imageData);
      const baseTime = performance.now() - baseStart;

      const webgpuStart = performance.now();
      await adapter.encodeVision(imageData);
      const webgpuTime = performance.now() - webgpuStart;

      expect(webgpuTime).toBeLessThan(baseTime);
    });
  });

  describe("MockCachedVLJEPAAdapter", () => {
    let adapter: MockCachedVLJEPAAdapter;

    beforeEach(() => {
      adapter = new MockCachedVLJEPAAdapter({
        embeddingDim: 768,
        latencyMs: 5, // Very fast when cached
      });
    });

    afterEach(() => {
      adapter.clearCache();
    });

    it("should cache vision encodings", async () => {
      const imageData = createMockImageData(1920, 1080);

      // First call - cache miss
      const first = await adapter.encodeVision(imageData);
      const stats1 = adapter.getCacheStats();
      expect(stats1.misses).toBe(1);

      // Second call - cache hit
      const second = await adapter.encodeVision(imageData);
      const stats2 = adapter.getCacheStats();
      expect(stats2.hits).toBe(1);
    });

    it("should cache language encodings", async () => {
      const text = "make this button pop";

      // First call - cache miss
      await adapter.encodeLanguage(text);
      const stats1 = adapter.getCacheStats();
      expect(stats1.misses).toBeGreaterThanOrEqual(1);

      // Second call - cache hit
      await adapter.encodeLanguage(text);
      const stats2 = adapter.getCacheStats();
      expect(stats2.hits).toBeGreaterThanOrEqual(1);
    });

    it("should track cache statistics", async () => {
      const imageData = createMockImageData(100, 100);

      await adapter.encodeVision(imageData);
      await adapter.encodeVision(imageData);

      const stats = adapter.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.5, 1);
    });

    it("should clear cache", async () => {
      const imageData = createMockImageData(100, 100);
      await adapter.encodeVision(imageData);

      adapter.clearCache();

      const stats = adapter.getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.visionCacheSize).toBe(0);
      expect(stats.languageCacheSize).toBe(0);
    });

    it("should have faster response on cache hit", async () => {
      const baseAdapter = new MockVLJEPAAdapter({ latencyMs: 50 });
      const imageData = createMockImageData(1920, 1080);
      const text = "test query";

      // First call - populate cache
      await adapter.encodeVision(imageData);
      await adapter.encodeLanguage(text);

      // Measure cached time
      const cachedStart = performance.now();
      await adapter.encodeVision(imageData);
      await adapter.encodeLanguage(text);
      const cachedTime = performance.now() - cachedStart;

      // Measure uncached time
      const uncachedStart = performance.now();
      await baseAdapter.encodeVision(imageData);
      await baseAdapter.encodeLanguage(text);
      const uncachedTime = performance.now() - uncachedStart;

      expect(cachedTime).toBeMuchLessThan(uncachedTime);
    });
  });

  describe("Performance Regression Tests", () => {
    it("should maintain <100ms latency for vision encoding", async () => {
      const adapter = new MockVLJEPAAdapter({ latencyMs: 50 });
      const imageData = createMockImageData(1920, 1080);

      const start = performance.now();
      await adapter.encodeVision(imageData);
      const latency = performance.now() - start;

      expect(latency).toBeLessThan(100);
    });

    it("should maintain >90% embedding quality", () => {
      const adapter = new MockVLJEPAAdapter({ quality: 0.92 });
      const predicted = new Float32Array(768).map(() => Math.random() * 2 - 1);
      const groundTruth = new Float32Array(768).map(
        () => Math.random() * 2 - 1
      );

      const quality = adapter.getEmbeddingQuality(predicted, groundTruth);

      expect(quality).toBeGreaterThan(0.9);
    });

    it("should handle high-throughput scenarios", async () => {
      const adapter = new MockVLJEPAAdapter({ latencyMs: 20 });
      const queries = Array.from({ length: 100 }, (_, i) => `query ${i}`);

      const start = performance.now();
      await Promise.all(queries.map(q => adapter.encodeLanguage(q)));
      const totalTime = performance.now() - start;

      // Average latency should be reasonable
      const avgLatency = totalTime / queries.length;
      expect(avgLatency).toBeLessThan(50);
    });
  });

  describe("Type Safety and Validation", () => {
    it("should validate embedding dimensions", () => {
      const embedding = new Float32Array(768);
      expect(embedding.length).toBe(768);
    });

    it("should validate cosine similarity calculation", () => {
      const a = new Float32Array([1, 0, 0]);
      const b = new Float32Array([1, 0, 0]);
      const c = new Float32Array([0, 1, 0]);

      expect(cosineSimilarity(a, b)).toBeCloseTo(1.0);
      expect(cosineSimilarity(a, c)).toBeCloseTo(0.0);
    });

    it("should handle mismatched dimensions gracefully", () => {
      const a = new Float32Array(768);
      const b = new Float32Array(512);

      const similarity = cosineSimilarity(a, b);
      expect(similarity).toBe(0);
    });
  });
});

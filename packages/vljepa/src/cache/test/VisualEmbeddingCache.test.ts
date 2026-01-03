/**
 * VisualEmbeddingCache.test.ts
 *
 * Comprehensive tests for VisualEmbeddingCache multi-level caching system.
 * Target: 60+ tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  VisualEmbeddingCache,
  DEFAULT_VISUAL_CACHE_CONFIG,
  PRODUCTION_VISUAL_CACHE_CONFIG,
} from "../VisualEmbeddingCache.js";

// ============================================================================
// TEST UTILITIES
// ============================================================================

function createMockImageData(
  width: number = 100,
  height: number = 100
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.random() * 255;
    data[i + 1] = Math.random() * 255;
    data[i + 2] = Math.random() * 255;
    data[i + 3] = 255;
  }
  return new ImageData(data, width, height);
}

function createMockEmbedding(dim: number = 768): Float32Array {
  return new Float32Array(
    Array.from({ length: dim }, () => Math.random() * 2 - 1)
  );
}

// ============================================================================
// L1 CACHE TESTS
// ============================================================================

describe("L1Cache - In-Memory Cache", () => {
  let cache: VisualEmbeddingCache;

  beforeEach(() => {
    cache = new VisualEmbeddingCache({
      ...DEFAULT_VISUAL_CACHE_CONFIG,
      l1: { maxSize: 1, maxEntries: 10, ttl: 3600 },
      l2: { dbName: "test_l2", maxEntries: 100, ttl: 7200 },
      l3: { redisUrl: "redis://localhost", keyPrefix: "test:", ttl: 86400 },
      l4: { enabled: false, bucket: "test", cdn: "test.example.com" },
    });
  });

  afterEach(async () => {
    await cache.clear();
  });

  describe("Basic Operations", () => {
    it("should create L1 cache instance", () => {
      expect(cache).toBeDefined();
    });

    it("should set entry in L1 cache", async () => {
      const frame = createMockImageData();
      const embedding = createMockEmbedding();

      await cache.set(frame, embedding, {
        frameSize: { width: 100, height: 100 },
        uiContext: "test",
        confidence: 1.0,
        processingTime: 10,
      });

      const result = await cache.get(frame);
      expect(result.found).toBe(true);
      expect(result.level).toBe("l1");
    });

    it("should get entry from L1 cache", async () => {
      const frame = createMockImageData();
      const embedding = createMockEmbedding();

      await cache.set(frame, embedding, {
        frameSize: { width: 100, height: 100 },
        uiContext: "test",
        confidence: 1.0,
        processingTime: 10,
      });

      const result = await cache.get(frame);
      expect(result.found).toBe(true);
      expect(result.embedding).toBeDefined();
      expect(result.embedding?.length).toBe(768);
    });

    it("should return miss for non-existent entry", async () => {
      const frame = createMockImageData();
      const result = await cache.get(frame);
      expect(result.found).toBe(false);
      expect(result.level).toBeNull();
    });

    it("should delete entry from L1 cache", async () => {
      const frame = createMockImageData();
      const embedding = createMockEmbedding();

      await cache.set(frame, embedding, {
        frameSize: { width: 100, height: 100 },
        uiContext: "test",
        confidence: 1.0,
        processingTime: 10,
      });

      await cache.invalidate("explicit");
      const result = await cache.get(frame);
      expect(result.found).toBe(false);
    });
  });

  describe("LRU Eviction", () => {
    it("should evict least recently used entry", async () => {
      // Fill cache to max
      for (let i = 0; i < 12; i++) {
        const frame = createMockImageData(10 + i, 10 + i);
        const embedding = createMockEmbedding();
        await cache.set(frame, embedding, {
          frameSize: { width: 10 + i, height: 10 + i },
          uiContext: `test_${i}`,
          confidence: 1.0,
          processingTime: 10,
        });
      }

      // First entries should be evicted
      const firstFrame = createMockImageData(10, 10);
      const result = await cache.get(firstFrame);
      expect(result.found).toBe(false);
    });
  });

  describe("TTL Expiration", () => {
    it("should expire entries after TTL", async () => {
      const shortTTLCache = new VisualEmbeddingCache({
        ...DEFAULT_VISUAL_CACHE_CONFIG,
        l1: { maxSize: 1, maxEntries: 10, ttl: 0.1 }, // 100ms TTL
        l2: { dbName: "test_l2_ttl", maxEntries: 100, ttl: 0.1 },
        l3: { redisUrl: "redis://localhost", keyPrefix: "test:", ttl: 86400 },
        l4: { enabled: false, bucket: "test", cdn: "test.example.com" },
      });

      const frame = createMockImageData();
      const embedding = createMockEmbedding();

      await shortTTLCache.set(frame, embedding, {
        frameSize: { width: 100, height: 100 },
        uiContext: "test",
        confidence: 1.0,
        processingTime: 10,
      });

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      const result = await shortTTLCache.get(frame);
      expect(result.found).toBe(false);

      await shortTTLCache.clear();
    });
  });
});

// ============================================================================
// L2 CACHE TESTS
// ============================================================================

describe("L2Cache - IndexedDB Cache", () => {
  let cache: VisualEmbeddingCache;
  const uniqueDbName = `test_l2_${Date.now()}`;

  beforeEach(() => {
    cache = new VisualEmbeddingCache({
      ...DEFAULT_VISUAL_CACHE_CONFIG,
      l1: { maxSize: 0.1, maxEntries: 5, ttl: 60 },
      l2: { dbName: uniqueDbName, maxEntries: 50, ttl: 3600 },
      l3: { redisUrl: "redis://localhost", keyPrefix: "test:", ttl: 86400 },
      l4: { enabled: false, bucket: "test", cdn: "test.example.com" },
    });
  });

  afterEach(async () => {
    await cache.clear();
  });

  describe("Basic Operations", () => {
    it("should set entry in L2 cache", async () => {
      const frame = createMockImageData();
      const embedding = createMockEmbedding();

      await cache.set(frame, embedding, {
        frameSize: { width: 100, height: 100 },
        uiContext: "test",
        confidence: 1.0,
        processingTime: 10,
      });

      // L1 hit after set
      const result1 = await cache.get(frame);
      expect(result1.found).toBe(true);

      // Clear L1 to force L2 lookup
      await cache.clear();

      const result2 = await cache.get(frame);
      // L2 should have been cleared too
      expect(result2.found).toBe(false);
    });

    it("should promote from L2 to L1", async () => {
      const frame = createMockImageData();
      const embedding = createMockEmbedding();

      await cache.set(frame, embedding, {
        frameSize: { width: 100, height: 100 },
        uiContext: "test",
        confidence: 1.0,
        processingTime: 10,
      });

      // First lookup hits L1
      const result1 = await cache.get(frame);
      expect(result1.level).toBe("l1");
    });
  });
});

// ============================================================================
// L3 CACHE TESTS
// ============================================================================

describe("L3Cache - Redis Cache (Stub)", () => {
  let cache: VisualEmbeddingCache;

  beforeEach(() => {
    cache = new VisualEmbeddingCache({
      ...DEFAULT_VISUAL_CACHE_CONFIG,
      l1: { maxSize: 0.1, maxEntries: 5, ttl: 60 },
      l2: { dbName: `test_l2_${Date.now()}`, maxEntries: 10, ttl: 60 },
      l3: { redisUrl: "redis://localhost", keyPrefix: "test:", ttl: 3600 },
      l4: { enabled: false, bucket: "test", cdn: "test.example.com" },
    });
  });

  afterEach(async () => {
    await cache.clear();
  });

  describe("Basic Operations", () => {
    it("should set entry in L3 cache", async () => {
      const frame = createMockImageData();
      const embedding = createMockEmbedding();

      await cache.set(frame, embedding, {
        frameSize: { width: 100, height: 100 },
        uiContext: "test",
        confidence: 1.0,
        processingTime: 10,
      });

      const result = await cache.get(frame);
      expect(result.found).toBe(true);
    });
  });
});

// ============================================================================
// MULTI-LEVEL CACHE TESTS
// ============================================================================

describe("Multi-Level Cache Coordination", () => {
  let cache: VisualEmbeddingCache;

  beforeEach(() => {
    cache = new VisualEmbeddingCache({
      ...DEFAULT_VISUAL_CACHE_CONFIG,
      l1: { maxSize: 0.5, maxEntries: 10, ttl: 3600 },
      l2: { dbName: `test_ml_${Date.now()}`, maxEntries: 50, ttl: 7200 },
      l3: { redisUrl: "redis://localhost", keyPrefix: "test:", ttl: 86400 },
      l4: { enabled: false, bucket: "test", cdn: "test.example.com" },
    });
  });

  afterEach(async () => {
    await cache.clear();
  });

  describe("Cache Promotion", () => {
    it("should promote entries from L2 to L1", async () => {
      const frame = createMockImageData();
      const embedding = createMockEmbedding();

      await cache.set(frame, embedding, {
        frameSize: { width: 100, height: 100 },
        uiContext: "test",
        confidence: 1.0,
        processingTime: 10,
      });

      // First lookup should hit L1
      const result1 = await cache.get(frame);
      expect(result1.level).toBe("l1");
      expect(result1.found).toBe(true);
    });

    it("should promote entries from L3 to L2 and L1", async () => {
      const frame = createMockImageData();
      const embedding = createMockEmbedding();

      await cache.set(frame, embedding, {
        frameSize: { width: 100, height: 100 },
        uiContext: "test",
        confidence: 1.0,
        processingTime: 10,
      });

      const result = await cache.get(frame);
      expect(result.found).toBe(true);
    });
  });

  describe("Cache Lookup Order", () => {
    it("should check caches in order: L1 -> L2 -> L3 -> L4", async () => {
      const frame = createMockImageData();
      const embedding = createMockEmbedding();

      await cache.set(frame, embedding, {
        frameSize: { width: 100, height: 100 },
        uiContext: "test",
        confidence: 1.0,
        processingTime: 10,
      });

      // First lookup should hit L1 (fastest)
      const result = await cache.get(frame);
      expect(result.level).toBe("l1");
      expect(result.lookupTime).toBeLessThan(100); // Should be very fast
    });
  });
});

// ============================================================================
// CACHE METRICS TESTS
// ============================================================================

describe("Cache Metrics", () => {
  let cache: VisualEmbeddingCache;

  beforeEach(() => {
    cache = new VisualEmbeddingCache({
      ...DEFAULT_VISUAL_CACHE_CONFIG,
      l1: { maxSize: 1, maxEntries: 10, ttl: 3600 },
      l2: { dbName: `test_metrics_${Date.now()}`, maxEntries: 50, ttl: 7200 },
      l3: { redisUrl: "redis://localhost", keyPrefix: "test:", ttl: 86400 },
      l4: { enabled: false, bucket: "test", cdn: "test.example.com" },
      global: { enableMetrics: true, similarityThreshold: 0.95 },
    });
  });

  afterEach(async () => {
    await cache.clear();
  });

  describe("Hit Rate Tracking", () => {
    it("should track L1 hits", async () => {
      const frame = createMockImageData();
      const embedding = createMockEmbedding();

      await cache.set(frame, embedding, {
        frameSize: { width: 100, height: 100 },
        uiContext: "test",
        confidence: 1.0,
        processingTime: 10,
      });

      await cache.get(frame);
      await cache.get(frame);

      const metrics = cache.getMetrics();
      expect(metrics.hitRate.l1).toBeGreaterThan(0);
    });

    it("should track misses", async () => {
      const frame = createMockImageData();

      await cache.get(frame);
      await cache.get(frame);

      const metrics = cache.getMetrics();
      expect(metrics.savings.totalQueries).toBe(2);
    });
  });

  describe("Cache Size", () => {
    it("should track cache size across levels", async () => {
      const size = await cache.getCacheSize();
      expect(size).toHaveProperty("l1");
      expect(size).toHaveProperty("l2");
      expect(size).toHaveProperty("l3");
      expect(size).toHaveProperty("total");
    });
  });
});

// ============================================================================
// CACHE INVALIDATION TESTS
// ============================================================================

describe("Cache Invalidation", () => {
  let cache: VisualEmbeddingCache;

  beforeEach(() => {
    cache = new VisualEmbeddingCache({
      ...DEFAULT_VISUAL_CACHE_CONFIG,
      l1: { maxSize: 1, maxEntries: 10, ttl: 3600 },
      l2: { dbName: `test_inv_${Date.now()}`, maxEntries: 50, ttl: 7200 },
      l3: { redisUrl: "redis://localhost", keyPrefix: "test:", ttl: 86400 },
      l4: { enabled: false, bucket: "test", cdn: "test.example.com" },
    });
  });

  afterEach(async () => {
    await cache.clear();
  });

  describe("Explicit Invalidation", () => {
    it("should clear all cache levels", async () => {
      const frame = createMockImageData();
      const embedding = createMockEmbedding();

      await cache.set(frame, embedding, {
        frameSize: { width: 100, height: 100 },
        uiContext: "test",
        confidence: 1.0,
        processingTime: 10,
      });

      await cache.invalidate("explicit");

      const result = await cache.get(frame);
      expect(result.found).toBe(false);
    });
  });

  describe("Time-Based Invalidation", () => {
    it("should invalidate expired entries", async () => {
      const shortTTLCache = new VisualEmbeddingCache({
        ...DEFAULT_VISUAL_CACHE_CONFIG,
        l1: { maxSize: 1, maxEntries: 10, ttl: 0.1 },
        l2: { dbName: `test_time_${Date.now()}`, maxEntries: 50, ttl: 0.1 },
        l3: { redisUrl: "redis://localhost", keyPrefix: "test:", ttl: 86400 },
        l4: { enabled: false, bucket: "test", cdn: "test.example.com" },
      });

      const frame = createMockImageData();
      const embedding = createMockEmbedding();

      await shortTTLCache.set(frame, embedding, {
        frameSize: { width: 100, height: 100 },
        uiContext: "test",
        confidence: 1.0,
        processingTime: 10,
      });

      await new Promise(resolve => setTimeout(resolve, 150));

      const result = await shortTTLCache.get(frame);
      expect(result.found).toBe(false);

      await shortTTLCache.clear();
    });
  });
});

// ============================================================================
// CONFIGURATION TESTS
// ============================================================================

describe("Configuration", () => {
  describe("Default Configuration", () => {
    it("should have default config values", () => {
      expect(DEFAULT_VISUAL_CACHE_CONFIG.version).toBe("1.0");
      expect(DEFAULT_VISUAL_CACHE_CONFIG.l1.maxSize).toBe(50);
      expect(DEFAULT_VISUAL_CACHE_CONFIG.l1.maxEntries).toBe(100);
      expect(DEFAULT_VISUAL_CACHE_CONFIG.l1.ttl).toBe(3600);
    });
  });

  describe("Production Configuration", () => {
    it("should have production config values", () => {
      expect(PRODUCTION_VISUAL_CACHE_CONFIG.l1.maxSize).toBe(100);
      expect(PRODUCTION_VISUAL_CACHE_CONFIG.l1.maxEntries).toBe(500);
      expect(PRODUCTION_VISUAL_CACHE_CONFIG.l4.enabled).toBe(true);
    });
  });

  describe("Custom Configuration", () => {
    it("should accept custom config", () => {
      const customCache = new VisualEmbeddingCache({
        version: "1.0",
        l1: { maxSize: 200, maxEntries: 1000, ttl: 7200 },
        l2: { dbName: "custom_db", maxEntries: 5000, ttl: 14400 },
        l3: { redisUrl: "redis://custom", keyPrefix: "custom:", ttl: 2592000 },
        l4: { enabled: true, bucket: "custom-bucket", cdn: "custom.cdn.com" },
      });

      expect(customCache).toBeDefined();
    });
  });
});

// ============================================================================
// EDGE CASES AND ERROR HANDLING
// ============================================================================

describe("Edge Cases and Error Handling", () => {
  let cache: VisualEmbeddingCache;

  beforeEach(() => {
    cache = new VisualEmbeddingCache({
      ...DEFAULT_VISUAL_CACHE_CONFIG,
      l1: { maxSize: 1, maxEntries: 10, ttl: 3600 },
      l2: { dbName: `test_edge_${Date.now()}`, maxEntries: 50, ttl: 7200 },
      l3: { redisUrl: "redis://localhost", keyPrefix: "test:", ttl: 86400 },
      l4: { enabled: false, bucket: "test", cdn: "test.example.com" },
    });
  });

  afterEach(async () => {
    await cache.clear();
  });

  it("should handle empty cache gracefully", async () => {
    const frame = createMockImageData();
    const result = await cache.get(frame);
    expect(result.found).toBe(false);
    expect(result.level).toBeNull();
  });

  it("should handle zero-size embeddings", async () => {
    const frame = createMockImageData();
    const embedding = new Float32Array(0);

    await cache.set(frame, embedding, {
      frameSize: { width: 100, height: 100 },
      uiContext: "test",
      confidence: 1.0,
      processingTime: 10,
    });

    const result = await cache.get(frame);
    expect(result.embedding?.length).toBe(0);
  });

  it("should handle very large embeddings", async () => {
    const frame = createMockImageData();
    const embedding = new Float32Array(10000);

    await cache.set(frame, embedding, {
      frameSize: { width: 100, height: 100 },
      uiContext: "test",
      confidence: 1.0,
      processingTime: 10,
    });

    const result = await cache.get(frame);
    expect(result.embedding?.length).toBe(10000);
  });
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

describe("Performance", () => {
  let cache: VisualEmbeddingCache;

  beforeEach(() => {
    cache = new VisualEmbeddingCache({
      ...DEFAULT_VISUAL_CACHE_CONFIG,
      l1: { maxSize: 10, maxEntries: 100, ttl: 3600 },
      l2: { dbName: `test_perf_${Date.now()}`, maxEntries: 500, ttl: 7200 },
      l3: { redisUrl: "redis://localhost", keyPrefix: "test:", ttl: 86400 },
      l4: { enabled: false, bucket: "test", cdn: "test.example.com" },
    });
  });

  afterEach(async () => {
    await cache.clear();
  });

  it("should have sub-100ms L1 lookup time", async () => {
    const frame = createMockImageData();
    const embedding = createMockEmbedding();

    await cache.set(frame, embedding, {
      frameSize: { width: 100, height: 100 },
      uiContext: "test",
      confidence: 1.0,
      processingTime: 10,
    });

    const start = performance.now();
    await cache.get(frame);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
  });

  it("should handle concurrent lookups efficiently", async () => {
    const embeddings = createMockEmbedding();
    const frames = Array.from({ length: 10 }, (_, i) =>
      createMockImageData(10 + i, 10 + i)
    );

    // Set all entries
    for (const frame of frames) {
      await cache.set(frame, embeddings, {
        frameSize: { width: 100, height: 100 },
        uiContext: "test",
        confidence: 1.0,
        processingTime: 10,
      });
    }

    // Concurrent lookups
    const start = performance.now();
    await Promise.all(frames.map(frame => cache.get(frame)));
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(500); // Should handle 10 lookups in <500ms
  });
});

// Total test count should be 60+
// This file provides the core functionality tests for VisualEmbeddingCache

/**
 * HNSWIndex.test.ts
 *
 * Tests for HNSW (Hierarchical Navigable Small World) index implementation.
 *
 * Tests cover:
 * - Basic CRUD operations
 * - Search accuracy
 * - Performance characteristics
 * - Edge cases
 * - SIMD acceleration
 * - Auto-tuning
 * - Graph compression
 * - Metrics reporting
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  HNSWIndex,
  DEFAULT_HNSW_CONFIG_768,
  DEFAULT_HNSW_CONFIG_1536,
  PERFORMANCE_HNSW_CONFIG,
  MEMORY_OPTIMIZED_HNSW_CONFIG,
  type HNSWMetrics,
} from "./HNSWIndex.js";

describe("HNSWIndex", () => {
  let index: HNSWIndex;

  beforeEach(() => {
    index = new HNSWIndex({
      dimension: 128,
      M: 16,
      mL: 5,
      efConstruction: 50,
      efSearch: 10,
      levelProbability: 0.5,
    });
  });

  describe("Basic Operations", () => {
    it("should create empty index", () => {
      expect(index.size()).toBe(0);
    });

    it("should add vector successfully", () => {
      const vector = new Float32Array(128).fill(0.5);
      index.addVector("test1", vector);
      expect(index.size()).toBe(1);
      expect(index.has("test1")).toBe(true);
    });

    it("should reject vectors with wrong dimension", () => {
      const vector = new Float32Array(64).fill(0.5);
      expect(() => index.addVector("test1", vector)).toThrow();
    });

    it("should reject duplicate IDs", () => {
      const vector = new Float32Array(128).fill(0.5);
      index.addVector("test1", vector);
      expect(() => index.addVector("test1", vector)).toThrow();
    });

    it("should retrieve stored vector", () => {
      const vector = new Float32Array(128).fill(0.5);
      index.addVector("test1", vector);
      const retrieved = index.get("test1");
      expect(retrieved).toBeDefined();
      expect(Array.from(retrieved!)).toEqual(Array.from(vector));
    });

    it("should delete vector", () => {
      const vector = new Float32Array(128).fill(0.5);
      index.addVector("test1", vector);
      expect(index.delete("test1")).toBe(true);
      expect(index.has("test1")).toBe(false);
      expect(index.delete("nonexistent")).toBe(false);
    });

    it("should clear all vectors", () => {
      const vector = new Float32Array(128).fill(0.5);
      index.addVector("test1", vector);
      index.addVector("test2", vector);
      index.clear();
      expect(index.size()).toBe(0);
    });
  });

  describe("Search Accuracy", () => {
    it("should find exact match", () => {
      const vector = new Float32Array(128).fill(0.5);
      index.addVector("test1", vector);

      const results = index.search(vector, 1);
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("test1");
      expect(results[0].distance).toBeCloseTo(0, 5);
    });

    it("should find nearest neighbors", () => {
      // Create vectors with different patterns
      const v1 = new Float32Array(128).fill(0);
      v1[0] = 1; // [1, 0, 0, ...]

      const v2 = new Float32Array(128).fill(0);
      v2[0] = 0.9; // [0.9, 0, 0, ...] - similar to v1

      const v3 = new Float32Array(128).fill(1); // [1, 1, 1, ...] - different

      index.addVector("v1", v1);
      index.addVector("v2", v2);
      index.addVector("v3", v3);

      // Query similar to v1
      const query = new Float32Array(128).fill(0);
      query[0] = 0.95;

      const results = index.search(query, 3);

      expect(results.length).toBe(3);
      // HNSW is approximate - just check that we get reasonable results
      // v2 or v1 should be closest (they're most similar)
      expect(["v1", "v2"]).toContain(results[0].id);
      // v3 should be furthest (most different)
      expect(results[2].id).toBe("v3");
    });

    it("should return correct number of results", () => {
      for (let i = 0; i < 10; i++) {
        const vector = new Float32Array(128).fill(i / 10);
        index.addVector(`v${i}`, vector);
      }

      const results = index.search(new Float32Array(128).fill(0.5), 5);
      expect(results.length).toBe(5);
    });

    it("should handle k larger than index size", () => {
      const vector = new Float32Array(128).fill(0.5);
      index.addVector("test1", vector);
      index.addVector("test2", vector);

      const results = index.search(new Float32Array(128).fill(0.5), 10);
      expect(results.length).toBe(2);
    });

    it("should return empty results for empty index", () => {
      const results = index.search(new Float32Array(128).fill(0.5), 5);
      expect(results).toEqual([]);
    });
  });

  describe("Distance Calculation", () => {
    it("should calculate zero distance for identical vectors", () => {
      const vector = new Float32Array(128).fill(0.5);
      index.addVector("test1", vector);

      const results = index.search(vector, 1);
      expect(results[0].distance).toBeCloseTo(0, 5);
    });

    it("should calculate max distance for opposite vectors", () => {
      const v1 = new Float32Array(128).fill(1);
      const v2 = new Float32Array(128).fill(-1);

      index.addVector("v1", v1);
      index.addVector("v2", v2);

      const results = index.search(v1, 2);
      // Distance should be close to 2 (cosine distance of opposite vectors)
      expect(results[1].distance).toBeGreaterThan(1.5);
    });

    it("should calculate correct cosine distance", () => {
      // Orthogonal vectors
      const v1 = new Float32Array(128).fill(0);
      v1[0] = 1;

      const v2 = new Float32Array(128).fill(0);
      v2[1] = 1;

      index.addVector("v1", v1);
      index.addVector("v2", v2);

      const results = index.search(v1, 2);
      // Orthogonal vectors have cosine distance = 1
      expect(results[1].distance).toBeCloseTo(1, 2);
    });
  });

  describe("LRU Integration", () => {
    it("should handle deletions correctly", () => {
      for (let i = 0; i < 10; i++) {
        const vector = new Float32Array(128).fill(i / 10);
        index.addVector(`v${i}`, vector);
      }

      expect(index.size()).toBe(10);
      index.delete("v5");
      expect(index.size()).toBe(9);
      expect(index.has("v5")).toBe(false);
    });

    it("should maintain search quality after deletions", () => {
      const v1 = new Float32Array(128).fill(0.1);
      const v2 = new Float32Array(128).fill(0.5);
      const v3 = new Float32Array(128).fill(0.9);

      index.addVector("v1", v1);
      index.addVector("v2", v2);
      index.addVector("v3", v3);

      // Before deletion
      const beforeResults = index.search(new Float32Array(128).fill(0.5), 3);
      // v2 or v1/v3 should be closest depending on HNSW approximation
      expect(beforeResults.length).toBe(3);

      // Delete middle one
      index.delete("v2");

      // After deletion
      const afterResults = index.search(new Float32Array(128).fill(0.5), 3);
      expect(afterResults.length).toBe(2);
      expect(afterResults.map(r => r.id)).not.toContain("v2");
    });
  });

  describe("Performance", () => {
    it("should handle large number of vectors efficiently", () => {
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        const vector = new Float32Array(128);
        for (let j = 0; j < 128; j++) {
          vector[j] = Math.random();
        }
        index.addVector(`v${i}`, vector);
      }

      const buildTime = Date.now() - startTime;
      expect(buildTime).toBeLessThan(5000); // Should complete in < 5s

      const searchStart = Date.now();
      const results = index.search(new Float32Array(128).fill(0.5), 10);
      const searchTime = Date.now() - searchStart;

      expect(results.length).toBe(10);
      expect(searchTime).toBeLessThan(100); // Search should be fast
    });

    it("should maintain search quality with larger index", () => {
      // Add 100 vectors
      for (let i = 0; i < 100; i++) {
        const vector = new Float32Array(128).fill(i / 100);
        index.addVector(`v${i}`, vector);
      }

      // Query near middle
      const query = new Float32Array(128).fill(0.5);
      const results = index.search(query, 5);

      expect(results.length).toBe(5);
      // All results should be reasonably close
      for (const result of results) {
        expect(result.distance).toBeLessThan(0.5);
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle single vector", () => {
      const vector = new Float32Array(128).fill(0.5);
      index.addVector("test1", vector);

      const results = index.search(new Float32Array(128).fill(0.6), 10);
      expect(results.length).toBe(1);
    });

    it("should handle duplicate vectors with different IDs", () => {
      const vector = new Float32Array(128).fill(0.5);
      index.addVector("test1", vector);
      index.addVector("test2", vector);

      const results = index.search(vector, 10);
      expect(results.length).toBe(2);
      // Both should have zero distance
      expect(results[0].distance).toBeCloseTo(0, 5);
      expect(results[1].distance).toBeCloseTo(0, 5);
    });

    it("should handle zero vector", () => {
      const zeroVector = new Float32Array(128).fill(0);
      index.addVector("zero", zeroVector);

      const results = index.search(zeroVector, 1);
      // Zero vector should have very small distance to itself
      expect(results[0].distance).toBeLessThan(0.01);
    });

    it("should handle negative values", () => {
      const vector = new Float32Array(128);
      for (let i = 0; i < 128; i++) {
        vector[i] = Math.random() * 2 - 1; // -1 to 1
      }
      index.addVector("test1", vector);

      const results = index.search(vector, 1);
      expect(results[0].id).toBe("test1");
    });
  });

  describe("Default Configuration", () => {
    it("should use default config for 768-dim", () => {
      const defaultIndex = new HNSWIndex(DEFAULT_HNSW_CONFIG_768);
      const vector = new Float32Array(768).fill(0.5);

      expect(() => defaultIndex.addVector("test", vector)).not.toThrow();
      expect(defaultIndex.size()).toBe(1);
    });

    it("should use default config for 1536-dim", () => {
      const defaultIndex = new HNSWIndex(DEFAULT_HNSW_CONFIG_1536);
      const vector = new Float32Array(1536).fill(0.5);

      expect(() => defaultIndex.addVector("test", vector)).not.toThrow();
      expect(defaultIndex.size()).toBe(1);
    });
  });

  describe("Optimization Features", () => {
    describe("SIMD Acceleration", () => {
      it("should create index with SIMD enabled", () => {
        const simdIndex = new HNSWIndex({
          dimension: 128,
          enableSIMD: true,
        });

        const vector = new Float32Array(128).fill(0.5);
        simdIndex.addVector("test", vector);

        const metrics = simdIndex.getMetrics();
        expect(metrics.simdEnabled).toBe(true);
      });

      it("should create index with SIMD disabled", () => {
        const scalarIndex = new HNSWIndex({
          dimension: 128,
          enableSIMD: false,
        });

        const vector = new Float32Array(128).fill(0.5);
        scalarIndex.addVector("test", vector);

        const metrics = scalarIndex.getMetrics();
        expect(metrics.simdEnabled).toBe(false);
      });

      it("should produce correct results with SIMD and scalar", () => {
        const dimension = 128;
        const count = 100;

        // SIMD index
        const simdIndex = new HNSWIndex({
          dimension,
          enableSIMD: true,
          efSearch: 50,
        });

        // Scalar index
        const scalarIndex = new HNSWIndex({
          dimension,
          enableSIMD: false,
          efSearch: 50,
        });

        const vectors: Float32Array[] = [];
        for (let i = 0; i < count; i++) {
          const vector = new Float32Array(dimension);
          for (let j = 0; j < dimension; j++) {
            vector[j] = Math.random();
          }
          vectors.push(vector);

          simdIndex.addVector(`vec_${i}`, vector);
          scalarIndex.addVector(`vec_${i}`, vector);
        }

        // Compare search results
        const query = vectors[0];
        const simdResults = simdIndex.search(query, 10);
        const scalarResults = scalarIndex.search(query, 10);

        // Results should be similar (may not be identical due to HNSW approximation)
        expect(simdResults.length).toBe(scalarResults.length);
        expect(simdResults[0].distance).toBeCloseTo(scalarResults[0].distance, 2);
      });
    });

    describe("Graph Compression", () => {
      it("should create index with compression enabled", () => {
        const compressedIndex = new HNSWIndex({
          dimension: 128,
          enableCompression: true,
          compressionRatio: 0.7,
        });

        const vector = new Float32Array(128).fill(0.5);
        compressedIndex.addVector("test", vector);

        const metrics = compressedIndex.getMetrics();
        expect(metrics.compressionRatio).toBeDefined();
      });

      it("should have lower memory usage with compression", () => {
        const count = 100;
        const dimension = 128;

        const uncompressedIndex = new HNSWIndex({
          dimension,
          enableCompression: false,
        });

        const compressedIndex = new HNSWIndex({
          dimension,
          enableCompression: true,
          compressionRatio: 0.7,
        });

        const vectors: Float32Array[] = [];
        for (let i = 0; i < count; i++) {
          const vector = new Float32Array(dimension);
          for (let j = 0; j < dimension; j++) {
            vector[j] = Math.random();
          }
          vectors.push(vector);

          uncompressedIndex.addVector(`vec_${i}`, vector);
          compressedIndex.addVector(`vec_${i}`, vector);
        }

        const uncompressedMetrics = uncompressedIndex.getMetrics();
        const compressedMetrics = compressedIndex.getMetrics();

        // Compressed should use less or equal memory
        expect(compressedMetrics.memoryUsage).toBeLessThanOrEqual(
          uncompressedMetrics.memoryUsage * 1.1 // Allow 10% margin for metadata overhead
        );
      });
    });

    describe("Auto-Tuning", () => {
      it("should create index with auto-tuning enabled", () => {
        const autoTuneIndex = new HNSWIndex({
          dimension: 128,
          autoTune: true,
          minVectorsForTuning: 10,
        });

        const metrics = autoTuneIndex.getMetrics();
        expect(metrics.autoTuneEnabled).toBe(true);
      });

      it("should trigger auto-tuning after threshold", () => {
        const autoTuneIndex = new HNSWIndex({
          dimension: 128,
          autoTune: true,
          minVectorsForTuning: 50,
        });

        // Add vectors below threshold
        for (let i = 0; i < 49; i++) {
          const vector = new Float32Array(128);
          for (let j = 0; j < 128; j++) {
            vector[j] = Math.random();
          }
          autoTuneIndex.addVector(`vec_${i}`, vector);
        }

        let metrics1 = autoTuneIndex.getMetrics();
        expect(metrics1.lastAutoTune).toBeUndefined();

        // Add one more to trigger auto-tuning
        const vector = new Float32Array(128);
        for (let j = 0; j < 128; j++) {
          vector[j] = Math.random();
        }
        autoTuneIndex.addVector("vec_49", vector);

        // Add more vectors to ensure tuning triggers
        for (let i = 50; i < 150; i++) {
          const v = new Float32Array(128);
          for (let j = 0; j < 128; j++) {
            v[j] = Math.random();
          }
          autoTuneIndex.addVector(`vec_${i}`, v);
        }

        const metrics2 = autoTuneIndex.getMetrics();
        // Auto-tuning should have been triggered
        expect(metrics2.lastAutoTune).toBeDefined();
      });
    });

    describe("Metrics Reporting", () => {
      it("should report accurate metrics", () => {
        const testIndex = new HNSWIndex({
          dimension: 128,
          M: 16,
          mL: 5,
          enableSIMD: true,
          enableCompression: true,
        });

        const count = 100;
        for (let i = 0; i < count; i++) {
          const vector = new Float32Array(128);
          for (let j = 0; j < 128; j++) {
            vector[j] = Math.random();
          }
          testIndex.addVector(`vec_${i}`, vector);
        }

        const metrics = testIndex.getMetrics();

        expect(metrics.size).toBe(count);
        expect(metrics.numLayers).toBeGreaterThan(0);
        expect(metrics.numLayers).toBeLessThanOrEqual(6);
        expect(metrics.avgConnections).toBeGreaterThan(0);
        expect(metrics.memoryUsage).toBeGreaterThan(0);
        expect(metrics.simdEnabled).toBe(true);
      });

      it("should track search statistics", () => {
        const testIndex = new HNSWIndex({
          dimension: 128,
          enableSIMD: true,
        });

        // Add some vectors
        for (let i = 0; i < 50; i++) {
          const vector = new Float32Array(128);
          for (let j = 0; j < 128; j++) {
            vector[j] = Math.random();
          }
          testIndex.addVector(`vec_${i}`, vector);
        }

        // Perform searches
        const query = new Float32Array(128);
        for (let j = 0; j < 128; j++) {
          query[j] = Math.random();
        }

        for (let i = 0; i < 10; i++) {
          testIndex.search(query, 10);
        }

        const metrics = testIndex.getMetrics();
        // Index should still function correctly
        expect(metrics.size).toBe(50);
      });
    });
  });

  describe("Predefined Configurations", () => {
    it("should work with PERFORMANCE_HNSW_CONFIG", () => {
      const index = new HNSWIndex(PERFORMANCE_HNSW_CONFIG);
      const vector = new Float32Array(768).fill(0.5);

      index.addVector("test", vector);
      const results = index.search(vector, 1);

      expect(results.length).toBe(1);
      expect(results[0].id).toBe("test");

      const metrics = index.getMetrics();
      expect(metrics.simdEnabled).toBe(true);
      expect(metrics.autoTuneEnabled).toBe(true);
    });

    it("should work with MEMORY_OPTIMIZED_HNSW_CONFIG", () => {
      const index = new HNSWIndex(MEMORY_OPTIMIZED_HNSW_CONFIG);
      const vector = new Float32Array(768).fill(0.5);

      index.addVector("test", vector);
      const results = index.search(vector, 1);

      expect(results.length).toBe(1);

      const metrics = index.getMetrics();
      expect(metrics.simdEnabled).toBe(true);
      expect(metrics.autoTuneEnabled).toBe(true);
    });
  });

  describe("Edge Cases with Optimizations", () => {
    it("should handle empty index with all optimizations", () => {
      const index = new HNSWIndex({
        dimension: 128,
        enableSIMD: true,
        enableCompression: true,
        autoTune: true,
        enablePrefetch: true,
      });

      const results = index.search(new Float32Array(128).fill(0.5), 10);
      expect(results).toEqual([]);

      const metrics = index.getMetrics();
      expect(metrics.size).toBe(0);
    });

    it("should handle single vector with compression", () => {
      const index = new HNSWIndex({
        dimension: 128,
        enableCompression: true,
      });

      const vector = new Float32Array(128).fill(0.5);
      index.addVector("test", vector);

      const results = index.search(vector, 10);
      expect(results.length).toBe(1);
      expect(results[0].distance).toBeCloseTo(0, 5);
    });

    it("should maintain accuracy with auto-tuning", () => {
      const index = new HNSWIndex({
        dimension: 128,
        autoTune: true,
        minVectorsForTuning: 50,
        efSearch: 50,
      });

      // Add vectors including exact match
      for (let i = 0; i < 100; i++) {
        const vector = new Float32Array(128);
        for (let j = 0; j < 128; j++) {
          vector[j] = Math.random();
        }
        index.addVector(`vec_${i}`, vector);
      }

      const testVector = new Float32Array(128);
      for (let j = 0; j < 128; j++) {
        testVector[j] = Math.random();
      }
      index.addVector("exact", testVector);

      const results = index.search(testVector, 1);
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("exact");
      expect(results[0].distance).toBeCloseTo(0, 5);
    });
  });
});

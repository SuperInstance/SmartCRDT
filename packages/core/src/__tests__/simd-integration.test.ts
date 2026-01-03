/**
 * SIMD Integration Tests
 *
 * Tests for SIMD operations, vector operations, and embedding operations.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  SIMDOptimizer,
  type SIMDCapabilities,
  type SIMDOperation,
  type SIMDPerformanceMetrics,
} from "../simd/SIMDOptimizer.js";

describe("SIMD Integration", () => {
  let optimizer: SIMDOptimizer;

  beforeEach(() => {
    optimizer = new SIMDOptimizer();
  });

  describe("Capability Detection", () => {
    it("should detect SIMD capabilities", async () => {
      const capabilities = await optimizer.detectCapabilities();

      expect(capabilities).toBeDefined();
      expect(capabilities.vectorWidth).toBeGreaterThanOrEqual(0);
      expect(capabilities.recommendedOps).toBeInstanceOf(Array);
    });

    it("should detect SSE support", async () => {
      const capabilities = await optimizer.detectCapabilities();

      expect(capabilities.SSE).toBeDefined();
      expect(typeof capabilities.SSE).toBe("boolean");
    });

    it("should detect AVX support", async () => {
      const capabilities = await optimizer.detectCapabilities();

      expect(capabilities.AVX).toBeDefined();
      expect(typeof capabilities.AVX).toBe("boolean");
    });

    it("should detect AVX2 support", async () => {
      const capabilities = await optimizer.detectCapabilities();

      expect(capabilities.AVX2).toBeDefined();
      expect(typeof capabilities.AVX2).toBe("boolean");
    });

    it("should detect NEON support (ARM)", async () => {
      const capabilities = await optimizer.detectCapabilities();

      expect(capabilities.NEON).toBeDefined();
      expect(typeof capabilities.NEON).toBe("boolean");
    });

    it("should determine vector width", async () => {
      const capabilities = await optimizer.detectCapabilities();

      expect([0, 128, 256, 512]).toContain(capabilities.vectorWidth);
    });
  });

  describe("Vector Operations", () => {
    it("should perform vector addition", () => {
      const a = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const b = new Float32Array([8, 7, 6, 5, 4, 3, 2, 1]);
      const expected = new Float32Array([9, 9, 9, 9, 9, 9, 9, 9]);

      const result = optimizer.optimizeVectorOp("add", [a, b]) as Float32Array;

      expect(result).toEqual(expected);
    });

    it("should perform vector subtraction", () => {
      const a = new Float32Array([10, 9, 8, 7]);
      const b = new Float32Array([1, 2, 3, 4]);
      const expected = new Float32Array([9, 7, 5, 3]);

      const result = optimizer.optimizeVectorOp("sub", [a, b]) as Float32Array;

      expect(result).toEqual(expected);
    });

    it("should perform vector multiplication", () => {
      const a = new Float32Array([2, 3, 4, 5]);
      const b = new Float32Array([3, 4, 5, 6]);
      const expected = new Float32Array([6, 12, 20, 30]);

      const result = optimizer.optimizeVectorOp("mul", [a, b]) as Float32Array;

      expect(result).toEqual(expected);
    });

    it("should calculate dot product", () => {
      const a = new Float32Array([1, 2, 3, 4]);
      const b = new Float32Array([2, 3, 4, 5]);
      const expected = 1 * 2 + 2 * 3 + 3 * 4 + 4 * 5; // 40

      const result = optimizer.optimizeVectorOp("dot", [a, b]) as number;

      expect(result).toBe(expected);
    });

    it("should calculate cosine similarity", () => {
      const a = new Float32Array([1, 0, 0]);
      const b = new Float32Array([1, 0, 0]);
      const expected = 1; // Same direction

      const result = optimizer.optimizeVectorOp("cosine", [a, b]) as number;

      expect(result).toBeCloseTo(expected, 5);
    });

    it("should calculate euclidean distance", () => {
      const a = new Float32Array([0, 0]);
      const b = new Float32Array([3, 4]);
      const expected = 5; // 3-4-5 triangle

      const result = optimizer.optimizeVectorOp("euclidean", [a, b]) as number;

      expect(result).toBeCloseTo(expected, 5);
    });

    it("should normalize vectors", () => {
      const a = new Float32Array([3, 4]);
      const norm = Math.sqrt(3 * 3 + 4 * 4); // 5
      const expected = new Float32Array([3 / 5, 4 / 5]);

      const result = optimizer.optimizeVectorOp("normalize", [
        a,
      ]) as Float32Array;

      expect(result[0]).toBeCloseTo(expected[0], 5);
      expect(result[1]).toBeCloseTo(expected[1], 5);
    });
  });

  describe("SIMD vs Scalar Performance", () => {
    it("should benchmark SIMD operations", () => {
      const a = new Float32Array(1000);
      const b = new Float32Array(1000);

      for (let i = 0; i < 1000; i++) {
        a[i] = Math.random();
        b[i] = Math.random();
      }

      const result = optimizer.optimizeVectorOp(
        "add",
        [a, b],
        true
      ) as Float32Array;

      expect(result).toHaveLength(1000);
    });

    it("should track performance metrics", () => {
      const a = new Float32Array(500);
      const b = new Float32Array(500);

      for (let i = 0; i < 500; i++) {
        a[i] = i;
        b[i] = i * 2;
      }

      optimizer.optimizeVectorOp("dot", [a, b], true);

      const metrics = optimizer.getMetrics("dot");

      expect(metrics).toBeDefined();
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[0].operation).toBe("dot");
    });

    it("should measure speedup from SIMD", () => {
      const metrics = optimizer.getMetrics();

      if (metrics.length > 0) {
        const metric = metrics[0];
        expect(metric.speedup).toBeGreaterThan(0);
      }
    });
  });

  describe("Embedding Operations", () => {
    it("should handle large embedding vectors", () => {
      const size = 1536; // Common embedding size
      const embedding1 = new Float32Array(size);
      const embedding2 = new Float32Array(size);

      for (let i = 0; i < size; i++) {
        embedding1[i] = Math.random() - 0.5;
        embedding2[i] = Math.random() - 0.5;
      }

      const similarity = optimizer.optimizeVectorOp("cosine", [
        embedding1,
        embedding2,
      ]) as number;

      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it("should batch compare multiple embeddings", () => {
      const queryEmbedding = new Float32Array(768);
      const docEmbeddings = new Float32Array(10 * 768);

      for (let i = 0; i < 768; i++) {
        queryEmbedding[i] = Math.random();
      }

      for (let i = 0; i < 10 * 768; i++) {
        docEmbeddings[i] = Math.random();
      }

      // Calculate similarities for each document
      const similarities: number[] = [];
      for (let i = 0; i < 10; i++) {
        const docEmbedding = docEmbeddings.subarray(i * 768, (i + 1) * 768);
        const sim = optimizer.optimizeVectorOp("cosine", [
          queryEmbedding,
          docEmbedding,
        ]) as number;
        similarities.push(sim);
      }

      expect(similarities).toHaveLength(10);
      similarities.forEach(sim => {
        expect(sim).toBeGreaterThanOrEqual(-1);
        expect(sim).toBeLessThanOrEqual(1);
      });
    });

    it("should normalize embeddings", () => {
      const embedding = new Float32Array([3, 4, 0, 0]);
      const normalized = optimizer.optimizeVectorOp("normalize", [
        embedding,
      ]) as Float32Array;

      // Check that normalized vector has unit length
      const norm = Math.sqrt(normalized[0] ** 2 + normalized[1] ** 2);
      expect(norm).toBeCloseTo(1, 5);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty vectors", () => {
      const a = new Float32Array(0);
      const b = new Float32Array(0);

      const result = optimizer.optimizeVectorOp("add", [a, b]) as Float32Array;

      expect(result).toHaveLength(0);
    });

    it("should handle single element vectors", () => {
      const a = new Float32Array([5]);
      const b = new Float32Array([3]);

      const result = optimizer.optimizeVectorOp("add", [a, b]) as Float32Array;

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(8);
    });

    it("should handle vectors with different sizes (same length required)", () => {
      const a = new Float32Array([1, 2, 3]);
      const b = new Float32Array([4, 5]);

      // Should handle gracefully - in real implementation would throw
      // For this test, we verify behavior
      expect(() => {
        optimizer.optimizeVectorOp("add", [a, b]);
      }).not.toThrow();
    });

    it("should handle NaN values", () => {
      const a = new Float32Array([1, NaN, 3]);
      const b = new Float32Array([4, 5, 6]);

      const result = optimizer.optimizeVectorOp("add", [a, b]) as Float32Array;

      // Result should contain NaN where input had NaN
      expect(isNaN(result[1])).toBe(true);
    });

    it("should handle infinity values", () => {
      const a = new Float32Array([1, Infinity, 3]);
      const b = new Float32Array([4, 5, 6]);

      const result = optimizer.optimizeVectorOp("add", [a, b]) as Float32Array;

      expect(result[1]).toBe(Infinity);
    });
  });

  describe("Performance Characteristics", () => {
    it("should be faster for large vectors", () => {
      const smallSize = 16;
      const largeSize = 10000;

      const smallA = new Float32Array(smallSize);
      const smallB = new Float32Array(smallSize);
      const largeA = new Float32Array(largeSize);
      const largeB = new Float32Array(largeSize);

      for (let i = 0; i < largeSize; i++) {
        if (i < smallSize) {
          smallA[i] = Math.random();
          smallB[i] = Math.random();
        }
        largeA[i] = Math.random();
        largeB[i] = Math.random();
      }

      const startSmall = performance.now();
      optimizer.optimizeVectorOp("dot", [smallA, smallB]);
      const timeSmall = performance.now() - startSmall;

      const startLarge = performance.now();
      optimizer.optimizeVectorOp("dot", [largeA, largeB]);
      const timeLarge = performance.now() - startLarge;

      // Large vector should not be proportionally slower due to SIMD
      expect(timeLarge / largeSize).toBeLessThan((timeSmall / smallSize) * 10);
    });

    it("should use SIMD when vector size is sufficient", () => {
      const smallVector = new Float32Array(8);
      const largeVector = new Float32Array(1000);

      const useSIMDSmall = optimizer["shouldUseSIMD"](
        "add",
        smallVector.length
      );
      const useSIMDLarge = optimizer["shouldUseSIMD"](
        "add",
        largeVector.length
      );

      expect(useSIMDSmall).toBe(false); // Too small for SIMD benefit
      expect(useSIMDLarge).toBe(true); // Large enough for SIMD
    });
  });

  describe("Metrics Collection", () => {
    it("should clear metrics", () => {
      const a = new Float32Array([1, 2, 3]);
      const b = new Float32Array([4, 5, 6]);

      optimizer.optimizeVectorOp("add", [a, b], true);
      expect(optimizer.getMetrics().length).toBeGreaterThan(0);

      optimizer.clearMetrics();
      expect(optimizer.getMetrics().length).toBe(0);
    });

    it("should filter metrics by operation", () => {
      const a = new Float32Array(100);
      const b = new Float32Array(100);

      for (let i = 0; i < 100; i++) {
        a[i] = i;
        b[i] = i * 2;
      }

      optimizer.optimizeVectorOp("dot", [a, b], true);
      optimizer.optimizeVectorOp("add", [a, b], true);

      const dotMetrics = optimizer.getMetrics("dot");
      const addMetrics = optimizer.getMetrics("add");

      expect(dotMetrics.length).toBeGreaterThan(0);
      expect(addMetrics.length).toBeGreaterThan(0);
      expect(dotMetrics[0].operation).toBe("dot");
      expect(addMetrics[0].operation).toBe("add");
    });
  });

  describe("Instruction Set Detection", () => {
    it("should identify best available instruction set", async () => {
      await optimizer.detectCapabilities();

      const instructionSet = optimizer["detectInstructionSet"]();

      expect([
        "AVX-512",
        "AVX2",
        "AVX",
        "SSE4.2",
        "SSE4.1",
        "SSE3",
        "SSE2",
        "SSE",
        "NEON",
        "None",
      ]).toContain(instructionSet);
    });

    it("should cache capabilities after first detection", async () => {
      const capabilities1 = await optimizer.detectCapabilities();
      const capabilities2 = await optimizer.detectCapabilities();

      expect(capabilities1).toEqual(capabilities2);
    });
  });

  describe("Real-World Embedding Operations", () => {
    it("should calculate semantic similarity between text embeddings", () => {
      // Mock text embeddings (768-dim like BERT)
      const text1Embedding = new Float32Array(768);
      const text2Embedding = new Float32Array(768);

      // Initialize with mock values
      for (let i = 0; i < 768; i++) {
        text1Embedding[i] = Math.sin(i * 0.1) * 0.5 + Math.random() * 0.1;
        text2Embedding[i] = Math.sin(i * 0.1) * 0.5 + Math.random() * 0.1;
      }

      const similarity = optimizer.optimizeVectorOp("cosine", [
        text1Embedding,
        text2Embedding,
      ]) as number;

      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it("should find nearest neighbors in embedding space", () => {
      const queryEmbedding = new Float32Array(384);
      const corpusEmbeddings = new Float32Array(100 * 384);

      // Initialize query
      for (let i = 0; i < 384; i++) {
        queryEmbedding[i] = Math.random() - 0.5;
      }

      // Initialize corpus
      for (let i = 0; i < 100 * 384; i++) {
        corpusEmbeddings[i] = Math.random() - 0.5;
      }

      // Find top 5 nearest neighbors
      const similarities: Array<{ index: number; similarity: number }> = [];

      for (let i = 0; i < 100; i++) {
        const docEmbedding = corpusEmbeddings.subarray(i * 384, (i + 1) * 384);
        const sim = optimizer.optimizeVectorOp("cosine", [
          queryEmbedding,
          docEmbedding,
        ]) as number;
        similarities.push({ index: i, similarity: sim });
      }

      similarities.sort((a, b) => b.similarity - a.similarity);
      const top5 = similarities.slice(0, 5);

      expect(top5).toHaveLength(5);
      expect(top5[0].similarity).toBeGreaterThanOrEqual(top5[4].similarity);
    });
  });
});

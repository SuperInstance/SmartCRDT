/**
 * SIMD Optimizer Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SIMDOptimizer, SIMDOperation } from "./SIMDOptimizer.js";
import { VectorOps } from "./VectorOps.js";
import { EmbeddingOps } from "./EmbeddingOps.js";

describe("SIMDOptimizer", () => {
  let optimizer: SIMDOptimizer;

  beforeEach(() => {
    optimizer = new SIMDOptimizer();
  });

  describe("Capability Detection", () => {
    it("should detect SIMD capabilities", async () => {
      const caps = await optimizer.detectCapabilities();

      expect(caps).toBeDefined();
      expect(caps.vectorWidth).toBeGreaterThanOrEqual(0);
      expect(caps.recommendedOps).toBeInstanceOf(Array);
      expect(caps.recommendedOps.length).toBeGreaterThan(0);
    });

    it("should detect vector width", async () => {
      const caps = await optimizer.detectCapabilities();

      expect([0, 128, 256, 512]).toContain(caps.vectorWidth);
    });

    it("should have recommended operations", async () => {
      const caps = await optimizer.detectCapabilities();

      expect(caps.recommendedOps).toContain("add");
      expect(caps.recommendedOps).toContain("dot");
      expect(caps.recommendedOps).toContain("cosine");
    });
  });

  describe("Vector Operations", () => {
    it("should add vectors correctly", () => {
      const a = new Float32Array([1, 2, 3, 4]);
      const b = new Float32Array([5, 6, 7, 8]);

      const result = optimizer.optimizeVectorOp("add", [a, b]) as Float32Array;

      expect(result).toEqual(new Float32Array([6, 8, 10, 12]));
    });

    it("should subtract vectors correctly", () => {
      const a = new Float32Array([5, 6, 7, 8]);
      const b = new Float32Array([1, 2, 3, 4]);

      const result = optimizer.optimizeVectorOp("sub", [a, b]) as Float32Array;

      expect(result).toEqual(new Float32Array([4, 4, 4, 4]));
    });

    it("should multiply vectors element-wise", () => {
      const a = new Float32Array([1, 2, 3, 4]);
      const b = new Float32Array([2, 3, 4, 5]);

      const result = optimizer.optimizeVectorOp("mul", [a, b]) as Float32Array;

      expect(result).toEqual(new Float32Array([2, 6, 12, 20]));
    });

    it("should compute dot product correctly", () => {
      const a = new Float32Array([1, 2, 3, 4]);
      const b = new Float32Array([2, 3, 4, 5]);

      const result = optimizer.optimizeVectorOp("dot", [a, b]) as number;

      expect(result).toBe(1 * 2 + 2 * 3 + 3 * 4 + 4 * 5); // 2 + 6 + 12 + 20 = 40
    });

    it("should compute cosine similarity correctly", () => {
      const a = new Float32Array([1, 0, 0]);
      const b = new Float32Array([1, 0, 0]);

      const result = optimizer.optimizeVectorOp("cosine", [a, b]) as number;

      expect(result).toBeCloseTo(1.0, 5);
    });

    it("should compute cosine similarity for orthogonal vectors", () => {
      const a = new Float32Array([1, 0, 0]);
      const b = new Float32Array([0, 1, 0]);

      const result = optimizer.optimizeVectorOp("cosine", [a, b]) as number;

      expect(result).toBeCloseTo(0.0, 5);
    });

    it("should compute Euclidean distance correctly", () => {
      const a = new Float32Array([0, 0, 0]);
      const b = new Float32Array([3, 4, 0]);

      const result = optimizer.optimizeVectorOp("euclidean", [a, b]) as number;

      expect(result).toBeCloseTo(5.0, 5);
    });

    it("should normalize vector correctly", () => {
      const a = new Float32Array([3, 4, 0]);

      const result = optimizer.optimizeVectorOp("normalize", [
        a,
      ]) as Float32Array;

      const norm = Math.sqrt(3 * 3 + 4 * 4);
      expect(result[0]).toBeCloseTo(3 / norm, 5);
      expect(result[1]).toBeCloseTo(4 / norm, 5);
      expect(result[2]).toBeCloseTo(0, 5);

      // Check that result is normalized
      const resultNorm = Math.sqrt(
        result[0] * result[0] + result[1] * result[1]
      );
      expect(resultNorm).toBeCloseTo(1.0, 5);
    });
  });

  describe("SIMD Decision Logic", () => {
    it("should use SIMD for large vectors", async () => {
      await optimizer.detectCapabilities();

      const largeVec = new Float32Array(100);
      const shouldUse = optimizer.shouldUseSIMD("dot", 100);

      expect(shouldUse).toBe(true);
    });

    it("should not use SIMD for small vectors", async () => {
      await optimizer.detectCapabilities();

      const shouldUse = optimizer.shouldUseSIMD("dot", 4);

      expect(shouldUse).toBe(false);
    });
  });

  describe("Performance Metrics", () => {
    it("should track performance metrics when benchmarking", async () => {
      // Initialize capabilities first
      await optimizer.detectCapabilities();

      const a = new Float32Array(100);
      const b = new Float32Array(100);

      // Fill with random values
      for (let i = 0; i < 100; i++) {
        a[i] = Math.random();
        b[i] = Math.random();
      }

      optimizer.optimizeVectorOp("dot", [a, b], true);

      const metrics = optimizer.getMetrics("dot");

      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[0].operation).toBe("dot");
      expect(metrics[0].vectorSize).toBe(100);
      expect(metrics[0].simdTime).toBeGreaterThanOrEqual(0);
      expect(metrics[0].scalarTime).toBeGreaterThan(0);
    });

    it("should clear metrics", async () => {
      // Initialize capabilities first
      await optimizer.detectCapabilities();

      const a = new Float32Array(100);
      const b = new Float32Array(100);

      optimizer.optimizeVectorOp("dot", [a, b], true);
      expect(optimizer.getMetrics().length).toBeGreaterThan(0);

      optimizer.clearMetrics();
      expect(optimizer.getMetrics().length).toBe(0);
    });
  });
});

describe("VectorOps", () => {
  let vecOps: VectorOps;

  beforeEach(async () => {
    vecOps = new VectorOps();
    await vecOps.init();
  });

  describe("Basic Operations", () => {
    it("should add vectors", () => {
      const a = new Float32Array([1, 2, 3]);
      const b = new Float32Array([4, 5, 6]);

      const result = vecOps.add(a, b);

      expect(result).toEqual(new Float32Array([5, 7, 9]));
    });

    it("should subtract vectors", () => {
      const a = new Float32Array([5, 7, 9]);
      const b = new Float32Array([1, 2, 3]);

      const result = vecOps.sub(a, b);

      expect(result).toEqual(new Float32Array([4, 5, 6]));
    });

    it("should multiply vectors element-wise", () => {
      const a = new Float32Array([2, 3, 4]);
      const b = new Float32Array([5, 6, 7]);

      const result = vecOps.mul(a, b);

      expect(result).toEqual(new Float32Array([10, 18, 28]));
    });

    it("should compute dot product", () => {
      const a = new Float32Array([1, 2, 3]);
      const b = new Float32Array([4, 5, 6]);

      const result = vecOps.dot(a, b);

      expect(result).toBe(1 * 4 + 2 * 5 + 3 * 6); // 32
    });

    it("should compute cosine similarity", () => {
      const a = new Float32Array([1, 2, 3]);
      const b = new Float32Array([2, 4, 6]);

      const result = vecOps.cosine(a, b);

      expect(result).toBeCloseTo(1.0, 5);
    });

    it("should compute Euclidean distance", () => {
      const a = new Float32Array([0, 0]);
      const b = new Float32Array([3, 4]);

      const result = vecOps.euclidean(a, b);

      expect(result).toBeCloseTo(5.0, 5);
    });

    it("should compute norm squared", () => {
      const a = new Float32Array([3, 4]);

      const result = vecOps.normSquared(a);

      expect(result).toBe(25);
    });

    it("should compute norm", () => {
      const a = new Float32Array([3, 4]);

      const result = vecOps.norm(a);

      expect(result).toBeCloseTo(5.0, 5);
    });

    it("should normalize vector", () => {
      const a = new Float32Array([3, 4]);

      const result = vecOps.normalize(a);

      const resultNorm = vecOps.norm(result);
      expect(resultNorm).toBeCloseTo(1.0, 5);
    });

    it("should scale vector", () => {
      const a = new Float32Array([1, 2, 3]);

      const result = vecOps.scale(a, 2);

      expect(result).toEqual(new Float32Array([2, 4, 6]));
    });

    it("should add scalar to vector", () => {
      const a = new Float32Array([1, 2, 3]);

      const result = vecOps.addScalar(a, 5);

      expect(result).toEqual(new Float32Array([6, 7, 8]));
    });
  });

  describe("Batch Operations", () => {
    it("should sum multiple vectors", () => {
      const vectors = [
        new Float32Array([1, 2, 3]),
        new Float32Array([4, 5, 6]),
        new Float32Array([7, 8, 9]),
      ];

      const result = vecOps.sum(vectors);

      expect(result).toEqual(new Float32Array([12, 15, 18]));
    });

    it("should compute mean of vectors", () => {
      const vectors = [
        new Float32Array([1, 2, 3]),
        new Float32Array([4, 5, 6]),
        new Float32Array([7, 8, 9]),
      ];

      const result = vecOps.mean(vectors);

      expect(result).toEqual(new Float32Array([4, 5, 6]));
    });

    it("should compute max of vectors", () => {
      const vectors = [
        new Float32Array([1, 5, 3]),
        new Float32Array([4, 2, 6]),
        new Float32Array([7, 8, 0]),
      ];

      const result = vecOps.max(vectors);

      expect(result).toEqual(new Float32Array([7, 8, 6]));
    });

    it("should compute min of vectors", () => {
      const vectors = [
        new Float32Array([1, 5, 3]),
        new Float32Array([4, 2, 6]),
        new Float32Array([7, 8, 0]),
      ];

      const result = vecOps.min(vectors);

      expect(result).toEqual(new Float32Array([1, 2, 0]));
    });

    it("should batch add", () => {
      const vectors = [
        new Float32Array([1, 2, 3]),
        new Float32Array([4, 5, 6]),
      ];
      const scalar = new Float32Array([1, 1, 1]);

      const result = vecOps.batchAdd(vectors, scalar);

      expect(result[0]).toEqual(new Float32Array([2, 3, 4]));
      expect(result[1]).toEqual(new Float32Array([5, 6, 7]));
    });
  });

  describe("Distance Operations", () => {
    it("should compute Manhattan distance", () => {
      const a = new Float32Array([0, 0]);
      const b = new Float32Array([3, 4]);

      const result = vecOps.manhattan(a, b);

      expect(result).toBe(7);
    });

    it("should compute Minkowski distance (p=3)", () => {
      const a = new Float32Array([0, 0]);
      const b = new Float32Array([1, 1]);

      const result = vecOps.minkowski(a, b, 3);

      expect(result).toBeCloseTo(Math.pow(2, 1 / 3), 5);
    });

    it("should compute Chebyshev distance", () => {
      const a = new Float32Array([0, 0]);
      const b = new Float32Array([3, 4]);

      const result = vecOps.chebyshev(a, b);

      expect(result).toBe(4);
    });

    it("should compute Hamming distance", () => {
      const a = new Float32Array([0, 1, 0, 1, 1]);
      const b = new Float32Array([0, 1, 1, 1, 0]);

      const result = vecOps.hamming(a, b);

      expect(result).toBe(2);
    });
  });

  describe("Batch Comparison", () => {
    it("should find top K similar vectors", () => {
      const query = new Float32Array([1, 2, 3]);
      const candidates = [
        new Float32Array([1, 2, 3]),
        new Float32Array([-1, -2, -3]),
        new Float32Array([2, 4, 6]),
        new Float32Array([0, 0, 0]),
      ];

      const results = vecOps.batchCompare(query, candidates, 2, "cosine");

      expect(results.length).toBe(2);
      expect(results[0].index).toBe(0); // Exact match
      expect(results[0].similarity).toBeCloseTo(1.0, 5);
      expect(results[1].index).toBe(2); // Scaled version
    });

    it("should find vectors within radius", () => {
      const query = new Float32Array([0, 0]);
      const candidates = [
        new Float32Array([1, 0]),
        new Float32Array([2, 0]),
        new Float32Array([3, 0]),
        new Float32Array([4, 0]),
      ];

      const results = vecOps.rangeSearch(query, candidates, 2.5);

      expect(results.length).toBe(2);
    });

    it("should approximate nearest neighbors", () => {
      const query = new Float32Array([1, 2, 3]);
      const candidates: Float32Array[] = [];
      for (let i = 0; i < 100; i++) {
        candidates.push(
          new Float32Array([Math.random(), Math.random(), Math.random()])
        );
      }
      candidates.push(query); // Add the query itself

      const results = vecOps.approxNN(query, candidates, 5);

      expect(results.length).toBe(5);
      expect(results[0].similarity).toBeGreaterThan(0.9);
    });
  });

  describe("Vector Utilities", () => {
    it("should clone vector", () => {
      const a = new Float32Array([1, 2, 3]);

      const result = vecOps.clone(a);

      expect(result).toEqual(a);
      expect(result).not.toBe(a);
    });

    it("should concatenate vectors", () => {
      const a = new Float32Array([1, 2]);
      const b = new Float32Array([3, 4]);
      const c = new Float32Array([5, 6]);

      const result = vecOps.concat(a, b, c);

      expect(result).toEqual(new Float32Array([1, 2, 3, 4, 5, 6]));
    });

    it("should slice vector", () => {
      const a = new Float32Array([1, 2, 3, 4, 5]);

      const result = vecOps.slice(a, 1, 4);

      expect(result).toEqual(new Float32Array([2, 3, 4]));
    });

    it("should clamp vector values", () => {
      const a = new Float32Array([1, 5, 10]);

      const result = vecOps.clamp(a, 2, 8);

      expect(result).toEqual(new Float32Array([2, 5, 8]));
    });

    it("should map function over vector", () => {
      const a = new Float32Array([1, 2, 3]);

      const result = vecOps.map(a, x => x * 2);

      expect(result).toEqual(new Float32Array([2, 4, 6]));
    });

    it("should reduce vector", () => {
      const a = new Float32Array([1, 2, 3, 4]);

      const result = vecOps.reduce(a, (acc, x) => acc + x, 0);

      expect(result).toBe(10);
    });

    it("should check every element", () => {
      const a = new Float32Array([2, 4, 6, 8]);

      const result = vecOps.every(a, x => x % 2 === 0);

      expect(result).toBe(true);
    });

    it("should check some element", () => {
      const a = new Float32Array([1, 2, 3, 4]);

      const result = vecOps.some(a, x => x > 3);

      expect(result).toBe(true);
    });

    it("should find index", () => {
      const a = new Float32Array([1, 2, 3, 4]);

      const result = vecOps.findIndex(a, x => x === 3);

      expect(result).toBe(2);
    });

    it("should convert to array", () => {
      const a = new Float32Array([1, 2, 3]);

      const result = vecOps.toArray(a);

      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe("Static Factory Methods", () => {
    it("should create from array", () => {
      const result = VectorOps.fromArray([1, 2, 3]);

      expect(result).toEqual(new Float32Array([1, 2, 3]));
    });

    it("should create zero vector", () => {
      const result = VectorOps.zeros(5);

      expect(result).toEqual(new Float32Array([0, 0, 0, 0, 0]));
    });

    it("should create ones vector", () => {
      const result = VectorOps.ones(5);

      expect(result).toEqual(new Float32Array([1, 1, 1, 1, 1]));
    });

    it("should create random vector", () => {
      const result = VectorOps.random(100);

      expect(result.length).toBe(100);
      for (let i = 0; i < 100; i++) {
        expect(result[i]).toBeGreaterThanOrEqual(0);
        expect(result[i]).toBeLessThan(1);
      }
    });

    it("should create random normal vector", () => {
      const result = VectorOps.randomNormal(1000, 0, 1);

      expect(result.length).toBe(1000);

      // Check mean is approximately 0
      const mean = result.reduce((a, b) => a + b, 0) / 1000;
      expect(mean).toBeCloseTo(0, 0); // Within 1 digit

      // Check std is approximately 1 (with more tolerance for small sample)
      const variance = result.reduce((a, b) => a + (b - mean) ** 2, 0) / 1000;
      const std = Math.sqrt(variance);
      expect(std).toBeGreaterThan(0.8);
      expect(std).toBeLessThan(1.2);
    });
  });
});

describe("EmbeddingOps", () => {
  let embedOps: EmbeddingOps;

  beforeEach(async () => {
    embedOps = new EmbeddingOps();
    await embedOps.init();
  });

  describe("Embedding Lookup", () => {
    it("should lookup embeddings", async () => {
      const embeddingMatrix = new Float32Array([
        1,
        2,
        3, // Token 0
        4,
        5,
        6, // Token 1
        7,
        8,
        9, // Token 2
      ]);
      const ids = [0, 2];
      const embeddingDim = 3;

      const result = await embedOps.lookup(ids, embeddingMatrix, embeddingDim);

      expect(result).toEqual(new Float32Array([1, 2, 3, 7, 8, 9]));
    });

    it("should batch lookup embeddings", async () => {
      const embeddingMatrix = new Float32Array([
        1,
        2,
        3, // Token 0
        4,
        5,
        6, // Token 1
        7,
        8,
        9, // Token 2
      ]);
      const batches = [
        [0, 1],
        [1, 2],
      ];
      const embeddingDim = 3;

      const results = await embedOps.batchLookup(
        batches,
        embeddingMatrix,
        embeddingDim
      );

      expect(results.length).toBe(2);
      expect(results[0]).toEqual(new Float32Array([1, 2, 3, 4, 5, 6]));
      expect(results[1]).toEqual(new Float32Array([4, 5, 6, 7, 8, 9]));
    });
  });

  describe("Matrix Multiplication", () => {
    it("should multiply matrices", async () => {
      // A: 2x3, B: 3x2 -> C: 2x2
      const A = new Float32Array([1, 2, 3, 4, 5, 6]);
      const B = new Float32Array([7, 8, 9, 10, 11, 12]);

      const C = await embedOps.matmul(A, B, 2, 3, 2);

      expect(C[0]).toBeCloseTo(1 * 7 + 2 * 9 + 3 * 11, 5); // 58
      expect(C[1]).toBeCloseTo(1 * 8 + 2 * 10 + 3 * 12, 5); // 64
      expect(C[2]).toBeCloseTo(4 * 7 + 5 * 9 + 6 * 11, 5); // 139
      expect(C[3]).toBeCloseTo(4 * 8 + 5 * 10 + 6 * 12, 5); // 154
    });

    it("should batch multiply matrices", async () => {
      const A1 = new Float32Array([1, 2, 3, 4]);
      const B1 = new Float32Array([5, 7, 6, 8]);
      const A2 = new Float32Array([2, 3, 4, 5]);
      const B2 = new Float32Array([6, 8, 7, 9]);

      const results = await embedOps.batchMatmul([A1, A2], [B1, B2], 2, 2, 2);

      expect(results.length).toBe(2);
      expect(results[0][0]).toBeCloseTo(1 * 5 + 2 * 6, 5);
      expect(results[1][0]).toBeCloseTo(2 * 6 + 3 * 7, 5);
    });

    it("should multiply vector with matrix", async () => {
      const x = new Float32Array([1, 2]);
      const A = new Float32Array([1, 2, 3, 4, 5, 6]);

      const y = await embedOps.vecMatMul(x, A, 2, 3);

      expect(y[0]).toBeCloseTo(1 * 1 + 2 * 4, 5);
      expect(y[1]).toBeCloseTo(1 * 2 + 2 * 5, 5);
      expect(y[2]).toBeCloseTo(1 * 3 + 2 * 6, 5);
    });

    it("should multiply matrix with vector", async () => {
      const A = new Float32Array([1, 2, 3, 4, 5, 6]);
      const x = new Float32Array([1, 2, 3]);

      const y = await embedOps.matVecMul(A, x, 2, 3);

      expect(y[0]).toBeCloseTo(1 * 1 + 2 * 2 + 3 * 3, 5);
      expect(y[1]).toBeCloseTo(4 * 1 + 5 * 2 + 6 * 3, 5);
    });
  });

  describe("Attention", () => {
    it("should compute attention", async () => {
      const Q = new Float32Array([1, 0, 0, 1]);
      const K = new Float32Array([1, 0, 0, 1]);
      const V = new Float32Array([1, 2, 3, 4]);

      const config = { seqLen: 2, headDim: 2, numHeads: 1 };

      const result = await embedOps.attention(Q, K, V, config);

      expect(result.length).toBe(4);
    });

    it("should compute multi-head attention", async () => {
      const Q = [
        new Float32Array([1, 0, 0, 1]),
        new Float32Array([0, 1, 1, 0]),
      ];
      const K = [
        new Float32Array([1, 0, 0, 1]),
        new Float32Array([0, 1, 1, 0]),
      ];
      const V = [
        new Float32Array([1, 2, 3, 4]),
        new Float32Array([5, 6, 7, 8]),
      ];

      const config = { seqLen: 2, headDim: 2, numHeads: 2 };

      const result = await embedOps.multiHeadAttention(Q, K, V, config);

      expect(result.length).toBe(8); // seqLen * numHeads * headDim
    });
  });

  describe("Softmax", () => {
    it("should compute softmax", () => {
      const x = new Float32Array([1, 2, 3]);

      const result = embedOps.softmax(x);

      // Check sum is 1
      let sum = 0;
      for (let i = 0; i < result.length; i++) {
        sum += result[i];
      }
      expect(sum).toBeCloseTo(1.0, 5);

      // Check ordering (higher input -> higher output)
      expect(result[2]).toBeGreaterThan(result[1]);
      expect(result[1]).toBeGreaterThan(result[0]);
    });

    it("should handle negative values", () => {
      const x = new Float32Array([-1, -2, -3]);

      const result = embedOps.softmax(x);

      let sum = 0;
      for (let i = 0; i < result.length; i++) {
        sum += result[i];
      }
      expect(sum).toBeCloseTo(1.0, 5);
    });
  });

  describe("Layer Normalization", () => {
    it("should normalize layer", () => {
      const x = new Float32Array([1, 2, 3, 4, 5]);
      const gamma = new Float32Array([1, 1, 1, 1, 1]);
      const beta = new Float32Array([0, 0, 0, 0, 0]);

      const result = embedOps.layerNorm(x, gamma, beta);

      // Check mean is approximately 0
      const mean = result.reduce((a, b) => a + b, 0) / result.length;
      expect(mean).toBeCloseTo(0, 5);

      // Check std is approximately 1
      const variance =
        result.reduce((a, b) => a + (b - mean) ** 2, 0) / result.length;
      expect(variance).toBeCloseTo(1, 5);
    });

    it("should batch normalize layers", () => {
      const batch = [new Float32Array([1, 2, 3]), new Float32Array([4, 5, 6])];
      const gamma = new Float32Array([1, 1, 1]);
      const beta = new Float32Array([0, 0, 0]);

      const results = embedOps.batchLayerNorm(batch, gamma, beta);

      expect(results.length).toBe(2);
      for (const result of results) {
        const mean = result.reduce((a, b) => a + b, 0) / result.length;
        expect(mean).toBeCloseTo(0, 4);
      }
    });
  });

  describe("PCA", () => {
    it("should reduce dimensionality with PCA", async () => {
      const embeddings = [
        new Float32Array([1, 2, 3, 4]),
        new Float32Array([2, 3, 4, 5]),
        new Float32Array([3, 4, 5, 6]),
        new Float32Array([4, 5, 6, 7]),
      ];

      const result = await embedOps.pca(embeddings, 2);

      expect(result.reduced.length).toBe(4);
      expect(result.reduced[0].length).toBe(2);
      expect(result.components.length).toBe(8); // 4 * 2
      expect(result.mean.length).toBe(4);
      expect(result.explainedVariance.length).toBe(2);
    });

    it("should transform new data with PCA", async () => {
      const trainEmbeddings = [
        new Float32Array([1, 2, 3, 4]),
        new Float32Array([2, 3, 4, 5]),
        new Float32Array([3, 4, 5, 6]),
      ];

      const pcaResult = await embedOps.pca(trainEmbeddings, 2);

      const testEmbeddings = [
        new Float32Array([1.5, 2.5, 3.5, 4.5]),
        new Float32Array([2.5, 3.5, 4.5, 5.5]),
      ];

      const transformed = embedOps.transform(
        testEmbeddings,
        pcaResult.mean,
        pcaResult.components,
        2
      );

      expect(transformed.length).toBe(2);
      expect(transformed[0].length).toBe(2);
    });

    it("should batch PCA for large datasets", async () => {
      const embeddings: Float32Array[] = [];
      for (let i = 0; i < 100; i++) {
        embeddings.push(new Float32Array([i, i + 1, i + 2, i + 3]));
      }

      const result = await embedOps.batchPCA(embeddings, 2, 50);

      expect(result.length).toBe(100);
      expect(result[0].length).toBe(2);
    });
  });

  describe("Utility Functions", () => {
    it("should transpose matrix", () => {
      const A = new Float32Array([1, 2, 3, 4, 5, 6]); // 2x3

      const result = embedOps.transpose(A, 2, 3);

      expect(result.length).toBe(6);
      expect(result[0]).toBe(1);
      expect(result[1]).toBe(4);
      expect(result[2]).toBe(2);
      expect(result[3]).toBe(5);
      expect(result[4]).toBe(3);
      expect(result[5]).toBe(6);
    });
  });
});

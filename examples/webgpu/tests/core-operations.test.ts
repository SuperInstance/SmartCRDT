/**
 * WebGPU Examples - Core Operations Tests
 *
 * Tests for core compute operations: matrix multiplication, vector operations,
 * reduction operations, and embedding similarity.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { matrixMultiply } from '../src/core/05-matrix-multiplication.js';
import {
  vectorAdd,
  vectorSub,
  vectorMul,
  vectorScale
} from '../src/core/06-vector-operations.js';
import { sum, min, max, avg } from '../src/core/07-reduction-operations.js';
import { cosineSimilarity, batchCosineSimilarity } from '../src/core/08-embedding-similarity.js';

// CPU implementations for verification
function cpuMatrixMultiply(a: Float32Array, b: Float32Array, m: number, k: number, n: number): Float32Array {
  const c = new Float32Array(m * n);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let l = 0; l < k; l++) {
        sum += a[i * k + l] * b[l * n + j];
      }
      c[i * n + j] = sum;
    }
  }
  return c;
}

function cpuVectorAdd(a: Float32Array, b: Float32Array): Float32Array {
  const result = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] + b[i];
  }
  return result;
}

function cpuSum(data: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
  }
  return sum;
}

function cpuMin(data: Float32Array): number {
  let min = Infinity;
  for (let i = 0; i < data.length; i++) {
    if (data[i] < min) min = data[i];
  }
  return min;
}

function cpuMax(data: Float32Array): number {
  let max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    if (data[i] > max) max = data[i];
  }
  return max;
}

function cpuCosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// WebGPU availability check
const isWebGPUAvailable = typeof navigator !== 'undefined' && 'gpu' in navigator;

describe('Matrix Multiplication', () => {
  describe.skipIf(!isWebGPUAvailable)('GPU Implementation', () => {
    it('should multiply 2x2 matrices correctly', async () => {
      const a = new Float32Array([1, 2, 3, 4]); // 2x2
      const b = new Float32Array([5, 6, 7, 8]); // 2x2

      const result = await matrixMultiply(a, b, 2, 2, 2);

      expect(result.length).toBe(4);
      expect(result[0]).toBeCloseTo(1*5 + 2*7, 0.001); // 19
      expect(result[1]).toBeCloseTo(1*6 + 2*8, 0.001); // 22
      expect(result[2]).toBeCloseTo(3*5 + 4*7, 0.001); // 43
      expect(result[3]).toBeCloseTo(3*6 + 4*8, 0.001); // 50
    });

    it('should multiply 3x2 by 2x4 matrices', async () => {
      const a = new Float32Array([1, 2, 3, 4, 5, 6]); // 3x2
      const b = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]); // 2x4

      const result = await matrixMultiply(a, b, 3, 2, 4);

      expect(result.length).toBe(12);

      // Verify against CPU implementation
      const expected = cpuMatrixMultiply(a, b, 3, 2, 4);
      for (let i = 0; i < result.length; i++) {
        expect(result[i]).toBeCloseTo(expected[i], 0.001);
      }
    });

    it('should handle identity matrix multiplication', async () => {
      const n = 4;
      const identity = new Float32Array(n * n);
      for (let i = 0; i < n; i++) {
        identity[i * n + i] = 1;
      }

      const input = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);

      const result = await matrixMultiply(identity, input, n, n, n);

      // Identity * input = input
      for (let i = 0; i < result.length; i++) {
        expect(result[i]).toBeCloseTo(input[i], 0.001);
      }
    });

    it('should handle zero matrices', async () => {
      const zeros = new Float32Array(4).fill(0);
      const input = new Float32Array([1, 2, 3, 4]);

      const result = await matrixMultiply(zeros, input, 2, 2, 2);

      expect(Array.from(result)).toEqual([0, 0, 0, 0]);
    });

    it('should handle larger matrices', async () => {
      const m = 32, k = 32, n = 32;
      const a = new Float32Array(m * k).fill(1);
      const b = new Float32Array(k * n).fill(1);

      const result = await matrixMultiply(a, b, m, k, n);

      // Each element should be k * 1 * 1 = k
      for (let i = 0; i < result.length; i++) {
        expect(result[i]).toBeCloseTo(k, 0.1);
      }
    });
  });
});

describe('Vector Operations', () => {
  describe.skipIf(!isWebGPUAvailable)('Vector Addition', () => {
    it('should add two vectors', async () => {
      const a = new Float32Array([1, 2, 3, 4]);
      const b = new Float32Array([5, 6, 7, 8]);

      const result = await vectorAdd(a, b);

      expect(Array.from(result)).toEqual([6, 8, 10, 12]);
    });

    it('should match CPU implementation', async () => {
      const a = new Float32Array([1.5, 2.5, 3.5, 4.5]);
      const b = new Float32Array([0.5, 1.5, 2.5, 3.5]);

      const gpuResult = await vectorAdd(a, b);
      const cpuResult = cpuVectorAdd(a, b);

      for (let i = 0; i < gpuResult.length; i++) {
        expect(gpuResult[i]).toBeCloseTo(cpuResult[i], 0.001);
      }
    });
  });

  describe.skipIf(!isWebGPUAvailable)('Vector Subtraction', () => {
    it('should subtract two vectors', async () => {
      const a = new Float32Array([5, 6, 7, 8]);
      const b = new Float32Array([1, 2, 3, 4]);

      const result = await vectorSub(a, b);

      expect(Array.from(result)).toEqual([4, 4, 4, 4]);
    });
  });

  describe.skipIf(!isWebGPUAvailable)('Vector Multiplication', () => {
    it('should multiply two vectors element-wise', async () => {
      const a = new Float32Array([1, 2, 3, 4]);
      const b = new Float32Array([5, 6, 7, 8]);

      const result = await vectorMul(a, b);

      expect(Array.from(result)).toEqual([5, 12, 21, 32]);
    });
  });

  describe.skipIf(!isWebGPUAvailable)('Vector Scaling', () => {
    it('should scale vector by scalar', async () => {
      const vec = new Float32Array([1, 2, 3, 4]);
      const scalar = 2.5;

      const result = await vectorScale(vec, scalar);

      expect(Array.from(result)).toEqual([2.5, 5, 7.5, 10]);
    });

    it('should handle zero scaling', async () => {
      const vec = new Float32Array([1, 2, 3, 4]);

      const result = await vectorScale(vec, 0);

      expect(Array.from(result)).toEqual([0, 0, 0, 0]);
    });

    it('should handle negative scaling', async () => {
      const vec = new Float32Array([1, 2, 3, 4]);

      const result = await vectorScale(vec, -1);

      expect(Array.from(result)).toEqual([-1, -2, -3, -4]);
    });
  });
});

describe('Reduction Operations', () => {
  describe.skipIf(!isWebGPUAvailable)('Sum', () => {
    it('should sum array elements', async () => {
      const data = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

      const result = await sum(data);

      expect(result).toBeCloseTo(55, 0.001);
    });

    it('should match CPU implementation', async () => {
      const data = new Float32Array(1000);
      for (let i = 0; i < 1000; i++) {
        data[i] = i + 1;
      }

      const gpuResult = await sum(data);
      const cpuResult = cpuSum(data);

      expect(gpuResult).toBeCloseTo(cpuResult, 0.001);
    });

    it('should handle empty array', async () => {
      const data = new Float32Array(0);
      const result = await sum(data);
      expect(result).toBeCloseTo(0, 0.001);
    });

    it('should handle negative numbers', async () => {
      const data = new Float32Array([-1, -2, -3, 4, 5]);
      const result = await sum(data);
      expect(result).toBeCloseTo(3, 0.001);
    });
  });

  describe.skipIf(!isWebGPUAvailable)('Min', () => {
    it('should find minimum element', async () => {
      const data = new Float32Array([5, 2, 8, 1, 9, 3]);

      const result = await min(data);

      expect(result).toBeCloseTo(1, 0.001);
    });

    it('should match CPU implementation', async () => {
      const data = new Float32Array(1000);
      for (let i = 0; i < 1000; i++) {
        data[i] = Math.random() * 100;
      }

      const gpuResult = await min(data);
      const cpuResult = cpuMin(data);

      expect(gpuResult).toBeCloseTo(cpuResult, 0.001);
    });
  });

  describe.skipIf(!isWebGPUAvailable)('Max', () => {
    it('should find maximum element', async () => {
      const data = new Float32Array([5, 2, 8, 1, 9, 3]);

      const result = await max(data);

      expect(result).toBeCloseTo(9, 0.001);
    });

    it('should match CPU implementation', async () => {
      const data = new Float32Array(1000);
      for (let i = 0; i < 1000; i++) {
        data[i] = Math.random() * 100;
      }

      const gpuResult = await max(data);
      const cpuResult = cpuMax(data);

      expect(gpuResult).toBeCloseTo(cpuResult, 0.001);
    });
  });

  describe.skipIf(!isWebGPUAvailable)('Average', () => {
    it('should calculate average', async () => {
      const data = new Float32Array([1, 2, 3, 4, 5]);

      const result = await avg(data);

      expect(result).toBeCloseTo(3, 0.001);
    });

    it('should handle different sized arrays', async () => {
      const data = new Float32Array(100);
      for (let i = 0; i < 100; i++) {
        data[i] = i;
      }

      const result = await avg(data);
      const expected = 49.5; // Average of 0-99

      expect(result).toBeCloseTo(expected, 0.001);
    });
  });
});

describe('Embedding Similarity', () => {
  describe.skipIf(!isWebGPUAvailable)('Cosine Similarity', () => {
    it('should calculate cosine similarity for identical vectors', async () => {
      const vec = new Float32Array([1, 2, 3, 4]);

      const result = await cosineSimilarity(vec, vec);

      expect(result).toBeCloseTo(1, 0.001);
    });

    it('should calculate cosine similarity for orthogonal vectors', async () => {
      const a = new Float32Array([1, 0, 0, 0]);
      const b = new Float32Array([0, 1, 0, 0]);

      const result = await cosineSimilarity(a, b);

      expect(result).toBeCloseTo(0, 0.001);
    });

    it('should calculate cosine similarity for opposite vectors', async () => {
      const a = new Float32Array([1, 1, 1, 1]);
      const b = new Float32Array([-1, -1, -1, -1]);

      const result = await cosineSimilarity(a, b);

      expect(result).toBeCloseTo(-1, 0.001);
    });

    it('should match CPU implementation', async () => {
      const a = new Float32Array(128);
      const b = new Float32Array(128);
      for (let i = 0; i < 128; i++) {
        a[i] = Math.random();
        b[i] = Math.random();
      }

      const gpuResult = await cosineSimilarity(a, b);
      const cpuResult = cpuCosineSimilarity(a, b);

      expect(gpuResult).toBeCloseTo(cpuResult, 0.01);
    });

    it('should handle VL-JEPA 768-dim embeddings', async () => {
      const a = new Float32Array(768);
      const b = new Float32Array(768);
      for (let i = 0; i < 768; i++) {
        a[i] = Math.sin(i * 0.1);
        b[i] = Math.cos(i * 0.1);
      }

      const result = await cosineSimilarity(a, b);

      expect(result).toBeGreaterThanOrEqual(-1);
      expect(result).toBeLessThanOrEqual(1);
    });
  });

  describe.skipIf(!isWebGPUAvailable)('Batch Cosine Similarity', () => {
    it('should calculate similarities for multiple embeddings', async () => {
      const query = new Float32Array([1, 0, 0]);
      const corpus = [
        new Float32Array([1, 0, 0]), // identical
        new Float32Array([0, 1, 0]), // orthogonal
        new Float32Array([0.9, 0.1, 0]) // similar
      ];

      const results = await batchCosineSimilarity(query, corpus);

      expect(results.length).toBe(3);
      expect(results[0]).toBeCloseTo(1, 0.001);
      expect(results[1]).toBeCloseTo(0, 0.001);
      expect(results[2]).toBeGreaterThan(0.9);
    });

    it('should handle empty corpus', async () => {
      const query = new Float32Array([1, 2, 3]);
      const corpus: Float32Array[] = [];

      const results = await batchCosineSimilarity(query, corpus);

      expect(results.length).toBe(0);
    });
  });
});

describe('Edge Cases and Error Handling', () => {
  it.skipIf(!isWebGPUAvailable)('should handle mismatched vector dimensions', async () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([1, 2]);

    await expect(vectorAdd(a, b)).rejects.toThrow();
  });

  it.skipIf(!isWebGPUAvailable)('should handle very large arrays', async () => {
    const largeData = new Float32Array(1000000);
    for (let i = 0; i < largeData.length; i++) {
      largeData[i] = Math.random();
    }

    const result = await sum(largeData);

    expect(result).toBeGreaterThan(0);
  });
});

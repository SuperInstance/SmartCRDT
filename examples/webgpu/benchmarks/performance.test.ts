/**
 * WebGPU Examples Performance Benchmarks
 *
 * Benchmark suite for measuring WebGPU compute performance.
 */

import { describe, bench } from 'vitest';
import { matrixMultiply } from '../src/core/05-matrix-multiplication.js';
import { vectorAdd } from '../src/core/06-vector-operations.js';
import { sum as gpuSum } from '../src/core/07-reduction-operations.js';
import { cosineSimilarity } from '../src/core/08-embedding-similarity.js';
import { bitonicSort } from '../src/advanced/12-sort-algorithms.js';

// CPU implementations for comparison
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

function cpuCosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Note: WebGPU tests are skipped in non-browser environments
// Run these tests in a browser with WebGPU support

describe('WebGPU Performance Benchmarks', () => {
  describe.skipIf(typeof navigator === 'undefined' || !('gpu' in navigator))('Matrix Multiplication', () => {
    const sizes = [
      { m: 64, k: 64, n: 64 },
      { m: 128, k: 128, n: 128 },
      { m: 256, k: 256, n: 256 }
    ];

    for (const size of sizes) {
      const { m, k, n } = size;
      const ops = 2 * m * k * n; // Multiply-add operations

      bench(`GPU ${m}x${k} * ${k}x${n}`, async () => {
        const a = new Float32Array(m * k).fill(1);
        const b = new Float32Array(k * n).fill(1);
        await matrixMultiply(a, b, m, k, n);
      });

      bench(`CPU ${m}x${k} * ${k}x${n}`, () => {
        const a = new Float32Array(m * k).fill(1);
        const b = new Float32Array(k * n).fill(1);
        cpuMatrixMultiply(a, b, m, k, n);
      });
    }
  });

  describe.skipIf(typeof navigator === 'undefined' || !('gpu' in navigator))('Vector Operations', () => {
    const sizes = [1000, 10000, 100000];

    for (const size of sizes) {
      bench(`GPU vector add ${size} elements`, async () => {
        const a = new Float32Array(size).fill(1);
        const b = new Float32Array(size).fill(2);
        await vectorAdd(a, b);
      });

      bench(`CPU vector add ${size} elements`, () => {
        const a = new Float32Array(size).fill(1);
        const b = new Float32Array(size).fill(2);
        cpuVectorAdd(a, b);
      });
    }
  });

  describe.skipIf(typeof navigator === 'undefined' || !('gpu' in navigator))('Reduction Operations', () => {
    const sizes = [10000, 100000, 1000000];

    for (const size of sizes) {
      bench(`GPU sum ${size} elements`, async () => {
        const data = new Float32Array(size).fill(1);
        await gpuSum(data);
      });

      bench(`CPU sum ${size} elements`, () => {
        const data = new Float32Array(size).fill(1);
        cpuSum(data);
      });
    }
  });

  describe.skipIf(typeof navigator === 'undefined' || !('gpu' in navigator))('Embedding Similarity', () => {
    const dimensions = [128, 512, 768, 1024];

    for (const dim of dimensions) {
      bench(`GPU cosine similarity ${dim}-dim`, async () => {
        const a = new Float32Array(dim).fill(1);
        const b = new Float32Array(dim).fill(0.9);
        await cosineSimilarity(a, b);
      });

      bench(`CPU cosine similarity ${dim}-dim`, () => {
        const a = new Float32Array(dim).fill(1);
        const b = new Float32Array(dim).fill(0.9);
        cpuCosineSimilarity(a, b);
      });
    }
  });

  describe.skipIf(typeof navigator === 'undefined' || !('gpu' in navigator))('Sorting', () => {
    const sizes = [256, 1024, 4096];

    for (const size of sizes) {
      bench(`GPU bitonic sort ${size} elements`, async () => {
        const data = new Float32Array(size);
        for (let i = 0; i < size; i++) {
          data[i] = Math.random();
        }
        await bitonicSort(data);
      });

      bench(`CPU quicksort ${size} elements`, () => {
        const data = new Float32Array(size);
        for (let i = 0; i < size; i++) {
          data[i] = Math.random();
        }
        Array.from(data).sort((a, b) => a - b);
      });
    }
  });
});

/**
 * Memory bandwidth benchmark
 */
describe.skipIf(typeof navigator === 'undefined' || !('gpu' in navigator))('Memory Bandwidth', () => {
  bench('Sequential read 1MB', async () => {
    const data = new Float32Array(256 * 1024);
    // Simulate read operation
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
  });

  bench('Sequential read 10MB', async () => {
    const data = new Float32Array(256 * 1024 * 10);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
  });
});

/**
 * Kernel performance comparison
 */
describe.skipIf(typeof navigator === 'undefined' || !('gpu' in navigator))('Kernel Comparison', () => {
  bench('Simple kernel (low arithmetic intensity)', async () => {
    const data = new Float32Array(1024 * 1024);
    // Low arithmetic: 1 operation per element
    for (let i = 0; i < data.length; i++) {
      data[i] = data[i] + 1;
    }
  });

  bench('Compute-bound kernel (high arithmetic intensity)', async () => {
    const data = new Float32Array(1024 * 1024);
    // High arithmetic: 100 operations per element
    for (let i = 0; i < data.length; i++) {
      let val = data[i];
      for (let j = 0; j < 100; j++) {
        val = val * 1.01 + 0.1;
      }
      data[i] = val;
    }
  });
});

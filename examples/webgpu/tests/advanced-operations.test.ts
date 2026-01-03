/**
 * WebGPU Examples - Advanced Operations Tests
 *
 * Tests for advanced compute operations: neural networks, attention mechanisms,
 * parallel reduction, and sorting algorithms.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GPUNeuralNetwork, createXORNetwork } from '../src/advanced/09-neural-network.ts';
import {
  computeAttentionScores,
  softmax
} from '../src/advanced/10-attention-mechanism.ts';
import {
  optimizedParallelSum,
  parallelReduce,
  parallelScan,
  ReduceOp
} from '../src/advanced/11-parallel-reduction.ts';
import {
  bitonicSort,
  countingSort,
  radixSort
} from '../src/advanced/12-sort-algorithms.ts';

const isWebGPUAvailable = typeof navigator !== 'undefined' && 'gpu' in navigator;

describe('Neural Network Inference', () => {
  let nn: GPUNeuralNetwork;

  beforeEach(async () => {
    if (isWebGPUAvailable) {
      nn = new GPUNeuralNetwork();
      await nn.init(createXORNetwork().layers);
    }
  });

  afterEach(() => {
    if (nn) {
      nn.dispose();
    }
  });

  describe.skipIf(!isWebGPUAvailable)('XOR Problem', () => {
    it('should solve XOR correctly', async () => {
      const { layers, weights } = createXORNetwork();

      const testCases = [
        new Float32Array([0, 0]),
        new Float32Array([0, 1]),
        new Float32Array([1, 0]),
        new Float32Array([1, 1])
      ];

      const results: (0 | 1)[] = [];
      for (const input of testCases) {
        const output = await nn.forward(input, weights);
        results.push(output[0] > 0.5 ? 1 : 0);
      }

      // XOR truth table
      expect(results[0]).toBe(0); // 0 XOR 0 = 0
      expect(results[1]).toBe(1); // 0 XOR 1 = 1
      expect(results[2]).toBe(1); // 1 XOR 0 = 1
      expect(results[3]).toBe(0); // 1 XOR 1 = 0
    });

    it('should output confidence scores', async () => {
      const { weights } = createXORNetwork();
      const input = new Float32Array([1, 0]);

      const output = await nn.forward(input, weights);

      expect(output.length).toBe(1);
      expect(output[0]).toBeGreaterThanOrEqual(0);
      expect(output[0]).toBeLessThanOrEqual(1);
    });
  });

  describe.skipIf(!isWebGPUAvailable)('Network Initialization', () => {
    it('should initialize with custom layers', async () => {
      const customNN = new GPUNeuralNetwork();
      await customNN.init([
        { inputSize: 10, outputSize: 5, hasBias: false, activation: 'relu' },
        { inputSize: 5, outputSize: 2, hasBias: true, activation: 'none' }
      ]);

      const input = new Float32Array(10).fill(0.5);
      const output = await customNN.forward(input, {
        0: {
          weights: new Float32Array(10 * 5).fill(0.1),
          biases: new Float32Array(5).fill(0)
        },
        1: {
          weights: new Float32Array(5 * 2).fill(0.1),
          biases: new Float32Array(2).fill(0.1)
        }
      });

      expect(output.length).toBe(2);

      customNN.dispose();
    });
  });

  describe.skipIf(!isWebGPUAvailable)('Activation Functions', () => {
    it('should apply ReLU activation', async () => {
      const customNN = new GPUNeuralNetwork();
      await customNN.init([
        { inputSize: 3, outputSize: 3, hasBias: false, activation: 'relu' }
      ]);

      const input = new Float32Array([-1, 0, 1]);
      const output = await customNN.forward(input, {
        0: {
          weights: new Float32Array(9).fill(1)
        }
      });

      // ReLU should make negative values 0
      expect(output.every(v => v >= 0)).toBe(true);

      customNN.dispose();
    });

    it('should apply sigmoid activation', async () => {
      const customNN = new GPUNeuralNetwork();
      await customNN.init([
        { inputSize: 1, outputSize: 1, hasBias: false, activation: 'sigmoid' }
      ]);

      const input = new Float32Array([0]);
      const output = await customNN.forward(input, {
        0: {
          weights: new Float32Array(1).fill(1)
        }
      });

      // Sigmoid(0) = 0.5
      expect(output[0]).toBeCloseTo(0.5, 0.1);

      customNN.dispose();
    });
  });
});

describe('Attention Mechanism', () => {
  describe.skipIf(!isWebGPUAvailable)('Attention Scores', () => {
    it('should compute attention scores', async () => {
      const seqLen = 4;
      const headDim = 8;

      // Create Q and K matrices
      const Q = new Float32Array(seqLen * headDim);
      const K = new Float32Array(seqLen * headDim);

      for (let i = 0; i < seqLen * headDim; i++) {
        Q[i] = Math.random() * 0.1;
        K[i] = Math.random() * 0.1;
      }

      const scores = await computeAttentionScores(Q, K, seqLen, headDim);

      expect(scores.length).toBe(seqLen * seqLen);

      // Verify each row is a sequence
      for (let i = 0; i < seqLen; i++) {
        for (let j = 0; j < seqLen; j++) {
          expect(scores[i * seqLen + j]).toBeFinite();
        }
      }
    });

    it('should scale scores correctly', async () => {
      const seqLen = 2;
      const headDim = 4;

      const Q = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0]);
      const K = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0]);

      const scores = await computeAttentionScores(Q, K, seqLen, headDim);

      // Self-similarity should be higher than cross-similarity
      expect(scores[0]).toBeGreaterThan(scores[1]);
      expect(scores[3]).toBeGreaterThan(scores[2]);
    });
  });

  describe.skipIf(!isWebGPUAvailable)('Softmax', () => {
    it('should apply softmax to rows', async () => {
      const input = new Float32Array([1, 2, 3, 4, 5, 6]);
      const rows = 2;
      const cols = 3;

      const output = await softmax(input, rows, cols);

      expect(output.length).toBe(input.length);

      // Each row should sum to approximately 1
      for (let row = 0; row < rows; row++) {
        let rowSum = 0;
        for (let col = 0; col < cols; col++) {
          rowSum += output[row * cols + col];
        }
        expect(rowSum).toBeCloseTo(1, 0.001);
      }
    });

    it('should handle uniform distribution', async () => {
      const input = new Float32Array([1, 1, 1, 1]);
      const rows = 1;
      const cols = 4;

      const output = await softmax(input, rows, cols);

      // Uniform input should give uniform output
      for (let i = 0; i < output.length; i++) {
        expect(output[i]).toBeCloseTo(0.25, 0.001);
      }
    });
  });
});

describe('Parallel Reduction', () => {
  describe.skipIf(!isWebGPUAvailable)('Optimized Sum', () => {
    it('should sum array correctly', async () => {
      const data = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);

      const result = await optimizedParallelSum(data);

      expect(result).toBeCloseTo(36, 0.001);
    });

    it('should handle large arrays', async () => {
      const data = new Float32Array(10000);
      for (let i = 0; i < 10000; i++) {
        data[i] = 1;
      }

      const result = await optimizedParallelSum(data);

      expect(result).toBeCloseTo(10000, 0.01);
    });
  });

  describe.skipIf(!isWebGPUAvailable)('General Reduction', () => {
    it('should compute sum', async () => {
      const data = new Float32Array([1, 2, 3, 4, 5]);

      const result = await parallelReduce(data, 'sum');

      expect(result).toBeCloseTo(15, 0.001);
    });

    it('should compute minimum', async () => {
      const data = new Float32Array([5, 2, 8, 1, 9]);

      const result = await parallelReduce(data, 'min');

      expect(result).toBeCloseTo(1, 0.001);
    });

    it('should compute maximum', async () => {
      const data = new Float32Array([5, 2, 8, 1, 9]);

      const result = await parallelReduce(data, 'max');

      expect(result).toBeCloseTo(9, 0.001);
    });

    it('should compute product', async () => {
      const data = new Float32Array([2, 3, 4]);

      const result = await parallelReduce(data, 'prod');

      expect(result).toBeCloseTo(24, 0.001);
    });
  });

  describe.skipIf(!isWebGPUAvailable)('Prefix Sum (Scan)', () => {
    it('should compute prefix sum', async () => {
      const data = new Float32Array([1, 2, 3, 4, 5]);

      const result = await parallelScan(data);

      expect(Array.from(result)).toEqual([1, 3, 6, 10, 15]);
    });

    it('should handle negative numbers', async () => {
      const data = new Float32Array([1, -2, 3, -1, 2]);

      const result = await parallelScan(data);

      expect(result[0]).toBeCloseTo(1, 0.1);
      expect(result[1]).toBeCloseTo(-1, 0.1);
      expect(result[2]).toBeCloseTo(2, 0.1);
    });
  });
});

describe('Sorting Algorithms', () => {
  describe.skipIf(!isWebGPUAvailable)('Bitonic Sort', () => {
    it('should sort power-of-2 arrays', async () => {
      const data = new Float32Array([4, 2, 7, 1, 8, 3, 6, 5]);

      const result = await bitonicSort(data);

      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1]).toBeLessThanOrEqual(result[i]);
      }
    });

    it('should handle 256 elements', async () => {
      const data = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        data[i] = Math.random() * 100;
      }

      const result = await bitonicSort(data);

      // Verify sorted
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1]).toBeLessThanOrEqual(result[i]);
      }
    });

    it('should handle already sorted arrays', async () => {
      const data = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);

      const result = await bitonicSort(data);

      expect(Array.from(result)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('should handle reverse sorted arrays', async () => {
      const data = new Float32Array([8, 7, 6, 5, 4, 3, 2, 1]);

      const result = await bitonicSort(data);

      expect(Array.from(result)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });
  });

  describe.skipIf(!isWebGPUAvailable)('Counting Sort', () => {
    it('should sort integers', async () => {
      const data = new Uint32Array([4, 2, 7, 1, 8, 3, 6, 5]);

      const result = await countingSort(data, 10);

      // Verify sorted
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1]).toBeLessThanOrEqual(result[i]);
      }
    });

    it('should handle duplicates', async () => {
      const data = new Uint32Array([5, 2, 5, 1, 5, 2, 1]);

      const result = await countingSort(data, 10);

      expect(Array.from(result)).toEqual([1, 1, 2, 2, 5, 5, 5]);
    });
  });

  describe.skipIf(!isWebGPUAvailable)('Radix Sort', () => {
    it('should sort integers', async () => {
      const data = new Uint32Array([100, 50, 75, 25, 125, 0]);

      const result = await radixSort(data);

      // Verify sorted
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1]).toBeLessThanOrEqual(result[i]);
      }
    });

    it('should handle large numbers', async () => {
      const data = new Uint32Array([1000000, 1, 500000, 1000, 750000]);

      const result = await radixSort(data);

      expect(Array.from(result)).toEqual([1, 1000, 500000, 750000, 1000000]);
    });
  });
});

describe('Performance Tests', () => {
  it.skipIf(!isWebGPUAvailable)('should complete operations quickly', async () => {
    const nn = new GPUNeuralNetwork();
    await nn.init(createXORNetwork().layers);

    const { weights } = createXORNetwork();
    const input = new Float32Array([1, 0]);

    const start = performance.now();
    await nn.forward(input, weights);
    const end = performance.now();

    // Should complete in reasonable time
    expect(end - start).toBeLessThan(1000);

    nn.dispose();
  });
});

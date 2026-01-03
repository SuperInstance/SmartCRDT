/**
 * @lsi/webgpu-compute/shaders test suite
 *
 * Tests for shader generation and utilities.
 */

import { describe, it, expect } from 'vitest';

// Import shader generation functions
import {
  getMatMulShader,
  getBatchMatMulShader,
  getTransposeShader,
  getMatAddShader,
  DEFAULT_MATMUL_SHADERS,
} from '../src/shaders/MatMulShader.js';

import {
  getVectorAddShader,
  getVectorDotShader,
  getVectorNormalizeShader,
  getCosineSimilarityShader,
  getVectorOpShader,
  DEFAULT_VECTOR_SHADERS,
} from '../src/shaders/VectorShader.js';

import {
  getSumReductionShader,
  getMinReductionShader,
  getMaxReductionShader,
  getArgminReductionShader,
  getArgmaxReductionShader,
  getMeanReductionShader,
  getReductionShader,
  DEFAULT_REDUCTION_SHADERS,
} from '../src/shaders/ReductionShader.js';

import {
  getCosineSimilaritySearchShader,
  getEuclideanDistanceSearchShader,
  getEmbeddingNormalizeShader,
  getEmbeddingConcatShader,
  getEmbeddingAverageShader,
  getSimilarityMatrixShader,
  getSimilarityShader,
  DEFAULT_EMBEDDING_SHADERS,
} from '../src/shaders/EmbeddingShader.js';

import {
  getReLUShader,
  getGELUShader,
  getSwishShader,
  getSigmoidShader,
  getTanhShader,
  getSoftmaxShader,
  getMaxPool2DShader,
  getAvgPool2DShader,
  getLayerNormShader,
  getActivationShader,
  DEFAULT_NEURAL_SHADERS,
} from '../src/shaders/NeuralShader.js';

import {
  getShader,
  SHADER_CATEGORIES,
  MATRIX_OPERATIONS,
  VECTOR_OPERATIONS,
  REDUCTION_OPERATIONS,
  EMBEDDING_OPERATIONS,
  NEURAL_OPERATIONS,
} from '../src/shaders/index.js';

describe('Matrix Shaders', () => {
  describe('getMatMulShader', () => {
    it('should generate matrix multiplication shader', () => {
      const shader = getMatMulShader(64, 64, 64);

      expect(shader).toContain('@group(0) @binding(0)');
      expect(shader).toContain('var<storage, read> A: array<f32>');
      expect(shader).toContain('var<storage, read> B: array<f32>');
      expect(shader).toContain('var<storage, read_write> C: array<f32>');
      expect(shader).toContain('@compute');
      expect(shader).toContain('@workgroup_size');
      expect(shader).toContain('fn main(');
    });

    it('should include correct matrix dimensions', () => {
      const shader = getMatMulShader(128, 256, 512);

      expect(shader).toContain('128u');
      expect(shader).toContain('256u');
      expect(shader).toContain('512u');
    });

    it('should use custom workgroup size', () => {
      const shader = getMatMulShader(64, 64, 64, { x: 32, y: 32, z: 1 });

      expect(shader).toContain('@workgroup_size(32u, 32u, 1u)');
    });
  });

  describe('getBatchMatMulShader', () => {
    it('should generate batched matrix multiplication shader', () => {
      const shader = getBatchMatMulShader(10, 64, 64, 64);

      expect(shader).toContain('@group(0) @binding(0)');
      expect(shader).toContain('var<storage, read> A: array<f32>');
      expect(shader).toContain('var<storage, read> B: array<f32>');
      expect(shader).toContain('var<storage, read_write> C: array<f32>');
      expect(shader).toContain('batch = global_id.z');
    });

    it('should include batch size in shader', () => {
      const shader = getBatchMatMulShader(32, 128, 128, 256);

      expect(shader).toContain('32u');
      expect(shader).toContain('batchOffset');
      expect(shader).toContain('batchOffsetC');
    });
  });

  describe('getTransposeShader', () => {
    it('should generate transpose shader', () => {
      const shader = getTransposeShader(64, 128);

      expect(shader).toContain('B[col * M + row] = A[row * N + col]');
      expect(shader).toContain('var<storage, read_write> B: array<f32>');
    });
  });

  describe('getMatAddShader', () => {
    it('should generate matrix addition shader', () => {
      const shader = getMatAddShader(64, 64);

      expect(shader).toContain('C[idx] = A[idx] + B[idx]');
    });
  });

  describe('DEFAULT_MATMUL_SHADERS', () => {
    it('should have pre-configured shaders', () => {
      expect(DEFAULT_MATMUL_SHADERS['768x768']).toBeDefined();
      expect(DEFAULT_MATMUL_SHADERS['1536x768']).toBeDefined();
      expect(DEFAULT_MATMUL_SHADERS['768x1536']).toBeDefined();
    });
  });
});

describe('Vector Shaders', () => {
  describe('getVectorAddShader', () => {
    it('should generate vector addition shader', () => {
      const shader = getVectorAddShader(768);

      expect(shader).toContain('c[idx] = a[idx] + b[idx]');
      expect(shader).toContain('var<storage, read> a: array<f32>');
      expect(shader).toContain('var<storage, read> b: array<f32>');
      expect(shader).toContain('var<storage, read_write> c: array<f32>');
    });

    it('should support batch operations', () => {
      const shader = getVectorAddShader(768, 100);

      expect(shader).toContain('vec_idx = global_id.y');
      expect(shader).toContain('elem_idx = global_id.x');
    });
  });

  describe('getVectorDotShader', () => {
    it('should generate dot product shader', () => {
      const shader = getVectorDotShader(768);

      expect(shader).toContain('sum = sum + a[offset + i] * b[offset + i]');
      expect(shader).toContain('dot[pair_idx] = sum');
    });
  });

  describe('getVectorNormalizeShader', () => {
    it('should generate normalization shader', () => {
      const shader = getVectorNormalizeShader(768);

      expect(shader).toContain('norm = sqrt(sum)');
      expect(shader).toContain('c[offset + j] = a[offset + j] / (norm + 1e-8)');
    });
  });

  describe('getCosineSimilarityShader', () => {
    it('should generate cosine similarity shader', () => {
      const shader = getCosineSimilarityShader(768, 100);

      expect(shader).toContain('dot = dot + val_a * val_b');
      expect(shader).toContain('norm_a = norm_a + val_a * val_a');
      expect(shader).toContain('norm_product = sqrt(norm_a) * sqrt(norm_b)');
      expect(shader).toContain('similarity[pair_idx]');
    });
  });

  describe('getVectorOpShader', () => {
    it('should return correct shader for operation', () => {
      const addShader = getVectorOpShader('add', 768);
      const subShader = getVectorOpShader('sub', 768);
      const mulShader = getVectorOpShader('mul', 768);

      expect(addShader).toContain('+');
      expect(subShader).toContain('-');
      expect(mulShader).toContain('*');
    });

    it('should throw error for unknown operation', () => {
      expect(() => getVectorOpShader('unknown' as any, 768)).toThrow();
    });
  });

  describe('DEFAULT_VECTOR_SHADERS', () => {
    it('should have pre-configured 768-dim shaders', () => {
      expect(DEFAULT_VECTOR_SHADERS['768-add']).toBeDefined();
      expect(DEFAULT_VECTOR_SHADERS['768-dot']).toBeDefined();
      expect(DEFAULT_VECTOR_SHADERS['768-normalize']).toBeDefined();
      expect(DEFAULT_VECTOR_SHADERS['768-similarity']).toBeDefined();
    });
  });
});

describe('Reduction Shaders', () => {
  describe('getSumReductionShader', () => {
    it('should generate sum reduction shader', () => {
      const shader = getSumReductionShader(1024);

      expect(shader).toContain('output[idx] = input[idx]');
      expect(shader).toContain('var<storage, read> input: array<f32>');
      expect(shader).toContain('var<storage, read_write> output: array<f32>');
    });
  });

  describe('getMinReductionShader', () => {
    it('should generate min reduction shader', () => {
      const shader = getMinReductionShader(1024);

      expect(shader).toContain('output[idx] = input[idx]');
    });
  });

  describe('getMaxReductionShader', () => {
    it('should generate max reduction shader', () => {
      const shader = getMaxReductionShader(1024);

      expect(shader).toContain('output[idx] = input[idx]');
    });
  });

  describe('getArgminReductionShader', () => {
    it('should generate argmin reduction shader', () => {
      const shader = getArgminReductionShader(1024);

      expect(shader).toContain('struct MinValIndex');
      expect(shader).toContain('value: f32');
      expect(shader).toContain('index: u32');
      expect(shader).toContain('MinValIndex(input[idx], idx)');
    });
  });

  describe('getArgmaxReductionShader', () => {
    it('should generate argmax reduction shader', () => {
      const shader = getArgmaxReductionShader(1024);

      expect(shader).toContain('struct MaxValIndex');
      expect(shader).toContain('value: f32');
      expect(shader).toContain('index: u32');
      expect(shader).toContain('MaxValIndex(input[idx], idx)');
    });
  });

  describe('getMeanReductionShader', () => {
    it('should generate mean reduction shader', () => {
      const shader = getMeanReductionShader(1024);

      expect(shader).toContain('struct MeanParams');
      expect(shader).toContain('count: u32');
    });
  });

  describe('getReductionShader', () => {
    it('should return correct shader for operation', () => {
      const sumShader = getReductionShader('sum', 1024);
      const minShader = getReductionShader('min', 1024);
      const maxShader = getReductionShader('max', 1024);

      expect(sumShader).toContain('var<storage, read_write> output');
      expect(minShader).toContain('var<storage, read_write> output');
      expect(maxShader).toContain('var<storage, read_write> output');
    });
  });

  describe('DEFAULT_REDUCTION_SHADERS', () => {
    it('should have pre-configured 768-dim shaders', () => {
      expect(DEFAULT_REDUCTION_SHADERS['768-sum']).toBeDefined();
      expect(DEFAULT_REDUCTION_SHADERS['768-min']).toBeDefined();
      expect(DEFAULT_REDUCTION_SHADERS['768-max']).toBeDefined();
      expect(DEFAULT_REDUCTION_SHADERS['768-mean']).toBeDefined();
      expect(DEFAULT_REDUCTION_SHADERS['768-argmin']).toBeDefined();
      expect(DEFAULT_REDUCTION_SHADERS['768-argmax']).toBeDefined();
    });
  });
});

describe('Embedding Shaders', () => {
  describe('getCosineSimilaritySearchShader', () => {
    it('should generate cosine similarity search shader', () => {
      const shader = getCosineSimilaritySearchShader(768, 1000);

      expect(shader).toContain('var<storage, read> query: array<f32>');
      expect(shader).toContain('var<storage, read> candidates: array<f32>');
      expect(shader).toContain('var<storage, read_write> similarities: array<f32>');
      expect(shader).toContain('cosine_sim_search_main');
    });

    it('should include boundary checks', () => {
      const shader = getCosineSimilaritySearchShader(768, 100);

      expect(shader).toContain('if (candidate_idx >= 100u)');
      expect(shader).toContain('return');
    });
  });

  describe('getEuclideanDistanceSearchShader', () => {
    it('should generate Euclidean distance shader', () => {
      const shader = getEuclideanDistanceSearchShader(768, 1000);

      expect(shader).toContain('euclidean_dist_search_main');
      expect(shader).toContain('sum_sq = sum_sq + diff * diff');
      expect(shader).toContain('distances[candidate_idx] = sqrt(sum_sq)');
    });
  });

  describe('getEmbeddingNormalizeShader', () => {
    it('should generate embedding normalization shader', () => {
      const shader = getEmbeddingNormalizeShader(768, 100);

      expect(shader).toContain('embedding_normalize_main');
      expect(shader).toContain('norm = sqrt(sum)');
      expect(shader).toContain('c[offset + j] = a[offset + j] / (norm + 1e-8)');
    });
  });

  describe('getEmbeddingConcatShader', () => {
    it('should generate concatenation shader', () => {
      const shader = getEmbeddingConcatShader(768, 2);

      expect(shader).toContain('embedding_concat_main');
      expect(shader).toContain('emb_idx = idx / 768u');
      expect(shader).toContain('pos_idx = idx % 768u');
    });
  });

  describe('getEmbeddingAverageShader', () => {
    it('should generate averaging shader', () => {
      const shader = getEmbeddingAverageShader(768, 4);

      expect(shader).toContain('embedding_average_main');
      expect(shader).toContain('sum = sum + input[i * 768u + pos_idx]');
      expect(shader).toContain('output[pos_idx] = sum / f32(params.count)');
    });
  });

  describe('getSimilarityMatrixShader', () => {
    it('should generate similarity matrix shader', () => {
      const shader = getSimilarityMatrixShader(768, 100, 'cosine');

      expect(shader).toContain('similarity_matrix_main');
      expect(shader).toContain('let i = global_id.x');
      expect(shader).toContain('let j = global_id.y');
      expect(shader).toContain('similarity_matrix[i * 100u + j]');
    });
  });

  describe('getSimilarityShader', () => {
    it('should return correct shader for metric', () => {
      const cosineShader = getSimilarityShader('cosine', 768, 100);
      const euclideanShader = getSimilarityShader('euclidean', 768, 100);
      const manhattanShader = getSimilarityShader('manhattan', 768, 100);

      expect(cosineShader).toContain('cosine_sim_search_main');
      expect(euclideanShader).toContain('euclidean_dist_search_main');
      expect(manhattanShader).toContain('manhattan_dist_search_main');
    });
  });

  describe('DEFAULT_EMBEDDING_SHADERS', () => {
    it('should have pre-configured 768-dim shaders', () => {
      expect(DEFAULT_EMBEDDING_SHADERS['768-cosine-search']).toBeDefined();
      expect(DEFAULT_EMBEDDING_SHADERS['768-euclidean-search']).toBeDefined();
      expect(DEFAULT_EMBEDDING_SHADERS['768-normalize']).toBeDefined();
      expect(DEFAULT_EMBEDDING_SHADERS['768-similarity-matrix']).toBeDefined();
    });
  });
});

describe('Neural Shaders', () => {
  describe('getReLUShader', () => {
    it('should generate ReLU shader', () => {
      const shader = getReLUShader(768);

      expect(shader).toContain('relu_main');
      expect(shader).toContain('output[idx] = max(0.0, input[idx])');
    });
  });

  describe('getGELUShader', () => {
    it('should generate GELU shader', () => {
      const shader = getGELUShader(768);

      expect(shader).toContain('gelu_main');
      expect(shader).toContain('0.7978845608');
      expect(shader).toContain('0.044715');
      expect(shader).toContain('0.5 * x * (1.0 + tanh(');
    });
  });

  describe('getSwishShader', () => {
    it('should generate Swish shader', () => {
      const shader = getSwishShader(768);

      expect(shader).toContain('swish_main');
      expect(shader).toContain('output[idx] = x * (1.0 / (1.0 + exp(-x)))');
    });
  });

  describe('getSigmoidShader', () => {
    it('should generate sigmoid shader', () => {
      const shader = getSigmoidShader(768);

      expect(shader).toContain('sigmoid_main');
      expect(shader).toContain('output[idx] = 1.0 / (1.0 + exp(-input[idx]))');
    });
  });

  describe('getTanhShader', () => {
    it('should generate tanh shader', () => {
      const shader = getTanhShader(768);

      expect(shader).toContain('tanh_main');
      expect(shader).toContain('output[idx] = tanh(input[idx])');
    });
  });

  describe('getSoftmaxShader', () => {
    it('should generate softmax shader', () => {
      const shader = getSoftmaxShader(768, 10);

      expect(shader).toContain('softmax_main');
      expect(shader).toContain('var<workgroup> shared_max');
      expect(shader).toContain('var<workgroup> shared_sum');
      expect(shader).toContain('exp(-input[idx])');
    });
  });

  describe('getMaxPool2DShader', () => {
    it('should generate 2D max pooling shader', () => {
      const shader = getMaxPool2DShader([1, 56, 56, 64], [2, 2], [2, 2], [0, 0, 0, 0]);

      expect(shader).toContain('maxpool2d_main');
      expect(shader).toContain('var max_val: f32 = -1e9');
      expect(shader).toContain('max_val = max(max_val, input[in_idx])');
    });
  });

  describe('getAvgPool2DShader', () => {
    it('should generate 2D average pooling shader', () => {
      const shader = getAvgPool2DShader([1, 56, 56, 64], [2, 2], [2, 2], [0, 0, 0, 0]);

      expect(shader).toContain('avgpool2d_main');
      expect(shader).toContain('var sum: f32 = 0.0');
      expect(shader).toContain('sum = sum + input[in_idx]');
      expect(shader).toContain('sum / count');
    });
  });

  describe('getLayerNormShader', () => {
    it('should generate layer normalization shader', () => {
      const shader = getLayerNormShader([768], 1e-5);

      expect(shader).toContain('layer_norm_main');
      expect(shader).toContain('var<workgroup> shared_mean');
      expect(shader).toContain('var<workgroup> shared_var');
      expect(shader).toContain('gamma[elem_idx]');
      expect(shader).toContain('beta[elem_idx]');
      expect(shader).toContain('1e-5');
    });
  });

  describe('getActivationShader', () => {
    it('should return correct shader for activation', () => {
      const reluShader = getActivationShader('relu', 768);
      const geluShader = getActivationShader('gelu', 768);
      const swishShader = getActivationShader('swish', 768);

      expect(reluShader).toContain('relu_main');
      expect(geluShader).toContain('gelu_main');
      expect(swishShader).toContain('swish_main');
    });
  });

  describe('DEFAULT_NEURAL_SHADERS', () => {
    it('should have pre-configured 768-dim shaders', () => {
      expect(DEFAULT_NEURAL_SHADERS['relu-768']).toBeDefined();
      expect(DEFAULT_NEURAL_SHADERS['gelu-768']).toBeDefined();
      expect(DEFAULT_NEURAL_SHADERS['swish-768']).toBeDefined();
      expect(DEFAULT_NEURAL_SHADERS['softmax-768']).toBeDefined();
      expect(DEFAULT_NEURAL_SHADERS['layernorm-768']).toBeDefined();
    });
  });
});

describe('Shader Index', () => {
  describe('getShader', () => {
    it('should return matrix shader', () => {
      const shader = getShader('matrix', 'matmul', { M: 64, K: 64, N: 64 });
      expect(shader).toBeDefined();
    });

    it('should return vector shader', () => {
      const shader = getShader('vector', 'add', { size: 768 });
      expect(shader).toBeDefined();
    });

    it('should return reduction shader', () => {
      const shader = getShader('reduction', 'sum', { inputSize: 768 });
      expect(shader).toBeDefined();
    });

    it('should return embedding shader', () => {
      const shader = getShader('embedding', 'cosine-similarity', { embeddingDim: 768 });
      expect(shader).toBeDefined();
    });

    it('should return neural shader', () => {
      const shader = getShader('neural', 'relu', { size: 768 });
      expect(shader).toBeDefined();
    });

    it('should throw error for unknown category', () => {
      expect(() => getShader('unknown' as any, 'test', {})).toThrow();
    });
  });

  describe('SHADER_CATEGORIES', () => {
    it('should have all categories', () => {
      expect(SHADER_CATEGORIES).toContain('matrix');
      expect(SHADER_CATEGORIES).toContain('vector');
      expect(SHADER_CATEGORIES).toContain('reduction');
      expect(SHADER_CATEGORIES).toContain('embedding');
      expect(SHADER_CATEGORIES).toContain('neural');
    });
  });

  describe('MATRIX_OPERATIONS', () => {
    it('should have all matrix operations', () => {
      expect(MATRIX_OPERATIONS).toContain('matmul');
      expect(MATRIX_OPERATIONS).toContain('batch-matmul');
      expect(MATRIX_OPERATIONS).toContain('transpose');
      expect(MATRIX_OPERATIONS).toContain('add');
    });
  });

  describe('VECTOR_OPERATIONS', () => {
    it('should have all vector operations', () => {
      expect(VECTOR_OPERATIONS).toContain('add');
      expect(VECTOR_OPERATIONS).toContain('sub');
      expect(VECTOR_OPERATIONS).toContain('mul');
      expect(VECTOR_OPERATIONS).toContain('dot');
      expect(VECTOR_OPERATIONS).toContain('normalize');
      expect(VECTOR_OPERATIONS).toContain('similarity');
    });
  });

  describe('REDUCTION_OPERATIONS', () => {
    it('should have all reduction operations', () => {
      expect(REDUCTION_OPERATIONS).toContain('sum');
      expect(REDUCTION_OPERATIONS).toContain('min');
      expect(REDUCTION_OPERATIONS).toContain('max');
      expect(REDUCTION_OPERATIONS).toContain('argmin');
      expect(REDUCTION_OPERATIONS).toContain('argmax');
      expect(REDUCTION_OPERATIONS).toContain('mean');
    });
  });

  describe('EMBEDDING_OPERATIONS', () => {
    it('should have all embedding operations', () => {
      expect(EMBEDDING_OPERATIONS).toContain('cosine-similarity');
      expect(EMBEDDING_OPERATIONS).toContain('euclidean-distance');
      expect(EMBEDDING_OPERATIONS).toContain('normalize');
      expect(EMBEDDING_OPERATIONS).toContain('concat');
      expect(EMBEDDING_OPERATIONS).toContain('kmeans-assign');
      expect(EMBEDDING_OPERATIONS).toContain('similarity-matrix');
    });
  });

  describe('NEURAL_OPERATIONS', () => {
    it('should have all neural operations', () => {
      expect(NEURAL_OPERATIONS).toContain('relu');
      expect(NEURAL_OPERATIONS).toContain('gelu');
      expect(NEURAL_OPERATIONS).toContain('swish');
      expect(NEURAL_OPERATIONS).toContain('sigmoid');
      expect(NEURAL_OPERATIONS).toContain('tanh');
      expect(NEURAL_OPERATIONS).toContain('softmax');
      expect(NEURAL_OPERATIONS).toContain('maxpool2d');
      expect(NEURAL_OPERATIONS).toContain('avgpool2d');
      expect(NEURAL_OPERATIONS).toContain('layernorm');
      expect(NEURAL_OPERATIONS).toContain('dropout');
    });
  });
});

describe('Shader Code Quality', () => {
  it('should have balanced braces in all default shaders', () => {
    const checkBraces = (code: string) => {
      let count = 0;
      for (const char of code) {
        if (char === '{') count++;
        if (char === '}') count--;
      }
      return count === 0;
    };

    // Check matrix shaders
    Object.values(DEFAULT_MATMUL_SHADERS).forEach(shader => {
      expect(checkBraces(shader)).toBe(true);
    });

    // Check vector shaders
    Object.values(DEFAULT_VECTOR_SHADERS).forEach(shader => {
      expect(checkBraces(shader)).toBe(true);
    });

    // Check reduction shaders
    Object.values(DEFAULT_REDUCTION_SHADERS).forEach(shader => {
      expect(checkBraces(shader)).toBe(true);
    });

    // Check embedding shaders
    Object.values(DEFAULT_EMBEDDING_SHADERS).forEach(shader => {
      expect(checkBraces(shader)).toBe(true);
    });

    // Check neural shaders
    Object.values(DEFAULT_NEURAL_SHADERS).forEach(shader => {
      expect(checkBraces(shader)).toBe(true);
    });
  });

  it('should have workgroup_size attribute in all default shaders', () => {
    const checkWorkgroupSize = (code: string) => {
      return code.includes('@workgroup_size');
    };

    Object.values(DEFAULT_MATMUL_SHADERS).forEach(shader => {
      expect(checkWorkgroupSize(shader)).toBe(true);
    });

    Object.values(DEFAULT_VECTOR_SHADERS).forEach(shader => {
      expect(checkWorkgroupSize(shader)).toBe(true);
    });

    Object.values(DEFAULT_REDUCTION_SHADERS).forEach(shader => {
      expect(checkWorkgroupSize(shader)).toBe(true);
    });

    Object.values(DEFAULT_EMBEDDING_SHADERS).forEach(shader => {
      expect(checkWorkgroupSize(shader)).toBe(true);
    });

    Object.values(DEFAULT_NEURAL_SHADERS).forEach(shader => {
      expect(checkWorkgroupSize(shader)).toBe(true);
    });
  });
});

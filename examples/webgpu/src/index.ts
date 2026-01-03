/**
 * @lsi/webgpu-examples
 *
 * Comprehensive WebGPU browser examples demonstrating GPU capabilities.
 *
 * This package provides examples covering:
 * - Getting Started (01-04): Basic WebGPU setup and operations
 * - Core Operations (05-08): Matrix math, vectors, reductions, embeddings
 * - Advanced Operations (09-12): Neural networks, attention, sorting
 * - VL-JEPA Integration (13-16): Vision and language encoders, predictor
 * - Real-World Applications (17-20): Image processing, simulations, ML inference
 *
 * @example
 * import { helloWebGPU } from '@lsi/webgpu-examples/getting-started';
 * import { matrixMultiply } from '@lsi/webgpu-examples/core';
 * import { XEncoderGPU } from '@lsi/webgpu-examples/vljepa';
 *
 * // Basic usage
 * await helloWebGPU();
 *
 * // Matrix multiplication on GPU
 * const result = await matrixMultiply(a, b, m, k, n);
 *
 * // VL-JEPA encoding
 * const encoder = new XEncoderGPU();
 * await encoder.init();
 * const embedding = await encoder.encode(image, weights);
 */

// Export utilities
export * from './src/utils/index.js';

// Export getting started examples
export * from './src/getting-started/01-hello-webgpu.js';
export * from './src/getting-started/02-compute-shader.js';
export * from './src/getting-started/03-buffer-operations.js';
export * from './src/getting-started/04-pipeline-creation.js';

// Export core operations
export * from './src/core/05-matrix-multiplication.js';
export * from './src/core/06-vector-operations.js';
export * from './src/core/07-reduction-operations.js';
export * from './src/core/08-embedding-similarity.js';

// Export advanced operations
export * from './src/advanced/09-neural-network.js';
export * from './src/advanced/10-attention-mechanism.js';
export * from './src/advanced/11-parallel-reduction.js';
export * from './src/advanced/12-sort-algorithms.js';

// Export VL-JEPA integration
export * from './src/vljepa/13-x-encoder-gpu.js';
export * from './src/vljepa/14-y-encoder-gpu.js';
export * from './src/vljepa/15-predictor-gpu.js';
export * from './src/vljepa/16-full-vljepa.js';

// Export real-world applications
export * from './src/real-world/17-image-processing.js';
export * from './src/real-world/18-particle-simulation.js';
export * from './src/real-world/19-physics-simulation.js';
export * from './src/real-world/20-ml-inference.js';

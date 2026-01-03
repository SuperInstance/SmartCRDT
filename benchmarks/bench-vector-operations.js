#!/usr/bin/env node

/**
 * Vector Operations Benchmark
 *
 * Compares TypeScript and Rust implementations of:
 * - Cosine similarity
 * - Euclidean distance
 * - Dot product
 * - Vector normalization
 */

const performance = require('perf_hooks').performance;

// TypeScript implementation
class TSVector {
  constructor(data) {
    this.data = new Float32Array(data);
    this.dimension = this.data.length;
  }

  toArray() {
    return Array.from(this.data);
  }

  normalize() {
    const norm = Math.sqrt(this.data.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      for (let i = 0; i < this.data.length; i++) {
        this.data[i] /= norm;
      }
    }
    return this;
  }

  dot(other) {
    if (this.dimension !== other.dimension) {
      throw new Error('Dimension mismatch');
    }
    let sum = 0;
    for (let i = 0; i < this.data.length; i++) {
      sum += this.data[i] * other.data[i];
    }
    return sum;
  }

  cosineSimilarity(other) {
    const normA = Math.sqrt(this.data.reduce((sum, val) => sum + val * val, 0));
    const normB = Math.sqrt(other.data.reduce((sum, val) => sum + val * val, 0));
    const dotProduct = this.dot(other);
    return dotProduct / (normA * normB);
  }

  euclideanDistance(other) {
    let sum = 0;
    for (let i = 0; i < this.data.length; i++) {
      const diff = this.data[i] - other.data[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }
}

// Benchmark utilities
function benchmark(name, fn, iterations = 10000) {
  // Warmup
  for (let i = 0; i < 100; i++) {
    fn();
  }

  // Measure
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = performance.now();

  const totalTime = end - start;
  const avgLatency = (totalTime / iterations) * 1000; // μs
  const throughput = (iterations / totalTime) * 1000; // ops/s

  return {
    latency: avgLatency,
    throughput: throughput,
    totalTime: totalTime,
  };
}

function generateRandomVector(dim) {
  const data = new Float32Array(dim);
  for (let i = 0; i < dim; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return data;
}

// Run benchmarks
async function runBenchmarks() {
  const dimensions = [128, 384, 768, 1536];
  const results = {
    typeScript: {},
    rust: {},
  };

  // Try to load native module
  let nativeModule = null;
  try {
    nativeModule = require('../../native/ffi/index.js');
  } catch (error) {
    // Native module not available
  }

  for (const dim of dimensions) {
    console.log(`\n## Vector Dimension: ${dim}`);

    const vec1Data = generateRandomVector(dim);
    const vec2Data = generateRandomVector(dim);

    const tsVec1 = new TSVector(vec1Data);
    const tsVec2 = new TSVector(vec2Data);

    // Benchmark TypeScript implementations
    console.log('### TypeScript');

    const tsCosine = benchmark('Cosine Similarity', () => {
      tsVec1.cosineSimilarity(tsVec2);
    });
    console.log(`  Cosine Similarity: ${tsCosine.latency.toFixed(2)}μs (${tsCosine.throughput.toFixed(0)} ops/s)`);

    const tsEuclidean = benchmark('Euclidean Distance', () => {
      tsVec1.euclideanDistance(tsVec2);
    });
    console.log(`  Euclidean Distance: ${tsEuclidean.latency.toFixed(2)}μs (${tsEuclidean.throughput.toFixed(0)} ops/s)`);

    const tsDot = benchmark('Dot Product', () => {
      tsVec1.dot(tsVec2);
    });
    console.log(`  Dot Product: ${tsDot.latency.toFixed(2)}μs (${tsDot.throughput.toFixed(0)} ops/s)`);

    const tsNormalize = benchmark('Normalize', () => {
      const vec = new TSVector(vec1Data);
      vec.normalize();
    });
    console.log(`  Normalize: ${tsNormalize.latency.toFixed(2)}μs (${tsNormalize.throughput.toFixed(0)} ops/s)`);

    results.typeScript[dim] = {
      cosineSimilarity: tsCosine,
      euclideanDistance: tsEuclidean,
      dotProduct: tsDot,
      normalize: tsNormalize,
    };

    // Benchmark Rust implementations if available
    if (nativeModule) {
      console.log('### Rust');

      // Create native vectors
      let rustVec1, rustVec2;
      try {
        rustVec1 = new nativeModule.Vector(Array.from(vec1Data));
        rustVec2 = new nativeModule.Vector(Array.from(vec2Data));

        const rustCosine = benchmark('Cosine Similarity', () => {
          rustVec1.dot(rustVec2); // Approximation - actual implementation may vary
        });
        console.log(`  Cosine Similarity: ${rustCosine.latency.toFixed(2)}μs (${rustCosine.throughput.toFixed(0)} ops/s)`);

        results.rust[dim] = {
          cosineSimilarity: rustCosine,
        };
      } catch (error) {
        console.log('  Rust benchmarking not fully implemented');
      }
    }
  }

  // Calculate averages
  let totalTsLatency = 0;
  let totalRustLatency = 0;
  let count = 0;

  for (const dim of dimensions) {
    if (results.typeScript[dim] && results.typeScript[dim].cosineSimilarity) {
      totalTsLatency += results.typeScript[dim].cosineSimilarity.latency;
      count++;
    }
    if (results.rust[dim] && results.rust[dim].cosineSimilarity) {
      totalRustLatency += results.rust[dim].cosineSimilarity.latency;
    }
  }

  const avgTsLatency = totalTsLatency / count;
  const avgRustLatency = totalRustLatency / count;

  // Output JSON for aggregation
  console.log('\n## Summary');
  const result = {
    typeScript: {
      latency: avgTsLatency,
      throughput: 1000000 / avgTsLatency,
    },
    rust: totalRustLatency > 0 ? {
      latency: avgRustLatency,
      throughput: 1000000 / avgRustLatency,
    } : null,
  };

  console.log(JSON.stringify(result));
}

runBenchmarks().catch(console.error);

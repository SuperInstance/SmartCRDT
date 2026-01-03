/**
 * HNSW Distance Calculation Benchmark
 *
 * Compares TypeScript vs Rust performance for HNSW distance calculations.
 *
 * Run with:
 *   npx tsx benchmarks/hnsw_benchmark.ts
 */

import { performance } from 'perf_hooks';

// TypeScript implementation (from HNSWIndex.ts)
function cosineDistanceTS(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return Infinity;

  const len = a.length;
  const simdWidth = 4;
  const remainder = len % simdWidth;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  // Process 4 elements at a time (SIMD-style)
  const limit = len - remainder;
  for (let i = 0; i < limit; i += simdWidth) {
    // Unrolled loop for better pipelining
    const a0 = a[i], b0 = b[i];
    const a1 = a[i + 1], b1 = b[i + 1];
    const a2 = a[i + 2], b2 = b[i + 2];
    const a3 = a[i + 3], b3 = b[i + 3];

    dotProduct += a0 * b0 + a1 * b1 + a2 * b2 + a3 * b3;
    normA += a0 * a0 + a1 * a1 + a2 * a2 + a3 * a3;
    normB += b0 * b0 + b1 * b1 + b2 * b2 + b3 * b3;
  }

  // Handle remaining elements
  for (let i = limit; i < len; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    if (normA === 0 && normB === 0) return 0;
    return 2;
  }

  const similarity = dotProduct / denominator;
  return 1 - similarity;
}

function euclideanDistanceTS(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return Infinity;

  const len = a.length;
  const simdWidth = 4;
  const remainder = len % simdWidth;

  let sumSq = 0;

  // Process 4 elements at a time
  const limit = len - remainder;
  for (let i = 0; i < limit; i += simdWidth) {
    const a0 = a[i], b0 = b[i];
    const a1 = a[i + 1], b1 = b[i + 1];
    const a2 = a[i + 2], b2 = b[i + 2];
    const a3 = a[i + 3], b3 = b[i + 3];

    const diff0 = a0 - b0;
    const diff1 = a1 - b1;
    const diff2 = a2 - b2;
    const diff3 = a3 - b3;

    sumSq += diff0 * diff0 + diff1 * diff1 + diff2 * diff2 + diff3 * diff3;
  }

  // Handle remaining elements
  for (let i = limit; i < len; i++) {
    const diff = a[i] - b[i];
    sumSq += diff * diff;
  }

  return Math.sqrt(sumSq);
}

function dotProductTS(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;

  const len = a.length;
  const simdWidth = 4;
  const remainder = len % simdWidth;

  let dot = 0;

  // Process 4 elements at a time
  const limit = len - remainder;
  for (let i = 0; i < limit; i += simdWidth) {
    dot += a[i] * b[i] + a[i + 1] * b[i + 1] + a[i + 2] * b[i + 2] + a[i + 3] * b[i + 3];
  }

  // Handle remaining elements
  for (let i = limit; i < len; i++) {
    dot += a[i] * b[i];
  }

  return dot;
}

// Rust implementation (via FFI)
let rustImpl: {
  cosineSimilaritySIMD: (a: number[], b: number[]) => number;
  euclideanDistanceSIMD: (a: number[], b: number[]) => number;
  dotProductSIMD: (a: number[], b: number[]) => number;
} | null = null;

let rustAvailable = false;

async function loadRustImpl() {
  try {
    // Try to load the native module
    const nativePath = '../native/ffi';
    const native = await import(nativePath);
    rustImpl = {
      cosineSimilaritySIMD: native.cosine_similarity_simd,
      euclideanDistanceSIMD: native.euclidean_distance_simd_ffi,
      dotProductSIMD: native.dot_product_simd_ffi,
    };
    rustAvailable = true;
    console.log('✓ Rust implementation loaded');
  } catch (e) {
    console.log('✗ Rust implementation not available (this is OK for benchmarking TypeScript)');
    rustAvailable = false;
  }
}

// Benchmark utilities
function benchmark(name: string, fn: () => void, iterations: number = 10000) {
  // Warm-up
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
  const avgTime = (totalTime / iterations) * 1000; // microseconds
  const opsPerSecond = (iterations / totalTime) * 1000;

  return {
    name,
    totalTime,
    avgTime,
    opsPerSecond,
  };
}

interface BenchmarkResult {
  name: string;
  totalTime: number;
  avgTime: number;
  opsPerSecond: number;
}

function printResult(result: BenchmarkResult) {
  console.log(`  ${result.name}:`);
  console.log(`    Total time: ${result.totalTime.toFixed(2)} ms`);
  console.log(`    Avg time: ${result.avgTime.toFixed(2)} μs/op`);
  console.log(`    Ops/sec: ${result.opsPerSecond.toFixed(0)}`);
}

function compareResults(tsResult: BenchmarkResult, rustResult?: BenchmarkResult) {
  if (!rustResult) {
    printResult(tsResult);
    return;
  }

  const speedup = tsResult.avgTime / rustResult.avgTime;
  const improvement = ((tsResult.avgTime - rustResult.avgTime) / tsResult.avgTime) * 100;

  console.log(`  TypeScript:`);
  console.log(`    Avg time: ${tsResult.avgTime.toFixed(2)} μs/op`);
  console.log(`    Ops/sec: ${tsResult.opsPerSecond.toFixed(0)}`);

  console.log(`  Rust:`);
  console.log(`    Avg time: ${rustResult.avgTime.toFixed(2)} μs/op`);
  console.log(`    Ops/sec: ${rustResult.opsPerSecond.toFixed(0)}`);

  console.log(`  Speedup: ${speedup.toFixed(2)}x (${improvement.toFixed(1)}% faster)`);
}

// Generate test vectors
function generateVector(dim: number, seed: number = 0): Float32Array {
  const vec = new Float32Array(dim);
  for (let i = 0; i < dim; i++) {
    vec[i] = Math.sin(seed + i * 0.1) * 10;
  }
  return vec;
}

// Main benchmark
async function main() {
  console.log('HNSW Distance Calculation Benchmark');
  console.log('=====================================\n');

  // Load Rust implementation
  await loadRustImpl();
  console.log('');

  const dimensions = [128, 384, 768, 1536];
  const iterations = 10000;

  for (const dim of dimensions) {
    console.log(`\n=== Dimension: ${dim} ===`);

    const a = generateVector(dim, 0);
    const b = generateVector(dim, 42);

    // Benchmark Cosine Distance
    console.log(`\nCosine Distance:`);
    const tsCosine = benchmark('TypeScript', () => cosineDistanceTS(a, b), iterations);
    let rustCosine: BenchmarkResult | undefined;

    if (rustAvailable && rustImpl) {
      rustCosine = benchmark('Rust', () => {
        const aArr = Array.from(a);
        const bArr = Array.from(b);
        rustImpl!.cosineSimilaritySIMD(aArr, bArr);
      }, iterations);
    }

    compareResults(tsCosine, rustCosine);

    // Benchmark Euclidean Distance
    console.log(`\nEuclidean Distance:`);
    const tsEuclidean = benchmark('TypeScript', () => euclideanDistanceTS(a, b), iterations);
    let rustEuclidean: BenchmarkResult | undefined;

    if (rustAvailable && rustImpl) {
      rustEuclidean = benchmark('Rust', () => {
        const aArr = Array.from(a);
        const bArr = Array.from(b);
        rustImpl!.euclideanDistanceSIMD(aArr, bArr);
      }, iterations);
    }

    compareResults(tsEuclidean, rustEuclidean);

    // Benchmark Dot Product
    console.log(`\nDot Product:`);
    const tsDot = benchmark('TypeScript', () => dotProductTS(a, b), iterations);
    let rustDot: BenchmarkResult | undefined;

    if (rustAvailable && rustImpl) {
      rustDot = benchmark('Rust', () => {
        const aArr = Array.from(a);
        const bArr = Array.from(b);
        rustImpl!.dotProductSIMD(aArr, bArr);
      }, iterations);
    }

    compareResults(tsDot, rustDot);
  }

  // Correctness check
  console.log('\n\n=== Correctness Check ===\n');

  const testA = new Float32Array([1.0, 0.0, 0.0]);
  const testB = new Float32Array([0.0, 1.0, 0.0]);

  const tsCos = cosineDistanceTS(testA, testB);
  const tsEuc = euclideanDistanceTS(testA, testB);
  const tsDot = dotProductTS(testA, testB);

  console.log('TypeScript results:');
  console.log(`  Cosine distance (orthogonal): ${tsCos.toFixed(6)} (expected: 1.0)`);
  console.log(`  Euclidean distance: ${tsEuc.toFixed(6)} (expected: 1.414)`);
  console.log(`  Dot product: ${tsDot.toFixed(6)} (expected: 0.0)`);

  if (rustAvailable && rustImpl) {
    const rustCos = 1 - rustImpl.cosineSimilaritySIMD(Array.from(testA), Array.from(testB));
    const rustEuc = rustImpl.euclideanDistanceSIMD(Array.from(testA), Array.from(testB));
    const rustDotResult = rustImpl.dotProductSIMD(Array.from(testA), Array.from(testB));

    console.log('\nRust results:');
    console.log(`  Cosine distance (orthogonal): ${rustCos.toFixed(6)} (expected: 1.0)`);
    console.log(`  Euclidean distance: ${rustEuc.toFixed(6)} (expected: 1.414)`);
    console.log(`  Dot product: ${rustDotResult.toFixed(6)} (expected: 0.0)`);

    console.log('\nDifferences:');
    console.log(`  Cosine: ${Math.abs(tsCos - rustCos).toExponential(2)}`);
    console.log(`  Euclidean: ${Math.abs(tsEuc - rustEuc).toExponential(2)}`);
    console.log(`  Dot: ${Math.abs(tsDot - rustDotResult).toExponential(2)}`);

    const maxDiff = Math.max(
      Math.abs(tsCos - rustCos),
      Math.abs(tsEuc - rustEuc),
      Math.abs(tsDot - rustDotResult)
    );

    if (maxDiff < 1e-5) {
      console.log('\n✓ All results match within tolerance');
    } else {
      console.log('\n✗ WARNING: Results differ beyond tolerance');
    }
  }

  console.log('\n=== Benchmark Complete ===');
}

main().catch(console.error);

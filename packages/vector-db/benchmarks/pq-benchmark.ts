/**
 * PQ Benchmark Runner
 *
 * Standalone benchmark script for testing PQ performance.
 */

import {
  ProductQuantization,
  OptimizedProductQuantization,
  QuantizationBenchmark,
} from "../src/quantization/index.js";

/**
 * Generate synthetic embedding vectors
 */
function generateEmbeddings(count: number, dimension: number): Float32Array[] {
  const vectors: Float32Array[] = [];

  for (let i = 0; i < count; i++) {
    const v = new Float32Array(dimension);

    // Generate more realistic embeddings (not pure random)
    // Create clusters for better testing
    const cluster = Math.floor(Math.random() * 10);
    const offset = (cluster / 10) * 2 - 1;

    for (let j = 0; j < dimension; j++) {
      v[j] = offset + (Math.random() * 0.2 - 0.1);
      // Normalize
      v[j] = v[j] / Math.sqrt(dimension);
    }

    vectors.push(v);
  }

  return vectors;
}

/**
 * Run comprehensive benchmark
 */
async function runBenchmark() {
  console.log("=".repeat(70));
  console.log("PRODUCT QUANTIZATION BENCHMARK");
  console.log("=".repeat(70));

  const configs = [
    { name: "OpenAI small-1536", dimension: 1536, numSubspaces: 64 },
    { name: "OpenAI large-3072", dimension: 3072, numSubspaces: 128 },
    { name: "Ollama nomic-768", dimension: 768, numSubspaces: 32 },
  ];

  for (const config of configs) {
    console.log(`\n${"-".repeat(70)}`);
    console.log(`Testing: ${config.name}`);
    console.log(`Dimension: ${config.dimension}, Subspaces: ${config.numSubspaces}`);
    console.log(`-`.repeat(70));

    const vectors = generateEmbeddings(10000, config.dimension);
    const queries = generateEmbeddings(100, config.dimension);

    const benchmark = new QuantizationBenchmark({
      numVectors: vectors.length,
      numQueries: queries.length,
      k: 10,
      dimensions: [config.dimension],
      numSubspaces: [config.numSubspaces],
      numCentroids: [256],
      testOPQ: true,
      measureRecall: true,
    });

    const results = await benchmark.run(vectors, queries);

    printResults(config.name, results);
  }

  console.log("\n" + "=".repeat(70));
  console.log("BENCHMARK COMPLETE");
  console.log("=".repeat(70));
}

/**
 * Print benchmark results
 */
function printResults(name: string, results: any): void {
  console.log(`\nResults for ${name}:`);
  console.log(`  Dataset:`);
  console.log(`    Vectors: ${results.dataset.numVectors.toLocaleString()}`);
  console.log(`    Queries: ${results.dataset.numQueries}`);
  console.log(`    Dimension: ${results.dataset.dimension}`);
  console.log(`\n  Compression:`);
  console.log(`    Original: ${(results.compression.originalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`    Compressed: ${(results.compression.compressedSize / 1024).toFixed(2)} KB`);
  console.log(`    Ratio: ${results.compression.ratio.toFixed(1)}x`);
  console.log(`    Memory Saved: ${(results.compression.memorySaved / 1024 / 1024).toFixed(2)} MB`);
  console.log(`\n  Accuracy:`);
  console.log(`    Recall@10: ${(results.accuracy.recall * 100).toFixed(1)}%`);
  console.log(`    Quantization Error: ${results.accuracy.quantizationError.toExponential(4)}`);
  console.log(`    SQNR: ${results.accuracy.sqnr.toFixed(2)} dB`);
  console.log(`\n  Performance:`);
  console.log(`    Training Time: ${results.performance.trainingTime}ms`);
  console.log(`    Encoding Time: ${results.performance.encodingTime}ms`);
  console.log(`    Query Time: ${results.performance.queryTime.toFixed(2)}ms`);
  console.log(`    Throughput: ${results.performance.throughput.toFixed(0)} vectors/sec`);
  console.log(`\n  Baseline Comparison:`);
  console.log(`    Exact Search Time: ${results.baseline.baselineTime.toFixed(2)}ms`);
  console.log(`    Speedup: ${results.baseline.speedup.toFixed(2)}x`);
  console.log(`    Accuracy Retention: ${(results.baseline.accuracyRetention * 100).toFixed(1)}%`);

  if (results.comparison) {
    console.log(`\n  OPQ vs PQ:`);
    console.log(`    PQ Error: ${results.comparison.pqError.toExponential(4)}`);
    console.log(`    OPQ Error: ${results.comparison.opqError.toExponential(4)}`);
    console.log(`    Improvement: ${(results.comparison.improvement * 100).toFixed(1)}%`);
  }
}

/**
 * Quick test with smaller dataset
 */
async function runQuickTest() {
  console.log("Running quick test...");

  const dimension = 768;
  const vectors = generateEmbeddings(1000, dimension);
  const queries = generateEmbeddings(10, dimension);

  const benchmark = new QuantizationBenchmark({
    numVectors: vectors.length,
    numQueries: queries.length,
    k: 5,
    dimensions: [dimension],
    numSubspaces: [32],
    numCentroids: [256],
    testOPQ: false,
    measureRecall: true,
  });

  const results = await benchmark.runQuick(vectors, queries);
  printResults("Quick Test (768-dim)", results);
}

// Main entry point
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--quick")) {
    await runQuickTest();
  } else if (args.includes("--help")) {
    console.log("Usage:");
    console.log("  --quick    Run quick test (1K vectors)");
    console.log("  --full     Run full benchmark (10K vectors per config)");
    console.log("  --help     Show this message");
  } else {
    await runBenchmark();
  }
}

main().catch(console.error);

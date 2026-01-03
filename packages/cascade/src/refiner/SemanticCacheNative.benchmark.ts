/**
 * SemanticCacheNative Benchmark
 *
 * Benchmarks to measure the performance improvement of native Rust implementation
 * over the TypeScript implementation.
 *
 * Expected results:
 * - 4-6x speedup on similarity search
 * - 80% reduction in cache miss latency
 * - Sub-millisecond lookups for caches up to 10K entries
 */

import { SemanticCacheNative } from "./SemanticCacheNative.js";
import type { RefinedQuery } from "../types.js";

/**
 * Benchmark configuration
 */
interface BenchmarkConfig {
  numEntries: number;
  embeddingDim: number;
  numQueries: number;
  warmupRuns: number;
}

/**
 * Benchmark result
 */
interface BenchmarkResult {
  name: string;
  avgTimeMs: number;
  minTimeMs: number;
  maxTimeMs: number;
  opsPerSecond: number;
  totalTimeMs: number;
}

/**
 * Generate random embedding vector
 */
function generateEmbedding(dim: number): number[] {
  return Array.from({ length: dim }, () => Math.random() * 2 - 1);
}

/**
 * Normalize vector to unit length
 */
function normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return vec.map((v) => v / norm);
}

/**
 * Calculate cosine similarity (TypeScript implementation)
 */
function cosineSimilarityTS(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator > 0 ? dotProduct / denominator : 0;
}

/**
 * Warm up the cache with entries
 */
async function warmupCache(
  cache: SemanticCacheNative,
  numEntries: number,
  embeddingDim: number
): Promise<void> {
  for (let i = 0; i < numEntries; i++) {
    const embedding = normalize(generateEmbedding(embeddingDim));

    const query: RefinedQuery = {
      original: `Query ${i}`,
      normalized: `query ${i}`,
      cacheKey: `key_${i}`,
      timestamp: Date.now(),
      suggestions: [],
      staticFeatures: {
        length: 7,
        wordCount: 2,
        queryType: "question",
        complexity: 0.5,
        hasCode: false,
        hasSQL: false,
        hasUrl: false,
        hasEmail: false,
        questionMark: false,
        exclamationCount: 0,
        ellipsisCount: 0,
        capitalizationRatio: 0.0,
        punctuationDensity: 0.0,
        technicalTerms: [],
        domainKeywords: [],
      },
      semanticFeatures: {
        embedding,
        embeddingDim: embedding.length,
        similarQueries: [],
        cluster: null,
        semanticComplexity: 0.5,
      },
    };

    await cache.set(query, { result: i, data: `Result ${i}` });
  }
}

/**
 * Benchmark native cache similarity search
 */
async function benchmarkNativeSimilaritySearch(
  config: BenchmarkConfig
): Promise<BenchmarkResult> {
  const cache = new SemanticCacheNative({
    max_size: config.numEntries * 2, // Prevent eviction
    similarity_threshold: 0.7,
    ttl_ms: 0, // No expiration
    num_threads: 0, // Auto-detect
  });

  // Warmup
  await warmupCache(cache, config.numEntries, config.embeddingDim);

  // Benchmark
  const times: number[] = [];
  const queryEmbedding = normalize(generateEmbedding(config.embeddingDim));

  for (let i = 0; i < config.warmupRuns + config.numQueries; i++) {
    const start = performance.now();

    await cache.findSimilar(queryEmbedding, 0.7);

    const end = performance.now();
    const elapsed = end - start;

    if (i >= config.warmupRuns) {
      times.push(elapsed);
    }
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const totalTime = times.reduce((a, b) => a + b, 0);

  return {
    name: "Native Similarity Search",
    avgTimeMs: avgTime,
    minTimeMs: minTime,
    maxTimeMs: maxTime,
    opsPerSecond: 1000 / avgTime,
    totalTimeMs: totalTime,
  };
}

/**
 * Benchmark TypeScript similarity search
 */
async function benchmarkTypeScriptSimilaritySearch(
  config: BenchmarkConfig
): Promise<BenchmarkResult> {
  // Create cache entries
  const entries: Array<{ key: string; embedding: number[] }> = [];
  for (let i = 0; i < config.numEntries; i++) {
    entries.push({
      key: `key_${i}`,
      embedding: normalize(generateEmbedding(config.embeddingDim)),
    });
  }

  // Benchmark
  const times: number[] = [];
  const queryEmbedding = normalize(generateEmbedding(config.embeddingDim));

  for (let i = 0; i < config.warmupRuns + config.numQueries; i++) {
    const start = performance.now();

    // Linear scan with cosine similarity
    const results: Array<{ key: string; similarity: number }> = [];
    for (const entry of entries) {
      const similarity = cosineSimilarityTS(queryEmbedding, entry.embedding);
      if (similarity >= 0.7) {
        results.push({ key: entry.key, similarity });
      }
    }
    results.sort((a, b) => b.similarity - a.similarity);

    const end = performance.now();
    const elapsed = end - start;

    if (i >= config.warmupRuns) {
      times.push(elapsed);
    }
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const totalTime = times.reduce((a, b) => a + b, 0);

  return {
    name: "TypeScript Similarity Search",
    avgTimeMs: avgTime,
    minTimeMs: minTime,
    maxTimeMs: maxTime,
    opsPerSecond: 1000 / avgTime,
    totalTimeMs: totalTime,
  };
}

/**
 * Run all benchmarks
 */
export async function runBenchmarks(
  config: BenchmarkConfig = {
    numEntries: 1000,
    embeddingDim: 768,
    numQueries: 100,
    warmupRuns: 10,
  }
): Promise<{
  native: BenchmarkResult;
  typescript: BenchmarkResult;
  speedup: number;
  summary: string;
}> {
  console.log("\n=== SemanticCacheNative Benchmark ===");
  console.log(`Configuration:`);
  console.log(`  - Cache entries: ${config.numEntries}`);
  console.log(`  - Embedding dimension: ${config.embeddingDim}`);
  console.log(`  - Queries: ${config.numQueries}`);
  console.log(`  - Warmup runs: ${config.warmupRuns}\n`);

  // Check if native is available
  const isNativeAvailable = new SemanticCacheNative().isUsingNative();
  if (!isNativeAvailable) {
    console.warn("⚠️  Native module not available. Only benchmarking TypeScript.");
  }

  // Benchmark TypeScript
  console.log("Benchmarking TypeScript implementation...");
  const tsResult = await benchmarkTypeScriptSimilaritySearch(config);
  console.log(`  ✓ Average: ${tsResult.avgTimeMs.toFixed(3)}ms`);
  console.log(`  ✓ Min: ${tsResult.minTimeMs.toFixed(3)}ms`);
  console.log(`  ✓ Max: ${tsResult.maxTimeMs.toFixed(3)}ms`);
  console.log(`  ✓ Ops/sec: ${tsResult.opsPerSecond.toFixed(0)}\n`);

  let nativeResult: BenchmarkResult | null = null;
  let speedup = 1.0;

  if (isNativeAvailable) {
    // Benchmark Native
    console.log("Benchmarking Native implementation...");
    nativeResult = await benchmarkNativeSimilaritySearch(config);
    console.log(`  ✓ Average: ${nativeResult.avgTimeMs.toFixed(3)}ms`);
    console.log(`  ✓ Min: ${nativeResult.minTimeMs.toFixed(3)}ms`);
    console.log(`  ✓ Max: ${nativeResult.maxTimeMs.toFixed(3)}ms`);
    console.log(`  ✓ Ops/sec: ${nativeResult.opsPerSecond.toFixed(0)}\n`);

    // Calculate speedup
    speedup = tsResult.avgTimeMs / nativeResult.avgTimeMs;
  }

  // Summary
  console.log("=== Results ===");
  if (nativeResult) {
    console.log(`Speedup: ${speedup.toFixed(2)}x`);
    console.log(
      `Cache miss latency reduction: ${((1 - 1 / speedup) * 100).toFixed(0)}%`
    );
  }
  console.log();

  const summary = `
SemanticCacheNative Benchmark Results
====================================

Configuration:
- Cache entries: ${config.numEntries}
- Embedding dimension: ${config.embeddingDim}
- Queries: ${config.numQueries}

TypeScript Implementation:
- Average time: ${tsResult.avgTimeMs.toFixed(3)}ms
- Min time: ${tsResult.minTimeMs.toFixed(3)}ms
- Max time: ${tsResult.maxTimeMs.toFixed(3)}ms
- Operations/sec: ${tsResult.opsPerSecond.toFixed(0)}
${
  nativeResult
    ? `
Native Implementation:
- Average time: ${nativeResult.avgTimeMs.toFixed(3)}ms
- Min time: ${nativeResult.minTimeMs.toFixed(3)}ms
- Max time: ${nativeResult.maxTimeMs.toFixed(3)}ms
- Operations/sec: ${nativeResult.opsPerSecond.toFixed(0)}

Performance Improvement:
- Speedup: ${speedup.toFixed(2)}x
- Cache miss latency reduction: ${((1 - 1 / speedup) * 100).toFixed(0)}%
`
    : `
Native Implementation:
- Not available (build with: npm run build:native:release)
`
}

Expected Results:
- Speedup: 4-6x
- Cache miss latency: 10ms → 2ms (80% reduction)
- Sub-millisecond lookups for caches up to 10K entries
`;

  console.log(summary);

  return {
    native: nativeResult || tsResult,
    typescript: tsResult,
    speedup,
    summary,
  };
}

/**
 * Run quick benchmark for CI/CD
 */
export async function runQuickBenchmark(): Promise<number> {
  const config: BenchmarkConfig = {
    numEntries: 100,
    embeddingDim: 768,
    numQueries: 10,
    warmupRuns: 3,
  };

  const results = await runBenchmarks(config);
  return results.speedup;
}

// Run benchmarks if executed directly
if (import.meta.url === new URL(process.argv[1], "file://").href) {
  runBenchmarks()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Benchmark failed:", error);
      process.exit(1);
    });
}

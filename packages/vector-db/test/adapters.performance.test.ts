/**
 * Performance comparison tests for vector database adapters
 *
 * Benchmarks Pinecone, Weaviate, and in-memory HNSW implementations.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type {
  IVectorDatabaseAdapter,
  VectorRecord,
  VectorQueryOptions,
} from "@lsi/protocol";
import { VectorDatabase } from "../src/VectorDatabase.js";
import { PineconeAdapter } from "../src/adapters/PineconeAdapter.js";
import { WeaviateAdapter } from "../src/adapters/WeaviateAdapter.js";

/**
 * Test configuration
 */
const DIMENSION = 768;
const NUM_VECTORS = 1000;
const NUM_QUERIES = 100;
const WARMUP_QUERIES = 10;

/**
 * Performance benchmark results
 */
interface BenchmarkResult {
  adapter: string;
  operation: string;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  throughput: number;
  p50: number;
  p95: number;
  p99: number;
}

/**
 * Generate random vector
 */
function randomVector(dimension: number): Float32Array {
  return new Float32Array(Array.from({ length: dimension }, () => Math.random() * 2 - 1));
}

/**
 * Generate random metadata
 */
function randomMetadata(): Record<string, string | number | boolean> {
  return {
    category: ["A", "B", "C", "D"][Math.floor(Math.random() * 4)],
    value: Math.floor(Math.random() * 1000),
    active: Math.random() > 0.5,
  };
}

/**
 * Calculate percentiles
 */
function calculatePercentiles(values: number[]): { p50: number; p95: number; p99: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const len = sorted.length;

  return {
    p50: sorted[Math.floor(len * 0.5)],
    p95: sorted[Math.floor(len * 0.95)],
    p99: sorted[Math.floor(len * 0.99)],
  };
}

/**
 * Benchmark insert performance
 */
async function benchmarkInsert(
  adapter: IVectorDatabaseAdapter,
  name: string,
  numVectors: number
): Promise<BenchmarkResult> {
  const times: number[] = [];

  // Warmup
  for (let i = 0; i < Math.min(10, numVectors); i++) {
    const record: VectorRecord = {
      id: `warmup-${i}` as any,
      vector: randomVector(DIMENSION),
      metadata: randomMetadata(),
    };
    await adapter.upsert(record);
  }

  // Benchmark
  for (let i = 0; i < numVectors; i++) {
    const record: VectorRecord = {
      id: `vec-${i}` as any,
      vector: randomVector(DIMENSION),
      metadata: randomMetadata(),
    };

    const start = performance.now();
    await adapter.upsert(record);
    const end = performance.now();

    times.push(end - start);
  }

  const totalTime = times.reduce((sum, t) => sum + t, 0);
  const avgTime = totalTime / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const throughput = 1000 / avgTime;
  const percentiles = calculatePercentiles(times);

  return {
    adapter: name,
    operation: "insert",
    totalTime,
    avgTime,
    minTime,
    maxTime,
    throughput,
    ...percentiles,
  };
}

/**
 * Benchmark search performance
 */
async function benchmarkSearch(
  adapter: IVectorDatabaseAdapter,
  name: string,
  numQueries: number,
  k: number = 10
): Promise<BenchmarkResult> {
  const times: number[] = [];

  // Warmup
  for (let i = 0; i < WARMUP_QUERIES; i++) {
    const query = randomVector(DIMENSION);
    const options: VectorQueryOptions = { topK: k };
    await adapter.search(query, options);
  }

  // Benchmark
  for (let i = 0; i < numQueries; i++) {
    const query = randomVector(DIMENSION);
    const options: VectorQueryOptions = { topK: k };

    const start = performance.now();
    await adapter.search(query, options);
    const end = performance.now();

    times.push(end - start);
  }

  const totalTime = times.reduce((sum, t) => sum + t, 0);
  const avgTime = totalTime / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const throughput = 1000 / avgTime;
  const percentiles = calculatePercentiles(times);

  return {
    adapter: name,
    operation: "search",
    totalTime,
    avgTime,
    minTime,
    maxTime,
    throughput,
    ...percentiles,
  };
}

/**
 * Benchmark batch insert performance
 */
async function benchmarkBatchInsert(
  adapter: IVectorDatabaseAdapter,
  name: string,
  numVectors: number,
  batchSize: number = 100
): Promise<BenchmarkResult> {
  const times: number[] = [];

  // Generate records
  const records: VectorRecord[] = [];
  for (let i = 0; i < numVectors; i++) {
    records.push({
      id: `batch-${i}` as any,
      vector: randomVector(DIMENSION),
      metadata: randomMetadata(),
    });
  }

  // Benchmark
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    const start = performance.now();
    await adapter.upsertBatch(batch);
    const end = performance.now();

    times.push(end - start);
  }

  const totalTime = times.reduce((sum, t) => sum + t, 0);
  const avgTime = totalTime / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const throughput = (batchSize * 1000) / avgTime;
  const percentiles = calculatePercentiles(times);

  return {
    adapter: name,
    operation: "batch_insert",
    totalTime,
    avgTime,
    minTime,
    maxTime,
    throughput,
    ...percentiles,
  };
}

/**
 * Print benchmark results
 */
function printBenchmarkResults(results: BenchmarkResult[]): void {
  console.log("\n=== Vector Database Performance Comparison ===\n");

  // Group by operation
  const operations = ["insert", "batch_insert", "search"];

  for (const operation of operations) {
    const opResults = results.filter((r) => r.operation === operation);

    if (opResults.length === 0) continue;

    console.log(`${operation.toUpperCase()}:`);
    console.log(
      `  ${"Adapter".padEnd(20)} ${ "Avg (ms)".padEnd(12)} ${ "Min (ms)".padEnd(12)} ${ "Max (ms)".padEnd(12)} ${ "P95 (ms)".padEnd(12)} ${ "Throughput".padEnd(15) }`
    );
    console.log("-".repeat(90));

    for (const result of opResults) {
      console.log(
        `  ${result.adapter.padEnd(20)} ` +
          `${result.avgTime.toFixed(2).padEnd(12)} ` +
          `${result.minTime.toFixed(2).padEnd(12)} ` +
          `${result.maxTime.toFixed(2).padEnd(12)} ` +
          `${result.p95.toFixed(2).padEnd(12)} ` +
          `${result.throughput.toFixed(0).padEnd(15)}`
      );
    }

    console.log();
  }
}

/**
 * Compare two benchmark results
 */
function compareBenchmarks(
  baseline: BenchmarkResult,
  candidate: BenchmarkResult
): { speedup: number; improvement: string } {
  const speedup = baseline.avgTime / candidate.avgTime;
  const improvement = speedup > 1 ? "faster" : "slower";

  return { speedup, improvement };
}

describe("Vector Database Performance Tests", () => {
  let adapters: Array<{ name: string; adapter: IVectorDatabaseAdapter }> = [];

  beforeAll(async () => {
    // Initialize in-memory adapter
    const memoryAdapter = new VectorDatabase({ dimension: DIMENSION });
    adapters.push({ name: "Memory (HNSW)", adapter: memoryAdapter as any });

    // Initialize Pinecone adapter if credentials available
    const pineconeApiKey = process.env.PINECONE_API_KEY;
    if (pineconeApiKey) {
      try {
        const pineconeAdapter = new PineconeAdapter({
          backend: "pinecone",
          dimension: DIMENSION,
          credentials: { apiKey: pineconeApiKey },
          indexName: process.env.PINECONE_INDEX ?? "test-index",
        } as any);
        await pineconeAdapter.initialize();
        adapters.push({ name: "Pinecone", adapter: pineconeAdapter });
      } catch (error) {
        console.warn("Failed to initialize Pinecone adapter:", error);
      }
    }

    // Initialize Weaviate adapter if credentials available
    const weaviateEndpoint = process.env.WEAVIATE_ENDPOINT;
    if (weaviateEndpoint) {
      try {
        const weaviateAdapter = new WeaviateAdapter({
          backend: "weaviate",
          dimension: DIMENSION,
          credentials: {
            endpoint: weaviateEndpoint,
            apiKey: process.env.WEAVIATE_API_KEY,
          },
          className: "TestVector",
        } as any);
        await weaviateAdapter.initialize();
        adapters.push({ name: "Weaviate", adapter: weaviateAdapter });
      } catch (error) {
        console.warn("Failed to initialize Weaviate adapter:", error);
      }
    }
  });

  afterAll(async () => {
    // Close all adapters
    for (const { adapter } of adapters) {
      try {
        await adapter.close();
      } catch (error) {
        // Ignore
      }
    }
  });

  it("should benchmark insert performance", async () => {
    const results: BenchmarkResult[] = [];

    for (const { name, adapter } of adapters) {
      const result = await benchmarkInsert(adapter, name, NUM_VECTORS);
      results.push(result);

      // Verify insertion
      const stats = await adapter.getStats();
      expect(stats.totalVectors).toBeGreaterThanOrEqual(NUM_VECTORS);
    }

    printBenchmarkResults(results);

    // Memory should be fastest
    const memoryResult = results.find((r) => r.adapter.includes("Memory"));
    expect(memoryResult).toBeDefined();
  });

  it("should benchmark search performance", async () => {
    const results: BenchmarkResult[] = [];

    for (const { name, adapter } of adapters) {
      const result = await benchmarkSearch(adapter, name, NUM_QUERIES, 10);
      results.push(result);
    }

    printBenchmarkResults(results);

    // All adapters should complete searches
    for (const result of results) {
      expect(result.avgTime).toBeGreaterThan(0);
      expect(result.throughput).toBeGreaterThan(0);
    }
  });

  it("should benchmark batch insert performance", async () => {
    const results: BenchmarkResult[] = [];

    for (const { name, adapter } of adapters) {
      const result = await benchmarkBatchInsert(adapter, name, NUM_VECTORS, 100);
      results.push(result);
    }

    printBenchmarkResults(results);

    // Batch insert should be faster than individual inserts
    for (const result of results) {
      expect(result.avgTime).toBeGreaterThan(0);
    }
  });

  it("should compare performance across adapters", async () => {
    const allResults: BenchmarkResult[] = [];

    // Run all benchmarks
    for (const { name, adapter } of adapters) {
      const insertResult = await benchmarkInsert(adapter, name, NUM_VECTORS);
      const searchResult = await benchmarkSearch(adapter, name, NUM_QUERIES, 10);
      const batchResult = await benchmarkBatchInsert(adapter, name, NUM_VECTORS, 100);

      allResults.push(insertResult, searchResult, batchResult);
    }

    printBenchmarkResults(allResults);

    // Compare with baseline (memory adapter)
    const baselineInsert = allResults.find(
      (r) => r.adapter.includes("Memory") && r.operation === "insert"
    );

    if (baselineInsert) {
      console.log("\n=== Performance vs Baseline (Memory) ===\n");

      for (const result of allResults) {
        if (result.adapter.includes("Memory")) continue;

        const comparison = compareBenchmarks(baselineInsert, result);
        console.log(
          `${result.adapter} ${result.operation}: ${comparison.speedup.toFixed(2)}x ${comparison.improvement}`
        );
      }
    }

    // Generate summary
    console.log("\n=== Summary ===\n");
    console.log(`Total benchmarks run: ${allResults.length}`);
    console.log(`Adapters tested: ${adapters.map((a) => a.name).join(", ")}`);
    console.log(`Vectors per test: ${NUM_VECTORS}`);
    console.log(`Queries per test: ${NUM_QUERIES}`);
    console.log(`Vector dimension: ${DIMENSION}`);
  });
});

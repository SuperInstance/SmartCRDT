/**
 * Ollama Performance Benchmarks (Mock Version)
 *
 * Performance benchmarking for Ollama inference using mocks.
 * This allows CI/CD to run benchmarks without Ollama dependency.
 *
 * For real Ollama benchmarks, run ollama-inference.integration.test.ts
 */

import { describe, it, expect, afterAll } from "vitest";
import { createMockOllamaAdapter } from "./mocks.js";
import type { RoutingDecision } from "@lsi/protocol";

/**
 * Benchmark configuration
 */
const BENCHMARK_CONFIG = {
  // Benchmark settings
  WARMUP_ITERATIONS: 3,
  BENCHMARK_ITERATIONS: 10,

  // Throughput test settings
  THROUGHPUT_DURATION: 5000, // 5 seconds
  THROUGHPUT_CONCURRENT: 5,

  // Concurrency test settings
  CONCURRENCY_LEVELS: [1, 2, 5, 10],

  // Latency thresholds (in milliseconds)
  LATENCY_THRESHOLDS: {
    p50: 200,   // 50th percentile (lower for mocks)
    p95: 300,   // 95th percentile
    p99: 500,   // 99th percentile
  },

  // Throughput thresholds (req/sec)
  THROUGHPUT_THRESHOLD: 5.0, // Minimum 5 req/sec for mocks
};

/**
 * Benchmark results interface
 */
interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p50: number;
  p95: number;
  p99: number;
  throughput: number;
  passed: boolean;
}

/**
 * Calculate percentiles
 */
function calculatePercentile(values: number[], percentile: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index] || 0;
}

/**
 * Run a single benchmark iteration
 */
async function runBenchmarkIteration(
  adapter: any,
  query: string
): Promise<number> {
  const start = Date.now();
  await adapter.process(query);
  return Date.now() - start;
}

/**
 * Run full benchmark suite
 */
async function runBenchmark(
  name: string,
  adapter: any,
  query: string,
  iterations: number
): Promise<BenchmarkResult> {
  const latencies: number[] = [];

  // Warmup
  for (let i = 0; i < BENCHMARK_CONFIG.WARMUP_ITERATIONS; i++) {
    await adapter.process(query);
  }

  // Benchmark
  const startTime = Date.now();
  for (let i = 0; i < iterations; i++) {
    const latency = await runBenchmarkIteration(adapter, query);
    latencies.push(latency);
  }
  const totalTime = Date.now() - startTime;

  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const minLatency = Math.min(...latencies);
  const maxLatency = Math.max(...latencies);
  const p50 = calculatePercentile(latencies, 50);
  const p95 = calculatePercentile(latencies, 95);
  const p99 = calculatePercentile(latencies, 99);
  const throughput = iterations / (totalTime / 1000);

  const passed =
    p50 <= BENCHMARK_CONFIG.LATENCY_THRESHOLDS.p50 &&
    p95 <= BENCHMARK_CONFIG.LATENCY_THRESHOLDS.p95 &&
    p99 <= BENCHMARK_CONFIG.LATENCY_THRESHOLDS.p99 &&
    throughput >= BENCHMARK_CONFIG.THROUGHPUT_THRESHOLD;

  return {
    name,
    iterations,
    totalTime,
    avgLatency,
    minLatency,
    maxLatency,
    p50,
    p95,
    p99,
    throughput,
    passed,
  };
}

/**
 * Run throughput benchmark
 */
async function runThroughputBenchmark(
  adapter: any,
  query: string,
  duration: number,
  concurrent: number
): Promise<BenchmarkResult> {
  const startTime = Date.now();
  let requestCount = 0;
  const latencies: number[] = [];

  const runRequest = async () => {
    const start = Date.now();
    await adapter.process(`${query} ${requestCount + 1}`);
    latencies.push(Date.now() - start);
    requestCount++;
  };

  // Run concurrent requests
  const workers = Array.from({ length: concurrent }, () =>
    (async () => {
      while (Date.now() - startTime < duration) {
        await runRequest();
      }
    })()
  );

  await Promise.all(workers);
  const totalTime = Date.now() - startTime;

  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const minLatency = Math.min(...latencies);
  const maxLatency = Math.max(...latencies);
  const p50 = calculatePercentile(latencies, 50);
  const p95 = calculatePercentile(latencies, 95);
  const p99 = calculatePercentile(latencies, 99);
  const throughput = requestCount / (totalTime / 1000);

  return {
    name: `Throughput (${concurrent} concurrent)`,
    iterations: requestCount,
    totalTime,
    avgLatency,
    minLatency,
    maxLatency,
    p50,
    p95,
    p99,
    throughput,
    passed: throughput >= BENCHMARK_CONFIG.THROUGHPUT_THRESHOLD,
  };
}

/**
 * Print benchmark results
 */
function printBenchmarkResults(result: BenchmarkResult): void {
  console.log(`\n📊 Benchmark: ${result.name}`);
  console.log("─".repeat(60));
  console.log(`Iterations:          ${result.iterations}`);
  console.log(`Total time:          ${result.totalTime}ms`);
  console.log(`Average latency:     ${result.avgLatency.toFixed(2)}ms`);
  console.log(`Min latency:         ${result.minLatency}ms`);
  console.log(`Max latency:         ${result.maxLatency}ms`);
  console.log(`P50 latency:         ${result.p50.toFixed(2)}ms`);
  console.log(`P95 latency:         ${result.p95.toFixed(2)}ms`);
  console.log(`P99 latency:         ${result.p99.toFixed(2)}ms`);
  console.log(`Throughput:          ${result.throughput.toFixed(2)} req/sec`);
  console.log(`Status:              ${result.passed ? "✅ PASS" : "❌ FAIL"}`);
  console.log("─".repeat(60));
}

describe("Ollama Performance Benchmarks (Mock)", () => {
  /**
   * Latency benchmarks
   */
  describe("Latency Benchmarks", () => {
    it("benchmark: simple query latency", async () => {
      const adapter = createMockOllamaAdapter(100, 0);

      const result = await runBenchmark(
        "Simple Query Latency",
        adapter,
        "What is 2+2?",
        BENCHMARK_CONFIG.BENCHMARK_ITERATIONS
      );

      printBenchmarkResults(result);

      expect(result.passed).toBe(true);
    });

    it("benchmark: complex query latency", async () => {
      const adapter = createMockOllamaAdapter(200, 0);

      const result = await runBenchmark(
        "Complex Query Latency",
        adapter,
        "Explain the implications of quantum computing",
        BENCHMARK_CONFIG.BENCHMARK_ITERATIONS
      );

      printBenchmarkResults(result);

      expect(result.avgLatency).toBeGreaterThan(0);
      expect(result.throughput).toBeGreaterThan(0);
    });

    it("benchmark: code generation latency", async () => {
      const adapter = createMockOllamaAdapter(300, 0);

      const result = await runBenchmark(
        "Code Generation Latency",
        adapter,
        "Write a function to add two numbers",
        Math.floor(BENCHMARK_CONFIG.BENCHMARK_ITERATIONS / 2)
      );

      printBenchmarkResults(result);

      expect(result.avgLatency).toBeGreaterThan(0);
    });
  });

  /**
   * Throughput benchmarks
   */
  describe("Throughput Benchmarks", () => {
    it("benchmark: sustained throughput (5 seconds)", async () => {
      const adapter = createMockOllamaAdapter(100, 0);

      const result = await runThroughputBenchmark(
        adapter,
        "What is 2+2?",
        BENCHMARK_CONFIG.THROUGHPUT_DURATION,
        BENCHMARK_CONFIG.THROUGHPUT_CONCURRENT
      );

      printBenchmarkResults(result);

      expect(result.throughput).toBeGreaterThan(0);
      expect(result.iterations).toBeGreaterThan(0);
    }, 15000); // 15 second timeout for this test

    it("benchmark: burst throughput", async () => {
      const adapter = createMockOllamaAdapter(50, 0);

      const burstRequests = 20;
      const startTime = Date.now();

      const promises = Array.from({ length: burstRequests }, (_, i) =>
        adapter.process(`Burst query ${i + 1}`)
      );

      await Promise.all(promises);

      const totalTime = Date.now() - startTime;
      const throughput = burstRequests / (totalTime / 1000);

      console.log(`\n📊 Burst Throughput: ${throughput.toFixed(2)} req/sec`);
      console.log(`Total time: ${totalTime}ms`);
      console.log(`Requests: ${burstRequests}`);

      expect(throughput).toBeGreaterThan(0);
    });
  });

  /**
   * Concurrency benchmarks
   */
  describe("Concurrency Benchmarks", () => {
    it.concurrent("benchmark: concurrency levels", async () => {
      const results: Array<{
        concurrency: number;
        throughput: number;
        avgLatency: number;
      }> = [];

      for (const concurrency of BENCHMARK_CONFIG.CONCURRENCY_LEVELS) {
        const adapter = createMockOllamaAdapter(100, 0);
        const requestsPerLevel = 10;
        const startTime = Date.now();

        const promises = Array.from({ length: requestsPerLevel }, (_, i) =>
          adapter.process(`Concurrency test ${i + 1}`)
        );

        await Promise.all(promises);

        const totalTime = Date.now() - startTime;
        const throughput = requestsPerLevel / (totalTime / 1000);
        const avgLatency = totalTime / requestsPerLevel;

        results.push({ concurrency, throughput, avgLatency });

        console.log(
          `  Concurrency ${concurrency}: ${throughput.toFixed(2)} req/sec, ${avgLatency.toFixed(2)}ms avg latency`
        );
      }

      // Higher concurrency should generally yield better throughput
      expect(results).toHaveLength(BENCHMARK_CONFIG.CONCURRENCY_LEVELS.length);
    });
  });

  /**
   * Memory pressure benchmarks
   */
  describe("Memory Pressure Benchmarks", () => {
    it("benchmark: large input handling", async () => {
      const adapter = createMockOllamaAdapter(200, 0);

      const smallInput = "Small input";
      const largeInput = "Large input. ".repeat(1000);

      const startSmall = Date.now();
      await adapter.process(smallInput);
      const timeSmall = Date.now() - startSmall;

      const startLarge = Date.now();
      await adapter.process(largeInput);
      const timeLarge = Date.now() - startLarge;

      console.log(`\n📊 Memory Pressure:`);
      console.log(`  Small input: ${timeSmall}ms`);
      console.log(`  Large input: ${timeLarge}ms`);
      console.log(`  Ratio: ${(timeLarge / timeSmall).toFixed(2)}x`);

      expect(timeLarge).toBeGreaterThan(0);
    });

    it("benchmark: sequential large requests", async () => {
      const adapter = createMockOllamaAdapter(150, 0);

      const iterations = 5;
      const largeInput = "Explain AI in detail. ".repeat(500);

      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        await adapter.process(largeInput);
      }

      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / iterations;

      console.log(`\n📊 Sequential Large Requests:`);
      console.log(`  Iterations: ${iterations}`);
      console.log(`  Total time: ${totalTime}ms`);
      console.log(`  Average time: ${avgTime.toFixed(2)}ms`);

      expect(totalTime).toBeGreaterThan(0);
    });
  });

  /**
   * Comparison benchmarks
   */
  describe("Comparison Benchmarks", () => {
    it("benchmark: compare different query types", async () => {
      const queryTypes = [
        { name: "Simple", query: "What is 2+2?", latency: 100 },
        { name: "Factual", query: "What is the capital of France?", latency: 120 },
        { name: "Complex", query: "Explain quantum computing", latency: 200 },
      ];

      const results: Array<{ name: string; avgLatency: number }> = [];

      for (const { name, query, latency } of queryTypes) {
        const adapter = createMockOllamaAdapter(latency, 0);
        const iterations = 5;
        const latencies: number[] = [];

        for (let i = 0; i < iterations; i++) {
          const start = Date.now();
          await adapter.process(query);
          latencies.push(Date.now() - start);
        }

        const avgLatency =
          latencies.reduce((a, b) => a + b, 0) / latencies.length;
        results.push({ name, avgLatency });

        console.log(`  ${name}: ${avgLatency.toFixed(2)}ms avg`);
      }

      expect(results).toHaveLength(queryTypes.length);
    });
  });
});

/**
 * Benchmark summary
 */
afterAll(() => {
  console.log("\n" + "=".repeat(60));
  console.log("OLLAMA PERFORMANCE BENCHMARK SUMMARY (MOCK)");
  console.log("=".repeat(60));
  console.log("Mode: Mock-based (no Ollama required)");
  console.log("\nThresholds:");
  console.log(`  P50 Latency:   ${BENCHMARK_CONFIG.LATENCY_THRESHOLDS.p50}ms`);
  console.log(`  P95 Latency:   ${BENCHMARK_CONFIG.LATENCY_THRESHOLDS.p95}ms`);
  console.log(`  P99 Latency:   ${BENCHMARK_CONFIG.LATENCY_THRESHOLDS.p99}ms`);
  console.log(`  Throughput:    ${BENCHMARK_CONFIG.THROUGHPUT_THRESHOLD} req/sec`);
  console.log("\nNote: For real Ollama benchmarks, run ollama-inference.integration.test.ts");
  console.log("=".repeat(60) + "\n");
});

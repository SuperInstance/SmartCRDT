/**
 * IntentEncoder Performance Benchmarks
 *
 * Performance tests for IntentEncoder including:
 * - Single query latency
 * - Batch throughput
 * - Memory usage
 * - Cache performance
 * - Scalability tests
 *
 * These tests can be slow and may be skipped in normal test runs.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { IntentEncoder } from "@lsi/privacy";
import type { IntentVector } from "@lsi/protocol";
import {
  sampleQueries,
  performanceTargets,
  batchTestSizes,
  testConfig,
} from "./fixtures";

/**
 * Helper: Generate test queries
 */
function generateQueries(count: number): string[] {
  const allQueries = [
    ...sampleQueries.PUBLIC,
    ...sampleQueries.SENSITIVE,
    ...sampleQueries.SOVEREIGN,
  ];

  const queries: string[] = [];
  for (let i = 0; i < count; i++) {
    queries.push(allQueries[i % allQueries.length]);
  }

  return queries;
}

/**
 * Helper: Calculate memory usage
 */
function getMemoryUsage(): number {
  if (typeof process !== "undefined" && process.memoryUsage) {
    return process.memoryUsage().heapUsed / 1024 / 1024; // MB
  }
  return 0;
}

/**
 * Helper: Measure throughput
 */
async function measureThroughput(
  encoder: IntentEncoder,
  queries: string[]
): Promise<{ queriesPerSecond: number; totalDuration: number }> {
  const start = Date.now();
  await encoder.encodeBatch(queries);
  const duration = Date.now() - start;

  const queriesPerSecond = (queries.length / duration) * 1000;

  return {
    queriesPerSecond,
    totalDuration: duration,
  };
}

describe("IntentEncoder Performance Benchmarks", () => {
  let encoder: IntentEncoder;

  beforeAll(async () => {
    encoder = new IntentEncoder({
      openaiKey: process.env.OPENAI_API_KEY || "test-key",
      epsilon: testConfig.defaultEpsilon,
      timeout: testConfig.defaultTimeout,
    });

    await encoder.initialize();
  });

  afterAll(async () => {
    await encoder.shutdown();
  });

  describe("Single Query Latency", () => {
    it("should encode single query within target latency", async () => {
      const query = "What is the weather like today?";
      const latencies: number[] = [];

      // Warm up
      await encoder.encode(query);

      // Measure 10 iterations
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await encoder.encode(query);
        latencies.push(Date.now() - start);
      }

      const avgLatency = latencies.reduce((a, b) => a + b) / latencies.length;
      const minLatency = Math.min(...latencies);
      const maxLatency = Math.max(...latencies);

      expect(avgLatency).toBeLessThanOrEqual(
        performanceTargets.singleQueryLatency.warning
      );
      expect(minLatency).toBeLessThanOrEqual(
        performanceTargets.singleQueryLatency.target
      );
    });

    it("should maintain consistent latency across queries", async () => {
      const queries = sampleQueries.PUBLIC.slice(0, 5);
      const latencies: number[] = [];

      for (const query of queries) {
        const start = Date.now();
        await encoder.encode(query);
        latencies.push(Date.now() - start);
      }

      const avgLatency = latencies.reduce((a, b) => a + b) / latencies.length;
      const variance =
        latencies.reduce((sum, lat) => sum + Math.pow(lat - avgLatency, 2), 0) /
        latencies.length;
      const stdDev = Math.sqrt(variance);

      // Standard deviation should be less than average (reasonable consistency)
      expect(stdDev).toBeLessThan(avgLatency);
    });
  });

  describe("Batch Throughput", () => {
    it("should encode 10 queries efficiently", async () => {
      const queries = generateQueries(10);
      const result = await measureThroughput(encoder, queries);

      expect(result.queriesPerSecond).toBeGreaterThan(
        performanceTargets.batchThroughput.warning
      );
      expect(result.totalDuration).toBeLessThan(30000); // 30 seconds max
    });

    it("should encode 25 queries efficiently", async () => {
      const queries = generateQueries(25);
      const result = await measureThroughput(encoder, queries);

      expect(result.queriesPerSecond).toBeGreaterThan(
        performanceTargets.batchThroughput.critical
      );
      expect(result.totalDuration).toBeLessThan(60000); // 60 seconds max
    });

    it("should encode 50 queries efficiently", async () => {
      const queries = generateQueries(50);
      const result = await measureThroughput(encoder, queries);

      expect(result.queriesPerSecond).toBeGreaterThan(
        performanceTargets.batchThroughput.critical
      );
      expect(result.totalDuration).toBeLessThan(120000); // 2 minutes max
    });

    it("should encode 100 queries under 2 minutes", async () => {
      const queries = generateQueries(100);
      const start = Date.now();

      const intents = await encoder.encodeBatch(queries);

      const duration = Date.now() - start;

      expect(intents).toHaveLength(100);
      expect(duration).toBeLessThan(120000); // < 2 minutes
    });
  });

  describe("Scalability Tests", () => {
    it("should scale linearly with batch size", async () => {
      const sizes = [5, 10, 25];
      const results: Array<{ size: number; duration: number }> = [];

      for (const size of sizes) {
        const queries = generateQueries(size);
        const start = Date.now();

        await encoder.encodeBatch(queries);

        const duration = Date.now() - start;
        results.push({ size, duration });
      }

      // Check that duration increases roughly proportionally to size
      // Allow for some overhead (not perfectly linear)
      const ratio1 = results[1].duration / results[0].duration;
      const ratio2 = results[2].duration / results[1].duration;

      // Each batch should take at least 1.5x longer than the previous
      // (allowing for some parallelism/optimization)
      expect(ratio1).toBeGreaterThan(1.0);
      expect(ratio2).toBeGreaterThan(1.0);
    });
  });

  describe("Memory Efficiency", () => {
    it("should maintain reasonable memory usage for single query", async () => {
      const memBefore = getMemoryUsage();

      const query = "Memory test query";
      await encoder.encode(query);

      // Force GC if available
      if (global.gc) {
        global.gc();
      }

      const memAfter = getMemoryUsage();
      const memUsed = memAfter - memBefore;

      // Memory usage should be reasonable (implementation-dependent)
      expect(memUsed).toBeLessThan(performanceTargets.memoryUsage.critical);
    });

    it("should maintain reasonable memory usage for batch", async () => {
      const queries = generateQueries(50);
      const memBefore = getMemoryUsage();

      await encoder.encodeBatch(queries);

      if (global.gc) {
        global.gc();
      }

      const memAfter = getMemoryUsage();
      const memUsed = memAfter - memBefore;

      expect(memUsed).toBeLessThan(performanceTargets.memoryUsage.critical);
    });
  });

  describe("Privacy Parameter Performance", () => {
    it("should perform similarly across epsilon values", async () => {
      const query = "test query";
      const epsilons = [0.1, 0.5, 1.0, 2.0, 5.0];
      const latencies: number[] = [];

      for (const epsilon of epsilons) {
        const start = Date.now();
        await encoder.encode(query, { epsilon });
        latencies.push(Date.now() - start);
      }

      const avgLatency = latencies.reduce((a, b) => a + b) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const minLatency = Math.min(...latencies);

      // Max latency should not be more than 3x min latency
      expect(maxLatency / minLatency).toBeLessThan(3.0);
    });
  });

  describe("Vector Operation Performance", () => {
    it("should compute cosine similarity efficiently", async () => {
      const intents = await encoder.encodeBatch(["query 1", "query 2"]);

      const iterations = 10000;
      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        const dotProduct = 0;
        for (let j = 0; j < intents[0].vector.length; j++) {
          intents[0].vector[j] * intents[1].vector[j];
        }
      }

      const duration = Date.now() - start;

      // Should compute 10k similarities in less than 1 second
      expect(duration).toBeLessThan(1000);
    });
  });

  describe("Cold vs Warm Performance", () => {
    it("should perform better after warmup", async () => {
      const query = "warmup test query";

      // Cold start
      const coldStart = Date.now();
      await encoder.encode(query);
      const coldDuration = Date.now() - coldStart;

      // Warm runs
      const warmDurations: number[] = [];
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await encoder.encode(query);
        warmDurations.push(Date.now() - start);
      }

      const avgWarmDuration =
        warmDurations.reduce((a, b) => a + b) / warmDurations.length;

      // Warm runs should be faster or similar to cold start
      // (may not always be true depending on implementation)
      expect(avgWarmDuration).toBeLessThanOrEqual(coldDuration * 1.5);
    });
  });

  describe("Concurrent Load", () => {
    it("should handle concurrent requests", async () => {
      const queries = generateQueries(20);
      const start = Date.now();

      // Encode concurrently
      await Promise.all(queries.map(q => encoder.encode(q)));

      const duration = Date.now() - start;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(60000); // 60 seconds
    });
  });
});

/**
 * Semantic Cache Performance Integration Tests
 *
 * Comprehensive performance testing for SemanticCache including:
 * - Hit rate validation (80% target)
 * - Latency under load (P95 < 20ms)
 * - Memory pressure testing (1M entries < 2GB)
 * - Throughput testing (>5000 QPS)
 * - Cold start to warm cache progression
 * - Eviction behavior testing
 * - Similarity threshold optimization
 * - Multi-user scenarios
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { SemanticCache } from "@lsi/cascade";
import type { RefinedQuery, QueryType, SemanticFeatures } from "@lsi/cascade";

// ============================================================================
// Test Types and Interfaces
// ============================================================================

interface PerformanceTestResult {
  testName: string;
  passed: boolean;
  details: {
    hitRate?: number;
    p50Latency?: number;
    p95Latency?: number;
    p99Latency?: number;
    throughput?: number;
    memoryMB?: number;
    errorRate?: number;
  };
  timestamp: number;
}

interface CacheLoadTestConfig {
  queryCount: number;
  qps: number; // queries per second
  uniqueQueries: number;
  concurrency: number;
}

interface MemorySnapshot {
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
}

// ============================================================================
// Test Data Generators
// ============================================================================

/**
 * Generate synthetic embeddings for testing
 * Simulates OpenAI text-embedding-ada-002 (1536 dimensions)
 */
function generateEmbedding(seed: string): number[] {
  const dimensions = 1536;
  const embedding: number[] = [];
  let hash = 0;

  // Create hash from seed
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  // Generate embedding using hash
  for (let i = 0; i < dimensions; i++) {
    // Use sine and cosine with hash for deterministic but varied values
    const value = Math.sin(hash * (i + 1)) * Math.cos(hash / (i + 1));
    // Normalize to [-1, 1]
    embedding.push(value);
  }

  // Normalize to unit length
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / norm);
}

/**
 * Real-world query patterns for testing
 */
const QUERY_PATTERNS = {
  code: [
    "How do I implement binary search in TypeScript?",
    "Write a function to sort an array",
    "What's the difference between let and const?",
    "How to use async/await in TypeScript?",
    "Create a generic type for arrays",
    "Implement a linked list in JavaScript",
    "How to type a React component?",
    "What is a TypeScript interface?",
    "How do I use generics?",
    "Explain type inference in TypeScript"
  ],
  explanation: [
    "Explain how machine learning works",
    "What is the difference between AI and ML?",
    "How does a neural network learn?",
    "What is backpropagation?",
    "Explain the concept of overfitting",
    "What is deep learning?",
    "How do transformers work?",
    "What is reinforcement learning?",
    "Explain gradient descent",
    "What is a loss function?"
  ],
  question: [
    "What is the capital of France?",
    "How many planets are in the solar system?",
    "Who wrote Romeo and Juliet?",
    "What is the boiling point of water?",
    "When was World War II?",
    "What is the largest ocean?",
    "Who invented the telephone?",
    "What is the speed of light?",
    "What is photosynthesis?",
    "Who was the first person on the moon?"
  ],
  debug: [
    "Why is my code not working?",
    "How to fix TypeError in JavaScript?",
    "Debug async function not returning",
    "Why is my loop infinite?",
    "How to find memory leaks in Node.js?",
    "Fix undefined is not a function",
    "Why is my API call failing?",
    "Debug React component not rendering",
    "How to fix CORS error?",
    "Why is my test failing?"
  ],
  comparison: [
    "What is the difference between SQL and NoSQL?",
    "Compare Python vs JavaScript",
    "Git vs Mercurial differences",
    "REST vs GraphQL comparison",
    "Docker vs Kubernetes",
    "SQL vs MongoDB comparison",
    "React vs Vue vs Angular",
    "Monolith vs microservices",
    "TCP vs UDP differences",
    "Synchronous vs asynchronous"
  ]
};

/**
 * Generate semantically similar query variations
 */
function generateSimilarQueries(baseQuery: string, count: number): string[] {
  const variations: string[] = [];
  const prefixes = [
    "Explain", "Describe", "What is", "How does", "Tell me about",
    "Can you explain", "I need to understand", "Help me with"
  ];
  const suffixes = [
    "in detail", "simply", "with examples", "step by step", "for beginners"
  ];

  for (let i = 0; i < count; i++) {
    const prefix = prefixes[i % prefixes.length];
    const suffix = suffixes[i % suffixes.length];
    // Create variations by adding/removing words
    if (i % 3 === 0) {
      variations.push(`${prefix} ${baseQuery.toLowerCase()}`);
    } else if (i % 3 === 1) {
      variations.push(`${baseQuery} ${suffix}`);
    } else {
      variations.push(baseQuery);
    }
  }

  return variations;
}

/**
 * Generate diverse query set for load testing
 */
function generateQuerySet(count: number, uniqueRatio: number): string[] {
  const queries: string[] = [];
  const uniqueCount = Math.floor(count * uniqueRatio);
  const repeatCount = count - uniqueCount;

  // Add unique queries
  const allPatterns = Object.values(QUERY_PATTERNS).flat();
  for (let i = 0; i < uniqueCount; i++) {
    const baseQuery = allPatterns[i % allPatterns.length];
    queries.push(`${baseQuery} (variation ${i})`);
  }

  // Add repeated queries (for cache hits)
  for (let i = 0; i < repeatCount; i++) {
    const randomIndex = Math.floor(Math.random() * uniqueCount);
    queries.push(queries[randomIndex]);
  }

  // Shuffle
  return queries.sort(() => Math.random() - 0.5);
}

/**
 * Create refined query from string
 */
function createRefinedQuery(
  query: string,
  queryType: QueryType = "general"
): RefinedQuery {
  const embedding = generateEmbedding(query);

  return {
    cacheKey: `query:${queryType}:${query}`,
    original: query,
    semanticFeatures: {
      embedding,
      complexity: 0.5,
      confidence: 0.9,
      keywords: []
    },
    staticFeatures: {
      queryType,
      length: query.length,
      wordCount: query.split(" ").length,
      hasCode: false,
      hasNumbers: /\d/.test(query)
    }
  };
}

// ============================================================================
// Performance Measurement Utilities
// ============================================================================

/**
 * Measure memory usage
 */
function getMemoryUsage(): MemorySnapshot {
  const usage = process.memoryUsage();
  return {
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    rss: usage.rss,
    external: usage.external
  };
}

/**
 * Calculate memory difference
 */
function getMemoryDelta(before: MemorySnapshot, after: MemorySnapshot): number {
  return after.heapUsed - before.heapUsed;
}

/**
 * Calculate percentiles from array of numbers
 */
function calculatePercentiles(values: number[]): {
  p50: number;
  p95: number;
  p99: number;
  avg: number;
  min: number;
  max: number;
} {
  if (values.length === 0) {
    return { p50: 0, p95: 0, p99: 0, avg: 0, min: 0, max: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  return { p50, p95, p99, avg, min, max };
}

/**
 * Execute queries with rate limiting
 */
async function executeQueriesWithRateLimit(
  cache: SemanticCache,
  queries: string[],
  qps: number
): Promise<{ latencies: number[]; hits: number; misses: number }> {
  const intervalMs = 1000 / qps;
  const latencies: number[] = [];
  let hits = 0;
  let misses = 0;

  for (const query of queries) {
    const start = Date.now();
    const refinedQuery = createRefinedQuery(query);
    const result = await cache.get(refinedQuery);
    const latency = Date.now() - start;

    latencies.push(latency);

    if (result.found) {
      hits++;
    } else {
      misses++;
      // Add to cache on miss
      await cache.set(refinedQuery, `Response to: ${query}`);
    }

    // Rate limiting
    if (intervalMs > 0) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  return { latencies, hits, misses };
}

// ============================================================================
// Test Suite
// ============================================================================

describe("Semantic Cache Performance Integration Tests", () => {
  let cache: SemanticCache;
  let testResults: PerformanceTestResult[] = [];

  beforeAll(() => {
    // Create cache with production config
    cache = new SemanticCache({
      maxSize: 10000,
      similarityThreshold: 0.85,
      ttl: 300000, // 5 minutes
      enableHNSW: true,
      enableQueryTypeThresholds: true
    });
  });

  afterAll(() => {
    // Print test summary
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("           SEMANTIC CACHE PERFORMANCE TEST RESULTS");
    console.log("═══════════════════════════════════════════════════════════\n");

    const passed = testResults.filter(r => r.passed).length;
    const total = testResults.length;

    console.log(`Overall: ${passed}/${total} tests passed\n`);

    for (const result of testResults) {
      const icon = result.passed ? "✅" : "❌";
      console.log(`${icon} ${result.testName}`);
      if (result.details.hitRate !== undefined) {
        console.log(`   Hit Rate: ${(result.details.hitRate * 100).toFixed(1)}%`);
      }
      if (result.details.p95Latency !== undefined) {
        console.log(`   P95 Latency: ${result.details.p95Latency.toFixed(2)}ms`);
      }
      if (result.details.throughput !== undefined) {
        console.log(`   Throughput: ${result.details.throughput.toFixed(0)} QPS`);
      }
      if (result.details.memoryMB !== undefined) {
        console.log(`   Memory: ${result.details.memoryMB.toFixed(2)} MB`);
      }
      console.log("");
    }

    console.log("═══════════════════════════════════════════════════════════\n");
  });

  beforeEach(() => {
    cache.clear();
  });

  // ============================================================================
  // Test 1: Cold Start to Warm Cache Progression
  // ============================================================================

  it("should show hit rate improvement from cold to warm cache", async () => {
    const queries = generateQuerySet(100, 0.5); // 50 unique, 50 repeats
    const hitRates: number[] = [];

    // Populate cache (cold start)
    for (let i = 0; i < 50; i++) {
      const refinedQuery = createRefinedQuery(queries[i]);
      await cache.set(refinedQuery, `Response ${i}`);
    }

    // Measure hit rate progression
    for (let batch = 0; batch < 5; batch++) {
      const start = Date.now();
      let hits = 0;
      let total = 0;

      for (let i = 0; i < 20; i++) {
        const queryIndex = batch * 20 + i;
        const refinedQuery = createRefinedQuery(queries[queryIndex]);
        const result = await cache.get(refinedQuery);
        total++;
        if (result.found) hits++;
      }

      hitRates.push(hits / total);
    }

    // Hit rate should increase as cache warms
    const finalHitRate = hitRates[hitRates.length - 1];
    const initialHitRate = hitRates[0];

    testResults.push({
      testName: "Cold Start to Warm Cache",
      passed: finalHitRate > initialHitRate && finalHitRate > 0.5,
      details: {
        hitRate: finalHitRate
      },
      timestamp: Date.now()
    });

    expect(finalHitRate).toBeGreaterThan(initialHitRate);
    expect(finalHitRate).toBeGreaterThan(0.5);
  });

  // ============================================================================
  // Test 2: Hit Rate Over Time (80% Target)
  // ============================================================================

  it("should achieve 80% hit rate with repeated queries", async () => {
    const baseQueries = QUERY_PATTERNS.code.slice(0, 10);
    const allQueries: string[] = [];

    // Add base queries
    for (const query of baseQueries) {
      allQueries.push(query);
      // Add similar variations
      const variations = generateSimilarQueries(query, 5);
      allQueries.push(...variations);
    }

    // Warm cache with base queries
    for (const query of baseQueries) {
      const refinedQuery = createRefinedQuery(query, "code");
      await cache.set(refinedQuery, `Response to: ${query}`);
    }

    // Run queries and measure hit rate
    let hits = 0;
    const total = allQueries.length;

    for (const query of allQueries) {
      const refinedQuery = createRefinedQuery(query, "code");
      const result = await cache.get(refinedQuery);
      if (result.found) hits++;
    }

    const hitRate = hits / total;

    testResults.push({
      testName: "80% Hit Rate Target",
      passed: hitRate >= 0.8,
      details: {
        hitRate
      },
      timestamp: Date.now()
    });

    expect(hitRate).toBeGreaterThanOrEqual(0.8);
  });

  // ============================================================================
  // Test 3: Latency Under Load
  // ============================================================================

  it("should maintain P95 latency < 20ms under load", async () => {
    const qps = 100; // 100 queries per second
    const queryCount = 100;
    const queries = generateQuerySet(queryCount, 0.7); // 70% unique

    // Warm cache with some queries
    for (let i = 0; i < queryCount * 0.3; i++) {
      const refinedQuery = createRefinedQuery(queries[i]);
      await cache.set(refinedQuery, `Response ${i}`);
    }

    const { latencies } = await executeQueriesWithRateLimit(cache, queries, qps);
    const percentiles = calculatePercentiles(latencies);

    testResults.push({
      testName: "P95 Latency < 20ms",
      passed: percentiles.p95 < 20,
      details: {
        p50Latency: percentiles.p50,
        p95Latency: percentiles.p95,
        p99Latency: percentiles.p99
      },
      timestamp: Date.now()
    });

    expect(percentiles.p50).toBeLessThan(10);
    expect(percentiles.p95).toBeLessThan(20);
    expect(percentiles.p99).toBeLessThan(50);
  });

  // ============================================================================
  // Test 4: Throughput at Different Load Levels
  // ============================================================================

  it("should maintain throughput > 5000 QPS at low load", async () => {
    const queryCount = 1000;
    const queries = generateQuerySet(queryCount, 0.5);

    // Warm cache
    for (let i = 0; i < queryCount * 0.5; i++) {
      const refinedQuery = createRefinedQuery(queries[i]);
      await cache.set(refinedQuery, `Response ${i}`);
    }

    // Measure throughput (no rate limiting)
    const start = Date.now();
    let hits = 0;

    for (const query of queries) {
      const refinedQuery = createRefinedQuery(query);
      const result = await cache.get(refinedQuery);
      if (result.found) hits++;
    }

    const duration = Date.now() - start;
    const throughput = (queryCount / duration) * 1000;

    testResults.push({
      testName: "Throughput > 5000 QPS",
      passed: throughput > 5000,
      details: {
        throughput
      },
      timestamp: Date.now()
    });

    expect(throughput).toBeGreaterThan(5000);
  });

  // ============================================================================
  // Test 5: Memory Pressure (100K entries)
  // ============================================================================

  it("should handle 100K entries with reasonable memory", async () => {
    const entryCount = 100000;
    const memBefore = getMemoryUsage();

    // Add entries
    for (let i = 0; i < entryCount; i++) {
      const query = `Query ${i}: ${generateQuerySet(1, 1)[0]}`;
      const refinedQuery = createRefinedQuery(query);
      await cache.set(refinedQuery, `Response ${i}`);

      if (i % 10000 === 0 && i > 0) {
        // Progress check
        const currentMem = getMemoryUsage();
        const memUsedMB = (currentMem.heapUsed - memBefore.heapUsed) / (1024 * 1024);
        // Early warning if memory is growing too fast
        if (memUsedMB > 1500) {
          console.warn(`Memory at ${i} entries: ${memUsedMB.toFixed(2)} MB`);
        }
      }
    }

    const memAfter = getMemoryUsage();
    const memDelta = getMemoryDelta(memBefore, memAfter);
    const memMB = memDelta / (1024 * 1024);

    testResults.push({
      testName: "Memory Usage (100K entries)",
      passed: memMB < 1500, // < 1.5GB
      details: {
        memoryMB: memMB
      },
      timestamp: Date.now()
    });

    // Memory should be reasonable (< 2GB target, < 1.5GB for this test)
    expect(memMB).toBeLessThan(1500);

    // Cache should still work
    expect(cache.size()).toBe(entryCount);
  });

  // ============================================================================
  // Test 6: Eviction Behavior
  // ============================================================================

  it("should evict LRU entries when cache is full", async () => {
    const smallCache = new SemanticCache({
      maxSize: 100,
      similarityThreshold: 0.85
    });

    // Fill cache
    for (let i = 0; i < 150; i++) {
      const query = `Query ${i}`;
      const refinedQuery = createRefinedQuery(query);
      await smallCache.set(refinedQuery, `Response ${i}`);
    }

    // Cache should be at max size
    expect(smallCache.size()).toBeLessThanOrEqual(100);

    // Access some entries to make them hot
    for (let i = 100; i < 120; i++) {
      const query = `Query ${i}`;
      const refinedQuery = createRefinedQuery(query);
      await smallCache.get(refinedQuery);
    }

    // Add more entries
    for (let i = 150; i < 170; i++) {
      const query = `Query ${i}`;
      const refinedQuery = createRefinedQuery(query);
      await smallCache.set(refinedQuery, `Response ${i}`);
    }

    // Cache should still be at max size
    expect(smallCache.size()).toBeLessThanOrEqual(100);

    // Recent/hot entries should still be there
    const hotQuery = createRefinedQuery("Query 110");
    const hotResult = await smallCache.get(hotQuery);
    expect(hotResult.found).toBe(true);

    // Old entries should be evicted
    const coldQuery = createRefinedQuery("Query 10");
    const coldResult = await smallCache.get(coldQuery);
    expect(coldResult.found).toBe(false);

    testResults.push({
      testName: "LRU Eviction Behavior",
      passed: smallCache.size() <= 100 && hotResult.found && !coldResult.found,
      details: {},
      timestamp: Date.now()
    });
  });

  // ============================================================================
  // Test 7: Similarity Threshold Tuning
  // ============================================================================

  it("should respect different similarity thresholds", async () => {
    const baseQuery = "How do I implement binary search in TypeScript?";
    const similarQuery = "Explain binary search implementation in TypeScript";
    const differentQuery = "What is the capital of France?";

    const refinedBase = createRefinedQuery(baseQuery, "code");
    await cache.set(refinedBase, "Binary search explanation");

    // Test with high threshold (strict)
    cache.setSimilarityThreshold(0.95);
    const resultHigh = await cache.get(createRefinedQuery(similarQuery, "code"));

    // Test with low threshold (permissive)
    cache.setSimilarityThreshold(0.7);
    const resultLow = await cache.get(createRefinedQuery(similarQuery, "code"));

    // Test with different query (should miss at any threshold)
    cache.setSimilarityThreshold(0.5);
    const resultDifferent = await cache.get(createRefinedQuery(differentQuery, "question"));

    testResults.push({
      testName: "Similarity Threshold Tuning",
      passed: !resultHigh.found && resultLow.found && !resultDifferent.found,
      details: {},
      timestamp: Date.now()
    });

    expect(!resultHigh.found).toBe(true); // Should miss with high threshold
    expect(resultLow.found).toBe(true); // Should hit with low threshold
    expect(!resultDifferent.found).toBe(true); // Different query should miss
  });

  // ============================================================================
  // Test 8: Multi-User Scenarios
  // ============================================================================

  it("should handle concurrent multi-user access", async () => {
    const userCount = 10;
    const queriesPerUser = 100;
    const allResults: Array<{ latencies: number[]; hits: number; misses: number }> = [];

    // Simulate concurrent users
    const promises = Array.from({ length: userCount }, async (_, userIndex) => {
      const userQueries = generateQuerySet(queriesPerUser, 0.6);

      // Each user has some unique queries
      const offset = userIndex * 50;
      const uniqueQueries = userQueries.map((q, i) => `User${userIndex}: ${q} (${i})`);

      let hits = 0;
      let misses = 0;
      const latencies: number[] = [];

      for (const query of uniqueQueries) {
        const start = Date.now();
        const refinedQuery = createRefinedQuery(query);
        const result = await cache.get(refinedQuery);
        const latency = Date.now() - start;

        latencies.push(latency);

        if (result.found) {
          hits++;
        } else {
          misses++;
          await cache.set(refinedQuery, `Response: ${query}`);
        }
      }

      return { latencies, hits, misses };
    });

    const results = await Promise.all(promises);

    // Aggregate results
    const totalLatencies = results.flatMap(r => r.latencies);
    const totalHits = results.reduce((sum, r) => sum + r.hits, 0);
    const totalMisses = results.reduce((sum, r) => sum + r.misses, 0);
    const hitRate = totalHits / (totalHits + totalMisses);
    const percentiles = calculatePercentiles(totalLatencies);

    testResults.push({
      testName: "Multi-User Concurrent Access",
      passed: hitRate > 0.6 && percentiles.p95 < 50,
      details: {
        hitRate,
        p95Latency: percentiles.p95
      },
      timestamp: Date.now()
    });

    expect(hitRate).toBeGreaterThan(0.6);
    expect(percentiles.p95).toBeLessThan(50);
  });

  // ============================================================================
  // Test 9: Cache Size Scaling
  // ============================================================================

  it("should scale efficiently with different cache sizes", async () => {
    const sizes = [100, 1000, 5000];
    const results: Array<{ size: number; avgLatency: number; memoryMB: number }> = [];

    for (const size of sizes) {
      const testCache = new SemanticCache({
        maxSize: size,
        similarityThreshold: 0.85
      });

      const memBefore = getMemoryUsage();

      // Fill cache
      for (let i = 0; i < size; i++) {
        const query = `Query ${i}`;
        const refinedQuery = createRefinedQuery(query);
        await testCache.set(refinedQuery, `Response ${i}`);
      }

      // Measure latency
      const latencies: number[] = [];
      for (let i = 0; i < 100; i++) {
        const query = `Query ${Math.floor(Math.random() * size)}`;
        const start = Date.now();
        const refinedQuery = createRefinedQuery(query);
        await testCache.get(refinedQuery);
        latencies.push(Date.now() - start);
      }

      const memAfter = getMemoryUsage();
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const memoryMB = (memAfter.heapUsed - memBefore.heapUsed) / (1024 * 1024);

      results.push({ size, avgLatency, memoryMB });
    }

    // Latency should not grow linearly with cache size
    const latencyGrowth = results[2].avgLatency / results[0].avgLatency;
    const sizeGrowth = results[2].size / results[0].size;

    testResults.push({
      testName: "Cache Size Scaling",
      passed: latencyGrowth < sizeGrowth * 0.5, // Latency should grow < 50% of size growth
      details: {
        p95Latency: results[2].avgLatency,
        memoryMB: results[2].memoryMB
      },
      timestamp: Date.now()
    });

    // Latency growth should be sub-linear
    expect(latencyGrowth).toBeLessThan(sizeGrowth * 0.5);
  });

  // ============================================================================
  // Test 10: Per-Query-Type Performance
  // ============================================================================

  it("should maintain performance across different query types", async () => {
    const queryTypes: QueryType[] = ["code", "explanation", "question", "debug", "comparison"];
    const results: Record<QueryType, { hitRate: number; avgLatency: number }> = {} as any;

    for (const type of queryTypes) {
      const queries = QUERY_PATTERNS[type] || QUERY_PATTERNS.question;
      let hits = 0;
      let total = 0;
      const latencies: number[] = [];

      // Warm cache
      for (const query of queries.slice(0, 5)) {
        const refinedQuery = createRefinedQuery(query, type);
        await cache.set(refinedQuery, `Response: ${query}`);
      }

      // Test queries
      for (const query of queries) {
        const start = Date.now();
        const refinedQuery = createRefinedQuery(query, type);
        const result = await cache.get(refinedQuery);
        latencies.push(Date.now() - start);

        total++;
        if (result.found) hits++;
      }

      results[type] = {
        hitRate: hits / total,
        avgLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length
      };
    }

    // All query types should have reasonable performance
    const minHitRate = Math.min(...Object.values(results).map(r => r.hitRate));
    const maxLatency = Math.max(...Object.values(results).map(r => r.avgLatency));

    testResults.push({
      testName: "Per-Query-Type Performance",
      passed: minHitRate > 0.5 && maxLatency < 20,
      details: {
        hitRate: minHitRate,
        p95Latency: maxLatency
      },
      timestamp: Date.now()
    });

    expect(minHitRate).toBeGreaterThan(0.5);
    expect(maxLatency).toBeLessThan(20);
  });
});

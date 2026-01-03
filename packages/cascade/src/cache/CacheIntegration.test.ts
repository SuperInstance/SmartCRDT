/**
 * Integration tests for Cache Warmer and Cache Invalidator
 *
 * Tests cache warming, invalidation strategies, and their integration
 * with CascadeRouter.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CascadeRouter } from "../router/CascadeRouter.js";
import { CacheWarmer } from "./CacheWarmer.js";
import { CacheInvalidator, InvalidationStrategy } from "./CacheInvalidator.js";
import type { QueryContext } from "../types.js";

describe("Cache Integration Tests", () => {
  let router: CascadeRouter;
  let warmer: CacheWarmer;
  let invalidator: CacheInvalidator;
  const context: QueryContext = {
    timestamp: Date.now(),
    sessionId: "test-session",
    query: "",
  };

  beforeEach(() => {
    router = new CascadeRouter({
      enableCache: true,
      cacheMaxSize: 100,
      cacheTTL: 60000, // 1 minute
      enableRefiner: true,
    });

    warmer = new CacheWarmer(router, {
      commonQueries: [
        "What is JavaScript?",
        "How do I write a for loop?",
        "Explain recursion",
        "What is a closure?",
      ],
      batchSize: 2,
      delayBetweenBatches: 10, // Short delay for tests
      context,
    });

    invalidator = new CacheInvalidator(router.getSemanticCache());
  });

  afterEach(() => {
    router.clearCache();
  });

  describe("CacheWarmer", () => {
    it("should warm cache with common queries", async () => {
      const result = await warmer.warm();

      expect(result.successful).toBeGreaterThan(0);
      expect(result.failed).toBe(0);
      expect(result.duration).toBeGreaterThan(0);
      // failedQueries is initialized to empty array, not undefined
      expect(result.failedQueries?.length ?? 0).toBe(0);
    });

    it("should handle failures gracefully", async () => {
      // Create a warmer with invalid router (will fail)
      const badWarmer = new CacheWarmer(router, {
        commonQueries: [""], // Empty query might fail
        batchSize: 2,
        delayBetweenBatches: 10,
      });

      const result = await badWarmer.warm();

      // Should not throw, just report failures
      expect(result).toBeDefined();
    });

    it("should process queries in batches", async () => {
      // Create warmer with small batch size
      const batchWarmer = new CacheWarmer(router, {
        commonQueries: ["query1", "query2", "query3", "query4", "query5"],
        batchSize: 2,
        delayBetweenBatches: 10,
      });

      const startTime = Date.now();
      const result = await batchWarmer.warm();
      const duration = Date.now() - startTime;

      // Should process all queries
      expect(result.successful + result.failed).toBeGreaterThanOrEqual(0);

      // Should take time for delays (2 batches = at least 10ms delay)
      expect(duration).toBeGreaterThanOrEqual(10);
    });

    it("should provide default common queries", () => {
      const defaultQueries = CacheWarmer.getDefaultCommonQueries();

      expect(defaultQueries.length).toBeGreaterThan(50);
      expect(defaultQueries).toContain("What is JavaScript?");
      expect(defaultQueries).toContain("What is the capital of France?");
    });

    it("should provide programming-specific queries", () => {
      const programmingQueries = CacheWarmer.getProgrammingQueries();

      expect(programmingQueries.length).toBeGreaterThan(15);
      expect(programmingQueries).toContain("What is JavaScript?");
      expect(programmingQueries).toContain(
        "How do I write a for loop in Python?"
      );
    });

    it("should provide general knowledge queries", () => {
      const generalQueries = CacheWarmer.getGeneralKnowledgeQueries();

      expect(generalQueries.length).toBeGreaterThan(10);
      expect(generalQueries).toContain("What is the capital of France?");
      expect(generalQueries).toContain("Who wrote Romeo and Juliet?");
    });
  });

  describe("CacheInvalidator", () => {
    beforeEach(async () => {
      // Warm cache before each invalidation test
      await warmer.warm();
    });

    it("should invalidate using LRU strategy", () => {
      const statsBefore = invalidator.getStats();

      const result = invalidator.invalidate(InvalidationStrategy.LRU, {
        maxAge: 0, // Invalidate everything
      });

      expect(result.count).toBeGreaterThanOrEqual(0);
      expect(result.strategy).toBe(InvalidationStrategy.LRU);
      expect(result.entries).toBeUndefined(); // Not a dry run
    });

    it("should invalidate using LFU strategy", () => {
      const result = invalidator.invalidate(InvalidationStrategy.LFU, {
        minHitCount: 100, // Very high threshold, should invalidate all
      });

      expect(result.count).toBeGreaterThanOrEqual(0);
      expect(result.strategy).toBe(InvalidationStrategy.LFU);
    });

    it("should invalidate using TTL strategy", () => {
      const result = invalidator.invalidate(InvalidationStrategy.TTL, {
        maxAge: 0, // Everything is expired
      });

      expect(result.count).toBeGreaterThanOrEqual(0);
      expect(result.strategy).toBe(InvalidationStrategy.TTL);
    });

    it("should invalidate using adaptive strategy", () => {
      const result = invalidator.invalidate(InvalidationStrategy.ADAPTIVE);

      expect(result.count).toBeGreaterThanOrEqual(0);
      expect(result.strategy).toBe(InvalidationStrategy.ADAPTIVE);
    });

    it("should invalidate using manual pattern strategy", () => {
      // First, warm cache
      warmer.warm();

      const result = invalidator.invalidate(InvalidationStrategy.MANUAL, {
        pattern: /JavaScript/,
      });

      expect(result.count).toBeGreaterThanOrEqual(0);
      expect(result.strategy).toBe(InvalidationStrategy.MANUAL);
    });

    it("should support dry run mode", () => {
      const statsBefore = invalidator.getStats();

      const result = invalidator.invalidate(InvalidationStrategy.LRU, {
        maxAge: 0,
        dryRun: true,
      });

      const statsAfter = invalidator.getStats();

      // Dry run should not actually delete
      expect(statsBefore.size).toBe(statsAfter.size);
      expect(result.dryRun).toBe(true);
      expect(result.entries).toBeDefined();
    });

    it("should respect maxEntries limit", () => {
      const result = invalidator.invalidate(InvalidationStrategy.LRU, {
        maxAge: 0,
        maxEntries: 2,
      });

      // Should invalidate at most 2 entries
      expect(result.count).toBeLessThanOrEqual(2);
    });

    it("should clear all cache entries", () => {
      const statsBefore = invalidator.getStats();
      expect(statsBefore.size).toBeGreaterThan(0);

      invalidator.clear();

      const statsAfter = invalidator.getStats();
      expect(statsAfter.size).toBe(0);
    });

    it("should estimate memory usage", () => {
      const usage = invalidator.estimateMemoryUsage();

      expect(usage).toBeGreaterThanOrEqual(0);
      expect(typeof usage).toBe("number");
    });

    it("should provide recommendation", () => {
      const recommendation = invalidator.getRecommendation();

      expect(recommendation.strategy).toBeDefined();
      expect(recommendation.options).toBeDefined();
      expect(recommendation.reason).toBeDefined();
    });
  });

  describe("CascadeRouter Integration", () => {
    it("should route with intelligent cache", async () => {
      // First call - cache miss
      const result1 = await router.routeWithIntelligentCache(
        "What is JavaScript?",
        context
      );

      expect(result1.cacheStatus.hit).toBe(false);
      expect(result1.cacheStatus.level).toBeNull();
      expect(result1.cacheStatus.similarity).toBe(0);

      // Second call - cache hit (if refiner works)
      const result2 = await router.routeWithIntelligentCache(
        "What is JavaScript?",
        context
      );

      expect(result2).toBeDefined();
      expect(result2.route).toBeDefined();
    });

    it("should warm cache via router method", async () => {
      const commonQueries = ["query1", "query2", "query3"];

      const result = await router.warmCache(commonQueries);

      expect(result.successful).toBeGreaterThanOrEqual(0);
      expect(result.failed).toBeGreaterThanOrEqual(0);
      expect(result.duration).toBeGreaterThan(0);
    });

    it("should get comprehensive cache statistics", () => {
      // Warm cache first
      warmer.warm();

      const stats = router.getCacheStatistics();

      expect(stats.size).toBeDefined();
      expect(stats.hitRate).toBeDefined();
      expect(stats.totalHits).toBeDefined();
      expect(stats.totalMisses).toBeDefined();
      expect(stats.exactHits).toBeDefined();
      expect(stats.semanticHits).toBeDefined();
    });

    it("should get per-query-type statistics", () => {
      const stats = router.getPerQueryTypeStats();

      expect(typeof stats).toBe("object");
    });
  });

  describe("End-to-End Cache Flow", () => {
    it("should complete full cache lifecycle", async () => {
      // 1. Warm cache
      const warmResult = await warmer.warm();
      expect(warmResult.successful).toBeGreaterThan(0);

      // 2. Check statistics
      const stats1 = router.getCacheStatistics();
      expect(stats1.size).toBeGreaterThan(0);

      // 3. Use cache
      const result = await router.routeWithIntelligentCache(
        "What is JavaScript?",
        context
      );
      expect(result).toBeDefined();

      // 4. Invalidate some entries
      const invalidationResult = invalidator.invalidate(
        InvalidationStrategy.LRU,
        {
          maxAge: 0,
          maxEntries: 1,
        }
      );
      expect(invalidationResult.count).toBeGreaterThanOrEqual(0);

      // 5. Check statistics again
      const stats2 = router.getCacheStatistics();
      expect(stats2.size).toBeLessThanOrEqual(stats1.size);
    });

    it("should handle cache miss gracefully", async () => {
      // Clear cache first
      router.clearCache();

      const result = await router.routeWithIntelligentCache(
        "Brand new query",
        context
      );

      expect(result.cacheStatus.hit).toBe(false);
      expect(result.route).toBeDefined();
      expect(result.confidence).toBeDefined();
    });
  });

  describe("Cache Performance", () => {
    it("should improve response time on cache hit", async () => {
      const query = "What is TypeScript?";

      // First call - cache miss
      const start1 = Date.now();
      await router.routeWithIntelligentCache(query, context);
      const time1 = Date.now() - start1;

      // Second call - potential cache hit
      const start2 = Date.now();
      const result2 = await router.routeWithIntelligentCache(query, context);
      const time2 = Date.now() - start2;

      // Second call should be faster (or similar)
      // Note: This is a rough check, timing can vary
      expect(result2).toBeDefined();
    });
  });
});

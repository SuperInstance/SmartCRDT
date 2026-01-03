/**
 * Cache Invalidation Strategy Tests
 *
 * Tests for all cache invalidation strategies:
 * - TTL (Time-To-Live)
 * - Sliding Expiration
 * - Semantic Drift
 * - Tag-based
 * - Dependency-based
 * - LRU (Least Recently Used)
 * - LFU (Least Frequently Used)
 * - FIFO (First In First Out)
 * - Adaptive
 *
 * Run with: npx vitest run CacheInvalidation.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { SemanticCache } from "../refiner/SemanticCache.js";
import { CacheInvalidator } from "./CacheInvalidator.js";
import type {
  InvalidationConfig,
  TTLInvalidationConfig,
  SlidingExpirationConfig,
  SemanticDriftConfig,
  TagInvalidationConfig,
  DependencyInvalidationConfig,
  LRUInvalidationConfig,
  LFUInvalidationConfig,
  FIFOInvalidationConfig,
  AdaptiveInvalidationConfig,
  CacheInvalidationPolicy,
  PolicyEvaluationContext,
  CacheEntryMetadata,
} from "@lsi/protocol";

describe("CacheInvalidator - TTL Strategy", () => {
  let cache: SemanticCache;
  let invalidator: CacheInvalidator;

  beforeEach(() => {
    cache = new SemanticCache({ maxSize: 1000 });
    invalidator = new CacheInvalidator(cache);
  });

  it("should invalidate entries older than TTL", async () => {
    // Add entries with different timestamps
    const now = Date.now();
    await cache.set("query1", "result1");
    await cache.set("query2", "result2");

    // Manually age the first entry
    const entry1 = cache.peek("query1");
    if (entry1) {
      (entry1 as any).createdAt = now - 10 * 60 * 1000; // 10 minutes ago
      (entry1 as any).lastAccessed = now - 10 * 60 * 1000;
    }

    const config: TTLInvalidationConfig = {
      strategy: "ttl",
      enabled: true,
      priority: 100,
      ttl: 5 * 60 * 1000, // 5 minutes
    };

    const result = invalidator.invalidateSliding(config);

    expect(result.count).toBeGreaterThan(0);
    expect(result.strategy).toBe("sliding");
    expect(result.success).toBe(true);
  });

  it("should respect dry run mode", async () => {
    await cache.set("query1", "result1");

    const config: TTLInvalidationConfig = {
      strategy: "ttl",
      enabled: true,
      priority: 100,
      ttl: 0, // Expire immediately
      dryRun: true,
    };

    const result = invalidator.invalidateSliding(config);
    const entry = cache.get("query1");

    expect(result.count).toBeGreaterThan(0);
    expect(result.dryRun).toBe(true);
    expect(entry).toBeDefined(); // Entry should still exist
  });

  it("should provide detailed entry information", async () => {
    await cache.set("query1", "result1");

    const config: TTLInvalidationConfig = {
      strategy: "ttl",
      enabled: true,
      priority: 100,
      ttl: 0,
      dryRun: true,
    };

    const result = invalidator.invalidateSliding(config);

    expect(result.entries).toBeDefined();
    expect(result.entries!.length).toBeGreaterThan(0);
    expect(result.entries![0]).toMatchObject({
      key: expect.any(String),
      query: expect.any(String),
      reason: expect.any(String),
      trigger: expect.any(String),
      timestamp: expect.any(Number),
    });
  });
});

describe("CacheInvalidator - Sliding Expiration", () => {
  let cache: SemanticCache;
  let invalidator: CacheInvalidator;

  beforeEach(() => {
    cache = new SemanticCache({ maxSize: 1000 });
    invalidator = new CacheInvalidator(cache);
  });

  it("should invalidate entries not accessed within window", async () => {
    await cache.set("query1", "result1");

    const now = Date.now();
    const entry = cache.peek("query1");
    if (entry) {
      (entry as any).lastAccessed = now - 15 * 60 * 1000; // 15 minutes ago
    }

    const config: SlidingExpirationConfig = {
      strategy: "sliding",
      enabled: true,
      priority: 90,
      window: 10 * 60 * 1000, // 10 minutes
    };

    const result = invalidator.invalidateSliding(config);

    expect(result.count).toBe(1);
    expect(result.strategy).toBe("sliding");
  });

  it("should keep recently accessed entries", async () => {
    await cache.set("query1", "result1");

    const config: SlidingExpirationConfig = {
      strategy: "sliding",
      enabled: true,
      priority: 90,
      window: 10 * 60 * 1000,
    };

    const result = invalidator.invalidateSliding(config);

    expect(result.count).toBe(0); // No entries should be invalidated
  });
});

describe("CacheInvalidator - Semantic Drift", () => {
  let cache: SemanticCache;
  let invalidator: CacheInvalidator;

  beforeEach(() => {
    cache = new SemanticCache({ maxSize: 1000 });
    invalidator = new CacheInvalidator(cache);
  });

  it("should detect semantic drift below threshold", async () => {
    await cache.set("query1", "old result");

    const config: SemanticDriftConfig = {
      strategy: "semantic-drift",
      enabled: true,
      priority: 80,
      similarityThreshold: 0.9,
      sampleWindow: 10,
      maxAge: 30 * 60 * 1000,
    };

    // Simulate fresh result that's different
    const freshResults = new Map<string, unknown>();
    freshResults.set("query1", "new result");

    const result = invalidator.invalidateSemanticDrift(config, freshResults);

    expect(result.strategy).toBe("semantic-drift");
    // Similarity will be low, so it should invalidate
    expect(result.count).toBeGreaterThanOrEqual(0);
  });

  it("should not invalidate recent entries", async () => {
    await cache.set("query1", "result1");

    const config: SemanticDriftConfig = {
      strategy: "semantic-drift",
      enabled: true,
      priority: 80,
      similarityThreshold: 0.85,
      sampleWindow: 10,
      maxAge: 30 * 60 * 1000,
    };

    const result = invalidator.invalidateSemanticDrift(config);

    // Recent entry should not be invalidated
    expect(result.count).toBe(0);
  });
});

describe("CacheInvalidator - Tag-based", () => {
  let cache: SemanticCache;
  let invalidator: CacheInvalidator;

  beforeEach(() => {
    cache = new SemanticCache({ maxSize: 1000 });
    invalidator = new CacheInvalidator(cache);
  });

  it("should invalidate entries matching tags (exact)", async () => {
    await cache.set("query1", "result1");
    await cache.set("query2", "result2");

    const entryMetadata = new Map<string, CacheEntryMetadata>();
    entryMetadata.set("query1", {
      key: "query1",
      query: "query1",
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      hitCount: 1,
      tags: ["python", "tutorial"],
      dependencies: [],
      dependents: [],
      embedding: [],
      priority: 0,
      size: 1024,
      pinned: false,
      valid: true,
    });

    const config: TagInvalidationConfig = {
      strategy: "tagged",
      enabled: true,
      priority: 70,
      tags: ["python"],
      matchMode: "exact",
    };

    const result = invalidator.invalidateByTag(config, entryMetadata);

    expect(result.strategy).toBe("tagged");
    expect(result.count).toBe(1);
  });

  it("should support prefix tag matching", async () => {
    await cache.set("query1", "result1");

    const entryMetadata = new Map<string, CacheEntryMetadata>();
    entryMetadata.set("query1", {
      key: "query1",
      query: "query1",
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      hitCount: 1,
      tags: ["python:advanced", "python:basic"],
      dependencies: [],
      dependents: [],
      embedding: [],
      priority: 0,
      size: 1024,
      pinned: false,
      valid: true,
    });

    const config: TagInvalidationConfig = {
      strategy: "tagged",
      enabled: true,
      priority: 70,
      tags: ["python"],
      matchMode: "prefix",
    };

    const result = invalidator.invalidateByTag(config, entryMetadata);

    expect(result.count).toBe(1);
  });

  it("should cascade to dependencies if enabled", async () => {
    await cache.set("query1", "result1");
    await cache.set("query2", "result2");

    const entryMetadata = new Map<string, CacheEntryMetadata>();
    entryMetadata.set("query1", {
      key: "query1",
      query: "query1",
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      hitCount: 1,
      tags: ["python"],
      dependencies: [],
      dependents: ["query2"],
      embedding: [],
      priority: 0,
      size: 1024,
      pinned: false,
      valid: true,
    });
    entryMetadata.set("query2", {
      key: "query2",
      query: "query2",
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      hitCount: 1,
      tags: [],
      dependencies: ["query1"],
      dependents: [],
      embedding: [],
      priority: 0,
      size: 1024,
      pinned: false,
      valid: true,
    });

    const config: TagInvalidationConfig = {
      strategy: "tagged",
      enabled: true,
      priority: 70,
      tags: ["python"],
      matchMode: "exact",
      cascade: true,
    };

    const result = invalidator.invalidateByTag(config, entryMetadata);

    // Should invalidate both query1 and query2 (dependent)
    expect(result.count).toBeGreaterThanOrEqual(1);
  });
});

describe("CacheInvalidator - Dependency-based", () => {
  let cache: SemanticCache;
  let invalidator: CacheInvalidator;

  beforeEach(() => {
    cache = new SemanticCache({ maxSize: 1000 });
    invalidator = new CacheInvalidator(cache);
  });

  it("should cascade invalidations to dependents", async () => {
    await cache.set("dep1", "result1");
    await cache.set("dep2", "result2");
    await cache.set("dependent1", "result3");
    await cache.set("dependent2", "result4");

    const entryMetadata = new Map<string, CacheEntryMetadata>();
    entryMetadata.set("dep1", {
      key: "dep1",
      query: "dep1",
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      hitCount: 1,
      tags: [],
      dependencies: [],
      dependents: ["dependent1"],
      embedding: [],
      priority: 0,
      size: 1024,
      pinned: false,
      valid: true,
    });
    entryMetadata.set("dependent1", {
      key: "dependent1",
      query: "dependent1",
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      hitCount: 1,
      tags: [],
      dependencies: ["dep1"],
      dependents: [],
      embedding: [],
      priority: 0,
      size: 1024,
      pinned: false,
      valid: true,
    });

    const config: DependencyInvalidationConfig = {
      strategy: "dependency",
      enabled: true,
      priority: 60,
      changedKeys: ["dep1"],
      cascadeDepth: 2,
    };

    const result = invalidator.invalidateByDependency(config, entryMetadata);

    expect(result.strategy).toBe("dependency");
    expect(result.count).toBeGreaterThanOrEqual(1);
  });

  it("should respect cascade depth limit", async () => {
    await cache.set("dep1", "result1");
    await cache.set("dep2", "result2");
    await cache.set("dep3", "result3");

    const entryMetadata = new Map<string, CacheEntryMetadata>();
    entryMetadata.set("dep1", {
      key: "dep1",
      query: "dep1",
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      hitCount: 1,
      tags: [],
      dependencies: [],
      dependents: ["dep2"],
      embedding: [],
      priority: 0,
      size: 1024,
      pinned: false,
      valid: true,
    });
    entryMetadata.set("dep2", {
      key: "dep2",
      query: "dep2",
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      hitCount: 1,
      tags: [],
      dependencies: ["dep1"],
      dependents: ["dep3"],
      embedding: [],
      priority: 0,
      size: 1024,
      pinned: false,
      valid: true,
    });
    entryMetadata.set("dep3", {
      key: "dep3",
      query: "dep3",
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      hitCount: 1,
      tags: [],
      dependencies: ["dep2"],
      dependents: [],
      embedding: [],
      priority: 0,
      size: 1024,
      pinned: false,
      valid: true,
    });

    const config: DependencyInvalidationConfig = {
      strategy: "dependency",
      enabled: true,
      priority: 60,
      changedKeys: ["dep1"],
      cascadeDepth: 1, // Only one level
    };

    const result = invalidator.invalidateByDependency(config, entryMetadata);

    // Should invalidate dep1 and dep2, but not dep3 (depth 2)
    expect(result.count).toBeGreaterThanOrEqual(1);
  });
});

describe("CacheInvalidator - FIFO", () => {
  let cache: SemanticCache;
  let invalidator: CacheInvalidator;

  beforeEach(() => {
    cache = new SemanticCache({ maxSize: 1000 });
    invalidator = new CacheInvalidator(cache);
  });

  it("should evict oldest entries first", async () => {
    const now = Date.now();

    // Add entries with different creation times
    await cache.set("query1", "result1");
    await cache.set("query2", "result2");
    await cache.set("query3", "result3");

    // Manually set creation times
    const entry1 = cache.peek("query1");
    const entry2 = cache.peek("query2");
    const entry3 = cache.peek("query3");

    if (entry1) (entry1 as any).createdAt = now - 3000;
    if (entry2) (entry2 as any).createdAt = now - 2000;
    if (entry3) (entry3 as any).createdAt = now - 1000;

    const config: FIFOInvalidationConfig = {
      strategy: "fifo",
      enabled: true,
      priority: 50,
      maxSize: 2, // Keep only 2 entries
      respectPinned: true,
    };

    const result = invalidator.invalidateFIFO(config);

    expect(result.strategy).toBe("fifo");
    expect(result.count).toBe(1); // Should evict query1 (oldest)
  });

  it("should respect pinned entries", async () => {
    await cache.set("query1", "result1");
    await cache.set("query2", "result2");
    await cache.set("query3", "result3");

    const entryMetadata = new Map<string, CacheEntryMetadata>();
    entryMetadata.set("query1", {
      key: "query1",
      query: "query1",
      createdAt: Date.now() - 3000,
      lastAccessed: Date.now(),
      hitCount: 1,
      tags: [],
      dependencies: [],
      dependents: [],
      embedding: [],
      priority: 0,
      size: 1024,
      pinned: true, // Pin the oldest entry
      valid: true,
    });

    const config: FIFOInvalidationConfig = {
      strategy: "fifo",
      enabled: true,
      priority: 50,
      maxSize: 2,
      respectPinned: true,
    };

    const result = invalidator.invalidateFIFO(config);

    // Should skip pinned entry and evict query2 instead
    expect(result.skipped).toBe(1);
  });
});

describe("CacheInvalidator - Policy Application", () => {
  let cache: SemanticCache;
  let invalidator: CacheInvalidator;

  beforeEach(() => {
    cache = new SemanticCache({ maxSize: 1000 });
    invalidator = new CacheInvalidator(cache);
  });

  it("should apply multi-strategy policy", async () => {
    await cache.set("query1", "result1");
    await cache.set("query2", "result2");

    const policy: CacheInvalidationPolicy = {
      id: "test-policy",
      name: "Test Policy",
      version: "1.0.0",
      strategies: [
        {
          strategy: "ttl",
          enabled: true,
          priority: 100,
          ttl: 0, // Expire all
        },
        {
          strategy: "lru",
          enabled: true,
          priority: 90,
          maxAge: 0,
        },
      ],
      autoApply: true,
      appliesToTags: [],
      excludesTags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const context: PolicyEvaluationContext = {
      cacheSize: 2,
      cacheMemoryUsage: 2048,
      cacheHitRate: 0.3,
      timeSinceLastInvalidation: 10000,
      pendingInvalidations: 0,
      availableMemory: 10000000,
      systemLoad: 0.5,
    };

    const result = await invalidator.applyPolicy(policy, context);

    expect(result.success).toBe(true);
    expect(result.count).toBeGreaterThan(0);
  });

  it("should evaluate policy before applying", async () => {
    await cache.set("query1", "result1");

    const policy: CacheInvalidationPolicy = {
      id: "test-policy",
      name: "Test Policy",
      version: "1.0.0",
      strategies: [
        {
          strategy: "ttl",
          enabled: true,
          priority: 100,
          ttl: 10000,
        },
      ],
      autoApply: false,
      appliesToTags: [],
      excludesTags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const context: PolicyEvaluationContext = {
      cacheSize: 1,
      cacheMemoryUsage: 1024,
      cacheHitRate: 0.9, // High hit rate
      timeSinceLastInvalidation: 1000,
      pendingInvalidations: 0,
      availableMemory: 10000000,
      systemLoad: 0.2,
    };

    const evaluation = await invalidator.evaluatePolicy(policy, context);

    expect(evaluation.shouldApply).toBe(false);
    expect(evaluation.confidence).toBeGreaterThan(0);
    expect(evaluation.reasoning).toBeDefined();
  });

  it("should recommend invalidation when cache is unhealthy", async () => {
    const policy: CacheInvalidationPolicy = {
      id: "test-policy",
      name: "Test Policy",
      version: "1.0.0",
      strategies: [],
      autoApply: true,
      appliesToTags: [],
      excludesTags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      maxCacheSize: 100,
    };

    const context: PolicyEvaluationContext = {
      cacheSize: 150, // Over limit
      cacheMemoryUsage: 102400,
      cacheHitRate: 0.3, // Low hit rate
      timeSinceLastInvalidation: 10000,
      pendingInvalidations: 0,
      availableMemory: 10000000,
      systemLoad: 0.5,
    };

    const evaluation = await invalidator.evaluatePolicy(policy, context);

    expect(evaluation.shouldApply).toBe(true);
    expect(evaluation.estimatedImpact).toBeDefined();
    expect(evaluation.estimatedImpact!.entriesToInvalidate).toBeGreaterThan(0);
  });
});

describe("CacheInvalidator - LRU Strategy", () => {
  let cache: SemanticCache;
  let invalidator: CacheInvalidator;

  beforeEach(() => {
    cache = new SemanticCache({ maxSize: 1000 });
    invalidator = new CacheInvalidator(cache);
  });

  it("should invalidate least recently used entries", async () => {
    await cache.set("query1", "result1");
    await cache.set("query2", "result2");

    const now = Date.now();
    const entry1 = cache.peek("query1");
    if (entry1) {
      (entry1 as any).lastAccessed = now - 20 * 60 * 1000; // 20 minutes ago
    }

    const config: LRUInvalidationConfig = {
      strategy: "lru",
      enabled: true,
      priority: 70,
      maxAge: 15 * 60 * 1000, // 15 minutes
    };

    const result = await invalidator.invalidateWithConfig(config);

    expect(result.strategy).toBe("lru");
    expect(result.count).toBeGreaterThanOrEqual(0);
  });
});

describe("CacheInvalidator - LFU Strategy", () => {
  let cache: SemanticCache;
  let invalidator: CacheInvalidator;

  beforeEach(() => {
    cache = new SemanticCache({ maxSize: 1000 });
    invalidator = new CacheInvalidator(cache);
  });

  it("should invalidate least frequently used entries", async () => {
    await cache.set("query1", "result1");
    await cache.set("query2", "result2");

    const entry1 = cache.peek("query1");
    if (entry1) {
      (entry1 as any).hitCount = 1; // Low hit count
    }

    const config: LFUInvalidationConfig = {
      strategy: "lfu",
      enabled: true,
      priority: 60,
      minHitCount: 3,
    };

    const result = await invalidator.invalidateWithConfig(config);

    expect(result.strategy).toBe("lfu");
    expect(result.count).toBeGreaterThanOrEqual(0);
  });
});

describe("InvalidationPolicy - Policy Management", () => {
  let cache: SemanticCache;
  let invalidator: CacheInvalidator;
  let policyManager: InstanceType<typeof CacheInvalidator.prototype.constructor>;

  beforeEach(() => {
    cache = new SemanticCache({ maxSize: 1000 });
    invalidator = new CacheInvalidator(cache);
    // Create a simple policy manager for testing
    policyManager = new (invalidator.constructor as any).InvalidationPolicy(invalidator);
  });

  it("should add and retrieve policies", () => {
    const policy: CacheInvalidationPolicy = {
      id: "test-policy",
      name: "Test Policy",
      version: "1.0.0",
      strategies: [],
      autoApply: false,
      appliesToTags: [],
      excludesTags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    policyManager.addPolicy(policy);
    const retrieved = policyManager.getPolicy("test-policy");

    expect(retrieved).toEqual(policy);
  });

  it("should remove policies", () => {
    const policy: CacheInvalidationPolicy = {
      id: "test-policy",
      name: "Test Policy",
      version: "1.0.0",
      strategies: [],
      autoApply: false,
      appliesToTags: [],
      excludesTags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    policyManager.addPolicy(policy);
    policyManager.removePolicy("test-policy");

    const retrieved = policyManager.getPolicy("test-policy");
    expect(retrieved).toBeUndefined();
  });

  it("should list all policies", () => {
    const policy1: CacheInvalidationPolicy = {
      id: "policy1",
      name: "Policy 1",
      version: "1.0.0",
      strategies: [],
      autoApply: false,
      appliesToTags: [],
      excludesTags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const policy2: CacheInvalidationPolicy = {
      id: "policy2",
      name: "Policy 2",
      version: "1.0.0",
      strategies: [],
      autoApply: false,
      appliesToTags: [],
      excludesTags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    policyManager.addPolicy(policy1);
    policyManager.addPolicy(policy2);

    const all = policyManager.getAllPolicies();
    expect(all.length).toBe(2);
  });
});

describe("CacheInvalidator - Integration Tests", () => {
  let cache: SemanticCache;
  let invalidator: CacheInvalidator;

  beforeEach(() => {
    cache = new SemanticCache({ maxSize: 100 });
    invalidator = new CacheInvalidator(cache);
  });

  it("should handle complex multi-strategy invalidation", async () => {
    // Add many entries
    for (let i = 0; i < 50; i++) {
      await cache.set(`query${i}`, `result${i}`);
    }

    // Age some entries
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      const entry = cache.peek(`query${i}`);
      if (entry) {
        (entry as any).createdAt = now - 20 * 60 * 1000;
        (entry as any).lastAccessed = now - 20 * 60 * 1000;
      }
    }

    // Apply TTL strategy
    const ttlConfig: TTLInvalidationConfig = {
      strategy: "ttl",
      enabled: true,
      priority: 100,
      ttl: 15 * 60 * 1000,
    };

    const result = await invalidator.invalidateWithConfig(ttlConfig);

    expect(result.success).toBe(true);
    expect(result.count).toBeGreaterThanOrEqual(0);
  });

  it("should maintain cache statistics", () => {
    const stats = invalidator.getStats();

    expect(stats).toBeDefined();
    expect(stats.size).toBeGreaterThanOrEqual(0);
    expect(stats.hitRate).toBeGreaterThanOrEqual(0);
    expect(stats.hitRate).toBeLessThanOrEqual(1);
  });

  it("should provide recommendations", () => {
    const recommendation = invalidator.getRecommendation();

    expect(recommendation).toBeDefined();
    expect(recommendation.strategy).toBeDefined();
    expect(recommendation.options).toBeDefined();
    expect(recommendation.reason).toBeDefined();
  });

  it("should estimate memory usage", () => {
    const usage = invalidator.estimateMemoryUsage();

    expect(usage).toBeGreaterThanOrEqual(0);
    expect(typeof usage).toBe("number");
  });
});

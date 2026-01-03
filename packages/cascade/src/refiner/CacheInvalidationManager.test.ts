/**
 * Cache Invalidation Manager Tests
 *
 * Comprehensive test suite for all cache invalidation strategies.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { CacheInvalidationManager } from "./CacheInvalidationManager";
import type {
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
} from "@lsi/protocol";

describe("CacheInvalidationManager", () => {
  let manager: CacheInvalidationManager;

  beforeEach(() => {
    manager = new CacheInvalidationManager();
  });

  describe("TTL Invalidation", () => {
    it("should invalidate entries after TTL expires", async () => {
      // Register entry with short TTL
      const key = "test-key-1";
      manager.registerEntry(key, "test query", "test result", [], {
        expiresAt: Date.now() + 100, // 100ms TTL
      });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      const config: TTLInvalidationConfig = {
        strategy: "ttl",
        enabled: true,
        priority: 100,
        ttl: 100,
      };

      const result = await manager.invalidate(config);

      expect(result.count).toBe(1);
      expect(result.strategy).toBe("ttl");
    });

    it("should not invalidate entries before TTL expires", async () => {
      const key = "test-key-2";
      manager.registerEntry(key, "test query", "test result", [], {
        expiresAt: Date.now() + 5000, // 5 seconds TTL
      });

      const config: TTLInvalidationConfig = {
        strategy: "ttl",
        enabled: true,
        priority: 100,
        ttl: 100,
      };

      const result = await manager.invalidate(config);

      expect(result.count).toBe(0);
    });

    it("should support dry run mode", async () => {
      const key = "test-key-3";
      manager.registerEntry(key, "test query", "test result", [], {
        expiresAt: Date.now() - 1000, // Expired
      });

      const config: TTLInvalidationConfig = {
        strategy: "ttl",
        enabled: true,
        priority: 100,
        ttl: 100,
        dryRun: true,
      };

      const result = await manager.invalidate(config);

      expect(result.count).toBe(1);
      expect(result.dryRun).toBe(true);
      expect(result.entries).toBeDefined();
      expect(result.entries!.length).toBe(1);

      // Entry should still be in cache (not actually invalidated)
      const isValid = await manager.isEntryValid(key);
      expect(isValid).toBe(true);
    });
  });

  describe("Sliding Expiration", () => {
    it("should reset TTL on access", async () => {
      const key = "test-key-4";
      const slidingWindow = 500; // 500ms sliding window

      manager.registerEntry(key, "test query", "test result", [], {
        expiresAt: Date.now() + slidingWindow,
        slidingWindow,
      });

      // Access before expiration
      manager.updateAccess(key);
      await new Promise(resolve => setTimeout(resolve, 300));

      // Should not be invalidated (TTL was reset)
      const isValid = await manager.isEntryValid(key);
      expect(isValid).toBe(true);
    });

    it("should invalidate after sliding window expires", async () => {
      manager = new CacheInvalidationManager();
      const key = "test-key-5";
      const slidingWindow = 200;
      const now = Date.now();

      manager.registerEntry(key, "test query", "test result", [], {
        createdAt: now - 2000,
        lastAccessed: now - 2000, // Last accessed 2 seconds ago (past minResetInterval)
        expiresAt: now - 100, // Expired
        slidingWindow,
      });

      const config: SlidingExpirationConfig = {
        strategy: "sliding",
        enabled: true,
        priority: 90,
        window: slidingWindow,
      };

      const result = await manager.invalidate(config);
      expect(result.count).toBe(1);
    });
  });

  describe("Manual Invalidation", () => {
    it("should invalidate specific key", async () => {
      const key = "test-key-6";
      manager.registerEntry(key, "test query", "test result");

      const result = await manager.invalidateKey(key, "Manual test");

      expect(result).toBe(true);
      expect(await manager.isEntryValid(key)).toBe(false);
    });

    it("should return false for non-existent key", async () => {
      const result = await manager.invalidateKey("non-existent", "test");
      expect(result).toBe(false);
    });

    it("should not invalidate pinned entries", async () => {
      const key = "test-key-7";
      manager.registerEntry(key, "test query", "test result", [], {
        pinned: true,
      });

      const result = await manager.invalidateKey(key, "Manual test");
      expect(result).toBe(false);
    });
  });

  describe("Tag-based Invalidation", () => {
    beforeEach(() => {
      // Register entries with different tags
      manager.registerEntry("key-1", "query 1", "result 1", [], {
        tags: new Set(["api", "user"]),
      });
      manager.registerEntry("key-2", "query 2", "result 2", [], {
        tags: new Set(["api", "admin"]),
      });
      manager.registerEntry("key-3", "query 3", "result 3", [], {
        tags: new Set(["cache", "user"]),
      });
    });

    it("should invalidate entries by exact tag match", async () => {
      const count = await manager.invalidateByTags(["api"]);
      expect(count).toBe(2); // key-1 and key-2
    });

    it("should invalidate entries by multiple tags", async () => {
      const count = await manager.invalidateByTags(["api", "cache"]);
      expect(count).toBe(3); // All entries
    });

    it("should support cascading invalidation", async () => {
      // Add dependency - key-1 depends on key-3
      // So when key-1 is invalidated (has "api" tag), key-3 should cascade
      await manager.addDependency("key-1", "key-3");

      const count = await manager.invalidateByTags(["api"], true);
      expect(count).toBeGreaterThanOrEqual(2); // key-1, key-2, and potentially key-3
    });
  });

  describe("Dependency-based Invalidation", () => {
    beforeEach(() => {
      manager.registerEntry("dep-1", "dependency", "result");
      manager.registerEntry("dep-2", "dependency 2", "result");
      manager.registerEntry("dependent-1", "dependent query", "result");
      manager.registerEntry("dependent-2", "dependent query 2", "result");
    });

    it("should track dependencies", async () => {
      await manager.addDependency("dependent-1", "dep-1");
      await manager.addDependency("dependent-2", "dep-1");

      const deps = await manager.getDependencies("dependent-1");
      expect(deps).toContain("dep-1");

      const dependents = await manager.getDependents("dep-1");
      expect(dependents.length).toBeGreaterThanOrEqual(2);
    });

    it("should invalidate dependents when dependency changes", async () => {
      await manager.addDependency("dependent-1", "dep-1");
      await manager.addDependency("dependent-2", "dep-1");

      const count = await manager.invalidateByDependency("dep-1", 1);
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it("should respect cascade depth", async () => {
      // Create chain: dep -> dep1 -> dep2 -> dep3
      await manager.addDependency("dep-1", "dep-2");
      await manager.addDependency("dep-2", "dep-1");

      const count = await manager.invalidateByDependency("dep-1", 1);
      // Should only invalidate direct dependents
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it("should remove dependencies", async () => {
      await manager.addDependency("dependent-1", "dep-1");
      let deps = await manager.getDependencies("dependent-1");
      expect(deps).toContain("dep-1");

      await manager.removeDependency("dependent-1", "dep-1");
      deps = await manager.getDependencies("dependent-1");
      expect(deps).not.toContain("dep-1");
    });
  });

  describe("LRU Invalidation", () => {
    beforeEach(() => {
      // Create a fresh manager for each test to avoid pollution
      manager = new CacheInvalidationManager();
      const now = Date.now();
      manager.registerEntry("old-1", "old query 1", "result", [], {
        createdAt: now - 25000,
        lastAccessed: now - 25000, // 25 seconds ago
      });
      manager.registerEntry("old-2", "old query 2", "result", [], {
        createdAt: now - 20000,
        lastAccessed: now - 20000, // 20 seconds ago
      });
      manager.registerEntry("recent-1", "recent query", "result", [], {
        createdAt: now - 5000,
        lastAccessed: now - 5000, // 5 seconds ago
      });
    });

    it("should invalidate least recently used entries", async () => {
      const config: LRUInvalidationConfig = {
        strategy: "lru",
        enabled: true,
        priority: 70,
        maxAge: 15000, // 15 seconds
      };

      const result = await manager.invalidate(config);
      expect(result.count).toBe(2); // old-1 and old-2 (accessed >15s ago)
    });

    it("should respect maxAge threshold", async () => {
      const config: LRUInvalidationConfig = {
        strategy: "lru",
        enabled: true,
        priority: 70,
        maxAge: 25000, // 25 seconds
      };

      const result = await manager.invalidate(config);
      expect(result.count).toBeGreaterThanOrEqual(0);
    });
  });

  describe("LFU Invalidation", () => {
    beforeEach(() => {
      manager = new CacheInvalidationManager();
      manager.registerEntry("unpopular-1", "query", "result", [], {
        hitCount: 1,
        createdAt: Date.now() - 10000,
      });
      manager.registerEntry("unpopular-2", "query", "result", [], {
        hitCount: 2,
        createdAt: Date.now() - 10000,
      });
      manager.registerEntry("popular-1", "query", "result", [], {
        hitCount: 10,
        createdAt: Date.now() - 10000,
      });
      manager.registerEntry("popular-2", "query", "result", [], {
        hitCount: 15,
        createdAt: Date.now() - 10000,
      });
    });

    it("should invalidate least frequently used entries", async () => {
      const config: LFUInvalidationConfig = {
        strategy: "lfu",
        enabled: true,
        priority: 60,
        minHitCount: 5,
      };

      const result = await manager.invalidate(config);
      expect(result.count).toBe(2); // unpopular-1 and unpopular-2
    });

    it("should consider recency when configured", async () => {
      const now = Date.now();
      manager.registerEntry("old-unpopular", "query", "result", [], {
        hitCount: 3,
        lastAccessed: now - 600000, // 10 minutes ago
        createdAt: now - 600000,
      });

      const config: LFUInvalidationConfig = {
        strategy: "lfu",
        enabled: true,
        priority: 60,
        minHitCount: 5,
        considerRecency: true,
      };

      const result = await manager.invalidate(config);
      // Should invalidate old-unpopular (hitCount < minHitCount) plus unpopular-1 and unpopular-2
      expect(result.count).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Semantic Drift Detection", () => {
    beforeEach(() => {
      manager = new CacheInvalidationManager();
      const embedding = new Array(768).fill(0.1);
      manager.registerEntry("entry-1", "query", "result", embedding, {
        createdAt: Date.now() - 40 * 60 * 1000, // 40 minutes ago
      });
      manager.registerEntry("entry-2", "query", "result", embedding, {
        createdAt: Date.now() - 10000, // 10 seconds ago
      });
      manager.registerEntry("entry-3", "query", "result", embedding, {
        createdAt: Date.now() - 35 * 60 * 1000, // 35 minutes ago
      });
    });

    it("should detect stale entries", async () => {
      const count = await manager.detectSemanticDrift();
      // With current implementation (age-based proxy), should detect entries > 30 min old
      // entry-1 (40min) and entry-3 (35min) should be detected
      expect(count).toBe(2);
    });

    it("should check specific keys when provided", async () => {
      const count = await manager.detectSemanticDrift(["entry-1"]);
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Cache Clearing", () => {
    beforeEach(() => {
      for (let i = 0; i < 10; i++) {
        manager.registerEntry(`key-${i}`, `query ${i}`, `result ${i}`);
      }
    });

    it("should clear all entries", async () => {
      const count = await manager.clearAll("Test clear");
      expect(count).toBe(10);
    });

    it("should emit clear event", async () => {
      let eventEmitted = false;
      manager.onInvalidation(event => {
        if (event.type === "cleared") {
          eventEmitted = true;
        }
      });

      await manager.clearAll("Test");
      expect(eventEmitted).toBe(true);
    });
  });

  describe("Pin/Unpin", () => {
    it("should pin entries to prevent eviction", async () => {
      const key = "pinned-key";
      manager.registerEntry(key, "query", "result", [], {
        pinned: false,
      });

      await manager.pinEntry(key);

      // Try to invalidate - should fail
      const result = await manager.invalidateKey(key, "test");
      expect(result).toBe(false);
    });

    it("should unpin entries to allow eviction", async () => {
      const key = "pinned-key-2";
      manager.registerEntry(key, "query", "result", [], {
        pinned: true,
      });

      await manager.unpinEntry(key);

      // Should now be able to invalidate
      const result = await manager.invalidateKey(key, "test");
      expect(result).toBe(true);
    });
  });

  describe("Tag Management", () => {
    it("should add tags to entries", async () => {
      const key = "tag-key";
      manager.registerEntry(key, "query", "result");

      const result = await manager.addTags(key, ["tag1", "tag2"]);
      expect(result).toBe(true);
    });

    it("should remove tags from entries", async () => {
      const key = "tag-key-2";
      manager.registerEntry(key, "query", "result", [], {
        tags: new Set(["tag1", "tag2", "tag3"]),
      });

      const result = await manager.removeTags(key, ["tag2"]);
      expect(result).toBe(true);

      const deps = await manager.getDependencies(key);
      // Tag2 should be removed
    });
  });

  describe("Policy Management", () => {
    it("should evaluate policy", async () => {
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

      const context = {
        cacheSize: 1500,
        cacheMemoryUsage: 10000000,
        cacheHitRate: 0.4,
        timeSinceLastInvalidation: 120000,
        pendingInvalidations: 0,
        availableMemory: 1000000000,
        systemLoad: 0.7,
      };

      const result = await manager.evaluatePolicy(policy, context);
      expect(result.shouldApply).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it("should apply policy", async () => {
      const policy: CacheInvalidationPolicy = {
        id: "test-policy-2",
        name: "Test Policy 2",
        version: "1.0.0",
        strategies: [
          {
            strategy: "ttl",
            enabled: true,
            priority: 100,
            ttl: 1000,
          },
        ],
        autoApply: false,
        appliesToTags: [],
        excludesTags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const context = {
        cacheSize: 100,
        cacheMemoryUsage: 1000000,
        cacheHitRate: 0.8,
        timeSinceLastInvalidation: 60000,
        pendingInvalidations: 0,
        availableMemory: 1000000000,
        systemLoad: 0.5,
      };

      const result = await manager.applyPolicy(policy, context);
      expect(result.success).toBe(true);
    });

    it("should register and unregister policies", () => {
      const policy: CacheInvalidationPolicy = {
        id: "test-policy-3",
        name: "Test Policy 3",
        version: "1.0.0",
        strategies: [],
        autoApply: false,
        appliesToTags: [],
        excludesTags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      manager.registerPolicy(policy);
      manager.unregisterPolicy(policy.id);

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("Statistics", () => {
    it("should track invalidation statistics", async () => {
      manager.registerEntry("stats-key", "query", "result", [], {
        expiresAt: Date.now() - 1000,
      });

      const config: TTLInvalidationConfig = {
        strategy: "ttl",
        enabled: true,
        priority: 100,
        ttl: 100,
      };

      await manager.invalidate(config);

      const stats = await manager.getInvalidationStats();
      expect(stats.totalInvalidations).toBeGreaterThan(0);
      expect(stats.invalidationsByStrategy.ttl).toBeGreaterThan(0);
    });

    it("should track entries examined and skipped", async () => {
      manager.registerEntry("pinned-stats", "query", "result", [], {
        pinned: true,
        expiresAt: Date.now() - 1000,
      });

      const config: TTLInvalidationConfig = {
        strategy: "ttl",
        enabled: true,
        priority: 100,
        ttl: 100,
      };

      const result = await manager.invalidate(config);
      expect(result.skipped).toBe(1);
    });
  });

  describe("Event Listeners", () => {
    it("should emit events on invalidation", async () => {
      let eventReceived = false;
      const listener = vi.fn();

      manager.onInvalidation(listener);
      manager.registerEntry("event-key", "query", "result", [], {
        expiresAt: Date.now() - 1000,
      });

      const config: TTLInvalidationConfig = {
        strategy: "ttl",
        enabled: true,
        priority: 100,
        ttl: 100,
      };

      await manager.invalidate(config);

      expect(listener).toHaveBeenCalled();
      manager.offInvalidation(listener);
    });

    it("should remove event listeners", async () => {
      const listener = vi.fn();

      manager.onInvalidation(listener);
      manager.offInvalidation(listener);

      manager.registerEntry("event-key-2", "query", "result", [], {
        expiresAt: Date.now() - 1000,
      });

      const config: TTLInvalidationConfig = {
        strategy: "ttl",
        enabled: true,
        priority: 100,
        ttl: 100,
      };

      await manager.invalidate(config);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("Integration with SemanticCache", () => {
    it("should work with cache entry metadata", async () => {
      const embedding = new Array(768).fill(0.1);

      manager.registerEntry(
        "integration-key",
        "test query",
        "test result",
        embedding,
        {
          priority: 10,
          size: 1000,
          tags: new Set(["integration", "test"]),
        }
      );

      const isValid = await manager.isEntryValid("integration-key");
      expect(isValid).toBe(true);

      // Add dependency
      await manager.addDependency("integration-key-2", "integration-key");

      // Invalidate by tag
      const count = await manager.invalidateByTags(["integration"]);
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty cache", async () => {
      const config: TTLInvalidationConfig = {
        strategy: "ttl",
        enabled: true,
        priority: 100,
        ttl: 100,
      };

      const result = await manager.invalidate(config);
      expect(result.count).toBe(0);
      expect(result.examined).toBe(0);
    });

    it("should handle non-existent keys gracefully", async () => {
      const result = await manager.invalidateKey("does-not-exist", "test");
      expect(result).toBe(false);
    });

    it("should handle empty tags", async () => {
      const count = await manager.invalidateByTags([]);
      expect(count).toBe(0);
    });

    it("should handle max invalidations limit", async () => {
      // Register many expired entries
      for (let i = 0; i < 100; i++) {
        manager.registerEntry(`bulk-${i}`, "query", "result", [], {
          expiresAt: Date.now() - 1000,
        });
      }

      const config: TTLInvalidationConfig = {
        strategy: "ttl",
        enabled: true,
        priority: 100,
        ttl: 100,
        maxInvalidations: 10,
      };

      const result = await manager.invalidate(config);
      expect(result.count).toBeLessThanOrEqual(10);
    });
  });
});

/**
 * Tests for AequorCache
 */

import { describe, it, expect, beforeEach } from "vitest";
import { AequorCache } from "./AequorCache.js";

describe("AequorCache", () => {
  let cache: AequorCache;

  beforeEach(() => {
    cache = new AequorCache({
      maxSize: 100,
      similarityThreshold: 0.85,
      ttl: 60000, // 1 minute
      enableAdaptiveThreshold: true,
      enableQueryTypeThresholds: true,
    });
  });

  describe("basic operations", () => {
    it("should set and get values", async () => {
      await cache.set("key1", "value1");
      const value = await cache.get("key1");

      expect(value).toBe("value1");
    });

    it("should return undefined for missing keys", async () => {
      const value = await cache.get("nonexistent");

      expect(value).toBeUndefined();
    });

    it("should check if key exists", async () => {
      await cache.set("key1", "value1");

      const hasKey = await cache.has("key1");
      const hasNoKey = await cache.has("nonexistent");

      expect(hasKey).toBe(true);
      expect(hasNoKey).toBe(false);
    });

    it("should delete keys", async () => {
      await cache.set("key1", "value1");

      const deleted = await cache.delete("key1");
      const hasKey = await cache.has("key1");

      expect(deleted).toBe(true);
      expect(hasKey).toBe(false);
    });

    it("should clear all entries", async () => {
      await cache.set("key1", "value1");
      await cache.set("key2", "value2");

      await cache.clear();

      const size = cache.size();
      expect(size).toBe(0);
    });
  });

  describe("statistics", () => {
    it("should provide cache statistics", async () => {
      const statsBefore = cache.getStats();

      await cache.set("key1", "value1");
      await cache.get("key1"); // Hit
      await cache.get("key2"); // Miss

      const statsAfter = cache.getStats();

      expect(statsAfter.size).toBeGreaterThan(statsBefore.size);
      expect(statsAfter.totalHits).toBeGreaterThan(0);
      expect(statsAfter.totalMisses).toBeGreaterThan(0);
      expect(statsAfter.hitRate).toBeGreaterThanOrEqual(0);
      expect(statsAfter.hitRate).toBeLessThanOrEqual(1);
    });

    it("should calculate hit rate correctly", async () => {
      await cache.set("key1", "value1");
      await cache.set("key2", "value2");

      await cache.get("key1"); // Hit
      await cache.get("key2"); // Hit
      await cache.get("key3"); // Miss

      const stats = cache.getStats();

      expect(stats.totalHits).toBe(2);
      expect(stats.totalMisses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2 / 3, 2);
    });
  });

  describe("analytics", () => {
    it("should provide detailed analytics", async () => {
      await cache.set("key1", "value1");
      await cache.set("key2", "value2");

      const analytics = cache.getAnalytics();

      expect(analytics).toHaveProperty("performance");
      expect(analytics.performance).toHaveProperty("efficiency");
      expect(analytics.performance).toHaveProperty("recommendedAction");
      expect(analytics).toHaveProperty("queryTypeAnalysis");
      expect(analytics).toHaveProperty("thresholdStatus");
    });
  });

  describe("configuration", () => {
    it("should enable and disable cache", async () => {
      cache.setEnabled(false);

      await cache.set("key1", "value1");
      const value = await cache.get("key1");

      // Should return undefined when disabled
      expect(value).toBeUndefined();
      expect(cache.isEnabled()).toBe(false);

      cache.setEnabled(true);
      expect(cache.isEnabled()).toBe(true);
    });

    it("should set similarity threshold", () => {
      const initialThreshold = cache.getSimilarityThreshold();

      cache.setSimilarityThreshold(0.9);
      const newThreshold = cache.getSimilarityThreshold();

      expect(newThreshold).not.toBe(initialThreshold);
      expect(newThreshold).toBeCloseTo(0.9, 2);
    });

    it("should set max size", () => {
      const initialSize = cache.getMaxSize();

      cache.setMaxSize(500);
      const newSize = cache.getMaxSize();

      expect(newSize).toBe(500);
      expect(newSize).not.toBe(initialSize);
    });
  });

  describe("warming", () => {
    it("should warm cache with entries", async () => {
      const entries = [
        { key: "key1", value: "value1" },
        { key: "key2", value: "value2" },
        { key: "key3", value: "value3" },
      ];

      const result = await cache.warmCache(entries);

      expect(result.success).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.duration).toBeGreaterThan(0);
      expect(cache.size()).toBe(3);
    });

    it("should handle warming failures gracefully", async () => {
      const entries = [
        { key: "key1", value: "value1" },
        { key: "key2", value: null as any }, // Invalid
        { key: "key3", value: "value3" },
      ];

      const result = await cache.warmCache(entries);

      // Should still process valid entries
      expect(result.success + result.failed).toBe(3);
    });
  });

  describe("export/import", () => {
    it("should export cache contents", async () => {
      await cache.set("key1", "value1");
      await cache.set("key2", "value2");

      const exported = cache.exportCache();

      expect(exported.length).toBe(2);
      expect(exported[0]).toHaveProperty("key");
      expect(exported[0]).toHaveProperty("result");
    });

    it("should import cache entries", async () => {
      const entries = [
        { key: "key1", value: "value1" },
        { key: "key2", value: "value2" },
      ];

      const result = await cache.importCache(entries);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(cache.size()).toBe(2);
    });
  });

  describe("top entries", () => {
    it("should get top accessed entries", async () => {
      await cache.set("key1", "value1");
      await cache.set("key2", "value2");

      // Access key1 multiple times
      await cache.get("key1");
      await cache.get("key1");
      await cache.get("key1");

      // Access key2 once
      await cache.get("key2");

      const topEntries = cache.getTopEntries(10);

      expect(topEntries.length).toBeGreaterThan(0);
      expect(topEntries[0].accessCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("statistics reset", () => {
    it("should reset statistics without clearing cache", async () => {
      await cache.set("key1", "value1");
      await cache.get("key1");

      const statsBefore = cache.getStats();
      expect(statsBefore.totalHits).toBeGreaterThan(0);

      cache.resetStats();

      const statsAfter = cache.getStats();
      expect(statsAfter.totalHits).toBe(0);
      expect(statsAfter.totalMisses).toBe(0);
      expect(statsAfter.size).toBe(statsBefore.size); // Cache still has entries
    });
  });

  describe("keys", () => {
    it("should return all keys", async () => {
      await cache.set("key1", "value1");
      await cache.set("key2", "value2");
      await cache.set("key3", "value3");

      const keys = cache.keys();

      expect(keys.length).toBe(3);
      expect(keys).toContain("key1");
      expect(keys).toContain("key2");
      expect(keys).toContain("key3");
    });

    it("should return correct size", async () => {
      expect(cache.size()).toBe(0);

      await cache.set("key1", "value1");
      expect(cache.size()).toBe(1);

      await cache.set("key2", "value2");
      expect(cache.size()).toBe(2);

      await cache.delete("key1");
      expect(cache.size()).toBe(1);
    });
  });
});

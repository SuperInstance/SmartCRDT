/**
 * Tests for TokenBucketRateLimiter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TokenBucketRateLimiter } from "../TokenBucket.js";

describe("TokenBucketRateLimiter", () => {
  let limiter: TokenBucketRateLimiter;

  beforeEach(() => {
    // Use a fixed time for predictable tests
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Constructor", () => {
    it("should create a limiter with default configuration", () => {
      limiter = new TokenBucketRateLimiter({
        maxRequests: 100,
        windowMs: 60000,
        refillRate: 10,
        burstCapacity: 20,
      });

      const stats = limiter.getStats();
      expect(stats.currentCount).toBe(20); // Full bucket
      expect(stats.maxRequests).toBe(100);
    });

    it("should use maxRequests as burstCapacity if not specified", () => {
      limiter = new TokenBucketRateLimiter({
        maxRequests: 50,
        windowMs: 60000,
        refillRate: 10,
      });

      const config = limiter.getConfig();
      expect(config.burstCapacity).toBe(50);
    });
  });

  describe("canMakeRequest", () => {
    beforeEach(() => {
      limiter = new TokenBucketRateLimiter({
        maxRequests: 10,
        windowMs: 60000,
        refillRate: 1, // 1 token per second
        burstCapacity: 5,
      });
    });

    it("should allow requests when bucket has tokens", async () => {
      const canMake = await limiter.canMakeRequest();
      expect(canMake).toBe(true);
    });

    it("should deny requests when bucket is empty", async () => {
      // Exhaust all tokens
      for (let i = 0; i < 5; i++) {
        limiter.recordRequest();
      }

      const canMake = await limiter.canMakeRequest();
      expect(canMake).toBe(false);
    });

    it("should refill tokens over time", async () => {
      // Exhaust all tokens
      for (let i = 0; i < 5; i++) {
        limiter.recordRequest();
      }

      // Should be empty
      expect(await limiter.canMakeRequest()).toBe(false);

      // Advance time by 2 seconds (should get 2 tokens)
      vi.advanceTimersByTime(2000);

      // Should have tokens now
      expect(await limiter.canMakeRequest()).toBe(true);
    });

    it("should not exceed burst capacity", async () => {
      // Advance time by 100 seconds (would overfill)
      vi.advanceTimersByTime(100000);

      // Should still be capped at burst capacity
      const stats = limiter.getStats();
      expect(stats.currentCount).toBe(5); // burstCapacity
    });

    it("should have sync version that works identically", async () => {
      const canMakeAsync = await limiter.canMakeRequest();
      const canMakeSync = limiter.canMakeRequestSync();

      expect(canMakeSync).toBe(canMakeAsync);
    });
  });

  describe("recordRequest", () => {
    beforeEach(() => {
      limiter = new TokenBucketRateLimiter({
        maxRequests: 10,
        windowMs: 60000,
        refillRate: 1,
        burstCapacity: 5,
      });
    });

    it("should consume one token per request", () => {
      const statsBefore = limiter.getStats();
      limiter.recordRequest();
      const statsAfter = limiter.getStats();

      expect(statsAfter.currentCount).toBe(statsBefore.currentCount - 1);
      expect(statsAfter.requestsMade).toBe(statsBefore.requestsMade + 1);
    });

    it("should increment requestsLimited when bucket is empty", () => {
      // Exhaust all tokens
      for (let i = 0; i < 5; i++) {
        limiter.recordRequest();
      }

      const statsBefore = limiter.getStats();
      limiter.recordRequest(); // Try to record when empty
      const statsAfter = limiter.getStats();

      expect(statsAfter.requestsLimited).toBe(statsBefore.requestsLimited + 1);
    });
  });

  describe("getWaitTime", () => {
    beforeEach(() => {
      limiter = new TokenBucketRateLimiter({
        maxRequests: 10,
        windowMs: 60000,
        refillRate: 10, // 10 tokens per second = 1 token per 100ms
        burstCapacity: 5,
      });
    });

    it("should return 0 when bucket has tokens", () => {
      const waitTime = limiter.getWaitTime();
      expect(waitTime).toBe(0);
    });

    it("should calculate wait time based on refill rate", () => {
      // Exhaust all tokens
      for (let i = 0; i < 5; i++) {
        limiter.recordRequest();
      }

      const waitTime = limiter.getWaitTime();
      expect(waitTime).toBeGreaterThan(0);
      expect(waitTime).toBeLessThanOrEqual(100); // 1 token at 10/sec = 100ms
    });
  });

  describe("getStats", () => {
    beforeEach(() => {
      limiter = new TokenBucketRateLimiter({
        maxRequests: 100,
        windowMs: 60000,
        refillRate: 10,
        burstCapacity: 20,
      });
    });

    it("should return current statistics", () => {
      limiter.recordRequest();
      limiter.recordRequest();

      const stats = limiter.getStats();

      expect(stats.requestsMade).toBe(2);
      expect(stats.requestsLimited).toBe(0);
      expect(stats.currentCount).toBe(18); // 20 - 2
      expect(stats.maxRequests).toBe(100);
      expect(stats.windowMs).toBe(60000);
      expect(stats.resetTime).toBeGreaterThan(Date.now());
    });

    it("should track limited requests", () => {
      // Exhaust bucket
      for (let i = 0; i < 20; i++) {
        limiter.recordRequest();
      }

      // Try to record more
      limiter.recordRequest();
      limiter.recordRequest();

      const stats = limiter.getStats();
      expect(stats.requestsLimited).toBe(2);
    });
  });

  describe("reset", () => {
    it("should reset the limiter to initial state", () => {
      limiter = new TokenBucketRateLimiter({
        maxRequests: 100,
        windowMs: 60000,
        refillRate: 10,
        burstCapacity: 20,
      });

      // Use some tokens
      for (let i = 0; i < 5; i++) {
        limiter.recordRequest();
      }

      // Reset
      limiter.reset();

      const stats = limiter.getStats();
      expect(stats.currentCount).toBe(20); // Full bucket again
      expect(stats.requestsMade).toBe(0);
      expect(stats.requestsLimited).toBe(0);
    });
  });

  describe("Configuration", () => {
    it("should get current configuration", () => {
      limiter = new TokenBucketRateLimiter({
        maxRequests: 100,
        windowMs: 60000,
        refillRate: 10,
        burstCapacity: 20,
      });

      const config = limiter.getConfig();
      expect(config.maxRequests).toBe(100);
      expect(config.refillRate).toBe(10);
      expect(config.burstCapacity).toBe(20);
    });

    it("should update configuration", () => {
      limiter = new TokenBucketRateLimiter({
        maxRequests: 100,
        windowMs: 60000,
        refillRate: 10,
        burstCapacity: 20,
      });

      limiter.updateConfig({
        refillRate: 20,
        burstCapacity: 30,
      });

      const config = limiter.getConfig();
      expect(config.refillRate).toBe(20);
      expect(config.burstCapacity).toBe(30);
      expect(config.maxRequests).toBe(100); // Unchanged
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle burst traffic followed by sustained rate", async () => {
      limiter = new TokenBucketRateLimiter({
        maxRequests: 100,
        windowMs: 60000,
        refillRate: 1, // 1 token per second
        burstCapacity: 10,
      });

      // Simulate burst of 10 requests
      const burstResults = [];
      for (let i = 0; i < 10; i++) {
        burstResults.push(await limiter.canMakeRequest());
        limiter.recordRequest();
      }

      expect(burstResults.every(r => r === true)).toBe(true);

      // Next request should be denied
      expect(await limiter.canMakeRequest()).toBe(false);

      // Wait 1 second, get 1 token back
      vi.advanceTimersByTime(1000);
      expect(await limiter.canMakeRequest()).toBe(true);
    });

    it("should handle gradual refill accurately", async () => {
      limiter = new TokenBucketRateLimiter({
        maxRequests: 100,
        windowMs: 60000,
        refillRate: 10, // 10 tokens per second
        burstCapacity: 20,
      });

      // Exhaust bucket
      for (let i = 0; i < 20; i++) {
        limiter.recordRequest();
      }

      expect(await limiter.canMakeRequest()).toBe(false);

      // Wait 500ms - should get 5 tokens
      vi.advanceTimersByTime(500);
      let stats = limiter.getStats();
      expect(stats.currentCount).toBe(5);

      // Wait another 500ms - should get 5 more
      vi.advanceTimersByTime(500);
      stats = limiter.getStats();
      expect(stats.currentCount).toBe(10);
    });
  });
});

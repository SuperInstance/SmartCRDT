/**
 * Tests for SlidingWindowRateLimiter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SlidingWindowRateLimiter } from "../SlidingWindow.js";

describe("SlidingWindowRateLimiter", () => {
  let limiter: SlidingWindowRateLimiter;

  beforeEach(() => {
    // Use a fixed time for predictable tests
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Constructor", () => {
    it("should create a limiter with specified configuration", () => {
      limiter = new SlidingWindowRateLimiter({
        maxRequests: 100,
        windowMs: 60000,
      });

      const stats = limiter.getStats();
      expect(stats.currentCount).toBe(0);
      expect(stats.maxRequests).toBe(100);
      expect(stats.windowMs).toBe(60000);
    });
  });

  describe("canMakeRequest", () => {
    beforeEach(() => {
      limiter = new SlidingWindowRateLimiter({
        maxRequests: 5,
        windowMs: 10000, // 10 seconds
      });
    });

    it("should allow requests when under limit", async () => {
      const canMake = await limiter.canMakeRequest();
      expect(canMake).toBe(true);
    });

    it("should allow requests up to maxRequests", async () => {
      // Make exactly maxRequests
      for (let i = 0; i < 5; i++) {
        expect(await limiter.canMakeRequest()).toBe(true);
        limiter.recordRequest();
      }
    });

    it("should deny requests when at limit", async () => {
      // Fill to limit
      for (let i = 0; i < 5; i++) {
        limiter.recordRequest();
      }

      const canMake = await limiter.canMakeRequest();
      expect(canMake).toBe(false);
    });

    it("should allow requests after old ones expire", async () => {
      // Fill to limit
      for (let i = 0; i < 5; i++) {
        limiter.recordRequest();
      }

      expect(await limiter.canMakeRequest()).toBe(false);

      // Advance time past window
      vi.advanceTimersByTime(11000);

      // Should allow requests again
      expect(await limiter.canMakeRequest()).toBe(true);
    });

    it("should have sync version that works identically", async () => {
      const canMakeAsync = await limiter.canMakeRequest();
      const canMakeSync = limiter.canMakeRequestSync();

      expect(canMakeSync).toBe(canMakeAsync);
    });
  });

  describe("recordRequest", () => {
    beforeEach(() => {
      limiter = new SlidingWindowRateLimiter({
        maxRequests: 5,
        windowMs: 10000,
      });
    });

    it("should track requests in current window", () => {
      limiter.recordRequest();
      limiter.recordRequest();

      const stats = limiter.getStats();
      expect(stats.requestsMade).toBe(2);
      expect(stats.currentCount).toBe(2);
    });

    it("should track limited requests", () => {
      // Fill to limit
      for (let i = 0; i < 5; i++) {
        limiter.recordRequest();
      }

      const statsBefore = limiter.getStats();
      limiter.recordRequest(); // This should be limited
      const statsAfter = limiter.getStats();

      expect(statsAfter.requestsLimited).toBe(statsBefore.requestsLimited + 1);
      expect(statsAfter.currentCount).toBe(5); // Still at max
    });
  });

  describe("getWaitTime", () => {
    beforeEach(() => {
      limiter = new SlidingWindowRateLimiter({
        maxRequests: 5,
        windowMs: 10000,
      });
    });

    it("should return 0 when under limit", () => {
      const waitTime = limiter.getWaitTime();
      expect(waitTime).toBe(0);
    });

    it("should calculate wait time until oldest request expires", () => {
      // Make some requests at different times
      limiter.recordRequest();
      vi.advanceTimersByTime(1000);
      limiter.recordRequest();
      vi.advanceTimersByTime(1000);
      limiter.recordRequest();
      vi.advanceTimersByTime(1000);
      limiter.recordRequest();
      vi.advanceTimersByTime(1000);
      limiter.recordRequest();

      // Should be at limit now
      expect(limiter.canMakeRequestSync()).toBe(false);

      // Oldest request was at time 3000, window is 10s
      // So we should wait until time 13000, current time is 4000
      const waitTime = limiter.getWaitTime();
      expect(waitTime).toBeGreaterThan(0);
      expect(waitTime).toBeLessThanOrEqual(10000);
    });

    it("should return 0 after waiting calculated time", () => {
      // Fill to limit
      for (let i = 0; i < 5; i++) {
        limiter.recordRequest();
      }

      const waitTime = limiter.getWaitTime();
      expect(waitTime).toBeGreaterThan(0);

      // Wait the calculated time
      vi.advanceTimersByTime(waitTime + 100); // Add small buffer

      // Should be able to make request now
      expect(limiter.getWaitTime()).toBe(0);
      expect(limiter.canMakeRequestSync()).toBe(true);
    });
  });

  describe("getStats", () => {
    beforeEach(() => {
      limiter = new SlidingWindowRateLimiter({
        maxRequests: 100,
        windowMs: 60000,
      });
    });

    it("should return current statistics", () => {
      limiter.recordRequest();
      limiter.recordRequest();

      const stats = limiter.getStats();

      expect(stats.requestsMade).toBe(2);
      expect(stats.currentCount).toBe(2);
      expect(stats.maxRequests).toBe(100);
      expect(stats.windowMs).toBe(60000);
    });

    it("should correctly count requests in sliding window", () => {
      // Create a new limiter with a shorter window for this test
      limiter = new SlidingWindowRateLimiter({
        maxRequests: 100,
        windowMs: 6000, // 6 second window
      });

      // Make 5 requests spread over time
      limiter.recordRequest();
      vi.advanceTimersByTime(1000);
      limiter.recordRequest();
      vi.advanceTimersByTime(1000);
      limiter.recordRequest();
      vi.advanceTimersByTime(1000);
      limiter.recordRequest();
      vi.advanceTimersByTime(1000);
      limiter.recordRequest();

      let stats = limiter.getStats();
      expect(stats.currentCount).toBe(5);

      // Advance time to expire first 2 requests
      // At time 4000ms, advance 2100ms to time 6100ms
      // WindowStart = 6100 - 6000 = 100ms
      // So only requests after 100ms are valid (times 1000, 2000, 3000, 4000)
      vi.advanceTimersByTime(2100);

      stats = limiter.getStats();
      expect(stats.currentCount).toBe(4); // Last 4 in window
    });
  });

  describe("reset", () => {
    it("should clear all request history", () => {
      limiter = new SlidingWindowRateLimiter({
        maxRequests: 100,
        windowMs: 60000,
      });

      // Make some requests
      for (let i = 0; i < 10; i++) {
        limiter.recordRequest();
      }

      const statsBefore = limiter.getStats();
      expect(statsBefore.requestsMade).toBe(10);

      // Reset
      limiter.reset();

      const statsAfter = limiter.getStats();
      expect(statsAfter.requestsMade).toBe(0);
      expect(statsAfter.currentCount).toBe(0);
      expect(statsAfter.requestsLimited).toBe(0);
    });
  });

  describe("Configuration", () => {
    it("should get current configuration", () => {
      limiter = new SlidingWindowRateLimiter({
        maxRequests: 100,
        windowMs: 60000,
      });

      const config = limiter.getConfig();
      expect(config.maxRequests).toBe(100);
      expect(config.windowMs).toBe(60000);
    });

    it("should update configuration and reset state", () => {
      limiter = new SlidingWindowRateLimiter({
        maxRequests: 100,
        windowMs: 60000,
      });

      // Make some requests
      limiter.recordRequest();
      limiter.recordRequest();

      // Update config
      limiter.updateConfig({
        maxRequests: 50,
        windowMs: 30000,
      });

      const config = limiter.getConfig();
      expect(config.maxRequests).toBe(50);
      expect(config.windowMs).toBe(30000);

      // State should be reset
      const stats = limiter.getStats();
      expect(stats.requestsMade).toBe(0);
    });
  });

  describe("Sliding window behavior", () => {
    it("should accurately slide the window", async () => {
      limiter = new SlidingWindowRateLimiter({
        maxRequests: 3,
        windowMs: 5000,
      });

      // Time: 0ms - Make 3 requests
      limiter.recordRequest();
      vi.advanceTimersByTime(1000);
      limiter.recordRequest();
      vi.advanceTimersByTime(1000);
      limiter.recordRequest();

      // Current time is 2000ms
      expect(limiter.canMakeRequestSync()).toBe(false);

      // Time: 4000ms (advance 2000ms more) - No requests expired yet (window is 5000ms)
      vi.advanceTimersByTime(2000);
      let stats = limiter.getStats();
      expect(stats.currentCount).toBe(3); // All still valid

      // Should still be at limit
      expect(limiter.canMakeRequestSync()).toBe(false);

      // Time: 7000ms (advance 3000ms more) - All requests should have expired
      // WindowStart = 7000 - 5000 = 2000, so only requests AFTER 2000ms valid (> 2000)
      // All our requests were at 0ms, 1000ms, and 2000ms, which are all <= 2000ms
      vi.advanceTimersByTime(3000);
      stats = limiter.getStats();
      expect(stats.currentCount).toBe(0); // All requests at or before 2000ms are expired

      // Time: 10000ms (advance 3000ms more) - All original requests expired
      // WindowStart = 10000 - 5000 = 5000, all requests were before 5000ms
      vi.advanceTimersByTime(3000);
      stats = limiter.getStats();
      expect(stats.currentCount).toBe(0);

      // Should be able to make requests again
      expect(limiter.canMakeRequestSync()).toBe(true);
    });

    it("should handle requests at different times correctly", async () => {
      limiter = new SlidingWindowRateLimiter({
        maxRequests: 10,
        windowMs: 10000,
      });

      // Make 5 requests at time 0
      for (let i = 0; i < 5; i++) {
        limiter.recordRequest();
      }

      // Advance to 5 seconds
      vi.advanceTimersByTime(5000);

      // Make 5 more requests
      for (let i = 0; i < 5; i++) {
        limiter.recordRequest();
      }

      // At time 5s, should have 5 from time 0 + 5 from time 5s = 10 total
      let stats = limiter.getStats();
      expect(stats.currentCount).toBe(10);

      // At limit
      expect(limiter.canMakeRequestSync()).toBe(false);

      // Advance to 11 seconds (first 5 requests expired)
      vi.advanceTimersByTime(6000);

      stats = limiter.getStats();
      expect(stats.currentCount).toBe(5); // Only last 5 remain

      // Can make requests again
      expect(limiter.canMakeRequestSync()).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("should handle very small windows", async () => {
      limiter = new SlidingWindowRateLimiter({
        maxRequests: 1,
        windowMs: 100, // 100ms window
      });

      // Make request
      limiter.recordRequest();
      expect(limiter.canMakeRequestSync()).toBe(false);

      // Wait 101ms
      vi.advanceTimersByTime(101);

      // Should be able to make request
      expect(limiter.canMakeRequestSync()).toBe(true);
    });

    it("should handle maxRequests of 1", async () => {
      limiter = new SlidingWindowRateLimiter({
        maxRequests: 1,
        windowMs: 10000,
      });

      // First request
      expect(limiter.canMakeRequestSync()).toBe(true);
      limiter.recordRequest();

      // Second request should be denied
      expect(limiter.canMakeRequestSync()).toBe(false);

      // After window expires
      vi.advanceTimersByTime(11000);
      expect(limiter.canMakeRequestSync()).toBe(true);
    });
  });
});

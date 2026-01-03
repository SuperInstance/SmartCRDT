/**
 * Tests for RateLimitError
 */

import { describe, it, expect } from "vitest";
import { RateLimitError, RateLimitErrorCode } from "./RateLimitError.js";
import { ErrorSeverity, RecoveryStrategy } from "./AdapterError.js";

describe("RateLimitError", () => {
  describe("rateLimitExceeded", () => {
    it("should create rate limit exceeded error", () => {
      const error = RateLimitError.rateLimitExceeded(100, 60, "global");

      expect(error.code).toBe(RateLimitErrorCode.RATE_LIMIT_EXCEEDED);
      expect(error.message).toContain("100/101");
      expect(error.message).toContain("60s");
      expect(error.rateLimit?.requestsMade).toBe(100);
      expect(error.rateLimit?.retryAfter).toBe(60);
      expect(error.rateLimit?.scope).toBe("global");
      expect(error.retryable).toBe(true);
    });

    it("should include retry strategy", () => {
      const error = RateLimitError.rateLimitExceeded(100, 60);

      expect(error.retryStrategy).toBeDefined();
      expect(error.retryStrategy?.initialDelay).toBe(60000);
      expect(error.retryStrategy?.maxRetries).toBe(3);
    });
  });

  describe("quotaExceeded", () => {
    it("should create daily quota exceeded error", () => {
      const resetsAt = Math.floor(Date.now() / 1000) + 86400;
      const error = RateLimitError.quotaExceeded(
        10000,
        10500,
        resetsAt,
        "daily"
      );

      expect(error.code).toBe(RateLimitErrorCode.DAILY_LIMIT);
      expect(error.quota?.current).toBe(10500);
      expect(error.quota?.maximum).toBe(10000);
      expect(error.quota?.remaining).toBe(-500);
      expect(error.quota?.resetsAt).toBe(resetsAt);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.retryable).toBe(false);
    });

    it("should create monthly quota exceeded error", () => {
      const resetsAt = Math.floor(Date.now() / 1000) + 2592000;
      const error = RateLimitError.quotaExceeded(
        100000,
        105000,
        resetsAt,
        "monthly"
      );

      expect(error.code).toBe(RateLimitErrorCode.MONTHLY_LIMIT);
      expect(error.quota?.resetInterval).toBe(2592000); // 30 days
    });
  });

  describe("concurrentLimit", () => {
    it("should create concurrent limit error", () => {
      const error = RateLimitError.concurrentLimit(10, 5);

      expect(error.code).toBe(RateLimitErrorCode.CONCURRENT_LIMIT);
      expect(error.message).toContain("10/5");
      expect(error.rateLimit?.requestsMade).toBe(10);
      expect(error.rateLimit?.requestsLimit).toBe(5);
      expect(error.retryable).toBe(true);
      expect(error.severity).toBe(ErrorSeverity.LOW);
    });

    it("should have fast retry strategy", () => {
      const error = RateLimitError.concurrentLimit(10, 5);

      expect(error.retryStrategy?.initialDelay).toBe(100);
      expect(error.retryStrategy?.maxRetries).toBe(10);
    });
  });

  describe("dailyLimit", () => {
    it("should create daily limit error", () => {
      const resetsAt = Math.floor(Date.now() / 1000) + 86400;
      const error = RateLimitError.dailyLimit(1000, 1100, resetsAt);

      expect(error.code).toBe(RateLimitErrorCode.DAILY_LIMIT);
      expect(error.quota?.maximum).toBe(1000);
      expect(error.quota?.current).toBe(1100);
    });
  });

  describe("monthlyLimit", () => {
    it("should create monthly limit error", () => {
      const resetsAt = Math.floor(Date.now() / 1000) + 2592000;
      const error = RateLimitError.monthlyLimit(10000, 12000, resetsAt);

      expect(error.code).toBe(RateLimitErrorCode.MONTHLY_LIMIT);
      expect(error.quota?.maximum).toBe(10000);
      expect(error.quota?.current).toBe(12000);
    });
  });

  describe("unknown", () => {
    it("should create unknown error", () => {
      const error = RateLimitError.unknown("checkLimit", "Unknown limit error");

      expect(error.code).toBe(RateLimitErrorCode.UNKNOWN_ERROR);
      expect(error.message).toContain("Unknown limit error");
      expect(error.retryable).toBe(false);
    });
  });

  describe("getWaitTime", () => {
    it("should return wait time from rate limit", () => {
      const error = RateLimitError.rateLimitExceeded(100, 120);
      expect(error.getWaitTime()).toBe(120000); // 120s in ms
    });

    it("should return wait time from quota", () => {
      const resetsAt = Math.floor(Date.now() / 1000) + 300; // 5 minutes
      const error = RateLimitError.quotaExceeded(100, 150, resetsAt);
      const waitTime = error.getWaitTime();

      expect(waitTime).toBeGreaterThan(0);
      expect(waitTime).toBeLessThanOrEqual(300000); // 5 min in ms
    });

    it("should return default wait time if no info", () => {
      const error = RateLimitError.unknown("test", "No info");
      expect(error.getWaitTime()).toBe(60000); // 60 seconds default
    });
  });

  describe("hasReset", () => {
    it("should return false if time in future", () => {
      const futureReset = Math.floor(Date.now() / 1000) + 3600;
      const error = RateLimitError.quotaExceeded(100, 150, futureReset);

      expect(error.hasReset()).toBe(false);
    });

    it("should return true if time in past", () => {
      const pastReset = Math.floor(Date.now() / 1000) - 10;
      const error = RateLimitError.quotaExceeded(100, 150, pastReset);

      expect(error.hasReset()).toBe(true);
    });
  });

  describe("getTimeUntilReset", () => {
    it("should return time until reset from quota", () => {
      const resetsAt = Math.floor(Date.now() / 1000) + 300;
      const error = RateLimitError.quotaExceeded(100, 150, resetsAt);
      const timeUntil = error.getTimeUntilReset();

      expect(timeUntil).toBeGreaterThan(0);
      expect(timeUntil).toBeLessThanOrEqual(300);
    });

    it("should return 0 if already reset", () => {
      const pastReset = Math.floor(Date.now() / 1000) - 10;
      const error = RateLimitError.quotaExceeded(100, 150, pastReset);

      expect(error.getTimeUntilReset()).toBe(0);
    });
  });

  describe("getResetTimeString", () => {
    it("should return now if already reset", () => {
      const pastReset = Math.floor(Date.now() / 1000) - 10;
      const error = RateLimitError.quotaExceeded(100, 150, pastReset);

      expect(error.getResetTimeString()).toBe("now");
    });

    it("should return seconds for small values", () => {
      const resetsAt = Math.floor(Date.now() / 1000) + 30;
      const error = RateLimitError.quotaExceeded(100, 150, resetsAt);
      const timeString = error.getResetTimeString();

      expect(timeString).toContain("second");
    });

    it("should return minutes for medium values", () => {
      const resetsAt = Math.floor(Date.now() / 1000) + 180;
      const error = RateLimitError.quotaExceeded(100, 150, resetsAt);
      const timeString = error.getResetTimeString();

      expect(timeString).toContain("minute");
    });

    it("should return hours for large values", () => {
      const resetsAt = Math.floor(Date.now() / 1000) + 7200;
      const error = RateLimitError.quotaExceeded(100, 150, resetsAt);
      const timeString = error.getResetTimeString();

      expect(timeString).toContain("hour");
    });
  });

  describe("isRecoverableByWaiting", () => {
    it("should return true for retryable rate limit", () => {
      const error = RateLimitError.rateLimitExceeded(100, 60);
      expect(error.isRecoverableByWaiting()).toBe(true);
    });

    it("should return false for quota exceeded", () => {
      const resetsAt = Math.floor(Date.now() / 1000) + 86400;
      const error = RateLimitError.quotaExceeded(100, 150, resetsAt);
      expect(error.isRecoverableByWaiting()).toBe(false);
    });
  });

  describe("getRetryStrategy", () => {
    it("should return retry strategy", () => {
      const error = RateLimitError.rateLimitExceeded(100, 60);
      const strategy = error.getRetryStrategy();

      expect(strategy).toBeDefined();
      expect(strategy?.maxRetries).toBe(3);
      expect(strategy?.backoffMultiplier).toBe(2);
    });
  });

  describe("getRateLimitDetails", () => {
    it("should return rate limit details", () => {
      const error = RateLimitError.rateLimitExceeded(100, 60, "per-api-key");
      const details = error.getRateLimitDetails();

      expect(details).toBeDefined();
      expect(details?.scope).toBe("per-api-key");
      expect(details?.retryAfter).toBe(60);
    });
  });

  describe("getQuota", () => {
    it("should return quota information", () => {
      const resetsAt = Math.floor(Date.now() / 1000) + 86400;
      const error = RateLimitError.quotaExceeded(10000, 10500, resetsAt);
      const quota = error.getQuota();

      expect(quota).toBeDefined();
      expect(quota?.current).toBe(10500);
      expect(quota?.maximum).toBe(10000);
      expect(quota?.remaining).toBe(-500);
    });
  });
});

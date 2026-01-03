/**
 * Integration tests for OllamaAdapter rate limiting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import { OllamaAdapter, OllamaAdapterError } from "../OllamaAdapter.js";
import { TokenBucketRateLimiter } from "../../ratelimit/TokenBucket.js";
import { SlidingWindowRateLimiter } from "../../ratelimit/SlidingWindow.js";
import { RateLimitError } from "../../ratelimit/RateLimiter.js";
import type { RoutingDecision } from "@lsi/protocol";

// Mock axios
vi.mock("axios");

describe("OllamaAdapter Rate Limiting", () => {
  let adapter: OllamaAdapter;
  let mockAxiosInstance: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    // Create mock axios instance
    mockAxiosInstance = {
      post: vi.fn(),
      get: vi.fn(),
      defaults: {
        timeout: 30000,
        baseURL: "http://localhost:11434",
      },
    };

    // Mock axios.create to return our mock instance
    vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("with TokenBucketRateLimiter", () => {
    let rateLimiter: TokenBucketRateLimiter;

    beforeEach(() => {
      rateLimiter = new TokenBucketRateLimiter({
        maxRequests: 5,
        windowMs: 60000,
        refillRate: 1, // 1 token per second
        burstCapacity: 3, // Allow burst of 3
      });

      adapter = new OllamaAdapter(
        "http://localhost:11434",
        "llama2",
        undefined,
        rateLimiter
      );

      // Mock successful response
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          response: "Test response",
          model: "llama2",
          eval_count: 100,
        },
      });
    });

    it("should allow requests within burst capacity", async () => {
      const decision: RoutingDecision = {
        backend: "local",
        model: "llama2",
        confidence: 1.0,
        reason: "Test",
        appliedPrinciples: [],
      };

      // Make 3 requests (burst capacity)
      for (let i = 0; i < 3; i++) {
        const result = await adapter.execute(decision, "Test prompt");
        expect(result.content).toBe("Test response");
      }

      // Should have recorded 3 requests
      const stats = adapter.getRateLimitStats();
      expect(stats?.requestsMade).toBe(3);
    });

    it("should throw RateLimitError when burst exhausted", async () => {
      const decision: RoutingDecision = {
        backend: "local",
        model: "llama2",
        confidence: 1.0,
        reason: "Test",
        appliedPrinciples: [],
      };

      // Exhaust burst capacity
      for (let i = 0; i < 3; i++) {
        await adapter.execute(decision, "Test prompt");
      }

      // Next request should be rate limited
      await expect(adapter.execute(decision, "Test prompt")).rejects.toThrow(
        RateLimitError
      );

      // Check it's a RateLimitError with wait time
      try {
        await adapter.execute(decision, "Test prompt");
        expect.fail("Should have thrown RateLimitError");
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        if (error instanceof RateLimitError) {
          expect(error.waitTime).toBeGreaterThan(0);
          expect(error.stats.requestsMade).toBe(3);
          expect(error.getFormattedMessage()).toContain("Wait");
        }
      }
    });

    it("should allow requests after token refill", async () => {
      const decision: RoutingDecision = {
        backend: "local",
        model: "llama2",
        confidence: 1.0,
        reason: "Test",
        appliedPrinciples: [],
      };

      // Exhaust burst capacity
      for (let i = 0; i < 3; i++) {
        await adapter.execute(decision, "Test prompt");
      }

      // Should be rate limited
      await expect(adapter.execute(decision, "Test prompt")).rejects.toThrow(
        RateLimitError
      );

      // Wait for token refill (1 second per token)
      vi.advanceTimersByTime(1000);

      // Should be able to make request again
      const result = await adapter.execute(decision, "Test prompt");
      expect(result.content).toBe("Test response");
    });
  });

  describe("with SlidingWindowRateLimiter", () => {
    let rateLimiter: SlidingWindowRateLimiter;

    beforeEach(() => {
      rateLimiter = new SlidingWindowRateLimiter({
        maxRequests: 3,
        windowMs: 5000,
      });

      adapter = new OllamaAdapter(
        "http://localhost:11434",
        "llama2",
        undefined,
        rateLimiter
      );

      // Mock successful response
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          response: "Test response",
          model: "llama2",
          eval_count: 100,
        },
      });
    });

    it("should allow requests within sliding window limit", async () => {
      const decision: RoutingDecision = {
        backend: "local",
        model: "llama2",
        confidence: 1.0,
        reason: "Test",
        appliedPrinciples: [],
      };

      // Make 3 requests (at limit)
      for (let i = 0; i < 3; i++) {
        const result = await adapter.execute(decision, "Test prompt");
        expect(result.content).toBe("Test response");
      }

      // Should have recorded 3 requests
      const stats = adapter.getRateLimitStats();
      expect(stats?.requestsMade).toBe(3);
    });

    it("should throw RateLimitError when window is full", async () => {
      const decision: RoutingDecision = {
        backend: "local",
        model: "llama2",
        confidence: 1.0,
        reason: "Test",
        appliedPrinciples: [],
      };

      // Fill window
      for (let i = 0; i < 3; i++) {
        await adapter.execute(decision, "Test prompt");
      }

      // Next request should be rate limited
      await expect(adapter.execute(decision, "Test prompt")).rejects.toThrow(
        RateLimitError
      );
    });

    it("should allow requests after window slides", async () => {
      const decision: RoutingDecision = {
        backend: "local",
        model: "llama2",
        confidence: 1.0,
        reason: "Test",
        appliedPrinciples: [],
      };

      // Fill window
      for (let i = 0; i < 3; i++) {
        await adapter.execute(decision, "Test prompt");
      }

      // Wait for window to slide
      vi.advanceTimersByTime(5100);

      // Should be able to make request again
      const result = await adapter.execute(decision, "Test prompt");
      expect(result.content).toBe("Test response");
    });
  });

  describe("without rate limiter", () => {
    beforeEach(() => {
      // Create adapter without rate limiter
      adapter = new OllamaAdapter("http://localhost:11434", "llama2");

      // Mock successful response
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          response: "Test response",
          model: "llama2",
          eval_count: 100,
        },
      });
    });

    it("should allow unlimited requests", async () => {
      const decision: RoutingDecision = {
        backend: "local",
        model: "llama2",
        confidence: 1.0,
        reason: "Test",
        appliedPrinciples: [],
      };

      // Make many requests
      for (let i = 0; i < 100; i++) {
        const result = await adapter.execute(decision, "Test prompt");
        expect(result.content).toBe("Test response");
      }

      // No rate limiter stats
      const stats = adapter.getRateLimitStats();
      expect(stats).toBeNull();
    });
  });

  describe("Rate limiter management", () => {
    beforeEach(() => {
      adapter = new OllamaAdapter("http://localhost:11434", "llama2");

      // Mock successful response
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          response: "Test response",
          model: "llama2",
          eval_count: 100,
        },
      });
    });

    it("should allow setting rate limiter after creation", async () => {
      const decision: RoutingDecision = {
        backend: "local",
        model: "llama2",
        confidence: 1.0,
        reason: "Test",
        appliedPrinciples: [],
      };

      // Make request without rate limiter
      const result1 = await adapter.execute(decision, "Test prompt");
      expect(result1.content).toBe("Test response");
      expect(adapter.getRateLimitStats()).toBeNull();

      // Add rate limiter
      const rateLimiter = new TokenBucketRateLimiter({
        maxRequests: 5,
        windowMs: 60000,
        refillRate: 1,
        burstCapacity: 2,
      });
      adapter.setRateLimiter(rateLimiter);

      // Make requests with rate limiter
      await adapter.execute(decision, "Test prompt");
      await adapter.execute(decision, "Test prompt");

      const stats = adapter.getRateLimitStats();
      expect(stats?.requestsMade).toBe(2);
    });

    it("should allow removing rate limiter", async () => {
      const decision: RoutingDecision = {
        backend: "local",
        model: "llama2",
        confidence: 1.0,
        reason: "Test",
        appliedPrinciples: [],
      };

      const rateLimiter = new TokenBucketRateLimiter({
        maxRequests: 5,
        windowMs: 60000,
        refillRate: 1,
        burstCapacity: 1,
      });
      adapter.setRateLimiter(rateLimiter);

      // Make one request (exhausts burst)
      await adapter.execute(decision, "Test prompt");

      // Should be rate limited
      await expect(adapter.execute(decision, "Test prompt")).rejects.toThrow(
        RateLimitError
      );

      // Remove rate limiter
      adapter.setRateLimiter(null);

      // Should be able to make requests again
      const result = await adapter.execute(decision, "Test prompt");
      expect(result.content).toBe("Test response");
    });

    it("should return current rate limiter", () => {
      expect(adapter.getRateLimiter()).toBeNull();

      const rateLimiter = new TokenBucketRateLimiter({
        maxRequests: 5,
        windowMs: 60000,
        refillRate: 1,
        burstCapacity: 2,
      });
      adapter.setRateLimiter(rateLimiter);

      expect(adapter.getRateLimiter()).toBe(rateLimiter);
    });
  });

  describe("process method with rate limiting", () => {
    beforeEach(() => {
      const rateLimiter = new TokenBucketRateLimiter({
        maxRequests: 5,
        windowMs: 60000,
        refillRate: 1,
        burstCapacity: 2,
      });

      adapter = new OllamaAdapter(
        "http://localhost:11434",
        "llama2",
        undefined,
        rateLimiter
      );

      // Mock successful response
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          response: "Test response",
          model: "llama2",
          eval_count: 100,
        },
      });
    });

    it("should respect rate limits in process method", async () => {
      // Make 2 requests (exhausts burst)
      const result1 = await adapter.process("Test prompt 1");
      const result2 = await adapter.process("Test prompt 2");

      expect(result1.content).toBe("Test response");
      expect(result2.content).toBe("Test response");

      // Third request should be rate limited
      await expect(adapter.process("Test prompt 3")).rejects.toThrow(
        RateLimitError
      );
    });
  });

  describe("RateLimitError details", () => {
    beforeEach(() => {
      const rateLimiter = new TokenBucketRateLimiter({
        maxRequests: 5,
        windowMs: 60000,
        refillRate: 1,
        burstCapacity: 1,
      });

      adapter = new OllamaAdapter(
        "http://localhost:11434",
        "llama2",
        undefined,
        rateLimiter
      );

      // Mock successful response
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          response: "Test response",
          model: "llama2",
          eval_count: 100,
        },
      });
    });

    it("should include informative error message", async () => {
      const decision: RoutingDecision = {
        backend: "local",
        model: "llama2",
        confidence: 1.0,
        reason: "Test",
        appliedPrinciples: [],
      };

      // Exhaust burst
      await adapter.execute(decision, "Test prompt");

      try {
        await adapter.execute(decision, "Test prompt");
        expect.fail("Should have thrown RateLimitError");
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        if (error instanceof RateLimitError) {
          expect(error.message).toContain("Rate limit exceeded");
          expect(error.waitTime).toBeGreaterThan(0);
          expect(error.stats).toBeDefined();
          expect(error.stats.maxRequests).toBe(5);
          expect(error.stats.currentCount).toBe(0);
          expect(error.getFormattedMessage()).toContain("second");
        }
      }
    });
  });
});

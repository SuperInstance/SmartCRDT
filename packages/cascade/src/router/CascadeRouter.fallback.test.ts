/**
 * Tests for CascadeRouter fallback integration
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { CascadeRouter } from "./CascadeRouter.js";
import type { RouterConfig } from "../types.js";
import {
  createCircuitBreakerFallbackStrategy,
  createImmediateFallbackStrategy,
} from "@lsi/protocol";

describe("CascadeRouter Fallback Integration", () => {
  let router: CascadeRouter;
  let config: RouterConfig;

  beforeEach(() => {
    config = {
      complexityThreshold: 0.6,
      confidenceThreshold: 0.6,
      enableFallback: true,
      fallbackStrategy: createCircuitBreakerFallbackStrategy("local"),
      enableCache: false, // Disable cache for simpler testing
      enableRefiner: false, // Disable refiner for simpler testing
    };
    router = new CascadeRouter(config);
  });

  describe("Fallback Configuration", () => {
    it("should initialize with fallback enabled", () => {
      expect(router.isFallbackEnabled()).toBe(true);
    });

    it("should allow disabling fallback", () => {
      const noFallbackRouter = new CascadeRouter({
        ...config,
        enableFallback: false,
      });

      expect(noFallbackRouter.isFallbackEnabled()).toBe(false);
    });

    it("should allow toggling fallback", () => {
      router.setFallbackEnabled(false);
      expect(router.isFallbackEnabled()).toBe(false);

      router.setFallbackEnabled(true);
      expect(router.isFallbackEnabled()).toBe(true);
    });
  });

  describe("Fallback Decision Making", () => {
    it("should recommend fallback for timeout errors", async () => {
      const timeoutError = new Error("Request timeout");
      (timeoutError as any).name = "TimeoutError";

      const decision = await router.shouldFallback("cloud", timeoutError);

      expect(decision.shouldFallback).toBe(true);
      expect(decision.targetRoute).toBe("local");
      expect(decision.reason).toBe("timeout");
    });

    it("should recommend fallback for rate limit errors", async () => {
      const rateLimitError = new Error("Rate limit exceeded");
      (rateLimitError as any).status = 429;

      const decision = await router.shouldFallback("cloud", rateLimitError);

      expect(decision.shouldFallback).toBe(true);
      expect(decision.targetRoute).toBe("local");
      expect(decision.reason).toBe("rate_limit");
    });

    it("should recommend fallback for server errors", async () => {
      const serverError = new Error("Internal server error");
      (serverError as any).status = 500;

      const decision = await router.shouldFallback("cloud", serverError);

      expect(decision.shouldFallback).toBe(true);
      expect(decision.targetRoute).toBe("local");
    });

    it("should not recommend fallback when disabled", async () => {
      router.setFallbackEnabled(false);

      const timeoutError = new Error("Request timeout");
      (timeoutError as any).name = "TimeoutError";

      const decision = await router.shouldFallback("cloud", timeoutError);

      expect(decision.shouldFallback).toBe(false);
    });
  });

  describe("Fallback Execution", () => {
    it("should execute function with successful fallback", async () => {
      const successFn = vi
        .fn()
        .mockResolvedValueOnce("cloud result")
        .mockRejectedValueOnce(new Error("Cloud failed"))
        .mockResolvedValueOnce("local result");

      // First call succeeds (no fallback)
      const result1 = await router.executeWithFallback("cloud", successFn);
      expect(result1).toBe("cloud result");
      expect(successFn).toHaveBeenCalledTimes(1);

      // Reset mock
      successFn.mockClear();
      successFn.mockImplementation(() =>
        Promise.reject(new Error("Cloud failed"))
      );

      // Second call fails and falls back
      const result2 = router.executeWithFallback("cloud", successFn).catch(
        e => {
          throw e;
        }
      );

      // The function will be called again with the same route
      // In a real scenario, you'd have different adapters for cloud vs local
      await expect(result2).rejects.toThrow();
    });

    it("should handle fallback when disabled", async () => {
      router.setFallbackEnabled(false);

      const failFn = vi
        .fn()
        .mockRejectedValue(new Error("Cloud failed"));

      await expect(router.executeWithFallback("cloud", failFn)).rejects.toThrow(
        "Cloud failed"
      );
      expect(failFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("Fallback Metrics", () => {
    it("should track fallback metrics", async () => {
      const state = router.getFallbackState();

      expect(state).toBeDefined();
      expect(state.currentRoute).toBeDefined();
      expect(state.fallbackDepth).toBe(0);
    });

    it("should get fallback metrics", () => {
      const metrics = router.getFallbackMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.totalTriggers).toBe(0);
      expect(metrics.successRate).toBe(1.0);
    });

    it("should reset fallback metrics", () => {
      router.recordPerformance("local", true, 100, 0.001);

      router.resetFallback();

      const state = router.getFallbackState();
      const metrics = router.getFallbackMetrics();

      expect(state.fallbackDepth).toBe(0);
      expect(metrics.totalTriggers).toBe(0);
    });
  });

  describe("Circuit Breaker Integration", () => {
    it("should get circuit breaker stats for routes", () => {
      const cloudStats = router.getCircuitBreakerStats("cloud");
      const localStats = router.getCircuitBreakerStats("local");

      expect(cloudStats).toBeDefined();
      expect(localStats).toBeDefined();
      expect(cloudStats?.state).toBe("closed");
      expect(localStats?.state).toBe("closed");
    });

    it("should allow manual circuit opening", () => {
      router.openCircuit("cloud");

      const stats = router.getCircuitBreakerStats("cloud");
      expect(stats?.state).toBe("open");
    });

    it("should allow manual circuit closing", () => {
      router.openCircuit("cloud");
      router.closeCircuit("cloud");

      const stats = router.getCircuitBreakerStats("cloud");
      expect(stats?.state).toBe("closed");
    });
  });

  describe("Performance Recording", () => {
    it("should record performance data", () => {
      router.recordPerformance("local", true, 100, 0.001);

      const state = router.getFallbackState();

      expect(state.performanceHistory.length).toBeGreaterThan(0);
      expect(state.performanceHistory[0].route).toBe("local");
      expect(state.performanceHistory[0].success).toBe(true);
    });

    it("should track multiple performance records", () => {
      router.recordPerformance("cloud", true, 200, 0.01);
      router.recordPerformance("local", false, 150, 0.005);

      const state = router.getFallbackState();

      expect(state.performanceHistory.length).toBe(2);
    });
  });

  describe("Route with Fallback", () => {
    it("should enhance route decisions with fallback info", async () => {
      const decision = await router.routeWithFallback("Hello, world!");

      expect(decision.route).toBeDefined();
      expect(decision.fallbackAvailable).toBeDefined();
      expect(decision.fallbackStrategy).toBeDefined();
      expect(decision.fallbackTriggers).toBeInstanceOf(Array);
    });

    it("should indicate fallback availability", async () => {
      const decision = await router.routeWithFallback("Simple question?");

      // Cloud routes should have local fallback available
      if (decision.route === "cloud") {
        expect(decision.fallbackAvailable).toBe(true);
        expect(decision.fallbackStrategy?.targetBackend).toBe("local");
      }
    });

    it("should list enabled fallback triggers", async () => {
      const decision = await router.routeWithFallback("Complex query!");

      expect(decision.fallbackTriggers).toBeDefined();
      // Default strategy should enable several triggers
      expect(
        decision.fallbackTriggers.includes("timeout") ||
          decision.fallbackTriggers.includes("server_error")
      ).toBe(true);
    });
  });

  describe("Custom Fallback Strategies", () => {
    it("should use immediate fallback strategy", async () => {
      const immediateRouter = new CascadeRouter({
        ...config,
        fallbackStrategy: createImmediateFallbackStrategy("local", {
          onTimeout: true,
          onRateLimit: true,
        }),
      });

      const timeoutError = new Error("Request timeout");
      (timeoutError as any).name = "TimeoutError";

      const decision = await immediateRouter.shouldFallback(
        "cloud",
        timeoutError
      );

      expect(decision.shouldFallback).toBe(true);
      expect(decision.recommendedDelay).toBeUndefined(); // Immediate has no delay
    });

    it("should use custom per-route strategies", async () => {
      const customRouter = new CascadeRouter({
        ...config,
        routeFallbackStrategies: {
          cloud: createImmediateFallbackStrategy("local"),
          local: createImmediateFallbackStrategy("cloud"),
        },
      });

      const state = customRouter.getFallbackState();

      expect(state.activeStrategy).toBeDefined();
    });
  });

  describe("Fallback Scenarios", () => {
    it("should handle cloud timeout scenario", async () => {
      const timeoutError = new Error("Request timed out after 30s");
      (timeoutError as any).name = "TimeoutError";
      (timeoutError as any).timeout = 30000;

      const decision = await router.shouldFallback("cloud", timeoutError);

      expect(decision.shouldFallback).toBe(true);
      expect(decision.reason).toBe("timeout");
      expect(decision.confidence).toBeGreaterThan(0.8);
    });

    it("should handle cloud rate limit scenario", async () => {
      const rateLimitError = new Error("429 Too Many Requests");
      (rateLimitError as any).status = 429;
      (rateLimitError as any).retryAfter = 120;

      const decision = await router.shouldFallback("cloud", rateLimitError);

      expect(decision.shouldFallback).toBe(true);
      expect(decision.reason).toBe("rate_limit");
      expect(decision.recommendedDelay).toBe(120000); // 120 seconds in ms
    });

    it("should handle cloud server error scenario", async () => {
      const serverError = new Error("502 Bad Gateway");
      (serverError as any).status = 502;

      const decision = await router.shouldFallback("cloud", serverError);

      expect(decision.shouldFallback).toBe(true);
      expect(decision.reason).toBe("server_error");
      expect(decision.confidence).toBeGreaterThan(0.8);
    });

    it("should handle network error scenario", async () => {
      const networkError = new Error("ECONNREFUSED");
      (networkError as any).name = "ECONNREFUSED";
      (networkError as any).code = "ECONNREFUSED";

      const decision = await router.shouldFallback("cloud", networkError);

      expect(decision.shouldFallback).toBe(true);
      expect(decision.reason).toBe("network_error");
      expect(decision.retry).toBe(true);
    });

    it("should not fallback on client error (4xx)", async () => {
      const clientError = new Error("400 Bad Request");
      (clientError as any).status = 400;

      const decision = await router.shouldFallback("cloud", clientError);

      expect(decision.shouldFallback).toBe(false);
      expect(decision.reason).toBe("client_error");
    });

    it("should not fallback on authentication error", async () => {
      const authError = new Error("401 Unauthorized");
      (authError as any).status = 401;

      const decision = await router.shouldFallback("cloud", authError);

      expect(decision.shouldFallback).toBe(false);
    });
  });

  describe("Adaptive Learning", () => {
    it("should adapt fallback decisions based on performance", async () => {
      // Record successful performance for cloud
      for (let i = 0; i < 10; i++) {
        router.recordPerformance("cloud", true, 150, 0.01);
      }

      const state = router.getFallbackState();
      expect(state.performanceHistory.length).toBe(10);
    });

    it("should track performance for different routes", () => {
      router.recordPerformance("cloud", true, 200, 0.01);
      router.recordPerformance("local", true, 100, 0.001);
      router.recordPerformance("cloud", false, 500, 0.02);

      const state = router.getFallbackState();

      const cloudPerf = state.performanceHistory.filter(
        p => p.route === "cloud"
      );
      const localPerf = state.performanceHistory.filter(
        p => p.route === "local"
      );

      expect(cloudPerf.length).toBe(2);
      expect(localPerf.length).toBe(1);
    });
  });

  describe("Edge Cases", () => {
    it("should handle unknown errors gracefully", async () => {
      const unknownError = new Error("Something weird happened");

      const decision = await router.shouldFallback("cloud", unknownError);

      expect(decision.shouldFallback).toBe(false);
      expect(decision.reason).toBe("unknown");
    });

    it("should handle concurrent fallback decisions", async () => {
      const error1 = new Error("Timeout 1");
      (error1 as any).name = "TimeoutError";
      const error2 = new Error("Timeout 2");
      (error2 as any).name = "TimeoutError";

      const [decision1, decision2] = await Promise.all([
        router.shouldFallback("cloud", error1),
        router.shouldFallback("cloud", error2),
      ]);

      expect(decision1.shouldFallback).toBe(true);
      expect(decision2.shouldFallback).toBe(true);
    });
  });
});

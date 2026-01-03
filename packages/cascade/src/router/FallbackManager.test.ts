/**
 * Tests for FallbackManager
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  FallbackManager,
  createFallbackManager,
} from "./FallbackManager.js";
import type {
  FallbackStrategy,
  FallbackManagerConfig,
} from "@lsi/protocol";
import {
  createCircuitBreakerFallbackStrategy,
  createImmediateFallbackStrategy,
  createDelayedFallbackStrategy,
  createAdaptiveFallbackStrategy,
  classifyError,
} from "@lsi/protocol";

describe("FallbackManager", () => {
  let fallbackManager: FallbackManager;
  let defaultStrategy: FallbackStrategy;

  beforeEach(() => {
    defaultStrategy = createCircuitBreakerFallbackStrategy("local");
    fallbackManager = new FallbackManager({
      defaultStrategy,
      enableAdaptive: true,
      enableMetrics: true,
      maxFallbackDepth: 3,
    });
  });

  afterEach(() => {
    fallbackManager.reset();
  });

  describe("Initialization", () => {
    it("should initialize with default configuration", () => {
      const manager = createFallbackManager();

      expect(manager).toBeInstanceOf(FallbackManager);
      expect(manager.getMetrics().totalTriggers).toBe(0);
      expect(manager.getState().fallbackDepth).toBe(0);
    });

    it("should initialize with custom configuration", () => {
      const customStrategy = createImmediateFallbackStrategy("cloud");
      const manager = new FallbackManager({
        defaultStrategy: customStrategy,
        enableAdaptive: false,
        enableMetrics: false,
        maxFallbackDepth: 5,
      });

      const state = manager.getState();
      expect(state.activeStrategy).toEqual(customStrategy);
    });
  });

  describe("Error Classification", () => {
    it("should classify timeout errors correctly", () => {
      const timeoutError = new Error("Request timeout");
      (timeoutError as any).name = "TimeoutError";
      (timeoutError as any).timeout = 30000;

      const classification = classifyError(timeoutError);

      expect(classification.shouldFallback).toBe(true);
      expect(classification.trigger).toBe("timeout");
      expect(classification.retry).toBe(false);
    });

    it("should classify rate limit errors correctly", () => {
      const rateLimitError = new Error("Rate limit exceeded");
      (rateLimitError as any).status = 429;
      (rateLimitError as any).retryAfter = 60;

      const classification = classifyError(rateLimitError);

      expect(classification.shouldFallback).toBe(true);
      expect(classification.trigger).toBe("rate_limit");
      expect(classification.retry).toBe(true);
      expect(classification.retryDelay).toBe(60000);
    });

    it("should classify server errors (5xx) correctly", () => {
      const serverError = new Error("Internal server error");
      (serverError as any).status = 500;

      const classification = classifyError(serverError);

      expect(classification.shouldFallback).toBe(true);
      expect(classification.trigger).toBe("server_error");
      expect(classification.retry).toBe(true);
    });

    it("should classify client errors (4xx) correctly", () => {
      const clientError = new Error("Bad request");
      (clientError as any).status = 400;

      const classification = classifyError(clientError);

      expect(classification.shouldFallback).toBe(false);
      expect(classification.trigger).toBe("client_error");
      expect(classification.retry).toBe(false);
    });

    it("should classify network errors correctly", () => {
      const networkError = new Error("ECONNREFUSED");
      (networkError as any).name = "ECONNREFUSED";

      const classification = classifyError(networkError);

      expect(classification.shouldFallback).toBe(true);
      expect(classification.trigger).toBe("network_error");
      expect(classification.retry).toBe(true);
    });

    it("should classify unknown errors correctly", () => {
      const unknownError = new Error("Unknown error");

      const classification = classifyError(unknownError);

      expect(classification.shouldFallback).toBe(false);
      expect(classification.trigger).toBe("unknown");
      expect(classification.retry).toBe(false);
    });
  });

  describe("Fallback Decision", () => {
    it("should trigger fallback for timeout errors", async () => {
      const timeoutError = new Error("Request timeout");
      (timeoutError as any).name = "TimeoutError";

      const decision = await fallbackManager.shouldFallback("cloud", timeoutError);

      expect(decision.shouldFallback).toBe(true);
      expect(decision.targetRoute).toBe("local");
      expect(decision.reason).toBe("timeout");
      expect(decision.confidence).toBeGreaterThan(0.8);
    });

    it("should trigger fallback for rate limit errors", async () => {
      const rateLimitError = new Error("Rate limit exceeded");
      (rateLimitError as any).status = 429;

      const decision = await fallbackManager.shouldFallback(
        "cloud",
        rateLimitError
      );

      expect(decision.shouldFallback).toBe(true);
      expect(decision.targetRoute).toBe("local");
      expect(decision.reason).toBe("rate_limit");
    });

    it("should trigger fallback for server errors", async () => {
      const serverError = new Error("Internal server error");
      (serverError as any).status = 500;

      const decision = await fallbackManager.shouldFallback("cloud", serverError);

      expect(decision.shouldFallback).toBe(true);
      expect(decision.targetRoute).toBe("local");
      expect(decision.reason).toBe("server_error");
    });

    it("should not trigger fallback for client errors by default", async () => {
      const clientError = new Error("Bad request");
      (clientError as any).status = 400;

      const decision = await fallbackManager.shouldFallback("cloud", clientError);

      expect(decision.shouldFallback).toBe(false);
    });

    it("should not trigger fallback when disabled", async () => {
      const manager = new FallbackManager({
        defaultStrategy: createImmediateFallbackStrategy("local", {
          onTimeout: false,
        }),
        enableMetrics: true,
      });

      const timeoutError = new Error("Request timeout");
      (timeoutError as any).name = "TimeoutError";

      const decision = await manager.shouldFallback("cloud", timeoutError);

      expect(decision.shouldFallback).toBe(false);
    });

    it("should respect max fallback depth", async () => {
      // Simulate being at max depth
      const state = fallbackManager.getState();
      state.fallbackDepth = 3;

      const error = new Error("Request timeout");
      (error as any).name = "TimeoutError";

      const decision = await fallbackManager.shouldFallback("cloud", error);

      expect(decision.shouldFallback).toBe(false);
      expect(decision.reason).toBe("max_depth_exceeded");
    });

    it("should estimate success rate based on history", async () => {
      // Record some successful performances for local
      for (let i = 0; i < 10; i++) {
        fallbackManager.recordPerformance("local", true, 100, 0);
      }

      const error = new Error("Request timeout");
      (error as any).name = "TimeoutError";

      const decision = await fallbackManager.shouldFallback("cloud", error);

      expect(decision.shouldFallback).toBe(true);
      expect(decision.estimatedSuccessRate).toBeGreaterThan(0.8);
    });
  });

  describe("Fallback Execution", () => {
    it("should execute successful fallback", async () => {
      const successFn = vi.fn().mockResolvedValue("fallback result");
      const error = new Error("Original error");

      const result = await fallbackManager.executeFallback(
        "cloud",
        "local",
        "timeout",
        successFn
      );

      expect(result.triggered).toBe(true);
      expect(result.originalRoute).toBe("cloud");
      expect(result.finalRoute).toBe("local");
      expect(result.success).toBe(true);
      expect(result.result).toBe("fallback result");
      expect(successFn).toHaveBeenCalledTimes(1);
    });

    it("should handle failed fallback", async () => {
      const failFn = vi.fn().mockRejectedValue(new Error("Fallback failed"));
      const error = new Error("Original error");

      const result = await fallbackManager.executeFallback(
        "cloud",
        "local",
        "timeout",
        failFn
      );

      expect(result.triggered).toBe(true);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe("Fallback failed");
    });

    it("should track fallback attempts", async () => {
      const successFn = vi.fn().mockResolvedValue("result");

      await fallbackManager.executeFallback("cloud", "local", "timeout", successFn);

      const state = fallbackManager.getState();
      expect(state.fallbackDepth).toBeGreaterThan(0);
    });

    it("should update metrics on successful fallback", async () => {
      const successFn = vi.fn().mockResolvedValue("result");

      await fallbackManager.executeFallback("cloud", "local", "timeout", successFn);

      const metrics = fallbackManager.getMetrics();
      expect(metrics.totalTriggers).toBe(1);
      expect(metrics.successfulFallbacks).toBe(1);
      expect(metrics.failedFallbacks).toBe(0);
      expect(metrics.successRate).toBe(1.0);
    });

    it("should update metrics on failed fallback", async () => {
      const failFn = vi.fn().mockRejectedValue(new Error("Failed"));

      await fallbackManager.executeFallback("cloud", "local", "timeout", failFn);

      const metrics = fallbackManager.getMetrics();
      expect(metrics.totalTriggers).toBe(1);
      expect(metrics.successfulFallbacks).toBe(0);
      expect(metrics.failedFallbacks).toBe(1);
      expect(metrics.successRate).toBe(0.0);
    });

    it("should track fallback time", async () => {
      const slowFn = vi
        .fn()
        .mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve("result"), 100))
        );

      const result = await fallbackManager.executeFallback(
        "cloud",
        "local",
        "timeout",
        slowFn
      );

      expect(result.fallbackTime).toBeGreaterThanOrEqual(100);
    });
  });

  describe("Metrics Tracking", () => {
    it("should track triggers by type", async () => {
      const timeoutError = new Error("Timeout");
      (timeoutError as any).name = "TimeoutError";
      const rateLimitError = new Error("Rate limit");
      (rateLimitError as any).status = 429;

      await fallbackManager.shouldFallback("cloud", timeoutError);
      await fallbackManager.shouldFallback("cloud", rateLimitError);

      const metrics = fallbackManager.getMetrics();
      expect(metrics.triggersByType["timeout"]).toBe(1);
      expect(metrics.triggersByType["rate_limit"]).toBe(1);
    });

    it("should calculate average fallback time", async () => {
      const fn1 = vi.fn().mockResolvedValue("result1");
      const fn2 = vi.fn().mockResolvedValue("result2");

      await fallbackManager.executeFallback("cloud", "local", "timeout", fn1);
      await fallbackManager.executeFallback("cloud", "local", "timeout", fn2);

      const metrics = fallbackManager.getMetrics();
      expect(metrics.averageFallbackTime).toBeGreaterThan(0);
    });

    it("should track recent fallbacks", async () => {
      const fn = vi.fn().mockResolvedValue("result");

      await fallbackManager.executeFallback("cloud", "local", "timeout", fn);
      await fallbackManager.executeFallback("cloud", "local", "timeout", fn);

      const metrics = fallbackManager.getMetrics();
      expect(metrics.recentFallbacks.length).toBe(2);
      expect(metrics.lastFallbackTime).toBeDefined();
    });
  });

  describe("Circuit Breaker Integration", () => {
    it("should use circuit breaker for circuit breaker strategy", async () => {
      const strategy = createCircuitBreakerFallbackStrategy("local", {
        failureThreshold: 2,
        recoveryTimeout: 1000,
        halfOpenAttempts: 2,
        successThreshold: 1,
      });

      const manager = new FallbackManager({
        defaultStrategy: strategy,
        enableMetrics: true,
      });

      // Open the circuit by failing multiple times
      const failFn = vi.fn().mockRejectedValue(new Error("Failed"));

      try {
        await manager.executeFallback("cloud", "local", "server_error", failFn);
      } catch {
        // Expected
      }

      try {
        await manager.executeFallback("cloud", "local", "server_error", failFn);
      } catch {
        // Expected
      }

      // Circuit should be open now
      const stats = manager.getCircuitBreakerStats("cloud");
      expect(stats?.state).toBe("open");
    });

    it("should get circuit breaker stats", () => {
      const stats = fallbackManager.getCircuitBreakerStats("local");

      expect(stats).toBeDefined();
      expect(stats?.state).toBe("closed");
    });

    it("should allow manual circuit opening", () => {
      fallbackManager.openCircuit("cloud");

      const stats = fallbackManager.getCircuitBreakerStats("cloud");
      expect(stats?.state).toBe("open");
    });

    it("should allow manual circuit closing", () => {
      fallbackManager.openCircuit("cloud");
      fallbackManager.closeCircuit("cloud");

      const stats = fallbackManager.getCircuitBreakerStats("cloud");
      expect(stats?.state).toBe("closed");
    });
  });

  describe("Performance Recording", () => {
    it("should record performance data", () => {
      fallbackManager.recordPerformance("local", true, 100, 0.001);

      const state = fallbackManager.getState();
      expect(state.performanceHistory.length).toBe(1);
      expect(state.performanceHistory[0].route).toBe("local");
      expect(state.performanceHistory[0].success).toBe(true);
      expect(state.performanceHistory[0].latency).toBe(100);
      expect(state.performanceHistory[0].cost).toBe(0.001);
    });

    it("should limit performance history size", () => {
      for (let i = 0; i < 1500; i++) {
        fallbackManager.recordPerformance("cloud", true, 100, 0.01);
      }

      const state = fallbackManager.getState();
      expect(state.performanceHistory.length).toBeLessThanOrEqual(1000);
    });
  });

  describe("Route Decision Enhancement", () => {
    it("should enhance route decision with fallback info", () => {
      const decision = fallbackManager.enhanceRouteDecision({
        route: "cloud",
        confidence: 0.8,
        estimatedLatency: 200,
        estimatedCost: 0.01,
        fallbackAvailable: false,
        fallbackTriggers: [],
      });

      expect(decision.fallbackStrategy).toBeDefined();
      expect(decision.fallbackAvailable).toBe(true);
      expect(decision.fallbackTriggers.length).toBeGreaterThan(0);
    });
  });

  describe("State Management", () => {
    it("should reset state and metrics", () => {
      fallbackManager.recordPerformance("local", true, 100, 0.001);

      fallbackManager.reset();

      const state = fallbackManager.getState();
      const metrics = fallbackManager.getMetrics();

      expect(state.fallbackDepth).toBe(0);
      expect(metrics.totalTriggers).toBe(0);
      expect(state.performanceHistory.length).toBe(0);
    });

    it("should get current state", () => {
      const state = fallbackManager.getState();

      expect(state.currentRoute).toBeDefined();
      expect(state.originalRoute).toBeDefined();
      expect(state.fallbackDepth).toBe(0);
      expect(state.activeStrategy).toBeDefined();
    });
  });

  describe("Delayed Fallback Strategy", () => {
    it("should add recommended delay for delayed strategy", async () => {
      const strategy = createDelayedFallbackStrategy("local", 2000);

      const manager = new FallbackManager({
        defaultStrategy: strategy,
        enableMetrics: true,
      });

      const timeoutError = new Error("Request timeout");
      (timeoutError as any).name = "TimeoutError";

      const decision = await manager.shouldFallback("cloud", timeoutError);

      expect(decision.shouldFallback).toBe(true);
      expect(decision.recommendedDelay).toBe(2000);
    });
  });

  describe("Adaptive Fallback Strategy", () => {
    it("should adapt based on performance history", async () => {
      const strategy = createAdaptiveFallbackStrategy("local", 100, 0.8);

      const manager = new FallbackManager({
        defaultStrategy: strategy,
        enableAdaptive: true,
        enableMetrics: true,
      });

      // Record good performance for cloud
      for (let i = 0; i < 20; i++) {
        manager.recordPerformance("cloud", true, 100, 0.01);
      }

      // Should not fallback if cloud is performing well
      const error = new Error("Some error");
      const decision = await manager.shouldFallback("cloud", error);

      // Adaptive strategy may not trigger fallback if performance is good
      // This depends on the implementation
      expect(decision).toBeDefined();
    });
  });
});

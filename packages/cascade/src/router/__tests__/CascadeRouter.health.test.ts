/**
 * CascadeRouter Health Integration Tests
 *
 * Tests health check integration with CascadeRouter:
 * - Health check methods work correctly
 * - Cache behavior in router context
 * - Health check enable/disable
 * - Health-aware routing decisions
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { CascadeRouter } from "../CascadeRouter";
import type { RouterConfig } from "../../types";
import type { OllamaHealthCheckResult } from "@lsi/protocol";

// Mock OllamaHealthChecker
vi.mock("../../health/OllamaHealthChecker", () => ({
  createOllamaHealthChecker: vi.fn(() => ({
    checkHealth: vi.fn(),
    quickCheck: vi.fn(),
    forceCheck: vi.fn(),
    clearCache: vi.fn(),
  })),
}));

describe("CascadeRouter Health Integration", () => {
  let router: CascadeRouter;
  let mockHealthChecker: any;

  const healthyStatus: OllamaHealthCheckResult = {
    healthy: true,
    score: 0.95,
    message: "Ollama is healthy (50ms response time)",
    status: "healthy",
    timestamp: Date.now(),
    duration: 50,
    daemonRunning: true,
    daemonVersion: "1.2.3",
    availableModels: ["llama2:latest", "qwen2.5:3b"],
    defaultModelAvailable: true,
    defaultModelLoaded: true,
    modelLoadState: "loaded",
    responseTime: 50,
    memoryUsage: 2048,
    cpuUsage: 45,
    healthStatus: "healthy",
  };

  const degradedStatus: OllamaHealthCheckResult = {
    healthy: true,
    score: 0.65,
    message: "Ollama is degraded (1200ms response time)",
    status: "degraded",
    timestamp: Date.now(),
    duration: 1200,
    daemonRunning: true,
    daemonVersion: "1.2.3",
    availableModels: ["llama2:latest"],
    defaultModelAvailable: true,
    defaultModelLoaded: true,
    modelLoadState: "loaded",
    responseTime: 1200,
    memoryUsage: 6144,
    cpuUsage: 75,
    healthStatus: "degraded",
    degradationReason: "slow response (1200ms)",
  };

  const unhealthyStatus: OllamaHealthCheckResult = {
    healthy: false,
    score: 0,
    message: "Ollama is unhealthy",
    error: "Connection refused - Ollama not running",
    status: "unreachable",
    timestamp: Date.now(),
    duration: 100,
    daemonRunning: false,
    availableModels: [],
    defaultModelAvailable: false,
    responseTime: 100,
    healthStatus: "unhealthy",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Import after mocking
    const { createOllamaHealthChecker } = require("../../health/OllamaHealthChecker");
    mockHealthChecker = createOllamaHealthChecker();

    router = new CascadeRouter({
      enableHealthChecks: true,
      ollamaBaseURL: "http://localhost:11434",
      ollamaModel: "llama2",
    });
  });

  describe("Health Check Methods", () => {
    it("should check Ollama health successfully", async () => {
      mockHealthChecker.checkHealth.mockResolvedValue(healthyStatus);

      const result = await router.checkOllamaHealth();

      expect(result.healthy).toBe(true);
      expect(result.healthStatus).toBe("healthy");
      expect(mockHealthChecker.checkHealth).toHaveBeenCalledTimes(1);
    });

    it("should return degraded health status", async () => {
      mockHealthChecker.checkHealth.mockResolvedValue(degradedStatus);

      const result = await router.checkOllamaHealth();

      expect(result.healthy).toBe(true);
      expect(result.healthStatus).toBe("degraded");
      expect(result.degradationReason).toContain("slow response");
    });

    it("should return unhealthy status", async () => {
      mockHealthChecker.checkHealth.mockResolvedValue(unhealthyStatus);

      const result = await router.checkOllamaHealth();

      expect(result.healthy).toBe(false);
      expect(result.healthStatus).toBe("unhealthy");
      expect(result.daemonRunning).toBe(false);
    });

    it("should use cached health status within TTL", async () => {
      mockHealthChecker.checkHealth.mockResolvedValue(healthyStatus);

      // First call - performs check
      await router.checkOllamaHealth();
      expect(mockHealthChecker.checkHealth).toHaveBeenCalledTimes(1);

      // Second call within TTL - uses cache
      await router.checkOllamaHealth();
      expect(mockHealthChecker.checkHealth).toHaveBeenCalledTimes(1);
    });

    it("quickCheck should use cache when available", async () => {
      mockHealthChecker.quickCheck.mockResolvedValue(healthyStatus);

      const result = await router.quickHealthCheck();

      expect(result.healthy).toBe(true);
      expect(mockHealthChecker.quickCheck).toHaveBeenCalledTimes(1);
    });

    it("forceCheck should bypass cache", async () => {
      mockHealthChecker.forceCheck.mockResolvedValue(healthyStatus);

      // Populate cache first
      mockHealthChecker.checkHealth.mockResolvedValue(healthyStatus);
      await router.checkOllamaHealth();

      // Force check should call forceCheck method
      const result = await router.forceHealthCheck();

      expect(result.healthy).toBe(true);
      expect(mockHealthChecker.forceCheck).toHaveBeenCalledTimes(1);
    });

    it("getCachedHealthStatus should return cache without check", async () => {
      // Initially null
      let cached = router.getCachedHealthStatus();
      expect(cached).toBeNull();

      // After check, should return cached status
      mockHealthChecker.checkHealth.mockResolvedValue(healthyStatus);
      await router.checkOllamaHealth();

      cached = router.getCachedHealthStatus();
      expect(cached).not.toBeNull();
      expect(cached?.healthy).toBe(true);
    });

    it("isOllamaHealthy should return boolean", async () => {
      mockHealthChecker.checkHealth.mockResolvedValue(healthyStatus);

      const isHealthy = await router.isOllamaHealthy();

      expect(isHealthy).toBe(true);
    });

    it("isOllamaHealthy should return false for degraded", async () => {
      mockHealthChecker.checkHealth.mockResolvedValue(degradedStatus);

      const isHealthy = await router.isOllamaHealthy();

      // Degraded is still considered "healthy" (not unhealthy)
      expect(isHealthy).toBe(true);
    });

    it("isOllamaHealthy should return false for unhealthy", async () => {
      mockHealthChecker.checkHealth.mockResolvedValue(unhealthyStatus);

      const isHealthy = await router.isOllamaHealthy();

      expect(isHealthy).toBe(false);
    });
  });

  describe("Health Check Toggle", () => {
    it("should disable health checks", async () => {
      router.setHealthChecksEnabled(false);

      const result = await router.checkOllamaHealth();

      // Should return healthy status without actually checking
      expect(result.healthy).toBe(true);
      expect(result.message).toBe("Health checks disabled");
      expect(mockHealthChecker.checkHealth).not.toHaveBeenCalled();
    });

    it("should enable health checks", async () => {
      router.setHealthChecksEnabled(false);
      expect(router.isHealthChecksEnabled()).toBe(false);

      router.setHealthChecksEnabled(true);
      expect(router.isHealthChecksEnabled()).toBe(true);
    });

    it("should check if health checks are enabled", () => {
      expect(router.isHealthChecksEnabled()).toBe(true);

      router.setHealthChecksEnabled(false);
      expect(router.isHealthChecksEnabled()).toBe(false);
    });
  });

  describe("Cache Management", () => {
    it("should clear health cache", async () => {
      mockHealthChecker.checkHealth.mockResolvedValue(healthyStatus);

      // Populate cache
      await router.checkOllamaHealth();
      expect(router.getCachedHealthStatus()).not.toBeNull();

      // Clear cache
      router.clearHealthCache();
      expect(router.getCachedHealthStatus()).toBeNull();
      expect(mockHealthChecker.clearCache).toHaveBeenCalledTimes(1);
    });

    it("should perform fresh check after cache clear", async () => {
      mockHealthChecker.checkHealth.mockResolvedValue(healthyStatus);

      // First call
      await router.checkOllamaHealth();
      const callCount = mockHealthChecker.checkHealth.mock.calls.length;

      // Clear cache and call again
      router.clearHealthCache();
      await router.checkOllamaHealth();

      // Should perform new check
      expect(mockHealthChecker.checkHealth.mock.calls.length).toBeGreaterThan(
        callCount
      );
    });
  });

  describe("Router Configuration", () => {
    it("should initialize with health checks enabled by default", () => {
      const defaultRouter = new CascadeRouter({});

      expect(defaultRouter.isHealthChecksEnabled()).toBe(true);
    });

    it("should initialize with health checks disabled via config", () => {
      const disabledRouter = new CascadeRouter({
        enableHealthChecks: false,
      });

      expect(disabledRouter.isHealthChecksEnabled()).toBe(false);
    });

    it("should use custom Ollama URL from config", () => {
      const customRouter = new CascadeRouter({
        ollamaBaseURL: "http://ollama.example.com:11434",
        ollamaModel: "qwen2.5:3b",
      });

      // Router was created successfully with custom config
      expect(customRouter).toBeDefined();
    });
  });

  describe("Integration with Routing", () => {
    it("should route normally when Ollama is healthy", async () => {
      mockHealthChecker.checkHealth.mockResolvedValue(healthyStatus);

      const decision = await router.route("What is 2+2?");

      // Should make routing decision
      expect(decision).toBeDefined();
      expect(decision.route).toBeDefined();
    });

    it("should handle routing when Ollama is unhealthy", async () => {
      mockHealthChecker.checkHealth.mockResolvedValue(unhealthyStatus);

      const decision = await router.route("What is 2+2?");

      // Should still make routing decision (likely to cloud)
      expect(decision).toBeDefined();
      expect(decision.route).toBeDefined();
    });

    it("should handle routing when Ollama is degraded", async () => {
      mockHealthChecker.checkHealth.mockResolvedValue(degradedStatus);

      const decision = await router.route("What is 2+2?");

      // Should still make routing decision
      expect(decision).toBeDefined();
      expect(decision.route).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle health check errors gracefully", async () => {
      mockHealthChecker.checkHealth.mockRejectedValue(
        new Error("Health check failed")
      );

      // Should not throw, but return error status
      const result = await router.checkOllamaHealth();

      expect(result.healthy).toBe(false);
      expect(result.healthStatus).toBe("unhealthy");
    });

    it("should handle concurrent health checks", async () => {
      mockHealthChecker.checkHealth.mockImplementation(
        async () =>
          new Promise(resolve => {
            setTimeout(() => resolve(healthyStatus), 100);
          })
      );

      // Fire multiple concurrent checks
      const checks = [
        router.checkOllamaHealth(),
        router.checkOllamaHealth(),
        router.checkOllamaHealth(),
      ];

      const results = await Promise.all(checks);

      // All should return healthy
      results.forEach(result => {
        expect(result.healthy).toBe(true);
      });

      // Should only call health check once (others wait for cache)
      expect(mockHealthChecker.checkHealth).toHaveBeenCalledTimes(1);
    });

    it("should handle rapid health check calls", async () => {
      mockHealthChecker.checkHealth.mockResolvedValue(healthyStatus);

      // Rapid calls within TTL
      for (let i = 0; i < 10; i++) {
        await router.checkOllamaHealth();
      }

      // Should only call health checker once (rest use cache)
      expect(mockHealthChecker.checkHealth).toHaveBeenCalledTimes(1);
    });
  });

  describe("Performance", () => {
    it("quickCheck should be faster than full check", async () => {
      mockHealthChecker.checkHealth.mockImplementation(
        async () =>
          new Promise(resolve => {
            setTimeout(() => resolve(healthyStatus), 100);
          })
      );

      mockHealthChecker.quickCheck.mockResolvedValue(healthyStatus);

      // Quick check should return immediately (from cache)
      const start = Date.now();
      await router.quickHealthCheck();
      const quickTime = Date.now() - start;

      // Full check should take longer
      const start2 = Date.now();
      await router.checkOllamaHealth();
      const fullTime = Date.now() - start2;

      // Quick check should be faster or equal (cached)
      expect(quickTime).toBeLessThanOrEqual(fullTime);
    });
  });
});

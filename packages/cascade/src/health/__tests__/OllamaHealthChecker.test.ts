/**
 * OllamaHealthChecker Tests
 *
 * Tests health check scenarios:
 * - Ollama daemon up and healthy
 * - Ollama daemon down
 * - Ollama degraded (slow response)
 * - Model unavailable
 * - Cache TTL behavior
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import axios from "axios";
import {
  OllamaHealthChecker,
  createOllamaHealthChecker,
} from "../OllamaHealthChecker";
import type { OllamaHealthCheckConfig } from "@lsi/protocol";

// Mock axios
vi.mock("axios");

describe("OllamaHealthChecker", () => {
  let checker: OllamaHealthChecker;
  let mockAxiosInstance: any;

  const mockAxios = axios as unknown as {
    create: ReturnType<typeof vi.fn>;
  };

  const defaultConfig: OllamaHealthCheckConfig = {
    baseURL: "http://localhost:11434",
    defaultModel: "llama2",
    timeout: 5000,
    cacheTTL: 1000,
    maxResponseTime: 1000,
    maxMemoryUsage: 8192,
    maxCpuUsage: 80,
    enablePerformanceMetrics: true,
    enableModelCheck: true,
    enableResourceMonitoring: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      defaults: {},
    };
    mockAxios.create.mockReturnValue(mockAxiosInstance);

    checker = new OllamaHealthChecker(defaultConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Daemon Connectivity", () => {
    it("should detect healthy daemon", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        headers: { "x-ollama-version": "1.2.3" },
        data: { models: [{ name: "llama2" }] },
      });
      mockAxiosInstance.post.mockResolvedValue({});

      const result = await checker.checkHealth();

      expect(result.healthy).toBe(true);
      expect(result.daemonRunning).toBe(true);
      expect(result.daemonVersion).toBe("1.2.3");
      expect(result.healthStatus).toBe("healthy");
    });

    it("should detect daemon not running (ECONNREFUSED)", async () => {
      mockAxiosInstance.get.mockRejectedValue({
        code: "ECONNREFUSED",
        message: "Connection refused",
      });

      const result = await checker.checkHealth();

      expect(result.healthy).toBe(false);
      expect(result.daemonRunning).toBe(false);
      expect(result.healthStatus).toBe("unhealthy");
    });

    it("should detect daemon timeout (ETIMEDOUT)", async () => {
      mockAxiosInstance.get.mockRejectedValue({
        code: "ETIMEDOUT",
        message: "Connection timeout",
      });

      const result = await checker.checkHealth();

      expect(result.healthy).toBe(false);
      expect(result.daemonRunning).toBe(false);
      expect(result.healthStatus).toBe("unhealthy");
    });
  });

  describe("Model Availability", () => {
    it("should detect default model available", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        headers: { "x-ollama-version": "1.2.3" },
        data: { models: [{ name: "llama2:latest" }, { name: "qwen2.5:3b" }] },
      });
      mockAxiosInstance.post.mockResolvedValue({});

      const result = await checker.checkHealth();

      expect(result.defaultModelAvailable).toBe(true);
      expect(result.availableModels).toHaveLength(2);
      expect(result.availableModels).toContain("llama2:latest");
    });

    it("should detect default model unavailable", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        headers: { "x-ollama-version": "1.2.3" },
        data: { models: [{ name: "qwen2.5:3b" }] },
      });
      mockAxiosInstance.post.mockResolvedValue({});

      const result = await checker.checkHealth();

      expect(result.defaultModelAvailable).toBe(false);
      expect(result.healthy).toBe(false);
      expect(result.healthStatus).toBe("unhealthy");
    });

    it("should handle model check disabled", async () => {
      const config = { ...defaultConfig, enableModelCheck: false };
      const checkerNoModelCheck = new OllamaHealthChecker(config);

      mockAxiosInstance.get.mockResolvedValue({
        headers: { "x-ollama-version": "1.2.3" },
        data: { models: [] },
      });
      mockAxiosInstance.post.mockResolvedValue({});

      const result = await checkerNoModelCheck.checkHealth();

      expect(result.defaultModelAvailable).toBe(true);
    });
  });

  describe("Performance Metrics", () => {
    it("should measure response time accurately", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        headers: { "x-ollama-version": "1.2.3" },
        data: { models: [{ name: "llama2" }] },
      });
      mockAxiosInstance.post.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {};
      });

      const result = await checker.checkHealth();

      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);
    });

    it("should detect degraded performance (slow response)", async () => {
      const config = { ...defaultConfig, maxResponseTime: 100 };
      const slowChecker = new OllamaHealthChecker(config);

      mockAxiosInstance.get.mockResolvedValue({
        headers: { "x-ollama-version": "1.2.3" },
        data: { models: [{ name: "llama2" }] },
      });
      mockAxiosInstance.post.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return {};
      });

      const result = await slowChecker.checkHealth();

      expect(result.responseTime).toBeGreaterThan(100);
      expect(result.healthStatus).toBe("degraded");
      expect(result.degradationReason).toContain("slow response");
    });
  });

  describe("Resource Monitoring", () => {
    it("should handle resource monitoring disabled", async () => {
      const config = { ...defaultConfig, enableResourceMonitoring: false };
      const noResourceChecker = new OllamaHealthChecker(config);

      mockAxiosInstance.get.mockResolvedValue({
        headers: { "x-ollama-version": "1.2.3" },
        data: { models: [{ name: "llama2" }] },
      });
      mockAxiosInstance.post.mockResolvedValue({});

      const result = await noResourceChecker.checkHealth();

      expect(result.memoryUsage).toBeUndefined();
      expect(result.cpuUsage).toBeUndefined();
    });
  });

  describe("Health Score Calculation", () => {
    it("should calculate high score for healthy system", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        headers: { "x-ollama-version": "1.2.3" },
        data: { models: [{ name: "llama2" }] },
      });
      mockAxiosInstance.post.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return {};
      });

      const result = await checker.checkHealth();

      expect(result.score).toBeGreaterThan(0.8);
      expect(result.healthStatus).toBe("healthy");
    });

    it("should calculate degraded score for slow response", async () => {
      const config = { ...defaultConfig, maxResponseTime: 100 };
      const degradedChecker = new OllamaHealthChecker(config);

      mockAxiosInstance.get.mockResolvedValue({
        headers: { "x-ollama-version": "1.2.3" },
        data: { models: [{ name: "llama2" }] },
      });
      mockAxiosInstance.post.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 300));
        return {};
      });

      const result = await degradedChecker.checkHealth();

      // Response time is high, so score should be lower
      expect(result.score).toBeLessThan(1);
      expect(result.responseTime).toBeGreaterThan(100);
    });

    it("should calculate low score for unhealthy system", async () => {
      mockAxiosInstance.get.mockRejectedValue({
        code: "ECONNREFUSED",
        message: "Connection refused",
      });

      const result = await checker.checkHealth();

      expect(result.score).toBe(0);
      expect(result.healthStatus).toBe("unhealthy");
    });
  });

  describe("Cache TTL Behavior", () => {
    it("should use cached result within TTL", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        headers: { "x-ollama-version": "1.2.3" },
        data: { models: [{ name: "llama2" }] },
      });
      mockAxiosInstance.post.mockResolvedValue({});

      await checker.checkHealth();
      const callCount = mockAxiosInstance.get.mock.calls.length;

      await checker.checkHealth();
      expect(mockAxiosInstance.get.mock.calls.length).toBe(callCount);
    });

    it("quickCheck should return cached result immediately", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        headers: { "x-ollama-version": "1.2.3" },
        data: { models: [{ name: "llama2" }] },
      });
      mockAxiosInstance.post.mockResolvedValue({});

      await checker.checkHealth();
      const callCount = mockAxiosInstance.get.mock.calls.length;

      await checker.quickCheck();
      expect(mockAxiosInstance.get.mock.calls.length).toBe(callCount);
    });

    it("forceCheck should bypass cache", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        headers: { "x-ollama-version": "1.2.3" },
        data: { models: [{ name: "llama2" }] },
      });
      mockAxiosInstance.post.mockResolvedValue({});

      await checker.checkHealth();
      const callCount = mockAxiosInstance.get.mock.calls.length;

      await checker.forceCheck();
      expect(mockAxiosInstance.get.mock.calls.length).toBeGreaterThan(callCount);
    });
  });

  describe("Factory Function", () => {
    it("should create checker with defaults", () => {
      const factoryChecker = createOllamaHealthChecker();
      const config = factoryChecker.getConfig();

      expect(config.baseURL).toBe("http://localhost:11434");
      expect(config.defaultModel).toBe("llama2");
    });

    it("should create checker with custom values", () => {
      const factoryChecker = createOllamaHealthChecker(
        "http://localhost:8080",
        "qwen2.5:3b",
        { timeout: 10000 }
      );
      const config = factoryChecker.getConfig();

      expect(config.baseURL).toBe("http://localhost:8080");
      expect(config.defaultModel).toBe("qwen2.5:3b");
      expect(config.timeout).toBe(10000);
    });
  });
});

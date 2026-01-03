/**
 * Tests for OllamaAdapter
 *
 * These tests use mocked HTTP responses for unit testing.
 * Integration tests with real Ollama should be separate.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  OllamaAdapter,
  OllamaAdapterError,
  createOllamaAdapter,
} from "../OllamaAdapter.js";
import type { RoutingDecision } from "@lsi/protocol";
import type { AxiosError } from "axios";

// Mock axios
const mockPost = vi.fn();
const mockGet = vi.fn();
const mockAxiosInstance = {
  post: mockPost,
  get: mockGet,
  defaults: {
    timeout: 30000,
    baseURL: "http://localhost:11434",
  },
};

// Track which errors should be treated as Axios errors
const axiosErrorSet = new WeakSet<object>();

vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => mockAxiosInstance),
    isAxiosError: (error: unknown): error is AxiosError => {
      return axiosErrorSet.has(error as object);
    },
  },
}));

describe("OllamaAdapter", () => {
  let adapter: OllamaAdapter;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Create fresh adapter
    adapter = new OllamaAdapter("http://localhost:11434", "qwen2.5:3b");
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe("constructor", () => {
    it("should create adapter with default config", () => {
      const defaultAdapter = new OllamaAdapter();
      const config = defaultAdapter.getConfig();

      expect(config.baseUrl).toBe("http://localhost:11434");
      expect(config.defaultModel).toBe("llama2");
      expect(config.timeout).toBe(30000);
      expect(config.maxRetries).toBe(3);
    });

    it("should create adapter with custom config", () => {
      const customAdapter = new OllamaAdapter(
        "http://custom:11434",
        "custom-model",
        {
          timeout: 60000,
          maxRetries: 5,
        }
      );
      const config = customAdapter.getConfig();

      expect(config.baseUrl).toBe("http://custom:11434");
      expect(config.defaultModel).toBe("custom-model");
      expect(config.timeout).toBe(60000);
      expect(config.maxRetries).toBe(5);
    });

    it("should respect environment variables", () => {
      process.env.OLLAMA_BASE_URL = "http://env:11434";
      process.env.OLLAMA_MODEL = "env-model";

      const envAdapter = new OllamaAdapter();
      const config = envAdapter.getConfig();

      expect(config.baseUrl).toBe("http://env:11434");
      expect(config.defaultModel).toBe("env-model");

      // Cleanup
      delete process.env.OLLAMA_BASE_URL;
      delete process.env.OLLAMA_MODEL;
    });

    it("should prioritize constructor args over env vars", () => {
      process.env.OLLAMA_BASE_URL = "http://env:11434";
      process.env.OLLAMA_MODEL = "env-model";

      const argAdapter = new OllamaAdapter("http://arg:11434", "arg-model");
      const config = argAdapter.getConfig();

      expect(config.baseUrl).toBe("http://arg:11434");
      expect(config.defaultModel).toBe("arg-model");

      // Cleanup
      delete process.env.OLLAMA_BASE_URL;
      delete process.env.OLLAMA_MODEL;
    });
  });

  describe("execute", () => {
    it("should execute request successfully", async () => {
      const mockResponse = {
        response: "4",
        done: true,
        model: "qwen2.5:3b",
        eval_count: 10,
        prompt_eval_count: 5,
        total_duration: 1000000,
      };

      mockPost.mockResolvedValueOnce({ data: mockResponse });

      const decision: RoutingDecision = {
        backend: "local",
        model: "qwen2.5:3b",
        confidence: 0.9,
        reason: "Test",
        appliedPrinciples: [],
        cacheResponse: false,
      };

      const result = await adapter.execute(decision, "What is 2+2?");

      expect(result.content).toBe("4");
      expect(result.backend).toBe("local");
      expect(result.model).toBe("qwen2.5:3b");
      expect(result.tokensUsed).toBe(10);
      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(result.metadata).toEqual({
        model: "qwen2.5:3b",
        tokensUsed: 10,
        latency: result.latency,
        backend: "local",
      });

      expect(mockPost).toHaveBeenCalledWith("/api/generate", {
        model: "qwen2.5:3b",
        prompt: "What is 2+2?",
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 2048,
        },
      });
    });

    it("should use default model when decision.model is empty", async () => {
      const mockResponse = {
        response: "response",
        done: true,
        model: "llama2",
      };

      mockPost.mockResolvedValueOnce({ data: mockResponse });

      const decision: RoutingDecision = {
        backend: "local",
        model: "",
        confidence: 0.9,
        reason: "Test",
        appliedPrinciples: [],
      };

      await adapter.execute(decision, "test");

      expect(mockPost).toHaveBeenCalledWith(
        "/api/generate",
        expect.objectContaining({
          model: "qwen2.5:3b", // Should use adapter's default
        })
      );
    });

    it("should retry on transient failures", async () => {
      // Fail twice, then succeed
      mockPost
        .mockRejectedValueOnce(new Error("ECONNRESET"))
        .mockRejectedValueOnce(new Error("ECONNRESET"))
        .mockResolvedValueOnce({
          data: { response: "success", done: true, model: "qwen2.5:3b" },
        });

      const decision: RoutingDecision = {
        backend: "local",
        model: "qwen2.5:3b",
        confidence: 0.9,
        reason: "Test",
        appliedPrinciples: [],
      };

      // Use promise with timers to simulate retry delays
      const promise = adapter.execute(decision, "test");

      // Advance timers for retries
      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result.content).toBe("success");
      expect(mockPost).toHaveBeenCalledTimes(3);
    });

    it("should throw error after max retries", async () => {
      mockPost.mockRejectedValue(new Error("ECONNRESET"));

      const decision: RoutingDecision = {
        backend: "local",
        model: "qwen2.5:3b",
        confidence: 0.9,
        reason: "Test",
        appliedPrinciples: [],
      };

      const promise = adapter.execute(decision, "test");
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow();
      expect(mockPost).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it("should handle connection refused error after retries", async () => {
      const connError = new Error("connect ECONNREFUSED") as any;
      connError.code = "ECONNREFUSED";
      axiosErrorSet.add(connError);
      mockPost.mockRejectedValue(connError);

      const decision: RoutingDecision = {
        backend: "local",
        model: "qwen2.5:3b",
        confidence: 0.9,
        reason: "Test",
        appliedPrinciples: [],
      };

      const promise = adapter.execute(decision, "test");
      await vi.runAllTimersAsync();

      // Should retry 3 times then throw
      await expect(promise).rejects.toThrow(OllamaAdapterError);
      expect(mockPost).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it("should handle timeout error after retries", async () => {
      const timeoutError = new Error("timeout of 30000ms exceeded") as any;
      timeoutError.code = "ETIMEDOUT";
      axiosErrorSet.add(timeoutError);
      mockPost.mockRejectedValue(timeoutError);

      const decision: RoutingDecision = {
        backend: "local",
        model: "qwen2.5:3b",
        confidence: 0.9,
        reason: "Test",
        appliedPrinciples: [],
      };

      const promise = adapter.execute(decision, "test");
      await vi.runAllTimersAsync();

      // Should retry 3 times then throw
      await expect(promise).rejects.toThrow(OllamaAdapterError);
      expect(mockPost).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it("should handle 404 model not found", async () => {
      const error404 = {
        response: { status: 404 },
        message: "Not Found",
      };
      axiosErrorSet.add(error404);
      mockPost.mockRejectedValue(error404);

      const decision: RoutingDecision = {
        backend: "local",
        model: "qwen2.5:3b",
        confidence: 0.9,
        reason: "Test",
        appliedPrinciples: [],
      };

      await expect(adapter.execute(decision, "test")).rejects.toThrow(
        "Model not found"
      );
    });
  });

  describe("process", () => {
    it("should process prompt with default model", async () => {
      const mockResponse = {
        response: "processed",
        done: true,
        model: "qwen2.5:3b",
      };

      mockPost.mockResolvedValueOnce({ data: mockResponse });

      const result = await adapter.process("test prompt");

      expect(result.content).toBe("processed");
      expect(result.backend).toBe("local");
      expect(result.model).toBe("qwen2.5:3b");
    });

    it("should process prompt with custom model", async () => {
      const mockResponse = {
        response: "processed",
        done: true,
        model: "custom-model",
      };

      mockPost.mockResolvedValueOnce({ data: mockResponse });

      const result = await adapter.process("test prompt", "custom-model");

      expect(result.model).toBe("custom-model");
    });
  });

  describe("checkHealth", () => {
    it("should return healthy when Ollama is running", async () => {
      const mockTagsResponse = {
        models: [
          { name: "qwen2.5:3b" },
          { name: "llama2:13b" },
          { name: "mistral:7b" },
        ],
      };

      mockGet.mockResolvedValueOnce({ data: mockTagsResponse });

      const health = await adapter.checkHealth();

      expect(health.healthy).toBe(true);
      expect(health.models).toEqual(["qwen2.5:3b", "llama2:13b", "mistral:7b"]);
      expect(health.currentModel).toBe("qwen2.5:3b");
      expect(health.status).toBe("ok");
      expect(health.error).toBeUndefined();

      expect(mockGet).toHaveBeenCalledWith("/api/tags");
    });

    it("should return unhealthy when no models available", async () => {
      mockGet.mockResolvedValueOnce({ data: { models: [] } });

      const health = await adapter.checkHealth();

      expect(health.healthy).toBe(false);
      expect(health.models).toEqual([]);
      expect(health.status).toBe("no-models");
    });

    it("should return unhealthy on connection error", async () => {
      mockGet.mockRejectedValue(new Error("ECONNREFUSED"));

      const health = await adapter.checkHealth();

      expect(health.healthy).toBe(false);
      expect(health.models).toEqual([]);
      expect(health.status).toBe("unreachable");
      expect(health.error).toBeDefined();
    });
  });

  describe("updateConfig", () => {
    it("should update timeout and reflect in axios", async () => {
      adapter.updateConfig({ timeout: 60000 });

      const config = adapter.getConfig();
      expect(config.timeout).toBe(60000);
      expect(mockAxiosInstance.defaults.timeout).toBe(60000);
    });

    it("should update baseURL and reflect in axios", async () => {
      adapter.updateConfig({ baseUrl: "http://new:11434" });

      const config = adapter.getConfig();
      expect(config.baseUrl).toBe("http://new:11434");
      expect(mockAxiosInstance.defaults.baseURL).toBe("http://new:11434");
    });

    it("should update defaultModel", async () => {
      adapter.updateConfig({ defaultModel: "new-model" });

      const config = adapter.getConfig();
      expect(config.defaultModel).toBe("new-model");
    });
  });

  describe("getConfig", () => {
    it("should return copy of config", () => {
      const config1 = adapter.getConfig();
      const config2 = adapter.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different references
    });
  });

  describe("createOllamaAdapter factory", () => {
    it("should create adapter via factory function", () => {
      const factoryAdapter = createOllamaAdapter(
        "http://factory:11434",
        "factory-model"
      );

      expect(factoryAdapter).toBeInstanceOf(OllamaAdapter);

      const config = factoryAdapter.getConfig();
      expect(config.baseUrl).toBe("http://factory:11434");
      expect(config.defaultModel).toBe("factory-model");
    });
  });
});

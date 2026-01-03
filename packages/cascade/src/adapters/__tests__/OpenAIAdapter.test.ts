/**
 * Tests for OpenAIAdapter
 *
 * These tests use mocked HTTP responses for unit testing.
 * Integration tests with real OpenAI API should be separate.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  OpenAIAdapter,
  OpenAIAdapterError,
  createOpenAIAdapter,
} from "../OpenAIAdapter.js";
import type { RoutingDecision } from "@lsi/protocol";
import type { AxiosError } from "axios";

// Mock axios
const mockPost = vi.fn();
const mockGet = vi.fn();
const mockAxiosInstance = {
  post: mockPost,
  get: mockGet,
  defaults: {
    timeout: 60000,
    baseURL: "https://api.openai.com/v1",
    headers: {
      common: {},
    },
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

describe("OpenAIAdapter", () => {
  let adapter: OpenAIAdapter;
  const testApiKey = "sk-test-key-12345";

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.stubEnv("OPENAI_API_KEY", testApiKey);

    // Create fresh adapter
    adapter = new OpenAIAdapter(testApiKey, "gpt-3.5-turbo");
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  describe("constructor", () => {
    it("should create adapter with default config", () => {
      vi.unstubAllEnvs();
      vi.stubEnv("OPENAI_API_KEY", testApiKey);

      const defaultAdapter = new OpenAIAdapter();
      const config = defaultAdapter.getConfig();

      expect(config.baseURL).toBe("https://api.openai.com/v1");
      expect(config.defaultModel).toBe("gpt-3.5-turbo");
      expect(config.timeout).toBe(60000);
      expect(config.maxRetries).toBe(3);
      expect(config.apiKey).toBe("***REDACTED***");
    });

    it("should create adapter with custom config", () => {
      const customAdapter = new OpenAIAdapter("sk-custom-key", "gpt-4", {
        timeout: 120000,
        maxRetries: 5,
        baseURL: "https://custom.openai.com/v1",
        organization: "org-123",
      });
      const config = customAdapter.getConfig();

      expect(config.baseURL).toBe("https://custom.openai.com/v1");
      expect(config.defaultModel).toBe("gpt-4");
      expect(config.timeout).toBe(120000);
      expect(config.maxRetries).toBe(5);
      expect(config.organization).toBe("org-123");
    });

    it("should respect environment variables", () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-env-key");
      vi.stubEnv("OPENAI_MODEL", "gpt-4");
      vi.stubEnv("OPENAI_BASE_URL", "https://env.openai.com/v1");
      vi.stubEnv("OPENAI_ORGANIZATION", "org-env");

      const envAdapter = new OpenAIAdapter();
      const config = envAdapter.getConfig();

      expect(config.baseURL).toBe("https://env.openai.com/v1");
      expect(config.defaultModel).toBe("gpt-4");
      expect(config.organization).toBe("org-env");
    });

    it("should prioritize constructor args over env vars", () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-env-key");
      vi.stubEnv("OPENAI_MODEL", "gpt-4");

      const argAdapter = new OpenAIAdapter("sk-arg-key", "gpt-3.5-turbo");
      const config = argAdapter.getConfig();

      expect(config.defaultModel).toBe("gpt-3.5-turbo");
      expect(argAdapter.getApiKey()).toBe("sk-arg-key");
    });

    it("should throw error when API key is not provided", () => {
      vi.unstubAllEnvs();

      expect(() => new OpenAIAdapter()).toThrow(OpenAIAdapterError);
      expect(() => new OpenAIAdapter()).toThrow("API key is required");
    });

    it("should redact API key in getConfig", () => {
      const config = adapter.getConfig();

      expect(config.apiKey).toBe("***REDACTED***");
      expect(adapter.getApiKey()).toBe(testApiKey);
    });
  });

  describe("execute", () => {
    it("should execute request successfully", async () => {
      const mockResponse = {
        id: "chatcmpl-123",
        object: "chat.completion",
        created: 1677652288,
        model: "gpt-3.5-turbo",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "4",
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      mockPost.mockResolvedValueOnce({ data: mockResponse });

      const decision: RoutingDecision = {
        backend: "cloud",
        model: "gpt-3.5-turbo",
        confidence: 0.9,
        reason: "Test",
        appliedPrinciples: [],
        cacheResponse: false,
      };

      const result = await adapter.execute(decision, "What is 2+2?");

      expect(result.content).toBe("4");
      expect(result.backend).toBe("cloud");
      expect(result.model).toBe("gpt-3.5-turbo");
      expect(result.tokensUsed).toBe(15);
      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(result.metadata).toEqual({
        model: "gpt-3.5-turbo",
        tokensUsed: 15,
        latency: result.latency,
        backend: "cloud",
        finishReason: "stop",
      });

      expect(mockPost).toHaveBeenCalledWith("/chat/completions", {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "What is 2+2?" }],
        temperature: 0.7,
        max_tokens: 2048,
        stream: false,
      });
    });

    it("should use default model when decision.model is empty", async () => {
      const mockResponse = {
        id: "chatcmpl-123",
        object: "chat.completion",
        created: 1677652288,
        model: "gpt-3.5-turbo",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "response" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
      };

      mockPost.mockResolvedValueOnce({ data: mockResponse });

      const decision: RoutingDecision = {
        backend: "cloud",
        model: "",
        confidence: 0.9,
        reason: "Test",
        appliedPrinciples: [],
      };

      await adapter.execute(decision, "test");

      expect(mockPost).toHaveBeenCalledWith(
        "/chat/completions",
        expect.objectContaining({
          model: "gpt-3.5-turbo", // Should use adapter's default
        })
      );
    });

    it("should retry on transient failures", async () => {
      // Fail twice, then succeed
      mockPost
        .mockRejectedValueOnce(new Error("ECONNRESET"))
        .mockRejectedValueOnce(new Error("ECONNRESET"))
        .mockResolvedValueOnce({
          data: {
            id: "chatcmpl-123",
            object: "chat.completion",
            created: 1677652288,
            model: "gpt-3.5-turbo",
            choices: [
              {
                index: 0,
                message: { role: "assistant", content: "success" },
                finish_reason: "stop",
              },
            ],
            usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
          },
        });

      const decision: RoutingDecision = {
        backend: "cloud",
        model: "gpt-3.5-turbo",
        confidence: 0.9,
        reason: "Test",
        appliedPrinciples: [],
      };

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
        backend: "cloud",
        model: "gpt-3.5-turbo",
        confidence: 0.9,
        reason: "Test",
        appliedPrinciples: [],
      };

      const promise = adapter.execute(decision, "test");
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow();
      expect(mockPost).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it("should handle 401 invalid API key", async () => {
      const error401: any = {
        response: { status: 401 },
        message: "Unauthorized",
      };
      axiosErrorSet.add(error401);
      mockPost.mockRejectedValue(error401);

      const decision: RoutingDecision = {
        backend: "cloud",
        model: "gpt-3.5-turbo",
        confidence: 0.9,
        reason: "Test",
        appliedPrinciples: [],
      };

      await expect(adapter.execute(decision, "test")).rejects.toThrow(
        "Invalid API key"
      );
      await expect(adapter.execute(decision, "test")).rejects.toThrow(
        OpenAIAdapterError
      );
    });

    it("should handle 429 rate limit with retry", async () => {
      const error429: any = {
        response: { status: 429 },
        message: "Rate limit exceeded",
      };
      axiosErrorSet.add(error429);

      mockPost.mockRejectedValueOnce(error429).mockResolvedValueOnce({
        data: {
          id: "chatcmpl-123",
          object: "chat.completion",
          created: 1677652288,
          model: "gpt-3.5-turbo",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "success" },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        },
      });

      const decision: RoutingDecision = {
        backend: "cloud",
        model: "gpt-3.5-turbo",
        confidence: 0.9,
        reason: "Test",
        appliedPrinciples: [],
      };

      const promise = adapter.execute(decision, "test");
      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result.content).toBe("success");
      expect(mockPost).toHaveBeenCalledTimes(2);
    });

    it("should handle OpenAI error response", async () => {
      const openAIError: any = {
        response: {
          status: 400,
          data: {
            error: {
              message: "Invalid request: model not found",
              type: "invalid_request_error",
              code: "model_not_found",
            },
          },
        },
        message: "Bad Request",
      };
      axiosErrorSet.add(openAIError);
      mockPost.mockRejectedValue(openAIError);

      const decision: RoutingDecision = {
        backend: "cloud",
        model: "invalid-model",
        confidence: 0.9,
        reason: "Test",
        appliedPrinciples: [],
      };

      await expect(adapter.execute(decision, "test")).rejects.toThrow(
        "model_not_found"
      );
    });
  });

  describe("process", () => {
    it("should process prompt with default model", async () => {
      const mockResponse = {
        id: "chatcmpl-123",
        object: "chat.completion",
        created: 1677652288,
        model: "gpt-3.5-turbo",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "processed" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
      };

      mockPost.mockResolvedValueOnce({ data: mockResponse });

      const result = await adapter.process("test prompt");

      expect(result.content).toBe("processed");
      expect(result.backend).toBe("cloud");
      expect(result.model).toBe("gpt-3.5-turbo");
    });

    it("should process prompt with custom model", async () => {
      const mockResponse = {
        id: "chatcmpl-123",
        object: "chat.completion",
        created: 1677652288,
        model: "gpt-4",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "processed" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
      };

      mockPost.mockResolvedValueOnce({ data: mockResponse });

      const result = await adapter.process("test prompt", "gpt-4");

      expect(result.model).toBe("gpt-4");
    });
  });

  describe("processStream", () => {
    it("should process prompt with streaming", async () => {
      const mockStream = {
        on: vi.fn((event, callback) => {
          if (event === "data") {
            // Simulate chunk
            const chunks = [
              'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
              'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}\n\n',
              "data: [DONE]\n\n",
            ];
            chunks.forEach(chunk => {
              callback(Buffer.from(chunk));
            });
          }
          if (event === "end") {
            setTimeout(() => callback(), 10);
          }
          return mockStream;
        }),
      };

      mockPost.mockResolvedValueOnce({ data: mockStream });

      const chunks: string[] = [];
      const onChunk = vi.fn((chunk: string, done: boolean) => {
        if (chunk) {
          chunks.push(chunk);
        }
      });

      const result = await adapter.processStream(
        "test",
        "gpt-3.5-turbo",
        onChunk
      );

      expect(result.content).toBe("Hello world");
      expect(result.metadata?.streamed).toBe(true);
      expect(onChunk).toHaveBeenCalledWith("Hello", false);
      expect(onChunk).toHaveBeenCalledWith(" world", false);
      expect(onChunk).toHaveBeenCalledWith("", true);
    });

    it("should handle stream errors", async () => {
      const mockStream = {
        on: vi.fn((event, callback) => {
          if (event === "error") {
            // Immediately call error callback
            callback(new Error("Stream error"));
          }
          return mockStream;
        }),
      };

      mockPost.mockResolvedValueOnce({ data: mockStream });

      await expect(
        adapter.processStream("test", "gpt-3.5-turbo")
      ).rejects.toThrow(OpenAIAdapterError);
    }, 10000);
  });

  describe("checkHealth", () => {
    it("should return healthy when OpenAI API is accessible", async () => {
      const mockModelsResponse = {
        object: "list",
        data: [
          { id: "gpt-3.5-turbo", object: "model", owned_by: "openai" },
          { id: "gpt-4", object: "model", owned_by: "openai" },
          { id: "text-embedding-ada-002", object: "model", owned_by: "openai" },
        ],
      };

      mockGet.mockResolvedValueOnce({ data: mockModelsResponse });

      const health = await adapter.checkHealth();

      expect(health.healthy).toBe(true);
      expect(health.models).toEqual(["gpt-3.5-turbo", "gpt-4"]);
      expect(health.currentModel).toBe("gpt-3.5-turbo");
      expect(health.status).toBe("ok");
      expect(health.error).toBeUndefined();

      expect(mockGet).toHaveBeenCalledWith("/models");
    });

    it("should return unhealthy on connection error", async () => {
      mockGet.mockRejectedValue(new Error("ECONNREFUSED"));

      const health = await adapter.checkHealth();

      expect(health.healthy).toBe(false);
      expect(health.models).toEqual([]);
      expect(health.status).toBe("unreachable");
      expect(health.error).toBeDefined();
    });

    it("should return unhealthy when no models available", async () => {
      mockGet.mockResolvedValueOnce({
        data: { object: "list", data: [] },
      });

      const health = await adapter.checkHealth();

      expect(health.healthy).toBe(false);
      expect(health.models).toEqual([]);
      expect(health.status).toBe("no-models");
    });
  });

  describe("updateConfig", () => {
    it("should update timeout and reflect in axios", async () => {
      adapter.updateConfig({ timeout: 120000 });

      const config = adapter.getConfig();
      expect(config.timeout).toBe(120000);
      expect(mockAxiosInstance.defaults.timeout).toBe(120000);
    });

    it("should update baseURL and reflect in axios", async () => {
      adapter.updateConfig({ baseURL: "https://new.openai.com/v1" });

      const config = adapter.getConfig();
      expect(config.baseURL).toBe("https://new.openai.com/v1");
      expect(mockAxiosInstance.defaults.baseURL).toBe(
        "https://new.openai.com/v1"
      );
    });

    it("should update defaultModel", async () => {
      adapter.updateConfig({ defaultModel: "gpt-4" });

      const config = adapter.getConfig();
      expect(config.defaultModel).toBe("gpt-4");
    });

    it("should update API key and rebuild headers", async () => {
      const newKey = "sk-new-key";
      adapter.updateConfig({ apiKey: newKey });

      expect(adapter.getApiKey()).toBe(newKey);
    });
  });

  describe("getConfig", () => {
    it("should return copy of config with redacted API key", () => {
      const config1 = adapter.getConfig();
      const config2 = adapter.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different references
      expect(config1.apiKey).toBe("***REDACTED***");
    });
  });

  describe("createOpenAIAdapter factory", () => {
    it("should create adapter via factory function", () => {
      const factoryAdapter = createOpenAIAdapter("sk-factory-key", "gpt-4");

      expect(factoryAdapter).toBeInstanceOf(OpenAIAdapter);

      const config = factoryAdapter.getConfig();
      expect(config.defaultModel).toBe("gpt-4");
      expect(factoryAdapter.getApiKey()).toBe("sk-factory-key");
    });

    it("should use environment variables in factory", () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-env-factory");

      const factoryAdapter = createOpenAIAdapter();

      expect(factoryAdapter).toBeInstanceOf(OpenAIAdapter);
      expect(factoryAdapter.getApiKey()).toBe("sk-env-factory");
    });
  });

  describe("error handling", () => {
    it("should handle connection refused error", async () => {
      const connError: any = new Error("connect ECONNREFUSED");
      connError.code = "ECONNREFUSED";
      axiosErrorSet.add(connError);
      mockPost.mockRejectedValue(connError);

      const decision: RoutingDecision = {
        backend: "cloud",
        model: "gpt-3.5-turbo",
        confidence: 0.9,
        reason: "Test",
        appliedPrinciples: [],
      };

      const promise = adapter.execute(decision, "test");
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow(OpenAIAdapterError);
      await expect(promise).rejects.toThrow("unreachable");
    });

    it("should handle timeout error", async () => {
      const timeoutError: any = new Error("timeout of 60000ms exceeded");
      timeoutError.code = "ETIMEDOUT";
      axiosErrorSet.add(timeoutError);
      mockPost.mockRejectedValue(timeoutError);

      const decision: RoutingDecision = {
        backend: "cloud",
        model: "gpt-3.5-turbo",
        confidence: 0.9,
        reason: "Test",
        appliedPrinciples: [],
      };

      const promise = adapter.execute(decision, "test");
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow(OpenAIAdapterError);
      await expect(promise).rejects.toThrow("timeout");
    });

    it("should handle 500 internal server error", async () => {
      const error500: any = {
        response: { status: 500 },
        message: "Internal Server Error",
      };
      axiosErrorSet.add(error500);
      mockPost.mockRejectedValue(error500);

      const decision: RoutingDecision = {
        backend: "cloud",
        model: "gpt-3.5-turbo",
        confidence: 0.9,
        reason: "Test",
        appliedPrinciples: [],
      };

      const promise = adapter.execute(decision, "test");
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow(OpenAIAdapterError);
      await expect(promise).rejects.toThrow("internal server error");
    });
  });

  describe("retry with jitter", () => {
    it("should add jitter to retry delays", async () => {
      let retryCount = 0;
      const delays: number[] = [];

      // Capture setTimeout calls
      const originalSetTimeout = global.setTimeout;
      vi.spyOn(global, "setTimeout").mockImplementation(
        (callback: any, delay: number) => {
          if (delay > 0) {
            delays.push(delay);
          }
          return originalSetTimeout(callback, delay);
        }
      );

      mockPost.mockImplementation(() => {
        retryCount++;
        if (retryCount <= 2) {
          return Promise.reject(new Error("ECONNRESET"));
        }
        return Promise.resolve({
          data: {
            id: "chatcmpl-123",
            object: "chat.completion",
            created: 1677652288,
            model: "gpt-3.5-turbo",
            choices: [
              {
                index: 0,
                message: { role: "assistant", content: "success" },
                finish_reason: "stop",
              },
            ],
            usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
          },
        });
      });

      const decision: RoutingDecision = {
        backend: "cloud",
        model: "gpt-3.5-turbo",
        confidence: 0.9,
        reason: "Test",
        appliedPrinciples: [],
      };

      const promise = adapter.execute(decision, "test");
      await vi.runAllTimersAsync();
      await promise;

      // Check that jitter was added (delays should be > base exponential backoff)
      // Base delays: 1000ms, 2000ms
      expect(delays.length).toBe(2);
      expect(delays[0]).toBeGreaterThanOrEqual(1000);
      expect(delays[0]).toBeLessThan(2000); // With jitter
      expect(delays[1]).toBeGreaterThanOrEqual(2000);
      expect(delays[1]).toBeLessThan(3000); // With jitter
    });
  });
});

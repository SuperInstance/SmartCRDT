/**
 * Tests for CohereAdapter
 *
 * These tests use mocked HTTP responses for unit testing.
 * Integration tests with real Cohere API should be separate.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CohereAdapter,
  CohereAdapterError,
  createCohereAdapter,
  COHERE_MODELS,
} from "../CohereAdapter.js";
import type { RoutingDecision } from "@lsi/protocol";
import type { AxiosError } from "axios";

// Mock axios
const mockPost = vi.fn();
const mockAxiosInstance = {
  post: mockPost,
  defaults: {
    timeout: 60000,
    baseURL: "https://api.cohere.ai",
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

describe("CohereAdapter", () => {
  let adapter: CohereAdapter;
  const testApiKey = "xxx-test-key-12345";

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.stubEnv("COHERE_API_KEY", testApiKey);

    // Create fresh adapter
    adapter = new CohereAdapter(testApiKey, COHERE_MODELS.COMMAND_R_PLUS);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  describe("constructor", () => {
    it("should create adapter with default config", () => {
      vi.unstubAllEnvs();
      vi.stubEnv("COHERE_API_KEY", testApiKey);

      const defaultAdapter = new CohereAdapter();
      const config = defaultAdapter.getConfig();

      expect(config.baseURL).toBe("https://api.cohere.ai");
      expect(config.defaultModel).toBe(COHERE_MODELS.COMMAND_R_PLUS);
      expect(config.timeout).toBe(60000);
      expect(config.maxRetries).toBe(3);
      expect(config.apiKey).toBe("***REDACTED***");
    });

    it("should create adapter with custom config", () => {
      const customAdapter = new CohereAdapter(
        "xxx-custom-key",
        COHERE_MODELS.COMMAND_R,
        {
          timeout: 120000,
          maxRetries: 5,
          baseURL: "https://custom.cohere.ai",
        }
      );
      const config = customAdapter.getConfig();

      expect(config.baseURL).toBe("https://custom.cohere.ai");
      expect(config.defaultModel).toBe(COHERE_MODELS.COMMAND_R);
      expect(config.timeout).toBe(120000);
      expect(config.maxRetries).toBe(5);
    });

    it("should throw error if API key is not provided", () => {
      vi.unstubAllEnvs();
      expect(() => new CohereAdapter()).toThrow(CohereAdapterError);
      expect(() => new CohereAdapter()).toThrow("COHERE_API_KEY");
    });

    it("should expose actual API key via getApiKey()", () => {
      expect(adapter.getApiKey()).toBe(testApiKey);
    });
  });

  describe("execute", () => {
    it("should execute a request successfully", async () => {
      const mockResponse = {
        generationId: "gen-123",
        text: "42",
        chatHistory: [],
        finishReason: "COMPLETE",
        tokenCount: {
          promptTokens: 10,
          responseTokens: 2,
          totalTokens: 12,
          billingTokens: 12,
        },
      };

      mockPost.mockResolvedValueOnce({ data: mockResponse });

      const decision: RoutingDecision = {
        backend: "cloud",
        model: COHERE_MODELS.COMMAND_R_PLUS,
        confidence: 1.0,
        reason: "Test",
        appliedPrinciples: [],
      };

      const result = await adapter.execute(decision, "What is 2+2?");

      expect(result.content).toBe("42");
      expect(result.model).toBe(COHERE_MODELS.COMMAND_R_PLUS);
      expect(result.tokensUsed).toBe(12);
      expect(result.backend).toBe("cloud");
      expect(result.latency).toBeGreaterThan(0);
    });

    it("should retry on rate limit errors", async () => {
      let attemptCount = 0;
      const mockResponse = {
        generationId: "gen-123",
        text: "42",
        chatHistory: [],
        finishReason: "COMPLETE",
        tokenCount: {
          promptTokens: 10,
          responseTokens: 2,
          totalTokens: 12,
          billingTokens: 12,
        },
      };

      mockPost.mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          const error: any = new Error("Rate limit exceeded");
          error.response = { status: 429 };
          error.code = "429";
          axiosErrorSet.add(error);
          throw error;
        }
        return { data: mockResponse };
      });

      const decision: RoutingDecision = {
        backend: "cloud",
        model: COHERE_MODELS.COMMAND_R_PLUS,
        confidence: 1.0,
        reason: "Test",
        appliedPrinciples: [],
      };

      const result = await adapter.execute(decision, "test");

      expect(result.content).toBe("42");
      expect(attemptCount).toBe(3);
    });
  });

  describe("process", () => {
    it("should process a prompt successfully", async () => {
      const mockResponse = {
        generationId: "gen-456",
        text: "Hello!",
        chatHistory: [],
        finishReason: "COMPLETE",
        tokenCount: {
          promptTokens: 5,
          responseTokens: 2,
          totalTokens: 7,
          billingTokens: 7,
        },
      };

      mockPost.mockResolvedValueOnce({ data: mockResponse });

      const result = await adapter.process("Say hello");

      expect(result.content).toBe("Hello!");
      expect(result.backend).toBe("cloud");
    });
  });

  describe("checkHealth", () => {
    it("should return healthy status when service is reachable", async () => {
      const mockResponse = {
        generationId: "gen-health",
        text: "OK",
        chatHistory: [],
        finishReason: "COMPLETE",
        tokenCount: {
          promptTokens: 1,
          responseTokens: 1,
          totalTokens: 2,
          billingTokens: 2,
        },
      };

      mockPost.mockResolvedValueOnce({ data: mockResponse });

      const health = await adapter.checkHealth();

      expect(health.healthy).toBe(true);
      expect(health.models).toContain(COHERE_MODELS.COMMAND_R_PLUS);
      expect(health.currentModel).toBe(COHERE_MODELS.COMMAND_R_PLUS);
      expect(health.status).toBe("ok");
    });

    it("should return unhealthy status when service is unreachable", async () => {
      const error: any = new Error("ECONNREFUSED");
      error.code = "ECONNREFUSED";
      axiosErrorSet.add(error);
      mockPost.mockRejectedValueOnce(error);

      const health = await adapter.checkHealth();

      expect(health.healthy).toBe(false);
      expect(health.error).toBeDefined();
      expect(health.status).toBe("unreachable");
    });
  });

  describe("updateConfig", () => {
    it("should update adapter configuration", () => {
      adapter.updateConfig({
        timeout: 90000,
        maxRetries: 4,
      });

      const config = adapter.getConfig();
      expect(config.timeout).toBe(90000);
      expect(config.maxRetries).toBe(4);
    });
  });

  describe("createCohereAdapter", () => {
    it("should create adapter using factory function", () => {
      const factoryAdapter = createCohereAdapter(
        testApiKey,
        COHERE_MODELS.COMMAND
      );

      expect(factoryAdapter).toBeInstanceOf(CohereAdapter);
      expect(factoryAdapter.getApiKey()).toBe(testApiKey);
    });
  });

  describe("COHERE_MODELS", () => {
    it("should export supported model constants", () => {
      expect(COHERE_MODELS.COMMAND_R_PLUS).toBe("command-r-plus-08-2024");
      expect(COHERE_MODELS.COMMAND_R).toBe("command-r-08-2024");
      expect(COHERE_MODELS.COMMAND).toBe("command");
    });
  });
});

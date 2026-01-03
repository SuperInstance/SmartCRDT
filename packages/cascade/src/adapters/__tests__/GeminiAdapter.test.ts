/**
 * Tests for GeminiAdapter
 *
 * These tests use mocked HTTP responses for unit testing.
 * Integration tests with real Google AI API should be separate.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  GeminiAdapter,
  GeminiAdapterError,
  createGeminiAdapter,
  GEMINI_MODELS,
} from "../GeminiAdapter.js";
import type { RoutingDecision } from "@lsi/protocol";
import type { AxiosError } from "axios";

// Mock axios
const mockPost = vi.fn();
const mockAxiosInstance = {
  post: mockPost,
  defaults: {
    timeout: 60000,
    baseURL: "https://generativelanguage.googleapis.com",
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

describe("GeminiAdapter", () => {
  let adapter: GeminiAdapter;
  const testApiKey = "AIza-test-key-12345";

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.stubEnv("GOOGLE_API_KEY", testApiKey);

    // Create fresh adapter
    adapter = new GeminiAdapter(testApiKey, GEMINI_MODELS.GEMINI_1_5_PRO);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  describe("constructor", () => {
    it("should create adapter with default config", () => {
      vi.unstubAllEnvs();
      vi.stubEnv("GOOGLE_API_KEY", testApiKey);

      const defaultAdapter = new GeminiAdapter();
      const config = defaultAdapter.getConfig();

      expect(config.baseURL).toBe("https://generativelanguage.googleapis.com");
      expect(config.defaultModel).toBe(GEMINI_MODELS.GEMINI_1_5_PRO);
      expect(config.timeout).toBe(60000);
      expect(config.maxRetries).toBe(3);
      expect(config.apiKey).toBe("***REDACTED***");
    });

    it("should create adapter with custom config", () => {
      const customAdapter = new GeminiAdapter(
        "AIza-custom-key",
        GEMINI_MODELS.GEMINI_2_0_FLASH_EXPERT,
        {
          timeout: 120000,
          maxRetries: 5,
          baseURL: "https://custom.googleapis.com",
        }
      );
      const config = customAdapter.getConfig();

      expect(config.baseURL).toBe("https://custom.googleapis.com");
      expect(config.defaultModel).toBe(GEMINI_MODELS.GEMINI_2_0_FLASH_EXPERT);
      expect(config.timeout).toBe(120000);
      expect(config.maxRetries).toBe(5);
    });

    it("should throw error if API key is not provided", () => {
      vi.unstubAllEnvs();
      expect(() => new GeminiAdapter()).toThrow(GeminiAdapterError);
      expect(() => new GeminiAdapter()).toThrow("GOOGLE_API_KEY");
    });

    it("should expose actual API key via getApiKey()", () => {
      expect(adapter.getApiKey()).toBe(testApiKey);
    });
  });

  describe("execute", () => {
    it("should execute a request successfully", async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: "42" }],
              role: "model",
            },
            finishReason: "STOP",
            index: 0,
            safetyRatings: [],
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 2,
          totalTokenCount: 12,
        },
        modelVersion: GEMINI_MODELS.GEMINI_1_5_PRO,
      };

      mockPost.mockResolvedValueOnce({ data: mockResponse });

      const decision: RoutingDecision = {
        backend: "cloud",
        model: GEMINI_MODELS.GEMINI_1_5_PRO,
        confidence: 1.0,
        reason: "Test",
        appliedPrinciples: [],
      };

      const result = await adapter.execute(decision, "What is 2+2?");

      expect(result.content).toBe("42");
      expect(result.model).toBe(GEMINI_MODELS.GEMINI_1_5_PRO);
      expect(result.tokensUsed).toBe(12);
      expect(result.backend).toBe("cloud");
      expect(result.latency).toBeGreaterThan(0);
    });

    it("should retry on rate limit errors", async () => {
      let attemptCount = 0;
      const mockResponse = {
        candidates: [
          {
            content: { parts: [{ text: "42" }], role: "model" },
            finishReason: "STOP",
            index: 0,
            safetyRatings: [],
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 2,
          totalTokenCount: 12,
        },
        modelVersion: GEMINI_MODELS.GEMINI_1_5_PRO,
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
        model: GEMINI_MODELS.GEMINI_1_5_PRO,
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
        candidates: [
          {
            content: { parts: [{ text: "Hello!" }], role: "model" },
            finishReason: "STOP",
            index: 0,
            safetyRatings: [],
          },
        ],
        usageMetadata: {
          promptTokenCount: 5,
          candidatesTokenCount: 2,
          totalTokenCount: 7,
        },
        modelVersion: GEMINI_MODELS.GEMINI_1_5_PRO,
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
        candidates: [
          {
            content: { parts: [{ text: "OK" }], role: "model" },
            finishReason: "STOP",
            index: 0,
            safetyRatings: [],
          },
        ],
        usageMetadata: {
          promptTokenCount: 1,
          candidatesTokenCount: 1,
          totalTokenCount: 2,
        },
        modelVersion: GEMINI_MODELS.GEMINI_1_5_PRO,
      };

      mockPost.mockResolvedValueOnce({ data: mockResponse });

      const health = await adapter.checkHealth();

      expect(health.healthy).toBe(true);
      expect(health.models).toContain(GEMINI_MODELS.GEMINI_1_5_PRO);
      expect(health.currentModel).toBe(GEMINI_MODELS.GEMINI_1_5_PRO);
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

  describe("createGeminiAdapter", () => {
    it("should create adapter using factory function", () => {
      const factoryAdapter = createGeminiAdapter(
        testApiKey,
        GEMINI_MODELS.GEMINI_1_5_FLASH
      );

      expect(factoryAdapter).toBeInstanceOf(GeminiAdapter);
      expect(factoryAdapter.getApiKey()).toBe(testApiKey);
    });
  });

  describe("GEMINI_MODELS", () => {
    it("should export supported model constants", () => {
      expect(GEMINI_MODELS.GEMINI_2_0_FLASH_EXPERT).toBe("gemini-2.0-flash-expert");
      expect(GEMINI_MODELS.GEMINI_1_5_PRO).toBe("gemini-1.5-pro");
      expect(GEMINI_MODELS.GEMINI_1_5_FLASH).toBe("gemini-1.5-flash");
    });
  });
});

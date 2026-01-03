/**
 * Tests for ClaudeAdapter
 *
 * These tests use mocked HTTP responses for unit testing.
 * Integration tests with real Anthropic API should be separate.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ClaudeAdapter,
  ClaudeAdapterError,
  createClaudeAdapter,
  CLAUDE_MODELS,
} from "../ClaudeAdapter.js";
import type { RoutingDecision } from "@lsi/protocol";
import type { AxiosError } from "axios";

// Mock axios
const mockPost = vi.fn();
const mockAxiosInstance = {
  post: mockPost,
  defaults: {
    timeout: 60000,
    baseURL: "https://api.anthropic.com",
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

describe("ClaudeAdapter", () => {
  let adapter: ClaudeAdapter;
  const testApiKey = "sk-ant-test-key-12345";

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.stubEnv("ANTHROPIC_API_KEY", testApiKey);

    // Create fresh adapter
    adapter = new ClaudeAdapter(testApiKey, CLAUDE_MODELS.CLAUDE_3_5_SONNET);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  describe("constructor", () => {
    it("should create adapter with default config", () => {
      vi.unstubAllEnvs();
      vi.stubEnv("ANTHROPIC_API_KEY", testApiKey);

      const defaultAdapter = new ClaudeAdapter();
      const config = defaultAdapter.getConfig();

      expect(config.baseURL).toBe("https://api.anthropic.com");
      expect(config.defaultModel).toBe(CLAUDE_MODELS.CLAUDE_3_5_SONNET);
      expect(config.timeout).toBe(60000);
      expect(config.maxRetries).toBe(3);
      expect(config.apiKey).toBe("***REDACTED***");
    });

    it("should create adapter with custom config", () => {
      const customAdapter = new ClaudeAdapter(
        "sk-ant-custom-key",
        CLAUDE_MODELS.CLAUDE_3_OPUS,
        {
          timeout: 120000,
          maxRetries: 5,
          baseURL: "https://custom.anthropic.com",
        }
      );
      const config = customAdapter.getConfig();

      expect(config.baseURL).toBe("https://custom.anthropic.com");
      expect(config.defaultModel).toBe(CLAUDE_MODELS.CLAUDE_3_OPUS);
      expect(config.timeout).toBe(120000);
      expect(config.maxRetries).toBe(5);
    });

    it("should throw error if API key is not provided", () => {
      vi.unstubAllEnvs();
      expect(() => new ClaudeAdapter()).toThrow(ClaudeAdapterError);
      expect(() => new ClaudeAdapter()).toThrow("ANTHROPIC_API_KEY");
    });

    it("should expose actual API key via getApiKey()", () => {
      expect(adapter.getApiKey()).toBe(testApiKey);
    });
  });

  describe("execute", () => {
    it("should execute a request successfully", async () => {
      const mockResponse = {
        id: "msg-123",
        type: "message",
        content: [
          {
            type: "text",
            text: "42",
          },
        ],
        model: CLAUDE_MODELS.CLAUDE_3_5_SONNET,
        stop_reason: "end_turn",
        usage: {
          input_tokens: 10,
          output_tokens: 2,
        },
      };

      mockPost.mockResolvedValueOnce({ data: mockResponse });

      const decision: RoutingDecision = {
        backend: "cloud",
        model: CLAUDE_MODELS.CLAUDE_3_5_SONNET,
        confidence: 1.0,
        reason: "Test",
        appliedPrinciples: [],
      };

      const result = await adapter.execute(decision, "What is 2+2?");

      expect(result.content).toBe("42");
      expect(result.model).toBe(CLAUDE_MODELS.CLAUDE_3_5_SONNET);
      expect(result.tokensUsed).toBe(12);
      expect(result.backend).toBe("cloud");
      expect(result.latency).toBeGreaterThan(0);
    });

    it("should retry on rate limit errors", async () => {
      let attemptCount = 0;
      const mockResponse = {
        id: "msg-123",
        type: "message",
        content: [{ type: "text", text: "42" }],
        model: CLAUDE_MODELS.CLAUDE_3_5_SONNET,
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 2 },
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
        model: CLAUDE_MODELS.CLAUDE_3_5_SONNET,
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
        id: "msg-456",
        type: "message",
        content: [{ type: "text", text: "Hello!" }],
        model: CLAUDE_MODELS.CLAUDE_3_5_SONNET,
        stop_reason: "end_turn",
        usage: { input_tokens: 5, output_tokens: 2 },
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
        id: "msg-health",
        type: "message",
        content: [{ type: "text", text: "OK" }],
        model: CLAUDE_MODELS.CLAUDE_3_5_SONNET,
        stop_reason: "end_turn",
        usage: { input_tokens: 1, output_tokens: 1 },
      };

      mockPost.mockResolvedValueOnce({ data: mockResponse });

      const health = await adapter.checkHealth();

      expect(health.healthy).toBe(true);
      expect(health.models).toContain(CLAUDE_MODELS.CLAUDE_3_5_SONNET);
      expect(health.currentModel).toBe(CLAUDE_MODELS.CLAUDE_3_5_SONNET);
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

  describe("createClaudeAdapter", () => {
    it("should create adapter using factory function", () => {
      const factoryAdapter = createClaudeAdapter(
        testApiKey,
        CLAUDE_MODELS.CLAUDE_3_HAIKU
      );

      expect(factoryAdapter).toBeInstanceOf(ClaudeAdapter);
      expect(factoryAdapter.getApiKey()).toBe(testApiKey);
    });
  });

  describe("CLAUDE_MODELS", () => {
    it("should export supported model constants", () => {
      expect(CLAUDE_MODELS.CLAUDE_3_5_SONNET).toBe("claude-3-5-sonnet-20241022");
      expect(CLAUDE_MODELS.CLAUDE_3_OPUS).toBe("claude-3-opus-20240229");
      expect(CLAUDE_MODELS.CLAUDE_3_HAIKU).toBe("claude-3-haiku-20240307");
    });
  });
});

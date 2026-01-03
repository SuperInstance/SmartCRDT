/**
 * Tests for AdapterFactory
 *
 * Tests the unified factory interface for creating adapters.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AdapterFactory,
  createAdapter,
  createAdapterFromEnv,
  createAdapterFromModel,
  type AdapterProvider,
} from "../AdapterFactory.js";

describe("AdapterFactory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    AdapterFactory.clearCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("create", () => {
    it("should create OpenAI adapter", () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");

      const adapter = AdapterFactory.create({
        provider: "openai",
        apiKey: "sk-test-key",
        defaultModel: "gpt-4",
      });

      expect(adapter).toBeDefined();
      expect(adapter.getConfig().defaultModel).toBe("gpt-4");
    });

    it("should create Claude adapter", () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");

      const adapter = AdapterFactory.create({
        provider: "claude",
        apiKey: "sk-ant-test-key",
        defaultModel: "claude-3-5-sonnet-20241022",
      });

      expect(adapter).toBeDefined();
      expect(adapter.getConfig().defaultModel).toBe("claude-3-5-sonnet-20241022");
    });

    it("should create Gemini adapter", () => {
      vi.stubEnv("GOOGLE_API_KEY", "AIza-test");

      const adapter = AdapterFactory.create({
        provider: "gemini",
        apiKey: "AIza-test-key",
        defaultModel: "gemini-1.5-pro",
      });

      expect(adapter).toBeDefined();
      expect(adapter.getConfig().defaultModel).toBe("gemini-1.5-pro");
    });

    it("should create Cohere adapter", () => {
      vi.stubEnv("COHERE_API_KEY", "xxx-test");

      const adapter = AdapterFactory.create({
        provider: "cohere",
        apiKey: "xxx-test-key",
        defaultModel: "command-r-plus",
      });

      expect(adapter).toBeDefined();
      expect(adapter.getConfig().defaultModel).toBe("command-r-plus");
    });

    it("should create Ollama adapter", () => {
      const adapter = AdapterFactory.create({
        provider: "ollama",
        defaultModel: "llama2",
        baseURL: "http://localhost:11434",
      });

      expect(adapter).toBeDefined();
      expect(adapter.getConfig().defaultModel).toBe("llama2");
    });

    it("should throw error for unknown provider", () => {
      expect(() => {
        AdapterFactory.create({
          provider: "unknown" as AdapterProvider,
          apiKey: "test",
        });
      }).toThrow("Unknown provider");
    });

    it("should cache adapter instances by default", () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");

      const adapter1 = AdapterFactory.create({
        provider: "openai",
        apiKey: "sk-test-key",
        defaultModel: "gpt-4",
      });

      const adapter2 = AdapterFactory.create({
        provider: "openai",
        apiKey: "sk-test-key",
        defaultModel: "gpt-4",
      });

      expect(adapter1).toBe(adapter2);
    });

    it("should not cache when useCache is false", () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");

      const adapter1 = AdapterFactory.create(
        {
          provider: "openai",
          apiKey: "sk-test-key",
          defaultModel: "gpt-4",
        },
        false
      );

      const adapter2 = AdapterFactory.create(
        {
          provider: "openai",
          apiKey: "sk-test-key",
          defaultModel: "gpt-4",
        },
        false
      );

      expect(adapter1).not.toBe(adapter2);
    });
  });

  describe("fromEnv", () => {
    it("should create OpenAI adapter from environment", () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-env-key");
      vi.stubEnv("OPENAI_MODEL", "gpt-3.5-turbo");

      const adapter = AdapterFactory.fromEnv("openai");

      expect(adapter).toBeDefined();
      expect(adapter.getConfig().defaultModel).toBe("gpt-3.5-turbo");
    });

    it("should create Claude adapter from environment", () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-env-key");
      vi.stubEnv("ANTHROPIC_MODEL", "claude-3-opus-20240229");

      const adapter = AdapterFactory.fromEnv("claude");

      expect(adapter).toBeDefined();
      expect(adapter.getConfig().defaultModel).toBe("claude-3-opus-20240229");
    });

    it("should create Gemini adapter from environment", () => {
      vi.stubEnv("GOOGLE_API_KEY", "AIza-env-key");
      vi.stubEnv("GOOGLE_MODEL", "gemini-1.5-flash");

      const adapter = AdapterFactory.fromEnv("gemini");

      expect(adapter).toBeDefined();
      expect(adapter.getConfig().defaultModel).toBe("gemini-1.5-flash");
    });

    it("should create Cohere adapter from environment", () => {
      vi.stubEnv("COHERE_API_KEY", "xxx-env-key");
      vi.stubEnv("COHERE_MODEL", "command-r");

      const adapter = AdapterFactory.fromEnv("cohere");

      expect(adapter).toBeDefined();
      expect(adapter.getConfig().defaultModel).toBe("command-r");
    });

    it("should create Ollama adapter from environment", () => {
      vi.stubEnv("OLLAMA_BASE_URL", "http://localhost:11434");
      vi.stubEnv("OLLAMA_MODEL", "qwen2.5:3b");

      const adapter = AdapterFactory.fromEnv("ollama");

      expect(adapter).toBeDefined();
      expect(adapter.getConfig().defaultModel).toBe("qwen2.5:3b");
    });
  });

  describe("fromModel", () => {
    it("should auto-detect OpenAI from model name", () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");

      const adapter = AdapterFactory.fromModel("gpt-4");

      expect(adapter).toBeDefined();
      expect(adapter.getConfig().defaultModel).toBe("gpt-4");
    });

    it("should auto-detect Claude from model name", () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");

      const adapter = AdapterFactory.fromModel("claude-3-5-sonnet-20241022");

      expect(adapter).toBeDefined();
      expect(adapter.getConfig().defaultModel).toBe("claude-3-5-sonnet-20241022");
    });

    it("should auto-detect Gemini from model name", () => {
      vi.stubEnv("GOOGLE_API_KEY", "AIza-test");

      const adapter = AdapterFactory.fromModel("gemini-1.5-pro");

      expect(adapter).toBeDefined();
      expect(adapter.getConfig().defaultModel).toBe("gemini-1.5-pro");
    });

    it("should auto-detect Cohere from model name", () => {
      vi.stubEnv("COHERE_API_KEY", "xxx-test");

      const adapter = AdapterFactory.fromModel("command-r-plus");

      expect(adapter).toBeDefined();
      expect(adapter.getConfig().defaultModel).toBe("command-r-plus");
    });

    it("should default to Ollama for unknown models", () => {
      const adapter = AdapterFactory.fromModel("llama2");

      expect(adapter).toBeDefined();
      expect(adapter.getConfig().defaultModel).toBe("llama2");
    });
  });

  describe("createMany", () => {
    it("should create multiple adapters at once", () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");
      vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
      vi.stubEnv("GOOGLE_API_KEY", "AIza-test");
      vi.stubEnv("COHERE_API_KEY", "xxx-test");

      const adapters = AdapterFactory.createMany([
        { provider: "openai", apiKey: "sk-test-1", defaultModel: "gpt-4" },
        { provider: "claude", apiKey: "sk-ant-test-1", defaultModel: "claude-3-5-sonnet-20241022" },
        { provider: "gemini", apiKey: "AIza-test-1", defaultModel: "gemini-1.5-pro" },
        { provider: "cohere", apiKey: "xxx-test-1", defaultModel: "command-r-plus" },
      ]);

      expect(adapters.size).toBe(4);
      expect(adapters.get("openai")).toBeDefined();
      expect(adapters.get("claude")).toBeDefined();
      expect(adapters.get("gemini")).toBeDefined();
      expect(adapters.get("cohere")).toBeDefined();
    });
  });

  describe("getSupportedProviders", () => {
    it("should return list of supported providers", () => {
      const providers = AdapterFactory.getSupportedProviders();

      expect(providers).toContain("openai");
      expect(providers).toContain("ollama");
      expect(providers).toContain("claude");
      expect(providers).toContain("gemini");
      expect(providers).toContain("cohere");
      expect(providers).toHaveLength(5);
    });
  });

  describe("isSupportedProvider", () => {
    it("should return true for supported providers", () => {
      expect(AdapterFactory.isSupportedProvider("openai")).toBe(true);
      expect(AdapterFactory.isSupportedProvider("claude")).toBe(true);
      expect(AdapterFactory.isSupportedProvider("gemini")).toBe(true);
      expect(AdapterFactory.isSupportedProvider("cohere")).toBe(true);
      expect(AdapterFactory.isSupportedProvider("ollama")).toBe(true);
    });

    it("should return false for unsupported providers", () => {
      expect(AdapterFactory.isSupportedProvider("unknown")).toBe(false);
      expect(AdapterFactory.isSupportedProvider("huggingface")).toBe(false);
    });
  });

  describe("getDefaultModel", () => {
    it("should return default model for each provider", () => {
      expect(AdapterFactory.getDefaultModel("openai")).toBe("gpt-3.5-turbo");
      expect(AdapterFactory.getDefaultModel("ollama")).toBe("llama2");
      expect(AdapterFactory.getDefaultModel("claude")).toBe("claude-3-5-sonnet-20241022");
      expect(AdapterFactory.getDefaultModel("gemini")).toBe("gemini-1.5-pro");
      expect(AdapterFactory.getDefaultModel("cohere")).toBe("command-r-plus");
    });
  });

  describe("getAvailableModels", () => {
    it("should return available models for each provider", () => {
      const openaiModels = AdapterFactory.getAvailableModels("openai");
      expect(openaiModels).toContain("gpt-4");
      expect(openaiModels).toContain("gpt-3.5-turbo");

      const claudeModels = AdapterFactory.getAvailableModels("claude");
      expect(claudeModels).toContain("claude-3-5-sonnet-20241022");
      expect(claudeModels).toContain("claude-3-opus-20240229");

      const geminiModels = AdapterFactory.getAvailableModels("gemini");
      expect(geminiModels).toContain("gemini-1.5-pro");
      expect(geminiModels).toContain("gemini-1.5-flash");

      const cohereModels = AdapterFactory.getAvailableModels("cohere");
      expect(cohereModels).toContain("command-r-plus");
      expect(cohereModels).toContain("command-r");

      const ollamaModels = AdapterFactory.getAvailableModels("ollama");
      expect(ollamaModels).toContain("llama2");
      expect(ollamaModels).toContain("mistral");
    });
  });

  describe("clearCache", () => {
    it("should clear adapter cache", () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");

      const adapter1 = AdapterFactory.create({
        provider: "openai",
        apiKey: "sk-test-key",
        defaultModel: "gpt-4",
      });

      AdapterFactory.clearCache();

      const adapter2 = AdapterFactory.create({
        provider: "openai",
        apiKey: "sk-test-key",
        defaultModel: "gpt-4",
      });

      expect(adapter1).not.toBe(adapter2);
    });
  });

  describe("convenience functions", () => {
    it("createAdapter should work like AdapterFactory.create", () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");

      const adapter = createAdapter({
        provider: "openai",
        apiKey: "sk-test-key",
        defaultModel: "gpt-4",
      });

      expect(adapter).toBeDefined();
    });

    it("createAdapterFromEnv should work like AdapterFactory.fromEnv", () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");

      const adapter = createAdapterFromEnv("openai");

      expect(adapter).toBeDefined();
    });

    it("createAdapterFromModel should work like AdapterFactory.fromModel", () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");

      const adapter = createAdapterFromModel("gpt-4");

      expect(adapter).toBeDefined();
    });
  });
});

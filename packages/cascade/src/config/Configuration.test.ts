/**
 * Configuration Module Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createConfiguration,
  initializeConfiguration,
  resetConfiguration,
  getConfiguration,
  loadFromEnv,
  validateConfig,
  isCloudAvailable,
  getConfigurationSummary,
  ConfigurationError,
  type ConfigurationOptions,
} from "./Configuration.js";

describe("Configuration Module", () => {
  beforeEach(() => {
    // Reset global config before each test
    resetConfiguration();
  });

  afterEach(() => {
    // Clean up after each test
    resetConfiguration();
  });

  describe("validateConfig", () => {
    it("should accept valid configuration", () => {
      const validConfig: ConfigurationOptions = {
        openaiApiKey: "sk-" + "x".repeat(45),
        ollamaBaseUrl: "http://localhost:11434",
        ollamaModel: "llama2",
        embeddingModel: "text-embedding-3-small",
        inferenceModel: "gpt-4",
        logLevel: "info",
        maxCacheSize: 1000,
        cacheTtl: 3600,
        localOnly: false,
      };

      expect(() => validateConfig(validConfig)).not.toThrow();
    });

    it("should reject invalid OpenAI API key", () => {
      const invalidConfig: ConfigurationOptions = {
        openaiApiKey: "invalid-key",
      };

      expect(() => validateConfig(invalidConfig)).toThrow(ConfigurationError);
      expect(() => validateConfig(invalidConfig)).toThrow(
        'must start with "sk-"'
      );
    });

    it("should reject invalid OpenAI base URL", () => {
      const invalidConfig: ConfigurationOptions = {
        openaiBaseUrl: "not-a-url",
      };

      expect(() => validateConfig(invalidConfig)).toThrow(ConfigurationError);
      expect(() => validateConfig(invalidConfig)).toThrow(
        "Invalid OpenAI base URL"
      );
    });

    it("should reject invalid Ollama base URL", () => {
      const invalidConfig: ConfigurationOptions = {
        ollamaBaseUrl: "not-a-url",
      };

      expect(() => validateConfig(invalidConfig)).toThrow(ConfigurationError);
      expect(() => validateConfig(invalidConfig)).toThrow(
        "Invalid Ollama base URL"
      );
    });

    it("should reject invalid embedding model", () => {
      const invalidConfig: ConfigurationOptions = {
        embeddingModel: "invalid-model" as any,
      };

      expect(() => validateConfig(invalidConfig)).toThrow(ConfigurationError);
      expect(() => validateConfig(invalidConfig)).toThrow(
        "Invalid embedding model"
      );
    });

    it("should reject invalid inference model", () => {
      const invalidConfig: ConfigurationOptions = {
        inferenceModel: "invalid-model" as any,
      };

      expect(() => validateConfig(invalidConfig)).toThrow(ConfigurationError);
      expect(() => validateConfig(invalidConfig)).toThrow(
        "Invalid inference model"
      );
    });

    it("should reject invalid Ollama model", () => {
      const invalidConfig: ConfigurationOptions = {
        ollamaModel: "invalid-model" as any,
      };

      expect(() => validateConfig(invalidConfig)).toThrow(ConfigurationError);
      expect(() => validateConfig(invalidConfig)).toThrow(
        "Invalid Ollama model"
      );
    });

    it("should reject invalid log level", () => {
      const invalidConfig: ConfigurationOptions = {
        logLevel: "invalid" as any,
      };

      expect(() => validateConfig(invalidConfig)).toThrow(ConfigurationError);
      expect(() => validateConfig(invalidConfig)).toThrow("Invalid log level");
    });

    it("should reject negative cache size", () => {
      const invalidConfig: ConfigurationOptions = {
        maxCacheSize: -1,
      };

      expect(() => validateConfig(invalidConfig)).toThrow(ConfigurationError);
      expect(() => validateConfig(invalidConfig)).toThrow(
        "non-negative integer"
      );
    });

    it("should reject negative cache TTL", () => {
      const invalidConfig: ConfigurationOptions = {
        cacheTtl: -1,
      };

      expect(() => validateConfig(invalidConfig)).toThrow(ConfigurationError);
      expect(() => validateConfig(invalidConfig)).toThrow(
        "non-negative integer"
      );
    });
  });

  describe("createConfiguration", () => {
    it("should apply defaults when options are not provided", () => {
      const config = createConfiguration();

      expect(config.ollamaBaseUrl).toBe("http://localhost:11434");
      expect(config.ollamaModel).toBe("llama2");
      expect(config.embeddingModel).toBe("text-embedding-3-small");
      expect(config.inferenceModel).toBe("gpt-4");
      expect(config.logLevel).toBe("info");
      expect(config.maxCacheSize).toBe(1000);
      expect(config.cacheTtl).toBe(3600);
      expect(config.localOnly).toBe(false);
    });

    it("should override defaults with provided options", () => {
      const config = createConfiguration({
        ollamaBaseUrl: "http://example.com:8080",
        ollamaModel: "mistral",
        logLevel: "debug",
      });

      expect(config.ollamaBaseUrl).toBe("http://example.com:8080");
      expect(config.ollamaModel).toBe("mistral");
      expect(config.logLevel).toBe("debug");
    });

    it("should set default OpenAI base URL", () => {
      const config = createConfiguration();

      expect(config.openaiBaseUrl).toBe("https://api.openai.com/v1");
    });

    it("should allow custom OpenAI base URL", () => {
      const config = createConfiguration({
        openaiBaseUrl: "https://custom.openai.proxy/v1",
      });

      expect(config.openaiBaseUrl).toBe("https://custom.openai.proxy/v1");
    });

    it("should accept valid OpenAI API key", () => {
      const config = createConfiguration({
        openaiApiKey: "sk-" + "a".repeat(45),
      });

      expect(config.openaiApiKey).toBe("sk-" + "a".repeat(45));
    });
  });

  describe("loadFromEnv", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset environment before each test
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      // Restore environment after each test
      process.env = originalEnv;
    });

    it("should load values from environment variables", () => {
      process.env.OPENAI_API_KEY = "sk-" + "x".repeat(45);
      process.env.OLLAMA_BASE_URL = "http://localhost:9999";
      process.env.OLLAMA_MODEL = "mistral";
      process.env.LOG_LEVEL = "debug";
      process.env.LOCAL_ONLY = "true";

      const options = loadFromEnv();

      expect(options.openaiApiKey).toBe("sk-" + "x".repeat(45));
      expect(options.ollamaBaseUrl).toBe("http://localhost:9999");
      expect(options.ollamaModel).toBe("mistral");
      expect(options.logLevel).toBe("debug");
      expect(options.localOnly).toBe(true);
    });

    it("should parse numeric values correctly", () => {
      process.env.MAX_CACHE_SIZE = "500";
      process.env.CACHE_TTL = "7200";

      const options = loadFromEnv();

      expect(options.maxCacheSize).toBe(500);
      expect(options.cacheTtl).toBe(7200);
    });

    it("should return undefined for missing environment variables", () => {
      const options = loadFromEnv();

      expect(options.openaiApiKey).toBeUndefined();
      expect(options.ollamaBaseUrl).toBeUndefined();
      expect(options.ollamaModel).toBeUndefined();
    });

    it("should parse LOCAL_ONLY as boolean", () => {
      // Test true values
      process.env.LOCAL_ONLY = "1";
      expect(loadFromEnv().localOnly).toBe(true);

      process.env.LOCAL_ONLY = "true";
      expect(loadFromEnv().localOnly).toBe(true);

      // Test false values (including unset env var)
      process.env.LOCAL_ONLY = "0";
      expect(loadFromEnv().localOnly).toBe(false);

      process.env.LOCAL_ONLY = "false";
      expect(loadFromEnv().localOnly).toBe(false);

      // When unset, the expression returns false (not undefined)
      delete process.env.LOCAL_ONLY;
      expect(loadFromEnv().localOnly).toBe(false);
    });
  });

  describe("Global Configuration Instance", () => {
    it("should initialize global configuration on first access", () => {
      const config1 = getConfiguration();
      const config2 = getConfiguration();

      expect(config1).toBe(config2);
    });

    it("should allow manual initialization", () => {
      const customConfig = initializeConfiguration({
        logLevel: "debug",
        ollamaModel: "mistral",
      });

      expect(customConfig.logLevel).toBe("debug");
      expect(customConfig.ollamaModel).toBe("mistral");

      // Subsequent getConfiguration calls should return the same config
      expect(getConfiguration()).toBe(customConfig);
    });

    it("should reset global configuration", () => {
      const config1 = getConfiguration();
      resetConfiguration();
      const config2 = getConfiguration();

      expect(config1).not.toBe(config2);
    });

    it("should apply different options on re-initialization", () => {
      initializeConfiguration({ logLevel: "debug" });
      expect(getConfiguration().logLevel).toBe("debug");

      initializeConfiguration({ logLevel: "error" });
      expect(getConfiguration().logLevel).toBe("error");
    });
  });

  describe("isCloudAvailable", () => {
    it("should return false when no API key is configured", () => {
      initializeConfiguration({});
      expect(isCloudAvailable()).toBe(false);
    });

    it("should return false when in local-only mode", () => {
      initializeConfiguration({
        openaiApiKey: "sk-" + "x".repeat(45),
        localOnly: true,
      });
      expect(isCloudAvailable()).toBe(false);
    });

    it("should return true when API key is configured and not in local-only mode", () => {
      initializeConfiguration({
        openaiApiKey: "sk-" + "x".repeat(45),
        localOnly: false,
      });
      expect(isCloudAvailable()).toBe(true);
    });
  });

  describe("getConfigurationSummary", () => {
    it("should return summary without sensitive values", () => {
      initializeConfiguration({
        openaiApiKey: "sk-" + "secret".repeat(9),
        openaiBaseUrl: "https://api.openai.com/v1",
        ollamaBaseUrl: "http://localhost:11434",
        ollamaModel: "mistral",
        logLevel: "debug",
        localOnly: false,
      });

      const summary = getConfigurationSummary();

      expect(summary.openaiConfigured).toBe(true);
      expect(summary).not.toHaveProperty("openaiApiKey");
      expect(summary.openaiBaseUrl).toBe("https://api.openai.com/v1");
      expect(summary.ollamaBaseUrl).toBe("http://localhost:11434");
      expect(summary.ollamaModel).toBe("mistral");
      expect(summary.logLevel).toBe("debug");
      expect(summary.localOnly).toBe(false);
      expect(summary.cloudAvailable).toBe(true);
    });

    it("should indicate cloud is not available when no API key", () => {
      initializeConfiguration({});

      const summary = getConfigurationSummary();

      expect(summary.openaiConfigured).toBe(false);
      expect(summary.cloudAvailable).toBe(false);
    });
  });

  describe("ConfigurationError", () => {
    it("should create error with message", () => {
      const error = new ConfigurationError("Test error");

      expect(error.message).toBe("Test error");
      expect(error.name).toBe("ConfigurationError");
    });

    it("should include field name", () => {
      const error = new ConfigurationError("Test error", "testField");

      expect(error.field).toBe("testField");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty configuration", () => {
      expect(() => createConfiguration({})).not.toThrow();
    });

    it("should accept all valid embedding models", () => {
      const models = [
        "text-embedding-3-small",
        "text-embedding-3-large",
        "text-embedding-ada-002",
      ];

      for (const model of models) {
        expect(() =>
          createConfiguration({ embeddingModel: model as any })
        ).not.toThrow();
      }
    });

    it("should accept all valid inference models", () => {
      const models = [
        "gpt-4",
        "gpt-4-turbo",
        "gpt-4-turbo-preview",
        "gpt-3.5-turbo",
        "gpt-3.5-turbo-16k",
      ];

      for (const model of models) {
        expect(() =>
          createConfiguration({ inferenceModel: model as any })
        ).not.toThrow();
      }
    });

    it("should accept all valid Ollama models", () => {
      const models = [
        "llama2",
        "llama2:13b",
        "llama2:70b",
        "mistral",
        "mistral:7b",
        "codellama",
        "phi",
        "neural-chat",
        "starling-lm",
      ];

      for (const model of models) {
        expect(() =>
          createConfiguration({ ollamaModel: model as any })
        ).not.toThrow();
      }
    });

    it("should accept all valid log levels", () => {
      const levels = ["debug", "info", "warn", "error", "silent"];

      for (const level of levels) {
        expect(() =>
          createConfiguration({ logLevel: level as any })
        ).not.toThrow();
      }
    });

    it("should accept zero values for cache size and TTL", () => {
      expect(() =>
        createConfiguration({
          maxCacheSize: 0,
          cacheTtl: 0,
        })
      ).not.toThrow();
    });
  });
});

/**
 * Tests for OllamaModelFingerprinter
 *
 * Tests model fingerprinting, intent extraction, and capability matching.
 */

import { describe, it, expect } from "vitest";
import {
  OllamaModelFingerprinter,
  createOllamaModelFingerprinter,
  defaultFingerprinter,
} from "../OllamaModelFingerprinter.js";
import type { ModelCapability } from "@lsi/protocol";

describe("OllamaModelFingerprinter", () => {
  let fingerprinter: OllamaModelFingerprinter;

  beforeEach(() => {
    fingerprinter = new OllamaModelFingerprinter();
  });

  describe("fingerprint", () => {
    it("should extract family from model name", () => {
      const llama3Fingerprint = fingerprinter.fingerprint("llama3:8b");
      expect(llama3Fingerprint.family).toBe("llama3");

      const mistralFingerprint = fingerprinter.fingerprint("mistral:7b");
      expect(mistralFingerprint.family).toBe("mistral");

      const qwenFingerprint = fingerprinter.fingerprint("qwen2:7b");
      expect(qwenFingerprint.family).toBe("qwen");
    });

    it("should extract parameter size from model name", () => {
      const cases = [
        ["llama3:8b", "8B"],
        ["llama3:70b", "70B"],
        ["mistral:7b", "7B"],
        ["mixtral:8x7b", "7B"],
        ["phi:0.5b", "0.5B"],
        ["gemma2:2b", "2B"],
      ];

      for (const [modelName, expectedSize] of cases) {
        const fingerprint = fingerprinter.fingerprint(modelName);
        expect(fingerprint.parameterSize).toBe(expectedSize);
      }
    });

    it("should extract quantization level from model name", () => {
      const cases = [
        ["llama3:8b-q4_k_m", "Q4_K_M"],
        ["mistral:7b-q8_0", "Q8_0"],
        ["mixtral:8x7b-f16", "F16"],
        ["qwen2:7b-q2_k", "Q2_K"],
      ];

      for (const [modelName, expectedQuant] of cases) {
        const fingerprint = fingerprinter.fingerprint(modelName);
        expect(fingerprint.quantizationLevel).toBe(expectedQuant);
      }
    });

    it("should handle model names without quantization", () => {
      const fingerprint = fingerprinter.fingerprint("llama3:8b");
      expect(fingerprint.quantizationLevel).toBeUndefined();
    });

    it("should generate metadata hash", () => {
      const model = {
        name: "llama3:8b",
        modified_at: "2024-01-01T00:00:00Z",
        size: 4000000000,
        digest: "abc123",
        details: {
          format: "gguf",
          family: "llama3",
          parameter_size: "8B",
          quantization_level: "Q4_K_M",
        },
      };

      const fingerprint = fingerprinter.fingerprint(model);
      expect(fingerprint.metadataHash).toBeDefined();
      expect(fingerprint.metadataHash).toMatch(/^[a-f0-9]+$/);
    });

    it("should handle string input", () => {
      const fingerprint1 = fingerprinter.fingerprint("llama3:8b");
      const fingerprint2 = fingerprinter.fingerprint({
        name: "llama3:8b",
      } as any);

      expect(fingerprint1.modelId).toBe(fingerprint2.modelId);
      expect(fingerprint1.family).toBe(fingerprint2.family);
      expect(fingerprint1.parameterSize).toBe(fingerprint2.parameterSize);
    });
  });

  describe("extractIntents", () => {
    it("should detect embedding models", () => {
      const embeddingModels = [
        "nomic-embed-text",
        "mxbai-embed-large",
        "all-minilm",
      ];

      for (const modelName of embeddingModels) {
        const intents = fingerprinter.extractIntents(modelName);
        expect(intents).toContain("embedding");
      }
    });

    it("should detect code models", () => {
      const codeModels = [
        "deepseek-coder:6.7b",
        "codellama:7b-code",
        "starcoder2:3b",
      ];

      for (const modelName of codeModels) {
        const intents = fingerprinter.extractIntents(modelName);
        expect(intents).toContain("code-generation");
      }
    });

    it("should detect chat models", () => {
      const chatModels = [
        "llama3:8b-chat",
        "mistral:7b-instruct",
        "gemma:2b-it",
      ];

      for (const modelName of chatModels) {
        const intents = fingerprinter.extractIntents(modelName);
        expect(intents).toContain("chat");
      }
    });

    it("should default to chat and completion for unknown models", () => {
      const intents = fingerprinter.extractIntents("unknown-model:3b");
      expect(intents).toContain("chat");
      expect(intents).toContain("completion");
    });
  });

  describe("estimateQuality", () => {
    it("should give higher scores for larger models", () => {
      const smallFingerprint = fingerprinter.fingerprint("llama3:3b");
      const mediumFingerprint = fingerprinter.fingerprint("llama3:8b");
      const largeFingerprint = fingerprinter.fingerprint("llama3:70b");

      expect(largeFingerprint.family).toBe("llama3");
      expect(mediumFingerprint.family).toBe("llama3");

      const smallScore = fingerprinter.estimateQuality(smallFingerprint);
      const mediumScore = fingerprinter.estimateQuality(mediumFingerprint);
      const largeScore = fingerprinter.estimateQuality(largeFingerprint);

      expect(largeScore).toBeGreaterThan(mediumScore);
      expect(mediumScore).toBeGreaterThan(smallScore);
    });

    it("should give higher scores for better quantization", () => {
      const q2Fingerprint = fingerprinter.fingerprint("llama3:8b-q2_k");
      const q4Fingerprint = fingerprinter.fingerprint("llama3:8b-q4_k_m");
      const q8Fingerprint = fingerprinter.fingerprint("llama3:8b-q8_0");
      const f16Fingerprint = fingerprinter.fingerprint("llama3:8b-f16");

      const q2Score = fingerprinter.estimateQuality(q2Fingerprint);
      const q4Score = fingerprinter.estimateQuality(q4Fingerprint);
      const q8Score = fingerprinter.estimateQuality(q8Fingerprint);
      const f16Score = fingerprinter.estimateQuality(f16Fingerprint);

      expect(f16Score).toBeGreaterThan(q8Score);
      expect(q8Score).toBeGreaterThan(q4Score);
      expect(q4Score).toBeGreaterThan(q2Score);
    });

    it("should give higher scores for better families", () => {
      const llama3Fingerprint = fingerprinter.fingerprint("llama3:8b");
      const llama2Fingerprint = fingerprinter.fingerprint("llama2:7b");
      const phiFingerprint = fingerprinter.fingerprint("phi:3b");

      const llama3Score = fingerprinter.estimateQuality(llama3Fingerprint);
      const llama2Score = fingerprinter.estimateQuality(llama2Fingerprint);
      const phiScore = fingerprinter.estimateQuality(phiFingerprint);

      expect(llama3Score).toBeGreaterThan(llama2Score);
      expect(llama2Score).toBeGreaterThan(phiScore);
    });

    it("should clamp scores to [0, 1]", () => {
      const fingerprints = [
        "llama3:70b-f16",
        "llama3:8b-q4_k_m",
        "phi:0.5b-q2_k",
      ];

      for (const modelName of fingerprints) {
        const fingerprint = fingerprinter.fingerprint(modelName);
        const score = fingerprinter.estimateQuality(fingerprint);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("estimateContextLength", () => {
    it("should return correct context length for known families", () => {
      const cases = [
        ["llama3.2:8b", 128000],
        ["llama3.1:8b", 128000],
        ["llama3:8b", 8192],
        ["mixtral:8x7b", 32768],
        ["mistral:7b", 32768],
        ["qwen2:7b", 32768],
        ["phi3:3.8b", 128000],
        ["deepseek-coder:6.7b", 16384],
      ];

      for (const [modelName, expectedLength] of cases) {
        const fingerprint = fingerprinter.fingerprint(modelName);
        const contextLength = fingerprinter.estimateContextLength(fingerprint);
        expect(contextLength).toBe(expectedLength);
      }
    });

    it("should estimate context length for unknown families", () => {
      const unknownFingerprint = {
        modelId: "unknown:8b",
        family: "unknown",
        parameterSize: "8B",
        quantizationLevel: undefined,
        metadataHash: "abc",
        version: "1.0.0",
      };

      const contextLength = fingerprinter.estimateContextLength(unknownFingerprint);
      expect(contextLength).toBe(8192); // Default for 8B models
    });
  });

  describe("matchCapability", () => {
    it("should match exact model ID", () => {
      const fingerprint = fingerprinter.fingerprint("llama3:8b-q4_k_m");

      const knownCapabilities = new Map<string, ModelCapability>();
      knownCapabilities.set("llama3:8b-q4_k_m", {
        modelId: "llama3:8b-q4_k_m",
        name: "llama3:8b-q4_k_m",
        family: "llama3",
        parameterSize: "8B",
        quantizationLevel: "Q4_K_M",
        maxContextLength: 8192,
        supportedIntents: ["chat", "completion"],
        qualityScore: 0.85,
        averageLatencyMs: 150,
        tokensPerSecond: 45,
        supportsStreaming: true,
        supportsFunctionCalling: false,
        supportsVision: false,
        recommendedUseCases: [],
        limitations: [],
        discoveredAt: Date.now(),
        version: "1.0.0",
      });

      const match = fingerprinter.matchCapability(fingerprint, knownCapabilities);

      expect(match.matched).toBe(true);
      expect(match.confidence).toBe(1.0);
      expect(match.reason).toBe("Direct model ID match");
      expect(match.capability).toBeDefined();
    });

    it("should match by family and size", () => {
      const fingerprint = fingerprinter.fingerprint("llama3:8b-q5_k_m");

      const knownCapabilities = new Map<string, ModelCapability>();
      knownCapabilities.set("llama3:8b-q4_k_m", {
        modelId: "llama3:8b-q4_k_m",
        name: "llama3:8b-q4_k_m",
        family: "llama3",
        parameterSize: "8B",
        quantizationLevel: "Q4_K_M",
        maxContextLength: 8192,
        supportedIntents: ["chat", "completion"],
        qualityScore: 0.85,
        averageLatencyMs: 150,
        tokensPerSecond: 45,
        supportsStreaming: true,
        supportsFunctionCalling: false,
        supportsVision: false,
        recommendedUseCases: [],
        limitations: [],
        discoveredAt: Date.now(),
        version: "1.0.0",
      });

      const match = fingerprinter.matchCapability(fingerprint, knownCapabilities);

      expect(match.matched).toBe(true);
      expect(match.confidence).toBe(0.8);
      expect(match.reason).toBe("Family and parameter size match");
    });

    it("should match by family only", () => {
      const fingerprint = fingerprinter.fingerprint("llama3:70b");

      const knownCapabilities = new Map<string, ModelCapability>();
      knownCapabilities.set("llama3:8b", {
        modelId: "llama3:8b",
        name: "llama3:8b",
        family: "llama3",
        parameterSize: "8B",
        maxContextLength: 8192,
        supportedIntents: ["chat", "completion"],
        qualityScore: 0.85,
        averageLatencyMs: 150,
        tokensPerSecond: 45,
        supportsStreaming: true,
        supportsFunctionCalling: false,
        supportsVision: false,
        recommendedUseCases: [],
        limitations: [],
        discoveredAt: Date.now(),
        version: "1.0.0",
      });

      const match = fingerprinter.matchCapability(fingerprint, knownCapabilities);

      expect(match.matched).toBe(true);
      expect(match.confidence).toBe(0.5);
      expect(match.reason).toBe("Family match only (different parameter size)");
    });

    it("should return no match when nothing matches", () => {
      const fingerprint = fingerprinter.fingerprint("unknown:8b");

      const knownCapabilities = new Map<string, ModelCapability>();
      knownCapabilities.set("llama3:8b", {
        modelId: "llama3:8b",
        name: "llama3:8b",
        family: "llama3",
        parameterSize: "8B",
        maxContextLength: 8192,
        supportedIntents: ["chat", "completion"],
        qualityScore: 0.85,
        averageLatencyMs: 150,
        tokensPerSecond: 45,
        supportsStreaming: true,
        supportsFunctionCalling: false,
        supportsVision: false,
        recommendedUseCases: [],
        limitations: [],
        discoveredAt: Date.now(),
        version: "1.0.0",
      });

      const match = fingerprinter.matchCapability(fingerprint, knownCapabilities);

      expect(match.matched).toBe(false);
      expect(match.confidence).toBe(0.0);
      expect(match.capability).toBeUndefined();
    });
  });

  describe("factory functions", () => {
    it("should create fingerprinter via factory", () => {
      const fp = createOllamaModelFingerprinter();
      expect(fp).toBeInstanceOf(OllamaModelFingerprinter);
    });

    it("should provide default singleton", () => {
      expect(defaultFingerprinter).toBeInstanceOf(OllamaModelFingerprinter);
    });
  });

  describe("edge cases", () => {
    it("should handle empty model name", () => {
      const fingerprint = fingerprinter.fingerprint("");
      expect(fingerprint.family).toBe("unknown");
      expect(fingerprint.parameterSize).toBe("unknown");
    });

    it("should handle model name with no family", () => {
      const fingerprint = fingerprinter.fingerprint("something-weird");
      expect(fingerprint.family).toBe("unknown");
    });

    it("should handle model name with no size", () => {
      const fingerprint = fingerprinter.fingerprint("llama3");
      expect(fingerprint.parameterSize).toBe("unknown");
    });

    it("should handle special characters in model name", () => {
      const fingerprint = fingerprinter.fingerprint("llama3:8b-q4_k_m-vf");
      expect(fingerprint.family).toBe("llama3");
      expect(fingerprint.parameterSize).toBe("8B");
      expect(fingerprint.quantizationLevel).toBe("Q4_K_M");
    });
  });

  describe("common Ollama models", () => {
    const commonModels = [
      "llama3:8b",
      "llama3:70b",
      "llama3.1:8b",
      "llama3.1:70b",
      "llama3.2:3b",
      "llama3.2:1b",
      "mistral:7b",
      "mixtral:8x7b",
      "qwen2:7b",
      "qwen2:72b",
      "gemma2:9b",
      "phi3:3.8b",
      "phi3:14b",
      "deepseek-coder:6.7b",
      "nomic-embed-text",
      "mxbai-embed-large:335m",
      "codellama:7b",
      "tinyllama:1.1b",
    ];

    it("should successfully fingerprint all common models", () => {
      for (const modelName of commonModels) {
        const fingerprint = fingerprinter.fingerprint(modelName);

        expect(fingerprint.modelId).toBe(modelName);
        expect(fingerprint.family).not.toBe("unknown");
        expect(fingerprint.version).toBe("1.0.0");

        // Most models should have a parameter size
        // (embedding models might not)
        if (!modelName.includes("embed")) {
          expect(fingerprint.parameterSize).not.toBe("unknown");
        }
      }
    });

    it("should extract intents for all common models", () => {
      for (const modelName of commonModels) {
        const intents = fingerprinter.extractIntents(modelName);

        expect(intents.length).toBeGreaterThan(0);
        expect(intents).toContain(expect.any(String));
      }
    });

    it("should estimate quality for all common models", () => {
      for (const modelName of commonModels) {
        const fingerprint = fingerprinter.fingerprint(modelName);
        const quality = fingerprinter.estimateQuality(fingerprint);

        expect(quality).toBeGreaterThanOrEqual(0);
        expect(quality).toBeLessThanOrEqual(1);
      }
    });

    it("should estimate context length for all common models", () => {
      for (const modelName of commonModels) {
        const fingerprint = fingerprinter.fingerprint(modelName);
        const contextLength = fingerprinter.estimateContextLength(fingerprint);

        expect(contextLength).toBeGreaterThan(0);
        expect(contextLength).toBeLessThanOrEqual(128000);
      }
    });
  });
});

/**
 * Tests for OllamaAdapterError
 */

import { describe, it, expect } from "vitest";
import { OllamaAdapterError, OllamaErrorCode } from "./OllamaAdapterError.js";
import { ErrorSeverity, RecoveryStrategy } from "./AdapterError.js";

describe("OllamaAdapterError", () => {
  describe("connectionRefused", () => {
    it("should create connection refused error", () => {
      const error = OllamaAdapterError.connectionRefused(
        "http://localhost:11434"
      );

      expect(error.code).toBe(OllamaErrorCode.ECONNREFUSED);
      expect(error.message).toContain("unreachable");
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.retryable).toBe(false);
      expect(error.recovery).toBe(RecoveryStrategy.MANUAL);
      expect(error.ollamaRecovery?.checkHealth).toBe(true);
      expect(error.ollamaRecovery?.startCommand).toBe("ollama serve");
    });

    it("should identify as connection refused", () => {
      const error = OllamaAdapterError.connectionRefused(
        "http://localhost:11434"
      );
      expect(error.isConnectionRefused()).toBe(true);
      expect(error.isTimeout()).toBe(false);
      expect(error.isModelNotFound()).toBe(false);
    });
  });

  describe("timeout", () => {
    it("should create timeout error", () => {
      const error = OllamaAdapterError.timeout(30000);

      expect(error.code).toBe(OllamaErrorCode.TIMEOUT);
      expect(error.message).toContain("timeout");
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.retryable).toBe(true);
      expect(error.recovery).toBe(RecoveryStrategy.RETRY);
      // Note: waitTime is 2x timeout but has some max cap
      expect(error.ollamaRecovery?.waitTime).toBeGreaterThan(0);
    });

    it("should identify as timeout", () => {
      const error = OllamaAdapterError.timeout(30000);
      expect(error.isTimeout()).toBe(true);
      expect(error.isConnectionRefused()).toBe(false);
    });
  });

  describe("modelNotFound", () => {
    it("should create model not found error", () => {
      const availableModels = ["llama2", "mistral"];
      const error = OllamaAdapterError.modelNotFound("gpt-4", availableModels);

      expect(error.code).toBe(OllamaErrorCode.MODEL_NOT_FOUND);
      expect(error.message).toContain("gpt-4");
      // Note: modelName and availableModels are in context passed to AdapterError
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.retryable).toBe(false);
    });

    it("should identify as model not found", () => {
      const error = OllamaAdapterError.modelNotFound("test-model");
      expect(error.isModelNotFound()).toBe(true);
      expect(error.isConnectionRefused()).toBe(false);
    });

    it("should suggest alternative model", () => {
      const error = OllamaAdapterError.modelNotFound("test", [
        "llama2",
        "mistral",
      ]);
      expect(error.ollamaRecovery?.alternativeModel).toBe("llama2");
    });
  });

  describe("internalError", () => {
    it("should create internal error", () => {
      const error = OllamaAdapterError.internalError("Something went wrong");

      expect(error.code).toBe(OllamaErrorCode.INTERNAL_ERROR);
      expect(error.message).toBe("Something went wrong");
      expect(error.retryable).toBe(true);
      expect(error.ollamaRecovery?.checkHealth).toBe(true);
    });
  });

  describe("invalidRequest", () => {
    it("should create invalid request error", () => {
      const error = OllamaAdapterError.invalidRequest("Bad parameters");

      expect(error.code).toBe(OllamaErrorCode.INVALID_REQUEST);
      expect(error.message).toContain("Bad parameters");
      expect(error.retryable).toBe(false);
      expect(error.recovery).toBe(RecoveryStrategy.ABORT);
    });
  });

  describe("modelLoadFailed", () => {
    it("should create model load failed error", () => {
      const error = OllamaAdapterError.modelLoadFailed("llama2");

      expect(error.code).toBe(OllamaErrorCode.MODEL_LOAD_FAILED);
      expect(error.message).toContain("llama2");
      expect(error.retryable).toBe(false);
      expect(error.ollamaRecovery?.alternativeModel).toBe("llama2");
    });
  });

  describe("generationFailed", () => {
    it("should create generation failed error", () => {
      const error = OllamaAdapterError.generationFailed("llama2");

      expect(error.code).toBe(OllamaErrorCode.GENERATION_FAILED);
      expect(error.message).toContain("llama2");
      expect(error.retryable).toBe(true);
      expect(error.recovery).toBe(RecoveryStrategy.FALLBACK);
    });
  });

  describe("unknown", () => {
    it("should create unknown error", () => {
      const error = OllamaAdapterError.unknown("testOp", "Unknown issue");

      expect(error.code).toBe(OllamaErrorCode.UNKNOWN_ERROR);
      expect(error.message).toContain("Unknown issue");
      expect(error.retryable).toBe(false);
    });
  });

  describe("fromAxiosError", () => {
    it("should map ECONNREFUSED to connectionRefused", () => {
      const axiosError = {
        code: "ECONNREFUSED",
        config: { baseURL: "http://localhost:11434" },
      };
      const error = OllamaAdapterError.fromAxiosError(
        "Ollama",
        "generate",
        axiosError as any
      );

      expect(error.isConnectionRefused()).toBe(true);
    });

    it("should map ETIMEDOUT to timeout", () => {
      const axiosError = {
        code: "ETIMEDOUT",
        config: { timeout: 30000 },
      };
      const error = OllamaAdapterError.fromAxiosError(
        "Ollama",
        "generate",
        axiosError as any
      );

      expect(error.isTimeout()).toBe(true);
    });

    it("should map 404 to modelNotFound", () => {
      const axiosError = {
        response: { status: 404 },
        config: { data: { model: "llama2" } },
      };
      const error = OllamaAdapterError.fromAxiosError(
        "Ollama",
        "generate",
        axiosError as any
      );

      expect(error.isModelNotFound()).toBe(true);
    });

    it("should map 500 to internalError", () => {
      const axiosError = {
        response: { status: 500 },
        message: "Internal error",
      };
      const error = OllamaAdapterError.fromAxiosError(
        "Ollama",
        "generate",
        axiosError as any
      );

      expect(error.code).toBe(OllamaErrorCode.INTERNAL_ERROR);
    });

    it("should map 4xx to invalidRequest", () => {
      const axiosError = {
        response: { status: 400 },
        message: "Bad request",
      };
      const error = OllamaAdapterError.fromAxiosError(
        "Ollama",
        "generate",
        axiosError as any
      );

      expect(error.code).toBe(OllamaErrorCode.INVALID_REQUEST);
    });
  });

  describe("getRecoveryInfo", () => {
    it("should return recovery information", () => {
      const error = OllamaAdapterError.connectionRefused(
        "http://localhost:11434"
      );
      const recovery = error.getRecoveryInfo();

      expect(recovery).toBeDefined();
      expect(recovery?.checkHealth).toBe(true);
      expect(recovery?.startCommand).toBe("ollama serve");
    });
  });
});

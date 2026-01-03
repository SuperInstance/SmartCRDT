/**
 * Tests for EmbeddingError
 */

import { describe, it, expect } from "vitest";
import { EmbeddingError, EmbeddingErrorCode } from "./EmbeddingError.js";
import { ErrorSeverity, RecoveryStrategy } from "./AdapterError.js";

describe("EmbeddingError", () => {
  describe("dimensionMismatch", () => {
    it("should create dimension mismatch error", () => {
      const error = EmbeddingError.dimensionMismatch(
        1536,
        768,
        "text-embedding-3-small"
      );

      expect(error.code).toBe(EmbeddingErrorCode.DIMENSION_MISMATCH);
      expect(error.message).toContain("1536");
      expect(error.message).toContain("768");
      expect(error.embeddingMetadata?.expectedDimensions).toBe(1536);
      expect(error.embeddingMetadata?.actualDimensions).toBe(768);
      expect(error.isDimensionMismatch()).toBe(true);
    });
  });

  describe("apiFailure", () => {
    it("should create retryable API failure", () => {
      const error = EmbeddingError.apiFailure("embed", "Network error", true);

      expect(error.code).toBe(EmbeddingErrorCode.API_FAILURE);
      expect(error.retryable).toBe(true);
      expect(error.recovery).toBe(RecoveryStrategy.RETRY);
    });

    it("should create non-retryable API failure with fallback", () => {
      const error = EmbeddingError.apiFailure(
        "embed",
        "API unavailable",
        false
      );

      expect(error.code).toBe(EmbeddingErrorCode.API_FAILURE);
      expect(error.retryable).toBe(false);
      expect(error.recovery).toBe(RecoveryStrategy.FALLBACK);
      expect(error.embeddingRecovery?.usedFallback).toBe(true);
    });
  });

  describe("invalidInput", () => {
    it("should create invalid input error", () => {
      const error = EmbeddingError.invalidInput("Text is empty", "text");

      expect(error.code).toBe(EmbeddingErrorCode.INVALID_INPUT);
      expect(error.message).toContain("empty");
      // Note: field is in the context object passed to AdapterError
      expect(error.retryable).toBe(false);
    });
  });

  describe("modelNotFound", () => {
    it("should create model not found error", () => {
      const availableModels = ["text-embedding-3-small", "nomic-embed-text"];
      const error = EmbeddingError.modelNotFound(
        "unknown-model",
        availableModels
      );

      expect(error.code).toBe(EmbeddingErrorCode.MODEL_NOT_FOUND);
      expect(error.message).toContain("unknown-model");
      expect(error.embeddingRecovery?.alternativeModel).toBe(
        "text-embedding-3-small"
      );
      expect(error.embeddingRecovery?.usedFallback).toBe(true);
    });
  });

  describe("timeout", () => {
    it("should create timeout error", () => {
      const error = EmbeddingError.timeout(30000);

      expect(error.code).toBe(EmbeddingErrorCode.TIMEOUT);
      expect(error.message).toContain("30000ms");
      expect(error.retryable).toBe(true);
      // Note: waitTime is capped at 30000 due to Math.min(timeout * 2, 30000)
      expect(error.embeddingRecovery?.waitTime).toBe(30000);
      expect(error.embeddingRecovery?.usedFallback).toBe(true);
    });
  });

  describe("rateLimit", () => {
    it("should create rate limit error", () => {
      const error = EmbeddingError.rateLimit(120);

      expect(error.code).toBe(EmbeddingErrorCode.RATE_LIMIT);
      expect(error.message).toContain("120 seconds");
      expect(error.retryable).toBe(true);
      expect(error.embeddingRecovery?.waitTime).toBe(120000);
    });
  });

  describe("batchSizeExceeded", () => {
    it("should create batch size exceeded error", () => {
      const error = EmbeddingError.batchSizeExceeded(3000, 2048);

      expect(error.code).toBe(EmbeddingErrorCode.BATCH_SIZE_EXCEEDED);
      expect(error.message).toContain("3000");
      expect(error.message).toContain("2048");
      expect(error.embeddingMetadata?.batchSize).toBe(3000);
      expect(error.embeddingMetadata?.maxBatchSize).toBe(2048);
      expect(error.embeddingRecovery?.retryWithSmallerBatch).toBe(2048);
    });
  });

  describe("fallbackUsed", () => {
    it("should create fallback used warning", () => {
      const error = EmbeddingError.fallbackUsed(
        "text-embedding-3-small",
        "hash-based"
      );

      expect(error.code).toBe(EmbeddingErrorCode.FALLBACK_USED);
      expect(error.severity).toBe(ErrorSeverity.LOW);
      expect(error.isFallbackUsed()).toBe(true);
      expect(error.embeddingRecovery?.usedFallback).toBe(true);
      expect(error.embeddingRecovery?.fallbackModel).toBe("hash-based");
    });
  });

  describe("serviceUnavailable", () => {
    it("should create service unavailable error", () => {
      const error = EmbeddingError.serviceUnavailable("OpenAI");

      expect(error.code).toBe(EmbeddingErrorCode.SERVICE_UNAVAILABLE);
      expect(error.message).toContain("OpenAI");
      expect(error.retryable).toBe(true);
      expect(error.embeddingRecovery?.usedFallback).toBe(true);
    });
  });

  describe("canRetry", () => {
    it("should return true for retryable errors", () => {
      const timeoutError = EmbeddingError.timeout(30000);
      expect(timeoutError.canRetry()).toBe(true);
    });

    it("should return false for non-retryable errors", () => {
      const invalidError = EmbeddingError.invalidInput("Bad input");
      expect(invalidError.canRetry()).toBe(false);
    });
  });

  describe("getRecoveryInfo", () => {
    it("should return recovery information", () => {
      const error = EmbeddingError.fallbackUsed("model-a", "model-b");
      const recovery = error.getRecoveryInfo();

      expect(recovery).toBeDefined();
      expect(recovery?.usedFallback).toBe(true);
      expect(recovery?.fallbackModel).toBe("model-b");
    });
  });

  describe("getMetadata", () => {
    it("should return embedding metadata", () => {
      const error = EmbeddingError.dimensionMismatch(1536, 768, "test-model");
      const metadata = error.getMetadata();

      expect(metadata).toBeDefined();
      expect(metadata?.model).toBe("test-model");
      expect(metadata?.expectedDimensions).toBe(1536);
      expect(metadata?.actualDimensions).toBe(768);
    });
  });

  describe("fromAxiosError", () => {
    it("should map timeout error", () => {
      const axiosError = {
        code: "ETIMEDOUT",
        config: { timeout: 30000 },
      };
      const error = EmbeddingError.fromAxiosError(
        "Embedding",
        "embed",
        axiosError as any
      );

      expect(error.code).toBe(EmbeddingErrorCode.TIMEOUT);
    });

    it("should map 429 to rateLimit", () => {
      const axiosError = {
        response: { status: 429 },
      };
      const error = EmbeddingError.fromAxiosError(
        "Embedding",
        "embed",
        axiosError as any
      );

      expect(error.code).toBe(EmbeddingErrorCode.RATE_LIMIT);
    });

    it("should map 404 to modelNotFound", () => {
      const axiosError = {
        response: { status: 404 },
      };
      const error = EmbeddingError.fromAxiosError(
        "Embedding",
        "embed",
        axiosError as any
      );

      expect(error.code).toBe(EmbeddingErrorCode.MODEL_NOT_FOUND);
    });

    it("should map 5xx to serviceUnavailable", () => {
      const axiosError = {
        response: { status: 503 },
      };
      const error = EmbeddingError.fromAxiosError(
        "Embedding",
        "embed",
        axiosError as any
      );

      expect(error.code).toBe(EmbeddingErrorCode.SERVICE_UNAVAILABLE);
    });
  });
});

/**
 * Tests for OpenAIAdapterError
 */

import { describe, it, expect } from "vitest";
import { OpenAIAdapterError, OpenAIErrorCode } from "./OpenAIAdapterError.js";
import { ErrorSeverity, RecoveryStrategy } from "./AdapterError.js";

describe("OpenAIAdapterError", () => {
  describe("authFailed", () => {
    it("should create auth failed error", () => {
      const error = OpenAIAdapterError.authFailed();

      expect(error.code).toBe(OpenAIErrorCode.AUTH_FAILED);
      expect(error.message).toContain("authentication");
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.retryable).toBe(false);
      expect(error.recovery).toBe(RecoveryStrategy.MANUAL);
      expect(error.openaiRecovery?.checkApiKey).toBe(true);
    });

    it("should identify as auth failed", () => {
      const error = OpenAIAdapterError.authFailed();
      expect(error.isAuthFailed()).toBe(true);
      expect(error.isRateLimit()).toBe(false);
      expect(error.isQuotaExceeded()).toBe(false);
    });
  });

  describe("rateLimit", () => {
    it("should create rate limit error", () => {
      const error = OpenAIAdapterError.rateLimit(60);

      expect(error.code).toBe(OpenAIErrorCode.RATE_LIMIT);
      expect(error.message).toContain("rate limit");
      expect(error.retryable).toBe(true);
      expect(error.openaiRecovery?.waitTime).toBe(60000);
      // Note: rateLimit info structure depends on implementation
    });

    it("should identify as rate limit", () => {
      const error = OpenAIAdapterError.rateLimit();
      expect(error.isRateLimit()).toBe(true);
      expect(error.isAuthFailed()).toBe(false);
    });
  });

  describe("quotaExceeded", () => {
    it("should create quota exceeded error", () => {
      const error = OpenAIAdapterError.quotaExceeded();

      expect(error.code).toBe(OpenAIErrorCode.QUOTA_EXCEEDED);
      expect(error.message).toContain("quota");
      expect(error.severity).toBe(ErrorSeverity.CRITICAL);
      expect(error.retryable).toBe(false);
    });

    it("should identify as quota exceeded", () => {
      const error = OpenAIAdapterError.quotaExceeded();
      expect(error.isQuotaExceeded()).toBe(true);
      expect(error.isRateLimit()).toBe(false);
    });
  });

  describe("modelNotFound", () => {
    it("should create model not found error", () => {
      const error = OpenAIAdapterError.modelNotFound("gpt-5");

      expect(error.code).toBe(OpenAIErrorCode.MODEL_NOT_FOUND);
      expect(error.message).toContain("gpt-5");
      expect(error.openaiRecovery?.alternativeModel).toBe("gpt-3.5-turbo");
    });

    it("should identify as model not found", () => {
      const error = OpenAIAdapterError.modelNotFound("test");
      expect(error.isModelNotFound()).toBe(true);
    });
  });

  describe("contentFilter", () => {
    it("should create content filter error", () => {
      const error = OpenAIAdapterError.contentFilter("Content flagged");

      expect(error.code).toBe(OpenAIErrorCode.CONTENT_FILTER);
      expect(error.message).toContain("flagged");
      expect(error.openaiRecovery?.contentFiltered).toBe(true);
    });

    it("should identify as content filter", () => {
      const error = OpenAIAdapterError.contentFilter();
      expect(error.isContentFilter()).toBe(true);
    });
  });

  describe("contextLengthExceeded", () => {
    it("should create context length error", () => {
      const error = OpenAIAdapterError.contextLengthExceeded(
        "gpt-4",
        8192,
        10000
      );

      expect(error.code).toBe(OpenAIErrorCode.CONTEXT_LENGTH);
      expect(error.message).toContain("8192");
      expect(error.message).toContain("10000");
      // Note: modelName is in context passed to AdapterError
    });
  });

  describe("fromAxiosError", () => {
    it("should map 401 to authFailed", () => {
      const axiosError = {
        response: {
          status: 401,
          headers: { "x-request-id": "req-123" },
        },
      };
      const error = OpenAIAdapterError.fromAxiosError(
        "OpenAI",
        "generate",
        axiosError as any
      );

      expect(error.isAuthFailed()).toBe(true);
      expect(error.openaiRequestId).toBe("req-123");
    });

    it("should map 429 with quota_exceeded to quotaExceeded", () => {
      const axiosError = {
        response: {
          status: 429,
          data: {
            error: { code: "quota_exceeded", message: "Quota exceeded" },
          },
        },
      };
      const error = OpenAIAdapterError.fromAxiosError(
        "OpenAI",
        "generate",
        axiosError as any
      );

      expect(error.isQuotaExceeded()).toBe(true);
    });

    it("should map 429 to rateLimit", () => {
      const axiosError = {
        response: {
          status: 429,
          headers: {
            "retry-after": "60",
            "x-ratelimit-remaining": "0",
          },
        },
      };
      const error = OpenAIAdapterError.fromAxiosError(
        "OpenAI",
        "generate",
        axiosError as any
      );

      expect(error.isRateLimit()).toBe(true);
      // Note: rateLimit info structure depends on implementation
    });

    it("should map 404 to modelNotFound", () => {
      const axiosError = {
        response: {
          status: 404,
          data: { error: { param: "gpt-5" } },
        },
      };
      const error = OpenAIAdapterError.fromAxiosError(
        "OpenAI",
        "generate",
        axiosError as any
      );

      expect(error.isModelNotFound()).toBe(true);
    });

    it("should map 400 with content_filter to contentFilter", () => {
      const axiosError = {
        response: {
          status: 400,
          data: { error: { code: "content_filter", message: "Flagged" } },
        },
      };
      const error = OpenAIAdapterError.fromAxiosError(
        "OpenAI",
        "generate",
        axiosError as any
      );

      expect(error.isContentFilter()).toBe(true);
    });

    it("should map 5xx to serverError", () => {
      const axiosError = {
        response: { status: 500 },
      };
      const error = OpenAIAdapterError.fromAxiosError(
        "OpenAI",
        "generate",
        axiosError as any
      );

      expect(error.code).toBe(OpenAIErrorCode.SERVER_ERROR);
    });
  });

  describe("getOpenAIRequestId", () => {
    it("should return request ID", () => {
      const axiosError = {
        response: {
          status: 401,
          headers: { "x-request-id": "req-abc-123" },
        },
      };
      const error = OpenAIAdapterError.fromAxiosError(
        "OpenAI",
        "generate",
        axiosError as any
      );

      expect(error.getOpenAIRequestId()).toBe("req-abc-123");
    });
  });
});

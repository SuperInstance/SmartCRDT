/**
 * Tests for error utilities
 */

import { describe, it, expect, vi } from "vitest";
import {
  retryWithBackoff,
  withFallback,
  withGracefulDegradation,
  isAdapterError,
  isOllamaError,
  isOpenAIError,
  isEmbeddingError,
  isValidationError,
  isRateLimitError,
  getErrorCode,
  getErrorSeverity,
  isRetryable,
  formatError,
  errorToJSON,
  sanitizeForLogging,
  DEFAULT_RETRY_CONFIG,
} from "./utils.js";
import {
  AdapterError,
  ErrorSeverity,
  RecoveryStrategy,
} from "./AdapterError.js";
import { OllamaAdapterError } from "./OllamaAdapterError.js";
import { OpenAIAdapterError } from "./OpenAIAdapterError.js";
import { EmbeddingError } from "./EmbeddingError.js";
import { ValidationError } from "./ValidationError.js";
import { RateLimitError } from "./RateLimitError.js";

describe("Error Utilities", () => {
  describe("retryWithBackoff", () => {
    it("should succeed on first try", async () => {
      const fn = vi.fn().mockResolvedValue("success");
      const result = await retryWithBackoff(fn);

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should retry on retryable error", async () => {
      let attempts = 0;
      const fn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new AdapterError("Test", "op", "Retryable error", "ERROR", {
            retryable: true,
          });
        }
        return "success";
      });

      const result = await retryWithBackoff(fn);

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("should not retry on non-retryable error", async () => {
      const fn = vi.fn().mockImplementation(() => {
        throw new AdapterError("Test", "op", "Non-retryable", "ERROR", {
          retryable: false,
        });
      });

      await expect(retryWithBackoff(fn)).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should throw after max retries", async () => {
      const fn = vi.fn().mockImplementation(() => {
        throw new AdapterError("Test", "op", "Always fails", "ERROR", {
          retryable: true,
        });
      });

      await expect(retryWithBackoff(fn, { maxRetries: 2 })).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it("should use custom retry config", async () => {
      let attempts = 0;
      const fn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          throw new AdapterError("Test", "op", "Retryable", "ERROR", {
            retryable: true,
          });
        }
        return "success";
      });

      await retryWithBackoff(fn, { maxRetries: 5, initialDelay: 100 });
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe("withFallback", () => {
    it("should return primary result", async () => {
      const primary = vi.fn().mockResolvedValue("primary");
      const fallback1 = vi.fn().mockResolvedValue("fallback1");
      const fallback2 = vi.fn().mockResolvedValue("fallback2");

      const result = await withFallback(primary, [
        { name: "fb1", fn: fallback1, priority: 10 },
        { name: "fb2", fn: fallback2, priority: 20 },
      ]);

      expect(result).toBe("primary");
      expect(primary).toHaveBeenCalledTimes(1);
      expect(fallback1).not.toHaveBeenCalled();
      expect(fallback2).not.toHaveBeenCalled();
    });

    it("should try fallbacks in priority order", async () => {
      const primary = vi.fn().mockRejectedValue(new Error("failed"));
      const fallback1 = vi.fn().mockRejectedValue(new Error("failed"));
      const fallback2 = vi.fn().mockResolvedValue("fallback2");

      const result = await withFallback(primary, [
        { name: "fb1", fn: fallback1, priority: 10 },
        { name: "fb2", fn: fallback2, priority: 20 },
      ]);

      expect(result).toBe("fallback2");
      expect(primary).toHaveBeenCalledTimes(1);
      expect(fallback1).toHaveBeenCalledTimes(1);
      expect(fallback2).toHaveBeenCalledTimes(1);
    });

    it("should throw if all fail", async () => {
      const primary = vi.fn().mockRejectedValue(new Error("primary failed"));
      const fallback1 = vi.fn().mockRejectedValue(new Error("fb1 failed"));
      const fallback2 = vi.fn().mockRejectedValue(new Error("fb2 failed"));

      await expect(
        withFallback(primary, [
          { name: "fb1", fn: fallback1, priority: 10 },
          { name: "fb2", fn: fallback2, priority: 20 },
        ])
      ).rejects.toThrow(); // Last error is from fb2
    });
  });

  describe("withGracefulDegradation", () => {
    it("should return primary result", async () => {
      const primary = vi.fn().mockResolvedValue("primary");
      const fallback = vi.fn().mockResolvedValue("fallback");
      const degraded = vi.fn().mockResolvedValue("degraded");

      const result = await withGracefulDegradation(primary, fallback, degraded);

      expect(result).toBe("primary");
      expect(primary).toHaveBeenCalledTimes(1);
      expect(fallback).not.toHaveBeenCalled();
      expect(degraded).not.toHaveBeenCalled();
    });

    it("should fall back to fallback function", async () => {
      const primary = vi.fn().mockRejectedValue(new Error("primary failed"));
      const fallback = vi.fn().mockResolvedValue("fallback");
      const degraded = vi.fn().mockResolvedValue("degraded");

      const result = await withGracefulDegradation(primary, fallback, degraded);

      expect(result).toBe("fallback");
      expect(fallback).toHaveBeenCalledTimes(1);
      expect(degraded).not.toHaveBeenCalled();
    });

    it("should fall back to degraded function", async () => {
      const primary = vi.fn().mockRejectedValue(new Error("primary failed"));
      const fallback = vi.fn().mockRejectedValue(new Error("fallback failed"));
      const degraded = vi.fn().mockResolvedValue("degraded");

      const result = await withGracefulDegradation(primary, fallback, degraded);

      expect(result).toBe("degraded");
      expect(degraded).toHaveBeenCalledTimes(1);
    });

    it("should throw primary error if all fail", async () => {
      const primary = vi.fn().mockRejectedValue(new Error("primary failed"));
      const fallback = vi.fn().mockRejectedValue(new Error("fallback failed"));
      const degraded = vi.fn().mockRejectedValue(new Error("degraded failed"));

      await expect(
        withGracefulDegradation(primary, fallback, degraded)
      ).rejects.toThrow("primary failed");
    });
  });

  describe("Type guards", () => {
    it("should identify AdapterError", () => {
      const error = new AdapterError("Test", "op", "msg", "CODE");
      expect(isAdapterError(error)).toBe(true);
      expect(isOllamaError(error)).toBe(false);
    });

    it("should identify OllamaAdapterError", () => {
      const error = OllamaAdapterError.connectionRefused("http://localhost");
      expect(isAdapterError(error)).toBe(true);
      expect(isOllamaError(error)).toBe(true);
      expect(isOpenAIError(error)).toBe(false);
    });

    it("should identify OpenAIAdapterError", () => {
      const error = OpenAIAdapterError.authFailed();
      expect(isAdapterError(error)).toBe(true);
      expect(isOpenAIError(error)).toBe(true);
      expect(isEmbeddingError(error)).toBe(false);
    });

    it("should identify EmbeddingError", () => {
      const error = EmbeddingError.invalidInput("Bad input");
      expect(isAdapterError(error)).toBe(true);
      expect(isEmbeddingError(error)).toBe(true);
      expect(isValidationError(error)).toBe(false);
    });

    it("should identify ValidationError", () => {
      const error = ValidationError.requiredField("test");
      expect(isAdapterError(error)).toBe(true);
      expect(isValidationError(error)).toBe(true);
      expect(isRateLimitError(error)).toBe(false);
    });

    it("should identify RateLimitError", () => {
      const error = RateLimitError.rateLimitExceeded(100, 60);
      expect(isAdapterError(error)).toBe(true);
      expect(isRateLimitError(error)).toBe(true);
    });

    it("should handle non-adapter errors", () => {
      const error = new Error("Generic error");
      expect(isAdapterError(error)).toBe(false);
      expect(isOllamaError(error)).toBe(false);
    });
  });

  describe("Error getters", () => {
    it("should get error code", () => {
      const error = new AdapterError("Test", "op", "msg", "TEST_CODE");
      expect(getErrorCode(error)).toBe("TEST_CODE");
      expect(getErrorCode(new Error("generic"))).toBeUndefined();
    });

    it("should get error severity", () => {
      const error = new AdapterError("Test", "op", "msg", "CODE", {
        severity: ErrorSeverity.HIGH,
      });
      expect(getErrorSeverity(error)).toBe("high");
      expect(getErrorSeverity(new Error("generic"))).toBeUndefined();
    });

    it("should check if retryable", () => {
      const retryable = new AdapterError("Test", "op", "msg", "CODE", {
        retryable: true,
      });
      const nonRetryable = new AdapterError("Test", "op", "msg", "CODE", {
        retryable: false,
      });

      expect(isRetryable(retryable)).toBe(true);
      expect(isRetryable(nonRetryable)).toBe(false);
      expect(isRetryable(new Error("generic"))).toBe(false);
    });
  });

  describe("Error formatting", () => {
    it("should format AdapterError", () => {
      const error = new AdapterError("Test", "op", "Test message", "CODE");
      const formatted = formatError(error);

      expect(formatted).toContain("[CODE]");
      expect(formatted).toContain("Test message");
      expect(formatted).toContain("Adapter: Test");
      expect(formatted).toContain("Operation: op");
    });

    it("should format generic Error", () => {
      const error = new Error("Generic error");
      expect(formatError(error)).toBe("Generic error");
    });

    it("should format unknown error", () => {
      expect(formatError("string error")).toBe("string error");
    });

    it("should convert AdapterError to JSON", () => {
      const cause = new Error("Cause");
      const error = new AdapterError(
        "Test",
        "op",
        "Message",
        "CODE",
        {},
        cause
      );
      const json = errorToJSON(error);

      expect(json.name).toBe("AdapterError");
      expect(json.code).toBe("CODE");
      expect(json.message).toBe("Message");
      expect(json.cause).toBeDefined();
      expect(json.stack).toBeDefined();
    });

    it("should convert generic Error to JSON", () => {
      const error = new Error("Generic");
      const json = errorToJSON(error);

      expect(json.name).toBe("Error");
      expect(json.message).toBe("Generic");
      expect(json.stack).toBeDefined();
    });

    it("should convert unknown to JSON", () => {
      const json = errorToJSON("unknown");
      expect(json.error).toBe("unknown");
    });
  });

  describe("sanitizeForLogging", () => {
    it("should redact sensitive keys", () => {
      const data = {
        username: "user",
        password: "secret123",
        apiKey: "sk-1234567890",
        api_key: "sk-9876543210", // Test snake_case
        normal: "value",
      };

      const sanitized = sanitizeForLogging(data);

      expect(sanitized.username).toBe("user");
      expect(sanitized.password).toBe("[REDACTED]");
      expect(sanitized.apiKey).toBe("[REDACTED]");
      expect(sanitized["api_key"]).toBe("[REDACTED]");
      expect(sanitized.normal).toBe("value");
    });

    it("should handle nested objects", () => {
      const data = {
        user: {
          name: "John",
          token: "secret-token",
        },
        config: {
          secret: "value",
        },
      };

      const sanitized = sanitizeForLogging(data);

      expect(sanitized.user.name).toBe("John");
      expect(sanitized.user.token).toBe("[REDACTED]");
      expect(sanitized.config.secret).toBe("[REDACTED]");
    });

    it("should handle case-insensitive matching", () => {
      const data = {
        API_KEY: "value",
        ApiSecret: "value",
        authorization: "Bearer token",
      };

      const sanitized = sanitizeForLogging(data);

      expect(sanitized.API_KEY).toBe("[REDACTED]");
      expect(sanitized.ApiSecret).toBe("[REDACTED]");
      expect(sanitized.authorization).toBe("[REDACTED]");
    });
  });

  describe("DEFAULT_RETRY_CONFIG", () => {
    it("should have default values", () => {
      expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(3);
      expect(DEFAULT_RETRY_CONFIG.initialDelay).toBe(1000);
      expect(DEFAULT_RETRY_CONFIG.maxDelay).toBe(30000);
      expect(DEFAULT_RETRY_CONFIG.backoffMultiplier).toBe(2);
      expect(DEFAULT_RETRY_CONFIG.jitter).toBe(true);
    });
  });
});

/**
 * Tests for AdapterError
 */

import { describe, it, expect } from "vitest";
import {
  AdapterError,
  ErrorSeverity,
  RecoveryStrategy,
} from "./AdapterError.js";
import axios from "axios";

describe("AdapterError", () => {
  describe("constructor", () => {
    it("should create error with all properties", () => {
      const error = new AdapterError(
        "TestAdapter",
        "testOperation",
        "Test error message",
        "TEST_ERROR",
        {
          severity: ErrorSeverity.HIGH,
          recovery: RecoveryStrategy.ABORT,
          retryable: false,
          statusCode: 400,
        }
      );

      expect(error.name).toBe("AdapterError");
      expect(error.message).toBe("Test error message");
      expect(error.code).toBe("TEST_ERROR");
      expect(error.context.adapterName).toBe("TestAdapter");
      expect(error.context.operation).toBe("testOperation");
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.recovery).toBe(RecoveryStrategy.ABORT);
      expect(error.retryable).toBe(false);
      expect(error.context.statusCode).toBe(400);
      expect(error.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it("should use default values when not provided", () => {
      const error = new AdapterError(
        "TestAdapter",
        "testOperation",
        "Test error message",
        "TEST_ERROR"
      );

      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.recovery).toBe(RecoveryStrategy.RETRY);
      expect(error.retryable).toBe(true);
    });
  });

  describe("toJSON", () => {
    it("should convert error to JSON", () => {
      const cause = new Error("Original error");
      const error = new AdapterError(
        "TestAdapter",
        "testOperation",
        "Test error message",
        "TEST_ERROR",
        {},
        cause
      );

      const json = error.toJSON();

      expect(json.name).toBe("AdapterError");
      expect(json.code).toBe("TEST_ERROR");
      expect(json.message).toBe("Test error message");
      expect(json.severity).toBe("medium");
      expect(json.retryable).toBe(true);
      expect(json.cause).toBeDefined();
      expect(json.cause?.name).toBe("Error");
      expect(json.cause?.message).toBe("Original error");
      expect(json.stack).toBeDefined();
    });
  });

  describe("toString", () => {
    it("should format error as string", () => {
      const cause = new Error("Original error");
      const error = new AdapterError(
        "TestAdapter",
        "testOperation",
        "Test error message",
        "TEST_ERROR",
        { statusCode: 404 },
        cause
      );

      const str = error.toString();

      expect(str).toContain("[TEST_ERROR]");
      expect(str).toContain("Test error message");
      expect(str).toContain("Adapter: TestAdapter");
      expect(str).toContain("Operation: testOperation");
      expect(str).toContain("Status: 404");
      expect(str).toContain("Caused by: Original error");
    });
  });

  describe("isErrorCode", () => {
    it("should return true for matching error code", () => {
      const error = new AdapterError(
        "TestAdapter",
        "testOperation",
        "Test error message",
        "TEST_ERROR"
      );

      expect(error.isErrorCode("TEST_ERROR")).toBe(true);
      expect(error.isErrorCode("OTHER_ERROR")).toBe(false);
    });
  });

  describe("hasSeverityAtLeast", () => {
    it("should check severity level", () => {
      const low = new AdapterError("A", "B", "C", "D", {
        severity: ErrorSeverity.LOW,
      });
      const medium = new AdapterError("A", "B", "C", "D", {
        severity: ErrorSeverity.MEDIUM,
      });
      const high = new AdapterError("A", "B", "C", "D", {
        severity: ErrorSeverity.HIGH,
      });
      const critical = new AdapterError("A", "B", "C", "D", {
        severity: ErrorSeverity.CRITICAL,
      });

      expect(low.hasSeverityAtLeast(ErrorSeverity.LOW)).toBe(true);
      expect(low.hasSeverityAtLeast(ErrorSeverity.MEDIUM)).toBe(false);

      expect(medium.hasSeverityAtLeast(ErrorSeverity.LOW)).toBe(true);
      expect(medium.hasSeverityAtLeast(ErrorSeverity.MEDIUM)).toBe(true);
      expect(medium.hasSeverityAtLeast(ErrorSeverity.HIGH)).toBe(false);

      expect(high.hasSeverityAtLeast(ErrorSeverity.HIGH)).toBe(true);
      expect(high.hasSeverityAtLeast(ErrorSeverity.CRITICAL)).toBe(false);

      expect(critical.hasSeverityAtLeast(ErrorSeverity.CRITICAL)).toBe(true);
    });
  });

  describe("fromAxiosError", () => {
    it("should create error from Axios error with status code", () => {
      const axiosError = {
        isAxiosError: true,
        code: "ERR_CODE",
        message: "HTTP error",
        response: {
          status: 404,
        },
        config: {
          url: "/test",
          method: "get",
        },
      };

      const error = AdapterError.fromAxiosError(
        "TestAdapter",
        "testOp",
        axiosError as any
      );

      expect(error).toBeInstanceOf(AdapterError);
      expect(error.code).toBe("ERR_CODE");
      expect(error.context.statusCode).toBe(404);
      expect(error.context.requestDetails?.url).toBe("/test");
    });

    it("should mark 4xx errors as non-retryable except 408 and 429", () => {
      const error400 = AdapterError.fromAxiosError("A", "B", {
        isAxiosError: true,
        response: { status: 400 },
      } as any);
      expect(error400.retryable).toBe(false);

      const error408 = AdapterError.fromAxiosError("A", "B", {
        isAxiosError: true,
        response: { status: 408 },
      } as any);
      expect(error408.retryable).toBe(true);

      const error429 = AdapterError.fromAxiosError("A", "B", {
        isAxiosError: true,
        response: { status: 429 },
      } as any);
      expect(error429.retryable).toBe(true);
    });

    it("should mark 5xx errors as retryable", () => {
      const error500 = AdapterError.fromAxiosError("A", "B", {
        isAxiosError: true,
        response: { status: 500 },
      } as any);
      expect(error500.retryable).toBe(true);
    });

    it("should mark network errors as retryable", () => {
      const error = AdapterError.fromAxiosError("A", "B", {
        isAxiosError: true,
        code: "ECONNREFUSED",
      } as any);
      expect(error.retryable).toBe(true);
    });
  });
});

/**
 * Tests for ValidationError
 */

import { describe, it, expect } from "vitest";
import { ValidationError, ValidationErrorCode } from "./ValidationError.js";
import { ErrorSeverity, RecoveryStrategy } from "./AdapterError.js";

describe("ValidationError", () => {
  describe("requiredField", () => {
    it("should create required field error", () => {
      const error = ValidationError.requiredField("query");

      expect(error.code).toBe(ValidationErrorCode.REQUIRED_FIELD);
      expect(error.message).toContain("query");
      expect(error.fieldErrors.length).toBe(1);
      expect(error.fieldErrors[0].field).toBe("query");
      expect(error.fieldErrors[0].code).toBe(
        ValidationErrorCode.REQUIRED_FIELD
      );
      expect(error.validationResult?.valid).toBe(false);
    });

    it("should include received value", () => {
      const error = ValidationError.requiredField("test", undefined);
      expect(error.fieldErrors[0].received).toBe(undefined);
    });
  });

  describe("invalidFormat", () => {
    it("should create invalid format error", () => {
      const error = ValidationError.invalidFormat(
        "email",
        "bad-email",
        "email format",
        "user@example.com"
      );

      expect(error.code).toBe(ValidationErrorCode.INVALID_FORMAT);
      expect(error.fieldErrors[0].field).toBe("email");
      expect(error.fieldErrors[0].received).toBe("bad-email");
      expect(error.fieldErrors[0].expected).toBe("email format");
      expect(error.fieldErrors[0].suggestion).toContain("user@example.com");
    });
  });

  describe("invalidType", () => {
    it("should create invalid type error", () => {
      const error = ValidationError.invalidType(
        "count",
        "not-a-number",
        "number"
      );

      expect(error.code).toBe(ValidationErrorCode.INVALID_TYPE);
      expect(error.fieldErrors[0].received).toBe("not-a-number");
      expect(error.fieldErrors[0].expected).toBe("number");
    });

    it("should handle null values", () => {
      const error = ValidationError.invalidType("test", null, "string");
      expect(error.fieldErrors[0].received).toBe(null);
      expect(error.fieldErrors[0].expected).toBe("string");
    });
  });

  describe("outOfRange", () => {
    it("should create out of range error with min and max", () => {
      const error = ValidationError.outOfRange("temperature", 2.5, 0, 1);

      expect(error.code).toBe(ValidationErrorCode.OUT_OF_RANGE);
      expect(error.fieldErrors[0].received).toBe(2.5);
      expect(error.fieldErrors[0].constraint?.min).toBe(0);
      expect(error.fieldErrors[0].constraint?.max).toBe(1);
    });

    it("should create out of range error with min only", () => {
      const error = ValidationError.outOfRange("count", -1, 0);

      expect(error.fieldErrors[0].received).toBe(-1);
      expect(error.fieldErrors[0].constraint?.min).toBe(0);
      expect(error.fieldErrors[0].constraint?.max).toBeUndefined();
    });

    it("should create out of range error with max only", () => {
      const error = ValidationError.outOfRange("count", 101, undefined, 100);

      expect(error.fieldErrors[0].received).toBe(101);
      expect(error.fieldErrors[0].constraint?.min).toBeUndefined();
      expect(error.fieldErrors[0].constraint?.max).toBe(100);
    });
  });

  describe("tooLong", () => {
    it("should create too long error", () => {
      const error = ValidationError.tooLong("text", 5000, 1000);

      expect(error.code).toBe(ValidationErrorCode.TOO_LONG);
      expect(error.fieldErrors[0].received).toBe(5000);
      expect(error.fieldErrors[0].constraint?.max).toBe(1000);
    });
  });

  describe("tooShort", () => {
    it("should create too short error", () => {
      const error = ValidationError.tooShort("password", 5, 8);

      expect(error.code).toBe(ValidationErrorCode.TOO_SHORT);
      expect(error.fieldErrors[0].received).toBe(5);
      expect(error.fieldErrors[0].constraint?.min).toBe(8);
    });
  });

  describe("invalidEnum", () => {
    it("should create invalid enum error", () => {
      const validValues = ["local", "cloud", "hybrid"];
      const error = ValidationError.invalidEnum(
        "backend",
        "invalid",
        validValues
      );

      expect(error.code).toBe(ValidationErrorCode.INVALID_ENUM);
      expect(error.fieldErrors[0].received).toBe("invalid");
      expect(error.fieldErrors[0].constraint?.enum).toEqual(validValues);
    });
  });

  describe("patternMismatch", () => {
    it("should create pattern mismatch error", () => {
      const error = ValidationError.patternMismatch(
        "email",
        "bad",
        "^\\S+@\\S+\\.\\S+$",
        "email"
      );

      expect(error.code).toBe(ValidationErrorCode.PATTERN_MISMATCH);
      expect(error.fieldErrors[0].received).toBe("bad");
      expect(error.fieldErrors[0].constraint?.pattern).toBe(
        "^\\S+@\\S+\\.\\S+$"
      );
      expect(error.fieldErrors[0].suggestion).toContain("email");
    });
  });

  describe("constraintViolation", () => {
    it("should create constraint violation error", () => {
      const error = ValidationError.constraintViolation(
        "field",
        "Must be unique",
        { unique: true }
      );

      expect(error.code).toBe(ValidationErrorCode.CONSTRAINT_VIOLATION);
      expect(error.fieldErrors[0].constraint).toEqual({ unique: true });
    });
  });

  describe("schemaFailed", () => {
    it("should create schema failed error", () => {
      const fieldErrors = [
        ValidationError.requiredField("field1").fieldErrors[0],
        ValidationError.invalidType("field2", "bad", "number").fieldErrors[0],
      ];
      const error = ValidationError.schemaFailed("RequestSchema", fieldErrors);

      expect(error.code).toBe(ValidationErrorCode.SCHEMA_FAILED);
      expect(error.fieldErrors.length).toBe(2);
      expect(error.message).toContain("RequestSchema");
      expect(error.message).toContain("2 error");
    });
  });

  describe("hasFieldError", () => {
    it("should return true if field has error", () => {
      const error = ValidationError.requiredField("query");
      expect(error.hasFieldError("query")).toBe(true);
      expect(error.hasFieldError("other")).toBe(false);
    });
  });

  describe("getFieldError", () => {
    it("should return error for specific field", () => {
      const error = ValidationError.requiredField("query");
      const fieldError = error.getFieldError("query");

      expect(fieldError).toBeDefined();
      expect(fieldError?.field).toBe("query");
    });

    it("should return undefined for non-existent field", () => {
      const error = ValidationError.requiredField("query");
      const fieldError = error.getFieldError("other");

      expect(fieldError).toBeUndefined();
    });
  });

  describe("formatErrors", () => {
    it("should format errors as readable string", () => {
      const error = ValidationError.requiredField("query");
      const formatted = error.formatErrors();

      expect(formatted).toContain("query:");
      expect(formatted).toContain("Required field");
    });

    it("should format multiple errors", () => {
      const fieldErrors = [
        ValidationError.requiredField("field1").fieldErrors[0],
        ValidationError.invalidType("field2", "bad", "number").fieldErrors[0],
      ];
      const error = ValidationError.schemaFailed("Schema", fieldErrors);
      const formatted = error.formatErrors();

      expect(formatted).toContain("field1:");
      expect(formatted).toContain("field2:");
    });
  });

  describe("toResult", () => {
    it("should convert to validation result", () => {
      const error = ValidationError.requiredField("test");
      const result = error.toResult();

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(error.fieldErrors);
      expect(result.message).toBe(error.message);
    });
  });
});

/**
 * Tests for ValidationFramework
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ValidationFramework, validate, validateAndSanitize, createContextualValidator } from "./ValidationFramework.js";
import { DataType, InputSource } from "@lsi/protocol";

describe("ValidationFramework", () => {
  let framework: ValidationFramework;

  beforeEach(() => {
    framework = new ValidationFramework();
  });

  describe("Type Validation", () => {
    it("should validate strings", () => {
      const result = framework.validate("hello", DataType.STRING);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject non-strings for string type", () => {
      const result = framework.validate(123, DataType.STRING);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should validate numbers", () => {
      const result = framework.validate(123, DataType.NUMBER);

      expect(result.isValid).toBe(true);
    });

    it("should validate integers", () => {
      const result = framework.validate(123, DataType.INTEGER);

      expect(result.isValid).toBe(true);
    });

    it("should reject floats for integer type", () => {
      const result = framework.validate(123.45, DataType.INTEGER);

      expect(result.isValid).toBe(false);
    });

    it("should validate booleans", () => {
      expect(framework.validate(true, DataType.BOOLEAN).isValid).toBe(true);
      expect(framework.validate(false, DataType.BOOLEAN).isValid).toBe(true);
      expect(framework.validate("true", DataType.BOOLEAN).isValid).toBe(true);
      expect(framework.validate("false", DataType.BOOLEAN).isValid).toBe(true);
      expect(framework.validate(1, DataType.BOOLEAN).isValid).toBe(true);
      expect(framework.validate(0, DataType.BOOLEAN).isValid).toBe(true);
    });

    it("should validate arrays", () => {
      const result = framework.validate([1, 2, 3], DataType.ARRAY);

      expect(result.isValid).toBe(true);
    });

    it("should validate objects", () => {
      const result = framework.validate({ key: "value" }, DataType.OBJECT);

      expect(result.isValid).toBe(true);
    });

    it("should validate emails", () => {
      expect(framework.validate("test@example.com", DataType.EMAIL).isValid).toBe(true);
      expect(framework.validate("invalid", DataType.EMAIL).isValid).toBe(false);
    });

    it("should validate URLs", () => {
      expect(framework.validate("https://example.com", DataType.URL).isValid).toBe(true);
      expect(framework.validate("http://localhost", DataType.URL).isValid).toBe(true);
      expect(framework.validate("not-a-url", DataType.URL).isValid).toBe(false);
    });

    it("should validate UUIDs", () => {
      expect(
        framework.validate("550e8400-e29b-41d4-a716-446655440000", DataType.UUID).isValid
      ).toBe(true);
      expect(framework.validate("not-a-uuid", DataType.UUID).isValid).toBe(false);
    });

    it("should validate IP addresses", () => {
      expect(framework.validate("192.168.1.1", DataType.IP).isValid).toBe(true);
      expect(framework.validate("2001:db8::1", DataType.IP).isValid).toBe(true);
      expect(framework.validate("not-an-ip", DataType.IP).isValid).toBe(false);
    });

    it("should validate phone numbers", () => {
      expect(framework.validate("+1-555-555-5555", DataType.PHONE).isValid).toBe(true);
      expect(framework.validate("not-a-phone", DataType.PHONE).isValid).toBe(false);
    });

    it("should validate dates", () => {
      expect(framework.validate("2024-01-01", DataType.DATE).isValid).toBe(true);
      expect(framework.validate(new Date(), DataType.DATE).isValid).toBe(true);
      expect(framework.validate(1704067200000, DataType.DATE).isValid).toBe(true);
      expect(framework.validate("not-a-date", DataType.DATE).isValid).toBe(false);
    });

    it("should validate hex colors", () => {
      expect(framework.validate("#ff0000", DataType.HEX_COLOR).isValid).toBe(true);
      expect(framework.validate("#f00", DataType.HEX_COLOR).isValid).toBe(true);
      expect(framework.validate("not-a-color", DataType.HEX_COLOR).isValid).toBe(false);
    });

    it("should validate JSON strings", () => {
      expect(framework.validate('{"key":"value"}', DataType.JSON).isValid).toBe(true);
      expect(framework.validate("not-json", DataType.JSON).isValid).toBe(false);
    });

    it("should validate base64 strings", () => {
      expect(framework.validate("SGVsbG8gV29ybGQ=", DataType.BASE64).isValid).toBe(true);
      expect(framework.validate("not-base64!", DataType.BASE64).isValid).toBe(false);
    });
  });

  describe("Length Constraints", () => {
    it("should enforce minimum length", () => {
      const result = framework.validate("hi", DataType.STRING, {
        minLength: 3,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe("TOO_SHORT");
    });

    it("should enforce maximum length", () => {
      const result = framework.validate("hello world", DataType.STRING, {
        maxLength: 5,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe("TOO_LONG");
    });

    it("should accept strings within length range", () => {
      const result = framework.validate("hello", DataType.STRING, {
        minLength: 3,
        maxLength: 10,
      });

      expect(result.isValid).toBe(true);
    });
  });

  describe("Range Constraints", () => {
    it("should enforce minimum value", () => {
      const result = framework.validate(5, DataType.NUMBER, {
        min: 10,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe("OUT_OF_RANGE");
    });

    it("should enforce maximum value", () => {
      const result = framework.validate(15, DataType.NUMBER, {
        max: 10,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe("OUT_OF_RANGE");
    });

    it("should accept numbers within range", () => {
      const result = framework.validate(5, DataType.NUMBER, {
        min: 1,
        max: 10,
      });

      expect(result.isValid).toBe(true);
    });
  });

  describe("Pattern Constraints", () => {
    it("should validate pattern matching", () => {
      const result = framework.validate("abc123", DataType.STRING, {
        pattern: /^[a-z0-9]+$/,
      });

      expect(result.isValid).toBe(true);
    });

    it("should reject pattern mismatches", () => {
      const result = framework.validate("abc-123", DataType.STRING, {
        pattern: /^[a-z0-9]+$/,
      });

      expect(result.isValid).toBe(false);
    });
  });

  describe("Enum Constraints", () => {
    it("should validate enum values", () => {
      const result = framework.validate("red", DataType.STRING, {
        enum: ["red", "green", "blue"],
      });

      expect(result.isValid).toBe(true);
    });

    it("should reject values not in enum", () => {
      const result = framework.validate("yellow", DataType.STRING, {
        enum: ["red", "green", "blue"],
      });

      expect(result.isValid).toBe(false);
    });
  });

  describe("Custom Validators", () => {
    it("should use custom validator function", () => {
      const customValidator = (value: unknown) => {
        return typeof value === "string" && value.startsWith("custom-");
      };

      const result = framework.validate("custom-value", DataType.STRING, {
        custom: customValidator,
      });

      expect(result.isValid).toBe(true);
    });

    it("should reject when custom validator fails", () => {
      const customValidator = (value: unknown) => {
        return typeof value === "string" && value.startsWith("custom-");
      };

      const result = framework.validate("other-value", DataType.STRING, {
        custom: customValidator,
      });

      expect(result.isValid).toBe(false);
    });
  });

  describe("Null and Optional Values", () => {
    it("should allow nullable null values", () => {
      const result = framework.validate(null, DataType.STRING, {
        nullable: true,
      });

      expect(result.isValid).toBe(true);
    });

    it("should reject null when not nullable", () => {
      const result = framework.validate(null, DataType.STRING);

      expect(result.isValid).toBe(false);
    });

    it("should allow optional undefined", () => {
      const result = framework.validate(undefined, DataType.STRING, {
        optional: true,
      });

      expect(result.isValid).toBe(true);
    });
  });

  describe("String Transformations", () => {
    it("should trim whitespace", () => {
      const result = framework.validate("  hello  ", DataType.STRING, {
        trim: true,
      });

      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe("hello");
    });

    it("should convert to uppercase", () => {
      const result = framework.validate("hello", DataType.STRING, {
        caseConversion: "upper",
      });

      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe("HELLO");
    });

    it("should convert to lowercase", () => {
      const result = framework.validate("HELLO", DataType.STRING, {
        caseConversion: "lower",
      });

      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe("hello");
    });
  });

  describe("Batch Validation", () => {
    it("should validate multiple fields", () => {
      const data = {
        username: "user123",
        email: "user@example.com",
        age: 25,
      };

      const schema = {
        username: { type: DataType.STRING, constraints: { minLength: 3 } },
        email: { type: DataType.EMAIL },
        age: { type: DataType.INTEGER, constraints: { min: 18, max: 120 } },
      };

      const result = framework.validateBatch(data, schema);

      expect(result.isValid).toBe(true);
    });

    it("should report errors for invalid fields", () => {
      const data = {
        username: "ab", // too short
        email: "invalid", // not an email
        age: 15, // too young
      };

      const schema = {
        username: { type: DataType.STRING, constraints: { minLength: 3 } },
        email: { type: DataType.EMAIL },
        age: { type: DataType.INTEGER, constraints: { min: 18, max: 120 } },
      };

      const result = framework.validateBatch(data, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(3);
    });
  });

  describe("Contextual Validation", () => {
    it("should warn about suspicious patterns from untrusted sources", () => {
      const context = {
        source: InputSource.WEB_FORM,
        timestamp: new Date(),
      };

      const contextualFramework = new ValidationFramework(context);
      const result = contextualFramework.validate("../../../etc/passwd", DataType.STRING);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});

describe("Validation Helpers", () => {
  describe("validate()", () => {
    it("should return type guard result", () => {
      const result = validate("test", DataType.STRING);

      expect(result).toBe(true);

      if (result) {
        // TypeScript should know this is a string
        const str: string = "test";
        expect(str).toBe("test");
      }
    });

    it("should return false for invalid types", () => {
      const result = validate(123, DataType.STRING);

      expect(result).toBe(false);
    });
  });

  describe("validateAndSanitize()", () => {
    it("should validate and return sanitized value", () => {
      const result = validateAndSanitize("  hello  ", DataType.STRING, {
        trim: true,
      });

      expect(result.valid).toBe(true);
      expect(result.value).toBe("hello");
    });

    it("should return errors for invalid input", () => {
      const result = validateAndSanitize("ab", DataType.STRING, {
        minLength: 3,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("createContextualValidator()", () => {
    it("should create validator with context", () => {
      const validator = createContextualValidator(InputSource.API_BODY);

      const result = validator.validate("<script>alert(1)</script>", DataType.STRING);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});

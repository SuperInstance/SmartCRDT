/**
 * Tests for SchemaValidator
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SchemaValidator, validateSchema, CommonSchemas, compileSchema } from "./SchemaValidator.js";
import { DataType } from "@lsi/protocol";

describe("SchemaValidator", () => {
  let validator: SchemaValidator;

  beforeEach(() => {
    validator = new SchemaValidator();
  });

  describe("Basic Schema Validation", () => {
    it("should validate against simple schema", () => {
      const schema = {
        type: DataType.STRING,
        constraints: {
          minLength: 3,
          maxLength: 10,
        },
      };

      const result = validator.validate("hello", schema);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject invalid data", () => {
      const schema = {
        type: DataType.STRING,
        constraints: {
          minLength: 5,
        },
      };

      const result = validator.validate("hi", schema);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("Object Validation", () => {
    it("should validate object properties", () => {
      const schema = {
        type: DataType.OBJECT,
        properties: {
          name: {
            type: DataType.STRING,
            constraints: { minLength: 2 },
          },
          age: {
            type: DataType.INTEGER,
            constraints: { min: 0, max: 120 },
          },
        },
        required: ["name", "age"],
      };

      const data = {
        name: "John",
        age: 30,
      };

      const result = validator.validate(data, schema);

      expect(result.isValid).toBe(true);
    });

    it("should enforce required fields", () => {
      const schema = {
        type: DataType.OBJECT,
        properties: {
          name: { type: DataType.STRING },
          age: { type: DataType.INTEGER },
        },
        required: ["name", "age"],
      };

      const data = {
        name: "John",
      };

      const result = validator.validate(data, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.rule === "required")).toBe(true);
    });

    it("should reject additional properties when not allowed", () => {
      const schema = {
        type: DataType.OBJECT,
        properties: {
          name: { type: DataType.STRING },
        },
        additionalProperties: false,
      };

      const data = {
        name: "John",
        extra: "value",
      };

      const result = validator.validate(data, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.rule === "additionalProperties")).toBe(true);
    });

    it("should allow additional properties when enabled", () => {
      const schema = {
        type: DataType.OBJECT,
        properties: {
          name: { type: DataType.STRING },
        },
        additionalProperties: true,
      };

      const data = {
        name: "John",
        extra: "value",
      };

      const result = validator.validate(data, schema);

      expect(result.isValid).toBe(true);
    });
  });

  describe("Array Validation", () => {
    it("should validate array items", () => {
      const schema = {
        type: DataType.ARRAY,
        items: {
          type: DataType.INTEGER,
          constraints: { min: 0, max: 100 },
        },
      };

      const data = [1, 2, 3, 4, 5];

      const result = validator.validate(data, schema);

      expect(result.isValid).toBe(true);
    });

    it("should reject invalid array items", () => {
      const schema = {
        type: DataType.ARRAY,
        items: {
          type: DataType.INTEGER,
          constraints: { min: 0, max: 100 },
        },
      };

      const data = [1, 2, 150, 4];

      const result = validator.validate(data, schema);

      expect(result.isValid).toBe(false);
    });

    it("should validate array length constraints", () => {
      const schema = {
        type: DataType.ARRAY,
        items: {
          type: DataType.STRING,
        },
        constraints: {
          minLength: 2,
          maxLength: 5,
        },
      };

      expect(validator.validate([1, 2], schema).isValid).toBe(true);
      expect(validator.validate([1], schema).isValid).toBe(false); // too short
      expect(validator.validate([1, 2, 3, 4, 5, 6], schema).isValid).toBe(false); // too long
    });
  });

  describe("Nested Validation", () => {
    it("should validate nested objects", () => {
      const schema = {
        type: DataType.OBJECT,
        properties: {
          user: {
            type: DataType.OBJECT,
            properties: {
              name: { type: DataType.STRING },
              address: {
                type: DataType.OBJECT,
                properties: {
                  street: { type: DataType.STRING },
                  city: { type: DataType.STRING },
                },
              },
            },
          },
        },
      };

      const data = {
        user: {
          name: "John",
          address: {
            street: "123 Main St",
            city: "New York",
          },
        },
      };

      const result = validator.validate(data, schema);

      expect(result.isValid).toBe(true);
    });

    it("should validate arrays of objects", () => {
      const schema = {
        type: DataType.ARRAY,
        items: {
          type: DataType.OBJECT,
          properties: {
            id: { type: DataType.INTEGER },
            name: { type: DataType.STRING },
          },
        },
      };

      const data = [
        { id: 1, name: "Item 1" },
        { id: 2, name: "Item 2" },
      ];

      const result = validator.validate(data, schema);

      expect(result.isValid).toBe(true);
    });
  });

  describe("Path-Based Error Reporting", () => {
    it("should include path in validation errors", () => {
      const schema = {
        type: DataType.OBJECT,
        properties: {
          user: {
            type: DataType.OBJECT,
            properties: {
              age: {
                type: DataType.INTEGER,
                constraints: { min: 0, max: 120 },
              },
            },
          },
        },
      };

      const data = {
        user: {
          age: 150,
        },
      };

      const result = validator.validate(data, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].path).toBe("user.age");
    });
  });

  describe("Compiled Schemas", () => {
    it("should compile schema for repeated validation", () => {
      const schema = {
        type: DataType.STRING,
        constraints: { minLength: 3 },
      };

      const compiled = validator.compile(schema);

      expect(compiled.validate("hello").isValid).toBe(true);
      expect(compiled.validate("hi").isValid).toBe(false);
    });
  });
});

describe("validateSchema Helper", () => {
  it("should validate data against schema", () => {
    const schema = {
      type: DataType.EMAIL,
    };

    expect(validateSchema("test@example.com", schema).isValid).toBe(true);
    expect(validateSchema("invalid", schema).isValid).toBe(false);
  });
});

describe("CommonSchemas", () => {
  describe("email schema", () => {
    it("should validate valid emails", () => {
      const result = new SchemaValidator().validate("test@example.com", CommonSchemas.email);

      expect(result.isValid).toBe(true);
    });

    it("should reject invalid emails", () => {
      const result = new SchemaValidator().validate("invalid", CommonSchemas.email);

      expect(result.isValid).toBe(false);
    });
  });

  describe("username schema", () => {
    it("should validate valid usernames", () => {
      const result = new SchemaValidator().validate("user123", CommonSchemas.username);

      expect(result.isValid).toBe(true);
    });

    it("should reject invalid usernames", () => {
      const result1 = new SchemaValidator().validate("ab", CommonSchemas.username);
      const result2 = new SchemaValidator().validate("user@123", CommonSchemas.username);

      expect(result1.isValid).toBe(false); // too short
      expect(result2.isValid).toBe(false); // invalid character
    });
  });

  describe("password schema", () => {
    it("should validate strong passwords", () => {
      const result = new SchemaValidator().validate("Password123", CommonSchemas.password);

      expect(result.isValid).toBe(true);
    });

    it("should reject weak passwords", () => {
      const result1 = new SchemaValidator().validate("weak", CommonSchemas.password);
      const result2 = new SchemaValidator().validate("nouppercase123", CommonSchemas.password);
      const result3 = new SchemaValidator().validate("NOLOWERCASE123", CommonSchemas.password);

      expect(result1.isValid).toBe(false); // too short
      expect(result2.isValid).toBe(false); // no uppercase
      expect(result3.isValid).toBe(false); // no lowercase
    });
  });

  describe("url schema", () => {
    it("should validate valid URLs", () => {
      const result = new SchemaValidator().validate("https://example.com", CommonSchemas.url);

      expect(result.isValid).toBe(true);
    });

    it("should reject invalid URLs", () => {
      const result = new SchemaValidator().validate("not-a-url", CommonSchemas.url);

      expect(result.isValid).toBe(false);
    });
  });

  describe("uuid schema", () => {
    it("should validate valid UUIDs", () => {
      const result = new SchemaValidator().validate(
        "550e8400-e29b-41d4-a716-446655440000",
        CommonSchemas.uuid
      );

      expect(result.isValid).toBe(true);
    });

    it("should reject invalid UUIDs", () => {
      const result = new SchemaValidator().validate("not-a-uuid", CommonSchemas.uuid);

      expect(result.isValid).toBe(false);
    });
  });

  describe("ipAddress schema", () => {
    it("should validate valid IP addresses", () => {
      const v4Result = new SchemaValidator().validate("192.168.1.1", CommonSchemas.ipAddress);
      const v6Result = new SchemaValidator().validate("2001:db8::1", CommonSchemas.ipAddress);

      expect(v4Result.isValid).toBe(true);
      expect(v6Result.isValid).toBe(true);
    });

    it("should reject invalid IP addresses", () => {
      const result = new SchemaValidator().validate("not-an-ip", CommonSchemas.ipAddress);

      expect(result.isValid).toBe(false);
    });
  });

  describe("date schema", () => {
    it("should validate valid dates", () => {
      const result = new SchemaValidator().validate("2024-01-01", CommonSchemas.date);

      expect(result.isValid).toBe(true);
    });

    it("should reject invalid dates", () => {
      const result = new SchemaValidator().validate("not-a-date", CommonSchemas.date);

      expect(result.isValid).toBe(false);
    });
  });

  describe("timestamp schema", () => {
    it("should validate valid timestamps", () => {
      const result = new SchemaValidator().validate(1704067200000, CommonSchemas.timestamp);

      expect(result.isValid).toBe(true);
    });

    it("should reject invalid timestamps", () => {
      const result1 = new SchemaValidator().validate(-1, CommonSchemas.timestamp);
      const result2 = new SchemaValidator().validate(2147483647001, CommonSchemas.timestamp);

      expect(result1.isValid).toBe(false); // negative
      expect(result2.isValid).toBe(false); // too large
    });
  });

  describe("apiKey schema", () => {
    it("should validate valid API keys", () => {
      const result = new SchemaValidator().validate(
        "abc123xyz456def789ghi012jkl345mno",
        CommonSchemas.apiKey
      );

      expect(result.isValid).toBe(true);
    });

    it("should reject invalid API keys", () => {
      const result1 = new SchemaValidator().validate("short", CommonSchemas.apiKey);
      const result2 = new SchemaValidator().validate("key with spaces", CommonSchemas.apiKey);

      expect(result1.isValid).toBe(false); // too short
      expect(result2.isValid).toBe(false); // invalid characters
    });
  });

  describe("phone schema", () => {
    it("should validate valid phone numbers", () => {
      const result = new SchemaValidator().validate("+1-555-555-5555", CommonSchemas.phone);

      expect(result.isValid).toBe(true);
    });

    it("should reject invalid phone numbers", () => {
      const result = new SchemaValidator().validate("not-a-phone", CommonSchemas.phone);

      expect(result.isValid).toBe(false);
    });
  });
});

describe("compileSchema Helper", () => {
  it("should create compiled schema", () => {
    const schema = {
      type: DataType.STRING,
      constraints: { minLength: 3 },
    };

    const compiled = compileSchema(schema);

    expect(compiled.validate("hello").isValid).toBe(true);
    expect(compiled.validate("hi").isValid).toBe(false);
  });
});

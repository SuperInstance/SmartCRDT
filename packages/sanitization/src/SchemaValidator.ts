/**
 * @lsi/sanitization - Schema Validator Implementation
 *
 * JSON Schema-like validation with support for:
 * - Nested object validation
 * - Array validation
 * - Required fields
 * - Custom format validators
 * - Path-based error reporting
 * - Compiled schemas for performance
 */

import {
  type ValidationSchema,
  type SchemaValidationResult,
  type SchemaValidationError,
  type CompiledSchema,
  type ISchemaValidator,
  DataType,
  type ValidationConstraint,
  type ValidationResult,
  type ValidationError,
  ValidationErrorCode,
} from "@lsi/protocol";
import { ValidationFramework } from "./ValidationFramework.js";

// ============================================================================
// FORMAT VALIDATORS
// ============================================================================

/**
 * Custom format validators registry
 */
class FormatValidators {
  private static formats: Map<string, (value: unknown) => boolean> = new Map([
    // Default formats
    ["email", (value: unknown) => {
      if (typeof value !== "string") return false;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }],
    ["uri", (value: unknown) => {
      if (typeof value !== "string") return false;
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    }],
    ["date-time", (value: unknown) => {
      if (typeof value !== "string") return false;
      return !isNaN(Date.parse(value));
    }],
    ["uuid", (value: unknown) => {
      if (typeof value !== "string") return false;
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    }],
    ["hostname", (value: unknown) => {
      if (typeof value !== "string") return false;
      return /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(value);
    }],
    ["ipv4", (value: unknown) => {
      if (typeof value !== "string") return false;
      return /^(\d{1,3}\.){3}\d{1,3}$/.test(value);
    }],
    ["ipv6", (value: unknown) => {
      if (typeof value !== "string") return false;
      return /^[0-9a-f:]+$/i.test(value) && value.includes(":");
    }],
  ]);

  /**
   * Add a custom format validator
   */
  static addFormat(name: string, validator: (value: unknown) => boolean): void {
    this.formats.set(name, validator);
  }

  /**
   * Get a format validator
   */
  static getFormat(name: string): ((value: unknown) => boolean) | undefined {
    return this.formats.get(name);
  }

  /**
   * Check if a format exists
   */
  static hasFormat(name: string): boolean {
    return this.formats.has(name);
  }
}

// ============================================================================
// SCHEMA VALIDATOR
// ============================================================================

export class SchemaValidator implements ISchemaValidator {
  private validationFramework: ValidationFramework;

  constructor() {
    this.validationFramework = new ValidationFramework();
  }

  /**
   * Validate data against a JSON schema
   */
  validate(data: unknown, schema: ValidationSchema): SchemaValidationResult {
    const errors: SchemaValidationError[] = [];

    // Validate the data
    this.validateValue(data, schema, "", errors);

    return {
      isValid: errors.length === 0,
      errors,
      data: errors.length === 0 ? (data as Record<string, unknown>) : undefined,
    };
  }

  /**
   * Add a custom format validator
   */
  addFormat(name: string, validator: (value: unknown) => boolean): void {
    FormatValidators.addFormat(name, validator);
  }

  /**
   * Compile a schema for repeated validation
   */
  compile(schema: ValidationSchema): CompiledSchema {
    // Create a compiled schema that caches validation logic
    const compiled = {
      schema,
      validator: this,
      validate: (data: unknown) => {
        return this.validate(data, schema);
      },
    };

    return compiled;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Validate a value against a schema
   */
  private validateValue(
    value: unknown,
    schema: ValidationSchema,
    path: string,
    errors: SchemaValidationError[]
  ): void {
    // Check required
    if (value === undefined || value === null) {
      if (schema.constraints?.optional !== true && schema.constraints?.nullable !== true) {
        errors.push({
          code: ValidationErrorCode.REQUIRED,
          message: `Required field is missing or null`,
          path,
          rule: "required",
        });
      }
      return;
    }

    // Validate type
    if (schema.type) {
      const typeResult = this.validationFramework.validate(
        value,
        schema.type,
        schema.constraints
      );

      for (const error of typeResult.errors) {
        errors.push({
          ...error,
          path,
          rule: error.code,
        });
      }
    }

    // Validate object properties
    if (schema.type === DataType.OBJECT && typeof value === "object" && schema.properties) {
      this.validateObject(value as Record<string, unknown>, schema, path, errors);
    }

    // Validate array items
    if (schema.type === DataType.ARRAY && Array.isArray(value) && schema.items) {
      this.validateArray(value as unknown[], schema, path, errors);
    }

    // Validate enum constraint
    if (schema.constraints?.enum) {
      if (!schema.constraints.enum.includes(value as string | number)) {
        errors.push({
          code: ValidationErrorCode.OUT_OF_RANGE,
          message: `Value is not one of the allowed values`,
          path,
          rule: "enum",
          value,
        });
      }
    }

    // Validate pattern constraint
    if (schema.constraints?.pattern && typeof value === "string") {
      const pattern = typeof schema.constraints.pattern === "string"
        ? new RegExp(schema.constraints.pattern)
        : schema.constraints.pattern;

      if (!pattern.test(value)) {
        errors.push({
          code: ValidationErrorCode.INVALID_FORMAT,
          message: `Value does not match required pattern`,
          path,
          rule: "pattern",
          value,
        });
      }
    }
  }

  /**
   * Validate an object
   */
  private validateObject(
    obj: Record<string, unknown>,
    schema: ValidationSchema,
    path: string,
    errors: SchemaValidationError[]
  ): void {
    const properties = schema.properties || {};
    const required = schema.required || [];

    // Check required fields
    for (const field of required) {
      if (!(field in obj) || obj[field] === undefined) {
        errors.push({
          code: ValidationErrorCode.REQUIRED,
          message: `Required field '${field}' is missing`,
          path: this.joinPath(path, field),
          rule: "required",
        });
      }
    }

    // Validate each property
    for (const [fieldName, fieldSchema] of Object.entries(properties)) {
      const fieldValue = obj[fieldName];
      const fieldPath = this.joinPath(path, fieldName);

      this.validateValue(fieldValue, fieldSchema, fieldPath, errors);
    }

    // Check for additional properties
    if (schema.additionalProperties === false) {
      for (const fieldName of Object.keys(obj)) {
        if (!properties[fieldName]) {
          errors.push({
            code: ValidationErrorCode.INVALID_TYPE,
            message: `Additional property '${fieldName}' not allowed`,
            path: this.joinPath(path, fieldName),
            rule: "additionalProperties",
          });
        }
      }
    }
  }

  /**
   * Validate an array
   */
  private validateArray(
    arr: unknown[],
    schema: ValidationSchema,
    path: string,
    errors: SchemaValidationError[]
  ): void {
    const itemsSchema = schema.items;
    if (!itemsSchema) {
      return;
    }

    // Validate each item
    for (let i = 0; i < arr.length; i++) {
      const itemPath = this.joinPath(path, String(i));
      this.validateValue(arr[i], itemsSchema, itemPath, errors);
    }

    // Validate array length constraints
    const constraints = schema.constraints;
    if (constraints) {
      if (constraints.minLength !== undefined && arr.length < constraints.minLength) {
        errors.push({
          code: ValidationErrorCode.TOO_SHORT,
          message: `Array length ${arr.length} is less than minimum ${constraints.minLength}`,
          path,
          rule: "minItems",
          value: arr.length,
        });
      }

      if (constraints.maxLength !== undefined && arr.length > constraints.maxLength) {
        errors.push({
          code: ValidationErrorCode.TOO_LONG,
          message: `Array length ${arr.length} exceeds maximum ${constraints.maxLength}`,
          path,
          rule: "maxItems",
          value: arr.length,
        });
      }
    }
  }

  /**
   * Join path segments
   */
  private joinPath(parent: string, child: string): string {
    if (!parent) {
      return child;
    }
    return `${parent}.${child}`;
  }
}

// ============================================================================
// COMPILED SCHEMA
// ============================================================================

/**
 * Compiled schema implementation
 */
export class CompiledSchemaImpl implements CompiledSchema {
  private validator: SchemaValidator;
  private schema: ValidationSchema;

  constructor(validator: SchemaValidator, schema: ValidationSchema) {
    this.validator = validator;
    this.schema = schema;
  }

  /**
   * Validate data using the compiled schema
   */
  validate(data: unknown): SchemaValidationResult {
    return this.validator.validate(data, this.schema);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Validate data against a schema
 */
export function validateSchema(data: unknown, schema: ValidationSchema): SchemaValidationResult {
  const validator = new SchemaValidator();
  return validator.validate(data, schema);
}

/**
 * Create a schema validator with custom formats
 */
export function createSchemaValidator(
  customFormats?: Record<string, (value: unknown) => boolean>
): SchemaValidator {
  const validator = new SchemaValidator();

  if (customFormats) {
    for (const [name, formatFn] of Object.entries(customFormats)) {
      validator.addFormat(name, formatFn);
    }
  }

  return validator;
}

/**
 * Compile a schema for faster validation
 */
export function compileSchema(schema: ValidationSchema): CompiledSchema {
  const validator = new SchemaValidator();
  return validator.compile(schema);
}

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

/**
 * Common validation schemas
 */
export const CommonSchemas = {
  /**
   * User email schema
   */
  email: {
    type: DataType.STRING,
    description: "User email address",
    constraints: {
      maxLength: 255,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
  } as ValidationSchema,

  /**
   * Username schema
   */
  username: {
    type: DataType.STRING,
    description: "Username",
    constraints: {
      minLength: 3,
      maxLength: 50,
      pattern: /^[a-zA-Z0-9_-]+$/,
    },
  } as ValidationSchema,

  /**
   * Password schema
   */
  password: {
    type: DataType.STRING,
    description: "Password",
    constraints: {
      minLength: 8,
      maxLength: 128,
      custom: (value: unknown) => {
        if (typeof value !== "string") return false;
        // At least one uppercase, one lowercase, one number
        return /[A-Z]/.test(value) && /[a-z]/.test(value) && /[0-9]/.test(value);
      },
    },
  } as ValidationSchema,

  /**
   * URL schema
   */
  url: {
    type: DataType.STRING,
    description: "URL",
    constraints: {
      maxLength: 2048,
      custom: (value: unknown) => {
        if (typeof value !== "string") return false;
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      },
    },
  } as ValidationSchema,

  /**
   * UUID schema
   */
  uuid: {
    type: DataType.STRING,
    description: "UUID",
    constraints: {
      pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    },
  } as ValidationSchema,

  /**
   * IP address schema
   */
  ipAddress: {
    type: DataType.STRING,
    description: "IP address (v4 or v6)",
    constraints: {
      custom: (value: unknown) => {
        if (typeof value !== "string") return false;
        return validator.isIP(value);
      },
    },
  } as ValidationSchema,

  /**
   * Date schema
   */
  date: {
    type: DataType.STRING,
    description: "ISO 8601 date",
    constraints: {
      pattern: /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/,
    },
  } as ValidationSchema,

  /**
   * Timestamp schema
   */
  timestamp: {
    type: DataType.INTEGER,
    description: "Unix timestamp",
    constraints: {
      min: 0,
      max: 2147483647000,
    },
  } as ValidationSchema,

  /**
   * API key schema
   */
  apiKey: {
    type: DataType.STRING,
    description: "API key",
    constraints: {
      minLength: 16,
      maxLength: 256,
      pattern: /^[a-zA-Z0-9_-]+$/,
    },
  } as ValidationSchema,

  /**
   * Phone number schema
   */
  phone: {
    type: DataType.STRING,
    description: "Phone number",
    constraints: {
      maxLength: 50,
      custom: (value: unknown) => {
        if (typeof value !== "string") return false;
        return /^\+?[\d\s\-()]+$/.test(value) && value.replace(/\D/g, "").length >= 10;
      },
    },
  } as ValidationSchema,
};

// ============================================================================
// EXPORTS
// ============================================================================

export { FormatValidators };

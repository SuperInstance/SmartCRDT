/**
import { SecuritySeverity, CodeLocation, DetectionConfidence } from "../types.js";

 * InputValidation - Security hardening through input validation
 *
 * Provides input validation utilities and recommendations:
 * - Schema validation
 * - Type coercion prevention
 * - Length limits
 * - Format validation
 * - Whitelist/blacklist approaches
 * - SQL injection prevention
 * - XSS prevention
 */

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sanitized?: any;
}

/**
 * Validation rule
 */
export interface ValidationRule {
  type: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  enum?: any[];
  custom?: (value: any) => boolean | string;
  sanitize?: (value: any) => any;
}

/**
 * Validation schema
 */
export interface ValidationSchema {
  [field: string]: ValidationRule;
}

/**
 * InputValidator - Validates and sanitizes input
 */
export class InputValidator {
  private schema: ValidationSchema;

  constructor(schema: ValidationSchema) {
    this.schema = schema;
  }

  /**
   * Validate input against schema
   */
  validate(input: Record<string, any>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const sanitized: Record<string, any> = {};

    for (const [field, rule] of Object.entries(this.schema)) {
      const value = input[field];

      // Check required fields
      if (rule.required && (value === undefined || value === null || value === "")) {
        errors.push(`Field '${field}' is required`);
        continue;
      }

      // Skip validation for optional fields
      if (value === undefined || value === null) {
        continue;
      }

      // Type validation
      const typeError = this.validateType(field, value, rule.type);
      if (typeError) {
        errors.push(typeError);
        continue;
      }

      // Length validation
      const lengthError = this.validateLength(field, value, rule);
      if (lengthError) {
        errors.push(lengthError);
      }

      // Pattern validation
      const patternError = this.validatePattern(field, value, rule);
      if (patternError) {
        errors.push(patternError);
      }

      // Enum validation
      const enumError = this.validateEnum(field, value, rule);
      if (enumError) {
        errors.push(enumError);
      }

      // Custom validation
      if (rule.custom) {
        const customResult = rule.custom(value);
        if (customResult !== true) {
          errors.push(typeof customResult === "string" ? customResult : `Field '${field}' failed custom validation`);
        }
      }

      // Sanitize value
      sanitized[field] = rule.sanitize ? rule.sanitize(value) : value;
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      sanitized: Object.keys(sanitized).length > 0 ? sanitized : undefined,
    };
  }

  /**
   * Validate type
   */
  private validateType(field: string, value: any, type: string): string | null {
    switch (type) {
      case "string":
        if (typeof value !== "string") {
          return `Field '${field}' must be a string`;
        }
        break;
      case "number":
        if (typeof value !== "number" || isNaN(value)) {
          return `Field '${field}' must be a number`;
        }
        break;
      case "boolean":
        if (typeof value !== "boolean") {
          return `Field '${field}' must be a boolean`;
        }
        break;
      case "array":
        if (!Array.isArray(value)) {
          return `Field '${field}' must be an array`;
        }
        break;
      case "email":
        if (!this.isValidEmail(value)) {
          return `Field '${field}' must be a valid email`;
        }
        break;
      case "url":
        if (!this.isValidURL(value)) {
          return `Field '${field}' must be a valid URL`;
        }
        break;
      case "uuid":
        if (!this.isValidUUID(value)) {
          return `Field '${field}' must be a valid UUID`;
        }
        break;
      default:
        warnings?.push(`Unknown type '${type}' for field '${field}'`);
    }

    return null;
  }

  /**
   * Validate length
   */
  private validateLength(field: string, value: any, rule: ValidationRule): string | null {
    const length = typeof value === "string" ? value.length : Array.isArray(value) ? value.length : 0;

    if (rule.minLength !== undefined && length < rule.minLength) {
      return `Field '${field}' must be at least ${rule.minLength} characters`;
    }

    if (rule.maxLength !== undefined && length > rule.maxLength) {
      return `Field '${field}' must be at most ${rule.maxLength} characters`;
    }

    return null;
  }

  /**
   * Validate pattern
   */
  private validatePattern(field: string, value: any, rule: ValidationRule): string | null {
    if (rule.pattern && typeof value === "string") {
      if (!rule.pattern.test(value)) {
        return `Field '${field}' does not match required pattern`;
      }
    }

    return null;
  }

  /**
   * Validate enum
   */
  private validateEnum(field: string, value: any, rule: ValidationRule): string | null {
    if (rule.enum && !rule.enum.includes(value)) {
      return `Field '${field}' must be one of: ${rule.enum.join(", ")}`;
    }

    return null;
  }

  /**
   * Check if value is valid email
   */
  private isValidEmail(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  /**
   * Check if value is valid URL
   */
  private isValidURL(value: string): boolean {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if value is valid UUID
   */
  private isValidUUID(value: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }

  /**
   * Sanitize string input
   */
  static sanitizeString(input: string): string {
    return input
      .trim()
      .replace(/[<>]/g, "") // Remove angle brackets
      .replace(/["']/g, ""); // Remove quotes
  }

  /**
   * Sanitize HTML input
   */
  static sanitizeHTML(input: string): string {
    return input
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
      .replace(/\//g, "&#x2F;");
  }

  /**
   * Sanitize SQL input (basic)
   */
  static sanitizeSQL(input: string): string {
    return input.replace(/['"\\]/g, ""); // Remove quotes and backslashes
  }

  /**
   * Create whitelist validator
   */
  static createWhitelist(allowedValues: string[]): (value: string) => boolean {
    const allowedSet = new Set(allowedValues);
    return (value: string) => allowedSet.has(value);
  }

  /**
   * Create blacklist validator
   */
  static createBlacklist(blockedValues: string[]): (value: string) => boolean {
    const blockedSet = new Set(blockedValues);
    return (value: string) => !blockedSet.has(value);
  }
}

/**
 * Predefined validation schemas
 */
export const ValidationSchemas = {
  user: {
    username: {
      type: "string",
      required: true,
      minLength: 3,
      maxLength: 30,
      pattern: /^[a-zA-Z0-9_]+$/,
      sanitize: InputValidator.sanitizeString,
    },
    email: {
      type: "email",
      required: true,
      sanitize: (v: string) => v.toLowerCase().trim(),
    },
    password: {
      type: "string",
      required: true,
      minLength: 8,
    },
  },

  query: {
    limit: {
      type: "number",
      required: false,
      custom: (v: number) => v > 0 && v <= 100,
    },
    offset: {
      type: "number",
      required: false,
      custom: (v: number) => v >= 0,
    },
    sort: {
      type: "string",
      required: false,
      enum: ["asc", "desc"],
    },
  },

  id: {
    id: {
      type: "uuid",
      required: true,
    },
  },
};

/**
 * Create input validator with schema
 */
export function createInputValidator(schema: ValidationSchema): InputValidator {
  return new InputValidator(schema);
}

/**
 * @lsi/langgraph-state - State Validation
 *
 * Schema validation using Zod, type checking, and constraint validation.
 */

import type {
  StateValidation,
  ValidationError,
  ValidationWarning,
} from "./types.js";
import { z } from "zod";

/**
 * Validation constraint
 */
export interface ValidationConstraint<T = unknown> {
  /** Constraint name */
  name: string;
  /** Validate function */
  validate: (value: T) => boolean | Promise<boolean>;
  /** Error message */
  message: string;
  /** Constraint level */
  level: "error" | "warning";
}

/**
 * Schema definition
 */
export interface SchemaDefinition<T = unknown> {
  /** Schema name */
  name: string;
  /** Schema version */
  version: string;
  /** Zod schema */
  schema: z.ZodType<T>;
  /** Custom constraints */
  constraints?: ValidationConstraint<T>[];
  /** Description */
  description?: string;
}

/**
 * Type validator
 */
export class TypeValidator {
  /**
   * Validate type matches expected
   */
  static validateType(value: unknown, expectedType: string): boolean {
    switch (expectedType) {
      case "string":
        return typeof value === "string";
      case "number":
        return typeof value === "number" && !isNaN(value);
      case "boolean":
        return typeof value === "boolean";
      case "object":
        return (
          typeof value === "object" && value !== null && !Array.isArray(value)
        );
      case "array":
        return Array.isArray(value);
      case "null":
        return value === null;
      case "undefined":
        return value === undefined;
      default:
        return false;
    }
  }

  /**
   * Get type of value
   */
  static getType(value: unknown): string {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (Array.isArray(value)) return "array";
    return typeof value;
  }
}

/**
 * State validator using Zod schemas
 */
export class StateValidator {
  private schemas: Map<string, SchemaDefinition>;
  private constraints: Map<string, ValidationConstraint[]>;

  constructor() {
    this.schemas = new Map();
    this.constraints = new Map();
  }

  /**
   * Register schema
   */
  public registerSchema<T>(schema: SchemaDefinition<T>): void {
    this.schemas.set(schema.name, schema);
  }

  /**
   * Unregister schema
   */
  public unregisterSchema(name: string): void {
    this.schemas.delete(name);
  }

  /**
   * Get schema
   */
  public getSchema<T>(name: string): SchemaDefinition<T> | undefined {
    return this.schemas.get(name) as SchemaDefinition<T> | undefined;
  }

  /**
   * Validate state against schema
   */
  public validate<T>(state: unknown, schemaName?: string): StateValidation {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate with schema if provided
    if (schemaName) {
      const schema = this.schemas.get(schemaName);
      if (!schema) {
        errors.push({
          code: "SCHEMA_NOT_FOUND",
          path: "",
          message: `Schema not found: ${schemaName}`,
          severity: "error",
        });
        return { valid: false, errors, warnings, schemaVersion: undefined };
      }

      const result = this.validateWithSchema(state, schema);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    } else {
      // Basic validation without schema
      const result = this.validateBasic(state);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }

    return {
      valid: errors.filter(e => e.severity === "error").length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate state with Zod schema
   */
  public validateWithSchema<T>(
    state: unknown,
    schema: SchemaDefinition<T>
  ): StateValidation {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Parse with Zod
      const result = schema.schema.safeParse(state);

      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            code: this.mapZodErrorCode(issue.code),
            path: issue.path.map(String).join(".") || "root",
            message: issue.message,
            expected: this.getExpectedFromIssue(issue),
            actual: this.getActualFromIssue(issue),
            severity: "error",
          });
        }
      }

      // Validate custom constraints
      if (schema.constraints) {
        for (const constraint of schema.constraints) {
          try {
            const valid = constraint.validate(state);
            if (valid instanceof Promise) {
              valid.then(v => {
                if (!v) {
                  if (constraint.level === "error") {
                    errors.push({
                      code: "CONSTRAINT_FAILED",
                      path: "",
                      message: constraint.message,
                      severity: "error",
                    });
                  } else {
                    warnings.push({
                      code: "CONSTRAINT_WARNING",
                      path: "",
                      message: constraint.message,
                      suggestion:
                        "Consider adjusting the value to meet the constraint",
                    });
                  }
                }
              });
            } else if (!valid) {
              if (constraint.level === "error") {
                errors.push({
                  code: "CONSTRAINT_FAILED",
                  path: "",
                  message: constraint.message,
                  severity: "error",
                });
              } else {
                warnings.push({
                  code: "CONSTRAINT_WARNING",
                  path: "",
                  message: constraint.message,
                  suggestion:
                    "Consider adjusting the value to meet the constraint",
                });
              }
            }
          } catch (error) {
            errors.push({
              code: "CONSTRAINT_ERROR",
              path: "",
              message: `Error validating constraint ${constraint.name}: ${error}`,
              severity: "error",
            });
          }
        }
      }
    } catch (error) {
      errors.push({
        code: "VALIDATION_ERROR",
        path: "",
        message: `Unexpected validation error: ${error}`,
        severity: "error",
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      schemaVersion: schema.version,
    };
  }

  /**
   * Basic validation without schema
   */
  public validateBasic(state: unknown): StateValidation {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check for circular references
    if (typeof state === "object" && state !== null) {
      const seen = new Set();
      try {
        JSON.stringify(state, (key, value) => {
          if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
              throw new Error("Circular reference detected");
            }
            seen.add(value);
          }
          return value;
        });
      } catch (error) {
        errors.push({
          code: "CIRCULAR_REFERENCE",
          path: "",
          message: `Circular reference detected: ${error}`,
          severity: "error",
        });
      }
    }

    // Check for undefined values in objects
    if (typeof state === "object" && state !== null && !Array.isArray(state)) {
      for (const [key, value] of Object.entries(state)) {
        if (value === undefined) {
          warnings.push({
            code: "UNDEFINED_VALUE",
            path: key,
            message: `Property '${key}' has undefined value`,
            suggestion:
              "Consider removing the property or providing a default value",
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate property at path
   */
  public validateProperty(
    state: unknown,
    path: string,
    schema: z.ZodType
  ): StateValidation {
    const value = this.getValueAtPath(state, path);

    const result = schema.safeParse(value);

    if (result.success) {
      return {
        valid: true,
        errors: [],
        warnings: [],
      };
    }

    const errors: ValidationError[] = result.error.issues.map(issue => ({
      code: this.mapZodErrorCode(issue.code),
      path: `${path}.${issue.path.map(String).join(".")}`,
      message: issue.message,
      severity: "error",
    }));

    return {
      valid: false,
      errors,
      warnings: [],
    };
  }

  /**
   * Validate state against constraints
   */
  public validateConstraints<T>(
    state: T,
    constraints: ValidationConstraint<T>[]
  ): StateValidation {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (const constraint of constraints) {
      try {
        const valid = constraint.validate(state);

        if (valid instanceof Promise) {
          // Handle async validation
          valid.then(v => {
            if (!v) {
              this.addConstraintError(errors, warnings, constraint);
            }
          });
        } else if (!valid) {
          this.addConstraintError(errors, warnings, constraint);
        }
      } catch (error) {
        errors.push({
          code: "CONSTRAINT_ERROR",
          path: "",
          message: `Error validating constraint ${constraint.name}: ${error}`,
          severity: "error",
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Create common constraints
   */
  public static createConstraints() {
    return {
      /**
       * Max length constraint for strings/arrays
       */
      maxLength: <T extends string | unknown[]>(
        max: number
      ): ValidationConstraint<T> => ({
        name: "maxLength",
        validate: (value): boolean => value.length <= max,
        message: `Length must not exceed ${max}`,
        level: "error",
      }),

      /**
       * Min length constraint for strings/arrays
       */
      minLength: <T extends string | unknown[]>(
        min: number
      ): ValidationConstraint<T> => ({
        name: "minLength",
        validate: (value): boolean => value.length >= min,
        message: `Length must be at least ${min}`,
        level: "error",
      }),

      /**
       * Range constraint for numbers
       */
      range: (min: number, max: number): ValidationConstraint<number> => ({
        name: "range",
        validate: (value): boolean => value >= min && value <= max,
        message: `Value must be between ${min} and ${max}`,
        level: "error",
      }),

      /**
       * Positive number constraint
       */
      positive: (): ValidationConstraint<number> => ({
        name: "positive",
        validate: (value): boolean => value > 0,
        message: "Value must be positive",
        level: "error",
      }),

      /**
       * Non-negative number constraint
       */
      nonNegative: (): ValidationConstraint<number> => ({
        name: "nonNegative",
        validate: (value): boolean => value >= 0,
        message: "Value must be non-negative",
        level: "error",
      }),

      /**
       * Pattern constraint for strings
       */
      pattern: (
        regex: RegExp,
        description?: string
      ): ValidationConstraint<string> => ({
        name: "pattern",
        validate: (value): boolean => regex.test(value),
        message: `Value must match pattern: ${description || regex.toString()}`,
        level: "error",
      }),

      /**
       * Email constraint
       */
      email: (): ValidationConstraint<string> => ({
        name: "email",
        validate: (value): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        message: "Value must be a valid email address",
        level: "error",
      }),

      /**
       * URL constraint
       */
      url: (): ValidationConstraint<string> => ({
        name: "url",
        validate: (value): boolean => {
          try {
            new URL(value);
            return true;
          } catch {
            return false;
          }
        },
        message: "Value must be a valid URL",
        level: "error",
      }),

      /**
       * OneOf constraint
       */
      oneOf: <T>(allowedValues: T[]): ValidationConstraint<T> => ({
        name: "oneOf",
        validate: (value): boolean => allowedValues.includes(value),
        message: `Value must be one of: ${allowedValues.join(", ")}`,
        level: "error",
      }),

      /**
       * Custom constraint
       */
      custom: <T>(
        name: string,
        validate: (value: T) => boolean | Promise<boolean>,
        message: string
      ): ValidationConstraint<T> => ({
        name,
        validate,
        message,
        level: "error",
      }),
    };
  }

  // Private helper methods

  private mapZodErrorCode(code: z.ZodIssueCode): string {
    const mapping: Record<z.ZodIssueCode, string> = {
      invalid_type: "INVALID_TYPE",
      invalid_literal: "INVALID_LITERAL",
      custom: "CUSTOM_ERROR",
      invalid_union: "INVALID_UNION",
      invalid_union_discriminator: "INVALID_UNION_DISCRIMINATOR",
      invalid_enum_value: "INVALID_ENUM_VALUE",
      invalid_arguments: "INVALID_ARGUMENTS",
      invalid_return_type: "INVALID_RETURN_TYPE",
      invalid_date: "INVALID_DATE",
      invalid_string: "INVALID_STRING",
      too_small: "TOO_SMALL",
      too_big: "TOO_BIG",
      invalid_intersect_types: "INVALID_INTERSECT_TYPES",
      not_multiple_of: "NOT_MULTIPLE_OF",
      not_finite: "NOT_FINITE",
    };

    return mapping[code] || "VALIDATION_ERROR";
  }

  private getExpectedFromIssue(issue: z.ZodIssue): unknown {
    if (issue.code === "invalid_type") {
      return issue.expected;
    }
    return undefined;
  }

  private getActualFromIssue(issue: z.ZodIssue): unknown {
    if (issue.code === "invalid_type") {
      return issue.received;
    }
    return undefined;
  }

  private getValueAtPath(state: unknown, path: string): unknown {
    const keys = path.split(".");
    let current: unknown = state;

    for (const key of keys) {
      if (typeof current !== "object" || current === null) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }

    return current;
  }

  private addConstraintError(
    errors: ValidationError[],
    warnings: ValidationWarning[],
    constraint: ValidationConstraint
  ): void {
    if (constraint.level === "error") {
      errors.push({
        code: "CONSTRAINT_FAILED",
        path: "",
        message: constraint.message,
        severity: "error",
      });
    } else {
      warnings.push({
        code: "CONSTRAINT_WARNING",
        path: "",
        message: constraint.message,
        suggestion: "Consider adjusting the value to meet the constraint",
      });
    }
  }
}

/**
 * Create built-in schemas
 */
export function createBuiltInSchemas() {
  return {
    /**
     * LangGraph state schema
     */
    langGraphState: <T extends Record<string, unknown>>(shape: z.ZodType<T>) =>
      z.object({
        messages: z.array(z.any()).optional(),
        input: z.any().optional(),
        output: z.any().optional(),
        ...shape,
      }),

    /**
     * Agent state schema
     */
    agentState: <T extends Record<string, unknown>>(shape: z.ZodType<T>) =>
      z.object({
        name: z.string(),
        status: z.enum(["idle", "running", "completed", "error"]),
        startTime: z.date().optional(),
        endTime: z.date().optional(),
        ...shape,
      }),

    /**
     * Session state schema
     */
    sessionState: <T extends Record<string, unknown>>(shape: z.ZodType<T>) =>
      z.object({
        sessionId: z.string().uuid(),
        userId: z.string().optional(),
        createdAt: z.date(),
        updatedAt: z.date(),
        ...shape,
      }),

    /**
     * Thread state schema
     */
    threadState: <T extends Record<string, unknown>>(shape: z.ZodType<T>) =>
      z.object({
        threadId: z.string().uuid(),
        messages: z.array(z.any()),
        metadata: z.record(z.any()).optional(),
        ...shape,
      }),
  };
}

/**
 * Validator factory
 */
export function createValidator(): StateValidator {
  return new StateValidator();
}

/**
 * Validate state against Zod schema directly
 */
export function validateState<T>(
  state: unknown,
  schema: z.ZodType<T>
): StateValidation {
  const validator = new StateValidator();
  return validator.validateWithSchema(state, {
    name: "inline",
    version: "1.0.0",
    schema,
  });
}

/**
 * Create schema from object shape
 */
export function createSchema<T extends Record<string, unknown>>(
  name: string,
  shape: { [K in keyof T]: z.ZodType<T[K]> },
  version: string = "1.0.0"
): SchemaDefinition<T> {
  return {
    name,
    version,
    schema: z.object(shape) as z.ZodType<T>,
  };
}

/**
 * Validate nested property
 */
export function validateNestedProperty<T>(
  state: unknown,
  path: string,
  schema: z.ZodType<T>
): StateValidation {
  const validator = new StateValidator();
  return validator.validateProperty(state, path, schema);
}

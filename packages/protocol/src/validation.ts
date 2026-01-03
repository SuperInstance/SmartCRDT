/**
 * Protocol Validation System for Aequor Cognitive Orchestration Platform
 *
 * This module provides comprehensive validation for ATP and ACP protocol packets.
 * It ensures that packets conform to protocol specifications before processing,
 * preventing invalid data from causing issues downstream.
 *
 * Validation includes:
 * - Required field presence
 * - Type checking
 * - Enum value validation
 * - Numeric range validation
 * - Timestamp reasonableness
 * - Array length validation
 * - String format validation
 *
 * Usage:
 * ```typescript
 * import { ProtocolValidator } from '@lsi/protocol';
 *
 * const validator = new ProtocolValidator();
 *
 * // Validate an ATPacket
 * const packetResult = validator.validateATPacket(packet);
 * if (!packetResult.valid) {
 *   console.error('Invalid packet:', packetResult.errors);
 * }
 *
 * // Validate an ACPHandshake
 * const handshakeResult = validator.validateACPHandshake(handshake);
 * if (!handshakeResult.valid) {
 *   console.error('Invalid handshake:', handshakeResult.errors);
 * }
 * ```
 */

import type { ACPHandshakeRequest } from "./handshake.js";
import { IntentCategory, Urgency, CollaborationMode } from "./atp-acp.js";

// Export the type so it's marked as used
export type { ACPHandshakeRequest };

/**
 * Validation error with details
 *
 * Represents a single validation failure with enough context
 * to understand and fix the issue.
 */
export interface ValidationError {
  /** Field path that failed validation (e.g., 'id', 'context.userId') */
  field: string;

  /** Human-readable error message */
  message: string;

  /** Error code for programmatic handling */
  code: string;

  /** Expected value (for debugging) */
  expected?: string;

  /** Actual value received (for debugging) */
  actual?: string;
}

/**
 * Validation warning for non-critical issues
 *
 * Warnings indicate issues that don't prevent processing
 * but should be addressed for optimal behavior.
 */
export interface ValidationWarning {
  /** Field path with warning */
  field: string;

  /** Warning message */
  message: string;

  /** Warning code */
  code: string;
}

/**
 * Complete validation result
 *
 * Contains all errors, warnings, and overall validation status.
 */
export interface ValidationResult {
  /** Whether validation passed (no errors) */
  valid: boolean;

  /** List of validation errors (empty if valid) */
  errors: ValidationError[];

  /** List of validation warnings (may be present even if valid) */
  warnings: ValidationWarning[];
}

/**
 * Validation configuration options
 *
 * Allows customization of validation behavior.
 */
export interface ValidationOptions {
  /** Allow timestamps in the future (default: false) */
  allowFutureTimestamps?: boolean;

  /** Maximum age for timestamps in milliseconds (default: 1 hour) */
  maxTimestampAge?: number;

  /** Maximum string length for text fields (default: 10000) */
  maxStringLength?: number;

  /** Maximum array length for array fields (default: 100) */
  maxArrayLength?: number;

  /** Enable strict mode (reject unknown fields) */
  strict?: boolean;
}

/**
 * Default validation options
 */
const DEFAULT_OPTIONS: Required<ValidationOptions> = {
  allowFutureTimestamps: false,
  maxTimestampAge: 60 * 60 * 1000, // 1 hour
  maxStringLength: 10000,
  maxArrayLength: 100,
  strict: false,
};

/**
 * Error codes for validation failures
 *
 * Standardized error codes for programmatic error handling.
 */
export enum ProtocolValidationErrorCode {
  /** Required field is missing */
  REQUIRED_FIELD_MISSING = "REQUIRED_FIELD_MISSING",

  /** Field has wrong type */
  INVALID_TYPE = "INVALID_TYPE",

  /** Enum value is not valid */
  INVALID_ENUM_VALUE = "INVALID_ENUM_VALUE",

  /** Number is outside valid range */
  VALUE_OUT_OF_RANGE = "VALUE_OUT_OF_RANGE",

  /** String is too long */
  STRING_TOO_LONG = "STRING_TOO_LONG",

  /** Array is too long or empty */
  INVALID_ARRAY_LENGTH = "INVALID_ARRAY_LENGTH",

  /** Timestamp is unreasonable */
  INVALID_TIMESTAMP = "INVALID_TIMESTAMP",

  /** String format is invalid */
  INVALID_FORMAT = "INVALID_FORMAT",

  /** Numeric value is not a number */
  NOT_A_NUMBER = "NOT_A_NUMBER",
}

/**
 * ProtocolValidator - Validate ATP and ACP protocol packets
 *
 * Provides comprehensive validation for all protocol packets to ensure
 * they conform to specifications before processing.
 */
export class ProtocolValidator {
  private options: Required<ValidationOptions>;

  constructor(options: ValidationOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Validate an ATPacket
   *
   * Checks all required fields, types, enum values, and ranges.
   *
   * @param packet - ATPacket to validate
   * @returns Validation result with errors and warnings
   *
   * @example
   * ```typescript
   * const validator = new ProtocolValidator();
   * const result = validator.validateATPacket({
   *   id: 'req-123',
   *   query: 'What is AI?',
   *   intent: IntentCategory.QUERY,
   *   urgency: Urgency.NORMAL,
   *   timestamp: Date.now()
   * });
   * if (!result.valid) {
   *   console.error('Validation failed:', result.errors);
   * }
   * ```
   */
  validateATPacket(packet: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check if packet is an object
    if (!packet || typeof packet !== "object" || Array.isArray(packet)) {
      return {
        valid: false,
        errors: [
          {
            field: "packet",
            message: "Packet must be an object",
            code: ProtocolValidationErrorCode.INVALID_TYPE,
            expected: "object",
            actual: Array.isArray(packet) ? "array" : typeof packet,
          },
        ],
        warnings: [],
      };
    }

    const p = packet as Record<string, unknown>;

    // Validate required field: id
    this.validateField(
      p,
      "id",
      errors,
      value => {
        if (typeof value !== "string" || value.trim().length === 0) {
          errors.push({
            field: "id",
            message: "ID must be a non-empty string",
            code: ProtocolValidationErrorCode.INVALID_TYPE,
            expected: "non-empty string",
            actual: typeof value,
          });
          return false;
        }
        return true;
      },
      true // required
    );

    // Validate required field: query
    this.validateField(
      p,
      "query",
      errors,
      value => {
        if (typeof value !== "string") {
          errors.push({
            field: "query",
            message: "Query must be a string",
            code: ProtocolValidationErrorCode.INVALID_TYPE,
            expected: "string",
            actual: typeof value,
          });
          return false;
        }
        if (value.trim().length === 0) {
          errors.push({
            field: "query",
            message: "Query cannot be empty",
            code: ProtocolValidationErrorCode.INVALID_FORMAT,
          });
          return false;
        }
        if (value.length > this.options.maxStringLength) {
          errors.push({
            field: "query",
            message: `Query exceeds maximum length of ${this.options.maxStringLength}`,
            code: ProtocolValidationErrorCode.STRING_TOO_LONG,
            expected: `<= ${this.options.maxStringLength} characters`,
            actual: `${value.length} characters`,
          });
          return false;
        }
        return true;
      },
      true // required
    );

    // Validate required field: intent
    this.validateField(
      p,
      "intent",
      errors,
      value => {
        if (!Object.values(IntentCategory).includes(value as IntentCategory)) {
          errors.push({
            field: "intent",
            message: `Intent must be one of: ${Object.values(IntentCategory).join(", ")}`,
            code: ProtocolValidationErrorCode.INVALID_ENUM_VALUE,
            expected: Object.values(IntentCategory).join(" | "),
            actual: String(value),
          });
          return false;
        }
        return true;
      },
      true // required
    );

    // Validate required field: urgency
    this.validateField(
      p,
      "urgency",
      errors,
      value => {
        if (!Object.values(Urgency).includes(value as Urgency)) {
          errors.push({
            field: "urgency",
            message: `Urgency must be one of: ${Object.values(Urgency).join(", ")}`,
            code: ProtocolValidationErrorCode.INVALID_ENUM_VALUE,
            expected: Object.values(Urgency).join(" | "),
            actual: String(value),
          });
          return false;
        }
        return true;
      },
      true // required
    );

    // Validate required field: timestamp
    this.validateField(
      p,
      "timestamp",
      errors,
      value => {
        if (typeof value !== "number" || isNaN(value)) {
          errors.push({
            field: "timestamp",
            message: "Timestamp must be a valid number",
            code: ProtocolValidationErrorCode.NOT_A_NUMBER,
            expected: "number",
            actual: typeof value,
          });
          return false;
        }

        const now = Date.now();

        // Check if timestamp is in the future
        if (!this.options.allowFutureTimestamps && value > now) {
          errors.push({
            field: "timestamp",
            message: `Timestamp cannot be in the future (current: ${now}, provided: ${value})`,
            code: ProtocolValidationErrorCode.INVALID_TIMESTAMP,
          });
          return false;
        }

        // Check if timestamp is too old
        const age = now - value;
        if (age > this.options.maxTimestampAge) {
          errors.push({
            field: "timestamp",
            message: `Timestamp is too old (age: ${Math.round(age / 1000)}s, maximum: ${this.options.maxTimestampAge / 1000}s)`,
            code: ProtocolValidationErrorCode.INVALID_TIMESTAMP,
          });
          return false;
        }

        return true;
      },
      true // required
    );

    // Validate optional field: context
    if (p.context !== undefined) {
      if (typeof p.context !== "object" || Array.isArray(p.context)) {
        errors.push({
          field: "context",
          message: "Context must be an object",
          code: ProtocolValidationErrorCode.INVALID_TYPE,
          expected: "object",
          actual: Array.isArray(p.context) ? "array" : typeof p.context,
        });
      } else {
        // Check for reasonable context size
        const contextKeys = Object.keys(p.context as object);
        if (contextKeys.length > this.options.maxArrayLength) {
          warnings.push({
            field: "context",
            message: `Context has many keys (${contextKeys.length}), consider reducing`,
            code: "LARGE_CONTEXT",
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
   * Validate an ACPHandshakeRequest
   *
   * Checks all required fields, types, enum values, ranges, and arrays.
   *
   * @param handshake - ACPHandshakeRequest to validate
   * @returns Validation result with errors and warnings
   *
   * @example
   * ```typescript
   * const validator = new ProtocolValidator();
   * const result = validator.validateACPHandshake({
   *   id: 'acp-123',
   *   query: 'Design a secure system',
   *   intent: IntentCategory.CODE_GENERATION,
   *   collaborationMode: CollaborationMode.CASCADE,
   *   models: ['gpt-4', 'codellama'],
   *   preferences: { maxLatency: 2000 },
   *   timestamp: Date.now()
   * });
   * if (!result.valid) {
   *   console.error('Validation failed:', result.errors);
   * }
   * ```
   */
  validateACPHandshake(
    handshake: ACPHandshakeRequest | unknown
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check if handshake is an object
    if (
      !handshake ||
      typeof handshake !== "object" ||
      Array.isArray(handshake)
    ) {
      return {
        valid: false,
        errors: [
          {
            field: "handshake",
            message: "Handshake must be an object",
            code: ProtocolValidationErrorCode.INVALID_TYPE,
            expected: "object",
            actual: Array.isArray(handshake) ? "array" : typeof handshake,
          },
        ],
        warnings: [],
      };
    }

    const h = handshake as Record<string, unknown>;

    // Validate required field: id
    this.validateField(
      h,
      "id",
      errors,
      value => {
        if (typeof value !== "string" || value.trim().length === 0) {
          errors.push({
            field: "id",
            message: "ID must be a non-empty string",
            code: ProtocolValidationErrorCode.INVALID_TYPE,
            expected: "non-empty string",
            actual: typeof value,
          });
          return false;
        }
        return true;
      },
      true // required
    );

    // Validate required field: query
    this.validateField(
      h,
      "query",
      errors,
      value => {
        if (typeof value !== "string") {
          errors.push({
            field: "query",
            message: "Query must be a string",
            code: ProtocolValidationErrorCode.INVALID_TYPE,
            expected: "string",
            actual: typeof value,
          });
          return false;
        }
        if (value.trim().length === 0) {
          errors.push({
            field: "query",
            message: "Query cannot be empty",
            code: ProtocolValidationErrorCode.INVALID_FORMAT,
          });
          return false;
        }
        if (value.length > this.options.maxStringLength) {
          errors.push({
            field: "query",
            message: `Query exceeds maximum length of ${this.options.maxStringLength}`,
            code: ProtocolValidationErrorCode.STRING_TOO_LONG,
            expected: `<= ${this.options.maxStringLength} characters`,
            actual: `${value.length} characters`,
          });
          return false;
        }
        return true;
      },
      true // required
    );

    // Validate required field: intent
    this.validateField(
      h,
      "intent",
      errors,
      value => {
        if (!Object.values(IntentCategory).includes(value as IntentCategory)) {
          errors.push({
            field: "intent",
            message: `Intent must be one of: ${Object.values(IntentCategory).join(", ")}`,
            code: ProtocolValidationErrorCode.INVALID_ENUM_VALUE,
            expected: Object.values(IntentCategory).join(" | "),
            actual: String(value),
          });
          return false;
        }
        return true;
      },
      true // required
    );

    // Validate required field: collaborationMode
    this.validateField(
      h,
      "collaborationMode",
      errors,
      value => {
        if (
          !Object.values(CollaborationMode).includes(value as CollaborationMode)
        ) {
          errors.push({
            field: "collaborationMode",
            message: `Collaboration mode must be one of: ${Object.values(CollaborationMode).join(", ")}`,
            code: ProtocolValidationErrorCode.INVALID_ENUM_VALUE,
            expected: Object.values(CollaborationMode).join(" | "),
            actual: String(value),
          });
          return false;
        }
        return true;
      },
      true // required
    );

    // Validate required field: models
    this.validateField(
      h,
      "models",
      errors,
      value => {
        if (!Array.isArray(value)) {
          errors.push({
            field: "models",
            message: "Models must be an array",
            code: ProtocolValidationErrorCode.INVALID_TYPE,
            expected: "array",
            actual: typeof value,
          });
          return false;
        }

        if (value.length === 0) {
          errors.push({
            field: "models",
            message: "Models array cannot be empty",
            code: ProtocolValidationErrorCode.INVALID_ARRAY_LENGTH,
          });
          return false;
        }

        if (value.length > this.options.maxArrayLength) {
          errors.push({
            field: "models",
            message: `Models array exceeds maximum length of ${this.options.maxArrayLength}`,
            code: ProtocolValidationErrorCode.INVALID_ARRAY_LENGTH,
            expected: `<= ${this.options.maxArrayLength}`,
            actual: `${value.length}`,
          });
          return false;
        }

        // Validate each model is a non-empty string
        for (let i = 0; i < value.length; i++) {
          const model = value[i];
          if (typeof model !== "string" || model.trim().length === 0) {
            errors.push({
              field: `models[${i}]`,
              message: `Model at index ${i} must be a non-empty string`,
              code: ProtocolValidationErrorCode.INVALID_TYPE,
              expected: "non-empty string",
              actual: typeof model,
            });
          }
        }

        return value.length > 0;
      },
      true // required
    );

    // Validate required field: timestamp
    this.validateField(
      h,
      "timestamp",
      errors,
      value => {
        if (typeof value !== "number" || isNaN(value)) {
          errors.push({
            field: "timestamp",
            message: "Timestamp must be a valid number",
            code: ProtocolValidationErrorCode.NOT_A_NUMBER,
            expected: "number",
            actual: typeof value,
          });
          return false;
        }

        const now = Date.now();

        // Check if timestamp is in the future
        if (!this.options.allowFutureTimestamps && value > now) {
          errors.push({
            field: "timestamp",
            message: `Timestamp cannot be in the future (current: ${now}, provided: ${value})`,
            code: ProtocolValidationErrorCode.INVALID_TIMESTAMP,
          });
          return false;
        }

        // Check if timestamp is too old
        const age = now - value;
        if (age > this.options.maxTimestampAge) {
          errors.push({
            field: "timestamp",
            message: `Timestamp is too old (age: ${Math.round(age / 1000)}s, maximum: ${this.options.maxTimestampAge / 1000}s)`,
            code: ProtocolValidationErrorCode.INVALID_TIMESTAMP,
          });
          return false;
        }

        return true;
      },
      true // required
    );

    // Validate required field: preferences
    this.validateField(
      h,
      "preferences",
      errors,
      value => {
        if (typeof value !== "object" || Array.isArray(value)) {
          errors.push({
            field: "preferences",
            message: "Preferences must be an object",
            code: ProtocolValidationErrorCode.INVALID_TYPE,
            expected: "object",
            actual: Array.isArray(value) ? "array" : typeof value,
          });
          return false;
        }

        const prefs = value as Record<string, unknown>;

        // Validate maxLatency if present
        if (prefs.maxLatency !== undefined) {
          if (typeof prefs.maxLatency !== "number" || isNaN(prefs.maxLatency)) {
            errors.push({
              field: "preferences.maxLatency",
              message: "maxLatency must be a valid number",
              code: ProtocolValidationErrorCode.NOT_A_NUMBER,
              expected: "number",
              actual: typeof prefs.maxLatency,
            });
          } else if (prefs.maxLatency < 0) {
            errors.push({
              field: "preferences.maxLatency",
              message: "maxLatency must be non-negative",
              code: ProtocolValidationErrorCode.VALUE_OUT_OF_RANGE,
              expected: ">= 0",
              actual: String(prefs.maxLatency),
            });
          }
        }

        // Validate maxCost if present
        if (prefs.maxCost !== undefined) {
          if (typeof prefs.maxCost !== "number" || isNaN(prefs.maxCost)) {
            errors.push({
              field: "preferences.maxCost",
              message: "maxCost must be a valid number",
              code: ProtocolValidationErrorCode.NOT_A_NUMBER,
              expected: "number",
              actual: typeof prefs.maxCost,
            });
          } else if (prefs.maxCost < 0) {
            errors.push({
              field: "preferences.maxCost",
              message: "maxCost must be non-negative",
              code: ProtocolValidationErrorCode.VALUE_OUT_OF_RANGE,
              expected: ">= 0",
              actual: String(prefs.maxCost),
            });
          }
        }

        // Validate minQuality if present
        if (prefs.minQuality !== undefined) {
          if (typeof prefs.minQuality !== "number" || isNaN(prefs.minQuality)) {
            errors.push({
              field: "preferences.minQuality",
              message: "minQuality must be a valid number",
              code: ProtocolValidationErrorCode.NOT_A_NUMBER,
              expected: "number",
              actual: typeof prefs.minQuality,
            });
          } else if (prefs.minQuality < 0 || prefs.minQuality > 1) {
            errors.push({
              field: "preferences.minQuality",
              message: "minQuality must be between 0 and 1",
              code: ProtocolValidationErrorCode.VALUE_OUT_OF_RANGE,
              expected: "0 <= x <= 1",
              actual: String(prefs.minQuality),
            });
          }
        }

        // Validate priority if present
        if (prefs.priority !== undefined) {
          if (!Object.values(Urgency).includes(prefs.priority as Urgency)) {
            errors.push({
              field: "preferences.priority",
              message: `Priority must be one of: ${Object.values(Urgency).join(", ")}`,
              code: ProtocolValidationErrorCode.INVALID_ENUM_VALUE,
              expected: Object.values(Urgency).join(" | "),
              actual: String(prefs.priority),
            });
          }
        }

        return true;
      },
      true // required
    );

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Helper method to validate a field
   *
   * Checks if field exists (if required) and runs validation function.
   *
   * @param obj - Object containing the field
   * @param fieldName - Name of the field to validate
   * @param errors - Array to collect errors
   * @param validate - Validation function
   * @param required - Whether field is required
   *
   * @private
   */
  private validateField(
    obj: Record<string, unknown>,
    fieldName: string,
    errors: ValidationError[],
    validate: (value: unknown) => boolean,
    required: boolean
  ): void {
    const value = obj[fieldName];

    // Check if field is missing
    if (value === undefined) {
      if (required) {
        errors.push({
          field: fieldName,
          message: `Required field '${fieldName}' is missing`,
          code: ProtocolValidationErrorCode.REQUIRED_FIELD_MISSING,
        });
      }
      return;
    }

    // Run validation
    validate(value);
  }

  /**
   * Update validation options
   *
   * Allows changing validation behavior after instantiation.
   *
   * @param options - New validation options
   *
   * @example
   * ```typescript
   * const validator = new ProtocolValidator();
   * validator.setOptions({ maxStringLength: 5000 });
   * ```
   */
  setOptions(options: Partial<ValidationOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get current validation options
   *
   * @returns Current validation options
   */
  getOptions(): Required<ValidationOptions> {
    return { ...this.options };
  }
}

/**
 * Create a validation result from errors
 *
 * Helper function to create a ValidationResult object.
 *
 * @param errors - Array of validation errors
 * @param warnings - Optional array of validation warnings
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = createValidationResult(
 *   [{ field: 'id', message: 'ID is required', code: 'REQUIRED_FIELD_MISSING' }],
 *   [{ field: 'context', message: 'Context is large', code: 'LARGE_CONTEXT' }]
 * );
 * ```
 */
export function createValidationResult(
  errors: ValidationError[],
  warnings: ValidationWarning[] = []
): ValidationResult {
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Format validation errors as a human-readable string
 *
 * @param result - Validation result to format
 * @returns Formatted error string
 *
 * @example
 * ```typescript
 * const result = validator.validateATPacket(packet);
 * if (!result.valid) {
 *   console.error(formatValidationErrors(result));
 * }
 * ```
 */
export function formatValidationErrors(result: ValidationResult): string {
  if (result.valid) {
    return "Validation passed";
  }

  const errorLines = result.errors.map(
    e => `  - ${e.field}: ${e.message} (${e.code})`
  );

  const warningLines = result.warnings.map(
    w => `  - ${w.field}: ${w.message} (${w.code})`
  );

  let output = `Validation failed with ${result.errors.length} error(s):\n${errorLines.join("\n")}`;

  if (result.warnings.length > 0) {
    output += `\n\nWarnings:\n${warningLines.join("\n")}`;
  }

  return output;
}

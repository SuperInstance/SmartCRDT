/**
 * @lsi/sanitization - Validation Framework Implementation
 *
 * Comprehensive data type validation and schema-based validation:
 * - Type checking (string, number, boolean, email, URL, etc.)
 * - Format validation (email, URL, UUID, IP, phone, date)
 * - Range and length constraints
 * - Pattern matching
 * - Custom validators
 * - Schema-based object validation
 */

import {
  type ValidationResult,
  type ValidationError,
  type ValidationWarning,
  DataType,
  type ValidationConstraint,
  type IValidator,
  ValidationErrorCode,
  ThreatSeverity,
  type InputContext,
  InputSource,
} from "@lsi/protocol";

// ============================================================================
// TYPE VALIDATORS
// ============================================================================

/**
 * Type validator implementations
 */
class TypeValidators {
  /**
   * Validate email
   */
  static email(value: unknown): boolean {
    if (typeof value !== "string") return false;
    // Basic email validation
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  /**
   * Validate URL
   */
  static url(value: unknown): boolean {
    if (typeof value !== "string") return false;
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "ftp:";
    } catch {
      return false;
    }
  }

  /**
   * Validate UUID
   */
  static uuid(value: unknown): boolean {
    if (typeof value !== "string") return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }

  /**
   * Validate IP address (v4 or v6)
   */
  static ip(value: unknown): boolean {
    return TypeValidators.ipv4(value) || TypeValidators.ipv6(value);
  }

  /**
   * Validate IPv4 address
   */
  static ipv4(value: unknown): boolean {
    if (typeof value !== "string") return false;
    const parts = value.split(".");
    if (parts.length !== 4) return false;
    return parts.every((part) => {
      const num = parseInt(part, 10);
      return !isNaN(num) && num >= 0 && num <= 255;
    });
  }

  /**
   * Validate IPv6 address
   */
  static ipv6(value: unknown): boolean {
    if (typeof value !== "string") return false;
    // Basic IPv6 validation
    const groups = value.split(":");
    if (groups.length < 3 || groups.length > 8) return false;
    return groups.every((group) => {
      if (group === "") return true; // Allow :: for compression
      const hex = parseInt(group, 16);
      return !isNaN(hex) && hex >= 0 && hex <= 0xffff;
    });
  }

  /**
   * Validate phone number
   */
  static phone(value: unknown): boolean {
    if (typeof value !== "string") return false;
    // Basic phone validation (international format)
    return /^\+?[\d\s\-()]+$/.test(value) && value.replace(/\D/g, "").length >= 10;
  }

  /**
   * Validate date
   */
  static date(value: unknown): boolean {
    if (typeof value === "number") {
      // Unix timestamp
      return value > 0 && value < 2147483647000;
    }
    if (typeof value === "string") {
      return !isNaN(Date.parse(value));
    }
    if (value instanceof Date) {
      return !isNaN(value.getTime());
    }
    return false;
  }

  /**
   * Validate hex color
   */
  static hexColor(value: unknown): boolean {
    if (typeof value !== "string") return false;
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
  }

  /**
   * Validate JSON string
   */
  static json(value: unknown): boolean {
    if (typeof value !== "string") return false;
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate base64
   */
  static base64(value: unknown): boolean {
    if (typeof value !== "string") return false;
    return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
  }

  /**
   * Validate boolean
   */
  static boolean(value: unknown): boolean {
    if (typeof value === "boolean") return true;
    if (typeof value === "string") {
      const lower = value.toLowerCase();
      return lower === "true" || lower === "false";
    }
    if (typeof value === "number") {
      return value === 0 || value === 1;
    }
    return false;
  }

  /**
   * Validate number
   */
  static number(value: unknown): boolean {
    if (typeof value === "number") return !isNaN(value);
    if (typeof value === "string") {
      return !isNaN(Number(value));
    }
    return false;
  }

  /**
   * Validate integer
   */
  static integer(value: unknown): boolean {
    if (typeof value === "number") {
      return Number.isInteger(value);
    }
    if (typeof value === "string") {
      const num = Number(value);
      return Number.isInteger(num);
    }
    return false;
  }

  /**
   * Validate array
   */
  static array(value: unknown): boolean {
    return Array.isArray(value);
  }

  /**
   * Validate object
   */
  static object(value: unknown): boolean {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  /**
   * Validate string
   */
  static string(value: unknown): boolean {
    return typeof value === "string";
  }
}

// ============================================================================
// VALIDATION FRAMEWORK
// ============================================================================

export class ValidationFramework implements IValidator {
  private context?: InputContext;

  /**
   * Create a validation framework with optional context
   */
  constructor(context?: InputContext) {
    this.context = context;
  }

  /**
   * Validate a value against a type
   */
  validate(value: unknown, type: DataType, constraints?: ValidationConstraint): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check if value is null/undefined
    if (value === null || value === undefined) {
      if (constraints?.nullable) {
        return {
          isValid: true,
          errors: [],
          warnings: [],
          sanitizedValue: null as unknown as string,
        };
      }

      if (!constraints?.optional) {
        errors.push({
          code: ValidationErrorCode.REQUIRED,
          message: `Value is required but got ${value}`,
          expected: type,
        });
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    }

    // Apply trimming if specified
    let processedValue = value;
    if (typeof value === "string" && constraints?.trim) {
      processedValue = value.trim();
    }

    // Apply case conversion if specified
    if (typeof processedValue === "string" && constraints?.caseConversion) {
      switch (constraints.caseConversion) {
        case "upper":
          processedValue = processedValue.toUpperCase();
          break;
        case "lower":
          processedValue = processedValue.toLowerCase();
          break;
      }
    }

    // Validate type
    const typeValid = this.validateType(processedValue, type);
    if (!typeValid) {
      errors.push({
        code: ValidationErrorCode.INVALID_TYPE,
        message: `Expected type ${type} but got ${typeof processedValue}`,
        value: processedValue,
        expected: type,
      });
    }

    // Validate constraints
    if (typeValid && constraints) {
      const constraintErrors = this.validateConstraints(processedValue, type, constraints);
      errors.push(...constraintErrors);
    }

    // Contextual warnings
    if (this.context) {
      const contextualWarnings = this.getContextualWarnings(processedValue, type);
      warnings.push(...contextualWarnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedValue: typeof processedValue === "string" ? processedValue : undefined,
    };
  }

  /**
   * Validate multiple fields
   */
  validateBatch(
    data: Record<string, unknown>,
    schema: Record<string, { type: DataType; constraints?: ValidationConstraint }>
  ): ValidationResult {
    const allErrors: ValidationError[] = [];
    const allWarnings: ValidationWarning[] = [];

    for (const [field, fieldSchema] of Object.entries(schema)) {
      const result = this.validate(data[field], fieldSchema.type, fieldSchema.constraints);

      // Add field name to errors
      const fieldErrors = result.errors.map((error) => ({
        ...error,
        field,
      }));

      const fieldWarnings = result.warnings.map((warning) => ({
        ...warning,
        field,
      }));

      allErrors.push(...fieldErrors);
      allWarnings.push(...fieldWarnings);
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
    };
  }

  /**
   * Validate a value against a schema (delegates to SchemaValidator)
   */
  validateSchema(data: unknown, schema: unknown): unknown {
    // Import SchemaValidator to avoid circular dependency
    const { SchemaValidator } = require("./SchemaValidator");
    const validator = new SchemaValidator();
    return validator.validate(data, schema as never);
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Validate type
   */
  private validateType(value: unknown, type: DataType): boolean {
    const validatorFn = TypeValidators[type as keyof typeof TypeValidators];
    if (typeof validatorFn === "function") {
      return validatorFn(value);
    }
    return false;
  }

  /**
   * Validate constraints
   */
  private validateConstraints(
    value: unknown,
    type: DataType,
    constraints: ValidationConstraint
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Min/max value constraints (for numbers)
    if (type === DataType.NUMBER || type === DataType.INTEGER) {
      const numValue = typeof value === "string" ? Number(value) : (value as number);

      if (constraints.min !== undefined && numValue < constraints.min) {
        errors.push({
          code: ValidationErrorCode.OUT_OF_RANGE,
          message: `Value ${numValue} is less than minimum ${constraints.min}`,
          value: numValue,
          expected: `>= ${constraints.min}`,
        });
      }

      if (constraints.max !== undefined && numValue > constraints.max) {
        errors.push({
          code: ValidationErrorCode.OUT_OF_RANGE,
          message: `Value ${numValue} is greater than maximum ${constraints.max}`,
          value: numValue,
          expected: `<= ${constraints.max}`,
        });
      }
    }

    // Length constraints (for strings and arrays)
    if (typeof value === "string" || Array.isArray(value)) {
      const length = value.length;

      if (constraints.minLength !== undefined && length < constraints.minLength) {
        errors.push({
          code: ValidationErrorCode.TOO_SHORT,
          message: `Length ${length} is less than minimum ${constraints.minLength}`,
          value: length,
          expected: `>= ${constraints.minLength}`,
        });
      }

      if (constraints.maxLength !== undefined && length > constraints.maxLength) {
        errors.push({
          code: ValidationErrorCode.TOO_LONG,
          message: `Length ${length} exceeds maximum ${constraints.maxLength}`,
          value: length,
          expected: `<= ${constraints.maxLength}`,
        });
      }
    }

    // Pattern constraint
    if (constraints.pattern && typeof value === "string") {
      const pattern = typeof constraints.pattern === "string"
        ? new RegExp(constraints.pattern)
        : constraints.pattern;

      if (!pattern.test(value)) {
        errors.push({
          code: ValidationErrorCode.INVALID_FORMAT,
          message: `Value does not match required pattern`,
          value,
          expected: pattern.toString(),
        });
      }
    }

    // Enum constraint
    if (constraints.enum && constraints.enum.length > 0) {
      if (!constraints.enum.includes(value as string | number)) {
        errors.push({
          code: ValidationErrorCode.OUT_OF_RANGE,
          message: `Value is not one of the allowed values`,
          value,
          expected: `one of: ${constraints.enum.join(", ")}`,
        });
      }
    }

    // Custom validator
    if (constraints.custom) {
      try {
        const valid = constraints.custom(value);
        if (!valid) {
          errors.push({
            code: ValidationErrorCode.INVALID_FORMAT,
            message: `Custom validation failed`,
            value,
          });
        }
      } catch (error) {
        errors.push({
          code: ValidationErrorCode.INVALID_FORMAT,
          message: `Custom validator error: ${error instanceof Error ? error.message : String(error)}`,
          value,
        });
      }
    }

    return errors;
  }

  /**
   * Get contextual warnings based on input source
   */
  private getContextualWarnings(value: unknown, type: DataType): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    if (!this.context) {
      return warnings;
    }

    // Warn about potentially dangerous inputs from untrusted sources
    const untrustedSources = [
      InputSource.WEB_FORM,
      InputSource.API_BODY,
      InputSource.API_QUERY,
      InputSource.API_PATH,
      InputSource.CLI_ARG,
      InputSource.FILE,
    ];

    if (untrustedSources.includes(this.context.source as InputSource)) {
      if (typeof value === "string") {
        // Check for suspicious patterns
        if (value.includes("..") || value.includes("~")) {
          warnings.push({
            code: "SUSPICIOUS_PATH",
            message: "Input contains path traversal patterns",
            value,
            severity: ThreatSeverity.MEDIUM,
          });
        }

        if (value.includes("<script") || value.includes("javascript:")) {
          warnings.push({
            code: "SUSPICIOUS_SCRIPT",
            message: "Input contains script-like patterns",
            value,
            severity: ThreatSeverity.HIGH,
          });
        }

        if (/;|\||&/.test(value)) {
          warnings.push({
            code: "SUSPICIOUS_COMMAND",
            message: "Input contains command injection patterns",
            value,
            severity: ThreatSeverity.HIGH,
          });
        }
      }
    }

    return warnings;
  }

  /**
   * Set validation context
   */
  setContext(context: InputContext): void {
    this.context = context;
  }

  /**
   * Get current context
   */
  getContext(): InputContext | undefined {
    return this.context;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Quick validation helper
 */
export function validate<T = unknown>(
  value: unknown,
  type: DataType,
  constraints?: ValidationConstraint
): value is T {
  const framework = new ValidationFramework();
  const result = framework.validate(value, type, constraints);
  return result.isValid;
}

/**
 * Validate and sanitize helper
 */
export function validateAndSanitize(
  value: unknown,
  type: DataType,
  constraints?: ValidationConstraint
): { valid: boolean; value?: string; errors: string[] } {
  const framework = new ValidationFramework();
  const result = framework.validate(value, type, constraints);

  return {
    valid: result.isValid,
    value: result.sanitizedValue,
    errors: result.errors.map((e) => e.message),
  };
}

/**
 * Create a contextual validator
 */
export function createContextualValidator(source: InputSource, metadata?: Record<string, unknown>): ValidationFramework {
  const context: InputContext = {
    source,
    timestamp: new Date(),
    metadata,
  };

  return new ValidationFramework(context);
}

// ============================================================================
// EXPORTS
// ============================================================================

export { TypeValidators };

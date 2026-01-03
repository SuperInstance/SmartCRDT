/**
 * ValidationError - Input validation errors
 *
 * Provides structured error handling for input validation failures,
 * with detailed field-level error information and suggestions for fixing.
 *
 * @packageDocumentation
 */

import {
  AdapterError,
  ErrorSeverity,
  RecoveryStrategy,
} from "./AdapterError.js";

/**
 * Validation error codes
 */
export enum ValidationErrorCode {
  /** Required field missing */
  REQUIRED_FIELD = "VALIDATION_REQUIRED_FIELD",
  /** Invalid format */
  INVALID_FORMAT = "VALIDATION_INVALID_FORMAT",
  /** Invalid type */
  INVALID_TYPE = "VALIDATION_INVALID_TYPE",
  /** Value out of range */
  OUT_OF_RANGE = "VALIDATION_OUT_OF_RANGE",
  /** Value too long */
  TOO_LONG = "VALIDATION_TOO_LONG",
  /** Value too short */
  TOO_SHORT = "VALIDATION_TOO_SHORT",
  /** Invalid enum value */
  INVALID_ENUM = "VALIDATION_INVALID_ENUM",
  /** Pattern mismatch */
  PATTERN_MISMATCH = "VALIDATION_PATTERN_MISMATCH",
  /** Constraint violation */
  CONSTRAINT_VIOLATION = "VALIDATION_CONSTRAINT_VIOLATION",
  /** Schema validation failed */
  SCHEMA_FAILED = "VALIDATION_SCHEMA_FAILED",
  /** Unknown validation error */
  UNKNOWN_ERROR = "VALIDATION_UNKNOWN_ERROR",
}

/**
 * Field validation error details
 */
export interface FieldValidationError {
  /** Field name */
  field: string;
  /** Error code */
  code: ValidationErrorCode;
  /** Error message */
  message: string;
  /** Actual value received */
  received?: unknown;
  /** Expected value/type */
  expected?: string;
  /** Constraint details */
  constraint?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: unknown[];
    custom?: string;
  };
  /** Suggested fix */
  suggestion?: string;
}

/**
 * Validation result with multiple field errors
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Field-level errors */
  errors: FieldValidationError[];
  /** Overall error message */
  message?: string;
}

/**
 * ValidationError - Validation error class
 *
 * @example
 * ```typescript
 * throw ValidationError.requiredField('query');
 * throw ValidationError.invalidFormat('email', 'invalid-email', 'user@example.com');
 * throw ValidationError.outOfRange('temperature', 2.5, 0, 1);
 * ```
 */
export class ValidationError extends AdapterError {
  /** Field-level validation errors */
  public readonly fieldErrors: FieldValidationError[];

  /** Validation result */
  public readonly validationResult?: ValidationResult;

  private constructor(
    operation: string,
    message: string,
    code: ValidationErrorCode,
    fieldErrors: FieldValidationError[] = [],
    context: Record<string, unknown> = {},
    cause?: Error
  ) {
    super("Validation", operation, message, code, context, cause);

    this.fieldErrors = fieldErrors;
    this.validationResult = {
      valid: false,
      errors: fieldErrors,
      message,
    };
  }

  /**
   * Create error for missing required field
   */
  static requiredField(fieldName: string, received?: unknown): ValidationError {
    const error: FieldValidationError = {
      field: fieldName,
      code: ValidationErrorCode.REQUIRED_FIELD,
      message: `Required field '${fieldName}' is missing`,
      received,
      suggestion: `Provide a value for '${fieldName}'`,
    };

    return new ValidationError(
      "validate",
      `Validation failed: Required field '${fieldName}' is missing`,
      ValidationErrorCode.REQUIRED_FIELD,
      [error],
      {
        severity: ErrorSeverity.MEDIUM,
        recovery: RecoveryStrategy.ABORT,
        retryable: false,
        context: { fieldName, received },
      }
    );
  }

  /**
   * Create error for invalid format
   */
  static invalidFormat(
    fieldName: string,
    received: unknown,
    expectedFormat: string,
    example?: string
  ): ValidationError {
    const error: FieldValidationError = {
      field: fieldName,
      code: ValidationErrorCode.INVALID_FORMAT,
      message: `Field '${fieldName}' has invalid format. Expected ${expectedFormat}`,
      received,
      expected: expectedFormat,
      suggestion: example
        ? `Example: ${example}`
        : `Provide ${fieldName} in ${expectedFormat} format`,
    };

    return new ValidationError(
      "validate",
      `Validation failed: '${fieldName}' has invalid format`,
      ValidationErrorCode.INVALID_FORMAT,
      [error],
      {
        severity: ErrorSeverity.MEDIUM,
        recovery: RecoveryStrategy.ABORT,
        retryable: false,
        context: { fieldName, received, expectedFormat },
      }
    );
  }

  /**
   * Create error for invalid type
   */
  static invalidType(
    fieldName: string,
    received: unknown,
    expectedType: string
  ): ValidationError {
    const receivedType = received === null ? "null" : typeof received;

    const error: FieldValidationError = {
      field: fieldName,
      code: ValidationErrorCode.INVALID_TYPE,
      message: `Field '${fieldName}' must be ${expectedType}, received ${receivedType}`,
      received,
      expected: expectedType,
      suggestion: `Provide ${fieldName} as ${expectedType}`,
    };

    return new ValidationError(
      "validate",
      `Validation failed: '${fieldName}' has invalid type`,
      ValidationErrorCode.INVALID_TYPE,
      [error],
      {
        severity: ErrorSeverity.MEDIUM,
        recovery: RecoveryStrategy.ABORT,
        retryable: false,
        context: { fieldName, received, receivedType, expectedType },
      }
    );
  }

  /**
   * Create error for value out of range
   */
  static outOfRange(
    fieldName: string,
    value: number,
    min?: number,
    max?: number
  ): ValidationError {
    const rangeStr =
      min !== undefined && max !== undefined
        ? `between ${min} and ${max}`
        : min !== undefined
          ? `>= ${min}`
          : max !== undefined
            ? `<= ${max}`
            : "valid range";

    const error: FieldValidationError = {
      field: fieldName,
      code: ValidationErrorCode.OUT_OF_RANGE,
      message: `Field '${fieldName}' value ${value} is out of range. Must be ${rangeStr}`,
      received: value,
      constraint: { min, max },
      suggestion: `Provide ${fieldName} value ${rangeStr}`,
    };

    return new ValidationError(
      "validate",
      `Validation failed: '${fieldName}' value out of range`,
      ValidationErrorCode.OUT_OF_RANGE,
      [error],
      {
        severity: ErrorSeverity.MEDIUM,
        recovery: RecoveryStrategy.ABORT,
        retryable: false,
        context: { fieldName, value, min, max },
      }
    );
  }

  /**
   * Create error for value too long
   */
  static tooLong(
    fieldName: string,
    length: number,
    maxLength: number
  ): ValidationError {
    const error: FieldValidationError = {
      field: fieldName,
      code: ValidationErrorCode.TOO_LONG,
      message: `Field '${fieldName}' is too long. Maximum length is ${maxLength}, received ${length}`,
      received: length,
      constraint: { max: maxLength },
      suggestion: `Shorten '${fieldName}' to ${maxLength} characters or less`,
    };

    return new ValidationError(
      "validate",
      `Validation failed: '${fieldName}' is too long`,
      ValidationErrorCode.TOO_LONG,
      [error],
      {
        severity: ErrorSeverity.MEDIUM,
        recovery: RecoveryStrategy.ABORT,
        retryable: false,
        context: { fieldName, length, maxLength },
      }
    );
  }

  /**
   * Create error for value too short
   */
  static tooShort(
    fieldName: string,
    length: number,
    minLength: number
  ): ValidationError {
    const error: FieldValidationError = {
      field: fieldName,
      code: ValidationErrorCode.TOO_SHORT,
      message: `Field '${fieldName}' is too short. Minimum length is ${minLength}, received ${length}`,
      received: length,
      constraint: { min: minLength },
      suggestion: `Lengthen '${fieldName}' to ${minLength} characters or more`,
    };

    return new ValidationError(
      "validate",
      `Validation failed: '${fieldName}' is too short`,
      ValidationErrorCode.TOO_SHORT,
      [error],
      {
        severity: ErrorSeverity.MEDIUM,
        recovery: RecoveryStrategy.ABORT,
        retryable: false,
        context: { fieldName, length, minLength },
      }
    );
  }

  /**
   * Create error for invalid enum value
   */
  static invalidEnum(
    fieldName: string,
    received: unknown,
    validValues: unknown[]
  ): ValidationError {
    const error: FieldValidationError = {
      field: fieldName,
      code: ValidationErrorCode.INVALID_ENUM,
      message: `Field '${fieldName}' has invalid value. Must be one of: ${validValues.join(", ")}`,
      received,
      constraint: { enum: validValues },
      suggestion: `Use one of: ${validValues.join(", ")}`,
    };

    return new ValidationError(
      "validate",
      `Validation failed: '${fieldName}' has invalid enum value`,
      ValidationErrorCode.INVALID_ENUM,
      [error],
      {
        severity: ErrorSeverity.MEDIUM,
        recovery: RecoveryStrategy.ABORT,
        retryable: false,
        context: { fieldName, received, validValues },
      }
    );
  }

  /**
   * Create error for pattern mismatch
   */
  static patternMismatch(
    fieldName: string,
    received: string,
    pattern: string,
    patternName?: string
  ): ValidationError {
    const error: FieldValidationError = {
      field: fieldName,
      code: ValidationErrorCode.PATTERN_MISMATCH,
      message: `Field '${fieldName}' does not match required pattern${patternName ? ` (${patternName})` : ""}`,
      received,
      constraint: { pattern },
      suggestion: patternName
        ? `Provide ${fieldName} in ${patternName} format`
        : `Provide ${fieldName} matching pattern: ${pattern}`,
    };

    return new ValidationError(
      "validate",
      `Validation failed: '${fieldName}' pattern mismatch`,
      ValidationErrorCode.PATTERN_MISMATCH,
      [error],
      {
        severity: ErrorSeverity.MEDIUM,
        recovery: RecoveryStrategy.ABORT,
        retryable: false,
        context: { fieldName, received, pattern, patternName },
      }
    );
  }

  /**
   * Create error for constraint violation
   */
  static constraintViolation(
    fieldName: string,
    message: string,
    constraintDetails?: Record<string, unknown>
  ): ValidationError {
    const error: FieldValidationError = {
      field: fieldName,
      code: ValidationErrorCode.CONSTRAINT_VIOLATION,
      message: `Field '${fieldName}' violates constraint: ${message}`,
      constraint: constraintDetails,
      suggestion: "Ensure all constraints are satisfied",
    };

    return new ValidationError(
      "validate",
      `Validation failed: '${fieldName}' constraint violation`,
      ValidationErrorCode.CONSTRAINT_VIOLATION,
      [error],
      {
        severity: ErrorSeverity.MEDIUM,
        recovery: RecoveryStrategy.ABORT,
        retryable: false,
        context: { fieldName, constraintDetails },
      }
    );
  }

  /**
   * Create error for schema validation failure
   */
  static schemaFailed(
    schemaName: string,
    errors: FieldValidationError[]
  ): ValidationError {
    return new ValidationError(
      "validateSchema",
      `Schema validation failed for ${schemaName} with ${errors.length} error(s)`,
      ValidationErrorCode.SCHEMA_FAILED,
      errors,
      {
        severity: ErrorSeverity.MEDIUM,
        recovery: RecoveryStrategy.ABORT,
        retryable: false,
        context: { schemaName, errorCount: errors.length },
      }
    );
  }

  /**
   * Create error for unknown validation issues
   */
  static unknown(
    operation: string,
    message: string,
    cause?: Error
  ): ValidationError {
    return new ValidationError(
      operation,
      `Unknown validation error: ${message}`,
      ValidationErrorCode.UNKNOWN_ERROR,
      [],
      {
        severity: ErrorSeverity.MEDIUM,
        recovery: RecoveryStrategy.ABORT,
        retryable: false,
      },
      cause
    );
  }

  /**
   * Check if specific field has error
   */
  hasFieldError(fieldName: string): boolean {
    return this.fieldErrors.some(e => e.field === fieldName);
  }

  /**
   * Get error for specific field
   */
  getFieldError(fieldName: string): FieldValidationError | undefined {
    return this.fieldErrors.find(e => e.field === fieldName);
  }

  /**
   * Get all field errors
   */
  getAllFieldErrors(): FieldValidationError[] {
    return [...this.fieldErrors];
  }

  /**
   * Format errors as human-readable string
   */
  formatErrors(): string {
    if (this.fieldErrors.length === 0) {
      return this.message;
    }

    return this.fieldErrors
      .map(
        e =>
          `  - ${e.field}: ${e.message}${e.suggestion ? `\n    Suggestion: ${e.suggestion}` : ""}`
      )
      .join("\n");
  }

  /**
   * Convert to validation result
   */
  toResult(): ValidationResult {
    return (
      this.validationResult || {
        valid: false,
        errors: this.fieldErrors,
        message: this.message,
      }
    );
  }
}

export default ValidationError;

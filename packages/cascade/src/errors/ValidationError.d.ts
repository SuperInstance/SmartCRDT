/**
 * ValidationError - Input validation errors
 *
 * Provides structured error handling for input validation failures,
 * with detailed field-level error information and suggestions for fixing.
 *
 * @packageDocumentation
 */
import { AdapterError } from "./AdapterError.js";
/**
 * Validation error codes
 */
export declare enum ValidationErrorCode {
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
    UNKNOWN_ERROR = "VALIDATION_UNKNOWN_ERROR"
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
export declare class ValidationError extends AdapterError {
    /** Field-level validation errors */
    readonly fieldErrors: FieldValidationError[];
    /** Validation result */
    readonly validationResult?: ValidationResult;
    private constructor();
    /**
     * Create error for missing required field
     */
    static requiredField(fieldName: string, received?: unknown): ValidationError;
    /**
     * Create error for invalid format
     */
    static invalidFormat(fieldName: string, received: unknown, expectedFormat: string, example?: string): ValidationError;
    /**
     * Create error for invalid type
     */
    static invalidType(fieldName: string, received: unknown, expectedType: string): ValidationError;
    /**
     * Create error for value out of range
     */
    static outOfRange(fieldName: string, value: number, min?: number, max?: number): ValidationError;
    /**
     * Create error for value too long
     */
    static tooLong(fieldName: string, length: number, maxLength: number): ValidationError;
    /**
     * Create error for value too short
     */
    static tooShort(fieldName: string, length: number, minLength: number): ValidationError;
    /**
     * Create error for invalid enum value
     */
    static invalidEnum(fieldName: string, received: unknown, validValues: unknown[]): ValidationError;
    /**
     * Create error for pattern mismatch
     */
    static patternMismatch(fieldName: string, received: string, pattern: string, patternName?: string): ValidationError;
    /**
     * Create error for constraint violation
     */
    static constraintViolation(fieldName: string, message: string, constraintDetails?: Record<string, unknown>): ValidationError;
    /**
     * Create error for schema validation failure
     */
    static schemaFailed(schemaName: string, errors: FieldValidationError[]): ValidationError;
    /**
     * Create error for unknown validation issues
     */
    static unknown(operation: string, message: string, cause?: Error): ValidationError;
    /**
     * Check if specific field has error
     */
    hasFieldError(fieldName: string): boolean;
    /**
     * Get error for specific field
     */
    getFieldError(fieldName: string): FieldValidationError | undefined;
    /**
     * Get all field errors
     */
    getAllFieldErrors(): FieldValidationError[];
    /**
     * Format errors as human-readable string
     */
    formatErrors(): string;
    /**
     * Convert to validation result
     */
    toResult(): ValidationResult;
}
export default ValidationError;
//# sourceMappingURL=ValidationError.d.ts.map
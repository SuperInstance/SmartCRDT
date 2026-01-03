/**
 * @lsi/sanitization - Input Sanitization and Validation Package
 *
 * Comprehensive security package for preventing injection attacks:
 * - InputSanitizer: Sanitize strings against injection attacks
 * - ValidationFramework: Type and format validation
 * - SchemaValidator: Schema-based validation
 * - SanitizationMiddleware: Request/response sanitization middleware
 *
 * @packageDocumentation
 */

// ============================================================================
// INPUT SANITIZER
// ============================================================================

export {
  InputSanitizer,
  globalInputSanitizer,
} from "./InputSanitizer.js";

// ============================================================================
// VALIDATION FRAMEWORK
// ============================================================================

export {
  ValidationFramework,
  TypeValidators,
  validate,
  validateAndSanitize,
  createContextualValidator,
} from "./ValidationFramework.js";

// ============================================================================
// SCHEMA VALIDATOR
// ============================================================================

export {
  SchemaValidator,
  FormatValidators,
  CompiledSchemaImpl,
  validateSchema,
  createSchemaValidator,
  compileSchema,
  CommonSchemas,
} from "./SchemaValidator.js";

// ============================================================================
// SANITIZATION MIDDLEWARE
// ============================================================================

export {
  SanitizationMiddleware,
  ThreatAnalyzer,
  createBodySanitizerMiddleware,
  createQuerySanitizerMiddleware,
  createParamSanitizerMiddleware,
  createHeaderSanitizerMiddleware,
  createSanitizationMiddleware,
  sanitizeCliArgs,
  sanitizeEnvVars,
} from "./SanitizationMiddleware.js";

// ============================================================================
// RE-EXPORT PROTOCOL TYPES
// ============================================================================

export {
  // Injection Types
  InjectionType,
  ThreatSeverity,
  // Sanitization Types
  type SanitizationResult,
  type DetectedThreat,
  SanitizationMethod,
  // Validation Types
  type ValidationResult,
  type ValidationError,
  ValidationErrorCode,
  type ValidationWarning,
  // Data Type Validation
  DataType,
  type ValidationConstraint,
  // Schema Validation
  type ValidationSchema,
  type SchemaValidationResult,
  type SchemaValidationError,
  // Sanitization Options
  type SanitizationOptions,
  type CustomSanitizationRule,
  // Input Context
  type InputContext,
  InputSource,
  // Security Thresholds
  type SecurityThresholds,
  // Interfaces
  type IInputSanitizer,
  type IValidator,
  type ISchemaValidator,
  type CompiledSchema,
  type ISanitizationMiddleware,
  // Utilities
  type SanitizedString,
  type ValidatedData,
  type SanitizationStatistics,
  DEFAULT_SANITIZATION_OPTIONS,
  DEFAULT_SECURITY_THRESHOLDS,
  CONTEXTUAL_OPTIONS,
} from "@lsi/protocol";

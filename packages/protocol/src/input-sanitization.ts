/**
 * @lsi/protocol - Input Sanitization and Validation Types
 *
 * Comprehensive security types for preventing injection attacks:
 * - SQL Injection
 * - XSS (Cross-Site Scripting)
 * - Command Injection
 * - LDAP Injection
 * - Path Traversal
 * - SSRF (Server-Side Request Forgery)
 * - NoSQL Injection
 * - Template Injection
 */

// ============================================================================
// INJECTION TYPE ENUMERATION
// ============================================================================

/**
 * Categories of injection attacks to prevent
 */
export enum InjectionType {
  /** SQL Injection - malicious SQL code in input */
  SQL_INJECTION = "SQL_INJECTION",

  /** XSS - malicious scripts in web content */
  XSS = "XSS",

  /** Command Injection - OS commands in input */
  COMMAND_INJECTION = "COMMAND_INJECTION",

  /** LDAP Injection - malicious LDAP queries */
  LDAP_INJECTION = "LDAP_INJECTION",

  /** Path Traversal - directory navigation attacks */
  PATH_TRAVERSAL = "PATH_TRAVERSAL",

  /** SSRF - forged server requests */
  SSRF = "SSRF",

  /** NoSQL Injection - NoSQL database attacks */
  NOSQL_INJECTION = "NOSQL_INJECTION",

  /** Template Injection - template engine attacks */
  TEMPLATE_INJECTION = "TEMPLATE_INJECTION",

  /** Header Injection - HTTP header manipulation */
  HEADER_INJECTION = "HEADER_INJECTION",

  /** XML Injection - malicious XML content */
  XML_INJECTION = "XML_INJECTION",
}

/**
 * Severity levels for detected threats
 */
export enum ThreatSeverity {
  /** Critical - immediate threat, block */
  CRITICAL = "CRITICAL",

  /** High - significant threat, block */
  HIGH = "HIGH",

  /** Medium - moderate threat, sanitize */
  MEDIUM = "MEDIUM",

  /** Low - minor threat, log */
  LOW = "LOW",

  /** Info - informational only */
  INFO = "INFO",
}

// ============================================================================
// SANITIZATION RESULT TYPES
// ============================================================================

/**
 * Result of input sanitization
 */
export interface SanitizationResult {
  /** Sanitized output */
  sanitized: string;

  /** Whether any changes were made */
  wasModified: boolean;

  /** Threats detected during sanitization */
  threats: DetectedThreat[];

  /** Sanitization methods applied */
  methodsApplied: SanitizationMethod[];
}

/**
 * A detected threat in input
 */
export interface DetectedThreat {
  /** Type of injection detected */
  type: InjectionType;

  /** Severity of the threat */
  severity: ThreatSeverity;

  /** Position in input where threat was found */
  position: {
    /** Start index */
    start: number;

    /** End index */
    end: number;
  };

  /** The malicious content that was detected */
  content: string;

  /** Description of the threat */
  description: string;

  /** Suggested remediation */
  remediation: string;
}

/**
 * Sanitization methods available
 */
export enum SanitizationMethod {
  /** HTML entity encoding */
  HTML_ENCODE = "HTML_ENCODE",

  /** HTML tag removal */
  HTML_STRIP = "HTML_STRIP",

  /** URL encoding */
  URL_ENCODE = "URL_ENCODE",

  /** SQL escaping */
  SQL_ESCAPE = "SQL_ESCAPE",

  /** Command escaping */
  COMMAND_ESCAPE = "COMMAND_ESCAPE",

  /** LDAP escaping */
  LDAP_ESCAPE = "LDAP_ESCAPE",

  /** Path normalization */
  PATH_NORMALIZE = "PATH_NORMALIZE",

  /** XML encoding */
  XML_ENCODE = "XML_ENCODE",

  /** Unicode normalization */
  UNICODE_NORMALIZE = "UNICODE_NORMALIZE",

  /** Null byte removal */
  NULL_BYTE_STRIP = "NULL_BYTE_STRIP",

  /** Control character removal */
  CONTROL_CHAR_STRIP = "CONTROL_CHAR_STRIP",

  /** Whitespace normalization */
  WHITESPACE_NORMALIZE = "WHITESPACE_NORMALIZE",
}

// ============================================================================
// VALIDATION RESULT TYPES
// ============================================================================

/**
 * Result of input validation
 */
export interface InputValidationResult {
  /** Whether validation passed */
  isValid: boolean;

  /** Validation errors found */
  errors: InputValidationError[];

  /** Validation warnings (non-blocking) */
  warnings: InputValidationWarning[];

  /** The validated and sanitized value */
  sanitizedValue?: string;
}

/**
 * A validation error
 */
export interface InputValidationError {
  /** Error code */
  code: InputValidationErrorCode;

  /** Error message */
  message: string;

  /** Field or context where error occurred */
  field?: string;

  /** The invalid value */
  value?: unknown;

  /** Expected format/rule */
  expected?: string;
}

/**
 * Validation error codes
 */
export enum InputValidationErrorCode {
  // Generic errors
  REQUIRED = "REQUIRED",
  INVALID_TYPE = "INVALID_TYPE",
  INVALID_FORMAT = "INVALID_FORMAT",
  OUT_OF_RANGE = "OUT_OF_RANGE",
  TOO_LONG = "TOO_LONG",
  TOO_SHORT = "TOO_SHORT",

  // Pattern errors
  INVALID_EMAIL = "INVALID_EMAIL",
  INVALID_URL = "INVALID_URL",
  INVALID_UUID = "INVALID_UUID",
  INVALID_IP = "INVALID_IP",
  INVALID_PHONE = "INVALID_PHONE",
  INVALID_DATE = "INVALID_DATE",

  // Security errors
  MALICIOUS_CONTENT = "MALICIOUS_CONTENT",
  INJECTION_DETECTED = "INJECTION_DETECTED",
  XSS_DETECTED = "XSS_DETECTED",
  SQL_INJECTION_DETECTED = "SQL_INJECTION_DETECTED",
  COMMAND_INJECTION_DETECTED = "COMMAND_INJECTION_DETECTED",
  PATH_TRAVERSAL_DETECTED = "PATH_TRAVERSAL_DETECTED",
  SSRF_DETECTED = "SSRF_DETECTED",

  // Business rule errors
  DUPLICATE = "DUPLICATE",
  NOT_FOUND = "NOT_FOUND",
  ALREADY_EXISTS = "ALREADY_EXISTS",
  CONFLICT = "CONFLICT",
}

/**
 * A validation warning (non-blocking)
 */
export interface InputValidationWarning {
  /** Warning code */
  code: string;

  /** Warning message */
  message: string;

  /** Field or context */
  field?: string;

  /** The value that triggered the warning */
  value?: unknown;

  /** Severity of the warning */
  severity: ThreatSeverity;
}

// ============================================================================
// DATA TYPE VALIDATION TYPES
// ============================================================================

/**
 * Supported data types for validation
 */
export enum DataType {
  /** String data */
  STRING = "string",

  /** Number (integer or float) */
  NUMBER = "number",

  /** Integer number */
  INTEGER = "integer",

  /** Boolean */
  BOOLEAN = "boolean",

  /** Array */
  ARRAY = "array",

  /** Object/dictionary */
  OBJECT = "object",

  /** Email address */
  EMAIL = "email",

  /** URL */
  URL = "url",

  /** UUID */
  UUID = "uuid",

  /** IP address (v4 or v6) */
  IP = "ip",

  /** IPv4 address */
  IPV4 = "ipv4",

  /** IPv6 address */
  IPV6 = "ipv6",

  /** Phone number */
  PHONE = "phone",

  /** Date/time */
  DATE = "date",

  /** Hex color */
  HEX_COLOR = "hex_color",

  /** JSON string */
  JSON = "json",

  /** Base64 encoded */
  BASE64 = "base64",
}

/**
 * Validation constraints for data types
 */
export interface ValidationConstraint {
  /** Maximum length (for strings) */
  maxLength?: number;

  /** Minimum length (for strings) */
  minLength?: number;

  /** Maximum value (for numbers) */
  max?: number;

  /** Minimum value (for numbers) */
  min?: number;

  /** Required pattern (regex) */
  pattern?: RegExp | string;

  /** Allowed values (enum) */
  enum?: (string | number)[];

  /** Custom validator function */
  custom?: (value: unknown) => boolean | Promise<boolean>;

  /** Whether null is allowed */
  nullable?: boolean;

  /** Whether undefined is allowed */
  optional?: boolean;

  /** Trim whitespace before validation */
  trim?: boolean;

  /** Convert case (upper, lower, or none) */
  caseConversion?: "upper" | "lower" | "none";
}

// ============================================================================
// SCHEMA VALIDATION TYPES
// ============================================================================

/**
 * Schema definition for structured validation
 */
export interface ValidationSchema {
  /** Type of data */
  type: DataType;

  /** Validation constraints */
  constraints?: ValidationConstraint;

  /** Nested object properties */
  properties?: Record<string, ValidationSchema>;

  /** Array item schema */
  items?: ValidationSchema;

  /** Required fields for objects */
  required?: string[];

  /** Additional properties allowed flag */
  additionalProperties?: boolean;

  /** Description of the field */
  description?: string;

  /** Example value */
  example?: unknown;
}

/**
 * Schema validation result
 */
export interface SchemaValidationResult {
  /** Whether the data matches the schema */
  isValid: boolean;

  /** Validation errors by field path */
  errors: SchemaValidationError[];

  /** The validated and sanitized data */
  data?: Record<string, unknown>;
}

/**
 * Schema validation error with path info
 */
export interface SchemaValidationError extends InputValidationError {
  /** JSON path to the error location */
  path: string;

  /** Schema rule that failed */
  rule: string;
}

// ============================================================================
// SANITIZATION OPTIONS
// ============================================================================

/**
 * Options for input sanitization
 */
export interface SanitizationOptions {
  /** Which injection types to check for */
  checkFor?: InjectionType[];

  /** Which sanitization methods to apply */
  methods?: SanitizationMethod[];

  /** Maximum allowed length */
  maxLength?: number;

  /** Whether to preserve Unicode characters */
  preserveUnicode?: boolean;

  /** Whether to preserve whitespace */
  preserveWhitespace?: boolean;

  /** Character encoding to use */
  encoding?: "utf8" | "ascii" | "latin1";

  /** Custom sanitization rules */
  customRules?: CustomSanitizationRule[];

  /** Whether to throw on error or return result */
  throwOnError?: boolean;
}

/**
 * Custom sanitization rule
 */
export interface CustomSanitizationRule {
  /** Rule name */
  name: string;

  /** Pattern to match */
  pattern: RegExp | string;

  /** Replacement string or function */
  replacement: string | ((match: string, ...args: unknown[]) => string);

  /** Description of what this rule does */
  description: string;
}

// ============================================================================
// INPUT CONTEXT TYPES
// ============================================================================

/**
 * Context information about input source
 */
export interface InputContext {
  /** Where the input came from */
  source: InputSource;

  /** User ID if available */
  userId?: string;

  /** Session ID if available */
  sessionId?: string;

  /** IP address if available */
  ipAddress?: string;

  /** User agent if available */
  userAgent?: string;

  /** Timestamp when input was received */
  timestamp: Date;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Input sources for contextual validation
 */
export enum InputSource {
  /** Web form input */
  WEB_FORM = "WEB_FORM",

  /** API request body */
  API_BODY = "API_BODY",

  /** API query parameters */
  API_QUERY = "API_QUERY",

  /** API path parameters */
  API_PATH = "API_PATH",

  /** API headers */
  API_HEADER = "API_HEADER",

  /** Command line argument */
  CLI_ARG = "CLI_ARG",

  /** Environment variable */
  ENV_VAR = "ENV_VAR",

  /** File input */
  FILE = "FILE",

  /** Database query */
  DATABASE = "DATABASE",

  /** WebSocket message */
  WEBSOCKET = "WEBSOCKET",

  /** Internal/trusted source */
  INTERNAL = "INTERNAL",
}

// ============================================================================
// THRESHOLD CONFIGURATION
// ============================================================================

/**
 * Security thresholds for automatic blocking
 */
export interface SecurityThresholds {
  /** Maximum threat severity to allow */
  maxAllowedSeverity: ThreatSeverity;

  /** Maximum number of threats before blocking */
  maxThreatCount: number;

  /** Maximum score before blocking */
  maxThreatScore: number;

  /** Whether to block on critical threats */
  blockOnCritical: boolean;

  /** Whether to log all threats */
  logAllThreats: boolean;

  /** Whether to quarantine suspicious input */
  quarantineSuspicious: boolean;
}

// ============================================================================
// INTERFACE DEFINITIONS
// ============================================================================

/**
 * Input sanitizer interface
 */
export interface IInputSanitizer {
  /**
   * Sanitize a string input
   */
  sanitize(input: string, options?: SanitizationOptions): SanitizationResult;

  /**
   * Sanitize with context
   */
  sanitizeWithContext(
    input: string,
    context: InputContext,
    options?: SanitizationOptions
  ): SanitizationResult;

  /**
   * Sanitize multiple inputs
   */
  sanitizeBatch(
    inputs: Record<string, string>,
    options?: SanitizationOptions
  ): Record<string, SanitizationResult>;
}

/**
 * Validator interface
 */
export interface IValidator {
  /**
   * Validate a value against a type
   */
  validate(value: unknown, type: DataType, constraints?: ValidationConstraint): InputValidationResult;

  /**
   * Validate a value against a schema
   */
  validateSchema(data: unknown, schema: ValidationSchema): SchemaValidationResult;

  /**
   * Validate multiple fields
   */
  validateBatch(
    data: Record<string, unknown>,
    schema: Record<string, ValidationSchema>
  ): SchemaValidationResult;
}

/**
 * Schema validator interface
 */
export interface ISchemaValidator {
  /**
   * Validate data against a JSON schema
   */
  validate(data: unknown, schema: ValidationSchema): SchemaValidationResult;

  /**
   * Add a custom format validator
   */
  addFormat(name: string, validator: (value: unknown) => boolean): void;

  /**
   * Compile a schema for repeated validation
   */
  compile(schema: ValidationSchema): CompiledSchema;
}

/**
 * Compiled schema for faster validation
 */
export interface CompiledSchema {
  /**
   * Validate data using the compiled schema
   */
  validate(data: unknown): SchemaValidationResult;
}

/**
 * Sanitization middleware interface
 */
export interface ISanitizationMiddleware {
  /**
   * Middleware function for request/response
   */
  handle(
    input: unknown,
    context: InputContext,
    next: () => Promise<unknown>
  ): Promise<unknown>;

  /**
   * Configure the middleware
   */
  configure(options: SanitizationOptions): void;
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

/**
 * Default sanitization options
 */
export const DEFAULT_SANITIZATION_OPTIONS: SanitizationOptions = {
  checkFor: [
    InjectionType.SQL_INJECTION,
    InjectionType.XSS,
    InjectionType.COMMAND_INJECTION,
    InjectionType.PATH_TRAVERSAL,
    InjectionType.SSRF,
  ],
  methods: [
    SanitizationMethod.HTML_ENCODE,
    SanitizationMethod.SQL_ESCAPE,
    SanitizationMethod.NULL_BYTE_STRIP,
    SanitizationMethod.CONTROL_CHAR_STRIP,
  ],
  maxLength: 1000000, // 1MB default
  preserveUnicode: true,
  preserveWhitespace: false,
  encoding: "utf8",
  throwOnError: false,
};

/**
 * Default security thresholds
 */
export const DEFAULT_SECURITY_THRESHOLDS: SecurityThresholds = {
  maxAllowedSeverity: ThreatSeverity.MEDIUM,
  maxThreatCount: 5,
  maxThreatScore: 50,
  blockOnCritical: true,
  logAllThreats: true,
  quarantineSuspicious: false,
};

/**
 * Context-aware sanitization options
 */
export const CONTEXTUAL_OPTIONS: Record<InputSource, Partial<SanitizationOptions>> = {
  [InputSource.WEB_FORM]: {
    checkFor: [InjectionType.XSS, InjectionType.SQL_INJECTION, InjectionType.HEADER_INJECTION],
    methods: [SanitizationMethod.HTML_ENCODE, SanitizationMethod.CONTROL_CHAR_STRIP],
  },

  [InputSource.API_BODY]: {
    checkFor: [
      InjectionType.SQL_INJECTION,
      InjectionType.NOSQL_INJECTION,
      InjectionType.COMMAND_INJECTION,
    ],
    methods: [SanitizationMethod.NULL_BYTE_STRIP],
  },

  [InputSource.API_QUERY]: {
    checkFor: [InjectionType.SQL_INJECTION, InjectionType.XSS, InjectionType.SSRF],
    methods: [SanitizationMethod.URL_ENCODE],
  },

  [InputSource.API_PATH]: {
    checkFor: [InjectionType.PATH_TRAVERSAL, InjectionType.SQL_INJECTION],
    methods: [SanitizationMethod.PATH_NORMALIZE],
  },

  [InputSource.API_HEADER]: {
    checkFor: [InjectionType.HEADER_INJECTION],
    methods: [SanitizationMethod.CONTROL_CHAR_STRIP],
  },

  [InputSource.CLI_ARG]: {
    checkFor: [InjectionType.COMMAND_INJECTION],
    methods: [SanitizationMethod.COMMAND_ESCAPE],
  },

  [InputSource.ENV_VAR]: {
    checkFor: [InjectionType.COMMAND_INJECTION],
    methods: [SanitizationMethod.COMMAND_ESCAPE],
  },

  [InputSource.FILE]: {
    checkFor: [InjectionType.PATH_TRAVERSAL],
    methods: [SanitizationMethod.PATH_NORMALIZE],
  },

  [InputSource.DATABASE]: {
    checkFor: [InjectionType.SQL_INJECTION],
    methods: [SanitizationMethod.SQL_ESCAPE],
  },

  [InputSource.WEBSOCKET]: {
    checkFor: [InjectionType.XSS, InjectionType.SQL_INJECTION],
    methods: [SanitizationMethod.HTML_ENCODE],
  },

  [InputSource.INTERNAL]: {
    checkFor: [],
    methods: [],
  },
};

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Sanitized string brand type
 */
export type SanitizedString = string & { readonly __sanitized: unique symbol };

/**
 * Type guard for sanitized strings
 */
export function isSanitizedString(value: unknown): value is SanitizedString {
  return typeof value === "string";
}

/**
 * Validation result with data
 */
export interface ValidatedData<T = unknown> {
  /** The validated and sanitized data */
  data: T;

  /** Whether validation passed */
  isValid: boolean;

  /** Any errors that occurred */
  errors: InputValidationError[];

  /** Any warnings that occurred */
  warnings: InputValidationWarning[];
}

/**
 * Sanitization statistics
 */
export interface SanitizationStatistics {
  /** Total inputs sanitized */
  totalInputs: number;

  /** Inputs with threats detected */
  threatDetectedCount: number;

  /** Inputs blocked */
  blockedCount: number;

  /** Threats by type */
  threatsByType: Record<InjectionType, number>;

  /** Most common threat types */
  topThreatTypes: Array<{ type: InjectionType; count: number }>;

  /** Average processing time (ms) */
  avgProcessingTime: number;
}

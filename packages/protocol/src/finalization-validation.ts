/**
 * @lsi/protocol - Centralized Protocol Validation Utilities
 *
 * This module provides centralized validation for all Aequor protocols.
 * It extends the existing ProtocolValidator with cross-protocol validation,
 * protocol interaction validation, and comprehensive error handling.
 *
 * Features:
 * - Single protocol validation (ATP, ACP, Cartridge, Rollback, Hypothesis)
 * - Cross-protocol validation
 * - Version handshake validation
 * - Protocol interop validation
 * - Validation error aggregation and formatting
 *
 * Usage:
 * ```typescript
 * import { ProtocolValidator } from '@lsi/protocol';
 *
 * const validator = new ProtocolValidator();
 *
 * // Validate ATP packet
 * const atpResult = validator.validateATPacket(packet);
 *
 * // Validate cross-protocol interaction
 * const interactionResult = validator.validateProtocolInteraction(
 *   'atp',
 *   'acp',
 *   data
 * );
 *
 * // Validate version handshake
 * const handshakeResult = validator.validateVersionHandshake(
 *   clientHandshake,
 *   serverHandshake
 * );
 * ```
 */

// ============================================================================
// ERROR CODES
// ============================================================================

/**
 * Validation error codes for programmatic error handling
 */
export enum ValidationErrorCode {
  // General errors
  UNKNOWN = "UNKNOWN",
  INVALID_TYPE = "INVALID_TYPE",
  MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",
  INVALID_VALUE = "INVALID_VALUE",
  INVALID_FORMAT = "INVALID_FORMAT",

  // ATP-specific errors
  ATP_INVALID_PACKET = "ATP_INVALID_PACKET",
  ATP_INVALID_HEADER = "ATP_INVALID_HEADER",
  ATP_INVALID_FOOTER = "ATP_INVALID_FOOTER",
  ATP_INVALID_BODY = "ATP_INVALID_BODY",
  ATP_INVALID_MAGIC = "ATP_INVALID_MAGIC",
  ATP_CHECKSUM_MISMATCH = "ATP_CHECKSUM_MISMATCH",

  // ACP-specific errors
  ACP_INVALID_HANDSHAKE = "ACP_INVALID_HANDSHAKE",
  ACP_INVALID_MODE = "ACP_INVALID_MODE",
  ACP_INVALID_STRATEGY = "ACP_INVALID_STRATEGY",
  ACP_INVALID_PLAN = "ACP_INVALID_PLAN",

  // Cartridge-specific errors
  CARTRIDGE_INVALID_MANIFEST = "CARTRIDGE_INVALID_MANIFEST",
  CARTRIDGE_INVALID_VERSION = "CARTRIDGE_INVALID_VERSION",
  CARTRIDGE_INVALID_CAPABILITIES = "CARTRIDGE_INVALID_CAPABILITIES",
  CARTRIDGE_DEPENDENCY_ERROR = "CARTRIDGE_DEPENDENCY_ERROR",
  CARTRIDGE_STATE_ERROR = "CARTRIDGE_STATE_ERROR",

  // Rollback-specific errors
  ROLLBACK_INVALID_REQUEST = "ROLLBACK_INVALID_REQUEST",
  ROLLBACK_INVALID_SCOPE = "ROLLBACK_INVALID_SCOPE",
  ROLLBACK_INVALID_STRATEGY = "ROLLBACK_INVALID_STRATEGY",
  ROLLBACK_INVALID_STATUS = "ROLLBACK_INVALID_STATUS",
  ROLLBACK_INVALID_CONSENSUS = "ROLLBACK_INVALID_CONSENSUS",

  // Hypothesis-specific errors
  HYPOTHESIS_INVALID_PACKET = "HYPOTHESIS_INVALID_PACKET",
  HYPOTHESIS_INVALID_TYPE = "HYPOTHESIS_INVALID_TYPE",
  HYPOTHESIS_INVALID_SCOPE = "HYPOTHESIS_INVALID_SCOPE",
  HYPOTHESIS_INVALID_TESTING = "HYPOTHESIS_INVALID_TESTING",

  // Version negotiation errors
  VERSION_INVALID_FORMAT = "VERSION_INVALID_FORMAT",
  VERSION_INCOMPATIBLE = "VERSION_INCOMPATIBLE",
  VERSION_MISMATCH = "VERSION_MISMATCH",
  VERSION_NEGOTIATION_FAILED = "VERSION_NEGOTIATION_FAILED",

  // Cross-protocol errors
  CROSS_PROTOCOL_INCOMPATIBLE = "CROSS_PROTOCOL_INCOMPATIBLE",
  CROSS_PROTOCOL_DEPENDENCY = "CROSS_PROTOCOL_DEPENDENCY",
  CROSS_PROTOCOL_SEQUENCE = "CROSS_PROTOCOL_SEQUENCE",
  CROSS_PROTOCOL_DATA_FLOW = "CROSS_PROTOCOL_DATA_FLOW",

  // Extension errors
  EXTENSION_INVALID = "EXTENSION_INVALID",
  EXTENSION_LOAD_FAILED = "EXTENSION_LOAD_FAILED",
  EXTENSION_VALIDATION_FAILED = "EXTENSION_VALIDATION_FAILED",
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Validation error with full context
 */
export interface ValidationError {
  /** Error field path (e.g., 'user.id', 'packet.body.query') */
  field: string;

  /** Error code for programmatic handling */
  code: ValidationErrorCode;

  /** Human-readable error message */
  message: string;

  /** Expected value (for debugging) */
  expected?: string;

  /** Actual value received (for debugging) */
  actual?: unknown;

  /** Severity level */
  severity: "error" | "warning";

  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed (no errors) */
  valid: boolean;

  /** Validation errors */
  errors: ValidationError[];

  /** Validation warnings (non-critical issues) */
  warnings: ValidationError[];

  /** Protocol version that was validated */
  protocolVersion?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Aggregate validation result from multiple validations
 */
export interface AggregateValidationResult extends ValidationResult {
  /** Individual results that were aggregated */
  individualResults: Map<string, ValidationResult>;

  /** Total number of validations performed */
  totalValidations: number;

  /** Number of validations that passed */
  passedValidations: number;

  /** Number of validations that failed */
  failedValidations: number;
}

/**
 * Version handshake for validation
 */
export interface VersionHandshake {
  /** Protocol identifier */
  protocol: string;

  /** Client version */
  clientVersion: string;

  /** Server version */
  serverVersion: string;

  /** Client capabilities */
  clientCapabilities?: string[];

  /** Server capabilities */
  serverCapabilities?: string[];

  /** Handshake timestamp */
  timestamp: number;
}

// ============================================================================
// VALIDATOR CLASS
// ============================================================================

/**
 * Centralized protocol validator
 *
 * Provides validation for all Aequor protocols including:
 * - ATP (Autonomous Task Processing)
 * - ACP (Assisted Collaborative Processing)
 * - Cartridge
 * - Rollback
 * - Hypothesis
 * - Version Negotiation
 * - Extensions
 */
export class ProtocolValidator {
  constructor(options?: {
    /** Enable strict validation (fail on warnings) */
    strictMode?: boolean;
    /** Allow unknown fields in objects */
    allowUnknownFields?: boolean;
  }) {
    // Options stored for future use
    options?.strictMode;
    options?.allowUnknownFields;
  }

  // ========================================================================
  // SINGLE PROTOCOL VALIDATION
  // ========================================================================

  /**
   * Validate ATP packet
   */
  validateATPacket(packet: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    if (!packet || typeof packet !== "object") {
      return {
        valid: false,
        errors: [
          this.createError(
            ValidationErrorCode.INVALID_TYPE,
            "ATPacket must be an object",
            ""
          ),
        ],
        warnings: [],
      };
    }

    const p = packet as Record<string, unknown>;

    // Required fields
    this.requireString(p, "id", errors);
    this.requireString(p, "query", errors);
    this.requireString(p, "intent", errors);
    this.requireString(p, "urgency", errors);
    this.requireNumber(p, "timestamp", errors);

    // Optional fields with validation
    if (p.context !== undefined) {
      if (typeof p.context !== "object" || p.context === null) {
        errors.push(
          this.createError(
            ValidationErrorCode.INVALID_TYPE,
            "context must be an object",
            "context"
          )
        );
      }
    }

    // Validate intent enum
    if (typeof p.intent === "string") {
      const validIntents = [
        "query",
        "command",
        "conversation",
        "code_generation",
        "analysis",
        "creative",
        "debugging",
        "system",
        "unknown",
      ];
      if (!validIntents.includes(p.intent)) {
        errors.push(
          this.createError(
            ValidationErrorCode.INVALID_VALUE,
            `Invalid intent: ${p.intent}`,
            "intent"
          )
        );
      }
    }

    // Validate urgency enum
    if (typeof p.urgency === "string") {
      const validUrgency = ["low", "normal", "high", "critical"];
      if (!validUrgency.includes(p.urgency)) {
        errors.push(
          this.createError(
            ValidationErrorCode.INVALID_VALUE,
            `Invalid urgency: ${p.urgency}`,
            "urgency"
          )
        );
      }
    }

    // Validate timestamp
    if (typeof p.timestamp === "number") {
      const now = Date.now();
      const maxFuture = 60000; // 1 minute in the future
      const maxPast = 86400000 * 365; // 1 year in the past

      if (p.timestamp > now + maxFuture) {
        warnings.push(
          this.createWarning("Timestamp is too far in the future", "timestamp")
        );
      }
      if (p.timestamp < now - maxPast) {
        warnings.push(
          this.createWarning("Timestamp is too far in the past", "timestamp")
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      protocolVersion: "1.0.0",
    };
  }

  /**
   * Validate ACP handshake
   */
  validateACPHandshake(handshake: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    if (!handshake || typeof handshake !== "object") {
      return {
        valid: false,
        errors: [
          this.createError(
            ValidationErrorCode.INVALID_TYPE,
            "ACPHandshake must be an object",
            ""
          ),
        ],
        warnings: [],
      };
    }

    const h = handshake as Record<string, unknown>;

    // Required fields
    this.requireString(h, "requestId", errors);
    this.requireString(h, "mode", errors);

    // Validate mode
    if (typeof h.mode === "string") {
      const validModes = ["sequential", "parallel", "cascade", "ensemble"];
      if (!validModes.includes(h.mode)) {
        errors.push(
          this.createError(
            ValidationErrorCode.ACP_INVALID_MODE,
            `Invalid mode: ${h.mode}`,
            "mode"
          )
        );
      }
    }

    // Validate queries array
    if (h.queries !== undefined) {
      if (!Array.isArray(h.queries)) {
        errors.push(
          this.createError(
            ValidationErrorCode.INVALID_TYPE,
            "queries must be an array",
            "queries"
          )
        );
      } else {
        h.queries.forEach((query: unknown, i: number) => {
          const queryResult = this.validateATPacket(query);
          if (!queryResult.valid) {
            errors.push(
              ...queryResult.errors.map(e => ({
                ...e,
                field: `queries[${i}].${e.field}`,
              }))
            );
          }
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      protocolVersion: "1.0.0",
    };
  }

  /**
   * Validate cartridge manifest
   */
  validateCartridge(manifest: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    if (!manifest || typeof manifest !== "object") {
      return {
        valid: false,
        errors: [
          this.createError(
            ValidationErrorCode.CARTRIDGE_INVALID_MANIFEST,
            "CartridgeManifest must be an object",
            ""
          ),
        ],
        warnings: [],
      };
    }

    const m = manifest as Record<string, unknown>;

    // Required fields
    this.requireString(m, "id", errors);
    this.requireString(m, "name", errors);
    this.requireString(m, "version", errors);

    // Validate version format (SemVer)
    if (typeof m.version === "string") {
      const semverRegex = /^\d+\.\d+\.\d+(-[0-9A-Za-z-]+)?(\+[0-9A-Za-z-]+)?$/;
      if (!semverRegex.test(m.version)) {
        errors.push(
          this.createError(
            ValidationErrorCode.CARTRIDGE_INVALID_VERSION,
            "Version must be in SemVer format (e.g., 1.0.0)",
            "version"
          )
        );
      }
    }

    // Validate capabilities
    if (m.capabilities !== undefined) {
      if (typeof m.capabilities !== "object" || m.capabilities === null) {
        errors.push(
          this.createError(
            ValidationErrorCode.CARTRIDGE_INVALID_CAPABILITIES,
            "capabilities must be an object",
            "capabilities"
          )
        );
      }
    }

    // Validate files array
    if (m.files !== undefined) {
      if (!Array.isArray(m.files)) {
        errors.push(
          this.createError(
            ValidationErrorCode.INVALID_TYPE,
            "files must be an array",
            "files"
          )
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      protocolVersion: "1.0.0",
    };
  }

  /**
   * Validate rollback request
   */
  validateRollback(request: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    if (!request || typeof request !== "object") {
      return {
        valid: false,
        errors: [
          this.createError(
            ValidationErrorCode.ROLLBACK_INVALID_REQUEST,
            "RollbackRequest must be an object",
            ""
          ),
        ],
        warnings: [],
      };
    }

    const r = request as Record<string, unknown>;

    // Required fields
    this.requireString(r, "rollbackId", errors);
    this.requireString(r, "targetComponent", errors);
    this.requireString(r, "targetVersion", errors);
    this.requireString(r, "currentVersion", errors);
    this.requireString(r, "reason", errors);
    this.requireString(r, "scope", errors);
    this.requireNumber(r, "timestamp", errors);

    // Validate scope
    if (typeof r.scope === "string") {
      const validScopes = ["local", "cluster", "global"];
      if (!validScopes.includes(r.scope)) {
        errors.push(
          this.createError(
            ValidationErrorCode.ROLLBACK_INVALID_SCOPE,
            `Invalid scope: ${r.scope}`,
            "scope"
          )
        );
      }
    }

    // Validate targetComponent
    if (typeof r.targetComponent === "string") {
      const validComponents = [
        "adapter",
        "cartridge",
        "config",
        "model",
        "protocol",
      ];
      if (!validComponents.includes(r.targetComponent)) {
        errors.push(
          this.createError(
            ValidationErrorCode.INVALID_VALUE,
            `Invalid targetComponent: ${r.targetComponent}`,
            "targetComponent"
          )
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      protocolVersion: "1.0.0",
    };
  }

  /**
   * Validate hypothesis packet
   */
  validateHypothesis(packet: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    if (!packet || typeof packet !== "object") {
      return {
        valid: false,
        errors: [
          this.createError(
            ValidationErrorCode.HYPOTHESIS_INVALID_PACKET,
            "HypothesisPacket must be an object",
            ""
          ),
        ],
        warnings: [],
      };
    }

    const p = packet as Record<string, unknown>;

    // Required fields
    this.requireString(p, "hypothesisId", errors);
    this.requireString(p, "type", errors);
    this.requireString(p, "title", errors);
    this.requireNumber(p, "timestamp", errors);

    // Validate type
    if (typeof p.type === "string") {
      const validTypes = [
        "cache_optimization",
        "routing_rule",
        "privacy_threshold",
        "query_refinement",
        "adapter_config",
        "resource_allocation",
        "cartridge_selection",
      ];
      if (!validTypes.includes(p.type)) {
        errors.push(
          this.createError(
            ValidationErrorCode.HYPOTHESIS_INVALID_TYPE,
            `Invalid hypothesis type: ${p.type}`,
            "type"
          )
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      protocolVersion: "1.0.0",
    };
  }

  /**
   * Validate version message
   */
  validateVersion(message: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    if (!message || typeof message !== "object") {
      return {
        valid: false,
        errors: [
          this.createError(
            ValidationErrorCode.VERSION_INVALID_FORMAT,
            "Version message must be an object",
            ""
          ),
        ],
        warnings: [],
      };
    }

    const m = message as Record<string, unknown>;

    // Required fields
    this.requireString(m, "protocol", errors);
    this.requireString(m, "version", errors);

    // Validate version format
    if (typeof m.version === "string") {
      const semverRegex = /^\d+\.\d+\.\d+(-[0-9A-Za-z-]+)?(\+[0-9A-Za-z-]+)?$/;
      if (!semverRegex.test(m.version)) {
        errors.push(
          this.createError(
            ValidationErrorCode.VERSION_INVALID_FORMAT,
            "Version must be in SemVer format",
            "version"
          )
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      protocolVersion: "1.0.0",
    };
  }

  // ========================================================================
  // CROSS-PROTOCOL VALIDATION
  // ========================================================================

  /**
   * Validate protocol interaction
   *
   * Validates that data flows correctly between two protocols
   */
  validateProtocolInteraction(
    source: string,
    target: string,
    data: unknown
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Validate that source protocol exists
    const validProtocols = [
      "atp",
      "acp",
      "cartridge",
      "rollback",
      "hypothesis",
      "version",
      "extension",
    ];
    if (!validProtocols.includes(source)) {
      errors.push(
        this.createError(
          ValidationErrorCode.UNKNOWN,
          `Unknown source protocol: ${source}`,
          "source"
        )
      );
    }

    if (!validProtocols.includes(target)) {
      errors.push(
        this.createError(
          ValidationErrorCode.UNKNOWN,
          `Unknown target protocol: ${target}`,
          "target"
        )
      );
    }

    // Validate known protocol interactions
    const validInteractions: Record<string, string[]> = {
      atp: ["acp", "cartridge", "version"],
      acp: ["atp", "cartridge", "rollback"],
      cartridge: ["atp", "acp", "version"],
      rollback: ["acp", "cartridge", "hypothesis"],
      hypothesis: ["rollback", "cartridge"],
      version: ["atp", "acp", "cartridge"],
      extension: ["atp", "acp", "cartridge", "rollback"],
    };

    if (validProtocols.includes(source) && validProtocols.includes(target)) {
      const allowedTargets = validInteractions[source] ?? [];
      if (!allowedTargets.includes(target)) {
        errors.push(
          this.createError(
            ValidationErrorCode.CROSS_PROTOCOL_INCOMPATIBLE,
            `Protocol interaction from ${source} to ${target} is not supported`,
            "interaction"
          )
        );
      }
    }

    // Validate data structure
    if (!data || typeof data !== "object") {
      errors.push(
        this.createError(
          ValidationErrorCode.INVALID_TYPE,
          "Data must be an object",
          "data"
        )
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      protocolVersion: "1.0.0",
      metadata: { source, target },
    };
  }

  /**
   * Validate version handshake
   *
   * Validates that client and server versions are compatible
   */
  validateVersionHandshake(
    client: VersionHandshake,
    server: VersionHandshake
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Validate protocol match
    if (client.protocol !== server.protocol) {
      errors.push(
        this.createError(
          ValidationErrorCode.VERSION_MISMATCH,
          `Protocol mismatch: client ${client.protocol} vs server ${server.protocol}`,
          "protocol"
        )
      );
    }

    // Parse versions
    const clientVersion = this.parseSemVer(client.clientVersion);
    const serverVersion = this.parseSemVer(server.serverVersion);

    if (!clientVersion) {
      errors.push(
        this.createError(
          ValidationErrorCode.VERSION_INVALID_FORMAT,
          `Invalid client version format: ${client.clientVersion}`,
          "clientVersion"
        )
      );
    }

    if (!serverVersion) {
      errors.push(
        this.createError(
          ValidationErrorCode.VERSION_INVALID_FORMAT,
          `Invalid server version format: ${server.serverVersion}`,
          "serverVersion"
        )
      );
    }

    if (clientVersion && serverVersion) {
      // Major version must match
      if (clientVersion.major !== serverVersion.major) {
        errors.push(
          this.createError(
            ValidationErrorCode.VERSION_INCOMPATIBLE,
            `Major version mismatch: client ${clientVersion.major}.${clientVersion.minor} vs server ${serverVersion.major}.${serverVersion.minor}`,
            "version"
          )
        );
      }

      // Client should not be newer than server
      if (this.compareVersions(clientVersion, serverVersion) > 0) {
        warnings.push(
          this.createWarning(
            "Client version is newer than server version",
            "version"
          )
        );
      }
    }

    // Check capability overlap
    if (client.clientCapabilities && server.serverCapabilities) {
      const clientCaps = new Set(client.clientCapabilities);
      const serverCaps = new Set(server.serverCapabilities);
      const commonCaps = [...clientCaps].filter(c => serverCaps.has(c));

      if (commonCaps.length === 0) {
        warnings.push(
          this.createWarning(
            "No common capabilities between client and server",
            "capabilities"
          )
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      protocolVersion: "1.0.0",
      metadata: {
        clientVersion: client.clientVersion,
        serverVersion: server.serverVersion,
      },
    };
  }

  /**
   * Validate cartridge deployment
   *
   * Validates that a cartridge can be deployed to a target version
   */
  validateCartridgeDeployment(
    manifest: unknown,
    targetVersion: string
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // First validate manifest
    const manifestResult = this.validateCartridge(manifest);
    errors.push(...manifestResult.errors);
    warnings.push(...manifestResult.warnings);

    if (!manifest || typeof manifest !== "object") {
      return { valid: false, errors, warnings };
    }

    const m = manifest as Record<string, unknown>;

    // Parse target version
    const target = this.parseSemVer(targetVersion);
    if (!target) {
      errors.push(
        this.createError(
          ValidationErrorCode.CARTRIDGE_INVALID_VERSION,
          `Invalid target version: ${targetVersion}`,
          "targetVersion"
        )
      );
      return { valid: false, errors, warnings };
    }

    // Check manifest version
    if (typeof m.version === "string") {
      const manifestVersion = this.parseSemVer(m.version);
      if (manifestVersion) {
        // Cartridge version must match target major version
        if (manifestVersion.major !== target.major) {
          errors.push(
            this.createError(
              ValidationErrorCode.VERSION_INCOMPATIBLE,
              `Cartridge version ${m.version} is incompatible with target version ${targetVersion}`,
              "version"
            )
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      protocolVersion: "1.0.0",
    };
  }

  // ========================================================================
  // AGGREGATION
  // ========================================================================

  /**
   * Aggregate multiple validation results
   */
  aggregateResults(results: ValidationResult[]): AggregateValidationResult {
    const individualResults = new Map<string, ValidationResult>();
    let allErrors: ValidationError[] = [];
    let allWarnings: ValidationError[] = [];

    results.forEach((result, index) => {
      individualResults.set(`validation_${index}`, result);
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
    });

    const passedValidations = results.filter(r => r.valid).length;
    const failedValidations = results.filter(r => !r.valid).length;

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
      individualResults,
      totalValidations: results.length,
      passedValidations,
      failedValidations,
    };
  }

  // ========================================================================
  // ERROR CREATION HELPERS
  // ========================================================================

  /**
   * Create a validation error
   */
  createError(
    code: ValidationErrorCode,
    message: string,
    field: string,
    expected?: string,
    actual?: unknown
  ): ValidationError {
    return {
      field,
      code,
      message,
      expected,
      actual,
      severity: "error",
    };
  }

  /**
   * Create a validation warning
   */
  createWarning(message: string, field: string): ValidationError {
    return {
      field,
      code: ValidationErrorCode.UNKNOWN,
      message,
      severity: "warning",
    };
  }

  // ========================================================================
  // ERROR FORMATTING
  // ========================================================================

  /**
   * Format a validation error as a string
   */
  formatError(error: ValidationError): string {
    const parts = [`${error.severity.toUpperCase()}: ${error.message}`];
    if (error.field) {
      parts.push(`  Field: ${error.field}`);
    }
    if (error.expected) {
      parts.push(`  Expected: ${error.expected}`);
    }
    if (error.actual !== undefined) {
      parts.push(`  Actual: ${JSON.stringify(error.actual)}`);
    }
    return parts.join("\n");
  }

  /**
   * Format multiple validation errors as a string
   */
  formatErrors(errors: ValidationError[]): string {
    return errors.map(e => this.formatError(e)).join("\n\n");
  }

  /**
   * Format a validation result as a string
   */
  formatResult(result: ValidationResult): string {
    const lines: string[] = [];

    lines.push(`Validation: ${result.valid ? "PASSED" : "FAILED"}`);

    if (result.errors.length > 0) {
      lines.push("\nErrors:");
      result.errors.forEach(e => {
        lines.push(`  - ${this.formatError(e)}`);
      });
    }

    if (result.warnings.length > 0) {
      lines.push("\nWarnings:");
      result.warnings.forEach(w => {
        lines.push(`  - ${this.formatError(w)}`);
      });
    }

    return lines.join("\n");
  }

  // ========================================================================
  // PRIVATE HELPERS
  // ========================================================================

  /**
   * Require a string field
   */
  private requireString(
    obj: Record<string, unknown>,
    field: string,
    errors: ValidationError[]
  ): void {
    const value = obj[field];
    if (value === undefined || value === null) {
      errors.push(
        this.createError(
          ValidationErrorCode.MISSING_REQUIRED_FIELD,
          `Missing required field: ${field}`,
          field
        )
      );
    } else if (typeof value !== "string") {
      errors.push(
        this.createError(
          ValidationErrorCode.INVALID_TYPE,
          `Field ${field} must be a string`,
          field,
          "string",
          typeof value
        )
      );
    }
  }

  /**
   * Require a number field
   */
  private requireNumber(
    obj: Record<string, unknown>,
    field: string,
    errors: ValidationError[]
  ): void {
    const value = obj[field];
    if (value === undefined || value === null) {
      errors.push(
        this.createError(
          ValidationErrorCode.MISSING_REQUIRED_FIELD,
          `Missing required field: ${field}`,
          field
        )
      );
    } else if (typeof value !== "number") {
      errors.push(
        this.createError(
          ValidationErrorCode.INVALID_TYPE,
          `Field ${field} must be a number`,
          field,
          "number",
          typeof value
        )
      );
    }
  }

  /**
   * Parse SemVer from string
   */
  private parseSemVer(
    version: string
  ): { major: number; minor: number; patch: number } | null {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) return null;

    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
    };
  }

  /**
   * Compare two version objects
   * @returns negative if a < b, 0 if equal, positive if a > b
   */
  private compareVersions(
    a: { major: number; minor: number; patch: number },
    b: { major: number; minor: number; patch: number }
  ): number {
    if (a.major !== b.major) return a.major - b.major;
    if (a.minor !== b.minor) return a.minor - b.minor;
    return a.patch - b.patch;
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Create a successful validation result
 */
export function createValidationResult(
  valid: boolean = true
): ValidationResult {
  return {
    valid,
    errors: [],
    warnings: [],
  };
}

/**
 * Create a failed validation result with a single error
 */
export function createValidationFailure(
  message: string,
  field: string
): ValidationResult {
  return {
    valid: false,
    errors: [
      {
        field,
        code: ValidationErrorCode.UNKNOWN,
        message,
        severity: "error",
      },
    ],
    warnings: [],
  };
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  const validator = new ProtocolValidator();
  return validator.formatErrors(errors);
}

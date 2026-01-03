/**
 * ATP Protocol Schema
 *
 * Validation schema for ATP (Autonomous Task Processing) protocol.
 * ATP is used for single-model query processing in the Aequor platform.
 *
 * This schema defines:
 * - Packet format and structure
 * - Header validation rules
 * - Payload validation rules
 * - Flow control constraints
 * - Error handling requirements
 *
 * Usage:
 * ```typescript
 * import { ATP_SCHEMA, validateATPacket } from '@lsi/protocol/schemas/atp-schema';
 *
 * const packet = { id: 'req-123', query: 'test', ... };
 * const result = validateATPacket(packet);
 * if (!result.valid) {
 *   console.error('Invalid packet:', result.errors);
 * }
 * ```
 */

import type { ProtocolSpecification } from "../compliance.js";
import { IntentCategory, Urgency } from "../atp-acp.js";

// ============================================================================
// ATP PACKET SCHEMA
// ============================================================================

/**
 * ATP packet field definitions
 */
export const ATP_PACKET_FIELDS = {
  id: {
    type: "string",
    required: true,
    description: "Unique identifier for the request (UUID or similar)",
    validation: {
      minLength: 1,
      maxLength: 256,
      pattern: "^[a-zA-Z0-9-_]+$",
    },
  },
  query: {
    type: "string",
    required: true,
    description: "The user query or request text",
    validation: {
      minLength: 1,
      maxLength: 10000,
    },
  },
  intent: {
    type: "enum",
    required: true,
    description: "Classified intent category for routing",
    values: Object.values(IntentCategory),
  },
  urgency: {
    type: "enum",
    required: true,
    description: "Urgency level affecting processing priority",
    values: Object.values(Urgency),
  },
  timestamp: {
    type: "number",
    required: true,
    description: "Unix timestamp (ms) when the request was created",
    validation: {
      min: 0,
      max: Date.now() + 60000, // Allow 1 minute clock skew
    },
  },
  context: {
    type: "object",
    required: false,
    description: "Optional contextual metadata for routing/processing",
    validation: {
      maxKeys: 100,
    },
  },
} as const;

// ============================================================================
// ATP HEADER SCHEMA
// ============================================================================

/**
 * ATP wire format header schema
 */
export const ATP_HEADER_SCHEMA = {
  magic: {
    type: "number",
    required: true,
    description: 'Magic number for validation (0x41545054 = "ATPT")',
    validation: {
      value: 0x41545054,
    },
  },
  version: {
    type: "number",
    required: true,
    description: "Protocol version (currently 1)",
    validation: {
      min: 1,
      max: 1,
    },
  },
  flags: {
    type: "number",
    required: true,
    description: "Packet flags (compression, encryption, streaming, priority)",
    validation: {
      min: 0,
      max: 15, // 4 bits max
    },
  },
  length: {
    type: "number",
    required: true,
    description: "Body length in bytes",
    validation: {
      min: 0,
      max: 10 * 1024 * 1024, // 10MB max body size
    },
  },
} as const;

// ============================================================================
// ATP FOOTER SCHEMA
// ============================================================================

/**
 * ATP wire format footer schema
 */
export const ATP_FOOTER_SCHEMA = {
  checksum: {
    type: "number",
    required: true,
    description: "CRC32 checksum of body",
    validation: {
      min: 0,
      max: 0xffffffff,
    },
  },
} as const;

// ============================================================================
// ATP RESPONSE SCHEMA
// ============================================================================

/**
 * ATP response schema
 */
export const ATP_RESPONSE_SCHEMA = {
  id: {
    type: "string",
    required: true,
    description: "Unique identifier matching the request",
  },
  content: {
    type: "string",
    required: true,
    description: "Generated content/response",
    validation: {
      maxLength: 100000, // 100KB max response
    },
  },
  protocol: {
    type: "enum",
    required: true,
    description: 'Protocol type (always "ATP" for ATP responses)',
    values: ["ATP"],
  },
  models: {
    type: "string",
    required: true,
    description: "Model that generated the response",
  },
  backend: {
    type: "enum",
    required: true,
    description: "Backend used (local, cloud, hybrid)",
    values: ["local", "cloud", "hybrid"],
  },
  confidence: {
    type: "number",
    required: true,
    description: "Confidence in the response (0-1)",
    validation: {
      min: 0,
      max: 1,
    },
  },
  latency: {
    type: "number",
    required: true,
    description: "Processing latency in milliseconds",
    validation: {
      min: 0,
    },
  },
  tokensUsed: {
    type: "number",
    required: false,
    description: "Number of tokens used (if available)",
    validation: {
      min: 0,
    },
  },
  fromCache: {
    type: "boolean",
    required: false,
    description: "Whether result was from cache",
  },
  metadata: {
    type: "object",
    required: false,
    description: "Additional metadata",
  },
} as const;

// ============================================================================
// FLOW CONTROL SPECIFICATION
// ============================================================================

/**
 * ATP flow control constraints
 */
export const ATP_FLOW_CONTROL = {
  streaming: {
    supported: true,
    description: "Streaming responses are supported",
  },
  timeout: {
    default: 30000, // 30 seconds
    min: 1000, // 1 second
    max: 300000, // 5 minutes
    description: "Request timeout in milliseconds",
  },
  retry_policy: {
    max_attempts: {
      default: 3,
      min: 1,
      max: 5,
    },
    backoff: {
      strategies: ["linear", "exponential", "fixed"],
      default: "exponential",
    },
    initial_delay: {
      default: 1000, // 1 second
      min: 100, // 100ms
      max: 10000, // 10 seconds
    },
    max_delay: {
      default: 10000, // 10 seconds
      min: 1000,
      max: 60000, // 1 minute
    },
  },
  rate_limit: {
    requests_per_minute: 60,
    burst: 10,
    description: "Rate limiting constraints",
  },
} as const;

// ============================================================================
// ERROR HANDLING SPECIFICATION
// ============================================================================

/**
 * ATP error handling specification
 */
export const ATP_ERROR_HANDLING = {
  retryable_errors: ["timeout", "rate_limited", "service_unavailable"],
  non_retryable_errors: [
    "invalid_packet",
    "access_denied",
    "unknown_model",
    "model_failure",
  ],
  fallback_strategy: {
    options: ["fail", "fallback", "cache"],
    default: "fail",
    description: "Strategy for handling errors",
  },
} as const;

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate ATP packet
 *
 * @param packet - Packet to validate
 * @returns Validation result
 */
export function validateATPacket(packet: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!packet || typeof packet !== "object" || Array.isArray(packet)) {
    return {
      valid: false,
      errors: [
        {
          field: "packet",
          message: "Packet must be an object",
          code: "INVALID_TYPE",
          expected: "object",
          actual: packet === null ? "null" : typeof packet,
        },
      ],
      warnings: [],
    };
  }

  const p = packet as Record<string, unknown>;

  // Validate id
  if (!p.id || typeof p.id !== "string") {
    errors.push({
      field: "id",
      message: "ID is required and must be a string",
      code: "REQUIRED_FIELD_MISSING",
    });
  } else if (p.id.length < 1 || p.id.length > 256) {
    errors.push({
      field: "id",
      message: "ID length must be between 1 and 256 characters",
      code: "INVALID_LENGTH",
      expected: "1-256 characters",
      actual: `${p.id.length} characters`,
    });
  } else if (!/^[a-zA-Z0-9-_]+$/.test(p.id)) {
    errors.push({
      field: "id",
      message:
        "ID contains invalid characters (only alphanumeric, hyphen, underscore allowed)",
      code: "INVALID_FORMAT",
    });
  }

  // Validate query
  if (!p.query || typeof p.query !== "string") {
    errors.push({
      field: "query",
      message: "Query is required and must be a string",
      code: "REQUIRED_FIELD_MISSING",
    });
  } else if (p.query.length < 1 || p.query.length > 10000) {
    errors.push({
      field: "query",
      message: "Query length must be between 1 and 10000 characters",
      code: "INVALID_LENGTH",
      expected: "1-10000 characters",
      actual: `${p.query.length} characters`,
    });
  }

  // Validate intent
  if (
    !p.intent ||
    !Object.values(IntentCategory).includes(p.intent as IntentCategory)
  ) {
    errors.push({
      field: "intent",
      message: `Intent must be one of: ${Object.values(IntentCategory).join(", ")}`,
      code: "INVALID_ENUM_VALUE",
      expected: Object.values(IntentCategory).join(" | "),
      actual: String(p.intent ?? "undefined"),
    });
  }

  // Validate urgency
  if (!p.urgency || !Object.values(Urgency).includes(p.urgency as Urgency)) {
    errors.push({
      field: "urgency",
      message: `Urgency must be one of: ${Object.values(Urgency).join(", ")}`,
      code: "INVALID_ENUM_VALUE",
      expected: Object.values(Urgency).join(" | "),
      actual: String(p.urgency ?? "undefined"),
    });
  }

  // Validate timestamp
  if (typeof p.timestamp !== "number") {
    errors.push({
      field: "timestamp",
      message: "Timestamp is required and must be a number",
      code: "REQUIRED_FIELD_MISSING",
    });
  } else if (p.timestamp < 0) {
    errors.push({
      field: "timestamp",
      message: "Timestamp cannot be negative",
      code: "VALUE_OUT_OF_RANGE",
      expected: ">= 0",
      actual: String(p.timestamp),
    });
  } else if (p.timestamp > Date.now() + 60000) {
    warnings.push({
      field: "timestamp",
      message: "Timestamp is significantly in the future (clock skew?)",
      code: "UNUSUAL_VALUE",
    });
  }

  // Validate optional context
  if (p.context !== undefined) {
    if (typeof p.context !== "object" || Array.isArray(p.context)) {
      errors.push({
        field: "context",
        message: "Context must be an object",
        code: "INVALID_TYPE",
        expected: "object",
        actual: Array.isArray(p.context) ? "array" : typeof p.context,
      });
    } else if (p.context !== null) {
      const keyCount = Object.keys(p.context).length;
      if (keyCount > 100) {
        warnings.push({
          field: "context",
          message: `Context has many keys (${keyCount}), consider reducing`,
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
 * Validate ATP request
 *
 * @param request - ATP request to validate
 * @returns Validation result
 */
export function validateATPRequest(request: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!request || typeof request !== "object" || Array.isArray(request)) {
    return {
      valid: false,
      errors: [
        {
          field: "request",
          message: "Request must be an object",
          code: "INVALID_TYPE",
          expected: "object",
          actual: request === null ? "null" : typeof request,
        },
      ],
      warnings: [],
    };
  }

  const r = request as Record<string, unknown>;

  // Validate version
  if (r.version !== "1.0") {
    errors.push({
      field: "version",
      message: 'Version must be "1.0"',
      code: "INVALID_VALUE",
      expected: "1.0",
      actual: String(r.version ?? "undefined"),
    });
  }

  // Validate id
  if (!r.id || typeof r.id !== "string") {
    errors.push({
      field: "id",
      message: "ID is required and must be a string",
      code: "REQUIRED_FIELD_MISSING",
    });
  } else if (r.id.length < 1 || r.id.length > 256) {
    errors.push({
      field: "id",
      message: "ID length must be between 1 and 256 characters",
      code: "INVALID_LENGTH",
      expected: "1-256 characters",
      actual: `${r.id.length} characters`,
    });
  } else if (!/^[a-zA-Z0-9-_]+$/.test(r.id)) {
    errors.push({
      field: "id",
      message:
        "ID contains invalid characters (only alphanumeric, hyphen, underscore allowed)",
      code: "INVALID_FORMAT",
    });
  }

  // Validate query
  if (!r.query || typeof r.query !== "string") {
    errors.push({
      field: "query",
      message: "Query is required and must be a string",
      code: "REQUIRED_FIELD_MISSING",
    });
  } else if (r.query.length < 1 || r.query.length > 10000) {
    errors.push({
      field: "query",
      message: "Query length must be between 1 and 10000 characters",
      code: "INVALID_LENGTH",
      expected: "1-10000 characters",
      actual: `${r.query.length} characters`,
    });
  }

  // Validate embedding (if present)
  if (r.embedding !== undefined) {
    if (!Array.isArray(r.embedding)) {
      errors.push({
        field: "embedding",
        message: "Embedding must be an array",
        code: "INVALID_TYPE",
        expected: "array",
        actual: typeof r.embedding,
      });
    } else {
      if (r.embedding.length !== 1536) {
        warnings.push({
          field: "embedding",
          message: `Embedding should be 1536 dimensions (received ${r.embedding.length})`,
          code: "UNUSUAL_DIMENSIONS",
        });
      }
      if (r.embedding.some(val => typeof val !== "number" || isNaN(val))) {
        errors.push({
          field: "embedding",
          message: "All embedding values must be numbers",
          code: "INVALID_TYPE",
        });
      }
    }
  }

  // Validate context (if present)
  if (r.context !== undefined) {
    if (typeof r.context !== "object" || Array.isArray(r.context)) {
      errors.push({
        field: "context",
        message: "Context must be an object",
        code: "INVALID_TYPE",
        expected: "object",
        actual: Array.isArray(r.context) ? "array" : typeof r.context,
      });
    } else {
      const keyCount = Object.keys(r.context as object).length;
      if (keyCount > 100) {
        warnings.push({
          field: "context",
          message: `Context has many keys (${keyCount}), consider reducing`,
          code: "LARGE_CONTEXT",
        });
      }
    }
  }

  // Validate constraints
  const constraints = r.constraints as Record<string, unknown>;
  if (!r.constraints || typeof r.constraints !== "object") {
    errors.push({
      field: "constraints",
      message: "Constraints is required and must be an object",
      code: "REQUIRED_FIELD_MISSING",
    });
  } else {
    // Validate maxCost
    if (constraints.maxCost !== undefined) {
      if (typeof constraints.maxCost !== "number" || constraints.maxCost < 0) {
        errors.push({
          field: "constraints.maxCost",
          message: "maxCost must be a positive number",
          code: "VALUE_OUT_OF_RANGE",
          expected: ">= 0",
          actual: String(constraints.maxCost),
        });
      }
    }

    // Validate maxLatency
    if (constraints.maxLatency !== undefined) {
      if (typeof constraints.maxLatency !== "number" || constraints.maxLatency < 0) {
        errors.push({
          field: "constraints.maxLatency",
          message: "maxLatency must be a positive number",
          code: "VALUE_OUT_OF_RANGE",
          expected: ">= 0",
          actual: String(constraints.maxLatency),
        });
      }
    }

    // Validate privacy
    if (constraints.privacy !== undefined) {
      const validPrivacyLevels = ["public", "sensitive", "sovereign"];
      if (!validPrivacyLevels.includes(constraints.privacy as string)) {
        errors.push({
          field: "constraints.privacy",
          message: `Privacy must be one of: ${validPrivacyLevels.join(", ")}`,
          code: "INVALID_ENUM_VALUE",
          expected: validPrivacyLevels.join(" | "),
          actual: String(constraints.privacy ?? "undefined"),
        });
      }
    }
  }

  // Validate preferences
  const preferences = r.preferences as Record<string, unknown>;
  if (!r.preferences || typeof r.preferences !== "object") {
    errors.push({
      field: "preferences",
      message: "Preferences is required and must be an object",
      code: "REQUIRED_FIELD_MISSING",
    });
  } else {
    // Validate backend
    if (preferences.backend !== undefined) {
      const validBackends = ["local", "cloud", "auto"];
      if (!validBackends.includes(preferences.backend as string)) {
        errors.push({
          field: "preferences.backend",
          message: `Backend must be one of: ${validBackends.join(", ")}`,
          code: "INVALID_ENUM_VALUE",
          expected: validBackends.join(" | "),
          actual: String(preferences.backend ?? "undefined"),
        });
      }
    }

    // Validate fallback
    if (preferences.fallback !== undefined && typeof preferences.fallback !== "boolean") {
      errors.push({
        field: "preferences.fallback",
        message: "fallback must be a boolean",
        code: "INVALID_TYPE",
        expected: "boolean",
        actual: typeof preferences.fallback,
      });
    }
  }

  // Validate timestamp
  if (typeof r.timestamp !== "number") {
    errors.push({
      field: "timestamp",
      message: "Timestamp is required and must be a number",
      code: "REQUIRED_FIELD_MISSING",
    });
  } else if (r.timestamp < 0) {
    errors.push({
      field: "timestamp",
      message: "Timestamp cannot be negative",
      code: "VALUE_OUT_OF_RANGE",
      expected: ">= 0",
      actual: String(r.timestamp),
    });
  } else if (r.timestamp > Date.now() + 60000) {
    warnings.push({
      field: "timestamp",
      message: "Timestamp is significantly in the future (clock skew?)",
      code: "UNUSUAL_VALUE",
    });
  }

  // Validate intent
  if (!r.intent || !Object.values(IntentCategory).includes(r.intent as IntentCategory)) {
    errors.push({
      field: "intent",
      message: `Intent must be one of: ${Object.values(IntentCategory).join(", ")}`,
      code: "INVALID_ENUM_VALUE",
      expected: Object.values(IntentCategory).join(" | "),
      actual: String(r.intent ?? "undefined"),
    });
  }

  // Validate urgency
  if (!r.urgency || !Object.values(Urgency).includes(r.urgency as Urgency)) {
    errors.push({
      field: "urgency",
      message: `Urgency must be one of: ${Object.values(Urgency).join(", ")}`,
      code: "INVALID_ENUM_VALUE",
      expected: Object.values(Urgency).join(" | "),
      actual: String(r.urgency ?? "undefined"),
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate ATP response
 *
 * @param response - Response to validate
 * @returns Validation result
 */
export function validateATPResponse(response: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!response || typeof response !== "object" || Array.isArray(response)) {
    return {
      valid: false,
      errors: [
        {
          field: "response",
          message: "Response must be an object",
          code: "INVALID_TYPE",
          expected: "object",
          actual: response === null ? "null" : typeof response,
        },
      ],
      warnings: [],
    };
  }

  const r = response as Record<string, unknown>;

  // Validate id
  if (!r.id || typeof r.id !== "string") {
    errors.push({
      field: "id",
      message: "ID is required and must be a string",
      code: "REQUIRED_FIELD_MISSING",
    });
  }

  // Validate content
  if (!r.content || typeof r.content !== "string") {
    errors.push({
      field: "content",
      message: "Content is required and must be a string",
      code: "REQUIRED_FIELD_MISSING",
    });
  } else if (r.content.length > 100000) {
    errors.push({
      field: "content",
      message: "Content exceeds maximum length of 100000 characters",
      code: "INVALID_LENGTH",
      expected: "<= 100000 characters",
      actual: `${r.content.length} characters`,
    });
  }

  // Validate protocol
  if (r.protocol !== "ATP") {
    errors.push({
      field: "protocol",
      message: 'Protocol must be "ATP"',
      code: "INVALID_VALUE",
      expected: "ATP",
      actual: String(r.protocol ?? "undefined"),
    });
  }

  // Validate models
  if (!r.models || typeof r.models !== "string") {
    errors.push({
      field: "models",
      message: "Models is required and must be a string",
      code: "REQUIRED_FIELD_MISSING",
    });
  }

  // Validate backend
  if (
    !r.backend ||
    !["local", "cloud", "hybrid"].includes(r.backend as string)
  ) {
    errors.push({
      field: "backend",
      message: "Backend must be one of: local, cloud, hybrid",
      code: "INVALID_ENUM_VALUE",
      expected: "local | cloud | hybrid",
      actual: String(r.backend ?? "undefined"),
    });
  }

  // Validate confidence
  if (typeof r.confidence !== "number") {
    errors.push({
      field: "confidence",
      message: "Confidence is required and must be a number",
      code: "REQUIRED_FIELD_MISSING",
    });
  } else if (r.confidence < 0 || r.confidence > 1) {
    errors.push({
      field: "confidence",
      message: "Confidence must be between 0 and 1",
      code: "VALUE_OUT_OF_RANGE",
      expected: "0 <= x <= 1",
      actual: String(r.confidence),
    });
  }

  // Validate latency
  if (typeof r.latency !== "number") {
    errors.push({
      field: "latency",
      message: "Latency is required and must be a number",
      code: "REQUIRED_FIELD_MISSING",
    });
  } else if (r.latency < 0) {
    errors.push({
      field: "latency",
      message: "Latency cannot be negative",
      code: "VALUE_OUT_OF_RANGE",
      expected: ">= 0",
      actual: String(r.latency),
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// PROTOCOL SPECIFICATION
// ============================================================================

/**
 * Complete ATP protocol specification for compliance checking
 */
export const ATP_SCHEMA: ProtocolSpecification = {
  name: "ATP",
  version: { major: 1, minor: 0, patch: 0 },
  types: [
    {
      name: "ATPacket",
      type: "interface",
      definition: {
        kind: "interface",
        properties: {
          id: { type: "string", optional: false, readonly: false },
          query: { type: "string", optional: false, readonly: false },
          intent: { type: "string", optional: false, readonly: false },
          urgency: { type: "string", optional: false, readonly: false },
          timestamp: { type: "number", optional: false, readonly: false },
          context: { type: "object", optional: true, readonly: false },
        },
      },
      required_properties: ["id", "query", "intent", "urgency", "timestamp"],
      optional_properties: ["context"],
    },
    {
      name: "IntentCategory",
      type: "enum",
      definition: {
        kind: "enum",
        values: Object.values(IntentCategory).reduce(
          (acc, val) => {
            acc[val] = val;
            return acc;
          },
          {} as Record<string, string>
        ),
      },
      required_properties: [],
      optional_properties: [],
    },
    {
      name: "Urgency",
      type: "enum",
      definition: {
        kind: "enum",
        values: Object.values(Urgency).reduce(
          (acc, val) => {
            acc[val] = val;
            return acc;
          },
          {} as Record<string, string>
        ),
      },
      required_properties: [],
      optional_properties: [],
    },
  ],
  messages: [
    {
      name: "ATPRequest",
      direction: "request",
      request_type: "ATPacket",
      response_type: "AequorResponse",
      flow_control: {
        streaming: true,
        timeout: ATP_FLOW_CONTROL.timeout.default,
        retry_policy: {
          max_attempts: ATP_FLOW_CONTROL.retry_policy.max_attempts.default,
          backoff: ATP_FLOW_CONTROL.retry_policy.backoff
            .default as "exponential",
          initial_delay: ATP_FLOW_CONTROL.retry_policy.initial_delay.default,
          max_delay: ATP_FLOW_CONTROL.retry_policy.max_delay.default,
        },
        rate_limit: {
          max_requests: ATP_FLOW_CONTROL.rate_limit.requests_per_minute,
          window_ms: 60000,
          burst: ATP_FLOW_CONTROL.rate_limit.burst,
        },
      },
      error_handling: {
        retryable_errors: [...ATP_ERROR_HANDLING.retryable_errors],
        non_retryable_errors: [...ATP_ERROR_HANDLING.non_retryable_errors],
        fallback_strategy: ATP_ERROR_HANDLING.fallback_strategy
          .default as "fail",
      },
    },
    {
      name: "ATPResponse",
      direction: "response",
      request_type: "ATPacket",
      response_type: "AequorResponse",
    },
  ],
  behaviors: [
    {
      name: "validate_packet",
      description: "Validate ATP packet before processing",
      preconditions: [
        {
          description: "Packet must be an object",
          check: ctx => typeof ctx.parameters.packet === "object",
        },
      ],
      postconditions: [
        {
          description: "Validation result is returned",
          check: ctx => ctx.result !== undefined,
        },
      ],
      invariants: [],
    },
    {
      name: "process_packet",
      description: "Process ATP packet and generate response",
      preconditions: [
        {
          description: "Packet is valid",
          check: ctx => ctx.parameters.valid === true,
        },
      ],
      postconditions: [
        {
          description: "Response is generated",
          check: ctx => ctx.result !== undefined,
        },
      ],
      invariants: [],
    },
  ],
  constraints: [
    {
      name: "max_packet_size",
      type: "custom",
      rule: {
        check: ctx => {
          const size = JSON.stringify(ctx.parameters).length;
          return size <= 10240; // 10KB
        },
        violation_message: "Packet exceeds maximum size of 10KB",
      },
      severity: "error",
    },
    {
      name: "timeout_range",
      type: "custom",
      rule: {
        check: ctx => {
          const timeout = ctx.parameters.timeout as number | undefined;
          if (timeout === undefined) return true;
          return (
            timeout >= ATP_FLOW_CONTROL.timeout.min &&
            timeout <= ATP_FLOW_CONTROL.timeout.max
          );
        },
        violation_message: `Timeout must be between ${ATP_FLOW_CONTROL.timeout.min} and ${ATP_FLOW_CONTROL.timeout.max}ms`,
      },
      severity: "error",
    },
  ],
  documentation_url: "https://docs.aequor.ai/protocols/atp",
};

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Validation error
 */
interface ValidationError {
  field: string;
  message: string;
  code: string;
  expected?: string;
  actual?: string;
}

/**
 * Validation warning
 */
interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

/**
 * Validation result
 */
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

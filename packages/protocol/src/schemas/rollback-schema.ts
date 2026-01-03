/**
 * Rollback Protocol Schema
 *
 * Validation schema for Rollback protocol.
 * The Rollback protocol enables distributed rollback operations across
 * multiple nodes when a deployment causes issues.
 *
 * This schema defines:
 * - Rollback request/response format
 * - Consensus protocol types
 * - Voting mechanism rules
 * - Health verification requirements
 * - Notification channel specifications
 *
 * Usage:
 * ```typescript
 * import { ROLLBACK_SCHEMA, validateRollbackRequest } from '@lsi/protocol/schemas/rollback-schema';
 *
 * const request = { rollbackId: 'rb-123', scope: 'full', ... };
 * const result = validateRollbackRequest(request);
 * if (!result.valid) {
 *   console.error('Invalid rollback request:', result.errors);
 * }
 * ```
 */

import type { ProtocolSpecification } from "../compliance.js";
import type { RollbackReason, RollbackScope, RollbackStrategy } from "../rollback.js";

// ============================================================================
// ROLLBACK REQUEST SCHEMA
// ============================================================================

/**
 * Rollback reason types
 */
export const ROLLBACK_REASON_TYPES = [
  "degradation",
  "error",
  "security",
  "bug",
  "incompatibility",
  "manual",
] as const;

/**
 * Rollback scope types
 */
export const ROLLBACK_SCOPE_TYPES = [
  "local",
  "cluster",
  "global",
] as const;

/**
 * Rollback strategy types
 */
export const ROLLBACK_STRATEGY_TYPES = [
  "immediate",
  "graceful",
  "scheduled",
] as const;

/**
 * Rollback status types
 */
export const ROLLBACK_STATUS_TYPES = [
  "pending",
  "in_progress",
  "completed",
  "failed",
  "cancelled",
] as const;

/**
 * Consensus algorithm types
 */
export const CONSENSUS_ALGORITHMS = [
  "raft",
  "paxos",
  "pbft",
  "simple_majority",
  "unanimous",
] as const;

/**
 * Rollback request field definitions
 */
export const ROLLBACK_REQUEST_FIELDS = {
  rollbackId: {
    type: "string",
    required: true,
    description: "Unique identifier for this rollback operation",
    validation: {
      pattern: "^rb-[a-zA-Z0-9-_]+$",
      minLength: 4,
      maxLength: 100,
    },
  },
  scope: {
    type: "enum",
    required: true,
    description:
      "Scope of rollback (full, partial, single_model, single_cartridge)",
    values: ROLLBACK_SCOPE_TYPES,
  },
  reason: {
    type: "enum",
    required: true,
    description: "Reason for rollback",
    values: ROLLBACK_REASON_TYPES,
  },
  targetVersion: {
    type: "string",
    required: true,
    description: "Version to rollback to",
    validation: {
      pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+(-[0-9A-Za-z-]+)?$",
    },
  },
  currentVersion: {
    type: "string",
    required: true,
    description: "Current version that will be rolled back",
    validation: {
      pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+(-[0-9A-Za-z-]+)?$",
    },
  },
  strategy: {
    type: "enum",
    required: true,
    description: "Rollback strategy (immediate, graceful, canary, staged)",
    values: ROLLBACK_STRATEGY_TYPES,
  },
  options: {
    type: "object",
    required: false,
    description: "Additional rollback options",
  },
} as const;

/**
 * Rollback options field definitions
 */
export const ROLLBACK_OPTIONS_FIELDS = {
  timeout: {
    type: "number",
    required: false,
    description: "Rollback timeout in milliseconds",
    validation: {
      min: 1000,
      max: 600000, // 10 minutes max
    },
  },
  force: {
    type: "boolean",
    required: false,
    description: "Force rollback even if health checks fail",
  },
  skipValidation: {
    type: "boolean",
    required: false,
    description: "Skip pre-rollback validation",
  },
  preserveState: {
    type: "boolean",
    required: false,
    description: "Preserve current state during rollback",
  },
  drainConnections: {
    type: "boolean",
    required: false,
    description: "Drain existing connections before rollback",
  },
} as const;

// ============================================================================
// ROLLBACK RESPONSE SCHEMA
// ============================================================================

/**
 * Rollback response field definitions
 */
export const ROLLBACK_RESPONSE_FIELDS = {
  rollbackId: {
    type: "string",
    required: true,
    description: "Rollback ID matching the request",
  },
  status: {
    type: "enum",
    required: true,
    description: "Current status of the rollback",
    values: ROLLBACK_STATUS_TYPES,
  },
  message: {
    type: "string",
    required: false,
    description: "Human-readable status message",
  },
  verificationResult: {
    type: "object",
    required: false,
    description: "Verification result after rollback",
  },
  consensusResult: {
    type: "object",
    required: false,
    description: "Consensus result if applicable",
  },
} as const;

// ============================================================================
// CONSENSUS PROTOCOL SCHEMA
// ============================================================================

/**
 * Consensus configuration field definitions
 */
export const CONSENSUS_CONFIG_FIELDS = {
  algorithm: {
    type: "enum",
    required: true,
    description: "Consensus algorithm to use",
    values: CONSENSUS_ALGORITHMS,
  },
  timeout: {
    type: "number",
    required: true,
    description: "Consensus timeout in milliseconds",
    validation: {
      min: 1000,
      max: 300000, // 5 minutes max
    },
  },
  requiredVotes: {
    type: "number",
    required: true,
    description: "Minimum votes required for consensus",
    validation: {
      min: 1,
    },
  },
  totalVoters: {
    type: "number",
    required: true,
    description: "Total number of voting nodes",
    validation: {
      min: 1,
    },
  },
} as const;

/**
 * Consensus proposal field definitions
 */
export const CONSENSUS_PROPOSAL_FIELDS = {
  proposalId: {
    type: "string",
    required: true,
    description: "Unique proposal identifier",
  },
  proposalType: {
    type: "enum",
    required: true,
    description: "Type of proposal (rollback, config_change, etc.)",
    values: ["rollback", "config_change", "deployment", "emergency"],
  },
  proposedBy: {
    type: "string",
    required: true,
    description: "Node or user proposing the change",
  },
  data: {
    type: "object",
    required: true,
    description: "Proposal data",
  },
  createdAt: {
    type: "number",
    required: true,
    description: "Unix timestamp when proposal was created",
    validation: {
      min: 0,
    },
  },
  expiresAt: {
    type: "number",
    required: true,
    description: "Unix timestamp when proposal expires",
    validation: {
      min: 0,
    },
  },
} as const;

/**
 * Vote field definitions
 */
export const VOTE_FIELDS = {
  voteId: {
    type: "string",
    required: true,
    description: "Unique vote identifier",
  },
  proposalId: {
    type: "string",
    required: true,
    description: "Proposal ID this vote is for",
  },
  nodeId: {
    type: "string",
    required: true,
    description: "Node casting the vote",
  },
  decision: {
    type: "enum",
    required: true,
    description: "Vote decision",
    values: ["approve", "reject", "abstain"],
  },
  reason: {
    type: "string",
    required: false,
    description: "Reason for the vote decision",
  },
  timestamp: {
    type: "number",
    required: true,
    description: "Unix timestamp when vote was cast",
    validation: {
      min: 0,
    },
  },
} as const;

/**
 * Consensus result field definitions
 */
export const CONSENSUS_RESULT_FIELDS = {
  proposalId: {
    type: "string",
    required: true,
    description: "Proposal ID",
  },
  approved: {
    type: "boolean",
    required: true,
    description: "Whether the proposal was approved",
  },
  approveVotes: {
    type: "number",
    required: true,
    description: "Number of approve votes",
    validation: {
      min: 0,
    },
  },
  rejectVotes: {
    type: "number",
    required: true,
    description: "Number of reject votes",
    validation: {
      min: 0,
    },
  },
  abstainVotes: {
    type: "number",
    required: true,
    description: "Number of abstain votes",
    validation: {
      min: 0,
    },
  },
  totalVotes: {
    type: "number",
    required: true,
    description: "Total number of votes cast",
    validation: {
      min: 0,
    },
  },
  consensusReached: {
    type: "boolean",
    required: true,
    description: "Whether consensus was reached",
  },
} as const;

// ============================================================================
// VERIFICATION SCHEMA
// ============================================================================

/**
 * Verification result field definitions
 */
export const VERIFICATION_RESULT_FIELDS = {
  verified: {
    type: "boolean",
    required: true,
    description: "Whether rollback was verified successful",
  },
  healthStatus: {
    type: "enum",
    required: true,
    description: "Health status after rollback",
    values: ["healthy", "degraded", "unhealthy"],
  },
  metrics: {
    type: "object",
    required: true,
    description: "Metrics snapshot after rollback",
  },
  errors: {
    type: "array",
    required: true,
    description: "Any errors encountered during verification",
  },
  warnings: {
    type: "array",
    required: true,
    description: "Any warnings during verification",
  },
} as const;

/**
 * Verification metrics field definitions
 */
export const VERIFICATION_METRICS_FIELDS = {
  latency: {
    type: "object",
    required: true,
    description: "Latency metrics",
    properties: {
      p50: { type: "number", required: true },
      p95: { type: "number", required: true },
      p99: { type: "number", required: true },
    },
  },
  errorRate: {
    type: "number",
    required: true,
    description: "Error rate (0-1)",
    validation: {
      min: 0,
      max: 1,
    },
  },
  throughput: {
    type: "number",
    required: true,
    description: "Requests per second",
    validation: {
      min: 0,
    },
  },
  cpuUsage: {
    type: "number",
    required: true,
    description: "CPU usage (0-1)",
    validation: {
      min: 0,
      max: 1,
    },
  },
  memoryUsage: {
    type: "number",
    required: true,
    description: "Memory usage (0-1)",
    validation: {
      min: 0,
      max: 1,
    },
  },
} as const;

// ============================================================================
// NOTIFICATION CHANNEL SCHEMA
// ============================================================================

/**
 * Notification channel types
 */
export const NOTIFICATION_CHANNEL_TYPES = [
  "webhook",
  "email",
  "slack",
  "pagerduty",
  "custom",
] as const;

/**
 * Notification channel field definitions
 */
export const NOTIFICATION_CHANNEL_FIELDS = {
  type: {
    type: "enum",
    required: true,
    description: "Channel type",
    values: NOTIFICATION_CHANNEL_TYPES,
  },
  endpoint: {
    type: "string",
    required: false,
    description: "Channel endpoint URL or identifier",
  },
  config: {
    type: "object",
    required: false,
    description: "Channel-specific configuration",
  },
} as const;

// ============================================================================
// VALIDATION FUNCTIONS
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
interface SchemaValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validate rollback request
 *
 * @param request - Rollback request to validate
 * @returns Validation result
 */
export function validateRollbackRequest(
  request: unknown
): SchemaValidationResult {
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

  // Validate rollbackId
  if (!r.rollbackId || typeof r.rollbackId !== "string") {
    errors.push({
      field: "rollbackId",
      message: "Rollback ID is required and must be a string",
      code: "REQUIRED_FIELD_MISSING",
    });
  } else if (!/^rb-[a-zA-Z0-9-_]+$/.test(r.rollbackId)) {
    errors.push({
      field: "rollbackId",
      message:
        'Rollback ID must start with "rb-" followed by alphanumeric characters, hyphens, or underscores',
      code: "INVALID_FORMAT",
      expected: "rb-*",
      actual: r.rollbackId,
    });
  }

  // Validate scope
  if (!r.scope || !ROLLBACK_SCOPE_TYPES.includes(r.scope as RollbackScope)) {
    errors.push({
      field: "scope",
      message: `Scope must be one of: ${ROLLBACK_SCOPE_TYPES.join(", ")}`,
      code: "INVALID_ENUM_VALUE",
      expected: ROLLBACK_SCOPE_TYPES.join(" | "),
      actual: String(r.scope ?? "undefined"),
    });
  }

  // Validate reason
  if (!r.reason || !ROLLBACK_REASON_TYPES.includes(r.reason as RollbackReason)) {
    errors.push({
      field: "reason",
      message: `Reason must be one of: ${ROLLBACK_REASON_TYPES.join(", ")}`,
      code: "INVALID_ENUM_VALUE",
      expected: ROLLBACK_REASON_TYPES.join(" | "),
      actual: String(r.reason ?? "undefined"),
    });
  }

  // Validate targetVersion
  if (!r.targetVersion || typeof r.targetVersion !== "string") {
    errors.push({
      field: "targetVersion",
      message: "Target version is required and must be a string",
      code: "REQUIRED_FIELD_MISSING",
    });
  } else if (
    !/^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z-]+)?$/.test(r.targetVersion)
  ) {
    errors.push({
      field: "targetVersion",
      message:
        'Target version must be a valid semantic version (e.g., "1.2.0" or "1.2.0-alpha")',
      code: "INVALID_FORMAT",
      expected: "x.y.z or x.y.z-prerelease",
      actual: r.targetVersion,
    });
  }

  // Validate currentVersion
  if (!r.currentVersion || typeof r.currentVersion !== "string") {
    errors.push({
      field: "currentVersion",
      message: "Current version is required and must be a string",
      code: "REQUIRED_FIELD_MISSING",
    });
  } else if (
    !/^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z-]+)?$/.test(r.currentVersion)
  ) {
    errors.push({
      field: "currentVersion",
      message: "Current version must be a valid semantic version",
      code: "INVALID_FORMAT",
    });
  }

  // Validate strategy
  if (!r.strategy || !ROLLBACK_STRATEGY_TYPES.includes(r.strategy as RollbackStrategy)) {
    errors.push({
      field: "strategy",
      message: `Strategy must be one of: ${ROLLBACK_STRATEGY_TYPES.join(", ")}`,
      code: "INVALID_ENUM_VALUE",
      expected: ROLLBACK_STRATEGY_TYPES.join(" | "),
      actual: String(r.strategy ?? "undefined"),
    });
  }

  // Validate options if present
  if (r.options !== undefined) {
    if (typeof r.options !== "object" || Array.isArray(r.options)) {
      errors.push({
        field: "options",
        message: "Options must be an object",
        code: "INVALID_TYPE",
        expected: "object",
        actual: typeof r.options,
      });
    } else if (r.options !== null) {
      const opts = r.options as Record<string, unknown>;

      // Validate timeout
      if (opts.timeout !== undefined) {
        if (typeof opts.timeout !== "number") {
          errors.push({
            field: "options.timeout",
            message: "Timeout must be a number",
            code: "INVALID_TYPE",
            expected: "number",
            actual: typeof opts.timeout,
          });
        } else if (opts.timeout < 1000 || opts.timeout > 600000) {
          errors.push({
            field: "options.timeout",
            message: "Timeout must be between 1000 and 600000 milliseconds",
            code: "VALUE_OUT_OF_RANGE",
            expected: "1000 <= x <= 600000",
            actual: String(opts.timeout),
          });
        }
      }

      // Validate force
      if (opts.force !== undefined && typeof opts.force !== "boolean") {
        errors.push({
          field: "options.force",
          message: "Force must be a boolean",
          code: "INVALID_TYPE",
          expected: "boolean",
          actual: typeof opts.force,
        });
      }

      // Validate skipValidation
      if (
        opts.skipValidation !== undefined &&
        typeof opts.skipValidation !== "boolean"
      ) {
        errors.push({
          field: "options.skipValidation",
          message: "Skip validation must be a boolean",
          code: "INVALID_TYPE",
          expected: "boolean",
          actual: typeof opts.skipValidation,
        });
      }

      // Validate preserveState
      if (
        opts.preserveState !== undefined &&
        typeof opts.preserveState !== "boolean"
      ) {
        errors.push({
          field: "options.preserveState",
          message: "Preserve state must be a boolean",
          code: "INVALID_TYPE",
          expected: "boolean",
          actual: typeof opts.preserveState,
        });
      }

      // Validate drainConnections
      if (
        opts.drainConnections !== undefined &&
        typeof opts.drainConnections !== "boolean"
      ) {
        errors.push({
          field: "options.drainConnections",
          message: "Drain connections must be a boolean",
          code: "INVALID_TYPE",
          expected: "boolean",
          actual: typeof opts.drainConnections,
        });
      }
    }
  }

  // Warn if force is true
  if (r.options && typeof r.options === "object" && r.options !== null) {
    if ((r.options as Record<string, unknown>).force === true) {
      warnings.push({
        field: "options.force",
        message: "Force rollback may skip safety checks",
        code: "FORCE_WARNING",
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
 * Validate consensus proposal
 *
 * @param proposal - Proposal to validate
 * @returns Validation result
 */
export function validateConsensusProposal(
  proposal: unknown
): SchemaValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) {
    return {
      valid: false,
      errors: [
        {
          field: "proposal",
          message: "Proposal must be an object",
          code: "INVALID_TYPE",
          expected: "object",
          actual: proposal === null ? "null" : typeof proposal,
        },
      ],
      warnings: [],
    };
  }

  const p = proposal as Record<string, unknown>;

  // Validate proposalId
  if (!p.proposalId || typeof p.proposalId !== "string") {
    errors.push({
      field: "proposalId",
      message: "Proposal ID is required and must be a string",
      code: "REQUIRED_FIELD_MISSING",
    });
  }

  // Validate proposalType
  const validTypes = ["rollback", "config_change", "deployment", "emergency"];
  if (!p.proposalType || !validTypes.includes(p.proposalType as string)) {
    errors.push({
      field: "proposalType",
      message: `Proposal type must be one of: ${validTypes.join(", ")}`,
      code: "INVALID_ENUM_VALUE",
      expected: validTypes.join(" | "),
      actual: String(p.proposalType ?? "undefined"),
    });
  }

  // Validate proposedBy
  if (!p.proposedBy || typeof p.proposedBy !== "string") {
    errors.push({
      field: "proposedBy",
      message: "Proposed by is required and must be a string",
      code: "REQUIRED_FIELD_MISSING",
    });
  }

  // Validate data
  if (!p.data || typeof p.data !== "object" || Array.isArray(p.data)) {
    errors.push({
      field: "data",
      message: "Data is required and must be an object",
      code: "REQUIRED_FIELD_MISSING",
    });
  }

  // Validate timestamps
  if (typeof p.createdAt !== "number") {
    errors.push({
      field: "createdAt",
      message: "Created at must be a number",
      code: "INVALID_TYPE",
      expected: "number",
      actual: typeof p.createdAt,
    });
  } else if (p.createdAt > Date.now()) {
    warnings.push({
      field: "createdAt",
      message: "Created at is in the future",
      code: "UNUSUAL_VALUE",
    });
  }

  if (typeof p.expiresAt !== "number") {
    errors.push({
      field: "expiresAt",
      message: "Expires at must be a number",
      code: "INVALID_TYPE",
      expected: "number",
      actual: typeof p.expiresAt,
    });
  } else if (p.expiresAt < (p.createdAt as number)) {
    errors.push({
      field: "expiresAt",
      message: "Expires at must be after created at",
      code: "VALUE_OUT_OF_RANGE",
      expected: "> createdAt",
      actual: "expiresAt <= createdAt",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate vote
 *
 * @param vote - Vote to validate
 * @returns Validation result
 */
export function validateVote(vote: unknown): SchemaValidationResult {
  const errors: ValidationError[] = [];

  if (!vote || typeof vote !== "object" || Array.isArray(vote)) {
    return {
      valid: false,
      errors: [
        {
          field: "vote",
          message: "Vote must be an object",
          code: "INVALID_TYPE",
          expected: "object",
          actual: vote === null ? "null" : typeof vote,
        },
      ],
      warnings: [],
    };
  }

  const v = vote as Record<string, unknown>;

  // Validate voteId
  if (!v.voteId || typeof v.voteId !== "string") {
    errors.push({
      field: "voteId",
      message: "Vote ID is required and must be a string",
      code: "REQUIRED_FIELD_MISSING",
    });
  }

  // Validate proposalId
  if (!v.proposalId || typeof v.proposalId !== "string") {
    errors.push({
      field: "proposalId",
      message: "Proposal ID is required and must be a string",
      code: "REQUIRED_FIELD_MISSING",
    });
  }

  // Validate nodeId
  if (!v.nodeId || typeof v.nodeId !== "string") {
    errors.push({
      field: "nodeId",
      message: "Node ID is required and must be a string",
      code: "REQUIRED_FIELD_MISSING",
    });
  }

  // Validate decision
  const validDecisions = ["approve", "reject", "abstain"];
  if (!v.decision || !validDecisions.includes(v.decision as string)) {
    errors.push({
      field: "decision",
      message: `Decision must be one of: ${validDecisions.join(", ")}`,
      code: "INVALID_ENUM_VALUE",
      expected: validDecisions.join(" | "),
      actual: String(v.decision ?? "undefined"),
    });
  }

  // Validate timestamp
  if (typeof v.timestamp !== "number") {
    errors.push({
      field: "timestamp",
      message: "Timestamp must be a number",
      code: "INVALID_TYPE",
      expected: "number",
      actual: typeof v.timestamp,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
  };
}

// ============================================================================
// PROTOCOL SPECIFICATION
// ============================================================================

/**
 * Complete Rollback protocol specification for compliance checking
 */
export const ROLLBACK_SCHEMA: ProtocolSpecification = {
  name: "Rollback",
  version: { major: 1, minor: 0, patch: 0 },
  types: [
    {
      name: "RollbackRequest",
      type: "interface",
      definition: {
        kind: "interface",
        properties: {
          rollbackId: { type: "string", optional: false, readonly: false },
          scope: { type: "string", optional: false, readonly: false },
          reason: { type: "string", optional: false, readonly: false },
          targetVersion: { type: "string", optional: false, readonly: false },
          currentVersion: { type: "string", optional: false, readonly: false },
          strategy: { type: "string", optional: false, readonly: false },
          options: { type: "object", optional: true, readonly: false },
        },
      },
      required_properties: [
        "rollbackId",
        "scope",
        "reason",
        "targetVersion",
        "currentVersion",
        "strategy",
      ],
      optional_properties: ["options"],
    },
    {
      name: "RollbackResponse",
      type: "interface",
      definition: {
        kind: "interface",
        properties: {
          rollbackId: { type: "string", optional: false, readonly: false },
          status: { type: "string", optional: false, readonly: false },
          message: { type: "string", optional: true, readonly: false },
          verificationResult: {
            type: "object",
            optional: true,
            readonly: false,
          },
          consensusResult: { type: "object", optional: true, readonly: false },
        },
      },
      required_properties: ["rollbackId", "status"],
      optional_properties: ["message", "verificationResult", "consensusResult"],
    },
    {
      name: "ConsensusProposal",
      type: "interface",
      definition: {
        kind: "interface",
        properties: {
          proposalId: { type: "string", optional: false, readonly: false },
          proposalType: { type: "string", optional: false, readonly: false },
          proposedBy: { type: "string", optional: false, readonly: false },
          data: { type: "object", optional: false, readonly: false },
          createdAt: { type: "number", optional: false, readonly: false },
          expiresAt: { type: "number", optional: false, readonly: false },
        },
      },
      required_properties: [
        "proposalId",
        "proposalType",
        "proposedBy",
        "data",
        "createdAt",
        "expiresAt",
      ],
      optional_properties: [],
    },
    {
      name: "Vote",
      type: "interface",
      definition: {
        kind: "interface",
        properties: {
          voteId: { type: "string", optional: false, readonly: false },
          proposalId: { type: "string", optional: false, readonly: false },
          nodeId: { type: "string", optional: false, readonly: false },
          decision: { type: "string", optional: false, readonly: false },
          reason: { type: "string", optional: true, readonly: false },
          timestamp: { type: "number", optional: false, readonly: false },
        },
      },
      required_properties: [
        "voteId",
        "proposalId",
        "nodeId",
        "decision",
        "timestamp",
      ],
      optional_properties: ["reason"],
    },
    {
      name: "ConsensusResult",
      type: "interface",
      definition: {
        kind: "interface",
        properties: {
          proposalId: { type: "string", optional: false, readonly: false },
          approved: { type: "boolean", optional: false, readonly: false },
          approveVotes: { type: "number", optional: false, readonly: false },
          rejectVotes: { type: "number", optional: false, readonly: false },
          abstainVotes: { type: "number", optional: false, readonly: false },
          totalVotes: { type: "number", optional: false, readonly: false },
          consensusReached: {
            type: "boolean",
            optional: false,
            readonly: false,
          },
        },
      },
      required_properties: [
        "proposalId",
        "approved",
        "approveVotes",
        "rejectVotes",
        "abstainVotes",
        "totalVotes",
        "consensusReached",
      ],
      optional_properties: [],
    },
  ],
  messages: [
    {
      name: "RollbackRequest",
      direction: "request",
      request_type: "RollbackRequest",
      response_type: "RollbackResponse",
      flow_control: {
        streaming: false,
        timeout: 600000, // 10 minutes max for rollback
      },
      error_handling: {
        retryable_errors: ["timeout", "node_unavailable"],
        non_retryable_errors: [
          "invalid_request",
          "version_not_found",
          "rollback_in_progress",
        ],
      },
    },
    {
      name: "RollbackResponse",
      direction: "response",
      request_type: "RollbackRequest",
      response_type: "RollbackResponse",
    },
  ],
  behaviors: [
    {
      name: "execute_rollback",
      description: "Execute rollback operation",
      preconditions: [
        {
          description: "Target version exists",
          check: ctx => ctx.parameters.targetVersionExists === true,
        },
        {
          description: "No rollback in progress",
          check: ctx => ctx.parameters.rollbackInProgress === false,
        },
      ],
      postconditions: [
        {
          description: "Rollback completed",
          check: (ctx: any) => (ctx.result as any)?.status === "completed",
        },
      ],
      invariants: [],
    },
    {
      name: "verify_rollback",
      description: "Verify rollback was successful",
      preconditions: [
        {
          description: "Rollback completed",
          check: ctx => ctx.parameters.rollbackStatus === "completed",
        },
      ],
      postconditions: [
        {
          description: "Health is acceptable",
          check: (ctx: any) => (ctx.result as any)?.healthStatus !== "unhealthy",
        },
      ],
      invariants: [],
    },
  ],
  constraints: [
    {
      name: "version_exists",
      type: "custom",
      rule: {
        check: ctx => {
          const exists = ctx.parameters.versionExists as boolean;
          return exists === true;
        },
        violation_message: "Target version does not exist",
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
          return timeout >= 1000 && timeout <= 600000;
        },
        violation_message: "Timeout must be between 1 second and 10 minutes",
      },
      severity: "error",
    },
    {
      name: "consensus_quorum",
      type: "custom",
      rule: {
        check: ctx => {
          const required = ctx.parameters.requiredVotes as number;
          const total = ctx.parameters.totalVoters as number;
          return required > 0 && required <= total;
        },
        violation_message: "Required votes must be between 1 and total voters",
      },
      severity: "error",
    },
  ],
  documentation_url: "https://docs.aequor.ai/protocols/rollback",
};

// Re-export ProtocolSpecification
export type { ProtocolSpecification };

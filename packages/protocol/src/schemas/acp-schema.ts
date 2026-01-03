/**
 * ACP Protocol Schema
 *
 * Validation schema for ACP (Assisted Collaborative Processing) protocol.
 * ACP is used for multi-model query collaboration in the Aequor platform.
 *
 * This schema defines:
 * - Handshake request/response format
 * - Collaboration mode specifications
 * - Execution plan structure
 * - Aggregation strategies
 * - Model coordination rules
 *
 * Usage:
 * ```typescript
 * import { ACP_SCHEMA, validateACPHandshake } from '@lsi/protocol/schemas/acp-schema';
 *
 * const handshake = { id: 'acp-123', query: 'test', models: ['gpt-4'], ... };
 * const result = validateACPHandshake(handshake);
 * if (!result.valid) {
 *   console.error('Invalid handshake:', result.errors);
 * }
 * ```
 */

import type { ProtocolSpecification } from "../compliance.js";
import {
  HardwareConstraints,
  PrivacyLevel,
  IntentCategory,
  Urgency,
  CollaborationMode
} from "../atp-acp.js";

// ============================================================================
// ACP HANDSHAKE REQUEST SCHEMA
// ============================================================================

/**
 * ACP handshake request field definitions
 */
export const ACP_HANDSHAKE_REQUEST_FIELDS = {
  id: {
    type: "string",
    required: true,
    description: "Unique identifier for this handshake session",
    validation: {
      minLength: 1,
      maxLength: 256,
      pattern: "^acp-[a-zA-Z0-9-_]+$", // Should start with 'acp-'
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
    description: "Classified intent category for strategy selection",
    values: Object.values(IntentCategory),
  },
  collaborationMode: {
    type: "enum",
    required: true,
    description: "How models should collaborate",
    values: Object.values(CollaborationMode),
  },
  models: {
    type: "array",
    required: true,
    description: "Ordered list of model identifiers to use",
    validation: {
      minLength: 1,
      maxLength: 10, // Max 10 models in collaboration
      itemPattern: "^[a-zA-Z0-9-_.]+$",
    },
  },
  preferences: {
    type: "object",
    required: true,
    description: "Optional preferences and constraints",
    properties: {
      maxLatency: {
        type: "number",
        required: false,
        validation: { min: 0, max: 600000 }, // Max 10 minutes
      },
      maxCost: {
        type: "number",
        required: false,
        validation: { min: 0, max: 1000 }, // Max $1000
      },
      minQuality: {
        type: "number",
        required: false,
        validation: { min: 0, max: 1 },
      },
      priority: {
        type: "enum",
        required: false,
        values: Object.values(Urgency),
      },
    },
  },
  timestamp: {
    type: "number",
    required: true,
    description: "Unix timestamp (ms) when request was created",
    validation: {
      min: 0,
      max: Date.now() + 60000,
    },
  },
} as const;

// ============================================================================
// ACP HANDSHAKE RESPONSE SCHEMA
// ============================================================================

/**
 * ACP handshake response field definitions
 */
export const ACP_HANDSHAKE_RESPONSE_FIELDS = {
  requestId: {
    type: "string",
    required: true,
    description: "Request ID matching the handshake request",
  },
  status: {
    type: "enum",
    required: true,
    description:
      "Whether request was accepted, rejected, or partially accepted",
    values: ["accepted", "rejected", "partial"],
  },
  selectedModels: {
    type: "array",
    required: true,
    description: "Models selected for collaboration (subset of requested)",
    validation: {
      minLength: 0,
      maxLength: 10,
    },
  },
  reason: {
    type: "string",
    required: false,
    description: "Human-readable reason for status (especially for rejections)",
  },
  executionPlan: {
    type: "object",
    required: true,
    description: "Execution plan with steps and aggregation strategy",
  },
  estimatedLatency: {
    type: "number",
    required: true,
    description: "Estimated total latency in milliseconds",
    validation: { min: 0 },
  },
  estimatedCost: {
    type: "number",
    required: true,
    description: "Estimated total cost in USD",
    validation: { min: 0 },
  },
} as const;

// ============================================================================
// EXECUTION PLAN SCHEMA
// ============================================================================

/**
 * Execution plan field definitions
 */
export const EXECUTION_PLAN_FIELDS = {
  mode: {
    type: "enum",
    required: true,
    description: "Collaboration mode for this execution",
    values: Object.values(CollaborationMode),
  },
  steps: {
    type: "array",
    required: true,
    description: "Ordered steps for model execution",
    validation: {
      minLength: 1,
      maxLength: 50, // Max 50 steps
    },
  },
  aggregationStrategy: {
    type: "enum",
    required: true,
    description: "How to combine outputs from multiple models",
    values: [
      "first",
      "last",
      "majority_vote",
      "weighted_average",
      "best",
      "concatenate",
      "all",
    ],
  },
} as const;

/**
 * Execution step field definitions
 */
export const EXECUTION_STEP_FIELDS = {
  stepNumber: {
    type: "number",
    required: true,
    description: "Step number in execution sequence (1-indexed)",
    validation: { min: 1, max: 50 },
  },
  model: {
    type: "string",
    required: true,
    description: "Model identifier for this step",
  },
  inputSource: {
    type: "enum",
    required: true,
    description: "Where this step gets its input",
    values: ["original", "previous", "aggregated"],
  },
  outputTarget: {
    type: "enum",
    required: true,
    description: "Where this step output goes",
    values: ["final", "next", "aggregator"],
  },
  estimatedLatency: {
    type: "number",
    required: true,
    description: "Estimated latency for this step in milliseconds",
    validation: { min: 0, max: 300000 }, // Max 5 minutes per step
  },
} as const;

// ============================================================================
// COLLABORATION MODE SPECIFICATIONS
// ============================================================================

/**
 * Collaboration mode specifications
 */
export const COLLABORATION_MODES = {
  SEQUENTIAL: {
    name: "sequential",
    description:
      "Models process one after another, each building on previous output",
    characteristics: {
      parallelism: "none",
      state: "shared",
      latency: "cumulative",
      cost: "cumulative",
      use_case: "Refinement and iterative improvement",
    },
  },
  PARALLEL: {
    name: "parallel",
    description: "Models process simultaneously, results aggregated",
    characteristics: {
      parallelism: "full",
      state: "independent",
      latency: "max",
      cost: "cumulative",
      use_case: "Diverse perspectives on same query",
    },
  },
  CASCADE: {
    name: "cascade",
    description: "Output of one model feeds into the next as input",
    characteristics: {
      parallelism: "none",
      state: "chained",
      latency: "cumulative",
      cost: "cumulative",
      use_case: "Specialized processing pipeline",
    },
  },
  ENSEMBLE: {
    name: "ensemble",
    description:
      "Multiple models process independently, outputs combined via voting/averaging",
    characteristics: {
      parallelism: "full",
      state: "independent",
      latency: "max",
      cost: "cumulative",
      use_case: "High-stakes decisions requiring consensus",
    },
  },
} as const;

// ============================================================================
// AGGREGATION STRATEGIES
// ============================================================================

/**
 * Aggregation strategy specifications
 */
export const AGGREGATION_STRATEGIES = {
  FIRST: {
    name: "first",
    description: "Return the first response received",
    use_case: "Fast response with acceptable quality",
    applicable_modes: ["parallel", "ensemble"],
  },
  LAST: {
    name: "last",
    description: "Return the last response received (for sequential/cascade)",
    use_case: "Most refined response",
    applicable_modes: ["sequential", "cascade"],
  },
  MAJORITY_VOTE: {
    name: "majority_vote",
    description: "Majority voting across models",
    use_case: "Categorical decisions with discrete outputs",
    applicable_modes: ["ensemble"],
  },
  WEIGHTED_AVERAGE: {
    name: "weighted_average",
    description: "Weighted average based on confidence scores",
    use_case: "Continuous outputs with quality estimates",
    applicable_modes: ["parallel", "ensemble"],
  },
  BEST: {
    name: "best",
    description: "Return the response with highest confidence",
    use_case: "Quality-focused selection",
    applicable_modes: ["parallel", "ensemble"],
  },
  CONCATENATE: {
    name: "concatenate",
    description: "Concatenate all responses",
    use_case: "Comprehensive responses from all models",
    applicable_modes: ["parallel", "ensemble", "sequential"],
  },
  ALL: {
    name: "all",
    description: "Return all responses (let client decide)",
    use_case: "Client-side aggregation",
    applicable_modes: ["parallel", "ensemble", "sequential"],
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
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validate ACP handshake request
 *
 * @param handshake - Handshake request to validate
 * @returns Validation result
 */
export function validateACPHandshake(handshake: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!handshake || typeof handshake !== "object" || Array.isArray(handshake)) {
    return {
      valid: false,
      errors: [
        {
          field: "handshake",
          message: "Handshake must be an object",
          code: "INVALID_TYPE",
          expected: "object",
          actual: handshake === null ? "null" : typeof handshake,
        },
      ],
      warnings: [],
    };
  }

  const h = handshake as Record<string, unknown>;

  // Validate id
  if (!h.id || typeof h.id !== "string") {
    errors.push({
      field: "id",
      message: "ID is required and must be a string",
      code: "REQUIRED_FIELD_MISSING",
    });
  } else if (!h.id.startsWith("acp-")) {
    errors.push({
      field: "id",
      message: 'ID must start with "acp-"',
      code: "INVALID_FORMAT",
      expected: "acp-*",
      actual: h.id,
    });
  } else if (h.id.length < 5 || h.id.length > 256) {
    errors.push({
      field: "id",
      message: "ID length must be between 5 and 256 characters",
      code: "INVALID_LENGTH",
      expected: "5-256 characters",
      actual: `${h.id.length} characters`,
    });
  }

  // Validate query
  if (!h.query || typeof h.query !== "string") {
    errors.push({
      field: "query",
      message: "Query is required and must be a string",
      code: "REQUIRED_FIELD_MISSING",
    });
  } else if (h.query.length < 1 || h.query.length > 10000) {
    errors.push({
      field: "query",
      message: "Query length must be between 1 and 10000 characters",
      code: "INVALID_LENGTH",
      expected: "1-10000 characters",
      actual: `${h.query.length} characters`,
    });
  }

  // Validate intent
  if (
    !h.intent ||
    !Object.values(IntentCategory).includes(h.intent as IntentCategory)
  ) {
    errors.push({
      field: "intent",
      message: `Intent must be one of: ${Object.values(IntentCategory).join(", ")}`,
      code: "INVALID_ENUM_VALUE",
      expected: Object.values(IntentCategory).join(" | "),
      actual: String(h.intent ?? "undefined"),
    });
  }

  // Validate collaborationMode
  if (
    !h.collaborationMode ||
    !Object.values(CollaborationMode).includes(
      h.collaborationMode as CollaborationMode
    )
  ) {
    errors.push({
      field: "collaborationMode",
      message: `Collaboration mode must be one of: ${Object.values(CollaborationMode).join(", ")}`,
      code: "INVALID_ENUM_VALUE",
      expected: Object.values(CollaborationMode).join(" | "),
      actual: String(h.collaborationMode ?? "undefined"),
    });
  }

  // Validate models array
  if (!Array.isArray(h.models)) {
    errors.push({
      field: "models",
      message: "Models must be an array",
      code: "INVALID_TYPE",
      expected: "array",
      actual: typeof h.models,
    });
  } else if (h.models.length === 0) {
    errors.push({
      field: "models",
      message: "Models array cannot be empty",
      code: "INVALID_ARRAY_LENGTH",
    });
  } else if (h.models.length > 10) {
    errors.push({
      field: "models",
      message: "Models array cannot exceed 10 models",
      code: "INVALID_ARRAY_LENGTH",
      expected: "<= 10",
      actual: `${h.models.length}`,
    });
  } else {
    // Validate each model
    for (let i = 0; i < h.models.length; i++) {
      const model = h.models[i];
      if (typeof model !== "string" || model.trim().length === 0) {
        errors.push({
          field: `models[${i}]`,
          message: `Model at index ${i} must be a non-empty string`,
          code: "INVALID_TYPE",
          expected: "non-empty string",
          actual: typeof model,
        });
      }
    }
  }

  // Validate preferences
  if (
    !h.preferences ||
    typeof h.preferences !== "object" ||
    Array.isArray(h.preferences)
  ) {
    errors.push({
      field: "preferences",
      message: "Preferences must be an object",
      code: "INVALID_TYPE",
      expected: "object",
      actual:
        h.preferences === undefined
          ? "undefined"
          : Array.isArray(h.preferences)
            ? "array"
            : typeof h.preferences,
    });
  } else if (h.preferences !== null) {
    const prefs = h.preferences as Record<string, unknown>;

    // Validate maxLatency
    if (prefs.maxLatency !== undefined) {
      if (typeof prefs.maxLatency !== "number") {
        errors.push({
          field: "preferences.maxLatency",
          message: "maxLatency must be a number",
          code: "INVALID_TYPE",
          expected: "number",
          actual: typeof prefs.maxLatency,
        });
      } else if (prefs.maxLatency < 0 || prefs.maxLatency > 600000) {
        errors.push({
          field: "preferences.maxLatency",
          message: "maxLatency must be between 0 and 600000 (10 minutes)",
          code: "VALUE_OUT_OF_RANGE",
          expected: "0 <= x <= 600000",
          actual: String(prefs.maxLatency),
        });
      }
    }

    // Validate maxCost
    if (prefs.maxCost !== undefined) {
      if (typeof prefs.maxCost !== "number") {
        errors.push({
          field: "preferences.maxCost",
          message: "maxCost must be a number",
          code: "INVALID_TYPE",
          expected: "number",
          actual: typeof prefs.maxCost,
        });
      } else if (prefs.maxCost < 0 || prefs.maxCost > 1000) {
        errors.push({
          field: "preferences.maxCost",
          message: "maxCost must be between 0 and 1000 (USD)",
          code: "VALUE_OUT_OF_RANGE",
          expected: "0 <= x <= 1000",
          actual: String(prefs.maxCost),
        });
      }
    }

    // Validate minQuality
    if (prefs.minQuality !== undefined) {
      if (typeof prefs.minQuality !== "number") {
        errors.push({
          field: "preferences.minQuality",
          message: "minQuality must be a number",
          code: "INVALID_TYPE",
          expected: "number",
          actual: typeof prefs.minQuality,
        });
      } else if (prefs.minQuality < 0 || prefs.minQuality > 1) {
        errors.push({
          field: "preferences.minQuality",
          message: "minQuality must be between 0 and 1",
          code: "VALUE_OUT_OF_RANGE",
          expected: "0 <= x <= 1",
          actual: String(prefs.minQuality),
        });
      }
    }

    // Validate priority
    if (
      prefs.priority !== undefined &&
      !Object.values(Urgency).includes(prefs.priority as Urgency)
    ) {
      errors.push({
        field: "preferences.priority",
        message: `Priority must be one of: ${Object.values(Urgency).join(", ")}`,
        code: "INVALID_ENUM_VALUE",
        expected: Object.values(Urgency).join(" | "),
        actual: String(prefs.priority),
      });
    }
  }

  // Validate timestamp
  if (typeof h.timestamp !== "number") {
    errors.push({
      field: "timestamp",
      message: "Timestamp is required and must be a number",
      code: "REQUIRED_FIELD_MISSING",
    });
  } else if (h.timestamp < 0) {
    errors.push({
      field: "timestamp",
      message: "Timestamp cannot be negative",
      code: "VALUE_OUT_OF_RANGE",
      expected: ">= 0",
      actual: String(h.timestamp),
    });
  } else if (h.timestamp > Date.now() + 60000) {
    warnings.push({
      field: "timestamp",
      message: "Timestamp is significantly in the future (clock skew?)",
      code: "UNUSUAL_VALUE",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate ACP workflow step
 *
 * @param step - Workflow step to validate
 * @param index - Index of step in workflow
 * @returns Validation result
 */
function validateWorkflowStep(step: unknown, index: number): ValidationResult {
  const errors: ValidationError[] = [];

  if (!step || typeof step !== "object" || Array.isArray(step)) {
    return {
      valid: false,
      errors: [{
        field: `workflow[${index}]`,
        message: "Workflow step must be an object",
        code: "INVALID_TYPE",
        expected: "object",
        actual: step === null ? "null" : typeof step,
      }],
      warnings: [],
    };
  }

  const s = step as Record<string, unknown>;

  // Validate stepId
  if (!s.stepId || typeof s.stepId !== "string" || s.stepId.trim() === "") {
    errors.push({
      field: `workflow[${index}].stepId`,
      message: "Step ID is required and must be a non-empty string",
      code: "REQUIRED_FIELD_MISSING",
    });
  } else if (s.stepId.length > 64) {
    errors.push({
      field: `workflow[${index}].stepId`,
      message: "Step ID cannot exceed 64 characters",
      code: "INVALID_LENGTH",
      expected: "<= 64 characters",
      actual: `${s.stepId.length} characters`,
    });
  }

  // Validate operation
  if (!s.operation || typeof s.operation !== "string") {
    errors.push({
      field: `workflow[${index}].operation`,
      message: "Operation is required and must be a string",
      code: "REQUIRED_FIELD_MISSING",
    });
  } else if (!["generate", "embed", "classify", "rank", "analyze", "transform"].includes(s.operation)) {
    errors.push({
      field: `workflow[${index}].operation`,
      message: `Operation must be one of: generate, embed, classify, rank, analyze, transform`,
      code: "INVALID_ENUM_VALUE",
      expected: "generate | embed | classify | rank | analyze | transform",
      actual: String(s.operation),
    });
  }

  // Validate order (for sequential steps)
  if (s.order !== undefined) {
    if (typeof s.order !== "number") {
      errors.push({
        field: `workflow[${index}].order`,
        message: "Order must be a number",
        code: "INVALID_TYPE",
        expected: "number",
        actual: typeof s.order,
      });
    } else if (s.order < 0 || s.order > 1000) {
      errors.push({
        field: `workflow[${index}].order`,
        message: "Order must be between 0 and 1000",
        code: "VALUE_OUT_OF_RANGE",
        expected: "0 <= x <= 1000",
        actual: String(s.order),
      });
    }
  }

  // Validate parameters
  if (s.parameters !== undefined && (typeof s.parameters !== "object" || Array.isArray(s.parameters))) {
    errors.push({
      field: `workflow[${index}].parameters`,
      message: "Parameters must be an object",
      code: "INVALID_TYPE",
      expected: "object",
      actual: typeof s.parameters,
    });
  }

  // Validate timeout
  if (s.timeout !== undefined) {
    if (typeof s.timeout !== "number") {
      errors.push({
        field: `workflow[${index}].timeout`,
        message: "Timeout must be a number",
        code: "INVALID_TYPE",
        expected: "number",
        actual: typeof s.timeout,
      });
    } else if (s.timeout < 1000 || s.timeout > 600000) {
      errors.push({
        field: `workflow[${index}].timeout`,
        message: "Timeout must be between 1000ms (1s) and 600000ms (10min)",
        code: "VALUE_OUT_OF_RANGE",
        expected: "1000 <= x <= 600000",
        actual: String(s.timeout),
      });
    }
  }

  // Validate dependencies
  if (s.dependencies !== undefined) {
    if (!Array.isArray(s.dependencies)) {
      errors.push({
        field: `workflow[${index}].dependencies`,
        message: "Dependencies must be an array",
        code: "INVALID_TYPE",
        expected: "array",
        actual: typeof s.dependencies,
      });
    } else {
      for (let i = 0; i < s.dependencies.length; i++) {
        const dep = s.dependencies[i];
        if (typeof dep !== "string" || dep.trim() === "") {
          errors.push({
            field: `workflow[${index}].dependencies[${i}]`,
            message: `Dependency at index ${i} must be a non-empty string`,
            code: "INVALID_TYPE",
            expected: "non-empty string",
            actual: typeof dep,
          });
        }
      }
    }
  }

  // Validate model
  if (!s.model || typeof s.model !== "string" || s.model.trim() === "") {
    errors.push({
      field: `workflow[${index}].model`,
      message: "Model is required and must be a non-empty string",
      code: "REQUIRED_FIELD_MISSING",
    });
  } else if (s.model.length > 128) {
    errors.push({
      field: `workflow[${index}].model`,
      message: "Model identifier cannot exceed 128 characters",
      code: "INVALID_LENGTH",
      expected: "<= 128 characters",
      actual: `${s.model.length} characters`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
  };
}

/**
 * Validate shared context
 *
 * @param sharedContext - Shared context to validate
 * @returns Validation result
 */
function validateSharedContext(sharedContext: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (!(sharedContext instanceof Map)) {
    return {
      valid: false,
      errors: [{
        field: "sharedContext",
        message: "Shared context must be a Map",
        code: "INVALID_TYPE",
        expected: "Map",
        actual: typeof sharedContext,
      }],
      warnings: [],
    };
  }

  // Check size limit
  if (sharedContext.size > 50) {
    errors.push({
      field: "sharedContext",
      message: "Shared context cannot contain more than 50 entries",
      code: "INVALID_SIZE",
      expected: "<= 50",
      actual: `${sharedContext.size}`,
    });
  }

  // Validate each key-value pair
  let index = 0;
  const sharedContextEntries = Array.from(sharedContext.entries());
  for (const [key, value] of sharedContextEntries) {
    if (typeof key !== "string" || key.trim() === "") {
      errors.push({
        field: `sharedContext[${index}].key`,
        message: `Context key at index ${index} must be a non-empty string`,
        code: "INVALID_TYPE",
        expected: "non-empty string",
        actual: typeof key,
      });
    } else if (key.length > 128) {
      errors.push({
        field: `sharedContext[${index}].key`,
        message: `Context key at index ${index} cannot exceed 128 characters`,
        code: "INVALID_LENGTH",
        expected: "<= 128 characters",
        actual: `${key.length} characters`,
      });
    }

    if (value === undefined || value === null) {
      errors.push({
        field: `sharedContext[${index}].value`,
        message: `Context value at index ${index} cannot be null or undefined`,
        code: "INVALID_VALUE",
        expected: "any value except null/undefined",
        actual: String(value),
      });
    }

    index++;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
  };
}

/**
 * Validate hardware constraints
 *
 * @param hardware - Hardware constraints to validate
 * @returns Validation result
 */
function validateHardwareConstraints(hardware: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (!hardware || typeof hardware !== "object" || Array.isArray(hardware)) {
    return {
      valid: false,
      errors: [{
        field: "hardware",
        message: "Hardware constraints must be an object",
        code: "INVALID_TYPE",
        expected: "object",
        actual: hardware === null ? "null" : typeof hardware,
      }],
      warnings: [],
    };
  }

  const h = hardware as HardwareConstraints;

  // Validate maxPower
  if (h.maxPower !== undefined) {
    if (typeof h.maxPower !== "number") {
      errors.push({
        field: "hardware.maxPower",
        message: "Max power must be a number",
        code: "INVALID_TYPE",
        expected: "number",
        actual: typeof h.maxPower,
      });
    } else if (h.maxPower < 0 || h.maxPower > 1000) {
      errors.push({
        field: "hardware.maxPower",
        message: "Max power must be between 0 and 1000 watts",
        code: "VALUE_OUT_OF_RANGE",
        expected: "0 <= x <= 1000",
        actual: String(h.maxPower),
      });
    }
  }

  // Validate maxThermal
  if (h.maxThermal !== undefined) {
    if (typeof h.maxThermal !== "number") {
      errors.push({
        field: "hardware.maxThermal",
        message: "Max thermal must be a number",
        code: "INVALID_TYPE",
        expected: "number",
        actual: typeof h.maxThermal,
      });
    } else if (h.maxThermal < 0 || h.maxThermal > 1) {
      errors.push({
        field: "hardware.maxThermal",
        message: "Max thermal must be between 0 and 1",
        code: "VALUE_OUT_OF_RANGE",
        expected: "0 <= x <= 1",
        actual: String(h.maxThermal),
      });
    }
  }

  // Validate preferGPU
  if (h.preferGPU !== undefined && typeof h.preferGPU !== "boolean") {
    errors.push({
      field: "hardware.preferGPU",
      message: "Prefer GPU must be a boolean",
      code: "INVALID_TYPE",
      expected: "boolean",
      actual: typeof h.preferGPU,
    });
  }

  // Validate minBatteryLevel
  if (h.minBatteryLevel !== undefined) {
    if (typeof h.minBatteryLevel !== "number") {
      errors.push({
        field: "hardware.minBatteryLevel",
        message: "Min battery level must be a number",
        code: "INVALID_TYPE",
        expected: "number",
        actual: typeof h.minBatteryLevel,
      });
    } else if (h.minBatteryLevel < 0 || h.minBatteryLevel > 1) {
      errors.push({
        field: "hardware.minBatteryLevel",
        message: "Min battery level must be between 0 and 1",
        code: "VALUE_OUT_OF_RANGE",
        expected: "0 <= x <= 1",
        actual: String(h.minBatteryLevel),
      });
    }
  }

  // Validate maxRAM
  if (h.maxRAM !== undefined) {
    if (typeof h.maxRAM !== "number") {
      errors.push({
        field: "hardware.maxRAM",
        message: "Max RAM must be a number",
        code: "INVALID_TYPE",
        expected: "number",
        actual: typeof h.maxRAM,
      });
    } else if (h.maxRAM < 100 || h.maxRAM > 100000) {
      errors.push({
        field: "hardware.maxRAM",
        message: "Max RAM must be between 100MB and 100GB (100000MB)",
        code: "VALUE_OUT_OF_RANGE",
        expected: "100 <= x <= 100000 (MB)",
        actual: String(h.maxRAM),
      });
    }
  }

  // Validate maxStorage
  if (h.maxStorage !== undefined) {
    if (typeof h.maxStorage !== "number") {
      errors.push({
        field: "hardware.maxStorage",
        message: "Max storage must be a number",
        code: "INVALID_TYPE",
        expected: "number",
        actual: typeof h.maxStorage,
      });
    } else if (h.maxStorage < 100 || h.maxStorage > 10000000) {
      errors.push({
        field: "hardware.maxStorage",
        message: "Max storage must be between 100MB and 10TB (10000000MB)",
        code: "VALUE_OUT_OF_RANGE",
        expected: "100 <= x <= 10000000 (MB)",
        actual: String(h.maxStorage),
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
  };
}

/**
 * Validate ACP request
 *
 * @param request - ACP request to validate
 * @returns Validation result
 */
export function validateACPRequest(request: unknown): ValidationResult {
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
      code: "INVALID_VERSION",
      expected: '"1.0"',
      actual: String(r.version),
    });
  }

  // Validate id
  if (!r.id || typeof r.id !== "string" || r.id.trim() === "") {
    errors.push({
      field: "id",
      message: "ID is required and must be a non-empty string",
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
  }

  // Validate query
  if (!r.query || typeof r.query !== "string" || r.query.trim() === "") {
    errors.push({
      field: "query",
      message: "Query is required and must be a non-empty string",
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

  // Validate intent
  if (
    !r.intent ||
    !Object.values(IntentCategory).includes(r.intent as IntentCategory)
  ) {
    errors.push({
      field: "intent",
      message: `Intent must be one of: ${Object.values(IntentCategory).join(", ")}`,
      code: "INVALID_ENUM_VALUE",
      expected: Object.values(IntentCategory).join(" | "),
      actual: String(r.intent ?? "undefined"),
    });
  }

  // Validate workflow
  if (!Array.isArray(r.workflow)) {
    errors.push({
      field: "workflow",
      message: "Workflow must be an array",
      code: "INVALID_TYPE",
      expected: "array",
      actual: typeof r.workflow,
    });
  } else if (r.workflow.length === 0) {
    errors.push({
      field: "workflow",
      message: "Workflow cannot be empty",
      code: "INVALID_ARRAY_LENGTH",
    });
  } else if (r.workflow.length > 20) {
    errors.push({
      field: "workflow",
      message: "Workflow cannot contain more than 20 steps",
      code: "INVALID_ARRAY_LENGTH",
      expected: "<= 20",
      actual: `${r.workflow.length}`,
    });
  } else {
    // Validate each workflow step
    for (let i = 0; i < r.workflow.length; i++) {
      const stepValidation = validateWorkflowStep(r.workflow[i], i);
      errors.push(...stepValidation.errors);
      warnings.push(...stepValidation.warnings);
    }

    // Check for duplicate step IDs
    const stepIds = new Set<string>();
    for (let i = 0; i < r.workflow.length; i++) {
      const step = r.workflow[i] as Record<string, unknown>;
      const stepId = step.stepId;
      if (stepIds.has(stepId as string)) {
        errors.push({
          field: `workflow[${i}].stepId`,
          message: `Duplicate step ID: ${stepId}`,
          code: "DUPLICATE_ID",
        });
      } else {
        stepIds.add(stepId as string);
      }
    }
  }

  // Validate sharedContext
  if (r.sharedContext !== undefined) {
    const contextValidation = validateSharedContext(r.sharedContext);
    errors.push(...contextValidation.errors);
    warnings.push(...contextValidation.warnings);
  }

  // Validate constraints
  if (!r.constraints || typeof r.constraints !== "object" || Array.isArray(r.constraints)) {
    errors.push({
      field: "constraints",
      message: "Constraints must be an object",
      code: "INVALID_TYPE",
      expected: "object",
      actual: r.constraints === undefined ? "undefined" :
              Array.isArray(r.constraints) ? "array" : typeof r.constraints,
    });
  } else if (r.constraints !== null) {
    const constraints = r.constraints as Record<string, unknown>;

    // Validate maxCost
    if (constraints.maxCost !== undefined) {
      if (typeof constraints.maxCost !== "number") {
        errors.push({
          field: "constraints.maxCost",
          message: "maxCost must be a number",
          code: "INVALID_TYPE",
          expected: "number",
          actual: typeof constraints.maxCost,
        });
      } else if (constraints.maxCost < 0 || constraints.maxCost > 10000) {
        errors.push({
          field: "constraints.maxCost",
          message: "maxCost must be between 0 and 10000 (USD)",
          code: "VALUE_OUT_OF_RANGE",
          expected: "0 <= x <= 10000",
          actual: String(constraints.maxCost),
        });
      }
    }

    // Validate maxLatency
    if (constraints.maxLatency !== undefined) {
      if (typeof constraints.maxLatency !== "number") {
        errors.push({
          field: "constraints.maxLatency",
          message: "maxLatency must be a number",
          code: "INVALID_TYPE",
          expected: "number",
          actual: typeof constraints.maxLatency,
        });
      } else if (constraints.maxLatency < 0 || constraints.maxLatency > 600000) {
        errors.push({
          field: "constraints.maxLatency",
          message: "maxLatency must be between 0 and 600000 (10 minutes)",
          code: "VALUE_OUT_OF_RANGE",
          expected: "0 <= x <= 600000",
          actual: String(constraints.maxLatency),
        });
      }
    }

    // Validate privacy
    if (constraints.privacy !== undefined) {
      if (!Object.values(PrivacyLevel).includes(constraints.privacy as PrivacyLevel)) {
        errors.push({
          field: "constraints.privacy",
          message: `Privacy must be one of: ${Object.values(PrivacyLevel).join(", ")}`,
          code: "INVALID_ENUM_VALUE",
          expected: Object.values(PrivacyLevel).join(" | "),
          actual: String(constraints.privacy),
        });
      }
    }

    // Validate hardware
    if (constraints.hardware !== undefined) {
      const hardwareValidation = validateHardwareConstraints(constraints.hardware);
      errors.push(...hardwareValidation.errors);
      warnings.push(...hardwareValidation.warnings);
    }
  }

  // Validate preferences
  if (!r.preferences || typeof r.preferences !== "object" || Array.isArray(r.preferences)) {
    errors.push({
      field: "preferences",
      message: "Preferences must be an object",
      code: "INVALID_TYPE",
      expected: "object",
      actual: r.preferences === undefined ? "undefined" :
              Array.isArray(r.preferences) ? "array" : typeof r.preferences,
    });
  } else if (r.preferences !== null) {
    const prefs = r.preferences as Record<string, unknown>;

    // Validate backend
    if (
      prefs.backend !== undefined &&
      !["local", "cloud", "auto"].includes(prefs.backend as string)
    ) {
      errors.push({
        field: "preferences.backend",
        message: `Backend must be one of: local, cloud, auto`,
        code: "INVALID_ENUM_VALUE",
        expected: "local | cloud | auto",
        actual: String(prefs.backend),
      });
    }

    // Validate model
    if (prefs.model !== undefined) {
      if (typeof prefs.model !== "string" || prefs.model.trim() === "") {
        errors.push({
          field: "preferences.model",
          message: "Model must be a non-empty string",
          code: "INVALID_TYPE",
          expected: "non-empty string",
          actual: typeof prefs.model,
        });
      } else if (prefs.model.length > 128) {
        errors.push({
          field: "preferences.model",
          message: "Model identifier cannot exceed 128 characters",
          code: "INVALID_LENGTH",
          expected: "<= 128 characters",
          actual: `${prefs.model.length} characters`,
        });
      }
    }

    // Validate fallback
    if (prefs.fallback !== undefined && typeof prefs.fallback !== "boolean") {
      errors.push({
        field: "preferences.fallback",
        message: "Fallback must be a boolean",
        code: "INVALID_TYPE",
        expected: "boolean",
        actual: typeof prefs.fallback,
      });
    }
  }

  // Validate collaborationMode
  if (
    !r.collaborationMode ||
    !Object.values(CollaborationMode).includes(r.collaborationMode as CollaborationMode)
  ) {
    errors.push({
      field: "collaborationMode",
      message: `Collaboration mode must be one of: ${Object.values(CollaborationMode).join(", ")}`,
      code: "INVALID_ENUM_VALUE",
      expected: Object.values(CollaborationMode).join(" | "),
      actual: String(r.collaborationMode ?? "undefined"),
    });
  }

  // Validate urgency
  if (
    !r.urgency ||
    !Object.values(Urgency).includes(r.urgency as Urgency)
  ) {
    errors.push({
      field: "urgency",
      message: `Urgency must be one of: ${Object.values(Urgency).join(", ")}`,
      code: "INVALID_ENUM_VALUE",
      expected: Object.values(Urgency).join(" | "),
      actual: String(r.urgency ?? "undefined"),
    });
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

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate ACP handshake response
 *
 * @param response - Handshake response to validate
 * @returns Validation result
 */
export function validateACPHandshakeResponse(
  response: unknown
): ValidationResult {
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

  // Validate requestId
  if (!r.requestId || typeof r.requestId !== "string") {
    errors.push({
      field: "requestId",
      message: "Request ID is required and must be a string",
      code: "REQUIRED_FIELD_MISSING",
    });
  }

  // Validate status
  if (
    !r.status ||
    !["accepted", "rejected", "partial"].includes(r.status as string)
  ) {
    errors.push({
      field: "status",
      message: "Status must be one of: accepted, rejected, partial",
      code: "INVALID_ENUM_VALUE",
      expected: "accepted | rejected | partial",
      actual: String(r.status ?? "undefined"),
    });
  }

  // Validate selectedModels
  if (!Array.isArray(r.selectedModels)) {
    errors.push({
      field: "selectedModels",
      message: "Selected models must be an array",
      code: "INVALID_TYPE",
      expected: "array",
      actual: typeof r.selectedModels,
    });
  } else if (r.selectedModels.length > 10) {
    errors.push({
      field: "selectedModels",
      message: "Selected models cannot exceed 10",
      code: "INVALID_ARRAY_LENGTH",
      expected: "<= 10",
      actual: `${r.selectedModels.length}`,
    });
  }

  // Validate executionPlan
  if (
    !r.executionPlan ||
    typeof r.executionPlan !== "object" ||
    Array.isArray(r.executionPlan)
  ) {
    errors.push({
      field: "executionPlan",
      message: "Execution plan is required and must be an object",
      code: "REQUIRED_FIELD_MISSING",
    });
  }

  // Validate estimatedLatency
  if (typeof r.estimatedLatency !== "number") {
    errors.push({
      field: "estimatedLatency",
      message: "Estimated latency is required and must be a number",
      code: "REQUIRED_FIELD_MISSING",
    });
  } else if (r.estimatedLatency < 0) {
    errors.push({
      field: "estimatedLatency",
      message: "Estimated latency cannot be negative",
      code: "VALUE_OUT_OF_RANGE",
      expected: ">= 0",
      actual: String(r.estimatedLatency),
    });
  }

  // Validate estimatedCost
  if (typeof r.estimatedCost !== "number") {
    errors.push({
      field: "estimatedCost",
      message: "Estimated cost is required and must be a number",
      code: "REQUIRED_FIELD_MISSING",
    });
  } else if (r.estimatedCost < 0) {
    errors.push({
      field: "estimatedCost",
      message: "Estimated cost cannot be negative",
      code: "VALUE_OUT_OF_RANGE",
      expected: ">= 0",
      actual: String(r.estimatedCost),
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
 * Complete ACP protocol specification for compliance checking
 */
export const ACP_SCHEMA: ProtocolSpecification = {
  name: "ACP",
  version: { major: 1, minor: 0, patch: 0 },
  types: [
    {
      name: "ACPHandshakeRequest",
      type: "interface",
      definition: {
        kind: "interface",
        properties: {
          id: { type: "string", optional: false, readonly: false },
          query: { type: "string", optional: false, readonly: false },
          intent: { type: "string", optional: false, readonly: false },
          collaborationMode: {
            type: "string",
            optional: false,
            readonly: false,
          },
          models: { type: "array", optional: false, readonly: false },
          preferences: { type: "object", optional: false, readonly: false },
          timestamp: { type: "number", optional: false, readonly: false },
        },
      },
      required_properties: [
        "id",
        "query",
        "intent",
        "collaborationMode",
        "models",
        "preferences",
        "timestamp",
      ],
      optional_properties: [],
    },
    {
      name: "ACPHandshakeResponse",
      type: "interface",
      definition: {
        kind: "interface",
        properties: {
          requestId: { type: "string", optional: false, readonly: false },
          status: { type: "string", optional: false, readonly: false },
          selectedModels: { type: "array", optional: false, readonly: false },
          reason: { type: "string", optional: true, readonly: false },
          executionPlan: { type: "object", optional: false, readonly: false },
          estimatedLatency: {
            type: "number",
            optional: false,
            readonly: false,
          },
          estimatedCost: { type: "number", optional: false, readonly: false },
        },
      },
      required_properties: [
        "requestId",
        "status",
        "selectedModels",
        "executionPlan",
        "estimatedLatency",
        "estimatedCost",
      ],
      optional_properties: ["reason"],
    },
    {
      name: "ExecutionPlan",
      type: "interface",
      definition: {
        kind: "interface",
        properties: {
          mode: { type: "string", optional: false, readonly: false },
          steps: { type: "array", optional: false, readonly: false },
          aggregationStrategy: {
            type: "string",
            optional: false,
            readonly: false,
          },
        },
      },
      required_properties: ["mode", "steps", "aggregationStrategy"],
      optional_properties: [],
    },
    {
      name: "ExecutionStep",
      type: "interface",
      definition: {
        kind: "interface",
        properties: {
          stepNumber: { type: "number", optional: false, readonly: false },
          model: { type: "string", optional: false, readonly: false },
          inputSource: { type: "string", optional: false, readonly: false },
          outputTarget: { type: "string", optional: false, readonly: false },
          estimatedLatency: {
            type: "number",
            optional: false,
            readonly: false,
          },
        },
      },
      required_properties: [
        "stepNumber",
        "model",
        "inputSource",
        "outputTarget",
        "estimatedLatency",
      ],
      optional_properties: [],
    },
    {
      name: "CollaborationMode",
      type: "enum",
      definition: {
        kind: "enum",
        values: Object.values(CollaborationMode).reduce(
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
      name: "ACPHandshakeRequest",
      direction: "request",
      request_type: "ACPHandshakeRequest",
      response_type: "ACPHandshakeResponse",
      flow_control: {
        streaming: false,
        timeout: 60000, // 1 minute for handshake
      },
      error_handling: {
        retryable_errors: ["timeout", "service_unavailable"],
        non_retryable_errors: ["invalid_request", "access_denied"],
      },
    },
    {
      name: "ACPHandshakeResponse",
      direction: "response",
      request_type: "ACPHandshakeRequest",
      response_type: "ACPHandshakeResponse",
    },
  ],
  behaviors: [
    {
      name: "validate_handshake",
      description: "Validate ACP handshake request",
      preconditions: [
        {
          description: "Request is an object",
          check: ctx => typeof ctx.parameters.request === "object",
        },
        {
          description: "Models array is not empty",
          check: ctx => {
            const req = ctx.parameters.request as Record<string, unknown>;
            return (
              Array.isArray(req.models as unknown[]) &&
              (req.models as unknown[]).length > 0
            );
          },
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
      name: "create_execution_plan",
      description: "Create execution plan from handshake",
      preconditions: [
        {
          description: "Handshake is valid",
          check: ctx => ctx.parameters.valid === true,
        },
        {
          description: "At least one model is available",
          check: ctx =>
            (ctx.parameters.availableModels as unknown[]).length > 0,
        },
      ],
      postconditions: [
        {
          description: "Execution plan is created",
          check: ctx => ctx.result !== undefined,
        },
      ],
      invariants: [],
    },
  ],
  constraints: [
    {
      name: "max_models",
      type: "custom",
      rule: {
        check: ctx => {
          const models = ctx.parameters.models as unknown[];
          return models.length <= 10;
        },
        violation_message:
          "Cannot use more than 10 models in a single collaboration",
      },
      severity: "error",
    },
    {
      name: "compatible_aggregation",
      type: "custom",
      rule: {
        check: ctx => {
          const mode = ctx.parameters.collaborationMode as CollaborationMode;
          const strategy = ctx.parameters.aggregationStrategy as string;
          // Verify aggregation strategy is compatible with collaboration mode
          const validCombinations: Record<CollaborationMode, string[]> = {
            [CollaborationMode.SEQUENTIAL]: ["last", "concatenate", "all"],
            [CollaborationMode.PARALLEL]: [
              "first",
              "best",
              "weighted_average",
              "concatenate",
              "all",
            ],
            [CollaborationMode.CASCADE]: ["last", "concatenate", "all"],
            [CollaborationMode.ENSEMBLE]: [
              "majority_vote",
              "weighted_average",
              "best",
              "concatenate",
              "all",
            ],
          };
          return validCombinations[mode]?.includes(strategy) ?? false;
        },
        violation_message:
          "Aggregation strategy is not compatible with collaboration mode",
      },
      severity: "error",
    },
    {
      name: "reasonable_latency",
      type: "custom",
      rule: {
        check: ctx => {
          const latency = ctx.parameters.maxLatency as number | undefined;
          if (latency === undefined) return true;
          return latency >= 1000 && latency <= 600000; // 1 second to 10 minutes
        },
        violation_message:
          "Max latency must be between 1 second and 10 minutes",
      },
      severity: "warning",
    },
  ],
  documentation_url: "https://docs.aequor.ai/protocols/acp",
};

// Re-export common types
export type { ProtocolSpecification };

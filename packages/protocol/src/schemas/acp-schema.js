"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACP_SCHEMA = exports.AGGREGATION_STRATEGIES = exports.COLLABORATION_MODES = exports.EXECUTION_STEP_FIELDS = exports.EXECUTION_PLAN_FIELDS = exports.ACP_HANDSHAKE_RESPONSE_FIELDS = exports.ACP_HANDSHAKE_REQUEST_FIELDS = void 0;
exports.validateACPHandshake = validateACPHandshake;
exports.validateACPHandshakeResponse = validateACPHandshakeResponse;
var atp_acp_js_1 = require("../atp-acp.js");
// ============================================================================
// ACP HANDSHAKE REQUEST SCHEMA
// ============================================================================
/**
 * ACP handshake request field definitions
 */
exports.ACP_HANDSHAKE_REQUEST_FIELDS = {
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
        values: Object.values(atp_acp_js_1.IntentCategory),
    },
    collaborationMode: {
        type: "enum",
        required: true,
        description: "How models should collaborate",
        values: Object.values(atp_acp_js_1.CollaborationMode),
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
                values: Object.values(atp_acp_js_1.Urgency),
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
};
// ============================================================================
// ACP HANDSHAKE RESPONSE SCHEMA
// ============================================================================
/**
 * ACP handshake response field definitions
 */
exports.ACP_HANDSHAKE_RESPONSE_FIELDS = {
    requestId: {
        type: "string",
        required: true,
        description: "Request ID matching the handshake request",
    },
    status: {
        type: "enum",
        required: true,
        description: "Whether request was accepted, rejected, or partially accepted",
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
};
// ============================================================================
// EXECUTION PLAN SCHEMA
// ============================================================================
/**
 * Execution plan field definitions
 */
exports.EXECUTION_PLAN_FIELDS = {
    mode: {
        type: "enum",
        required: true,
        description: "Collaboration mode for this execution",
        values: Object.values(atp_acp_js_1.CollaborationMode),
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
};
/**
 * Execution step field definitions
 */
exports.EXECUTION_STEP_FIELDS = {
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
};
// ============================================================================
// COLLABORATION MODE SPECIFICATIONS
// ============================================================================
/**
 * Collaboration mode specifications
 */
exports.COLLABORATION_MODES = {
    SEQUENTIAL: {
        name: "sequential",
        description: "Models process one after another, each building on previous output",
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
        description: "Multiple models process independently, outputs combined via voting/averaging",
        characteristics: {
            parallelism: "full",
            state: "independent",
            latency: "max",
            cost: "cumulative",
            use_case: "High-stakes decisions requiring consensus",
        },
    },
};
// ============================================================================
// AGGREGATION STRATEGIES
// ============================================================================
/**
 * Aggregation strategy specifications
 */
exports.AGGREGATION_STRATEGIES = {
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
};
/**
 * Validate ACP handshake request
 *
 * @param handshake - Handshake request to validate
 * @returns Validation result
 */
function validateACPHandshake(handshake) {
    var _a, _b;
    var errors = [];
    var warnings = [];
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
    var h = handshake;
    // Validate id
    if (!h.id || typeof h.id !== "string") {
        errors.push({
            field: "id",
            message: "ID is required and must be a string",
            code: "REQUIRED_FIELD_MISSING",
        });
    }
    else if (!h.id.startsWith("acp-")) {
        errors.push({
            field: "id",
            message: 'ID must start with "acp-"',
            code: "INVALID_FORMAT",
            expected: "acp-*",
            actual: h.id,
        });
    }
    else if (h.id.length < 5 || h.id.length > 256) {
        errors.push({
            field: "id",
            message: "ID length must be between 5 and 256 characters",
            code: "INVALID_LENGTH",
            expected: "5-256 characters",
            actual: "".concat(h.id.length, " characters"),
        });
    }
    // Validate query
    if (!h.query || typeof h.query !== "string") {
        errors.push({
            field: "query",
            message: "Query is required and must be a string",
            code: "REQUIRED_FIELD_MISSING",
        });
    }
    else if (h.query.length < 1 || h.query.length > 10000) {
        errors.push({
            field: "query",
            message: "Query length must be between 1 and 10000 characters",
            code: "INVALID_LENGTH",
            expected: "1-10000 characters",
            actual: "".concat(h.query.length, " characters"),
        });
    }
    // Validate intent
    if (!h.intent ||
        !Object.values(atp_acp_js_1.IntentCategory).includes(h.intent)) {
        errors.push({
            field: "intent",
            message: "Intent must be one of: ".concat(Object.values(atp_acp_js_1.IntentCategory).join(", ")),
            code: "INVALID_ENUM_VALUE",
            expected: Object.values(atp_acp_js_1.IntentCategory).join(" | "),
            actual: String((_a = h.intent) !== null && _a !== void 0 ? _a : "undefined"),
        });
    }
    // Validate collaborationMode
    if (!h.collaborationMode ||
        !Object.values(atp_acp_js_1.CollaborationMode).includes(h.collaborationMode)) {
        errors.push({
            field: "collaborationMode",
            message: "Collaboration mode must be one of: ".concat(Object.values(atp_acp_js_1.CollaborationMode).join(", ")),
            code: "INVALID_ENUM_VALUE",
            expected: Object.values(atp_acp_js_1.CollaborationMode).join(" | "),
            actual: String((_b = h.collaborationMode) !== null && _b !== void 0 ? _b : "undefined"),
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
    }
    else if (h.models.length === 0) {
        errors.push({
            field: "models",
            message: "Models array cannot be empty",
            code: "INVALID_ARRAY_LENGTH",
        });
    }
    else if (h.models.length > 10) {
        errors.push({
            field: "models",
            message: "Models array cannot exceed 10 models",
            code: "INVALID_ARRAY_LENGTH",
            expected: "<= 10",
            actual: "".concat(h.models.length),
        });
    }
    else {
        // Validate each model
        for (var i = 0; i < h.models.length; i++) {
            var model = h.models[i];
            if (typeof model !== "string" || model.trim().length === 0) {
                errors.push({
                    field: "models[".concat(i, "]"),
                    message: "Model at index ".concat(i, " must be a non-empty string"),
                    code: "INVALID_TYPE",
                    expected: "non-empty string",
                    actual: typeof model,
                });
            }
        }
    }
    // Validate preferences
    if (!h.preferences ||
        typeof h.preferences !== "object" ||
        Array.isArray(h.preferences)) {
        errors.push({
            field: "preferences",
            message: "Preferences must be an object",
            code: "INVALID_TYPE",
            expected: "object",
            actual: h.preferences === undefined
                ? "undefined"
                : Array.isArray(h.preferences)
                    ? "array"
                    : typeof h.preferences,
        });
    }
    else if (h.preferences !== null) {
        var prefs = h.preferences;
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
            }
            else if (prefs.maxLatency < 0 || prefs.maxLatency > 600000) {
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
            }
            else if (prefs.maxCost < 0 || prefs.maxCost > 1000) {
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
            }
            else if (prefs.minQuality < 0 || prefs.minQuality > 1) {
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
        if (prefs.priority !== undefined &&
            !Object.values(atp_acp_js_1.Urgency).includes(prefs.priority)) {
            errors.push({
                field: "preferences.priority",
                message: "Priority must be one of: ".concat(Object.values(atp_acp_js_1.Urgency).join(", ")),
                code: "INVALID_ENUM_VALUE",
                expected: Object.values(atp_acp_js_1.Urgency).join(" | "),
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
    }
    else if (h.timestamp < 0) {
        errors.push({
            field: "timestamp",
            message: "Timestamp cannot be negative",
            code: "VALUE_OUT_OF_RANGE",
            expected: ">= 0",
            actual: String(h.timestamp),
        });
    }
    else if (h.timestamp > Date.now() + 60000) {
        warnings.push({
            field: "timestamp",
            message: "Timestamp is significantly in the future (clock skew?)",
            code: "UNUSUAL_VALUE",
        });
    }
    return {
        valid: errors.length === 0,
        errors: errors,
        warnings: warnings,
    };
}
/**
 * Validate ACP handshake response
 *
 * @param response - Handshake response to validate
 * @returns Validation result
 */
function validateACPHandshakeResponse(response) {
    var _a;
    var errors = [];
    var warnings = [];
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
    var r = response;
    // Validate requestId
    if (!r.requestId || typeof r.requestId !== "string") {
        errors.push({
            field: "requestId",
            message: "Request ID is required and must be a string",
            code: "REQUIRED_FIELD_MISSING",
        });
    }
    // Validate status
    if (!r.status ||
        !["accepted", "rejected", "partial"].includes(r.status)) {
        errors.push({
            field: "status",
            message: "Status must be one of: accepted, rejected, partial",
            code: "INVALID_ENUM_VALUE",
            expected: "accepted | rejected | partial",
            actual: String((_a = r.status) !== null && _a !== void 0 ? _a : "undefined"),
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
    }
    else if (r.selectedModels.length > 10) {
        errors.push({
            field: "selectedModels",
            message: "Selected models cannot exceed 10",
            code: "INVALID_ARRAY_LENGTH",
            expected: "<= 10",
            actual: "".concat(r.selectedModels.length),
        });
    }
    // Validate executionPlan
    if (!r.executionPlan ||
        typeof r.executionPlan !== "object" ||
        Array.isArray(r.executionPlan)) {
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
    }
    else if (r.estimatedLatency < 0) {
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
    }
    else if (r.estimatedCost < 0) {
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
        errors: errors,
        warnings: warnings,
    };
}
// ============================================================================
// PROTOCOL SPECIFICATION
// ============================================================================
/**
 * Complete ACP protocol specification for compliance checking
 */
exports.ACP_SCHEMA = {
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
                values: Object.values(atp_acp_js_1.CollaborationMode).reduce(function (acc, val) {
                    acc[val] = val;
                    return acc;
                }, {}),
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
                    check: function (ctx) { return typeof ctx.parameters.request === "object"; },
                },
                {
                    description: "Models array is not empty",
                    check: function (ctx) {
                        var req = ctx.parameters.request;
                        return (Array.isArray(req.models) &&
                            req.models.length > 0);
                    },
                },
            ],
            postconditions: [
                {
                    description: "Validation result is returned",
                    check: function (ctx) { return ctx.result !== undefined; },
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
                    check: function (ctx) { return ctx.parameters.valid === true; },
                },
                {
                    description: "At least one model is available",
                    check: function (ctx) {
                        return ctx.parameters.availableModels.length > 0;
                    },
                },
            ],
            postconditions: [
                {
                    description: "Execution plan is created",
                    check: function (ctx) { return ctx.result !== undefined; },
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
                check: function (ctx) {
                    var models = ctx.parameters.models;
                    return models.length <= 10;
                },
                violation_message: "Cannot use more than 10 models in a single collaboration",
            },
            severity: "error",
        },
        {
            name: "compatible_aggregation",
            type: "custom",
            rule: {
                check: function (ctx) {
                    var _a;
                    var _b, _c;
                    var mode = ctx.parameters.collaborationMode;
                    var strategy = ctx.parameters.aggregationStrategy;
                    // Verify aggregation strategy is compatible with collaboration mode
                    var validCombinations = (_a = {},
                        _a[atp_acp_js_1.CollaborationMode.SEQUENTIAL] = ["last", "concatenate", "all"],
                        _a[atp_acp_js_1.CollaborationMode.PARALLEL] = [
                            "first",
                            "best",
                            "weighted_average",
                            "concatenate",
                            "all",
                        ],
                        _a[atp_acp_js_1.CollaborationMode.CASCADE] = ["last", "concatenate", "all"],
                        _a[atp_acp_js_1.CollaborationMode.ENSEMBLE] = [
                            "majority_vote",
                            "weighted_average",
                            "best",
                            "concatenate",
                            "all",
                        ],
                        _a);
                    return (_c = (_b = validCombinations[mode]) === null || _b === void 0 ? void 0 : _b.includes(strategy)) !== null && _c !== void 0 ? _c : false;
                },
                violation_message: "Aggregation strategy is not compatible with collaboration mode",
            },
            severity: "error",
        },
        {
            name: "reasonable_latency",
            type: "custom",
            rule: {
                check: function (ctx) {
                    var latency = ctx.parameters.maxLatency;
                    if (latency === undefined)
                        return true;
                    return latency >= 1000 && latency <= 600000; // 1 second to 10 minutes
                },
                violation_message: "Max latency must be between 1 second and 10 minutes",
            },
            severity: "warning",
        },
    ],
    documentation_url: "https://docs.aequor.ai/protocols/acp",
};

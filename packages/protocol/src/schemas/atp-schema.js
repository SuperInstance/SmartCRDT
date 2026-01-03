"use strict";
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ATP_SCHEMA = exports.ATP_ERROR_HANDLING = exports.ATP_FLOW_CONTROL = exports.ATP_RESPONSE_SCHEMA = exports.ATP_FOOTER_SCHEMA = exports.ATP_HEADER_SCHEMA = exports.ATP_PACKET_FIELDS = void 0;
exports.validateATPacket = validateATPacket;
exports.validateATPResponse = validateATPResponse;
var atp_acp_js_1 = require("../atp-acp.js");
// ============================================================================
// ATP PACKET SCHEMA
// ============================================================================
/**
 * ATP packet field definitions
 */
exports.ATP_PACKET_FIELDS = {
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
        values: Object.values(atp_acp_js_1.IntentCategory),
    },
    urgency: {
        type: "enum",
        required: true,
        description: "Urgency level affecting processing priority",
        values: Object.values(atp_acp_js_1.Urgency),
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
};
// ============================================================================
// ATP HEADER SCHEMA
// ============================================================================
/**
 * ATP wire format header schema
 */
exports.ATP_HEADER_SCHEMA = {
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
};
// ============================================================================
// ATP FOOTER SCHEMA
// ============================================================================
/**
 * ATP wire format footer schema
 */
exports.ATP_FOOTER_SCHEMA = {
    checksum: {
        type: "number",
        required: true,
        description: "CRC32 checksum of body",
        validation: {
            min: 0,
            max: 0xffffffff,
        },
    },
};
// ============================================================================
// ATP RESPONSE SCHEMA
// ============================================================================
/**
 * ATP response schema
 */
exports.ATP_RESPONSE_SCHEMA = {
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
};
// ============================================================================
// FLOW CONTROL SPECIFICATION
// ============================================================================
/**
 * ATP flow control constraints
 */
exports.ATP_FLOW_CONTROL = {
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
};
// ============================================================================
// ERROR HANDLING SPECIFICATION
// ============================================================================
/**
 * ATP error handling specification
 */
exports.ATP_ERROR_HANDLING = {
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
};
// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================
/**
 * Validate ATP packet
 *
 * @param packet - Packet to validate
 * @returns Validation result
 */
function validateATPacket(packet) {
    var _a, _b;
    var errors = [];
    var warnings = [];
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
    var p = packet;
    // Validate id
    if (!p.id || typeof p.id !== "string") {
        errors.push({
            field: "id",
            message: "ID is required and must be a string",
            code: "REQUIRED_FIELD_MISSING",
        });
    }
    else if (p.id.length < 1 || p.id.length > 256) {
        errors.push({
            field: "id",
            message: "ID length must be between 1 and 256 characters",
            code: "INVALID_LENGTH",
            expected: "1-256 characters",
            actual: "".concat(p.id.length, " characters"),
        });
    }
    else if (!/^[a-zA-Z0-9-_]+$/.test(p.id)) {
        errors.push({
            field: "id",
            message: "ID contains invalid characters (only alphanumeric, hyphen, underscore allowed)",
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
    }
    else if (p.query.length < 1 || p.query.length > 10000) {
        errors.push({
            field: "query",
            message: "Query length must be between 1 and 10000 characters",
            code: "INVALID_LENGTH",
            expected: "1-10000 characters",
            actual: "".concat(p.query.length, " characters"),
        });
    }
    // Validate intent
    if (!p.intent ||
        !Object.values(atp_acp_js_1.IntentCategory).includes(p.intent)) {
        errors.push({
            field: "intent",
            message: "Intent must be one of: ".concat(Object.values(atp_acp_js_1.IntentCategory).join(", ")),
            code: "INVALID_ENUM_VALUE",
            expected: Object.values(atp_acp_js_1.IntentCategory).join(" | "),
            actual: String((_a = p.intent) !== null && _a !== void 0 ? _a : "undefined"),
        });
    }
    // Validate urgency
    if (!p.urgency || !Object.values(atp_acp_js_1.Urgency).includes(p.urgency)) {
        errors.push({
            field: "urgency",
            message: "Urgency must be one of: ".concat(Object.values(atp_acp_js_1.Urgency).join(", ")),
            code: "INVALID_ENUM_VALUE",
            expected: Object.values(atp_acp_js_1.Urgency).join(" | "),
            actual: String((_b = p.urgency) !== null && _b !== void 0 ? _b : "undefined"),
        });
    }
    // Validate timestamp
    if (typeof p.timestamp !== "number") {
        errors.push({
            field: "timestamp",
            message: "Timestamp is required and must be a number",
            code: "REQUIRED_FIELD_MISSING",
        });
    }
    else if (p.timestamp < 0) {
        errors.push({
            field: "timestamp",
            message: "Timestamp cannot be negative",
            code: "VALUE_OUT_OF_RANGE",
            expected: ">= 0",
            actual: String(p.timestamp),
        });
    }
    else if (p.timestamp > Date.now() + 60000) {
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
        }
        else if (p.context !== null) {
            var keyCount = Object.keys(p.context).length;
            if (keyCount > 100) {
                warnings.push({
                    field: "context",
                    message: "Context has many keys (".concat(keyCount, "), consider reducing"),
                    code: "LARGE_CONTEXT",
                });
            }
        }
    }
    return {
        valid: errors.length === 0,
        errors: errors,
        warnings: warnings,
    };
}
/**
 * Validate ATP response
 *
 * @param response - Response to validate
 * @returns Validation result
 */
function validateATPResponse(response) {
    var _a, _b;
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
    }
    else if (r.content.length > 100000) {
        errors.push({
            field: "content",
            message: "Content exceeds maximum length of 100000 characters",
            code: "INVALID_LENGTH",
            expected: "<= 100000 characters",
            actual: "".concat(r.content.length, " characters"),
        });
    }
    // Validate protocol
    if (r.protocol !== "ATP") {
        errors.push({
            field: "protocol",
            message: 'Protocol must be "ATP"',
            code: "INVALID_VALUE",
            expected: "ATP",
            actual: String((_a = r.protocol) !== null && _a !== void 0 ? _a : "undefined"),
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
    if (!r.backend ||
        !["local", "cloud", "hybrid"].includes(r.backend)) {
        errors.push({
            field: "backend",
            message: "Backend must be one of: local, cloud, hybrid",
            code: "INVALID_ENUM_VALUE",
            expected: "local | cloud | hybrid",
            actual: String((_b = r.backend) !== null && _b !== void 0 ? _b : "undefined"),
        });
    }
    // Validate confidence
    if (typeof r.confidence !== "number") {
        errors.push({
            field: "confidence",
            message: "Confidence is required and must be a number",
            code: "REQUIRED_FIELD_MISSING",
        });
    }
    else if (r.confidence < 0 || r.confidence > 1) {
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
    }
    else if (r.latency < 0) {
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
        errors: errors,
        warnings: warnings,
    };
}
// ============================================================================
// PROTOCOL SPECIFICATION
// ============================================================================
/**
 * Complete ATP protocol specification for compliance checking
 */
exports.ATP_SCHEMA = {
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
                values: Object.values(atp_acp_js_1.IntentCategory).reduce(function (acc, val) {
                    acc[val] = val;
                    return acc;
                }, {}),
            },
            required_properties: [],
            optional_properties: [],
        },
        {
            name: "Urgency",
            type: "enum",
            definition: {
                kind: "enum",
                values: Object.values(atp_acp_js_1.Urgency).reduce(function (acc, val) {
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
            name: "ATPRequest",
            direction: "request",
            request_type: "ATPacket",
            response_type: "AequorResponse",
            flow_control: {
                streaming: true,
                timeout: exports.ATP_FLOW_CONTROL.timeout.default,
                retry_policy: {
                    max_attempts: exports.ATP_FLOW_CONTROL.retry_policy.max_attempts.default,
                    backoff: exports.ATP_FLOW_CONTROL.retry_policy.backoff
                        .default,
                    initial_delay: exports.ATP_FLOW_CONTROL.retry_policy.initial_delay.default,
                    max_delay: exports.ATP_FLOW_CONTROL.retry_policy.max_delay.default,
                },
                rate_limit: {
                    max_requests: exports.ATP_FLOW_CONTROL.rate_limit.requests_per_minute,
                    window_ms: 60000,
                    burst: exports.ATP_FLOW_CONTROL.rate_limit.burst,
                },
            },
            error_handling: {
                retryable_errors: __spreadArray([], exports.ATP_ERROR_HANDLING.retryable_errors, true),
                non_retryable_errors: __spreadArray([], exports.ATP_ERROR_HANDLING.non_retryable_errors, true),
                fallback_strategy: exports.ATP_ERROR_HANDLING.fallback_strategy
                    .default,
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
                    check: function (ctx) { return typeof ctx.parameters.packet === "object"; },
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
            name: "process_packet",
            description: "Process ATP packet and generate response",
            preconditions: [
                {
                    description: "Packet is valid",
                    check: function (ctx) { return ctx.parameters.valid === true; },
                },
            ],
            postconditions: [
                {
                    description: "Response is generated",
                    check: function (ctx) { return ctx.result !== undefined; },
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
                check: function (ctx) {
                    var size = JSON.stringify(ctx.parameters).length;
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
                check: function (ctx) {
                    var timeout = ctx.parameters.timeout;
                    if (timeout === undefined)
                        return true;
                    return (timeout >= exports.ATP_FLOW_CONTROL.timeout.min &&
                        timeout <= exports.ATP_FLOW_CONTROL.timeout.max);
                },
                violation_message: "Timeout must be between ".concat(exports.ATP_FLOW_CONTROL.timeout.min, " and ").concat(exports.ATP_FLOW_CONTROL.timeout.max, "ms"),
            },
            severity: "error",
        },
    ],
    documentation_url: "https://docs.aequor.ai/protocols/atp",
};

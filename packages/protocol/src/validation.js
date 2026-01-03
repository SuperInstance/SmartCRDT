"use strict";
/**
 * Protocol Validation System for Aequor Cognitive Orchestration Platform
 *
 * This module provides comprehensive validation for ATP and ACP protocol packets.
 * It ensures that packets conform to protocol specifications before processing,
 * preventing invalid data from causing issues downstream.
 *
 * Validation includes:
 * - Required field presence
 * - Type checking
 * - Enum value validation
 * - Numeric range validation
 * - Timestamp reasonableness
 * - Array length validation
 * - String format validation
 *
 * Usage:
 * ```typescript
 * import { ProtocolValidator } from '@lsi/protocol';
 *
 * const validator = new ProtocolValidator();
 *
 * // Validate an ATPacket
 * const packetResult = validator.validateATPacket(packet);
 * if (!packetResult.valid) {
 *   console.error('Invalid packet:', packetResult.errors);
 * }
 *
 * // Validate an ACPHandshake
 * const handshakeResult = validator.validateACPHandshake(handshake);
 * if (!handshakeResult.valid) {
 *   console.error('Invalid handshake:', handshakeResult.errors);
 * }
 * ```
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProtocolValidator = exports.ValidationErrorCode = void 0;
exports.createValidationResult = createValidationResult;
exports.formatValidationErrors = formatValidationErrors;
var atp_acp_js_1 = require("./atp-acp.js");
/**
 * Default validation options
 */
var DEFAULT_OPTIONS = {
    allowFutureTimestamps: false,
    maxTimestampAge: 60 * 60 * 1000, // 1 hour
    maxStringLength: 10000,
    maxArrayLength: 100,
    strict: false,
};
/**
 * Error codes for validation failures
 *
 * Standardized error codes for programmatic error handling.
 */
var ValidationErrorCode;
(function (ValidationErrorCode) {
    /** Required field is missing */
    ValidationErrorCode["REQUIRED_FIELD_MISSING"] = "REQUIRED_FIELD_MISSING";
    /** Field has wrong type */
    ValidationErrorCode["INVALID_TYPE"] = "INVALID_TYPE";
    /** Enum value is not valid */
    ValidationErrorCode["INVALID_ENUM_VALUE"] = "INVALID_ENUM_VALUE";
    /** Number is outside valid range */
    ValidationErrorCode["VALUE_OUT_OF_RANGE"] = "VALUE_OUT_OF_RANGE";
    /** String is too long */
    ValidationErrorCode["STRING_TOO_LONG"] = "STRING_TOO_LONG";
    /** Array is too long or empty */
    ValidationErrorCode["INVALID_ARRAY_LENGTH"] = "INVALID_ARRAY_LENGTH";
    /** Timestamp is unreasonable */
    ValidationErrorCode["INVALID_TIMESTAMP"] = "INVALID_TIMESTAMP";
    /** String format is invalid */
    ValidationErrorCode["INVALID_FORMAT"] = "INVALID_FORMAT";
    /** Numeric value is not a number */
    ValidationErrorCode["NOT_A_NUMBER"] = "NOT_A_NUMBER";
})(ValidationErrorCode || (exports.ValidationErrorCode = ValidationErrorCode = {}));
/**
 * ProtocolValidator - Validate ATP and ACP protocol packets
 *
 * Provides comprehensive validation for all protocol packets to ensure
 * they conform to specifications before processing.
 */
var ProtocolValidator = /** @class */ (function () {
    function ProtocolValidator(options) {
        if (options === void 0) { options = {}; }
        this.options = __assign(__assign({}, DEFAULT_OPTIONS), options);
    }
    /**
     * Validate an ATPacket
     *
     * Checks all required fields, types, enum values, and ranges.
     *
     * @param packet - ATPacket to validate
     * @returns Validation result with errors and warnings
     *
     * @example
     * ```typescript
     * const validator = new ProtocolValidator();
     * const result = validator.validateATPacket({
     *   id: 'req-123',
     *   query: 'What is AI?',
     *   intent: IntentCategory.QUERY,
     *   urgency: Urgency.NORMAL,
     *   timestamp: Date.now()
     * });
     * if (!result.valid) {
     *   console.error('Validation failed:', result.errors);
     * }
     * ```
     */
    ProtocolValidator.prototype.validateATPacket = function (packet) {
        var _this = this;
        var errors = [];
        var warnings = [];
        // Check if packet is an object
        if (!packet || typeof packet !== "object" || Array.isArray(packet)) {
            return {
                valid: false,
                errors: [
                    {
                        field: "packet",
                        message: "Packet must be an object",
                        code: ValidationErrorCode.INVALID_TYPE,
                        expected: "object",
                        actual: Array.isArray(packet) ? "array" : typeof packet,
                    },
                ],
                warnings: [],
            };
        }
        var p = packet;
        // Validate required field: id
        this.validateField(p, "id", errors, function (value) {
            if (typeof value !== "string" || value.trim().length === 0) {
                errors.push({
                    field: "id",
                    message: "ID must be a non-empty string",
                    code: ValidationErrorCode.INVALID_TYPE,
                    expected: "non-empty string",
                    actual: typeof value,
                });
                return false;
            }
            return true;
        }, true // required
        );
        // Validate required field: query
        this.validateField(p, "query", errors, function (value) {
            if (typeof value !== "string") {
                errors.push({
                    field: "query",
                    message: "Query must be a string",
                    code: ValidationErrorCode.INVALID_TYPE,
                    expected: "string",
                    actual: typeof value,
                });
                return false;
            }
            if (value.trim().length === 0) {
                errors.push({
                    field: "query",
                    message: "Query cannot be empty",
                    code: ValidationErrorCode.INVALID_FORMAT,
                });
                return false;
            }
            if (value.length > _this.options.maxStringLength) {
                errors.push({
                    field: "query",
                    message: "Query exceeds maximum length of ".concat(_this.options.maxStringLength),
                    code: ValidationErrorCode.STRING_TOO_LONG,
                    expected: "<= ".concat(_this.options.maxStringLength, " characters"),
                    actual: "".concat(value.length, " characters"),
                });
                return false;
            }
            return true;
        }, true // required
        );
        // Validate required field: intent
        this.validateField(p, "intent", errors, function (value) {
            if (!Object.values(atp_acp_js_1.IntentCategory).includes(value)) {
                errors.push({
                    field: "intent",
                    message: "Intent must be one of: ".concat(Object.values(atp_acp_js_1.IntentCategory).join(", ")),
                    code: ValidationErrorCode.INVALID_ENUM_VALUE,
                    expected: Object.values(atp_acp_js_1.IntentCategory).join(" | "),
                    actual: String(value),
                });
                return false;
            }
            return true;
        }, true // required
        );
        // Validate required field: urgency
        this.validateField(p, "urgency", errors, function (value) {
            if (!Object.values(atp_acp_js_1.Urgency).includes(value)) {
                errors.push({
                    field: "urgency",
                    message: "Urgency must be one of: ".concat(Object.values(atp_acp_js_1.Urgency).join(", ")),
                    code: ValidationErrorCode.INVALID_ENUM_VALUE,
                    expected: Object.values(atp_acp_js_1.Urgency).join(" | "),
                    actual: String(value),
                });
                return false;
            }
            return true;
        }, true // required
        );
        // Validate required field: timestamp
        this.validateField(p, "timestamp", errors, function (value) {
            if (typeof value !== "number" || isNaN(value)) {
                errors.push({
                    field: "timestamp",
                    message: "Timestamp must be a valid number",
                    code: ValidationErrorCode.NOT_A_NUMBER,
                    expected: "number",
                    actual: typeof value,
                });
                return false;
            }
            var now = Date.now();
            // Check if timestamp is in the future
            if (!_this.options.allowFutureTimestamps && value > now) {
                errors.push({
                    field: "timestamp",
                    message: "Timestamp cannot be in the future (current: ".concat(now, ", provided: ").concat(value, ")"),
                    code: ValidationErrorCode.INVALID_TIMESTAMP,
                });
                return false;
            }
            // Check if timestamp is too old
            var age = now - value;
            if (age > _this.options.maxTimestampAge) {
                errors.push({
                    field: "timestamp",
                    message: "Timestamp is too old (age: ".concat(Math.round(age / 1000), "s, maximum: ").concat(_this.options.maxTimestampAge / 1000, "s)"),
                    code: ValidationErrorCode.INVALID_TIMESTAMP,
                });
                return false;
            }
            return true;
        }, true // required
        );
        // Validate optional field: context
        if (p.context !== undefined) {
            if (typeof p.context !== "object" || Array.isArray(p.context)) {
                errors.push({
                    field: "context",
                    message: "Context must be an object",
                    code: ValidationErrorCode.INVALID_TYPE,
                    expected: "object",
                    actual: Array.isArray(p.context) ? "array" : typeof p.context,
                });
            }
            else {
                // Check for reasonable context size
                var contextKeys = Object.keys(p.context);
                if (contextKeys.length > this.options.maxArrayLength) {
                    warnings.push({
                        field: "context",
                        message: "Context has many keys (".concat(contextKeys.length, "), consider reducing"),
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
    };
    /**
     * Validate an ACPHandshakeRequest
     *
     * Checks all required fields, types, enum values, ranges, and arrays.
     *
     * @param handshake - ACPHandshakeRequest to validate
     * @returns Validation result with errors and warnings
     *
     * @example
     * ```typescript
     * const validator = new ProtocolValidator();
     * const result = validator.validateACPHandshake({
     *   id: 'acp-123',
     *   query: 'Design a secure system',
     *   intent: IntentCategory.CODE_GENERATION,
     *   collaborationMode: CollaborationMode.CASCADE,
     *   models: ['gpt-4', 'codellama'],
     *   preferences: { maxLatency: 2000 },
     *   timestamp: Date.now()
     * });
     * if (!result.valid) {
     *   console.error('Validation failed:', result.errors);
     * }
     * ```
     */
    ProtocolValidator.prototype.validateACPHandshake = function (handshake) {
        var _this = this;
        var errors = [];
        var warnings = [];
        // Check if handshake is an object
        if (!handshake ||
            typeof handshake !== "object" ||
            Array.isArray(handshake)) {
            return {
                valid: false,
                errors: [
                    {
                        field: "handshake",
                        message: "Handshake must be an object",
                        code: ValidationErrorCode.INVALID_TYPE,
                        expected: "object",
                        actual: Array.isArray(handshake) ? "array" : typeof handshake,
                    },
                ],
                warnings: [],
            };
        }
        var h = handshake;
        // Validate required field: id
        this.validateField(h, "id", errors, function (value) {
            if (typeof value !== "string" || value.trim().length === 0) {
                errors.push({
                    field: "id",
                    message: "ID must be a non-empty string",
                    code: ValidationErrorCode.INVALID_TYPE,
                    expected: "non-empty string",
                    actual: typeof value,
                });
                return false;
            }
            return true;
        }, true // required
        );
        // Validate required field: query
        this.validateField(h, "query", errors, function (value) {
            if (typeof value !== "string") {
                errors.push({
                    field: "query",
                    message: "Query must be a string",
                    code: ValidationErrorCode.INVALID_TYPE,
                    expected: "string",
                    actual: typeof value,
                });
                return false;
            }
            if (value.trim().length === 0) {
                errors.push({
                    field: "query",
                    message: "Query cannot be empty",
                    code: ValidationErrorCode.INVALID_FORMAT,
                });
                return false;
            }
            if (value.length > _this.options.maxStringLength) {
                errors.push({
                    field: "query",
                    message: "Query exceeds maximum length of ".concat(_this.options.maxStringLength),
                    code: ValidationErrorCode.STRING_TOO_LONG,
                    expected: "<= ".concat(_this.options.maxStringLength, " characters"),
                    actual: "".concat(value.length, " characters"),
                });
                return false;
            }
            return true;
        }, true // required
        );
        // Validate required field: intent
        this.validateField(h, "intent", errors, function (value) {
            if (!Object.values(atp_acp_js_1.IntentCategory).includes(value)) {
                errors.push({
                    field: "intent",
                    message: "Intent must be one of: ".concat(Object.values(atp_acp_js_1.IntentCategory).join(", ")),
                    code: ValidationErrorCode.INVALID_ENUM_VALUE,
                    expected: Object.values(atp_acp_js_1.IntentCategory).join(" | "),
                    actual: String(value),
                });
                return false;
            }
            return true;
        }, true // required
        );
        // Validate required field: collaborationMode
        this.validateField(h, "collaborationMode", errors, function (value) {
            if (!Object.values(atp_acp_js_1.CollaborationMode).includes(value)) {
                errors.push({
                    field: "collaborationMode",
                    message: "Collaboration mode must be one of: ".concat(Object.values(atp_acp_js_1.CollaborationMode).join(", ")),
                    code: ValidationErrorCode.INVALID_ENUM_VALUE,
                    expected: Object.values(atp_acp_js_1.CollaborationMode).join(" | "),
                    actual: String(value),
                });
                return false;
            }
            return true;
        }, true // required
        );
        // Validate required field: models
        this.validateField(h, "models", errors, function (value) {
            if (!Array.isArray(value)) {
                errors.push({
                    field: "models",
                    message: "Models must be an array",
                    code: ValidationErrorCode.INVALID_TYPE,
                    expected: "array",
                    actual: typeof value,
                });
                return false;
            }
            if (value.length === 0) {
                errors.push({
                    field: "models",
                    message: "Models array cannot be empty",
                    code: ValidationErrorCode.INVALID_ARRAY_LENGTH,
                });
                return false;
            }
            if (value.length > _this.options.maxArrayLength) {
                errors.push({
                    field: "models",
                    message: "Models array exceeds maximum length of ".concat(_this.options.maxArrayLength),
                    code: ValidationErrorCode.INVALID_ARRAY_LENGTH,
                    expected: "<= ".concat(_this.options.maxArrayLength),
                    actual: "".concat(value.length),
                });
                return false;
            }
            // Validate each model is a non-empty string
            for (var i = 0; i < value.length; i++) {
                var model = value[i];
                if (typeof model !== "string" || model.trim().length === 0) {
                    errors.push({
                        field: "models[".concat(i, "]"),
                        message: "Model at index ".concat(i, " must be a non-empty string"),
                        code: ValidationErrorCode.INVALID_TYPE,
                        expected: "non-empty string",
                        actual: typeof model,
                    });
                }
            }
            return value.length > 0;
        }, true // required
        );
        // Validate required field: timestamp
        this.validateField(h, "timestamp", errors, function (value) {
            if (typeof value !== "number" || isNaN(value)) {
                errors.push({
                    field: "timestamp",
                    message: "Timestamp must be a valid number",
                    code: ValidationErrorCode.NOT_A_NUMBER,
                    expected: "number",
                    actual: typeof value,
                });
                return false;
            }
            var now = Date.now();
            // Check if timestamp is in the future
            if (!_this.options.allowFutureTimestamps && value > now) {
                errors.push({
                    field: "timestamp",
                    message: "Timestamp cannot be in the future (current: ".concat(now, ", provided: ").concat(value, ")"),
                    code: ValidationErrorCode.INVALID_TIMESTAMP,
                });
                return false;
            }
            // Check if timestamp is too old
            var age = now - value;
            if (age > _this.options.maxTimestampAge) {
                errors.push({
                    field: "timestamp",
                    message: "Timestamp is too old (age: ".concat(Math.round(age / 1000), "s, maximum: ").concat(_this.options.maxTimestampAge / 1000, "s)"),
                    code: ValidationErrorCode.INVALID_TIMESTAMP,
                });
                return false;
            }
            return true;
        }, true // required
        );
        // Validate required field: preferences
        this.validateField(h, "preferences", errors, function (value) {
            if (typeof value !== "object" || Array.isArray(value)) {
                errors.push({
                    field: "preferences",
                    message: "Preferences must be an object",
                    code: ValidationErrorCode.INVALID_TYPE,
                    expected: "object",
                    actual: Array.isArray(value) ? "array" : typeof value,
                });
                return false;
            }
            var prefs = value;
            // Validate maxLatency if present
            if (prefs.maxLatency !== undefined) {
                if (typeof prefs.maxLatency !== "number" || isNaN(prefs.maxLatency)) {
                    errors.push({
                        field: "preferences.maxLatency",
                        message: "maxLatency must be a valid number",
                        code: ValidationErrorCode.NOT_A_NUMBER,
                        expected: "number",
                        actual: typeof prefs.maxLatency,
                    });
                }
                else if (prefs.maxLatency < 0) {
                    errors.push({
                        field: "preferences.maxLatency",
                        message: "maxLatency must be non-negative",
                        code: ValidationErrorCode.VALUE_OUT_OF_RANGE,
                        expected: ">= 0",
                        actual: String(prefs.maxLatency),
                    });
                }
            }
            // Validate maxCost if present
            if (prefs.maxCost !== undefined) {
                if (typeof prefs.maxCost !== "number" || isNaN(prefs.maxCost)) {
                    errors.push({
                        field: "preferences.maxCost",
                        message: "maxCost must be a valid number",
                        code: ValidationErrorCode.NOT_A_NUMBER,
                        expected: "number",
                        actual: typeof prefs.maxCost,
                    });
                }
                else if (prefs.maxCost < 0) {
                    errors.push({
                        field: "preferences.maxCost",
                        message: "maxCost must be non-negative",
                        code: ValidationErrorCode.VALUE_OUT_OF_RANGE,
                        expected: ">= 0",
                        actual: String(prefs.maxCost),
                    });
                }
            }
            // Validate minQuality if present
            if (prefs.minQuality !== undefined) {
                if (typeof prefs.minQuality !== "number" || isNaN(prefs.minQuality)) {
                    errors.push({
                        field: "preferences.minQuality",
                        message: "minQuality must be a valid number",
                        code: ValidationErrorCode.NOT_A_NUMBER,
                        expected: "number",
                        actual: typeof prefs.minQuality,
                    });
                }
                else if (prefs.minQuality < 0 || prefs.minQuality > 1) {
                    errors.push({
                        field: "preferences.minQuality",
                        message: "minQuality must be between 0 and 1",
                        code: ValidationErrorCode.VALUE_OUT_OF_RANGE,
                        expected: "0 <= x <= 1",
                        actual: String(prefs.minQuality),
                    });
                }
            }
            // Validate priority if present
            if (prefs.priority !== undefined) {
                if (!Object.values(atp_acp_js_1.Urgency).includes(prefs.priority)) {
                    errors.push({
                        field: "preferences.priority",
                        message: "Priority must be one of: ".concat(Object.values(atp_acp_js_1.Urgency).join(", ")),
                        code: ValidationErrorCode.INVALID_ENUM_VALUE,
                        expected: Object.values(atp_acp_js_1.Urgency).join(" | "),
                        actual: String(prefs.priority),
                    });
                }
            }
            return true;
        }, true // required
        );
        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings,
        };
    };
    /**
     * Helper method to validate a field
     *
     * Checks if field exists (if required) and runs validation function.
     *
     * @param obj - Object containing the field
     * @param fieldName - Name of the field to validate
     * @param errors - Array to collect errors
     * @param validate - Validation function
     * @param required - Whether field is required
     *
     * @private
     */
    ProtocolValidator.prototype.validateField = function (obj, fieldName, errors, validate, required) {
        var value = obj[fieldName];
        // Check if field is missing
        if (value === undefined) {
            if (required) {
                errors.push({
                    field: fieldName,
                    message: "Required field '".concat(fieldName, "' is missing"),
                    code: ValidationErrorCode.REQUIRED_FIELD_MISSING,
                });
            }
            return;
        }
        // Run validation
        validate(value);
    };
    /**
     * Update validation options
     *
     * Allows changing validation behavior after instantiation.
     *
     * @param options - New validation options
     *
     * @example
     * ```typescript
     * const validator = new ProtocolValidator();
     * validator.setOptions({ maxStringLength: 5000 });
     * ```
     */
    ProtocolValidator.prototype.setOptions = function (options) {
        this.options = __assign(__assign({}, this.options), options);
    };
    /**
     * Get current validation options
     *
     * @returns Current validation options
     */
    ProtocolValidator.prototype.getOptions = function () {
        return __assign({}, this.options);
    };
    return ProtocolValidator;
}());
exports.ProtocolValidator = ProtocolValidator;
/**
 * Create a validation result from errors
 *
 * Helper function to create a ValidationResult object.
 *
 * @param errors - Array of validation errors
 * @param warnings - Optional array of validation warnings
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = createValidationResult(
 *   [{ field: 'id', message: 'ID is required', code: 'REQUIRED_FIELD_MISSING' }],
 *   [{ field: 'context', message: 'Context is large', code: 'LARGE_CONTEXT' }]
 * );
 * ```
 */
function createValidationResult(errors, warnings) {
    if (warnings === void 0) { warnings = []; }
    return {
        valid: errors.length === 0,
        errors: errors,
        warnings: warnings,
    };
}
/**
 * Format validation errors as a human-readable string
 *
 * @param result - Validation result to format
 * @returns Formatted error string
 *
 * @example
 * ```typescript
 * const result = validator.validateATPacket(packet);
 * if (!result.valid) {
 *   console.error(formatValidationErrors(result));
 * }
 * ```
 */
function formatValidationErrors(result) {
    if (result.valid) {
        return "Validation passed";
    }
    var errorLines = result.errors.map(function (e) { return "  - ".concat(e.field, ": ").concat(e.message, " (").concat(e.code, ")"); });
    var warningLines = result.warnings.map(function (w) { return "  - ".concat(w.field, ": ").concat(w.message, " (").concat(w.code, ")"); });
    var output = "Validation failed with ".concat(result.errors.length, " error(s):\n").concat(errorLines.join("\n"));
    if (result.warnings.length > 0) {
        output += "\n\nWarnings:\n".concat(warningLines.join("\n"));
    }
    return output;
}

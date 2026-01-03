"use strict";
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
exports.ProtocolValidator = exports.ValidationErrorCode = void 0;
exports.createValidationResult = createValidationResult;
exports.createValidationFailure = createValidationFailure;
exports.formatValidationErrors = formatValidationErrors;
// ============================================================================
// ERROR CODES
// ============================================================================
/**
 * Validation error codes for programmatic error handling
 */
var ValidationErrorCode;
(function (ValidationErrorCode) {
    // General errors
    ValidationErrorCode["UNKNOWN"] = "UNKNOWN";
    ValidationErrorCode["INVALID_TYPE"] = "INVALID_TYPE";
    ValidationErrorCode["MISSING_REQUIRED_FIELD"] = "MISSING_REQUIRED_FIELD";
    ValidationErrorCode["INVALID_VALUE"] = "INVALID_VALUE";
    ValidationErrorCode["INVALID_FORMAT"] = "INVALID_FORMAT";
    // ATP-specific errors
    ValidationErrorCode["ATP_INVALID_PACKET"] = "ATP_INVALID_PACKET";
    ValidationErrorCode["ATP_INVALID_HEADER"] = "ATP_INVALID_HEADER";
    ValidationErrorCode["ATP_INVALID_FOOTER"] = "ATP_INVALID_FOOTER";
    ValidationErrorCode["ATP_INVALID_BODY"] = "ATP_INVALID_BODY";
    ValidationErrorCode["ATP_INVALID_MAGIC"] = "ATP_INVALID_MAGIC";
    ValidationErrorCode["ATP_CHECKSUM_MISMATCH"] = "ATP_CHECKSUM_MISMATCH";
    // ACP-specific errors
    ValidationErrorCode["ACP_INVALID_HANDSHAKE"] = "ACP_INVALID_HANDSHAKE";
    ValidationErrorCode["ACP_INVALID_MODE"] = "ACP_INVALID_MODE";
    ValidationErrorCode["ACP_INVALID_STRATEGY"] = "ACP_INVALID_STRATEGY";
    ValidationErrorCode["ACP_INVALID_PLAN"] = "ACP_INVALID_PLAN";
    // Cartridge-specific errors
    ValidationErrorCode["CARTRIDGE_INVALID_MANIFEST"] = "CARTRIDGE_INVALID_MANIFEST";
    ValidationErrorCode["CARTRIDGE_INVALID_VERSION"] = "CARTRIDGE_INVALID_VERSION";
    ValidationErrorCode["CARTRIDGE_INVALID_CAPABILITIES"] = "CARTRIDGE_INVALID_CAPABILITIES";
    ValidationErrorCode["CARTRIDGE_DEPENDENCY_ERROR"] = "CARTRIDGE_DEPENDENCY_ERROR";
    ValidationErrorCode["CARTRIDGE_STATE_ERROR"] = "CARTRIDGE_STATE_ERROR";
    // Rollback-specific errors
    ValidationErrorCode["ROLLBACK_INVALID_REQUEST"] = "ROLLBACK_INVALID_REQUEST";
    ValidationErrorCode["ROLLBACK_INVALID_SCOPE"] = "ROLLBACK_INVALID_SCOPE";
    ValidationErrorCode["ROLLBACK_INVALID_STRATEGY"] = "ROLLBACK_INVALID_STRATEGY";
    ValidationErrorCode["ROLLBACK_INVALID_STATUS"] = "ROLLBACK_INVALID_STATUS";
    ValidationErrorCode["ROLLBACK_INVALID_CONSENSUS"] = "ROLLBACK_INVALID_CONSENSUS";
    // Hypothesis-specific errors
    ValidationErrorCode["HYPOTHESIS_INVALID_PACKET"] = "HYPOTHESIS_INVALID_PACKET";
    ValidationErrorCode["HYPOTHESIS_INVALID_TYPE"] = "HYPOTHESIS_INVALID_TYPE";
    ValidationErrorCode["HYPOTHESIS_INVALID_SCOPE"] = "HYPOTHESIS_INVALID_SCOPE";
    ValidationErrorCode["HYPOTHESIS_INVALID_TESTING"] = "HYPOTHESIS_INVALID_TESTING";
    // Version negotiation errors
    ValidationErrorCode["VERSION_INVALID_FORMAT"] = "VERSION_INVALID_FORMAT";
    ValidationErrorCode["VERSION_INCOMPATIBLE"] = "VERSION_INCOMPATIBLE";
    ValidationErrorCode["VERSION_MISMATCH"] = "VERSION_MISMATCH";
    ValidationErrorCode["VERSION_NEGOTIATION_FAILED"] = "VERSION_NEGOTIATION_FAILED";
    // Cross-protocol errors
    ValidationErrorCode["CROSS_PROTOCOL_INCOMPATIBLE"] = "CROSS_PROTOCOL_INCOMPATIBLE";
    ValidationErrorCode["CROSS_PROTOCOL_DEPENDENCY"] = "CROSS_PROTOCOL_DEPENDENCY";
    ValidationErrorCode["CROSS_PROTOCOL_SEQUENCE"] = "CROSS_PROTOCOL_SEQUENCE";
    ValidationErrorCode["CROSS_PROTOCOL_DATA_FLOW"] = "CROSS_PROTOCOL_DATA_FLOW";
    // Extension errors
    ValidationErrorCode["EXTENSION_INVALID"] = "EXTENSION_INVALID";
    ValidationErrorCode["EXTENSION_LOAD_FAILED"] = "EXTENSION_LOAD_FAILED";
    ValidationErrorCode["EXTENSION_VALIDATION_FAILED"] = "EXTENSION_VALIDATION_FAILED";
})(ValidationErrorCode || (exports.ValidationErrorCode = ValidationErrorCode = {}));
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
var ProtocolValidator = /** @class */ (function () {
    function ProtocolValidator(options) {
        // Options stored for future use
        options === null || options === void 0 ? void 0 : options.strictMode;
        options === null || options === void 0 ? void 0 : options.allowUnknownFields;
    }
    // ========================================================================
    // SINGLE PROTOCOL VALIDATION
    // ========================================================================
    /**
     * Validate ATP packet
     */
    ProtocolValidator.prototype.validateATPacket = function (packet) {
        var errors = [];
        var warnings = [];
        if (!packet || typeof packet !== "object") {
            return {
                valid: false,
                errors: [
                    this.createError(ValidationErrorCode.INVALID_TYPE, "ATPacket must be an object", ""),
                ],
                warnings: [],
            };
        }
        var p = packet;
        // Required fields
        this.requireString(p, "id", errors);
        this.requireString(p, "query", errors);
        this.requireString(p, "intent", errors);
        this.requireString(p, "urgency", errors);
        this.requireNumber(p, "timestamp", errors);
        // Optional fields with validation
        if (p.context !== undefined) {
            if (typeof p.context !== "object" || p.context === null) {
                errors.push(this.createError(ValidationErrorCode.INVALID_TYPE, "context must be an object", "context"));
            }
        }
        // Validate intent enum
        if (typeof p.intent === "string") {
            var validIntents = [
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
                errors.push(this.createError(ValidationErrorCode.INVALID_VALUE, "Invalid intent: ".concat(p.intent), "intent"));
            }
        }
        // Validate urgency enum
        if (typeof p.urgency === "string") {
            var validUrgency = ["low", "normal", "high", "critical"];
            if (!validUrgency.includes(p.urgency)) {
                errors.push(this.createError(ValidationErrorCode.INVALID_VALUE, "Invalid urgency: ".concat(p.urgency), "urgency"));
            }
        }
        // Validate timestamp
        if (typeof p.timestamp === "number") {
            var now = Date.now();
            var maxFuture = 60000; // 1 minute in the future
            var maxPast = 86400000 * 365; // 1 year in the past
            if (p.timestamp > now + maxFuture) {
                warnings.push(this.createWarning("Timestamp is too far in the future", "timestamp"));
            }
            if (p.timestamp < now - maxPast) {
                warnings.push(this.createWarning("Timestamp is too far in the past", "timestamp"));
            }
        }
        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings,
            protocolVersion: "1.0.0",
        };
    };
    /**
     * Validate ACP handshake
     */
    ProtocolValidator.prototype.validateACPHandshake = function (handshake) {
        var _this = this;
        var errors = [];
        var warnings = [];
        if (!handshake || typeof handshake !== "object") {
            return {
                valid: false,
                errors: [
                    this.createError(ValidationErrorCode.INVALID_TYPE, "ACPHandshake must be an object", ""),
                ],
                warnings: [],
            };
        }
        var h = handshake;
        // Required fields
        this.requireString(h, "requestId", errors);
        this.requireString(h, "mode", errors);
        // Validate mode
        if (typeof h.mode === "string") {
            var validModes = ["sequential", "parallel", "cascade", "ensemble"];
            if (!validModes.includes(h.mode)) {
                errors.push(this.createError(ValidationErrorCode.ACP_INVALID_MODE, "Invalid mode: ".concat(h.mode), "mode"));
            }
        }
        // Validate queries array
        if (h.queries !== undefined) {
            if (!Array.isArray(h.queries)) {
                errors.push(this.createError(ValidationErrorCode.INVALID_TYPE, "queries must be an array", "queries"));
            }
            else {
                h.queries.forEach(function (query, i) {
                    var queryResult = _this.validateATPacket(query);
                    if (!queryResult.valid) {
                        errors.push.apply(errors, queryResult.errors.map(function (e) { return (__assign(__assign({}, e), { field: "queries[".concat(i, "].").concat(e.field) })); }));
                    }
                });
            }
        }
        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings,
            protocolVersion: "1.0.0",
        };
    };
    /**
     * Validate cartridge manifest
     */
    ProtocolValidator.prototype.validateCartridge = function (manifest) {
        var errors = [];
        var warnings = [];
        if (!manifest || typeof manifest !== "object") {
            return {
                valid: false,
                errors: [
                    this.createError(ValidationErrorCode.CARTRIDGE_INVALID_MANIFEST, "CartridgeManifest must be an object", ""),
                ],
                warnings: [],
            };
        }
        var m = manifest;
        // Required fields
        this.requireString(m, "id", errors);
        this.requireString(m, "name", errors);
        this.requireString(m, "version", errors);
        // Validate version format (SemVer)
        if (typeof m.version === "string") {
            var semverRegex = /^\d+\.\d+\.\d+(-[0-9A-Za-z-]+)?(\+[0-9A-Za-z-]+)?$/;
            if (!semverRegex.test(m.version)) {
                errors.push(this.createError(ValidationErrorCode.CARTRIDGE_INVALID_VERSION, "Version must be in SemVer format (e.g., 1.0.0)", "version"));
            }
        }
        // Validate capabilities
        if (m.capabilities !== undefined) {
            if (typeof m.capabilities !== "object" || m.capabilities === null) {
                errors.push(this.createError(ValidationErrorCode.CARTRIDGE_INVALID_CAPABILITIES, "capabilities must be an object", "capabilities"));
            }
        }
        // Validate files array
        if (m.files !== undefined) {
            if (!Array.isArray(m.files)) {
                errors.push(this.createError(ValidationErrorCode.INVALID_TYPE, "files must be an array", "files"));
            }
        }
        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings,
            protocolVersion: "1.0.0",
        };
    };
    /**
     * Validate rollback request
     */
    ProtocolValidator.prototype.validateRollback = function (request) {
        var errors = [];
        var warnings = [];
        if (!request || typeof request !== "object") {
            return {
                valid: false,
                errors: [
                    this.createError(ValidationErrorCode.ROLLBACK_INVALID_REQUEST, "RollbackRequest must be an object", ""),
                ],
                warnings: [],
            };
        }
        var r = request;
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
            var validScopes = ["local", "cluster", "global"];
            if (!validScopes.includes(r.scope)) {
                errors.push(this.createError(ValidationErrorCode.ROLLBACK_INVALID_SCOPE, "Invalid scope: ".concat(r.scope), "scope"));
            }
        }
        // Validate targetComponent
        if (typeof r.targetComponent === "string") {
            var validComponents = [
                "adapter",
                "cartridge",
                "config",
                "model",
                "protocol",
            ];
            if (!validComponents.includes(r.targetComponent)) {
                errors.push(this.createError(ValidationErrorCode.INVALID_VALUE, "Invalid targetComponent: ".concat(r.targetComponent), "targetComponent"));
            }
        }
        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings,
            protocolVersion: "1.0.0",
        };
    };
    /**
     * Validate hypothesis packet
     */
    ProtocolValidator.prototype.validateHypothesis = function (packet) {
        var errors = [];
        var warnings = [];
        if (!packet || typeof packet !== "object") {
            return {
                valid: false,
                errors: [
                    this.createError(ValidationErrorCode.HYPOTHESIS_INVALID_PACKET, "HypothesisPacket must be an object", ""),
                ],
                warnings: [],
            };
        }
        var p = packet;
        // Required fields
        this.requireString(p, "hypothesisId", errors);
        this.requireString(p, "type", errors);
        this.requireString(p, "title", errors);
        this.requireNumber(p, "timestamp", errors);
        // Validate type
        if (typeof p.type === "string") {
            var validTypes = [
                "cache_optimization",
                "routing_rule",
                "privacy_threshold",
                "query_refinement",
                "adapter_config",
                "resource_allocation",
                "cartridge_selection",
            ];
            if (!validTypes.includes(p.type)) {
                errors.push(this.createError(ValidationErrorCode.HYPOTHESIS_INVALID_TYPE, "Invalid hypothesis type: ".concat(p.type), "type"));
            }
        }
        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings,
            protocolVersion: "1.0.0",
        };
    };
    /**
     * Validate version message
     */
    ProtocolValidator.prototype.validateVersion = function (message) {
        var errors = [];
        var warnings = [];
        if (!message || typeof message !== "object") {
            return {
                valid: false,
                errors: [
                    this.createError(ValidationErrorCode.VERSION_INVALID_FORMAT, "Version message must be an object", ""),
                ],
                warnings: [],
            };
        }
        var m = message;
        // Required fields
        this.requireString(m, "protocol", errors);
        this.requireString(m, "version", errors);
        // Validate version format
        if (typeof m.version === "string") {
            var semverRegex = /^\d+\.\d+\.\d+(-[0-9A-Za-z-]+)?(\+[0-9A-Za-z-]+)?$/;
            if (!semverRegex.test(m.version)) {
                errors.push(this.createError(ValidationErrorCode.VERSION_INVALID_FORMAT, "Version must be in SemVer format", "version"));
            }
        }
        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings,
            protocolVersion: "1.0.0",
        };
    };
    // ========================================================================
    // CROSS-PROTOCOL VALIDATION
    // ========================================================================
    /**
     * Validate protocol interaction
     *
     * Validates that data flows correctly between two protocols
     */
    ProtocolValidator.prototype.validateProtocolInteraction = function (source, target, data) {
        var _a;
        var errors = [];
        var warnings = [];
        // Validate that source protocol exists
        var validProtocols = [
            "atp",
            "acp",
            "cartridge",
            "rollback",
            "hypothesis",
            "version",
            "extension",
        ];
        if (!validProtocols.includes(source)) {
            errors.push(this.createError(ValidationErrorCode.UNKNOWN, "Unknown source protocol: ".concat(source), "source"));
        }
        if (!validProtocols.includes(target)) {
            errors.push(this.createError(ValidationErrorCode.UNKNOWN, "Unknown target protocol: ".concat(target), "target"));
        }
        // Validate known protocol interactions
        var validInteractions = {
            atp: ["acp", "cartridge", "version"],
            acp: ["atp", "cartridge", "rollback"],
            cartridge: ["atp", "acp", "version"],
            rollback: ["acp", "cartridge", "hypothesis"],
            hypothesis: ["rollback", "cartridge"],
            version: ["atp", "acp", "cartridge"],
            extension: ["atp", "acp", "cartridge", "rollback"],
        };
        if (validProtocols.includes(source) && validProtocols.includes(target)) {
            var allowedTargets = (_a = validInteractions[source]) !== null && _a !== void 0 ? _a : [];
            if (!allowedTargets.includes(target)) {
                errors.push(this.createError(ValidationErrorCode.CROSS_PROTOCOL_INCOMPATIBLE, "Protocol interaction from ".concat(source, " to ").concat(target, " is not supported"), "interaction"));
            }
        }
        // Validate data structure
        if (!data || typeof data !== "object") {
            errors.push(this.createError(ValidationErrorCode.INVALID_TYPE, "Data must be an object", "data"));
        }
        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings,
            protocolVersion: "1.0.0",
            metadata: { source: source, target: target },
        };
    };
    /**
     * Validate version handshake
     *
     * Validates that client and server versions are compatible
     */
    ProtocolValidator.prototype.validateVersionHandshake = function (client, server) {
        var errors = [];
        var warnings = [];
        // Validate protocol match
        if (client.protocol !== server.protocol) {
            errors.push(this.createError(ValidationErrorCode.VERSION_MISMATCH, "Protocol mismatch: client ".concat(client.protocol, " vs server ").concat(server.protocol), "protocol"));
        }
        // Parse versions
        var clientVersion = this.parseSemVer(client.clientVersion);
        var serverVersion = this.parseSemVer(server.serverVersion);
        if (!clientVersion) {
            errors.push(this.createError(ValidationErrorCode.VERSION_INVALID_FORMAT, "Invalid client version format: ".concat(client.clientVersion), "clientVersion"));
        }
        if (!serverVersion) {
            errors.push(this.createError(ValidationErrorCode.VERSION_INVALID_FORMAT, "Invalid server version format: ".concat(server.serverVersion), "serverVersion"));
        }
        if (clientVersion && serverVersion) {
            // Major version must match
            if (clientVersion.major !== serverVersion.major) {
                errors.push(this.createError(ValidationErrorCode.VERSION_INCOMPATIBLE, "Major version mismatch: client ".concat(clientVersion.major, ".").concat(clientVersion.minor, " vs server ").concat(serverVersion.major, ".").concat(serverVersion.minor), "version"));
            }
            // Client should not be newer than server
            if (this.compareVersions(clientVersion, serverVersion) > 0) {
                warnings.push(this.createWarning("Client version is newer than server version", "version"));
            }
        }
        // Check capability overlap
        if (client.clientCapabilities && server.serverCapabilities) {
            var clientCaps = new Set(client.clientCapabilities);
            var serverCaps_1 = new Set(server.serverCapabilities);
            var commonCaps = __spreadArray([], clientCaps, true).filter(function (c) { return serverCaps_1.has(c); });
            if (commonCaps.length === 0) {
                warnings.push(this.createWarning("No common capabilities between client and server", "capabilities"));
            }
        }
        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings,
            protocolVersion: "1.0.0",
            metadata: {
                clientVersion: client.clientVersion,
                serverVersion: server.serverVersion,
            },
        };
    };
    /**
     * Validate cartridge deployment
     *
     * Validates that a cartridge can be deployed to a target version
     */
    ProtocolValidator.prototype.validateCartridgeDeployment = function (manifest, targetVersion) {
        var errors = [];
        var warnings = [];
        // First validate manifest
        var manifestResult = this.validateCartridge(manifest);
        errors.push.apply(errors, manifestResult.errors);
        warnings.push.apply(warnings, manifestResult.warnings);
        if (!manifest || typeof manifest !== "object") {
            return { valid: false, errors: errors, warnings: warnings };
        }
        var m = manifest;
        // Parse target version
        var target = this.parseSemVer(targetVersion);
        if (!target) {
            errors.push(this.createError(ValidationErrorCode.CARTRIDGE_INVALID_VERSION, "Invalid target version: ".concat(targetVersion), "targetVersion"));
            return { valid: false, errors: errors, warnings: warnings };
        }
        // Check manifest version
        if (typeof m.version === "string") {
            var manifestVersion = this.parseSemVer(m.version);
            if (manifestVersion) {
                // Cartridge version must match target major version
                if (manifestVersion.major !== target.major) {
                    errors.push(this.createError(ValidationErrorCode.VERSION_INCOMPATIBLE, "Cartridge version ".concat(m.version, " is incompatible with target version ").concat(targetVersion), "version"));
                }
            }
        }
        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings,
            protocolVersion: "1.0.0",
        };
    };
    // ========================================================================
    // AGGREGATION
    // ========================================================================
    /**
     * Aggregate multiple validation results
     */
    ProtocolValidator.prototype.aggregateResults = function (results) {
        var individualResults = new Map();
        var allErrors = [];
        var allWarnings = [];
        results.forEach(function (result, index) {
            individualResults.set("validation_".concat(index), result);
            allErrors.push.apply(allErrors, result.errors);
            allWarnings.push.apply(allWarnings, result.warnings);
        });
        var passedValidations = results.filter(function (r) { return r.valid; }).length;
        var failedValidations = results.filter(function (r) { return !r.valid; }).length;
        return {
            valid: allErrors.length === 0,
            errors: allErrors,
            warnings: allWarnings,
            individualResults: individualResults,
            totalValidations: results.length,
            passedValidations: passedValidations,
            failedValidations: failedValidations,
        };
    };
    // ========================================================================
    // ERROR CREATION HELPERS
    // ========================================================================
    /**
     * Create a validation error
     */
    ProtocolValidator.prototype.createError = function (code, message, field, expected, actual) {
        return {
            field: field,
            code: code,
            message: message,
            expected: expected,
            actual: actual,
            severity: "error",
        };
    };
    /**
     * Create a validation warning
     */
    ProtocolValidator.prototype.createWarning = function (message, field) {
        return {
            field: field,
            code: ValidationErrorCode.UNKNOWN,
            message: message,
            severity: "warning",
        };
    };
    // ========================================================================
    // ERROR FORMATTING
    // ========================================================================
    /**
     * Format a validation error as a string
     */
    ProtocolValidator.prototype.formatError = function (error) {
        var parts = ["".concat(error.severity.toUpperCase(), ": ").concat(error.message)];
        if (error.field) {
            parts.push("  Field: ".concat(error.field));
        }
        if (error.expected) {
            parts.push("  Expected: ".concat(error.expected));
        }
        if (error.actual !== undefined) {
            parts.push("  Actual: ".concat(JSON.stringify(error.actual)));
        }
        return parts.join("\n");
    };
    /**
     * Format multiple validation errors as a string
     */
    ProtocolValidator.prototype.formatErrors = function (errors) {
        var _this = this;
        return errors.map(function (e) { return _this.formatError(e); }).join("\n\n");
    };
    /**
     * Format a validation result as a string
     */
    ProtocolValidator.prototype.formatResult = function (result) {
        var _this = this;
        var lines = [];
        lines.push("Validation: ".concat(result.valid ? "PASSED" : "FAILED"));
        if (result.errors.length > 0) {
            lines.push("\nErrors:");
            result.errors.forEach(function (e) {
                lines.push("  - ".concat(_this.formatError(e)));
            });
        }
        if (result.warnings.length > 0) {
            lines.push("\nWarnings:");
            result.warnings.forEach(function (w) {
                lines.push("  - ".concat(_this.formatError(w)));
            });
        }
        return lines.join("\n");
    };
    // ========================================================================
    // PRIVATE HELPERS
    // ========================================================================
    /**
     * Require a string field
     */
    ProtocolValidator.prototype.requireString = function (obj, field, errors) {
        var value = obj[field];
        if (value === undefined || value === null) {
            errors.push(this.createError(ValidationErrorCode.MISSING_REQUIRED_FIELD, "Missing required field: ".concat(field), field));
        }
        else if (typeof value !== "string") {
            errors.push(this.createError(ValidationErrorCode.INVALID_TYPE, "Field ".concat(field, " must be a string"), field, "string", typeof value));
        }
    };
    /**
     * Require a number field
     */
    ProtocolValidator.prototype.requireNumber = function (obj, field, errors) {
        var value = obj[field];
        if (value === undefined || value === null) {
            errors.push(this.createError(ValidationErrorCode.MISSING_REQUIRED_FIELD, "Missing required field: ".concat(field), field));
        }
        else if (typeof value !== "number") {
            errors.push(this.createError(ValidationErrorCode.INVALID_TYPE, "Field ".concat(field, " must be a number"), field, "number", typeof value));
        }
    };
    /**
     * Parse SemVer from string
     */
    ProtocolValidator.prototype.parseSemVer = function (version) {
        var match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
        if (!match)
            return null;
        return {
            major: parseInt(match[1], 10),
            minor: parseInt(match[2], 10),
            patch: parseInt(match[3], 10),
        };
    };
    /**
     * Compare two version objects
     * @returns negative if a < b, 0 if equal, positive if a > b
     */
    ProtocolValidator.prototype.compareVersions = function (a, b) {
        if (a.major !== b.major)
            return a.major - b.major;
        if (a.minor !== b.minor)
            return a.minor - b.minor;
        return a.patch - b.patch;
    };
    return ProtocolValidator;
}());
exports.ProtocolValidator = ProtocolValidator;
// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================
/**
 * Create a successful validation result
 */
function createValidationResult(valid) {
    if (valid === void 0) { valid = true; }
    return {
        valid: valid,
        errors: [],
        warnings: [],
    };
}
/**
 * Create a failed validation result with a single error
 */
function createValidationFailure(message, field) {
    return {
        valid: false,
        errors: [
            {
                field: field,
                code: ValidationErrorCode.UNKNOWN,
                message: message,
                severity: "error",
            },
        ],
        warnings: [],
    };
}
/**
 * Format validation errors for display
 */
function formatValidationErrors(errors) {
    var validator = new ProtocolValidator();
    return validator.formatErrors(errors);
}

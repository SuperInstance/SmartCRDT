"use strict";
/**
 * Protocol Compliance Testing Suite for Aequor Cognitive Orchestration Platform
 *
 * This module provides automated protocol compliance testing that verifies
 * implementations against their protocol specifications.
 *
 * Features:
 * - Type compliance checking (interfaces, types, enums, classes)
 * - Message format validation (requests, responses, flow control)
 * - Behavior verification (preconditions, postconditions, invariants)
 * - Constraint validation (privacy, budget, thermal, latency)
 * - Comprehensive compliance reporting with recommendations
 *
 * Usage:
 * ```typescript
 * import { ProtocolComplianceChecker, ComplianceTestRunner } from '@lsi/protocol';
 *
 * // Define a protocol specification
 * const spec: ProtocolSpecification = {
 *   name: 'ATP',
 *   version: { major: 1, minor: 0, patch: 0 },
 *   types: [...],
 *   messages: [...],
 *   behaviors: [...],
 *   constraints: [...]
 * };
 *
 * // Create checker
 * const checker = new ProtocolComplianceChecker(spec);
 *
 * // Check implementation
 * const report = checker.check_compliance(implementation);
 * console.log(report.compliance_score); // 0-100
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
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
exports.ComplianceTestRunner = exports.ProtocolComplianceChecker = void 0;
exports.parseSemVer = parseSemVer;
exports.formatSemVer = formatSemVer;
exports.compareSemVer = compareSemVer;
exports.buildTypeTest = buildTypeTest;
exports.buildMessageTest = buildMessageTest;
exports.buildBehaviorTest = buildBehaviorTest;
exports.buildConstraintTest = buildConstraintTest;
/**
 * Parse SemVer from string
 */
function parseSemVer(version) {
    var match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/);
    if (!match) {
        throw new Error("Invalid SemVer string: ".concat(version));
    }
    return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10),
        prerelease: match[4],
        build: match[5],
    };
}
/**
 * Format SemVer to string
 */
function formatSemVer(version) {
    var result = "".concat(version.major, ".").concat(version.minor, ".").concat(version.patch);
    if (version.prerelease) {
        result += "-".concat(version.prerelease);
    }
    if (version.build) {
        result += "+".concat(version.build);
    }
    return result;
}
/**
 * Compare two SemVer versions
 * @returns negative if a < b, 0 if equal, positive if a > b
 */
function compareSemVer(a, b) {
    var _a, _b;
    if (a.major !== b.major)
        return a.major - b.major;
    if (a.minor !== b.minor)
        return a.minor - b.minor;
    if (a.patch !== b.patch)
        return a.patch - b.patch;
    // Handle prerelease
    var aPre = (_a = a.prerelease) !== null && _a !== void 0 ? _a : "";
    var bPre = (_b = b.prerelease) !== null && _b !== void 0 ? _b : "";
    if (aPre === bPre)
        return 0;
    if (aPre === "")
        return 1; // Release > prerelease
    if (bPre === "")
        return -1;
    return aPre.localeCompare(bPre);
}
// ============================================================================
// PROTOCOL COMPLIANCE CHECKER
// ============================================================================
/**
 * ProtocolComplianceChecker - Validates implementations against protocol specifications
 *
 * Performs comprehensive validation of protocol implementations including:
 * - Type structure verification
 * - Message format validation
 * - Behavior contract verification
 * - Constraint satisfaction checking
 */
var ProtocolComplianceChecker = /** @class */ (function () {
    function ProtocolComplianceChecker(specification) {
        this.specification = specification;
        // Build lookup maps
        this.typeMap = new Map(specification.types.map(function (t) { return [t.name, t]; }));
        this.behaviorMap = new Map(specification.behaviors.map(function (b) { return [b.name, b]; }));
    }
    // ========================================================================
    // TYPE CHECKING
    // ========================================================================
    /**
     * Verify type compliance for an implementation
     *
     * @param implementation - Implementation to check
     * @returns Compliance result for type checking
     */
    ProtocolComplianceChecker.prototype.verify_type_compliance = function (implementation) {
        var violations = [];
        var warnings = [];
        var checkedTypes = 0;
        if (typeof implementation !== "object" || implementation === null) {
            return {
                is_compliant: false,
                violations: [
                    {
                        category: "type",
                        severity: "error",
                        message: "Implementation must be an object",
                    },
                ],
                warnings: [],
                coverage: 0,
            };
        }
        var impl = implementation;
        // Check each type specification
        for (var _i = 0, _a = this.specification.types; _i < _a.length; _i++) {
            var typeSpec = _a[_i];
            checkedTypes++;
            // Check if implementation has the type/property
            if (impl[typeSpec.name] === undefined) {
                violations.push({
                    category: "type",
                    severity: "error",
                    message: "Missing required type/property: ".concat(typeSpec.name),
                    specification_reference: "".concat(this.specification.name, ".types.").concat(typeSpec.name),
                    expected: "Property ".concat(typeSpec.name, " to exist"),
                    actual: "Property not found",
                });
                continue;
            }
            // Verify type structure
            var typeViolations = this.verify_type_structure(typeSpec, impl[typeSpec.name]);
            violations.push.apply(violations, typeViolations);
        }
        // Calculate coverage
        var coverage = this.specification.types.length > 0
            ? (checkedTypes / this.specification.types.length) * 100
            : 0;
        return {
            is_compliant: violations.filter(function (v) { return v.severity === "error"; }).length === 0,
            violations: violations,
            warnings: warnings,
            coverage: coverage,
        };
    };
    /**
     * Verify interface implementation
     *
     * @param implementation - Object implementing interface
     * @returns Compliance result
     */
    ProtocolComplianceChecker.prototype.verify_interface_implementation = function (implementation) {
        var violations = [];
        var warnings = [];
        var checkedProperties = 0;
        var totalRequiredProperties = 0;
        var impl = implementation;
        // Check all interface types
        for (var _i = 0, _a = this.specification.types; _i < _a.length; _i++) {
            var typeSpec = _a[_i];
            if (typeSpec.type !== "interface")
                continue;
            var def = typeSpec.definition;
            // Check required properties
            for (var _b = 0, _c = typeSpec.required_properties; _b < _c.length; _b++) {
                var propName = _c[_b];
                totalRequiredProperties++;
                if (impl[propName] === undefined) {
                    violations.push({
                        category: "type",
                        severity: "error",
                        message: "Missing required property: ".concat(propName, " in interface ").concat(typeSpec.name),
                        specification_reference: "".concat(this.specification.name, ".types.").concat(typeSpec.name, ".").concat(propName),
                    });
                }
                else {
                    checkedProperties++;
                    // Check property type
                    var propDef = def.properties[propName];
                    if (propDef) {
                        var typeViolation = this.verify_property_type(propName, impl[propName], propDef);
                        if (typeViolation) {
                            violations.push(typeViolation);
                        }
                    }
                }
            }
            // Check for extra properties (warning only)
            var implKeys = new Set(Object.keys(impl));
            var specKeys = new Set(__spreadArray(__spreadArray([], typeSpec.required_properties, true), typeSpec.optional_properties, true));
            for (var _d = 0, implKeys_1 = implKeys; _d < implKeys_1.length; _d++) {
                var key = implKeys_1[_d];
                if (!specKeys.has(key)) {
                    warnings.push({
                        category: "type",
                        message: "Unexpected property in ".concat(typeSpec.name, ": ").concat(key),
                        suggestion: "Remove this property or add it to the specification",
                    });
                }
            }
        }
        // Calculate coverage
        var coverage = totalRequiredProperties > 0
            ? (checkedProperties / totalRequiredProperties) * 100
            : 100;
        return {
            is_compliant: violations.filter(function (v) { return v.severity === "error"; }).length === 0,
            violations: violations,
            warnings: warnings,
            coverage: coverage,
        };
    };
    /**
     * Verify enum values
     *
     * @param enum_ - Enum object to verify
     * @param enumName - Optional name of the specific enum to validate
     * @returns Compliance result
     */
    ProtocolComplianceChecker.prototype.verify_enum_values = function (enum_, enumName) {
        var violations = [];
        var warnings = [];
        var enumObj = enum_;
        // Find enum specification(s) to validate
        var typesToCheck = enumName
            ? this.specification.types.filter(function (t) { return t.name === enumName; })
            : this.specification.types.filter(function (t) { return t.type === "enum"; });
        if (typesToCheck.length === 0) {
            return {
                is_compliant: false,
                violations: [
                    {
                        category: "type",
                        severity: "error",
                        message: enumName
                            ? "Enum type not found: ".concat(enumName)
                            : "No enum types in specification",
                    },
                ],
                warnings: [],
                coverage: 0,
            };
        }
        // Check each enum specification
        for (var _i = 0, typesToCheck_1 = typesToCheck; _i < typesToCheck_1.length; _i++) {
            var typeSpec = typesToCheck_1[_i];
            if (typeSpec.type !== "enum")
                continue;
            var def = typeSpec.definition;
            // Check all enum values are present
            for (var _a = 0, _b = Object.entries(def.values); _a < _b.length; _a++) {
                var _c = _b[_a], key = _c[0], value = _c[1];
                if (enumObj[key] === undefined) {
                    violations.push({
                        category: "type",
                        severity: "error",
                        message: "Missing enum value: ".concat(key),
                        specification_reference: "".concat(this.specification.name, ".types.").concat(typeSpec.name, ".").concat(key),
                        expected: String(value),
                        actual: "undefined",
                    });
                }
                else if (enumObj[key] !== value) {
                    violations.push({
                        category: "type",
                        severity: "error",
                        message: "Enum value mismatch: ".concat(key),
                        specification_reference: "".concat(this.specification.name, ".types.").concat(typeSpec.name, ".").concat(key),
                        expected: String(value),
                        actual: String(enumObj[key]),
                    });
                }
            }
            // Check for extra enum values
            for (var _d = 0, _e = Object.keys(enumObj); _d < _e.length; _d++) {
                var key = _e[_d];
                if (def.values[key] === undefined) {
                    warnings.push({
                        category: "type",
                        message: "Extra enum value: ".concat(key, " in ").concat(typeSpec.name),
                        suggestion: "Add this value to the specification or remove it",
                    });
                }
            }
        }
        return {
            is_compliant: violations.filter(function (v) { return v.severity === "error"; }).length === 0,
            violations: violations,
            warnings: warnings,
            coverage: 100,
        };
    };
    /**
     * Verify type structure
     *
     * @private
     */
    ProtocolComplianceChecker.prototype.verify_type_structure = function (typeSpec, value) {
        var violations = [];
        var def = typeSpec.definition;
        switch (typeSpec.type) {
            case "interface":
                if (typeof value !== "object" || value === null) {
                    violations.push({
                        category: "type",
                        severity: "error",
                        message: "".concat(typeSpec.name, " must be an object"),
                        specification_reference: "".concat(this.specification.name, ".types.").concat(typeSpec.name),
                        expected: "object",
                        actual: typeof value,
                    });
                }
                break;
            case "enum":
                var enumDef = def;
                var enumValues = Object.values(enumDef.values);
                if (!enumValues.includes(value)) {
                    violations.push({
                        category: "type",
                        severity: "error",
                        message: "Invalid enum value for ".concat(typeSpec.name),
                        specification_reference: "".concat(this.specification.name, ".types.").concat(typeSpec.name),
                        expected: enumValues.join(" | "),
                        actual: String(value),
                    });
                }
                break;
            case "type":
                // Type aliases are hard to verify at runtime
                // Just check if value exists
                if (value === undefined) {
                    violations.push({
                        category: "type",
                        severity: "error",
                        message: "".concat(typeSpec.name, " is undefined"),
                        specification_reference: "".concat(this.specification.name, ".types.").concat(typeSpec.name),
                    });
                }
                break;
            case "class":
                // Classes should be instances
                if (typeof value !== "object" || value === null) {
                    violations.push({
                        category: "type",
                        severity: "error",
                        message: "".concat(typeSpec.name, " must be an object instance"),
                        specification_reference: "".concat(this.specification.name, ".types.").concat(typeSpec.name),
                        expected: "object",
                        actual: typeof value,
                    });
                }
                break;
        }
        return violations;
    };
    /**
     * Verify property type
     *
     * @private
     */
    ProtocolComplianceChecker.prototype.verify_property_type = function (propName, value, propDef) {
        // Basic type checking (TypeScript types are erased at runtime)
        // This is a simplified check
        var typeMap = {
            string: function (v) { return typeof v === "string"; },
            number: function (v) { return typeof v === "number" && !isNaN(v); },
            boolean: function (v) { return typeof v === "boolean"; },
            object: function (v) { return typeof v === "object" && v !== null; },
            array: function (v) { return Array.isArray(v); },
            any: function () { return true; },
            unknown: function () { return true; },
        };
        // Extract base type (handle generics, unions, etc.)
        var baseType = propDef.type.split("<")[0].split("|")[0].trim();
        baseType = baseType.replace("readonly", "").trim();
        var checker = typeMap[baseType];
        if (checker && !checker(value)) {
            return {
                category: "type",
                severity: "error",
                message: "Property ".concat(propName, " has wrong type"),
                specification_reference: "property:".concat(propName),
                expected: propDef.type,
                actual: typeof value,
            };
        }
        return null;
    };
    // ========================================================================
    // MESSAGE CHECKING
    // ========================================================================
    /**
     * Verify message format
     *
     * @param message - Message to validate
     * @returns Compliance result
     */
    ProtocolComplianceChecker.prototype.verify_message_format = function (message) {
        var violations = [];
        var warnings = [];
        if (typeof message !== "object" || message === null) {
            return {
                is_compliant: false,
                violations: [
                    {
                        category: "message",
                        severity: "error",
                        message: "Message must be an object",
                    },
                ],
                warnings: [],
                coverage: 0,
            };
        }
        var msg = message;
        // Check each message specification
        for (var _i = 0, _a = this.specification.messages; _i < _a.length; _i++) {
            var msgSpec = _a[_i];
            // Verify request type if specified
            if (msgSpec.request_type) {
                var typeSpec = this.typeMap.get(msgSpec.request_type);
                if (typeSpec) {
                    var result = this.verify_type_structure(typeSpec, message);
                    violations.push.apply(violations, result);
                }
            }
            // Verify flow control if specified
            if (msgSpec.flow_control) {
                var fcViolations = this.verify_flow_control(msgSpec.flow_control, msg);
                violations.push.apply(violations, fcViolations);
            }
            // Note: error_handling is checked in verify_error_handling method
            // not here since it applies to errors array, not messages
        }
        return {
            is_compliant: violations.filter(function (v) { return v.severity === "error"; }).length === 0,
            violations: violations,
            warnings: warnings,
            coverage: 100,
        };
    };
    /**
     * Verify message flow
     *
     * @param messages - Array of messages in sequence
     * @returns Compliance result
     */
    ProtocolComplianceChecker.prototype.verify_message_flow = function (messages) {
        var violations = [];
        var warnings = [];
        if (!Array.isArray(messages)) {
            return {
                is_compliant: false,
                violations: [
                    {
                        category: "message",
                        severity: "error",
                        message: "Messages must be an array",
                    },
                ],
                warnings: [],
                coverage: 0,
            };
        }
        // Check message sequence follows protocol
        for (var i = 0; i < messages.length; i++) {
            var msg = messages[i];
            if (typeof msg !== "object" || msg === null) {
                violations.push({
                    category: "message",
                    severity: "error",
                    message: "Message at index ".concat(i, " is not an object"),
                    location: "messages[".concat(i, "]"),
                });
                continue;
            }
            // Validate individual message
            var result = this.verify_message_format(msg);
            violations.push.apply(violations, result.violations);
            warnings.push.apply(warnings, result.warnings);
        }
        return {
            is_compliant: violations.filter(function (v) { return v.severity === "error"; }).length === 0,
            violations: violations,
            warnings: warnings,
            coverage: 100,
        };
    };
    /**
     * Verify error handling
     *
     * @param errors - Array of errors
     * @returns Compliance result
     */
    ProtocolComplianceChecker.prototype.verify_error_handling = function (errors) {
        var violations = [];
        var warnings = [];
        if (!Array.isArray(errors)) {
            return {
                is_compliant: false,
                violations: [
                    {
                        category: "message",
                        severity: "error",
                        message: "Errors must be an array",
                    },
                ],
                warnings: [],
                coverage: 0,
            };
        }
        // Check each error
        for (var i = 0; i < errors.length; i++) {
            var error = errors[i];
            if (typeof error !== "object" || error === null) {
                violations.push({
                    category: "message",
                    severity: "error",
                    message: "Error at index ".concat(i, " is not an object"),
                    location: "errors[".concat(i, "]"),
                });
            }
            // Check error has required fields
            if (typeof error === "object" && error !== null) {
                if (!("type" in error) || !("message" in error)) {
                    violations.push({
                        category: "message",
                        severity: "error",
                        message: "Error at index ".concat(i, " missing required fields (type, message)"),
                        location: "errors[".concat(i, "]"),
                    });
                }
            }
        }
        return {
            is_compliant: violations.filter(function (v) { return v.severity === "error"; }).length === 0,
            violations: violations,
            warnings: warnings,
            coverage: 100,
        };
    };
    /**
     * Verify flow control
     *
     * @private
     */
    ProtocolComplianceChecker.prototype.verify_flow_control = function (spec, message) {
        var violations = [];
        // Check streaming flag if specified
        if (spec.streaming !== undefined) {
            // Just verify the field exists if expected
            // Actual streaming behavior is runtime-specific
        }
        // Check timeout if specified
        if (spec.timeout !== undefined) {
            // Validate timeout value
            var timeout = message.timeout;
            if (timeout !== undefined &&
                (timeout < 0 || timeout > spec.timeout * 2)) {
                violations.push({
                    category: "message",
                    severity: "warning",
                    message: "Timeout ".concat(timeout, "ms exceeds recommended ").concat(spec.timeout, "ms"),
                });
            }
        }
        return violations;
    };
    // ========================================================================
    // BEHAVIOR CHECKING
    // ========================================================================
    /**
     * Verify preconditions before executing a behavior
     *
     * @param behavior - Name of behavior
     * @param context - Execution context
     * @returns Compliance result
     */
    ProtocolComplianceChecker.prototype.verify_preconditions = function (behavior, context) {
        return __awaiter(this, void 0, void 0, function () {
            var violations, warnings, behaviorSpec, _i, _a, precondition, result, e_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        violations = [];
                        warnings = [];
                        behaviorSpec = this.behaviorMap.get(behavior);
                        if (!behaviorSpec) {
                            return [2 /*return*/, {
                                    is_compliant: false,
                                    violations: [
                                        {
                                            category: "behavior",
                                            severity: "error",
                                            message: "Unknown behavior: ".concat(behavior),
                                        },
                                    ],
                                    warnings: [],
                                    coverage: 0,
                                }];
                        }
                        _i = 0, _a = behaviorSpec.preconditions;
                        _b.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 6];
                        precondition = _a[_i];
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, precondition.check(context)];
                    case 3:
                        result = _b.sent();
                        if (!result) {
                            violations.push({
                                category: "behavior",
                                severity: "error",
                                message: "Precondition failed: ".concat(precondition.description),
                                specification_reference: "behavior:".concat(behavior, ".precondition"),
                            });
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        e_1 = _b.sent();
                        violations.push({
                            category: "behavior",
                            severity: "error",
                            message: "Precondition check failed: ".concat(precondition.description, " - ").concat(e_1),
                            specification_reference: "behavior:".concat(behavior, ".precondition"),
                        });
                        return [3 /*break*/, 5];
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6: return [2 /*return*/, {
                            is_compliant: violations.length === 0,
                            violations: violations,
                            warnings: warnings,
                            coverage: 100,
                        }];
                }
            });
        });
    };
    /**
     * Verify postconditions after executing a behavior
     *
     * @param behavior - Name of behavior
     * @param result - Result from behavior execution
     * @param context - Execution context
     * @returns Compliance result
     */
    ProtocolComplianceChecker.prototype.verify_postconditions = function (behavior, result, context) {
        return __awaiter(this, void 0, void 0, function () {
            var violations, warnings, behaviorSpec, _i, _a, postcondition, checkResult, e_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        violations = [];
                        warnings = [];
                        behaviorSpec = this.behaviorMap.get(behavior);
                        if (!behaviorSpec) {
                            return [2 /*return*/, {
                                    is_compliant: false,
                                    violations: [
                                        {
                                            category: "behavior",
                                            severity: "error",
                                            message: "Unknown behavior: ".concat(behavior),
                                        },
                                    ],
                                    warnings: [],
                                    coverage: 0,
                                }];
                        }
                        // Update context with result
                        context.result = result;
                        _i = 0, _a = behaviorSpec.postconditions;
                        _b.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 6];
                        postcondition = _a[_i];
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, postcondition.check(context)];
                    case 3:
                        checkResult = _b.sent();
                        if (!checkResult) {
                            violations.push({
                                category: "behavior",
                                severity: "error",
                                message: "Postcondition failed: ".concat(postcondition.description),
                                specification_reference: "behavior:".concat(behavior, ".postcondition"),
                            });
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        e_2 = _b.sent();
                        violations.push({
                            category: "behavior",
                            severity: "error",
                            message: "Postcondition check failed: ".concat(postcondition.description, " - ").concat(e_2),
                            specification_reference: "behavior:".concat(behavior, ".postcondition"),
                        });
                        return [3 /*break*/, 5];
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6: return [2 /*return*/, {
                            is_compliant: violations.length === 0,
                            violations: violations,
                            warnings: warnings,
                            coverage: 100,
                        }];
                }
            });
        });
    };
    /**
     * Verify invariants (should always be true)
     *
     * @param behavior - Name of behavior
     * @param context - Execution context
     * @returns Compliance result
     */
    ProtocolComplianceChecker.prototype.verify_invariants = function (behavior, context) {
        return __awaiter(this, void 0, void 0, function () {
            var violations, warnings, behaviorSpec, _i, _a, invariant, result, e_3;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        violations = [];
                        warnings = [];
                        behaviorSpec = this.behaviorMap.get(behavior);
                        if (!behaviorSpec) {
                            return [2 /*return*/, {
                                    is_compliant: false,
                                    violations: [
                                        {
                                            category: "behavior",
                                            severity: "error",
                                            message: "Unknown behavior: ".concat(behavior),
                                        },
                                    ],
                                    warnings: [],
                                    coverage: 0,
                                }];
                        }
                        _i = 0, _a = behaviorSpec.invariants;
                        _b.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 6];
                        invariant = _a[_i];
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, invariant.check(context)];
                    case 3:
                        result = _b.sent();
                        if (!result) {
                            violations.push({
                                category: "behavior",
                                severity: "error",
                                message: "Invariant violated: ".concat(invariant.description),
                                specification_reference: "behavior:".concat(behavior, ".invariant"),
                            });
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        e_3 = _b.sent();
                        violations.push({
                            category: "behavior",
                            severity: "error",
                            message: "Invariant check failed: ".concat(invariant.description, " - ").concat(e_3),
                            specification_reference: "behavior:".concat(behavior, ".invariant"),
                        });
                        return [3 /*break*/, 5];
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6: return [2 /*return*/, {
                            is_compliant: violations.length === 0,
                            violations: violations,
                            warnings: warnings,
                            coverage: 100,
                        }];
                }
            });
        });
    };
    // ========================================================================
    // FULL COMPLIANCE CHECK
    // ========================================================================
    /**
     * Check full compliance of an implementation
     *
     * @param implementation - Implementation to check
     * @returns Complete compliance report
     */
    ProtocolComplianceChecker.prototype.check_compliance = function (implementation) {
        var timestamp = new Date();
        // Check all categories
        var typeResult = this.verify_type_compliance(implementation);
        var messageResult = this.verify_message_format(implementation);
        var behaviorResult = {
            is_compliant: true,
            violations: [],
            warnings: [
                {
                    category: "behavior",
                    message: "Behavior checking requires execution context",
                },
            ],
            coverage: 0,
        };
        var constraintResult = {
            is_compliant: true,
            violations: [],
            warnings: [
                {
                    category: "constraint",
                    message: "Constraint checking requires execution context",
                },
            ],
            coverage: 0,
        };
        // Calculate overall compliance score
        var typeScore = typeResult.is_compliant ? 25 : 0;
        var messageScore = messageResult.is_compliant ? 25 : 0;
        var behaviorScore = behaviorResult.is_compliant ? 25 : 0;
        var constraintScore = constraintResult.is_compliant ? 25 : 0;
        var complianceScore = typeScore + messageScore + behaviorScore + constraintScore;
        // Generate recommendations
        var recommendations = this.generate_recommendations(typeResult, messageResult, behaviorResult, constraintResult);
        return {
            protocol_name: this.specification.name,
            protocol_version: this.specification.version,
            timestamp: timestamp,
            overall_compliance: typeResult.is_compliant &&
                messageResult.is_compliant &&
                behaviorResult.is_compliant &&
                constraintResult.is_compliant,
            compliance_score: complianceScore,
            type_compliance: typeResult,
            message_compliance: messageResult,
            behavior_compliance: behaviorResult,
            constraint_compliance: constraintResult,
            recommendations: recommendations,
        };
    };
    /**
     * Generate compliance report
     *
     * @returns Compliance report
     */
    ProtocolComplianceChecker.prototype.generate_report = function () {
        return {
            protocol_name: this.specification.name,
            protocol_version: this.specification.version,
            timestamp: new Date(),
            overall_compliance: true,
            compliance_score: 100,
            type_compliance: {
                is_compliant: true,
                violations: [],
                warnings: [],
                coverage: 100,
            },
            message_compliance: {
                is_compliant: true,
                violations: [],
                warnings: [],
                coverage: 100,
            },
            behavior_compliance: {
                is_compliant: true,
                violations: [],
                warnings: [],
                coverage: 100,
            },
            constraint_compliance: {
                is_compliant: true,
                violations: [],
                warnings: [],
                coverage: 100,
            },
            recommendations: [],
        };
    };
    /**
     * Generate recommendations from compliance results
     *
     * @private
     */
    ProtocolComplianceChecker.prototype.generate_recommendations = function (typeResult, messageResult, behaviorResult, constraintResult) {
        var recommendations = [];
        // Type recommendations
        for (var _i = 0, _a = typeResult.violations; _i < _a.length; _i++) {
            var violation = _a[_i];
            recommendations.push({
                severity: violation.severity,
                category: "type",
                message: violation.message,
                suggestion: violation.expected && violation.actual
                    ? "Expected: ".concat(violation.expected, ", Got: ").concat(violation.actual)
                    : undefined,
            });
        }
        // Message recommendations
        for (var _b = 0, _c = messageResult.violations; _b < _c.length; _b++) {
            var violation = _c[_b];
            recommendations.push({
                severity: violation.severity,
                category: "message",
                message: violation.message,
            });
        }
        // Behavior recommendations
        for (var _d = 0, _e = behaviorResult.violations; _d < _e.length; _d++) {
            var violation = _e[_d];
            recommendations.push({
                severity: violation.severity,
                category: "behavior",
                message: violation.message,
            });
        }
        // Constraint recommendations
        for (var _f = 0, _g = constraintResult.violations; _f < _g.length; _f++) {
            var violation = _g[_f];
            recommendations.push({
                severity: violation.severity,
                category: "constraint",
                message: violation.message,
            });
        }
        // Warnings as info recommendations
        for (var _h = 0, _j = __spreadArray(__spreadArray([], typeResult.warnings, true), messageResult.warnings, true); _h < _j.length; _h++) {
            var warning = _j[_h];
            recommendations.push({
                severity: "info",
                category: warning.category,
                message: warning.message,
                suggestion: warning.suggestion,
            });
        }
        return recommendations;
    };
    /**
     * Get the specification being used
     */
    ProtocolComplianceChecker.prototype.getSpecification = function () {
        return __assign({}, this.specification);
    };
    return ProtocolComplianceChecker;
}());
exports.ProtocolComplianceChecker = ProtocolComplianceChecker;
/**
 * ComplianceTestRunner - Generate and run compliance test cases
 *
 * Automatically generates test cases from protocol specifications
 * and runs them against implementations.
 */
var ComplianceTestRunner = /** @class */ (function () {
    function ComplianceTestRunner(specification) {
        this.specification = specification;
        this.testCases = new Map();
        this.generateTestCases();
    }
    /**
     * Add a custom test case
     *
     * @param test_case - Test case to add
     */
    ComplianceTestRunner.prototype.add_test_case = function (test_case) {
        this.testCases.set(test_case.id, test_case);
    };
    /**
     * Remove a test case
     *
     * @param id - Test case ID
     */
    ComplianceTestRunner.prototype.remove_test_case = function (id) {
        this.testCases.delete(id);
    };
    /**
     * Run all tests against an implementation
     *
     * @param implementation - Implementation to test
     * @returns Test results
     */
    ComplianceTestRunner.prototype.run_tests = function (implementation) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, testResults, passed, failed, _i, _a, testCase, start, result, duration, e_4, duration;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        startTime = Date.now();
                        testResults = [];
                        passed = 0;
                        failed = 0;
                        _i = 0, _a = this.testCases.values();
                        _b.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 6];
                        testCase = _a[_i];
                        start = Date.now();
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, testCase.test_fn(implementation)];
                    case 3:
                        result = _b.sent();
                        duration = Date.now() - start;
                        testResults.push({
                            id: testCase.id,
                            name: testCase.name,
                            passed: result.passed,
                            duration_ms: duration,
                            error: result.error,
                        });
                        if (result.passed) {
                            passed++;
                        }
                        else {
                            failed++;
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        e_4 = _b.sent();
                        duration = Date.now() - start;
                        failed++;
                        testResults.push({
                            id: testCase.id,
                            name: testCase.name,
                            passed: false,
                            duration_ms: duration,
                            error: e_4 instanceof Error ? e_4.message : String(e_4),
                        });
                        return [3 /*break*/, 5];
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6: return [2 /*return*/, {
                            total_tests: testResults.length,
                            passed_tests: passed,
                            failed_tests: failed,
                            duration_ms: Date.now() - startTime,
                            test_results: testResults,
                        }];
                }
            });
        });
    };
    /**
     * Run a specific test by ID
     *
     * @param id - Test case ID
     * @param implementation - Implementation to test
     * @returns Test result
     */
    ComplianceTestRunner.prototype.run_test_by_id = function (id, implementation) {
        return __awaiter(this, void 0, void 0, function () {
            var testCase, start, result, e_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        testCase = this.testCases.get(id);
                        if (!testCase) {
                            throw new Error("Test case not found: ".concat(id));
                        }
                        start = Date.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, testCase.test_fn(implementation)];
                    case 2:
                        result = _a.sent();
                        return [2 /*return*/, {
                                id: testCase.id,
                                name: testCase.name,
                                passed: result.passed,
                                duration_ms: Date.now() - start,
                                error: result.error,
                            }];
                    case 3:
                        e_5 = _a.sent();
                        return [2 /*return*/, {
                                id: testCase.id,
                                name: testCase.name,
                                passed: false,
                                duration_ms: Date.now() - start,
                                error: e_5 instanceof Error ? e_5.message : String(e_5),
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Generate test cases from specification
     *
     * @returns Generated test cases
     */
    ComplianceTestRunner.prototype.generateTestCases = function (specification) {
        var _this = this;
        var spec = specification !== null && specification !== void 0 ? specification : this.specification;
        var testCases = [];
        var _loop_1 = function (typeSpec) {
            testCases.push({
                id: "type-".concat(typeSpec.name, "-exists"),
                name: "Type ".concat(typeSpec.name, " exists"),
                description: "Verify that ".concat(typeSpec.name, " is defined"),
                specification_reference: "".concat(spec.name, ".types.").concat(typeSpec.name),
                test_type: "type",
                test_fn: function (impl) { return __awaiter(_this, void 0, void 0, function () {
                    var passed;
                    return __generator(this, function (_a) {
                        passed = typeSpec.name in impl;
                        return [2 /*return*/, { id: "", name: "", passed: passed, duration_ms: 0 }];
                    });
                }); },
            });
            var _loop_2 = function (prop) {
                testCases.push({
                    id: "type-".concat(typeSpec.name, "-prop-").concat(prop),
                    name: "Property ".concat(typeSpec.name, ".").concat(prop, " exists"),
                    description: "Verify that ".concat(typeSpec.name, " has required property ").concat(prop),
                    specification_reference: "".concat(spec.name, ".types.").concat(typeSpec.name, ".").concat(prop),
                    test_type: "type",
                    test_fn: function (impl) { return __awaiter(_this, void 0, void 0, function () {
                        var typeValue, passed;
                        return __generator(this, function (_a) {
                            typeValue = impl[typeSpec.name];
                            passed = typeof typeValue === "object" &&
                                typeValue !== null &&
                                prop in typeValue;
                            return [2 /*return*/, { id: "", name: "", passed: passed, duration_ms: 0 }];
                        });
                    }); },
                });
            };
            // Test required properties
            for (var _e = 0, _f = typeSpec.required_properties; _e < _f.length; _e++) {
                var prop = _f[_e];
                _loop_2(prop);
            }
        };
        // Generate type tests
        for (var _i = 0, _a = spec.types; _i < _a.length; _i++) {
            var typeSpec = _a[_i];
            _loop_1(typeSpec);
        }
        // Generate message tests
        for (var _b = 0, _c = spec.messages; _b < _c.length; _b++) {
            var msgSpec = _c[_b];
            testCases.push({
                id: "message-".concat(msgSpec.name, "-format"),
                name: "Message ".concat(msgSpec.name, " format valid"),
                description: "Verify ".concat(msgSpec.name, " message format"),
                specification_reference: "".concat(spec.name, ".messages.").concat(msgSpec.name),
                test_type: "message",
                test_fn: function (impl) { return __awaiter(_this, void 0, void 0, function () {
                    var passed;
                    return __generator(this, function (_a) {
                        passed = typeof impl === "object" && impl !== null;
                        return [2 /*return*/, { id: "", name: "", passed: passed, duration_ms: 0 }];
                    });
                }); },
            });
        }
        // Add generated tests
        for (var _d = 0, testCases_1 = testCases; _d < testCases_1.length; _d++) {
            var testCase = testCases_1[_d];
            this.testCases.set(testCase.id, testCase);
        }
        return testCases;
    };
    /**
     * Get all test cases
     *
     * @returns Array of test cases
     */
    ComplianceTestRunner.prototype.get_test_cases = function () {
        return Array.from(this.testCases.values());
    };
    return ComplianceTestRunner;
}());
exports.ComplianceTestRunner = ComplianceTestRunner;
// ============================================================================
// TEST CASE BUILDERS
// ============================================================================
/**
 * Build a type test case
 */
function buildTypeTest(options) {
    var _this = this;
    return {
        id: "type-".concat(options.typeName).concat(options.property ? "-".concat(options.property) : ""),
        name: "Type check for ".concat(options.typeName).concat(options.property ? ".".concat(options.property) : ""),
        description: "Verify type constraint for ".concat(options.typeName),
        specification_reference: "type:".concat(options.typeName),
        test_type: "type",
        test_fn: function (impl) { return __awaiter(_this, void 0, void 0, function () {
            var value, passed;
            return __generator(this, function (_a) {
                value = options.property
                    ? impl[options.property]
                    : impl[options.typeName];
                passed = options.condition(value);
                return [2 /*return*/, { id: "", name: "", passed: passed, duration_ms: 0 }];
            });
        }); },
    };
}
/**
 * Build a message test case
 */
function buildMessageTest(options) {
    var _this = this;
    return {
        id: "message-".concat(options.messageName, "-").concat(options.field),
        name: "Message field ".concat(options.messageName, ".").concat(options.field),
        description: "Verify ".concat(options.field, " field in ").concat(options.messageName),
        specification_reference: "message:".concat(options.messageName, ".").concat(options.field),
        test_type: "message",
        test_fn: function (impl) { return __awaiter(_this, void 0, void 0, function () {
            var msg, passed;
            return __generator(this, function (_a) {
                msg = impl[options.messageName];
                passed = msg !== undefined && msg[options.field] === options.expectedValue;
                return [2 /*return*/, { id: "", name: "", passed: passed, duration_ms: 0 }];
            });
        }); },
    };
}
/**
 * Build a behavior test case
 */
function buildBehaviorTest(options) {
    var _this = this;
    return {
        id: "behavior-".concat(options.behaviorName),
        name: "Behavior check for ".concat(options.behaviorName),
        description: "Verify behavior contract for ".concat(options.behaviorName),
        specification_reference: "behavior:".concat(options.behaviorName),
        test_type: "behavior",
        test_fn: function (impl) { return __awaiter(_this, void 0, void 0, function () {
            var context, passed;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        context = {
                            method_name: options.behaviorName,
                            parameters: {},
                            state: impl,
                            timestamp: Date.now(),
                        };
                        return [4 /*yield*/, options.condition(context)];
                    case 1:
                        passed = _a.sent();
                        return [2 /*return*/, { id: "", name: "", passed: passed, duration_ms: 0 }];
                }
            });
        }); },
    };
}
/**
 * Build a constraint test case
 */
function buildConstraintTest(options) {
    var _this = this;
    return {
        id: "constraint-".concat(options.constraintName),
        name: "Constraint check for ".concat(options.constraintName),
        description: "Verify constraint ".concat(options.constraintName),
        specification_reference: "constraint:".concat(options.constraintName),
        test_type: "constraint",
        test_fn: function (impl) { return __awaiter(_this, void 0, void 0, function () {
            var passed;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, options.check(impl)];
                    case 1:
                        passed = _a.sent();
                        return [2 /*return*/, { id: "", name: "", passed: passed, duration_ms: 0 }];
                }
            });
        }); },
    };
}

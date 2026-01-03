"use strict";
/**
 * @lsi/protocol - A2UI Protocol Type Definitions
 *
 * A2UI (Agent-to-User Interface) Protocol v0.8
 * Based on Google's open-source protocol for agent-driven UI generation
 *
 * This protocol enables:
 * - Declarative JSON format for safe, LLM-friendly UI generation
 * - Streaming via SSE for progressive rendering
 * - Component catalog with security policies
 * - Intent-aware UI generation
 *
 * @see https://github.com/google/a2ui
 * @version 0.8
 * @license Apache 2.0
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
exports.validateA2UIResponse = validateA2UIResponse;
exports.validateA2UIComponent = validateA2UIComponent;
exports.validateA2UILayout = validateA2UILayout;
exports.sanitizeA2UIProps = sanitizeA2UIProps;
exports.createDefaultSecurityPolicy = createDefaultSecurityPolicy;
exports.createCatalogEntry = createCatalogEntry;
exports.isValidComponentType = isValidComponentType;
exports.getComponentSchema = getComponentSchema;
exports.formatValidationErrors = formatValidationErrors;
// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================
/**
 * Validate A2UI Response
 *
 * @param response - Response to validate
 * @returns Validation result
 */
function validateA2UIResponse(response) {
    var errors = [];
    var warnings = [];
    if (!response || typeof response !== "object") {
        errors.push({
            code: "INVALID_TYPE",
            message: "Response must be an object",
            value: response,
        });
        return { valid: false, errors: errors, warnings: warnings };
    }
    var r = response;
    // Validate version
    if (r.version !== "0.8") {
        errors.push({
            code: "INVALID_VERSION",
            message: "Version must be 0.8",
            path: "version",
            value: r.version,
        });
    }
    // Validate surface
    var validSurfaces = [
        "main",
        "sidebar",
        "modal",
        "inline",
        "overlay",
    ];
    if (!r.surface || !validSurfaces.includes(r.surface)) {
        errors.push({
            code: "INVALID_SURFACE",
            message: "Surface must be one of: ".concat(validSurfaces.join(", ")),
            path: "surface",
            value: r.surface,
        });
    }
    // Validate components
    if (!Array.isArray(r.components)) {
        errors.push({
            code: "INVALID_COMPONENTS",
            message: "Components must be an array",
            path: "components",
            value: r.components,
        });
    }
    else {
        r.components.forEach(function (component, index) {
            var compResult = validateA2UIComponent(component);
            if (!compResult.valid) {
                errors.push.apply(errors, compResult.errors.map(function (e) { return (__assign(__assign({}, e), { path: "components[".concat(index, "]").concat(e.path ? "." + e.path : "") })); }));
            }
            warnings.push.apply(warnings, compResult.warnings.map(function (w) { return (__assign(__assign({}, w), { path: "components[".concat(index, "]").concat(w.path ? "." + w.path : "") })); }));
        });
    }
    // Validate layout if present
    if (r.layout !== undefined) {
        var layoutResult = validateA2UILayout(r.layout);
        if (!layoutResult.valid) {
            errors.push.apply(errors, layoutResult.errors.map(function (e) { return (__assign(__assign({}, e), { path: "layout".concat(e.path ? "." + e.path : "") })); }));
        }
    }
    // Validate actions if present
    if (r.actions !== undefined) {
        if (!Array.isArray(r.actions)) {
            errors.push({
                code: "INVALID_ACTIONS",
                message: "Actions must be an array",
                path: "actions",
                value: r.actions,
            });
        }
    }
    return {
        valid: errors.length === 0,
        errors: errors,
        warnings: warnings,
    };
}
/**
 * Validate A2UI Component
 *
 * @param component - Component to validate
 * @returns Validation result
 */
function validateA2UIComponent(component) {
    var errors = [];
    var warnings = [];
    if (!component || typeof component !== "object") {
        errors.push({
            code: "INVALID_TYPE",
            message: "Component must be an object",
            value: component,
        });
        return { valid: false, errors: errors, warnings: warnings };
    }
    var c = component;
    // Validate type
    if (!c.type || typeof c.type !== "string") {
        errors.push({
            code: "MISSING_TYPE",
            message: "Component must have a type",
            path: "type",
        });
    }
    // Validate id
    if (!c.id || typeof c.id !== "string") {
        errors.push({
            code: "MISSING_ID",
            message: "Component must have an id",
            path: "id",
        });
    }
    // Validate children if present
    if (c.children !== undefined) {
        if (!Array.isArray(c.children)) {
            errors.push({
                code: "INVALID_CHILDREN",
                message: "Children must be an array",
                path: "children",
            });
        }
        else {
            c.children.forEach(function (child, index) {
                var childResult = validateA2UIComponent(child);
                if (!childResult.valid) {
                    errors.push.apply(errors, childResult.errors.map(function (e) { return (__assign(__assign({}, e), { path: "children[".concat(index, "]").concat(e.path ? "." + e.path : "") })); }));
                }
            });
        }
    }
    return {
        valid: errors.length === 0,
        errors: errors,
        warnings: warnings,
    };
}
/**
 * Validate A2UI Layout
 *
 * @param layout - Layout to validate
 * @returns Validation result
 */
function validateA2UILayout(layout) {
    var errors = [];
    var warnings = [];
    if (!layout || typeof layout !== "object") {
        errors.push({
            code: "INVALID_TYPE",
            message: "Layout must be an object",
            value: layout,
        });
        return { valid: false, errors: errors, warnings: warnings };
    }
    var l = layout;
    var validTypes = [
        "vertical",
        "horizontal",
        "grid",
        "flex",
        "stack",
        "absolute",
    ];
    if (!l.type || !validTypes.includes(l.type)) {
        errors.push({
            code: "INVALID_TYPE",
            message: "Layout type must be one of: ".concat(validTypes.join(", ")),
            path: "type",
            value: l.type,
        });
    }
    return {
        valid: errors.length === 0,
        errors: errors,
        warnings: warnings,
    };
}
/**
 * Sanitize A2UI component props according to schema
 *
 * @param props - Props to sanitize
 * @param schema - Prop schema
 * @returns Sanitized props
 */
function sanitizeA2UIProps(props, schema) {
    var _a, _b;
    var sanitized = {};
    for (var _i = 0, schema_1 = schema; _i < schema_1.length; _i++) {
        var propSchema = schema_1[_i];
        var value = props[propSchema.name];
        // Skip undefined values
        if (value === undefined) {
            if (propSchema.required) {
                console.warn("Missing required prop: ".concat(propSchema.name));
            }
            if (propSchema.default !== undefined) {
                sanitized[propSchema.name] = propSchema.default;
            }
            continue;
        }
        // Type validation
        var isValid = true;
        switch (propSchema.type) {
            case "string":
                isValid = typeof value === "string";
                break;
            case "number":
                isValid = typeof value === "number";
                break;
            case "boolean":
                isValid = typeof value === "boolean";
                break;
            case "array":
                isValid = Array.isArray(value);
                break;
            case "object":
                isValid =
                    typeof value === "object" && value !== null && !Array.isArray(value);
                break;
            case "function":
                isValid = typeof value === "function";
                break;
            case "enum":
                isValid = (_b = (_a = propSchema.enum) === null || _a === void 0 ? void 0 : _a.includes(value)) !== null && _b !== void 0 ? _b : false;
                break;
        }
        if (!isValid) {
            console.warn("Invalid type for prop ".concat(propSchema.name, ": expected ").concat(propSchema.type));
            if (propSchema.default !== undefined) {
                sanitized[propSchema.name] = propSchema.default;
            }
            continue;
        }
        // Custom validation
        if (propSchema.validation) {
            try {
                var valid = propSchema.validation(value);
                if (valid instanceof Promise) {
                    // Skip async validation in sanitization
                    sanitized[propSchema.name] = value;
                }
                else if (!valid) {
                    console.warn("Validation failed for prop: ".concat(propSchema.name));
                    if (propSchema.default !== undefined) {
                        sanitized[propSchema.name] = propSchema.default;
                    }
                    continue;
                }
            }
            catch (e) {
                console.warn("Validation error for prop ".concat(propSchema.name, ":"), e);
                if (propSchema.default !== undefined) {
                    sanitized[propSchema.name] = propSchema.default;
                }
                continue;
            }
        }
        // Sanitization
        if (propSchema.sanitize) {
            try {
                sanitized[propSchema.name] = propSchema.sanitize(value);
            }
            catch (e) {
                console.warn("Sanitization error for prop ".concat(propSchema.name, ":"), e);
                if (propSchema.default !== undefined) {
                    sanitized[propSchema.name] = propSchema.default;
                }
                else {
                    sanitized[propSchema.name] = value;
                }
            }
        }
        else {
            sanitized[propSchema.name] = value;
        }
    }
    return sanitized;
}
/**
 * Create default security policy
 *
 * @returns Default security policy
 */
function createDefaultSecurityPolicy() {
    return {
        maxNestingDepth: 10,
        allowedDataSources: ["*"],
        sanitizeInput: true,
        rateLimit: 60,
        maxComponents: 100,
        allowedHandlers: ["*"],
        blockedUrls: [],
    };
}
/**
 * Create component catalog entry
 *
 * @param entry - Entry configuration
 * @returns Component catalog entry
 */
function createCatalogEntry(entry) {
    return __assign(__assign({}, entry), { security: createDefaultSecurityPolicy() });
}
// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
/**
 * Check if component type is valid
 *
 * @param type - Component type
 * @param catalog - Component catalog
 * @returns Whether type is valid
 */
function isValidComponentType(type, catalog) {
    return catalog.components.has(type);
}
/**
 * Get component schema from catalog
 *
 * @param type - Component type
 * @param catalog - Component catalog
 * @returns Component schema or undefined
 */
function getComponentSchema(type, catalog) {
    return catalog.components.get(type);
}
/**
 * Format validation errors for display
 *
 * @param result - Validation result
 * @returns Formatted error string
 */
function formatValidationErrors(result) {
    var lines = [];
    if (result.errors.length > 0) {
        lines.push("Errors:");
        for (var _i = 0, _a = result.errors; _i < _a.length; _i++) {
            var error = _a[_i];
            var path = error.path ? " at ".concat(error.path) : "";
            lines.push("  - [".concat(error.code, "] ").concat(error.message).concat(path));
        }
    }
    if (result.warnings.length > 0) {
        lines.push("Warnings:");
        for (var _b = 0, _c = result.warnings; _b < _c.length; _b++) {
            var warning = _c[_b];
            var path = warning.path ? " at ".concat(warning.path) : "";
            lines.push("  - [".concat(warning.code, "] ").concat(warning.message).concat(path));
        }
    }
    return lines.join("\n");
}

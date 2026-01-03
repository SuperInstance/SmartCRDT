"use strict";
/**
 * Cartridge Protocol Schema
 *
 * Validation schema for Knowledge Cartridge protocol.
 * Cartridges are self-contained units of domain knowledge that can be loaded,
 * unloaded, and versioned in the ContextPlane.
 *
 * This schema defines:
 * - Manifest structure and validation
 * - Capability declarations
 * - Version negotiation rules
 * - Dependency resolution constraints
 * - Lifecycle management requirements
 *
 * Usage:
 * ```typescript
 * import { CARTRIDGE_SCHEMA, validateCartridgeManifest } from '@lsi/protocol/schemas/cartridge-schema';
 *
 * const manifest = { id: '@lsi/cartridge-medical', version: '1.2.0', ... };
 * const result = validateCartridgeManifest(manifest);
 * if (!result.valid) {
 *   console.error('Invalid manifest:', result.errors);
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
exports.CARTRIDGE_SCHEMA = exports.CARTRIDGE_FILE_ENTRY_FIELDS = exports.CARTRIDGE_CAPABILITIES_FIELDS = exports.CARTRIDGE_MANIFEST_FIELDS = void 0;
exports.validateCartridgeManifest = validateCartridgeManifest;
// ============================================================================
// CARTRIDGE MANIFEST SCHEMA
// ============================================================================
/**
 * Cartridge manifest field definitions
 */
exports.CARTRIDGE_MANIFEST_FIELDS = {
    id: {
        type: "string",
        required: true,
        description: 'Unique identifier (e.g., "@lsi/cartridge-medical")',
        validation: {
            pattern: "^@[a-z0-9-]+/cartridge-[a-z0-9-]+$",
            minLength: 10,
            maxLength: 100,
        },
    },
    version: {
        type: "string",
        required: true,
        description: 'Semantic version (e.g., "1.2.0")',
        validation: {
            pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+(-[0-9A-Za-z-]+(\\.[0-9A-Za-z-]+)*)?(\\+[0-9A-Za-z-]+(\\.[0-9A-Za-z-]+)*)?$",
        },
    },
    name: {
        type: "string",
        required: true,
        description: "Human-readable name",
        validation: {
            minLength: 1,
            maxLength: 200,
        },
    },
    description: {
        type: "string",
        required: true,
        description: "Description of what this cartridge contains",
        validation: {
            minLength: 10,
            maxLength: 5000,
        },
    },
    author: {
        type: "string",
        required: false,
        description: "Author or organization name",
        validation: {
            maxLength: 200,
        },
    },
    license: {
        type: "string",
        required: false,
        description: "License identifier (SPDX)",
        validation: {
            pattern: "^[A-Z0-9\\-+.]+$",
        },
    },
    homepage: {
        type: "string",
        required: false,
        description: "Homepage URL",
        validation: {
            pattern: "^https?://",
        },
    },
    repository: {
        type: "string",
        required: false,
        description: "Repository URL",
        validation: {
            pattern: "^https?://",
        },
    },
    dependencies: {
        type: "array",
        required: true,
        description: "Other cartridges required by this one",
        validation: {
            itemPattern: "^[a-z0-9-]+@[0-9]+\\.[0-9]+\\.[0-9]+$",
        },
    },
    conflicts: {
        type: "array",
        required: true,
        description: "Cartridges that conflict with this one",
        validation: {
            itemPattern: "^[a-z0-9-]+@[0-9]+\\.[0-9]+\\.[0-9]+$",
        },
    },
    capabilities: {
        type: "object",
        required: true,
        description: "Capability declarations",
    },
    metadata: {
        type: "object",
        required: true,
        description: "Additional metadata",
    },
    checksum: {
        type: "string",
        required: true,
        description: "SHA-256 checksum of cartridge contents",
        validation: {
            pattern: "^[a-f0-9]{64}$", // SHA-256 is 64 hex characters
        },
    },
    signature: {
        type: "string",
        required: false,
        description: "Cryptographic signature for verification",
    },
    files: {
        type: "array",
        required: false,
        description: "List of files with checksums for integrity verification",
    },
};
// ============================================================================
// CARTRIDGE CAPABILITIES SCHEMA
// ============================================================================
/**
 * Cartridge capabilities field definitions
 */
exports.CARTRIDGE_CAPABILITIES_FIELDS = {
    domains: {
        type: "array",
        required: true,
        description: "Domains this cartridge specializes in",
        validation: {
            minLength: 1,
            maxLength: 20,
            itemPattern: "^[a-z][a-z0-9-]*$",
        },
    },
    queryTypes: {
        type: "array",
        required: true,
        description: "Which query types this cartridge handles",
        validation: {
            minLength: 1,
            allowedValues: [
                "question",
                "command",
                "code",
                "explanation",
                "comparison",
                "debug",
                "general",
            ],
        },
    },
    embeddingModel: {
        type: "string",
        required: false,
        description: "Optional embedding model used for this cartridge",
    },
    sizeBytes: {
        type: "number",
        required: true,
        description: "Estimated size in bytes when loaded into memory",
        validation: {
            min: 0,
            max: 10 * 1024 * 1024 * 1024, // 10GB max
        },
    },
    loadTimeMs: {
        type: "number",
        required: true,
        description: "Estimated load time in milliseconds",
        validation: {
            min: 0,
            max: 60000, // 1 minute max
        },
    },
    privacyLevel: {
        type: "enum",
        required: true,
        description: "Privacy level required for this cartridge",
        values: ["public", "sensitive", "sovereign"],
    },
};
// ============================================================================
// FILE ENTRY SCHEMA
// ============================================================================
/**
 * Cartridge file entry field definitions
 */
exports.CARTRIDGE_FILE_ENTRY_FIELDS = {
    path: {
        type: "string",
        required: true,
        description: "Relative path to file within cartridge",
        validation: {
            pattern: "^[^/].*$", // Must be relative (no leading /)
        },
    },
    checksum: {
        type: "string",
        required: true,
        description: "SHA-256 checksum of this file",
        validation: {
            pattern: "^[a-f0-9]{64}$",
        },
    },
    size: {
        type: "number",
        required: false,
        description: "File size in bytes",
        validation: {
            min: 0,
        },
    },
};
/**
 * Validate cartridge manifest
 *
 * @param manifest - Manifest to validate
 * @returns Validation result
 */
function validateCartridgeManifest(manifest) {
    var errors = [];
    var warnings = [];
    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
        return {
            valid: false,
            errors: [
                {
                    field: "manifest",
                    message: "Manifest must be an object",
                    code: "INVALID_TYPE",
                    expected: "object",
                    actual: manifest === null ? "null" : typeof manifest,
                },
            ],
            warnings: [],
        };
    }
    var m = manifest;
    // Validate id
    if (!m.id || typeof m.id !== "string") {
        errors.push({
            field: "id",
            message: "ID is required and must be a string",
            code: "REQUIRED_FIELD_MISSING",
        });
    }
    else if (!/^@[a-z0-9-]+\/cartridge-[a-z0-9-]+$/.test(m.id)) {
        errors.push({
            field: "id",
            message: "ID must match pattern: @scope/cartridge-name",
            code: "INVALID_FORMAT",
            expected: "@scope/cartridge-name",
            actual: m.id,
        });
    }
    // Validate version
    if (!m.version || typeof m.version !== "string") {
        errors.push({
            field: "version",
            message: "Version is required and must be a string",
            code: "REQUIRED_FIELD_MISSING",
        });
    }
    else if (!/^[0-9]+\.[0-9]+\.[0-9]+/.test(m.version)) {
        errors.push({
            field: "version",
            message: 'Version must be a valid semantic version (e.g., "1.2.0")',
            code: "INVALID_FORMAT",
            expected: "x.y.z",
            actual: m.version,
        });
    }
    // Validate name
    if (!m.name || typeof m.name !== "string") {
        errors.push({
            field: "name",
            message: "Name is required and must be a string",
            code: "REQUIRED_FIELD_MISSING",
        });
    }
    else if (m.name.length < 1 || m.name.length > 200) {
        errors.push({
            field: "name",
            message: "Name length must be between 1 and 200 characters",
            code: "INVALID_LENGTH",
            expected: "1-200 characters",
            actual: "".concat(m.name.length, " characters"),
        });
    }
    // Validate description
    if (!m.description || typeof m.description !== "string") {
        errors.push({
            field: "description",
            message: "Description is required and must be a string",
            code: "REQUIRED_FIELD_MISSING",
        });
    }
    else if (m.description.length < 10 || m.description.length > 5000) {
        errors.push({
            field: "description",
            message: "Description length must be between 10 and 5000 characters",
            code: "INVALID_LENGTH",
            expected: "10-5000 characters",
            actual: "".concat(m.description.length, " characters"),
        });
    }
    // Validate optional URL fields
    if (m.homepage !== undefined && typeof m.homepage === "string") {
        if (!/^https?:\/\//.test(m.homepage)) {
            errors.push({
                field: "homepage",
                message: "Homepage must be a valid URL starting with http:// or https://",
                code: "INVALID_FORMAT",
                expected: "http://... or https://...",
                actual: m.homepage,
            });
        }
    }
    if (m.repository !== undefined && typeof m.repository === "string") {
        if (!/^https?:\/\//.test(m.repository)) {
            errors.push({
                field: "repository",
                message: "Repository must be a valid URL starting with http:// or https://",
                code: "INVALID_FORMAT",
                expected: "http://... or https://...",
                actual: m.repository,
            });
        }
    }
    // Validate dependencies
    if (!Array.isArray(m.dependencies)) {
        errors.push({
            field: "dependencies",
            message: "Dependencies must be an array",
            code: "INVALID_TYPE",
            expected: "array",
            actual: typeof m.dependencies,
        });
    }
    else {
        for (var i = 0; i < m.dependencies.length; i++) {
            var dep = m.dependencies[i];
            if (typeof dep !== "string" ||
                !/^[a-z0-9-]+@[0-9]+\.[0-9]+\.[0-9]+$/.test(dep)) {
                errors.push({
                    field: "dependencies[".concat(i, "]"),
                    message: "Dependency at index ".concat(i, " must be in format \"name@x.y.z\""),
                    code: "INVALID_FORMAT",
                    expected: "name@x.y.z",
                    actual: String(dep),
                });
            }
        }
    }
    // Validate conflicts
    if (!Array.isArray(m.conflicts)) {
        errors.push({
            field: "conflicts",
            message: "Conflicts must be an array",
            code: "INVALID_TYPE",
            expected: "array",
            actual: typeof m.conflicts,
        });
    }
    // Validate capabilities
    if (!m.capabilities ||
        typeof m.capabilities !== "object" ||
        Array.isArray(m.capabilities)) {
        errors.push({
            field: "capabilities",
            message: "Capabilities is required and must be an object",
            code: "REQUIRED_FIELD_MISSING",
        });
    }
    else if (m.capabilities !== null) {
        var caps = m.capabilities;
        var capErrors = validateCapabilities(caps);
        errors.push.apply(errors, capErrors.errors.map(function (e) { return (__assign(__assign({}, e), { field: "capabilities.".concat(e.field) })); }));
    }
    // Validate metadata
    if (!m.metadata ||
        typeof m.metadata !== "object" ||
        Array.isArray(m.metadata)) {
        errors.push({
            field: "metadata",
            message: "Metadata is required and must be an object",
            code: "REQUIRED_FIELD_MISSING",
        });
    }
    // Validate checksum
    if (!m.checksum || typeof m.checksum !== "string") {
        errors.push({
            field: "checksum",
            message: "Checksum is required and must be a string",
            code: "REQUIRED_FIELD_MISSING",
        });
    }
    else if (!/^[a-f0-9]{64}$/.test(m.checksum)) {
        errors.push({
            field: "checksum",
            message: "Checksum must be a 64-character hexadecimal string (SHA-256)",
            code: "INVALID_FORMAT",
            expected: "64 hex characters",
            actual: "".concat(m.checksum.length, " characters"),
        });
    }
    // Validate files array if present
    if (m.files !== undefined) {
        if (!Array.isArray(m.files)) {
            errors.push({
                field: "files",
                message: "Files must be an array",
                code: "INVALID_TYPE",
                expected: "array",
                actual: typeof m.files,
            });
        }
        else {
            for (var i = 0; i < m.files.length; i++) {
                var file = m.files[i];
                var fileErrors = validateFileEntry(file);
                for (var _i = 0, _a = fileErrors.errors; _i < _a.length; _i++) {
                    var err = _a[_i];
                    errors.push(__assign(__assign({}, err), { field: "files[".concat(i, "].").concat(err.field) }));
                }
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
 * Validate cartridge capabilities
 *
 * @param capabilities - Capabilities to validate
 * @returns Validation result
 */
function validateCapabilities(capabilities) {
    var _a;
    var errors = [];
    var warnings = [];
    // Validate domains
    if (!Array.isArray(capabilities.domains)) {
        errors.push({
            field: "domains",
            message: "Domains must be an array",
            code: "INVALID_TYPE",
            expected: "array",
            actual: typeof capabilities.domains,
        });
    }
    else if (capabilities.domains.length === 0) {
        errors.push({
            field: "domains",
            message: "Domains array cannot be empty",
            code: "INVALID_ARRAY_LENGTH",
        });
    }
    else if (capabilities.domains.length > 20) {
        errors.push({
            field: "domains",
            message: "Cannot have more than 20 domains",
            code: "INVALID_ARRAY_LENGTH",
            expected: "<= 20",
            actual: "".concat(capabilities.domains.length),
        });
    }
    else {
        for (var _i = 0, _b = capabilities.domains; _i < _b.length; _i++) {
            var domain = _b[_i];
            if (typeof domain !== "string" || !/^[a-z][a-z0-9-]*$/.test(domain)) {
                errors.push({
                    field: "domains",
                    message: "Each domain must be a lowercase alphanumeric string (can contain hyphens)",
                    code: "INVALID_FORMAT",
                    expected: "lowercase-alphanumeric",
                    actual: String(domain),
                });
            }
        }
    }
    // Validate queryTypes
    if (!Array.isArray(capabilities.queryTypes)) {
        errors.push({
            field: "queryTypes",
            message: "Query types must be an array",
            code: "INVALID_TYPE",
            expected: "array",
            actual: typeof capabilities.queryTypes,
        });
    }
    else if (capabilities.queryTypes.length === 0) {
        errors.push({
            field: "queryTypes",
            message: "Query types array cannot be empty",
            code: "INVALID_ARRAY_LENGTH",
        });
    }
    else {
        var validQueryTypes = [
            "question",
            "command",
            "code",
            "explanation",
            "comparison",
            "debug",
            "general",
        ];
        for (var _c = 0, _d = capabilities.queryTypes; _c < _d.length; _c++) {
            var qt = _d[_c];
            if (!validQueryTypes.includes(qt)) {
                errors.push({
                    field: "queryTypes",
                    message: "Invalid query type: ".concat(qt, ". Must be one of: ").concat(validQueryTypes.join(", ")),
                    code: "INVALID_ENUM_VALUE",
                    expected: validQueryTypes.join(" | "),
                    actual: String(qt),
                });
            }
        }
    }
    // Validate sizeBytes
    if (typeof capabilities.sizeBytes !== "number") {
        errors.push({
            field: "sizeBytes",
            message: "Size bytes must be a number",
            code: "INVALID_TYPE",
            expected: "number",
            actual: typeof capabilities.sizeBytes,
        });
    }
    else if (capabilities.sizeBytes < 0) {
        errors.push({
            field: "sizeBytes",
            message: "Size bytes cannot be negative",
            code: "VALUE_OUT_OF_RANGE",
            expected: ">= 0",
            actual: String(capabilities.sizeBytes),
        });
    }
    else if (capabilities.sizeBytes > 10 * 1024 * 1024 * 1024) {
        warnings.push({
            field: "sizeBytes",
            message: "Cartridge size exceeds 10GB (may cause memory issues)",
            code: "SIZE_WARNING",
        });
    }
    // Validate loadTimeMs
    if (typeof capabilities.loadTimeMs !== "number") {
        errors.push({
            field: "loadTimeMs",
            message: "Load time must be a number",
            code: "INVALID_TYPE",
            expected: "number",
            actual: typeof capabilities.loadTimeMs,
        });
    }
    else if (capabilities.loadTimeMs < 0) {
        errors.push({
            field: "loadTimeMs",
            message: "Load time cannot be negative",
            code: "VALUE_OUT_OF_RANGE",
            expected: ">= 0",
            actual: String(capabilities.loadTimeMs),
        });
    }
    else if (capabilities.loadTimeMs > 60000) {
        warnings.push({
            field: "loadTimeMs",
            message: "Load time exceeds 1 minute (consider optimization)",
            code: "PERFORMANCE_WARNING",
        });
    }
    // Validate privacyLevel
    var validPrivacyLevels = ["public", "sensitive", "sovereign"];
    if (!capabilities.privacyLevel ||
        !validPrivacyLevels.includes(capabilities.privacyLevel)) {
        errors.push({
            field: "privacyLevel",
            message: "Privacy level must be one of: ".concat(validPrivacyLevels.join(", ")),
            code: "INVALID_ENUM_VALUE",
            expected: validPrivacyLevels.join(" | "),
            actual: String((_a = capabilities.privacyLevel) !== null && _a !== void 0 ? _a : "undefined"),
        });
    }
    return {
        valid: errors.length === 0,
        errors: errors,
        warnings: warnings,
    };
}
/**
 * Validate file entry
 *
 * @param entry - File entry to validate
 * @returns Validation result
 */
function validateFileEntry(entry) {
    var errors = [];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return {
            valid: false,
            errors: [
                {
                    field: "entry",
                    message: "File entry must be an object",
                    code: "INVALID_TYPE",
                    expected: "object",
                    actual: entry === null ? "null" : typeof entry,
                },
            ],
            warnings: [],
        };
    }
    var e = entry;
    if (!e.path || typeof e.path !== "string") {
        errors.push({
            field: "path",
            message: "Path is required and must be a string",
            code: "REQUIRED_FIELD_MISSING",
        });
    }
    else if (e.path.startsWith("/")) {
        errors.push({
            field: "path",
            message: "Path must be relative (cannot start with /)",
            code: "INVALID_FORMAT",
            expected: "relative path",
            actual: e.path,
        });
    }
    if (!e.checksum || typeof e.checksum !== "string") {
        errors.push({
            field: "checksum",
            message: "Checksum is required and must be a string",
            code: "REQUIRED_FIELD_MISSING",
        });
    }
    else if (!/^[a-f0-9]{64}$/.test(e.checksum)) {
        errors.push({
            field: "checksum",
            message: "Checksum must be a 64-character hexadecimal string (SHA-256)",
            code: "INVALID_FORMAT",
            expected: "64 hex characters",
            actual: "".concat(e.checksum.length, " characters"),
        });
    }
    if (e.size !== undefined && typeof e.size !== "number") {
        errors.push({
            field: "size",
            message: "Size must be a number",
            code: "INVALID_TYPE",
            expected: "number",
            actual: typeof e.size,
        });
    }
    else if (typeof e.size === "number" && e.size < 0) {
        errors.push({
            field: "size",
            message: "Size cannot be negative",
            code: "VALUE_OUT_OF_RANGE",
            expected: ">= 0",
            actual: String(e.size),
        });
    }
    return {
        valid: errors.length === 0,
        errors: errors,
        warnings: [],
    };
}
// ============================================================================
// PROTOCOL SPECIFICATION
// ============================================================================
/**
 * Complete Cartridge protocol specification for compliance checking
 */
exports.CARTRIDGE_SCHEMA = {
    name: "Cartridge",
    version: { major: 1, minor: 0, patch: 0 },
    types: [
        {
            name: "CartridgeManifest",
            type: "interface",
            definition: {
                kind: "interface",
                properties: {
                    id: { type: "string", optional: false, readonly: false },
                    version: { type: "string", optional: false, readonly: false },
                    name: { type: "string", optional: false, readonly: false },
                    description: { type: "string", optional: false, readonly: false },
                    author: { type: "string", optional: true, readonly: false },
                    license: { type: "string", optional: true, readonly: false },
                    homepage: { type: "string", optional: true, readonly: false },
                    repository: { type: "string", optional: true, readonly: false },
                    dependencies: { type: "array", optional: false, readonly: false },
                    conflicts: { type: "array", optional: false, readonly: false },
                    capabilities: { type: "object", optional: false, readonly: false },
                    metadata: { type: "object", optional: false, readonly: false },
                    checksum: { type: "string", optional: false, readonly: false },
                    signature: { type: "string", optional: true, readonly: false },
                    files: { type: "array", optional: true, readonly: false },
                },
            },
            required_properties: [
                "id",
                "version",
                "name",
                "description",
                "dependencies",
                "conflicts",
                "capabilities",
                "metadata",
                "checksum",
            ],
            optional_properties: [
                "author",
                "license",
                "homepage",
                "repository",
                "signature",
                "files",
            ],
        },
        {
            name: "CartridgeCapabilities",
            type: "interface",
            definition: {
                kind: "interface",
                properties: {
                    domains: { type: "array", optional: false, readonly: false },
                    queryTypes: { type: "array", optional: false, readonly: false },
                    embeddingModel: { type: "string", optional: true, readonly: false },
                    sizeBytes: { type: "number", optional: false, readonly: false },
                    loadTimeMs: { type: "number", optional: false, readonly: false },
                    privacyLevel: { type: "string", optional: false, readonly: false },
                },
            },
            required_properties: [
                "domains",
                "queryTypes",
                "sizeBytes",
                "loadTimeMs",
                "privacyLevel",
            ],
            optional_properties: ["embeddingModel"],
        },
        {
            name: "CartridgeFileEntry",
            type: "interface",
            definition: {
                kind: "interface",
                properties: {
                    path: { type: "string", optional: false, readonly: false },
                    checksum: { type: "string", optional: false, readonly: false },
                    size: { type: "number", optional: true, readonly: false },
                },
            },
            required_properties: ["path", "checksum"],
            optional_properties: ["size"],
        },
        {
            name: "CartridgeState",
            type: "enum",
            definition: {
                kind: "enum",
                values: {
                    UNLOADED: "unloaded",
                    LOADING: "loading",
                    LOADED: "loaded",
                    UNLOADING: "unloading",
                    ERROR: "error",
                },
            },
            required_properties: [],
            optional_properties: [],
        },
    ],
    messages: [
        {
            name: "CartridgeLoad",
            direction: "request",
            request_type: "CartridgeManifest",
            response_type: "CartridgeLifecycle",
            flow_control: {
                streaming: false,
                timeout: 120000, // 2 minutes for load
            },
            error_handling: {
                retryable_errors: ["timeout", "dependency_unavailable"],
                non_retryable_errors: ["invalid_manifest", "checksum_mismatch"],
            },
        },
        {
            name: "CartridgeUnload",
            direction: "request",
            request_type: "string", // cartridge ID
            response_type: "void",
        },
    ],
    behaviors: [
        {
            name: "load_cartridge",
            description: "Load cartridge from manifest",
            preconditions: [
                {
                    description: "Manifest is valid",
                    check: function (ctx) { return ctx.parameters.valid === true; },
                },
                {
                    description: "Dependencies are available",
                    check: function (ctx) { return ctx.parameters.dependencies.every(function (d) { return d; }); },
                },
            ],
            postconditions: [
                {
                    description: "Cartridge is loaded",
                    check: function (ctx) { return ctx.result === "loaded"; },
                },
            ],
            invariants: [
                {
                    description: "State transitions are valid",
                    check: function (ctx) {
                        var _a, _b;
                        var from = ctx.parameters.fromState;
                        var to = ctx.result;
                        var validTransitions = {
                            unloaded: ["loading"],
                            loading: ["loaded", "error"],
                            loaded: ["unloading"],
                            unloading: ["unloaded"],
                            error: ["loading"],
                        };
                        return (_b = (_a = validTransitions[from]) === null || _a === void 0 ? void 0 : _a.includes(to)) !== null && _b !== void 0 ? _b : false;
                    },
                },
            ],
        },
    ],
    constraints: [
        {
            name: "max_cartridge_size",
            type: "custom",
            rule: {
                check: function (ctx) {
                    var size = ctx.parameters.sizeBytes;
                    return size <= 10 * 1024 * 1024 * 1024; // 10GB
                },
                violation_message: "Cartridge size exceeds maximum of 10GB",
            },
            severity: "error",
        },
        {
            name: "max_dependencies",
            type: "custom",
            rule: {
                check: function (ctx) {
                    var deps = ctx.parameters.dependencies;
                    return deps.length <= 50;
                },
                violation_message: "Cartridge cannot have more than 50 dependencies",
            },
            severity: "warning",
        },
        {
            name: "no_circular_dependencies",
            type: "custom",
            rule: {
                check: function (ctx) {
                    var circular = ctx.parameters.circular;
                    return circular.length === 0;
                },
                violation_message: "Circular dependencies detected",
            },
            severity: "error",
        },
    ],
    documentation_url: "https://docs.aequor.ai/protocols/cartridge",
};

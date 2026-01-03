"use strict";
/**
 * @lsi/protocol - Protocol Extensions Framework
 *
 * This module defines the extensibility framework for Aequor Cognitive Orchestration Platform.
 * It allows third-party developers to create custom protocols that integrate with Aequor.
 *
 * Features:
 * - ProtocolExtension interface for custom protocols
 * - ExtensionRegistry for managing custom protocols
 * - ExtensionLoader for dynamic loading from file paths and packages
 * - ExtensionValidator for validation and compatibility checking
 * - Extension lifecycle management (load, init, execute, shutdown)
 * - Security hooks for code signing validation
 *
 * Usage:
 * ```typescript
 * import { ExtensionRegistry, ExtensionLoader } from '@lsi/protocol';
 *
 * // Create registry
 * const registry = new ExtensionRegistry();
 *
 * // Load extension from package
 * const loader = new ExtensionLoader();
 * const extension = await loader.load_from_package('@my-org/my-extension');
 *
 * // Register extension
 * registry.register(extension);
 *
 * // Execute extension
 * const result = await extension.execute({
 *   extensionId: 'my-extension',
 *   method: 'process',
 *   params: { data: 'hello' }
 * });
 * ```
 */
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtensionValidator = exports.ExtensionLoader = exports.ExtensionRegistry = void 0;
exports.createSemVer = createSemVer;
exports.formatSemVer = formatSemVer;
exports.createExtensionContext = createExtensionContext;
exports.createValidationResult = createValidationResult;
// ============================================================================
// EXTENSION REGISTRY
// ============================================================================
/**
 * Extension registry for managing protocol extensions
 */
var ExtensionRegistry = /** @class */ (function () {
    function ExtensionRegistry() {
        this.extensions = new Map();
        this.capabilityIndex = new Map();
    }
    /**
     * Register an extension
     *
     * @param extension - Extension to register
     * @throws Error if extension already registered or invalid
     */
    ExtensionRegistry.prototype.register = function (extension) {
        var _a = extension.metadata, id = _a.id, capabilities = _a.capabilities;
        if (this.extensions.has(id)) {
            throw new Error("Extension '".concat(id, "' is already registered"));
        }
        // Validate extension metadata
        var validation = this.validate(extension);
        if (!validation.valid) {
            throw new Error("Invalid extension '".concat(id, "': ").concat(validation.errors.map(function (e) { return e.message; }).join(", ")));
        }
        // Register extension
        this.extensions.set(id, extension);
        // Index capabilities
        for (var _i = 0, capabilities_1 = capabilities; _i < capabilities_1.length; _i++) {
            var cap = capabilities_1[_i];
            if (!this.capabilityIndex.has(cap.type)) {
                this.capabilityIndex.set(cap.type, new Set());
            }
            this.capabilityIndex.get(cap.type).add(id);
        }
    };
    /**
     * Unregister an extension
     *
     * @param extensionId - Extension ID to unregister
     * @returns True if extension was unregistered
     */
    ExtensionRegistry.prototype.unregister = function (extensionId) {
        var extension = this.extensions.get(extensionId);
        if (!extension) {
            return false;
        }
        // Remove from capability index
        for (var _i = 0, _a = extension.metadata.capabilities; _i < _a.length; _i++) {
            var cap = _a[_i];
            var extensions = this.capabilityIndex.get(cap.type);
            if (extensions) {
                extensions.delete(extensionId);
            }
        }
        // Remove extension
        this.extensions.delete(extensionId);
        return true;
    };
    /**
     * Get an extension by ID
     *
     * @param extensionId - Extension ID
     * @returns Extension or undefined
     */
    ExtensionRegistry.prototype.get = function (extensionId) {
        return this.extensions.get(extensionId);
    };
    /**
     * List all registered extensions
     *
     * @returns Array of all extensions
     */
    ExtensionRegistry.prototype.list = function () {
        return Array.from(this.extensions.values());
    };
    /**
     * Find extensions by capability type
     *
     * @param type - Capability type
     * @returns Array of extensions with the capability
     */
    ExtensionRegistry.prototype.findByCapability = function (type) {
        var _this = this;
        var extensionIds = this.capabilityIndex.get(type);
        if (!extensionIds) {
            return [];
        }
        return Array.from(extensionIds)
            .map(function (id) { return _this.extensions.get(id); })
            .filter(function (ext) { return ext !== undefined; });
    };
    /**
     * Validate an extension
     *
     * @param extension - Extension to validate
     * @returns Validation result
     */
    ExtensionRegistry.prototype.validate = function (extension) {
        var errors = [];
        var warnings = [];
        // Validate metadata
        var metadata = extension.metadata;
        // Check required fields
        if (!metadata.id || typeof metadata.id !== "string") {
            errors.push({
                field: "metadata.id",
                message: "Extension ID is required and must be a string",
                code: "MISSING_ID",
            });
        }
        if (!metadata.name || typeof metadata.name !== "string") {
            errors.push({
                field: "metadata.name",
                message: "Extension name is required and must be a string",
                code: "MISSING_NAME",
            });
        }
        if (!metadata.author || typeof metadata.author !== "string") {
            errors.push({
                field: "metadata.author",
                message: "Extension author is required and must be a string",
                code: "MISSING_AUTHOR",
            });
        }
        if (!metadata.description || typeof metadata.description !== "string") {
            errors.push({
                field: "metadata.description",
                message: "Extension description is required and must be a string",
                code: "MISSING_DESCRIPTION",
            });
        }
        if (!metadata.license || typeof metadata.license !== "string") {
            errors.push({
                field: "metadata.license",
                message: "Extension license is required and must be a string",
                code: "MISSING_LICENSE",
            });
        }
        // Validate version
        if (!metadata.version) {
            errors.push({
                field: "metadata.version",
                message: "Extension version is required",
                code: "MISSING_VERSION",
            });
        }
        // Validate protocol version
        if (!metadata.protocolVersion) {
            errors.push({
                field: "metadata.protocolVersion",
                message: "Protocol version is required",
                code: "MISSING_PROTOCOL_VERSION",
            });
        }
        // Validate capabilities
        if (!metadata.capabilities || !Array.isArray(metadata.capabilities)) {
            errors.push({
                field: "metadata.capabilities",
                message: "Capabilities must be an array",
                code: "INVALID_CAPABILITIES",
            });
        }
        else if (metadata.capabilities.length === 0) {
            warnings.push({
                field: "metadata.capabilities",
                message: "Extension has no capabilities declared",
                code: "NO_CAPABILITIES",
            });
        }
        // Validate required methods
        if (typeof extension.initialize !== "function") {
            errors.push({
                field: "initialize",
                message: "Extension must implement initialize() method",
                code: "MISSING_INITIALIZE",
            });
        }
        if (typeof extension.register !== "function") {
            errors.push({
                field: "register",
                message: "Extension must implement register() method",
                code: "MISSING_REGISTER",
            });
        }
        if (typeof extension.execute !== "function") {
            errors.push({
                field: "execute",
                message: "Extension must implement execute() method",
                code: "MISSING_EXECUTE",
            });
        }
        if (typeof extension.shutdown !== "function") {
            errors.push({
                field: "shutdown",
                message: "Extension must implement shutdown() method",
                code: "MISSING_SHUTDOWN",
            });
        }
        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings,
        };
    };
    Object.defineProperty(ExtensionRegistry.prototype, "size", {
        /**
         * Get the number of registered extensions
         */
        get: function () {
            return this.extensions.size;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Check if an extension is registered
     *
     * @param extensionId - Extension ID
     * @returns True if registered
     */
    ExtensionRegistry.prototype.has = function (extensionId) {
        return this.extensions.has(extensionId);
    };
    return ExtensionRegistry;
}());
exports.ExtensionRegistry = ExtensionRegistry;
/**
 * Extension loader for dynamic loading
 */
var ExtensionLoader = /** @class */ (function () {
    function ExtensionLoader() {
        this.validator = new ExtensionValidator();
    }
    /**
     * Load extension from file path
     *
     * @param path - File path to extension module
     * @param options - Loading options
     * @returns Loaded extension
     */
    ExtensionLoader.prototype.load_from_path = function (path_1) {
        return __awaiter(this, arguments, void 0, function (path, options) {
            var module_1, ExtensionClass, extension, validation, error_1;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 6, , 7]);
                        return [4 /*yield*/, Promise.resolve("".concat(path)).then(function (s) { return require(s); })];
                    case 1:
                        module_1 = _a.sent();
                        ExtensionClass = module_1.default || module_1.ProtocolExtension;
                        if (!ExtensionClass) {
                            throw new Error("No export found in ".concat(path));
                        }
                        extension = new ExtensionClass();
                        if (!(options.validate !== false)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.validate(extension)];
                    case 2:
                        validation = _a.sent();
                        if (!validation.valid) {
                            throw new Error("Extension validation failed: ".concat(validation.errors.map(function (e) { return e.message; }).join(", ")));
                        }
                        _a.label = 3;
                    case 3:
                        if (!(options.initialize && options.context)) return [3 /*break*/, 5];
                        return [4 /*yield*/, extension.initialize(options.context)];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5: return [2 /*return*/, extension];
                    case 6:
                        error_1 = _a.sent();
                        throw new Error("Failed to load extension from ".concat(path, ": ").concat(error_1 instanceof Error ? error_1.message : String(error_1)));
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Load extension from npm package
     *
     * @param packageName - Package name
     * @param options - Loading options
     * @returns Loaded extension
     */
    ExtensionLoader.prototype.load_from_package = function (packageName_1) {
        return __awaiter(this, arguments, void 0, function (packageName, options) {
            var module_2, ExtensionClass, extension, validation, error_2;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 6, , 7]);
                        return [4 /*yield*/, Promise.resolve("".concat(packageName)).then(function (s) { return require(s); })];
                    case 1:
                        module_2 = _a.sent();
                        ExtensionClass = module_2.default || module_2.ProtocolExtension;
                        if (!ExtensionClass) {
                            throw new Error("No export found in ".concat(packageName));
                        }
                        extension = new ExtensionClass();
                        if (!(options.validate !== false)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.validate(extension)];
                    case 2:
                        validation = _a.sent();
                        if (!validation.valid) {
                            throw new Error("Extension validation failed: ".concat(validation.errors.map(function (e) { return e.message; }).join(", ")));
                        }
                        _a.label = 3;
                    case 3:
                        if (!(options.initialize && options.context)) return [3 /*break*/, 5];
                        return [4 /*yield*/, extension.initialize(options.context)];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5: return [2 /*return*/, extension];
                    case 6:
                        error_2 = _a.sent();
                        throw new Error("Failed to load extension from package ".concat(packageName, ": ").concat(error_2 instanceof Error ? error_2.message : String(error_2)));
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Load all extensions from a directory
     *
     * @param directory - Directory path
     * @param options - Loading options
     * @returns Array of loaded extensions
     */
    ExtensionLoader.prototype.load_from_directory = function (directory_1) {
        return __awaiter(this, arguments, void 0, function (directory, options) {
            var fs, path, extensions, entries, _i, entries_1, entry, fullPath, extension, error_3, error_4;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require("fs/promises"); })];
                    case 1:
                        fs = _a.sent();
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("path"); })];
                    case 2:
                        path = _a.sent();
                        extensions = [];
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 11, , 12]);
                        return [4 /*yield*/, fs.readdir(directory, { withFileTypes: true })];
                    case 4:
                        entries = _a.sent();
                        _i = 0, entries_1 = entries;
                        _a.label = 5;
                    case 5:
                        if (!(_i < entries_1.length)) return [3 /*break*/, 10];
                        entry = entries_1[_i];
                        if (!(entry.isFile() &&
                            (entry.name.endsWith(".js") || entry.name.endsWith(".mjs")))) return [3 /*break*/, 9];
                        fullPath = path.join(directory, entry.name);
                        _a.label = 6;
                    case 6:
                        _a.trys.push([6, 8, , 9]);
                        return [4 /*yield*/, this.load_from_path(fullPath, options)];
                    case 7:
                        extension = _a.sent();
                        extensions.push(extension);
                        return [3 /*break*/, 9];
                    case 8:
                        error_3 = _a.sent();
                        // Log error but continue loading other extensions
                        console.warn("Failed to load extension from ".concat(fullPath, ":"), error_3);
                        return [3 /*break*/, 9];
                    case 9:
                        _i++;
                        return [3 /*break*/, 5];
                    case 10: return [3 /*break*/, 12];
                    case 11:
                        error_4 = _a.sent();
                        throw new Error("Failed to load extensions from directory ".concat(directory, ": ").concat(error_4 instanceof Error ? error_4.message : String(error_4)));
                    case 12: return [2 /*return*/, extensions];
                }
            });
        });
    };
    /**
     * Validate an extension
     *
     * @param extension - Extension to validate
     * @returns Validation result
     */
    ExtensionLoader.prototype.validate = function (extension) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.validator.validate(extension)];
            });
        });
    };
    return ExtensionLoader;
}());
exports.ExtensionLoader = ExtensionLoader;
// ============================================================================
// EXTENSION VALIDATOR
// ============================================================================
/**
 * Extension validator for validation and compatibility checking
 */
var ExtensionValidator = /** @class */ (function () {
    function ExtensionValidator() {
    }
    /**
     * Validate extension metadata
     *
     * @param metadata - Metadata to validate
     * @returns Validation result
     */
    ExtensionValidator.prototype.validate_metadata = function (metadata) {
        var errors = [];
        var warnings = [];
        // Validate ID format (should be @scope/name or local-name)
        if (!metadata.id) {
            errors.push({
                field: "id",
                message: "ID is required",
                code: "MISSING_ID",
            });
        }
        else if (!/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(metadata.id)) {
            errors.push({
                field: "id",
                message: "ID must be a valid package identifier (e.g., @scope/name or name)",
                code: "INVALID_ID_FORMAT",
            });
        }
        // Validate name
        if (!metadata.name) {
            errors.push({
                field: "name",
                message: "Name is required",
                code: "MISSING_NAME",
            });
        }
        else if (metadata.name.length > 100) {
            warnings.push({
                field: "name",
                message: "Name is very long (>100 characters)",
                code: "LONG_NAME",
            });
        }
        // Validate author
        if (!metadata.author) {
            errors.push({
                field: "author",
                message: "Author is required",
                code: "MISSING_AUTHOR",
            });
        }
        // Validate description
        if (!metadata.description) {
            errors.push({
                field: "description",
                message: "Description is required",
                code: "MISSING_DESCRIPTION",
            });
        }
        else if (metadata.description.length < 10) {
            warnings.push({
                field: "description",
                message: "Description is very short (<10 characters)",
                code: "SHORT_DESCRIPTION",
            });
        }
        // Validate version
        if (!metadata.version) {
            errors.push({
                field: "version",
                message: "Version is required",
                code: "MISSING_VERSION",
            });
        }
        else if (typeof metadata.version !== "object") {
            errors.push({
                field: "version",
                message: "Version must be a SemVer object",
                code: "INVALID_VERSION_TYPE",
            });
        }
        else {
            // Check SemVer components
            var semver = metadata.version;
            if (typeof semver.major !== "number" || semver.major < 0) {
                errors.push({
                    field: "version.major",
                    message: "Major version must be a non-negative number",
                    code: "INVALID_MAJOR_VERSION",
                });
            }
            if (typeof semver.minor !== "number" || semver.minor < 0) {
                errors.push({
                    field: "version.minor",
                    message: "Minor version must be a non-negative number",
                    code: "INVALID_MINOR_VERSION",
                });
            }
            if (typeof semver.patch !== "number" || semver.patch < 0) {
                errors.push({
                    field: "version.patch",
                    message: "Patch version must be a non-negative number",
                    code: "INVALID_PATCH_VERSION",
                });
            }
        }
        // Validate protocol version
        if (!metadata.protocolVersion) {
            errors.push({
                field: "protocolVersion",
                message: "Protocol version is required",
                code: "MISSING_PROTOCOL_VERSION",
            });
        }
        // Validate license
        if (!metadata.license) {
            errors.push({
                field: "license",
                message: "License is required",
                code: "MISSING_LICENSE",
            });
        }
        // Validate capabilities
        if (!metadata.capabilities || !Array.isArray(metadata.capabilities)) {
            errors.push({
                field: "capabilities",
                message: "Capabilities must be an array",
                code: "INVALID_CAPABILITIES_TYPE",
            });
        }
        else if (metadata.capabilities.length === 0) {
            warnings.push({
                field: "capabilities",
                message: "No capabilities declared",
                code: "NO_CAPABILITIES",
            });
        }
        else {
            // Validate each capability
            for (var i = 0; i < metadata.capabilities.length; i++) {
                var cap = metadata.capabilities[i];
                if (!cap.type) {
                    errors.push({
                        field: "capabilities[".concat(i, "].type"),
                        message: "Capability type is required",
                        code: "MISSING_CAPABILITY_TYPE",
                    });
                }
                if (!cap.interface) {
                    errors.push({
                        field: "capabilities[".concat(i, "].interface"),
                        message: "Capability interface is required",
                        code: "MISSING_CAPABILITY_INTERFACE",
                    });
                }
                if (!cap.version) {
                    errors.push({
                        field: "capabilities[".concat(i, "].version"),
                        message: "Capability version is required",
                        code: "MISSING_CAPABILITY_VERSION",
                    });
                }
            }
        }
        // Validate dependencies
        if (metadata.dependencies) {
            if (!Array.isArray(metadata.dependencies)) {
                errors.push({
                    field: "dependencies",
                    message: "Dependencies must be an array",
                    code: "INVALID_DEPENDENCIES_TYPE",
                });
            }
        }
        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings,
        };
    };
    /**
     * Validate extension interface
     *
     * @param extension - Extension to validate
     * @returns Validation result
     */
    ExtensionValidator.prototype.validate_interface = function (extension) {
        var errors = [];
        var warnings = [];
        // Check required methods
        var requiredMethods = [
            "initialize",
            "register",
            "execute",
            "shutdown",
        ];
        for (var _i = 0, requiredMethods_1 = requiredMethods; _i < requiredMethods_1.length; _i++) {
            var method = requiredMethods_1[_i];
            if (typeof extension[method] !== "function") {
                errors.push({
                    field: method,
                    message: "Extension must implement ".concat(method, "() method"),
                    code: "MISSING_".concat(method.toUpperCase()),
                });
            }
        }
        // Check metadata
        if (!extension.metadata) {
            errors.push({
                field: "metadata",
                message: "Extension must have metadata",
                code: "MISSING_METADATA",
            });
        }
        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings,
        };
    };
    /**
     * Validate extension dependencies
     *
     * @param metadata - Extension metadata
     * @param registry - Extension registry
     * @returns Validation result
     */
    ExtensionValidator.prototype.validate_dependencies = function (metadata, registry) {
        var errors = [];
        var warnings = [];
        if (metadata.dependencies) {
            for (var _i = 0, _a = metadata.dependencies; _i < _a.length; _i++) {
                var dep = _a[_i];
                if (!registry.has(dep)) {
                    errors.push({
                        field: "dependencies",
                        message: "Missing dependency: ".concat(dep),
                        code: "MISSING_DEPENDENCY",
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
     * Check compatibility with platform version
     *
     * @param extension - Extension to check
     * @param platformVersion - Platform version
     * @returns Compatibility result
     */
    ExtensionValidator.prototype.check_compatibility = function (extension, platformVersion) {
        var issues = [];
        var suggestions = [];
        var score = 1.0;
        // Check protocol version compatibility
        var extProtocolVer = extension.metadata.protocolVersion;
        if (extProtocolVer.major > platformVersion.major) {
            issues.push({
                severity: "error",
                message: "Extension requires protocol version ".concat(extProtocolVer.major, ".").concat(extProtocolVer.minor, ".").concat(extProtocolVer.patch, ", but platform is ").concat(platformVersion.major, ".").concat(platformVersion.minor, ".").concat(platformVersion.patch),
                component: "protocolVersion",
            });
            score -= 0.5;
        }
        else if (extProtocolVer.major < platformVersion.major - 1) {
            issues.push({
                severity: "warning",
                message: "Extension targets an older protocol version (".concat(extProtocolVer.major, ".").concat(extProtocolVer.minor, ".").concat(extProtocolVer.patch, ")"),
                component: "protocolVersion",
            });
            score -= 0.1;
            suggestions.push("Consider updating the extension to target a newer protocol version");
        }
        // Check for missing capabilities
        if (!extension.metadata.capabilities ||
            extension.metadata.capabilities.length === 0) {
            issues.push({
                severity: "warning",
                message: "Extension declares no capabilities",
                component: "capabilities",
            });
            score -= 0.1;
        }
        return {
            compatible: score >= 0.5,
            score: Math.max(0, score),
            issues: issues,
            suggestions: suggestions,
        };
    };
    /**
     * Validate extension (comprehensive)
     *
     * @param extension - Extension to validate
     * @returns Validation result
     */
    ExtensionValidator.prototype.validate = function (extension) {
        var errors = [];
        var warnings = [];
        // Validate metadata
        var metadataResult = this.validate_metadata(extension.metadata);
        errors.push.apply(errors, metadataResult.errors);
        warnings.push.apply(warnings, metadataResult.warnings);
        // Validate interface
        var interfaceResult = this.validate_interface(extension);
        errors.push.apply(errors, interfaceResult.errors);
        warnings.push.apply(warnings, interfaceResult.warnings);
        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings,
        };
    };
    return ExtensionValidator;
}());
exports.ExtensionValidator = ExtensionValidator;
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
/**
 * Create a SemVer object
 *
 * @param version - Version string (e.g., "1.2.3") or components
 * @returns SemVer object
 */
function createSemVer(version) {
    if (typeof version === "string") {
        var match = /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?(?:\+([a-zA-Z0-9.-]+))?$/.exec(version);
        if (!match) {
            throw new Error("Invalid semver string: ".concat(version));
        }
        return {
            major: parseInt(match[1], 10),
            minor: parseInt(match[2], 10),
            patch: parseInt(match[3], 10),
            prerelease: match[4],
            build: match[5],
        };
    }
    return version;
}
/**
 * Format SemVer as string
 *
 * @param version - SemVer object
 * @returns Version string
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
 * Create extension context
 *
 * @param logger - Logger implementation
 * @param config - Configuration
 * @param services - Service registry
 * @param workingDirectory - Working directory
 * @param platformVersion - Platform version
 * @returns Extension context
 */
function createExtensionContext(logger, config, services, workingDirectory, platformVersion) {
    return {
        logger: logger,
        config: config,
        services: services,
        workingDirectory: workingDirectory,
        platformVersion: platformVersion,
    };
}
/**
 * Create validation result
 *
 * @param errors - Validation errors
 * @param warnings - Validation warnings
 * @returns Validation result
 */
function createValidationResult(errors, warnings) {
    if (warnings === void 0) { warnings = []; }
    return {
        valid: errors.length === 0,
        errors: errors,
        warnings: warnings,
    };
}

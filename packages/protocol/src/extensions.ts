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

// ============================================================================
// EXTENSION METADATA AND CAPABILITIES
// ============================================================================

/**
 * Semantic version for extension compatibility
 */
export interface SemVer {
  /** Major version */
  major: number;
  /** Minor version */
  minor: number;
  /** Patch version */
  patch: number;
  /** Pre-release identifier (optional) */
  prerelease?: string;
  /** Build metadata (optional) */
  build?: string;
}

/**
 * Extension capability type
 */
export type ExtensionCapabilityType =
  | "router" // Custom routing logic
  | "cache" // Custom caching implementation
  | "privacy" // Custom privacy protocols
  | "training" // Custom training pipelines
  | "custom"; // Fully custom extension

/**
 * Extension capability declaration
 */
export interface ExtensionCapability {
  /** Type of capability */
  type: ExtensionCapabilityType;
  /** Interface name this capability implements */
  interface: string;
  /** Minimum version of interface supported */
  version: SemVer;
  /** Optional capability-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Extension metadata
 */
export interface ProtocolExtensionMetadata {
  /** Unique extension identifier (e.g., '@org/extension-name') */
  id: string;
  /** Human-readable extension name */
  name: string;
  /** Extension version */
  version: SemVer;
  /** Extension author */
  author: string;
  /** Extension description */
  description: string;
  /** Minimum Aequor protocol version required */
  protocolVersion: SemVer;
  /** List of extension IDs this extension depends on */
  dependencies?: string[];
  /** Capabilities provided by this extension */
  capabilities: ExtensionCapability[];
  /** Extension homepage URL */
  homepage?: string;
  /** Repository URL */
  repository?: string;
  /** License */
  license: string;
  /** List of extension keywords/tags */
  keywords?: string[];
}

// ============================================================================
// EXTENSION CONTEXT AND CONFIGURATION
// ============================================================================

/**
 * Logger interface for extensions
 */
export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Configuration interface for extensions
 */
export interface Config {
  get(key: string): unknown;
  get<T>(key: string, defaultValue: T): T;
  has(key: string): boolean;
  set(key: string, value: unknown): void;
}

/**
 * Service registry for accessing platform services
 */
export interface ServiceRegistry {
  getService(name: string): unknown;
  hasService(name: string): boolean;
  listServices(): string[];
}

/**
 * Extension context provided during initialization
 */
export interface ExtensionContext {
  /** Logger for the extension */
  logger: Logger;
  /** Configuration access */
  config: Config;
  /** Access to platform services */
  services: ServiceRegistry;
  /** Extension working directory */
  workingDirectory: string;
  /** Platform version information */
  platformVersion: SemVer;
}

/**
 * Execution context for extension requests
 */
export interface ExecutionContext {
  /** Request identifier */
  requestId: string;
  /** User identifier (if applicable) */
  userId?: string;
  /** Session identifier */
  sessionId?: string;
  /** Request timestamp */
  timestamp: number;
  /** Additional context metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// EXTENSION REQUEST AND RESPONSE
// ============================================================================

/**
 * Extension execution request
 */
export interface ExtensionRequest {
  /** Extension ID to execute */
  extensionId: string;
  /** Method name to call */
  method: string;
  /** Method parameters */
  params: Record<string, unknown>;
  /** Execution context */
  context?: ExecutionContext;
}

/**
 * Extension error details
 */
export interface ExtensionError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Stack trace (optional) */
  stack?: string;
  /** Additional error details */
  details?: Record<string, unknown>;
}

/**
 * Response metadata
 */
export interface ResponseMetadata {
  /** Execution time in milliseconds */
  executionTimeMs: number;
  /** Response timestamp */
  timestamp: number;
  /** Extension version that handled the request */
  extensionVersion: SemVer;
  /** Additional metadata */
  additional?: Record<string, unknown>;
}

/**
 * Extension execution response
 */
export interface ExtensionResponse {
  /** Whether execution was successful */
  success: boolean;
  /** Response data (if successful) */
  data?: unknown;
  /** Error details (if failed) */
  error?: ExtensionError;
  /** Response metadata */
  metadata?: ResponseMetadata;
}

// ============================================================================
// VALIDATION RESULTS
// ============================================================================

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors */
  errors: ValidationError[];
  /** Validation warnings */
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Field that failed validation */
  field: string;
  /** Error message */
  message: string;
  /** Error code */
  code: string;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /** Field with warning */
  field: string;
  /** Warning message */
  message: string;
  /** Warning code */
  code: string;
}

/**
 * Compatibility check result
 */
export interface CompatibilityResult {
  /** Whether extension is compatible */
  compatible: boolean;
  /** Compatibility score (0-1) */
  score: number;
  /** Compatibility issues */
  issues: CompatibilityIssue[];
  /** Suggested fixes */
  suggestions: string[];
}

/**
 * Compatibility issue
 */
export interface CompatibilityIssue {
  /** Issue severity */
  severity: "error" | "warning" | "info";
  /** Issue description */
  message: string;
  /** Affected component */
  component: string;
}

// ============================================================================
// PROTOCOL EXTENSION INTERFACE
// ============================================================================

/**
 * Protocol Extension Interface
 *
 * All custom protocol extensions must implement this interface.
 */
export interface ProtocolExtension {
  /** Extension metadata (readonly) */
  readonly metadata: ProtocolExtensionMetadata;

  /**
   * Initialize the extension
   *
   * Called once when the extension is loaded.
   *
   * @param context - Extension context
   * @throws InitializationError if initialization fails
   */
  initialize(context: ExtensionContext): Promise<void>;

  /**
   * Register capabilities with the registry
   *
   * Called after initialization to register the extension's capabilities.
   *
   * @param registry - Extension registry
   */
  register(registry: ExtensionRegistry): Promise<void>;

  /**
   * Execute an extension method
   *
   * Called when a request is routed to this extension.
   *
   * @param request - Extension request
   * @returns Extension response
   */
  execute(request: ExtensionRequest): Promise<ExtensionResponse>;

  /**
   * Shutdown the extension
   *
   * Called when the extension is unloaded or the platform shuts down.
   * Should clean up resources gracefully.
   */
  shutdown(): Promise<void>;

  /**
   * Optional validation method
   *
   * If provided, called to validate extension-specific data.
   *
   * @param data - Data to validate
   * @returns Validation result
   */
  validate?(data: unknown): ValidationResult;

  /**
   * Optional health check method
   *
   * If provided, called to check extension health.
   *
   * @returns Health status (true if healthy)
   */
  healthCheck?(): Promise<boolean>;

  /**
   * Optional code signature verification
   *
   * If provided, called to verify the extension's code signature.
   * This is a security hook for validating extension authenticity.
   *
   * @param signature - Signature to verify
   * @param publicKey - Public key for verification
   * @returns Verification result
   */
  verifySignature?(signature: string, publicKey: string): Promise<boolean>;
}

// ============================================================================
// EXTENSION REGISTRY
// ============================================================================

/**
 * Extension registry for managing protocol extensions
 */
export class ExtensionRegistry {
  private extensions: Map<string, ProtocolExtension>;
  private capabilityIndex: Map<ExtensionCapabilityType, Set<string>>;

  constructor() {
    this.extensions = new Map();
    this.capabilityIndex = new Map();
  }

  /**
   * Register an extension
   *
   * @param extension - Extension to register
   * @throws Error if extension already registered or invalid
   */
  register(extension: ProtocolExtension): void {
    const { id, capabilities } = extension.metadata;

    if (this.extensions.has(id)) {
      throw new Error(`Extension '${id}' is already registered`);
    }

    // Validate extension metadata
    const validation = this.validate(extension);
    if (!validation.valid) {
      throw new Error(
        `Invalid extension '${id}': ${validation.errors.map(e => e.message).join(", ")}`
      );
    }

    // Register extension
    this.extensions.set(id, extension);

    // Index capabilities
    for (const cap of capabilities) {
      if (!this.capabilityIndex.has(cap.type)) {
        this.capabilityIndex.set(cap.type, new Set());
      }
      this.capabilityIndex.get(cap.type)!.add(id);
    }
  }

  /**
   * Unregister an extension
   *
   * @param extensionId - Extension ID to unregister
   * @returns True if extension was unregistered
   */
  unregister(extensionId: string): boolean {
    const extension = this.extensions.get(extensionId);
    if (!extension) {
      return false;
    }

    // Remove from capability index
    for (const cap of extension.metadata.capabilities) {
      const extensions = this.capabilityIndex.get(cap.type);
      if (extensions) {
        extensions.delete(extensionId);
      }
    }

    // Remove extension
    this.extensions.delete(extensionId);
    return true;
  }

  /**
   * Get an extension by ID
   *
   * @param extensionId - Extension ID
   * @returns Extension or undefined
   */
  get(extensionId: string): ProtocolExtension | undefined {
    return this.extensions.get(extensionId);
  }

  /**
   * List all registered extensions
   *
   * @returns Array of all extensions
   */
  list(): ProtocolExtension[] {
    return Array.from(this.extensions.values());
  }

  /**
   * Find extensions by capability type
   *
   * @param type - Capability type
   * @returns Array of extensions with the capability
   */
  findByCapability(type: ExtensionCapabilityType): ProtocolExtension[] {
    const extensionIds = this.capabilityIndex.get(type);
    if (!extensionIds) {
      return [];
    }

    return Array.from(extensionIds)
      .map(id => this.extensions.get(id))
      .filter((ext): ext is ProtocolExtension => ext !== undefined);
  }

  /**
   * Validate an extension
   *
   * @param extension - Extension to validate
   * @returns Validation result
   */
  validate(extension: ProtocolExtension): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate metadata
    const metadata = extension.metadata;

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
    } else if (metadata.capabilities.length === 0) {
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
      errors,
      warnings,
    };
  }

  /**
   * Get the number of registered extensions
   */
  get size(): number {
    return this.extensions.size;
  }

  /**
   * Check if an extension is registered
   *
   * @param extensionId - Extension ID
   * @returns True if registered
   */
  has(extensionId: string): boolean {
    return this.extensions.has(extensionId);
  }
}

// ============================================================================
// EXTENSION LOADER
// ============================================================================

/**
 * Extension loading options
 */
export interface ExtensionLoadOptions {
  /** Whether to initialize after loading */
  initialize?: boolean;
  /** Extension context (for initialization) */
  context?: ExtensionContext;
  /** Whether to validate before loading */
  validate?: boolean;
}

/**
 * Extension loader for dynamic loading
 */
export class ExtensionLoader {
  private validator: ExtensionValidator;

  constructor() {
    this.validator = new ExtensionValidator();
  }

  /**
   * Load extension from file path
   *
   * @param path - File path to extension module
   * @param options - Loading options
   * @returns Loaded extension
   */
  async load_from_path(
    path: string,
    options: ExtensionLoadOptions = {}
  ): Promise<ProtocolExtension> {
    try {
      // Dynamic import (ESM)
      const module = await import(path);

      // Get default export or named export
      const ExtensionClass = module.default || module.ProtocolExtension;

      if (!ExtensionClass) {
        throw new Error(`No export found in ${path}`);
      }

      // Instantiate extension
      const extension: ProtocolExtension = new ExtensionClass();

      // Validate if requested
      if (options.validate !== false) {
        const validation = await this.validate(extension);
        if (!validation.valid) {
          throw new Error(
            `Extension validation failed: ${validation.errors.map(e => e.message).join(", ")}`
          );
        }
      }

      // Initialize if requested and context provided
      if (options.initialize && options.context) {
        await extension.initialize(options.context);
      }

      return extension;
    } catch (error) {
      throw new Error(
        `Failed to load extension from ${path}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Load extension from npm package
   *
   * @param packageName - Package name
   * @param options - Loading options
   * @returns Loaded extension
   */
  async load_from_package(
    packageName: string,
    options: ExtensionLoadOptions = {}
  ): Promise<ProtocolExtension> {
    try {
      // Import from package
      const module = await import(packageName);

      // Get default export or named export
      const ExtensionClass = module.default || module.ProtocolExtension;

      if (!ExtensionClass) {
        throw new Error(`No export found in ${packageName}`);
      }

      // Instantiate extension
      const extension: ProtocolExtension = new ExtensionClass();

      // Validate if requested
      if (options.validate !== false) {
        const validation = await this.validate(extension);
        if (!validation.valid) {
          throw new Error(
            `Extension validation failed: ${validation.errors.map(e => e.message).join(", ")}`
          );
        }
      }

      // Initialize if requested and context provided
      if (options.initialize && options.context) {
        await extension.initialize(options.context);
      }

      return extension;
    } catch (error) {
      throw new Error(
        `Failed to load extension from package ${packageName}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Load all extensions from a directory
   *
   * @param directory - Directory path
   * @param options - Loading options
   * @returns Array of loaded extensions
   */
  async load_from_directory(
    directory: string,
    options: ExtensionLoadOptions = {}
  ): Promise<ProtocolExtension[]> {
    // @ts-ignore - Node.js modules
    const fs = await import("fs/promises");
    // @ts-ignore - Node.js modules
    const path = await import("path");

    const extensions: ProtocolExtension[] = [];

    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        if (
          entry.isFile() &&
          (entry.name.endsWith(".js") || entry.name.endsWith(".mjs"))
        ) {
          const fullPath = path.join(directory, entry.name);
          try {
            const extension = await this.load_from_path(fullPath, options);
            extensions.push(extension);
          } catch (error) {
            // Log error but continue loading other extensions
            console.warn(`Failed to load extension from ${fullPath}:`, error);
          }
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to load extensions from directory ${directory}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return extensions;
  }

  /**
   * Validate an extension
   *
   * @param extension - Extension to validate
   * @returns Validation result
   */
  async validate(extension: ProtocolExtension): Promise<ValidationResult> {
    return this.validator.validate(extension);
  }
}

// ============================================================================
// EXTENSION VALIDATOR
// ============================================================================

/**
 * Extension validator for validation and compatibility checking
 */
export class ExtensionValidator {
  /**
   * Validate extension metadata
   *
   * @param metadata - Metadata to validate
   * @returns Validation result
   */
  validate_metadata(metadata: ProtocolExtensionMetadata): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate ID format (should be @scope/name or local-name)
    if (!metadata.id) {
      errors.push({
        field: "id",
        message: "ID is required",
        code: "MISSING_ID",
      });
    } else if (
      !/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(
        metadata.id
      )
    ) {
      errors.push({
        field: "id",
        message:
          "ID must be a valid package identifier (e.g., @scope/name or name)",
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
    } else if (metadata.name.length > 100) {
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
    } else if (metadata.description.length < 10) {
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
    } else if (typeof metadata.version !== "object") {
      errors.push({
        field: "version",
        message: "Version must be a SemVer object",
        code: "INVALID_VERSION_TYPE",
      });
    } else {
      // Check SemVer components
      const semver = metadata.version;
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
    } else if (metadata.capabilities.length === 0) {
      warnings.push({
        field: "capabilities",
        message: "No capabilities declared",
        code: "NO_CAPABILITIES",
      });
    } else {
      // Validate each capability
      for (let i = 0; i < metadata.capabilities.length; i++) {
        const cap = metadata.capabilities[i];
        if (!cap.type) {
          errors.push({
            field: `capabilities[${i}].type`,
            message: "Capability type is required",
            code: "MISSING_CAPABILITY_TYPE",
          });
        }
        if (!cap.interface) {
          errors.push({
            field: `capabilities[${i}].interface`,
            message: "Capability interface is required",
            code: "MISSING_CAPABILITY_INTERFACE",
          });
        }
        if (!cap.version) {
          errors.push({
            field: `capabilities[${i}].version`,
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
      errors,
      warnings,
    };
  }

  /**
   * Validate extension interface
   *
   * @param extension - Extension to validate
   * @returns Validation result
   */
  validate_interface(extension: ProtocolExtension): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check required methods
    const requiredMethods = [
      "initialize",
      "register",
      "execute",
      "shutdown",
    ] as const;

    for (const method of requiredMethods) {
      if (typeof extension[method] !== "function") {
        errors.push({
          field: method,
          message: `Extension must implement ${method}() method`,
          code: `MISSING_${method.toUpperCase()}`,
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
      errors,
      warnings,
    };
  }

  /**
   * Validate extension dependencies
   *
   * @param metadata - Extension metadata
   * @param registry - Extension registry
   * @returns Validation result
   */
  validate_dependencies(
    metadata: ProtocolExtensionMetadata,
    registry: ExtensionRegistry
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (metadata.dependencies) {
      for (const dep of metadata.dependencies) {
        if (!registry.has(dep)) {
          errors.push({
            field: "dependencies",
            message: `Missing dependency: ${dep}`,
            code: "MISSING_DEPENDENCY",
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check compatibility with platform version
   *
   * @param extension - Extension to check
   * @param platformVersion - Platform version
   * @returns Compatibility result
   */
  check_compatibility(
    extension: ProtocolExtension,
    platformVersion: SemVer
  ): CompatibilityResult {
    const issues: CompatibilityIssue[] = [];
    const suggestions: string[] = [];
    let score = 1.0;

    // Check protocol version compatibility
    const extProtocolVer = extension.metadata.protocolVersion;
    if (extProtocolVer.major > platformVersion.major) {
      issues.push({
        severity: "error",
        message: `Extension requires protocol version ${extProtocolVer.major}.${extProtocolVer.minor}.${extProtocolVer.patch}, but platform is ${platformVersion.major}.${platformVersion.minor}.${platformVersion.patch}`,
        component: "protocolVersion",
      });
      score -= 0.5;
    } else if (extProtocolVer.major < platformVersion.major - 1) {
      issues.push({
        severity: "warning",
        message: `Extension targets an older protocol version (${extProtocolVer.major}.${extProtocolVer.minor}.${extProtocolVer.patch})`,
        component: "protocolVersion",
      });
      score -= 0.1;
      suggestions.push(
        "Consider updating the extension to target a newer protocol version"
      );
    }

    // Check for missing capabilities
    if (
      !extension.metadata.capabilities ||
      extension.metadata.capabilities.length === 0
    ) {
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
      issues,
      suggestions,
    };
  }

  /**
   * Validate extension (comprehensive)
   *
   * @param extension - Extension to validate
   * @returns Validation result
   */
  validate(extension: ProtocolExtension): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate metadata
    const metadataResult = this.validate_metadata(extension.metadata);
    errors.push(...metadataResult.errors);
    warnings.push(...metadataResult.warnings);

    // Validate interface
    const interfaceResult = this.validate_interface(extension);
    errors.push(...interfaceResult.errors);
    warnings.push(...interfaceResult.warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a SemVer object
 *
 * @param version - Version string (e.g., "1.2.3") or components
 * @returns SemVer object
 */
export function createSemVer(
  version:
    | string
    | {
        major: number;
        minor: number;
        patch: number;
        prerelease?: string;
        build?: string;
      }
): SemVer {
  if (typeof version === "string") {
    const match =
      /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?(?:\+([a-zA-Z0-9.-]+))?$/.exec(
        version
      );
    if (!match) {
      throw new Error(`Invalid semver string: ${version}`);
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
export function formatSemVer(version: SemVer): string {
  let result = `${version.major}.${version.minor}.${version.patch}`;
  if (version.prerelease) {
    result += `-${version.prerelease}`;
  }
  if (version.build) {
    result += `+${version.build}`;
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
export function createExtensionContext(
  logger: Logger,
  config: Config,
  services: ServiceRegistry,
  workingDirectory: string,
  platformVersion: SemVer
): ExtensionContext {
  return {
    logger,
    config,
    services,
    workingDirectory,
    platformVersion,
  };
}

/**
 * Create validation result
 *
 * @param errors - Validation errors
 * @param warnings - Validation warnings
 * @returns Validation result
 */
export function createValidationResult(
  errors: ValidationError[],
  warnings: ValidationWarning[] = []
): ValidationResult {
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

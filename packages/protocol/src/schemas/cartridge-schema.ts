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

import type { ProtocolSpecification } from "../compliance.js";
import type {
  CartridgeManifest,
  CartridgeCapabilities,
  CartridgeFileEntry,
  CartridgeNegotiation,
  CartridgeVersion,
  CompatibilityResult,
  CartridgeState,
  CartridgeLifecycle,
  ValidationResult,
  DependencyNode,
  CartridgeRegistryEntry,
  CartridgeLoadOptions,
  CartridgeLoadProgress,
  DependencyResolutionResult,
  VersionConstraint,
  CartridgeStats,
  QueryType,
} from "../cartridge.js";

// ============================================================================
// CARTRIDGE MANIFEST SCHEMA
// ============================================================================

/**
 * Cartridge manifest field definitions
 */
export const CARTRIDGE_MANIFEST_FIELDS = {
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
      pattern:
        "^[0-9]+\\.[0-9]+\\.[0-9]+(-[0-9A-Za-z-]+(\\.[0-9A-Za-z-]+)*)?(\\+[0-9A-Za-z-]+(\\.[0-9A-Za-z-]+)*)?$",
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
} as const;

// ============================================================================
// CARTRIDGE CAPABILITIES SCHEMA
// ============================================================================

/**
 * Cartridge capabilities field definitions
 */
export const CARTRIDGE_CAPABILITIES_FIELDS = {
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
} as const;

// ============================================================================
// FILE ENTRY SCHEMA
// ============================================================================

/**
 * Cartridge file entry field definitions
 */
export const CARTRIDGE_FILE_ENTRY_FIELDS = {
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
interface SchemaValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validate cartridge manifest
 *
 * @param manifest - Manifest to validate
 * @returns Validation result
 */
export function validateCartridgeManifest(
  manifest: unknown
): SchemaValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

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

  const m = manifest as Record<string, unknown>;

  // Validate id
  if (!m.id || typeof m.id !== "string") {
    errors.push({
      field: "id",
      message: "ID is required and must be a string",
      code: "REQUIRED_FIELD_MISSING",
    });
  } else if (!/^@[a-z0-9-]+\/cartridge-[a-z0-9-]+$/.test(m.id)) {
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
  } else if (!/^[0-9]+\.[0-9]+\.[0-9]+/.test(m.version)) {
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
  } else if (m.name.length < 1 || m.name.length > 200) {
    errors.push({
      field: "name",
      message: "Name length must be between 1 and 200 characters",
      code: "INVALID_LENGTH",
      expected: "1-200 characters",
      actual: `${m.name.length} characters`,
    });
  }

  // Validate description
  if (!m.description || typeof m.description !== "string") {
    errors.push({
      field: "description",
      message: "Description is required and must be a string",
      code: "REQUIRED_FIELD_MISSING",
    });
  } else if (m.description.length < 10 || m.description.length > 5000) {
    errors.push({
      field: "description",
      message: "Description length must be between 10 and 5000 characters",
      code: "INVALID_LENGTH",
      expected: "10-5000 characters",
      actual: `${m.description.length} characters`,
    });
  }

  // Validate optional URL fields
  if (m.homepage !== undefined && typeof m.homepage === "string") {
    if (!/^https?:\/\//.test(m.homepage)) {
      errors.push({
        field: "homepage",
        message:
          "Homepage must be a valid URL starting with http:// or https://",
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
        message:
          "Repository must be a valid URL starting with http:// or https://",
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
  } else {
    for (let i = 0; i < m.dependencies.length; i++) {
      const dep = m.dependencies[i];
      if (
        typeof dep !== "string" ||
        !/^[a-z0-9-]+@[0-9]+\.[0-9]+\.[0-9]+$/.test(dep)
      ) {
        errors.push({
          field: `dependencies[${i}]`,
          message: `Dependency at index ${i} must be in format "name@x.y.z"`,
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
  if (
    !m.capabilities ||
    typeof m.capabilities !== "object" ||
    Array.isArray(m.capabilities)
  ) {
    errors.push({
      field: "capabilities",
      message: "Capabilities is required and must be an object",
      code: "REQUIRED_FIELD_MISSING",
    });
  } else if (m.capabilities !== null) {
    const caps = m.capabilities as Record<string, unknown>;
    const capErrors = validateCapabilities(caps);
    errors.push(
      ...capErrors.errors.map(e => ({
        ...e,
        field: `capabilities.${e.field}`,
      }))
    );
  }

  // Validate metadata
  if (
    !m.metadata ||
    typeof m.metadata !== "object" ||
    Array.isArray(m.metadata)
  ) {
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
  } else if (!/^[a-f0-9]{64}$/.test(m.checksum)) {
    errors.push({
      field: "checksum",
      message: "Checksum must be a 64-character hexadecimal string (SHA-256)",
      code: "INVALID_FORMAT",
      expected: "64 hex characters",
      actual: `${m.checksum.length} characters`,
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
    } else {
      for (let i = 0; i < m.files.length; i++) {
        const file = m.files[i];
        const fileErrors = validateFileEntry(file);
        for (const err of fileErrors.errors) {
          errors.push({
            ...err,
            field: `files[${i}].${err.field}`,
          });
        }
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
 * Validate cartridge capabilities
 *
 * @param capabilities - Capabilities to validate
 * @returns Validation result
 */
function validateCapabilities(
  capabilities: Record<string, unknown>
): SchemaValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Validate domains
  if (!Array.isArray(capabilities.domains)) {
    errors.push({
      field: "domains",
      message: "Domains must be an array",
      code: "INVALID_TYPE",
      expected: "array",
      actual: typeof capabilities.domains,
    });
  } else if (capabilities.domains.length === 0) {
    errors.push({
      field: "domains",
      message: "Domains array cannot be empty",
      code: "INVALID_ARRAY_LENGTH",
    });
  } else if (capabilities.domains.length > 20) {
    errors.push({
      field: "domains",
      message: "Cannot have more than 20 domains",
      code: "INVALID_ARRAY_LENGTH",
      expected: "<= 20",
      actual: `${capabilities.domains.length}`,
    });
  } else {
    for (const domain of capabilities.domains) {
      if (typeof domain !== "string" || !/^[a-z][a-z0-9-]*$/.test(domain)) {
        errors.push({
          field: "domains",
          message:
            "Each domain must be a lowercase alphanumeric string (can contain hyphens)",
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
  } else if (capabilities.queryTypes.length === 0) {
    errors.push({
      field: "queryTypes",
      message: "Query types array cannot be empty",
      code: "INVALID_ARRAY_LENGTH",
    });
  } else {
    const validQueryTypes: QueryType[] = [
      "question",
      "command",
      "code",
      "explanation",
      "comparison",
      "debug",
      "general",
    ];
    for (const qt of capabilities.queryTypes) {
      if (!validQueryTypes.includes(qt as QueryType)) {
        errors.push({
          field: "queryTypes",
          message: `Invalid query type: ${qt}. Must be one of: ${validQueryTypes.join(", ")}`,
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
  } else if (capabilities.sizeBytes < 0) {
    errors.push({
      field: "sizeBytes",
      message: "Size bytes cannot be negative",
      code: "VALUE_OUT_OF_RANGE",
      expected: ">= 0",
      actual: String(capabilities.sizeBytes),
    });
  } else if (capabilities.sizeBytes > 10 * 1024 * 1024 * 1024) {
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
  } else if (capabilities.loadTimeMs < 0) {
    errors.push({
      field: "loadTimeMs",
      message: "Load time cannot be negative",
      code: "VALUE_OUT_OF_RANGE",
      expected: ">= 0",
      actual: String(capabilities.loadTimeMs),
    });
  } else if (capabilities.loadTimeMs > 60000) {
    warnings.push({
      field: "loadTimeMs",
      message: "Load time exceeds 1 minute (consider optimization)",
      code: "PERFORMANCE_WARNING",
    });
  }

  // Validate privacyLevel
  const validPrivacyLevels = ["public", "sensitive", "sovereign"];
  if (
    !capabilities.privacyLevel ||
    !validPrivacyLevels.includes(capabilities.privacyLevel as string)
  ) {
    errors.push({
      field: "privacyLevel",
      message: `Privacy level must be one of: ${validPrivacyLevels.join(", ")}`,
      code: "INVALID_ENUM_VALUE",
      expected: validPrivacyLevels.join(" | "),
      actual: String(capabilities.privacyLevel ?? "undefined"),
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate file entry
 *
 * @param entry - File entry to validate
 * @returns Validation result
 */
function validateFileEntry(entry: unknown): SchemaValidationResult {
  const errors: ValidationError[] = [];

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

  const e = entry as Record<string, unknown>;

  if (!e.path || typeof e.path !== "string") {
    errors.push({
      field: "path",
      message: "Path is required and must be a string",
      code: "REQUIRED_FIELD_MISSING",
    });
  } else if (e.path.startsWith("/")) {
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
  } else if (!/^[a-f0-9]{64}$/.test(e.checksum)) {
    errors.push({
      field: "checksum",
      message: "Checksum must be a 64-character hexadecimal string (SHA-256)",
      code: "INVALID_FORMAT",
      expected: "64 hex characters",
      actual: `${e.checksum.length} characters`,
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
  } else if (typeof e.size === "number" && e.size < 0) {
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
    errors,
    warnings: [],
  };
}

// ============================================================================
// PROTOCOL SPECIFICATION
// ============================================================================

/**
 * Complete Cartridge protocol specification for compliance checking
 */
export const CARTRIDGE_SCHEMA: ProtocolSpecification = {
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
          check: ctx => ctx.parameters.valid === true,
        },
        {
          description: "Dependencies are available",
          check: ctx => (ctx.parameters.dependencies as string[]).every(d => d),
        },
      ],
      postconditions: [
        {
          description: "Cartridge is loaded",
          check: ctx => ctx.result === "loaded",
        },
      ],
      invariants: [
        {
          description: "State transitions are valid",
          check: ctx => {
            const from = ctx.parameters.fromState as string;
            const to = ctx.result as string;
            const validTransitions: Record<string, string[]> = {
              unloaded: ["loading"],
              loading: ["loaded", "error"],
              loaded: ["unloading"],
              unloading: ["unloaded"],
              error: ["loading"],
            };
            return validTransitions[from]?.includes(to) ?? false;
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
        check: ctx => {
          const size = ctx.parameters.sizeBytes as number;
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
        check: ctx => {
          const deps = ctx.parameters.dependencies as string[];
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
        check: ctx => {
          const circular = ctx.parameters.circular as boolean[];
          return circular.length === 0;
        },
        violation_message: "Circular dependencies detected",
      },
      severity: "error",
    },
  ],
  documentation_url: "https://docs.aequor.ai/protocols/cartridge",
};

// Export all types from cartridge.ts for convenience
export type {
  CartridgeManifest,
  CartridgeCapabilities,
  CartridgeFileEntry,
  CartridgeNegotiation,
  CartridgeVersion,
  CompatibilityResult,
  CartridgeState,
  CartridgeLifecycle,
  ValidationResult,
  DependencyNode,
  CartridgeRegistryEntry,
  CartridgeLoadOptions,
  CartridgeLoadProgress,
  DependencyResolutionResult,
  VersionConstraint,
  CartridgeStats,
  QueryType,
};

// Re-export ProtocolSpecification
export type { ProtocolSpecification };

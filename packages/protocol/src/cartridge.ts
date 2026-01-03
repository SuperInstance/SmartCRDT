/**
 * Cartridge Protocol for Aequor Cognitive Orchestration Platform
 *
 * This module defines the protocol for knowledge cartridges - self-contained units of
 * domain knowledge that can be loaded, unloaded, and versioned in the ContextPlane.
 *
 * Cartridges enable:
 * - Modular knowledge organization
 * - Version negotiation and dependency resolution
 * - Hot-reloading without restart
 * - Cryptographic verification and signing
 *
 * Design Principles:
 * - Protocol-first: All types defined here before implementation
 * - Semantic versioning for compatibility
 * - Dependency resolution with conflict detection
 * - Graceful failure handling with rollback
 */

/**
 * Query types from @lsi/cascade that cartridges can specialize in
 */
export type QueryType =
  | "question"
  | "command"
  | "code"
  | "explanation"
  | "comparison"
  | "debug"
  | "general";

/**
 * Cartridge manifest - metadata and capabilities descriptor
 *
 * Every cartridge must have a manifest file (cartridge.json) that describes
 * its contents, dependencies, and capabilities.
 */
export interface CartridgeManifest {
  /** Unique identifier (e.g., "@lsi/cartridge-medical") */
  id: string;

  /** Semantic version (e.g., "1.2.0") */
  version: string;

  /** Human-readable name */
  name: string;

  /** Description of what this cartridge contains */
  description: string;

  /** Author or organization name */
  author?: string;

  /** License identifier */
  license?: string;

  /** Homepage URL */
  homepage?: string;

  /** Repository URL */
  repository?: string;

  /** Other cartridges required by this one */
  dependencies: string[];

  /** Cartridges that conflict with this one */
  conflicts: string[];

  /** Capability declarations */
  capabilities: CartridgeCapabilities;

  /** Additional metadata */
  metadata: Record<string, unknown>;

  /** SHA-256 checksum of cartridge contents */
  checksum: string;

  /** Optional cryptographic signature for verification */
  signature?: string;

  /** List of files with checksums for integrity verification */
  files?: CartridgeFileEntry[];
}

/**
 * File entry in cartridge manifest
 */
export interface CartridgeFileEntry {
  /** Relative path to file within cartridge */
  path: string;

  /** SHA-256 checksum of this file */
  checksum: string;

  /** File size in bytes */
  size?: number;
}

/**
 * Cartridge capabilities descriptor
 *
 * Declares what a cartridge can do and how it behaves.
 */
export interface CartridgeCapabilities {
  /** Domains this cartridge specializes in (e.g., ["medical", "diagnosis"]) */
  domains: string[];

  /** Which query types this cartridge handles */
  queryTypes: QueryType[];

  /** Optional embedding model used for this cartridge */
  embeddingModel?: string;

  /** Estimated size in bytes when loaded into memory */
  sizeBytes: number;

  /** Estimated load time in milliseconds */
  loadTimeMs: number;

  /** Privacy level required for this cartridge */
  privacyLevel: "public" | "sensitive" | "sovereign";
}

/**
 * Version negotiation protocol
 *
 * When loading a cartridge, the system negotiates the best compatible version
 * based on semantic versioning and dependency constraints.
 */
export interface CartridgeNegotiation {
  /** Requested cartridge ID */
  requestedId: string;

  /** Optional version constraint (e.g., "^1.2.0", "~2.0.0", ">=1.0.0") */
  requestedVersion?: string;

  /** Available versions from cartridge registry */
  availableVersions: CartridgeVersion[];

  /** Selected version after negotiation */
  selectedVersion: string;

  /** Compatibility check result */
  compatibility: CompatibilityResult;
}

/**
 * Single cartridge version with compatibility status
 */
export interface CartridgeVersion {
  /** Semantic version string */
  version: string;

  /** Compatibility status */
  status:
    | "compatible"
    | "upgrade_required"
    | "downgrade_required"
    | "incompatible";

  /** Reason for status (for debugging) */
  reason?: string;
}

/**
 * Result of compatibility check
 *
 * Determines if a cartridge can be loaded given current state and dependencies.
 */
export interface CompatibilityResult {
  /** Whether the cartridge is compatible */
  isCompatible: boolean;

  /** Selected version that passed compatibility check */
  selectedVersion: string;

  /** Additional dependencies that need to be loaded */
  requires: string[];

  /** Conflicts that need to be resolved */
  conflicts: string[];

  /** Warnings that don't prevent loading */
  warnings: string[];
}

/**
 * Cartridge lifecycle states
 *
 * Cartridges transition through these states during their lifetime.
 */
export enum CartridgeState {
  /** Cartridge is not loaded */
  UNLOADED = "unloaded",

  /** Cartridge is currently loading */
  LOADING = "loading",

  /** Cartridge is loaded and available */
  LOADED = "loaded",

  /** Cartridge is currently unloading */
  UNLOADING = "unloading",

  /** Cartridge encountered an error */
  ERROR = "error",
}

/**
 * Cartridge lifecycle interface
 *
 * Defines the lifecycle operations for a loaded cartridge.
 */
export interface CartridgeLifecycle {
  /** Current state of the cartridge */
  state: CartridgeState;

  /** Timestamp when cartridge was loaded (if loaded) */
  loadedAt?: number;

  /** Error message if in ERROR state */
  error?: string;

  /**
   * Load a cartridge from its manifest
   *
   * @param manifest - Cartridge manifest to load
   * @throws Error if manifest is invalid or dependencies missing
   */
  load(manifest: CartridgeManifest): Promise<void>;

  /**
   * Unload the cartridge and release resources
   *
   * @throws Error if unload fails
   */
  unload(): Promise<void>;

  /**
   * Reload the cartridge (unload + load)
   *
   * Used for hot-reloading after updates.
   *
   * @throws Error if reload fails
   */
  reload(): Promise<void>;

  /**
   * Validate cartridge integrity and dependencies
   *
   * @returns Validation result with any issues found
   */
  validate(): ValidationResult;
}

/**
 * Validation result for cartridge operations
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;

  /** Errors that prevent loading (empty if valid) */
  errors: string[];

  /** Warnings that don't prevent loading */
  warnings: string[];
}

/**
 * Dependency graph node for resolution
 *
 * Internal representation used by CartridgeManager for dependency resolution.
 */
export interface DependencyNode {
  /** Cartridge ID */
  id: string;

  /** Version constraint */
  version: string;

  /** Cartridge manifest (if available) */
  manifest?: CartridgeManifest;

  /** Dependencies of this cartridge */
  dependencies: string[];

  /** Conflicts for this cartridge */
  conflicts: string[];

  /** Whether this node has been visited during traversal */
  visited: boolean;

  /** Whether this node is currently in the recursion stack */
  inStack: boolean;
}

/**
 * Cartridge registry entry
 *
 * Represents a cartridge available in the registry.
 */
export interface CartridgeRegistryEntry {
  /** Cartridge manifest */
  manifest: CartridgeManifest;

  /** Path to cartridge data */
  path: string;

  /** Whether cartridge is currently loaded */
  loaded: boolean;

  /** Load count (for reference counting) */
  loadCount: number;

  /** Timestamp when entry was last modified */
  lastModified: number;
}

/**
 * Cartridge load options
 *
 * Optional parameters for loading a cartridge.
 */
export interface CartridgeLoadOptions {
  /** Whether to load dependencies automatically */
  autoloadDependencies?: boolean;

  /** Whether to fail on conflicts or attempt resolution */
  failOnConflicts?: boolean;

  /** Maximum load time in milliseconds */
  timeout?: number;

  /** Callback for load progress */
  onProgress?: (progress: CartridgeLoadProgress) => void;
}

/**
 * Cartridge load progress
 *
 * Reports progress during cartridge loading.
 */
export interface CartridgeLoadProgress {
  /** Cartridge ID being loaded */
  cartridgeId: string;

  /** Progress percentage (0-100) */
  progress: number;

  /** Current operation */
  operation: "resolving" | "loading" | "validating" | "complete";

  /** Optional message */
  message?: string;
}

/**
 * Cartridge dependency resolution result
 *
 * Result of dependency resolution algorithm.
 */
export interface DependencyResolutionResult {
  /** Whether resolution was successful */
  success: boolean;

  /** Ordered list of cartridges to load (topological sort) */
  loadOrder: string[];

  /** Missing dependencies */
  missing: string[];

  /** Circular dependencies detected */
  circular: [string, string][];

  /** Unresolved conflicts */
  conflicts: [string, string][];
}

/**
 * Semantic version constraint
 *
 * Parses and validates semantic version constraints.
 */
export interface VersionConstraint {
  /** Raw constraint string (e.g., "^1.2.0") */
  raw: string;

  /** Parsed version components */
  major: number;
  minor: number;
  patch: number;

  /** Constraint operator */
  operator: "=" | "^" | "~" | ">" | ">=" | "<" | "<=" | "*";

  /** Whether this is a pre-release version */
  prerelease?: string;

  /** Build metadata */
  build?: string;
}

/**
 * Cartridge statistics
 *
 * Usage and performance statistics for a cartridge.
 */
export interface CartridgeStats {
  /** Cartridge ID */
  id: string;

  /** Number of times this cartridge has been loaded */
  loadCount: number;

  /** Total time spent loading (milliseconds) */
  totalLoadTime: number;

  /** Average load time (milliseconds) */
  averageLoadTime: number;

  /** Number of queries processed using this cartridge */
  queryCount: number;

  /** Last query timestamp */
  lastQueryAt?: number;

  /** Memory usage in bytes */
  memoryUsage: number;
}

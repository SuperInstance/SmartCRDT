/**
 * @lsi/protocol - Version Negotiation Protocol
 *
 * This module defines types for cartridge version negotiation between clients and servers.
 * It handles backward compatibility, breaking changes, and version selection using semantic versioning.
 */

/**
 * Version range for compatibility checking
 */
export interface VersionRange {
  /** Minimum version (inclusive) */
  min: string;
  /** Maximum version (inclusive), optional for unbounded ranges */
  max?: string;
  /** Preferred version within the range */
  preferred?: string;
}

/**
 * Client capabilities for negotiation
 */
export interface ClientCapabilities {
  /** Protocol version the client supports */
  protocolVersion: string;
  /** Optional features the client supports */
  features: string[];
  /** Client-specific constraints */
  constraints: Record<string, unknown>;
}

/**
 * Version negotiation request from client to server
 */
export interface VersionNegotiationRequest {
  /** Unique client identifier */
  clientId: string;
  /** Cartridge identifier being negotiated */
  cartridgeId: string;
  /** Client's current cartridge version */
  clientVersion: string;
  /** List of versions the client supports */
  supportedVersions: string[];
  /** Client capabilities */
  capabilities: ClientCapabilities;
}

/**
 * Selection reason for version negotiation
 */
export type SelectionReason =
  | "exact_match"
  | "compatible_version"
  | "preferred_version"
  | "latest_compatible"
  | "upgrade_required"
  | "no_compatible_version";

/**
 * Breaking change information
 */
export interface BreakingChange {
  /** Version where breaking change was introduced */
  version: string;
  /** Human-readable description of the change */
  description: string;
  /** Impact level of the breaking change */
  impact: "low" | "medium" | "high";
  /** Suggested mitigations for the breaking change */
  mitigations: string[];
}

/**
 * Migration step for upgrading between versions
 */
export interface MigrationStep {
  /** Target version for this step */
  version: string;
  /** Type of migration action */
  action: "upgrade" | "migrate_data" | "reindex" | "reload";
  /** Human-readable description */
  description: string;
  /** Estimated time for this step in milliseconds */
  estimatedTimeMs: number;
}

/**
 * Complete migration path between versions
 */
export interface MigrationPath {
  /** Starting version */
  from: string;
  /** Target version */
  to: string;
  /** Ordered list of migration steps */
  steps: MigrationStep[];
}

/**
 * Version negotiation response from server to client
 */
export interface VersionNegotiationResponse {
  /** Selected version for the client to use */
  selectedVersion: string;
  /** Reason for this version selection */
  reason: SelectionReason;
  /** Whether client needs to upgrade */
  requiresUpgrade: boolean;
  /** List of breaking changes between versions */
  breakingChanges: BreakingChange[];
  /** Whether data migration is required */
  migrationRequired: boolean;
  /** Optional migration path if upgrade needed */
  migrationPath?: MigrationPath;
}

/**
 * Cartridge version metadata for negotiation
 */
export interface NegotiationCartridgeVersion {
  /** Cartridge identifier */
  cartridgeId: string;
  /** Semantic version string */
  version: string;
  /** Protocol version this cartridge uses */
  protocolVersion: string;
  /** Release timestamp (Unix epoch) */
  releasedAt: number;
  /** Whether this version is deprecated */
  deprecated: boolean;
  /** Whether this version contains breaking changes */
  breaking: boolean;
  /** List of compatible client versions */
  compatibleWith: string[];
  /** Features available in this version */
  features: string[];
  /** URL to download cartridge package */
  downloadUrl: string;
  /** Checksum for integrity verification */
  checksum: string;
  /** Size in bytes */
  sizeBytes: number;
}

/**
 * Version selection result
 */
export interface VersionSelection {
  /** Selected version */
  version: string;
  /** Reason for selection */
  reason: SelectionReason;
  /** Confidence in selection (0-1) */
  confidence: number;
  /** Whether upgrade is required */
  requiresUpgrade?: boolean;
}

/**
 * Result of local compatibility check
 */
export interface NegotiationCompatibilityResult {
  /** Whether versions are compatible */
  compatible: boolean;
  /** Selected compatible version */
  selectedVersion: string;
  /** Reason for compatibility decision */
  reason: string;
  /** Breaking changes if any */
  breakingChanges: BreakingChange[];
}

/**
 * Options for negotiation
 */
export interface NegotiationOptions {
  /** Preferred version */
  preferredVersion?: string;
  /** Whether to allow deprecated versions */
  allowDeprecated?: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Custom headers for request */
  headers?: Record<string, string>;
}

/**
 * Result of version negotiation
 */
export interface NegotiationResult {
  /** Selected version */
  selectedVersion: string;
  /** Whether negotiation was successful */
  compatible: boolean;
  /** Breaking changes between versions */
  breakingChanges: BreakingChange[];
  /** Whether migration is required */
  migrationRequired: boolean;
  /** Confidence in result (0-1) */
  confidence: number;
  /** Migration path if needed */
  migrationPath?: MigrationPath;
}

/**
 * Options for cartridge upgrade
 */
export interface UpgradeOptions {
  /** Whether to backup before upgrade */
  backup?: boolean;
  /** Force upgrade even with breaking changes */
  force?: boolean;
  /** Progress callback for download */
  downloadCallback?: (progress: number) => void;
  /** Skip migration steps */
  skipMigration?: boolean;
}

/**
 * Result of cartridge upgrade
 */
export interface UpgradeResult {
  /** Whether upgrade was successful */
  success: boolean;
  /** Previous version */
  previousVersion: string;
  /** New version */
  newVersion: string;
  /** Whether backup was created */
  backupCreated?: boolean;
  /** Whether migration was performed */
  migrated: boolean;
  /** Time taken in milliseconds */
  durationMs: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Semantic version components
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
 * Version constraint for dependency resolution
 */
export interface NegotiationVersionConstraint {
  /** Cartridge identifier */
  cartridgeId: string;
  /** Version range constraint */
  constraint: string;
  /** Whether this is a hard requirement */
  required: boolean;
}

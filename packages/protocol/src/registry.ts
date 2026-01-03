/**
 * @lsi/protocol - Protocol Registry
 *
 * Central registry for all Aequor protocols with version tracking, compatibility
 * checking, dependency resolution, and migration paths.
 *
 * This module provides:
 * - Protocol registration and version tracking
 * - Compatibility matrix management
 * - Dependency resolution
 * - Migration path generation
 * - Deprecation status tracking
 *
 * Usage:
 * ```typescript
 * import { ProtocolRegistry } from '@lsi/protocol';
 *
 * const registry = new ProtocolRegistry();
 *
 * // Register a protocol
 * registry.register({
 *   id: 'atp',
 *   name: 'Autonomous Task Processing',
 *   version: { major: 1, minor: 0, patch: 0 },
 *   stability: 'stable'
 * });
 *
 * // Check compatibility
 * const compatible = registry.are_compatible('atp@1.0.0', 'atp@1.1.0');
 *
 * // Get migration path
 * const path = registry.get_migration_path(
 *   { major: 1, minor: 0, patch: 0 },
 *   { major: 2, minor: 0, patch: 0 }
 * );
 * ```
 */

// ============================================================================
// SEMVER UTILITIES
// ============================================================================

/**
 * Semantic version
 */
export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
}

/**
 * Parse SemVer from string
 */
export function parseSemVer(version: string): SemVer {
  const match = version.match(
    /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/
  );

  if (!match) {
    throw new Error(`Invalid SemVer string: ${version}`);
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
 * Compare two SemVer versions
 * @returns negative if a < b, 0 if equal, positive if a > b
 */
export function compareSemVer(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;

  const aPre = a.prerelease ?? "";
  const bPre = b.prerelease ?? "";

  if (aPre === bPre) return 0;
  return aPre < bPre ? -1 : 1;
}

/**
 * Check if version a is compatible with version b
 * Compatible if major version matches and a <= b
 */
export function isVersionCompatible(a: SemVer, b: SemVer): boolean {
  if (a.major !== b.major) return false;
  const cmp = compareSemVer(a, b);
  return cmp <= 0;
}

// ============================================================================
// PROTOCOL INFO
// ============================================================================

/**
 * Stability level of a protocol
 */
export type StabilityLevel =
  | "experimental"
  | "stable"
  | "deprecated"
  | "retired";

/**
 * Protocol metadata
 */
export interface ProtocolInfo {
  /** Unique protocol identifier */
  id: string;

  /** Human-readable protocol name */
  name: string;

  /** Protocol description */
  description: string;

  /** Current version */
  version: SemVer;

  /** Stability level */
  stability: StabilityLevel;

  /** Date this version was released */
  releasedAt: Date;

  /** Minimum compatible version (inclusive) */
  minCompatibleVersion?: SemVer;

  /** Maximum compatible version (exclusive) */
  maxCompatibleVersion?: SemVer;

  /** Protocols this protocol depends on */
  dependencies: ProtocolDependency[];

  /** Deprecation info (if deprecated) */
  deprecation?: DeprecationInfo;
}

/**
 * Protocol dependency
 */
export interface ProtocolDependency {
  /** Protocol ID being depended on */
  protocolId: string;

  /** Version constraint */
  versionConstraint: VersionConstraint;
}

/**
 * Version constraint for dependencies
 */
export interface VersionConstraint {
  /** Minimum version (inclusive) */
  minVersion?: SemVer;

  /** Maximum version (exclusive) */
  maxVersion?: SemVer;

  /** Exact version match */
  exactVersion?: SemVer;

  /** Whether this dependency is required */
  required: boolean;
}

/**
 * Check if a version satisfies a constraint
 */
export function satisfiesConstraint(
  version: SemVer,
  constraint: VersionConstraint
): boolean {
  if (constraint.exactVersion) {
    return compareSemVer(version, constraint.exactVersion) === 0;
  }

  if (
    constraint.minVersion &&
    compareSemVer(version, constraint.minVersion) < 0
  ) {
    return false;
  }

  if (
    constraint.maxVersion &&
    compareSemVer(version, constraint.maxVersion) >= 0
  ) {
    return false;
  }

  return true;
}

// ============================================================================
// DEPRECATION INFO
// ============================================================================

/**
 * Deprecation information
 */
export interface DeprecationInfo {
  /** Version where deprecation was announced */
  deprecatedSince: SemVer;

  /** Scheduled removal version */
  removedIn: SemVer;

  /** Sunset date when support ends */
  sunsetDate?: Date;

  /** Replacement protocol (if any) */
  replacementProtocol?: string;

  /** URL to migration guide */
  migrationGuide: string;

  /** List of breaking changes */
  breakingChanges: BreakingChange[];
}

/**
 * Breaking change description
 */
export interface BreakingChange {
  /** Change description */
  description: string;

  /** Impact level */
  impact: "low" | "medium" | "high";

  /** Affected components */
  affectedComponents: string[];

  /** Mitigation steps */
  mitigations: string[];
}

// ============================================================================
// COMPATIBILITY MATRIX
// ============================================================================

/**
 * Compatibility level between protocols
 */
export type CompatibilityLevel =
  | "full" // Fully compatible, no issues
  | "partial" // Compatible with caveats
  | "none" // Not compatible
  | "unknown"; // Compatibility not tested

/**
 * Compatibility matrix entry
 */
export interface CompatibilityMatrix {
  /** Mapping from protocol ID to version to compatible protocols */
  [protocolId: string]: {
    [version: string]: {
      [targetProtocolId: string]: CompatibilityLevel;
    };
  };
}

/**
 * Compatibility check result
 */
export interface CompatibilityResult {
  /** Whether protocols are compatible */
  compatible: boolean;

  /** Compatibility level */
  level: CompatibilityLevel;

  /** Compatibility issues (if any) */
  issues: CompatibilityIssue[];

  /** Confidence in compatibility assessment (0-1) */
  confidence: number;
}

/**
 * Compatibility issue
 */
export interface CompatibilityIssue {
  /** Issue description */
  description: string;

  /** Severity level */
  severity: "low" | "medium" | "high" | "critical";

  /** Affected components */
  affectedComponents: string[];

  /** Possible workarounds */
  workarounds: string[];
}

/**
 * Check version compatibility between client and server
 */
export interface VersionCompatibilityResult {
  /** Whether versions are compatible */
  compatible: boolean;

  /** Client version */
  clientVersion: SemVer;

  /** Server version */
  serverVersion: SemVer;

  /** Compatibility issues */
  issues: string[];

  /** Recommended action */
  recommendation:
    | "use_as_is"
    | "upgrade_client"
    | "upgrade_server"
    | "negotiate";
}

// ============================================================================
// MIGRATION PATHS
// ============================================================================

/**
 * Migration step
 */
export interface MigrationStep {
  /** Target version for this step */
  targetVersion: SemVer;

  /** Type of migration */
  type: "upgrade" | "migrate_data" | "reindex" | "reload" | "config_change";

  /** Human-readable description */
  description: string;

  /** Estimated time for this step (ms) */
  estimatedTimeMs: number;

  /** Whether this step is automatic or manual */
  automatic: boolean;

  /** Manual instructions (if not automatic) */
  manualInstructions?: string;
}

/**
 * Complete migration path between versions
 */
export interface MigrationPath {
  /** Starting version */
  fromVersion: SemVer;

  /** Target version */
  toVersion: SemVer;

  /** Ordered list of migration steps */
  steps: MigrationStep[];

  /** Total estimated time (ms) */
  totalEstimatedTimeMs: number;

  /** Whether full migration is automatic */
  isAutomatic: boolean;

  /** Estimated effort level */
  estimatedEffort: "trivial" | "easy" | "moderate" | "complex";
}

/**
 * Dependency graph node
 */
export interface DependencyNode {
  /** Protocol ID */
  protocolId: string;

  /** Version */
  version: SemVer;

  /** Dependencies */
  dependencies: ProtocolDependency[];

  /** Dependents (protocols that depend on this) */
  dependents: string[];
}

/**
 * Dependency graph
 */
export class DependencyGraph {
  private nodes: Map<string, DependencyNode>;

  constructor() {
    this.nodes = new Map();
  }

  /** Add a node to the graph */
  addNode(node: DependencyNode): void {
    this.nodes.set(`${node.protocolId}@${formatSemVer(node.version)}`, node);
  }

  /** Get a node from the graph */
  getNode(protocolId: string, version: SemVer): DependencyNode | undefined {
    return this.nodes.get(`${protocolId}@${formatSemVer(version)}`);
  }

  /** Get all dependencies for a protocol (transitive) */
  getTransitiveDependencies(protocolId: string, version: SemVer): Set<string> {
    const visited = new Set<string>();
    const queue: string[] = [`${protocolId}@${formatSemVer(version)}`];

    while (queue.length > 0) {
      const key = queue.shift()!;
      if (visited.has(key)) continue;

      visited.add(key);
      const node = this.nodes.get(key);
      if (node) {
        for (const dep of node.dependencies) {
          const depKey = `${dep.protocolId}@${formatSemVer(dep.versionConstraint.exactVersion!)}`;
          queue.push(depKey);
        }
      }
    }

    return visited;
  }

  /** Check for circular dependencies */
  hasCircularDependencies(): boolean {
    const WHITE = 0; // Not visited
    const GRAY = 1; // Visiting
    const BLACK = 2; // Visited

    const color = new Map<string, number>();
    const keys = Array.from(this.nodes.keys());

    const dfs = (key: string): boolean => {
      color.set(key, GRAY);
      const node = this.nodes.get(key);
      if (node) {
        for (const dep of node.dependencies) {
          const depKey = `${dep.protocolId}@${formatSemVer(dep.versionConstraint.exactVersion!)}`;
          const depColor = color.get(depKey) ?? WHITE;
          if (depColor === GRAY) return true; // Back edge
          if (depColor === WHITE && dfs(depKey)) return true;
        }
      }
      color.set(key, BLACK);
      return false;
    };

    for (const key of keys) {
      if (color.get(key) === WHITE) {
        if (dfs(key)) return true;
      }
    }

    return false;
  }
}

// ============================================================================
// PROTOCOL REGISTRY
// ============================================================================

/**
 * Protocol registry with version tracking and compatibility management
 */
export class ProtocolRegistry {
  private protocols: Map<string, ProtocolInfo[]>;
  private compatibilityMatrix: CompatibilityMatrix;
  private dependencyGraph: DependencyGraph;

  constructor() {
    this.protocols = new Map();
    this.compatibilityMatrix = {};
    this.dependencyGraph = new DependencyGraph();
    this.initializeBuiltInProtocols();
  }

  // ========================================================================
  // REGISTRATION
  // ========================================================================

  /**
   * Register a protocol
   */
  register(protocol: ProtocolInfo): void {
    const key = protocol.id;
    if (!this.protocols.has(key)) {
      this.protocols.set(key, []);
    }

    const versions = this.protocols.get(key)!;

    // Check for duplicate version
    const exists = versions.some(
      v => compareSemVer(v.version, protocol.version) === 0
    );
    if (exists) {
      throw new Error(
        `Protocol ${key}@${formatSemVer(protocol.version)} already registered`
      );
    }

    versions.push(protocol);
    versions.sort((a, b) => compareSemVer(b.version, a.version)); // Newest first

    // Add to dependency graph
    this.dependencyGraph.addNode({
      protocolId: protocol.id,
      version: protocol.version,
      dependencies: protocol.dependencies,
      dependents: [],
    });

    // Initialize compatibility matrix if needed
    if (!this.compatibilityMatrix[key]) {
      this.compatibilityMatrix[key] = {};
    }
    const versionStr = formatSemVer(protocol.version);
    if (!this.compatibilityMatrix[key][versionStr]) {
      this.compatibilityMatrix[key][versionStr] = {};
    }
  }

  /**
   * Unregister a protocol version
   */
  unregister(protocolId: string, version: SemVer): void {
    const versions = this.protocols.get(protocolId);
    if (!versions) return;

    const index = versions.findIndex(
      v => compareSemVer(v.version, version) === 0
    );
    if (index >= 0) {
      versions.splice(index, 1);
    }

    if (versions.length === 0) {
      this.protocols.delete(protocolId);
    }
  }

  /**
   * Get protocol info
   */
  get(protocolId: string, version?: SemVer): ProtocolInfo | undefined {
    const versions = this.protocols.get(protocolId);
    if (!versions) return undefined;

    if (version) {
      return versions.find(v => compareSemVer(v.version, version) === 0);
    }

    // Return latest version
    return versions[0];
  }

  /**
   * List all protocols
   */
  list(): ProtocolInfo[] {
    const result: ProtocolInfo[] = [];
    for (const versions of this.protocols.values()) {
      // Return latest version of each protocol
      result.push(versions[0]);
    }
    return result;
  }

  /**
   * List all versions of a protocol
   */
  listVersions(protocolId: string): ProtocolInfo[] {
    return this.protocols.get(protocolId) ?? [];
  }

  /**
   * List protocols by version
   */
  listByVersion(version: SemVer): ProtocolInfo[] {
    const result: ProtocolInfo[] = [];
    for (const versions of this.protocols.values()) {
      for (const protocol of versions) {
        if (compareSemVer(protocol.version, version) === 0) {
          result.push(protocol);
        }
      }
    }
    return result;
  }

  // ========================================================================
  // COMPATIBILITY
  // ========================================================================

  /**
   * Check if two protocol versions are compatible
   */
  are_compatible(protocol_a: string, protocol_b: string): boolean {
    const [id_a, version_a] = this.parseProtocolId(protocol_a);
    const [id_b, version_b] = this.parseProtocolId(protocol_b);

    if (id_a !== id_b) return false;

    const info_a = this.get(id_a, version_a);
    const info_b = this.get(id_b, version_b);

    if (!info_a || !info_b) return false;

    return this.check_version_compatibility(info_a.version, info_b.version)
      .compatible;
  }

  /**
   * Get compatibility matrix
   */
  get_compatibility_matrix(): CompatibilityMatrix {
    return { ...this.compatibilityMatrix };
  }

  /**
   * Check version compatibility
   */
  check_version_compatibility(
    clientVersion: SemVer,
    serverVersion: SemVer
  ): VersionCompatibilityResult {
    const issues: string[] = [];
    let compatible = true;

    // Major version must match
    if (clientVersion.major !== serverVersion.major) {
      compatible = false;
      issues.push(
        `Major version mismatch: client ${clientVersion.major} vs server ${serverVersion.major}`
      );
    }

    // Client should not be newer than server
    if (compareSemVer(clientVersion, serverVersion) > 0) {
      compatible = false;
      issues.push(`Client version newer than server`);
    }

    // Check for known compatibility issues
    const level = this.getCompatibilityLevel(clientVersion, serverVersion);
    if (level === "none") {
      compatible = false;
      issues.push(`Known incompatibility between versions`);
    } else if (level === "partial") {
      issues.push(`Partial compatibility - some features may not work`);
    }

    let recommendation: VersionCompatibilityResult["recommendation"] =
      "use_as_is";
    if (!compatible) {
      recommendation =
        compareSemVer(clientVersion, serverVersion) > 0
          ? "upgrade_server"
          : "upgrade_client";
    } else if (level === "partial") {
      recommendation = "negotiate";
    }

    return {
      compatible,
      clientVersion,
      serverVersion,
      issues,
      recommendation,
    };
  }

  /**
   * Get compatibility level between two versions
   */
  private getCompatibilityLevel(a: SemVer, b: SemVer): CompatibilityLevel {
    // Same version is fully compatible
    if (compareSemVer(a, b) === 0) return "full";

    // Different major versions are incompatible
    if (a.major !== b.major) return "none";

    // Minor version differences are partially compatible
    if (a.minor !== b.minor) return "partial";

    // Patch version differences are fully compatible
    return "full";
  }

  // ========================================================================
  // DEPENDENCIES
  // ========================================================================

  /**
   * Resolve dependencies for a protocol
   */
  resolve_dependencies(protocolId: string, version: SemVer): DependencyGraph {
    const graph = new DependencyGraph();
    const queue: Array<{ id: string; version: SemVer }> = [
      { id: protocolId, version },
    ];

    while (queue.length > 0) {
      const { id, version: v } = queue.shift()!;

      if (graph.getNode(id, v)) continue;

      const info = this.get(id, v);
      if (!info) continue;

      graph.addNode({
        protocolId: id,
        version: v,
        dependencies: info.dependencies,
        dependents: [],
      });

      for (const dep of info.dependencies) {
        if (dep.versionConstraint.exactVersion) {
          queue.push({
            id: dep.protocolId,
            version: dep.versionConstraint.exactVersion,
          });
        }
      }
    }

    return graph;
  }

  /**
   * Check if all dependencies are satisfied
   */
  check_dependencies_satisfied(protocolId: string, version: SemVer): boolean {
    const info = this.get(protocolId, version);
    if (!info) return false;

    for (const dep of info.dependencies) {
      const depInfo = this.get(
        dep.protocolId,
        dep.versionConstraint.exactVersion!
      );
      if (!depInfo) return false;

      if (dep.versionConstraint.required && depInfo.stability === "retired") {
        return false;
      }
    }

    return true;
  }

  /**
   * Get migration path between versions
   */
  get_migration_path(
    fromVersion: SemVer,
    toVersion: SemVer
  ): MigrationPath | null {
    // Can only migrate within same major version or to next major
    if (toVersion.major < fromVersion.major) {
      return null; // Cannot downgrade
    }

    if (toVersion.major > fromVersion.major + 1) {
      return null; // Cannot skip major versions
    }

    const steps: MigrationStep[] = [];
    let totalEstimatedTime = 0;

    // Direct upgrade within major version
    if (fromVersion.major === toVersion.major) {
      steps.push({
        targetVersion: toVersion,
        type: "upgrade",
        description: `Upgrade from ${formatSemVer(fromVersion)} to ${formatSemVer(toVersion)}`,
        estimatedTimeMs: 5000,
        automatic: true,
      });
      totalEstimatedTime += 5000;
    }
    // Major version upgrade
    else if (toVersion.major === fromVersion.major + 1) {
      steps.push({
        targetVersion: toVersion,
        type: "migrate_data",
        description: `Migrate from v${fromVersion.major} to v${toVersion.major}`,
        estimatedTimeMs: 30000,
        automatic: false,
        manualInstructions: `Review breaking changes and update code accordingly.`,
      });
      totalEstimatedTime += 30000;
    }

    const isAutomatic = steps.every(s => s.automatic);

    let estimatedEffort: MigrationPath["estimatedEffort"];
    if (totalEstimatedTime < 10000) estimatedEffort = "trivial";
    else if (totalEstimatedTime < 60000) estimatedEffort = "easy";
    else if (totalEstimatedTime < 300000) estimatedEffort = "moderate";
    else estimatedEffort = "complex";

    return {
      fromVersion,
      toVersion,
      steps,
      totalEstimatedTimeMs: totalEstimatedTime,
      isAutomatic,
      estimatedEffort,
    };
  }

  // ========================================================================
  // STATUS
  // ========================================================================

  /**
   * Check if protocol is stable
   */
  is_stable(protocolId: string, version?: SemVer): boolean {
    const info = this.get(protocolId, version);
    return info !== undefined && info.stability === "stable";
  }

  /**
   * Check if protocol is deprecated
   */
  is_deprecated(protocolId: string, version?: SemVer): boolean {
    const info = this.get(protocolId, version);
    return info !== undefined && info.stability === "deprecated";
  }

  /**
   * Get deprecation info
   */
  get_deprecation_info(
    protocolId: string,
    version?: SemVer
  ): DeprecationInfo | undefined {
    const info = this.get(protocolId, version);
    return info?.deprecation;
  }

  // ========================================================================
  // PRIVATE HELPERS
  // ========================================================================

  /**
   * Parse protocol ID with optional version
   */
  private parseProtocolId(id: string): [string, SemVer | undefined] {
    const match = id.match(/^(@?[\w-]+)(?:@(.+))?$/);
    if (!match) return [id, undefined];

    const protocolId = match[1];
    const versionStr = match[2];
    const version = versionStr ? parseSemVer(versionStr) : undefined;

    return [protocolId, version];
  }

  /**
   * Initialize built-in protocols
   */
  private initializeBuiltInProtocols(): void {
    // ATP (Autonomous Task Processing) Protocol
    this.register({
      id: "atp",
      name: "Autonomous Task Processing",
      description: "Single-model query processing protocol",
      version: { major: 1, minor: 0, patch: 0 },
      stability: "stable",
      releasedAt: new Date("2025-12-30"),
      minCompatibleVersion: { major: 1, minor: 0, patch: 0 },
      dependencies: [],
    });

    // ACP (Assisted Collaborative Processing) Protocol
    this.register({
      id: "acp",
      name: "Assisted Collaborative Processing",
      description: "Multi-model collaboration protocol",
      version: { major: 1, minor: 0, patch: 0 },
      stability: "stable",
      releasedAt: new Date("2025-12-30"),
      minCompatibleVersion: { major: 1, minor: 0, patch: 0 },
      dependencies: [
        {
          protocolId: "atp",
          versionConstraint: {
            exactVersion: { major: 1, minor: 0, patch: 0 },
            required: true,
          },
        },
      ],
    });

    // Cartridge Protocol
    this.register({
      id: "cartridge",
      name: "Knowledge Cartridge",
      description: "Knowledge cartridge lifecycle management",
      version: { major: 1, minor: 0, patch: 0 },
      stability: "stable",
      releasedAt: new Date("2025-12-30"),
      minCompatibleVersion: { major: 1, minor: 0, patch: 0 },
      dependencies: [],
    });

    // Version Negotiation Protocol
    this.register({
      id: "version-negotiation",
      name: "Version Negotiation",
      description: "Protocol version negotiation and compatibility",
      version: { major: 1, minor: 0, patch: 0 },
      stability: "stable",
      releasedAt: new Date("2025-12-30"),
      minCompatibleVersion: { major: 1, minor: 0, patch: 0 },
      dependencies: [],
    });

    // Rollback Protocol
    this.register({
      id: "rollback",
      name: "Rollback",
      description: "Distributed rollback operations",
      version: { major: 1, minor: 0, patch: 0 },
      stability: "stable",
      releasedAt: new Date("2025-12-30"),
      minCompatibleVersion: { major: 1, minor: 0, patch: 0 },
      dependencies: [],
    });

    // Hypothesis Protocol
    this.register({
      id: "hypothesis",
      name: "Hypothesis Testing",
      description: "Distributed hypothesis testing and validation",
      version: { major: 1, minor: 0, patch: 0 },
      stability: "stable",
      releasedAt: new Date("2025-12-30"),
      minCompatibleVersion: { major: 1, minor: 0, patch: 0 },
      dependencies: [],
    });

    // Extension Protocol
    this.register({
      id: "extension",
      name: "Extension",
      description: "Protocol extension framework",
      version: { major: 1, minor: 0, patch: 0 },
      stability: "stable",
      releasedAt: new Date("2025-12-30"),
      minCompatibleVersion: { major: 1, minor: 0, patch: 0 },
      dependencies: [],
    });
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Global protocol registry instance
 */
export const globalProtocolRegistry = new ProtocolRegistry();

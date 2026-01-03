/**
 * @lsi/swarm - Negotiation Server
 *
 * Server-side version negotiation for cartridges.
 * Handles version registry, selection, and migration path generation.
 */

import type {
  VersionNegotiationRequest,
  VersionNegotiationResponse,
  NegotiationCartridgeVersion,
  MigrationPath as NegotiationMigrationPath,
  MigrationStep as NegotiationMigrationStep,
  BreakingChange as NegotiationBreakingChange,
  SelectionReason,
} from "@lsi/protocol";
import { VersionSelector } from "./VersionSelector.js";

/**
 * Server-side version negotiation
 */
export class NegotiationServer {
  private selector: VersionSelector;
  private versionRegistry: Map<string, NegotiationCartridgeVersion[]>;

  constructor() {
    this.selector = new VersionSelector();
    this.versionRegistry = new Map();
  }

  /**
   * Handle negotiation request
   *
   * @param request - Negotiation request from client
   * @returns Negotiation response
   */
  async negotiate(
    request: VersionNegotiationRequest
  ): Promise<VersionNegotiationResponse> {
    const availableVersions = this.getVersions(request.cartridgeId);

    if (availableVersions.length === 0) {
      return {
        selectedVersion: request.clientVersion,
        reason: "no_compatible_version",
        requiresUpgrade: false,
        breakingChanges: [],
        migrationRequired: false,
      };
    }

    // Select best version
    const selection = this.selectBestVersion(request, availableVersions);

    // Generate breaking changes list
    const breakingChanges = this.getBreakingChangesBetween(
      request.clientVersion,
      selection.version,
      request.cartridgeId
    );

    // Check if migration is required
    const migrationRequired = breakingChanges.length > 0;

    // Generate migration path if needed
    let migrationPath: NegotiationMigrationPath | undefined;
    if (migrationRequired || selection.requiresUpgrade) {
      migrationPath = this.generateMigrationPath(
        request.clientVersion,
        selection.version,
        request.cartridgeId
      );
    }

    return {
      selectedVersion: selection.version,
      reason: selection.reason,
      requiresUpgrade: selection.requiresUpgrade || false,
      breakingChanges,
      migrationRequired,
      migrationPath,
    };
  }

  /**
   * Select best version for client
   *
   * @param request - Negotiation request
   * @param availableVersions - Available versions
   * @returns Version selection
   */
  private selectBestVersion(
    request: VersionNegotiationRequest,
    availableVersions: NegotiationCartridgeVersion[]
  ): {
    version: string;
    reason: SelectionReason;
    confidence: number;
    requiresUpgrade?: boolean;
  } {
    // Check for exact match first (non-deprecated)
    const exactMatch = availableVersions.find(
      v => v.version === request.clientVersion && !v.deprecated
    );

    if (exactMatch) {
      return {
        version: exactMatch.version,
        reason: "exact_match",
        confidence: 1.0,
      };
    }

    // Check if client version exists but is deprecated
    const deprecatedMatch = availableVersions.find(
      v => v.version === request.clientVersion
    );

    if (deprecatedMatch) {
      // Find latest compatible non-deprecated version
      const activeVersions = availableVersions.filter(v => !v.deprecated);
      const selection = this.selector.select(
        request.supportedVersions,
        activeVersions
      );

      return {
        version: selection.version,
        reason: selection.reason as SelectionReason,
        confidence: selection.confidence * 0.9, // Lower confidence for deprecated
      };
    }

    // Use version selector to find best match
    const selection = this.selector.select(
      request.supportedVersions,
      availableVersions
    );

    return {
      version: selection.version,
      reason: selection.reason as SelectionReason,
      confidence: selection.confidence,
      requiresUpgrade: selection.requiresUpgrade,
    };
  }

  /**
   * Generate migration path between versions
   *
   * @param fromVersion - Source version
   * @param toVersion - Target version
   * @param cartridgeId - Cartridge identifier
   * @returns Migration path with steps
   */
  generateMigrationPath(
    fromVersion: string,
    toVersion: string,
    cartridgeId: string
  ): NegotiationMigrationPath {
    const availableVersions = this.getVersions(cartridgeId);
    const from = this.selector.parseSemVer(fromVersion);
    const to = this.selector.parseSemVer(toVersion);

    if (!from || !to) {
      return {
        from: fromVersion,
        to: toVersion,
        steps: [],
      };
    }

    // Get all versions between from and to
    const intermediateVersions = availableVersions
      .filter(v => {
        const vSem = this.selector.parseSemVer(v.version);
        if (!vSem) return false;

        const compareToFrom = this.selector["compareVersions"](vSem, from);
        const compareToTo = this.selector["compareVersions"](vSem, to);

        return compareToFrom > 0 && compareToTo <= 0;
      })
      .sort((a, b) => {
        const aSem = this.selector.parseSemVer(a.version)!;
        const bSem = this.selector.parseSemVer(b.version)!;
        return this.selector["compareVersions"](aSem, bSem);
      });

    const steps: NegotiationMigrationStep[] = [];

    // Add initial upgrade step if needed
    if (intermediateVersions.length > 0) {
      steps.push({
        version: intermediateVersions[0].version,
        action: "upgrade",
        description: `Upgrade to version ${intermediateVersions[0].version}`,
        estimatedTimeMs: 5000,
      });
    }

    // Add data migration steps for breaking changes
    for (const version of intermediateVersions) {
      if (version.breaking) {
        steps.push({
          version: version.version,
          action: "migrate_data",
          description: `Migrate data for breaking changes in ${version.version}`,
          estimatedTimeMs: 10000,
        });
      }
    }

    // Add reindex step if major version change
    if (to.major > from.major) {
      steps.push({
        version: toVersion,
        action: "reindex",
        description: "Reindex data for major version upgrade",
        estimatedTimeMs: 15000,
      });
    }

    // Add final reload step
    steps.push({
      version: toVersion,
      action: "reload",
      description: "Reload cartridge with new version",
      estimatedTimeMs: 2000,
    });

    return {
      from: fromVersion,
      to: toVersion,
      steps,
    };
  }

  /**
   * Get breaking changes between versions
   *
   * @param fromVersion - Source version
   * @param toVersion - Target version
   * @param cartridgeId - Cartridge identifier
   * @returns List of breaking changes
   */
  private getBreakingChangesBetween(
    fromVersion: string,
    toVersion: string,
    cartridgeId: string
  ): NegotiationBreakingChange[] {
    const availableVersions = this.getVersions(cartridgeId);

    return availableVersions
      .filter(v => {
        const vSem = this.selector.parseSemVer(v.version);
        if (!vSem || !v.breaking) return false;

        const from = this.selector.parseSemVer(fromVersion);
        const to = this.selector.parseSemVer(toVersion);

        if (!from || !to) return false;

        const compareToFrom = this.selector["compareVersions"](vSem, from);
        const compareToTo = this.selector["compareVersions"](vSem, to);

        return compareToFrom > 0 && compareToTo <= 0;
      })
      .map(v => ({
        version: v.version,
        description: `Breaking changes introduced in ${v.version}`,
        impact: this.assessImpact(v) as "low" | "medium" | "high",
        mitigations: this.generateMitigations(v),
      }));
  }

  /**
   * Assess impact of a version
   *
   * @param version - Cartridge version
   * @returns Impact level
   */
  private assessImpact(version: NegotiationCartridgeVersion): string {
    if (version.breaking) {
      const major = this.selector.parseSemVer(version.version)?.major || 0;

      if (major === 0) {
        return "high"; // Unstable API
      }

      // Check if major version bump
      if (version.version.endsWith(".0.0")) {
        return "high";
      }

      return "medium";
    }

    return "low";
  }

  /**
   * Generate mitigations for breaking changes
   *
   * @param version - Cartridge version
   * @returns List of mitigations
   */
  private generateMitigations(version: NegotiationCartridgeVersion): string[] {
    const mitigations: string[] = [];

    if (version.breaking) {
      mitigations.push("Review changelog for breaking changes");
      mitigations.push("Test thoroughly in development environment");
      mitigations.push("Create backup before upgrading");

      if (version.deprecated) {
        mitigations.push("Consider upgrading to latest stable version");
      }
    }

    return mitigations;
  }

  /**
   * Register a new version
   *
   * @param version - Cartridge version to register
   */
  registerVersion(version: NegotiationCartridgeVersion): void {
    const versions = this.versionRegistry.get(version.cartridgeId) || [];

    // Check if version already exists
    const existing = versions.find(v => v.version === version.version);
    if (existing) {
      throw new Error(
        `Version ${version.version} already registered for ${version.cartridgeId}`
      );
    }

    versions.push(version);
    this.versionRegistry.set(version.cartridgeId, versions);
  }

  /**
   * Get all versions for a cartridge
   *
   * @param cartridgeId - Cartridge identifier
   * @returns List of versions
   */
  getVersions(cartridgeId: string): NegotiationCartridgeVersion[] {
    return this.versionRegistry.get(cartridgeId) || [];
  }

  /**
   * Mark version as deprecated
   *
   * @param cartridgeId - Cartridge identifier
   * @param version - Version to deprecate
   */
  deprecateVersion(cartridgeId: string, version: string): void {
    const versions = this.versionRegistry.get(cartridgeId);

    if (!versions) {
      throw new Error(`No versions found for ${cartridgeId}`);
    }

    const versionInfo = versions.find(v => v.version === version);

    if (!versionInfo) {
      throw new Error(`Version ${version} not found for ${cartridgeId}`);
    }

    versionInfo.deprecated = true;
  }

  /**
   * Get latest version for a cartridge
   *
   * @param cartridgeId - Cartridge identifier
   * @returns Latest version or undefined
   */
  getLatestVersion(
    cartridgeId: string
  ): NegotiationCartridgeVersion | undefined {
    const versions = this.versionRegistry.get(cartridgeId);

    if (!versions || versions.length === 0) {
      return undefined;
    }

    // Sort by release time and version
    const sorted = [...versions].sort((a, b) => {
      if (a.releasedAt !== b.releasedAt) {
        return b.releasedAt - a.releasedAt;
      }

      const aSem = this.selector.parseSemVer(a.version);
      const bSem = this.selector.parseSemVer(b.version);

      if (!aSem || !bSem) return 0;

      return this.selector["compareVersions"](bSem, aSem);
    });

    return sorted[0];
  }

  /**
   * Get non-deprecated versions for a cartridge
   *
   * @param cartridgeId - Cartridge identifier
   * @returns List of non-deprecated versions
   */
  getActiveVersions(cartridgeId: string): NegotiationCartridgeVersion[] {
    const versions = this.versionRegistry.get(cartridgeId) || [];
    return versions.filter(v => !v.deprecated);
  }

  /**
   * Clear all registered versions (for testing)
   */
  clearRegistry(): void {
    this.versionRegistry.clear();
  }

  /**
   * Get registry size (for testing)
   */
  getRegistrySize(): number {
    return this.versionRegistry.size;
  }
}

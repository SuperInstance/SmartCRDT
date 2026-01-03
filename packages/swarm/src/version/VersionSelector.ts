/**
 * @lsi/swarm - Version Selector
 *
 * Utility class for selecting the best version based on semantic versioning
 * and client compatibility constraints.
 */

import type {
  NegotiationCartridgeVersion,
  VersionSelection,
  SelectionReason,
  SemVer as NegotiationSemVer,
} from "@lsi/protocol";

/**
 * Version selector for semantic versioning
 */
export class VersionSelector {
  /**
   * Select the best version based on supported versions and availability
   *
   * @param supportedVersions - Versions the client supports
   * @param availableVersions - Versions available on the server
   * @param preferredVersion - Optional preferred version
   * @returns Version selection with reason and confidence
   */
  select(
    supportedVersions: string[],
    availableVersions: NegotiationCartridgeVersion[],
    preferredVersion?: string
  ): VersionSelection {
    // Filter out deprecated versions unless they're the only option
    const activeVersions = availableVersions.filter(v => !v.deprecated);
    const versionsToCheck =
      activeVersions.length > 0 ? activeVersions : availableVersions;

    // 1. Check for exact match (preferred version)
    if (
      preferredVersion &&
      this.isSupported(preferredVersion, supportedVersions)
    ) {
      const preferred = versionsToCheck.find(
        v => v.version === preferredVersion
      );
      if (preferred) {
        return {
          version: preferred.version,
          reason: "preferred_version" as SelectionReason,
          confidence: 1.0,
        };
      }
    }

    // 2. Find latest compatible version
    const compatible = this.findLatestCompatible(
      supportedVersions,
      versionsToCheck
    );
    if (compatible) {
      return {
        version: compatible.version,
        reason: "latest_compatible" as SelectionReason,
        confidence: 0.9,
      };
    }

    // 3. Find any compatible version (even if deprecated)
    const anyCompatible = this.findAnyCompatible(
      supportedVersions,
      availableVersions
    );
    if (anyCompatible) {
      return {
        version: anyCompatible.version,
        reason: "compatible_version" as SelectionReason,
        confidence: 0.7,
      };
    }

    // 4. No compatible version - require upgrade
    if (availableVersions.length === 0) {
      // No versions available at all
      return {
        version: supportedVersions[0] || "0.0.0",
        reason: "no_compatible_version" as SelectionReason,
        confidence: 0.0,
        requiresUpgrade: true,
      };
    }

    const latest = this.getLatest(availableVersions);
    return {
      version: latest.version,
      reason: "upgrade_required" as SelectionReason,
      confidence: 0.5,
      requiresUpgrade: true,
    };
  }

  /**
   * Check if a version is in the supported versions list
   *
   * @param version - Version to check
   * @param supportedVersions - List of supported versions
   * @returns True if version is supported
   */
  private isSupported(version: string, supportedVersions: string[]): boolean {
    return supportedVersions.some(v => this.satisfies(version, v));
  }

  /**
   * Check if version satisfies a constraint (e.g., "^1.2.0", "~1.2.0", "1.x")
   *
   * @param version - Version to check
   * @param constraint - Constraint to satisfy
   * @returns True if version satisfies constraint
   */
  satisfies(version: string, constraint: string): boolean {
    // Exact match
    if (version === constraint) {
      return true;
    }

    const v = this.parseSemVer(version);
    const c = this.parseSemVer(constraint);

    if (!v || !c) {
      return false;
    }

    // Caret range (^1.2.3) => >=1.2.3 <2.0.0
    if (constraint.startsWith("^")) {
      return (
        v.major === c.major &&
        (v.minor > c.minor || (v.minor === c.minor && v.patch >= c.patch))
      );
    }

    // Tilde range (~1.2.3) => >=1.2.3 <1.3.0
    if (constraint.startsWith("~")) {
      return v.major === c.major && v.minor === c.minor && v.patch >= c.patch;
    }

    // Wildcard (1.x, 1.*, etc.)
    if (constraint.includes("x") || constraint.includes("*")) {
      const parts = constraint.split(".");
      if (
        parts[0] !== "x" &&
        parts[0] !== "*" &&
        parseInt(parts[0]) === v.major
      ) {
        if (parts[1] === "x" || parts[1] === "*") {
          return true;
        }
        if (parts[1] && parseInt(parts[1]) === v.minor) {
          return true;
        }
      }
    }

    // Range comparison (>=1.2.3, <2.0.0, etc.)
    if (constraint.startsWith(">=")) {
      const minVersion = constraint.substring(2);
      const min = this.parseSemVer(minVersion);
      if (min) {
        return this.compareVersions(v, min) >= 0;
      }
    }

    if (constraint.startsWith(">")) {
      const minVersion = constraint.substring(1);
      const min = this.parseSemVer(minVersion);
      if (min) {
        return this.compareVersions(v, min) > 0;
      }
    }

    if (constraint.startsWith("<=")) {
      const maxVersion = constraint.substring(2);
      const max = this.parseSemVer(maxVersion);
      if (max) {
        return this.compareVersions(v, max) <= 0;
      }
    }

    if (constraint.startsWith("<")) {
      const maxVersion = constraint.substring(1);
      const max = this.parseSemVer(maxVersion);
      if (max) {
        return this.compareVersions(v, max) < 0;
      }
    }

    // Direct semver comparison
    return this.compareVersions(v, c) === 0;
  }

  /**
   * Find the latest compatible version
   *
   * @param supportedVersions - Versions client supports
   * @param availableVersions - Available versions
   * @returns Latest compatible version or undefined
   */
  private findLatestCompatible(
    supportedVersions: string[],
    availableVersions: NegotiationCartridgeVersion[]
  ): NegotiationCartridgeVersion | undefined {
    const compatible = availableVersions.filter(v =>
      this.isSupported(v.version, supportedVersions)
    );

    if (compatible.length === 0) {
      return undefined;
    }

    // Sort by release time (most recent first) and version
    compatible.sort((a, b) => {
      if (a.releasedAt !== b.releasedAt) {
        return b.releasedAt - a.releasedAt;
      }
      return this.compareVersions(
        this.parseSemVer(b.version)!,
        this.parseSemVer(a.version)!
      );
    });

    return compatible[0];
  }

  /**
   * Find any compatible version (including deprecated)
   *
   * @param supportedVersions - Versions client supports
   * @param availableVersions - Available versions
   * @returns Any compatible version or undefined
   */
  private findAnyCompatible(
    supportedVersions: string[],
    availableVersions: NegotiationCartridgeVersion[]
  ): NegotiationCartridgeVersion | undefined {
    return availableVersions.find(v =>
      this.isSupported(v.version, supportedVersions)
    );
  }

  /**
   * Get the latest version (regardless of compatibility)
   *
   * @param availableVersions - Available versions
   * @returns Latest version
   */
  private getLatest(
    availableVersions: NegotiationCartridgeVersion[]
  ): NegotiationCartridgeVersion {
    const sorted = [...availableVersions].sort((a, b) => {
      // First sort by release time
      if (a.releasedAt !== b.releasedAt) {
        return b.releasedAt - a.releasedAt;
      }
      // Then by version number
      return this.compareVersions(
        this.parseSemVer(b.version)!,
        this.parseSemVer(a.version)!
      );
    });

    return sorted[0];
  }

  /**
   * Parse semantic version string
   *
   * @param version - Version string to parse
   * @returns Parsed SemVer or undefined if invalid
   */
  parseSemVer(version: string): NegotiationSemVer | undefined {
    // Remove leading ^ or ~ if present
    const cleanVersion = version.replace(/^[~^]/, "");

    // Match semver pattern: major.minor.patch[-prerelease][+build]
    const match = cleanVersion.match(
      /^(\d+)\.(\d+)\.(\d+)(?:-([^+]+))?(?:\+(.+))?$/
    );

    if (!match) {
      return undefined;
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
   * Compare two semantic versions
   *
   * @param a - First version
   * @param b - Second version
   * @returns Negative if a < b, 0 if a == b, positive if a > b
   */
  private compareVersions(a: NegotiationSemVer, b: NegotiationSemVer): number {
    if (a.major !== b.major) {
      return a.major - b.major;
    }
    if (a.minor !== b.minor) {
      return a.minor - b.minor;
    }
    if (a.patch !== b.patch) {
      return a.patch - b.patch;
    }

    // Compare pre-release if present
    if (a.prerelease && b.prerelease) {
      return a.prerelease.localeCompare(b.prerelease);
    }
    if (a.prerelease) {
      return -1; // Pre-release is less than release
    }
    if (b.prerelease) {
      return 1;
    }

    return 0;
  }

  /**
   * Check if two versions are compatible
   * Versions are compatible if they have the same major version (unless major is 0)
   *
   * @param version1 - First version
   * @param version2 - Second version
   * @returns True if versions are compatible
   */
  areVersionsCompatible(version1: string, version2: string): boolean {
    const v1 = this.parseSemVer(version1);
    const v2 = this.parseSemVer(version2);

    if (!v1 || !v2) {
      return false;
    }

    // Major version 0 is unstable, must match exactly
    if (v1.major === 0 || v2.major === 0) {
      return v1.major === v2.major && v1.minor === v2.minor;
    }

    // Same major version is compatible
    return v1.major === v2.major;
  }

  /**
   * Generate breaking changes list between two versions
   *
   * @param fromVersion - Starting version
   * @param toVersion - Target version
   * @param availableVersions - All available versions with breaking change info
   * @returns List of breaking changes
   */
  getBreakingChanges(
    fromVersion: string,
    toVersion: string,
    availableVersions: NegotiationCartridgeVersion[]
  ): string[] {
    const from = this.parseSemVer(fromVersion);
    const to = this.parseSemVer(toVersion);

    if (!from || !to) {
      return [];
    }

    // Find all versions between from and to that have breaking changes
    return availableVersions
      .filter(v => {
        const vSem = this.parseSemVer(v.version);
        if (!vSem || !v.breaking) {
          return false;
        }

        // Check if version is between from and to (exclusive)
        const compareToFrom = this.compareVersions(vSem, from);
        const compareToTo = this.compareVersions(vSem, to);

        return (
          (compareToFrom > 0 ||
            (compareToFrom === 0 && fromVersion !== toVersion)) &&
          compareToTo <= 0
        );
      })
      .map(v => v.version);
  }
}

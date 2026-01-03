/**
 * @fileoverview Version management for model registry
 * @description Handles version numbering, comparisons, and migrations
 */

import * as semver from "semver";
import type {
  ModelVersion,
  VersioningStrategy,
  ModelMetadata,
} from "../types.js";

/**
 * Version manager for handling model versioning
 */
export class VersionManager {
  private strategy: VersioningStrategy;

  constructor(strategy: VersioningStrategy = "semantic") {
    this.strategy = strategy;
  }

  /**
   * Generate a new version number
   * @param currentVersions Existing versions
   * @param increment Type of version increment
   * @returns New version string
   */
  generateVersion(
    currentVersions: ModelVersion[],
    increment: "major" | "minor" | "patch" = "patch"
  ): string {
    if (currentVersions.length === 0) {
      return "1.0.0";
    }

    // Get latest version
    const latest = this.getLatestVersion(currentVersions);

    if (this.strategy === "semantic") {
      return semver.inc(latest.version, increment) || "1.0.0";
    } else if (this.strategy === "timestamp") {
      return Date.now().toString();
    } else {
      // git_hash - return placeholder (actual hash provided externally)
      return `git-${Date.now()}`;
    }
  }

  /**
   * Get the latest version from a list
   * @param versions Version list
   * @returns Latest version
   */
  getLatestVersion(versions: ModelVersion[]): ModelVersion {
    if (versions.length === 0) {
      throw new Error("No versions available");
    }

    if (this.strategy === "semantic") {
      // Sort by semantic version
      const sorted = [...versions].sort((a, b) =>
        semver.compare(a.version, b.version)
      );
      return sorted.length > 0 ? sorted[sorted.length - 1] : versions[0];
    } else {
      // Sort by creation time
      return versions.reduce((latest, current) =>
        current.created > latest.created ? current : latest
      );
    }
  }

  /**
   * Compare two versions
   * @param versionA First version
   * @param versionB Second version
   * @returns Comparison result
   */
  compareVersions(versionA: string, versionB: string): number {
    if (this.strategy === "semantic") {
      return semver.compare(versionA, versionB);
    }
    // For timestamp/git_hash, compare numerically or lexicographically
    if (versionA === versionB) return 0;
    return versionA < versionB ? -1 : 1;
  }

  /**
   * Check if a version is valid
   * @param version Version string
   * @returns True if valid
   */
  isValidVersion(version: string): boolean {
    if (this.strategy === "semantic") {
      return semver.valid(version) !== null;
    }
    // For other strategies, any non-empty string is valid
    return version.length > 0;
  }

  /**
   * Get version precedence (highest version)
   * @param versions Version strings
   * @returns Highest version
   */
  getMaxVersion(versions: string[]): string | undefined {
    if (versions.length === 0) {
      return undefined;
    }

    if (this.strategy === "semantic") {
      const max = semver.maxSatisfying(versions, "*");
      return max || undefined;
    }

    // For other strategies, return last (most recent)
    return versions[versions.length - 1];
  }

  /**
   * Check if a version satisfies a range
   * @param version Version string
   * @param range Semver range
   * @returns True if satisfied
   */
  satisfies(version: string, range: string): boolean {
    if (this.strategy === "semantic") {
      return semver.satisfies(version, range);
    }
    // For other strategies, exact match only
    return version === range;
  }

  /**
   * Parse version string into components
   * @param version Version string
   * @returns Version components
   */
  parseVersion(version: string): {
    major: number;
    minor: number;
    patch: number;
    prerelease?: string;
  } {
    if (this.strategy === "semantic") {
      const parsed = semver.parse(version);
      if (!parsed) {
        throw new Error(`Invalid semantic version: ${version}`);
      }
      return {
        major: parsed.major,
        minor: parsed.minor,
        patch: parsed.patch,
        prerelease: parsed.prerelease.join(".") || undefined,
      };
    }

    // For other strategies, return placeholder
    return {
      major: 0,
      minor: 0,
      patch: 0,
      prerelease: version,
    };
  }

  /**
   * Calculate version distance between two versions
   * @param versionA First version
   * @param versionB Second version
   * @returns Number of version steps between
   */
  versionDistance(versionA: string, versionB: string): number {
    if (this.strategy === "semantic") {
      const parsedA = semver.parse(versionA);
      const parsedB = semver.parse(versionB);

      if (!parsedA || !parsedB) {
        throw new Error("Invalid version strings");
      }

      // Calculate difference in version numbers
      const majorDiff = parsedB.major - parsedA.major;
      const minorDiff = parsedB.minor - parsedA.minor;
      const patchDiff = parsedB.patch - parsedA.patch;

      return majorDiff * 10000 + minorDiff * 100 + patchDiff;
    }

    // For timestamp/git_hash, calculate time difference in days
    const numA = parseInt(versionA.replace(/\D/g, ""), 10);
    const numB = parseInt(versionB.replace(/\D/g, ""), 10);
    const diffMs = Math.abs(numB - numA);
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Suggest next version based on changes
   * @param currentVersion Current version
   * @param metadataChanged Whether model metadata changed
   * @param architectureChanged Whether architecture changed
   * @param retrained Whether model was retrained
   * @returns Suggested version increment
   */
  suggestVersionIncrement(
    currentVersion: string,
    metadataChanged: boolean,
    architectureChanged: boolean,
    retrained: boolean
  ): "major" | "minor" | "patch" {
    if (architectureChanged) {
      return "major";
    }
    if (retrained) {
      return "minor";
    }
    if (metadataChanged) {
      return "patch";
    }
    return "patch";
  }

  /**
   * Create version from training run
   * @param baseVersion Base model version
   * @param runId Training run ID
   * @param isFineTune Whether this is a fine-tuned model
   * @returns New version string
   */
  createTrainingVersion(
    baseVersion: string,
    runId: string,
    isFineTune: boolean
  ): string {
    const increment = isFineTune ? "minor" : "patch";
    const newVersion = semver.inc(baseVersion, increment);

    if (!newVersion) {
      throw new Error(`Failed to increment version: ${baseVersion}`);
    }

    // Add run ID as prerelease for tracking
    return `${newVersion}-${runId.slice(0, 8)}`;
  }

  /**
   * Get all versions between two versions (inclusive)
   * @param versions All available versions
   * @param from Start version
   * @param to End version
   * @returns Versions in range
   */
  getVersionsInRange(
    versions: ModelVersion[],
    from: string,
    to: string
  ): ModelVersion[] {
    return versions.filter(v => {
      const cmpFrom = this.compareVersions(v.version, from) >= 0;
      const cmpTo = this.compareVersions(v.version, to) <= 0;
      return cmpFrom && cmpTo;
    });
  }

  /**
   * Check if version update is a breaking change
   * @param fromVersion From version
   * @param toVersion To version
   * @returns True if breaking change
   */
  isBreakingChange(fromVersion: string, toVersion: string): boolean {
    if (this.strategy !== "semantic") {
      return false;
    }

    const parsedFrom = semver.parse(fromVersion);
    const parsedTo = semver.parse(toVersion);

    if (!parsedFrom || !parsedTo) {
      return false;
    }

    return parsedTo.major > parsedFrom.major;
  }
}

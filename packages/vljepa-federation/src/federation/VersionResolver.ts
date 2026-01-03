/**
 * VersionResolver - Resolve and manage module versions
 * Semantic versioning with conflict resolution
 */

import semver from "semver";
import type {
  VersionConfig,
  VersionResolution,
  VersionConflict,
  Migration,
  SharedDependency,
} from "../types.js";

export class VersionResolver {
  private versions: Map<string, string[]> = new Map();
  private dependencies: Map<string, SharedDependency> = new Map();

  constructor() {
    // Initialize
  }

  /**
   * Register module versions
   */
  registerVersions(module: string, versions: string[]): void {
    // Sort versions (newest first)
    const sorted = versions.sort((a, b) => {
      const diff = semver.compare(b, a);
      return diff;
    });
    this.versions.set(module, sorted);
  }

  /**
   * Register dependency
   */
  registerDependency(dep: SharedDependency): void {
    this.dependencies.set(dep.key, dep);
  }

  /**
   * Resolve version based on config
   */
  resolve(config: VersionConfig): VersionResolution {
    const available = this.versions.get(config.current) || config.available;

    let selected: string;
    const conflicts: VersionConflict[] = [];
    const migrations: Migration[] = [];

    switch (config.strategy) {
      case "latest":
        selected = this.resolveLatest(available);
        break;
      case "compatible":
        const result = this.resolveCompatible(config.range, available);
        selected = result.version;
        conflicts.push(...result.conflicts);
        migrations.push(...result.migrations);
        break;
      case "exact":
        selected = this.resolveExact(config.current, available);
        break;
      default:
        selected = available[0] || "0.0.0";
    }

    // Check for conflicts
    if (conflicts.length === 0) {
      const depConflicts = this.checkConflicts(config.current, selected);
      conflicts.push(...depConflicts);
    }

    const compatible =
      conflicts.filter(c => c.severity === "error").length === 0;

    return {
      selected,
      conflicts,
      migrations,
      compatible,
    };
  }

  /**
   * Resolve to latest version
   */
  private resolveLatest(versions: string[]): string {
    if (versions.length === 0) {
      return "0.0.0";
    }
    return versions[0];
  }

  /**
   * Resolve compatible version
   */
  private resolveCompatible(
    range: string,
    versions: string[]
  ): {
    version: string;
    conflicts: VersionConflict[];
    migrations: Migration[];
  } {
    const conflicts: VersionConflict[] = [];
    const migrations: Migration[] = [];

    // Find latest compatible version
    const compatible = versions.find(v => semver.satisfies(v, range));

    if (!compatible) {
      // No compatible version found
      conflicts.push({
        module: "unknown",
        requested: range,
        required: versions[0] || "unknown",
        severity: "error",
      });
      return {
        version: versions[0] || "0.0.0",
        conflicts,
        migrations,
      };
    }

    // Check if migration needed
    const current = versions[versions.length - 1];
    if (current !== compatible) {
      migrations.push(this.createMigration(current, compatible));
    }

    return {
      version: compatible,
      conflicts,
      migrations,
    };
  }

  /**
   * Resolve exact version
   */
  private resolveExact(version: string, versions: string[]): string {
    if (versions.includes(version)) {
      return version;
    }
    // Return closest match
    return versions[0] || "0.0.0";
  }

  /**
   * Check for version conflicts
   */
  private checkConflicts(module: string, version: string): VersionConflict[] {
    const conflicts: VersionConflict[] = [];

    for (const [key, dep] of this.dependencies) {
      if (
        dep.strictVersion &&
        !semver.satisfies(version, dep.requiredVersion)
      ) {
        conflicts.push({
          module: key,
          requested: dep.requiredVersion,
          required: version,
          severity: "error",
        });
      }
    }

    return conflicts;
  }

  /**
   * Create migration plan
   */
  private createMigration(from: string, to: string): Migration {
    const steps = this.createMigrationSteps(from, to);

    return {
      from,
      to,
      steps,
    };
  }

  /**
   * Create migration steps
   */
  private createMigrationSteps(from: string, to: string): any[] {
    const fromVer = semver.parse(from);
    const toVer = semver.parse(to);

    if (!fromVer || !toVer) {
      return [];
    }

    const steps: any[] = [];

    // Major version migration
    if (fromVer.major !== toVer.major) {
      steps.push({
        description: `Major version upgrade from ${fromVer.major} to ${toVer.major}`,
        transform: (data: any) => data,
      });
    }

    // Minor version migration
    if (fromVer.minor !== toVer.minor) {
      steps.push({
        description: `Minor version upgrade from ${fromVer.minor} to ${toVer.minor}`,
        transform: (data: any) => data,
      });
    }

    return steps;
  }

  /**
   * Get available versions for module
   */
  getVersions(module: string): string[] {
    return this.versions.get(module) || [];
  }

  /**
   * Get latest version for module
   */
  getLatestVersion(module: string): string | undefined {
    const versions = this.versions.get(module);
    return versions?.[0];
  }

  /**
   * Check if version is compatible with range
   */
  isCompatible(version: string, range: string): boolean {
    return semver.satisfies(version, range);
  }

  /**
   * Compare two versions
   */
  compare(v1: string, v2: string): number {
    return semver.compare(v1, v2);
  }

  /**
   * Get version difference
   */
  diff(v1: string, v2: string): "major" | "minor" | "patch" | null {
    return semver.diff(v1, v2) || null;
  }

  /**
   * Increment version
   */
  increment(version: string, release: "major" | "minor" | "patch"): string {
    return semver.inc(version, release) || version;
  }

  /**
   * Clean version string
   */
  clean(version: string): string | null {
    return semver.clean(version);
  }

  /**
   * Validate version
   */
  isValid(version: string): boolean {
    return semver.valid(version) !== null;
  }

  /**
   * Get all registered modules
   */
  getModules(): string[] {
    return Array.from(this.versions.keys());
  }

  /**
   * Clear resolver
   */
  clear(): void {
    this.versions.clear();
    this.dependencies.clear();
  }
}

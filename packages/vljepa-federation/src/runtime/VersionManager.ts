/**
 * VersionManager - Manage module versions
 * Track versions, handle migrations, resolve conflicts
 */

import semver from "semver";
import type {
  VersionConfig,
  VersionResolution,
  VersionConflict,
  ModuleInfo,
} from "../types.js";

export class VersionManager {
  private versions: Map<string, string[]> = new Map();
  private currentVersions: Map<string, string> = new Map();
  private migrations: Map<string, Map<string, Migration>> = new Map();
  private constraints: Map<string, string> = new Map();

  constructor() {
    // Initialize
  }

  /**
   * Register version for a module
   */
  registerVersion(module: string, version: string): void {
    if (!this.versions.has(module)) {
      this.versions.set(module, []);
    }

    const versions = this.versions.get(module)!;
    if (!versions.includes(version)) {
      versions.push(version);
      // Sort versions (newest first)
      versions.sort((a, b) => semver.compare(b, a));
    }
  }

  /**
   * Register multiple versions
   */
  registerVersions(module: string, versions: string[]): void {
    for (const version of versions) {
      this.registerVersion(module, version);
    }
  }

  /**
   * Set current version for a module
   */
  setCurrentVersion(module: string, version: string): void {
    this.currentVersions.set(module, version);
  }

  /**
   * Get current version
   */
  getCurrentVersion(module: string): string | undefined {
    return this.currentVersions.get(module);
  }

  /**
   * Get all versions for a module
   */
  getVersions(module: string): string[] {
    return this.versions.get(module) || [];
  }

  /**
   * Get latest version
   */
  getLatestVersion(module: string): string | undefined {
    const versions = this.getVersions(module);
    return versions[0];
  }

  /**
   * Resolve version based on config
   */
  resolve(config: VersionConfig): VersionResolution {
    const available = this.getVersions(config.current);

    let selected: string;
    const conflicts: VersionConflict[] = [];
    const migrations: any[] = [];

    switch (config.strategy) {
      case "latest":
        selected = this.resolveLatest(config.current);
        break;

      case "compatible":
        const compatResult = this.resolveCompatible(
          config.range,
          config.current
        );
        selected = compatResult.version;
        conflicts.push(...compatResult.conflicts);
        migrations.push(...compatResult.migrations);
        break;

      case "exact":
        selected = this.resolveExact(config.current, config.current);
        break;

      default:
        selected = available[0] || "0.0.0";
    }

    // Generate migrations
    if (migrations.length === 0) {
      const current = this.getCurrentVersion(config.current);
      if (current && current !== selected) {
        const migration = this.getMigration(config.current, current, selected);
        if (migration) {
          migrations.push(migration);
        }
      }
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
  private resolveLatest(module: string): string {
    return this.getLatestVersion(module) || "0.0.0";
  }

  /**
   * Resolve compatible version
   */
  private resolveCompatible(
    range: string,
    module: string
  ): {
    version: string;
    conflicts: VersionConflict[];
    migrations: any[];
  } {
    const versions = this.getVersions(module);
    const conflicts: VersionConflict[] = [];
    const migrations: any[] = [];

    const compatible = versions.find(v => semver.satisfies(v, range));

    if (!compatible) {
      conflicts.push({
        module,
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

    return {
      version: compatible,
      conflicts,
      migrations,
    };
  }

  /**
   * Resolve exact version
   */
  private resolveExact(module: string, version: string): string {
    const versions = this.getVersions(module);
    return versions.includes(version) ? version : versions[0] || "0.0.0";
  }

  /**
   * Register migration
   */
  registerMigration(
    module: string,
    from: string,
    to: string,
    steps: MigrationStep[]
  ): void {
    if (!this.migrations.has(module)) {
      this.migrations.set(module, new Map());
    }

    const key = `${from}->${to}`;
    this.migrations.get(module)!.set(key, {
      from,
      to,
      steps,
    });
  }

  /**
   * Get migration
   */
  private getMigration(
    module: string,
    from: string,
    to: string
  ): any | undefined {
    const moduleMigrations = this.migrations.get(module);
    if (!moduleMigrations) {
      return undefined;
    }

    return moduleMigrations.get(`${from}->${to}`);
  }

  /**
   * Set version constraint
   */
  setConstraint(module: string, range: string): void {
    this.constraints.set(module, range);
  }

  /**
   * Get version constraint
   */
  getConstraint(module: string): string | undefined {
    return this.constraints.get(module);
  }

  /**
   * Check if version satisfies constraint
   */
  satisfiesConstraint(module: string, version: string): boolean {
    const constraint = this.getConstraint(module);
    if (!constraint) {
      return true;
    }

    return semver.satisfies(version, constraint);
  }

  /**
   * Compare versions
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
   * Validate version
   */
  isValid(version: string): boolean {
    return semver.valid(version) !== null;
  }

  /**
   * Clean version string
   */
  clean(version: string): string | null {
    return semver.clean(version);
  }

  /**
   * Get all modules
   */
  getModules(): string[] {
    return Array.from(this.versions.keys());
  }

  /**
   * Check for version conflicts between modules
   */
  checkConflicts(): VersionConflict[] {
    const conflicts: VersionConflict[] = [];

    for (const [module, versions] of this.versions) {
      const constraint = this.getConstraint(module);
      if (!constraint) {
        continue;
      }

      for (const version of versions) {
        if (!semver.satisfies(version, constraint)) {
          conflicts.push({
            module,
            requested: constraint,
            required: version,
            severity: "warning",
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.versions.clear();
    this.currentVersions.clear();
    this.migrations.clear();
    this.constraints.clear();
  }
}

/**
 * Migration step
 */
export interface MigrationStep {
  description: string;
  transform: (data: any) => any | Promise<any>;
}

/**
 * Migration
 */
export interface Migration {
  from: string;
  to: string;
  steps: MigrationStep[];
}

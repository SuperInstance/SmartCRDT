/**
 * @lsi/compatibility - Version compatibility checking and migration system
 *
 * This module provides comprehensive version compatibility tracking,
 * breaking change detection, and migration guidance for Aequor components.
 */

import { satisfies, coerce, valid, SemVer } from 'semver';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import * as YAML from 'yaml';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Component constraint for compatibility checking
 */
export interface ComponentConstraint {
  /** Component name (e.g., @lsi/cascade) */
  component: string;
  /** Version or version range */
  version: string;
}

/**
 * Severity level for compatibility issues
 */
export type IssueSeverity = 'error' | 'warning' | 'info';

/**
 * Type of compatibility issue
 */
export type IssueType =
  | 'breaking_change'
  | 'version_mismatch'
  | 'deprecated'
  | 'missing_dependency'
  | 'incompatible_api'
  | 'platform_mismatch';

/**
 * A single compatibility issue
 */
export interface CompatibilityIssue {
  /** Issue severity */
  severity: IssueSeverity;
  /** Issue type */
  type: IssueType;
  /** Human-readable message */
  message: string;
  /** Affected component */
  component?: string;
  /** Affected version */
  version?: string;
  /** Suggested fix */
  suggestion?: string;
  /** Related documentation link */
  documentation?: string;
}

/**
 * Breaking change definition
 */
export interface BreakingChange {
  /** Unique identifier */
  id: string;
  /** Type of breaking change */
  type: 'removed' | 'changed' | 'renamed' | 'behavior';
  /** Severity level */
  severity: 'major' | 'minor' | 'patch';
  /** Description of what changed */
  description: string;
  /** Affected API */
  affected_api?: {
    interface?: string;
    method?: string;
    signature_change?: {
      from: string;
      to: string;
    };
    changed_fields?: string[];
  };
  /** Migration guidance */
  migration?: {
    from: string;
    to: string;
    guide?: string;
    steps: string[];
    automated_tools?: Array<{
      name: string;
      url: string;
      command: string;
    }>;
  };
  /** Code examples */
  examples?: {
    before: string;
    after: string;
  };
}

/**
 * Component version entry from compatibility matrix
 */
export interface ComponentVersion {
  /** API version */
  api_version: string;
  /** Release information */
  release: {
    date: string;
    changelog: string;
    announcement?: string;
  };
  /** Dependencies with version constraints */
  dependencies?: Record<string, { version: string; required: boolean; reason?: string }>;
  /** Peer dependencies */
  peerDependencies?: Record<string, { version: string; optional?: boolean }>;
  /** Compatibility with other components */
  compatible_with?: Array<{
    component: string;
    versions: string[];
    tested?: boolean;
    compatible?: boolean;
    notes?: string;
    reason?: string;
  }>;
  /** Breaking changes in this version */
  breaking_changes: BreakingChange[];
  /** New features */
  features?: Array<{
    id: string;
    description: string;
    stable: boolean;
    api?: Array<{
      interface: string;
      methods?: string[];
    }>;
  }>;
  /** Deprecated features */
  deprecated?: Array<{
    id: string;
    description: string;
    deprecated_in: string;
    removed_in: string;
    replacement?: string;
    migration_guide?: string;
  }>;
  /** Platform compatibility */
  platforms?: Array<{
    name: string;
    versions: string;
    tested: string[];
  }>;
  /** Migration guide reference */
  migration_guide?: string;
}

/**
 * Component entry from compatibility matrix
 */
export interface ComponentMatrix {
  /** Component name */
  component: string;
  /** Component metadata */
  metadata: {
    displayName: string;
    description: string;
    repository?: string;
    homepage?: string;
    stability: 'stable' | 'beta' | 'alpha' | 'deprecated';
    license: string;
  };
  /** All versions */
  versions: Record<string, ComponentVersion>;
  /** Current version */
  current: string;
  /** Supported versions */
  supported: string[];
  /** Unsupported versions */
  unsupported?: string[];
}

/**
 * Compatibility report
 */
export interface CompatibilityReport {
  /** Overall compatibility status */
  compatible: boolean;
  /** Component being checked */
  component: string;
  /** Version being checked */
  version: string;
  /** Checked against these constraints */
  with: ComponentConstraint[];
  /** Compatibility issues found */
  issues: CompatibilityIssue[];
  /** Warnings (non-blocking) */
  warnings: string[];
  /** Informational messages */
  info: string[];
  /** Suggested compatible versions */
  suggestions?: string[];
  /** Migration path if incompatible */
  migration_path?: MigrationPath;
}

/**
 * Migration step
 */
export interface MigrationStep {
  /** Step number */
  step: number;
  /** Step description */
  description: string;
  /** Estimated time */
  estimated_time?: string;
  /** Code examples */
  code_example?: {
    before: string;
    after: string;
  };
  /** Automated tool */
  automated_tool?: string;
}

/**
 * Migration path between versions
 */
export interface MigrationPath {
  /** Source version */
  from: string;
  /** Target version */
  to: string;
  /** Breaking changes to address */
  breaking_changes: BreakingChange[];
  /** Migration steps */
  steps: MigrationStep[];
  /** Estimated total time */
  estimated_time?: string;
  /** Difficulty level */
  difficulty: 'easy' | 'medium' | 'hard';
  /** Migration guide reference */
  guide?: string;
}

/**
 * Migration guide
 */
export interface MigrationGuide {
  /** Source version */
  from: string;
  /** Target version */
  to: string;
  /** Component name */
  component: string;
  /** Breaking changes */
  breaking_changes: BreakingChange[];
  /** New features */
  new_features: string[];
  /** Migration steps */
  migration_steps: string[];
  /** Code examples */
  examples: Array<{
    description: string;
    before: string;
    after: string;
  }>;
}

/**
 * Version range result
 */
export interface VersionRangeResult {
  /** All available versions */
  all_versions: string[];
  /** Compatible versions */
  compatible_versions: string[];
  /** Latest compatible version */
  latest_compatible: string | null;
  /** Latest stable version */
  latest_stable: string | null;
}

// ============================================================================
// COMPATIBILITY CHECKER
// ============================================================================

/**
 * Version compatibility checker for Aequor components
 *
 * Provides comprehensive compatibility checking, breaking change detection,
 * and migration guidance between component versions.
 */
export class CompatibilityChecker {
  private matrixCache: Map<string, ComponentMatrix> = new Map();
  private matrixDirectory: string;

  /**
   * Create a new compatibility checker
   *
   * @param matrixDirectory - Directory containing compatibility matrix YAML files
   */
  constructor(matrixDirectory: string = '/mnt/c/users/casey/smartCRDT/demo/docs/compatibility/matrix') {
    this.matrixDirectory = matrixDirectory;
  }

  // ========================================================================
  // COMPATIBILITY CHECKING
  // ========================================================================

  /**
   * Check if component version is compatible with given constraints
   *
   * @param component - Component name
   * @param version - Component version
   * @param withConstraints - Array of component constraints to check against
   * @returns Compatibility report
   */
  async checkCompatibility(
    component: string,
    version: string,
    withConstraints: ComponentConstraint[]
  ): Promise<CompatibilityReport> {
    const issues: CompatibilityIssue[] = [];
    const warnings: string[] = [];
    const info: string[] = [];

    // Load component matrix
    const matrix = await this.loadMatrix(component);
    if (!matrix) {
      return {
        compatible: false,
        component,
        version,
        with: withConstraints,
        issues: [
          {
            severity: 'error',
            type: 'version_mismatch',
            message: `Component ${component} not found in compatibility matrix`,
            suggestion: 'Check component name or add to compatibility matrix',
          },
        ],
        warnings: [],
        info: [],
      };
    }

    // Check if version exists
    if (!matrix.versions[version]) {
      return {
        compatible: false,
        component,
        version,
        with: withConstraints,
        issues: [
          {
            severity: 'error',
            type: 'version_mismatch',
            message: `Version ${version} not found for component ${component}`,
            component,
            version,
            suggestion: `Available versions: ${Object.keys(matrix.versions).join(', ')}`,
          },
        ],
        warnings: [],
        info: [],
      };
    }

    const versionInfo = matrix.versions[version];

    // Check compatibility with each constraint
    for (const constraint of withConstraints) {
      const constraintIssues = await this.checkConstraint(
        component,
        version,
        versionInfo,
        constraint
      );
      issues.push(...constraintIssues.issues);
      warnings.push(...constraintIssues.warnings);
      info.push(...constraintIssues.info);
    }

    // Check for deprecations
    if (matrix.metadata.stability === 'deprecated') {
      warnings.push(
        `Component ${component} is deprecated. Consider migrating to an alternative.`
      );
    }

    // Check if version is supported
    if (!matrix.supported.includes(version) && !matrix.unsupported?.includes(version)) {
      info.push(
        `Version ${version} is not explicitly marked as supported or unsupported.`
      );
    }

    // Determine overall compatibility
    const errors = issues.filter((i) => i.severity === 'error');
    const compatible = errors.length === 0;

    // Generate migration path if incompatible
    let migration_path: MigrationPath | undefined;
    if (!compatible) {
      const latestCompatible = await this.findLatestCompatible(component, withConstraints);
      if (latestCompatible && latestCompatible !== version) {
        migration_path = await this.generateMigration(component, version, latestCompatible);
      }
    }

    // Generate suggestions if incompatible
    let suggestions: string[] | undefined;
    if (!compatible) {
      suggestions = await this.findCompatibleVersions(component, withConstraints);
    }

    return {
      compatible,
      component,
      version,
      with: withConstraints,
      issues,
      warnings,
      info,
      suggestions,
      migration_path,
    };
  }

  /**
   * Check a single constraint against component version
   */
  private async checkConstraint(
    component: string,
    version: string,
    versionInfo: ComponentVersion,
    constraint: ComponentConstraint
  ): Promise<{
    issues: CompatibilityIssue[];
    warnings: string[];
    info: string[];
  }> {
    const issues: CompatibilityIssue[] = [];
    const warnings: string[] = [];
    const info: string[] = [];

    // Skip if checking against self
    if (constraint.component === component) {
      return { issues, warnings, info };
    }

    // Load constraint component matrix
    const constraintMatrix = await this.loadMatrix(constraint.component);
    if (!constraintMatrix) {
      warnings.push(
        `Constraint component ${constraint.component} not found in compatibility matrix`
      );
      return { issues, warnings, info };
    }

    // Parse constraint version
    const constraintVersion = this.parseVersion(constraint.version);
    if (!constraintVersion) {
      issues.push({
        severity: 'error',
        type: 'version_mismatch',
        message: `Invalid version constraint: ${constraint.version}`,
        component: constraint.component,
        suggestion: 'Use valid semver range (e.g., ^1.0.0, >=2.0.0)',
      });
      return { issues, warnings, info };
    }

    // Check if constraint version exists
    if (!constraintMatrix.versions[constraint.version]) {
      warnings.push(
        `Version ${constraint.version} not found for ${constraint.component}`
      );
    }

    // Check explicit compatibility matrix
    if (versionInfo.compatible_with) {
      for (const compat of versionInfo.compatible_with) {
        if (compat.component === constraint.component) {
          // Check if constraint version matches compatible versions
          const isCompatible = compat.versions.some((range) =>
            satisfies(constraintVersion, range)
          );

          if (compat.compatible === false && isCompatible) {
            issues.push({
              severity: 'error',
              type: 'incompatible_api',
              message: `${component}@${version} is incompatible with ${constraint.component}@${constraint.version}`,
              component: constraint.component,
              version: constraint.version,
              reason: compat.reason || 'API incompatibility',
              suggestion: `Use compatible version: ${compat.versions.filter(v => v !== constraint.version).join(', ')}`,
            });
          } else if (isCompatible && !compat.tested) {
            info.push(
              `${constraint.component}@${constraint.version} is compatible but not tested with ${component}@${version}`
            );
          }
        }
      }
    }

    // Check dependencies
    if (versionInfo.dependencies) {
      for (const [depName, depInfo] of Object.entries(versionInfo.dependencies)) {
        if (depName === constraint.component) {
          if (!satisfies(constraintVersion, depInfo.version)) {
            issues.push({
              severity: 'error',
              type: 'version_mismatch',
              message: `${component}@${version} requires ${depName}@${depInfo.version}, but got ${constraint.version}`,
              component: depName,
              version: constraint.version,
              suggestion: `Upgrade ${depName} to ${depInfo.version}`,
            });
          }
        }
      }
    }

    // Check for breaking changes
    if (versionInfo.breaking_changes && versionInfo.breaking_changes.length > 0) {
      info.push(
        `Version ${version} has ${versionInfo.breaking_changes.length} breaking changes`
      );
    }

    return { issues, warnings, info };
  }

  // ========================================================================
  // VERSION FINDING
  // ========================================================================

  /**
   * Find all compatible versions for a component given constraints
   *
   * @param component - Component name
   * @param constraints - Array of component constraints
   * @returns Array of compatible version strings
   */
  async findCompatibleVersions(
    component: string,
    constraints: ComponentConstraint[]
  ): Promise<string[]> {
    const matrix = await this.loadMatrix(component);
    if (!matrix) {
      return [];
    }

    const compatibleVersions: string[] = [];

    for (const [version, versionInfo] of Object.entries(matrix.versions)) {
      const report = await this.checkCompatibility(component, version, constraints);
      if (report.compatible) {
        compatibleVersions.push(version);
      }
    }

    // Sort by semver (descending)
    return compatibleVersions.sort((a, b) => {
      const aVer = valid(coerce(a));
      const bVer = valid(coerce(b));
      if (!aVer || !bVer) return 0;
      return bVer.compare(aVer);
    });
  }

  /**
   * Find latest compatible version
   *
   * @param component - Component name
   * @param constraints - Array of component constraints
   * @returns Latest compatible version or null
   */
  async findLatestCompatible(
    component: string,
    constraints: ComponentConstraint[]
  ): Promise<string | null> {
    const versions = await this.findCompatibleVersions(component, constraints);
    return versions.length > 0 ? versions[0] : null;
  }

  /**
   * Get version range information
   *
   * @param component - Component name
   * @param constraints - Array of component constraints
   * @returns Version range information
   */
  async getVersionRange(
    component: string,
    constraints: ComponentConstraint[]
  ): Promise<VersionRangeResult> {
    const matrix = await this.loadMatrix(component);
    if (!matrix) {
      return {
        all_versions: [],
        compatible_versions: [],
        latest_compatible: null,
        latest_stable: null,
      };
    }

    const allVersions = Object.keys(matrix.versions).sort((a, b) => {
      const aVer = valid(coerce(a));
      const bVer = valid(coerce(b));
      if (!aVer || !bVer) return 0;
      return bVer.compare(aVer);
    });

    const compatibleVersions = await this.findCompatibleVersions(component, constraints);

    const latestCompatible = compatibleVersions.length > 0
      ? compatibleVersions[0]
      : null;

    const latestStable = allVersions.length > 0
      ? allVersions[0]
      : null;

    return {
      all_versions: allVersions,
      compatible_versions: compatibleVersions,
      latest_compatible: latestCompatible,
      latest_stable: latestStable,
    };
  }

  // ========================================================================
  // MIGRATION
  // ========================================================================

  /**
   * Generate migration guide between two versions
   *
   * @param component - Component name
   * @param from - Source version
   * @param to - Target version
   * @returns Migration guide
   */
  async generateMigration(
    component: string,
    from: string,
    to: string
  ): Promise<MigrationPath> {
    const matrix = await this.loadMatrix(component);
    if (!matrix) {
      throw new Error(`Component ${component} not found`);
    }

    const fromVersion = matrix.versions[from];
    const toVersion = matrix.versions[to];

    if (!fromVersion || !toVersion) {
      throw new Error(`Version ${from} or ${to} not found for component ${component}`);
    }

    // Collect breaking changes
    const breakingChanges: BreakingChange[] = [];
    const steps: MigrationStep[] = [];
    let stepNum = 1;

    // Collect breaking changes from all intermediate versions
    const versions = Object.keys(matrix.versions)
      .map((v) => valid(coerce(v)))
      .filter((v): v is SemVer => v !== null)
      .sort((a, b) => a.compare(b));

    const fromVer = valid(coerce(from));
    const toVer = valid(coerce(to));

    if (!fromVer || !toVer) {
      throw new Error('Invalid version format');
    }

    for (const ver of versions) {
      if (ver.compare(fromVer) > 0 && ver.compare(toVer) <= 0) {
        const versionStr = ver.version;
        const versionInfo = matrix.versions[versionStr];
        if (versionInfo.breaking_changes) {
          breakingChanges.push(...versionInfo.breaking_changes);

          // Generate migration steps
          for (const bc of versionInfo.breaking_changes) {
            if (bc.migration) {
              steps.push({
                step: stepNum++,
                description: bc.description,
                estimated_time: '10 minutes',
                code_example: bc.examples
                  ? {
                      before: bc.examples.before,
                      after: bc.examples.after,
                    }
                  : undefined,
                automated_tool: bc.migration.automated_tools?.[0]?.command,
              });
            }
          }
        }
      }
    }

    // Estimate difficulty
    const difficulty: 'easy' | 'medium' | 'hard' =
      breakingChanges.length === 0
        ? 'easy'
        : breakingChanges.length < 3
        ? 'medium'
        : 'hard';

    // Estimate time
    const estimatedTime = `${breakingChanges.length * 15}-${breakingChanges.length * 30} minutes`;

    return {
      from,
      to,
      breaking_changes: breakingChanges,
      steps,
      estimated_time: estimatedTime,
      difficulty,
      guide: toVersion.migration_guide,
    };
  }

  /**
   * Check if there are breaking changes between two versions
   *
   * @param component - Component name
   * @param from - Source version
   * @param to - Target version
   * @returns True if breaking changes exist
   */
  async hasBreakingChanges(
    component: string,
    from: string,
    to: string
  ): Promise<boolean> {
    const matrix = await this.loadMatrix(component);
    if (!matrix) {
      return false;
    }

    const fromVer = valid(coerce(from));
    const toVer = valid(coerce(to));

    if (!fromVer || !toVer) {
      return false;
    }

    // Check all versions between from and to
    const versions = Object.keys(matrix.versions)
      .map((v) => valid(coerce(v)))
      .filter((v): v is SemVer => v !== null)
      .sort((a, b) => a.compare(b));

    for (const ver of versions) {
      if (ver.compare(fromVer) > 0 && ver.compare(toVer) <= 0) {
        const versionInfo = matrix.versions[ver.version];
        if (
          versionInfo.breaking_changes &&
          versionInfo.breaking_changes.length > 0
        ) {
          return true;
        }
      }
    }

    return false;
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Load component matrix from cache or file
   */
  private async loadMatrix(component: string): Promise<ComponentMatrix | null> {
    // Check cache first
    if (this.matrixCache.has(component)) {
      return this.matrixCache.get(component)!;
    }

    // Try to load from file
    const filename = component.replace('@lsi/', '').replace('/', '-') + '.yaml';
    const filepath = resolve(this.matrixDirectory, filename);

    if (!existsSync(filepath)) {
      return null;
    }

    try {
      const content = readFileSync(filepath, 'utf-8');
      const matrix = YAML.parse(content) as ComponentMatrix;

      // Cache it
      this.matrixCache.set(component, matrix);

      return matrix;
    } catch (error) {
      console.error(`Failed to load matrix for ${component}:`, error);
      return null;
    }
  }

  /**
   * Parse version string to SemVer
   */
  private parseVersion(version: string): SemVer | null {
    // Handle ranges
    if (version.includes('^') || version.includes('~') || version.includes('>')) {
      // For ranges, try to extract base version
      const match = version.match(/^[\^~]?\s*(\d+\.\d+\.\d+)/);
      if (match) {
        return valid(match[1]);
      }
    }

    return valid(coerce(version));
  }

  /**
   * Clear matrix cache
   */
  clearCache(): void {
    this.matrixCache.clear();
  }

  /**
   * Get all cached component names
   */
  getCachedComponents(): string[] {
    return Array.from(this.matrixCache.keys());
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a compatibility checker with default settings
 */
export function createCompatibilityChecker(
  matrixDirectory?: string
): CompatibilityChecker {
  return new CompatibilityChecker(matrixDirectory);
}

/**
 * Default compatibility checker instance
 */
export const defaultChecker = new CompatibilityChecker();

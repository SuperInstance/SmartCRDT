/**
 * VersionNegotiator - Negotiate versions between modules
 * Resolve version conflicts and find compatible versions
 */

import semver from "semver";
import type { VersionConflict, SharedDep } from "../types.js";

export class VersionNegotiator {
  private requirements: Map<string, VersionRequirement[]> = new Map();

  /**
   * Register version requirement
   */
  registerRequirement(module: string, version: string, consumer: string): void {
    if (!this.requirements.has(module)) {
      this.requirements.set(module, []);
    }

    this.requirements.get(module)!.push({
      version,
      consumer,
      parsed: semver.parse(version),
    });
  }

  /**
   * Negotiate compatible version
   */
  negotiate(module: string, availableVersions: string[]): NegotiationResult {
    const requirements = this.requirements.get(module) || [];
    const conflicts: VersionConflict[] = [];

    if (requirements.length === 0) {
      return {
        selected: availableVersions[0] || "latest",
        compatible: true,
        conflicts: [],
        satisfied: new Set(),
      };
    }

    // Find version that satisfies all requirements
    let selected: string | undefined;

    for (const version of availableVersions) {
      const satisfied = new Set<string>();

      let allSatisfied = true;
      for (const req of requirements) {
        if (this.satisfies(version, req.version)) {
          satisfied.add(req.consumer);
        } else {
          allSatisfied = false;
          conflicts.push({
            module,
            requested: req.version,
            required: version,
            severity: this.getSeverity(req.version, version),
          });
        }
      }

      if (allSatisfied) {
        selected = version;
        return {
          selected,
          compatible: true,
          conflicts: [],
          satisfied,
        };
      }
    }

    // No version satisfies all requirements
    // Try to find version that satisfies most requirements
    const bestMatch = this.findBestMatch(
      module,
      availableVersions,
      requirements
    );

    return {
      selected: bestMatch.version,
      compatible: bestMatch.satisfied.size === requirements.length,
      conflicts,
      satisfied: bestMatch.satisfied,
    };
  }

  /**
   * Check if version satisfies requirement
   */
  private satisfies(version: string, requirement: string): boolean {
    try {
      return semver.satisfies(version, requirement);
    } catch {
      return false;
    }
  }

  /**
   * Get conflict severity
   */
  private getSeverity(
    requested: string,
    required: string
  ): "error" | "warning" {
    try {
      const reqParsed = semver.parse(requested);
      const provParsed = semver.parse(required);

      if (!reqParsed || !provParsed) {
        return "warning";
      }

      // Major version mismatch is error
      if (reqParsed.major !== provParsed.major) {
        return "error";
      }

      return "warning";
    } catch {
      return "warning";
    }
  }

  /**
   * Find best matching version
   */
  private findBestMatch(
    module: string,
    availableVersions: string[],
    requirements: VersionRequirement[]
  ): { version: string; satisfied: Set<string> } {
    let bestVersion = availableVersions[0] || "latest";
    let bestSatisfied = new Set<string>();

    for (const version of availableVersions) {
      const satisfied = new Set<string>();

      for (const req of requirements) {
        if (this.satisfies(version, req.version)) {
          satisfied.add(req.consumer);
        }
      }

      if (satisfied.size > bestSatisfied.size) {
        bestSatisfied = satisfied;
        bestVersion = version;
      }
    }

    return { version: bestVersion, satisfied: bestSatisfied };
  }

  /**
   * Get requirements for a module
   */
  getRequirements(module: string): VersionRequirement[] {
    return this.requirements.get(module) || [];
  }

  /**
   * Get all requirements
   */
  getAllRequirements(): Map<string, VersionRequirement[]> {
    return new Map(this.requirements);
  }

  /**
   * Clear requirements for a module
   */
  clearRequirements(module: string): void {
    this.requirements.delete(module);
  }

  /**
   * Clear all requirements
   */
  clearAll(): void {
    this.requirements.clear();
  }

  /**
   * Find modules with conflicts
   */
  findConflicts(): Map<string, VersionConflict[]> {
    const conflicts = new Map<string, VersionConflict[]>();

    for (const [module, requirements] of this.requirements) {
      const moduleConflicts: VersionConflict[] = [];

      // Check for incompatible requirements
      for (let i = 0; i < requirements.length; i++) {
        for (let j = i + 1; j < requirements.length; j++) {
          const req1 = requirements[i];
          const req2 = requirements[j];

          if (!this.areCompatible(req1.version, req2.version)) {
            moduleConflicts.push({
              module,
              requested: req1.version,
              required: req2.version,
              severity: "error",
            });
          }
        }
      }

      if (moduleConflicts.length > 0) {
        conflicts.set(module, moduleConflicts);
      }
    }

    return conflicts;
  }

  /**
   * Check if two version requirements are compatible
   */
  private areCompatible(req1: string, req2: string): boolean {
    try {
      // Simple check - if ranges overlap
      const range1 = new semver.Range(req1);
      const range2 = new semver.Range(req2);

      // Check if any version satisfies both
      for (const v of ["1.0.0", "2.0.0", "3.0.0"]) {
        if (range1.test(v) && range2.test(v)) {
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Suggest version resolution
   */
  suggestResolution(module: string, availableVersions: string[]): Suggestion {
    const requirements = this.requirements.get(module) || [];
    const conflicts = this.findConflicts().get(module) || [];

    if (conflicts.length === 0) {
      const result = this.negotiate(module, availableVersions);
      return {
        type: "exact",
        version: result.selected,
        reason: "All requirements satisfied",
      };
    }

    // Suggest latest compatible
    const latest = availableVersions[0] || "latest";
    const satisfiedByLatest = new Set<string>();

    for (const req of requirements) {
      if (this.satisfies(latest, req.version)) {
        satisfiedByLatest.add(req.consumer);
      }
    }

    if (satisfiedByLatest.size === requirements.length) {
      return {
        type: "upgrade",
        version: latest,
        reason: "Latest version satisfies all requirements",
      };
    }

    // Suggest compromise
    const allVersions = [
      ...availableVersions,
      ...requirements.map(r => r.version),
    ];
    const uniqueVersions = [...new Set(allVersions)];

    return {
      type: "compromise",
      version: this.findBestMatch(module, availableVersions, requirements)
        .version,
      reason: "Partial compatibility - some consumers may need updates",
    };
  }

  /**
   * Get negotiation statistics
   */
  getStats(): {
    totalModules: number;
    totalRequirements: number;
    conflictingModules: number;
  } {
    let totalRequirements = 0;
    let conflictingModules = 0;

    for (const [module, requirements] of this.requirements) {
      totalRequirements += requirements.length;

      const conflicts = this.findConflicts().get(module);
      if (conflicts && conflicts.length > 0) {
        conflictingModules++;
      }
    }

    return {
      totalModules: this.requirements.size,
      totalRequirements,
      conflictingModules,
    };
  }
}

/**
 * Version requirement
 */
interface VersionRequirement {
  version: string;
  consumer: string;
  parsed: semver.SemVer | null;
}

/**
 * Negotiation result
 */
interface NegotiationResult {
  selected: string;
  compatible: boolean;
  conflicts: VersionConflict[];
  satisfied: Set<string>;
}

/**
 * Suggestion
 */
interface Suggestion {
  type: "exact" | "upgrade" | "compromise";
  version: string;
  reason: string;
}

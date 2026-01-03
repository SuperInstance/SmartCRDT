/**
 * CompatibilityChecker - Check module compatibility
 * Verify API, version, and dependency compatibility
 */

import type { CompatibilityResult, CompatibilityIssue } from "../types.js";

export class CompatibilityChecker {
  private apiSpecs: Map<string, APISpec> = new Map();
  private versionConstraints: Map<string, string> = new Map();

  /**
   * Register API specification
   */
  registerAPISpec(module: string, spec: APISpec): void {
    this.apiSpecs.set(module, spec);
  }

  /**
   * Register version constraint
   */
  registerVersionConstraint(module: string, constraint: string): void {
    this.versionConstraints.set(module, constraint);
  }

  /**
   * Check compatibility between two module versions
   */
  checkCompatibility(
    module1: string,
    version1: string,
    module2: string,
    version2: string
  ): CompatibilityResult {
    const issues: CompatibilityIssue[] = [];

    // Check API compatibility
    const apiIssues = this.checkAPICompatibility(module1, module2);
    issues.push(...apiIssues);

    // Check version compatibility
    const versionIssues = this.checkVersionCompatibility(
      module1,
      version1,
      version2
    );
    issues.push(...versionIssues);

    // Check dependency compatibility
    const depIssues = this.checkDependencyCompatibility(
      module1,
      version1,
      module2,
      version2
    );
    issues.push(...depIssues);

    const compatible = !issues.some(i => i.severity === "error");

    return {
      compatible,
      issues,
      suggestions: this.generateSuggestions(issues),
    };
  }

  /**
   * Check API compatibility
   */
  private checkAPICompatibility(
    module1: string,
    module2: string
  ): CompatibilityIssue[] {
    const issues: CompatibilityIssue[] = [];
    const spec1 = this.apiSpecs.get(module1);
    const spec2 = this.apiSpecs.get(module2);

    if (!spec1 || !spec2) {
      return [];
    }

    // Check for breaking changes
    for (const method of spec1.methods) {
      const otherMethod = spec2.methods.find(m => m.name === method.name);

      if (!otherMethod) {
        issues.push({
          type: "api",
          severity: "error",
          message: `Method ${method.name} removed in ${module2}`,
          affected: [module1, module2],
        });
        continue;
      }

      // Check signature changes
      if (
        !this.areSignaturesCompatible(method.signature, otherMethod.signature)
      ) {
        issues.push({
          type: "api",
          severity: "error",
          message: `Method ${method.name} signature changed`,
          affected: [method.name],
        });
      }

      // Check return type changes
      if (method.returnType !== otherMethod.returnType) {
        issues.push({
          type: "api",
          severity: "warning",
          message: `Method ${method.name} return type changed`,
          affected: [method.name],
        });
      }
    }

    return issues;
  }

  /**
   * Check version compatibility
   */
  private checkVersionCompatibility(
    module: string,
    currentVersion: string,
    targetVersion: string
  ): CompatibilityIssue[] {
    const issues: CompatibilityIssue[] = [];
    const constraint = this.versionConstraints.get(module);

    if (!constraint) {
      return [];
    }

    try {
      // Simple version check
      const currentParts = currentVersion.split(".").map(Number);
      const targetParts = targetVersion.split(".").map(Number);

      // Major version change is breaking
      if (currentParts[0] !== targetParts[0]) {
        issues.push({
          type: "version",
          severity: "error",
          message: `Major version change from ${currentVersion} to ${targetVersion}`,
          affected: [module],
        });
      }
    } catch (error) {
      issues.push({
        type: "version",
        severity: "warning",
        message: `Could not parse version: ${error}`,
        affected: [module],
      });
    }

    return issues;
  }

  /**
   * Check dependency compatibility
   */
  private checkDependencyCompatibility(
    module1: string,
    version1: string,
    module2: string,
    version2: string
  ): CompatibilityIssue[] {
    const issues: CompatibilityIssue[] = [];

    const spec1 = this.apiSpecs.get(module1);
    const spec2 = this.apiSpecs.get(module2);

    if (!spec1 || !spec2) {
      return [];
    }

    // Check for conflicting dependencies
    for (const [dep, version1] of Object.entries(spec1.dependencies || {})) {
      const version2 = spec2.dependencies?.[dep];

      if (version2 && version1 !== version2) {
        issues.push({
          type: "dependency",
          severity: "warning",
          message: `Dependency ${dep} version conflict: ${version1} vs ${version2}`,
          affected: [dep],
        });
      }
    }

    return issues;
  }

  /**
   * Check if two method signatures are compatible
   */
  private areSignaturesCompatible(sig1: string, sig2: string): boolean {
    // Simple check - in real implementation would parse signatures
    return sig1 === sig2;
  }

  /**
   * Generate suggestions for resolving issues
   */
  private generateSuggestions(issues: CompatibilityIssue[]): string[] {
    const suggestions: string[] = [];

    for (const issue of issues) {
      switch (issue.type) {
        case "api":
          suggestions.push(`Review API changes and update consumers`);
          break;
        case "version":
          suggestions.push(`Consider using compatible version ranges`);
          break;
        case "dependency":
          suggestions.push(`Unify dependency versions across modules`);
          break;
      }
    }

    return [...new Set(suggestions)];
  }

  /**
   * Check module against constraints
   */
  checkConstraints(module: string, version: string): CompatibilityResult {
    const issues: CompatibilityIssue[] = [];
    const constraint = this.versionConstraints.get(module);

    if (constraint) {
      const satisfied = this.satisfiesConstraint(version, constraint);
      if (!satisfied) {
        issues.push({
          type: "version",
          severity: "error",
          message: `Version ${version} does not satisfy constraint ${constraint}`,
          affected: [module],
        });
      }
    }

    return {
      compatible: issues.length === 0,
      issues,
      suggestions: issues.length > 0 ? ["Use compatible version"] : [],
    };
  }

  /**
   * Check if version satisfies constraint
   */
  private satisfiesConstraint(version: string, constraint: string): boolean {
    try {
      const parts = version.split(".").map(Number);
      const constraintParts = constraint.split(".").map(Number);

      for (let i = 0; i < Math.max(parts.length, constraintParts.length); i++) {
        const p = parts[i] || 0;
        const c = constraintParts[i] || 0;
        if (p < c) return false;
        if (p > c) return true;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get API spec for module
   */
  getAPISpec(module: string): APISpec | undefined {
    return this.apiSpecs.get(module);
  }

  /**
   * Get all API specs
   */
  getAllAPISpecs(): Map<string, APISpec> {
    return new Map(this.apiSpecs);
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.apiSpecs.clear();
    this.versionConstraints.clear();
  }
}

/**
 * API specification
 */
interface APISpec {
  methods: APIMethod[];
  dependencies?: Record<string, string>;
  events?: string[];
}

/**
 * API method
 */
interface APIMethod {
  name: string;
  signature: string;
  returnType: string;
  deprecated?: boolean;
}

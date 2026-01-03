/**
 * DependencyChecker - Check for vulnerable and outdated dependencies
 *
 * Integrates with npm audit to check for known vulnerabilities
 * in project dependencies.
 */

import { exec } from "child_process";
import { promisify } from "util";
import { access } from "fs/promises";
import { join } from "path";
import type { DependencyVulnerability } from "@lsi/protocol";
import { SecuritySeverity } from "@lsi/protocol";

const execAsync = promisify(exec);

/**
 * npm audit output structure
 */
interface NpmAuditVulnerability {
  name: string;
  severity: SecuritySeverity;
  vulnerableVersions: string[];
  severityVia: unknown[];
  via: Array<{
    source: number;
    name: string;
    dependency: string;
    title: string;
    url: string;
    severity: SecuritySeverity;
    cwe: string[];
  }>;
  effects: string[];
  range: string;
  nodes: string[];
  fixAvailable: {
    name: string;
    version: string;
    isSemVerMajor: boolean;
  } | false;
}

interface NpmAuditOutput {
  auditReportVersion: number;
  vulnerabilities: Record<string, NpmAuditVulnerability>;
  metadata: {
    vulnerabilities: {
      info: number;
      low: number;
      moderate: number;
      high: number;
      critical: number;
    };
    dependencies: number;
    devDependencies: number;
    optionalDependencies: number;
    totalDependencies: number;
  };
}

/**
 * Dependency checker options
 */
export interface DependencyCheckerOptions {
  /** Check only production dependencies */
  production?: boolean;
  /** Check only dev dependencies */
  dev?: boolean;
  /** Minimum severity to report */
  auditLevel?: "info" | "low" | "moderate" | "high" | "critical";
  /** Timeout for npm audit (ms) */
  timeout?: number;
}

/**
 * Default options
 */
const DEFAULT_OPTIONS: DependencyCheckerOptions = {
  production: false,
  dev: false,
  auditLevel: "low",
  timeout: 60000,
};

/**
 * DependencyChecker - Check for vulnerable dependencies
 */
export class DependencyChecker {
  private options: DependencyCheckerOptions;

  constructor(options: DependencyCheckerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Check for vulnerabilities in package.json
   */
  async checkVulnerabilities(packagePath: string = "."): Promise<DependencyVulnerability[]> {
    // Check if package-lock.json exists
    const lockPath = join(packagePath, "package-lock.json");
    try {
      await access(lockPath);
    } catch {
      throw new Error("package-lock.json not found. Run `npm install` first.");
    }

    // Run npm audit
    return this.runNpmAudit(packagePath);
  }

  /**
   * Check for outdated packages
   */
  async checkOutdated(packagePath: string = "."): Promise<DependencyVulnerability[]> {
    // This would use `npm outdated` in a full implementation
    // For now, return empty array
    return [];
  }

  /**
   * Run npm audit and parse results
   */
  async runNpmAudit(
    packagePath: string = ".",
    options?: DependencyCheckerOptions
  ): Promise<DependencyVulnerability[]> {
    const opts = options || this.options;

    // Build npm audit command
    const args = ["audit", "--json"];

    if (opts.production) {
      args.push("--production");
    }

    if (opts.dev) {
      args.push("--dev");
    }

    if (opts.auditLevel) {
      args.push(`--audit-level=${opts.auditLevel}`);
    }

    const command = `npm ${args.join(" ")}`;

    try {
      const { stdout } = await execAsync(command, {
        cwd: packagePath,
        timeout: opts.timeout,
      });

      const auditOutput: NpmAuditOutput = JSON.parse(stdout);
      return this.parseAuditResults(auditOutput);
    } catch (error: unknown) {
      // npm audit returns non-zero exit code if vulnerabilities found
      // but still outputs JSON
      if (error && typeof error === "object" && "stdout" in error) {
        try {
          const auditOutput: NpmAuditOutput = JSON.parse(
            (error as { stdout: string }).stdout
          );
          return this.parseAuditResults(auditOutput);
        } catch {
          // Failed to parse output
          throw error;
        }
      }
      throw error;
    }
  }

  /**
   * Parse npm audit output into DependencyVulnerability[]
   */
  private parseAuditResults(auditOutput: NpmAuditOutput): DependencyVulnerability[] {
    const vulnerabilities: DependencyVulnerability[] = [];

    for (const [packageName, vulnData] of Object.entries(auditOutput.vulnerabilities)) {
      // Get the most severe via entry
      const primaryVia = Array.isArray(vulnData.via)
        ? vulnData.via.find((v) => typeof v === "object")
        : null;

      if (primaryVia && typeof primaryVia === "object") {
        const via = primaryVia as {
          title: string;
          url: string;
          severity: SecuritySeverity;
          cwe: string[];
        };

        vulnerabilities.push({
          packageName,
          currentVersion: vulnData.range, // Approximate
          vulnerableVersions: [vulnData.range],
          patchedVersions:
            vulnData.fixAvailable && typeof vulnData.fixAvailable === "object"
              ? [vulnData.fixAvailable.version]
              : [],
          severity: vulnData.severity,
          ids: via.cwe || [],
          description: via.title,
          references: via.url ? [via.url] : [],
        });
      }
    }

    return vulnerabilities;
  }

  /**
   * Get vulnerability summary
   */
  async getSummary(packagePath: string = "."): Promise<{
    total: number;
    bySeverity: Record<SecuritySeverity, number>;
    fixable: number;
  }> {
    const vulnerabilities = await this.checkVulnerabilities(packagePath);
    const bySeverity: Record<string, number> = {
      [SecuritySeverity.INFO]: 0,
      [SecuritySeverity.LOW]: 0,
      [SecuritySeverity.MEDIUM]: 0,
      [SecuritySeverity.HIGH]: 0,
      [SecuritySeverity.CRITICAL]: 0,
    };

    let fixable = 0;

    for (const vuln of vulnerabilities) {
      bySeverity[vuln.severity]++;
      if (vuln.patchedVersions.length > 0) {
        fixable++;
      }
    }

    return {
      total: vulnerabilities.length,
      bySeverity: bySeverity as Record<SecuritySeverity, number>,
      fixable,
    };
  }
}

/**
 * Create a default dependency checker
 */
export function createDependencyChecker(
  options?: DependencyCheckerOptions
): DependencyChecker {
  return new DependencyChecker(options);
}

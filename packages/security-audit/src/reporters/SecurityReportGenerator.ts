/**
 * SecurityReportGenerator - Generate security audit reports
 *
 * Supports multiple output formats:
 * - JSON: Machine-readable format
 * - SARIF: Static Analysis Results Interchange Format
 * - Markdown: Human-readable format
 * - HTML: Interactive web report
 * - JUnit: CI/CD integration
 */

import { writeFile } from "fs/promises";
import type {
  SecurityScanResult,
  SecurityReportOptions,
  SecuritySummary,
  VulnerabilityFinding,
} from "@lsi/protocol";
import { SecuritySeverity, SecurityReportFormat } from "@lsi/protocol";

/**
 * SARIF schema structure
 */
interface SARIFReport {
  version: string;
  $schema: string;
  runs: Array<{
    tool: {
      driver: {
        name: string;
        version: string;
        informationUri: string;
        rules: Array<{
          id: string;
          name: string;
          shortDescription: { text: string };
          fullDescription: { text: string };
          help: { text: string };
          defaultConfiguration: { level: string };
        }>;
      };
    };
    results: Array<{
      ruleId: string;
      level: string;
      message: { text: string };
      locations: Array<{
        physicalLocation: {
          artifactLocation: { uri: string };
          region: {
            startLine: number;
            startColumn: number;
            endLine?: number;
            endColumn?: number;
            snippet?: { text: string };
          };
        };
      }>;
    }>;
  }>;
}

/**
 * SecurityReportGenerator - Generate security reports
 */
export class SecurityReportGenerator {
  /**
   * Generate report from scan results
   */
  async generateReport(
    results: SecurityScanResult[],
    options: SecurityReportOptions
  ): Promise<string> {
    switch (options.format) {
      case SecurityReportFormat.JSON:
        return this.generateJSON(results, options);
      case SecurityReportFormat.SARIF:
        return JSON.stringify(await this.generateSARIF(results), null, 2);
      case SecurityReportFormat.MARKDOWN:
        return this.generateMarkdown(results, options);
      case SecurityReportFormat.HTML:
        return this.generateHTML(results, options);
      case SecurityReportFormat.JUNIT:
        return this.generateJUnit(results, options);
      default:
        throw new Error(`Unsupported report format: ${options.format}`);
    }
  }

  /**
   * Write report to file
   */
  async writeReport(
    results: SecurityScanResult[],
    outputPath: string,
    options: SecurityReportOptions
  ): Promise<void> {
    const content = await this.generateReport(results, options);
    await writeFile(outputPath, content, "utf-8");
  }

  /**
   * Generate JSON report
   */
  private generateJSON(
    results: SecurityScanResult[],
    options: SecurityReportOptions
  ): string {
    const filtered = this.filterByMinSeverity(results, options.minSeverity);
    return JSON.stringify(filtered, null, 2);
  }

  /**
   * Generate SARIF report
   */
  async generateSARIF(results: SecurityScanResult[]): Promise<SARIFReport> {
    // Collect all unique rules
    const rulesMap = new Map<string, any>();
    const allResults: any[] = [];

    for (const result of results) {
      for (const vuln of result.vulnerabilities) {
        // Add rule if not exists
        if (!rulesMap.has(vuln.id)) {
          rulesMap.set(vuln.id, {
            id: vuln.id,
            name: vuln.title,
            shortDescription: { text: vuln.description },
            fullDescription: { text: vuln.description },
            help: { text: vuln.remediation.description },
            defaultConfiguration: {
              level: this.severityToSARIFLevel(vuln.severity),
            },
          });
        }

        // Add result
        allResults.push({
          ruleId: vuln.id,
          level: this.severityToSARIFLevel(vuln.severity),
          message: { text: vuln.description },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: vuln.location.file },
                region: {
                  startLine: vuln.location.line,
                  startColumn: vuln.location.column,
                  snippet: vuln.location.snippet
                    ? { text: vuln.location.snippet }
                    : undefined,
                },
              },
            },
          ],
        });
      }
    }

    return {
      version: "2.1.0",
      $schema: "https://json.schemastore.org/sarif-2.1.0.json",
      runs: [
        {
          tool: {
            driver: {
              name: "Aequor Security Audit",
              version: "1.0.0",
              informationUri: "https://github.com/aequor-project",
              rules: Array.from(rulesMap.values()),
            },
          },
          results: allResults,
        },
      ],
    };
  }

  /**
   * Generate Markdown report
   */
  private generateMarkdown(
    results: SecurityScanResult[],
    options: SecurityReportOptions
  ): string {
    const lines: string[] = [];

    lines.push("# Security Audit Report");
    lines.push("");
    lines.push(`**Generated:** ${new Date().toISOString()}`);
    lines.push(`**Scans:** ${results.length}`);
    lines.push("");

    // Aggregate summary
    const summary = this.aggregateSummary(results);
    lines.push("## Summary");
    lines.push("");
    lines.push("| Metric | Count |");
    lines.push("|--------|-------|");
    lines.push(`| Total Vulnerabilities | ${summary.total} |`);
    lines.push(
      `| Critical | ${summary.bySeverity[SecuritySeverity.CRITICAL] || 0} |`
    );
    lines.push(`| High | ${summary.bySeverity[SecuritySeverity.HIGH] || 0} |`);
    lines.push(
      `| Medium | ${summary.bySeverity[SecuritySeverity.MEDIUM] || 0} |`
    );
    lines.push(`| Low | ${summary.bySeverity[SecuritySeverity.LOW] || 0} |`);
    lines.push(`| Info | ${summary.bySeverity[SecuritySeverity.INFO] || 0} |`);
    lines.push("");

    // Group by severity if requested
    if (options.groupBySeverity) {
      const bySeverity = this.groupBySeverity(results);
      for (const [severity, vulns] of Object.entries(bySeverity)) {
        if (vulns.length > 0) {
          lines.push(`## ${severity.charAt(0).toUpperCase() + severity.slice(1)}`);
          lines.push("");
          for (const vuln of vulns) {
            lines.push(this.vulnerabilityToMarkdown(vuln, options));
            lines.push("");
          }
        }
      }
    } else {
      // List all vulnerabilities
      lines.push("## Vulnerabilities");
      lines.push("");

      const allVulns = results.flatMap((r) => r.vulnerabilities);
      for (const vuln of allVulns) {
        lines.push(this.vulnerabilityToMarkdown(vuln, options));
        lines.push("");
      }
    }

    // Dependency vulnerabilities
    const depVulns = results.flatMap((r) => r.dependencyVulnerabilities);
    if (depVulns.length > 0) {
      lines.push("## Dependency Vulnerabilities");
      lines.push("");
      for (const dep of depVulns) {
        lines.push(`### ${dep.packageName}`);
        lines.push("");
        lines.push(`- **Severity:** ${dep.severity}`);
        lines.push(`- **Vulnerable Versions:** ${dep.vulnerableVersions.join(", ")}`);
        lines.push(`- **Fixed Versions:** ${dep.patchedVersions.join(", ") || "None"}`);
        lines.push(`- **Description:** ${dep.description}`);
        lines.push("");
      }
    }

    // Secrets
    const secrets = results.flatMap((r) => r.secrets);
    if (secrets.length > 0) {
      lines.push("## Secrets Found");
      lines.push("");
      for (const secret of secrets) {
        lines.push(`### ${secret.type}`);
        lines.push("");
        lines.push(`- **Location:** ${secret.location.file}:${secret.location.line}`);
        lines.push(`- **Value:** \`${secret.maskedValue}\``);
        lines.push(`- **Confidence:** ${secret.confidence}`);
        lines.push("");
      }
    }

    return lines.join("\n");
  }

  /**
   * Generate HTML report
   */
  private generateHTML(
    results: SecurityScanResult[],
    options: SecurityReportOptions
  ): string {
    const summary = this.aggregateSummary(results);
    const allVulns = results.flatMap((r) => r.vulnerabilities);

    const vulnCards = allVulns
      .map((vuln) => this.vulnerabilityToHTML(vuln, options))
      .join("\n");

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Audit Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #007bff; }
        .metric.critical { border-color: #dc3545; }
        .metric.high { border-color: #fd7e14; }
        .metric.medium { border-color: #ffc107; }
        .metric.low { border-color: #28a745; }
        .metric-label { font-size: 12px; color: #666; text-transform: uppercase; }
        .metric-value { font-size: 32px; font-weight: bold; color: #333; }
        .vulnerability { background: #f8f9fa; border-left: 4px solid #007bff; padding: 15px; margin: 10px 0; border-radius: 4px; }
        .vulnerability.critical { border-color: #dc3545; }
        .vulnerability.high { border-color: #fd7e14; }
        .vulnerability.medium { border-color: #ffc107; }
        .vulnerability.low { border-color: #28a745; }
        .vuln-title { font-weight: bold; font-size: 18px; margin-bottom: 5px; }
        .vuln-meta { font-size: 14px; color: #666; margin-bottom: 10px; }
        .vuln-desc { margin-bottom: 10px; }
        .remediation { background: #e7f3ff; padding: 10px; border-radius: 4px; font-size: 14px; }
        code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: 'Monaco', 'Menlo', monospace; }
        .badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; }
        .badge.critical { background: #dc3545; color: white; }
        .badge.high { background: #fd7e14; color: white; }
        .badge.medium { background: #ffc107; color: #333; }
        .badge.low { background: #28a745; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔒 Security Audit Report</h1>
        <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
        <p><strong>Scans:</strong> ${results.length}</p>

        <h2>Summary</h2>
        <div class="summary">
            <div class="metric">
                <div class="metric-label">Total</div>
                <div class="metric-value">${summary.total}</div>
            </div>
            <div class="metric critical">
                <div class="metric-label">Critical</div>
                <div class="metric-value">${summary.bySeverity[SecuritySeverity.CRITICAL] || 0}</div>
            </div>
            <div class="metric high">
                <div class="metric-label">High</div>
                <div class="metric-value">${summary.bySeverity[SecuritySeverity.HIGH] || 0}</div>
            </div>
            <div class="metric medium">
                <div class="metric-label">Medium</div>
                <div class="metric-value">${summary.bySeverity[SecuritySeverity.MEDIUM] || 0}</div>
            </div>
            <div class="metric low">
                <div class="metric-label">Low</div>
                <div class="metric-value">${summary.bySeverity[SecuritySeverity.LOW] || 0}</div>
            </div>
        </div>

        <h2>Vulnerabilities (${allVulns.length})</h2>
        ${vulnCards}
    </div>
</body>
</html>`;
  }

  /**
   * Generate JUnit XML report
   */
  private generateJUnit(
    results: SecurityScanResult[],
    options: SecurityReportOptions
  ): string {
    const allVulns = results.flatMap((r) => r.vulnerabilities);
    const failures = allVulns.filter(
      (v) =>
        v.severity === SecuritySeverity.CRITICAL ||
        v.severity === SecuritySeverity.HIGH
    );

    const testCases = allVulns
      .map(
        (vuln) => `    <testcase name="${this.escapeXML(vuln.title)}">
        <failure message="${this.escapeXML(vuln.description)}">
${this.escapeXML(`File: ${vuln.location.file}:${vuln.location.line}
Severity: ${vuln.severity}
${options.includeRemediation ? vuln.remediation.description : ""}`)}
        </failure>
    </testcase>`
      )
      .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Security Audit" tests="${allVulns.length}" failures="${failures.length}">
    <testsuite name="Vulnerabilities" tests="${allVulns.length}" failures="${failures.length}">
${testCases}
    </testsuite>
</testsuites>`;
  }

  /**
   * Generate summary metrics
   */
  generateSummary(results: SecurityScanResult[]): SecuritySummary {
    return this.aggregateSummary(results);
  }

  /**
   * Aggregate summary from multiple results
   */
  private aggregateSummary(results: SecurityScanResult[]): SecuritySummary {
    const summary: SecuritySummary = {
      total: 0,
      bySeverity: {
        [SecuritySeverity.CRITICAL]: 0,
        [SecuritySeverity.HIGH]: 0,
        [SecuritySeverity.MEDIUM]: 0,
        [SecuritySeverity.LOW]: 0,
        [SecuritySeverity.INFO]: 0,
      },
      byCategory: {},
      topFiles: [],
    };

    for (const result of results) {
      summary.total += result.summary.total;

      for (const [severity, count] of Object.entries(result.summary.bySeverity)) {
        summary.bySeverity[severity as SecuritySeverity] =
          (summary.bySeverity[severity as SecuritySeverity] || 0) + count;
      }

      for (const [category, count] of Object.entries(result.summary.byCategory)) {
        summary.byCategory[category] = (summary.byCategory[category] || 0) + count;
      }

      summary.topFiles.push(...result.summary.topFiles);
    }

    // Sort and limit top files
    summary.topFiles = summary.topFiles
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return summary;
  }

  /**
   * Group vulnerabilities by severity
   */
  private groupBySeverity(results: SecurityScanResult[]): Record<string, VulnerabilityFinding[]> {
    const grouped: Record<string, VulnerabilityFinding[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      info: [],
    };

    for (const result of results) {
      for (const vuln of result.vulnerabilities) {
        grouped[vuln.severity].push(vuln);
      }
    }

    return grouped;
  }

  /**
   * Convert vulnerability to markdown
   */
  private vulnerabilityToMarkdown(
    vuln: VulnerabilityFinding,
    options: SecurityReportOptions
  ): string {
    const lines: string[] = [];

    lines.push(`### ${vuln.title}`);
    lines.push("");
    lines.push(`**Severity:** ${vuln.severity} | **Confidence:** ${vuln.confidence}`);
    lines.push("");
    lines.push(`**Location:** \`${vuln.location.file}:${vuln.location.line}\``);

    if (options.includeSnippets && vuln.location.snippet) {
      lines.push("");
      lines.push("**Code:**");
      lines.push("```");
      lines.push(vuln.location.snippet);
      lines.push("```");
    }

    lines.push("");
    lines.push(vuln.description);

    if (options.includeRemediation) {
      lines.push("");
      lines.push("**Remediation:**");
      lines.push(vuln.remediation.description);

      if (vuln.remediation.codeExample) {
        lines.push("");
        lines.push("```");
        lines.push(vuln.remediation.codeExample);
        lines.push("```");
      }
    }

    return lines.join("\n");
  }

  /**
   * Convert vulnerability to HTML
   */
  private vulnerabilityToHTML(
    vuln: VulnerabilityFinding,
    options: SecurityReportOptions
  ): string {
    const remediationHTML =
      options.includeRemediation && vuln.remediation.description
        ? `<div class="remediation">
            <strong>💡 Remediation:</strong><br>
            ${this.escapeHTML(vuln.remediation.description)}
            ${vuln.remediation.codeExample ? `<pre><code>${this.escapeHTML(vuln.remediation.codeExample)}</code></pre>` : ""}
        </div>`
        : "";

    const snippetHTML =
      options.includeSnippets && vuln.location.snippet
        ? `<div style="margin-top: 10px;">
            <strong>Code:</strong>
            <code>${this.escapeHTML(vuln.location.snippet)}</code>
        </div>`
        : "";

    return `<div class="vulnerability ${vuln.severity}">
        <div class="vuln-title">
            <span class="badge ${vuln.severity}">${vuln.severity.toUpperCase()}</span>
            ${this.escapeHTML(vuln.title)}
        </div>
        <div class="vuln-meta">
            📁 ${this.escapeHTML(vuln.location.file)}:${vuln.location.line}
            | Confidence: ${vuln.confidence}
        </div>
        <div class="vuln-desc">
            ${this.escapeHTML(vuln.description)}
        </div>
        ${snippetHTML}
        ${remediationHTML}
    </div>`;
  }

  /**
   * Filter results by minimum severity
   */
  private filterByMinSeverity(
    results: SecurityScanResult[],
    minSeverity: SecuritySeverity
  ): SecurityScanResult[] {
    const severityOrder = {
      [SecuritySeverity.CRITICAL]: 5,
      [SecuritySeverity.HIGH]: 4,
      [SecuritySeverity.MEDIUM]: 3,
      [SecuritySeverity.LOW]: 2,
      [SecuritySeverity.INFO]: 1,
    };

    return results
      .map((result) => ({
        ...result,
        vulnerabilities: result.vulnerabilities.filter(
          (v) => severityOrder[v.severity] >= severityOrder[minSeverity]
        ),
      }))
      .filter((r) => r.vulnerabilities.length > 0);
  }

  /**
   * Map severity to SARIF level
   */
  private severityToSARIFLevel(severity: SecuritySeverity): string {
    const mapping: Record<SecuritySeverity, string> = {
      [SecuritySeverity.CRITICAL]: "error",
      [SecuritySeverity.HIGH]: "error",
      [SecuritySeverity.MEDIUM]: "warning",
      [SecuritySeverity.LOW]: "note",
      [SecuritySeverity.INFO]: "note",
    };
    return mapping[severity];
  }

  /**
   * Escape XML special characters
   */
  private escapeXML(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  /**
   * Escape HTML special characters
   */
  private escapeHTML(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

/**
 * Create a default security report generator
 */
export function createSecurityReportGenerator(): SecurityReportGenerator {
  return new SecurityReportGenerator();
}

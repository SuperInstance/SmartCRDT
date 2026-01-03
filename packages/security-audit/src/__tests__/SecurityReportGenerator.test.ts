/**
 * Tests for SecurityReportGenerator
 */

import { describe, it, expect } from "vitest";
import { SecurityReportGenerator } from "../reporters/SecurityReportGenerator";
import {
  SecurityScanResult,
  SecuritySeverity,
  SecurityReportFormat,
  DetectionConfidence,
  OWASPVulnerabilityCategory,
} from "@lsi/protocol";

describe("SecurityReportGenerator", () => {
  let generator: SecurityReportGenerator;

  beforeEach(() => {
    generator = new SecurityReportGenerator();
  });

  const mockResults: SecurityScanResult[] = [
    {
      scanId: "SCAN-001",
      timestamp: new Date("2024-01-01T00:00:00Z"),
      duration: 1000,
      filesScanned: 10,
      filesWithIssues: 5,
      vulnerabilities: [
        {
          id: "VULN-001" as any,
          category: OWASPVulnerabilityCategory.INJECTION,
          severity: SecuritySeverity.CRITICAL,
          confidence: DetectionConfidence.HIGH,
          title: "SQL Injection",
          description: "User input directly concatenated into SQL query",
          location: {
            file: "/src/db.js",
            line: 42,
            column: 10,
            function: "getUserById",
            snippet: "const query = 'SELECT * FROM users WHERE id = ' + userId",
          },
          cweId: "CWE-89",
          affectedComponents: ["db.js"],
          remediation: {
            summary: "Use parameterized queries",
            description: "Replace string concatenation with parameterized queries",
            codeExample: "db.query('SELECT * FROM users WHERE id = ?', [userId])",
            priority: "immediate",
          },
          references: ["https://owasp.org/www-project-top-ten/"],
          metadata: {},
        },
        {
          id: "VULN-002" as any,
          category: OWASPVulnerabilityCategory.INJECTION,
          severity: SecuritySeverity.HIGH,
          confidence: DetectionConfidence.CERTAIN,
          title: "XSS via innerHTML",
          description: "Untrusted data assigned to innerHTML",
          location: {
            file: "/src/ui.js",
            line: 15,
            column: 5,
            function: "render",
            snippet: "element.innerHTML = userInput",
          },
          cweId: "CWE-79",
          affectedComponents: ["ui.js"],
          remediation: {
            summary: "Use textContent or sanitize HTML",
            description: "Avoid innerHTML with untrusted data",
            priority: "high",
          },
          references: [],
          metadata: {},
        },
      ],
      dependencyVulnerabilities: [],
      secrets: [
        {
          type: "api_key" as any,
          confidence: DetectionConfidence.HIGH,
          location: {
            file: "/src/config.js",
            line: 5,
            column: 15,
            snippet: "const apiKey = 'sk-1234***5678'",
          },
          maskedValue: "sk-12****78",
          description: "API key detected",
        },
      ],
      configChecks: [],
      summary: {
        total: 2,
        bySeverity: {
          [SecuritySeverity.CRITICAL]: 1,
          [SecuritySeverity.HIGH]: 1,
          [SecuritySeverity.MEDIUM]: 0,
          [SecuritySeverity.LOW]: 0,
          [SecuritySeverity.INFO]: 0,
        },
        byCategory: {
          [OWASPVulnerabilityCategory.INJECTION]: 2,
        },
        topFiles: [
          { file: "/src/db.js", count: 1 },
          { file: "/src/ui.js", count: 1 },
        ],
      },
      success: true,
    },
  ];

  describe("JSON Report Generation", () => {
    it("should generate valid JSON report", async () => {
      const report = await generator.generateReport(mockResults, {
        format: SecurityReportFormat.JSON,
        includeSnippets: true,
        groupBySeverity: false,
        groupByCategory: false,
        includeRemediation: true,
        minSeverity: SecuritySeverity.LOW,
      });

      const parsed = JSON.parse(report);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0]).toHaveProperty("scanId");
      expect(parsed[0]).toHaveProperty("vulnerabilities");
    });

    it("should filter by minimum severity", async () => {
      const report = await generator.generateReport(mockResults, {
        format: SecurityReportFormat.JSON,
        includeSnippets: true,
        groupBySeverity: false,
        groupByCategory: false,
        includeRemediation: true,
        minSeverity: SecuritySeverity.CRITICAL,
      });

      const parsed = JSON.parse(report);
      expect(parsed[0].vulnerabilities).toHaveLength(1);
      expect(parsed[0].vulnerabilities[0].severity).toBe(SecuritySeverity.CRITICAL);
    });
  });

  describe("SARIF Report Generation", () => {
    it("should generate valid SARIF report", async () => {
      const sarif = await generator.generateSARIF(mockResults);

      expect(sarif).toHaveProperty("version");
      expect(sarif).toHaveProperty("$schema");
      expect(sarif).toHaveProperty("runs");
      expect(Array.isArray(sarif.runs)).toBe(true);
      expect(sarif.runs.length).toBeGreaterThan(0);
    });

    it("should include tool information", async () => {
      const sarif = await generator.generateSARIF(mockResults);

      expect(sarif.runs[0].tool.driver).toHaveProperty("name");
      expect(sarif.runs[0].tool.driver).toHaveProperty("version");
      expect(sarif.runs[0].tool.driver.name).toBe("Aequor Security Audit");
    });

    it("should include rules and results", async () => {
      const sarif = await generator.generateSARIF(mockResults);

      expect(sarif.runs[0].tool.driver.rules.length).toBeGreaterThan(0);
      expect(sarif.runs[0].results.length).toBeGreaterThan(0);
    });

    it("should map severity to SARIF level", async () => {
      const sarif = await generator.generateSARIF(mockResults);

      const criticalResult = sarif.runs[0].results.find(
        (r: any) => r.ruleId === "VULN-001"
      );
      expect(criticalResult?.level).toBe("error");

      const highResult = sarif.runs[0].results.find(
        (r: any) => r.ruleId === "VULN-002"
      );
      expect(highResult?.level).toBe("error");
    });
  });

  describe("Markdown Report Generation", () => {
    it("should generate markdown report", async () => {
      const report = await generator.generateReport(mockResults, {
        format: SecurityReportFormat.MARKDOWN,
        includeSnippets: true,
        groupBySeverity: false,
        groupByCategory: false,
        includeRemediation: true,
        minSeverity: SecuritySeverity.LOW,
      });

      expect(report).toContain("# Security Audit Report");
      expect(report).toContain("## Summary");
      expect(report).toContain("## Vulnerabilities");
    });

    it("should include summary table", async () => {
      const report = await generator.generateReport(mockResults, {
        format: SecurityReportFormat.MARKDOWN,
        includeSnippets: true,
        groupBySeverity: false,
        groupByCategory: false,
        includeRemediation: true,
        minSeverity: SecuritySeverity.LOW,
      });

      expect(report).toContain("| Metric | Count |");
      expect(report).toContain("| Total Vulnerabilities |");
      expect(report).toContain("| Critical |");
      expect(report).toContain("| High |");
    });

    it("should include code snippets when requested", async () => {
      const report = await generator.generateReport(mockResults, {
        format: SecurityReportFormat.MARKDOWN,
        includeSnippets: true,
        groupBySeverity: false,
        groupByCategory: false,
        includeRemediation: true,
        minSeverity: SecuritySeverity.LOW,
      });

      expect(report).toContain("```");
    });

    it("should include remediation when requested", async () => {
      const report = await generator.generateReport(mockResults, {
        format: SecurityReportFormat.MARKDOWN,
        includeSnippets: true,
        groupBySeverity: false,
        groupByCategory: false,
        includeRemediation: true,
        minSeverity: SecuritySeverity.LOW,
      });

      expect(report).toContain("**Remediation:**");
    });

    it("should group by severity when requested", async () => {
      const report = await generator.generateReport(mockResults, {
        format: SecurityReportFormat.MARKDOWN,
        includeSnippets: true,
        groupBySeverity: true,
        groupByCategory: false,
        includeRemediation: true,
        minSeverity: SecuritySeverity.LOW,
      });

      expect(report).toContain("## Critical");
      expect(report).toContain("## High");
    });
  });

  describe("HTML Report Generation", () => {
    it("should generate HTML report", async () => {
      const report = await generator.generateReport(mockResults, {
        format: SecurityReportFormat.HTML,
        includeSnippets: true,
        groupBySeverity: false,
        groupByCategory: false,
        includeRemediation: true,
        minSeverity: SecuritySeverity.LOW,
      });

      expect(report).toContain("<!DOCTYPE html>");
      expect(report).toContain("<title>Security Audit Report</title>");
      expect(report).toContain("Security Audit Report");
    });

    it("should include summary cards", async () => {
      const report = await generator.generateReport(mockResults, {
        format: SecurityReportFormat.HTML,
        includeSnippets: true,
        groupBySeverity: false,
        groupByCategory: false,
        includeRemediation: true,
        minSeverity: SecuritySeverity.LOW,
      });

      expect(report).toContain('class="metric"');
      expect(report).toContain('class="metric-value"');
    });

    it("should style vulnerabilities by severity", async () => {
      const report = await generator.generateReport(mockResults, {
        format: SecurityReportFormat.HTML,
        includeSnippets: true,
        groupBySeverity: false,
        groupByCategory: false,
        includeRemediation: true,
        minSeverity: SecuritySeverity.LOW,
      });

      expect(report).toContain('class="vulnerability critical"');
      expect(report).toContain('class="badge critical"');
    });
  });

  describe("JUnit Report Generation", () => {
    it("should generate JUnit XML", async () => {
      const report = await generator.generateReport(mockResults, {
        format: SecurityReportFormat.JUNIT,
        includeSnippets: false,
        groupBySeverity: false,
        groupByCategory: false,
        includeRemediation: true,
        minSeverity: SecuritySeverity.LOW,
      });

      expect(report).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(report).toContain("<testsuites");
      expect(report).toContain("<testsuite");
      expect(report).toContain("<testcase");
    });

    it("should mark critical/high as failures", async () => {
      const report = await generator.generateReport(mockResults, {
        format: SecurityReportFormat.JUNIT,
        includeSnippets: false,
        groupBySeverity: false,
        groupByCategory: false,
        includeRemediation: true,
        minSeverity: SecuritySeverity.LOW,
      });

      expect(report).toContain("<failure");
    });

    it("should escape XML special characters", async () => {
      const resultWithSpecialChars: SecurityScanResult = {
        ...mockResults[0],
        vulnerabilities: [
          {
            ...mockResults[0].vulnerabilities[0],
            title: "Vuln with <special> & chars",
            description: "Description with 'quotes' and \"double quotes\"",
          },
        ],
      };

      const report = await generator.generateReport([resultWithSpecialChars], {
        format: SecurityReportFormat.JUNIT,
        includeSnippets: false,
        groupBySeverity: false,
        groupByCategory: false,
        includeRemediation: true,
        minSeverity: SecuritySeverity.LOW,
      });

      expect(report).toContain("&lt;special&gt;");
      expect(report).toContain("&amp;");
    });
  });

  describe("Summary Generation", () => {
    it("should aggregate summary from multiple scans", () => {
      const summary = generator.generateSummary(mockResults);

      expect(summary.total).toBe(2);
      expect(summary.bySeverity[SecuritySeverity.CRITICAL]).toBe(1);
      expect(summary.bySeverity[SecuritySeverity.HIGH]).toBe(1);
    });

    it("should include top affected files", () => {
      const summary = generator.generateSummary(mockResults);

      expect(summary.topFiles.length).toBeGreaterThan(0);
      expect(summary.topFiles[0]).toHaveProperty("file");
      expect(summary.topFiles[0]).toHaveProperty("count");
    });

    it("should sort top files by count", () => {
      const summary = generator.generateSummary(mockResults);

      if (summary.topFiles.length > 1) {
        for (let i = 1; i < summary.topFiles.length; i++) {
          expect(
            summary.topFiles[i - 1].count
          ).toBeGreaterThanOrEqual(summary.topFiles[i].count);
        }
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle empty results", async () => {
      const report = await generator.generateReport([], {
        format: SecurityReportFormat.MARKDOWN,
        includeSnippets: true,
        groupBySeverity: false,
        groupByCategory: false,
        includeRemediation: true,
        minSeverity: SecuritySeverity.LOW,
      });

      expect(report).toContain("# Security Audit Report");
      expect(report).toContain("Total Vulnerabilities | 0 |");
    });

    it("should handle unknown format", async () => {
      await expect(
        generator.generateReport(mockResults, {
          format: "unknown" as SecurityReportFormat,
          includeSnippets: true,
          groupBySeverity: false,
          groupByCategory: false,
          includeRemediation: true,
          minSeverity: SecuritySeverity.LOW,
        })
      ).rejects.toThrow("Unsupported report format");
    });
  });
});

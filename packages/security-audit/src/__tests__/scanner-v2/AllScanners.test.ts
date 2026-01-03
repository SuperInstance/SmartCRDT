/**
 * Tests for scanner modules
 */

import { describe, it, expect } from "vitest";
import {
  DependencyScanner,
  createDependencyScanner,
  scanDependencies,
  VulnerabilitySeverity,
} from "../../scanner-v2/DependencyScanner.js";
import {
  CodeScanner,
  createCodeScanner,
  scanCode,
} from "../../scanner-v2/CodeScanner.js";

describe("DependencyScanner", () => {
  it("should create scanner", () => {
    const scanner = createDependencyScanner();
    expect(scanner).toBeInstanceOf(DependencyScanner);
  });

  it("should scan dependencies", () => {
    const scanner = createDependencyScanner();
    const packageJson = {
      dependencies: {
        lodash: "^4.17.15",
        axios: "^0.21.0",
      },
    };
    const result = scanner.scanDependencies(packageJson);
    expect(result).toHaveProperty("vulnerabilities");
    expect(result).toHaveProperty("summary");
  });

  it("should generate recommendations", () => {
    const scanner = createDependencyScanner();
    const result = {
      vulnerabilities: [],
      outdatedPackages: [],
      licenseIssues: [],
      summary: {
        totalVulnerabilities: 0,
        criticalCount: 0,
        highCount: 0,
        moderateCount: 0,
        lowCount: 0,
        outdatedCount: 0,
        licenseIssueCount: 0,
      },
    };
    const recommendations = scanner.generateRecommendations(result);
    expect(Array.isArray(recommendations)).toBe(true);
  });

  it("should generate SARIF", () => {
    const scanner = createDependencyScanner();
    const result = {
      vulnerabilities: [],
      outdatedPackages: [],
      licenseIssues: [],
      summary: {
        totalVulnerabilities: 0,
        criticalCount: 0,
        highCount: 0,
        moderateCount: 0,
        lowCount: 0,
        outdatedCount: 0,
        licenseIssueCount: 0,
      },
    };
    const sarif = scanner.generateSARIF(result);
    expect(sarif).toHaveProperty("version");
    expect(sarif).toHaveProperty("runs");
  });
});

describe("CodeScanner", () => {
  it("should create scanner", () => {
    const scanner = createCodeScanner();
    expect(scanner).toBeInstanceOf(CodeScanner);
  });

  it("should scan code for secrets", async () => {
    const scanner = createCodeScanner();
    const code = `
      const apiKey = "sk-1234567890abcdefghijklmnopqrstuvwxyz";
      const password = "SecretPassword123!";
    `;
    const findings = await scanner.scanFile("test.js", code);
    expect(findings.length).toBeGreaterThan(0);
  });

  it("should scan code for insecure functions", async () => {
    const scanner = createCodeScanner();
    const code = `
      eval(userInput);
      element.innerHTML = userInput;
    `;
    const findings = await scanner.scanFile("test.js", code);
    expect(findings.length).toBeGreaterThan(0);
  });

  it("should generate summary", () => {
    const scanner = createCodeScanner();
    const findings: any = [
      {
        type: "AWS Access Key",
        severity: "CRITICAL",
        location: { file: "test.js" },
      },
      {
        type: "eval",
        severity: "HIGH",
        location: { file: "test.js" },
      },
    ];
    const summary = scanner.generateSummary(findings);
    expect(summary.total).toBe(2);
    expect(summary.byType["AWS Access Key"]).toBe(1);
  });

  it("should generate remediation", () => {
    const scanner = createCodeScanner();
    const findings: any = [
      { severity: "CRITICAL", type: "test" },
      { severity: "HIGH", type: "test2" },
    ];
    const remediation = scanner.generateRemediation(findings);
    expect(remediation.critical).toHaveLength(1);
    expect(remediation.high).toHaveLength(1);
  });
});

describe("scanCode helper", () => {
  it("should scan code file", async () => {
    const findings = await scanCode("test.js", "const apiKey = 'sk-test';");
    expect(Array.isArray(findings)).toBe(true);
  });
});

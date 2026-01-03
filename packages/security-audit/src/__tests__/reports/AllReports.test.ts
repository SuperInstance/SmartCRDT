/**
 * Tests for report generators
 */

import { describe, it, expect } from "vitest";
import {
  PentestReport,
  createPentestReport,
  generatePentestReport,
  ReportFormat,
} from "../../reports/PentestReport.js";
import {
  HardeningChecklistGenerator,
  createHardeningChecklist,
  generateChecklistMarkdown,
  ChecklistStatus,
} from "../../reports/HardeningChecklist.js";

describe("PentestReport", () => {
  const mockFinding: any = {
    id: "TEST-001",
    title: "Test Finding",
    description: "Test vulnerability",
    severity: "HIGH",
    confidence: "CERTAIN",
    location: "https://example.com",
    impact: "High impact",
    remediation: "Fix immediately",
    references: ["https://example.com/ref"],
  };

  const mockSummary: any = {
    testName: "SQL Injection Test",
    testsRun: 10,
    vulnerabilitiesFound: 2,
    criticalCount: 0,
    highCount: 2,
    mediumCount: 0,
    lowCount: 0,
  };

  it("should create report", () => {
    const data: any = {
      scanId: "test-123",
      timestamp: "2024-01-01T00:00:00Z",
      target: "https://example.com",
      scope: ["/api/*"],
      summary: [mockSummary],
      findings: [mockFinding],
      overallRisk: "HIGH",
    };
    const report = createPentestReport(data);
    expect(report).toBeInstanceOf(PentestReport);
  });

  it("should generate JSON report", () => {
    const data: any = {
      scanId: "test-123",
      timestamp: "2024-01-01T00:00:00Z",
      target: "https://example.com",
      scope: ["/api/*"],
      summary: [mockSummary],
      findings: [mockFinding],
      overallRisk: "HIGH",
    };
    const report = createPentestReport(data);
    const json = report.generate(ReportFormat.JSON);
    expect(typeof json).toBe("string");
    const parsed = JSON.parse(json);
    expect(parsed.scanId).toBe("test-123");
  });

  it("should generate SARIF report", () => {
    const data: any = {
      scanId: "test-123",
      timestamp: "2024-01-01T00:00:00Z",
      target: "https://example.com",
      scope: ["/api/*"],
      summary: [mockSummary],
      findings: [mockFinding],
      overallRisk: "HIGH",
    };
    const report = createPentestReport(data);
    const sarif = report.generate(ReportFormat.SARIF);
    const parsed = JSON.parse(sarif);
    expect(parsed.version).toBe("2.1.0");
  });

  it("should generate Markdown report", () => {
    const data: any = {
      scanId: "test-123",
      timestamp: "2024-01-01T00:00:00Z",
      target: "https://example.com",
      scope: ["/api/*"],
      summary: [mockSummary],
      findings: [mockFinding],
      overallRisk: "HIGH",
    };
    const report = createPentestReport(data);
    const md = report.generate(ReportFormat.MARKDOWN);
    expect(md).toContain("# Penetration Test Report");
  });

  it("should generate HTML report", () => {
    const data: any = {
      scanId: "test-123",
      timestamp: "2024-01-01T00:00:00Z",
      target: "https://example.com",
      scope: ["/api/*"],
      summary: [mockSummary],
      findings: [mockFinding],
      overallRisk: "HIGH",
    };
    const report = createPentestReport(data);
    const html = report.generate(ReportFormat.HTML);
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("should generate CSV report", () => {
    const data: any = {
      scanId: "test-123",
      timestamp: "2024-01-01T00:00:00Z",
      target: "https://example.com",
      scope: ["/api/*"],
      summary: [mockSummary],
      findings: [mockFinding],
      overallRisk: "HIGH",
    };
    const report = createPentestReport(data);
    const csv = report.generate(ReportFormat.CSV);
    expect(csv).toContain("ID,Title");
  });

  it("should calculate CVSS score", () => {
    expect(PentestReport.calculateCVSSScore("CRITICAL")).toBe(9.0);
    expect(PentestReport.calculateCVSSScore("HIGH")).toBe(7.5);
    expect(PentestReport.calculateCVSSScore("MEDIUM")).toBe(5.0);
    expect(PentestReport.calculateCVSSScore("LOW")).toBe(2.5);
  });

  it("should generate CVSS vector", () => {
    const vector = PentestReport.generateCVSSVector("CRITICAL");
    expect(vector).toContain("CVSS:3.1");
  });

  it("should determine overall risk", () => {
    expect(
      PentestReport.determineOverallRisk([
        { severity: "MEDIUM" } as any,
        { severity: "LOW" } as any,
      ])
    ).toBe("MEDIUM");

    expect(
      PentestReport.determineOverallRisk([{ severity: "CRITICAL" } as any])
    ).toBe("CRITICAL");
  });
});

describe("generatePentestReport helper", () => {
  it("should generate report from data", () => {
    const report = generatePentestReport(
      "https://example.com",
      ["/api/*"],
      [],
      [],
      ReportFormat.JSON
    );
    expect(typeof report).toBe("string");
    const parsed = JSON.parse(report);
    expect(parsed.target).toBe("https://example.com");
  });
});

describe("HardeningChecklistGenerator", () => {
  it("should generate checklist", () => {
    const generator = new HardeningChecklistGenerator();
    const checklist = generator.generateChecklist();
    expect(checklist).toHaveProperty("categories");
    expect(checklist).toHaveProperty("overallCompletion");
    expect(checklist).toHaveProperty("criticalItems");
  });

  it("should add custom items", () => {
    const generator = new HardeningChecklistGenerator();
    const customItem = {
      id: "custom-001",
      category: "Custom Category",
      title: "Custom Item",
      description: "Custom description",
      severity: "HIGH" as const,
      status: ChecklistStatus.PENDING,
      references: [],
    };
    const checklist = generator.generateChecklist([customItem]);
    const customCategory = checklist.categories.find((c) => c.name === "Custom Category");
    expect(customCategory?.items).toHaveLength(1);
  });

  it("should generate markdown", () => {
    const generator = new HardeningChecklistGenerator();
    const checklist = generator.generateChecklist();
    const md = generator.generateMarkdown(checklist);
    expect(md).toContain("# Security Hardening Checklist");
    expect(md).toContain("## Summary");
  });
});

describe("createHardeningChecklist helper", () => {
  it("should create checklist", () => {
    const checklist = createHardeningChecklist();
    expect(checklist).toHaveProperty("categories");
    expect(checklist.categories.length).toBeGreaterThan(0);
  });
});

describe("generateChecklistMarkdown helper", () => {
  it("should generate markdown checklist", () => {
    const md = generateChecklistMarkdown();
    expect(typeof md).toBe("string");
    expect(md).toContain("# Security Hardening Checklist");
  });
});

/**
 * Tests for ComplianceReporter
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import { ComplianceReporter } from "./ComplianceReporter.js";
import { PrivacyAuditEvent, PIIType, PrivacyLevel } from "@lsi/protocol";

describe("ComplianceReporter", () => {
  let reporter: ComplianceReporter;
  let testEvents: PrivacyAuditEvent[];
  const testOutputDir = "./test-exports";

  beforeEach(() => {
    reporter = new ComplianceReporter();

    const now = Date.now();

    testEvents = [
      {
        timestamp: now,
        eventType: "query_allowed",
        queryHash: "abc123",
        queryLength: 50,
        classification: {
          level: PrivacyLevel.PUBLIC,
          confidence: 0.9,
          piiTypes: [],
          reason: "Test event",
        },
        piiDetected: [],
        decision: {
          action: "allow",
          matchedRules: [],
          confidence: 0.9,
        },
        destination: "local",
        sessionId: "session1",
        metadata: {},
      },
      {
        timestamp: now + 1000,
        eventType: "query_redacted",
        queryHash: "def456",
        queryLength: 75,
        classification: {
          level: PrivacyLevel.SENSITIVE,
          confidence: 0.85,
          piiTypes: [PIIType.EMAIL, PIIType.PHONE],
          reason: "Test event with PII",
        },
        piiDetected: [PIIType.EMAIL, PIIType.PHONE],
        decision: {
          action: "redact",
          matchedRules: ["rule1"],
          confidence: 0.85,
        },
        destination: "cloud",
        sessionId: "session2",
        metadata: {},
      },
      {
        timestamp: now + 2000,
        eventType: "query_blocked",
        queryHash: "ghi789",
        queryLength: 100,
        classification: {
          level: PrivacyLevel.SOVEREIGN,
          confidence: 0.95,
          piiTypes: [PIIType.SSN, PIIType.CREDIT_CARD],
          reason: "Test event with PII",
        },
        piiDetected: [PIIType.SSN, PIIType.CREDIT_CARD],
        decision: {
          action: "deny",
          matchedRules: ["rule1", "rule2"],
          confidence: 0.95,
        },
        destination: "local",
        sessionId: "session3",
        metadata: {},
      },
      {
        timestamp: now + 3000,
        eventType: "query_allowed",
        queryHash: "jkl012",
        queryLength: 60,
        classification: {
          level: PrivacyLevel.SENSITIVE,
          confidence: 0.7,
          piiTypes: [PIIType.MEDICAL_RECORD, PIIType.HEALTH_ID],
          reason: "Test event with PII",
        },
        piiDetected: [PIIType.MEDICAL_RECORD, PIIType.HEALTH_ID],
        decision: {
          action: "allow",
          matchedRules: [],
          confidence: 0.7,
        },
        destination: "cloud",
        sessionId: "session4",
        metadata: {},
      },
    ];
  });

  afterEach(async () => {
    // Clean up test output directory
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }
  });

  describe("Report Generation", () => {
    it("should generate a basic compliance report", async () => {
      const period = {
        start: Date.now() - 10000,
        end: Date.now() + 10000,
      };

      const report = await reporter.generateReport(testEvents, period);

      expect(report).toHaveProperty("reportId");
      expect(report).toHaveProperty("generatedAt");
      expect(report).toHaveProperty("period");
      expect(report).toHaveProperty("summary");
      expect(report).toHaveProperty("regulations");
      expect(report).toHaveProperty("incidents");
      expect(report).toHaveProperty("recommendations");

      expect(report.period).toEqual(period);
      expect(report.reportId).toMatch(/^RPT-/);
    });

    it("should generate summary statistics", async () => {
      const period = {
        start: Date.now() - 10000,
        end: Date.now() + 10000,
      };

      const report = await reporter.generateReport(testEvents, period);

      expect(report.summary.totalQueries).toBe(4);
      expect(report.summary.blockedQueries).toBe(1);
      expect(report.summary.redactedQueries).toBe(1);
      expect(report.summary.allowedQueries).toBe(2);
      expect(report.summary.piiIncidents).toBe(3); // Events with PII

      expect(report.summary.piiTypes).toBeInstanceOf(Array);
      expect(report.summary.piiTypes.length).toBeGreaterThan(0);

      expect(report.summary.avgConfidence).toBeGreaterThan(0);
      expect(report.summary.avgConfidence).toBeLessThanOrEqual(1);
    });

    it("should filter events by time period", async () => {
      const period = {
        start: Date.now(),
        end: Date.now() + 1500,
      };

      const report = await reporter.generateReport(testEvents, period);

      // Should only include first 2 events
      expect(report.summary.totalQueries).toBe(2);
    });
  });

  describe("GDPR Compliance", () => {
    it("should check GDPR compliance", async () => {
      const period = {
        start: Date.now() - 10000,
        end: Date.now() + 10000,
      };

      const report = await reporter.generateReport(testEvents, period, {
        regulations: ["GDPR"],
      });

      const gdpr = report.regulations.find(r => r.regulation === "GDPR");
      expect(gdpr).toBeDefined();
      expect(gdpr?.regulation).toBe("GDPR");
      expect(gdpr?.score).toBeGreaterThanOrEqual(0);
      expect(gdpr?.score).toBeLessThanOrEqual(100);
      expect(gdpr?.violations).toBeInstanceOf(Array);
      expect(gdpr?.gaps).toBeInstanceOf(Array);
    });

    it("should detect GDPR violations for PII in cloud", async () => {
      const cloudPIIEvents: PrivacyAuditEvent[] = [
        {
          timestamp: Date.now(),
          eventType: "query_allowed",
          queryHash: "test1",
          queryLength: 100,
          classification: { level: PrivacyLevel.SENSITIVE, confidence: 0.9, piiTypes: [], reason: "Test event" },
          piiDetected: [PIIType.EMAIL, PIIType.PHONE, PIIType.SSN],
          decision: { action: "allow", matchedRules: [], confidence: 0.9 },
          destination: "cloud",
          sessionId: "session1",
          metadata: {},
        },
      ];

      const period = { start: Date.now() - 10000, end: Date.now() + 10000 };
      const report = await reporter.generateReport(cloudPIIEvents, period, {
        regulations: ["GDPR"],
      });

      const gdpr = report.regulations.find(r => r.regulation === "GDPR");
      expect(gdpr?.violations.length).toBeGreaterThan(0);

      const criticalViolation = gdpr?.violations.find(
        v => v.severity === "critical"
      );
      expect(criticalViolation).toBeDefined();
      expect(criticalViolation?.description).toContain("cloud");
    });

    it("should include GDPR gaps", async () => {
      const period = {
        start: Date.now() - 10000,
        end: Date.now() + 10000,
      };

      const report = await reporter.generateReport(testEvents, period, {
        regulations: ["GDPR"],
      });

      const gdpr = report.regulations.find(r => r.regulation === "GDPR");
      expect(gdpr?.gaps.length).toBeGreaterThan(0);

      // Should have data portability gap
      const portabilityGap = gdpr?.gaps.find(
        g => g.control === "Data portability"
      );
      expect(portabilityGap).toBeDefined();
      expect(portabilityGap?.status).toBe("missing");
    });
  });

  describe("HIPAA Compliance", () => {
    it("should check HIPAA compliance", async () => {
      const period = {
        start: Date.now() - 10000,
        end: Date.now() + 10000,
      };

      const report = await reporter.generateReport(testEvents, period, {
        regulations: ["HIPAA"],
      });

      const hipaa = report.regulations.find(r => r.regulation === "HIPAA");
      expect(hipaa).toBeDefined();
      expect(hipaa?.regulation).toBe("HIPAA");
      expect(hipaa?.score).toBeGreaterThanOrEqual(0);
      expect(hipaa?.score).toBeLessThanOrEqual(100);
    });

    it("should detect HIPAA violations for PHI", async () => {
      const phiEvents: PrivacyAuditEvent[] = [
        {
          timestamp: Date.now(),
          eventType: "query_allowed",
          queryHash: "test1",
          queryLength: 100,
          classification: { level: PrivacyLevel.SOVEREIGN, confidence: 0.9, piiTypes: [], reason: "Test event" },
          piiDetected: [PIIType.MEDICAL_RECORD, PIIType.HEALTH_ID],
          decision: { action: "allow", matchedRules: [], confidence: 0.9 },
          destination: "cloud",
          sessionId: "session1",
          metadata: {},
        },
      ];

      const period = { start: Date.now() - 10000, end: Date.now() + 10000 };
      const report = await reporter.generateReport(phiEvents, period, {
        regulations: ["HIPAA"],
      });

      const hipaa = report.regulations.find(r => r.regulation === "HIPAA");
      expect(hipaa?.violations.length).toBeGreaterThan(0);

      const phiViolation = hipaa?.violations.find(v =>
        v.description.includes("PHI")
      );
      expect(phiViolation).toBeDefined();
      expect(phiViolation?.severity).toBe("critical");
    });
  });

  describe("CCPA Compliance", () => {
    it("should check CCPA compliance", async () => {
      const period = {
        start: Date.now() - 10000,
        end: Date.now() + 10000,
      };

      const report = await reporter.generateReport(testEvents, period, {
        regulations: ["CCPA"],
      });

      const ccpa = report.regulations.find(r => r.regulation === "CCPA");
      expect(ccpa).toBeDefined();
      expect(ccpa?.regulation).toBe("CCPA");
      expect(ccpa?.score).toBeGreaterThanOrEqual(0);
      expect(ccpa?.score).toBeLessThanOrEqual(100);
    });

    it("should detect CCPA gaps", async () => {
      const period = {
        start: Date.now() - 10000,
        end: Date.now() + 10000,
      };

      const report = await reporter.generateReport(testEvents, period, {
        regulations: ["CCPA"],
      });

      const ccpa = report.regulations.find(r => r.regulation === "CCPA");

      // Should have Do Not Sell gap
      const dnsGap = ccpa?.gaps.find(g => g.control === "Do Not Sell");
      expect(dnsGap).toBeDefined();
      expect(dnsGap?.status).toBe("missing");
    });
  });

  describe("SOX Compliance", () => {
    it("should check SOX compliance", async () => {
      const period = {
        start: Date.now() - 10000,
        end: Date.now() + 10000,
      };

      const report = await reporter.generateReport(testEvents, period, {
        regulations: ["SOX"],
      });

      const sox = report.regulations.find(r => r.regulation === "SOX");
      expect(sox).toBeDefined();
      expect(sox?.regulation).toBe("SOX");
      expect(sox?.score).toBeGreaterThanOrEqual(0);
      expect(sox?.score).toBeLessThanOrEqual(100);
    });

    it("should detect SOX gaps", async () => {
      const period = {
        start: Date.now() - 10000,
        end: Date.now() + 10000,
      };

      const report = await reporter.generateReport(testEvents, period, {
        regulations: ["SOX"],
      });

      const sox = report.regulations.find(r => r.regulation === "SOX");
      expect(sox?.gaps.length).toBeGreaterThan(0);

      // Should have change management gap
      const changeMgmtGap = sox?.gaps.find(
        g => g.control === "Change management"
      );
      expect(changeMgmtGap).toBeDefined();
      expect(changeMgmtGap?.status).toBe("missing");
    });
  });

  describe("Incident Detection", () => {
    it("should detect data leak incidents", async () => {
      const leakEvents: PrivacyAuditEvent[] = [
        {
          timestamp: Date.now(),
          eventType: "query_allowed",
          queryHash: "test1",
          queryLength: 100,
          classification: { level: PrivacyLevel.SENSITIVE, confidence: 0.9, piiTypes: [], reason: "Test event" },
          piiDetected: [PIIType.EMAIL, PIIType.PHONE],
          decision: { action: "allow", matchedRules: [], confidence: 0.9 },
          destination: "cloud",
          sessionId: "session1",
          metadata: {},
        },
      ];

      const period = { start: Date.now() - 10000, end: Date.now() + 10000 };
      const report = await reporter.generateReport(leakEvents, period);

      const dataLeak = report.incidents.find(i => i.type === "data_leak");
      expect(dataLeak).toBeDefined();
      expect(dataLeak?.severity).toBe("high");
      expect(dataLeak?.description).toContain("cloud");
    });

    it("should detect unauthorized access incidents", async () => {
      const period = { start: Date.now() - 10000, end: Date.now() + 10000 };
      const report = await reporter.generateReport(testEvents, period);

      const unauthorized = report.incidents.find(
        i => i.type === "unauthorized_access"
      );
      expect(unauthorized).toBeDefined();
      expect(unauthorized?.severity).toBe("medium");
    });

    it("should detect PII exposure incidents", async () => {
      const highPIIEvents: PrivacyAuditEvent[] = [
        {
          timestamp: Date.now(),
          eventType: "query_allowed",
          queryHash: "test1",
          queryLength: 100,
          classification: { level: PrivacyLevel.SOVEREIGN, confidence: 0.9, piiTypes: [], reason: "Test event" },
          piiDetected: [PIIType.EMAIL, PIIType.PHONE, PIIType.SSN, PIIType.CREDIT_CARD],
          decision: { action: "allow", matchedRules: [], confidence: 0.9 },
          destination: "local",
          sessionId: "session1",
          metadata: {},
        },
      ];

      const period = { start: Date.now() - 10000, end: Date.now() + 10000 };
      const report = await reporter.generateReport(highPIIEvents, period);

      const piiExposure = report.incidents.find(i => i.type === "pii_exposure");
      expect(piiExposure).toBeDefined();
      expect(piiExposure?.severity).toBe("high");
    });

    it("should skip incident detection when disabled", async () => {
      const period = { start: Date.now() - 10000, end: Date.now() + 10000 };
      const report = await reporter.generateReport(testEvents, period, {
        includeIncidents: false,
      });

      expect(report.incidents).toHaveLength(0);
    });
  });

  describe("Recommendations", () => {
    it("should generate recommendations", async () => {
      const period = { start: Date.now() - 10000, end: Date.now() + 10000 };
      const report = await reporter.generateReport(testEvents, period);

      expect(report.recommendations.length).toBeGreaterThan(0);

      const rec = report.recommendations[0];
      expect(rec).toHaveProperty("priority");
      expect(rec).toHaveProperty("category");
      expect(rec).toHaveProperty("recommendation");
      expect(rec).toHaveProperty("effort");
      expect(rec).toHaveProperty("impact");
    });

    it("should generate high-priority recommendations for non-compliance", async () => {
      const period = { start: Date.now() - 10000, end: Date.now() + 10000 };
      const report = await reporter.generateReport(testEvents, period, {
        regulations: ["GDPR", "HIPAA"],
      });

      const highPriorityRecs = report.recommendations.filter(
        r => r.priority === "high" || r.priority === "critical"
      );
      expect(highPriorityRecs.length).toBeGreaterThan(0);
    });

    it("should skip recommendations when disabled", async () => {
      const period = { start: Date.now() - 10000, end: Date.now() + 10000 };
      const report = await reporter.generateReport(testEvents, period, {
        includeRecommendations: false,
      });

      expect(report.recommendations).toHaveLength(0);
    });
  });

  describe("Report Export", () => {
    it("should export report to JSON file", async () => {
      const period = { start: Date.now() - 10000, end: Date.now() + 10000 };
      const report = await reporter.generateReport(testEvents, period);

      const filepath = `${testOutputDir}/report.json`;
      const result = await reporter.exportReport(report, filepath, "json");

      expect(result).toBe(filepath);

      // Verify file exists and contains valid JSON
      const content = await fs.readFile(filepath, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.reportId).toBe(report.reportId);
      expect(parsed.summary).toBeDefined();
    });

    it("should export report to HTML file", async () => {
      const period = { start: Date.now() - 10000, end: Date.now() + 10000 };
      const report = await reporter.generateReport(testEvents, period);

      const filepath = `${testOutputDir}/report.html`;
      const result = await reporter.exportReport(report, filepath, "html");

      expect(result).toBe(filepath);

      // Verify file exists and contains HTML
      const content = await fs.readFile(filepath, "utf-8");

      expect(content).toContain("<!DOCTYPE html>");
      expect(content).toContain("<title>Compliance Report");
      expect(content).toContain(report.reportId);
      expect(content).toContain("Summary");
      expect(content).toContain("Regulatory Compliance");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty events array", async () => {
      const period = { start: Date.now() - 10000, end: Date.now() + 10000 };
      const report = await reporter.generateReport([], period);

      expect(report.summary.totalQueries).toBe(0);
      expect(report.summary.blockedQueries).toBe(0);
      expect(report.summary.allowedQueries).toBe(0);
    });

    it("should handle events outside time period", async () => {
      const oldEvents: PrivacyAuditEvent[] = [
        {
          timestamp: Date.now() - 1000000, // Very old
          eventType: "query_allowed",
          queryHash: "old1",
          queryLength: 50,
          classification: { level: PrivacyLevel.PUBLIC, confidence: 0.9, piiTypes: [], reason: "Test event" },
          piiDetected: [],
          decision: { action: "allow", matchedRules: [], confidence: 0.9 },
          destination: "local",
          sessionId: "old_session",
          metadata: {},
        },
      ];

      const period = { start: Date.now() - 10000, end: Date.now() + 10000 };
      const report = await reporter.generateReport(oldEvents, period);

      expect(report.summary.totalQueries).toBe(0);
    });

    it("should generate unique report IDs", async () => {
      const period = { start: Date.now() - 10000, end: Date.now() + 10000 };

      const report1 = await reporter.generateReport(testEvents, period);
      const report2 = await reporter.generateReport(testEvents, period);

      expect(report1.reportId).not.toBe(report2.reportId);
    });
  });

  describe("Compliance Scoring", () => {
    it("should calculate GDPR compliance score correctly", async () => {
      const cleanEvents: PrivacyAuditEvent[] = [
        {
          timestamp: Date.now(),
          eventType: "query_allowed",
          queryHash: "clean1",
          queryLength: 50,
          classification: { level: PrivacyLevel.PUBLIC, confidence: 0.9, piiTypes: [], reason: "Test event" },
          piiDetected: [],
          decision: { action: "allow", matchedRules: [], confidence: 0.9 },
          destination: "local",
          sessionId: "session1",
          metadata: {},
        },
      ];

      const period = { start: Date.now() - 10000, end: Date.now() + 10000 };
      const report = await reporter.generateReport(cleanEvents, period, {
        regulations: ["GDPR"],
      });

      const gdpr = report.regulations.find(r => r.regulation === "GDPR");
      expect(gdpr?.score).toBeGreaterThan(50); // Should have decent score
    });

    it("should have higher score for compliant events", async () => {
      const compliantEvents: PrivacyAuditEvent[] = Array(10)
        .fill(null)
        .map((_, i) => ({
          timestamp: Date.now() + i * 100,
          eventType: "query_allowed",
          queryHash: `hash${i}`,
          queryLength: 50,
          classification: { level: PrivacyLevel.PUBLIC, confidence: 0.9, piiTypes: [], reason: "Test event" },
          piiDetected: [],
          decision: {
            action: "allow",
            matchedRules: [],
            confidence: 0.9,
          },
          destination: "local",
          sessionId: "session1",
          metadata: {},
        }));

      const period = { start: Date.now() - 10000, end: Date.now() + 10000 };
      const report = await reporter.generateReport(compliantEvents, period, {
        regulations: ["GDPR"],
      });

      const gdpr = report.regulations.find(r => r.regulation === "GDPR");
      expect(gdpr?.compliant).toBe(true);
      expect(gdpr?.score).toBeGreaterThan(70);
    });
  });
});

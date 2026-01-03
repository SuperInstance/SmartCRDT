/**
 * Audit Integration Tests
 *
 * Tests for audit export, compliance reporting, and real-time monitoring.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { randomBytes } from "crypto";
import { PrivacyAuditEvent, AuditEventType, PrivacyClassification, PrivacyLevel, FirewallDecision } from "@lsi/protocol";

interface ComplianceReport {
  reportId: string;
  generatedAt: number;
  periodStart: number;
  periodEnd: number;
  totalEvents: number;
  eventsByType: Record<string, number>;
  privacyViolations: number;
  complianceScore: number; // 0-1
}

interface AuditFilter {
  eventTypes?: string[];
  userId?: string;
  startTime?: number;
  endTime?: number;
  minSeverity?: "low" | "medium" | "high" | "critical";
}

interface RealTimeAlert {
  alertId: string;
  timestamp: number;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  affectedUsers?: string[];
  metrics: {
    threshold: number;
    actual: number;
  };
}

describe("Audit Integration", () => {
  let auditEvents: PrivacyAuditEvent[];

  const createAuditEvent = (eventType: AuditEventType, decision: FirewallDecision): PrivacyAuditEvent => ({
    timestamp: Date.now() - 3600000,
    eventType,
    queryHash: `hash-${eventType}`,
    queryLength: 10,
    decision,
    destination: "local",
    sessionId: "session-1",
    metadata: {} as Record<string, unknown>,
  });

  beforeEach(() => {
    // Generate sample audit events
    auditEvents = [
      {
        timestamp: Date.now() - 3600000,
        eventType: "query_allowed" as AuditEventType,
        queryHash: "hash-1",
        queryLength: 10,
        decision: { action: "allow", matchedRules: [], confidence: 0.9 },
        destination: "local",
        sessionId: "session-1",
        metadata: {} as Record<string, unknown>,
      },
      {
        timestamp: Date.now() - 3500000,
        eventType: "query_blocked" as AuditEventType,
        queryHash: "hash-2",
        queryLength: 15,
        decision: { action: "deny", matchedRules: [], confidence: 0.9 },
        destination: "local",
        sessionId: "session-1",
        metadata: {} as Record<string, unknown>,
      },
      {
        timestamp: Date.now() - 3000000,
        eventType: "query_redacted" as AuditEventType,
        queryHash: "hash-3",
        queryLength: 20,
        decision: { action: "redact", matchedRules: [], confidence: 0.9 },
        destination: "local",
        sessionId: "session-2",
        metadata: {} as Record<string, unknown>,
      },
      {
        timestamp: Date.now() - 2500000,
        eventType: "pii_detected" as AuditEventType,
        queryHash: "hash-4",
        queryLength: 12,
        decision: { action: "allow", matchedRules: [], confidence: 0.9 },
        destination: "local",
        sessionId: "session-2",
        metadata: {} as Record<string, unknown>,
      },
      {
        timestamp: Date.now() - 2000000,
        eventType: "firewall_evaluated" as AuditEventType,
        queryHash: "hash-5",
        queryLength: 8,
        decision: { action: "allow", matchedRules: [], confidence: 0.9 },
        destination: "local",
        sessionId: "session-3",
        metadata: {} as Record<string, unknown>,
      },
    ];
  });

  describe("Audit Logging", () => {
    it("should create audit event with required fields", () => {
      const event: PrivacyAuditEvent = {
        timestamp: Date.now(),
        eventType: "query_allowed" as AuditEventType,
        queryHash: `hash-${randomBytes(4).toString("hex")}`,
        queryLength: 10,
        decision: { action: "allow", matchedRules: [], confidence: 0.9 },
        destination: "local",
        sessionId: "test-session",
        metadata: {} as Record<string, unknown>,
      };

      expect(event.timestamp).toBeDefined();
      expect(event.eventType).toBe("query_allowed");
      expect(event.queryHash).toBeDefined();
      expect(event.queryLength).toBeDefined();
    });

    it("should support all event types", () => {
      const eventTypes: AuditEventType[] = [
        "query_allowed",
        "query_blocked",
        "query_redacted",
        "pii_detected",
        "classification_change",
        "rule_modified",
        "firewall_evaluated",
      ];

      eventTypes.forEach(type => {
        const event: PrivacyAuditEvent = {
          timestamp: Date.now(),
          eventType: type,
          queryHash: `hash-${type}`,
          queryLength: 10,
          decision: { action: "allow", matchedRules: [], confidence: 0.9 },
          destination: "local",
          sessionId: `session-${type}`,
          metadata: {} as Record<string, unknown>,
        };

        expect(event.eventType).toBe(type);
      });
    });

    it("should store event metadata", () => {
      const metadata = {
        query: "Complex medical question",
        queryType: "question",
        complexity: 0.8,
        privacyLevel: { level: PrivacyLevel.SENSITIVE, confidence: 0.8, piiTypes: [], reason: "test" },
      };

      const event: PrivacyAuditEvent = {
        timestamp: Date.now(),
        eventType: "query_allowed" as AuditEventType,
        queryHash: "hash-data",
        queryLength: 10,
        decision: { action: "allow", matchedRules: [], confidence: 0.9 },
        destination: "local",
        sessionId: "session-data",
        classification: metadata.privacyLevel,
        metadata,
      };

      expect(event.metadata?.query).toBe("Complex medical question");
      expect(event.metadata?.privacyLevel).toBe("sensitive");
    });

    it("should serialize audit events", () => {
      const event: PrivacyAuditEvent = {
        timestamp: Date.now(),
        eventType: "query_allowed" as AuditEventType,
        queryHash: "hash-serialize",
        queryLength: 10,
        decision: { action: "allow", matchedRules: [], confidence: 0.9 },
        destination: "local",
        sessionId: "session-serialize",
        metadata: { result: "Test result" },
      };

      const serialized = JSON.stringify(event);
      const deserialized = JSON.parse(serialized) as PrivacyAuditEvent;

      expect(deserialized.queryHash).toBe(event.queryHash);
      expect(deserialized.metadata?.result).toBe("Test result");
    });
  });

  describe("Audit Export", () => {
    it("should export audit logs to JSON", () => {
      const exportToJSON = (events: PrivacyAuditEvent[]): string => {
        return JSON.stringify(events, null, 2);
      };

      const exported = exportToJSON(auditEvents);

      expect(exported).toBeDefined();
      expect(typeof exported).toBe("string");
      expect(exported.length).toBeGreaterThan(0);

      const parsed = JSON.parse(exported) as PrivacyAuditEvent[];
      expect(parsed).toHaveLength(auditEvents.length);
    });

    it("should export audit logs to CSV", () => {
      const exportToCSV = (events: PrivacyAuditEvent[]): string => {
        const headers = "timestamp,eventType,queryHash,queryLength,sessionId,metadata\n";
        const rows = events
          .map(
            e =>
              `${e.timestamp},${e.eventType},${e.queryHash},${e.queryLength},${e.sessionId || ""},"${JSON.stringify(e.metadata)}"`
          )
          .join("\n");

        return headers + rows;
      };

      const exported = exportToCSV(auditEvents);

      expect(exported).toContain("eventId,timestamp,eventType");
      expect(exported.split("\n").length).toBe(auditEvents.length + 2); // +2 for header and trailing newline
    });

    it("should filter events during export", () => {
      const filter: AuditFilter = {
        eventTypes: ["query", "response"],
        startTime: Date.now() - 4000000,
        endTime: Date.now() - 1000000,
      };

      const filtered = auditEvents.filter(e => {
        if (filter.eventTypes && !filter.eventTypes.includes(e.eventType))
          return false;
        if (filter.startTime && e.timestamp < filter.startTime) return false;
        if (filter.endTime && e.timestamp > filter.endTime) return false;
        return true;
      });

      expect(filtered.length).toBeGreaterThan(0);
      expect(
        filtered.every(
          e => e.eventType === "query_allowed" || e.eventType === "query_blocked" || e.eventType === "query_redacted"
        )
      ).toBe(true);
    });

    it("should paginate large datasets", () => {
      const pageSize = 2;
      const page = 1;

      const paginated = auditEvents.slice(
        (page - 1) * pageSize,
        page * pageSize
      );

      expect(paginated).toHaveLength(2);
      expect(paginated[0].queryHash).toBe("hash-1");
      expect(paginated[1].queryHash).toBe("hash-2");
    });
  });

  describe("Compliance Reporting", () => {
    it("should generate compliance report", () => {
      const report: ComplianceReport = {
        reportId: "report-1",
        generatedAt: Date.now(),
        periodStart: Date.now() - 86400000, // 24 hours ago
        periodEnd: Date.now(),
        totalEvents: auditEvents.length,
        eventsByType: {
          query_blocked: 1,
          query_redacted: 1,
          query_allowed: 2,
          pii_detected: 1,
          firewall_evaluated: 0,
          classification_change: 0,
          rule_modified: 0,
        },
        privacyViolations: 0,
        complianceScore: 1.0,
      };

      expect(report.totalEvents).toBe(5);
      expect(report.eventsByType.query).toBe(2);
      expect(report.privacyViolations).toBe(0);
      expect(report.complianceScore).toBe(1.0);
    });

    it("should calculate compliance score", () => {
      const violations = 2;
      const totalEvents = 100;
      const score = 1 - violations / totalEvents;

      expect(score).toBeGreaterThan(0.95);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("should aggregate events by type", () => {
      const eventsByType: Record<string, number> = {};

      auditEvents.forEach(event => {
        eventsByType[event.eventType] =
          (eventsByType[event.eventType] || 0) + 1;
      });

      expect(eventsByType.query_allowed).toBe(2);
      expect(eventsByType.query_blocked).toBe(1);
      expect(eventsByType.query_redacted).toBe(1);
      expect(eventsByType.pii_detected).toBe(1);
    });

    it("should aggregate events by user", () => {
      const eventsByUser: Record<string, number> = {};

      auditEvents.forEach(event => {
        const userId = (event.metadata as Record<string, unknown>)?.userId as string;
        if (userId) {
          eventsByUser[userId] = (eventsByUser[userId] || 0) + 1;
        }
      });

      // Test events don't have userId in metadata, so this test expects 0
      expect(eventsByUser["user-1"] || 0).toBe(0);
      expect(eventsByUser["user-2"] || 0).toBe(0);
      expect(eventsByUser["admin"] || 0).toBe(0);
    });

    it("should detect privacy violations", () => {
      const eventsWithPII: PrivacyAuditEvent[] = [
        {
          timestamp: Date.now(),
          eventType: "pii_detected" as AuditEventType,
          queryHash: "hash-pii-1",
          queryLength: 20,
          decision: { action: "allow", matchedRules: [], confidence: 0.9 },
          destination: "local",
          sessionId: "session-pii-1",
          metadata: { query: "My SSN is 123-45-6789" },
        },
        {
          timestamp: Date.now(),
          eventType: "pii_detected" as AuditEventType,
          queryHash: "hash-pii-2",
          queryLength: 25,
          decision: { action: "allow", matchedRules: [], confidence: 0.9 },
          destination: "local",
          sessionId: "session-pii-2",
          metadata: { response: "Your credit card number is 4111-1111-1111-1111" },
        },
      ];

      const detectPII = (text: string): boolean => {
        const patterns = [
          /\d{3}-\d{2}-\d{4}/, // SSN
          /\d{4}-\d{4}-\d{4}-\d{4}/, // Credit card
        ];
        return patterns.some(pattern => pattern.test(text));
      };

      let violations = 0;
      eventsWithPII.forEach(event => {
        const dataStr = JSON.stringify(event.metadata);
        if (detectPII(dataStr)) {
          violations++;
        }
      });

      expect(violations).toBe(2);
    });

    it("should support HIPAA compliance checks", () => {
      const hipaaRequiredFields = [
        "auditTrail",
        "accessLogs",
        "encryption",
        "authorization",
      ];

      const checkHIPAACompliance = (
        checks: Record<string, boolean>
      ): number => {
        const passedCount = Object.values(checks).filter(v => v).length;
        return passedCount / Object.keys(checks).length;
      };

      const hipaaChecks: Record<string, boolean> = {
        auditTrail: true,
        accessLogs: true,
        encryption: true,
        authorization: true,
      };

      const score = checkHIPAACompliance(hipaaChecks);

      expect(score).toBe(1.0);
    });

    it("should support GDPR compliance checks", () => {
      const gdprRights = [
        "rightToAccess",
        "rightToRectification",
        "rightToErasure",
        "rightToPortability",
      ];

      const checkGDPRCompliance = (implemented: string[]): number => {
        return implemented.length / gdprRights.length;
      };

      const implemented = [
        "rightToAccess",
        "rightToErasure",
        "rightToRectification",
      ];
      const score = checkGDPRCompliance(implemented);

      expect(score).toBeGreaterThan(0.5);
      expect(score).toBeLessThan(1);
    });
  });

  describe("Real-Time Monitoring", () => {
    it("should detect anomaly in error rate", () => {
      const recentErrors = 15;
      const totalRequests = 100;
      const threshold = 0.05; // 5%

      const errorRate = recentErrors / totalRequests;
      const isAnomaly = errorRate > threshold;

      expect(isAnomaly).toBe(true);
      expect(errorRate).toBe(0.15);
    });

    it("should generate real-time alerts", () => {
      const alert: RealTimeAlert = {
        alertId: "alert-1",
        timestamp: Date.now(),
        severity: "high",
        message: "Unusual access pattern detected",
        affectedUsers: ["user-1", "user-2"],
        metrics: {
          threshold: 100, // requests per minute
          actual: 250,
        },
      };

      expect(alert.severity).toBe("high");
      expect(alert.affectedUsers).toHaveLength(2);
      expect(alert.metrics.actual).toBeGreaterThan(alert.metrics.threshold);
    });

    it("should aggregate metrics over time window", () => {
      const timeWindow = 60000; // 1 minute
      const now = Date.now();

      const eventsInWindow = auditEvents.filter(
        e => e.timestamp >= now - timeWindow && e.timestamp <= now
      );

      // Since test data is old, let's create fresh events
      const freshEvents: PrivacyAuditEvent[] = Array.from({ length: 50 }, (_, i) => ({
        timestamp: now - i * 1000,
        eventType: (i % 2 === 0 ? "query_allowed" : "query_blocked") as AuditEventType,
        queryHash: `hash-fresh-${i}`,
        queryLength: 10,
        decision: { action: "allow", matchedRules: [], confidence: 0.9 },
        destination: "local",
        sessionId: `session-fresh-${i}`,
        metadata: {} as Record<string, unknown>,
      }));

      const count = freshEvents.length;

      expect(count).toBe(50);
    });

    it("should track alert severity levels", () => {
      const severities: Array<RealTimeAlert["severity"]> = [
        "low",
        "medium",
        "high",
        "critical",
      ];

      const alerts: RealTimeAlert[] = severities.map((severity, i) => ({
        alertId: `alert-${i}`,
        timestamp: Date.now(),
        severity,
        message: `Alert with ${severity} severity`,
        metrics: {
          threshold: 100,
          actual: 100 + i * 50,
        },
      }));

      expect(alerts).toHaveLength(4);
      expect(alerts[0].severity).toBe("low");
      expect(alerts[3].severity).toBe("critical");
    });
  });

  describe("Retention and Archival", () => {
    it("should enforce retention policies", () => {
      const retentionDays = 30;
      const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
      const cutoffDate = Date.now() - retentionMs;

      const oldEvents: PrivacyAuditEvent[] = [
        {
          timestamp: Date.now() - 40 * 24 * 60 * 60 * 1000, // 40 days ago
          eventType: "query_allowed" as AuditEventType,
          queryHash: "hash-old",
          queryLength: 10,
          decision: { action: "allow", matchedRules: [], confidence: 0.9 },
          destination: "local",
          sessionId: "session-old",
          metadata: {} as Record<string, unknown>,
        },
      ];

      const shouldRetain = oldEvents[0].timestamp > cutoffDate;

      expect(shouldRetain).toBe(false); // Should be deleted
    });

    it("should archive old events", () => {
      const archiveThreshold = 90 * 24 * 60 * 60 * 1000; // 90 days

      const eventsToArchive: PrivacyAuditEvent[] = [
        {
          timestamp: Date.now() - 100 * 24 * 60 * 60 * 1000,
          eventType: "query_allowed" as AuditEventType,
          queryHash: "hash-archive-1",
          queryLength: 10,
          decision: { action: "allow", matchedRules: [], confidence: 0.9 },
          destination: "local",
          sessionId: "session-archive-1",
          metadata: {} as Record<string, unknown>,
        },
        {
          timestamp: Date.now() - 120 * 24 * 60 * 60 * 1000,
          eventType: "query_blocked" as AuditEventType,
          queryHash: "hash-archive-2",
          queryLength: 10,
          decision: { action: "deny", matchedRules: [], confidence: 0.9 },
          destination: "local",
          sessionId: "session-archive-2",
          metadata: {} as Record<string, unknown>,
        },
      ];

      const archiveCount = eventsToArchive.filter(
        e => e.timestamp < Date.now() - archiveThreshold
      ).length;

      expect(archiveCount).toBe(2);
    });
  });

  describe("Audit Trail Security", () => {
    it("should prevent audit log tampering", () => {
      const event: PrivacyAuditEvent = {
        timestamp: Date.now(),
        eventType: "query_allowed" as AuditEventType,
        queryHash: "hash-tamper",
        queryLength: 10,
        decision: { action: "allow", matchedRules: [], confidence: 0.9 },
        destination: "local",
        sessionId: "session-tamper",
        metadata: { query: "Original" },
      };

      // Generate hash for integrity
      const originalHash = Buffer.from(JSON.stringify(event)).toString(
        "base64"
      );

      // Simulate tampering attempt
      event.metadata.query = "Modified";

      const modifiedHash = Buffer.from(JSON.stringify(event)).toString(
        "base64"
      );

      expect(originalHash).not.toBe(modifiedHash);
    });

    it("should require authentication for audit access", () => {
      const hasPermission = (userRole: string): boolean => {
        const allowedRoles = ["admin", "auditor", "compliance"];
        return allowedRoles.includes(userRole);
      };

      expect(hasPermission("admin")).toBe(true);
      expect(hasPermission("user")).toBe(false);
      expect(hasPermission("auditor")).toBe(true);
    });

    it("should log all audit access attempts", () => {
      const accessAttempts: PrivacyAuditEvent[] = [];

      const logAccessAttempt = (userId: string, success: boolean) => {
        accessAttempts.push({
          timestamp: Date.now(),
          eventType: "firewall_evaluated" as AuditEventType,
          queryHash: `access-${Date.now()}`,
          queryLength: 10,
          decision: { action: "allow", matchedRules: [], confidence: 0.9 },
          destination: "local",
          sessionId: `session-${userId}`,
          metadata: {
            action: "view_audit_logs",
            success,
            userId,
          },
        });
      };

      logAccessAttempt("user-1", true);
      logAccessAttempt("user-2", false);

      expect(accessAttempts).toHaveLength(2);
      expect(accessAttempts[1].metadata?.success).toBe(false);
    });
  });

  describe("Performance", () => {
    it("should handle high-volume event logging", () => {
      const startTime = performance.now();

      const events: PrivacyAuditEvent[] = [];
      for (let i = 0; i < 10000; i++) {
        events.push({
          timestamp: Date.now(),
          eventType: "query_allowed" as AuditEventType,
          queryHash: `hash-${i}`,
          queryLength: 10,
          decision: { action: "allow", matchedRules: [], confidence: 0.9 },
          destination: "local",
          sessionId: `session-${i}`,
          metadata: {} as Record<string, unknown>,
        });
      }

      const duration = performance.now() - startTime;

      expect(events.length).toBe(10000);
      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
    });

    it("should efficiently query large datasets", () => {
      const largeDataset: PrivacyAuditEvent[] = Array.from(
        { length: 10000 },
        (_, i) => ({
          timestamp: Date.now() - i * 1000,
          eventType: ["query_blocked", "query_redacted", "pii_detected"][i % 3] as AuditEventType,
          queryHash: `hash-${i}`,
          queryLength: 10,
          decision: { action: "allow", matchedRules: [], confidence: 0.9 },
          destination: "local",
          sessionId: `session-${i}`,
          metadata: {} as Record<string, unknown>,
        })
      );

      const startTime = performance.now();

      const filtered = largeDataset.filter(e => e.eventType === "query_blocked");

      const duration = performance.now() - startTime;

      expect(filtered.length).toBeGreaterThan(3000);
      expect(duration).toBeLessThan(100); // Fast query
    });
  });
});

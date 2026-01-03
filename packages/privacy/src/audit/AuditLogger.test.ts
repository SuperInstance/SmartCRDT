/**
 * Tests for AuditLogger
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { AuditLogger, type PrivacyAuditEvent } from "./AuditLogger.js";
import { PrivacyLevel, PIIType } from "@lsi/protocol";
import { RedactionStrategy } from "../redaction/SemanticPIIRedactor.js";
import type { FirewallDecision } from "../firewall/PrivacyFirewall.js";

describe("AuditLogger", () => {
  let logger: AuditLogger;

  beforeEach(() => {
    logger = new AuditLogger();
  });

  const createMockDecision = (
    action: "allow" | "deny" | "redact" | "redirect" = "allow"
  ): FirewallDecision => ({
    action,
    confidence: 0.9,
    matchedRules: ["rule1"],
    finalDestination: "local",
  });

  const createMockClassification = (
    level: PrivacyLevel = PrivacyLevel.PUBLIC
  ) => ({
    level,
    confidence: 0.9,
    piiTypes: [],
    reason: "Test classification",
  });

  describe("Event Logging", () => {
    it("should log an event", () => {
      const event = {
        eventType: "query_allowed" as const,
        query: "test query",
        decision: createMockDecision(),
        destination: "cloud" as const,
        sessionId: "session-1",
        metadata: {} as Record<string, unknown>,
      };

      logger.logEvent(event);

      expect(logger.getEventCount()).toBe(1);
    });

    it("should hash query text by default", () => {
      const event = {
        eventType: "query_allowed" as const,
        query: "my secret query",
        decision: createMockDecision(),
        destination: "cloud" as const,
        sessionId: "session-1",
        metadata: {} as Record<string, unknown>,
      };

      logger.logEvent(event);

      const events = logger.queryEvents();
      expect(events[0].queryHash).not.toBe("my secret query");
      expect(events[0].queryHash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
      expect(events[0].queryLength).toBe("my secret query".length);
    });

    it("should store query when hashing is disabled", () => {
      const loggerNoHash = new AuditLogger({ enableHashing: false });

      const event = {
        eventType: "query_allowed" as const,
        query: "test query",
        decision: createMockDecision(),
        destination: "cloud" as const,
        sessionId: "session-1",
        metadata: {} as Record<string, unknown>,
      };

      loggerNoHash.logEvent(event);

      const events = loggerNoHash.queryEvents();
      expect(events[0].queryHash).toBe("test query");
    });

    it("should add timestamp to events", () => {
      const beforeTime = Date.now();

      logger.logEvent({
        eventType: "query_allowed",
        query: "test",
        decision: createMockDecision(),
        destination: "cloud",
        sessionId: "session-1",
        metadata: {} as Record<string, unknown>,
      });

      const afterTime = Date.now();

      const events = logger.queryEvents();
      expect(events[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(events[0].timestamp).toBeLessThanOrEqual(afterTime);
    });

    it("should log events with classification", () => {
      logger.logEvent({
        eventType: "query_blocked",
        query: "test",
        classification: createMockClassification(PrivacyLevel.SOVEREIGN),
        piiDetected: [PIIType.SSN],
        decision: createMockDecision("deny"),
        destination: "cloud",
        sessionId: "session-1",
        metadata: {} as Record<string, unknown>,
      });

      const events = logger.queryEvents();
      expect(events[0].classification?.level).toBe(PrivacyLevel.SOVEREIGN);
      expect(events[0].piiDetected).toEqual([PIIType.SSN]);
    });

    it("should rotate events when max is reached", () => {
      const smallLogger = new AuditLogger({
        maxEvents: 5,
        enableRotation: true,
      });

      // Add 7 events
      for (let i = 0; i < 7; i++) {
        smallLogger.logEvent({
          eventType: "query_allowed",
          query: `query-${i}`,
          decision: createMockDecision(),
          destination: "cloud",
          sessionId: "session-1",
          metadata: { index: i },
        });
      }

      // Should only have 5 events (max)
      expect(smallLogger.getEventCount()).toBe(5);

      // Oldest events should be removed (query-0 and query-1)
      const events = smallLogger.queryEvents();
      const indices = events.map(e => (e.metadata as { index: number }).index);
      expect(indices).toEqual([2, 3, 4, 5, 6]);
    });

    it("should track total events logged even with rotation", () => {
      const smallLogger = new AuditLogger({
        maxEvents: 3,
        enableRotation: true,
      });

      for (let i = 0; i < 5; i++) {
        smallLogger.logEvent({
          eventType: "query_allowed",
          query: `query-${i}`,
          decision: createMockDecision(),
          destination: "cloud",
          sessionId: "session-1",
          metadata: {} as Record<string, unknown>,
        });
      }

      expect(smallLogger.getEventCount()).toBe(3); // Current events
      expect(smallLogger.getTotalEventsLogged()).toBe(5); // Total logged
    });

    it("should not rotate when disabled", () => {
      const loggerNoRotate = new AuditLogger({
        maxEvents: 5,
        enableRotation: false,
      });

      for (let i = 0; i < 10; i++) {
        loggerNoRotate.logEvent({
          eventType: "query_allowed",
          query: `query-${i}`,
          decision: createMockDecision(),
          destination: "cloud",
          sessionId: "session-1",
          metadata: {} as Record<string, unknown>,
        });
      }

      expect(loggerNoRotate.getEventCount()).toBe(10);
    });
  });

  describe("Event Querying", () => {
    beforeEach(() => {
      // Log sample events
      logger.logEvent({
        eventType: "query_allowed",
        query: "public query",
        classification: createMockClassification(PrivacyLevel.PUBLIC),
        decision: createMockDecision("allow"),
        destination: "cloud",
        sessionId: "session-1",
        metadata: {} as Record<string, unknown>,
      });

      logger.logEvent({
        eventType: "query_blocked",
        query: "secret query",
        classification: createMockClassification(PrivacyLevel.SOVEREIGN),
        piiDetected: [PIIType.SSN],
        decision: createMockDecision("deny"),
        destination: "cloud",
        sessionId: "session-1",
        metadata: {} as Record<string, unknown>,
      });

      logger.logEvent({
        eventType: "query_redacted",
        query: "sensitive query",
        classification: createMockClassification(PrivacyLevel.SENSITIVE),
        piiDetected: [PIIType.EMAIL],
        decision: {
          action: "redact",
          confidence: 0.9,
          matchedRules: ["rule2"],
        },
        destination: "cloud",
        sessionId: "session-2",
        metadata: {} as Record<string, unknown>,
      });

      logger.logEvent({
        eventType: "query_allowed",
        query: "local query",
        decision: createMockDecision("allow"),
        destination: "local",
        sessionId: "session-1",
        metadata: {} as Record<string, unknown>,
      });
    });

    it("should return all events without filter", () => {
      const events = logger.queryEvents();
      expect(events.length).toBe(4);
    });

    it("should filter by event type", () => {
      const blockedEvents = logger.queryEvents({
        eventType: ["query_blocked"],
      });
      expect(blockedEvents.length).toBe(1);
      expect(blockedEvents[0].eventType).toBe("query_blocked");
    });

    it("should filter by multiple event types", () => {
      const events = logger.queryEvents({
        eventType: ["query_blocked", "query_redacted"],
      });
      expect(events.length).toBe(2);
    });

    it("should filter by classification", () => {
      const events = logger.queryEvents({
        classification: [PrivacyLevel.PUBLIC],
      });
      expect(events.length).toBe(1);
      expect(events[0].classification?.level).toBe(PrivacyLevel.PUBLIC);
    });

    it("should filter by destination", () => {
      const cloudEvents = logger.queryEvents({ destination: ["cloud"] });
      expect(cloudEvents.length).toBe(3);
      expect(cloudEvents.every(e => e.destination === "cloud")).toBe(true);
    });

    it("should filter by time range", () => {
      const now = Date.now();
      const events = logger.queryEvents({
        timeRange: { start: now - 10000, end: now + 10000 },
      });
      expect(events.length).toBe(4);
    });

    it("should filter by session ID", () => {
      const events = logger.queryEvents({ sessionId: "session-2" });
      expect(events.length).toBe(1);
      expect(events[0].sessionId).toBe("session-2");
    });

    it("should filter by minimum matched rules", () => {
      logger.logEvent({
        eventType: "query_allowed",
        query: "multi-rule query",
        decision: {
          action: "allow",
          confidence: 0.9,
          matchedRules: ["rule1", "rule2", "rule3"],
        },
        destination: "cloud",
        sessionId: "session-1",
        metadata: {} as Record<string, unknown>,
      });

      const events = logger.queryEvents({ minMatchedRules: 2 });
      expect(events.length).toBe(1);
      expect(events[0].decision.matchedRules.length).toBeGreaterThanOrEqual(2);
    });

    it("should filter by PII types", () => {
      const events = logger.queryEvents({ piiTypes: [PIIType.SSN] });
      expect(events.length).toBe(1);
      expect(events[0].piiDetected).toContain(PIIType.SSN);
    });

    it("should apply limit", () => {
      const events = logger.queryEvents({ limit: 2 });
      expect(events.length).toBe(2);
    });

    it("should apply offset", () => {
      const events = logger.queryEvents({ offset: 2 });
      expect(events.length).toBe(2);
    });

    it("should apply limit and offset together", () => {
      const events = logger.queryEvents({ offset: 1, limit: 2 });
      expect(events.length).toBe(2);
    });

    it("should combine multiple filters", () => {
      const events = logger.queryEvents({
        eventType: ["query_allowed"],
        destination: ["cloud"],
      });
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe("query_allowed");
      expect(events[0].destination).toBe("cloud");
    });
  });

  describe("Export", () => {
    beforeEach(() => {
      logger.logEvent({
        eventType: "query_allowed",
        query: "test query",
        classification: createMockClassification(),
        decision: createMockDecision(),
        destination: "cloud",
        sessionId: "session-1",
        metadata: { key: "value" },
      });
    });

    it("should export to JSON", () => {
      const json = logger.exportEventsJSON();
      expect(json).toBeDefined();
      expect(typeof json).toBe("string");

      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(1);
      expect(parsed[0].eventType).toBe("query_allowed");
    });

    it("should export filtered events to JSON", () => {
      logger.logEvent({
        eventType: "query_blocked",
        query: "another query",
        decision: createMockDecision("deny"),
        destination: "cloud",
        sessionId: "session-1",
        metadata: {} as Record<string, unknown>,
      });

      const json = logger.exportEventsJSON({ eventType: ["query_allowed"] });
      const parsed = JSON.parse(json);
      expect(parsed.length).toBe(1);
      expect(parsed[0].eventType).toBe("query_allowed");
    });

    it("should export to CSV", () => {
      const csv = logger.exportEventsCSV();
      expect(csv).toBeDefined();
      expect(typeof csv).toBe("string");

      const lines = csv.split("\n");
      expect(lines.length).toBeGreaterThan(0); // Has at least header

      // Check header
      const headers = lines[0].split(",");
      expect(headers).toContain("timestamp");
      expect(headers).toContain("eventType");
      expect(headers).toContain("queryHash");
    });

    it("should return empty string when exporting empty log to CSV", () => {
      const emptyLogger = new AuditLogger();
      const csv = emptyLogger.exportEventsCSV();
      expect(csv).toBe("");
    });

    it("should handle special characters in CSV", () => {
      logger.logEvent({
        eventType: "query_allowed",
        query: 'query with "quotes" and, commas',
        decision: createMockDecision(),
        destination: "cloud",
        sessionId: "session-1",
        metadata: {} as Record<string, unknown>,
      });

      const csv = logger.exportEventsCSV();
      expect(csv).toContain('"');
      expect(() => JSON.parse(csv)).toThrow(); // CSV is not JSON
    });
  });

  describe("Compliance Reporting", () => {
    beforeEach(() => {
      const now = Date.now();

      logger.logEvent({
        eventType: "query_allowed",
        query: "public query 1",
        classification: createMockClassification(PrivacyLevel.PUBLIC),
        decision: createMockDecision("allow"),
        destination: "cloud",
        sessionId: "session-1",
        metadata: {} as Record<string, unknown>,
      });

      logger.logEvent({
        eventType: "query_blocked",
        query: "secret query",
        classification: createMockClassification(PrivacyLevel.SOVEREIGN),
        piiDetected: [PIIType.SSN, PIIType.CREDIT_CARD],
        decision: createMockDecision("deny"),
        destination: "cloud",
        sessionId: "session-1",
        metadata: {} as Record<string, unknown>,
      });

      logger.logEvent({
        eventType: "query_redacted",
        query: "sensitive query",
        classification: createMockClassification(PrivacyLevel.SENSITIVE),
        piiDetected: [PIIType.EMAIL],
        decision: {
          action: "redact",
          confidence: 0.9,
          matchedRules: ["rule1"],
        },
        destination: "cloud",
        sessionId: "session-2",
        metadata: {} as Record<string, unknown>,
      });

      logger.logEvent({
        eventType: "query_allowed",
        query: "local query",
        decision: createMockDecision("allow"),
        destination: "local",
        sessionId: "session-3",
        metadata: {} as Record<string, unknown>,
      });

      logger.logEvent({
        eventType: "pii_detected",
        query: "another pii",
        classification: createMockClassification(),
        piiDetected: [PIIType.PHONE],
        decision: createMockDecision(),
        destination: "cloud",
        sessionId: "session-1",
        metadata: {} as Record<string, unknown>,
      });
    });

    it("should generate compliance report", () => {
      const now = Date.now();
      const report = logger.generateComplianceReport({
        start: now - 10000,
        end: now + 10000,
      });

      expect(report.generatedAt).toBeDefined();
      expect(report.timeRange).toBeDefined();
      expect(report.totalQueries).toBe(5);
      expect(report.blockedQueries).toBe(1);
      expect(report.redactedQueries).toBe(1);
      expect(report.allowedQueries).toBe(3);
    });

    it("should count PII incidents correctly", () => {
      const now = Date.now();
      const report = logger.generateComplianceReport({
        start: now - 10000,
        end: now + 10000,
      });

      expect(report.piiIncidents).toBe(3); // blocked + redacted + pii_detected
    });

    it("should report top PII types", () => {
      const now = Date.now();
      const report = logger.generateComplianceReport({
        start: now - 10000,
        end: now + 10000,
      });

      expect(report.topPIITypes.length).toBeGreaterThan(0);
      expect(report.topPIITypes[0].type).toBeDefined();
      expect(report.topPIITypes[0].count).toBeGreaterThan(0);
    });

    it("should report queries by destination", () => {
      const now = Date.now();
      const report = logger.generateComplianceReport({
        start: now - 10000,
        end: now + 10000,
      });

      expect(report.queriesByDestination.local).toBe(1);
      expect(report.queriesByDestination.cloud).toBe(4);
    });

    it("should report queries by classification", () => {
      const now = Date.now();
      const report = logger.generateComplianceReport({
        start: now - 10000,
        end: now + 10000,
      });

      expect(report.queriesByClassification[PrivacyLevel.PUBLIC]).toBe(1);
      expect(report.queriesByClassification[PrivacyLevel.SOVEREIGN]).toBe(1);
      expect(report.queriesByClassification[PrivacyLevel.SENSITIVE]).toBe(1);
    });

    it("should calculate average confidence", () => {
      const now = Date.now();
      const report = logger.generateComplianceReport({
        start: now - 10000,
        end: now + 10000,
      });

      expect(report.avgConfidence).toBeGreaterThan(0);
      expect(report.avgConfidence).toBeLessThanOrEqual(1);
    });

    it("should report top sessions", () => {
      const now = Date.now();
      const report = logger.generateComplianceReport({
        start: now - 10000,
        end: now + 10000,
      });

      expect(report.topSessions.length).toBeGreaterThan(0);
      expect(report.topSessions[0].sessionId).toBeDefined();
      expect(report.topSessions[0].count).toBeGreaterThan(0);
      expect(report.topSessions[0].sessionId).toBe("session-1"); // Most active
    });

    it("should handle empty time range", () => {
      const report = logger.generateComplianceReport({
        start: 0,
        end: 100,
      });

      expect(report.totalQueries).toBe(0);
      expect(report.blockedQueries).toBe(0);
      expect(report.allowedQueries).toBe(0);
    });
  });

  describe("Utility Methods", () => {
    it("should clear events", () => {
      logger.logEvent({
        eventType: "query_allowed",
        query: "test",
        decision: createMockDecision(),
        destination: "cloud",
        sessionId: "session-1",
        metadata: {} as Record<string, unknown>,
      });

      expect(logger.getEventCount()).toBe(1);

      logger.clearEvents();
      expect(logger.getEventCount()).toBe(0);
    });

    it("should get events by time range", () => {
      const now = Date.now();

      logger.logEvent({
        eventType: "query_allowed",
        query: "test",
        decision: createMockDecision(),
        destination: "cloud",
        sessionId: "session-1",
        metadata: {} as Record<string, unknown>,
      });

      const events = logger.getEventsByTimeRange(now - 1000, now + 1000);
      expect(events.length).toBe(1);
    });

    it("should get events by session", () => {
      logger.logEvent({
        eventType: "query_allowed",
        query: "test",
        decision: createMockDecision(),
        destination: "cloud",
        sessionId: "my-session",
        metadata: {} as Record<string, unknown>,
      });

      const events = logger.getEventsBySession("my-session");
      expect(events.length).toBe(1);
      expect(events[0].sessionId).toBe("my-session");
    });

    it("should get events by user hash", () => {
      const userHash = logger.hashUserId("user-123");

      logger.logEvent({
        eventType: "query_allowed",
        query: "test",
        decision: createMockDecision(),
        destination: "cloud",
        sessionId: "session-1",
        userIdHash: userHash,
        metadata: {} as Record<string, unknown>,
      });

      const events = logger.getEventsByUser(userHash);
      expect(events.length).toBe(1);
    });

    it("should get recent events", () => {
      for (let i = 0; i < 5; i++) {
        logger.logEvent({
          eventType: "query_allowed",
          query: `query-${i}`,
          decision: createMockDecision(),
          destination: "cloud",
          sessionId: "session-1",
          metadata: {} as Record<string, unknown>,
        });
      }

      const recent = logger.getRecentEvents(3);
      expect(recent.length).toBe(3);
    });

    it("should get statistics", () => {
      logger.logEvent({
        eventType: "query_allowed",
        query: "test",
        decision: createMockDecision(),
        destination: "cloud",
        sessionId: "session-1",
        metadata: {} as Record<string, unknown>,
      });

      const stats = logger.getStatistics();
      expect(stats.totalEvents).toBe(1);
      expect(stats.totalLogged).toBe(1);
      expect(stats.memoryUsage).toBeGreaterThan(0);
      expect(stats.oldestEvent).toBeDefined();
      expect(stats.newestEvent).toBeDefined();
      expect(stats.eventsByType.query_allowed).toBe(1);
    });

    it("should hash user IDs consistently", () => {
      const hash1 = logger.hashUserId("user-123");
      const hash2 = logger.hashUserId("user-123");
      const hash3 = logger.hashUserId("user-456");

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("Import/Export", () => {
    it("should export all events", () => {
      logger.logEvent({
        eventType: "query_allowed",
        query: "test",
        decision: createMockDecision(),
        destination: "cloud",
        sessionId: "session-1",
        metadata: {} as Record<string, unknown>,
      });

      const exported = logger.exportAllEvents();
      expect(exported).toBeDefined();

      const parsed = JSON.parse(exported);
      expect(parsed.length).toBe(1);
    });

    it("should import events", () => {
      const eventsToImport: PrivacyAuditEvent[] = [
        {
          timestamp: Date.now(),
          eventType: "query_allowed",
          queryHash: "hash",
          queryLength: 4,
          decision: createMockDecision(),
          destination: "cloud",
          sessionId: "session-1",
          metadata: {} as Record<string, unknown>,
        },
      ];

      const json = JSON.stringify(eventsToImport);
      logger.importEvents(json);

      expect(logger.getEventCount()).toBe(1);
    });

    it("should import and append by default", () => {
      logger.logEvent({
        eventType: "query_allowed",
        query: "existing",
        decision: createMockDecision(),
        destination: "cloud",
        sessionId: "session-1",
        metadata: {} as Record<string, unknown>,
      });

      const eventsToImport: PrivacyAuditEvent[] = [
        {
          timestamp: Date.now(),
          eventType: "query_blocked",
          queryHash: "hash",
          queryLength: 4,
          decision: createMockDecision("deny"),
          destination: "cloud",
          sessionId: "session-1",
          metadata: {} as Record<string, unknown>,
        },
      ];

      const json = JSON.stringify(eventsToImport);
      logger.importEvents(json, true); // append

      expect(logger.getEventCount()).toBe(2);
    });

    it("should import and replace when append is false", () => {
      logger.logEvent({
        eventType: "query_allowed",
        query: "existing",
        decision: createMockDecision(),
        destination: "cloud",
        sessionId: "session-1",
        metadata: {} as Record<string, unknown>,
      });

      const eventsToImport: PrivacyAuditEvent[] = [
        {
          timestamp: Date.now(),
          eventType: "query_blocked",
          queryHash: "hash",
          queryLength: 4,
          decision: createMockDecision("deny"),
          destination: "cloud",
          sessionId: "session-1",
          metadata: {} as Record<string, unknown>,
        },
      ];

      const json = JSON.stringify(eventsToImport);
      logger.importEvents(json, false); // replace

      expect(logger.getEventCount()).toBe(1);
      expect(logger.queryEvents()[0].eventType).toBe("query_blocked");
    });
  });

  describe("Edge Cases", () => {
    it("should handle events without classification", () => {
      logger.logEvent({
        eventType: "query_allowed",
        query: "test",
        decision: createMockDecision(),
        destination: "cloud",
        sessionId: "session-1",
        metadata: {} as Record<string, unknown>,
      });

      const events = logger.queryEvents();
      expect(events[0].classification).toBeUndefined();
    });

    it("should handle events without PII", () => {
      logger.logEvent({
        eventType: "query_allowed",
        query: "test",
        decision: createMockDecision(),
        destination: "cloud",
        sessionId: "session-1",
        metadata: {} as Record<string, unknown>,
      });

      const events = logger.queryEvents();
      expect(events[0].piiDetected).toBeUndefined();
    });

    it("should handle events without user ID", () => {
      logger.logEvent({
        eventType: "query_allowed",
        query: "test",
        decision: createMockDecision(),
        destination: "cloud",
        sessionId: "session-1",
        metadata: {} as Record<string, unknown>,
      });

      const events = logger.queryEvents();
      expect(events[0].userIdHash).toBeUndefined();
    });

    it("should handle empty metadata", () => {
      logger.logEvent({
        eventType: "query_allowed",
        query: "test",
        decision: createMockDecision(),
        destination: "cloud",
        sessionId: "session-1",
        metadata: {} as Record<string, unknown>,
      });

      const events = logger.queryEvents();
      expect(events[0].metadata).toEqual({});
    });

    it("should handle custom metadata", () => {
      logger.logEvent({
        eventType: "query_allowed",
        query: "test",
        decision: createMockDecision(),
        destination: "cloud",
        sessionId: "session-1",
        metadata: { custom: "value", number: 123 },
      });

      const events = logger.queryEvents();
      expect(events[0].metadata).toEqual({ custom: "value", number: 123 });
    });
  });
});

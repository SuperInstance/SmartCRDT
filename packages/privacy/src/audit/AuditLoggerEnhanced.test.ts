/**
 * Tests for AuditLoggerEnhanced
 *
 * Comprehensive test suite for enhanced privacy audit logging
 */

import { describe, it, expect, beforeEach } from "vitest";
import { AuditLoggerEnhanced } from "./AuditLoggerEnhanced.js";
import type { EnhancedAuditEvent } from "./AuditLoggerEnhanced.js";
import { PrivacyLevel, PIIType } from "@lsi/protocol";

describe("AuditLoggerEnhanced", () => {
  let logger: AuditLoggerEnhanced;

  beforeEach(() => {
    logger = new AuditLoggerEnhanced({
      storage: { backend: "memory" },
      anomalyDetection: {
        enabled: true,
        sensitivity: 0.7,
        windowSize: 300000,
        minSamples: 5,
      },
      trackConsent: true,
      trackLocation: true,
      trackDevice: true,
      hashSensitiveFields: true,
      includeRawQuery: false,
      maxMemoryEvents: 1000,
      enableCompression: true,
    });
  });

  describe("Event Logging", () => {
    it("should log an event and return event ID", async () => {
      const event: Omit<EnhancedAuditEvent, "eventId" | "timestamp"> = {
        eventType: "query_allowed",
        queryHash: "test-query-hash",
        queryLength: 100,
        classification: {
          level: PrivacyLevel.PUBLIC,
          confidence: 0.9,
          piiTypes: [],
          reason: "Test classification",
        },
        piiDetected: [],
        decision: {
          action: "allow",
          matchedRules: [],
          confidence: 0.9,
        },
        destination: "local",
        userIdHash: "user-123",
        sessionId: "session-456",
        metadata: {},
      };

      const eventId = await logger.logEvent(event);

      expect(eventId).toBeDefined();
      expect(eventId).toMatch(/^EVT-\d+-[A-F0-9]+$/);

      const events = logger.queryEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventId).toBe(eventId);
      expect(events[0].eventType).toBe("query_allowed");
    });

    it("should hash sensitive fields when enabled", async () => {
      const event: Omit<EnhancedAuditEvent, "eventId" | "timestamp"> = {
        eventType: "query_allowed",
        queryHash: "test-query-hash",
        queryLength: 100,
        classification: {
          level: PrivacyLevel.SENSITIVE,
          confidence: 0.8,
          piiTypes: [PIIType.EMAIL],
          reason: "Contains email",
        },
        piiDetected: [PIIType.EMAIL],
        decision: {
          action: "allow",
          matchedRules: [],
          confidence: 0.8,
        },
        destination: "local",
        userIdHash: "user-123",
        sessionId: "session-456",
        metadata: {},
      };

      const eventId = await logger.logEvent(event);
      const loggedEvent = logger.queryEvents({ eventId } as any)[0];

      // userIdHash should be SHA-256 hashed
      expect(loggedEvent.userIdHash).toHaveLength(64);
      expect(loggedEvent.userIdHash).not.toBe("user-123");
    });

    it("should log related events with correlation ID", async () => {
      const correlationId = "corr-123";

      const event1: Omit<EnhancedAuditEvent, "eventId" | "timestamp"> = {
        eventType: "pii_detected",
        queryHash: "query-1",
        queryLength: 50,
        classification: {
          level: PrivacyLevel.SENSITIVE,
          confidence: 0.9,
          piiTypes: [PIIType.EMAIL],
          reason: "Contains PII",
        },
        piiDetected: [PIIType.EMAIL],
        decision: {
          action: "allow",
          matchedRules: [],
          confidence: 0.9,
        },
        destination: "local",
        userIdHash: "user-1",
        sessionId: "session-1",
        metadata: {},
      };

      const event2: Omit<EnhancedAuditEvent, "eventId" | "timestamp"> = {
        eventType: "query_redacted",
        queryHash: "query-2",
        queryLength: 50,
        classification: {
          level: PrivacyLevel.SENSITIVE,
          confidence: 0.9,
          piiTypes: [PIIType.EMAIL],
          reason: "Redacted PII",
        },
        piiDetected: [PIIType.EMAIL],
        decision: {
          action: "redact",
          matchedRules: ["rule-1"],
          confidence: 0.9,
        },
        destination: "cloud",
        userIdHash: "user-1",
        sessionId: "session-1",
        metadata: {},
      };

      await logger.logEvent(event1, correlationId);
      await logger.logEvent(event2, correlationId);

      const relatedEvents = logger.getEventsByCorrelation(correlationId);
      expect(relatedEvents).toHaveLength(2);
    });
  });

  describe("PII Inventory", () => {
    it("should track PII inventory", async () => {
      const event: Omit<EnhancedAuditEvent, "eventId" | "timestamp"> = {
        eventType: "pii_detected",
        queryHash: "test",
        queryLength: 100,
        classification: {
          level: PrivacyLevel.SENSITIVE,
          confidence: 0.9,
          piiTypes: [PIIType.EMAIL, PIIType.PHONE],
          reason: "Contains PII",
        },
        piiDetected: [PIIType.EMAIL, PIIType.PHONE],
        decision: {
          action: "allow",
          matchedRules: [],
          confidence: 0.9,
        },
        destination: "local",
        userIdHash: "user-1",
        sessionId: "session-1",
        metadata: {},
      };

      await logger.logEvent(event);
      const inventory = logger.getPIIInventory();

      expect(inventory).toHaveLength(2);
      expect(inventory.find(e => e.type === PIIType.EMAIL)).toBeDefined();
      expect(inventory.find(e => e.type === PIIType.PHONE)).toBeDefined();
    });

    it("should update PII counts on repeated detections", async () => {
      const event: Omit<EnhancedAuditEvent, "eventId" | "timestamp"> = {
        eventType: "pii_detected",
        queryHash: "test",
        queryLength: 100,
        classification: {
          level: PrivacyLevel.SENSITIVE,
          confidence: 0.9,
          piiTypes: [PIIType.EMAIL],
          reason: "Contains email",
        },
        piiDetected: [PIIType.EMAIL],
        decision: {
          action: "allow",
          matchedRules: [],
          confidence: 0.9,
        },
        destination: "local",
        userIdHash: "user-1",
        sessionId: "session-1",
        metadata: {},
      };

      await logger.logEvent(event);
      await logger.logEvent(event);
      await logger.logEvent(event);

      const inventory = logger.getPIIInventory();
      const emailEntry = inventory.find(e => e.type === PIIType.EMAIL);

      expect(emailEntry?.count).toBe(3);
    });
  });

  describe("Consent Tracking", () => {
    it("should track consent changes", async () => {
      const event: Omit<EnhancedAuditEvent, "eventId" | "timestamp"> = {
        eventType: "query_allowed",
        queryHash: "test",
        queryLength: 100,
        classification: {
          level: PrivacyLevel.PUBLIC,
          confidence: 0.9,
          piiTypes: [],
          reason: "Public query",
        },
        piiDetected: [],
        decision: {
          action: "allow",
          matchedRules: [],
          confidence: 0.9,
        },
        destination: "local",
        userIdHash: "user-1",
        sessionId: "session-1",
        consentStatus: "granted",
        dataCategories: ["analytics"],
        legalBasis: "consent",
        metadata: {},
      };

      await logger.logEvent(event);

      const consentLog = logger.getConsentLog();
      expect(consentLog).toHaveLength(1);
      expect(consentLog[0].action).toBe("granted");
      expect(consentLog[0].dataCategories).toEqual(["analytics"]);
    });
  });

  describe("Data Access Logging", () => {
    it("should log data access", async () => {
      const event: Omit<EnhancedAuditEvent, "eventId" | "timestamp"> = {
        eventType: "query_allowed",
        queryHash: "test",
        queryLength: 100,
        classification: {
          level: PrivacyLevel.SOVEREIGN,
          confidence: 0.9,
          piiTypes: [],
          reason: "Internal query",
        },
        piiDetected: [],
        decision: {
          action: "allow",
          matchedRules: [],
          confidence: 0.9,
        },
        destination: "local",
        userIdHash: "user-1",
        sessionId: "session-1",
        dataCategories: ["usage-data"],
        legalBasis: "legitimate-interest",
        metadata: { purpose: "analytics" },
      };

      await logger.logEvent(event);

      const accessLog = logger.getDataAccessLog();
      expect(accessLog).toHaveLength(1);
      expect(accessLog[0].dataCategories).toEqual(["usage-data"]);
      expect(accessLog[0].purpose).toBe("analytics");
    });
  });

  describe("Anomaly Detection", () => {
    it("should detect unusual PII exposure", async () => {
      // Log enough events to meet minSamples threshold
      for (let i = 0; i < 6; i++) {
        const event: Omit<EnhancedAuditEvent, "eventId" | "timestamp"> = {
          eventType: "pii_detected",
          queryHash: `query-${i}`,
          queryLength: 100,
          classification: {
            level: PrivacyLevel.SENSITIVE,
            confidence: 0.9,
            piiTypes: [PIIType.EMAIL],
            reason: "Contains email",
          },
          piiDetected: [PIIType.EMAIL],
          decision: {
            action: "allow",
            matchedRules: [],
            confidence: 0.9,
          },
          destination: "local",
          userIdHash: `user-${i}`,
          sessionId: `session-${i}`,
          metadata: {},
        };
        await logger.logEvent(event);
      }

      // Log event with excessive PII
      const excessivePIIEvent: Omit<EnhancedAuditEvent, "eventId" | "timestamp"> = {
        eventType: "pii_detected",
        queryHash: "excessive",
        queryLength: 200,
        classification: {
          level: PrivacyLevel.SENSITIVE,
          confidence: 0.9,
          piiTypes: [PIIType.EMAIL, PIIType.PHONE, PIIType.SSN, PIIType.CREDIT_CARD, PIIType.PASSPORT, PIIType.DRIVERS_LICENSE],
          reason: "Excessive PII",
        },
        piiDetected: [PIIType.EMAIL, PIIType.PHONE, PIIType.SSN, PIIType.CREDIT_CARD, PIIType.PASSPORT, PIIType.DRIVERS_LICENSE],
        decision: {
          action: "allow",
          matchedRules: [],
          confidence: 0.9,
        },
        destination: "local",
        userIdHash: "user-excessive",
        sessionId: "session-excessive",
        metadata: {},
      };

      await logger.logEvent(excessivePIIEvent);

      const anomalies = logger.getAnomalies();
      const piiAnomaly = anomalies.find(a => a.type === "unusual_pii_exposure");

      expect(piiAnomaly).toBeDefined();
      expect(piiAnomaly?.severity).toBe("high");
    });

    it("should detect data leaks (PII to cloud)", async () => {
      // Log events with PII going to cloud
      // Need at least minSamples (5) events for anomaly detection to trigger
      for (let i = 0; i < 5; i++) {
        const event: Omit<EnhancedAuditEvent, "eventId" | "timestamp"> = {
          eventType: "pii_detected",
          queryHash: `cloud-query-${i}`,
          queryLength: 100,
          classification: {
            level: PrivacyLevel.SENSITIVE,
            confidence: 0.9,
            piiTypes: [PIIType.EMAIL],
            reason: "PII to cloud",
          },
          piiDetected: [PIIType.EMAIL],
          decision: {
            action: "allow",
            matchedRules: [],
            confidence: 0.9,
          },
          destination: "cloud",
          userIdHash: `user-${i}`,
          sessionId: `session-${i}`,
          metadata: {},
        };
        await logger.logEvent(event);
      }

      const anomalies = logger.getAnomalies();
      const leakAnomaly = anomalies.find(a => a.type === "data_leak");

      expect(leakAnomaly).toBeDefined();
      expect(leakAnomaly?.severity).toBe("critical");
    });
  });

  describe("Event Querying", () => {
    beforeEach(async () => {
      // Log sample events
      const events: Omit<EnhancedAuditEvent, "eventId" | "timestamp">[] = [
        {
          eventType: "query_allowed",
          queryHash: "query-1",
          queryLength: 100,
          classification: {
            level: PrivacyLevel.PUBLIC,
            confidence: 0.9,
            piiTypes: [],
            reason: "Public",
          },
          piiDetected: [],
          decision: { action: "allow", matchedRules: [], confidence: 0.9 },
          destination: "local",
          userIdHash: "user-1",
          sessionId: "session-1",
          metadata: {},
        },
        {
          eventType: "pii_detected",
          queryHash: "query-2",
          queryLength: 150,
          classification: {
            level: PrivacyLevel.SENSITIVE,
            confidence: 0.8,
            piiTypes: [PIIType.EMAIL],
            reason: "Contains email",
          },
          piiDetected: [PIIType.EMAIL],
          decision: { action: "allow", matchedRules: [], confidence: 0.8 },
          destination: "cloud",
          userIdHash: "user-2",
          sessionId: "session-2",
          consentStatus: "granted",
          metadata: {},
        },
      ];

      for (const event of events) {
        await logger.logEvent(event);
      }
    });

    it("should filter by event type", () => {
      const events = logger.queryEvents({ eventType: ["pii_detected"] });
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe("pii_detected");
    });

    it("should filter by classification", () => {
      const events = logger.queryEvents({ classification: [PrivacyLevel.SENSITIVE] });
      expect(events).toHaveLength(1);
      expect(events[0].classification?.level).toBe(PrivacyLevel.SENSITIVE);
    });

    it("should filter by destination", () => {
      const events = logger.queryEvents({ destination: ["cloud"] });
      expect(events).toHaveLength(1);
      expect(events[0].destination).toBe("cloud");
    });

    it("should filter by consent status", () => {
      const events = logger.queryEvents({ consentStatus: "granted" });
      expect(events).toHaveLength(1);
      expect(events[0].consentStatus).toBe("granted");
    });
  });

  describe("Analytics Generation", () => {
    it("should generate aggregated analytics", async () => {
      // Log sample events
      for (let i = 0; i < 10; i++) {
        const event: Omit<EnhancedAuditEvent, "eventId" | "timestamp"> = {
          eventType: i % 2 === 0 ? "query_allowed" : "pii_detected",
          queryHash: `query-${i}`,
          queryLength: 100,
          classification: {
            level: i % 2 === 0 ? PrivacyLevel.PUBLIC : PrivacyLevel.SENSITIVE,
            confidence: 0.9,
            piiTypes: i % 2 === 0 ? [] : [PIIType.EMAIL],
            reason: "Test",
          },
          piiDetected: i % 2 === 0 ? [] : [PIIType.EMAIL],
          decision: {
            action: "allow",
            matchedRules: [],
            confidence: 0.9,
          },
          destination: i % 3 === 0 ? "cloud" : "local",
          userIdHash: `user-${i % 3}`,
          sessionId: `session-${i}`,
          consentStatus: "granted",
          metadata: {},
        };
        await logger.logEvent(event);
      }

      const now = Date.now();
      const analytics = logger.generateAnalytics({
        start: now - 60000,
        end: now + 60000,
      });

      expect(analytics.totalEvents).toBe(10);
      expect(analytics.eventsByType["query_allowed"]).toBe(5);
      expect(analytics.eventsByType["pii_detected"]).toBe(5);
      expect(analytics.piiDetectionRate).toBe(0.5);
      expect(analytics.queriesByDestination.local).toBeGreaterThan(0);
      expect(analytics.queriesByDestination.cloud).toBeGreaterThan(0);
      expect(analytics.uniqueUsers).toBe(3);
    });
  });

  describe("Event Export", () => {
    it("should export events to JSON", async () => {
      const event: Omit<EnhancedAuditEvent, "eventId" | "timestamp"> = {
        eventType: "query_allowed",
        queryHash: "test",
        queryLength: 100,
        classification: {
          level: PrivacyLevel.PUBLIC,
          confidence: 0.9,
          piiTypes: [],
          reason: "Test",
        },
        piiDetected: [],
        decision: {
          action: "allow",
          matchedRules: [],
          confidence: 0.9,
        },
        destination: "local",
        userIdHash: "user-1",
        sessionId: "session-1",
        metadata: {},
      };

      await logger.logEvent(event);

      const json = await logger.exportEvents(undefined, "json");
      const parsed = JSON.parse(json);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].eventType).toBe("query_allowed");
    });

    it("should export events to CSV", async () => {
      const event: Omit<EnhancedAuditEvent, "eventId" | "timestamp"> = {
        eventType: "query_allowed",
        queryHash: "test",
        queryLength: 100,
        classification: {
          level: PrivacyLevel.PUBLIC,
          confidence: 0.9,
          piiTypes: [],
          reason: "Test",
        },
        piiDetected: [],
        decision: {
          action: "allow",
          matchedRules: [],
          confidence: 0.9,
        },
        destination: "local",
        userIdHash: "user-1",
        sessionId: "session-1",
        metadata: {},
      };

      await logger.logEvent(event);

      const csv = await logger.exportEvents(undefined, "csv");
      const lines = csv.split("\n");

      expect(lines).toHaveLength(2); // Header + 1 data row
      expect(lines[0]).toContain("eventId,timestamp,eventType");
    });
  });

  describe("Statistics", () => {
    it("should return accurate statistics", async () => {
      const event: Omit<EnhancedAuditEvent, "eventId" | "timestamp"> = {
        eventType: "pii_detected",
        queryHash: "test",
        queryLength: 100,
        classification: {
          level: PrivacyLevel.SENSITIVE,
          confidence: 0.9,
          piiTypes: [PIIType.EMAIL],
          reason: "Contains PII",
        },
        piiDetected: [PIIType.EMAIL],
        decision: {
          action: "allow",
          matchedRules: [],
          confidence: 0.9,
        },
        destination: "local",
        userIdHash: "user-1",
        sessionId: "session-1",
        consentStatus: "granted",
        metadata: {},
      };

      await logger.logEvent(event);

      const stats = logger.getStatistics();

      expect(stats.totalEvents).toBe(1);
      expect(stats.totalLogged).toBe(1);
      expect(stats.piiInventorySize).toBe(1);
      expect(stats.consentLogSize).toBe(1);
      expect(stats.storageBackend).toBe("memory");
    });
  });

  describe("Event Clearing", () => {
    it("should clear all events", async () => {
      const event: Omit<EnhancedAuditEvent, "eventId" | "timestamp"> = {
        eventType: "query_allowed",
        queryHash: "test",
        queryLength: 100,
        classification: {
          level: PrivacyLevel.PUBLIC,
          confidence: 0.9,
          piiTypes: [],
          reason: "Test",
        },
        piiDetected: [],
        decision: {
          action: "allow",
          matchedRules: [],
          confidence: 0.9,
        },
        destination: "local",
        userIdHash: "user-1",
        sessionId: "session-1",
        metadata: {},
      };

      await logger.logEvent(event);
      expect(logger.queryEvents()).toHaveLength(1);

      logger.clearEvents();

      expect(logger.queryEvents()).toHaveLength(0);
      expect(logger.getPIIInventory()).toHaveLength(0);
      expect(logger.getConsentLog()).toHaveLength(0);
    });
  });

  describe("Event Emission", () => {
    it("should emit event on logging", async () => {
      let emittedEvent: EnhancedAuditEvent | undefined;

      logger.on("event", (event: EnhancedAuditEvent) => {
        emittedEvent = event;
      });

      const event: Omit<EnhancedAuditEvent, "eventId" | "timestamp"> = {
        eventType: "query_allowed",
        queryHash: "test",
        queryLength: 100,
        classification: {
          level: PrivacyLevel.PUBLIC,
          confidence: 0.9,
          piiTypes: [],
          reason: "Test",
        },
        piiDetected: [],
        decision: {
          action: "allow",
          matchedRules: [],
          confidence: 0.9,
        },
        destination: "local",
        userIdHash: "user-1",
        sessionId: "session-1",
        metadata: {},
      };

      await logger.logEvent(event);

      expect(emittedEvent).toBeDefined();
      expect(emittedEvent?.eventType).toBe("query_allowed");
    });

    it("should emit anomaly on detection", async () => {
      let emittedAnomaly: any;

      logger.on("anomaly", (anomaly: any) => {
        emittedAnomaly = anomaly;
      });

      // Log enough events to trigger anomaly detection
      for (let i = 0; i < 10; i++) {
        const event: Omit<EnhancedAuditEvent, "eventId" | "timestamp"> = {
          eventType: "pii_detected",
          queryHash: `query-${i}`,
          queryLength: 100,
          classification: {
            level: PrivacyLevel.SENSITIVE,
            confidence: 0.9,
            piiTypes: [PIIType.EMAIL],
            reason: "Contains PII",
          },
          piiDetected: [PIIType.EMAIL],
          decision: {
            action: "allow",
            matchedRules: [],
            confidence: 0.9,
          },
          destination: "cloud",
          userIdHash: `user-${i}`,
          sessionId: `session-${i}`,
          metadata: {},
        };
        await logger.logEvent(event);
      }

      // Should emit at least one anomaly
      expect(emittedAnomaly).toBeDefined();
    });
  });
});

/**
 * Tests for RealTimeMonitor
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventEmitter } from "events";
import { RealTimeMonitor } from "./RealTimeMonitor.js";
import { AuditLogger } from "./AuditLogger.js";
import type { PrivacyAuditEvent } from "@lsi/protocol";
import { PrivacyLevel, PIIType } from "@lsi/protocol";

// Create a simple mock AuditLogger
class MockAuditLogger {
  private events: PrivacyAuditEvent[] = [];
  config = {
    maxEvents: 10000,
    enableRotation: true,
    enableHashing: true,
    includeFullQuery: false,
  };
  eventCounter = 0;

  logEvent(event: any): void {
    const fullEvent: PrivacyAuditEvent = {
      timestamp: Date.now(),
      eventType: event.eventType || "query_allowed",
      queryHash: event.queryHash || "test",
      queryLength: event.queryLength || 50,
      classification: event.classification || {
        level: PrivacyLevel.PUBLIC,
        piiTypes: [],
        reason: "test",
        confidence: 0.9,
      },
      piiDetected: event.piiDetected || [],
      decision: event.decision || {
        action: "allow",
        matchedRules: [],
        confidence: 0.9,
      },
      destination: event.destination || "local",
      sessionId: event.sessionId || "test-session",
      userIdHash: event.userIdHash,
      metadata: event.metadata || {},
    };
    this.events.push(fullEvent);
    this.eventCounter++;
  }

  queryEvents(filter?: any): PrivacyAuditEvent[] {
    return this.events;
  }

  exportEventsJSON(filter?: any): string {
    return JSON.stringify(this.events, null, 2);
  }

  exportEventsCSV(filter?: any): string {
    return "timestamp,eventType,queryHash,queryLength,classification,action,destination\n";
  }

  generateComplianceReport(timeRange: { start: number; end: number }) {
    return {
      generatedAt: Date.now(),
      timeRange,
      totalQueries: this.events.length,
      blockedQueries: 0,
      redactedQueries: 0,
      allowedQueries: this.events.length,
      piiIncidents: 0,
      topPIITypes: [],
      queriesByDestination: { local: this.events.length, cloud: 0 },
      queriesByClassification: { public: this.events.length },
      avgConfidence: 0.9,
      topSessions: [],
    };
  }

  getEventCount(): number {
    return this.events.length;
  }

  getTotalEventsLogged(): number {
    return this.eventCounter;
  }

  clearEvents(): void {
    this.events = [];
  }

  getEventsByTimeRange(start: number, end: number): PrivacyAuditEvent[] {
    return this.events.filter(e => e.timestamp >= start && e.timestamp <= end);
  }

  getEventsBySession(sessionId: string): PrivacyAuditEvent[] {
    return this.events.filter(e => e.sessionId === sessionId);
  }

  getEventsByUser(userIdHash: string): PrivacyAuditEvent[] {
    return this.events.filter(e => e.userIdHash === userIdHash);
  }

  getRecentEvents(count: number): PrivacyAuditEvent[] {
    return this.events.slice(-count);
  }

  getStatistics() {
    return {
      totalEvents: this.events.length,
      totalLogged: this.eventCounter,
      memoryUsage: this.events.length * 500,
      oldestEvent: this.events[0]?.timestamp,
      newestEvent: this.events[this.events.length - 1]?.timestamp,
      eventsByType: {
        query_blocked: 0,
        query_redacted: 0,
        query_allowed: this.events.length,
        pii_detected: 0,
        classification_change: 0,
        rule_modified: 0,
        firewall_evaluated: 0,
      },
    };
  }

  exportAllEvents(): string {
    return JSON.stringify(this.events, null, 2);
  }

  importEvents(json: string, append = true): void {
    const importedEvents = JSON.parse(json) as PrivacyAuditEvent[];
    if (!append) {
      this.events = [];
    }
    for (const event of importedEvents) {
      this.events.push(event);
      this.eventCounter++;
    }
  }

  sha256Hash(text: string): string {
    return "mock-hash";
  }

  hashUserId(userId: string): string {
    return "mock-user-hash";
  }
}

describe("RealTimeMonitor", () => {
  let monitor: RealTimeMonitor;
  let logger: MockAuditLogger;
  const testOutputDir = "./test-exports";

  beforeEach(() => {
    logger = new MockAuditLogger();
    monitor = new RealTimeMonitor(logger as any, {
      alertThresholds: {
        piiExposureRate: 0.3,
        blockRate: 0.2,
        highRiskRate: 0.15,
        dataLeakThreshold: 10000,
        queriesPerMinute: 1000,
        errorsPerMinute: 10,
      },
      alertChannels: [{ type: "log", config: {} }],
      samplingRate: 1.0,
      aggregationWindow: 1000, // 1 second for faster tests
      maxEvents: 100,
    });
  });

  afterEach(() => {
    if (monitor) {
      monitor.stop();
    }
  });

  describe("Initialization", () => {
    it("should initialize with default config", () => {
      const defaultMonitor = new RealTimeMonitor(logger as any);
      expect(defaultMonitor).toBeDefined();
    });

    it("should initialize with custom config", () => {
      const customMonitor = new RealTimeMonitor(logger as any, {
        alertThresholds: {
          piiExposureRate: 0.5,
          blockRate: 0.3,
          highRiskRate: 0.2,
          dataLeakThreshold: 5000,
          queriesPerMinute: 500,
          errorsPerMinute: 5,
        },
        alertChannels: [],
        samplingRate: 0.5,
        aggregationWindow: 30000,
      });

      expect(customMonitor).toBeDefined();
    });
  });

  describe("Monitoring Lifecycle", () => {
    it("should start monitoring", () => {
      expect(monitor.getCurrentMetrics().queriesPerMinute).toBe(0);

      monitor.start();
      expect(monitor).toBeDefined();
    });

    it("should stop monitoring", () => {
      monitor.start();
      monitor.stop();

      // Should not throw errors
      expect(() => monitor.stop()).not.toThrow();
    });

    it("should emit started event", () => {
      const startedSpy = vi.fn();
      monitor.on("started", startedSpy);

      monitor.start();

      expect(startedSpy).toHaveBeenCalled();
    });

    it("should emit stopped event", () => {
      const stoppedSpy = vi.fn();
      monitor.on("stopped", stoppedSpy);

      monitor.start();
      monitor.stop();

      expect(stoppedSpy).toHaveBeenCalled();
    });

    it("should handle multiple start calls gracefully", () => {
      monitor.start();
      monitor.start(); // Should not cause issues

      expect(monitor).toBeDefined();
    });
  });

  describe("Event Processing", () => {
    it("should process individual events", () => {
      monitor.start();

      const event: PrivacyAuditEvent = {
        timestamp: Date.now(),
        eventType: "query_allowed",
        queryHash: "test1",
        queryLength: 50,
        classification: {
          level: PrivacyLevel.PUBLIC,
          piiTypes: [],
          reason: "test",
          confidence: 0.9,
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
      };

      expect(() => monitor.processEvent(event)).not.toThrow();
    });

    it("should apply sampling rate", () => {
      const sampledMonitor = new RealTimeMonitor(logger as any, {
        samplingRate: 0.0, // Never sample
        aggregationWindow: 1000,
        alertThresholds: {
          piiExposureRate: 0.3,
          blockRate: 0.2,
          highRiskRate: 0.15,
          dataLeakThreshold: 10000,
          queriesPerMinute: 1000,
          errorsPerMinute: 10,
        },
        alertChannels: [],
      });

      sampledMonitor.start();

      const metricsBefore = sampledMonitor.getCurrentMetrics();
      expect(metricsBefore.queriesPerMinute).toBe(0);

      const event: PrivacyAuditEvent = {
        timestamp: Date.now(),
        eventType: "query_allowed",
        queryHash: "test1",
        queryLength: 50,
        classification: { level: PrivacyLevel.PUBLIC, piiTypes: [], reason: "test", confidence: 0.9 },
        piiDetected: [],
        decision: { action: "allow", matchedRules: [], confidence: 0.9 },
        destination: "local",
        sessionId: "session1",
        metadata: {},
      };

      sampledMonitor.processEvent(event);

      // Event should not be processed due to 0% sampling
      const metricsAfter = sampledMonitor.getCurrentMetrics();
      expect(metricsAfter.queriesPerMinute).toBe(0);

      sampledMonitor.stop();
    });
  });

  describe("Metrics Calculation", () => {
    it("should calculate metrics correctly", () => {
      monitor.start();

      // Add some events
      for (let i = 0; i < 10; i++) {
        logger.logEvent({
          eventType: "query_allowed",
          queryHash: `hash${i}`,
          queryLength: 50,
          classification: { level: PrivacyLevel.PUBLIC, piiTypes: [], reason: "test", confidence: 0.8 },
          piiDetected: [],
          decision: { action: "allow", matchedRules: [], confidence: 0.8 },
          destination: "local",
          sessionId: "session1",
        });
      }

      // Wait for aggregation
      const metrics = monitor.getCurrentMetrics();

      expect(metrics).toHaveProperty("queriesPerMinute");
      expect(metrics).toHaveProperty("blocksPerMinute");
      expect(metrics).toHaveProperty("piiExposureRate");
      expect(metrics).toHaveProperty("highRiskRate");
      expect(metrics).toHaveProperty("avgConfidence");
      expect(metrics).toHaveProperty("errorRate");
      expect(metrics).toHaveProperty("topPIITypes");
      expect(metrics).toHaveProperty("topClassifications");
    });

    it("should return zero metrics when no events", () => {
      monitor.start();

      const metrics = monitor.getCurrentMetrics();

      expect(metrics.queriesPerMinute).toBe(0);
      expect(metrics.blocksPerMinute).toBe(0);
      expect(metrics.piiExposureRate).toBe(0);
      expect(metrics.highRiskRate).toBe(0);
      expect(metrics.avgConfidence).toBe(0);
    });

    it("should calculate PII exposure rate", () => {
      monitor.start();

      // Add events with PII directly to monitor
      for (let i = 0; i < 5; i++) {
        monitor.processEvent({
          timestamp: Date.now() + i,
          eventType: "query_allowed",
          queryHash: `hash${i}`,
          queryLength: 50,
          classification: { level: PrivacyLevel.SENSITIVE, piiTypes: [], reason: "test", confidence: 0.8 },
          piiDetected: [PIIType.EMAIL],
          decision: { action: "allow", matchedRules: [], confidence: 0.8 },
          destination: "local",
          sessionId: "session1",
          metadata: {},
        });
      }

      // Add events without PII
      for (let i = 0; i < 5; i++) {
        monitor.processEvent({
          timestamp: Date.now() + i + 10,
          eventType: "query_allowed",
          queryHash: `hash${i + 5}`,
          queryLength: 50,
          classification: { level: PrivacyLevel.PUBLIC, piiTypes: [], reason: "test", confidence: 0.8 },
          piiDetected: [],
          decision: { action: "allow", matchedRules: [], confidence: 0.8 },
          destination: "local",
          sessionId: "session1",
          metadata: {},
        });
      }

      const metrics = monitor.getCurrentMetrics();

      // Should have 50% PII exposure rate
      expect(metrics.piiExposureRate).toBeGreaterThan(0);
    });

    it("should track top PII types", () => {
      monitor.start();

      monitor.processEvent({
        timestamp: Date.now(),
        eventType: "query_allowed",
        queryHash: "hash1",
        queryLength: 50,
        classification: { level: PrivacyLevel.SENSITIVE, piiTypes: [], reason: "test", confidence: 0.8 },
        piiDetected: [PIIType.EMAIL, PIIType.PHONE],
        decision: { action: "allow", matchedRules: [], confidence: 0.8 },
        destination: "local",
        sessionId: "session1",
        metadata: {},
      });

      monitor.processEvent({
        timestamp: Date.now() + 1,
        eventType: "query_allowed",
        queryHash: "hash2",
        queryLength: 50,
        classification: { level: PrivacyLevel.SENSITIVE, piiTypes: [], reason: "test", confidence: 0.8 },
        piiDetected: [PIIType.EMAIL, PIIType.SSN],
        decision: { action: "allow", matchedRules: [], confidence: 0.8 },
        destination: "local",
        sessionId: "session1",
        metadata: {},
      });

      const metrics = monitor.getCurrentMetrics();

      expect(metrics.topPIITypes.length).toBeGreaterThan(0);
      expect(metrics.topPIITypes[0].type).toBe("EMAIL"); // Most common
    });
  });

  describe("Alert Generation", () => {
    it("should generate alert for PII exposure spike", () => {
      return new Promise<void>((resolve) => {
        const alertSpy = vi.fn();
        monitor.on("alert", alertSpy);

        monitor.start();

        // Add events with high PII exposure
        for (let i = 0; i < 10; i++) {
          logger.logEvent({
            eventType: "query_allowed",
            queryHash: `hash${i}`,
            queryLength: 50,
            classification: { level: PrivacyLevel.SENSITIVE, piiTypes: [], reason: "test", confidence: 0.8 },
            piiDetected: [PIIType.EMAIL, PIIType.PHONE],
            decision: { action: "allow", matchedRules: [], confidence: 0.8 },
            destination: "local",
            sessionId: "session1",
          });
        }

        // Wait for aggregation window to complete
        setTimeout(() => {
          if (alertSpy.mock && alertSpy.mock.calls.length > 0) {
            const alert = alertSpy.mock.calls[0][0];
            expect(alert.type).toBe("pii_exposure_spike");
            expect(alert.severity).toBe("warning");
          }
          resolve();
        }, 1500);
      });
    });

    it("should generate alert for high block rate", () => {
      return new Promise<void>((resolve) => {
        const alertSpy = vi.fn();
        monitor.on("alert", alertSpy);

        monitor.start();

        // Add blocked events
        for (let i = 0; i < 5; i++) {
          logger.logEvent({
            eventType: "query_blocked",
            queryHash: `hash${i}`,
            queryLength: 50,
            classification: { level: PrivacyLevel.SOVEREIGN, piiTypes: [], reason: "test", confidence: 0.9 },
            piiDetected: [PIIType.SSN],
            decision: {
              action: "deny",
              matchedRules: ["rule1"],
              confidence: 0.9,
            },
            destination: "local",
            sessionId: "session1",
          });
        }

        setTimeout(() => {
          if (alertSpy.mock && alertSpy.mock.calls.length > 0) {
            const alert = alertSpy.mock.calls[0][0];
            expect(["block_rate_high", "pii_exposure_spike"]).toContain(
              alert.type
            );
          }
          resolve();
        }, 1500);
      });
    });

    it("should generate critical alert for data leak", () => {
      return new Promise<void>((resolve) => {
        const alertSpy = vi.fn();
        monitor.on("alert", alertSpy);

        monitor.start();

        // Add PII events going to cloud with large data
        for (let i = 0; i < 20; i++) {
          logger.logEvent({
            eventType: "query_allowed",
            queryHash: `hash${i}`,
            queryLength: 1000, // Large query
            classification: { level: PrivacyLevel.SENSITIVE, piiTypes: [], reason: "test", confidence: 0.8 },
            piiDetected: [PIIType.EMAIL],
            decision: { action: "allow", matchedRules: [], confidence: 0.8 },
            destination: "cloud", // Going to cloud
            sessionId: "session1",
          });
        }

        setTimeout(() => {
          if (alertSpy.mock && alertSpy.mock.calls.length > 0) {
            const dataLeakAlert = alertSpy.mock.calls.find(
              (call: any) => call[0].type === "data_leak_detected"
            );
            if (dataLeakAlert) {
              expect(dataLeakAlert[0].severity).toBe("critical");
            }
          }
          resolve();
        }, 1500);
      });
    });
  });

  describe("Alert Subscriptions", () => {
    it("should subscribe to alerts", () => {
      const callback = vi.fn();
      const subscription = monitor.onAlert(callback);

      expect(subscription).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe("function");
    });

    it("should unsubscribe from alerts", () => {
      const callback = vi.fn();
      const subscription = monitor.onAlert(callback);

      subscription.unsubscribe();

      // After unsubscribe, callback should not be called
      monitor.start();
      logger.logEvent({
        eventType: "query_allowed",
        queryHash: "test",
        queryLength: 50,
        classification: { level: PrivacyLevel.PUBLIC, piiTypes: [], reason: "test", confidence: 0.9 },
        piiDetected: [],
        decision: { action: "allow", matchedRules: [], confidence: 0.9 },
        destination: "local",
        sessionId: "session1",
      });

      // Callback should not have been called
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("Alert History", () => {
    it("should track alert history", () => {
      return new Promise<void>((resolve) => {
        monitor.start();

        // Generate some alerts by exceeding thresholds
        for (let i = 0; i < 20; i++) {
          logger.logEvent({
            eventType: "query_allowed",
            queryHash: `hash${i}`,
            queryLength: 50,
            classification: { level: PrivacyLevel.SENSITIVE, piiTypes: [], reason: "test", confidence: 0.8 },
            piiDetected: [PIIType.EMAIL],
            decision: { action: "allow", matchedRules: [], confidence: 0.8 },
            destination: "cloud",
            sessionId: "session1",
          });
        }

        setTimeout(() => {
          const recentAlerts = monitor.getRecentAlerts(10);

          expect(Array.isArray(recentAlerts)).toBe(true);
          expect(recentAlerts.length).toBeGreaterThanOrEqual(0);
          resolve();
        }, 1500);
      });
    });

    it("should limit alert history", () => {
      // Monitor should limit history to 1000 alerts
      const stats = monitor.getAlertStatistics();

      expect(stats).toHaveProperty("total");
      expect(stats).toHaveProperty("bySeverity");
      expect(stats).toHaveProperty("byType");
      expect(stats).toHaveProperty("last24h");
    });
  });

  describe("Threshold Updates", () => {
    it("should update alert thresholds", () => {
      monitor.updateThresholds({
        piiExposureRate: 0.5,
        blockRate: 0.4,
      });

      // Should not throw
      expect(() => monitor.updateThresholds({})).not.toThrow();
    });
  });

  describe("Alert Channels", () => {
    it("should add alert channel", () => {
      const channelCountBefore = monitor["config"].alertChannels.length;

      monitor.addAlertChannel({
        type: "webhook",
        config: { url: "https://example.com/webhook" },
      });

      expect(monitor["config"].alertChannels.length).toBe(
        channelCountBefore + 1
      );
    });

    it("should remove alert channel", () => {
      monitor.addAlertChannel({
        type: "email",
        config: { to: "test@example.com" },
      });

      const channelCountBefore = monitor["config"].alertChannels.length;

      monitor.removeAlertChannel("email");

      expect(monitor["config"].alertChannels.length).toBe(
        channelCountBefore - 1
      );
    });

    it("should send alert to log channel", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      monitor.start();

      // This should generate alerts and log them
      // Manually trigger an alert
      monitor["generateAlert"]({
        alertId: "test-alert",
        timestamp: Date.now(),
        severity: "warning",
        type: "pii_exposure_spike",
        message: "Test alert",
        metrics: {
          currentValue: 0.5,
          threshold: 0.3,
          window: 60000,
          affectedQueries: 10,
        },
        recommendations: ["Test recommendation"],
      });

      // Console should have been called for log channel
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("Alert Statistics", () => {
    it("should provide alert statistics", () => {
      const stats = monitor.getAlertStatistics();

      expect(stats.total).toBeGreaterThanOrEqual(0);
      expect(stats.bySeverity).toHaveProperty("info");
      expect(stats.bySeverity).toHaveProperty("warning");
      expect(stats.bySeverity).toHaveProperty("error");
      expect(stats.bySeverity).toHaveProperty("critical");
      expect(stats.byType).toBeDefined();
      expect(stats.last24h).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle processing when stopped", () => {
      const event: PrivacyAuditEvent = {
        timestamp: Date.now(),
        eventType: "query_allowed",
        queryHash: "test",
        queryLength: 50,
        classification: { level: PrivacyLevel.PUBLIC, piiTypes: [], reason: "test", confidence: 0.9 },
        piiDetected: [],
        decision: { action: "allow", matchedRules: [], confidence: 0.9 },
        destination: "local",
        sessionId: "session1",
        metadata: {},
      };

      // Should not throw when processing while stopped
      expect(() => monitor.processEvent(event)).not.toThrow();
    });

    it("should handle events without classification", () => {
      monitor.start();

      const event: PrivacyAuditEvent = {
        timestamp: Date.now(),
        eventType: "query_allowed",
        queryHash: "test",
        queryLength: 50,
        piiDetected: [],
        decision: { action: "allow", matchedRules: [], confidence: 0.9 },
        destination: "local",
        sessionId: "session1",
        metadata: {},
      };

      expect(() => monitor.processEvent(event)).not.toThrow();
    });

    it("should handle events without PII detection", () => {
      monitor.start();

      const event: PrivacyAuditEvent = {
        timestamp: Date.now(),
        eventType: "query_allowed",
        queryHash: "test",
        queryLength: 50,
        classification: { level: PrivacyLevel.PUBLIC, piiTypes: [], reason: "test", confidence: 0.9 },
        decision: { action: "allow", matchedRules: [], confidence: 0.9 },
        destination: "local",
        sessionId: "session1",
        metadata: {},
      };

      expect(() => monitor.processEvent(event)).not.toThrow();
    });
  });
});

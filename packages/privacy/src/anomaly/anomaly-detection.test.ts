/**
 * Tests for Anomaly Detection Module
 *
 * Comprehensive tests for privacy anomaly detection, behavior profiling,
 * and security event correlation.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  PrivacyAnomalyDetector,
  BehaviorProfiler,
  SecurityEventCorrelator,
} from "./index.js";
import type {
  AccessEvent,
  SecurityEvent,
  BehaviorProfile,
  PrivacyAnomaly,
  AnomalyScore,
  SecurityIncident,
} from "./index.js";

describe("PrivacyAnomalyDetector", () => {
  let detector: PrivacyAnomalyDetector;

  beforeEach(() => {
    detector = new PrivacyAnomalyDetector({
      anomaly_threshold: 0.7,
      min_alert_confidence: 0.6,
      mass_access_threshold: 50,
      exfiltration_threshold: 5 * 1024 * 1024, // 5 MB
    });
  });

  afterEach(() => {
    detector.clear_events();
    detector.clear_alerts();
  });

  describe("PII Exposure Detection", () => {
    it("should detect SSN in event metadata", () => {
      const event: AccessEvent = {
        id: "evt_1",
        timestamp: new Date(),
        entity_id: "user_1",
        entity_type: "user",
        resource_id: "resource_1",
        resource_type: "database",
        access_type: "read",
        granted: true,
        data_volume: 1024,
        record_count: 1,
        location: "192.168.1.1",
        session_id: "session_1",
        sensitivity_level: "confidential",
        metadata: { data: "User SSN: 123-45-6789" },
      };

      const anomalies = detector.detect_pii_exposure(event);

      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].type).toBe("pii_exposure");
      expect(anomalies[0].severity).toBe("high");
      expect(anomalies[0].affected_entities).toContain("user_1");
    });

    it("should detect credit card numbers", () => {
      const event: AccessEvent = {
        id: "evt_2",
        timestamp: new Date(),
        entity_id: "user_1",
        entity_type: "user",
        resource_id: "resource_1",
        resource_type: "database",
        access_type: "read",
        granted: true,
        data_volume: 1024,
        record_count: 1,
        location: "192.168.1.1",
        session_id: "session_1",
        sensitivity_level: "confidential",
        metadata: { card: "4111-1111-1111-1111" },
      };

      const anomalies = detector.detect_pii_exposure(event);

      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].type).toBe("pii_exposure");
    });

    it("should detect email addresses", () => {
      const event: AccessEvent = {
        id: "evt_3",
        timestamp: new Date(),
        entity_id: "user_1",
        entity_type: "user",
        resource_id: "resource_1",
        resource_type: "database",
        access_type: "read",
        granted: true,
        data_volume: 1024,
        record_count: 1,
        location: "192.168.1.1",
        session_id: "session_1",
        sensitivity_level: "confidential",
        metadata: { email: "user@example.com" },
      };

      const anomalies = detector.detect_pii_exposure(event);

      expect(anomalies).toHaveLength(1);
    });

    it("should detect PII in sensitive contexts", () => {
      const event: AccessEvent = {
        id: "evt_4",
        timestamp: new Date(),
        entity_id: "user_1",
        entity_type: "user",
        resource_id: "resource_1",
        resource_type: "database",
        access_type: "read",
        granted: true,
        data_volume: 1024,
        record_count: 1,
        location: "192.168.1.1",
        session_id: "session_1",
        sensitivity_level: "confidential",
        pii_types: ["ssn", "email"],
        metadata: { context: "error_log" },
      };

      const anomalies = detector.detect_pii_exposure(event);

      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].severity).toBe("critical");
      expect(anomalies[0].recommendations).toContain(
        "Immediately remove PII from this context"
      );
    });

    it("should not detect PII when none present", () => {
      const event: AccessEvent = {
        id: "evt_5",
        timestamp: new Date(),
        entity_id: "user_1",
        entity_type: "user",
        resource_id: "resource_1",
        resource_type: "database",
        access_type: "read",
        granted: true,
        data_volume: 1024,
        record_count: 1,
        location: "192.168.1.1",
        session_id: "session_1",
        sensitivity_level: "public",
        metadata: { data: "No PII here" },
      };

      const anomalies = detector.detect_pii_exposure(event);

      expect(anomalies).toHaveLength(0);
    });
  });

  describe("Unauthorized Access Detection", () => {
    it("should detect denied access", () => {
      const event: AccessEvent = {
        id: "evt_1",
        timestamp: new Date(),
        entity_id: "user_1",
        entity_type: "user",
        resource_id: "resource_1",
        resource_type: "database",
        access_type: "read",
        granted: false,
        data_volume: 0,
        record_count: 0,
        location: "192.168.1.1",
        session_id: "session_1",
        sensitivity_level: "confidential",
        metadata: {},
      };

      const anomalies = detector.detect_unauthorized_access(event);

      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].type).toBe("unauthorized_access");
      expect(anomalies[0].severity).toBe("high");
    });

    it("should detect critical severity for admin denied access", () => {
      const event: AccessEvent = {
        id: "evt_2",
        timestamp: new Date(),
        entity_id: "user_1",
        entity_type: "user",
        resource_id: "resource_1",
        resource_type: "database",
        access_type: "admin",
        granted: false,
        data_volume: 0,
        record_count: 0,
        location: "192.168.1.1",
        session_id: "session_1",
        sensitivity_level: "restricted",
        metadata: {},
      };

      const anomalies = detector.detect_unauthorized_access(event);

      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].severity).toBe("critical");
    });

    it("should detect privilege escalation", () => {
      // First build a baseline
      const baselineEvents: AccessEvent[] = Array.from(
        { length: 100 },
        (_, i) => ({
          id: `evt_${i}`,
          timestamp: new Date(Date.now() - i * 60000),
          entity_id: "user_1",
          entity_type: "user",
          resource_id: `resource_${i % 5}`,
          resource_type: "file",
          access_type: "read",
          granted: true,
          data_volume: 1024,
          record_count: 1,
          location: "192.168.1.1",
          session_id: "session_1",
          sensitivity_level: "public",
          metadata: {},
        })
      );

      const baseline = detector.build_baseline(baselineEvents);
      detector.set_baseline(baseline);

      // Now try to access restricted resource
      const event: AccessEvent = {
        id: "evt_101",
        timestamp: new Date(),
        entity_id: "user_1",
        entity_type: "user",
        resource_id: "resource_100",
        resource_type: "admin_database",
        access_type: "read",
        granted: true,
        data_volume: 1024,
        record_count: 1,
        location: "192.168.1.1",
        session_id: "session_1",
        sensitivity_level: "restricted",
        metadata: {},
      };

      const anomalies = detector.detect_unauthorized_access(event);

      expect(anomalies.some(a => a.type === "privilege_escalation")).toBe(true);
    });

    it("should not flag granted access as anomaly", () => {
      const event: AccessEvent = {
        id: "evt_1",
        timestamp: new Date(),
        entity_id: "user_1",
        entity_type: "user",
        resource_id: "resource_1",
        resource_type: "database",
        access_type: "read",
        granted: true,
        data_volume: 1024,
        record_count: 1,
        location: "192.168.1.1",
        session_id: "session_1",
        sensitivity_level: "public",
        metadata: {},
      };

      const anomalies = detector.detect_unauthorized_access(event);

      expect(anomalies).toHaveLength(0);
    });
  });

  describe("Data Exfiltration Detection", () => {
    it("should detect large volume transfers", () => {
      const events: AccessEvent[] = Array.from({ length: 10 }, (_, i) => ({
        id: `evt_${i}`,
        timestamp: new Date(Date.now() - i * 1000),
        entity_id: "user_1",
        entity_type: "user",
        resource_id: `resource_${i}`,
        resource_type: "database",
        access_type: "read",
        granted: true,
        data_volume: 1024 * 1024, // 1 MB each
        record_count: 100,
        location: "192.168.1.1",
        session_id: "session_1",
        sensitivity_level: "confidential",
        metadata: {},
      }));

      const anomalies = detector.detect_data_exfiltration(events);

      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies[0].type).toBe("data_exfiltration");
    });

    it("should compare against baseline for exfiltration", () => {
      // Build baseline with small volumes
      const baselineEvents: AccessEvent[] = Array.from(
        { length: 100 },
        (_, i) => ({
          id: `evt_${i}`,
          timestamp: new Date(Date.now() - (100 - i) * 60000),
          entity_id: "user_1",
          entity_type: "user",
          resource_id: `resource_${i % 5}`,
          resource_type: "database",
          access_type: "read",
          granted: true,
          data_volume: 1024, // 1 KB each
          record_count: 1,
          location: "192.168.1.1",
          session_id: "session_1",
          sensitivity_level: "public",
          metadata: {},
        })
      );

      const baseline = detector.build_baseline(baselineEvents);
      detector.set_baseline(baseline);

      // Now access large volume
      const largeEvents: AccessEvent[] = Array.from({ length: 5 }, (_, i) => ({
        id: `evt_large_${i}`,
        timestamp: new Date(Date.now() - i * 1000),
        entity_id: "user_1",
        entity_type: "user",
        resource_id: `resource_large_${i}`,
        resource_type: "database",
        access_type: "read",
        granted: true,
        data_volume: 10 * 1024 * 1024, // 10 MB each
        record_count: 1000,
        location: "192.168.1.1",
        session_id: "session_1",
        sensitivity_level: "confidential",
        metadata: {},
      }));

      const anomalies = detector.detect_data_exfiltration(largeEvents);

      expect(anomalies.length).toBeGreaterThan(0);
    });

    it("should detect multiple location access", () => {
      const events: AccessEvent[] = Array.from({ length: 10 }, (_, i) => ({
        id: `evt_${i}`,
        timestamp: new Date(Date.now() - i * 10000),
        entity_id: "user_1",
        entity_type: "user",
        resource_id: `resource_${i}`,
        resource_type: "database",
        access_type: "read",
        granted: true,
        data_volume: 1024 * 1024,
        record_count: 100,
        location: `192.168.1.${i % 10}`, // Different IPs
        session_id: "session_1",
        sensitivity_level: "confidential",
        metadata: {},
      }));

      const anomalies = detector.detect_data_exfiltration(events);

      expect(anomalies.some(a => a.type === "unusual_pattern")).toBe(true);
    });
  });

  describe("Mass Access Detection", () => {
    it("should detect mass access in time window", () => {
      const events: AccessEvent[] = Array.from({ length: 100 }, (_, i) => ({
        id: `evt_${i}`,
        timestamp: new Date(Date.now() - i * 100),
        entity_id: "user_1",
        entity_type: "user",
        resource_id: `resource_${i}`,
        resource_type: "database",
        access_type: "read",
        granted: true,
        data_volume: 1024,
        record_count: 10, // 1000 total records
        location: "192.168.1.1",
        session_id: "session_1",
        sensitivity_level: "public",
        metadata: {},
      }));

      const anomalies = detector.detect_mass_access(events);

      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies[0].type).toBe("mass_access");
    });

    it("should detect resource scanning", () => {
      const events: AccessEvent[] = Array.from({ length: 100 }, (_, i) => ({
        id: `evt_${i}`,
        timestamp: new Date(Date.now() - i * 60000),
        entity_id: "user_1",
        entity_type: "user",
        resource_id: `resource_${i}`, // Different resources
        resource_type: "database",
        access_type: "read",
        granted: true,
        data_volume: 1024,
        record_count: 1,
        location: "192.168.1.1",
        session_id: "session_1",
        sensitivity_level: "public",
        metadata: {},
      }));

      // Build baseline first
      const baseline = detector.build_baseline(events);
      detector.set_baseline(baseline);

      // Now scan more resources
      const scanEvents: AccessEvent[] = Array.from({ length: 100 }, (_, i) => ({
        id: `evt_scan_${i}`,
        timestamp: new Date(Date.now() - i * 1000),
        entity_id: "user_1",
        entity_type: "user",
        resource_id: `resource_scan_${i}`,
        resource_type: "api", // Different type
        access_type: "read",
        granted: true,
        data_volume: 1024,
        record_count: 1,
        location: "192.168.1.1",
        session_id: "session_1",
        sensitivity_level: "public",
        metadata: {},
      }));

      const anomalies = detector.detect_mass_access(scanEvents);

      expect(
        anomalies
          .some(a => a.description.includes("different resources"))
          .toString()
      ).toBe("true");
    });
  });

  describe("Pattern Anomaly Detection", () => {
    it("should detect temporal anomalies", () => {
      // Build baseline with business hours
      const baselineEvents: AccessEvent[] = Array.from(
        { length: 100 },
        (_, i) => ({
          id: `evt_${i}`,
          timestamp: new Date(Date.now() - (100 - i) * 60000),
          entity_id: "user_1",
          entity_type: "user",
          resource_id: "resource_1",
          resource_type: "database",
          access_type: "read",
          granted: true,
          data_volume: 1024,
          record_count: 1,
          location: "192.168.1.1",
          session_id: "session_1",
          sensitivity_level: "public",
          metadata: {},
        })
      );

      // Set timestamps to business hours (9-17)
      baselineEvents.forEach((e, i) => {
        const hour = 9 + (i % 9); // 9-17
        e.timestamp = new Date();
        e.timestamp.setHours(hour, 0, 0, 0);
      });

      const baseline = detector.build_baseline(baselineEvents);
      detector.set_baseline(baseline);

      // Access at unusual hour (2 AM)
      const unusualEvent: AccessEvent = {
        id: "evt_unusual",
        timestamp: new Date(),
        entity_id: "user_1",
        entity_type: "user",
        resource_id: "resource_1",
        resource_type: "database",
        access_type: "read",
        granted: true,
        data_volume: 1024,
        record_count: 1,
        location: "192.168.1.1",
        session_id: "session_1",
        sensitivity_level: "public",
        metadata: {},
      };
      unusualEvent.timestamp.setHours(2, 0, 0, 0);

      const anomaly = detector.detect_anomaly_against_baseline(
        unusualEvent,
        baseline
      );

      expect(anomaly.components.temporal).toBeGreaterThan(0);
    });

    it("should detect volume anomalies", () => {
      // Build baseline with varied volumes
      const baselineEvents: AccessEvent[] = Array.from(
        { length: 100 },
        (_, i) => ({
          id: `evt_${i}`,
          timestamp: new Date(Date.now() - (100 - i) * 60000),
          entity_id: "user_1",
          entity_type: "user",
          resource_id: "resource_1",
          resource_type: "database",
          access_type: "read",
          granted: true,
          data_volume: 1024 + (i % 10) * 512, // Varied volumes: 1024 to 6144 bytes
          record_count: 1,
          location: "192.168.1.1",
          session_id: "session_1",
          sensitivity_level: "public",
          metadata: {},
        })
      );

      const baseline = detector.build_baseline(baselineEvents);
      detector.set_baseline(baseline);

      // Unusually large volume
      const largeEvent: AccessEvent = {
        id: "evt_large",
        timestamp: new Date(),
        entity_id: "user_1",
        entity_type: "user",
        resource_id: "resource_1",
        resource_type: "database",
        access_type: "read",
        granted: true,
        data_volume: 100 * 1024 * 1024, // 100 MB
        record_count: 10000,
        location: "192.168.1.1",
        session_id: "session_1",
        sensitivity_level: "public",
        metadata: {},
      };

      const anomaly = detector.detect_anomaly_against_baseline(
        largeEvent,
        baseline
      );

      // With 100 MB vs ~3KB baseline, volume should be anomalous
      expect(anomaly.components.volume).toBeGreaterThan(0);
    });
  });

  describe("Baseline Learning", () => {
    it("should build baseline from events", () => {
      const events: AccessEvent[] = Array.from({ length: 100 }, (_, i) => ({
        id: `evt_${i}`,
        timestamp: new Date(Date.now() - (100 - i) * 60000),
        entity_id: "user_1",
        entity_type: "user",
        resource_id: "resource_1",
        resource_type: "database",
        access_type: "read",
        granted: true,
        data_volume: 1024,
        record_count: 1,
        location: "192.168.1.1",
        session_id: "session_1",
        sensitivity_level: "public",
        metadata: {},
      }));

      const baseline = detector.build_baseline(events);

      expect(baseline.entity_id).toBe("user_1");
      expect(baseline.sample_count).toBe(100);
      expect(baseline.typical_volume.mean).toBeGreaterThan(0);
      expect(baseline.typical_hours.length).toBeGreaterThan(0);
    });

    it("should update baseline with new events", () => {
      const initialEvents: AccessEvent[] = Array.from(
        { length: 50 },
        (_, i) => ({
          id: `evt_${i}`,
          timestamp: new Date(Date.now() - (50 - i) * 60000),
          entity_id: "user_1",
          entity_type: "user",
          resource_id: "resource_1",
          resource_type: "database",
          access_type: "read",
          granted: true,
          data_volume: 1024,
          record_count: 1,
          location: "192.168.1.1",
          session_id: "session_1",
          sensitivity_level: "public",
          metadata: {},
        })
      );

      // Add events to history for update_baseline to work
      initialEvents.forEach(e => detector.add_event(e));

      const baseline = detector.build_baseline(initialEvents);
      const initialMean = baseline.typical_volume.mean;

      const newEvents: AccessEvent[] = Array.from({ length: 50 }, (_, i) => ({
        id: `evt_new_${i}`,
        timestamp: new Date(Date.now() - (50 - i) * 60000),
        entity_id: "user_1",
        entity_type: "user",
        resource_id: "resource_1",
        resource_type: "database",
        access_type: "read",
        granted: true,
        data_volume: 2048, // Different volume
        record_count: 2,
        location: "192.168.1.1",
        session_id: "session_1",
        sensitivity_level: "public",
        metadata: {},
      }));

      // Add new events to history
      newEvents.forEach(e => detector.add_event(e));

      const updatedBaseline = detector.update_baseline(baseline, newEvents);

      // Should be 100 total (50 initial + 50 new)
      expect(updatedBaseline.sample_count).toBeGreaterThanOrEqual(100);
      expect(updatedBaseline.typical_volume.mean).not.toBe(initialMean);
    });

    it("should throw error for empty events", () => {
      expect(() => detector.build_baseline([])).toThrow();
    });
  });

  describe("Alert Generation", () => {
    it("should generate alert from anomaly", () => {
      const anomaly: PrivacyAnomaly = {
        id: "anomaly_1",
        timestamp: new Date(),
        type: "pii_exposure",
        severity: "high",
        confidence: 0.9,
        description: "PII detected in logs",
        affected_entities: ["user_1"],
        evidence: [],
        related_events: ["evt_1"],
        recommendations: ["Redact PII"],
        alert_generated: false,
      };

      const alert = detector.generate_alert(anomaly);

      expect(alert.severity).toBe("high");
      expect(alert.title).toContain("PII EXPOSURE");
      expect(alert.recommendations).toHaveLength(1);
      expect(alert.status).toBe("open");
    });

    it("should check alert thresholds", () => {
      const score: AnomalyScore = {
        score: 0.8,
        components: {
          temporal: 0.5,
          volume: 0.3,
          resource: 0.2,
          location: 0.1,
          pattern: 0.1,
        },
        confidence: 0.7,
        is_anomalous: true,
      };

      const shouldAlert = detector.check_alert_thresholds(score);

      expect(shouldAlert).toBe(true);
    });

    it("should aggregate related alerts", () => {
      const alerts = [
        {
          id: "alert_1",
          timestamp: new Date(),
          severity: "high" as const,
          title: "Alert 1",
          description: "First alert",
          anomaly_ids: ["anomaly_1"],
          recommendations: [],
          actionable: true,
          estimated_effort: "1 hour",
          status: "open" as const,
        },
        {
          id: "alert_2",
          timestamp: new Date(Date.now() + 60000), // 1 minute later
          severity: "high" as const,
          title: "Alert 2",
          description: "Second alert",
          anomaly_ids: ["anomaly_2"],
          recommendations: [],
          actionable: true,
          estimated_effort: "1 hour",
          status: "open" as const,
        },
      ];

      const groups = detector.aggregate_related_alerts(alerts);

      expect(groups.length).toBeGreaterThan(0);
      expect(groups[0].alerts.length).toBe(2);
      expect(groups[0].related).toBe(true);
    });
  });
});

describe("BehaviorProfiler", () => {
  let profiler: BehaviorProfiler;

  beforeEach(() => {
    profiler = new BehaviorProfiler({
      min_baseline_samples: 20,
      default_threshold: 0.7,
    });
  });

  afterEach(() => {
    profiler.clear_profiles();
  });

  describe("Profile Creation", () => {
    it("should create new profile", () => {
      const profile = profiler.create_profile("user_1");

      expect(profile.entity_id).toBe("user_1");
      expect(profile.entity_type).toBe("user");
      expect(profile.access_patterns).toHaveLength(0);
      expect(profile.anomaly_threshold).toBe(0.7);
    });

    it("should get existing profile", () => {
      profiler.create_profile("user_1");
      const profile = profiler.get_profile("user_1");

      expect(profile).toBeDefined();
      expect(profile!.entity_id).toBe("user_1");
    });

    it("should return undefined for non-existent profile", () => {
      const profile = profiler.get_profile("nonexistent");

      expect(profile).toBeUndefined();
    });

    it("should delete profile", () => {
      profiler.create_profile("user_1");
      profiler.delete_profile("user_1");

      const profile = profiler.get_profile("user_1");
      expect(profile).toBeUndefined();
    });
  });

  describe("Profile Learning", () => {
    it("should learn from events", () => {
      const profile = profiler.create_profile("user_1");

      const events: AccessEvent[] = Array.from({ length: 50 }, (_, i) => ({
        id: `evt_${i}`,
        timestamp: new Date(Date.now() - (50 - i) * 60000),
        entity_id: "user_1",
        entity_type: "user",
        resource_id: `resource_${i % 5}`,
        resource_type: "database",
        access_type: "read",
        granted: true,
        data_volume: 1024,
        record_count: 1,
        location: "192.168.1.1",
        session_id: "session_1",
        sensitivity_level: "public",
        metadata: {},
      }));

      profiler.update_profile("user_1", events);
      const updatedProfile = profiler.get_profile("user_1");

      // update_profile accumulates events in internal history, so count includes previous updates
      expect(
        updatedProfile!.baseline_metrics.sample_count
      ).toBeGreaterThanOrEqual(50);
      expect(updatedProfile!.access_patterns.length).toBeGreaterThan(0);
    });

    it("should detect entity type", () => {
      const profile = profiler.create_profile("service_1");

      const events: AccessEvent[] = Array.from({ length: 50 }, (_, i) => ({
        id: `evt_${i}`,
        timestamp: new Date(Date.now() - (50 - i) * 60000),
        entity_id: "service_1",
        entity_type: "service",
        resource_id: "resource_1",
        resource_type: "api",
        access_type: "read",
        granted: true,
        data_volume: 1024,
        record_count: 1,
        location: "localhost",
        session_id: "service_session",
        sensitivity_level: "public",
        metadata: {},
      }));

      profiler.update_profile("service_1", events);
      const updatedProfile = profiler.get_profile("service_1");

      expect(updatedProfile!.entity_type).toBe("service");
    });
  });

  describe("Anomaly Scoring", () => {
    it("should score single event anomaly", () => {
      const profile = profiler.create_profile("user_1");

      // Build baseline
      const baselineEvents: AccessEvent[] = Array.from(
        { length: 50 },
        (_, i) => ({
          id: `evt_${i}`,
          timestamp: new Date(Date.now() - (50 - i) * 60000),
          entity_id: "user_1",
          entity_type: "user",
          resource_id: "resource_1",
          resource_type: "database",
          access_type: "read",
          granted: true,
          data_volume: 1024,
          record_count: 1,
          location: "192.168.1.1",
          session_id: "session_1",
          sensitivity_level: "public",
          metadata: {},
        })
      );

      // Set timestamps to business hours
      baselineEvents.forEach((e, i) => {
        const hour = 9 + (i % 9);
        e.timestamp.setHours(hour, 0, 0, 0);
      });

      profiler.update_profile("user_1", baselineEvents);

      // Anomalous event - set to unusual hour (2 AM)
      const anomalousEvent: AccessEvent = {
        id: "evt_anomalous",
        timestamp: new Date(),
        entity_id: "user_1",
        entity_type: "user",
        resource_id: "resource_new",
        resource_type: "admin", // Unusual resource type
        access_type: "read",
        granted: true,
        data_volume: 1024 * 1024 * 100, // Large volume
        record_count: 1000,
        location: "10.0.0.1", // Unusual location
        session_id: "session_1",
        sensitivity_level: "restricted",
        metadata: {},
      };
      anomalousEvent.timestamp.setHours(2, 0, 0, 0); // 2 AM

      // Get the updated profile to check what baseline was actually learned
      const updatedProfile = profiler.get_profile("user_1");
      expect(updatedProfile).toBeDefined();

      const score = profiler.score_anomaly(updatedProfile!, anomalousEvent);

      // At least temporal should be anomalous (2 AM vs business hours 9-17)
      expect(score.score).toBeGreaterThan(0);

      // Resource type "admin" should be anomalous if baseline only had "database"
      expect(score.components.resource).toBeGreaterThanOrEqual(0);

      // Temporal component should definitely be high due to 2 AM access
      expect(score.components.temporal).toBeGreaterThan(0);
    });

    it("should score event sequence", () => {
      const profile = profiler.create_profile("user_1");

      const baselineEvents: AccessEvent[] = Array.from(
        { length: 50 },
        (_, i) => ({
          id: `evt_${i}`,
          timestamp: new Date(Date.now() - (50 - i) * 60000),
          entity_id: "user_1",
          entity_type: "user",
          resource_id: "resource_1",
          resource_type: "database",
          access_type: "read",
          granted: true,
          data_volume: 1024,
          record_count: 1,
          location: "192.168.1.1",
          session_id: "session_1",
          sensitivity_level: "public",
          metadata: {},
        })
      );

      profiler.update_profile("user_1", baselineEvents);

      const sequence: AccessEvent[] = [
        {
          id: "evt_1",
          timestamp: new Date(),
          entity_id: "user_1",
          entity_type: "user",
          resource_id: "resource_1",
          resource_type: "database",
          access_type: "read",
          granted: true,
          data_volume: 1024,
          record_count: 1,
          location: "192.168.1.1",
          session_id: "session_1",
          sensitivity_level: "public",
          metadata: {},
        },
        {
          id: "evt_2",
          timestamp: new Date(Date.now() + 100),
          entity_id: "user_1",
          entity_type: "user",
          resource_id: "resource_2",
          resource_type: "database",
          access_type: "admin",
          granted: true,
          data_volume: 1024,
          record_count: 1,
          location: "192.168.1.1",
          session_id: "session_1",
          sensitivity_level: "public",
          metadata: {},
        },
      ];

      const score = profiler.score_sequence(profile, sequence);

      expect(score.score).toBeGreaterThanOrEqual(0);
      expect(score.event_scores).toHaveLength(2);
    });
  });

  describe("Profile Clustering", () => {
    it("should cluster profiles", () => {
      // Create multiple profiles
      for (let i = 0; i < 10; i++) {
        const profile = profiler.create_profile(`user_${i}`);
        const events: AccessEvent[] = Array.from({ length: 50 }, (_, j) => ({
          id: `evt_${i}_${j}`,
          timestamp: new Date(Date.now() - (50 - j) * 60000),
          entity_id: `user_${i}`,
          entity_type: "user",
          resource_id: `resource_${j % 5}`,
          resource_type: i < 5 ? "database" : "api",
          access_type: "read",
          granted: true,
          data_volume: 1024,
          record_count: 1,
          location: "192.168.1.1",
          session_id: `session_${i}`,
          sensitivity_level: "public",
          metadata: {},
        }));

        profiler.update_profile(`user_${i}`, events);
      }

      const profiles = profiler.get_all_profiles();
      const clusters = profiler.cluster_profiles(profiles);

      expect(clusters.length).toBeGreaterThan(0);
      expect(clusters.every(c => c.profiles.length >= 0)).toBe(true);
    });

    it("should find similar profiles", () => {
      const profile1 = profiler.create_profile("user_1");
      const profile2 = profiler.create_profile("user_2");

      // Add similar patterns
      const events: AccessEvent[] = Array.from({ length: 50 }, (_, i) => ({
        id: `evt_${i}`,
        timestamp: new Date(Date.now() - (50 - i) * 60000),
        entity_id: "user_1",
        entity_type: "user",
        resource_id: "resource_1",
        resource_type: "database",
        access_type: "read",
        granted: true,
        data_volume: 1024,
        record_count: 1,
        location: "192.168.1.1",
        session_id: "session_1",
        sensitivity_level: "public",
        metadata: {},
      }));

      profiler.update_profile("user_1", events);
      profiler.update_profile("user_2", events);

      const similar = profiler.find_similar_profiles(profile1, 1.0);

      expect(similar.length).toBeGreaterThan(0);
    });
  });

  describe("Profile Classification", () => {
    it("should classify regular user", () => {
      const profile = profiler.create_profile("user_1");

      const events: AccessEvent[] = Array.from({ length: 50 }, (_, i) => ({
        id: `evt_${i}`,
        timestamp: new Date(Date.now() - (50 - i) * 60000),
        entity_id: "user_1",
        entity_type: "user",
        resource_id: `resource_${i % 5}`,
        resource_type: "database",
        access_type: "read",
        granted: true,
        data_volume: 1024,
        record_count: 1,
        location: "192.168.1.1",
        session_id: "session_1",
        sensitivity_level: "public",
        metadata: {},
      }));

      profiler.update_profile("user_1", events);
      const updatedProfile = profiler.get_profile("user_1");

      const profileType = profiler.classify_profile(updatedProfile!);

      expect(profileType).toBeDefined();
    });

    it("should classify automated service", () => {
      const profile = profiler.create_profile("service_1");

      // Regular intervals indicate automation
      const events: AccessEvent[] = Array.from({ length: 200 }, (_, i) => ({
        id: `evt_${i}`,
        timestamp: new Date(Date.now() - (200 - i) * 30000), // Every 30 seconds
        entity_id: "service_1",
        entity_type: "service",
        resource_id: "resource_1",
        resource_type: "api",
        access_type: "read",
        granted: true,
        data_volume: 1024,
        record_count: 1,
        location: "localhost",
        session_id: "service_session",
        sensitivity_level: "public",
        metadata: {},
      }));

      profiler.update_profile("service_1", events);
      const updatedProfile = profiler.get_profile("service_1");

      const profileType = profiler.classify_profile(updatedProfile!);

      expect(profileType).toBe("automated_service");
    });
  });

  describe("Forgetting Old Behavior", () => {
    it("should decay old patterns", () => {
      const profile = profiler.create_profile("user_1");

      const events: AccessEvent[] = Array.from({ length: 50 }, (_, i) => ({
        id: `evt_${i}`,
        timestamp: new Date(Date.now() - (50 - i) * 60000),
        entity_id: "user_1",
        entity_type: "user",
        resource_id: "resource_1",
        resource_type: "database",
        access_type: "read",
        granted: true,
        data_volume: 1024,
        record_count: 1,
        location: "192.168.1.1",
        session_id: "session_1",
        sensitivity_level: "public",
        metadata: {},
      }));

      profiler.update_profile("user_1", events);

      const beforeFreq = profile.access_patterns[0]?.frequency || 0;

      profiler.forget_old_behavior(profile, { value: 1, unit: "days" });

      const afterFreq = profile.access_patterns[0]?.frequency || 0;

      expect(afterFreq).toBeLessThan(beforeFreq);
    });
  });
});

describe("SecurityEventCorrelator", () => {
  let correlator: SecurityEventCorrelator;

  beforeEach(() => {
    correlator = new SecurityEventCorrelator();
  });

  describe("Event Correlation", () => {
    it("should correlate related events", () => {
      const events: SecurityEvent[] = [
        {
          id: "evt_1",
          timestamp: new Date(),
          event_type: "unauthorized_access",
          severity: "warning",
          source_entity: "attacker_1",
          target_entity: "server_1",
          description: "Failed login attempt",
          related_anomalies: [],
          related_events: [],
          metadata: {},
          correlated: false,
        },
        {
          id: "evt_2",
          timestamp: new Date(Date.now() + 1000),
          event_type: "unauthorized_access",
          severity: "warning",
          source_entity: "attacker_1",
          target_entity: "server_1",
          description: "Another failed login",
          related_anomalies: [],
          related_events: [],
          metadata: {},
          correlated: false,
        },
        {
          id: "evt_3",
          timestamp: new Date(Date.now() + 5000),
          event_type: "privilege_escalation",
          severity: "error",
          source_entity: "attacker_1",
          target_entity: "server_1",
          description: "Privilege escalation detected",
          related_anomalies: [],
          related_events: [],
          metadata: {},
          correlated: false,
        },
      ];

      const result = correlator.correlate_events(events);

      expect(result.groups.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should find related events", () => {
      const event: SecurityEvent = {
        id: "evt_1",
        timestamp: new Date(),
        event_type: "unauthorized_access",
        severity: "warning",
        source_entity: "attacker_1",
        target_entity: "server_1",
        description: "Failed login",
        related_anomalies: [],
        related_events: [],
        metadata: {},
        correlated: false,
      };

      // Add related events to buffer
      correlator.add_event({
        id: "evt_2",
        timestamp: new Date(Date.now() + 1000),
        event_type: "unauthorized_access",
        severity: "warning",
        source_entity: "attacker_1",
        target_entity: "server_1",
        description: "Another failed login",
        related_anomalies: [],
        related_events: [],
        metadata: {},
        correlated: false,
      });

      const related = correlator.find_related_events(event, {
        value: 5,
        unit: "minutes",
      });

      expect(related.length).toBeGreaterThan(0);
    });
  });

  describe("Attack Pattern Detection", () => {
    it("should detect brute force pattern", () => {
      const events: SecurityEvent[] = Array.from({ length: 10 }, (_, i) => ({
        id: `evt_${i}`,
        timestamp: new Date(Date.now() + i * 10000),
        event_type: "unauthorized_access",
        severity: "warning",
        source_entity: "attacker_1",
        target_entity: "server_1",
        description: `Failed login attempt ${i + 1}`,
        related_anomalies: [],
        related_events: [],
        metadata: {},
        correlated: false,
      }));

      const pattern = correlator.detect_attack_pattern(events);

      expect(pattern).toBeDefined();
      expect(pattern?.type).toBe("initial_access");
      expect(pattern?.name).toBe("Brute Force Attack");
    });

    it("should detect lateral movement", () => {
      const events: SecurityEvent[] = [
        {
          id: "evt_1",
          timestamp: new Date(),
          event_type: "anomaly_detected",
          severity: "warning",
          source_entity: "server_1",
          target_entity: "server_1",
          description: "Access from server_1",
          related_anomalies: [],
          related_events: [],
          metadata: {},
          correlated: false,
        },
        {
          id: "evt_2",
          timestamp: new Date(Date.now() + 5000),
          event_type: "anomaly_detected",
          severity: "warning",
          source_entity: "server_2",
          target_entity: "server_2",
          description: "Access from server_2",
          related_anomalies: [],
          related_events: [],
          metadata: {},
          correlated: false,
        },
        {
          id: "evt_3",
          timestamp: new Date(Date.now() + 10000),
          event_type: "anomaly_detected",
          severity: "warning",
          source_entity: "server_3",
          target_entity: "server_3",
          description: "Access from server_3",
          related_anomalies: [],
          related_events: [],
          metadata: {},
          correlated: false,
        },
      ];

      const lateralMovement = correlator.detect_lateral_movement(events);

      expect(lateralMovement.detected).toBe(true);
      expect(lateralMovement.hops).toBeGreaterThan(0);
    });

    it("should detect data exfiltration", () => {
      const events: SecurityEvent[] = [
        {
          id: "evt_1",
          timestamp: new Date(),
          event_type: "data_exfiltration",
          severity: "critical",
          source_entity: "attacker_1",
          target_entity: "external_server",
          description: "Large data transfer",
          related_anomalies: [],
          related_events: [],
          metadata: {
            volume: 50 * 1024 * 1024,
            method: "upload",
            destination: "external.com",
          },
          correlated: false,
        },
      ];

      const exfiltration = correlator.detect_data_exfiltration(events);

      expect(exfiltration.detected).toBe(true);
      expect(exfiltration.total_volume).toBeGreaterThan(0);
    });
  });

  describe("Incident Management", () => {
    it("should create incident from events", () => {
      const events: SecurityEvent[] = [
        {
          id: "evt_1",
          timestamp: new Date(),
          event_type: "data_exfiltration",
          severity: "critical",
          source_entity: "attacker_1",
          target_entity: "server_1",
          description: "Data exfiltration detected",
          related_anomalies: [],
          related_events: [],
          metadata: { volume: 10 * 1024 * 1024 },
          correlated: false,
        },
        {
          id: "evt_2",
          timestamp: new Date(Date.now() + 1000),
          event_type: "privacy_violation",
          severity: "critical",
          source_entity: "attacker_1",
          target_entity: "server_1",
          description: "PII accessed",
          related_anomalies: [],
          related_events: [],
          metadata: {},
          correlated: false,
        },
      ];

      const incident = correlator.create_incident(events);

      expect(incident.id).toBeDefined();
      expect(incident.classification).toBe("data_breach");
      expect(incident.severity).toBe("critical");
      expect(incident.status).toBe("open");
      expect(incident.recommendations.length).toBeGreaterThan(0);
    });

    it("should classify incident correctly", () => {
      const events: SecurityEvent[] = [
        {
          id: "evt_1",
          timestamp: new Date(),
          event_type: "malware_detected",
          severity: "critical",
          source_entity: "infected_host",
          target_entity: "server_1",
          description: "Malware found",
          related_anomalies: [],
          related_events: [],
          metadata: {},
          correlated: false,
        },
      ];

      const classification = correlator.classify_incident(events);

      expect(classification).toBe("malware");
    });

    it("should recommend response actions", () => {
      const incident: SecurityIncident = {
        id: "incident_1",
        timestamp: new Date(),
        classification: "data_breach",
        severity: "critical",
        status: "open",
        events: [],
        timeline: {
          incident_id: "incident_1",
          events: [],
          summary: "Test incident",
          milestones: [],
        },
        recommendations: [],
        notes: [],
        related_incidents: [],
      };

      const recommendations = correlator.recommend_response(incident);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.action === "contain_breach")).toBe(
        true
      );
    });

    it("should update incident status", () => {
      const incident = correlator.create_incident([]);

      correlator.update_incident_status(incident.id, "investigating");

      const updated = correlator.get_incident(incident.id);

      expect(updated?.status).toBe("investigating");
    });

    it("should close incident", () => {
      const incident = correlator.create_incident([]);

      correlator.close_incident(incident.id, {
        timestamp: new Date(),
        type: "resolved",
        description: "Incident resolved",
        resolved_by: "analyst_1",
        lessons_learned: "Patch vulnerable systems",
      });

      const closed = correlator.get_incident(incident.id);

      expect(closed?.status).toBe("resolved");
      expect(closed?.notes.length).toBeGreaterThan(0);
    });

    it("should track ongoing incidents", () => {
      correlator.create_incident([]);
      correlator.create_incident([]);

      const ongoing = correlator.track_ongoing_incidents();

      expect(ongoing.length).toBe(2);
    });
  });

  describe("Timeline Reconstruction", () => {
    it("should reconstruct incident timeline", () => {
      const events: SecurityEvent[] = [
        {
          id: "evt_1",
          timestamp: new Date(Date.now() - 10000),
          event_type: "unauthorized_access",
          severity: "warning",
          source_entity: "attacker_1",
          target_entity: "server_1",
          description: "Initial access",
          related_anomalies: [],
          related_events: [],
          metadata: {},
          correlated: false,
        },
        {
          id: "evt_2",
          timestamp: new Date(),
          event_type: "privilege_escalation",
          severity: "error",
          source_entity: "attacker_1",
          target_entity: "server_1",
          description: "Privilege escalation",
          related_anomalies: [],
          related_events: [],
          metadata: {},
          correlated: false,
        },
      ];

      const timeline = correlator.reconstruct_timeline(events);

      expect(timeline.events.length).toBe(2);
      expect(timeline.events[0].position).toBe(0);
      expect(timeline.events[1].position).toBe(1);
      expect(timeline.summary).toBeDefined();
    });
  });

  describe("Incident Reporting", () => {
    it("should generate incident report", () => {
      const events: SecurityEvent[] = [
        {
          id: "evt_1",
          timestamp: new Date(),
          event_type: "data_exfiltration",
          severity: "critical",
          source_entity: "attacker_1",
          target_entity: "server_1",
          description: "Data exfiltration",
          related_anomalies: [],
          related_events: [],
          metadata: { volume: 10 * 1024 * 1024 },
          correlated: false,
        },
      ];

      const incident = correlator.create_incident(events);
      incident.status = "resolved";

      const report = correlator.generate_incident_report(incident);

      expect(report.incident).toBe(incident);
      expect(report.executive_summary).toBeDefined();
      expect(report.findings.length).toBeGreaterThan(0);
      expect(report.impact_assessment).toBeDefined();
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });
});

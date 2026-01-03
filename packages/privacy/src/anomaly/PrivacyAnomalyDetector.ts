/**
 * PrivacyAnomalyDetector - Detect privacy violations and security anomalies
 *
 * This component detects potential privacy breaches and suspicious patterns
 * in data access, including PII exposure, unauthorized access, data
 * exfiltration, and unusual access patterns.
 *
 * Features:
 * - PII exposure detection in logs, errors, responses
 * - Unauthorized access detection
 * - Data exfiltration detection
 * - Mass access detection
 * - Behavioral anomaly detection
 * - ML-based baseline learning
 * - Alert generation with recommendations
 *
 * @packageDocumentation
 */

import { randomBytes } from "crypto";

/**
 * Access event for monitoring
 */
export interface AccessEvent {
  /** Unique event identifier */
  id: string;
  /** Timestamp when event occurred */
  timestamp: Date;
  /** Entity performing the access */
  entity_id: string;
  /** Entity type */
  entity_type: "user" | "service" | "system";
  /** Resource being accessed */
  resource_id: string;
  /** Resource type */
  resource_type: string;
  /** Access type */
  access_type: "read" | "write" | "delete" | "admin";
  /** Whether access was granted */
  granted: boolean;
  /** Data volume accessed (bytes) */
  data_volume: number;
  /** Number of records accessed */
  record_count: number;
  /** IP address or location */
  location: string;
  /** Session identifier */
  session_id: string;
  /** PII types present in data */
  pii_types?: string[];
  /** Data sensitivity level */
  sensitivity_level: "public" | "internal" | "confidential" | "restricted";
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Privacy anomaly
 */
export interface PrivacyAnomaly {
  /** Unique anomaly identifier */
  id: string;
  /** Timestamp when anomaly was detected */
  timestamp: Date;
  /** Type of anomaly */
  type: AnomalyType;
  /** Severity level */
  severity: AnomalySeverity;
  /** Confidence score (0-1) */
  confidence: number;
  /** Human-readable description */
  description: string;
  /** Affected entities */
  affected_entities: string[];
  /** Evidence supporting the anomaly */
  evidence: Evidence[];
  /** Related event IDs */
  related_events: string[];
  /** Recommended actions */
  recommendations: string[];
  /** Whether alert was generated */
  alert_generated: boolean;
}

/**
 * Anomaly types
 */
export type AnomalyType =
  | "pii_exposure"
  | "unauthorized_access"
  | "data_exfiltration"
  | "mass_access"
  | "unusual_pattern"
  | "privilege_escalation"
  | "policy_violation"
  | "temporal_anomaly"
  | "volume_anomaly";

/**
 * Anomaly severity levels
 */
export type AnomalySeverity = "low" | "medium" | "high" | "critical";

/**
 * Evidence supporting an anomaly
 */
export interface Evidence {
  /** Evidence type */
  type: string;
  /** Evidence description */
  description: string;
  /** Evidence value */
  value: unknown;
  /** Timestamp of evidence */
  timestamp: Date;
  /** Confidence in this evidence */
  confidence: number;
}

/**
 * Pattern anomaly
 */
export interface PatternAnomaly {
  /** Whether pattern is anomalous */
  is_anomalous: boolean;
  /** Anomaly score */
  score: number;
  /** Pattern description */
  description: string;
  /** Deviations from normal */
  deviations: PatternDeviation[];
}

/**
 * Pattern deviation
 */
export interface PatternDeviation {
  /** Deviation type */
  type: string;
  /** Expected value */
  expected: number;
  /** Observed value */
  observed: number;
  /** Deviation magnitude */
  magnitude: number;
}

/**
 * Temporal anomaly
 */
export interface TemporalAnomaly {
  /** Whether timing is anomalous */
  is_anomalous: boolean;
  /** Anomaly score */
  score: number;
  /** Expected time window */
  expected_window: { start: number; end: number };
  /** Actual time */
  actual_time: number;
  /** Hours outside normal window */
  hours_outside: number;
}

/**
 * Volume anomaly
 */
export interface VolumeAnomaly {
  /** Whether volume is anomalous */
  is_anomalous: boolean;
  /** Anomaly score */
  score: number;
  /** Expected volume range */
  expected_range: { min: number; max: number };
  /** Actual volume */
  actual_volume: number;
  /** Multiple of expected */
  multiple_of_expected: number;
}

/**
 * Behavior baseline
 */
export interface BehaviorBaseline {
  /** Entity ID */
  entity_id: string;
  /** When baseline was created */
  created_at: Date;
  /** Number of samples used */
  sample_count: number;
  /** Typical access frequency per hour */
  access_frequency: number;
  /** Typical data volume per access */
  typical_volume: { mean: number; std_dev: number };
  /** Typical record count per access */
  typical_records: { mean: number; std_dev: number };
  /** Typical access hours (0-23) */
  typical_hours: number[];
  /** Typical resources accessed */
  typical_resources: string[];
  /** Typical locations */
  typical_locations: string[];
  /** Access patterns */
  patterns: Map<string, number>;
}

/**
 * Anomaly score
 */
export interface AnomalyScore {
  /** Overall score (0-1, higher = more anomalous) */
  score: number;
  /** Component scores */
  components: {
    /** Temporal anomaly score */
    temporal: number;
    /** Volume anomaly score */
    volume: number;
    /** Resource anomaly score */
    resource: number;
    /** Location anomaly score */
    location: number;
    /** Pattern anomaly score */
    pattern: number;
  };
  /** Confidence in the score */
  confidence: number;
  /** Whether score exceeds threshold */
  is_anomalous: boolean;
}

/**
 * Privacy alert
 */
export interface PrivacyAlert {
  /** Unique alert identifier */
  id: string;
  /** Timestamp when alert was generated */
  timestamp: Date;
  /** Alert severity */
  severity: AnomalySeverity;
  /** Alert title */
  title: string;
  /** Alert description */
  description: string;
  /** Related anomaly IDs */
  anomaly_ids: string[];
  /** Recommended actions */
  recommendations: Recommendation[];
  /** Whether alert is actionable */
  actionable: boolean;
  /** Estimated effort to resolve */
  estimated_effort: string;
  /** Alert status */
  status: "open" | "investigating" | "resolved" | "false_positive";
}

/**
 * Recommendation
 */
export interface Recommendation {
  /** Priority (1-10, higher = more urgent) */
  priority: number;
  /** Action to take */
  action: string;
  /** Action description */
  description: string;
  /** Whether action can be automated */
  automated: boolean;
  /** Estimated effort */
  estimated_effort: string;
}

/**
 * Alert group
 */
export interface AlertGroup {
  /** Group identifier */
  id: string;
  /** Alerts in the group */
  alerts: PrivacyAlert[];
  /** Group description */
  description: string;
  /** Combined severity */
  severity: AnomalySeverity;
  /** Whether alerts are related */
  related: boolean;
  /** Related entity IDs */
  entity_ids: string[];
}

/**
 * Anomaly detector configuration
 */
export interface AnomalyDetectorConfig {
  /** Threshold for anomaly detection (0-1) */
  anomaly_threshold?: number;
  /** Minimum confidence for alerts (0-1) */
  min_alert_confidence?: number;
  /** Window size for baseline learning (events) */
  baseline_window?: number;
  /** Minimum samples for baseline */
  min_baseline_samples?: number;
  /** Mass access threshold (records/minute) */
  mass_access_threshold?: number;
  /** Exfiltration volume threshold (bytes) */
  exfiltration_threshold?: number;
  /** Enable ML-based detection */
  enable_ml_detection?: boolean;
  /** Alert aggregation window (ms) */
  alert_aggregation_window?: number;
  /** PII patterns to detect */
  pii_patterns?: RegExp[];
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<AnomalyDetectorConfig> = {
  anomaly_threshold: 0.7,
  min_alert_confidence: 0.6,
  baseline_window: 1000,
  min_baseline_samples: 50,
  mass_access_threshold: 100, // records per minute
  exfiltration_threshold: 10 * 1024 * 1024, // 10 MB
  enable_ml_detection: true,
  alert_aggregation_window: 5 * 60 * 1000, // 5 minutes
  pii_patterns: [
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
    /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, // Credit card
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // Phone
    /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, // IP address
  ],
};

/**
 * PrivacyAnomalyDetector - Detect privacy violations and anomalies
 *
 * The detector monitors access events and identifies potential privacy
 * violations including PII exposure, unauthorized access, data exfiltration,
 * mass access, and unusual patterns.
 */
export class PrivacyAnomalyDetector {
  private config: Required<AnomalyDetectorConfig>;
  private baselines: Map<string, BehaviorBaseline>;
  private alerts: PrivacyAlert[];
  private eventHistory: AccessEvent[];

  constructor(config: AnomalyDetectorConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.baselines = new Map();
    this.alerts = [];
    this.eventHistory = [];
  }

  /**
   * Detect PII exposure in event data
   *
   * Scans event data for potential PII using pattern matching.
   *
   * @param event - Access event to check
   * @returns Detected PII exposure anomalies
   */
  detect_pii_exposure(event: AccessEvent): PrivacyAnomaly[] {
    const anomalies: PrivacyAnomaly[] = [];

    // Check metadata for potential PII
    const metadata = JSON.stringify(event.metadata);
    const foundPatterns: Array<{ pattern: string; matches: string[] }> = [];

    for (const pattern of this.config.pii_patterns) {
      const matches = metadata.match(pattern);
      if (matches) {
        foundPatterns.push({
          pattern: pattern.source,
          matches: Array.from(new Set(matches)).slice(0, 5), // Limit to 5 examples
        });
      }
    }

    if (foundPatterns.length > 0) {
      anomalies.push({
        id: this.generateId(),
        timestamp: new Date(),
        type: "pii_exposure",
        severity: "high",
        confidence: 0.8,
        description: `PII detected in ${foundPatterns.length} pattern(s) in event metadata`,
        affected_entities: [event.entity_id, event.resource_id],
        evidence: foundPatterns.map(fp => ({
          type: "pii_pattern_match",
          description: `Pattern ${fp.pattern} matched`,
          value: { matches: fp.matches },
          timestamp: event.timestamp,
          confidence: 0.8,
        })),
        related_events: [event.id],
        recommendations: [
          "Redact PII from logs and metadata",
          "Review data handling procedures",
          "Implement automatic PII redaction",
        ],
        alert_generated: false,
      });
    }

    // Check if PII types are present in sensitive contexts
    if (event.pii_types && event.pii_types.length > 0) {
      const sensitiveContexts = ["error", "exception", "log", "debug"];
      const isInSensitiveContext = sensitiveContexts.some(ctx =>
        event.metadata.context?.toString().includes(ctx)
      );

      if (isInSensitiveContext) {
        anomalies.push({
          id: this.generateId(),
          timestamp: new Date(),
          type: "pii_exposure",
          severity: "critical",
          confidence: 0.9,
          description: `PII types [${event.pii_types.join(", ")}] present in sensitive context`,
          affected_entities: [event.entity_id],
          evidence: [
            {
              type: "pii_in_sensitive_context",
              description: "PII found in error/log context",
              value: {
                pii_types: event.pii_types,
                context: event.metadata.context,
              },
              timestamp: event.timestamp,
              confidence: 0.9,
            },
          ],
          related_events: [event.id],
          recommendations: ["Immediately remove PII from this context"],
          alert_generated: false,
        });
      }
    }

    return anomalies;
  }

  /**
   * Detect unauthorized access
   *
   * Checks if access was denied and patterns of failed access attempts.
   *
   * @param event - Access event to check
   * @returns Detected unauthorized access anomalies
   */
  detect_unauthorized_access(event: AccessEvent): PrivacyAnomaly[] {
    const anomalies: PrivacyAnomaly[] = [];

    // Check for denied access
    if (!event.granted) {
      const severity =
        event.access_type === "admin" ||
        event.sensitivity_level === "restricted"
          ? "critical"
          : "high";

      anomalies.push({
        id: this.generateId(),
        timestamp: new Date(),
        type: "unauthorized_access",
        severity,
        confidence: 0.95,
        description: `Unauthorized ${event.access_type} access attempt to ${event.resource_type} '${event.resource_id}'`,
        affected_entities: [event.entity_id, event.resource_id],
        evidence: [
          {
            type: "denied_access",
            description: "Access was denied",
            value: {
              entity_type: event.entity_type,
              access_type: event.access_type,
              sensitivity_level: event.sensitivity_level,
            },
            timestamp: event.timestamp,
            confidence: 0.95,
          },
        ],
        related_events: [event.id],
        recommendations: [
          "Review entity permissions",
          "Investigate potential security threat",
          severity === "critical"
            ? "Immediate security review required"
            : "Log for monitoring",
        ],
        alert_generated: false,
      });
    }

    // Check for privilege escalation (attempting higher-level access than typical)
    const baseline = this.baselines.get(event.entity_id);
    if (baseline && event.granted) {
      const typicalResources = baseline.typical_resources;
      const isNewResourceType = !typicalResources.includes(event.resource_type);

      if (isNewResourceType && event.sensitivity_level === "restricted") {
        anomalies.push({
          id: this.generateId(),
          timestamp: new Date(),
          type: "privilege_escalation",
          severity: "high",
          confidence: 0.7,
          description: `Entity accessing new restricted resource type: ${event.resource_type}`,
          affected_entities: [event.entity_id],
          evidence: [
            {
              type: "unusual_resource_access",
              description: "First-time access to restricted resource type",
              value: {
                resource_type: event.resource_type,
                typical_resources: typicalResources.slice(0, 5),
              },
              timestamp: event.timestamp,
              confidence: 0.7,
            },
          ],
          related_events: [event.id],
          recommendations: [
            "Verify entity authorization",
            "Review privilege grant process",
            "Consider requiring additional approval",
          ],
          alert_generated: false,
        });
      }
    }

    return anomalies;
  }

  /**
   * Detect data exfiltration
   *
   * Identifies unusually large data transfers and potential exfiltration patterns.
   *
   * @param events - Access events to analyze
   * @returns Detected data exfiltration anomalies
   */
  detect_data_exfiltration(events: AccessEvent[]): PrivacyAnomaly[] {
    const anomalies: PrivacyAnomaly[] = [];

    // Group events by entity
    const eventsByEntity = new Map<string, AccessEvent[]>();
    for (const event of events) {
      if (!eventsByEntity.has(event.entity_id)) {
        eventsByEntity.set(event.entity_id, []);
      }
      eventsByEntity.get(event.entity_id)!.push(event);
    }

    // Check each entity for exfiltration patterns
    for (const [entity_id, entityEvents] of eventsByEntity) {
      // Calculate total volume in time window
      const totalVolume = entityEvents.reduce(
        (sum, e) => sum + e.data_volume,
        0
      );

      if (totalVolume > this.config.exfiltration_threshold) {
        // Check if volume is anomalous compared to baseline
        const baseline = this.baselines.get(entity_id);
        let isAnomalous = true;
        let expectedVolume = this.config.exfiltration_threshold;

        if (baseline) {
          const zScore =
            (totalVolume - baseline.typical_volume.mean) /
            baseline.typical_volume.std_dev;
          isAnomalous = zScore > 3;
          expectedVolume = baseline.typical_volume.mean;
        }

        if (isAnomalous) {
          const multipleOfExpected =
            expectedVolume > 0 ? totalVolume / expectedVolume : totalVolume;

          anomalies.push({
            id: this.generateId(),
            timestamp: new Date(),
            type: "data_exfiltration",
            severity: multipleOfExpected > 10 ? "critical" : "high",
            confidence: Math.min(0.9, 0.5 + multipleOfExpected / 20),
            description: `Potential data exfiltration: ${this.formatBytes(totalVolume)} accessed by ${entity_id}`,
            affected_entities: [entity_id],
            evidence: [
              {
                type: "high_volume_transfer",
                description: "Unusually high data volume accessed",
                value: {
                  total_volume: totalVolume,
                  threshold: this.config.exfiltration_threshold,
                  expected_volume: expectedVolume,
                  multiple_of_expected: multipleOfExpected.toFixed(1),
                  event_count: entityEvents.length,
                },
                timestamp: new Date(),
                confidence: Math.min(0.9, 0.5 + multipleOfExpected / 20),
              },
            ],
            related_events: entityEvents.map(e => e.id),
            recommendations: [
              "Immediate: Verify data transfer authorization",
              "Check destination and recipient",
              "Review recent access patterns",
              "Consider blocking further access if unauthorized",
            ],
            alert_generated: false,
          });
        }
      }

      // Check for access to unusual destination/location combinations
      const uniqueLocations = new Set(entityEvents.map(e => e.location));
      if (uniqueLocations.size > 5) {
        anomalies.push({
          id: this.generateId(),
          timestamp: new Date(),
          type: "unusual_pattern",
          severity: "medium",
          confidence: 0.6,
          description: `Entity accessed data from ${uniqueLocations.size} different locations`,
          affected_entities: [entity_id],
          evidence: [
            {
              type: "multiple_locations",
              description: "Unusual number of access locations",
              value: {
                location_count: uniqueLocations.size,
                locations: Array.from(uniqueLocations).slice(0, 5),
              },
              timestamp: new Date(),
              confidence: 0.6,
            },
          ],
          related_events: entityEvents.map(e => e.id),
          recommendations: [
            "Verify entity location legitimacy",
            "Check for possible account compromise",
            "Review authentication logs",
          ],
          alert_generated: false,
        });
      }
    }

    return anomalies;
  }

  /**
   * Detect mass access patterns
   *
   * Identifies entities accessing many records in a short time period.
   *
   * @param events - Access events to analyze
   * @returns Detected mass access anomalies
   */
  detect_mass_access(events: AccessEvent[]): PrivacyAnomaly[] {
    const anomalies: PrivacyAnomaly[] = [];

    // Group events by minute windows
    const eventsByMinute = new Map<string, AccessEvent[]>();
    for (const event of events) {
      const minuteKey = `${event.entity_id}:${Math.floor(event.timestamp.getTime() / 60000)}`;
      if (!eventsByMinute.has(minuteKey)) {
        eventsByMinute.set(minuteKey, []);
      }
      eventsByMinute.get(minuteKey)!.push(event);
    }

    // Check for mass access in any minute
    for (const [minuteKey, minuteEvents] of eventsByMinute) {
      const totalRecords = minuteEvents.reduce(
        (sum, e) => sum + e.record_count,
        0
      );

      if (totalRecords > this.config.mass_access_threshold) {
        const [entity_id] = minuteKey.split(":");
        const multipleOfThreshold =
          totalRecords / this.config.mass_access_threshold;

        anomalies.push({
          id: this.generateId(),
          timestamp: new Date(),
          type: "mass_access",
          severity:
            totalRecords > this.config.mass_access_threshold * 10
              ? "critical"
              : "high",
          confidence: Math.min(0.95, 0.6 + multipleOfThreshold / 10),
          description: `Mass access detected: ${totalRecords} records accessed in one minute by ${entity_id}`,
          affected_entities: [entity_id],
          evidence: [
            {
              type: "high_record_count",
              description: "Unusually high record access rate",
              value: {
                records_per_minute: totalRecords,
                threshold: this.config.mass_access_threshold,
                multiple_of_threshold: multipleOfThreshold.toFixed(1),
                event_count: minuteEvents.length,
              },
              timestamp: new Date(),
              confidence: Math.min(0.95, 0.6 + multipleOfThreshold / 10),
            },
          ],
          related_events: minuteEvents.map(e => e.id),
          recommendations: [
            "Verify authorization for bulk access",
            "Check if this matches expected business process",
            "Consider rate limiting if unauthorized",
            "Review data retention policies",
          ],
          alert_generated: false,
        });
      }
    }

    // Check for access to many different resources
    const eventsByEntity = new Map<string, AccessEvent[]>();
    for (const event of events) {
      if (!eventsByEntity.has(event.entity_id)) {
        eventsByEntity.set(event.entity_id, []);
      }
      eventsByEntity.get(event.entity_id)!.push(event);
    }

    for (const [entity_id, entityEvents] of eventsByEntity) {
      const uniqueResources = new Set(entityEvents.map(e => e.resource_id));

      if (uniqueResources.size > 50) {
        const baseline = this.baselines.get(entity_id);
        const typicalResourceCount = baseline?.typical_resources.length || 10;
        const multipleOfTypical = uniqueResources.size / typicalResourceCount;

        if (multipleOfTypical > 5) {
          anomalies.push({
            id: this.generateId(),
            timestamp: new Date(),
            type: "mass_access",
            severity: "medium",
            confidence: 0.7,
            description: `Entity accessed ${uniqueResources.size} different resources`,
            affected_entities: [entity_id],
            evidence: [
              {
                type: "resource_scanning",
                description:
                  "Unusually high number of distinct resources accessed",
                value: {
                  resource_count: uniqueResources.size,
                  typical_count: typicalResourceCount,
                  multiple_of_typical: multipleOfTypical.toFixed(1),
                },
                timestamp: new Date(),
                confidence: 0.7,
              },
            ],
            related_events: entityEvents.map(e => e.id),
            recommendations: [
              "Investigate potential reconnaissance activity",
              "Verify if this matches expected behavior",
              "Check for automated scraping",
            ],
            alert_generated: false,
          });
        }
      }
    }

    return anomalies;
  }

  /**
   * Detect access pattern anomalies
   *
   * Compares current access patterns against learned baseline.
   *
   * @param user_id - Entity ID to analyze
   * @param events - Recent access events
   * @returns Pattern anomaly analysis
   */
  detect_access_pattern_anomaly(
    user_id: string,
    events: AccessEvent[]
  ): PatternAnomaly {
    const baseline = this.baselines.get(user_id);

    if (!baseline || events.length === 0) {
      return {
        is_anomalous: false,
        score: 0,
        description: baseline
          ? "No events to analyze"
          : "No baseline available",
        deviations: [],
      };
    }

    const deviations: PatternDeviation[] = [];

    // Check resource type distribution
    const resourceCounts = new Map<string, number>();
    for (const event of events) {
      resourceCounts.set(
        event.resource_type,
        (resourceCounts.get(event.resource_type) || 0) + 1
      );
    }

    // Check for unusual resource access
    for (const [resourceType, count] of resourceCounts) {
      const expectedFreq = baseline.patterns.get(resourceType) || 0;
      const freq = count / events.length;

      if (expectedFreq > 0 && freq > expectedFreq * 3) {
        deviations.push({
          type: "resource_frequency",
          expected: expectedFreq,
          observed: freq,
          magnitude: (freq - expectedFreq) / expectedFreq,
        });
      }
    }

    // Check access distribution
    const hourCounts = new Array(24).fill(0);
    for (const event of events) {
      hourCounts[event.timestamp.getHours()]++;
    }
    const maxHour = hourCounts.indexOf(Math.max(...hourCounts));
    const maxHourFreq = hourCounts[maxHour] / events.length;

    if (maxHourFreq > 0.5 && !baseline.typical_hours.includes(maxHour)) {
      deviations.push({
        type: "temporal_distribution",
        expected: 0,
        observed: maxHourFreq,
        magnitude: maxHourFreq,
      });
    }

    // Calculate overall anomaly score
    const avgDeviation =
      deviations.length > 0
        ? deviations.reduce((sum, d) => sum + d.magnitude, 0) /
          deviations.length
        : 0;

    const isAnomalous = avgDeviation > 2 || deviations.length > 2;

    return {
      is_anomalous: isAnomalous,
      score: Math.min(1, avgDeviation / 5),
      description: isAnomalous
        ? `Detected ${deviations.length} significant pattern deviations`
        : "Access patterns within normal range",
      deviations,
    };
  }

  /**
   * Detect temporal anomalies
   *
   * Checks if access timing deviates from normal patterns.
   *
   * @param events - Access events to analyze
   * @returns Temporal anomaly analysis
   */
  detect_temporal_anomaly(events: AccessEvent[]): TemporalAnomaly {
    if (events.length === 0) {
      return {
        is_anomalous: false,
        score: 0,
        expected_window: { start: 0, end: 24 },
        actual_time: 0,
        hours_outside: 0,
      };
    }

    // Get entity ID from first event
    const entity_id = events[0].entity_id;
    const baseline = this.baselines.get(entity_id);

    if (!baseline || baseline.typical_hours.length === 0) {
      return {
        is_anomalous: false,
        score: 0,
        expected_window: { start: 9, end: 17 },
        actual_time: events[0].timestamp.getHours(),
        hours_outside: 0,
      };
    }

    // Check if events occur outside typical hours
    const minHour = Math.min(...baseline.typical_hours);
    const maxHour = Math.max(...baseline.typical_hours);

    const outsideHours = events.filter(e => {
      const hour = e.timestamp.getHours();
      return hour < minHour || hour > maxHour;
    });

    const hoursOutside = outsideHours.length / events.length;

    return {
      is_anomalous: hoursOutside > 0.5,
      score: Math.min(1, hoursOutside * 2),
      expected_window: { start: minHour, end: maxHour },
      actual_time: events[0].timestamp.getHours(),
      hours_outside: hoursOutside,
    };
  }

  /**
   * Detect volume anomalies
   *
   * Checks if data access volume is unusually high.
   *
   * @param events - Access events to analyze
   * @returns Volume anomaly analysis
   */
  detect_volume_anomaly(events: AccessEvent[]): VolumeAnomaly {
    if (events.length === 0) {
      return {
        is_anomalous: false,
        score: 0,
        expected_range: { min: 0, max: 10000 },
        actual_volume: 0,
        multiple_of_expected: 0,
      };
    }

    const entity_id = events[0].entity_id;
    const baseline = this.baselines.get(entity_id);
    const totalVolume = events.reduce((sum, e) => sum + e.data_volume, 0);
    const avgVolume = totalVolume / events.length;

    if (!baseline) {
      return {
        is_anomalous: false,
        score: 0,
        expected_range: { min: 0, max: 1000000 },
        actual_volume: avgVolume,
        multiple_of_expected: 1,
      };
    }

    const expectedMin =
      baseline.typical_volume.mean - 2 * baseline.typical_volume.std_dev;
    const expectedMax =
      baseline.typical_volume.mean + 2 * baseline.typical_volume.std_dev;
    const multipleOfExpected =
      baseline.typical_volume.mean > 0
        ? avgVolume / baseline.typical_volume.mean
        : 1;

    const isAnomalous = avgVolume > expectedMax || avgVolume < expectedMin;

    return {
      is_anomalous: isAnomalous,
      score: isAnomalous
        ? Math.min(1, Math.abs(multipleOfExpected - 1) / 3)
        : 0,
      expected_range: { min: Math.max(0, expectedMin), max: expectedMax },
      actual_volume: avgVolume,
      multiple_of_expected: multipleOfExpected,
    };
  }

  /**
   * Build behavior baseline from events
   *
   * Learns typical behavior patterns from historical events.
   *
   * @param events - Historical access events
   * @returns Learned behavior baseline
   */
  build_baseline(events: AccessEvent[]): BehaviorBaseline {
    if (events.length === 0) {
      throw new Error("Cannot build baseline from empty events");
    }

    const entity_id = events[0].entity_id;

    // Calculate access frequency
    const timeSpan =
      Math.max(...events.map(e => e.timestamp.getTime())) -
      Math.min(...events.map(e => e.timestamp.getTime()));
    const hours = timeSpan / (1000 * 60 * 60) || 1;
    const accessFrequency = events.length / hours;

    // Calculate volume statistics
    const volumes = events.map(e => e.data_volume);
    const meanVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
    const varianceVolume =
      volumes.reduce((sum, v) => sum + Math.pow(v - meanVolume, 2), 0) /
      volumes.length;
    const stdDevVolume = Math.sqrt(varianceVolume);

    // Calculate record count statistics
    const records = events.map(e => e.record_count);
    const meanRecords = records.reduce((sum, r) => sum + r, 0) / records.length;
    const varianceRecords =
      records.reduce((sum, r) => sum + Math.pow(r - meanRecords, 2), 0) /
      records.length;
    const stdDevRecords = Math.sqrt(varianceRecords);

    // Calculate typical hours
    const hourCounts = new Array(24).fill(0);
    for (const event of events) {
      hourCounts[event.timestamp.getHours()]++;
    }
    const maxCount = Math.max(...hourCounts);
    const typicalHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .filter(hc => hc.count >= maxCount * 0.3)
      .map(hc => hc.hour);

    // Get typical resources
    const resourceCounts = new Map<string, number>();
    for (const event of events) {
      resourceCounts.set(
        event.resource_type,
        (resourceCounts.get(event.resource_type) || 0) + 1
      );
    }
    const typicalResources = Array.from(resourceCounts.entries())
      .filter(([_, count]) => count >= events.length * 0.1)
      .map(([resource, _]) => resource);

    // Get typical locations
    const locationCounts = new Map<string, number>();
    for (const event of events) {
      locationCounts.set(
        event.location,
        (locationCounts.get(event.location) || 0) + 1
      );
    }
    const typicalLocations = Array.from(locationCounts.entries())
      .filter(([_, count]) => count >= events.length * 0.1)
      .map(([location, _]) => location);

    // Build pattern map
    const patterns = new Map<string, number>();
    for (const [resource, count] of resourceCounts) {
      patterns.set(resource, count / events.length);
    }

    return {
      entity_id,
      created_at: new Date(),
      sample_count: events.length,
      access_frequency: accessFrequency,
      typical_volume: { mean: meanVolume, std_dev: stdDevVolume },
      typical_records: { mean: meanRecords, std_dev: stdDevRecords },
      typical_hours: typicalHours,
      typical_resources: typicalResources,
      typical_locations: typicalLocations,
      patterns,
    };
  }

  /**
   * Detect anomaly against baseline
   *
   * Scores a single event against a behavior baseline.
   *
   * @param event - Event to score
   * @param baseline - Behavior baseline
   * @returns Anomaly score
   */
  detect_anomaly_against_baseline(
    event: AccessEvent,
    baseline: BehaviorBaseline
  ): AnomalyScore {
    // Temporal component
    const hour = event.timestamp.getHours();
    const isTypicalHour = baseline.typical_hours.includes(hour);
    const temporalScore = isTypicalHour ? 0 : 0.5;

    // Volume component (z-score)
    const volumeZ =
      baseline.typical_volume.std_dev > 0
        ? Math.abs(
            (event.data_volume - baseline.typical_volume.mean) /
              baseline.typical_volume.std_dev
          )
        : 0;
    const volumeScore = Math.min(1, volumeZ / 3);

    // Resource component
    const resourceScore = baseline.typical_resources.includes(
      event.resource_type
    )
      ? 0
      : 0.4;

    // Location component
    const locationScore = baseline.typical_locations.includes(event.location)
      ? 0
      : 0.3;

    // Pattern component
    const expectedFreq = baseline.patterns.get(event.resource_type) || 0;
    const patternScore = expectedFreq > 0 ? Math.min(1, expectedFreq * 5) : 0.5;

    // Overall score (weighted average)
    const overallScore =
      temporalScore * 0.25 +
      volumeScore * 0.35 +
      resourceScore * 0.2 +
      locationScore * 0.1 +
      patternScore * 0.1;

    return {
      score: overallScore,
      components: {
        temporal: temporalScore,
        volume: volumeScore,
        resource: resourceScore,
        location: locationScore,
        pattern: patternScore,
      },
      confidence:
        baseline.sample_count > this.config.min_baseline_samples ? 0.8 : 0.5,
      is_anomalous: overallScore > this.config.anomaly_threshold,
    };
  }

  /**
   * Update baseline with new events
   *
   * Incrementally updates a behavior baseline.
   *
   * @param baseline - Existing baseline
   * @param new_events - New events to incorporate
   * @returns Updated baseline
   */
  update_baseline(
    baseline: BehaviorBaseline,
    new_events: AccessEvent[]
  ): BehaviorBaseline {
    const allEvents = [
      ...this.eventHistory.filter(e => e.entity_id === baseline.entity_id),
      ...new_events,
    ];

    return this.build_baseline(allEvents);
  }

  /**
   * Generate privacy alert from anomaly
   *
   * Creates an actionable alert from a detected anomaly.
   *
   * @param anomaly - Detected anomaly
   * @returns Privacy alert
   */
  generate_alert(anomaly: PrivacyAnomaly): PrivacyAlert {
    const recommendations: Recommendation[] = anomaly.recommendations.map(
      (rec, i) => ({
        priority:
          anomaly.severity === "critical"
            ? 10
            : anomaly.severity === "high"
              ? 7
              : 5 - i,
        action: rec,
        description: rec,
        automated: false,
        estimated_effort: this.estimateEffort(anomaly.type, anomaly.severity),
      })
    );

    return {
      id: this.generateId(),
      timestamp: new Date(),
      severity: anomaly.severity,
      title: `${anomaly.type.replace(/_/g, " ").toUpperCase()}: ${anomaly.affected_entities.join(", ")}`,
      description: anomaly.description,
      anomaly_ids: [anomaly.id],
      recommendations,
      actionable: true,
      estimated_effort: this.estimateEffort(anomaly.type, anomaly.severity),
      status: "open",
    };
  }

  /**
   * Check if score exceeds alert threshold
   *
   * @param score - Anomaly score
   * @returns Whether to generate alert
   */
  check_alert_thresholds(score: AnomalyScore): boolean {
    return (
      score.is_anomalous && score.confidence >= this.config.min_alert_confidence
    );
  }

  /**
   * Aggregate related alerts
   *
   * Groups related alerts into incident groups.
   *
   * @param alerts - Alerts to aggregate
   * @returns Alert groups
   */
  aggregate_related_alerts(alerts: PrivacyAlert[]): AlertGroup[] {
    const groups: AlertGroup[] = [];
    const processed = new Set<string>();

    for (const alert of alerts) {
      if (processed.has(alert.id)) continue;

      // Find related alerts (within time window and similar entities)
      const relatedAlerts = alerts.filter(a => {
        if (a.id === alert.id) return false;
        const timeDiff = Math.abs(
          a.timestamp.getTime() - alert.timestamp.getTime()
        );
        return timeDiff < this.config.alert_aggregation_window;
      });

      const groupAlerts = [alert, ...relatedAlerts];
      const allEntityIds = new Set(
        groupAlerts.flatMap(
          a =>
            this.alerts
              .find(al => al.id === a.id)
              ?.anomaly_ids.flatMap(anid =>
                this.eventHistory.find(e => e.id === anid)?.entity_id
                  ? [this.eventHistory.find(e => e.id === anid)!.entity_id]
                  : []
              ) || []
        )
      );

      // Determine combined severity
      const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
      const maxSeverity = groupAlerts.reduce((max, a) => {
        return severityOrder[a.severity] > severityOrder[max]
          ? a.severity
          : max;
      }, "low" as AnomalySeverity);

      groups.push({
        id: this.generateId(),
        alerts: groupAlerts,
        description: `${groupAlerts.length} related alert(s) for ${Array.from(allEntityIds).join(", ")}`,
        severity: maxSeverity,
        related: relatedAlerts.length > 0,
        entity_ids: Array.from(allEntityIds),
      });

      groupAlerts.forEach(a => processed.add(a.id));
    }

    return groups;
  }

  /**
   * Store baseline for entity
   *
   * @param baseline - Baseline to store
   */
  set_baseline(baseline: BehaviorBaseline): void {
    this.baselines.set(baseline.entity_id, baseline);
  }

  /**
   * Get baseline for entity
   *
   * @param entity_id - Entity identifier
   * @returns Behavior baseline or undefined
   */
  get_baseline(entity_id: string): BehaviorBaseline | undefined {
    return this.baselines.get(entity_id);
  }

  /**
   * Get all alerts
   *
   * @returns All generated alerts
   */
  get_alerts(): PrivacyAlert[] {
    return [...this.alerts];
  }

  /**
   * Clear all alerts
   */
  clear_alerts(): void {
    this.alerts = [];
  }

  /**
   * Add event to history
   *
   * @param event - Event to add
   */
  add_event(event: AccessEvent): void {
    this.eventHistory.push(event);

    // Keep history manageable
    if (this.eventHistory.length > 10000) {
      this.eventHistory = this.eventHistory.slice(-5000);
    }
  }

  /**
   * Get event history
   *
   * @returns All stored events
   */
  get_events(): AccessEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Clear event history
   */
  clear_events(): void {
    this.eventHistory = [];
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `anomaly_${Date.now()}_${randomBytes(4).toString("hex")}`;
  }

  /**
   * Format bytes for human reading
   */
  private formatBytes(bytes: number): string {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Estimate effort to resolve anomaly
   */
  private estimateEffort(type: AnomalyType, severity: AnomalySeverity): string {
    const baseEffort: Record<AnomalyType, string> = {
      pii_exposure: "2-4 hours",
      unauthorized_access: "1-2 hours",
      data_exfiltration: "4-8 hours",
      mass_access: "1-2 hours",
      unusual_pattern: "2-3 hours",
      privilege_escalation: "3-6 hours",
      policy_violation: "1-3 hours",
      temporal_anomaly: "0.5-1 hour",
      volume_anomaly: "1-2 hours",
    };

    const multiplier =
      severity === "critical" ? 2 : severity === "high" ? 1.5 : 1;
    const [min, max] = baseEffort[type].split(" ").map(v => parseFloat(v));
    return `${(min * multiplier).toFixed(0)}-${(max * multiplier).toFixed(0)} hours`;
  }
}

/**
 * SecurityEventCorrelator - Correlate security events and detect attack patterns
 *
 * This component correlates related security events to detect attack patterns,
 * reconstruct incident timelines, and provide incident response recommendations.
 *
 * Features:
 * - Event correlation by time, entity, and pattern
 * - Attack pattern detection
 * - Lateral movement detection
 * - Data exfiltration detection
 * - Incident classification and response recommendations
 * - Timeline reconstruction
 * - Ongoing incident tracking
 *
 * @packageDocumentation
 */

import { randomBytes } from "crypto";

/**
 * Security event
 */
export interface SecurityEvent {
  /** Unique event identifier */
  id: string;
  /** Timestamp when event occurred */
  timestamp: Date;
  /** Event type */
  event_type: SecurityEventType;
  /** Event severity */
  severity: "info" | "warning" | "error" | "critical";
  /** Source entity */
  source_entity: string;
  /** Target entity/resource */
  target_entity: string;
  /** Event description */
  description: string;
  /** Related anomaly IDs */
  related_anomalies: string[];
  /** Related event IDs */
  related_events: string[];
  /** Event metadata */
  metadata: Record<string, unknown>;
  /** Whether event has been correlated */
  correlated: boolean;
}

/**
 * Security event types
 */
export type SecurityEventType =
  | "privacy_violation"
  | "unauthorized_access"
  | "data_exfiltration"
  | "malware_detected"
  | "suspicious_activity"
  | "privilege_escalation"
  | "brute_force"
  | "dos_attack"
  | "lateral_movement"
  | "policy_violation"
  | "anomaly_detected";

/**
 * Correlation result
 */
export interface CorrelationResult {
  /** Correlated event groups */
  groups: EventGroup[];
  /** Uncorrelated events */
  uncorrelated: SecurityEvent[];
  /** Correlation confidence */
  confidence: number;
  /** Related patterns found */
  patterns_found: AttackPattern[];
}

/**
 * Event group
 */
export interface EventGroup {
  /** Group identifier */
  id: string;
  /** Events in group */
  events: SecurityEvent[];
  /** Group description */
  description: string;
  /** Group severity */
  severity: "info" | "warning" | "error" | "critical";
  /** Related entities */
  entities: string[];
  /** Time range */
  time_range: { start: Date; end: Date };
  /** Whether group forms attack pattern */
  is_attack_pattern: boolean;
}

/**
 * Attack pattern
 */
export interface AttackPattern {
  /** Pattern identifier */
  id: string;
  /** Pattern type */
  type: AttackPatternType;
  /** Pattern name */
  name: string;
  /** Pattern description */
  description: string;
  /** Events in pattern */
  events: SecurityEvent[];
  /** Pattern confidence */
  confidence: number;
  /** Pattern stage (MITRE ATT&CK) */
  stage: string;
  /** Related techniques */
  techniques: string[];
}

/**
 * Attack pattern types
 */
export type AttackPatternType =
  | "initial_access"
  | "execution"
  | "persistence"
  | "privilege_escalation"
  | "defense_evasion"
  | "credential_access"
  | "discovery"
  | "lateral_movement"
  | "collection"
  | "exfiltration"
  | "command_and_control"
  | "impact";

/**
 * Lateral movement pattern
 */
export interface LateralMovementPattern {
  /** Whether lateral movement detected */
  detected: boolean;
  /** Movement path (entity sequence) */
  path: string[];
  /** Movement confidence */
  confidence: number;
  /** Movement duration */
  duration: number; // ms
  /** Number of hops */
  hops: number;
  /** Movement method */
  method:
    | "pass_the_hash"
    | "credential_reuse"
    | "exploitation"
    | "remote_service"
    | "unknown";
}

/**
 * Data exfiltration pattern
 */
export interface ExfiltrationPattern {
  /** Whether exfiltration detected */
  detected: boolean;
  /** Total data volume (bytes) */
  total_volume: number;
  /** Exfiltration duration (ms) */
  duration: number;
  /** Exfiltration rate (bytes/sec) */
  rate: number;
  /** Destination(s) */
  destinations: string[];
  /** Exfiltration method */
  method: "download" | "upload" | "api" | "dns_tunneling" | "unknown";
  /** Detection confidence */
  confidence: number;
}

/**
 * Incident timeline
 */
export interface IncidentTimeline {
  /** Incident identifier */
  incident_id: string;
  /** Timeline events */
  events: TimelineEvent[];
  /** Timeline summary */
  summary: string;
  /** Key milestones */
  milestones: Milestone[];
}

/**
 * Timeline event
 */
export interface TimelineEvent {
  /** Event */
  event: SecurityEvent;
  /** Event position in timeline */
  position: number;
  /** Event significance (0-1) */
  significance: number;
  /** Time from previous event (ms) */
  time_from_previous: number;
  /** Time to next event (ms) */
  time_to_next: number;
}

/**
 * Timeline milestone
 */
export interface Milestone {
  /** Milestone identifier */
  id: string;
  /** Milestone name */
  name: string;
  /** Milestone timestamp */
  timestamp: Date;
  /** Milestone description */
  description: string;
  /** Related events */
  related_events: string[];
}

/**
 * Security incident
 */
export interface SecurityIncident {
  /** Incident identifier */
  id: string;
  /** Timestamp when incident was created */
  timestamp: Date;
  /** Incident classification */
  classification: IncidentClassification;
  /** Incident severity */
  severity: IncidentSeverity;
  /** Incident status */
  status: IncidentStatus;
  /** Events in incident */
  events: SecurityEvent[];
  /** Incident timeline */
  timeline: IncidentTimeline;
  /** Response recommendations */
  recommendations: ResponseRecommendation[];
  /** Assigned analyst */
  assigned_to?: string;
  /** Incident notes */
  notes: IncidentNote[];
  /** Related incidents */
  related_incidents: string[];
}

/**
 * Incident classification
 */
export type IncidentClassification =
  | "data_breach"
  | "unauthorized_access"
  | "privacy_violation"
  | "suspicious_activity"
  | "false_positive"
  | "malware"
  | "dos_attack"
  | "insider_threat";

/**
 * Incident severity
 */
export type IncidentSeverity = "low" | "medium" | "high" | "critical";

/**
 * Incident status
 */
export type IncidentStatus =
  | "open"
  | "investigating"
  | "contained"
  | "eradicated"
  | "resolved"
  | "false_positive";

/**
 * Response recommendation
 */
export interface ResponseRecommendation {
  /** Priority (1-10, higher = more urgent) */
  priority: number;
  /** Action to take */
  action: string;
  /** Action description */
  description: string;
  /** Whether action can be automated */
  automated: boolean;
  /** Estimated effort */
  estimated_effort: Duration;
  /** Expected outcome */
  expected_outcome: string;
}

/**
 * Duration
 */
export interface Duration {
  /** Magnitude */
  value: number;
  /** Unit */
  unit: "milliseconds" | "seconds" | "minutes" | "hours" | "days";
}

/**
 * Incident note
 */
export interface IncidentNote {
  /** Note identifier */
  id: string;
  /** Note timestamp */
  timestamp: Date;
  /** Note author */
  author: string;
  /** Note content */
  content: string;
}

/**
 * Incident report
 */
export interface IncidentReport {
  /** Incident */
  incident: SecurityIncident;
  /** Report generated at */
  generated_at: Date;
  /** Executive summary */
  executive_summary: string;
  /** Detailed findings */
  findings: Finding[];
  /** Timeline */
  timeline: IncidentTimeline;
  /** Impact assessment */
  impact_assessment: ImpactAssessment;
  /** Recommendations */
  recommendations: ResponseRecommendation[];
  /** Lessons learned */
  lessons_learned: string[];
}

/**
 * Finding
 */
export interface Finding {
  /** Finding identifier */
  id: string;
  /** Finding type */
  type: string;
  /** Finding severity */
  severity: "low" | "medium" | "high" | "critical";
  /** Finding description */
  description: string;
  /** Evidence */
  evidence: Evidence[];
}

/**
 * Evidence
 */
export interface Evidence {
  /** Evidence type */
  type: string;
  /** Evidence description */
  description: string;
  /** Evidence value */
  value: unknown;
  /** Evidence timestamp */
  timestamp: Date;
}

/**
 * Impact assessment
 */
export interface ImpactAssessment {
  /** Confidentiality impact (0-1) */
  confidentiality: number;
  /** Integrity impact (0-1) */
  integrity: number;
  /** Availability impact (0-1) */
  availability: number;
  /** Overall impact (0-1) */
  overall: number;
  /** Affected assets */
  affected_assets: string[];
  /** Affected users */
  affected_users: number;
  /** Estimated data loss (bytes) */
  data_loss: number;
}

/**
 * Incident resolution
 */
export interface IncidentResolution {
  /** Resolution timestamp */
  timestamp: Date;
  /** Resolution type */
  type: "resolved" | "false_positive" | "duplicate";
  /** Resolution description */
  description: string;
  /** Resolved by */
  resolved_by: string;
  /** Lessons learned */
  lessons_learned: string;
}

/**
 * SecurityEventCorrelator - Correlate security events
 *
 * The correlator analyzes security events to find related activities,
 * detect attack patterns, and reconstruct incident timelines.
 */
export class SecurityEventCorrelator {
  private incidents: Map<string, SecurityIncident>;
  private eventBuffer: SecurityEvent[];
  private correlationWindow: number;

  constructor() {
    this.incidents = new Map();
    this.eventBuffer = [];
    this.correlationWindow = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Correlate events by time, entity, and pattern
   *
   * @param events - Events to correlate
   * @returns Correlation result
   */
  correlate_events(events: SecurityEvent[]): CorrelationResult {
    const groups: EventGroup[] = [];
    const uncorrelated: SecurityEvent[] = [];
    const patterns: AttackPattern[] = [];

    // Mark events as correlated
    const processed = new Set<string>();

    // Group by time windows
    const timeGroups = this.group_by_time_window(
      events,
      this.correlationWindow
    );

    // Group by entities
    for (const timeGroup of timeGroups) {
      const entityGroups = this.group_by_entity(timeGroup.events);

      for (const entityGroup of entityGroups) {
        if (entityGroup.events.length === 1) {
          uncorrelated.push(...entityGroup.events);
          processed.add(entityGroup.events[0].id);
        } else {
          // Check if this group forms an attack pattern
          const attackPattern = this.detect_attack_pattern(entityGroup.events);

          const group: EventGroup = {
            id: this.generateId(),
            events: entityGroup.events,
            description: this.generate_group_description(entityGroup.events),
            severity: this.calculate_group_severity(entityGroup.events),
            entities: entityGroup.entities,
            time_range: {
              start: new Date(
                Math.min(...entityGroup.events.map(e => e.timestamp.getTime()))
              ),
              end: new Date(
                Math.max(...entityGroup.events.map(e => e.timestamp.getTime()))
              ),
            },
            is_attack_pattern: attackPattern !== undefined,
          };

          groups.push(group);
          entityGroup.events.forEach(e => processed.add(e.id));

          if (attackPattern) {
            patterns.push(attackPattern);
          }
        }
      }
    }

    // Add unprocessed events to uncorrelated
    for (const event of events) {
      if (!processed.has(event.id)) {
        uncorrelated.push(event);
      }
    }

    // Calculate overall confidence
    const confidence =
      events.length > 0
        ? (events.length - uncorrelated.length) / events.length
        : 0;

    return {
      groups,
      uncorrelated,
      confidence,
      patterns_found: patterns,
    };
  }

  /**
   * Find events related to a given event
   *
   * @param event - Source event
   * @param window - Time window to search
   * @returns Related events
   */
  find_related_events(event: SecurityEvent, window: Duration): SecurityEvent[] {
    const windowMs =
      window.value *
      (window.unit === "milliseconds"
        ? 1
        : window.unit === "seconds"
          ? 1000
          : window.unit === "minutes"
            ? 60000
            : window.unit === "hours"
              ? 3600000
              : 86400000);

    const eventTime = event.timestamp.getTime();

    return this.eventBuffer.filter(e => {
      if (e.id === event.id) return false;

      const timeDiff = Math.abs(e.timestamp.getTime() - eventTime);
      return (
        timeDiff <= windowMs &&
        (e.source_entity === event.source_entity ||
          e.target_entity === event.target_entity ||
          e.source_entity === event.target_entity ||
          e.target_entity === event.source_entity)
      );
    });
  }

  /**
   * Reconstruct incident timeline from events
   *
   * @param events - Security events
   * @returns Incident timeline
   */
  reconstruct_timeline(events: SecurityEvent[]): IncidentTimeline {
    // Sort events by timestamp
    const sortedEvents = [...events].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Calculate significance based on severity
    const severityScore: Record<string, number> = {
      info: 0.1,
      warning: 0.3,
      error: 0.6,
      critical: 1.0,
    };

    const timelineEvents: TimelineEvent[] = sortedEvents.map(
      (event, index) => ({
        event,
        position: index,
        significance: severityScore[event.severity],
        time_from_previous:
          index > 0
            ? event.timestamp.getTime() -
              sortedEvents[index - 1].timestamp.getTime()
            : 0,
        time_to_next:
          index < sortedEvents.length - 1
            ? sortedEvents[index + 1].timestamp.getTime() -
              event.timestamp.getTime()
            : 0,
      })
    );

    // Identify milestones (significant events)
    const milestones: Milestone[] = [];
    for (const te of timelineEvents) {
      if (te.significance >= 0.6) {
        milestones.push({
          id: this.generateId(),
          name: te.event.event_type.replace(/_/g, " ").toUpperCase(),
          timestamp: te.event.timestamp,
          description: te.event.description,
          related_events: [te.event.id],
        });
      }
    }

    // Generate summary
    const summary = this.generate_timeline_summary(sortedEvents);

    return {
      incident_id: this.generateId(),
      events: timelineEvents,
      summary,
      milestones,
    };
  }

  /**
   * Detect attack pattern in events
   *
   * @param events - Events to analyze
   * @returns Attack pattern or undefined
   */
  detect_attack_pattern(events: SecurityEvent[]): AttackPattern | undefined {
    if (events.length < 2) {
      return undefined;
    }

    // Check for common attack patterns

    // 1. Brute force pattern (multiple failed access attempts)
    const failedAccess = events.filter(
      e =>
        e.event_type === "unauthorized_access" ||
        e.event_type === "anomaly_detected"
    );

    if (failedAccess.length >= 5) {
      const timeSpan =
        Math.max(...failedAccess.map(e => e.timestamp.getTime())) -
        Math.min(...failedAccess.map(e => e.timestamp.getTime()));

      if (timeSpan < 300000) {
        // Within 5 minutes
        return {
          id: this.generateId(),
          type: "initial_access",
          name: "Brute Force Attack",
          description: `Multiple unauthorized access attempts detected (${failedAccess.length} attempts)`,
          events: failedAccess,
          confidence: 0.8,
          stage: "Initial Access",
          techniques: ["Brute Force", "Password Spraying"],
        };
      }
    }

    // 2. Lateral movement pattern
    const lateralMovement = this.detect_lateral_movement(events);
    if (lateralMovement.detected) {
      return {
        id: this.generateId(),
        type: "lateral_movement",
        name: "Lateral Movement",
        description: `Lateral movement detected across ${lateralMovement.hops} hosts`,
        events,
        confidence: lateralMovement.confidence,
        stage: "Lateral Movement",
        techniques: [lateralMovement.method.replace(/_/g, " ").toUpperCase()],
      };
    }

    // 3. Data exfiltration pattern
    const exfiltration = this.detect_data_exfiltration(events);
    if (exfiltration.detected) {
      return {
        id: this.generateId(),
        type: "exfiltration",
        name: "Data Exfiltration",
        description: `Data exfiltration detected: ${this.formatBytes(exfiltration.total_volume)} transferred`,
        events,
        confidence: exfiltration.confidence,
        stage: "Exfiltration",
        techniques: ["Data Exfiltration", "Exfiltration Over Web Service"],
      };
    }

    // 4. Privilege escalation pattern
    const privilegeEscalation = events.filter(
      e => e.event_type === "privilege_escalation"
    );
    if (privilegeEscalation.length > 0) {
      return {
        id: this.generateId(),
        type: "privilege_escalation",
        name: "Privilege Escalation",
        description: `Privilege escalation detected (${privilegeEscalation.length} events)`,
        events: privilegeEscalation,
        confidence: 0.7,
        stage: "Privilege Escalation",
        techniques: ["Privilege Escalation", "Access Token Manipulation"],
      };
    }

    return undefined;
  }

  /**
   * Detect lateral movement pattern
   *
   * @param events - Events to analyze
   * @returns Lateral movement pattern
   */
  detect_lateral_movement(events: SecurityEvent[]): LateralMovementPattern {
    if (events.length < 2) {
      return {
        detected: false,
        path: [],
        confidence: 0,
        duration: 0,
        hops: 0,
        method: "unknown",
      };
    }

    // Build a graph of entity transitions
    const path: string[] = [];
    const transitions = new Map<string, Set<string>>();

    for (let i = 0; i < events.length - 1; i++) {
      const source = events[i].source_entity;
      const target = events[i + 1].source_entity;

      if (source !== target) {
        if (!transitions.has(source)) {
          transitions.set(source, new Set());
        }
        transitions.get(source)!.add(target);
      }
    }

    // Find path through the graph
    const visited = new Set<string>();
    let currentEntity = events[0].source_entity;

    while (currentEntity && !visited.has(currentEntity)) {
      visited.add(currentEntity);
      path.push(currentEntity);

      const nextEntities = transitions.get(currentEntity);
      if (nextEntities && nextEntities.size > 0) {
        currentEntity = Array.from(nextEntities)[0];
      } else {
        break;
      }
    }

    // Determine method based on event types
    const method: LateralMovementPattern["method"] = events.some(e =>
      e.description.toLowerCase().includes("credential")
    )
      ? "credential_reuse"
      : events.some(e => e.event_type === "privilege_escalation")
        ? "exploitation" // Map privilege_escalation to exploitation
        : "unknown";

    const detected = path.length > 2;
    const duration =
      events.length > 0
        ? Math.max(...events.map(e => e.timestamp.getTime())) -
          Math.min(...events.map(e => e.timestamp.getTime()))
        : 0;

    return {
      detected,
      path,
      confidence: detected ? 0.7 : 0,
      duration,
      hops: path.length - 1,
      method,
    };
  }

  /**
   * Detect data exfiltration pattern
   *
   * @param events - Events to analyze
   * @returns Data exfiltration pattern
   */
  detect_data_exfiltration(events: SecurityEvent[]): ExfiltrationPattern {
    const exfilEvents = events.filter(
      e =>
        e.event_type === "data_exfiltration" ||
        e.event_type === "privacy_violation"
    );

    if (exfilEvents.length === 0) {
      return {
        detected: false,
        total_volume: 0,
        duration: 0,
        rate: 0,
        destinations: [],
        method: "unknown",
        confidence: 0,
      };
    }

    // Calculate total volume from metadata
    let totalVolume = 0;
    const destinations = new Set<string>();

    for (const event of exfilEvents) {
      totalVolume += (event.metadata.volume as number) || 0;
      if (event.metadata.destination) {
        destinations.add(String(event.metadata.destination));
      }
    }

    const duration =
      exfilEvents.length > 0
        ? Math.max(...exfilEvents.map(e => e.timestamp.getTime())) -
          Math.min(...exfilEvents.map(e => e.timestamp.getTime()))
        : 0;

    const rate = duration > 0 ? (totalVolume / duration) * 1000 : 0; // bytes per second

    // Determine method
    const method: ExfiltrationPattern["method"] = exfilEvents.some(
      e => e.metadata.method === "dns"
    )
      ? "dns_tunneling"
      : exfilEvents.some(e => e.metadata.method === "api")
        ? "api"
        : exfilEvents.some(e => e.metadata.method === "upload")
          ? "upload"
          : "download";

    return {
      detected: totalVolume > 1000000, // More than 1MB
      total_volume: totalVolume,
      duration,
      rate,
      destinations: Array.from(destinations),
      method,
      confidence: totalVolume > 10000000 ? 0.9 : 0.6,
    };
  }

  /**
   * Classify incident from events
   *
   * @param events - Security events
   * @returns Incident classification
   */
  classify_incident(events: SecurityEvent[]): IncidentClassification {
    if (events.length === 0) {
      return "suspicious_activity";
    }

    const eventTypes = new Set(events.map(e => e.event_type));

    // Data breach: exfiltration + privacy violation
    if (
      eventTypes.has("data_exfiltration") &&
      eventTypes.has("privacy_violation")
    ) {
      return "data_breach";
    }

    // Unauthorized access
    if (
      eventTypes.has("unauthorized_access") &&
      !eventTypes.has("malware_detected")
    ) {
      return "unauthorized_access";
    }

    // Privacy violation
    if (eventTypes.has("privacy_violation")) {
      return "privacy_violation";
    }

    // Malware
    if (eventTypes.has("malware_detected") || eventTypes.has("dos_attack")) {
      return eventTypes.has("malware_detected") ? "malware" : "dos_attack";
    }

    // Insider threat (lateral movement + privilege escalation)
    if (
      eventTypes.has("lateral_movement") &&
      eventTypes.has("privilege_escalation")
    ) {
      return "insider_threat";
    }

    // Default
    return "suspicious_activity";
  }

  /**
   * Recommend response actions for incident
   *
   * @param incident - Security incident
   * @returns Response recommendations
   */
  recommend_response(incident: SecurityIncident): ResponseRecommendation[] {
    const recommendations: ResponseRecommendation[] = [];

    switch (incident.classification) {
      case "data_breach":
        recommendations.push(
          {
            priority: 10,
            action: "contain_breach",
            description:
              "Immediately contain the data breach by blocking affected accounts and systems",
            automated: true,
            estimated_effort: { value: 15, unit: "minutes" },
            expected_outcome: "Breach contained, further data loss prevented",
          },
          {
            priority: 9,
            action: "notify_stakeholders",
            description:
              "Notify security team, legal, and management of confirmed breach",
            automated: false,
            estimated_effort: { value: 30, unit: "minutes" },
            expected_outcome: "Stakeholders aware and mobilized",
          },
          {
            priority: 8,
            action: "preserve_evidence",
            description:
              "Preserve logs, memory dumps, and other evidence for forensic analysis",
            automated: true,
            estimated_effort: { value: 1, unit: "hours" },
            expected_outcome: "Evidence preserved for investigation",
          }
        );
        break;

      case "unauthorized_access":
        recommendations.push(
          {
            priority: 8,
            action: "revoke_access",
            description: "Revoke access for unauthorized entity",
            automated: true,
            estimated_effort: { value: 5, unit: "minutes" },
            expected_outcome: "Unauthorized access blocked",
          },
          {
            priority: 7,
            action: "investigate_source",
            description: "Investigate source of unauthorized access",
            automated: false,
            estimated_effort: { value: 2, unit: "hours" },
            expected_outcome: "Source identified and remediated",
          }
        );
        break;

      case "privacy_violation":
        recommendations.push(
          {
            priority: 8,
            action: "assess_impact",
            description:
              "Assess impact of privacy violation on affected individuals",
            automated: false,
            estimated_effort: { value: 4, unit: "hours" },
            expected_outcome: "Impact assessment complete",
          },
          {
            priority: 7,
            action: "notify_subjects",
            description:
              "Notify affected individuals if required by regulation",
            automated: false,
            estimated_effort: { value: 8, unit: "hours" },
            expected_outcome: "Affected subjects notified",
          }
        );
        break;

      case "malware":
        recommendations.push(
          {
            priority: 10,
            action: "isolate_systems",
            description: "Isolate infected systems from network",
            automated: true,
            estimated_effort: { value: 10, unit: "minutes" },
            expected_outcome: "Malware contained",
          },
          {
            priority: 9,
            action: "scan_network",
            description: "Scan network for other infected systems",
            automated: true,
            estimated_effort: { value: 1, unit: "hours" },
            expected_outcome: "Other infections identified",
          }
        );
        break;

      case "insider_threat":
        recommendations.push(
          {
            priority: 9,
            action: "monitor_activity",
            description: "Increase monitoring of insider activity",
            automated: true,
            estimated_effort: { value: 30, unit: "minutes" },
            expected_outcome: "Enhanced monitoring active",
          },
          {
            priority: 8,
            action: "conduct_interview",
            description: "Conduct interview with subject matter expert",
            automated: false,
            estimated_effort: { value: 2, unit: "hours" },
            expected_outcome: "Intent determined",
          }
        );
        break;

      default:
        recommendations.push({
          priority: 5,
          action: "investigate",
          description: "Investigate suspicious activity",
          automated: false,
          estimated_effort: { value: 2, unit: "hours" },
          expected_outcome: "Activity understood",
        });
    }

    return recommendations;
  }

  /**
   * Generate incident report
   *
   * @param incident - Security incident
   * @returns Incident report
   */
  generate_incident_report(incident: SecurityIncident): IncidentReport {
    const findings = this.generate_findings(incident);
    const impactAssessment = this.assess_impact(incident);

    return {
      incident,
      generated_at: new Date(),
      executive_summary: this.generate_executive_summary(
        incident,
        impactAssessment
      ),
      findings,
      timeline: incident.timeline,
      impact_assessment: impactAssessment,
      recommendations: incident.recommendations,
      lessons_learned:
        incident.status === "resolved" || incident.status === "false_positive"
          ? this.extract_lessons_learned(incident)
          : [],
    };
  }

  /**
   * Track ongoing incidents
   *
   * @returns Active security incidents
   */
  track_ongoing_incidents(): SecurityIncident[] {
    return Array.from(this.incidents.values()).filter(
      inc =>
        inc.status === "open" ||
        inc.status === "investigating" ||
        inc.status === "contained"
    );
  }

  /**
   * Update incident status
   *
   * @param incident_id - Incident identifier
   * @param status - New status
   */
  update_incident_status(incident_id: string, status: IncidentStatus): void {
    const incident = this.incidents.get(incident_id);
    if (incident) {
      incident.status = status;
    }
  }

  /**
   * Close incident with resolution
   *
   * @param incident_id - Incident identifier
   * @param resolution - Incident resolution
   */
  close_incident(incident_id: string, resolution: IncidentResolution): void {
    const incident = this.incidents.get(incident_id);
    if (incident) {
      incident.status =
        resolution.type === "false_positive" ? "false_positive" : "resolved";

      // Add as note
      incident.notes.push({
        id: this.generateId(),
        timestamp: resolution.timestamp,
        author: resolution.resolved_by,
        content: `Incident ${resolution.type}: ${resolution.description}\n\nLessons learned: ${resolution.lessons_learned}`,
      });
    }
  }

  /**
   * Add event to buffer
   *
   * @param event - Event to add
   */
  add_event(event: SecurityEvent): void {
    this.eventBuffer.push(event);

    // Keep buffer manageable
    if (this.eventBuffer.length > 10000) {
      this.eventBuffer = this.eventBuffer.slice(-5000);
    }
  }

  /**
   * Create incident from events
   *
   * @param events - Security events
   * @param classification - Incident classification
   * @returns Created incident
   */
  create_incident(
    events: SecurityEvent[],
    classification?: IncidentClassification
  ): SecurityIncident {
    const finalClassification =
      classification || this.classify_incident(events);
    const severity = this.calculate_incident_severity(events);
    const timeline = this.reconstruct_timeline(events);

    const incident: SecurityIncident = {
      id: this.generateId(),
      timestamp: new Date(),
      classification: finalClassification,
      severity,
      status: "open",
      events,
      timeline,
      recommendations: [],
      notes: [],
      related_incidents: [],
    };

    incident.recommendations = this.recommend_response(incident);
    this.incidents.set(incident.id, incident);

    return incident;
  }

  /**
   * Get incident by ID
   *
   * @param incident_id - Incident identifier
   * @returns Incident or undefined
   */
  get_incident(incident_id: string): SecurityIncident | undefined {
    return this.incidents.get(incident_id);
  }

  /**
   * Get all incidents
   *
   * @returns All incidents
   */
  get_all_incidents(): SecurityIncident[] {
    return Array.from(this.incidents.values());
  }

  // Private helper methods

  private group_by_time_window(
    events: SecurityEvent[],
    windowMs: number
  ): EventGroup[] {
    const groups: EventGroup[] = [];
    const sortedEvents = [...events].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    let currentGroup: SecurityEvent[] = [sortedEvents[0]];

    for (let i = 1; i < sortedEvents.length; i++) {
      const timeDiff =
        sortedEvents[i].timestamp.getTime() -
        currentGroup[currentGroup.length - 1].timestamp.getTime();

      if (timeDiff <= windowMs) {
        currentGroup.push(sortedEvents[i]);
      } else {
        groups.push({
          id: this.generateId(),
          events: currentGroup,
          description: `Time window group (${currentGroup.length} events)`,
          severity: this.calculate_group_severity(currentGroup),
          entities: this.get_entities_from_events(currentGroup),
          time_range: {
            start: currentGroup[0].timestamp,
            end: currentGroup[currentGroup.length - 1].timestamp,
          },
          is_attack_pattern: false,
        });
        currentGroup = [sortedEvents[i]];
      }
    }

    if (currentGroup.length > 0) {
      groups.push({
        id: this.generateId(),
        events: currentGroup,
        description: `Time window group (${currentGroup.length} events)`,
        severity: this.calculate_group_severity(currentGroup),
        entities: this.get_entities_from_events(currentGroup),
        time_range: {
          start: currentGroup[0].timestamp,
          end: currentGroup[currentGroup.length - 1].timestamp,
        },
        is_attack_pattern: false,
      });
    }

    return groups;
  }

  private group_by_entity(events: SecurityEvent[]): EventGroup[] {
    const groups = new Map<string, SecurityEvent[]>();

    for (const event of events) {
      const key = event.source_entity;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(event);
    }

    return Array.from(groups.entries()).map(([entity, entityEvents]) => ({
      id: this.generateId(),
      events: entityEvents,
      description: `Entity group for ${entity}`,
      severity: this.calculate_group_severity(entityEvents),
      entities: [entity],
      time_range: {
        start: new Date(
          Math.min(...entityEvents.map(e => e.timestamp.getTime()))
        ),
        end: new Date(
          Math.max(...entityEvents.map(e => e.timestamp.getTime()))
        ),
      },
      is_attack_pattern: false,
    }));
  }

  private generate_group_description(events: SecurityEvent[]): string {
    const eventTypes = new Set(events.map(e => e.event_type));
    return `Event group: ${Array.from(eventTypes).join(", ")}`;
  }

  private calculate_group_severity(
    events: SecurityEvent[]
  ): "info" | "warning" | "error" | "critical" {
    const severityCounts = { info: 0, warning: 0, error: 0, critical: 0 };

    for (const event of events) {
      severityCounts[event.severity]++;
    }

    if (severityCounts.critical > 0) return "critical";
    if (severityCounts.error > 0) return "error";
    if (severityCounts.warning > 2) return "error";
    if (severityCounts.warning > 0) return "warning";
    return "info";
  }

  private calculate_incident_severity(
    events: SecurityEvent[]
  ): IncidentSeverity {
    const severity = this.calculate_group_severity(events);

    if (severity === "critical") return "critical";
    if (severity === "error") return "high";
    if (severity === "warning") return "medium";
    return "low";
  }

  private get_entities_from_events(events: SecurityEvent[]): string[] {
    return Array.from(
      new Set([
        ...events.map(e => e.source_entity),
        ...events.map(e => e.target_entity),
      ])
    );
  }

  private generate_timeline_summary(events: SecurityEvent[]): string {
    const eventTypes = new Set(events.map(e => e.event_type));
    const duration =
      events.length > 1
        ? Math.max(...events.map(e => e.timestamp.getTime())) -
          Math.min(...events.map(e => e.timestamp.getTime()))
        : 0;

    const durationStr =
      duration > 0 ? `${Math.round(duration / 60000)} minutes` : "single event";

    return `Incident involving ${events.length} events over ${durationStr}: ${Array.from(eventTypes).join(", ")}`;
  }

  private generate_findings(incident: SecurityIncident): Finding[] {
    const findings: Finding[] = [];

    for (const event of incident.events) {
      if (event.severity === "critical" || event.severity === "error") {
        findings.push({
          id: this.generateId(),
          type: event.event_type,
          severity: event.severity === "critical" ? "critical" : "high",
          description: event.description,
          evidence: [
            {
              type: "security_event",
              description: "Source event",
              value: event,
              timestamp: event.timestamp,
            },
          ],
        });
      }
    }

    return findings;
  }

  private assess_impact(incident: SecurityIncident): ImpactAssessment {
    let confidentiality = 0;
    let integrity = 0;
    let availability = 0;

    for (const event of incident.events) {
      if (
        event.event_type === "privacy_violation" ||
        event.event_type === "data_exfiltration"
      ) {
        confidentiality = Math.max(confidentiality, 0.8);
      }
      if (event.event_type === "unauthorized_access") {
        integrity = Math.max(integrity, 0.7);
      }
      if (event.event_type === "dos_attack") {
        availability = Math.max(availability, 0.9);
      }
    }

    const overall = Math.max(confidentiality, integrity, availability);

    const affectedAssets = Array.from(
      new Set(incident.events.map(e => e.target_entity))
    );

    let dataLoss = 0;
    for (const event of incident.events) {
      dataLoss += (event.metadata.volume as number) || 0;
    }

    return {
      confidentiality,
      integrity,
      availability,
      overall,
      affected_assets: affectedAssets,
      affected_users: affectedAssets.length,
      data_loss: dataLoss,
    };
  }

  private generate_executive_summary(
    incident: SecurityIncident,
    impact: ImpactAssessment
  ): string {
    return `Security incident detected: ${incident.classification.replace(/_/g, " ").toUpperCase()}.

Severity: ${incident.severity.toUpperCase()}
Status: ${incident.status.replace(/_/g, " ").toUpperCase()}

Impact Assessment:
- Confidentiality: ${(impact.confidentiality * 100).toFixed(0)}%
- Integrity: ${(impact.integrity * 100).toFixed(0)}%
- Availability: ${(impact.availability * 100).toFixed(0)}%
- Overall: ${(impact.overall * 100).toFixed(0)}%

Affected assets: ${impact.affected_assets.length}
Data loss: ${this.formatBytes(impact.data_loss)}

Recommended actions: ${incident.recommendations.length}`;
  }

  private extract_lessons_learned(incident: SecurityIncident): string[] {
    const lessons: string[] = [];

    // Extract from notes
    for (const note of incident.notes) {
      if (note.content.toLowerCase().includes("lessons learned")) {
        lessons.push(note.content);
      }
    }

    return lessons;
  }

  private generateId(): string {
    return `evt_${Date.now()}_${randomBytes(4).toString("hex")}`;
  }

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
}

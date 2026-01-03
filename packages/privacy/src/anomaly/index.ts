/**
 * Anomaly Detection Module - Privacy anomaly detection and security event correlation
 *
 * This module provides components for:
 * - Privacy anomaly detection (PII exposure, unauthorized access, data exfiltration)
 * - Behavior profiling and anomaly scoring
 * - Security event correlation and incident response
 *
 * @packageDocumentation
 */

// PrivacyAnomalyDetector
export { PrivacyAnomalyDetector } from "./PrivacyAnomalyDetector.js";

export type {
  AccessEvent,
  PrivacyAnomaly,
  AnomalyType,
  AnomalySeverity,
  Evidence,
  PatternAnomaly,
  PatternDeviation,
  TemporalAnomaly,
  VolumeAnomaly,
  BehaviorBaseline,
  AnomalyScore,
  PrivacyAlert,
  Recommendation,
  AlertGroup,
  AnomalyDetectorConfig,
} from "./PrivacyAnomalyDetector.js";

// BehaviorProfiler
export { BehaviorProfiler } from "./BehaviorProfiler.js";

export type {
  AccessPattern,
  TemporalPattern,
  VolumePattern,
  BaselineMetrics,
  SequenceScore,
  AccessEventSequence,
  BehaviorProfile,
  ProfileCluster,
  ProfileType,
  AnomalyScore as BehaviorAnomalyScore,
  Duration as ProfilerDuration,
  ProfilerConfig,
} from "./BehaviorProfiler.js";

// SecurityEventCorrelator
export { SecurityEventCorrelator } from "./SecurityEventCorrelator.js";

export type {
  SecurityEvent,
  SecurityEventType,
  CorrelationResult,
  EventGroup,
  AttackPattern,
  AttackPatternType,
  LateralMovementPattern,
  ExfiltrationPattern,
  IncidentTimeline,
  TimelineEvent,
  Milestone,
  SecurityIncident,
  IncidentClassification,
  IncidentSeverity,
  IncidentStatus,
  ResponseRecommendation,
  Duration as ResponseDuration,
  IncidentNote,
  IncidentReport,
  Finding,
  Evidence as ReportEvidence,
  ImpactAssessment,
  IncidentResolution,
} from "./SecurityEventCorrelator.js";

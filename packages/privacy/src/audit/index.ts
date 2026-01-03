/**
 * @lsi/privacy/audit - Privacy Audit Logging for Aequor
 *
 * This module provides comprehensive privacy audit logging for compliance and auditing.
 * It records all privacy-relevant events, provides query capabilities,
 * export functionality, and compliance report generation.
 *
 * Features:
 * - Immutable append-only event log
 * - Hash-based query/user anonymization for privacy
 * - Query filtering by multiple criteria
 * - Export to JSON, CSV, XML, PDF, and Parquet formats
 * - Compliance report generation (GDPR, HIPAA, CCPA, SOX)
 * - Real-time monitoring with alerting
 * - Enhanced audit logging with schema validation
 * - PII inventory tracking
 * - Consent change logging
 * - Data access logging
 * - Anomaly detection
 * - Privacy impact assessments
 *
 * @packageDocumentation
 */

// Core exports
export { AuditLogger } from "./AuditLogger.js";
export { AuditExporter, EXPORT_FORMATS } from "./AuditExporter.js";
export { ComplianceReporter } from "./ComplianceReporter.js";
export { RealTimeMonitor } from "./RealTimeMonitor.js";

// Enhanced exports
export { AuditLoggerEnhanced } from "./AuditLoggerEnhanced.js";
export { ComplianceReporterEnhanced } from "./ComplianceReporterEnhanced.js";

// Type exports from AuditLogger
export type {
  PrivacyAuditEvent,
  AuditEventType,
  AuditLogFilter,
  AuditLoggerConfig,
  ComplianceReport as BaseComplianceReport,
} from "./AuditLogger.js";

// Type exports from AuditExporter
export type {
  ExportFormat,
  ExportOptions,
  ExportResult,
} from "./AuditExporter.js";

// Type exports from ComplianceReporter
export type {
  ComplianceReport as DetailedComplianceReport,
  ReportSummary,
  RegulationCompliance,
  ComplianceViolation,
  ComplianceGap,
  PrivacyIncident,
  ComplianceRecommendation,
  Regulation,
  ComplianceSeverity,
  ReportOptions,
} from "./ComplianceReporter.js";

// Type exports from RealTimeMonitor
export type {
  MonitoringConfig,
  AlertThresholds,
  AlertChannel,
  Alert,
  AlertType,
  AlertMetrics,
  MonitoringMetrics,
  AlertSubscription,
} from "./RealTimeMonitor.js";

// Type exports from AuditLoggerEnhanced
export type {
  EnhancedAuditEvent,
  StorageBackend,
  StorageConfig,
  AnomalyDetectionConfig,
  AuditLoggerConfigEnhanced,
  AnomalyAlert,
  AnomalyType,
  PIIInventoryEntry,
  DataAccessLogEntry,
  ConsentChangeLogEntry,
  AggregatedAnalytics,
  EnhancedAuditLogFilter,
} from "./AuditLoggerEnhanced.js";

// Type exports from ComplianceReporterEnhanced
export type {
  GDPRROPARecord,
  HIPAAComplianceReport,
  CCPAComplianceReport,
  SOXComplianceReport,
  PrivacyImpactAssessment,
  DataBreachNotification,
  EnhancedComplianceReport,
  EnhancedReportOptions,
} from "./ComplianceReporterEnhanced.js";

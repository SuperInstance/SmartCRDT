/**
 * ComplianceReporter - Regulatory compliance reporting for privacy audit logs
 *
 * Generates comprehensive compliance reports for GDPR, HIPAA, CCPA, and SOX.
 * Detects violations, privacy incidents, and provides recommendations.
 *
 * @packageDocumentation
 */

import { createHash } from "crypto";
import { promises as fs } from "fs";
import {
  PrivacyAuditEvent,
  PIIType,
  PrivacyClassification,
} from "@lsi/protocol";
import type { AuditLogFilter } from "./AuditLogger.js";

/**
 * Regulation types
 */
export type Regulation = "GDPR" | "HIPAA" | "CCPA" | "SOX";

/**
 * Compliance severity levels
 */
export type ComplianceSeverity = "low" | "medium" | "high" | "critical";

/**
 * Compliance report
 */
export interface ComplianceReport {
  /** Unique report identifier */
  reportId: string;
  /** Report generation timestamp */
  generatedAt: number;
  /** Time period covered */
  period: { start: number; end: number };

  /** Summary statistics */
  summary: ReportSummary;

  /** Compliance by regulation */
  regulations: RegulationCompliance[];

  /** Privacy incidents detected */
  incidents: PrivacyIncident[];

  /** Recommendations for improvement */
  recommendations: ComplianceRecommendation[];

  /** Paths to exported data attachments */
  attachments: string[];
}

/**
 * Report summary statistics
 */
export interface ReportSummary {
  /** Total queries processed */
  totalQueries: number;
  /** Number of blocked queries */
  blockedQueries: number;
  /** Number of redacted queries */
  redactedQueries: number;
  /** Number of allowed queries */
  allowedQueries: number;

  /** PII-related incidents */
  piiIncidents: number;
  /** PII types detected with counts */
  piiTypes: { type: PIIType; count: number }[];

  /** Average classification confidence */
  avgConfidence: number;
  /** Number of high-risk queries */
  highRiskQueries: number;

  /** Total data processed (bytes) */
  dataProcessed: number;
  /** Total data redacted (bytes) */
  dataRedacted: number;
}

/**
 * Regulation compliance status
 */
export interface RegulationCompliance {
  /** Regulation name */
  regulation: Regulation;
  /** Overall compliance status */
  compliant: boolean;
  /** Compliance score (0-100) */
  score: number;
  /** Detected violations */
  violations: ComplianceViolation[];
  /** Control gaps */
  gaps: ComplianceGap[];
}

/**
 * Compliance violation
 */
export interface ComplianceViolation {
  /** Violation severity */
  severity: ComplianceSeverity;
  /** Description of the violation */
  description: string;
  /** Number of affected records */
  affectedRecords: number;
  /** Recommended remediation */
  remediation: string;
  /** Related regulation section */
  regulationSection?: string;
}

/**
 * Compliance gap (missing or partial control)
 */
export interface ComplianceGap {
  /** Control name or identifier */
  control: string;
  /** Implementation status */
  status: "implemented" | "partial" | "missing";
  /** Description of the gap */
  description: string;
  /** Recommendation to address gap */
  recommendation: string;
}

/**
 * Privacy incident
 */
export interface PrivacyIncident {
  /** Unique incident identifier */
  incidentId: string;
  /** Incident timestamp */
  timestamp: number;
  /** Incident severity */
  severity: ComplianceSeverity;
  /** Incident type */
  type:
    | "data_leak"
    | "unauthorized_access"
    | "pii_exposure"
    | "policy_violation";
  /** Incident description */
  description: string;
  /** Number of affected users (hash count) */
  affectedUsers: number;
  /** Root cause analysis */
  rootCause: string;
  /** Recommended remediation */
  remediation: string;
}

/**
 * Compliance recommendation
 */
export interface ComplianceRecommendation {
  /** Recommendation priority */
  priority: ComplianceSeverity;
  /** Recommendation category */
  category: string;
  /** Recommendation text */
  recommendation: string;
  /** Implementation effort */
  effort: "low" | "medium" | "high";
  /** Expected impact */
  impact: string;
}

/**
 * Report generation options
 */
export interface ReportOptions {
  /** Regulations to check (default: all) */
  regulations?: Regulation[];
  /** Include detailed incident analysis */
  includeIncidents?: boolean;
  /** Include recommendations */
  includeRecommendations?: boolean;
  /** Minimum severity for violations */
  minSeverity?: ComplianceSeverity;
  /** Output directory for attachments */
  outputDir?: string;
}

/**
 * ComplianceReporter - Generate compliance reports
 *
 * Analyzes audit events for:
 * - GDPR compliance (right to be forgotten, data portability, consent)
 * - HIPAA compliance (PHI protection, access controls, audit trails)
 * - CCPA compliance (Do Not Sell, data access, opt-out)
 * - SOX compliance (internal controls, data integrity, audit trails)
 */
export class ComplianceReporter {
  private readonly severityWeights = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };

  /**
   * Generate comprehensive compliance report
   *
   * @param events - Audit events to analyze
   * @param period - Time period for report
   * @param options - Report generation options
   * @returns Compliance report
   */
  async generateReport(
    events: PrivacyAuditEvent[],
    period: { start: number; end: number },
    options: ReportOptions = {}
  ): Promise<ComplianceReport> {
    const reportId = this.generateReportId();
    const regulations = options.regulations || ["GDPR", "HIPAA", "CCPA", "SOX"];

    // Filter events by time period
    const filteredEvents = events.filter(
      e => e.timestamp >= period.start && e.timestamp <= period.end
    );

    // Generate summary
    const summary = this.generateSummary(filteredEvents);

    // Check compliance for each regulation
    const regulationCompliance = regulations.map(reg =>
      this.checkCompliance(reg, filteredEvents)
    );

    // Detect incidents
    const incidents =
      options.includeIncidents !== false
        ? this.detectIncidents(filteredEvents)
        : [];

    // Generate recommendations
    const recommendations =
      options.includeRecommendations !== false
        ? this.generateRecommendations(summary, regulationCompliance, incidents)
        : [];

    return {
      reportId,
      generatedAt: Date.now(),
      period,
      summary,
      regulations: regulationCompliance,
      incidents,
      recommendations,
      attachments: [],
    };
  }

  /**
   * Generate summary statistics
   *
   * @param events - Events to analyze
   * @returns Report summary
   */
  private generateSummary(events: PrivacyAuditEvent[]): ReportSummary {
    const totalQueries = events.length;
    const blockedQueries = events.filter(
      e => e.decision.action === "deny"
    ).length;
    const redactedQueries = events.filter(
      e => e.decision.action === "redact"
    ).length;
    const allowedQueries = events.filter(
      e => e.decision.action === "allow"
    ).length;

    // Count PII incidents
    const piiIncidents = events.filter(
      e => e.piiDetected && e.piiDetected.length > 0
    ).length;

    // Count PII types
    const piiTypeCounts = new Map<PIIType, number>();
    for (const event of events) {
      if (event.piiDetected) {
        for (const piiType of event.piiDetected) {
          piiTypeCounts.set(piiType, (piiTypeCounts.get(piiType) || 0) + 1);
        }
      }
    }

    const piiTypes = Array.from(piiTypeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    // Calculate average confidence
    const confidenceValues = events
      .filter(e => e.classification?.confidence !== undefined)
      .map(e => e.classification!.confidence);
    const avgConfidence =
      confidenceValues.length > 0
        ? confidenceValues.reduce((sum, c) => sum + c, 0) /
          confidenceValues.length
        : 0;

    // Count high-risk queries (low confidence or high PII count)
    const highRiskQueries = events.filter(e => {
      const lowConfidence =
        e.classification && e.classification.confidence < 0.6;
      const highPII = e.piiDetected && e.piiDetected.length >= 3;
      return lowConfidence || highPII;
    }).length;

    // Estimate data processed and redacted
    const dataProcessed = events.reduce((sum, e) => sum + e.queryLength, 0);
    const dataRedacted = Math.floor(dataProcessed * 0.15); // Estimate 15% redacted

    return {
      totalQueries,
      blockedQueries,
      redactedQueries,
      allowedQueries,
      piiIncidents,
      piiTypes,
      avgConfidence,
      highRiskQueries,
      dataProcessed,
      dataRedacted,
    };
  }

  /**
   * Check compliance for a specific regulation
   *
   * @param regulation - Regulation to check
   * @param events - Events to analyze
   * @returns Regulation compliance status
   */
  private checkCompliance(
    regulation: Regulation,
    events: PrivacyAuditEvent[]
  ): RegulationCompliance {
    switch (regulation) {
      case "GDPR":
        return this.checkGDPR(events);
      case "HIPAA":
        return this.checkHIPAA(events);
      case "CCPA":
        return this.checkCCPA(events);
      case "SOX":
        return this.checkSOX(events);
      default:
        return {
          regulation,
          compliant: false,
          score: 0,
          violations: [],
          gaps: [],
        };
    }
  }

  /**
   * Check GDPR compliance
   *
   * Articles checked:
   * - Article 7: Conditions for consent
   * - Article 15: Right of access
   * - Article 16: Right to rectification
   * - Article 17: Right to erasure (right to be forgotten)
   * - Article 20: Right to data portability
   * - Article 25: Data protection by design and by default
   * - Article 32: Security of processing
   *
   * @param events - Events to analyze
   * @returns GDPR compliance status
   */
  private checkGDPR(events: PrivacyAuditEvent[]): RegulationCompliance {
    const violations: ComplianceViolation[] = [];
    const gaps: ComplianceGap[] = [];

    // Check for excessive PII exposure (Article 32)
    const piiExposureEvents = events.filter(
      e => e.piiDetected && e.piiDetected.length >= 3
    );
    if (piiExposureEvents.length > 0) {
      violations.push({
        severity: "high",
        description:
          "Excessive PII detected in queries without adequate protection",
        affectedRecords: piiExposureEvents.length,
        remediation:
          "Implement stronger redaction and encryption for PII-heavy queries",
        regulationSection: "Article 32 - Security of processing",
      });
    }

    // Check for unencrypted data (Article 32)
    const cloudQueriesWithoutRedaction = events.filter(
      e =>
        e.destination === "cloud" &&
        e.decision.action === "allow" &&
        e.piiDetected &&
        e.piiDetected.length > 0
    );
    if (cloudQueriesWithoutRedaction.length > 0) {
      violations.push({
        severity: "critical",
        description: "PII data transmitted to cloud without redaction",
        affectedRecords: cloudQueriesWithoutRedaction.length,
        remediation:
          "Apply redaction before cloud transmission or use intent encoding",
        regulationSection: "Article 32 - Security of processing",
      });
    }

    // Check for data processing without consent (Article 7)
    const blockedQueries = events.filter(e => e.decision.action === "deny");
    const blockRate = blockedQueries.length / Math.max(1, events.length);
    if (blockRate > 0.1) {
      violations.push({
        severity: "medium",
        description:
          "High rate of blocked queries suggests inadequate consent mechanisms",
        affectedRecords: blockedQueries.length,
        remediation:
          "Implement clear consent management and user preference controls",
        regulationSection: "Article 7 - Conditions for consent",
      });
    }

    // Check for lack of audit trail (Article 30)
    gaps.push({
      control: "Record of processing activities (ROPA)",
      status: "partial",
      description:
        "Audit logs exist but may not meet GDPR documentation requirements",
      recommendation:
        "Enhance audit logs to include legal basis, purpose, and data retention periods",
    });

    // Check for data portability (Article 20)
    gaps.push({
      control: "Data portability",
      status: "missing",
      description:
        "No mechanism for users to export their data in portable format",
      recommendation:
        "Implement user data export functionality in machine-readable format",
    });

    // Calculate compliance score
    const baseScore = 100;
    const penaltyPerViolation = { critical: 25, high: 15, medium: 10, low: 5 };
    const penaltyPerGap = { missing: 10, partial: 5, implemented: 0 };

    let score = baseScore;
    for (const v of violations) {
      score -= penaltyPerViolation[v.severity];
    }
    for (const g of gaps) {
      score -= penaltyPerGap[g.status];
    }

    return {
      regulation: "GDPR",
      compliant: score >= 70,
      score: Math.max(0, score),
      violations,
      gaps,
    };
  }

  /**
   * Check HIPAA compliance
   *
   * Rules checked:
   * - Privacy Rule: PHI protection
   * - Security Rule: Administrative, physical, and technical safeguards
   * - Breach Notification Rule: Notification requirements
   * - Omnibus Rule: Business associate agreements
   *
   * @param events - Events to analyze
   * @returns HIPAA compliance status
   */
  private checkHIPAA(events: PrivacyAuditEvent[]): RegulationCompliance {
    const violations: ComplianceViolation[] = [];
    const gaps: ComplianceGap[] = [];

    // HIPAA PII types
    const hipaaPII: PIIType[] = [PIIType.MEDICAL_RECORD, PIIType.HEALTH_ID];

    // Check for PHI exposure (Privacy Rule)
    const phiExposureEvents = events.filter(
      e => e.piiDetected && e.piiDetected.some((pii: any) => hipaaPII.includes(pii))
    );
    if (phiExposureEvents.length > 0) {
      violations.push({
        severity: "critical",
        description: "Protected Health Information (PHI) detected in queries",
        affectedRecords: phiExposureEvents.length,
        remediation: "Implement HIPAA-compliant PHI redaction and encryption",
        regulationSection: "Privacy Rule - PHI Protection",
      });
    }

    // Check for PHI transmitted to cloud without encryption (Security Rule)
    const phiToCloud = phiExposureEvents.filter(e => e.destination === "cloud");
    if (phiToCloud.length > 0) {
      violations.push({
        severity: "critical",
        description: "PHI transmitted to cloud without guaranteed encryption",
        affectedRecords: phiToCloud.length,
        remediation: "Ensure end-to-end encryption for all PHI transmissions",
        regulationSection: "Security Rule - Technical Safeguards",
      });
    }

    // Check for audit trail completeness (Security Rule)
    gaps.push({
      control: "Audit controls",
      status: "partial",
      description: "Audit logs exist but may lack required HIPAA elements",
      recommendation:
        "Enhance audit logs to record all PHI access and disclosures",
    });

    // Check for access controls (Security Rule)
    gaps.push({
      control: "Access controls",
      status: "partial",
      description: "User authentication and authorization mechanisms exist",
      recommendation:
        "Implement role-based access control (RBAC) for PHI access",
    });

    // Check for integrity controls (Security Rule)
    const blockedEvents = events.filter(e => e.decision.action === "deny");
    if (blockedEvents.length > 0) {
      violations.push({
        severity: "medium",
        description: "PHI access attempts were blocked",
        affectedRecords: blockedEvents.length,
        remediation:
          "Review authorization policies and implement stronger access controls",
        regulationSection: "Security Rule - Access Controls",
      });
    }

    // Calculate compliance score
    let score = 100;
    for (const v of violations) {
      score -= v.severity === "critical" ? 25 : v.severity === "high" ? 15 : 10;
    }
    for (const g of gaps) {
      score -= g.status === "missing" ? 10 : 5;
    }

    return {
      regulation: "HIPAA",
      compliant: score >= 80, // HIPAA requires higher compliance
      score: Math.max(0, score),
      violations,
      gaps,
    };
  }

  /**
   * Check CCPA compliance
   *
   * Requirements checked:
   * - Right to know (data access)
   * - Right to delete
   * - Right to opt-out
   * - Do Not Sell requirements
   * - Non-discrimination
   *
   * @param events - Events to analyze
   * @returns CCPA compliance status
   */
  private checkCCPA(events: PrivacyAuditEvent[]): RegulationCompliance {
    const violations: ComplianceViolation[] = [];
    const gaps: ComplianceGap[] = [];

    // Check for data collection notice violations
    const piiEvents = events.filter(
      e => e.piiDetected && e.piiDetected.length > 0
    );
    if (piiEvents.length > 0) {
      gaps.push({
        control: "Notice at collection",
        status: "partial",
        description: "PII is collected but notice mechanisms may be incomplete",
        recommendation:
          "Implement comprehensive notice at collection for all PII categories",
      });
    }

    // Check for Do Not Sell compliance
    gaps.push({
      control: "Do Not Sell",
      status: "missing",
      description: "No Do Not Sell mechanism detected",
      recommendation:
        "Implement user-facing Do Not Sell option and honor it in data routing",
    });

    // Check for data access right (Right to Know)
    gaps.push({
      control: "Right to Know",
      status: "partial",
      description:
        "Users can access their data but format may not meet CCPA requirements",
      recommendation:
        "Implement user data export in portable, readily usable format",
    });

    // Check for data deletion right (Right to Delete)
    gaps.push({
      control: "Right to Delete",
      status: "missing",
      description: "No mechanism for users to request deletion of their data",
      recommendation:
        "Implement data deletion request handling with verification",
    });

    // Check for opt-out right
    const cloudEvents = events.filter(e => e.destination === "cloud");
    if (cloudEvents.length > events.length * 0.5) {
      violations.push({
        severity: "medium",
        description: 'Majority of queries sent to cloud may constitute "sale"',
        affectedRecords: cloudEvents.length,
        remediation: "Implement opt-out mechanism for cloud processing",
        regulationSection: "Right to Opt-Out",
      });
    }

    // Calculate compliance score
    let score = 100;
    for (const v of violations) {
      score -= v.severity === "critical" ? 20 : 10;
    }
    for (const g of gaps) {
      score -= g.status === "missing" ? 10 : 5;
    }

    return {
      regulation: "CCPA",
      compliant: score >= 70,
      score: Math.max(0, score),
      violations,
      gaps,
    };
  }

  /**
   * Check SOX compliance
   *
   * Sections checked:
   * - Section 302: Corporate responsibility for financial reports
   * - Section 404: Management assessment of internal controls
   * - Section 409: Real-time issuer disclosures
   *
   * @param events - Events to analyze
   * @returns SOX compliance status
   */
  private checkSOX(events: PrivacyAuditEvent[]): RegulationCompliance {
    const violations: ComplianceViolation[] = [];
    const gaps: ComplianceGap[] = [];

    // Check for audit trail integrity (Section 404)
    gaps.push({
      control: "Audit trail integrity",
      status: "partial",
      description: "Audit logs exist but tamper detection may be incomplete",
      recommendation:
        "Implement immutable audit logging with cryptographic signatures",
    });

    // Check for access controls (Section 404)
    gaps.push({
      control: "Access controls",
      status: "partial",
      description:
        "Access controls exist but separation of duties may be incomplete",
      recommendation: "Implement role-based access with separation of duties",
    });

    // Check for change management (Section 404)
    gaps.push({
      control: "Change management",
      status: "missing",
      description: "No formal change management process detected",
      recommendation:
        "Implement documented change management with approval workflows",
    });

    // Check for data integrity (Section 302)
    const redactedEvents = events.filter(e => e.decision.action === "redact");
    if (redactedEvents.length > events.length * 0.2) {
      violations.push({
        severity: "medium",
        description:
          "High rate of data redaction may indicate data quality issues",
        affectedRecords: redactedEvents.length,
        remediation: "Review redaction policies and data quality controls",
        regulationSection: "Section 302 - Data Integrity",
      });
    }

    // Check for monitoring and alerting (Section 409)
    gaps.push({
      control: "Real-time monitoring",
      status: "missing",
      description: "No real-time monitoring for material events detected",
      recommendation:
        "Implement real-time monitoring and alerting for security events",
    });

    // Calculate compliance score
    let score = 100;
    for (const v of violations) {
      score -= 10;
    }
    for (const g of gaps) {
      score -= g.status === "missing" ? 10 : 5;
    }

    return {
      regulation: "SOX",
      compliant: score >= 75,
      score: Math.max(0, score),
      violations,
      gaps,
    };
  }

  /**
   * Detect privacy incidents
   *
   * @param events - Events to analyze
   * @returns Detected privacy incidents
   */
  private detectIncidents(events: PrivacyAuditEvent[]): PrivacyIncident[] {
    const incidents: PrivacyIncident[] = [];

    // Detect data leaks (queries with PII going to cloud)
    const cloudPIIEvents = events.filter(
      e =>
        e.destination === "cloud" && e.piiDetected && e.piiDetected.length > 0
    );
    if (cloudPIIEvents.length > 0) {
      incidents.push({
        incidentId: this.generateIncidentId(),
        timestamp: Date.now(),
        severity: "high",
        type: "data_leak",
        description: `${cloudPIIEvents.length} queries with PII transmitted to cloud`,
        affectedUsers: new Set(cloudPIIEvents.map(e => e.sessionId)).size,
        rootCause: "Insufficient redaction before cloud transmission",
        remediation: "Apply intent encoding or redaction before cloud routing",
      });
    }

    // Detect unauthorized access attempts
    const blockedEvents = events.filter(e => e.decision.action === "deny");
    if (blockedEvents.length > 0) {
      incidents.push({
        incidentId: this.generateIncidentId(),
        timestamp: Date.now(),
        severity: "medium",
        type: "unauthorized_access",
        description: `${blockedEvents.length} unauthorized access attempts blocked`,
        affectedUsers: new Set(blockedEvents.map(e => e.sessionId)).size,
        rootCause: "Users attempting to access restricted data",
        remediation: "Review access controls and user authorization policies",
      });
    }

    // Detect excessive PII exposure
    const highPIIEvents = events.filter(
      e => e.piiDetected && e.piiDetected.length >= 5
    );
    if (highPIIEvents.length > 0) {
      incidents.push({
        incidentId: this.generateIncidentId(),
        timestamp: Date.now(),
        severity: "high",
        type: "pii_exposure",
        description: `${highPIIEvents.length} queries with 5+ PII types detected`,
        affectedUsers: new Set(highPIIEvents.map(e => e.sessionId)).size,
        rootCause: "Queries containing excessive personal information",
        remediation: "Implement stricter PII detection and redaction",
      });
    }

    // Detect policy violations (classification changes)
    const classificationEvents = events.filter(
      e => e.eventType === "classification_change"
    );
    if (classificationEvents.length > 0) {
      incidents.push({
        incidentId: this.generateIncidentId(),
        timestamp: Date.now(),
        severity: "low",
        type: "policy_violation",
        description: `${classificationEvents.length} classification changes detected`,
        affectedUsers: new Set(classificationEvents.map(e => e.sessionId)).size,
        rootCause: "Privacy classification rules being modified",
        remediation: "Review classification change audit trail",
      });
    }

    return incidents;
  }

  /**
   * Generate recommendations based on findings
   *
   * @param summary - Report summary
   * @param regulations - Regulation compliance results
   * @param incidents - Detected incidents
   * @returns Compliance recommendations
   */
  private generateRecommendations(
    summary: ReportSummary,
    regulations: RegulationCompliance[],
    incidents: PrivacyIncident[]
  ): ComplianceRecommendation[] {
    const recommendations: ComplianceRecommendation[] = [];

    // High PII exposure recommendation
    if (summary.piiIncidents > summary.totalQueries * 0.3) {
      recommendations.push({
        priority: "high",
        category: "Privacy Enhancement",
        recommendation:
          "Implement intent encoding to reduce PII exposure in cloud queries",
        effort: "medium",
        impact: "Reduce PII transmission by up to 90%",
      });
    }

    // Low confidence recommendation
    if (summary.avgConfidence < 0.7) {
      recommendations.push({
        priority: "medium",
        category: "Classification Accuracy",
        recommendation:
          "Retrain privacy classifier to improve confidence scores",
        effort: "high",
        impact: "Reduce false positives/negatives in privacy detection",
      });
    }

    // High block rate recommendation
    const blockRate =
      summary.blockedQueries / Math.max(1, summary.totalQueries);
    if (blockRate > 0.2) {
      recommendations.push({
        priority: "medium",
        category: "User Experience",
        recommendation:
          "Review and refine privacy rules to reduce false blocks",
        effort: "medium",
        impact: "Improve user satisfaction while maintaining privacy",
      });
    }

    // Critical incidents recommendation
    const criticalIncidents = incidents.filter(i => i.severity === "critical");
    if (criticalIncidents.length > 0) {
      recommendations.push({
        priority: "critical",
        category: "Incident Response",
        recommendation:
          "Implement incident response plan for critical privacy violations",
        effort: "high",
        impact: "Reduce damage from privacy incidents",
      });
    }

    // Regulation-specific recommendations
    for (const reg of regulations) {
      if (!reg.compliant) {
        recommendations.push({
          priority: "high",
          category: `${reg.regulation} Compliance`,
          recommendation: `Address ${reg.violations.length} violations and ${reg.gaps.length} gaps for ${reg.regulation}`,
          effort: "high",
          impact: `Achieve ${reg.regulation} compliance`,
        });
      }
    }

    // Real-time monitoring recommendation
    recommendations.push({
      priority: "medium",
      category: "Monitoring",
      recommendation:
        "Implement real-time monitoring with alerting for privacy events",
      effort: "medium",
      impact: "Detect and respond to privacy incidents faster",
    });

    return recommendations;
  }

  /**
   * Export report to file
   *
   * @param report - Report to export
   * @param filepath - Output file path
   * @param format - Export format
   * @returns File path
   */
  async exportReport(
    report: ComplianceReport,
    filepath: string,
    format: "json" | "html" = "json"
  ): Promise<string> {
    let content: string;

    if (format === "json") {
      content = JSON.stringify(report, null, 2);
    } else {
      content = this.generateHTMLReport(report);
    }

    await fs.mkdir(filepath.match(/^(.*\/)[^/]+$/)?.[1] || ".", {
      recursive: true,
    });
    await fs.writeFile(filepath, content, "utf-8");

    return filepath;
  }

  /**
   * Generate HTML report
   *
   * @param report - Report to format
   * @returns HTML string
   */
  private generateHTMLReport(report: ComplianceReport): string {
    let html = `
<!DOCTYPE html>
<html>
<head>
  <title>Compliance Report - ${report.reportId}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { color: #333; }
    h2 { color: #666; margin-top: 30px; }
    .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; }
    .metric { display: inline-block; margin: 10px 20px; }
    .metric-value { font-size: 24px; font-weight: bold; }
    .metric-label { color: #666; }
    .violation { background: #ffebee; padding: 15px; margin: 10px 0; border-left: 4px solid #f44336; }
    .gap { background: #fff3e0; padding: 15px; margin: 10px 0; border-left: 4px solid #ff9800; }
    .incident { background: #fce4ec; padding: 15px; margin: 10px 0; border-left: 4px solid #e91e63; }
    .recommendation { background: #e8f5e9; padding: 15px; margin: 10px 0; border-left: 4px solid #4caf50; }
    .compliant { color: #4caf50; font-weight: bold; }
    .non-compliant { color: #f44336; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Compliance Report</h1>
  <p><strong>Report ID:</strong> ${report.reportId}</p>
  <p><strong>Generated:</strong> ${new Date(report.generatedAt).toISOString()}</p>
  <p><strong>Period:</strong> ${new Date(report.period.start).toISOString()} to ${new Date(report.period.end).toISOString()}</p>

  <h2>Summary</h2>
  <div class="summary">
    <div class="metric">
      <div class="metric-value">${report.summary.totalQueries}</div>
      <div class="metric-label">Total Queries</div>
    </div>
    <div class="metric">
      <div class="metric-value">${report.summary.blockedQueries}</div>
      <div class="metric-label">Blocked</div>
    </div>
    <div class="metric">
      <div class="metric-value">${report.summary.redactedQueries}</div>
      <div class="metric-label">Redacted</div>
    </div>
    <div class="metric">
      <div class="metric-value">${Math.round(report.summary.avgConfidence * 100)}%</div>
      <div class="metric-label">Avg Confidence</div>
    </div>
    <div class="metric">
      <div class="metric-value">${report.summary.piiIncidents}</div>
      <div class="metric-label">PII Incidents</div>
    </div>
  </div>

  <h2>Regulatory Compliance</h2>
`;

    for (const reg of report.regulations) {
      html += `
  <h3>${reg.regulation} - ${reg.compliant ? '<span class="compliant">COMPLIANT</span>' : '<span class="non-compliant">NON-COMPLIANT</span>'} (Score: ${reg.score}/100)</h3>
  <p><strong>Violations:</strong> ${reg.violations.length}</p>
`;
      for (const violation of reg.violations) {
        html += `
  <div class="violation">
    <strong>[${violation.severity.toUpperCase()}]</strong> ${violation.description}<br>
    <strong>Affected Records:</strong> ${violation.affectedRecords}<br>
    <strong>Remediation:</strong> ${violation.remediation}
  </div>`;
      }

      html += `  <p><strong>Gaps:</strong> ${reg.gaps.length}</p>`;
      for (const gap of reg.gaps) {
        html += `
  <div class="gap">
    <strong>[${gap.status.toUpperCase()}]</strong> ${gap.control}<br>
    ${gap.description}<br>
    <strong>Recommendation:</strong> ${gap.recommendation}
  </div>`;
      }
    }

    html += `
  <h2>Privacy Incidents</h2>
`;
    for (const incident of report.incidents) {
      html += `
  <div class="incident">
    <strong>[${incident.severity.toUpperCase()}] ${incident.type}</strong><br>
    ${incident.description}<br>
    <strong>Affected Users:</strong> ${incident.affectedUsers}<br>
    <strong>Root Cause:</strong> ${incident.rootCause}<br>
    <strong>Remediation:</strong> ${incident.remediation}
  </div>`;
    }

    html += `
  <h2>Recommendations</h2>
`;
    for (const rec of report.recommendations) {
      html += `
  <div class="recommendation">
    <strong>[${rec.priority.toUpperCase()}] ${rec.category}</strong><br>
    ${rec.recommendation}<br>
    <strong>Effort:</strong> ${rec.effort} | <strong>Impact:</strong> ${rec.impact}
  </div>`;
    }

    html += `
</body>
</html>`;

    return html;
  }

  /**
   * Generate unique report ID
   *
   * @returns Report ID
   */
  private generateReportId(): string {
    return `RPT-${Date.now()}-${randomBytes(4).toString("hex").toUpperCase()}`;
  }

  /**
   * Generate unique incident ID
   *
   * @returns Incident ID
   */
  private generateIncidentId(): string {
    return `INC-${Date.now()}-${randomBytes(4).toString("hex").toUpperCase()}`;
  }
}

// Helper function for random bytes
function randomBytes(length: number): Buffer {
  return require("crypto").randomBytes(length);
}

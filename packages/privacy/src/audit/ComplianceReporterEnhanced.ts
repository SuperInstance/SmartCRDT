/**
 * ComplianceReporterEnhanced - Advanced regulatory compliance reporting
 *
 * Enhanced compliance reporting with:
 * - GDPR Article 30 (Records of Processing)
 * - HIPAA Security Rule compliance
 * - CCPA/CPRA compliance
 * - SOX Section 404 compliance
 * - PII inventory reports
 * - Data access reports
 * - Privacy impact assessments
 * - Data breach notification workflow
 *
 * @packageDocumentation
 */

import { createHash } from "crypto";
import { promises as fs } from "fs";
import type { EnhancedAuditEvent } from "./AuditLoggerEnhanced.js";
import type {
  PIIInventoryEntry,
  DataAccessLogEntry,
  ConsentChangeLogEntry,
  AggregatedAnalytics,
} from "./AuditLoggerEnhanced.js";

/**
 * GDPR Article 30 Record of Processing Activity
 */
export interface GDPRROPARecord {
  /** Controller/processor name */
  controllerName: string;
  /** Controller/processor representative */
  representative?: string;
  /** Purposes of processing */
  purposes: string[];
  /** Categories of data subjects */
  dataSubjectCategories: string[];
  /** Categories of personal data */
  personalDataCategories: string[];
  /** Categories of recipients */
  recipientCategories: string[];
  /** Third-country transfers */
  thirdCountryTransfers: {
    country: string;
    safeguards: string;
    transferCount: number;
  }[];
  /** Time limits for erasure */
  retentionPeriods: { category: string; period: string }[];
  /** Security measures */
  securityMeasures: string[];
  /** Data processing activities */
  processingActivities: {
    activity: string;
    purpose: string;
    legalBasis: string;
    dataCategories: string[];
    recipients: string[];
    retention: string;
  }[];
}

/**
 * HIPAA Security Rule compliance
 */
export interface HIPAAComplianceReport {
  /** Administrative safeguards */
  administrativeSafeguards: {
    implemented: string[];
    partial: string[];
    missing: string[];
  };
  /** Physical safeguards */
  physicalSafeguards: {
    implemented: string[];
    partial: string[];
    missing: string[];
  };
  /** Technical safeguards */
  technicalSafeguards: {
    implemented: string[];
    partial: string[];
    missing: string[];
  };
  /** Required implementation specifications */
  requiredImplementations: {
    specification: string;
    status: "implemented" | "partial" | "missing";
    evidence: string[];
  }[];
  /** Addressable implementation specifications */
  addressableImplementations: {
    specification: string;
    status: "implemented" | "partial" | "missing" | "n/a";
    rationale?: string;
    evidence: string[];
  }[];
  /** Risk analysis findings */
  riskAnalysis: {
    risk: string;
    likelihood: "low" | "medium" | "high";
    impact: "low" | "medium" | "high";
    mitigation?: string;
  }[];
}

/**
 * CCPA/CPRA compliance report
 */
export interface CCPAComplianceReport {
  /** Consumer rights implementation */
  consumerRights: {
    rightToKnow: boolean;
    rightToDelete: boolean;
    rightToOptOut: boolean;
    rightToNonDiscrimination: boolean;
    rightToCorrect: boolean;
    rightToLimitUse: boolean;
  };
  /** Do Not Sell implementation */
  doNotSell: {
    implemented: boolean;
    optOutRate: number;
    exemptions: string[];
  };
  /** Data categories sold/shared */
  dataSoldShared: {
    category: string;
    sold: boolean;
    shared: boolean;
    thirdParties: string[];
  }[];
  /**Sensitive personal data handling */
  sensitiveData: {
    category: string;
    consentRequired: boolean;
    consentObtained: number;
  }[];
  /** Financial incentives */
  financialIncentives: {
    offered: boolean;
    description?: string;
    signLanguage: boolean;
  };
}

/**
 * SOX Section 404 compliance report
 */
export interface SOXComplianceReport {
  /** Internal control structure */
  internalControls: {
    control: string;
    type: "preventive" | "detective" | "corrective";
    status: "effective" | "ineffective" | "needs-improvement";
    testingFrequency: string;
    lastTested: number;
    deficiencies: string[];
  }[];
  /** Access controls */
  accessControls: {
    segregationOfDuties: boolean;
    roleBasedAccess: boolean;
    leastPrivilege: boolean;
    reviewFrequency: string;
  };
  /** Change management */
  changeManagement: {
    documented: boolean;
    approvalRequired: boolean;
    rollbackCapability: boolean;
    auditTrail: boolean;
  };
  /** Data integrity */
  dataIntegrity: {
    validationRules: boolean;
    checksumVerification: boolean;
    tamperDetection: boolean;
  };
  /** Disclosure controls */
  disclosureControls: {
    materialEventDetection: boolean;
    realTimeMonitoring: boolean;
    escalationProcedures: boolean;
  };
}

/**
 * Privacy impact assessment
 */
export interface PrivacyImpactAssessment {
  /** Assessment ID */
  assessmentId: string;
  /** Assessment date */
  assessmentDate: number;
  /** System/process being assessed */
  systemName: string;
  /** System owner */
  systemOwner: string;
  /**Description of processing */
  processingDescription: string;
  /**Data categories involved */
  dataCategories: string[];
  /**PII types involved */
  piiTypes: string[];
  /**Purposes of processing */
  purposes: string[];
  /**Legal bases */
  legalBases: string[];
  /**Risk assessment */
  risks: {
    risk: string;
    likelihood: "low" | "medium" | "high";
    severity: "low" | "medium" | "high";
    mitigation: string;
    residualRisk: "low" | "medium" | "high";
  }[];
  /**Compliance assessment */
  compliance: {
    regulation: string;
    compliant: boolean;
    gaps: string[];
  }[];
  /**Recommendations */
  recommendations: string[];
  /**Overall risk level */
  overallRisk: "low" | "medium" | "high";
  /**Approved/rejected */
  status: "approved" | "rejected" | "needs-review";
}

/**
 * Data breach notification
 */
export interface DataBreachNotification {
  /** Breach ID */
  breachId: string;
  /** Detection timestamp */
  detectedAt: number;
  /**Breach severity */
  severity: "low" | "medium" | "high" | "critical";
  /**Breach type */
  type: "unauthorized_access" | "unauthorized_disclosure" | "data_loss" | "data_modification";
  /**Data categories affected */
  dataCategoriesAffected: string[];
  /**PII types affected */
  piiTypesAffected: string[];
  /**Number of individuals affected */
  individualsAffected: number;
  /**Root cause */
  rootCause: string;
  /**Containment actions */
  containmentActions: string[];
  /**Notification requirements */
  notificationRequirements: {
    authority: string;
    deadline: number;
    notified: boolean;
    notifiedAt?: number;
  }[];
  /**Individual notification required */
  notifyIndividuals: boolean;
  /**Timeline for notification */
  notificationTimeline?: {
    thresholdDays: number;
    actualDays?: number;
    delayedReason?: string;
  };
  /**Remediation steps */
  remediationSteps: string[];
  /**Preventive measures */
  preventiveMeasures: string[];
  /**Status */
  status: "investigating" | "contained" | "notifying" | "resolved";
}

/**
 * Enhanced compliance report
 */
export interface EnhancedComplianceReport {
  /** Report ID */
  reportId: string;
  /** Report generation timestamp */
  generatedAt: number;
  /** Time period covered */
  period: { start: number; end: number };

  /** Overall compliance score */
  overallScore: number;

  /**GDPR compliance */
  gdpr?: {
    score: number;
    compliant: boolean;
    ropa: GDPRROPARecord;
    violations: string[];
    gaps: string[];
  };

  /**HIPAA compliance */
  hipaa?: {
    score: number;
    compliant: boolean;
    report: HIPAAComplianceReport;
  };

  /**CCPA/CPRA compliance */
  ccpa?: {
    score: number;
    compliant: boolean;
    report: CCPAComplianceReport;
  };

  /**SOX compliance */
  sox?: {
    score: number;
    compliant: boolean;
    report: SOXComplianceReport;
  };

  /**PII inventory */
  piiInventory: PIIInventoryEntry[];

  /**Privacy incidents */
  incidents: DataBreachNotification[];

  /**Recommendations */
  recommendations: {
    priority: "critical" | "high" | "medium" | "low";
    category: string;
    recommendation: string;
    effort: "low" | "medium" | "high";
    impact: string;
  }[];
}

/**
 * Report generation options
 */
export interface EnhancedReportOptions {
  /** Regulations to include */
  regulations?: Array<"GDPR" | "HIPAA" | "CCPA" | "SOX">;
  /**Include detailed PII inventory */
  includePIIInventory?: boolean;
  /**Include privacy impact assessment */
  includePIA?: boolean;
  /**Include data breach notifications */
  includeBreachNotifications?: boolean;
  /**Minimum severity for violations */
  minSeverity?: "low" | "medium" | "high" | "critical";
  /**Organization details */
  organization?: {
    name: string;
    address: string;
    contact: string;
    dpo?: string;
  };
}

/**
 * ComplianceReporterEnhanced - Generate enhanced compliance reports
 *
 * Provides comprehensive compliance reporting for:
 * - GDPR (Articles 7, 15-17, 20, 25, 28, 30, 32)
 * - HIPAA (Privacy Rule, Security Rule, Breach Notification)
 * - CCPA/CPRA (consumer rights, Do Not Sell, data sharing)
 * - SOX (Sections 302, 404, 409)
 */
export class ComplianceReporterEnhanced {
  /**
   * Generate comprehensive compliance report
   *
   * @param events - Audit events to analyze
   * @param piiInventory - PII inventory
   * @param consentLog - Consent change log
   * @param dataAccessLog - Data access log
   * @param period - Time period for report
   * @param options - Report generation options
   * @returns Enhanced compliance report
   */
  async generateReport(
    events: EnhancedAuditEvent[],
    piiInventory: PIIInventoryEntry[],
    consentLog: ConsentChangeLogEntry[],
    dataAccessLog: DataAccessLogEntry[],
    period: { start: number; end: number },
    options: EnhancedReportOptions = {}
  ): Promise<EnhancedComplianceReport> {
    const reportId = this.generateReportId();
    const regulations = options.regulations || ["GDPR", "HIPAA", "CCPA", "SOX"];

    // Filter events by time period
    const filteredEvents = events.filter(
      e => e.timestamp >= period.start && e.timestamp <= period.end
    );

    // Calculate overall compliance score
    let overallScore = 100;
    const regulationScores: number[] = [];

    // GDPR compliance
    let gdpr: EnhancedComplianceReport["gdpr"] | undefined;
    if (regulations.includes("GDPR")) {
      gdpr = this.assessGDPR(filteredEvents, piiInventory, consentLog, options);
      regulationScores.push(gdpr!.score);
    }

    // HIPAA compliance
    let hipaa: EnhancedComplianceReport["hipaa"] | undefined;
    if (regulations.includes("HIPAA")) {
      hipaa = this.assessHIPAA(filteredEvents, piiInventory);
      regulationScores.push(hipaa!.score);
    }

    // CCPA compliance
    let ccpa: EnhancedComplianceReport["ccpa"] | undefined;
    if (regulations.includes("CCPA")) {
      ccpa = this.assessCCPA(filteredEvents, consentLog, dataAccessLog);
      regulationScores.push(ccpa!.score);
    }

    // SOX compliance
    let sox: EnhancedComplianceReport["sox"] | undefined;
    if (regulations.includes("SOX")) {
      sox = this.assessSOX(filteredEvents);
      regulationScores.push(sox!.score);
    }

    overallScore = regulationScores.length > 0
      ? regulationScores.reduce((sum, score) => sum + score, 0) / regulationScores.length
      : 100;

    // Detect privacy incidents
    const incidents = this.detectDataBreaches(filteredEvents);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      filteredEvents,
      piiInventory,
      { gdpr, hipaa, ccpa, sox },
      incidents
    );

    return {
      reportId,
      generatedAt: Date.now(),
      period,
      overallScore,
      gdpr,
      hipaa,
      ccpa,
      sox,
      piiInventory: options.includePIIInventory ? piiInventory : [],
      incidents,
      recommendations,
    };
  }

  /**
   * Assess GDPR compliance
   */
  private assessGDPR(
    events: EnhancedAuditEvent[],
    piiInventory: PIIInventoryEntry[],
    consentLog: ConsentChangeLogEntry[],
    options: EnhancedReportOptions
  ): EnhancedComplianceReport["gdpr"] {
    let score = 100;
    const violations: string[] = [];
    const gaps: string[] = [];

    // Check for data minimization violations (Article 5)
    const excessivePIIEvents = events.filter(
      e => e.piiDetected && e.piiDetected.length >= 5
    );
    if (excessivePIIEvents.length > 0) {
      violations.push(
        `${excessivePIIEvents.length} queries with excessive PII detected (Article 5 - Data minimization)`
      );
      score -= 10;
    }

    // Check for consent (Article 7)
    const eventsWithPII = events.filter(e => e.piiDetected && e.piiDetected.length > 0);
    const eventsWithoutConsent = eventsWithPII.filter(e => !e.consentStatus);
    if (eventsWithoutConsent.length > 0) {
      violations.push(
        `${eventsWithoutConsent.length} queries with PII without documented consent (Article 7)`
      );
      score -= 15;
    }

    // Check for right to erasure implementation (Article 17)
    const deletionConsent = consentLog.filter(e => e.action === "revoked");
    if (deletionConsent.length === 0) {
      gaps.push("Right to erasure (right to be forgotten) not implemented (Article 17)");
      score -= 10;
    }

    // Check for data portability (Article 20)
    gaps.push("Data portability mechanism not verified (Article 20)");
    score -= 5;

    // Check for encryption (Article 32)
    const cloudPIIEvents = events.filter(
      e => e.destination === "cloud" && e.piiDetected && e.piiDetected.length > 0
    );
    if (cloudPIIEvents.length > 0) {
      const unencrypted = cloudPIIEvents.filter(e => !e.encrypted);
      if (unencrypted.length > 0) {
        violations.push(
          `${unencrypted.length} queries with PII sent to cloud without encryption (Article 32)`
        );
        score -= 20;
      }
    }

    // Check for data breach notification capability (Article 33)
    gaps.push("Data breach notification procedures not verified (Article 33)");
    score -= 5;

    // Generate ROPA (Article 30)
    const ropa = this.generateROPA(events, piiInventory, options);

    return {
      score: Math.max(0, score),
      compliant: score >= 70,
      ropa,
      violations,
      gaps,
    };
  }

  /**
   * Generate GDPR Article 30 ROPA
   */
  private generateROPA(
    events: EnhancedAuditEvent[],
    piiInventory: PIIInventoryEntry[],
    options: EnhancedReportOptions
  ): GDPRROPARecord {
    // Extract unique purposes from events
    const purposes = new Set<string>();
    const dataSubjectCategories = new Set<string>();
    const personalDataCategories = new Set<string>();
    const recipientCategories = new Set<string>();
    const thirdCountryTransfers = new Map<string, { count: number; safeguards: string }>();

    for (const event of events) {
      if (event.metadata?.purpose) {
        purposes.add(event.metadata.purpose as string);
      }
      if (event.dataCategories) {
        event.dataCategories.forEach(cat => personalDataCategories.add(cat));
      }
      if (event.destination === "cloud") {
        recipientCategories.add("cloud-service-providers");
        if (event.location?.country && event.location.country !== "US") {
          const existing = thirdCountryTransfers.get(event.location.country);
          thirdCountryTransfers.set(event.location.country, {
            count: (existing?.count || 0) + 1,
            safeguards: event.encrypted ? "encryption-in-transit" : "none-detected",
          });
        }
      }
    }

    // Default data subject categories
    dataSubjectCategories.add("customers");
    dataSubjectCategories.add("website-visitors");

    return {
      controllerName: options.organization?.name || "Organization Name Not Specified",
      representative: options.organization?.contact,
      purposes: Array.from(purposes),
      dataSubjectCategories: Array.from(dataSubjectCategories),
      personalDataCategories: Array.from(personalDataCategories),
      recipientCategories: Array.from(recipientCategories),
      thirdCountryTransfers: Array.from(thirdCountryTransfers.entries()).map(([country, data]) => ({
        country,
        safeguards: data.safeguards,
        transferCount: data.count,
      })),
      retentionPeriods: piiInventory.map(entry => ({
        category: entry.type,
        period: entry.retentionPeriod ? `${entry.retentionPeriod}ms` : "not-specified",
      })),
      securityMeasures: [
        "Access controls",
        "Encryption in transit",
        "Encryption at rest",
        "Audit logging",
        "Privacy by design",
      ],
      processingActivities: [
        {
          activity: "query-processing",
          purpose: "Process user queries",
          legalBasis: "consent",
          dataCategories: Array.from(personalDataCategories),
          recipients: Array.from(recipientCategories),
          retention: "as-needed",
        },
      ],
    };
  }

  /**
   * Assess HIPAA compliance
   */
  private assessHIPAA(
    events: EnhancedAuditEvent[],
    piiInventory: PIIInventoryEntry[]
  ): EnhancedComplianceReport["hipaa"] {
    let score = 100;
    const administrativeSafeguards = { implemented: [] as string[], partial: [] as string[], missing: [] as string[] };
    const physicalSafeguards = { implemented: [] as string[], partial: [] as string[], missing: [] as string[] };
    const technicalSafeguards = { implemented: [] as string[], partial: [] as string[], missing: [] as string[] };
    const requiredImplementations: any[] = [];
    const addressableImplementations: any[] = [];
    const riskAnalysis: any[] = [];

    // Check for PHI (Protected Health Information)
    const hipaaPII = new Set(["MEDICAL_RECORD", "HEALTH_ID", "BIOMETRIC", "GENETIC"]);
    const phiEvents = events.filter(
      e => e.piiDetected && e.piiDetected.some(pii => hipaaPII.has(pii as string))
    );

    if (phiEvents.length > 0) {
      // HIPAA applies
      administrativeSafeguards.implemented.push("Security management process");
      administrativeSafeguards.implemented.push("Assigned security responsibility");

      // Check for access controls
      const blockedEvents = events.filter(e => e.decision.action === "deny");
      if (blockedEvents.length > 0) {
        technicalSafeguards.implemented.push("Access control");
        requiredImplementations.push({
          specification: "Unique user identification",
          status: "implemented",
          evidence: ["User ID hashing", "Session tracking"],
        });
      } else {
        technicalSafeguards.missing.push("Access control");
        requiredImplementations.push({
          specification: "Unique user identification",
          status: "missing",
          evidence: [],
        });
        score -= 15;
      }

      // Check for encryption
      const encryptedEvents = events.filter(e => e.encrypted);
      if (encryptedEvents.length > 0) {
        technicalSafeguards.implemented.push("Encryption");
        addressableImplementations.push({
          specification: "Encryption and decryption",
          status: "implemented",
          evidence: ["Encrypted events detected"],
        });
      } else {
        addressableImplementations.push({
          specification: "Encryption and decryption",
          status: "missing",
          rationale: "Addressable but not implemented",
          evidence: [],
        });
        score -= 10;
      }

      // Check audit controls
      technicalSafeguards.implemented.push("Audit controls");
      requiredImplementations.push({
        specification: "Audit controls",
        status: "implemented",
        evidence: ["Comprehensive audit logging"],
      });

      // Risk analysis
      riskAnalysis.push({
        risk: "PHI exposure in cloud queries",
        likelihood: phiEvents.filter(e => e.destination === "cloud").length > 0 ? "medium" : "low",
        impact: "high",
        mitigation: "Implement encryption and access controls",
        residualRisk: "medium",
      });

      // Administrative safeguards gaps
      administrativeSafeguards.partial.push("Workforce security training");
      administrativeSafeguards.missing.push("Business associate agreements");
      score -= 5;

      // Physical safeguards
      physicalSafeguards.missing.push("Facility access controls");
      physicalSafeguards.missing.push("Workstation security");
      score -= 5;
    } else {
      // HIPAA doesn't apply (no PHI)
      return {
        score: 100,
        compliant: true,
        report: {
          administrativeSafeguards: { implemented: [], partial: [], missing: [] },
          physicalSafeguards: { implemented: [], partial: [], missing: [] },
          technicalSafeguards: { implemented: [], partial: [], missing: [] },
          requiredImplementations: [],
          addressableImplementations: [],
          riskAnalysis: [],
        },
      };
    }

    return {
      score: Math.max(0, score),
      compliant: score >= 80,
      report: {
        administrativeSafeguards,
        physicalSafeguards,
        technicalSafeguards,
        requiredImplementations,
        addressableImplementations,
        riskAnalysis,
      },
    };
  }

  /**
   * Assess CCPA/CPRA compliance
   */
  private assessCCPA(
    events: EnhancedAuditEvent[],
    consentLog: ConsentChangeLogEntry[],
    dataAccessLog: DataAccessLogEntry[]
  ): EnhancedComplianceReport["ccpa"] {
    let score = 100;

    // Consumer rights
    const consumerRights = {
      rightToKnow: dataAccessLog.length > 0,
      rightToDelete: consentLog.some(e => e.action === "revoked"),
      rightToOptOut: false, // Would need Do Not Sell implementation
      rightToNonDiscrimination: true, // Assume no discrimination
      rightToCorrect: false, // Not implemented
      rightToLimitUse: false, // Not implemented
    };

    if (!consumerRights.rightToKnow) score -= 10;
    if (!consumerRights.rightToDelete) score -= 10;
    if (!consumerRights.rightToOptOut) score -= 15;
    if (!consumerRights.rightToCorrect) score -= 5;
    if (!consumerRights.rightToLimitUse) score -= 5;

    // Do Not Sell
    const doNotSell = {
      implemented: false,
      optOutRate: 0,
      exemptions: [],
    };
    score -= 10; // Penalty for missing Do Not Sell

    // Data sold/shared
    const cloudEvents = events.filter(e => e.destination === "cloud");
    const dataCategoriesShared = new Set<string>();
    cloudEvents.forEach(e => e.dataCategories?.forEach(cat => dataCategoriesShared.add(cat)));

    const dataSoldShared = Array.from(dataCategoriesShared).map(category => ({
      category,
      sold: false,
      shared: true,
      thirdParties: ["cloud-service-providers"],
    }));

    // Sensitive data
    const sensitiveData = [
      {
        category: "social-security",
        consentRequired: true,
        consentObtained: consentLog.filter(e => e.dataCategories.includes("social-security")).length,
      },
      {
        category: "health-data",
        consentRequired: true,
        consentObtained: consentLog.filter(e => e.dataCategories.includes("health-data")).length,
      },
    ];

    // Financial incentives (not implemented)
    const financialIncentives = {
      offered: false,
      description: undefined,
      signLanguage: false,
    };

    return {
      score: Math.max(0, score),
      compliant: score >= 70,
      report: {
        consumerRights,
        doNotSell,
        dataSoldShared,
        sensitiveData,
        financialIncentives,
      },
    };
  }

  /**
   * Assess SOX compliance
   */
  private assessSOX(events: EnhancedAuditEvent[]): EnhancedComplianceReport["sox"] {
    let score = 100;

    // Internal controls
    const internalControls = [
      {
        control: "Audit logging",
        type: "detective" as const,
        status: "effective" as const,
        testingFrequency: "continuous",
        lastTested: Date.now(),
        deficiencies: [],
      },
      {
        control: "Access control",
        type: "preventive" as const,
        status: "needs-improvement" as const,
        testingFrequency: "quarterly",
        lastTested: Date.now() - 30 * 24 * 60 * 60 * 1000,
        deficiencies: ["Separation of duties not verified"],
      },
    ];

    // Access controls
    const accessControls = {
      segregationOfDuties: false,
      roleBasedAccess: true,
      leastPrivilege: true,
      reviewFrequency: "quarterly",
    };
    score -= 10; // Penalty for missing segregation of duties

    // Change management
    const changeManagement = {
      documented: true,
      approvalRequired: false,
      rollbackCapability: true,
      auditTrail: true,
    };
    score -= 5; // Penalty for missing approval requirements

    // Data integrity
    const dataIntegrity = {
      validationRules: true,
      checksumVerification: false,
      tamperDetection: false,
    };
    score -= 10; // Penalty for missing checksum and tamper detection

    // Disclosure controls
    const disclosureControls = {
      materialEventDetection: true,
      realTimeMonitoring: true,
      escalationProcedures: false,
    };
    score -= 5; // Penalty for missing escalation procedures

    return {
      score: Math.max(0, score),
      compliant: score >= 75,
      report: {
        internalControls,
        accessControls,
        changeManagement,
        dataIntegrity,
        disclosureControls,
      },
    };
  }

  /**
   * Detect data breaches
   */
  private detectDataBreaches(events: EnhancedAuditEvent[]): DataBreachNotification[] {
    const breaches: DataBreachNotification[] = [];

    // Detect unauthorized disclosure (PII to cloud without encryption)
    const cloudPIIEvents = events.filter(
      e => e.destination === "cloud" && e.piiDetected && e.piiDetected.length > 0 && !e.encrypted
    );

    if (cloudPIIEvents.length > 0) {
      breaches.push({
        breachId: this.generateBreachId(),
        detectedAt: Date.now(),
        severity: cloudPIIEvents.length > 10 ? "high" : "medium",
        type: "unauthorized_disclosure",
        dataCategoriesAffected: ["personal-data"],
        piiTypesAffected: [...new Set(cloudPIIEvents.flatMap(e => e.piiDetected || []))],
        individualsAffected: new Set(cloudPIIEvents.map(e => e.userIdHash)).size,
        rootCause: "PII transmitted to cloud without encryption",
        containmentActions: [
          "Identify affected queries",
          "Review encryption settings",
          "Enable encryption for cloud queries",
        ],
        notificationRequirements: [
          {
            authority: "Data Protection Authority",
            deadline: Date.now() + 72 * 60 * 60 * 1000, // 72 hours
            notified: false,
          },
        ],
        notifyIndividuals: cloudPIIEvents.length > 5,
        remediationSteps: [
          "Enable encryption for all cloud queries",
          "Review and update security policies",
          "Conduct privacy impact assessment",
        ],
        preventiveMeasures: [
          "Mandatory encryption for cloud queries",
          "Enhanced monitoring for PII transmission",
          "Regular security awareness training",
        ],
        status: "investigating",
      });
    }

    return breaches;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    events: EnhancedAuditEvent[],
    piiInventory: PIIInventoryEntry[],
    compliance: {
      gdpr?: EnhancedComplianceReport["gdpr"];
      hipaa?: EnhancedComplianceReport["hipaa"];
      ccpa?: EnhancedComplianceReport["ccpa"];
      sox?: EnhancedComplianceReport["sox"];
    },
    incidents: DataBreachNotification[]
  ): EnhancedComplianceReport["recommendations"] {
    const recommendations: EnhancedComplianceReport["recommendations"] = [];

    // GDPR recommendations
    if (compliance.gdpr && !compliance.gdpr.compliant) {
      for (const gap of compliance.gdpr.gaps) {
        recommendations.push({
          priority: "high",
          category: "GDPR Compliance",
          recommendation: `Address gap: ${gap}`,
          effort: "medium",
          impact: "Improve GDPR compliance score",
        });
      }
    }

    // HIPAA recommendations
    if (compliance.hipaa && !compliance.hipaa.compliant) {
      recommendations.push({
        priority: "high",
        category: "HIPAA Compliance",
        recommendation: "Implement missing HIPAA safeguards",
        effort: "high",
        impact: "Achieve HIPAA compliance",
      });
    }

    // CCPA recommendations
    if (compliance.ccpa && !compliance.ccpa.compliant) {
      recommendations.push({
        priority: "medium",
        category: "CCPA Compliance",
        recommendation: "Implement Do Not Sell mechanism",
        effort: "medium",
        impact: "Achieve CCPA compliance",
      });
    }

    // PII exposure recommendations
    const highPIIEvents = events.filter(e => e.piiDetected && e.piiDetected.length >= 5);
    if (highPIIEvents.length > 0) {
      recommendations.push({
        priority: "high",
        category: "Privacy Enhancement",
        recommendation: "Reduce PII exposure through intent encoding",
        effort: "medium",
        impact: "Reduce PII transmission by up to 90%",
      });
    }

    // Encryption recommendations
    const unencryptedCloudEvents = events.filter(
      e => e.destination === "cloud" && e.piiDetected && e.piiDetected.length > 0 && !e.encrypted
    );
    if (unencryptedCloudEvents.length > 0) {
      recommendations.push({
        priority: "critical",
        category: "Security",
        recommendation: "Enable encryption for all cloud queries with PII",
        effort: "low",
        impact: "Protect PII in transit",
      });
    }

    // Incident response recommendations
    if (incidents.length > 0) {
      recommendations.push({
        priority: "critical",
        category: "Incident Response",
        recommendation: "Implement incident response plan for detected breaches",
        effort: "high",
        impact: "Mitigate damage from privacy incidents",
      });
    }

    return recommendations;
  }

  /**
   * Export report to file
   */
  async exportReport(
    report: EnhancedComplianceReport,
    filepath: string,
    format: "json" | "html" = "json"
  ): Promise<string> {
    let content: string;

    if (format === "json") {
      content = JSON.stringify(report, null, 2);
    } else {
      content = this.generateHTMLReport(report);
    }

    await fs.mkdir(filepath.match(/^(.*\/)[^/]+$/)?.[1] || ".", { recursive: true });
    await fs.writeFile(filepath, content, "utf-8");

    return filepath;
  }

  /**
   * Generate HTML report
   */
  private generateHTMLReport(report: EnhancedComplianceReport): string {
    let html = `
<!DOCTYPE html>
<html>
<head>
  <title>Enhanced Compliance Report - ${report.reportId}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { color: #333; }
    h2 { color: #666; margin-top: 30px; }
    .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; }
    .score-circle { width: 150px; height: 150px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 36px; font-weight: bold; color: white; }
    .score-high { background: #4caf50; }
    .score-medium { background: #ff9800; }
    .score-low { background: #f44336; }
    .violation { background: #ffebee; padding: 15px; margin: 10px 0; border-left: 4px solid #f44336; }
    .gap { background: #fff3e0; padding: 15px; margin: 10px 0; border-left: 4px solid #ff9800; }
    .recommendation { background: #e8f5e9; padding: 15px; margin: 10px 0; border-left: 4px solid #4caf50; }
    .compliant { color: #4caf50; font-weight: bold; }
    .non-compliant { color: #f44336; font-weight: bold; }
    .incident { background: #fce4ec; padding: 15px; margin: 10px 0; border-left: 4px solid #e91e63; }
  </style>
</head>
<body>
  <h1>Enhanced Compliance Report</h1>
  <p><strong>Report ID:</strong> ${report.reportId}</p>
  <p><strong>Generated:</strong> ${new Date(report.generatedAt).toISOString()}</p>
  <p><strong>Period:</strong> ${new Date(report.period.start).toISOString()} to ${new Date(report.period.end).toISOString()}</p>

  <h2>Overall Compliance Score</h2>
  <div class="summary">
    <div class="score-circle ${report.overallScore >= 80 ? 'score-high' : report.overallScore >= 60 ? 'score-medium' : 'score-low'}">
      ${Math.round(report.overallScore)}%
    </div>
  </div>

  <h2>Regulatory Compliance</h2>
`;

    // GDPR section
    if (report.gdpr) {
      html += `
  <h3>GDPR - ${report.gdpr.compliant ? '<span class="compliant">COMPLIANT</span>' : '<span class="non-compliant">NON-COMPLIANT</span>'} (Score: ${report.gdpr.score}/100)</h3>
  <p><strong>Violations:</strong> ${report.gdpr.violations.length}</p>
`;
      for (const violation of report.gdpr.violations) {
        html += `  <div class="violation"><strong>Violation:</strong> ${violation}</div>`;
      }
      html += `  <p><strong>Gaps:</strong> ${report.gdpr.gaps.length}</p>`;
      for (const gap of report.gdpr.gaps) {
        html += `  <div class="gap"><strong>Gap:</strong> ${gap}</div>`;
      }
    }

    // HIPAA section
    if (report.hipaa) {
      html += `
  <h3>HIPAA - ${report.hipaa.compliant ? '<span class="compliant">COMPLIANT</span>' : '<span class="non-compliant">NON-COMPLIANT</span>'} (Score: ${report.hipaa.score}/100)</h3>
`;
    }

    // CCPA section
    if (report.ccpa) {
      html += `
  <h3>CCPA/CPRA - ${report.ccpa.compliant ? '<span class="compliant">COMPLIANT</span>' : '<span class="non-compliant">NON-COMPLIANT</span>'} (Score: ${report.ccpa.score}/100)</h3>
`;
    }

    // SOX section
    if (report.sox) {
      html += `
  <h3>SOX - ${report.sox.compliant ? '<span class="compliant">COMPLIANT</span>' : '<span class="non-compliant">NON-COMPLIANT</span>'} (Score: ${report.sox.score}/100)</h3>
`;
    }

    // Incidents section
    html += `
  <h2>Privacy Incidents</h2>
`;
    for (const incident of report.incidents) {
      html += `
  <div class="incident">
    <strong>[${incident.severity.toUpperCase()}] ${incident.type}</strong><br>
    ${incident.breachId}<br>
    <strong>Affected:</strong> ${incident.individualsAffected} individuals<br>
    <strong>Root Cause:</strong> ${incident.rootCause}
  </div>`;
    }

    // Recommendations section
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
   */
  private generateReportId(): string {
    return `ECR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  /**
   * Generate unique breach ID
   */
  private generateBreachId(): string {
    return `BCH-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  /**
   * Generate privacy impact assessment
   */
  async generatePIA(
    systemName: string,
    systemOwner: string,
    events: EnhancedAuditEvent[],
    piiInventory: PIIInventoryEntry[]
  ): Promise<PrivacyImpactAssessment> {
    const dataCategories = new Set<string>();
    const piiTypes = new Set<string>();
    const purposes = new Set<string>();

    for (const event of events) {
      event.dataCategories?.forEach(cat => dataCategories.add(cat));
      event.piiDetected?.forEach(pii => piiTypes.add(pii));
      if (event.metadata?.purpose) {
        purposes.add(event.metadata.purpose as string);
      }
    }

    const risks: any[] = [];
    const overallRisks: ("low" | "medium" | "high")[] = [];

    // Assess PII exposure risk
    const highPIIEvents = events.filter(e => e.piiDetected && e.piiDetected.length >= 5);
    if (highPIIEvents.length > 0) {
      risks.push({
        risk: "Excessive PII collection",
        likelihood: "medium",
        severity: "medium",
        mitigation: "Implement data minimization principles",
        residualRisk: "low",
      });
      overallRisks.push("medium");
    }

    // Assess cloud transmission risk
    const cloudPIIEvents = events.filter(
      e => e.destination === "cloud" && e.piiDetected && e.piiDetected.length > 0
    );
    if (cloudPIIEvents.length > 0) {
      risks.push({
        risk: "PII transmitted to third parties",
        likelihood: "high",
        severity: "high",
        mitigation: "Implement encryption and contractual safeguards",
        residualRisk: "medium",
      });
      overallRisks.push("high");
    }

    // Determine overall risk
    const overallRisk: ("low" | "medium" | "high") = overallRisks.includes("high")
      ? "high"
      : overallRisks.includes("medium")
      ? "medium"
      : "low";

    return {
      assessmentId: `PIA-${Date.now()}`,
      assessmentDate: Date.now(),
      systemName,
      systemOwner,
      processingDescription: "System processes user queries with potential PII",
      dataCategories: Array.from(dataCategories),
      piiTypes: Array.from(piiTypes),
      purposes: Array.from(purposes),
      legalBases: ["consent", "legitimate-interest"],
      risks,
      compliance: [
        {
          regulation: "GDPR",
          compliant: overallRisk !== "high",
          gaps: overallRisk === "high" ? ["Excessive PII exposure"] : [],
        },
      ],
      recommendations: [
        "Implement data minimization",
        "Enable encryption for all cloud transmissions",
        "Conduct regular privacy reviews",
      ],
      overallRisk,
      status: overallRisk === "high" ? "needs-review" : "approved",
    };
  }
}

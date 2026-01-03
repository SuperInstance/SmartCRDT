/**
 * OnDeviceProcessingPolicy - Enhanced on-device processing policy
 *
 * This module extends the existing OnDevicePolicy with integration for
 * VisualPrivacyClassifier and EmbeddingRedactionProtocol. It provides
 * a unified policy engine for visual data processing.
 *
 * ## Policy Rules
 *
 * 1. **All VL-JEPA inference happens on device** (WebGPU)
 * 2. **Only redacted embeddings leave device**
 * 3. **User controls what's shared**
 * 4. **Audit log of all redactions**
 *
 * @packageDocumentation
 */

import { VisualPrivacyClassification } from "./VisualPrivacyClassifier";
import { RedactionResult } from "./EmbeddingRedactionProtocol";
import { ProcessingLocation, VisualDataType } from "./VisualPrivacyAnalyzer";

/**
 * Privacy mode preset
 */
export enum PrivacyMode {
  /** Strict: Maximum privacy, conservative redaction */
  STRICT = "strict",

  /** Standard: Balanced privacy/utility */
  STANDARD = "standard",

  /** Off: Minimal privacy protections (not recommended) */
  OFF = "off",
}

/**
 * Privacy audit entry
 */
export interface PrivacyAuditEntry {
  /** Entry ID */
  id: string;

  /** Timestamp */
  timestamp: number;

  /** Data type processed */
  dataType: VisualDataType;

  /** Classification result */
  classification: VisualPrivacyClassification;

  /** Redaction result (if applicable) */
  redaction?: RedactionResult;

  /** Processing location */
  processingLocation: ProcessingLocation;

  /** Whether data left device */
  dataLeftDevice: boolean;

  /** User consent obtained */
  userConsent: boolean;

  /** Processing duration (ms) */
  duration: number;

  /** Policy version */
  policyVersion: string;
}

/**
 * Processing policy configuration
 */
export interface ProcessingPolicyConfig {
  /** Privacy mode */
  privacyMode: PrivacyMode;

  /** Required processing location */
  processingLocation: ProcessingLocation;

  /** What data can leave device */
  dataLeavingDevice: "embeddings_only" | "redacted_embeddings" | "none";

  /** Require user consent for sensitive data */
  requireConsent: boolean;

  /** Maximum embedding retention time (ms) */
  maxRetentionTime: number;

  /** Enable audit logging */
  enableAuditLog: boolean;

  /** Maximum audit log size */
  maxAuditLogSize: number;

  /** Verbose logging */
  verbose?: boolean;

  /** Policy version */
  version: string;
}

/**
 * Policy validation result
 */
export interface PolicyValidationResult {
  /** Whether configuration is valid */
  valid: boolean;

  /** Validation errors */
  errors: string[];

  /** Warnings (non-blocking) */
  warnings: string[];

  /** Recommended changes */
  recommendations: string[];
}

/**
 * OnDeviceProcessingPolicy - Enhanced on-device processing policy
 *
 * Enforces privacy policies for visual data processing with full audit logging.
 *
 * ## Example
 *
 * ```typescript
 * const policy = new OnDeviceProcessingPolicy({
 *   privacyMode: PrivacyMode.STANDARD,
 *   processingLocation: ProcessingLocation.EDGE_ONLY,
 *   dataLeavingDevice: "redacted_embeddings",
 * });
 *
 * // Validate before processing
 * const validation = policy.validateProcessing(embedding, classification);
 * if (!validation.canProceed) {
 *   throw new Error('Processing blocked by policy');
 * }
 *
 * // Process and log
 * await policy.processWithAudit(embedding, classification);
 * ```
 */
export class OnDeviceProcessingPolicy {
  private config: Required<ProcessingPolicyConfig>;
  private auditLog: PrivacyAuditEntry[];
  private currentPolicyVersion: string = "1.0";

  constructor(config: Partial<ProcessingPolicyConfig> = {}) {
    this.config = {
      privacyMode: config.privacyMode ?? PrivacyMode.STANDARD,
      processingLocation:
        config.processingLocation ?? ProcessingLocation.EDGE_ONLY,
      dataLeavingDevice: config.dataLeavingDevice ?? "redacted_embeddings",
      requireConsent: config.requireConsent ?? true,
      maxRetentionTime: config.maxRetentionTime ?? 60000, // 1 minute
      enableAuditLog: config.enableAuditLog ?? true,
      maxAuditLogSize: config.maxAuditLogSize ?? 1000,
      verbose: config.verbose ?? false,
      version: config.version ?? this.currentPolicyVersion,
    };

    this.auditLog = [];
  }

  /**
   * Validate that processing can proceed
   *
   * @param embedding - Embedding to process
   * @param classification - Privacy classification
   * @returns Validation result
   */
  validateProcessing(
    embedding: Float32Array,
    classification: VisualPrivacyClassification
  ): PolicyValidationResult & {
    canProceed: boolean;
    requiresRedaction: boolean;
    requiresConsent: boolean;
    dataLeavingDevice: boolean;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    let canProceed = true;
    let requiresRedaction = false;
    let requiresConsent = false;
    let dataLeavingDevice = false;

    // Check processing location
    if (this.config.processingLocation !== ProcessingLocation.EDGE_ONLY) {
      warnings.push(
        "Processing location is not EDGE_ONLY. " +
          "Visual data may leave device unprocessed."
      );
      recommendations.push("Consider using EDGE_ONLY for maximum privacy");
    }

    // Check classification
    if (classification.classification === "SECRET") {
      errors.push("SECRET classification - data must not leave device");
      canProceed = false;
      requiresRedaction = true;
      requiresConsent = true;
    } else if (classification.classification === "PII") {
      warnings.push("PII detected - redaction required before transmission");
      requiresRedaction = true;
      if (this.config.requireConsent) {
        requiresConsent = true;
      }
    } else if (classification.classification === "SENSITIVE") {
      requiresRedaction = this.config.privacyMode !== PrivacyMode.OFF;
    }

    // Check data leaving device policy
    if (this.config.dataLeavingDevice === "none") {
      dataLeavingDevice = false;
      if (requiresRedaction) {
        warnings.push(
          "Data will not leave device even after redaction " +
            "(dataLeavingDevice = 'none')"
        );
      }
    } else if (this.config.dataLeavingDevice === "redacted_embeddings") {
      dataLeavingDevice = !requiresRedaction; // Only if not redacted
      if (requiresRedaction) {
        dataLeavingDevice = true; // Redacted data can leave
      }
    } else {
      // embeddings_only
      if (requiresRedaction && !classification.redactionNeeded) {
        warnings.push(
          "Unredacted embedding may leave device (dataLeavingDevice = 'embeddings_only')"
        );
      }
      dataLeavingDevice = true;
    }

    // Check privacy mode
    if (this.config.privacyMode === PrivacyMode.STRICT) {
      recommendations.push(
        "Strict mode enabled - all PII will be redacted, " +
          "differential privacy applied"
      );
    } else if (this.config.privacyMode === PrivacyMode.OFF) {
      warnings.push(
        "Privacy mode is OFF - minimal privacy protections. " +
          "Not recommended for production use."
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      recommendations,
      canProceed,
      requiresRedaction,
      requiresConsent,
      dataLeavingDevice,
    };
  }

  /**
   * Process data with full audit logging
   *
   * @param embedding - Embedding to process
   * @param classification - Privacy classification
   * @param dataType - Type of visual data
   * @param redaction - Optional redaction result
   * @returns Processing result
   */
  async processWithAudit(
    embedding: Float32Array,
    classification: VisualPrivacyClassification,
    dataType: VisualDataType,
    redaction?: RedactionResult
  ): Promise<{
    success: boolean;
    auditEntry: PrivacyAuditEntry;
    canTransmit: boolean;
  }> {
    const startTime = Date.now();

    // Validate processing
    const validation = this.validateProcessing(embedding, classification);

    if (!validation.canProceed) {
      // Log failed processing attempt
      const entry: PrivacyAuditEntry = {
        id: this.generateId(),
        timestamp: Date.now(),
        dataType,
        classification,
        redaction,
        processingLocation: this.config.processingLocation,
        dataLeftDevice: false,
        userConsent: false,
        duration: Date.now() - startTime,
        policyVersion: this.config.version,
      };

      this.addAuditEntry(entry);

      if (this.config.verbose) {
        console.warn(
          "[OnDeviceProcessingPolicy] Processing blocked:",
          validation.errors
        );
      }

      return {
        success: false,
        auditEntry: entry,
        canTransmit: false,
      };
    }

    // Determine if data can leave device
    const canTransmit =
      this.config.dataLeavingDevice !== "none" &&
      (redaction !== undefined || !validation.requiresRedaction);

    // Create audit entry
    const entry: PrivacyAuditEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      dataType,
      classification,
      redaction,
      processingLocation: this.config.processingLocation,
      dataLeftDevice: canTransmit,
      userConsent: false, // TODO: Implement consent mechanism
      duration: Date.now() - startTime,
      policyVersion: this.config.version,
    };

    this.addAuditEntry(entry);

    if (this.config.verbose) {
      console.log("[OnDeviceProcessingPolicy] Processing complete:", {
        classification: classification.classification,
        canTransmit,
        duration: entry.duration,
      });
    }

    return {
      success: true,
      auditEntry: entry,
      canTransmit,
    };
  }

  /**
   * Get audit log
   *
   * @param limit - Maximum entries to return
   * @param filter - Optional filter function
   */
  getAuditLog(
    limit?: number,
    filter?: (entry: PrivacyAuditEntry) => boolean
  ): PrivacyAuditEntry[] {
    let entries = this.auditLog;

    if (filter) {
      entries = entries.filter(filter);
    }

    if (limit) {
      entries = entries.slice(-limit);
    }

    return [...entries];
  }

  /**
   * Get audit statistics
   */
  getAuditStats(): {
    totalEntries: number;
    byClassification: Record<string, number>;
    byDataType: Record<string, number>;
    dataLeftDeviceCount: number;
    avgProcessingTime: number;
  } {
    const byClassification: Record<string, number> = {};
    const byDataType: Record<string, number> = {};
    let dataLeftDeviceCount = 0;
    let totalDuration = 0;

    for (const entry of this.auditLog) {
      // Count by classification
      const cls = entry.classification.classification;
      byClassification[cls] = (byClassification[cls] ?? 0) + 1;

      // Count by data type
      const dt = entry.dataType;
      byDataType[dt] = (byDataType[dt] ?? 0) + 1;

      // Count data leaving device
      if (entry.dataLeftDevice) {
        dataLeftDeviceCount++;
      }

      totalDuration += entry.duration;
    }

    return {
      totalEntries: this.auditLog.length,
      byClassification,
      byDataType,
      dataLeftDeviceCount,
      avgProcessingTime:
        this.auditLog.length > 0 ? totalDuration / this.auditLog.length : 0,
    };
  }

  /**
   * Clear audit log
   */
  clearAuditLog(): void {
    this.auditLog = [];
  }

  /**
   * Export audit log as JSON
   */
  exportAuditLog(): string {
    return JSON.stringify(this.auditLog, null, 2);
  }

  /**
   * Update policy configuration
   *
   * @param updates - Partial configuration updates
   */
  updatePolicy(updates: Partial<ProcessingPolicyConfig>): void {
    // Validate updates
    const validation = this.validatePolicyUpdate(updates);
    if (!validation.valid) {
      throw new Error(`Invalid policy update: ${validation.errors.join(", ")}`);
    }

    // Apply updates
    Object.assign(this.config, updates);

    if (this.config.verbose) {
      console.log("[OnDeviceProcessingPolicy] Policy updated:", updates);
    }
  }

  /**
   * Get current policy configuration
   */
  getPolicy(): Required<ProcessingPolicyConfig> {
    return { ...this.config };
  }

  /**
   * Validate policy update
   */
  private validatePolicyUpdate(
    updates: Partial<ProcessingPolicyConfig>
  ): PolicyValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Check for incompatible settings
    if (
      updates.dataLeavingDevice === "none" &&
      updates.processingLocation !== ProcessingLocation.EDGE_ONLY
    ) {
      errors.push(
        "Cannot have dataLeavingDevice='none' with processingLocation='EDGE_ONLY'. " +
          "This would prevent all processing."
      );
    }

    if (updates.privacyMode === PrivacyMode.OFF) {
      warnings.push("Privacy mode OFF is not recommended for production use");
    }

    if (updates.maxRetentionTime && updates.maxRetentionTime > 3600000) {
      warnings.push(
        "maxRetentionTime > 1 hour may violate privacy best practices"
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      recommendations,
    };
  }

  /**
   * Add audit entry with size limit enforcement
   */
  private addAuditEntry(entry: PrivacyAuditEntry): void {
    if (!this.config.enableAuditLog) {
      return;
    }

    this.auditLog.push(entry);

    // Enforce size limit
    if (this.auditLog.length > this.config.maxAuditLogSize) {
      // Remove oldest entries
      const excess = this.auditLog.length - this.config.maxAuditLogSize;
      this.auditLog.splice(0, excess);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Create a strict on-device policy
 */
export function createStrictPolicy(): OnDeviceProcessingPolicy {
  return new OnDeviceProcessingPolicy({
    privacyMode: PrivacyMode.STRICT,
    processingLocation: ProcessingLocation.EDGE_ONLY,
    dataLeavingDevice: "redacted_embeddings",
    requireConsent: true,
    maxRetentionTime: 10000, // 10 seconds
    enableAuditLog: true,
  });
}

/**
 * Create a standard on-device policy
 */
export function createStandardPolicy(): OnDeviceProcessingPolicy {
  return new OnDeviceProcessingPolicy({
    privacyMode: PrivacyMode.STANDARD,
    processingLocation: ProcessingLocation.EDGE_ONLY,
    dataLeavingDevice: "redacted_embeddings",
    requireConsent: true,
    maxRetentionTime: 60000, // 1 minute
    enableAuditLog: true,
  });
}

/**
 * Create a permissive on-device policy
 */
export function createPermissivePolicy(): OnDeviceProcessingPolicy {
  return new OnDeviceProcessingPolicy({
    privacyMode: PrivacyMode.OFF,
    processingLocation: ProcessingLocation.HYBRID,
    dataLeavingDevice: "embeddings_only",
    requireConsent: false,
    maxRetentionTime: 300000, // 5 minutes
    enableAuditLog: true,
  });
}

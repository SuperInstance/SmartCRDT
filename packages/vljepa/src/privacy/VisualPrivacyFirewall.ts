/**
 * VisualPrivacyFirewall - Privacy firewall for visual data
 *
 * This module implements a privacy firewall that inspects, filters, and blocks
 * visual data based on privacy rules. It provides real-time monitoring and
 * automatic quarantine of sensitive data.
 *
 * ## Firewall Architecture
 *
 * The firewall operates at three points:
 *
 * 1. **Incoming Inspection**: Classify visual data before processing
 * 2. **Processing Control**: Enforce on-device processing requirements
 * 3. **Outgoing Filter**: Redact or block data before transmission
 *
 * ## Features
 *
 * - **Rule-based filtering**: Configurable allow/redact/block rules
 * - **Real-time monitoring**: Detect privacy violations as they occur
 * - **Automatic quarantine**: Block sensitive data automatically
 * - **Audit logging**: Track all firewall decisions
 *
 * @packageDocumentation
 */

import {
  VisualPrivacyClassification,
  PrivacyElement,
} from "./VisualPrivacyClassifier";
import { RedactionResult } from "./EmbeddingRedactionProtocol";

/**
 * Firewall action
 */
export type FirewallAction = "allow" | "redact" | "block" | "quarantine";

/**
 * Firewall rule condition
 */
export interface FirewallRuleCondition {
  /** Classification must match (optional) */
  classification?: VisualPrivacyClassification["classification"][];

  /** Minimum privacy score (optional) */
  minPrivacyScore?: number;

  /** Maximum privacy score (optional) */
  maxPrivacyScore?: number;

  /** Element types must be present (optional) */
  hasElementTypes?: PrivacyElement["type"][];

  /** Element types must not be present (optional) */
  excludeElementTypes?: PrivacyElement["type"][];

  /** PII types must be present (optional) */
  hasPIIType?: PrivacyElement["piiType"][];

  /** Custom condition function (optional) */
  custom?: (
    embedding: Float32Array,
    classification: VisualPrivacyClassification
  ) => boolean;
}

/**
 * Firewall rule
 */
export interface FirewallRule {
  /** Unique rule ID */
  id: string;

  /** Rule name */
  name: string;

  /** Rule description */
  description?: string;

  /** Condition to trigger rule */
  condition: FirewallRuleCondition;

  /** Action to take when rule matches */
  action: FirewallAction;

  /** Priority (higher = evaluated first) */
  priority: number;

  /** Whether rule is enabled */
  enabled: boolean;

  /** Rule metadata */
  metadata?: {
    created: number;
    updated?: number;
    author?: string;
    tags?: string[];
  };
}

/**
 * Firewall decision
 */
export interface FirewallDecision {
  /** Rule that triggered the decision */
  ruleId?: string;

  /** Action taken */
  action: FirewallAction;

  /** Reason for decision */
  reason: string;

  /** Whether data was modified */
  modified: boolean;

  /** Processing time (ms) */
  processingTime: number;

  /** Timestamp */
  timestamp: number;
}

/**
 * Quarantine entry
 */
export interface QuarantineEntry {
  /** Entry ID */
  id: string;

  /** Timestamp */
  timestamp: number;

  /** Classification result */
  classification: VisualPrivacyClassification;

  /** Rule that caused quarantine */
  ruleId: string;

  /** Reason for quarantine */
  reason: string;

  /** Whether data was released */
  released: boolean;

  /** Release timestamp (if applicable) */
  releasedAt?: number;

  /** Release notes (if applicable) */
  releaseNotes?: string;
}

/**
 * Firewall statistics
 */
export interface FirewallStats {
  /** Total requests processed */
  totalRequests: number;

  /** Requests by action */
  requestsByAction: Record<FirewallAction, number>;

  /** Requests by classification */
  requestsByClassification: Record<string, number>;

  /** Average processing time (ms) */
  avgProcessingTime: number;

  /** Current quarantine size */
  quarantineSize: number;

  /** Rules triggered (by rule ID) */
  rulesTriggered: Record<string, number>;
}

/**
 * Firewall configuration
 */
export interface VisualPrivacyFirewallConfig {
  /** Default action when no rules match */
  defaultAction: FirewallAction;

  /** Whether to allow by default (safer: false) */
  allowByDefault: boolean;

  /** Enable automatic quarantine of SECRET data */
  autoQuarantine: boolean;

  /** Enable audit logging */
  enableAuditLog: boolean;

  /** Maximum quarantine size */
  maxQuarantineSize: number;

  /** Enable detailed logging */
  verbose?: boolean;

  /** Rules to load on initialization */
  rules?: FirewallRule[];
}

/**
 * VisualPrivacyFirewall - Privacy firewall for visual data
 *
 * Inspects and filters visual data based on privacy rules.
 *
 * ## Example
 *
 * ```typescript
 * const firewall = new VisualPrivacyFirewall({
 *   defaultAction: "allow",
 *   autoQuarantine: true,
 * });
 *
 * // Add rule to block SECRET data
 * firewall.addRule({
 *   id: "block-secret",
 *   name: "Block SECRET Data",
 *   condition: {
 *     classification: ["SECRET"],
 *   },
 *   action: "block",
 *   priority: 100,
 *   enabled: true,
 * });
 *
 * const decision = firewall.inspect(embedding, classification);
 * if (decision.action === "block") {
 *   console.log("Blocked:", decision.reason);
 * }
 * ```
 */
export class VisualPrivacyFirewall {
  private config: Required<VisualPrivacyFirewallConfig>;
  private rules: Map<string, FirewallRule>;
  private quarantine: Map<string, QuarantineEntry>;
  private auditLog: FirewallDecision[];
  private stats: FirewallStats;

  constructor(config: Partial<VisualPrivacyFirewallConfig> = {}) {
    this.config = {
      defaultAction: config.defaultAction ?? "allow",
      allowByDefault: config.allowByDefault ?? false,
      autoQuarantine: config.autoQuarantine ?? true,
      enableAuditLog: config.enableAuditLog ?? true,
      maxQuarantineSize: config.maxQuarantineSize ?? 100,
      verbose: config.verbose ?? false,
      rules: config.rules ?? [],
    };

    this.rules = new Map();
    this.quarantine = new Map();
    this.auditLog = [];

    this.stats = {
      totalRequests: 0,
      requestsByAction: {
        allow: 0,
        redact: 0,
        block: 0,
        quarantine: 0,
      },
      requestsByClassification: {},
      avgProcessingTime: 0,
      quarantineSize: 0,
      rulesTriggered: {},
    };

    // Load initial rules
    for (const rule of this.config.rules) {
      this.addRule(rule);
    }

    // Add default rules if none provided
    if (this.config.rules.length === 0) {
      this.addDefaultRules();
    }
  }

  /**
   * Inspect visual data and make firewall decision
   *
   * @param embedding - Embedding to inspect
   * @param classification - Privacy classification
   * @returns Firewall decision
   */
  inspect(
    embedding: Float32Array,
    classification: VisualPrivacyClassification
  ): FirewallDecision {
    const startTime = Date.now();

    this.stats.totalRequests++;

    // Evaluate rules in priority order
    const sortedRules = Array.from(this.rules.values())
      .filter(r => r.enabled)
      .sort((a, b) => b.priority - a.priority);

    let matchedRule: FirewallRule | undefined;
    for (const rule of sortedRules) {
      if (this.evaluateCondition(rule.condition, embedding, classification)) {
        matchedRule = rule;
        break;
      }
    }

    // Determine action
    let action: FirewallAction;
    let reason: string;

    if (matchedRule) {
      action = matchedRule.action;
      reason =
        matchedRule.description ?? `Rule "${matchedRule.name}" triggered`;

      // Track rule trigger
      this.stats.rulesTriggered[matchedRule.id] =
        (this.stats.rulesTriggered[matchedRule.id] ?? 0) + 1;
    } else {
      action = this.config.defaultAction;
      reason = "No rules matched, using default action";
    }

    // Auto-quarantine SECRET if enabled
    if (
      this.config.autoQuarantine &&
      classification.classification === "SECRET"
    ) {
      action = "quarantine";
      reason = "SECRET data auto-quarantined";
    }

    const decision: FirewallDecision = {
      ruleId: matchedRule?.id,
      action,
      reason,
      modified: action === "redact",
      processingTime: Date.now() - startTime,
      timestamp: Date.now(),
    };

    // Update stats
    this.stats.requestsByAction[action]++;
    this.stats.requestsByClassification[classification.classification] =
      (this.stats.requestsByClassification[classification.classification] ??
        0) + 1;

    // Update average processing time
    this.stats.avgProcessingTime =
      (this.stats.avgProcessingTime * (this.stats.totalRequests - 1) +
        decision.processingTime) /
      this.stats.totalRequests;

    // Log decision
    if (this.config.enableAuditLog) {
      this.auditLog.push(decision);
    }

    // Add to quarantine if needed
    if (action === "quarantine") {
      this.addToQuarantine(
        classification,
        matchedRule?.id ?? "auto-quarantine",
        reason
      );
    }

    // Verbose logging
    if (this.config.verbose) {
      console.log("[VisualPrivacyFirewall] Decision:", {
        action,
        reason,
        rule: matchedRule?.name ?? "none",
        processingTime: decision.processingTime,
      });
    }

    return decision;
  }

  /**
   * Add a firewall rule
   *
   * @param rule - Rule to add
   */
  addRule(rule: FirewallRule): void {
    // Validate rule
    if (!rule.id || !rule.name) {
      throw new Error("Rule must have id and name");
    }

    rule.metadata = {
      ...rule.metadata,
      created: rule.metadata?.created ?? Date.now(),
      updated: Date.now(),
    };

    this.rules.set(rule.id, rule);

    if (this.config.verbose) {
      console.log("[VisualPrivacyFirewall] Rule added:", rule.id, rule.name);
    }
  }

  /**
   * Remove a firewall rule
   *
   * @param ruleId - ID of rule to remove
   */
  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);

    if (removed && this.config.verbose) {
      console.log("[VisualPrivacyFirewall] Rule removed:", ruleId);
    }

    return removed;
  }

  /**
   * Get a rule by ID
   *
   * @param ruleId - Rule ID
   */
  getRule(ruleId: string): FirewallRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Get all rules
   *
   * @param enabledOnly - Only return enabled rules
   */
  getRules(enabledOnly = false): FirewallRule[] {
    const rules = Array.from(this.rules.values());
    return enabledOnly ? rules.filter(r => r.enabled) : rules;
  }

  /**
   * Enable or disable a rule
   *
   * @param ruleId - Rule ID
   * @param enabled - Whether to enable the rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
      rule.metadata = {
        ...rule.metadata,
        updated: Date.now(),
      };

      if (this.config.verbose) {
        console.log(
          `[VisualPrivacyFirewall] Rule ${ruleId} ${enabled ? "enabled" : "disabled"}`
        );
      }
    }
  }

  /**
   * Release quarantined data
   *
   * @param entryId - Quarantine entry ID
   * @param notes - Release notes
   */
  releaseFromQuarantine(entryId: string, notes?: string): boolean {
    const entry = this.quarantine.get(entryId);
    if (!entry) {
      return false;
    }

    entry.released = true;
    entry.releasedAt = Date.now();
    entry.releaseNotes = notes;

    this.stats.quarantineSize--;

    if (this.config.verbose) {
      console.log("[VisualPrivacyFirewall] Released from quarantine:", entryId);
    }

    return true;
  }

  /**
   * Get quarantine entries
   *
   * @param includeReleased - Whether to include released entries
   */
  getQuarantine(includeReleased = false): QuarantineEntry[] {
    const entries = Array.from(this.quarantine.values());
    return includeReleased ? entries : entries.filter(e => !e.released);
  }

  /**
   * Clear quarantine
   */
  clearQuarantine(): void {
    this.quarantine.clear();
    this.stats.quarantineSize = 0;

    if (this.config.verbose) {
      console.log("[VisualPrivacyFirewall] Quarantine cleared");
    }
  }

  /**
   * Get firewall statistics
   */
  getStats(): FirewallStats {
    return {
      ...this.stats,
      quarantineSize: this.quarantine.size,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      requestsByAction: {
        allow: 0,
        redact: 0,
        block: 0,
        quarantine: 0,
      },
      requestsByClassification: {},
      avgProcessingTime: 0,
      quarantineSize: this.quarantine.size,
      rulesTriggered: {},
    };
  }

  /**
   * Get audit log
   *
   * @param limit - Maximum entries to return
   */
  getAuditLog(limit?: number): FirewallDecision[] {
    if (limit) {
      return this.auditLog.slice(-limit);
    }
    return [...this.auditLog];
  }

  /**
   * Clear audit log
   */
  clearAuditLog(): void {
    this.auditLog = [];
  }

  /**
   * Evaluate rule condition
   */
  private evaluateCondition(
    condition: FirewallRuleCondition,
    embedding: Float32Array,
    classification: VisualPrivacyClassification
  ): boolean {
    // Check classification
    if (condition.classification) {
      if (!condition.classification.includes(classification.classification)) {
        return false;
      }
    }

    // Check privacy score range
    if (condition.minPrivacyScore !== undefined) {
      if (classification.privacyScore < condition.minPrivacyScore) {
        return false;
      }
    }

    if (condition.maxPrivacyScore !== undefined) {
      if (classification.privacyScore > condition.maxPrivacyScore) {
        return false;
      }
    }

    // Check for required element types
    if (condition.hasElementTypes && condition.hasElementTypes.length > 0) {
      const hasTypes = classification.detectedElements.some(e =>
        condition.hasElementTypes!.includes(e.type)
      );
      if (!hasTypes) {
        return false;
      }
    }

    // Check for excluded element types
    if (
      condition.excludeElementTypes &&
      condition.excludeElementTypes.length > 0
    ) {
      const hasExcluded = classification.detectedElements.some(e =>
        condition.excludeElementTypes!.includes(e.type)
      );
      if (hasExcluded) {
        return false;
      }
    }

    // Check for PII types
    if (condition.hasPIIType && condition.hasPIIType.length > 0) {
      const hasPII = classification.detectedElements.some(
        e => e.piiType && condition.hasPIIType!.includes(e.piiType)
      );
      if (!hasPII) {
        return false;
      }
    }

    // Check custom condition
    if (condition.custom) {
      if (!condition.custom(embedding, classification)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Add entry to quarantine
   */
  private addToQuarantine(
    classification: VisualPrivacyClassification,
    ruleId: string,
    reason: string
  ): void {
    // Enforce max size
    if (this.quarantine.size >= this.config.maxQuarantineSize) {
      // Remove oldest released entry
      const oldest = Array.from(this.quarantine.values())
        .filter(e => e.released)
        .sort((a, b) => a.timestamp - b.timestamp)[0];

      if (oldest) {
        this.quarantine.delete(oldest.id);
      }
    }

    const entry: QuarantineEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      classification,
      ruleId,
      reason,
      released: false,
    };

    this.quarantine.set(entry.id, entry);
    this.stats.quarantineSize++;

    if (this.config.verbose) {
      console.log("[VisualPrivacyFirewall] Quarantined:", entry.id, reason);
    }
  }

  /**
   * Add default firewall rules
   */
  private addDefaultRules(): void {
    // Rule 1: Block SECRET data
    this.addRule({
      id: "block-secret",
      name: "Block SECRET Data",
      description: "Automatically block all SECRET classified data",
      condition: {
        classification: ["SECRET"],
      },
      action: "block",
      priority: 100,
      enabled: true,
      metadata: {
        tags: ["security", "privacy"],
      },
    });

    // Rule 2: Redact PII
    this.addRule({
      id: "redact-pii",
      name: "Redact PII",
      description: "Redact all PII-classified data",
      condition: {
        classification: ["PII"],
      },
      action: "redact",
      priority: 90,
      enabled: true,
      metadata: {
        tags: ["privacy", "pii"],
      },
    });

    // Rule 3: Redact SENSITIVE with faces
    this.addRule({
      id: "redact-sensitive-faces",
      name: "Redact SENSITIVE with Faces",
      description: "Redact SENSITIVE data that contains faces",
      condition: {
        classification: ["SENSITIVE"],
        hasElementTypes: ["face"],
      },
      action: "redact",
      priority: 80,
      enabled: true,
      metadata: {
        tags: ["privacy", "faces"],
      },
    });

    // Rule 4: Allow SAFE data
    this.addRule({
      id: "allow-safe",
      name: "Allow SAFE Data",
      description: "Allow all SAFE classified data",
      condition: {
        classification: ["SAFE"],
      },
      action: "allow",
      priority: 10,
      enabled: true,
      metadata: {
        tags: ["privacy", "safe"],
      },
    });
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Create a default firewall with standard rules
 */
export function createDefaultFirewall(): VisualPrivacyFirewall {
  return new VisualPrivacyFirewall({
    defaultAction: "allow",
    autoQuarantine: true,
    enableAuditLog: true,
  });
}

/**
 * Create a strict firewall (block by default)
 */
export function createStrictFirewall(): VisualPrivacyFirewall {
  const firewall = new VisualPrivacyFirewall({
    defaultAction: "block",
    allowByDefault: false,
    autoQuarantine: true,
    enableAuditLog: true,
  });

  return firewall;
}

/**
 * Create a permissive firewall (allow by default)
 */
export function createPermissiveFirewall(): VisualPrivacyFirewall {
  return new VisualPrivacyFirewall({
    defaultAction: "allow",
    allowByDefault: true,
    autoQuarantine: false,
    enableAuditLog: true,
  });
}

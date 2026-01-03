/**
 * PrivacyFirewall - Privacy enforcement middleware for Aequor
 *
 * The Privacy Firewall acts as a gatekeeper between the IntentionPlane and external
 * models, ensuring that SOVEREIGN data never leaves the local system and that
 * SENSITIVE data is properly handled.
 *
 * Features:
 * - Rule-based privacy enforcement with priority evaluation
 * - Default security-first rules (SOVEREIGN blocked from cloud, SENSITIVE redacted)
 * - Custom rule addition/removal at runtime
 * - Support for multiple action types (allow, deny, redact, redirect)
 *
 * @packageDocumentation
 */

import type { PrivacyClassification } from "@lsi/protocol";
import { PrivacyLevel, PIIType } from "@lsi/protocol";
import { RedactionStrategy } from "../redaction/SemanticPIIRedactor.js";

/**
 * Firewall condition - when a rule applies
 */
export type FirewallCondition =
  | { type: "classification"; value: PrivacyLevel }
  | { type: "hasPII"; piiTypes: PIIType[] }
  | { type: "destination"; value: "local" | "cloud" }
  | { type: "constraint"; key: string; value: unknown };

/**
 * Firewall action - what to do when rule matches
 */
export type FirewallAction =
  | { type: "allow" }
  | { type: "deny"; reason: string }
  | { type: "redact"; strategy: RedactionStrategy }
  | { type: "redirect"; destination: "local" };

/**
 * Firewall rule definition
 */
export interface FirewallRule {
  /** Unique rule identifier */
  id: string;
  /** Human-readable rule name */
  name: string;
  /** Rule description */
  description: string;
  /** When this rule applies */
  condition: FirewallCondition;
  /** What action to take */
  action: FirewallAction;
  /** Higher = evaluated first */
  priority: number;
  /** Whether the rule is enabled */
  enabled: boolean;
}

/**
 * Firewall decision result
 */
export interface FirewallDecision {
  /** Action to take */
  action: "allow" | "deny" | "redact" | "redirect";
  /** Reason for the decision */
  reason?: string;
  /** Redaction strategy (if action is 'redact') */
  redactionStrategy?: RedactionStrategy;
  /** Confidence in the decision (0-1) */
  confidence: number;
  /** IDs of rules that matched */
  matchedRules: string[];
  /** Final destination (may differ from requested) */
  finalDestination: "local" | "cloud";
}

/**
 * Firewall evaluation context
 */
export interface FirewallContext {
  /** Query text (for logging) */
  query: string;
  /** Privacy classification */
  classification: PrivacyClassification;
  /** Requested destination */
  destination: "local" | "cloud";
  /** Optional constraints */
  constraints?: Record<string, unknown>;
}

/**
 * PrivacyFirewall configuration
 */
export interface PrivacyFirewallConfig {
  /** Custom rules to add */
  customRules?: FirewallRule[];
  /** Whether to enable default rules */
  enableDefaultRules?: boolean;
  /** Maximum number of rules */
  maxRules?: number;
}

/**
 * PrivacyFirewall - Privacy enforcement middleware
 *
 * The firewall intercepts requests and applies privacy rules based on:
 * 1. Privacy classification (PUBLIC/SENSITIVE/SOVEREIGN)
 * 2. PII types detected
 * 3. Requested destination (local/cloud)
 * 4. Custom constraints
 *
 * Rules are evaluated in priority order (highest first), with the first
 * match determining the action. This enables precise control over
 * privacy enforcement behavior.
 */
export class PrivacyFirewall {
  private rules: Map<string, FirewallRule> = new Map();
  private config: Required<PrivacyFirewallConfig>;

  /**
   * Default security-first rules
   *
   * These rules implement the core privacy guarantees:
   * - SOVEREIGN data is blocked from cloud transmission
   * - SENSITIVE data is redacted before cloud transmission
   * - PUBLIC data is allowed to all destinations
   */
  private static readonly DEFAULT_RULES: FirewallRule[] = [
    {
      id: "sovereign-block",
      name: "Block SOVEREIGN from Cloud",
      description: "Prevent SOVEREIGN data from leaving the local system",
      condition: {
        type: "classification",
        value: PrivacyLevel.SOVEREIGN,
      },
      action: {
        type: "deny",
        reason: "SOVEREIGN data cannot leave local system",
      },
      priority: 100,
      enabled: true,
    },
    {
      id: "sensitive-redact",
      name: "Redact SENSITIVE for Cloud",
      description: "Redact SENSITIVE data before cloud transmission",
      condition: {
        type: "classification",
        value: PrivacyLevel.SENSITIVE,
      },
      action: {
        type: "redact",
        strategy: RedactionStrategy.PARTIAL,
      },
      priority: 90,
      enabled: true,
    },
    {
      id: "public-allow",
      name: "Allow PUBLIC Everywhere",
      description: "PUBLIC data can be transmitted to cloud",
      condition: {
        type: "classification",
        value: PrivacyLevel.PUBLIC,
      },
      action: {
        type: "allow",
      },
      priority: 80,
      enabled: true,
    },
    {
      id: "ssn-block-cloud",
      name: "Block SSN from Cloud",
      description: "Prevent SSN transmission to cloud",
      condition: {
        type: "hasPII",
        piiTypes: [PIIType.SSN],
      },
      action: {
        type: "deny",
        reason: "SSN detected - cannot transmit to cloud",
      },
      priority: 95,
      enabled: true,
    },
    {
      id: "credit-card-block-cloud",
      name: "Block Credit Card from Cloud",
      description: "Prevent credit card transmission to cloud",
      condition: {
        type: "hasPII",
        piiTypes: [PIIType.CREDIT_CARD],
      },
      action: {
        type: "deny",
        reason: "Credit card detected - cannot transmit to cloud",
      },
      priority: 94,
      enabled: true,
    },
    {
      id: "local-allow-all",
      name: "Allow All Local Processing",
      description: "All data can be processed locally",
      condition: {
        type: "destination",
        value: "local",
      },
      action: {
        type: "allow",
      },
      priority: 10,
      enabled: true,
    },
  ];

  constructor(config: PrivacyFirewallConfig = {}) {
    this.config = {
      customRules: config.customRules || [],
      enableDefaultRules: config.enableDefaultRules ?? true,
      maxRules: config.maxRules ?? 100,
    };

    // Initialize with default rules
    if (this.config.enableDefaultRules) {
      for (const rule of PrivacyFirewall.DEFAULT_RULES) {
        this.rules.set(rule.id, rule);
      }
    }

    // Add custom rules
    for (const rule of this.config.customRules) {
      this.addRule(rule);
    }
  }

  /**
   * Evaluate a query against firewall rules
   *
   * Rules are evaluated in priority order (highest first). The first
   * matching rule determines the action. If no rules match, the
   * default action is 'deny' (security-first).
   *
   * @param query - Query text
   * @param classification - Privacy classification
   * @param destination - Requested destination
   * @param constraints - Optional constraints
   * @returns Firewall decision
   */
  evaluate(
    query: string,
    classification: PrivacyClassification,
    destination: "local" | "cloud",
    constraints?: Record<string, unknown>
  ): FirewallDecision {
    // Sort rules by priority (highest first)
    const sortedRules = Array.from(this.rules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority);

    const matchedRules: string[] = [];

    // Evaluate each rule in priority order
    for (const rule of sortedRules) {
      if (
        this.matchesCondition(
          rule.condition,
          query,
          classification,
          destination,
          constraints
        )
      ) {
        matchedRules.push(rule.id);

        return this.createDecision(rule.action, matchedRules, destination);
      }
    }

    // Default: deny (security-first)
    return {
      action: "deny",
      reason: "No matching rules - default deny",
      confidence: 0.5,
      matchedRules,
      finalDestination: destination,
    };
  }

  /**
   * Evaluate with full context
   *
   * Convenience method that accepts a FirewallContext object.
   *
   * @param context - Firewall evaluation context
   * @returns Firewall decision
   */
  evaluateWithContext(context: FirewallContext): FirewallDecision {
    return this.evaluate(
      context.query,
      context.classification,
      context.destination,
      context.constraints
    );
  }

  /**
   * Add a new firewall rule
   *
   * @param rule - Rule to add
   * @throws Error if rule ID already exists or max rules exceeded
   */
  addRule(rule: FirewallRule): void {
    if (this.rules.has(rule.id)) {
      throw new Error(`Rule with ID '${rule.id}' already exists`);
    }

    if (this.rules.size >= this.config.maxRules) {
      throw new Error(
        `Maximum number of rules (${this.config.maxRules}) exceeded`
      );
    }

    this.rules.set(rule.id, rule);
  }

  /**
   * Remove a firewall rule
   *
   * @param ruleId - ID of rule to remove
   * @returns true if rule was removed, false if not found
   */
  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * Enable a firewall rule
   *
   * @param ruleId - ID of rule to enable
   * @throws Error if rule not found
   */
  enableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule '${ruleId}' not found`);
    }
    rule.enabled = true;
  }

  /**
   * Disable a firewall rule
   *
   * @param ruleId - ID of rule to disable
   * @throws Error if rule not found
   */
  disableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule '${ruleId}' not found`);
    }
    rule.enabled = false;
  }

  /**
   * Get all rules
   *
   * @returns Array of all rules
   */
  getRules(): FirewallRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get enabled rules only
   *
   * @returns Array of enabled rules
   */
  getEnabledRules(): FirewallRule[] {
    return Array.from(this.rules.values()).filter(rule => rule.enabled);
  }

  /**
   * Get rule by ID
   *
   * @param ruleId - Rule ID
   * @returns Rule or undefined if not found
   */
  getRule(ruleId: string): FirewallRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Update rule priority
   *
   * @param ruleId - Rule ID
   * @param priority - New priority value
   * @throws Error if rule not found
   */
  updateRulePriority(ruleId: string, priority: number): void {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule '${ruleId}' not found`);
    }
    rule.priority = priority;
  }

  /**
   * Clear all rules (including defaults)
   *
   * Use with caution - this removes all security rules.
   */
  clearAllRules(): void {
    this.rules.clear();
  }

  /**
   * Reset to default rules only
   *
   * Removes all custom rules and restores defaults.
   */
  resetToDefaults(): void {
    this.rules.clear();
    for (const rule of PrivacyFirewall.DEFAULT_RULES) {
      this.rules.set(rule.id, { ...rule });
    }
  }

  /**
   * Check if a condition matches the given context
   *
   * @param condition - Condition to check
   * @param query - Query text
   * @param classification - Privacy classification
   * @param destination - Requested destination
   * @param constraints - Optional constraints
   * @returns true if condition matches
   */
  private matchesCondition(
    condition: FirewallCondition,
    query: string,
    classification: PrivacyClassification,
    destination: "local" | "cloud",
    constraints?: Record<string, unknown>
  ): boolean {
    switch (condition.type) {
      case "classification":
        return classification.level === condition.value;

      case "hasPII":
        // Check if any of the specified PII types are present
        return condition.piiTypes.some(type =>
          classification.piiTypes.includes(type)
        );

      case "destination":
        return destination === condition.value;

      case "constraint":
        // Check if constraint key exists and matches value
        if (!constraints) {
          return false;
        }
        const constraintValue = constraints[condition.key];
        return constraintValue === condition.value;

      default:
        return false;
    }
  }

  /**
   * Create a firewall decision from an action
   *
   * @param action - Firewall action
   * @param matchedRules - IDs of matched rules
   * @param destination - Original destination
   * @returns Firewall decision
   */
  private createDecision(
    action: FirewallAction,
    matchedRules: string[],
    destination: "local" | "cloud"
  ): FirewallDecision {
    switch (action.type) {
      case "allow":
        return {
          action: "allow",
          confidence: 0.9,
          matchedRules,
          finalDestination: destination,
        };

      case "deny":
        return {
          action: "deny",
          reason: action.reason,
          confidence: 0.8,
          matchedRules,
          finalDestination: "local", // Denied means stay local
        };

      case "redact":
        return {
          action: "redact",
          reason: `Redact using ${action.strategy} strategy`,
          redactionStrategy: action.strategy,
          confidence: 0.7,
          matchedRules,
          finalDestination: destination,
        };

      case "redirect":
        return {
          action: "redirect",
          reason: `Redirect to ${action.destination}`,
          confidence: 0.6,
          matchedRules,
          finalDestination: action.destination,
        };

      default:
        return {
          action: "deny",
          reason: "Unknown action",
          confidence: 0.5,
          matchedRules,
          finalDestination: "local",
        };
    }
  }

  /**
   * Export rules as JSON
   *
   * @returns JSON string of all rules
   */
  exportRules(): string {
    return JSON.stringify(Array.from(this.rules.values()), null, 2);
  }

  /**
   * Import rules from JSON
   *
   * @param json - JSON string of rules
   * @param replace - Whether to replace existing rules (default: false)
   */
  importRules(json: string, replace = false): void {
    const rules = JSON.parse(json) as FirewallRule[];

    if (replace) {
      this.rules.clear();
    }

    for (const rule of rules) {
      if (!this.rules.has(rule.id)) {
        this.rules.set(rule.id, rule);
      }
    }
  }
}

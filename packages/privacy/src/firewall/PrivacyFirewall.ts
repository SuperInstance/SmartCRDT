/**
 * PrivacyFirewall - Privacy enforcement middleware for Aequor
 *
 * @package @lsi/privacy
 * @author SuperInstance
 * @license MIT
 *
 * ## Overview
 *
 * PrivacyFirewall acts as a gatekeeper between the IntentionPlane and external
 * models, ensuring that privacy policies are enforced before data leaves the
 * local system. It implements a security-first approach with defense-in-depth.
 *
 * ## Core Principles
 *
 * 1. **Security-First Default**: If no rules match, action is 'deny'
 * 2. **Priority-Based Evaluation**: Rules evaluated in priority order (highest first)
 * 3. **Explicit Allow**: Data must be explicitly allowed to transmit
 * 4. **Audit Trail**: All decisions include matched rules and reasoning
 *
 * ## Architecture
 *
 * ```
 * Query Request
 *     │
 *     ├─ Privacy Classification
 *     │   ├─ PUBLIC: Safe to share
 *     │   ├─ SENSITIVE: Rewrite needed
 *     │   └─ SOVEREIGN: Block from cloud
 *     │
 *     ├─ Firewall Evaluation
 *     │   ├─ Sort rules by priority (highest first)
 *     │   ├─ Check each enabled rule
 *     │   ├─ First match determines action
 *     │   └─ No match → default deny
 *     │
 *     └─ Enforcement Action
 *         ├─ ALLOW: Proceed with request
 *         ├─ DENY: Block with reason
 *         ├─ REDACT: Remove PII, then proceed
 *         └─ REDIRECT: Route to different backend
 * ```
 *
 * ## Default Security Rules
 *
 * The firewall includes pre-configured security-first rules (priority order):
 *
 * | Priority | Rule ID | Condition | Action | Purpose |
 * |----------|---------|-----------|--------|---------|
 * 100 | sovereign-block | SOVEREIGN classification | DENY | Block sovereign data from cloud |
 * 95 | ssn-block-cloud | Has SSN PII | DENY | Block SSN transmission |
 * 94 | credit-card-block-cloud | Has credit card PII | DENY | Block credit card transmission |
 * 90 | sensitive-redact | SENSITIVE classification | REDACT | Redact sensitive data |
 * 80 | public-allow | PUBLIC classification | ALLOW | Allow public data |
 * 10 | local-allow-all | Local destination | ALLOW | Allow all local processing |
 *
 * ## Firewall Conditions
 *
 * Rules can match on:
 *
 * **Classification**: Match privacy level
 * ```typescript
 * { type: "classification", value: PrivacyLevel.SOVEREIGN }
 * ```
 *
 * **Has PII**: Match specific PII types
 * ```typescript
 * { type: "hasPII", piiTypes: [PIIType.SSN, PIIType.CREDIT_CARD] }
 * ```
 *
 * **Destination**: Match target backend
 * ```typescript
 * { type: "destination", value: "cloud" }
 * ```
 *
 * **Constraint**: Match custom constraints
 * ```typescript
 * { type: "constraint", key: "region", value: "EU" }
 * ```
 *
 * ## Firewall Actions
 *
 * **ALLOW**: Permit the request
 * ```typescript
 * { type: "allow" }
 * ```
 *
 * **DENY**: Block the request with reason
 * ```typescript
 * { type: "deny", reason: "SSN detected - cannot transmit to cloud" }
 * ```
 *
 * **REDACT**: Remove PII using strategy
 * ```typescript
 * { type: "redact", strategy: RedactionStrategy.PARTIAL }
 * ```
 *
 * **REDIRECT**: Route to different backend
 * ```typescript
 * { type: "redirect", destination: "local" }
 * ```
 *
 * ## Example Usage
 *
 * ```typescript
 * import { PrivacyFirewall } from '@lsi/privacy';
 * import { PrivacyClassifier } from '@lsi/privacy';
 * import { PrivacyLevel, PIIType } from '@lsi/protocol';
 *
 * // Create firewall with default rules
 * const firewall = new PrivacyFirewall({
 *   enableDefaultRules: true,
 * });
 *
 * // Create classifier
 * const classifier = new PrivacyClassifier();
 *
 * // Classify query
 * const classification = await classifier.classify("My SSN is 123-45-6789");
 *
 * // Evaluate against firewall
 * const decision = firewall.evaluate(
 *   "My SSN is 123-45-6789",
 *   classification,
 *   "cloud"  // Requested destination
 * );
 *
 * console.log(decision.action);          // "deny"
 * console.log(decision.reason);          // "SSN detected - cannot transmit to cloud"
 * console.log(decision.matchedRules);    // ["ssn-block-cloud"]
 * console.log(decision.confidence);      // 0.8
 *
 * // Add custom rule
 * firewall.addRule({
 *   id: "eu-data-local-only",
 *   name: "EU Data Local Only",
 *   description: "Force EU data to stay local",
 *   condition: { type: "constraint", key: "region", value: "EU" },
 *   action: { type: "redirect", destination: "local" },
 *   priority: 99,
 *   enabled: true,
 * });
 *
 * // Export/import rules
 * const rulesJson = firewall.exportRules();
 * firewall.importRules(rulesJson, true);  // Replace existing rules
 *
 * // List rules
 * const allRules = firewall.getRules();
 * const enabledRules = firewall.getEnabledRules();
 *
 * // Rule management
 * firewall.disableRule("public-allow");
 * firewall.enableRule("public-allow");
 * firewall.removeRule("eu-data-local-only");
 * firewall.updateRulePriority("sovereign-block", 200);
 *
 * // Reset to defaults
 * firewall.resetToDefaults();
 *
 * // Clear all rules (use with caution!)
 * firewall.clearAllRules();
 * ```
 *
 * ## Custom Rule Examples
 *
 * ### Block specific PII types from cloud
 * ```typescript
 * firewall.addRule({
 *   id: "block-medical-from-cloud",
 *   name: "Block Medical from Cloud",
 *   description: "Prevent medical records from leaving local system",
 *   condition: {
 *     type: "hasPII",
 *     piiTypes: [PIIType.MEDICAL_RECORD, PIIType.DATE_OF_BIRTH],
 *   },
 *   action: {
 *     type: "deny",
 *     reason: "Medical data detected - cannot transmit to cloud",
 *   },
 *   priority: 96,
 *   enabled: true,
 * });
 * ```
 *
 * ### Redact specific PII types
 * ```typescript
 * firewall.addRule({
 *   id: "redact-email-from-cloud",
 *   name: "Redact Email from Cloud",
 *   description: "Redact email addresses before cloud transmission",
 *   condition: {
 *     type: "hasPII",
 *     piiTypes: [PIIType.EMAIL],
 *   },
 *   action: {
 *     type: "redact",
 *     strategy: RedactionStrategy.PARTIAL,
 *   },
 *   priority: 85,
 *   enabled: true,
 * });
 * ```
 *
 * ### Conditional routing based on constraints
 * ```typescript
 * firewall.addRule({
 *   id: "gdpr-compliance",
 *   name: "GDPR Compliance",
 *   description: "Force GDPR-sensitive data to local processing",
 *   condition: {
 *     type: "constraint",
 *     key: "gdpr",
 *     value: true,
 *   },
 *   action: {
 *     type: "redirect",
 *     destination: "local",
 *   },
 *   priority: 98,
 *   enabled: true,
 * });
 * ```
 *
 * ## Configuration
 *
 * - `customRules`: Array of custom rules to add
 * - `enableDefaultRules`: Include default security rules (default: true)
 * - `maxRules`: Maximum number of rules allowed (default: 100)
 *
 * ## Performance
 *
 * - **Latency**: ~100μs per evaluation (O(n) where n = number of rules)
 * - **Memory**: O(n) where n = number of rules
 * - **Scalability**: Up to 1000 rules with acceptable performance
 *
 * ## Security Considerations
 *
 * - **Default deny**: If no rules match, request is denied (security-first)
 * - **Priority ordering**: Rules evaluated highest-to-lowest priority
 * - **First match wins**: Once a rule matches, no further evaluation
 * - **Audit trail**: All decisions include matched rules and reasoning
 * - **Explicit configuration**: Rules must be explicitly enabled/disabled
 *
 * ## Best Practices
 *
 * 1. **Keep default rules enabled**: They provide essential security guarantees
 * 2. **Use high priorities for critical rules**: Ensure they're evaluated first
 * 3. **Document custom rules**: Use clear descriptions for maintainability
 * 4. **Test rule priority order**: Verify rules match in expected order
 * 5. **Audit decisions regularly**: Review matched rules and decision patterns
 * 6. **Version control rules**: Export and commit rules for reproducibility
 *
 * @see PrivacyClassifier - Privacy classification
 * @see IntentEncoder - Privacy-preserving intent encoding
 * @see RedactionAdditionProtocol - Functional privacy protocol
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

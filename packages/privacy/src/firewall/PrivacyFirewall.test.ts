/**
 * Tests for PrivacyFirewall
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  PrivacyFirewall,
  FirewallRule,
  type FirewallDecision,
} from "./PrivacyFirewall.js";
import { PrivacyLevel, PIIType } from "@lsi/protocol";
import { RedactionStrategy } from "../redaction/SemanticPIIRedactor.js";

describe("PrivacyFirewall", () => {
  let firewall: PrivacyFirewall;

  beforeEach(() => {
    firewall = new PrivacyFirewall();
  });

  describe("Default Rules", () => {
    it("should have default rules loaded", () => {
      const rules = firewall.getRules();
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.some(r => r.id === "sovereign-block")).toBe(true);
      expect(rules.some(r => r.id === "sensitive-redact")).toBe(true);
      expect(rules.some(r => r.id === "public-allow")).toBe(true);
    });

    it("should block SOVEREIGN data from cloud", () => {
      const classification = {
        level: PrivacyLevel.SOVEREIGN,
        confidence: 0.9,
        piiTypes: [PIIType.SSN],
        reason: "SSN detected",
      };

      const decision = firewall.evaluate(
        "My SSN is 123-45-6789",
        classification,
        "cloud"
      );

      expect(decision.action).toBe("deny");
      expect(decision.reason).toContain("SOVEREIGN");
      expect(decision.matchedRules).toContain("sovereign-block");
      expect(decision.finalDestination).toBe("local");
    });

    it("should redact SENSITIVE data for cloud", () => {
      const classification = {
        level: PrivacyLevel.SENSITIVE,
        confidence: 0.8,
        piiTypes: [PIIType.EMAIL],
        reason: "Email detected",
      };

      const decision = firewall.evaluate(
        "Email me at test@example.com",
        classification,
        "cloud"
      );

      expect(decision.action).toBe("redact");
      expect(decision.redactionStrategy).toBe(RedactionStrategy.PARTIAL);
      expect(decision.matchedRules).toContain("sensitive-redact");
    });

    it("should allow PUBLIC data to cloud", () => {
      const classification = {
        level: PrivacyLevel.PUBLIC,
        confidence: 0.95,
        piiTypes: [],
        reason: "No PII detected",
      };

      const decision = firewall.evaluate(
        "What is the capital of France?",
        classification,
        "cloud"
      );

      expect(decision.action).toBe("allow");
      expect(decision.matchedRules).toContain("public-allow");
      expect(decision.finalDestination).toBe("cloud");
    });

    it("should allow all data for local processing", () => {
      const classification = {
        level: PrivacyLevel.SOVEREIGN,
        confidence: 0.9,
        piiTypes: [PIIType.SSN],
        reason: "SSN detected",
      };

      const decision = firewall.evaluate(
        "My SSN is 123-45-6789",
        classification,
        "local"
      );

      expect(decision.action).toBe("allow");
      expect(decision.matchedRules).toContain("local-allow-all");
    });

    it("should block SSN from cloud specifically", () => {
      const classification = {
        level: PrivacyLevel.PUBLIC, // Even with public classification
        confidence: 0.7,
        piiTypes: [PIIType.SSN],
        reason: "SSN pattern detected",
      };

      const decision = firewall.evaluate(
        "SSN: 123-45-6789",
        classification,
        "cloud"
      );

      expect(decision.action).toBe("deny");
      expect(decision.reason).toContain("SSN");
      expect(decision.matchedRules).toContain("ssn-block-cloud");
    });

    it("should block credit card from cloud specifically", () => {
      const classification = {
        level: PrivacyLevel.PUBLIC,
        confidence: 0.7,
        piiTypes: [PIIType.CREDIT_CARD],
        reason: "Credit card pattern detected",
      };

      const decision = firewall.evaluate(
        "Card: 4111-1111-1111-1111",
        classification,
        "cloud"
      );

      expect(decision.action).toBe("deny");
      expect(decision.reason).toContain("Credit card");
      expect(decision.matchedRules).toContain("credit-card-block-cloud");
    });
  });

  describe("Rule Priority", () => {
    it("should evaluate higher priority rules first", () => {
      // Add a lower priority rule that would also match
      const lowPriorityRule: FirewallRule = {
        id: "low-priority-allow",
        name: "Low Priority Allow",
        description: "Should not match due to priority",
        condition: {
          type: "classification",
          value: PrivacyLevel.SOVEREIGN,
        },
        action: {
          type: "allow",
        },
        priority: 1,
        enabled: true,
      };

      firewall.addRule(lowPriorityRule);

      const classification = {
        level: PrivacyLevel.SOVEREIGN,
        confidence: 0.9,
        piiTypes: [],
        reason: "Test",
      };

      const decision = firewall.evaluate("test", classification, "cloud");

      // Should match sovereign-block (priority 100) not low-priority-allow (priority 1)
      expect(decision.action).toBe("deny");
      expect(decision.matchedRules).toContain("sovereign-block");
      expect(decision.matchedRules).not.toContain("low-priority-allow");
    });

    it("should update rule priority", () => {
      firewall.updateRulePriority("public-allow", 200);

      const rule = firewall.getRule("public-allow");
      expect(rule?.priority).toBe(200);
    });
  });

  describe("Custom Rules", () => {
    it("should add custom rule", () => {
      const customRule: FirewallRule = {
        id: "custom-rule",
        name: "Custom Rule",
        description: "A custom firewall rule",
        condition: {
          type: "hasPII",
          piiTypes: [PIIType.PHONE],
        },
        action: {
          type: "redact",
          strategy: RedactionStrategy.FULL,
        },
        priority: 75,
        enabled: true,
      };

      firewall.addRule(customRule);

      const rules = firewall.getRules();
      expect(rules.some(r => r.id === "custom-rule")).toBe(true);
    });

    it("should throw error when adding duplicate rule ID", () => {
      const rule: FirewallRule = {
        id: "sovereign-block", // Already exists
        name: "Duplicate",
        description: "Duplicate rule",
        condition: {
          type: "classification",
          value: PrivacyLevel.PUBLIC,
        },
        action: {
          type: "allow",
        },
        priority: 50,
        enabled: true,
      };

      expect(() => firewall.addRule(rule)).toThrow(
        "Rule with ID 'sovereign-block' already exists"
      );
    });

    it("should remove rule", () => {
      const initialCount = firewall.getRules().length;
      const removed = firewall.removeRule("public-allow");

      expect(removed).toBe(true);
      expect(firewall.getRules().length).toBe(initialCount - 1);
      expect(firewall.getRule("public-allow")).toBeUndefined();
    });

    it("should return false when removing non-existent rule", () => {
      const removed = firewall.removeRule("non-existent-rule");
      expect(removed).toBe(false);
    });

    it("should enable and disable rules", () => {
      firewall.disableRule("public-allow");
      let rule = firewall.getRule("public-allow");
      expect(rule?.enabled).toBe(false);

      firewall.enableRule("public-allow");
      rule = firewall.getRule("public-allow");
      expect(rule?.enabled).toBe(true);
    });

    it("should throw error when enabling non-existent rule", () => {
      expect(() => firewall.enableRule("non-existent")).toThrow(
        "Rule 'non-existent' not found"
      );
    });

    it("should throw error when disabling non-existent rule", () => {
      expect(() => firewall.disableRule("non-existent")).toThrow(
        "Rule 'non-existent' not found"
      );
    });

    it("should only evaluate enabled rules", () => {
      firewall.disableRule("sovereign-block");

      const classification = {
        level: PrivacyLevel.SOVEREIGN,
        confidence: 0.9,
        piiTypes: [],
        reason: "Test",
      };

      const decision = firewall.evaluate("test", classification, "cloud");

      // Should not match sovereign-block since it's disabled
      // May match a lower priority rule or default deny
      expect(decision.matchedRules).not.toContain("sovereign-block");
    });
  });

  describe("Condition Matching", () => {
    it("should match classification condition", () => {
      const rule: FirewallRule = {
        id: "test-classification",
        name: "Test Classification",
        description: "Test classification matching",
        condition: {
          type: "classification",
          value: PrivacyLevel.SENSITIVE,
        },
        action: {
          type: "deny",
          reason: "Test",
        },
        priority: 50,
        enabled: true,
      };

      firewall.addRule(rule);

      const classification = {
        level: PrivacyLevel.SENSITIVE,
        confidence: 0.8,
        piiTypes: [],
        reason: "Test",
      };

      const decision = firewall.evaluate("test", classification, "cloud");
      expect(decision.matchedRules).toContain("test-classification");
    });

    it("should match hasPII condition", () => {
      const rule: FirewallRule = {
        id: "test-pii",
        name: "Test PII",
        description: "Test PII matching",
        condition: {
          type: "hasPII",
          piiTypes: [PIIType.EMAIL, PIIType.PHONE],
        },
        action: {
          type: "deny",
          reason: "Test",
        },
        priority: 50,
        enabled: true,
      };

      firewall.addRule(rule);

      const classification = {
        level: PrivacyLevel.PUBLIC,
        confidence: 0.8,
        piiTypes: [PIIType.EMAIL],
        reason: "Test",
      };

      const decision = firewall.evaluate("test", classification, "cloud");
      expect(decision.matchedRules).toContain("test-pii");
    });

    it("should match destination condition", () => {
      const rule: FirewallRule = {
        id: "test-destination",
        name: "Test Destination",
        description: "Test destination matching",
        condition: {
          type: "destination",
          value: "cloud",
        },
        action: {
          type: "redact",
          strategy: RedactionStrategy.FULL,
        },
        priority: 50,
        enabled: true,
      };

      firewall.addRule(rule);

      const classification = {
        level: PrivacyLevel.PUBLIC,
        confidence: 0.8,
        piiTypes: [],
        reason: "Test",
      };

      const decision = firewall.evaluate("test", classification, "cloud");
      expect(decision.matchedRules).toContain("test-destination");
      expect(decision.action).toBe("redact");
    });

    it("should match constraint condition", () => {
      const rule: FirewallRule = {
        id: "test-constraint",
        name: "Test Constraint",
        description: "Test constraint matching",
        condition: {
          type: "constraint",
          key: "requireHIPAA",
          value: true,
        },
        action: {
          type: "deny",
          reason: "HIPAA compliance required",
        },
        priority: 50,
        enabled: true,
      };

      firewall.addRule(rule);

      const classification = {
        level: PrivacyLevel.PUBLIC,
        confidence: 0.8,
        piiTypes: [],
        reason: "Test",
      };

      const decision = firewall.evaluate("test", classification, "cloud", {
        requireHIPAA: true,
      });

      expect(decision.matchedRules).toContain("test-constraint");
    });
  });

  describe("Action Types", () => {
    it("should handle allow action", () => {
      const rule: FirewallRule = {
        id: "test-allow",
        name: "Test Allow",
        description: "Test allow action",
        condition: {
          type: "classification",
          value: PrivacyLevel.PUBLIC,
        },
        action: {
          type: "allow",
        },
        priority: 200,
        enabled: true,
      };

      firewall.addRule(rule);

      const classification = {
        level: PrivacyLevel.PUBLIC,
        confidence: 0.8,
        piiTypes: [],
        reason: "Test",
      };

      const decision = firewall.evaluate("test", classification, "cloud");
      expect(decision.action).toBe("allow");
    });

    it("should handle deny action", () => {
      const rule: FirewallRule = {
        id: "test-deny",
        name: "Test Deny",
        description: "Test deny action",
        condition: {
          type: "classification",
          value: PrivacyLevel.SOVEREIGN,
        },
        action: {
          type: "deny",
          reason: "Blocked by policy",
        },
        priority: 200,
        enabled: true,
      };

      firewall.addRule(rule);

      const classification = {
        level: PrivacyLevel.SOVEREIGN,
        confidence: 0.8,
        piiTypes: [],
        reason: "Test",
      };

      const decision = firewall.evaluate("test", classification, "cloud");
      expect(decision.action).toBe("deny");
      expect(decision.reason).toBe("Blocked by policy");
    });

    it("should handle redact action", () => {
      const rule: FirewallRule = {
        id: "test-redact",
        name: "Test Redact",
        description: "Test redact action",
        condition: {
          type: "classification",
          value: PrivacyLevel.SENSITIVE,
        },
        action: {
          type: "redact",
          strategy: RedactionStrategy.TOKEN,
        },
        priority: 200,
        enabled: true,
      };

      firewall.addRule(rule);

      const classification = {
        level: PrivacyLevel.SENSITIVE,
        confidence: 0.8,
        piiTypes: [],
        reason: "Test",
      };

      const decision = firewall.evaluate("test", classification, "cloud");
      expect(decision.action).toBe("redact");
      expect(decision.redactionStrategy).toBe(RedactionStrategy.TOKEN);
    });

    it("should handle redirect action", () => {
      const rule: FirewallRule = {
        id: "test-redirect",
        name: "Test Redirect",
        description: "Test redirect action",
        condition: {
          type: "classification",
          value: PrivacyLevel.SOVEREIGN,
        },
        action: {
          type: "redirect",
          destination: "local",
        },
        priority: 200,
        enabled: true,
      };

      firewall.addRule(rule);

      const classification = {
        level: PrivacyLevel.SOVEREIGN,
        confidence: 0.8,
        piiTypes: [],
        reason: "Test",
      };

      const decision = firewall.evaluate("test", classification, "cloud");
      expect(decision.action).toBe("redirect");
      expect(decision.finalDestination).toBe("local");
    });
  });

  describe("Rule Management", () => {
    it("should get enabled rules only", () => {
      firewall.disableRule("public-allow");
      const enabledRules = firewall.getEnabledRules();

      expect(enabledRules.every(r => r.enabled)).toBe(true);
      expect(enabledRules.some(r => r.id === "public-allow")).toBe(false);
    });

    it("should export and import rules", () => {
      const exported = firewall.exportRules();
      expect(exported).toBeDefined();
      expect(typeof exported).toBe("string");

      // Create new firewall and import
      const newFirewall = new PrivacyFirewall({ enableDefaultRules: false });
      newFirewall.importRules(exported);

      expect(newFirewall.getRules().length).toBe(firewall.getRules().length);
    });

    it("should import rules without replacing", () => {
      const customRule: FirewallRule = {
        id: "imported-rule",
        name: "Imported Rule",
        description: "Rule imported from JSON",
        condition: {
          type: "classification",
          value: PrivacyLevel.PUBLIC,
        },
        action: {
          type: "allow",
        },
        priority: 50,
        enabled: true,
      };

      const json = JSON.stringify([customRule]);
      firewall.importRules(json, false);

      expect(firewall.getRule("imported-rule")).toBeDefined();
      // Default rules should still be present
      expect(firewall.getRule("sovereign-block")).toBeDefined();
    });

    it("should import rules with replace", () => {
      const customRule: FirewallRule = {
        id: "replacement-rule",
        name: "Replacement Rule",
        description: "Replacement rule",
        condition: {
          type: "classification",
          value: PrivacyLevel.PUBLIC,
        },
        action: {
          type: "allow",
        },
        priority: 50,
        enabled: true,
      };

      const json = JSON.stringify([customRule]);
      firewall.importRules(json, true);

      expect(firewall.getRules().length).toBe(1);
      expect(firewall.getRule("replacement-rule")).toBeDefined();
      expect(firewall.getRule("sovereign-block")).toBeUndefined();
    });

    it("should clear all rules", () => {
      firewall.clearAllRules();
      expect(firewall.getRules().length).toBe(0);
    });

    it("should reset to default rules", () => {
      // Add a custom rule
      const customRule: FirewallRule = {
        id: "custom-to-remove",
        name: "Custom",
        description: "Custom rule",
        condition: {
          type: "classification",
          value: PrivacyLevel.PUBLIC,
        },
        action: {
          type: "allow",
        },
        priority: 50,
        enabled: true,
      };
      firewall.addRule(customRule);

      // Disable a default rule
      firewall.disableRule("sovereign-block");

      // Reset
      firewall.resetToDefaults();

      // Custom rule should be gone
      expect(firewall.getRule("custom-to-remove")).toBeUndefined();
      // Default rule should be re-enabled
      expect(firewall.getRule("sovereign-block")?.enabled).toBe(true);
    });
  });

  describe("evaluateWithContext", () => {
    it("should evaluate with context object", () => {
      const context = {
        query: "My SSN is 123-45-6789",
        classification: {
          level: PrivacyLevel.SOVEREIGN,
          confidence: 0.9,
          piiTypes: [PIIType.SSN],
          reason: "SSN detected",
        },
        destination: "cloud" as const,
        constraints: undefined,
      };

      const decision = firewall.evaluateWithContext(context);

      expect(decision.action).toBe("deny");
      expect(decision.matchedRules).toContain("sovereign-block");
    });
  });

  describe("Edge Cases", () => {
    it("should default to deny when no rules match", () => {
      const firewallWithoutDefaults = new PrivacyFirewall({
        enableDefaultRules: false,
      });

      const classification = {
        level: PrivacyLevel.PUBLIC,
        confidence: 0.8,
        piiTypes: [],
        reason: "Test",
      };

      const decision = firewallWithoutDefaults.evaluate(
        "test",
        classification,
        "cloud"
      );

      expect(decision.action).toBe("deny");
      expect(decision.reason).toContain("default deny");
    });

    it("should throw error when max rules exceeded", () => {
      const firewallWithLimit = new PrivacyFirewall({
        enableDefaultRules: false,
        maxRules: 2,
      });

      const rule1: FirewallRule = {
        id: "rule1",
        name: "Rule 1",
        description: "First rule",
        condition: { type: "classification", value: PrivacyLevel.PUBLIC },
        action: { type: "allow" },
        priority: 50,
        enabled: true,
      };

      const rule2: FirewallRule = {
        id: "rule2",
        name: "Rule 2",
        description: "Second rule",
        condition: { type: "classification", value: PrivacyLevel.PUBLIC },
        action: { type: "allow" },
        priority: 50,
        enabled: true,
      };

      const rule3: FirewallRule = {
        id: "rule3",
        name: "Rule 3",
        description: "Third rule",
        condition: { type: "classification", value: PrivacyLevel.PUBLIC },
        action: { type: "allow" },
        priority: 50,
        enabled: true,
      };

      firewallWithLimit.addRule(rule1);
      firewallWithLimit.addRule(rule2);

      expect(() => firewallWithLimit.addRule(rule3)).toThrow(
        "Maximum number of rules"
      );
    });

    it("should handle missing constraints gracefully", () => {
      const rule: FirewallRule = {
        id: "test-constraint",
        name: "Test Constraint",
        description: "Test constraint with no constraints provided",
        condition: {
          type: "constraint",
          key: "testKey",
          value: "testValue",
        },
        action: {
          type: "deny",
          reason: "Test",
        },
        priority: 50,
        enabled: true,
      };

      firewall.addRule(rule);

      const classification = {
        level: PrivacyLevel.PUBLIC,
        confidence: 0.8,
        piiTypes: [],
        reason: "Test",
      };

      // Should not match the constraint rule since no constraints provided
      const decision = firewall.evaluate("test", classification, "cloud");
      expect(decision.matchedRules).not.toContain("test-constraint");
    });
  });
});

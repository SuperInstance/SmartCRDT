/**
 * VisualPrivacyFirewall Tests
 *
 * Comprehensive test suite for visual privacy firewall.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  VisualPrivacyFirewall,
  createDefaultFirewall,
  createStrictFirewall,
  createPermissiveFirewall,
  type FirewallRule,
  type FirewallDecision,
  type QuarantineEntry,
  type FirewallStats,
} from "../VisualPrivacyFirewall";
import type {
  VisualPrivacyClassification,
  PrivacyElement,
} from "../VisualPrivacyClassifier";

describe("VisualPrivacyFirewall", () => {
  let firewall: VisualPrivacyFirewall;
  let testEmbedding: Float32Array;
  let testClassification: VisualPrivacyClassification;

  beforeEach(() => {
    firewall = new VisualPrivacyFirewall({
      defaultAction: "allow",
      autoQuarantine: true,
    });

    testEmbedding = createTestEmbedding();
    testClassification = createTestClassification("SAFE", []);
  });

  describe("Construction", () => {
    it("should create with default config", () => {
      const fw = new VisualPrivacyFirewall();
      expect(fw).toBeDefined();
    });

    it("should create default firewall", () => {
      const fw = createDefaultFirewall();
      expect(fw).toBeDefined();
    });

    it("should create strict firewall", () => {
      const fw = createStrictFirewall();
      expect(fw).toBeDefined();
    });

    it("should create permissive firewall", () => {
      const fw = createPermissiveFirewall();
      expect(fw).toBeDefined();
    });

    it("should load initial rules", () => {
      const rules = firewall.getRules();
      expect(rules.length).toBeGreaterThan(0);
    });

    it("should add default rules if none provided", () => {
      const fw = new VisualPrivacyFirewall();
      const rules = fw.getRules();

      expect(rules.some(r => r.id === "block-secret")).toBe(true);
      expect(rules.some(r => r.id === "redact-pii")).toBe(true);
    });
  });

  describe("Inspection - SAFE Data", () => {
    it("should allow SAFE classification", () => {
      const decision = firewall.inspect(testEmbedding, testClassification);

      expect(decision.action).toBe("allow");
      expect(decision.modified).toBe(false);
    });

    it("should use allow-safe rule", () => {
      const decision = firewall.inspect(testEmbedding, testClassification);

      expect(decision.ruleId).toBe("allow-safe");
    });

    it("should have valid decision structure", () => {
      const decision = firewall.inspect(testEmbedding, testClassification);

      expect(decision.action).toBeDefined();
      expect(decision.reason).toBeDefined();
      expect(decision.timestamp).toBeDefined();
      expect(decision.processingTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Inspection - PII Data", () => {
    it("should redact PII classification", () => {
      const piiClassification = createTestClassification("PII", [
        createPrivacyElement("face"),
      ]);

      const decision = firewall.inspect(testEmbedding, piiClassification);

      expect(decision.action).toBe("redact");
      expect(decision.modified).toBe(true);
    });

    it("should use redact-pii rule", () => {
      const piiClassification = createTestClassification("PII", [
        createPrivacyElement("face"),
      ]);

      const decision = firewall.inspect(testEmbedding, piiClassification);

      expect(decision.ruleId).toBe("redact-pii");
    });
  });

  describe("Inspection - SECRET Data", () => {
    it("should block SECRET classification", () => {
      const secretClassification = createTestClassification("SECRET", [
        createPrivacyElement("document"),
      ]);

      const decision = firewall.inspect(testEmbedding, secretClassification);

      expect(decision.action).toBe("block");
    });

    it("should use block-secret rule", () => {
      const secretClassification = createTestClassification("SECRET", [
        createPrivacyElement("document"),
      ]);

      const decision = firewall.inspect(testEmbedding, secretClassification);

      expect(decision.ruleId).toBe("block-secret");
    });

    it("should auto-quarantine SECRET when enabled", () => {
      const secretClassification = createTestClassification("SECRET", [
        createPrivacyElement("document"),
      ]);

      firewall.inspect(testEmbedding, secretClassification);

      const quarantine = firewall.getQuarantine();
      expect(quarantine.length).toBeGreaterThan(0);
    });
  });

  describe("Inspection - SENSITIVE with Faces", () => {
    it("should redact SENSITIVE with faces", () => {
      const sensitiveClassification = createTestClassification("SENSITIVE", [
        createPrivacyElement("face"),
      ]);

      const decision = firewall.inspect(testEmbedding, sensitiveClassification);

      expect(decision.action).toBe("redact");
      expect(decision.ruleId).toBe("redact-sensitive-faces");
    });
  });

  describe("Rule Management", () => {
    it("should add custom rule", () => {
      const customRule: FirewallRule = {
        id: "custom-rule",
        name: "Custom Rule",
        condition: {
          minPrivacyScore: 0.5,
        },
        action: "block",
        priority: 50,
        enabled: true,
      };

      firewall.addRule(customRule);

      const rules = firewall.getRules();
      expect(rules.some(r => r.id === "custom-rule")).toBe(true);
    });

    it("should remove rule", () => {
      const removed = firewall.removeRule("block-secret");

      expect(removed).toBe(true);

      const rules = firewall.getRules();
      expect(rules.some(r => r.id === "block-secret")).toBe(false);
    });

    it("should return false when removing non-existent rule", () => {
      const removed = firewall.removeRule("non-existent");
      expect(removed).toBe(false);
    });

    it("should get rule by ID", () => {
      const rule = firewall.getRule("block-secret");

      expect(rule).toBeDefined();
      expect(rule?.id).toBe("block-secret");
    });

    it("should return undefined for non-existent rule", () => {
      const rule = firewall.getRule("non-existent");
      expect(rule).toBeUndefined();
    });

    it("should get all rules", () => {
      const rules = firewall.getRules();

      expect(rules.length).toBeGreaterThan(0);
      expect(rules.every(r => r.id && r.name)).toBe(true);
    });

    it("should get only enabled rules", () => {
      firewall.setRuleEnabled("block-secret", false);

      const enabledRules = firewall.getRules(true);
      const allRules = firewall.getRules(false);

      expect(enabledRules.length).toBeLessThan(allRules.length);
    });

    it("should enable and disable rules", () => {
      firewall.setRuleEnabled("block-secret", false);
      let rule = firewall.getRule("block-secret");
      expect(rule?.enabled).toBe(false);

      firewall.setRuleEnabled("block-secret", true);
      rule = firewall.getRule("block-secret");
      expect(rule?.enabled).toBe(true);
    });

    it("should update rule metadata on changes", () => {
      const originalRule = firewall.getRule("block-secret");
      const originalUpdated = originalRule?.metadata?.updated;

      // Wait a bit to ensure timestamp changes
      setTimeout(() => {
        firewall.setRuleEnabled("block-secret", false);
        const updatedRule = firewall.getRule("block-secret");

        expect(updatedRule?.metadata?.updated).toBeGreaterThan(
          originalUpdated ?? 0
        );
      }, 10);
    });
  });

  describe("Rule Conditions", () => {
    it("should match classification condition", () => {
      const piiClassification = createTestClassification("PII", [
        createPrivacyElement("face"),
      ]);

      const decision = firewall.inspect(testEmbedding, piiClassification);

      expect(decision.action).toBe("redact");
    });

    it("should match hasElementTypes condition", () => {
      const sensitiveClassification = createTestClassification("SENSITIVE", [
        createPrivacyElement("face"),
        createPrivacyElement("text"),
      ]);

      const decision = firewall.inspect(testEmbedding, sensitiveClassification);

      expect(decision.action).toBe("redact");
    });

    it("should match excludeElementTypes condition", () => {
      const customRule: FirewallRule = {
        id: "exclude-faces",
        name: "Exclude Faces",
        condition: {
          excludeElementTypes: ["face"],
        },
        action: "allow",
        priority: 200,
        enabled: true,
      };

      firewall.addRule(customRule);

      const sensitiveClassification = createTestClassification("SENSITIVE", [
        createPrivacyElement("face"),
      ]);

      const decision = firewall.inspect(testEmbedding, sensitiveClassification);

      expect(decision.action).toBe("allow");
    });

    it("should match custom condition", () => {
      const customRule: FirewallRule = {
        id: "custom-cond",
        name: "Custom Condition",
        condition: {
          custom: (emb, cls) => cls.privacyScore > 0.5,
        },
        action: "block",
        priority: 200,
        enabled: true,
      };

      firewall.addRule(customRule);

      const highScoreClassification = createTestClassification("SENSITIVE", [
        createPrivacyElement("face"),
      ]);
      highScoreClassification.privacyScore = 0.8;

      const decision = firewall.inspect(testEmbedding, highScoreClassification);

      expect(decision.action).toBe("block");
    });

    it("should respect priority order", () => {
      const highPriorityRule: FirewallRule = {
        id: "high-priority",
        name: "High Priority",
        condition: {
          classification: ["SENSITIVE"],
        },
        action: "block",
        priority: 1000,
        enabled: true,
      };

      firewall.addRule(highPriorityRule);

      const sensitiveClassification = createTestClassification("SENSITIVE", [
        createPrivacyElement("text"),
      ]);

      const decision = firewall.inspect(testEmbedding, sensitiveClassification);

      expect(decision.ruleId).toBe("high-priority");
      expect(decision.action).toBe("block");
    });
  });

  describe("Quarantine", () => {
    it("should quarantine SECRET data", () => {
      const secretClassification = createTestClassification("SECRET", [
        createPrivacyElement("document"),
      ]);

      firewall.inspect(testEmbedding, secretClassification);

      const quarantine = firewall.getQuarantine();
      expect(quarantine.length).toBeGreaterThan(0);
    });

    it("should create quarantine entry with correct data", () => {
      const secretClassification = createTestClassification("SECRET", [
        createPrivacyElement("document"),
      ]);

      firewall.inspect(testEmbedding, secretClassification);

      const quarantine = firewall.getQuarantine();
      const entry = quarantine[0];

      expect(entry.id).toBeDefined();
      expect(entry.timestamp).toBeDefined();
      expect(entry.classification).toBe(secretClassification);
      expect(entry.released).toBe(false);
    });

    it("should not include released entries by default", () => {
      const secretClassification = createTestClassification("SECRET", [
        createPrivacyElement("document"),
      ]);

      firewall.inspect(testEmbedding, secretClassification);

      const quarantine = firewall.getQuarantine();
      const entryId = quarantine[0].id;

      firewall.releaseFromQuarantine(entryId, "Test release");

      const updatedQuarantine = firewall.getQuarantine();
      expect(updatedQuarantine.length).toBe(0);
    });

    it("should include released entries when requested", () => {
      const secretClassification = createTestClassification("SECRET", [
        createPrivacyElement("document"),
      ]);

      firewall.inspect(testEmbedding, secretClassification);

      const quarantine = firewall.getQuarantine();
      const entryId = quarantine[0].id;

      firewall.releaseFromQuarantine(entryId, "Test release");

      const allQuarantine = firewall.getQuarantine(true);
      expect(allQuarantine.length).toBe(1);
    });

    it("should release from quarantine", () => {
      const secretClassification = createTestClassification("SECRET", [
        createPrivacyElement("document"),
      ]);

      firewall.inspect(testEmbedding, secretClassification);

      const quarantine = firewall.getQuarantine();
      const entryId = quarantine[0].id;

      const released = firewall.releaseFromQuarantine(entryId, "Approved");

      expect(released).toBe(true);

      const entry = quarantine[0];
      expect(entry.released).toBe(true);
      expect(entry.releaseNotes).toBe("Approved");
    });

    it("should return false when releasing non-existent entry", () => {
      const released = firewall.releaseFromQuarantine("non-existent");
      expect(released).toBe(false);
    });

    it("should clear quarantine", () => {
      const secretClassification = createTestClassification("SECRET", [
        createPrivacyElement("document"),
      ]);

      firewall.inspect(testEmbedding, secretClassification);

      firewall.clearQuarantine();

      const quarantine = firewall.getQuarantine();
      expect(quarantine.length).toBe(0);
    });

    it("should enforce max quarantine size", () => {
      const fw = new VisualPrivacyFirewall({
        maxQuarantineSize: 3,
      });

      // Add more than max
      for (let i = 0; i < 5; i++) {
        const secretClassification = createTestClassification("SECRET", [
          createPrivacyElement("document"),
        ]);
        fw.inspect(testEmbedding, secretClassification);
      }

      const stats = fw.getStats();
      expect(stats.quarantineSize).toBeLessThanOrEqual(3);
    });
  });

  describe("Statistics", () => {
    it("should track total requests", () => {
      firewall.inspect(testEmbedding, testClassification);
      firewall.inspect(testEmbedding, testClassification);

      const stats = firewall.getStats();
      expect(stats.totalRequests).toBe(2);
    });

    it("should track requests by action", () => {
      const piiClassification = createTestClassification("PII", [
        createPrivacyElement("face"),
      ]);

      firewall.inspect(testEmbedding, testClassification);
      firewall.inspect(testEmbedding, piiClassification);

      const stats = firewall.getStats();
      expect(stats.requestsByAction.allow).toBe(1);
      expect(stats.requestsByAction.redact).toBe(1);
    });

    it("should track requests by classification", () => {
      const piiClassification = createTestClassification("PII", [
        createPrivacyElement("face"),
      ]);

      firewall.inspect(testEmbedding, testClassification);
      firewall.inspect(testEmbedding, piiClassification);

      const stats = firewall.getStats();
      expect(stats.requestsByClassification["SAFE"]).toBe(1);
      expect(stats.requestsByClassification["PII"]).toBe(1);
    });

    it("should track average processing time", () => {
      firewall.inspect(testEmbedding, testClassification);

      const stats = firewall.getStats();
      expect(stats.avgProcessingTime).toBeGreaterThan(0);
    });

    it("should track rules triggered", () => {
      firewall.inspect(testEmbedding, testClassification);

      const stats = firewall.getStats();
      expect(stats.rulesTriggered["allow-safe"]).toBe(1);
    });

    it("should reset statistics", () => {
      firewall.inspect(testEmbedding, testClassification);
      firewall.resetStats();

      const stats = firewall.getStats();
      expect(stats.totalRequests).toBe(0);
    });
  });

  describe("Audit Log", () => {
    it("should log decisions when enabled", () => {
      const fw = new VisualPrivacyFirewall({
        enableAuditLog: true,
      });

      fw.inspect(testEmbedding, testClassification);

      const log = fw.getAuditLog();
      expect(log.length).toBe(1);
    });

    it("should respect limit parameter", () => {
      for (let i = 0; i < 10; i++) {
        firewall.inspect(testEmbedding, testClassification);
      }

      const log = firewall.getAuditLog(5);
      expect(log.length).toBe(5);
    });

    it("should clear audit log", () => {
      firewall.inspect(testEmbedding, testClassification);

      firewall.clearAuditLog();

      const log = firewall.getAuditLog();
      expect(log.length).toBe(0);
    });
  });

  describe("Rule Validation", () => {
    it("should require rule id and name", () => {
      expect(() => {
        firewall.addRule({
          id: "",
          name: "",
          condition: {},
          action: "allow",
          priority: 10,
          enabled: true,
        });
      }).toThrow();
    });
  });

  describe("Default Actions", () => {
    it("should use default action when no rules match", () => {
      const fw = new VisualPrivacyFirewall({
        defaultAction: "block",
        rules: [], // No rules
      });

      const decision = fw.inspect(testEmbedding, testClassification);

      expect(decision.action).toBe("block");
    });
  });

  describe("Auto-Quarantine", () => {
    it("should quarantine SECRET when autoQuarantine is true", () => {
      const fw = new VisualPrivacyFirewall({
        autoQuarantine: true,
      });

      const secretClassification = createTestClassification("SECRET", [
        createPrivacyElement("document"),
      ]);

      fw.inspect(testEmbedding, secretClassification);

      const quarantine = fw.getQuarantine();
      expect(quarantine.length).toBeGreaterThan(0);
    });

    it("should not quarantine SECRET when autoQuarantine is false", () => {
      const fw = new VisualPrivacyFirewall({
        autoQuarantine: false,
      });

      const secretClassification = createTestClassification("SECRET", [
        createPrivacyElement("document"),
      ]);

      fw.inspect(testEmbedding, secretClassification);

      const quarantine = fw.getQuarantine();
      expect(quarantine.length).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty detected elements", () => {
      const classification = createTestClassification("SAFE", []);
      const decision = firewall.inspect(testEmbedding, classification);

      expect(decision.action).toBeDefined();
    });

    it("should handle multiple matching rules (priority order)", () => {
      const lowPriority: FirewallRule = {
        id: "low",
        name: "Low",
        condition: { classification: ["SENSITIVE"] },
        action: "allow",
        priority: 10,
        enabled: true,
      };

      const highPriority: FirewallRule = {
        id: "high",
        name: "High",
        condition: { classification: ["SENSITIVE"] },
        action: "block",
        priority: 100,
        enabled: true,
      };

      firewall.addRule(lowPriority);
      firewall.addRule(highPriority);

      const sensitiveClassification = createTestClassification("SENSITIVE", [
        createPrivacyElement("text"),
      ]);

      const decision = firewall.inspect(testEmbedding, sensitiveClassification);

      expect(decision.ruleId).toBe("high");
      expect(decision.action).toBe("block");
    });

    it("should handle disabled rules", () => {
      firewall.setRuleEnabled("block-secret", false);

      const secretClassification = createTestClassification("SECRET", [
        createPrivacyElement("document"),
      ]);

      const decision = firewall.inspect(testEmbedding, secretClassification);

      expect(decision.ruleId).not.toBe("block-secret");
    });
  });
});

// Helper functions

function createTestEmbedding(): Float32Array {
  const embedding = new Float32Array(768);
  for (let i = 0; i < 768; i++) {
    embedding[i] = (Math.random() - 0.5) * 0.5;
  }
  return embedding;
}

function createTestClassification(
  classification: VisualPrivacyClassification["classification"],
  detectedElements: PrivacyElement[]
): VisualPrivacyClassification {
  return {
    version: "1.0",
    embedding: createTestEmbedding(),
    classification,
    confidence: 0.8,
    detectedElements,
    redactionNeeded: classification !== "SAFE",
    privacyScore: detectedElements.length > 0 ? 0.7 : 0,
    timestamp: Date.now(),
  };
}

function createPrivacyElement(type: PrivacyElement["type"]): PrivacyElement {
  return {
    type,
    boundingBox: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
    confidence: 0.8,
    semanticRegion: {
      startDim: 0,
      endDim: 100,
      activationStrength: 0.8,
    },
  };
}

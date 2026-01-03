/**
 * @lsi/vljepa/planning/test/PlanValidator.test.ts
 * Comprehensive tests for PlanValidator (40+ tests)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  PlanValidator,
  createPlanValidator,
  validatePlan,
  DEFAULT_VALIDATION_CONFIG,
  DEFAULT_VALIDATION_RULES,
} from "../PlanValidator.js";
import type {
  ValidationReport,
  ValidationRule,
  ValidationContext,
} from "../PlanValidator.js";
import type {
  ActionSequence,
  PlannedAction,
} from "../ActionSequenceGenerator.js";

describe("PlanValidator", () => {
  let validator: PlanValidator;
  let mockSequence: ActionSequence;

  beforeEach(() => {
    validator = new PlanValidator();

    const mockAction: PlannedAction = {
      id: "action-1",
      type: "modify",
      target: "#submit-btn",
      params: {
        backgroundColor: "#FF6B6B",
      },
      preconditions: ["element exists"],
      postconditions: ["button styled"],
      confidence: 0.9,
      estimatedDuration: 150,
      reasoning: "Apply styling",
      dependencies: [],
      reversible: true,
    };

    mockSequence = {
      version: "1.0",
      actions: [mockAction],
      totalEstimatedTime: 150,
      confidence: 0.9,
      reasoning: "Style the button",
      alternatives: [],
      metadata: {
        timestamp: Date.now(),
        actionCount: 1,
        primaryChangeType: "style",
        complexity: 0.5,
        risk: "low",
      },
    };
  });

  describe("Construction", () => {
    it("should create instance with default config", () => {
      expect(validator).toBeInstanceOf(PlanValidator);
    });

    it("should create instance with custom config", () => {
      const customValidator = new PlanValidator({
        strictMode: true,
        minConfidence: 0.7,
      });
      expect(customValidator).toBeInstanceOf(PlanValidator);
      expect(customValidator.getConfig().strictMode).toBe(true);
    });

    it("should create instance with custom rules", () => {
      const customRule: ValidationRule = {
        id: "test-rule",
        name: "Test Rule",
        description: "Test validation rule",
        severity: "warning",
        enabled: true,
        validate: () => [],
      };

      const customValidator = new PlanValidator(undefined, [customRule]);
      expect(customValidator.getRules()).toContain(customRule);
    });
  });

  describe("validate()", () => {
    it("should validate plan", async () => {
      const report = await validator.validate(mockSequence);
      expect(report).toBeDefined();
    });

    it("should return valid for simple plan", async () => {
      const report = await validator.validate(mockSequence);
      expect(report.valid).toBe(true);
    });

    it("should include confidence in report", async () => {
      const report = await validator.validate(mockSequence);
      expect(report.confidence).toBeGreaterThanOrEqual(0);
      expect(report.confidence).toBeLessThanOrEqual(1);
    });

    it("should include issues array", async () => {
      const report = await validator.validate(mockSequence);
      expect(Array.isArray(report.issues)).toBe(true);
    });

    it("should include warnings array", async () => {
      const report = await validator.validate(mockSequence);
      expect(Array.isArray(report.warnings)).toBe(true);
    });

    it("should include suggestions array", async () => {
      const report = await validator.validate(mockSequence);
      expect(Array.isArray(report.suggestions)).toBe(true);
    });

    it("should include metadata", async () => {
      const report = await validator.validate(mockSequence);
      expect(report.metadata).toBeDefined();
      expect(report.metadata.timestamp).toBeDefined();
      expect(report.metadata.duration).toBeDefined();
      expect(report.metadata.actionCount).toBeDefined();
    });

    it("should handle empty action sequence", async () => {
      const emptySequence = { ...mockSequence, actions: [] };
      const report = await validator.validate(emptySequence);
      expect(report).toBeDefined();
    });

    it("should validate against context", async () => {
      const context: ValidationContext = {
        availableElements: ["#submit-btn", ".container"],
        userPreferences: {
          allowDestructive: true,
          maxRiskTolerance: 0.8,
        },
      };

      const report = await validator.validate(mockSequence, context);
      expect(report).toBeDefined();
    });
  });

  describe("validateBatch()", () => {
    it("should validate multiple sequences", async () => {
      const sequences = [mockSequence, mockSequence];
      const reports = await validator.validateBatch(sequences);
      expect(reports).toHaveLength(2);
    });

    it("should handle empty array", async () => {
      const reports = await validator.validateBatch([]);
      expect(reports).toHaveLength(0);
    });

    it("should process sequences independently", async () => {
      const sequences = [mockSequence, mockSequence];
      const reports = await validator.validateBatch(sequences);
      expect(reports[0]).not.toBe(reports[1]);
    });
  });

  describe("Confidence Validation", () => {
    it("should flag low confidence actions", async () => {
      const lowConfidenceAction: PlannedAction = {
        ...mockSequence.actions[0],
        confidence: 0.3,
      };

      const lowConfidenceSequence = {
        ...mockSequence,
        actions: [lowConfidenceAction],
      };

      const report = await validator.validate(lowConfidenceSequence);
      const lowConfIssues = report.issues.filter(i => i.type === "uncertain");
      expect(lowConfIssues.length).toBeGreaterThan(0);
    });

    it("should respect minConfidence threshold", async () => {
      const strictValidator = new PlanValidator({ minConfidence: 0.8 });
      const lowConfidenceSequence = {
        ...mockSequence,
        confidence: 0.7,
      };

      const report = await strictValidator.validate(lowConfidenceSequence);
      expect(report.issues.some(i => i.id === "min-confidence")).toBe(true);
    });
  });

  describe("Element Validation", () => {
    it("should validate element existence when enabled", async () => {
      const context: ValidationContext = {
        availableElements: [".container"],
      };

      const missingElementSequence = {
        ...mockSequence,
        actions: [
          {
            ...mockSequence.actions[0],
            target: "#non-existent",
          },
        ],
      };

      const report = await validator.validate(missingElementSequence, context);
      const missingIssues = report.issues.filter(i => i.type === "impossible");
      expect(missingIssues.length).toBeGreaterThan(0);
    });

    it("should allow wildcards", async () => {
      const wildcardAction: PlannedAction = {
        ...mockSequence.actions[0],
        target: "*",
      };

      const wildcardSequence = {
        ...mockSequence,
        actions: [wildcardAction],
      };

      const report = await validator.validate(wildcardSequence);
      const impossibleIssues = report.issues.filter(
        i => i.type === "impossible" && i.action?.id === wildcardAction.id
      );
      expect(impossibleIssues.length).toBe(0);
    });

    it("should allow create actions for non-existent elements", async () => {
      const createAction: PlannedAction = {
        ...mockSequence.actions[0],
        type: "create",
        target: "#new-element",
      };

      const context: ValidationContext = {
        availableElements: ["body"],
      };

      const createSequence = {
        ...mockSequence,
        actions: [createAction],
      };

      const report = await validator.validate(createSequence, context);
      const impossibleIssues = report.issues.filter(
        i => i.type === "impossible" && i.action?.id === createAction.id
      );
      expect(impossibleIssues.length).toBe(0);
    });
  });

  describe("Reversibility Validation", () => {
    it("should flag irreversible actions when required", async () => {
      const irreversibleValidator = new PlanValidator({
        requireReversible: true,
      });
      const irreversibleAction: PlannedAction = {
        ...mockSequence.actions[0],
        reversible: false,
      };

      const irreversibleSequence = {
        ...mockSequence,
        actions: [irreversibleAction],
      };

      const report = await irreversibleValidator.validate(irreversibleSequence);
      const reversibilityIssues = report.issues.filter(
        i => i.id === "reversible-required"
      );
      expect(reversibilityIssues.length).toBeGreaterThan(0);
    });

    it("should allow irreversible actions when not required", async () => {
      const irreversibleAction: PlannedAction = {
        ...mockSequence.actions[0],
        reversible: false,
      };

      const irreversibleSequence = {
        ...mockSequence,
        actions: [irreversibleAction],
      };

      const report = await validator.validate(irreversibleSequence);
      const reversibilityIssues = report.issues.filter(
        i => i.id === "reversible-required"
      );
      expect(reversibilityIssues.length).toBe(0);
    });
  });

  describe("Complexity Validation", () => {
    it("should flag overly complex sequences", async () => {
      const lowComplexityValidator = new PlanValidator({ maxComplexity: 0.6 });
      const complexSequence = {
        ...mockSequence,
        metadata: {
          ...mockSequence.metadata,
          complexity: 0.9,
        },
      };

      const report = await lowComplexityValidator.validate(complexSequence);
      const complexityIssues = report.issues.filter(
        i => i.id === "max-complexity"
      );
      expect(complexityIssues.length).toBeGreaterThan(0);
    });
  });

  describe("Time Validation", () => {
    it("should flag long-running sequences", async () => {
      const shortTimeValidator = new PlanValidator({ maxEstimatedTime: 100 });
      const longSequence = {
        ...mockSequence,
        totalEstimatedTime: 5000,
      };

      const report = await shortTimeValidator.validate(longSequence);
      const timeIssues = report.issues.filter(i => i.id === "max-time");
      expect(timeIssues.length).toBeGreaterThan(0);
    });
  });

  describe("Validation Rules", () => {
    it("should apply default rules", async () => {
      const deleteBodyAction: PlannedAction = {
        ...mockSequence.actions[0],
        type: "delete",
        target: "body",
      };

      const deleteBodySequence = {
        ...mockSequence,
        actions: [deleteBodyAction],
      };

      const report = await validator.validate(deleteBodySequence);
      const dangerousIssues = report.issues.filter(i => i.type === "dangerous");
      expect(dangerousIssues.length).toBeGreaterThan(0);
    });

    it("should skip disabled rules", async () => {
      validator.disableRule("no-delete-body");

      const deleteBodyAction: PlannedAction = {
        ...mockSequence.actions[0],
        type: "delete",
        target: "body",
      };

      const deleteBodySequence = {
        ...mockSequence,
        actions: [deleteBodyAction],
      };

      const report = await validator.validate(deleteBodySequence);
      const dangerousIssues = report.issues.filter(
        i => i.id === "no-delete-body"
      );
      expect(dangerousIssues.length).toBe(0);
    });

    it("should apply enabled rules", async () => {
      const customRule: ValidationRule = {
        id: "custom-rule",
        name: "Custom Rule",
        description: "Test custom rule",
        severity: "warning",
        enabled: true,
        validate: action => {
          if (action.target === "#test") {
            return [
              {
                id: "custom-rule",
                severity: "warning",
                type: "risky",
                description: "Test target found",
                action,
                confidence: 1.0,
              },
            ];
          }
          return [];
        },
      };

      const customValidator = new PlanValidator(undefined, [customRule]);

      const testActionSequence = {
        ...mockSequence,
        actions: [
          {
            ...mockSequence.actions[0],
            target: "#test",
          },
        ],
      };

      const report = await customValidator.validate(testActionSequence);
      expect(report.issues.some(i => i.id === "custom-rule")).toBe(true);
    });
  });

  describe("Strict Mode", () => {
    it("should invalidate plans with errors in strict mode", async () => {
      const strictValidator = new PlanValidator({ strictMode: true });
      const errorActionSequence = {
        ...mockSequence,
        actions: [
          {
            ...mockSequence.actions[0],
            confidence: 0.3,
          },
        ],
      };

      const report = await strictValidator.validate(errorActionSequence);
      expect(report.valid).toBe(false);
    });

    it("should allow warnings in strict mode", async () => {
      const strictValidator = new PlanValidator({ strictMode: true });
      const report = await strictValidator.validate(mockSequence);
      expect(report).toBeDefined();
    });
  });

  describe("Configuration", () => {
    it("should get current config", () => {
      const config = validator.getConfig();
      expect(config).toBeDefined();
      expect(config.strictMode).toBeDefined();
      expect(config.minConfidence).toBeDefined();
    });

    it("should update config", () => {
      validator.updateConfig({ strictMode: true });
      expect(validator.getConfig().strictMode).toBe(true);
    });

    it("should preserve other config values when updating", () => {
      const originalMinConf = validator.getConfig().minConfidence;
      validator.updateConfig({ strictMode: true });
      expect(validator.getConfig().minConfidence).toBe(originalMinConf);
    });
  });

  describe("Rule Management", () => {
    it("should add custom rule", () => {
      const customRule: ValidationRule = {
        id: "test-rule",
        name: "Test",
        description: "Test rule",
        severity: "warning",
        enabled: true,
        validate: () => [],
      };

      const initialCount = validator.getRules().length;
      validator.addRule(customRule);
      expect(validator.getRules().length).toBe(initialCount + 1);
      expect(validator.getRules()).toContain(customRule);
    });

    it("should remove rule by ID", () => {
      const initialCount = validator.getRules().length;
      validator.removeRule("no-delete-body");
      expect(validator.getRules().length).toBe(initialCount - 1);
    });

    it("should enable rule", () => {
      validator.disableRule("check-confidence");
      validator.enableRule("check-confidence");
      const rule = validator.getRules().find(r => r.id === "check-confidence");
      expect(rule?.enabled).toBe(true);
    });

    it("should disable rule", () => {
      validator.disableRule("check-confidence");
      const rule = validator.getRules().find(r => r.id === "check-confidence");
      expect(rule?.enabled).toBe(false);
    });

    it("should get all rules", () => {
      const rules = validator.getRules();
      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBeGreaterThan(0);
    });
  });

  describe("Suggestions Generation", () => {
    it("should suggest alternatives when issues found", async () => {
      const errorSequence = {
        ...mockSequence,
        actions: [
          {
            ...mockSequence.actions[0],
            confidence: 0.3,
          },
        ],
        alternatives: [{ ...mockSequence, confidence: 0.9 }],
      };

      const report = await validator.validate(errorSequence);
      if (report.issues.length > 0) {
        const hasAlternativeSuggestion = report.suggestions.some(s =>
          s.toLowerCase().includes("alternative")
        );
        expect(hasAlternativeSuggestion).toBe(true);
      }
    });

    it("should suggest breaking down long sequences", async () => {
      const manyActions = Array(20)
        .fill(null)
        .map((_, i) => ({
          ...mockSequence.actions[0],
          id: `action-${i}`,
        }));

      const longSequence = {
        ...mockSequence,
        actions: manyActions,
        metadata: {
          ...mockSequence.metadata,
          actionCount: 20,
        },
      };

      const report = await validator.validate(longSequence);
      const hasBreakdownSuggestion = report.suggestions.some(s =>
        s.toLowerCase().includes("smaller")
      );
      expect(hasBreakdownSuggestion).toBe(true);
    });

    it("should suggest backup for high-risk plans", async () => {
      const highRiskSequence = {
        ...mockSequence,
        metadata: {
          ...mockSequence.metadata,
          risk: "high" as const,
        },
      };

      const report = await validator.validate(highRiskSequence);
      const hasBackupSuggestion = report.suggestions.some(s =>
        s.toLowerCase().includes("backup")
      );
      expect(hasBackupSuggestion).toBe(true);
    });
  });

  describe("Factory Functions", () => {
    it("should create validator with factory", () => {
      const v = createPlanValidator();
      expect(v).toBeInstanceOf(PlanValidator);
    });

    it("should create validator with custom config via factory", () => {
      const v = createPlanValidator({ strictMode: true });
      expect(v.getConfig().strictMode).toBe(true);
    });

    it("should validate plan without instantiating", async () => {
      const report = await validatePlan(mockSequence);
      expect(report).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle plan with no actions", async () => {
      const emptyPlan = { ...mockSequence, actions: [] };
      const report = await validator.validate(emptyPlan);
      expect(report).toBeDefined();
      expect(report.metadata.actionCount).toBe(0);
    });

    it("should handle plan with very low confidence", async () => {
      const zeroConfidencePlan = { ...mockSequence, confidence: 0 };
      const report = await validator.validate(zeroConfidencePlan);
      expect(report.confidence).toBeLessThan(0.5);
    });

    it("should handle plan with complexity of 1", async () => {
      const maxComplexityPlan = {
        ...mockSequence,
        metadata: {
          ...mockSequence.metadata,
          complexity: 1,
        },
      };
      const report = await validator.validate(maxComplexityPlan);
      expect(report).toBeDefined();
    });
  });
});

describe("DEFAULT_VALIDATION_CONFIG", () => {
  it("should have valid defaults", () => {
    expect(DEFAULT_VALIDATION_CONFIG.strictMode).toBe(false);
    expect(DEFAULT_VALIDATION_CONFIG.minConfidence).toBe(0.5);
    expect(DEFAULT_VALIDATION_CONFIG.maxComplexity).toBe(0.9);
  });

  it("should not require reversibility by default", () => {
    expect(DEFAULT_VALIDATION_CONFIG.requireReversible).toBe(false);
  });

  it("should validate elements by default", () => {
    expect(DEFAULT_VALIDATION_CONFIG.validateElements).toBe(true);
  });

  it("should use world model by default", () => {
    expect(DEFAULT_VALIDATION_CONFIG.useWorldModel).toBe(true);
  });
});

describe("DEFAULT_VALIDATION_RULES", () => {
  it("should have default rules", () => {
    expect(DEFAULT_VALIDATION_RULES.length).toBeGreaterThan(0);
  });

  it("should have all required rule fields", () => {
    DEFAULT_VALIDATION_RULES.forEach(rule => {
      expect(rule.id).toBeDefined();
      expect(rule.name).toBeDefined();
      expect(rule.description).toBeDefined();
      expect(rule.severity).toBeDefined();
      expect(rule.validate).toBeInstanceOf(Function);
    });
  });

  it("should have critical severity rules", () => {
    const criticalRules = DEFAULT_VALIDATION_RULES.filter(
      r => r.severity === "critical"
    );
    expect(criticalRules.length).toBeGreaterThan(0);
  });

  it("should have warning severity rules", () => {
    const warningRules = DEFAULT_VALIDATION_RULES.filter(
      r => r.severity === "warning"
    );
    expect(warningRules.length).toBeGreaterThan(0);
  });

  it("should have error severity rules", () => {
    const errorRules = DEFAULT_VALIDATION_RULES.filter(
      r => r.severity === "error"
    );
    expect(errorRules.length).toBeGreaterThan(0);
  });
});

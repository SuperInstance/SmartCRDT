/**
 * @lsi/vljepa/planning/PlanValidator - Zero-Shot Planning Component
 *
 * Validates action plans before execution to ensure safety and feasibility.
 * Prevents dangerous or impossible actions from being executed.
 *
 * Key Concepts:
 * - Feasibility Check: Can this action be performed?
 * - Safety Check: Will this break anything?
 * - Efficiency Check: Is there a better way?
 * - Reversibility Check: Can we undo this?
 *
 * @version 1.0.0
 * @see https://arxiv.org/abs/2512.10942 - VL-JEPA Paper (Section on Safe Planning)
 */

import type {
  ActionSequence,
  PlannedAction,
} from "./ActionSequenceGenerator.js";
import type { EmbeddingDelta } from "./EmbeddingDeltaCalculator.js";
import type { WorldModelPrediction, SideEffect } from "./WorldModelReasoner.js";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Validation Issue - Problem found during validation
 *
 * Represents a specific issue found during plan validation.
 */
export interface ValidationIssue {
  /** Severity level */
  severity: "critical" | "error" | "warning";

  /** Issue type */
  type:
    | "impossible"
    | "risky"
    | "uncertain"
    | "slow"
    | "redundant"
    | "dangerous";

  /** Human-readable description */
  description: string;

  /** Action that caused the issue */
  action?: PlannedAction;

  /** Suggested resolution */
  resolution?: string;

  /** Confidence that this is actually an issue (0-1) */
  confidence: number;

  /** Issue ID */
  id: string;
}

/**
 * Validation Warning - Non-critical concern
 *
 * Represents a warning that doesn't prevent execution but should be noted.
 */
export interface ValidationWarning {
  /** Warning type */
  type: "performance" | "usability" | "accessibility" | "best_practice";

  /** Human-readable description */
  description: string;

  /** Related action */
  action?: PlannedAction;

  /** Suggestion for improvement */
  suggestion?: string;
}

/**
 * Validation Report - Complete validation results
 *
 * Represents the complete validation report for a plan.
 */
export interface ValidationReport {
  /** Whether plan is valid (safe to execute) */
  valid: boolean;

  /** Overall confidence in validation (0-1) */
  confidence: number;

  /** Critical issues that must be fixed */
  issues: ValidationIssue[];

  /** Warnings that should be considered */
  warnings: ValidationWarning[];

  /** Suggestions for improvement */
  suggestions: string[];

  /** Validation metadata */
  metadata: {
    /** Validation timestamp */
    timestamp: number;

    /** Validation duration (ms) */
    duration: number;

    /** Number of actions validated */
    actionCount: number;

    /** Number of issues found */
    issueCount: number;

    /** Number of warnings found */
    warningCount: number;
  };
}

/**
 * Validation Rule - Custom validation rule
 *
 * Represents a custom validation rule for specific checks.
 */
export interface ValidationRule {
  /** Rule ID */
  id: string;

  /** Rule name */
  name: string;

  /** Rule description */
  description: string;

  /** Rule function (returns issues if validation fails) */
  validate: (
    action: PlannedAction,
    context: ValidationContext
  ) => ValidationIssue[];

  /** Rule severity */
  severity: "critical" | "error" | "warning";

  /** Whether rule is enabled */
  enabled: boolean;
}

/**
 * Validation Context - Context for validation
 *
 * Provides additional context for validation.
 */
export interface ValidationContext {
  /** Current UI structure */
  uiStructure?: string;

  /** Available elements */
  availableElements?: string[];

  /** User preferences */
  userPreferences?: {
    /** Allow destructive actions */
    allowDestructive?: boolean;

    /** Allow style changes */
    allowStyleChanges?: boolean;

    /** Allow structural changes */
    allowStructuralChanges?: boolean;

    /** Maximum risk tolerance (0-1) */
    maxRiskTolerance?: number;
  };

  /** Platform constraints */
  platformConstraints?: {
    /** Supported CSS properties */
    supportedCSS?: string[];

    /** Supported element types */
    supportedElements?: string[];

    /** Maximum complexity */
    maxComplexity?: number;
  };

  /** World model predictions (if available) */
  worldPredictions?: Map<string, WorldModelPrediction>;
}

/**
 * Validation Configuration
 */
export interface ValidationConfig {
  /** Whether to enable strict validation */
  strictMode: boolean;

  /** Minimum confidence threshold for actions */
  minConfidence: number;

  /** Maximum allowed complexity */
  maxComplexity: number;

  /** Maximum allowed estimated time (ms) */
  maxEstimatedTime: number;

  /** Whether to check for reversible actions */
  requireReversible: boolean;

  /** Whether to validate against available elements */
  validateElements: boolean;

  /** Whether to use world model predictions */
  useWorldModel: boolean;

  /** Custom validation rules */
  customRules: ValidationRule[];
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default validation configuration
 */
export const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  strictMode: false,
  minConfidence: 0.5,
  maxComplexity: 0.9,
  maxEstimatedTime: 30000, // 30 seconds
  requireReversible: false,
  validateElements: true,
  useWorldModel: true,
  customRules: [],
};

// ============================================================================
// DEFAULT VALIDATION RULES
// ============================================================================

/**
 * Default validation rules
 */
export const DEFAULT_VALIDATION_RULES: ValidationRule[] = [
  {
    id: "no-delete-body",
    name: "Prevent Body Deletion",
    description: "Prevent deletion of body or main container",
    severity: "critical",
    enabled: true,
    validate: (action, context) => {
      if (action.type === "delete") {
        const dangerousTargets = [
          "body",
          "html",
          "html > body",
          "#app",
          "[id*='app']",
        ];
        if (
          dangerousTargets.some(
            t => action.target === t || action.target.includes(t)
          )
        ) {
          return [
            {
              id: "no-delete-body",
              severity: "critical",
              type: "dangerous",
              description: `Cannot delete critical element: ${action.target}`,
              action,
              resolution: "Choose a more specific target",
              confidence: 1.0,
            },
          ];
        }
      }
      return [];
    },
  },
  {
    id: "check-confidence",
    name: "Check Action Confidence",
    description: "Flag actions with low confidence",
    severity: "warning",
    enabled: true,
    validate: (action, context) => {
      if (action.confidence < 0.5) {
        return [
          {
            id: "check-confidence",
            severity: "error",
            type: "uncertain",
            description: `Action has low confidence: ${action.confidence.toFixed(2)}`,
            action,
            resolution:
              "Consider alternative approaches or provide more context",
            confidence: 1 - action.confidence,
          },
        ];
      }
      return [];
    },
  },
  {
    id: "check-dependencies",
    name: "Check Action Dependencies",
    description: "Verify all dependencies can be satisfied",
    severity: "error",
    enabled: true,
    validate: (action, context) => {
      const issues: ValidationIssue[] = [];

      for (const dep of action.dependencies) {
        // Check if dependency exists
        if (
          context.availableElements &&
          !context.availableElements.includes(dep)
        ) {
          issues.push({
            id: "check-dependencies",
            severity: "error",
            type: "impossible",
            description: `Dependency not found: ${dep}`,
            action,
            resolution: "Ensure all dependencies exist before this action",
            confidence: 0.8,
          });
        }
      }

      return issues;
    },
  },
  {
    id: "check-structural-changes",
    name: "Check Structural Changes",
    description: "Warn about potentially risky structural changes",
    severity: "warning",
    enabled: true,
    validate: (action, context) => {
      if (
        (action.type === "create" || action.type === "delete") &&
        !context.userPreferences?.allowStructuralChanges
      ) {
        return [
          {
            id: "check-structural-changes",
            severity: "warning",
            type: "risky",
            description: `Structural change may affect layout: ${action.type}`,
            action,
            resolution:
              "Consider if this change is necessary or if CSS could achieve the same result",
            confidence: 0.7,
          },
        ];
      }
      return [];
    },
  },
  {
    id: "check-reversibility",
    name: "Check Action Reversibility",
    description: "Flag irreversible actions",
    severity: "warning",
    enabled: true,
    validate: (action, context) => {
      if (!action.reversible) {
        return [
          {
            id: "check-reversibility",
            severity: "warning",
            type: "risky",
            description: "Action is not reversible",
            action,
            resolution:
              "Consider creating a backup or finding a reversible alternative",
            confidence: 0.6,
          },
        ];
      }
      return [];
    },
  },
  {
    id: "check-complexity",
    name: "Check Sequence Complexity",
    description: "Flag overly complex sequences",
    severity: "warning",
    enabled: true,
    validate: (action, context) => {
      const actionCount = action.id.split("-").length;
      if (actionCount > 10) {
        return [
          {
            id: "check-complexity",
            severity: "warning",
            type: "slow",
            description: `Action is part of a complex sequence (${actionCount} actions)`,
            action,
            resolution:
              "Consider breaking into smaller, more manageable sequences",
            confidence: 0.7,
          },
        ];
      }
      return [];
    },
  },
];

// ============================================================================
// PLAN VALIDATOR
// ============================================================================

/**
 * Plan Validator
 *
 * Validates action plans before execution to ensure safety and feasibility.
 *
 * @example
 * ```typescript
 * const validator = new PlanValidator();
 *
 * const sequence = await generator.generate(delta, context);
 * const report = await validator.validate(sequence, context);
 *
 * if (report.valid) {
 *   // Execute plan
 * } else {
 *   // Handle issues
 *   console.log(report.issues);
 * }
 * ```
 */
export class PlanValidator {
  private config: ValidationConfig;
  private rules: ValidationRule[];

  constructor(
    config: Partial<ValidationConfig> = {},
    rules: ValidationRule[] = DEFAULT_VALIDATION_RULES
  ) {
    this.config = { ...DEFAULT_VALIDATION_CONFIG, ...config };
    this.rules = rules;
  }

  /**
   * Validate action sequence
   *
   * @param sequence - Action sequence to validate
   * @param context - Validation context
   * @returns Validation report
   */
  async validate(
    sequence: ActionSequence,
    context: ValidationContext = {}
  ): Promise<ValidationReport> {
    const startTime = Date.now();

    const issues: ValidationIssue[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    // Validate each action
    for (const action of sequence.actions) {
      // Apply validation rules
      for (const rule of this.rules) {
        if (rule.enabled) {
          const ruleIssues = rule.validate(action, context);
          issues.push(...ruleIssues);
        }
      }

      // Check confidence threshold
      if (action.confidence < this.config.minConfidence) {
        issues.push({
          id: "min-confidence",
          severity: "error",
          type: "uncertain",
          description: `Action confidence below threshold: ${action.confidence.toFixed(2)} < ${this.config.minConfidence}`,
          action,
          resolution: "Increase confidence or adjust threshold",
          confidence: 0.9,
        });
      }

      // Check reversibility
      if (this.config.requireReversible && !action.reversible) {
        issues.push({
          id: "reversible-required",
          severity: "error",
          type: "risky",
          description: "Action must be reversible",
          action,
          resolution:
            "Provide reverse action or disable reversibility requirement",
          confidence: 1.0,
        });
      }

      // Check element availability
      if (this.config.validateElements && context.availableElements) {
        const targetExists = context.availableElements.some(
          el =>
            action.target === el ||
            action.target.startsWith(el + " ") ||
            action.target.includes(" " + el)
        );

        if (
          !targetExists &&
          !action.target.startsWith("*") &&
          action.type !== "create"
        ) {
          issues.push({
            id: "element-not-found",
            severity: "error",
            type: "impossible",
            description: `Target element not found: ${action.target}`,
            action,
            resolution: "Verify target selector or create element first",
            confidence: 0.8,
          });
        }
      }

      // Check against platform constraints
      if (context.platformConstraints?.supportedCSS) {
        const unsupportedCSS = Object.keys(action.params)
          .filter(param => param.startsWith("css") || this.isCSSProperty(param))
          .filter(
            param => !context.platformConstraints!.supportedCSS!.includes(param)
          );

        if (unsupportedCSS.length > 0) {
          warnings.push({
            type: "best_practice",
            description: `CSS property may not be supported: ${unsupportedCSS.join(", ")}`,
            action,
            suggestion: "Check browser compatibility or use fallback",
          });
        }
      }
    }

    // Validate sequence-level properties
    if (sequence.totalEstimatedTime > this.config.maxEstimatedTime) {
      issues.push({
        id: "max-time",
        severity: "warning",
        type: "slow",
        description: `Estimated time exceeds limit: ${sequence.totalEstimatedTime}ms > ${this.config.maxEstimatedTime}ms`,
        resolution: "Optimize actions or increase time limit",
        confidence: 1.0,
      });
    }

    if (sequence.metadata.complexity > this.config.maxComplexity) {
      issues.push({
        id: "max-complexity",
        severity: "error",
        type: "risky",
        description: `Complexity exceeds limit: ${sequence.metadata.complexity.toFixed(2)} > ${this.config.maxComplexity}`,
        resolution: "Simplify plan or increase complexity limit",
        confidence: 0.9,
      });
    }

    // Check world model predictions if available
    if (this.config.useWorldModel && context.worldPredictions) {
      for (const [actionId, prediction] of context.worldPredictions) {
        // Check for dangerous side effects
        const dangerousEffects = prediction.sideEffects.filter(
          e => e.severity === "high" && e.probability > 0.7
        );

        if (dangerousEffects.length > 0) {
          issues.push({
            id: "dangerous-side-effect",
            severity: "error",
            type: "dangerous",
            description: `High-severity side effects predicted: ${dangerousEffects.map(e => e.description).join(", ")}`,
            action: prediction.action,
            resolution:
              "Consider alternative approach or mitigate side effects",
            confidence: 0.8,
          });
        }

        // Check for performance issues
        if (prediction.experienceImpact.performance > 0.7) {
          warnings.push({
            type: "performance",
            description: `Action may cause performance issues: ${prediction.action.type}`,
            action: prediction.action,
            suggestion: "Consider optimizing or breaking into smaller steps",
          });
        }
      }
    }

    // Generate suggestions
    suggestions.push(...this.generateSuggestions(sequence, issues, warnings));

    // Determine validity
    const criticalIssues = issues.filter(i => i.severity === "critical");
    const errorIssues = issues.filter(i => i.severity === "error");

    const valid =
      criticalIssues.length === 0 &&
      (this.config.strictMode ? errorIssues.length === 0 : true);

    // Calculate overall confidence
    const confidence = this.calculateValidationConfidence(issues, sequence);

    return {
      valid,
      confidence,
      issues,
      warnings,
      suggestions,
      metadata: {
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        actionCount: sequence.actions.length,
        issueCount: issues.length,
        warningCount: warnings.length,
      },
    };
  }

  /**
   * Validate batch of sequences
   *
   * @param sequences - Array of action sequences
   * @param context - Validation context
   * @returns Array of validation reports
   */
  async validateBatch(
    sequences: ActionSequence[],
    context: ValidationContext = {}
  ): Promise<ValidationReport[]> {
    return Promise.all(
      sequences.map(sequence => this.validate(sequence, context))
    );
  }

  /**
   * Generate suggestions for improvement
   */
  private generateSuggestions(
    sequence: ActionSequence,
    issues: ValidationIssue[],
    warnings: ValidationWarning[]
  ): string[] {
    const suggestions: string[] = [];

    // Suggest alternatives if issues found
    if (issues.length > 0) {
      if (sequence.alternatives.length > 0) {
        suggestions.push(
          `Consider ${sequence.alternatives.length} alternative approach(es) with fewer issues.`
        );
      }
    }

    // Suggest breaking into smaller sequences
    if (sequence.actions.length > 15) {
      suggestions.push(
        "Consider breaking this into smaller sequences for better reliability."
      );
    }

    // Suggest checking alternatives
    if (sequence.metadata.risk === "high") {
      suggestions.push(
        "High-risk plan: Consider creating a backup before executing."
      );
    }

    // Suggest CSS-only approach if structural changes
    const hasStructuralChanges = sequence.actions.some(
      a => a.type === "create" || a.type === "delete"
    );

    if (hasStructuralChanges) {
      suggestions.push(
        "Consider if CSS changes could achieve the same result without structural modifications."
      );
    }

    return suggestions;
  }

  /**
   * Check if property is CSS property
   */
  private isCSSProperty(prop: string): boolean {
    const cssProperties = [
      "display",
      "position",
      "top",
      "left",
      "right",
      "bottom",
      "width",
      "height",
      "margin",
      "padding",
      "border",
      "backgroundColor",
      "color",
      "fontSize",
      "fontWeight",
      "textAlign",
      "lineHeight",
      "flex",
      "grid",
    ];

    return cssProperties.includes(prop);
  }

  /**
   * Calculate validation confidence
   */
  private calculateValidationConfidence(
    issues: ValidationIssue[],
    sequence: ActionSequence
  ): number {
    let confidence = sequence.confidence;

    // Reduce confidence based on issues
    for (const issue of issues) {
      const reduction =
        issue.severity === "critical"
          ? 0.3
          : issue.severity === "error"
            ? 0.15
            : 0.05;

      confidence -= reduction * issue.confidence;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Add custom validation rule
   */
  addRule(rule: ValidationRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove validation rule
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
  }

  /**
   * Enable rule
   */
  enableRule(ruleId: string): void {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = true;
    }
  }

  /**
   * Disable rule
   */
  disableRule(ruleId: string): void {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = false;
    }
  }

  /**
   * Get configuration
   */
  getConfig(): ValidationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ValidationConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get rules
   */
  getRules(): ValidationRule[] {
    return [...this.rules];
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create plan validator with default config
 */
export function createPlanValidator(
  config?: Partial<ValidationConfig>,
  rules?: ValidationRule[]
): PlanValidator {
  return new PlanValidator(config, rules);
}

/**
 * Validate plan without instantiating
 */
export async function validatePlan(
  sequence: ActionSequence,
  context?: ValidationContext,
  config?: Partial<ValidationConfig>
): Promise<ValidationReport> {
  const validator = new PlanValidator(config);
  return validator.validate(sequence, context);
}

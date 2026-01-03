/**
 * @lsi/vljepa/planning/ActionSequenceGenerator - Zero-Shot Planning Component
 *
 * Converts embedding deltas into concrete action sequences for "vibe coding."
 * Transforms semantic changes into executable UI actions.
 *
 * Key Concepts:
 * - Semantic-to-Action Mapping: Convert embedding changes to actions
 * - Dependency Ordering: Order actions by prerequisites
 * - Confidence Estimation: Predict success probability for each action
 * - Alternative Generation: Generate multiple approaches when uncertain
 *
 * @version 1.0.0
 * @see https://arxiv.org/abs/2512.10942 - VL-JEPA Paper (Section on Zero-Shot Planning)
 */

import type {
  EmbeddingDelta,
  SemanticChange,
} from "./EmbeddingDeltaCalculator.js";
import type { VLJEPAAction } from "../protocol.js";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Planned Action - Concrete action to execute
 *
 * Represents a specific, executable action derived from semantic changes.
 */
export interface PlannedAction {
  /** Unique action ID */
  id: string;

  /** Action type */
  type:
    | "navigate"
    | "click"
    | "input"
    | "wait"
    | "modify"
    | "create"
    | "delete";

  /** Target (CSS selector, component path, or element ID) */
  target: string;

  /** Action parameters (property-value pairs) */
  params: Record<string, unknown>;

  /** Preconditions that must be true before executing */
  preconditions: string[];

  /** Postconditions that will be true after executing */
  postconditions: string[];

  /** Confidence in this action (0-1) */
  confidence: number;

  /** Estimated duration in milliseconds */
  estimatedDuration: number;

  /** Reasoning for this action */
  reasoning: string;

  /** Source semantic change */
  sourceChange?: SemanticChange;

  /** Dependencies (other action IDs that must complete first) */
  dependencies: string[];

  /** Whether this action is reversible */
  reversible: boolean;

  /** Reverse action (if reversible) */
  reverseAction?: PlannedAction;
}

/**
 * Action Sequence - Complete plan
 *
 * Represents a complete plan with ordered actions to achieve the goal.
 */
export interface ActionSequence {
  /** Protocol version */
  version: "1.0";

  /** Ordered list of actions */
  actions: PlannedAction[];

  /** Total estimated time (ms) */
  totalEstimatedTime: number;

  /** Overall confidence (0-1) */
  confidence: number;

  /** Human-readable explanation */
  reasoning: string;

  /** Alternative approaches */
  alternatives: ActionSequence[];

  /** Plan metadata */
  metadata: {
    /** Plan generation timestamp */
    timestamp: number;

    /** Number of actions */
    actionCount: number;

    /** Primary change type */
    primaryChangeType: string;

    /** Complexity score (0-1) */
    complexity: number;

    /** Risk level (low/medium/high) */
    risk: "low" | "medium" | "high";
  };
}

/**
 * Action Template - Reusable action pattern
 *
 * Templates for common actions based on semantic changes.
 */
export interface ActionTemplate {
  /** Template name */
  name: string;

  /** Applicable change types */
  applicableTypes: string[];

  /** Action type */
  actionType: PlannedAction["type"];

  /** Parameter template */
  paramTemplate: Record<string, unknown>;

  /** Default confidence */
  defaultConfidence: number;

  /** Default duration (ms) */
  defaultDuration: number;

  /** Generate function */
  generate: (
    change: SemanticChange,
    context: PlanningContext
  ) => PlannedAction[];
}

/**
 * Planning Context - Context for action generation
 *
 * Provides additional context for generating appropriate actions.
 */
export interface PlanningContext {
  /** Current UI structure */
  uiStructure?: string;

  /** Available elements */
  availableElements?: string[];

  /** Current focus */
  currentFocus?: string;

  /** User preferences */
  userPreferences?: {
    /** Prefer CSS changes over structural changes */
    preferCSS?: boolean;

    /** Prefer animations */
    preferAnimations?: boolean;

    /** Maximum actions allowed */
    maxActions?: number;
  };

  /** Platform constraints */
  platformConstraints?: {
    /** Supported CSS properties */
    supportedCSS?: string[];

    /** Supported component types */
    supportedComponents?: string[];

    /** Whether animations are supported */
    animationsSupported?: boolean;
  };
}

/**
 * Planning Configuration
 */
export interface PlanningConfig {
  /** Maximum actions per sequence */
  maxActions: number;

  /** Minimum confidence threshold */
  confidenceThreshold: number;

  /** Maximum planning time (ms) */
  timeLimit: number;

  /** Whether to explore alternatives */
  exploreAlternatives: boolean;

  /** Number of alternatives to generate */
  maxAlternatives: number;

  /** Whether to optimize for time */
  optimizeForTime: boolean;

  /** Whether to include reversible actions */
  includeReversibleActions: boolean;

  /** Risk tolerance (0-1) */
  riskTolerance: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default planning configuration
 */
export const DEFAULT_PLANNING_CONFIG: PlanningConfig = {
  maxActions: 20,
  confidenceThreshold: 0.5,
  timeLimit: 5000,
  exploreAlternatives: true,
  maxAlternatives: 3,
  optimizeForTime: false,
  includeReversibleActions: true,
  riskTolerance: 0.5,
};

// ============================================================================
// ACTION TEMPLATES
// ============================================================================

/**
 * Default action templates for common UI changes
 */
export const DEFAULT_ACTION_TEMPLATES: ActionTemplate[] = [
  // Layout changes
  {
    name: "center-flex",
    applicableTypes: ["layout"],
    actionType: "modify",
    paramTemplate: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    },
    defaultConfidence: 0.85,
    defaultDuration: 150,
    generate: (change, context) => [
      {
        id: `action-${Date.now()}-0`,
        type: "modify",
        target: change.element,
        params: {
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        },
        preconditions: ["element exists"],
        postconditions: ["element centered"],
        confidence: 0.85,
        estimatedDuration: 150,
        reasoning: `Center element using flexbox`,
        sourceChange: change,
        dependencies: [],
        reversible: true,
        reverseAction: undefined, // Will be populated
      },
    ],
  },
  {
    name: "increase-spacing",
    applicableTypes: ["layout"],
    actionType: "modify",
    paramTemplate: {
      padding: "2rem",
      gap: "1rem",
    },
    defaultConfidence: 0.8,
    defaultDuration: 100,
    generate: (change, context) => [
      {
        id: `action-${Date.now()}-1`,
        type: "modify",
        target: change.element,
        params: {
          padding: "2rem",
          gap: "1rem",
        },
        preconditions: ["element exists"],
        postconditions: ["spacing increased"],
        confidence: 0.8,
        estimatedDuration: 100,
        reasoning: `Increase spacing around element`,
        sourceChange: change,
        dependencies: [],
        reversible: true,
      },
    ],
  },

  // Style changes
  {
    name: "make-pop",
    applicableTypes: ["style"],
    actionType: "modify",
    paramTemplate: {
      backgroundColor: "#FF6B6B",
      color: "#FFFFFF",
      fontWeight: "bold",
      padding: "1rem 2rem",
      borderRadius: "8px",
      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
    },
    defaultConfidence: 0.9,
    defaultDuration: 150,
    generate: (change, context) => [
      {
        id: `action-${Date.now()}-2`,
        type: "modify",
        target: change.element,
        params: {
          backgroundColor: "#FF6B6B",
          color: "#FFFFFF",
          fontWeight: "bold",
          padding: "1rem 2rem",
          borderRadius: "8px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          transition: "all 0.3s ease",
        },
        preconditions: ["element exists"],
        postconditions: ["element stands out"],
        confidence: 0.9,
        estimatedDuration: 150,
        reasoning: `Apply bold, eye-catching styling to make element pop`,
        sourceChange: change,
        dependencies: [],
        reversible: true,
      },
    ],
  },
  {
    name: "dark-mode",
    applicableTypes: ["style"],
    actionType: "modify",
    paramTemplate: {
      backgroundColor: "#1A1A1A",
      color: "#E0E0E0",
    },
    defaultConfidence: 0.85,
    defaultDuration: 200,
    generate: (change, context) => [
      {
        id: `action-${Date.now()}-3`,
        type: "modify",
        target: "body",
        params: {
          backgroundColor: "#1A1A1A",
          color: "#E0E0E0",
        },
        preconditions: ["body exists"],
        postconditions: ["dark mode applied"],
        confidence: 0.85,
        estimatedDuration: 200,
        reasoning: `Apply dark mode theme`,
        sourceChange: change,
        dependencies: [],
        reversible: true,
      },
    ],
  },

  // Content changes
  {
    name: "update-text",
    applicableTypes: ["content"],
    actionType: "modify",
    paramTemplate: {
      textContent: "",
    },
    defaultConfidence: 0.75,
    defaultDuration: 100,
    generate: (change, context) => [
      {
        id: `action-${Date.now()}-4`,
        type: "modify",
        target: change.element,
        params: {
          textContent: change.description,
        },
        preconditions: ["element exists"],
        postconditions: ["text updated"],
        confidence: 0.75,
        estimatedDuration: 100,
        reasoning: `Update text content`,
        sourceChange: change,
        dependencies: [],
        reversible: false,
      },
    ],
  },

  // Structure changes
  {
    name: "create-container",
    applicableTypes: ["structure"],
    actionType: "create",
    paramTemplate: {
      tagName: "div",
      className: "container",
    },
    defaultConfidence: 0.7,
    defaultDuration: 300,
    generate: (change, context) => [
      {
        id: `action-${Date.now()}-5`,
        type: "create",
        target: "body",
        params: {
          tagName: "div",
          className: "container",
          attributes: {
            role: "container",
          },
        },
        preconditions: ["body exists"],
        postconditions: ["container created"],
        confidence: 0.7,
        estimatedDuration: 300,
        reasoning: `Create new container element`,
        sourceChange: change,
        dependencies: [],
        reversible: true,
      },
    ],
  },

  // Interaction changes
  {
    name: "add-hover-effect",
    applicableTypes: ["interaction"],
    actionType: "modify",
    paramTemplate: {
      transition: "transform 0.2s",
      cursor: "pointer",
    },
    defaultConfidence: 0.8,
    defaultDuration: 150,
    generate: (change, context) => [
      {
        id: `action-${Date.now()}-6`,
        type: "modify",
        target: change.element,
        params: {
          transition: "transform 0.2s, box-shadow 0.2s",
          cursor: "pointer",
        },
        preconditions: ["element exists"],
        postconditions: ["hover effect added"],
        confidence: 0.8,
        estimatedDuration: 150,
        reasoning: `Add interactive hover effect`,
        sourceChange: change,
        dependencies: [],
        reversible: true,
      },
    ],
  },
];

// ============================================================================
// ACTION SEQUENCE GENERATOR
// ============================================================================

/**
 * Action Sequence Generator
 *
 * Converts embedding deltas into concrete action sequences.
 *
 * @example
 * ```typescript
 * const generator = new ActionSequenceGenerator();
 *
 * const delta = await calculator.calculate(current, goal);
 * const sequence = await generator.generate(delta, context);
 *
 * console.log(sequence.actions); // [PlannedAction, ...]
 * console.log(sequence.confidence); // 0.85
 * ```
 */
export class ActionSequenceGenerator {
  private config: PlanningConfig;
  private templates: ActionTemplate[];
  private actionCounter: number;

  constructor(
    config: Partial<PlanningConfig> = {},
    templates: ActionTemplate[] = DEFAULT_ACTION_TEMPLATES
  ) {
    this.config = { ...DEFAULT_PLANNING_CONFIG, ...config };
    this.templates = templates;
    this.actionCounter = 0;
  }

  /**
   * Generate action sequence from embedding delta
   *
   * @param delta - Embedding delta from calculator
   * @param context - Planning context
   * @returns Action sequence with ordered actions
   */
  async generate(
    delta: EmbeddingDelta,
    context: PlanningContext = {}
  ): Promise<ActionSequence> {
    const startTime = Date.now();

    // Generate actions for each semantic change
    const actions = this.generateActions(delta, context);

    // Order actions by dependencies
    const orderedActions = this.orderActions(actions);

    // Calculate total time
    const totalEstimatedTime = orderedActions.reduce(
      (sum, action) => sum + action.estimatedDuration,
      0
    );

    // Calculate overall confidence
    const confidence = this.calculateSequenceConfidence(orderedActions);

    // Generate reasoning
    const reasoning = this.generateReasoning(delta, orderedActions);

    // Generate alternatives if enabled
    const alternatives = this.config.exploreAlternatives
      ? await this.generateAlternatives(delta, context)
      : [];

    // Determine risk level
    const risk = this.assessRisk(orderedActions, delta);

    // Determine primary change type
    const primaryChangeType =
      delta.semanticChanges.length > 0
        ? delta.semanticChanges[0].type
        : "unknown";

    return {
      version: "1.0",
      actions: orderedActions,
      totalEstimatedTime,
      confidence,
      reasoning,
      alternatives,
      metadata: {
        timestamp: Date.now(),
        actionCount: orderedActions.length,
        primaryChangeType,
        complexity: delta.complexity,
        risk,
      },
    };
  }

  /**
   * Generate batch of action sequences
   *
   * @param deltas - Array of embedding deltas
   * @param context - Planning context
   * @returns Array of action sequences
   */
  async generateBatch(
    deltas: EmbeddingDelta[],
    context: PlanningContext = {}
  ): Promise<ActionSequence[]> {
    return Promise.all(deltas.map(delta => this.generate(delta, context)));
  }

  /**
   * Generate actions from semantic changes
   */
  private generateActions(
    delta: EmbeddingDelta,
    context: PlanningContext
  ): PlannedAction[] {
    const actions: PlannedAction[] = [];

    for (const change of delta.semanticChanges) {
      // Find applicable templates
      const applicableTemplates = this.templates.filter(template =>
        template.applicableTypes.includes(change.type)
      );

      // Use best matching template
      if (applicableTemplates.length > 0) {
        const template = applicableTemplates[0];
        const generatedActions = template.generate(change, context);

        for (const action of generatedActions) {
          // Add reverse action if reversible
          if (this.config.includeReversibleActions && action.reversible) {
            action.reverseAction = this.createReverseAction(action);
          }

          actions.push(action);
        }
      } else {
        // Generate generic action if no template matches
        actions.push(this.createGenericAction(change, context));
      }
    }

    // Filter by confidence threshold
    return actions.filter(
      action => action.confidence >= this.config.confidenceThreshold
    );
  }

  /**
   * Create generic action when no template matches
   */
  private createGenericAction(
    change: SemanticChange,
    context: PlanningContext
  ): PlannedAction {
    this.actionCounter++;

    return {
      id: `generic-action-${this.actionCounter}`,
      type: "modify",
      target: change.element,
      params: {
        change: change.type,
        magnitude: change.magnitude,
      },
      preconditions: ["element exists"],
      postconditions: ["change applied"],
      confidence: change.confidence * 0.6, // Lower confidence for generic
      estimatedDuration: 200,
      reasoning: `Apply ${change.type} change to ${change.element}`,
      sourceChange: change,
      dependencies: [],
      reversible: false,
    };
  }

  /**
   * Create reverse action for undo capability
   */
  private createReverseAction(action: PlannedAction): PlannedAction {
    return {
      ...action,
      id: `reverse-${action.id}`,
      confidence: action.confidence * 0.9, // Slightly lower confidence
      reasoning: `Undo: ${action.reasoning}`,
      reverseAction: action, // Bidirectional reference
    };
  }

  /**
   * Order actions by dependencies
   */
  private orderActions(actions: PlannedAction[]): PlannedAction[] {
    // Topological sort based on dependencies
    const ordered: PlannedAction[] = [];
    const visited = new Set<string>();
    const actionMap = new Map(actions.map(a => [a.id, a]));

    const visit = (actionId: string) => {
      if (visited.has(actionId)) return;
      visited.add(actionId);

      const action = actionMap.get(actionId);
      if (!action) return;

      // Visit dependencies first
      for (const depId of action.dependencies) {
        visit(depId);
      }

      ordered.push(action);
    };

    for (const action of actions) {
      visit(action.id);
    }

    return ordered;
  }

  /**
   * Calculate overall sequence confidence
   */
  private calculateSequenceConfidence(actions: PlannedAction[]): number {
    if (actions.length === 0) return 0;

    // Multiply individual confidences (chain of operations)
    const product = actions.reduce(
      (prod, action) => prod * action.confidence,
      1
    );

    // Adjust for number of actions (more actions = lower confidence)
    const actionCountFactor = Math.max(0.5, 1 - actions.length * 0.05);

    return product * actionCountFactor;
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(
    delta: EmbeddingDelta,
    actions: PlannedAction[]
  ): string {
    const parts: string[] = [];

    // Overview
    parts.push(`Plan to achieve goal with ${actions.length} action(s).`);

    // Primary changes
    if (delta.semanticChanges.length > 0) {
      const primary = delta.semanticChanges[0];
      parts.push(`Primary change: ${primary.type} on ${primary.element}.`);
    }

    // Complexity
    if (delta.complexity > 0.7) {
      parts.push("This is a complex change requiring multiple steps.");
    } else if (delta.complexity > 0.3) {
      parts.push("This is a moderate change.");
    } else {
      parts.push("This is a straightforward change.");
    }

    // Estimated time
    const totalTime = actions.reduce((sum, a) => sum + a.estimatedDuration, 0);
    parts.push(`Estimated completion time: ${Math.round(totalTime / 1000)}s.`);

    return parts.join(" ");
  }

  /**
   * Assess risk level of action sequence
   */
  private assessRisk(
    actions: PlannedAction[],
    delta: EmbeddingDelta
  ): "low" | "medium" | "high" {
    let riskScore = 0;

    // Structural changes are higher risk
    for (const action of actions) {
      if (action.type === "delete" || action.type === "create") {
        riskScore += 0.3;
      } else if (action.type === "modify") {
        riskScore += 0.1;
      }
    }

    // Low confidence actions increase risk
    for (const action of actions) {
      if (action.confidence < 0.6) {
        riskScore += 0.2;
      }
    }

    // High complexity increases risk
    if (delta.complexity > 0.7) {
      riskScore += 0.2;
    }

    // Non-reversible actions increase risk
    for (const action of actions) {
      if (!action.reversible) {
        riskScore += 0.1;
      }
    }

    if (riskScore > 0.7) return "high";
    if (riskScore > 0.4) return "medium";
    return "low";
  }

  /**
   * Generate alternative action sequences
   */
  private async generateAlternatives(
    delta: EmbeddingDelta,
    context: PlanningContext
  ): Promise<ActionSequence[]> {
    const alternatives: ActionSequence[] = [];

    // Generate variations by:
    // 1. Different action orderings
    // 2. Different templates for same changes
    // 3. CSS-only vs structural changes

    // For now, generate one simple alternative
    const altContext = {
      ...context,
      userPreferences: { ...context.userPreferences, preferCSS: true },
    };

    try {
      const altSequence = await this.generate(delta, altContext);
      alternatives.push(altSequence);
    } catch {
      // Skip if alternative generation fails
    }

    return alternatives.slice(0, this.config.maxAlternatives);
  }

  /**
   * Get configuration
   */
  getConfig(): PlanningConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<PlanningConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Add action template
   */
  addTemplate(template: ActionTemplate): void {
    this.templates.push(template);
  }

  /**
   * Remove action template
   */
  removeTemplate(templateName: string): void {
    this.templates = this.templates.filter(t => t.name !== templateName);
  }

  /**
   * Get templates
   */
  getTemplates(): ActionTemplate[] {
    return [...this.templates];
  }

  /**
   * Reset action counter
   */
  resetCounter(): void {
    this.actionCounter = 0;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create action sequence generator with default config
 */
export function createActionSequenceGenerator(
  config?: Partial<PlanningConfig>,
  templates?: ActionTemplate[]
): ActionSequenceGenerator {
  return new ActionSequenceGenerator(config, templates);
}

/**
 * Generate action sequence without instantiating
 */
export async function generateActionSequence(
  delta: EmbeddingDelta,
  context?: PlanningContext,
  config?: Partial<PlanningConfig>
): Promise<ActionSequence> {
  const generator = new ActionSequenceGenerator(config);
  return generator.generate(delta, context);
}

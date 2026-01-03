/**
 * @lsi/vljepa/predictor/ActionGenerator - Generate Suggested Actions
 *
 * Generates actionable UI changes from VL-JEPA predictions.
 * Analyzes semantic delta between current and goal states to
 * produce specific actions.
 *
 * Action types:
 * - modify: Change properties of existing elements
 * - create: Add new elements
 * - delete: Remove elements
 * - move: Reposition elements
 * - resize: Change dimensions
 * - restyle: Change visual appearance
 *
 * @version 1.0.0
 */

import type { VLJEPAAction } from "../protocol.js";
import { euclideanDistance, cosineSimilarity } from "../index.js";

/**
 * Action generation strategy
 */
export type ActionStrategy =
  | "conservative" // Few actions, high confidence only
  | "balanced" // Moderate actions, medium+ confidence
  | "aggressive"; // Many actions, include lower confidence

/**
 * Semantic delta interpretation
 */
export interface SemanticDelta {
  /** Overall magnitude of change */
  magnitude: number;

  /** Direction of change (normalized vector) */
  direction: Float32Array;

  /** Dimensions with significant change */
  significantDimensions: number[];

  /** Change categories inferred from delta */
  categories: DeltaCategory[];
}

/**
 * Delta category (type of change inferred from semantic delta)
 */
export type DeltaCategory =
  | "layout" // Position, alignment, spacing changes
  | "visual" // Color, font, style changes
  | "content" // Text, content changes
  | "structure" // Add/remove elements
  | "interactive"; // Event handlers, behavior changes

/**
 * ActionGenerator configuration
 */
export interface ActionGeneratorConfig {
  /** Action generation strategy */
  strategy: ActionStrategy;

  /** Minimum confidence threshold for actions */
  minConfidence: number;

  /** Maximum number of actions to generate */
  maxActions: number;

  /** Threshold for considering delta dimension significant */
  deltaThreshold: number;

  /** Whether to group related actions */
  groupActions: boolean;

  /** Target selection strategy */
  targetSelection: "auto" | "manual" | "semantic";
}

/**
 * Action generation result
 */
export interface ActionResult {
  /** Generated actions */
  actions: VLJEPAAction[];

  /** Semantic delta analysis */
  delta: SemanticDelta;

  /** Number of actions by type */
  actionCounts: Record<string, number>;

  /** Overall action confidence */
  overallConfidence: number;
}

/**
 * Action Generator
 *
 * Converts VL-JEPA goal embeddings into actionable UI modifications.
 * Analyzes semantic differences between current and goal states.
 *
 * @example
 * ```typescript
 * const generator = new ActionGenerator({ strategy: "balanced" });
 * const result = generator.generate(contextEmbedding, goalEmbedding, 0.85);
 * console.log(result.actions);
 * // [{
 * //   type: "modify",
 * //   target: "#main-button",
 * //   params: { backgroundColor: "blue" },
 * //   confidence: 0.9
 * // }]
 * ```
 */
export class ActionGenerator {
  private config: ActionGeneratorConfig;

  // Dimension indices for semantic categories (heuristic)
  private readonly DIMENSION_RANGES: Record<DeltaCategory, [number, number]> = {
    layout: [0, 150], // Position, alignment
    visual: [150, 300], // Colors, styles
    content: [300, 450], // Text content
    structure: [450, 600], // DOM structure
    interactive: [600, 768], // Behavior, events
  };

  // CSS property mappings for each category
  private readonly PROPERTY_MAPPINGS: Record<DeltaCategory, string[]> = {
    layout: [
      "display",
      "position",
      "top",
      "left",
      "right",
      "bottom",
      "margin",
      "padding",
      "alignItems",
      "justifyContent",
      "flexDirection",
      "gridTemplateColumns",
    ],
    visual: [
      "backgroundColor",
      "color",
      "fontSize",
      "fontWeight",
      "fontFamily",
      "border",
      "borderRadius",
      "boxShadow",
      "opacity",
    ],
    content: [
      "textContent",
      "innerHTML",
      "innerText",
      "placeholder",
      "alt",
      "title",
    ],
    structure: [
      "innerHTML",
      "appendChild",
      "insertBefore",
      "removeChild",
      "className",
    ],
    interactive: [
      "onclick",
      "onhover",
      "onchange",
      "disabled",
      "readonly",
      "tabIndex",
    ],
  };

  constructor(config: Partial<ActionGeneratorConfig> = {}) {
    this.config = {
      strategy: "balanced",
      minConfidence: 0.5,
      maxActions: 10,
      deltaThreshold: 0.1,
      groupActions: true,
      targetSelection: "semantic",
      ...config,
    };
  }

  /**
   * Generate actions from prediction
   *
   * @param contextEmbedding - Current context embedding (768-dim)
   * @param goalEmbedding - Predicted goal embedding (768-dim)
   * @param confidence - Overall prediction confidence
   * @param contextInfo - Optional context info for target selection
   * @returns Action generation result
   */
  generate(
    contextEmbedding: Float32Array,
    goalEmbedding: Float32Array,
    confidence: number,
    contextInfo?: {
      /** Available UI elements (CSS selectors) */
      elements?: string[];
      /** Current page structure */
      structure?: string;
    }
  ): ActionResult {
    // Calculate semantic delta
    const delta = this.calculateDelta(contextEmbedding, goalEmbedding);

    // Generate actions based on delta
    const actions = this.generateActionsFromDelta(
      delta,
      confidence,
      contextInfo
    );

    // Filter by confidence threshold
    const filteredActions = this.filterByConfidence(actions);

    // Limit to max actions
    const limitedActions = this.limitActions(filteredActions);

    // Group related actions if configured
    const finalActions = this.config.groupActions
      ? this.groupRelatedActions(limitedActions)
      : limitedActions;

    // Calculate action counts
    const actionCounts = this.calculateActionCounts(finalActions);

    return {
      actions: finalActions,
      delta,
      actionCounts,
      overallConfidence: confidence,
    };
  }

  /**
   * Calculate semantic delta between embeddings
   *
   * @param context - Current context embedding
   * @param goal - Goal state embedding
   * @returns Semantic delta
   */
  private calculateDelta(
    context: Float32Array,
    goal: Float32Array
  ): SemanticDelta {
    const dim = context.length;
    const deltaVector = new Float32Array(dim);

    // Calculate element-wise difference
    let magnitude = 0;
    for (let i = 0; i < dim; i++) {
      deltaVector[i] = goal[i] - context[i];
      magnitude += deltaVector[i] * deltaVector[i];
    }
    magnitude = Math.sqrt(magnitude);

    // Normalize direction
    const direction = new Float32Array(dim);
    for (let i = 0; i < dim; i++) {
      direction[i] = magnitude > 0 ? deltaVector[i] / magnitude : 0;
    }

    // Find significant dimensions
    const significantDimensions: number[] = [];
    for (let i = 0; i < dim; i++) {
      if (Math.abs(deltaVector[i]) > this.config.deltaThreshold) {
        significantDimensions.push(i);
      }
    }

    // Infer change categories from significant dimensions
    const categories = this.inferCategories(significantDimensions);

    return {
      magnitude,
      direction,
      significantDimensions,
      categories,
    };
  }

  /**
   * Infer change categories from significant dimensions
   *
   * @param dimensions - Significant dimension indices
   * @returns Inferred categories
   */
  private inferCategories(dimensions: number[]): DeltaCategory[] {
    const categories: DeltaCategory[] = [];
    const categoryCounts: Record<DeltaCategory, number> = {
      layout: 0,
      visual: 0,
      content: 0,
      structure: 0,
      interactive: 0,
    };

    // Count dimensions in each category range
    for (const dim of dimensions) {
      for (const [category, [start, end]] of Object.entries(
        this.DIMENSION_RANGES
      )) {
        if (dim >= start && dim < end) {
          categoryCounts[category as DeltaCategory]++;
          break;
        }
      }
    }

    // Select categories with significant counts
    const threshold = dimensions.length * 0.15; // 15% of significant dims
    for (const [category, count] of Object.entries(categoryCounts)) {
      if (count >= threshold) {
        categories.push(category as DeltaCategory);
      }
    }

    // Default to layout if no categories identified
    if (categories.length === 0) {
      categories.push("layout");
    }

    return categories;
  }

  /**
   * Generate actions from semantic delta
   *
   * @param delta - Semantic delta
   * @param confidence - Overall confidence
   * @param contextInfo - Optional context info
   * @returns Generated actions
   */
  private generateActionsFromDelta(
    delta: SemanticDelta,
    confidence: number,
    contextInfo?: { elements?: string[]; structure?: string }
  ): VLJEPAAction[] {
    const actions: VLJEPAAction[] = [];

    // Generate actions for each category
    for (const category of delta.categories) {
      const categoryActions = this.generateActionsForCategory(
        category,
        delta,
        confidence,
        contextInfo
      );
      actions.push(...categoryActions);
    }

    return actions;
  }

  /**
   * Generate actions for a specific category
   *
   * @param category - Change category
   * @param delta - Semantic delta
   * @param confidence - Overall confidence
   * @param contextInfo - Optional context info
   * @returns Actions for this category
   */
  private generateActionsForCategory(
    category: DeltaCategory,
    delta: SemanticDelta,
    confidence: number,
    contextInfo?: { elements?: string[]; structure?: string }
  ): VLJEPAAction[] {
    const actions: VLJEPAAction[] = [];
    const targets = contextInfo?.elements || ["*"];

    // Select action type based on category and delta magnitude
    let actionType: VLJEPAAction["type"];
    switch (category) {
      case "layout":
        actionType = delta.magnitude > 0.5 ? "move" : "modify";
        break;
      case "visual":
        actionType = "restyle";
        break;
      case "content":
        actionType = "modify";
        break;
      case "structure":
        actionType = delta.magnitude > 0.7 ? "create" : "modify";
        break;
      case "interactive":
        actionType = "modify";
        break;
      default:
        actionType = "modify";
    }

    // Generate actions for targets
    for (const target of targets.slice(0, 3)) {
      // Determine action params based on category
      const params = this.generateParamsForCategory(category, delta);

      // Calculate action-specific confidence
      const actionConfidence = this.calculateActionConfidence(
        category,
        delta,
        confidence
      );

      actions.push({
        type: actionType,
        target: this.selectTarget(target, category),
        params,
        confidence: actionConfidence,
        reasoning: this.generateReasoning(category, delta, actionConfidence),
        expectedOutcome: this.generateExpectedOutcome(
          category,
          actionType,
          params
        ),
      });
    }

    return actions;
  }

  /**
   * Generate params for a category
   *
   * @param category - Change category
   * @param delta - Semantic delta
   * @returns Action params
   */
  private generateParamsForCategory(
    category: DeltaCategory,
    delta: SemanticDelta
  ): Record<string, unknown> {
    const properties = this.PROPERTY_MAPPINGS[category];
    const params: Record<string, unknown> = {};

    // Select a few representative properties
    const numProps = Math.min(3, properties.length);
    for (let i = 0; i < numProps; i++) {
      const prop =
        properties[
          Math.floor(delta.direction[i] * properties.length) % properties.length
        ];

      // Generate a plausible value based on delta direction
      params[prop] = this.generateValueForProperty(prop, delta);
    }

    return params;
  }

  /**
   * Generate a value for a CSS property
   *
   * @param property - Property name
   * @param delta - Semantic delta
   * @returns Generated value
   */
  private generateValueForProperty(
    property: string,
    delta: SemanticDelta
  ): unknown {
    const direction = delta.direction[0]; // Use first dimension as heuristic

    switch (property) {
      case "backgroundColor":
      case "color":
        return direction > 0 ? "#0066cc" : "#ffffff";
      case "fontSize":
        return direction > 0 ? "18px" : "14px";
      case "display":
        return direction > 0 ? "flex" : "block";
      case "alignItems":
        return direction > 0 ? "center" : "flex-start";
      case "justifyContent":
        return direction > 0 ? "center" : "space-between";
      case "margin":
      case "padding":
        return direction > 0 ? "16px" : "8px";
      case "fontWeight":
        return direction > 0 ? "bold" : "normal";
      default:
        return direction > 0 ? "modified" : "default";
    }
  }

  /**
   * Select target for action
   *
   * @param baseTarget - Base target selector
   * @param category - Change category
   * @returns Selected target
   */
  private selectTarget(baseTarget: string, category: DeltaCategory): string {
    if (baseTarget === "*") {
      // Generate semantic target based on category
      const targets: Record<DeltaCategory, string> = {
        layout: "#main-container",
        visual: ".highlighted-element",
        content: "h1, h2, h3",
        structure: ".wrapper",
        interactive: "button, .btn",
      };
      return targets[category];
    }
    return baseTarget;
  }

  /**
   * Calculate action-specific confidence
   *
   * @param category - Change category
   * @param delta - Semantic delta
   * @param baseConfidence - Base confidence
   * @returns Action confidence
   */
  private calculateActionConfidence(
    category: DeltaCategory,
    delta: SemanticDelta,
    baseConfidence: number
  ): number {
    // Adjust confidence based on delta magnitude
    // Large changes are less certain
    const magnitudeFactor = Math.max(0.5, 1 - delta.magnitude * 0.3);

    // Adjust based on category (layout more certain than structure)
    const categoryFactors: Record<DeltaCategory, number> = {
      layout: 1.0,
      visual: 0.95,
      content: 0.9,
      interactive: 0.85,
      structure: 0.8,
    };

    return (
      baseConfidence * magnitudeFactor * (categoryFactors[category] || 0.9)
    );
  }

  /**
   * Generate reasoning for action
   *
   * @param category - Change category
   * @param delta - Semantic delta
   * @param confidence - Action confidence
   * @returns Reasoning string
   */
  private generateReasoning(
    category: DeltaCategory,
    delta: SemanticDelta,
    confidence: number
  ): string {
    const reasoning: Record<DeltaCategory, string> = {
      layout: `Semantic delta indicates ${category} changes with magnitude ${delta.magnitude.toFixed(2)}`,
      visual: `Visual style adjustments needed based on goal state`,
      content: `Content modifications suggested by semantic analysis`,
      structure: `Structural changes inferred from delta pattern`,
      interactive: `Interactive behavior updates recommended`,
    };

    return reasoning[category];
  }

  /**
   * Generate expected outcome
   *
   * @param category - Change category
   * @param actionType - Action type
   * @param params - Action params
   * @returns Expected outcome
   */
  private generateExpectedOutcome(
    category: DeltaCategory,
    actionType: VLJEPAAction["type"],
    params: Record<string, unknown>
  ): VLJEPAAction["expectedOutcome"] {
    return {
      visualChange: `Update ${category} properties: ${Object.keys(params).join(", ")}`,
      functionalChange: `${actionType} operation to achieve goal state`,
    };
  }

  /**
   * Filter actions by confidence threshold
   *
   * @param actions - Actions to filter
   * @returns Filtered actions
   */
  private filterByConfidence(actions: VLJEPAAction[]): VLJEPAAction[] {
    return actions.filter(a => a.confidence >= this.config.minConfidence);
  }

  /**
   * Limit actions to max count
   *
   * @param actions - Actions to limit
   * @returns Limited actions
   */
  private limitActions(actions: VLJEPAAction[]): VLJEPAAction[] {
    // Sort by confidence and take top N
    return actions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxActions);
  }

  /**
   * Group related actions
   *
   * @param actions - Actions to group
   * @returns Grouped actions
   */
  private groupRelatedActions(actions: VLJEPAAction[]): VLJEPAAction[] {
    // Group actions by target
    const grouped: Record<string, VLJEPAAction> = {};

    for (const action of actions) {
      const key = `${action.target}-${action.type}`;

      if (grouped[key]) {
        // Merge params
        grouped[key].params = { ...grouped[key].params, ...action.params };
        // Use max confidence
        grouped[key].confidence = Math.max(
          grouped[key].confidence,
          action.confidence
        );
      } else {
        grouped[key] = { ...action };
      }
    }

    return Object.values(grouped);
  }

  /**
   * Calculate action counts by type
   *
   * @param actions - Actions to count
   * @returns Action counts
   */
  private calculateActionCounts(
    actions: VLJEPAAction[]
  ): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const action of actions) {
      counts[action.type] = (counts[action.type] || 0) + 1;
    }

    return counts;
  }

  /**
   * Batch generate actions
   *
   * @param contexts - Array of context embeddings
   * @param goals - Array of goal embeddings
   * @param confidences - Array of confidences
   * @param contextInfos - Optional context info for each
   * @returns Array of action results
   */
  generateBatch(
    contexts: Float32Array[],
    goals: Float32Array[],
    confidences: number[],
    contextInfos?: Array<
      { elements?: string[]; structure?: string } | undefined
    >
  ): ActionResult[] {
    if (
      contexts.length !== goals.length ||
      contexts.length !== confidences.length
    ) {
      throw new Error("Batch arrays must have the same length");
    }

    const results: ActionResult[] = [];

    for (let i = 0; i < contexts.length; i++) {
      const contextInfo = contextInfos?.[i];
      results.push(
        this.generate(contexts[i], goals[i], confidences[i], contextInfo)
      );
    }

    return results;
  }

  /**
   * Get configuration
   *
   * @returns Current configuration
   */
  getConfig(): ActionGeneratorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   *
   * @param config - New configuration values
   */
  updateConfig(config: Partial<ActionGeneratorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

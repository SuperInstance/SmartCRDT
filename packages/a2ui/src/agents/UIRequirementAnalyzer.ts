/**
 * UI Requirement Analyzer - Analyzes intent vectors to determine UI requirements
 *
 * This module analyzes encoded user intent vectors and determines what
 * UI components, layouts, and features are needed to satisfy the user's goals.
 */

import type { IntentVector } from "@lsi/privacy";
import type {
  A2UILayout,
  A2UIAction,
  UIRequirements,
  A2UIContext,
  A2UIResponse,
  ComponentCatalog,
} from "@lsi/protocol";

// ============================================================================
// TYPES
// ============================================================================

export interface UIRequirementAnalyzerConfig {
  catalog: ComponentCatalog;
  confidenceThreshold?: number;
  enableLearning?: boolean;
}

export interface RequirementWeights {
  informational: number;
  interactive: number;
  complexity: number;
  urgency: number;
  collaboration: number;
}

// ============================================================================
// UI REQUIREMENT ANALYZER
// ============================================================================

export class UIRequirementAnalyzer {
  private config: UIRequirementAnalyzerConfig;
  private requirementHistory: Map<string, RequirementAnalysis[]>;

  constructor(config: UIRequirementAnalyzerConfig) {
    this.config = config;
    this.requirementHistory = new Map();
  }

  /**
   * Analyze intent vector to determine UI requirements
   *
   * @param intent - Intent vector from encoder
   * @param context - Generation context
   * @returns Complete UI requirements
   */
  async analyze(
    intent: IntentVector,
    context: A2UIContext
  ): Promise<UIRequirements> {
    // Calculate requirement weights from intent
    const weights = this.calculateWeights(intent);

    // Determine required components
    const components = this.determineComponents(weights, intent, context);

    // Determine layout
    const layout = this.determineLayout(weights, intent, context);

    // Determine actions
    const actions = this.determineActions(weights, intent);

    // Determine data bindings
    const dataBindings = this.determineDataBindings(weights, intent);

    // Determine accessibility requirements
    const accessibility = this.determineAccessibility(intent, context);

    // Determine style requirements
    const style = this.determineStyle(intent, context);

    // Determine surface
    const surface = this.determineSurface(intent, context);

    // Calculate confidence
    const confidence = this.calculateConfidence(intent, weights);

    const requirements: UIRequirements = {
      components,
      layout,
      actions,
      dataBindings,
      accessibility,
      style,
    };

    // Store for learning
    if (context.userId) {
      this.storeAnalysis(context.userId, {
        intent,
        requirements,
        weights,
        confidence,
      });
    }

    return requirements;
  }

  /**
   * Get user's requirement history
   *
   * @param userId - User ID
   * @returns Analysis history
   */
  getUserHistory(userId: string): RequirementAnalysis[] {
    return this.requirementHistory.get(userId) || [];
  }

  /**
   * Clear requirement history
   */
  clearHistory(): void {
    this.requirementHistory.clear();
  }

  // ==========================================================================
  // PRIVATE METHODS - Weight Calculation
  // ==========================================================================

  private calculateWeights(intent: IntentVector): RequirementWeights {
    // Dimension groupings based on INTENT_DIMENSIONS from IntentToUIMapper
    const informational = this.averageActivation(
      intent,
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    );
    const interactive = this.averageActivation(
      intent,
      [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
    );
    const complexity = this.averageActivation(intent, [20, 21, 22, 23]);
    const urgency = intent[30] || 0;
    const collaboration = this.averageActivation(intent, [27, 28]);

    return { informational, interactive, complexity, urgency, collaboration };
  }

  private averageActivation(intent: IntentVector, indices: number[]): number {
    if (indices.length === 0) return 0;
    const sum = indices.reduce((acc, idx) => acc + (intent[idx] || 0), 0);
    return sum / indices.length;
  }

  // ==========================================================================
  // PRIVATE METHODS - Component Determination
  // ==========================================================================

  private determineComponents(
    weights: RequirementWeights,
    intent: IntentVector,
    context: A2UIContext
  ): string[] {
    const components: string[] = [];
    const threshold = 0.5;

    // Informational components
    if (weights.informational > threshold) {
      if (intent[1] > threshold) components.push("chart"); // data_visualization
      if (intent[4] > threshold) components.push("table"); // comparison
      if (intent[2] > threshold || intent[3] > threshold)
        components.push("text"); // detailed/summary view
      if (intent[5] > threshold) components.push("list"); // exploration
    }

    // Interactive components
    if (weights.interactive > threshold) {
      if (intent[16] > threshold) components.push("form"); // form_filling
      if (intent[10] > threshold) components.push("input"); // text_input
      if (intent[11] > threshold) components.push("input", "slider"); // numeric_input
      if (intent[12] > threshold) components.push("select"); // selection
      if (intent[13] > threshold) components.push("checkbox"); // multiselect
      if (intent[14] > threshold) components.push("date"); // date_input
    }

    // Action components
    if (intent[17] > threshold) components.push("button"); // quick_action
    if (weights.interactive > threshold && !components.includes("button")) {
      components.push("button");
    }

    // Progress indication
    if (intent[23] > threshold && intent[24] > threshold) {
      components.push("progress"); // multi_step + wizard
    }

    // Container
    if (components.length > 1 && !components.includes("container")) {
      components.unshift("container");
    }

    // Feedback components
    if (intent[34] > 0.7 || intent[31] > 0.7) {
      components.push("alert"); // frustration or patience
    }

    return components.length > 0 ? components : ["text", "button"];
  }

  // ==========================================================================
  // PRIVATE METHODS - Layout Determination
  // ==========================================================================

  private determineLayout(
    weights: RequirementWeights,
    intent: IntentVector,
    context: A2UIContext
  ): A2UILayout {
    const isMobile = context.device?.type === "mobile";
    const isTablet = context.device?.type === "tablet";

    // Urgent: compact, simple layout
    if (weights.urgency > 0.7) {
      return {
        type: "horizontal",
        spacing: 8,
        alignment: "center",
      };
    }

    // Complex: structured layout
    if (weights.complexity > 0.7) {
      if (isMobile) {
        return {
          type: "vertical",
          spacing: 16,
        };
      }
      return {
        type: "grid",
        columns: 2,
        spacing: 16,
        gap: 16,
      };
    }

    // Multi-step: vertical layout
    if (intent[23] > 0.5) {
      return {
        type: "vertical",
        spacing: 24,
      };
    }

    // Data-focused: flexible layout
    if (weights.informational > 0.6 && weights.interactive > 0.6) {
      return {
        type: "flex",
        direction: isMobile ? "column" : "row",
        spacing: 16,
        alignment: "start",
      };
    }

    // Default responsive layout
    return {
      type: "flex",
      direction: "row",
      spacing: 16,
      responsive:
        isMobile || isTablet
          ? {
              mobile: { type: "vertical", spacing: 8 },
              tablet: { type: "horizontal", spacing: 12 },
              desktop: { type: "flex", direction: "row", spacing: 16 },
            }
          : undefined,
    };
  }

  // ==========================================================================
  // PRIVATE METHODS - Action Determination
  // ==========================================================================

  private determineActions(
    weights: RequirementWeights,
    intent: IntentVector
  ): A2UIAction[] {
    const actions: A2UIAction[] = [];
    const threshold = 0.5;

    // Form actions
    if (intent[16] > threshold) {
      // form_filling
      actions.push(
        {
          id: "submit",
          type: "submit",
          handler: "handleSubmit",
          enabled: true,
        },
        { id: "cancel", type: "cancel", handler: "handleCancel", enabled: true }
      );
    }

    // Search action
    if (intent[7] > threshold) {
      // searching
      actions.push({
        id: "search",
        type: "search",
        handler: "handleSearch",
        enabled: true,
      });
    }

    // Filter action
    if (intent[8] > threshold) {
      // filtering
      actions.push({
        id: "filter",
        type: "filter",
        handler: "handleFilter",
        enabled: true,
      });
    }

    // Sort action
    if (intent[9] > threshold) {
      // sorting
      actions.push({
        id: "sort",
        type: "sort",
        handler: "handleSort",
        enabled: true,
      });
    }

    // Export action
    if (weights.informational > 0.6) {
      actions.push({
        id: "export",
        type: "export",
        handler: "handleExport",
        enabled: true,
      });
    }

    // Refresh action
    if (weights.collaboration > 0.5) {
      actions.push({
        id: "refresh",
        type: "refresh",
        handler: "handleRefresh",
        enabled: true,
      });
    }

    // Quick action
    if (intent[17] > threshold) {
      // quick_action
      actions.push({
        id: "quick-action",
        type: "custom",
        handler: "handleQuickAction",
        enabled: true,
      });
    }

    return actions;
  }

  // ==========================================================================
  // PRIVATE METHODS - Data Binding Determination
  // ==========================================================================

  private determineDataBindings(
    weights: RequirementWeights,
    intent: IntentVector
  ): Record<string, string> {
    const bindings: Record<string, string> = {};

    if (intent[1] > 0.5) {
      // data_visualization
      bindings["chart"] = "source:visualization-data";
    }

    if (intent[4] > 0.5) {
      // comparison
      bindings["table"] = "source:comparison-data";
    }

    if (intent[5] > 0.5) {
      // exploration
      bindings["list"] = "source:exploration-data";
    }

    if (weights.collaboration > 0.5) {
      bindings["shared"] = "source:collaborative-data";
    }

    return bindings;
  }

  // ==========================================================================
  // PRIVATE METHODS - Accessibility Determination
  // ==========================================================================

  private determineAccessibility(
    intent: IntentVector,
    context: A2UIContext
  ): UIRequirements["accessibility"] {
    // Check for fatigue or high cognitive load
    const fatigue = intent[39] || 0;
    const cognitiveLoad = intent[36] || 0;

    if (fatigue > 0.6 || cognitiveLoad > 0.6) {
      return {
        level: "AAA",
        screenReader: true,
        keyboardNav: true,
        highContrast: true,
      };
    }

    return {
      level: "AA",
      screenReader: true,
      keyboardNav: true,
      highContrast: false,
    };
  }

  // ==========================================================================
  // PRIVATE METHODS - Style Determination
  // ==========================================================================

  private determineStyle(
    intent: IntentVector,
    context: A2UIContext
  ): UIRequirements["style"] {
    return {
      theme: "light",
      primaryColor: "#3b82f6",
    };
  }

  // ==========================================================================
  // PRIVATE METHODS - Surface Determination
  // ==========================================================================

  private determineSurface(
    intent: IntentVector,
    context: A2UIContext
  ): A2UIResponse["surface"] {
    if (intent[24] > 0.7 && intent[23] > 0.5) {
      // wizard + multi_step
      return "main";
    }

    if (intent[17] > 0.7 && intent[30] > 0.5) {
      // quick_action + urgency
      return "modal";
    }

    if (intent[6] > 0.7) {
      // navigation
      return "sidebar";
    }

    return "main";
  }

  // ==========================================================================
  // PRIVATE METHODS - Confidence Calculation
  // ==========================================================================

  private calculateConfidence(
    intent: IntentVector,
    weights: RequirementWeights
  ): number {
    // Confidence based on:
    // 1. Strength of intent signal
    // 2. Clarity of requirements (not too mixed)
    // 3. Consistency with history

    const signalStrength =
      Object.values(weights).reduce((sum, w) => sum + w, 0) / 5;
    const maxActivation = Math.max(...intent);
    const variance = this.calculateVariance(intent);

    // Higher confidence with strong, clear signals
    return Math.min(
      signalStrength * 0.6 + maxActivation * 0.3 + (1 - variance) * 0.1,
      1
    );
  }

  private calculateVariance(intent: IntentVector): number {
    const mean = intent.reduce((sum, val) => sum + val, 0) / intent.length;
    const variance =
      intent.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      intent.length;
    return variance;
  }

  // ==========================================================================
  // PRIVATE METHODS - History Management
  // ==========================================================================

  private storeAnalysis(userId: string, analysis: RequirementAnalysis): void {
    const history = this.requirementHistory.get(userId) || [];
    history.push(analysis);
    // Keep last 100 entries
    if (history.length > 100) {
      history.shift();
    }
    this.requirementHistory.set(userId, history);
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface RequirementAnalysis {
  intent: IntentVector;
  requirements: UIRequirements;
  weights: RequirementWeights;
  confidence: number;
}

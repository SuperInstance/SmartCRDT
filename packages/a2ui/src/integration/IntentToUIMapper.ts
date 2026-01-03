/**
 * Intent to UI Mapper - Advanced mapping from intent vectors to UI specifications
 *
 * This module provides sophisticated mapping algorithms to convert user intent
 * vectors into detailed UI specifications, supporting adaptive interfaces that
 * respond to user needs and preferences.
 */

import type { IntentVector } from "@lsi/privacy";
import type {
  A2UIComponent,
  A2UILayout,
  A2UIAction,
  A2UIResponse,
  UIRequirements,
  A2UIContext,
  A2UIComponentType,
} from "@lsi/protocol";

// ============================================================================
// TYPES
// ============================================================================

export interface IntentDimension {
  index: number;
  name: string;
  weight: number;
  interpretation: string;
}

export interface IntentPattern {
  name: string;
  dimensions: number[][]; // Patterns of activated dimensions
  uiTemplate: Partial<UIRequirements>;
  confidence: number;
}

export interface MappingContext extends A2UIContext {
  history?: UIRequirementHistory[];
  userProfile?: UserProfile;
}

export interface UIRequirementHistory {
  timestamp: Date;
  intent: IntentVector;
  requirements: UIRequirements;
  userFeedback?: number; // 1-5 rating
}

export interface UserProfile {
  userId: string;
  preferences: UserPreference[];
  skillLevel: "beginner" | "intermediate" | "advanced";
  accessibilityNeeds: string[];
  frequentPatterns: string[];
}

export interface UserPreference {
  key: string;
  value: unknown;
  confidence: number;
  lastUpdated: Date;
}

// ============================================================================
// INTENT DIMENSIONS
// ============================================================================

/**
 * Standard intent dimensions for A2UI mapping
 *
 * These represent different aspects of user intent that can be
 * encoded in the intent vector. Each dimension corresponds to
 * specific UI needs and preferences.
 */
export const INTENT_DIMENSIONS: IntentDimension[] = [
  // Information seeking (0-9)
  {
    index: 0,
    name: "information_display",
    weight: 1.0,
    interpretation: "User wants to view information",
  },
  {
    index: 1,
    name: "data_visualization",
    weight: 0.9,
    interpretation: "User needs charts/graphs",
  },
  {
    index: 2,
    name: "detailed_view",
    weight: 0.8,
    interpretation: "User prefers detailed information",
  },
  {
    index: 3,
    name: "summary_view",
    weight: 0.7,
    interpretation: "User prefers summaries",
  },
  {
    index: 4,
    name: "comparison",
    weight: 0.8,
    interpretation: "User wants to compare items",
  },
  {
    index: 5,
    name: "exploration",
    weight: 0.7,
    interpretation: "User wants to explore data",
  },
  {
    index: 6,
    name: "navigation",
    weight: 0.6,
    interpretation: "User is navigating",
  },
  {
    index: 7,
    name: "searching",
    weight: 0.8,
    interpretation: "User is searching",
  },
  {
    index: 8,
    name: "filtering",
    weight: 0.7,
    interpretation: "User wants to filter results",
  },
  {
    index: 9,
    name: "sorting",
    weight: 0.6,
    interpretation: "User wants to sort data",
  },

  // Input and interaction (10-19)
  {
    index: 10,
    name: "text_input",
    weight: 1.0,
    interpretation: "User needs text input",
  },
  {
    index: 11,
    name: "numeric_input",
    weight: 0.9,
    interpretation: "User needs numeric input",
  },
  {
    index: 12,
    name: "selection",
    weight: 0.9,
    interpretation: "User needs to select options",
  },
  {
    index: 13,
    name: "multiselect",
    weight: 0.8,
    interpretation: "User needs multi-select",
  },
  {
    index: 14,
    name: "date_input",
    weight: 0.8,
    interpretation: "User needs date input",
  },
  {
    index: 15,
    name: "file_upload",
    weight: 0.7,
    interpretation: "User needs file upload",
  },
  {
    index: 16,
    name: "form_filling",
    weight: 0.9,
    interpretation: "User is filling a form",
  },
  {
    index: 17,
    name: "quick_action",
    weight: 0.8,
    interpretation: "User wants quick actions",
  },
  {
    index: 18,
    name: "drag_drop",
    weight: 0.6,
    interpretation: "User needs drag-and-drop",
  },
  {
    index: 19,
    name: "gesture_input",
    weight: 0.5,
    interpretation: "User prefers gestures",
  },

  // Task complexity (20-29)
  {
    index: 20,
    name: "simple_task",
    weight: 1.0,
    interpretation: "Task is simple",
  },
  {
    index: 21,
    name: "moderate_task",
    weight: 0.9,
    interpretation: "Task is moderately complex",
  },
  {
    index: 22,
    name: "complex_task",
    weight: 0.8,
    interpretation: "Task is complex",
  },
  {
    index: 23,
    name: "multi_step",
    weight: 0.9,
    interpretation: "Task has multiple steps",
  },
  {
    index: 24,
    name: "wizard_workflow",
    weight: 0.8,
    interpretation: "User needs guided workflow",
  },
  {
    index: 25,
    name: "parallel_tasks",
    weight: 0.7,
    interpretation: "User has parallel tasks",
  },
  {
    index: 26,
    name: "batch_operations",
    weight: 0.7,
    interpretation: "User needs batch operations",
  },
  {
    index: 27,
    name: "collaboration",
    weight: 0.6,
    interpretation: "User is collaborating",
  },
  {
    index: 28,
    name: "approval_needed",
    weight: 0.7,
    interpretation: "Task needs approval",
  },
  {
    index: 29,
    name: "automation",
    weight: 0.6,
    interpretation: "User wants automation",
  },

  // Emotional and cognitive state (30-39)
  {
    index: 30,
    name: "urgency",
    weight: 0.9,
    interpretation: "User is in a hurry",
  },
  {
    index: 31,
    name: "patience",
    weight: 0.8,
    interpretation: "User is patient",
  },
  {
    index: 32,
    name: "confidence",
    weight: 0.8,
    interpretation: "User is confident",
  },
  {
    index: 33,
    name: "confusion",
    weight: 0.7,
    interpretation: "User is confused",
  },
  {
    index: 34,
    name: "frustration",
    weight: 0.7,
    interpretation: "User is frustrated",
  },
  {
    index: 35,
    name: "satisfaction",
    weight: 0.6,
    interpretation: "User is satisfied",
  },
  {
    index: 36,
    name: "cognitive_load",
    weight: 0.8,
    interpretation: "User has high cognitive load",
  },
  { index: 37, name: "focus", weight: 0.7, interpretation: "User is focused" },
  {
    index: 38,
    name: "distraction",
    weight: 0.6,
    interpretation: "User is distracted",
  },
  { index: 39, name: "fatigue", weight: 0.6, interpretation: "User is tired" },
];

// ============================================================================
// INTENT PATTERNS
// ============================================================================

/**
 * Predefined patterns that map intent vectors to UI templates
 */
export const INTENT_PATTERNS: IntentPattern[] = [
  {
    name: "simple_query",
    dimensions: [
      [0, 7],
      [0.8, 0.7],
    ], // information_display + searching
    uiTemplate: {
      components: ["text", "input", "button", "list"],
      layout: { type: "vertical", spacing: 16 },
      actions: [{ id: "search", type: "search", handler: "handleSearch" }],
      dataBindings: {},
    },
    confidence: 0.9,
  },
  {
    name: "form_submission",
    dimensions: [
      [16, 10, 12],
      [0.9, 0.8, 0.7],
    ], // form_filling + text_input + selection
    uiTemplate: {
      components: ["form", "input", "select", "button"],
      layout: { type: "vertical", spacing: 16 },
      actions: [
        { id: "submit", type: "submit", handler: "handleSubmit" },
        { id: "cancel", type: "cancel", handler: "handleCancel" },
      ],
      dataBindings: {},
    },
    confidence: 0.95,
  },
  {
    name: "data_exploration",
    dimensions: [
      [1, 5, 4],
      [0.9, 0.8, 0.7],
    ], // data_visualization + exploration + comparison
    uiTemplate: {
      components: ["chart", "table", "select", "card"],
      layout: { type: "horizontal", spacing: 16 },
      actions: [
        { id: "filter", type: "filter", handler: "handleFilter" },
        { id: "export", type: "export", handler: "handleExport" },
      ],
      dataBindings: {},
    },
    confidence: 0.85,
  },
  {
    name: "quick_action",
    dimensions: [
      [17, 30, 20],
      [0.9, 0.7, 0.8],
    ], // quick_action + urgency + simple_task
    uiTemplate: {
      components: ["button", "alert"],
      layout: { type: "horizontal", spacing: 8 },
      actions: [{ id: "action", type: "custom", handler: "handleQuickAction" }],
      dataBindings: {},
    },
    confidence: 0.9,
  },
  {
    name: "wizard_workflow",
    dimensions: [
      [22, 23, 24],
      [0.9, 0.8, 0.8],
    ], // complex_task + multi_step + wizard_workflow
    uiTemplate: {
      components: ["container", "text", "button", "progress"],
      layout: { type: "vertical", spacing: 24 },
      actions: [
        { id: "next", type: "custom", handler: "handleNext" },
        { id: "back", type: "custom", handler: "handleBack" },
      ],
      dataBindings: {},
      style: { theme: "light" },
    },
    confidence: 0.85,
  },
];

// ============================================================================
// INTENT TO UI MAPPER
// ============================================================================

export class IntentToUIMapper {
  private patterns: IntentPattern[];
  private history: Map<string, UIRequirementHistory[]>;
  private profiles: Map<string, UserProfile>;

  constructor(customPatterns?: IntentPattern[]) {
    this.patterns = customPatterns || INTENT_PATTERNS;
    this.history = new Map();
    this.profiles = new Map();
  }

  /**
   * Map intent vector to UI requirements
   *
   * @param intent - Intent vector from encoder
   * @param context - Mapping context
   * @returns UI requirements
   */
  async mapToUIRequirements(
    intent: IntentVector,
    context: MappingContext
  ): Promise<UIRequirements> {
    // Try to match predefined patterns
    const patternMatch = this.matchPattern(intent);
    if (patternMatch) {
      return this.enrichPatternWithContext(patternMatch, context);
    }

    // No pattern match, generate requirements from intent analysis
    return this.generateRequirementsFromIntent(intent, context);
  }

  /**
   * Map intent vector to complete A2UI response
   *
   * @param intent - Intent vector
   * @param context - Mapping context
   * @param sessionId - Session ID
   * @returns Complete A2UI response
   */
  async mapToA2UIResponse(
    intent: IntentVector,
    context: MappingContext,
    sessionId: string
  ): Promise<A2UIResponse> {
    const requirements = await this.mapToUIRequirements(intent, context);

    // Build components from requirements
    const components = this.buildComponents(requirements);

    // Build actions
    const actions = this.buildActions(requirements);

    return {
      version: "0.8",
      surface: this.inferSurface(intent, context),
      components,
      layout: this.enhanceLayout(requirements.layout, context),
      data: requirements.dataBindings,
      actions,
      metadata: {
        timestamp: new Date(),
        sessionId,
        agentId: "intent-to-ui-mapper",
        generationTime: Date.now(),
        intentVector: intent,
        confidence: this.calculateConfidence(intent, requirements),
      },
    };
  }

  /**
   * Record user feedback for learning
   *
   * @param userId - User ID
   * @param intent - Original intent vector
   * @param requirements - Generated requirements
   * @param feedback - User feedback (1-5)
   */
  recordFeedback(
    userId: string,
    intent: IntentVector,
    requirements: UIRequirements,
    feedback: number
  ): void {
    const userHistory = this.history.get(userId) || [];
    userHistory.push({
      timestamp: new Date(),
      intent,
      requirements,
      userFeedback: feedback,
    });
    this.history.set(userId, userHistory);

    // Update user profile based on feedback
    this.updateUserProfile(userId, intent, requirements, feedback);
  }

  /**
   * Get personalized UI requirements for user
   *
   * @param userId - User ID
   * @param intent - Intent vector
   * @param context - Mapping context
   * @returns Personalized UI requirements
   */
  async getPersonalizedRequirements(
    userId: string,
    intent: IntentVector,
    context: MappingContext
  ): Promise<UIRequirements> {
    const baseRequirements = await this.mapToUIRequirements(intent, context);

    // Apply personalization from user profile
    const profile = this.profiles.get(userId);
    if (profile) {
      return this.applyPersonalization(baseRequirements, profile);
    }

    return baseRequirements;
  }

  // ==========================================================================
  // PRIVATE METHODS - Pattern Matching
  // ==========================================================================

  private matchPattern(intent: IntentVector): Partial<UIRequirements> | null {
    let bestMatch: IntentPattern | null = null;
    let bestScore = 0;

    for (const pattern of this.patterns) {
      const score = this.calculatePatternScore(intent, pattern);
      if (score > bestScore && score > 0.7) {
        bestMatch = pattern;
        bestScore = score;
      }
    }

    return bestMatch?.uiTemplate || null;
  }

  private calculatePatternScore(
    intent: IntentVector,
    pattern: IntentPattern
  ): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (let i = 0; i < pattern.dimensions[0].length; i++) {
      const dimIndex = pattern.dimensions[0][i];
      const expectedActivation = pattern.dimensions[1][i];
      const actualActivation = intent[dimIndex] || 0;
      const dimension = INTENT_DIMENSIONS.find(d => d.index === dimIndex);

      const weight = dimension?.weight || 1.0;
      const score = 1 - Math.abs(expectedActivation - actualActivation);

      totalScore += score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0
      ? (totalScore / totalWeight) * pattern.confidence
      : 0;
  }

  private enrichPatternWithContext(
    template: Partial<UIRequirements>,
    context: MappingContext
  ): UIRequirements {
    return {
      components: template.components || [],
      layout: template.layout || { type: "vertical", spacing: 16 },
      dataBindings: template.dataBindings || {},
      actions: template.actions || [],
      style: template.style,
      accessibility: template.accessibility || {
        level: "AA",
        screenReader: true,
        keyboardNav: true,
      },
    };
  }

  // ==========================================================================
  // PRIVATE METHODS - Intent Analysis
  // ==========================================================================

  private generateRequirementsFromIntent(
    intent: IntentVector,
    context: MappingContext
  ): UIRequirements {
    const components = this.inferComponents(intent, context);
    const layout = this.inferLayout(intent, context);
    const actions = this.inferActions(intent);
    const dataBindings = this.inferDataBindings(intent);

    return {
      components,
      layout,
      actions,
      dataBindings,
      style: this.inferStyle(intent, context),
      accessibility: this.inferAccessibility(intent, context),
    };
  }

  private inferComponents(
    intent: IntentVector,
    context: MappingContext
  ): string[] {
    const components: string[] = [];
    const thresholds = { high: 0.7, medium: 0.5, low: 0.3 };

    // Check each dimension for component needs
    for (const dimension of INTENT_DIMENSIONS) {
      const activation = intent[dimension.index] || 0;

      if (activation > thresholds.high) {
        const component = this.dimensionToComponent(dimension.name);
        if (component && !components.includes(component)) {
          components.push(component);
        }
      }
    }

    // Ensure minimum components
    if (components.length === 0) {
      components.push("container", "text");
    }

    return components;
  }

  private dimensionToComponent(dimensionName: string): string | null {
    const mapping: Record<string, string> = {
      information_display: "text",
      data_visualization: "chart",
      text_input: "input",
      selection: "select",
      multiselect: "checkbox",
      form_filling: "form",
      file_upload: "input",
      searching: "input",
      filtering: "select",
      comparison: "table",
      exploration: "list",
      collaboration: "card",
      simple_task: "button",
      multi_step: "progress",
    };

    return mapping[dimensionName] || null;
  }

  private inferLayout(
    intent: IntentVector,
    context: MappingContext
  ): A2UILayout {
    // Check task complexity
    const complexity = this.calculateTaskComplexity(intent);
    const urgency = intent[30] || 0; // urgency dimension

    if (urgency > 0.7) {
      // Urgent: simple, compact layout
      return { type: "horizontal", spacing: 8, alignment: "center" };
    }

    if (complexity > 0.7) {
      // Complex: structured layout
      return { type: "grid", columns: 2, spacing: 16 };
    }

    if (this.isMultiStep(intent)) {
      // Multi-step: vertical layout
      return { type: "vertical", spacing: 24 };
    }

    // Default: flexible layout
    return { type: "flex", direction: "row", spacing: 16 };
  }

  private inferActions(intent: IntentVector): A2UIAction[] {
    const actions: A2UIAction[] = [];

    if (intent[16] > 0.5) {
      // form_filling
      actions.push({ id: "submit", type: "submit", handler: "handleSubmit" });
      actions.push({ id: "cancel", type: "cancel", handler: "handleCancel" });
    }

    if (intent[7] > 0.5) {
      // searching
      actions.push({ id: "search", type: "search", handler: "handleSearch" });
    }

    if (intent[8] > 0.5) {
      // filtering
      actions.push({ id: "filter", type: "filter", handler: "handleFilter" });
    }

    if (intent[9] > 0.5) {
      // sorting
      actions.push({ id: "sort", type: "sort", handler: "handleSort" });
    }

    return actions;
  }

  private inferDataBindings(intent: IntentVector): Record<string, string> {
    const bindings: Record<string, string> = {};

    if (intent[1] > 0.5) {
      // data_visualization
      bindings["chart"] = "source:visualization-data";
    }

    if (intent[4] > 0.5) {
      // comparison
      bindings["table"] = "source:comparison-data";
    }

    return bindings;
  }

  private inferStyle(intent: IntentVector, context: MappingContext) {
    const fatigue = intent[39] || 0; // fatigue dimension
    const cognitiveLoad = intent[36] || 0; // cognitive_load

    if (fatigue > 0.6 || cognitiveLoad > 0.6) {
      // Simplified style for tired/stressed users
      return {
        theme: "light" as const,
        primaryColor: "#3b82f6",
        customCSS: {
          "--spacing": "8px",
          "--font-size": "14px",
        },
      };
    }

    return {
      theme: "light" as const,
      primaryColor: "#3b82f6",
    };
  }

  private inferAccessibility(intent: IntentVector, context: MappingContext) {
    return {
      level: "AA" as const,
      screenReader: true,
      keyboardNav: true,
      highContrast: false,
    };
  }

  private inferSurface(
    intent: IntentVector,
    context: MappingContext
  ): A2UIResponse["surface"] {
    if (intent[24] > 0.7) {
      // wizard_workflow
      return "main";
    }
    if (intent[17] > 0.7 && intent[30] > 0.5) {
      // quick_action + urgency
      return "modal";
    }
    return "main";
  }

  // ==========================================================================
  // PRIVATE METHODS - Component Building
  // ==========================================================================

  private buildComponents(requirements: UIRequirements): A2UIComponent[] {
    return requirements.components.map((type, index) => ({
      type: type as A2UIComponentType,
      id: `${type}-${index}`,
      props: this.getDefaultComponentProps(type),
      a11y: requirements.accessibility
        ? {
            level: requirements.accessibility.level,
          }
        : undefined,
    }));
  }

  private buildActions(requirements: UIRequirements): A2UIAction[] {
    return requirements.actions.map(action => ({
      ...action,
      enabled: true,
      loading: false,
    }));
  }

  private getDefaultComponentProps(type: string): Record<string, unknown> {
    const defaultProps: Record<string, Record<string, unknown>> = {
      text: { content: "" },
      input: { placeholder: "Enter value...", type: "text" },
      button: { label: "Button", variant: "primary" },
      select: { placeholder: "Select...", options: [] },
      checkbox: { label: "Option", checked: false },
      form: {},
      container: {},
      card: { variant: "default" },
      list: { items: [], variant: "bullet" },
      table: { columns: [], rows: [] },
      chart: { type: "line", data: [] },
      progress: { value: 0, max: 100 },
    };

    return defaultProps[type] || {};
  }

  // ==========================================================================
  // PRIVATE METHODS - Utility
  // ==========================================================================

  private enhanceLayout(
    layout: A2UILayout,
    context: MappingContext
  ): A2UILayout {
    // Add responsive breakpoints based on device
    if (context.device) {
      return {
        ...layout,
        responsive: {
          mobile: { type: "vertical", spacing: 8 },
          tablet: { type: layout.type, spacing: 12 },
          desktop: layout,
        },
      };
    }
    return layout;
  }

  private calculateTaskComplexity(intent: IntentVector): number {
    const taskDimensions = [20, 21, 22]; // simple, moderate, complex
    const weights = [0, 0.5, 1.0];

    let score = 0;
    let totalWeight = 0;

    for (let i = 0; i < taskDimensions.length; i++) {
      const activation = intent[taskDimensions[i]] || 0;
      score += activation * weights[i];
      totalWeight += activation;
    }

    return totalWeight > 0 ? score / totalWeight : 0;
  }

  private isMultiStep(intent: IntentVector): boolean {
    return (intent[23] || 0) > 0.5; // multi_step dimension
  }

  private calculateConfidence(
    intent: IntentVector,
    requirements: UIRequirements
  ): number {
    // Calculate confidence based on intent strength and requirement completeness
    const intentStrength =
      intent.reduce((sum, val) => sum + Math.abs(val), 0) / intent.length;
    const completeness = requirements.components.length > 0 ? 1 : 0;
    return intentStrength * 0.6 + completeness * 0.4;
  }

  private applyPersonalization(
    requirements: UIRequirements,
    profile: UserProfile
  ): UIRequirements {
    // Apply user preferences to requirements
    const personalized = { ...requirements };

    for (const pref of profile.preferences) {
      switch (pref.key) {
        case "spacing":
          if (personalized.layout && typeof pref.value === "number") {
            personalized.layout.spacing = pref.value;
          }
          break;
        case "theme":
          if (personalized.style) {
            personalized.style.theme = pref.value as any;
          }
          break;
      }
    }

    // Apply accessibility needs
    if (profile.accessibilityNeeds.length > 0) {
      personalized.accessibility = {
        ...personalized.accessibility,
        level: "AAA",
      };
    }

    return personalized;
  }

  private updateUserProfile(
    userId: string,
    intent: IntentVector,
    requirements: UIRequirements,
    feedback: number
  ): void {
    // Update profile based on feedback
    let profile = this.profiles.get(userId);
    if (!profile) {
      profile = {
        userId,
        preferences: [],
        skillLevel: "intermediate",
        accessibilityNeeds: [],
        frequentPatterns: [],
      };
    }

    // Adjust skill level based on feedback
    if (feedback >= 4) {
      profile.skillLevel = "advanced";
    } else if (feedback <= 2) {
      profile.skillLevel = "beginner";
    }

    this.profiles.set(userId, profile);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export function createIntentToUIMapper(
  customPatterns?: IntentPattern[]
): IntentToUIMapper {
  return new IntentToUIMapper(customPatterns);
}

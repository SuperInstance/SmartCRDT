/**
 * @fileoverview Personalization Engine - Generate personalized UI based on user preferences
 * @author Aequor Project - Round 18 Agent 1
 * @version 1.0.0
 */

import type { A2UIResponse, A2UIComponent, A2UILayout } from "@lsi/protocol";
import type {
  UserPreference,
  UIInteraction,
  LayoutDensity,
} from "./PreferenceCollector.js";
import type {
  PreferenceProfile,
  PersonalizationRecommendation,
} from "./PatternAnalyzer.js";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Personalization strategy
 */
export type PersonalizationStrategy =
  | "none"
  | "conservative"
  | "moderate"
  | "aggressive";

/**
 * Personalization context
 */
export interface PersonalizationContext {
  userId: string;
  sessionId: string;
  strategy: PersonalizationStrategy;
  timeOfDay: number;
  dayOfWeek: number;
  deviceType: "desktop" | "tablet" | "mobile";
  viewport: { width: number; height: number };
}

/**
 * UI variant for testing
 */
export interface UIVariant {
  id: string;
  name: string;
  ui: A2UIResponse;
  metadata: {
    strategy?: PersonalizationStrategy;
    description?: string;
    changes?: string[];
  };
}

/**
 * A/B test result
 */
export interface ABTestResult {
  variantId: string;
  impressions: number;
  engagements: number;
  completions: number;
  avgTimeOnPage: number; // seconds
  bounceRate: number; // 0-1
  satisfaction: number; // 0-1
  statisticalSignificance: number; // p-value
  isWinner: boolean;
}

/**
 * Personalization result
 */
export interface PersonalizationResult {
  original: A2UIResponse;
  personalized: A2UIResponse;
  changes: UIChange[];
  confidence: number; // 0-1
  applied: boolean;
}

/**
 * Individual UI change made during personalization
 */
export interface UIChange {
  type: "layout" | "component" | "style" | "reorder" | "remove" | "add";
  description: string;
  impact: "high" | "medium" | "low";
  before?: unknown;
  after?: unknown;
}

/**
 * Configuration for PersonalizationEngine
 */
export interface PersonalizationEngineConfig {
  defaultStrategy?: PersonalizationStrategy;
  minConfidenceForApply?: number;
  enableABTesting?: boolean;
  enableLearning?: boolean;
  maxChangesPerRequest?: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_ENGINE_CONFIG: Required<PersonalizationEngineConfig> = {
  defaultStrategy: "moderate",
  minConfidenceForApply: 0.6,
  enableABTesting: true,
  enableLearning: true,
  maxChangesPerRequest: 10,
};

// ============================================================================
// LAYOUT DENSITY MAPPINGS
// ============================================================================

const LAYOUT_DENSITY_SPACING: Record<
  LayoutDensity,
  {
    padding: number;
    gap: number;
    fontSize: number;
  }
> = {
  compact: { padding: 8, gap: 8, fontSize: 14 },
  comfortable: { padding: 16, gap: 16, fontSize: 16 },
  spacious: { padding: 24, gap: 24, fontSize: 18 },
};

// ============================================================================
// PERSONALIZATION ENGINE
// ============================================================================

/**
 * PersonalizationEngine - Generate personalized UI based on user preferences
 *
 * Takes a base UI and applies personalization based on learned user preferences.
 * Supports A/B testing of different personalization strategies.
 */
export class PersonalizationEngine {
  private config: Required<PersonalizationEngineConfig>;
  private abTestResults: Map<string, ABTestResult[]> = new Map();

  constructor(config?: PersonalizationEngineConfig) {
    this.config = {
      ...DEFAULT_ENGINE_CONFIG,
      ...config,
    };
  }

  /**
   * Personalize a UI response based on user preferences
   */
  async personalizeUI(
    baseUI: A2UIResponse,
    profile: PreferenceProfile,
    context: PersonalizationContext
  ): Promise<PersonalizationResult> {
    const changes: UIChange[] = [];
    let personalizedUI = JSON.parse(JSON.stringify(baseUI)) as A2UIResponse;
    const appliedChanges: UIChange[] = [];

    // Determine if we should apply personalization
    if (profile.confidence < this.config.minConfidenceForApply) {
      return {
        original: baseUI,
        personalized: baseUI,
        changes: [],
        confidence: profile.confidence,
        applied: false,
      };
    }

    // Apply layout personalization
    const layoutChanges = this.personalizeLayout(
      personalizedUI,
      profile,
      context
    );
    changes.push(...layoutChanges.changes);
    personalizedUI = layoutChanges.ui;
    appliedChanges.push(
      ...layoutChanges.changes.filter(
        c => c.impact === "high" || c.impact === "medium"
      )
    );

    // Apply component personalization
    const componentChanges = this.personalizeComponents(
      personalizedUI,
      profile,
      context
    );
    changes.push(...componentChanges.changes);
    personalizedUI = componentChanges.ui;
    appliedChanges.push(
      ...componentChanges.changes.filter(
        c => c.impact === "high" || c.impact === "medium"
      )
    );

    // Limit number of changes based on strategy
    const maxChanges = this.getMaxChangesForStrategy(context.strategy);
    const finalChanges = appliedChanges.slice(0, maxChanges);

    return {
      original: baseUI,
      personalized: personalizedUI,
      changes: finalChanges,
      confidence: profile.confidence,
      applied: true,
    };
  }

  /**
   * Create UI variants for A/B testing
   */
  createVariants(
    baseUI: A2UIResponse,
    profile: PreferenceProfile
  ): UIVariant[] {
    const variants: UIVariant[] = [
      {
        id: "control",
        name: "Original UI",
        ui: baseUI,
        metadata: {
          description: "No personalization applied",
        },
      },
    ];

    // Conservative variant
    const conservative = this.applyStrategy(baseUI, profile, "conservative");
    variants.push({
      id: "conservative",
      name: "Conservative Personalization",
      ui: conservative,
      metadata: {
        strategy: "conservative",
        description: "Minimal changes based on high-confidence preferences",
      },
    });

    // Moderate variant
    const moderate = this.applyStrategy(baseUI, profile, "moderate");
    variants.push({
      id: "moderate",
      name: "Moderate Personalization",
      ui: moderate,
      metadata: {
        strategy: "moderate",
        description: "Balanced personalization",
      },
    });

    // Aggressive variant (only if high confidence)
    if (profile.confidence > 0.8) {
      const aggressive = this.applyStrategy(baseUI, profile, "aggressive");
      variants.push({
        id: "aggressive",
        name: "Aggressive Personalization",
        ui: aggressive,
        metadata: {
          strategy: "aggressive",
          description: "Maximum personalization",
        },
      });
    }

    return variants;
  }

  /**
   * Run an A/B test and return results
   */
  async runABTest(
    variants: UIVariant[],
    context: PersonalizationContext,
    sampleSize: number = 100
  ): Promise<ABTestResult[]> {
    const results: ABTestResult[] = [];

    // Simulate A/B test (in production, this would collect real data)
    for (const variant of variants) {
      results.push({
        variantId: variant.id,
        impressions: sampleSize,
        engagements: Math.floor(sampleSize * (0.5 + Math.random() * 0.3)),
        completions: Math.floor(sampleSize * (0.3 + Math.random() * 0.4)),
        avgTimeOnPage: 30 + Math.random() * 120,
        bounceRate: 0.2 + Math.random() * 0.3,
        satisfaction: 0.6 + Math.random() * 0.3,
        statisticalSignificance: Math.random(), // p-value
        isWinner: false,
      });
    }

    // Determine winner based on engagement rate
    const sorted = results.sort(
      (a, b) => b.engagements / b.impressions - a.engagements / a.impressions
    );
    sorted[0].isWinner = true;
    sorted[0].statisticalSignificance = 0.05; // Significant

    // Cache results
    this.abTestResults.set(context.userId, results);

    return results;
  }

  /**
   * Get recommended variant for a user
   */
  getRecommendedVariant(
    variants: UIVariant[],
    profile: PreferenceProfile
  ): UIVariant {
    // If we have A/B test results, use the winner
    const results = this.abTestResults.get(profile.userId);
    if (results && results.length > 0) {
      const winner = results.find(r => r.isWinner);
      if (winner) {
        const variant = variants.find(v => v.id === winner?.variantId);
        if (variant) return variant;
      }
    }

    // Otherwise, recommend based on strategy
    const strategyMap: Record<PersonalizationStrategy, string> = {
      none: "control",
      conservative: "conservative",
      moderate: "moderate",
      aggressive: "aggressive",
    };

    const strategy = this.determineStrategy(profile);
    const variantId = strategyMap[strategy];
    return variants.find(v => v.id === variantId) || variants[0];
  }

  /**
   * Record user feedback on personalization
   */
  async recordFeedback(
    userId: string,
    variantId: string,
    feedback: "positive" | "negative" | "neutral"
  ): Promise<void> {
    // In production, this would update the learning model
    const results = this.abTestResults.get(userId);
    if (!results) return;

    const result = results.find(r => r.variantId === variantId);
    if (!result) return;

    // Update satisfaction score
    const feedbackValue =
      feedback === "positive" ? 0.1 : feedback === "negative" ? -0.1 : 0;
    result.satisfaction = Math.max(
      0,
      Math.min(1, result.satisfaction + feedbackValue)
    );
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Personalize layout based on preferences
   */
  private personalizeLayout(
    ui: A2UIResponse,
    profile: PreferenceProfile,
    context: PersonalizationContext
  ): { ui: A2UIResponse; changes: UIChange[] } {
    const changes: UIChange[] = [];
    const result = JSON.parse(JSON.stringify(ui)) as A2UIResponse;

    const layout = profile.layout;
    const spacing = LAYOUT_DENSITY_SPACING[layout.preferredDensity];

    // Apply spacing to layout
    if (result.layout) {
      const before = result.layout.gap;
      result.layout.gap = spacing.gap;

      changes.push({
        type: "layout",
        description: `Set layout gap to ${spacing.gap}px for ${layout.preferredDensity} density`,
        impact: layout.confidence > 0.7 ? "high" : "medium",
        before,
        after: spacing.gap,
      });

      // Apply padding
      if (result.layout.padding === undefined) {
        result.layout.padding = spacing.padding;
      }
    }

    return { ui: result, changes };
  }

  /**
   * Personalize components based on preferences
   */
  private personalizeComponents(
    ui: A2UIResponse,
    profile: PreferenceProfile,
    context: PersonalizationContext
  ): { ui: A2UIResponse; changes: UIChange[] } {
    const changes: UIChange[] = [];
    const result = JSON.parse(JSON.stringify(ui)) as A2UIResponse;

    if (!result.components || result.components.length === 0) {
      return { ui: result, changes };
    }

    // Reorder components based on preferences
    const reordered = this.reorderComponents(result.components, profile);
    if (reordered.changed) {
      changes.push({
        type: "reorder",
        description: "Reordered components based on usage patterns",
        impact: "medium",
      });
      result.components = reordered.components;
    }

    // Remove poorly performing components
    const filtered = this.filterComponents(result.components, profile);
    if (filtered.removed.length > 0) {
      changes.push({
        type: "remove",
        description: `Removed ${filtered.removed.length} low-performing components`,
        impact: "low",
      });
      result.components = filtered.components;
    }

    return { ui: result, changes };
  }

  /**
   * Reorder components based on user preferences
   */
  private reorderComponents(
    components: A2UIComponent[],
    profile: PreferenceProfile
  ): { components: A2UIComponent[]; changed: boolean } {
    // Create a priority map based on preferred components
    const priority = new Map<string, number>();
    profile.preferredComponents.forEach((type, index) => {
      priority.set(type, profile.preferredComponents.length - index);
    });

    // Sort components by priority
    const sorted = [...components].sort((a, b) => {
      const priorityA = priority.get(a.type) || 0;
      const priorityB = priority.get(b.type) || 0;
      return priorityB - priorityA;
    });

    // Check if order changed
    const changed = sorted.some((c, i) => c.id !== components[i]?.id);

    return { components: sorted, changed };
  }

  /**
   * Filter out low-performing components
   */
  private filterComponents(
    components: A2UIComponent[],
    profile: PreferenceProfile
  ): { components: A2UIComponent[]; removed: string[] } {
    const toRemove = new Set(profile.avoidedComponents);
    const removed: string[] = [];

    const filtered = components.filter(c => {
      if (toRemove.has(c.type)) {
        removed.push(c.id);
        return false;
      }
      return true;
    });

    return { components: filtered, removed };
  }

  /**
   * Apply personalization strategy
   */
  private applyStrategy(
    ui: A2UIResponse,
    profile: PreferenceProfile,
    strategy: PersonalizationStrategy
  ): A2UIResponse {
    const result = JSON.parse(JSON.stringify(ui)) as A2UIResponse;

    switch (strategy) {
      case "none":
        return ui;

      case "conservative":
        // Only apply high-confidence layout changes
        if (profile.layout.confidence > 0.8 && result.layout) {
          const spacing =
            LAYOUT_DENSITY_SPACING[profile.layout.preferredDensity];
          result.layout.gap = spacing.gap;
        }
        return result;

      case "moderate":
        // Apply layout changes and reorder components
        if (result.layout) {
          const spacing =
            LAYOUT_DENSITY_SPACING[profile.layout.preferredDensity];
          result.layout.gap = spacing.gap;
          result.layout.padding = spacing.padding;
        }
        if (result.components) {
          const { components } = this.reorderComponents(
            result.components,
            profile
          );
          result.components = components;
        }
        return result;

      case "aggressive":
        // Apply all personalization
        if (result.layout) {
          const spacing =
            LAYOUT_DENSITY_SPACING[profile.layout.preferredDensity];
          result.layout.gap = spacing.gap;
          result.layout.padding = spacing.padding;
        }
        if (result.components) {
          let { components } = this.reorderComponents(
            result.components,
            profile
          );
          const filtered = this.filterComponents(components, profile);
          result.components = filtered.components;
        }
        return result;
    }
  }

  /**
   * Determine personalization strategy from profile
   */
  private determineStrategy(
    profile: PreferenceProfile
  ): PersonalizationStrategy {
    if (profile.confidence < 0.5) {
      return "none";
    } else if (profile.confidence < 0.7) {
      return "conservative";
    } else if (profile.confidence < 0.85) {
      return "moderate";
    } else {
      return "aggressive";
    }
  }

  /**
   * Get max changes for strategy
   */
  private getMaxChangesForStrategy(strategy: PersonalizationStrategy): number {
    switch (strategy) {
      case "none":
        return 0;
      case "conservative":
        return 3;
      case "moderate":
        return 7;
      case "aggressive":
        return 15;
    }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a personalization engine with default configuration
 */
export function createPersonalizationEngine(
  config?: PersonalizationEngineConfig
): PersonalizationEngine {
  return new PersonalizationEngine(config);
}

/**
 * Create personalization context from request data
 */
export function createContext(
  userId: string,
  sessionId: string,
  deviceType: PersonalizationContext["deviceType"],
  viewport: { width: number; height: number },
  strategy?: PersonalizationStrategy
): PersonalizationContext {
  const now = new Date();
  return {
    userId,
    sessionId,
    strategy: strategy || "moderate",
    timeOfDay: now.getHours(),
    dayOfWeek: now.getDay(),
    deviceType,
    viewport,
  };
}

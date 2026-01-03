/**
 * Personalizer - Personalize UI based on user preferences and context
 */

import type {
  UserPreferences,
  PersonalizationRequest,
  PersonalizationResponse,
  PersonalizationChange,
  UIState,
  UIOption,
  UIContext,
} from "../types.js";
import { LayoutRecommender } from "../recommenders/LayoutRecommender.js";
import { StyleRecommender } from "../recommenders/StyleRecommender.js";
import { ComponentRecommender } from "../recommenders/ComponentRecommender.js";

export class Personalizer {
  private layoutRecommender: LayoutRecommender;
  private styleRecommender: StyleRecommender;
  private componentRecommender: ComponentRecommender;
  private preferences: Map<string, UserPreferences> = new Map();
  private personalizationHistory: Map<string, PersonalizationRecord[]> =
    new Map();

  constructor() {
    this.layoutRecommender = new LayoutRecommender();
    this.styleRecommender = new StyleRecommender();
    this.componentRecommender = new ComponentRecommender();
  }

  /**
   * Personalize UI for user
   */
  personalize(request: PersonalizationRequest): PersonalizationResponse {
    const { userId, context, currentState, availableOptions } = request;

    // Get or create user preferences
    let preferences = this.preferences.get(userId);
    if (!preferences) {
      preferences = this.createDefaultPreferences(userId);
      this.preferences.set(userId, preferences);
    }

    // Generate recommendations
    const changes: PersonalizationChange[] = [];
    const personalized = { ...currentState };

    // Layout personalization
    const layoutRec = this.layoutRecommender.recommend({
      userId,
      context,
      currentState,
      contentCount: 10,
      contentType: "mixed" as const,
    });

    if (layoutRec.layout !== currentState.layout) {
      changes.push({
        property: "layout",
        oldValue: currentState.layout,
        newValue: layoutRec.layout,
        confidence: layoutRec.confidence,
      });
      personalized.layout = layoutRec.layout;
    }

    // Theme personalization
    const styleRec = this.styleRecommender.recommend({
      userId,
      context,
      contentType: "mixed" as const,
    });

    if (styleRec.theme !== currentState.theme) {
      changes.push({
        property: "theme",
        oldValue: currentState.theme,
        newValue: styleRec.theme,
        confidence: styleRec.confidence,
      });
      personalized.theme = styleRec.theme;
    }

    // Style personalization
    const styleChanges = this.personalizeStyles(
      preferences,
      currentState,
      styleRec
    );
    changes.push(...styleChanges);

    // Apply style changes to state
    personalized.styles = {
      ...currentState.styles,
      primaryColor: styleRec.colors.primary,
      accentColor: styleRec.colors.accent,
      borderRadius: styleRec.effects.borderRadius,
      fontFamily: styleRec.typography.fontFamily,
    };

    // Component personalization
    const componentRecs = this.componentRecommender.recommend({
      userId,
      context,
      currentState: personalized,
      availableOptions: this.optionsToComponents(availableOptions),
      maxComponents: 10,
    });

    if (componentRecs.length > 0) {
      const recommendedComponents = componentRecs.map(r => r.component.id);

      changes.push({
        property: "components",
        oldValue: currentState.components,
        newValue: recommendedComponents,
        confidence:
          componentRecs.reduce((sum, r) => sum + r.confidence, 0) /
          componentRecs.length,
      });

      personalized.components = recommendedComponents;
    }

    // Calculate overall confidence
    const confidence = this.calculateOverallConfidence(changes, preferences);

    // Generate reason
    const reason = this.generatePersonalizationReason(changes, preferences);

    // Record personalization
    this.recordPersonalization(userId, personalized, changes, confidence);

    return {
      personalized,
      changes,
      confidence,
      reason,
    };
  }

  /**
   * Personalize styles
   */
  private personalizeStyles(
    preferences: UserPreferences,
    currentState: UIState,
    styleRec: ReturnType<StyleRecommender["recommend"]>
  ): PersonalizationChange[] {
    const changes: PersonalizationChange[] = [];

    const currentStyles = currentState.styles as Record<string, unknown>;

    // Primary color
    if (styleRec.colors.primary !== currentStyles.primaryColor) {
      changes.push({
        property: "primaryColor",
        oldValue: currentStyles.primaryColor,
        newValue: styleRec.colors.primary,
        confidence: styleRec.confidence,
      });
    }

    // Accent color
    if (styleRec.colors.accent !== currentStyles.accentColor) {
      changes.push({
        property: "accentColor",
        oldValue: currentStyles.accentColor,
        newValue: styleRec.colors.accent,
        confidence: styleRec.confidence,
      });
    }

    // Border radius
    if (styleRec.effects.borderRadius !== currentStyles.borderRadius) {
      changes.push({
        property: "borderRadius",
        oldValue: currentStyles.borderRadius,
        newValue: styleRec.effects.borderRadius,
        confidence: styleRec.confidence,
      });
    }

    // Font family
    if (styleRec.typography.fontFamily !== currentStyles.fontFamily) {
      changes.push({
        property: "fontFamily",
        oldValue: currentStyles.fontFamily,
        newValue: styleRec.typography.fontFamily,
        confidence: styleRec.confidence,
      });
    }

    return changes;
  }

  /**
   * Convert UI options to component definitions
   */
  private optionsToComponents(options: UIOption[]): Array<{
    id: string;
    type: string;
    name: string;
    category: any;
    tags: string[];
    properties: any;
    compatibility: string[];
    requirements: any[];
  }> {
    return options.map(opt => ({
      id: opt.type,
      type: opt.type,
      name: opt.type,
      category: "display" as const,
      tags: [],
      properties: {
        responsive: true,
        accessible: true,
        themeSupport: ["light", "dark"],
        customizability: 0.5,
      },
      compatibility: [],
      requirements: [],
    }));
  }

  /**
   * Create default preferences
   */
  private createDefaultPreferences(userId: string): UserPreferences {
    return {
      userId,
      layout: {
        preferred: "grid",
        density: "normal",
        alignment: "left",
        confidence: 0.5,
      },
      visual: {
        theme: "light",
        primaryColor: "#007bff",
        accentColor: "#28a745",
        borderRadius: 4,
        shadows: true,
        animations: true,
        confidence: 0.5,
      },
      typography: {
        fontFamily: "system-ui",
        fontSize: "medium",
        lineHeight: 1.5,
        letterSpacing: 0,
        fontWeight: 400,
        confidence: 0.5,
      },
      components: {
        preferred: [],
        avoided: [],
        customizations: {},
        confidence: 0.5,
      },
      navigation: {
        style: "sidebar",
        position: "left",
        sticky: true,
        collapsed: false,
        confidence: 0.5,
      },
      overallConfidence: 0.5,
      lastUpdated: Date.now(),
      version: 1,
    };
  }

  /**
   * Calculate overall confidence
   */
  private calculateOverallConfidence(
    changes: PersonalizationChange[],
    preferences: UserPreferences
  ): number {
    if (changes.length === 0) {
      return 0;
    }

    const avgChangeConfidence =
      changes.reduce((sum, c) => sum + c.confidence, 0) / changes.length;

    // Weight average change confidence with preference confidence
    return (avgChangeConfidence + preferences.overallConfidence) / 2;
  }

  /**
   * Generate personalization reason
   */
  private generatePersonalizationReason(
    changes: PersonalizationChange[],
    preferences: UserPreferences
  ): string {
    const reasons: string[] = [];

    for (const change of changes) {
      switch (change.property) {
        case "layout":
          reasons.push("layout optimized for your screen");
          break;
        case "theme":
          reasons.push("theme based on your preferences");
          break;
        case "primaryColor":
        case "accentColor":
          reasons.push("colors matching your taste");
          break;
        case "components":
          reasons.push("components you might like");
          break;
      }
    }

    if (reasons.length === 0) {
      return "Personalized based on your usage patterns";
    }

    return `UI personalized: ${reasons.join(", ")}`;
  }

  /**
   * Record personalization
   */
  private recordPersonalization(
    userId: string,
    personalized: UIState,
    changes: PersonalizationChange[],
    confidence: number
  ): void {
    const record: PersonalizationRecord = {
      userId,
      state: personalized,
      changes,
      confidence,
      timestamp: Date.now(),
    };

    if (!this.personalizationHistory.has(userId)) {
      this.personalizationHistory.set(userId, []);
    }

    const history = this.personalizationHistory.get(userId)!;
    history.push(record);

    // Keep only last 100 records
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }

  /**
   * Update user preferences
   */
  updatePreferences(preferences: UserPreferences): void {
    this.preferences.set(preferences.userId, preferences);
    this.layoutRecommender.updatePreferences(preferences);
    this.styleRecommender.updatePreferences(preferences);
    this.componentRecommender.updatePreferences(preferences);
  }

  /**
   * Get personalization history for user
   */
  getPersonalizationHistory(userId: string): PersonalizationRecord[] {
    return this.personalizationHistory.get(userId) ?? [];
  }

  /**
   * Get current preferences for user
   */
  getPreferences(userId: string): UserPreferences | undefined {
    return this.preferences.get(userId);
  }

  /**
   * Clear all data for user
   */
  clearUser(userId: string): void {
    this.preferences.delete(userId);
    this.personalizationHistory.delete(userId);
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.preferences.clear();
    this.personalizationHistory.clear();
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalUsers: number;
    totalPersonalizations: number;
    avgConfidence: number;
  } {
    let totalPersonalizations = 0;
    let totalConfidence = 0;

    for (const history of this.personalizationHistory.values()) {
      totalPersonalizations += history.length;
      for (const record of history) {
        totalConfidence += record.confidence;
      }
    }

    return {
      totalUsers: this.preferences.size,
      totalPersonalizations,
      avgConfidence:
        totalPersonalizations > 0 ? totalConfidence / totalPersonalizations : 0,
    };
  }
}

export interface PersonalizationRecord {
  userId: string;
  state: UIState;
  changes: PersonalizationChange[];
  confidence: number;
  timestamp: number;
}

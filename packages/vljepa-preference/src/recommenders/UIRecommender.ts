/**
 * UIRecommender - Main UI recommendation engine
 */

import type {
  UIRecommendation,
  RecommendationType,
  UserPreferences,
  RecommenderConfig,
  UIState,
  UIContext,
  RecommendedItem,
} from "../types.js";
import { HybridRecommender } from "../models/HybridRecommender.js";

export interface RecommendationRequest {
  userId: string;
  context: UIContext;
  currentState: UIState;
  goal?: "engagement" | "conversion" | "satisfaction" | "retention";
}

export class UIRecommender {
  private hybrid: HybridRecommender;
  private config: RecommenderConfig;
  private rules: Map<string, RecommendationRule[]> = new Map();

  constructor(config: Partial<RecommenderConfig> = {}) {
    this.config = {
      strategy: config.strategy ?? "hybrid",
      diversity: config.diversity ?? 0.3,
      novelty: config.novelty ?? 0.5,
      serendipity: config.serendipity ?? 0.2,
      maxRecommendations: config.maxRecommendations ?? 10,
    };

    this.hybrid = new HybridRecommender({}, this.config);
    this.initializeDefaultRules();
  }

  /**
   * Generate UI recommendations
   */
  recommend(request: RecommendationRequest): UIRecommendation[] {
    const recommendations: UIRecommendation[] = [];

    // Layout recommendation
    const layoutRec = this.recommendLayout(request);
    if (layoutRec) recommendations.push(layoutRec);

    // Component recommendation
    const componentRec = this.recommendComponents(request);
    if (componentRec) recommendations.push(componentRec);

    // Style recommendation
    const styleRec = this.recommendStyle(request);
    if (styleRec) recommendations.push(styleRec);

    // Content recommendation
    const contentRec = this.recommendContent(request);
    if (contentRec) recommendations.push(contentRec);

    return recommendations;
  }

  /**
   * Recommend layout
   */
  private recommendLayout(
    request: RecommendationRequest
  ): UIRecommendation | null {
    const { userId, context } = request;

    // Get user's layout preference
    // In real implementation, this would come from PreferenceModel
    const preferredLayout = this.inferLayoutPreference(userId);

    // Consider viewport size
    const viewportBased = this.inferLayoutFromViewport(context.viewport);

    // Combine preferences
    const finalLayout = this.combineLayoutRecommendations(
      preferredLayout,
      viewportBased
    );

    return {
      type: "layout",
      recommendation: finalLayout,
      confidence: 0.75,
      reason: `Based on your preferences and ${context.viewport.width}x${context.viewport.height} viewport`,
      expectedSatisfaction: 0.8,
    };
  }

  /**
   * Recommend components
   */
  private recommendComponents(
    request: RecommendationRequest
  ): UIRecommendation | null {
    const { userId } = request;

    // Get recommended components
    const components = this.hybrid.recommend(userId, 5, { excludeSeen: false });

    if (components.length === 0) {
      return null;
    }

    return {
      type: "component",
      recommendation: components.map(c => c.id),
      confidence:
        components.reduce((sum, c) => sum + c.confidence, 0) /
        components.length,
      reason: "Components you might find useful",
      expectedSatisfaction: 0.75,
    };
  }

  /**
   * Recommend style
   */
  private recommendStyle(
    request: RecommendationRequest
  ): UIRecommendation | null {
    const { userId, context } = request;

    // Infer style preference
    const theme = this.inferThemePreference(userId, context);

    const styleRec = {
      theme,
      primaryColor: "#007bff",
      accentColor: "#28a745",
      borderRadius: 4,
      shadows: true,
      animations: true,
    };

    return {
      type: "style",
      recommendation: styleRec,
      confidence: 0.7,
      reason: `Applying ${theme} theme based on your preferences`,
      expectedSatisfaction: 0.75,
    };
  }

  /**
   * Recommend content
   */
  private recommendContent(
    request: RecommendationRequest
  ): UIRecommendation | null {
    const { userId, context } = request;

    // Get personalized content recommendations
    const contentItems = this.hybrid.recommend(userId, 10);

    if (contentItems.length === 0) {
      return null;
    }

    // Filter by current page context
    const relevantContent = this.filterByContext(contentItems, context);

    return {
      type: "content",
      recommendation: relevantContent.map(c => ({
        id: c.id,
        type: c.type,
        priority: c.score,
      })),
      confidence: relevantContent.length > 0 ? 0.7 : 0.3,
      reason: "Content personalized for you",
      expectedSatisfaction: 0.8,
    };
  }

  /**
   * Infer layout preference
   */
  private inferLayoutPreference(userId: string): string {
    // In real implementation, get from PreferenceModel
    // For now, return sensible default
    return "grid";
  }

  /**
   * Infer layout from viewport
   */
  private inferLayoutFromViewport(viewport: {
    width: number;
    height: number;
  }): string {
    if (viewport.width < 768) {
      return "stacked"; // Mobile
    } else if (viewport.width < 1024) {
      return "list"; // Tablet
    } else {
      return "grid"; // Desktop
    }
  }

  /**
   * Combine layout recommendations
   */
  private combineLayoutRecommendations(
    userPref: string,
    viewportBased: string
  ): string {
    // If user preference matches viewport size, use it
    if (userPref === viewportBased) {
      return userPref;
    }

    // Otherwise, prioritize viewport for usability
    return viewportBased;
  }

  /**
   * Infer theme preference
   */
  private inferThemePreference(userId: string, context: UIContext): string {
    const hour = new Date(context.timestamp).getHours();

    // Dark mode at night
    if (hour >= 18 || hour <= 6) {
      return "dark";
    }

    // Light mode during day
    return "light";
  }

  /**
   * Filter recommendations by context
   */
  private filterByContext(
    items: RecommendedItem[],
    context: UIContext
  ): RecommendedItem[] {
    // In real implementation, filter by page, device, etc.
    return items;
  }

  /**
   * Add a custom recommendation rule
   */
  addRule(type: RecommendationType, rule: RecommendationRule): void {
    if (!this.rules.has(type)) {
      this.rules.set(type, []);
    }

    this.rules.get(type)!.push(rule);
  }

  /**
   * Initialize default recommendation rules
   */
  private initializeDefaultRules(): void {
    // Mobile rules
    this.addRule("layout", {
      condition: context => context.viewport.width < 768,
      recommendation: "stacked",
      priority: 10,
      reason: "Optimized for mobile",
    });

    // Tablet rules
    this.addRule("layout", {
      condition: context =>
        context.viewport.width >= 768 && context.viewport.width < 1024,
      recommendation: "list",
      priority: 9,
      reason: "Optimized for tablet",
    });

    // Desktop rules
    this.addRule("layout", {
      condition: context => context.viewport.width >= 1024,
      recommendation: "grid",
      priority: 8,
      reason: "Optimized for desktop",
    });
  }

  /**
   * Apply rules to recommendations
   */
  private applyRules(
    type: RecommendationType,
    request: RecommendationRequest
  ): string | null {
    const typeRules = this.rules.get(type);

    if (!typeRules || typeRules.length === 0) {
      return null;
    }

    // Sort by priority
    const sortedRules = [...typeRules].sort((a, b) => b.priority - a.priority);

    // Find first matching rule
    for (const rule of sortedRules) {
      if (rule.condition(request.context, request.currentState)) {
        return rule.recommendation as string;
      }
    }

    return null;
  }

  /**
   * Explain recommendations
   */
  explain(request: RecommendationRequest): Map<string, string> {
    const explanations = new Map<string, string>();
    const recommendations = this.recommend(request);

    for (const rec of recommendations) {
      explanations.set(rec.type, rec.reason);
    }

    return explanations;
  }

  /**
   * Get recommendation confidence
   */
  getConfidence(request: RecommendationRequest): number {
    const recommendations = this.recommend(request);

    if (recommendations.length === 0) {
      return 0;
    }

    return (
      recommendations.reduce((sum, rec) => sum + rec.confidence, 0) /
      recommendations.length
    );
  }

  /**
   * Set configuration
   */
  setConfig(config: Partial<RecommenderConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get configuration
   */
  getConfig(): RecommenderConfig {
    return { ...this.config };
  }
}

export interface RecommendationRule {
  condition: (context: UIContext, state: UIState) => boolean;
  recommendation: unknown;
  priority: number;
  reason: string;
}

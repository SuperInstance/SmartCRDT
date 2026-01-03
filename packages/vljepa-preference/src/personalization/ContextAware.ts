/**
 * ContextAware - Context-aware UI personalization
 */

import type {
  UIContext,
  UIState,
  UserPreferences,
  LayoutType,
  ThemeType,
} from "../types.js";

export interface ContextProfile {
  userId: string;
  contexts: Map<string, ContextData>;
  lastUpdated: number;
}

export interface ContextData {
  contextKey: string;
  state: UIState;
  visits: number;
  lastVisit: number;
  avgDuration: number;
  satisfaction: number;
}

export interface ContextRule {
  id: string;
  name: string;
  condition: (context: UIContext) => boolean;
  recommendation: Partial<UIState>;
  confidence: number;
}

export class ContextAwarePersonalization {
  private profiles: Map<string, ContextProfile> = new Map();
  private rules: ContextRule[] = [];
  private contextHistory: Map<string, ContextVisit[]> = new Map();

  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * Get context-aware recommendation
   */
  recommend(
    userId: string,
    context: UIContext,
    preferences: UserPreferences | undefined
  ): ContextRecommendation {
    // Get user's context profile
    const profile = this.getOrCreateProfile(userId);
    const contextKey = this.getContextKey(context);

    // Get existing context data or create new
    let contextData = profile.contexts.get(contextKey);
    if (!contextData) {
      contextData = {
        contextKey,
        state: this.createDefaultState(context, preferences),
        visits: 0,
        lastVisit: 0,
        avgDuration: 0,
        satisfaction: 0.5,
      };
      profile.contexts.set(contextKey, contextData);
    }

    // Apply context rules
    const stateChanges = this.applyContextRules(context);

    // Combine with existing state
    const recommendedState: UIState = {
      ...contextData.state,
      ...stateChanges,
    };

    // Calculate confidence
    const confidence = this.calculateConfidence(contextData, profile);

    // Generate explanation
    const explanation = this.generateExplanation(
      context,
      stateChanges,
      preferences
    );

    return {
      contextKey,
      state: recommendedState,
      confidence,
      explanation,
      previousVisits: contextData.visits,
      avgSatisfaction: contextData.satisfaction,
    };
  }

  /**
   * Record context visit
   */
  recordVisit(
    userId: string,
    context: UIContext,
    state: UIState,
    duration: number,
    satisfaction?: number
  ): void {
    const profile = this.getOrCreateProfile(userId);
    const contextKey = this.getContextKey(context);
    const contextData = profile.contexts.get(contextKey);

    if (contextData) {
      // Update existing context data
      contextData.visits++;
      contextData.lastVisit = Date.now();

      // Update average duration
      contextData.avgDuration =
        (contextData.avgDuration * (contextData.visits - 1) + duration) /
        contextData.visits;

      // Update satisfaction
      if (satisfaction !== undefined) {
        contextData.satisfaction =
          contextData.satisfaction * 0.8 + satisfaction * 0.2; // Weighted average
      }

      // Update state if user was satisfied
      if (satisfaction && satisfaction > 0.7) {
        contextData.state = state;
      }
    }

    // Record in history
    if (!this.contextHistory.has(userId)) {
      this.contextHistory.set(userId, []);
    }

    const history = this.contextHistory.get(userId)!;
    history.push({
      contextKey,
      timestamp: Date.now(),
      duration,
      satisfaction,
    });

    // Keep history manageable
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
  }

  /**
   * Get or create user profile
   */
  private getOrCreateProfile(userId: string): ContextProfile {
    let profile = this.profiles.get(userId);

    if (!profile) {
      profile = {
        userId,
        contexts: new Map(),
        lastUpdated: Date.now(),
      };
      this.profiles.set(userId, profile);
    }

    return profile;
  }

  /**
   * Get context key
   */
  private getContextKey(context: UIContext): string {
    const parts = [
      context.page,
      context.viewport.width.toString(),
      context.viewport.height.toString(),
      context.device ?? "unknown",
    ];

    return parts.join("|");
  }

  /**
   * Create default state for context
   */
  private createDefaultState(
    context: UIContext,
    preferences: UserPreferences | undefined
  ): UIState {
    // Infer layout from viewport
    let layout: LayoutType = "grid";
    if (context.viewport.width < 768) {
      layout = "stacked";
    } else if (context.viewport.width < 1024) {
      layout = "list";
    }

    // Infer theme from time
    const hour = new Date(context.timestamp).getHours();
    let theme: ThemeType = "light";
    if (hour >= 18 || hour <= 6) {
      theme = "dark";
    }

    return {
      layout,
      density: preferences?.layout.density ?? "normal",
      theme,
      components: [],
      styles: {
        primaryColor: preferences?.visual.primaryColor ?? "#007bff",
        accentColor: preferences?.visual.accentColor ?? "#28a745",
        borderRadius: preferences?.visual.borderRadius ?? 4,
        fontFamily: preferences?.typography.fontFamily ?? "system-ui",
      },
    };
  }

  /**
   * Apply context rules
   */
  private applyContextRules(context: UIContext): Partial<UIState> {
    const changes: Partial<UIState> = {};

    for (const rule of this.rules) {
      try {
        if (rule.condition(context)) {
          Object.assign(changes, rule.recommendation);
        }
      } catch (error) {
        console.error(`Error applying context rule ${rule.id}:`, error);
      }
    }

    return changes;
  }

  /**
   * Calculate confidence
   */
  private calculateConfidence(
    contextData: ContextData,
    profile: ContextProfile
  ): number {
    let confidence = 0.5; // Base confidence

    // More visits = higher confidence
    confidence += Math.min(contextData.visits / 20, 0.3);

    // Higher satisfaction = higher confidence
    confidence += contextData.satisfaction * 0.2;

    return Math.min(1, confidence);
  }

  /**
   * Generate explanation
   */
  private generateExplanation(
    context: UIContext,
    changes: Partial<UIState>,
    preferences: UserPreferences | undefined
  ): string {
    const reasons: string[] = [];

    // Context-based reasons
    if (context.viewport.width < 768) {
      reasons.push("optimized for mobile screen");
    } else if (context.viewport.width >= 1920) {
      reasons.push("optimized for large screen");
    }

    // Time-based
    const hour = new Date(context.timestamp).getHours();
    if (hour >= 18 || hour <= 6) {
      reasons.push("dark mode for nighttime");
    }

    // Preference-based
    if (preferences) {
      reasons.push("based on your preferences");
    }

    return reasons.length > 0
      ? `Context-aware: ${reasons.join(", ")}`
      : "Personalized for this context";
  }

  /**
   * Initialize default context rules
   */
  private initializeDefaultRules(): void {
    // Mobile context
    this.addRule({
      id: "context-mobile",
      name: "Mobile optimization",
      condition: context => context.viewport.width < 768,
      recommendation: {
        layout: "stacked",
        density: "normal",
      },
      confidence: 0.9,
    });

    // Tablet context
    this.addRule({
      id: "context-tablet",
      name: "Tablet optimization",
      condition: context =>
        context.viewport.width >= 768 && context.viewport.width < 1024,
      recommendation: {
        layout: "list",
        density: "normal",
      },
      confidence: 0.85,
    });

    // Desktop context
    this.addRule({
      id: "context-desktop",
      name: "Desktop optimization",
      condition: context => context.viewport.width >= 1024,
      recommendation: {
        layout: "grid",
        density: "normal",
      },
      confidence: 0.8,
    });

    // Nighttime context
    this.addRule({
      id: "context-night",
      name: "Night mode",
      condition: context => {
        const hour = new Date(context.timestamp).getHours();
        return hour >= 18 || hour <= 6;
      },
      recommendation: {
        theme: "dark",
      },
      confidence: 0.75,
    });

    // Landing page context
    this.addRule({
      id: "context-landing",
      name: "Landing page",
      condition: context => context.page === "/" || context.page === "/home",
      recommendation: {
        layout: "masonry",
        density: "spacious",
      },
      confidence: 0.7,
    });
  }

  /**
   * Add a context rule
   */
  addRule(rule: ContextRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove a context rule
   */
  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex(r => r.id === ruleId);
    if (index >= 0) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get context history for user
   */
  getContextHistory(userId: string): ContextVisit[] {
    return this.contextHistory.get(userId) ?? [];
  }

  /**
   * Get user profile
   */
  getProfile(userId: string): ContextProfile | undefined {
    return this.profiles.get(userId);
  }

  /**
   * Get most visited contexts for user
   */
  getMostVisitedContexts(
    userId: string,
    limit: number = 10
  ): Array<{
    contextKey: string;
    visits: number;
    avgDuration: number;
    satisfaction: number;
  }> {
    const profile = this.profiles.get(userId);
    if (!profile) return [];

    const contexts = Array.from(profile.contexts.values())
      .map(data => ({
        contextKey: data.contextKey,
        visits: data.visits,
        avgDuration: data.avgDuration,
        satisfaction: data.satisfaction,
      }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, limit);

    return contexts;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.profiles.clear();
    this.contextHistory.clear();
  }

  /**
   * Clear user data
   */
  clearUser(userId: string): void {
    this.profiles.delete(userId);
    this.contextHistory.delete(userId);
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalUsers: number;
    totalContexts: number;
    totalVisits: number;
    avgSatisfaction: number;
  } {
    let totalContexts = 0;
    let totalVisits = 0;
    let totalSatisfaction = 0;
    let satisfactionCount = 0;

    for (const profile of this.profiles.values()) {
      totalContexts += profile.contexts.size;

      for (const contextData of profile.contexts.values()) {
        totalVisits += contextData.visits;
        if (contextData.satisfaction > 0) {
          totalSatisfaction += contextData.satisfaction;
          satisfactionCount++;
        }
      }
    }

    return {
      totalUsers: this.profiles.size,
      totalContexts,
      totalVisits,
      avgSatisfaction:
        satisfactionCount > 0 ? totalSatisfaction / satisfactionCount : 0,
    };
  }
}

export interface ContextRecommendation {
  contextKey: string;
  state: UIState;
  confidence: number;
  explanation: string;
  previousVisits: number;
  avgSatisfaction: number;
}

export interface ContextVisit {
  contextKey: string;
  timestamp: number;
  duration: number;
  satisfaction?: number;
}

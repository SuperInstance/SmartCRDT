/**
 * ComponentRecommender - Recommend UI components based on user preferences
 */

import type {
  RecommendedItem,
  UserPreferences,
  UIContext,
  UIState,
} from "../types.js";

export interface ComponentDefinition {
  id: string;
  type: string;
  name: string;
  category:
    | "layout"
    | "navigation"
    | "input"
    | "display"
    | "feedback"
    | "media";
  tags: string[];
  properties: ComponentProperties;
  compatibility: string[]; // Compatible component types
  requirements: ComponentRequirement[];
}

export interface ComponentProperties {
  minWidth?: number;
  maxWidth?: number;
  responsive: boolean;
  accessible: boolean;
  themeSupport: string[];
  customizability: number; // 0-1
}

export interface ComponentRequirement {
  type: "screen_size" | "device" | "theme" | "permission";
  value: string | string[];
}

export interface ComponentRecommendationRequest {
  userId: string;
  context: UIContext;
  currentState: UIState;
  availableComponents: ComponentDefinition[];
  availableOptions?: import("../types.js").UIOption[];
  maxComponents?: number;
}

export interface ComponentRecommendation {
  component: ComponentDefinition;
  score: number;
  confidence: number;
  reason: string;
  placement?: ComponentPlacement;
}

export interface ComponentPlacement {
  position: "top" | "bottom" | "left" | "right" | "center" | "modal";
  order: number;
  container?: string;
}

export class ComponentRecommender {
  private components: Map<string, ComponentDefinition> = new Map();
  private userPreferences: Map<string, UserPreferences> = new Map();
  private componentUsage: Map<string, Map<string, number>> = new Map(); // userId -> componentId -> usage

  /**
   * Register a component
   */
  registerComponent(component: ComponentDefinition): void {
    this.components.set(component.id, component);
  }

  /**
   * Register multiple components
   */
  registerComponents(components: ComponentDefinition[]): void {
    for (const component of components) {
      this.registerComponent(component);
    }
  }

  /**
   * Update user preferences
   */
  updatePreferences(preferences: UserPreferences): void {
    this.userPreferences.set(preferences.userId, preferences);
  }

  /**
   * Record component usage
   */
  recordUsage(
    userId: string,
    componentId: string,
    interactionCount: number = 1
  ): void {
    if (!this.componentUsage.has(userId)) {
      this.componentUsage.set(userId, new Map());
    }

    const userUsage = this.componentUsage.get(userId)!;
    const current = userUsage.get(componentId) ?? 0;
    userUsage.set(componentId, current + interactionCount);
  }

  /**
   * Recommend components
   */
  recommend(
    request: ComponentRecommendationRequest
  ): ComponentRecommendation[] {
    const {
      userId,
      context,
      currentState,
      availableComponents,
      maxComponents = 5,
    } = request;

    const preferences = this.userPreferences.get(userId);
    const usage = this.componentUsage.get(userId) ?? new Map();

    // Score each component
    const scored: ComponentRecommendation[] = [];

    for (const component of availableComponents) {
      // Check requirements
      if (!this.meetsRequirements(component, context, currentState)) {
        continue;
      }

      // Calculate score
      const score = this.calculateComponentScore(
        component,
        preferences,
        usage,
        context
      );
      const confidence = this.calculateConfidence(
        component,
        preferences,
        usage
      );

      // Generate reason
      const reason = this.generateReason(component, preferences, usage);

      // Determine placement
      const placement = this.suggestPlacement(component, context, currentState);

      scored.push({
        component,
        score,
        confidence,
        reason,
        placement,
      });
    }

    // Sort by score and return top N
    return scored.sort((a, b) => b.score - a.score).slice(0, maxComponents);
  }

  /**
   * Check if component meets requirements
   */
  private meetsRequirements(
    component: ComponentDefinition,
    context: UIContext,
    state: UIState
  ): boolean {
    for (const requirement of component.requirements) {
      switch (requirement.type) {
        case "screen_size":
          const sizes = Array.isArray(requirement.value)
            ? requirement.value
            : [requirement.value];
          const currentSize = this.getScreenSizeCategory(context.viewport);
          if (!sizes.includes(currentSize)) {
            return false;
          }
          break;

        case "device":
          // Device type check
          break;

        case "theme":
          const themes = Array.isArray(requirement.value)
            ? requirement.value
            : [requirement.value];
          if (!themes.includes(state.theme)) {
            return false;
          }
          break;

        case "permission":
          // Permission check
          break;
      }
    }

    return true;
  }

  /**
   * Get screen size category
   */
  private getScreenSizeCategory(viewport: {
    width: number;
    height: number;
  }): string {
    if (viewport.width < 768) return "mobile";
    if (viewport.width < 1024) return "tablet";
    return "desktop";
  }

  /**
   * Calculate component score
   */
  private calculateComponentScore(
    component: ComponentDefinition,
    preferences: UserPreferences | undefined,
    usage: Map<string, number>,
    context: UIContext
  ): number {
    let score = 0;

    // Preference match (40%)
    if (preferences) {
      score += this.calculatePreferenceMatch(component, preferences) * 0.4;
    }

    // Usage history (30%)
    const componentUsage = usage.get(component.id) ?? 0;
    const usageScore = Math.min(componentUsage / 100, 1);
    score += usageScore * 0.3;

    // Context relevance (20%)
    score += this.calculateContextRelevance(component, context) * 0.2;

    // Component quality (10%)
    score += this.calculateQualityScore(component) * 0.1;

    return score;
  }

  /**
   * Calculate preference match
   */
  private calculatePreferenceMatch(
    component: ComponentDefinition,
    preferences: UserPreferences
  ): number {
    let match = 0;
    let total = 0;

    // Check if component type is preferred
    if (preferences.components.preferred.includes(component.type)) {
      match += 1;
    }
    total += 1;

    // Check if component type is avoided
    if (preferences.components.avoided.includes(component.type)) {
      match -= 0.5;
    }

    // Check theme compatibility
    if (component.properties.themeSupport.includes(preferences.visual.theme)) {
      match += 0.5;
    }
    total += 0.5;

    // Check density preference
    const isCompact = component.name.toLowerCase().includes("compact");
    if (isCompact && preferences.layout.density === "compact") {
      match += 0.3;
    } else if (!isCompact && preferences.layout.density === "spacious") {
      match += 0.3;
    }
    total += 0.3;

    return total > 0 ? Math.max(0, match / total) : 0;
  }

  /**
   * Calculate context relevance
   */
  private calculateContextRelevance(
    component: ComponentDefinition,
    context: UIContext
  ): number {
    let relevance = 0.5; // Base relevance

    // Check viewport compatibility
    if (
      component.properties.minWidth &&
      context.viewport.width < component.properties.minWidth
    ) {
      relevance -= 0.5;
    }

    if (
      component.properties.maxWidth &&
      context.viewport.width > component.properties.maxWidth
    ) {
      relevance -= 0.5;
    }

    // Responsive components get boost
    if (component.properties.responsive) {
      relevance += 0.2;
    }

    return Math.max(0, relevance);
  }

  /**
   * Calculate quality score
   */
  private calculateQualityScore(component: ComponentDefinition): number {
    let score = 0.5; // Base score

    // Accessible components get boost
    if (component.properties.accessible) {
      score += 0.2;
    }

    // Responsive components get boost
    if (component.properties.responsive) {
      score += 0.15;
    }

    // Customizable components get boost
    score += component.properties.customizability * 0.15;

    return Math.min(1, score);
  }

  /**
   * Calculate recommendation confidence
   */
  private calculateConfidence(
    component: ComponentDefinition,
    preferences: UserPreferences | undefined,
    usage: Map<string, number>
  ): number {
    let confidence = 0;

    // Have preferences?
    if (preferences) {
      confidence += 0.3;
    }

    // Have usage history?
    const componentUsage = usage.get(component.id) ?? 0;
    if (componentUsage > 0) {
      confidence += Math.min(componentUsage / 50, 0.4);
    }

    // Component is well-defined?
    if (component.tags.length > 0 && component.compatibility.length > 0) {
      confidence += 0.3;
    }

    return Math.min(1, confidence);
  }

  /**
   * Generate recommendation reason
   */
  private generateReason(
    component: ComponentDefinition,
    preferences: UserPreferences | undefined,
    usage: Map<string, number>
  ): string {
    const reasons: string[] = [];

    // Usage-based reasons
    const componentUsage = usage.get(component.id) ?? 0;
    if (componentUsage > 10) {
      reasons.push("you use this frequently");
    }

    // Preference-based reasons
    if (preferences) {
      if (preferences.components.preferred.includes(component.type)) {
        reasons.push(`you like ${component.type} components`);
      }

      if (
        component.properties.themeSupport.includes(preferences.visual.theme)
      ) {
        reasons.push("matches your theme preference");
      }
    }

    // Quality-based reasons
    if (component.properties.accessible) {
      reasons.push("accessible design");
    }

    if (component.properties.responsive) {
      reasons.push("responsive to your screen size");
    }

    return reasons.length > 0
      ? `Recommended because ${reasons.join(", ")}`
      : "Based on your usage patterns";
  }

  /**
   * Suggest component placement
   */
  private suggestPlacement(
    component: ComponentDefinition,
    context: UIContext,
    state: UIState
  ): ComponentPlacement {
    let position: ComponentPlacement["position"] = "center";
    let order = 0;

    // Determine position based on component category
    switch (component.category) {
      case "navigation":
        position = state.layout === "stacked" ? "top" : "left";
        order = 0;
        break;

      case "layout":
        position = "center";
        order = 1;
        break;

      case "input":
        position = "center";
        order = 2;
        break;

      case "display":
        position = "center";
        order = 3;
        break;

      case "feedback":
        position = "bottom";
        order = 4;
        break;

      case "media":
        position = "center";
        order = 5;
        break;
    }

    // Adjust for screen size
    if (context.viewport.width < 768) {
      // Mobile: everything stacked
      position = "top";
    }

    return { position, order };
  }

  /**
   * Find components by category
   */
  findByCategory(
    category: ComponentDefinition["category"]
  ): ComponentDefinition[] {
    const results: ComponentDefinition[] = [];

    for (const component of this.components.values()) {
      if (component.category === category) {
        results.push(component);
      }
    }

    return results;
  }

  /**
   * Find components by tag
   */
  findByTag(tag: string): ComponentDefinition[] {
    const results: ComponentDefinition[] = [];

    for (const component of this.components.values()) {
      if (component.tags.includes(tag)) {
        results.push(component);
      }
    }

    return results;
  }

  /**
   * Get compatible components
   */
  getCompatibleComponents(componentId: string): ComponentDefinition[] {
    const component = this.components.get(componentId);

    if (!component) {
      return [];
    }

    const compatible: ComponentDefinition[] = [];

    for (const [id, otherComponent] of this.components.entries()) {
      if (id === componentId) continue;

      // Check if other component is compatible
      for (const type of component.compatibility) {
        if (
          otherComponent.type === type ||
          otherComponent.tags.includes(type)
        ) {
          compatible.push(otherComponent);
          break;
        }
      }
    }

    return compatible;
  }

  /**
   * Get component by ID
   */
  getComponent(id: string): ComponentDefinition | undefined {
    return this.components.get(id);
  }

  /**
   * Get all components
   */
  getAllComponents(): ComponentDefinition[] {
    return Array.from(this.components.values());
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.components.clear();
    this.userPreferences.clear();
    this.componentUsage.clear();
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalComponents: number;
    totalUsers: number;
    avgUsagePerUser: number;
  } {
    let totalUsage = 0;

    for (const usage of this.componentUsage.values()) {
      for (const count of usage.values()) {
        totalUsage += count;
      }
    }

    return {
      totalComponents: this.components.size,
      totalUsers: this.componentUsage.size,
      avgUsagePerUser:
        this.componentUsage.size > 0
          ? totalUsage / this.componentUsage.size
          : 0,
    };
  }
}

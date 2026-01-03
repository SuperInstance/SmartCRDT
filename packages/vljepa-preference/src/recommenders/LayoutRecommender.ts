/**
 * LayoutRecommender - Recommend UI layouts based on user preferences and context
 */

import type {
  LayoutType,
  DensityType,
  AlignmentType,
  UserPreferences,
  UIContext,
  UIState,
} from "../types.js";

export interface LayoutRecommendationRequest {
  userId: string;
  context: UIContext;
  currentState: UIState;
  contentCount?: number;
  contentType?: "text" | "image" | "mixed" | "video" | "data";
}

export interface LayoutRecommendation {
  layout: LayoutType;
  density: DensityType;
  alignment: AlignmentType;
  columns?: number;
  spacing?: number;
  confidence: number;
  reason: string;
  alternatives?: LayoutAlternative[];
}

export interface LayoutAlternative {
  layout: LayoutType;
  density: DensityType;
  score: number;
  reason: string;
}

export class LayoutRecommender {
  private userPreferences: Map<string, UserPreferences> = new Map();
  private layoutPerformance: Map<string, Map<LayoutType, number>> = new Map(); // userId -> layout -> performance

  /**
   * Update user preferences
   */
  updatePreferences(preferences: UserPreferences): void {
    this.userPreferences.set(preferences.userId, preferences);
  }

  /**
   * Record layout performance
   */
  recordPerformance(
    userId: string,
    layout: LayoutType,
    performance: number
  ): void {
    if (!this.layoutPerformance.has(userId)) {
      this.layoutPerformance.set(userId, new Map());
    }

    this.layoutPerformance.get(userId)!.set(layout, performance);
  }

  /**
   * Recommend layout
   */
  recommend(request: LayoutRecommendationRequest): LayoutRecommendation {
    const {
      userId,
      context,
      currentState,
      contentCount = 10,
      contentType = "mixed",
    } = request;

    const preferences = this.userPreferences.get(userId);
    const performance = this.layoutPerformance.get(userId);

    // Calculate base recommendations
    const layoutRec = this.recommendLayoutType(
      userId,
      context,
      contentCount,
      contentType,
      preferences,
      performance
    );
    const densityRec = this.recommendDensity(
      userId,
      context,
      contentType,
      preferences
    );
    const alignmentRec = this.recommendAlignment(userId, context, preferences);
    const columnsRec = this.recommendColumns(
      context,
      contentCount,
      layoutRec.layout
    );
    const spacingRec = this.recommendSpacing(densityRec);

    // Calculate overall confidence
    const confidence = this.calculateConfidence(preferences, performance);

    // Generate alternatives
    const alternatives = this.generateAlternatives(
      layoutRec,
      context,
      contentCount
    );

    return {
      layout: layoutRec.layout,
      density: densityRec,
      alignment: alignmentRec,
      columns: columnsRec,
      spacing: spacingRec,
      confidence,
      reason: this.generateReason(
        layoutRec,
        densityRec,
        alignmentRec,
        context,
        preferences
      ),
      alternatives,
    };
  }

  /**
   * Recommend layout type
   */
  private recommendLayoutType(
    userId: string,
    context: UIContext,
    contentCount: number,
    contentType: string,
    preferences: UserPreferences | undefined,
    performance: Map<LayoutType, number> | undefined
  ): { layout: LayoutType; score: number } {
    const scores = new Map<LayoutType, number>();

    // Initialize scores
    scores.set("grid", 0.5);
    scores.set("list", 0.5);
    scores.set("stacked", 0.5);
    scores.set("masonry", 0.5);
    scores.set("tree", 0.5);

    // Content-based scoring
    if (contentType === "image" || contentType === "mixed") {
      scores.set("grid", (scores.get("grid") ?? 0) + 0.3);
      scores.set("masonry", (scores.get("masonry") ?? 0) + 0.2);
    }

    if (contentType === "text") {
      scores.set("list", (scores.get("list") ?? 0) + 0.4);
      scores.set("stacked", (scores.get("stacked") ?? 0) + 0.2);
    }

    if (contentType === "data" || contentType === "video") {
      scores.set("grid", (scores.get("grid") ?? 0) + 0.2);
      scores.set("list", (scores.get("list") ?? 0) + 0.3);
    }

    // Content count consideration
    if (contentCount > 20) {
      scores.set("grid", (scores.get("grid") ?? 0) + 0.2);
      scores.set("list", (scores.get("list") ?? 0) + 0.1);
    } else if (contentCount < 5) {
      scores.set("stacked", (scores.get("stacked") ?? 0) + 0.3);
    }

    // Viewport-based scoring
    const viewport = context.viewport;
    if (viewport.width < 768) {
      // Mobile
      scores.set("stacked", (scores.get("stacked") ?? 0) + 0.4);
      scores.set("list", (scores.get("list") ?? 0) + 0.2);
    } else if (viewport.width < 1024) {
      // Tablet
      scores.set("list", (scores.get("list") ?? 0) + 0.3);
      scores.set("grid", (scores.get("grid") ?? 0) + 0.2);
    } else {
      // Desktop
      scores.set("grid", (scores.get("grid") ?? 0) + 0.3);
      scores.set("masonry", (scores.get("masonry") ?? 0) + 0.1);
    }

    // User preference
    if (preferences) {
      const prefLayout = preferences.layout.preferred;
      scores.set(prefLayout, (scores.get(prefLayout) ?? 0) + 0.3);
    }

    // Performance-based adjustment
    if (performance) {
      for (const [layout, perf] of performance.entries()) {
        const currentScore = scores.get(layout) ?? 0.5;
        scores.set(layout, currentScore * (0.5 + perf));
      }
    }

    // Find best layout
    let bestLayout: LayoutType = "grid";
    let bestScore = 0;

    for (const [layout, score] of scores.entries()) {
      if (score > bestScore) {
        bestScore = score;
        bestLayout = layout;
      }
    }

    return { layout: bestLayout, score: bestScore };
  }

  /**
   * Recommend density
   */
  private recommendDensity(
    userId: string,
    context: UIContext,
    contentType: string,
    preferences: UserPreferences | undefined
  ): DensityType {
    let score = 0;
    let density: DensityType = "normal";

    // Content type influence
    if (contentType === "text") {
      // Text content benefits from spacious layouts
      score += 0.5;
      density = "spacious";
    } else if (contentType === "data" || contentType === "image") {
      // Data/images can be more compact
      score += 0.4;
      density = "compact";
    }

    // Viewport influence
    if (context.viewport.width < 768) {
      // Mobile: prefer normal density
      if (score < 0.5) {
        density = "normal";
        score = 0.5;
      }
    }

    // User preference
    if (preferences) {
      const prefDensity = preferences.layout.density;
      // Give strong weight to user preference
      density = prefDensity;
      score += 0.7;
    }

    return density;
  }

  /**
   * Recommend alignment
   */
  private recommendAlignment(
    userId: string,
    context: UIContext,
    preferences: UserPreferences | undefined
  ): AlignmentType {
    let alignment: AlignmentType = "left";

    // Viewport-based
    if (context.viewport.width < 768) {
      // Mobile: center is often better
      alignment = "center";
    } else if (context.viewport.width >= 1920) {
      // Large screens: center can look better
      alignment = "center";
    }

    // User preference override
    if (preferences) {
      alignment = preferences.layout.alignment;
    }

    return alignment;
  }

  /**
   * Recommend number of columns
   */
  private recommendColumns(
    context: UIContext,
    contentCount: number,
    layout: LayoutType
  ): number | undefined {
    if (layout === "list" || layout === "stacked" || layout === "tree") {
      return undefined; // These layouts don't use columns
    }

    const viewportWidth = context.viewport.width;

    // Base columns on viewport width
    if (viewportWidth < 768) {
      return 1; // Mobile: single column
    } else if (viewportWidth < 1024) {
      return 2; // Tablet: 2 columns
    } else if (viewportWidth < 1440) {
      return 3; // Desktop: 3 columns
    } else if (viewportWidth < 1920) {
      return 4; // Large desktop: 4 columns
    } else {
      return Math.min(6, Math.ceil(contentCount / 10)); // Very large: calculate based on content
    }
  }

  /**
   * Recommend spacing
   */
  private recommendSpacing(density: DensityType): number {
    switch (density) {
      case "compact":
        return 8; // 8px spacing
      case "normal":
        return 16; // 16px spacing
      case "spacious":
        return 24; // 24px spacing
    }
  }

  /**
   * Calculate confidence
   */
  private calculateConfidence(
    preferences: UserPreferences | undefined,
    performance: Map<LayoutType, number> | undefined
  ): number {
    let confidence = 0.5; // Base confidence

    // Have preferences?
    if (preferences) {
      confidence += 0.2 * preferences.layout.confidence;
    }

    // Have performance data?
    if (performance && performance.size > 0) {
      confidence += 0.3;
    }

    return Math.min(1, confidence);
  }

  /**
   * Generate alternatives
   */
  private generateAlternatives(
    layoutRec: { layout: LayoutType; score: number },
    context: UIContext,
    contentCount: number
  ): LayoutAlternative[] {
    const alternatives: LayoutAlternative[] = [];

    const layouts: LayoutType[] = ["grid", "list", "stacked", "masonry"];

    for (const layout of layouts) {
      if (layout === layoutRec.layout) continue;

      // Calculate score
      let score = 0.3; // Base score

      // Viewport suitability
      if (layout === "stacked" && context.viewport.width < 768) {
        score += 0.4;
      }

      if (layout === "grid" && contentCount > 10) {
        score += 0.3;
      }

      alternatives.push({
        layout,
        density: "normal",
        score,
        reason: `Alternative ${layout} layout`,
      });
    }

    return alternatives.sort((a, b) => b.score - a.score).slice(0, 3);
  }

  /**
   * Generate recommendation reason
   */
  private generateReason(
    layoutRec: { layout: LayoutType; score: number },
    densityRec: DensityType,
    alignmentRec: AlignmentType,
    context: UIContext,
    preferences: UserPreferences | undefined
  ): string {
    const reasons: string[] = [];

    // Layout reason
    reasons.push(`${layoutRec.layout} layout for optimal viewing`);

    // Density reason
    reasons.push(
      `${densityRec} density for ${densityRec === "spacious" ? "readability" : "efficiency"}`
    );

    // Viewport reason
    if (context.viewport.width < 768) {
      reasons.push("optimized for mobile");
    } else if (context.viewport.width >= 1920) {
      reasons.push("optimized for large screens");
    }

    // User preference
    if (preferences) {
      reasons.push("based on your preferences");
    }

    return reasons.join(", ");
  }

  /**
   * Get layout performance for user
   */
  getLayoutPerformance(userId: string): Map<LayoutType, number> | undefined {
    return this.layoutPerformance.get(userId);
  }

  /**
   * Get all user preferences
   */
  getAllPreferences(): Map<string, UserPreferences> {
    return this.userPreferences;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.userPreferences.clear();
    this.layoutPerformance.clear();
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalUsers: number;
    totalPerformanceRecords: number;
    avgPerformanceByLayout: Map<LayoutType, number>;
  } {
    let totalPerformanceRecords = 0;
    const layoutTotals = new Map<LayoutType, number>();
    const layoutCounts = new Map<LayoutType, number>();

    for (const performance of this.layoutPerformance.values()) {
      totalPerformanceRecords += performance.size;

      for (const [layout, score] of performance.entries()) {
        layoutTotals.set(layout, (layoutTotals.get(layout) ?? 0) + score);
        layoutCounts.set(layout, (layoutCounts.get(layout) ?? 0) + 1);
      }
    }

    const avgPerformanceByLayout = new Map<LayoutType, number>();

    for (const [layout, total] of layoutTotals.entries()) {
      const count = layoutCounts.get(layout) ?? 1;
      avgPerformanceByLayout.set(layout, total / count);
    }

    return {
      totalUsers: this.userPreferences.size,
      totalPerformanceRecords,
      avgPerformanceByLayout,
    };
  }
}

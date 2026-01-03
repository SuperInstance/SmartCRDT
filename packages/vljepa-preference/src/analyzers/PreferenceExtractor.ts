/**
 * PreferenceExtractor - Extracts user preferences from interactions
 */

import type {
  Interaction,
  UserPreferences,
  LayoutPreferences,
  VisualPreferences,
  TypographyPreferences,
  ComponentPreferences,
  NavigationPreferences,
  LayoutType,
  DensityType,
  AlignmentType,
  ThemeType,
  FontSizeType,
} from "../types.js";

export interface InteractionCounts {
  layout: Map<LayoutType, number>;
  density: Map<DensityType, number>;
  theme: Map<ThemeType, number>;
  alignment: Map<AlignmentType, number>;
  fontSize: Map<FontSizeType, number>;
  components: Map<string, number>;
  navigation: Map<string, number>;
  colors: Map<string, number>;
  fontFamily: Map<string, number>;
}

export class PreferenceExtractor {
  /**
   * Extract preferences from interactions
   */
  extractPreferences(
    userId: string,
    interactions: Interaction[],
    explicitPreferences?: Partial<UserPreferences>
  ): UserPreferences {
    const counts = this.countInteractions(interactions);

    const layout = this.extractLayoutPreferences(counts, interactions);
    const visual = this.extractVisualPreferences(counts, interactions);
    const typography = this.extractTypographyPreferences(counts, interactions);
    const components = this.extractComponentPreferences(counts, interactions);
    const navigation = this.extractNavigationPreferences(counts, interactions);

    // Calculate overall confidence
    const confidences = [
      layout.confidence,
      visual.confidence,
      typography.confidence,
      components.confidence,
      navigation.confidence,
    ];
    const overallConfidence =
      confidences.reduce((a, b) => a + b, 0) / confidences.length;

    // Merge with explicit preferences if provided
    const preferences: UserPreferences = {
      userId,
      layout: explicitPreferences?.layout ?? layout,
      visual: explicitPreferences?.visual ?? visual,
      typography: explicitPreferences?.typography ?? typography,
      components: explicitPreferences?.components ?? components,
      navigation: explicitPreferences?.navigation ?? navigation,
      overallConfidence,
      lastUpdated: Date.now(),
      version: 1,
    };

    return preferences;
  }

  /**
   * Count interaction types
   */
  private countInteractions(interactions: Interaction[]): InteractionCounts {
    const counts: InteractionCounts = {
      layout: new Map(),
      density: new Map(),
      theme: new Map(),
      alignment: new Map(),
      fontSize: new Map(),
      components: new Map(),
      navigation: new Map(),
      colors: new Map(),
      fontFamily: new Map(),
    };

    for (const interaction of interactions) {
      // Count by element type (indicating component preferences)
      const componentType = interaction.element.type;
      counts.components.set(
        componentType,
        (counts.components.get(componentType) ?? 0) + 1
      );

      // Count by page (indicating navigation preferences)
      const page = interaction.context.page;
      counts.navigation.set(page, (counts.navigation.get(page) ?? 0) + 1);

      // Count colors from element attributes
      if (interaction.element.attributes) {
        const color = interaction.element.attributes["color"] as string;
        if (color) {
          counts.colors.set(color, (counts.colors.get(color) ?? 0) + 1);
        }
      }
    }

    return counts;
  }

  /**
   * Extract layout preferences
   */
  private extractLayoutPreferences(
    counts: InteractionCounts,
    interactions: Interaction[]
  ): LayoutPreferences {
    // Infer layout type from interaction patterns
    const layoutScores = new Map<LayoutType, number>();

    // Grid: interactions distributed evenly across x and y
    // List: interactions mainly vertical
    // Stacked: interactions on stacked elements

    const xVariance = this.calculateVariance(
      interactions.map(i => i.position.x)
    );
    const yVariance = this.calculateVariance(
      interactions.map(i => i.position.y)
    );

    if (xVariance > yVariance * 2) {
      layoutScores.set("grid", 0.7);
      layoutScores.set("list", 0.3);
    } else if (yVariance > xVariance * 2) {
      layoutScores.set("list", 0.7);
      layoutScores.set("stacked", 0.3);
    } else {
      layoutScores.set("masonry", 0.6);
      layoutScores.set("grid", 0.4);
    }

    // Find preferred layout
    let maxScore = 0;
    let preferred: LayoutType = "grid";
    for (const [layout, score] of layoutScores.entries()) {
      if (score > maxScore) {
        maxScore = score;
        preferred = layout;
      }
    }

    // Infer density from interaction spacing
    const avgDistance = this.calculateAverageDistance(interactions);
    const density: DensityType =
      avgDistance < 100 ? "compact" : avgDistance < 200 ? "normal" : "spacious";

    // Infer alignment from x positions
    const avgX =
      interactions.reduce((sum, i) => sum + i.position.x, 0) /
      interactions.length;
    const viewportWidth = interactions[0]?.context.viewport.width ?? 1000;
    const alignment: AlignmentType =
      avgX < viewportWidth * 0.33
        ? "left"
        : avgX > viewportWidth * 0.66
          ? "right"
          : "center";

    const confidence = Math.min(interactions.length / 100, 1);

    return {
      preferred,
      density,
      alignment,
      confidence,
    };
  }

  /**
   * Extract visual preferences
   */
  private extractVisualPreferences(
    counts: InteractionCounts,
    interactions: Interaction[]
  ): VisualPreferences {
    // Infer theme from time of day (light during day, dark at night)
    const hour = new Date().getHours();
    const theme: ThemeType = hour >= 18 || hour <= 6 ? "dark" : "light";

    // Extract most common colors
    const sortedColors = Array.from(counts.colors.entries()).sort(
      (a, b) => b[1] - a[1]
    );
    const primaryColor = sortedColors[0]?.[0] ?? "#007bff";
    const accentColor = sortedColors[1]?.[0] ?? "#28a745";

    // Infer border radius preference from element attributes
    let borderRadius = 4;
    for (const interaction of interactions) {
      if (interaction.element.attributes?.["borderRadius"]) {
        borderRadius = interaction.element.attributes["borderRadius"] as number;
        break;
      }
    }

    // Prefer shadows and animations (default to true)
    const shadows = true;
    const animations = true;

    const confidence = Math.min(interactions.length / 50, 1);

    return {
      theme,
      primaryColor,
      accentColor,
      borderRadius,
      shadows,
      animations,
      confidence,
    };
  }

  /**
   * Extract typography preferences
   */
  private extractTypographyPreferences(
    counts: InteractionCounts,
    interactions: Interaction[]
  ): TypographyPreferences {
    // Extract font family from element attributes
    let fontFamily = "system-ui";
    for (const interaction of interactions) {
      if (interaction.element.attributes?.["fontFamily"]) {
        fontFamily = interaction.element.attributes["fontFamily"] as string;
        break;
      }
    }

    // Infer font size preference from text selection patterns
    const fontSize: FontSizeType = "medium";

    // Calculate line height from text element spacing
    const lineHeight = 1.5;

    // Letter spacing
    const letterSpacing = 0;

    // Font weight
    const fontWeight = 400;

    const confidence = Math.min(interactions.length / 30, 1);

    return {
      fontFamily,
      fontSize,
      lineHeight,
      letterSpacing,
      fontWeight,
      confidence,
    };
  }

  /**
   * Extract component preferences
   */
  private extractComponentPreferences(
    counts: InteractionCounts,
    interactions: Interaction[]
  ): ComponentPreferences {
    // Sort components by interaction count
    const sorted = Array.from(counts.components.entries()).sort(
      (a, b) => b[1] - a[1]
    );

    // Top 20% are preferred
    const preferredCount = Math.max(1, Math.floor(sorted.length * 0.2));
    const preferred = sorted.slice(0, preferredCount).map(s => s[0]);

    // Bottom 20% are avoided
    const avoidedCount = Math.max(1, Math.floor(sorted.length * 0.2));
    const avoided = sorted.slice(-avoidedCount).map(s => s[0]);

    const customizations: Record<string, unknown> = {};

    const confidence = Math.min(interactions.length / 40, 1);

    return {
      preferred,
      avoided,
      customizations,
      confidence,
    };
  }

  /**
   * Extract navigation preferences
   */
  private extractNavigationPreferences(
    counts: InteractionCounts,
    interactions: Interaction[]
  ): NavigationPreferences {
    // Infer navigation style from interaction patterns
    // Check if interactions are mostly on left, right, top, or bottom

    const viewportWidth = interactions[0]?.context.viewport.width ?? 1000;
    const viewportHeight = interactions[0]?.context.viewport.height ?? 800;

    let leftCount = 0;
    let rightCount = 0;
    let topCount = 0;
    let bottomCount = 0;

    for (const interaction of interactions) {
      if (interaction.position.x < viewportWidth * 0.2) leftCount++;
      else if (interaction.position.x > viewportWidth * 0.8) rightCount++;
      if (interaction.position.y < viewportHeight * 0.2) topCount++;
      else if (interaction.position.y > viewportHeight * 0.8) bottomCount++;
    }

    let style: NavigationStyle = "sidebar";
    let position: NavPosition = "left";

    const max = Math.max(leftCount, rightCount, topCount, bottomCount);
    if (max === leftCount) {
      style = "sidebar";
      position = "left";
    } else if (max === rightCount) {
      style = "sidebar";
      position = "right";
    } else if (max === topCount) {
      style = "topbar";
      position = "top";
    } else if (max === bottomCount) {
      style = "bottom";
      position = "bottom";
    }

    // Prefer sticky navigation
    const sticky = true;

    // Prefer collapsed navigation for smaller screens
    const collapsed = viewportWidth < 768;

    const confidence = Math.min(interactions.length / 20, 1);

    return {
      style,
      position,
      sticky,
      collapsed,
      confidence,
    };
  }

  /**
   * Calculate variance of numbers
   */
  private calculateVariance(numbers: number[]): number {
    if (numbers.length === 0) return 0;

    const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
  }

  /**
   * Calculate average distance between interactions
   */
  private calculateAverageDistance(interactions: Interaction[]): number {
    if (interactions.length < 2) return 0;

    let totalDistance = 0;
    let count = 0;

    for (let i = 1; i < interactions.length; i++) {
      const prev = interactions[i - 1]!;
      const curr = interactions[i]!;

      const dx = curr.position.x - prev.position.x;
      const dy = curr.position.y - prev.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      totalDistance += distance;
      count++;
    }

    return count > 0 ? totalDistance / count : 0;
  }

  /**
   * Incrementally update preferences
   */
  updatePreferences(
    current: UserPreferences,
    newInteractions: Interaction[],
    weight: number = 0.3
  ): UserPreferences {
    const newPrefs = this.extractPreferences(current.userId, newInteractions);

    // Weighted average of current and new preferences
    const w = weight;
    const updated: UserPreferences = {
      ...current,
      layout: {
        preferred: this.weightedChoice(
          current.layout.preferred,
          newPrefs.layout.preferred,
          w
        ),
        density: this.weightedChoice(
          current.layout.density,
          newPrefs.layout.density,
          w
        ),
        alignment: this.weightedChoice(
          current.layout.alignment,
          newPrefs.layout.alignment,
          w
        ),
        confidence: Math.min(
          current.layout.confidence + w * newPrefs.layout.confidence,
          1
        ),
      },
      visual: {
        theme: this.weightedChoice(
          current.visual.theme,
          newPrefs.visual.theme,
          w
        ),
        primaryColor: newPrefs.visual.primaryColor, // Use new color
        accentColor: newPrefs.visual.accentColor,
        borderRadius: Math.round(
          (1 - w) * current.visual.borderRadius +
            w * newPrefs.visual.borderRadius
        ),
        shadows: newPrefs.visual.shadows,
        animations: newPrefs.visual.animations,
        confidence: Math.min(
          current.visual.confidence + w * newPrefs.visual.confidence,
          1
        ),
      },
      typography: {
        fontFamily: newPrefs.typography.fontFamily,
        fontSize: this.weightedChoice(
          current.typography.fontSize,
          newPrefs.typography.fontSize,
          w
        ),
        lineHeight:
          (1 - w) * current.typography.lineHeight +
          w * newPrefs.typography.lineHeight,
        letterSpacing:
          (1 - w) * current.typography.letterSpacing +
          w * newPrefs.typography.letterSpacing,
        fontWeight: Math.round(
          (1 - w) * current.typography.fontWeight +
            w * newPrefs.typography.fontWeight
        ),
        confidence: Math.min(
          current.typography.confidence + w * newPrefs.typography.confidence,
          1
        ),
      },
      components: newPrefs.components,
      navigation: newPrefs.navigation,
      overallConfidence: Math.min(
        current.overallConfidence + w * newPrefs.overallConfidence,
        1
      ),
      lastUpdated: Date.now(),
      version: current.version + 1,
    };

    return updated;
  }

  /**
   * Weighted choice between two options
   */
  private weightedChoice<T>(current: T, newOption: T, weight: number): T {
    return Math.random() < weight ? newOption : current;
  }
}

type NavigationStyle = "sidebar" | "topbar" | "bottom" | "hamburger";
type NavPosition = "left" | "right" | "top" | "bottom";

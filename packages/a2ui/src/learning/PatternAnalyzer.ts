/**
 * @fileoverview Pattern Analyzer - Analyze user interaction patterns to extract insights
 * @author Aequor Project - Round 18 Agent 1
 * @version 1.0.0
 */

import type {
  UserPreference,
  ComponentUsageStats,
  InteractionPattern,
  UIInteraction,
  LayoutDensity,
  ThemePreference,
} from "./PreferenceCollector.js";
import type { A2UIResponse, A2UIComponent } from "@lsi/protocol";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Detected pattern type
 */
export type PatternType =
  | "sequential"
  | "frequent"
  | "temporal"
  | "spatial"
  | "error_prone"
  | "efficient";

/**
 * Analysis result for a specific pattern
 */
export interface PatternAnalysis {
  type: PatternType;
  confidence: number; // 0-1
  description: string;
  insights: string[];
  recommendations: string[];
  metrics: Record<string, number>;
}

/**
 * Layout preference analysis
 */
export interface LayoutPreferenceAnalysis {
  preferredDensity: LayoutDensity;
  preferredNavigation: "sidebar" | "topbar" | "tabs" | "drawer";
  optimalComponentCount: number;
  informationTolerance: number; // 0-1
  scrollBehavior: "lazy" | "active" | "mixed";
  confidence: number;
}

/**
 * Component category
 */
export type ComponentCategory =
  | "input"
  | "display"
  | "navigation"
  | "action"
  | "container"
  | "media";

/**
 * Component efficiency analysis
 */
export interface ComponentEfficiency {
  componentType: string;
  efficiency: number; // 0-1, higher is better
  avgTimeToComplete: number; // milliseconds
  errorRate: number; // 0-1
  userSatisfaction: number; // 0-1
  recommendation: "keep" | "improve" | "remove" | "redesign";
}

/**
 * Full preference profile analysis
 */
export interface PreferenceProfile {
  userId: string;
  analysisDate: Date;

  // Layout preferences
  layout: LayoutPreferenceAnalysis;

  // Component preferences
  preferredComponents: string[];
  avoidedComponents: string[];
  componentEfficiency: ComponentEfficiency[];

  // Behavioral patterns
  patterns: PatternAnalysis[];

  // Temporal patterns
  peakUsageTimes: number[]; // Hours of day
  peakUsageDays: number[]; // Days of week
  avgSessionLength: number; // minutes

  // Personalization recommendations
  recommendations: PersonalizationRecommendation[];

  // Overall confidence in analysis
  confidence: number;
}

/**
 * Personalization recommendation
 */
export interface PersonalizationRecommendation {
  type: "layout" | "component" | "theme" | "flow" | "content";
  priority: "high" | "medium" | "low";
  description: string;
  expectedImpact: number; // 0-1
  implementation: string;
}

/**
 * Configuration for PatternAnalyzer
 */
export interface PatternAnalyzerConfig {
  minInteractionsForAnalysis?: number;
  confidenceThreshold?: number;
  temporalGranularity?: number; // hours
  enableSpatialAnalysis?: boolean;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_ANALYZER_CONFIG: Required<PatternAnalyzerConfig> = {
  minInteractionsForAnalysis: 10,
  confidenceThreshold: 0.6,
  temporalGranularity: 1,
  enableSpatialAnalysis: true,
};

// ============================================================================
// COMPONENT CATEGORIES
// ============================================================================

const COMPONENT_CATEGORIES: Record<string, ComponentCategory> = {
  button: "action",
  input: "input",
  textfield: "input",
  textarea: "input",
  select: "input",
  checkbox: "input",
  radio: "input",
  text: "display",
  image: "display",
  video: "media",
  audio: "media",
  link: "navigation",
  tab: "navigation",
  menu: "navigation",
  sidebar: "navigation",
  container: "container",
  card: "container",
  modal: "container",
  dialog: "container",
};

// ============================================================================
// PATTERN ANALYZER
// ============================================================================

/**
 * PatternAnalyzer - Analyze user interaction patterns to extract insights
 *
 * Detects patterns in user behavior and generates actionable recommendations
 * for UI personalization.
 */
export class PatternAnalyzer {
  private config: Required<PatternAnalyzerConfig>;

  constructor(config?: PatternAnalyzerConfig) {
    this.config = {
      ...DEFAULT_ANALYZER_CONFIG,
      ...config,
    };
  }

  /**
   * Analyze user preference data to generate profile
   */
  async analyzePreferences(
    preference: UserPreference
  ): Promise<PreferenceProfile> {
    const hasEnoughData =
      preference.sessionStats.totalInteractions >=
      this.config.minInteractionsForAnalysis;

    if (!hasEnoughData) {
      return this.createDefaultProfile(preference.userId);
    }

    const profile: PreferenceProfile = {
      userId: preference.userId,
      analysisDate: new Date(),
      layout: this.analyzeLayoutPreferences(preference),
      preferredComponents: this.extractPreferredComponents(preference),
      avoidedComponents: this.extractAvoidedComponents(preference),
      componentEfficiency: this.analyzeComponentEfficiency(preference),
      patterns: this.detectPatterns(preference),
      peakUsageTimes: this.extractPeakUsageTimes(preference),
      peakUsageDays: this.extractPeakUsageDays(preference),
      avgSessionLength: preference.sessionStats.avgSessionDuration / 60000, // Convert to minutes
      recommendations: [],
      confidence: this.calculateOverallConfidence(preference),
    };

    // Generate recommendations based on analysis
    profile.recommendations = this.generateRecommendations(profile, preference);

    return profile;
  }

  /**
   * Analyze interaction sequence for patterns
   */
  analyzeSequence(interactions: UIInteraction[]): PatternAnalysis[] {
    const analyses: PatternAnalysis[] = [];

    // Detect sequential patterns
    const sequentialPatterns = this.detectSequentialPatterns(interactions);
    if (sequentialPatterns.length > 0) {
      analyses.push({
        type: "sequential",
        confidence: this.calculatePatternConfidence(sequentialPatterns),
        description: "User follows consistent interaction sequences",
        insights: sequentialPatterns.map(p => p.join(" → ")),
        recommendations: [
          "Optimize UI for these common workflows",
          "Add shortcuts for frequent sequences",
          "Consider combining sequential actions",
        ],
        metrics: {
          patternCount: sequentialPatterns.length,
          avgSequenceLength: this.average(
            sequentialPatterns.map(p => p.length)
          ),
        },
      });
    }

    // Detect frequent patterns
    const frequentComponents = this.detectFrequentComponents(interactions);
    if (frequentComponents.length > 0) {
      analyses.push({
        type: "frequent",
        confidence: 0.8,
        description: "User frequently uses specific components",
        insights: frequentComponents.map(c => `${c.type}: ${c.count} times`),
        recommendations: [
          "Make frequently used components more accessible",
          "Consider adding quick actions",
          "Optimize placement of popular components",
        ],
        metrics: {
          topComponentCount: frequentComponents[0]?.count || 0,
          uniqueComponents: frequentComponents.length,
        },
      });
    }

    return analyses;
  }

  /**
   * Compare two preference profiles
   */
  compareProfiles(
    profile1: PreferenceProfile,
    profile2: PreferenceProfile
  ): {
    similarity: number; // 0-1
    differences: string[];
  } {
    const differences: string[] = [];
    let similarityScore = 1.0;

    // Compare layout preferences
    if (profile1.layout.preferredDensity !== profile2.layout.preferredDensity) {
      differences.push(
        `Layout density: ${profile1.layout.preferredDensity} vs ${profile2.layout.preferredDensity}`
      );
      similarityScore -= 0.1;
    }

    // Compare preferred components
    const commonComponents = this.intersection(
      profile1.preferredComponents,
      profile2.preferredComponents
    );
    const allComponents = this.union(
      profile1.preferredComponents,
      profile2.preferredComponents
    );
    const componentSimilarity =
      commonComponents.length / Math.max(1, allComponents.length);
    similarityScore *= componentSimilarity;

    if (componentSimilarity < 0.5) {
      differences.push("Component preferences differ significantly");
    }

    return {
      similarity: Math.max(0, similarityScore),
      differences,
    };
  }

  // ============================================================================
  // PRIVATE ANALYSIS METHODS
  // ============================================================================

  /**
   * Analyze layout preferences from user data
   */
  private analyzeLayoutPreferences(
    preference: UserPreference
  ): LayoutPreferenceAnalysis {
    const implicit = preference.implicitPreferences;

    // Determine preferred density based on information tolerance
    let density: LayoutDensity;
    if (implicit.informationDensity < 0.33) {
      density = "spacious";
    } else if (implicit.informationDensity < 0.67) {
      density = "comfortable";
    } else {
      density = "compact";
    }

    return {
      preferredDensity: density,
      preferredNavigation: implicit.navigationStyle,
      optimalComponentCount: Math.round(implicit.informationDensity * 20),
      informationTolerance: implicit.informationDensity,
      scrollBehavior: implicit.informationDensity > 0.7 ? "active" : "lazy",
      confidence: 0.7,
    };
  }

  /**
   * Extract most preferred components
   */
  private extractPreferredComponents(preference: UserPreference): string[] {
    return Array.from(preference.componentUsage.values())
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, 10)
      .map(c => c.componentType);
  }

  /**
   * Extract avoided or problematic components
   */
  private extractAvoidedComponents(preference: UserPreference): string[] {
    return Array.from(preference.componentUsage.values())
      .filter(c => c.successRate < 0.5 || c.avgDwellTime < 500)
      .sort((a, b) => a.successRate - b.successRate)
      .slice(0, 5)
      .map(c => c.componentType);
  }

  /**
   * Analyze component efficiency
   */
  private analyzeComponentEfficiency(
    preference: UserPreference
  ): ComponentEfficiency[] {
    return Array.from(preference.componentUsage.values()).map(usage => {
      const efficiency = this.calculateComponentEfficiency(usage);
      let recommendation: ComponentEfficiency["recommendation"];

      if (efficiency > 0.8) {
        recommendation = "keep";
      } else if (efficiency > 0.6) {
        recommendation = "improve";
      } else if (efficiency > 0.3) {
        recommendation = "redesign";
      } else {
        recommendation = "remove";
      }

      return {
        componentType: usage.componentType,
        efficiency,
        avgTimeToComplete: usage.avgDwellTime,
        errorRate: 1 - usage.successRate,
        userSatisfaction: usage.successRate,
        recommendation,
      };
    });
  }

  /**
   * Detect interaction patterns
   */
  private detectPatterns(preference: UserPreference): PatternAnalysis[] {
    const patterns: PatternAnalysis[] = [];

    // Detect temporal patterns
    const temporalPattern = this.detectTemporalPattern(preference);
    if (temporalPattern) {
      patterns.push(temporalPattern);
    }

    // Detect error-prone patterns
    const errorPattern = this.detectErrorPattern(preference);
    if (errorPattern) {
      patterns.push(errorPattern);
    }

    return patterns;
  }

  /**
   * Detect temporal usage patterns
   */
  private detectTemporalPattern(
    preference: UserPreference
  ): PatternAnalysis | null {
    const timeGroups = new Map<number, number>();
    for (const pattern of preference.interactionPatterns) {
      const hour =
        Math.floor(pattern.avgTimeOfDay / this.config.temporalGranularity) *
        this.config.temporalGranularity;
      timeGroups.set(hour, (timeGroups.get(hour) || 0) + pattern.frequency);
    }

    if (timeGroups.size === 0) {
      return null;
    }

    const peakHour = Array.from(timeGroups.entries()).sort(
      (a, b) => b[1] - a[1]
    )[0][0];

    return {
      type: "temporal",
      confidence: 0.7,
      description: `User most active around ${peakHour}:00`,
      insights: [
        `Peak usage at hour ${peakHour}`,
        `${timeGroups.size} distinct usage periods detected`,
      ],
      recommendations: [
        "Schedule resource-intensive tasks during peak hours",
        "Send notifications during active periods",
      ],
      metrics: {
        peakHour,
        totalPatterns: preference.interactionPatterns.length,
      },
    };
  }

  /**
   * Detect error-prone components or patterns
   */
  private detectErrorPattern(
    preference: UserPreference
  ): PatternAnalysis | null {
    const problematic = Array.from(preference.componentUsage.values())
      .filter(c => c.successRate < 0.7)
      .sort((a, b) => a.successRate - b.successRate)
      .slice(0, 3);

    if (problematic.length === 0) {
      return null;
    }

    return {
      type: "error_prone",
      confidence: 0.8,
      description: "Some components have high error rates",
      insights: problematic.map(
        c =>
          `${c.componentType}: ${((1 - c.successRate) * 100).toFixed(1)}% error rate`
      ),
      recommendations: [
        "Review error-prone components for usability issues",
        "Add validation and guidance",
        "Simplify complex interactions",
      ],
      metrics: {
        problematicCount: problematic.length,
        avgErrorRate: this.average(problematic.map(c => 1 - c.successRate)),
      },
    };
  }

  /**
   * Extract peak usage times (hours)
   */
  private extractPeakUsageTimes(preference: UserPreference): number[] {
    const hourCounts = new Map<number, number>();
    for (const pattern of preference.interactionPatterns) {
      hourCounts.set(
        pattern.avgTimeOfDay,
        (hourCounts.get(pattern.avgTimeOfDay) || 0) + pattern.frequency
      );
    }
    return Array.from(hourCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(e => e[0]);
  }

  /**
   * Extract peak usage days
   */
  private extractPeakUsageDays(preference: UserPreference): number[] {
    const dayCounts = new Map<number, number>();
    for (const pattern of preference.interactionPatterns) {
      dayCounts.set(
        pattern.dayOfWeek,
        (dayCounts.get(pattern.dayOfWeek) || 0) + pattern.frequency
      );
    }
    return Array.from(dayCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(e => e[0]);
  }

  /**
   * Calculate component efficiency score
   */
  private calculateComponentEfficiency(usage: ComponentUsageStats): number {
    // Efficiency = (success rate * 0.6) + (usage frequency * 0.4)
    const frequencyScore = Math.min(1, usage.viewCount / 100);
    return usage.successRate * 0.6 + frequencyScore * 0.4;
  }

  /**
   * Calculate overall confidence in analysis
   */
  private calculateOverallConfidence(preference: UserPreference): number {
    const interactionCount = preference.sessionStats.totalInteractions;
    const sessionCount = preference.sessionStats.totalSessions;

    // More interactions and sessions = higher confidence
    // Adjusted thresholds to be more realistic for typical usage
    const interactionConfidence = Math.min(1, interactionCount / 200);
    const sessionConfidence = Math.min(1, sessionCount / 30);

    return (interactionConfidence + sessionConfidence) / 2;
  }

  /**
   * Generate personalization recommendations
   */
  private generateRecommendations(
    profile: PreferenceProfile,
    preference: UserPreference
  ): PersonalizationRecommendation[] {
    const recommendations: PersonalizationRecommendation[] = [];

    // Layout recommendations
    if (profile.layout.confidence > 0.6) {
      recommendations.push({
        type: "layout",
        priority: "high",
        description: `Use ${profile.layout.preferredDensity} layout density`,
        expectedImpact: 0.8,
        implementation: `Set layout spacing to ${profile.layout.preferredDensity} mode`,
      });
    }

    // Component recommendations
    const inefficient = profile.componentEfficiency.filter(
      c => c.recommendation === "improve"
    );
    if (inefficient.length > 0) {
      recommendations.push({
        type: "component",
        priority: "medium",
        description: `Improve ${inefficient.length} underperforming components`,
        expectedImpact: 0.6,
        implementation: "Review and redesign error-prone components",
      });
    }

    // Theme recommendations
    if (preference.explicitPreferences.theme === "auto") {
      recommendations.push({
        type: "theme",
        priority: "low",
        description: "Enable automatic theme switching",
        expectedImpact: 0.3,
        implementation: "Follow system preference for light/dark mode",
      });
    }

    return recommendations;
  }

  /**
   * Detect sequential patterns in interactions
   */
  private detectSequentialPatterns(interactions: UIInteraction[]): string[][] {
    const sequences: Map<string, number> = new Map();
    const windowSize = 3;

    for (let i = 0; i < interactions.length - windowSize; i++) {
      const sequence = interactions
        .slice(i, i + windowSize)
        .map(i => i.componentType || "unknown")
        .join("→");

      sequences.set(sequence, (sequences.get(sequence) || 0) + 1);
    }

    // Return top sequences
    return Array.from(sequences.entries())
      .filter(e => e[1] >= 2) // Must occur at least twice
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(e => e[0].split("→"));
  }

  /**
   * Detect frequently used components
   */
  private detectFrequentComponents(interactions: UIInteraction[]): Array<{
    type: string;
    count: number;
  }> {
    const counts = new Map<string, number>();

    for (const interaction of interactions) {
      if (interaction.componentType) {
        counts.set(
          interaction.componentType,
          (counts.get(interaction.componentType) || 0) + 1
        );
      }
    }

    return Array.from(counts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Calculate pattern confidence
   */
  private calculatePatternConfidence(patterns: unknown[][]): number {
    if (patterns.length === 0) return 0;
    return Math.min(1, patterns.length * 0.2);
  }

  /**
   * Create default profile for new users
   */
  private createDefaultProfile(userId: string): PreferenceProfile {
    return {
      userId,
      analysisDate: new Date(),
      layout: {
        preferredDensity: "comfortable",
        preferredNavigation: "sidebar",
        optimalComponentCount: 8,
        informationTolerance: 0.5,
        scrollBehavior: "lazy",
        confidence: 0.3,
      },
      preferredComponents: [],
      avoidedComponents: [],
      componentEfficiency: [],
      patterns: [],
      peakUsageTimes: [9, 14, 20],
      peakUsageDays: [1, 2, 3],
      avgSessionLength: 5,
      recommendations: [
        {
          type: "layout",
          priority: "low",
          description:
            "Collect more interaction data for personalized recommendations",
          expectedImpact: 0,
          implementation: "Continue normal usage to enable personalization",
        },
      ],
      confidence: 0.3,
    };
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  private intersection<T>(a: T[], b: T[]): T[] {
    const setB = new Set(b);
    return a.filter(x => setB.has(x));
  }

  private union<T>(a: T[], b: T[]): T[] {
    return Array.from(new Set([...a, ...b]));
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a pattern analyzer with default configuration
 */
export function createPatternAnalyzer(
  config?: PatternAnalyzerConfig
): PatternAnalyzer {
  return new PatternAnalyzer(config);
}

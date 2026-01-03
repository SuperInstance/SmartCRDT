/**
 * RecommendationEngine - Generates actionable recommendations from insights
 */

import type { Insight, PersonalizationInsight } from "../types.js";

export interface Recommendation {
  id: string;
  type: string;
  priority: "low" | "medium" | "high" | "urgent";
  title: string;
  description: string;
  actions: string[];
  expectedImpact: string;
  effort: "low" | "medium" | "high";
  basedOn: string[];
  timestamp: number;
}

export class RecommendationEngine {
  /**
   * Generate recommendations from insights
   */
  generateRecommendations(insights: Insight[]): Recommendation[] {
    const recommendations: Recommendation[] = [];

    for (const insight of insights) {
      if (insight.type === "trend") {
        recommendations.push(...this.fromTrend(insight));
      } else if (insight.type === "anomaly") {
        recommendations.push(...this.fromAnomaly(insight));
      } else if (insight.type === "correlation") {
        recommendations.push(...this.fromCorrelation(insight));
      }
    }

    return this.deduplicate(recommendations);
  }

  /**
   * Generate recommendations from trend insight
   */
  private fromTrend(insight: Insight): Recommendation[] {
    const recommendations: Recommendation[] = [];

    if (insight.data.trend === "down") {
      recommendations.push({
        id: this.generateId(),
        type: "decline_reversal",
        priority: insight.impact === "high" ? "urgent" : "high",
        title: `Reverse declining trend in ${insight.data.metric}`,
        description: `${insight.data.metric} has decreased by ${Math.abs(insight.data.changePercent || 0).toFixed(1)}%`,
        actions: [
          "Conduct root cause analysis",
          "Review recent changes that may have impacted this metric",
          "Implement corrective measures",
          "Monitor for recovery",
        ],
        expectedImpact: `${Math.abs(insight.data.changePercent || 0).toFixed(0)}% potential recovery`,
        effort: "medium",
        basedOn: [insight.id],
        timestamp: Date.now(),
      });
    }

    return recommendations;
  }

  /**
   * Generate recommendations from anomaly insight
   */
  private fromAnomaly(insight: Insight): Recommendation[] {
    const recommendations: Recommendation[] = [];

    recommendations.push({
      id: this.generateId(),
      type: "anomaly_investigation",
      priority: insight.impact === "high" ? "urgent" : "high",
      title: `Investigate anomaly in ${insight.data.metric}`,
      description: `Unusual value detected: ${insight.data.currentValue} (expected: ${insight.data.expected?.toFixed(2)})`,
      actions: [
        "Verify data quality",
        "Check for system issues",
        "Review recent configuration changes",
        "Escalate if persistent",
      ],
      expectedImpact: "Prevent potential issues",
      effort: "low",
      basedOn: [insight.id],
      timestamp: Date.now(),
    });

    return recommendations;
  }

  /**
   * Generate recommendations from correlation insight
   */
  private fromCorrelation(insight: Insight): Recommendation[] {
    const recommendations: Recommendation[] = [];

    const correlation = insight.data.correlation;
    if (correlation && correlation.coefficient > 0.8) {
      recommendations.push({
        id: this.generateId(),
        type: "correlation_optimization",
        priority: "medium",
        title: `Leverage correlation between ${correlation.metric1} and ${correlation.metric2}`,
        description: `Strong positive correlation (${correlation.coefficient.toFixed(2)}) detected`,
        actions: [
          `Consider using ${correlation.metric1} to predict ${correlation.metric2}`,
          "Investigate causal relationship",
          "Use correlation for optimization opportunities",
        ],
        expectedImpact: "Improved forecasting and optimization",
        effort: "low",
        basedOn: [insight.id],
        timestamp: Date.now(),
      });
    }

    return recommendations;
  }

  /**
   * Generate personalization recommendations
   */
  generatePersonalizationRecommendations(
    insights: PersonalizationInsight[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Group insights by user
    const insightsByUser = new Map<string, PersonalizationInsight[]>();
    for (const insight of insights) {
      if (!insightsByUser.has(insight.userId)) {
        insightsByUser.set(insight.userId, []);
      }
      insightsByUser.get(insight.userId)!.push(insight);
    }

    for (const [userId, userInsights] of insightsByUser) {
      // Check for low satisfaction
      const lowSatisfaction = userInsights.find(
        i => i.preference === "low_satisfaction"
      );
      if (lowSatisfaction) {
        recommendations.push({
          id: this.generateId(),
          type: "personalization_improvement",
          priority: lowSatisfaction.impact === "high" ? "high" : "medium",
          title: `Improve personalization for user ${userId}`,
          description: lowSatisfaction.description,
          actions: lowSatisfaction.suggestedActions,
          expectedImpact: "Increased user satisfaction and engagement",
          effort: "medium",
          basedOn: userInsights.map(i => i.userId),
          timestamp: Date.now(),
        });
      }
    }

    return recommendations;
  }

  /**
   * Deduplicate recommendations
   */
  private deduplicate(recommendations: Recommendation[]): Recommendation[] {
    const seen = new Set<string>();
    const unique: Recommendation[] = [];

    for (const rec of recommendations) {
      const key = `${rec.type}:${rec.title}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(rec);
      }
    }

    return unique;
  }

  /**
   * Prioritize recommendations
   */
  prioritize(recommendations: Recommendation[]): Recommendation[] {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };

    return recommendations.sort((a, b) => {
      const priorityDiff =
        priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      return b.timestamp - a.timestamp;
    });
  }

  /**
   * Filter by effort
   */
  filterByEffort(
    recommendations: Recommendation[],
    maxEffort: "low" | "medium" | "high"
  ): Recommendation[] {
    const effortOrder = { low: 0, medium: 1, high: 2 };
    const maxLevel = effortOrder[maxEffort];

    return recommendations.filter(r => effortOrder[r.effort] <= maxLevel);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

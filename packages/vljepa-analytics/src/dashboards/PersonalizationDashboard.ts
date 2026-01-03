/**
 * PersonalizationDashboard - Personalization analytics dashboard
 * Tracks accuracy, satisfaction, engagement, and recommendation performance
 */

import { EventEmitter } from "eventemitter3";
import type {
  DashboardConfig,
  PersonalizationMetrics,
  PersonalizationInsight,
  DateRange,
  RecMetrics,
} from "../types.js";

export class PersonalizationDashboard extends EventEmitter {
  private config: DashboardConfig;
  private predictions: Map<
    string,
    Array<{ prediction: unknown; actual: unknown; timestamp: number }>
  > = new Map();
  private satisfactionScores: Map<
    string,
    Array<{ score: number; timestamp: number }>
  > = new Map();
  private engagementData: Map<
    string,
    Array<{ personalized: number; baseline: number; timestamp: number }>
  > = new Map();
  private recommendationResults: Array<{
    userId: string;
    recommendations: string[];
    clicked: string[];
    converted: string[];
    timestamp: number;
    diversity: number;
    novelty: number;
  }> = [];

  constructor(config: DashboardConfig) {
    super();
    this.config = config;
  }

  /**
   * Get personalization metrics
   */
  async getMetrics(): Promise<PersonalizationMetrics> {
    const accuracy = this.calculateAccuracy();
    const precision = this.calculatePrecision();
    const recall = this.calculateRecall();
    const f1Score =
      precision + recall > 0
        ? (2 * precision * recall) / (precision + recall)
        : 0;
    const satisfaction = this.calculateSatisfaction();
    const engagementLift = this.calculateEngagementLift();
    const recommendationPerformance = this.calculateRecommendationPerformance();
    const clickThroughRate = this.calculateCTR();
    const conversionRate = this.calculateConversionRate();
    const personalizationCoverage = this.calculateCoverage();

    return {
      accuracy,
      precision,
      recall,
      f1Score,
      satisfaction,
      engagementLift,
      recommendationPerformance,
      clickThroughRate,
      conversionRate,
      averageOrderValue: 0,
      personalizationCoverage,
      timestamp: Date.now(),
      dateRange: this.config.dateRange,
    };
  }

  /**
   * Record a prediction
   */
  recordPrediction(userId: string, prediction: unknown, actual: unknown): void {
    if (!this.predictions.has(userId)) {
      this.predictions.set(userId, []);
    }

    this.predictions.get(userId)!.push({
      prediction,
      actual,
      timestamp: Date.now(),
    });

    this.emit("predictionRecorded", { userId, prediction, actual });
  }

  /**
   * Record satisfaction score
   */
  recordSatisfaction(userId: string, score: number): void {
    if (!this.satisfactionScores.has(userId)) {
      this.satisfactionScores.set(userId, []);
    }

    this.satisfactionScores.get(userId)!.push({
      score: Math.max(0, Math.min(1, score)),
      timestamp: Date.now(),
    });

    this.emit("satisfactionRecorded", { userId, score });
  }

  /**
   * Record engagement
   */
  recordEngagement(
    userId: string,
    personalized: number,
    baseline: number
  ): void {
    if (!this.engagementData.has(userId)) {
      this.engagementData.set(userId, []);
    }

    this.engagementData.get(userId)!.push({
      personalized,
      baseline,
      timestamp: Date.now(),
    });

    this.emit("engagementRecorded", { userId, personalized, baseline });
  }

  /**
   * Record recommendation results
   */
  recordRecommendationResults(
    userId: string,
    recommendations: string[],
    clicked: string[],
    converted: string[],
    diversity: number,
    novelty: number
  ): void {
    this.recommendationResults.push({
      userId,
      recommendations,
      clicked,
      converted,
      timestamp: Date.now(),
      diversity,
      novelty,
    });

    this.emit("recommendationRecorded", {
      userId,
      recommendations,
      clicked,
      converted,
    });
  }

  /**
   * Get insights
   */
  async getInsights(): Promise<PersonalizationInsight[]> {
    const insights: PersonalizationInsight[] = [];

    // Analyze low satisfaction users
    for (const [userId, scores] of this.satisfactionScores) {
      const avgScore =
        scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
      if (avgScore < 0.5) {
        insights.push({
          type: "preference",
          userId,
          preference: "low_satisfaction",
          confidence: 1 - avgScore,
          impact: avgScore < 0.3 ? "high" : "medium",
          description: `User has low satisfaction score (${avgScore.toFixed(2)})`,
          suggestedActions: [
            "Review recommendation algorithm",
            "Increase diversity of recommendations",
            "Consider user feedback in model",
          ],
          metadata: { avgScore, sampleSize: scores.length },
        });
      }
    }

    // Analyze engagement lift
    for (const [userId, data] of this.engagementData) {
      const avgPersonalized =
        data.reduce((sum, d) => sum + d.personalized, 0) / data.length;
      const avgBaseline =
        data.reduce((sum, d) => sum + d.baseline, 0) / data.length;
      const lift =
        avgBaseline > 0
          ? ((avgPersonalized - avgBaseline) / avgBaseline) * 100
          : 0;

      if (lift < 0) {
        insights.push({
          type: "behavior",
          userId,
          preference: "negative_engagement_lift",
          confidence: Math.abs(lift) / 100,
          impact: lift < -20 ? "high" : "medium",
          description: `Personalization is hurting engagement (${lift.toFixed(1)}% lift)`,
          suggestedActions: [
            "Review personalization strategy",
            "Consider A/B testing different approaches",
            "Analyze user preferences more carefully",
          ],
          metadata: { lift, avgPersonalized, avgBaseline },
        });
      }
    }

    return insights;
  }

  /**
   * Calculate accuracy
   */
  private calculateAccuracy(): number {
    let correct = 0;
    let total = 0;

    for (const predictions of this.predictions.values()) {
      for (const { prediction, actual } of predictions) {
        if (typeof prediction === "boolean" && typeof actual === "boolean") {
          if (prediction === actual) correct++;
          total++;
        } else if (
          typeof prediction === "number" &&
          typeof actual === "number"
        ) {
          if (Math.abs(prediction - actual) < 0.1) correct++;
          total++;
        }
      }
    }

    return total > 0 ? correct / total : 0;
  }

  /**
   * Calculate precision
   */
  private calculatePrecision(): number {
    let truePositives = 0;
    let falsePositives = 0;

    for (const results of this.recommendationResults) {
      for (const rec of results.recommendations) {
        if (results.clicked.includes(rec) || results.converted.includes(rec)) {
          truePositives++;
        } else {
          falsePositives++;
        }
      }
    }

    return truePositives + falsePositives > 0
      ? truePositives / (truePositives + falsePositives)
      : 0;
  }

  /**
   * Calculate recall
   */
  private calculateRecall(): number {
    let truePositives = 0;
    let falseNegatives = 0;

    for (const results of this.recommendationResults) {
      for (const item of results.clicked.concat(results.converted)) {
        if (results.recommendations.includes(item)) {
          truePositives++;
        } else {
          falseNegatives++;
        }
      }
    }

    return truePositives + falseNegatives > 0
      ? truePositives / (truePositives + falseNegatives)
      : 0;
  }

  /**
   * Calculate satisfaction
   */
  private calculateSatisfaction(): number {
    let totalScore = 0;
    let count = 0;

    for (const scores of this.satisfactionScores.values()) {
      for (const { score } of scores) {
        totalScore += score;
        count++;
      }
    }

    return count > 0 ? totalScore / count : 0;
  }

  /**
   * Calculate engagement lift
   */
  private calculateEngagementLift(): number {
    let totalLift = 0;
    let count = 0;

    for (const data of this.engagementData.values()) {
      for (const { personalized, baseline } of data) {
        if (baseline > 0) {
          totalLift += ((personalized - baseline) / baseline) * 100;
          count++;
        }
      }
    }

    return count > 0 ? totalLift / count : 0;
  }

  /**
   * Calculate recommendation performance
   */
  private calculateRecommendationPerformance(): RecMetrics {
    if (this.recommendationResults.length === 0) {
      return {
        diversity: 0,
        novelty: 0,
        serendipity: 0,
        coverage: 0,
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1Score: 0,
      };
    }

    const avgDiversity =
      this.recommendationResults.reduce((sum, r) => sum + r.diversity, 0) /
      this.recommendationResults.length;
    const avgNovelty =
      this.recommendationResults.reduce((sum, r) => sum + r.novelty, 0) /
      this.recommendationResults.length;

    // Calculate serendipity (unexpected but useful)
    const serendipity = avgNovelty * this.calculatePrecision();

    // Calculate coverage (unique items recommended / total items)
    const uniqueItems = new Set<string>();
    for (const results of this.recommendationResults) {
      for (const rec of results.recommendations) {
        uniqueItems.add(rec);
      }
    }
    const coverage =
      this.recommendationResults.length > 0 ? uniqueItems.size / 1000 : 0; // Assume 1000 total items

    return {
      diversity: avgDiversity,
      novelty: avgNovelty,
      serendipity,
      coverage,
      accuracy: this.calculateAccuracy(),
      precision: this.calculatePrecision(),
      recall: this.calculateRecall(),
      f1Score: 0,
    };
  }

  /**
   * Calculate click-through rate
   */
  private calculateCTR(): number {
    let totalRecommendations = 0;
    let totalClicks = 0;

    for (const results of this.recommendationResults) {
      totalRecommendations += results.recommendations.length;
      totalClicks += results.clicked.length;
    }

    return totalRecommendations > 0 ? totalClicks / totalRecommendations : 0;
  }

  /**
   * Calculate conversion rate
   */
  private calculateConversionRate(): number {
    let totalRecommendations = 0;
    let totalConversions = 0;

    for (const results of this.recommendationResults) {
      totalRecommendations += results.recommendations.length;
      totalConversions += results.converted.length;
    }

    return totalRecommendations > 0
      ? totalConversions / totalRecommendations
      : 0;
  }

  /**
   * Calculate coverage
   */
  private calculateCoverage(): number {
    const uniqueUsers = new Set(this.recommendationResults.map(r => r.userId));
    return uniqueUsers.size > 0
      ? this.recommendationResults.length / uniqueUsers.size
      : 0;
  }

  /**
   * Update config
   */
  updateConfig(config: Partial<DashboardConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.predictions.clear();
    this.satisfactionScores.clear();
    this.engagementData.clear();
    this.recommendationResults = [];
  }
}

/**
 * PreferenceModel - Core model for storing and managing user preferences
 */

import type {
  UserPreferences,
  Interaction,
  Feedback,
  PreferenceModel as ModelDef,
  ModelConfig,
} from "../types.js";
import { PreferenceExtractor } from "../analyzers/PreferenceExtractor.js";

export class PreferenceModel {
  private preferences: Map<string, UserPreferences> = new Map();
  private interactions: Map<string, Interaction[]> = new Map();
  private feedback: Map<string, Feedback[]> = new Map();
  private extractor: PreferenceExtractor;
  private config: ModelConfig;

  constructor(config: Partial<ModelConfig> = {}) {
    this.config = {
      updateFrequency: config.updateFrequency ?? 60000, // 1 minute
      minDataPoints: config.minDataPoints ?? 10,
      validationSplit: config.validationSplit ?? 0.2,
      retrainThreshold: config.retrainThreshold ?? 0.1,
    };

    this.extractor = new PreferenceExtractor();
  }

  /**
   * Get user preferences
   */
  getPreferences(userId: string): UserPreferences | null {
    return this.preferences.get(userId) ?? null;
  }

  /**
   * Set user preferences
   */
  setPreferences(preferences: UserPreferences): void {
    this.preferences.set(preferences.userId, preferences);
  }

  /**
   * Update preferences from new interactions
   */
  updateFromInteractions(
    userId: string,
    interactions: Interaction[]
  ): UserPreferences {
    // Store interactions
    if (!this.interactions.has(userId)) {
      this.interactions.set(userId, []);
    }
    this.interactions.get(userId)!.push(...interactions);

    // Get current preferences or create new
    const current = this.preferences.get(userId);
    const allInteractions = this.interactions.get(userId) ?? [];

    if (current && allInteractions.length >= this.config.minDataPoints) {
      // Update existing preferences
      const updated = this.extractor.updatePreferences(current, interactions);
      this.preferences.set(userId, updated);
      return updated;
    } else {
      // Create new preferences
      const newPrefs = this.extractor.extractPreferences(
        userId,
        allInteractions
      );
      this.preferences.set(userId, newPrefs);
      return newPrefs;
    }
  }

  /**
   * Update preferences from feedback
   */
  updateFromFeedback(userId: string, feedback: Feedback[]): void {
    // Store feedback
    if (!this.feedback.has(userId)) {
      this.feedback.set(userId, []);
    }
    this.feedback.get(userId)!.push(...feedback);

    // Adjust preferences based on feedback
    const preferences = this.preferences.get(userId);
    if (!preferences) return;

    // Simple adjustment: reduce confidence for negatively rated items
    for (const fb of feedback) {
      if (fb.type === "explicit") {
        const explicit = fb.feedback as {
          type: string;
          value: number | boolean;
        };

        if (
          explicit.type === "dislike" ||
          (explicit.type === "rating" &&
            typeof explicit.value === "number" &&
            explicit.value < 3)
        ) {
          // Reduce confidence slightly
          preferences.overallConfidence = Math.max(
            0,
            preferences.overallConfidence - 0.05
          );
        } else if (
          explicit.type === "like" ||
          (explicit.type === "rating" &&
            typeof explicit.value === "number" &&
            explicit.value >= 4)
        ) {
          // Increase confidence slightly
          preferences.overallConfidence = Math.min(
            1,
            preferences.overallConfidence + 0.05
          );
        }
      }
    }

    preferences.lastUpdated = Date.now();
    preferences.version++;
    this.preferences.set(userId, preferences);
  }

  /**
   * Batch update preferences for multiple users
   */
  batchUpdate(
    updates: Map<string, Interaction[]>
  ): Map<string, UserPreferences> {
    const results = new Map<string, UserPreferences>();

    for (const [userId, interactions] of updates.entries()) {
      const updated = this.updateFromInteractions(userId, interactions);
      results.set(userId, updated);
    }

    return results;
  }

  /**
   * Get users similar to a target user
   */
  getSimilarUsers(userId: string, limit: number = 10): string[] {
    const target = this.preferences.get(userId);
    if (!target) return [];

    const similarities: Array<{ id: string; score: number }> = [];

    for (const [id, prefs] of this.preferences.entries()) {
      if (id === userId) continue;

      const score = this.calculateSimilarity(target, prefs);
      similarities.push({ id, score });
    }

    return similarities
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.id);
  }

  /**
   * Calculate similarity between two preference sets
   */
  calculateSimilarity(
    prefs1: UserPreferences,
    prefs2: UserPreferences
  ): number {
    let similarity = 0;
    let totalWeight = 0;

    // Layout (30%)
    if (prefs1.layout.preferred === prefs2.layout.preferred) similarity += 0.15;
    if (prefs1.layout.density === prefs2.layout.density) similarity += 0.1;
    if (prefs1.layout.alignment === prefs2.layout.alignment) similarity += 0.05;
    totalWeight += 0.3;

    // Visual (25%)
    if (prefs1.visual.theme === prefs2.visual.theme) similarity += 0.15;
    if (prefs1.visual.primaryColor === prefs2.visual.primaryColor)
      similarity += 0.05;
    if (prefs1.visual.accentColor === prefs2.visual.accentColor)
      similarity += 0.05;
    totalWeight += 0.25;

    // Typography (20%)
    if (prefs1.typography.fontFamily === prefs2.typography.fontFamily)
      similarity += 0.1;
    if (prefs1.typography.fontSize === prefs2.typography.fontSize)
      similarity += 0.1;
    totalWeight += 0.2;

    // Navigation (25%)
    if (prefs1.navigation.style === prefs2.navigation.style) similarity += 0.1;
    if (prefs1.navigation.position === prefs2.navigation.position)
      similarity += 0.1;
    if (prefs1.navigation.sticky === prefs2.navigation.sticky)
      similarity += 0.05;
    totalWeight += 0.25;

    return totalWeight > 0 ? similarity / totalWeight : 0;
  }

  /**
   * Export all preferences
   */
  exportAll(): UserPreferences[] {
    return Array.from(this.preferences.values());
  }

  /**
   * Import preferences
   */
  import(preferences: UserPreferences[]): void {
    for (const prefs of preferences) {
      this.preferences.set(prefs.userId, prefs);
    }
  }

  /**
   * Get model statistics
   */
  getStatistics(): ModelStatistics {
    const allPrefs = Array.from(this.preferences.values());

    // Count preference types
    const layoutCounts = new Map<string, number>();
    const themeCounts = new Map<string, number>();
    const densityCounts = new Map<string, number>();

    for (const prefs of allPrefs) {
      layoutCounts.set(
        prefs.layout.preferred,
        (layoutCounts.get(prefs.layout.preferred) ?? 0) + 1
      );
      themeCounts.set(
        prefs.visual.theme,
        (themeCounts.get(prefs.visual.theme) ?? 0) + 1
      );
      densityCounts.set(
        prefs.layout.density,
        (densityCounts.get(prefs.layout.density) ?? 0) + 1
      );
    }

    // Calculate average confidence
    const avgConfidence =
      allPrefs.length > 0
        ? allPrefs.reduce((sum, p) => sum + p.overallConfidence, 0) /
          allPrefs.length
        : 0;

    return {
      totalUsers: this.preferences.size,
      totalInteractions: Array.from(this.interactions.values()).reduce(
        (sum, arr) => sum + arr.length,
        0
      ),
      totalFeedback: Array.from(this.feedback.values()).reduce(
        (sum, arr) => sum + arr.length,
        0
      ),
      avgConfidence,
      layoutDistribution: Object.fromEntries(layoutCounts),
      themeDistribution: Object.fromEntries(themeCounts),
      densityDistribution: Object.fromEntries(densityCounts),
    };
  }

  /**
   * Validate model performance
   */
  validate(): ValidationMetrics {
    const allPrefs = Array.from(this.preferences.values());

    if (allPrefs.length === 0) {
      return {
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1Score: 0,
        sampleSize: 0,
      };
    }

    // Calculate metrics based on confidence
    const highConfidence = allPrefs.filter(
      p => p.overallConfidence > 0.7
    ).length;
    const accuracy = highConfidence / allPrefs.length;

    // For simplicity, use confidence as proxy for precision/recall
    const precision = accuracy;
    const recall = accuracy;
    const f1Score =
      precision + recall > 0
        ? (2 * precision * recall) / (precision + recall)
        : 0;

    return {
      accuracy,
      precision,
      recall,
      f1Score,
      sampleSize: allPrefs.length,
    };
  }

  /**
   * Get preferences by criteria
   */
  findByCriteria(
    predicate: (prefs: UserPreferences) => boolean
  ): UserPreferences[] {
    const results: UserPreferences[] = [];

    for (const prefs of this.preferences.values()) {
      if (predicate(prefs)) {
        results.push(prefs);
      }
    }

    return results;
  }

  /**
   * Get users with specific layout preference
   */
  getUsersByLayout(layout: string): string[] {
    return this.findByCriteria(p => p.layout.preferred === layout).map(
      p => p.userId
    );
  }

  /**
   * Get users with specific theme preference
   */
  getUsersByTheme(theme: string): string[] {
    return this.findByCriteria(p => p.visual.theme === theme).map(
      p => p.userId
    );
  }

  /**
   * Delete user data
   */
  deleteUser(userId: string): void {
    this.preferences.delete(userId);
    this.interactions.delete(userId);
    this.feedback.delete(userId);
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.preferences.clear();
    this.interactions.clear();
    this.feedback.clear();
  }

  /**
   * Get user count
   */
  getUserCount(): number {
    return this.preferences.size;
  }

  /**
   * Convert to model definition
   */
  toModelDef(): ModelDef {
    const metrics = this.validate();

    return {
      id: "preference-model-v1",
      name: "UI Preference Model",
      version: "1.0.0",
      type: "preference",
      parameters: {
        updateFrequency: this.config.updateFrequency,
        minDataPoints: this.config.minDataPoints,
        validationSplit: this.config.validationSplit,
      },
      performance: {
        accuracy: metrics.accuracy,
        precision: metrics.precision,
        recall: metrics.recall,
        f1Score: metrics.f1Score,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
}

export interface ModelStatistics {
  totalUsers: number;
  totalInteractions: number;
  totalFeedback: number;
  avgConfidence: number;
  layoutDistribution: Record<string, number>;
  themeDistribution: Record<string, number>;
  densityDistribution: Record<string, number>;
}

export interface ValidationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  sampleSize: number;
}

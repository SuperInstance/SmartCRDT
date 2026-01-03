/**
 * HybridRecommender - Hybrid recommender combining collaborative and content-based
 */

import type {
  RecommendedItem,
  UserPreferences,
  RecommenderConfig,
} from "../types.js";
import { CollaborativeFilter } from "./CollaborativeFilter.js";
import { ContentBasedFilter, ItemFeatures } from "./ContentBased.js";

export interface HybridConfig {
  collaborativeWeight: number; // Weight for collaborative filtering
  contentBasedWeight: number; // Weight for content-based filtering
  switchingThreshold?: number; // Threshold for switching strategies
  fallbackStrategy: "collaborative" | "content_based" | "weighted";
}

export class HybridRecommender {
  private collaborative: CollaborativeFilter;
  private contentBased: ContentBasedFilter;
  private config: HybridConfig;
  private recommenderConfig: RecommenderConfig;

  constructor(
    config: Partial<HybridConfig> = {},
    recommenderConfig: Partial<RecommenderConfig> = {}
  ) {
    this.config = {
      collaborativeWeight: config.collaborativeWeight ?? 0.5,
      contentBasedWeight: config.contentBasedWeight ?? 0.5,
      switchingThreshold: config.switchingThreshold ?? 0.3,
      fallbackStrategy: config.fallbackStrategy ?? "weighted",
    };

    this.recommenderConfig = {
      strategy: "hybrid",
      diversity: recommenderConfig.diversity ?? 0.3,
      novelty: recommenderConfig.novelty ?? 0.5,
      serendipity: recommenderConfig.serendipity ?? 0.2,
      maxRecommendations: recommenderConfig.maxRecommendations ?? 10,
    };

    this.collaborative = new CollaborativeFilter();
    this.contentBased = new ContentBasedFilter();
  }

  /**
   * Generate hybrid recommendations
   */
  recommend(
    userId: string,
    numRecommendations: number = 10,
    options: {
      excludeSeen?: boolean;
      enforceDiversity?: boolean;
      customWeights?: { collaborative: number; contentBased: number };
    } = {}
  ): RecommendedItem[] {
    const {
      excludeSeen = true,
      enforceDiversity = true,
      customWeights,
    } = options;

    // Get collaborative recommendations
    const collabResult = this.collaborative.recommend(
      userId,
      numRecommendations * 2
    );
    const collabItems = collabResult.items;

    // Get content-based recommendations
    const contentItems = this.contentBased.recommend(
      userId,
      numRecommendations * 2,
      excludeSeen
    );

    // Combine with weights
    const collabWeight =
      customWeights?.collaborative ?? this.config.collaborativeWeight;
    const contentWeight =
      customWeights?.contentBased ?? this.config.contentBasedWeight;

    const combined = this.combineRecommendations(
      collabItems,
      contentItems,
      collabWeight,
      contentWeight
    );

    // Apply diversity if requested
    let finalItems = combined;
    if (enforceDiversity) {
      finalItems = this.applyDiversity(
        combined.slice(0, numRecommendations * 2),
        this.recommenderConfig.diversity
      );
    }

    // Apply novelty
    finalItems = this.applyNovelty(
      finalItems,
      this.recommenderConfig.novelty,
      userId
    );

    // Sort by final score and limit
    const sorted = finalItems
      .sort((a, b) => b.score - a.score)
      .slice(0, numRecommendations);

    // Update confidence
    const avgConfidence =
      (collabResult.confidence + this.calculateContentConfidence(userId)) / 2;

    return sorted.map(item => ({
      ...item,
      confidence: avgConfidence,
    }));
  }

  /**
   * Combine recommendations from both methods
   */
  private combineRecommendations(
    collabItems: RecommendedItem[],
    contentItems: RecommendedItem[],
    collabWeight: number,
    contentWeight: number
  ): RecommendedItem[] {
    const combined = new Map<string, RecommendedItem>();

    // Add collaborative items
    for (const item of collabItems) {
      const score = item.score * collabWeight;
      combined.set(item.id, {
        ...item,
        score,
        reason: item.reason + " (collaborative)",
      });
    }

    // Add content-based items
    for (const item of contentItems) {
      const existing = combined.get(item.id);

      if (existing) {
        // Merge scores
        existing.score += item.score * contentWeight;
        existing.reason += " + " + item.reason;
      } else {
        combined.set(item.id, {
          ...item,
          score: item.score * contentWeight,
          reason: item.reason + " (content-based)",
        });
      }
    }

    return Array.from(combined.values());
  }

  /**
   * Apply diversity to recommendations
   */
  private applyDiversity(
    items: RecommendedItem[],
    diversity: number
  ): RecommendedItem[] {
    if (diversity <= 0) return items;

    const diversified: RecommendedItem[] = [];
    const usedTypes = new Set<string>();
    const maxSameType = Math.max(1, Math.floor(items.length * (1 - diversity)));

    for (const item of items) {
      const typeCount = diversified.filter(i => i.type === item.type).length;

      if (typeCount < maxSameType || !usedTypes.has(item.type)) {
        diversified.push(item);
        usedTypes.add(item.type);

        if (diversified.length >= items.length) break;
      }
    }

    return diversified;
  }

  /**
   * Apply novelty to recommendations
   */
  private applyNovelty(
    items: RecommendedItem[],
    novelty: number,
    userId: string
  ): RecommendedItem[] {
    if (novelty <= 0) return items;

    // Get user's item history for novelty calculation
    const userRatings = this.collaborative.getUserRatings(userId);
    const seenItemTypes = new Set<string>();

    for (const itemId of userRatings.keys()) {
      const seenItem = this.contentBased["items"].get(itemId);
      if (seenItem) {
        seenItemTypes.add(seenItem.type);
      }
    }

    // Adjust scores based on novelty
    return items.map(item => {
      const isNovel = !seenItemTypes.has(item.type);

      if (isNovel) {
        const noveltyBoost = novelty * 0.5;
        return {
          ...item,
          score: item.score * (1 + noveltyBoost),
          reason: item.reason + " (novel)",
        };
      }

      return item;
    });
  }

  /**
   * Calculate content-based confidence
   */
  private calculateContentConfidence(userId: string): number {
    const profile = this.contentBased.getUserProfile(userId);

    if (!profile) return 0;

    const featureCount = profile.features.size;
    return Math.min(featureCount / 50, 1);
  }

  /**
   * Switch-based recommendation
   */
  recommendSwitching(
    userId: string,
    numRecommendations: number = 10
  ): RecommendedItem[] {
    const collabResult = this.collaborative.recommend(
      userId,
      numRecommendations
    );
    const contentItems = this.contentBased.recommend(
      userId,
      numRecommendations
    );

    // Switch based on confidence
    const threshold = this.config.switchingThreshold ?? 0.3;

    if (collabResult.confidence < threshold) {
      // Use content-based when collaborative confidence is low
      return contentItems;
    }

    // Use collaborative when confidence is high
    return collabResult.items;
  }

  /**
   * Weighted hybrid with dynamic weights
   */
  recommendDynamicWeight(
    userId: string,
    numRecommendations: number = 10
  ): RecommendedItem[] {
    // Calculate dynamic weights based on data availability
    const userRatings = this.collaborative.getUserRatings(userId);
    const userProfile = this.contentBased.getUserProfile(userId);

    const ratingCount = userRatings.size;
    const featureCount = userProfile?.features.size ?? 0;

    // More ratings -> higher collaborative weight
    // More features -> higher content weight
    const total = ratingCount + featureCount;

    let collabWeight = 0.5;
    let contentWeight = 0.5;

    if (total > 0) {
      collabWeight = ratingCount / total;
      contentWeight = featureCount / total;
    }

    return this.recommend(userId, numRecommendations, {
      customWeights: {
        collaborative: collabWeight,
        contentBased: contentWeight,
      },
    });
  }

  /**
   * Cascade hybrid (try collaborative, fall back to content-based)
   */
  recommendCascade(
    userId: string,
    numRecommendations: number = 10
  ): RecommendedItem[] {
    // Try collaborative first
    const collabResult = this.collaborative.recommend(
      userId,
      numRecommendations
    );

    if (collabResult.items.length >= numRecommendations) {
      return collabResult.items;
    }

    // Not enough collaborative recommendations, fill with content-based
    const contentItems = this.contentBased.recommend(
      userId,
      numRecommendations - collabResult.items.length
    );

    return [...collabResult.items, ...contentItems];
  }

  /**
   * Explain recommendation
   */
  explainRecommendation(userId: string, itemId: string): string | null {
    // Get collaborative score
    const collabItems = this.collaborative.recommend(userId, 100);
    const collabItem = collabItems.items.find(i => i.id === itemId);

    // Get content-based score
    const contentItems = this.contentBased.recommend(userId, 100);
    const contentItem = contentItems.find(i => i.id === itemId);

    if (!collabItem && !contentItem) {
      return null;
    }

    const reasons: string[] = [];

    if (collabItem) {
      reasons.push(
        `Similar users liked this (confidence: ${collabItem.confidence.toFixed(2)})`
      );
    }

    if (contentItem) {
      reasons.push(contentItem.reason);
    }

    return reasons.join(". ");
  }

  /**
   * Get similar users
   */
  getSimilarUsers(userId: string, limit: number = 10): string[] {
    return this.collaborative
      .findSimilarUsers(userId)
      .slice(0, limit)
      .map(s => s.userId);
  }

  /**
   * Get similar items
   */
  getSimilarItems(
    itemId: string,
    limit: number = 10
  ): Array<{ itemId: string; similarity: number }> {
    return this.contentBased.findSimilarItems(itemId, limit);
  }

  /**
   * Add item to content-based
   */
  addItem(item: ItemFeatures): void {
    this.contentBased.addItem(item);
  }

  /**
   * Add rating to collaborative
   */
  addRating(userId: string, itemId: string, rating: number): void {
    this.collaborative.addRating({
      userId,
      itemId,
      rating,
      timestamp: Date.now(),
    });
  }

  /**
   * Record interaction (affects both)
   */
  recordInteraction(userId: string, itemId: string, rating: number = 1): void {
    // Add to collaborative
    this.addRating(userId, itemId, rating);

    // Extract features and add to content-based
    // Note: In real implementation, you'd have full item/interaction data
  }

  /**
   * Record feedback
   */
  recordFeedback(userId: string, itemId: string, like: boolean): void {
    this.contentBased.recordFeedback(userId, itemId, like);

    // Convert feedback to rating for collaborative
    const rating = like ? 5 : 1;
    this.addRating(userId, itemId, rating);
  }

  /**
   * Update from user preferences
   */
  updateFromPreferences(userId: string, preferences: UserPreferences): void {
    this.contentBased.updateFromPreferences(userId, preferences);
  }

  /**
   * Get comprehensive statistics
   */
  getStatistics(): {
    collaborative: ReturnType<CollaborativeFilter["getStatistics"]>;
    contentBased: ReturnType<ContentBasedFilter["getStatistics"]>;
  } {
    return {
      collaborative: this.collaborative.getStatistics(),
      contentBased: this.contentBased.getStatistics(),
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.collaborative.clear();
    this.contentBased.clear();
  }

  /**
   * Set configuration
   */
  setConfig(config: Partial<HybridConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get configuration
   */
  getConfig(): HybridConfig {
    return { ...this.config };
  }
}

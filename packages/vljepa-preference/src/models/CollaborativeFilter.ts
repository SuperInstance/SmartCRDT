/**
 * CollaborativeFilter - Collaborative filtering for recommendations
 */

import type {
  UserRating,
  CollaborativeConfig,
  CollaborativeMethod,
  SimilarityScore,
  Recommendation,
  RecommendedItem,
  UserPreferences,
} from "../types.js";

export class CollaborativeFilter {
  private config: CollaborativeConfig;
  private ratings: Map<string, Map<string, number>> = new Map(); // userId -> itemId -> rating
  private itemRatings: Map<string, Map<string, number>> = new Map(); // itemId -> userId -> rating
  private userMeans: Map<string, number> = new Map();
  private itemMeans: Map<string, number> = new Map();

  constructor(config: Partial<CollaborativeConfig> = {}) {
    this.config = {
      method: config.method ?? "user_based",
      neighbors: config.neighbors ?? 10,
      minOverlap: config.minOverlap ?? 2,
      factors: config.factors ?? 10,
      iterations: config.iterations ?? 20,
      regularization: config.regularization ?? 0.01,
    };
  }

  /**
   * Add a rating
   */
  addRating(rating: UserRating): void {
    const { userId, itemId, rating: value } = rating;

    // Store by user
    if (!this.ratings.has(userId)) {
      this.ratings.set(userId, new Map());
    }
    this.ratings.get(userId)!.set(itemId, value);

    // Store by item
    if (!this.itemRatings.has(itemId)) {
      this.itemRatings.set(itemId, new Map());
    }
    this.itemRatings.get(itemId)!.set(userId, value);

    // Update means
    this.updateMeans();
  }

  /**
   * Add multiple ratings
   */
  addRatings(ratings: UserRating[]): void {
    for (const rating of ratings) {
      this.addRating(rating);
    }
  }

  /**
   * Get rating for a user-item pair
   */
  getRating(userId: string, itemId: string): number | null {
    const userRatings = this.ratings.get(userId);
    return userRatings?.get(itemId) ?? null;
  }

  /**
   * Get all ratings for a user
   */
  getUserRatings(userId: string): Map<string, number> {
    return this.ratings.get(userId) ?? new Map();
  }

  /**
   * Get all ratings for an item
   */
  getItemRatings(itemId: string): Map<string, number> {
    return this.itemRatings.get(itemId) ?? new Map();
  }

  /**
   * Update user and item means
   */
  private updateMeans(): void {
    // Calculate user means
    for (const [userId, userRatings] of this.ratings.entries()) {
      const ratings = Array.from(userRatings.values());
      const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      this.userMeans.set(userId, mean);
    }

    // Calculate item means
    for (const [itemId, itemRatings] of this.itemRatings.entries()) {
      const ratings = Array.from(itemRatings.values());
      const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      this.itemMeans.set(itemId, mean);
    }
  }

  /**
   * Calculate similarity between users
   */
  calculateUserSimilarity(user1: string, user2: string): number {
    const ratings1 = this.ratings.get(user1);
    const ratings2 = this.ratings.get(user2);

    if (!ratings1 || !ratings2) return 0;

    // Find common items
    const commonItems: string[] = [];
    for (const itemId of ratings1.keys()) {
      if (ratings2.has(itemId)) {
        commonItems.push(itemId);
      }
    }

    if (commonItems.length < this.config.minOverlap) return 0;

    // Calculate Pearson correlation
    const mean1 = this.userMeans.get(user1) ?? 0;
    const mean2 = this.userMeans.get(user2) ?? 0;

    let numerator = 0;
    let denom1 = 0;
    let denom2 = 0;

    for (const itemId of commonItems) {
      const diff1 = (ratings1.get(itemId) ?? 0) - mean1;
      const diff2 = (ratings2.get(itemId) ?? 0) - mean2;

      numerator += diff1 * diff2;
      denom1 += diff1 * diff1;
      denom2 += diff2 * diff2;
    }

    const denominator = Math.sqrt(denom1) * Math.sqrt(denom2);
    return denominator > 0 ? numerator / denominator : 0;
  }

  /**
   * Calculate similarity between items
   */
  calculateItemSimilarity(item1: string, item2: string): number {
    const ratings1 = this.itemRatings.get(item1);
    const ratings2 = this.itemRatings.get(item2);

    if (!ratings1 || !ratings2) return 0;

    // Find common users
    const commonUsers: string[] = [];
    for (const userId of ratings1.keys()) {
      if (ratings2.has(userId)) {
        commonUsers.push(userId);
      }
    }

    if (commonUsers.length < this.config.minOverlap) return 0;

    // Calculate Pearson correlation
    const mean1 = this.itemMeans.get(item1) ?? 0;
    const mean2 = this.itemMeans.get(item2) ?? 0;

    let numerator = 0;
    let denom1 = 0;
    let denom2 = 0;

    for (const userId of commonUsers) {
      const diff1 = (ratings1.get(userId) ?? 0) - mean1;
      const diff2 = (ratings2.get(userId) ?? 0) - mean2;

      numerator += diff1 * diff2;
      denom1 += diff1 * diff1;
      denom2 += diff2 * diff2;
    }

    const denominator = Math.sqrt(denom1) * Math.sqrt(denom2);
    return denominator > 0 ? numerator / denominator : 0;
  }

  /**
   * Find similar users
   */
  findSimilarUsers(userId: string): SimilarityScore[] {
    const similarities: SimilarityScore[] = [];

    for (const otherId of this.ratings.keys()) {
      if (otherId === userId) continue;

      const similarity = this.calculateUserSimilarity(userId, otherId);

      // Count common items
      const userRatings = this.ratings.get(userId);
      const otherRatings = this.ratings.get(otherId);
      let commonItems = 0;

      if (userRatings && otherRatings) {
        for (const itemId of userRatings.keys()) {
          if (otherRatings.has(itemId)) commonItems++;
        }
      }

      if (similarity > 0 && commonItems >= this.config.minOverlap) {
        similarities.push({
          userId: otherId,
          similarity,
          commonItems,
        });
      }
    }

    return similarities.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Find similar items
   */
  findSimilarItems(
    itemId: string
  ): Array<{ itemId: string; similarity: number; commonUsers: number }> {
    const similarities: Array<{
      itemId: string;
      similarity: number;
      commonUsers: number;
    }> = [];

    for (const otherId of this.itemRatings.keys()) {
      if (otherId === itemId) continue;

      const similarity = this.calculateItemSimilarity(itemId, otherId);

      // Count common users
      const itemRatings = this.itemRatings.get(itemId);
      const otherRatings = this.itemRatings.get(otherId);
      let commonUsers = 0;

      if (itemRatings && otherRatings) {
        for (const userId of itemRatings.keys()) {
          if (otherRatings.has(userId)) commonUsers++;
        }
      }

      if (similarity > 0 && commonUsers >= this.config.minOverlap) {
        similarities.push({
          itemId: otherId,
          similarity,
          commonUsers,
        });
      }
    }

    return similarities.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Generate recommendations for a user
   */
  recommend(userId: string, numRecommendations: number = 10): Recommendation {
    const method = this.config.method;

    let items: RecommendedItem[] = [];
    let confidence = 0;

    switch (method) {
      case "user_based":
        items = this.userBasedRecommend(userId, numRecommendations);
        break;
      case "item_based":
        items = this.itemBasedRecommend(userId, numRecommendations);
        break;
      case "matrix_factorization":
        items = this.matrixFactorizationRecommend(userId, numRecommendations);
        break;
    }

    // Calculate confidence based on ratings count
    const userRatings = this.ratings.get(userId);
    const ratingCount = userRatings?.size ?? 0;
    confidence = Math.min(ratingCount / 50, 1);

    return {
      userId,
      items,
      method,
      confidence,
      timestamp: Date.now(),
    };
  }

  /**
   * User-based recommendations
   */
  private userBasedRecommend(userId: string, num: number): RecommendedItem[] {
    const similarUsers = this.findSimilarUsers(userId).slice(
      0,
      this.config.neighbors
    );
    const userRatings = this.ratings.get(userId) ?? new Map();
    const userMean = this.userMeans.get(userId) ?? 0;

    // Score items not yet rated by user
    const itemScores = new Map<string, { score: number; count: number }>();

    for (const { userId: similarUserId, similarity } of similarUsers) {
      const similarUserRatings = this.ratings.get(similarUserId);
      if (!similarUserRatings) continue;

      const similarUserMean = this.userMeans.get(similarUserId) ?? 0;

      for (const [itemId, rating] of similarUserRatings.entries()) {
        // Skip if user already rated this item
        if (userRatings.has(itemId)) continue;

        const adjustedScore = similarity * (rating - similarUserMean);

        const existing = itemScores.get(itemId);
        if (existing) {
          existing.score += adjustedScore;
          existing.count++;
        } else {
          itemScores.set(itemId, { score: adjustedScore, count: 1 });
        }
      }
    }

    // Convert to recommendations
    const recommendations: RecommendedItem[] = [];

    for (const [itemId, { score, count }] of itemScores.entries()) {
      const predictedRating = userMean + (count > 0 ? score / count : 0);
      const confidence = Math.min(count / this.config.neighbors, 1);

      recommendations.push({
        id: itemId,
        type: "item",
        score: predictedRating,
        confidence,
        reason: `Similar users liked this`,
      });
    }

    return recommendations.sort((a, b) => b.score - a.score).slice(0, num);
  }

  /**
   * Item-based recommendations
   */
  private itemBasedRecommend(userId: string, num: number): RecommendedItem[] {
    const userRatings = this.ratings.get(userId) ?? new Map();

    // Score items not yet rated by user
    const itemScores = new Map<string, { score: number; count: number }>();

    for (const [ratedItemId, rating] of userRatings.entries()) {
      const similarItems = this.findSimilarItems(ratedItemId);

      for (const { itemId: similarItemId, similarity } of similarItems) {
        // Skip if user already rated this item
        if (userRatings.has(similarItemId)) continue;

        const score = rating * similarity;

        const existing = itemScores.get(similarItemId);
        if (existing) {
          existing.score += score;
          existing.count++;
        } else {
          itemScores.set(similarItemId, { score, count: 1 });
        }
      }
    }

    // Convert to recommendations
    const recommendations: RecommendedItem[] = [];

    for (const [itemId, { score, count }] of itemScores.entries()) {
      const predictedRating = count > 0 ? score / count : 0;
      const confidence = Math.min(count / userRatings.size, 1);

      recommendations.push({
        id: itemId,
        type: "item",
        score: predictedRating,
        confidence,
        reason: `Similar to items you liked`,
      });
    }

    return recommendations.sort((a, b) => b.score - a.score).slice(0, num);
  }

  /**
   * Matrix factorization recommendations (simplified)
   */
  private matrixFactorizationRecommend(
    userId: string,
    num: number
  ): RecommendedItem[] {
    // Simplified matrix factorization using user/item means
    // In production, use proper SVD or ALS

    const userMean = this.userMeans.get(userId) ?? 0;
    const userRatings = this.ratings.get(userId) ?? new Map();

    const recommendations: RecommendedItem[] = [];

    // Predict rating for all unrated items
    for (const [itemId, itemMean] of this.itemMeans.entries()) {
      if (userRatings.has(itemId)) continue;

      // Simple prediction: average of user mean and item mean
      const predictedRating = (userMean + itemMean) / 2;
      const ratingCount = this.itemRatings.get(itemId)?.size ?? 0;
      const confidence = Math.min(ratingCount / 10, 1);

      recommendations.push({
        id: itemId,
        type: "item",
        score: predictedRating,
        confidence,
        reason: `Based on your preferences`,
      });
    }

    return recommendations.sort((a, b) => b.score - a.score).slice(0, num);
  }

  /**
   * Export all ratings
   */
  exportRatings(): UserRating[] {
    const ratings: UserRating[] = [];

    for (const [userId, userRatings] of this.ratings.entries()) {
      for (const [itemId, rating] of userRatings.entries()) {
        ratings.push({
          userId,
          itemId,
          rating,
          timestamp: Date.now(),
        });
      }
    }

    return ratings;
  }

  /**
   * Clear all ratings
   */
  clear(): void {
    this.ratings.clear();
    this.itemRatings.clear();
    this.userMeans.clear();
    this.itemMeans.clear();
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalUsers: number;
    totalItems: number;
    totalRatings: number;
    avgRating: number;
    sparsity: number;
  } {
    let totalRatings = 0;
    let ratingSum = 0;

    for (const userRatings of this.ratings.values()) {
      for (const rating of userRatings.values()) {
        totalRatings++;
        ratingSum += rating;
      }
    }

    const totalUsers = this.ratings.size;
    const totalItems = this.itemRatings.size;
    const possibleRatings = totalUsers * totalItems;
    const sparsity =
      possibleRatings > 0 ? 1 - totalRatings / possibleRatings : 1;
    const avgRating = totalRatings > 0 ? ratingSum / totalRatings : 0;

    return {
      totalUsers,
      totalItems,
      totalRatings,
      avgRating,
      sparsity,
    };
  }

  /**
   * Set configuration
   */
  setConfig(config: Partial<CollaborativeConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get configuration
   */
  getConfig(): CollaborativeConfig {
    return { ...this.config };
  }
}

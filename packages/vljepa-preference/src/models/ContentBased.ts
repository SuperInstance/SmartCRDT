/**
 * ContentBased - Content-based filtering for recommendations
 */

import type {
  UserPreferences,
  RecommendedItem,
  UIElement,
  Interaction,
  Feedback,
} from "../types.js";

export interface ItemFeatures {
  id: string;
  type: string;
  layout?: string;
  theme?: string;
  color?: string;
  tags?: string[];
  attributes?: Record<string, unknown>;
}

export interface UserProfile {
  userId: string;
  features: Map<string, number>; // feature -> weight
  likes: string[];
  dislikes: string[];
  lastUpdated: number;
}

export class ContentBasedFilter {
  private items: Map<string, ItemFeatures> = new Map();
  private profiles: Map<string, UserProfile> = new Map();
  private interactions: Map<string, Interaction[]> = new Map();

  /**
   * Add an item with features
   */
  addItem(item: ItemFeatures): void {
    this.items.set(item.id, item);
  }

  /**
   * Add multiple items
   */
  addItems(items: ItemFeatures[]): void {
    for (const item of items) {
      this.addItem(item);
    }
  }

  /**
   * Record user interaction
   */
  recordInteraction(userId: string, interaction: Interaction): void {
    if (!this.interactions.has(userId)) {
      this.interactions.set(userId, []);
    }
    this.interactions.get(userId)!.push(interaction);

    // Update profile
    this.updateProfileFromInteraction(userId, interaction);
  }

  /**
   * Update user profile from interaction
   */
  private updateProfileFromInteraction(
    userId: string,
    interaction: Interaction
  ): void {
    let profile = this.profiles.get(userId);

    if (!profile) {
      profile = {
        userId,
        features: new Map(),
        likes: [],
        dislikes: [],
        lastUpdated: Date.now(),
      };
      this.profiles.set(userId, profile);
    }

    // Extract features from interaction
    const features = this.extractFeatures(interaction);

    // Update feature weights (implicit feedback)
    const weight = this.calculateImplicitWeight(interaction);

    for (const [feature, value] of Object.entries(features)) {
      const currentWeight = profile.features.get(feature) ?? 0;
      profile.features.set(feature, currentWeight + value * weight);
    }

    profile.lastUpdated = Date.now();
  }

  /**
   * Extract features from interaction
   */
  private extractFeatures(interaction: Interaction): Record<string, number> {
    const features: Record<string, number> = {};

    // Element type
    features[`type:${interaction.element.type}`] = 1;

    // Element class name
    if (interaction.element.className) {
      const classes = interaction.element.className.split(" ").filter(Boolean);
      for (const cls of classes) {
        features[`class:${cls}`] = 1;
      }
    }

    // Element attributes
    if (interaction.element.attributes) {
      for (const [key, value] of Object.entries(
        interaction.element.attributes
      )) {
        if (typeof value === "string") {
          features[`attr:${key}:${value}`] = 0.5;
        } else if (typeof value === "boolean") {
          features[`attr:${key}:${value}`] = 0.3;
        }
      }
    }

    // Context features
    features[`page:${interaction.context.page}`] = 0.5;

    // Interaction type
    features[`action:${interaction.type}`] = 0.3;

    return features;
  }

  /**
   * Calculate implicit feedback weight
   */
  private calculateImplicitWeight(interaction: Interaction): number {
    let weight = 1;

    // Click has higher weight
    if (interaction.type === "click") {
      weight = 2;
    }

    // Hover duration indicates interest
    if (interaction.type === "hover" && interaction.duration) {
      weight = Math.min(interaction.duration / 1000, 3);
    }

    // Dwell time indicates more interest
    if (interaction.duration && interaction.duration > 5000) {
      weight *= 1.5;
    }

    return weight;
  }

  /**
   * Record explicit feedback
   */
  recordFeedback(userId: string, itemId: string, like: boolean): void {
    let profile = this.profiles.get(userId);

    if (!profile) {
      profile = {
        userId,
        features: new Map(),
        likes: [],
        dislikes: [],
        lastUpdated: Date.now(),
      };
      this.profiles.set(userId, profile);
    }

    if (like) {
      if (!profile.likes.includes(itemId)) {
        profile.likes.push(itemId);
      }

      // Add features from liked item
      const item = this.items.get(itemId);
      if (item) {
        const itemFeatures = this.itemToFeatures(item);
        for (const [feature, weight] of Object.entries(itemFeatures)) {
          const current = profile.features.get(feature) ?? 0;
          profile.features.set(feature, current + weight);
        }
      }
    } else {
      if (!profile.dislikes.includes(itemId)) {
        profile.dislikes.push(itemId);
      }

      // Subtract features from disliked item
      const item = this.items.get(itemId);
      if (item) {
        const itemFeatures = this.itemToFeatures(item);
        for (const [feature, weight] of Object.entries(itemFeatures)) {
          const current = profile.features.get(feature) ?? 0;
          profile.features.set(feature, current - weight);
        }
      }
    }

    profile.lastUpdated = Date.now();
  }

  /**
   * Convert item to feature map
   */
  private itemToFeatures(item: ItemFeatures): Record<string, number> {
    const features: Record<string, number> = {};

    features[`type:${item.type}`] = 1;

    if (item.layout) {
      features[`layout:${item.layout}`] = 1;
    }

    if (item.theme) {
      features[`theme:${item.theme}`] = 1;
    }

    if (item.color) {
      features[`color:${item.color}`] = 0.5;
    }

    if (item.tags) {
      for (const tag of item.tags) {
        features[`tag:${tag}`] = 0.7;
      }
    }

    if (item.attributes) {
      for (const [key, value] of Object.entries(item.attributes)) {
        if (typeof value === "string" || typeof value === "boolean") {
          features[`attr:${key}:${value}`] = 0.3;
        }
      }
    }

    return features;
  }

  /**
   * Calculate similarity between item and user profile
   */
  private calculateSimilarity(
    item: ItemFeatures,
    profile: UserProfile
  ): number {
    const itemFeatures = this.itemToFeatures(item);
    let dotProduct = 0;
    let itemNorm = 0;

    for (const [feature, weight] of Object.entries(itemFeatures)) {
      const profileWeight = profile.features.get(feature) ?? 0;
      dotProduct += profileWeight * weight;
      itemNorm += weight * weight;
    }

    // Calculate profile norm
    let profileNorm = 0;
    for (const weight of profile.features.values()) {
      profileNorm += weight * weight;
    }

    const norm = Math.sqrt(profileNorm) * Math.sqrt(itemNorm);
    return norm > 0 ? dotProduct / norm : 0;
  }

  /**
   * Generate recommendations for a user
   */
  recommend(
    userId: string,
    numRecommendations: number = 10,
    excludeSeen: boolean = true
  ): RecommendedItem[] {
    const profile = this.profiles.get(userId);

    if (!profile) {
      return [];
    }

    const seenItems = new Set<string>();
    if (excludeSeen) {
      const userInteractions = this.interactions.get(userId) ?? [];
      for (const interaction of userInteractions) {
        seenItems.add(interaction.element.id);
      }

      for (const liked of profile.likes) {
        seenItems.add(liked);
      }
    }

    // Score all items
    const scoredItems: Array<{ id: string; score: number }> = [];

    for (const [itemId, item] of this.items.entries()) {
      if (seenItems.has(itemId)) continue;

      const score = this.calculateSimilarity(item, profile);
      scoredItems.push({ id: itemId, score });
    }

    // Sort by score and get top N
    scoredItems.sort((a, b) => b.score - a.score);

    return scoredItems.slice(0, numRecommendations).map(({ id, score }) => {
      const item = this.items.get(id)!;
      const confidence = this.calculateConfidence(profile);

      return {
        id,
        type: item.type,
        score,
        confidence,
        reason: this.generateReason(profile, item),
      };
    });
  }

  /**
   * Calculate recommendation confidence
   */
  private calculateConfidence(profile: UserProfile): number {
    // More interactions = higher confidence
    const featureCount = profile.features.size;
    return Math.min(featureCount / 50, 1);
  }

  /**
   * Generate explanation for recommendation
   */
  private generateReason(profile: UserProfile, item: ItemFeatures): string {
    const itemFeatures = this.itemToFeatures(item);
    const matches: string[] = [];

    for (const [feature, weight] of Object.entries(itemFeatures)) {
      if (profile.features.has(feature) && profile.features.get(feature)! > 0) {
        matches.push(feature);
      }
    }

    if (matches.length === 0) {
      return "Recommended based on your browsing patterns";
    }

    // Clean up feature names for display
    const displayMatches = matches
      .map(m => m.replace(/^(type:|layout:|theme:|tag:)/, ""))
      .slice(0, 3)
      .join(", ");

    return `Because you like: ${displayMatches}`;
  }

  /**
   * Find similar items
   */
  findSimilarItems(
    itemId: string,
    numItems: number = 10
  ): Array<{ itemId: string; similarity: number }> {
    const targetItem = this.items.get(itemId);

    if (!targetItem) {
      return [];
    }

    const targetFeatures = this.itemToFeatures(targetItem);
    const similarities: Array<{ itemId: string; similarity: number }> = [];

    for (const [id, item] of this.items.entries()) {
      if (id === itemId) continue;

      const itemFeatures = this.itemToFeatures(item);
      const similarity = this.cosineSimilarity(targetFeatures, itemFeatures);

      similarities.push({ itemId: id, similarity });
    }

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, numItems);
  }

  /**
   * Calculate cosine similarity between two feature maps
   */
  private cosineSimilarity(
    features1: Record<string, number>,
    features2: Record<string, number>
  ): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    const allFeatures = new Set([
      ...Object.keys(features1),
      ...Object.keys(features2),
    ]);

    for (const feature of allFeatures) {
      const v1 = features1[feature] ?? 0;
      const v2 = features2[feature] ?? 0;

      dotProduct += v1 * v2;
      norm1 += v1 * v1;
      norm2 += v2 * v2;
    }

    const norm = Math.sqrt(norm1) * Math.sqrt(norm2);
    return norm > 0 ? dotProduct / norm : 0;
  }

  /**
   * Get user profile
   */
  getUserProfile(userId: string): UserProfile | null {
    return this.profiles.get(userId) ?? null;
  }

  /**
   * Get top features for a user
   */
  getTopFeatures(
    userId: string,
    limit: number = 10
  ): Array<{ feature: string; weight: number }> {
    const profile = this.profiles.get(userId);

    if (!profile) {
      return [];
    }

    const features = Array.from(profile.features.entries())
      .map(([feature, weight]) => ({ feature, weight }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, limit);

    return features;
  }

  /**
   * Update user from preferences
   */
  updateFromPreferences(userId: string, preferences: UserPreferences): void {
    let profile = this.profiles.get(userId);

    if (!profile) {
      profile = {
        userId,
        features: new Map(),
        likes: [],
        dislikes: [],
        lastUpdated: Date.now(),
      };
      this.profiles.set(userId, profile);
    }

    // Add preference features
    const prefFeatures: Record<string, number> = {
      [`layout:${preferences.layout.preferred}`]: 2,
      [`density:${preferences.layout.density}`]: 1,
      [`theme:${preferences.visual.theme}`]: 2,
      [`color:${preferences.visual.primaryColor}`]: 1.5,
      [`navigation:${preferences.navigation.style}`]: 1,
    };

    for (const [feature, weight] of Object.entries(prefFeatures)) {
      const current = profile.features.get(feature) ?? 0;
      profile.features.set(feature, current + weight);
    }

    // Add component preferences
    for (const component of preferences.components.preferred) {
      profile.features.set(
        `component:${component}`,
        (profile.features.get(`component:${component}`) ?? 0) + 1
      );
    }

    for (const component of preferences.components.avoided) {
      profile.features.set(
        `component:${component}`,
        (profile.features.get(`component:${component}`) ?? 0) - 1
      );
    }

    profile.lastUpdated = Date.now();
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.items.clear();
    this.profiles.clear();
    this.interactions.clear();
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalItems: number;
    totalUsers: number;
    totalInteractions: number;
    avgFeaturesPerUser: number;
  } {
    let totalInteractions = 0;
    let totalFeatures = 0;

    for (const interactions of this.interactions.values()) {
      totalInteractions += interactions.length;
    }

    for (const profile of this.profiles.values()) {
      totalFeatures += profile.features.size;
    }

    return {
      totalItems: this.items.size,
      totalUsers: this.profiles.size,
      totalInteractions,
      avgFeaturesPerUser:
        this.profiles.size > 0 ? totalFeatures / this.profiles.size : 0,
    };
  }
}

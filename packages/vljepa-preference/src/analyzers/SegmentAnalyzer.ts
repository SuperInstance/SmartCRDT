/**
 * SegmentAnalyzer - Segments users based on preferences and behavior
 */

import type {
  UserPreferences,
  Interaction,
  Segment,
  Pattern,
} from "../types.js";

export interface SegmentCriteria {
  name: string;
  conditions: SegmentCondition[];
}

export type SegmentCondition =
  | LayoutCondition
  | VisualCondition
  | BehaviorCondition
  | DemographicCondition;

export interface LayoutCondition {
  type: "layout";
  property: "preferred" | "density" | "alignment";
  value: string;
  operator: "eq" | "ne" | "in";
}

export interface VisualCondition {
  type: "visual";
  property: "theme" | "primaryColor";
  value: string;
  operator: "eq" | "ne" | "in";
}

export interface BehaviorCondition {
  type: "behavior";
  property: "clickRate" | "scrollRate" | "dwellTime";
  value: number;
  operator: "gt" | "lt" | "gte" | "lte";
}

export interface DemographicCondition {
  type: "demographic";
  property: "device" | "location" | "language";
  value: string;
  operator: "eq" | "ne" | "in";
}

export interface UserCluster {
  id: string;
  users: string[];
  preferences: UserPreferences;
  similarity: number;
}

export class SegmentAnalyzer {
  private segments: Map<string, Segment> = new Map();
  private clusters: Map<string, UserCluster> = new Map();

  /**
   * Create segments based on user preferences
   */
  createSegments(
    users: Map<string, UserPreferences>,
    criteria: SegmentCriteria[]
  ): Segment[] {
    const segments: Segment[] = [];

    for (const criterion of criteria) {
      const matchedUsers: string[] = [];

      for (const [userId, preferences] of users.entries()) {
        if (this.matchesCriteria(preferences, criterion.conditions)) {
          matchedUsers.push(userId);
        }
      }

      if (matchedUsers.length > 0) {
        const segment: Segment = {
          id: `segment-${criterion.name.toLowerCase().replace(/\s+/g, "-")}`,
          name: criterion.name,
          criteria: criterion as unknown as Record<string, unknown>,
          users: matchedUsers,
          preferences: this.aggregatePreferences(matchedUsers, users),
          size: matchedUsers.length,
        };

        segments.push(segment);
        this.segments.set(segment.id, segment);
      }
    }

    return segments;
  }

  /**
   * Check if preferences match criteria
   */
  private matchesCriteria(
    preferences: UserPreferences,
    conditions: SegmentCondition[]
  ): boolean {
    for (const condition of conditions) {
      if (!this.matchesCondition(preferences, condition)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if preferences match a single condition
   */
  private matchesCondition(
    preferences: UserPreferences,
    condition: SegmentCondition
  ): boolean {
    switch (condition.type) {
      case "layout":
        return this.matchesLayoutCondition(preferences, condition);
      case "visual":
        return this.matchesVisualCondition(preferences, condition);
      case "behavior":
        return true; // Behavior would need interaction history
      case "demographic":
        return true; // Demographics would need user metadata
    }
  }

  /**
   * Match layout condition
   */
  private matchesLayoutCondition(
    preferences: UserPreferences,
    condition: LayoutCondition
  ): boolean {
    const value = preferences.layout[condition.property];

    switch (condition.operator) {
      case "eq":
        return value === condition.value;
      case "ne":
        return value !== condition.value;
      case "in":
        return (
          Array.isArray(condition.value) && condition.value.includes(value)
        );
    }
  }

  /**
   * Match visual condition
   */
  private matchesVisualCondition(
    preferences: UserPreferences,
    condition: VisualCondition
  ): boolean {
    const value = preferences.visual[condition.property];

    switch (condition.operator) {
      case "eq":
        return value === condition.value;
      case "ne":
        return value !== condition.value;
      case "in":
        return (
          Array.isArray(condition.value) && condition.value.includes(value)
        );
    }
  }

  /**
   * Aggregate preferences for a group of users
   */
  private aggregatePreferences(
    userIds: string[],
    allUsers: Map<string, UserPreferences>
  ): UserPreferences {
    if (userIds.length === 0) {
      throw new Error("Cannot aggregate empty user list");
    }

    const preferences = userIds
      .map(id => allUsers.get(id))
      .filter(Boolean) as UserPreferences[];

    // Average confidence values
    const avgLayoutConf =
      preferences.reduce((sum, p) => sum + p.layout.confidence, 0) /
      preferences.length;
    const avgVisualConf =
      preferences.reduce((sum, p) => sum + p.visual.confidence, 0) /
      preferences.length;
    const avgTypographyConf =
      preferences.reduce((sum, p) => sum + p.typography.confidence, 0) /
      preferences.length;
    const avgComponentConf =
      preferences.reduce((sum, p) => sum + p.components.confidence, 0) /
      preferences.length;
    const avgNavConf =
      preferences.reduce((sum, p) => sum + p.navigation.confidence, 0) /
      preferences.length;

    // Find most common values
    const layoutModes = this.getModes(preferences.map(p => p.layout.preferred));
    const densityModes = this.getModes(preferences.map(p => p.layout.density));
    const themeModes = this.getModes(preferences.map(p => p.visual.theme));

    return {
      userId: "segment-aggregate",
      layout: {
        preferred: layoutModes[0] ?? "grid",
        density: densityModes[0] ?? "normal",
        alignment: "center",
        confidence: avgLayoutConf,
      },
      visual: {
        theme: themeModes[0] ?? "light",
        primaryColor: "#007bff",
        accentColor: "#28a745",
        borderRadius: Math.round(
          preferences.reduce((sum, p) => sum + p.visual.borderRadius, 0) /
            preferences.length
        ),
        shadows: true,
        animations: true,
        confidence: avgVisualConf,
      },
      typography: {
        fontFamily: "system-ui",
        fontSize: "medium",
        lineHeight: 1.5,
        letterSpacing: 0,
        fontWeight: 400,
        confidence: avgTypographyConf,
      },
      components: {
        preferred: [],
        avoided: [],
        customizations: {},
        confidence: avgComponentConf,
      },
      navigation: {
        style: "sidebar",
        position: "left",
        sticky: true,
        collapsed: false,
        confidence: avgNavConf,
      },
      overallConfidence:
        (avgLayoutConf +
          avgVisualConf +
          avgTypographyConf +
          avgComponentConf +
          avgNavConf) /
        5,
      lastUpdated: Date.now(),
      version: 1,
    };
  }

  /**
   * Get most common values from array
   */
  private getModes<T>(values: T[]): T[] {
    const frequency = new Map<T, number>();

    for (const value of values) {
      frequency.set(value, (frequency.get(value) ?? 0) + 1);
    }

    const maxFreq = Math.max(...frequency.values());
    const modes: T[] = [];

    for (const [value, freq] of frequency.entries()) {
      if (freq === maxFreq) {
        modes.push(value);
      }
    }

    return modes;
  }

  /**
   * Cluster users by similarity
   */
  clusterUsers(
    users: Map<string, UserPreferences>,
    numClusters: number = 5
  ): UserCluster[] {
    const userIds = Array.from(users.keys());
    const clusters: UserCluster[] = [];

    // Simple k-means-like clustering
    // For production, use proper clustering algorithm

    if (userIds.length === 0) {
      return clusters;
    }

    // Initialize centroids with random users
    const centroids: string[] = [];
    const available = [...userIds];

    for (let i = 0; i < Math.min(numClusters, userIds.length); i++) {
      const idx = Math.floor(Math.random() * available.length);
      centroids.push(available[idx]!);
      available.splice(idx, 1);
    }

    // Assign users to nearest centroid
    const assignments = new Map<string, string>();
    const clusterSimilarities = new Map<string, number>();

    for (const userId of userIds) {
      let maxSimilarity = -1;
      let nearestCentroid = centroids[0]!;

      for (const centroid of centroids) {
        const similarity = this.calculateSimilarity(
          users.get(userId)!,
          users.get(centroid)!
        );
        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
          nearestCentroid = centroid;
        }
      }

      assignments.set(userId, nearestCentroid);
      clusterSimilarities.set(nearestCentroid, maxSimilarity);
    }

    // Create clusters
    for (const centroid of centroids) {
      const clusterUsers = Array.from(assignments.entries())
        .filter(([_, c]) => c === centroid)
        .map(([userId]) => userId);

      if (clusterUsers.length > 0) {
        const similarity = clusterSimilarities.get(centroid) ?? 0;
        clusters.push({
          id: `cluster-${centroid}`,
          users: clusterUsers,
          preferences: this.aggregatePreferences(clusterUsers, users),
          similarity,
        });
      }
    }

    return clusters;
  }

  /**
   * Calculate similarity between two user preferences
   */
  calculateSimilarity(user1: UserPreferences, user2: UserPreferences): number {
    let similarity = 0;
    let weight = 0;

    // Layout similarity (30%)
    if (user1.layout.preferred === user2.layout.preferred) similarity += 0.3;
    if (user1.layout.density === user2.layout.density) similarity += 0.1;
    weight += 0.4;

    // Visual similarity (25%)
    if (user1.visual.theme === user2.visual.theme) similarity += 0.15;
    weight += 0.15;

    // Typography similarity (15%)
    if (user1.typography.fontSize === user2.typography.fontSize)
      similarity += 0.15;
    weight += 0.15;

    // Navigation similarity (20%)
    if (user1.navigation.style === user2.navigation.style) similarity += 0.1;
    if (user1.navigation.position === user2.navigation.position)
      similarity += 0.1;
    weight += 0.2;

    return weight > 0 ? similarity / weight : 0;
  }

  /**
   * Find similar users
   */
  findSimilarUsers(
    targetUser: UserPreferences,
    allUsers: Map<string, UserPreferences>,
    limit: number = 10
  ): Array<{ userId: string; similarity: number }> {
    const results: Array<{ userId: string; similarity: number }> = [];

    for (const [userId, preferences] of allUsers.entries()) {
      if (userId === targetUser.userId) continue;

      const similarity = this.calculateSimilarity(targetUser, preferences);
      results.push({ userId, similarity });
    }

    return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
  }

  /**
   * Get segment by ID
   */
  getSegment(segmentId: string): Segment | undefined {
    return this.segments.get(segmentId);
  }

  /**
   * Get all segments
   */
  getAllSegments(): Segment[] {
    return Array.from(this.segments.values());
  }

  /**
   * Get user's segment
   */
  getUserSegment(userId: string): Segment | undefined {
    for (const segment of this.segments.values()) {
      if (segment.users.includes(userId)) {
        return segment;
      }
    }
    return undefined;
  }

  /**
   * Clear all segments
   */
  clear(): void {
    this.segments.clear();
    this.clusters.clear();
  }
}

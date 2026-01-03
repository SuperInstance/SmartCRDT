/**
 * Segmenter - Segments users based on behavior and properties
 */

import type { UserProfile, Segment, SegmentRule } from "../types.js";

export class Segmenter {
  private segments: Map<string, Segment> = new Map();
  private rules: Map<string, SegmentRule> = new Map();

  /**
   * Create a segment
   */
  createSegment(
    name: string,
    description: string,
    rules: SegmentRule
  ): Segment {
    const segment: Segment = {
      id: this.generateId(),
      name,
      description,
      filters: rules.conditions,
      size: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.segments.set(segment.id, segment);
    this.rules.set(segment.id, rules);

    return segment;
  }

  /**
   * Get a segment
   */
  getSegment(id: string): Segment | undefined {
    return this.segments.get(id);
  }

  /**
   * Get all segments
   */
  getAllSegments(): Segment[] {
    return Array.from(this.segments.values());
  }

  /**
   * Update a segment
   */
  updateSegment(id: string, updates: Partial<Segment>): Segment | undefined {
    const segment = this.segments.get(id);
    if (!segment) return undefined;

    const updated = { ...segment, ...updates, updatedAt: Date.now() };
    this.segments.set(id, updated);

    return updated;
  }

  /**
   * Delete a segment
   */
  deleteSegment(id: string): boolean {
    this.rules.delete(id);
    return this.segments.delete(id);
  }

  /**
   * Evaluate if a user belongs to a segment
   */
  evaluate(user: UserProfile, segmentId: string): boolean {
    const rule = this.rules.get(segmentId);
    if (!rule) return false;

    return this.matchesConditions(user, rule.conditions);
  }

  /**
   * Evaluate a user against all segments
   */
  evaluateAll(user: UserProfile): string[] {
    const matching: string[] = [];

    for (const [id, rule] of this.rules) {
      if (this.matchesConditions(user, rule.conditions)) {
        matching.push(id);
      }
    }

    return matching;
  }

  /**
   * Match user conditions
   */
  private matchesConditions(user: UserProfile, conditions: any[]): boolean {
    const logic =
      conditions.length > 0 && "logic" in conditions[0]
        ? (conditions[0] as any).logic
        : "and";
    const filters =
      Array.isArray(conditions) &&
      conditions.length > 0 &&
      "conditions" in conditions[0]
        ? (conditions[0] as any).conditions
        : conditions;

    if (logic === "and") {
      return filters.every((condition: any) =>
        this.matchesCondition(user, condition)
      );
    } else {
      return filters.some((condition: any) =>
        this.matchesCondition(user, condition)
      );
    }
  }

  /**
   * Match single condition
   */
  private matchesCondition(user: UserProfile, condition: any): boolean {
    const value =
      user.traits[condition.field] || user.customProperties[condition.field];

    switch (condition.operator) {
      case "equals":
        return value === condition.value;
      case "contains":
        return (
          typeof value === "string" && value.includes(String(condition.value))
        );
      case "startsWith":
        return (
          typeof value === "string" && value.startsWith(String(condition.value))
        );
      case "endsWith":
        return (
          typeof value === "string" && value.endsWith(String(condition.value))
        );
      case "gt":
        return typeof value === "number" && value > condition.value;
      case "lt":
        return typeof value === "number" && value < condition.value;
      case "gte":
        return typeof value === "number" && value >= condition.value;
      case "lte":
        return typeof value === "number" && value <= condition.value;
      case "in":
        return (
          Array.isArray(condition.value) && condition.value.includes(value)
        );
      default:
        return false;
    }
  }

  /**
   * Calculate segment sizes
   */
  calculateSegmentSizes(users: UserProfile[]): void {
    // Reset sizes
    for (const segment of this.segments.values()) {
      segment.size = 0;
    }

    // Calculate sizes
    for (const user of users) {
      const matching = this.evaluateAll(user);
      for (const segmentId of matching) {
        const segment = this.segments.get(segmentId);
        if (segment) {
          segment.size++;
        }
      }
    }
  }

  /**
   * Get users in a segment
   */
  getUsersInSegment(segmentId: string, users: UserProfile[]): UserProfile[] {
    const segment = this.segments.get(segmentId);
    if (!segment) return [];

    return users.filter(user => this.evaluate(user, segmentId));
  }

  /**
   * Find similar users
   */
  findSimilarUsers(
    targetUser: UserProfile,
    users: UserProfile[],
    limit: number = 10
  ): UserProfile[] {
    const similarities = users
      .filter(u => u.userId !== targetUser.userId)
      .map(user => ({
        user,
        similarity: this.calculateSimilarity(targetUser, user),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return similarities.map(s => s.user);
  }

  /**
   * Calculate user similarity (Jaccard index)
   */
  private calculateSimilarity(user1: UserProfile, user2: UserProfile): number {
    const segments1 = new Set(user1.segments);
    const segments2 = new Set(user2.segments);

    const intersection = new Set([...segments1].filter(s => segments2.has(s)));
    const union = new Set([...segments1, ...segments2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `segment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

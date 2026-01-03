/**
 * UserProfileStore - Stores and retrieves user profiles
 */

import type { UserProfile, QueryOptions, Filter } from "../types.js";

export class UserProfileStore {
  private profiles: Map<string, UserProfile> = new Map();
  private segmentIndex: Map<string, Set<string>> = new Map();

  /**
   * Store a profile
   */
  store(profile: UserProfile): void {
    this.profiles.set(profile.userId, profile);

    // Update segment index
    for (const segment of profile.segments) {
      if (!this.segmentIndex.has(segment)) {
        this.segmentIndex.set(segment, new Set());
      }
      this.segmentIndex.get(segment)!.add(profile.userId);
    }
  }

  /**
   * Get a profile by user ID
   */
  get(userId: string): UserProfile | undefined {
    return this.profiles.get(userId);
  }

  /**
   * Query profiles
   */
  query(options: QueryOptions = {}): UserProfile[] {
    let results = Array.from(this.profiles.values());

    if (options.filters) {
      results = this.applyFilters(results, options.filters);
    }

    if (options.sort) {
      results.sort((a, b) => {
        const aVal = a.traits[options.sort!.field] as number;
        const bVal = b.traits[options.sort!.field] as number;
        return options.sort!.direction === "asc" ? aVal - bVal : bVal - aVal;
      });
    }

    if (options.pagination) {
      const { page, pageSize } = options.pagination;
      const startIdx = (page - 1) * pageSize;
      const endIdx = startIdx + pageSize;
      results = results.slice(startIdx, endIdx);
    }

    return results;
  }

  /**
   * Get profiles by segment
   */
  getBySegment(segment: string): UserProfile[] {
    const userIds = this.segmentIndex.get(segment);
    if (!userIds) return [];

    return Array.from(userIds)
      .map(id => this.profiles.get(id))
      .filter((p): p is UserProfile => p !== undefined);
  }

  /**
   * Get active users (seen in last N days)
   */
  getActiveUsers(days: number = 30): UserProfile[] {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return Array.from(this.profiles.values()).filter(p => p.lastSeen >= cutoff);
  }

  /**
   * Get new users (created in date range)
   */
  getNewUsers(startDate: Date, endDate: Date): UserProfile[] {
    return Array.from(this.profiles.values()).filter(
      p =>
        p.firstSeen >= startDate.getTime() && p.firstSeen <= endDate.getTime()
    );
  }

  /**
   * Get churned users (not seen in N days)
   */
  getChurnedUsers(days: number = 30): UserProfile[] {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return Array.from(this.profiles.values()).filter(p => p.lastSeen < cutoff);
  }

  /**
   * Calculate retention
   */
  getRetention(days: number): {
    day1: number;
    day7: number;
    day30: number;
  } {
    const users = Array.from(this.profiles.values());
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;

    const eligibleUsers = users.filter(
      u =>
        u.firstSeen >= cutoff &&
        u.firstSeen <= cutoff + 30 * 24 * 60 * 60 * 1000
    );

    const day1Cutoff =
      eligibleUsers[0]?.firstSeen + 1 * 24 * 60 * 60 * 1000 || 0;
    const day7Cutoff =
      eligibleUsers[0]?.firstSeen + 7 * 24 * 60 * 60 * 1000 || 0;
    const day30Cutoff =
      eligibleUsers[0]?.firstSeen + 30 * 24 * 60 * 60 * 1000 || 0;

    const total = eligibleUsers.length;
    if (total === 0) return { day1: 0, day7: 0, day30: 0 };

    const day1 =
      eligibleUsers.filter(u => u.lastSeen >= day1Cutoff).length / total;
    const day7 =
      eligibleUsers.filter(u => u.lastSeen >= day7Cutoff).length / total;
    const day30 =
      eligibleUsers.filter(u => u.lastSeen >= day30Cutoff).length / total;

    return { day1, day7, day30 };
  }

  /**
   * Delete a profile
   */
  delete(userId: string): boolean {
    const profile = this.profiles.get(userId);
    if (!profile) return false;

    for (const segment of profile.segments) {
      this.segmentIndex.get(segment)?.delete(userId);
    }

    return this.profiles.delete(userId);
  }

  /**
   * Clear all profiles
   */
  clear(): void {
    this.profiles.clear();
    this.segmentIndex.clear();
  }

  /**
   * Apply filters
   */
  private applyFilters(
    profiles: UserProfile[],
    filters: Filter[]
  ): UserProfile[] {
    return profiles.filter(profile => {
      return filters.every(filter => {
        const value =
          profile.traits[filter.field] ||
          profile.customProperties[filter.field];

        switch (filter.operator) {
          case "equals":
            return value === filter.value;
          case "contains":
            return (
              typeof value === "string" && value.includes(String(filter.value))
            );
          case "in":
            return Array.isArray(filter.value) && filter.value.includes(value);
          default:
            return true;
        }
      });
    });
  }
}

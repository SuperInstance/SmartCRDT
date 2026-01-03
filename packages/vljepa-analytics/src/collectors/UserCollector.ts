/**
 * UserCollector - Collects and manages user profile data
 */

import { EventEmitter } from "eventemitter3";
import type { UserProfile, UserPreferences } from "../types.js";

export class UserCollector extends EventEmitter {
  private profiles: Map<string, UserProfile> = new Map();
  private anonymousProfiles: Map<string, string> = new Map(); // anonymousId -> userId

  /**
   * Create or update user profile
   */
  upsert(
    userId: string,
    traits: Record<string, unknown> = {},
    preferences: Partial<UserPreferences> = {}
  ): UserProfile {
    const existing = this.profiles.get(userId);

    const profile: UserProfile = existing
      ? {
          ...existing,
          traits: { ...existing.traits, ...traits },
          preferences: { ...existing.preferences, ...preferences },
          lastSeen: Date.now(),
          customProperties: {
            ...existing.customProperties,
            ...traits,
          },
        }
      : {
          userId,
          traits,
          preferences: {
            language: "en",
            theme: "light",
            notifications: true,
            accessibility: {},
            customSettings: {},
            ...preferences,
          },
          segments: [],
          firstSeen: Date.now(),
          lastSeen: Date.now(),
          sessionCount: 0,
          totalSessions: 0,
          lifetimeValue: 0,
          customProperties: traits,
        };

    this.profiles.set(userId, profile);
    this.emit("profile", profile);

    return profile;
  }

  /**
   * Get user profile
   */
  get(userId: string): UserProfile | undefined {
    return this.profiles.get(userId);
  }

  /**
   * Get all profiles
   */
  getAll(): UserProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Update user segments
   */
  updateSegments(userId: string, segments: string[]): void {
    const profile = this.profiles.get(userId);
    if (profile) {
      profile.segments = segments;
      this.emit("segmentsUpdated", { userId, segments });
    }
  }

  /**
   * Increment session count
   */
  incrementSessionCount(userId: string): void {
    const profile = this.profiles.get(userId);
    if (profile) {
      profile.sessionCount++;
      profile.totalSessions++;
    }
  }

  /**
   * Update lifetime value
   */
  updateLifetimeValue(userId: string, value: number): void {
    const profile = this.profiles.get(userId);
    if (profile) {
      profile.lifetimeValue += value;
      this.emit("lifetimeValueUpdated", { userId, value });
    }
  }

  /**
   * Delete user profile
   */
  delete(userId: string): boolean {
    return this.profiles.delete(userId);
  }

  /**
   * Find users by segment
   */
  findBySegment(segment: string): UserProfile[] {
    return Array.from(this.profiles.values()).filter(p =>
      p.segments.includes(segment)
    );
  }

  /**
   * Search users by traits
   */
  searchByTraits(query: Record<string, unknown>): UserProfile[] {
    return Array.from(this.profiles.values()).filter(profile => {
      return Object.entries(query).every(
        ([key, value]) => profile.traits[key] === value
      );
    });
  }

  /**
   * Link anonymous user to identified user
   */
  linkAnonymous(anonymousId: string, userId: string): void {
    this.anonymousProfiles.set(anonymousId, userId);
    this.emit("linked", { anonymousId, userId });
  }

  /**
   * Get user ID from anonymous ID
   */
  getUserIdFromAnonymous(anonymousId: string): string | undefined {
    return this.anonymousProfiles.get(anonymousId);
  }

  /**
   * Get profile count
   */
  count(): number {
    return this.profiles.size;
  }

  /**
   * Clear all profiles
   */
  clear(): void {
    this.profiles.clear();
    this.anonymousProfiles.clear();
  }
}

/**
 * Usage Tracker - Track module access patterns
 *
 * Records and analyzes how modules are accessed to enable
 * predictive preloading based on usage patterns.
 */

import type {
  UsagePattern,
  UserUsagePattern,
  CoAccessPattern,
  SessionPattern,
  TimeBucket,
  DayOfWeek,
  UsageTrackerConfig,
} from "./types.js";

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: UsageTrackerConfig = {
  enabled: true,
  sampleRate: 1.0,
  maxPatternsPerModule: 100,
  maxPatternsPerUser: 50,
  aggregationInterval: 60000, // 1 minute
};

// ============================================================================
// Usage Tracker Class
// ============================================================================

export class UsageTracker {
  private config: UsageTrackerConfig;
  private modulePatterns: Map<string, UsagePattern>;
  private userPatterns: Map<string, UserUsagePattern>;
  private accessHistory: Array<{
    moduleName: string;
    userId: string;
    timestamp: number;
  }>;
  private coAccessMatrix: Map<string, Map<string, number>>;
  private sessionData: Map<string, string[]>; // userId -> module sequence

  constructor(config: Partial<UsageTrackerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.modulePatterns = new Map();
    this.userPatterns = new Map();
    this.accessHistory = [];
    this.coAccessMatrix = new Map();
    this.sessionData = new Map();
  }

  // ========================================================================
  // Access Tracking
  // ========================================================================

  /**
   * Record a module access event
   */
  recordAccess(params: {
    moduleName: string;
    userId: string;
    timestamp?: number;
  }): void {
    if (!this.config.enabled) {
      return;
    }

    // Apply sampling
    if (Math.random() > this.config.sampleRate) {
      return;
    }

    const timestamp = params.timestamp ?? Date.now();
    const { moduleName, userId } = params;

    // Record access history
    this.accessHistory.push({ moduleName, userId, timestamp });

    // Keep history manageable
    if (this.accessHistory.length > 10000) {
      this.accessHistory = this.accessHistory.slice(-5000);
    }

    // Update module pattern
    this.updateModulePattern(moduleName, timestamp);

    // Update user pattern
    this.updateUserPattern(userId, moduleName, timestamp);

    // Update co-access matrix
    this.updateCoAccessMatrix(moduleName, userId);

    // Update session data
    this.updateSessionData(userId, moduleName);
  }

  /**
   * Record multiple module access events
   */
  recordAccessBatch(
    accesses: Array<{
      moduleName: string;
      userId: string;
      timestamp?: number;
    }>
  ): void {
    for (const access of accesses) {
      this.recordAccess(access);
    }
  }

  // ========================================================================
  // Pattern Updates
  // ========================================================================

  private updateModulePattern(moduleName: string, timestamp: number): void {
    let pattern = this.modulePatterns.get(moduleName);

    if (!pattern) {
      pattern = this.createDefaultPattern(moduleName, timestamp);
      this.modulePatterns.set(moduleName, pattern);
    }

    // Update access frequency (simple moving average)
    const age = timestamp - pattern.lastUpdated;
    const hoursSinceUpdate = age / (1000 * 60 * 60);
    if (hoursSinceUpdate > 0) {
      pattern.accessFrequency =
        pattern.accessFrequency * 0.9 + (1 / hoursSinceUpdate) * 0.1;
    }

    // Update time of day
    pattern.timeOfDay = this.getTimeBucket(timestamp);
    pattern.dayOfWeek = this.getDayOfWeek(timestamp);
    pattern.lastUpdated = timestamp;

    // Check if we need to prune old patterns
    if (this.modulePatterns.size > this.config.maxPatternsPerModule) {
      this.pruneOldPatterns();
    }
  }

  private updateUserPattern(
    userId: string,
    moduleName: string,
    timestamp: number
  ): void {
    let userPattern = this.userPatterns.get(userId);

    if (!userPattern) {
      userPattern = {
        userId,
        patterns: new Map(),
        lastActive: timestamp,
      };
      this.userPatterns.set(userId, userPattern);
    }

    let modulePattern = userPattern.patterns.get(moduleName);
    if (!modulePattern) {
      modulePattern = this.createDefaultPattern(moduleName, timestamp);
      userPattern.patterns.set(moduleName, modulePattern);
    }

    // Update module pattern for user
    const age = timestamp - modulePattern.lastUpdated;
    const hoursSinceUpdate = Math.max(0.1, age / (1000 * 60 * 60));
    modulePattern.accessFrequency =
      modulePattern.accessFrequency * 0.9 + (1 / hoursSinceUpdate) * 0.1;
    modulePattern.timeOfDay = this.getTimeBucket(timestamp);
    modulePattern.dayOfWeek = this.getDayOfWeek(timestamp);
    modulePattern.lastUpdated = timestamp;

    userPattern.lastActive = timestamp;

    // Prune if too many patterns
    if (userPattern.patterns.size > this.config.maxPatternsPerUser) {
      this.pruneUserPatterns(userId);
    }
  }

  private updateCoAccessMatrix(moduleName: string, userId: string): void {
    // Get user's recent modules
    const userModules = this.sessionData.get(userId) || [];

    // Update co-access counts
    if (!this.coAccessMatrix.has(moduleName)) {
      this.coAccessMatrix.set(moduleName, new Map());
    }

    const moduleRow = this.coAccessMatrix.get(moduleName)!;

    for (const otherModule of userModules) {
      if (otherModule === moduleName) continue;

      const count = moduleRow.get(otherModule) || 0;
      moduleRow.set(otherModule, count + 1);
    }
  }

  private updateSessionData(userId: string, moduleName: string): void {
    let session = this.sessionData.get(userId) || [];

    // Don't add duplicate consecutive modules
    if (session[session.length - 1] !== moduleName) {
      session.push(moduleName);
    }

    // Keep session length manageable
    if (session.length > 100) {
      session = session.slice(-50);
    }

    this.sessionData.set(userId, session);
  }

  // ========================================================================
  // Pattern Analysis
  // ========================================================================

  /**
   * Get usage pattern for a specific module
   */
  getModulePattern(moduleName: string): UsagePattern | undefined {
    return this.modulePatterns.get(moduleName);
  }

  /**
   * Get usage pattern for a specific user
   */
  getUserPattern(userId: string): UserUsagePattern | undefined {
    return this.userPatterns.get(userId);
  }

  /**
   * Get co-access patterns for a module
   */
  getCoAccessPatterns(moduleName: string, limit = 10): CoAccessPattern[] {
    const row = this.coAccessMatrix.get(moduleName);
    if (!row) return [];

    // Calculate total for probability
    const total = Array.from(row.values()).reduce(
      (sum, count) => sum + count,
      0
    );

    // Convert to CoAccessPattern array
    const patterns: CoAccessPattern[] = Array.from(row.entries())
      .map(([modName, count]) => ({
        moduleName: modName,
        probability: total > 0 ? count / total : 0,
        avgTimeBetween: 0, // Would need timestamp tracking for this
      }))
      .sort((a, b) => b.probability - a.probability)
      .slice(0, limit);

    return patterns;
  }

  /**
   * Get most frequently accessed modules
   */
  getTopModules(limit = 10): Array<{ moduleName: string; frequency: number }> {
    return Array.from(this.modulePatterns.entries())
      .map(([moduleName, pattern]) => ({
        moduleName,
        frequency: pattern.accessFrequency,
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit);
  }

  /**
   * Get modules likely to be accessed next based on current module
   */
  predictNextModules(
    currentModule: string,
    limit = 5
  ): Array<{
    moduleName: string;
    probability: number;
  }> {
    const coAccess = this.getCoAccessPatterns(currentModule, limit * 2);
    return coAccess.slice(0, limit).map(p => ({
      moduleName: p.moduleName,
      probability: p.probability,
    }));
  }

  /**
   * Get modules likely to be accessed at current time
   */
  getModulesForCurrentTime(): string[] {
    const now = Date.now();
    const currentBucket = this.getTimeBucket(now);
    const currentDay = this.getDayOfWeek(now);

    return Array.from(this.modulePatterns.entries())
      .filter(
        ([_, pattern]) =>
          pattern.timeOfDay === currentBucket &&
          pattern.dayOfWeek === currentDay
      )
      .map(([moduleName]) => moduleName);
  }

  // ========================================================================
  // Statistics
  // ========================================================================

  /**
   * Get tracker statistics
   */
  getStats(): {
    totalModules: number;
    totalUsers: number;
    totalAccesses: number;
    avgAccessFrequency: number;
    topModules: Array<{ moduleName: string; frequency: number }>;
  } {
    const frequencies = Array.from(this.modulePatterns.values()).map(
      p => p.accessFrequency
    );
    const avgFrequency =
      frequencies.length > 0
        ? frequencies.reduce((sum, f) => sum + f, 0) / frequencies.length
        : 0;

    return {
      totalModules: this.modulePatterns.size,
      totalUsers: this.userPatterns.size,
      totalAccesses: this.accessHistory.length,
      avgAccessFrequency: avgFrequency,
      topModules: this.getTopModules(5),
    };
  }

  /**
   * Get access history for a module
   */
  getModuleHistory(
    moduleName: string,
    limit = 100
  ): Array<{
    userId: string;
    timestamp: number;
  }> {
    return this.accessHistory
      .filter(a => a.moduleName === moduleName)
      .slice(-limit)
      .map(a => ({ userId: a.userId, timestamp: a.timestamp }));
  }

  /**
   * Get access history for a user
   */
  getUserHistory(
    userId: string,
    limit = 100
  ): Array<{
    moduleName: string;
    timestamp: number;
  }> {
    return this.accessHistory
      .filter(a => a.userId === userId)
      .slice(-limit)
      .map(a => ({ moduleName: a.moduleName, timestamp: a.timestamp }));
  }

  // ========================================================================
  // Management
  // ========================================================================

  /**
   * Clear all tracking data
   */
  clear(): void {
    this.modulePatterns.clear();
    this.userPatterns.clear();
    this.accessHistory = [];
    this.coAccessMatrix.clear();
    this.sessionData.clear();
  }

  /**
   * Clear data older than specified timestamp
   */
  clearBefore(timestamp: number): void {
    this.accessHistory = this.accessHistory.filter(
      a => a.timestamp >= timestamp
    );

    // Remove old user patterns
    for (const [userId, userPattern] of this.userPatterns.entries()) {
      if (userPattern.lastActive < timestamp) {
        this.userPatterns.delete(userId);
        this.sessionData.delete(userId);
      }
    }
  }

  /**
   * Export tracking data
   */
  export(): {
    modulePatterns: Record<string, UsagePattern>;
    userPatterns: Record<string, UserUsagePattern>;
    accessHistory: Array<{
      moduleName: string;
      userId: string;
      timestamp: number;
    }>;
    coAccessMatrix: Record<string, Record<string, number>>;
  } {
    return {
      modulePatterns: Object.fromEntries(this.modulePatterns),
      userPatterns: Object.fromEntries(this.userPatterns),
      accessHistory: this.accessHistory,
      coAccessMatrix: Object.fromEntries(
        Array.from(this.coAccessMatrix.entries()).map(([k, v]) => [
          k,
          Object.fromEntries(v),
        ])
      ),
    };
  }

  /**
   * Import tracking data
   */
  import(data: {
    modulePatterns?: Record<string, UsagePattern>;
    userPatterns?: Record<string, UserUsagePattern>;
    accessHistory?: Array<{
      moduleName: string;
      userId: string;
      timestamp: number;
    }>;
    coAccessMatrix?: Record<string, Record<string, number>>;
  }): void {
    if (data.modulePatterns) {
      this.modulePatterns = new Map(Object.entries(data.modulePatterns));
    }
    if (data.userPatterns) {
      this.userPatterns = new Map(Object.entries(data.userPatterns));
    }
    if (data.accessHistory) {
      this.accessHistory = data.accessHistory;
    }
    if (data.coAccessMatrix) {
      this.coAccessMatrix = new Map(
        Object.entries(data.coAccessMatrix).map(([k, v]) => [
          k,
          new Map(Object.entries(v)),
        ])
      );
    }
  }

  // ========================================================================
  // Private Helpers
  // ========================================================================

  private createDefaultPattern(
    moduleName: string,
    timestamp: number
  ): UsagePattern {
    return {
      moduleName,
      accessFrequency: 1.0,
      timeOfDay: this.getTimeBucket(timestamp),
      dayOfWeek: this.getDayOfWeek(timestamp),
      coAccess: [],
      sessionPattern: {
        startProbability: 0.5,
        endProbability: 0.5,
        avgPosition: 0.5,
      },
      lastUpdated: timestamp,
    };
  }

  private getTimeBucket(timestamp: number): TimeBucket {
    const hour = new Date(timestamp).getHours();

    if (hour >= 0 && hour < 6) return "early-morning";
    if (hour >= 6 && hour < 12) return "morning";
    if (hour >= 12 && hour < 18) return "afternoon";
    return "evening";
  }

  private getDayOfWeek(timestamp: number): DayOfWeek {
    const days: DayOfWeek[] = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    return days[new Date(timestamp).getDay()];
  }

  private pruneOldPatterns(): void {
    // Sort by last updated and remove oldest
    const sorted = Array.from(this.modulePatterns.entries()).sort(
      (a, b) => a[1].lastUpdated - b[1].lastUpdated
    );

    const toRemove = sorted.slice(
      0,
      sorted.length - this.config.maxPatternsPerModule
    );
    for (const [moduleName] of toRemove) {
      this.modulePatterns.delete(moduleName);
    }
  }

  private pruneUserPatterns(userId: string): void {
    const userPattern = this.userPatterns.get(userId);
    if (!userPattern) return;

    const sorted = Array.from(userPattern.patterns.entries()).sort(
      (a, b) => a[1].lastUpdated - b[1].lastUpdated
    );

    const toRemove = sorted.slice(
      0,
      sorted.length - this.config.maxPatternsPerUser
    );
    for (const [moduleName] of toRemove) {
      userPattern.patterns.delete(moduleName);
    }
  }
}

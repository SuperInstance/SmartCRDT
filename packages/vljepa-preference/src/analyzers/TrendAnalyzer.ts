/**
 * TrendAnalyzer - Analyzes trends in user preferences over time
 */

import type { UserPreferences, Trend, TrendAnalysis } from "../types.js";

export interface PreferenceSnapshot {
  userId: string;
  preferences: UserPreferences;
  timestamp: number;
}

export interface TimeSeries {
  timestamps: number[];
  values: number[];
}

export class TrendAnalyzer {
  private snapshots: Map<string, PreferenceSnapshot[]> = new Map();
  private trends: Map<string, Trend> = new Map();

  /**
   * Add a preference snapshot
   */
  addSnapshot(snapshot: PreferenceSnapshot): void {
    const userId = snapshot.userId;

    if (!this.snapshots.has(userId)) {
      this.snapshots.set(userId, []);
    }

    this.snapshots.get(userId)!.push(snapshot);

    // Keep only last 100 snapshots per user
    const snapshots = this.snapshots.get(userId)!;
    if (snapshots.length > 100) {
      snapshots.splice(0, snapshots.length - 100);
    }
  }

  /**
   * Analyze trends for all users
   */
  analyzeTrends(windowMs: number = 7 * 24 * 60 * 60 * 1000): TrendAnalysis {
    const cutoff = Date.now() - windowMs;
    const recentSnapshots = this.getRecentSnapshots(cutoff);

    const trends = this.detectTrends(recentSnapshots, windowMs);

    return {
      trends,
      timestamp: Date.now(),
      totalUsers: this.snapshots.size,
    };
  }

  /**
   * Get recent snapshots
   */
  private getRecentSnapshots(cutoff: number): PreferenceSnapshot[] {
    const recent: PreferenceSnapshot[] = [];

    for (const snapshots of this.snapshots.values()) {
      for (const snapshot of snapshots) {
        if (snapshot.timestamp >= cutoff) {
          recent.push(snapshot);
        }
      }
    }

    return recent;
  }

  /**
   * Detect trends from snapshots
   */
  private detectTrends(
    snapshots: PreferenceSnapshot[],
    windowMs: number
  ): Trend[] {
    const trends: Trend[] = [];

    // Group by layout preference
    const layoutTrends = this.detectLayoutTrends(snapshots, windowMs);
    trends.push(...layoutTrends);

    // Group by theme preference
    const themeTrends = this.detectThemeTrends(snapshots, windowMs);
    trends.push(...themeTrends);

    // Group by density preference
    const densityTrends = this.detectDensityTrends(snapshots, windowMs);
    trends.push(...densityTrends);

    // Group by font size preference
    const fontSizeTrends = this.detectFontSizeTrends(snapshots, windowMs);
    trends.push(...fontSizeTrends);

    return trends;
  }

  /**
   * Detect layout preference trends
   */
  private detectLayoutTrends(
    snapshots: PreferenceSnapshot[],
    windowMs: number
  ): Trend[] {
    const layoutCounts = new Map<string, TimeSeries>();

    for (const snapshot of snapshots) {
      const layout =
        snapshot.layout?.preferred ?? snapshot.preferences.layout.preferred;

      if (!layoutCounts.has(layout)) {
        layoutCounts.set(layout, { timestamps: [], values: [] });
      }

      const series = layoutCounts.get(layout)!;
      series.timestamps.push(snapshot.timestamp);
      series.values.push(1);
    }

    const trends: Trend[] = [];

    for (const [layout, series] of layoutCounts.entries()) {
      if (series.timestamps.length < 2) continue;

      const direction = this.calculateTrendDirection(series);
      const magnitude = this.calculateTrendMagnitude(series);
      const confidence = Math.min(series.timestamps.length / 10, 1);

      trends.push({
        id: `trend-layout-${layout}`,
        name: `Layout: ${layout}`,
        direction,
        magnitude,
        confidence,
        timeframe: windowMs,
        affectedUsers: this.countUniqueUsers(
          snapshots.filter(s => s.preferences.layout.preferred === layout)
        ),
      });
    }

    return trends;
  }

  /**
   * Detect theme preference trends
   */
  private detectThemeTrends(
    snapshots: PreferenceSnapshot[],
    windowMs: number
  ): Trend[] {
    const themeCounts = new Map<string, TimeSeries>();

    for (const snapshot of snapshots) {
      const theme = snapshot.preferences.visual.theme;

      if (!themeCounts.has(theme)) {
        themeCounts.set(theme, { timestamps: [], values: [] });
      }

      const series = themeCounts.get(theme)!;
      series.timestamps.push(snapshot.timestamp);
      series.values.push(1);
    }

    const trends: Trend[] = [];

    for (const [theme, series] of themeCounts.entries()) {
      if (series.timestamps.length < 2) continue;

      const direction = this.calculateTrendDirection(series);
      const magnitude = this.calculateTrendMagnitude(series);
      const confidence = Math.min(series.timestamps.length / 10, 1);

      trends.push({
        id: `trend-theme-${theme}`,
        name: `Theme: ${theme}`,
        direction,
        magnitude,
        confidence,
        timeframe: windowMs,
        affectedUsers: this.countUniqueUsers(
          snapshots.filter(s => s.preferences.visual.theme === theme)
        ),
      });
    }

    return trends;
  }

  /**
   * Detect density preference trends
   */
  private detectDensityTrends(
    snapshots: PreferenceSnapshot[],
    windowMs: number
  ): Trend[] {
    const densityCounts = new Map<string, TimeSeries>();

    for (const snapshot of snapshots) {
      const density = snapshot.preferences.layout.density;

      if (!densityCounts.has(density)) {
        densityCounts.set(density, { timestamps: [], values: [] });
      }

      const series = densityCounts.get(density)!;
      series.timestamps.push(snapshot.timestamp);
      series.values.push(1);
    }

    const trends: Trend[] = [];

    for (const [density, series] of densityCounts.entries()) {
      if (series.timestamps.length < 2) continue;

      const direction = this.calculateTrendDirection(series);
      const magnitude = this.calculateTrendMagnitude(series);
      const confidence = Math.min(series.timestamps.length / 10, 1);

      trends.push({
        id: `trend-density-${density}`,
        name: `Density: ${density}`,
        direction,
        magnitude,
        confidence,
        timeframe: windowMs,
        affectedUsers: this.countUniqueUsers(
          snapshots.filter(s => s.preferences.layout.density === density)
        ),
      });
    }

    return trends;
  }

  /**
   * Detect font size preference trends
   */
  private detectFontSizeTrends(
    snapshots: PreferenceSnapshot[],
    windowMs: number
  ): Trend[] {
    const fontSizeCounts = new Map<string, TimeSeries>();

    for (const snapshot of snapshots) {
      const fontSize = snapshot.preferences.typography.fontSize;

      if (!fontSizeCounts.has(fontSize)) {
        fontSizeCounts.set(fontSize, { timestamps: [], values: [] });
      }

      const series = fontSizeCounts.get(fontSize)!;
      series.timestamps.push(snapshot.timestamp);
      series.values.push(1);
    }

    const trends: Trend[] = [];

    for (const [fontSize, series] of fontSizeCounts.entries()) {
      if (series.timestamps.length < 2) continue;

      const direction = this.calculateTrendDirection(series);
      const magnitude = this.calculateTrendMagnitude(series);
      const confidence = Math.min(series.timestamps.length / 10, 1);

      trends.push({
        id: `trend-fontsize-${fontSize}`,
        name: `Font Size: ${fontSize}`,
        direction,
        magnitude,
        confidence,
        timeframe: windowMs,
        affectedUsers: this.countUniqueUsers(
          snapshots.filter(s => s.preferences.typography.fontSize === fontSize)
        ),
      });
    }

    return trends;
  }

  /**
   * Calculate trend direction
   */
  private calculateTrendDirection(
    series: TimeSeries
  ): "increasing" | "decreasing" | "stable" {
    if (series.timestamps.length < 2) {
      return "stable";
    }

    // Compare first half vs second half
    const mid = Math.floor(series.timestamps.length / 2);
    const firstHalfAvg =
      series.values.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
    const secondHalfAvg =
      series.values.slice(mid).reduce((a, b) => a + b, 0) /
      (series.values.length - mid);

    const changePercent =
      firstHalfAvg > 0
        ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100
        : 0;

    if (Math.abs(changePercent) < 5) {
      return "stable";
    }

    return changePercent > 0 ? "increasing" : "decreasing";
  }

  /**
   * Calculate trend magnitude
   */
  private calculateTrendMagnitude(series: TimeSeries): number {
    if (series.values.length < 2) {
      return 0;
    }

    const min = Math.min(...series.values);
    const max = Math.max(...series.values);

    return min > 0 ? ((max - min) / min) * 100 : 0;
  }

  /**
   * Count unique users in snapshots
   */
  private countUniqueUsers(snapshots: PreferenceSnapshot[]): number {
    const uniqueUsers = new Set(snapshots.map(s => s.userId));
    return uniqueUsers.size;
  }

  /**
   * Get user preference history
   */
  getUserHistory(userId: string): PreferenceSnapshot[] {
    return this.snapshots.get(userId) ?? [];
  }

  /**
   * Get preference evolution for a user
   */
  getUserEvolution(
    userId: string,
    property: keyof UserPreferences
  ): TimeSeries | null {
    const snapshots = this.snapshots.get(userId);
    if (!snapshots || snapshots.length === 0) {
      return null;
    }

    const timestamps: number[] = [];
    const values: number[] = [];

    for (const snapshot of snapshots) {
      timestamps.push(snapshot.timestamp);

      // Extract numeric value from preference property
      const value = this.extractNumericValue(snapshot.preferences, property);
      values.push(value);
    }

    return { timestamps, values };
  }

  /**
   * Extract numeric value from preference
   */
  private extractNumericValue(
    preferences: UserPreferences,
    property: keyof UserPreferences
  ): number {
    if (property === "overallConfidence") {
      return preferences.overallConfidence;
    }

    const pref = preferences[property];

    if (pref && typeof pref === "object" && "confidence" in pref) {
      return pref.confidence;
    }

    return 0;
  }

  /**
   * Predict future preferences based on trends
   */
  predictPreferences(
    userId: string,
    windowMs: number = 30 * 24 * 60 * 60 * 1000
  ): Partial<UserPreferences> | null {
    const snapshots = this.snapshots.get(userId);
    if (!snapshots || snapshots.length < 2) {
      return null;
    }

    // Get recent snapshots
    const cutoff = Date.now() - windowMs;
    const recent = snapshots.filter(s => s.timestamp >= cutoff);

    if (recent.length < 2) {
      return null;
    }

    // Simple extrapolation based on latest snapshot
    const latest = recent[recent.length - 1]!;

    return {
      layout: { ...latest.layout },
      visual: { ...latest.visual },
      typography: { ...latest.typography },
      components: { ...latest.components },
      navigation: { ...latest.navigation },
    };
  }

  /**
   * Detect anomalies in user preferences
   */
  detectAnomalies(userId: string, threshold: number = 2): PreferenceSnapshot[] {
    const snapshots = this.snapshots.get(userId);
    if (!snapshots || snapshots.length < 3) {
      return [];
    }

    const anomalies: PreferenceSnapshot[] = [];

    // Check for sudden changes in overall confidence
    const confidences = snapshots.map(s => s.preferences.overallConfidence);
    const mean = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    const variance =
      confidences.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) /
      confidences.length;
    const stdDev = Math.sqrt(variance);

    for (const snapshot of snapshots) {
      const zScore = Math.abs(
        (snapshot.preferences.overallConfidence - mean) / stdDev
      );
      if (zScore > threshold) {
        anomalies.push(snapshot);
      }
    }

    return anomalies;
  }

  /**
   * Get all stored trends
   */
  getTrends(): Trend[] {
    return Array.from(this.trends.values());
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.snapshots.clear();
    this.trends.clear();
  }

  /**
   * Get total snapshot count
   */
  getTotalSnapshotCount(): number {
    let total = 0;
    for (const snapshots of this.snapshots.values()) {
      total += snapshots.length;
    }
    return total;
  }

  /**
   * Get user count
   */
  getUserCount(): number {
    return this.snapshots.size;
  }
}

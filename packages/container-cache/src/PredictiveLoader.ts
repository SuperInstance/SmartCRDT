import { UsagePattern, PreloadPrediction, CacheStrategy } from "./types.js";

/**
 * Predictive loader for container images
 * Analyzes usage patterns and predicts which images to preload
 */
export class PredictiveLoader {
  private patterns: Map<string, UsagePattern> = new Map();
  private predictions: Map<string, PreloadPrediction> = new Map();
  private usageHistory: Array<{ image: string; timestamp: Date }> = [];
  private config: {
    predictionWindow: number;
    minProbability: number;
    maxHistorySize: number;
    checkInterval: number;
  };

  constructor(
    config: {
      predictionWindow?: number;
      minProbability?: number;
      maxHistorySize?: number;
      checkInterval?: number;
    } = {}
  ) {
    this.config = {
      predictionWindow: config.predictionWindow ?? 24, // hours
      minProbability: config.minProbability ?? 0.6,
      maxHistorySize: config.maxHistorySize ?? 10000,
      checkInterval: config.checkInterval ?? 300000, // 5 minutes
    };
  }

  /**
   * Record image usage
   */
  recordUsage(imageRef: string, timestamp: Date = new Date()): void {
    this.usageHistory.push({ image: imageRef, timestamp });

    // Trim history if needed
    if (this.usageHistory.length > this.config.maxHistorySize) {
      this.usageHistory = this.usageHistory.slice(-this.config.maxHistorySize);
    }

    // Update pattern for this image
    this.updatePattern(imageRef, timestamp);
  }

  /**
   * Update usage pattern for an image
   */
  private updatePattern(imageRef: string, timestamp: Date): void {
    let pattern = this.patterns.get(imageRef);

    if (!pattern) {
      pattern = {
        image_ref: imageRef,
        usage_count: 0,
        window_start: timestamp,
        window_end: timestamp,
        avg_interval: 0,
        interval_stddev: 0,
        peak_hours: new Array(24).fill(0),
        day_patterns: new Array(7).fill(0),
      };
      this.patterns.set(imageRef, pattern);
    }

    pattern.usage_count++;
    pattern.window_end = timestamp;

    // Update peak hours
    const hour = timestamp.getHours();
    pattern.peak_hours[hour]++;

    // Update day patterns
    const day = timestamp.getDay();
    pattern.day_patterns[day]++;

    // Calculate intervals
    this.calculateIntervals(imageRef);
  }

  /**
   * Calculate usage intervals for an image
   */
  private calculateIntervals(imageRef: string): void {
    const pattern = this.patterns.get(imageRef);
    if (!pattern) return;

    const imageUsages = this.usageHistory
      .filter(u => u.image === imageRef)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (imageUsages.length < 2) {
      pattern.avg_interval = 0;
      pattern.interval_stddev = 0;
      return;
    }

    const intervals: number[] = [];
    for (let i = 1; i < imageUsages.length; i++) {
      const interval =
        imageUsages[i].timestamp.getTime() - imageUsages[i - 1].timestamp;
      intervals.push(interval);
    }

    // Calculate average
    const avg = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;

    // Calculate standard deviation
    const variance =
      intervals.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) /
      intervals.length;
    const stddev = Math.sqrt(variance);

    pattern.avg_interval = avg;
    pattern.interval_stddev = stddev;
  }

  /**
   * Predict which images should be preloaded
   */
  predictPreloads(): PreloadPrediction[] {
    const predictions: PreloadPrediction[] = [];
    const now = new Date();

    for (const [imageRef, pattern] of this.patterns.entries()) {
      if (pattern.usage_count < 2) {
        continue; // Need at least 2 usages to make predictions
      }

      const prediction = this.predictImageUsage(imageRef, pattern, now);
      if (prediction && prediction.probability >= this.config.minProbability) {
        predictions.push(prediction);
      }
    }

    // Sort by probability (descending)
    predictions.sort((a, b) => b.probability - a.probability);

    // Cache predictions
    this.predictions.clear();
    for (const pred of predictions) {
      this.predictions.set(pred.image_ref, pred);
    }

    return predictions;
  }

  /**
   * Predict usage for a specific image
   */
  private predictImageUsage(
    imageRef: string,
    pattern: UsagePattern,
    now: Date
  ): PreloadPrediction | null {
    const timeSinceLastUse = now.getTime() - pattern.window_end.getTime();
    const probability = this.calculateUsageProbability(pattern, now);
    const predictedTime = this.predictNextUseTime(pattern, now);

    let reason = this.getReason(pattern, probability);

    return {
      image_ref: imageRef,
      probability,
      predicted_time: predictedTime,
      confidence: this.calculateConfidence(pattern),
      reason,
    };
  }

  /**
   * Calculate probability of usage based on pattern
   */
  private calculateUsageProbability(pattern: UsagePattern, now: Date): number {
    let score = 0;

    // Frequency score (0-0.4)
    const ageHours =
      (now.getTime() - pattern.window_start.getTime()) / (1000 * 60 * 60);
    const frequency = pattern.usage_count / Math.max(1, ageHours);
    const frequencyScore = Math.min(frequency / 10, 1) * 0.4;

    // Time-based score (0-0.3)
    const currentHour = now.getHours();
    const currentDay = now.getDay();
    const hourScore =
      pattern.peak_hours[currentHour] / Math.max(1, pattern.usage_count);
    const dayScore =
      pattern.day_patterns[currentDay] / Math.max(1, pattern.usage_count);
    const timeScore = ((hourScore + dayScore) / 2) * 0.3;

    // Recency score (0-0.3)
    const timeSinceLastUse = now.getTime() - pattern.window_end.getTime();
    const hoursSinceLastUse = timeSinceLastUse / (1000 * 60 * 60);
    const recencyScore = Math.max(0, 1 - hoursSinceLastUse / 24) * 0.3;

    score = frequencyScore + timeScore + recencyScore;

    // Boost if average interval suggests imminent use
    if (pattern.avg_interval > 0) {
      const intervalScore = Math.max(
        0,
        1 - timeSinceLastUse / (pattern.avg_interval * 1.5)
      );
      score = Math.max(score, intervalScore * 0.8);
    }

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Predict next usage time
   */
  private predictNextUseTime(pattern: UsagePattern, now: Date): Date {
    if (pattern.avg_interval > 0) {
      // Use average interval
      const nextUse = pattern.window_end.getTime() + pattern.avg_interval;
      return new Date(nextUse);
    }

    // Fallback: use peak hour
    const peakHour = pattern.peak_hours.indexOf(
      Math.max(...pattern.peak_hours)
    );
    const nextUse = new Date(now);
    nextUse.setHours(peakHour, 0, 0, 0);

    // If peak hour already passed today, predict for tomorrow
    if (nextUse <= now) {
      nextUse.setDate(nextUse.getDate() + 1);
    }

    return nextUse;
  }

  /**
   * Calculate confidence in prediction
   */
  private calculateConfidence(pattern: UsagePattern): number {
    // More data = higher confidence
    const dataScore = Math.min(pattern.usage_count / 100, 1);

    // Lower stddev = higher confidence
    const consistencyScore =
      pattern.avg_interval > 0
        ? Math.max(0, 1 - pattern.interval_stddev / pattern.avg_interval)
        : 0.5;

    return dataScore * 0.6 + consistencyScore * 0.4;
  }

  /**
   * Get human-readable reason for prediction
   */
  private getReason(pattern: UsagePattern, probability: number): string {
    const reasons: string[] = [];

    if (probability > 0.8) {
      reasons.push("high usage frequency");
    }

    const now = new Date();
    const currentHour = now.getHours();
    const peakHour = pattern.peak_hours.indexOf(
      Math.max(...pattern.peak_hours)
    );
    if (currentHour === peakHour && pattern.peak_hours[peakHour] > 0) {
      reasons.push("currently in peak usage hour");
    }

    const hoursSinceLastUse =
      (now.getTime() - pattern.window_end.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastUse < 1) {
      reasons.push("used recently");
    }

    if (
      pattern.avg_interval > 0 &&
      hoursSinceLastUse >= pattern.avg_interval * 0.8
    ) {
      reasons.push("due for use based on interval");
    }

    return reasons.length > 0 ? reasons.join(", ") : "usage pattern analysis";
  }

  /**
   * Get recommended cache strategy based on pattern
   */
  getRecommendedStrategy(imageRef: string): CacheStrategy {
    const pattern = this.patterns.get(imageRef);
    if (!pattern) {
      return "lazy";
    }

    const now = new Date();
    const probability = this.calculateUsageProbability(pattern, now);
    const confidence = this.calculateConfidence(pattern);

    if (probability > 0.8 && confidence > 0.7) {
      return "eager";
    } else if (probability > 0.6) {
      return "predictive";
    } else if (pattern.usage_count > 10) {
      return "lazy";
    } else {
      return "on-demand";
    }
  }

  /**
   * Get preload priority (0-100)
   */
  getPreloadPriority(imageRef: string): number {
    const pattern = this.patterns.get(imageRef);
    if (!pattern) {
      return 50;
    }

    const now = new Date();
    const probability = this.calculateUsageProbability(pattern, now);
    const confidence = this.calculateConfidence(pattern);

    // Calculate priority based on probability, confidence, and usage frequency
    const priority =
      probability * 50 +
      confidence * 30 +
      Math.min(pattern.usage_count / 100, 1) * 20;

    return Math.round(Math.max(0, Math.min(100, priority)));
  }

  /**
   * Get all usage patterns
   */
  getPatterns(): UsagePattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Get pattern for specific image
   */
  getPattern(imageRef: string): UsagePattern | undefined {
    return this.patterns.get(imageRef);
  }

  /**
   * Get current predictions
   */
  getPredictions(): PreloadPrediction[] {
    return Array.from(this.predictions.values());
  }

  /**
   * Get prediction for specific image
   */
  getPrediction(imageRef: string): PreloadPrediction | undefined {
    return this.predictions.get(imageRef);
  }

  /**
   * Export all data
   */
  exportData(): {
    patterns: UsagePattern[];
    usageHistory: Array<{ image: string; timestamp: string }>;
  } {
    return {
      patterns: Array.from(this.patterns.values()),
      usageHistory: this.usageHistory.map(h => ({
        image: h.image,
        timestamp: h.timestamp.toISOString(),
      })),
    };
  }

  /**
   * Import data
   */
  importData(data: {
    patterns?: UsagePattern[];
    usageHistory?: Array<{ image: string; timestamp: string }>;
  }): void {
    if (data.patterns) {
      for (const pattern of data.patterns) {
        pattern.window_start = new Date(pattern.window_start);
        pattern.window_end = new Date(pattern.window_end);
        this.patterns.set(pattern.image_ref, pattern);
      }
    }

    if (data.usageHistory) {
      this.usageHistory = data.usageHistory.map(h => ({
        image: h.image,
        timestamp: new Date(h.timestamp),
      }));
    }
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.patterns.clear();
    this.predictions.clear();
    this.usageHistory = [];
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalPatterns: number;
    totalUsages: number;
    avgUsagesPerPattern: number;
    topImages: Array<{ image: string; count: number }>;
  } {
    const topImages = Array.from(this.patterns.entries())
      .map(([image, pattern]) => ({ image, count: pattern.usage_count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalPatterns: this.patterns.size,
      totalUsages: this.usageHistory.length,
      avgUsagesPerPattern:
        this.patterns.size > 0
          ? this.usageHistory.length / this.patterns.size
          : 0,
      topImages,
    };
  }
}

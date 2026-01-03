/**
 * @fileoverview Diversity Sampler - Ensure dataset diversity
 * @description Stratified sampling to ensure diverse representation
 */

import type {
  UIStatePair,
  CollectedScreenshot,
  VideoSegment,
  ChangeType,
  DatasetError,
} from "../types.js";

/**
 * Sampling configuration
 */
export interface DiversityConfig {
  targetSamplesPerCategory: number;
  minCategoryCoverage: number;
  maxSimilarityThreshold: number;
  stratification: boolean;
  rareCategoryBoost: number;
}

/**
 * Category statistics
 */
interface CategoryStats {
  name: string;
  count: number;
  target: number;
  ratio: number;
}

/**
 * Diversity Sampler class
 */
export class DiversitySampler {
  private config: DiversityConfig;

  constructor(config?: Partial<DiversityConfig>) {
    this.config = {
      targetSamplesPerCategory: config?.targetSamplesPerCategory ?? 1000,
      minCategoryCoverage: config?.minCategoryCoverage ?? 0.8,
      maxSimilarityThreshold: config?.maxSimilarityThreshold ?? 0.95,
      stratification: config?.stratification ?? true,
      rareCategoryBoost: config?.rareCategoryBoost ?? 2.0,
    };
  }

  /**
   * Sample diverse screenshots
   */
  sampleScreenshots(
    screenshots: CollectedScreenshot[],
    targetSize: number
  ): CollectedScreenshot[] {
    if (!this.config.stratification) {
      return this.randomSample(screenshots, targetSize);
    }

    // Group by category
    const groups = this.groupByCategory(screenshots);

    // Calculate target per category
    const categoryTargets = this.calculateCategoryTargets(groups, targetSize);

    // Sample from each category
    const sampled: CollectedScreenshot[] = [];

    for (const [category, target] of Object.entries(categoryTargets)) {
      const categoryItems = groups.get(category) || [];
      const sampledItems = this.sampleFromCategory(categoryItems, target);
      sampled.push(...sampledItems);
    }

    return sampled;
  }

  /**
   * Sample diverse pairs
   */
  samplePairs(pairs: UIStatePair[], targetSize: number): UIStatePair[] {
    if (!this.config.stratification) {
      return this.randomSample(pairs, targetSize);
    }

    // Group by change type
    const groups = this.groupByChangeType(pairs);

    // Calculate target per type
    const typeTargets = this.calculateTypeTargets(groups, targetSize);

    // Sample from each type
    const sampled: UIStatePair[] = [];

    for (const [changeType, target] of Object.entries(typeTargets)) {
      const typeItems = groups.get(changeType) || [];
      const sampledItems = this.sampleFromCategory(typeItems, target);
      sampled.push(...sampledItems);
    }

    return sampled;
  }

  /**
   * Sample diverse videos
   */
  sampleVideos(videos: VideoSegment[], targetSize: number): VideoSegment[] {
    if (!this.config.stratification) {
      return this.randomSample(videos, targetSize);
    }

    // Group by category
    const groups = new Map<string, VideoSegment[]>();

    for (const video of videos) {
      const category = video.metadata.category || "general";
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(video);
    }

    // Calculate target per category
    const categoryTargets = this.calculateCategoryTargets(
      new Map(Array.from(groups.entries()).map(([k, v]) => [k, v.length])),
      targetSize
    );

    // Sample from each category
    const sampled: VideoSegment[] = [];

    for (const [category, target] of Object.entries(categoryTargets)) {
      const categoryItems = groups.get(category) || [];
      const sampledItems = this.sampleFromCategory(categoryItems, target);
      sampled.push(...sampledItems);
    }

    return sampled;
  }

  /**
   * Group screenshots by category
   */
  private groupByCategory(
    screenshots: CollectedScreenshot[]
  ): Map<string, CollectedScreenshot[]> {
    const groups = new Map<string, CollectedScreenshot[]>();

    for (const screenshot of screenshots) {
      const category = screenshot.metadata.category || "general";
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(screenshot);
    }

    return groups;
  }

  /**
   * Group pairs by change type
   */
  private groupByChangeType(
    pairs: UIStatePair[]
  ): Map<ChangeType, UIStatePair[]> {
    const groups = new Map<ChangeType, UIStatePair[]>();

    for (const pair of pairs) {
      const changeType = pair.changeType;
      if (!groups.has(changeType)) {
        groups.set(changeType, []);
      }
      groups.get(changeType)!.push(pair);
    }

    return groups;
  }

  /**
   * Calculate target samples per category
   */
  private calculateCategoryTargets(
    groups: Map<string, number>,
    targetSize: number
  ): Record<string, number> {
    const targets: Record<string, number> = {};
    const totalItems = Array.from(groups.values()).reduce(
      (sum, count) => sum + count,
      0
    );
    const categories = Array.from(groups.keys());

    // Calculate proportional targets with boost for rare categories
    let remainingTarget = targetSize;

    for (const category of categories) {
      const count = groups.get(category) || 0;
      const ratio = count / totalItems;

      // Apply boost for rare categories
      let adjustedRatio = ratio;
      if (ratio < this.config.minCategoryCoverage) {
        adjustedRatio = ratio * this.config.rareCategoryBoost;
      }

      const target = Math.min(
        count,
        Math.floor((targetSize * adjustedRatio) / categories.length)
      );

      targets[category] = target;
      remainingTarget -= target;
    }

    // Distribute remaining target
    const categoriesWithRoom = categories.filter(
      c => (targets[c] || 0) < (groups.get(c) || 0)
    );

    while (remainingTarget > 0 && categoriesWithRoom.length > 0) {
      for (const category of categoriesWithRoom) {
        if (remainingTarget <= 0) break;
        if ((targets[category] || 0) < (groups.get(category) || 0)) {
          targets[category]++;
          remainingTarget--;
        }
      }
    }

    return targets;
  }

  /**
   * Calculate target samples per change type
   */
  private calculateTypeTargets(
    groups: Map<ChangeType, UIStatePair[]>,
    targetSize: number
  ): Record<string, number> {
    const targets: Record<string, number> = {};
    const totalItems = Array.from(groups.values()).reduce(
      (sum, items) => sum + items.length,
      0
    );
    const types = Array.from(groups.keys());

    // Equal distribution for change types
    const targetPerType = Math.floor(targetSize / types.length);

    for (const changeType of types) {
      const items = groups.get(changeType) || [];
      targets[changeType] = Math.min(items.length, targetPerType);
    }

    return targets;
  }

  /**
   * Sample from category
   */
  private sampleFromCategory<T>(items: T[], target: number): T[] {
    if (items.length <= target) {
      return [...items];
    }

    // Stratified sampling by difficulty
    const sampled: T[] = [];
    const step = items.length / target;

    for (let i = 0; i < target; i++) {
      const index = Math.floor(i * step);
      sampled.push(items[index]);
    }

    return sampled;
  }

  /**
   * Random sample
   */
  private randomSample<T>(items: T[], target: number): T[] {
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, target);
  }

  /**
   * Get category statistics
   */
  getCategoryStats(screenshots: CollectedScreenshot[]): CategoryStats[] {
    const groups = this.groupByCategory(screenshots);
    const total = screenshots.length;

    return Array.from(groups.entries()).map(([category, items]) => ({
      name: category,
      count: items.length,
      target: this.config.targetSamplesPerCategory,
      ratio: items.length / total,
    }));
  }

  /**
   * Get change type statistics
   */
  getChangeTypeStats(pairs: UIStatePair[]): CategoryStats[] {
    const groups = this.groupByChangeType(pairs);
    const total = pairs.length;

    return Array.from(groups.entries()).map(([changeType, items]) => ({
      name: changeType,
      count: items.length,
      target: Math.floor(total / groups.size),
      ratio: items.length / total,
    }));
  }

  /**
   * Check if dataset meets diversity requirements
   */
  checkDiversity(screenshots: CollectedScreenshot[]): boolean {
    const stats = this.getCategoryStats(screenshots);

    // Check if all categories meet minimum coverage
    for (const stat of stats) {
      if (stat.ratio < this.config.minCategoryCoverage) {
        return false;
      }
    }

    return true;
  }

  /**
   * Create dataset error
   */
  private createError(
    type: DatasetError["type"],
    message: string,
    details?: Record<string, unknown>
  ): DatasetError {
    const error = new Error(message) as DatasetError;
    error.type = type;
    error.timestamp = Date.now();
    error.recoverable = true;
    error.details = details;
    return error;
  }
}

/**
 * @fileoverview UserAllocator - Allocate users to test variants
 * @author Aequor Project - Round 23 Agent 2
 * @version 1.0.0
 */

import type {
  AllocationConfig,
  AllocationResult,
  AllocationStrategy,
  Experiment,
} from "../types.js";

// ============================================================================
// USER ALLOCATOR
// ============================================================================

/**
 * UserAllocator - Allocate users to A/B test variants
 *
 * Supports multiple allocation strategies for assigning users to variants.
 */
export class UserAllocator {
  private config: AllocationConfig;
  private stickyAllocations: Map<string, AllocationResult> = new Map();
  private adaptiveScores: Map<string, Map<string, number>> = new Map(); // expId -> variantId -> score

  constructor(config: AllocationConfig) {
    this.config = config;
  }

  /**
   * Allocate a user to a variant
   */
  allocate(
    userId: string,
    experiment: Experiment,
    timestamp?: number
  ): AllocationResult {
    const ts = timestamp || Date.now();
    let variantId: string;

    switch (this.config.strategy) {
      case "random":
        variantId = this.allocateRandom(userId, experiment);
        break;
      case "sticky":
        variantId = this.allocateSticky(userId, experiment, ts);
        break;
      case "hash":
        variantId = this.allocateHash(userId, experiment);
        break;
      case "adaptive":
        variantId = this.allocateAdaptive(userId, experiment);
        break;
      default:
        throw new Error(`Unknown allocation strategy: ${this.config.strategy}`);
    }

    const result: AllocationResult = {
      userId,
      variant: variantId,
      experiment: experiment.id,
      timestamp: ts,
      strategy: this.config.strategy,
    };

    // Store sticky allocation
    if (this.config.strategy === "sticky") {
      this.stickyAllocations.set(`${userId}:${experiment.id}`, result);
    }

    return result;
  }

  /**
   * Allocate using random assignment
   */
  private allocateRandom(userId: string, experiment: Experiment): string {
    const rand = Math.random() * 100;
    let cumulative = 0;

    for (const variant of experiment.variants) {
      cumulative += variant.allocation;
      if (rand <= cumulative) {
        return variant.id;
      }
    }

    return experiment.variants[experiment.variants.length - 1].id;
  }

  /**
   * Allocate using sticky assignment
   */
  private allocateSticky(
    userId: string,
    experiment: Experiment,
    timestamp: number
  ): string {
    const key = `${userId}:${experiment.id}`;
    const existing = this.stickyAllocations.get(key);

    // Check if existing allocation is still valid
    if (existing) {
      const stickinessMs = (this.config.stickiness || 7) * 24 * 60 * 60 * 1000;
      if (timestamp - existing.timestamp < stickinessMs) {
        return existing.variant;
      }
      // Expired, remove it
      this.stickyAllocations.delete(key);
    }

    // New allocation using hash for consistency
    return this.allocateHash(userId, experiment);
  }

  /**
   * Allocate using deterministic hash
   */
  private allocateHash(userId: string, experiment: Experiment): string {
    const hash = this.hashString(
      `${userId}:${this.config.hashKey || experiment.id}`
    );
    const value = (hash % 10000) / 100; // 0-100

    let cumulative = 0;
    for (const variant of experiment.variants) {
      cumulative += variant.allocation;
      if (value <= cumulative) {
        return variant.id;
      }
    }

    return experiment.variants[experiment.variants.length - 1].id;
  }

  /**
   * Allocate using adaptive strategy based on performance
   */
  private allocateAdaptive(userId: string, experiment: Experiment): string {
    // Initialize scores if needed
    if (!this.adaptiveScores.has(experiment.id)) {
      const scores = new Map<string, number>();
      for (const variant of experiment.variants) {
        scores.set(variant.id, variant.allocation);
      }
      this.adaptiveScores.set(experiment.id, scores);
    }

    const scores = this.adaptiveScores.get(experiment.id)!;
    const totalScore = Array.from(scores.values()).reduce(
      (sum, s) => sum + s,
      0
    );

    // Explore-exploit tradeoff (epsilon-greedy)
    const epsilon = this.config.adaptationRate || 0.1;
    if (Math.random() < epsilon) {
      // Explore: random allocation
      return this.allocateRandom(userId, experiment);
    }

    // Exploit: allocate to best performing variant
    let bestVariant = experiment.variants[0].id;
    let bestScore = 0;

    for (const [variantId, score] of scores) {
      // Normalize score
      const normalizedScore = score / totalScore;
      if (normalizedScore > bestScore) {
        bestScore = normalizedScore;
        bestVariant = variantId;
      }
    }

    return bestVariant;
  }

  /**
   * Update adaptive scores based on performance
   */
  updateAdaptiveScore(
    experimentId: string,
    variantId: string,
    score: number
  ): void {
    if (!this.adaptiveScores.has(experimentId)) {
      return;
    }

    const scores = this.adaptiveScores.get(experimentId)!;
    const currentScore = scores.get(variantId) || 0;

    // Exponential moving average
    const alpha = this.config.adaptationRate || 0.1;
    scores.set(variantId, currentScore * (1 - alpha) + score * alpha);
  }

  /**
   * Clear sticky allocations for a user
   */
  clearUserAllocation(userId: string, experimentId: string): void {
    this.stickyAllocations.delete(`${userId}:${experimentId}`);
  }

  /**
   * Clear all sticky allocations
   */
  clearAllAllocations(): void {
    this.stickyAllocations.clear();
  }

  /**
   * Reset adaptive scores for an experiment
   */
  resetAdaptiveScores(experimentId: string): void {
    this.adaptiveScores.delete(experimentId);
  }

  /**
   * Get current allocation for a user
   */
  getAllocation(userId: string, experimentId: string): AllocationResult | null {
    return this.stickyAllocations.get(`${userId}:${experimentId}`) || null;
  }

  /**
   * Hash a string to a number
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

// ============================================================================
// TRAFFIC SPLITTER
// ============================================================================

/**
 * TrafficSplitter - Split traffic across variants
 */
export class TrafficSplitter {
  /**
   * Split traffic evenly across variants
   */
  static evenSplit(variantCount: number): number[] {
    const allocation = 100 / variantCount;
    return Array(variantCount).fill(allocation);
  }

  /**
   * Create weighted traffic split
   */
  static weightedSplit(weights: number[]): number[] {
    const total = weights.reduce((sum, w) => sum + w, 0);
    return weights.map(w => (w / total) * 100);
  }

  /**
   * Validate traffic split sums to 100
   */
  static validateSplit(split: number[]): boolean {
    const sum = split.reduce((a, b) => a + b, 0);
    return Math.abs(sum - 100) < 0.01;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a user allocator
 */
export function createUserAllocator(
  strategy: AllocationStrategy = "random",
  config?: Partial<AllocationConfig>
): UserAllocator {
  return new UserAllocator({
    strategy,
    stickiness: 7, // 7 days default
    adaptationRate: 0.1,
    ...config,
  });
}

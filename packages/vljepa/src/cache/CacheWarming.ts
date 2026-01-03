/**
 * CacheWarming - Predictive cache warming strategies
 *
 * Implements multiple warming strategies to pre-populate cache:
 * - Preload: Load common UIs on startup
 * - Predictive: Anticipate next screen based on user behavior
 * - Adaptive: Learn from user patterns over time
 *
 * Warming Strategies:
 * 1. Preload common UI: Login, dashboard, settings
 * 2. Predictive caching: Use ML to predict next screen
 * 3. Background refresh: Update cache when idle
 * 4. User patterns: Learn individual user behavior
 *
 * @version 1.0.0
 */

import type { Float32Array } from "../types.js";

// ============================================================================
// WARMING TYPES
// ============================================================================

/**
 * Warming strategy type
 */
export type WarmingStrategy = "preload" | "predictive" | "adaptive";

/**
 * Warmup job configuration
 */
export interface WarmupJob {
  /** UI context to warm up */
  uiContext: string;
  /** Priority (0-1, higher = more important) */
  priority: number;
  /** Estimated time to complete (ms) */
  estimatedTime: number;
  /** Expected benefit (cache hit probability) */
  benefit: number;
  /** Job status */
  status: "pending" | "running" | "completed" | "failed";
  /** Creation timestamp */
  createdAt: number;
  /** Started timestamp (if running) */
  startedAt?: number;
  /** Completed timestamp (if completed) */
  completedAt?: number;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Cache warming configuration
 */
export interface CacheWarmingConfig {
  /** Warming strategy to use */
  strategy: WarmingStrategy;
  /** Common UIs to preload (for preload strategy) */
  preloadUIs: string[];
  /** Prediction threshold (0-1) for predictive strategy */
  predictionThreshold: number;
  /** Maximum background refreshes per minute */
  maxBackgroundRefresh: number;
  /** Enable user pattern learning */
  enableUserPatterns: boolean;
  /** Minimum priority to execute warmup job */
  minPriority: number;
}

/**
 * User pattern data
 */
export interface UserPattern {
  /** UI context */
  uiContext: string;
  /** Frequency of access */
  frequency: number;
  /** Average time between accesses */
  avgTimeBetween: number;
  /** Last access timestamp */
  lastAccess: number;
  /** Common next UIs after this one */
  nextUIs: Array<{ uiContext: string; probability: number }>;
}

/**
 * Predictive model interface
 */
export interface PredictiveModel {
  /** Predict next UI context given current context */
  predict(
    currentContext: string
  ): Array<{ uiContext: string; probability: number }>;
  /** Train model with user data */
  train(
    transitions: Array<{ from: string; to: string; timestamp: number }>
  ): void;
  /** Get model confidence */
  getConfidence(): number;
}

// ============================================================================
// MARKOV CHAIN PREDICTIVE MODEL
// ============================================================================

/**
 * Markov Chain Predictive Model
 *
 * Simple yet effective model for predicting next UI based on transitions.
 * Uses frequency-based probabilities for predictions.
 */
class MarkovChainPredictiveModel implements PredictiveModel {
  private transitions: Map<string, Map<string, number>> = new Map();
  private totalTransitions: number = 0;
  private confidence: number = 0.5;

  /**
   * Predict next UI contexts
   */
  predict(
    currentContext: string
  ): Array<{ uiContext: string; probability: number }> {
    const transitions = this.transitions.get(currentContext);
    if (!transitions || transitions.size === 0) {
      return [];
    }

    // Calculate probabilities
    const total = Array.from(transitions.values()).reduce((a, b) => a + b, 0);
    const predictions = Array.from(transitions.entries()).map(
      ([uiContext, count]) => ({
        uiContext,
        probability: count / total,
      })
    );

    // Sort by probability (descending)
    return predictions.sort((a, b) => b.probability - a.probability);
  }

  /**
   * Train model with transition data
   */
  train(
    transitions: Array<{ from: string; to: string; timestamp: number }>
  ): void {
    for (const transition of transitions) {
      if (!this.transitions.has(transition.from)) {
        this.transitions.set(transition.from, new Map());
      }

      const toTransitions = this.transitions.get(transition.from)!;
      toTransitions.set(
        transition.to,
        (toTransitions.get(transition.to) || 0) + 1
      );
      this.totalTransitions++;
    }

    // Update confidence based on data size
    this.confidence = Math.min(0.95, 0.5 + (transitions.length / 1000) * 0.45);
  }

  /**
   * Get model confidence
   */
  getConfidence(): number {
    return this.confidence;
  }

  /**
   * Get all transitions (for debugging)
   */
  getTransitions(): Map<string, Map<string, number>> {
    return new Map(this.transitions);
  }
}

// ============================================================================
// USER PATTERN LEARNER
// ============================================================================

/**
 * User Pattern Learner
 *
 * Learns individual user patterns for adaptive cache warming.
 * Tracks UI access patterns and predicts future behavior.
 */
class UserPatternLearner {
  private patterns: Map<string, UserPattern> = new Map();
  private accessHistory: Array<{ uiContext: string; timestamp: number }> = [];
  private transitionHistory: Array<{
    from: string;
    to: string;
    timestamp: number;
  }> = [];

  /**
   * Record UI access
   */
  recordAccess(uiContext: string): void {
    const now = Date.now();
    this.accessHistory.push({ uiContext, timestamp: now });

    // Keep only recent history (last 1000 accesses)
    if (this.accessHistory.length > 1000) {
      this.accessHistory.shift();
    }

    // Update pattern
    if (!this.patterns.has(uiContext)) {
      this.patterns.set(uiContext, {
        uiContext,
        frequency: 0,
        avgTimeBetween: 0,
        lastAccess: now,
        nextUIs: [],
      });
    }

    const pattern = this.patterns.get(uiContext)!;
    pattern.frequency++;
    pattern.lastAccess = now;

    // Record transition from previous UI
    if (this.accessHistory.length > 1) {
      const prevAccess = this.accessHistory[this.accessHistory.length - 2];
      if (prevAccess.uiContext !== uiContext) {
        this.recordTransition(prevAccess.uiContext, uiContext, now);
      }
    }
  }

  /**
   * Record transition between UIs
   */
  private recordTransition(from: string, to: string, timestamp: number): void {
    this.transitionHistory.push({ from, to, timestamp });

    // Keep only recent transitions (last 1000)
    if (this.transitionHistory.length > 1000) {
      this.transitionHistory.shift();
    }

    // Update nextUIs for 'from' pattern
    const fromPattern = this.patterns.get(from);
    if (fromPattern) {
      const existing = fromPattern.nextUIs.find(n => n.uiContext === to);
      if (existing) {
        existing.probability += 0.1;
      } else {
        fromPattern.nextUIs.push({ uiContext: to, probability: 0.1 });
      }

      // Normalize probabilities
      const total = fromPattern.nextUIs.reduce((a, b) => a + b.probability, 0);
      fromPattern.nextUIs = fromPattern.nextUIs.map(n => ({
        uiContext: n.uiContext,
        probability: n.probability / total,
      }));
    }
  }

  /**
   * Get pattern for UI context
   */
  getPattern(uiContext: string): UserPattern | undefined {
    return this.patterns.get(uiContext);
  }

  /**
   * Get all patterns
   */
  getPatterns(): UserPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Predict next UIs based on patterns
   */
  predictNext(
    currentContext: string
  ): Array<{ uiContext: string; probability: number }> {
    const pattern = this.patterns.get(currentContext);
    if (!pattern || pattern.nextUIs.length === 0) {
      return [];
    }

    // Sort by probability
    return [...pattern.nextUIs].sort((a, b) => b.probability - a.probability);
  }

  /**
   * Get most frequently accessed UIs
   */
  getFrequentUIs(
    count: number = 10
  ): Array<{ uiContext: string; frequency: number }> {
    return Array.from(this.patterns.entries())
      .map(([uiContext, pattern]) => ({
        uiContext,
        frequency: pattern.frequency,
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, count);
  }

  /**
   * Get access history
   */
  getAccessHistory(): Array<{ uiContext: string; timestamp: number }> {
    return [...this.accessHistory];
  }

  /**
   * Get transition history for training
   */
  getTransitionHistory(): Array<{
    from: string;
    to: string;
    timestamp: number;
  }> {
    return [...this.transitionHistory];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.accessHistory = [];
    this.transitionHistory = [];
  }
}

// ============================================================================
// CACHE WARMING (Main Class)
// ============================================================================

/**
 * Cache Warming Manager
 *
 * Manages cache warming strategies and execution.
 */
export class CacheWarming {
  private config: CacheWarmingConfig;
  private jobs: Map<string, WarmupJob> = new Map();
  private patternLearner: UserPatternLearner;
  private predictiveModel: PredictiveModel;
  private warmingQueue: WarmupJob[] = [];
  private isWarming: boolean = false;

  constructor(config?: Partial<CacheWarmingConfig>) {
    this.config = {
      strategy: "preload",
      preloadUIs: ["login", "dashboard", "settings"],
      predictionThreshold: 0.6,
      maxBackgroundRefresh: 10,
      enableUserPatterns: false,
      minPriority: 0.5,
      ...config,
    };

    this.patternLearner = new UserPatternLearner();
    this.predictiveModel = new MarkovChainPredictiveModel();
  }

  /**
   * Create warmup jobs for UI contexts
   */
  async createWarmupJobs(uiContexts: string[]): Promise<WarmupJob[]> {
    const jobs: WarmupJob[] = [];

    for (const uiContext of uiContexts) {
      const job = this.createWarmupJob(uiContext);
      jobs.push(job);
      this.jobs.set(uiContext, job);
    }

    return jobs;
  }

  /**
   * Create a single warmup job
   */
  private createWarmupJob(uiContext: string): WarmupJob {
    // Estimate priority based on frequency
    const pattern = this.patternLearner.getPattern(uiContext);
    const basePriority = 0.5;
    const frequencyBoost = pattern
      ? Math.min(0.3, pattern.frequency * 0.01)
      : 0;
    const priority = Math.min(1.0, basePriority + frequencyBoost);

    // Estimate benefit
    const predictions = this.predictiveModel.predict(uiContext);
    const benefit =
      predictions.length > 0
        ? predictions[0].probability
        : pattern
          ? Math.min(1.0, pattern.frequency * 0.1)
          : 0.3;

    return {
      uiContext,
      priority,
      estimatedTime: this.estimateTime(uiContext),
      benefit,
      status: "pending",
      createdAt: Date.now(),
    };
  }

  /**
   * Execute warmup job
   */
  async executeWarmupJob(job: WarmupJob): Promise<void> {
    if (job.status !== "pending") {
      return;
    }

    job.status = "running";
    job.startedAt = Date.now();

    try {
      // In production, this would:
      // 1. Fetch the UI frame
      // 2. Encode it with X-Encoder
      // 3. Store in cache

      // Stub: Simulate encoding
      await this.simulateEncoding(job);

      job.status = "completed";
      job.completedAt = Date.now();
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : String(error);
      job.completedAt = Date.now();
    }
  }

  /**
   * Create and execute warmup jobs based on strategy
   */
  async warm(uiContexts?: string[]): Promise<WarmupJob[]> {
    let jobs: WarmupJob[] = [];

    switch (this.config.strategy) {
      case "preload":
        jobs = await this.preloadStrategy();
        break;

      case "predictive":
        jobs = await this.predictiveStrategy(uiContexts);
        break;

      case "adaptive":
        jobs = await this.adaptiveStrategy(uiContexts);
        break;
    }

    // Execute high-priority jobs
    for (const job of jobs) {
      if (job.priority >= this.config.minPriority) {
        await this.executeWarmupJob(job);
      }
    }

    return jobs;
  }

  /**
   * Preload strategy - load common UIs
   */
  private async preloadStrategy(): Promise<WarmupJob[]> {
    return this.createWarmupJobs(this.config.preloadUIs);
  }

  /**
   * Predictive strategy - predict next UIs
   */
  private async predictiveStrategy(
    currentContexts?: string[]
  ): Promise<WarmupJob[]> {
    const jobs: WarmupJob[] = [];

    if (!currentContexts || currentContexts.length === 0) {
      return jobs;
    }

    for (const context of currentContexts) {
      const predictions = this.predictiveModel.predict(context);
      for (const prediction of predictions) {
        if (prediction.probability >= this.config.predictionThreshold) {
          const job = this.createWarmupJob(prediction.uiContext);
          job.priority = prediction.probability;
          job.benefit = prediction.probability;
          jobs.push(job);
        }
      }
    }

    return jobs;
  }

  /**
   * Adaptive strategy - learn from user patterns
   */
  private async adaptiveStrategy(
    currentContexts?: string[]
  ): Promise<WarmupJob[]> {
    const jobs: WarmupJob[] = [];

    // Get frequent UIs
    const frequentUIs = this.patternLearner.getFrequentUIs(20);
    for (const { uiContext, frequency } of frequentUIs) {
      const job = this.createWarmupJob(uiContext);
      job.priority = Math.min(1.0, frequency * 0.05);
      jobs.push(job);
    }

    // Get predicted next UIs
    if (currentContexts && currentContexts.length > 0) {
      for (const context of currentContexts) {
        const predictions = this.patternLearner.predictNext(context);
        for (const prediction of predictions) {
          if (prediction.probability >= this.config.predictionThreshold) {
            const job = this.createWarmupJob(prediction.uiContext);
            job.priority = prediction.probability;
            job.benefit = prediction.probability;
            jobs.push(job);
          }
        }
      }
    }

    return jobs;
  }

  /**
   * Record UI access for learning
   */
  recordAccess(uiContext: string): void {
    if (!this.config.enableUserPatterns) {
      return;
    }

    this.patternLearner.recordAccess(uiContext);

    // Retrain predictive model periodically
    if (this.patternLearner.getAccessHistory().length % 100 === 0) {
      this.trainPredictiveModel();
    }
  }

  /**
   * Train predictive model with learned patterns
   */
  trainPredictiveModel(): void {
    const transitions = this.patternLearner.getTransitionHistory();
    this.predictiveModel.train(transitions);
  }

  /**
   * Get warming status
   */
  getWarmingStatus(): {
    totalJobs: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
  } {
    const jobs = Array.from(this.jobs.values());

    return {
      totalJobs: jobs.length,
      pending: jobs.filter(j => j.status === "pending").length,
      running: jobs.filter(j => j.status === "running").length,
      completed: jobs.filter(j => j.status === "completed").length,
      failed: jobs.filter(j => j.status === "failed").length,
    };
  }

  /**
   * Get all warmup jobs
   */
  getJobs(): WarmupJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get job by UI context
   */
  getJob(uiContext: string): WarmupJob | undefined {
    return this.jobs.get(uiContext);
  }

  /**
   * Clear all jobs
   */
  clearJobs(): void {
    this.jobs.clear();
  }

  /**
   * Get user patterns
   */
  getUserPatterns(): UserPattern[] {
    return this.patternLearner.getPatterns();
  }

  /**
   * Get configuration
   */
  getConfig(): CacheWarmingConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<CacheWarmingConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
    };
  }

  /**
   * Estimate encoding time for UI context
   */
  private estimateTime(uiContext: string): number {
    // Stub: Estimate based on UI complexity
    // In production, would use actual encoding time data
    const complexity = uiContext.length;
    return Math.max(50, complexity * 10);
  }

  /**
   * Simulate encoding (stub)
   */
  private async simulateEncoding(job: WarmupJob): Promise<void> {
    // Simulate encoding delay
    await new Promise(resolve => setTimeout(resolve, job.estimatedTime));
  }
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

/**
 * Default cache warming configuration
 */
export const DEFAULT_CACHE_WARMING_CONFIG: CacheWarmingConfig = {
  strategy: "preload",
  preloadUIs: ["login", "dashboard", "settings", "profile", "notifications"],
  predictionThreshold: 0.6,
  maxBackgroundRefresh: 10,
  enableUserPatterns: false,
  minPriority: 0.5,
};

/**
 * Production cache warming configuration
 */
export const PRODUCTION_CACHE_WARMING_CONFIG: CacheWarmingConfig = {
  strategy: "adaptive",
  preloadUIs: [
    "login",
    "dashboard",
    "settings",
    "profile",
    "notifications",
    "messages",
    "search",
  ],
  predictionThreshold: 0.7,
  maxBackgroundRefresh: 20,
  enableUserPatterns: true,
  minPriority: 0.6,
};

/**
 * Minimal cache warming configuration (less aggressive)
 */
export const MINIMAL_CACHE_WARMING_CONFIG: CacheWarmingConfig = {
  strategy: "preload",
  preloadUIs: ["login", "dashboard"],
  predictionThreshold: 0.8,
  maxBackgroundRefresh: 5,
  enableUserPatterns: false,
  minPriority: 0.8,
};

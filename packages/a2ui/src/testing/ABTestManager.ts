/**
 * @fileoverview A/B Test Manager - Manage A/B testing experiments for UI variants
 * @author Aequor Project - Round 18 Agent 2
 * @version 1.0.0
 */

import type { A2UIResponse } from "@lsi/protocol";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Test status
 */
export type TestStatus =
  | "draft"
  | "running"
  | "paused"
  | "completed"
  | "archived";

/**
 * Traffic allocation strategy
 */
export type TrafficStrategy =
  | "equal" // Equal split across all variants
  | "weighted" // Custom weights per variant
  | "bandit" // Multi-armed bandit (adaptive)
  | "thompson"; // Thompson sampling

/**
 * Test metric to track
 */
export interface TestMetric {
  id: string;
  name: string;
  type: "count" | "ratio" | "duration" | "score";
  description: string;
  aggregation: "sum" | "avg" | "median" | "p95" | "p99";
  higherIsBetter: boolean;
  unit?: string;
}

/**
 * UI variant for testing
 */
export interface UIVariant {
  id: string;
  name: string;
  description: string;
  ui: A2UIResponse;
  weight: number; // For weighted traffic split
  metadata?: Record<string, unknown>;
}

/**
 * Metric data for a variant
 */
export interface MetricData {
  variantId: string;
  metricId: string;
  values: number[];
  count: number;
  sum: number;
  mean: number;
  variance: number;
  stdDev: number;
  min: number;
  max: number;
}

/**
 * Individual test result
 */
export interface TestResult {
  variantId: string;
  metricId: string;
  value: number;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Aggregated test results
 */
export interface AggregatedResults {
  variantId: string;
  metrics: Map<string, MetricData>;
  impressions: number;
  engagements: number;
  completions: number;
  avgDuration: number; // seconds
  conversionRate: number; // 0-1
  bounceRate: number; // 0-1
}

/**
 * A/B test definition
 */
export interface ABTest {
  id: string;
  name: string;
  description: string;
  status: TestStatus;
  variants: UIVariant[];
  metrics: TestMetric[];
  trafficStrategy: TrafficStrategy;
  trafficSplit: number[]; // Must sum to 1.0
  targetSampleSize?: number;
  minSampleSize?: number;
  duration?: {
    start: Date;
    end?: Date;
    minDuration?: number; // milliseconds
  };
  significanceLevel: number; // alpha, typically 0.05
  power: number; // 1 - beta, typically 0.8
  mde: number; // Minimum detectable effect, 0-1
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  metadata?: Record<string, unknown>;
}

/**
 * Experiment configuration
 */
export interface ABTestConfig {
  id?: string;
  name: string;
  description?: string;
  variants: Array<{
    id: string;
    name: string;
    description?: string;
    ui: A2UIResponse;
    weight?: number;
  }>;
  metrics: TestMetric[];
  trafficStrategy?: TrafficStrategy;
  trafficSplit?: number[];
  targetSampleSize?: number;
  minSampleSize?: number;
  duration?: {
    start: Date;
    end?: Date;
    minDuration?: number;
  };
  significanceLevel?: number;
  power?: number;
  mde?: number;
  createdBy: string;
  metadata?: Record<string, unknown>;
}

/**
 * Storage backend for tests
 */
export interface ABTestStorage {
  getTest(testId: string): Promise<ABTest | null>;
  saveTest(test: ABTest): Promise<void>;
  deleteTest(testId: string): Promise<void>;
  listTests(filter?: { status?: TestStatus }): Promise<ABTest[]>;
  saveResult(testId: string, result: TestResult): Promise<void>;
  getResults(testId: string, variantId?: string): Promise<TestResult[]>;
  clearResults(testId: string): Promise<void>;
}

/**
 * Configuration for ABTestManager
 */
export interface ABTestManagerConfig {
  storage: ABTestStorage;
  autoAllocate?: boolean;
  enableBanditOptimization?: boolean;
  banditUpdateInterval?: number; // milliseconds
  defaultSignificanceLevel?: number;
  defaultPower?: number;
  defaultMDE?: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_MANAGER_CONFIG: Required<
  Omit<ABTestManagerConfig, "storage">
> = {
  autoAllocate: true,
  enableBanditOptimization: true,
  banditUpdateInterval: 60000, // 1 minute
  defaultSignificanceLevel: 0.05,
  defaultPower: 0.8,
  defaultMDE: 0.1, // 10% minimum detectable effect
};

// ============================================================================
// IN-MEMORY STORAGE (Default implementation)
// ============================================================================

/**
 * In-memory storage for A/B tests (for development/testing)
 */
export class InMemoryABTestStorage implements ABTestStorage {
  private tests: Map<string, ABTest> = new Map();
  private results: Map<string, TestResult[]> = new Map();

  async getTest(testId: string): Promise<ABTest | null> {
    return this.tests.get(testId) || null;
  }

  async saveTest(test: ABTest): Promise<void> {
    this.tests.set(test.id, test);
  }

  async deleteTest(testId: string): Promise<void> {
    this.tests.delete(testId);
    this.results.delete(testId);
  }

  async listTests(filter?: { status?: TestStatus }): Promise<ABTest[]> {
    let tests = Array.from(this.tests.values());
    if (filter?.status) {
      tests = tests.filter(t => t.status === filter.status);
    }
    return tests.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async saveResult(testId: string, result: TestResult): Promise<void> {
    if (!this.results.has(testId)) {
      this.results.set(testId, []);
    }
    this.results.get(testId)!.push(result);
  }

  async getResults(testId: string, variantId?: string): Promise<TestResult[]> {
    const results = this.results.get(testId) || [];
    if (variantId) {
      return results.filter(r => r.variantId === variantId);
    }
    return results;
  }

  async clearResults(testId: string): Promise<void> {
    this.results.set(testId, []);
  }

  clear(): void {
    this.tests.clear();
    this.results.clear();
  }

  size(): number {
    return this.tests.size;
  }
}

// ============================================================================
// A/B TEST MANAGER
// ============================================================================

/**
 * ABTestManager - Manage A/B testing experiments
 *
 * Handles creation, execution, and monitoring of A/B tests for UI variants.
 * Supports multiple traffic allocation strategies including multi-armed bandit.
 */
export class ABTestManager {
  private config: Required<Omit<ABTestManagerConfig, "storage">>;
  private storage: ABTestStorage;
  private banditState: Map<string, Map<string, number>> = new Map(); // testId -> variantId -> score

  constructor(config: ABTestManagerConfig) {
    this.config = {
      ...DEFAULT_MANAGER_CONFIG,
      ...config,
    };
    this.storage = config.storage;

    // Start bandit optimization loop if enabled
    if (this.config.enableBanditOptimization) {
      this.startBanditOptimization();
    }
  }

  /**
   * Create a new A/B test
   */
  async createTest(config: ABTestConfig): Promise<ABTest> {
    const test: ABTest = {
      id: config.id || this.generateId(),
      name: config.name,
      description: config.description || "",
      status: "draft",
      variants: config.variants.map(v => ({
        ...v,
        weight: v.weight ?? 1,
      })),
      metrics: config.metrics,
      trafficStrategy: config.trafficStrategy || "equal",
      trafficSplit: this.calculateInitialTrafficSplit(
        config.variants,
        config.trafficSplit
      ),
      targetSampleSize: config.targetSampleSize,
      minSampleSize: config.minSampleSize || 100,
      duration: config.duration,
      significanceLevel:
        config.significanceLevel || this.config.defaultSignificanceLevel,
      power: config.power || this.config.defaultPower,
      mde: config.mde || this.config.defaultMDE,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: config.createdBy,
      metadata: config.metadata,
    };

    // Initialize bandit state if needed
    if (
      test.trafficStrategy === "bandit" ||
      test.trafficStrategy === "thompson"
    ) {
      this.initializeBanditState(test);
    }

    await this.storage.saveTest(test);
    return test;
  }

  /**
   * Start a test
   */
  async startTest(testId: string): Promise<ABTest> {
    const test = await this.storage.getTest(testId);
    if (!test) {
      throw new Error(`Test not found: ${testId}`);
    }

    if (test.status !== "draft" && test.status !== "paused") {
      throw new Error(`Cannot start test in status: ${test.status}`);
    }

    test.status = "running";
    test.duration = test.duration || {
      start: new Date(),
    };
    if (!test.duration.start) {
      test.duration.start = new Date();
    }
    test.updatedAt = new Date();

    await this.storage.saveTest(test);
    return test;
  }

  /**
   * Pause a running test
   */
  async pauseTest(testId: string): Promise<ABTest> {
    const test = await this.storage.getTest(testId);
    if (!test) {
      throw new Error(`Test not found: ${testId}`);
    }

    if (test.status !== "running") {
      throw new Error(`Cannot pause test in status: ${test.status}`);
    }

    test.status = "paused";
    test.updatedAt = new Date();
    await this.storage.saveTest(test);
    return test;
  }

  /**
   * Complete a test
   */
  async completeTest(testId: string): Promise<ABTest> {
    const test = await this.storage.getTest(testId);
    if (!test) {
      throw new Error(`Test not found: ${testId}`);
    }

    test.status = "completed";
    if (test.duration) {
      test.duration.end = new Date();
    }
    test.updatedAt = new Date();
    await this.storage.saveTest(test);
    return test;
  }

  /**
   * Allocate a user to a variant
   */
  async allocateVariant(
    testId: string,
    userId: string,
    sessionId?: string
  ): Promise<UIVariant> {
    const test = await this.storage.getTest(testId);
    if (!test) {
      throw new Error(`Test not found: ${testId}`);
    }

    if (test.status !== "running") {
      throw new Error(`Test is not running: ${test.status}`);
    }

    // Consistent hashing for user allocation
    const hash = this.hashUserId(userId, testId);
    const variantIndex = this.selectVariantIndex(test, hash);
    const variant = test.variants[variantIndex];

    // Record impression
    await this.recordMetric(testId, variant.id, "impressions", 1, {
      userId,
      sessionId,
    });

    return variant;
  }

  /**
   * Record a metric for a variant
   */
  async recordMetric(
    testId: string,
    variantId: string,
    metricName: string,
    value: number,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const result: TestResult = {
      variantId,
      metricId: metricName,
      value,
      timestamp: new Date(),
      userId: metadata?.userId as string | undefined,
      sessionId: metadata?.sessionId as string | undefined,
      metadata,
    };

    await this.storage.saveResult(testId, result);
  }

  /**
   * Get aggregated results for a test
   */
  async getAggregatedResults(testId: string): Promise<AggregatedResults[]> {
    const test = await this.storage.getTest(testId);
    if (!test) {
      throw new Error(`Test not found: ${testId}`);
    }

    const results: AggregatedResults[] = [];

    for (const variant of test.variants) {
      const variantResults = await this.storage.getResults(testId, variant.id);

      const metricsMap = new Map<string, MetricData>();
      const metricValues = new Map<string, number[]>();

      // Group values by metric
      for (const result of variantResults) {
        if (!metricValues.has(result.metricId)) {
          metricValues.set(result.metricId, []);
        }
        metricValues.get(result.metricId)!.push(result.value);
      }

      // Calculate statistics for each metric
      for (const [metricId, values] of metricValues) {
        const metricData = this.calculateMetricStats(metricId, values);
        metricsMap.set(metricId, metricData);
      }

      // Calculate high-level metrics (sum the actual values)
      const impressions = variantResults
        .filter(r => r.metricId === "impressions")
        .reduce((sum, r) => sum + r.value, 0);
      const engagements = variantResults
        .filter(r => r.metricId === "engagements")
        .reduce((sum, r) => sum + r.value, 0);
      const completions = variantResults
        .filter(r => r.metricId === "completions")
        .reduce((sum, r) => sum + r.value, 0);

      results.push({
        variantId: variant.id,
        metrics: metricsMap,
        impressions,
        engagements,
        completions,
        avgDuration: this.getAverage(variantResults, "duration"),
        conversionRate: impressions > 0 ? completions / impressions : 0,
        bounceRate: this.calculateBounceRate(variantResults),
      });
    }

    return results;
  }

  /**
   * Get test by ID
   */
  async getTest(testId: string): Promise<ABTest | null> {
    return this.storage.getTest(testId);
  }

  /**
   * List all tests
   */
  async listTests(filter?: { status?: TestStatus }): Promise<ABTest[]> {
    return this.storage.listTests(filter);
  }

  /**
   * Delete a test
   */
  async deleteTest(testId: string): Promise<void> {
    await this.storage.deleteTest(testId);
    this.banditState.delete(testId);
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Calculate initial traffic split
   */
  private calculateInitialTrafficSplit(
    variants: Array<{ weight?: number }>,
    customSplit?: number[]
  ): number[] {
    if (customSplit && customSplit.length === variants.length) {
      // Validate sum
      const sum = customSplit.reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 1.0) < 0.001) {
        return customSplit;
      }
    }

    // Equal split
    const equal = 1 / variants.length;
    return variants.map(() => equal);
  }

  /**
   * Select variant index based on traffic strategy
   */
  private selectVariantIndex(test: ABTest, userHash: number): number {
    switch (test.trafficStrategy) {
      case "equal":
      case "weighted":
        return this.selectByTrafficSplit(test.trafficSplit, userHash);

      case "bandit":
        return this.selectByBandit(test.id, test.variants, test.trafficSplit);

      case "thompson":
        return this.selectByThompsonSampling(test.id, test.variants);

      default:
        return 0;
    }
  }

  /**
   * Select variant by traffic split
   */
  private selectByTrafficSplit(split: number[], hash: number): number {
    const cumulative: number[] = [];
    let sum = 0;
    for (const s of split) {
      sum += s;
      cumulative.push(sum);
    }

    const value = (hash % 10000) / 10000; // 0-1
    for (let i = 0; i < cumulative.length; i++) {
      if (value < cumulative[i]) {
        return i;
      }
    }
    return cumulative.length - 1;
  }

  /**
   * Select variant using epsilon-greedy bandit
   */
  private selectByBandit(
    testId: string,
    variants: UIVariant[],
    baseSplit: number[]
  ): number {
    const state = this.banditState.get(testId);
    if (!state || state.size === 0) {
      return this.selectByTrafficSplit(baseSplit, Math.random());
    }

    // Epsilon-greedy: 10% exploration, 90% exploitation
    const epsilon = 0.1;
    if (Math.random() < epsilon) {
      return Math.floor(Math.random() * variants.length);
    }

    // Exploit: select best variant
    let bestIndex = 0;
    let bestScore = -Infinity;
    for (const [variantId, score] of state) {
      const index = variants.findIndex(v => v.id === variantId);
      if (index >= 0 && score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    return bestIndex;
  }

  /**
   * Select variant using Thompson sampling
   */
  private selectByThompsonSampling(
    testId: string,
    variants: UIVariant[]
  ): number {
    const state = this.banditState.get(testId);
    if (!state || state.size === 0) {
      return Math.floor(Math.random() * variants.length);
    }

    // Sample from Beta distribution for each variant
    const samples: number[] = [];
    for (const variant of variants) {
      const stats = state.get(variant.id) || { alpha: 1, beta: 1 };
      const sample = this.betaSample(
        stats.alpha as number,
        stats.beta as number
      );
      samples.push(sample);
    }

    // Select variant with highest sample
    return samples.indexOf(Math.max(...samples));
  }

  /**
   * Initialize bandit state
   */
  private initializeBanditState(test: ABTest): void {
    const state = new Map<string, number>();
    for (const variant of test.variants) {
      state.set(variant.id, 0);
    }
    this.banditState.set(test.id, state);
  }

  /**
   * Update bandit scores periodically
   */
  private async updateBanditScores(): Promise<void> {
    for (const testId of this.banditState.keys()) {
      const test = await this.storage.getTest(testId);
      if (!test || test.status !== "running") {
        continue;
      }

      const results = await this.getAggregatedResults(testId);
      const state = this.banditState.get(testId)!;

      for (const result of results) {
        // Use conversion rate as score
        const score = result.conversionRate;
        state.set(result.variantId, score);
      }
    }
  }

  /**
   * Start bandit optimization loop
   */
  private startBanditOptimization(): void {
    setInterval(() => {
      this.updateBanditScores().catch(console.error);
    }, this.config.banditUpdateInterval);
  }

  /**
   * Calculate metric statistics
   */
  private calculateMetricStats(metricId: string, values: number[]): MetricData {
    if (values.length === 0) {
      return {
        variantId: "",
        metricId,
        values: [],
        count: 0,
        sum: 0,
        mean: 0,
        variance: 0,
        stdDev: 0,
        min: 0,
        max: 0,
      };
    }

    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / count;
    const variance =
      values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / count;
    const stdDev = Math.sqrt(variance);
    const min = Math.min(...values);
    const max = Math.max(...values);

    return {
      variantId: "",
      metricId,
      values,
      count,
      sum,
      mean,
      variance,
      stdDev,
      min,
      max,
    };
  }

  /**
   * Get average value for a metric
   */
  private getAverage(results: TestResult[], metricId: string): number {
    const filtered = results.filter(r => r.metricId === metricId);
    if (filtered.length === 0) return 0;
    return filtered.reduce((a, b) => a + b.value, 0) / filtered.length;
  }

  /**
   * Calculate bounce rate
   */
  private calculateBounceRate(results: TestResult[]): number {
    const impressions = results.filter(
      r => r.metricId === "impressions"
    ).length;
    const engagements = results.filter(
      r => r.metricId === "engagements"
    ).length;
    return impressions > 0 ? 1 - engagements / impressions : 0;
  }

  /**
   * Hash user ID for consistent allocation
   */
  private hashUserId(userId: string, testId: string): number {
    const combined = `${userId}:${testId}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      hash = (hash << 5) - hash + combined.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Sample from Beta distribution
   */
  private betaSample(alpha: number, beta: number): number {
    // Simple approximation using gamma
    const u1 = Math.random();
    const u2 = Math.random();
    const x = Math.pow(u1, 1 / alpha);
    const y = Math.pow(u2, 1 / beta);
    return x / (x + y);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create an A/B test manager with default in-memory storage
 */
export function createABTestManager(
  config?: Partial<ABTestManagerConfig>
): ABTestManager {
  const storage = new InMemoryABTestStorage();
  return new ABTestManager({
    ...config,
    storage,
  });
}

/**
 * @lsi/vljepa/planning/AdaptivePlanner - Zero-Shot Planning Component
 *
 * Learns from feedback and improves planning over time.
 * Uses execution results to refine action generation.
 *
 * Key Concepts:
 * - Feedback Learning: Improve from user feedback
 * - Plan Refinement: Adjust based on results
 * - A/B Testing: Try multiple approaches
 * - Success Metrics: Track and optimize performance
 *
 * @version 1.0.0
 * @see https://arxiv.org/abs/2512.10942 - VL-JEPA Paper (Section on Adaptive Learning)
 */

import type {
  ActionSequence,
  PlannedAction,
} from "./ActionSequenceGenerator.js";
import type { EmbeddingDelta } from "./EmbeddingDeltaCalculator.js";
import type { VisualState, GoalState } from "./EmbeddingDeltaCalculator.js";
import type { ValidationReport } from "./PlanValidator.js";
import {
  cosineSimilarity,
  euclideanDistance,
  DEFAULT_EMBEDDING_DIM,
} from "../index.js";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Execution Result - Result of executing a plan
 *
 * Represents the outcome after executing an action sequence.
 */
export interface ExecutionResult {
  /** Plan that was executed */
  plan: ActionSequence;

  /** Actual outcome state */
  actualOutcome: VisualState;

  /** How close to goal (0-1, 1 = perfect match) */
  match: number;

  /** User feedback */
  userFeedback: "approved" | "modified" | "rejected";

  /** Timestamp */
  timestamp: number;

  /** Execution duration (ms) */
  executionDuration: number;

  /** Actions that succeeded */
  successfulActions: string[];

  /** Actions that failed */
  failedActions: string[];

  /** Error messages */
  errors: string[];

  /** Modified actions (if user modified) */
  modifiedActions?: Array<{
    originalAction: PlannedAction;
    modifiedAction: PlannedAction;
    reason: string;
  }>;

  /** Additional notes */
  notes?: string;
}

/**
 * Planning History - Historical planning data
 *
 * Represents the history of plans and their outcomes.
 */
export interface PlanningHistory {
  /** All plans generated */
  plans: ActionSequence[];

  /** Results of executed plans */
  results: ExecutionResult[];

  /** Overall success rate (0-1) */
  successRate: number;

  /** Average accuracy (how close to goal) */
  averageAccuracy: number;

  /** Average confidence */
  averageConfidence: number;

  /** Total plans generated */
  totalPlans: number;

  /** Total plans executed */
  totalExecuted: number;

  /** Total user approvals */
  totalApprovals: number;

  /** Total user rejections */
  totalRejections: number;

  /** Learning progress */
  learningProgress: {
    /** Initial accuracy */
    initialAccuracy: number;

    /** Current accuracy */
    currentAccuracy: number;

    /** Improvement percentage */
    improvement: number;

    /** Number of learning iterations */
    iterations: number;
  };
}

/**
 * Performance Metrics - Planner performance metrics
 *
 * Tracks various metrics about planner performance.
 */
export interface PerformanceMetrics {
  /** Plan generation time (ms) */
  generationTime: number;

  /** Plan execution time (ms) */
  executionTime: number;

  /** Goal achievement rate (0-1) */
  achievementRate: number;

  /** User satisfaction rate (0-1) */
  satisfactionRate: number;

  /** Average plan quality (0-1) */
  planQuality: number;

  /** Action success rate (0-1) */
  actionSuccessRate: number;

  /** Error recovery rate (0-1) */
  errorRecoveryRate: number;
}

/**
 * Learning Pattern - Learned planning pattern
 *
 * Represents a pattern learned from successful plans.
 */
export interface LearningPattern {
  /** Pattern ID */
  id: string;

  /** Pattern name */
  name: string;

  /** Delta characteristics */
  deltaCharacteristics: {
    /** Complexity range */
    complexityRange: [number, number];

    /** Common change types */
    commonChangeTypes: string[];

    /** Typical magnitude range */
    magnitudeRange: [number, number];
  };

  /** Effective action sequence template */
  actionTemplate: Array<{
    /** Action type */
    type: PlannedAction["type"];

    /** Target pattern (regex for selector) */
    targetPattern: string;

    /** Parameter hints */
    paramHints: Record<string, unknown>;

    /** Relative order */
    order: number;
  }>;

  /** Success rate for this pattern */
  successRate: number;

  /** Number of times used */
  usageCount: number;

  /** Last used timestamp */
  lastUsed: number;

  /** Confidence in this pattern (0-1) */
  confidence: number;
}

/**
 * Adaptive Configuration
 */
export interface AdaptiveConfig {
  /** Whether learning is enabled */
  learningEnabled: boolean;

  /** Feedback weight (0-1, how much to adjust) */
  feedbackWeight: number;

  /** Exploration rate (0-1, try new approaches) */
  explorationRate: number;

  /** Minimum history size for learning */
  minHistorySize: number;

  /** Maximum history size */
  maxHistorySize: number;

  /** Pattern learning threshold (minimum success rate) */
  patternThreshold: number;

  /** Whether to use A/B testing */
  useABTesting: boolean;

  /** Number of alternatives for A/B testing */
  abTestCount: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default adaptive configuration
 */
export const DEFAULT_ADAPTIVE_CONFIG: AdaptiveConfig = {
  learningEnabled: true,
  feedbackWeight: 0.5,
  explorationRate: 0.2,
  minHistorySize: 10,
  maxHistorySize: 1000,
  patternThreshold: 0.7,
  useABTesting: true,
  abTestCount: 3,
};

// ============================================================================
// ADAPTIVE PLANNER
// ============================================================================

/**
 * Adaptive Planner
 *
 * Learns from feedback and improves planning over time.
 *
 * @example
 * ```typescript
 * const planner = new AdaptivePlanner();
 *
 * // Generate plan
 * const plan = await planner.generatePlan(delta, context);
 *
 * // After execution, record result
 * await planner.recordResult(plan, actualState, match, userFeedback);
 *
 * // Next plan will be improved based on feedback
 * const improvedPlan = await planner.generatePlan(newDelta, context);
 * ```
 */
export class AdaptivePlanner {
  private config: AdaptiveConfig;
  private history: PlanningHistory;
  private patterns: LearningPattern[];

  constructor(config: Partial<AdaptiveConfig> = {}) {
    this.config = { ...DEFAULT_ADAPTIVE_CONFIG, ...config };
    this.history = this.initializeHistory();
    this.patterns = [];
  }

  /**
   * Generate plan with learning from history
   *
   * @param delta - Embedding delta
   * @param generatePlan - Function to generate base plan
   * @returns Improved action sequence
   */
  async generateWithLearning(
    delta: EmbeddingDelta,
    generatePlan: (delta: EmbeddingDelta) => Promise<ActionSequence>
  ): Promise<ActionSequence> {
    let plan = await generatePlan(delta);

    // Apply learned patterns if enabled
    if (this.config.learningEnabled && this.patterns.length > 0) {
      const applicablePatterns = this.findApplicablePatterns(delta);

      if (applicablePatterns.length > 0) {
        // Sort by confidence and success rate
        applicablePatterns.sort(
          (a, b) => b.confidence * b.successRate - a.confidence * a.successRate
        );

        // Apply best matching pattern
        const pattern = applicablePatterns[0];
        plan = this.applyPattern(plan, pattern);
      }
    }

    // Add to history
    this.history.plans.push(plan);

    return plan;
  }

  /**
   * Record execution result for learning
   *
   * @param result - Execution result
   */
  async recordResult(result: ExecutionResult): Promise<void> {
    // Add to history
    this.history.results.push(result);

    // Update metrics
    this.updateMetrics(result);

    // Trim history if needed
    if (this.history.results.length > this.config.maxHistorySize) {
      this.history.results = this.history.results.slice(
        -this.config.maxHistorySize
      );
    }

    // Learn from result if enabled
    if (this.config.learningEnabled) {
      await this.learnFromResult(result);
    }

    // Update patterns periodically
    if (this.history.results.length % 20 === 0) {
      await this.updatePatterns();
    }
  }

  /**
   * Generate alternative plans for A/B testing
   *
   * @param delta - Embedding delta
   * @param generatePlan - Function to generate plans
   * @returns Array of alternative plans
   */
  async generateAlternatives(
    delta: EmbeddingDelta,
    generatePlan: (
      delta: EmbeddingDelta,
      variation: number
    ) => Promise<ActionSequence>
  ): Promise<ActionSequence[]> {
    if (!this.config.useABTesting) {
      return [await generatePlan(delta, 0)];
    }

    const alternatives: ActionSequence[] = [];

    for (let i = 0; i < this.config.abTestCount; i++) {
      const plan = await generatePlan(delta, i);
      alternatives.push(plan);
    }

    return alternatives;
  }

  /**
   * Select best plan from alternatives based on learned preferences
   *
   * @param alternatives - Alternative plans
   * @returns Best plan
   */
  selectBestPlan(alternatives: ActionSequence[]): ActionSequence {
    if (alternatives.length === 0) {
      throw new Error("No alternatives provided");
    }

    if (alternatives.length === 1) {
      return alternatives[0];
    }

    // Score each alternative
    const scored = alternatives.map(plan => ({
      plan,
      score: this.scorePlan(plan),
    }));

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    // Add exploration randomness
    if (Math.random() < this.config.explorationRate) {
      // Select random from top 2
      const top2 = scored.slice(0, 2);
      return top2[Math.floor(Math.random() * top2.length)].plan;
    }

    return scored[0].plan;
  }

  /**
   * Find applicable learning patterns for delta
   */
  private findApplicablePatterns(delta: EmbeddingDelta): LearningPattern[] {
    return this.patterns.filter(pattern => {
      // Check complexity match
      const [minComplexity, maxComplexity] =
        pattern.deltaCharacteristics.complexityRange;
      if (
        delta.complexity < minComplexity ||
        delta.complexity > maxComplexity
      ) {
        return false;
      }

      // Check change type match
      const changeTypes = delta.semanticChanges.map(c => c.type);
      const hasMatchingType =
        pattern.deltaCharacteristics.commonChangeTypes.some(type =>
          changeTypes.includes(type as any)
        );

      if (!hasMatchingType) {
        return false;
      }

      return true;
    });
  }

  /**
   * Apply learning pattern to plan
   */
  private applyPattern(
    plan: ActionSequence,
    pattern: LearningPattern
  ): ActionSequence {
    // Create modified plan based on pattern
    const modifiedActions = plan.actions.map((action, index) => {
      const templateAction = pattern.actionTemplate.find(
        t => t.order === index
      );

      if (templateAction && templateAction.type === action.type) {
        // Apply parameter hints
        const modifiedParams = { ...action.params };

        for (const [key, value] of Object.entries(templateAction.paramHints)) {
          if (!(key in modifiedParams)) {
            modifiedParams[key] = value;
          }
        }

        return {
          ...action,
          params: modifiedParams,
          confidence: Math.min(1, action.confidence + pattern.confidence * 0.1),
        };
      }

      return action;
    });

    return {
      ...plan,
      actions: modifiedActions,
      confidence: Math.min(1, plan.confidence + pattern.successRate * 0.1),
    };
  }

  /**
   * Learn from execution result
   */
  private async learnFromResult(result: ExecutionResult): Promise<void> {
    // If user approved, reinforce successful actions
    if (result.userFeedback === "approved") {
      for (const actionId of result.successfulActions) {
        await this.reinforceAction(actionId, result.match);
      }
    }

    // If user modified, learn from modifications
    if (result.userFeedback === "modified" && result.modifiedActions) {
      for (const mod of result.modifiedActions) {
        await this.learnFromModification(
          mod.originalAction,
          mod.modifiedAction,
          mod.reason
        );
      }
    }

    // If user rejected, learn what to avoid
    if (result.userFeedback === "rejected") {
      for (const actionId of result.failedActions) {
        await this.punishAction(actionId);
      }
    }
  }

  /**
   * Reinforce successful action
   */
  private async reinforceAction(
    actionId: string,
    match: number
  ): Promise<void> {
    // In a full implementation, this would update action preferences
    // For now, we track the reinforcement
    console.log(
      `[AdaptivePlanner] Reinforcing action ${actionId} (match: ${match.toFixed(2)})`
    );
  }

  /**
   * Learn from user modification
   */
  private async learnFromModification(
    originalAction: PlannedAction,
    modifiedAction: PlannedAction,
    reason: string
  ): Promise<void> {
    // In a full implementation, this would learn the modification pattern
    console.log(`[AdaptivePlanner] Learning modification: ${reason}`);
  }

  /**
   * Punish failed action
   */
  private async punishAction(actionId: string): Promise<void> {
    // In a full implementation, this would reduce action preference
    console.log(`[AdaptivePlanner] Punishing action ${actionId}`);
  }

  /**
   * Update learning patterns from history
   */
  private async updatePatterns(): Promise<void> {
    if (this.history.results.length < this.config.minHistorySize) {
      return;
    }

    // Group successful results by characteristics
    const successfulResults = this.history.results.filter(
      r => r.userFeedback === "approved" && r.match > 0.8
    );

    // Extract patterns from successful results
    for (const result of successfulResults) {
      const pattern = this.extractPattern(result);

      if (pattern && pattern.successRate >= this.config.patternThreshold) {
        // Add or update pattern
        const existingIndex = this.patterns.findIndex(p => p.id === pattern.id);

        if (existingIndex >= 0) {
          this.patterns[existingIndex] = pattern;
        } else {
          this.patterns.push(pattern);
        }
      }
    }

    // Limit patterns
    this.patterns = this.patterns
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 50); // Keep top 50 patterns
  }

  /**
   * Extract pattern from successful result
   */
  private extractPattern(result: ExecutionResult): LearningPattern | null {
    const plan = result.plan;

    // Find similar previous results
    const similarResults = this.history.results.filter(
      r =>
        r.plan.metadata.primaryChangeType === plan.metadata.primaryChangeType &&
        r.plan.metadata.complexity >= plan.metadata.complexity - 0.2 &&
        r.plan.metadata.complexity <= plan.metadata.complexity + 0.2
    );

    if (similarResults.length < 5) {
      return null; // Not enough data
    }

    // Calculate success rate
    const successRate =
      similarResults.filter(r => r.userFeedback === "approved" && r.match > 0.7)
        .length / similarResults.length;

    if (successRate < this.config.patternThreshold) {
      return null; // Pattern not successful enough
    }

    // Extract action template
    const actionTemplate = plan.actions.map((action, index) => ({
      type: action.type,
      targetPattern: this.extractTargetPattern(action.target),
      paramHints: this.extractParamHints(action.params),
      order: index,
    }));

    return {
      id: `pattern-${plan.metadata.primaryChangeType}-${Math.round(plan.metadata.complexity * 10)}`,
      name: `${plan.metadata.primaryChangeType} pattern (complexity: ${plan.metadata.complexity.toFixed(1)})`,
      deltaCharacteristics: {
        complexityRange: [
          Math.max(0, plan.metadata.complexity - 0.2),
          Math.min(1, plan.metadata.complexity + 0.2),
        ],
        commonChangeTypes: [plan.metadata.primaryChangeType],
        magnitudeRange: [0, 2], // Default range
      },
      actionTemplate,
      successRate,
      usageCount: similarResults.length,
      lastUsed: result.timestamp,
      confidence: Math.min(1, (successRate * similarResults.length) / 20),
    };
  }

  /**
   * Extract target pattern from selector
   */
  private extractTargetPattern(target: string): string {
    // Simple pattern extraction (in practice, more sophisticated)
    if (target.startsWith("#")) {
      return "#.*"; // Any ID
    } else if (target.startsWith(".")) {
      return "\\..*"; // Any class
    } else {
      return target; // Exact match
    }
  }

  /**
   * Extract parameter hints
   */
  private extractParamHints(
    params: Record<string, unknown>
  ): Record<string, unknown> {
    // Return params as hints (in practice, would extract patterns)
    return { ...params };
  }

  /**
   * Score plan based on learned preferences
   */
  private scorePlan(plan: ActionSequence): number {
    let score = plan.confidence;

    // Boost low-risk plans
    if (plan.metadata.risk === "low") {
      score += 0.1;
    } else if (plan.metadata.risk === "high") {
      score -= 0.2;
    }

    // Boost efficient plans
    if (plan.totalEstimatedTime < 5000) {
      score += 0.1;
    }

    // Boost simple plans
    if (plan.metadata.complexity < 0.5) {
      score += 0.05;
    }

    // Boost reversible plans
    const reversibleCount = plan.actions.filter(a => a.reversible).length;
    if (reversibleCount === plan.actions.length) {
      score += 0.1;
    }

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Update metrics from result
   */
  private updateMetrics(result: ExecutionResult): Promise<void> {
    // Update counts
    this.history.totalExecuted++;

    if (result.userFeedback === "approved") {
      this.history.totalApprovals++;
    } else if (result.userFeedback === "rejected") {
      this.history.totalRejections++;
    }

    // Update rates
    this.history.successRate =
      this.history.totalApprovals / this.history.totalExecuted;

    // Update average accuracy
    const totalAccuracy = this.history.results.reduce(
      (sum, r) => sum + r.match,
      0
    );
    this.history.averageAccuracy = totalAccuracy / this.history.results.length;

    // Update average confidence
    const totalConfidence = this.history.plans.reduce(
      (sum, p) => sum + p.confidence,
      0
    );
    this.history.averageConfidence =
      totalConfidence / this.history.plans.length;

    // Update learning progress
    this.history.learningProgress.currentAccuracy =
      this.history.averageAccuracy;
    this.history.learningProgress.improvement =
      ((this.history.averageAccuracy -
        this.history.learningProgress.initialAccuracy) /
        this.history.learningProgress.initialAccuracy) *
      100;
    this.history.learningProgress.iterations = this.history.totalExecuted;

    return Promise.resolve();
  }

  /**
   * Initialize history
   */
  private initializeHistory(): PlanningHistory {
    return {
      plans: [],
      results: [],
      successRate: 0,
      averageAccuracy: 0.5, // Starting assumption
      averageConfidence: 0.5,
      totalPlans: 0,
      totalExecuted: 0,
      totalApprovals: 0,
      totalRejections: 0,
      learningProgress: {
        initialAccuracy: 0.5,
        currentAccuracy: 0.5,
        improvement: 0,
        iterations: 0,
      },
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const results = this.history.results;
    if (results.length === 0) {
      return {
        generationTime: 0,
        executionTime: 0,
        achievementRate: 0,
        satisfactionRate: 0,
        planQuality: 0.5,
        actionSuccessRate: 0,
        errorRecoveryRate: 0,
      };
    }

    const avgExecutionTime =
      results.reduce((sum, r) => sum + r.executionDuration, 0) / results.length;
    const achievementRate =
      results.reduce((sum, r) => sum + r.match, 0) / results.length;
    const satisfactionRate = this.history.successRate;

    const totalActions = results.reduce(
      (sum, r) => sum + r.plan.actions.length,
      0
    );
    const successfulActions = results.reduce(
      (sum, r) => sum + r.successfulActions.length,
      0
    );
    const actionSuccessRate = successfulActions / totalActions;

    const errorRecoveryRate =
      results.filter(
        r => r.failedActions.length > 0 && r.userFeedback === "approved"
      ).length / results.length;

    return {
      generationTime: 0, // Would need to track this
      executionTime: avgExecutionTime,
      achievementRate,
      satisfactionRate,
      planQuality: this.history.averageConfidence,
      actionSuccessRate,
      errorRecoveryRate,
    };
  }

  /**
   * Get history
   */
  getHistory(): PlanningHistory {
    return { ...this.history };
  }

  /**
   * Get patterns
   */
  getPatterns(): LearningPattern[] {
    return [...this.patterns];
  }

  /**
   * Get configuration
   */
  getConfig(): AdaptiveConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AdaptiveConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = this.initializeHistory();
  }

  /**
   * Clear patterns
   */
  clearPatterns(): void {
    this.patterns = [];
  }

  /**
   * Export state (for persistence)
   */
  exportState(): {
    config: AdaptiveConfig;
    history: PlanningHistory;
    patterns: LearningPattern[];
  } {
    return {
      config: this.config,
      history: this.history,
      patterns: this.patterns,
    };
  }

  /**
   * Import state (for persistence)
   */
  importState(state: {
    config?: Partial<AdaptiveConfig>;
    history?: PlanningHistory;
    patterns?: LearningPattern[];
  }): void {
    if (state.config) {
      this.config = { ...this.config, ...state.config };
    }

    if (state.history) {
      this.history = state.history;
    }

    if (state.patterns) {
      this.patterns = state.patterns;
    }
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create adaptive planner with default config
 */
export function createAdaptivePlanner(
  config?: Partial<AdaptiveConfig>
): AdaptivePlanner {
  return new AdaptivePlanner(config);
}

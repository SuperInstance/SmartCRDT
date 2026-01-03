/**
 * CostAwareRouter - Cost-aware routing for AI requests
 *
 * Routes AI requests based on cost, quality, and user preferences.
 * Supports three modes:
 * - Economy: Minimize cost, prefer local models
 * - Balanced: Balance cost and quality
 * - Performance: Maximize quality, ignore cost
 *
 * Integrates with PricingService, TokenEstimator, and BudgetTracker.
 */

import type {
  CostAwareConfig,
  CostAwareRoutingResult,
  CostMode,
  ModelRecommendation,
  QueryContext,
} from "../types.js";
import { PricingService, type ModelPricing } from "./PricingService.js";
import { TokenEstimator } from "./TokenEstimator.js";
import { BudgetTracker } from "./BudgetTracker.js";

/**
 * CostAwareRouter class
 */
export class CostAwareRouter {
  private pricing: PricingService;
  private tokenEstimator: TokenEstimator;
  private budgetTracker: BudgetTracker | null;
  private config: Required<CostAwareConfig>;

  // Default models by provider
  private readonly DEFAULT_LOCAL_MODEL = "llama2:70b";
  private readonly DEFAULT_CLOUD_MODEL = "gpt-3.5-turbo";
  private readonly DEFAULT_PERFORMANCE_MODEL = "gpt-4-turbo";

  constructor(config: CostAwareConfig = { mode: "balanced" }) {
    this.config = {
      mode: config.mode,
      maxCostPerRequest: config.maxCostPerRequest ?? Infinity,
      budgetLimit: config.budgetLimit ?? 100,
      preferLocal: config.preferLocal ?? false,
      warningThreshold: config.warningThreshold ?? 0.7,
      criticalThreshold: config.criticalThreshold ?? 0.9,
      blockOnExceed: config.blockOnExceed ?? true,
      modelWeights: config.modelWeights ?? {},
    };

    this.pricing = new PricingService();
    this.tokenEstimator = new TokenEstimator();

    // Initialize budget tracker if budget limit is set
    this.budgetTracker =
      this.config.budgetLimit > 0
        ? new BudgetTracker({
            budgetLimit: this.config.budgetLimit,
            warningThreshold: this.config.warningThreshold,
            criticalThreshold: this.config.criticalThreshold,
            blockOnExceed: this.config.blockOnExceed,
          })
        : null;
  }

  /**
   * Route a query to the optimal model based on cost configuration
   */
  route(
    query: string,
    complexity: number = 0.5,
    context?: QueryContext
  ): CostAwareRoutingResult {
    // Estimate tokens
    const tokenEstimate = this.tokenEstimator.estimate(query);
    const estimatedOutputTokens = this.tokenEstimator.estimateOutputFromInput(
      tokenEstimate.inputTokens,
      complexity
    );

    // Get routing recommendation based on mode
    const recommendation = this.getRecommendation(
      query,
      complexity,
      tokenEstimate.inputTokens,
      estimatedOutputTokens
    );

    // Check budget
    const withinBudget = this.checkBudget(recommendation.estimatedCost);

    // Build result
    const result: CostAwareRoutingResult = {
      backend: recommendation.provider === "local" ? "local" : "cloud",
      model: recommendation.model,
      estimatedCost: recommendation.estimatedCost,
      reason: recommendation.reasoning,
      confidence: recommendation.score,
      estimatedLatency: recommendation.estimatedLatency,
      withinBudget,
      notes: [],
    };

    // Add notes
    result.notes?.push(
      `Tokens: ~${tokenEstimate.inputTokens} input, ~${estimatedOutputTokens} output`
    );
    result.notes?.push(`Mode: ${this.config.mode}`);

    if (!withinBudget) {
      result.notes?.push("WARNING: Request exceeds budget limit");
    }

    if (recommendation.estimatedCost > this.config.maxCostPerRequest) {
      result.notes?.push(
        `WARNING: Cost exceeds max per-request limit ($${this.config.maxCostPerRequest.toFixed(4)})`
      );
    }

    // Record cost if tracking budget
    if (this.budgetTracker && withinBudget) {
      this.budgetTracker.recordCost(
        recommendation.model,
        recommendation.estimatedCost
      );
    }

    return result;
  }

  /**
   * Get model recommendation based on mode and complexity
   */
  private getRecommendation(
    query: string,
    complexity: number,
    inputTokens: number,
    outputTokens: number
  ): ModelRecommendation {
    switch (this.config.mode) {
      case "economy":
        return this.getEconomyRecommendation(
          query,
          complexity,
          inputTokens,
          outputTokens
        );
      case "performance":
        return this.getPerformanceRecommendation(
          query,
          complexity,
          inputTokens,
          outputTokens
        );
      case "balanced":
      default:
        return this.getBalancedRecommendation(
          query,
          complexity,
          inputTokens,
          outputTokens
        );
    }
  }

  /**
   * Economy mode recommendation - minimize cost
   */
  private getEconomyRecommendation(
    query: string,
    complexity: number,
    inputTokens: number,
    outputTokens: number
  ): ModelRecommendation {
    // Always try local first
    const localModel = this.pricing.getCheapestModel(
      Math.ceil(complexity * 3),
      true
    );

    if (localModel) {
      const pricing = this.pricing.getModelPricing(localModel)!;
      const cost = this.pricing.estimateCost(
        localModel,
        inputTokens,
        outputTokens
      )!;

      // Check if local can handle the complexity
      if (pricing.qualityTier >= complexity * 5) {
        return {
          model: localModel,
          provider: "local",
          qualityTier: pricing.qualityTier,
          estimatedCost: cost.estimatedCost,
          estimatedLatency: pricing.avgLatency,
          score: 0.9,
          reasoning: `Economy mode: Using free local model (${localModel}) to minimize cost`,
        };
      }
    }

    // Fall back to cheapest cloud model
    const cheapestCloud =
      this.pricing.getCheapestModel(3, false) || this.DEFAULT_CLOUD_MODEL;
    const pricing = this.pricing.getModelPricing(cheapestCloud)!;
    const cost = this.pricing.estimateCost(
      cheapestCloud,
      inputTokens,
      outputTokens
    )!;

    return {
      model: cheapestCloud,
      provider: pricing.provider,
      qualityTier: pricing.qualityTier,
      estimatedCost: cost.estimatedCost,
      estimatedLatency: pricing.avgLatency,
      score: 0.7,
      reasoning: `Economy mode: Using cheapest cloud model (${cheapestCloud}) - local model insufficient for complexity`,
    };
  }

  /**
   * Performance mode recommendation - maximize quality
   */
  private getPerformanceRecommendation(
    query: string,
    complexity: number,
    inputTokens: number,
    outputTokens: number
  ): ModelRecommendation {
    // Use best quality cloud model
    const bestModel =
      this.pricing.getBestQualityModel() || this.DEFAULT_PERFORMANCE_MODEL;
    const pricing = this.pricing.getModelPricing(bestModel)!;
    const cost = this.pricing.estimateCost(
      bestModel,
      inputTokens,
      outputTokens
    )!;

    return {
      model: bestModel,
      provider: pricing.provider,
      qualityTier: pricing.qualityTier,
      estimatedCost: cost.estimatedCost,
      estimatedLatency: pricing.avgLatency,
      score: 0.95,
      reasoning: `Performance mode: Using best quality model (${bestModel}) regardless of cost`,
    };
  }

  /**
   * Balanced mode recommendation - balance cost and quality
   */
  private getBalancedRecommendation(
    query: string,
    complexity: number,
    inputTokens: number,
    outputTokens: number
  ): ModelRecommendation {
    // Weights for scoring
    const QUALITY_WEIGHT = 0.7;
    const COST_WEIGHT = 0.3;

    // Get available models
    const allModels = this.pricing.getAllModels();
    const recommendations: ModelRecommendation[] = [];

    for (const model of allModels) {
      const pricing = this.pricing.getModelPricing(model);
      if (!pricing) continue;

      const cost = this.pricing.estimateCost(model, inputTokens, outputTokens);
      if (!cost) continue;

      // Check if model can handle complexity
      const requiredTier = Math.ceil(complexity * 5);
      if (pricing.qualityTier < requiredTier) continue;

      // Normalize quality (1-5 -> 0-1)
      const qualityScore = pricing.qualityTier / 5;

      // Normalize cost (lower is better, invert)
      const maxCost = 0.1; // $0.1 per request is considered "expensive"
      const costScore = 1 - Math.min(cost.estimatedCost / maxCost, 1);

      // Calculate combined score
      const score = qualityScore * QUALITY_WEIGHT + costScore * COST_WEIGHT;

      recommendations.push({
        model,
        provider: pricing.provider,
        qualityTier: pricing.qualityTier,
        estimatedCost: cost.estimatedCost,
        estimatedLatency: pricing.avgLatency,
        score,
        reasoning: `Balanced mode: ${model} (quality: ${qualityScore.toFixed(2)}, cost: $${cost.estimatedCost.toFixed(4)})`,
      });
    }

    // Sort by score and prefer local if scores are similar
    recommendations.sort((a, b) => {
      if (this.config.preferLocal) {
        // Prefer local if score difference is < 0.1
        if (
          a.provider === "local" &&
          b.provider !== "local" &&
          b.score - a.score < 0.1
        ) {
          return -1;
        }
        if (
          b.provider === "local" &&
          a.provider !== "local" &&
          a.score - b.score < 0.1
        ) {
          return 1;
        }
      }
      return b.score - a.score;
    });

    // Return best recommendation
    const best = recommendations[0];

    if (!best) {
      // Fallback to default cloud model
      const fallback = this.pricing.getModelPricing(this.DEFAULT_CLOUD_MODEL)!;
      const fallbackCost = this.pricing.estimateCost(
        this.DEFAULT_CLOUD_MODEL,
        inputTokens,
        outputTokens
      )!;

      return {
        model: this.DEFAULT_CLOUD_MODEL,
        provider: fallback.provider,
        qualityTier: fallback.qualityTier,
        estimatedCost: fallbackCost.estimatedCost,
        estimatedLatency: fallback.avgLatency,
        score: 0.5,
        reasoning: `Balanced mode: No suitable model found, using default (${this.DEFAULT_CLOUD_MODEL})`,
      };
    }

    return best;
  }

  /**
   * Check if a cost is within budget
   */
  private checkBudget(cost: number): boolean {
    // Check per-request limit
    if (cost > this.config.maxCostPerRequest) {
      return false;
    }

    // Check total budget
    if (this.budgetTracker) {
      return this.budgetTracker.canAfford(cost);
    }

    return true;
  }

  /**
   * Estimate cost for a query
   */
  estimateCost(
    query: string,
    model: string,
    outputTokens?: number
  ): number | null {
    const tokenEstimate = this.tokenEstimator.estimate(query);
    const estimatedOutput =
      outputTokens ??
      this.tokenEstimator.estimateOutputFromInput(tokenEstimate.inputTokens);
    const cost = this.pricing.estimateCost(
      model,
      tokenEstimate.inputTokens,
      estimatedOutput
    );
    return cost?.estimatedCost ?? null;
  }

  /**
   * Get current routing mode
   */
  getMode(): CostMode {
    return this.config.mode;
  }

  /**
   * Set routing mode
   */
  setMode(mode: CostMode): void {
    this.config.mode = mode;
  }

  /**
   * Set budget limit
   */
  setBudgetLimit(limit: number): void {
    this.config.budgetLimit = limit;

    if (this.budgetTracker) {
      this.budgetTracker.setBudgetLimit(limit);
    } else if (limit > 0) {
      this.budgetTracker = new BudgetTracker({
        budgetLimit: limit,
        warningThreshold: this.config.warningThreshold,
        criticalThreshold: this.config.criticalThreshold,
        blockOnExceed: this.config.blockOnExceed,
      });
    }
  }

  /**
   * Get budget state
   */
  getBudgetState() {
    return this.budgetTracker?.getState() ?? null;
  }

  /**
   * Get budget summary
   */
  getBudgetSummary() {
    return this.budgetTracker?.getSummary() ?? null;
  }

  /**
   * Get available models
   */
  getAvailableModels(): string[] {
    return this.pricing.getAllModels();
  }

  /**
   * Get pricing for all models
   */
  getModelPricing(): Record<string, ModelPricing> {
    return this.pricing.getAllPricing();
  }

  /**
   * Get pricing service
   */
  getPricingService(): PricingService {
    return this.pricing;
  }

  /**
   * Get token estimator
   */
  getTokenEstimator(): TokenEstimator {
    return this.tokenEstimator;
  }

  /**
   * Get budget tracker
   */
  getBudgetTracker(): BudgetTracker | null {
    return this.budgetTracker;
  }

  /**
   * Reset budget
   */
  resetBudget(newLimit?: number): void {
    if (this.budgetTracker) {
      this.budgetTracker.resetBudget(newLimit);
    }
  }
}

/**
 * Create a CostAwareRouter with default configuration
 */
export function createCostAwareRouter(
  config?: CostAwareConfig
): CostAwareRouter {
  return new CostAwareRouter(config);
}

/**
 * Default singleton instance
 */
export const defaultCostAwareRouter = new CostAwareRouter();

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
import type { CostAwareConfig, CostAwareRoutingResult, CostMode, QueryContext } from "../types.js";
import { PricingService, type ModelPricing } from "./PricingService.js";
import { TokenEstimator } from "./TokenEstimator.js";
import { BudgetTracker } from "./BudgetTracker.js";
/**
 * CostAwareRouter class
 */
export declare class CostAwareRouter {
    private pricing;
    private tokenEstimator;
    private budgetTracker;
    private config;
    private readonly DEFAULT_LOCAL_MODEL;
    private readonly DEFAULT_CLOUD_MODEL;
    private readonly DEFAULT_PERFORMANCE_MODEL;
    constructor(config?: CostAwareConfig);
    /**
     * Route a query to the optimal model based on cost configuration
     */
    route(query: string, complexity?: number, context?: QueryContext): CostAwareRoutingResult;
    /**
     * Get model recommendation based on mode and complexity
     */
    private getRecommendation;
    /**
     * Economy mode recommendation - minimize cost
     */
    private getEconomyRecommendation;
    /**
     * Performance mode recommendation - maximize quality
     */
    private getPerformanceRecommendation;
    /**
     * Balanced mode recommendation - balance cost and quality
     */
    private getBalancedRecommendation;
    /**
     * Check if a cost is within budget
     */
    private checkBudget;
    /**
     * Estimate cost for a query
     */
    estimateCost(query: string, model: string, outputTokens?: number): number | null;
    /**
     * Get current routing mode
     */
    getMode(): CostMode;
    /**
     * Set routing mode
     */
    setMode(mode: CostMode): void;
    /**
     * Set budget limit
     */
    setBudgetLimit(limit: number): void;
    /**
     * Get budget state
     */
    getBudgetState(): import("./BudgetTracker.js").BudgetState | null;
    /**
     * Get budget summary
     */
    getBudgetSummary(): {
        budgetLimit: number;
        currentSpending: number;
        remaining: number;
        percentageUsed: number;
        requestCount: number;
        averageCost: number;
        spendingRate: number;
        sessionDuration: number;
    } | null;
    /**
     * Get available models
     */
    getAvailableModels(): string[];
    /**
     * Get pricing for all models
     */
    getModelPricing(): Record<string, ModelPricing>;
    /**
     * Get pricing service
     */
    getPricingService(): PricingService;
    /**
     * Get token estimator
     */
    getTokenEstimator(): TokenEstimator;
    /**
     * Get budget tracker
     */
    getBudgetTracker(): BudgetTracker | null;
    /**
     * Reset budget
     */
    resetBudget(newLimit?: number): void;
}
/**
 * Create a CostAwareRouter with default configuration
 */
export declare function createCostAwareRouter(config?: CostAwareConfig): CostAwareRouter;
/**
 * Default singleton instance
 */
export declare const defaultCostAwareRouter: CostAwareRouter;
//# sourceMappingURL=CostAwareRouter.d.ts.map
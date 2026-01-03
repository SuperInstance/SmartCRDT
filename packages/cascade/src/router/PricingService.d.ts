/**
 * PricingService - Model pricing and cost estimation
 *
 * Provides pricing information for various AI models and handles
 * cost estimation for routing decisions.
 *
 * Prices are per 1K tokens as of 2025.
 */
/**
 * Model pricing information
 */
export interface ModelPricing {
    /** Model identifier */
    model: string;
    /** Provider (local, openai, anthropic, etc.) */
    provider: "local" | "openai" | "anthropic" | "google";
    /** Cost per 1K input tokens (USD) */
    inputCost: number;
    /** Cost per 1K output tokens (USD) */
    outputCost: number;
    /** Maximum context window (tokens) */
    maxTokens: number;
    /** Quality tier (1-5, higher is better) */
    qualityTier: number;
    /** Average latency (ms) */
    avgLatency: number;
}
/**
 * Cost estimation result
 */
export interface CostEstimate {
    /** Estimated input tokens */
    inputTokens: number;
    /** Estimated output tokens */
    outputTokens: number;
    /** Total estimated tokens */
    totalTokens: number;
    /** Estimated cost (USD) */
    estimatedCost: number;
    /** Model used for estimation */
    model: string;
    /** Breakdown by input/output */
    breakdown: {
        input: number;
        output: number;
    };
}
/**
 * PricingService class
 */
export declare class PricingService {
    private customPricing;
    constructor();
    /**
     * Get pricing information for a model
     */
    getModelPricing(model: string): ModelPricing | null;
    /**
     * Check if a model is free
     */
    isFreeModel(model: string): boolean;
    /**
     * Estimate cost for a query
     */
    estimateCost(model: string, inputTokens: number, outputTokens?: number): CostEstimate | null;
    /**
     * Get all available models by provider
     */
    getModelsByProvider(provider: "local" | "openai" | "anthropic" | "google"): string[];
    /**
     * Get models by quality tier
     */
    getModelsByQualityTier(minTier: number, maxTier?: number): string[];
    /**
     * Get cheapest model (optionally by minimum quality)
     */
    getCheapestModel(minQualityTier?: number, includeFree?: boolean): string | null;
    /**
     * Get highest quality model
     */
    getBestQualityModel(provider?: "local" | "openai" | "anthropic" | "google"): string | null;
    /**
     * Get models within budget
     */
    modelsWithinBudget(budget: number, inputTokens: number, outputTokens?: number): string[];
    /**
     * Add or update custom pricing
     */
    setCustomPricing(pricing: ModelPricing): void;
    /**
     * Remove custom pricing
     */
    removeCustomPricing(model: string): void;
    /**
     * Get all available models
     */
    getAllModels(): string[];
    /**
     * Get pricing for all models
     */
    getAllPricing(): Record<string, ModelPricing>;
}
/**
 * Default singleton instance
 */
export declare const defaultPricingService: PricingService;
//# sourceMappingURL=PricingService.d.ts.map
/**
 * PricingService - Model pricing and cost estimation
 *
 * Provides pricing information for various AI models and handles
 * cost estimation for routing decisions.
 *
 * Prices are per 1K tokens as of 2025.
 */
/**
 * Model pricing configuration
 */
const MODEL_PRICING = {
    // Local models (free)
    llama2: {
        model: "llama2",
        provider: "local",
        inputCost: 0,
        outputCost: 0,
        maxTokens: 4096,
        qualityTier: 2,
        avgLatency: 100,
    },
    "llama2:13b": {
        model: "llama2:13b",
        provider: "local",
        inputCost: 0,
        outputCost: 0,
        maxTokens: 4096,
        qualityTier: 3,
        avgLatency: 150,
    },
    "llama2:70b": {
        model: "llama2:70b",
        provider: "local",
        inputCost: 0,
        outputCost: 0,
        maxTokens: 4096,
        qualityTier: 4,
        avgLatency: 300,
    },
    mistral: {
        model: "mistral",
        provider: "local",
        inputCost: 0,
        outputCost: 0,
        maxTokens: 8192,
        qualityTier: 3,
        avgLatency: 80,
    },
    "mistral:7b": {
        model: "mistral:7b",
        provider: "local",
        inputCost: 0,
        outputCost: 0,
        maxTokens: 8192,
        qualityTier: 3,
        avgLatency: 80,
    },
    codellama: {
        model: "codellama",
        provider: "local",
        inputCost: 0,
        outputCost: 0,
        maxTokens: 4096,
        qualityTier: 3,
        avgLatency: 120,
    },
    phi: {
        model: "phi",
        provider: "local",
        inputCost: 0,
        outputCost: 0,
        maxTokens: 2048,
        qualityTier: 2,
        avgLatency: 50,
    },
    "neural-chat": {
        model: "neural-chat",
        provider: "local",
        inputCost: 0,
        outputCost: 0,
        maxTokens: 4096,
        qualityTier: 2,
        avgLatency: 90,
    },
    "starling-lm": {
        model: "starling-lm",
        provider: "local",
        inputCost: 0,
        outputCost: 0,
        maxTokens: 4096,
        qualityTier: 3,
        avgLatency: 100,
    },
    // OpenAI models (pricing as of 2025)
    "gpt-3.5-turbo": {
        model: "gpt-3.5-turbo",
        provider: "openai",
        inputCost: 0.0005,
        outputCost: 0.0015,
        maxTokens: 16385,
        qualityTier: 3,
        avgLatency: 200,
    },
    "gpt-3.5-turbo-16k": {
        model: "gpt-3.5-turbo-16k",
        provider: "openai",
        inputCost: 0.0005,
        outputCost: 0.0015,
        maxTokens: 16385,
        qualityTier: 3,
        avgLatency: 200,
    },
    "gpt-4": {
        model: "gpt-4",
        provider: "openai",
        inputCost: 0.03,
        outputCost: 0.06,
        maxTokens: 8192,
        qualityTier: 5,
        avgLatency: 500,
    },
    "gpt-4-turbo": {
        model: "gpt-4-turbo",
        provider: "openai",
        inputCost: 0.01,
        outputCost: 0.03,
        maxTokens: 128000,
        qualityTier: 5,
        avgLatency: 300,
    },
    "gpt-4-turbo-preview": {
        model: "gpt-4-turbo-preview",
        provider: "openai",
        inputCost: 0.01,
        outputCost: 0.03,
        maxTokens: 128000,
        qualityTier: 5,
        avgLatency: 300,
    },
    // Anthropic models (pricing as of 2025)
    "claude-3-haiku": {
        model: "claude-3-haiku",
        provider: "anthropic",
        inputCost: 0.00025,
        outputCost: 0.00125,
        maxTokens: 200000,
        qualityTier: 3,
        avgLatency: 150,
    },
    "claude-3-sonnet": {
        model: "claude-3-sonnet",
        provider: "anthropic",
        inputCost: 0.003,
        outputCost: 0.015,
        maxTokens: 200000,
        qualityTier: 4,
        avgLatency: 250,
    },
    "claude-3-opus": {
        model: "claude-3-opus",
        provider: "anthropic",
        inputCost: 0.015,
        outputCost: 0.075,
        maxTokens: 200000,
        qualityTier: 5,
        avgLatency: 400,
    },
    // Google models (pricing as of 2025)
    "gemini-pro": {
        model: "gemini-pro",
        provider: "google",
        inputCost: 0.00025,
        outputCost: 0.0005,
        maxTokens: 91728,
        qualityTier: 3,
        avgLatency: 180,
    },
    "gemini-ultra": {
        model: "gemini-ultra",
        provider: "google",
        inputCost: 0.005,
        outputCost: 0.01,
        maxTokens: 91728,
        qualityTier: 5,
        avgLatency: 350,
    },
};
/**
 * PricingService class
 */
export class PricingService {
    customPricing;
    constructor() {
        this.customPricing = new Map();
    }
    /**
     * Get pricing information for a model
     */
    getModelPricing(model) {
        return this.customPricing.get(model) || MODEL_PRICING[model] || null;
    }
    /**
     * Check if a model is free
     */
    isFreeModel(model) {
        const pricing = this.getModelPricing(model);
        return pricing
            ? pricing.inputCost === 0 && pricing.outputCost === 0
            : false;
    }
    /**
     * Estimate cost for a query
     */
    estimateCost(model, inputTokens, outputTokens = inputTokens * 0.75 // Default: output is 75% of input
    ) {
        const pricing = this.getModelPricing(model);
        if (!pricing) {
            return null;
        }
        const inputCost = (inputTokens / 1000) * pricing.inputCost;
        const outputCost = (outputTokens / 1000) * pricing.outputCost;
        const totalCost = inputCost + outputCost;
        return {
            inputTokens: Math.ceil(inputTokens),
            outputTokens: Math.ceil(outputTokens),
            totalTokens: Math.ceil(inputTokens + outputTokens),
            estimatedCost: totalCost,
            model,
            breakdown: {
                input: inputCost,
                output: outputCost,
            },
        };
    }
    /**
     * Get all available models by provider
     */
    getModelsByProvider(provider) {
        return Object.values(MODEL_PRICING)
            .filter(m => m.provider === provider)
            .map(m => m.model);
    }
    /**
     * Get models by quality tier
     */
    getModelsByQualityTier(minTier, maxTier = minTier) {
        return Object.values(MODEL_PRICING)
            .filter(m => m.qualityTier >= minTier && m.qualityTier <= maxTier)
            .sort((a, b) => a.qualityTier - b.qualityTier)
            .map(m => m.model);
    }
    /**
     * Get cheapest model (optionally by minimum quality)
     */
    getCheapestModel(minQualityTier = 1, includeFree = true) {
        const models = Object.values(MODEL_PRICING).filter(m => m.qualityTier >= minQualityTier);
        if (includeFree) {
            const freeModel = models.find(m => m.inputCost === 0);
            if (freeModel) {
                return freeModel.model;
            }
        }
        // Sort by total cost (input + output average)
        const sorted = models.sort((a, b) => {
            const costA = a.inputCost + a.outputCost;
            const costB = b.inputCost + b.outputCost;
            return costA - costB;
        });
        return sorted[0]?.model || null;
    }
    /**
     * Get highest quality model
     */
    getBestQualityModel(provider) {
        const models = provider
            ? Object.values(MODEL_PRICING).filter(m => m.provider === provider)
            : Object.values(MODEL_PRICING);
        const sorted = models.sort((a, b) => b.qualityTier - a.qualityTier || a.avgLatency - b.avgLatency);
        return sorted[0]?.model || null;
    }
    /**
     * Get models within budget
     */
    modelsWithinBudget(budget, inputTokens, outputTokens = inputTokens * 0.75) {
        return Object.values(MODEL_PRICING)
            .filter(m => {
            const cost = this.estimateCost(m.model, inputTokens, outputTokens);
            return cost && cost.estimatedCost <= budget;
        })
            .map(m => m.model);
    }
    /**
     * Add or update custom pricing
     */
    setCustomPricing(pricing) {
        this.customPricing.set(pricing.model, pricing);
    }
    /**
     * Remove custom pricing
     */
    removeCustomPricing(model) {
        this.customPricing.delete(model);
    }
    /**
     * Get all available models
     */
    getAllModels() {
        return Object.keys(MODEL_PRICING);
    }
    /**
     * Get pricing for all models
     */
    getAllPricing() {
        return { ...MODEL_PRICING };
    }
}
/**
 * Default singleton instance
 */
export const defaultPricingService = new PricingService();
//# sourceMappingURL=PricingService.js.map
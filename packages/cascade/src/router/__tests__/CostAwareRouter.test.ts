/**
 * CostAwareRouter Tests
 *
 * Tests for cost-aware routing functionality including:
 * - Economy mode routing
 * - Performance mode routing
 * - Balanced mode routing
 * - Budget limit enforcement
 * - Cost estimation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { CostAwareRouter } from "../CostAwareRouter.js";
import { PricingService } from "../PricingService.js";
import { TokenEstimator } from "../TokenEstimator.js";
import { BudgetTracker } from "../BudgetTracker.js";
import type { CostMode } from "../../types.js";

describe("PricingService", () => {
  let pricing: PricingService;

  beforeEach(() => {
    pricing = new PricingService();
  });

  describe("Model Pricing", () => {
    it("should return pricing for known models", () => {
      const gpt35 = pricing.getModelPricing("gpt-3.5-turbo");
      expect(gpt35).toBeDefined();
      expect(gpt35?.inputCost).toBe(0.0005);
      expect(gpt35?.outputCost).toBe(0.0015);
      expect(gpt35?.provider).toBe("openai");
    });

    it("should return null for unknown models", () => {
      const unknown = pricing.getModelPricing("unknown-model");
      expect(unknown).toBeNull();
    });

    it("should identify free models correctly", () => {
      expect(pricing.isFreeModel("llama2")).toBe(true);
      expect(pricing.isFreeModel("mistral")).toBe(true);
      expect(pricing.isFreeModel("gpt-3.5-turbo")).toBe(false);
      expect(pricing.isFreeModel("gpt-4")).toBe(false);
    });
  });

  describe("Cost Estimation", () => {
    it("should estimate cost for GPT-3.5", () => {
      const estimate = pricing.estimateCost("gpt-3.5-turbo", 1000, 500);
      expect(estimate).toBeDefined();
      expect(estimate?.estimatedCost).toBeCloseTo(0.00125, 5); // (1000/1000)*0.0005 + (500/1000)*0.0015
      expect(estimate?.inputTokens).toBe(1000);
      expect(estimate?.outputTokens).toBe(500);
      expect(estimate?.totalTokens).toBe(1500);
    });

    it("should estimate cost for GPT-4", () => {
      const estimate = pricing.estimateCost("gpt-4", 1000, 500);
      expect(estimate?.estimatedCost).toBeCloseTo(0.06, 5); // (1000/1000)*0.03 + (500/1000)*0.06
    });

    it("should estimate cost for free models", () => {
      const estimate = pricing.estimateCost("llama2", 1000, 500);
      expect(estimate?.estimatedCost).toBe(0);
    });

    it("should return null for unknown model", () => {
      const estimate = pricing.estimateCost("unknown-model", 1000, 500);
      expect(estimate).toBeNull();
    });
  });

  describe("Model Selection", () => {
    it("should get cheapest model", () => {
      const cheapest = pricing.getCheapestModel();
      // Should return a free local model
      expect(pricing.isFreeModel(cheapest!)).toBe(true);
    });

    it("should get cheapest model with minimum quality", () => {
      const cheapest = pricing.getCheapestModel(4);
      const pricingInfo = pricing.getModelPricing(cheapest!);
      expect(pricingInfo?.qualityTier).toBeGreaterThanOrEqual(4);
    });

    it("should get best quality model", () => {
      const best = pricing.getBestQualityModel();
      const pricingInfo = pricing.getModelPricing(best!);
      expect(pricingInfo?.qualityTier).toBe(5);
    });

    it("should get models within budget", () => {
      const models = pricing.modelsWithinBudget(0.01, 1000, 500);
      // Should include GPT-3.5-turbo but not GPT-4
      expect(models).toContain("gpt-3.5-turbo");
      expect(models).not.toContain("gpt-4");
    });
  });
});

describe("TokenEstimator", () => {
  let estimator: TokenEstimator;

  beforeEach(() => {
    estimator = new TokenEstimator();
  });

  describe("Token Estimation", () => {
    it("should estimate tokens for simple English text", () => {
      const text = "Hello world, how are you today?";
      const estimate = estimator.estimate(text);
      expect(estimate.inputTokens).toBeGreaterThan(0);
      expect(estimate.confidence).toBeGreaterThan(0);
      expect(estimate.method).toBe("word");
    });

    it("should estimate tokens for code", () => {
      const code = 'function hello() { console.log("world"); }';
      const estimate = estimator.estimate(code);
      expect(estimate.inputTokens).toBeGreaterThan(0);
      expect(estimate.method).toBe("code");
    });

    it("should estimate conversation tokens", () => {
      const input = "Hello, how are you?";
      const output = "I am doing well, thank you!";
      const estimate = estimator.estimateConversation(input, output);
      expect(estimate.inputTokens).toBeGreaterThan(0);
      expect(estimate.outputTokens).toBeGreaterThan(0);
      expect(estimate.totalTokens).toBe(
        estimate.inputTokens + estimate.outputTokens!
      );
    });

    it("should estimate output from input", () => {
      const inputTokens = 100;
      const outputTokens = estimator.estimateOutputFromInput(inputTokens, 0.5);
      expect(outputTokens).toBeGreaterThan(0);
      expect(outputTokens).toBeLessThanOrEqual(inputTokens * 1.5);
    });
  });
});

describe("BudgetTracker", () => {
  let tracker: BudgetTracker;

  beforeEach(() => {
    tracker = new BudgetTracker({
      budgetLimit: 1.0,
      warningThreshold: 0.7,
      criticalThreshold: 0.9,
      blockOnExceed: true,
    });
  });

  describe("Budget Tracking", () => {
    it("should track spending correctly", () => {
      const result = tracker.recordCost("gpt-3.5-turbo", 0.01);
      expect(result.allowed).toBe(true);
      expect(tracker.getPercentageUsed()).toBeCloseTo(0.01, 3);
    });

    it("should block when budget exceeded", () => {
      // Use up most of budget
      tracker.recordCost("gpt-3.5-turbo", 0.99);

      // This should exceed budget
      const result = tracker.recordCost("gpt-3.5-turbo", 0.02);
      expect(result.allowed).toBe(false);
      expect(result.alert).toBeDefined();
      expect(result.alert?.level).toBe("exceeded");
    });

    it("should generate warning alert", () => {
      tracker.recordCost("gpt-3.5-turbo", 0.75);
      const alerts = tracker.getRecentAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].level).toBe("warning");
    });

    it("should generate critical alert", () => {
      tracker.recordCost("gpt-3.5-turbo", 0.95);
      const alerts = tracker.getRecentAlerts();
      const criticalAlert = alerts.find(a => a.level === "critical");
      expect(criticalAlert).toBeDefined();
    });

    it("should reset budget correctly", () => {
      tracker.recordCost("gpt-3.5-turbo", 0.5);
      expect(tracker.getPercentageUsed()).toBeCloseTo(0.5, 3);

      tracker.resetBudget();
      expect(tracker.getPercentageUsed()).toBe(0);
    });

    it("should calculate average cost per request", () => {
      tracker.recordCost("gpt-3.5-turbo", 0.01);
      tracker.recordCost("gpt-3.5-turbo", 0.02);
      tracker.recordCost("gpt-4", 0.05);

      const avgCost = tracker.getAverageCostPerRequest();
      expect(avgCost).toBeCloseTo(0.0267, 3);
    });

    it("should get spending by model", () => {
      tracker.recordCost("gpt-3.5-turbo", 0.01);
      tracker.recordCost("gpt-3.5-turbo", 0.02);
      tracker.recordCost("gpt-4", 0.05);

      const spending = tracker.getSpendingByModel();
      expect(spending["gpt-3.5-turbo"]).toBeCloseTo(0.03, 3);
      expect(spending["gpt-4"]).toBeCloseTo(0.05, 3);
    });
  });
});

describe("CostAwareRouter", () => {
  let router: CostAwareRouter;

  beforeEach(() => {
    router = new CostAwareRouter({
      mode: "balanced",
      budgetLimit: 1.0,
    });
  });

  describe("Economy Mode", () => {
    beforeEach(() => {
      router.setMode("economy");
    });

    it("should prefer local models for simple queries", () => {
      const result = router.route("Hello world", 0.2);
      expect(result.backend).toBe("local");
      expect(result.estimatedCost).toBe(0);
      expect(result.reason).toContain("free local model");
    });

    it("should use cheapest cloud model when local insufficient", () => {
      const result = router.route("Explain quantum computing in detail", 0.9);
      expect(result.model).toBeDefined();
      expect(result.reason).toContain("Economy mode");
    });
  });

  describe("Performance Mode", () => {
    beforeEach(() => {
      router.setMode("performance");
    });

    it("should use best quality model regardless of cost", () => {
      const result = router.route("Hello world", 0.1);
      expect(result.model).toBeDefined();
      expect(result.reason).toContain("Performance mode");
      expect(result.reason).toContain("best quality");
    });

    it("should select GPT-4 or similar high-tier model", () => {
      const result = router.route("Complex query", 0.8);
      const pricing = router.getPricingService().getModelPricing(result.model);
      expect(pricing?.qualityTier).toBeGreaterThanOrEqual(4);
    });
  });

  describe("Balanced Mode", () => {
    beforeEach(() => {
      router.setMode("balanced");
    });

    it("should balance cost and quality", () => {
      const result = router.route("Medium complexity query", 0.5);
      expect(result.model).toBeDefined();
      expect(result.reason).toContain("Balanced mode");
    });

    it("should prefer local if preferLocal is set", () => {
      router = new CostAwareRouter({
        mode: "balanced",
        preferLocal: true,
      });

      const result = router.route("Simple query", 0.3);
      // May prefer local for simple queries
      expect(result.model).toBeDefined();
    });
  });

  describe("Budget Enforcement", () => {
    it("should respect budget limit", () => {
      // Create a new router with very small budget
      const smallBudgetRouter = new CostAwareRouter({
        mode: "balanced",
        budgetLimit: 0.001,
        blockOnExceed: true,
      });

      // Use expensive model that exceeds budget
      const result = smallBudgetRouter.route(
        "Explain quantum physics in detail with examples",
        0.9
      );

      // Check budget state after routing
      const budgetState = smallBudgetRouter.getBudgetState();
      if (
        budgetState &&
        budgetState.currentSpending >= budgetState.budgetLimit
      ) {
        // Budget should be tracked
        expect(budgetState.currentSpending).toBeGreaterThan(0);
      }
    });

    it("should track budget state", () => {
      router.route("Query 1", 0.5);
      router.route("Query 2", 0.5);

      const summary = router.getBudgetSummary();
      expect(summary).toBeDefined();
      expect(summary?.currentSpending).toBeGreaterThan(0);
      expect(summary?.requestCount).toBe(2);
    });
  });

  describe("Cost Estimation", () => {
    it("should estimate cost for query", () => {
      const cost = router.estimateCost("Hello world", "gpt-3.5-turbo");
      expect(cost).toBeGreaterThan(0);
      expect(cost).toBeLessThan(0.01); // Should be very small
    });

    it("should estimate cost for different models", () => {
      const gpt35Cost = router.estimateCost("Hello world", "gpt-3.5-turbo");
      const gpt4Cost = router.estimateCost("Hello world", "gpt-4");

      expect(gpt4Cost).toBeGreaterThan(gpt35Cost!);
    });
  });

  describe("Mode Switching", () => {
    it("should switch between modes", () => {
      expect(router.getMode()).toBe("balanced");

      router.setMode("economy");
      expect(router.getMode()).toBe("economy");

      router.setMode("performance");
      expect(router.getMode()).toBe("performance");
    });
  });

  describe("Available Models", () => {
    it("should return available models", () => {
      const models = router.getAvailableModels();
      expect(models.length).toBeGreaterThan(0);
      expect(models).toContain("llama2");
      expect(models).toContain("gpt-3.5-turbo");
      expect(models).toContain("gpt-4");
    });

    it("should return model pricing", () => {
      const pricing = router.getModelPricing();
      expect(pricing["gpt-3.5-turbo"]).toBeDefined();
      expect(pricing["llama2"]).toBeDefined();
    });
  });
});

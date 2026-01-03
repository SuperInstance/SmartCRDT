/**
 * Tests for UIRecommender
 */

import { describe, it, expect, beforeEach } from "vitest";
import { UIRecommender, type RecommendationRequest } from "../src/recommenders/UIRecommender.js";
import type { UIContext, UIState } from "../src/types.js";

describe("UIRecommender", () => {
  let recommender: UIRecommender;
  const baseContext: UIContext = {
    page: "/test",
    viewport: { width: 1000, height: 800 },
    timestamp: Date.now()
  };

  const baseState: UIState = {
    layout: "grid",
    density: "normal",
    theme: "light",
    components: ["button", "card"],
    styles: {
      primaryColor: "#007bff",
      accentColor: "#28a745",
      borderRadius: 4
    }
  };

  beforeEach(() => {
    recommender = new UIRecommender({
      strategy: "hybrid",
      diversity: 0.3,
      novelty: 0.5,
      serendipity: 0.2,
      maxRecommendations: 10
    });
  });

  describe("Layout Recommendations", () => {
    it("should recommend layout for desktop", () => {
      const request: RecommendationRequest = {
        userId: "user-1",
        context: { ...baseContext, viewport: { width: 1200, height: 800 } },
        currentState: baseState
      };

      const recommendations = recommender.recommend(request);
      const layoutRec = recommendations.find((r) => r.type === "layout");

      expect(layoutRec).toBeDefined();
      expect(layoutRec!.recommendation).toBeDefined();
      expect(layoutRec!.confidence).toBeGreaterThan(0);
      expect(layoutRec!.expectedSatisfaction).toBeGreaterThan(0);
    });

    it("should recommend layout for mobile", () => {
      const request: RecommendationRequest = {
        userId: "user-1",
        context: { ...baseContext, viewport: { width: 375, height: 667 } },
        currentState: baseState
      };

      const recommendations = recommender.recommend(request);
      const layoutRec = recommendations.find((r) => r.type === "layout");

      expect(layoutRec).toBeDefined();
      // Mobile should get stacked or list layout
      expect(["stacked", "list"]).toContain(layoutRec!.recommendation as string);
    });

    it("should recommend layout for tablet", () => {
      const request: RecommendationRequest = {
        userId: "user-1",
        context: { ...baseContext, viewport: { width: 768, height: 1024 } },
        currentState: baseState
      };

      const recommendations = recommender.recommend(request);
      const layoutRec = recommendations.find((r) => r.type === "layout");

      expect(layoutRec).toBeDefined();
    });
  });

  describe("Component Recommendations", () => {
    it("should recommend components", () => {
      const request: RecommendationRequest = {
        userId: "user-1",
        context: baseContext,
        currentState: baseState
      };

      const recommendations = recommender.recommend(request);
      const componentRec = recommendations.find((r) => r.type === "component");

      expect(componentRec).toBeDefined();
      expect(Array.isArray(componentRec!.recommendation)).toBe(true);
    });
  });

  describe("Style Recommendations", () => {
    it("should recommend theme", () => {
      const request: RecommendationRequest = {
        userId: "user-1",
        context: baseContext,
        currentState: baseState
      };

      const recommendations = recommender.recommend(request);
      const styleRec = recommendations.find((r) => r.type === "style");

      expect(styleRec).toBeDefined();
      expect(styleRec!.recommendation).toHaveProperty("theme");
    });

    it("should recommend dark theme at night", () => {
      const nightTime = new Date(2025, 0, 1, 22, 0).getTime();

      const request: RecommendationRequest = {
        userId: "user-1",
        context: { ...baseContext, timestamp: nightTime },
        currentState: baseState
      };

      const recommendations = recommender.recommend(request);
      const styleRec = recommendations.find((r) => r.type === "style");

      expect(styleRec!.recommendation).toHaveProperty("theme", "dark");
    });

    it("should recommend light theme during day", () => {
      const dayTime = new Date(2025, 0, 1, 14, 0).getTime();

      const request: RecommendationRequest = {
        userId: "user-1",
        context: { ...baseContext, timestamp: dayTime },
        currentState: baseState
      };

      const recommendations = recommender.recommend(request);
      const styleRec = recommendations.find((r) => r.type === "style");

      expect(styleRec!.recommendation).toHaveProperty("theme", "light");
    });
  });

  describe("Content Recommendations", () => {
    it("should recommend content", () => {
      const request: RecommendationRequest = {
        userId: "user-1",
        context: baseContext,
        currentState: baseState
      };

      const recommendations = recommender.recommend(request);
      const contentRec = recommendations.find((r) => r.type === "content");

      expect(contentRec).toBeDefined();
    });
  });

  describe("Recommendation Properties", () => {
    it("should include confidence scores", () => {
      const request: RecommendationRequest = {
        userId: "user-1",
        context: baseContext,
        currentState: baseState
      };

      const recommendations = recommender.recommend(request);

      for (const rec of recommendations) {
        expect(rec.confidence).toBeGreaterThanOrEqual(0);
        expect(rec.confidence).toBeLessThanOrEqual(1);
      }
    });

    it("should include reasons", () => {
      const request: RecommendationRequest = {
        userId: "user-1",
        context: baseContext,
        currentState: baseState
      };

      const recommendations = recommender.recommend(request);

      for (const rec of recommendations) {
        expect(rec.reason).toBeDefined();
        expect(rec.reason.length).toBeGreaterThan(0);
      }
    });

    it("should include expected satisfaction", () => {
      const request: RecommendationRequest = {
        userId: "user-1",
        context: baseContext,
        currentState: baseState
      };

      const recommendations = recommender.recommend(request);

      for (const rec of recommendations) {
        expect(rec.expectedSatisfaction).toBeDefined();
        expect(rec.expectedSatisfaction).toBeGreaterThanOrEqual(0);
        expect(rec.expectedSatisfaction).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("Recommendation Explanations", () => {
    it("should explain recommendations", () => {
      const request: RecommendationRequest = {
        userId: "user-1",
        context: baseContext,
        currentState: baseState
      };

      const explanations = recommender.explain(request);

      expect(explanations.size).toBeGreaterThan(0);

      for (const [type, explanation] of explanations.entries()) {
        expect(type).toBeDefined();
        expect(explanation).toBeDefined();
        expect(explanation.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Confidence Calculation", () => {
    it("should calculate recommendation confidence", () => {
      const request: RecommendationRequest = {
        userId: "user-1",
        context: baseContext,
        currentState: baseState
      };

      const confidence = recommender.getConfidence(request);

      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });
  });

  describe("Custom Rules", () => {
    it("should add custom rule", () => {
      recommender.addRule("layout", {
        condition: (context) => context.viewport.width < 500,
        recommendation: "stacked",
        priority: 10,
        reason: "Very small screen"
      });

      const request: RecommendationRequest = {
        userId: "user-1",
        context: { ...baseContext, viewport: { width: 400, height: 600 } },
        currentState: baseState
      };

      const recommendations = recommender.recommend(request);
      const layoutRec = recommendations.find((r) => r.type === "layout");

      expect(layoutRec).toBeDefined();
    });
  });

  describe("Configuration", () => {
    it("should set and get configuration", () => {
      recommender.setConfig({ diversity: 0.5, maxRecommendations: 20 });

      const config = recommender.getConfig();

      expect(config.diversity).toBe(0.5);
      expect(config.maxRecommendations).toBe(20);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty state", () => {
      const request: RecommendationRequest = {
        userId: "user-1",
        context: baseContext,
        currentState: {
          layout: "grid",
          density: "normal",
          theme: "light",
          components: [],
          styles: {}
        }
      };

      const recommendations = recommender.recommend(request);

      expect(recommendations).toBeDefined();
    });

    it("should handle very small viewport", () => {
      const request: RecommendationRequest = {
        userId: "user-1",
        context: { ...baseContext, viewport: { width: 100, height: 100 } },
        currentState: baseState
      };

      const recommendations = recommender.recommend(request);

      expect(recommendations.length).toBeGreaterThan(0);
    });

    it("should handle very large viewport", () => {
      const request: RecommendationRequest = {
        userId: "user-1",
        context: { ...baseContext, viewport: { width: 4000, height: 2000 } },
        currentState: baseState
      };

      const recommendations = recommender.recommend(request);

      expect(recommendations.length).toBeGreaterThan(0);
    });
  });
});

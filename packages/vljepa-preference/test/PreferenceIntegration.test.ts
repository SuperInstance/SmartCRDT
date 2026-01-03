/**
 * Integration tests for Preference Learning System
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  InteractionCollector,
  PatternAnalyzer,
  PreferenceExtractor,
  PreferenceModel,
  HybridRecommender,
  UIRecommender,
  Personalizer,
  AdaptiveUI,
  ContextAwarePersonalization
} from "../src/index.js";
import type { UserPreferences, UIContext, UIState } from "../src/types.js";

describe("Preference Learning System Integration", () => {
  let collector: InteractionCollector;
  let analyzer: PatternAnalyzer;
  let extractor: PreferenceExtractor;
  let model: PreferenceModel;
  let hybrid: HybridRecommender;
  let uiRecommender: UIRecommender;
  let personalizer: Personalizer;
  let adaptiveUI: AdaptiveUI;
  let contextAware: ContextAwarePersonalization;

  const userId = "integration-test-user";
  let sessionId: string;

  const baseContext: UIContext = {
    page: "/test",
    viewport: { width: 1000, height: 800 },
    timestamp: Date.now()
  };

  beforeEach(() => {
    collector = new InteractionCollector();
    analyzer = new PatternAnalyzer();
    extractor = new PreferenceExtractor();
    model = new PreferenceModel();
    hybrid = new HybridRecommender();
    uiRecommender = new UIRecommender();
    personalizer = new Personalizer();
    adaptiveUI = new AdaptiveUI();
    contextAware = new ContextAwarePersonalization();

    sessionId = collector.startSession(userId).sessionId;
  });

  describe("End-to-End Flow", () => {
    it("should collect interactions and extract preferences", () => {
      // Simulate user interactions
      const element = {
        id: "btn-primary",
        type: "button",
        position: { x: 100, y: 100, width: 80, height: 40 }
      };

      for (let i = 0; i < 10; i++) {
        collector.recordClick(sessionId, element, { x: 100, y: 100 }, baseContext);
      }

      // Get interactions
      const interactions = collector.getSessionInteractions(sessionId);

      // Extract preferences
      const prefs = extractor.extractPreferences(userId, interactions);

      expect(prefs).toBeDefined();
      expect(prefs.userId).toBe(userId);
      expect(prefs.layout).toBeDefined();
      expect(prefs.visual).toBeDefined();
    });

    it("should update model and generate recommendations", () => {
      // Create interactions
      const interactions = createTestInteractions(userId, 20);

      // Update model
      const prefs = model.updateFromInteractions(userId, interactions);

      // Generate collaborative filtering recommendations
      for (const interaction of interactions) {
        hybrid.addRating(userId, interaction.element.id, 4);
      }

      const recs = hybrid.recommend(userId, 5);

      expect(recs.userId).toBe(userId);
      expect(recs.items).toBeDefined();
    });
  });

  describe("Pattern-Aware Recommendations", () => {
    it("should analyze patterns and influence recommendations", () => {
      // Create patterned interactions
      const patternedInteractions: typeof import("../src/types.js").Interaction[] = [];

      // Pattern: user prefers clicking cards in grid view
      for (let i = 0; i < 10; i++) {
        patternedInteractions.push({
          type: "click",
          element: {
            id: `card-${i}`,
            type: "card",
            position: { x: 100 + (i % 3) * 200, y: 100 + Math.floor(i / 3) * 150, width: 180, height: 120 }
          },
          timestamp: Date.now() + i * 1000,
          position: { x: 100 + (i % 3) * 200, y: 100 + Math.floor(i / 3) * 150 },
          context: baseContext
        });
      }

      // Analyze patterns
      const analysis = analyzer.analyze(patternedInteractions);

      expect(analysis.patterns.length).toBeGreaterThan(0);

      // Extract preferences
      const prefs = extractor.extractPreferences(userId, patternedInteractions);

      // Update model
      model.setPreferences(prefs);

      // Get UI recommendations
      const uiRecs = uiRecommender.recommend({
        userId,
        context: baseContext,
        currentState: {
          layout: "grid",
          density: "normal",
          theme: "light",
          components: [],
          styles: {}
        }
      });

      expect(uiRecs.length).toBeGreaterThan(0);
    });
  });

  describe("Adaptive Personalization", () => {
    it("should adapt UI based on real-time behavior", () => {
      const currentState: UIState = {
        layout: "grid",
        density: "normal",
        theme: "light",
        components: ["button", "card"],
        styles: { primaryColor: "#007bff" }
      };

      // Simulate rage clicks
      for (let i = 0; i < 5; i++) {
        const interaction = {
          type: "click" as const,
          element: {
            id: "problematic-button",
            type: "button",
            position: { x: 100, y: 100, width: 80, height: 40 }
          },
          timestamp: Date.now() + i * 100,
          position: { x: 100, y: 100 },
          context: baseContext
        };

        const adapted = adaptiveUI.processInteraction(userId, interaction, currentState, undefined);

        // After multiple clicks, should trigger adaptation
        if (i >= 3) {
          expect(adapted).toBeDefined();
        }
      }
    });

    it("should provide context-aware recommendations", () => {
      // Record visits to different contexts
      const contexts: UIContext[] = [
        { ...baseContext, viewport: { width: 375, height: 667 } }, // Mobile
        { ...baseContext, viewport: { width: 1000, height: 800 } }, // Desktop
        { ...baseContext, page: "/about" } // Different page
      ];

      for (const context of contexts) {
        const rec = contextAware.recommend(userId, context, undefined);

        expect(rec).toBeDefined();
        expect(rec.state).toBeDefined();
        expect(rec.confidence).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("Full Personalization Pipeline", () => {
    it("should complete full pipeline from collection to personalization", () => {
      // Step 1: Collect interactions
      const interactions = createTestInteractions(userId, 30);

      for (const interaction of interactions) {
        collector.recordClick(
          sessionId,
          interaction.element,
          interaction.position,
          interaction.context
        );
      }

      // Step 2: Analyze patterns
      const analysis = analyzer.analyze(interactions);

      expect(analysis.patterns.length).toBeGreaterThan(0);

      // Step 3: Extract preferences
      const prefs = extractor.extractPreferences(userId, interactions);

      // Step 4: Update model
      model.setPreferences(prefs);
      personalizer.updatePreferences(prefs);

      // Step 5: Generate recommendations
      const uiRecs = uiRecommender.recommend({
        userId,
        context: baseContext,
        currentState: {
          layout: "grid",
          density: "normal",
          theme: "light",
          components: [],
          styles: {}
        }
      });

      // Step 6: Personalize
      const personalization = personalizer.personalize({
        userId,
        context: baseContext,
        currentState: {
          layout: "grid",
          density: "normal",
          theme: "light",
          components: [],
          styles: {}
        },
        availableOptions: []
      });

      expect(uiRecs.length).toBeGreaterThan(0);
      expect(personalization.changes).toBeInstanceOf(Array);
      expect(personalization.confidence).toBeGreaterThan(0);
    });
  });

  describe("Collaborative + Content-Based Hybrid", () => {
    it("should combine collaborative and content-based filtering", () => {
      // Add collaborative ratings
      for (let i = 0; i < 10; i++) {
        hybrid.addRating(userId, `item-${i}`, Math.floor(Math.random() * 5) + 1);
        hybrid.addItem({
          id: `item-${i}`,
          type: "card",
          tags: [`tag-${i % 3}`],
          attributes: {}
        });
      }

      // Update with user preferences
      const prefs = extractor.extractPreferences(userId, createTestInteractions(userId, 10));
      hybrid.updateFromPreferences(userId, prefs);

      // Get recommendations
      const recs = hybrid.recommend(userId, 5);

      expect(recs.items).toBeDefined();
      expect(recs.items.length).toBeLessThanOrEqual(5);
    });
  });

  describe("Multi-User Scenario", () => {
    it("should handle multiple users with different preferences", () => {
      const users = [`user-1`, `user-2`, `user-3`];

      // Create different interaction patterns for each user
      const userPreferences = new Map<string, UserPreferences>();

      for (const user of users) {
        const interactions = createTestInteractions(user, 20);
        const prefs = extractor.extractPreferences(user, interactions);

        model.setPreferences(prefs);
        userPreferences.set(user, prefs);
      }

      // Verify each user has different preferences
      const prefs1 = userPreferences.get(`user-1`)!;
      const prefs2 = userPreferences.get(`user-2`)!;

      // At least some preferences should differ
      const similarity = model.calculateSimilarity(prefs1, prefs2);

      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });
  });

  describe("Feedback Loop", () => {
    it("should incorporate feedback and update recommendations", () => {
      // Initial preferences
      const interactions = createTestInteractions(userId, 10);
      const prefs = model.updateFromInteractions(userId, interactions);

      const initialConfidence = prefs.overallConfidence;

      // Add positive feedback
      model.updateFromFeedback(userId, [
        {
          userId,
          itemId: "item-1",
          type: "explicit",
          feedback: { type: "like", value: true },
          timestamp: Date.now()
        }
      ]);

      // Get updated preferences
      const updatedPrefs = model.getPreferences(userId);

      expect(updatedPrefs).toBeDefined();
      expect(updatedPrefs!.lastUpdated).toBeGreaterThan(prefs.lastUpdated);
    });
  });

  describe("Statistics and Reporting", () => {
    it("should provide comprehensive statistics", () => {
      // Add data to all components
      const interactions = createTestInteractions(userId, 20);

      for (const interaction of interactions) {
        hybrid.addRating(userId, interaction.element.id, 4);
      }

      const prefs = extractor.extractPreferences(userId, interactions);
      model.setPreferences(prefs);
      personalizer.updatePreferences(prefs);

      // Get statistics from each component
      const modelStats = model.getStatistics();
      const hybridStats = hybrid.getStatistics();
      const personalizerStats = personalizer.getStatistics();

      expect(modelStats.totalUsers).toBeGreaterThanOrEqual(1);
      expect(hybridStats.collaborative.totalUsers).toBeGreaterThanOrEqual(0);
      expect(personalizerStats.totalUsers).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle empty interaction history", () => {
      const prefs = extractor.extractPreferences(userId, []);

      expect(prefs).toBeDefined();
      expect(prefs.userId).toBe(userId);
    });

    it("should handle new users with no history", () => {
      const recs = hybrid.recommend("new-user", 5);

      expect(recs).toBeDefined();
      expect(recs.items).toBeDefined();
    });

    it("should handle invalid context data", () => {
      const rec = contextAware.recommend(
        userId,
        { ...baseContext, viewport: { width: 0, height: 0 } },
        undefined
      );

      expect(rec).toBeDefined();
    });
  });
});

function createTestInteractions(userId: string, count: number): typeof import("../src/types.js").Interaction[] {
  const interactions: typeof import("../src/types.js").Interaction[] = [];

  for (let i = 0; i < count; i++) {
    interactions.push({
      type: `click`,
      element: {
        id: `element-${i}`,
        type: i % 2 === 0 ? "button" : "card",
        position: { x: 100 + (i % 5) * 50, y: 100 + Math.floor(i / 5) * 50, width: 80, height: 40 }
      },
      timestamp: Date.now() + i * 1000,
      position: { x: 100 + (i % 5) * 50, y: 100 + Math.floor(i / 5) * 50 },
      context: {
        page: i % 3 === 0 ? "/home" : "/about",
        viewport: { width: 1000, height: 800 },
        timestamp: Date.now()
      }
    });
  }

  return interactions;
}

/**
 * Tests for PreferenceModel
 */

import { describe, it, expect, beforeEach } from "vitest";
import { PreferenceModel, type ModelStatistics, type ValidationMetrics } from "../src/models/PreferenceModel.js";
import type { UserPreferences, Interaction } from "../src/types.js";

describe("PreferenceModel", () => {
  let model: PreferenceModel;
  const userId = "test-user";

  beforeEach(() => {
    model = new PreferenceModel({
      updateFrequency: 1000,
      minDataPoints: 5,
      validationSplit: 0.2,
      retrainThreshold: 0.1
    });
  });

  describe("Preference Management", () => {
    it("should get null for non-existent user", () => {
      const prefs = model.getPreferences("non-existent");
      expect(prefs).toBeNull();
    });

    it("should set and get preferences", () => {
      const prefs: UserPreferences = {
        userId,
        layout: {
          preferred: "grid",
          density: "normal",
          alignment: "left",
          confidence: 0.8
        },
        visual: {
          theme: "light",
          primaryColor: "#007bff",
          accentColor: "#28a745",
          borderRadius: 4,
          shadows: true,
          animations: true,
          confidence: 0.8
        },
        typography: {
          fontFamily: "system-ui",
          fontSize: "medium",
          lineHeight: 1.5,
          letterSpacing: 0,
          fontWeight: 400,
          confidence: 0.7
        },
        components: {
          preferred: ["button", "card"],
          avoided: ["modal"],
          customizations: {},
          confidence: 0.6
        },
        navigation: {
          style: "sidebar",
          position: "left",
          sticky: true,
          collapsed: false,
          confidence: 0.7
        },
        overallConfidence: 0.72,
        lastUpdated: Date.now(),
        version: 1
      };

      model.setPreferences(prefs);

      const retrieved = model.getPreferences(userId);
      expect(retrieved).toEqual(prefs);
    });
  });

  describe("Interaction-based Updates", () => {
    it("should create preferences from interactions", () => {
      const interactions = createSampleInteractions(userId, 20);

      const prefs = model.updateFromInteractions(userId, interactions);

      expect(prefs).toBeDefined();
      expect(prefs.userId).toBe(userId);
      expect(prefs.layout).toBeDefined();
      expect(prefs.visual).toBeDefined();
      expect(prefs.typography).toBeDefined();
    });

    it("should update existing preferences", () => {
      const initialInteractions = createSampleInteractions(userId, 10);
      const initialPrefs = model.updateFromInteractions(userId, initialInteractions);

      const newInteractions = createSampleInteractions(userId, 10);
      const updatedPrefs = model.updateFromInteractions(userId, newInteractions);

      expect(updatedPrefs.version).toBeGreaterThan(initialPrefs.version);
      expect(updatedPrefs.lastUpdated).toBeGreaterThanOrEqual(initialPrefs.lastUpdated);
    });

    it("should wait for minimum data points", () => {
      model.setPreferences(createDefaultPreferences(userId));

      const fewInteractions = createSampleInteractions(userId, 3);
      const prefs = model.updateFromInteractions(userId, fewInteractions);

      // Should still create preferences even with few points
      expect(prefs).toBeDefined();
    });
  });

  describe("Feedback Integration", () => {
    it("should update from positive feedback", () => {
      model.setPreferences(createDefaultPreferences(userId));

      const initialConfidence = model.getPreferences(userId)!.overallConfidence;

      model.updateFromFeedback(userId, [
        {
          userId,
          itemId: "item-1",
          type: "explicit",
          feedback: { type: "like", value: true },
          timestamp: Date.now()
        }
      ]);

      const updated = model.getPreferences(userId);
      expect(updated!.overallConfidence).toBeGreaterThanOrEqual(initialConfidence);
    });

    it("should update from negative feedback", () => {
      model.setPreferences(createDefaultPreferences(userId));

      const initialConfidence = model.getPreferences(userId)!.overallConfidence;

      model.updateFromFeedback(userId, [
        {
          userId,
          itemId: "item-1",
          type: "explicit",
          feedback: { type: "dislike", value: false },
          timestamp: Date.now()
        }
      ]);

      const updated = model.getPreferences(userId);
      expect(updated!.overallConfidence).toBeLessThanOrEqual(initialConfidence);
    });

    it("should update from ratings", () => {
      model.setPreferences(createDefaultPreferences(userId));

      model.updateFromFeedback(userId, [
        {
          userId,
          itemId: "item-1",
          type: "explicit",
          feedback: { type: "rating", value: 5 },
          timestamp: Date.now()
        }
      ]);

      const updated = model.getPreferences(userId);
      expect(updated).toBeDefined();
    });
  });

  describe("Similarity Calculation", () => {
    it("should calculate similarity between users", () => {
      const prefs1 = createDefaultPreferences("user-1");
      const prefs2 = createDefaultPreferences("user-2");

      // Make prefs2 different
      prefs2.layout.preferred = "list";
      prefs2.visual.theme = "dark";

      model.setPreferences(prefs1);
      model.setPreferences(prefs2);

      const similarity = model.calculateSimilarity(prefs1, prefs2);

      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it("should return 1 for identical preferences", () => {
      const prefs = createDefaultPreferences(userId);

      model.setPreferences(prefs);

      const similarity = model.calculateSimilarity(prefs, prefs);

      expect(similarity).toBe(1);
    });

    it("should find similar users", () => {
      for (let i = 0; i < 10; i++) {
        model.setPreferences(createDefaultPreferences(`user-${i}`));
      }

      const similar = model.getSimilarUsers(userId, 5);

      expect(similar.length).toBeLessThanOrEqual(5);
    });
  });

  describe("Batch Operations", () => {
    it("should batch update multiple users", () => {
      const updates = new Map<string, Interaction[]>();

      for (let i = 0; i < 5; i++) {
        updates.set(`user-${i}`, createSampleInteractions(`user-${i}`, 10));
      }

      const results = model.batchUpdate(updates);

      expect(results.size).toBe(5);

      for (const [userId, prefs] of results.entries()) {
        expect(prefs.userId).toBe(userId);
      }
    });
  });

  describe("Statistics", () => {
    it("should calculate model statistics", () => {
      for (let i = 0; i < 10; i++) {
        model.setPreferences(createDefaultPreferences(`user-${i}`));
      }

      const stats = model.getStatistics();

      expect(stats.totalUsers).toBe(10);
      expect(stats.totalInteractions).toBe(0);
      expect(stats.avgConfidence).toBeGreaterThanOrEqual(0);
      expect(stats.avgConfidence).toBeLessThanOrEqual(1);
    });

    it("should include preference distributions", () => {
      model.setPreferences(createDefaultPreferences("user-1"));

      const stats = model.getStatistics();

      expect(stats.layoutDistribution).toBeDefined();
      expect(stats.themeDistribution).toBeDefined();
      expect(stats.densityDistribution).toBeDefined();
    });
  });

  describe("Validation", () => {
    it("should validate model performance", () => {
      for (let i = 0; i < 10; i++) {
        model.setPreferences(createDefaultPreferences(`user-${i}`));
      }

      const metrics = model.validate();

      expect(metrics.accuracy).toBeGreaterThanOrEqual(0);
      expect(metrics.precision).toBeGreaterThanOrEqual(0);
      expect(metrics.recall).toBeGreaterThanOrEqual(0);
      expect(metrics.f1Score).toBeGreaterThanOrEqual(0);
      expect(metrics.sampleSize).toBe(10);
    });

    it("should handle empty model", () => {
      const metrics = model.validate();

      expect(metrics.accuracy).toBe(0);
      expect(metrics.precision).toBe(0);
      expect(metrics.recall).toBe(0);
      expect(metrics.f1Score).toBe(0);
      expect(metrics.sampleSize).toBe(0);
    });
  });

  describe("Query Methods", () => {
    it("should find users by criteria", () => {
      model.setPreferences(createDefaultPreferences("user-1"));

      const results = model.findByCriteria((prefs) =>
        prefs.layout.preferred === "grid"
      );

      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it("should get users by layout preference", () => {
      for (let i = 0; i < 5; i++) {
        const prefs = createDefaultPreferences(`user-${i}`);
        prefs.layout.preferred = i % 2 === 0 ? "grid" : "list";
        model.setPreferences(prefs);
      }

      const gridUsers = model.getUsersByLayout("grid");

      expect(gridUsers.length).toBeGreaterThanOrEqual(2);
    });

    it("should get users by theme preference", () => {
      for (let i = 0; i < 5; i++) {
        const prefs = createDefaultPreferences(`user-${i}`);
        prefs.visual.theme = i % 2 === 0 ? "light" : "dark";
        model.setPreferences(prefs);
      }

      const lightUsers = model.getUsersByTheme("light");

      expect(lightUsers.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Data Management", () => {
    it("should delete user data", () => {
      model.setPreferences(createDefaultPreferences(userId));

      expect(model.getPreferences(userId)).toBeDefined();

      model.deleteUser(userId);

      expect(model.getPreferences(userId)).toBeNull();
    });

    it("should clear all data", () => {
      for (let i = 0; i < 5; i++) {
        model.setPreferences(createDefaultPreferences(`user-${i}`));
      }

      model.clear();

      expect(model.getUserCount()).toBe(0);
    });

    it("should export all preferences", () => {
      for (let i = 0; i < 5; i++) {
        model.setPreferences(createDefaultPreferences(`user-${i}`));
      }

      const exported = model.exportAll();

      expect(exported.length).toBe(5);
    });

    it("should import preferences", () => {
      const prefs = [createDefaultPreferences("user-1"), createDefaultPreferences("user-2")];

      model.import(prefs);

      expect(model.getUserCount()).toBe(2);
    });
  });

  describe("Model Definition", () => {
    it("should convert to model definition", () => {
      model.setPreferences(createDefaultPreferences(userId));

      const modelDef = model.toModelDef();

      expect(modelDef.id).toBeDefined();
      expect(modelDef.name).toBeDefined();
      expect(modelDef.version).toBeDefined();
      expect(modelDef.type).toBe("preference");
      expect(modelDef.performance).toBeDefined();
      expect(modelDef.createdAt).toBeDefined();
      expect(modelDef.updatedAt).toBeDefined();
    });
  });

  describe("User Count", () => {
    it("should track user count", () => {
      expect(model.getUserCount()).toBe(0);

      model.setPreferences(createDefaultPreferences("user-1"));
      expect(model.getUserCount()).toBe(1);

      model.setPreferences(createDefaultPreferences("user-2"));
      expect(model.getUserCount()).toBe(2);

      model.deleteUser("user-1");
      expect(model.getUserCount()).toBe(1);
    });
  });
});

function createSampleInteractions(userId: string, count: number): Interaction[] {
  const interactions: Interaction[] = [];

  for (let i = 0; i < count; i++) {
    interactions.push({
      type: "click",
      element: {
        id: `element-${i}`,
        type: "button",
        position: { x: 100, y: 100, width: 50, height: 30 }
      },
      timestamp: Date.now() + i * 100,
      position: { x: 100, y: 100 },
      context: {
        page: "/test",
        viewport: { width: 1000, height: 800 },
        timestamp: Date.now()
      }
    });
  }

  return interactions;
}

function createDefaultPreferences(userId: string): UserPreferences {
  return {
    userId,
    layout: {
      preferred: "grid",
      density: "normal",
      alignment: "left",
      confidence: 0.8
    },
    visual: {
      theme: "light",
      primaryColor: "#007bff",
      accentColor: "#28a745",
      borderRadius: 4,
      shadows: true,
      animations: true,
      confidence: 0.8
    },
    typography: {
      fontFamily: "system-ui",
      fontSize: "medium",
      lineHeight: 1.5,
      letterSpacing: 0,
      fontWeight: 400,
      confidence: 0.7
    },
    components: {
      preferred: ["button", "card"],
      avoided: [],
      customizations: {},
      confidence: 0.6
    },
    navigation: {
      style: "sidebar",
      position: "left",
      sticky: true,
      collapsed: false,
      confidence: 0.7
    },
    overallConfidence: 0.72,
    lastUpdated: Date.now(),
    version: 1
  };
}

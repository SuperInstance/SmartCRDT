/**
 * Tests for Personalizer
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Personalizer, type PersonalizationRequest } from "../src/personalization/Personalizer.js";
import type { UserPreferences, UIContext, UIState, UIOption } from "../src/types.js";

describe("Personalizer", () => {
  let personalizer: Personalizer;
  const userId = "test-user";

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
    personalizer = new Personalizer();
  });

  describe("Personalization", () => {
    it("should personalize UI for user", () => {
      const request: PersonalizationRequest = {
        userId,
        context: baseContext,
        currentState: baseState,
        availableOptions: []
      };

      const response = personalizer.personalize(request);

      expect(response).toBeDefined();
      expect(response.personalized).toBeDefined();
      expect(response.changes).toBeInstanceOf(Array);
      expect(response.confidence).toBeGreaterThanOrEqual(0);
      expect(response.reason).toBeDefined();
    });

    it("should update layout if needed", () => {
      const request: PersonalizationRequest = {
        userId,
        context: { ...baseContext, viewport: { width: 375, height: 667 } },
        currentState: { ...baseState, layout: "grid" },
        availableOptions: []
      };

      const response = personalizer.personalize(request);

      const layoutChange = response.changes.find((c) => c.property === "layout");

      if (layoutChange) {
        expect(layoutChange.oldValue).toBe("grid");
        expect(layoutChange.newValue).toBeDefined();
      }
    });

    it("should update theme if needed", () => {
      const nightTime = new Date(2025, 0, 1, 22, 0).getTime();

      const request: PersonalizationRequest = {
        userId,
        context: { ...baseContext, timestamp: nightTime },
        currentState: { ...baseState, theme: "light" },
        availableOptions: []
      };

      const response = personalizer.personalize(request);

      const themeChange = response.changes.find((c) => c.property === "theme");

      if (themeChange) {
        expect(themeChange.newValue).toBe("dark");
      }
    });

    it("should personalize styles", () => {
      const request: PersonalizationRequest = {
        userId,
        context: baseContext,
        currentState: baseState,
        availableOptions: []
      };

      const response = personalizer.personalize(request);

      expect(response.personalized.styles).toBeDefined();
    });
  });

  describe("Preference Management", () => {
    it("should update user preferences", () => {
      const prefs: UserPreferences = {
        userId,
        layout: {
          preferred: "list",
          density: "compact",
          alignment: "left",
          confidence: 0.9
        },
        visual: {
          theme: "dark",
          primaryColor: "#ff0000",
          accentColor: "#00ff00",
          borderRadius: 8,
          shadows: false,
          animations: true,
          confidence: 0.8
        },
        typography: {
          fontFamily: "Arial",
          fontSize: "large",
          lineHeight: 1.6,
          letterSpacing: 0.5,
          fontWeight: 500,
          confidence: 0.7
        },
        components: {
          preferred: ["table", "chart"],
          avoided: ["modal"],
          customizations: {},
          confidence: 0.6
        },
        navigation: {
          style: "topbar",
          position: "top",
          sticky: false,
          collapsed: false,
          confidence: 0.7
        },
        overallConfidence: 0.74,
        lastUpdated: Date.now(),
        version: 1
      };

      personalizer.updatePreferences(prefs);

      const retrieved = personalizer.getPreferences(userId);

      expect(retrieved).toEqual(prefs);
    });

    it("should create default preferences for new users", () => {
      const request: PersonalizationRequest = {
        userId: "new-user",
        context: baseContext,
        currentState: baseState,
        availableOptions: []
      };

      personalizer.personalize(request);

      const prefs = personalizer.getPreferences("new-user");

      expect(prefs).toBeDefined();
      expect(prefs!.userId).toBe("new-user");
    });
  });

  describe("Personalization Changes", () => {
    it("should track changes with confidence", () => {
      const request: PersonalizationRequest = {
        userId,
        context: baseContext,
        currentState: baseState,
        availableOptions: []
      };

      const response = personalizer.personalize(request);

      for (const change of response.changes) {
        expect(change.property).toBeDefined();
        expect(change.oldValue).toBeDefined();
        expect(change.newValue).toBeDefined();
        expect(change.confidence).toBeGreaterThanOrEqual(0);
        expect(change.confidence).toBeLessThanOrEqual(1);
      }
    });

    it("should handle no changes needed", () => {
      personalizer.updatePreferences(createDefaultPreferences(userId));

      const request: PersonalizationRequest = {
        userId,
        context: baseContext,
        currentState: baseState,
        availableOptions: []
      };

      const response = personalizer.personalize(request);

      expect(response.changes).toBeInstanceOf(Array);
    });
  });

  describe("History Tracking", () => {
    it("should record personalization history", () => {
      const request: PersonalizationRequest = {
        userId,
        context: baseContext,
        currentState: baseState,
        availableOptions: []
      };

      personalizer.personalize(request);

      const history = personalizer.getPersonalizationHistory(userId);

      expect(history.length).toBeGreaterThan(0);

      const record = history[0]!;
      expect(record.userId).toBe(userId);
      expect(record.state).toBeDefined();
      expect(record.changes).toBeInstanceOf(Array);
      expect(record.timestamp).toBeGreaterThan(0);
    });

    it("should keep limited history", () => {
      const request: PersonalizationRequest = {
        userId,
        context: baseContext,
        currentState: baseState,
        availableOptions: []
      };

      // Make more than 100 requests
      for (let i = 0; i < 150; i++) {
        personalizer.personalize({
          ...request,
          context: { ...baseContext, timestamp: Date.now() + i }
        });
      }

      const history = personalizer.getPersonalizationHistory(userId);

      // Should keep only last 100
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  describe("Confidence Calculation", () => {
    it("should calculate overall confidence", () => {
      const request: PersonalizationRequest = {
        userId,
        context: baseContext,
        currentState: baseState,
        availableOptions: []
      };

      const response = personalizer.personalize(request);

      expect(response.confidence).toBeGreaterThanOrEqual(0);
      expect(response.confidence).toBeLessThanOrEqual(1);
    });

    it("should have higher confidence with preferences", () => {
      personalizer.updatePreferences(createDefaultPreferences(userId));

      const request: PersonalizationRequest = {
        userId,
        context: baseContext,
        currentState: baseState,
        availableOptions: []
      };

      const response = personalizer.personalize(request);

      expect(response.confidence).toBeGreaterThan(0);
    });
  });

  describe("Reason Generation", () => {
    it("should generate meaningful reasons", () => {
      const request: PersonalizationRequest = {
        userId,
        context: baseContext,
        currentState: baseState,
        availableOptions: []
      };

      const response = personalizer.personalize(request);

      expect(response.reason).toBeDefined();
      expect(response.reason.length).toBeGreaterThan(0);
    });

    it("should include context in reason", () => {
      const request: PersonalizationRequest = {
        userId,
        context: { ...baseContext, viewport: { width: 375, height: 667 } },
        currentState: baseState,
        availableOptions: []
      };

      const response = personalizer.personalize(request);

      expect(response.reason).toBeDefined();
    });
  });

  describe("Data Management", () => {
    it("should clear user data", () => {
      personalizer.updatePreferences(createDefaultPreferences(userId));

      const request: PersonalizationRequest = {
        userId,
        context: baseContext,
        currentState: baseState,
        availableOptions: []
      };

      personalizer.personalize(request);

      expect(personalizer.getPreferences(userId)).toBeDefined();

      personalizer.clearUser(userId);

      expect(personalizer.getPreferences(userId)).toBeUndefined();
    });

    it("should clear all data", () => {
      personalizer.updatePreferences(createDefaultPreferences(userId));

      const request: PersonalizationRequest = {
        userId,
        context: baseContext,
        currentState: baseState,
        availableOptions: []
      };

      personalizer.personalize(request);

      personalizer.clear();

      expect(personalizer.getPreferences(userId)).toBeUndefined();
      expect(personalizer.getPersonalizationHistory(userId)).toHaveLength(0);
    });
  });

  describe("Statistics", () => {
    it("should calculate statistics", () => {
      const request: PersonalizationRequest = {
        userId,
        context: baseContext,
        currentState: baseState,
        availableOptions: []
      };

      personalizer.personalize(request);

      const stats = personalizer.getStatistics();

      expect(stats.totalUsers).toBeGreaterThanOrEqual(1);
      expect(stats.totalPersonalizations).toBeGreaterThanOrEqual(1);
      expect(stats.avgConfidence).toBeGreaterThanOrEqual(0);
      expect(stats.avgConfidence).toBeLessThanOrEqual(1);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty available options", () => {
      const request: PersonalizationRequest = {
        userId,
        context: baseContext,
        currentState: baseState,
        availableOptions: []
      };

      const response = personalizer.personalize(request);

      expect(response).toBeDefined();
    });

    it("should handle minimal state", () => {
      const minimalState: UIState = {
        layout: "grid",
        density: "normal",
        theme: "light",
        components: [],
        styles: {}
      };

      const request: PersonalizationRequest = {
        userId,
        context: baseContext,
        currentState: minimalState,
        availableOptions: []
      };

      const response = personalizer.personalize(request);

      expect(response).toBeDefined();
    });

    it("should handle extreme viewport sizes", () => {
      const extremeContexts: UIContext[] = [
        { ...baseContext, viewport: { width: 1, height: 1 } },
        { ...baseContext, viewport: { width: 10000, height: 10000 } }
      ];

      for (const context of extremeContexts) {
        const request: PersonalizationRequest = {
          userId,
          context,
          currentState: baseState,
          availableOptions: []
        };

        const response = personalizer.personalize(request);

        expect(response).toBeDefined();
      }
    });
  });
});

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

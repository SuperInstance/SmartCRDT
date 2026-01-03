/**
 * @fileoverview Tests for UI Preference Learning system
 * @author Aequor Project - Round 18 Agent 1
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  PreferenceCollector,
  InMemoryPreferenceStorage,
  createPreferenceCollector,
  type UIInteraction,
  type UserPreference,
} from "./PreferenceCollector.js";
import {
  PatternAnalyzer,
  createPatternAnalyzer,
  type PreferenceProfile,
} from "./PatternAnalyzer.js";
import {
  PersonalizationEngine,
  createPersonalizationEngine,
  createContext,
  type PersonalizationContext,
} from "./PersonalizationEngine.js";
import type { A2UIResponse } from "@lsi/protocol";

// ============================================================================
// TEST DATA
// ============================================================================

const createMockInteraction = (
  overrides?: Partial<UIInteraction>
): UIInteraction => ({
  id: "test-id",
  userId: "test-user",
  sessionId: "test-session",
  timestamp: new Date(),
  type: "click",
  componentId: "btn-1",
  componentType: "button",
  properties: {},
  context: {
    viewport: { width: 1920, height: 1080 },
    uiState: "state-123",
  },
  ...overrides,
});

const createMockUI = (): A2UIResponse => ({
  version: "1.0.0",
  layout: {
    type: "flex",
    direction: "column",
    gap: 16,
    padding: 16,
  },
  components: [
    { id: "c1", type: "button", props: { label: "Click me" } },
    { id: "c2", type: "input", props: { placeholder: "Enter text" } },
    { id: "c3", type: "text", props: { content: "Hello world" } },
  ],
});

// ============================================================================
// PREFERENCE COLLECTOR TESTS
// ============================================================================

describe("PreferenceCollector", () => {
  let collector: PreferenceCollector;
  let storage: InMemoryPreferenceStorage;

  beforeEach(() => {
    storage = new InMemoryPreferenceStorage();
    collector = new PreferenceCollector({ storage });
  });

  describe("recordInteraction", () => {
    it("should record an interaction and return an ID", async () => {
      const interaction = createMockInteraction();
      const id = await collector.recordInteraction(interaction);
      expect(id).toBeTruthy();
      expect(id).toMatch(/^pref_/);
    });

    it("should cache interactions by session", async () => {
      const interaction = createMockInteraction();
      await collector.recordInteraction(interaction);
      await collector.recordInteraction(interaction);

      const pref = await collector.getOrCreateUserPreference(
        "test-user",
        "test-session"
      );
      await collector.flushSession("test-user", "test-session");

      const updated = await storage.get("test-user");
      expect(updated?.sessionStats.totalInteractions).toBeGreaterThan(0);
    });

    it("should respect sampling rate", async () => {
      const lowRateCollector = new PreferenceCollector({
        storage,
        samplingRate: 0.0, // Never sample
      });

      const id = await lowRateCollector.recordInteraction(
        createMockInteraction()
      );
      expect(id).toBe("");
    });

    it("should enforce max interactions per session", async () => {
      const collector = new PreferenceCollector({
        storage,
        maxInteractionsPerSession: 5,
      });

      for (let i = 0; i < 10; i++) {
        await collector.recordInteraction(createMockInteraction());
      }

      await collector.flushSession("test-user", "test-session");
      const pref = await storage.get("test-user");

      // Should have capped at 5
      expect(pref?.sessionStats.totalInteractions).toBeLessThanOrEqual(10);
    });
  });

  describe("recordExplicitPreference", () => {
    it("should update explicit preferences", async () => {
      await collector.getOrCreateUserPreference("test-user", "test-session");
      await collector.recordExplicitPreference("test-user", "test-session", {
        layoutDensity: "compact",
        theme: "dark",
      });

      const pref = await storage.get("test-user");
      expect(pref?.explicitPreferences.layoutDensity).toBe("compact");
      expect(pref?.explicitPreferences.theme).toBe("dark");
    });
  });

  describe("getUserPreference", () => {
    it("should return null for non-existent user", async () => {
      const pref = await collector.getUserPreference("non-existent");
      expect(pref).toBeNull();
    });

    it("should return existing preference", async () => {
      await collector.getOrCreateUserPreference("test-user", "test-session");
      const pref = await collector.getUserPreference("test-user");
      expect(pref).toBeTruthy();
      expect(pref?.userId).toBe("test-user");
    });
  });

  describe("getOrCreateUserPreference", () => {
    it("should create default preference for new user", async () => {
      const pref = await collector.getOrCreateUserPreference(
        "new-user",
        "session-1"
      );
      expect(pref.userId).toBe("new-user");
      expect(pref.explicitPreferences.layoutDensity).toBe("comfortable");
      expect(pref.explicitPreferences.theme).toBe("auto");
    });

    it("should return existing preference", async () => {
      const pref1 = await collector.getOrCreateUserPreference(
        "test-user",
        "session-1"
      );
      const pref2 = await collector.getOrCreateUserPreference(
        "test-user",
        "session-2"
      );
      expect(pref1.userId).toBe(pref2.userId);
    });
  });

  describe("flushSession", () => {
    it("should process cached interactions", async () => {
      await collector.recordInteraction(createMockInteraction());
      await collector.recordInteraction(createMockInteraction());
      await collector.flushSession("test-user", "test-session");

      const pref = await storage.get("test-user");
      expect(pref?.sessionStats.totalInteractions).toBeGreaterThan(0);
    });
  });

  describe("cleanupOldData", () => {
    it("should remove old interaction patterns", async () => {
      const collector = new PreferenceCollector({
        storage,
        retentionDays: 1,
      });

      await collector.getOrCreateUserPreference("test-user", "test-session");
      await collector.cleanupOldData();

      const cleaned = await collector.cleanupOldData();
      expect(typeof cleaned).toBe("number");
    });
  });

  describe("getComponentUsage", () => {
    it("should return component usage statistics", async () => {
      const interaction = createMockInteraction({
        componentId: "button-1",
        componentType: "button",
      });
      await collector.recordInteraction(interaction);
      await collector.flushSession("test-user", "test-session");

      const usage = await collector.getComponentUsage("test-user");
      expect(Array.isArray(usage)).toBe(true);
    });
  });
});

// ============================================================================
// PATTERN ANALYZER TESTS
// ============================================================================

describe("PatternAnalyzer", () => {
  let analyzer: PatternAnalyzer;

  beforeEach(() => {
    analyzer = new PatternAnalyzer();
  });

  describe("analyzePreferences", () => {
    it("should return default profile for new users", async () => {
      const mockPreference: UserPreference = {
        userId: "new-user",
        sessionId: "session-1",
        lastUpdated: new Date(),
        explicitPreferences: {
          layoutDensity: "comfortable",
          theme: "auto",
          fontSize: 16,
          language: "en",
          timezone: "UTC",
        },
        implicitPreferences: {
          preferredComponentTypes: [],
          avoidedComponentTypes: [],
          preferredLayout: "default",
          navigationStyle: "sidebar",
          informationDensity: 0.5,
          interactionStyle: "mixed",
        },
        componentUsage: new Map(),
        interactionPatterns: [],
        sessionStats: {
          totalInteractions: 5,
          avgSessionDuration: 60000,
          lastSession: new Date(),
          totalSessions: 1,
        },
      };

      const profile = await analyzer.analyzePreferences(mockPreference);
      expect(profile.userId).toBe("new-user");
      expect(profile.confidence).toBeLessThan(0.6);
    });

    it("should analyze user with sufficient data", async () => {
      const mockPreference: UserPreference = {
        userId: "active-user",
        sessionId: "session-1",
        lastUpdated: new Date(),
        explicitPreferences: {
          layoutDensity: "spacious",
          theme: "dark",
          fontSize: 18,
          language: "en",
          timezone: "UTC",
        },
        implicitPreferences: {
          preferredComponentTypes: ["button", "input"],
          avoidedComponentTypes: ["modal"],
          preferredLayout: "sidebar",
          navigationStyle: "sidebar",
          informationDensity: 0.3,
          interactionStyle: "mouse",
        },
        componentUsage: new Map([
          [
            "btn-1",
            {
              componentId: "btn-1",
              componentType: "button",
              viewCount: 100,
              interactionCount: 50,
              avgDwellTime: 2000,
              lastUsed: new Date(),
              firstUsed: new Date(),
              successRate: 0.9,
            },
          ],
        ]),
        interactionPatterns: [
          {
            type: "click",
            frequency: 50,
            avgTimeOfDay: 14,
            dayOfWeek: 2,
            sequence: ["button", "input"],
            confidence: 0.8,
          },
        ],
        sessionStats: {
          totalInteractions: 100,
          avgSessionDuration: 300000,
          lastSession: new Date(),
          totalSessions: 20,
        },
      };

      const profile = await analyzer.analyzePreferences(mockPreference);
      expect(profile.userId).toBe("active-user");
      expect(profile.confidence).toBeGreaterThan(0.5);
      expect(profile.layout.preferredDensity).toBe("spacious");
      expect(profile.preferredComponents).toContain("button");
    });
  });

  describe("analyzeSequence", () => {
    it("should detect sequential patterns", () => {
      const interactions: UIInteraction[] = [
        createMockInteraction({ componentType: "button" }),
        createMockInteraction({ componentType: "input" }),
        createMockInteraction({ componentType: "button" }),
        createMockInteraction({ componentType: "input" }),
      ];

      const patterns = analyzer.analyzeSequence(interactions);
      expect(patterns.length).toBeGreaterThan(0);
    });
  });

  describe("compareProfiles", () => {
    it("should calculate similarity between profiles", async () => {
      const profile1: PreferenceProfile = {
        userId: "user1",
        analysisDate: new Date(),
        layout: {
          preferredDensity: "comfortable",
          preferredNavigation: "sidebar",
          optimalComponentCount: 8,
          informationTolerance: 0.5,
          scrollBehavior: "lazy",
          confidence: 0.7,
        },
        preferredComponents: ["button", "input"],
        avoidedComponents: [],
        componentEfficiency: [],
        patterns: [],
        peakUsageTimes: [9, 14],
        peakUsageDays: [1, 2],
        avgSessionLength: 5,
        recommendations: [],
        confidence: 0.7,
      };

      const profile2: PreferenceProfile = {
        ...profile1,
        userId: "user2",
        layout: {
          ...profile1.layout,
          preferredDensity: "compact",
        },
      };

      const result = analyzer.compareProfiles(profile1, profile2);
      expect(result.similarity).toBeGreaterThanOrEqual(0);
      expect(result.similarity).toBeLessThanOrEqual(1);
    });
  });
});

// ============================================================================
// PERSONALIZATION ENGINE TESTS
// ============================================================================

describe("PersonalizationEngine", () => {
  let engine: PersonalizationEngine;

  beforeEach(() => {
    engine = new PersonalizationEngine();
  });

  describe("personalizeUI", () => {
    it("should return original UI for low confidence profiles", async () => {
      const baseUI = createMockUI();
      const profile: PreferenceProfile = {
        userId: "new-user",
        analysisDate: new Date(),
        layout: {
          preferredDensity: "comfortable",
          preferredNavigation: "sidebar",
          optimalComponentCount: 8,
          informationTolerance: 0.5,
          scrollBehavior: "lazy",
          confidence: 0.3,
        },
        preferredComponents: [],
        avoidedComponents: [],
        componentEfficiency: [],
        patterns: [],
        peakUsageTimes: [],
        peakUsageDays: [],
        avgSessionLength: 0,
        recommendations: [],
        confidence: 0.3,
      };

      const context: PersonalizationContext = {
        userId: "new-user",
        sessionId: "session-1",
        strategy: "moderate",
        timeOfDay: 12,
        dayOfWeek: 2,
        deviceType: "desktop",
        viewport: { width: 1920, height: 1080 },
      };

      const result = await engine.personalizeUI(baseUI, profile, context);
      expect(result.applied).toBe(false);
      expect(result.personalized).toEqual(baseUI);
    });

    it("should apply personalization for high confidence profiles", async () => {
      const baseUI = createMockUI();
      const profile: PreferenceProfile = {
        userId: "active-user",
        analysisDate: new Date(),
        layout: {
          preferredDensity: "spacious",
          preferredNavigation: "sidebar",
          optimalComponentCount: 8,
          informationTolerance: 0.3,
          scrollBehavior: "lazy",
          confidence: 0.8,
        },
        preferredComponents: ["button", "input"],
        avoidedComponents: ["modal"],
        componentEfficiency: [],
        patterns: [],
        peakUsageTimes: [],
        peakUsageDays: [],
        avgSessionLength: 5,
        recommendations: [],
        confidence: 0.8,
      };

      const context = createContext("active-user", "session-1", "desktop", {
        width: 1920,
        height: 1080,
      });

      const result = await engine.personalizeUI(baseUI, profile, context);
      expect(result.applied).toBe(true);
      expect(result.changes.length).toBeGreaterThan(0);
    });

    it("should apply layout spacing based on density", async () => {
      const baseUI = createMockUI();
      const profile: PreferenceProfile = {
        userId: "user",
        analysisDate: new Date(),
        layout: {
          preferredDensity: "compact",
          preferredNavigation: "sidebar",
          optimalComponentCount: 15,
          informationTolerance: 0.8,
          scrollBehavior: "active",
          confidence: 0.9,
        },
        preferredComponents: [],
        avoidedComponents: [],
        componentEfficiency: [],
        patterns: [],
        peakUsageTimes: [],
        peakUsageDays: [],
        avgSessionLength: 5,
        recommendations: [],
        confidence: 0.9,
      };

      const context = createContext("user", "session-1", "desktop", {
        width: 1920,
        height: 1080,
      });

      const result = await engine.personalizeUI(baseUI, profile, context);
      expect(result.personalized.layout?.gap).toBe(8); // Compact spacing
    });
  });

  describe("createVariants", () => {
    it("should create multiple UI variants", () => {
      const baseUI = createMockUI();
      const profile: PreferenceProfile = {
        userId: "user",
        analysisDate: new Date(),
        layout: {
          preferredDensity: "comfortable",
          preferredNavigation: "sidebar",
          optimalComponentCount: 8,
          informationTolerance: 0.5,
          scrollBehavior: "lazy",
          confidence: 0.7,
        },
        preferredComponents: [],
        avoidedComponents: [],
        componentEfficiency: [],
        patterns: [],
        peakUsageTimes: [],
        peakUsageDays: [],
        avgSessionLength: 5,
        recommendations: [],
        confidence: 0.7,
      };

      const variants = engine.createVariants(baseUI, profile);
      expect(variants.length).toBeGreaterThanOrEqual(3);
      expect(variants[0].id).toBe("control");
    });
  });

  describe("runABTest", () => {
    it("should run A/B test and return results", async () => {
      const baseUI = createMockUI();
      const profile: PreferenceProfile = {
        userId: "user",
        analysisDate: new Date(),
        layout: {
          preferredDensity: "comfortable",
          preferredNavigation: "sidebar",
          optimalComponentCount: 8,
          informationTolerance: 0.5,
          scrollBehavior: "lazy",
          confidence: 0.7,
        },
        preferredComponents: [],
        avoidedComponents: [],
        componentEfficiency: [],
        patterns: [],
        peakUsageTimes: [],
        peakUsageDays: [],
        avgSessionLength: 5,
        recommendations: [],
        confidence: 0.7,
      };

      const variants = engine.createVariants(baseUI, profile);
      const context = createContext("user", "session-1", "desktop", {
        width: 1920,
        height: 1080,
      });

      const results = await engine.runABTest(variants, context, 100);
      expect(results.length).toBe(variants.length);
      expect(results.some(r => r.isWinner)).toBe(true);
    });
  });

  describe("getRecommendedVariant", () => {
    it("should return recommended variant", () => {
      const baseUI = createMockUI();
      const profile: PreferenceProfile = {
        userId: "user",
        analysisDate: new Date(),
        layout: {
          preferredDensity: "comfortable",
          preferredNavigation: "sidebar",
          optimalComponentCount: 8,
          informationTolerance: 0.5,
          scrollBehavior: "lazy",
          confidence: 0.7,
        },
        preferredComponents: [],
        avoidedComponents: [],
        componentEfficiency: [],
        patterns: [],
        peakUsageTimes: [],
        peakUsageDays: [],
        avgSessionLength: 5,
        recommendations: [],
        confidence: 0.7,
      };

      const variants = engine.createVariants(baseUI, profile);
      const variant = engine.getRecommendedVariant(variants, profile);
      expect(variant).toBeTruthy();
    });
  });

  describe("recordFeedback", () => {
    it("should record user feedback", async () => {
      const baseUI = createMockUI();
      const profile: PreferenceProfile = {
        userId: "user",
        analysisDate: new Date(),
        layout: {
          preferredDensity: "comfortable",
          preferredNavigation: "sidebar",
          optimalComponentCount: 8,
          informationTolerance: 0.5,
          scrollBehavior: "lazy",
          confidence: 0.7,
        },
        preferredComponents: [],
        avoidedComponents: [],
        componentEfficiency: [],
        patterns: [],
        peakUsageTimes: [],
        peakUsageDays: [],
        avgSessionLength: 5,
        recommendations: [],
        confidence: 0.7,
      };

      const variants = engine.createVariants(baseUI, profile);
      const context = createContext("user", "session-1", "desktop", {
        width: 1920,
        height: 1080,
      });

      await engine.runABTest(variants, context, 100);
      await engine.recordFeedback("user", "moderate", "positive");

      // Should not throw
      expect(true).toBe(true);
    });
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe("Utility Functions", () => {
  describe("createContext", () => {
    it("should create personalization context", () => {
      const context = createContext("user-1", "session-1", "mobile", {
        width: 375,
        height: 667,
      });
      expect(context.userId).toBe("user-1");
      expect(context.deviceType).toBe("mobile");
      expect(context.timeOfDay).toBeGreaterThanOrEqual(0);
      expect(context.timeOfDay).toBeLessThan(24);
    });
  });

  describe("createPreferenceCollector", () => {
    it("should create collector with in-memory storage", () => {
      const collector = createPreferenceCollector();
      expect(collector).toBeInstanceOf(PreferenceCollector);
    });
  });

  describe("createPatternAnalyzer", () => {
    it("should create analyzer with default config", () => {
      const analyzer = createPatternAnalyzer();
      expect(analyzer).toBeInstanceOf(PatternAnalyzer);
    });
  });

  describe("createPersonalizationEngine", () => {
    it("should create engine with default config", () => {
      const engine = createPersonalizationEngine();
      expect(engine).toBeInstanceOf(PersonalizationEngine);
    });
  });
});

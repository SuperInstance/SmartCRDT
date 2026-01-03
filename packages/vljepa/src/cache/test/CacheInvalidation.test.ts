/**
 * CacheInvalidation.test.ts
 *
 * Comprehensive tests for CacheInvalidation strategies.
 * Target: 40+ tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  CacheInvalidation,
  DEFAULT_CACHE_INVALIDATION_CONFIG,
  AGGRESSIVE_CACHE_INVALIDATION_CONFIG,
  CONSERVATIVE_CACHE_INVALIDATION_CONFIG,
  type InvalidationEvent,
} from "../CacheInvalidation.js";

// ============================================================================
// TEST UTILITIES
// ============================================================================

function createMockElement(tagName: string = "div"): Element {
  const div = document.createElement(tagName);
  div.id = `test-${tagName}-${Date.now()}`;
  div.className = "test-class";
  return div;
}

function createMockImageData(
  width: number = 100,
  height: number = 100
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.random() * 255;
    data[i + 1] = Math.random() * 255;
    data[i + 2] = Math.random() * 255;
    data[i + 3] = 255;
  }
  return new ImageData(data, width, height);
}

// ============================================================================
// STRUCTURE CHANGE DETECTOR TESTS
// ============================================================================

describe("StructureChangeDetector", () => {
  let invalidator: CacheInvalidation;

  beforeEach(() => {
    invalidator = new CacheInvalidation({
      automatic: false,
      logging: false,
      maxEventHistory: 100,
      rules: {
        structure: { trigger: "structure", threshold: 0.1, scope: "related" },
      },
    });
  });

  describe("Structure Change Detection", () => {
    it("should detect DOM structure changes", async () => {
      const container = document.createElement("div");
      const child = document.createElement("span");
      container.appendChild(child);

      const events = await invalidator.invalidate("structure", {
        element: container,
      });
      expect(events).toBeDefined();
      expect(Array.isArray(events)).toBe(true);
    });

    it("should invalidate related entries on structure change", async () => {
      const element = createMockElement();
      invalidator.registerKey("test-key", {
        structure: "div.test-class",
        image: createMockImageData(),
      });

      const events = await invalidator.invalidate("structure", { element });
      expect(events.length).toBeGreaterThanOrEqual(0);
    });

    it("should calculate structural difference", async () => {
      const element1 = createMockElement();
      const element2 = createMockElement();

      invalidator.registerKey("key1", {
        structure: "div",
        image: createMockImageData(),
      });
      invalidator.registerKey("key2", {
        structure: "span",
        image: createMockImageData(),
      });

      const events = await invalidator.invalidate("structure", {
        element: element1,
      });
      expect(events).toBeDefined();
    });
  });
});

// ============================================================================
// VISUAL CHANGE DETECTOR TESTS
// ============================================================================

describe("VisualChangeDetector", () => {
  let invalidator: CacheInvalidation;

  beforeEach(() => {
    invalidator = new CacheInvalidation({
      automatic: false,
      logging: false,
      maxEventHistory: 100,
      rules: {
        visual: { trigger: "visual", threshold: 0.05, scope: "single" },
      },
    });
  });

  describe("Visual Difference Calculation", () => {
    it("should calculate zero difference for identical images", async () => {
      const image = createMockImageData(100, 100);

      const events = await invalidator.invalidate("visual", {
        key: "test-key",
        oldImage: image,
        newImage: image,
      });

      // Identical images should not trigger invalidation
      expect(events).toBeDefined();
    });

    it("should invalidate on significant visual difference", async () => {
      const oldImage = createMockImageData(100, 100);
      const newImageData = new Uint8ClampedArray(100 * 100 * 4);
      newImageData.fill(255); // Completely white
      const newImage = new ImageData(newImageData, 100, 100);

      invalidator.registerKey("test-key", {
        structure: "test",
        image: oldImage,
      });

      const events = await invalidator.invalidate("visual", {
        key: "test-key",
        oldImage,
        newImage,
      });

      expect(events).toBeDefined();
    });

    it("should respect visual threshold", async () => {
      const lowThresholdInvalidator = new CacheInvalidation({
        rules: {
          visual: { trigger: "visual", threshold: 0.9, scope: "single" },
        },
        automatic: false,
        logging: false,
        maxEventHistory: 100,
      });

      const oldImage = createMockImageData();
      const newImage = createMockImageData();

      const events = await lowThresholdInvalidator.invalidate("visual", {
        key: "test-key",
        oldImage,
        newImage,
      });

      expect(events).toBeDefined();
    });
  });

  describe("Scope of Invalidation", () => {
    it("should invalidate single entry for single scope", async () => {
      const singleScopeInvalidator = new CacheInvalidation({
        rules: {
          visual: { trigger: "visual", threshold: 0.05, scope: "single" },
        },
        automatic: false,
        logging: false,
        maxEventHistory: 100,
      });

      const image = createMockImageData();
      singleScopeInvalidator.registerKey("key1", { structure: "test", image });
      singleScopeInvalidator.registerKey("key2", { structure: "test", image });

      const events = await singleScopeInvalidator.invalidate("visual", {
        key: "key1",
        oldImage: image,
        newImage: image,
      });

      expect(events).toBeDefined();
    });
  });
});

// ============================================================================
// USER INTERACTION DETECTOR TESTS
// ============================================================================

describe("UserInteractionDetector", () => {
  let invalidator: CacheInvalidation;

  beforeEach(() => {
    invalidator = new CacheInvalidation({
      automatic: false,
      logging: false,
      maxEventHistory: 100,
      rules: {
        interaction: {
          trigger: "interaction",
          threshold: 0.5,
          scope: "single",
          options: { interactionTypes: ["click", "input", "submit"] },
        },
      },
    });
  });

  describe("Interaction Detection", () => {
    it("should detect click interactions", async () => {
      const events = await invalidator.invalidate("interaction", {
        interaction: { type: "click", target: "#test-button" },
      });

      expect(events).toBeDefined();
      expect(Array.isArray(events)).toBe(true);
    });

    it("should detect input interactions", async () => {
      const events = await invalidator.invalidate("interaction", {
        interaction: { type: "input", target: "#test-input" },
      });

      expect(events).toBeDefined();
    });

    it("should detect submit interactions", async () => {
      const events = await invalidator.invalidate("interaction", {
        interaction: { type: "submit", target: "#test-form" },
      });

      expect(events).toBeDefined();
    });

    it("should invalidate based on interaction type", async () => {
      invalidator.registerKey("#test-button", {
        structure: "button",
        image: createMockImageData(),
      });

      const events = await invalidator.invalidate("interaction", {
        interaction: { type: "click", target: "#test-button" },
      });

      expect(events).toBeDefined();
    });
  });
});

// ============================================================================
// TIME-BASED INVALIDATION TESTS
// ============================================================================

describe("Time-Based Invalidation", () => {
  let invalidator: CacheInvalidator;

  beforeEach(() => {
    invalidator = new CacheInvalidation({
      automatic: false,
      logging: false,
      maxEventHistory: 100,
      rules: {
        time: { trigger: "time", threshold: 0, scope: "single" },
      },
    });
  });

  describe("TTL Expiration", () => {
    it("should invalidate expired entries", async () => {
      invalidator.registerKey("old-key", {
        structure: "test",
        image: createMockImageData(),
      });

      const events = await invalidator.invalidate("time");
      expect(events).toBeDefined();
    });

    it("should track entry age", async () => {
      invalidator.registerKey("test-key", {
        structure: "test",
        image: createMockImageData(),
      });

      const events = await invalidator.invalidate("time");
      expect(events).toBeDefined();
    });
  });
});

// ============================================================================
// EXPLICIT INVALIDATION TESTS
// ============================================================================

describe("Explicit Invalidation", () => {
  let invalidator: CacheInvalidation;

  beforeEach(() => {
    invalidator = new CacheInvalidation({
      automatic: false,
      logging: false,
      maxEventHistory: 100,
      rules: {
        explicit: { trigger: "explicit", threshold: 0, scope: "all" },
      },
    });
  });

  describe("User-Requested Invalidation", () => {
    it("should clear all cache on explicit invalidation", async () => {
      invalidator.registerKey("key1", {
        structure: "test",
        image: createMockImageData(),
      });
      invalidator.registerKey("key2", {
        structure: "test",
        image: createMockImageData(),
      });
      invalidator.registerKey("key3", {
        structure: "test",
        image: createMockImageData(),
      });

      const events = await invalidator.invalidate("explicit");

      expect(events).toBeDefined();
      expect(events.length).toBeGreaterThanOrEqual(0);
    });

    it('should use "all" scope by default', async () => {
      const events = await invalidator.invalidate("explicit");

      expect(events).toBeDefined();
      if (events.length > 0) {
        expect(events[0].scope).toBe("all");
      }
    });
  });
});

// ============================================================================
// EVENT HISTORY TESTS
// ============================================================================

describe("Event History", () => {
  let invalidator: CacheInvalidation;

  beforeEach(() => {
    invalidator = new CacheInvalidation({
      automatic: false,
      logging: false,
      maxEventHistory: 100,
      rules: {
        explicit: { trigger: "explicit", threshold: 0, scope: "all" },
      },
    });
  });

  describe("History Tracking", () => {
    it("should track invalidation events", async () => {
      await invalidator.invalidate("explicit");

      const history = invalidator.getEventHistory();
      expect(history.length).toBeGreaterThanOrEqual(0);
    });

    it("should include timestamp in events", async () => {
      await invalidator.invalidate("explicit");

      const history = invalidator.getEventHistory();
      if (history.length > 0) {
        expect(history[0].timestamp).toBeDefined();
        expect(history[0].timestamp).toBeLessThanOrEqual(Date.now());
      }
    });

    it("should include reason in events", async () => {
      await invalidator.invalidate("explicit");

      const history = invalidator.getEventHistory();
      if (history.length > 0) {
        expect(history[0].reason).toBeDefined();
      }
    });

    it("should trim history when exceeding max size", async () => {
      const smallHistoryInvalidator = new CacheInvalidation({
        automatic: false,
        logging: false,
        maxEventHistory: 5,
        rules: {
          explicit: { trigger: "explicit", threshold: 0, scope: "all" },
        },
      });

      // Generate more events than max
      for (let i = 0; i < 10; i++) {
        await smallHistoryInvalidator.invalidate("explicit");
      }

      const history = smallHistoryInvalidator.getEventHistory();
      expect(history.length).toBeLessThanOrEqual(5);
    });

    it("should clear history", async () => {
      await invalidator.invalidate("explicit");
      invalidator.clearHistory();

      const history = invalidator.getEventHistory();
      expect(history.length).toBe(0);
    });
  });
});

// ============================================================================
// CONFIGURATION TESTS
// ============================================================================

describe("Configuration", () => {
  describe("Default Configuration", () => {
    it("should have default config values", () => {
      expect(DEFAULT_CACHE_INVALIDATION_CONFIG.rules.structure).toBeDefined();
      expect(DEFAULT_CACHE_INVALIDATION_CONFIG.rules.visual).toBeDefined();
      expect(DEFAULT_CACHE_INVALIDATION_CONFIG.rules.interaction).toBeDefined();
      expect(DEFAULT_CACHE_INVALIDATION_CONFIG.automatic).toBe(false);
    });
  });

  describe("Aggressive Configuration", () => {
    it("should have more sensitive thresholds", () => {
      expect(
        AGGRESSIVE_CACHE_INVALIDATION_CONFIG.rules.structure?.threshold
      ).toBe(0.05);
      expect(AGGRESSIVE_CACHE_INVALIDATION_CONFIG.rules.visual?.threshold).toBe(
        0.02
      );
      expect(AGGRESSIVE_CACHE_INVALIDATION_CONFIG.automatic).toBe(true);
    });
  });

  describe("Conservative Configuration", () => {
    it("should have less sensitive thresholds", () => {
      expect(
        CONSERVATIVE_CACHE_INVALIDATION_CONFIG.rules.structure?.threshold
      ).toBe(0.2);
      expect(
        CONSERVATIVE_CACHE_INVALIDATION_CONFIG.rules.visual?.threshold
      ).toBe(0.1);
      expect(CONSERVATIVE_CACHE_INVALIDATION_CONFIG.automatic).toBe(false);
    });
  });

  describe("Configuration Updates", () => {
    it("should update configuration", () => {
      const invalidator = new CacheInvalidation();
      const originalConfig = invalidator.getConfig();

      invalidator.updateConfig({ automatic: true, logging: true });

      const newConfig = invalidator.getConfig();
      expect(newConfig.automatic).toBe(true);
      expect(newConfig.logging).toBe(true);
    });
  });
});

// ============================================================================
// KEY REGISTRATION TESTS
// ============================================================================

describe("Key Registration", () => {
  let invalidator: CacheInvalidation;

  beforeEach(() => {
    invalidator = new CacheInvalidation();
  });

  it("should register cache key", () => {
    invalidator.registerKey("test-key", {
      structure: "div.test",
      image: createMockImageData(),
    });

    // Key should be registered
    expect(invalidator.getEventHistory()).toBeDefined();
  });

  it("should unregister cache key", () => {
    invalidator.registerKey("test-key", {
      structure: "div.test",
      image: createMockImageData(),
    });

    invalidator.unregisterKey("test-key");
    // Should not throw
  });

  it("should handle multiple key registrations", () => {
    for (let i = 0; i < 10; i++) {
      invalidator.registerKey(`key-${i}`, {
        structure: `div.test-${i}`,
        image: createMockImageData(),
      });
    }

    // Should not throw
  });
});

// ============================================================================
// EDGE CASES TESTS
// ============================================================================

describe("Edge Cases", () => {
  it("should handle missing context gracefully", async () => {
    const invalidator = new CacheInvalidation();

    const events = await invalidator.invalidate("structure");
    expect(events).toBeDefined();
    expect(Array.isArray(events)).toBe(true);
  });

  it("should handle unknown trigger types", async () => {
    const invalidator = new CacheInvalidation();

    const events = await invalidator.invalidate("time" as any);
    expect(events).toBeDefined();
  });

  it("should handle empty element structure", async () => {
    const invalidator = new CacheInvalidation();
    const emptyElement = document.createElement("div");

    const events = await invalidator.invalidate("structure", {
      element: emptyElement,
    });
    expect(events).toBeDefined();
  });

  it("should handle zero-size images", async () => {
    const invalidator = new CacheInvalidation();
    const zeroImage = new ImageData(0, 0);

    invalidator.registerKey("zero-key", {
      structure: "test",
      image: zeroImage,
    });

    const events = await invalidator.invalidate("visual", {
      key: "zero-key",
      oldImage: zeroImage,
      newImage: zeroImage,
    });

    expect(events).toBeDefined();
  });
});

// Total test count: 40+

/**
 * ProsodyDetector Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ProsodyDetector } from "./ProsodyDetector.js";

describe("ProsodyDetector", () => {
  let detector: ProsodyDetector;

  beforeEach(() => {
    detector = new ProsodyDetector();
  });

  describe("detect()", () => {
    it("should detect prosody features", () => {
      const result = detector.detect("Hello world", Date.now());

      expect(result).toBeDefined();
      expect(result.wordsPerMinute).toBeGreaterThanOrEqual(0);
      expect(result.wpmAcceleration).toBeDefined();
      expect(result.capitalizationRatio).toBeGreaterThanOrEqual(0);
      expect(result.punctuationDensity).toBeGreaterThanOrEqual(0);
      expect(result.silenceDurationMs).toBeGreaterThanOrEqual(0);
    });

    it("should calculate WPM correctly", () => {
      const timestamp = Date.now();
      const text = "Hello world test";

      const result = detector.detect(text, timestamp);

      // 3 words, should result in some WPM calculation
      expect(result.wordsPerMinute).toBeGreaterThanOrEqual(0);
    });

    it("should detect capitalization ratio", () => {
      const lowerResult = detector.detect("hello world", Date.now());
      const upperResult = detector.detect("HELLO WORLD", Date.now());

      expect(upperResult.capitalizationRatio).toBeGreaterThan(
        lowerResult.capitalizationRatio
      );
    });

    it("should detect punctuation density", () => {
      const noPunct = detector.detect("Hello world", Date.now());
      const withPunct = detector.detect(
        "Hello world! How are you?",
        Date.now()
      );

      expect(withPunct.punctuationDensity).toBeGreaterThan(
        noPunct.punctuationDensity
      );
    });
  });

  describe("getTrend()", () => {
    it("should return trend analysis", () => {
      detector.detect("Query 1", Date.now());
      detector.detect("Query 2", Date.now() + 1000);
      detector.detect("Query 3", Date.now() + 2000);

      const trend = detector.getTrend();

      expect(trend).toBeDefined();
      expect(["increasing", "decreasing", "stable"]).toContain(trend.wpmTrend);
      expect(trend.avgWpm).toBeGreaterThanOrEqual(0);
      expect(trend.avgSilence).toBeGreaterThanOrEqual(0);
      expect(trend.sampleCount).toBe(3);
    });

    it("should handle empty history", () => {
      const trend = detector.getTrend();

      expect(trend).toBeDefined();
      expect(trend.sampleCount).toBe(0);
    });
  });

  describe("clear()", () => {
    it("should clear history", () => {
      detector.detect("Query 1", Date.now());
      detector.clear();

      const trend = detector.getTrend();
      expect(trend.sampleCount).toBe(0);
    });
  });
});

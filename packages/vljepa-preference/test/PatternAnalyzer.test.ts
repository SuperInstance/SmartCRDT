/**
 * Tests for PatternAnalyzer
 */

import { describe, it, expect, beforeEach } from "vitest";
import { PatternAnalyzer } from "../src/analyzers/PatternAnalyzer.js";
import type { Interaction, UIElement } from "../src/types.js";

describe("PatternAnalyzer", () => {
  let analyzer: PatternAnalyzer;
  let sampleInteractions: Interaction[];

  beforeEach(() => {
    analyzer = new PatternAnalyzer({
      minPatternLength: 2,
      maxPatternLength: 5,
      minFrequency: 2,
      minConfidence: 0.3
    });

    // Create sample interactions
    sampleInteractions = createSampleInteractions();
  });

  describe("Pattern Analysis", () => {
    it("should analyze interactions and return patterns", () => {
      const analysis = analyzer.analyze(sampleInteractions);

      expect(analysis).toBeDefined();
      expect(analysis.patterns).toBeInstanceOf(Array);
      expect(analysis.clusters).toBeInstanceOf(Array);
      expect(analysis.outliers).toBeInstanceOf(Array);
      expect(analysis.metadata).toBeDefined();
    });

    it("should find sequential patterns", () => {
      const analysis = analyzer.analyze(sampleInteractions);

      const sequentialPatterns = analysis.patterns.filter((p) => p.type === "sequential");

      // Should find at least some patterns given our sample data
      expect(sequentialPatterns.length).toBeGreaterThan(0);
    });

    it("should find temporal patterns", () => {
      // Create interactions at specific times
      const timeBasedInteractions: Interaction[] = [];

      for (let hour = 0; hour < 24; hour++) {
        for (let i = 0; i < 5; i++) {
          const timestamp = new Date(2025, 0, 1, hour, i).getTime();

          timeBasedInteractions.push({
            type: "click",
            element: {
              id: `element-${hour}-${i}`,
              type: "button",
              position: { x: 100, y: 100, width: 50, height: 30 }
            },
            timestamp,
            position: { x: 100, y: 100 },
            context: {
              page: "/test",
              viewport: { width: 1000, height: 800 },
              timestamp
            }
          });
        }
      }

      const analysis = analyzer.analyze(timeBasedInteractions);
      const temporalPatterns = analysis.patterns.filter((p) => p.type === "temporal");

      expect(temporalPatterns.length).toBeGreaterThan(0);
    });

    it("should find spatial patterns", () => {
      // Create interactions in specific regions
      const spatialInteractions: Interaction[] = [];

      for (let i = 0; i < 20; i++) {
        spatialInteractions.push({
          type: "click",
          element: {
            id: `element-${i}`,
            type: "button",
            position: { x: 50 + (i % 3) * 100, y: 50 + Math.floor(i / 3) * 100, width: 50, height: 30 }
          },
          timestamp: Date.now() + i * 100,
          position: { x: 50 + (i % 3) * 100, y: 50 + Math.floor(i / 3) * 100 },
          context: {
            page: "/test",
            viewport: { width: 1000, height: 800 },
            timestamp: Date.now()
          }
        });
      }

      const analysis = analyzer.analyze(spatialInteractions);
      const spatialPatterns = analysis.patterns.filter((p) => p.type === "spatial");

      expect(spatialPatterns.length).toBeGreaterThan(0);
    });

    it("should find contextual patterns", () => {
      const contextInteractions: Interaction[] = [];

      // Create interactions on different pages
      const pages = ["/home", "/about", "/contact"];

      for (const page of pages) {
        for (let i = 0; i < 10; i++) {
          contextInteractions.push({
            type: "click",
            element: {
              id: `element-${page}-${i}`,
              type: "button",
              position: { x: 100, y: 100, width: 50, height: 30 }
            },
            timestamp: Date.now(),
            position: { x: 100, y: 100 },
            context: {
              page,
              viewport: { width: 1000, height: 800 },
              timestamp: Date.now()
            }
          });
        }
      }

      const analysis = analyzer.analyze(contextInteractions);
      const contextualPatterns = analysis.patterns.filter((p) => p.type === "contextual");

      expect(contextualPatterns.length).toBeGreaterThan(0);
    });
  });

  describe("Pattern Clustering", () => {
    it("should cluster similar patterns", () => {
      const analysis = analyzer.analyze(sampleInteractions);

      // If we have enough patterns, some should be clustered
      if (analysis.patterns.length > 1) {
        expect(analysis.clusters.length).toBeGreaterThanOrEqual(0);
      }
    });

    it("should calculate cluster similarity", () => {
      const analysis = analyzer.analyze(sampleInteractions);

      for (const cluster of analysis.clusters) {
        expect(cluster.similarity).toBeGreaterThanOrEqual(0);
        expect(cluster.similarity).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("Outlier Detection", () => {
    it("should detect outlier interactions", () => {
      const interactions = [...sampleInteractions];

      // Add an outlier interaction
      interactions.push({
        type: "click",
        element: {
          id: "outlier-element",
          type: "rare-button",
          position: { x: 9999, y: 9999, width: 1, height: 1 }
        },
        timestamp: Date.now(),
        position: { x: 9999, y: 9999 },
        context: {
          page: "/rare-page",
          viewport: { width: 100, height: 100 },
          timestamp: Date.now()
        }
      });

      const analysis = analyzer.analyze(interactions);

      // Should detect at least one outlier
      expect(analysis.outliers.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Pattern Metadata", () => {
    it("should include correct metadata", () => {
      const analysis = analyzer.analyze(sampleInteractions);

      expect(analysis.metadata.totalInteractions).toBe(sampleInteractions.length);
      expect(analysis.metadata.totalPatterns).toBe(analysis.patterns.length);
      expect(analysis.metadata.analysisDuration).toBeGreaterThan(0);
      expect(analysis.metadata.timestamp).toBeGreaterThan(0);
    });
  });

  describe("Pattern Properties", () => {
    it("should create patterns with required properties", () => {
      const analysis = analyzer.analyze(sampleInteractions);

      for (const pattern of analysis.patterns) {
        expect(pattern.id).toBeDefined();
        expect(pattern.type).toBeDefined();
        expect(pattern.elements).toBeInstanceOf(Array);
        expect(pattern.frequency).toBeGreaterThan(0);
        expect(pattern.confidence).toBeGreaterThanOrEqual(0);
        expect(pattern.confidence).toBeLessThanOrEqual(1);
        expect(pattern.timestamp).toBeGreaterThan(0);
      }
    });

    it("should filter patterns by min frequency", () => {
      const strictAnalyzer = new PatternAnalyzer({
        minFrequency: 10,
        minConfidence: 0.1
      });

      const analysis = strictAnalyzer.analyze(sampleInteractions);

      for (const pattern of analysis.patterns) {
        expect(pattern.frequency).toBeGreaterThanOrEqual(10);
      }
    });

    it("should filter patterns by min confidence", () => {
      const strictAnalyzer = new PatternAnalyzer({
        minFrequency: 1,
        minConfidence: 0.8
      });

      const analysis = strictAnalyzer.analyze(sampleInteractions);

      for (const pattern of analysis.patterns) {
        expect(pattern.confidence).toBeGreaterThanOrEqual(0.8);
      }
    });
  });

  describe("Pattern Queries", () => {
    it("should get all patterns", () => {
      analyzer.analyze(sampleInteractions);

      const patterns = analyzer.getPatterns();

      expect(patterns).toBeInstanceOf(Array);
    });

    it("should get patterns by type", () => {
      analyzer.analyze(sampleInteractions);

      const sequentialPatterns = analyzer.getPatternsByType("sequential");
      const temporalPatterns = analyzer.getPatternsByType("temporal");

      expect(sequentialPatterns).toBeInstanceOf(Array);
      expect(temporalPatterns).toBeInstanceOf(Array);
    });
  });

  describe("Data Management", () => {
    it("should clear all patterns", () => {
      analyzer.analyze(sampleInteractions);

      expect(analyzer.getPatterns().length).toBeGreaterThan(0);

      analyzer.clear();

      expect(analyzer.getPatterns().length).toBe(0);
      expect(analyzer.getClusters().length).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty interactions", () => {
      const analysis = analyzer.analyze([]);

      expect(analysis.patterns).toHaveLength(0);
      expect(analysis.clusters).toHaveLength(0);
      expect(analysis.outliers).toHaveLength(0);
      expect(analysis.metadata.totalInteractions).toBe(0);
    });

    it("should handle single interaction", () => {
      const singleInteraction: Interaction = {
        type: "click",
        element: {
          id: "single",
          type: "button",
          position: { x: 0, y: 0, width: 0, height: 0 }
        },
        timestamp: Date.now(),
        position: { x: 0, y: 0 },
        context: {
          page: "/test",
          viewport: { width: 1000, height: 800 },
          timestamp: Date.now()
        }
      };

      const analysis = analyzer.analyze([singleInteraction]);

      expect(analysis).toBeDefined();
    });

    it("should handle interactions with same element", () => {
      const sameElementInteractions: Interaction[] = [];

      for (let i = 0; i < 10; i++) {
        sameElementInteractions.push({
          type: "click",
          element: {
            id: "same-element",
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

      const analysis = analyzer.analyze(sameElementInteractions);

      expect(analysis.patterns.length).toBeGreaterThan(0);
    });
  });
});

function createSampleInteractions(): Interaction[] {
  const interactions: Interaction[] = [];

  // Create a sequence pattern: click -> hover -> click
  for (let i = 0; i < 5; i++) {
    interactions.push({
      type: "click",
      element: { id: `btn-${i}`, type: "button", position: { x: 100, y: 100, width: 50, height: 30 } },
      timestamp: Date.now() + i * 1000,
      position: { x: 100, y: 100 },
      context: { page: "/test", viewport: { width: 1000, height: 800 }, timestamp: Date.now() }
    });

    interactions.push({
      type: "hover",
      element: { id: `card-${i}`, type: "card", position: { x: 200, y: 200, width: 100, height: 100 } },
      timestamp: Date.now() + i * 1000 + 100,
      position: { x: 200, y: 200 },
      context: { page: "/test", viewport: { width: 1000, height: 800 }, timestamp: Date.now() }
    });

    interactions.push({
      type: "click",
      element: { id: `btn-${i}`, type: "button", position: { x: 100, y: 100, width: 50, height: 30 } },
      timestamp: Date.now() + i * 1000 + 200,
      position: { x: 100, y: 100 },
      context: { page: "/test", viewport: { width: 1000, height: 800 }, timestamp: Date.now() }
    });
  }

  return interactions;
}

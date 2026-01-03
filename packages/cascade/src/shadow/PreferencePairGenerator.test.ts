/**
 * @lsi/cascade - Preference Pair Generator Tests
 */

import { describe, it, expect } from "vitest";
import {
  PreferencePairGenerator,
  PreferencePair,
  ScoringConfig,
} from "./PreferencePairGenerator.js";
import { ShadowLogEntry } from "./ShadowLogger.js";

describe("PreferencePairGenerator", () => {
  describe("Constructor", () => {
    it("should use default config when no config provided", () => {
      const generator = new PreferencePairGenerator();
      expect(generator).toBeDefined();
    });

    it("should merge provided config with defaults", () => {
      const generator = new PreferencePairGenerator({
        qualityWeight: 2.0,
        minScoreDifference: 0.2,
      });
      expect(generator).toBeDefined();
    });
  });

  describe("Query Normalization", () => {
    it("should convert to lowercase", () => {
      const logs = createMockLogs([
        {
          query: "WHAT IS AI",
          response: "AI is artificial intelligence",
          latency: 100,
          cost: 0.001,
        },
        {
          query: "what is ai",
          response: "ai is artificial intelligence",
          latency: 5000,
          cost: 0.01,
        },
      ]);

      const generator = new PreferencePairGenerator();
      const pairs = generator.generateFromLogs(logs);

      // Should group these as same query
      expect(pairs.length).toBe(1);
    });

    it("should remove punctuation", () => {
      const logs = createMockLogs([
        {
          query: "What is AI?",
          response: "AI is artificial intelligence",
          latency: 100,
          cost: 0.001,
        },
        {
          query: "What is AI",
          response: "Different response",
          latency: 5000,
          cost: 0.01,
        },
      ]);

      const generator = new PreferencePairGenerator();
      const pairs = generator.generateFromLogs(logs);

      // Should group these as same query
      expect(pairs.length).toBe(1);
    });

    it("should normalize whitespace", () => {
      const logs = createMockLogs([
        {
          query: "What  is   AI",
          response: "AI is artificial intelligence",
          latency: 100,
          cost: 0.001,
        },
        {
          query: "What is AI",
          response: "Different response",
          latency: 5000,
          cost: 0.01,
        },
      ]);

      const generator = new PreferencePairGenerator();
      const pairs = generator.generateFromLogs(logs);

      // Should group these as same query
      expect(pairs.length).toBe(1);
    });

    it("should remove common stopwords", () => {
      const logs = createMockLogs([
        {
          query: "What is the capital of France",
          response: "Paris",
          latency: 100,
          cost: 0.001,
        },
        {
          query: "capital France",
          response: "Paris is the capital",
          latency: 5000,
          cost: 0.01,
        },
      ]);

      const generator = new PreferencePairGenerator();
      const pairs = generator.generateFromLogs(logs);

      // Should group these as same query (stopwords removed)
      expect(pairs.length).toBe(1);
    });
  });

  describe("Pair Generation", () => {
    it("should generate no pairs with single response per query", () => {
      const logs = createMockLogs([
        { query: "What is AI?", response: "AI is artificial intelligence" },
        { query: "What is ML?", response: "ML is machine learning" },
      ]);

      const generator = new PreferencePairGenerator();
      const pairs = generator.generateFromLogs(logs);

      expect(pairs.length).toBe(0);
    });

    it("should generate pair when two responses for same query", () => {
      const logs = createMockLogs([
        {
          query: "What is AI?",
          response: "Good response",
          latency: 100,
          cost: 0.001,
        },
        {
          query: "What is AI?",
          response: "Bad response",
          latency: 5000,
          cost: 0.01,
        },
      ]);

      const generator = new PreferencePairGenerator();
      const pairs = generator.generateFromLogs(logs);

      expect(pairs.length).toBe(1);
      expect(pairs[0].chosen).toBe("Good response");
      expect(pairs[0].rejected).toBe("Bad response");
    });

    it("should generate multiple pairs for multiple responses", () => {
      const logs = createMockLogs([
        { query: "What is AI?", response: "Best", latency: 50, cost: 0.001 },
        { query: "What is AI?", response: "Medium", latency: 500, cost: 0.005 },
        { query: "What is AI?", response: "Worst", latency: 5000, cost: 0.01 },
      ]);

      const generator = new PreferencePairGenerator({
        minScoreDifference: 0.01,
      });
      const pairs = generator.generateFromLogs(logs);

      // Should generate up to 3 pairs (best vs worst, best vs second best)
      expect(pairs.length).toBeGreaterThan(0);
      expect(pairs.length).toBeLessThanOrEqual(2);
    });

    it("should respect max 3 pairs per query", () => {
      const logs: ShadowLogEntry[] = [];
      for (let i = 0; i < 10; i++) {
        logs.push(
          createMockLog({
            query: "What is AI?",
            response: `Response ${i}`,
            latency: 100 + i * 1000,
            cost: 0.001 + i * 0.001,
          })
        );
      }

      const generator = new PreferencePairGenerator({
        minScoreDifference: 0.01,
      });
      const pairs = generator.generateFromLogs(logs);

      // Should generate at most 3 pairs per query
      expect(pairs.length).toBeLessThanOrEqual(3);
    });

    it("should enforce minimum score difference", () => {
      const logs = createMockLogs([
        {
          query: "What is AI?",
          response: "Similar 1",
          latency: 100,
          cost: 0.001,
        },
        {
          query: "What is AI?",
          response: "Similar 2",
          latency: 105,
          cost: 0.0011,
        },
      ]);

      const generator = new PreferencePairGenerator({
        minScoreDifference: 0.5,
      });
      const pairs = generator.generateFromLogs(logs);

      // Scores too similar, should not generate pair
      expect(pairs.length).toBe(0);
    });
  });

  describe("Scoring Algorithm", () => {
    it("should prefer lower latency", () => {
      const logs = createMockLogs([
        { query: "What is AI?", response: "Fast", latency: 50, cost: 0.001 },
        { query: "What is AI?", response: "Slow", latency: 5000, cost: 0.001 },
      ]);

      const generator = new PreferencePairGenerator();
      const pairs = generator.generateFromLogs(logs);

      expect(pairs[0].chosen).toBe("Fast");
      expect(pairs[0].rejected).toBe("Slow");
    });

    it("should prefer lower cost", () => {
      const logs = createMockLogs([
        { query: "What is AI?", response: "Cheap", latency: 100, cost: 0.001 },
        {
          query: "What is AI?",
          response: "Expensive",
          latency: 100,
          cost: 0.02,
        },
      ]);

      const generator = new PreferencePairGenerator({
        minScoreDifference: 0.001,
      });
      const pairs = generator.generateFromLogs(logs);

      expect(pairs.length).toBeGreaterThan(0);
      expect(pairs[0].chosen).toBe("Cheap");
      expect(pairs[0].rejected).toBe("Expensive");
    });

    it("should give bonus for cached responses", () => {
      const logs = createMockLogs([
        {
          query: "What is AI?",
          response: "Cached",
          latency: 10,
          cost: 0.0001,
          fromCache: true,
        },
        {
          query: "What is AI?",
          response: "Not Cached",
          latency: 10,
          cost: 0.0001,
          fromCache: false,
        },
      ]);

      const generator = new PreferencePairGenerator({
        cacheBonusWeight: 0.1,
        minScoreDifference: 0.001,
      });
      const pairs = generator.generateFromLogs(logs);

      expect(pairs.length).toBeGreaterThan(0);
      expect(pairs[0].chosen).toBe("Cached");
      expect(pairs[0].rejected).toBe("Not Cached");
    });

    it("should score cloud responses higher for quality", () => {
      const logs = createMockLogs([
        {
          query: "What is AI?",
          response: "Cloud",
          latency: 1000,
          cost: 0.01,
          backend: "cloud",
        },
        {
          query: "What is AI?",
          response: "Local",
          latency: 1000,
          cost: 0.01,
          backend: "local",
        },
      ]);

      const generator = new PreferencePairGenerator({
        minScoreDifference: 0.001,
      });
      const pairs = generator.generateFromLogs(logs);

      // Cloud should be preferred when latency/cost are equal
      expect(pairs.length).toBeGreaterThan(0);
      expect(pairs[0].chosen).toBe("Cloud");
    });

    it("should handle custom scoring weights", () => {
      const logs = createMockLogs([
        {
          query: "What is AI?",
          response: "Fast but expensive",
          latency: 10,
          cost: 1.0,
        },
        {
          query: "What is AI?",
          response: "Slow but cheap",
          latency: 10000,
          cost: 0.0001,
        },
      ]);

      // High cost weight should prefer cheap
      const generator = new PreferencePairGenerator({ costWeight: 10.0 });
      const pairs = generator.generateFromLogs(logs);

      expect(pairs[0].chosen).toBe("Slow but cheap");
    });
  });

  describe("Filters", () => {
    it("should filter by quality threshold", () => {
      const pairs = createMockPairs([
        { chosenQuality: 0.8, rejectedQuality: 0.3 },
        { chosenQuality: 0.4, rejectedQuality: 0.2 }, // Should be filtered
      ]);

      const generator = new PreferencePairGenerator();
      const filtered = generator.filterByQuality(pairs, 0.5);

      expect(filtered.length).toBe(1);
      expect(filtered[0].chosenMetadata.quality).toBe(0.8);
    });

    it("should filter by cost difference", () => {
      const pairs = createMockPairs([
        { chosenCost: 0.001, rejectedCost: 0.01 }, // Diff 0.009
        { chosenCost: 0.001, rejectedCost: 0.002 }, // Diff 0.001 (filtered)
      ]);

      const generator = new PreferencePairGenerator();
      const filtered = generator.filterByCostDifference(pairs, 0.005);

      expect(filtered.length).toBe(1);
    });
  });

  describe("Backend Balancing", () => {
    it("should balance local and cloud pairs", () => {
      const pairs = createMockPairs([
        { chosenBackend: "local" as const },
        { chosenBackend: "local" as const },
        { chosenBackend: "local" as const },
        { chosenBackend: "cloud" as const },
        { chosenBackend: "cloud" as const },
      ]);

      const generator = new PreferencePairGenerator();
      const balanced = generator.balanceByBackend(pairs);

      // Should have 2 local + 2 cloud (min of each)
      const localCount = balanced.filter(
        p => p.chosenMetadata.backend === "local"
      ).length;
      const cloudCount = balanced.filter(
        p => p.chosenMetadata.backend === "cloud"
      ).length;

      expect(localCount).toBe(2);
      expect(cloudCount).toBe(2);
    });

    it("should handle all local pairs", () => {
      const pairs = createMockPairs([
        { chosenBackend: "local" as const },
        { chosenBackend: "local" as const },
        { chosenBackend: "local" as const },
      ]);

      const generator = new PreferencePairGenerator();
      const balanced = generator.balanceByBackend(pairs);

      // Should return all local pairs
      expect(balanced.length).toBe(3);
    });

    it("should handle all cloud pairs", () => {
      const pairs = createMockPairs([
        { chosenBackend: "cloud" as const },
        { chosenBackend: "cloud" as const },
        { chosenBackend: "cloud" as const },
      ]);

      const generator = new PreferencePairGenerator();
      const balanced = generator.balanceByBackend(pairs);

      // Should return all cloud pairs
      expect(balanced.length).toBe(3);
    });
  });

  describe("Statistics", () => {
    it("should calculate statistics for pairs", () => {
      const pairs = createMockPairs([
        {
          chosenQuality: 0.8,
          rejectedQuality: 0.4,
          chosenScore: 0.8,
          rejectedScore: 0.4,
          chosenBackend: "local" as const,
        },
        {
          chosenQuality: 0.7,
          rejectedQuality: 0.3,
          chosenScore: 0.7,
          rejectedScore: 0.3,
          chosenBackend: "cloud" as const,
        },
      ]);

      const generator = new PreferencePairGenerator();
      const stats = generator.calculateStats(pairs);

      expect(stats.total).toBe(2);
      expect(stats.avgChosenQuality).toBeCloseTo(0.75);
      expect(stats.avgRejectedQuality).toBeCloseTo(0.35);
      expect(stats.avgScoreDifference).toBeCloseTo(0.4);
      expect(stats.backendDistribution.local).toBe(1);
      expect(stats.backendDistribution.cloud).toBe(1);
    });

    it("should return zeros for empty pairs", () => {
      const generator = new PreferencePairGenerator();
      const stats = generator.calculateStats([]);

      expect(stats.total).toBe(0);
      expect(stats.avgChosenQuality).toBe(0);
      expect(stats.avgRejectedQuality).toBe(0);
      expect(stats.avgScoreDifference).toBe(0);
      expect(stats.backendDistribution.local).toBe(0);
      expect(stats.backendDistribution.cloud).toBe(0);
    });
  });

  describe("Export Formats", () => {
    it("should export in ORPO format (JSONL)", () => {
      const pairs = createMockPairs([
        { query: "What is AI?", chosen: "Good", rejected: "Bad" },
      ]);

      const generator = new PreferencePairGenerator();
      const exported = generator.exportForORPO(pairs);

      const lines = exported.split("\n");
      expect(lines.length).toBe(1);

      const parsed = JSON.parse(lines[0]);
      expect(parsed).toHaveProperty("prompt");
      expect(parsed).toHaveProperty("chosen");
      expect(parsed).toHaveProperty("rejected");
      expect(parsed.prompt).toBe("What is AI?");
      expect(parsed.chosen).toBe("Good");
      expect(parsed.rejected).toBe("Bad");
    });

    it("should export with metadata", () => {
      const pairs = createMockPairs([
        { query: "What is AI?", chosen: "Good", rejected: "Bad" },
      ]);

      const generator = new PreferencePairGenerator();
      const exported = generator.exportWithMetadata(pairs);

      const lines = exported.split("\n");
      expect(lines.length).toBe(1);

      const parsed = JSON.parse(lines[0]);
      expect(parsed).toHaveProperty("query");
      expect(parsed).toHaveProperty("chosen");
      expect(parsed).toHaveProperty("rejected");
      expect(parsed).toHaveProperty("chosenMetadata");
      expect(parsed).toHaveProperty("rejectedMetadata");
      expect(parsed).toHaveProperty("reason");
    });

    it("should handle multiple pairs in export", () => {
      const pairs = createMockPairs([
        { query: "Q1", chosen: "A1", rejected: "B1" },
        { query: "Q2", chosen: "A2", rejected: "B2" },
      ]);

      const generator = new PreferencePairGenerator();
      const exported = generator.exportForORPO(pairs);

      const lines = exported.split("\n");
      expect(lines.length).toBe(2);

      const parsed1 = JSON.parse(lines[0]);
      const parsed2 = JSON.parse(lines[1]);

      expect(parsed1.prompt).toBe("Q1");
      expect(parsed2.prompt).toBe("Q2");
    });
  });

  describe("Reason Generation", () => {
    it("should generate reason for quality difference", () => {
      const logs = createMockLogs([
        {
          query: "What is AI?",
          response: "High quality",
          latency: 100,
          cost: 0.001,
        },
        {
          query: "What is AI?",
          response: "Low quality",
          latency: 5000,
          cost: 0.01,
        },
      ]);

      const generator = new PreferencePairGenerator();
      const pairs = generator.generateFromLogs(logs);
      const exported = generator.exportWithMetadata(pairs);
      const parsed = JSON.parse(exported.split("\n")[0]);

      // Reason should mention quality (fast vs slow)
      expect(parsed.reason.length).toBeGreaterThan(0);
    });

    it("should generate reason for cost difference", () => {
      const logs = createMockLogs([
        { query: "What is AI?", response: "Cheap", latency: 1000, cost: 0.001 },
        {
          query: "What is AI?",
          response: "Expensive",
          latency: 1000,
          cost: 0.02,
        },
      ]);

      const generator = new PreferencePairGenerator({
        minScoreDifference: 0.001,
      });
      const pairs = generator.generateFromLogs(logs);
      const exported = generator.exportWithMetadata(pairs);
      const parsed = JSON.parse(exported.split("\n")[0]);

      // Reason should mention cost
      expect(parsed.reason.length).toBeGreaterThan(0);
    });
  });
});

// Helper functions

function createMockLog(config: {
  query: string;
  response: string;
  latency?: number;
  cost?: number;
  fromCache?: boolean;
  backend?: "local" | "cloud";
}): ShadowLogEntry {
  return {
    id: `test_${Date.now()}_${Math.random()}`,
    query: config.query,
    response: config.response,
    model: "test-model",
    timestamp: Date.now(),
    sensitivity: "PUBLIC" as const,
    piiRedacted: false,
    backend: config.backend ?? "local",
    metadata: {
      latency: config.latency ?? 100,
      cost: config.cost ?? 0.001,
      fromCache: config.fromCache ?? false,
    },
  };
}

function createMockLogs(
  configs: Array<{
    query: string;
    response: string;
    latency?: number;
    cost?: number;
    fromCache?: boolean;
    backend?: "local" | "cloud";
  }>
): ShadowLogEntry[] {
  return configs.map(c => createMockLog(c));
}

function createMockPair(config: {
  query?: string;
  chosen?: string;
  rejected?: string;
  chosenQuality?: number;
  rejectedQuality?: number;
  chosenCost?: number;
  rejectedCost?: number;
  chosenScore?: number;
  rejectedScore?: number;
  chosenBackend?: "local" | "cloud";
}): PreferencePair {
  return {
    query: config.query ?? "Test query",
    chosen: config.chosen ?? "Chosen response",
    rejected: config.rejected ?? "Rejected response",
    chosenMetadata: {
      model: "test-model",
      cost: config.chosenCost ?? 0.001,
      latency: 100,
      quality: config.chosenQuality ?? 0.8,
      backend: config.chosenBackend ?? "local",
      score: config.chosenScore ?? 0.8,
    },
    rejectedMetadata: {
      model: "test-model",
      cost: config.rejectedCost ?? 0.01,
      latency: 1000,
      quality: config.rejectedQuality ?? 0.4,
      backend: "local",
      score: config.rejectedScore ?? 0.4,
    },
    reason: "Test reason",
  };
}

function createMockPairs(
  configs: Array<{
    query?: string;
    chosen?: string;
    rejected?: string;
    chosenQuality?: number;
    rejectedQuality?: number;
    chosenCost?: number;
    rejectedCost?: number;
    chosenScore?: number;
    rejectedScore?: number;
    chosenBackend?: "local" | "cloud";
  }>
): PreferencePair[] {
  return configs.map(c => createMockPair(c));
}

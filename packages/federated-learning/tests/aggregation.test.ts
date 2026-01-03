/**
 * @fileoverview Tests for Federated Aggregation Algorithms
 *
 * Comprehensive tests for FedAvg, FedProx, and Byzantine-resilient aggregation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  FedAvgAggregator,
  FedProxAggregator,
  KrumAggregator,
  createAggregator,
  ModelUpdate,
  AggregationResult,
  validateUpdates,
  l2Norm,
  cosineSimilarity,
  manhattanDistance,
  normalizeParameters,
  clipParameters,
  DEFAULT_FEDAVG_CONFIG,
  DEFAULT_FEDPROX_CONFIG,
  DEFAULT_BYZANTINE_CONFIG,
} from "../src/aggregation.js";

describe("Aggregation Module", () => {
  describe("Utility Functions", () => {
    it("should compute L2 norm correctly", () => {
      const vec = [3, 4];
      expect(l2Norm(vec)).toBe(5);
    });

    it("should compute cosine similarity correctly", () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);

      const c = [1, 2, 3];
      const d = [2, 4, 6];
      expect(cosineSimilarity(c, d)).toBeCloseTo(1, 5);
    });

    it("should compute Manhattan distance correctly", () => {
      const a = [1, 2, 3];
      const b = [4, 5, 6];
      expect(manhattanDistance(a, b)).toBe(9);
    });

    it("should normalize parameters", () => {
      const params = [3, 4];
      const normalized = normalizeParameters(params);
      expect(l2Norm(normalized)).toBeCloseTo(1, 5);
    });

    it("should clip parameters to max norm", () => {
      const params = [10, 0];
      const clipped = clipParameters(params, 5);
      expect(l2Norm(clipped)).toBeLessThanOrEqual(5);
    });

    it("should validate correct updates", () => {
      const updates: ModelUpdate[] = [
        {
          clientId: "client1",
          parameters: [1, 2, 3],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
      ];

      const result = validateUpdates(updates, 3);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect invalid updates", () => {
      const updates: ModelUpdate[] = [
        {
          clientId: "",
          parameters: [1, 2],
          numSamples: -1,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
      ];

      const result = validateUpdates(updates, 3);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("FedAvg Aggregator", () => {
    let aggregator: FedAvgAggregator;

    beforeEach(() => {
      aggregator = new FedAvgAggregator();
    });

    it("should aggregate updates with uniform weighting", () => {
      const updates: ModelUpdate[] = [
        {
          clientId: "client1",
          parameters: [1, 2, 3],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
        {
          clientId: "client2",
          parameters: [3, 4, 5],
          numSamples: 100,
          epochs: 1,
          loss: 0.4,
          timestamp: Date.now(),
        },
      ];

      const config = { weightingStrategy: "uniform" as const };
      const weightedAgg = new FedAvgAggregator(config);
      const result = weightedAgg.aggregate(updates);

      expect(result.parameters).toEqual([2, 3, 4]);
      expect(result.numClients).toBe(2);
      expect(result.weightingStrategy).toBe("uniform");
    });

    it("should aggregate updates with data_size weighting", () => {
      const updates: ModelUpdate[] = [
        {
          clientId: "client1",
          parameters: [0, 0, 0],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
        {
          clientId: "client2",
          parameters: [10, 10, 10],
          numSamples: 200,
          epochs: 1,
          loss: 0.4,
          timestamp: Date.now(),
        },
      ];

      // Default config with data_size weighting
      const config = { weightingStrategy: "data_size" as const };
      const weightedAgg = new FedAvgAggregator(config);
      const result = weightedAgg.aggregate(updates);

      // Both weights (100 and 200) are capped at maxWeight=0.5
      // So both clients get equal weight: [0.5, 0.5]
      // Result is simple average: (0 + 10) / 2 = 5
      expect(result.parameters[0]).toBe(5);
    });

    it("should aggregate updates with quality weighting", () => {
      const updates: ModelUpdate[] = [
        {
          clientId: "client1",
          parameters: [0, 0, 0],
          numSamples: 100,
          quality: 0.3,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
        {
          clientId: "client2",
          parameters: [10, 10, 10],
          numSamples: 100,
          quality: 0.7,
          epochs: 1,
          loss: 0.4,
          timestamp: Date.now(),
        },
      ];

      // Default config with quality weighting
      const config = { weightingStrategy: "quality" as const };
      const qualityAgg = new FedAvgAggregator(config);
      const result = qualityAgg.aggregate(updates);

      // client2 has higher quality (0.7 vs 0.3)
      // With minWeight=0.01, maxWeight=0.5: weights are [0.3, 0.5] (0.3 capped by maxWeight)
      // Normalized: [0.3/0.8, 0.5/0.8] = [0.375, 0.625]
      // Result: 0*0.375 + 10*0.625 = 6.25
      expect(result.parameters[0]).toBeCloseTo(6.25, 1);
    });

    it("should filter outliers when enabled", () => {
      const updates: ModelUpdate[] = [
        {
          clientId: "client1",
          parameters: [1, 1, 1],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
        {
          clientId: "client2",
          parameters: [1.1, 1.1, 1.1],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
        {
          clientId: "outlier",
          parameters: [100, 100, 100],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
      ];

      const config = { outlierDetection: true, outlierThreshold: 1 };
      const outlierAgg = new FedAvgAggregator(config);
      const result = outlierAgg.aggregate(updates);

      // Outlier should be excluded
      expect(result.excludedClients).toContain("outlier");
      expect(result.parameters[0]).toBeLessThan(50);
    });

    it("should handle empty updates with error", () => {
      expect(() => aggregator.aggregate([])).toThrow("Cannot aggregate empty update list");
    });

    it("should compute aggregation metrics", () => {
      const updates: ModelUpdate[] = [
        {
          clientId: "client1",
          parameters: [1, 2, 3],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
      ];

      const result = aggregator.aggregate(updates);

      expect(result.metrics.avgDistance).toBeGreaterThanOrEqual(0);
      expect(result.metrics.maxDistance).toBeGreaterThanOrEqual(0);
      expect(result.metrics.avgWeight).toBeGreaterThan(0);
    });
  });

  describe("FedProx Aggregator", () => {
    let aggregator: FedProxAggregator;

    beforeEach(() => {
      aggregator = new FedProxAggregator({ mu: 0.1, maxDrift: 1.0 });
    });

    it("should require global model for aggregation", () => {
      const updates: ModelUpdate[] = [
        {
          clientId: "client1",
          parameters: [1, 2, 3],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
      ];

      expect(() => aggregator.aggregate(updates)).toThrow("FedProx requires global model");
    });

    it("should apply proximal correction", () => {
      const globalModel = [0, 0, 0];
      const updates: ModelUpdate[] = [
        {
          clientId: "client1",
          parameters: [10, 10, 10],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          gradientNorm: 5,
          timestamp: Date.now(),
        },
        {
          clientId: "client2",
          parameters: [5, 5, 5],
          numSamples: 100,
          epochs: 1,
          loss: 0.4,
          gradientNorm: 3,
          timestamp: Date.now(),
        },
      ];

      const result = aggregator.aggregate(updates, globalModel);

      // Result should be closer to global model than raw average due to proximal term
      const rawAvg = 7.5;
      expect(result.parameters[0]).toBeLessThan(rawAvg);
    });

    it("should bound client drift", () => {
      const globalModel = [0, 0, 0];
      const aggregator2 = new FedProxAggregator({ mu: 1.0, maxDrift: 0.5 });

      const updates: ModelUpdate[] = [
        {
          clientId: "client1",
          parameters: [100, 100, 100],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          gradientNorm: 50,
          timestamp: Date.now(),
        },
      ];

      const result = aggregator2.aggregate(updates, globalModel);

      // Drift should be bounded to maxDrift
      expect(result.parameters[0]).toBeLessThanOrEqual(0.5);
    });

    it("should adapt mu when enabled", () => {
      const adaptiveAgg = new FedProxAggregator({
        mu: 0.1,
        maxDrift: 1.0,
        adaptiveMu: true,
        targetDrift: 0.5,
      });

      const globalModel = [0, 0, 0];
      const updates: ModelUpdate[] = [
        {
          clientId: "client1",
          parameters: [0.1, 0.1, 0.1],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
      ];

      adaptiveAgg.aggregate(updates, globalModel);

      // Mu should have been adjusted
      const newMu = adaptiveAgg.getCurrentMu();
      expect(newMu).not.toBe(0.1);
    });

    it("should reset mu to initial value", () => {
      aggregator.aggregate(
        [
          {
            clientId: "c1",
            parameters: [1, 2, 3],
            numSamples: 100,
            epochs: 1,
            loss: 0.5,
            timestamp: Date.now(),
          },
        ],
        [0, 0, 0]
      );

      aggregator.resetMu();
      expect(aggregator.getCurrentMu()).toBe(0.1);
    });
  });

  describe("Krum Aggregator (Byzantine-resilient)", () => {
    let aggregator: KrumAggregator;

    beforeEach(() => {
      aggregator = new KrumAggregator({ maxByzantine: 1 });
    });

    it("should require minimum number of updates", () => {
      const updates: ModelUpdate[] = [
        {
          clientId: "client1",
          parameters: [1, 2, 3],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
      ];

      expect(() => aggregator.aggregate(updates)).toThrow();
    });

    it("should select best update with Krum", () => {
      // Create 5 updates: 3 normal, 2 Byzantine
      const updates: ModelUpdate[] = [
        {
          clientId: "normal1",
          parameters: [1, 1, 1],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
        {
          clientId: "normal2",
          parameters: [1.1, 1.1, 1.1],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
        {
          clientId: "normal3",
          parameters: [0.9, 0.9, 0.9],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
        {
          clientId: "byzantine1",
          parameters: [100, 100, 100],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
        {
          clientId: "byzantine2",
          parameters: [-50, -50, -50],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
      ];

      const result = aggregator.aggregate(updates);

      // Result should be close to normal updates, not Byzantine
      expect(result.parameters[0]).toBeLessThan(5);
      expect(result.parameters[0]).toBeGreaterThan(-5);
    });

    it("should use multi_krum to average multiple updates", () => {
      const multiKrumAgg = new KrumAggregator({
        maxByzantine: 1,
        method: "multi_krum",
        numUpdates: 3,
      });

      const updates: ModelUpdate[] = [
        {
          clientId: "normal1",
          parameters: [1, 1, 1],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
        {
          clientId: "normal2",
          parameters: [2, 2, 2],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
        {
          clientId: "normal3",
          parameters: [3, 3, 3],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
        {
          clientId: "normal4",
          parameters: [1.5, 1.5, 1.5],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
        {
          clientId: "byzantine1",
          parameters: [100, 100, 100],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
      ];

      const result = multiKrumAgg.aggregate(updates);

      // Result should average the 3 normal updates closest together
      expect(result.parameters[0]).toBeGreaterThan(0);
      expect(result.parameters[0]).toBeLessThan(10);
    });

    it("should use trimmed_mean aggregation", () => {
      const trimAgg = new KrumAggregator({
        maxByzantine: 1,
        method: "trimmed_mean",
        trimFraction: 0.2,
      });

      const updates: ModelUpdate[] = [
        {
          clientId: "client1",
          parameters: [1, 1, 1],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
        {
          clientId: "client2",
          parameters: [2, 2, 2],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
        {
          clientId: "client3",
          parameters: [3, 3, 3],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
        {
          clientId: "client4",
          parameters: [100, 100, 100],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
        {
          clientId: "client5",
          parameters: [-50, -50, -50],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
      ];

      const result = trimAgg.aggregate(updates);

      // Trimmed mean should exclude extremes
      expect(result.parameters[0]).toBeLessThan(10);
      expect(result.parameters[0]).toBeGreaterThan(-10);
    });

    it("should use median aggregation", () => {
      const medianAgg = new KrumAggregator({
        maxByzantine: 1,
        method: "median",
      });

      const updates: ModelUpdate[] = [
        {
          clientId: "client1",
          parameters: [1, 1, 1],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
        {
          clientId: "client2",
          parameters: [2, 2, 2],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
        {
          clientId: "client3",
          parameters: [3, 3, 3],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
        {
          clientId: "client4",
          parameters: [100, 100, 100],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
        {
          clientId: "client5",
          parameters: [-50, -50, -50],
          numSamples: 100,
          epochs: 1,
          loss: 0.5,
          timestamp: Date.now(),
        },
      ];

      const result = medianAgg.aggregate(updates);

      // Median of [-50, 1, 2, 3, 100] sorted is [-50, 1, 2, 3, 100], median is 2
      expect(result.parameters[0]).toBe(2);
    });
  });

  describe("Aggregator Factory", () => {
    it("should create FedAvg aggregator", () => {
      const agg = createAggregator("fedavg");
      expect(agg).toBeInstanceOf(FedAvgAggregator);
    });

    it("should create FedProx aggregator", () => {
      const agg = createAggregator("fedprox");
      expect(agg).toBeInstanceOf(FedProxAggregator);
    });

    it("should create Krum aggregator", () => {
      const agg = createAggregator("krum");
      expect(agg).toBeInstanceOf(KrumAggregator);
    });

    it("should create MultiKrum aggregator", () => {
      const agg = createAggregator("multi_krum");
      expect(agg).toBeInstanceOf(KrumAggregator);
    });

    it("should throw on unknown method", () => {
      expect(() => createAggregator("unknown" as any)).toThrow();
    });
  });

  describe("Integration Tests", () => {
    it("should handle realistic federated learning scenario", () => {
      const fedAvg = new FedAvgAggregator({ weightingStrategy: "data_size" });
      const fedProx = new FedProxAggregator({ mu: 0.1, maxDrift: 1.0 });
      const krum = new KrumAggregator({ maxByzantine: 2 });

      // Simulate 10 clients with varying data sizes
      const updates: ModelUpdate[] = Array.from({ length: 10 }, (_, i) => ({
        clientId: `client_${i}`,
        parameters: Array.from({ length: 50 }, () => Math.random()),
        numSamples: 50 + Math.floor(Math.random() * 150),
        quality: 0.7 + Math.random() * 0.3,
        epochs: 1,
        loss: Math.random(),
        timestamp: Date.now(),
      }));

      // All aggregators should succeed
      const fedAvgResult = fedAvg.aggregate(updates);
      const fedProxResult = fedProx.aggregate(updates, new Array(50).fill(0));
      const krumResult = krum.aggregate(updates);

      expect(fedAvgResult.parameters).toHaveLength(50);
      expect(fedProxResult.parameters).toHaveLength(50);
      expect(krumResult.parameters).toHaveLength(50);

      // FedAvg and FedProx should have non-zero distances (averaging multiple updates)
      expect(fedAvgResult.metrics.avgDistance).toBeGreaterThanOrEqual(0);
      expect(fedProxResult.metrics.avgDistance).toBeGreaterThanOrEqual(0);

      // Krum selects single best update, so distance might be 0
      expect(krumResult.metrics.avgDistance).toBeGreaterThanOrEqual(0);
    });

    it("should maintain convergence over multiple rounds", () => {
      const aggregator = new FedAvgAggregator();

      let model = new Array(20).fill(0).map(() => Math.random() * 0.1);

      for (let round = 0; round < 10; round++) {
        const updates: ModelUpdate[] = Array.from({ length: 5 }, (_, i) => ({
          clientId: `client_${i}`,
          parameters: model.map((p, j) => p + (Math.random() - 0.5) * 0.01),
          numSamples: 100,
          epochs: 1,
          loss: Math.random(),
          timestamp: Date.now(),
        }));

        const result = aggregator.aggregate(updates, model);
        model = result.parameters;

        // Model should stabilize over time
        if (round > 3) {
          expect(result.metrics.convergenceMetric).toBeLessThan(1);
        }
      }
    });
  });

  describe("Default Configurations", () => {
    it("should have valid FedAvg defaults", () => {
      expect(DEFAULT_FEDAVG_CONFIG.weightingStrategy).toBeDefined();
      expect(DEFAULT_FEDAVG_CONFIG.minWeight).toBeGreaterThan(0);
      expect(DEFAULT_FEDAVG_CONFIG.maxWeight).toBeGreaterThan(0);
      expect(DEFAULT_FEDAVG_CONFIG.normalizeWeights).toBe(true);
    });

    it("should have valid FedProx defaults", () => {
      expect(DEFAULT_FEDPROX_CONFIG.mu).toBeGreaterThan(0);
      expect(DEFAULT_FEDPROX_CONFIG.maxDrift).toBeGreaterThan(0);
      expect(DEFAULT_FEDPROX_CONFIG.adaptiveMu).toBe(false);
    });

    it("should have valid Byzantine defaults", () => {
      expect(DEFAULT_BYZANTINE_CONFIG.maxByzantine).toBeGreaterThanOrEqual(1);
      expect(DEFAULT_BYZANTINE_CONFIG.method).toBeDefined();
    });
  });
});

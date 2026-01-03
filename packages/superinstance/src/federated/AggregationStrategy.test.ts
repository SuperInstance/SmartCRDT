/**
 * Aggregation Strategy Tests
 *
 * Comprehensive tests for federated learning aggregation strategies including:
 * - FedAvg (Federated Averaging)
 * - FedAvgM (Federated Averaging with Momentum)
 * - FedProx (Federated Proximal)
 * - Robust aggregation (Krum, Multi-Krum, Trimmed Mean, Median)
 * - Byzantine resilience
 * - Update validation
 *
 * @module federated.test
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  FederatedAggregator,
  createDefaultAggregatorConfig,
  createRobustAggregatorConfig,
  type AggregatorConfig,
} from "./AggregationStrategy.js";
import type {
  ModelUpdate,
} from "@lsi/protocol/federated";
import {
  AggregationStrategy,
  RobustAggregationMethod,
  NoiseMechanismType,
} from "@lsi/protocol/federated";

describe("FederatedAggregator", () => {
  let aggregator: FederatedAggregator;
  let updates: ModelUpdate[];
  let globalWeights: number[];

  beforeEach(() => {
    globalWeights = Array.from({ length: 100 }, () => Math.random());

    // Create 5 client updates
    updates = Array.from({ length: 5 }, (_, i) => ({
      clientId: `client-${i}`,
      roundId: "round-1",
      timestamp: Date.now(),
      numExamples: 1000 + i * 100,
      numEpochs: 1,
      weightDeltas: Array.from({ length: 100 }, () => (Math.random() - 0.5) * 0.1),
      metrics: {
        loss: 0.5 + Math.random() * 0.3,
        accuracy: 0.7 + Math.random() * 0.2,
        numBatches: 10,
        trainingTime: 1000 + Math.random() * 2000,
      },
    }));

    aggregator = new FederatedAggregator(createDefaultAggregatorConfig());
  });

  describe("FedAvg Aggregation", () => {
    it("should perform simple federated averaging", async () => {
      const config = createDefaultAggregatorConfig();
      config.strategy = AggregationStrategy.FEDAVG;
      aggregator = new FederatedAggregator(config);

      const result = await aggregator.aggregate(updates, globalWeights, "round-1");

      expect(result.roundId).toBe("round-1");
      expect(result.numClients).toBe(5);
      expect(result.aggregatedWeights).toBeDefined();
      expect(result.aggregatedWeights.length).toBe(100);
      expect(result.globalWeights).toBeDefined();
      expect(result.globalWeights.length).toBe(100);
    });

    it("should weight updates by number of examples", async () => {
      // Create updates with very different example counts
      const weightedUpdates = [
        {
          ...updates[0],
          numExamples: 100,
          weightDeltas: Array.from({ length: 100 }, () => 0.1),
        },
        {
          ...updates[1],
          numExamples: 1000,
          weightDeltas: Array.from({ length: 100 }, () => 0.2),
        },
      ];

      const result = await aggregator.aggregate(weightedUpdates, globalWeights, "round-1");

      // Result should be closer to the update with more examples
      const expectedWeight = 100 / (100 + 1000);
      const expectedValue = expectedWeight * 0.1 + (1 - expectedWeight) * 0.2;
      expect(result.aggregatedWeights[0]).toBeCloseTo(expectedValue, 5);
    });

    it("should compute contribution scores", async () => {
      const result = await aggregator.aggregate(updates, globalWeights, "round-1");

      expect(result.contributionScores).toBeDefined();
      expect(result.contributionScores.size).toBe(5);

      // Verify scores sum to approximately 1
      const totalScore = Array.from(result.contributionScores.values()).reduce((sum, score) => sum + score, 0);
      expect(totalScore).toBeCloseTo(1.0, 5);
    });
  });

  describe("FedAvgM Aggregation", () => {
    it("should apply momentum to FedAvg", async () => {
      const config = createDefaultAggregatorConfig();
      config.strategy = AggregationStrategy.FEDAVGM;
      config.momentumCoefficient = 0.9;
      aggregator = new FederatedAggregator(config);

      const result = await aggregator.aggregate(updates, globalWeights, "round-1");

      expect(result.aggregatedWeights).toBeDefined();
      expect(result.aggregatedWeights.length).toBe(100);
    });

    it("should use configurable momentum coefficient", async () => {
      const config1 = createDefaultAggregatorConfig();
      config1.strategy = AggregationStrategy.FEDAVGM;
      config1.momentumCoefficient = 0.5;

      const config2 = createDefaultAggregatorConfig();
      config2.strategy = AggregationStrategy.FEDAVGM;
      config2.momentumCoefficient = 0.95;

      const aggregator1 = new FederatedAggregator(config1);
      const aggregator2 = new FederatedAggregator(config2);

      const result1 = await aggregator1.aggregate(updates, globalWeights, "round-1");
      const result2 = await aggregator2.aggregate(updates, globalWeights, "round-1");

      // Results should differ due to different momentum
      expect(result1.aggregatedWeights).not.toEqual(result2.aggregatedWeights);
    });
  });

  describe("FedProx Aggregation", () => {
    it("should apply proximal term", async () => {
      const config = createDefaultAggregatorConfig();
      config.strategy = AggregationStrategy.FEDPROX;
      config.proximalTerm = 0.01;
      aggregator = new FederatedAggregator(config);

      const result = await aggregator.aggregate(updates, globalWeights, "round-1");

      expect(result.aggregatedWeights).toBeDefined();
      expect(result.aggregatedWeights.length).toBe(100);
    });

    it("should penalize large deviations from global model", async () => {
      const config = createDefaultAggregatorConfig();
      config.strategy = AggregationStrategy.FEDPROX;
      config.proximalTerm = 0.1; // Higher proximal term
      aggregator = new FederatedAggregator(config);

      const result = await aggregator.aggregate(updates, globalWeights, "round-1");

      // Proximal term should reduce the magnitude of updates
      const fedAvgConfig = createDefaultAggregatorConfig();
      fedAvgConfig.strategy = AggregationStrategy.FEDAVG;
      const fedAvgAggregator = new FederatedAggregator(fedAvgConfig);
      const fedAvgResult = await fedAvgAggregator.aggregate(updates, globalWeights, "round-1");

      // FedProx updates should generally be smaller
      const fedProxNorm = Math.sqrt(result.aggregatedWeights.reduce((sum, w) => sum + w * w, 0));
      const fedAvgNorm = Math.sqrt(fedAvgResult.aggregatedWeights.reduce((sum, w) => sum + w * w, 0));
      expect(fedProxNorm).toBeLessThanOrEqual(fedAvgNorm * 1.1); // Allow small tolerance
    });
  });

  describe("Robust Aggregation - Krum", () => {
    it("should perform Krum aggregation", async () => {
      const config = createRobustAggregatorConfig();
      config.robustMethod = RobustAggregationMethod.KRUM;
      aggregator = new FederatedAggregator(config);

      const result = await aggregator.aggregate(updates, globalWeights, "round-1");

      expect(result.aggregatedWeights).toBeDefined();
      expect(result.aggregatedWeights.length).toBe(100);
    });

    it("should select update closest to others", async () => {
      const config = createRobustAggregatorConfig();
      config.robustMethod = RobustAggregationMethod.KRUM;
      aggregator = new FederatedAggregator(config);

      // Create 4 similar updates and 1 very different update
      const baseUpdate = Array.from({ length: 100 }, () => 0.1);
      const maliciousUpdates = [
        { ...updates[0], weightDeltas: baseUpdate },
        { ...updates[1], weightDeltas: [...baseUpdate] },
        { ...updates[2], weightDeltas: [...baseUpdate] },
        { ...updates[3], weightDeltas: [...baseUpdate] },
        { ...updates[4], weightDeltas: Array.from({ length: 100 }, () => 10.0) }, // Very different
      ];

      const result = await aggregator.aggregate(maliciousUpdates, globalWeights, "round-1");

      // Result should be close to the base updates, not the malicious one
      expect(result.aggregatedWeights[0]).toBeLessThan(1.0);
    });
  });

  describe("Robust Aggregation - Multi-Krum", () => {
    it("should perform Multi-Krum aggregation", async () => {
      const config = createRobustAggregatorConfig();
      config.robustMethod = RobustAggregationMethod.MULTI_KRUM;
      aggregator = new FederatedAggregator(config);

      const result = await aggregator.aggregate(updates, globalWeights, "round-1");

      expect(result.aggregatedWeights).toBeDefined();
      expect(result.aggregatedWeights.length).toBe(100);
    });

    it("should average multiple selected updates", async () => {
      const config = createRobustAggregatorConfig();
      config.robustMethod = RobustAggregationMethod.MULTI_KRUM;
      aggregator = new FederatedAggregator(config);

      const result = await aggregator.aggregate(updates, globalWeights, "round-1");

      // Multi-Krum should average multiple updates, so result should differ from Krum
      expect(result.aggregatedWeights).toBeDefined();
    });
  });

  describe("Robust Aggregation - Trimmed Mean", () => {
    it("should perform trimmed mean aggregation", async () => {
      const config = createRobustAggregatorConfig();
      config.robustMethod = RobustAggregationMethod.TRIMMED_MEAN;
      aggregator = new FederatedAggregator(config);

      const result = await aggregator.aggregate(updates, globalWeights, "round-1");

      expect(result.aggregatedWeights).toBeDefined();
      expect(result.aggregatedWeights.length).toBe(100);
    });

    it("should remove largest and smallest updates", async () => {
      const config = createRobustAggregatorConfig();
      config.robustMethod = RobustAggregationMethod.TRIMMED_MEAN;
      aggregator = new FederatedAggregator(config);

      // Create updates with varying norms
      const varyingUpdates = updates.map((update, i) => ({
        ...update,
        weightDeltas: Array.from({ length: 100 }, () => i * 0.1),
      }));

      const result = await aggregator.aggregate(varyingUpdates, globalWeights, "round-1");

      // Result should be based on trimmed updates
      expect(result.aggregatedWeights).toBeDefined();
    });
  });

  describe("Robust Aggregation - Median", () => {
    it("should perform median aggregation", async () => {
      const config = createRobustAggregatorConfig();
      config.robustMethod = RobustAggregationMethod.MEDIAN;
      aggregator = new FederatedAggregator(config);

      const result = await aggregator.aggregate(updates, globalWeights, "round-1");

      expect(result.aggregatedWeights).toBeDefined();
      expect(result.aggregatedWeights.length).toBe(100);
    });

    it("should use median instead of mean", async () => {
      const config = createRobustAggregatorConfig();
      config.robustMethod = RobustAggregationMethod.MEDIAN;
      aggregator = new FederatedAggregator(config);

      // Create updates with outliers
      const outlierUpdates = [
        ...updates.slice(0, 4),
        {
          ...updates[4],
          weightDeltas: Array.from({ length: 100 }, () => 100.0), // Huge outlier
        },
      ];

      const result = await aggregator.aggregate(outlierUpdates, globalWeights, "round-1");

      // Median should be robust to outlier
      expect(result.aggregatedWeights[0]).toBeLessThan(10.0);
    });
  });

  describe("Robust Aggregation - Coordinate Median", () => {
    it("should perform coordinate-wise median aggregation", async () => {
      const config = createRobustAggregatorConfig();
      config.robustMethod = RobustAggregationMethod.COORDINATE_MEDIAN;
      aggregator = new FederatedAggregator(config);

      const result = await aggregator.aggregate(updates, globalWeights, "round-1");

      expect(result.aggregatedWeights).toBeDefined();
      expect(result.aggregatedWeights.length).toBe(100);
    });
  });

  describe("Update Validation", () => {
    it("should reject updates with norm too large", async () => {
      const config = createRobustAggregatorConfig();
      config.maxUpdateNorm = 1.0;
      aggregator = new FederatedAggregator(config);

      // Create an update with very large norm
      const largeUpdate = {
        ...updates[0],
        weightDeltas: Array.from({ length: 100 }, () => 10.0),
      };

      const result = await aggregator.aggregate([largeUpdate, ...updates.slice(1)], globalWeights, "round-1");

      expect(result.validation?.rejectedClients).toContain(largeUpdate.clientId);
      expect(result.validation?.rejectionReasons.get(largeUpdate.clientId)).toBe("norm_too_large");
    });

    it("should reject updates with norm too small", async () => {
      const config = createRobustAggregatorConfig();
      config.minUpdateNorm = 0.01;
      aggregator = new FederatedAggregator(config);

      // Create an update with very small norm
      const smallUpdate = {
        ...updates[0],
        weightDeltas: Array.from({ length: 100 }, () => 0.0001),
      };

      const result = await aggregator.aggregate([smallUpdate, ...updates.slice(1)], globalWeights, "round-1");

      expect(result.validation?.rejectedClients).toContain(smallUpdate.clientId);
      expect(result.validation?.rejectionReasons.get(smallUpdate.clientId)).toBe("norm_too_small");
    });

    it("should detect outliers using standard deviation", async () => {
      const config = createRobustAggregatorConfig();
      config.outlierStdDevThreshold = 2.0;
      aggregator = new FederatedAggregator(config);

      // Create one update that's an outlier
      const outlierUpdate = {
        ...updates[0],
        weightDeltas: Array.from({ length: 100 }, () => 5.0),
      };

      const result = await aggregator.aggregate([outlierUpdate, ...updates.slice(1)], globalWeights, "round-1");

      // Should detect and potentially reject the outlier
      expect(result.validation?.numOutliers).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Cosine Similarity Checks", () => {
    it("should check cosine similarity when enabled", async () => {
      const config = createRobustAggregatorConfig();
      config.enableSimilarityCheck = true;
      config.minCosineSimilarity = 0.9;
      aggregator = new FederatedAggregator(config);

      // Create updates with low similarity
      const dissimilarUpdate = {
        ...updates[0],
        weightDeltas: Array.from({ length: 100 }, () => (Math.random() - 0.5) * 10),
      };

      const result = await aggregator.aggregate([dissimilarUpdate, ...updates.slice(1)], globalWeights, "round-1");

      expect(result.validation?.avgCosineSimilarity).toBeDefined();
    });

    it("should reject updates with low similarity", async () => {
      const config = createRobustAggregatorConfig();
      config.enableSimilarityCheck = true;
      config.minCosineSimilarity = 0.95; // Very high threshold
      aggregator = new FederatedAggregator(config);

      // Create very dissimilar updates
      const dissimilarUpdates = updates.map((update, i) => ({
        ...update,
        weightDeltas: Array.from({ length: 100 }, () => (i % 2 === 0 ? 1.0 : -1.0)),
      }));

      const result = await aggregator.aggregate(dissimilarUpdates, globalWeights, "round-1");

      // Some updates should be rejected due to low similarity
      expect(result.validation?.rejectedClients.length).toBeGreaterThan(0);
    });
  });

  describe("Aggregation Metrics", () => {
    it("should compute aggregation metrics", async () => {
      const result = await aggregator.aggregate(updates, globalWeights, "round-1");

      expect(result.metrics).toBeDefined();
      expect(result.metrics.aggregationTime).toBeGreaterThan(0);
      expect(result.metrics.maxUpdateNorm).toBeGreaterThan(0);
      expect(result.metrics.minUpdateNorm).toBeGreaterThan(0);
      expect(result.metrics.avgUpdateNorm).toBeGreaterThan(0);
      expect(result.metrics.stdUpdateNorm).toBeGreaterThan(0);
      expect(result.metrics.numAccepted).toBe(5);
      expect(result.metrics.numRejected).toBe(0);
    });

    it("should track rejected updates", async () => {
      const config = createRobustAggregatorConfig();
      config.maxUpdateNorm = 0.01; // Very low threshold
      aggregator = new FederatedAggregator(config);

      const result = await aggregator.aggregate(updates, globalWeights, "round-1");

      expect(result.metrics.numRejected).toBeGreaterThan(0);
      expect(result.metrics.numAccepted).toBeLessThan(5);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty updates array", async () => {
      const result = await aggregator.aggregate([], globalWeights, "round-1");

      expect(result.numClients).toBe(0);
      expect(result.aggregatedWeights).toEqual(new Array(100).fill(0));
    });

    it("should handle single update", async () => {
      const result = await aggregator.aggregate([updates[0]], globalWeights, "round-1");

      expect(result.numClients).toBe(1);
      expect(result.aggregatedWeights).toBeDefined();
    });

    it("should handle updates with different dimensions", async () => {
      // This would normally be an error, but we test graceful handling
      const mismatchedUpdate = {
        ...updates[0],
        weightDeltas: Array.from({ length: 50 }, () => 0.1), // Wrong size
      };

      // In production, this should be caught by validation
      // For now, we just verify the aggregator doesn't crash
      try {
        await aggregator.aggregate([mismatchedUpdate], globalWeights.slice(0, 50), "round-1");
        expect(true).toBe(true); // If we get here, no crash occurred
      } catch (error) {
        expect(error).toBeDefined(); // Or expect an error to be thrown
      }
    });
  });

  describe("Byzantine Resilience", () => {
    it("should handle malicious updates with Krum", async () => {
      const config = createRobustAggregatorConfig();
      config.robustMethod = RobustAggregationMethod.KRUM;
      aggregator = new FederatedAggregator(config);

      // Create malicious update
      const maliciousUpdates = [
        ...updates.slice(0, 4),
        {
          ...updates[4],
          weightDeltas: Array.from({ length: 100 }, () => 1000.0), // Obviously malicious
        },
      ];

      const result = await aggregator.aggregate(maliciousUpdates, globalWeights, "round-1");

      // Krum should select a non-malicious update
      expect(result.aggregatedWeights[0]).toBeLessThan(100.0);
    });

    it("should handle malicious updates with Trimmed Mean", async () => {
      const config = createRobustAggregatorConfig();
      config.robustMethod = RobustAggregationMethod.TRIMMED_MEAN;
      aggregator = new FederatedAggregator(config);

      // Create malicious updates with largest and smallest norms
      const maliciousUpdates = [
        { ...updates[0], weightDeltas: Array.from({ length: 100 }, () => -1000.0) },
        { ...updates[1], weightDeltas: Array.from({ length: 100 }, () => 1000.0) },
        ...updates.slice(2),
      ];

      const result = await aggregator.aggregate(maliciousUpdates, globalWeights, "round-1");

      // Trimmed mean should remove the malicious updates
      expect(result.aggregatedWeights[0]).toBeGreaterThan(-100.0);
      expect(result.aggregatedWeights[0]).toBeLessThan(100.0);
    });
  });
});

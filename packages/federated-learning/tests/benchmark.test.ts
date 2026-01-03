/**
 * @fileoverview Tests for Federated Learning Benchmark
 *
 * Tests for benchmark functionality comparing FedAvg vs FedProx convergence.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  AggregationBenchmark,
  runQuickBenchmark,
  BenchmarkConfig,
  BenchmarkResults,
  AlgorithmResult,
} from "../src/benchmark.js";
import { SeededRandom } from "../src/benchmark.js";

describe("Aggregation Benchmark", () => {
  describe("SeededRandom", () => {
    it("should produce consistent results with same seed", () => {
      const random1 = new SeededRandom(42);
      const random2 = new SeededRandom(42);

      for (let i = 0; i < 10; i++) {
        expect(random1.next()).toBe(random2.next());
      }
    });

    it("should produce different results with different seeds", () => {
      const random1 = new SeededRandom(42);
      const random2 = new SeededRandom(43);

      const val1 = random1.next();
      const val2 = random2.next();

      expect(val1).not.toBe(val2);
    });

    it("should generate Gaussian distributed values", () => {
      const random = new SeededRandom(42);
      const values: number[] = [];

      for (let i = 0; i < 1000; i++) {
        values.push(random.nextGaussian());
      }

      // Mean should be close to 0
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      expect(Math.abs(mean)).toBeLessThan(0.1);

      // Std should be close to 1
      const variance =
        values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
      const std = Math.sqrt(variance);
      expect(Math.abs(std - 1)).toBeLessThan(0.2);
    });
  });

  describe("AggregationBenchmark", () => {
    let benchmark: AggregationBenchmark;

    beforeEach(() => {
      benchmark = new AggregationBenchmark({
        numRounds: 10,
        numClients: 5,
        modelDim: 20,
        dataDistribution: "iid",
        heterogeneity: 0.3,
        seed: 42,
      });
    });

    it("should create benchmark with config", () => {
      const config: BenchmarkConfig = {
        numRounds: 20,
        numClients: 10,
        modelDim: 50,
        dataDistribution: "non_iid",
        heterogeneity: 0.7,
        seed: 123,
      };

      const customBenchmark = new AggregationBenchmark(config);
      expect(customBenchmark).toBeInstanceOf(AggregationBenchmark);
    });

    it("should run quick benchmark successfully", async () => {
      const results = await runQuickBenchmark();

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results).toContain("# Federated Aggregation Benchmark Results");
      expect(results).toContain("## FedAvg Results");
      expect(results).toContain("## FedProx Results");
      expect(results).toContain("## Comparison");
    });

    it("should benchmark FedAvg vs FedProx", async () => {
      const results = await benchmark.runBenchmark();

      expect(results.config).toBeDefined();
      expect(results.fedAvg).toBeDefined();
      expect(results.fedProx).toBeDefined();
      expect(results.comparison).toBeDefined();
    });

    it("should generate loss trajectories", async () => {
      const results = await benchmark.runBenchmark();

      expect(results.fedAvg.lossTrajectory).toHaveLength(10);
      expect(results.fedProx.lossTrajectory).toHaveLength(10);

      // Loss should generally decrease
      const firstLoss = results.fedAvg.lossTrajectory[0];
      const lastLoss = results.fedAvg.lossTrajectory[9];
      expect(lastLoss).toBeLessThanOrEqual(firstLoss * 2); // Allow some noise
    });

    it("should generate accuracy trajectories", async () => {
      const results = await benchmark.runBenchmark();

      expect(results.fedAvg.accuracyTrajectory).toHaveLength(10);
      expect(results.fedProx.accuracyTrajectory).toHaveLength(10);
    });

    it("should compute communication costs", async () => {
      const results = await benchmark.runBenchmark();

      expect(results.fedAvg.communicationCost).toBeGreaterThan(0);
      expect(results.fedProx.communicationCost).toBeGreaterThan(0);

      // Cost = rounds * clients * model_dim
      const expectedCost = 10 * 5 * 20;
      expect(results.fedAvg.communicationCost).toBe(expectedCost);
    });

    it("should compare algorithms", async () => {
      const results = await benchmark.runBenchmark();

      expect(results.comparison.accuracyImprovement).toBeDefined();
      expect(results.comparison.lossReduction).toBeDefined();
      expect(results.comparison.convergenceSpeedup).toBeDefined();
      expect(results.comparison.communicationEfficiency).toBeDefined();
    });

    it("should handle IID data distribution", async () => {
      const iidBenchmark = new AggregationBenchmark({
        numRounds: 10,
        numClients: 5,
        modelDim: 20,
        dataDistribution: "iid",
        heterogeneity: 0,
        seed: 42,
      });

      const results = await iidBenchmark.runBenchmark();

      expect(results.config.dataDistribution).toBe("iid");
      expect(results.fedAvg.finalAccuracy).toBeGreaterThan(0);
    });

    it("should handle non-IID data distribution", async () => {
      const nonIidBenchmark = new AggregationBenchmark({
        numRounds: 10,
        numClients: 5,
        modelDim: 20,
        dataDistribution: "non_iid",
        heterogeneity: 0.7,
        seed: 42,
      });

      const results = await nonIidBenchmark.runBenchmark();

      expect(results.config.dataDistribution).toBe("non_iid");
      expect(results.fedAvg.finalAccuracy).toBeGreaterThan(0);
    });

    it("should handle pathological data distribution", async () => {
      const pathologicalBenchmark = new AggregationBenchmark({
        numRounds: 10,
        numClients: 6,
        modelDim: 20,
        dataDistribution: "pathological",
        heterogeneity: 0.9,
        seed: 42,
      });

      const results = await pathologicalBenchmark.runBenchmark();

      expect(results.config.dataDistribution).toBe("pathological");
      expect(results.fedAvg.finalAccuracy).toBeGreaterThan(0);
    });

    it("should detect convergence rounds", async () => {
      const results = await benchmark.runBenchmark();

      // Convergence round might not be set if accuracy doesn't reach threshold
      // but should be a valid number if set
      if (results.fedAvg.convergenceRound !== undefined) {
        expect(results.fedAvg.convergenceRound).toBeGreaterThanOrEqual(0);
        expect(results.fedAvg.convergenceRound).toBeLessThanOrEqual(10);
      }
    });

    it("should format results as markdown", async () => {
      const results = await benchmark.runBenchmark();
      const formatted = benchmark.formatResults(results);

      expect(formatted).toContain("# Federated Aggregation Benchmark Results");
      expect(formatted).toContain("## Configuration");
      expect(formatted).toContain("## FedAvg Results");
      expect(formatted).toContain("## FedProx Results");
      expect(formatted).toContain("## Comparison");
      expect(formatted).toContain("## Convergence Trajectories");
      expect(formatted).toContain("| Round |");
    });
  });

  describe("Benchmark Scenarios", () => {
    it("should compare homogeneous vs heterogeneous clients", async () => {
      const homoBenchmark = new AggregationBenchmark({
        numRounds: 15,
        numClients: 8,
        modelDim: 30,
        heterogeneity: 0,
        seed: 42,
      });

      const heteroBenchmark = new AggregationBenchmark({
        numRounds: 15,
        numClients: 8,
        modelDim: 30,
        heterogeneity: 0.8,
        seed: 42,
      });

      const homoResults = await homoBenchmark.runBenchmark();
      const heteroResults = await heteroBenchmark.runBenchmark();

      // Both should complete successfully
      expect(homoResults.fedAvg.finalAccuracy).toBeGreaterThan(0);
      expect(heteroResults.fedAvg.finalAccuracy).toBeGreaterThan(0);

      // Heterogeneous might have different convergence
      expect(homoResults.config.heterogeneity).toBe(0);
      expect(heteroResults.config.heterogeneity).toBe(0.8);
    });

    it("should test with varying number of clients", async () => {
      const fewClients = new AggregationBenchmark({
        numRounds: 10,
        numClients: 3,
        modelDim: 20,
        seed: 42,
      });

      const manyClients = new AggregationBenchmark({
        numRounds: 10,
        numClients: 15,
        modelDim: 20,
        seed: 42,
      });

      const fewResults = await fewClients.runBenchmark();
      const manyResults = await manyClients.runBenchmark();

      expect(fewResults.fedAvg.numClients).toBe(3);
      expect(manyResults.fedAvg.numClients).toBe(15);
    });
  });

  describe("Algorithm Result Structure", () => {
    it("should have all required fields", async () => {
      const benchmark = new AggregationBenchmark({
        numRounds: 5,
        numClients: 3,
        modelDim: 10,
        seed: 42,
      });

      const results = await benchmark.runBenchmark();

      const checkAlgorithmResult = (result: AlgorithmResult) => {
        expect(result.name).toBeDefined();
        expect(result.lossTrajectory).toBeDefined();
        expect(result.accuracyTrajectory).toBeDefined();
        expect(result.communicationCost).toBeGreaterThan(0);
        expect(result.finalModel).toBeDefined();
        expect(result.finalLoss).toBeGreaterThanOrEqual(0);
        expect(result.finalAccuracy).toBeGreaterThanOrEqual(0);
      };

      checkAlgorithmResult(results.fedAvg);
      checkAlgorithmResult(results.fedProx);
    });
  });

  describe("Performance", () => {
    it("should complete benchmark in reasonable time", async () => {
      const startTime = Date.now();

      const benchmark = new AggregationBenchmark({
        numRounds: 20,
        numClients: 10,
        modelDim: 50,
        seed: 42,
      });

      await benchmark.runBenchmark();

      const duration = Date.now() - startTime;

      // Should complete in under 5 seconds for this size
      expect(duration).toBeLessThan(5000);
    });
  });
});

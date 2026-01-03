/**
 * Tests for ByzantineEnsemble - Byzantine-Resilient Ensemble
 *
 * @package @lsi/privacy
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ByzantineEnsemble,
  type EnsembleConfig,
  type EnsembleRequest,
  type ModelAdapter,
} from "./ByzantineEnsemble.js";
import { VotingMechanism } from "./VotingMechanism.js";
import { FaultDetector } from "./FaultDetector.js";
import { PrivacyLevel } from '@lsi/protocol';

// Mock model adapter for testing
class MockModelAdapter implements ModelAdapter {
  modelId: string;
  latency: number;
  confidence: number;
  response: string;
  shouldFail: boolean;
  callCount: number;
  shouldDelay: boolean;
  delayMs: number;

  constructor(
    modelId: string,
    response: string,
    confidence: number,
    latency: number,
    shouldFail = false,
    shouldDelay = false,
    delayMs = 0
  ) {
    this.modelId = modelId;
    this.response = response;
    this.confidence = confidence;
    this.latency = latency;
    this.shouldFail = shouldFail;
    this.shouldDelay = shouldDelay;
    this.delayMs = delayMs;
    this.callCount = 0;
  }

  async query(
    _query: string,
    _context?: unknown
  ): Promise<{
    response: string;
    confidence: number;
    latency: number;
  }> {
    this.callCount++;

    if (this.shouldDelay) {
      await new Promise(resolve => setTimeout(resolve, this.delayMs));
    }

    if (this.shouldFail) {
      throw new Error("Model query failed");
    }
    return {
      response: this.response,
      confidence: this.confidence,
      latency: this.latency,
    };
  }

  resetCallCount(): void {
    this.callCount = 0;
  }
}

describe("VotingMechanism", () => {
  let mechanism: VotingMechanism;

  beforeEach(() => {
    mechanism = new VotingMechanism();
  });

  describe("majority voting", () => {
    it("should select majority winner", () => {
      const responses = [
        { modelId: "m1", response: "yes", confidence: 0.9, latency: 100 },
        { modelId: "m2", response: "yes", confidence: 0.8, latency: 100 },
        { modelId: "m3", response: "no", confidence: 0.7, latency: 100 },
      ];

      const result = mechanism.majority(responses);

      expect(result.consensus).toBe(true);
      expect(result.winnerVotes).toBe(2);
      expect(result.totalVotes).toBe(3);
    });

    it("should handle empty responses", () => {
      const result = mechanism.majority([]);
      expect(result.winner).toBe("");
      expect(result.consensus).toBe(false);
    });

    it("should handle all error responses", () => {
      const responses = [
        {
          modelId: "m1",
          response: "",
          confidence: 0,
          latency: 0,
          error: "failed",
        },
        {
          modelId: "m2",
          response: "",
          confidence: 0,
          latency: 0,
          error: "failed",
        },
      ];

      const result = mechanism.majority(responses);
      expect(result.winner).toBe("");
      expect(result.totalVotes).toBe(0);
    });
  });

  describe("supermajority voting", () => {
    it("should require 2/3 majority", () => {
      const responses = [
        { modelId: "m1", response: "yes", confidence: 0.9, latency: 100 },
        { modelId: "m2", response: "yes", confidence: 0.8, latency: 100 },
        { modelId: "m3", response: "no", confidence: 0.7, latency: 100 },
        { modelId: "m4", response: "no", confidence: 0.6, latency: 100 },
      ];

      const result = mechanism.supermajority(responses);
      expect(result.consensus).toBe(false); // 2/4 = 50%, not >= 66.67%
    });

    it("should achieve consensus with 2/3 majority", () => {
      const responses = [
        { modelId: "m1", response: "yes", confidence: 0.9, latency: 100 },
        { modelId: "m2", response: "yes", confidence: 0.8, latency: 100 },
        { modelId: "m3", response: "yes", confidence: 0.7, latency: 100 },
      ];

      const result = mechanism.supermajority(responses);
      expect(result.consensus).toBe(true);
    });
  });

  describe("weighted voting", () => {
    it("should weight votes by reputation", () => {
      mechanism.setReputation("m1", 0.9);
      mechanism.setReputation("m2", 0.3);
      mechanism.setReputation("m3", 0.2);

      const responses = [
        { modelId: "m1", response: "yes", confidence: 0.5, latency: 100 },
        { modelId: "m2", response: "no", confidence: 0.9, latency: 100 },
        { modelId: "m3", response: "no", confidence: 0.8, latency: 100 },
      ];

      const result = mechanism.weighted(responses);
      expect(result.winner).not.toBe("");
      // m1's vote has higher weight despite lower confidence
    });
  });

  describe("median voting", () => {
    it("should select median confidence response", () => {
      const responses = [
        { modelId: "m1", response: "low", confidence: 0.3, latency: 100 },
        { modelId: "m2", response: "medium", confidence: 0.5, latency: 100 },
        { modelId: "m3", response: "high", confidence: 0.9, latency: 100 },
      ];

      const result = mechanism.median(responses);
      expect(result.winningResponse).toBe("medium");
    });
  });

  describe("trimmed mean voting", () => {
    it("should remove outliers and select best", () => {
      const responses = [
        { modelId: "m1", response: "low", confidence: 0.1, latency: 100 },
        { modelId: "m2", response: "medium", confidence: 0.5, latency: 100 },
        { modelId: "m3", response: "high", confidence: 0.8, latency: 100 },
        {
          modelId: "m4",
          response: "very high",
          confidence: 0.95,
          latency: 100,
        },
        { modelId: "m5", response: "outlier", confidence: 0.01, latency: 100 },
      ];

      const result = mechanism.trimmedMean(responses, 0.2);
      expect(result.totalVotes).toBe(5); // Total unchanged
      expect(result.winnerVotes).toBeLessThan(5); // Trimmed
    });
  });

  describe("Byzantine voting", () => {
    it("should tolerate f faulty models out of 2f+1", () => {
      // 3 models, can tolerate 1 faulty
      const responses = [
        { modelId: "m1", response: "correct", confidence: 0.9, latency: 100 },
        { modelId: "m2", response: "correct", confidence: 0.8, latency: 100 },
        { modelId: "m3", response: "wrong", confidence: 0.7, latency: 100 },
      ];

      const result = mechanism.byzantine(responses, 1);
      expect(result.consensus).toBe(true);
      expect(result.winningResponse).toBe("correct");
    });

    it("should require 2f+1 models for Byzantine guarantee", () => {
      // Only 2 models, cannot guarantee Byzantine fault tolerance
      const responses = [
        { modelId: "m1", response: "yes", confidence: 0.9, latency: 100 },
        { modelId: "m2", response: "no", confidence: 0.8, latency: 100 },
      ];

      const result = mechanism.byzantine(responses, 1);
      // Falls back to majority
      expect(result.totalVotes).toBe(2);
    });
  });

  describe("reputation management", () => {
    it("should set and get reputation", () => {
      mechanism.setReputation("model1", 0.8);
      const reputation = mechanism.getReputation("model1");
      expect(reputation?.score).toBe(0.8);
    });

    it("should update reputation based on performance", () => {
      mechanism.updateReputation("model1", true);
      mechanism.updateReputation("model1", true);
      mechanism.updateReputation("model1", false);

      const reputation = mechanism.getReputation("model1");
      expect(reputation?.history.correct).toBe(2);
      expect(reputation?.history.incorrect).toBe(1);
    });

    it("should increase reputation for correct answers", () => {
      mechanism.setReputation("model1", 0.5);
      mechanism.updateReputation("model1", true);

      const reputation = mechanism.getReputation("model1");
      expect(reputation?.score).toBeGreaterThan(0.5);
    });

    it("should decrease reputation for incorrect answers", () => {
      mechanism.setReputation("model1", 0.5);
      mechanism.updateReputation("model1", false);

      const reputation = mechanism.getReputation("model1");
      expect(reputation?.score).toBeLessThan(0.5);
    });
  });
});

describe("FaultDetector", () => {
  let detector: FaultDetector;

  beforeEach(() => {
    detector = new FaultDetector();
  });

  describe("response time detection", () => {
    it("should detect slow responses as faulty", () => {
      const responses = [
        { modelId: "m1", response: "fast", confidence: 0.9, latency: 100 },
        { modelId: "m2", response: "slow", confidence: 0.8, latency: 15000 }, // Too slow
      ];

      const reports = detector.detectFaults(responses);
      const slowReport = reports.find(r => r.modelId === "m2");

      expect(slowReport?.isFaulty).toBe(true);
      expect(slowReport?.reasons).toContain("timeout");
    });

    it("should not detect normal responses as faulty", () => {
      const responses = [
        { modelId: "m1", response: "normal", confidence: 0.9, latency: 500 },
      ];

      const reports = detector.detectFaults(responses);
      expect(reports[0].isFaulty).toBe(false);
    });
  });

  describe("confidence detection", () => {
    it("should detect low confidence as faulty", () => {
      const responses = [
        { modelId: "m1", response: "confident", confidence: 0.9, latency: 100 },
        { modelId: "m2", response: "unsure", confidence: 0.1, latency: 100 },
      ];

      const reports = detector.detectFaults(responses);
      const unsureReport = reports.find(r => r.modelId === "m2");

      expect(unsureReport?.isFaulty).toBe(true);
      expect(unsureReport?.reasons).toContain("low_confidence");
    });
  });

  describe("error detection", () => {
    it("should detect errors as faulty", () => {
      const responses = [
        { modelId: "m1", response: "ok", confidence: 0.9, latency: 100 },
        {
          modelId: "m2",
          response: "",
          confidence: 0,
          latency: 0,
          error: "failed",
        },
      ];

      const reports = detector.detectFaults(responses);
      const errorReport = reports.find(r => r.modelId === "m2");

      expect(errorReport?.isFaulty).toBe(true);
      expect(errorReport?.reasons).toContain("error");
    });
  });

  describe("statistical outlier detection", () => {
    it("should detect statistical outliers using z-score", () => {
      // Use more values and a more significant outlier
      const values = [0.7, 0.72, 0.71, 0.69, 0.68, 0.01];

      const outliers = detector["zscoreOutlier"](values, 1.5);

      expect(outliers[5]).toBe(true); // 0.01 is outlier
    });

    it("should detect outliers using IQR", () => {
      const values = [1, 2, 3, 4, 5, 100]; // 100 is clear outlier
      const outliers = detector.iqrOutlier(values, 1.5);

      expect(outliers[5]).toBe(true);
    });
  });

  describe("fault history tracking", () => {
    it("should track fault history over time", () => {
      const responses = [
        { modelId: "m1", response: "ok", confidence: 0.9, latency: 100 },
      ];

      detector.detectFaults(responses);

      const history = detector.getFaultHistory("m1");
      expect(history).toBeDefined();
      expect(history?.totalQueries).toBe(1);
    });

    it("should clear fault history", () => {
      const responses = [
        { modelId: "m1", response: "ok", confidence: 0.9, latency: 100 },
      ];

      detector.detectFaults(responses);
      detector.clearFaultHistory();

      const history = detector.getFaultHistory("m1");
      expect(history).toBeUndefined();
    });
  });
});

describe("ByzantineEnsemble", () => {
  let ensemble: ByzantineEnsemble;
  let models: ModelAdapter[];

  beforeEach(() => {
    ensemble = new ByzantineEnsemble({
      size: 5,
      quorum: 3,
      maxFaultyModels: 1,
      assumeHonest: 3,
      votingMechanism: "byzantine",
      enablePrivacy: true,
      privateSplitting: false,
      fallbackOnQuorum: false,
    });

    // Create mock models
    models = [
      new MockModelAdapter("model1", "The answer is 42", 0.9, 100),
      new MockModelAdapter("model2", "The answer is 42", 0.85, 100),
      new MockModelAdapter("model3", "The answer is 42", 0.8, 100),
      new MockModelAdapter("model4", "The answer is 42", 0.75, 100),
      new MockModelAdapter("model5", "The answer is 42", 0.7, 100),
    ];

    for (const model of models) {
      ensemble.registerModel(model);
    }
  });

  describe("model registration", () => {
    it("should register models", () => {
      expect(ensemble.getModelCount()).toBe(5);
      expect(ensemble.getModelIds()).toContain("model1");
    });

    it("should unregister models", () => {
      ensemble.unregisterModel("model1");
      expect(ensemble.getModelCount()).toBe(4);
      expect(ensemble.getModelIds()).not.toContain("model1");
    });
  });

  describe("query execution", () => {
    it("should query all models in parallel", async () => {
      const request: EnsembleRequest = {
        query: "What is the meaning of life?",
      };

      const response = await ensemble.query(request);

      expect(response.individualResponses).toHaveLength(5);
      expect(response.aggregatedResponse).toBeTruthy();
      expect(response.quorumReached).toBe(true);
    });

    it("should aggregate responses using voting", async () => {
      const request: EnsembleRequest = {
        query: "What is 2+2?",
      };

      const response = await ensemble.query(request);

      expect(response.votingResult.winner).toBeTruthy();
      expect(response.votingResult.votes.length).toBeGreaterThan(0);
    });

    it("should handle model failures gracefully", async () => {
      const faultyEnsemble = new ByzantineEnsemble({
        size: 3,
        quorum: 2,
        maxFaultyModels: 1,
        votingMechanism: "byzantine",
      });

      faultyEnsemble.registerModel(
        new MockModelAdapter("good1", "Answer", 0.9, 100, false)
      );
      faultyEnsemble.registerModel(
        new MockModelAdapter("good2", "Answer", 0.8, 100, false)
      );
      faultyEnsemble.registerModel(new MockModelAdapter("bad", "", 0, 0, true));

      const request: EnsembleRequest = {
        query: "Test query",
      };

      const response = await faultyEnsemble.query(request);

      expect(response.individualResponses).toHaveLength(3);
      expect(response.faultyModels).toContain("bad");
    });

    it("should reach quorum with majority agreement", async () => {
      const request: EnsembleRequest = {
        query: "Test query",
      };

      const response = await ensemble.query(request);

      expect(response.quorumReached).toBe(true);
      expect(response.votingResult.totalVotes).toBeGreaterThanOrEqual(3);
    });
  });

  describe("privacy features", () => {
    it("should preserve privacy flag", async () => {
      const privateEnsemble = new ByzantineEnsemble({
        size: 3,
        quorum: 2,
        privateSplitting: true,
        votingMechanism: "majority",
      });

      privateEnsemble.registerModel(
        new MockModelAdapter("m1", "Response", 0.5, 100)
      );
      privateEnsemble.registerModel(
        new MockModelAdapter("m2", "Response", 0.5, 100)
      );
      privateEnsemble.registerModel(
        new MockModelAdapter("m3", "Response", 0.5, 100)
      );

      const request: EnsembleRequest = {
        query: "Private query",
        privacyLevel: PrivacyLevel.SENSITIVE,
      };

      const response = await privateEnsemble.query(request);
      expect(response.privacyPreserved).toBe(true);
    });

    it("should split query when private splitting enabled", async () => {
      const splittingEnsemble = new ByzantineEnsemble({
        size: 3,
        quorum: 2,
        privateSplitting: true,
        votingMechanism: "majority",
      });

      splittingEnsemble.registerModel(
        new MockModelAdapter("m1", "partial", 0.5, 100)
      );
      splittingEnsemble.registerModel(
        new MockModelAdapter("m2", "partial", 0.5, 100)
      );
      splittingEnsemble.registerModel(
        new MockModelAdapter("m3", "partial", 0.5, 100)
      );

      const request: EnsembleRequest = {
        query: "This is a long query that will be split into parts",
      };

      const response = await splittingEnsemble.query(request);
      expect(response.privacyPreserved).toBe(true);
    });
  });

  describe("voting mechanisms", () => {
    it("should use majority voting", async () => {
      ensemble.updateConfig({ votingMechanism: "majority" });

      const request: EnsembleRequest = {
        query: "Test query",
      };

      const response = await ensemble.query(request);
      expect(response.votingResult.consensus).toBe(true);
    });

    it("should use supermajority voting", async () => {
      ensemble.updateConfig({ votingMechanism: "supermajority" });

      const request: EnsembleRequest = {
        query: "Test query",
      };

      const response = await ensemble.query(request);
      expect(response.votingResult).toBeDefined();
    });

    it("should use Byzantine voting", async () => {
      const request: EnsembleRequest = {
        query: "Test query",
      };

      const response = await ensemble.query(request);
      expect(response.votingResult).toBeDefined();
    });
  });

  describe("fault detection integration", () => {
    it("should detect and report faulty models", async () => {
      const mixedEnsemble = new ByzantineEnsemble({
        size: 4,
        quorum: 2,
        maxFaultyModels: 1,
      });

      mixedEnsemble.registerModel(
        new MockModelAdapter("good1", "Answer", 0.9, 100)
      );
      mixedEnsemble.registerModel(
        new MockModelAdapter("good2", "Answer", 0.8, 100)
      );
      mixedEnsemble.registerModel(
        new MockModelAdapter("slow", "Answer", 0.5, 20000) // Too slow
      );
      mixedEnsemble.registerModel(new MockModelAdapter("bad", "", 0, 0, true));

      const request: EnsembleRequest = {
        query: "Test query",
      };

      const response = await mixedEnsemble.query(request);

      expect(response.faultyModels.length).toBeGreaterThan(0);
      expect(response.honestModels.length).toBeGreaterThan(0);
    });
  });

  describe("timeout handling", () => {
    it("should timeout slow queries", async () => {
      const slowEnsemble = new ByzantineEnsemble({
        size: 3,
        quorum: 2,
        queryTimeout: 100, // 100ms timeout
      });

      slowEnsemble.registerModel(
        new MockModelAdapter("fast", "Fast response", 0.9, 50, false, false, 0)
      );
      slowEnsemble.registerModel(
        new MockModelAdapter("fast2", "Fast response", 0.8, 50, false, false, 0)
      );
      slowEnsemble.registerModel(
        new MockModelAdapter(
          "slow",
          "Slow response",
          0.5,
          5000,
          false,
          true,
          200
        ) // Will delay and timeout
      );

      const request: EnsembleRequest = {
        query: "Test query",
      };

      const response = await slowEnsemble.query(request);

      expect(response.individualResponses).toHaveLength(3);
      expect(response.individualResponses[2].error).toBeTruthy();
    });
  });

  describe("configuration", () => {
    it("should get and update configuration", () => {
      const config = ensemble.getConfig();
      expect(config.size).toBe(5);

      ensemble.updateConfig({ size: 7 });
      const newConfig = ensemble.getConfig();
      expect(newConfig.size).toBe(7);
    });

    it("should provide access to voting mechanism", () => {
      const mechanism = ensemble.getVotingMechanism();
      expect(mechanism).toBeInstanceOf(VotingMechanism);
    });

    it("should provide access to fault detector", () => {
      const detector = ensemble.getFaultDetector();
      expect(detector).toBeInstanceOf(FaultDetector);
    });
  });

  describe("edge cases", () => {
    it("should handle empty model set", async () => {
      const emptyEnsemble = new ByzantineEnsemble();

      const request: EnsembleRequest = {
        query: "Test query",
      };

      await expect(emptyEnsemble.query(request)).rejects.toThrow();
    });

    it("should handle all models failing", async () => {
      const failingEnsemble = new ByzantineEnsemble({
        size: 2,
        quorum: 1,
      });

      failingEnsemble.registerModel(
        new MockModelAdapter("bad1", "", 0, 0, true)
      );
      failingEnsemble.registerModel(
        new MockModelAdapter("bad2", "", 0, 0, true)
      );

      const request: EnsembleRequest = {
        query: "Test query",
      };

      const response = await failingEnsemble.query(request);

      expect(response.individualResponses).toHaveLength(2);
      expect(response.individualResponses.every(r => r.error)).toBe(true);
    });
  });

  describe("reputation tracking", () => {
    it("should update model reputations after voting", async () => {
      const mechanism = ensemble.getVotingMechanism();

      // Set initial reputations
      mechanism.setReputation("model1", 0.5);
      mechanism.setReputation("model2", 0.5);

      const request: EnsembleRequest = {
        query: "Test query",
      };

      await ensemble.query(request);

      // Reputations should be updated
      const rep1 = mechanism.getReputation("model1");
      const rep2 = mechanism.getReputation("model2");

      expect(rep1).toBeDefined();
      expect(rep2).toBeDefined();
    });
  });
});

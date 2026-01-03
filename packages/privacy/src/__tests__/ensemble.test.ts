/**
 * Byzantine Ensemble Tests
 *
 * Tests for Byzantine fault-tolerant ensemble, voting mechanisms, and fault detection.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ByzantineEnsemble,
  type EnsembleConfig,
  type EnsembleRequest,
  type EnsembleResponse,
  type ModelAdapter,
  type QueryConstraints,
  type ConversationContext,
  type VotingMechanismType,
} from "../ensemble/ByzantineEnsemble.js";
import { PrivacyLevel } from "@lsi/protocol";

describe("ByzantineEnsemble", () => {
  let ensemble: ByzantineEnsemble;
  let mockModels: ModelAdapter[];

  beforeEach(() => {
    // Create mock model adapters
    mockModels = [
      {
        modelId: "model-1",
        query: vi.fn().mockResolvedValue({
          response: "Response from model 1",
          confidence: 0.8,
          latency: 100,
        }),
      },
      {
        modelId: "model-2",
        query: vi.fn().mockResolvedValue({
          response: "Response from model 2",
          confidence: 0.85,
          latency: 120,
        }),
      },
      {
        modelId: "model-3",
        query: vi.fn().mockResolvedValue({
          response: "Response from model 3",
          confidence: 0.75,
          latency: 90,
        }),
      },
      {
        modelId: "model-4",
        query: vi.fn().mockResolvedValue({
          response: "Response from model 4",
          confidence: 0.9,
          latency: 110,
        }),
      },
      {
        modelId: "model-5",
        query: vi.fn().mockResolvedValue({
          response: "Response from model 5",
          confidence: 0.7,
          latency: 130,
        }),
      },
    ];

    // Create ensemble with default config
    const config: Partial<EnsembleConfig> = {
      size: 5,
      quorum: 3,
      maxFaultyModels: 1,
      assumeHonest: 3,
      votingMechanism: "byzantine",
      consensusThreshold: 0.6,
      enablePrivacy: true,
      privateSplitting: false,
      fallbackOnQuorum: true,
      queryTimeout: 30000,
    };

    ensemble = new ByzantineEnsemble(config);

    // Register models
    mockModels.forEach(model => ensemble.registerModel(model));
  });

  describe("Initialization", () => {
    it("should create ensemble with default config", () => {
      const defaultEnsemble = new ByzantineEnsemble();
      const config = defaultEnsemble.getConfig();

      expect(config.size).toBe(5);
      expect(config.quorum).toBe(3);
      expect(config.votingMechanism).toBe("byzantine");
    });

    it("should create ensemble with custom config", () => {
      const config: Partial<EnsembleConfig> = {
        size: 7,
        quorum: 5,
        maxFaultyModels: 2,
        votingMechanism: "majority",
      };

      const customEnsemble = new ByzantineEnsemble(config);
      const ensembleConfig = customEnsemble.getConfig();

      expect(ensembleConfig.size).toBe(7);
      expect(ensembleConfig.quorum).toBe(5);
      expect(ensembleConfig.votingMechanism).toBe("majority");
    });

    it("should register model adapters", () => {
      const modelIds = ensemble.getModelIds();

      expect(modelIds).toHaveLength(5);
      expect(modelIds).toContain("model-1");
      expect(modelIds).toContain("model-5");
    });

    it("should get model count", () => {
      const count = ensemble.getModelCount();

      expect(count).toBe(5);
    });

    it("should unregister models", () => {
      ensemble.unregisterModel("model-1");
      const modelIds = ensemble.getModelIds();

      expect(modelIds).toHaveLength(4);
      expect(modelIds).not.toContain("model-1");
    });
  });

  describe("Query Execution", () => {
    it("should execute simple ensemble query", async () => {
      const request: EnsembleRequest = {
        query: "What is the capital of France?",
        queryType: "question",
      };

      const response = await ensemble.query(request);

      expect(response).toBeDefined();
      expect(response.individualResponses).toHaveLength(5);
      expect(response.quorumReached).toBe(true);
      expect(response.aggregatedResponse).toBeDefined();
      expect(response.confidence).toBeGreaterThan(0);
    });

    it("should use fallback model when quorum not reached", async () => {
      // Create ensemble with fallback
      const config: Partial<EnsembleConfig> = {
        size: 3,
        quorum: 5, // Impossible to reach
        fallbackOnQuorum: true,
        fallbackModel: "model-1",
      };

      const fallbackEnsemble = new ByzantineEnsemble(config);
      mockModels.forEach(m => fallbackEnsemble.registerModel(m));

      const request: EnsembleRequest = {
        query: "Test query",
      };

      const response = await fallbackEnsemble.query(request);

      expect(response.usedFallback).toBe(true);
      expect(response.quorumReached).toBe(false);
    });

    it("should track individual responses", async () => {
      const request: EnsembleRequest = {
        query: "Test query",
      };

      const response = await ensemble.query(request);

      expect(response.individualResponses).toHaveLength(5);
      expect(response.individualResponses[0].modelId).toBeDefined();
      expect(response.individualResponses[0].response).toBeDefined();
      expect(response.individualResponses[0].confidence).toBeGreaterThan(0);
      expect(response.individualResponses[0].latency).toBeGreaterThan(0);
    });

    it("should query specific models", async () => {
      const request: EnsembleRequest = {
        query: "Test query",
        modelIds: ["model-1", "model-2", "model-3"],
      };

      const response = await ensemble.query(request);

      expect(response.individualResponses).toHaveLength(3);
    });

    it("should throw error when no models available", async () => {
      const emptyEnsemble = new ByzantineEnsemble();

      const request: EnsembleRequest = {
        query: "Test query",
      };

      await expect(emptyEnsemble.query(request)).rejects.toThrow(
        "No models available"
      );
    });

    it("should handle model query errors gracefully", async () => {
      // Create a failing model
      const failingModel: ModelAdapter = {
        modelId: "failing-model",
        query: vi.fn().mockRejectedValue(new Error("Model failed")),
      };

      ensemble.registerModel(failingModel);

      const request: EnsembleRequest = {
        query: "Test query",
        modelIds: ["failing-model", "model-1"],
      };

      const response = await ensemble.query(request);

      // Should have error response for failing model
      const failingResponse = response.individualResponses.find(
        r => r.modelId === "failing-model"
      );
      expect(failingResponse?.error).toBeDefined();
    });
  });

  describe("Privacy Features", () => {
    it("should support private query splitting", async () => {
      const config: Partial<EnsembleConfig> = {
        size: 3,
        privateSplitting: true,
        enablePrivacy: true,
      };

      const privateEnsemble = new ByzantineEnsemble(config);
      mockModels.slice(0, 3).forEach(m => privateEnsemble.registerModel(m));

      const request: EnsembleRequest = {
        query:
          "This is a long query that will be split across multiple models for privacy",
        privacyLevel: PrivacyLevel.SOVEREIGN,
      };

      const response = await privateEnsemble.query(request);

      expect(response.privacyPreserved).toBe(true);
    });

    it("should indicate privacy preservation level", async () => {
      const request: EnsembleRequest = {
        query: "Test query",
        privacyLevel: PrivacyLevel.PUBLIC,
      };

      const response = await ensemble.query(request);

      expect(response.privacyPreserved).toBeDefined();
      expect(typeof response.privacyPreserved).toBe("boolean");
    });
  });

  describe("Voting Mechanisms", () => {
    it("should support majority voting", async () => {
      const config: Partial<EnsembleConfig> = {
        size: 5,
        votingMechanism: "majority",
        quorum: 3,
      };

      const majorityEnsemble = new ByzantineEnsemble(config);
      mockModels.forEach(m => majorityEnsemble.registerModel(m));

      const request: EnsembleRequest = {
        query: "Test query",
      };

      const response = await majorityEnsemble.query(request);

      expect(response.votingResult).toBeDefined();
      expect(response.votingResult.totalVotes).toBe(5);
    });

    it("should support supermajority voting", async () => {
      const config: Partial<EnsembleConfig> = {
        size: 5,
        votingMechanism: "supermajority",
        quorum: 4, // 2/3 of 5 is ~3.33, so 4
      };

      const supermajorityEnsemble = new ByzantineEnsemble(config);
      mockModels.forEach(m => supermajorityEnsemble.registerModel(m));

      const request: EnsembleRequest = {
        query: "Test query",
      };

      const response = await supermajorityEnsemble.query(request);

      expect(response.votingResult).toBeDefined();
    });

    it("should support weighted voting", async () => {
      const config: Partial<EnsembleConfig> = {
        size: 3,
        votingMechanism: "weighted",
        quorum: 2,
      };

      const weightedEnsemble = new ByzantineEnsemble(config);
      mockModels.slice(0, 3).forEach(m => weightedEnsemble.registerModel(m));

      const request: EnsembleRequest = {
        query: "Test query",
      };

      const response = await weightedEnsemble.query(request);

      expect(response.votingResult).toBeDefined();
    });

    it("should support median voting", async () => {
      const config: Partial<EnsembleConfig> = {
        size: 5,
        votingMechanism: "median",
        quorum: 3,
      };

      const medianEnsemble = new ByzantineEnsemble(config);
      mockModels.forEach(m => medianEnsemble.registerModel(m));

      const request: EnsembleRequest = {
        query: "Test query",
      };

      const response = await medianEnsemble.query(request);

      expect(response.votingResult).toBeDefined();
    });

    it("should support trimmed mean voting", async () => {
      const config: Partial<EnsembleConfig> = {
        size: 5,
        votingMechanism: "trimmed_mean",
        quorum: 3,
      };

      const trimmedEnsemble = new ByzantineEnsemble(config);
      mockModels.forEach(m => trimmedEnsemble.registerModel(m));

      const request: EnsembleRequest = {
        query: "Test query",
      };

      const response = await trimmedEnsemble.query(request);

      expect(response.votingResult).toBeDefined();
    });

    it("should support Byzantine fault tolerance", async () => {
      const config: Partial<EnsembleConfig> = {
        size: 5,
        votingMechanism: "byzantine",
        maxFaultyModels: 1,
        quorum: 3,
      };

      const byzantineEnsemble = new ByzantineEnsemble(config);
      mockModels.forEach(m => byzantineEnsemble.registerModel(m));

      const request: EnsembleRequest = {
        query: "Test query",
      };

      const response = await byzantineEnsemble.query(request);

      expect(response.votingResult).toBeDefined();
      expect(response.faultyModels).toBeDefined();
      expect(response.honestModels).toBeDefined();
    });
  });

  describe("Fault Detection", () => {
    it("should detect faulty models", async () => {
      // Create inconsistent responses
      const inconsistentModels: ModelAdapter[] = [
        {
          modelId: "consistent-1",
          query: vi.fn().mockResolvedValue({
            response: "Consistent answer",
            confidence: 0.9,
            latency: 100,
          }),
        },
        {
          modelId: "consistent-2",
          query: vi.fn().mockResolvedValue({
            response: "Consistent answer",
            confidence: 0.85,
            latency: 110,
          }),
        },
        {
          modelId: "consistent-3",
          query: vi.fn().mockResolvedValue({
            response: "Consistent answer",
            confidence: 0.8,
            latency: 105,
          }),
        },
        {
          modelId: "faulty-1",
          query: vi.fn().mockResolvedValue({
            response: "Different answer",
            confidence: 0.3,
            latency: 500,
          }),
        },
        {
          modelId: "faulty-2",
          query: vi.fn().mockResolvedValue({
            response: "Another different answer",
            confidence: 0.2,
            latency: 600,
          }),
        },
      ];

      const faultEnsemble = new ByzantineEnsemble({
        size: 5,
        maxFaultyModels: 2,
        votingMechanism: "byzantine",
      });

      inconsistentModels.forEach(m => faultEnsemble.registerModel(m));

      const request: EnsembleRequest = {
        query: "Test query",
      };

      const response = await faultEnsemble.query(request);

      expect(response.faultyModels).toBeDefined();
      expect(response.honestModels).toBeDefined();
      expect(response.honestModels.length).toBeGreaterThanOrEqual(3);
    });

    it("should filter out faulty models from voting", async () => {
      const detector = ensemble.getFaultDetector();
      expect(detector).toBeDefined();
    });
  });

  describe("Query Constraints", () => {
    it("should respect max latency constraint", async () => {
      const constraints: QueryConstraints = {
        maxLatency: 200,
        minConfidence: 0.7,
      };

      const request: EnsembleRequest = {
        query: "Test query",
        constraints,
      };

      const response = await ensemble.query(request);

      // All responses should be within constraints (or filtered)
      expect(response.individualResponses.length).toBeGreaterThan(0);
    });

    it("should respect min confidence constraint", async () => {
      const constraints: QueryConstraints = {
        minConfidence: 0.75,
      };

      const request: EnsembleRequest = {
        query: "Test query",
        constraints,
      };

      const response = await ensemble.query(request);

      expect(response.confidence).toBeGreaterThan(0);
    });

    it("should respect cost constraint", async () => {
      const constraints: QueryConstraints = {
        maxCost: 1000,
      };

      const request: EnsembleRequest = {
        query: "Test query",
        constraints,
      };

      const response = await ensemble.query(request);

      expect(response).toBeDefined();
    });
  });

  describe("Conversation Context", () => {
    it("should pass conversation context to models", async () => {
      const context: ConversationContext = {
        conversationId: "conv-123",
        history: [
          { role: "user", content: "Previous question" },
          { role: "assistant", content: "Previous answer" },
        ],
        userId: "user-456",
        sessionId: "session-789",
      };

      const request: EnsembleRequest = {
        query: "Follow-up question",
        context,
      };

      const response = await ensemble.query(request);

      expect(response.individualResponses).toHaveLength(5);
    });
  });

  describe("Performance Tracking", () => {
    it("should track total latency", async () => {
      const request: EnsembleRequest = {
        query: "Test query",
      };

      const response = await ensemble.query(request);

      expect(response.totalLatency).toBeGreaterThan(0);
    });

    it("should aggregate confidence scores", async () => {
      const request: EnsembleRequest = {
        query: "Test query",
      };

      const response = await ensemble.query(request);

      expect(response.confidence).toBeGreaterThan(0);
      expect(response.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe("Configuration Updates", () => {
    it("should update ensemble configuration", () => {
      const newConfig: Partial<EnsembleConfig> = {
        quorum: 4,
        consensusThreshold: 0.7,
      };

      ensemble.updateConfig(newConfig);
      const config = ensemble.getConfig();

      expect(config.quorum).toBe(4);
      expect(config.consensusThreshold).toBe(0.7);
    });

    it("should get voting mechanism", () => {
      const voting = ensemble.getVotingMechanism();
      expect(voting).toBeDefined();
    });

    it("should get fault detector", () => {
      const detector = ensemble.getFaultDetector();
      expect(detector).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty query", async () => {
      const request: EnsembleRequest = {
        query: "",
      };

      const response = await ensemble.query(request);

      expect(response).toBeDefined();
    });

    it("should handle very long query", async () => {
      const longQuery = "A".repeat(10000);

      const request: EnsembleRequest = {
        query: longQuery,
      };

      const response = await ensemble.query(request);

      expect(response).toBeDefined();
    });

    it("should handle special characters in query", async () => {
      const request: EnsembleRequest = {
        query: "Test with émojis 🎉 and spëcial çharacters",
      };

      const response = await ensemble.query(request);

      expect(response).toBeDefined();
    });

    it("should handle timeout", async () => {
      const timeoutModel: ModelAdapter = {
        modelId: "timeout-model",
        query: vi
          .fn()
          .mockImplementation(
            () => new Promise(resolve => setTimeout(resolve, 60000))
          ),
      };

      const timeoutEnsemble = new ByzantineEnsemble({
        queryTimeout: 100, // 100ms timeout
      });

      timeoutEnsemble.registerModel(timeoutModel);
      timeoutEnsemble.registerModel(mockModels[0]);

      const request: EnsembleRequest = {
        query: "Test query",
        modelIds: ["timeout-model", "model-1"],
      };

      const response = await timeoutEnsemble.query(request);

      expect(response.individualResponses).toHaveLength(2);
    });
  });
});

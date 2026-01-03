/**
 * Federated Client Tests
 *
 * Comprehensive tests for the federated learning client including:
 * - Client initialization and state management
 * - Local training and update generation
 * - Differential privacy mechanisms
 * - Gradient compression
 * - Communication with server
 *
 * @module federated.test
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  FederatedClient,
  SimpleLocalTrainer,
  type FederatedClientConfig,
} from "./FederatedClient.js";
import type { ClientPrivacyBudget } from "@lsi/protocol/federated";
import type {
  TrainRequest,
  UpdateAcknowledgment,
  RoundComplete,
} from "@lsi/protocol/federated";
import {
  NoiseMechanismType,
  CompressionMethod,
  AggregationStrategy,
} from "@lsi/protocol/federated";

describe("FederatedClient", () => {
  let client: FederatedClient;
  let trainer: SimpleLocalTrainer;
  let config: FederatedClientConfig;

  beforeEach(() => {
    trainer = new SimpleLocalTrainer(1000);

    config = {
      clientId: "test-client-1",
      serverUrl: "http://localhost:8080",
      trainer,
      maxRetries: 3,
      timeout: 30000,
      enableDP: false,
      enableCompression: false,
      compressionRatio: 0.5,
      clippingNorm: 1.0,
    };

    client = new FederatedClient(config);
  });

  describe("Initialization", () => {
    it("should initialize with correct state", () => {
      const state = client.getState();
      expect(state.clientId).toBe("test-client-1");
      expect(state.currentRound).toBe(0);
      expect(state.numExamples).toBe(1000);
      expect(state.status).toBe("idle");
    });

    it("should start and stop successfully", async () => {
      await client.start();
      let state = client.getState();
      expect(state.status).toBe("idle");

      await client.stop();
      state = client.getState();
      expect(state.status).toBe("idle");
    });
  });

  describe("Training Request Handling", () => {
    it("should accept training request", async () => {
      const request: TrainRequest = {
        type: "train_request",
        roundId: "round-1",
        roundNumber: 1,
        globalWeights: Array.from({ length: 100 }, () => Math.random()),
        modelVersion: "1.0.0",
        config: {
          rounds: 10,
          minClients: 2,
          maxClients: 10,
          clientFraction: 0.5,
          localEpochs: 1,
          localBatchSize: 32,
          learningRate: 0.01,
          aggregation: AggregationStrategy.FEDAVG,
          clientSelection: "random" as any,
        },
      };

      const response = await client.handleTrainRequest(request);

      expect(response.type).toBe("train_response");
      expect(response.clientId).toBe("test-client-1");
      expect(response.roundId).toBe("round-1");
      expect(response.accepted).toBe(true);
      expect(response.estimatedTime).toBeGreaterThan(0);
    });

    it("should estimate training time correctly", async () => {
      const request: TrainRequest = {
        type: "train_request",
        roundId: "round-1",
        roundNumber: 1,
        globalWeights: Array.from({ length: 100 }, () => Math.random()),
        modelVersion: "1.0.0",
        config: {
          rounds: 10,
          minClients: 2,
          maxClients: 10,
          clientFraction: 0.5,
          localEpochs: 5,
          localBatchSize: 32,
          learningRate: 0.01,
          aggregation: AggregationStrategy.FEDAVG,
          clientSelection: "random" as any,
        },
      };

      const response = await client.handleTrainRequest(request);
      expect(response.estimatedTime).toBeGreaterThan(0);
    });
  });

  describe("Local Training", () => {
    it("should perform local training and submit update", async () => {
      const request: TrainRequest = {
        type: "train_request",
        roundId: "round-1",
        roundNumber: 1,
        globalWeights: Array.from({ length: 100 }, () => Math.random()),
        modelVersion: "1.0.0",
        config: {
          rounds: 10,
          minClients: 2,
          maxClients: 10,
          clientFraction: 0.5,
          localEpochs: 1,
          localBatchSize: 32,
          learningRate: 0.01,
          aggregation: AggregationStrategy.FEDAVG,
          clientSelection: "random" as any,
        },
      };

      const submission = await client.trainAndSubmit(request);

      expect(submission.type).toBe("update_submission");
      expect(submission.clientId).toBe("test-client-1");
      expect(submission.roundId).toBe("round-1");
      expect(submission.update.weightDeltas).toBeDefined();
      expect(submission.update.weightDeltas.length).toBe(100);
      expect(submission.update.metrics.loss).toBeGreaterThan(0);
      expect(submission.update.metrics.accuracy).toBeGreaterThan(0);
      expect(submission.update.metrics.trainingTime).toBeGreaterThan(0);
    });

    it("should compute gradients correctly", async () => {
      const request: TrainRequest = {
        type: "train_request",
        roundId: "round-1",
        roundNumber: 1,
        globalWeights: Array.from({ length: 50 }, () => Math.random()),
        modelVersion: "1.0.0",
        config: {
          rounds: 10,
          minClients: 2,
          maxClients: 10,
          clientFraction: 0.5,
          localEpochs: 1,
          localBatchSize: 32,
          learningRate: 0.01,
          aggregation: AggregationStrategy.FEDAVG,
          clientSelection: "random" as any,
        },
      };

      const submission = await client.trainAndSubmit(request);

      expect(submission.update.gradients).toBeDefined();
      expect(submission.update.gradients?.length).toBe(50);
    });
  });

  describe("Differential Privacy", () => {
    it("should apply differential privacy when enabled", async () => {
      config.enableDP = true;
      client = new FederatedClient(config);

      const request: TrainRequest = {
        type: "train_request",
        roundId: "round-1",
        roundNumber: 1,
        globalWeights: Array.from({ length: 100 }, () => Math.random()),
        modelVersion: "1.0.0",
        config: {
          rounds: 10,
          minClients: 2,
          maxClients: 10,
          clientFraction: 0.5,
          localEpochs: 1,
          localBatchSize: 32,
          learningRate: 0.01,
          aggregation: AggregationStrategy.FEDAVG,
          clientSelection: "random" as any,
          privacy: {
            enableDP: true,
            epsilon: 1.0,
            delta: 1e-5,
            noiseMechanism: NoiseMechanismType.GAUSSIAN,
            clientLevelDP: true,
            enableSecureAggregation: false,
            compressionRatio: 1.0,
            clippingNorm: 1.0,
          },
        },
      };

      const submission = await client.trainAndSubmit(request);

      expect(submission.update.privacy).toBeDefined();
      expect(submission.update.privacy?.epsilonSpent).toBe(1.0);
      expect(submission.update.privacy?.clipped).toBe(true);
      expect(submission.update.privacy?.noiseMultiplier).toBeGreaterThan(0);
    });

    it("should clip gradients to max norm", async () => {
      config.enableDP = true;
      config.clippingNorm = 0.5;
      client = new FederatedClient(config);

      const request: TrainRequest = {
        type: "train_request",
        roundId: "round-1",
        roundNumber: 1,
        globalWeights: Array.from({ length: 100 }, () => Math.random()),
        modelVersion: "1.0.0",
        config: {
          rounds: 10,
          minClients: 2,
          maxClients: 10,
          clientFraction: 0.5,
          localEpochs: 1,
          localBatchSize: 32,
          learningRate: 0.01,
          aggregation: AggregationStrategy.FEDAVG,
          clientSelection: "random" as any,
          privacy: {
            enableDP: true,
            epsilon: 1.0,
            delta: 1e-5,
            noiseMechanism: NoiseMechanismType.GAUSSIAN,
            clientLevelDP: true,
            enableSecureAggregation: false,
            compressionRatio: 1.0,
            clippingNorm: 0.5,
          },
        },
      };

      const submission = await client.trainAndSubmit(request);

      expect(submission.update.privacy?.clipped).toBe(true);
      expect(submission.update.privacy?.clippingNorm).toBe(0.5);
    });

    it("should track privacy budget", async () => {
      const privacyBudget: ClientPrivacyBudget = {
        totalEpsilon: 10.0,
        totalDelta: 1e-4,
        epsilonSpent: 0,
        deltaSpent: 0,
        roundsParticipated: 0,
      };

      config.enableDP = true;
      config.privacyBudget = privacyBudget;
      client = new FederatedClient(config);

      const request: TrainRequest = {
        type: "train_request",
        roundId: "round-1",
        roundNumber: 1,
        globalWeights: Array.from({ length: 100 }, () => Math.random()),
        modelVersion: "1.0.0",
        config: {
          rounds: 10,
          minClients: 2,
          maxClients: 10,
          clientFraction: 0.5,
          localEpochs: 1,
          localBatchSize: 32,
          learningRate: 0.01,
          aggregation: AggregationStrategy.FEDAVG,
          clientSelection: "random" as any,
          privacy: {
            enableDP: true,
            epsilon: 1.0,
            delta: 1e-5,
            noiseMechanism: NoiseMechanismType.GAUSSIAN,
            clientLevelDP: true,
            enableSecureAggregation: false,
            compressionRatio: 1.0,
            clippingNorm: 1.0,
          },
        },
      };

      await client.trainAndSubmit(request);

      expect(privacyBudget.epsilonSpent).toBe(1.0);
      expect(privacyBudget.deltaSpent).toBe(1e-5);
      expect(privacyBudget.roundsParticipated).toBe(1);
    });
  });

  describe("Compression", () => {
    it("should apply top-k compression", async () => {
      config.enableCompression = true;
      config.compressionMethod = CompressionMethod.TOPK;
      config.compressionRatio = 0.1; // Keep top 10%
      client = new FederatedClient(config);

      const request: TrainRequest = {
        type: "train_request",
        roundId: "round-1",
        roundNumber: 1,
        globalWeights: Array.from({ length: 100 }, () => Math.random()),
        modelVersion: "1.0.0",
        config: {
          rounds: 10,
          minClients: 2,
          maxClients: 10,
          clientFraction: 0.5,
          localEpochs: 1,
          localBatchSize: 32,
          learningRate: 0.01,
          aggregation: AggregationStrategy.FEDAVG,
          clientSelection: "random" as any,
          communication: {
            maxMessageSize: 1024000,
            timeout: 10000,
            maxRetries: 3,
            enableCompression: true,
            compressionMethod: CompressionMethod.TOPK,
            compressionRatio: 0.1,
          },
        },
      };

      const submission = await client.trainAndSubmit(request);

      expect(submission.update.compression).toBeDefined();
      expect(submission.update.compression?.method).toBe(CompressionMethod.TOPK);
      expect(submission.update.compression?.ratio).toBe(0.1);
      expect(submission.update.compression?.sparsity).toBeCloseTo(0.9, 1);

      // Count non-zero elements
      const nonZeroCount = submission.update.weightDeltas.filter((v) => v !== 0).length;
      expect(nonZeroCount).toBeLessThanOrEqual(15); // Should be around 10% of 100
    });

    it("should apply random compression", async () => {
      config.enableCompression = true;
      config.compressionMethod = CompressionMethod.RANDOM;
      config.compressionRatio = 0.5;
      client = new FederatedClient(config);

      const request: TrainRequest = {
        type: "train_request",
        roundId: "round-1",
        roundNumber: 1,
        globalWeights: Array.from({ length: 100 }, () => Math.random()),
        modelVersion: "1.0.0",
        config: {
          rounds: 10,
          minClients: 2,
          maxClients: 10,
          clientFraction: 0.5,
          localEpochs: 1,
          localBatchSize: 32,
          learningRate: 0.01,
          aggregation: AggregationStrategy.FEDAVG,
          clientSelection: "random" as any,
          communication: {
            maxMessageSize: 1024000,
            timeout: 10000,
            maxRetries: 3,
            enableCompression: true,
            compressionMethod: CompressionMethod.RANDOM,
            compressionRatio: 0.5,
          },
        },
      };

      const submission = await client.trainAndSubmit(request);

      expect(submission.update.compression?.method).toBe(CompressionMethod.RANDOM);
      expect(submission.update.compression?.sparsity).toBeCloseTo(0.5, 1);
    });
  });

  describe("Server Communication", () => {
    it("should handle update acknowledgment", async () => {
      const ack: UpdateAcknowledgment = {
        type: "update_acknowledgment",
        clientId: "test-client-1",
        roundId: "round-1",
        received: true,
        accepted: true,
        contributionScore: 0.15,
      };

      const logSpy = vi.fn();
      config.onLog = logSpy;
      client = new FederatedClient(config);

      await client.handleUpdateAcknowledgment(ack);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("Update accepted"),
        "info"
      );

      const state = client.getState();
      expect(state.status).toBe("idle");
    });

    it("should handle rejection", async () => {
      const ack: UpdateAcknowledgment = {
        type: "update_acknowledgment",
        clientId: "test-client-1",
        roundId: "round-1",
        received: true,
        accepted: false,
        rejectionReason: "norm_too_large" as any,
      };

      const logSpy = vi.fn();
      config.onLog = logSpy;
      client = new FederatedClient(config);

      await client.handleUpdateAcknowledgment(ack);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("Update rejected"),
        "warn"
      );
    });

    it("should handle round complete notification", async () => {
      const notification: RoundComplete = {
        type: "round_complete",
        roundId: "round-1",
        roundNumber: 1,
        result: {
          roundId: "round-1",
          timestamp: Date.now(),
          numClients: 5,
          numClientsSelected: 5,
          aggregatedWeights: Array.from({ length: 100 }, () => Math.random()),
          globalWeights: Array.from({ length: 100 }, () => Math.random()),
          contributionScores: new Map(),
          metrics: {
            aggregationTime: 1000,
            avgCommunicationTime: 500,
            maxUpdateNorm: 1.0,
            minUpdateNorm: 0.1,
            avgUpdateNorm: 0.5,
            stdUpdateNorm: 0.2,
            numRejected: 0,
            numAccepted: 5,
          },
        },
        newGlobalWeights: Array.from({ length: 100 }, () => Math.random()),
        newModelVersion: "1.1.0",
        trainingComplete: false,
      };

      await client.handleRoundComplete(notification);

      const weights = client.getCurrentWeights();
      expect(weights).toEqual(notification.newGlobalWeights);
    });

    it("should update model version on round complete", async () => {
      const notification: RoundComplete = {
        type: "round_complete",
        roundId: "round-1",
        roundNumber: 1,
        result: {
          roundId: "round-1",
          timestamp: Date.now(),
          numClients: 5,
          numClientsSelected: 5,
          aggregatedWeights: Array.from({ length: 100 }, () => Math.random()),
          globalWeights: Array.from({ length: 100 }, () => Math.random()),
          contributionScores: new Map(),
          metrics: {
            aggregationTime: 1000,
            avgCommunicationTime: 500,
            maxUpdateNorm: 1.0,
            minUpdateNorm: 0.1,
            avgUpdateNorm: 0.5,
            stdUpdateNorm: 0.2,
            numRejected: 0,
            numAccepted: 5,
          },
        },
        newGlobalWeights: Array.from({ length: 100 }, () => Math.random()),
        newModelVersion: "2.0.0",
        trainingComplete: true,
      };

      await client.handleRoundComplete(notification);

      const state = client.getState();
      expect(state.modelVersion).toBe("2.0.0");
    });
  });

  describe("Statistics", () => {
    it("should update statistics after training", async () => {
      const request: TrainRequest = {
        type: "train_request",
        roundId: "round-1",
        roundNumber: 1,
        globalWeights: Array.from({ length: 100 }, () => Math.random()),
        modelVersion: "1.0.0",
        config: {
          rounds: 10,
          minClients: 2,
          maxClients: 10,
          clientFraction: 0.5,
          localEpochs: 1,
          localBatchSize: 32,
          learningRate: 0.01,
          aggregation: AggregationStrategy.FEDAVG,
          clientSelection: "random" as any,
        },
      };

      await client.trainAndSubmit(request);

      const state = client.getState();
      expect(state.statistics.totalRounds).toBe(1);
      expect(state.statistics.totalExamples).toBeGreaterThan(0);
      expect(state.statistics.avgTrainingTime).toBeGreaterThan(0);
      expect(state.statistics.avgLoss).toBeGreaterThan(0);
    });

    it("should track best accuracy", async () => {
      const request: TrainRequest = {
        type: "train_request",
        roundId: "round-1",
        roundNumber: 1,
        globalWeights: Array.from({ length: 100 }, () => Math.random()),
        modelVersion: "1.0.0",
        config: {
          rounds: 10,
          minClients: 2,
          maxClients: 10,
          clientFraction: 0.5,
          localEpochs: 1,
          localBatchSize: 32,
          learningRate: 0.01,
          aggregation: AggregationStrategy.FEDAVG,
          clientSelection: "random" as any,
        },
      };

      await client.trainAndSubmit(request);

      const state = client.getState();
      expect(state.statistics.bestAccuracy).toBeGreaterThan(0);
      expect(state.statistics.bestAccuracy).toBeLessThanOrEqual(1);
    });
  });

  describe("SimpleLocalTrainer", () => {
    it("should perform training", async () => {
      const trainer = new SimpleLocalTrainer(100);
      const weights = Array.from({ length: 50 }, () => Math.random());

      const result = await trainer.train(weights, {
        epochs: 1,
        batchSize: 32,
        learningRate: 0.01,
        computeGradients: true,
      });

      expect(result.updatedWeights).toBeDefined();
      expect(result.updatedWeights.length).toBe(50);
      expect(result.weightDeltas).toBeDefined();
      expect(result.gradients).toBeDefined();
      expect(result.metrics.loss).toBeGreaterThan(0);
      expect(result.metrics.accuracy).toBeGreaterThan(0);
    });

    it("should get number of examples", () => {
      const trainer = new SimpleLocalTrainer(500);
      expect(trainer.getNumExamples()).toBe(500);
    });

    it("should validate model", async () => {
      const trainer = new SimpleLocalTrainer(100);
      const weights = Array.from({ length: 50 }, () => Math.random());

      const result = await trainer.validate(weights);

      expect(result.valLoss).toBeGreaterThan(0);
      expect(result.valAccuracy).toBeGreaterThan(0);
    });
  });
});

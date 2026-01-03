/**
 * Federated Server Tests
 *
 * Comprehensive tests for the federated learning server including:
 * - Server initialization and state management
 * - Client registration and management
 * - Training round execution
 * - Update aggregation
 * - Client selection strategies
 *
 * @module federated.test
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  FederatedServer,
  SimpleClientConnection,
  type FederatedServerConfig,
} from "./FederatedServer.js";
import type {
  ServerStatus,
  RoundStatus,
} from "@lsi/protocol/federated";
import {
  FederatedConfig,
  AggregationStrategy,
  ClientSelectionStrategy,
  RobustAggregationMethod,
} from "@lsi/protocol/federated";

describe("FederatedServer", () => {
  let server: FederatedServer;
  let config: FederatedServerConfig;
  let initialWeights: number[];

  beforeEach(() => {
    initialWeights = Array.from({ length: 100 }, () => Math.random());

    config = {
      serverId: "test-server-1",
      config: {
        rounds: 3,
        minClients: 2,
        maxClients: 5,
        clientFraction: 0.5,
        localEpochs: 1,
        localBatchSize: 32,
        learningRate: 0.01,
        aggregation: AggregationStrategy.FEDAVG,
        clientSelection: ClientSelectionStrategy.RANDOM,
      },
      initialWeights,
      enableByzantineResilience: false,
      enableSecureAggregation: false,
      maxConcurrentClients: 10,
      roundTimeout: 30000,
    };

    server = new FederatedServer(config);
  });

  describe("Initialization", () => {
    it("should initialize with correct state", () => {
      const state = server.getState();
      expect(state.serverId).toBe("test-server-1");
      expect(state.currentRound).toBe(0);
      expect(state.totalRounds).toBe(3);
      expect(state.globalWeights).toEqual(initialWeights);
      expect(state.status).toBe(ServerStatus.IDLE);
      expect(state.history).toHaveLength(0);
    });

    it("should get initial model version", () => {
      const version = server.getModelVersion();
      expect(version).toBe("1.0.0");
    });

    it("should get initial global weights", () => {
      const weights = server.getGlobalWeights();
      expect(weights).toEqual(initialWeights);
      expect(weights).toHaveLength(100);
    });
  });

  describe("Client Management", () => {
    it("should register clients", () => {
      const client1 = new SimpleClientConnection("client-1", 1000);
      const client2 = new SimpleClientConnection("client-2", 1500);

      server.registerClient(client1);
      server.registerClient(client2);

      const state = server.getState();
      expect(state.clients.size).toBe(2);
      expect(state.clients.has("client-1")).toBe(true);
      expect(state.clients.has("client-2")).toBe(true);
    });

    it("should unregister clients", () => {
      const client1 = new SimpleClientConnection("client-1", 1000);
      server.registerClient(client1);
      server.unregisterClient("client-1");

      const state = server.getState();
      expect(state.clients.size).toBe(0);
      expect(state.clients.has("client-1")).toBe(false);
    });

    it("should handle multiple client connections", () => {
      const clients = Array.from({ length: 10 }, (_, i) => new SimpleClientConnection(`client-${i}`, 1000 + i * 100));

      clients.forEach((client) => server.registerClient(client));

      const state = server.getState();
      expect(state.clients.size).toBe(10);
    });
  });

  describe("Training Execution", () => {
    beforeEach(() => {
      // Register multiple clients
      const clients = Array.from({ length: 5 }, (_, i) => new SimpleClientConnection(`client-${i}`, 1000 + i * 100));
      clients.forEach((client) => server.registerClient(client));
    });

    it("should execute training rounds successfully", async () => {
      const result = await server.startTraining();

      expect(result.success).toBe(true);
      expect(result.roundsCompleted).toBe(3);
      expect(result.totalRounds).toBe(3);
      expect(result.finalWeights).toBeDefined();
      expect(result.finalWeights.length).toBe(100);
      expect(result.history).toHaveLength(3);
      expect(result.statistics.totalRoundsCompleted).toBe(3);
    });

    it("should update model version after each round", async () => {
      await server.startTraining();

      const history = server.getHistory();
      expect(history[0].modelVersionAfter).toBeDefined();
      expect(history[0].modelVersionAfter).not.toBe(history[0].modelVersionBefore);
    });

    it("should track round statistics", async () => {
      await server.startTraining();

      const history = server.getHistory();
      const round = history[0];

      expect(round.metrics.numClientsSelected).toBeGreaterThan(0);
      expect(round.metrics.numClientsParticipated).toBeGreaterThan(0);
      expect(round.metrics.duration).toBeGreaterThan(0);
      expect(round.metrics.aggregationTime).toBeGreaterThan(0);
    });

    it("should track server statistics", async () => {
      await server.startTraining();

      const stats = server.getState().statistics;
      expect(stats.totalRoundsCompleted).toBe(3);
      expect(stats.totalClientParticipations).toBeGreaterThan(0);
      expect(stats.avgClientsPerRound).toBeGreaterThan(0);
      expect(stats.totalCommunicationCost).toBeGreaterThan(0);
      expect(stats.avgRoundDuration).toBeGreaterThan(0);
    });
  });

  describe("Client Selection Strategies", () => {
    beforeEach(() => {
      const clients = Array.from({ length: 10 }, (_, i) => new SimpleClientConnection(`client-${i}`, 1000 + i * 100));
      clients.forEach((client) => server.registerClient(client));
    });

    it("should use random client selection", async () => {
      config.config.clientSelection = ClientSelectionStrategy.RANDOM;
      server = new FederatedServer(config);

      const clients = Array.from({ length: 10 }, (_, i) => new SimpleClientConnection(`client-${i}`, 1000 + i * 100));
      clients.forEach((client) => server.registerClient(client));

      const result = await server.startTraining();
      expect(result.success).toBe(true);
    });

    it("should use weighted client selection", async () => {
      config.config.clientSelection = ClientSelectionStrategy.WEIGHTED;
      server = new FederatedServer(config);

      const clients = Array.from({ length: 10 }, (_, i) => new SimpleClientConnection(`client-${i}`, 1000 + i * 100));
      clients.forEach((client) => server.registerClient(client));

      const result = await server.startTraining();
      expect(result.success).toBe(true);
    });

    it("should use cyclic client selection", async () => {
      config.config.clientSelection = ClientSelectionStrategy.CYCLIC;
      server = new FederatedServer(config);

      const clients = Array.from({ length: 10 }, (_, i) => new SimpleClientConnection(`client-${i}`, 1000 + i * 100));
      clients.forEach((client) => server.registerClient(server));

      const result = await server.startTraining();
      expect(result.success).toBe(true);
    });
  });

  describe("Aggregation Strategies", () => {
    beforeEach(() => {
      const clients = Array.from({ length: 5 }, (_, i) => new SimpleClientConnection(`client-${i}`, 1000 + i * 100));
      clients.forEach((client) => server.registerClient(client));
    });

    it("should use FedAvg aggregation", async () => {
      config.config.aggregation = AggregationStrategy.FEDAVG;
      server = new FederatedServer(config);

      const result = await server.startTraining();
      expect(result.success).toBe(true);
    });

    it("should use FedAvgM aggregation", async () => {
      config.config.aggregation = AggregationStrategy.FEDAVGM;
      server = new FederatedServer(config);

      const result = await server.startTraining();
      expect(result.success).toBe(true);
    });

    it("should use FedProx aggregation", async () => {
      config.config.aggregation = AggregationStrategy.FEDPROX;
      server = new FederatedServer(config);

      const result = await server.startTraining();
      expect(result.success).toBe(true);
    });
  });

  describe("Byzantine Resilience", () => {
    beforeEach(() => {
      const clients = Array.from({ length: 5 }, (_, i) => new SimpleClientConnection(`client-${i}`, 1000 + i * 100));
      clients.forEach((client) => server.registerClient(client));
    });

    it("should enable Byzantine resilience", async () => {
      config.enableByzantineResilience = true;
      config.config = {
        ...config.config,
        validation: {
          enableByzantineResilience: true,
          maxUpdateNorm: 10.0,
          minUpdateNorm: 0.001,
          outlierStdDevThreshold: 3.0,
          robustMethod: RobustAggregationMethod.TRIMMED_MEAN,
          enableSimilarityCheck: false,
          minCosineSimilarity: 0.8,
        },
      };
      server = new FederatedServer(config);

      const clients = Array.from({ length: 5 }, (_, i) => new SimpleClientConnection(`client-${i}`, 1000 + i * 100));
      clients.forEach((client) => server.registerClient(client));

      const result = await server.startTraining();
      expect(result.success).toBe(true);
    });

    it("should use robust aggregation methods", async () => {
      config.config.aggregation = AggregationStrategy.ROBUST;
      config.config = {
        ...config.config,
        validation: {
          enableByzantineResilience: true,
          maxUpdateNorm: 10.0,
          minUpdateNorm: 0.001,
          outlierStdDevThreshold: 3.0,
          robustMethod: RobustAggregationMethod.TRIMMED_MEAN,
          enableSimilarityCheck: true,
          minCosineSimilarity: 0.7,
        },
      };
      server = new FederatedServer(config);

      const clients = Array.from({ length: 5 }, (_, i) => new SimpleClientConnection(`client-${i}`, 1000 + i * 100));
      clients.forEach((client) => server.registerClient(client));

      const result = await server.startTraining();
      expect(result.success).toBe(true);
    });
  });

  describe("Differential Privacy", () => {
    beforeEach(() => {
      const clients = Array.from({ length: 5 }, (_, i) => new SimpleClientConnection(`client-${i}`, 1000 + i * 100));
      clients.forEach((client) => server.registerClient(client));
    });

    it("should track privacy budget", async () => {
      config.config = {
        ...config.config,
        privacy: {
          enableDP: true,
          epsilon: 1.0,
          delta: 1e-5,
          noiseMechanism: "gaussian" as any,
          clientLevelDP: true,
          enableSecureAggregation: false,
          compressionRatio: 1.0,
          clippingNorm: 1.0,
        },
      };
      server = new FederatedServer(config);

      const clients = Array.from({ length: 5 }, (_, i) => new SimpleClientConnection(`client-${i}`, 1000 + i * 100));
      clients.forEach((client) => server.registerClient(client));

      const result = await server.startTraining();

      expect(result.privacyConsumed).toBeDefined();
      expect(result.privacyConsumed.epsilonSpent).toBeGreaterThan(0);
      expect(result.privacyConsumed.deltaSpent).toBeGreaterThan(0);
      expect(result.privacyConsumed.epsilonRemaining).toBeLessThan(10.0);
    });
  });

  describe("Error Handling", () => {
    it("should fail with insufficient clients", async () => {
      const client1 = new SimpleClientConnection("client-1", 1000);
      server.registerClient(client1);

      const result = await server.startTraining();

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain("Not enough clients");
    });

    it("should handle training timeout", async () => {
      config.roundTimeout = 100; // Very short timeout
      server = new FederatedServer(config);

      const clients = Array.from({ length: 5 }, (_, i) => new SimpleClientConnection(`client-${i}`, 1000 + i * 100));
      clients.forEach((client) => server.registerClient(client));

      // Training should still succeed because SimpleClientConnection responds quickly
      const result = await server.startTraining();
      expect(result.success).toBe(true);
    });
  });

  describe("Progress Tracking", () => {
    it("should call progress callback", async () => {
      const progressSpy = vi.fn();
      config.onProgress = progressSpy;
      server = new FederatedServer(config);

      const clients = Array.from({ length: 5 }, (_, i) => new SimpleClientConnection(`client-${i}`, 1000 + i * 100));
      clients.forEach((client) => server.registerClient(client));

      await server.startTraining();

      expect(progressSpy).toHaveBeenCalledTimes(3);
      expect(progressSpy).toHaveBeenCalledWith(1, 3);
      expect(progressSpy).toHaveBeenCalledWith(2, 3);
      expect(progressSpy).toHaveBeenCalledWith(3, 3);
    });
  });

  describe("Logging", () => {
    it("should log server events", async () => {
      const logSpy = vi.fn();
      config.onLog = logSpy;
      server = new FederatedServer(config);

      const clients = Array.from({ length: 5 }, (_, i) => new SimpleClientConnection(`client-${i}`, 1000 + i * 100));
      clients.forEach((client) => server.registerClient(client));

      await server.startTraining();

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("Starting federated training"),
        "info"
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("Round 1 completed"),
        "info"
      );
    });
  });

  describe("Training History", () => {
    beforeEach(() => {
      const clients = Array.from({ length: 5 }, (_, i) => new SimpleClientConnection(`client-${i}`, 1000 + i * 100));
      clients.forEach((client) => server.registerClient(client));
    });

    it("should maintain training history", async () => {
      await server.startTraining();

      const history = server.getHistory();
      expect(history).toHaveLength(3);

      history.forEach((round, i) => {
        expect(round.roundNumber).toBe(i + 1);
        expect(round.status).toBe(RoundStatus.COMPLETED);
        expect(round.selectedClients).toBeDefined();
        expect(round.participatingClients).toBeDefined();
        expect(round.updates).toBeDefined();
        expect(round.result).toBeDefined();
      });
    });

    it("should preserve round metadata", async () => {
      await server.startTraining();

      const history = server.getHistory();
      const round = history[0];

      expect(round.roundId).toBeDefined();
      expect(round.startTime).toBeGreaterThan(0);
      expect(round.endTime).toBeGreaterThan(round.startTime);
      expect(round.config).toBeDefined();
    });
  });

  describe("Stop Training", () => {
    it("should stop training in progress", async () => {
      const clients = Array.from({ length: 5 }, (_, i) => new SimpleClientConnection(`client-${i}`, 1000 + i * 100));
      clients.forEach((client) => server.registerClient(client));

      // Start training (but don't await)
      const trainingPromise = server.startTraining();

      // Stop immediately
      await server.stopTraining();

      const state = server.getState();
      expect(state.status).toBe(ServerStatus.STOPPED);
    });
  });

  describe("Model Updates", () => {
    beforeEach(() => {
      const clients = Array.from({ length: 5 }, (_, i) => new SimpleClientConnection(`client-${i}`, 1000 + i * 100));
      clients.forEach((client) => server.registerClient(client));
    });

    it("should update global weights after aggregation", async () => {
      const initialWeights = server.getGlobalWeights();
      await server.startTraining();
      const finalWeights = server.getGlobalWeights();

      // Weights should have changed
      expect(finalWeights).not.toEqual(initialWeights);
    });

    it("should update model version after each round", async () => {
      const initialVersion = server.getModelVersion();
      await server.startTraining();
      const finalVersion = server.getModelVersion();

      expect(finalVersion).not.toBe(initialVersion);
    });
  });
});

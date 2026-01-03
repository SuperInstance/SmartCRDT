/**
 * Federated Learning Server
 *
 * Implements server-side federated learning logic including:
 * - Training round coordination
 * - Client selection and management
 * - Update aggregation (FedAvg, FedAvgM, FedProx)
 * - Byzantine resilience and validation
 * - Privacy budget tracking
 * - Model distribution and update collection
 *
 * @module federated
 */

import type {
  FederatedServerState,
  FederatedRound,
  ModelUpdate,
  AggregationResult,
  TrainRequest,
  TrainResponse,
  UpdateSubmission,
  UpdateAcknowledgment,
  RoundComplete,
  FederatedTrainingResult,
  PrivacyConsumption,
  FederatedClientState,
} from "@lsi/protocol";
import {
  FederatedConfig,
  RoundStatus,
  ServerStatus,
  AggregationStrategy,
  ClientSelectionStrategy,
  RejectionReason,
  ClientStatus,
  RobustAggregationMethod,
} from "@lsi/protocol";
import { FederatedAggregator } from "./AggregationStrategy.js";

// ============================================================================
// SERVER CONFIGURATION
// ============================================================================

/**
 * Federated server configuration
 */
export interface FederatedServerConfig {
  /** Unique server identifier */
  serverId: string;
  /** Federated learning configuration */
  config: FederatedConfig;
  /** Initial model weights */
  initialWeights: number[];
  /** Weight structure information (for reshaping) */
  weightStructure?: number[][];
  /** Enable Byzantine resilience */
  enableByzantineResilience: boolean;
  /** Secure aggregation configuration */
  enableSecureAggregation: boolean;
  /** Maximum concurrent clients */
  maxConcurrentClients: number;
  /** Round timeout in milliseconds */
  roundTimeout: number;
  /** Logging callback */
  onLog?: (message: string, level: "info" | "warn" | "error") => void;
  /** Progress callback */
  onProgress?: (round: number, totalRounds: number) => void;
}

// ============================================================================
// CLIENT CONNECTION INTERFACE
// ============================================================================

/**
 * Client connection interface
 *
 * Represents a connection to a federated client.
 */
export interface IClientConnection {
  /** Client ID */
  clientId: string;
  /** Send training request to client */
  sendTrainRequest(request: TrainRequest): Promise<TrainResponse>;
  /** Receive update from client */
  receiveUpdate(): Promise<UpdateSubmission>;
  /** Send acknowledgment to client */
  sendAcknowledgment(ack: UpdateAcknowledgment): Promise<void>;
  /** Send round complete notification */
  sendRoundComplete(notification: RoundComplete): Promise<void>;
  /** Check if client is available */
  isAvailable(): boolean;
  /** Get client state */
  getClientState(): FederatedClientState;
}

// ============================================================================
// MAIN SERVER CLASS
// ============================================================================

/**
 * Federated Learning Server
 *
 * Orchestrates federated training rounds, manages client connections,
 * aggregates model updates, and maintains the global model.
 */
export class FederatedServer {
  private config: FederatedServerConfig;
  private state: FederatedServerState;
  private aggregator: FederatedAggregator;
  private clients: Map<string, IClientConnection>;
  private pendingRounds: Map<string, FederatedRound>;
  private momentumBuffer: number[] | null;

  constructor(config: FederatedServerConfig) {
    this.config = config;
    this.clients = new Map();
    this.pendingRounds = new Map();
    this.momentumBuffer = null;

    // Initialize aggregator
    this.aggregator = new FederatedAggregator({
      strategy: config.config.aggregation,
      enableByzantineResilience: config.enableByzantineResilience,
      robustMethod: config.config.validation?.robustMethod,
      maxUpdateNorm: config.config.validation?.maxUpdateNorm || 10.0,
      minUpdateNorm: config.config.validation?.minUpdateNorm || 0.001,
      outlierStdDevThreshold: config.config.validation?.outlierStdDevThreshold || 3.0,
    });

    // Initialize server state
    this.state = {
      serverId: config.serverId,
      currentRound: 0,
      totalRounds: config.config.rounds,
      globalWeights: config.initialWeights,
      modelVersion: "1.0.0",
      clients: new Map(),
      history: [],
      status: ServerStatus.IDLE,
      config: config.config,
      privacyBudget: config.config.privacy?.enableDP
        ? {
            totalEpsilon: config.config.privacy.epsilon || 10.0,
            totalDelta: config.config.privacy.delta || 1e-5,
            epsilonSpent: 0,
            deltaSpent: 0,
            roundsCompleted: 0,
            epsilonPerRound: config.config.privacy.epsilon || 1.0,
            deltaPerRound: config.config.privacy.delta || 1e-5,
          }
        : undefined,
      statistics: {
        totalRoundsCompleted: 0,
        totalClientParticipations: 0,
        avgClientsPerRound: 0,
        totalCommunicationCost: 0,
        avgRoundDuration: 0,
        totalTrainingTime: 0,
      },
    };

    this.log("Federated server initialized", "info");
  }

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  /**
   * Register a client connection
   *
   * @param connection - Client connection
   */
  registerClient(connection: IClientConnection): void {
    const clientId = connection.clientId;
    this.clients.set(clientId, connection);
    const clientState = connection.getClientState();
    this.state.clients.set(clientId, clientState);
    this.log(`Registered client: ${clientId}`, "info");
  }

  /**
   * Unregister a client connection
   *
   * @param clientId - Client ID
   */
  unregisterClient(clientId: string): void {
    this.clients.delete(clientId);
    this.state.clients.delete(clientId);
    this.log(`Unregistered client: ${clientId}`, "info");
  }

  /**
   * Start federated training
   *
   * @returns Training result
   */
  async startTraining(): Promise<FederatedTrainingResult> {
    this.log("Starting federated training", "info");
    this.state.status = ServerStatus.RUNNING;

    const startTime = Date.now();

    try {
      for (let round = 1; round <= this.config.config.rounds; round++) {
        this.state.currentRound = round;

        // Notify progress
        if (this.config.onProgress) {
          this.config.onProgress(round, this.config.config.rounds);
        }

        // Execute training round
        const roundResult = await this.executeRound(round);

        if (!roundResult.success) {
          this.log(`Round ${round} failed: ${roundResult.errorMessage}`, "error");
          return {
            success: false,
            roundsCompleted: round - 1,
            totalRounds: this.config.config.rounds,
            finalWeights: this.state.globalWeights,
            finalModelVersion: this.state.modelVersion,
            history: this.state.history,
            statistics: this.state.statistics,
            privacyConsumed: this.getPrivacyConsumption(),
            trainingDuration: Date.now() - startTime,
            finalLoss: 0,
            errorMessage: roundResult.errorMessage,
          };
        }

        this.log(`Round ${round} completed successfully`, "info");
      }

      // Training completed successfully
      this.state.status = ServerStatus.IDLE;
      this.log("Federated training completed successfully!", "info");

      return {
        success: true,
        roundsCompleted: this.config.config.rounds,
        totalRounds: this.config.config.rounds,
        finalWeights: this.state.globalWeights,
        finalModelVersion: this.state.modelVersion,
        history: this.state.history,
        statistics: this.state.statistics,
        privacyConsumed: this.getPrivacyConsumption(),
        trainingDuration: Date.now() - startTime,
        finalLoss: this.state.history[this.state.history.length - 1]?.metrics.loss || 0,
        finalAccuracy: this.state.history[this.state.history.length - 1]?.metrics.accuracy,
      };
    } catch (error) {
      this.state.status = ServerStatus.ERROR;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`Training failed: ${errorMessage}`, "error");

      return {
        success: false,
        roundsCompleted: this.state.currentRound,
        totalRounds: this.config.config.rounds,
        finalWeights: this.state.globalWeights,
        finalModelVersion: this.state.modelVersion,
        history: this.state.history,
        statistics: this.state.statistics,
        privacyConsumed: this.getPrivacyConsumption(),
        trainingDuration: Date.now() - startTime,
        finalLoss: 0,
        errorMessage,
      };
    }
  }

  /**
   * Stop federated training
   */
  async stopTraining(): Promise<void> {
    this.log("Stopping federated training", "info");
    this.state.status = ServerStatus.STOPPED;
  }

  /**
   * Get current server state
   */
  getState(): FederatedServerState {
    return { ...this.state };
  }

  /**
   * Get current global model weights
   */
  getGlobalWeights(): number[] {
    return [...this.state.globalWeights];
  }

  /**
   * Get model version
   */
  getModelVersion(): string {
    return this.state.modelVersion;
  }

  /**
   * Get training history
   */
  getHistory(): FederatedRound[] {
    return [...this.state.history];
  }

  // ========================================================================
  // ROUND EXECUTION
  // ========================================================================

  /**
   * Execute a single training round
   */
  private async executeRound(roundNumber: number): Promise<{ success: boolean; errorMessage?: string }> {
    const roundId = `round-${roundNumber}-${Date.now()}`;
    const startTime = Date.now();

    this.log(`Executing round ${roundNumber}`, "info");

    // Create round object
    const round: FederatedRound = {
      roundId,
      roundNumber,
      startTime,
      endTime: 0,
      status: RoundStatus.IN_PROGRESS,
      selectedClients: [],
      participatingClients: [],
      updates: [],
      config: this.config.config,
      modelVersionBefore: this.state.modelVersion,
      metrics: {
        numClientsSelected: 0,
        numClientsParticipated: 0,
        totalExamples: 0,
        duration: 0,
        avgClientTrainingTime: 0,
        avgCommunicationTime: 0,
        aggregationTime: 0,
        communicationCost: 0,
        loss: 0,
      },
    };

    this.pendingRounds.set(roundId, round);

    try {
      // Step 1: Select clients
      const selectedClients = await this.selectClients(roundId);
      if (selectedClients.length < this.config.config.minClients) {
        return {
          success: false,
          errorMessage: `Not enough clients available: ${selectedClients.length} < ${this.config.config.minClients}`,
        };
      }

      round.selectedClients = selectedClients;
      round.metrics.numClientsSelected = selectedClients.length;

      this.log(`Selected ${selectedClients.length} clients for round ${roundNumber}`, "info");

      // Step 2: Send training requests and collect updates
      const updates = await this.collectUpdates(roundId, selectedClients);
      round.participatingClients = updates.map((u) => u.clientId);
      round.updates = updates;
      round.metrics.numClientsParticipated = updates.length;

      if (updates.length < this.config.config.minClients) {
        return {
          success: false,
          errorMessage: `Not enough clients participated: ${updates.length} < ${this.config.config.minClients}`,
        };
      }

      this.log(`Received updates from ${updates.length} clients`, "info");

      // Step 3: Aggregate updates
      this.state.status = ServerStatus.AGGREGATING;
      const aggregationStartTime = Date.now();

      const globalWeights = Array.isArray(this.state.globalWeights)
        ? this.state.globalWeights
        : Array.from(this.state.globalWeights);

      const aggregationResult = await this.aggregator.aggregate(
        updates,
        globalWeights,
        roundId
      );

      round.metrics.aggregationTime = Date.now() - aggregationStartTime;
      round.result = aggregationResult;

      // Step 4: Update global model
      await this.updateGlobalModel(aggregationResult, round);

      // Step 5: Send round complete notifications
      await this.sendRoundCompleteNotifications(round, aggregationResult);

      // Update round status
      round.endTime = Date.now();
      round.status = RoundStatus.COMPLETED;
      round.metrics.duration = round.endTime - startTime;

      // Update statistics
      this.updateStatistics(round, aggregationResult);

      // Add to history
      this.state.history.push(round);
      this.pendingRounds.delete(roundId);

      // Update model version
      this.state.modelVersion = `${roundNumber}.${Date.now()}`;

      this.state.status = ServerStatus.IDLE;

      return { success: true };
    } catch (error) {
      round.endTime = Date.now();
      round.status = RoundStatus.FAILED;
      this.pendingRounds.delete(roundId);

      throw error;
    }
  }

  /**
   * Select clients for training round
   */
  private async selectClients(roundId: string): Promise<string[]> {
    const availableClients = Array.from(this.clients.entries()).filter(([_, conn]) => conn.isAvailable());

    if (availableClients.length === 0) {
      return [];
    }

    const numClients = Math.min(
      this.config.config.maxClients,
      Math.floor(availableClients.length * this.config.config.clientFraction)
    );

    const selectedIds: string[] = [];

    switch (this.config.config.clientSelection) {
      case ClientSelectionStrategy.RANDOM:
        // Random sampling
        const shuffled = availableClients.sort(() => Math.random() - 0.5);
        selectedIds.push(...shuffled.slice(0, numClients).map(([id]) => id));
        break;

      case ClientSelectionStrategy.WEIGHTED:
        // Weighted by number of examples
        const weighted = availableClients
          .map(([id, conn]) => ({
            id,
            weight: conn.getClientState().numExamples,
          }))
          .sort((a, b) => b.weight - a.weight);
        selectedIds.push(...weighted.slice(0, numClients).map((w) => w.id));
        break;

      case ClientSelectionStrategy.CYCLIC:
        // Cyclic selection based on client ID
        const sorted = availableClients.map(([id]) => id).sort();
        const startIdx = (this.state.currentRound - 1) % sorted.length;
        for (let i = 0; i < numClients; i++) {
          selectedIds.push(sorted[(startIdx + i) % sorted.length]);
        }
        break;

      case ClientSelectionStrategy.TEMPORAL:
        // Prefer clients with recent updates
        const temporal = availableClients
          .map(([id, conn]) => ({
            id,
            lastUpdate: conn.getClientState().lastUpdateTimestamp,
          }))
          .sort((a, b) => b.lastUpdate - a.lastUpdate);
        selectedIds.push(...temporal.slice(0, numClients).map((t) => t.id));
        break;

      default:
        // Default to random
        const shuffled2 = availableClients.sort(() => Math.random() - 0.5);
        selectedIds.push(...shuffled2.slice(0, numClients).map(([id]) => id));
    }

    return selectedIds;
  }

  /**
   * Collect updates from selected clients
   */
  private async collectUpdates(roundId: string, selectedClients: string[]): Promise<ModelUpdate[]> {
    const updates: ModelUpdate[] = [];
    const promises: Promise<void>[] = [];

    // Create training request
    const trainRequest: TrainRequest = {
      type: "train_request",
      roundId,
      roundNumber: this.state.currentRound,
      globalWeights: this.state.globalWeights,
      modelVersion: this.state.modelVersion,
      config: this.config.config,
    };

    // Send training requests to all selected clients
    for (const clientId of selectedClients) {
      const connection = this.clients.get(clientId);
      if (!connection) continue;

      promises.push(
        (async () => {
          try {
            // Send training request
            const response = await connection.sendTrainRequest(trainRequest);

            if (!response.accepted) {
              this.log(`Client ${clientId} declined training: ${response.rejectionReason}`, "warn");
              return;
            }

            // Wait for update (with timeout)
            const updatePromise = connection.receiveUpdate();
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Timeout")), this.config.roundTimeout)
            );

            const update = await Promise.race([updatePromise, timeoutPromise]);

            if (update.roundId === roundId) {
              updates.push(update.update);
              this.log(`Received update from client ${clientId}`, "info");
            }
          } catch (error) {
            this.log(`Failed to collect update from ${clientId}: ${error}`, "warn");
          }
        })()
      );
    }

    await Promise.all(promises);
    return updates;
  }

  /**
   * Update global model with aggregated weights
   */
  private async updateGlobalModel(result: AggregationResult, round: FederatedRound): Promise<void> {
    // Update global weights
    this.state.globalWeights = result.globalWeights as number[];

    // Update round metrics
    round.metrics.loss = result.metrics.convergenceMetric || 0;
    round.metrics.totalExamples = result.numClients * this.config.config.localBatchSize * this.config.config.localEpochs;
    round.metrics.communicationCost = result.metrics.aggregationTime * result.numClients;

    // Update momentum buffer for FedAvgM
    if (this.config.config.aggregation === AggregationStrategy.FEDAVGM) {
      if (this.momentumBuffer === null) {
        this.momentumBuffer = [...result.aggregatedWeights];
      } else {
        const momentum = 0.9; // Default momentum
        for (let i = 0; i < this.momentumBuffer.length; i++) {
          this.momentumBuffer[i] = momentum * this.momentumBuffer[i] + (1 - momentum) * result.aggregatedWeights[i];
        }
      }
    }

    this.log(`Global model updated (version: ${this.state.modelVersion})`, "info");
  }

  /**
   * Send round complete notifications to clients
   */
  private async sendRoundCompleteNotifications(
    round: FederatedRound,
    result: AggregationResult
  ): Promise<void> {
    const notification: RoundComplete = {
      type: "round_complete",
      roundId: round.roundId,
      roundNumber: round.roundNumber,
      result,
      newGlobalWeights: this.state.globalWeights,
      newModelVersion: this.state.modelVersion,
      trainingComplete: round.roundNumber >= this.config.config.rounds,
    };

    const promises = round.participatingClients.map(async (clientId: string) => {
      const connection = this.clients.get(clientId);
      if (connection) {
        try {
          await connection.sendRoundComplete(notification);
        } catch (error) {
          this.log(`Failed to send round complete to ${clientId}: ${error}`, "warn");
        }
      }
    });

    await Promise.all(promises);
  }

  /**
   * Update server statistics
   */
  private updateStatistics(round: FederatedRound, result: AggregationResult): void {
    const stats = this.state.statistics;

    stats.totalRoundsCompleted += 1;
    stats.totalClientParticipations += round.metrics.numClientsParticipated;
    stats.avgClientsPerRound =
      (stats.avgClientsPerRound * (stats.totalRoundsCompleted - 1) +
        round.metrics.numClientsParticipated) /
      stats.totalRoundsCompleted;
    stats.totalCommunicationCost += round.metrics.communicationCost;
    stats.avgRoundDuration =
      (stats.avgRoundDuration * (stats.totalRoundsCompleted - 1) + round.metrics.duration) /
      stats.totalRoundsCompleted;

    if (round.metrics.accuracy !== undefined) {
      if (stats.bestValAccuracy === undefined || round.metrics.accuracy > stats.bestValAccuracy) {
        stats.bestValAccuracy = round.metrics.accuracy;
      }
    }

    if (round.metrics.valLoss !== undefined) {
      if (stats.bestValLoss === undefined || round.metrics.valLoss < stats.bestValLoss) {
        stats.bestValLoss = round.metrics.valLoss;
      }
    }

    stats.finalLoss = round.metrics.loss;
    stats.totalTrainingTime = (stats.totalTrainingTime || 0) + round.metrics.duration;

    // Update privacy budget
    if (this.state.privacyBudget && result.privacyConsumed) {
      this.state.privacyBudget.epsilonSpent += result.privacyConsumed.epsilonSpent;
      this.state.privacyBudget.deltaSpent += result.privacyConsumed.deltaSpent;
      this.state.privacyBudget.roundsCompleted += 1;
    }
  }

  /**
   * Get privacy consumption
   */
  private getPrivacyConsumption(): PrivacyConsumption {
    if (!this.state.privacyBudget) {
      return {
        epsilonSpent: 0,
        deltaSpent: 0,
        cumulativeEpsilon: 0,
        cumulativeDelta: 0,
        epsilonRemaining: 0,
        deltaRemaining: 0,
      };
    }

    return {
      epsilonSpent: this.state.privacyBudget.epsilonSpent,
      deltaSpent: this.state.privacyBudget.deltaSpent,
      cumulativeEpsilon: this.state.privacyBudget.epsilonSpent,
      cumulativeDelta: this.state.privacyBudget.deltaSpent,
      epsilonRemaining: this.state.privacyBudget.totalEpsilon - this.state.privacyBudget.epsilonSpent,
      deltaRemaining: this.state.privacyBudget.totalDelta - this.state.privacyBudget.deltaSpent,
    };
  }

  /**
   * Log message
   */
  private log(message: string, level: "info" | "warn" | "error"): void {
    if (this.config.onLog) {
      this.config.onLog(`[FederatedServer ${this.config.serverId}] ${message}`, level);
    }
  }
}

// ============================================================================
// SIMPLE CLIENT CONNECTION (FOR TESTING)
// ============================================================================

/**
 * Simple client connection for testing
 *
 * Simulates a client connection for testing the server.
 */
export class SimpleClientConnection implements IClientConnection {
  clientId: string;
  private clientState: FederatedClientState;

  constructor(clientId: string, numExamples: number) {
    this.clientId = clientId;
    this.clientState = {
      clientId,
      currentRound: 0,
      localWeights: [],
      modelVersion: "0.0.0",
      numExamples,
      lastUpdateTimestamp: 0,
      status: ClientStatus.IDLE,
      statistics: {
        totalRounds: 0,
        totalExamples: 0,
        avgTrainingTime: 0,
        totalCommunicationCost: 0,
        avgLoss: 0,
      },
    };
  }

  async sendTrainRequest(request: TrainRequest): Promise<TrainResponse> {
    // Simulate client acceptance
    return {
      type: "train_response",
      clientId: this.clientId,
      roundId: request.roundId,
      accepted: true,
      estimatedTime: 5000,
    };
  }

  async receiveUpdate(): Promise<UpdateSubmission> {
    // Simulate update after delay
    await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));

    const update: ModelUpdate = {
      clientId: this.clientId,
      roundId: "test-round",
      timestamp: Date.now(),
      numExamples: this.clientState.numExamples,
      numEpochs: 1,
      weightDeltas: Array.from({ length: 100 }, () => (Math.random() - 0.5) * 0.1),
      metrics: {
        loss: 0.5 + Math.random() * 0.3,
        accuracy: 0.7 + Math.random() * 0.2,
        numBatches: 10,
        trainingTime: 1000 + Math.random() * 2000,
      },
    };

    return {
      type: "update_submission",
      clientId: this.clientId,
      roundId: "test-round",
      update,
    };
  }

  async sendAcknowledgment(ack: UpdateAcknowledgment): Promise<void> {
    // Simulate acknowledgment
  }

  async sendRoundComplete(notification: RoundComplete): Promise<void> {
    // Simulate round complete
  }

  isAvailable(): boolean {
    return true;
  }

  getClientState(): FederatedClientState {
    return { ...this.clientState };
  }
}

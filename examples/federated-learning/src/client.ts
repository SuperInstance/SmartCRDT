/**
 * @fileoverview Federated Learning Client
 *
 * Implements the client-side logic for federated learning:
 * - Local model training
 * - Update generation
 * - Communication with server
 */

import { LogisticRegressionModel, DataPoint, ModelParameters, ModelUpdate, TrainingConfig, TrainingMetrics, generateClientData } from './model.js';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Client configuration
 */
export interface ClientConfig {
  /** Learning rate */
  learningRate: number;
  /** Number of local epochs */
  localEpochs: number;
  /** Batch size */
  batchSize: number;
  /** L2 regularization */
  regularization: number;
  /** Whether to use differential privacy */
  useDifferentialPrivacy: boolean;
  /** Differential privacy noise scale */
  dpNoiseScale?: number;
}

/**
 * Client state
 */
export interface ClientState {
  /** Client identifier */
  id: string;
  /** Number of training samples */
  numSamples: number;
  /** Current round */
  currentRound: number;
  /** Total rounds participated */
  totalRounds: number;
  /** Local data distribution */
  dataDistribution: string;
}

/**
 * Training result
 */
export interface TrainingResult {
  /** Model update */
  update: ModelUpdate;
  /** Local metrics */
  metrics: TrainingMetrics;
  /** Training time (ms) */
  trainingTime: number;
}

// ============================================================================
// Federated Learning Client
// ============================================================================

/**
 * Federated Learning Client
 *
 * Each client:
 * 1. Maintains a local model
 * 2. Receives global model from server
 * 3. Trains on local data
 * 4. Sends model update (not raw data) to server
 */
export class FederatedClient {
  private id: string;
  private model: LogisticRegressionModel;
  private localData: DataPoint[];
  private config: ClientConfig;
  private state: ClientState;
  private testData: DataPoint[];

  constructor(
    id: string,
    featureDim: number,
    numSamples: number,
    config: Partial<ClientConfig> = {}
  ) {
    this.id = id;
    this.model = new LogisticRegressionModel(featureDim);
    this.config = {
      learningRate: config.learningRate ?? 0.01,
      localEpochs: config.localEpochs ?? 5,
      batchSize: config.batchSize ?? 32,
      regularization: config.regularization ?? 0.001,
      useDifferentialPrivacy: config.useDifferentialPrivacy ?? false,
      dpNoiseScale: config.dpNoiseScale ?? 0.1,
    };

    // Generate local data
    const { data, distribution } = generateClientData(id, numSamples, featureDim);

    // Split into train/test (80/20)
    const splitIndex = Math.floor(data.length * 0.8);
    this.localData = data.slice(0, splitIndex);
    this.testData = data.slice(splitIndex);

    this.state = {
      id,
      numSamples: this.localData.length,
      currentRound: 0,
      totalRounds: 0,
      dataDistribution: distribution,
    };
  }

  /**
   * Get client ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * Get client state
   */
  getState(): ClientState {
    return { ...this.state };
  }

  /**
   * Get number of training samples
   */
  getNumSamples(): number {
    return this.localData.length;
  }

  /**
   * Receive global model from server
   */
  receiveGlobalModel(globalParams: ModelParameters): void {
    this.model.setParameters(globalParams);
  }

  /**
   * Train local model and generate update
   */
  train(): TrainingResult {
    const startTime = Date.now();

    // Train on local data
    const trainingConfig: TrainingConfig = {
      learningRate: this.config.learningRate,
      epochs: this.config.localEpochs,
      batchSize: this.config.batchSize,
      regularization: this.config.regularization,
    };

    const update = this.model.train(this.localData, trainingConfig);

    // Apply differential privacy if enabled
    if (this.config.useDifferentialPrivacy) {
      this.applyDifferentialPrivacy(update);
    }

    const trainingTime = Date.now() - startTime;

    // Update state
    this.state.currentRound++;
    this.state.totalRounds++;

    return {
      update: {
        ...update,
        clientId: this.id,
      },
      metrics: update.metrics,
      trainingTime,
    };
  }

  /**
   * Apply differential privacy to model update
   *
   * Adds Gaussian noise to weight updates to provide
   * differential privacy guarantees.
   */
  private applyDifferentialPrivacy(update: ModelUpdate): void {
    const noiseScale = this.config.dpNoiseScale ?? 0.1;

    // Add Gaussian noise to weight deltas
    for (let i = 0; i < update.weightDeltas.length; i++) {
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      update.weightDeltas[i] += noiseScale * z;
    }

    // Add noise to bias delta
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    update.biasDelta += noiseScale * z;
  }

  /**
   * Evaluate local model on test data
   */
  evaluate(): TrainingMetrics {
    return this.model.evaluate(this.testData);
  }

  /**
   * Train locally without federated learning (for comparison)
   */
  trainLocal(rounds: number): TrainingMetrics[] {
    const metrics: TrainingMetrics[] = [];

    for (let r = 0; r < rounds; r++) {
      const trainingConfig: TrainingConfig = {
        learningRate: this.config.learningRate,
        epochs: this.config.localEpochs,
        batchSize: this.config.batchSize,
        regularization: this.config.regularization,
      };

      this.model.train(this.localData, trainingConfig);
      metrics.push(this.evaluate());
    }

    return metrics;
  }

  /**
   * Reset client state
   */
  reset(): void {
    this.model = new LogisticRegressionModel(this.model['featureDim']);
    this.state.currentRound = 0;
  }
}

// ============================================================================
// Client Manager
// ============================================================================

/**
 * Manages multiple federated learning clients
 */
export class ClientManager {
  private clients: Map<string, FederatedClient>;

  constructor() {
    this.clients = new Map();
  }

  /**
   * Create a new client
   */
  createClient(
    id: string,
    featureDim: number,
    numSamples: number,
    config?: Partial<ClientConfig>
  ): FederatedClient {
    const client = new FederatedClient(id, featureDim, numSamples, config);
    this.clients.set(id, client);
    return client;
  }

  /**
   * Get a client by ID
   */
  getClient(id: string): FederatedClient | undefined {
    return this.clients.get(id);
  }

  /**
   * Get all clients
   */
  getAllClients(): FederatedClient[] {
    return Array.from(this.clients.values());
  }

  /**
   * Get client IDs
   */
  getClientIds(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Remove a client
   */
  removeClient(id: string): boolean {
    return this.clients.delete(id);
  }

  /**
   * Reset all clients
   */
  resetAll(): void {
    for (const client of this.clients.values()) {
      client.reset();
    }
  }

  /**
   * Get total samples across all clients
   */
  getTotalSamples(): number {
    let total = 0;
    for (const client of this.clients.values()) {
      total += client.getNumSamples();
    }
    return total;
  }
}

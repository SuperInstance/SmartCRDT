/**
 * @fileoverview Federated Learning Server
 *
 * Implements the server-side logic for federated learning:
 * - Client selection
 * - Model aggregation (FedAvg, FedProx)
 * - Global model management
 * - Round coordination
 */

import { ModelParameters, ModelUpdate, TrainingMetrics } from './model.js';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Client information for selection
 */
export interface ClientInfo {
  /** Client identifier */
  id: string;
  /** Number of training samples */
  numSamples: number;
  /** Availability status */
  isAvailable: boolean;
  /** Connection quality [0, 1] */
  connectionQuality: number;
  /** Historical performance [0, 1] */
  performanceScore: number;
}

/**
 * Aggregation strategy
 */
export enum AggregationStrategy {
  /** Federated Averaging (FedAvg) */
  FED_AVG = 'fed_avg',
  /** FedProx (with proximal term) */
  FED_PROX = 'fed_prox',
  /** Weighted by number of samples */
  WEIGHTED_AVG = 'weighted_avg',
}

/**
 * Server configuration
 */
export interface ServerConfig {
  /** Fraction of clients to select each round */
  clientFraction: number;
  /** Minimum clients required */
  minClients: number;
  /** Maximum clients per round */
  maxClients: number;
  /** Aggregation strategy */
  strategy: AggregationStrategy;
  /** FedProx mu parameter (for FedProx) */
  proxMu?: number;
}

/**
 * Round summary
 */
export interface RoundSummary {
  /** Round number */
  round: number;
  /** Selected clients */
  selectedClients: string[];
  /** Number of participating clients */
  numClients: number;
  /** Total training samples */
  totalSamples: number;
  /** Average training loss */
  avgLoss: number;
  /** Average training accuracy */
  avgAccuracy: number;
  /** Global model loss */
  globalLoss?: number;
  /** Global model accuracy */
  globalAccuracy?: number;
  /** Aggregation time (ms) */
  aggregationTime: number;
}

/**
 * Server statistics
 */
export interface ServerStats {
  /** Total rounds completed */
  totalRounds: number;
  /** Total updates received */
  totalUpdates: number;
  /** Average clients per round */
  avgClientsPerRound: number;
  /** Best accuracy achieved */
  bestAccuracy: number;
  /** Round of best accuracy */
  bestRound: number;
  /** Client participation counts */
  clientParticipation: Map<string, number>;
}

// ============================================================================
// Federated Learning Server
// ============================================================================

/**
 * Federated Learning Server
 *
 * Coordinates the federated learning process by:
 * 1. Selecting clients for each round
 * 2. Distributing the global model
 * 3. Aggregating client updates
 * 4. Maintaining the global model
 */
export class FederatedServer {
  private globalModel: ModelParameters;
  private featureDim: number;
  private config: ServerConfig;
  private clients: Map<string, ClientInfo>;
  private currentRound: number;
  private roundHistory: RoundSummary[];
  private stats: ServerStats;

  constructor(featureDim: number, config: Partial<ServerConfig> = {}) {
    this.featureDim = featureDim;
    this.featureDim = featureDim;
    this.config = {
      clientFraction: config.clientFraction ?? 1.0,
      minClients: config.minClients ?? 2,
      maxClients: config.maxClients ?? 10,
      strategy: config.strategy ?? AggregationStrategy.WEIGHTED_AVG,
      proxMu: config.proxMu ?? 0.01,
    };

    // Initialize global model with zeros
    this.globalModel = {
      weights: Array(featureDim).fill(0),
      bias: 0,
    };

    this.clients = new Map();
    this.currentRound = 0;
    this.roundHistory = [];
    this.stats = {
      totalRounds: 0,
      totalUpdates: 0,
      avgClientsPerRound: 0,
      bestAccuracy: 0,
      bestRound: 0,
      clientParticipation: new Map(),
    };
  }

  /**
   * Register a client
   */
  registerClient(client: ClientInfo): void {
    this.clients.set(client.id, client);
    this.stats.clientParticipation.set(client.id, 0);
  }

  /**
   * Get current global model
   */
  getGlobalModel(): ModelParameters {
    return {
      weights: [...this.globalModel.weights],
      bias: this.globalModel.bias,
    };
  }

  /**
   * Update global model (used for initialization)
   */
  setGlobalModel(params: ModelParameters): void {
    this.globalModel = {
      weights: [...params.weights],
      bias: params.bias,
    };
  }

  /**
   * Select clients for next round
   */
  selectClients(): string[] {
    const availableClients = Array.from(this.clients.values()).filter((c) => c.isAvailable);
    const numToSelect = Math.min(
      this.config.maxClients,
      Math.max(this.config.minClients, Math.floor(availableClients.length * this.config.clientFraction))
    );

    // Sort by combined score (connection quality + performance)
    const scored = availableClients
      .map((client) => ({
        id: client.id,
        score: client.connectionQuality * 0.5 + client.performanceScore * 0.5,
      }))
      .sort((a, b) => b.score - a.score);

    // Select top clients
    const selected = scored.slice(0, numToSelect).map((c) => c.id);

    return selected;
  }

  /**
   * Aggregate client updates into new global model
   */
  aggregateUpdates(updates: ModelUpdate[]): ModelParameters {
    const startTime = Date.now();

    if (updates.length === 0) {
      return this.getGlobalModel();
    }

    let newWeights: number[];
    let newBias: number;

    switch (this.config.strategy) {
      case AggregationStrategy.WEIGHTED_AVG:
        [newWeights, newBias] = this.weightedAverage(updates);
        break;
      case AggregationStrategy.FED_AVG:
        [newWeights, newBias] = this.federatedAveraging(updates);
        break;
      case AggregationStrategy.FED_PROX:
        [newWeights, newBias] = this.federatedProx(updates);
        break;
      default:
        [newWeights, newBias] = this.weightedAverage(updates);
    }

    // Update global model
    this.globalModel = {
      weights: newWeights,
      bias: newBias,
    };

    const aggregationTime = Date.now() - startTime;

    // Record round summary
    this.recordRoundSummary(updates, aggregationTime);

    return this.getGlobalModel();
  }

  /**
   * Weighted averaging by number of samples
   */
  private weightedAverage(updates: ModelUpdate[]): [number[], number] {
    const totalSamples = updates.reduce((sum, u) => sum + u.numSamples, 0);

    // Initialize with zeros
    const newWeights = new Array(this.featureDim).fill(0);
    let newBias = 0;

    // Weighted sum of updates
    for (const update of updates) {
      const weight = update.numSamples / totalSamples;
      for (let i = 0; i < this.featureDim; i++) {
        newWeights[i] += this.globalModel.weights[i] + update.weightDeltas[i] * weight;
      }
      newBias += (this.globalModel.bias + update.biasDelta) * weight;
    }

    return [newWeights, newBias];
  }

  /**
   * Standard Federated Averaging (FedAvg)
   * Simple average of all client updates
   */
  private federatedAveraging(updates: ModelUpdate[]): [number[], number] {
    const numClients = updates.length;

    // Initialize with zeros
    const newWeights = new Array(this.featureDim).fill(0);
    let newBias = 0;

    // Sum of updates
    for (const update of updates) {
      for (let i = 0; i < this.featureDim; i++) {
        newWeights[i] += update.weightDeltas[i];
      }
      newBias += update.biasDelta;
    }

    // Average
    for (let i = 0; i < this.featureDim; i++) {
      newWeights[i] = this.globalModel.weights[i] + newWeights[i] / numClients;
    }
    newBias = this.globalModel.bias + newBias / numClients;

    return [newWeights, newBias];
  }

  /**
   * FedProx aggregation
   * Adds proximal term to handle heterogeneity
   */
  private federatedProx(updates: ModelUpdate[]): [number[], number] {
    const mu = this.config.proxMu ?? 0.01;
    const totalSamples = updates.reduce((sum, u) => sum + u.numSamples, 0);

    // Initialize with zeros
    const newWeights = new Array(this.featureDim).fill(0);
    let newBias = 0;

    // Weighted sum with proximal adjustment
    for (const update of updates) {
      const weight = update.numSamples / totalSamples;
      for (let i = 0; i < this.featureDim; i++) {
        const proximalTerm = mu * (this.globalModel.weights[i] - update.weightDeltas[i]);
        newWeights[i] += (this.globalModel.weights[i] + update.weightDeltas[i] + proximalTerm) * weight;
      }
      newBias += (this.globalModel.bias + update.biasDelta) * weight;
    }

    return [newWeights, newBias];
  }

  /**
   * Record round summary
   */
  private recordRoundSummary(updates: ModelUpdate[], aggregationTime: number): void {
    const totalSamples = updates.reduce((sum, u) => sum + u.numSamples, 0);
    const avgLoss =
      updates.reduce((sum, u) => sum + u.metrics.loss * u.numSamples, 0) / totalSamples;
    const avgAccuracy =
      updates.reduce((sum, u) => sum + u.metrics.accuracy * u.numSamples, 0) / totalSamples;

    const summary: RoundSummary = {
      round: this.currentRound,
      selectedClients: updates.map((u) => u.clientId),
      numClients: updates.length,
      totalSamples,
      avgLoss,
      avgAccuracy,
      aggregationTime,
    };

    this.roundHistory.push(summary);

    // Update participation stats
    for (const update of updates) {
      const count = this.stats.clientParticipation.get(update.clientId) ?? 0;
      this.stats.clientParticipation.set(update.clientId, count + 1);
    }

    // Update best accuracy
    if (summary.avgAccuracy > this.stats.bestAccuracy) {
      this.stats.bestAccuracy = summary.avgAccuracy;
      this.stats.bestRound = this.currentRound;
    }
  }

  /**
   * Execute one federated round
   */
  async executeRound(
    clientUpdates: ModelUpdate[],
    globalMetrics?: { loss: number; accuracy: number }
  ): Promise<RoundSummary> {
    this.currentRound++;

    // Aggregate updates
    this.aggregateUpdates(clientUpdates);

    // Update round summary with global metrics
    const lastSummary = this.roundHistory[this.roundHistory.length - 1];
    if (globalMetrics) {
      lastSummary.globalLoss = globalMetrics.loss;
      lastSummary.globalAccuracy = globalMetrics.accuracy;
    }

    // Update stats
    this.stats.totalRounds = this.currentRound;
    this.stats.totalUpdates += clientUpdates.length;
    this.stats.avgClientsPerRound =
      this.stats.totalUpdates / this.stats.totalRounds;

    return lastSummary;
  }

  /**
   * Get round history
   */
  getRoundHistory(): RoundSummary[] {
    return [...this.roundHistory];
  }

  /**
   * Get server statistics
   */
  getStats(): ServerStats {
    return {
      ...this.stats,
      clientParticipation: new Map(this.stats.clientParticipation),
    };
  }

  /**
   * Reset server state
   */
  reset(): void {
    this.currentRound = 0;
    this.roundHistory = [];
    this.stats = {
      totalRounds: 0,
      totalUpdates: 0,
      avgClientsPerRound: 0,
      bestAccuracy: 0,
      bestRound: 0,
      clientParticipation: new Map(),
    };
    this.globalModel = {
      weights: Array(this.featureDim).fill(0),
      bias: 0,
    };
    for (const clientId of this.clients.keys()) {
      this.stats.clientParticipation.set(clientId, 0);
    }
  }
}

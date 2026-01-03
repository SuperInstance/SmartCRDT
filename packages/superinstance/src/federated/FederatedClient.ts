/**
 * Federated Learning Client
 *
 * Implements client-side federated learning logic including:
 * - Local training on private data
 * - Model update generation (gradients/weight deltas)
 * - Differential privacy for updates (ε-DP)
 * - Communication with federated server
 * - Privacy budget tracking
 *
 * @module federated
 */

import type {
  FederatedClientState,
  FederatedConfig,
  ModelUpdate,
  ClientMetrics,
  UpdatePrivacyMetadata,
  CompressionMetadata,
  TrainRequest,
  TrainResponse,
  UpdateSubmission,
  UpdateAcknowledgment,
  RoundComplete,
} from "@lsi/protocol";
import {
  ClientStatus,
  ClientPrivacyBudget,
  NoiseMechanismType,
  CompressionMethod,
} from "@lsi/protocol";

// ============================================================================
// TRAINING INTERFACE
// ============================================================================

/**
 * Local training interface
 *
 * Abstraction for local model training. Implementations provide
 * the actual training logic (e.g., TensorFlow, PyTorch, custom).
 */
export interface ILocalTrainer {
  /**
   * Train locally on private data
   *
   * @param weights - Current model weights
   * @param config - Training configuration
   * @returns Training result with weight deltas and metrics
   */
  train(
    weights: number[],
    config: LocalTrainingConfig
  ): Promise<LocalTrainingResult>;

  /**
   * Get number of training examples
   */
  getNumExamples(): number;

  /**
   * Validate model weights
   */
  validate?(weights: number[]): Promise<ValidationMetrics>;
}

/**
 * Local training configuration
 */
export interface LocalTrainingConfig {
  /** Number of epochs to train */
  epochs: number;
  /** Batch size */
  batchSize: number;
  /** Learning rate */
  learningRate: number;
  /** Federated proximal term (for FedProx) */
  proximalTerm?: number;
  /** Global weights for proximal term */
  globalWeights?: number[];
  /** Whether to compute gradients */
  computeGradients: boolean;
}

/**
 * Local training result
 */
export interface LocalTrainingResult {
  /** Updated weights after training */
  updatedWeights: number[];
  /** Weight deltas (updated - original) */
  weightDeltas: number[];
  /** Gradients (if computed) */
  gradients?: number[];
  /** Training metrics */
  metrics: ClientMetrics;
  /** Validation metrics (if validation performed) */
  validationMetrics?: ValidationMetrics;
}

/**
 * Validation metrics
 */
export interface ValidationMetrics {
  /** Validation loss */
  valLoss: number;
  /** Validation accuracy */
  valAccuracy: number;
}

// ============================================================================
// CLIENT CONFIGURATION
// ============================================================================

/**
 * Federated client configuration
 */
export interface FederatedClientConfig {
  /** Unique client identifier */
  clientId: string;
  /** Server URL */
  serverUrl: string;
  /** Local trainer instance */
  trainer: ILocalTrainer;
  /** Maximum retry attempts for communication */
  maxRetries: number;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Enable differential privacy */
  enableDP: boolean;
  /** Privacy budget */
  privacyBudget?: ClientPrivacyBudget;
  /** Enable gradient compression */
  enableCompression: boolean;
  /** Compression method */
  compressionMethod?: CompressionMethod;
  /** Compression ratio (0-1) */
  compressionRatio: number;
  /** Clipping norm for DP */
  clippingNorm?: number;
  /** Logging callback */
  onLog?: (message: string, level: "info" | "warn" | "error") => void;
}

// ============================================================================
// MAIN CLIENT CLASS
// ============================================================================

/**
 * Federated Learning Client
 *
 * Manages participation in federated learning rounds, including
 * local training, update generation, and communication with the server.
 */
export class FederatedClient {
  private config: FederatedClientConfig;
  private state: FederatedClientState;
  private currentWeights: number[];
  private modelVersion: string;

  constructor(config: FederatedClientConfig) {
    this.config = config;
    this.currentWeights = [];
    this.modelVersion = "0.0.0";

    // Initialize client state
    this.state = {
      clientId: config.clientId,
      currentRound: 0,
      localWeights: [],
      modelVersion: this.modelVersion,
      numExamples: config.trainer.getNumExamples(),
      lastUpdateTimestamp: 0,
      status: ClientStatus.IDLE,
      statistics: {
        totalRounds: 0,
        totalExamples: 0,
        avgTrainingTime: 0,
        totalCommunicationCost: 0,
        avgLoss: 0,
      },
      privacyBudget: config.privacyBudget,
    };
  }

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  /**
   * Start the federated client
   *
   * Connects to the server and waits for training requests.
   */
  async start(): Promise<void> {
    this.log("Starting federated client", "info");
    this.state.status = ClientStatus.IDLE;

    // In a real implementation, this would establish a connection
    // to the server and listen for training requests.
    // For now, we assume the server will call handleTrainRequest directly.
  }

  /**
   * Stop the federated client
   */
  async stop(): Promise<void> {
    this.log("Stopping federated client", "info");
    this.state.status = ClientStatus.IDLE;
  }

  /**
   * Handle a training request from the server
   *
   * @param request - Training request from server
   * @returns Train response
   */
  async handleTrainRequest(request: TrainRequest): Promise<TrainResponse> {
    this.log(`Received training request for round ${request.roundNumber}`, "info");

    // Update state
    this.state.currentRound = request.roundNumber;
    this.currentWeights = Array.isArray(request.globalWeights)
      ? request.globalWeights
      : Array.from(request.globalWeights);
    this.modelVersion = request.modelVersion;
    this.state.localWeights = Array.isArray(request.globalWeights)
      ? request.globalWeights
      : Array.from(request.globalWeights);
    this.state.modelVersion = request.modelVersion;

    // Check if client can participate
    const canParticipate = await this.checkEligibility(request);

    if (!canParticipate) {
      return {
        type: "train_response",
        clientId: this.config.clientId,
        roundId: request.roundId,
        accepted: false,
        rejectionReason: "Client not eligible",
      };
    }

    // Estimate training time
    const estimatedTime = this.estimateTrainingTime(request.config);

    return {
      type: "train_response",
      clientId: this.config.clientId,
      roundId: request.roundId,
      accepted: true,
      estimatedTime,
    };
  }

  /**
   * Perform local training and submit update
   *
   * @param request - Training request from server
   * @returns Update submission
   */
  async trainAndSubmit(request: TrainRequest): Promise<UpdateSubmission> {
    this.log(`Starting local training for round ${request.roundNumber}`, "info");
    this.state.status = ClientStatus.TRAINING;

    const startTime = Date.now();

    try {
      // Perform local training
      const trainingResult = await this.performLocalTraining(
        this.currentWeights,
        request.config
      );

      // Generate model update
      let update: ModelUpdate = {
        clientId: this.config.clientId,
        roundId: request.roundId,
        timestamp: Date.now(),
        numExamples: trainingResult.metrics.numBatches * request.config.localBatchSize,
        numEpochs: request.config.localEpochs,
        weightDeltas: trainingResult.weightDeltas,
        gradients: trainingResult.gradients,
        metrics: trainingResult.metrics,
      };

      // Apply differential privacy if enabled
      if (this.config.enableDP && request.config.privacy?.enableDP) {
        update = await this.applyDifferentialPrivacy(update, request.config);
      }

      // Apply compression if enabled
      if (this.config.enableCompression && request.config.communication?.enableCompression) {
        update = await this.applyCompression(update, request.config);
      }

      // Update statistics
      const trainingTime = Date.now() - startTime;
      this.updateStatistics(trainingTime, update.metrics, update);

      this.state.status = ClientStatus.UPLOADING;
      this.state.lastUpdateTimestamp = update.timestamp;

      return {
        type: "update_submission",
        clientId: this.config.clientId,
        roundId: request.roundId,
        update,
      };
    } catch (error) {
      this.log(`Training failed: ${error}`, "error");
      this.state.status = ClientStatus.IDLE;
      throw error;
    }
  }

  /**
   * Handle update acknowledgment from server
   *
   * @param ack - Update acknowledgment from server
   */
  async handleUpdateAcknowledgment(ack: UpdateAcknowledgment): Promise<void> {
    if (ack.accepted) {
      this.log(`Update accepted for round ${ack.roundId}`, "info");
      if (ack.contributionScore !== undefined) {
        this.log(`Contribution score: ${ack.contributionScore}`, "info");
      }
    } else {
      this.log(`Update rejected: ${ack.rejectionReason}`, "warn");
    }

    this.state.status = ClientStatus.IDLE;
  }

  /**
   * Handle round complete notification
   *
   * @param notification - Round complete notification
   */
  async handleRoundComplete(notification: RoundComplete): Promise<void> {
    this.log(`Round ${notification.roundNumber} complete`, "info");

    // Update local model with new global weights
    const newWeights = Array.isArray(notification.newGlobalWeights)
      ? notification.newGlobalWeights
      : Array.from(notification.newGlobalWeights);
    this.currentWeights = newWeights;
    this.modelVersion = notification.newModelVersion;
    this.state.localWeights = newWeights;
    this.state.modelVersion = notification.newModelVersion;

    if (notification.trainingComplete) {
      this.log("Training complete!", "info");
    }
  }

  /**
   * Get current client state
   */
  getState(): FederatedClientState {
    return { ...this.state };
  }

  /**
   * Get current model weights
   */
  getCurrentWeights(): number[] {
    return [...this.currentWeights];
  }

  // ========================================================================
  // PRIVATE METHODS
  // ========================================================================

  /**
   * Check if client is eligible to participate
   */
  private async checkEligibility(request: TrainRequest): Promise<boolean> {
    // Check if client has enough training examples
    if (this.state.numExamples < request.config.minClients) {
      return false;
    }

    // Check privacy budget
    if (this.config.privacyBudget) {
      const epsilonRemaining = this.config.privacyBudget.totalEpsilon - this.config.privacyBudget.epsilonSpent;
      if (epsilonRemaining < (request.config.privacy?.epsilon || 0)) {
        this.log("Insufficient privacy budget", "warn");
        return false;
      }
    }

    return true;
  }

  /**
   * Estimate training time
   */
  private estimateTrainingTime(config: FederatedConfig): number {
    // Simple estimation based on historical data
    const baseTime = 10000; // 10 seconds base
    const perEpochTime = this.state.numExamples * 0.01; // 0.01ms per example
    const perEpoch = config.localEpochs;
    return baseTime + perEpoch * perEpochTime;
  }

  /**
   * Perform local training
   */
  private async performLocalTraining(
    weights: number[],
    config: FederatedConfig
  ): Promise<LocalTrainingResult> {
    const trainingConfig: LocalTrainingConfig = {
      epochs: config.localEpochs,
      batchSize: config.localBatchSize,
      learningRate: config.learningRate,
      computeGradients: true,
    };

    // Add proximal term if using FedProx
    if (config.aggregation === "fedprox") {
      trainingConfig.proximalTerm = 0.01; // Default proximal term
      trainingConfig.globalWeights = weights;
    }

    return await this.config.trainer.train(weights, trainingConfig);
  }

  /**
   * Apply differential privacy to model update
   */
  private async applyDifferentialPrivacy(
    update: ModelUpdate,
    config: FederatedConfig
  ): Promise<ModelUpdate> {
    this.log("Applying differential privacy", "info");

    const privacyConfig = config.privacy!;
    const epsilon = privacyConfig.epsilon || 1.0;
    const delta = privacyConfig.delta || 1e-5;
    const clippingNorm = privacyConfig.clippingNorm || 1.0;

    // Convert to number[] if needed
    const weightDeltas = Array.isArray(update.weightDeltas)
      ? update.weightDeltas
      : Array.from(update.weightDeltas);

    // Clip gradients
    const clippedDeltas = this.clipGradients(weightDeltas, clippingNorm);

    // Add noise
    const noisyDeltas = this.addNoise(
      clippedDeltas,
      epsilon,
      delta,
      privacyConfig.noiseMechanism || NoiseMechanismType.GAUSSIAN
    );

    // Update privacy metadata
    const privacyMetadata: UpdatePrivacyMetadata = {
      epsilonSpent: epsilon,
      deltaSpent: delta,
      noiseMechanism: privacyConfig.noiseMechanism || NoiseMechanismType.GAUSSIAN,
      clipped: true,
      clippingNorm,
      noiseMultiplier: this.computeNoiseMultiplier(clippingNorm, epsilon, delta),
      secureAggregation: privacyConfig.enableSecureAggregation,
    };

    // Update privacy budget
    if (this.config.privacyBudget) {
      this.config.privacyBudget.epsilonSpent += epsilon;
      this.config.privacyBudget.deltaSpent += delta;
      this.config.privacyBudget.roundsParticipated += 1;
    }

    return {
      ...update,
      weightDeltas: noisyDeltas,
      privacy: privacyMetadata,
    };
  }

  /**
   * Clip gradients to max norm
   */
  private clipGradients(gradients: number[], maxNorm: number): number[] {
    const norm = Math.sqrt(gradients.reduce((sum, g) => sum + g * g, 0));
    if (norm <= maxNorm) {
      return gradients;
    }
    const scale = maxNorm / norm;
    return gradients.map((g) => g * scale);
  }

  /**
   * Add noise for differential privacy
   */
  private addNoise(
    gradients: number[],
    epsilon: number,
    delta: number,
    mechanism: NoiseMechanismType
  ): number[] {
    const sensitivity = 1.0; // L2 sensitivity
    const scale = this.computeNoiseMultiplier(sensitivity, epsilon, delta);

    return gradients.map((g) => {
      let noise: number;
      if (mechanism === NoiseMechanismType.LAPLACE) {
        // Laplace noise
        const u = Math.random() - 0.5;
        noise = -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
      } else {
        // Gaussian noise (Box-Muller transform)
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        noise = scale * z;
      }
      return g + noise;
    });
  }

  /**
   * Compute noise multiplier
   */
  private computeNoiseMultiplier(sensitivity: number, epsilon: number, delta: number): number {
    // For Gaussian mechanism
    const sigma = sensitivity * Math.sqrt(2 * Math.log(1.25 / delta)) / epsilon;
    return sigma;
  }

  /**
   * Apply compression to model update
   */
  private async applyCompression(
    update: ModelUpdate,
    config: FederatedConfig
  ): Promise<ModelUpdate> {
    this.log("Applying compression", "info");

    const compressionConfig = config.communication!;
    const method = compressionConfig.compressionMethod || CompressionMethod.TOPK;
    const ratio = compressionConfig.compressionRatio;

    // Convert Float32Array to number[] if needed
    const weightDeltas = Array.isArray(update.weightDeltas)
      ? update.weightDeltas
      : Array.from(update.weightDeltas);

    let compressedDeltas: number[];
    let sparsity: number | undefined;

    if (method === CompressionMethod.TOPK) {
      // Top-k sparsification
      const k = Math.floor(weightDeltas.length * ratio);
      const indexed = weightDeltas.map((val: number, idx: number) => ({ val, idx }));
      indexed.sort((a: { val: number }, b: { val: number }) => Math.abs(b.val) - Math.abs(a.val));
      const topk = indexed.slice(0, k);
      compressedDeltas = new Array(weightDeltas.length).fill(0);
      topk.forEach(({ val, idx }: { val: number; idx: number }) => {
        compressedDeltas[idx] = val;
      });
      sparsity = 1 - ratio;
    } else if (method === CompressionMethod.RANDOM) {
      // Random sparsification
      compressedDeltas = weightDeltas.map((val: number) => {
        if (Math.random() < ratio) {
          return val;
        }
        return 0;
      });
      sparsity = 1 - ratio;
    } else if (method === CompressionMethod.QUANTIZATION) {
      // Quantization (8-bit)
      const maxVal = Math.max(...weightDeltas.map(Math.abs));
      const scale = maxVal / 127;
      compressedDeltas = weightDeltas.map((val: number) => {
        const quantized = Math.round(val / scale);
        return quantized * scale;
      });
    } else {
      // No compression
      compressedDeltas = weightDeltas;
    }

    const compressionMetadata: CompressionMetadata = {
      method,
      ratio,
      originalSize: weightDeltas.length * 4, // 4 bytes per float
      compressedSize: compressedDeltas.filter((v) => v !== 0).length * 4,
      sparsity,
    };

    return {
      ...update,
      weightDeltas: compressedDeltas,
      compression: compressionMetadata,
    };
  }

  /**
   * Update client statistics
   */
  private updateStatistics(trainingTime: number, metrics: ClientMetrics, update: ModelUpdate): void {
    const stats = this.state.statistics;
    stats.totalRounds += 1;
    stats.totalExamples += update.numExamples;
    stats.avgTrainingTime =
      (stats.avgTrainingTime * (stats.totalRounds - 1) + trainingTime) / stats.totalRounds;
    stats.avgLoss =
      (stats.avgLoss * (stats.totalRounds - 1) + metrics.loss) / stats.totalRounds;
    stats.totalCommunicationCost += update.weightDeltas.length * 4; // 4 bytes per float

    if (metrics.accuracy !== undefined && (stats.bestAccuracy === undefined || metrics.accuracy > stats.bestAccuracy)) {
      stats.bestAccuracy = metrics.accuracy;
    }
  }

  /**
   * Log message
   */
  private log(message: string, level: "info" | "warn" | "error"): void {
    if (this.config.onLog) {
      this.config.onLog(`[FederatedClient ${this.config.clientId}] ${message}`, level);
    }
  }
}

// ============================================================================
// SIMPLE LOCAL TRAINER IMPLEMENTATION (FOR TESTING)
// ============================================================================

/**
 * Simple local trainer for testing
 *
 * Implements basic gradient descent on a linear model.
 * In production, this would interface with real ML frameworks.
 */
export class SimpleLocalTrainer implements ILocalTrainer {
  private numExamples: number;

  constructor(numExamples: number) {
    this.numExamples = numExamples;
  }

  async train(weights: number[], config: LocalTrainingConfig): Promise<LocalTrainingResult> {
    // Simulate training with simple gradient descent
    const startTime = Date.now();

    // Simulate gradients (random for testing)
    const gradients = weights.map(() => (Math.random() - 0.5) * 0.1);

    // Apply gradients
    const updatedWeights = weights.map((w, i) => w - config.learningRate * gradients[i]);

    // Compute weight deltas
    const weightDeltas = updatedWeights.map((w, i) => w - weights[i]);

    // Simulate training metrics
    const loss = 0.5 + Math.random() * 0.3;
    const accuracy = 0.7 + Math.random() * 0.2;
    const numBatches = Math.ceil(this.numExamples / config.batchSize);
    const trainingTime = Date.now() - startTime;

    const metrics: ClientMetrics = {
      loss,
      accuracy,
      numBatches,
      trainingTime,
    };

    return {
      updatedWeights,
      weightDeltas,
      gradients,
      metrics,
    };
  }

  getNumExamples(): number {
    return this.numExamples;
  }

  async validate(weights: number[]): Promise<ValidationMetrics> {
    // Simulate validation
    return {
      valLoss: 0.4 + Math.random() * 0.2,
      valAccuracy: 0.75 + Math.random() * 0.15,
    };
  }
}

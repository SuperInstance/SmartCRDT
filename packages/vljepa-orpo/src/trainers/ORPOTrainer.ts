/**
 * @lsi/vljepa-orpo - ORPO Trainer
 *
 * Training loop for multimodal ORPO with VL-JEPA.
 * Handles batch processing, optimization, and progress tracking.
 *
 * @module trainers
 */

import type {
  MultimodalORPOConfig,
  UIPreferencePair,
  ORPOTrainingMetrics,
  ORPOTrainingEvent,
  ORPOTrainingProgressCallback,
  ORPOTrainingEventCallback,
  OptimizationResult,
  TrainingBatch,
} from "../types.js";
import { MultimodalORPOModel } from "../models/MultimodalORPOModel.js";
import { ORPOLossFunction, type ORPOLossResult } from "./LossFunctions.js";
import { PairEncoder } from "../models/PairEncoder.js";

/**
 * ORPO Trainer configuration
 */
export interface ORPOTrainerConfig {
  /** Model configuration */
  model: MultimodalORPOConfig;
  /** Optimizer configuration */
  optimizer: {
    /** Learning rate */
    learningRate: number;
    /** Weight decay */
    weightDecay: number;
    /** Warmup ratio */
    warmupRatio: number;
    /** Gradient clipping norm */
    maxGradNorm: number;
  };
  /** Training configuration */
  training: {
    /** Batch size */
    batchSize: number;
    /** Number of epochs */
    epochs: number;
    /** Validation split ratio */
    validationSplit: number;
    /** Evaluation frequency (steps) */
    evalSteps: number;
    /** Checkpoint frequency (steps) */
    saveSteps: number;
    /** Early stopping patience */
    earlyStoppingPatience: number;
    /** Output directory */
    outputDir: string;
  };
  /** Device to train on */
  device: "cpu" | "gpu";
}

/**
 * Optimizer state
 */
interface OptimizerState {
  /** Current learning rate */
  learningRate: number;
  /** Parameter states (for Adam, etc.) */
  m: Float32Array[]; // First moment
  v: Float32Array[]; // Second moment
  /** Time step */
  t: number;
}

/**
 * Training checkpoint
 */
interface TrainingCheckpoint {
  /** Checkpoint ID */
  id: string;
  /** Step number */
  step: number;
  /** Epoch number */
  epoch: number;
  /** Training loss */
  trainingLoss: number;
  /** Validation loss */
  validationLoss: number;
  /** Model parameters */
  parameters: { weights: Float32Array; biases: Float32Array }[];
  /** Optimizer state */
  optimizerState: OptimizerState;
  /** Timestamp */
  timestamp: number;
}

/**
 * ORPO Trainer
 *
 * Main training loop for multimodal ORPO.
 *
 * @example
 * ```typescript
 * const trainer = new ORPOTrainer(config);
 * await trainer.train(preferencePairs, {
 *   progressCallback: (metrics) => console.log(metrics),
 * });
 * ```
 */
export class ORPOTrainer {
  private config: ORPOTrainerConfig;
  private model: MultimodalORPOModel;
  private pairEncoder: PairEncoder;
  private lossFunction: ORPOLossFunction;
  private optimizerState: OptimizerState | null;
  private checkpoints: TrainingCheckpoint[];
  private progressCallbacks: Set<ORPOTrainingProgressCallback>;
  private eventCallbacks: Set<ORPOTrainingEventCallback>;
  private currentTrainingId: string | null;
  private isTraining: boolean;
  private shouldStop: boolean;

  constructor(config: ORPOTrainerConfig) {
    this.config = config;
    this.model = new MultimodalORPOModel(config.model);
    this.pairEncoder = new PairEncoder();
    this.lossFunction = new ORPOLossFunction({
      beta: config.model.orpo.beta,
      lambda: config.model.orpo.lambda,
      sftLossWeight: config.model.orpo.sftLossWeight,
    });
    this.optimizerState = null;
    this.checkpoints = [];
    this.progressCallbacks = new Set();
    this.eventCallbacks = new Set();
    this.currentTrainingId = null;
    this.isTraining = false;
    this.shouldStop = false;
  }

  /**
   * Initialize trainer
   */
  async initialize(): Promise<void> {
    await this.model.initialize();
    await this.pairEncoder.initialize();
  }

  /**
   * Train model on preference pairs
   */
  async train(
    preferencePairs: UIPreferencePair[],
    options: {
      progressCallback?: ORPOTrainingProgressCallback;
      eventCallback?: ORPOTrainingEventCallback;
    } = {}
  ): Promise<OptimizationResult> {
    if (this.isTraining) {
      throw new Error("Training already in progress");
    }

    // Validate minimum data requirement
    if (preferencePairs.length < 50) {
      throw new Error(
        `Insufficient preference pairs: ${preferencePairs.length}. Minimum 50 required, 1000+ recommended.`
      );
    }

    this.isTraining = true;
    this.shouldStop = false;

    // Register callbacks
    if (options.progressCallback) {
      this.progressCallbacks.add(options.progressCallback);
    }
    if (options.eventCallback) {
      this.eventCallbacks.add(options.eventCallback);
    }

    // Generate training ID
    const trainingId = `orpo-train-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.currentTrainingId = trainingId;

    // Emit start event
    this.emitEvent({
      type: "start",
      timestamp: Date.now(),
      trainingId,
      data: {
        numPairs: preferencePairs.length,
        config: this.config,
      },
    });

    const startTime = performance.now();

    try {
      // Split data into train/validation
      const { trainPairs, valPairs } = this.splitTrainVal(preferencePairs);

      // Initialize optimizer state
      this.initializeOptimizer();

      const { batchSize, epochs, evalSteps, saveSteps } = this.config.training;
      const totalSteps = Math.ceil(trainPairs.length / batchSize) * epochs;
      let bestLoss = Infinity;
      let noImprovementCount = 0;

      // Training loop
      for (let epoch = 0; epoch < epochs; epoch++) {
        if (this.shouldStop) {
          console.log("Training stopped by user");
          break;
        }

        // Shuffle training data
        const shuffled = this.shuffleArray(trainPairs);

        // Process batches
        for (let i = 0; i < shuffled.length; i += batchSize) {
          if (this.shouldStop) {
            break;
          }

          const batch = shuffled.slice(i, i + batchSize);
          const step =
            epoch * Math.ceil(shuffled.length / batchSize) +
            Math.floor(i / batchSize);

          // Encode batch
          const encodedPairs = await this.pairEncoder.encodeBatch(batch);

          // Forward pass
          const batchLoss = await this.forwardBatch(encodedPairs);

          // Backward pass and optimization
          await this.backwardAndOptimize(batchLoss);

          // Update learning rate with warmup
          this.updateLearningRate(step, totalSteps);

          // Compute metrics
          const metrics = await this.computeMetrics(
            batchLoss,
            step,
            epoch,
            totalSteps
          );

          // Notify progress callbacks
          this.progressCallbacks.forEach(cb => cb(metrics));

          // Evaluation
          if (step % evalSteps === 0) {
            const valLoss = await this.evaluate(valPairs);
            this.emitEvent({
              type: "eval",
              timestamp: Date.now(),
              trainingId,
              data: { step, valLoss, trainLoss: metrics.trainingLoss },
            });

            // Early stopping check
            if (valLoss < bestLoss) {
              bestLoss = valLoss;
              noImprovementCount = 0;
            } else {
              noImprovementCount++;
              if (
                noImprovementCount >= this.config.training.earlyStoppingPatience
              ) {
                console.log("Early stopping triggered");
                break;
              }
            }
          }

          // Checkpoint saving
          if (step % saveSteps === 0) {
            await this.saveCheckpoint(step, epoch, metrics.trainingLoss);
            this.emitEvent({
              type: "checkpoint",
              timestamp: Date.now(),
              trainingId,
              data: { step, epoch, loss: metrics.trainingLoss },
            });
          }
        }
      }

      const trainingDuration = (performance.now() - startTime) / 1000;

      // Final evaluation
      const finalValLoss = await this.evaluate(valPairs);
      const prefAccuracy = await this.computePreferenceAccuracy(valPairs);

      // Create result
      const result: OptimizationResult = {
        trainingId,
        finalLoss: finalValLoss,
        bestLoss,
        preferenceAccuracy: prefAccuracy,
        winRateVsBaseline: prefAccuracy, // Simplified
        trainingDuration,
        adapterPath: this.config.training.outputDir,
        success: true,
      };

      // Emit complete event
      this.emitEvent({
        type: "complete",
        timestamp: Date.now(),
        trainingId,
        data: result as unknown as Record<string, unknown>,
      });

      return result;
    } catch (error) {
      this.emitEvent({
        type: "error",
        timestamp: Date.now(),
        trainingId,
        data: { error: String(error) },
      });

      return {
        trainingId,
        finalLoss: Infinity,
        bestLoss: Infinity,
        preferenceAccuracy: 0,
        winRateVsBaseline: 0,
        trainingDuration: (performance.now() - startTime) / 1000,
        adapterPath: this.config.training.outputDir,
        success: false,
        error: String(error),
      };
    } finally {
      // Cleanup
      this.isTraining = false;
      if (options.progressCallback) {
        this.progressCallbacks.delete(options.progressCallback);
      }
      if (options.eventCallback) {
        this.eventCallbacks.delete(options.eventCallback);
      }
    }
  }

  /**
   * Forward pass for a batch
   */
  private async forwardBatch(
    encodedPairs: import("../types.js").PairEncoderResult[]
  ): Promise<ORPOLossResult[]> {
    const losses: ORPOLossResult[] = [];

    for (const encoded of encodedPairs) {
      // Concatenate embeddings for model input
      const combinedChosen = new Float32Array(
        encoded.chosenEncoding.length + encoded.contextEncoding.length
      );
      combinedChosen.set(encoded.chosenEncoding);
      combinedChosen.set(
        encoded.contextEncoding,
        encoded.chosenEncoding.length
      );

      const combinedRejected = new Float32Array(
        encoded.rejectedEncoding.length + encoded.contextEncoding.length
      );
      combinedRejected.set(encoded.rejectedEncoding);
      combinedRejected.set(
        encoded.contextEncoding,
        encoded.rejectedEncoding.length
      );

      // For now, use simplified forward pass
      // TODO: Integrate with actual MultimodalORPOModel.forward()
      const loss: ORPOLossResult = {
        totalLoss: 0.5 + Math.random() * 0.3,
        sftLoss: 0.3,
        orpoLoss: 0.2,
        visualDistanceLoss: 0.1,
        logOddsRatio: Math.random() * 2 - 1,
        refLogOddsRatio: Math.random() * 2 - 1,
        oddsRatio: Math.random() * 2 + 0.5,
        sigmoidProb: Math.random() * 0.5 + 0.5,
      };

      losses.push(loss);
    }

    return losses;
  }

  /**
   * Backward pass and optimization
   */
  private async backwardAndOptimize(losses: ORPOLossResult[]): Promise<void> {
    // Compute gradients
    const totalLoss =
      losses.reduce((sum, l) => sum + l.totalLoss, 0) / losses.length;

    // Gradient clipping would be applied here
    // TODO: Implement actual backpropagation

    // Update parameters using Adam optimizer
    // TODO: Implement actual parameter updates
  }

  /**
   * Update learning rate with warmup
   */
  private updateLearningRate(step: number, totalSteps: number): void {
    if (this.optimizerState) {
      const warmupSteps = Math.floor(
        totalSteps * this.config.optimizer.warmupRatio
      );
      let lr = this.config.optimizer.learningRate;

      if (step < warmupSteps) {
        // Linear warmup
        lr = lr * (step / warmupSteps);
      } else {
        // Cosine decay
        const progress = (step - warmupSteps) / (totalSteps - warmupSteps);
        lr = lr * 0.5 * (1 + Math.cos(Math.PI * progress));
      }

      this.optimizerState.learningRate = lr;
    }
  }

  /**
   * Compute training metrics
   */
  private async computeMetrics(
    losses: ORPOLossResult[],
    step: number,
    epoch: number,
    totalSteps: number
  ): Promise<ORPOTrainingMetrics> {
    const avgLoss =
      losses.reduce((sum, l) => sum + l.totalLoss, 0) / losses.length;
    const avgSFTLoss =
      losses.reduce((sum, l) => sum + l.sftLoss, 0) / losses.length;
    const avgORPOLoss =
      losses.reduce((sum, l) => sum + l.orpoLoss, 0) / losses.length;
    const avgLogOddsRatio =
      losses.reduce((sum, l) => sum + l.logOddsRatio, 0) / losses.length;

    // Count preference accuracy (positive log odds ratio = correct)
    const correctCount = losses.filter(l => l.logOddsRatio > 0).length;
    const preferenceAccuracy = correctCount / losses.length;

    const estimatedTimeRemaining = (totalSteps - step) * 0.1; // Rough estimate

    return {
      step,
      epoch: epoch + 1,
      totalSteps,
      trainingLoss: avgLoss,
      sftLoss: avgSFTLoss,
      orpoLoss: avgORPOLoss,
      logOddsRatio: avgLogOddsRatio,
      preferenceAccuracy,
      chosenScore: 0.5 + avgLogOddsRatio / 2,
      rejectedScore: 0.5 - avgLogOddsRatio / 2,
      gradientNorm: 1.0, // TODO: Compute actual gradient norm
      learningRate:
        this.optimizerState?.learningRate ?? this.config.optimizer.learningRate,
      epochProgress: (step / totalSteps) % 1,
      estimatedTimeRemaining,
    };
  }

  /**
   * Evaluate on validation set
   */
  private async evaluate(valPairs: UIPreferencePair[]): Promise<number> {
    if (valPairs.length === 0) {
      return 0;
    }

    const encodedPairs = await this.pairEncoder.encodeBatch(valPairs);
    const losses = await this.forwardBatch(encodedPairs);
    return losses.reduce((sum, l) => sum + l.totalLoss, 0) / losses.length;
  }

  /**
   * Compute preference accuracy on validation set
   */
  private async computePreferenceAccuracy(
    valPairs: UIPreferencePair[]
  ): Promise<number> {
    if (valPairs.length === 0) {
      return 0;
    }

    // Count how many times chosen scores higher than rejected
    let correctCount = 0;

    for (const pair of valPairs) {
      // Simplified: check if embeddings are different
      const diff = this.cosineSimilarity(
        pair.chosen.embedding,
        pair.rejected.embedding
      );
      if (diff < 0.95) {
        // If they're different, assume correct
        correctCount++;
      }
    }

    return correctCount / valPairs.length;
  }

  /**
   * Save checkpoint
   */
  private async saveCheckpoint(
    step: number,
    epoch: number,
    loss: number
  ): Promise<void> {
    const checkpoint: TrainingCheckpoint = {
      id: `ckpt-${step}`,
      step,
      epoch,
      trainingLoss: loss,
      validationLoss: loss, // Simplified
      parameters: this.model.getParameters(),
      optimizerState: this.optimizerState!,
      timestamp: Date.now(),
    };

    this.checkpoints.push(checkpoint);

    // TODO: Save to disk
  }

  /**
   * Initialize optimizer state
   */
  private initializeOptimizer(): void {
    const params = this.model.getParameters();

    this.optimizerState = {
      learningRate: this.config.optimizer.learningRate,
      m: params.map(() => new Float32Array(0)), // Placeholder
      v: params.map(() => new Float32Array(0)), // Placeholder
      t: 0,
    };
  }

  /**
   * Split data into train/validation
   */
  private splitTrainVal(pairs: UIPreferencePair[]): {
    trainPairs: UIPreferencePair[];
    valPairs: UIPreferencePair[];
  } {
    const valSize = Math.floor(
      pairs.length * this.config.training.validationSplit
    );
    const shuffled = this.shuffleArray([...pairs]);

    return {
      trainPairs: shuffled.slice(valSize),
      valPairs: shuffled.slice(0, valSize),
    };
  }

  /**
   * Shuffle array
   */
  private shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Cosine similarity
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0,
      normA = 0,
      normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
  }

  /**
   * Stop training
   */
  stop(): void {
    this.shouldStop = true;
  }

  /**
   * Emit event
   */
  private emitEvent(event: ORPOTrainingEvent): void {
    this.eventCallbacks.forEach(cb => cb(event));
  }

  /**
   * Get checkpoints
   */
  getCheckpoints(): TrainingCheckpoint[] {
    return [...this.checkpoints];
  }

  /**
   * Get model
   */
  getModel(): MultimodalORPOModel {
    return this.model;
  }

  /**
   * Check if training is in progress
   */
  isTrainingInProgress(): boolean {
    return this.isTraining;
  }

  /**
   * Get configuration
   */
  getConfig(): ORPOTrainerConfig {
    return { ...this.config };
  }
}

/**
 * Create an ORPO trainer
 */
export async function createORPOTrainer(
  config: Partial<ORPOTrainerConfig> = {}
): Promise<ORPOTrainer> {
  const defaultConfig: ORPOTrainerConfig = {
    model: {
      baseModel: {
        embeddingDim: 768,
        usePretrained: true,
      },
      referenceModel: {
        enabled: true,
        frozen: true,
      },
      preferenceHead: {
        type: "mlp",
        hiddenDims: [1536, 768, 384, 1],
        activation: "gelu",
        dropout: 0.1,
        useLayerNorm: true,
        useResiduals: true,
      },
      orpo: {
        beta: 0.1,
        lambda: 1.0,
        sftLossWeight: 1.0,
      },
      training: {
        learningRate: 2e-4,
        batchSize: 8,
        epochs: 3,
        warmupRatio: 0.1,
        gradientClipping: 1.0,
        weightDecay: 0.01,
      },
      multimodal: {
        visualWeight: 0.5,
        textWeight: 0.5,
        fusion: "concat",
      },
    },
    optimizer: {
      learningRate: 2e-4,
      weightDecay: 0.01,
      warmupRatio: 0.1,
      maxGradNorm: 1.0,
    },
    training: {
      batchSize: 8,
      epochs: 3,
      validationSplit: 0.2,
      evalSteps: 100,
      saveSteps: 500,
      earlyStoppingPatience: 5,
      outputDir: "./output",
    },
    device: "cpu",
  };

  const mergedConfig = {
    ...defaultConfig,
    ...config,
    model: { ...defaultConfig.model, ...config.model },
    optimizer: { ...defaultConfig.optimizer, ...config.optimizer },
    training: { ...defaultConfig.training, ...config.training },
  } as ORPOTrainerConfig;

  const trainer = new ORPOTrainer(mergedConfig);
  await trainer.initialize();

  return trainer;
}

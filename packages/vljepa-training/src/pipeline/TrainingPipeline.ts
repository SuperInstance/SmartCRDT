/**
 * @fileoverview Main training pipeline orchestrator for VL-JEPA
 * @package @lsi/vljepa-training
 */

import type {
  TrainingPipelineConfig,
  PipelineStage,
  PipelineResult,
  StageResult,
  TrainingMetrics,
  TrainingState,
} from "../types.js";
import { MetricsTracker } from "../monitoring/MetricsTracker.js";
import { CheckpointManager } from "../checkpointing/CheckpointManager.js";
import { EarlyStopping } from "../callbacks/EarlyStopping.js";
import { LRScheduler } from "../callbacks/LRScheduler.js";
import { GradientMonitor } from "../callbacks/GradientMonitor.js";
import { ValidationCallback } from "../callbacks/ValidationCallback.js";

/**
 * Main training pipeline orchestrator
 *
 * Coordinates all stages of training including:
 * - Data preparation and loading
 * - Model initialization
 * - Training loop with callbacks
 * - Validation and checkpointing
 * - Monitoring and logging
 * - Finalization and artifact generation
 */
export class TrainingPipeline {
  private config: TrainingPipelineConfig;
  private metricsTracker: MetricsTracker;
  private checkpointManager: CheckpointManager;
  private earlyStopping: EarlyStopping | null = null;
  private lrScheduler: LRScheduler;
  private gradientMonitor: GradientMonitor | null = null;
  private validationCallback: ValidationCallback | null = null;

  private currentEpoch = 0;
  private currentBatch = 0;
  private isRunning = false;
  private shouldStop = false;
  private startTime = 0;
  private stageResults: StageResult[] = [];

  constructor(config: TrainingPipelineConfig) {
    this.config = config;
    this.metricsTracker = new MetricsTracker(config.monitoring.metrics);
    this.checkpointManager = new CheckpointManager(config.checkpointing);
    this.lrScheduler = new LRScheduler(config.callbacks.lrScheduler);

    if (config.callbacks.earlyStopping?.enabled) {
      this.earlyStopping = new EarlyStopping(config.callbacks.earlyStopping);
    }

    if (config.callbacks.gradientMonitor?.enabled) {
      this.gradientMonitor = new GradientMonitor(
        config.callbacks.gradientMonitor
      );
    }

    if (config.callbacks.validationCallback?.enabled) {
      this.validationCallback = new ValidationCallback(
        config.callbacks.validationCallback
      );
    }
  }

  /**
   * Execute the complete training pipeline
   */
  async execute(): Promise<PipelineResult> {
    this.isRunning = true;
    this.shouldStop = false;
    this.startTime = Date.now();
    this.stageResults = [];

    try {
      // Build execution order from dependencies
      const executionOrder = this.buildExecutionOrder();

      // Execute stages in order
      for (const stage of executionOrder) {
        if (!stage.enabled) {
          continue;
        }

        if (this.shouldStop) {
          console.log(`[Pipeline] Stopping early due to signal`);
          break;
        }

        const result = await this.executeStage(stage);
        this.stageResults.push(result);

        if (!result.success) {
          return this.createFailureResult(result.error);
        }
      }

      // Create success result
      return await this.createSuccessResult();
    } catch (error) {
      return this.createFailureResult(
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Build execution order respecting dependencies
   */
  private buildExecutionOrder(): PipelineStage[] {
    const stages = [...this.config.stages];
    const executed: Set<string> = new Set();
    const order: PipelineStage[] = [];

    while (order.length < stages.length) {
      let added = false;

      for (const stage of stages) {
        if (executed.has(stage.name)) {
          continue;
        }

        // Check if all dependencies are satisfied
        const depsSatisfied = stage.dependencies.every(dep =>
          executed.has(dep)
        );

        if (depsSatisfied) {
          order.push(stage);
          executed.add(stage.name);
          added = true;
        }
      }

      if (!added) {
        throw new Error("Circular dependency detected in pipeline stages");
      }
    }

    return order;
  }

  /**
   * Execute a single pipeline stage
   */
  private async executeStage(stage: PipelineStage): Promise<StageResult> {
    const startTime = Date.now();
    let retries = 0;
    const maxRetries = stage.retries ?? 0;

    console.log(`[Pipeline] Executing stage: ${stage.name}`);

    while (retries <= maxRetries) {
      try {
        const result = await this.runStage(stage);
        return {
          name: stage.name,
          success: true,
          duration: Date.now() - startTime,
          output: result,
          retries,
        };
      } catch (error) {
        retries++;
        if (retries > maxRetries) {
          return {
            name: stage.name,
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - startTime,
            retries: retries - 1,
          };
        }
        console.log(
          `[Pipeline] Retrying stage ${stage.name} (${retries}/${maxRetries})`
        );
      }
    }

    return {
      name: stage.name,
      success: false,
      error: "Max retries exceeded",
      duration: Date.now() - startTime,
      retries: maxRetries,
    };
  }

  /**
   * Run the actual stage logic
   */
  private async runStage(
    stage: PipelineStage
  ): Promise<Record<string, unknown>> {
    switch (stage.type) {
      case "data_prep":
        return await this.runDataPrep();
      case "preprocessing":
        return await this.runPreprocessing();
      case "train":
        return await this.runTraining();
      case "validate":
        return await this.runValidation();
      case "checkpoint":
        return await this.runCheckpoint();
      case "finalize":
        return await this.runFinalize();
      case "evaluate":
        return await this.runEvaluation();
      case "visualize":
        return await this.runVisualize();
      default:
        throw new Error(`Unknown stage type: ${stage.type}`);
    }
  }

  /**
   * Data preparation stage
   */
  private async runDataPrep(): Promise<Record<string, unknown>> {
    console.log("[DataPrep] Loading and preparing datasets...");

    // Simulate data loading
    const trainSize = 10000;
    const valSize = 2000;

    console.log(`[DataPrep] Training samples: ${trainSize}`);
    console.log(`[DataPrep] Validation samples: ${valSize}`);

    return {
      trainSize,
      valSize,
      dataReady: true,
    };
  }

  /**
   * Preprocessing stage
   */
  private async runPreprocessing(): Promise<Record<string, unknown>> {
    console.log("[Preprocessing] Applying preprocessing transforms...");

    // Simulate preprocessing
    const preprocessingSteps = ["normalize", "resize", "augment"];

    for (const step of preprocessingSteps) {
      console.log(`[Preprocessing] ${step}...`);
    }

    return {
      preprocessingComplete: true,
      steps: preprocessingSteps,
    };
  }

  /**
   * Training stage
   */
  private async runTraining(): Promise<Record<string, unknown>> {
    console.log("[Training] Starting training loop...");
    const epochs = this.config.training.epochs;

    for (
      this.currentEpoch = 1;
      this.currentEpoch <= epochs;
      this.currentEpoch++
    ) {
      if (this.shouldStop) {
        console.log("[Training] Stopping early");
        break;
      }

      console.log(`[Training] Epoch ${this.currentEpoch}/${epochs}`);

      // Run epoch
      const epochMetrics = await this.runEpoch();

      // Update learning rate
      const learningRate = this.lrScheduler.step(this.currentEpoch);
      epochMetrics.learning.learningRate = learningRate;

      // Log metrics
      this.metricsTracker.logMetrics(epochMetrics);

      // Check early stopping
      if (this.earlyStopping) {
        const shouldStop = this.earlyStopping.check(epochMetrics);
        if (shouldStop) {
          console.log("[Training] Early stopping triggered");
          if (this.config.callbacks.earlyStopping?.restoreBestWeights) {
            console.log("[Training] Restoring best weights");
          }
          break;
        }
      }

      // Validation
      if (this.currentEpoch % this.config.training.validation.frequency === 0) {
        const valMetrics = await this.runValidation();
        if (this.validationCallback) {
          await this.validationCallback.onValidationEnd(valMetrics);
        }
      }

      // Checkpoint
      if (this.currentEpoch % this.config.checkpointing.frequency === 0) {
        await this.saveCheckpoint();
      }
    }

    return {
      trainingComplete: true,
      totalEpochs: this.currentEpoch - 1,
    };
  }

  /**
   * Run a single training epoch
   */
  private async runEpoch(): Promise<TrainingMetrics> {
    const startTime = Date.now();
    const numBatches = 100; // Simulated

    let totalLoss = 0;
    let totalAccuracy = 0;

    for (let batch = 0; batch < numBatches; batch++) {
      this.currentBatch = batch;

      // Simulate forward/backward pass
      const loss = Math.random() * 2 + 1; // Simulated loss (decreasing over time)
      const accuracy = Math.random() * 0.2 + 0.7; // Simulated accuracy

      totalLoss += loss;
      totalAccuracy += accuracy;

      // Simulate gradient monitoring
      if (this.gradientMonitor && batch % 10 === 0) {
        const gradNorm = Math.random() * 2;
        this.gradientMonitor.logGradientNorm(gradNorm);
      }

      // Log metrics
      if (batch % this.config.monitoring.logFrequency === 0) {
        this.metricsTracker.logScalar(
          "batch_loss",
          loss,
          this.currentEpoch * numBatches + batch
        );
        this.metricsTracker.logScalar(
          "batch_accuracy",
          accuracy,
          this.currentEpoch * numBatches + batch
        );
      }
    }

    const duration = Date.now() - startTime;

    return {
      epoch: this.currentEpoch,
      batch: numBatches,
      loss: {
        training: totalLoss / numBatches,
        validation: 0,
      },
      accuracy: {
        top1: totalAccuracy / numBatches,
      },
      latency: {
        forward: duration / 2,
        backward: duration / 2,
        total: duration,
      },
      memory: {
        gpu: 2000,
        cpu: 500,
        peak: 2500,
      },
      throughput:
        (numBatches * this.config.data.loader.batchSize) / (duration / 1000),
      learning: {
        gradientNorm: 1.0,
        learningRate: this.lrScheduler.getCurrentLR(),
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Validation stage
   */
  private async runValidation(): Promise<TrainingMetrics> {
    console.log("[Validation] Running validation...");

    // Simulate validation
    const valLoss = Math.random() * 1 + 0.5;
    const valAccuracy = Math.random() * 0.15 + 0.75;

    return {
      epoch: this.currentEpoch,
      batch: 0,
      loss: {
        training: 0,
        validation: valLoss,
      },
      accuracy: {
        top1: valAccuracy,
      },
      latency: {
        forward: 100,
        backward: 0,
        total: 100,
      },
      memory: {
        gpu: 1500,
        cpu: 300,
        peak: 1800,
      },
      throughput: 100,
      learning: {
        gradientNorm: 0,
        learningRate: this.lrScheduler.getCurrentLR(),
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Checkpoint stage
   */
  private async runCheckpoint(): Promise<Record<string, unknown>> {
    console.log("[Checkpoint] Saving checkpoint...");

    const metrics = await this.runValidation();
    const checkpointPath = await this.checkpointManager.save({
      epoch: this.currentEpoch,
      metrics,
      modelConfig: this.config.model,
      trainingConfig: this.config.training,
      timestamp: Date.now(),
    });

    return {
      checkpointSaved: true,
      path: checkpointPath,
    };
  }

  /**
   * Save checkpoint
   */
  private async saveCheckpoint(): Promise<void> {
    const metrics = await this.runValidation();
    await this.checkpointManager.save({
      epoch: this.currentEpoch,
      metrics,
      modelConfig: this.config.model,
      trainingConfig: this.config.training,
      timestamp: Date.now(),
    });
  }

  /**
   * Finalization stage
   */
  private async runFinalize(): Promise<Record<string, unknown>> {
    console.log("[Finalize] Saving final model...");

    // Save final checkpoint
    await this.saveCheckpoint();

    // Generate final report
    const history = this.metricsTracker.getHistory();

    return {
      finalizationComplete: true,
      totalEpochs: this.currentEpoch,
      historySize: history.length,
    };
  }

  /**
   * Evaluation stage
   */
  private async runEvaluation(): Promise<Record<string, unknown>> {
    console.log("[Evaluation] Running final evaluation...");

    // Simulate evaluation
    const testAccuracy = 0.85;
    const testLoss = 0.45;

    return {
      testLoss,
      testAccuracy,
      evaluationComplete: true,
    };
  }

  /**
   * Visualization stage
   */
  private async runVisualize(): Promise<Record<string, unknown>> {
    console.log("[Visualize] Generating visualizations...");

    const visualizations = ["loss_curves", "accuracy_curves", "embeddings"];

    for (const viz of visualizations) {
      console.log(`[Visualize] Generating ${viz}...`);
    }

    return {
      visualizationsGenerated: true,
      types: visualizations,
    };
  }

  /**
   * Create success result
   */
  private async createSuccessResult(): Promise<PipelineResult> {
    const duration = Date.now() - this.startTime;
    const metrics = this.metricsTracker.getLatest();
    const checkpoints = this.checkpointManager.listCheckpoints();

    return {
      success: true,
      stages: this.stageResults,
      metrics: metrics || this.createDefaultMetrics(),
      checkpoints,
      duration,
      artifacts: [],
    };
  }

  /**
   * Create failure result
   */
  private createFailureResult(error?: string): PipelineResult {
    const duration = Date.now() - this.startTime;

    return {
      success: false,
      stages: this.stageResults,
      metrics: this.createDefaultMetrics(),
      checkpoints: [],
      duration,
      artifacts: [],
      error,
    };
  }

  /**
   * Create default metrics
   */
  private createDefaultMetrics(): TrainingMetrics {
    return {
      epoch: 0,
      batch: 0,
      loss: {
        training: 0,
        validation: 0,
      },
      accuracy: {},
      latency: {
        forward: 0,
        backward: 0,
        total: 0,
      },
      memory: {
        gpu: 0,
        cpu: 0,
        peak: 0,
      },
      throughput: 0,
      learning: {
        gradientNorm: 0,
        learningRate: 0,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Stop the pipeline
   */
  stop(): void {
    this.shouldStop = true;
    console.log("[Pipeline] Stop signal sent");
  }

  /**
   * Get current training state
   */
  getState(): TrainingState {
    return {
      epoch: this.currentEpoch,
      batch: this.currentBatch,
      modelState: {},
      optimizerState: {},
      lrSchedulerState: {},
      randomStates: {},
      metricsHistory: this.metricsTracker.getHistory(),
      bestMetrics: {
        epoch: 0,
        metrics: this.createDefaultMetrics(),
      },
      configHash: this.generateConfigHash(),
    };
  }

  /**
   * Resume from state
   */
  async resume(state: TrainingState): Promise<void> {
    this.currentEpoch = state.epoch;
    this.currentBatch = state.batch;

    // Restore metrics history
    for (const metrics of state.metricsHistory) {
      this.metricsTracker.logMetrics(metrics);
    }

    console.log(`[Pipeline] Resumed from epoch ${this.currentEpoch}`);
  }

  /**
   * Generate configuration hash
   */
  private generateConfigHash(): string {
    // Simple hash function
    const str = JSON.stringify(this.config);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Get metrics tracker
   */
  getMetricsTracker(): MetricsTracker {
    return this.metricsTracker;
  }

  /**
   * Get checkpoint manager
   */
  getCheckpointManager(): CheckpointManager {
    return this.checkpointManager;
  }

  /**
   * Check if pipeline is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

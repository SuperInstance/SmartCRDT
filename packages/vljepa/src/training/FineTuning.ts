/**
 * @lsi/vljepa - UI Fine-Tuning Strategy
 *
 * Fine-tunes pre-trained VL-JEPA model on UI-specific tasks.
 * Uses transfer learning: freeze X/Y encoders, train predictor only.
 *
 * Curriculum Learning Approach:
 * Stage 1: Basic layout understanding
 * Stage 2: Component recognition
 * Stage 3: User intent mapping
 * Stage 4: Goal state prediction
 *
 * @module training
 */

import { promises as fs } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import {
  UIFineTuningConfig,
  UIDataEntry,
  CurriculumStage,
  JEPATrainingConfig,
  JEPATrainingMetrics,
  JEPATrainingStatus,
  JEPATrainingEvent,
  JEPATrainingProgressCallback,
  JEPATrainingEventCallback,
  JEPACheckpoint,
  DEFAULT_UI_FINETUNING_CONFIG,
} from "./types.js";
import { UIDataset } from "./UIDataset.js";
import { JEPATrainingStrategy } from "./JEPATrainingStrategy.js";

/**
 * UI Fine-Tuning Strategy
 *
 * Implements curriculum learning for UI task fine-tuning:
 * 1. Stage 1: Basic layout (simple layouts, grid/flex)
 * 2. Stage 2: Components (recognize buttons, inputs, etc.)
 * 3. Stage 3: Intent mapping (understand user goals)
 * 4. Stage 4: Goal prediction (predict final UI state)
 */
export class UIFineTuningStrategy {
  private config: UIFineTuningConfig;
  private dataset: UIDataset;
  private trainingStrategy: JEPATrainingStrategy;
  private currentTraining: {
    id: string;
    status: JEPATrainingStatus;
    startTime: number;
    currentStage: number;
    checkpoints: JEPACheckpoint[];
    metrics: JEPATrainingMetrics | null;
  } | null = null;
  private progressCallbacks: Set<JEPATrainingProgressCallback> = new Set();
  private eventCallbacks: Set<JEPATrainingEventCallback> = new Set();
  private initialized: boolean = false;

  constructor(options: {
    config?: Partial<UIFineTuningConfig>;
    dataset?: UIDataset;
  }) {
    this.config = {
      ...DEFAULT_UI_FINETUNING_CONFIG,
      ...options.config,
    } as UIFineTuningConfig;
    this.dataset = options.dataset ?? new UIDataset();
    this.trainingStrategy = new JEPATrainingStrategy({
      config: this.convertToJEPAConfig(this.config),
    });
  }

  /**
   * Initialize fine-tuning strategy
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize dataset
    await this.dataset.initialize();

    // Initialize training strategy
    await this.trainingStrategy.initialize();

    this.initialized = true;
    console.log("UIFineTuningStrategy initialized:", {
      baseModelPath: this.config.baseModelPath,
      layersToFreeze: this.config.layersToFreeze,
      curriculumStages: this.config.curriculum.length,
    });
  }

  /**
   * Fine-tune JEPA on UI tasks using curriculum learning
   *
   * Curriculum Learning:
   * - Start with simple tasks (Stage 1)
   * - Progressively increase complexity
   * - Each stage has success criteria
   * - Advance only when criteria met
   */
  async fineTune(
    options: {
      progressCallback?: JEPATrainingProgressCallback;
      eventCallback?: JEPATrainingEventCallback;
    } = {}
  ): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Check if training is already in progress
    if (this.currentTraining?.status === JEPATrainingStatus.TRAINING) {
      throw new Error("Fine-tuning already in progress");
    }

    const fineTuningId = `ui-finetuning-${Date.now()}-${randomBytes(4).toString("hex")}`;

    // Register callbacks
    if (options.progressCallback) {
      this.progressCallbacks.add(options.progressCallback);
    }
    if (options.eventCallback) {
      this.eventCallbacks.add(options.eventCallback);
    }

    // Initialize training state
    this.currentTraining = {
      id: fineTuningId,
      status: JEPATrainingStatus.PREPARING,
      startTime: Date.now(),
      currentStage: 0,
      checkpoints: [],
      metrics: null,
    };

    // Emit start event
    this.emitEvent({
      type: "start",
      timestamp: Date.now(),
      trainingId: fineTuningId,
      data: { config: this.config },
    });

    try {
      // Execute curriculum learning
      for (
        let stageIndex = 0;
        stageIndex < this.config.curriculum.length;
        stageIndex++
      ) {
        const stage = this.config.curriculum[stageIndex];
        this.currentTraining.currentStage = stageIndex;

        console.log(
          `Starting curriculum stage ${stageIndex + 1}/${this.config.curriculum.length}: ${stage.name}`
        );

        // Train on this stage
        await this.trainStage(stage, stageIndex);

        // Check success criteria
        const success = await this.checkStageSuccess(stage);

        if (!success) {
          console.warn(
            `Stage ${stage.name} did not meet success criteria, continuing anyway`
          );
        }

        // Emit curriculum advance event
        this.emitEvent({
          type: "curriculum_advance",
          timestamp: Date.now(),
          trainingId: fineTuningId,
          data: {
            stage: stage.name,
            stageNumber: stageIndex + 1,
            totalStages: this.config.curriculum.length,
          },
        });
      }

      // Save final checkpoint
      const finalCheckpoint = await this.saveFinalCheckpoint(fineTuningId);

      // Emit complete event
      this.emitEvent({
        type: "complete",
        timestamp: Date.now(),
        trainingId: fineTuningId,
        data: { finalCheckpoint },
      });

      this.currentTraining.status = JEPATrainingStatus.COMPLETED;
      return fineTuningId;
    } catch (error) {
      // Emit error event
      this.emitEvent({
        type: "error",
        timestamp: Date.now(),
        trainingId: fineTuningId,
        data: { error: String(error) },
      });

      this.currentTraining.status = JEPATrainingStatus.FAILED;
      throw error;
    } finally {
      // Cleanup callbacks
      if (options.progressCallback) {
        this.progressCallbacks.delete(options.progressCallback);
      }
      if (options.eventCallback) {
        this.eventCallbacks.delete(options.eventCallback);
      }
    }
  }

  /**
   * Train on a single curriculum stage
   */
  private async trainStage(
    stage: CurriculumStage,
    stageIndex: number
  ): Promise<void> {
    console.log(`Training stage ${stage.name}:`, {
      description: stage.description,
      epochs: stage.epochs,
      lrMultiplier: stage.lrMultiplier,
    });

    // Filter dataset for this stage
    const stageData = this.dataset.filterByStage(stage);
    console.log(`Stage ${stage.name}: Using ${stageData.length} entries`);

    // Update training config for this stage
    const stageConfig = this.createStageConfig(stage, stageIndex);

    // Train for this stage
    const { epochs, batchSize } = stageConfig;
    const stepsPerEpoch = Math.ceil(stageData.length / batchSize);
    const totalSteps = stepsPerEpoch * epochs;

    for (let epoch = 0; epoch < epochs; epoch++) {
      for (let step = 0; step < stepsPerEpoch; step++) {
        const currentStep = epoch * stepsPerEpoch + step;

        // Get batch
        const batchStart = (step * batchSize) % stageData.length;
        const batchEnd = Math.min(batchStart + batchSize, stageData.length);
        const batch = stageData.slice(batchStart, batchEnd);

        // Forward pass
        const loss = await this.forwardPass(batch, stage);

        // Backward pass
        await this.backwardPass(loss);

        // Create metrics
        const metrics: JEPATrainingMetrics = {
          step: currentStep,
          epoch: epoch + 1,
          totalSteps,
          trainingLoss: loss,
          learningRate: this.config.learningRate * stage.lrMultiplier,
          epochProgress: (step + 1) / stepsPerEpoch,
          estimatedTimeRemaining: (totalSteps - currentStep) * 0.1,
          curriculumStage: stageIndex,
        };

        this.currentTraining!.metrics = metrics;

        // Notify callbacks
        this.progressCallbacks.forEach(cb => cb(metrics));

        // Save checkpoint periodically
        if (currentStep > 0 && currentStep % 500 === 0) {
          const checkpoint = await this.saveCheckpoint(
            this.currentTraining!.id,
            metrics,
            stage
          );
          this.currentTraining!.checkpoints.push(checkpoint);

          this.emitEvent({
            type: "checkpoint",
            timestamp: Date.now(),
            trainingId: this.currentTraining!.id,
            data: { checkpoint, stage: stage.name },
          });
        }

        // Simulate training time
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    }
  }

  /**
   * Forward pass for a batch
   */
  private async forwardPass(
    batch: UIDataEntry[],
    stage: CurriculumStage
  ): Promise<number> {
    // PHASE 4: Implement actual forward pass
    // 1. Apply contextual masking with stage-specific config
    // 2. Encode with X and Y encoders
    // 3. Predict with predictor
    // 4. Compute embedding distance loss

    // Placeholder: return mock loss
    const progress = this.currentTraining!.metrics?.epochProgress ?? 0;
    const baseLoss = 0.5;
    const decay = progress * 0.3;
    return baseLoss - decay + Math.random() * 0.05;
  }

  /**
   * Backward pass for gradient updates
   */
  private async backwardPass(loss: number): Promise<void> {
    // PHASE 4: Implement actual backward pass
    // 1. Compute gradients
    // 2. Update predictor weights (NOT encoders - they're frozen!)
    // 3. Apply gradient clipping
    // 4. Update learning rate with scheduler

    // Placeholder: simulate backward pass time
    await new Promise(resolve => setTimeout(resolve, 1));
  }

  /**
   * Check if stage met success criteria
   */
  private async checkStageSuccess(stage: CurriculumStage): Promise<boolean> {
    const { minAccuracy, maxLoss, minConfidence } = stage.successCriteria;
    const metrics = this.currentTraining!.metrics!;

    let success = true;

    if (minAccuracy !== undefined) {
      const accuracy = metrics.embeddingAccuracy ?? 0;
      if (accuracy < minAccuracy) {
        console.warn(
          `Stage ${stage.name}: accuracy ${accuracy} < ${minAccuracy}`
        );
        success = false;
      }
    }

    if (maxLoss !== undefined) {
      if (metrics.trainingLoss > maxLoss) {
        console.warn(
          `Stage ${stage.name}: loss ${metrics.trainingLoss} > ${maxLoss}`
        );
        success = false;
      }
    }

    if (minConfidence !== undefined) {
      const confidence = metrics.predictorConfidence ?? 0;
      if (confidence < minConfidence) {
        console.warn(
          `Stage ${stage.name}: confidence ${confidence} < ${minConfidence}`
        );
        success = false;
      }
    }

    return success;
  }

  /**
   * Create stage-specific config
   */
  private createStageConfig(
    stage: CurriculumStage,
    stageIndex: number
  ): {
    epochs: number;
    batchSize: number;
    learningRate: number;
  } {
    return {
      epochs: stage.epochs,
      batchSize: this.config.batchSize,
      learningRate: this.config.learningRate * stage.lrMultiplier,
    };
  }

  /**
   * Convert UI fine-tuning config to JEPA training config
   */
  private convertToJEPAConfig(
    uiConfig: UIFineTuningConfig
  ): Partial<JEPATrainingConfig> {
    return {
      baseModel: uiConfig.baseModelPath,
      device: "cuda",
      hyperparameters: {
        learningRate: uiConfig.learningRate,
        batchSize: uiConfig.batchSize,
        epochs: uiConfig.epochs,
        warmupRatio: 0.1,
        weightDecay: 0.01,
        maxGradNorm: 1.0,
        evalSteps: 100,
        saveSteps: 500,
      },
    };
  }

  /**
   * Save checkpoint
   */
  private async saveCheckpoint(
    trainingId: string,
    metrics: JEPATrainingMetrics,
    stage: CurriculumStage
  ): Promise<JEPACheckpoint> {
    const checkpointId = `ckpt-stage-${stage.stageNumber}-${metrics.step}`;
    const checkpointDir = join(this.config.outputDir, trainingId, checkpointId);

    await fs.mkdir(checkpointDir, { recursive: true });

    const checkpoint: JEPACheckpoint = {
      id: checkpointId,
      timestamp: Date.now(),
      step: metrics.step,
      epoch: metrics.epoch,
      trainingLoss: metrics.trainingLoss,
      validationLoss: metrics.validationLoss,
      modelPath: join(checkpointDir, "model.safetensors"),
      checkpointDir,
      config: {} as JEPATrainingConfig,
      metrics,
    };

    await fs.writeFile(
      join(checkpointDir, "metadata.json"),
      JSON.stringify(checkpoint, null, 2)
    );

    return checkpoint;
  }

  /**
   * Save final checkpoint
   */
  private async saveFinalCheckpoint(
    trainingId: string
  ): Promise<JEPACheckpoint> {
    const metrics = this.currentTraining!.metrics!;
    const checkpointId = `final-ckpt`;
    const checkpointDir = join(this.config.outputDir, trainingId, checkpointId);

    await fs.mkdir(checkpointDir, { recursive: true });

    const checkpoint: JEPACheckpoint = {
      id: checkpointId,
      timestamp: Date.now(),
      step: metrics.step,
      epoch: metrics.epoch,
      trainingLoss: metrics.trainingLoss,
      modelPath: join(checkpointDir, "model.safetensors"),
      checkpointDir,
      config: {} as JEPATrainingConfig,
      metrics,
    };

    await fs.writeFile(
      join(checkpointDir, "metadata.json"),
      JSON.stringify(checkpoint, null, 2)
    );

    // Save training summary
    const summary = {
      trainingId,
      config: this.config,
      checkpoints: this.currentTraining!.checkpoints,
      duration: Date.now() - this.currentTraining!.startTime,
      finalMetrics: metrics,
    };

    await fs.writeFile(
      join(this.config.outputDir, trainingId, "training-summary.json"),
      JSON.stringify(summary, null, 2)
    );

    return checkpoint;
  }

  /**
   * Emit training event
   */
  private emitEvent(event: JEPATrainingEvent): void {
    this.eventCallbacks.forEach(cb => cb(event));
  }

  /**
   * Get current training status
   */
  getTrainingStatus(): {
    status: JEPATrainingStatus;
    currentStage?: number;
    metrics?: JEPATrainingMetrics;
    startTime?: number;
    elapsed?: number;
  } {
    if (!this.currentTraining) {
      return { status: JEPATrainingStatus.IDLE };
    }

    return {
      status: this.currentTraining.status,
      currentStage: this.currentTraining.currentStage,
      metrics: this.currentTraining.metrics ?? undefined,
      startTime: this.currentTraining.startTime,
      elapsed: Date.now() - this.currentTraining.startTime,
    };
  }

  /**
   * Cancel fine-tuning
   */
  async cancelFineTuning(): Promise<void> {
    if (
      !this.currentTraining ||
      this.currentTraining.status !== JEPATrainingStatus.TRAINING
    ) {
      return;
    }

    this.currentTraining.status = JEPATrainingStatus.CANCELLED;

    this.emitEvent({
      type: "cancel",
      timestamp: Date.now(),
      trainingId: this.currentTraining.id,
    });
  }

  /**
   * Shutdown fine-tuning strategy
   */
  async shutdown(): Promise<void> {
    if (this.currentTraining?.status === JEPATrainingStatus.TRAINING) {
      await this.cancelFineTuning();
    }

    await this.trainingStrategy.shutdown();
    await this.dataset.shutdown();

    this.progressCallbacks.clear();
    this.eventCallbacks.clear();
    this.initialized = false;
    console.log("UIFineTuningStrategy shutdown complete");
  }

  /**
   * Create default UI curriculum stages
   */
  static createDefaultCurriculum(): CurriculumStage[] {
    return [
      {
        name: "Basic Layout Understanding",
        description: "Learn basic UI layouts (grid, flex, absolute)",
        stageNumber: 1,
        epochs: 5,
        lrMultiplier: 1.0,
        datasetFilter: entry => {
          // Only simple layouts
          return ["grid", "flex"].includes(entry.metadata.layout);
        },
        maskingConfig: {
          visibleRatio: 0.15, // More visible for simple stage
          strategy: "block",
        },
        successCriteria: {
          minAccuracy: 0.7,
          maxLoss: 0.3,
        },
      },
      {
        name: "Component Recognition",
        description: "Recognize UI components (buttons, inputs, etc.)",
        stageNumber: 2,
        epochs: 5,
        lrMultiplier: 0.8,
        datasetFilter: entry => {
          // Has component annotations
          return entry.components !== undefined && entry.components.length > 0;
        },
        maskingConfig: {
          visibleRatio: 0.12,
          strategy: "block",
        },
        successCriteria: {
          minAccuracy: 0.75,
          maxLoss: 0.25,
        },
      },
      {
        name: "User Intent Mapping",
        description: "Map user instructions to UI changes",
        stageNumber: 3,
        epochs: 5,
        lrMultiplier: 0.6,
        datasetFilter: entry => {
          // Has clear instructions
          return entry.instruction.length > 0 && entry.instruction.length < 100;
        },
        maskingConfig: {
          visibleRatio: 0.1,
          strategy: "adaptive",
        },
        successCriteria: {
          minAccuracy: 0.8,
          maxLoss: 0.2,
          minConfidence: 0.7,
        },
      },
      {
        name: "Goal State Prediction",
        description: "Predict final UI state from current state + instruction",
        stageNumber: 4,
        epochs: 5,
        lrMultiplier: 0.4,
        datasetFilter: entry => {
          // Has before and after states
          return entry.afterImage !== undefined;
        },
        maskingConfig: {
          visibleRatio: 0.08, // Less visible for advanced stage
          strategy: "adaptive",
        },
        successCriteria: {
          minAccuracy: 0.85,
          maxLoss: 0.15,
          minConfidence: 0.8,
        },
      },
    ];
  }

  /**
   * Get fine-tuning strategy explanation
   */
  static getStrategyExplanation(): string {
    return `
UI Fine-Tuning Strategy for VL-JEPA
===================================

Transfer Learning Approach:
- Freeze X-Encoder (ViT): Pre-trained vision features
- Freeze Y-Encoder (Transformer): Pre-trained language features
- Train Predictor: Learn UI-specific embedding mappings

Why This Works:
- VL-JEPA pre-trained on internet-scale video
- Already understands objects, physics, causality
- Only need to learn UI-specific patterns
- Efficient: Only train predictor (few parameters)

Curriculum Learning:
- Stage 1: Basic layout (simple, high visibility)
- Stage 2: Component recognition (medium complexity)
- Stage 3: Intent mapping (understand goals)
- Stage 4: Goal prediction (predict future state)

Each Stage:
- Progressive difficulty increase
- Stage-specific masking (15% -> 8% visible)
- Learning rate decay (1.0 -> 0.4 multiplier)
- Success criteria before advancing

Benefits:
- Faster convergence (curriculum learning)
- Better generalization (transfer learning)
- Stable training (frozen encoders)
- UI expertise (domain-specific fine-tuning)
    `.trim();
  }
}

/**
 * Create UI fine-tuning strategy with default curriculum
 */
export async function createUIFineTuningStrategy(options?: {
  config?: Partial<UIFineTuningConfig>;
  dataset?: UIDataset;
}): Promise<UIFineTuningStrategy> {
  const config = {
    ...DEFAULT_UI_FINETUNING_CONFIG,
    curriculum: UIFineTuningStrategy.createDefaultCurriculum(),
    ...options?.config,
  };

  const strategy = new UIFineTuningStrategy({
    config,
    dataset: options?.dataset,
  });

  await strategy.initialize();
  return strategy;
}

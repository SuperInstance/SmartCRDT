/**
 * JEPA Trainer
 *
 * Implements JEPA-specific training with:
 * - Contextual masking strategies
 * - Embedding prediction objectives
 * - Consistency loss for world model learning
 */

import type {
  JEPATrainerConfig,
  TrainingExample,
  JEPALossConfig,
  MaskingConfig,
  LRSchedulerConfig,
  EvaluationResult,
} from "../types.js";

import { LossFunctions } from "./LossFunctions.js";
import { OptimizerConfig } from "./OptimizerConfig.js";

export class JEPATrainer {
  private config: JEPATrainerConfig;
  private lossFunctions: LossFunctions;
  private optimizer: OptimizerConfig;
  private epoch: number = 0;
  private step: number = 0;

  constructor(config: Partial<JEPATrainerConfig> = {}) {
    this.config = {
      model: {
        encoder: {
          type: "vision",
          architecture: "resnet18",
          pretrained: false,
          frozen: false,
        },
        predictor: {
          depth: 4,
          width: 256,
          heads: 8,
        },
        embeddingDim: 768,
      },
      optimizer: {
        type: "adamw",
        learningRate: 0.001,
        weightDecay: 0.01,
      },
      loss: {
        embeddingLoss: "cosine",
        consistencyWeight: 0.5,
        predictionWeight: 1.0,
        auxiliaryWeight: 0.1,
        temperature: 0.07,
      },
      masking: {
        strategy: "block",
        ratio: 0.9,
        patchSize: 16,
        minBlocks: 3,
        maxBlocks: 10,
      },
      epochs: 100,
      batchSize: 32,
      learningRate: 0.001,
      scheduler: {
        type: "cosine",
        warmupEpochs: 10,
        minLR: 0.00001,
        maxLR: 0.001,
      },
      ...config,
    } as JEPATrainerConfig;

    this.lossFunctions = new LossFunctions(this.config.loss);
    this.optimizer = new OptimizerConfig(this.config.optimizer);
  }

  /**
   * Train on a single batch
   */
  async trainBatch(examples: TrainingExample[]): Promise<{
    loss: number;
    predictions: Float32Array[];
    metrics: Record<string, number>;
  }> {
    const predictions: Float32Array[] = [];
    let totalLoss = 0;

    for (const example of examples) {
      // Apply masking
      const masked = this.applyMasking(example, this.config.masking);

      // Generate prediction
      const prediction = this.predict(masked);
      predictions.push(prediction);

      // Calculate loss
      const loss = this.calculateLoss(example, prediction, masked);
      totalLoss += loss;
    }

    const avgLoss = totalLoss / examples.length;

    // Update step
    this.step++;

    return {
      loss: avgLoss,
      predictions,
      metrics: {
        epoch: this.epoch,
        step: this.step,
        learning_rate: this.getCurrentLearningRate(),
        batch_size: examples.length,
      },
    };
  }

  /**
   * Apply masking to example
   */
  private applyMasking(
    example: TrainingExample,
    maskingConfig: MaskingConfig
  ): {
    example: TrainingExample;
    mask: boolean[];
    visibleRatio: number;
  } {
    const { imageData } = example;
    const { patchSize, ratio, strategy } = maskingConfig;

    // Calculate number of patches
    const patchesX = Math.floor(imageData.width / patchSize);
    const patchesY = Math.floor(imageData.height / patchSize);
    const totalPatches = patchesX * patchesY;
    const visiblePatches = Math.floor(totalPatches * (1 - ratio));

    const mask = new Array<boolean>(totalPatches).fill(false);

    if (strategy === "random") {
      // Random masking
      const indices = Array.from({ length: totalPatches }, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      for (let i = 0; i < visiblePatches; i++) {
        mask[indices[i]] = true;
      }
    } else if (strategy === "block") {
      // Block masking
      const blockSize = Math.floor(Math.sqrt(totalPatches / 4));
      const numBlocks = Math.floor(
        (totalPatches - visiblePatches) / (blockSize * blockSize)
      );

      for (let b = 0; b < numBlocks; b++) {
        const startX = Math.floor(Math.random() * (patchesX - blockSize));
        const startY = Math.floor(Math.random() * (patchesY - blockSize));

        for (let y = startY; y < startY + blockSize && y < patchesY; y++) {
          for (let x = startX; x < startX + blockSize && x < patchesX; x++) {
            const idx = y * patchesX + x;
            if (idx < totalPatches) {
              mask[idx] = false; // Masked
            }
          }
        }
      }

      // Set remaining as visible
      for (let i = 0; i < totalPatches; i++) {
        if (!mask[i]) mask[i] = true;
      }
    } else if (strategy === "contextual") {
      // Contextual masking (keep center patches)
      const centerX = Math.floor(patchesX / 2);
      const centerY = Math.floor(patchesY / 2);
      const contextSize = Math.floor(Math.sqrt(visiblePatches) / 2);

      for (let y = centerY - contextSize; y <= centerY + contextSize; y++) {
        for (let x = centerX - contextSize; x <= centerX + contextSize; x++) {
          if (y >= 0 && y < patchesY && x >= 0 && x < patchesX) {
            const idx = y * patchesX + x;
            mask[idx] = true;
          }
        }
      }
    }

    return {
      example,
      mask,
      visibleRatio: visiblePatches / totalPatches,
    };
  }

  /**
   * Generate prediction for masked example
   */
  private predict(masked: {
    example: TrainingExample;
    mask: boolean[];
    visibleRatio: number;
  }): Float32Array {
    // Simplified prediction: return a modified version of target embedding
    // In a real implementation, this would use the actual model
    const target = masked.example.embedding;
    const prediction = new Float32Array(target.length);

    for (let i = 0; i < target.length; i++) {
      // Add noise to simulate prediction error
      prediction[i] = target[i] + (Math.random() - 0.5) * 0.1;
    }

    // Normalize
    const norm = Math.sqrt(prediction.reduce((sum, v) => sum + v * v, 0));
    for (let i = 0; i < prediction.length; i++) {
      prediction[i] /= norm;
    }

    return prediction;
  }

  /**
   * Calculate loss for prediction
   */
  private calculateLoss(
    example: TrainingExample,
    prediction: Float32Array,
    masked: { mask: boolean[]; visibleRatio: number }
  ): number {
    const target = example.embedding;
    const embeddingLoss = this.lossFunctions.calculateEmbeddingLoss(
      target,
      prediction
    );

    // Consistency loss (similarity between different augmentations)
    const consistencyLoss = this.lossFunctions.calculateConsistencyLoss(
      prediction,
      this.augmentEmbedding(target)
    );

    // Auxiliary loss (reconstruction)
    const auxiliaryLoss = this.lossFunctions.calculateAuxiliaryLoss(
      target,
      prediction
    );

    // Weighted combination
    const totalLoss =
      this.config.loss.predictionWeight * embeddingLoss +
      this.config.loss.consistencyWeight * consistencyLoss +
      this.config.loss.auxiliaryWeight * auxiliaryLoss;

    return totalLoss;
  }

  /**
   * Augment embedding for consistency loss
   */
  private augmentEmbedding(embedding: Float32Array): Float32Array {
    const augmented = new Float32Array(embedding.length);

    for (let i = 0; i < embedding.length; i++) {
      // Add small noise
      augmented[i] = embedding[i] + (Math.random() - 0.5) * 0.05;
    }

    // Normalize
    const norm = Math.sqrt(augmented.reduce((sum, v) => sum + v * v, 0));
    for (let i = 0; i < augmented.length; i++) {
      augmented[i] /= norm;
    }

    return augmented;
  }

  /**
   * Get current learning rate from scheduler
   */
  private getCurrentLearningRate(): number {
    const { scheduler, learningRate, epochs } = this.config;

    if (this.epoch < scheduler.warmupEpochs) {
      // Warmup phase
      return (
        scheduler.minLR +
        (scheduler.maxLR - scheduler.minLR) *
          (this.epoch / scheduler.warmupEpochs)
      );
    }

    switch (scheduler.type) {
      case "constant":
        return learningRate;

      case "cosine":
        const progress =
          (this.epoch - scheduler.warmupEpochs) /
          (epochs - scheduler.warmupEpochs);
        return (
          scheduler.minLR +
          0.5 *
            (scheduler.maxLR - scheduler.minLR) *
            (1 + Math.cos(Math.PI * progress))
        );

      case "exponential":
        return (
          learningRate * Math.pow(0.95, this.epoch - scheduler.warmupEpochs)
        );

      case "step":
        const stepSize = 30;
        return (
          learningRate *
          Math.pow(
            0.1,
            Math.floor((this.epoch - scheduler.warmupEpochs) / stepSize)
          )
        );

      case "warmup_cosine":
        const wcProgress =
          (this.epoch - scheduler.warmupEpochs) /
          (epochs - scheduler.warmupEpochs);
        return (
          scheduler.minLR +
          0.5 *
            (scheduler.maxLR - scheduler.minLR) *
            (1 + Math.cos(Math.PI * wcProgress))
        );

      default:
        return learningRate;
    }
  }

  /**
   * Evaluate on a batch
   */
  evaluate(examples: TrainingExample[]): EvaluationResult {
    let totalLoss = 0;
    const predictions: Float32Array[] = [];

    for (const example of examples) {
      const prediction = this.predict({
        example,
        mask: new Array(
          example.imageData.width * example.imageData.height
        ).fill(true),
        visibleRatio: 1.0,
      });
      predictions.push(prediction);

      const loss = this.calculateLoss(example, prediction, {
        mask: [],
        visibleRatio: 1.0,
      });
      totalLoss += loss;
    }

    const avgLoss = totalLoss / examples.length;

    // Calculate accuracy based on embedding similarity
    let totalSimilarity = 0;
    for (let i = 0; i < examples.length; i++) {
      const similarity = this.cosineSimilarity(
        examples[i].embedding,
        predictions[i]
      );
      totalSimilarity += similarity;
    }

    return {
      loss: avgLoss,
      accuracy: totalSimilarity / examples.length,
      confidence: totalSimilarity / examples.length,
      metrics: {
        learning_rate: this.getCurrentLearningRate(),
        epoch: this.epoch,
      },
    };
  }

  /**
   * Calculate cosine similarity
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Advance to next epoch
   */
  nextEpoch(): void {
    this.epoch++;
  }

  /**
   * Reset training state
   */
  reset(): void {
    this.epoch = 0;
    this.step = 0;
  }

  /**
   * Get current epoch
   */
  getEpoch(): number {
    return this.epoch;
  }

  /**
   * Get current step
   */
  getStep(): number {
    return this.step;
  }

  /**
   * Get configuration
   */
  getConfig(): JEPATrainerConfig {
    return { ...this.config };
  }
}

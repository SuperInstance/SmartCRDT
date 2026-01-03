/**
 * @lsi/vljepa - ORPO Integration for JEPA Training
 *
 * Extends existing ORPO (Odds Ratio Preference Optimization) training
 * to support VL-JEPA multimodal preference pairs.
 *
 * Integration Points:
 * 1. Extend ORPOTrainingConfig for JEPA loss
 * 2. Add visual preference pairs (before/after UI)
 * 3. Combine text + image embeddings for multimodal ORPO
 * 4. Extend ShadowLogger for screen recordings
 * 5. Extend TrainingDashboard for JEPA metrics
 *
 * @module training
 */

import type {
  TrainingMetrics,
  TrainingProgressCallback,
  TrainingEventCallback,
  TrainingEvent,
} from "@lsi/superinstance";
import {
  UIDataEntry,
  UIVideoClip,
  JEPATrainingMetrics,
  JEPATrainingConfig,
  CurriculumStage,
} from "./types.js";
import { UIDataset } from "./UIDataset.js";
import { UIFineTuningStrategy } from "./FineTuning.js";

/**
 * Visual preference pair for ORPO training
 * Extends text-only preference pairs with visual data
 */
export interface VisualPreferencePair {
  /** Unique identifier */
  id: string;

  /** Query/Intent */
  query: string;

  /** Chosen response (better UI state) */
  chosen: {
    /** Text explanation */
    content: string;
    /** UI screenshot (after) */
    image?: ImageData;
    /** UI embedding (768-dim) */
    embedding?: Float32Array;
    /** UI components */
    components?: UIDataEntry["components"];
  };

  /** Rejected response (worse UI state) */
  rejected: {
    /** Text explanation */
    content: string;
    /** UI screenshot (before) */
    image?: ImageData;
    /** UI embedding (768-dim) */
    embedding?: Float32Array;
    /** UI components */
    components?: UIDataEntry["components"];
  };

  /** User interaction that led to preference */
  interaction?: {
    type: "click" | "type" | "scroll" | "drag";
    timestamp: number;
    position: { x: number; y: number };
  };

  /** Metadata */
  metadata: {
    timestamp: number;
    sessionId: string;
    framework: string;
    componentLib: string;
  };
}

/**
 * Extended ORPO training config for JEPA
 */
export interface JEPAORPOConfig {
  /** Standard ORPO config */
  orpo: {
    baseModel: string;
    lora: {
      r: number;
      alpha: number;
      dropout: number;
      targetModules: string[];
    };
    beta: number;
    learningRate: number;
    batchSize: number;
    epochs: number;
  };

  /** JEPA-specific config */
  jepa: {
    /** Use JEPA embeddings for ORPO */
    useJepaEmbeddings: boolean;

    /** Combine text + visual embeddings */
    multimodal: boolean;

    /** Weight for visual preference */
    visualWeight: number;

    /** Weight for text preference */
    textWeight: number;

    /** Embedding fusion strategy */
    fusion: "concat" | "add" | "attention";
  };

  /** Visual data config */
  visual: {
    /** Use UI screenshots */
    useScreenshots: boolean;

    /** Use UI embeddings */
    useEmbeddings: boolean;

    /** Use component annotations */
    useComponents: boolean;

    /** Image size for screenshots */
    imageSize: {
      width: number;
      height: number;
    };
  };
}

/**
 * JEPA + ORPO Integrated Training Pipeline
 *
 * Combines JEPA's visual understanding with ORPO's preference optimization.
 */
export class JEPAORPOPipeline {
  private dataset: UIDataset;
  private fineTuningStrategy: UIFineTuningStrategy;
  private visualPairs: VisualPreferencePair[] = [];
  private config: JEPAORPOConfig;

  constructor(options: {
    dataset?: UIDataset;
    fineTuningStrategy?: UIFineTuningStrategy;
    config?: Partial<JEPAORPOConfig>;
  }) {
    this.dataset = options.dataset ?? new UIDataset();
    this.fineTuningStrategy =
      options.fineTuningStrategy ??
      new UIFineTuningStrategy({
        dataset: this.dataset,
      });
    this.config = this.createDefaultConfig(options.config);
  }

  /**
   * Initialize pipeline
   */
  async initialize(): Promise<void> {
    await this.dataset.initialize();
    await this.fineTuningStrategy.initialize();
  }

  /**
   * Collect visual preference pairs from UI interactions
   *
   * Captures:
   * - User's intent (text)
   * - Before UI state (screenshot + embedding)
   * - After UI state (screenshot + embedding)
   * - User interaction (click, type, etc.)
   */
  async collectVisualPreference(options: {
    sessionId: string;
    intent: string;
    beforeScreenshot: ImageData;
    afterScreenshot: ImageData;
    interaction: VisualPreferencePair["interaction"];
    metadata: VisualPreferencePair["metadata"];
  }): Promise<VisualPreferencePair> {
    // Encode before/after states with JEPA
    const beforeEmbedding = await this.encodeScreenshot(
      options.beforeScreenshot
    );
    const afterEmbedding = await this.encodeScreenshot(options.afterScreenshot);

    // Create preference pair
    const pair: VisualPreferencePair = {
      id: `pair-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      query: options.intent,
      chosen: {
        content: `UI updated based on: ${options.intent}`,
        image: options.afterScreenshot,
        embedding: afterEmbedding,
      },
      rejected: {
        content: "UI before changes",
        image: options.beforeScreenshot,
        embedding: beforeEmbedding,
      },
      interaction: options.interaction,
      metadata: options.metadata,
    };

    // Store pair
    this.visualPairs.push(pair);

    return pair;
  }

  /**
   * Encode screenshot with JEPA X-Encoder
   * Returns 768-dim semantic embedding
   */
  private async encodeScreenshot(screenshot: ImageData): Promise<Float32Array> {
    // PHASE 4: Implement actual X-Encoder inference
    // For now, return placeholder embedding
    return new Float32Array(768).fill(0);
  }

  /**
   * Train ORPO adapter with visual preference pairs
   *
   * Extends standard ORPO with multimodal loss:
   * - Text preference: ORPO odds ratio
   * - Visual preference: Embedding distance
   * - Combined loss: Weighted sum
   */
  async trainORPOWithVisuals(options: {
    progressCallback?: TrainingProgressCallback;
    eventCallback?: TrainingEventCallback;
  }): Promise<string> {
    console.log("Training ORPO with visual preferences:", {
      numPairs: this.visualPairs.length,
      multimodal: this.config.jepa.multimodal,
      fusion: this.config.jepa.fusion,
    });

    // Validate minimum data
    if (this.visualPairs.length < 50) {
      throw new Error(
        `Insufficient visual preference pairs: ${this.visualPairs.length}. Minimum 50 required.`
      );
    }

    const trainingId = `jepa-orpo-${Date.now()}`;

    // Emit start event
    options.eventCallback?.({
      type: "start",
      timestamp: Date.now(),
      trainingId,
      data: {
        numPairs: this.visualPairs.length,
        config: this.config,
      },
    });

    // Simulate training (PHASE 4: implement actual ORPO training)
    const { epochs, batchSize } = this.config.orpo;
    const stepsPerEpoch = Math.ceil(this.visualPairs.length / batchSize);

    for (let epoch = 0; epoch < epochs; epoch++) {
      for (let step = 0; step < stepsPerEpoch; step++) {
        const currentStep = epoch * stepsPerEpoch + step;

        // Get batch
        const batchStart = (step * batchSize) % this.visualPairs.length;
        const batchEnd = Math.min(
          batchStart + batchSize,
          this.visualPairs.length
        );
        const batch = this.visualPairs.slice(batchStart, batchEnd);

        // Compute multimodal loss
        const loss = await this.computeMultimodalORPOLoss(batch);

        // Create metrics
        const metrics: TrainingMetrics = {
          step: currentStep,
          epoch: epoch + 1,
          totalSteps: stepsPerEpoch * epochs,
          trainingLoss: loss,
          learningRate: this.config.orpo.learningRate,
          epochProgress: (step + 1) / stepsPerEpoch,
          estimatedTimeRemaining: (stepsPerEpoch * epochs - currentStep) * 0.1,
        };

        // Notify callbacks
        options.progressCallback?.(metrics);

        // Simulate training time
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    // Emit complete event
    options.eventCallback?.({
      type: "complete",
      timestamp: Date.now(),
      trainingId,
      data: { trainingId },
    });

    return trainingId;
  }

  /**
   * Compute multimodal ORPO loss
   *
   * Combines:
   * 1. Text ORPO loss (odds ratio)
   * 2. Visual embedding distance loss
   * 3. Component matching loss
   */
  private async computeMultimodalORPOLoss(
    batch: VisualPreferencePair[]
  ): Promise<number> {
    let totalLoss = 0;

    for (const pair of batch) {
      // Text ORPO loss (placeholder)
      const textLoss = 0.3;

      // Visual embedding distance loss
      let visualLoss = 0;
      if (pair.chosen.embedding && pair.rejected.embedding) {
        // Distance between chosen and rejected
        const similarity = this.cosineSimilarity(
          pair.chosen.embedding,
          pair.rejected.embedding
        );
        visualLoss = 1 - similarity;
      }

      // Component matching loss (placeholder)
      const componentLoss = 0.1;

      // Combine losses
      const combinedLoss =
        this.config.jepa.textWeight * textLoss +
        this.config.jepa.visualWeight * visualLoss +
        componentLoss;

      totalLoss += combinedLoss;
    }

    return totalLoss / batch.length;
  }

  /**
   * Cosine similarity between embeddings
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Get visual preference pairs
   */
  getVisualPairs(): VisualPreferencePair[] {
    return this.visualPairs;
  }

  /**
   * Export visual preference pairs to JSONL
   */
  async exportVisualPairs(outputPath: string): Promise<void> {
    const lines = this.visualPairs.map(pair => JSON.stringify(pair));
    const { promises: fs } = await import("fs");
    await fs.writeFile(outputPath, lines.join("\n"), "utf8");
  }

  /**
   * Create default config
   */
  private createDefaultConfig(
    partial?: Partial<JEPAORPOConfig>
  ): JEPAORPOConfig {
    return {
      orpo: {
        baseModel: "qwen2.5:3b",
        lora: {
          r: 16,
          alpha: 32,
          dropout: 0.05,
          targetModules: ["q_proj", "v_proj", "k_proj", "o_proj"],
        },
        beta: 0.1,
        learningRate: 2e-4,
        batchSize: 4,
        epochs: 3,
      },
      jepa: {
        useJepaEmbeddings: true,
        multimodal: true,
        visualWeight: 0.5,
        textWeight: 0.5,
        fusion: "concat",
      },
      visual: {
        useScreenshots: true,
        useEmbeddings: true,
        useComponents: true,
        imageSize: { width: 1920, height: 1080 },
      },
      ...partial,
    } as JEPAORPOConfig;
  }

  /**
   * Shutdown pipeline
   */
  async shutdown(): Promise<void> {
    await this.fineTuningStrategy.shutdown();
    await this.dataset.shutdown();
  }

  /**
   * Get JEPA + ORPO integration explanation
   */
  static getIntegrationExplanation(): string {
    return `
JEPA + ORPO Integration
========================

Standard ORPO:
- Text-only preference pairs
- Odds ratio loss: log(σ(β * (log(p_chosen) - log(p_rejected))))
- Trains language model adapters

JEPA-Enhanced ORPO:
- Multimodal preference pairs (text + visual)
- Combined loss: text ORPO + visual embedding distance
- Trains multimodal adapters (vision + language)

Data Flow:
1. User interacts with UI (click, type, scroll)
2. ShadowLogger captures:
   - Before screenshot + embedding
   - After screenshot + embedding
   - User intent (text)
   - Interaction details
3. JEPA encodes screenshots → 768-dim embeddings
4. ORPO computes:
   - Text odds ratio
   - Visual embedding distance
   - Combined loss
5. Train LoRA adapter on combined loss
6. Deploy improved model

Benefits:
- Multimodal preference learning
- Better UI understanding
- Considers visual changes, not just text
- Alignment with user goals (visual + semantic)
    `.trim();
  }
}

/**
 * Create JEPA + ORPO pipeline
 */
export async function createJEPAORPOPipeline(options?: {
  dataset?: UIDataset;
  fineTuningStrategy?: UIFineTuningStrategy;
  config?: Partial<JEPAORPOConfig>;
}): Promise<JEPAORPOPipeline> {
  const pipeline = new JEPAORPOPipeline(options);
  await pipeline.initialize();
  return pipeline;
}

/**
 * Extend ShadowLogger for visual data collection
 *
 * This extends the existing ShadowLogger to capture:
 * - UI screenshots (before/after)
 * - User interactions (clicks, typing)
 * - Visual preference pairs for ORPO training
 */
export class VisualShadowLogger {
  private pipeline: JEPAORPOPipeline;
  private sessionId: string;
  private beforeScreenshot: ImageData | null = null;

  constructor(options: { pipeline: JEPAORPOPipeline; sessionId: string }) {
    this.pipeline = options.pipeline;
    this.sessionId = options.sessionId;
  }

  /**
   * Capture before state
   */
  async captureBeforeState(screenshot: ImageData): Promise<void> {
    this.beforeScreenshot = screenshot;
  }

  /**
   * Capture after state and create preference pair
   */
  async captureAfterState(options: {
    screenshot: ImageData;
    intent: string;
    interaction: VisualPreferencePair["interaction"];
    metadata: VisualPreferencePair["metadata"];
  }): Promise<VisualPreferencePair> {
    if (!this.beforeScreenshot) {
      throw new Error("Before state not captured");
    }

    const pair = await this.pipeline.collectVisualPreference({
      sessionId: this.sessionId,
      intent: options.intent,
      beforeScreenshot: this.beforeScreenshot,
      afterScreenshot: options.screenshot,
      interaction: options.interaction,
      metadata: options.metadata,
    });

    // Reset before state
    this.beforeScreenshot = null;

    return pair;
  }
}

/**
 * Create visual shadow logger
 */
export function createVisualShadowLogger(options: {
  pipeline: JEPAORPOPipeline;
  sessionId: string;
}): VisualShadowLogger {
  return new VisualShadowLogger(options);
}

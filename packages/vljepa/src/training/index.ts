/**
 * @lsi/vljepa - Training Module
 *
 * JEPA training methodology, UI datasets, and fine-tuning strategies.
 * Integrates with existing ORPO training infrastructure.
 *
 * @module training
 */

// Types
export type {
  TrainingComparison,
  MaskingStrategy,
  ContextualMaskingConfig,
  JEPALossConfig,
  JEPAArchitectureConfig,
  JEPATrainingDataConfig,
  JEPATrainingConfig,
  UIDataEntry,
  UIComponent,
  UserInteraction,
  UIVideoFrame,
  UIVideoClip,
  CurriculumStage,
  UIFineTuningConfig,
  JEPATrainingMetrics,
  JEPACheckpoint,
  JEPATrainingStatus,
  JEPATrainingProgressCallback,
  JEPATrainingEventCallback,
  JEPATrainingEvent,
  JEPATrainingResult,
} from "./types.js";

// Enums
export { JEPATrainingStatus } from "./types.js";

// Constants
export { DEFAULT_JEPA_CONFIG, DEFAULT_UI_FINETUNING_CONFIG } from "./types.js";

// Classes
export { JEPATrainingStrategy } from "./JEPATrainingStrategy.js";
export { UIDataset } from "./UIDataset.js";
export { UIFineTuningStrategy } from "./FineTuning.js";

// Factory functions
export { createUIDataset, createUIFineTuningStrategy } from "./UIDataset.js";
export { createUIFineTuningStrategy as createFineTuning } from "./FineTuning.js";

/**
 * Create a complete JEPA training pipeline
 *
 * This integrates JEPA training with the existing Aequor ORPO training:
 * 1. JEPA pre-training (contextual masking, embedding prediction)
 * 2. UI fine-tuning (curriculum learning on UI tasks)
 * 3. ORPO training (preference optimization from shadow logs)
 * 4. Adapter deployment (LoRA adapters for production)
 */
export async function createJEPATrainingPipeline(options: {
  trainingDir: string;
  datasetDir: string;
  jepaConfig?: Partial<JEPATrainingConfig>;
  fineTuningConfig?: Partial<UIFineTuningConfig>;
}): Promise<{
  dataset: UIDataset;
  trainingStrategy: JEPATrainingStrategy;
  fineTuningStrategy: UIFineTuningStrategy;
}> {
  const { trainingDir, datasetDir, jepaConfig, fineTuningConfig } = options;

  // Create and initialize dataset
  const dataset = new UIDataset({
    storageDir: datasetDir,
  });
  await dataset.initialize();

  // Create and initialize training strategy
  const trainingStrategy = new JEPATrainingStrategy({
    trainingDir: join(trainingDir, "jepa"),
    config: jepaConfig,
  });
  await trainingStrategy.initialize();

  // Create and initialize fine-tuning strategy
  const fineTuningStrategy = new UIFineTuningStrategy({
    config: fineTuningConfig,
    dataset,
  });
  await fineTuningStrategy.initialize();

  return {
    dataset,
    trainingStrategy,
    fineTuningStrategy,
  };
}

/**
 * Get JEPA training methodology summary
 */
export function getJEPATrainingSummary(): {
  comparison: Record<string, string>;
  methodology: string[];
  benefits: string[];
  stages: string[];
} {
  return {
    comparison: {
      Traditional: "Autoregressive token prediction with cross-entropy loss",
      JEPA: "Embedding prediction with cosine similarity loss",
      Efficiency: "2.85x fewer operations than traditional VLMs",
      Data: "Masked video + text (10% visible) vs paired (image, caption)",
    },
    methodology: [
      "Contextual Masking: Hide 90% of input, force world model learning",
      "Embedding Encoding: X-encoder (vision) + Y-encoder (language)",
      "Predictor Training: Train predictor to map X to Y embeddings",
      "Embedding Distance Loss: Cosine similarity, NOT cross-entropy",
      "World Model Learning: Learn intuitive physics and object permanence",
    ],
    benefits: [
      "2.85x fewer operations than traditional VLMs",
      "Semantic understanding (embeddings capture meaning)",
      "World model capabilities (predicts future states)",
      "Edge deployment feasible (1.6B parameters)",
      "Generalizable (learn from video, apply to UI)",
    ],
    stages: [
      "Stage 1: Basic layout understanding (simple, high visibility)",
      "Stage 2: Component recognition (medium complexity)",
      "Stage 3: User intent mapping (understand goals)",
      "Stage 4: Goal state prediction (predict future UI)",
    ],
  };
}

/**
 * Get integration with ORPO training
 *
 * JEPA training extends the existing ORPO training pipeline:
 * - ORPO: Odds Ratio Preference Optimization for language models
 * - JEPA: Joint Embedding Predictive Architecture for vision-language models
 * - Combined: Full multimodal preference optimization
 */
export function getORPOIntegration(): {
  description: string;
  pipeline: string[];
  dataFlow: string[];
  integration: string[];
} {
  return {
    description:
      "JEPA training integrates with existing ORPO training for multimodal preference optimization",

    pipeline: [
      "Stage 1: JEPA Pre-training",
      "  - Contextual masking (10% visible)",
      "  - Embedding prediction (X-encoder → Y-encoder)",
      "  - Learn world model from internet-scale video",
      "",
      "Stage 2: UI Fine-tuning",
      "  - Curriculum learning (4 stages)",
      "  - Transfer learning (freeze encoders, train predictor)",
      "  - Learn UI-specific patterns",
      "",
      "Stage 3: Shadow Logging",
      "  - Capture UI interactions (screen recordings)",
      "  - Log user preferences (before/after states)",
      "  - Generate preference pairs for ORPO",
      "",
      "Stage 4: ORPO Training",
      "  - Odds Ratio Preference Optimization",
      "  - Train LoRA adapters on preference pairs",
      "  - Safety checks and evaluation",
      "",
      "Stage 5: Adapter Deployment",
      "  - Deploy trained adapters",
      "  - Shadow testing (A/B comparison)",
      "  - Rollback on failure",
    ],

    dataFlow: [
      "User Request (text + UI frame)",
      "  ↓",
      "X-Encoder: UI frame → 768-dim embedding",
      "  ↓",
      "Y-Encoder: User intent → 768-dim embedding",
      "  ↓",
      "Predictor: X-embedding → predicted Y-embedding",
      "  ↓",
      "Loss: cosine_similarity(predicted, actual)",
      "  ↓",
      "Shadow Logger: Log prediction + user feedback",
      "  ↓",
      "ORPO Trainer: Train on preference pairs",
      "  ↓",
      "Adapter: Deploy improved model",
    ],

    integration: [
      "1. Extend ORPOTrainingConfig for JEPA loss",
      "2. Add visual preference pairs (before/after UI)",
      "3. Combine text + image embeddings for multimodal ORPO",
      "4. Extend ShadowLogger for screen recordings",
      "5. Extend TrainingDashboard for JEPA metrics",
      "6. Extend AdapterManager for JEPA adapters",
    ],
  };
}

/**
 * Get training resource requirements
 */
export function getResourceRequirements(): {
  hardware: {
    cpu: string;
    gpu: string;
    ram: string;
    storage: string;
  };
  training: {
    preTraining: string;
    fineTuning: string;
    orpo: string;
  };
  data: {
    uiScreenshots: string;
    uiVideos: string;
    syntheticData: string;
  };
} {
  return {
    hardware: {
      cpu: "16+ cores recommended",
      gpu: "NVIDIA A100 (40GB) or equivalent",
      ram: "64GB+ recommended",
      storage: "500GB+ for datasets and checkpoints",
    },
    training: {
      preTraining: "2-4 weeks on 8x A100 for full JEPA pre-training",
      fineTuning: "1-2 days on 1x A100 for UI fine-tuning",
      orpo: "4-8 hours on 1x A100 for ORPO adapter training",
    },
    data: {
      uiScreenshots: "10,000+ screenshots recommended",
      uiVideos: "100+ hours of screen recordings",
      syntheticData: "Generate 50,000+ synthetic UI variations",
    },
  };
}

/**
 * Get estimated training timeline
 */
export function getTrainingTimeline(): {
  phase1: { name: string; duration: string; tasks: string[] };
  phase2: { name: string; duration: string; tasks: string[] };
  phase3: { name: string; duration: string; tasks: string[] };
  phase4: { name: string; duration: string; tasks: string[] };
} {
  return {
    phase1: {
      name: "Data Collection",
      duration: "1-2 weeks",
      tasks: [
        "Scrape UI screenshots from web",
        "Record user interactions (screen recordings)",
        "Generate synthetic UI variations",
        "Annotate UI components and layouts",
        "Split into train/val/test sets",
      ],
    },
    phase2: {
      name: "JEPA Pre-training",
      duration: "2-4 weeks (optional if using Meta model)",
      tasks: [
        "Download Meta VL-JEPA 1.6B model",
        "Or train from scratch on video data",
        "Apply contextual masking (10% visible)",
        "Train X-encoder, Y-encoder, predictor",
        "Validate on video understanding benchmarks",
      ],
    },
    phase3: {
      name: "UI Fine-tuning",
      duration: "3-5 days",
      tasks: [
        "Stage 1: Basic layout (1 day)",
        "Stage 2: Component recognition (1 day)",
        "Stage 3: Intent mapping (1 day)",
        "Stage 4: Goal prediction (1 day)",
        "Validate on UI task benchmarks",
      ],
    },
    phase4: {
      name: "ORPO + Deployment",
      duration: "1-2 days",
      tasks: [
        "Collect shadow logs from UI interactions",
        "Train ORPO adapters on preference pairs",
        "Run safety checks",
        "Deploy to production",
        "Monitor performance and rollback if needed",
      ],
    },
  };
}

// Export ORPO integration
export * from "./ORPOIntegration.js";

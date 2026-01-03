/**
 * @fileoverview Training configuration presets and utilities
 * @package @lsi/vljepa-training
 */

import type { TrainingPipelineConfig } from "../types.js";

/**
 * Get default training configuration
 */
export function getDefaultConfig(): TrainingPipelineConfig {
  return {
    stages: [
      {
        name: "data_prep",
        type: "data_prep",
        config: {},
        dependencies: [],
        enabled: true,
      },
      {
        name: "train",
        type: "train",
        config: {},
        dependencies: ["data_prep"],
        enabled: true,
      },
      {
        name: "validate",
        type: "validate",
        config: {},
        dependencies: ["train"],
        enabled: true,
      },
      {
        name: "finalize",
        type: "finalize",
        config: {},
        dependencies: ["validate"],
        enabled: true,
      },
    ],
    data: {
      trainPath: "./data/train",
      valPath: "./data/val",
      datasetType: "multimodal",
      augmentation: {
        enabled: true,
        horizontalFlip: true,
        rotation: 10,
        colorJitter: {
          brightness: 0.2,
          contrast: 0.2,
          saturation: 0.2,
          hue: 0.1,
        },
        randomCrop: true,
        gaussianBlur: false,
      },
      preprocessing: {
        normalize: true,
        resize: { width: 224, height: 224 },
      },
      loader: {
        batchSize: 32,
        numWorkers: 4,
        pinMemory: true,
        shuffle: true,
        dropLast: true,
      },
    },
    model: {
      type: "vl-jepa",
      architecture: {
        embeddingDim: 768,
        numLayers: 12,
        numAttentionHeads: 12,
        hiddenDim: 3072,
        dropout: 0.1,
        activation: "gelu",
      },
      visionEncoder: {
        patchSize: 16,
        numPatches: 196,
        positionEmbedding: true,
      },
      languageEncoder: {
        vocabSize: 50000,
        maxLength: 512,
        positionEmbedding: true,
      },
      predictor: {
        numLayers: 6,
        hiddenDim: 1536,
        predictionDepth: 6,
      },
      initialization: {
        type: "kaiming",
      },
    },
    training: {
      epochs: 100,
      contextWindow: 8,
      maskingRatio: 0.9,
      worldModelWeight: 1.0,
      predictionWeight: 1.0,
      curriculumLearning: false,
      learningRate: 0.001,
      batchSize: 32,
      optimizer: {
        type: "adamw",
        learningRate: 0.001,
        weightDecay: 0.01,
        beta1: 0.9,
        beta2: 0.999,
        epsilon: 1e-8,
      },
      lrSchedule: {
        type: "warmup_cosine",
        initialLR: 0.0001,
        maxLR: 0.001,
        minLR: 0.00001,
        warmupEpochs: 10,
        totalEpochs: 100,
      },
      gradientClipping: {
        enabled: true,
        maxNorm: 1.0,
        algorithm: "norm",
      },
      loss: {
        type: "combined",
        weights: {
          worldModel: 1.0,
          prediction: 1.0,
        },
      },
      mixedPrecision: {
        enabled: true,
        dtype: "float16",
      },
      distributed: {
        enabled: false,
        backend: "nccl",
        worldSize: 1,
      },
      validation: {
        frequency: 1,
      },
    },
    monitoring: {
      metrics: {
        scalars: [
          "loss",
          "accuracy",
          "learning_rate",
          "latency",
          "memory",
          "throughput",
        ],
        histograms: ["weights", "gradients", "embeddings"],
        aggregations: ["mean", "std"],
        storage: {
          backend: "file",
          path: "./metrics",
        },
      },
      tensorboard: {
        enabled: true,
        logDir: "./logs/tensorboard",
        frequency: 100,
        scalars: ["loss", "accuracy", "learning_rate"],
        histograms: ["weights", "gradients"],
        images: [],
        logGraph: true,
        logHyperparams: true,
      },
      wandb: {
        enabled: false,
        project: "vl-jepa",
        frequency: 100,
      },
      alerts: [],
      logFrequency: 10,
      progressBar: true,
    },
    checkpointing: {
      enabled: true,
      dir: "./checkpoints",
      frequency: 5,
      keep: {
        best: 3,
        last: 5,
        every: 10,
      },
      validateBeforeSave: true,
      compression: "gzip",
      saveOptimizer: true,
      saveTrainingState: true,
    },
    callbacks: {
      earlyStopping: {
        enabled: true,
        monitor: "val_loss",
        patience: 10,
        minDelta: 0.0001,
        mode: "min",
        restoreBestWeights: true,
        stopTraining: true,
      },
      lrScheduler: {
        enabled: true,
        type: "warmup_cosine",
        settings: {
          type: "warmup_cosine",
          initialLR: 0.0001,
          maxLR: 0.001,
          minLR: 0.00001,
          warmupEpochs: 10,
          totalEpochs: 100,
        },
      },
      gradientMonitor: {
        enabled: true,
        logNorms: true,
        logHistograms: true,
        checkAnomalies: true,
        anomalyThreshold: 10.0,
        anomalyAction: "clip",
      },
      validationCallback: {
        enabled: true,
        frequency: 1,
        savePredictions: false,
        detailedMetrics: true,
      },
      modelCheckpoint: {
        enabled: true,
        saveBest: true,
        saveLast: true,
        monitor: "val_loss",
        mode: "min",
      },
    },
    visualization: {
      enabled: true,
      outputDir: "./visualizations",
      formats: ["html", "json"],
      frequency: 10,
      interactive: true,
      embeddings: {
        enabled: true,
        method: "pca",
        dimension: 2,
        samples: 1000,
      },
      attention: {
        enabled: true,
        layers: [0, 6, 11],
        heads: [0, 1, 2, 3],
        samples: 10,
      },
      lossCurves: {
        enabled: true,
        smoothing: 5,
        figsize: [1200, 600],
      },
      confusionMatrix: {
        enabled: true,
        normalize: true,
      },
    },
    device: {
      type: "cpu",
      memory: {
        allowGrowth: true,
      },
      performance: {
        allowTF32: true,
        allowFp16: true,
        cudnnBenchmark: true,
        cudnnDeterministic: false,
      },
    },
  };
}

/**
 * Get quick training configuration (for testing)
 */
export function getQuickConfig(): Partial<TrainingPipelineConfig> {
  return {
    training: {
      epochs: 5,
      contextWindow: 4,
      maskingRatio: 0.8,
      worldModelWeight: 1.0,
      predictionWeight: 1.0,
      curriculumLearning: false,
      learningRate: 0.001,
      batchSize: 16,
      optimizer: {
        type: "adam",
        learningRate: 0.001,
        weightDecay: 0.0001,
        epsilon: 1e-8,
      },
      lrSchedule: {
        type: "constant",
        totalEpochs: 5,
      },
      gradientClipping: {
        enabled: false,
        algorithm: "norm",
      },
      loss: {
        type: "mse",
        weights: {
          worldModel: 1.0,
          prediction: 1.0,
        },
      },
      mixedPrecision: {
        enabled: false,
        dtype: "float16",
      },
      distributed: {
        enabled: false,
        backend: "nccl",
        worldSize: 1,
      },
      validation: {
        frequency: 1,
      },
    },
    checkpointing: {
      enabled: true,
      dir: "./checkpoints",
      frequency: 2,
      keep: {
        best: 1,
        last: 2,
        every: 5,
      },
      validateBeforeSave: false,
      compression: "none",
      saveOptimizer: false,
      saveTrainingState: true,
    },
  };
}

/**
 * Get production training configuration
 */
export function getProductionConfig(): Partial<TrainingPipelineConfig> {
  return {
    training: {
      epochs: 300,
      contextWindow: 16,
      maskingRatio: 0.9,
      worldModelWeight: 1.0,
      predictionWeight: 1.0,
      curriculumLearning: true,
      learningRate: 0.0003,
      batchSize: 64,
      optimizer: {
        type: "adamw",
        learningRate: 0.0003,
        weightDecay: 0.05,
        beta1: 0.9,
        beta2: 0.95,
        epsilon: 1e-8,
      },
      lrSchedule: {
        type: "warmup_cosine",
        initialLR: 0.00001,
        maxLR: 0.0003,
        minLR: 0.000001,
        warmupEpochs: 20,
        totalEpochs: 300,
      },
      gradientClipping: {
        enabled: true,
        maxNorm: 1.0,
        algorithm: "norm",
      },
      loss: {
        type: "combined",
        weights: {
          worldModel: 1.0,
          prediction: 1.0,
          auxiliary: 0.5,
        },
      },
      mixedPrecision: {
        enabled: true,
        dtype: "bfloat16",
      },
      distributed: {
        enabled: true,
        backend: "nccl",
        worldSize: 4,
      },
      validation: {
        frequency: 1,
      },
    },
  };
}

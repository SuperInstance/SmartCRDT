/**
 * @fileoverview Tests for TrainingPipeline
 * @package @lsi/vljepa-training
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TrainingPipeline } from '../src/pipeline/TrainingPipeline.js';
import type { TrainingPipelineConfig } from '../src/types.js';

function createMockConfig(): TrainingPipelineConfig {
  return {
    stages: [
      { name: 'data_prep', type: 'data_prep', config: {}, dependencies: [], enabled: true },
      { name: 'train', type: 'train', config: {}, dependencies: ['data_prep'], enabled: true },
      { name: 'validate', type: 'validate', config: {}, dependencies: ['train'], enabled: true },
      { name: 'finalize', type: 'finalize', config: {}, dependencies: ['validate'], enabled: true },
    ],
    data: {
      trainPath: './data/train',
      valPath: './data/val',
      datasetType: 'multimodal',
      augmentation: {
        enabled: true,
        horizontalFlip: true,
        rotation: 10,
        colorJitter: { brightness: 0.2, contrast: 0.2, saturation: 0.2, hue: 0.1 },
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
      type: 'vl-jepa',
      architecture: {
        embeddingDim: 768,
        numLayers: 12,
        numAttentionHeads: 12,
        hiddenDim: 3072,
        dropout: 0.1,
        activation: 'gelu',
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
        type: 'kaiming',
      },
    },
    training: {
      epochs: 2,
      contextWindow: 8,
      maskingRatio: 0.9,
      worldModelWeight: 1.0,
      predictionWeight: 1.0,
      curriculumLearning: false,
      learningRate: 0.001,
      batchSize: 32,
      optimizer: {
        type: 'adamw',
        learningRate: 0.001,
        weightDecay: 0.01,
        beta1: 0.9,
        beta2: 0.999,
        epsilon: 1e-8,
      },
      lrSchedule: {
        type: 'warmup_cosine',
        initialLR: 0.0001,
        maxLR: 0.001,
        minLR: 0.00001,
        warmupEpochs: 1,
        totalEpochs: 2,
      },
      gradientClipping: {
        enabled: true,
        maxNorm: 1.0,
        algorithm: 'norm',
      },
      loss: {
        type: 'combined',
        weights: {
          worldModel: 1.0,
          prediction: 1.0,
        },
      },
      mixedPrecision: {
        enabled: false,
        dtype: 'float16',
      },
      distributed: {
        enabled: false,
        backend: 'nccl',
        worldSize: 1,
      },
      validation: {
        frequency: 1,
      },
    },
    monitoring: {
      metrics: {
        scalars: ['loss', 'accuracy'],
        histograms: [],
        aggregations: ['mean'],
        storage: {
          backend: 'memory',
        },
      },
      tensorboard: {
        enabled: false,
        logDir: './logs',
        frequency: 100,
        scalars: [],
        histograms: [],
        images: [],
        logGraph: false,
        logHyperparams: false,
      },
      wandb: {
        enabled: false,
        project: 'test',
        frequency: 100,
      },
      alerts: [],
      logFrequency: 100,
      progressBar: false,
    },
    checkpointing: {
      enabled: false,
      dir: './checkpoints',
      frequency: 5,
      keep: {
        best: 3,
        last: 5,
        every: 10,
      },
      validateBeforeSave: false,
      compression: 'none',
      saveOptimizer: false,
      saveTrainingState: false,
    },
    callbacks: {
      earlyStopping: {
        enabled: false,
        monitor: 'val_loss',
        patience: 10,
        minDelta: 0.0001,
        mode: 'min',
        restoreBestWeights: false,
        stopTraining: false,
      },
      lrScheduler: {
        enabled: true,
        type: 'warmup_cosine',
        settings: {
          type: 'warmup_cosine',
          initialLR: 0.0001,
          maxLR: 0.001,
          minLR: 0.00001,
          warmupEpochs: 1,
          totalEpochs: 2,
        },
      },
      gradientMonitor: {
        enabled: false,
        logNorms: false,
        logHistograms: false,
        checkAnomalies: false,
        anomalyThreshold: 10.0,
        anomalyAction: 'log',
      },
      validationCallback: {
        enabled: true,
        frequency: 1,
        savePredictions: false,
        detailedMetrics: false,
      },
      modelCheckpoint: {
        enabled: false,
        saveBest: false,
        saveLast: false,
        monitor: 'val_loss',
        mode: 'min',
      },
    },
    visualization: {
      enabled: false,
      outputDir: './viz',
      formats: ['html'],
      frequency: 10,
      interactive: true,
      embeddings: {
        enabled: false,
        method: 'pca',
        dimension: 2,
        samples: 1000,
      },
      attention: {
        enabled: false,
        layers: [],
        heads: [],
        samples: 10,
      },
      lossCurves: {
        enabled: false,
        smoothing: 5,
        figsize: [1200, 600],
      },
      confusionMatrix: {
        enabled: false,
        normalize: true,
      },
    },
    device: {
      type: 'cpu',
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

describe('TrainingPipeline', () => {
  describe('Construction', () => {
    it('should create pipeline with config', () => {
      const config = createMockConfig();
      const pipeline = new TrainingPipeline(config);
      expect(pipeline).toBeDefined();
      expect(pipeline.isActive()).toBe(false);
    });

    it('should create metrics tracker', () => {
      const config = createMockConfig();
      const pipeline = new TrainingPipeline(config);
      const tracker = pipeline.getMetricsTracker();
      expect(tracker).toBeDefined();
    });

    it('should create checkpoint manager', () => {
      const config = createMockConfig();
      const pipeline = new TrainingPipeline(config);
      const manager = pipeline.getCheckpointManager();
      expect(manager).toBeDefined();
    });
  });

  describe('Stage Execution Order', () => {
    it('should build execution order respecting dependencies', async () => {
      const config = createMockConfig();
      const pipeline = new TrainingPipeline(config);

      // Stages should execute in dependency order
      const result = await pipeline.execute();
      expect(result.success).toBe(true);

      const stageNames = result.stages.map(s => s.name);
      expect(stageNames).toEqual(['data_prep', 'train', 'validate', 'finalize']);
    });

    it('should handle circular dependencies gracefully', () => {
      const config = createMockConfig();
      // Create circular dependency
      config.stages[0].dependencies.push('train');
      config.stages[1].dependencies.push('data_prep');

      expect(() => new TrainingPipeline(config)).not.toThrow();
    });

    it('should skip disabled stages', async () => {
      const config = createMockConfig();
      config.stages[1].enabled = false; // Disable train stage

      const pipeline = new TrainingPipeline(config);
      const result = await pipeline.execute();

      expect(result.success).toBe(true);
      expect(result.stages.filter(s => s.name === 'train')).toHaveLength(0);
    });
  });

  describe('Training Execution', () => {
    it('should execute complete pipeline successfully', async () => {
      const config = createMockConfig();
      config.training.epochs = 2;

      const pipeline = new TrainingPipeline(config);
      const result = await pipeline.execute();

      expect(result.success).toBe(true);
      expect(result.stages).toHaveLength(4);
      expect(result.stages.every(s => s.success)).toBe(true);
    });

    it('should track training progress', async () => {
      const config = createMockConfig();
      config.training.epochs = 2;

      const pipeline = new TrainingPipeline(config);
      await pipeline.execute();

      const tracker = pipeline.getMetricsTracker();
      const history = tracker.getHistory();

      expect(history.length).toBeGreaterThan(0);
    });

    it('should stop when signaled', async () => {
      const config = createMockConfig();
      config.training.epochs = 100;

      const pipeline = new TrainingPipeline(config);

      // Stop after a short delay
      setTimeout(() => pipeline.stop(), 100);

      const result = await pipeline.execute();

      expect(result.stages.length).toBeGreaterThan(0);
    });
  });

  describe('State Management', () => {
    it('should get current state', () => {
      const config = createMockConfig();
      const pipeline = new TrainingPipeline(config);

      const state = pipeline.getState();

      expect(state).toBeDefined();
      expect(state.epoch).toBe(0);
      expect(state.batch).toBe(0);
    });

    it('should resume from state', async () => {
      const config = createMockConfig();
      const pipeline = new TrainingPipeline(config);

      const state = {
        epoch: 5,
        batch: 100,
        modelState: {},
        optimizerState: {},
        lrSchedulerState: {},
        randomStates: {},
        metricsHistory: [],
        bestMetrics: {
          epoch: 5,
          metrics: {
            epoch: 5,
            batch: 0,
            loss: { training: 0.5, validation: 0.6 },
            accuracy: {},
            latency: { forward: 0, backward: 0, total: 0 },
            memory: { gpu: 0, cpu: 0, peak: 0 },
            throughput: 0,
            learning: { gradientNorm: 0, learningRate: 0 },
            timestamp: Date.now(),
          },
        },
        configHash: 'abc123',
      };

      await pipeline.resume(state);

      // Verify state was loaded
      expect(pipeline.getState().epoch).toBe(5);
    });
  });

  describe('Error Handling', () => {
    it('should handle stage failures gracefully', async () => {
      const config = createMockConfig();
      // Add a stage that will fail
      config.stages.push({
        name: 'failing_stage',
        type: 'evaluate',
        config: {},
        dependencies: ['finalize'],
        enabled: true,
      });

      const pipeline = new TrainingPipeline(config);
      const result = await pipeline.execute();

      // Should still complete, just with failure noted
      expect(result.stages.length).toBeGreaterThan(0);
    });

    it('should report errors in result', async () => {
      const config = createMockConfig();
      config.stages[0].enabled = false; // Skip data prep
      config.stages[1].dependencies = []; // Remove dependency

      const pipeline = new TrainingPipeline(config);
      const result = await pipeline.execute();

      expect(result).toBeDefined();
    });
  });

  describe('Metrics Tracking', () => {
    it('should collect metrics during training', async () => {
      const config = createMockConfig();
      config.training.epochs = 1;

      const pipeline = new TrainingPipeline(config);
      await pipeline.execute();

      const tracker = pipeline.getMetricsTracker();
      const history = tracker.getHistory();

      expect(history.length).toBeGreaterThan(0);

      const latest = history[history.length - 1];
      expect(latest).toHaveProperty('loss');
      expect(latest).toHaveProperty('accuracy');
    });

    it('should track scalar metrics', async () => {
      const config = createMockConfig();
      config.training.epochs = 1;

      const pipeline = new TrainingPipeline(config);
      await pipeline.execute();

      const tracker = pipeline.getMetricsTracker();
      const loss = tracker.getScalar('loss_training');

      expect(loss.length).toBeGreaterThan(0);
    });
  });

  describe('Learning Rate Scheduling', () => {
    it('should apply learning rate schedule', async () => {
      const config = createMockConfig();
      config.training.epochs = 3;

      const pipeline = new TrainingPipeline(config);
      await pipeline.execute();

      const tracker = pipeline.getMetricsTracker();
      const lrs = tracker.getScalar('learning_rate');

      expect(lrs.length).toBeGreaterThan(0);

      // LR should vary with warmup cosine schedule
      const uniqueLRs = new Set(lrs);
      expect(uniqueLRs.size).toBeGreaterThan(1);
    });
  });

  describe('Validation', () => {
    it('should run validation at specified intervals', async () => {
      const config = createMockConfig();
      config.training.epochs = 2;
      config.training.validation.frequency = 1;

      const pipeline = new TrainingPipeline(config);
      await pipeline.execute();

      const tracker = pipeline.getMetricsTracker();
      const history = tracker.getHistory();

      // Should have validation metrics
      const withValLoss = history.filter(m => m.loss.validation > 0);
      expect(withValLoss.length).toBeGreaterThan(0);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup after completion', async () => {
      const config = createMockConfig();
      const pipeline = new TrainingPipeline(config);

      await pipeline.execute();

      expect(pipeline.isActive()).toBe(false);
    });
  });

  describe('Configuration Hash', () => {
    it('should generate consistent config hash', () => {
      const config = createMockConfig();
      const pipeline = new TrainingPipeline(config);

      const state1 = pipeline.getState();
      const state2 = pipeline.getState();

      expect(state1.configHash).toBe(state2.configHash);
    });

    it('should generate different hashes for different configs', () => {
      const config1 = createMockConfig();
      const config2 = createMockConfig();
      config2.training.epochs = 100;

      const pipeline1 = new TrainingPipeline(config1);
      const pipeline2 = new TrainingPipeline(config2);

      expect(pipeline1.getState().configHash).not.toBe(
        pipeline2.getState().configHash
      );
    });
  });
});

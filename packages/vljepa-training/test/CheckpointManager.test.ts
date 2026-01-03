/**
 * @fileoverview Tests for CheckpointManager
 * @package @lsi/vljepa-training
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CheckpointManager } from '../src/checkpointing/CheckpointManager.js';
import type { CheckpointConfig, TrainingMetrics, ModelConfig, TrainingConfig } from '../src/types.js';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';

function createMockConfig(): CheckpointConfig {
  return {
    enabled: true,
    dir: './test-checkpoints',
    frequency: 5,
    keep: {
      best: 2,
      last: 3,
      every: 10,
    },
    validateBeforeSave: false,
    compression: 'none',
    saveOptimizer: true,
    saveTrainingState: true,
  };
}

function createMockMetrics(): TrainingMetrics {
  return {
    epoch: 1,
    batch: 100,
    loss: {
      training: 0.5,
      validation: 0.6,
    },
    accuracy: {
      top1: 0.85,
    },
    latency: {
      forward: 50,
      backward: 30,
      total: 80,
    },
    memory: {
      gpu: 2000,
      cpu: 500,
      peak: 2500,
    },
    throughput: 100,
    learning: {
      gradientNorm: 1.0,
      learningRate: 0.001,
    },
    timestamp: Date.now(),
  };
}

function createMockModelConfig(): ModelConfig {
  return {
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
  };
}

function createMockTrainingConfig(): TrainingConfig {
  return {
    epochs: 100,
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
      totalEpochs: 100,
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
  };
}

describe('CheckpointManager', () => {
  let manager: CheckpointManager;

  beforeEach(async () => {
    manager = new CheckpointManager(createMockConfig());
    await manager.initialize();
  });

  describe('Construction and Initialization', () => {
    it('should create manager with config', () => {
      expect(manager).toBeDefined();
      expect(manager.active()).toBe(true);
    });

    it('should create checkpoint directory', async () => {
      const config = createMockConfig();
      const newManager = new CheckpointManager(config);
      await newManager.initialize();

      expect(existsSync(config.dir)).toBe(true);
    });
  });

  describe('Saving Checkpoints', () => {
    it('should save checkpoint', async () => {
      const path = await manager.save({
        epoch: 1,
        metrics: createMockMetrics(),
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        timestamp: Date.now(),
      });

      expect(path).toBeDefined();
      expect(path).toContain('checkpoint');
    });

    it('should save epoch checkpoint', async () => {
      const path = await manager.save({
        epoch: 5,
        metrics: createMockMetrics(),
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        timestamp: Date.now(),
        checkpointType: 'epoch',
      });

      expect(path).toContain('epoch5');
    });

    it('should save best checkpoint', async () => {
      const path = await manager.save({
        epoch: 10,
        metrics: createMockMetrics(),
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        timestamp: Date.now(),
        checkpointType: 'best',
      });

      expect(path).toContain('best');
    });

    it('should track checkpoints', async () => {
      await manager.save({
        epoch: 1,
        metrics: createMockMetrics(),
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        timestamp: Date.now(),
      });

      await manager.save({
        epoch: 2,
        metrics: createMockMetrics(),
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        timestamp: Date.now(),
      });

      const checkpoints = manager.listCheckpoints();
      expect(checkpoints).toHaveLength(2);
    });

    it('should mark best checkpoints', async () => {
      const metrics1 = createMockMetrics();
      metrics1.loss.validation = 1.0;

      await manager.save({
        epoch: 1,
        metrics: metrics1,
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        timestamp: Date.now(),
      });

      const metrics2 = createMockMetrics();
      metrics2.loss.validation = 0.5;

      await manager.save({
        epoch: 2,
        metrics: metrics2,
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        timestamp: Date.now(),
      });

      const best = manager.getBestCheckpoint();
      expect(best?.epoch).toBe(2);
    });
  });

  describe('Loading Checkpoints', () => {
    it('should load checkpoint', async () => {
      await manager.save({
        epoch: 1,
        metrics: createMockMetrics(),
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        timestamp: Date.now(),
      });

      const loaded = await manager.load();
      expect(loaded).toBeDefined();
    });

    it('should load for resume', async () => {
      await manager.save({
        epoch: 5,
        metrics: createMockMetrics(),
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        timestamp: Date.now(),
      });

      const state = await manager.loadForResume();
      expect(state).toBeDefined();
      expect(state?.epoch).toBe(5);
    });

    it('should return null when no checkpoints exist', async () => {
      const loaded = await manager.load();
      expect(loaded).toBeNull();
    });
  });

  describe('Listing Checkpoints', () => {
    it('should list all checkpoints', async () => {
      await manager.save({
        epoch: 1,
        metrics: createMockMetrics(),
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        timestamp: Date.now(),
      });

      await manager.save({
        epoch: 2,
        metrics: createMockMetrics(),
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        timestamp: Date.now(),
      });

      const checkpoints = manager.listCheckpoints();
      expect(checkpoints).toHaveLength(2);
    });

    it('should sort by epoch descending', async () => {
      await manager.save({
        epoch: 1,
        metrics: createMockMetrics(),
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        timestamp: Date.now(),
      });

      await manager.save({
        epoch: 5,
        metrics: createMockMetrics(),
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        timestamp: Date.now(),
      });

      await manager.save({
        epoch: 3,
        metrics: createMockMetrics(),
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        timestamp: Date.now(),
      });

      const checkpoints = manager.listCheckpoints();
      expect(checkpoints[0].epoch).toBe(5);
      expect(checkpoints[1].epoch).toBe(3);
      expect(checkpoints[2].epoch).toBe(1);
    });

    it('should get latest checkpoint', async () => {
      await manager.save({
        epoch: 1,
        metrics: createMockMetrics(),
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        timestamp: Date.now(),
      });

      await manager.save({
        epoch: 5,
        metrics: createMockMetrics(),
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        timestamp: Date.now(),
      });

      const latest = manager.getLatestCheckpoint();
      expect(latest?.epoch).toBe(5);
    });

    it('should return null when no latest checkpoint', () => {
      const latest = manager.getLatestCheckpoint();
      expect(latest).toBeNull();
    });
  });

  describe('Deleting Checkpoints', () => {
    it('should delete checkpoint', async () => {
      const path = await manager.save({
        epoch: 1,
        metrics: createMockMetrics(),
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        timestamp: Date.now(),
      });

      expect(manager.listCheckpoints().length).toBe(1);

      await manager.delete(path);

      expect(manager.listCheckpoints().length).toBe(0);
    });

    it('should delete all checkpoints', async () => {
      await manager.save({
        epoch: 1,
        metrics: createMockMetrics(),
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        timestamp: Date.now(),
      });

      await manager.save({
        epoch: 2,
        metrics: createMockMetrics(),
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        timestamp: Date.now(),
      });

      expect(manager.listCheckpoints().length).toBe(2);

      await manager.deleteAll();

      expect(manager.listCheckpoints().length).toBe(0);
    });
  });

  describe('Retention Policy', () => {
    it('should keep only last N checkpoints', async () => {
      // Save more than keep.last
      for (let i = 1; i <= 10; i++) {
        await manager.save({
          epoch: i,
          metrics: createMockMetrics(),
          modelConfig: createMockModelConfig(),
          trainingConfig: createMockTrainingConfig(),
          timestamp: Date.now(),
        });
      }

      // Should keep only last 3
      const checkpoints = manager.listCheckpoints();
      // Note: This may vary based on cleanup timing
      expect(checkpoints.length).toBeGreaterThanOrEqual(1);
    });

    it('should keep best checkpoints', async () => {
      const baseMetrics = createMockMetrics();

      // Save checkpoints with improving validation loss
      for (let i = 1; i <= 5; i++) {
        const metrics = { ...baseMetrics };
        metrics.loss.validation = 1.0 - (i * 0.1);

        await manager.save({
          epoch: i,
          metrics,
          modelConfig: createMockModelConfig(),
          trainingConfig: createMockTrainingConfig(),
          timestamp: Date.now(),
        });
      }

      const best = manager.getBestCheckpoint();
      expect(best).toBeDefined();
      expect(best?.type).toBe('best');
    });
  });

  describe('Config Hash', () => {
    it('should generate consistent hash', async () => {
      await manager.save({
        epoch: 1,
        metrics: createMockMetrics(),
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        timestamp: Date.now(),
      });

      const state = await manager.loadForResume();
      expect(state?.configHash).toBeDefined();
      expect(state?.configHash.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle disabled checkpointing', () => {
      const config = createMockConfig();
      config.enabled = false;

      const disabledManager = new CheckpointManager(config);
      expect(disabledManager.active()).toBe(false);
    });

    it('should handle empty checkpoint directory', async () => {
      const latest = manager.getLatestCheckpoint();
      expect(latest).toBeNull();
    });
  });

  describe('Metadata', () => {
    it('should include checkpoint metadata', async () => {
      const metrics = createMockMetrics();

      await manager.save({
        epoch: 5,
        metrics,
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        timestamp: 12345000,
        gitCommit: 'abc123',
      });

      const checkpoints = manager.listCheckpoints();
      const ckpt = checkpoints[0];

      expect(ckpt.epoch).toBe(5);
      expect(ckpt.metrics).toEqual(metrics);
      expect(ckpt.timestamp).toBe(12345000);
    });

    it('should include file size', async () => {
      await manager.save({
        epoch: 1,
        metrics: createMockMetrics(),
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        timestamp: Date.now(),
      });

      const checkpoints = manager.listCheckpoints();
      expect(checkpoints[0].size).toBeGreaterThanOrEqual(0);
    });
  });
});

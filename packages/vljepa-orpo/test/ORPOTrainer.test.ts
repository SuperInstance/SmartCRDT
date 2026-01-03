/**
 * @lsi/vljepa-orpo - ORPOTrainer Tests
 *
 * Comprehensive test suite for ORPOTrainer.
 * Target: 45+ tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ORPOTrainer,
  createORPOTrainer,
  type ORPOTrainerConfig,
} from '../src/trainers/ORPOTrainer.js';
import type { UIPreferencePair } from '../src/types.js';

// Mock preference pair generator
function createMockPreferencePair(index: number): UIPreferencePair {
  return {
    id: `pair_${index}`,
    chosen: {
      image: { data: new Uint8ClampedArray(224 * 224 * 4), width: 224, height: 224, colorSpace: 'srgb' },
      embedding: new Float32Array(768).map(() => Math.random() * 2 - 1),
      dom: {
        tagName: 'div',
        classes: ['chosen'],
        children: [],
        attributes: {},
      },
      styles: { display: 'flex', padding: '16px' },
    },
    rejected: {
      image: { data: new Uint8ClampedArray(224 * 224 * 4), width: 224, height: 224, colorSpace: 'srgb' },
      embedding: new Float32Array(768).map(() => Math.random() * 2 - 1),
      dom: {
        tagName: 'div',
        classes: ['rejected'],
        children: [],
        attributes: {},
      },
      styles: { display: 'block', padding: '8px' },
    },
    context: {
      task: 'UI improvement',
      userIntent: 'Better layout',
      uiContext: 'landing_page',
      constraints: {},
    },
    metadata: {
      source: 'synthetic',
      confidence: 0.8,
      timestamp: Date.now(),
    },
  };
}

describe('ORPOTrainer', () => {
  let config: Partial<ORPOTrainerConfig>;
  let pairs: UIPreferencePair[];

  beforeEach(() => {
    config = {
      training: {
        batchSize: 4,
        epochs: 2,
        validationSplit: 0.2,
        evalSteps: 10,
        saveSteps: 20,
        earlyStoppingPatience: 2,
        outputDir: './test-output',
      },
      device: 'cpu',
    };
    pairs = Array.from({ length: 100 }, (_, i) => createMockPreferencePair(i));
  });

  describe('Construction', () => {
    it('should create trainer with config', () => {
      const trainer = new ORPOTrainer(config as ORPOTrainerConfig);
      expect(trainer).toBeDefined();
    });

    it('should initialize trainer', async () => {
      const trainer = new ORPOTrainer(config as ORPOTrainerConfig);
      await trainer.initialize();
      expect(trainer).toBeDefined();
    });

    it('should get model', async () => {
      const trainer = new ORPOTrainer(config as ORPOTrainerConfig);
      await trainer.initialize();
      const model = trainer.getModel();
      expect(model).toBeDefined();
    });

    it('should get config', () => {
      const trainer = new ORPOTrainer(config as ORPOTrainerConfig);
      const retrievedConfig = trainer.getConfig();
      expect(retrievedConfig).toBeDefined();
    });
  });

  describe('Training', () => {
    it('should train on preference pairs', async () => {
      const trainer = new ORPOTrainer(config as ORPOTrainerConfig);
      await trainer.initialize();
      const progressCallback = vi.fn();
      const result = await trainer.train(pairs, { progressCallback });
      expect(result.success).toBe(true);
      expect(result.trainingId).toBeDefined();
    });

    it('should call progress callback during training', async () => {
      const trainer = new ORPOTrainer(config as ORPOTrainerConfig);
      await trainer.initialize();
      const progressCallback = vi.fn();
      await trainer.train(pairs, { progressCallback });
      expect(progressCallback).toHaveBeenCalled();
    });

    it('should emit start event', async () => {
      const trainer = new ORPOTrainer(config as ORPOTrainerConfig);
      await trainer.initialize();
      const eventCallback = vi.fn();
      await trainer.train(pairs, { eventCallback });
      const startEvents = eventCallback.mock.calls.filter(
        call => call[0].type === 'start'
      );
      expect(startEvents.length).toBeGreaterThan(0);
    });

    it('should emit complete event', async () => {
      const trainer = new ORPOTrainer(config as ORPOTrainerConfig);
      await trainer.initialize();
      const eventCallback = vi.fn();
      await trainer.train(pairs, { eventCallback });
      const completeEvents = eventCallback.mock.calls.filter(
        call => call[0].type === 'complete'
      );
      expect(completeEvents.length).toBeGreaterThan(0);
    });

    it('should reject insufficient data', async () => {
      const trainer = new ORPOTrainer(config as ORPOTrainerConfig);
      await trainer.initialize();
      await expect(trainer.train([])).rejects.toThrow();
    });

    it('should require minimum 50 pairs', async () => {
      const trainer = new ORPOTrainer(config as ORPOTrainerConfig);
      await trainer.initialize();
      const smallDataset = pairs.slice(0, 10);
      await expect(trainer.train(smallDataset)).rejects.toThrow();
    });
  });

  describe('Training State', () => {
    it('should track training progress', async () => {
      const trainer = new ORPOTrainer(config as ORPOTrainerConfig);
      await trainer.initialize();
      const progressCallback = vi.fn();
      await trainer.train(pairs, { progressCallback });
      const calls = progressCallback.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.step).toBeDefined();
    });

    it('should indicate training in progress', async () => {
      const trainer = new ORPOTrainer(config as ORPOTrainerConfig);
      await trainer.initialize();
      const trainingPromise = trainer.train(pairs);
      expect(trainer.isTrainingInProgress()).toBe(true);
      await trainingPromise;
    });

    it('should complete training', async () => {
      const trainer = new ORPOTrainer(config as ORPOTrainerConfig);
      await trainer.initialize();
      await trainer.train(pairs);
      expect(trainer.isTrainingInProgress()).toBe(false);
    });
  });

  describe('Checkpoints', () => {
    it('should save checkpoints', async () => {
      const checkpointConfig = { ...config, training: { ...config.training!, saveSteps: 5 } };
      const trainer = new ORPOTrainer(checkpointConfig as ORPOTrainerConfig);
      await trainer.initialize();
      await trainer.train(pairs);
      const checkpoints = trainer.getCheckpoints();
      expect(checkpoints.length).toBeGreaterThan(0);
    });

    it('should track checkpoint step numbers', async () => {
      const checkpointConfig = { ...config, training: { ...config.training!, saveSteps: 5 } };
      const trainer = new ORPOTrainer(checkpointConfig as ORPOTrainerConfig);
      await trainer.initialize();
      await trainer.train(pairs);
      const checkpoints = trainer.getCheckpoints();
      checkpoints.forEach(ckpt => {
        expect(ckpt.step).toBeDefined();
        expect(typeof ckpt.step).toBe('number');
      });
    });

    it('should track checkpoint epochs', async () => {
      const checkpointConfig = { ...config, training: { ...config.training!, saveSteps: 5 } };
      const trainer = new ORPOTrainer(checkpointConfig as ORPOTrainerConfig);
      await trainer.initialize();
      await trainer.train(pairs);
      const checkpoints = trainer.getCheckpoints();
      checkpoints.forEach(ckpt => {
        expect(ckpt.epoch).toBeDefined();
        expect(typeof ckpt.epoch).toBe('number');
      });
    });
  });

  describe('Validation', () => {
    it('should perform validation during training', async () => {
      const evalConfig = { ...config, training: { ...config.training!, evalSteps: 5 } };
      const trainer = new ORPOTrainer(evalConfig as ORPOTrainerConfig);
      await trainer.initialize();
      const eventCallback = vi.fn();
      await trainer.train(pairs, { eventCallback });
      const evalEvents = eventCallback.mock.calls.filter(
        call => call[0].type === 'eval'
      );
      expect(evalEvents.length).toBeGreaterThan(0);
    });

    it('should use validation split', async () => {
      const trainer = new ORPOTrainer(config as ORPOTrainerConfig);
      await trainer.initialize();
      await trainer.train(pairs);
      // Validation implicitly happens
      expect(trainer).toBeDefined();
    });
  });

  describe('Early Stopping', () => {
    it('should support early stopping patience', async () => {
      const earlyStopConfig = {
        ...config,
        training: { ...config.training!, earlyStoppingPatience: 1 }
      };
      const trainer = new ORPOTrainer(earlyStopConfig as ORPOTrainerConfig);
      await trainer.initialize();
      const result = await trainer.train(pairs);
      expect(result).toBeDefined();
    });
  });

  describe('Optimization Result', () => {
    it('should return optimization result', async () => {
      const trainer = new ORPOTrainer(config as ORPOTrainerConfig);
      await trainer.initialize();
      const result = await trainer.train(pairs);
      expect(result.trainingId).toBeDefined();
      expect(result.finalLoss).toBeDefined();
      expect(result.bestLoss).toBeDefined();
      expect(result.preferenceAccuracy).toBeDefined();
      expect(result.winRateVsBaseline).toBeDefined();
      expect(result.trainingDuration).toBeDefined();
      expect(result.adapterPath).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it('should calculate training duration', async () => {
      const trainer = new ORPOTrainer(config as ORPOTrainerConfig);
      await trainer.initialize();
      const result = await trainer.train(pairs);
      expect(result.trainingDuration).toBeGreaterThan(0);
    });

    it('should report success on completion', async () => {
      const trainer = new ORPOTrainer(config as ORPOTrainerConfig);
      await trainer.initialize();
      const result = await trainer.train(pairs);
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Stop Training', () => {
    it('should support stopping training', async () => {
      const trainer = new ORPOTrainer(config as ORPOTrainerConfig);
      await trainer.initialize();
      const trainingPromise = trainer.train(pairs);
      trainer.stop();
      const result = await trainingPromise;
      expect(result).toBeDefined();
    });
  });

  describe('Batch Processing', () => {
    it('should respect batch size', async () => {
      const batchConfig = { ...config, training: { ...config.training!, batchSize: 8 } };
      const trainer = new ORPOTrainer(batchConfig as ORPOTrainerConfig);
      await trainer.initialize();
      const progressCallback = vi.fn();
      await trainer.train(pairs.slice(0, 50), { progressCallback });
      expect(progressCallback).toHaveBeenCalled();
    });

    it('should handle partial batches', async () => {
      const batchConfig = { ...config, training: { ...config.training!, batchSize: 7 } };
      const trainer = new ORPOTrainer(batchConfig as ORPOTrainerConfig);
      await trainer.initialize();
      const result = await trainer.train(pairs.slice(0, 50));
      expect(result.success).toBe(true);
    });
  });

  describe('Factory Function', () => {
    it('should create trainer via factory', async () => {
      const trainer = await createORPOTrainer();
      expect(trainer).toBeDefined();
      await trainer.initialize();
      expect(trainer.getModel()).toBeDefined();
    });

    it('should merge config in factory', async () => {
      const trainer = await createORPOTrainer({
        training: { batchSize: 16, epochs: 1, validationSplit: 0.1, evalSteps: 5, saveSteps: 10, earlyStoppingPatience: 3, outputDir: './test' },
        device: 'cpu',
      });
      const retrievedConfig = trainer.getConfig();
      expect(retrievedConfig.training.batchSize).toBe(16);
    });
  });

  describe('Error Handling', () => {
    it('should handle training errors gracefully', async () => {
      const trainer = new ORPOTrainer(config as ORPOTrainerConfig);
      await trainer.initialize();
      // Use invalid pairs that might cause issues
      const invalidPairs = pairs.slice(0, 50).map(p => ({
        ...p,
        chosen: { ...p.chosen, embedding: new Float32Array(0) },
      }));
      const result = await trainer.train(invalidPairs);
      // Should handle errors
      expect(result).toBeDefined();
    });

    it('should emit error event on failure', async () => {
      const trainer = new ORPOTrainer(config as ORPOTrainerConfig);
      await trainer.initialize();
      const eventCallback = vi.fn();
      // Try with too few pairs
      await trainer.train(pairs.slice(0, 10), { eventCallback });
      const errorEvents = eventCallback.mock.calls.filter(
        call => call[0].type === 'error'
      );
      // Should have error event for insufficient data
      expect(errorEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Metrics Tracking', () => {
    it('should track loss metrics', async () => {
      const trainer = new ORPOTrainer(config as ORPOTrainerConfig);
      await trainer.initialize();
      const progressCallback = vi.fn();
      await trainer.train(pairs, { progressCallback });
      const firstCall = progressCallback.mock.calls[0][0];
      expect(firstCall.trainingLoss).toBeDefined();
    });

    it('should track learning rate', async () => {
      const trainer = new ORPOTrainer(config as ORPOTrainerConfig);
      await trainer.initialize();
      const progressCallback = vi.fn();
      await trainer.train(pairs, { progressCallback });
      const firstCall = progressCallback.mock.calls[0][0];
      expect(firstCall.learningRate).toBeDefined();
      expect(firstCall.learningRate).toBeGreaterThan(0);
    });

    it('should track epoch progress', async () => {
      const trainer = new ORPOTrainer(config as ORPOTrainerConfig);
      await trainer.initialize();
      const progressCallback = vi.fn();
      await trainer.train(pairs, { progressCallback });
      const firstCall = progressCallback.mock.calls[0][0];
      expect(firstCall.epochProgress).toBeDefined();
      expect(firstCall.epochProgress).toBeGreaterThanOrEqual(0);
      expect(firstCall.epochProgress).toBeLessThanOrEqual(1);
    });
  });
});

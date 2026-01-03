/**
 * @fileoverview Tests for LRScheduler
 * @package @lsi/vljepa-training
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LRScheduler } from '../src/callbacks/LRScheduler.js';
import type { LRSchedulerConfig } from '../src/types.js';

function createMockConfig(scheduleType: LRSchedulerConfig['type'] = 'warmup_cosine'): LRSchedulerConfig {
  const settings = {
    type: scheduleType,
    initialLR: 0.0001,
    maxLR: 0.001,
    minLR: 0.00001,
    warmupEpochs: 5,
    totalEpochs: 20,
    stepSize: 5,
    gamma: 0.1,
    cycleLength: 10,
  };

  return {
    enabled: true,
    type: scheduleType,
    settings,
  };
}

describe('LRScheduler', () => {
  describe('Construction', () => {
    it('should create with config', () => {
      const config = createMockConfig();
      const scheduler = new LRScheduler(config);

      expect(scheduler).toBeDefined();
      expect(scheduler.active()).toBe(true);
    });

    it('should initialize LR', () => {
      const config = createMockConfig();
      const scheduler = new LRScheduler(config);

      expect(scheduler.getCurrentLR()).toBe(0.0001);
    });

    it('should use maxLR as initial if not specified', () => {
      const config = createMockConfig();
      config.settings.initialLR = undefined;
      config.settings.maxLR = 0.001;

      const scheduler = new LRScheduler(config);

      expect(scheduler.getCurrentLR()).toBe(0.001);
    });
  });

  describe('Step LR Schedule', () => {
    let scheduler: LRScheduler;

    beforeEach(() => {
      scheduler = new LRScheduler(createMockConfig('step'));
    });

    it('should maintain LR initially', () => {
      const lr = scheduler.getLR(0);
      expect(lr).toBeCloseTo(0.0001, 5);
    });

    it('should decay after step_size epochs', () => {
      const lr1 = scheduler.getLR(4);
      const lr2 = scheduler.getLR(5);

      expect(lr1).toBeCloseTo(0.0001, 5);
      expect(lr2).toBeCloseTo(0.00001, 6); // 0.0001 * 0.1
    });

    it('should decay multiple times', () => {
      const lr0 = scheduler.getLR(0);
      const lr5 = scheduler.getLR(5);
      const lr10 = scheduler.getLR(10);

      expect(lr5).toBeCloseTo(lr0 * 0.1, 6);
      expect(lr10).toBeCloseTo(lr0 * 0.01, 6);
    });

    it('should step through epochs', () => {
      const lr1 = scheduler.step(1);
      const lr2 = scheduler.step(2);

      expect(scheduler.getCurrentLR()).toBe(lr2);
      expect(scheduler.getCurrentLR()).toBeCloseTo(0.0001, 5);
    });
  });

  describe('Cosine LR Schedule', () => {
    let scheduler: LRScheduler;

    beforeEach(() => {
      scheduler = new LRScheduler(createMockConfig('cosine'));
    });

    it('should start at initial LR', () => {
      const lr = scheduler.getLR(0);
      expect(lr).toBeCloseTo(0.0001, 5);
    });

    it('should end at min LR', () => {
      const lr = scheduler.getLR(20);
      expect(lr).toBeCloseTo(0.00001, 6);
    });

    it('should decay smoothly', () => {
      const lrStart = scheduler.getLR(0);
      const lrMid = scheduler.getLR(10);
      const lrEnd = scheduler.getLR(20);

      expect(lrMid).toBeLessThan(lrStart);
      expect(lrMid).toBeGreaterThan(lrEnd);
    });

    it('should follow cosine curve', () => {
      const lr0 = scheduler.getLR(0);
      const lr5 = scheduler.getLR(5);
      const lr10 = scheduler.getLR(10);
      const lr15 = scheduler.getLR(15);
      const lr20 = scheduler.getLR(20);

      // Cosine decay: start high, end low, smooth curve
      expect(lr0).toBeGreaterThan(lr10);
      expect(lr10).toBeGreaterThan(lr20);
      expect(lr5).toBeGreaterThan(lr15);
    });
  });

  describe('Warmup + Cosine LR Schedule', () => {
    let scheduler: LRScheduler;

    beforeEach(() => {
      scheduler = new LRScheduler(createMockConfig('warmup_cosine'));
    });

    it('should warm up linearly', () => {
      const lr0 = scheduler.getLR(0);
      const lr1 = scheduler.getLR(1);
      const lr2 = scheduler.getLR(2);

      expect(lr1).toBeGreaterThan(lr0);
      expect(lr2).toBeGreaterThan(lr1);
    });

    it('should reach max LR at end of warmup', () => {
      const lrWarmupEnd = scheduler.getLR(5);
      expect(lrWarmupEnd).toBeCloseTo(0.001, 4);
    });

    it('should decay after warmup', () => {
      const lr5 = scheduler.getLR(5);
      const lr10 = scheduler.getLR(10);
      const lr20 = scheduler.getLR(20);

      expect(lr10).toBeLessThan(lr5);
      expect(lr20).toBeLessThan(lr10);
    });

    it('should reach min LR at end', () => {
      const lr = scheduler.getLR(20);
      expect(lr).toBeCloseTo(0.00001, 6);
    });
  });

  describe('One Cycle LR Schedule', () => {
    let scheduler: LRScheduler;

    beforeEach(() => {
      scheduler = new LRScheduler(createMockConfig('one_cycle'));
    });

    it('should increase in first half', () => {
      const lr0 = scheduler.getLR(0);
      const lr5 = scheduler.getLR(5);

      expect(lr5).toBeGreaterThan(lr0);
    });

    it('should decrease in second half', () => {
      const lr10 = scheduler.getLR(10);
      const lr15 = scheduler.getLR(15);

      expect(lr15).toBeLessThan(lr10);
    });

    it('should reach max LR at midpoint', () => {
      const lrMid = scheduler.getLR(10);
      expect(lrMid).toBeCloseTo(0.001, 4);
    });
  });

  describe('Reduce on Plateau', () => {
    let scheduler: LRScheduler;

    beforeEach(() => {
      scheduler = new LRScheduler(createMockConfig('reduce_on_plateau'));
    });

    it('should maintain initial LR', () => {
      const lr = scheduler.getLR(0);
      expect(lr).toBeCloseTo(0.0001, 5);
    });

    it('should update on metric value', () => {
      const lr1 = scheduler.updateReduceOnPlateau(0.8);
      const lr2 = scheduler.updateReduceOnPlateau(0.81);

      expect(lr2).toBe(lr1);
    });

    it('should reduce on plateau', () => {
      const lr1 = scheduler.updateReduceOnPlateau(0.8);
      const lr2 = scheduler.updateReduceOnPlateau(0.79);
      const lr3 = scheduler.updateReduceOnPlateau(0.78);
      const lr4 = scheduler.updateReduceOnPlateau(0.77);
      const lr5 = scheduler.updateReduceOnPlateau(0.76);
      const lr6 = scheduler.updateReduceOnPlateau(0.75);

      // After 5 epochs without improvement, should reduce
      expect(lr6).toBeLessThan(lr1);
    });
  });

  describe('Step Function', () => {
    it('should update epoch and get LR', () => {
      const scheduler = new LRScheduler(createMockConfig('step'));

      const lr1 = scheduler.step(0);
      const lr2 = scheduler.step(1);
      const lr3 = scheduler.step(2);

      expect(lr2).toBe(lr1);
      expect(lr3).toBe(lr2);
    });

    it('should update current LR', () => {
      const scheduler = new LRScheduler(createMockConfig('warmup_cosine'));

      expect(scheduler.getCurrentLR()).toBe(0.0001);

      scheduler.step(1);

      expect(scheduler.getCurrentLR()).toBeGreaterThan(0.0001);
    });
  });

  describe('Manual LR Control', () => {
    it('should set LR manually', () => {
      const scheduler = new LRScheduler(createMockConfig());

      scheduler.setLR(0.005);

      expect(scheduler.getCurrentLR()).toBe(0.005);
    });

    it('should maintain manual LR across steps', () => {
      const scheduler = new LRScheduler(createMockConfig());

      scheduler.setLR(0.005);
      scheduler.step(1);

      expect(scheduler.getCurrentLR()).toBe(0.005);
    });
  });

  describe('Reset', () => {
    it('should reset to initial state', () => {
      const scheduler = new LRScheduler(createMockConfig());

      scheduler.step(10);
      expect(scheduler.getCurrentLR()).not.toBe(0.0001);

      scheduler.reset();

      expect(scheduler.getCurrentLR()).toBe(0.0001);
    });
  });

  describe('Schedule Type', () => {
    it('should report schedule type', () => {
      const scheduler1 = new LRScheduler(createMockConfig('cosine'));
      const scheduler2 = new LRScheduler(createMockConfig('step'));

      expect(scheduler1.getScheduleType()).toBe('cosine');
      expect(scheduler2.getScheduleType()).toBe('step');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero total epochs', () => {
      const config = createMockConfig();
      config.settings.totalEpochs = 0;

      const scheduler = new LRScheduler(config);

      const lr = scheduler.getLR(0);
      expect(lr).toBeGreaterThan(0);
    });

    it('should handle single epoch', () => {
      const config = createMockConfig('cosine');
      config.settings.totalEpochs = 1;

      const scheduler = new LRScheduler(config);

      const lr0 = scheduler.getLR(0);
      const lr1 = scheduler.getLR(1);

      expect(lr1).toBeLessThanOrEqual(lr0);
    });

    it('should handle disabled scheduler', () => {
      const config = createMockConfig();
      config.enabled = false;

      const scheduler = new LRScheduler(config);

      expect(scheduler.active()).toBe(false);
    });
  });

  describe('LR Consistency', () => {
    it('should give same LR for same epoch', () => {
      const scheduler = new LRScheduler(createMockConfig('cosine'));

      const lr1a = scheduler.getLR(5);
      const lr1b = scheduler.getLR(5);

      expect(lr1a).toBe(lr1b);
    });

    it('should be deterministic', () => {
      const scheduler1 = new LRScheduler(createMockConfig('warmup_cosine'));
      const scheduler2 = new LRScheduler(createMockConfig('warmup_cosine'));

      for (let epoch = 0; epoch < 20; epoch++) {
        const lr1 = scheduler1.getLR(epoch);
        const lr2 = scheduler2.getLR(epoch);
        expect(lr1).toBe(lr2);
      }
    });
  });

  describe('LR Bounds', () => {
    it('should not exceed max LR', () => {
      const scheduler = new LRScheduler(createMockConfig('one_cycle'));

      for (let epoch = 0; epoch < 30; epoch++) {
        const lr = scheduler.getLR(epoch);
        expect(lr).toBeLessThanOrEqual(0.001);
      }
    });

    it('should not go below min LR', () => {
      const scheduler = new LRScheduler(createMockConfig('cosine'));

      for (let epoch = 0; epoch < 25; epoch++) {
        const lr = scheduler.getLR(epoch);
        expect(lr).toBeGreaterThanOrEqual(0.00001);
      }
    });
  });
});

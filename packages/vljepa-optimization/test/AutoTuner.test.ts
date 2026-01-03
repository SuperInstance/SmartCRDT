/**
 * Auto Tuner Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AutoTuner,
  DeviceTuner,
  WorkgroupTuner,
} from '../src/tuning/AutoTuner.js';

describe('AutoTuner', () => {
  let tuner: AutoTuner;

  beforeEach(() => {
    tuner = new AutoTuner({
      parameters: [
        { name: 'batchSize', min: 1, max: 32, step: 1, type: 'discrete', current: 8 },
        { name: 'learningRate', min: 0.0001, max: 0.1, step: 0.0001, type: 'continuous', current: 0.001 },
        { name: 'workgroupSize', min: 4, max: 64, step: 4, type: 'discrete', current: 16 },
      ],
      searchStrategy: 'grid',
      maxIterations: 10,
      targetMetric: 'latency',
      convergenceThreshold: 0.01,
      timeout: 10000,
    });
  });

  describe('constructor', () => {
    it('should create tuner with config', () => {
      const t = new AutoTuner({
        parameters: [{ name: 'param', min: 0, max: 10, step: 1, type: 'discrete', current: 5 }],
        searchStrategy: 'random',
        maxIterations: 50,
      });

      expect(t).toBeDefined();
    });

    it('should initialize best parameters', () => {
      const best = tuner.getBestParameters();

      expect(best).toHaveProperty('batchSize');
      expect(best).toHaveProperty('learningRate');
      expect(best).toHaveProperty('workgroupSize');
    });
  });

  describe('tune', () => {
    it('should run tuning process', async () => {
      const evaluate = vi.fn().mockResolvedValue(100);

      const result = await tuner.tune(evaluate);

      expect(result).toHaveProperty('bestParameters');
      expect(result).toHaveProperty('bestMetric');
      expect(result).toHaveProperty('iterations');
      expect(result).toHaveProperty('convergence');
      expect(result).toHaveProperty('history');
      expect(result).toHaveProperty('duration');
    });

    it('should track best parameters', async () => {
      let callCount = 0;
      const evaluate = vi.fn().mockImplementation(() => {
        callCount++;
        // Return decreasing latency
        return 100 - callCount * 5;
      });

      const result = await tuner.tune(evaluate);

      expect(result.bestMetric).toBeLessThan(100);
    });

    it('should record tuning history', async () => {
      const evaluate = vi.fn().mockResolvedValue(100);

      const result = await tuner.tune(evaluate);

      expect(result.history.length).toBeGreaterThan(0);
      expect(result.history[0]).toHaveProperty('iteration');
      expect(result.history[0]).toHaveProperty('parameters');
      expect(result.history[0]).toHaveProperty('metric');
      expect(result.history[0]).toHaveProperty('timestamp');
    });

    it('should detect convergence', async () => {
      const evaluate = vi.fn().mockResolvedValue(50); // Constant metric

      const result = await tuner.tune(evaluate);

      expect(result.convergence).toBeDefined();
    });

    it('should respect max iterations', async () => {
      const evaluate = vi.fn().mockResolvedValue(100);

      const result = await tuner.tune(evaluate);

      expect(result.iterations).toBeLessThanOrEqual(10);
    });

    it('should handle errors in evaluation', async () => {
      const evaluate = vi.fn().mockRejectedValue(new Error('Evaluation failed'));

      await expect(tuner.tune(evaluate)).rejects.toThrow();
    });
  });

  describe('getBestParameters', () => {
    it('should return current best parameters', () => {
      const params = tuner.getBestParameters();

      expect(params).toBeDefined();
      expect(typeof params.batchSize).toBe('number');
    });
  });

  describe('getHistory', () => {
    it('should return tuning history', async () => {
      const evaluate = vi.fn().mockResolvedValue(100);

      await tuner.tune(evaluate);
      const history = tuner.getHistory();

      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should return empty history before tuning', () => {
      const history = tuner.getHistory();

      expect(history).toHaveLength(0);
    });
  });

  describe('different search strategies', () => {
    it('should support grid search', async () => {
      const t = new AutoTuner({
        parameters: [{ name: 'param', min: 1, max: 5, step: 1, type: 'discrete', current: 3 }],
        searchStrategy: 'grid',
        maxIterations: 10,
        targetMetric: 'latency',
      });

      const evaluate = vi.fn().mockResolvedValue(100);

      await t.tune(evaluate);

      expect(evaluate).toHaveBeenCalled();
    });

    it('should support random search', async () => {
      const t = new AutoTuner({
        parameters: [{ name: 'param', min: 1, max: 10, step: 1, type: 'discrete', current: 5 }],
        searchStrategy: 'random',
        maxIterations: 5,
        targetMetric: 'latency',
      });

      const evaluate = vi.fn().mockResolvedValue(100);

      await t.tune(evaluate);

      expect(evaluate).toHaveBeenCalled();
    });

    it('should support bayesian search', async () => {
      const t = new AutoTuner({
        parameters: [{ name: 'param', min: 1, max: 10, step: 1, type: 'continuous', current: 5 }],
        searchStrategy: 'bayesian',
        maxIterations: 10,
        targetMetric: 'latency',
      });

      const evaluate = vi.fn().mockResolvedValue(100);

      await t.tune(evaluate);

      expect(evaluate).toHaveBeenCalled();
    });

    it('should support evolutionary search', async () => {
      const t = new AutoTuner({
        parameters: [{ name: 'param', min: 1, max: 10, step: 1, type: 'continuous', current: 5 }],
        searchStrategy: 'evolutionary',
        maxIterations: 10,
        targetMetric: 'latency',
      });

      const evaluate = vi.fn().mockResolvedValue(100);

      await t.tune(evaluate);

      expect(evaluate).toHaveBeenCalled();
    });
  });

  describe('different target metrics', () => {
    it('should minimize latency', async () => {
      const t = new AutoTuner({
        parameters: [{ name: 'param', min: 1, max: 5, step: 1, type: 'discrete', current: 3 }],
        searchStrategy: 'grid',
        maxIterations: 5,
        targetMetric: 'latency',
      });

      const evaluate = vi.fn()
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(75);

      const result = await t.tune(evaluate);

      expect(result.bestMetric).toBe(50); // Minimum
    });

    it('should minimize memory', async () => {
      const t = new AutoTuner({
        parameters: [{ name: 'param', min: 1, max: 5, step: 1, type: 'discrete', current: 3 }],
        searchStrategy: 'grid',
        maxIterations: 5,
        targetMetric: 'memory',
      });

      const evaluate = vi.fn()
        .mockResolvedValueOnce(1000)
        .mockResolvedValueOnce(500)
        .mockResolvedValueOnce(750);

      const result = await t.tune(evaluate);

      expect(result.bestMetric).toBe(500); // Minimum
    });

    it('should maximize throughput', async () => {
      const t = new AutoTuner({
        parameters: [{ name: 'param', min: 1, max: 5, step: 1, type: 'discrete', current: 3 }],
        searchStrategy: 'grid',
        maxIterations: 5,
        targetMetric: 'throughput',
      });

      const evaluate = vi.fn()
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(200)
        .mockResolvedValueOnce(150);

      const result = await t.tune(evaluate);

      expect(result.bestMetric).toBe(200); // Maximum
    });
  });
});

describe('DeviceTuner', () => {
  let tuner: DeviceTuner;

  beforeEach(() => {
    tuner = new DeviceTuner();
  });

  describe('tuneForDevice', () => {
    it('should tune parameters for specific device', async () => {
      const mockDevice = {
        vendor: 'nvidia',
        architecture: 'cuda',
      } as GPUAdapter;

      const parameters = [
        { name: 'batchSize', min: 1, max: 16, step: 1, type: 'discrete', current: 8 },
      ];

      const evaluate = vi.fn().mockResolvedValue(50);

      const result = await tuner.tuneForDevice(mockDevice, parameters, evaluate);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('batchSize');
    });

    it('should cache device profiles', async () => {
      const mockDevice = {
        vendor: 'nvidia',
        architecture: 'cuda',
      } as GPUAdapter;

      const parameters = [
        { name: 'batchSize', min: 1, max: 16, step: 1, type: 'discrete', current: 8 },
      ];

      const evaluate = vi.fn().mockResolvedValue(50);

      await tuner.tuneForDevice(mockDevice, parameters, evaluate);
      await tuner.tuneForDevice(mockDevice, parameters, evaluate);

      // Second call should use cached profile
      expect(evaluate).toHaveBeenCalledTimes(1);
    });
  });
});

describe('WorkgroupTuner', () => {
  let tuner: WorkgroupTuner;

  beforeEach(() => {
    tuner = new WorkgroupTuner();
  });

  describe('findOptimalWorkgroupSize', () => {
    it('should find optimal workgroup size', async () => {
      const shader = 'shader source';
      const mockDevice = {} as GPUDevice;
      const workloadSize: [number, number, number] = [256, 256, 1];

      const evaluate = vi.fn()
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(75);

      const result = await tuner.findOptimalWorkgroupSize(shader, mockDevice, workloadSize, evaluate);

      expect(result).toBeDefined();
      expect(result.length).toBe(3);
    });

    it('should return best workgroup size', async () => {
      const shader = 'shader source';
      const mockDevice = {} as GPUDevice;
      const workloadSize: [number, number, number] = [128, 128, 1];

      const evaluate = vi.fn((size) => {
        // Return lower latency for size [16, 16, 1]
        if (size[0] === 16 && size[1] === 16) return 25;
        return 100;
      });

      const result = await tuner.findOptimalWorkgroupSize(shader, mockDevice, workloadSize, evaluate);

      expect(result[0]).toBe(16);
      expect(result[1]).toBe(16);
    });
  });
});

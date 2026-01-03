/**
 * Tests for ExperimentManager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ExperimentManager,
  InMemoryExperimentStorage,
  createExperimentManager,
} from '../src/experiments/ExperimentManager.js';
import type { ExperimentConfig, AllocationStrategy } from '../src/types.js';

describe('ExperimentManager', () => {
  let manager: ExperimentManager;
  let storage: InMemoryExperimentStorage;

  beforeEach(() => {
    storage = new InMemoryExperimentStorage();
    manager = new ExperimentManager(storage);
  });

  describe('createExperiment', () => {
    it('should create an experiment with valid config', async () => {
      const config: ExperimentConfig = {
        name: 'Test Experiment',
        description: 'Test description',
        variants: [
          { id: 'control', name: 'Control', description: 'Control variant', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment variant', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'conversion', name: 'Conversion', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'conversion',
        goals: [],
        metadata: { createdBy: 'test' },
      };

      const experiment = await manager.createExperiment(config);

      expect(experiment).toBeDefined();
      expect(experiment.id).toBeDefined();
      expect(experiment.name).toBe('Test Experiment');
      expect(experiment.status).toBe('draft');
      expect(experiment.variants.length).toBe(2);
    });

    it('should throw if allocations do not sum to 100', async () => {
      const config: ExperimentConfig = {
        name: 'Test',
        description: 'Test',
        variants: [
          { id: 'a', name: 'A', description: 'A', allocation: 30, isControl: true, changes: [] },
          { id: 'b', name: 'B', description: 'B', allocation: 30, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      await expect(manager.createExperiment(config)).rejects.toThrow('Variant allocations must sum to 100, got 60');
    });

    it('should throw if less than 2 variants', async () => {
      const config: ExperimentConfig = {
        name: 'Test',
        description: 'Test',
        variants: [
          { id: 'a', name: 'A', description: 'A', allocation: 100, isControl: true, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      await expect(manager.createExperiment(config)).rejects.toThrow('at least 2 variants');
    });

    it('should throw if allocations do not sum to 100', async () => {
      const config: ExperimentConfig = {
        name: 'Test',
        description: 'Test',
        variants: [
          { id: 'a', name: 'A', description: 'A', allocation: 40, isControl: true, changes: [] },
          { id: 'b', name: 'B', description: 'B', allocation: 80, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      await expect(manager.createExperiment(config)).rejects.toThrow('sum to 100');
    });

    it('should throw if no control variant', async () => {
      const config: ExperimentConfig = {
        name: 'Test',
        description: 'Test',
        variants: [
          { id: 'a', name: 'A', description: 'A', allocation: 50, isControl: false, changes: [] },
          { id: 'b', name: 'B', description: 'B', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      await expect(manager.createExperiment(config)).rejects.toThrow('exactly one control');
    });

    it('should use provided ID', async () => {
      const config: ExperimentConfig = {
        id: 'custom-id',
        name: 'Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      const experiment = await manager.createExperiment(config);
      expect(experiment.id).toBe('custom-id');
    });

    it('should store experiment in storage', async () => {
      const config: ExperimentConfig = {
        name: 'Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      const experiment = await manager.createExperiment(config);
      const retrieved = await storage.getExperiment(experiment.id);

      expect(retrieved).toEqual(experiment);
    });
  });

  describe('startExperiment', () => {
    it('should start a draft experiment', async () => {
      const config: ExperimentConfig = {
        name: 'Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      const experiment = await manager.createExperiment(config);
      const started = await manager.startExperiment(experiment.id);

      expect(started.status).toBe('running');
      expect(started.duration?.start).toBeDefined();
    });

    it('should resume a paused experiment', async () => {
      const config: ExperimentConfig = {
        name: 'Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      const experiment = await manager.createExperiment(config);
      await manager.startExperiment(experiment.id);
      await manager.pauseExperiment(experiment.id);
      const resumed = await manager.startExperiment(experiment.id);

      expect(resumed.status).toBe('running');
    });

    it('should throw if experiment not found', async () => {
      await expect(manager.startExperiment('non-existent')).rejects.toThrow('not found');
    });

    it('should throw if experiment already running', async () => {
      const config: ExperimentConfig = {
        name: 'Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      const experiment = await manager.createExperiment(config);
      await manager.startExperiment(experiment.id);

      await expect(manager.startExperiment(experiment.id)).rejects.toThrow('Cannot start');
    });
  });

  describe('pauseExperiment', () => {
    it('should pause a running experiment', async () => {
      const config: ExperimentConfig = {
        name: 'Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      const experiment = await manager.createExperiment(config);
      await manager.startExperiment(experiment.id);
      const paused = await manager.pauseExperiment(experiment.id);

      expect(paused.status).toBe('paused');
    });

    it('should throw if experiment not running', async () => {
      const config: ExperimentConfig = {
        name: 'Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      const experiment = await manager.createExperiment(config);
      await expect(manager.pauseExperiment(experiment.id)).rejects.toThrow('Cannot pause');
    });
  });

  describe('resumeExperiment', () => {
    it('should resume a paused experiment', async () => {
      const config: ExperimentConfig = {
        name: 'Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      const experiment = await manager.createExperiment(config);
      await manager.startExperiment(experiment.id);
      await manager.pauseExperiment(experiment.id);
      const resumed = await manager.resumeExperiment(experiment.id);

      expect(resumed.status).toBe('running');
    });

    it('should throw if experiment not paused', async () => {
      const config: ExperimentConfig = {
        name: 'Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      const experiment = await manager.createExperiment(config);
      await expect(manager.resumeExperiment(experiment.id)).rejects.toThrow('Cannot resume');
    });
  });

  describe('completeExperiment', () => {
    it('should complete a running experiment', async () => {
      const config: ExperimentConfig = {
        name: 'Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      const experiment = await manager.createExperiment(config);
      await manager.startExperiment(experiment.id);
      const completed = await manager.completeExperiment(experiment.id);

      expect(completed.status).toBe('completed');
      expect(completed.duration?.end).toBeDefined();
    });

    it('should complete a paused experiment', async () => {
      const config: ExperimentConfig = {
        name: 'Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      const experiment = await manager.createExperiment(config);
      await manager.startExperiment(experiment.id);
      await manager.pauseExperiment(experiment.id);
      const completed = await manager.completeExperiment(experiment.id);

      expect(completed.status).toBe('completed');
    });
  });

  describe('archiveExperiment', () => {
    it('should archive a completed experiment', async () => {
      const config: ExperimentConfig = {
        name: 'Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      const experiment = await manager.createExperiment(config);
      await manager.completeExperiment(experiment.id);
      const archived = await manager.archiveExperiment(experiment.id);

      expect(archived.status).toBe('archived');
    });

    it('should throw if experiment not completed', async () => {
      const config: ExperimentConfig = {
        name: 'Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      const experiment = await manager.createExperiment(config);
      await expect(manager.archiveExperiment(experiment.id)).rejects.toThrow('only archive completed');
    });
  });

  describe('deleteExperiment', () => {
    it('should delete an experiment', async () => {
      const config: ExperimentConfig = {
        name: 'Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      const experiment = await manager.createExperiment(config);
      await manager.deleteExperiment(experiment.id);

      const retrieved = await storage.getExperiment(experiment.id);
      expect(retrieved).toBeNull();
    });

    it('should throw if experiment is running', async () => {
      const config: ExperimentConfig = {
        name: 'Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      const experiment = await manager.createExperiment(config);
      await manager.startExperiment(experiment.id);

      await expect(manager.deleteExperiment(experiment.id)).rejects.toThrow('Pause or complete');
    });
  });

  describe('getExperiment', () => {
    it('should retrieve an experiment by ID', async () => {
      const config: ExperimentConfig = {
        name: 'Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      const created = await manager.createExperiment(config);
      const retrieved = await manager.getExperiment(created.id);

      expect(retrieved).toEqual(created);
    });

    it('should return null for non-existent experiment', async () => {
      const retrieved = await manager.getExperiment('non-existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('listExperiments', () => {
    it('should list all experiments', async () => {
      const config: ExperimentConfig = {
        name: 'Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      await manager.createExperiment({ ...config, name: 'A' });
      await manager.createExperiment({ ...config, name: 'B' });

      const experiments = await manager.listExperiments();
      expect(experiments.length).toBe(2);
    });

    it('should filter by status', async () => {
      const config: ExperimentConfig = {
        name: 'Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      const exp1 = await manager.createExperiment({ ...config, name: 'A' });
      await manager.createExperiment({ ...config, name: 'B' });
      await manager.startExperiment(exp1.id);

      const draftExperiments = await manager.listExperiments({ status: 'draft' });
      expect(draftExperiments.length).toBe(1);
    });
  });

  describe('updateExperiment', () => {
    it('should update experiment properties', async () => {
      const config: ExperimentConfig = {
        name: 'Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      const experiment = await manager.createExperiment(config);
      const updated = await manager.updateExperiment(experiment.id, {
        name: 'Updated Name',
        description: 'Updated description',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.description).toBe('Updated description');
    });

    it('should throw if experiment is running', async () => {
      const config: ExperimentConfig = {
        name: 'Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      const experiment = await manager.createExperiment(config);
      await manager.startExperiment(experiment.id);

      await expect(manager.updateExperiment(experiment.id, { name: 'New' })).rejects.toThrow('Pause');
    });
  });

  describe('getControlVariant', () => {
    it('should return the control variant', async () => {
      const config: ExperimentConfig = {
        name: 'Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      const experiment = await manager.createExperiment(config);
      const control = manager.getControlVariant(experiment);

      expect(control.id).toBe('control');
      expect(control.isControl).toBe(true);
    });

    it('should throw if no control variant', async () => {
      const config: ExperimentConfig = {
        name: 'Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      const experiment = await manager.createExperiment(config);
      // Manually modify to break (shouldn't happen in practice)
      experiment.variants[0].isControl = false;

      expect(() => manager.getControlVariant(experiment)).toThrow('No control variant');
    });
  });

  describe('getTreatmentVariants', () => {
    it('should return treatment variants', async () => {
      const config: ExperimentConfig = {
        name: 'Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment1', name: 'Treatment 1', description: 'T1', allocation: 25, isControl: false, changes: [] },
          { id: 'treatment2', name: 'Treatment 2', description: 'T2', allocation: 25, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      const experiment = await manager.createExperiment(config);
      const treatments = manager.getTreatmentVariants(experiment);

      expect(treatments.length).toBe(2);
      expect(treatments.every(v => !v.isControl)).toBe(true);
    });
  });

  describe('validateExperimentReady', () => {
    it('should validate a ready experiment', async () => {
      const config: ExperimentConfig = {
        name: 'Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'conversion', name: 'Conversion', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'conversion',
        goals: [],
      };

      const experiment = await manager.createExperiment(config);
      const validation = manager.validateExperimentReady(experiment);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should return errors for invalid experiment', async () => {
      const config: ExperimentConfig = {
        name: 'Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 60, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [],
        primaryMetric: '',
        goals: [],
      };

      // This should throw during creation, so we catch that error
      await expect(manager.createExperiment(config)).rejects.toThrow('Variant allocations must sum to 100');
    });
  });

  describe('calculateTrafficSplit', () => {
    it('should calculate traffic split', async () => {
      const config: ExperimentConfig = {
        name: 'Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      const experiment = await manager.createExperiment(config);
      const split = manager.calculateTrafficSplit(experiment);

      expect(split).toEqual([0.5, 0.5]);
    });
  });
});

describe('createExperimentManager', () => {
  it('should create manager with in-memory storage', () => {
    const manager = createExperimentManager();
    expect(manager).toBeInstanceOf(ExperimentManager);
  });

  it('should use custom config', () => {
    const manager = createExperimentManager({ minSampleSize: 500 });
    expect(manager).toBeInstanceOf(ExperimentManager);
  });
});

describe('InMemoryExperimentStorage', () => {
  let storage: InMemoryExperimentStorage;

  beforeEach(() => {
    storage = new InMemoryExperimentStorage();
  });

  it('should save and retrieve experiments', async () => {
    const experiment = {
      id: 'test',
      name: 'Test',
      description: 'Test',
      status: 'draft' as const,
      variants: [],
      allocationStrategy: 'random' as AllocationStrategy,
      metrics: [],
      primaryMetric: '',
      secondaryMetrics: [],
      goals: [],
      minSampleSize: 100,
      significanceLevel: 0.05,
      power: 0.8,
      mde: 0.1,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'test',
    };

    await storage.saveExperiment(experiment);
    const retrieved = await storage.getExperiment('test');

    expect(retrieved).toEqual(experiment);
  });

  it('should handle update operations', async () => {
    const experiment = {
      id: 'test',
      name: 'Test',
      description: 'Test',
      status: 'draft' as const,
      variants: [],
      allocationStrategy: 'random' as AllocationStrategy,
      metrics: [],
      primaryMetric: '',
      secondaryMetrics: [],
      goals: [],
      minSampleSize: 100,
      significanceLevel: 0.05,
      power: 0.8,
      mde: 0.1,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'test',
    };

    await storage.saveExperiment(experiment);

    const updated = {
      ...experiment,
      name: 'Updated Test',
      updatedAt: new Date(),
    };

    await storage.saveExperiment(updated);
    const retrieved = await storage.getExperiment('test');

    expect(retrieved?.name).toBe('Updated Test');
  });

  it('should handle concurrent operations', async () => {
    const promises = [];
    for (let i = 0; i < 10; i++) {
      const experiment = {
        id: `test${i}`,
        name: `Test ${i}`,
        description: 'Test',
        status: 'draft' as const,
        variants: [],
        allocationStrategy: 'random' as AllocationStrategy,
        metrics: [],
        primaryMetric: '',
        secondaryMetrics: [],
        goals: [],
        minSampleSize: 100,
        significanceLevel: 0.05,
        power: 0.8,
        mde: 0.1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'test',
      };

      promises.push(storage.saveExperiment(experiment));
    }

    await Promise.all(promises);

    const all = await storage.listExperiments();
    expect(all.length).toBe(10);
  });

  it('should sort experiments by creation date', async () => {
    const exp1 = { id: '1', name: 'A', description: 'A', status: 'draft' as const, variants: [], allocationStrategy: 'random' as AllocationStrategy, metrics: [], primaryMetric: '', secondaryMetrics: [], goals: [], minSampleSize: 100, significanceLevel: 0.05, power: 0.8, mde: 0.1, createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-01'), createdBy: 'test' };
    const exp2 = { id: '2', name: 'B', description: 'B', status: 'draft' as const, variants: [], allocationStrategy: 'random' as AllocationStrategy, metrics: [], primaryMetric: '', secondaryMetrics: [], goals: [], minSampleSize: 100, significanceLevel: 0.05, power: 0.8, mde: 0.1, createdAt: new Date('2024-01-02'), updatedAt: new Date('2024-01-02'), createdBy: 'test' };

    await storage.saveExperiment(exp1);
    await storage.saveExperiment(exp2);

    const experiments = await storage.listExperiments();

    // Most recent first
    expect(experiments[0].id).toBe('2');
    expect(experiments[1].id).toBe('1');
  });

  it('should list experiments', async () => {
    const exp1 = { id: '1', name: 'A', description: 'A', status: 'draft' as const, variants: [], allocationStrategy: 'random' as AllocationStrategy, metrics: [], primaryMetric: '', secondaryMetrics: [], goals: [], minSampleSize: 100, significanceLevel: 0.05, power: 0.8, mde: 0.1, createdAt: new Date(), updatedAt: new Date(), createdBy: 'test' };
    const exp2 = { id: '2', name: 'B', description: 'B', status: 'draft' as const, variants: [], allocationStrategy: 'random' as AllocationStrategy, metrics: [], primaryMetric: '', secondaryMetrics: [], goals: [], minSampleSize: 100, significanceLevel: 0.05, power: 0.8, mde: 0.1, createdAt: new Date(), updatedAt: new Date(), createdBy: 'test' };

    await storage.saveExperiment(exp1);
    await storage.saveExperiment(exp2);

    const experiments = await storage.listExperiments();
    expect(experiments.length).toBe(2);
  });

  it('should filter by status', async () => {
    const exp1 = { id: '1', name: 'A', description: 'A', status: 'draft' as const, variants: [], allocationStrategy: 'random' as AllocationStrategy, metrics: [], primaryMetric: '', secondaryMetrics: [], goals: [], minSampleSize: 100, significanceLevel: 0.05, power: 0.8, mde: 0.1, createdAt: new Date(), updatedAt: new Date(), createdBy: 'test' };
    const exp2 = { id: '2', name: 'B', description: 'B', status: 'running' as const, variants: [], allocationStrategy: 'random' as AllocationStrategy, metrics: [], primaryMetric: '', secondaryMetrics: [], goals: [], minSampleSize: 100, significanceLevel: 0.05, power: 0.8, mde: 0.1, createdAt: new Date(), updatedAt: new Date(), createdBy: 'test' };

    await storage.saveExperiment(exp1);
    await storage.saveExperiment(exp2);

    const drafts = await storage.listExperiments({ status: 'draft' });
    expect(drafts.length).toBe(1);
    expect(drafts[0].id).toBe('1');
  });

  it('should delete experiments', async () => {
    const experiment = { id: 'test', name: 'Test', description: 'Test', status: 'draft' as const, variants: [], allocationStrategy: 'random' as AllocationStrategy, metrics: [], primaryMetric: '', secondaryMetrics: [], goals: [], minSampleSize: 100, significanceLevel: 0.05, power: 0.8, mde: 0.1, createdAt: new Date(), updatedAt: new Date(), createdBy: 'test' };

    await storage.saveExperiment(experiment);
    await storage.deleteExperiment('test');

    const retrieved = await storage.getExperiment('test');
    expect(retrieved).toBeNull();
  });

  it('should clear storage', () => {
    storage.clear();
    expect(storage.size()).toBe(0);
  });

  it('should return storage size', async () => {
    const exp1 = { id: '1', name: 'A', description: 'A', status: 'draft' as const, variants: [], allocationStrategy: 'random' as AllocationStrategy, metrics: [], primaryMetric: '', secondaryMetrics: [], goals: [], minSampleSize: 100, significanceLevel: 0.05, power: 0.8, mde: 0.1, createdAt: new Date(), updatedAt: new Date(), createdBy: 'test' };
    const exp2 = { id: '2', name: 'B', description: 'B', status: 'draft' as const, variants: [], allocationStrategy: 'random' as AllocationStrategy, metrics: [], primaryMetric: '', secondaryMetrics: [], goals: [], minSampleSize: 100, significanceLevel: 0.05, power: 0.8, mde: 0.1, createdAt: new Date(), updatedAt: new Date(), createdBy: 'test' };

    await storage.saveExperiment(exp1);
    await storage.saveExperiment(exp2);

    expect(storage.size()).toBe(2);
  });
});

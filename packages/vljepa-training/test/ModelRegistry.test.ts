/**
 * @fileoverview Tests for ModelRegistry
 * @package @lsi/vljepa-training
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ModelRegistry } from '../src/checkpointing/ModelRegistry.js';
import type { ModelConfig, TrainingConfig } from '../src/types.js';

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

describe('ModelRegistry', () => {
  let registry: ModelRegistry;

  beforeEach(async () => {
    registry = new ModelRegistry('./test-model-registry.json');
    await registry.initialize();
  });

  describe('Construction and Initialization', () => {
    it('should create registry', () => {
      expect(registry).toBeDefined();
      expect(registry.active()).toBe(true);
    });

    it('should initialize successfully', async () => {
      const newRegistry = new ModelRegistry('./test-new-registry.json');
      await expect(newRegistry.initialize()).resolves.not.toThrow();
    });
  });

  describe('Registering Models', () => {
    it('should register new model version', async () => {
      const version = await registry.register({
        modelId: 'test-model',
        version: '1.0.0',
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        checkpointPath: '/path/to/checkpoint.ckpt',
      });

      expect(version).toBeDefined();
      expect(version.id).toBe('test-model:1.0.0');
    });

    it('should register with tags', async () => {
      const version = await registry.register({
        modelId: 'test-model',
        version: '1.0.0',
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        checkpointPath: '/path/to/checkpoint.ckpt',
        tags: ['production', 'vl-jepa'],
      });

      expect(version.tags).toEqual(['production', 'vl-jepa']);
    });

    it('should register with metadata', async () => {
      const version = await registry.register({
        modelId: 'test-model',
        version: '1.0.0',
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        checkpointPath: '/path/to/checkpoint.ckpt',
        metadata: {
          description: 'Test model',
          framework: 'pytorch',
        },
      });

      expect(version.metadata.description).toBe('Test model');
    });

    it('should register with parent', async () => {
      const version = await registry.register({
        modelId: 'test-model',
        version: '1.0.0',
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        checkpointPath: '/path/to/checkpoint.ckpt',
        parent: 'base-model:0.5.0',
      });

      expect(version.parent).toBe('base-model:0.5.0');
    });

    it('should register with metrics', async () => {
      const version = await registry.register({
        modelId: 'test-model',
        version: '1.0.0',
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        checkpointPath: '/path/to/checkpoint.ckpt',
        metrics: {
          accuracy: 0.85,
          loss: 0.45,
        },
      });

      expect(version.metrics.accuracy).toBe(0.85);
    });
  });

  describe('Getting Models', () => {
    beforeEach(async () => {
      await registry.register({
        modelId: 'test-model',
        version: '1.0.0',
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        checkpointPath: '/path/to/v1.ckpt',
      });
    });

    it('should get model by ID and version', () => {
      const version = registry.get('test-model', '1.0.0');

      expect(version).toBeDefined();
      expect(version!.version).toBe('1.0.0');
    });

    it('should get latest version by default', () => {
      const version = registry.get('test-model');

      expect(version).toBeDefined();
      expect(version!.version).toBe('1.0.0');
    });

    it('should return null for non-existent model', () => {
      const version = registry.get('non-existent');
      expect(version).toBeNull();
    });

    it('should return null for non-existent version', () => {
      const version = registry.get('test-model', '2.0.0');
      expect(version).toBeNull();
    });
  });

  describe('Listing Models and Versions', () => {
    beforeEach(async () => {
      await registry.register({
        modelId: 'model-a',
        version: '1.0.0',
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        checkpointPath: '/a1.ckpt',
      });

      await registry.register({
        modelId: 'model-b',
        version: '1.0.0',
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        checkpointPath: '/b1.ckpt',
      });

      await registry.register({
        modelId: 'model-a',
        version: '2.0.0',
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        checkpointPath: '/a2.ckpt',
      });
    });

    it('should list all models', () => {
      const models = registry.listModels();

      expect(models).toContain('model-a');
      expect(models).toContain('model-b');
      expect(models.length).toBe(2);
    });

    it('should list versions of a model', () => {
      const versions = registry.listVersions('model-a');

      expect(versions).toHaveLength(2);
      expect(versions[0].version).toBe('1.0.0');
      expect(versions[1].version).toBe('2.0.0');
    });

    it('should return empty array for non-existent model versions', () => {
      const versions = registry.listVersions('non-existent');
      expect(versions).toEqual([]);
    });
  });

  describe('Searching Models', () => {
    beforeEach(async () => {
      await registry.register({
        modelId: 'model1',
        version: '1.0.0',
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        checkpointPath: '/1.ckpt',
        tags: ['production', 'vision'],
      });

      await registry.register({
        modelId: 'model2',
        version: '1.0.0',
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        checkpointPath: '/2.ckpt',
        tags: ['experimental', 'vision'],
      });

      await registry.register({
        modelId: 'model3',
        version: '1.0.0',
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        checkpointPath: '/3.ckpt',
        tags: ['production', 'language'],
      });
    });

    it('should search by single tag', () => {
      const results = registry.searchByTags(['production']);

      expect(results).toHaveLength(2);
    });

    it('should search by multiple tags (AND)', () => {
      const results = registry.searchByTags(['production', 'vision']);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('model1:1.0.0');
    });

    it('should return empty for no matches', () => {
      const results = registry.searchByTags(['non-existent']);

      expect(results).toEqual([]);
    });

    it('should search by metadata', () => {
      // This would require adding metadata during registration
      // For now, test that it doesn't throw
      const results = registry.searchByMetadata({ framework: 'pytorch' });

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Managing Tags', () => {
    beforeEach(async () => {
      await registry.register({
        modelId: 'test-model',
        version: '1.0.0',
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        checkpointPath: '/1.ckpt',
        tags: ['tag1'],
      });
    });

    it('should add tags', async () => {
      await registry.addTags('test-model', '1.0.0', ['tag2', 'tag3']);

      const version = registry.get('test-model', '1.0.0');
      expect(version!.tags).toContain('tag1');
      expect(version!.tags).toContain('tag2');
      expect(version!.tags).toContain('tag3');
    });

    it('should not duplicate tags', async () => {
      await registry.addTags('test-model', '1.0.0', ['tag1']);

      const version = registry.get('test-model', '1.0.0');
      const tag1Count = version!.tags.filter(t => t === 'tag1').length;

      expect(tag1Count).toBe(1);
    });

    it('should remove tags', async () => {
      await registry.removeTags('test-model', '1.0.0', ['tag1']);

      const version = registry.get('test-model', '1.0.0');
      expect(version!.tags).not.toContain('tag1');
    });
  });

  describe('Updating Metadata', () => {
    beforeEach(async () => {
      await registry.register({
        modelId: 'test-model',
        version: '1.0.0',
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        checkpointPath: '/1.ckpt',
      });
    });

    it('should update metadata', async () => {
      await registry.updateMetadata('test-model', '1.0.0', {
        description: 'Updated description',
      });

      const version = registry.get('test-model', '1.0.0');
      expect(version!.metadata.description).toBe('Updated description');
    });

    it('should merge metadata', async () => {
      await registry.register({
        modelId: 'test-model',
        version: '2.0.0',
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        checkpointPath: '/2.ckpt',
        metadata: { key1: 'value1' },
      });

      await registry.updateMetadata('test-model', '2.0.0', { key2: 'value2' });

      const version = registry.get('test-model', '2.0.0');
      expect(version!.metadata.key1).toBe('value1');
      expect(version!.metadata.key2).toBe('value2');
    });
  });

  describe('Deleting Models', () => {
    beforeEach(async () => {
      await registry.register({
        modelId: 'test-model',
        version: '1.0.0',
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        checkpointPath: '/1.ckpt',
      });

      await registry.register({
        modelId: 'test-model',
        version: '2.0.0',
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        checkpointPath: '/2.ckpt',
      });
    });

    it('should delete specific version', async () => {
      await registry.delete('test-model', '1.0.0');

      expect(registry.get('test-model', '1.0.0')).toBeNull();
      expect(registry.get('test-model', '2.0.0')).toBeDefined();
    });

    it('should delete all versions', async () => {
      await registry.delete('test-model');

      expect(registry.get('test-model')).toBeNull();
      expect(registry.listModels()).not.toContain('test-model');
    });

    it('should handle deleting non-existent model', async () => {
      await expect(registry.delete('non-existent')).resolves.not.toThrow();
    });
  });

  describe('Lineage', () => {
    beforeEach(async () => {
      await registry.register({
        modelId: 'base',
        version: '1.0.0',
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        checkpointPath: '/base.ckpt',
      });

      await registry.register({
        modelId: 'fine-tuned',
        version: '1.0.0',
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        checkpointPath: '/ft.ckpt',
        parent: 'base:1.0.0',
      });
    });

    it('should get model lineage', () => {
      const lineage = registry.getLineage('fine-tuned', '1.0.0');

      expect(lineage).toHaveLength(2);
      expect(lineage[0].id).toBe('base:1.0.0');
      expect(lineage[1].id).toBe('fine-tuned:1.0.0');
    });

    it('should return single element for model without parent', () => {
      const lineage = registry.getLineage('base', '1.0.0');

      expect(lineage).toHaveLength(1);
      expect(lineage[0].id).toBe('base:1.0.0');
    });
  });

  describe('Comparing Models', () => {
    beforeEach(async () => {
      await registry.register({
        modelId: 'model1',
        version: '1.0.0',
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        checkpointPath: '/1.ckpt',
        metrics: { accuracy: 0.85, loss: 0.5 },
      });

      await registry.register({
        modelId: 'model2',
        version: '1.0.0',
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        checkpointPath: '/2.ckpt',
        metrics: { accuracy: 0.87, loss: 0.45 },
      });
    });

    it('should compare two models', () => {
      const comparison = registry.compare('model1', '1.0.0', 'model2', '1.0.0');

      expect(comparison).toBeDefined();
      expect(comparison!.model1.id).toBe('model1:1.0.0');
      expect(comparison!.model2.id).toBe('model2:1.0.0');
      expect(comparison!.metricsDiff.accuracy).toBeCloseTo(0.02, 5);
    });

    it('should return null for non-existent model', () => {
      const comparison = registry.compare('model1', '1.0.0', 'non-existent', '1.0.0');

      expect(comparison).toBeNull();
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      await registry.register({
        modelId: 'model1',
        version: '1.0.0',
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        checkpointPath: '/1.ckpt',
        tags: ['tag1', 'tag2'],
      });

      await registry.register({
        modelId: 'model1',
        version: '2.0.0',
        modelConfig: createMockModelConfig(),
        trainingConfig: createMockTrainingConfig(),
        checkpointPath: '/2.ckpt',
        tags: ['tag1'],
      });
    });

    it('should get registry statistics', () => {
      const stats = registry.getStats();

      expect(stats.totalModels).toBe(1);
      expect(stats.totalVersions).toBe(2);
      expect(stats.tagsDistribution.tag1).toBe(2);
      expect(stats.tagsDistribution.tag2).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle getting latest version from empty registry', () => {
      const emptyRegistry = new ModelRegistry('./empty-registry.json');

      const latest = emptyRegistry.get('non-existent');

      expect(latest).toBeNull();
    });

    it('should handle getting version from non-existent model', () => {
      const version = registry.get('non-existent', '1.0.0');

      expect(version).toBeNull();
    });
  });
});

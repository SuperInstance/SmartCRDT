/**
 * @fileoverview Tests for ModelRegistry
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ModelRegistry } from '../src/registry/ModelRegistry.js';
import type { ModelRegistryConfig, ModelMetadata, ModelVersion, RegisteredModel } from '../src/types.js';

describe('ModelRegistry', () => {
  let registry: ModelRegistry;
  let testDir: string;

  beforeEach(() => {
    testDir = `/tmp/test-registry-${Date.now()}`;
    const config: ModelRegistryConfig = {
      storage: {
        type: 'local',
        localPath: testDir,
        enableCache: true,
      },
      metadataValidation: true,
      versioningStrategy: 'semantic',
      autoArchive: false,
      maxVersions: 10,
    };
    registry = new ModelRegistry(config);
  });

  afterEach(async () => {
    // Cleanup would happen here
  });

  describe('registerModel', () => {
    it('should register a new model', async () => {
      const metadata: ModelMetadata = {
        type: 'vl_jepa',
        architecture: 'transformer',
        framework: 'pytorch',
        inputShape: [3, 224, 224],
        outputShape: [768],
        parameters: 1000000,
        size: 4.0,
        dataset: 'test-dataset',
        custom: {},
      };

      const model = await registry.registerModel(
        'test-model',
        'Test model description',
        metadata,
        ['tag1', 'tag2']
      );

      expect(model).toBeDefined();
      expect(model.id).toBeDefined();
      expect(model.name).toBe('test-model');
      expect(model.description).toBe('Test model description');
      expect(model.metadata).toEqual(metadata);
      expect(model.tags).toEqual(['tag1', 'tag2']);
      expect(model.stage).toBe('development');
      expect(model.versions).toHaveLength(0);
    });

    it('should reject empty model name', async () => {
      const metadata: ModelMetadata = {
        type: 'vl_jepa',
        architecture: 'transformer',
        framework: 'pytorch',
        inputShape: [3, 224, 224],
        outputShape: [768],
        parameters: 1000000,
        size: 4.0,
        dataset: 'test',
        custom: {},
      };

      await expect(
        registry.registerModel('', 'desc', metadata)
      ).rejects.toThrow('Model name cannot be empty');
    });

    it('should reject duplicate model names', async () => {
      const metadata: ModelMetadata = {
        type: 'vl_jepa',
        architecture: 'transformer',
        framework: 'pytorch',
        inputShape: [3, 224, 224],
        outputShape: [768],
        parameters: 1000000,
        size: 4.0,
        dataset: 'test',
        custom: {},
      };

      await registry.registerModel('duplicate', 'desc', metadata);

      await expect(
        registry.registerModel('duplicate', 'desc2', metadata)
      ).rejects.toThrow('already exists');
    });

    it('should validate metadata when enabled', async () => {
      const invalidMetadata: ModelMetadata = {
        type: '' as any,
        architecture: '',
        framework: '',
        inputShape: [],
        outputShape: [],
        parameters: -1,
        size: 0,
        dataset: '',
        custom: {},
      };

      await expect(
        registry.registerModel('test', 'desc', invalidMetadata)
      ).rejects.toThrow();
    });

    it('should create unique IDs for each model', async () => {
      const metadata: ModelMetadata = {
        type: 'vl_jepa',
        architecture: 'transformer',
        framework: 'pytorch',
        inputShape: [3, 224, 224],
        outputShape: [768],
        parameters: 1000000,
        size: 4.0,
        dataset: 'test',
        custom: {},
      };

      const model1 = await registry.registerModel('model1', 'desc', metadata);
      const model2 = await registry.registerModel('model2', 'desc', metadata);

      expect(model1.id).not.toBe(model2.id);
    });

    it('should set creation and update timestamps', async () => {
      const metadata: ModelMetadata = {
        type: 'vl_jepa',
        architecture: 'transformer',
        framework: 'pytorch',
        inputShape: [3, 224, 224],
        outputShape: [768],
        parameters: 1000000,
        size: 4.0,
        dataset: 'test',
        custom: {},
      };

      const before = Date.now();
      const model = await registry.registerModel('test', 'desc', metadata);
      const after = Date.now();

      expect(model.created).toBeGreaterThanOrEqual(before);
      expect(model.created).toBeLessThanOrEqual(after);
      expect(model.updated).toBe(model.created);
    });
  });

  describe('getModel', () => {
    it('should retrieve a registered model', async () => {
      const metadata: ModelMetadata = {
        type: 'vl_jepa',
        architecture: 'transformer',
        framework: 'pytorch',
        inputShape: [3, 224, 224],
        outputShape: [768],
        parameters: 1000000,
        size: 4.0,
        dataset: 'test',
        custom: {},
      };

      const created = await registry.registerModel('test-model', 'desc', metadata);
      const retrieved = await registry.getModel(created.id);

      expect(retrieved).toEqual(created);
    });

    it('return undefined for non-existent model', async () => {
      const retrieved = await registry.getModel('non-existent-id');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getModelByName', () => {
    it('should retrieve a model by name', async () => {
      const metadata: ModelMetadata = {
        type: 'vl_jepa',
        architecture: 'transformer',
        framework: 'pytorch',
        inputShape: [3, 224, 224],
        outputShape: [768],
        parameters: 1000000,
        size: 4.0,
        dataset: 'test',
        custom: {},
      };

      await registry.registerModel('find-me', 'desc', metadata);
      const retrieved = await registry.getModelByName('find-me');

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('find-me');
    });

    it('return undefined for non-existent name', async () => {
      const retrieved = await registry.getModelByName('does-not-exist');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('listModels', () => {
    beforeEach(async () => {
      const metadata: ModelMetadata = {
        type: 'vl_jepa',
        architecture: 'transformer',
        framework: 'pytorch',
        inputShape: [3, 224, 224],
        outputShape: [768],
        parameters: 1000000,
        size: 4.0,
        dataset: 'test',
        custom: {},
      };

      await registry.registerModel('model-a', 'desc', metadata);
      await registry.registerModel('model-b', 'desc', metadata);
      await registry.registerModel('model-c', 'desc', metadata);
    });

    it('should list all models', async () => {
      const result = await registry.listModels();

      expect(result.total).toBe(3);
      expect(result.items).toHaveLength(3);
    });

    it('should support pagination', async () => {
      const result = await registry.listModels(undefined, undefined, { page: 1, pageSize: 2 });

      expect(result.total).toBe(3);
      expect(result.items).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(2);
      expect(result.hasNext).toBe(true);
      expect(result.hasPrevious).toBe(false);
    });

    it('should filter by model type', async () => {
      const result = await registry.listModels({ type: 'vl_jepa' });

      expect(result.total).toBe(3);
    });

    it('should filter by stage', async () => {
      const result = await registry.listModels({ stage: 'development' });

      expect(result.total).toBe(3);
    });

    it('should filter by tags', async () => {
      const metadata: ModelMetadata = {
        type: 'vl_jepa',
        architecture: 'transformer',
        framework: 'pytorch',
        inputShape: [3, 224, 224],
        outputShape: [768],
        parameters: 1000000,
        size: 4.0,
        dataset: 'test',
        custom: {},
      };

      await registry.registerModel('tagged', 'desc', metadata, ['special']);

      const result = await registry.listModels({ tags: ['special'] });

      expect(result.total).toBe(1);
      expect(result.items[0].name).toBe('tagged');
    });

    it('should filter by parameter count range', async () => {
      const result = await registry.listModels({
        minParameters: 500000,
        maxParameters: 2000000,
      });

      expect(result.total).toBe(3);
    });

    it('should sort by name', async () => {
      const result = await registry.listModels(
        undefined,
        { field: 'name', order: 'asc' }
      );

      expect(result.items[0].name).toBe('model-a');
      expect(result.items[1].name).toBe('model-b');
      expect(result.items[2].name).toBe('model-c');
    });

    it('should sort by created date', async () => {
      const result = await registry.listModels(
        undefined,
        { field: 'created', order: 'desc' }
      );

      expect(result.items[0].name).toBe('model-c');
    });
  });

  describe('updateModel', () => {
    it('should update model name', async () => {
      const metadata: ModelMetadata = {
        type: 'vl_jepa',
        architecture: 'transformer',
        framework: 'pytorch',
        inputShape: [3, 224, 224],
        outputShape: [768],
        parameters: 1000000,
        size: 4.0,
        dataset: 'test',
        custom: {},
      };

      const model = await registry.registerModel('old-name', 'desc', metadata);
      const updated = await registry.updateModel(model.id, { name: 'new-name' });

      expect(updated.name).toBe('new-name');
    });

    it('should update model description', async () => {
      const metadata: ModelMetadata = {
        type: 'vl_jepa',
        architecture: 'transformer',
        framework: 'pytorch',
        inputShape: [3, 224, 224],
        outputShape: [768],
        parameters: 1000000,
        size: 4.0,
        dataset: 'test',
        custom: {},
      };

      const model = await registry.registerModel('test', 'old desc', metadata);
      const updated = await registry.updateModel(model.id, { description: 'new desc' });

      expect(updated.description).toBe('new desc');
    });

    it('should update model tags', async () => {
      const metadata: ModelMetadata = {
        type: 'vl_jepa',
        architecture: 'transformer',
        framework: 'pytorch',
        inputShape: [3, 224, 224],
        outputShape: [768],
        parameters: 1000000,
        size: 4.0,
        dataset: 'test',
        custom: {},
      };

      const model = await registry.registerModel('test', 'desc', metadata, ['old']);
      const updated = await registry.updateModel(model.id, { tags: ['new1', 'new2'] });

      expect(updated.tags).toEqual(['new1', 'new2']);
    });

    it('should update model stage', async () => {
      const metadata: ModelMetadata = {
        type: 'vl_jepa',
        architecture: 'transformer',
        framework: 'pytorch',
        inputShape: [3, 224, 224],
        outputShape: [768],
        parameters: 1000000,
        size: 4.0,
        dataset: 'test',
        custom: {},
      };

      const model = await registry.registerModel('test', 'desc', metadata);
      const updated = await registry.updateModel(model.id, { stage: 'staging' });

      expect(updated.stage).toBe('staging');
    });

    it('should update timestamp on modification', async () => {
      const metadata: ModelMetadata = {
        type: 'vl_jepa',
        architecture: 'transformer',
        framework: 'pytorch',
        inputShape: [3, 224, 224],
        outputShape: [768],
        parameters: 1000000,
        size: 4.0,
        dataset: 'test',
        custom: {},
      };

      const model = await registry.registerModel('test', 'desc', metadata);
      const before = model.updated;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await registry.updateModel(model.id, { name: 'new' });

      expect(updated.updated).toBeGreaterThan(before);
    });

    it('should reject updates for non-existent model', async () => {
      await expect(
        registry.updateModel('non-existent', { name: 'new' })
      ).rejects.toThrow('Model not found');
    });
  });

  describe('deleteModel', () => {
    it('should delete a model', async () => {
      const metadata: ModelMetadata = {
        type: 'vl_jepa',
        architecture: 'transformer',
        framework: 'pytorch',
        inputShape: [3, 224, 224],
        outputShape: [768],
        parameters: 1000000,
        size: 4.0,
        dataset: 'test',
        custom: {},
      };

      const model = await registry.registerModel('to-delete', 'desc', metadata);
      await registry.deleteModel(model.id);

      const retrieved = await registry.getModel(model.id);
      expect(retrieved).toBeUndefined();
    });

    it('should reject deletion of non-existent model', async () => {
      await expect(
        registry.deleteModel('non-existent')
      ).rejects.toThrow('Model not found');
    });
  });

  describe('addVersion', () => {
    let model: RegisteredModel;

    beforeEach(async () => {
      const metadata: ModelMetadata = {
        type: 'vl_jepa',
        architecture: 'transformer',
        framework: 'pytorch',
        inputShape: [3, 224, 224],
        outputShape: [768],
        parameters: 1000000,
        size: 4.0,
        dataset: 'test',
        custom: {},
      };

      model = await registry.registerModel('test', 'desc', metadata);
    });

    it('should add a version to a model', async () => {
      const version: ModelVersion = {
        version: '1.0.0',
        artifacts: [],
        metrics: {
          accuracy: { top1: 0.95, top5: 0.99, custom: {} },
          latency: { p50: 10, p95: 20, p99: 30, avg: 15 },
          memory: { modelSize: 100, runtime: 200, peak: 300 },
          throughput: { rps: 100 },
          quality: { custom: {} },
        },
        metadata: {
          trainingConfig: {
            algorithm: 'adam',
            hyperparameters: { lr: 0.001 },
            epochs: 10,
            batchSize: 32,
            learningRate: 0.001,
            optimizer: 'adam',
            lossFunction: 'mse',
            duration: 3600,
            hardware: 'gpu',
          },
          changelog: 'Initial version',
          benchmarks: [],
          custom: {},
        },
        created: Date.now(),
        createdBy: 'test-user',
        isProduction: false,
        isArchived: false,
      };

      const updated = await registry.addVersion(model.id, version);

      expect(updated.versions).toHaveLength(1);
      expect(updated.versions[0].version).toBe('1.0.0');
    });

    it('should validate semantic version', async () => {
      const invalidVersion: ModelVersion = {
        version: 'not-a-version',
        artifacts: [],
        metrics: {
          accuracy: { top1: 0.95, custom: {} },
          latency: { p50: 10, p95: 20, p99: 30, avg: 15 },
          memory: { modelSize: 100, runtime: 200, peak: 300 },
          throughput: { rps: 100 },
          quality: { custom: {} },
        },
        metadata: {
          trainingConfig: {
            algorithm: 'adam',
            hyperparameters: {},
            epochs: 10,
            batchSize: 32,
            learningRate: 0.001,
            optimizer: 'adam',
            lossFunction: 'mse',
            duration: 3600,
            hardware: 'gpu',
          },
          changelog: '',
          benchmarks: [],
          custom: {},
        },
        created: Date.now(),
        createdBy: 'test',
        isProduction: false,
        isArchived: false,
      };

      await expect(
        registry.addVersion(model.id, invalidVersion)
      ).rejects.toThrow('Invalid semantic version');
    });

    it('should reject duplicate versions', async () => {
      const version: ModelVersion = {
        version: '1.0.0',
        artifacts: [],
        metrics: {
          accuracy: { top1: 0.95, custom: {} },
          latency: { p50: 10, p95: 20, p99: 30, avg: 15 },
          memory: { modelSize: 100, runtime: 200, peak: 300 },
          throughput: { rps: 100 },
          quality: { custom: {} },
        },
        metadata: {
          trainingConfig: {
            algorithm: 'adam',
            hyperparameters: {},
            epochs: 10,
            batchSize: 32,
            learningRate: 0.001,
            optimizer: 'adam',
            lossFunction: 'mse',
            duration: 3600,
            hardware: 'gpu',
          },
          changelog: '',
          benchmarks: [],
          custom: {},
        },
        created: Date.now(),
        createdBy: 'test',
        isProduction: false,
        isArchived: false,
      };

      await registry.addVersion(model.id, version);

      await expect(
        registry.addVersion(model.id, { ...version, created: Date.now() })
      ).rejects.toThrow('already exists');
    });

    it('should sort versions by semantic version', async () => {
      const v1: ModelVersion = {
        version: '1.0.0',
        artifacts: [],
        metrics: {
          accuracy: { top1: 0.9, custom: {} },
          latency: { p50: 10, p95: 20, p99: 30, avg: 15 },
          memory: { modelSize: 100, runtime: 200, peak: 300 },
          throughput: { rps: 100 },
          quality: { custom: {} },
        },
        metadata: {
          trainingConfig: {
            algorithm: 'adam',
            hyperparameters: {},
            epochs: 10,
            batchSize: 32,
            learningRate: 0.001,
            optimizer: 'adam',
            lossFunction: 'mse',
            duration: 3600,
            hardware: 'gpu',
          },
          changelog: '',
          benchmarks: [],
          custom: {},
        },
        created: Date.now(),
        createdBy: 'test',
        isProduction: false,
        isArchived: false,
      };

      const v2: ModelVersion = {
        version: '2.0.0',
        artifacts: [],
        metrics: {
          accuracy: { top1: 0.95, custom: {} },
          latency: { p50: 10, p95: 20, p99: 30, avg: 15 },
          memory: { modelSize: 100, runtime: 200, peak: 300 },
          throughput: { rps: 100 },
          quality: { custom: {} },
        },
        metadata: {
          trainingConfig: {
            algorithm: 'adam',
            hyperparameters: {},
            epochs: 10,
            batchSize: 32,
            learningRate: 0.001,
            optimizer: 'adam',
            lossFunction: 'mse',
            duration: 3600,
            hardware: 'gpu',
          },
          changelog: '',
          benchmarks: [],
          custom: {},
        },
        created: Date.now(),
        createdBy: 'test',
        isProduction: false,
        isArchived: false,
      };

      const v3: ModelVersion = {
        version: '1.5.0',
        artifacts: [],
        metrics: {
          accuracy: { top1: 0.92, custom: {} },
          latency: { p50: 10, p95: 20, p99: 30, avg: 15 },
          memory: { modelSize: 100, runtime: 200, peak: 300 },
          throughput: { rps: 100 },
          quality: { custom: {} },
        },
        metadata: {
          trainingConfig: {
            algorithm: 'adam',
            hyperparameters: {},
            epochs: 10,
            batchSize: 32,
            learningRate: 0.001,
            optimizer: 'adam',
            lossFunction: 'mse',
            duration: 3600,
            hardware: 'gpu',
          },
          changelog: '',
          benchmarks: [],
          custom: {},
        },
        created: Date.now(),
        createdBy: 'test',
        isProduction: false,
        isArchived: false,
      };

      await registry.addVersion(model.id, v3);
      await registry.addVersion(model.id, v1);
      await registry.addVersion(model.id, v2);

      const updated = await registry.getModel(model.id);
      expect(updated?.versions.map(v => v.version)).toEqual(['1.0.0', '1.5.0', '2.0.0']);
    });
  });

  describe('getVersion', () => {
    it('should retrieve a specific version', async () => {
      const metadata: ModelMetadata = {
        type: 'vl_jepa',
        architecture: 'transformer',
        framework: 'pytorch',
        inputShape: [3, 224, 224],
        outputShape: [768],
        parameters: 1000000,
        size: 4.0,
        dataset: 'test',
        custom: {},
      };

      const model = await registry.registerModel('test', 'desc', metadata);

      const version: ModelVersion = {
        version: '1.0.0',
        artifacts: [],
        metrics: {
          accuracy: { top1: 0.95, custom: {} },
          latency: { p50: 10, p95: 20, p99: 30, avg: 15 },
          memory: { modelSize: 100, runtime: 200, peak: 300 },
          throughput: { rps: 100 },
          quality: { custom: {} },
        },
        metadata: {
          trainingConfig: {
            algorithm: 'adam',
            hyperparameters: {},
            epochs: 10,
            batchSize: 32,
            learningRate: 0.001,
            optimizer: 'adam',
            lossFunction: 'mse',
            duration: 3600,
            hardware: 'gpu',
          },
          changelog: '',
          benchmarks: [],
          custom: {},
        },
        created: Date.now(),
        createdBy: 'test',
        isProduction: false,
        isArchived: false,
      };

      await registry.addVersion(model.id, version);

      const retrieved = await registry.getVersion(model.id, '1.0.0');
      expect(retrieved?.version).toBe('1.0.0');
    });

    it('return undefined for non-existent version', async () => {
      const metadata: ModelMetadata = {
        type: 'vl_jepa',
        architecture: 'transformer',
        framework: 'pytorch',
        inputShape: [3, 224, 224],
        outputShape: [768],
        parameters: 1000000,
        size: 4.0,
        dataset: 'test',
        custom: {},
      };

      const model = await registry.registerModel('test', 'desc', metadata);

      const retrieved = await registry.getVersion(model.id, '1.0.0');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getLatestVersion', () => {
    it('should return the latest version', async () => {
      const metadata: ModelMetadata = {
        type: 'vl_jepa',
        architecture: 'transformer',
        framework: 'pytorch',
        inputShape: [3, 224, 224],
        outputShape: [768],
        parameters: 1000000,
        size: 4.0,
        dataset: 'test',
        custom: {},
      };

      const model = await registry.registerModel('test', 'desc', metadata);

      const createVersion = (version: string): ModelVersion => ({
        version,
        artifacts: [],
        metrics: {
          accuracy: { top1: 0.95, custom: {} },
          latency: { p50: 10, p95: 20, p99: 30, avg: 15 },
          memory: { modelSize: 100, runtime: 200, peak: 300 },
          throughput: { rps: 100 },
          quality: { custom: {} },
        },
        metadata: {
          trainingConfig: {
            algorithm: 'adam',
            hyperparameters: {},
            epochs: 10,
            batchSize: 32,
            learningRate: 0.001,
            optimizer: 'adam',
            lossFunction: 'mse',
            duration: 3600,
            hardware: 'gpu',
          },
          changelog: '',
          benchmarks: [],
          custom: {},
        },
        created: Date.now(),
        createdBy: 'test',
        isProduction: false,
        isArchived: false,
      });

      await registry.addVersion(model.id, createVersion('1.0.0'));
      await registry.addVersion(model.id, createVersion('1.5.0'));
      await registry.addVersion(model.id, createVersion('2.0.0'));

      const latest = await registry.getLatestVersion(model.id);
      expect(latest?.version).toBe('2.0.0');
    });

    it('should return undefined for model with no versions', async () => {
      const metadata: ModelMetadata = {
        type: 'vl_jepa',
        architecture: 'transformer',
        framework: 'pytorch',
        inputShape: [3, 224, 224],
        outputShape: [768],
        parameters: 1000000,
        size: 4.0,
        dataset: 'test',
        custom: {},
      };

      const model = await registry.registerModel('test', 'desc', metadata);

      const latest = await registry.getLatestVersion(model.id);
      expect(latest).toBeUndefined();
    });
  });

  describe('getProductionVersion', () => {
    it('should return the production version', async () => {
      const metadata: ModelMetadata = {
        type: 'vl_jepa',
        architecture: 'transformer',
        framework: 'pytorch',
        inputShape: [3, 224, 224],
        outputShape: [768],
        parameters: 1000000,
        size: 4.0,
        dataset: 'test',
        custom: {},
      };

      const model = await registry.registerModel('test', 'desc', metadata);

      const version: ModelVersion = {
        version: '1.0.0',
        artifacts: [],
        metrics: {
          accuracy: { top1: 0.95, custom: {} },
          latency: { p50: 10, p95: 20, p99: 30, avg: 15 },
          memory: { modelSize: 100, runtime: 200, peak: 300 },
          throughput: { rps: 100 },
          quality: { custom: {} },
        },
        metadata: {
          trainingConfig: {
            algorithm: 'adam',
            hyperparameters: {},
            epochs: 10,
            batchSize: 32,
            learningRate: 0.001,
            optimizer: 'adam',
            lossFunction: 'mse',
            duration: 3600,
            hardware: 'gpu',
          },
          changelog: '',
          benchmarks: [],
          custom: {},
        },
        created: Date.now(),
        createdBy: 'test',
        isProduction: true,
        isArchived: false,
      };

      await registry.addVersion(model.id, version);

      const production = await registry.getProductionVersion(model.id);
      expect(production?.version).toBe('1.0.0');
      expect(production?.isProduction).toBe(true);
    });
  });

  describe('setProductionVersion', () => {
    it('should set a version as production', async () => {
      const metadata: ModelMetadata = {
        type: 'vl_jepa',
        architecture: 'transformer',
        framework: 'pytorch',
        inputShape: [3, 224, 224],
        outputShape: [768],
        parameters: 1000000,
        size: 4.0,
        dataset: 'test',
        custom: {},
      };

      const model = await registry.registerModel('test', 'desc', metadata);

      const createVersion = (version: string): ModelVersion => ({
        version,
        artifacts: [],
        metrics: {
          accuracy: { top1: 0.95, custom: {} },
          latency: { p50: 10, p95: 20, p99: 30, avg: 15 },
          memory: { modelSize: 100, runtime: 200, peak: 300 },
          throughput: { rps: 100 },
          quality: { custom: {} },
        },
        metadata: {
          trainingConfig: {
            algorithm: 'adam',
            hyperparameters: {},
            epochs: 10,
            batchSize: 32,
            learningRate: 0.001,
            optimizer: 'adam',
            lossFunction: 'mse',
            duration: 3600,
            hardware: 'gpu',
          },
          changelog: '',
          benchmarks: [],
          custom: {},
        },
        created: Date.now(),
        createdBy: 'test',
        isProduction: false,
        isArchived: false,
      });

      await registry.addVersion(model.id, createVersion('1.0.0'));
      await registry.addVersion(model.id, createVersion('2.0.0'));

      await registry.setProductionVersion(model.id, '2.0.0');

      const updated = await registry.getModel(model.id);
      expect(updated?.versions.find(v => v.version === '1.0.0')?.isProduction).toBe(false);
      expect(updated?.versions.find(v => v.version === '2.0.0')?.isProduction).toBe(true);
    });

    it('should reject setting non-existent version as production', async () => {
      const metadata: ModelMetadata = {
        type: 'vl_jepa',
        architecture: 'transformer',
        framework: 'pytorch',
        inputShape: [3, 224, 224],
        outputShape: [768],
        parameters: 1000000,
        size: 4.0,
        dataset: 'test',
        custom: {},
      };

      const model = await registry.registerModel('test', 'desc', metadata);

      await expect(
        registry.setProductionVersion(model.id, '1.0.0')
      ).rejects.toThrow('not found');
    });
  });

  describe('deleteVersion', () => {
    it('should delete a version', async () => {
      const metadata: ModelMetadata = {
        type: 'vl_jepa',
        architecture: 'transformer',
        framework: 'pytorch',
        inputShape: [3, 224, 224],
        outputShape: [768],
        parameters: 1000000,
        size: 4.0,
        dataset: 'test',
        custom: {},
      };

      const model = await registry.registerModel('test', 'desc', metadata);

      const version: ModelVersion = {
        version: '1.0.0',
        artifacts: [],
        metrics: {
          accuracy: { top1: 0.95, custom: {} },
          latency: { p50: 10, p95: 20, p99: 30, avg: 15 },
          memory: { modelSize: 100, runtime: 200, peak: 300 },
          throughput: { rps: 100 },
          quality: { custom: {} },
        },
        metadata: {
          trainingConfig: {
            algorithm: 'adam',
            hyperparameters: {},
            epochs: 10,
            batchSize: 32,
            learningRate: 0.001,
            optimizer: 'adam',
            lossFunction: 'mse',
            duration: 3600,
            hardware: 'gpu',
          },
          changelog: '',
          benchmarks: [],
          custom: {},
        },
        created: Date.now(),
        createdBy: 'test',
        isProduction: false,
        isArchived: false,
      };

      await registry.addVersion(model.id, version);
      await registry.deleteVersion(model.id, '1.0.0');

      const retrieved = await registry.getModel(model.id);
      expect(retrieved?.versions).toHaveLength(0);
    });

    it('should reject deleting non-existent version', async () => {
      const metadata: ModelMetadata = {
        type: 'vl_jepa',
        architecture: 'transformer',
        framework: 'pytorch',
        inputShape: [3, 224, 224],
        outputShape: [768],
        parameters: 1000000,
        size: 4.0,
        dataset: 'test',
        custom: {},
      };

      const model = await registry.registerModel('test', 'desc', metadata);

      await expect(
        registry.deleteVersion(model.id, '1.0.0')
      ).rejects.toThrow('not found');
    });
  });

  describe('searchModels', () => {
    beforeEach(async () => {
      const metadata: ModelMetadata = {
        type: 'vl_jepa',
        architecture: 'transformer',
        framework: 'pytorch',
        inputShape: [3, 224, 224],
        outputShape: [768],
        parameters: 1000000,
        size: 4.0,
        dataset: 'test',
        custom: {},
      };

      await registry.registerModel('search-test-model', 'A model for searching', metadata, ['searchable', 'test']);
      await registry.registerModel('another-model', 'Another description', metadata);
    });

    it('should search by model name', async () => {
      const result = await registry.searchModels('search-test');

      expect(result.total).toBe(1);
      expect(result.items[0].name).toBe('search-test-model');
    });

    it('should search by description', async () => {
      const result = await registry.searchModels('searching');

      expect(result.total).toBe(1);
    });

    it('should search by tags', async () => {
      const result = await registry.searchModels('searchable');

      expect(result.total).toBe(1);
    });

    it('should be case insensitive', async () => {
      const result = await registry.searchModels('SEARCH-TEST');

      expect(result.total).toBe(1);
    });

    it('should return empty for no matches', async () => {
      const result = await registry.searchModels('non-existent');

      expect(result.total).toBe(0);
    });
  });

  describe('getStatistics', () => {
    beforeEach(async () => {
      const metadata: ModelMetadata = {
        type: 'vl_jepa',
        architecture: 'transformer',
        framework: 'pytorch',
        inputShape: [3, 224, 224],
        outputShape: [768],
        parameters: 1000000,
        size: 4.0,
        dataset: 'test',
        custom: {},
      };

      await registry.registerModel('model1', 'desc', metadata);
      await registry.registerModel('model2', 'desc', metadata);
    });

    it('should return registry statistics', async () => {
      const stats = await registry.getStatistics();

      expect(stats.totalModels).toBe(2);
      expect(stats.totalVersions).toBe(0);
      expect(stats.modelsByStage.development).toBe(2);
      expect(stats.modelsByType.vl_jepa).toBe(2);
    });
  });

  describe('getRecentActivity', () => {
    it('should return recent activity entries', async () => {
      const metadata: ModelMetadata = {
        type: 'vl_jepa',
        architecture: 'transformer',
        framework: 'pytorch',
        inputShape: [3, 224, 224],
        outputShape: [768],
        parameters: 1000000,
        size: 4.0,
        dataset: 'test',
        custom: {},
      };

      await registry.registerModel('test', 'desc', metadata);

      const activity = registry.getRecentActivity(10);

      expect(activity.length).toBeGreaterThan(0);
      expect(activity[0].type).toBe('model_created');
    });

    it('should limit returned activity', async () => {
      const metadata: ModelMetadata = {
        type: 'vl_jepa',
        architecture: 'transformer',
        framework: 'pytorch',
        inputShape: [3, 224, 224],
        outputShape: [768],
        parameters: 1000000,
        size: 4.0,
        dataset: 'test',
        custom: {},
      };

      await registry.registerModel('model1', 'desc', metadata);
      await registry.registerModel('model2', 'desc', metadata);
      await registry.registerModel('model3', 'desc', metadata);

      const activity = registry.getRecentActivity(2);

      expect(activity.length).toBe(2);
    });
  });
});

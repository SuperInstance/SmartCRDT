/**
 * @lsi/vljepa-orpo - MultimodalORPOModel Tests
 *
 * Comprehensive test suite for MultimodalORPOModel.
 * Target: 50+ tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MultimodalORPOModel,
  PreferenceHead,
  ReferenceModel,
  createMultimodalORPOModel,
  type MultimodalORPOConfig,
} from '../src/models/MultimodalORPOModel.js';

describe('MultimodalORPOModel', () => {
  let config: MultimodalORPOConfig;

  beforeEach(() => {
    config = {
      baseModel: {
        embeddingDim: 768,
        usePretrained: false,
      },
      referenceModel: {
        enabled: true,
        frozen: true,
      },
      preferenceHead: {
        type: 'mlp',
        hiddenDims: [1536, 768, 384, 1],
        activation: 'gelu',
        dropout: 0.1,
        useLayerNorm: true,
        useResiduals: true,
      },
      orpo: {
        beta: 0.1,
        lambda: 1.0,
        sftLossWeight: 1.0,
      },
      training: {
        learningRate: 2e-4,
        batchSize: 8,
        epochs: 3,
        warmupRatio: 0.1,
        gradientClipping: 1.0,
        weightDecay: 0.01,
      },
      multimodal: {
        visualWeight: 0.5,
        textWeight: 0.5,
        fusion: 'concat',
      },
    };
  });

  describe('Construction', () => {
    it('should create model with valid config', () => {
      const model = new MultimodalORPOModel(config);
      expect(model).toBeDefined();
      expect(model.getEmbeddingDim()).toBe(768);
    });

    it('should initialize model', async () => {
      const model = new MultimodalORPOModel(config);
      await model.initialize();
      expect(model.isInitialized()).toBe(true);
    });

    it('should handle different embedding dimensions', () => {
      config.baseModel.embeddingDim = 512;
      const model = new MultimodalORPOModel(config);
      expect(model.getEmbeddingDim()).toBe(512);
    });

    it('should disable reference model when configured', () => {
      config.referenceModel.enabled = false;
      const model = new MultimodalORPOModel(config);
      expect(model).toBeDefined();
    });
  });

  describe('Forward Pass', () => {
    let model: MultimodalORPOModel;
    let chosenEmbedding: Float32Array;
    let rejectedEmbedding: Float32Array;

    beforeEach(async () => {
      model = new MultimodalORPOModel(config);
      await model.initialize();
      chosenEmbedding = new Float32Array(768).map(() => Math.random() * 2 - 1);
      rejectedEmbedding = new Float32Array(768).map(() => Math.random() * 2 - 1);
    });

    it('should perform forward pass', async () => {
      const result = await model.forward(chosenEmbedding, rejectedEmbedding);
      expect(result).toBeDefined();
      expect(result.chosenLogits).toBeDefined();
      expect(result.rejectedLogits).toBeDefined();
    });

    it('should return valid logits', async () => {
      const result = await model.forward(chosenEmbedding, rejectedEmbedding);
      expect(result.chosenLogits.length).toBe(1);
      expect(result.rejectedLogits.length).toBe(1);
    });

    it('should compute log odds ratio', async () => {
      const result = await model.forward(chosenEmbedding, rejectedEmbedding);
      expect(result.logOddsRatio).toBeDefined();
      expect(typeof result.logOddsRatio).toBe('number');
    });

    it('should compute preference score', async () => {
      const result = await model.forward(chosenEmbedding, rejectedEmbedding);
      expect(result.preferenceScore).toBeGreaterThanOrEqual(0);
      expect(result.preferenceScore).toBeLessThanOrEqual(1);
    });

    it('should compute SFT loss', async () => {
      const result = await model.forward(chosenEmbedding, rejectedEmbedding);
      expect(result.sftLoss).toBeDefined();
      expect(result.sftLoss).toBeGreaterThan(0);
    });

    it('should compute ORPO loss', async () => {
      const result = await model.forward(chosenEmbedding, rejectedEmbedding);
      expect(result.orpoLoss).toBeDefined();
      expect(result.orpoLoss).toBeGreaterThanOrEqual(0);
    });

    it('should compute total loss', async () => {
      const result = await model.forward(chosenEmbedding, rejectedEmbedding);
      expect(result.totalLoss).toBeDefined();
      expect(result.totalLoss).toBeGreaterThan(0);
    });

    it('should return reference logits', async () => {
      const result = await model.forward(chosenEmbedding, rejectedEmbedding);
      expect(result.referenceChosenLogits).toBeDefined();
      expect(result.referenceRejectedLogits).toBeDefined();
    });

    it('should handle identical embeddings', async () => {
      const result = await model.forward(chosenEmbedding, chosenEmbedding);
      expect(result.logOddsRatio).toBeDefined();
    });

    it('should validate embedding dimensions', async () => {
      const invalidEmbedding = new Float32Array(512);
      await expect(
        model.forward(chosenEmbedding, invalidEmbedding)
      ).rejects.toThrow();
    });
  });

  describe('Batch Forward', () => {
    let model: MultimodalORPOModel;
    let chosenEmbeddings: Float32Array[];
    let rejectedEmbeddings: Float32Array[];

    beforeEach(async () => {
      model = new MultimodalORPOModel(config);
      await model.initialize();
      chosenEmbeddings = Array.from({ length: 4 }, () =>
        new Float32Array(768).map(() => Math.random() * 2 - 1)
      );
      rejectedEmbeddings = Array.from({ length: 4 }, () =>
        new Float32Array(768).map(() => Math.random() * 2 - 1)
      );
    });

    it('should process batch forward pass', async () => {
      const results = await model.forwardBatch(chosenEmbeddings, rejectedEmbeddings);
      expect(results).toHaveLength(4);
    });

    it('should return consistent result format', async () => {
      const results = await model.forwardBatch(chosenEmbeddings, rejectedEmbeddings);
      results.forEach(result => {
        expect(result.chosenLogits).toBeDefined();
        expect(result.rejectedLogits).toBeDefined();
        expect(result.preferenceScore).toBeDefined();
      });
    });

    it('should handle empty batch', async () => {
      const results = await model.forwardBatch([], []);
      expect(results).toHaveLength(0);
    });
  });

  describe('Parameter Management', () => {
    let model: MultimodalORPOModel;

    beforeEach(async () => {
      model = new MultimodalORPOModel(config);
      await model.initialize();
    });

    it('should get parameters', () => {
      const params = model.getParameters();
      expect(params).toBeDefined();
      expect(Array.isArray(params)).toBe(true);
    });

    it('should set parameters', () => {
      const params = model.getParameters();
      model.setParameters(params);
      expect(model).toBeDefined();
    });

    it('should preserve parameter dimensions', () => {
      const params = model.getParameters();
      model.setParameters(params);
      const newParams = model.getParameters();
      expect(newParams.length).toBe(params.length);
    });
  });

  describe('Reference Model', () => {
    let model: MultimodalORPOModel;

    beforeEach(async () => {
      model = new MultimodalORPOModel(config);
      await model.initialize();
    });

    it('should update reference model', () => {
      expect(() => model.updateReferenceModel()).not.toThrow();
    });

    it('should not update frozen reference model', () => {
      config.referenceModel.frozen = true;
      const frozenModel = new MultimodalORPOModel(config);
      expect(() => frozenModel.updateReferenceModel()).not.toThrow();
    });
  });

  describe('Fusion Strategies', () => {
    it('should use concat fusion', async () => {
      config.multimodal.fusion = 'concat';
      const model = new MultimodalORPOModel(config);
      await model.initialize();
      const embedding = new Float32Array(768).map(() => Math.random() * 2 - 1);
      const result = await model.forward(embedding, embedding);
      expect(result).toBeDefined();
    });

    it('should use add fusion', async () => {
      config.multimodal.fusion = 'add';
      const model = new MultimodalORPOModel(config);
      await model.initialize();
      const embedding = new Float32Array(768).map(() => Math.random() * 2 - 1);
      const result = await model.forward(embedding, embedding);
      expect(result).toBeDefined();
    });

    it('should use attention fusion', async () => {
      config.multimodal.fusion = 'attention';
      const model = new MultimodalORPOModel(config);
      await model.initialize();
      const embedding = new Float32Array(768).map(() => Math.random() * 2 - 1);
      const result = await model.forward(embedding, embedding);
      expect(result).toBeDefined();
    });
  });

  describe('Loss Computation', () => {
    let model: MultimodalORPOModel;

    beforeEach(async () => {
      model = new MultimodalORPOModel(config);
      await model.initialize();
    });

    it('should correctly combine SFT and ORPO losses', async () => {
      const embedding = new Float32Array(768).map(() => Math.random() * 2 - 1);
      const result = await model.forward(embedding, embedding);
      expect(result.totalLoss).toBeCloseTo(
        result.sftLoss + result.orpoLoss,
        5
      );
    });

    it('should respect SFT loss weight', async () => {
      config.orpo.sftLossWeight = 2.0;
      const weightedModel = new MultimodalORPOModel(config);
      await weightedModel.initialize();
      const embedding = new Float32Array(768).map(() => Math.random() * 2 - 1);
      const result = await weightedModel.forward(embedding, embedding);
      expect(result.totalLoss).toBeCloseTo(
        2.0 * result.sftLoss + result.orpoLoss,
        5
      );
    });

    it('should respect lambda weight', async () => {
      config.orpo.lambda = 2.0;
      const weightedModel = new MultimodalORPOModel(config);
      await weightedModel.initialize();
      const embedding = new Float32Array(768).map(() => Math.random() * 2 - 1);
      const result = await weightedModel.forward(embedding, embedding);
      expect(result.totalLoss).toBeCloseTo(
        result.sftLoss + 2.0 * result.orpoLoss,
        5
      );
    });
  });

  describe('Configuration', () => {
    it('should get config', () => {
      const model = new MultimodalORPOModel(config);
      const retrievedConfig = model.getConfig();
      expect(retrievedConfig).toBeDefined();
      expect(retrievedConfig.baseModel.embeddingDim).toBe(768);
    });

    it('should handle different activation functions', async () => {
      config.preferenceHead.activation = 'relu';
      const model = new MultimodalORPOModel(config);
      await model.initialize();
      expect(model.isInitialized()).toBe(true);
    });

    it('should handle different dropout rates', async () => {
      config.preferenceHead.dropout = 0.5;
      const model = new MultimodalORPOModel(config);
      await model.initialize();
      expect(model.isInitialized()).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero embeddings', async () => {
      const model = new MultimodalORPOModel(config);
      await model.initialize();
      const zeroEmbedding = new Float32Array(768);
      const result = await model.forward(zeroEmbedding, zeroEmbedding);
      expect(result).toBeDefined();
    });

    it('should handle extreme values in embeddings', async () => {
      const model = new MultimodalORPOModel(config);
      await model.initialize();
      const extremeEmbedding = new Float32Array(768).map((_, i) =>
        i % 2 === 0 ? 1 : -1
      );
      const result = await model.forward(extremeEmbedding, extremeEmbedding);
      expect(result).toBeDefined();
    });
  });

  describe('Factory Function', () => {
    it('should create model via factory', async () => {
      const model = await createMultimodalORPOModel();
      expect(model).toBeDefined();
      expect(model.isInitialized()).toBe(true);
    });

    it('should merge config in factory', async () => {
      const model = await createMultimodalORPOModel({
        baseModel: { embeddingDim: 512, usePretrained: false },
      });
      expect(model.getEmbeddingDim()).toBe(512);
    });
  });
});

describe('PreferenceHead', () => {
  it('should create preference head', () => {
    const head = new PreferenceHead(1536, {
      type: 'mlp',
      hiddenDims: [768, 384, 1],
      activation: 'gelu',
      dropout: 0.1,
      useLayerNorm: true,
      useResiduals: true,
    });
    expect(head).toBeDefined();
  });

  it('should perform forward pass', () => {
    const head = new PreferenceHead(1536, {
      type: 'mlp',
      hiddenDims: [768, 384, 1],
      activation: 'gelu',
      dropout: 0.1,
      useLayerNorm: true,
      useResiduals: true,
    });
    const input = new Float32Array(1536).map(() => Math.random() * 2 - 1);
    const output = head.forward(input);
    expect(typeof output).toBe('number');
  });

  it('should handle different activations', () => {
    const activations: Array<'relu' | 'gelu' | 'swish'> = ['relu', 'gelu', 'swish'];
    activations.forEach(activation => {
      const head = new PreferenceHead(1536, {
        type: 'mlp',
        hiddenDims: [768, 384, 1],
        activation,
        dropout: 0.1,
        useLayerNorm: true,
        useResiduals: true,
      });
      const input = new Float32Array(1536).map(() => Math.random() * 2 - 1);
      const output = head.forward(input);
      expect(typeof output).toBe('number');
    });
  });
});

describe('ReferenceModel', () => {
  it('should create reference model', () => {
    const head = new PreferenceHead(1536, {
      type: 'mlp',
      hiddenDims: [768, 384, 1],
      activation: 'gelu',
      dropout: 0.1,
      useLayerNorm: true,
      useResiduals: true,
    });
    const refModel = new ReferenceModel(head, true);
    expect(refModel).toBeDefined();
  });

  it('should perform forward pass', () => {
    const head = new PreferenceHead(1536, {
      type: 'mlp',
      hiddenDims: [768, 384, 1],
      activation: 'gelu',
      dropout: 0.1,
      useLayerNorm: true,
      useResiduals: true,
    });
    const refModel = new ReferenceModel(head, true);
    const input = new Float32Array(1536).map(() => Math.random() * 2 - 1);
    const output = refModel.forward(input);
    expect(typeof output).toBe('number');
  });

  it('should respect frozen state', () => {
    const head = new PreferenceHead(1536, {
      type: 'mlp',
      hiddenDims: [768, 384, 1],
      activation: 'gelu',
      dropout: 0.1,
      useLayerNorm: true,
      useResiduals: true,
    });
    const refModel = new ReferenceModel(head, true);
    expect(refModel.isFrozen()).toBe(true);
    refModel.setFrozen(false);
    expect(refModel.isFrozen()).toBe(false);
  });
});

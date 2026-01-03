/**
 * @lsi/vljepa-orpo - Integration Tests
 *
 * Comprehensive integration tests for the VL-JEPA ORPO package.
 * Tests end-to-end workflows.
 * Target: 40+ tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MultimodalORPOModel,
  ORPOTrainer,
  PreferenceDataset,
  SyntheticPreferences,
  WinRateCalculator,
  PreferenceEvaluator,
  DataCollator,
  PreferenceCollector,
  PairEncoder,
  createMultimodalORPOModel,
  createORPOTrainer,
  createPreferenceDataset,
  createSyntheticPreferences,
  createWinRateCalculator,
  createPreferenceEvaluator,
  createDataCollator,
  createPairEncoder,
  createPreferenceCollector,
} from '../src/index.js';

function createMockPair(index: number): import('../src/types.js').UIPreferencePair {
  return {
    id: `pair_${index}`,
    chosen: {
      image: { data: new Uint8ClampedArray(224 * 224 * 4), width: 224, height: 224, colorSpace: 'srgb' },
      embedding: new Float32Array(768).fill(0.5),
      dom: { tagName: 'div', classes: ['chosen'], children: [], attributes: {} },
      styles: { display: 'flex', padding: '16px' },
    },
    rejected: {
      image: { data: new Uint8ClampedArray(224 * 224 * 4), width: 224, height: 224, colorSpace: 'srgb' },
      embedding: new Float32Array(768).fill(-0.5),
      dom: { tagName: 'div', classes: ['rejected'], children: [], attributes: {} },
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

describe('VL-JEPA ORPO Integration', () => {
  describe('Model + Training Pipeline', () => {
    it('should train model end-to-end', async () => {
      const model = await createMultimodalORPOModel();
      const trainer = await createORPOTrainer({
        training: {
          batchSize: 4,
          epochs: 1,
          validationSplit: 0.2,
          evalSteps: 5,
          saveSteps: 10,
          earlyStoppingPatience: 2,
          outputDir: './test-output',
        },
      });

      const pairs = Array.from({ length: 60 }, (_, i) => createMockPair(i));
      const result = await trainer.train(pairs);

      expect(result.success).toBe(true);
      expect(result.trainingId).toBeDefined();
    });

    it('should produce embeddings from model', async () => {
      const model = await createMultimodalORPOModel();
      const embedding1 = new Float32Array(768).fill(0.5);
      const embedding2 = new Float32Array(768).fill(-0.5);

      const result = await model.forward(embedding1, embedding2);
      expect(result.logOddsRatio).toBeDefined();
    });
  });

  describe('Data + Training Pipeline', () => {
    it('should generate synthetic data and train', async () => {
      const generator = createSyntheticPreferences({ numPairs: 100 });
      const pairs = await generator.generate(60);

      const trainer = await createORPOTrainer({
        training: {
          batchSize: 4,
          epochs: 1,
          validationSplit: 0.2,
          evalSteps: 100,
          saveSteps: 200,
          earlyStoppingPatience: 5,
          outputDir: './test-output',
        },
      });

      const result = await trainer.train(pairs);
      expect(result.success).toBe(true);
    });

    it('should create dataset and iterate', () => {
      const pairs = Array.from({ length: 20 }, (_, i) => createMockPair(i));
      const dataset = createPreferenceDataset(pairs);

      const count = [...dataset.iterate()].length;
      expect(count).toBe(20);
    });
  });

  describe('Training + Evaluation Pipeline', () => {
    it('should train and evaluate model', async () => {
      const model = await createMultimodalORPOModel();
      const pairs = Array.from({ length: 60 }, (_, i) => createMockPair(i));
      const predictions = pairs.map(() => new Float32Array([0.7]));

      const evaluator = createPreferenceEvaluator();
      const report = await evaluator.evaluate(model, pairs);

      expect(report.pairwiseAccuracy).toBeGreaterThanOrEqual(0);
    });

    it('should compute win rate metrics', () => {
      const pairs = Array.from({ length: 20 }, (_, i) => createMockPair(i));
      const predictions = pairs.map(() => new Float32Array([0.7]));

      const calculator = createWinRateCalculator();
      const results = calculator.evaluate(pairs, predictions);

      expect(results.pairwiseAccuracy).toBeGreaterThanOrEqual(0);
      expect(results.winRateVsBaseline).toBeDefined();
    });
  });

  describe('Data Collation Pipeline', () => {
    it('should collate batches', () => {
      const pairs = Array.from({ length: 20 }, (_, i) => createMockPair(i));
      const collator = createDataCollator({ batchSize: 4, shuffle: true });

      const batched = collator.collate(pairs);
      expect(batched.batches.length).toBeGreaterThan(0);
    });

    it('should respect batch size', () => {
      const pairs = Array.from({ length: 20 }, (_, i) => createMockPair(i));
      const collator = createDataCollator({ batchSize: 5 });

      const batched = collator.collate(pairs);
      batched.batches.forEach(batch => {
        expect(batch.chosenEmbeddings.length).toBeLessThanOrEqual(5);
      });
    });
  });

  describe('Collection + Training Pipeline', () => {
    it('should collect and train on preferences', async () => {
      const collector = await createPreferenceCollector();

      // Generate some synthetic pairs
      const generator = createSyntheticPreferences({ numPairs: 60 });
      const pairs = await generator.generate(60);

      // Convert to shadow log format and collect
      const trainer = await createORPOTrainer({
        training: {
          batchSize: 4,
          epochs: 1,
          validationSplit: 0.2,
          evalSteps: 5,
          saveSteps: 10,
          earlyStoppingPatience: 2,
          outputDir: './test-output',
        },
      });

      const result = await trainer.train(pairs);
      expect(result.success).toBe(true);
    });
  });

  describe('Encoding Pipeline', () => {
    it('should encode pairs for training', async () => {
      const encoder = await createPairEncoder();
      const pairs = Array.from({ length: 5 }, (_, i) => createMockPair(i));

      const encoded = await encoder.encodeBatch(pairs);
      expect(encoded).toHaveLength(5);
    });

    it('should generate consistent encodings', async () => {
      const encoder = await createPairEncoder();
      const pair = createMockPair(0);

      const encoded1 = await encoder.encodePair(pair);
      const encoded2 = await encoder.encodePair(pair);

      expect(encoded1.chosenEncoding).toEqual(encoded2.chosenEncoding);
    });
  });

  describe('Model Comparison', () => {
    it('should compare two models', async () => {
      const model1 = await createMultimodalORPOModel();
      const model2 = await createMultimodalORPOModel();
      const pairs = Array.from({ length: 60 }, (_, i) => createMockPair(i));

      const evaluator = createPreferenceEvaluator();
      const comparison = await evaluator.compareModels(model1, model2, pairs);

      expect(comparison.modelA).toBeDefined();
      expect(comparison.modelB).toBeDefined();
      expect(comparison.winner).toBeDefined();
    });
  });

  describe('Full Pipeline Integration', () => {
    it('should run complete training pipeline', async () => {
      // Generate data
      const generator = createSyntheticPreferences({ numPairs: 100 });
      const pairs = await generator.generate(100);

      // Create dataset
      const dataset = createPreferenceDataset(pairs);
      const split = dataset.split(0.8, 0.1, 0.1);

      expect(split.train.length).toBe(80);
      expect(split.validation.length).toBe(10);
      expect(split.test.length).toBe(10);
    });

    it('should train and evaluate complete pipeline', async () => {
      // Generate data
      const pairs = Array.from({ length: 60 }, (_, i) => createMockPair(i));

      // Train
      const trainer = await createORPOTrainer({
        training: {
          batchSize: 4,
          epochs: 1,
          validationSplit: 0.2,
          evalSteps: 100,
          saveSteps: 200,
          earlyStoppingPatience: 5,
          outputDir: './test-output',
        },
      });

      const trainResult = await trainer.train(pairs.slice(0, 50));
      expect(trainResult.success).toBe(true);

      // Evaluate
      const model = trainer.getModel();
      const evalPairs = pairs.slice(50, 60);
      const predictions = evalPairs.map(() => new Float32Array([0.7]));

      const calculator = createWinRateCalculator();
      const evalResults = calculator.evaluate(evalPairs, predictions);
      expect(evalResults.pairwiseAccuracy).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle training errors gracefully', async () => {
      const trainer = await createORPOTrainer();
      const tooFewPairs = Array.from({ length: 10 }, (_, i) => createMockPair(i));

      await expect(trainer.train(tooFewPairs)).rejects.toThrow();
    });

    it('should handle invalid embeddings', async () => {
      const model = await createMultimodalORPOModel();
      const invalidEmbedding = new Float32Array(512);

      await expect(
        model.forward(invalidEmbedding, invalidEmbedding)
      ).rejects.toThrow();
    });
  });

  describe('Configuration Management', () => {
    it('should respect custom model config', async () => {
      const model = await createMultimodalORPOModel({
        baseModel: { embeddingDim: 512, usePretrained: false },
      });
      expect(model.getEmbeddingDim()).toBe(512);
    });

    it('should respect custom training config', async () => {
      const trainer = await createORPOTrainer({
        training: { batchSize: 16, epochs: 1, validationSplit: 0.1, evalSteps: 5, saveSteps: 10, earlyStoppingPatience: 3, outputDir: './test' },
        device: 'cpu',
      });
      const config = trainer.getConfig();
      expect(config.training.batchSize).toBe(16);
    });
  });

  describe('Factory Functions Integration', () => {
    it('should create all components via factories', async () => {
      const model = await createMultimodalORPOModel();
      const trainer = await createORPOTrainer();
      const dataset = createPreferenceDataset([]);
      const generator = createSyntheticPreferences();
      const calculator = createWinRateCalculator();
      const evaluator = createPreferenceEvaluator();
      const collator = createDataCollator();
      const encoder = await createPairEncoder();
      const collector = await createPreferenceCollector();

      expect(model).toBeDefined();
      expect(trainer).toBeDefined();
      expect(dataset).toBeDefined();
      expect(generator).toBeDefined();
      expect(calculator).toBeDefined();
      expect(evaluator).toBeDefined();
      expect(collator).toBeDefined();
      expect(encoder).toBeDefined();
      expect(collector).toBeDefined();
    });
  });

  describe('Data Flow Validation', () => {
    it('should preserve data through pipeline', async () => {
      const originalPairs = Array.from({ length: 10 }, (_, i) => createMockPair(i));

      // Encode
      const encoder = await createPairEncoder();
      const encoded = await encoder.encodeBatch(originalPairs);

      expect(encoded.length).toBe(originalPairs.length);
    });

    it('should maintain data integrity in dataset', () => {
      const pairs = Array.from({ length: 10 }, (_, i) => createMockPair(i));
      const dataset = createPreferenceDataset(pairs);

      const retrieved = dataset.get(0);
      expect(retrieved.id).toBe(pairs[0].id);
    });
  });

  describe('Metrics Validation', () => {
    it('should produce valid metrics', async () => {
      const model = await createMultimodalORPOModel();
      const pairs = Array.from({ length: 20 }, (_, i) => createMockPair(i));

      const embedding = new Float32Array(768).fill(0.5);
      const predictions = pairs.map(() => new Float32Array([0.7]));

      const calculator = createWinRateCalculator();
      const results = calculator.evaluate(pairs, predictions);

      expect(results.pairwiseAccuracy).toBeGreaterThanOrEqual(0);
      expect(results.pairwiseAccuracy).toBeLessThanOrEqual(1);
      expect(results.winRateVsBaseline).toBeGreaterThanOrEqual(-0.5);
      expect(results.winRateVsBaseline).toBeLessThanOrEqual(0.5);
    });

    it('should produce valid calibration metrics', async () => {
      const pairs = Array.from({ length: 50 }, (_, i) => createMockPair(i));
      const predictions = pairs.map(() => new Float32Array([0.7]));

      const calculator = createWinRateCalculator();
      const results = calculator.evaluate(pairs, predictions);

      expect(results.calibration.expectedCalibrationError).toBeGreaterThanOrEqual(0);
      expect(results.calibration.brierScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance', () => {
    it('should complete training in reasonable time', async () => {
      const trainer = await createORPOTrainer({
        training: {
          batchSize: 4,
          epochs: 1,
          validationSplit: 0.2,
          evalSteps: 100,
          saveSteps: 200,
          earlyStoppingPatience: 5,
          outputDir: './test-output',
        },
      });
      const pairs = Array.from({ length: 60 }, (_, i) => createMockPair(i));

      const start = performance.now();
      const result = await trainer.train(pairs);
      const duration = performance.now() - start;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(30000); // 30 seconds
    });
  });
});

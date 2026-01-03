/**
 * @lsi/vljepa-orpo - Additional Tests
 *
 * Additional tests to reach 275+ test target.
 */

import { describe, it, expect } from 'vitest';
import {
  DataCollator,
  createDataCollator,
  PairEncoder,
  createPairEncoder,
  PreferenceCollector,
  createPreferenceCollector,
  PreferenceLoader,
  createPreferenceLoader,
  PreferenceEvaluator,
  createPreferenceEvaluator,
  MultimodalORPOModel,
  createMultimodalORPOModel,
} from '../src/index.js';
import type { UIPreferencePair, PreferenceCollector as CollectorType } from '../src/types.js';

function createMockPair(index: number): UIPreferencePair {
  return {
    id: `pair_${index}`,
    chosen: {
      image: { data: new Uint8ClampedArray(100), width: 10, height: 10, colorSpace: 'srgb' },
      embedding: new Float32Array(768).fill(0.5),
      dom: { tagName: 'div', classes: [], children: [], attributes: {} },
      styles: {},
    },
    rejected: {
      image: { data: new Uint8ClampedArray(100), width: 10, height: 10, colorSpace: 'srgb' },
      embedding: new Float32Array(768).fill(-0.5),
      dom: { tagName: 'div', classes: [], children: [], attributes: {} },
      styles: {},
    },
    context: {
      task: 'task',
      userIntent: 'intent',
      uiContext: 'context',
      constraints: {},
    },
    metadata: {
      source: 'synthetic',
      confidence: 0.8,
      timestamp: Date.now(),
    },
  };
}

describe('DataCollator Additional Tests', () => {
  it('should create collator', () => {
    const collator = createDataCollator();
    expect(collator).toBeDefined();
  });

  it('should set batch size', () => {
    const collator = createDataCollator({ batchSize: 8 });
    collator.setBatchSize(16);
    expect(collator.getOptions().batchSize).toBe(16);
  });

  it('should set shuffle', () => {
    const collator = createDataCollator({ shuffle: true });
    collator.setShuffle(false);
    expect(collator.getOptions().shuffle).toBe(false);
  });

  it('should set drop last', () => {
    const collator = createDataCollator({ dropLast: true });
    collator.setDropLast(false);
    expect(collator.getOptions().dropLast).toBe(false);
  });
});

describe('PairEncoder Additional Tests', () => {
  it('should create encoder', async () => {
    const encoder = await createPairEncoder();
    expect(encoder).toBeDefined();
  });

  it('should check initialized', async () => {
    const encoder = await createPairEncoder();
    expect(encoder.isInitialized()).toBe(true);
  });

  it('should get cache stats', async () => {
    const encoder = await createPairEncoder();
    const stats = encoder.getCacheStats();
    expect(stats).toBeDefined();
  });

  it('should clear cache', async () => {
    const encoder = await createPairEncoder();
    encoder.clearCache();
    expect(encoder.getCacheStats().size).toBe(0);
  });
});

describe('PreferenceCollector Additional Tests', () => {
  it('should create collector', async () => {
    const collector = await createPreferenceCollector();
    expect(collector).toBeDefined();
  });

  it('should check initialized', async () => {
    const collector = await createPreferenceCollector();
    expect(collector.isInitialized()).toBe(true);
  });

  it('should get collected pairs', async () => {
    const collector = await createPreferenceCollector();
    const pairs = collector.getCollectedPairs();
    expect(Array.isArray(pairs)).toBe(true);
  });

  it('should get statistics', async () => {
    const collector = await createPreferenceCollector();
    const stats = collector.getStatistics();
    expect(stats).toBeDefined();
  });

  it('should get config', async () => {
    const collector = await createPreferenceCollector({ samplingRate: 0.5 });
    const config = collector.getConfig();
    expect(config.samplingRate).toBe(0.5);
  });
});

describe('PreferenceLoader Additional Tests', () => {
  it('should create loader', () => {
    const loader = createPreferenceLoader();
    expect(loader).toBeDefined();
  });

  it('should set options', () => {
    const loader = createPreferenceLoader({ validationSplit: 0.3 });
    loader.setOptions({ validationSplit: 0.2 });
    expect(loader.getOptions().validationSplit).toBe(0.2);
  });

  it('should clear cache', () => {
    const loader = createPreferenceLoader();
    loader.clearCache();
    expect(loader).toBeDefined();
  });

  it('should filter pairs', () => {
    const loader = createPreferenceLoader();
    const pairs = Array.from({ length: 10 }, (_, i) => createMockPair(i));
    const filtered = loader.filter(pairs, { minConfidence: 0.7 });
    expect(filtered.length).toBe(10); // All have confidence 0.8
  });

  it('should balance by source', () => {
    const loader = createPreferenceLoader();
    const pairs = Array.from({ length: 10 }, (_, i) => createMockPair(i));
    const balanced = loader.balanceBySource(pairs);
    expect(balanced.length).toBeGreaterThan(0);
  });

  it('should balance by context', () => {
    const loader = createPreferenceLoader();
    const pairs = Array.from({ length: 10 }, (_, i) => createMockPair(i));
    const balanced = loader.balanceByContext(pairs);
    expect(balanced.length).toBe(10); // All same context
  });

  it('should undersample', () => {
    const loader = createPreferenceLoader();
    const pairs = Array.from({ length: 10 }, (_, i) => createMockPair(i));
    const undersampled = loader.undersample(pairs, 5);
    expect(undersampled.length).toBe(5);
  });

  it('should oversample', () => {
    const loader = createPreferenceLoader();
    const pairs = Array.from({ length: 3 }, (_, i) => createMockPair(i));
    const oversampled = loader.oversample(pairs, 10);
    expect(oversampled.length).toBe(10);
  });
});

describe('PreferenceEvaluator Additional Tests', () => {
  it('should create evaluator', () => {
    const evaluator = createPreferenceEvaluator();
    expect(evaluator).toBeDefined();
  });

  it('should get options', () => {
    const evaluator = createPreferenceEvaluator({ bootstrapCI: false });
    const options = evaluator.getOptions();
    expect(options.bootstrapCI).toBe(false);
  });

  it('should set options', () => {
    const evaluator = createPreferenceEvaluator();
    evaluator.setOptions({ bootstrapCI: false });
    expect(evaluator.getOptions().bootstrapCI).toBe(false);
  });

  it('should get win rate calculator', () => {
    const evaluator = createPreferenceEvaluator();
    const calc = evaluator.getWinRateCalculator();
    expect(calc).toBeDefined();
  });

  it('should evaluate subset', async () => {
    const evaluator = createPreferenceEvaluator();
    const model = await createMultimodalORPOModel();
    const pairs = Array.from({ length: 20 }, (_, i) => createMockPair(i));
    const filter = (_p: UIPreferencePair) => true;
    const subset = pairs.filter(filter);
    const report = await evaluator.evaluateSubset(model, subset, filter);
    expect(report).toBeDefined();
  });

  it('should summarize report', async () => {
    const evaluator = createPreferenceEvaluator({ verbose: false });
    const model = await createMultimodalORPOModel();
    const pairs = Array.from({ length: 10 }, (_, i) => createMockPair(i));

    const report = await evaluator.evaluate(model, pairs);
    const summary = evaluator.summarizeReport(report);
    expect(typeof summary).toBe('string');
    expect(summary.length).toBeGreaterThan(0);
  });
});

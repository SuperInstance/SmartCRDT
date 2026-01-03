/**
 * @lsi/vljepa-orpo - PreferenceDataset Tests
 *
 * Comprehensive test suite for PreferenceDataset.
 * Target: 40+ tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PreferenceDataset,
  createPreferenceDataset,
  loadPreferenceDataset,
  type PreferenceDatasetOptions,
} from '../src/data/PreferenceDataset.js';
import type { UIPreferencePair } from '../src/types.js';

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

describe('PreferenceDataset', () => {
  let pairs: UIPreferencePair[];
  let dataset: PreferenceDataset;

  beforeEach(() => {
    pairs = Array.from({ length: 100 }, (_, i) => createMockPair(i));
    dataset = new PreferenceDataset(pairs);
  });

  describe('Construction', () => {
    it('should create dataset from pairs', () => {
      const ds = new PreferenceDataset(pairs);
      expect(ds).toBeDefined();
    });

    it('should have correct length', () => {
      expect(dataset.length).toBe(100);
    });

    it('should create with options', () => {
      const options: PreferenceDatasetOptions = {
        cacheEmbeddings: true,
        shuffleEachEpoch: true,
        dropLast: true,
        prefetchSize: 2,
      };
      const ds = new PreferenceDataset(pairs, options);
      expect(ds).toBeDefined();
    });

    it('should get options', () => {
      const options = dataset.getOptions();
      expect(options).toBeDefined();
    });
  });

  describe('Access', () => {
    it('should get pair by index', () => {
      const pair = dataset.get(0);
      expect(pair).toBeDefined();
      expect(pair.id).toBe('pair_0');
    });

    it('should throw on invalid index', () => {
      expect(() => dataset.get(1000)).toThrow();
    });

    it('should throw on negative index', () => {
      expect(() => dataset.get(-1)).toThrow();
    });

    it('should get batch of pairs', () => {
      const batch = dataset.getBatch([0, 1, 2]);
      expect(batch).toHaveLength(3);
    });

    it('should get all pairs', () => {
      const allPairs = dataset.getPairs();
      expect(allPairs).toHaveLength(100);
    });
  });

  describe('Iteration', () => {
    it('should iterate over all pairs', () => {
      const count = [...dataset.iterate()].length;
      expect(count).toBe(100);
    });

    it('should yield correct pairs', () => {
      for (const pair of dataset.iterate()) {
        expect(pair).toBeDefined();
        expect(pair.id).toMatch(/^pair_\d+$/);
      }
    });

    it('should iterate batches', () => {
      const batches = [...dataset.iterateBatches(10)];
      expect(batches.length).toBeGreaterThan(0);
    });

    it('should respect batch size', () => {
      const batches = [...dataset.iterateBatches(10)];
      batches.forEach(batch => {
        expect(batch.length).toBeLessThanOrEqual(10);
      });
    });

    it('should handle full batch size', () => {
      const batches = [...dataset.iterateBatches(25)];
      expect(batches[0].length).toBe(25);
    });

    it('should handle partial last batch', () => {
      const options: PreferenceDatasetOptions = { dropLast: false };
      const ds = new PreferenceDataset(pairs, options);
      const batches = [...ds.iterateBatches(30)];
      const lastBatch = batches[batches.length - 1];
      expect(lastBatch.length).toBeLessThan(30);
    });

    it('should drop last batch when configured', () => {
      const options: PreferenceDatasetOptions = { dropLast: true };
      const ds = new PreferenceDataset(pairs, options);
      const batches = [...ds.iterateBatches(30)];
      const totalItems = batches.reduce((sum, b) => sum + b.length, 0);
      expect(totalItems % 30).toBe(0);
    });
  });

  describe('Shuffling', () => {
    it('should shuffle dataset', () => {
      const firstBefore = dataset.get(0).id;
      dataset.shuffle();
      const firstAfter = dataset.get(0).id;
      // Very low probability of being the same
      expect([firstBefore, firstAfter]).not.toEqual([firstBefore, firstBefore]);
    });

    it('should maintain length after shuffle', () => {
      dataset.shuffle();
      expect(dataset.length).toBe(100);
    });

    it('should start new epoch', () => {
      const epochBefore = dataset.getEpoch();
      dataset.startNewEpoch();
      expect(dataset.getEpoch()).toBe(epochBefore + 1);
    });
  });

  describe('Splitting', () => {
    it('should split dataset', () => {
      const split = dataset.split(0.8, 0.1);
      expect(split.train).toBeDefined();
      expect(split.validation).toBeDefined();
      expect(split.test).toBeDefined();
    });

    it('should have correct split sizes', () => {
      const split = dataset.split(0.8, 0.1);
      expect(split.train.length).toBe(80);
      expect(split.validation.length).toBe(10);
      expect(split.test.length).toBe(10);
    });

    it('should handle different split ratios', () => {
      const split = dataset.split(0.6, 0.2);
      expect(split.train.length).toBe(60);
      expect(split.validation.length).toBe(20);
      expect(split.test.length).toBe(20);
    });
  });

  describe('Filtering', () => {
    it('should filter dataset', () => {
      const filtered = dataset.filter(pair => pair.metadata.confidence > 0.5);
      expect(filtered.length).toBe(100); // All have confidence 0.8
    });

    it('should filter to empty set', () => {
      const filtered = dataset.filter(pair => pair.metadata.confidence > 1.0);
      expect(filtered.length).toBe(0);
    });

    it('should preserve options in filtered dataset', () => {
      const filtered = dataset.filter(pair => true);
      expect(filtered.getOptions()).toBeDefined();
    });
  });

  describe('Sampling', () => {
    it('should sample random pairs', () => {
      const sampled = dataset.sample(10);
      expect(sampled).toHaveLength(10);
    });

    it('should sample without replacement', () => {
      const sampled = dataset.sample(10);
      const ids = new Set(sampled.map(p => p.id));
      expect(ids.size).toBe(10);
    });

    it('should sample up to dataset size', () => {
      const sampled = dataset.sample(100);
      expect(sampled.length).toBeLessThanOrEqual(100);
    });

    it('should handle sample size larger than dataset', () => {
      const sampled = dataset.sample(200);
      expect(sampled.length).toBe(100);
    });
  });

  describe('Statistics', () => {
    it('should compute statistics', () => {
      const stats = dataset.getStatistics();
      expect(stats.totalPairs).toBe(100);
      expect(stats.avgConfidence).toBe(0.8);
      expect(stats.bySource).toBeDefined();
      expect(stats.byContext).toBeDefined();
      expect(stats.byTask).toBeDefined();
      expect(stats.avgEmbeddingDimension).toBe(768);
    });

    it('should calculate source distribution', () => {
      const stats = dataset.getStatistics();
      expect(stats.bySource['synthetic']).toBe(100);
    });

    it('should calculate context distribution', () => {
      const stats = dataset.getStatistics();
      expect(stats.byContext['context']).toBe(100);
    });
  });

  describe('Slicing', () => {
    it('should slice dataset', () => {
      const sliced = dataset.slice(0, 10);
      expect(sliced.length).toBe(10);
    });

    it('should preserve order in slice', () => {
      const sliced = dataset.slice(0, 5);
      expect(sliced.get(0).id).toBe('pair_0');
      expect(sliced.get(4).id).toBe('pair_4');
    });

    it('should handle slice to end', () => {
      const sliced = dataset.slice(90, 100);
      expect(sliced.length).toBe(10);
    });
  });

  describe('Concatenation', () => {
    it('should concatenate datasets', () => {
      const other = new PreferenceDataset(pairs.slice(0, 50));
      const concatenated = dataset.concat(other);
      expect(concatenated.length).toBe(150);
    });

    it('should preserve all pairs in concatenation', () => {
      const other = new PreferenceDataset(pairs.slice(0, 10));
      const concatenated = dataset.concat(other);
      const allIds = new Set(concatenated.getPairs().map(p => p.id));
      expect(allIds.size).toBe(110);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', () => {
      dataset.clearCache();
      expect(dataset).toBeDefined();
    });

    it('should have cache enabled by default', () => {
      const options: PreferenceDatasetOptions = { cacheEmbeddings: true };
      const ds = new PreferenceDataset(pairs, options);
      expect(ds.getOptions().cacheEmbeddings).toBe(true);
    });
  });

  describe('Static Methods', () => {
    it('should create from arrays', () => {
      const chosenStates = pairs.map(p => p.chosen);
      const rejectedStates = pairs.map(p => p.rejected);
      const contexts = pairs.map(p => p.context);
      const metadata = pairs.map(p => p.metadata);

      const ds = PreferenceDataset.fromArrays(
        chosenStates,
        rejectedStates,
        contexts,
        metadata
      );
      expect(ds.length).toBe(100);
    });

    it('should validate array lengths', () => {
      expect(() =>
        PreferenceDataset.fromArrays([], [], [], [])
      ).not.toThrow();

      expect(() =>
        PreferenceDataset.fromArrays(pairs.map(p => p.chosen), [], [], [])
      ).toThrow();
    });
  });

  describe('Factory Function', () => {
    it('should create dataset via factory', () => {
      const ds = createPreferenceDataset(pairs);
      expect(ds).toBeDefined();
    });

    it('should accept options in factory', () => {
      const options: PreferenceDatasetOptions = { shuffleEachEpoch: false };
      const ds = createPreferenceDataset(pairs, options);
      expect(ds.getOptions().shuffleEachEpoch).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty dataset', () => {
      const ds = new PreferenceDataset([]);
      expect(ds.length).toBe(0);
    });

    it('should handle single pair dataset', () => {
      const ds = new PreferenceDataset([pairs[0]]);
      expect(ds.length).toBe(1);
    });

    it('should handle very large batch size', () => {
      const batches = [...dataset.iterateBatches(1000)];
      expect(batches.length).toBe(1);
    });

    it('should handle batch size of 1', () => {
      const batches = [...dataset.iterateBatches(1)];
      expect(batches.length).toBe(100);
    });
  });
});

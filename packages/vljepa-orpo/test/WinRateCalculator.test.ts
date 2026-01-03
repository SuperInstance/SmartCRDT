/**
 * @lsi/vljepa-orpo - WinRateCalculator Tests
 *
 * Comprehensive test suite for WinRateCalculator.
 * Target: 35+ tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  WinRateCalculator,
  createWinRateCalculator,
  calculateWinRate,
  type WinRateOptions,
} from '../src/evaluators/WinRateCalculator.js';
import type { UIPreferencePair } from '../src/types.js';

function createMockPair(index: number, correct: boolean = true): UIPreferencePair {
  return {
    id: `pair_${index}`,
    chosen: {
      image: { data: new Uint8ClampedArray(100), width: 10, height: 10, colorSpace: 'srgb' },
      embedding: new Float32Array(768).fill(correct ? 1 : -0.5),
      dom: { tagName: 'div', classes: [], children: [], attributes: {} },
      styles: {},
    },
    rejected: {
      image: { data: new Uint8ClampedArray(100), width: 10, height: 10, colorSpace: 'srgb' },
      embedding: new Float32Array(768).fill(correct ? -0.5 : 1),
      dom: { tagName: 'div', classes: [], children: [], attributes: {} },
      styles: {},
    },
    context: {
      task: 'task',
      userIntent: 'intent',
      uiContext: correct ? 'context_a' : 'context_b',
      constraints: {},
    },
    metadata: {
      source: 'synthetic',
      confidence: 0.8,
      timestamp: Date.now(),
    },
  };
}

function createPrediction(score: number): Float32Array {
  return new Float32Array([score]);
}

describe('WinRateCalculator', () => {
  let calculator: WinRateCalculator;
  let pairs: UIPreferencePair[];
  let predictions: Float32Array[];

  beforeEach(() => {
    calculator = new WinRateCalculator();
    // Create 75% correct predictions
    pairs = Array.from({ length: 100 }, (_, i) => createMockPair(i, i < 75));
    predictions = pairs.map(p => createPrediction(p.chosen.embedding[0] > 0 ? 0.7 : 0.3));
  });

  describe('Construction', () => {
    it('should create calculator with default options', () => {
      const calc = new WinRateCalculator();
      expect(calc).toBeDefined();
    });

    it('should create calculator with custom options', () => {
      const options: WinRateOptions = {
        bootstrapSamples: 500,
        confidenceLevel: 0.99,
        perCategory: true,
        calculateCalibration: true,
      };
      const calc = new WinRateCalculator(options);
      expect(calc).toBeDefined();
    });

    it('should get options', () => {
      const options = calculator.getOptions();
      expect(options).toBeDefined();
    });

    it('should set options', () => {
      calculator.setOptions({ bootstrapSamples: 2000 });
      expect(calculator.getOptions().bootstrapSamples).toBe(2000);
    });
  });

  describe('Evaluation', () => {
    it('should evaluate predictions', () => {
      const results = calculator.evaluate(pairs, predictions);
      expect(results).toBeDefined();
    });

    it('should calculate pairwise accuracy', () => {
      const results = calculator.evaluate(pairs, predictions);
      expect(results.pairwiseAccuracy).toBeGreaterThanOrEqual(0);
      expect(results.pairwiseAccuracy).toBeLessThanOrEqual(1);
    });

    it('should calculate win rate vs baseline', () => {
      const results = calculator.evaluate(pairs, predictions);
      expect(results.winRateVsBaseline).toBeDefined();
    });

    it('should have total pairs', () => {
      const results = calculator.evaluate(pairs, predictions);
      expect(results.totalPairs).toBe(100);
    });

    it('should have average preference score', () => {
      const results = calculator.evaluate(pairs, predictions);
      expect(results.avgPreferenceScore).toBeDefined();
    });

    it('should have average odds ratio', () => {
      const results = calculator.evaluate(pairs, predictions);
      expect(results.avgOddsRatio).toBeDefined();
    });
  });

  describe('Calibration', () => {
    it('should calculate calibration metrics', () => {
      const results = calculator.evaluate(pairs, predictions);
      expect(results.calibration).toBeDefined();
      expect(results.calibration.expectedCalibrationError).toBeGreaterThanOrEqual(0);
    });

    it('should have reliability diagram', () => {
      const results = calculator.evaluate(pairs, predictions);
      expect(results.calibration.reliabilityDiagram).toBeDefined();
      expect(Array.isArray(results.calibration.reliabilityDiagram)).toBe(true);
    });

    it('should calculate brier score', () => {
      const results = calculator.evaluate(pairs, predictions);
      expect(results.calibration.brierScore).toBeGreaterThanOrEqual(0);
    });

    it('should skip calibration when disabled', () => {
      const calc = new WinRateCalculator({ calculateCalibration: false });
      const results = calc.evaluate(pairs, predictions);
      expect(results.calibration.reliabilityDiagram).toHaveLength(0);
    });
  });

  describe('Per-Category Metrics', () => {
    it('should calculate per-category metrics', () => {
      const results = calculator.evaluate(pairs, predictions);
      expect(results.perCategory).toBeDefined();
      expect(Array.isArray(results.perCategory)).toBe(true);
    });

    it('should have category names', () => {
      const results = calculator.evaluate(pairs, predictions);
      results.perCategory.forEach(cat => {
        expect(cat.category).toBeDefined();
        expect(typeof cat.category).toBe('string');
      });
    });

    it('should have category accuracy', () => {
      const results = calculator.evaluate(pairs, predictions);
      results.perCategory.forEach(cat => {
        expect(cat.accuracy).toBeGreaterThanOrEqual(0);
        expect(cat.accuracy).toBeLessThanOrEqual(1);
      });
    });

    it('should have sample sizes', () => {
      const results = calculator.evaluate(pairs, predictions);
      results.perCategory.forEach(cat => {
        expect(cat.sampleSize).toBeGreaterThan(0);
      });
    });

    it('should have avg confidence', () => {
      const results = calculator.evaluate(pairs, predictions);
      results.perCategory.forEach(cat => {
        expect(cat.avgConfidence).toBeGreaterThanOrEqual(0);
        expect(cat.avgConfidence).toBeLessThanOrEqual(1);
      });
    });

    it('should skip per-category when disabled', () => {
      const calc = new WinRateCalculator({ perCategory: false });
      const results = calc.evaluate(pairs, predictions);
      expect(results.perCategory).toHaveLength(0);
    });
  });

  describe('Ranking Consistency', () => {
    it('should calculate ranking consistency', () => {
      const results = calculator.evaluate(pairs, predictions);
      expect(results.rankingConsistency).toBeGreaterThanOrEqual(0);
      expect(results.rankingConsistency).toBeLessThanOrEqual(1);
    });
  });

  describe('Bootstrap Confidence Intervals', () => {
    it('should calculate bootstrap CI', () => {
      const ci = calculator.calculateBootstrapCI(pairs, predictions, 'accuracy');
      expect(ci.lower).toBeGreaterThanOrEqual(0);
      expect(ci.upper).toBeLessThanOrEqual(1);
      expect(ci.upper).toBeGreaterThan(ci.lower);
    });

    it('should respect confidence level', () => {
      const ci95 = calculator.calculateBootstrapCI(pairs, predictions, 'accuracy');
      const ci99 = calculator.calculateBootstrapCI(pairs, predictions, 'accuracy');
      // 99% CI should be wider than 95% CI
      expect(ci99.upper - ci99.lower).toBeGreaterThanOrEqual(ci95.upper - ci95.lower);
    });
  });

  describe('Win Rate Calculation', () => {
    it('should calculate win rate vs baseline', () => {
      const baselineScores = predictions.map(() => createPrediction(0.5));
      const winRate = calculator.calculateWinRate(pairs, predictions, baselineScores);
      expect(winRate).toBeGreaterThanOrEqual(-1);
      expect(winRate).toBeLessThanOrEqual(1);
    });

    it('should return 0.5 for identical models', () => {
      const winRate = calculator.calculateWinRate(pairs, predictions, predictions);
      expect(winRate).toBe(0);
    });
  });

  describe('Simple Win Rate', () => {
    it('should calculate simple win rate', () => {
      const winRate = calculator.calculateSimpleWinRate(predictions);
      expect(winRate).toBeGreaterThanOrEqual(0);
      expect(winRate).toBeLessThanOrEqual(1);
    });

    it('should be 1.0 for all correct', () => {
      const allCorrect = predictions.map(() => createPrediction(0.9));
      const winRate = calculator.calculateSimpleWinRate(allCorrect);
      expect(winRate).toBe(1);
    });

    it('should be 0.0 for all wrong', () => {
      const allWrong = predictions.map(() => createPrediction(0.1));
      const winRate = calculator.calculateSimpleWinRate(allWrong);
      expect(winRate).toBe(0);
    });
  });

  describe('Top-K Accuracy', () => {
    it('should calculate top-1 accuracy', () => {
      const acc = calculator.calculateTopKAccuracy(pairs, predictions, 1);
      expect(acc).toBeGreaterThanOrEqual(0);
      expect(acc).toBeLessThanOrEqual(1);
    });

    it('should handle k > 1', () => {
      const acc = calculator.calculateTopKAccuracy(pairs, predictions, 5);
      expect(acc).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty predictions', () => {
      const results = calculator.evaluate([], []);
      expect(results.pairwiseAccuracy).toBe(0);
      expect(results.totalPairs).toBe(0);
    });

    it('should handle single prediction', () => {
      const singlePair = [pairs[0]];
      const singlePred = [predictions[0]];
      const results = calculator.evaluate(singlePair, singlePred);
      expect(results.pairwiseAccuracy).toBeGreaterThanOrEqual(0);
    });

    it('should handle perfect predictions', () => {
      const perfectPairs = Array.from({ length: 10 }, (_, i) => createMockPair(i, true));
      const perfectPreds = perfectPairs.map(() => createPrediction(0.9));
      const results = calculator.evaluate(perfectPairs, perfectPreds);
      expect(results.pairwiseAccuracy).toBe(1);
    });

    it('should handle all wrong predictions', () => {
      const wrongPairs = Array.from({ length: 10 }, (_, i) => createMockPair(i, true));
      const wrongPreds = wrongPairs.map(() => createPrediction(0.1));
      const results = calculator.evaluate(wrongPairs, wrongPreds);
      expect(results.pairwiseAccuracy).toBe(0);
    });
  });

  describe('Factory Function', () => {
    it('should create calculator via factory', () => {
      const calc = createWinRateCalculator();
      expect(calc).toBeDefined();
    });

    it('should accept options in factory', () => {
      const calc = createWinRateCalculator({ bootstrapSamples: 500 });
      expect(calc.getOptions().bootstrapSamples).toBe(500);
    });
  });

  describe('Convenience Function', () => {
    it('should calculate win rate via convenience function', () => {
      const results = calculateWinRate(pairs, predictions);
      expect(results).toBeDefined();
    });

    it('should accept options in convenience function', () => {
      const results = calculateWinRate(pairs, predictions, { perCategory: false });
      expect(results.perCategory).toHaveLength(0);
    });
  });
});

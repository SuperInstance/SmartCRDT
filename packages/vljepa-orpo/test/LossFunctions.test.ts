/**
 * @lsi/vljepa-orpo - LossFunctions Tests
 *
 * Comprehensive test suite for LossFunctions.
 * Target: 35+ tests
 */

import { describe, it, expect } from 'vitest';
import {
  ORPOLossFunction,
  computeLogProb,
  computeSequenceLogProb,
  batchComputeORPOLoss,
  computeAverageORPOLoss,
  createORPOLossFunction,
  type ORPOLossConfig,
} from '../src/trainers/LossFunctions.js';

describe('ORPOLossFunction', () => {
  describe('Construction', () => {
    it('should create with default config', () => {
      const lossFn = new ORPOLossFunction();
      expect(lossFn).toBeDefined();
    });

    it('should create with custom config', () => {
      const config: ORPOLossConfig = { beta: 0.2, lambda: 2.0 };
      const lossFn = new ORPOLossFunction(config);
      expect(lossFn.getConfig().beta).toBe(0.2);
    });

    it('should get config', () => {
      const lossFn = new ORPOLossFunction();
      const config = lossFn.getConfig();
      expect(config).toBeDefined();
      expect(config.beta).toBeDefined();
    });

    it('should update config', () => {
      const lossFn = new ORPOLossFunction();
      lossFn.updateConfig({ beta: 0.5 });
      expect(lossFn.getConfig().beta).toBe(0.5);
    });
  });

  describe('SFT Loss', () => {
    it('should compute SFT loss', () => {
      const lossFn = new ORPOLossFunction();
      const loss = lossFn.computeSFTLoss(0.5);
      expect(loss).toBe(-0.5);
    });

    it('should handle negative log probs', () => {
      const lossFn = new ORPOLossFunction();
      const loss = lossFn.computeSFTLoss(-1.0);
      expect(loss).toBe(1.0);
    });

    it('should handle zero log prob', () => {
      const lossFn = new ORPOLossFunction();
      const loss = lossFn.computeSFTLoss(0);
      expect(loss).toBe(0);
    });

    it('should handle very small log probs', () => {
      const lossFn = new ORPOLossFunction();
      const loss = lossFn.computeSFTLoss(-10);
      expect(loss).toBe(10);
    });
  });

  describe('ORPO Loss', () => {
    it('should compute ORPO loss', () => {
      const lossFn = new ORPOLossFunction();
      const loss = lossFn.computeORPOLossInternal(0.5, 0.0);
      expect(loss).toBeGreaterThanOrEqual(0);
    });

    it('should handle positive log odds ratio', () => {
      const lossFn = new ORPOLossFunction();
      const loss = lossFn.computeORPOLossInternal(1.0, 0.0);
      expect(loss).toBeGreaterThanOrEqual(0);
    });

    it('should handle negative log odds ratio', () => {
      const lossFn = new ORPOLossFunction();
      const loss = lossFn.computeORPOLossInternal(-1.0, 0.0);
      expect(loss).toBeGreaterThanOrEqual(0);
    });

    it('should respect beta parameter', () => {
      const lossFn1 = new ORPOLossFunction({ beta: 0.1 });
      const lossFn2 = new ORPOLossFunction({ beta: 0.5 });
      const loss1 = lossFn1.computeORPOLossInternal(1.0, 0.0);
      const loss2 = lossFn2.computeORPOLossInternal(1.0, 0.0);
      expect(loss1).not.toBe(loss2);
    });
  });

  describe('Visual Distance Loss', () => {
    it('should compute visual distance loss', () => {
      const lossFn = new ORPOLossFunction();
      const emb1 = new Float32Array(768).map(() => Math.random() * 2 - 1);
      const emb2 = new Float32Array(768).map(() => Math.random() * 2 - 1);
      const loss = lossFn.computeVisualDistanceLoss(emb1, emb2);
      expect(loss).toBeGreaterThanOrEqual(0);
      expect(loss).toBeLessThanOrEqual(2);
    });

    it('should return zero for identical embeddings', () => {
      const lossFn = new ORPOLossFunction();
      const emb = new Float32Array(768).map(() => Math.random() * 2 - 1);
      const loss = lossFn.computeVisualDistanceLoss(emb, emb);
      expect(loss).toBeCloseTo(0, 5);
    });

    it('should return maximum for opposite embeddings', () => {
      const lossFn = new ORPOLossFunction();
      const emb1 = new Float32Array(768).fill(1);
      const emb2 = new Float32Array(768).fill(-1);
      const loss = lossFn.computeVisualDistanceLoss(emb1, emb2);
      expect(loss).toBeCloseTo(2, 5);
    });
  });

  describe('Cosine Similarity', () => {
    it('should compute cosine similarity', () => {
      const lossFn = new ORPOLossFunction();
      const emb1 = new Float32Array([1, 0, 0]);
      const emb2 = new Float32Array([1, 0, 0]);
      const sim = lossFn.cosineSimilarity(emb1, emb2);
      expect(sim).toBeCloseTo(1, 5);
    });

    it('should return 1 for identical vectors', () => {
      const lossFn = new ORPOLossFunction();
      const emb = new Float32Array([1, 2, 3]);
      const sim = lossFn.cosineSimilarity(emb, emb);
      expect(sim).toBeCloseTo(1, 5);
    });

    it('should return -1 for opposite vectors', () => {
      const lossFn = new ORPOLossFunction();
      const emb1 = new Float32Array([1, 1, 1]);
      const emb2 = new Float32Array([-1, -1, -1]);
      const sim = lossFn.cosineSimilarity(emb1, emb2);
      expect(sim).toBeCloseTo(-1, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const lossFn = new ORPOLossFunction();
      const emb1 = new Float32Array([1, 0, 0]);
      const emb2 = new Float32Array([0, 1, 0]);
      const sim = lossFn.cosineSimilarity(emb1, emb2);
      expect(sim).toBeCloseTo(0, 5);
    });

    it('should validate embedding dimensions', () => {
      const lossFn = new ORPOLossFunction();
      const emb1 = new Float32Array([1, 2]);
      const emb2 = new Float32Array([1, 2, 3]);
      expect(() => lossFn.cosineSimilarity(emb1, emb2)).toThrow();
    });
  });

  describe('Complete Loss Computation', () => {
    it('should compute complete loss', () => {
      const lossFn = new ORPOLossFunction();
      const result = lossFn.compute(0.5, 0.2, 0.4, 0.1);
      expect(result.totalLoss).toBeDefined();
      expect(result.sftLoss).toBeDefined();
      expect(result.orpoLoss).toBeDefined();
      expect(result.visualDistanceLoss).toBeDefined();
    });

    it('should compute log odds ratio', () => {
      const lossFn = new ORPOLossFunction();
      const result = lossFn.compute(0.5, 0.2, 0.4, 0.1);
      expect(result.logOddsRatio).toBe(0.3); // 0.5 - 0.2
    });

    it('should compute reference log odds ratio', () => {
      const lossFn = new ORPOLossFunction();
      const result = lossFn.compute(0.5, 0.2, 0.4, 0.1);
      expect(result.refLogOddsRatio).toBe(0.3); // 0.4 - 0.1
    });

    it('should compute odds ratio', () => {
      const lossFn = new ORPOLossFunction();
      const result = lossFn.compute(0.5, 0.2, 0.4, 0.1);
      expect(result.oddsRatio).toBeCloseTo(Math.exp(0.3), 5);
    });

    it('should compute sigmoid probability', () => {
      const lossFn = new ORPOLossFunction();
      const result = lossFn.compute(0.5, 0.2, 0.4, 0.1);
      expect(result.sigmoidProb).toBeGreaterThan(0);
      expect(result.sigmoidProb).toBeLessThan(1);
    });

    it('should combine losses correctly', () => {
      const lossFn = new ORPOLossFunction({
        sftLossWeight: 2.0,
        lambda: 1.5,
        visualDistanceWeight: 0.5,
      });
      const emb1 = new Float32Array(768).fill(1);
      const emb2 = new Float32Array(768).fill(0.5);
      const result = lossFn.compute(0.5, 0.2, 0.4, 0.1, emb1, emb2);
      expect(result.totalLoss).toBeCloseTo(
        2.0 * result.sftLoss + 1.5 * result.orpoLoss + 0.5 * result.visualDistanceLoss,
        5
      );
    });
  });

  describe('Batch Computation', () => {
    it('should compute batch losses', () => {
      const lossFn = new ORPOLossFunction();
      const chosenLogProbs = [0.5, 0.6, 0.4];
      const rejectedLogProbs = [0.2, 0.3, 0.1];
      const refChosenLogProbs = [0.4, 0.5, 0.3];
      const refRejectedLogProbs = [0.1, 0.2, 0.0];
      const results = lossFn.computeBatch(
        chosenLogProbs,
        rejectedLogProbs,
        refChosenLogProbs,
        refRejectedLogProbs
      );
      expect(results).toHaveLength(3);
    });

    it('should handle empty batch', () => {
      const lossFn = new ORPOLossFunction();
      const results = lossFn.computeBatch([], [], [], []);
      expect(results).toHaveLength(0);
    });

    it('should handle single element batch', () => {
      const lossFn = new ORPOLossFunction();
      const results = lossFn.computeBatch([0.5], [0.2], [0.4], [0.1]);
      expect(results).toHaveLength(1);
    });
  });

  describe('Average Loss', () => {
    it('should compute average loss', () => {
      const lossFn = new ORPOLossFunction();
      const results = [
        lossFn.compute(0.5, 0.2, 0.4, 0.1),
        lossFn.compute(0.6, 0.3, 0.5, 0.2),
        lossFn.compute(0.4, 0.1, 0.3, 0.0),
      ];
      const avg = lossFn.computeAverageLoss(results);
      expect(avg.avgTotalLoss).toBeGreaterThan(0);
    });

    it('should handle single result', () => {
      const lossFn = new ORPOLossFunction();
      const results = [lossFn.compute(0.5, 0.2, 0.4, 0.1)];
      const avg = lossFn.computeAverageLoss(results);
      expect(avg.avgTotalLoss).toBe(results[0].totalLoss);
    });
  });

  describe('Sigmoid Function', () => {
    it('should return 0.5 at 0', () => {
      const lossFn = new ORPOLossFunction();
      const result = lossFn.compute(0.5, 0.2, 0.5, 0.2);
      expect(result.sigmoidProb).toBeCloseTo(0.5, 5);
    });

    it('should approach 1 for large positive', () => {
      const lossFn = new ORPOLossFunction({ beta: 0.01 });
      const result = lossFn.compute(10, 0, 5, 0);
      expect(result.sigmoidProb).toBeGreaterThan(0.95);
    });

    it('should approach 0 for large negative', () => {
      const lossFn = new ORPOLossFunction({ beta: 0.01 });
      const result = lossFn.compute(0, 10, 0, 5);
      expect(result.sigmoidProb).toBeLessThan(0.05);
    });
  });
});

describe('Utility Functions', () => {
  describe('computeLogProb', () => {
    it('should compute log probability', () => {
      const logits = [1.0, 2.0, 3.0];
      const target = 2;
      const logProb = computeLogProb(logits, target);
      expect(logProb).toBeLessThan(0);
    });

    it('should handle equal logits', () => {
      const logits = [1.0, 1.0, 1.0];
      const target = 1;
      const logProb = computeLogProb(logits, target);
      expect(logProb).toBeCloseTo(-Math.log(3), 5);
    });

    it('should validate target token', () => {
      const logits = [1.0, 2.0];
      expect(() => computeLogProb(logits, 5)).toThrow();
    });
  });

  describe('computeSequenceLogProb', () => {
    it('should compute sequence log probability', () => {
      const logits = [
        [1.0, 2.0],
        [0.5, 1.5],
      ];
      const targets = [0, 1];
      const logProb = computeSequenceLogProb(logits, targets);
      expect(typeof logProb).toBe('number');
    });

    it('should validate length match', () => {
      const logits = [[1.0, 2.0]];
      const targets = [0, 1];
      expect(() => computeSequenceLogProb(logits, targets)).toThrow();
    });
  });

  describe('Batch Compute Functions', () => {
    it('should batch compute ORPO loss', () => {
      const results = batchComputeORPOLoss(
        [0.5, 0.6],
        [0.2, 0.3],
        [0.4, 0.5],
        [0.1, 0.2]
      );
      expect(results).toHaveLength(2);
    });

    it('should compute average ORPO loss', () => {
      const avgLoss = computeAverageORPOLoss(
        [0.5, 0.6],
        [0.2, 0.3],
        [0.4, 0.5],
        [0.1, 0.2]
      );
      expect(avgLoss).toBeGreaterThan(0);
    });

    it('should use custom config in batch compute', () => {
      const results = batchComputeORPOLoss(
        [0.5],
        [0.2],
        [0.4],
        [0.1],
        { beta: 0.5 }
      );
      expect(results).toHaveLength(1);
    });
  });

  describe('Factory Function', () => {
    it('should create loss function via factory', () => {
      const lossFn = createORPOLossFunction();
      expect(lossFn).toBeDefined();
    });

    it('should accept config in factory', () => {
      const lossFn = createORPOLossFunction({ beta: 0.3 });
      expect(lossFn.getConfig().beta).toBe(0.3);
    });
  });
});

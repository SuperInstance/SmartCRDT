/**
 * @file ErrorClassifier.test.ts - Tests for ErrorClassifier
 * @package @lsi/langgraph-errors
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ErrorClassifier } from '../src/ErrorClassifier.js';
import type { ErrorCategory, ErrorSeverity } from '../src/types.js';

describe('ErrorClassifier', () => {
  let classifier: ErrorClassifier;

  beforeEach(() => {
    classifier = new ErrorClassifier();
  });

  describe('categorize', () => {
    it('should categorize timeout errors', () => {
      const error = new Error('Operation timed out');
      const classification = classifier.classify(error);

      expect(classification.category).toBe('timeout');
    });

    it('should categorize network errors', () => {
      const error = new Error('ECONNREFUSED - connection refused');
      const classification = classifier.classify(error);

      expect(classification.category).toBe('network');
    });

    it('should categorize authentication errors', () => {
      const error = new Error('Unauthorized - 401');
      const classification = classifier.classify(error);

      expect(classification.category).toBe('authentication');
    });

    it('should categorize authorization errors', () => {
      const error = new Error('Forbidden - 403');
      const classification = classifier.classify(error);

      expect(classification.category).toBe('authorization');
    });

    it('should categorize validation errors', () => {
      const error = new Error('Validation failed: invalid schema');
      const classification = classifier.classify(error);

      expect(classification.category).toBe('validation');
    });

    it('should categorize rate limit errors', () => {
      const error = new Error('Rate limit exceeded: 429');
      const classification = classifier.classify(error);

      expect(classification.category).toBe('rate_limit');
    });

    it('should categorize resource errors', () => {
      const error = new Error('Out of memory');
      const classification = classifier.classify(error);

      expect(classification.category).toBe('resource');
    });

    it('should categorize unknown errors', () => {
      const error = new Error('Something weird happened');
      const classification = classifier.classify(error);

      expect(classification.category).toBe('unknown');
    });
  });

  describe('assessSeverity', () => {
    it('should assess fatal severity for resource errors', () => {
      const error = new Error('Out of memory - system crash');
      const classification = classifier.classify(error);

      expect(classification.severity).toBe('fatal');
    });

    it('should assess critical severity for auth errors', () => {
      const error = new Error('Unauthorized: 401');
      const classification = classifier.classify(error);

      expect(classification.severity).toBe('critical');
    });

    it('should assess error severity for execution errors', () => {
      const error = new Error('Execution failed');
      const classification = classifier.classify(error);

      expect(classification.severity).toBe('error');
    });

    it('should assess warning severity for dependency errors', () => {
      const error = new Error('Dependency missing: package not found');
      const classification = classifier.classify(error);

      expect(classification.severity).toBe('warning');
    });
  });

  describe('isRetryable', () => {
    it('should mark timeout errors as retryable', () => {
      const error = new Error('Operation timed out');
      const classification = classifier.classify(error);

      expect(classification.retryable).toBe(true);
    });

    it('should mark network errors as retryable', () => {
      const error = new Error('ECONNREFUSED');
      const classification = classifier.classify(error);

      expect(classification.retryable).toBe(true);
    });

    it('should mark rate limit errors as retryable', () => {
      const error = new Error('Rate limit exceeded');
      const classification = classifier.classify(error);

      expect(classification.retryable).toBe(true);
    });

    it('should mark authentication errors as non-retryable', () => {
      const error = new Error('Unauthorized: 401');
      const classification = classifier.classify(error);

      expect(classification.retryable).toBe(false);
    });

    it('should mark validation errors as non-retryable', () => {
      const error = new Error('Validation failed');
      const classification = classifier.classify(error);

      expect(classification.retryable).toBe(false);
    });
  });

  describe('suggestRecovery', () => {
    it('should suggest retry for retryable errors', () => {
      const error = new Error('Operation timed out');
      const classification = classifier.classify(error);

      expect(classification.recovery_strategy).toBe('retry');
    });

    it('should suggest fallback for non-retryable errors', () => {
      const error = new Error('Unknown error occurred');
      const classification = classifier.classify(error);

      expect(classification.recovery_strategy).toBe('fallback');
    });

    it('should suggest abort for fatal errors', () => {
      const error = new Error('Fatal system error: panic');
      const classification = classifier.classify(error);

      expect(classification.recovery_strategy).toBe('abort');
    });

    it('should suggest abort for authentication errors', () => {
      const error = new Error('Unauthorized: 401');
      const classification = classifier.classify(error);

      expect(classification.recovery_strategy).toBe('abort');
    });

    it('should suggest skip for validation errors', () => {
      const error = new Error('Validation failed: invalid input');
      const classification = classifier.classify(error);

      expect(classification.recovery_strategy).toBe('skip');
    });
  });

  describe('calculateConfidence', () => {
    it('should calculate confidence for known error types', () => {
      const error = new Error('TimeoutError: operation timed out');
      const classification = classifier.classify(error);

      expect(classification.confidence).toBeGreaterThan(0.5);
    });

    it('should calculate lower confidence for unknown errors', () => {
      const error = new Error('Something weird happened');
      const classification = classifier.classify(error);

      expect(classification.confidence).toBeLessThan(0.6);
    });
  });

  describe('classifyBatch', () => {
    it('should classify multiple errors', () => {
      const errors = [
        new Error('Timeout'),
        new Error('Network error'),
        new Error('Validation failed'),
      ];

      const classifications = classifier.classifyBatch(errors);

      expect(classifications).toHaveLength(3);
      expect(classifications[0].category).toBe('timeout');
      expect(classifications[1].category).toBe('network');
      expect(classifications[2].category).toBe('validation');
    });
  });

  describe('getBatchStatistics', () => {
    it('should calculate batch statistics', () => {
      const errors = [
        new Error('Timeout'),
        new Error('Network error'),
        new Error('Timeout'),
      ];

      const classifications = classifier.classifyBatch(errors);
      const stats = classifier.getBatchStatistics(classifications);

      expect(stats.byCategory.timeout).toBe(2);
      expect(stats.byCategory.network).toBe(1);
      expect(stats.avgConfidence).toBeGreaterThan(0);
    });
  });

  describe('registerClassifier', () => {
    it('should use custom classifier', () => {
      classifier.registerClassifier((error) => {
        if (error.message.includes('CUSTOM')) {
          return 'dependency' as ErrorCategory;
        }
        return null;
      });

      const error = new Error('CUSTOM error');
      const classification = classifier.classify(error);

      expect(classification.category).toBe('dependency');
    });

    it('should fallback to default classifier if custom returns null', () => {
      classifier.registerClassifier((error) => {
        if (error.message.includes('CUSTOM')) {
          return 'dependency' as ErrorCategory;
        }
        return null;
      });

      const error = new Error('Timeout');
      const classification = classifier.classify(error);

      expect(classification.category).toBe('timeout');
    });
  });
});

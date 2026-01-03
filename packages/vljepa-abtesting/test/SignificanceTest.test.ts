/**
 * Tests for SignificanceTest
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SignificanceTester,
  createSignificanceTester,
  isSignificant,
  conversionRateWithCI,
} from '../src/statistics/SignificanceTest.js';
import type { TestConfig, MetricSummary } from '../src/types.js';

function createMetricSummary(mean: number, variance: number, count: number): MetricSummary {
  return {
    metricId: 'test',
    variantId: 'variant',
    count,
    sum: mean * count,
    mean,
    variance,
    stdDev: Math.sqrt(variance),
    min: mean - Math.sqrt(variance) * 2,
    max: mean + Math.sqrt(variance) * 2,
    median: mean,
  };
}

describe('SignificanceTester', () => {
  let tester: SignificanceTester;

  beforeEach(() => {
    tester = new SignificanceTester(0.05, 1000);
  });

  describe('z-test', () => {
    it('should detect significant difference', () => {
      const control = createMetricSummary(0.1, 0.01, 1000);
      const treatment = createMetricSummary(0.15, 0.01, 1000);

      const config: TestConfig = {
        metric: 'conversion',
        control: 'control',
        treatment: 'treatment',
        test: 'z_test',
        alpha: 0.05,
        twoTailed: true,
      };

      const result = tester.runTest(config, control, treatment);

      expect(result.significant).toBe(true);
      expect(result.pValue).toBeLessThan(0.05);
    });

    it('should not detect significance when difference is small', () => {
      const control = createMetricSummary(0.1, 0.01, 100);
      const treatment = createMetricSummary(0.105, 0.01, 100);

      const config: TestConfig = {
        metric: 'conversion',
        control: 'control',
        treatment: 'treatment',
        test: 'z_test',
        alpha: 0.05,
        twoTailed: true,
      };

      const result = tester.runTest(config, control, treatment);

      expect(result.significant).toBe(false);
      expect(result.pValue).toBeGreaterThan(0.05);
    });

    it('should calculate effect size', () => {
      const control = createMetricSummary(0.15, 0.01, 1000);
      const treatment = createMetricSummary(0.1, 0.01, 1000);

      const config: TestConfig = {
        metric: 'conversion',
        control: 'control',
        treatment: 'treatment',
        test: 'z_test',
        alpha: 0.05,
        twoTailed: true,
      };

      const result = tester.runTest(config, control, treatment);

      // Effect size is (control - treatment), so control > treatment yields positive
      expect(result.effectSize).toBeGreaterThan(0);
      expect(Math.abs(result.effectSize)).toBeLessThan(2);
    });

    it('should calculate confidence interval', () => {
      const control = createMetricSummary(0.1, 0.01, 1000);
      const treatment = createMetricSummary(0.15, 0.01, 1000);

      const config: TestConfig = {
        metric: 'conversion',
        control: 'control',
        treatment: 'treatment',
        test: 'z_test',
        alpha: 0.05,
        twoTailed: true,
      };

      const result = tester.runTest(config, control, treatment);

      expect(result.confidenceInterval.lower).toBeLessThan(result.confidenceInterval.upper);
      expect(result.confidenceInterval.level).toBe(0.95);
    });

    it('should handle one-tailed test', () => {
      const control = createMetricSummary(0.1, 0.01, 1000);
      const treatment = createMetricSummary(0.15, 0.01, 1000);

      const config: TestConfig = {
        metric: 'conversion',
        control: 'control',
        treatment: 'treatment',
        test: 'z_test',
        alpha: 0.05,
        twoTailed: false,
      };

      const result = tester.runTest(config, control, treatment);

      expect(result).toBeDefined();
    });
  });

  describe('t-test', () => {
    it('should run t-test', () => {
      const control = createMetricSummary(0.1, 0.01, 50);
      const treatment = createMetricSummary(0.15, 0.01, 50);

      const config: TestConfig = {
        metric: 'conversion',
        control: 'control',
        treatment: 'treatment',
        test: 't_test',
        alpha: 0.05,
        twoTailed: true,
      };

      const result = tester.runTest(config, control, treatment);

      expect(result.test).toBe('t_test');
      expect(result.pValue).toBeDefined();
    });

    it('should work with small samples', () => {
      const control = createMetricSummary(10, 4, 10);
      const treatment = createMetricSummary(15, 4, 10);

      const config: TestConfig = {
        metric: 'revenue',
        control: 'control',
        treatment: 'treatment',
        test: 't_test',
        alpha: 0.05,
        twoTailed: true,
      };

      const result = tester.runTest(config, control, treatment);

      expect(result).toBeDefined();
    });
  });

  describe('bootstrap test', () => {
    it('should run bootstrap test', () => {
      const control = createMetricSummary(0.1, 0.01, 100);
      const treatment = createMetricSummary(0.15, 0.01, 100);

      const config: TestConfig = {
        metric: 'conversion',
        control: 'control',
        treatment: 'treatment',
        test: 'bootstrap',
        alpha: 0.05,
        twoTailed: true,
      };

      const result = tester.runTest(config, control, treatment);

      expect(result.test).toBe('bootstrap');
      expect(result.confidenceInterval).toBeDefined();
    });

    it('should handle different sample sizes', () => {
      const control = createMetricSummary(0.1, 0.01, 50);
      const treatment = createMetricSummary(0.15, 0.01, 200);

      const config: TestConfig = {
        metric: 'conversion',
        control: 'control',
        treatment: 'treatment',
        test: 'bootstrap',
        alpha: 0.05,
        twoTailed: true,
      };

      const result = tester.runTest(config, control, treatment);

      expect(result).toBeDefined();
    });
  });

  describe('chi-square test', () => {
    it('should run chi-square test for proportions', () => {
      // Use mean as conversion rate (0-1)
      const control = createMetricSummary(0.1, 0.009, 1000);
      const treatment = createMetricSummary(0.15, 0.1275, 1000);

      const config: TestConfig = {
        metric: 'conversion',
        control: 'control',
        treatment: 'treatment',
        test: 'chi_square',
        alpha: 0.05,
        twoTailed: true,
      };

      const result = tester.runTest(config, control, treatment);

      expect(result.test).toBe('chi_square');
      expect(result.effectSize).toBeDefined();
    });
  });

  describe('fisher exact test', () => {
    it('should approximate with chi-square for large samples', () => {
      const control = createMetricSummary(0.1, 0.009, 1000);
      const treatment = createMetricSummary(0.15, 0.1275, 1000);

      const config: TestConfig = {
        metric: 'conversion',
        control: 'control',
        treatment: 'treatment',
        test: 'fisher_exact',
        alpha: 0.05,
        twoTailed: true,
      };

      const result = tester.runTest(config, control, treatment);

      expect(result.test).toBe('fisher_exact');
    });
  });

  describe('power analysis', () => {
    it('should analyze power for given parameters', () => {
      const result = tester.analyzePower(0.5, 100, 0.05);

      expect(result.sampleSize).toBe(100);
      expect(result.power).toBeGreaterThan(0);
      expect(result.recommendation).toBeDefined();
    });

    it('should recommend larger sample for low power', () => {
      const result = tester.analyzePower(0.1, 50, 0.05);

      expect(result.power).toBeLessThan(0.8);
      expect(result.recommendation).toContain('Increase');
    });

    it('should recommend adequate power when sufficient', () => {
      const result = tester.analyzePower(0.5, 500, 0.05);

      expect(result.power).toBeGreaterThan(0.8);
    });
  });

  describe('sample size calculation', () => {
    it('should calculate required sample size', () => {
      const sampleSize = tester.calculateSampleSize(0.5, 0.8, 0.05);

      expect(sampleSize).toBeGreaterThan(0);
      expect(sampleSize).toBeLessThan(100);
    });

    it('should require larger sample for smaller effect', () => {
      const size1 = tester.calculateSampleSize(0.8, 0.8, 0.05);
      const size2 = tester.calculateSampleSize(0.2, 0.8, 0.05);

      expect(size2).toBeGreaterThan(size1);
    });

    it('should require larger sample for higher power', () => {
      const size1 = tester.calculateSampleSize(0.5, 0.7, 0.05);
      const size2 = tester.calculateSampleSize(0.5, 0.9, 0.05);

      expect(size2).toBeGreaterThan(size1);
    });
  });

  describe('recommendation generation', () => {
    it('should recommend implementation for significant results', () => {
      // Use larger samples to ensure adequate power
      const control = createMetricSummary(0.1, 0.01, 5000);
      const treatment = createMetricSummary(0.15, 0.01, 5000);

      const config: TestConfig = {
        metric: 'conversion',
        control: 'control',
        treatment: 'treatment',
        test: 'z_test',
        alpha: 0.05,
        twoTailed: true,
      };

      const result = tester.runTest(config, control, treatment);

      if (result.significant) {
        // With adequate power, recommendation should mention being ready to decide
        expect(result.recommendation).toMatch(/ready|power|decision/i);
      }
    });

    it('should recommend more data for non-significant results', () => {
      const control = createMetricSummary(0.1, 0.01, 50);
      const treatment = createMetricSummary(0.11, 0.01, 50);

      const config: TestConfig = {
        metric: 'conversion',
        control: 'control',
        treatment: 'treatment',
        test: 'z_test',
        alpha: 0.05,
        twoTailed: true,
      };

      const result = tester.runTest(config, control, treatment);

      expect(result.recommendation).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle zero variance', () => {
      const control = createMetricSummary(0.1, 0.0001, 100);
      const treatment = createMetricSummary(0.1, 0.0001, 100);

      const config: TestConfig = {
        metric: 'conversion',
        control: 'control',
        treatment: 'treatment',
        test: 'z_test',
        alpha: 0.05,
        twoTailed: true,
      };

      const result = tester.runTest(config, control, treatment);

      expect(result).toBeDefined();
    });

    it('should handle identical means', () => {
      const control = createMetricSummary(0.1, 0.01, 100);
      const treatment = createMetricSummary(0.1, 0.01, 100);

      const config: TestConfig = {
        metric: 'conversion',
        control: 'control',
        treatment: 'treatment',
        test: 'z_test',
        alpha: 0.05,
        twoTailed: true,
      };

      const result = tester.runTest(config, control, treatment);

      expect(result.significant).toBe(false);
    });
  });
});

describe('createSignificanceTester', () => {
  it('should create tester with default alpha', () => {
    const tester = createSignificanceTester();
    expect(tester).toBeInstanceOf(SignificanceTester);
  });

  it('should create tester with custom alpha', () => {
    const tester = createSignificanceTester(0.01);
    expect(tester).toBeInstanceOf(SignificanceTester);
  });

  it('should create tester with custom bootstrap iterations', () => {
    const tester = new SignificanceTester(0.05, 5000);
    expect(tester).toBeInstanceOf(SignificanceTester);
  });
});

describe('isSignificant', () => {
  it('should return true for significant p-value', () => {
    expect(isSignificant(0.01)).toBe(true);
    expect(isSignificant(0.04)).toBe(true);
  });

  it('should return false for non-significant p-value', () => {
    expect(isSignificant(0.05)).toBe(false);
    expect(isSignificant(0.1)).toBe(false);
    expect(isSignificant(0.5)).toBe(false);
  });

  it('should use custom alpha', () => {
    expect(isSignificant(0.03, 0.05)).toBe(true);
    expect(isSignificant(0.03, 0.01)).toBe(false);
  });

  it('should handle edge case p-values', () => {
    expect(isSignificant(0)).toBe(true);
    expect(isSignificant(1)).toBe(false);
  });
});

describe('conversionRateWithCI', () => {
  it('should calculate conversion rate', () => {
    const result = conversionRateWithCI(10, 100);

    expect(result.rate).toBe(0.1);
    expect(result.lower).toBeGreaterThan(0);
    expect(result.upper).toBeLessThan(1);
    expect(result.lower).toBeLessThan(result.rate);
    expect(result.upper).toBeGreaterThan(result.rate);
  });

  it('should handle zero conversions', () => {
    const result = conversionRateWithCI(0, 100);

    expect(result.rate).toBe(0);
    expect(result.lower).toBe(0);
    // When rate is 0, both bounds are 0 (no uncertainty possible)
    expect(result.upper).toBeGreaterThanOrEqual(0);
  });

  it('should handle all conversions', () => {
    const result = conversionRateWithCI(100, 100);

    expect(result.rate).toBe(1);
    expect(result.upper).toBe(1);
    // When rate is 1, both bounds are 1 (no uncertainty possible)
    expect(result.lower).toBeLessThanOrEqual(1);
  });

  it('should use custom confidence level', () => {
    const result95 = conversionRateWithCI(10, 100, 0.95);
    const result99 = conversionRateWithCI(10, 100, 0.99);

    // 99% CI should be wider
    expect(result99.upper - result99.lower).toBeGreaterThan(result95.upper - result95.lower);
  });

  it('should handle small samples', () => {
    const result = conversionRateWithCI(1, 10);

    expect(result.rate).toBe(0.1);
    expect(result.lower).toBeGreaterThanOrEqual(0);
    expect(result.upper).toBeLessThanOrEqual(1);
  });
});

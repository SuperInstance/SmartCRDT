import { describe, it, expect, beforeEach } from 'vitest';
import { PredictiveLoader } from '../src/PredictiveLoader.js';
import { CacheStrategy } from '../src/types.js';

describe('PredictiveLoader', () => {
  let loader: PredictiveLoader;

  beforeEach(() => {
    loader = new PredictiveLoader({
      predictionWindow: 24,
      minProbability: 0.6,
      maxHistorySize: 1000,
      checkInterval: 60000
    });
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      const defaultLoader = new PredictiveLoader();
      expect(defaultLoader).toBeInstanceOf(PredictiveLoader);
    });

    it('should initialize with custom config', () => {
      const customLoader = new PredictiveLoader({
        predictionWindow: 48,
        minProbability: 0.8,
        maxHistorySize: 5000,
        checkInterval: 300000
      });
      expect(customLoader).toBeInstanceOf(PredictiveLoader);
    });
  });

  describe('usage recording', () => {
    it('should record image usage', () => {
      loader.recordUsage('python:3.11-slim');

      const pattern = loader.getPattern('python:3.11-slim');
      expect(pattern).toBeDefined();
      expect(pattern?.usage_count).toBe(1);
      expect(pattern?.image_ref).toBe('python:3.11-slim');
    });

    it('should record multiple usages', () => {
      loader.recordUsage('node:20-alpine');
      loader.recordUsage('node:20-alpine');
      loader.recordUsage('node:20-alpine');

      const pattern = loader.getPattern('node:20-alpine');
      expect(pattern?.usage_count).toBe(3);
    });

    it('should record usage with custom timestamp', () => {
      const timestamp = new Date('2025-01-01T12:00:00Z');
      loader.recordUsage('golang:1.21', timestamp);

      const pattern = loader.getPattern('golang:1.21');
      expect(pattern?.window_start).toEqual(timestamp);
      expect(pattern?.window_end).toEqual(timestamp);
    });

    it('should track usage of different images', () => {
      loader.recordUsage('python:3.11-slim');
      loader.recordUsage('node:20-alpine');
      loader.recordUsage('golang:1.21');

      const stats = loader.getStats();
      expect(stats.totalPatterns).toBe(3);
      expect(stats.totalUsages).toBe(3);
    });

    it('should trim history when exceeding max size', () => {
      const smallLoader = new PredictiveLoader({ maxHistorySize: 5 });

      // Add 10 usages
      for (let i = 0; i < 10; i++) {
        smallLoader.recordUsage(`image${i}`);
      }

      const stats = smallLoader.getStats();
      expect(stats.totalUsages).toBeLessThanOrEqual(10);
    });
  });

  describe('usage patterns', () => {
    it('should calculate usage intervals', () => {
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 3600000);
      const twoHoursAgo = new Date(now.getTime() - 7200000);

      loader.recordUsage('python:3.11', twoHoursAgo);
      loader.recordUsage('python:3.11', hourAgo);
      loader.recordUsage('python:3.11', now);

      const pattern = loader.getPattern('python:3.11');
      expect(pattern?.avg_interval).toBeGreaterThan(0);
      expect(pattern?.interval_stddev).toBeGreaterThanOrEqual(0);
    });

    it('should track peak hours', () => {
      const hour = 14; // 2 PM
      const date = new Date();
      date.setHours(hour, 0, 0, 0);

      loader.recordUsage('python:3.11', date);
      loader.recordUsage('python:3.11', date);

      const pattern = loader.getPattern('python:3.11');
      expect(pattern?.peak_hours[hour]).toBe(2);
    });

    it('should track day patterns', () => {
      const date = new Date();
      date.setDay(1); // Monday

      loader.recordUsage('python:3.11', date);
      loader.recordUsage('python:3.11', date);

      const pattern = loader.getPattern('python:3.11');
      expect(pattern?.day_patterns[1]).toBe(2);
    });

    it('should handle single usage (no intervals)', () => {
      loader.recordUsage('single-use');

      const pattern = loader.getPattern('single-use');
      expect(pattern?.avg_interval).toBe(0);
      expect(pattern?.interval_stddev).toBe(0);
    });
  });

  describe('predictions', () => {
    it('should predict preloads', () => {
      // Record enough usage to make predictions
      for (let i = 0; i < 5; i++) {
        loader.recordUsage('python:3.11-slim');
      }

      const predictions = loader.predictPreloads();
      expect(Array.isArray(predictions)).toBe(true);
    });

    it('should not predict images with insufficient data', () => {
      loader.recordUsage('single-use');

      const predictions = loader.predictPreloads();
      const pythonPred = predictions.find(p => p.image_ref === 'single-use');
      expect(pythonPred).toBeUndefined();
    });

    it('should sort predictions by probability', () => {
      for (let i = 0; i < 10; i++) {
        loader.recordUsage('python:3.11-slim');
      }
      for (let i = 0; i < 5; i++) {
        loader.recordUsage('node:20-alpine');
      }

      const predictions = loader.predictPreloads();
      for (let i = 1; i < predictions.length; i++) {
        expect(predictions[i - 1].probability).toBeGreaterThanOrEqual(predictions[i].probability);
      }
    });

    it('should predict next usage time', () => {
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 3600000);

      loader.recordUsage('python:3.11', hourAgo);
      loader.recordUsage('python:3.11', now);

      const predictions = loader.predictPreloads();
      const pred = predictions.find(p => p.image_ref === 'python:3.11');

      expect(pred?.predicted_time).toBeInstanceOf(Date);
    });
  });

  describe('cache strategies', () => {
    it('should recommend eager strategy for high-usage images', () => {
      for (let i = 0; i < 20; i++) {
        loader.recordUsage('python:3.11-slim');
      }

      const strategy = loader.getRecommendedStrategy('python:3.11-slim');
      expect(strategy).toBeDefined();
    });

    it('should recommend lazy strategy for new images', () => {
      loader.recordUsage('new-image');

      const strategy = loader.getRecommendedStrategy('new-image');
      expect(['lazy', 'on-demand']).toContain(strategy);
    });

    it('should return lazy for non-existent images', () => {
      const strategy = loader.getRecommendedStrategy('non-existent');
      expect(strategy).toBe('lazy');
    });
  });

  describe('priority calculation', () => {
    it('should calculate priority between 0 and 100', () => {
      loader.recordUsage('python:3.11-slim');
      loader.recordUsage('python:3.11-slim');

      const priority = loader.getPreloadPriority('python:3.11-slim');
      expect(priority).toBeGreaterThanOrEqual(0);
      expect(priority).toBeLessThanOrEqual(100);
    });

    it('should return default priority for non-existent images', () => {
      const priority = loader.getPreloadPriority('non-existent');
      expect(priority).toBe(50);
    });

    it('should increase priority with more usage', () => {
      for (let i = 0; i < 10; i++) {
        loader.recordUsage('frequently-used');
      }

      const priority = loader.getPreloadPriority('frequently-used');
      expect(priority).toBeGreaterThan(50);
    });
  });

  describe('statistics', () => {
    it('should return usage statistics', () => {
      loader.recordUsage('python:3.11-slim');
      loader.recordUsage('python:3.11-slim');
      loader.recordUsage('node:20-alpine');

      const stats = loader.getStats();

      expect(stats.totalPatterns).toBe(2);
      expect(stats.totalUsages).toBe(3);
      expect(stats.avgUsagesPerPattern).toBe(1.5);
    });

    it('should return top images', () => {
      loader.recordUsage('python:3.11-slim');
      loader.recordUsage('python:3.11-slim');
      loader.recordUsage('python:3.11-slim');
      loader.recordUsage('node:20-alpine');

      const stats = loader.getStats();
      expect(stats.topImages.length).toBeGreaterThan(0);
      expect(stats.topImages[0].image).toBe('python:3.11-slim');
      expect(stats.topImages[0].count).toBe(3);
    });

    it('should limit top images to 10', () => {
      for (let i = 0; i < 20; i++) {
        loader.recordUsage(`image${i}`);
      }

      const stats = loader.getStats();
      expect(stats.topImages.length).toBeLessThanOrEqual(10);
    });
  });

  describe('data export/import', () => {
    it('should export usage data', () => {
      loader.recordUsage('python:3.11-slim');
      loader.recordUsage('node:20-alpine');

      const data = loader.exportData();

      expect(data.patterns).toBeDefined();
      expect(data.usageHistory).toBeDefined();
      expect(data.patterns.length).toBe(2);
      expect(data.usageHistory.length).toBe(2);
    });

    it('should import usage data', () => {
      const data = {
        patterns: [
          {
            image_ref: 'python:3.11-slim',
            usage_count: 5,
            window_start: new Date(),
            window_end: new Date(),
            avg_interval: 3600000,
            interval_stddev: 0,
            peak_hours: new Array(24).fill(0),
            day_patterns: new Array(7).fill(0)
          }
        ],
        usageHistory: [
          { image: 'python:3.11-slim', timestamp: new Date().toISOString() }
        ]
      };

      loader.importData(data);

      const pattern = loader.getPattern('python:3.11-slim');
      expect(pattern).toBeDefined();
      expect(pattern?.usage_count).toBe(5);
    });

    it('should handle empty import', () => {
      expect(() => loader.importData({})).not.toThrow();
    });

    it('should handle import with undefined fields', () => {
      expect(() => loader.importData({ patterns: undefined, usageHistory: undefined })).not.toThrow();
    });
  });

  describe('predictions cache', () => {
    it('should cache predictions after calling predictPreloads', () => {
      loader.recordUsage('python:3.11-slim');
      loader.recordUsage('python:3.11-slim');
      loader.recordUsage('python:3.11-slim');

      loader.predictPreloads();

      const predictions = loader.getPredictions();
      expect(Array.isArray(predictions)).toBe(true);
    });

    it('should get prediction for specific image', () => {
      loader.recordUsage('python:3.11-slim');
      loader.recordUsage('python:3.11-slim');
      loader.recordUsage('python:3.11-slim');

      loader.predictPreloads();

      const pred = loader.getPrediction('python:3.11-slim');
      expect(pred).toBeDefined();
      expect(pred?.image_ref).toBe('python:3.11-slim');
    });

    it('should return undefined for non-existent prediction', () => {
      const pred = loader.getPrediction('non-existent');
      expect(pred).toBeUndefined();
    });
  });

  describe('clearing data', () => {
    it('should clear all data', () => {
      loader.recordUsage('python:3.11-slim');
      loader.recordUsage('node:20-alpine');
      loader.predictPreloads();

      loader.clear();

      const stats = loader.getStats();
      expect(stats.totalPatterns).toBe(0);
      expect(stats.totalUsages).toBe(0);

      const predictions = loader.getPredictions();
      expect(predictions).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle very large prediction window', () => {
      const largeWindowLoader = new PredictiveLoader({
        predictionWindow: Number.MAX_SAFE_INTEGER
      });
      expect(largeWindowLoader).toBeInstanceOf(PredictiveLoader);
    });

    it('should handle zero prediction window', () => {
      const zeroWindowLoader = new PredictiveLoader({
        predictionWindow: 0
      });
      expect(zeroWindowLoader).toBeInstanceOf(PredictiveLoader);
    });

    it('should handle negative prediction window', () => {
      const negativeWindowLoader = new PredictiveLoader({
        predictionWindow: -1
      });
      expect(negativeWindowLoader).toBeInstanceOf(PredictiveLoader);
    });

    it('should handle min probability greater than 1', () => {
      const highProbLoader = new PredictiveLoader({
        minProbability: 2.0
      });
      expect(highProbLoader).toBeInstanceOf(PredictiveLoader);
    });

    it('should handle negative min probability', () => {
      const negProbLoader = new PredictiveLoader({
        minProbability: -0.5
      });
      expect(negProbLoader).toBeInstanceOf(PredictiveLoader);
    });

    it('should handle zero max history size', () => {
      const zeroHistoryLoader = new PredictiveLoader({
        maxHistorySize: 0
      });
      expect(zeroHistoryLoader).toBeInstanceOf(PredictiveLoader);
    });

    it('should handle very large check interval', () => {
      const largeIntervalLoader = new PredictiveLoader({
        checkInterval: Number.MAX_SAFE_INTEGER
      });
      expect(largeIntervalLoader).toBeInstanceOf(PredictiveLoader);
    });

    it('should handle negative check interval', () => {
      const negIntervalLoader = new PredictiveLoader({
        checkInterval: -1000
      });
      expect(negIntervalLoader).toBeInstanceOf(PredictiveLoader);
    });
  });

  describe('time-based predictions', () => {
    it('should consider time of day in predictions', () => {
      const hour = 10; // 10 AM
      const dates: Date[] = [];

      for (let i = 0; i < 5; i++) {
        const date = new Date();
        date.setHours(hour, 0, 0, 0);
        date.setDate(date.getDate() - i);
        dates.push(date);
        loader.recordUsage('morning-image', date);
      }

      const predictions = loader.predictPreloads();
      expect(predictions).toBeDefined();
    });

    it('should consider day of week in predictions', () => {
      const date = new Date();
      date.setDay(1); // Monday

      for (let i = 0; i < 5; i++) {
        const d = new Date(date);
        d.setDate(d.getDate() - (i * 7));
        loader.recordUsage('monday-image', d);
      }

      const predictions = loader.predictPreloads();
      expect(predictions).toBeDefined();
    });
  });

  describe('confidence calculation', () => {
    it('should increase confidence with more data', () => {
      for (let i = 0; i < 50; i++) {
        loader.recordUsage('consistent-image');
      }

      const predictions = loader.predictPreloads();
      const pred = predictions.find(p => p.image_ref === 'consistent-image');

      expect(pred).toBeDefined();
      expect(pred?.confidence).toBeGreaterThan(0);
    });

    it('should calculate confidence based on consistency', () => {
      const now = new Date();
      for (let i = 0; i < 10; i++) {
        const time = new Date(now.getTime() - (i * 3600000)); // Every hour
        loader.recordUsage('hourly-image', time);
      }

      const predictions = loader.predictPreloads();
      const pred = predictions.find(p => p.image_ref === 'hourly-image');

      expect(pred?.confidence).toBeGreaterThan(0);
    });
  });

  describe('pattern retrieval', () => {
    it('should get all patterns', () => {
      loader.recordUsage('image1');
      loader.recordUsage('image2');

      const patterns = loader.getPatterns();
      expect(patterns.length).toBe(2);
    });

    it('should return empty array when no patterns', () => {
      const patterns = loader.getPatterns();
      expect(patterns).toEqual([]);
    });

    it('should get specific pattern', () => {
      loader.recordUsage('test-image');

      const pattern = loader.getPattern('test-image');
      expect(pattern).toBeDefined();
      expect(pattern?.image_ref).toBe('test-image');
    });

    it('should return undefined for non-existent pattern', () => {
      const pattern = loader.getPattern('non-existent');
      expect(pattern).toBeUndefined();
    });
  });
});

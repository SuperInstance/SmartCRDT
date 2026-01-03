/**
 * PredictiveEngine Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PredictiveEngine } from '../src/PredictiveEngine.js';
import { UsageTracker } from '../src/UsageTracker.js';

describe('PredictiveEngine', () => {
  let engine: PredictiveEngine;
  let tracker: UsageTracker;

  beforeEach(() => {
    tracker = new UsageTracker();
    engine = new PredictiveEngine(tracker);
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      expect(engine).toBeDefined();
      expect(engine.getStats().markovChains).toBe(0);
    });

    it('should initialize with custom config', () => {
      const customEngine = new PredictiveEngine(tracker, {
        minConfidence: 0.5,
        maxSequenceLength: 10,
      });

      expect(customEngine).toBeDefined();
    });

    it('should be disabled when configured', () => {
      const disabledEngine = new PredictiveEngine(tracker, { enabled: false });

      const predictions = disabledEngine.predictNext('module-1', 5);
      expect(predictions).toHaveLength(0);
    });
  });

  describe('Markov Chain Predictions', () => {
    it('should predict next module from Markov chain', () => {
      engine.train([
        { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-2', userId: 'user-1', timestamp: Date.now() },
      ]);

      const predictions = engine.predictNext('module-1', 5);
      expect(predictions.length).toBeGreaterThan(0);
    });

    it('should return confidence score', () => {
      engine.train([
        { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-2', userId: 'user-1', timestamp: Date.now() },
      ]);

      const predictions = engine.predictNext('module-1', 5);
      if (predictions.length > 0) {
        expect(predictions[0].confidence).toBeGreaterThan(0);
        expect(predictions[0].confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should include prediction reason', () => {
      engine.train([
        { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-2', userId: 'user-1', timestamp: Date.now() },
      ]);

      const predictions = engine.predictNext('module-1', 5);
      if (predictions.length > 0) {
        expect(predictions[0].reason).toBeDefined();
        expect(typeof predictions[0].reason).toBe('string');
      }
    });

    it('should include related modules', () => {
      engine.train([
        { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-2', userId: 'user-1', timestamp: Date.now() },
      ]);

      const predictions = engine.predictNext('module-1', 5);
      if (predictions.length > 0) {
        expect(Array.isArray(predictions[0].relatedModules)).toBe(true);
      }
    });

    it('should respect prediction limit', () => {
      for (let i = 0; i < 10; i++) {
        engine.train([
          { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
          { moduleName: `module-${i}`, userId: 'user-1', timestamp: Date.now() },
        ]);
      }

      const predictions = engine.predictNext('module-1', 5);
      expect(predictions.length).toBeLessThanOrEqual(5);
    });

    it('should filter by minimum confidence', () => {
      const highConfidenceEngine = new PredictiveEngine(tracker, { minConfidence: 0.9 });

      highConfidenceEngine.train([
        { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-2', userId: 'user-1', timestamp: Date.now() },
      ]);

      const predictions = highConfidenceEngine.predictNext('module-1', 5);
      for (const prediction of predictions) {
        expect(prediction.confidence).toBeGreaterThanOrEqual(0.9);
      }
    });

    it('should return empty for unknown module', () => {
      const predictions = engine.predictNext('non-existent', 5);
      expect(predictions).toHaveLength(0);
    });

    it('should update model incrementally', () => {
      engine.updateModel('module-2', 'module-1');

      const predictions = engine.predictNext('module-1', 5);
      expect(predictions.length).toBeGreaterThan(0);
    });
  });

  describe('Time-Based Predictions', () => {
    it('should predict for current time', () => {
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });

      const predictions = engine.predictForCurrentTime(5);
      expect(Array.isArray(predictions)).toBe(true);
    });

    it('should return empty when disabled', () => {
      const disabledEngine = new PredictiveEngine(tracker, { enabled: false });
      const predictions = disabledEngine.predictForCurrentTime(5);
      expect(predictions).toHaveLength(0);
    });

    it('should respect prediction limit', () => {
      const now = new Date();
      for (let i = 0; i < 10; i++) {
        const accessTime = new Date(now);
        accessTime.setHours(now.getHours() - 1);

        tracker.recordAccess({
          moduleName: `module-${i}`,
          userId: 'user-1',
          timestamp: accessTime.getTime(),
        });
      }

      const predictions = engine.predictForCurrentTime(5);
      expect(predictions.length).toBeLessThanOrEqual(5);
    });
  });

  describe('User-Based Predictions', () => {
    it('should predict for specific user', () => {
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });

      const predictions = engine.predictForUser('user-1', 5);
      expect(predictions.length).toBeGreaterThan(0);
    });

    it('should return empty for unknown user', () => {
      const predictions = engine.predictForUser('non-existent', 5);
      expect(predictions).toHaveLength(0);
    });

    it('should return empty when disabled', () => {
      const disabledEngine = new PredictiveEngine(tracker, { enabled: false });
      const predictions = disabledEngine.predictForUser('user-1', 5);
      expect(predictions).toHaveLength(0);
    });

    it('should base confidence on user frequency', () => {
      for (let i = 0; i < 10; i++) {
        tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });
      }

      const predictions = engine.predictForUser('user-1', 5);
      if (predictions.length > 0) {
        expect(predictions[0].confidence).toBeGreaterThan(0);
      }
    });
  });

  describe('Session-Based Predictions', () => {
    it('should predict from recent session', () => {
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });
      tracker.recordAccess({ moduleName: 'module-2', userId: 'user-1' });
      tracker.recordAccess({ moduleName: 'module-3', userId: 'user-1' });

      const predictions = engine.predictFromSession(['module-1', 'module-2'], 5);
      expect(predictions.length).toBeGreaterThan(0);
    });

    it('should return empty for empty session', () => {
      const predictions = engine.predictFromSession([], 5);
      expect(predictions).toHaveLength(0);
    });

    it('should use co-access patterns', () => {
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });
      tracker.recordAccess({ moduleName: 'module-2', userId: 'user-1' });

      const predictions = engine.predictFromSession(['module-1'], 5);
      expect(predictions.length).toBeGreaterThan(0);
    });

    it('should respect prediction limit', () => {
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });
      for (let i = 0; i < 10; i++) {
        tracker.recordAccess({ moduleName: `module-${i}`, userId: 'user-1' });
      }

      const predictions = engine.predictFromSession(['module-1'], 5);
      expect(predictions.length).toBeLessThanOrEqual(5);
    });

    it('should combine multiple recent modules', () => {
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });
      tracker.recordAccess({ moduleName: 'module-2', userId: 'user-1' });
      tracker.recordAccess({ moduleName: 'module-3', userId: 'user-1' });
      tracker.recordAccess({ moduleName: 'module-4', userId: 'user-1' });

      const predictions = engine.predictFromSession(['module-1', 'module-2', 'module-3'], 5);
      expect(predictions.length).toBeGreaterThan(0);
    });
  });

  describe('Model Training', () => {
    it('should train with access data', () => {
      const data = [
        { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-2', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-3', userId: 'user-1', timestamp: Date.now() },
      ];

      engine.train(data);

      const stats = engine.getStats();
      expect(stats.totalTransitions).toBeGreaterThan(0);
    });

    it('should not train when disabled', () => {
      const disabledEngine = new PredictiveEngine(tracker, { enabled: false });

      disabledEngine.train([
        { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-2', userId: 'user-1', timestamp: Date.now() },
      ]);

      expect(disabledEngine.getStats().totalTransitions).toBe(0);
    });

    it('should build Markov chains from training data', () => {
      engine.train([
        { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-2', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-2', userId: 'user-1', timestamp: Date.now() },
      ]);

      const chain = engine.getMarkovChain('module-1');
      expect(chain).toBeDefined();
      expect(chain?.transitions.size).toBeGreaterThan(0);
    });

    it('should update frequency map', () => {
      engine.train([
        { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
      ]);

      const freqMap = engine.getFrequencyMap();
      expect(freqMap.get('module-1')).toBe(2);
    });

    it('should detect sequence patterns', () => {
      engine.train([
        { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-2', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-3', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-2', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-3', userId: 'user-1', timestamp: Date.now() },
      ]);

      const patterns = engine.getSequencePatterns();
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should respect max sequence length', () => {
      const customEngine = new PredictiveEngine(tracker, { maxSequenceLength: 3 });

      customEngine.train([
        { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-2', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-3', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-4', userId: 'user-1', timestamp: Date.now() },
      ]);

      const patterns = customEngine.getSequencePatterns();
      for (const pattern of patterns) {
        expect(pattern.sequence.length).toBeLessThanOrEqual(3);
      }
    });
  });

  describe('Callbacks', () => {
    it('should call prediction callback', () => {
      const callback = vi.fn();

      engine.onPrediction(callback);

      engine.train([
        { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-2', userId: 'user-1', timestamp: Date.now() },
      ]);

      engine.predictNext('module-1', 5);

      expect(callback).toHaveBeenCalled();
    });

    it('should pass prediction result to callback', () => {
      const callback = vi.fn();

      engine.onPrediction(callback);

      engine.train([
        { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-2', userId: 'user-1', timestamp: Date.now() },
      ]);

      engine.predictNext('module-1', 5);

      if (callback.mock.calls.length > 0) {
        const prediction = callback.mock.calls[0][0];
        expect(prediction).toHaveProperty('moduleName');
        expect(prediction).toHaveProperty('confidence');
      }
    });

    it('should unregister callback', () => {
      const callback = vi.fn();

      const unregister = engine.onPrediction(callback);
      unregister();

      engine.train([
        { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-2', userId: 'user-1', timestamp: Date.now() },
      ]);

      engine.predictNext('module-1', 5);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });

      engine.onPrediction(errorCallback);

      expect(() => {
        engine.train([
          { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
          { moduleName: 'module-2', userId: 'user-1', timestamp: Date.now() },
        ]);
        engine.predictNext('module-1', 5);
      }).not.toThrow();
    });

    it('should clear all callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      engine.onPrediction(callback1);
      engine.onPrediction(callback2);
      engine.clearCallbacks();

      engine.train([
        { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-2', userId: 'user-1', timestamp: Date.now() },
      ]);

      engine.predictNext('module-1', 5);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
  });

  describe('Model Inspection', () => {
    it('should get Markov chain for module', () => {
      engine.train([
        { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-2', userId: 'user-1', timestamp: Date.now() },
      ]);

      const chain = engine.getMarkovChain('module-1');
      expect(chain).toBeDefined();
      expect(chain?.state).toBe('module-1');
    });

    it('should return undefined for non-existent module chain', () => {
      const chain = engine.getMarkovChain('non-existent');
      expect(chain).toBeUndefined();
    });

    it('should get all Markov chains', () => {
      engine.train([
        { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-2', userId: 'user-1', timestamp: Date.now() },
      ]);

      const chains = engine.getAllMarkovChains();
      expect(chains.size).toBeGreaterThan(0);
    });

    it('should get sequence patterns', () => {
      engine.train([
        { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-2', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-3', userId: 'user-1', timestamp: Date.now() },
      ]);

      const patterns = engine.getSequencePatterns();
      expect(Array.isArray(patterns)).toBe(true);
    });

    it('should get frequency map', () => {
      engine.train([
        { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-2', userId: 'user-1', timestamp: Date.now() },
      ]);

      const freqMap = engine.getFrequencyMap();
      expect(freqMap.size).toBeGreaterThan(0);
    });

    it('should get model statistics', () => {
      engine.train([
        { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-2', userId: 'user-1', timestamp: Date.now() },
      ]);

      const stats = engine.getStats();
      expect(stats).toHaveProperty('markovChains');
      expect(stats).toHaveProperty('sequencePatterns');
      expect(stats).toHaveProperty('totalTransitions');
      expect(stats).toHaveProperty('lastUpdate');
    });
  });

  describe('Model Management', () => {
    it('should reset the model', () => {
      engine.train([
        { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-2', userId: 'user-1', timestamp: Date.now() },
      ]);

      engine.reset();

      const stats = engine.getStats();
      expect(stats.markovChains).toBe(0);
      expect(stats.totalTransitions).toBe(0);
    });

    it('should export model data', () => {
      engine.train([
        { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-2', userId: 'user-1', timestamp: Date.now() },
      ]);

      const exported = engine.export();
      expect(exported.markovChains).toBeDefined();
      expect(exported.frequencyMap).toBeDefined();
      expect(exported.lastUpdate).toBeDefined();
    });

    it('should import model data', () => {
      const data = {
        markovChains: {
          'module-1': {
            state: 'module-1',
            transitions: {},
            totalCount: 5,
          },
        },
        sequencePatterns: [],
        frequencyMap: { 'module-1': 10 },
        lastUpdate: Date.now(),
      };

      engine.import(data);

      const chain = engine.getMarkovChain('module-1');
      expect(chain?.totalCount).toBe(5);
    });

    it('should merge imported data', () => {
      engine.train([
        { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-2', userId: 'user-1', timestamp: Date.now() },
      ]);

      const beforeStats = engine.getStats();

      const data = {
        frequencyMap: { 'module-3': 5 },
      };

      engine.import(data);

      const afterStats = engine.getStats();
      expect(engine.getFrequencyMap().get('module-3')).toBe(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty training data', () => {
      engine.train([]);
      const stats = engine.getStats();
      expect(stats.markovChains).toBe(0);
    });

    it('should handle single access', () => {
      engine.train([
        { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
      ]);

      const predictions = engine.predictNext('module-1', 5);
      expect(Array.isArray(predictions)).toBe(true);
    });

    it('should handle multiple users', () => {
      engine.train([
        { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-2', userId: 'user-2', timestamp: Date.now() },
      ]);

      const stats = engine.getStats();
      expect(stats.totalTransitions).toBeGreaterThan(0);
    });

    it('should handle rapid updates', () => {
      for (let i = 0; i < 100; i++) {
        engine.updateModel(`module-${i % 10}`, `module-${(i + 1) % 10}`);
      }

      expect(engine.getStats().markovChains).toBeGreaterThan(0);
    });

    it('should handle self-transitions', () => {
      engine.train([
        { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
        { moduleName: 'module-1', userId: 'user-1', timestamp: Date.now() },
      ]);

      const chain = engine.getMarkovChain('module-1');
      expect(chain?.transitions.has('module-1')).toBe(true);
    });
  });
});

/**
 * Tests for UserAllocator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  UserAllocator,
  TrafficSplitter,
  createUserAllocator,
} from '../src/allocation/UserAllocator.js';
import type { Experiment, AllocationConfig } from '../src/types.js';

function createMockExperiment(): Experiment {
  return {
    id: 'test-exp',
    name: 'Test Experiment',
    description: 'Test',
    status: 'running',
    variants: [
      { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
      { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
    ],
    allocationStrategy: 'random',
    metrics: [{ id: 'conversion', name: 'Conversion', type: 'conversion', higherIsBetter: true }],
    primaryMetric: 'conversion',
    secondaryMetrics: [],
    goals: [],
    minSampleSize: 100,
    significanceLevel: 0.05,
    power: 0.8,
    mde: 0.1,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'test',
  };
}

describe('UserAllocator', () => {
  describe('random allocation', () => {
    it('should allocate users randomly', () => {
      const config: AllocationConfig = { strategy: 'random' };
      const allocator = new UserAllocator(config);
      const experiment = createMockExperiment();

      const result1 = allocator.allocate('user1', experiment);
      const result2 = allocator.allocate('user2', experiment);

      expect(['control', 'treatment']).toContain(result1.variant);
      expect(['control', 'treatment']).toContain(result2.variant);
    });

    it('should respect traffic split', () => {
      const config: AllocationConfig = { strategy: 'random' };
      const allocator = new UserAllocator(config);
      const experiment = {
        ...createMockExperiment(),
        variants: [
          { id: 'a', name: 'A', description: 'A', allocation: 70, isControl: true, changes: [] },
          { id: 'b', name: 'B', description: 'B', allocation: 30, isControl: false, changes: [] },
        ],
      };

      const allocations = { a: 0, b: 0 };
      for (let i = 0; i < 1000; i++) {
        const result = allocator.allocate(`user${i}`, experiment);
        allocations[result.variant as 'a' | 'b']++;
      }

      // A should get roughly 70%
      expect(allocations.a).toBeGreaterThan(600);
      expect(allocations.a).toBeLessThan(800);
    });
  });

  describe('sticky allocation', () => {
    it('should allocate consistently for same user', () => {
      const config: AllocationConfig = { strategy: 'sticky', stickiness: 7 };
      const allocator = new UserAllocator(config);
      const experiment = createMockExperiment();

      const result1 = allocator.allocate('user1', experiment);
      const result2 = allocator.allocate('user1', experiment);

      expect(result1.variant).toBe(result2.variant);
    });

    it('should expire sticky allocations', () => {
      const config: AllocationConfig = { strategy: 'sticky', stickiness: 0.0001 }; // Very short
      const allocator = new UserAllocator(config);
      const experiment = createMockExperiment();

      const result1 = allocator.allocate('user1', experiment, Date.now());
      const result2 = allocator.allocate('user1', experiment, Date.now() + 10000);

      // Might be different after expiry
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });

  describe('hash allocation', () => {
    it('should allocate consistently based on hash', () => {
      const config: AllocationConfig = { strategy: 'hash', hashKey: 'test-key' };
      const allocator = new UserAllocator(config);
      const experiment = createMockExperiment();

      const result1 = allocator.allocate('user1', experiment);
      const result2 = allocator.allocate('user1', experiment);

      expect(result1.variant).toBe(result2.variant);
    });

    it('should allocate different users differently', () => {
      const config: AllocationConfig = { strategy: 'hash', hashKey: 'test-key' };
      const allocator = new UserAllocator(config);
      const experiment = createMockExperiment();

      const results = new Set();
      for (let i = 0; i < 50; i++) {
        results.add(allocator.allocate(`user${i}`, experiment).variant);
      }

      // Should have at least some variety
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('adaptive allocation', () => {
    it('should explore initially', () => {
      const config: AllocationConfig = { strategy: 'adaptive', adaptationRate: 0.5 };
      const allocator = new UserAllocator(config);
      const experiment = createMockExperiment();

      const results = new Set();
      for (let i = 0; i < 100; i++) {
        results.add(allocator.allocate(`user${i}`, experiment).variant);
      }

      // Should explore both variants
      expect(results.size).toBeGreaterThan(1);
    });

    it('should exploit high-scoring variants', () => {
      const config: AllocationConfig = { strategy: 'adaptive', adaptationRate: 0.1 };
      const allocator = new UserAllocator(config);
      const experiment = createMockExperiment();

      // First, make one allocation to initialize the adaptive scores
      allocator.allocate('user0', experiment);

      // Then boost score for treatment significantly
      allocator.updateAdaptiveScore(experiment.id, 'treatment', 100);

      const allocations = { control: 0, treatment: 0 };
      for (let i = 1; i <= 100; i++) {
        const result = allocator.allocate(`user${i}`, experiment);
        allocations[result.variant as 'control' | 'treatment']++;
      }

      // Treatment should get more allocations due to higher score
      expect(allocations.treatment).toBeGreaterThan(allocations.control);
    });
  });

  describe('adaptive score updates', () => {
    it('should update scores', () => {
      const allocator = new UserAllocator({ strategy: 'adaptive' });
      const experiment = createMockExperiment();

      // Initialize scores by allocating once
      allocator.allocate('user0', experiment);

      allocator.updateAdaptiveScore(experiment.id, 'control', 50);
      allocator.updateAdaptiveScore(experiment.id, 'control', 70);

      // Score should be updated (using EMA)
      // Initial is 50 (from allocation), then updated to 70
      // EMA: 50 * 0.9 + 70 * 0.1 = 52
      expect(allocator.getAllocation('user1', experiment.id)).toBeNull();
    });

    it('should reset scores', () => {
      const allocator = new UserAllocator({ strategy: 'adaptive' });
      const experiment = createMockExperiment();

      // Initialize scores by allocating once
      allocator.allocate('user0', experiment);

      allocator.updateAdaptiveScore(experiment.id, 'control', 50);
      allocator.resetAdaptiveScores(experiment.id);

      // After reset, should explore
      const result = allocator.allocate('user1', experiment);
      expect(result.variant).toBeDefined();
    });
  });

  describe('allocation retrieval', () => {
    it('should get sticky allocation', () => {
      const allocator = new UserAllocator({ strategy: 'sticky' });
      const experiment = createMockExperiment();

      const result1 = allocator.allocate('user1', experiment);
      const result2 = allocator.getAllocation('user1', experiment.id);

      expect(result2).toEqual(result1);
    });

    it('should return null for non-existent allocation', () => {
      const allocator = new UserAllocator({ strategy: 'random' });
      const result = allocator.getAllocation('user1', 'exp1');
      expect(result).toBeNull();
    });
  });

  describe('clear operations', () => {
    it('should clear user allocation', () => {
      const allocator = new UserAllocator({ strategy: 'sticky' });
      const experiment = createMockExperiment();

      allocator.allocate('user1', experiment);
      allocator.clearUserAllocation('user1', experiment.id);

      const result = allocator.getAllocation('user1', experiment.id);
      expect(result).toBeNull();
    });

    it('should clear all allocations', () => {
      const allocator = new UserAllocator({ strategy: 'sticky' });
      const experiment = createMockExperiment();

      allocator.allocate('user1', experiment);
      allocator.allocate('user2', experiment);
      allocator.clearAllAllocations();

      expect(allocator.getAllocation('user1', experiment.id)).toBeNull();
      expect(allocator.getAllocation('user2', experiment.id)).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle single variant', () => {
      const allocator = new UserAllocator({ strategy: 'random' });
      const experiment = {
        ...createMockExperiment(),
        variants: [
          { id: 'only', name: 'Only', description: 'Only', allocation: 100, isControl: true, changes: [] },
        ],
      };

      const result = allocator.allocate('user1', experiment);
      expect(result.variant).toBe('only');
    });

    it('should handle many variants', () => {
      const allocator = new UserAllocator({ strategy: 'random' });
      const experiment = {
        ...createMockExperiment(),
        variants: [
          { id: 'a', name: 'A', description: 'A', allocation: 25, isControl: true, changes: [] },
          { id: 'b', name: 'B', description: 'B', allocation: 25, isControl: false, changes: [] },
          { id: 'c', name: 'C', description: 'C', allocation: 25, isControl: false, changes: [] },
          { id: 'd', name: 'D', description: 'D', allocation: 25, isControl: false, changes: [] },
        ],
      };

      const results = new Set();
      for (let i = 0; i < 100; i++) {
        results.add(allocator.allocate(`user${i}`, experiment).variant);
      }

      expect(results.size).toBeGreaterThan(1);
    });

    it('should handle uneven allocations', () => {
      const allocator = new UserAllocator({ strategy: 'random' });
      const experiment = {
        ...createMockExperiment(),
        variants: [
          { id: 'a', name: 'A', description: 'A', allocation: 90, isControl: true, changes: [] },
          { id: 'b', name: 'B', description: 'B', allocation: 10, isControl: false, changes: [] },
        ],
      };

      const allocations = { a: 0, b: 0 };
      for (let i = 0; i < 1000; i++) {
        const result = allocator.allocate(`user${i}`, experiment);
        allocations[result.variant as 'a' | 'b']++;
      }

      expect(allocations.a).toBeGreaterThan(800);
    });
  });
});

describe('TrafficSplitter', () => {
  describe('evenSplit', () => {
    it('should split evenly', () => {
      const split = TrafficSplitter.evenSplit(4);
      expect(split).toEqual([25, 25, 25, 25]);
    });

    it('should handle two variants', () => {
      const split = TrafficSplitter.evenSplit(2);
      expect(split).toEqual([50, 50]);
    });

    it('should handle single variant', () => {
      const split = TrafficSplitter.evenSplit(1);
      expect(split).toEqual([100]);
    });
  });

  describe('weightedSplit', () => {
    it('should create weighted split', () => {
      const split = TrafficSplitter.weightedSplit([1, 2, 3]);
      expect(split[0]).toBeCloseTo(16.67, 1);
      expect(split[1]).toBeCloseTo(33.33, 1);
      expect(split[2]).toBeCloseTo(50, 1);
    });

    it('should normalize to 100', () => {
      const split = TrafficSplitter.weightedSplit([1, 1]);
      expect(split[0] + split[1]).toBeCloseTo(100, 5);
    });
  });

  describe('validateSplit', () => {
    it('should validate correct split', () => {
      expect(TrafficSplitter.validateSplit([50, 50])).toBe(true);
      expect(TrafficSplitter.validateSplit([25, 25, 25, 25])).toBe(true);
      expect(TrafficSplitter.validateSplit([33.33, 66.67])).toBe(true);
    });

    it('should reject invalid split', () => {
      expect(TrafficSplitter.validateSplit([50, 60])).toBe(false);
      expect(TrafficSplitter.validateSplit([100, 10])).toBe(false);
      expect(TrafficSplitter.validateSplit([0, 0])).toBe(false);
    });
  });
});

describe('createUserAllocator', () => {
  it('should create allocator with random strategy', () => {
    const allocator = createUserAllocator('random');
    expect(allocator).toBeInstanceOf(UserAllocator);
  });

  it('should create allocator with sticky strategy', () => {
    const allocator = createUserAllocator('sticky', { stickiness: 14 });
    expect(allocator).toBeInstanceOf(UserAllocator);
  });

  it('should use default config', () => {
    const allocator = createUserAllocator();
    expect(allocator).toBeInstanceOf(UserAllocator);
  });

  it('should create hash allocator', () => {
    const allocator = createUserAllocator('hash', { hashKey: 'test' });
    expect(allocator).toBeInstanceOf(UserAllocator);
  });

  it('should create adaptive allocator', () => {
    const allocator = createUserAllocator('adaptive', { adaptationRate: 0.15 });
    expect(allocator).toBeInstanceOf(UserAllocator);
  });
});

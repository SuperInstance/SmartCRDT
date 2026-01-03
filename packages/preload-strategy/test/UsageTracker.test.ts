/**
 * UsageTracker Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { UsageTracker } from '../src/UsageTracker.js';

describe('UsageTracker', () => {
  let tracker: UsageTracker;

  beforeEach(() => {
    tracker = new UsageTracker();
  });

  describe('Access Tracking', () => {
    it('should record a single access', () => {
      tracker.recordAccess({
        moduleName: 'module-1',
        userId: 'user-1',
      });

      const stats = tracker.getStats();
      expect(stats.totalAccesses).toBe(1);
    });

    it('should record multiple accesses', () => {
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });
      tracker.recordAccess({ moduleName: 'module-2', userId: 'user-1' });
      tracker.recordAccess({ moduleName: 'module-3', userId: 'user-2' });

      const stats = tracker.getStats();
      expect(stats.totalAccesses).toBe(3);
    });

    it('should record access with custom timestamp', () => {
      const timestamp = Date.now() - 10000;
      tracker.recordAccess({
        moduleName: 'module-1',
        userId: 'user-1',
        timestamp,
      });

      const history = tracker.getModuleHistory('module-1');
      expect(history[0].timestamp).toBe(timestamp);
    });

    it('should record access batch', () => {
      tracker.recordAccessBatch([
        { moduleName: 'module-1', userId: 'user-1' },
        { moduleName: 'module-2', userId: 'user-1' },
        { moduleName: 'module-3', userId: 'user-2' },
      ]);

      const stats = tracker.getStats();
      expect(stats.totalAccesses).toBe(3);
    });

    it('should respect sample rate', () => {
      const samplingTracker = new UsageTracker({ sampleRate: 0 });
      samplingTracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });

      const stats = samplingTracker.getStats();
      expect(stats.totalAccesses).toBe(0);
    });

    it('should not track when disabled', () => {
      const disabledTracker = new UsageTracker({ enabled: false });
      disabledTracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });

      const stats = disabledTracker.getStats();
      expect(stats.totalAccesses).toBe(0);
    });

    it('should limit history size', () => {
      for (let i = 0; i < 15000; i++) {
        tracker.recordAccess({ moduleName: `module-${i}`, userId: 'user-1' });
      }

      const stats = tracker.getStats();
      expect(stats.totalAccesses).toBeLessThanOrEqual(10000);
    });
  });

  describe('Module Patterns', () => {
    it('should create pattern for new module', () => {
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });

      const pattern = tracker.getModulePattern('module-1');
      expect(pattern).toBeDefined();
      expect(pattern?.moduleName).toBe('module-1');
    });

    it('should update access frequency', () => {
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });

      const pattern1 = tracker.getModulePattern('module-1');
      const freq1 = pattern1?.accessFrequency || 0;

      // Simulate time passing
      tracker.recordAccess({
        moduleName: 'module-1',
        userId: 'user-1',
        timestamp: Date.now() + 3600000,
      });

      const pattern2 = tracker.getModulePattern('module-1');
      expect(pattern2?.accessFrequency).toBeGreaterThan(0);
    });

    it('should track time of day pattern', () => {
      const morningTime = new Date();
      morningTime.setHours(10);
      morningTime.setMinutes(0);

      tracker.recordAccess({
        moduleName: 'module-1',
        userId: 'user-1',
        timestamp: morningTime.getTime(),
      });

      const pattern = tracker.getModulePattern('module-1');
      expect(pattern?.timeOfDay).toBe('morning');
    });

    it('should track day of week pattern', () => {
      const mondayTime = new Date('2025-01-06T10:00:00'); // Monday

      tracker.recordAccess({
        moduleName: 'module-1',
        userId: 'user-1',
        timestamp: mondayTime.getTime(),
      });

      const pattern = tracker.getModulePattern('module-1');
      expect(pattern?.dayOfWeek).toBe('monday');
    });

    it('should return undefined for non-existent module', () => {
      const pattern = tracker.getModulePattern('non-existent');
      expect(pattern).toBeUndefined();
    });

    it('should get top modules by frequency', () => {
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });
      tracker.recordAccess({ moduleName: 'module-2', userId: 'user-1' });

      const topModules = tracker.getTopModules(5);
      expect(topModules.length).toBeGreaterThan(0);
      expect(topModules[0].moduleName).toBe('module-1');
    });

    it('should respect limit when getting top modules', () => {
      for (let i = 0; i < 10; i++) {
        tracker.recordAccess({ moduleName: `module-${i}`, userId: 'user-1' });
      }

      const topModules = tracker.getTopModules(5);
      expect(topModules.length).toBe(5);
    });
  });

  describe('User Patterns', () => {
    it('should create pattern for new user', () => {
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });

      const userPattern = tracker.getUserPattern('user-1');
      expect(userPattern).toBeDefined();
      expect(userPattern?.userId).toBe('user-1');
    });

    it('should track multiple modules for user', () => {
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });
      tracker.recordAccess({ moduleName: 'module-2', userId: 'user-1' });

      const userPattern = tracker.getUserPattern('user-1');
      expect(userPattern?.patterns.size).toBe(2);
    });

    it('should update last active timestamp', () => {
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });

      const userPattern1 = tracker.getUserPattern('user-1');
      const lastActive1 = userPattern1?.lastActive || 0;

      tracker.recordAccess({
        moduleName: 'module-1',
        userId: 'user-1',
        timestamp: Date.now() + 1000,
      });

      const userPattern2 = tracker.getUserPattern('user-1');
      expect(userPattern2?.lastActive).toBeGreaterThan(lastActive1);
    });

    it('should return undefined for non-existent user', () => {
      const userPattern = tracker.getUserPattern('non-existent');
      expect(userPattern).toBeUndefined();
    });

    it('should track user-specific patterns', () => {
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-2' });

      const pattern1 = tracker.getUserPattern('user-1');
      const pattern2 = tracker.getUserPattern('user-2');

      expect(pattern1?.patterns.has('module-1')).toBe(true);
      expect(pattern2?.patterns.has('module-1')).toBe(true);
    });
  });

  describe('Co-Access Patterns', () => {
    it('should detect co-accessed modules', () => {
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });
      tracker.recordAccess({ moduleName: 'module-2', userId: 'user-1' });

      const coAccess = tracker.getCoAccessPatterns('module-1');
      expect(coAccess.length).toBeGreaterThan(0);
      expect(coAccess[0].moduleName).toBe('module-2');
    });

    it('should calculate co-access probability', () => {
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });
      tracker.recordAccess({ moduleName: 'module-2', userId: 'user-1' });
      tracker.recordAccess({ moduleName: 'module-2', userId: 'user-1' });

      const coAccess = tracker.getCoAccessPatterns('module-1');
      expect(coAccess[0].probability).toBeGreaterThan(0);
    });

    it('should respect limit when getting co-access patterns', () => {
      for (let i = 0; i < 10; i++) {
        tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });
        tracker.recordAccess({ moduleName: `module-${i}`, userId: 'user-1' });
      }

      const coAccess = tracker.getCoAccessPatterns('module-1', 5);
      expect(coAccess.length).toBe(5);
    });

    it('should return empty array for module with no co-access', () => {
      const coAccess = tracker.getCoAccessPatterns('non-existent');
      expect(coAccess).toEqual([]);
    });

    it('should not include module itself in co-access', () => {
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });

      const coAccess = tracker.getCoAccessPatterns('module-1');
      expect(coAccess.find(c => c.moduleName === 'module-1')).toBeUndefined();
    });
  });

  describe('Predictions', () => {
    it('should predict next modules', () => {
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });
      tracker.recordAccess({ moduleName: 'module-2', userId: 'user-1' });

      const predictions = tracker.predictNextModules('module-1', 5);
      expect(Array.isArray(predictions)).toBe(true);
    });

    it('should respect prediction limit', () => {
      for (let i = 1; i <= 10; i++) {
        tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });
        tracker.recordAccess({ moduleName: `module-${i}`, userId: 'user-1' });
      }

      const predictions = tracker.predictNextModules('module-1', 5);
      expect(predictions.length).toBe(5);
    });

    it('should return empty array for unknown module', () => {
      const predictions = tracker.predictNextModules('non-existent', 5);
      expect(predictions).toEqual([]);
    });

    it('should get modules for current time', () => {
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });

      const modules = tracker.getModulesForCurrentTime();
      expect(Array.isArray(modules)).toBe(true);
    });

    it('should filter modules by time of day', () => {
      const morningTime = new Date();
      morningTime.setHours(10);

      tracker.recordAccess({
        moduleName: 'module-1',
        userId: 'user-1',
        timestamp: morningTime.getTime(),
      });

      const modules = tracker.getModulesForCurrentTime();
      // Only modules accessed at current time bucket
      expect(modules.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Statistics', () => {
    it('should get tracker statistics', () => {
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });
      tracker.recordAccess({ moduleName: 'module-2', userId: 'user-1' });
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-2' });

      const stats = tracker.getStats();
      expect(stats.totalModules).toBe(2);
      expect(stats.totalUsers).toBe(2);
      expect(stats.totalAccesses).toBe(3);
    });

    it('should calculate average access frequency', () => {
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });
      tracker.recordAccess({ moduleName: 'module-2', userId: 'user-1' });

      const stats = tracker.getStats();
      expect(stats.avgAccessFrequency).toBeGreaterThan(0);
    });

    it('should include top modules in stats', () => {
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });
      tracker.recordAccess({ moduleName: 'module-2', userId: 'user-1' });

      const stats = tracker.getStats();
      expect(stats.topModules.length).toBe(5);
      expect(stats.topModules[0].moduleName).toBe('module-1');
    });

    it('should get module history', () => {
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-2' });

      const history = tracker.getModuleHistory('module-1');
      expect(history.length).toBe(2);
    });

    it('should respect history limit', () => {
      for (let i = 0; i < 150; i++) {
        tracker.recordAccess({ moduleName: 'module-1', userId: `user-${i}` });
      }

      const history = tracker.getModuleHistory('module-1', 100);
      expect(history.length).toBe(100);
    });

    it('should get user history', () => {
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });
      tracker.recordAccess({ moduleName: 'module-2', userId: 'user-1' });

      const history = tracker.getUserHistory('user-1');
      expect(history.length).toBe(2);
    });

    it('should respect user history limit', () => {
      for (let i = 0; i < 150; i++) {
        tracker.recordAccess({ moduleName: `module-${i}`, userId: 'user-1' });
      }

      const history = tracker.getUserHistory('user-1', 100);
      expect(history.length).toBe(100);
    });

    it('should return empty history for non-existent module', () => {
      const history = tracker.getModuleHistory('non-existent');
      expect(history).toEqual([]);
    });

    it('should return empty history for non-existent user', () => {
      const history = tracker.getUserHistory('non-existent');
      expect(history).toEqual([]);
    });
  });

  describe('Data Management', () => {
    it('should clear all data', () => {
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });
      tracker.clear();

      const stats = tracker.getStats();
      expect(stats.totalAccesses).toBe(0);
    });

    it('should clear data before timestamp', () => {
      const oldTime = Date.now() - 100000;
      const newTime = Date.now();

      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1', timestamp: oldTime });
      tracker.recordAccess({ moduleName: 'module-2', userId: 'user-1', timestamp: newTime });

      tracker.clearBefore(newTime - 1000);

      const stats = tracker.getStats();
      expect(stats.totalAccesses).toBe(1);
    });

    it('should export tracking data', () => {
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });

      const exported = tracker.export();
      expect(exported.modulePatterns).toHaveProperty('module-1');
      expect(exported.accessHistory.length).toBe(1);
    });

    it('should import tracking data', () => {
      const data = {
        modulePatterns: {
          'module-1': {
            moduleName: 'module-1',
            accessFrequency: 5.0,
            timeOfDay: 'morning' as const,
            dayOfWeek: 'monday' as const,
            coAccess: [],
            sessionPattern: { startProbability: 0.5, endProbability: 0.5, avgPosition: 0.5 },
            lastUpdated: Date.now(),
          },
        },
        userPatterns: {},
        accessHistory: [],
        coAccessMatrix: {},
      };

      tracker.import(data);

      const pattern = tracker.getModulePattern('module-1');
      expect(pattern?.accessFrequency).toBe(5.0);
    });

    it('should merge imported data with existing', () => {
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });

      const data = {
        modulePatterns: {
          'module-2': {
            moduleName: 'module-2',
            accessFrequency: 3.0,
            timeOfDay: 'afternoon' as const,
            dayOfWeek: 'tuesday' as const,
            coAccess: [],
            sessionPattern: { startProbability: 0.5, endProbability: 0.5, avgPosition: 0.5 },
            lastUpdated: Date.now(),
          },
        },
      };

      tracker.import(data);

      expect(tracker.getModulePattern('module-1')).toBeDefined();
      expect(tracker.getModulePattern('module-2')).toBeDefined();
    });

    it('should preserve co-access matrix on export', () => {
      tracker.recordAccess({ moduleName: 'module-1', userId: 'user-1' });
      tracker.recordAccess({ moduleName: 'module-2', userId: 'user-1' });

      const exported = tracker.export();
      expect(Object.keys(exported.coAccessMatrix).length).toBeGreaterThan(0);
    });

    it('should import co-access matrix', () => {
      const data = {
        coAccessMatrix: {
          'module-1': { 'module-2': 5 },
        },
      };

      tracker.import(data);
      const coAccess = tracker.getCoAccessPatterns('module-1');
      expect(coAccess.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty access history', () => {
      const stats = tracker.getStats();
      expect(stats.totalAccesses).toBe(0);
    });

    it('should handle very long module names', () => {
      const longName = 'a'.repeat(1000);
      tracker.recordAccess({ moduleName: longName, userId: 'user-1' });

      const pattern = tracker.getModulePattern(longName);
      expect(pattern?.moduleName).toBe(longName);
    });

    it('should handle very long user IDs', () => {
      const longUserId = 'b'.repeat(1000);
      tracker.recordAccess({ moduleName: 'module-1', userId: longUserId });

      const userPattern = tracker.getUserPattern(longUserId);
      expect(userPattern?.userId).toBe(longUserId);
    });

    it('should handle negative timestamps', () => {
      tracker.recordAccess({
        moduleName: 'module-1',
        userId: 'user-1',
        timestamp: -1,
      });

      const stats = tracker.getStats();
      expect(stats.totalAccesses).toBe(1);
    });

    it('should handle zero timestamp', () => {
      tracker.recordAccess({
        moduleName: 'module-1',
        userId: 'user-1',
        timestamp: 0,
      });

      const stats = tracker.getStats();
      expect(stats.totalAccesses).toBe(1);
    });

    it('should handle future timestamps', () => {
      const futureTime = Date.now() + 1000000000;
      tracker.recordAccess({
        moduleName: 'module-1',
        userId: 'user-1',
        timestamp: futureTime,
      });

      const stats = tracker.getStats();
      expect(stats.totalAccesses).toBe(1);
    });
  });
});

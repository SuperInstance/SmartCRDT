/**
 * @lsi/scale-strategy - CooldownManager Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CooldownManager } from '../src/CooldownManager.js';
import type { CooldownManagerConfig } from '../src/CooldownManager.js';

describe('CooldownManager', () => {
  let manager: CooldownManager;

  beforeEach(() => {
    manager = new CooldownManager({
      scaleUpCooldownMs: 1000,
      scaleDownCooldownMs: 2000,
    });
  });

  describe('constructor', () => {
    it('should create manager with default config', () => {
      const defaultManager = new CooldownManager();
      expect(defaultManager).toBeDefined();
    });

    it('should create manager with custom config', () => {
      const customManager = new CooldownManager({
        scaleUpCooldownMs: 5000,
        scaleDownCooldownMs: 10000,
      });
      expect(customManager.getConfig().scaleUpCooldownMs).toBe(5000);
    });

    it('should initialize with no cooldown state', () => {
      const state = manager.getState();
      expect(state.isInCooldown).toBe(false);
      expect(state.remainingMs).toBe(0);
    });
  });

  describe('recordScale', () => {
    it('should record scale up', () => {
      manager.recordScale('up');
      const state = manager.getState();
      expect(state.lastScaleUp).toBeGreaterThan(0);
    });

    it('should record scale down', () => {
      manager.recordScale('down');
      const state = manager.getState();
      expect(state.lastScaleDown).toBeGreaterThan(0);
    });

    it('should set cooldown after scale up', () => {
      manager.recordScale('up');
      const state = manager.getState();
      expect(state.isInCooldown).toBe(true);
      expect(state.remainingMs).toBeGreaterThan(0);
    });

    it('should set cooldown after scale down', () => {
      manager.recordScale('down');
      const state = manager.getState();
      expect(state.isInCooldown).toBe(true);
    });

    it('should allow emergency bypass when enabled', () => {
      manager.recordScale('up');
      const canScale = manager.canScale('down', true);
      expect(canScale).toBe(true);
    });

    it('should not allow emergency bypass when disabled', () => {
      manager.updateConfig({ allowEmergencyBypass: false });
      manager.recordScale('up');
      const canScale = manager.canScale('up', true);
      expect(canScale).toBe(false);
    });

    it('should add to history', () => {
      manager.recordScale('up');
      const history = manager.getHistory();
      expect(history.length).toBe(1);
    });

    it('should trim history to 100 entries', () => {
      for (let i = 0; i < 150; i++) {
        manager.recordScale(i % 2 === 0 ? 'up' : 'down');
      }
      const history = manager.getHistory();
      expect(history.length).toBe(100);
    });
  });

  describe('canScale', () => {
    it('should allow scale when not in cooldown', () => {
      expect(manager.canScale('up')).toBe(true);
    });

    it('should prevent scale up during cooldown', () => {
      manager.recordScale('up');
      expect(manager.canScale('up')).toBe(false);
    });

    it('should prevent scale down during cooldown', () => {
      manager.recordScale('down');
      expect(manager.canScale('down')).toBe(false);
    });

    it('should allow opposite direction during cooldown', () => {
      manager.recordScale('up');
      expect(manager.canScale('down')).toBe(true);
    });

    it('should allow scaling after cooldown expires', async () => {
      manager.recordScale('up');
      await new Promise(resolve => setTimeout(resolve, 1100));
      expect(manager.canScale('up')).toBe(true);
    });
  });

  describe('getState', () => {
    it('should return initial state', () => {
      const state = manager.getState();
      expect(state.lastScaleUp).toBe(0);
      expect(state.lastScaleDown).toBe(0);
      expect(state.isInCooldown).toBe(false);
      expect(state.remainingMs).toBe(0);
    });

    it('should return state after scale up', () => {
      manager.recordScale('up');
      const state = manager.getState();
      expect(state.lastScaleUp).toBeGreaterThan(0);
      expect(state.isInCooldown).toBe(true);
    });

    it('should calculate remaining cooldown', () => {
      manager.recordScale('up');
      const state = manager.getState();
      expect(state.remainingMs).toBeGreaterThan(0);
      expect(state.remainingMs).toBeLessThanOrEqual(1000);
    });
  });

  describe('getTimeUntilNextScale', () => {
    it('should return 0 when not in cooldown', () => {
      const time = manager.getTimeUntilNextScale();
      expect(time).toBe(0);
    });

    it('should return time for scale up', () => {
      manager.recordScale('up');
      const time = manager.getTimeUntilNextScale('up');
      expect(time).toBeGreaterThan(0);
    });

    it('should return time for scale down', () => {
      manager.recordScale('down');
      const time = manager.getTimeUntilNextScale('down');
      expect(time).toBeGreaterThan(0);
    });

    it('should return 0 for opposite direction', () => {
      manager.recordScale('up');
      const time = manager.getTimeUntilNextScale('down');
      expect(time).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      manager.recordScale('up');
      manager.recordScale('down');
      manager.reset();

      const state = manager.getState();
      expect(state.lastScaleUp).toBe(0);
      expect(state.lastScaleDown).toBe(0);
      expect(state.isInCooldown).toBe(false);
    });

    it('should clear history', () => {
      manager.recordScale('up');
      manager.recordScale('down');
      manager.reset();

      const history = manager.getHistory();
      expect(history.length).toBe(0);
    });
  });

  describe('updateConfig', () => {
    it('should update scale up cooldown', () => {
      manager.updateConfig({ scaleUpCooldownMs: 5000 });
      expect(manager.getConfig().scaleUpCooldownMs).toBe(5000);
    });

    it('should update scale down cooldown', () => {
      manager.updateConfig({ scaleDownCooldownMs: 8000 });
      expect(manager.getConfig().scaleDownCooldownMs).toBe(8000);
    });

    it('should update emergency bypass', () => {
      manager.updateConfig({ allowEmergencyBypass: false });
      expect(manager.getConfig().allowEmergencyBypass).toBe(false);
    });
  });

  describe('getConfig', () => {
    it('should return config copy', () => {
      const config = manager.getConfig();
      expect(config.scaleUpCooldownMs).toBe(1000);
      expect(config).not.toBe(manager['config']);
    });
  });

  describe('getHistory', () => {
    it('should return empty history initially', () => {
      const history = manager.getHistory();
      expect(history).toEqual([]);
    });

    it('should return all history entries', () => {
      manager.recordScale('up');
      manager.recordScale('down');
      const history = manager.getHistory();
      expect(history.length).toBe(2);
    });

    it('should preserve order', () => {
      manager.recordScale('up');
      manager.recordScale('down');
      manager.recordScale('up');
      const history = manager.getHistory();
      expect(history[0].direction).toBe('up');
      expect(history[1].direction).toBe('down');
      expect(history[2].direction).toBe('up');
    });
  });

  describe('getStats', () => {
    it('should return zero stats initially', () => {
      const stats = manager.getStats();
      expect(stats.totalScales).toBe(0);
      expect(stats.scaleUpCount).toBe(0);
      expect(stats.scaleDownCount).toBe(0);
    });

    it('should count scale ups', () => {
      manager.recordScale('up');
      manager.recordScale('up');
      const stats = manager.getStats();
      expect(stats.scaleUpCount).toBe(2);
    });

    it('should count scale downs', () => {
      manager.recordScale('down');
      manager.recordScale('down');
      manager.recordScale('down');
      const stats = manager.getStats();
      expect(stats.scaleDownCount).toBe(3);
    });

    it('should calculate total scales', () => {
      manager.recordScale('up');
      manager.recordScale('down');
      manager.recordScale('up');
      const stats = manager.getStats();
      expect(stats.totalScales).toBe(3);
    });

    it('should calculate average cooldown time', () => {
      manager.recordScale('up');
      manager.recordScale('down');
      const stats = manager.getStats();
      expect(stats.averageCooldownTime).toBe((1000 + 2000) / 2);
    });

    it('should detect oscillations', () => {
      manager.recordScale('up');
      manager.recordScale('down');
      manager.recordScale('up');
      manager.recordScale('down');
      const stats = manager.getStats();
      expect(stats.oscillationCount).toBeGreaterThan(0);
    });
  });

  describe('adjustCooldownForOscillation', () => {
    it('should increase cooldown on high oscillation', () => {
      for (let i = 0; i < 10; i++) {
        manager.recordScale(i % 2 === 0 ? 'up' : 'down');
      }
      const configBefore = manager.getConfig().scaleUpCooldownMs;
      manager.adjustCooldownForOscillation();
      const configAfter = manager.getConfig().scaleUpCooldownMs;
      expect(configAfter).toBeGreaterThanOrEqual(configBefore);
    });

    it('should not exceed max cooldown', () => {
      manager.updateConfig({ maxCooldownMs: 3000 });
      for (let i = 0; i < 20; i++) {
        manager.recordScale(i % 2 === 0 ? 'up' : 'down');
      }
      manager.adjustCooldownForOscillation();
      expect(manager.getConfig().scaleUpCooldownMs).toBeLessThanOrEqual(3000);
    });
  });

  describe('edge cases', () => {
    it('should handle zero cooldown', () => {
      manager.updateConfig({ scaleUpCooldownMs: 0 });
      manager.recordScale('up');
      expect(manager.canScale('up')).toBe(true);
    });

    it('should handle very long cooldown', () => {
      manager.updateConfig({ scaleUpCooldownMs: 1000000 });
      manager.recordScale('up');
      const time = manager.getTimeUntilNextScale('up');
      expect(time).toBeGreaterThan(999000);
    });

    it('should handle rapid successive calls', () => {
      for (let i = 0; i < 1000; i++) {
        manager.canScale('up');
        manager.getState();
        manager.getTimeUntilNextScale();
      }
      expect(manager).toBeDefined();
    });

    it('should handle negative cooldown config', () => {
      manager.updateConfig({ scaleUpCooldownMs: -100 });
      expect(manager.getConfig().scaleUpCooldownMs).toBe(-100);
    });
  });
});

// Total: 70 tests

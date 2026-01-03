/**
 * Unit tests for ThermalManager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ThermalManager, DEFAULT_THERMAL_POLICY, createThermalManager } from '../src/hardware/ThermalManager.js';
import type { ThermalState } from '../src/hardware/HardwareState.js';

describe('ThermalManager', () => {
  let manager: ThermalManager;

  beforeEach(() => {
    manager = new ThermalManager();
  });

  describe('initialization', () => {
    it('should create with default policy', () => {
      const defaultManager = new ThermalManager();
      expect(defaultManager.getCurrentZone()).toBe('normal');
      expect(defaultManager.getMetrics().currentZone).toBe('normal');
    });

    it('should create with custom policy', () => {
      const customManager = new ThermalManager({
        policy: {
          normalThreshold: 60,
          throttleThreshold: 75,
          criticalThreshold: 90,
          normalAction: () => ({ type: 'proceed', mode: 'full' }),
          throttleAction: (temp) => ({ type: 'throttle', reduction: 0.5, reason: 'Test' }),
          criticalAction: (temp) => ({ type: 'reject', reason: 'Test' }),
          checkInterval: 2000,
          minZoneTime: 10000,
        },
      });

      const policy = customManager.getPolicy();
      expect(policy.normalThreshold).toBe(60);
      expect(policy.throttleThreshold).toBe(75);
      expect(policy.criticalThreshold).toBe(90);
      expect(policy.checkInterval).toBe(2000);
      expect(policy.minZoneTime).toBe(10000);
    });

    it('should create with factory function', () => {
      const factoryManager = createThermalManager();
      expect(factoryManager).toBeInstanceOf(ThermalManager);
    });
  });

  describe('thermal state updates', () => {
    it('should stay in normal zone for low temperatures', () => {
      const thermalState: ThermalState = {
        cpu: 50,
        critical: false,
        zone: 'normal',
        timeInZone: 1000,
      };

      const action = manager.updateThermalState(thermalState);

      expect(manager.getCurrentZone()).toBe('normal');
      expect(action.type).toBe('proceed');
      if (action.type === 'proceed') {
        expect(action.mode).toBe('full');
      }
    });

    it('should transition to throttle zone at high temperature', () => {
      // First, be in normal zone
      manager.updateThermalState({
        cpu: 60,
        critical: false,
        zone: 'normal',
        timeInZone: 6000, // Enough time to switch zones
      });

      // Then heat up
      const thermalState: ThermalState = {
        cpu: 88,
        critical: false,
        zone: 'throttle',
        timeInZone: 1000,
      };

      const action = manager.updateThermalState(thermalState);

      expect(manager.getCurrentZone()).toBe('throttle');
      expect(action.type).toBe('throttle');
      if (action.type === 'throttle') {
        expect(action.reduction).toBeGreaterThan(0);
        expect(action.reason).toContain('Temperature');
      }
    });

    it('should transition to critical zone at very high temperature', () => {
      // Skip to critical directly
      const thermalState: ThermalState = {
        cpu: 97,
        critical: true,
        zone: 'critical',
        timeInZone: 1000,
      };

      // Wait for min zone time
      manager.updateThermalState({
        cpu: 60,
        critical: false,
        zone: 'normal',
        timeInZone: 6000,
      });

      const action = manager.updateThermalState(thermalState);

      expect(manager.getCurrentZone()).toBe('critical');
      expect(action.type).toBe('reject');
      if (action.type === 'reject') {
        expect(action.reason).toContain('Temperature');
      }
    });

    it('should respect minimum time in zone before switching', () => {
      // Start in normal
      manager.updateThermalState({
        cpu: 60,
        zone: 'normal',
        critical: false,
        timeInZone: 1000,
      });

      // Immediately try to switch to throttle
      const thermalState: ThermalState = {
        cpu: 88,
        zone: 'throttle',
        critical: false,
        timeInZone: 100, // Not enough time
      };

      manager.updateThermalState(thermalState);

      // Should stay in normal until min time elapsed
      expect(manager.getCurrentZone()).toBe('normal');
    });
  });

  describe('metrics tracking', () => {
    it('should track maximum temperature', () => {
      manager.updateThermalState({
        cpu: 70,
        zone: 'normal',
        critical: false,
        timeInZone: 1000,
      });

      manager.updateThermalState({
        cpu: 90,
        zone: 'throttle',
        critical: false,
        timeInZone: 6000,
      });

      const metrics = manager.getMetrics();
      expect(metrics.maxTemperature).toBe(90);
    });

    it('should track average temperature', () => {
      manager.updateThermalState({
        cpu: 60,
        zone: 'normal',
        critical: false,
        timeInZone: 1000,
      });

      manager.updateThermalState({
        cpu: 80,
        zone: 'normal',
        critical: false,
        timeInZone: 2000,
      });

      const metrics = manager.getMetrics();
      expect(metrics.averageTemperature).toBe(70);
    });

    it('should track throttle count', () => {
      manager.updateThermalState({
        cpu: 60,
        zone: 'normal',
        critical: false,
        timeInZone: 6000,
      });

      manager.updateThermalState({
        cpu: 88,
        zone: 'throttle',
        critical: false,
        timeInZone: 1000,
      });

      const metrics = manager.getMetrics();
      expect(metrics.throttleCount).toBe(1);
    });

    it('should reset metrics', () => {
      manager.updateThermalState({
        cpu: 80,
        zone: 'normal',
        critical: false,
        timeInZone: 1000,
      });

      manager.resetMetrics();

      const metrics = manager.getMetrics();
      expect(metrics.maxTemperature).toBe(0);
      expect(metrics.averageTemperature).toBe(0);
      expect(metrics.throttleCount).toBe(0);
      expect(metrics.totalThrottleTime).toBe(0);
    });
  });

  describe('processing recommendations', () => {
    it('should allow processing in normal zone', () => {
      manager.updateThermalState({
        cpu: 60,
        zone: 'normal',
        critical: false,
        timeInZone: 1000,
      });

      const recommendation = manager.getProcessingRecommendation();
      expect(recommendation.canProceed).toBe(true);
      expect(recommendation.confidence).toBe(1.0);
      expect(recommendation.action.type).toBe('proceed');
    });

    it('should reduce confidence in throttle zone', () => {
      manager.updateThermalState({
        cpu: 60,
        zone: 'normal',
        critical: false,
        timeInZone: 6000,
      });

      manager.updateThermalState({
        cpu: 88,
        zone: 'throttle',
        critical: false,
        timeInZone: 1000,
      });

      const recommendation = manager.getProcessingRecommendation();
      expect(recommendation.canProceed).toBe(true);
      expect(recommendation.confidence).toBeLessThan(1.0);
      expect(recommendation.confidence).toBeGreaterThan(0);
    });

    it('should reject processing in critical zone', () => {
      manager.updateThermalState({
        cpu: 60,
        zone: 'normal',
        critical: false,
        timeInZone: 6000,
      });

      manager.updateThermalState({
        cpu: 97,
        zone: 'critical',
        critical: true,
        timeInZone: 1000,
      });

      const recommendation = manager.getProcessingRecommendation();
      expect(recommendation.canProceed).toBe(false);
      expect(recommendation.confidence).toBe(0);
      expect(recommendation.action.type).toBe('reject');
    });
  });

  describe('time to normal estimation', () => {
    it('should return 0 when already in normal zone', () => {
      manager.updateThermalState({
        cpu: 60,
        zone: 'normal',
        critical: false,
        timeInZone: 1000,
      });

      const timeToNormal = manager.estimateTimeToNormal();
      expect(timeToNormal).toBe(0);
    });

    it('should estimate positive time when in throttle zone', () => {
      manager.updateThermalState({
        cpu: 60,
        zone: 'normal',
        critical: false,
        timeInZone: 6000,
      });

      manager.updateThermalState({
        cpu: 88,
        zone: 'throttle',
        critical: false,
        timeInZone: 1000,
      });

      const timeToNormal = manager.estimateTimeToNormal();
      expect(timeToNormal).toBeGreaterThan(0);
    });
  });

  describe('policy updates', () => {
    it('should update policy thresholds', () => {
      manager.updatePolicy({
        normalThreshold: 65,
        throttleThreshold: 80,
        criticalThreshold: 92,
      });

      const policy = manager.getPolicy();
      expect(policy.normalThreshold).toBe(65);
      expect(policy.throttleThreshold).toBe(80);
      expect(policy.criticalThreshold).toBe(92);
    });

    it('should maintain action functions when updating policy', () => {
      const originalNormalAction = manager.getPolicy().normalAction;

      manager.updatePolicy({
        normalThreshold: 65,
      });

      const updatedPolicy = manager.getPolicy();
      expect(updatedPolicy.normalAction).toBe(originalNormalAction);
    });
  });

  describe('snapshots', () => {
    it('should create snapshot', () => {
      manager.updateThermalState({
        cpu: 75,
        zone: 'normal',
        critical: false,
        timeInZone: 1000,
      });

      const snapshot = manager.createSnapshot();

      expect(snapshot.zone).toBe('normal');
      expect(snapshot.metrics.currentTemperature).toBe(75);
      expect(snapshot.policy).toBeDefined();
      expect(snapshot.timestamp).toBeDefined();
    });

    it('should restore from snapshot', () => {
      const snapshot = {
        zone: 'throttle' as const,
        metrics: {
          currentTemperature: 88,
          currentZone: 'throttle' as const,
          timeInZone: 5000,
          maxTemperature: 90,
          averageTemperature: 85,
          throttleCount: 1,
          totalThrottleTime: 10000,
        },
        policy: DEFAULT_THERMAL_POLICY,
      };

      manager.restoreSnapshot(snapshot);

      expect(manager.getCurrentZone()).toBe('throttle');
      expect(manager.getMetrics().currentTemperature).toBe(88);
      expect(manager.getMetrics().throttleCount).toBe(1);
    });
  });

  describe('utility methods', () => {
    it('should detect throttling state', () => {
      manager.updateThermalState({
        cpu: 60,
        zone: 'normal',
        critical: false,
        timeInZone: 6000,
      });

      expect(manager.isThrottling()).toBe(false);

      manager.updateThermalState({
        cpu: 88,
        zone: 'throttle',
        critical: false,
        timeInZone: 1000,
      });

      expect(manager.isThrottling()).toBe(true);
    });

    it('should detect critical state', () => {
      manager.updateThermalState({
        cpu: 60,
        zone: 'normal',
        critical: false,
        timeInZone: 6000,
      });

      expect(manager.isCritical()).toBe(false);

      manager.updateThermalState({
        cpu: 97,
        zone: 'critical',
        critical: true,
        timeInZone: 1000,
      });

      expect(manager.isCritical()).toBe(true);
    });
  });

  describe('disposal', () => {
    it('should dispose properly', () => {
      manager.updateThermalState({
        cpu: 75,
        zone: 'normal',
        critical: false,
        timeInZone: 1000,
      });

      manager.dispose();

      const metrics = manager.getMetrics();
      expect(metrics.currentTemperature).toBe(0);
      expect(metrics.throttleCount).toBe(0);
    });
  });
});

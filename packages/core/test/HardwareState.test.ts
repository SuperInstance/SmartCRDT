/**
 * Unit tests for HardwareState module
 */

import { describe, it, expect } from 'vitest';
import {
  determineThermalZone,
  canProcessLocally,
  calculateConfidence,
  recommendAction,
  assessCapabilities,
  DEFAULT_HARDWARE_STATE_OPTIONS,
  type HardwareState,
} from '../src/hardware/HardwareState.js';

describe('HardwareState', () => {
  describe('determineThermalZone', () => {
    it('should return normal for temperatures below throttle threshold', () => {
      const thresholds = { normal: 70, throttle: 85, critical: 95 };
      expect(determineThermalZone(60, thresholds)).toBe('normal');
      expect(determineThermalZone(70, thresholds)).toBe('normal');
      expect(determineThermalZone(84, thresholds)).toBe('normal');
    });

    it('should return throttle for temperatures between throttle and critical', () => {
      const thresholds = { normal: 70, throttle: 85, critical: 95 };
      expect(determineThermalZone(85, thresholds)).toBe('throttle');
      expect(determineThermalZone(90, thresholds)).toBe('throttle');
      expect(determineThermalZone(94, thresholds)).toBe('throttle');
    });

    it('should return critical for temperatures at or above critical', () => {
      const thresholds = { normal: 70, throttle: 85, critical: 95 };
      expect(determineThermalZone(95, thresholds)).toBe('critical');
      expect(determineThermalZone(100, thresholds)).toBe('critical');
      expect(determineThermalZone(110, thresholds)).toBe('critical');
    });
  });

  describe('canProcessLocally', () => {
    const createMockState = (overrides?: Partial<HardwareState>): HardwareState => ({
      cpu: { usage: 0.5, temperature: 60, availableCores: 4, totalCores: 4, frequency: 3000, loadAverage: [0.5] },
      memory: { used: 4000, total: 16000, available: 12000, usageRatio: 0.25, cached: 1000, buffers: 500 },
      thermal: { cpu: 60, critical: false, zone: 'normal', timeInZone: 0 },
      network: { latency: 10, available: true, type: 'ethernet' },
      timestamp: Date.now(),
      canProcessLocal: true,
      recommendedAction: 'local',
      confidence: 1.0,
      ...overrides,
    });

    it('should return true for normal hardware state', () => {
      const state = createMockState();
      expect(canProcessLocally(state)).toBe(true);
    });

    it('should return false when in critical thermal zone', () => {
      const state = createMockState({
        thermal: { cpu: 100, critical: true, zone: 'critical', timeInZone: 0 },
      });
      expect(canProcessLocally(state)).toBe(false);
    });

    it('should return false when memory usage exceeds threshold', () => {
      const state = createMockState({
        memory: { used: 15000, total: 16000, available: 1000, usageRatio: 0.94, cached: 1000, buffers: 500 },
      });
      expect(canProcessLocally(state, { memoryThreshold: 0.9 })).toBe(false);
    });

    it('should return false when CPU usage exceeds threshold', () => {
      const state = createMockState({
        cpu: { usage: 0.98, temperature: 60, availableCores: 4, totalCores: 4, frequency: 3000, loadAverage: [0.98] },
      });
      expect(canProcessLocally(state, { cpuThreshold: 0.95 })).toBe(false);
    });

    it('should return true in throttle zone but not critical', () => {
      const state = createMockState({
        thermal: { cpu: 88, critical: false, zone: 'throttle', timeInZone: 1000 },
      });
      expect(canProcessLocally(state)).toBe(true);
    });
  });

  describe('calculateConfidence', () => {
    const createMockState = (overrides?: Partial<HardwareState>): HardwareState => ({
      cpu: { usage: 0.5, temperature: 60, availableCores: 4, totalCores: 4, frequency: 3000, loadAverage: [0.5] },
      memory: { used: 4000, total: 16000, available: 12000, usageRatio: 0.25, cached: 1000, buffers: 500 },
      thermal: { cpu: 60, critical: false, zone: 'normal', timeInZone: 0 },
      network: { latency: 10, available: true, type: 'ethernet' },
      timestamp: Date.now(),
      canProcessLocal: true,
      recommendedAction: 'local',
      confidence: 1.0,
      ...overrides,
    });

    it('should return high confidence for normal thermal zone', () => {
      const state = createMockState();
      expect(calculateConfidence(state)).toBeGreaterThan(0.9);
    });

    it('should return zero confidence for critical thermal zone', () => {
      const state = createMockState({
        thermal: { cpu: 100, critical: true, zone: 'critical', timeInZone: 0 },
      });
      expect(calculateConfidence(state)).toBe(0);
    });

    it('should return reduced confidence for throttle zone', () => {
      const state = createMockState({
        thermal: { cpu: 88, critical: false, zone: 'throttle', timeInZone: 1000 },
      });
      expect(calculateConfidence(state)).toBeGreaterThan(0);
      expect(calculateConfidence(state)).toBeLessThan(0.5);
    });

    it('should reduce confidence based on memory usage', () => {
      const normalState = createMockState();
      const highMemoryState = createMockState({
        memory: { used: 13000, total: 16000, available: 3000, usageRatio: 0.85, cached: 1000, buffers: 500 },
      });

      expect(calculateConfidence(highMemoryState)).toBeLessThan(calculateConfidence(normalState));
    });

    it('should reduce confidence based on CPU usage', () => {
      const normalState = createMockState();
      const highCPUState = createMockState({
        cpu: { usage: 0.85, temperature: 60, availableCores: 4, totalCores: 4, frequency: 3000, loadAverage: [0.85] },
      });

      expect(calculateConfidence(highCPUState)).toBeLessThan(calculateConfidence(normalState));
    });
  });

  describe('recommendAction', () => {
    const createMockState = (overrides?: Partial<HardwareState>): HardwareState => ({
      cpu: { usage: 0.5, temperature: 60, availableCores: 4, totalCores: 4, frequency: 3000, loadAverage: [0.5] },
      memory: { used: 4000, total: 16000, available: 12000, usageRatio: 0.25, cached: 1000, buffers: 500 },
      thermal: { cpu: 60, critical: false, zone: 'normal', timeInZone: 0 },
      network: { latency: 10, available: true, type: 'ethernet' },
      timestamp: Date.now(),
      canProcessLocal: true,
      recommendedAction: 'local',
      confidence: 1.0,
      ...overrides,
    });

    it('should recommend local for high confidence and can process locally', () => {
      const state = createMockState({ canProcessLocal: true, confidence: 0.9 });
      expect(recommendAction(state)).toBe('local');
    });

    it('should recommend cloud when cannot process locally', () => {
      const state = createMockState({ canProcessLocal: false, confidence: 0.5 });
      expect(recommendAction(state)).toBe('cloud');
    });

    it('should recommend hybrid for medium confidence', () => {
      const state = createMockState({ canProcessLocal: true, confidence: 0.6 });
      expect(recommendAction(state)).toBe('hybrid');
    });

    it('should recommend cloud for low confidence', () => {
      const state = createMockState({ canProcessLocal: true, confidence: 0.3 });
      expect(recommendAction(state)).toBe('cloud');
    });
  });

  describe('assessCapabilities', () => {
    const createMockState = (overrides?: Partial<HardwareState>): HardwareState => ({
      cpu: { usage: 0.5, temperature: 60, availableCores: 4, totalCores: 4, frequency: 3000, loadAverage: [0.5] },
      memory: { used: 4000, total: 16000, available: 12000, usageRatio: 0.25, cached: 1000, buffers: 500 },
      thermal: { cpu: 60, critical: false, zone: 'normal', timeInZone: 0 },
      network: { latency: 10, available: true, type: 'ethernet' },
      timestamp: Date.now(),
      canProcessLocal: true,
      recommendedAction: 'local',
      confidence: 1.0,
      ...overrides,
    });

    it('should detect available CPU', () => {
      const state = createMockState();
      const capabilities = assessCapabilities(state);
      expect(capabilities.hasCPU).toBe(true);
    });

    it('should detect available GPU', () => {
      const state = createMockState({
        gpu: {
          available: true,
          usage: 0.5,
          temperature: 70,
          memoryUsed: 4000,
          memoryTotal: 8000,
          utilization: 50,
          powerUsage: 150,
          name: 'Test GPU',
        },
      });
      const capabilities = assessCapabilities(state);
      expect(capabilities.hasGPU).toBe(true);
    });

    it('should recommend GPU when available with sufficient capacity', () => {
      const state = createMockState({
        gpu: {
          available: true,
          usage: 0.3,
          temperature: 70,
          memoryUsed: 2000,
          memoryTotal: 8000,
          utilization: 30,
          powerUsage: 100,
          name: 'Test GPU',
        },
      });
      const capabilities = assessCapabilities(state);
      expect(capabilities.recommendedResource).toBe('gpu');
    });

    it('should recommend CPU when GPU not available', () => {
      const state = createMockState();
      const capabilities = assessCapabilities(state);
      expect(capabilities.recommendedResource).toBe('cpu');
    });

    it('should return null recommendation when no resources available', () => {
      const state = createMockState({
        cpu: { usage: 0.99, temperature: 60, availableCores: 4, totalCores: 4, frequency: 3000, loadAverage: [0.99] },
      });
      const capabilities = assessCapabilities(state);
      expect(capabilities.recommendedResource).toBeNull();
    });
  });
});

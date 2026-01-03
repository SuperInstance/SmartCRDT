/**
 * @lsi/webgpu-memory - MemoryLimits Tests
 *
 * Tests for MemoryLimits functionality.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryLimits, MemoryPressureMonitor } from '../src/MemoryLimits.js';
import { MemoryPressure } from '../src/types.js';

// Mock GPUAdapter
class MockGPUAdapter {
  limits = {
    maxBufferSize: 256 * 1024 * 1024,
    minUniformBufferOffsetAlignment: 256,
    maxStorageBuffersPerShaderStage: 8,
    maxUniformBuffersPerShaderStage: 8,
  };

  async requestAdapterInfo() {
    return {
      device: 'MockGPU',
      vendor: 'MockVendor',
      architecture: 'MockArch',
    };
  }
}

describe('MemoryLimits', () => {
  let limits: MemoryLimits;
  let adapter: MockGPUAdapter;

  beforeEach(() => {
    adapter = new MockGPUAdapter();
    limits = new MemoryLimits({
      maxMemory: 10 * 1024 * 1024, // 10MB
      warningThreshold: 0.7,
      criticalThreshold: 0.9,
      autoEvict: true,
    });
  });

  describe('setAdapter', () => {
    it('should set adapter and query device info', async () => {
      await limits.setAdapter(adapter as any);

      const deviceInfo = limits.getDeviceInfo();

      expect(deviceInfo).toBeDefined();
      expect(deviceInfo!.name).toBe('MockGPU');
      expect(deviceInfo!.maxBufferSize).toBe(256 * 1024 * 1024);
    });
  });

  describe('getMaxBufferSize', () => {
    it('should return max buffer size', async () => {
      await limits.setAdapter(adapter as any);

      expect(limits.getMaxBufferSize()).toBe(256 * 1024 * 1024);
    });
  });

  describe('getMaxBufferAlignment', () => {
    it('should return max buffer alignment', async () => {
      await limits.setAdapter(adapter as any);

      expect(limits.getMaxBufferAlignment()).toBe(256);
    });
  });

  describe('recordAllocation', () => {
    it('should record allocation', () => {
      limits.recordAllocation(1024);
      limits.recordAllocation(2048);

      expect(limits.getCurrentUsage()).toBe(3072);
    });
  });

  describe('recordDeallocation', () => {
    it('should record deallocation', () => {
      limits.recordAllocation(1024);
      limits.recordDeallocation(512);

      expect(limits.getCurrentUsage()).toBe(512);
    });

    it('should not go below zero', () => {
      limits.recordDeallocation(1024);

      expect(limits.getCurrentUsage()).toBe(0);
    });
  });

  describe('wouldExceedBudget', () => {
    it('should check if allocation would exceed budget', () => {
      limits.recordAllocation(8 * 1024 * 1024);

      expect(limits.wouldExceedBudget(1024)).toBe(false);
      expect(limits.wouldExceedBudget(3 * 1024 * 1024)).toBe(true);
    });
  });

  describe('getMemoryPressure', () => {
    it('should return none for low usage', () => {
      limits.recordAllocation(1 * 1024 * 1024);

      expect(limits.getMemoryPressure()).toBe(MemoryPressure.None);
    });

    it('should return low for moderate usage', () => {
      limits.recordAllocation(5 * 1024 * 1024);

      expect(limits.getMemoryPressure()).toBe(MemoryPressure.Low);
    });

    it('should return medium for high usage', () => {
      limits.recordAllocation(7.5 * 1024 * 1024);

      expect(limits.getMemoryPressure()).toBe(MemoryPressure.Medium);
    });

    it('should return high for critical usage', () => {
      limits.recordAllocation(9 * 1024 * 1024);

      expect(limits.getMemoryPressure()).toBe(MemoryPressure.High);
    });

    it('should return critical for extreme usage', () => {
      limits.recordAllocation(9.5 * 1024 * 1024);

      expect(limits.getMemoryPressure()).toBe(MemoryPressure.Critical);
    });
  });

  describe('getUsageRatio', () => {
    it('should return usage ratio', () => {
      limits.recordAllocation(5 * 1024 * 1024);

      expect(limits.getUsageRatio()).toBe(0.5);
    });
  });

  describe('shouldAutoEvict', () => {
    it('should return true when over critical threshold', () => {
      limits.recordAllocation(9.5 * 1024 * 1024);

      expect(limits.shouldAutoEvict()).toBe(true);
    });

    it('should return false when under threshold', () => {
      limits.recordAllocation(5 * 1024 * 1024);

      expect(limits.shouldAutoEvict()).toBe(false);
    });
  });

  describe('getEvictionTarget', () => {
    it('should calculate eviction target', () => {
      limits.recordAllocation(9.5 * 1024 * 1024);

      const target = limits.getEvictionTarget();

      // Target should be positive to bring usage down to 80%
      expect(target).toBeGreaterThan(0);
    });
  });

  describe('handleOOM', () => {
    it('should return canRecover when auto-evict enabled', () => {
      limits.recordAllocation(9.5 * 1024 * 1024);

      const result = limits.handleOOM(1024);

      expect(result.canRecover).toBe(true);
      expect(result.bytesToFree).toBeGreaterThan(0);
    });

    it('should return canRecover false when auto-evict disabled', () => {
      const noEvictLimits = new MemoryLimits({
        maxMemory: 10 * 1024 * 1024,
        autoEvict: false,
      });

      noEvictLimits.recordAllocation(9.5 * 1024 * 1024);

      const result = noEvictLimits.handleOOM(1024);

      expect(result.canRecover).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset usage tracking', () => {
      limits.recordAllocation(5 * 1024 * 1024);

      limits.reset();

      expect(limits.getCurrentUsage()).toBe(0);
    });
  });

  describe('getConfig', () => {
    it('should return configuration', () => {
      const config = limits.getConfig();

      expect(config.maxMemory).toBe(10 * 1024 * 1024);
      expect(config.warningThreshold).toBe(0.7);
      expect(config.criticalThreshold).toBe(0.9);
    });
  });
});

describe('MemoryPressureMonitor', () => {
  let limits: MemoryLimits;
  let monitor: MemoryPressureMonitor;

  beforeEach(() => {
    limits = new MemoryLimits({ maxMemory: 10 * 1024 * 1024 });
    monitor = new MemoryPressureMonitor(limits, 100);
  });

  describe('start and stop', () => {
    it('should start and stop monitoring', () => {
      monitor.start();

      expect(() => monitor.start()).not.toThrow(); // Should not start twice

      monitor.stop();

      expect(() => monitor.stop()).not.toThrow();
    });
  });

  describe('pressure change callbacks', () => {
    it('should call callback on pressure change', (done) => {
      limits.recordAllocation(8 * 1024 * 1024);

      monitor.onPressureChange((pressure) => {
        expect(pressure).toBeDefined();
        monitor.stop();
        done();
      });

      monitor.start();

      // Wait for next poll
      setTimeout(() => {
        limits.recordAllocation(1 * 1024 * 1024);
      }, 150);
    });

    it('should unregister callback', () => {
      const callback = () => {};

      monitor.onPressureChange(callback);
      monitor.offPressureChange(callback);

      expect(() => monitor.stop()).not.toThrow();
    });
  });
});

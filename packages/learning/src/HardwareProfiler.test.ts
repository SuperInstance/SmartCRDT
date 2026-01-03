/**
 * Tests for HardwareProfiler
 */

import { describe, it, expect } from 'vitest';
import { HardwareProfiler, createHardwareProfiler, quickDetect } from './HardwareProfiler.js';
import type { HardwareProfile } from './types.js';

describe('HardwareProfiler', () => {
  describe('profiling', () => {
    it('should profile hardware successfully', async () => {
      const profiler = new HardwareProfiler({ detectGPU: false });
      const profile = await profiler.profile();

      expect(profile).toBeDefined();
      expect(profile.cpu).toBeDefined();
      expect(profile.cpu.cores).toBeGreaterThan(0);
      expect(profile.cpu.frequency).toBeGreaterThanOrEqual(0);
      expect(profile.cpu.architecture).toBeDefined();

      expect(profile.memory).toBeDefined();
      expect(profile.memory.total).toBeGreaterThan(0);
      expect(profile.memory.available).toBeGreaterThan(0);
    });

    it('should include CPU model', async () => {
      const profiler = new HardwareProfiler();
      const profile = await profiler.profile();

      expect(profile.cpu.model).toBeDefined();
      expect(typeof profile.cpu.model).toBe('string');
    });

    it('should detect GPU if available', async () => {
      const profiler = new HardwareProfiler({ detectGPU: true });
      const profile = await profiler.profile();

      expect(profile.gpu).toBeDefined();
      expect(profile.gpu?.available).toBeDefined();

      if (profile.gpu?.available) {
        expect(profile.gpu.vendor).toBeDefined();
      }
    });
  });

  describe('fingerprinting', () => {
    it('should generate fingerprint', async () => {
      const profiler = new HardwareProfiler();
      const fingerprint = await profiler.getFingerprint();

      expect(fingerprint).toBeDefined();
      expect(typeof fingerprint).toBe('string');

      const parts = fingerprint.split('-');
      expect(parts.length).toBeGreaterThanOrEqual(3);
    });

    it('should detect hardware changes', async () => {
      const profiler = new HardwareProfiler();
      const profile1 = await profiler.profile();

      // Modify profile to simulate hardware change
      const modifiedProfile: HardwareProfile = {
        ...profile1,
        cpu: {
          ...profile1.cpu,
          cores: profile1.cpu.cores + 1,
        },
      };

      const hasChanged = await profiler.hasHardwareChanged(modifiedProfile);
      expect(hasChanged).toBe(true);
    });

    it('should not detect changes when hardware is same', async () => {
      const profiler = new HardwareProfiler();
      const profile = await profiler.profile();

      const hasChanged = await profiler.hasHardwareChanged(profile);
      expect(hasChanged).toBe(false);
    });
  });
});

describe('createHardwareProfiler', () => {
  it('should create profiler with default options', () => {
    const profiler = createHardwareProfiler();

    expect(profiler).toBeInstanceOf(HardwareProfiler);
  });
});

describe('quickDetect', () => {
  it('should return quick detection results', async () => {
    const result = await quickDetect();

    expect(result).toBeDefined();
    expect(result.cores).toBeGreaterThan(0);
    expect(result.memoryGB).toBeGreaterThan(0);
    expect(typeof result.hasGPU).toBe('boolean');
    expect(result.arch).toBeDefined();
  });

  it('should return consistent results', async () => {
    const result1 = await quickDetect();
    const result2 = await quickDetect();

    expect(result1.cores).toBe(result2.cores);
    expect(result1.memoryGB).toBe(result2.memoryGB);
    expect(result1.arch).toBe(result2.arch);
  });
});

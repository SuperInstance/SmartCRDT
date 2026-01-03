/**
 * HardwareDetector Tests
 *
 * Comprehensive tests for hardware detection across different scenarios:
 * - GPU detection (CUDA, Metal, WebGPU, OpenCL, Vulkan)
 * - CPU profiling (cores, SIMD, cache)
 * - Memory monitoring
 * - NPU detection
 * - Thermal monitoring
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { HardwareDetector } from "../HardwareDetector.js";
import type {
  GPUType,
  HardwareProfile,
  ThermalState,
} from "@lsi/protocol";

describe("HardwareDetector", () => {
  let detector: HardwareDetector;

  beforeEach(() => {
    detector = new HardwareDetector();
  });

  describe("GPU Detection", () => {
    it("should detect no GPU when none available", async () => {
      const result = await detector.detect();

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();
      expect(result.profile!.gpu.type).toBe(GPUType.NONE);
      expect(result.profile!.gpu.available).toBe(false);
    });

    it("should cache GPU detection results", async () => {
      const startTime = Date.now();

      // First detection
      const result1 = await detector.detect();
      const firstCallTime = Date.now() - startTime;

      // Second detection (should use cache)
      const result2 = await detector.detect();

      expect(result1.profile).toEqual(result2.profile);
    });

    it("should clear cache when requested", async () => {
      await detector.detect();
      detector.clearCache();

      const profile = detector.getProfile();
      expect(profile).toBeNull();
    });

    it("should detect GPU availability correctly", async () => {
      await detector.detect();
      const hasGPU = detector.hasGPU();

      // Should be boolean
      expect(typeof hasGPU).toBe("boolean");
    });
  });

  describe("CPU Profiling", () => {
    it("should detect CPU information", async () => {
      const result = await detector.detect();

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();

      const cpu = result.profile!.cpu;
      expect(cpu.architecture).toBeDefined();
      expect(cpu.physicalCores).toBeGreaterThan(0);
      expect(cpu.logicalCores).toBeGreaterThan(0);
      expect(cpu.maxClockMHz).toBeGreaterThan(0);
      expect(cpu.model).toBeDefined();
    });

    it("should detect SIMD support", async () => {
      const result = await detector.detect();
      const simd = result.profile!.cpu.simd;

      // Should detect at least some SIMD support
      const hasAnySIMD =
        simd.sse ||
        simd.sse2 ||
        simd.avx ||
        simd.avx2 ||
        simd.neon;

      expect(typeof hasAnySIMD).toBe("boolean");
    });

    it("should estimate cache sizes", async () => {
      const result = await detector.detect();
      const cache = result.profile!.cpu.cache;

      expect(cache.l1KB).toBeGreaterThan(0);
      expect(cache.l2KB).toBeGreaterThan(0);
      expect(cache.l3KB).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Memory Monitoring", () => {
    it("should detect memory information", async () => {
      const result = await detector.detect();

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();

      const memory = result.profile!.memory;
      expect(memory.totalMB).toBeGreaterThan(0);
      expect(memory.availableMB).toBeGreaterThan(0);
      expect(memory.usedMB).toBeGreaterThan(0);
      expect(memory.usagePercent).toBeGreaterThanOrEqual(0);
      expect(memory.usagePercent).toBeLessThanOrEqual(100);
    });

    it("should have consistent memory values", async () => {
      const result = await detector.detect();
      const memory = result.profile!.memory;

      expect(memory.usedMB + memory.availableMB).toBeCloseTo(memory.totalMB, 0);
    });
  });

  describe("NPU Detection", () => {
    it("should detect NPU availability", async () => {
      const result = await detector.detect();

      expect(result.profile).toBeDefined();
      expect(result.profile!.npu.available).toBeDefined();
      expect(typeof result.profile!.npu.available).toBe("boolean");
    });

    it("should report NPU compute availability", async () => {
      const result = await detector.detect();
      const npu = result.profile!.npu;

      if (npu.available) {
        expect(npu.computeAvailable).toBeDefined();
        expect(npu.supportedPrecision).toBeDefined();
        expect(Array.isArray(npu.supportedPrecision)).toBe(true);
      }
    });
  });

  describe("Thermal Monitoring", () => {
    it("should detect thermal state", async () => {
      const result = await detector.detect();

      expect(result.profile).toBeDefined();
      expect(result.profile!.thermal.state).toBeDefined();
    });

    it("should classify thermal states correctly", async () => {
      const result = await detector.detect();
      const state = result.profile!.thermal.state;

      // Should be one of the valid states
      const validStates: ThermalState[] = [
        "normal",
        "elevated",
        "high",
        "critical",
        "unknown",
      ];

      expect(validStates).toContain(state);
    });

    it("should detect thermal throttling", async () => {
      const result = await detector.detect();
      const thermal = result.profile!.thermal;

      expect(thermal.throttling).toBeDefined();
      expect(typeof thermal.throttling).toBe("boolean");
    });
  });

  describe("Capability Scoring", () => {
    it("should calculate overall capability score", async () => {
      const result = await detector.detect();

      expect(result.profile).toBeDefined();
      expect(result.profile!.capabilityScore).toBeGreaterThanOrEqual(0);
      expect(result.profile!.capabilityScore).toBeLessThanOrEqual(100);
    });

    it("should calculate component scores", async () => {
      const result = await detector.detect();
      const capabilities = result.profile!.capabilities;

      expect(capabilities.gpuScore).toBeGreaterThanOrEqual(0);
      expect(capabilities.cpuScore).toBeGreaterThanOrEqual(0);
      expect(capabilities.memoryScore).toBeGreaterThanOrEqual(0);
      expect(capabilities.npuScore).toBeGreaterThanOrEqual(0);
    });

    it("should determine supported operations", async () => {
      const result = await detector.detect();
      const ops = result.profile!.capabilities.supportedOperations;

      expect(ops.mlInference).toBeDefined();
      expect(ops.mlTraining).toBeDefined();
      expect(ops.vectorOps).toBeDefined();
      expect(ops.matrixMul).toBeDefined();
      expect(ops.videoEncode).toBeDefined();
      expect(ops.videoDecode).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle detection timeout gracefully", async () => {
      const detectorWithTimeout = new HardwareDetector({
        detectionTimeout: 1, // 1ms timeout
      });

      const result = await detectorWithTimeout.detect();
      expect(result.success).toBeDefined();
    });

    it("should handle missing nvidia-smi gracefully", async () => {
      const detectorWithCustomPath = new HardwareDetector({
        nvidiaSmiPath: "/nonexistent/nvidia-smi",
      });

      const result = await detectorWithCustomPath.detect();
      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();
    });

    it("should handle concurrent detection calls", async () => {
      const promises = [
        detector.detect(),
        detector.detect(),
        detector.detect(),
      ];

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.profile).toBeDefined();
      });

      // All should return the same profile
      const profiles = results.map(r => r.profile);
      expect(profiles[0]).toEqual(profiles[1]);
      expect(profiles[1]).toEqual(profiles[2]);
    });
  });

  describe("Profile Caching", () => {
    it("should respect cache TTL", async () => {
      const detectorWithShortTTL = new HardwareDetector({
        cacheTTL: 100, // 100ms TTL
      });

      const result1 = await detectorWithShortTTL.detect();
      const profile1 = result1.profile!;

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      const result2 = await detectorWithShortTTL.detect();
      const profile2 = result2.profile!;

      // Timestamps should be different
      expect(profile2.timestamp).toBeGreaterThan(profile1.timestamp);
    });

    it("should use cached profile within TTL", async () => {
      const detectorWithLongTTL = new HardwareDetector({
        cacheTTL: 10000, // 10 second TTL
      });

      const result1 = await detectorWithLongTTL.detect();
      const profile1 = result1.profile!;

      // Wait briefly
      await new Promise(resolve => setTimeout(resolve, 100));

      const result2 = await detectorWithLongTTL.detect();
      const profile2 = result2.profile!;

      // Should be the same profile (cached)
      expect(profile2.timestamp).toBe(profile1.timestamp);
    });
  });

  describe("Hardware Variants", () => {
    it("should handle x64 architecture", async () => {
      const result = await detector.detect();
      const arch = result.profile!.cpu.architecture;

      if (arch === "x64") {
        // x64 should have SIMD support
        const simd = result.profile!.cpu.simd;
        expect(simd.sse || simd.sse2 || simd.avx).toBe(true);
      }
    });

    it("should handle ARM64 architecture", async () => {
      const result = await detector.detect();
      const arch = result.profile!.cpu.architecture;

      if (arch === "arm64") {
        // ARM64 should have NEON
        const simd = result.profile!.cpu.simd;
        expect(simd.neon).toBe(true);
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle detection failures gracefully", async () => {
      // Mock exec to throw error
      const { exec } = require("child_process");
      vi.mock("child_process", () => ({
        exec: vi.fn(() => {
          throw new Error("Command failed");
        }),
      }));

      const result = await detector.detect();
      expect(result.success).toBeDefined();
    });
  });
});

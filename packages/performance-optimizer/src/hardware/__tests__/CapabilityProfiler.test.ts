/**
 * CapabilityProfiler Tests
 *
 * Tests for hardware capability profiling and operation scoring.
 */

import { describe, it, expect } from "vitest";
import { CapabilityProfiler } from "../CapabilityProfiler.js";
import type {
  HardwareProfile,
  OperationType,
  GPUType,
} from "@lsi/protocol";

describe("CapabilityProfiler", () => {
  let profiler: CapabilityProfiler;

  beforeEach(() => {
    profiler = new CapabilityProfiler();
  });

  const createMockProfile = (overrides?: Partial<HardwareProfile>): HardwareProfile => ({
    timestamp: Date.now(),
    gpu: {
      type: GPUType.NONE,
      name: "No GPU",
      vramMB: 0,
      availableVRAMMB: 0,
      available: false,
      features: [],
    },
    cpu: {
      architecture: "x64",
      physicalCores: 8,
      logicalCores: 16,
      baseClockMHz: 3000,
      maxClockMHz: 5000,
      model: "Test CPU",
      vendor: "Intel",
      simd: {
        sse: true,
        sse2: true,
        sse3: true,
        sse4_1: true,
        sse4_2: true,
        avx: true,
        avx2: true,
        avx512: false,
        neon: false,
      },
      cache: {
        l1KB: 512,
        l2KB: 4096,
        l3KB: 16384,
      },
    },
    memory: {
      totalMB: 32768,
      availableMB: 16384,
      usedMB: 16384,
      usagePercent: 50,
      fragmentationPercent: 10,
    },
    npu: {
      available: false,
      computeAvailable: false,
      supportedPrecision: [],
    },
    thermal: {
      state: "normal",
      throttling: false,
    },
    capabilityScore: 50,
    capabilities: {
      gpuScore: 0,
      cpuScore: 50,
      memoryScore: 50,
      npuScore: 0,
      supportedOperations: {
        mlInference: false,
        mlTraining: false,
        vectorOps: true,
        matrixMul: true,
        videoEncode: false,
        videoDecode: false,
      },
    },
    ...overrides,
  });

  describe("Profile Scoring", () => {
    it("should calculate component scores", () => {
      const profile = createMockProfile();
      const result = profiler.profile(profile);

      expect(result.componentScores).toBeDefined();
      expect(result.componentScores.gpu).toBeGreaterThanOrEqual(0);
      expect(result.componentScores.cpu).toBeGreaterThanOrEqual(0);
      expect(result.componentScores.memory).toBeGreaterThanOrEqual(0);
      expect(result.componentScores.npu).toBeGreaterThanOrEqual(0);
    });

    it("should calculate overall score", () => {
      const profile = createMockProfile();
      const result = profiler.profile(profile);

      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
    });

    it("should score GPU higher when available", () => {
      const noGPU = createMockProfile();
      const withGPU = createMockProfile({
        gpu: {
          type: GPUType.CUDA,
          name: "NVIDIA RTX 4090",
          vramMB: 24576,
          availableVRAMMB: 24576,
          available: true,
          features: [],
        },
      });

      const noGPUScore = profiler.profile(noGPU);
      const withGPUScore = profiler.profile(withGPU);

      expect(withGPUScore.componentScores.gpu).toBeGreaterThan(noGPUScore.componentScores.gpu);
    });

    it("should score NPU higher when available", () => {
      const noNPU = createMockProfile();
      const withNPU = createMockProfile({
        npu: {
          available: true,
          name: "Test NPU",
          vendor: "Test",
          tops: 50,
          supportedPrecision: ["int8", "fp16"],
          computeAvailable: true,
        },
      });

      const noNPUScore = profiler.profile(noNPU);
      const withNPUScore = profiler.profile(withNPU);

      expect(withNPUScore.componentScores.npu).toBeGreaterThan(noNPUScore.componentScores.npu);
    });
  });

  describe("Capability Categories", () => {
    it("should determine simple query capability", () => {
      const profile = createMockProfile();
      const result = profiler.profile(profile);

      expect(result.categories.simpleQuery).toBeDefined();
      expect(typeof result.categories.simpleQuery).toBe("boolean");
    });

    it("should determine complex reasoning capability", () => {
      const profile = createMockProfile();
      const result = profiler.profile(profile);

      expect(result.categories.complexReasoning).toBeDefined();
      expect(typeof result.categories.complexReasoning).toBe("boolean");
    });

    it("should determine ML inference capability", () => {
      const noGPU = createMockProfile();
      const withGPU = createMockProfile({
        gpu: {
          type: GPUType.CUDA,
          name: "NVIDIA RTX 4090",
          vramMB: 24576,
          availableVRAMMB: 24576,
          available: true,
          features: [],
        },
      });

      const noGPUResult = profiler.profile(noGPU);
      const withGPUResult = profiler.profile(withGPU);

      expect(withGPUResult.categories.mlInference).toBe(true);
    });

    it("should determine ML training capability", () => {
      const weakGPU = createMockProfile({
        gpu: {
          type: GPUType.CUDA,
          name: "NVIDIA GTX 1660",
          vramMB: 2048,
          availableVRAMMB: 2048,
          available: true,
          features: [],
        },
      });

      const strongGPU = createMockProfile({
        gpu: {
          type: GPUType.CUDA,
          name: "NVIDIA RTX 4090",
          vramMB: 24576,
          availableVRAMMB: 24576,
          available: true,
          features: [],
        },
      });

      const weakResult = profiler.profile(weakGPU);
      const strongResult = profiler.profile(strongGPU);

      // Weak GPU should not be suitable for training
      expect(weakResult.categories.mlTraining).toBe(false);

      // Strong GPU should be suitable for training
      expect(strongResult.categories.mlTraining).toBe(true);
    });
  });

  describe("Operation Scoring", () => {
    it("should score simple queries highly", () => {
      const profile = createMockProfile();
      const score = profiler.scoreOperation(OperationType.SIMPLE_QUERY, profile);

      expect(score).toBeGreaterThan(50);
    });

    it("should score ML inference higher with NPU", () => {
      const withoutNPU = createMockProfile();
      const withNPU = createMockProfile({
        npu: {
          available: true,
          name: "Test NPU",
          vendor: "Test",
          tops: 50,
          supportedPrecision: ["int8", "fp16"],
          computeAvailable: true,
        },
      });

      const withoutScore = profiler.scoreOperation(OperationType.ML_INFERENCE, withoutNPU);
      const withScore = profiler.scoreOperation(OperationType.ML_INFERENCE, withNPU);

      expect(withScore).toBeGreaterThan(withoutScore);
    });

    it("should score ML training higher with more VRAM", () => {
      const lowVRAM = createMockProfile({
        gpu: {
          type: GPUType.CUDA,
          name: "NVIDIA GTX 1660",
          vramMB: 2048,
          availableVRAMMB: 2048,
          available: true,
          features: [],
        },
      });

      const highVRAM = createMockProfile({
        gpu: {
          type: GPUType.CUDA,
          name: "NVIDIA RTX 4090",
          vramMB: 24576,
          availableVRAMMB: 24576,
          available: true,
          features: [],
        },
      });

      const lowScore = profiler.scoreOperation(OperationType.ML_TRAINING, lowVRAM);
      const highScore = profiler.scoreOperation(OperationType.ML_TRAINING, highVRAM);

      expect(highScore).toBeGreaterThan(lowScore);
    });

    it("should score vector operations higher with SIMD", () => {
      const noSIMD = createMockProfile({
        cpu: {
          ...createMockProfile().cpu,
          simd: {
            sse: false,
            sse2: false,
            sse3: false,
            sse4_1: false,
            sse4_2: false,
            avx: false,
            avx2: false,
            avx512: false,
            neon: false,
          },
        },
      });

      const withSIMD = createMockProfile();
      const withAVX2 = createMockProfile({
        cpu: {
          ...createMockProfile().cpu,
          simd: {
            sse: true,
            sse2: true,
            sse3: true,
            sse4_1: true,
            sse4_2: true,
            avx: true,
            avx2: true,
            avx512: false,
            neon: false,
          },
        },
      });

      const noSIMDScore = profiler.scoreOperation(OperationType.VECTOR_OPS, noSIMD);
      const withSIMDScore = profiler.scoreOperation(OperationType.VECTOR_OPS, withSIMD);
      const withAVX2Score = profiler.scoreOperation(OperationType.VECTOR_OPS, withAVX2);

      expect(withAVX2Score).toBeGreaterThan(withSIMDScore);
      expect(withSIMDScore).toBeGreaterThan(noSIMDScore);
    });

    it("should score video processing zero without GPU", () => {
      const noGPU = createMockProfile();
      const score = profiler.scoreOperation(OperationType.VIDEO_PROCESSING, noGPU);

      expect(score).toBe(0);
    });

    it("should score video processing positively with GPU", () => {
      const withGPU = createMockProfile({
        gpu: {
          type: GPUType.CUDA,
          name: "NVIDIA RTX 4090",
          vramMB: 24576,
          availableVRAMMB: 24576,
          available: true,
          features: [],
        },
      });

      const score = profiler.scoreOperation(OperationType.VIDEO_PROCESSING, withGPU);

      expect(score).toBeGreaterThan(0);
    });

    it("should reduce score when thermally constrained", () => {
      const normalThermal = createMockProfile({
        thermal: { state: "normal", throttling: false },
      });

      const highThermal = createMockProfile({
        thermal: { state: "high", throttling: false },
      });

      const criticalThermal = createMockProfile({
        thermal: { state: "critical", throttling: true },
      });

      const normalScore = profiler.scoreOperation(OperationType.ML_INFERENCE, normalThermal);
      const highScore = profiler.scoreOperation(OperationType.ML_INFERENCE, highThermal);
      const criticalScore = profiler.scoreOperation(OperationType.ML_INFERENCE, criticalThermal);

      expect(normalScore).toBeGreaterThan(highScore);
      expect(highScore).toBeGreaterThan(criticalScore);
    });

    it("should reduce score when memory pressure is high", () => {
      const normalMemory = createMockProfile({
        memory: {
          totalMB: 32768,
          availableMB: 16384,
          usedMB: 16384,
          usagePercent: 50,
          fragmentationPercent: 10,
        },
      });

      const highMemory = createMockProfile({
        memory: {
          totalMB: 32768,
          availableMB: 2048,
          usedMB: 30720,
          usagePercent: 94,
          fragmentationPercent: 10,
        },
      });

      const normalScore = profiler.scoreOperation(OperationType.ML_INFERENCE, normalMemory);
      const highScore = profiler.scoreOperation(OperationType.ML_INFERENCE, highMemory);

      expect(normalScore).toBeGreaterThan(highScore);
    });
  });

  describe("Hardware Recommendations", () => {
    it("should recommend CPU for simple queries", () => {
      const profile = createMockProfile();
      const recommendations = profiler.getRecommendedHardware(
        OperationType.SIMPLE_QUERY,
        profile
      );

      expect(recommendations).toContain("cpu");
    });

    it("should recommend GPU for ML inference when available", () => {
      const profile = createMockProfile({
        gpu: {
          type: GPUType.CUDA,
          name: "NVIDIA RTX 4090",
          vramMB: 24576,
          availableVRAMMB: 24576,
          available: true,
          features: [],
        },
      });

      const recommendations = profiler.getRecommendedHardware(
        OperationType.ML_INFERENCE,
        profile
      );

      expect(recommendations).toContain("gpu-cuda");
    });

    it("should recommend NPU first when available", () => {
      const profile = createMockProfile({
        npu: {
          available: true,
          name: "Test NPU",
          vendor: "Test",
          tops: 50,
          supportedPrecision: ["int8", "fp16"],
          computeAvailable: true,
        },
        gpu: {
          type: GPUType.CUDA,
          name: "NVIDIA RTX 4090",
          vramMB: 24576,
          availableVRAMMB: 24576,
          available: true,
          features: [],
        },
      });

      const recommendations = profiler.getRecommendedHardware(
        OperationType.ML_INFERENCE,
        profile
      );

      expect(recommendations[0]).toBe("npu");
    });

    it("should recommend cloud for ML training without sufficient GPU", () => {
      const profile = createMockProfile({
        gpu: {
          type: GPUType.NONE,
          name: "No GPU",
          vramMB: 0,
          availableVRAMMB: 0,
          available: false,
          features: [],
        },
      });

      const recommendations = profiler.getRecommendedHardware(
        OperationType.ML_TRAINING,
        profile
      );

      expect(recommendations).toContain("cloud");
    });

    it("should recommend CPU-SIMD for vector operations", () => {
      const profile = createMockProfile();
      const recommendations = profiler.getRecommendedHardware(
        OperationType.VECTOR_OPS,
        profile
      );

      expect(recommendations).toContain("cpu-simd");
    });

    it("should always include cloud as fallback", () => {
      const profile = createMockProfile();
      const operations: OperationType[] = [
        "simple_query",
        "complex_reasoning",
        "ml_inference",
        "vector_ops",
        "embedding_gen",
      ];

      operations.forEach(op => {
        const recommendations = profiler.getRecommendedHardware(op, profile);
        expect(recommendations[recommendations.length - 1]).toBe("cloud");
      });
    });
  });

  describe("Configuration", () => {
    it("should respect custom weights", () => {
      const gpuHeavyProfiler = new CapabilityProfiler({
        gpuWeight: 0.7,
        cpuWeight: 0.1,
        memoryWeight: 0.1,
        npuWeight: 0.1,
      });

      const profile = createMockProfile({
        gpu: {
          type: GPUType.CUDA,
          name: "NVIDIA RTX 4090",
          vramMB: 24576,
          availableVRAMMB: 24576,
          available: true,
          features: [],
        },
      });

      const result = gpuHeavyProfiler.profile(profile);

      // GPU-heavy profile should favor GPU more
      expect(result.componentScores.gpu).toBeGreaterThan(0);
    });

    it("should respect thermal threshold", () => {
      const sensitiveProfiler = new CapabilityProfiler({
        thermalThreshold: "elevated",
      });

      const profile = createMockProfile({
        thermal: { state: "elevated", throttling: false },
      });

      const score = sensitiveProfiler.scoreOperation(OperationType.ML_INFERENCE, profile);

      // Should be capped at 50% due to thermal threshold
      expect(score).toBeLessThanOrEqual(50);
    });
  });
});

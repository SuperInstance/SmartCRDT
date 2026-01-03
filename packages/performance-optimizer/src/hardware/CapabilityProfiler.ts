/**
 * CapabilityProfiler - Hardware capability scoring and operation matching
 *
 * Profiles hardware capabilities and scores them for different operations:
 * - Calculates capability scores (GPU, CPU, Memory, NPU)
 * - Matches operations to optimal hardware
 * - Provides recommendations for routing decisions
 *
 * @example
 * ```typescript
 * const profiler = new CapabilityProfiler();
 * const result = profiler.profile(hardwareProfile);
 * console.log('Overall Score:', result.overallScore);
 * ```
 */

import type {
  CapabilityScoringResult,
  HardwareProfile,
  HardwareTarget,
  ICapabilityProfiler,
  CapabilityProfilerConfig,
} from "@lsi/protocol";
import {
  OperationType,
} from "@lsi/protocol";

/**
 * CapabilityProfiler implementation
 */
export class CapabilityProfiler implements ICapabilityProfiler {
  private config: Required<CapabilityProfilerConfig>;

  constructor(config: CapabilityProfilerConfig = {}) {
    this.config = {
      gpuWeight: config.gpuWeight ?? 0.35,
      cpuWeight: config.cpuWeight ?? 0.25,
      memoryWeight: config.memoryWeight ?? 0.2,
      npuWeight: config.npuWeight ?? 0.2,
      thermalThreshold: config.thermalThreshold ?? "high",
      memoryPressureThreshold: config.memoryPressureThreshold ?? 85,
    };
  }

  /**
   * Profile hardware capabilities
   */
  profile(profile: HardwareProfile): CapabilityScoringResult {
    const componentScores = this.calculateComponentScores(profile);
    const overallScore = this.calculateOverallScore(componentScores);
    const categories = this.determineCapabilityCategories(profile, componentScores);

    return {
      overallScore,
      componentScores,
      categories,
    };
  }

  /**
   * Score operation suitability for hardware
   */
  scoreOperation(operation: OperationType, hardwareProfile: HardwareProfile): number {
    const { gpu, cpu, memory, npu, thermal } = hardwareProfile;

    // Check thermal constraints
    if (this.isThermallyConstrained(thermal.state)) {
      return Math.max(0, 50); // Cap at 50% if thermally constrained
    }

    // Check memory pressure
    if (memory.usagePercent > this.config.memoryPressureThreshold) {
      return Math.max(0, 40); // Cap at 40% if memory pressure is high
    }

    // Score based on operation type
    switch (operation) {
      case OperationType.SIMPLE_QUERY:
        return this.scoreSimpleQuery(cpu, memory);

      case OperationType.COMPLEX_REASONING:
        return this.scoreComplexReasoning(cpu, memory, gpu);

      case OperationType.ML_INFERENCE:
        return this.scoreMLInference(gpu, npu, cpu);

      case OperationType.ML_TRAINING:
        return this.scoreMLTraining(gpu, memory);

      case OperationType.VECTOR_OPS:
        return this.scoreVectorOps(cpu, gpu);

      case OperationType.MATRIX_OPS:
        return this.scoreMatrixOps(gpu, cpu);

      case OperationType.VIDEO_PROCESSING:
        return this.scoreVideoProcessing(gpu, memory);

      case OperationType.EMBEDDING_GEN:
        return this.scoreEmbeddingGen(gpu, npu, cpu);

      case OperationType.EMBEDDING_SEARCH:
        return this.scoreEmbeddingSearch(cpu, memory);

      case OperationType.GENERAL_COMPUTE:
        return this.scoreGeneralCompute(cpu, memory);

      default:
        return 50; // Default score
    }
  }

  /**
   * Get recommended hardware for operation
   */
  getRecommendedHardware(
    operation: OperationType,
    hardwareProfile: HardwareProfile
  ): HardwareTarget[] {
    const recommendations: HardwareTarget[] = [];
    const { gpu, cpu, npu, thermal } = hardwareProfile;

    // Don't recommend GPU if thermally constrained
    const canUseGPU = gpu.available && !this.isThermallyConstrained(thermal.state);
    const canUseNPU = npu.available && !this.isThermallyConstrained(thermal.state);

    switch (operation) {
      case OperationType.SIMPLE_QUERY:
        recommendations.push("cpu");
        if (cpu.simd.avx || cpu.simd.avx2 || cpu.simd.neon) {
          recommendations.push("cpu-simd");
        }
        break;

      case OperationType.COMPLEX_REASONING:
        if (canUseGPU) {
          if (gpu.type === "cuda") recommendations.push("gpu-cuda");
          else if (gpu.type === "metal") recommendations.push("gpu-metal");
          else if (gpu.type === "webgpu") recommendations.push("gpu-webgpu");
        }
        recommendations.push("cpu");
        break;

      case OperationType.ML_INFERENCE:
        if (canUseNPU) {
          recommendations.push("npu");
        }
        if (canUseGPU) {
          if (gpu.type === "cuda") recommendations.push("gpu-cuda");
          else if (gpu.type === "metal") recommendations.push("gpu-metal");
          else if (gpu.type === "webgpu") recommendations.push("gpu-webgpu");
        }
        recommendations.push("cpu");
        break;

      case OperationType.ML_TRAINING:
        if (canUseGPU && gpu.vramMB >= 4096) {
          if (gpu.type === "cuda") recommendations.push("gpu-cuda");
          else if (gpu.type === "metal") recommendations.push("gpu-metal");
        } else {
          // Training on CPU is not recommended, go to cloud
          recommendations.push("cloud");
        }
        break;

      case OperationType.VECTOR_OPS:
        if (canUseGPU) {
          recommendations.push("gpu-cuda", "gpu-metal", "gpu-webgpu");
        }
        if (cpu.simd.avx || cpu.simd.avx2 || cpu.simd.neon) {
          recommendations.push("cpu-simd");
        }
        recommendations.push("cpu");
        break;

      case OperationType.MATRIX_OPS:
        if (canUseGPU) {
          recommendations.push("gpu-cuda", "gpu-metal");
        }
        recommendations.push("cpu-simd", "cpu");
        break;

      case OperationType.VIDEO_PROCESSING:
        if (canUseGPU) {
          if (gpu.type === "cuda") recommendations.push("gpu-cuda");
          else if (gpu.type === "metal") recommendations.push("gpu-metal");
        } else {
          // Video processing really needs GPU
          recommendations.push("cloud");
        }
        break;

      case OperationType.EMBEDDING_GEN:
        if (canUseNPU) {
          recommendations.push("npu");
        }
        if (canUseGPU) {
          if (gpu.type === "cuda") recommendations.push("gpu-cuda");
          else if (gpu.type === "metal") recommendations.push("gpu-metal");
        }
        recommendations.push("cpu");
        break;

      case OperationType.EMBEDDING_SEARCH:
        if (cpu.simd.avx || cpu.simd.avx2 || cpu.simd.neon) {
          recommendations.push("cpu-simd");
        }
        recommendations.push("cpu");
        break;

      case OperationType.GENERAL_COMPUTE:
        recommendations.push("cpu");
        if (cpu.simd.avx || cpu.simd.avx2) {
          recommendations.push("cpu-simd");
        }
        break;

      default:
        recommendations.push("cpu");
        break;
    }

    // Always add cloud as fallback
    if (recommendations[recommendations.length - 1] !== "cloud") {
      recommendations.push("cloud");
    }

    return recommendations;
  }

  // ==========================================================================
  // PRIVATE SCORING METHODS
  // ==========================================================================

  private calculateComponentScores(profile: HardwareProfile) {
    const { gpu, cpu, memory, npu } = profile;

    return {
      gpu: this.scoreGPU(gpu),
      cpu: this.scoreCPU(cpu),
      memory: this.scoreMemory(memory),
      npu: this.scoreNPU(npu),
    };
  }

  private calculateOverallScore(componentScores: {
    gpu: number;
    cpu: number;
    memory: number;
    npu: number;
  }): number {
    const { gpuWeight, cpuWeight, memoryWeight, npuWeight } = this.config;

    const score =
      componentScores.gpu * gpuWeight +
      componentScores.cpu * cpuWeight +
      componentScores.memory * memoryWeight +
      componentScores.npu * npuWeight;

    return Math.round(score);
  }

  private determineCapabilityCategories(
    profile: HardwareProfile,
    scores: { gpu: number; cpu: number; memory: number; npu: number }
  ) {
    const { gpu, cpu, memory, npu } = profile;

    return {
      simpleQuery: cpu.logicalCores >= 4 && memory.availableMB >= 512,
      complexReasoning:
        (cpu.logicalCores >= 8 && memory.availableMB >= 2048) ||
        (gpu.available && gpu.vramMB >= 2048),
      mlInference: gpu.available || npu.available,
      mlTraining: gpu.available && gpu.vramMB >= 4096 && memory.availableMB >= 8192,
      vectorOps: cpu.simd.avx || cpu.simd.avx2 || cpu.simd.neon || gpu.available,
      matrixOps: gpu.available || (cpu.simd.avx || cpu.simd.avx2 || cpu.simd.neon),
      videoProcessing: gpu.available && gpu.vramMB >= 2048,
    };
  }

  private scoreGPU(gpu: typeof HardwareProfile.prototype.gpu): number {
    if (!gpu.available) return 0;

    let score = 50; // Base score for having a GPU

    // VRAM score (up to 30 points)
    score += Math.min(30, (gpu.vramMB / 24576) * 30);

    // Compute capability score (up to 20 points)
    if (gpu.computeCapability) {
      const version = parseFloat(gpu.computeCapability);
      if (version >= 8.0) score += 20;
      else if (version >= 7.0) score += 15;
      else if (version >= 6.0) score += 10;
      else if (version >= 5.0) score += 5;
    }

    return Math.min(100, Math.round(score));
  }

  private scoreCPU(cpu: typeof HardwareProfile.prototype.cpu): number {
    let score = 0;

    // Core count score (up to 50 points)
    score += Math.min(50, (cpu.logicalCores / 64) * 50);

    // Clock speed score (up to 30 points)
    score += Math.min(30, (cpu.maxClockMHz / 6000) * 30);

    // SIMD support score (up to 20 points)
    if (cpu.simd.avx512) score += 20;
    else if (cpu.simd.avx2) score += 15;
    else if (cpu.simd.avx) score += 10;
    else if (cpu.simd.neon) score += 15;
    else if (cpu.simd.sse4_2) score += 5;

    return Math.min(100, Math.round(score));
  }

  private scoreMemory(memory: typeof HardwareProfile.prototype.memory): number {
    // Score based on available memory (not total)
    const availableGB = memory.availableMB / 1024;

    if (availableGB >= 64) return 100;
    if (availableGB >= 32) return 90;
    if (availableGB >= 16) return 75;
    if (availableGB >= 8) return 60;
    if (availableGB >= 4) return 45;
    if (availableGB >= 2) return 30;
    if (availableGB >= 1) return 15;
    return 5;
  }

  private scoreNPU(npu: typeof HardwareProfile.prototype.npu): number {
    if (!npu.available) return 0;

    let score = 60; // Base score for having an NPU

    // TOPS score (if available)
    if (npu.tops) {
      score += Math.min(40, (npu.tops / 100) * 40); // 100 TOPS = max score
    }

    return Math.min(100, Math.round(score));
  }

  // ==========================================================================
  // OPERATION-SPECIFIC SCORING
  // ==========================================================================

  private scoreSimpleQuery(
    cpu: typeof HardwareProfile.prototype.cpu,
    memory: typeof HardwareProfile.prototype.memory
  ): number {
    // Simple queries don't need much
    let score = 80; // Base score

    if (cpu.logicalCores >= 2) score += 10;
    if (memory.availableMB >= 256) score += 10;

    return Math.min(100, score);
  }

  private scoreComplexReasoning(
    cpu: typeof HardwareProfile.prototype.cpu,
    memory: typeof HardwareProfile.prototype.memory,
    gpu: typeof HardwareProfile.prototype.gpu
  ): number {
    let score = 0;

    // CPU contribution
    score += Math.min(40, (cpu.logicalCores / 16) * 40);

    // Memory contribution
    score += Math.min(30, (memory.availableMB / 8192) * 30);

    // GPU contribution (significant for complex reasoning)
    if (gpu.available) {
      score += Math.min(30, (gpu.vramMB / 8192) * 30);
    }

    return Math.min(100, Math.round(score));
  }

  private scoreMLInference(
    gpu: typeof HardwareProfile.prototype.gpu,
    npu: typeof HardwareProfile.prototype.npu,
    cpu: typeof HardwareProfile.prototype.cpu
  ): number {
    // NPU is ideal for inference
    if (npu.available && npu.computeAvailable) {
      return 95;
    }

    // GPU is good for inference
    if (gpu.available && gpu.vramMB >= 2048) {
      return Math.min(100, 70 + (gpu.vramMB / 8192) * 30);
    }

    // CPU can do inference but slower
    if (cpu.logicalCores >= 8 && (cpu.simd.avx || cpu.simd.neon)) {
      return 50;
    }

    return 30; // Not ideal but possible
  }

  private scoreMLTraining(
    gpu: typeof HardwareProfile.prototype.gpu,
    memory: typeof HardwareProfile.prototype.memory
  ): number {
    // Training needs substantial GPU VRAM and system memory
    if (!gpu.available) {
      return 0; // Cannot train on CPU efficiently
    }

    let score = 0;

    // VRAM requirement (at least 4GB, ideally 16GB+)
    if (gpu.vramMB >= 16384) score += 50;
    else if (gpu.vramMB >= 8192) score += 40;
    else if (gpu.vramMB >= 4096) score += 25;
    else return 0; // Not enough VRAM

    // System memory
    score += Math.min(30, (memory.availableMB / 32768) * 30);

    // Compute capability
    if (gpu.computeCapability) {
      const version = parseFloat(gpu.computeCapability);
      if (version >= 7.0) score += 20;
      else if (version >= 6.0) score += 10;
    }

    return Math.min(100, Math.round(score));
  }

  private scoreVectorOps(
    cpu: typeof HardwareProfile.prototype.cpu,
    gpu: typeof HardwareProfile.prototype.gpu
  ): number {
    // GPU is ideal for vector ops
    if (gpu.available) {
      return 90;
    }

    // SIMD-enabled CPU is good
    if (cpu.simd.avx2 || cpu.simd.neon) {
      return 75;
    }

    if (cpu.simd.avx || cpu.simd.sse4_2) {
      return 60;
    }

    return 40; // Basic CPU
  }

  private scoreMatrixOps(
    gpu: typeof HardwareProfile.prototype.gpu,
    cpu: typeof HardwareProfile.prototype.cpu
  ): number {
    // GPU is ideal for matrix ops
    if (gpu.available && gpu.vramMB >= 2048) {
      return 95;
    }

    // SIMD-enabled CPU
    if (cpu.simd.avx2 || cpu.simd.neon) {
      return 65;
    }

    return 30; // Not ideal
  }

  private scoreVideoProcessing(
    gpu: typeof HardwareProfile.prototype.gpu,
    memory: typeof HardwareProfile.prototype.memory
  ): number {
    // Video processing needs GPU
    if (!gpu.available) {
      return 0;
    }

    let score = 50;

    // VRAM requirement
    if (gpu.vramMB >= 4096) score += 30;
    else if (gpu.vramMB >= 2048) score += 15;

    // System memory
    score += Math.min(20, (memory.availableMB / 4096) * 20);

    return Math.min(100, Math.round(score));
  }

  private scoreEmbeddingGen(
    gpu: typeof HardwareProfile.prototype.gpu,
    npu: typeof HardwareProfile.prototype.npu,
    cpu: typeof HardwareProfile.prototype.cpu
  ): number {
    // NPU is ideal for embeddings
    if (npu.available && npu.computeAvailable) {
      return 95;
    }

    // GPU is good
    if (gpu.available) {
      return 85;
    }

    // CPU with SIMD is acceptable
    if (cpu.simd.avx2 || cpu.simd.neon) {
      return 60;
    }

    return 40;
  }

  private scoreEmbeddingSearch(
    cpu: typeof HardwareProfile.prototype.cpu,
    memory: typeof HardwareProfile.prototype.memory
  ): number {
    // Embedding search is mostly CPU and memory bound
    let score = 0;

    // CPU score
    score += Math.min(50, (cpu.logicalCores / 16) * 50);

    // Memory score
    score += Math.min(50, (memory.availableMB / 16384) * 50);

    return Math.min(100, Math.round(score));
  }

  private scoreGeneralCompute(
    cpu: typeof HardwareProfile.prototype.cpu,
    memory: typeof HardwareProfile.prototype.memory
  ): number {
    let score = 0;

    // CPU score
    score += Math.min(60, (cpu.logicalCores / 16) * 60);

    // Memory score
    score += Math.min(40, (memory.availableMB / 8192) * 40);

    return Math.min(100, Math.round(score));
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  private isThermallyConstrained(thermalState: string): boolean {
    const threshold = this.config.thermalThreshold;
    const stateOrder = ["normal", "elevated", "high", "critical"];
    const thresholdIndex = stateOrder.indexOf(threshold);
    const stateIndex = stateOrder.indexOf(thermalState);

    return stateIndex >= thresholdIndex;
  }
}

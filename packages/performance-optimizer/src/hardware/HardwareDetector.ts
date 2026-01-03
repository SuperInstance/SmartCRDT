/**
 * HardwareDetector - Comprehensive hardware detection and profiling
 *
 * Detects and profiles:
 * - GPU (CUDA, Metal, WebGPU, OpenCL, Vulkan)
 * - CPU (cores, frequency, SIMD support)
 * - Memory (total, available, fragmentation)
 * - NPU/TPU availability
 * - Thermal state
 *
 * @example
 * ```typescript
 * const detector = new HardwareDetector();
 * const result = await detector.detect();
 * if (result.success && result.profile) {
 *   console.log('GPU:', result.profile.gpu.name);
 *   console.log('Capability Score:', result.profile.capabilityScore);
 * }
 * ```
 */

import { exec } from "child_process";
import { promisify } from "util";
import os from "os";
import type {
  HardwareDetectionResult,
  HardwareProfile,
  GPUInfo,
  CPUInfo,
  MemoryInfo,
  NPUInfo,
  ThermalInfo,
  IHardwareDetector,
  HardwareDetectorConfig,
} from "@lsi/protocol";
import {
  GPUType,
  ThermalState,
} from "@lsi/protocol";

const execAsync = promisify(exec);

/**
 * HardwareDetector implementation
 */
export class HardwareDetector implements IHardwareDetector {
  private config: Required<HardwareDetectorConfig>;
  private cachedProfile: HardwareProfile | null = null;
  private cacheTimestamp: number = 0;
  private eventListeners: Map<string, Array<(event: unknown) => void>> = new Map();

  constructor(config: HardwareDetectorConfig = {}) {
    this.config = {
      detectGPU: config.detectGPU ?? true,
      profileCPU: config.profileCPU ?? true,
      monitorMemory: config.monitorMemory ?? true,
      detectNPU: config.detectNPU ?? true,
      monitorThermal: config.monitorThermal ?? true,
      cacheTTL: config.cacheTTL ?? 60000, // 1 minute default
      detectionTimeout: config.detectionTimeout ?? 5000, // 5 seconds
      nvidiaSmiPath: config.nvidiaSmiPath ?? "nvidia-smi",
      systemProfilerPath: config.systemProfilerPath ?? "system_profiler",
    };
  }

  /**
   * Detect all hardware
   */
  async detect(): Promise<HardwareDetectionResult> {
    const startTime = Date.now();

    try {
      // Check cache
      if (this.cachedProfile && Date.now() - this.cacheTimestamp < this.config.cacheTTL) {
        return {
          success: true,
          profile: this.cachedProfile,
          detectionTime: Date.now() - startTime,
        };
      }

      // Detect hardware components
      const [gpu, cpu, memory, npu, thermal] = await Promise.all([
        this.detectGPU(),
        this.detectCPU(),
        this.detectMemory(),
        this.detectNPU(),
        this.detectThermal(),
      ]);

      // Create hardware profile
      const profile: HardwareProfile = {
        timestamp: Date.now(),
        gpu,
        cpu,
        memory,
        npu,
        thermal,
        capabilityScore: this.calculateCapabilityScore({ gpu, cpu, memory, npu }),
        capabilities: this.calculateCapabilities({ gpu, cpu, memory, npu }),
      };

      // Cache profile
      this.cachedProfile = profile;
      this.cacheTimestamp = Date.now();

      return {
        success: true,
        profile,
        detectionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        detectionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Get cached hardware profile
   */
  getProfile(): HardwareProfile | null {
    return this.cachedProfile;
  }

  /**
   * Check if GPU is available
   */
  hasGPU(): boolean {
    return this.cachedProfile?.gpu.available ?? false;
  }

  /**
   * Check if NPU is available
   */
  hasNPU(): boolean {
    return this.cachedProfile?.npu.available ?? false;
  }

  /**
   * Get thermal state
   */
  getThermalState(): ThermalState {
    return this.cachedProfile?.thermal.state ?? ThermalState.UNKNOWN;
  }

  /**
   * Clear hardware detection cache
   */
  clearCache(): void {
    this.cachedProfile = null;
    this.cacheTimestamp = 0;
  }

  // ==========================================================================
  // PRIVATE DETECTION METHODS
  // ==========================================================================

  /**
   * Detect GPU information
   */
  private async detectGPU(): Promise<GPUInfo> {
    if (!this.config.detectGPU) {
      return this.getEmptyGPU();
    }

    const platform = os.platform();

    // Try CUDA first (most common for ML)
    if (platform === "linux" || platform === "win32") {
      const cudaGPU = await this.detectCUDAGPU();
      if (cudaGPU.available) {
        return cudaGPU;
      }
    }

    // Try Metal on macOS
    if (platform === "darwin") {
      const metalGPU = await this.detectMetalGPU();
      if (metalGPU.available) {
        return metalGPU;
      }
    }

    // Try WebGPU (cross-platform)
    const webgpuGPU = await this.detectWebGPUGPU();
    if (webgpuGPU.available) {
      return webgpuGPU;
    }

    // Try OpenCL
    const openclGPU = await this.detectOpenCLGPU();
    if (openclGPU.available) {
      return openclGPU;
    }

    // Try Vulkan
    const vulkanGPU = await this.detectVulkanGPU();
    if (vulkanGPU.available) {
      return vulkanGPU;
    }

    return this.getEmptyGPU();
  }

  /**
   * Detect CUDA GPU
   */
  private async detectCUDAGPU(): Promise<GPUInfo> {
    try {
      const { stdout } = await execAsync(
        `${this.config.nvidiaSmiPath} --query-gpu=name,memory.total,driver_version,cuda_version,compute_cap --format=csv,noheader`,
        { timeout: this.config.detectionTimeout }
      );

      const parts = stdout.trim().split(",");
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const vramMB = this.parseMemoryMB(parts[1].trim());
        const driverVersion = parts[2]?.trim();
        const cudaVersion = parts[3]?.trim();
        const computeCapability = parts[4]?.trim();

        // Get detailed memory info
        const memoryOutput = await execAsync(
          `${this.config.nvidiaSmiPath} --query-gpu=memory.free,memory.total --format=csv,noheader,nounits`,
          { timeout: this.config.detectionTimeout }
        );

        const memoryParts = memoryOutput.stdout.trim().split(/\s+/);
        const availableVRAMMB = parseInt(memoryParts[0], 10);

        return {
          type: GPUType.CUDA,
          name,
          vramMB,
          availableVRAMMB: availableVRAMMB || vramMB,
          computeCapability,
          driverVersion,
          cudaVersion,
          features: computeCapability ? [computeCapability] : [],
          available: true,
        };
      }
    } catch (error) {
      // nvidia-smi not available or failed
    }

    return this.getEmptyGPU();
  }

  /**
   * Detect Metal GPU (macOS)
   */
  private async detectMetalGPU(): Promise<GPUInfo> {
    try {
      const { stdout } = await execAsync(
        `${this.config.systemProfilerPath} SPDisplaysDataType | grep -A 3 "Chipset Model"`,
        { timeout: this.config.detectionTimeout }
      );

      const match = stdout.match(/Chipset Model: (.+)/);
      if (match) {
        const name = match[1].trim();
        const vramMBMatch = stdout.match(/VRAM.*?(\d+)\s*(MB|GB)/i);

        let vramMB = 0;
        if (vramMBMatch) {
          const value = parseInt(vramMBMatch[1], 10);
          const unit = vramMBMatch[2].toUpperCase();
          vramMB = unit === "GB" ? value * 1024 : value;
        }

        return {
          type: GPUType.METAL,
          name,
          vramMB,
          availableVRAMMB: vramMB,
          metalVersion: this.getMetalVersion(),
          features: ["metal"],
          available: true,
        };
      }
    } catch (error) {
      // system_profiler not available or failed
    }

    return this.getEmptyGPU();
  }

  /**
   * Detect WebGPU (browser or Node.js with WebGPU)
   */
  private async detectWebGPUGPU(): Promise<GPUInfo> {
    // WebGPU detection requires a browser environment or specific Node.js setup
    // For now, we'll return empty but this could be enhanced with webgpu package
    return this.getEmptyGPU();
  }

  /**
   * Detect OpenCL GPU
   */
  private async detectOpenCLGPU(): Promise<GPUInfo> {
    try {
      const { stdout } = await execAsync("clinfo", { timeout: this.config.detectionTimeout });

      // Parse OpenCL device name
      const match = stdout.match(/Device Name.+?\n(.+)/);
      if (match) {
        const name = match[1].trim();

        return {
          type: GPUType.OPENCL,
          name,
          vramMB: 0, // OpenCL doesn't easily expose VRAM
          availableVRAMMB: 0,
          features: ["opencl"],
          available: true,
        };
      }
    } catch (error) {
      // clinfo not available
    }

    return this.getEmptyGPU();
  }

  /**
   * Detect Vulkan GPU
   */
  private async detectVulkanGPU(): Promise<GPUInfo> {
    try {
      const { stdout } = await execAsync("vulkaninfo --summary", { timeout: this.config.detectionTimeout });

      // Parse Vulkan device name
      const match = stdout.match(/deviceName.*?=.+?([A-Z][A-Za-z0-9\s]+)/);
      if (match) {
        const name = match[1].trim();

        return {
          type: GPUType.VULKAN,
          name,
          vramMB: 0,
          availableVRAMMB: 0,
          features: ["vulkan"],
          available: true,
        };
      }
    } catch (error) {
      // vulkaninfo not available
    }

    return this.getEmptyGPU();
  }

  /**
   * Detect CPU information
   */
  private async detectCPU(): Promise<CPUInfo> {
    const cpus = os.cpus();
    const platform = os.platform();

    if (cpus.length === 0) {
      return this.getEmptyCPU();
    }

    const cpu = cpus[0];
    const logicalCores = cpus.length;
    const physicalCores = this.estimatePhysicalCores(logicalCores);

    // Parse CPU model and speed
    const model = cpu.model;
    const maxClockMHz = Math.round(cpu.speed);
    const baseClockMHz = Math.round(maxClockMHz * 0.8); // Estimate base clock

    // Detect architecture
    const architecture = this.detectArchitecture();
    const vendor = this.detectCPUVendor(model);

    // Detect SIMD support
    const simd = this.detectSIMDSupport(architecture);

    // Estimate cache sizes
    const cache = this.estimateCacheSizes(architecture, physicalCores);

    // Get current CPU usage
    const currentUsage = await this.getCPUUsage();

    return {
      architecture,
      physicalCores,
      logicalCores,
      baseClockMHz,
      maxClockMHz,
      model,
      vendor,
      simd,
      cache,
      currentUsage,
    };
  }

  /**
   * Detect memory information
   */
  private async detectMemory(): Promise<MemoryInfo> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const totalMB = Math.round(totalMem / (1024 * 1024));
    const availableMB = Math.round(freeMem / (1024 * 1024));
    const usedMB = Math.round(usedMem / (1024 * 1024));
    const usagePercent = (usedMem / totalMem) * 100;

    return {
      totalMB,
      availableMB,
      usedMB,
      usagePercent,
      fragmentationPercent: this.estimateMemoryFragmentation(),
    };
  }

  /**
   * Detect NPU information
   */
  private async detectNPU(): Promise<NPUInfo> {
    const platform = os.platform();

    // Apple Neural Engine (macOS with Apple Silicon)
    if (platform === "darwin") {
      const appleNPU = await this.detectAppleNPU();
      if (appleNPU.available) {
        return appleNPU;
      }
    }

    // Intel NPU (Windows)
    if (platform === "win32") {
      const intelNPU = await this.detectIntelNPU();
      if (intelNPU.available) {
        return intelNPU;
      }
    }

    // Qualcomm NPU (Linux/Android)
    if (platform === "linux") {
      const qualcommNPU = await this.detectQualcommNPU();
      if (qualcommNPU.available) {
        return qualcommNPU;
      }
    }

    return {
      available: false,
      computeAvailable: false,
      supportedPrecision: [],
    };
  }

  /**
   * Detect thermal information
   */
  private async detectThermal(): Promise<ThermalInfo> {
    const platform = os.platform();

    if (platform === "linux") {
      return await this.detectLinuxThermal();
    } else if (platform === "darwin") {
      return await this.detectMacOSThermal();
    } else if (platform === "win32") {
      return await this.detectWindowsThermal();
    }

    return {
      state: ThermalState.UNKNOWN,
      throttling: false,
    };
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private getEmptyGPU(): GPUInfo {
    return {
      type: GPUType.NONE,
      name: "No GPU",
      vramMB: 0,
      availableVRAMMB: 0,
      available: false,
      features: [],
    };
  }

  private getEmptyCPU(): CPUInfo {
    return {
      architecture: "unknown",
      physicalCores: 0,
      logicalCores: 0,
      baseClockMHz: 0,
      maxClockMHz: 0,
      model: "Unknown CPU",
      vendor: "Unknown",
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
      cache: {
        l1KB: 0,
        l2KB: 0,
        l3KB: 0,
      },
    };
  }

  private parseMemoryMB(memStr: string): number {
    const match = memStr.match(/(\d+)\s*(MB|GB|MiB|GiB)/i);
    if (!match) return 0;

    const value = parseInt(match[1], 10);
    const unit = match[2].toUpperCase().replace("I", "");

    return unit === "GB" || unit === "GIB" ? value * 1024 : value;
  }

  private getMetalVersion(): string {
    // Return Metal version based on macOS version
    const release = os.release();
    const major = parseInt(release.split(".")[0], 10);

    if (major >= 23) return "Metal 3";
    if (major >= 21) return "Metal 2.3";
    if (major >= 19) return "Metal 2";
    if (major >= 16) return "Metal 1.2";
    return "Metal 1";
  }

  private estimatePhysicalCores(logicalCores: number): number {
    // Most modern CPUs have 2 threads per core
    // This is a rough estimate
    if (logicalCores <= 4) return logicalCores;
    if (logicalCores <= 8) return logicalCores / 2;
    return Math.ceil(logicalCores / 2);
  }

  private detectArchitecture(): CPUInfo["architecture"] {
    const arch = os.arch();
    if (arch === "x64") return "x64";
    if (arch === "arm64") return "arm64";
    if (arch === "ia32") return "x86";
    if (arch === "arm") return "arm";
    return "unknown";
  }

  private detectCPUVendor(model: string): CPUInfo["vendor"] {
    const modelLower = model.toLowerCase();
    if (modelLower.includes("intel")) return "Intel";
    if (modelLower.includes("amd")) return "AMD";
    if (modelLower.includes("apple")) return "Apple";
    if (modelLower.includes("qualcomm") || modelLower.includes("snapdragon")) return "ARM";
    return "Unknown";
  }

  private detectSIMDSupport(architecture: CPUInfo["architecture"]): CPUInfo["simd"] {
    const simd = {
      sse: false,
      sse2: false,
      sse3: false,
      sse4_1: false,
      sse4_2: false,
      avx: false,
      avx2: false,
      avx512: false,
      neon: false,
    };

    if (architecture === "x64" || architecture === "x86") {
      // x86 CPUs typically have SSE, SSE2, SSE3
      simd.sse = true;
      simd.sse2 = true;
      simd.sse3 = true;
      // Most modern x86 CPUs have AVX
      simd.avx = true;
      simd.sse4_1 = true;
      simd.sse4_2 = true;
      // AVX2 is common on newer CPUs
      simd.avx2 = true;
    } else if (architecture === "arm64") {
      // ARM64 CPUs have NEON
      simd.neon = true;
    }

    return simd;
  }

  private estimateCacheSizes(
    architecture: CPUInfo["architecture"],
    physicalCores: number
  ): CPUInfo["cache"] {
    // Typical cache sizes
    if (architecture === "x64") {
      return {
        l1KB: 32 * physicalCores,
        l2KB: 256 * physicalCores,
        l3KB: 8192, // Shared L3
      };
    } else if (architecture === "arm64") {
      return {
        l1KB: 64 * physicalCores,
        l2KB: 128 * physicalCores,
        l3KB: 0, // Many ARM chips don't have L3
      };
    }

    return {
      l1KB: 32 * physicalCores,
      l2KB: 256 * physicalCores,
      l3KB: 4096,
    };
  }

  private async getCPUUsage(): Promise<number> {
    const cpus1 = os.cpus();
    await new Promise(resolve => setTimeout(resolve, 100));
    const cpus2 = os.cpus();

    let totalIdle = 0;
    let totalTick = 0;

    for (let i = 0; i < cpus1.length; i++) {
      const cpu1 = cpus1[i];
      const cpu2 = cpus2[i];

      const idle = cpu2.times.idle - cpu1.times.idle;
      const total =
        (cpu2.times.user - cpu1.times.user) +
        (cpu2.times.sys - cpu1.times.sys) +
        (cpu2.times.idle - cpu1.times.idle);

      totalIdle += idle;
      totalTick += total;
    }

    return totalTick === 0 ? 0 : 100 - (totalIdle / totalTick) * 100;
  }

  private estimateMemoryFragmentation(): number {
    // Rough estimate based on heap statistics
    if (global.gc) {
      const before = process.memoryUsage().heapUsed;
      global.gc();
      const after = process.memoryUsage().heapUsed;
      return ((before - after) / before) * 100;
    }
    return 0;
  }

  // Platform-specific thermal detection
  private async detectLinuxThermal(): Promise<ThermalInfo> {
    try {
      const { stdout } = await execAsync("cat /sys/class/thermal/thermal_zone0/temp", {
        timeout: 1000,
      });
      const tempC = parseInt(stdout.trim(), 10) / 1000;

      return {
        state: this.classifyThermalState(tempC),
        cpuTempC: tempC,
        throttling: tempC > 85,
      };
    } catch {
      return {
        state: ThermalState.UNKNOWN,
        throttling: false,
      };
    }
  }

  private async detectMacOSThermal(): Promise<ThermalInfo> {
    try {
      const { stdout } = await execAsync("sysctl -n machdep.xcpm.cpu_thermal_level", {
        timeout: 1000,
      });
      const level = parseInt(stdout.trim(), 10);

      return {
        state: level === 0 ? ThermalState.NORMAL : ThermalState.ELEVATED,
        throttling: level > 0,
      };
    } catch {
      return {
        state: ThermalState.UNKNOWN,
        throttling: false,
      };
    }
  }

  private async detectWindowsThermal(): Promise<ThermalInfo> {
    // Windows thermal detection requires external tools
    return {
      state: ThermalState.UNKNOWN,
      throttling: false,
    };
  }

  // NPU detection methods
  private async detectAppleNPU(): Promise<NPUInfo> {
    try {
      const arch = os.arch();
      if (arch === "arm64") {
        return {
          available: true,
          name: "Apple Neural Engine",
          vendor: "Apple",
          tops: undefined, // Apple doesn't publish TOPS
          supportedPrecision: ["fp16", "int8"],
          computeAvailable: true,
        };
      }
    } catch {}
    return {
      available: false,
      computeAvailable: false,
      supportedPrecision: [],
    };
  }

  private async detectIntelNPU(): Promise<NPUInfo> {
    // Intel NPU detection would require checking device manager
    return {
      available: false,
      computeAvailable: false,
      supportedPrecision: [],
    };
  }

  private async detectQualcommNPU(): Promise<NPUInfo> {
    // Qualcomm NPU detection would require checking /sys/devices
    return {
      available: false,
      computeAvailable: false,
      supportedPrecision: [],
    };
  }

  private classifyThermalState(tempC: number): ThermalState {
    if (tempC < 60) return ThermalState.NORMAL;
    if (tempC < 75) return ThermalState.ELEVATED;
    if (tempC < 85) return ThermalState.HIGH;
    return ThermalState.CRITICAL;
  }

  private calculateCapabilityScore(hardware: {
    gpu: GPUInfo;
    cpu: CPUInfo;
    memory: MemoryInfo;
    npu: NPUInfo;
  }): number {
    let score = 0;

    // GPU score (40% weight)
    if (hardware.gpu.available) {
      score += 40 * (hardware.gpu.vramMB / 24576); // Max at 24GB
    }

    // CPU score (30% weight)
    score += 30 * (hardware.cpu.logicalCores / 64); // Max at 64 cores

    // Memory score (20% weight)
    score += 20 * (hardware.memory.totalMB / 131072); // Max at 128GB

    // NPU score (10% weight)
    if (hardware.npu.available) {
      score += 10;
    }

    return Math.min(100, Math.round(score));
  }

  private calculateCapabilities(hardware: {
    gpu: GPUInfo;
    cpu: CPUInfo;
    memory: MemoryInfo;
    npu: NPUInfo;
  }) {
    const hasGPU = hardware.gpu.available;
    const hasNPU = hardware.npu.available;
    const hasSIMD = hardware.cpu.simd.avx || hardware.cpu.simd.avx2 || hardware.cpu.simd.neon;

    return {
      gpuScore: hasGPU ? 80 : 0,
      cpuScore: Math.min(100, hardware.cpu.logicalCores * 2),
      memoryScore: Math.min(100, hardware.memory.totalMB / 1024),
      npuScore: hasNPU ? 90 : 0,
      supportedOperations: {
        mlInference: hasGPU || hasNPU,
        mlTraining: hasGPU,
        vectorOps: hasSIMD,
        matrixMul: hasGPU || hasSIMD,
        videoEncode: hasGPU,
        videoDecode: hasGPU || hasSIMD,
      },
    };
  }
}

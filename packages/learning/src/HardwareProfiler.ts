/**
 * HardwareProfiler - Detect and profile system hardware
 *
 * Detects CPU, memory, and GPU characteristics to enable
 * hardware-aware configuration and routing decisions.
 *
 * Privacy guarantees:
 * - No data leaves the local machine
 * - User can view/delete profile
 * - Minimal system fingerprinting
 */

import type { HardwareProfile } from './types.js';
import { execSync } from 'child_process';
import { cpus, totalmem, freemem, arch, platform } from 'os';

/**
 * Hardware profiler options
 */
export interface HardwareProfilerOptions {
  /** Whether to detect GPU */
  detectGPU?: boolean;
  /** Custom GPU detection command */
  gpuCommand?: string;
}

/**
 * Hardware profiler
 *
 * Detects system hardware capabilities and characteristics.
 */
export class HardwareProfiler {
  private detectGPU: boolean;
  private gpuCommand: string;

  constructor(options: HardwareProfilerOptions = {}) {
    this.detectGPU = options.detectGPU ?? true;
    this.gpuCommand = options.gpuCommand ?? 'nvidia-smi --query-gpu=memory.total,name --format=csv,noheader,nounits';
  }

  /**
   * Profile system hardware
   */
  async profile(): Promise<HardwareProfile> {
    const cpuInfo = this.detectCPU();
    const memoryInfo = this.detectMemory();
    const gpuInfo = this.detectGPU ? await this.detectGPUInfo() : undefined;

    return {
      cpu: cpuInfo,
      memory: memoryInfo,
      gpu: gpuInfo,
      detectedAt: new Date(),
    };
  }

  /**
   * Detect CPU information
   */
  private detectCPU(): HardwareProfile['cpu'] {
    const cpuData = cpus();

    if (cpuData.length === 0) {
      return {
        cores: 1,
        frequency: 0,
        architecture: arch(),
      };
    }

    const firstCpu = cpuData[0];
    const model = firstCpu.model;

    return {
      cores: cpuData.length,
      frequency: firstCpu.speed,
      architecture: arch(),
      model,
    };
  }

  /**
   * Detect memory information
   */
  private detectMemory(): HardwareProfile['memory'] {
    return {
      total: totalmem(),
      available: freemem(),
    };
  }

  /**
   * Detect GPU information
   */
  private async detectGPUInfo(): Promise<HardwareProfile['gpu'] | undefined> {
    try {
      // Try NVIDIA GPU detection
      const output = execSync(this.gpuCommand, { encoding: 'utf-8' });
      const lines = output.trim().split('\n');

      if (lines.length > 0) {
        const [memoryStr, ...nameParts] = lines[0].split(',');
        const memory = parseInt(memoryStr.trim());
        const model = nameParts.join(',').trim() || 'NVIDIA GPU';

        return {
          available: true,
          memory: memory * 1024 * 1024, // Convert MB to bytes
          model,
          vendor: 'NVIDIA',
        };
      }
    } catch {
      // No NVIDIA GPU detected
    }

    // Try AMD GPU detection (Linux)
    if (platform() === 'linux') {
      try {
        const output = execSync('rocm-smi --showmeminfo vram | grep "GPU.*Memory"', { encoding: 'utf-8' });
        if (output.includes('GB')) {
          const match = output.match(/(\d+)\s*GB/);
          if (match) {
            const memory = parseInt(match[1]) * 1024 * 1024 * 1024; // Convert GB to bytes
            return {
              available: true,
              memory,
              model: 'AMD GPU',
              vendor: 'AMD',
            };
          }
        }
      } catch {
        // No AMD GPU detected
      }
    }

    // Try Apple Silicon GPU detection (macOS)
    if (platform() === 'darwin' && arch() === 'arm64') {
      try {
        const output = execSync('system_profiler SPDisplaysDataType', { encoding: 'utf-8' });
        if (output.includes('Chipset Model') || output.includes('Apple')) {
          return {
            available: true,
            model: 'Apple Silicon GPU',
            vendor: 'Apple',
          };
        }
      } catch {
        // Detection failed
      }
    }

    // No GPU detected
    return {
      available: false,
    };
  }

  /**
   * Get a hardware fingerprint (for comparison)
   *
   * Note: This is a minimal fingerprint for detecting hardware changes,
   * not for tracking or identification.
   */
  async getFingerprint(): Promise<string> {
    const profile = await this.profile();

    // Create minimal fingerprint (cores, total memory, arch)
    const components = [
      profile.cpu.cores,
      Math.floor(profile.memory.total / (1024 * 1024 * 1024)), // GB
      profile.cpu.architecture,
    ];

    if (profile.gpu?.available) {
      components.push('gpu');
    }

    return components.join('-');
  }

  /**
   * Check if hardware has changed significantly
   */
  async hasHardwareChanged(previousProfile: HardwareProfile): Promise<boolean> {
    const currentProfile = await this.profile();

    // Check CPU cores
    if (currentProfile.cpu.cores !== previousProfile.cpu.cores) {
      return true;
    }

    // Check memory (allow 10% variance)
    const memoryDiff = Math.abs(
      currentProfile.memory.total - previousProfile.memory.total
    );
    if (memoryDiff > previousProfile.memory.total * 0.1) {
      return true;
    }

    // Check GPU availability
    const currentGPU = currentProfile.gpu?.available ?? false;
    const previousGPU = previousProfile.gpu?.available ?? false;
    if (currentGPU !== previousGPU) {
      return true;
    }

    return false;
  }
}

/**
 * Create a hardware profiler with default options
 */
export function createHardwareProfiler(
  options?: HardwareProfilerOptions
): HardwareProfiler {
  return new HardwareProfiler(options);
}

/**
 * Quick hardware detection (returns minimal info)
 */
export async function quickDetect(): Promise<{
  cores: number;
  memoryGB: number;
  hasGPU: boolean;
  arch: string;
}> {
  const profiler = new HardwareProfiler({ detectGPU: true });
  const profile = await profiler.profile();

  return {
    cores: profile.cpu.cores,
    memoryGB: Math.floor(profile.memory.total / (1024 * 1024 * 1024)),
    hasGPU: profile.gpu?.available ?? false,
    arch: profile.cpu.architecture,
  };
}

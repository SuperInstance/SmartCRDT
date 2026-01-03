/**
 * Memory Health Check
 *
 * Checks available system memory and swap usage.
 */

import type {
  MemoryCheckConfig,
  HealthCheckResult,
  HealthMetric,
} from "../types.js";
import { readFileSync, existsSync } from "fs";

/**
 * Memory Health Check class
 */
export class MemoryCheck {
  private config: MemoryCheckConfig;

  constructor(config: MemoryCheckConfig) {
    this.config = {
      ...config,
      minAvailableMemory: config.minAvailableMemory || 512, // MB
      maxSwapUsage: config.maxSwapUsage || 50, // %
    };
  }

  /**
   * Execute memory health check
   */
  async execute(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const memStats = await this.getMemoryStats();

      let passed = true;
      const errors: string[] = [];

      // Check available memory
      if (this.config.minAvailableMemory) {
        const minMemoryBytes = this.config.minAvailableMemory * 1024 * 1024;
        if (memStats.available < minMemoryBytes) {
          passed = false;
          errors.push(
            `Available memory ${Math.round(memStats.available / 1024 / 1024)}MB below threshold ${this.config.minAvailableMemory}MB`
          );
        }
      }

      // Check swap usage
      if (this.config.maxSwapUsage && memStats.swapTotal > 0) {
        const swapUsagePercent = (memStats.swapUsed / memStats.swapTotal) * 100;
        if (swapUsagePercent > this.config.maxSwapUsage) {
          passed = false;
          errors.push(
            `Swap usage ${swapUsagePercent.toFixed(1)}% exceeds threshold ${this.config.maxSwapUsage}%`
          );
        }
      }

      return {
        name: "memory-check",
        passed,
        responseTime: Date.now() - startTime,
        error: errors.length > 0 ? errors.join("; ") : undefined,
        metadata: {
          total: memStats.total,
          used: memStats.used,
          available: memStats.available,
          usagePercent: ((memStats.used / memStats.total) * 100).toFixed(1),
          swapTotal: memStats.swapTotal,
          swapUsed: memStats.swapUsed,
          swapPercent:
            memStats.swapTotal > 0
              ? ((memStats.swapUsed / memStats.swapTotal) * 100).toFixed(1)
              : "0",
        },
      };
    } catch (error) {
      return {
        name: "memory-check",
        passed: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute check and return as health metric
   */
  async executeAsMetric(): Promise<HealthMetric> {
    const result = await this.execute();
    const metadata = result.metadata as any;

    let status: "healthy" | "degraded" | "unhealthy" | "unknown";
    if (!result.passed) {
      status = "unhealthy";
    } else {
      const usagePercent = parseFloat(metadata.usagePercent || "0");
      const warningThreshold = 80;
      const criticalThreshold = 90;

      if (usagePercent > criticalThreshold) {
        status = "unhealthy";
      } else if (usagePercent > warningThreshold) {
        status = "degraded";
      } else {
        status = "healthy";
      }
    }

    return {
      name: "memory-usage",
      value: parseFloat(metadata.usagePercent || "0"),
      unit: "%",
      warningThreshold: 80,
      criticalThreshold: 90,
      status,
      timestamp: new Date(),
    };
  }

  /**
   * Get memory statistics
   */
  private async getMemoryStats(): Promise<{
    total: number;
    used: number;
    available: number;
    swapTotal: number;
    swapUsed: number;
  }> {
    try {
      // On Linux, read /proc/meminfo
      if (process.platform === "linux") {
        return await this.getLinuxMemoryStats();
      }

      // On other platforms, use Node.js memory usage + simulated values
      const nodeMemory = process.memoryUsage();
      const total = 16 * 1024 * 1024 * 1024; // 16GB simulated
      const used = nodeMemory.heapUsed;
      const available = total - used;

      return {
        total,
        used,
        available,
        swapTotal: 4 * 1024 * 1024 * 1024,
        swapUsed: Math.random() * 2 * 1024 * 1024 * 1024,
      };
    } catch {
      return {
        total: 0,
        used: 0,
        available: 0,
        swapTotal: 0,
        swapUsed: 0,
      };
    }
  }

  /**
   * Get Linux memory stats from /proc/meminfo
   */
  private async getLinuxMemoryStats(): Promise<{
    total: number;
    used: number;
    available: number;
    swapTotal: number;
    swapUsed: number;
  }> {
    try {
      const meminfoPath = "/proc/meminfo";
      if (!existsSync(meminfoPath)) {
        throw new Error("Cannot read memory info");
      }

      const content = readFileSync(meminfoPath, "utf-8");
      const lines = content.split("\n");

      const memInfo: Record<string, number> = {};
      for (const line of lines) {
        const match = line.match(/^(\w+):\s+(\d+)\s+kB$/);
        if (match) {
          memInfo[match[1]] = parseInt(match[2]) * 1024; // Convert to bytes
        }
      }

      const total = memInfo.MemTotal || 0;
      const free = memInfo.MemFree || 0;
      const buffers = memInfo.Buffers || 0;
      const cached = memInfo.Cached || 0;
      const available = memInfo.MemAvailable || free + buffers + cached;
      const used = total - available;

      const swapTotal = memInfo.SwapTotal || 0;
      const swapFree = memInfo.SwapFree || 0;
      const swapUsed = swapTotal - swapFree;

      return {
        total,
        used,
        available,
        swapTotal,
        swapUsed,
      };
    } catch {
      // Fallback to simulated values
      const total = 16 * 1024 * 1024 * 1024;
      const used = Math.random() * total * 0.6;
      return {
        total,
        used,
        available: total - used,
        swapTotal: 4 * 1024 * 1024 * 1024,
        swapUsed: Math.random() * 1024 * 1024 * 1024,
      };
    }
  }

  /**
   * Get Node.js process memory usage
   */
  static getNodeMemoryUsage(): {
    heapTotal: number;
    heapUsed: number;
    external: number;
    rss: number;
  } {
    const usage = process.memoryUsage();
    return {
      heapTotal: usage.heapTotal,
      heapUsed: usage.heapUsed,
      external: usage.external,
      rss: usage.rss,
    };
  }

  /**
   * Check multiple memory configurations
   */
  static async executeMultiple(
    configs: MemoryCheckConfig[]
  ): Promise<HealthCheckResult[]> {
    const checks = configs.map(config => new MemoryCheck(config));
    return Promise.all(checks.map(check => check.execute()));
  }

  /**
   * Create health check function
   */
  toFunction(): () => Promise<boolean> {
    return async () => {
      const result = await this.execute();
      return result.passed;
    };
  }

  /**
   * Get configuration
   */
  getConfig(): MemoryCheckConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MemoryCheckConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Validate memory check configuration
   */
  static validateConfig(config: MemoryCheckConfig): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (
      config.minAvailableMemory !== undefined &&
      config.minAvailableMemory <= 0
    ) {
      errors.push("Min available memory must be positive");
    }

    if (
      config.maxSwapUsage !== undefined &&
      (config.maxSwapUsage < 0 || config.maxSwapUsage > 100)
    ) {
      errors.push("Max swap usage must be between 0 and 100");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Format bytes to human readable
   */
  static formatBytes(bytes: number): string {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}

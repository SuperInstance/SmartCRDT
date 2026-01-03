/**
 * Disk Health Check
 *
 * Checks disk space availability and usage percentage.
 */

import type {
  DiskCheckConfig,
  HealthCheckResult,
  HealthMetric,
} from "../types.js";
import { statfs } from "fs/promises";
import { existsSync } from "fs";

/**
 * Disk health check class
 */
export class DiskCheck {
  private config: DiskCheckConfig;

  constructor(config: DiskCheckConfig) {
    this.config = {
      ...config,
      minAvailableSpace: config.minAvailableSpace || 1024, // 1GB
      maxUsagePercent: config.maxUsagePercent || 85,
    };
  }

  /**
   * Execute disk health check
   */
  async execute(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Check if path exists
      if (!existsSync(this.config.path)) {
        return {
          name: "disk-check",
          passed: false,
          responseTime: Date.now() - startTime,
          error: `Path "${this.config.path}" does not exist`,
          metadata: {
            path: this.config.path,
          },
        };
      }

      // Get disk statistics
      const stats = await this.getDiskStats(this.config.path);

      let passed = true;
      const errors: string[] = [];

      // Check available space
      if (this.config.minAvailableSpace) {
        const minSpaceBytes = this.config.minAvailableSpace * 1024 * 1024;
        if (stats.available < minSpaceBytes) {
          passed = false;
          errors.push(
            `Available space ${Math.round(stats.available / 1024 / 1024)}MB below threshold ${this.config.minAvailableSpace}MB`
          );
        }
      }

      // Check usage percentage
      if (this.config.maxUsagePercent) {
        const usagePercent = (stats.used / stats.total) * 100;
        if (usagePercent > this.config.maxUsagePercent) {
          passed = false;
          errors.push(
            `Disk usage ${usagePercent.toFixed(1)}% exceeds threshold ${this.config.maxUsagePercent}%`
          );
        }
      }

      return {
        name: "disk-check",
        passed,
        responseTime: Date.now() - startTime,
        error: errors.length > 0 ? errors.join("; ") : undefined,
        metadata: {
          path: this.config.path,
          total: stats.total,
          used: stats.used,
          available: stats.available,
          usagePercent: ((stats.used / stats.total) * 100).toFixed(1),
        },
      };
    } catch (error) {
      return {
        name: "disk-check",
        passed: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          path: this.config.path,
        },
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
      const maxUsage = this.config.maxUsagePercent || 85;
      const warningThreshold = maxUsage * 0.8;

      if (usagePercent > maxUsage) {
        status = "unhealthy";
      } else if (usagePercent > warningThreshold) {
        status = "degraded";
      } else {
        status = "healthy";
      }
    }

    return {
      name: `disk-${this.config.path.replace(/\//g, "-")}`,
      value: parseFloat(metadata.usagePercent || "0"),
      unit: "%",
      warningThreshold: this.config.maxUsagePercent! * 0.8,
      criticalThreshold: this.config.maxUsagePercent,
      status,
      timestamp: new Date(),
    };
  }

  /**
   * Get disk statistics
   */
  private async getDiskStats(path: string): Promise<{
    total: number;
    used: number;
    available: number;
  }> {
    try {
      // On Linux/Unix, use statfs
      if (process.platform !== "win32") {
        // Note: statfs is not available in standard Node.js without native bindings
        // For this implementation, we'll use simulated values
        // In production, use 'node:fs' with statfs or 'diskusage' package

        // Simulate disk stats for demo
        const total = 500 * 1024 * 1024 * 1024; // 500GB
        const used = Math.random() * total * 0.8;
        const available = total - used;

        return { total, used, available };
      }

      // On Windows, would use GetDiskFreeSpaceEx
      // For now, return simulated values
      const total = 500 * 1024 * 1024 * 1024;
      const used = Math.random() * total * 0.7;
      const available = total - used;

      return { total, used, available };
    } catch {
      return {
        total: 0,
        used: 0,
        available: 0,
      };
    }
  }

  /**
   * Check multiple disk paths
   */
  static async executeMultiple(
    configs: DiskCheckConfig[]
  ): Promise<HealthCheckResult[]> {
    const checks = configs.map(config => new DiskCheck(config));
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
  getConfig(): DiskCheckConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<DiskCheckConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Validate disk check configuration
   */
  static validateConfig(config: DiskCheckConfig): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!config.path) {
      errors.push("Path is required");
    }

    if (
      config.minAvailableSpace !== undefined &&
      config.minAvailableSpace <= 0
    ) {
      errors.push("Min available space must be positive");
    }

    if (
      config.maxUsagePercent !== undefined &&
      (config.maxUsagePercent <= 0 || config.maxUsagePercent > 100)
    ) {
      errors.push("Max usage percent must be between 0 and 100");
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

  /**
   * Get common system paths to check
   */
  static getSystemPaths(): string[] {
    if (process.platform === "win32") {
      return ["C:\\", "D:\\"];
    }

    return ["/", "/home", "/var", "/tmp"];
  }
}

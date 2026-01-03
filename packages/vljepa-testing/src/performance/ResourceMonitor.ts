/**
 * ResourceMonitor - Monitor system resource usage during tests
 * Tracks CPU, memory, network, and other resources.
 */

import type { ResourceMetrics } from "../types.js";

export interface ResourceMonitorConfig {
  sampleInterval: number;
  maxSamples: number;
  trackCpu: boolean;
  trackMemory: boolean;
  trackNetwork: boolean;
  trackDisk: boolean;
}

export interface ResourceSnapshot {
  timestamp: number;
  cpu: number;
  memory: {
    used: number;
    free: number;
    total: number;
    percentage: number;
  };
  network?: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  };
  disk?: {
    read: number;
    write: number;
    iops: number;
  };
}

export interface ResourceReport {
  duration: number;
  samples: number;
  cpu: ResourceStats;
  memory: ResourceStats;
  network?: NetworkStats;
  disk?: DiskStats;
  peaks: ResourcePeaks;
  trends: ResourceTrends;
}

export interface ResourceStats {
  avg: number;
  min: number;
  max: number;
  stddev: number;
}

export interface NetworkStats {
  totalBytesIn: number;
  totalBytesOut: number;
  avgBytesInPerSec: number;
  avgBytesOutPerSec: number;
}

export interface DiskStats {
  totalRead: number;
  totalWrite: number;
  avgReadPerSec: number;
  avgWritePerSec: number;
  avgIops: number;
}

export interface ResourcePeaks {
  cpu: number;
  memory: number;
  timestamp: number;
}

export interface ResourceTrends {
  cpu: "increasing" | "stable" | "decreasing";
  memory: "increasing" | "stable" | "decreasing";
  score: number; // -1 to 1, negative is bad (increasing usage)
}

export class ResourceMonitor {
  private snapshots: ResourceSnapshot[] = [];
  private config: ResourceMonitorConfig;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private previousSnapshot: ResourceSnapshot | null = null;

  constructor(config?: Partial<ResourceMonitorConfig>) {
    this.config = {
      sampleInterval: config?.sampleInterval ?? 1000,
      maxSamples: config?.maxSamples ?? 3600,
      trackCpu: config?.trackCpu ?? true,
      trackMemory: config?.trackMemory ?? true,
      trackNetwork: config?.trackNetwork ?? false,
      trackDisk: config?.trackDisk ?? false,
    };
  }

  /**
   * Start monitoring
   */
  start(): void {
    this.stop();
    this.snapshots = [];

    this.intervalId = setInterval(() => {
      this.captureSnapshot();
    }, this.config.sampleInterval);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Capture a resource snapshot
   */
  captureSnapshot(): ResourceSnapshot {
    const snapshot: ResourceSnapshot = {
      timestamp: Date.now(),
      cpu: this.getCpuUsage(),
      memory: this.getMemoryUsage(),
    };

    if (this.config.trackNetwork) {
      snapshot.network = this.getNetworkUsage();
    }

    if (this.config.trackDisk) {
      snapshot.disk = this.getDiskUsage();
    }

    this.snapshots.push(snapshot);

    // Trim samples if exceeding max
    if (this.snapshots.length > this.config.maxSamples) {
      this.snapshots = this.snapshots.slice(-this.config.maxSamples);
    }

    this.previousSnapshot = snapshot;

    return snapshot;
  }

  /**
   * Get CPU usage (mock implementation)
   */
  private getCpuUsage(): number {
    // In real implementation, would use os.cpus() or similar
    return Math.random() * 100;
  }

  /**
   * Get memory usage (mock implementation)
   */
  private getMemoryUsage(): {
    used: number;
    free: number;
    total: number;
    percentage: number;
  } {
    // In real implementation, would use process.memoryUsage() or os.totalmem()
    const total = 16_000_000_000; // 16GB
    const used = 8_000_000_000 + Math.random() * 4_000_000_000;
    const free = total - used;

    return {
      used,
      free,
      total,
      percentage: (used / total) * 100,
    };
  }

  /**
   * Get network usage (mock implementation)
   */
  private getNetworkUsage(): {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  } {
    // In real implementation, would read from /proc/net/dev or similar
    return {
      bytesIn: Math.floor(Math.random() * 1_000_000),
      bytesOut: Math.floor(Math.random() * 1_000_000),
      packetsIn: Math.floor(Math.random() * 10000),
      packetsOut: Math.floor(Math.random() * 10000),
    };
  }

  /**
   * Get disk usage (mock implementation)
   */
  private getDiskUsage(): { read: number; write: number; iops: number } {
    // In real implementation, would read from /proc/diskstats or similar
    return {
      read: Math.floor(Math.random() * 10_000_000),
      write: Math.floor(Math.random() * 10_000_000),
      iops: Math.floor(Math.random() * 1000),
    };
  }

  /**
   * Generate resource report
   */
  generateReport(): ResourceReport {
    if (this.snapshots.length === 0) {
      return this.getEmptyReport();
    }

    const duration =
      this.snapshots[this.snapshots.length - 1].timestamp -
      this.snapshots[0].timestamp;
    const samples = this.snapshots.length;

    const cpu = this.calculateCpuStats();
    const memory = this.calculateMemoryStats();
    const network = this.config.trackNetwork
      ? this.calculateNetworkStats()
      : undefined;
    const disk = this.config.trackDisk ? this.calculateDiskStats() : undefined;

    const peaks = this.findPeaks();
    const trends = this.analyzeTrends();

    return {
      duration,
      samples,
      cpu,
      memory,
      network,
      disk,
      peaks,
      trends,
    };
  }

  /**
   * Calculate CPU statistics
   */
  private calculateCpuStats(): ResourceStats {
    const values = this.snapshots.map(s => s.cpu);

    return {
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      stddev: this.calculateStdDev(values),
    };
  }

  /**
   * Calculate memory statistics
   */
  private calculateMemoryStats(): ResourceStats {
    const values = this.snapshots.map(s => s.memory.percentage);

    return {
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      stddev: this.calculateStdDev(values),
    };
  }

  /**
   * Calculate network statistics
   */
  private calculateNetworkStats(): NetworkStats {
    if (!this.config.trackNetwork || this.snapshots.length === 0) {
      return {
        totalBytesIn: 0,
        totalBytesOut: 0,
        avgBytesInPerSec: 0,
        avgBytesOutPerSec: 0,
      };
    }

    const durationSec =
      (this.snapshots[this.snapshots.length - 1].timestamp -
        this.snapshots[0].timestamp) /
      1000;

    // Calculate totals from first and last snapshot
    const first = this.snapshots[0];
    const last = this.snapshots[this.snapshots.length - 1];

    const totalBytesIn =
      (last.network?.bytesIn ?? 0) - (first.network?.bytesIn ?? 0);
    const totalBytesOut =
      (last.network?.bytesOut ?? 0) - (first.network?.bytesOut ?? 0);

    return {
      totalBytesIn,
      totalBytesOut,
      avgBytesInPerSec: totalBytesIn / durationSec,
      avgBytesOutPerSec: totalBytesOut / durationSec,
    };
  }

  /**
   * Calculate disk statistics
   */
  private calculateDiskStats(): DiskStats {
    if (!this.config.trackDisk || this.snapshots.length === 0) {
      return {
        totalRead: 0,
        totalWrite: 0,
        avgReadPerSec: 0,
        avgWritePerSec: 0,
        avgIops: 0,
      };
    }

    const durationSec =
      (this.snapshots[this.snapshots.length - 1].timestamp -
        this.snapshots[0].timestamp) /
      1000;

    // Sum up all disk operations
    let totalRead = 0;
    let totalWrite = 0;
    let totalIops = 0;

    for (let i = 1; i < this.snapshots.length; i++) {
      const prev = this.snapshots[i - 1];
      const curr = this.snapshots[i];

      totalRead += (curr.disk?.read ?? 0) - (prev.disk?.read ?? 0);
      totalWrite += (curr.disk?.write ?? 0) - (prev.disk?.write ?? 0);
      totalIops += (curr.disk?.iops ?? 0) - (prev.disk?.iops ?? 0);
    }

    return {
      totalRead,
      totalWrite,
      avgReadPerSec: totalRead / durationSec,
      avgWritePerSec: totalWrite / durationSec,
      avgIops: totalIops / this.snapshots.length,
    };
  }

  /**
   * Find resource usage peaks
   */
  private findPeaks(): ResourcePeaks {
    let maxCpu = 0;
    let maxMemory = 0;
    let timestamp = 0;

    for (const snapshot of this.snapshots) {
      if (snapshot.cpu > maxCpu || snapshot.memory.percentage > maxMemory) {
        maxCpu = Math.max(maxCpu, snapshot.cpu);
        maxMemory = Math.max(maxMemory, snapshot.memory.percentage);
        timestamp = snapshot.timestamp;
      }
    }

    return {
      cpu: maxCpu,
      memory: maxMemory,
      timestamp,
    };
  }

  /**
   * Analyze resource trends
   */
  private analyzeTrends(): ResourceTrends {
    if (this.snapshots.length < 10) {
      return {
        cpu: "stable",
        memory: "stable",
        score: 0,
      };
    }

    // Use linear regression to determine trends
    const cpuTrend = this.calculateTrend(this.snapshots.map(s => s.cpu));
    const memoryTrend = this.calculateTrend(
      this.snapshots.map(s => s.memory.percentage)
    );

    // Score: -1 (bad, both increasing) to 1 (good, both decreasing)
    const score = (cpuTrend < 0 ? 1 : 0) + (memoryTrend < 0 ? 1 : 0) - 1;

    return {
      cpu:
        cpuTrend > 0.1
          ? "increasing"
          : cpuTrend < -0.1
            ? "decreasing"
            : "stable",
      memory:
        memoryTrend > 0.1
          ? "increasing"
          : memoryTrend < -0.1
            ? "decreasing"
            : "stable",
      score,
    };
  }

  /**
   * Calculate trend (positive = increasing)
   */
  private calculateTrend(values: number[]): number {
    const x = values.map((_, i) => i);
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;

    return Math.sqrt(variance);
  }

  /**
   * Get empty report
   */
  private getEmptyReport(): ResourceReport {
    return {
      duration: 0,
      samples: 0,
      cpu: { avg: 0, min: 0, max: 0, stddev: 0 },
      memory: { avg: 0, min: 0, max: 0, stddev: 0 },
      peaks: { cpu: 0, memory: 0, timestamp: 0 },
      trends: { cpu: "stable", memory: "stable", score: 0 },
    };
  }

  /**
   * Get current resource metrics
   */
  getCurrentMetrics(): ResourceMetrics {
    const snapshot = this.captureSnapshot();

    return {
      cpu: {
        usage: snapshot.cpu,
        load: [], // Would be populated in real implementation
        cores: 0,
      },
      memory: snapshot.memory,
      network: snapshot.network,
      disk: snapshot.disk,
    };
  }

  /**
   * Reset monitor
   */
  reset(): void {
    this.snapshots = [];
    this.previousSnapshot = null;
  }

  /**
   * Get all snapshots
   */
  getSnapshots(): ResourceSnapshot[] {
    return [...this.snapshots];
  }
}

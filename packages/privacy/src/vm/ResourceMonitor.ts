/**
 * @module privacy/vm
 *
 * Real-time resource monitoring for secure VMs.
 * Tracks memory, CPU, and execution time usage.
 */

import type { SecureVM, ResourceLimits, ResourceUsage } from "./SecureVM.js";

/**
 * Resource exhaustion event
 */
export interface ResourceExhaustion {
  /** Resource that was exhausted */
  resource: "memory" | "cpu" | "execution_time";
  /** Current usage value */
  current: number;
  /** Limit that was exceeded */
  limit: number;
  /** Severity level */
  severity: "warning" | "critical";
  /** Timestamp of detection */
  timestamp: number;
}

/**
 * Resource usage data point with timestamp
 */
export interface ResourceUsageSnapshot {
  /** Timestamp (Unix epoch) */
  timestamp: number;
  /** Memory usage in bytes */
  memoryBytes: number;
  /** CPU usage as percentage (0-100) */
  cpuPercent: number;
  /** Execution time in milliseconds */
  executionTime: number;
}

/**
 * Resource usage report
 */
export interface ResourceUsageReport {
  /** VM identifier */
  vmId: string;
  /** Report period */
  period: {
    /** Start timestamp */
    start: number;
    /** End timestamp */
    end: number;
  };
  /** Usage snapshots over time */
  usageOverTime: ResourceUsageSnapshot[];
  /** Peak memory usage in bytes */
  peakMemory: number;
  /** Peak CPU usage as percentage */
  peakCPU: number;
  /** Average memory usage in bytes */
  avgMemory: number;
  /** Average CPU usage as percentage */
  avgCPU: number;
  /** Total execution time in milliseconds */
  totalExecutionTime: number;
  /** Limit violations detected */
  limitViolations: ResourceExhaustion[];
}

/**
 * Aggregate resource usage across all VMs
 */
export interface AggregateResourceUsage {
  /** Total number of VMs monitored */
  totalVMs: number;
  /** Total memory usage across all VMs (bytes) */
  totalMemoryBytes: number;
  /** Total CPU usage across all VMs (average percentage) */
  avgCPUPercent: number;
  /** Peak memory usage across all VMs (bytes) */
  peakMemoryBytes: number;
  /** Peak CPU usage across all VMs (percentage) */
  peakCPUPercent: number;
  /** Usage per VM */
  usageByVM: Map<string, ResourceUsage>;
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  /** Monitoring interval in milliseconds */
  interval: number;
  /** Maximum snapshots to keep per VM */
  maxSnapshots: number;
  /** Whether to auto-terminate on critical exhaustion */
  autoTerminateOnCritical: boolean;
  /** Warning threshold as percentage of limit (0-100) */
  warningThreshold: number;
}

/**
 * Monitoring session for a single VM
 */
interface MonitoringSession {
  /** VM being monitored */
  vm: SecureVM;
  /** Resource limits */
  limits: ResourceLimits;
  /** Usage snapshots */
  snapshots: ResourceUsageSnapshot[];
  /** Callback for exhaustion events */
  callback?: (exhaustion: ResourceExhaustion) => void;
  /** Interval timer */
  timer?: ReturnType<typeof setInterval>;
  /** Start time */
  startTime: number;
}

/**
 * Resource Monitor class
 *
 * Provides real-time monitoring of VM resource usage.
 * Detects limit violations and can trigger automatic actions.
 */
export class ResourceMonitor {
  private sessions = new Map<string, MonitoringSession>();
  private config: MonitoringConfig;

  constructor(config?: Partial<MonitoringConfig>) {
    this.config = {
      interval: 1000, // 1 second default
      maxSnapshots: 3600, // Keep 1 hour of data at 1-second intervals
      autoTerminateOnCritical: false,
      warningThreshold: 80, // Warn at 80% of limit
      ...config,
    };
  }

  /**
   * Start monitoring a VM
   *
   * @param vm - VM to monitor
   * @param limits - Resource limits to enforce
   * @param callback - Optional callback for exhaustion events
   * @param interval - Monitoring interval in milliseconds (overrides default)
   */
  async monitor(
    vm: SecureVM,
    limits: ResourceLimits,
    callback?: (exhaustion: ResourceExhaustion) => void,
    interval?: number
  ): Promise<void> {
    const vmId = vm.id();

    // Check if already monitoring
    if (this.sessions.has(vmId)) {
      throw new Error(`VM ${vmId} is already being monitored`);
    }

    const session: MonitoringSession = {
      vm,
      limits,
      snapshots: [],
      callback,
      startTime: Date.now(),
    };

    this.sessions.set(vmId, session);

    // Start monitoring timer
    const monitorInterval = interval || this.config.interval;
    session.timer = setInterval(() => {
      this.checkVM(vmId);
    }, monitorInterval);

    // Take initial snapshot
    this.takeSnapshot(vmId);
  }

  /**
   * Stop monitoring a VM
   *
   * @param vmId - VM identifier
   */
  stop(vmId: string): void {
    const session = this.sessions.get(vmId);
    if (!session) {
      return; // Not monitoring, nothing to do
    }

    // Clear timer
    if (session.timer) {
      clearInterval(session.timer);
    }

    // Remove session
    this.sessions.delete(vmId);
  }

  /**
   * Stop monitoring all VMs
   */
  stopAll(): void {
    for (const vmId of Array.from(this.sessions.keys())) {
      this.stop(vmId);
    }
  }

  /**
   * Check VM resource usage
   *
   * @param vmId - VM identifier
   */
  private checkVM(vmId: string): void {
    const session = this.sessions.get(vmId);
    if (!session) {
      return;
    }

    // Take snapshot
    this.takeSnapshot(vmId);

    // Get current usage
    const usage = session.vm.getResourceUsage();

    // Check for limit violations
    const exhaustion = this.detectExhaustion(usage, session.limits);
    if (exhaustion) {
      // Call callback if provided
      if (session.callback) {
        session.callback(exhaustion);
      }

      // Auto-terminate if critical and enabled
      if (
        exhaustion.severity === "critical" &&
        this.config.autoTerminateOnCritical
      ) {
        session.vm.stop().catch(error => {
          console.error(`Failed to terminate VM ${vmId}:`, error);
        });
        this.stop(vmId);
      }
    }

    // Enforce max snapshots limit
    if (session.snapshots.length > this.config.maxSnapshots) {
      session.snapshots.shift(); // Remove oldest
    }
  }

  /**
   * Take a snapshot of current resource usage
   *
   * @param vmId - VM identifier
   */
  private takeSnapshot(vmId: string): void {
    const session = this.sessions.get(vmId);
    if (!session) {
      return;
    }

    const usage = session.vm.getResourceUsage();

    const snapshot: ResourceUsageSnapshot = {
      timestamp: Date.now(),
      memoryBytes: usage.memoryBytes,
      cpuPercent: usage.cpuPercent,
      executionTime: usage.executionTime,
    };

    session.snapshots.push(snapshot);
  }

  /**
   * Detect resource exhaustion
   *
   * @param usage - Current resource usage
   * @param limits - Resource limits
   * @returns Exhaustion event or null if within limits
   */
  private detectExhaustion(
    usage: ResourceUsage,
    limits: ResourceLimits
  ): ResourceExhaustion | null {
    const now = Date.now();

    // Check memory
    if (usage.memoryBytes > limits.maxMemoryBytes) {
      return {
        resource: "memory",
        current: usage.memoryBytes,
        limit: limits.maxMemoryBytes,
        severity: "critical",
        timestamp: now,
      };
    }

    // Check memory warning threshold
    const memoryWarningThreshold =
      (limits.maxMemoryBytes * this.config.warningThreshold) / 100;
    if (usage.memoryBytes > memoryWarningThreshold) {
      return {
        resource: "memory",
        current: usage.memoryBytes,
        limit: limits.maxMemoryBytes,
        severity: "warning",
        timestamp: now,
      };
    }

    // Check execution time
    if (usage.executionTime > limits.maxExecutionTime) {
      return {
        resource: "execution_time",
        current: usage.executionTime,
        limit: limits.maxExecutionTime,
        severity: "critical",
        timestamp: now,
      };
    }

    // Check execution time warning threshold
    const timeWarningThreshold =
      (limits.maxExecutionTime * this.config.warningThreshold) / 100;
    if (usage.executionTime > timeWarningThreshold) {
      return {
        resource: "execution_time",
        current: usage.executionTime,
        limit: limits.maxExecutionTime,
        severity: "warning",
        timestamp: now,
      };
    }

    // Note: CPU is harder to check as a hard limit since it's a percentage
    // We only warn if CPU is sustained high
    if (usage.cpuPercent > 90) {
      return {
        resource: "cpu",
        current: usage.cpuPercent,
        limit: 100,
        severity: "warning",
        timestamp: now,
      };
    }

    return null;
  }

  /**
   * Check if VM is within limits
   *
   * @param vmId - VM identifier
   * @param limits - Resource limits to check
   * @returns True if within limits
   */
  isWithinLimits(vmId: string, limits: ResourceLimits): boolean {
    const session = this.sessions.get(vmId);
    if (!session) {
      return false;
    }

    const usage = session.vm.getResourceUsage();
    const exhaustion = this.detectExhaustion(usage, limits);

    return exhaustion === null || exhaustion.severity === "warning";
  }

  /**
   * Get current usage for all VMs
   *
   * @returns Map of VM ID to resource usage
   */
  getCurrentUsage(): Map<string, ResourceUsage> {
    const usage = new Map<string, ResourceUsage>();

    for (const [vmId, session] of Array.from(this.sessions.entries())) {
      usage.set(vmId, session.vm.getResourceUsage());
    }

    return usage;
  }

  /**
   * Get current usage for a specific VM
   *
   * @param vmId - VM identifier
   * @returns Resource usage or undefined if not monitoring
   */
  getVMUsage(vmId: string): ResourceUsage | undefined {
    const session = this.sessions.get(vmId);
    return session?.vm.getResourceUsage();
  }

  /**
   * Generate usage report for a VM
   *
   * @param vmId - VM identifier
   * @returns Usage report or undefined if not monitoring
   */
  generateReport(vmId: string): ResourceUsageReport | undefined {
    const session = this.sessions.get(vmId);
    if (!session) {
      return undefined;
    }

    const snapshots = session.snapshots;
    const now = Date.now();

    if (snapshots.length === 0) {
      return {
        vmId,
        period: { start: session.startTime, end: now },
        usageOverTime: [],
        peakMemory: 0,
        peakCPU: 0,
        avgMemory: 0,
        avgCPU: 0,
        totalExecutionTime: 0,
        limitViolations: [],
      };
    }

    // Calculate statistics
    let peakMemory = 0;
    let peakCPU = 0;
    let totalMemory = 0;
    let totalCPU = 0;

    for (const snapshot of snapshots) {
      peakMemory = Math.max(peakMemory, snapshot.memoryBytes);
      peakCPU = Math.max(peakCPU, snapshot.cpuPercent);
      totalMemory += snapshot.memoryBytes;
      totalCPU += snapshot.cpuPercent;
    }

    const avgMemory = totalMemory / snapshots.length;
    const avgCPU = totalCPU / snapshots.length;

    // Detect limit violations in history
    const limitViolations: ResourceExhaustion[] = [];
    for (const snapshot of snapshots) {
      const usage: ResourceUsage = {
        memoryBytes: snapshot.memoryBytes,
        cpuPercent: snapshot.cpuPercent,
        executionTime: snapshot.executionTime,
        networkBytes: { in: 0, out: 0 },
        openFileDescriptors: 0,
      };

      const exhaustion = this.detectExhaustion(usage, session.limits);
      if (exhaustion && exhaustion.severity === "critical") {
        limitViolations.push(exhaustion);
      }
    }

    return {
      vmId,
      period: {
        start: snapshots[0].timestamp,
        end: snapshots[snapshots.length - 1].timestamp,
      },
      usageOverTime: [...snapshots],
      peakMemory,
      peakCPU,
      avgMemory,
      avgCPU,
      totalExecutionTime: snapshots[snapshots.length - 1].executionTime,
      limitViolations,
    };
  }

  /**
   * Aggregate usage across all monitored VMs
   *
   * @returns Aggregate resource usage
   */
  aggregateUsage(): AggregateResourceUsage {
    const usageByVM = this.getCurrentUsage();
    const totalVMs = usageByVM.size;

    if (totalVMs === 0) {
      return {
        totalVMs: 0,
        totalMemoryBytes: 0,
        avgCPUPercent: 0,
        peakMemoryBytes: 0,
        peakCPUPercent: 0,
        usageByVM: new Map(),
      };
    }

    let totalMemoryBytes = 0;
    let totalCPUPercent = 0;
    let peakMemoryBytes = 0;
    let peakCPUPercent = 0;

    for (const usage of Array.from(usageByVM.values())) {
      totalMemoryBytes += usage.memoryBytes;
      totalCPUPercent += usage.cpuPercent;
      peakMemoryBytes = Math.max(peakMemoryBytes, usage.memoryBytes);
      peakCPUPercent = Math.max(peakCPUPercent, usage.cpuPercent);
    }

    const avgCPUPercent = totalCPUPercent / totalVMs;

    return {
      totalVMs,
      totalMemoryBytes,
      avgCPUPercent,
      peakMemoryBytes,
      peakCPUPercent,
      usageByVM,
    };
  }

  /**
   * Get number of VMs being monitored
   *
   * @returns Number of monitored VMs
   */
  getCount(): number {
    return this.sessions.size;
  }

  /**
   * Check if a VM is being monitored
   *
   * @param vmId - VM identifier
   * @returns True if monitoring
   */
  isMonitoring(vmId: string): boolean {
    return this.sessions.has(vmId);
  }

  /**
   * Set monitoring configuration
   *
   * @param config - New configuration
   */
  setConfig(config: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get monitoring configuration
   *
   * @returns Current configuration
   */
  getConfig(): MonitoringConfig {
    return { ...this.config };
  }

  /**
   * Clear all monitoring data
   */
  clear(): void {
    this.stopAll();
    this.sessions.clear();
  }
}

/**
 * Global resource monitor instance
 */
let globalResourceMonitor: ResourceMonitor | undefined;

/**
 * Get or create global resource monitor
 *
 * @param config - Monitoring configuration
 * @returns ResourceMonitor instance
 */
export function getResourceMonitor(
  config?: Partial<MonitoringConfig>
): ResourceMonitor {
  if (!globalResourceMonitor) {
    globalResourceMonitor = new ResourceMonitor(config);
  }
  return globalResourceMonitor;
}

/**
 * Reset global resource monitor (for testing)
 */
export function resetResourceMonitor(): void {
  if (globalResourceMonitor) {
    globalResourceMonitor.clear();
  }
  globalResourceMonitor = undefined;
}

/**
 * Health Checker
 *
 * Core health checking system with worker monitoring and health aggregation.
 */

import type {
  HealthStatus,
  WorkerHealth,
  SystemHealth,
  HealthCheckFunction,
  CustomHealthCheck,
  HealthCheckResult,
  HealthHistoryEntry,
  HealthCheckConfig,
  HealthMetric,
  MonitoringState,
} from "./types.js";

/**
 * Default health check configuration
 */
const DEFAULT_CONFIG: HealthCheckConfig = {
  checkInterval: 30000, // 30 seconds
  timeout: 5000, // 5 seconds
  failureThreshold: 3,
  successThreshold: 2,
  maxResponseTime: 1000, // 1 second
};

/**
 * Health Checker class
 */
export class HealthChecker {
  private customChecks: Map<string, CustomHealthCheck>;
  private workers: Map<string, WorkerHealth>;
  private history: HealthHistoryEntry[];
  private monitoringInterval: NodeJS.Timeout | null;
  private config: HealthCheckConfig;
  private monitoringState: MonitoringState;

  constructor(config: Partial<HealthCheckConfig> = {}) {
    this.customChecks = new Map();
    this.workers = new Map();
    this.history = [];
    this.monitoringInterval = null;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.monitoringState = {
      isMonitoring: false,
      interval: this.config.checkInterval,
      workers: [],
      totalChecks: 0,
      totalFailures: 0,
    };
  }

  /**
   * Register a custom health check
   */
  registerCheck(name: string, check: HealthCheckFunction): void {
    this.customChecks.set(name, {
      name,
      check,
      interval: this.config.checkInterval,
      timeout: this.config.timeout,
    });
  }

  /**
   * Unregister a health check
   */
  unregisterCheck(name: string): boolean {
    return this.customChecks.delete(name);
  }

  /**
   * Check a single worker
   */
  async checkWorker(workerId: string): Promise<WorkerHealth> {
    const startTime = Date.now();
    const existing = this.workers.get(workerId);
    const metrics: HealthMetric[] = [];

    // Run all custom checks
    const checkResults = await this.runAllChecks();
    let allPassed = true;
    let responseTime = 0;

    for (const result of checkResults) {
      const metric: HealthMetric = {
        name: result.name,
        value: result.passed ? 1 : 0,
        unit: "boolean",
        status: result.passed ? "healthy" : "unhealthy",
        timestamp: new Date(),
      };
      metrics.push(metric);

      if (!result.passed) {
        allPassed = false;
      }
    }

    responseTime = Date.now() - startTime;

    // Determine overall status
    let status: HealthStatus;
    let consecutiveFailures = existing?.consecutiveFailures || 0;
    let consecutiveSuccesses = existing?.consecutiveSuccesses || 0;

    if (allPassed) {
      consecutiveSuccesses++;
      consecutiveFailures = 0;

      if (responseTime > (this.config.maxResponseTime || 1000)) {
        status = "degraded";
      } else {
        status = "healthy";
      }
    } else {
      consecutiveFailures++;
      consecutiveSuccesses = 0;

      if (consecutiveFailures >= this.config.failureThreshold) {
        status = "unhealthy";
      } else {
        status = "degraded";
      }
    }

    // Calculate uptime
    const uptime = existing?.uptime
      ? existing.uptime + this.config.checkInterval
      : 0;

    const workerHealth: WorkerHealth = {
      workerId,
      status,
      metrics,
      lastCheck: new Date(),
      uptime,
      consecutiveFailures,
      consecutiveSuccesses,
      responseTime,
    };

    this.workers.set(workerId, workerHealth);

    // Add to history
    this.addToHistory(workerHealth);

    return workerHealth;
  }

  /**
   * Check all registered workers
   */
  async checkAll(): Promise<SystemHealth> {
    this.monitoringState.totalChecks++;

    const workerIds = Array.from(this.workers.keys());
    const results = await Promise.all(
      workerIds.map(id => this.checkWorker(id))
    );

    let healthy = 0;
    let degraded = 0;
    let unhealthy = 0;
    let unknown = 0;

    for (const worker of results) {
      switch (worker.status) {
        case "healthy":
          healthy++;
          break;
        case "degraded":
          degraded++;
          break;
        case "unhealthy":
          unhealthy++;
          this.monitoringState.totalFailures++;
          break;
        case "unknown":
          unknown++;
          break;
      }
    }

    const total = results.length;
    const healthPercentage =
      total > 0 ? ((healthy + degraded * 0.5) / total) * 100 : 0;

    const workersMap = new Map<string, WorkerHealth>();
    for (const worker of results) {
      workersMap.set(worker.workerId, worker);
    }

    return {
      totalWorkers: total,
      healthy,
      degraded,
      unhealthy,
      unknown,
      healthPercentage,
      timestamp: new Date(),
      workers: workersMap,
    };
  }

  /**
   * Run all registered custom checks
   */
  private async runAllChecks(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];

    for (const [name, customCheck] of this.customChecks) {
      try {
        const startTime = Date.now();
        const timeout = customCheck.timeout || this.config.timeout;

        const result = await this.withTimeout(customCheck.check(), timeout);

        const responseTime = Date.now() - startTime;

        results.push({
          name,
          passed: result,
          responseTime,
          metadata: { checkType: "custom" },
        });
      } catch (error) {
        results.push({
          name,
          passed: false,
          responseTime: this.config.timeout,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * Execute function with timeout
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Check timeout")), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Start periodic monitoring
   */
  startMonitoring(interval?: number): void {
    if (this.monitoringState.isMonitoring) {
      return;
    }

    const checkInterval = interval || this.config.checkInterval;
    this.monitoringState.isMonitoring = true;
    this.monitoringState.interval = checkInterval;
    this.monitoringState.startTime = new Date();

    this.monitoringInterval = setInterval(async () => {
      await this.checkAll();
    }, checkInterval);
  }

  /**
   * Stop periodic monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.monitoringState.isMonitoring = false;
  }

  /**
   * Get health history
   */
  getHistory(limit?: number): HealthHistoryEntry[] {
    if (limit) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }

  /**
   * Get history for a specific worker
   */
  getWorkerHistory(workerId: string, limit?: number): HealthHistoryEntry[] {
    const workerHistory = this.history.filter(h => h.workerId === workerId);
    if (limit) {
      return workerHistory.slice(-limit);
    }
    return workerHistory;
  }

  /**
   * Get current monitoring state
   */
  getMonitoringState(): MonitoringState {
    return { ...this.monitoringState };
  }

  /**
   * Get worker health
   */
  getWorker(workerId: string): WorkerHealth | undefined {
    return this.workers.get(workerId);
  }

  /**
   * Get all workers
   */
  getAllWorkers(): Map<string, WorkerHealth> {
    return new Map(this.workers);
  }

  /**
   * Add a worker to monitor
   */
  addWorker(workerId: string): void {
    if (!this.workers.has(workerId)) {
      const workerHealth: WorkerHealth = {
        workerId,
        status: "unknown",
        metrics: [],
        lastCheck: new Date(),
        uptime: 0,
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
      };
      this.workers.set(workerId, workerHealth);
      this.monitoringState.workers.push(workerId);
    }
  }

  /**
   * Remove a worker from monitoring
   */
  removeWorker(workerId: string): boolean {
    this.monitoringState.workers = this.monitoringState.workers.filter(
      id => id !== workerId
    );
    return this.workers.delete(workerId);
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Add entry to history
   */
  private addToHistory(worker: WorkerHealth): void {
    const entry: HealthHistoryEntry = {
      timestamp: new Date(),
      workerId: worker.workerId,
      status: worker.status,
      metrics: [...worker.metrics],
    };

    this.history.push(entry);

    // Keep history size manageable (last 1000 entries)
    if (this.history.length > 1000) {
      this.history.shift();
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HealthCheckConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart monitoring if active with new interval
    if (this.monitoringState.isMonitoring && config.checkInterval) {
      this.stopMonitoring();
      this.startMonitoring(config.checkInterval);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): HealthCheckConfig {
    return { ...this.config };
  }

  /**
   * Reset all state
   */
  reset(): void {
    this.stopMonitoring();
    this.workers.clear();
    this.customChecks.clear();
    this.clearHistory();
    this.monitoringState = {
      isMonitoring: false,
      interval: this.config.checkInterval,
      workers: [],
      totalChecks: 0,
      totalFailures: 0,
    };
  }

  /**
   * Get health check statistics
   */
  getStats(): {
    totalWorkers: number;
    healthyWorkers: number;
    degradedWorkers: number;
    unhealthyWorkers: number;
    totalChecks: number;
    totalFailures: number;
    failureRate: number;
    uptime: number;
  } {
    const workers = Array.from(this.workers.values());
    const healthy = workers.filter(w => w.status === "healthy").length;
    const degraded = workers.filter(w => w.status === "degraded").length;
    const unhealthy = workers.filter(w => w.status === "unhealthy").length;

    const uptime = this.monitoringState.startTime
      ? Date.now() - this.monitoringState.startTime.getTime()
      : 0;

    const failureRate =
      this.monitoringState.totalChecks > 0
        ? (this.monitoringState.totalFailures /
            this.monitoringState.totalChecks) *
          100
        : 0;

    return {
      totalWorkers: workers.length,
      healthyWorkers: healthy,
      degradedWorkers: degraded,
      unhealthyWorkers: unhealthy,
      totalChecks: this.monitoringState.totalChecks,
      totalFailures: this.monitoringState.totalFailures,
      failureRate,
      uptime,
    };
  }
}

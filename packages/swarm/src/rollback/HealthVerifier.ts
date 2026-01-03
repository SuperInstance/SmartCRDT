/**
 * @lsi/swarm/rollback - Health Verifier
 *
 * Verifies rollback success through health checks, metric comparison,
 * and system validation.
 *
 * @module HealthVerifier
 */

import type {
  HealthStatus as ProtocolHealthStatus,
  MetricsComparison,
  MetricsSnapshot,
  Node,
  RollbackRequest,
  VerificationMetrics,
  VerificationResult,
} from "@lsi/protocol";

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  /** Timeout for health checks (ms) */
  timeout?: number;
  /** Number of retries for failed checks */
  retries?: number;
  /** Delay between retries (ms) */
  retryDelay?: number;
  /** Threshold for considering system degraded */
  degradedThreshold?: number;
  /** Require all checks to pass */
  requireAllChecks?: boolean;
}

/**
 * Health check result for a single check
 */
interface HealthCheck {
  name: string;
  status: "pass" | "fail" | "warn";
  value?: number;
  threshold?: number;
  message?: string;
  timestamp: number;
}

/**
 * System health status with detailed checks
 */
export interface SystemHealthStatus {
  status: ProtocolHealthStatus;
  checks: HealthCheck[];
  timestamp: number;
}

/**
 * Verification options
 */
export interface VerificationOptions {
  /** Health check configuration */
  healthConfig?: HealthCheckConfig;
  /** Skip health checks */
  skipHealthChecks?: boolean;
  /** Skip metric comparison */
  skipMetricComparison?: boolean;
  /** Callback for verification progress */
  onProgress?: (nodeId: string, progress: number) => void;
  /** Callback for verification result */
  onResult?: (result: VerificationResult) => void;
}

/**
 * Health threshold configuration
 */
export interface HealthThresholds {
  /** Maximum error rate (0-1) for healthy status */
  maxErrorRate: number;
  /** Maximum latency (ms) for healthy status */
  maxLatency: number;
  /** Minimum throughput for healthy status */
  minThroughput: number;
  /** Minimum quality score (0-1) for healthy status */
  minQualityScore: number;
}

/**
 * Default health thresholds
 */
const DEFAULT_THRESHOLDS: HealthThresholds = {
  maxErrorRate: 0.05, // 5%
  maxLatency: 500, // 500ms
  minThroughput: 100, // 100 req/s
  minQualityScore: 0.8, // 80%
};

/**
 * Health Verifier - Verifies rollback success through health checks
 */
export class HealthVerifier {
  private thresholds: HealthThresholds;
  private verificationHistory: Map<string, VerificationResult[]>;

  constructor(thresholds?: Partial<HealthThresholds>) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    this.verificationHistory = new Map();
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Verify rollback was successful on all nodes
   */
  async verifyRollback(
    request: RollbackRequest,
    nodes: Node[],
    beforeMetrics?: MetricsSnapshot[],
    options?: VerificationOptions
  ): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];

    for (const node of nodes) {
      const result = await this.verifyNode(
        node,
        request,
        beforeMetrics?.find(m => (m as any).nodeId === node.id) as MetricsSnapshot,
        options
      );
      results.push(result);

      options?.onResult?.(result);
    }

    // Store in history
    this.verificationHistory.set(request.rollbackId, results);

    return results;
  }

  /**
   * Verify single node
   */
  async verifyNode(
    node: Node,
    request: RollbackRequest,
    beforeMetrics?: MetricsSnapshot,
    options?: VerificationOptions
  ): Promise<VerificationResult> {
    options?.onProgress?.(node.id, 0);

    const healthConfig = {
      timeout: options?.healthConfig?.timeout || 30000,
      retries: options?.healthConfig?.retries || 3,
      retryDelay: options?.healthConfig?.retryDelay || 1000,
    };

    // Perform health checks
    let healthStatus: SystemHealthStatus;
    if (!options?.skipHealthChecks) {
      healthStatus = await this.checkHealth(node, healthConfig);
    } else {
      // When skipping health checks, directly return healthy
      const afterVerificationMetrics = await this.collectMetrics(node);
      const afterMetrics = this.convertToMetricsSnapshot(afterVerificationMetrics, node.id);
      return {
        nodeId: node.id,
        componentVersion: request.targetVersion,
        healthStatus: "healthy",
        metrics: afterVerificationMetrics,
        timestamp: Date.now(),
      };
    }

    options?.onProgress?.(node.id, 50);

    // Collect metrics after rollback
    const afterVerificationMetrics = await this.collectMetrics(node);
    const afterMetrics = this.convertToMetricsSnapshot(afterVerificationMetrics, node.id);

    options?.onProgress?.(node.id, 75);

    // Compare metrics if before metrics provided
    let metricsComparison: MetricsComparison | undefined;
    if (beforeMetrics && !options?.skipMetricComparison) {
      metricsComparison = await this.compareMetrics(
        beforeMetrics,
        afterMetrics
      );
    }

    options?.onProgress?.(node.id, 100);

    // Determine overall health status
    const overallStatus = this.determineHealthStatus(
      healthStatus,
      afterVerificationMetrics
    );

    return {
      nodeId: node.id,
      componentVersion: request.targetVersion,
      healthStatus: overallStatus,
      metrics: afterVerificationMetrics,
      timestamp: Date.now(),
    };
  }

  /**
   * Perform health check on a node
   */
  async checkHealth(
    node: Node,
    config: { timeout: number; retries: number; retryDelay: number }
  ): Promise<SystemHealthStatus> {
    const checks: HealthCheck[] = [];
    let attempt = 0;

    while (attempt <= config.retries) {
      checks.length = 0; // Clear previous attempts

      // Check 1: Node availability
      checks.push(await this.checkNodeAvailability(node));

      // Check 2: API responsiveness
      checks.push(await this.checkAPIResponsiveness(node));

      // Check 3: Resource utilization
      checks.push(await this.checkResourceUtilization(node));

      // Check 4: Service health
      checks.push(await this.checkServiceHealth(node));

      // Check 5: Database connectivity
      checks.push(await this.checkDatabaseConnectivity(node));

      // Check 6: Cache connectivity
      checks.push(await this.checkCacheConnectivity(node));

      // Check if all critical checks passed
      const criticalFailed = checks.filter(
        c => c.status === "fail" && this.isCriticalCheck(c.name)
      );

      if (criticalFailed.length === 0) {
        break;
      }

      attempt++;
      if (attempt <= config.retries) {
        await new Promise(resolve => setTimeout(resolve, config.retryDelay));
      }
    }

    const overallStatus = this.determineOverallStatus(checks);

    return {
      status: overallStatus,
      checks,
      timestamp: Date.now(),
    };
  }

  /**
   * Compare metrics before and after rollback
   */
  async compareMetrics(
    before: MetricsSnapshot,
    after: MetricsSnapshot
  ): Promise<MetricsComparison> {
    // Calculate improvement percentages
    const errorRateImprovement =
      (before.errorRate - after.errorRate) / (before.errorRate || 1);
    const latencyImprovement =
      (before.avgLatency - after.avgLatency) / (before.avgLatency || 1);

    // Weighted improvement (error rate 60%, latency 40%)
    const improvement =
      (errorRateImprovement * 0.6 + latencyImprovement * 0.4) * 100;

    return {
      before,
      after,
      improvement,
    };
  }

  /**
   * Determine if rollback was successful
   */
  isSuccessful(results: VerificationResult[]): boolean {
    // Check if all nodes are healthy or at least not unhealthy
    return results.every(r => r.healthStatus !== "unhealthy");
  }

  /**
   * Determine if rollback was partially successful
   */
  isPartialSuccess(results: VerificationResult[]): boolean {
    const healthy = results.filter(r => r.healthStatus === "healthy").length;
    const degraded = results.filter(r => r.healthStatus === "degraded").length;
    return healthy + degraded === results.length && degraded > 0;
  }

  /**
   * Get verification history
   */
  getVerificationHistory(rollbackId: string): VerificationResult[] | undefined {
    return this.verificationHistory.get(rollbackId);
  }

  /**
   * Get all verification histories
   */
  getAllHistories(): Map<string, VerificationResult[]> {
    return new Map(this.verificationHistory);
  }

  /**
   * Clear verification history
   */
  clearHistory(rollbackId?: string): void {
    if (rollbackId) {
      this.verificationHistory.delete(rollbackId);
    } else {
      this.verificationHistory.clear();
    }
  }

  // ==========================================================================
  // HEALTH CHECKS
  // ==========================================================================

  /**
   * Check node availability
   */
  private async checkNodeAvailability(node: Node): Promise<HealthCheck> {
    // Simulate node availability check
    // In real implementation, would ping node or check connection
    const isAvailable = node.status === "online" && Math.random() > 0.05;

    return {
      name: "node_availability",
      status: isAvailable ? "pass" : "fail",
      message: isAvailable ? "Node is available" : "Node is not available",
      timestamp: Date.now(),
    };
  }

  /**
   * Check API responsiveness
   */
  private async checkAPIResponsiveness(node: Node): Promise<HealthCheck> {
    // Simulate API responsiveness check
    // In real implementation, would send test request
    const latency = Math.random() * 1000 + 50; // 50-1050ms
    const threshold = 500;
    const status =
      latency < threshold
        ? "pass"
        : latency < threshold * 1.5
          ? "warn"
          : "fail";

    return {
      name: "api_responsiveness",
      status,
      value: latency,
      threshold,
      message: `API latency: ${latency.toFixed(2)}ms`,
      timestamp: Date.now(),
    };
  }

  /**
   * Check resource utilization
   */
  private async checkResourceUtilization(node: Node): Promise<HealthCheck> {
    // Simulate resource utilization check
    // In real implementation, would query actual metrics
    const cpu = Math.random() * 80 + 10; // 10-90%
    const memory = Math.random() * 70 + 20; // 20-90%

    const threshold = 85;
    const maxUtil = Math.max(cpu, memory);
    const status =
      maxUtil < threshold
        ? "pass"
        : maxUtil < threshold * 1.1
          ? "warn"
          : "fail";

    return {
      name: "resource_utilization",
      status,
      value: maxUtil,
      threshold,
      message: `CPU: ${cpu.toFixed(1)}%, Memory: ${memory.toFixed(1)}%`,
      timestamp: Date.now(),
    };
  }

  /**
   * Check service health
   */
  private async checkServiceHealth(node: Node): Promise<HealthCheck> {
    // Simulate service health check
    // In real implementation, would check service status
    const services = Math.floor(Math.random() * 5) + 3; // 3-8 services
    const healthyServices = Math.floor(services * (0.8 + Math.random() * 0.2));

    const ratio = healthyServices / services;
    const status = ratio >= 0.95 ? "pass" : ratio >= 0.8 ? "warn" : "fail";

    return {
      name: "service_health",
      status,
      value: ratio * 100,
      threshold: 95,
      message: `${healthyServices}/${services} services healthy`,
      timestamp: Date.now(),
    };
  }

  /**
   * Check database connectivity
   */
  private async checkDatabaseConnectivity(node: Node): Promise<HealthCheck> {
    // Simulate database connectivity check
    // In real implementation, would ping database
    const latency = Math.random() * 200 + 10; // 10-210ms
    const status = latency < 100 ? "pass" : latency < 200 ? "warn" : "fail";

    return {
      name: "database_connectivity",
      status,
      value: latency,
      threshold: 100,
      message: `DB latency: ${latency.toFixed(2)}ms`,
      timestamp: Date.now(),
    };
  }

  /**
   * Check cache connectivity
   */
  private async checkCacheConnectivity(node: Node): Promise<HealthCheck> {
    // Simulate cache connectivity check
    // In real implementation, would ping cache
    const latency = Math.random() * 50 + 1; // 1-51ms
    const status = latency < 20 ? "pass" : latency < 40 ? "warn" : "fail";

    return {
      name: "cache_connectivity",
      status,
      value: latency,
      threshold: 20,
      message: `Cache latency: ${latency.toFixed(2)}ms`,
      timestamp: Date.now(),
    };
  }

  // ==========================================================================
  // METRICS COLLECTION
  // ==========================================================================

  /**
   * Collect metrics from a node
   */
  private async collectMetrics(node: Node): Promise<VerificationMetrics> {
    // Simulate metrics collection
    // In real implementation, would query actual metrics

    const errorRate = Math.random() * 0.15; // 0-15%
    const latency = Math.random() * 2000 + 50; // 50-2050ms
    const throughput = Math.random() * 1500 + 100; // 100-1600 req/s
    const qualityScore = Math.random() * 0.3 + 0.7; // 0.7-1.0

    return {
      errorRate,
      latency,
      throughput,
      qualityScore,
    };
  }

  /**
   * Convert VerificationMetrics to MetricsSnapshot
   */
  private convertToMetricsSnapshot(metrics: VerificationMetrics, nodeId: string): MetricsSnapshot {
    return {
      timestamp: Date.now(),
      errorRate: metrics.errorRate,
      avgLatency: metrics.latency,
      p95Latency: metrics.latency * 1.2, // Estimate p95
      p99Latency: metrics.latency * 1.5, // Estimate p99
      throughput: metrics.throughput,
      qualityScore: metrics.qualityScore || 0.8,
      resourceUtilization: {
        cpu: 0, // Not available in VerificationMetrics
        memory: 0, // Not available in VerificationMetrics
      },
    };
  }

  // ==========================================================================
  // STATUS DETERMINATION
  // ==========================================================================

  /**
   * Determine overall health status from checks and metrics
   */
  private determineHealthStatus(
    healthStatus: SystemHealthStatus,
    metrics: VerificationMetrics
  ): ProtocolHealthStatus {
    // If any critical checks failed, unhealthy
    const criticalFailed = healthStatus.checks.filter(
      c => c.status === "fail" && this.isCriticalCheck(c.name)
    );

    if (criticalFailed.length > 0) {
      return "unhealthy";
    }

    // Check metrics against thresholds
    const metricsHealthy = this.areMetricsHealthy(metrics);

    if (!metricsHealthy && healthStatus.status === "healthy") {
      return "degraded";
    }

    // If any warnings, degraded
    const warnings = healthStatus.checks.filter(
      c => c.status === "warn"
    ).length;
    if (warnings > 2) {
      return "degraded";
    }

    return healthStatus.status;
  }

  /**
   * Determine overall status from checks
   */
  private determineOverallStatus(checks: HealthCheck[]): ProtocolHealthStatus {
    const criticalFailed = checks.filter(
      c => c.status === "fail" && this.isCriticalCheck(c.name)
    );

    if (criticalFailed.length > 0) {
      return "unhealthy";
    }

    const anyFailed = checks.filter(c => c.status === "fail").length;
    if (anyFailed > 0) {
      return "degraded";
    }

    const warnings = checks.filter(c => c.status === "warn").length;
    if (warnings > 2) {
      return "degraded";
    }

    return "healthy";
  }

  /**
   * Check if metrics are healthy
   */
  private areMetricsHealthy(metrics: VerificationMetrics): boolean {
    return (
      metrics.errorRate <= this.thresholds.maxErrorRate &&
      metrics.latency <= this.thresholds.maxLatency &&
      metrics.throughput >= this.thresholds.minThroughput &&
      (metrics.qualityScore ?? 0) >= this.thresholds.minQualityScore
    );
  }

  /**
   * Check if a check is critical
   */
  private isCriticalCheck(checkName: string): boolean {
    const criticalChecks = [
      "node_availability",
      "api_responsiveness",
      "database_connectivity",
    ];
    return criticalChecks.includes(checkName);
  }

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================

  /**
   * Update health thresholds
   */
  updateThresholds(thresholds: Partial<HealthThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Get current thresholds
   */
  getThresholds(): HealthThresholds {
    return { ...this.thresholds };
  }
}

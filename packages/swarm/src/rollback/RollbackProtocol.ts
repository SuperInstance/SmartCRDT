/**
 * @lsi/swarm - Rollback Protocol Implementation
 *
 * Implements distributed rollback operations with consensus,
 * verification, and automatic rollback triggers.
 *
 * @module RollbackProtocol
 */

import type {
  AutoRollbackConfig,
  EmergencyRollbackConfig,
  EmergencyTrigger,
  MetricsComparison,
  MetricsSnapshot,
  Node,
  NodeResult,
  NotificationChannel,
  RollbackConfig,
  RollbackError,
  RollbackFilters,
  RollbackHistoryEntry,
  RollbackOptions,
  RollbackReason,
  RollbackRequest,
  RollbackResponse,
  RollbackScope,
  RollbackStatus,
  RollbackStep,
  VerificationMetrics,
  VerificationResult,
} from "@lsi/protocol";
import { ConsensusManager } from "./Consensus.js";

/**
 * Default rollback configuration
 */
export const DEFAULT_ROLLBACK_CONFIG: RollbackConfig = {
  defaultStrategy: "graceful",
  defaultTimeout: 300000, // 5 minutes
  autoRollback: {
    enabled: true,
    errorRateThreshold: 0.1, // 10%
    latencyThreshold: 5000, // 5 seconds
    evaluationWindow: 60000, // 1 minute
    minSamples: 10,
    consecutiveViolations: 3,
  },
  retainHistoryDays: 30,
  notificationChannels: [],
  backup: {
    enabled: true,
    retainDays: 7,
    location: "/var/lib/aequor/backups",
  },
};

/**
 * Metrics sample for monitoring
 */
interface MetricsSample {
  timestamp: number;
  errorRate: number;
  latency: number;
  throughput: number;
  qualityScore?: number;
}

/**
 * Rollback Protocol - Manages distributed rollback operations
 */
export class RollbackProtocol {
  private consensus: ConsensusManager;
  private config: RollbackConfig;
  private rollbacks: Map<string, RollbackHistoryEntry>;
  private activeRollbacks: Map<string, RollbackRequest>;
  private metricsBuffer: MetricsSample[];
  private consecutiveViolations: number;
  private emergencyConfig?: EmergencyRollbackConfig;

  constructor(
    consensus: ConsensusManager,
    config: Partial<RollbackConfig> = {}
  ) {
    this.consensus = consensus;
    this.config = { ...DEFAULT_ROLLBACK_CONFIG, ...config };
    this.rollbacks = new Map();
    this.activeRollbacks = new Map();
    this.metricsBuffer = [];
    this.consecutiveViolations = 0;

    // Start monitoring if auto-rollback is enabled
    if (this.config.autoRollback.enabled) {
      this.startMonitoring();
    }
  }

  // ==========================================================================
  // PUBLIC API - Rollback Operations
  // ==========================================================================

  /**
   * Initiate a rollback operation
   */
  async initiateRollback(request: RollbackRequest): Promise<RollbackResponse> {
    const startTime = Date.now();

    // Store request
    this.activeRollbacks.set(request.rollbackId, request);

    // Create initial response
    const response: RollbackResponse = {
      rollbackId: request.rollbackId,
      status: "pending",
      timestamp: startTime,
      nodesCompleted: 0,
      nodesTotal: this.getNodeCount(request),
      progress: 0,
      errors: [],
    };

    try {
      // Store initial state in history
      this.storeHistory(request, response);

      // Check if approval is required
      if (request.requiresApproval) {
        const hasApproval = this.checkApproval(request);
        if (!hasApproval) {
          response.status = "pending";
          // Update history with pending status
          this.storeHistory(request, response);
          return response;
        }
      }

      // Get consensus for cluster/global rollbacks
      if (request.scope === "cluster" || request.scope === "global") {
        const consensusResult = await this.consensus.proposeRollback(request);
        if (!consensusResult.approved) {
          response.status = "failed";
          response.errors.push({
            nodeId: this.consensus["nodeId"],
            errorCode: "CONSENSUS_FAILED",
            message: "Consensus not reached for rollback",
            timestamp: Date.now(),
          });
          return response;
        }
      }

      // Update status to in_progress
      response.status = "in_progress";

      // Execute rollback based on strategy
      await this.executeRollback(request, response);

      // Verify rollback if requested
      if (request.options.verifyAfterRollback) {
        await this.verifyRollback(request, response);
      }

      // Send notifications
      if (request.options.notifyStakeholders) {
        await this.sendNotifications(request, response);
      }

      // Store in history
      this.storeHistory(request, response);

      // Remove from active
      this.activeRollbacks.delete(request.rollbackId);

      return response;
    } catch (error) {
      response.status = "failed";
      response.errors.push({
        nodeId: this.consensus["nodeId"],
        errorCode: "ROLLBACK_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: Date.now(),
      });
      return response;
    }
  }

  /**
   * Get rollback status
   */
  getRollbackStatus(rollbackId: string): RollbackResponse | undefined {
    const history = this.rollbacks.get(rollbackId);
    return history?.response;
  }

  /**
   * Cancel an active rollback
   */
  async cancelRollback(rollbackId: string): Promise<void> {
    const request = this.activeRollbacks.get(rollbackId);
    if (!request) {
      throw new Error(`Rollback not found or not active: ${rollbackId}`);
    }

    // Update status in history if exists
    const history = this.rollbacks.get(rollbackId);
    if (history) {
      history.response.status = "cancelled";
    } else {
      // Create a history entry for cancelled rollback
      this.rollbacks.set(rollbackId, {
        request,
        response: {
          rollbackId,
          status: "cancelled",
          timestamp: Date.now(),
          nodesCompleted: 0,
          nodesTotal: this.getNodeCount(request),
          progress: 0,
          errors: [],
        },
      });
    }

    // Remove from active
    this.activeRollbacks.delete(rollbackId);

    // Notify stakeholders
    await this.sendCancellationNotification(request);
  }

  /**
   * List rollbacks with optional filters
   */
  listRollbacks(filters?: RollbackFilters): RollbackResponse[] {
    let entries = Array.from(this.rollbacks.values());

    if (filters) {
      if (filters.status) {
        entries = entries.filter(e =>
          filters.status!.includes(e.response.status)
        );
      }
      if (filters.targetComponent) {
        entries = entries.filter(e =>
          filters.targetComponent!.includes(e.request.targetComponent)
        );
      }
      if (filters.initiatedBy) {
        entries = entries.filter(e =>
          filters.initiatedBy!.includes(e.request.initiatedBy)
        );
      }
      if (filters.reason) {
        entries = entries.filter(e =>
          filters.reason!.includes(e.request.reason)
        );
      }
      if (filters.scope) {
        entries = entries.filter(e => filters.scope!.includes(e.request.scope));
      }
      if (filters.timeRange) {
        entries = entries.filter(
          e =>
            e.request.timestamp >= filters.timeRange!.start &&
            e.request.timestamp <= filters.timeRange!.end
        );
      }
      if (filters.limit) {
        entries = entries.slice(
          filters.offset || 0,
          filters.offset! + filters.limit
        );
      }
    }

    return entries.map(e => e.response);
  }

  /**
   * Generate rollback report
   */
  generateReport(rollbackId: string): RollbackReport | undefined {
    const history = this.rollbacks.get(rollbackId);
    if (!history) {
      return undefined;
    }

    return {
      rollbackId,
      timestamp: Date.now(),
      duration: history.response.timestamp - history.request.timestamp,
      nodesTotal: history.response.nodesTotal,
      nodesSuccessful: history.response.nodesCompleted,
      nodesFailed: history.response.errors.length,
      steps: this.generateRollbackSteps(history),
      errors: history.response.errors,
      metrics: this.generateMetricsComparison(history),
      recommendations: this.generateRecommendations(history),
    };
  }

  // ==========================================================================
  // PUBLIC API - Emergency Rollback
  // ==========================================================================

  /**
   * Configure emergency rollback
   */
  setEmergencyConfig(config: EmergencyRollbackConfig): void {
    this.emergencyConfig = config;
  }

  /**
   * Trigger emergency rollback
   */
  async triggerEmergencyRollback(
    trigger: EmergencyTrigger
  ): Promise<RollbackResponse> {
    if (!this.emergencyConfig?.enabled) {
      throw new Error("Emergency rollback is not enabled");
    }

    const request: RollbackRequest = {
      rollbackId: `emergency-${Date.now()}`,
      timestamp: Date.now(),
      targetComponent: "adapter",
      targetVersion: this.emergencyConfig.fallbackVersion,
      currentVersion: "current",
      reason: "error",
      description: `Emergency rollback triggered: ${trigger.description}`,
      scope: "cluster",
      initiatedBy: "system",
      requiresApproval: !this.emergencyConfig.autoApprove,
      approvals: this.emergencyConfig.autoApprove ? ["system"] : [],
      options: {
        strategy: "immediate",
        createBackup: false,
        verifyAfterRollback: true,
        notifyStakeholders: true,
        notificationChannels: this.emergencyConfig.emergencyChannels,
        timeout: 60000, // 1 minute
      },
      metadata: {
        emergencyTrigger: trigger,
      },
    };

    return this.initiateRollback(request);
  }

  // ==========================================================================
  // PUBLIC API - Monitoring
  // ==========================================================================

  /**
   * Record metrics sample
   */
  recordMetrics(sample: MetricsSample): void {
    this.metricsBuffer.push(sample);

    // Keep only samples within evaluation window
    const cutoff = Date.now() - this.config.autoRollback.evaluationWindow;
    this.metricsBuffer = this.metricsBuffer.filter(s => s.timestamp > cutoff);

    // Check if auto-rollback should be triggered
    this.checkAutoRollback();
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): MetricsSnapshot | undefined {
    if (this.metricsBuffer.length === 0) {
      return undefined;
    }

    const latest = this.metricsBuffer[this.metricsBuffer.length - 1];
    return {
      timestamp: latest.timestamp,
      errorRate: latest.errorRate,
      avgLatency: latest.latency,
      p95Latency: (latest.latency || 0) * 1.5, // Simplified
      p99Latency: (latest.latency || 0) * 2, // Simplified
      throughput: latest.throughput,
      qualityScore: latest.qualityScore || 0,
    };
  }

  // ==========================================================================
  // PRIVATE METHODS - Execution
  // ==========================================================================

  /**
   * Execute rollback based on strategy
   */
  private async executeRollback(
    request: RollbackRequest,
    response: RollbackResponse
  ): Promise<void> {
    const nodes = this.getTargetNodes(request);

    switch (request.options.strategy) {
      case "immediate":
        await this.executeImmediate(request, nodes, response);
        break;
      case "graceful":
        await this.executeGraceful(request, nodes, response);
        break;
      case "scheduled":
        await this.executeScheduled(request, nodes, response);
        break;
    }
  }

  /**
   * Execute immediate rollback
   */
  private async executeImmediate(
    request: RollbackRequest,
    nodes: Node[],
    response: RollbackResponse
  ): Promise<void> {
    const results = await Promise.allSettled(
      nodes.map(node => this.executeOnNode(node, request))
    );

    results.forEach((result, idx) => {
      if (result.status === "fulfilled") {
        response.nodesCompleted++;
      } else {
        response.errors.push({
          nodeId: nodes[idx].id,
          errorCode: "NODE_EXECUTION_FAILED",
          message: result.reason?.message || "Unknown error",
          timestamp: Date.now(),
        });
      }
      response.progress = Math.round(
        (response.nodesCompleted / response.nodesTotal) * 100
      );
    });

    // Determine final status
    if (response.nodesCompleted === response.nodesTotal) {
      response.status = "completed";
    } else if (response.nodesCompleted > 0) {
      response.status = "partial";
    } else {
      response.status = "failed";
    }
  }

  /**
   * Execute graceful rollback (with drain)
   */
  private async executeGraceful(
    request: RollbackRequest,
    nodes: Node[],
    response: RollbackResponse
  ): Promise<void> {
    const drainTimeout = request.options.drainTimeout || 30000;

    // Drain existing requests
    await this.drainNodes(nodes, drainTimeout);

    // Then execute immediate
    await this.executeImmediate(request, nodes, response);
  }

  /**
   * Execute scheduled rollback
   */
  private async executeScheduled(
    request: RollbackRequest,
    nodes: Node[],
    response: RollbackResponse
  ): Promise<void> {
    const scheduledTime = request.options.scheduledTime || 0;
    const delay = scheduledTime - Date.now();

    if (delay > 0) {
      // Wait until scheduled time
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    await this.executeImmediate(request, nodes, response);
  }

  /**
   * Execute rollback on a single node
   */
  private async executeOnNode(
    node: Node,
    request: RollbackRequest
  ): Promise<NodeResult> {
    // Create backup if enabled
    if (request.options.createBackup && this.config.backup.enabled) {
      await this.createBackup(node, request);
    }

    // Simulate rollback execution
    // In real implementation, would send RPC to node
    const success = Math.random() > 0.1;

    return {
      nodeId: node.id,
      success,
      timestamp: Date.now(),
      data: {
        component: request.targetComponent,
        version: request.targetVersion,
      },
    };
  }

  /**
   * Drain existing requests from nodes
   */
  private async drainNodes(nodes: Node[], timeout: number): Promise<void> {
    // Simulate draining
    // In real implementation, would send drain RPC
    await new Promise(resolve => setTimeout(resolve, Math.min(timeout, 5000)));
  }

  /**
   * Create backup before rollback
   */
  private async createBackup(
    node: Node,
    request: RollbackRequest
  ): Promise<void> {
    // Simulate backup creation
    // In real implementation, would create actual backup
    console.log(
      `Creating backup for node ${node.id} before rollback ${request.rollbackId}`
    );
  }

  // ==========================================================================
  // PRIVATE METHODS - Verification
  // ==========================================================================

  /**
   * Verify rollback success
   */
  private async verifyRollback(
    request: RollbackRequest,
    response: RollbackResponse
  ): Promise<void> {
    const nodes = this.getTargetNodes(request);
    const results: VerificationResult[] = [];

    for (const node of nodes) {
      const result = await this.verifyNode(node, request);
      results.push(result);
    }

    response.verificationResults = results;

    // Check if all nodes are healthy
    const allHealthy = results.every(r => r.healthStatus === "healthy");
    if (!allHealthy) {
      response.status = "partial";
    }
  }

  /**
   * Verify single node
   */
  private async verifyNode(
    node: Node,
    request: RollbackRequest
  ): Promise<VerificationResult> {
    // Simulate verification
    // In real implementation, would perform health checks
    const healthRoll = Math.random();
    const healthStatus: "healthy" | "degraded" | "unhealthy" =
      healthRoll > 0.8
        ? "healthy"
        : healthRoll > 0.5
          ? "degraded"
          : "unhealthy";

    return {
      nodeId: node.id,
      componentVersion: request.targetVersion,
      healthStatus,
      metrics: {
        errorRate: healthRoll > 0.8 ? 0.01 : healthRoll > 0.5 ? 0.1 : 0.3,
        latency: healthRoll > 0.8 ? 100 : healthRoll > 0.5 ? 500 : 2000,
        throughput: healthRoll > 0.8 ? 1000 : healthRoll > 0.5 ? 500 : 100,
        qualityScore: healthRoll > 0.8 ? 0.95 : healthRoll > 0.5 ? 0.8 : 0.6,
      },
      timestamp: Date.now(),
    };
  }

  // ==========================================================================
  // PRIVATE METHODS - Monitoring & Auto-Rollback
  // ==========================================================================

  /**
   * Start monitoring for auto-rollback
   */
  private startMonitoring(): void {
    setInterval(() => {
      this.checkAutoRollback();
    }, this.config.autoRollback.evaluationWindow / 2);
  }

  /**
   * Check if auto-rollback should be triggered
   */
  private checkAutoRollback(): void {
    if (this.metricsBuffer.length < this.config.autoRollback.minSamples) {
      return;
    }

    const avgErrorRate =
      this.metricsBuffer.reduce((sum, s) => sum + s.errorRate, 0) /
      this.metricsBuffer.length;
    const avgLatency =
      this.metricsBuffer.reduce((sum, s) => sum + s.latency, 0) /
      this.metricsBuffer.length;

    const errorRateViolation =
      avgErrorRate > this.config.autoRollback.errorRateThreshold;
    const latencyViolation =
      avgLatency > this.config.autoRollback.latencyThreshold;

    if (errorRateViolation || latencyViolation) {
      this.consecutiveViolations++;

      if (
        this.consecutiveViolations >=
        this.config.autoRollback.consecutiveViolations
      ) {
        this.triggerAutoRollback(errorRateViolation ? "error_rate" : "latency");
        this.consecutiveViolations = 0;
      }
    } else {
      this.consecutiveViolations = 0;
    }
  }

  /**
   * Trigger automatic rollback
   */
  private async triggerAutoRollback(
    type: "error_rate" | "latency"
  ): Promise<void> {
    const trigger: EmergencyTrigger = {
      triggerId: `auto-${Date.now()}`,
      type: "error_rate",
      severity: "high",
      threshold:
        type === "error_rate"
          ? this.config.autoRollback.errorRateThreshold
          : this.config.autoRollback.latencyThreshold,
      actualValue:
        type === "error_rate"
          ? this.metricsBuffer[this.metricsBuffer.length - 1]?.errorRate || 0
          : this.metricsBuffer[this.metricsBuffer.length - 1]?.latency || 0,
      timestamp: Date.now(),
      description: `Automatic rollback triggered due to ${type} violation`,
    };

    await this.triggerEmergencyRollback(trigger);
  }

  // ==========================================================================
  // PRIVATE METHODS - Helpers
  // ==========================================================================

  /**
   * Check if rollback has required approvals
   */
  private checkApproval(request: RollbackRequest): boolean {
    if (!request.requiresApproval) {
      return true;
    }

    const approvalCount = request.approvals?.length || 0;
    const required = request.requiredApprovals || 1;

    return approvalCount >= required;
  }

  /**
   * Get node count for rollback
   */
  private getNodeCount(request: RollbackRequest): number {
    if (request.scope === "local") {
      return 1;
    }
    return this.consensus.getNodes().length;
  }

  /**
   * Get target nodes for rollback
   */
  private getTargetNodes(request: RollbackRequest): Node[] {
    if (request.targetNodes && request.targetNodes.length > 0) {
      return this.consensus
        .getNodes()
        .filter(n => request.targetNodes!.includes(n.id));
    }

    if (request.scope === "local") {
      return [
        this.consensus.getNodes().find(n => n.id === this.consensus["nodeId"])!,
      ];
    }

    return this.consensus.getNodes();
  }

  /**
   * Store rollback in history
   */
  private storeHistory(
    request: RollbackRequest,
    response: RollbackResponse
  ): void {
    const entry: RollbackHistoryEntry = {
      request,
      response,
    };

    this.rollbacks.set(request.rollbackId, entry);

    // Clean old history
    this.cleanOldHistory();
  }

  /**
   * Clean old rollback history
   */
  private cleanOldHistory(): void {
    const cutoff =
      Date.now() - this.config.retainHistoryDays * 24 * 60 * 60 * 1000;

    for (const [id, entry] of this.rollbacks.entries()) {
      if (entry.request.timestamp < cutoff) {
        this.rollbacks.delete(id);
      }
    }
  }

  /**
   * Send notifications
   */
  private async sendNotifications(
    request: RollbackRequest,
    response: RollbackResponse
  ): Promise<void> {
    const channels = [
      ...this.config.notificationChannels,
      ...(request.options.notificationChannels || []),
    ];

    // In real implementation, would send actual notifications
    console.log(`Sending notifications for rollback ${request.rollbackId}`, {
      channels,
      status: response.status,
    });
  }

  /**
   * Send cancellation notification
   */
  private async sendCancellationNotification(
    request: RollbackRequest
  ): Promise<void> {
    console.log(`Rollback ${request.rollbackId} was cancelled`);
  }

  /**
   * Generate rollback steps for report
   */
  private generateRollbackSteps(history: RollbackHistoryEntry): RollbackStep[] {
    const steps: RollbackStep[] = [
      {
        step: 1,
        name: "Initiation",
        description: "Rollback request initiated",
        status: "completed",
        startedAt: history.request.timestamp,
        completedAt: history.request.timestamp + 100,
        duration: 100,
      },
      {
        step: 2,
        name: "Approval",
        description: "Approval process",
        status: history.request.requiresApproval ? "completed" : "skipped",
        startedAt: history.request.timestamp + 100,
        completedAt: history.request.timestamp + 500,
        duration: 400,
      },
      {
        step: 3,
        name: "Consensus",
        description: "Distributed consensus",
        status: history.request.scope === "local" ? "skipped" : "completed",
        startedAt: history.request.timestamp + 500,
        completedAt: history.request.timestamp + 2000,
        duration: 1500,
      },
      {
        step: 4,
        name: "Execution",
        description: "Rollback execution",
        status: "completed",
        startedAt: history.request.timestamp + 2000,
        completedAt: history.response.timestamp,
        duration: history.response.timestamp - history.request.timestamp - 2000,
      },
    ];

    if (history.response.verificationResults) {
      steps.push({
        step: 5,
        name: "Verification",
        description: "Post-rollback verification",
        status: "completed",
        startedAt: history.response.timestamp,
        completedAt: history.response.timestamp + 1000,
        duration: 1000,
      });
    }

    return steps;
  }

  /**
   * Generate metrics comparison for report
   */
  private generateMetricsComparison(
    history: RollbackHistoryEntry
  ): MetricsComparison {
    // Simplified metrics comparison
    const before: MetricsSnapshot = {
      timestamp: history.request.timestamp,
      errorRate: 0.15,
      avgLatency: 2000,
      p95Latency: 3000,
      p99Latency: 5000,
      throughput: 500,
      qualityScore: 0.7,
    };

    const after: MetricsSnapshot = {
      timestamp: history.response.timestamp,
      errorRate: 0.02,
      avgLatency: 150,
      p95Latency: 200,
      p99Latency: 300,
      throughput: 1000,
      qualityScore: 0.95,
    };

    // Calculate improvement (positive = better)
    const errorImprovement =
      (before.errorRate - after.errorRate) / before.errorRate;
    const latencyImprovement =
      (before.avgLatency - after.avgLatency) / before.avgLatency;
    const improvement = ((errorImprovement + latencyImprovement) / 2) * 100;

    return {
      before,
      after,
      improvement,
    };
  }

  /**
   * Generate recommendations for report
   */
  private generateRecommendations(history: RollbackHistoryEntry): string[] {
    const recommendations: string[] = [];

    if (history.response.status === "failed") {
      recommendations.push(
        "Investigate failure logs and consider manual intervention"
      );
    }

    if (history.response.errors.length > 0) {
      recommendations.push("Review failed nodes and consider replacing them");
    }

    if (history.response.verificationResults) {
      const degraded = history.response.verificationResults.filter(
        r => r.healthStatus === "degraded"
      ).length;

      if (degraded > 0) {
        recommendations.push(
          `${degraded} nodes are in degraded state - monitor closely`
        );
      }
    }

    if (history.response.status === "completed") {
      recommendations.push(
        "Rollback successful - consider investigating root cause"
      );
    }

    return recommendations;
  }
}

/**
 * Define the RollbackReport interface (inline since it's not in protocol types yet)
 */
export interface RollbackReport {
  rollbackId: string;
  timestamp: number;
  duration: number;
  nodesTotal: number;
  nodesSuccessful: number;
  nodesFailed: number;
  steps: RollbackStep[];
  errors: RollbackError[];
  metrics: MetricsComparison;
  recommendations: string[];
}

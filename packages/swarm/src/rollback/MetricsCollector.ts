/**
 * @lsi/swarm/rollback - Metrics Collector
 *
 * Collects metrics snapshots before, during, and after rollback operations
 * for health verification and improvement analysis.
 *
 * @module MetricsCollector
 */

import type { MetricsSnapshot, Node } from "@lsi/protocol";

/**
 * Metrics update during streaming
 */
export interface MetricsUpdate {
  timestamp: number;
  nodeId: string;
  rollbackId: string;
  metrics: Partial<MetricsSnapshot>;
}

/**
 * Aggregate metrics across multiple nodes
 */
export interface AggregateMetrics {
  errorRate: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  throughput: number;
  qualityScore: number;
  nodeCount: number;
  timestamp: number;
}

/**
 * Metrics collection configuration
 */
export interface MetricsCollectionConfig {
  /** Timeout for metrics collection (ms) */
  timeout?: number;
  /** Number of samples to collect for averaging */
  sampleCount?: number;
  /** Delay between samples (ms) */
  sampleDelay?: number;
  /** Include resource utilization */
  includeResourceUtil?: boolean;
}

/**
 * Metrics snapshot with node identifier
 */
interface NodeMetricsSnapshot extends MetricsSnapshot {
  nodeId: string;
}

/**
 * Streaming session state
 */
interface StreamingSession {
  rollbackId: string;
  nodes: Node[];
  callback: (update: MetricsUpdate) => void;
  interval?: NodeJS.Timeout;
  active: boolean;
}

/**
 * Metrics Collector - Collects metrics for rollback operations
 */
export class MetricsCollector {
  private snapshots: Map<string, NodeMetricsSnapshot[]>;
  private streamingSessions: Map<string, StreamingSession>;
  private collectionConfig: MetricsCollectionConfig;

  constructor(config?: MetricsCollectionConfig) {
    this.snapshots = new Map();
    this.streamingSessions = new Map();
    this.collectionConfig = {
      timeout: 30000,
      sampleCount: 3,
      sampleDelay: 100,
      includeResourceUtil: true,
      ...config,
    };
  }

  // ==========================================================================
  // PUBLIC API - SNAPSHOT COLLECTION
  // ==========================================================================

  /**
   * Collect metrics snapshot before rollback
   */
  async collectBefore(
    nodes: Node[],
    rollbackId?: string
  ): Promise<NodeMetricsSnapshot[]> {
    const snapshots: NodeMetricsSnapshot[] = [];

    for (const node of nodes) {
      const snapshot = await this.collectFromNode(node);
      snapshots.push(snapshot);
    }

    // Store snapshots
    const storageKey = rollbackId || this.generateStorageKey();
    this.snapshots.set(`${storageKey}-before`, snapshots);

    return snapshots;
  }

  /**
   * Collect metrics snapshot after rollback
   */
  async collectAfter(
    nodes: Node[],
    rollbackId: string
  ): Promise<NodeMetricsSnapshot[]> {
    const snapshots: NodeMetricsSnapshot[] = [];

    for (const node of nodes) {
      const snapshot = await this.collectFromNode(node);
      snapshots.push(snapshot);
    }

    // Store snapshots
    this.snapshots.set(`${rollbackId}-after`, snapshots);

    return snapshots;
  }

  /**
   * Collect metrics from a single node
   */
  private async collectFromNode(node: Node): Promise<NodeMetricsSnapshot> {
    // Simulate metrics collection with multiple samples
    const samples: MetricsSnapshot[] = [];

    for (let i = 0; i < this.collectionConfig.sampleCount!; i++) {
      const sample = await this.collectSingleSample(node);
      samples.push(sample);

      if (i < this.collectionConfig.sampleCount! - 1) {
        await new Promise(resolve =>
          setTimeout(resolve, this.collectionConfig.sampleDelay)
        );
      }
    }

    // Average the samples
    return this.averageSamples(node.id, samples);
  }

  /**
   * Stream metrics during rollback
   */
  async streamMetrics(
    nodes: Node[],
    rollbackId: string,
    callback: (update: MetricsUpdate) => void,
    intervalMs: number = 5000
  ): Promise<void> {
    const session: StreamingSession = {
      rollbackId,
      nodes,
      callback,
      active: true,
    };

    this.streamingSessions.set(rollbackId, session);

    // Send initial metrics
    for (const node of nodes) {
      const snapshot = await this.collectFromNode(node);
      callback({
        timestamp: Date.now(),
        nodeId: node.id,
        rollbackId,
        metrics: snapshot,
      });
    }

    // Set up interval for streaming updates
    session.interval = setInterval(async () => {
      if (!session.active) {
        return;
      }

      for (const node of session.nodes) {
        const snapshot = await this.collectFromNode(node);
        callback({
          timestamp: Date.now(),
          nodeId: node.id,
          rollbackId,
          metrics: snapshot,
        });
      }
    }, intervalMs);
  }

  /**
   * Stop streaming metrics
   */
  stopStreaming(rollbackId: string): void {
    const session = this.streamingSessions.get(rollbackId);
    if (session) {
      session.active = false;
      if (session.interval) {
        clearInterval(session.interval);
      }
      this.streamingSessions.delete(rollbackId);
    }
  }

  /**
   * Stop all streaming sessions
   */
  stopAllStreaming(): void {
    for (const rollbackId of this.streamingSessions.keys()) {
      this.stopStreaming(rollbackId);
    }
  }

  // ==========================================================================
  // PUBLIC API - AGGREGATION
  // ==========================================================================

  /**
   * Calculate aggregate metrics from snapshots
   */
  aggregateMetrics(snapshots: MetricsSnapshot[]): AggregateMetrics {
    if (snapshots.length === 0) {
      throw new Error("Cannot aggregate empty snapshots array");
    }

    // Calculate averages
    const avgErrorRate =
      snapshots.reduce((sum, s) => sum + s.errorRate, 0) / snapshots.length;
    const avgLatency =
      snapshots.reduce((sum, s) => sum + s.avgLatency, 0) / snapshots.length;
    const avgP95Latency =
      snapshots.reduce((sum, s) => sum + s.p95Latency, 0) / snapshots.length;
    const avgP99Latency =
      snapshots.reduce((sum, s) => sum + s.p99Latency, 0) / snapshots.length;
    const avgThroughput =
      snapshots.reduce((sum, s) => sum + s.throughput, 0) / snapshots.length;
    const avgQualityScore =
      snapshots.reduce((sum, s) => sum + s.qualityScore, 0) / snapshots.length;

    return {
      errorRate: avgErrorRate,
      avgLatency,
      p95Latency: avgP95Latency,
      p99Latency: avgP99Latency,
      throughput: avgThroughput,
      qualityScore: avgQualityScore,
      nodeCount: snapshots.length,
      timestamp: Date.now(),
    };
  }

  /**
   * Get aggregate metrics for a rollback
   */
  async getRollbackAggregates(rollbackId: string): Promise<{
    before?: AggregateMetrics;
    after?: AggregateMetrics;
  }> {
    const beforeSnapshots = this.snapshots.get(`${rollbackId}-before`);
    const afterSnapshots = this.snapshots.get(`${rollbackId}-after`);

    const result: {
      before?: AggregateMetrics;
      after?: AggregateMetrics;
    } = {};

    if (beforeSnapshots && beforeSnapshots.length > 0) {
      result.before = this.aggregateMetrics(beforeSnapshots);
    }

    if (afterSnapshots && afterSnapshots.length > 0) {
      result.after = this.aggregateMetrics(afterSnapshots);
    }

    return result;
  }

  /**
   * Calculate improvement between before and after
   */
  calculateImprovement(
    before: MetricsSnapshot | AggregateMetrics,
    after: MetricsSnapshot | AggregateMetrics
  ): {
    errorRateImprovement: number;
    latencyImprovement: number;
    throughputImprovement: number;
    qualityImprovement: number;
    overallImprovement: number;
  } {
    const errorRateImprovement =
      ((before.errorRate - after.errorRate) / (before.errorRate || 1)) * 100;
    const latencyImprovement =
      ((before.avgLatency - after.avgLatency) / (before.avgLatency || 1)) * 100;
    const throughputImprovement =
      ((after.throughput - before.throughput) / (before.throughput || 1)) * 100;
    const qualityImprovement =
      ((after.qualityScore - before.qualityScore) /
        (before.qualityScore || 1)) *
      100;

    // Weighted overall improvement
    const overallImprovement =
      errorRateImprovement * 0.4 +
      latencyImprovement * 0.3 +
      qualityImprovement * 0.2 +
      throughputImprovement * 0.1;

    return {
      errorRateImprovement,
      latencyImprovement,
      throughputImprovement,
      qualityImprovement,
      overallImprovement,
    };
  }

  // ==========================================================================
  // PUBLIC API - STORAGE
  // ==========================================================================

  /**
   * Get stored snapshots
   */
  getSnapshots(
    rollbackId: string,
    type?: "before" | "after"
  ): NodeMetricsSnapshot[] {
    const key = type ? `${rollbackId}-${type}` : rollbackId;
    return this.snapshots.get(key) || [];
  }

  /**
   * Clear snapshots for a rollback
   */
  clearSnapshots(rollbackId: string): void {
    this.snapshots.delete(`${rollbackId}-before`);
    this.snapshots.delete(`${rollbackId}-after`);
    this.snapshots.delete(rollbackId);
  }

  /**
   * Clear all snapshots
   */
  clearAllSnapshots(): void {
    this.snapshots.clear();
  }

  /**
   * Get active streaming sessions
   */
  getActiveSessions(): string[] {
    return Array.from(this.streamingSessions.keys()).filter(
      id => this.streamingSessions.get(id)?.active
    );
  }

  // ==========================================================================
  // PRIVATE METHODS - METRICS COLLECTION
  // ==========================================================================

  /**
   * Collect a single sample from a node
   */
  private async collectSingleSample(node: Node): Promise<MetricsSnapshot> {
    // Simulate metrics collection
    // In real implementation, would query actual metrics from node

    const baseLatency = Math.random() * 500 + 50; // 50-550ms
    const errorRate =
      Math.random() < 0.9 ? Math.random() * 0.05 : Math.random() * 0.2; // Usually low
    const throughput = Math.random() * 1000 + 200; // 200-1200 req/s

    const snapshot: MetricsSnapshot = {
      timestamp: Date.now(),
      errorRate,
      avgLatency: baseLatency,
      p95Latency: baseLatency * (1.5 + Math.random() * 0.5), // 1.5-2x avg
      p99Latency: baseLatency * (2 + Math.random() * 1), // 2-3x avg
      throughput,
      qualityScore: 0.7 + Math.random() * 0.3, // 0.7-1.0
    };

    // Add resource utilization if enabled
    if (this.collectionConfig.includeResourceUtil) {
      snapshot.resourceUtilization = {
        cpu: Math.random() * 60 + 10, // 10-70%
        memory: Math.random() * 50 + 30, // 30-80%
      };
    }

    return snapshot;
  }

  /**
   * Average multiple samples into a single snapshot
   */
  private averageSamples(
    nodeId: string,
    samples: MetricsSnapshot[]
  ): NodeMetricsSnapshot {
    const count = samples.length;

    const averaged: NodeMetricsSnapshot = {
      nodeId,
      timestamp: Date.now(),
      errorRate: samples.reduce((sum, s) => sum + s.errorRate, 0) / count,
      avgLatency: samples.reduce((sum, s) => sum + s.avgLatency, 0) / count,
      p95Latency: samples.reduce((sum, s) => sum + s.p95Latency, 0) / count,
      p99Latency: samples.reduce((sum, s) => sum + s.p99Latency, 0) / count,
      throughput: samples.reduce((sum, s) => sum + s.throughput, 0) / count,
      qualityScore: samples.reduce((sum, s) => sum + s.qualityScore, 0) / count,
    };

    // Average resource utilization if present in all samples
    if (samples.every(s => s.resourceUtilization)) {
      averaged.resourceUtilization = {
        cpu:
          samples.reduce(
            (sum, s) => sum + (s.resourceUtilization?.cpu || 0),
            0
          ) / count,
        memory:
          samples.reduce(
            (sum, s) => sum + (s.resourceUtilization?.memory || 0),
            0
          ) / count,
      };
    }

    return averaged;
  }

  // ==========================================================================
  // PRIVATE METHODS - UTILITIES
  // ==========================================================================

  /**
   * Generate a storage key
   */
  private generateStorageKey(): string {
    return `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update collection configuration
   */
  updateConfig(config: Partial<MetricsCollectionConfig>): void {
    this.collectionConfig = { ...this.collectionConfig, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): MetricsCollectionConfig {
    return { ...this.collectionConfig };
  }

  /**
   * Get statistics about stored snapshots
   */
  getSnapshotStats(): {
    totalSnapshots: number;
    rollbackIds: string[];
    storageSize: number;
  } {
    let totalSnapshots = 0;
    const rollbackIds = new Set<string>();

    for (const [key, snapshots] of this.snapshots.entries()) {
      totalSnapshots += snapshots.length;
      // Extract rollback ID from key (format: "rollbackId-before" or "rollbackId-after")
      const parts = key.split("-");
      if (parts.length >= 2) {
        rollbackIds.add(parts.slice(0, -1).join("-"));
      }
    }

    return {
      totalSnapshots,
      rollbackIds: Array.from(rollbackIds),
      storageSize: this.snapshots.size,
    };
  }
}

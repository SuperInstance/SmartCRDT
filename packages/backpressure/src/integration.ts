/**
 * Integration module for Backpressure with SSE Server and A2UI
 *
 * This module provides integration between the backpressure handling
 * system and SSE Server / Progressive Renderer.
 */

import { BackpressureDetector } from "./BackpressureDetector.js";
import { FlowController } from "./FlowController.js";
import { BufferManager } from "./BufferManager.js";
import { PriorityQueue } from "./PriorityQueue.js";
import { AdaptiveThrottler } from "./AdaptiveThrottler.js";
import { SlowClientDetector } from "./SlowClientDetector.js";

import type {
  SSEEvent,
  PressureLevel,
  BackpressureConfig,
  BackpressureAlert,
  FlowControlDecision,
  ClientMetrics,
} from "./types.js";
import {
  DEFAULT_BACKPRESSURE_CONFIG,
  createBackpressureAlert,
  estimateEventSize,
} from "./types.js";

/**
 * Integrated backpressure manager
 * Combines all backpressure components into a unified system
 */
export class IntegratedBackpressureManager {
  private detector: BackpressureDetector;
  private flowController: FlowController;
  private bufferManager: BufferManager;
  private priorityQueue: PriorityQueue;
  private throttler: AdaptiveThrottler;
  private slowClientDetector: SlowClientDetector;
  private config: BackpressureConfig;
  private alertHandlers: Set<(alert: BackpressureAlert) => void>;

  constructor(config?: Partial<BackpressureConfig>) {
    this.config = { ...DEFAULT_BACKPRESSURE_CONFIG, ...config };

    // Initialize components
    this.detector = new BackpressureDetector(this.config.detector);
    this.flowController = new FlowController({
      config: this.config.flow_control,
      autoSwitchStrategy: this.config.flow_control.auto_switch_strategy,
    });
    this.bufferManager = new BufferManager(
      this.config.flow_control.max_buffer_size,
      this.config.flow_control.drop_strategy
    );
    this.priorityQueue = new PriorityQueue(1000);
    this.throttler = new AdaptiveThrottler(this.config.throttle);
    this.slowClientDetector = new SlowClientDetector({
      latencyThreshold: this.config.detector.slow_latency_threshold,
      detectionCount: this.config.detector.slow_detection_count,
    });

    this.alertHandlers = new Set();

    // Wire up event handlers
    this.setupEventHandlers();
  }

  /**
   * Process an event before sending to client
   * Returns flow control decision
   */
  async processEvent(
    clientId: string,
    event: SSEEvent
  ): Promise<FlowControlDecision> {
    // Start monitoring if not already
    if (!this.detector.isMonitoring(clientId)) {
      this.startMonitoring(clientId);
    }

    // Record event in detector
    this.detector.recordEventAdd(clientId, event);

    // Get current pressure level
    const pressureLevel = this.detector.getPressureLevel(clientId);
    this.flowController.updatePressureLevel(clientId, pressureLevel);

    // Apply flow control
    const decision = this.flowController.applyBackpressure(clientId, event);

    if (decision.should_send) {
      // Record send in detector
      this.detector.recordEventSend(clientId, event);

      // Record delivery in throttler
      this.throttler.recordDelivery(clientId, false);

      // Record in slow client detector
      this.slowClientDetector.recordEventSend(clientId, event);
    } else {
      // Record throttling
      this.throttler.recordDelivery(clientId, true);
    }

    // Emit alert if critical
    if (
      this.config.enable_alerts &&
      pressureLevel === "critical" &&
      this.config.alert_on_critical
    ) {
      const metrics = this.detector.getClientMetrics(clientId);
      if (metrics) {
        const alert = createBackpressureAlert(clientId, pressureLevel, metrics);
        this.emitAlert(alert);
      }
    }

    return decision;
  }

  /**
   * Process multiple events in batch
   */
  async processBatch(
    clientId: string,
    events: SSEEvent[]
  ): Promise<{
    decisions: FlowControlDecision[];
    sent: number;
    dropped: number;
  }> {
    const decisions: FlowControlDecision[] = [];
    let sent = 0;
    let dropped = 0;

    for (const event of events) {
      const decision = await this.processEvent(clientId, event);
      decisions.push(decision);

      if (decision.should_send) {
        sent++;
      } else {
        dropped++;
      }
    }

    return { decisions, sent, dropped };
  }

  /**
   * Start monitoring a client
   */
  startMonitoring(
    clientId: string,
    capacity?: {
      buffer_size?: number;
      bandwidth?: number;
      processing_time?: number;
      max_concurrent?: number;
    }
  ): void {
    this.detector.monitorClient(clientId, capacity);
    this.bufferManager.setBufferLimit(
      clientId,
      capacity?.buffer_size || this.config.flow_control.max_buffer_size
    );
  }

  /**
   * Stop monitoring a client
   */
  stopMonitoring(clientId: string): void {
    this.detector.stopMonitoring(clientId);
    this.flowController.removeClient(clientId);
    this.bufferManager.removeBuffer(clientId);
    this.priorityQueue.removeQueue(clientId);
    this.throttler.removeClient(clientId);
    this.slowClientDetector.removeClient(clientId);
  }

  /**
   * Get client metrics
   */
  getClientMetrics(clientId: string): ClientMetrics | null {
    return this.detector.getClientMetrics(clientId);
  }

  /**
   * Get all client metrics
   */
  getAllClientMetrics(): ClientMetrics[] {
    return this.detector.getAllClientMetrics();
  }

  /**
   * Get pressure level for a client
   */
  getPressureLevel(clientId: string): PressureLevel {
    return this.detector.getPressureLevel(clientId);
  }

  /**
   * Check if client is slow
   */
  isSlowClient(clientId: string): boolean {
    return this.slowClientDetector.isSlowClient(clientId);
  }

  /**
   * Get all slow clients
   */
  getSlowClients(): string[] {
    return this.slowClientDetector.getSlowClients();
  }

  /**
   * Set flow control strategy for a client
   */
  setStrategy(
    clientId: string,
    strategy: "drop" | "buffer" | "throttle" | "compress"
  ): void {
    this.flowController.setStrategy(clientId, strategy);
  }

  /**
   * Get current strategy for a client
   */
  getStrategy(clientId: string): string | null {
    return this.flowController.getStrategy(clientId);
  }

  /**
   * Flush buffer for a client
   */
  flushBuffer(clientId: string): SSEEvent[] {
    return this.bufferManager.flushBuffer(clientId).events;
  }

  /**
   * Get queue size for a client
   */
  getQueueSize(clientId: string): number {
    return this.priorityQueue.getQueueSize(clientId);
  }

  /**
   * Get buffer stats for a client
   */
  getBufferStats(clientId: string) {
    return this.bufferManager.getBufferStats(clientId);
  }

  /**
   * Set throttle rate for a client
   */
  setThrottleRate(clientId: string, rate: number): void {
    this.throttler.setThrottleRate(clientId, rate);
  }

  /**
   * Get throttle rate for a client
   */
  getThrottleRate(clientId: string): number {
    return this.throttler.getCurrentRate(clientId);
  }

  /**
   * Get global statistics
   */
  getGlobalStats(): {
    detector: ReturnType<BackpressureDetector["getGlobalStats"]>;
    flowController: ReturnType<FlowController["getStats"]>;
    buffer: ReturnType<BufferManager["getGlobalStats"]>;
    queue: ReturnType<PriorityQueue["getGlobalStats"]>;
    throttler: ReturnType<AdaptiveThrottler["getGlobalStats"]>;
    slowClients: ReturnType<SlowClientDetector["getStats"]>;
  } {
    return {
      detector: this.detector.getGlobalStats(),
      flowController: this.flowController.getStats(),
      buffer: this.bufferManager.getGlobalStats(),
      queue: this.priorityQueue.getGlobalStats(),
      throttler: this.throttler.getGlobalStats(),
      slowClients: this.slowClientDetector.getStats(),
    };
  }

  /**
   * Add alert handler
   */
  onAlert(handler: (alert: BackpressureAlert) => void): void {
    this.alertHandlers.add(handler);
  }

  /**
   * Remove alert handler
   */
  offAlert(handler: (alert: BackpressureAlert) => void): void {
    this.alertHandlers.delete(handler);
  }

  /**
   * Clear all monitoring and state
   */
  clear(): void {
    this.detector.stopAllMonitoring();
    this.flowController.clear();
    this.bufferManager.clear();
    this.priorityQueue.clear();
    this.throttler.clear();
    this.slowClientDetector.clear();
    this.alertHandlers.clear();
  }

  /**
   * Setup internal event handlers
   */
  private setupEventHandlers(): void {
    // Forward backpressure events from detector
    this.detector.onBackpressureEvent(event => {
      if (
        event.pressure_level === "critical" &&
        this.config.alert_on_critical
      ) {
        const metrics = this.detector.getClientMetrics(event.client_id);
        if (metrics) {
          const alert = createBackpressureAlert(
            event.client_id,
            event.pressure_level,
            metrics
          );
          this.emitAlert(alert);
        }
      }
    });

    // Forward flow controller events
    this.flowController.onBackpressureEvent(event => {
      // Could emit alerts here too if needed
    });

    // Forward slow client detections
    this.slowClientDetector.onSlowDetection((clientId, detection) => {
      if (detection.is_slow && this.config.enable_alerts) {
        const metrics = this.detector.getClientMetrics(clientId);
        if (metrics) {
          const alert: BackpressureAlert = {
            severity: "warning",
            client_id: clientId,
            pressure_level: metrics.pressure_level,
            message: `Slow client detected: ${detection.reasons.join(", ")}`,
            recommended_action: "Consider throttling or disconnecting",
            timestamp: Date.now(),
            metrics,
          };
          this.emitAlert(alert);
        }
      }
    });
  }

  /**
   * Emit alert to all handlers
   */
  private emitAlert(alert: BackpressureAlert): void {
    for (const handler of this.alertHandlers) {
      try {
        handler(alert);
      } catch (error) {
        console.error("Error in backpressure alert handler:", error);
      }
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<BackpressureConfig>): void {
    this.config = { ...this.config, ...config };

    // Update component configs
    if (config.detector) {
      this.detector.updateConfig(config.detector);
    }
    if (config.flow_control) {
      this.flowController.updateConfig(config.flow_control);
    }
    if (config.throttle) {
      this.throttler.updateParams(config.throttle);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): BackpressureConfig {
    return { ...this.config };
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    healthy: boolean;
    totalClients: number;
    slowClients: number;
    criticalPressure: number;
    averageBufferUsage: number;
    alerts: {
      totalClients: number;
      slowClients: number;
      criticalPressure: number;
    };
  } {
    const stats = this.getGlobalStats();
    const criticalClients = stats.detector.criticalPressure;
    const slowClientsCount = stats.slowClients.slowClients;
    const avgBufferUsage = stats.buffer.averageUsage;

    const healthy = criticalClients === 0 && avgBufferUsage < 80;

    return {
      healthy,
      totalClients: stats.detector.totalClients,
      slowClients: slowClientsCount,
      criticalPressure: criticalClients,
      averageBufferUsage: avgBufferUsage,
      alerts: {
        totalClients: stats.detector.totalClients,
        slowClients: slowClientsCount,
        criticalPressure: criticalClients,
      },
    };
  }

  /**
   * Run automatic cleanup and maintenance
   */
  async runMaintenance(): Promise<{
    inactiveClientsRemoved: number;
    queuesFlushed: number;
    rateAdjustments: number;
  }> {
    // Remove inactive clients
    const inactiveClientsRemoved =
      this.slowClientDetector.removeInactiveClients();

    // Flush old buffers
    let queuesFlushed = 0;
    for (const clientId of this.bufferManager.getClientIds()) {
      const health = this.bufferManager.getBufferHealth(clientId);
      if (health.status === "critical") {
        this.bufferManager.flushBuffer(clientId);
        queuesFlushed++;
      }
    }

    // Auto-adjust throttle rates
    const adjustments = this.throttler.autoAdjustAll();
    const rateAdjustments = adjustments.size;

    return {
      inactiveClientsRemoved,
      queuesFlushed,
      rateAdjustments,
    };
  }

  /**
   * Get component instances for advanced usage
   */
  getComponents(): {
    detector: BackpressureDetector;
    flowController: FlowController;
    bufferManager: BufferManager;
    priorityQueue: PriorityQueue;
    throttler: AdaptiveThrottler;
    slowClientDetector: SlowClientDetector;
  } {
    return {
      detector: this.detector,
      flowController: this.flowController,
      bufferManager: this.bufferManager,
      priorityQueue: this.priorityQueue,
      throttler: this.throttler,
      slowClientDetector: this.slowClientDetector,
    };
  }
}

/**
 * Create a default integrated backpressure manager
 */
export function createBackpressureManager(
  config?: Partial<BackpressureConfig>
): IntegratedBackpressureManager {
  return new IntegratedBackpressureManager(config);
}

/**
 * SSE middleware for backpressure
 */
export function createSSEBackpressureMiddleware(
  manager: IntegratedBackpressureManager
): {
  middleware: (
    clientId: string,
    event: SSEEvent
  ) => Promise<FlowControlDecision>;
  cleanup: (clientId: string) => void;
} {
  return {
    middleware: async (clientId: string, event: SSEEvent) => {
      return await manager.processEvent(clientId, event);
    },
    cleanup: (clientId: string) => {
      manager.stopMonitoring(clientId);
    },
  };
}

/**
 * Metrics collector for monitoring
 */
export class BackpressureMetricsCollector {
  private manager: IntegratedBackpressureManager;
  private history: Array<{
    timestamp: number;
    stats: ReturnType<IntegratedBackpressureManager["getGlobalStats"]>;
  }> = [];
  private maxHistorySize: number;

  constructor(
    manager: IntegratedBackpressureManager,
    maxHistorySize: number = 100
  ) {
    this.manager = manager;
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Collect current metrics
   */
  collect(): ReturnType<IntegratedBackpressureManager["getGlobalStats"]> {
    const stats = this.manager.getGlobalStats();
    this.history.push({
      timestamp: Date.now(),
      stats,
    });

    // Trim history
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }

    return stats;
  }

  /**
   * Get metrics history
   */
  getHistory(): Array<{
    timestamp: number;
    stats: ReturnType<IntegratedBackpressureManager["getGlobalStats"]>;
  }> {
    return [...this.history];
  }

  /**
   * Get trends over time
   */
  getTrends(): {
    avgLatencyTrend: "increasing" | "decreasing" | "stable";
    bufferUsageTrend: "increasing" | "decreasing" | "stable";
    slowClientTrend: "increasing" | "decreasing" | "stable";
  } {
    if (this.history.length < 2) {
      return {
        avgLatencyTrend: "stable",
        bufferUsageTrend: "stable",
        slowClientTrend: "stable",
      };
    }

    const recent = this.history.slice(-10);
    const older = this.history.slice(-20, -10);

    const avgLatencyRecent =
      recent.reduce((sum, h) => sum + h.stats.detector.averageLatency, 0) /
      recent.length;
    const avgLatencyOlder =
      older.length > 0
        ? older.reduce((sum, h) => sum + h.stats.detector.averageLatency, 0) /
          older.length
        : avgLatencyRecent;

    const bufferUsageRecent =
      recent.reduce((sum, h) => sum + h.stats.buffer.averageUsage, 0) /
      recent.length;
    const bufferUsageOlder =
      older.length > 0
        ? older.reduce((sum, h) => sum + h.stats.buffer.averageUsage, 0) /
          older.length
        : bufferUsageRecent;

    const slowClientsRecent =
      recent.reduce((sum, h) => sum + h.stats.slowClients.slowClients, 0) /
      recent.length;
    const slowClientsOlder =
      older.length > 0
        ? older.reduce((sum, h) => sum + h.stats.slowClients.slowClients, 0) /
          older.length
        : slowClientsRecent;

    return {
      avgLatencyTrend:
        avgLatencyRecent > avgLatencyOlder * 1.1
          ? "increasing"
          : avgLatencyRecent < avgLatencyOlder * 0.9
            ? "decreasing"
            : "stable",
      bufferUsageTrend:
        bufferUsageRecent > bufferUsageOlder * 1.1
          ? "increasing"
          : bufferUsageRecent < bufferUsageOlder * 0.9
            ? "decreasing"
            : "stable",
      slowClientTrend:
        slowClientsRecent > slowClientsOlder * 1.1
          ? "increasing"
          : slowClientsRecent < slowClientsOlder * 0.9
            ? "decreasing"
            : "stable",
    };
  }

  /**
   * Clear history
   */
  clear(): void {
    this.history = [];
  }
}

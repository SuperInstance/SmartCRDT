/**
 * SlowClientDetector - Detects and tracks slow SSE clients
 *
 * Monitors client latency, throughput, and responsiveness to identify
 * slow clients that may need special handling.
 */

import type { SlowClientDetection, SSEEvent } from "./types.js";

/**
 * Client monitoring data
 */
interface ClientMonitoringData {
  /** Client identifier */
  clientId: string;
  /** Latency samples */
  latencySamples: Array<{
    latency: number;
    timestamp: number;
  }>;
  /** Throughput samples */
  throughputSamples: Array<{
    events: number;
    duration: number;
    timestamp: number;
  }>;
  /** Average latency */
  averageLatency: number;
  /** Current throughput */
  currentThroughput: number;
  /** Is client marked as slow */
  isSlow: number;
  /** Slow detection confidence (0-1) */
  confidence: number;
  /** Slow mark expiration timestamp */
  slowExpiresAt: number | null;
  /** Detection reasons */
  reasons: string[];
  /** Total events sent */
  totalEventsSent: number;
  /** Total events acknowledged */
  totalEventsAcked: number;
  /** Last activity timestamp */
  lastActivity: number;
}

/**
 * SlowClientDetector options
 */
export interface SlowClientDetectorOptions {
  /** Latency threshold for slow detection (ms) */
  latencyThreshold?: number;
  /** Throughput threshold for slow detection (events/sec) */
  throughputThreshold?: number;
  /** Number of consecutive detections before marking as slow */
  detectionCount?: number;
  /** Slow mark duration (ms) */
  slowDuration?: number;
  /** Inactivity timeout (ms) */
  inactivityTimeout?: number;
  /** Minimum samples before detection */
  minSamples?: number;
}

/**
 * SlowClientDetector - Main class
 */
export class SlowClientDetector {
  private clients: Map<string, ClientMonitoringData>;
  private latencyThreshold: number;
  private throughputThreshold: number;
  private detectionCount: number;
  private slowDuration: number;
  private inactivityTimeout: number;
  private minSamples: number;
  private eventHandlers: Set<
    (clientId: string, detection: SlowClientDetection) => void
  >;

  constructor(options?: SlowClientDetectorOptions) {
    this.clients = new Map();
    this.latencyThreshold = options?.latencyThreshold ?? 1000; // 1 second default
    this.throughputThreshold = options?.throughputThreshold ?? 10; // 10 events/sec default
    this.detectionCount = options?.detectionCount ?? 3;
    this.slowDuration = options?.slowDuration ?? 30000; // 30 seconds default
    this.inactivityTimeout = options?.inactivityTimeout ?? 60000; // 1 minute default
    this.minSamples = options?.minSamples ?? 5;
    this.eventHandlers = new Set();
  }

  /**
   * Detect if a client is slow
   */
  isSlowClient(clientId: string): boolean {
    const data = this.clients.get(clientId);
    if (!data) {
      return false;
    }

    // Check if slow mark has expired
    if (data.isSlow && data.slowExpiresAt && Date.now() > data.slowExpiresAt) {
      data.isSlow = 0;
      data.confidence = 0;
      data.slowExpiresAt = null;
      data.reasons = [];
    }

    return data.isSlow >= this.detectionCount;
  }

  /**
   * Get client latency
   */
  getClientLatency(clientId: string): number {
    const data = this.clients.get(clientId);
    return data?.averageLatency || 0;
  }

  /**
   * Get client throughput
   */
  getClientThroughput(clientId: string): number {
    const data = this.clients.get(clientId);
    return data?.currentThroughput || 0;
  }

  /**
   * Mark client as slow for a duration
   */
  markSlowClient(clientId: string, duration?: number): void {
    const data = this.getOrCreateClient(clientId);
    data.isSlow = this.detectionCount;
    data.confidence = 1.0;
    data.slowExpiresAt = Date.now() + (duration ?? this.slowDuration);

    if (!data.reasons.includes("manually_marked")) {
      data.reasons.push("manually_marked");
    }

    this.emitDetection(clientId, this.createDetection(data));
  }

  /**
   * Unmark client as slow
   */
  unmarkSlowClient(clientId: string): void {
    const data = this.clients.get(clientId);
    if (data) {
      data.isSlow = 0;
      data.confidence = 0;
      data.slowExpiresAt = null;
      data.reasons = [];
    }
  }

  /**
   * Record event send
   */
  recordEventSend(clientId: string, event: SSEEvent): void {
    const data = this.getOrCreateClient(clientId);
    data.totalEventsSent++;
    data.lastActivity = Date.now();
  }

  /**
   * Record event acknowledgment
   */
  recordEventAck(clientId: string, latency?: number): void {
    const data = this.getOrCreateClient(clientId);
    data.totalEventsAcked++;
    data.lastActivity = Date.now();

    if (latency !== undefined) {
      this.recordLatency(clientId, latency);
    }
  }

  /**
   * Record latency sample
   */
  recordLatency(clientId: string, latency: number): void {
    const data = this.getOrCreateClient(clientId);

    data.latencySamples.push({
      latency,
      timestamp: Date.now(),
    });

    // Keep only recent samples
    const maxSamples = 100;
    if (data.latencySamples.length > maxSamples) {
      data.latencySamples = data.latencySamples.slice(-maxSamples);
    }

    // Update average latency
    this.updateAverageLatency(data);

    // Check for slow client
    this.detectSlowClient(data);
  }

  /**
   * Record throughput sample
   */
  recordThroughput(clientId: string, events: number, duration: number): void {
    const data = this.getOrCreateClient(clientId);

    data.throughputSamples.push({
      events,
      duration,
      timestamp: Date.now(),
    });

    // Keep only recent samples
    const maxSamples = 50;
    if (data.throughputSamples.length > maxSamples) {
      data.throughputSamples = data.throughputSamples.slice(-maxSamples);
    }

    // Update current throughput
    this.updateCurrentThroughput(data);

    // Check for slow client
    this.detectSlowClient(data);
  }

  /**
   * Get full detection for a client
   */
  getDetection(clientId: string): SlowClientDetection | null {
    const data = this.clients.get(clientId);
    if (!data) {
      return null;
    }
    return this.createDetection(data);
  }

  /**
   * Get all slow clients
   */
  getSlowClients(): string[] {
    const slowClients: string[] = [];
    for (const [clientId, data] of this.clients.entries()) {
      if (data.isSlow >= this.detectionCount) {
        slowClients.push(clientId);
      }
    }
    return slowClients;
  }

  /**
   * Get all client detections
   */
  getAllDetections(): Map<string, SlowClientDetection> {
    const detections = new Map<string, SlowClientDetection>();
    for (const [clientId, data] of this.clients.entries()) {
      detections.set(clientId, this.createDetection(data));
    }
    return detections;
  }

  /**
   * Remove client monitoring
   */
  removeClient(clientId: string): void {
    this.clients.delete(clientId);
  }

  /**
   * Clear all monitoring
   */
  clear(): void {
    this.clients.clear();
    this.eventHandlers.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(options: Partial<SlowClientDetectorOptions>): void {
    if (options.latencyThreshold !== undefined) {
      this.latencyThreshold = options.latencyThreshold;
    }
    if (options.throughputThreshold !== undefined) {
      this.throughputThreshold = options.throughputThreshold;
    }
    if (options.detectionCount !== undefined) {
      this.detectionCount = options.detectionCount;
    }
    if (options.slowDuration !== undefined) {
      this.slowDuration = options.slowDuration;
    }
    if (options.inactivityTimeout !== undefined) {
      this.inactivityTimeout = options.inactivityTimeout;
    }
    if (options.minSamples !== undefined) {
      this.minSamples = options.minSamples;
    }
  }

  /**
   * Add event handler
   */
  onSlowDetection(
    handler: (clientId: string, detection: SlowClientDetection) => void
  ): void {
    this.eventHandlers.add(handler);
  }

  /**
   * Remove event handler
   */
  offSlowDetection(
    handler: (clientId: string, detection: SlowClientDetection) => void
  ): void {
    this.eventHandlers.delete(handler);
  }

  /**
   * Get monitoring statistics
   */
  getStats(): {
    totalClients: number;
    slowClients: number;
    averageLatency: number;
    averageThroughput: number;
    detectionRate: number;
  } {
    const clients = Array.from(this.clients.values());
    const slowClients = clients.filter(c => c.isSlow >= this.detectionCount);

    const totalLatency = clients.reduce((sum, c) => sum + c.averageLatency, 0);
    const averageLatency =
      clients.length > 0 ? totalLatency / clients.length : 0;

    const totalThroughput = clients.reduce(
      (sum, c) => sum + c.currentThroughput,
      0
    );
    const averageThroughput =
      clients.length > 0 ? totalThroughput / clients.length : 0;

    const detectionRate =
      clients.length > 0 ? (slowClients.length / clients.length) * 100 : 0;

    return {
      totalClients: clients.length,
      slowClients: slowClients.length,
      averageLatency,
      averageThroughput,
      detectionRate,
    };
  }

  /**
   * Get or create client monitoring data
   */
  private getOrCreateClient(clientId: string): ClientMonitoringData {
    if (!this.clients.has(clientId)) {
      this.clients.set(clientId, {
        clientId,
        latencySamples: [],
        throughputSamples: [],
        averageLatency: 0,
        currentThroughput: 0,
        isSlow: 0,
        confidence: 0,
        slowExpiresAt: null,
        reasons: [],
        totalEventsSent: 0,
        totalEventsAcked: 0,
        lastActivity: Date.now(),
      });
    }
    return this.clients.get(clientId)!;
  }

  /**
   * Update average latency
   */
  private updateAverageLatency(data: ClientMonitoringData): void {
    if (data.latencySamples.length === 0) {
      data.averageLatency = 0;
      return;
    }

    const total = data.latencySamples.reduce((sum, s) => sum + s.latency, 0);
    data.averageLatency = total / data.latencySamples.length;
  }

  /**
   * Update current throughput
   */
  private updateCurrentThroughput(data: ClientMonitoringData): void {
    if (data.throughputSamples.length === 0) {
      data.currentThroughput = 0;
      return;
    }

    const totalEvents = data.throughputSamples.reduce(
      (sum, s) => sum + s.events,
      0
    );
    const totalDuration = data.throughputSamples.reduce(
      (sum, s) => sum + s.duration,
      0
    );

    data.currentThroughput =
      totalDuration > 0 ? (totalEvents / totalDuration) * 1000 : 0;
  }

  /**
   * Detect slow client
   */
  private detectSlowClient(data: ClientMonitoringData): void {
    if (data.latencySamples.length < this.minSamples) {
      return;
    }

    const reasons: string[] = [];
    let isSlow = false;

    // Check latency
    if (data.averageLatency > this.latencyThreshold) {
      isSlow = true;
      reasons.push(`high_latency_${data.averageLatency.toFixed(0)}ms`);
    }

    // Check throughput
    if (
      data.currentThroughput < this.throughputThreshold &&
      data.currentThroughput > 0
    ) {
      isSlow = true;
      reasons.push(`low_throughput_${data.currentThroughput.toFixed(1)}eps`);
    }

    // Check event acknowledgment rate
    if (data.totalEventsSent > 0) {
      const ackRate = data.totalEventsAcked / data.totalEventsSent;
      if (ackRate < 0.9) {
        isSlow = true;
        reasons.push(`low_ack_rate_${(ackRate * 100).toFixed(0)}%`);
      }
    }

    // Update slow status
    if (isSlow) {
      data.isSlow++;
      data.reasons = reasons;
      data.confidence = Math.min(1, data.isSlow / this.detectionCount);
      data.slowExpiresAt = Date.now() + this.slowDuration;

      if (data.isSlow >= this.detectionCount) {
        this.emitDetection(data.clientId, this.createDetection(data));
      }
    } else {
      // Decrement slow count if not slow
      data.isSlow = Math.max(0, data.isSlow - 1);
      if (data.isSlow === 0) {
        data.confidence = 0;
        data.reasons = [];
      }
    }
  }

  /**
   * Create detection object
   */
  private createDetection(data: ClientMonitoringData): SlowClientDetection {
    return {
      client_id: data.clientId,
      is_slow: data.isSlow >= this.detectionCount,
      latency: data.averageLatency,
      throughput: data.currentThroughput,
      confidence: data.confidence,
      reasons: [...data.reasons],
    };
  }

  /**
   * Emit detection event
   */
  private emitDetection(
    clientId: string,
    detection: SlowClientDetection
  ): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(clientId, detection);
      } catch (error) {
        console.error("Error in slow detection handler:", error);
      }
    }
  }

  /**
   * Check for inactive clients
   */
  getInactiveClients(): string[] {
    const now = Date.now();
    const inactive: string[] = [];

    for (const [clientId, data] of this.clients.entries()) {
      if (now - data.lastActivity > this.inactivityTimeout) {
        inactive.push(clientId);
      }
    }

    return inactive;
  }

  /**
   * Remove inactive clients
   */
  removeInactiveClients(): number {
    const inactive = this.getInactiveClients();
    for (const clientId of inactive) {
      this.removeClient(clientId);
    }
    return inactive.length;
  }

  /**
   * Get client details
   */
  getClientDetails(clientId: string): {
    totalEventsSent: number;
    totalEventsAcked: number;
    ackRate: number;
    lastActivity: number;
    inactiveTime: number | null;
  } | null {
    const data = this.clients.get(clientId);
    if (!data) {
      return null;
    }

    const ackRate =
      data.totalEventsSent > 0
        ? data.totalEventsAcked / data.totalEventsSent
        : 1;

    const now = Date.now();
    const inactiveTime = now - data.lastActivity;

    return {
      totalEventsSent: data.totalEventsSent,
      totalEventsAcked: data.totalEventsAcked,
      ackRate,
      lastActivity: data.lastActivity,
      inactiveTime,
    };
  }

  /**
   * Get all monitored client IDs
   */
  getClientIds(): string[] {
    return Array.from(this.clients.keys());
  }
}

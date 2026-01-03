/**
 * BackpressureDetector - Monitors clients for backpressure conditions
 *
 * Detects and tracks backpressure levels for SSE clients by monitoring
 * buffer usage, latency, throughput, and bandwidth.
 */

import type {
  PressureLevel,
  BackpressureEvent,
  ClientMetrics,
  ClientCapacity,
  BandwidthSample,
  LatencySample,
  ThroughputSample,
  BackpressureDetectorConfig,
  BufferStats,
  SSEEvent,
} from "./types.js";
import {
  calculateBufferUsage,
  getPressureLevelFromUsage,
  estimateEventSize,
  createBackpressureEvent,
  DEFAULT_DETECTOR_CONFIG,
} from "./types.js";

/**
 * Client monitoring state
 */
interface ClientState {
  /** Client identifier */
  clientId: string;
  /** Current pressure level */
  pressureLevel: PressureLevel;
  /** Buffer statistics */
  bufferStats: BufferStats;
  /** Current buffer size in bytes */
  currentBufferSize: number;
  /** Bandwidth samples for estimation */
  bandwidthSamples: BandwidthSample[];
  /** Estimated bandwidth in bytes/second */
  estimatedBandwidth: number;
  /** Latency samples */
  latencySamples: LatencySample[];
  /** Average latency in milliseconds */
  averageLatency: number;
  /** Throughput samples */
  throughputSamples: ThroughputSample[];
  /** Current throughput in events/second */
  currentThroughput: number;
  /** Events processed since last monitoring cycle */
  eventsProcessed: number;
  /** Slow detection counter */
  slowDetectionCount: number;
  /** Whether client is marked as slow */
  isSlow: boolean;
  /** Monitoring interval ID */
  intervalId?: ReturnType<typeof setInterval>;
  /** Last update timestamp */
  lastUpdate: number;
  /** Total events sent */
  totalEventsSent: number;
  /** Total events dropped */
  totalEventsDropped: number;
  /** Total bytes sent */
  totalBytesSent: number;
}

/**
 * Backpressure detection result
 */
export interface DetectionResult {
  /** Client identifier */
  clientId: string;
  /** Current pressure level */
  pressureLevel: PressureLevel;
  /** Previous pressure level */
  previousLevel: PressureLevel;
  /** Pressure level changed */
  levelChanged: boolean;
  /** Client metrics snapshot */
  metrics: ClientMetrics;
  /** Backpressure events (if any) */
  events: BackpressureEvent[];
}

/**
 * Event handler for backpressure events
 */
export type BackpressureEventHandler = (event: BackpressureEvent) => void;

/**
 * BackpressureDetector - Main class
 */
export class BackpressureDetector {
  private clients: Map<string, ClientState>;
  private config: BackpressureDetectorConfig;
  private eventHandlers: Set<BackpressureEventHandler>;
  private globalCounter: number;
  private monitoringInterval?: ReturnType<typeof setInterval>;

  constructor(config?: Partial<BackpressureDetectorConfig>) {
    this.clients = new Map();
    this.config = { ...DEFAULT_DETECTOR_CONFIG, ...config };
    this.eventHandlers = new Set();
    this.globalCounter = 0;

    // Start global monitoring interval
    this.startGlobalMonitoring();
  }

  /**
   * Start monitoring a client
   */
  monitorClient(clientId: string, capacity?: Partial<ClientCapacity>): void {
    if (this.clients.has(clientId)) {
      return; // Already monitoring
    }

    const maxBufferSize =
      capacity?.buffer_size ||
      this.config.flow_control?.max_buffer_size ||
      1024 * 1024;

    const clientState: ClientState = {
      clientId,
      pressureLevel: "none",
      bufferStats: {
        current_size: 0,
        max_size: maxBufferSize,
        usage_percent: 0,
        event_count: 0,
        oldest_timestamp: null,
        newest_timestamp: null,
        total_dropped: 0,
        events_dropped: 0,
      },
      currentBufferSize: 0,
      bandwidthSamples: [],
      estimatedBandwidth: capacity?.bandwidth || 1024 * 1024, // Default 1MB/s
      latencySamples: [],
      averageLatency: 0,
      throughputSamples: [],
      currentThroughput: 0,
      eventsProcessed: 0,
      slowDetectionCount: 0,
      isSlow: false,
      lastUpdate: Date.now(),
      totalEventsSent: 0,
      totalEventsDropped: 0,
      totalBytesSent: 0,
    };

    this.clients.set(clientId, clientState);

    // Emit backpressure event
    this.emitEvent(
      createBackpressureEvent(clientId, "none", "started_monitoring")
    );
  }

  /**
   * Stop monitoring a client
   */
  stopMonitoring(clientId: string): void {
    const clientState = this.clients.get(clientId);
    if (!clientState) {
      return;
    }

    if (clientState.intervalId) {
      clearInterval(clientState.intervalId);
    }

    this.clients.delete(clientId);
  }

  /**
   * Stop monitoring all clients
   */
  stopAllMonitoring(): void {
    for (const clientId of this.clients.keys()) {
      this.stopMonitoring(clientId);
    }
  }

  /**
   * Get current pressure level for a client
   */
  getPressureLevel(clientId: string): PressureLevel {
    const clientState = this.clients.get(clientId);
    if (!clientState) {
      return "none";
    }
    return clientState.pressureLevel;
  }

  /**
   * Get complete metrics for a client
   */
  getClientMetrics(clientId: string): ClientMetrics | null {
    const clientState = this.clients.get(clientId);
    if (!clientState) {
      return null;
    }

    return {
      client_id: clientState.clientId,
      pressure_level: clientState.pressureLevel,
      buffer_stats: { ...clientState.bufferStats },
      bandwidth: clientState.estimatedBandwidth,
      latency: clientState.averageLatency,
      throughput: clientState.currentThroughput,
      is_slow: clientState.isSlow,
      strategy: "buffer", // Default, will be set by FlowController
      last_update: clientState.lastUpdate,
    };
  }

  /**
   * Detect if a client is experiencing slowdown
   */
  detectSlowdown(clientId: string): boolean {
    const clientState = this.clients.get(clientId);
    if (!clientState) {
      return false;
    }

    // Check latency threshold
    if (clientState.averageLatency > this.config.slow_latency_threshold) {
      clientState.slowDetectionCount++;
      if (clientState.slowDetectionCount >= this.config.slow_detection_count) {
        clientState.isSlow = true;
        return true;
      }
    } else {
      // Reset counter if latency is good
      clientState.slowDetectionCount = Math.max(
        0,
        clientState.slowDetectionCount - 1
      );
      if (clientState.slowDetectionCount === 0) {
        clientState.isSlow = false;
      }
    }

    return clientState.isSlow;
  }

  /**
   * Estimate bandwidth for a client
   */
  estimateBandwidth(clientId: string): number {
    const clientState = this.clients.get(clientId);
    if (!clientState) {
      return 0;
    }

    // Calculate from recent samples
    const samples = clientState.bandwidthSamples.slice(
      -this.config.bandwidth_window
    );
    if (samples.length === 0) {
      return clientState.estimatedBandwidth;
    }

    // Weighted average (more recent = higher weight)
    let totalWeight = 0;
    let weightedSum = 0;

    for (let i = 0; i < samples.length; i++) {
      const weight = i + 1;
      const bandwidth = (samples[i].bytes / samples[i].duration) * 1000; // bytes/second
      weightedSum += bandwidth * weight;
      totalWeight += weight;
    }

    return totalWeight > 0
      ? weightedSum / totalWeight
      : clientState.estimatedBandwidth;
  }

  /**
   * Get buffer usage percentage
   */
  getBufferUsage(clientId: string): number {
    const clientState = this.clients.get(clientId);
    if (!clientState) {
      return 0;
    }
    return clientState.bufferStats.usage_percent;
  }

  /**
   * Record an event send
   */
  recordEventSend(clientId: string, event: SSEEvent, latency?: number): void {
    const clientState = this.clients.get(clientId);
    if (!clientState) {
      return;
    }

    const eventSize = estimateEventSize(event);
    const now = Date.now();

    // Update buffer stats (assume event was sent, so buffer decreases)
    clientState.currentBufferSize = Math.max(
      0,
      clientState.currentBufferSize - eventSize
    );
    clientState.totalEventsSent++;
    clientState.totalBytesSent += eventSize;
    clientState.eventsProcessed++;

    // Record latency if provided
    if (latency !== undefined) {
      this.recordLatency(clientId, latency);
    }

    // Record bandwidth sample
    this.recordBandwidthSample(clientId, eventSize, 10); // Assume 10ms to send

    // Update buffer stats
    this.updateBufferStats(clientId);

    clientState.lastUpdate = now;
  }

  /**
   * Record an event add to buffer
   */
  recordEventAdd(clientId: string, event: SSEEvent): void {
    const clientState = this.clients.get(clientId);
    if (!clientState) {
      return;
    }

    const eventSize = estimateEventSize(event);

    // Increase buffer size
    clientState.currentBufferSize += eventSize;
    clientState.bufferStats.event_count++;

    // Update timestamps
    const now = Date.now();
    if (!clientState.bufferStats.oldest_timestamp) {
      clientState.bufferStats.oldest_timestamp = now;
    }
    clientState.bufferStats.newest_timestamp = now;

    // Update buffer stats
    this.updateBufferStats(clientId);

    clientState.lastUpdate = now;
  }

  /**
   * Record events dropped
   */
  recordEventsDropped(clientId: string, count: number, bytes: number): void {
    const clientState = this.clients.get(clientId);
    if (!clientState) {
      return;
    }

    clientState.totalEventsDropped += count;
    clientState.bufferStats.events_dropped += count;
    clientState.bufferStats.total_dropped += bytes;

    // Decrease buffer size
    clientState.currentBufferSize = Math.max(
      0,
      clientState.currentBufferSize - bytes
    );

    // Update buffer stats
    this.updateBufferStats(clientId);
  }

  /**
   * Record a latency sample
   */
  recordLatency(clientId: string, latency: number): void {
    const clientState = this.clients.get(clientId);
    if (!clientState) {
      return;
    }

    clientState.latencySamples.push({
      latency,
      timestamp: Date.now(),
    });

    // Keep only recent samples
    const maxSamples = 100;
    if (clientState.latencySamples.length > maxSamples) {
      clientState.latencySamples =
        clientState.latencySamples.slice(-maxSamples);
    }

    // Calculate average latency
    const total = clientState.latencySamples.reduce(
      (sum, s) => sum + s.latency,
      0
    );
    clientState.averageLatency = total / clientState.latencySamples.length;

    // Detect slowdown
    this.detectSlowdown(clientId);
  }

  /**
   * Record a bandwidth sample
   */
  recordBandwidthSample(
    clientId: string,
    bytes: number,
    duration: number
  ): void {
    const clientState = this.clients.get(clientId);
    if (!clientState) {
      return;
    }

    clientState.bandwidthSamples.push({
      bytes,
      duration,
      timestamp: Date.now(),
    });

    // Keep only recent samples
    if (clientState.bandwidthSamples.length > this.config.bandwidth_window) {
      clientState.bandwidthSamples = clientState.bandwidthSamples.slice(
        -this.config.bandwidth_window
      );
    }

    // Update estimated bandwidth
    clientState.estimatedBandwidth = this.estimateBandwidth(clientId);
  }

  /**
   * Record a throughput sample
   */
  recordThroughputSample(
    clientId: string,
    events: number,
    duration: number
  ): void {
    const clientState = this.clients.get(clientId);
    if (!clientState) {
      return;
    }

    clientState.throughputSamples.push({
      events,
      duration,
      timestamp: Date.now(),
    });

    // Keep only recent samples
    const maxSamples = 50;
    if (clientState.throughputSamples.length > maxSamples) {
      clientState.throughputSamples =
        clientState.throughputSamples.slice(-maxSamples);
    }

    // Calculate current throughput
    const totalEvents = clientState.throughputSamples.reduce(
      (sum, s) => sum + s.events,
      0
    );
    const totalDuration = clientState.throughputSamples.reduce(
      (sum, s) => sum + s.duration,
      0
    );
    clientState.currentThroughput =
      totalDuration > 0 ? (totalEvents / totalDuration) * 1000 : 0;
  }

  /**
   * Update buffer statistics
   */
  private updateBufferStats(clientId: string): void {
    const clientState = this.clients.get(clientId);
    if (!clientState) {
      return;
    }

    clientState.bufferStats.current_size = clientState.currentBufferSize;
    clientState.bufferStats.usage_percent = calculateBufferUsage(
      clientState.currentBufferSize,
      clientState.bufferStats.max_size
    );

    // Update pressure level
    const previousLevel = clientState.pressureLevel;
    clientState.pressureLevel = getPressureLevelFromUsage(
      clientState.bufferStats.usage_percent,
      this.config
    );

    // Emit event if pressure level changed
    if (previousLevel !== clientState.pressureLevel) {
      this.emitEvent(
        createBackpressureEvent(
          clientId,
          clientState.pressureLevel,
          clientState.pressureLevel === "none"
            ? "client_recovered"
            : "buffer_overflow",
          { previousLevel }
        )
      );
    }
  }

  /**
   * Run detection cycle for a client
   */
  private runDetectionCycle(clientId: string): DetectionResult | null {
    const clientState = this.clients.get(clientId);
    if (!clientState) {
      return null;
    }

    const previousLevel = clientState.pressureLevel;
    const now = Date.now();

    // Record throughput sample
    if (clientState.eventsProcessed > 0) {
      const elapsed = now - clientState.lastUpdate;
      if (elapsed > 0) {
        this.recordThroughputSample(
          clientId,
          clientState.eventsProcessed,
          elapsed
        );
        clientState.eventsProcessed = 0;
      }
    }

    // Update buffer stats and pressure level
    this.updateBufferStats(clientId);

    const levelChanged = clientState.pressureLevel !== previousLevel;
    const events: BackpressureEvent[] = [];

    if (levelChanged) {
      events.push(
        createBackpressureEvent(
          clientId,
          clientState.pressureLevel,
          clientState.pressureLevel === "none"
            ? "client_recovered"
            : "buffer_overflow",
          { previousLevel }
        )
      );
    }

    // Check for slow client
    if (this.detectSlowdown(clientId) && !clientState.isSlow) {
      events.push(
        createBackpressureEvent(
          clientId,
          clientState.pressureLevel,
          "client_slow_detected",
          { latency: clientState.averageLatency }
        )
      );
    }

    return {
      clientId,
      pressureLevel: clientState.pressureLevel,
      previousLevel,
      levelChanged,
      metrics: this.getClientMetrics(clientId)!,
      events,
    };
  }

  /**
   * Start global monitoring interval
   */
  private startGlobalMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      const now = Date.now();
      for (const clientId of this.clients.keys()) {
        this.runDetectionCycle(clientId);
      }
    }, this.config.monitor_interval);
  }

  /**
   * Stop global monitoring
   */
  stopGlobalMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  /**
   * Add event handler
   */
  onBackpressureEvent(handler: BackpressureEventHandler): void {
    this.eventHandlers.add(handler);
  }

  /**
   * Remove event handler
   */
  offBackpressureEvent(handler: BackpressureEventHandler): void {
    this.eventHandlers.delete(handler);
  }

  /**
   * Emit backpressure event
   */
  private emitEvent(event: BackpressureEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error("Error in backpressure event handler:", error);
      }
    }
  }

  /**
   * Get all monitored client IDs
   */
  getMonitoredClients(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Get number of monitored clients
   */
  getMonitoredClientCount(): number {
    return this.clients.size;
  }

  /**
   * Check if client is being monitored
   */
  isMonitoring(clientId: string): boolean {
    return this.clients.has(clientId);
  }

  /**
   * Get all client metrics
   */
  getAllClientMetrics(): ClientMetrics[] {
    const metrics: ClientMetrics[] = [];
    for (const clientId of this.clients.keys()) {
      const clientMetrics = this.getClientMetrics(clientId);
      if (clientMetrics) {
        metrics.push(clientMetrics);
      }
    }
    return metrics;
  }

  /**
   * Get clients by pressure level
   */
  getClientsByPressureLevel(level: PressureLevel): string[] {
    const clients: string[] = [];
    for (const [clientId, state] of this.clients.entries()) {
      if (state.pressureLevel === level) {
        clients.push(clientId);
      }
    }
    return clients;
  }

  /**
   * Get slow clients
   */
  getSlowClients(): string[] {
    const clients: string[] = [];
    for (const [clientId, state] of this.clients.entries()) {
      if (state.isSlow) {
        clients.push(clientId);
      }
    }
    return clients;
  }

  /**
   * Clear all monitoring data
   */
  clear(): void {
    this.stopAllMonitoring();
    this.clients.clear();
    this.eventHandlers.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<BackpressureDetectorConfig>): void {
    this.config = { ...this.config, ...config };
    this.stopGlobalMonitoring();
    this.startGlobalMonitoring();
  }

  /**
   * Get current configuration
   */
  getConfig(): BackpressureDetectorConfig {
    return { ...this.config };
  }

  /**
   * Force a detection cycle for all clients
   */
  forceDetectionCycle(): DetectionResult[] {
    const results: DetectionResult[] = [];
    for (const clientId of this.clients.keys()) {
      const result = this.runDetectionCycle(clientId);
      if (result) {
        results.push(result);
      }
    }
    return results;
  }

  /**
   * Get statistics for all clients
   */
  getGlobalStats(): {
    totalClients: number;
    slowClients: number;
    criticalPressure: number;
    highPressure: number;
    mediumPressure: number;
    lowPressure: number;
    noPressure: number;
    averageBufferUsage: number;
    averageLatency: number;
    totalEventsSent: number;
    totalEventsDropped: number;
  } {
    const clients = Array.from(this.clients.values());

    return {
      totalClients: clients.length,
      slowClients: clients.filter(c => c.isSlow).length,
      criticalPressure: clients.filter(c => c.pressureLevel === "critical")
        .length,
      highPressure: clients.filter(c => c.pressureLevel === "high").length,
      mediumPressure: clients.filter(c => c.pressureLevel === "medium").length,
      lowPressure: clients.filter(c => c.pressureLevel === "low").length,
      noPressure: clients.filter(c => c.pressureLevel === "none").length,
      averageBufferUsage:
        clients.length > 0
          ? clients.reduce((sum, c) => sum + c.bufferStats.usage_percent, 0) /
            clients.length
          : 0,
      averageLatency:
        clients.length > 0
          ? clients.reduce((sum, c) => sum + c.averageLatency, 0) /
            clients.length
          : 0,
      totalEventsSent: clients.reduce((sum, c) => sum + c.totalEventsSent, 0),
      totalEventsDropped: clients.reduce(
        (sum, c) => sum + c.totalEventsDropped,
        0
      ),
    };
  }
}

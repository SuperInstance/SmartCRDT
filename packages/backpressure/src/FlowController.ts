/**
 * FlowController - Applies flow control strategies to handle backpressure
 *
 * Implements various flow control strategies including drop, buffer, throttle,
 * and compress to manage backpressure for SSE clients.
 */

import type {
  SSEEvent,
  FlowControlStrategy,
  DropStrategy,
  EventPriority,
  FlowControlDecision,
  FlowControlConfig,
  PressureLevel,
  BackpressureEvent,
  CompressionResult,
} from "./types.js";
import {
  DEFAULT_FLOW_CONTROL_CONFIG,
  getPriorityScore,
  estimateEventSize,
  createBackpressureEvent,
} from "./types.js";

/**
 * Client flow control state
 */
interface ClientFlowState {
  /** Client identifier */
  clientId: string;
  /** Current strategy */
  strategy: FlowControlStrategy;
  /** Current throttle rate (events/second) */
  throttleRate: number;
  /** Last event send time */
  lastSendTime: number;
  /** Events in current batch for compression */
  compressionBatch: SSEEvent[];
  /** Compression batch size limit */
  compressionBatchSize: number;
  /** Events pending throttle */
  pendingEvents: SSEEvent[];
  /** Drop statistics */
  dropStats: {
    total: number;
    byPriority: Record<EventPriority, number>;
  };
  /** Current pressure level */
  pressureLevel: PressureLevel;
  /** Strategy history for analysis */
  strategyHistory: Array<{
    strategy: FlowControlStrategy;
    timestamp: number;
    pressureLevel: PressureLevel;
  }>;
}

/**
 * FlowController options
 */
export interface FlowControllerOptions {
  /** Flow control configuration */
  config?: Partial<FlowControlConfig>;
  /** Enable automatic strategy switching */
  autoSwitchStrategy?: boolean;
  /** Maximum batch size for compression */
  maxCompressionBatchSize?: number;
  /** Throttle rate limits */
  throttleRateLimits?: {
    min: number;
    max: number;
  };
}

/**
 * FlowController - Main class
 */
export class FlowController {
  private clientStates: Map<string, ClientFlowState>;
  private config: FlowControlConfig;
  private autoSwitchStrategy: boolean;
  private maxCompressionBatchSize: number;
  private throttleRateLimits: { min: number; max: number };
  private eventHandlers: Set<(event: BackpressureEvent) => void>;

  constructor(options?: FlowControllerOptions) {
    this.clientStates = new Map();
    this.config = { ...DEFAULT_FLOW_CONTROL_CONFIG, ...options?.config };
    this.autoSwitchStrategy = options?.autoSwitchStrategy ?? true;
    this.maxCompressionBatchSize = options?.maxCompressionBatchSize ?? 10;
    this.throttleRateLimits = options?.throttleRateLimits ?? {
      min: 1,
      max: 1000,
    };
    this.eventHandlers = new Set();
  }

  /**
   * Apply backpressure to an event before sending
   * Returns true if event should be sent, false if dropped/throttled
   */
  applyBackpressure(clientId: string, event: SSEEvent): FlowControlDecision {
    const state = this.getOrCreateState(clientId);
    const now = Date.now();

    // Update pressure level from detector (would be passed in real usage)
    // For now, use strategy-based decision

    let decision: FlowControlDecision;

    switch (state.strategy) {
      case "drop":
        decision = this.applyDropStrategy(state, event);
        break;
      case "buffer":
        decision = this.applyBufferStrategy(state, event);
        break;
      case "throttle":
        decision = this.applyThrottleStrategy(state, event, now);
        break;
      case "compress":
        decision = this.applyCompressStrategy(state, event);
        break;
      default:
        decision = this.applyBufferStrategy(state, event);
    }

    // Auto-switch strategy if enabled
    if (this.autoSwitchStrategy) {
      this.maybeSwitchStrategy(state, decision.pressure_level);
    }

    // Emit event if action was taken
    if (decision.action !== "none") {
      this.emitEvent(
        createBackpressureEvent(
          clientId,
          decision.pressure_level,
          decision.action,
          { eventSize: estimateEventSize(event) }
        )
      );
    }

    return decision;
  }

  /**
   * Set flow control strategy for a client
   */
  setStrategy(clientId: string, strategy: FlowControlStrategy): void {
    const state = this.getOrCreateState(clientId);
    const previous = state.strategy;

    state.strategy = strategy;
    state.strategyHistory.push({
      strategy,
      timestamp: Date.now(),
      pressureLevel: state.pressureLevel,
    });

    // Reset pending events when switching strategies
    if (previous !== strategy) {
      state.pendingEvents = [];
      state.compressionBatch = [];
    }

    this.emitEvent(
      createBackpressureEvent(clientId, state.pressureLevel, "none", {
        strategyChanged: true,
        previous,
        current: strategy,
      })
    );
  }

  /**
   * Get current strategy for a client
   */
  getStrategy(clientId: string): FlowControlStrategy | null {
    const state = this.clientStates.get(clientId);
    return state?.strategy ?? null;
  }

  /**
   * Throttle events - return subset that should be sent
   */
  throttle(clientId: string, events: SSEEvent[]): SSEEvent[] {
    const state = this.getOrCreateState(clientId);
    const now = Date.now();
    const result: SSEEvent[] = [];

    for (const event of events) {
      const decision = this.applyThrottleStrategy(state, event, now);
      if (decision.should_send && decision.modified_event) {
        result.push(decision.modified_event);
      }
    }

    return result;
  }

  /**
   * Compress multiple events into one
   */
  compressEvents(clientId: string, events: SSEEvent[]): CompressionResult {
    if (events.length === 0) {
      return {
        original_count: 0,
        compressed_count: 0,
        compression_ratio: 0,
        events: [],
        timestamp: Date.now(),
      };
    }

    if (events.length === 1) {
      return {
        original_count: 1,
        compressed_count: 1,
        compression_ratio: 0,
        events: [...events],
        timestamp: Date.now(),
      };
    }

    // Group events by type
    const grouped = new Map<string, SSEEvent[]>();
    for (const event of events) {
      const eventType = event.event || "message";
      if (!grouped.has(eventType)) {
        grouped.set(eventType, []);
      }
      grouped.get(eventType)!.push(event);
    }

    // Compress each group
    const compressed: SSEEvent[] = [];
    for (const [eventType, groupEvents] of grouped.entries()) {
      // Combine data into array
      const combinedData = groupEvents.map(e => e.data);
      compressed.push({
        event: eventType,
        data: combinedData,
        id: `compressed_${Date.now()}_${Math.random()}`,
        timestamp: Date.now(),
        priority: groupEvents[0].priority,
      });
    }

    return {
      original_count: events.length,
      compressed_count: compressed.length,
      compression_ratio: 1 - compressed.length / events.length,
      events: compressed,
      timestamp: Date.now(),
    };
  }

  /**
   * Drop events based on priority
   */
  dropEvents(
    events: SSEEvent[],
    priorityThreshold?: EventPriority
  ): SSEEvent[] {
    if (!priorityThreshold) {
      return events;
    }

    const thresholdScore = getPriorityScore(priorityThreshold);
    return events.filter(event => {
      const priority = event.priority || "normal";
      return getPriorityScore(priority) >= thresholdScore;
    });
  }

  /**
   * Update pressure level for a client
   */
  updatePressureLevel(clientId: string, level: PressureLevel): void {
    const state = this.getOrCreateState(clientId);
    state.pressureLevel = level;
  }

  /**
   * Apply drop strategy
   */
  private applyDropStrategy(
    state: ClientFlowState,
    event: SSEEvent
  ): FlowControlDecision {
    const priority = event.priority || "normal";

    // Never drop critical events
    if (priority === "critical") {
      return {
        should_send: true,
        action: "none",
        reason: "Critical event never dropped",
        pressure_level: state.pressureLevel,
      };
    }

    // Drop based on drop strategy
    let shouldDrop = false;
    switch (this.config.drop_strategy) {
      case "oldest":
        // Drop would be handled by buffer manager, here we just check priority
        shouldDrop = priority === "low";
        break;
      case "newest":
        shouldDrop = priority === "low";
        break;
      case "lowest-priority":
        shouldDrop = priority === "low" || priority === "normal";
        break;
      case "random":
        // 10% chance to drop non-critical events
        shouldDrop = Math.random() < 0.1;
        break;
    }

    if (shouldDrop) {
      state.dropStats.total++;
      state.dropStats.byPriority[priority]++;
      return {
        should_send: false,
        action: "dropped_events",
        reason: `Dropped by ${this.config.drop_strategy} strategy`,
        pressure_level: state.pressureLevel,
      };
    }

    return {
      should_send: true,
      action: "none",
      reason: "Event passed drop filter",
      pressure_level: state.pressureLevel,
    };
  }

  /**
   * Apply buffer strategy
   */
  private applyBufferStrategy(
    state: ClientFlowState,
    event: SSEEvent
  ): FlowControlDecision {
    // Buffer strategy accepts all events - buffer management is separate
    return {
      should_send: true,
      action: "none",
      reason: "Buffer strategy accepts all events",
      pressure_level: state.pressureLevel,
    };
  }

  /**
   * Apply throttle strategy
   */
  private applyThrottleStrategy(
    state: ClientFlowState,
    event: SSEEvent,
    now: number
  ): FlowControlDecision {
    // Check if enough time has passed since last send
    const timeSinceLastSend = now - state.lastSendTime;
    const minInterval = 1000 / state.throttleRate;

    if (timeSinceLastSend >= minInterval) {
      state.lastSendTime = now;
      return {
        should_send: true,
        action:
          timeSinceLastSend > minInterval * 2 ? "applied_throttle" : "none",
        reason: `Throttled to ${state.throttleRate} events/sec`,
        pressure_level: state.pressureLevel,
      };
    }

    // Event is throttled - add to pending
    state.pendingEvents.push(event);

    return {
      should_send: false,
      action: "applied_throttle",
      reason: `Throttled (rate: ${state.throttleRate} events/sec)`,
      pressure_level: state.pressureLevel,
      modified_event: event,
    };
  }

  /**
   * Apply compress strategy
   */
  private applyCompressStrategy(
    state: ClientFlowState,
    event: SSEEvent
  ): FlowControlDecision {
    // Add to compression batch
    state.compressionBatch.push(event);

    // Check if batch is full
    if (state.compressionBatch.length >= state.compressionBatchSize) {
      const result = this.compressEvents(
        state.clientId,
        state.compressionBatch
      );

      // Clear batch
      state.compressionBatch = [];

      return {
        should_send: true,
        action: "compressed_events",
        reason: `Compressed ${result.original_count} events to ${result.compressed_count}`,
        modified_event: result.events[0],
        pressure_level: state.pressureLevel,
      };
    }

    return {
      should_send: false,
      action: "none",
      reason: `Added to compression batch (${state.compressionBatch.length}/${state.compressionBatchSize})`,
      pressure_level: state.pressureLevel,
    };
  }

  /**
   * Maybe switch strategy based on pressure level
   */
  private maybeSwitchStrategy(
    state: ClientFlowState,
    level: PressureLevel
  ): void {
    if (!this.autoSwitchStrategy) {
      return;
    }

    let newStrategy: FlowControlStrategy | null = null;

    switch (level) {
      case "critical":
        newStrategy = "drop";
        break;
      case "high":
        if (state.strategy !== "drop") {
          newStrategy = "throttle";
        }
        break;
      case "medium":
        if (state.strategy === "buffer") {
          newStrategy = "compress";
        }
        break;
      case "low":
        if (state.strategy === "compress" || state.strategy === "throttle") {
          newStrategy = "buffer";
        }
        break;
      case "none":
        if (state.strategy !== "buffer") {
          newStrategy = "buffer";
        }
        break;
    }

    if (newStrategy && newStrategy !== state.strategy) {
      this.setStrategy(state.clientId, newStrategy);
    }
  }

  /**
   * Get or create client state
   */
  private getOrCreateState(clientId: string): ClientFlowState {
    if (!this.clientStates.has(clientId)) {
      this.clientStates.set(clientId, {
        clientId,
        strategy: this.config.default_strategy,
        throttleRate: 100, // Default 100 events/sec
        lastSendTime: 0,
        compressionBatch: [],
        compressionBatchSize: this.maxCompressionBatchSize,
        pendingEvents: [],
        dropStats: {
          total: 0,
          byPriority: {
            critical: 0,
            high: 0,
            normal: 0,
            low: 0,
          },
        },
        pressureLevel: "none",
        strategyHistory: [
          {
            strategy: this.config.default_strategy,
            timestamp: Date.now(),
            pressureLevel: "none",
          },
        ],
      });
    }
    return this.clientStates.get(clientId)!;
  }

  /**
   * Emit backpressure event
   */
  private emitEvent(event: BackpressureEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error("Error in flow control event handler:", error);
      }
    }
  }

  /**
   * Add event handler
   */
  onBackpressureEvent(handler: (event: BackpressureEvent) => void): void {
    this.eventHandlers.add(handler);
  }

  /**
   * Remove event handler
   */
  offBackpressureEvent(handler: (event: BackpressureEvent) => void): void {
    this.eventHandlers.delete(handler);
  }

  /**
   * Get client state
   */
  getClientState(clientId: string): ClientFlowState | null {
    return this.clientStates.get(clientId) || null;
  }

  /**
   * Get drop statistics for a client
   */
  getDropStats(
    clientId: string
  ): { total: number; byPriority: Record<EventPriority, number> } | null {
    const state = this.clientStates.get(clientId);
    return state?.dropStats || null;
  }

  /**
   * Get pending events for a client
   */
  getPendingEvents(clientId: string): SSEEvent[] {
    const state = this.clientStates.get(clientId);
    return state?.pendingEvents || [];
  }

  /**
   * Clear pending events for a client
   */
  clearPendingEvents(clientId: string): void {
    const state = this.clientStates.get(clientId);
    if (state) {
      state.pendingEvents = [];
    }
  }

  /**
   * Get compression batch for a client
   */
  getCompressionBatch(clientId: string): SSEEvent[] {
    const state = this.clientStates.get(clientId);
    return state?.compressionBatch || [];
  }

  /**
   * Flush compression batch for a client
   */
  flushCompressionBatch(clientId: string): SSEEvent[] {
    const state = this.clientStates.get(clientId);
    if (!state) {
      return [];
    }

    const batch = [...state.compressionBatch];
    state.compressionBatch = [];
    return batch;
  }

  /**
   * Set throttle rate for a client
   */
  setThrottleRate(clientId: string, rate: number): void {
    const state = this.getOrCreateState(clientId);
    state.throttleRate = Math.max(
      this.throttleRateLimits.min,
      Math.min(this.throttleRateLimits.max, rate)
    );
  }

  /**
   * Get throttle rate for a client
   */
  getThrottleRate(clientId: string): number | null {
    const state = this.clientStates.get(clientId);
    return state?.throttleRate || null;
  }

  /**
   * Adjust throttle rate by percentage
   */
  adjustThrottleRate(clientId: string, percent: number): void {
    const current = this.getThrottleRate(clientId) || 100;
    const newRate = current * (1 + percent / 100);
    this.setThrottleRate(clientId, newRate);
  }

  /**
   * Remove client state
   */
  removeClient(clientId: string): void {
    this.clientStates.delete(clientId);
  }

  /**
   * Clear all client states
   */
  clear(): void {
    this.clientStates.clear();
    this.eventHandlers.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<FlowControlConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): FlowControlConfig {
    return { ...this.config };
  }

  /**
   * Get all managed client IDs
   */
  getClientIds(): string[] {
    return Array.from(this.clientStates.keys());
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalClients: number;
    strategies: Record<FlowControlStrategy, number>;
    totalDropped: number;
    droppedByPriority: Record<EventPriority, number>;
  } {
    const states = Array.from(this.clientStates.values());

    const strategies: Record<FlowControlStrategy, number> = {
      drop: 0,
      buffer: 0,
      throttle: 0,
      compress: 0,
    };

    let totalDropped = 0;
    const droppedByPriority: Record<EventPriority, number> = {
      critical: 0,
      high: 0,
      normal: 0,
      low: 0,
    };

    for (const state of states) {
      strategies[state.strategy]++;
      totalDropped += state.dropStats.total;
      for (const priority of [
        "critical",
        "high",
        "normal",
        "low",
      ] as EventPriority[]) {
        droppedByPriority[priority] += state.dropStats.byPriority[priority];
      }
    }

    return {
      totalClients: states.length,
      strategies,
      totalDropped,
      droppedByPriority,
    };
  }
}

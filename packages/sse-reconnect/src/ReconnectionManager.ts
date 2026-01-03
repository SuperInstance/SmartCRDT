/**
 * Reconnection Manager
 *
 * Main orchestrator for automatic reconnection on SSE disconnect.
 * Coordinates state machine, backoff calculator, event buffer, connection monitor,
 * and reconnect policy to provide seamless reconnection experience.
 */

import type {
  ReconnectState,
  ReconnectConfig,
  ReconnectAttempt,
  DisconnectReason,
  SSEEvent,
  ReconnectionStats,
  ReconnectionManagerEvent,
  ReconnectionManagerEventHandler,
} from "./types.js";
import { StateMachine } from "./StateMachine.js";
import { BackoffCalculator } from "./BackoffCalculator.js";
import { EventBuffer } from "./EventBuffer.js";
import { ConnectionMonitor } from "./ConnectionMonitor.js";
import { ReconnectPolicy } from "./ReconnectPolicy.js";
import { ReconnectionError, MaxRetriesExceededError } from "./types.js";

/**
 * Reconnection connection type (abstract EventSource)
 */
export type SSEConnection = Partial<EventSource> & {
  url: string;
  readyState: number;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
  close(): void;
};

/**
 * Reconnection manager options
 */
export interface ReconnectionManagerOptions {
  /** Configuration for reconnection behavior */
  config?: Partial<ReconnectConfig>;
  /** Whether to enable event buffering */
  enableEventBuffer?: boolean;
  /** Custom connect function */
  connect?: () => Promise<SSEConnection>;
}

/**
 * Reconnection Manager - Main orchestrator
 */
export class ReconnectionManager {
  private stateMachine: StateMachine;
  private backoffCalculator: BackoffCalculator;
  private eventBuffer: EventBuffer;
  private connectionMonitor: ConnectionMonitor;
  private reconnectPolicy: ReconnectPolicy;
  private config: ReconnectConfig;

  private connection: SSEConnection | null;
  private url: string;
  private attemptHistory: ReconnectAttempt[];
  private eventHandlers: Set<ReconnectionManagerEventHandler>;
  private reconnectTimer: ReturnType<typeof setTimeout> | null;
  private lastDisconnectReason: DisconnectReason | null;

  constructor(url: string, options: ReconnectionManagerOptions = {}) {
    this.url = url;
    this.config = options.config
      ? { ...this.getDefaultConfig(), ...options.config }
      : this.getDefaultConfig();

    this.stateMachine = new StateMachine("disconnected");
    this.backoffCalculator = new BackoffCalculator(this.config);
    this.eventBuffer = new EventBuffer({
      maxBufferSize: this.config.maxBufferSize,
    });
    this.connectionMonitor = new ConnectionMonitor({
      healthCheckInterval: this.config.healthCheckInterval,
      connectionTimeout: this.config.connectionTimeout,
    });
    this.reconnectPolicy = new ReconnectPolicy({
      maxRetries: this.config.maxRetries,
      initialDelay: this.config.initialDelay,
      maxDelay: this.config.maxDelay,
      backoffStrategy: this.config.backoffStrategy,
      jitterFactor: this.config.jitterFactor,
      reconnectOnServerClose: this.config.reconnectOnServerClose,
      reconnectOnNetworkLoss: this.config.reconnectOnNetworkLoss,
      reconnectOnError: this.config.reconnectOnError,
    });

    this.connection = null;
    this.attemptHistory = [];
    this.eventHandlers = new Set();
    this.reconnectTimer = null;
    this.lastDisconnectReason = null;

    // Setup connection monitor handlers
    this.connectionMonitor.onEvent(event => {
      if (event.type === "disconnect") {
        this.handleDisconnect(
          (event.data?.reason as DisconnectReason) || "error"
        );
      }
    });

    // Setup state machine handlers
    this.stateMachine.onStateChange(transition => {
      this.emitEvent({
        type: "state-change",
        state: transition.to,
        previousState: transition.from,
      });
    });

    // Setup reconnect policy callbacks
    this.reconnectPolicy.setMaxRetriesCallback((totalAttempts, reason) => {
      this.emitEvent({
        type: "max-retries-reached",
        totalAttempts: totalAttempts,
      });

      this.stateMachine.transition(
        "failed",
        `Max retries reached: ${totalAttempts}`
      );
    });

    this.reconnectPolicy.setReconnectSuccessCallback((attempt, totalTime) => {
      this.stateMachine.transition("connected", "Reconnection successful");
    });
  }

  /**
   * Start reconnection monitoring
   */
  async start(connectFn?: () => Promise<SSEConnection>): Promise<void> {
    if (this.stateMachine.isConnected()) {
      return; // Already connected
    }

    this.stateMachine.transition("reconnecting", "Starting connection");

    try {
      const connect = connectFn || this.defaultConnect.bind(this);
      this.connection = await connect();

      this.stateMachine.transition("connected", "Connection established");
      this.connectionMonitor.monitor();
      this.attemptHistory = [];
      this.reconnectPolicy.reset();
    } catch (error) {
      this.stateMachine.transition("disconnected", "Connection failed");
      throw error;
    }
  }

  /**
   * Stop reconnection monitoring
   */
  stop(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }

    this.connectionMonitor.stopMonitoring();
    this.stateMachine.transition("disconnected", "Stopped by user");
  }

  /**
   * Force immediate reconnection
   */
  async forceReconnect(): Promise<void> {
    // Cancel any pending reconnect
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Close existing connection
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }

    this.stateMachine.transition("reconnecting", "Force reconnect requested");

    // Attempt reconnection immediately
    await this.attemptReconnect();
  }

  /**
   * Get current reconnection state
   */
  getReconnectState(): ReconnectState {
    return this.stateMachine.getCurrentState();
  }

  /**
   * Get attempt history
   */
  getAttemptHistory(): ReconnectAttempt[] {
    return [...this.attemptHistory];
  }

  /**
   * Reset attempt history
   */
  resetHistory(): void {
    this.attemptHistory = [];
  }

  /**
   * Set max retries
   */
  setMaxRetries(count: number): void {
    this.config.maxRetries = count;
    this.reconnectPolicy.updateConfig({ maxRetries: count });
  }

  /**
   * Get reconnection statistics
   */
  getStatistics(): ReconnectionStats {
    const monitorStats = this.connectionMonitor.getStatistics();
    const bufferStats = this.eventBuffer.getStats();
    const stateStats = this.stateMachine.getStatistics();

    const successfulAttempts = this.attemptHistory.filter(a => a.success);
    const failedAttempts = this.attemptHistory.filter(a => !a.success);

    const totalReconnectTime = failedAttempts.reduce(
      (sum, a) => sum + (a.duration || 0),
      0
    );

    return {
      state: this.stateMachine.getCurrentState(),
      totalAttempts: this.attemptHistory.length,
      successfulReconnections: successfulAttempts.length,
      failedReconnections: failedAttempts.length,
      bufferSize: bufferStats.currentSize,
      bufferedEventCount: bufferStats.eventCount,
      totalReconnectTime,
      avgReconnectTime:
        successfulAttempts.length > 0
          ? totalReconnectTime / successfulAttempts.length
          : 0,
      lastConnectedAt: monitorStats.connectionStartTime,
      uptime: monitorStats.uptime,
    };
  }

  /**
   * Register event handler
   */
  onEvent(handler: ReconnectionManagerEventHandler): () => void {
    this.eventHandlers.add(handler);

    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  /**
   * Buffer an event during disconnect
   */
  bufferEvent(event: SSEEvent): void {
    if (!this.stateMachine.isConnected()) {
      const buffered = this.eventBuffer.bufferEvent(event);
      this.emitEvent({
        type: "event-buffered",
        event: buffered,
      });

      // Check buffer overflow
      if (this.eventBuffer.isFull()) {
        this.emitEvent({
          type: "buffer-full",
          size: this.eventBuffer.getBufferSize(),
          limit: this.config.maxBufferSize,
        });
      }
    }
  }

  /**
   * Replay buffered events
   */
  replayEvents(): SSEEvent[] {
    const events = this.eventBuffer.replayAndClear();

    if (events.length > 0) {
      this.emitEvent({
        type: "events-replayed",
        count: events.length,
      });
    }

    return events;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ReconnectConfig>): void {
    this.config = { ...this.config, ...config };
    this.backoffCalculator.updateConfig(this.config);
    this.connectionMonitor.updateConfig({
      healthCheckInterval: this.config.healthCheckInterval,
      connectionTimeout: this.config.connectionTimeout,
    });
    this.reconnectPolicy.updateConfig({
      maxRetries: this.config.maxRetries,
      initialDelay: this.config.initialDelay,
      maxDelay: this.config.maxDelay,
      backoffStrategy: this.config.backoffStrategy,
      jitterFactor: this.config.jitterFactor,
    });
    this.eventBuffer.setBufferSizeLimit(this.config.maxBufferSize);
  }

  /**
   * Get current configuration
   */
  getConfig(): ReconnectConfig {
    return { ...this.config };
  }

  /**
   * Reset all state
   */
  reset(): void {
    this.stop();
    this.stateMachine.reset();
    this.eventBuffer.reset();
    this.connectionMonitor.reset();
    this.reconnectPolicy.reset();
    this.attemptHistory = [];
    this.lastDisconnectReason = null;
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(reason: DisconnectReason): void {
    this.lastDisconnectReason = reason;

    // Stop monitoring
    this.connectionMonitor.stopMonitoring();

    // Buffer events if enabled
    if (this.config.enableEventBuffer) {
      // Events will be buffered via bufferEvent() method
    }

    // Check if should reconnect
    const attemptNumber = this.attemptHistory.length + 1;
    const decision = this.reconnectPolicy.getReconnectDecision(
      reason,
      attemptNumber,
      this.connectionMonitor.getTimeSinceLastEvent()
    );

    if (decision.shouldReconnect) {
      this.stateMachine.transition("reconnecting", `Disconnected: ${reason}`);

      // Schedule reconnection
      this.scheduleReconnect(decision.delay);
    } else {
      this.stateMachine.transition("failed", decision.reason);
      this.reconnectPolicy.onMaxRetriesReached(reason);
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(delay: number): void {
    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.attemptReconnect();
      } catch (error) {
        // Error handled in attemptReconnect
      }
    }, delay);
  }

  /**
   * Attempt reconnection
   */
  private async attemptReconnect(): Promise<void> {
    const attemptNumber = this.attemptHistory.length + 1;
    const startTime = Date.now();

    this.reconnectPolicy.recordAttempt();

    const attempt: ReconnectAttempt = {
      attemptNumber,
      timestamp: new Date(),
      delay: this.reconnectPolicy.getRetryDelay(attemptNumber),
      success: false,
    };

    this.emitEvent({
      type: "reconnect-attempt",
      attempt,
    });

    try {
      // Attempt to reconnect
      this.connection = await this.defaultConnect.bind(this)();

      attempt.success = true;
      attempt.duration = Date.now() - startTime;

      this.attemptHistory.push(attempt);
      this.stateMachine.transition("connected", "Reconnection successful");
      this.connectionMonitor.monitor();
      this.reconnectPolicy.recordSuccess(attemptNumber);

      this.emitEvent({
        type: "reconnect-success",
        attempt,
      });

      // Replay buffered events
      this.replayEvents();
    } catch (error) {
      attempt.success = false;
      attempt.duration = Date.now() - startTime;
      attempt.error = error instanceof Error ? error : new Error(String(error));

      this.attemptHistory.push(attempt);

      this.emitEvent({
        type: "reconnect-failed",
        attempt,
        error: attempt.error,
      });

      // Check if should retry
      const reason = this.lastDisconnectReason || "error";
      const decision = this.reconnectPolicy.getReconnectDecision(
        reason,
        attemptNumber + 1,
        this.connectionMonitor.getTimeSinceLastEvent()
      );

      if (decision.shouldReconnect) {
        this.scheduleReconnect(decision.delay);
      } else {
        this.stateMachine.transition("failed", decision.reason);
        this.reconnectPolicy.onMaxRetriesReached(reason);
      }
    }
  }

  /**
   * Default connect function (placeholder - should be overridden)
   */
  private async defaultConnect(): Promise<SSEConnection> {
    // This should be overridden by the user
    throw new ReconnectionError(
      "No connect function provided. Provide a connect function via start() or options.",
      "error",
      this.attemptHistory.length + 1
    );
  }

  /**
   * Emit event to all handlers
   */
  private emitEvent(event: ReconnectionManagerEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error("Error in reconnection manager event handler:", error);
      }
    }
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): ReconnectConfig {
    return {
      maxRetries: 10,
      initialDelay: 1000,
      maxDelay: 30000,
      jitterFactor: 0.1,
      backoffStrategy: "exponential-with-jitter",
      enableEventBuffer: true,
      maxBufferSize: 1024 * 1024,
      healthCheckInterval: 30000,
      connectionTimeout: 10000,
      reconnectOnServerClose: true,
      reconnectOnNetworkLoss: true,
      reconnectOnError: true,
    };
  }
}

/**
 * Create a reconnection manager
 */
export function createReconnectionManager(
  url: string,
  options?: ReconnectionManagerOptions
): ReconnectionManager {
  return new ReconnectionManager(url, options);
}

/**
 * Connection Monitor
 *
 * Monitors SSE connection health and detects disconnections.
 * Tracks uptime, ping times, and connection state changes.
 */

import type {
  ConnectionHealth,
  ConnectionMonitorEvent,
  ConnectionMonitorHandler,
  DisconnectReason,
} from "./types.js";

/**
 * Connection monitor configuration
 */
export interface ConnectionMonitorConfig {
  /** Health check interval in milliseconds */
  healthCheckInterval: number;
  /** Connection timeout in milliseconds */
  connectionTimeout: number;
  /** Maximum consecutive failures before marking unhealthy */
  maxConsecutiveFailures: number;
  /** Enable automatic health checking */
  enableAutoHealthCheck: boolean;
}

/**
 * Default connection monitor configuration
 */
export const DEFAULT_MONITOR_CONFIG: ConnectionMonitorConfig = {
  healthCheckInterval: 30000, // 30 seconds
  connectionTimeout: 10000, // 10 seconds
  maxConsecutiveFailures: 3,
  enableAutoHealthCheck: true,
};

/**
 * Connection monitor for SSE connections
 */
export class ConnectionMonitor {
  private health: ConnectionHealth;
  private config: ConnectionMonitorConfig;
  private handlers: Set<ConnectionMonitorHandler>;
  private healthCheckTimer: ReturnType<typeof setInterval> | null;
  private connectionStartTime: Date | null;
  private lastEventTime: Date | null;
  private isConnectedFlag: boolean;

  constructor(config: Partial<ConnectionMonitorConfig> = {}) {
    this.config = { ...DEFAULT_MONITOR_CONFIG, ...config };
    this.handlers = new Set();
    this.healthCheckTimer = null;
    this.connectionStartTime = null;
    this.lastEventTime = null;
    this.isConnectedFlag = false;

    this.health = {
      healthy: false,
      lastPingTime: null,
      uptime: 0,
      consecutiveFailures: 0,
      lastCheckTime: null,
    };
  }

  /**
   * Start monitoring a connection
   */
  monitor(): void {
    this.connectionStartTime = new Date();
    this.lastEventTime = new Date();
    this.isConnectedFlag = true;
    this.health.healthy = true;
    this.health.consecutiveFailures = 0;

    this.emitEvent({
      type: "connect",
      timestamp: new Date(),
      state: "connected",
    });

    // Start automatic health checking
    if (this.config.enableAutoHealthCheck) {
      this.startHealthCheck();
    }
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    this.isConnectedFlag = false;
    this.health.healthy = false;

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    this.emitEvent({
      type: "disconnect",
      timestamp: new Date(),
      state: "disconnected",
    });
  }

  /**
   * Detect and report a disconnection
   */
  detectDisconnect(reason: DisconnectReason): void {
    this.isConnectedFlag = false;
    this.health.healthy = false;

    this.emitEvent({
      type: "disconnect",
      timestamp: new Date(),
      state: "disconnected",
      data: { reason },
    });
  }

  /**
   * Record that an event was received
   */
  recordEvent(): void {
    this.lastEventTime = new Date();
    this.health.lastPingTime = this.lastEventTime;
    this.health.consecutiveFailures = 0;
  }

  /**
   * Perform a health check
   */
  checkHealth(): boolean {
    const now = new Date();
    this.health.lastCheckTime = now;

    // Check if we've received an event recently
    const timeSinceLastEvent = this.lastEventTime
      ? now.getTime() - this.lastEventTime.getTime()
      : Infinity;

    // Check if connection is within timeout
    const isHealthy = timeSinceLastEvent < this.config.connectionTimeout;

    if (!isHealthy) {
      this.health.consecutiveFailures++;
    } else {
      this.health.consecutiveFailures = 0;
    }

    // Update health status
    const wasHealthy = this.health.healthy;
    this.health.healthy =
      isHealthy &&
      this.health.consecutiveFailures < this.config.maxConsecutiveFailures;

    // Emit health check event
    this.emitEvent({
      type: "health-check",
      timestamp: now,
      state: this.health.healthy ? "connected" : "disconnected",
      data: {
        timeSinceLastEvent,
        consecutiveFailures: this.health.consecutiveFailures,
        healthy: this.health.healthy,
      },
    });

    // Detect transition from healthy to unhealthy
    if (wasHealthy && !this.health.healthy) {
      this.detectDisconnect("timeout");
    }

    return this.health.healthy;
  }

  /**
   * Get current health status
   */
  getHealth(): ConnectionHealth {
    this.health.uptime = this.getUptime();
    return { ...this.health };
  }

  /**
   * Get last successful ping time
   */
  getLastPingTime(): Date | null {
    return this.health.lastPingTime;
  }

  /**
   * Get connection uptime in seconds
   */
  getUptime(): number {
    if (!this.connectionStartTime) {
      return 0;
    }

    const now = new Date();
    return Math.floor(
      (now.getTime() - this.connectionStartTime.getTime()) / 1000
    );
  }

  /**
   * Get time since last event
   */
  getTimeSinceLastEvent(): number {
    if (!this.lastEventTime) {
      return Infinity;
    }

    return Date.now() - this.lastEventTime.getTime();
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.isConnectedFlag;
  }

  /**
   * Check if connection is healthy
   */
  isHealthy(): boolean {
    return this.health.healthy;
  }

  /**
   * Register a monitor event handler
   */
  onEvent(handler: ConnectionMonitorHandler): () => void {
    this.handlers.add(handler);

    return () => {
      this.handlers.delete(handler);
    };
  }

  /**
   * Remove a monitor event handler
   */
  offEvent(handler: ConnectionMonitorHandler): void {
    this.handlers.delete(handler);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ConnectionMonitorConfig>): void {
    const wasAutoCheckEnabled = this.config.enableAutoHealthCheck;
    this.config = { ...this.config, ...config };

    // Restart health check if settings changed
    if (this.config.enableAutoHealthCheck && !wasAutoCheckEnabled) {
      this.startHealthCheck();
    } else if (!this.config.enableAutoHealthCheck && wasAutoCheckEnabled) {
      this.stopHealthCheck();
    } else if (this.config.enableAutoHealthCheck && this.healthCheckTimer) {
      // Restart with new interval
      this.stopHealthCheck();
      this.startHealthCheck();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ConnectionMonitorConfig {
    return { ...this.config };
  }

  /**
   * Reset monitor state
   */
  reset(): void {
    this.stopHealthCheck();
    this.connectionStartTime = null;
    this.lastEventTime = null;
    this.isConnectedFlag = false;

    this.health = {
      healthy: false,
      lastPingTime: null,
      uptime: 0,
      consecutiveFailures: 0,
      lastCheckTime: null,
    };
  }

  /**
   * Get monitor statistics
   */
  getStatistics(): {
    isConnected: boolean;
    isHealthy: boolean;
    uptime: number;
    timeSinceLastEvent: number;
    consecutiveFailures: number;
    connectionStartTime: Date | null;
    lastEventTime: Date | null;
    lastCheckTime: Date | null;
  } {
    return {
      isConnected: this.isConnectedFlag,
      isHealthy: this.health.healthy,
      uptime: this.getUptime(),
      timeSinceLastEvent: this.getTimeSinceLastEvent(),
      consecutiveFailures: this.health.consecutiveFailures,
      connectionStartTime: this.connectionStartTime,
      lastEventTime: this.lastEventTime,
      lastCheckTime: this.health.lastCheckTime,
    };
  }

  /**
   * Start automatic health checking
   */
  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      return;
    }

    this.healthCheckTimer = setInterval(() => {
      this.checkHealth();
    }, this.config.healthCheckInterval);
  }

  /**
   * Stop automatic health checking
   */
  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Emit an event to all handlers
   */
  private emitEvent(event: ConnectionMonitorEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (error) {
        console.error("Error in connection monitor handler:", error);
      }
    }
  }
}

/**
 * Create a connection monitor with configuration
 */
export function createConnectionMonitor(
  config?: Partial<ConnectionMonitorConfig>
): ConnectionMonitor {
  return new ConnectionMonitor(config);
}

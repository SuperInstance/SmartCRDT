/**
 * Client Integration
 *
 * Integrates reconnection logic with SSE client for automatic
 * reconnection on disconnect with event replay.
 */

import type {
  SSEEvent,
  ClientConnectionState,
  ClientIntegrationOptions,
  DisconnectReason,
  ReconnectConfig,
} from "./types.js";
import { ReconnectionManager } from "./ReconnectionManager.js";
import type { SSEConnection } from "./ReconnectionManager.js";
import { EventBuffer } from "./EventBuffer.js";

/**
 * SSE Client interface (abstract)
 */
export interface SSEClient {
  url: string;
  connected: boolean;
  connect(): Promise<void>;
  disconnect(): void;
  onEvent(callback: (event: SSEEvent) => void): void;
  onError(callback: (error: Error) => void): void;
  onOpen(callback: () => void): void;
  onClose(callback: () => void): void;
}

/**
 * Reconnection client options
 */
export interface ReconnectionClientOptions {
  /** Base URL for SSE connection */
  url: string;
  /** Reconnection configuration */
  reconnectConfig?: Partial<ReconnectConfig>;
  /** Client integration options */
  integrationOptions?: Partial<ClientIntegrationOptions>;
  /** Custom SSE client (optional) */
  client?: SSEClient;
}

/**
 * Default client integration options
 */
export const DEFAULT_CLIENT_OPTIONS: ClientIntegrationOptions = {
  autoReconnect: true,
  replayBufferedEvents: true,
  showNotifications: true,
};

/**
 * Reconnection Client
 *
 * Wraps an SSE client with automatic reconnection capabilities
 */
export class ReconnectionClient {
  private manager: ReconnectionManager;
  private client: SSEClient | null;
  private options: ClientIntegrationOptions;
  private eventCallbacks: Set<(event: SSEEvent) => void>;
  private errorCallbacks: Set<(error: Error) => void>;
  private connectionState: ClientConnectionState;
  private notificationHandler:
    | ((message: string, type: "info" | "warning" | "error") => void)
    | null;

  constructor(options: ReconnectionClientOptions) {
    this.options = { ...DEFAULT_CLIENT_OPTIONS, ...options.integrationOptions };
    this.client = options.client || null;
    this.eventCallbacks = new Set();
    this.errorCallbacks = new Set();
    this.notificationHandler = this.options.notificationHandler || null;

    // Initialize connection state
    this.connectionState = {
      connected: false,
      reconnecting: false,
      attemptNumber: 0,
      url: options.url,
    };

    // Create reconnection manager
    this.manager = new ReconnectionManager(options.url, {
      config: options.reconnectConfig,
      connect: async () => {
        return this.performConnect();
      },
    });

    // Setup manager event handlers
    this.setupManagerHandlers();
  }

  /**
   * Connect to SSE endpoint with automatic reconnection
   */
  async connect(): Promise<void> {
    if (!this.options.autoReconnect) {
      // Direct connection without reconnection
      await this.directConnect();
      return;
    }

    // Connection with reconnection support
    try {
      await this.manager.start();
      this.updateConnectionState(true, false);
      this.showNotification("Connected to server", "info");
    } catch (error) {
      this.updateConnectionState(false, false);
      this.handleError(
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Disconnect from SSE endpoint
   */
  disconnect(): void {
    this.manager.stop();

    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }

    this.updateConnectionState(false, false);
    this.showNotification("Disconnected from server", "info");
  }

  /**
   * Register event handler
   */
  onEvent(callback: (event: SSEEvent) => void): () => void {
    this.eventCallbacks.add(callback);

    return () => {
      this.eventCallbacks.delete(callback);
    };
  }

  /**
   * Register error handler
   */
  onError(callback: (error: Error) => void): () => void {
    this.errorCallbacks.add(callback);

    return () => {
      this.errorCallbacks.delete(callback);
    };
  }

  /**
   * Force immediate reconnection
   */
  async forceReconnect(): Promise<void> {
    this.showNotification("Forcing reconnection...", "warning");

    try {
      await this.manager.forceReconnect();
      this.updateConnectionState(true, false);
      this.showNotification("Reconnected successfully", "info");
    } catch (error) {
      this.handleError(
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ClientConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Get reconnection statistics
   */
  getStatistics() {
    return this.manager.getStatistics();
  }

  /**
   * Update reconnection configuration
   */
  updateConfig(config: Partial<ReconnectConfig>): void {
    this.manager.updateConfig(config);
  }

  /**
   * Update client integration options
   */
  updateIntegrationOptions(options: Partial<ClientIntegrationOptions>): void {
    this.options = { ...this.options, ...options };

    if (options.notificationHandler !== undefined) {
      this.notificationHandler = options.notificationHandler;
    }
  }

  /**
   * Set custom notification handler
   */
  setNotificationHandler(
    handler: (message: string, type: "info" | "warning" | "error") => void
  ): void {
    this.notificationHandler = handler;
  }

  /**
   * Restore state after reconnect
   */
  private restoreState(): void {
    // Replay buffered events if enabled
    if (this.options.replayBufferedEvents) {
      // Event replay is handled by ReconnectionManager
    }
  }

  /**
   * Perform direct connection (without reconnection)
   */
  private async directConnect(): Promise<void> {
    if (!this.client) {
      throw new Error("No SSE client available for direct connection");
    }

    try {
      await this.client.connect();
      this.updateConnectionState(true, false);
    } catch (error) {
      this.updateConnectionState(false, false);
      throw error;
    }
  }

  /**
   * Perform connection (used by reconnection manager)
   */
  private async performConnect(): Promise<SSEConnection> {
    if (!this.client) {
      throw new Error("No SSE client available");
    }

    await this.client.connect();

    // Return a mock EventSource-like object
    return {
      url: this.client.url,
      readyState: this.client.connected ? 1 : 0,
      addEventListener: () => {},
      removeEventListener: () => {},
      close: () => this.client!.disconnect(),
    } as SSEConnection;
  }

  /**
   * Setup reconnection manager event handlers
   */
  private setupManagerHandlers(): void {
    this.manager.onEvent(event => {
      switch (event.type) {
        case "state-change":
          this.handleStateChange(event.state, event.previousState);
          break;

        case "reconnect-attempt":
          this.handleReconnectAttempt(event.attempt);
          break;

        case "reconnect-success":
          this.handleReconnectSuccess(event.attempt);
          break;

        case "reconnect-failed":
          this.handleReconnectFailed(event.attempt, event.error);
          break;

        case "max-retries-reached":
          this.handleMaxRetriesReached(event.totalAttempts);
          break;

        case "events-replayed":
          this.showNotification(
            `Replayed ${event.count} buffered events`,
            "info"
          );
          break;
      }
    });
  }

  /**
   * Handle state change
   */
  private handleStateChange(newState: string, previousState: string): void {
    const wasReconnecting = previousState === "reconnecting";
    const isReconnecting = newState === "reconnecting";
    const isConnected = newState === "connected";
    const isFailed = newState === "failed";

    this.connectionState.reconnecting = isReconnecting;
    this.connectionState.connected = isConnected;

    if (isConnected && wasReconnecting) {
      this.showNotification("Reconnected successfully", "info");
      this.restoreState();
    } else if (isReconnecting && !wasReconnecting) {
      this.showNotification("Connection lost, reconnecting...", "warning");
    } else if (isFailed) {
      this.showNotification("Reconnection failed", "error");
    }
  }

  /**
   * Handle reconnection attempt
   */
  private handleReconnectAttempt(attempt: any): void {
    this.connectionState.attemptNumber = attempt.attemptNumber;

    this.showNotification(
      `Reconnection attempt ${attempt.attemptNumber}/${this.manager.getConfig().maxRetries}`,
      "info"
    );
  }

  /**
   * Handle successful reconnection
   */
  private handleReconnectSuccess(attempt: any): void {
    this.connectionState.attemptNumber = 0;
    this.updateConnectionState(true, false);
  }

  /**
   * Handle failed reconnection
   */
  private handleReconnectFailed(attempt: any, error: Error): void {
    this.handleError(error);
  }

  /**
   * Handle max retries reached
   */
  private handleMaxRetriesReached(totalAttempts: number): void {
    this.updateConnectionState(false, false);
    this.showNotification(
      `Failed to reconnect after ${totalAttempts} attempts`,
      "error"
    );
  }

  /**
   * Update connection state
   */
  private updateConnectionState(
    connected: boolean,
    reconnecting: boolean
  ): void {
    this.connectionState.connected = connected;
    this.connectionState.reconnecting = reconnecting;
  }

  /**
   * Handle error
   */
  private handleError(error: Error): void {
    for (const callback of this.errorCallbacks) {
      try {
        callback(error);
      } catch (err) {
        console.error("Error in error callback:", err);
      }
    }
  }

  /**
   * Show notification to user
   */
  private showNotification(
    message: string,
    type: "info" | "warning" | "error"
  ): void {
    if (this.options.showNotifications && this.notificationHandler) {
      try {
        this.notificationHandler(message, type);
      } catch (error) {
        console.error("Error in notification handler:", error);
      }
    }
  }
}

/**
 * Create a reconnection client
 */
export function createReconnectionClient(
  url: string,
  options?: Partial<ReconnectionClientOptions>
): ReconnectionClient {
  return new ReconnectionClient({
    url,
    ...options,
  });
}

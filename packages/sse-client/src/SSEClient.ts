/**
 * SSEClient - Main SSE client for browser environments
 *
 * Complete SSE client with:
 * - Connection management
 * - Automatic reconnection
 * - Message buffering
 * - Event handling
 * - State tracking
 */

import type {
  ClientState,
  ClientConfig,
  SSEMessage,
  SSEError,
  MessageHandler,
  ErrorHandler,
  OpenHandler,
  CloseHandler,
  StateChangeHandler,
  ConnectionStats,
  ListenerOptions,
  Logger,
} from "./types.js";

import { MessageParser } from "./MessageParser.js";
import { EventBus } from "./EventBus.js";
import { BufferManager } from "./BufferManager.js";
import { ReconnectionManager } from "./ReconnectionManager.js";
import {
  EventSourceWrapper,
  PolyfillEventSource,
  hasNativeEventSource,
  createEventSource,
  READY_STATE,
} from "./EventSourceWrapper.js";
import { DEFAULT_CONFIG } from "./types.js";

/**
 * SSE Client - Complete SSE implementation
 */
export class SSEClient {
  private config: Required<Omit<ClientConfig, "url" | "logger">> & {
    logger: Logger;
  };
  private url: string;
  private eventSource: ReturnType<typeof createEventSource> | null = null;
  private state: ClientState = "closed";
  private prevState: ClientState = "closed";
  private messageParser: MessageParser;
  private eventBus: EventBus;
  private bufferManager: BufferManager;
  private reconnectManager: ReconnectionManager;

  // Handlers
  private messageHandlers: MessageHandler[] = [];
  private errorHandlers: ErrorHandler[] = [];
  private openHandlers: OpenHandler[] = [];
  private closeHandlers: CloseHandler[] = [];
  private stateChangeHandlers: StateChangeHandler[] = [];

  // Statistics
  private stats: ConnectionStats;

  // Timing
  private connectStartTime: number | null = null;
  private connectionTimer: ReturnType<typeof setTimeout> | null = null;
  private lastMessageTime: number | null = null;
  private visibilityHandler?: () => void;

  constructor(url: string, config: ClientConfig = {}) {
    this.url = url;
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      logger: config.logger || DEFAULT_CONFIG.logger,
    };

    // Initialize components
    this.messageParser = new MessageParser();
    this.eventBus = new EventBus();
    this.bufferManager = new BufferManager({
      maxSize: this.config.maxBufferSize,
      enabled: this.config.enableBuffer,
    });
    this.reconnectManager = new ReconnectionManager(
      {
        strategy: this.config.reconnectStrategy,
        maxRetries: this.config.maxRetries,
        initialDelay: this.config.initialDelay,
        maxDelay: this.config.maxDelay,
      },
      {
        onAttempt: attempt => {
          this.config.logger.debug?.("[SSE] Reconnection attempt:", attempt);
        },
        onSuccess: attempt => {
          this.config.logger.debug?.("[SSE] Reconnection successful:", attempt);
          this.stats.reconnections++;
        },
        onFailure: attempt => {
          this.config.logger.warn("[SSE] Reconnection failed:", attempt);
        },
        onMaxRetriesReached: () => {
          this.config.logger.error("[SSE] Max retries exceeded");
          this.setState("error");
        },
      }
    );

    // Initialize stats
    this.stats = {
      state: "closed",
      attempts: 0,
      successes: 0,
      errors: 0,
      reconnections: 0,
      retryCount: 0,
      messagesReceived: 0,
      bytesReceived: 0,
      uptime: 0,
      timeSinceLastMessage: null,
    };

    // Setup visibility handler for pauseWhenHidden
    if (this.config.pauseWhenHidden && typeof document !== "undefined") {
      this.visibilityHandler = this.handleVisibilityChange.bind(this);
      document.addEventListener("visibilitychange", this.visibilityHandler);
    }
  }

  /**
   * Connect to SSE endpoint
   */
  async connect(): Promise<void> {
    if (this.state === "open" || this.state === "connecting") {
      return;
    }

    this.setState("connecting");
    this.stats.attempts++;
    this.connectStartTime = Date.now();

    return new Promise((resolve, reject) => {
      // Connection timeout
      this.connectionTimer = setTimeout(() => {
        const error: SSEError = {
          type: "timeout",
          message: `Connection timeout after ${this.config.connectionTimeout}ms`,
          fatal: false,
        };
        this.handleError(error);
        reject(error);
      }, this.config.connectionTimeout);

      try {
        // Create EventSource wrapper
        this.eventSource = createEventSource(
          this.url,
          this.config.withCredentials,
          this.messageParser.getLastEventId()
        );

        // Set up handlers
        this.eventSource.onOpen(event => {
          if (this.connectionTimer) {
            clearTimeout(this.connectionTimer);
            this.connectionTimer = null;
          }

          this.setState("open");
          this.stats.successes++;
          this.stats.uptime = 0;

          // Replay buffer on reconnect
          if (this.bufferManager.size > 0) {
            const buffered = this.bufferManager.getAll();
            this.config.logger.debug?.(
              "[SSE] Replaying buffered messages:",
              buffered.length
            );
            for (const item of buffered) {
              this.eventBus.emitAll(item.message.event, item.message);
            }
            this.bufferManager.clear();
          }

          // Call open handlers
          this.openHandlers.forEach(h => h(event));

          resolve();
        });

        this.eventSource.onMessage(event => {
          this.handleMessage(event);
        });

        this.eventSource.onError(event => {
          if (this.state === "connecting") {
            if (this.connectionTimer) {
              clearTimeout(this.connectionTimer);
              this.connectionTimer = null;
            }
            reject(new Error("Connection failed"));
          }

          // Handle reconnection
          this.handleDisconnect().catch(() => {
            // Error already handled
          });
        });

        // Initiate connection
        this.eventSource.connect();
      } catch (error) {
        if (this.connectionTimer) {
          clearTimeout(this.connectionTimer);
          this.connectionTimer = null;
        }

        const sseError: SSEError = {
          type: "connection",
          message: (error as Error).message,
          fatal: false,
          originalError: error as Error,
        };

        this.handleError(sseError);
        reject(sseError);
      }
    });
  }

  /**
   * Disconnect from SSE endpoint
   */
  async disconnect(): Promise<void> {
    this.reconnectManager.cancel();

    if (this.eventSource) {
      this.eventSource.disconnect();
      this.eventSource = null;
    }

    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }

    this.setState("closed");

    // Remove visibility handler
    if (this.visibilityHandler && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
    }
  }

  /**
   * Force reconnection
   */
  async reconnect(): Promise<void> {
    await this.disconnect();
    this.reconnectManager.reset();
    await this.connect();
  }

  /**
   * Register message handler
   */
  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  /**
   * Register error handler
   */
  onError(handler: ErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  /**
   * Register open handler
   */
  onOpen(handler: OpenHandler): void {
    this.openHandlers.push(handler);
  }

  /**
   * Register close handler
   */
  onClose(handler: CloseHandler): void {
    this.closeHandlers.push(handler);
  }

  /**
   * Register state change handler
   */
  onStateChange(handler: StateChangeHandler): void {
    this.stateChangeHandlers.push(handler);
  }

  /**
   * Register event listener with options
   */
  on(
    event: string,
    handler: MessageHandler,
    options: ListenerOptions = {}
  ): string {
    return this.eventBus.on(event, handler, options);
  }

  /**
   * Register one-time event listener
   */
  once(event: string, handler: MessageHandler): string {
    return this.eventBus.once(event, handler);
  }

  /**
   * Remove event listener
   */
  off(listenerId: string): boolean {
    return this.eventBus.off(listenerId);
  }

  /**
   * Get current state
   */
  getState(): ClientState {
    return this.state;
  }

  /**
   * Get EventSource readyState
   */
  getReadyState(): number {
    return this.eventSource?.readyState ?? READY_STATE.CLOSED;
  }

  /**
   * Get connection statistics
   */
  getStats(): ConnectionStats {
    // Update time since last message
    if (this.lastMessageTime) {
      this.stats.timeSinceLastMessage = Date.now() - this.lastMessageTime;
    }

    // Update uptime
    if (this.state === "open" && this.connectStartTime) {
      this.stats.uptime = Date.now() - this.connectStartTime;
    }

    this.stats.state = this.state;
    this.stats.retryCount = this.reconnectManager.getRetryCount();

    return { ...this.stats };
  }

  /**
   * Handle incoming message
   */
  private handleMessage(event: MessageEvent): void {
    this.lastMessageTime = Date.now();
    this.stats.messagesReceived++;
    this.stats.bytesReceived += event.data?.length ?? 0;

    let message: SSEMessage;

    try {
      // Parse message
      const messages = this.messageParser.parse(event.data, event.origin);
      message = messages[0];

      if (!message) {
        throw new Error("Failed to parse message");
      }
    } catch (error) {
      const sseError: SSEError = {
        type: "parse",
        message: "Failed to parse SSE message",
        fatal: false,
        originalError: error as Error,
      };
      this.handleError(sseError);
      return;
    }

    // Emit to event bus
    this.eventBus.emitAll(message.event, message);

    // Call message handlers
    this.messageHandlers.forEach(h => {
      try {
        h(message);
      } catch (error) {
        this.config.logger.error("[SSE] Error in message handler:", error);
      }
    });
  }

  /**
   * Handle disconnection and reconnection
   */
  private async handleDisconnect(): Promise<void> {
    this.setState("error");

    const error: SSEError = {
      type: "connection",
      message: "Connection lost",
      fatal: false,
    };

    this.handleError(error);

    // Attempt reconnection
    if (this.reconnectManager.shouldReconnect(error)) {
      this.setState("reconnecting");

      try {
        await this.reconnectManager.reconnect(() => this.connect());
      } catch {
        // Reconnection failed - will retry or hit max retries
      }
    }
  }

  /**
   * Handle error
   */
  private handleError(error: SSEError): void {
    this.stats.errors++;

    // Buffer message if enabled
    if (this.config.enableBuffer && this.state === "error") {
      // Error buffering not implemented for errors
    }

    this.errorHandlers.forEach(h => {
      try {
        h(error);
      } catch (err) {
        this.config.logger.error("[SSE] Error in error handler:", err);
      }
    });
  }

  /**
   * Set state and notify handlers
   */
  private setState(newState: ClientState): void {
    this.prevState = this.state;
    this.state = newState;

    this.stateChangeHandlers.forEach(h => {
      try {
        h(newState, this.prevState);
      } catch (error) {
        this.config.logger.error("[SSE] Error in state change handler:", error);
      }
    });
  }

  /**
   * Handle visibility change (pause when hidden)
   */
  private handleVisibilityChange(): void {
    if (!this.config.pauseWhenHidden) {
      return;
    }

    const isHidden = document.hidden;

    if (isHidden && this.state === "open") {
      // Page hidden - pause connection
      this.disconnect().catch(() => {
        // Ignore error
      });
    } else if (!isHidden && this.state === "closed") {
      // Page visible - resume connection
      this.connect().catch(() => {
        // Ignore error
      });
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ClientConfig>): void {
    this.config = { ...this.config, ...config };

    // Update buffer manager
    if (config.maxBufferSize !== undefined) {
      this.bufferManager.setMaxSize(config.maxBufferSize);
    }

    // Update reconnection manager
    this.reconnectManager.updateConfig({
      strategy: config.reconnectStrategy,
      maxRetries: config.maxRetries,
      initialDelay: config.initialDelay,
      maxDelay: config.maxDelay,
    });
  }

  /**
   * Get buffer statistics
   */
  getBufferStats() {
    return this.bufferManager.getStats();
  }

  /**
   * Get reconnection statistics
   */
  getReconnectStats() {
    return this.reconnectManager.getStats();
  }

  /**
   * Get event bus statistics
   */
  getEventBusStats() {
    return this.eventBus.getStats();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === "open";
  }

  /**
   * Check if reconnecting
   */
  isReconnecting(): boolean {
    return this.state === "reconnecting";
  }

  /**
   * Get URL
   */
  getURL(): string {
    return this.url;
  }
}

/**
 * Create SSE client
 */
export function createSSEClient(url: string, config?: ClientConfig): SSEClient {
  return new SSEClient(url, config);
}

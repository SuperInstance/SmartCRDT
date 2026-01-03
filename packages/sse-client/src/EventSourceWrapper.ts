/**
 * EventSourceWrapper - Wrapper around native EventSource
 *
 * Wraps native EventSource API with:
 * - Polyfill for browsers without SSE support
 * - Last-Event-ID handling
 * - Custom headers support (via fetch)
 * - Unified interface
 */

import type { EventSourcePolyfillConfig } from "./types.js";

/**
 * EventSource wrapper interface
 */
export interface IEventSourceWrapper {
  /** Connection URL */
  readonly url: string;
  /** Current ready state */
  readonly readyState: number;
  /** Whether connection is open */
  readonly connected: boolean;
  /** Connect to SSE endpoint */
  connect(): void;
  /** Disconnect from SSE endpoint */
  disconnect(): void;
  /** Register message handler */
  onMessage(handler: (event: MessageEvent) => void): void;
  /** Register error handler */
  onError(handler: (event: Event) => void): void;
  /** Register open handler */
  onOpen(handler: (event: Event) => void): void;
}

/**
 * ReadyState constants (matches EventSource)
 */
export const READY_STATE = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSED: 2,
} as const;

/**
 * EventSourceWrapper - Native EventSource wrapper
 */
export class EventSourceWrapper implements IEventSourceWrapper {
  private eventSource: EventSource | null = null;
  private handlers: {
    message: ((event: MessageEvent) => void)[];
    error: ((event: Event) => void)[];
    open: ((event: Event) => void)[];
  };

  readonly url: string;
  private withCredentials: boolean;
  private lastEventId: string | null = null;

  constructor(
    url: string,
    withCredentials = false,
    lastEventId: string | null = null
  ) {
    this.url = url;
    this.withCredentials = withCredentials;
    this.lastEventId = lastEventId;
    this.handlers = {
      message: [],
      error: [],
      open: [],
    };
  }

  get readyState(): number {
    return this.eventSource?.readyState ?? READY_STATE.CLOSED;
  }

  get connected(): boolean {
    return this.readyState === READY_STATE.OPEN;
  }

  connect(): void {
    if (this.eventSource) {
      this.disconnect();
    }

    // Add Last-Event-ID if available
    let url = this.url;
    if (this.lastEventId) {
      const separator = url.includes("?") ? "&" : "?";
      url = `${url}${separator}lastEventId=${encodeURIComponent(this.lastEventId)}`;
    }

    this.eventSource = new EventSource(url, {
      withCredentials: this.withCredentials,
    });

    // Set up event handlers
    this.eventSource.onmessage = (event: MessageEvent) => {
      // Store last event ID
      if (event.lastEventId) {
        this.lastEventId = event.lastEventId;
      }
      this.handlers.message.forEach(h => h(event));
    };

    this.eventSource.onerror = (event: Event) => {
      this.handlers.error.forEach(h => h(event));
    };

    this.eventSource.onopen = (event: Event) => {
      this.handlers.open.forEach(h => h(event));
    };
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  onMessage(handler: (event: MessageEvent) => void): void {
    this.handlers.message.push(handler);
  }

  onError(handler: (event: Event) => void): void {
    this.handlers.error.push(handler);
  }

  onOpen(handler: (event: Event) => void): void {
    this.handlers.open.push(handler);
  }

  /**
   * Get the last event ID
   */
  getLastEventId(): string | null {
    return this.lastEventId;
  }

  /**
   * Set the last event ID for reconnection
   * @param id Last event ID
   */
  setLastEventId(id: string): void {
    this.lastEventId = id;
  }
}

/**
 * Polyfill EventSource using fetch for browsers without native support
 */
export class PolyfillEventSource implements IEventSourceWrapper {
  private abortController: AbortController | null = null;
  private handlers: {
    message: ((event: MessageEvent) => void)[];
    error: ((event: Event) => void)[];
    open: ((event: Event) => void)[];
  };
  private lastEventId: string | null = null;
  private _readyState = READY_STATE.CLOSED;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  readonly url: string;
  private withCredentials: boolean;
  private headers: Record<string, string>;
  private pollInterval: number;
  private fetchImpl: typeof globalThis.fetch;

  constructor(url: string, config: EventSourcePolyfillConfig = {}) {
    this.url = url;
    this.withCredentials = config.withCredentials ?? false;
    this.headers = config.headers ?? {};
    this.pollInterval = config.initialReconnectTime ?? 1000;
    this.fetchImpl = config.fetch ?? fetch.bind(globalThis);

    this.handlers = {
      message: [],
      error: [],
      open: [],
    };
  }

  get readyState(): number {
    return this._readyState;
  }

  get connected(): boolean {
    return this._readyState === READY_STATE.OPEN;
  }

  async connect(): Promise<void> {
    if (this.abortController) {
      this.disconnect();
    }

    this._readyState = READY_STATE.CONNECTING;
    this.abortController = new AbortController();

    try {
      await this.poll();
      this._readyState = READY_STATE.OPEN;
      this.handlers.open.forEach(h => h(new Event("open")));
    } catch (error) {
      this._readyState = READY_STATE.CLOSED;
      this.handlers.error.forEach(h => h(new Event("error")));
    }
  }

  disconnect(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    this._readyState = READY_STATE.CLOSED;
  }

  onMessage(handler: (event: MessageEvent) => void): void {
    this.handlers.message.push(handler);
  }

  onError(handler: (event: Event) => void): void {
    this.handlers.error.push(handler);
  }

  onOpen(handler: (event: Event) => void): void {
    this.handlers.open.push(handler);
  }

  getLastEventId(): string | null {
    return this.lastEventId;
  }

  setLastEventId(id: string): void {
    this.lastEventId = id;
  }

  /**
   * Poll for SSE messages using fetch
   */
  private async poll(): Promise<void> {
    if (!this.abortController) {
      return;
    }

    try {
      let url = this.url;
      if (this.lastEventId) {
        const separator = url.includes("?") ? "&" : "?";
        url = `${url}${separator}lastEventId=${encodeURIComponent(this.lastEventId)}`;
      }

      const response = await this.fetchImpl(url, {
        signal: this.abortController.signal,
        credentials: this.withCredentials ? "include" : "same-origin",
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response body is not readable");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        if (!this.abortController) {
          break;
        }

        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const messages = this.parseBuffer(buffer);

        for (const message of messages) {
          if (message.id) {
            this.lastEventId = message.id;
          }

          const event = new MessageEvent("message", {
            data: message.data,
            lastEventId: message.id ?? "",
            origin: new URL(this.url).origin,
          });

          this.handlers.message.forEach(h => h(event));
        }

        // Update buffer to remaining unparsed data
        if (messages.length > 0) {
          const lastNewlineIndex = buffer.lastIndexOf("\n\n");
          if (lastNewlineIndex !== -1) {
            buffer = buffer.slice(lastNewlineIndex + 2);
          }
        }
      }

      // Connection closed - schedule reconnect
      this.scheduleReconnect();
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        // Intentional abort - don't reconnect
        return;
      }

      // Error occurred - notify and reconnect
      this.handlers.error.forEach(h => h(new Event("error")));
      this.scheduleReconnect();
    }
  }

  /**
   * Parse SSE buffer into messages
   */
  private parseBuffer(buffer: string): Array<{ data: string; id?: string }> {
    const messages: Array<{ data: string; id?: string }> = [];
    const blocks = buffer.split("\n\n");

    for (const block of blocks) {
      if (!block.trim()) {
        continue;
      }

      const lines = block.split("\n");
      let data = "";
      let id: string | undefined;

      for (const line of lines) {
        if (line.startsWith("data:")) {
          data += line.slice(5).trimStart() + "\n";
        } else if (line.startsWith("id:")) {
          id = line.slice(3).trim();
        }
      }

      if (data) {
        messages.push({ data: data.trim(), id });
      }
    }

    return messages;
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect(): void {
    this.pollTimer = setTimeout(() => {
      if (this.abortController) {
        this.poll().catch(() => {
          // Error handled in poll()
        });
      }
    }, this.pollInterval);
  }
}

/**
 * Detect if EventSource is natively available
 */
export function hasNativeEventSource(): boolean {
  return typeof EventSource !== "undefined";
}

/**
 * Create appropriate EventSource wrapper
 */
export function createEventSource(
  url: string,
  withCredentials = false,
  lastEventId: string | null = null,
  polyfillConfig?: EventSourcePolyfillConfig
): IEventSourceWrapper {
  if (hasNativeEventSource()) {
    return new EventSourceWrapper(url, withCredentials, lastEventId);
  } else {
    return new PolyfillEventSource(url, {
      ...polyfillConfig,
      withCredentials,
    });
  }
}

// Re-export backoff functions for convenience
export {
  calculateLinearBackoff,
  calculateExponentialBackoff,
  calculateJitterBackoff,
} from "./ReconnectionManager.js";

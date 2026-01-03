/**
 * Browser Integration - React hooks and vanilla JS helpers
 *
 * Provides:
 * - React hooks (useSSE, useSSEConnection)
 * - Vanilla JS helper
 * - Service Worker support
 * - Visibility API integration
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { SSEClient } from "./SSEClient.js";
import type {
  SSEMessage,
  ClientConfig,
  SSEHookResult,
  SSEHookOptions,
  ClientState,
} from "./types.js";

/**
 * React hook for SSE connection
 */
export function useSSE(
  url: string,
  options: SSEHookOptions = {}
): SSEHookResult {
  const {
    autoConnect = true,
    cleanupOnUnmount = true,
    ...clientConfig
  } = options;

  const [state, setState] = useState<ClientState>("closed");
  const [lastMessage, setLastMessage] = useState<SSEMessage | null>(null);
  const [stats, setStats] = useState({
    state: "closed" as ClientState,
    attempts: 0,
    successes: 0,
    errors: 0,
    reconnections: 0,
    retryCount: 0,
    messagesReceived: 0,
    bytesReceived: 0,
    uptime: 0,
    timeSinceLastMessage: null,
  });

  const clientRef = useRef<SSEClient | null>(null);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Create client on first render
  useEffect(() => {
    if (!clientRef.current) {
      // Lazy import to avoid React dependency in main package
      import("./SSEClient.js").then(({ SSEClient }) => {
        const client = new SSEClient(url, clientConfig);
        clientRef.current = client;

        // Set up state change handler
        client.onStateChange(newState => {
          setState(newState);
        });

        // Set up message handler
        client.onMessage(message => {
          setLastMessage(message);
        });

        // Auto-connect if enabled
        if (autoConnect) {
          client.connect().catch(error => {
            console.error("[useSSE] Failed to connect:", error);
          });
        }

        // Set up stats interval
        statsIntervalRef.current = setInterval(() => {
          setStats(client.getStats());
        }, 1000);
      });
    }

    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
    };
  }, [url, autoConnect, clientConfig]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupOnUnmount && clientRef.current) {
        clientRef.current.disconnect().catch(() => {
          // Ignore error
        });
      }
    };
  }, [cleanupOnUnmount]);

  // Connect function
  const connect = useCallback(async () => {
    const client = clientRef.current;
    if (!client) {
      throw new Error("SSE client not initialized");
    }
    await client.connect();
  }, []);

  // Disconnect function
  const disconnect = useCallback(async () => {
    const client = clientRef.current;
    if (!client) {
      throw new Error("SSE client not initialized");
    }
    await client.disconnect();
  }, []);

  // Reconnect function
  const reconnect = useCallback(async () => {
    const client = clientRef.current;
    if (!client) {
      throw new Error("SSE client not initialized");
    }
    await client.reconnect();
  }, []);

  return {
    state,
    lastMessage,
    stats,
    isConnected: state === "open",
    isReconnecting: state === "reconnecting",
    connect,
    disconnect,
    reconnect,
  };
}

/**
 * React hook for SSE connection with event handlers
 */
export function useSSEEvents(
  url: string,
  eventHandlers: Record<string, (message: SSEMessage) => void>,
  options: SSEHookOptions = {}
) {
  const clientRef = useRef<SSEClient | null>(null);

  useEffect(() => {
    import("./SSEClient.js").then(({ SSEClient }) => {
      const client = new SSEClient(url, options);
      clientRef.current = client;

      // Register event handlers
      for (const [event, handler] of Object.entries(eventHandlers)) {
        client.on(event, handler);
      }

      // Connect
      if (options.autoConnect !== false) {
        client.connect().catch(error => {
          console.error("[useSSEEvents] Failed to connect:", error);
        });
      }
    });

    return () => {
      if (clientRef.current && options.cleanupOnUnmount !== false) {
        clientRef.current.disconnect().catch(() => {
          // Ignore error
        });
      }
    };
  }, [url, options]);

  return {
    client: clientRef.current,
  };
}

/**
 * React hook for SSE message filtering
 */
export function useSSEFiltered(
  url: string,
  filter: (message: SSEMessage) => boolean,
  options: SSEHookOptions = {}
) {
  const [messages, setMessages] = useState<SSEMessage[]>([]);

  useEffect(() => {
    import("./SSEClient.js").then(({ SSEClient }) => {
      const client = new SSEClient(url, options);
      clientRef.current = client;

      client.on("message", message => {
        if (filter(message)) {
          setMessages(prev => [...prev, message]);
        }
      });

      if (options.autoConnect !== false) {
        client.connect().catch(error => {
          console.error("[useSSEFiltered] Failed to connect:", error);
        });
      }
    });

    return () => {
      if (clientRef.current && options.cleanupOnUnmount !== false) {
        clientRef.current.disconnect().catch(() => {
          // Ignore error
        });
      }
    };
  }, [url, filter, options]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    clearMessages,
  };
}

/**
 * Vanilla JS helper for SSE
 */
export class VanillaSSEHelper {
  private client: SSEClient | null = null;

  async connect(url: string, config: ClientConfig = {}): Promise<void> {
    const { SSEClient } = await import("./SSEClient.js");
    this.client = new SSEClient(url, config);
    await this.client.connect();
  }

  disconnect(): Promise<void> {
    return this.client?.disconnect() ?? Promise.resolve();
  }

  onMessage(handler: (message: SSEMessage) => void): void {
    this.client?.onMessage(handler);
  }

  onError(handler: (error: Error) => void): void {
    this.client?.onError(handler);
  }

  getState(): ClientState {
    return this.client?.getState() ?? "closed";
  }

  isConnected(): boolean {
    return this.client?.isConnected() ?? false;
  }
}

/**
 * Service Worker integration for background SSE
 */
export class ServiceWorkerSSE {
  private registration: ServiceWorkerRegistration | null = null;

  async register(swPath: string): Promise<void> {
    if ("serviceWorker" in navigator) {
      this.registration = await navigator.serviceWorker.register(swPath);
    } else {
      throw new Error("Service Workers not supported");
    }
  }

  async startSSE(url: string, config: ClientConfig = {}): Promise<void> {
    if (!this.registration) {
      throw new Error("Service Worker not registered");
    }

    // Send message to service worker to start SSE
    this.registration.active?.postMessage({
      type: "START_SSE",
      url,
      config,
    });
  }

  async stopSSE(): Promise<void> {
    if (!this.registration) {
      return;
    }

    this.registration.active?.postMessage({
      type: "STOP_SSE",
    });
  }

  onMessage(handler: (message: SSEMessage) => void): void {
    navigator.serviceWorker.addEventListener("message", event => {
      if (event.data.type === "sse-message") {
        handler(event.data.data as SSEMessage);
      }
    });
  }
}

/**
 * Visibility API helper
 */
export class VisibilityHelper {
  private handlers: {
    onVisible: (() => void)[];
    onHidden: (() => void)[];
  };

  constructor() {
    this.handlers = {
      onVisible: [],
      onHidden: [],
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () =>
        this.handleVisibilityChange()
      );
    }
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      this.handlers.onHidden.forEach(h => h());
    } else {
      this.handlers.onVisible.forEach(h => h());
    }
  }

  onVisible(handler: () => void): void {
    this.handlers.onVisible.push(handler);
  }

  onHidden(handler: () => void): void {
    this.handlers.onHidden.push(handler);
  }

  isVisible(): boolean {
    return typeof document === "undefined" ? true : !document.hidden;
  }
}

/**
 * Create SSE helper for vanilla JS
 */
export function createSSEHelper(): VanillaSSEHelper {
  return new VanillaSSEHelper();
}

/**
 * Create Service Worker SSE helper
 */
export function createServiceWorkerSSE(swPath: string): ServiceWorkerSSE {
  const swSSE = new ServiceWorkerSSE();
  swSSE.register(swPath).catch(error => {
    console.error("[ServiceWorkerSSE] Registration failed:", error);
  });
  return swSSE;
}

/**
 * Create visibility helper
 */
export function createVisibilityHelper(): VisibilityHelper {
  return new VisibilityHelper();
}

/**
 * TypeScript conditional export to avoid React dependency in main package
 */
export type { SSEMessage, ClientConfig, ClientState } from "./types.js";

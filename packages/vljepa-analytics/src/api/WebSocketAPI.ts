/**
 * WebSocketAPI - WebSocket API for real-time analytics updates
 */

import { WebSocketServer, WebSocket } from "ws";
import type {
  WebSocketConfig,
  WebSocketMessage,
  RealtimeMetrics,
} from "../types.js";
import { RealTimeDashboard } from "../dashboards/RealTimeDashboard.js";

export class WebSocketAPI {
  private config: WebSocketConfig;
  private server: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private realTimeDashboard: RealTimeDashboard;
  private pingTimer: NodeJS.Timeout | null = null;

  constructor(config: WebSocketConfig, realTimeDashboard: RealTimeDashboard) {
    this.config = config;
    this.realTimeDashboard = realTimeDashboard;
  }

  /**
   * Attach to an HTTP server
   */
  attach(server: unknown): void {
    this.server = new WebSocketServer({ server, path: this.config.path });

    this.server.on("connection", (ws: WebSocket) => {
      this.handleConnection(ws);
    });

    this.startPingTimer();
  }

  /**
   * Handle new connection
   */
  private handleConnection(ws: WebSocket): void {
    this.clients.add(ws);

    ws.on("message", (data: Buffer) => {
      this.handleMessage(ws, data);
    });

    ws.on("close", () => {
      this.clients.delete(ws);
    });

    ws.on("error", error => {
      console.error("WebSocket error:", error);
      this.clients.delete(ws);
    });

    // Send initial data
    this.send(ws, {
      type: "event",
      data: { type: "connected" },
      timestamp: Date.now(),
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(ws: WebSocket, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString()) as WebSocketMessage;

      switch (message.type) {
        case "subscribe":
          // Handle subscription
          break;
        case "unsubscribe":
          // Handle unsubscription
          break;
        case "ping":
          this.send(ws, {
            type: "event",
            data: { type: "pong" },
            timestamp: Date.now(),
          });
          break;
      }
    } catch (error) {
      console.error("Error handling WebSocket message:", error);
    }
  }

  /**
   * Send message to a specific client
   */
  send(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast message to all clients
   */
  broadcast(message: WebSocketMessage): void {
    const data = JSON.stringify(message);

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  /**
   * Broadcast real-time metrics
   */
  broadcastMetrics(metrics: RealtimeMetrics): void {
    this.broadcast({
      type: "dashboard_update",
      data: metrics,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast alert
   */
  broadcastAlert(alert: unknown): void {
    this.broadcast({
      type: "alert",
      data: alert,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast insight
   */
  broadcastInsight(insight: unknown): void {
    this.broadcast({
      type: "insight",
      data: insight,
      timestamp: Date.now(),
    });
  }

  /**
   * Start ping timer
   */
  private startPingTimer(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
    }

    this.pingTimer = setInterval(() => {
      const now = Date.now();

      for (const client of this.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.ping();
        }
      }

      // Remove stale connections
      for (const client of this.clients) {
        if (client.readyState !== WebSocket.OPEN) {
          this.clients.delete(client);
        }
      }
    }, this.config.pingInterval);
  }

  /**
   * Stop ping timer
   */
  private stopPingTimer(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * Get connected clients count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Close all connections
   */
  close(): void {
    this.stopPingTimer();

    for (const client of this.clients) {
      client.close();
    }

    this.clients.clear();

    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}

/**
 * Server Integration
 *
 * Server-side support for SSE reconnection with session persistence,
 * missed event delivery, and session transfer capabilities.
 */

import type {
  ServerSession,
  MissedEvent,
  ServerSessionOptions,
  ReconnectAck,
  MissedEventDelivery,
  SSEEvent,
} from "./types.js";

/**
 * Default server session options
 */
export const DEFAULT_SERVER_OPTIONS: ServerSessionOptions = {
  sessionTimeout: 5 * 60 * 1000, // 5 minutes
  persistMissedEvents: true,
  maxMissedEvents: 100,
  enableSessionTransfer: true,
};

/**
 * Session manager for SSE reconnection
 */
export class SessionManager {
  private sessions: Map<string, ServerSession>;
  private missedEvents: Map<string, MissedEvent[]>;
  private options: ServerSessionOptions;
  private sessionTimers: Map<string, ReturnType<typeof setTimeout>>;

  constructor(options: Partial<ServerSessionOptions> = {}) {
    this.sessions = new Map();
    this.missedEvents = new Map();
    this.options = { ...DEFAULT_SERVER_OPTIONS, ...options };
    this.sessionTimers = new Map();
  }

  /**
   * Create a new session for a client
   */
  createSession(clientId: string, url: string): ServerSession {
    const sessionId = this.generateSessionId();

    const session: ServerSession = {
      sessionId,
      clientId,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      url,
      state: "active",
    };

    this.sessions.set(sessionId, session);

    // Initialize missed events array
    if (this.options.persistMissedEvents) {
      this.missedEvents.set(sessionId, []);
    }

    // Setup session timeout
    this.setupSessionTimeout(sessionId);

    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): ServerSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get session by client ID
   */
  getSessionByClientId(clientId: string): ServerSession | null {
    for (const session of this.sessions.values()) {
      if (session.clientId === clientId && session.state === "active") {
        return session;
      }
    }
    return null;
  }

  /**
   * Handle reconnection acknowledgment from client
   */
  handleReconnectAck(ack: ReconnectAck): MissedEventDelivery | null {
    const session = this.sessions.get(ack.sessionId);

    if (!session) {
      return null;
    }

    // Update session state
    session.lastActivityAt = new Date(ack.timestamp);
    session.state = "active";

    // Reset session timeout
    this.resetSessionTimeout(ack.sessionId);

    // Get missed events
    if (!this.options.persistMissedEvents) {
      return {
        sessionId: ack.sessionId,
        eventCount: 0,
        events: [],
        timestamp: Date.now(),
      };
    }

    const missed = this.missedEvents.get(ack.sessionId) || [];

    // Filter events newer than last received event
    let eventsToDeliver = missed;
    if (ack.lastEventId) {
      const lastIndex = missed.findIndex(e => e.id === ack.lastEventId);
      if (lastIndex >= 0) {
        eventsToDeliver = missed.slice(lastIndex + 1);
      }
    }

    // Limit number of events delivered
    const events = eventsToDeliver.slice(-this.options.maxMissedEvents);

    return {
      sessionId: ack.sessionId,
      eventCount: events.length,
      events,
      timestamp: Date.now(),
    };
  }

  /**
   * Record a missed event for a session
   */
  recordMissedEvent(sessionId: string, event: SSEEvent): void {
    if (!this.options.persistMissedEvents) {
      return;
    }

    const session = this.sessions.get(sessionId);
    if (!session || session.state !== "active") {
      return;
    }

    const missedEvents = this.missedEvents.get(sessionId) || [];

    const missedEvent: MissedEvent = {
      id: event.id || this.generateEventId(),
      data: event.data,
      timestamp: event.timestamp || Date.now(),
      reason: "disconnect",
    };

    missedEvents.push(missedEvent);

    // Enforce max missed events limit
    if (missedEvents.length > this.options.maxMissedEvents) {
      missedEvents.shift(); // Remove oldest
    }

    this.missedEvents.set(sessionId, missedEvents);
  }

  /**
   * Clear missed events for a session (after successful delivery)
   */
  clearMissedEvents(sessionId: string): void {
    this.missedEvents.set(sessionId, []);
  }

  /**
   * Update session activity
   */
  updateSessionActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivityAt = new Date();
      this.resetSessionTimeout(sessionId);
    }
  }

  /**
   * Mark session as disconnected
   */
  markSessionDisconnected(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.state = "disconnected";
    }
  }

  /**
   * Expire a session
   */
  expireSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.state = "expired";
    }

    // Clean up
    this.sessions.delete(sessionId);
    this.missedEvents.delete(sessionId);

    if (this.sessionTimers.has(sessionId)) {
      clearTimeout(this.sessionTimers.get(sessionId)!);
      this.sessionTimers.delete(sessionId);
    }
  }

  /**
   * Transfer session to another server
   */
  transferSession(sessionId: string, targetServer: string): boolean {
    if (!this.options.enableSessionTransfer) {
      return false;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // In a real implementation, this would:
    // 1. Serialize session data
    // 2. Send to target server via RPC/message queue
    // 3. Remove from local storage

    // For now, just mark as transferred
    session.state = "expired";

    return true;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): ServerSession[] {
    return Array.from(this.sessions.values()).filter(s => s.state === "active");
  }

  /**
   * Get session count by state
   */
  getSessionCount(): {
    active: number;
    disconnected: number;
    expired: number;
    total: number;
  } {
    let active = 0;
    let disconnected = 0;
    let expired = 0;

    for (const session of this.sessions.values()) {
      switch (session.state) {
        case "active":
          active++;
          break;
        case "disconnected":
          disconnected++;
          break;
        case "expired":
          expired++;
          break;
      }
    }

    return {
      active,
      disconnected,
      expired,
      total: this.sessions.size,
    };
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [sessionId, session] of this.sessions.entries()) {
      const inactiveTime = now - session.lastActivityAt.getTime();

      if (inactiveTime > this.options.sessionTimeout) {
        this.expireSession(sessionId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get missed events for a session
   */
  getMissedEvents(sessionId: string): MissedEvent[] {
    return this.missedEvents.get(sessionId) || [];
  }

  /**
   * Update session options
   */
  updateOptions(options: Partial<ServerSessionOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Clear all sessions
   */
  clearAllSessions(): void {
    for (const timer of this.sessionTimers.values()) {
      clearTimeout(timer);
    }

    this.sessions.clear();
    this.missedEvents.clear();
    this.sessionTimers.clear();
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Setup session timeout
   */
  private setupSessionTimeout(sessionId: string): void {
    if (this.sessionTimers.has(sessionId)) {
      clearTimeout(this.sessionTimers.get(sessionId)!);
    }

    const timer = setTimeout(() => {
      this.expireSession(sessionId);
    }, this.options.sessionTimeout);

    this.sessionTimers.set(sessionId, timer);
  }

  /**
   * Reset session timeout
   */
  private resetSessionTimeout(sessionId: string): void {
    this.setupSessionTimeout(sessionId);
  }
}

/**
 * SSE response helper for reconnection support
 */
export class SSEResponseHelper {
  private sessionManager: SessionManager;
  private sessionId: string | null;

  constructor(sessionManager: SessionManager) {
    this.sessionManager = sessionManager;
    this.sessionId = null;
  }

  /**
   * Initialize SSE connection with session
   */
  initializeConnection(clientId: string, url: string): string {
    const session = this.sessionManager.createSession(clientId, url);
    this.sessionId = session.sessionId;
    return session.sessionId;
  }

  /**
   * Send SSE event to client
   */
  sendEvent(event: SSEEvent): string | null {
    if (!this.sessionId) {
      return null;
    }

    // Add event ID if not present
    if (!event.id) {
      event.id = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Record event as potentially missable
    this.sessionManager.recordMissedEvent(this.sessionId, event);

    // Update session activity
    this.sessionManager.updateSessionActivity(this.sessionId);

    return event.id;
  }

  /**
   * Handle client reconnection
   */
  handleReconnect(ack: ReconnectAck): MissedEventDelivery | null {
    return this.sessionManager.handleReconnectAck(ack);
  }

  /**
   * Handle client disconnect
   */
  handleDisconnect(): void {
    if (this.sessionId) {
      this.sessionManager.markSessionDisconnected(this.sessionId);
    }
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }
}

/**
 * Create a session manager
 */
export function createSessionManager(
  options?: Partial<ServerSessionOptions>
): SessionManager {
  return new SessionManager(options);
}

/**
 * Create an SSE response helper
 */
export function createSSEResponseHelper(
  sessionManager: SessionManager
): SSEResponseHelper {
  return new SSEResponseHelper(sessionManager);
}

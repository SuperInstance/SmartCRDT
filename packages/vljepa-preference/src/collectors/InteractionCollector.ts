/**
 * InteractionCollector - Collects user interactions for preference learning
 */

import type {
  Interaction,
  InteractionType,
  UIElement,
  UIContext,
  UserSession,
  CollectorConfig,
} from "../types.js";

export class InteractionCollector {
  private config: CollectorConfig;
  private sessions: Map<string, UserSession> = new Map();
  private interactionBuffer: Map<string, Interaction[]> = new Map();
  private flushTimer?: NodeJS.Timeout;

  constructor(config: Partial<CollectorConfig> = {}) {
    this.config = {
      samplingRate: config.samplingRate ?? 1.0,
      bufferSize: config.bufferSize ?? 100,
      flushInterval: config.flushInterval ?? 30000,
      anonymize: config.anonymize ?? false,
    };
    this.startFlushTimer();
  }

  /**
   * Start a new user session
   */
  startSession(userId: string, sessionId?: string): UserSession {
    const id = sessionId ?? this.generateSessionId();
    const session: UserSession = {
      userId: this.config.anonymize ? this.hashUserId(userId) : userId,
      sessionId: id,
      interactions: [],
      startTime: Date.now(),
    };

    this.sessions.set(id, session);
    this.interactionBuffer.set(id, []);

    return session;
  }

  /**
   * End a user session
   */
  endSession(sessionId: string): UserSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.endTime = Date.now();
      this.flush(sessionId);
    }
    return session;
  }

  /**
   * Collect an interaction
   */
  collect(
    sessionId: string,
    type: InteractionType,
    element: UIElement,
    position: { x: number; y: number },
    context: UIContext,
    duration?: number,
    metadata?: Record<string, unknown>
  ): Interaction | null {
    // Apply sampling rate
    if (Math.random() > this.config.samplingRate) {
      return null;
    }

    const interaction: Interaction = {
      type,
      element,
      timestamp: Date.now(),
      duration,
      position,
      context,
      metadata,
    };

    const buffer = this.interactionBuffer.get(sessionId);
    if (buffer) {
      buffer.push(interaction);

      // Flush if buffer is full
      if (buffer.length >= this.config.bufferSize) {
        this.flush(sessionId);
      }
    }

    return interaction;
  }

  /**
   * Record a click interaction
   */
  recordClick(
    sessionId: string,
    element: UIElement,
    position: { x: number; y: number },
    context: UIContext
  ): Interaction | null {
    return this.collect(sessionId, "click", element, position, context);
  }

  /**
   * Record a hover interaction
   */
  recordHover(
    sessionId: string,
    element: UIElement,
    position: { x: number; y: number },
    context: UIContext,
    duration: number
  ): Interaction | null {
    return this.collect(
      sessionId,
      "hover",
      element,
      position,
      context,
      duration
    );
  }

  /**
   * Record a scroll interaction
   */
  recordScroll(
    sessionId: string,
    element: UIElement,
    position: { x: number; y: number },
    context: UIContext,
    distance: number
  ): Interaction | null {
    return this.collect(
      sessionId,
      "scroll",
      element,
      position,
      context,
      distance,
      { distance }
    );
  }

  /**
   * Record a navigation interaction
   */
  recordNavigation(
    sessionId: string,
    from: string,
    to: string,
    context: UIContext
  ): Interaction | null {
    const element: UIElement = {
      id: `nav-${Date.now()}`,
      type: "navigation",
      attributes: { from, to },
      position: { x: 0, y: 0, width: 0, height: 0 },
    };

    return this.collect(
      sessionId,
      "navigate",
      element,
      { x: 0, y: 0 },
      context
    );
  }

  /**
   * Record an input interaction
   */
  recordInput(
    sessionId: string,
    element: UIElement,
    value: string,
    context: UIContext
  ): Interaction | null {
    return this.collect(
      sessionId,
      "input",
      element,
      element.position,
      context,
      undefined,
      { value }
    );
  }

  /**
   * Get all interactions for a session
   */
  getSessionInteractions(sessionId: string): Interaction[] {
    const session = this.sessions.get(sessionId);
    return session?.interactions ?? [];
  }

  /**
   * Get all interactions for a user
   */
  getUserInteractions(userId: string): Interaction[] {
    const interactions: Interaction[] = [];
    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        interactions.push(...session.interactions);
      }
    }
    return interactions;
  }

  /**
   * Get interactions by type
   */
  getInteractionsByType(
    sessionId: string,
    type: InteractionType
  ): Interaction[] {
    return this.getSessionInteractions(sessionId).filter(i => i.type === type);
  }

  /**
   * Get interactions by time range
   */
  getInteractionsByTimeRange(
    sessionId: string,
    startTime: number,
    endTime: number
  ): Interaction[] {
    return this.getSessionInteractions(sessionId).filter(
      i => i.timestamp >= startTime && i.timestamp <= endTime
    );
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId: string): SessionStats {
    const interactions = this.getSessionInteractions(sessionId);
    const session = this.sessions.get(sessionId);

    const stats: SessionStats = {
      totalInteractions: interactions.length,
      byType: {} as Record<InteractionType, number>,
      avgDwellTime: 0,
      totalScrollDistance: 0,
      uniqueElements: new Set(interactions.map(i => i.element.id)).size,
      duration: session?.endTime
        ? session.endTime - session.startTime
        : Date.now() - (session?.startTime ?? 0),
    };

    // Count by type
    for (const interaction of interactions) {
      stats.byType[interaction.type] =
        (stats.byType[interaction.type] ?? 0) + 1;

      if (interaction.type === "hover" && interaction.duration) {
        stats.avgDwellTime += interaction.duration;
      }

      if (interaction.type === "scroll" && interaction.duration) {
        stats.totalScrollDistance += interaction.duration;
      }
    }

    // Calculate averages
    const hoverCount = stats.byType["hover"] ?? 0;
    if (hoverCount > 0) {
      stats.avgDwellTime /= hoverCount;
    }

    return stats;
  }

  /**
   * Flush buffered interactions to session
   */
  private flush(sessionId: string): void {
    const buffer = this.interactionBuffer.get(sessionId);
    const session = this.sessions.get(sessionId);

    if (buffer && session && buffer.length > 0) {
      session.interactions.push(...buffer);
      buffer.length = 0;
    }
  }

  /**
   * Start automatic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      for (const sessionId of this.interactionBuffer.keys()) {
        this.flush(sessionId);
      }
    }, this.config.flushInterval);
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Hash user ID for anonymization
   */
  private hashUserId(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `user-${Math.abs(hash)}`;
  }

  /**
   * Clear all sessions
   */
  clear(): void {
    this.sessions.clear();
    this.interactionBuffer.clear();
  }

  /**
   * Stop the collector
   */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    // Flush all buffers
    for (const sessionId of this.interactionBuffer.keys()) {
      this.flush(sessionId);
    }
  }

  /**
   * Export all sessions
   */
  exportSessions(): UserSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get total interaction count
   */
  getTotalInteractionCount(): number {
    let total = 0;
    for (const session of this.sessions.values()) {
      total += session.interactions.length;
    }
    return total;
  }
}

export interface SessionStats {
  totalInteractions: number;
  byType: Record<InteractionType, number>;
  avgDwellTime: number;
  totalScrollDistance: number;
  uniqueElements: number;
  duration: number;
}

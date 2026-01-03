/**
 * SessionCollector - Collects and manages session data
 */

import { EventEmitter } from "eventemitter3";
import type { Session } from "../types.js";

export class SessionCollector extends EventEmitter {
  private sessions: Map<string, Session> = new Map();
  private userSessions: Map<string, Set<string>> = new Map();

  /**
   * Start a new session
   */
  start(userId: string, referrer?: string): Session {
    const sessionId = this.generateId();

    const session: Session = {
      sessionId,
      userId,
      startTime: Date.now(),
      pageViews: 0,
      events: 0,
      conversions: 0,
      referrer,
      customProperties: {},
    };

    this.sessions.set(sessionId, session);

    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId)!.add(sessionId);

    this.emit("sessionStarted", session);

    return session;
  }

  /**
   * End a session
   */
  end(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId);
    if (session && !session.endTime) {
      session.endTime = Date.now();
      session.duration = session.endTime - session.startTime;

      this.emit("sessionEnded", session);
    }

    return session;
  }

  /**
   * Get session
   */
  get(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get active session for user
   */
  getActiveSession(userId: string): Session | undefined {
    const userSessionIds = this.userSessions.get(userId);
    if (!userSessionIds) {
      return undefined;
    }

    for (const sessionId of userSessionIds) {
      const session = this.sessions.get(sessionId);
      if (session && !session.endTime) {
        return session;
      }
    }

    return undefined;
  }

  /**
   * Get all sessions for user
   */
  getUserSessions(userId: string): Session[] {
    const userSessionIds = this.userSessions.get(userId);
    if (!userSessionIds) {
      return [];
    }

    return Array.from(userSessionIds)
      .map(id => this.sessions.get(id))
      .filter((s): s is Session => s !== undefined);
  }

  /**
   * Get all sessions
   */
  getAll(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): Session[] {
    return Array.from(this.sessions.values()).filter(s => !s.endTime);
  }

  /**
   * Increment page views for session
   */
  incrementPageViews(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pageViews++;
    }
  }

  /**
   * Increment events for session
   */
  incrementEvents(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.events++;
    }
  }

  /**
   * Increment conversions for session
   */
  incrementConversions(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.conversions++;
      this.emit("conversion", session);
    }
  }

  /**
   * Set session device info
   */
  setDevice(
    sessionId: string,
    device: {
      type: "desktop" | "mobile" | "tablet";
      os?: string;
      browser?: string;
    }
  ): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.device = device;
    }
  }

  /**
   * Set UTM parameters
   */
  setUTM(
    sessionId: string,
    utm: {
      source?: string;
      medium?: string;
      campaign?: string;
      term?: string;
      content?: string;
    }
  ): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.utm = utm;
    }
  }

  /**
   * Set custom property
   */
  setCustomProperty(sessionId: string, key: string, value: unknown): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.customProperties[key] = value;
    }
  }

  /**
   * Calculate session stats
   */
  getStats(): {
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
    averageDuration: number;
    averagePageViews: number;
    averageEvents: number;
    conversionRate: number;
  } {
    const sessions = Array.from(this.sessions.values());
    const completed = sessions.filter(s => s.endTime);
    const totalDuration = completed.reduce(
      (sum, s) => sum + (s.duration || 0),
      0
    );
    const totalPageViews = sessions.reduce((sum, s) => sum + s.pageViews, 0);
    const totalEvents = sessions.reduce((sum, s) => sum + s.events, 0);
    const totalConversions = sessions.reduce(
      (sum, s) => sum + s.conversions,
      0
    );

    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => !s.endTime).length,
      completedSessions: completed.length,
      averageDuration:
        completed.length > 0 ? totalDuration / completed.length : 0,
      averagePageViews:
        sessions.length > 0 ? totalPageViews / sessions.length : 0,
      averageEvents: sessions.length > 0 ? totalEvents / sessions.length : 0,
      conversionRate:
        sessions.length > 0 ? totalConversions / sessions.length : 0,
    };
  }

  /**
   * Delete session
   */
  delete(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      const userSessions = this.userSessions.get(session.userId);
      if (userSessions) {
        userSessions.delete(sessionId);
      }
      return this.sessions.delete(sessionId);
    }
    return false;
  }

  /**
   * Clear all sessions
   */
  clear(): void {
    this.sessions.clear();
    this.userSessions.clear();
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

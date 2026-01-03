/**
 * EventCollector - Collects and batches analytics events
 * Handles page views, clicks, hovers, scrolls, submissions, and custom events
 */

import { EventEmitter } from "eventemitter3";
import type {
  Event,
  EventType,
  EventCategory,
  EventCollectorConfig,
  EventContext,
} from "../types.js";

export class EventCollector extends EventEmitter {
  private config: EventCollectorConfig;
  private eventBuffer: Event[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private sessionId: string;
  private userId: string | null = null;
  private context: Partial<EventContext> = {};
  private isInitialized: boolean = false;
  private eventCount: number = 0;
  private droppedEvents: number = 0;

  constructor(config: Partial<EventCollectorConfig> = {}) {
    super();

    this.config = {
      batchSize: config.batchSize ?? 10,
      flushInterval: config.flushInterval ?? 5000,
      sampling: config.sampling ?? 1.0,
      endpoint: config.endpoint,
      bufferSize: config.bufferSize ?? 100,
    };

    this.sessionId = this.generateId();

    this.startFlushTimer();
  }

  /**
   * Initialize the collector with user and context
   */
  initialize(userId: string, context: Partial<EventContext> = {}): void {
    this.userId = userId;
    this.context = {
      ...this.context,
      ...context,
    };
    this.isInitialized = true;

    this.emit("initialized", { userId, sessionId: this.sessionId });
  }

  /**
   * Track a page view event
   */
  trackPageView(url: string, properties: Record<string, unknown> = {}): string {
    return this.track("page_view", "navigation", {
      url,
      ...properties,
    });
  }

  /**
   * Track a click event
   */
  trackClick(
    element: string,
    properties: Record<string, unknown> = {}
  ): string {
    return this.track("click", "interaction", {
      element,
      ...properties,
    });
  }

  /**
   * Track a hover event
   */
  trackHover(
    element: string,
    duration: number,
    properties: Record<string, unknown> = {}
  ): string {
    return this.track("hover", "interaction", {
      element,
      duration,
      ...properties,
    });
  }

  /**
   * Track a scroll event
   */
  trackScroll(
    scrollTop: number,
    scrollHeight: number,
    properties: Record<string, unknown> = {}
  ): string {
    return this.track("scroll", "interaction", {
      scrollTop,
      scrollHeight,
      scrollPercentage: (scrollTop / scrollHeight) * 100,
      ...properties,
    });
  }

  /**
   * Track a form submission
   */
  trackSubmit(
    formId: string,
    properties: Record<string, unknown> = {}
  ): string {
    return this.track("submit", "transaction", {
      formId,
      ...properties,
    });
  }

  /**
   * Track a custom event
   */
  trackCustom(
    eventName: string,
    category: EventCategory = "custom",
    properties: Record<string, unknown> = {}
  ): string {
    return this.track("custom", category, {
      eventName,
      ...properties,
    });
  }

  /**
   * Track an impression event
   */
  trackImpression(
    element: string,
    properties: Record<string, unknown> = {}
  ): string {
    return this.track("impression", "interaction", {
      element,
      ...properties,
    });
  }

  /**
   * Track an engagement event
   */
  trackEngagement(
    type: string,
    target: string,
    properties: Record<string, unknown> = {}
  ): string {
    return this.track("engagement", "interaction", {
      engagementType: type,
      target,
      ...properties,
    });
  }

  /**
   * Track a conversion event
   */
  trackConversion(
    type: string,
    value?: number,
    properties: Record<string, unknown> = {}
  ): string {
    return this.track("conversion", "transaction", {
      conversionType: type,
      value,
      ...properties,
    });
  }

  /**
   * Track an error event
   */
  trackError(
    message: string,
    stack?: string,
    properties: Record<string, unknown> = {}
  ): string {
    return this.track("error", "system", {
      errorMessage: message,
      stack,
      ...properties,
    });
  }

  /**
   * Generic track method
   */
  track(
    type: EventType,
    category: EventCategory,
    properties: Record<string, unknown> = {}
  ): string {
    // Check sampling
    if (Math.random() > this.config.sampling) {
      this.droppedEvents++;
      return "";
    }

    if (!this.isInitialized) {
      console.warn("EventCollector not initialized. Call initialize() first.");
      this.droppedEvents++;
      return "";
    }

    const eventId = this.generateId();
    const timestamp = Date.now();

    const event: Event = {
      id: eventId,
      type,
      category,
      timestamp,
      userId: this.userId!,
      sessionId: this.sessionId,
      properties,
      context: {
        ...this.context,
        timestamp,
      } as EventContext,
    };

    this.bufferEvent(event);
    this.eventCount++;

    this.emit("event", event);

    return eventId;
  }

  /**
   * Add event to buffer
   */
  private bufferEvent(event: Event): void {
    this.eventBuffer.push(event);

    // Check if buffer is full
    if (this.eventBuffer.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /**
   * Flush events to storage/endpoint
   */
  async flush(): Promise<void> {
    if (this.eventBuffer.length === 0) {
      return;
    }

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      if (this.config.endpoint) {
        // Send to endpoint
        await this.sendToEndpoint(events);
      } else {
        // Emit events for storage to handle
        this.emit("flush", events);
      }

      this.emit("flushed", { count: events.length });
    } catch (error) {
      // Re-add events to buffer on failure
      this.eventBuffer.unshift(...events);
      this.emit("flushError", { error, count: events.length });
    }
  }

  /**
   * Send events to endpoint
   */
  private async sendToEndpoint(events: Event[]): Promise<void> {
    // Placeholder for actual HTTP request
    // In production, this would use fetch, axios, etc.
    if (this.config.endpoint) {
      console.log(`Sending ${events.length} events to ${this.config.endpoint}`);
    }
  }

  /**
   * Start automatic flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  /**
   * Stop automatic flush timer
   */
  stopAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Update context
   */
  updateContext(context: Partial<EventContext>): void {
    this.context = {
      ...this.context,
      ...context,
    };
  }

  /**
   * Set user ID
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }

  /**
   * Generate new session
   */
  newSession(): string {
    this.flush();
    this.sessionId = this.generateId();
    this.emit("newSession", { sessionId: this.sessionId });
    return this.sessionId;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Get statistics
   */
  getStats(): {
    eventCount: number;
    droppedEvents: number;
    bufferSize: number;
    sessionId: string;
    userId: string | null;
  } {
    return {
      eventCount: this.eventCount,
      droppedEvents: this.droppedEvents,
      bufferSize: this.eventBuffer.length,
      sessionId: this.sessionId,
      userId: this.userId,
    };
  }

  /**
   * Clear event buffer
   */
  clearBuffer(): void {
    this.eventBuffer = [];
  }

  /**
   * Reset collector
   */
  reset(): void {
    this.flush();
    this.clearBuffer();
    this.eventCount = 0;
    this.droppedEvents = 0;
    this.userId = null;
    this.sessionId = this.generateId();
  }

  /**
   * Shutdown collector
   */
  async shutdown(): Promise<void> {
    this.stopAutoFlush();
    await this.flush();
    this.removeAllListeners();
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

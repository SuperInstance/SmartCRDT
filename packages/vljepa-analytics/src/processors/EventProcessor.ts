/**
 * EventProcessor - Processes raw events and extracts insights
 */

import { EventEmitter } from "eventemitter3";
import type { Event } from "../types.js";

export interface ProcessingResult {
  success: boolean;
  event: Event;
  extracted: {
    properties: Record<string, unknown>;
    metrics: Record<string, number>;
    dimensions: Record<string, string>;
  };
  errors?: string[];
}

export class EventProcessor extends EventEmitter {
  private processors: Map<string, (event: Event) => ProcessingResult> =
    new Map();

  /**
   * Process an event
   */
  process(event: Event): ProcessingResult {
    const processor = this.processors.get(event.type);
    const result = processor ? processor(event) : this.defaultProcess(event);

    this.emit("processed", result);

    return result;
  }

  /**
   * Process multiple events
   */
  processBatch(events: Event[]): ProcessingResult[] {
    return events.map(e => this.process(e));
  }

  /**
   * Register a processor for an event type
   */
  registerProcessor(
    eventType: string,
    processor: (event: Event) => ProcessingResult
  ): void {
    this.processors.set(eventType, processor);
  }

  /**
   * Unregister a processor
   */
  unregisterProcessor(eventType: string): void {
    this.processors.delete(eventType);
  }

  /**
   * Default processing logic
   */
  private defaultProcess(event: Event): ProcessingResult {
    return {
      success: true,
      event,
      extracted: {
        properties: event.properties,
        metrics: this.extractMetrics(event),
        dimensions: this.extractDimensions(event),
      },
    };
  }

  /**
   * Extract metrics from event
   */
  private extractMetrics(event: Event): Record<string, number> {
    const metrics: Record<string, number> = {};

    for (const [key, value] of Object.entries(event.properties)) {
      if (typeof value === "number") {
        metrics[key] = value;
      }
    }

    return metrics;
  }

  /**
   * Extract dimensions from event
   */
  private extractDimensions(event: Event): Record<string, string> {
    const dimensions: Record<string, string> = {};

    for (const [key, value] of Object.entries(event.properties)) {
      if (typeof value === "string") {
        dimensions[key] = value;
      }
    }

    return dimensions;
  }

  /**
   * Validate event
   */
  validate(event: Event): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!event.id) errors.push("Missing event id");
    if (!event.type) errors.push("Missing event type");
    if (!event.userId) errors.push("Missing user id");
    if (!event.sessionId) errors.push("Missing session id");
    if (!event.timestamp) errors.push("Missing timestamp");

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Enrich event with additional context
   */
  enrich(event: Event, context: Record<string, unknown>): Event {
    return {
      ...event,
      properties: {
        ...event.properties,
        ...context,
      },
      context: {
        ...event.context,
        ...context,
      } as typeof event.context,
    };
  }
}

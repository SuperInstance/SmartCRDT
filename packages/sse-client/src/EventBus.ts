/**
 * EventBus - Event emission and listener management
 *
 * Provides pub/sub event handling with:
 * - Multiple listeners per event type
 * - Event filtering
 * - Event transformation
 * - Once-only listeners
 * - Priority-based execution
 */

import type {
  SSEMessage,
  EventListener,
  ListenerOptions,
  MessageHandler,
} from "./types.js";

/**
 * EventBus for managing event listeners
 */
export class EventBus {
  private listeners: Map<string, EventListener[]> = new Map();
  private listenerIdCounter = 0;

  /**
   * Add an event listener
   * @param event Event name
   * @param handler Handler function
   * @param options Listener options
   * @returns Listener ID for removal
   */
  on(
    event: string,
    handler: MessageHandler,
    options: ListenerOptions = {}
  ): string {
    const listenerId = this.generateListenerId();

    const listener: EventListener = {
      id: listenerId,
      handler: handler as (...args: unknown[]) => void,
      event: options.event ?? event,
      filter: options.filter,
      transform: options.transform,
      once: options.once ?? false,
      priority: options.priority ?? 0,
    };

    // Get or create listeners array for this event
    let eventListeners = this.listeners.get(listener.event);
    if (!eventListeners) {
      eventListeners = [];
      this.listeners.set(listener.event, eventListeners);
    }

    // Insert sorted by priority (higher priority first)
    eventListeners.push(listener);
    this.sortListenersByPriority(eventListeners);

    return listenerId;
  }

  /**
   * Add a one-time event listener
   * @param event Event name
   * @param handler Handler function
   * @param options Listener options
   * @returns Listener ID for removal
   */
  once(
    event: string,
    handler: MessageHandler,
    options: ListenerOptions = {}
  ): string {
    return this.on(event, handler, { ...options, once: true });
  }

  /**
   * Remove an event listener
   * @param listenerId Listener ID to remove
   * @returns True if listener was found and removed
   */
  off(listenerId: string): boolean {
    for (const [event, listeners] of this.listeners.entries()) {
      const index = listeners.findIndex(l => l.id === listenerId);
      if (index !== -1) {
        listeners.splice(index, 1);
        if (listeners.length === 0) {
          this.listeners.delete(event);
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Remove all listeners for an event
   * @param event Event name
   */
  offAll(event: string): void {
    this.listeners.delete(event);
  }

  /**
   * Remove all listeners
   */
  removeAll(): void {
    this.listeners.clear();
  }

  /**
   * Emit an event to all listeners
   * @param event Event name
   * @param message SSE message
   */
  emit(event: string, message: SSEMessage): void {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners || eventListeners.length === 0) {
      return;
    }

    // Clone array to avoid issues if listeners are removed during iteration
    const listenersToCall = [...eventListeners];
    const toRemove: string[] = [];

    for (const listener of listenersToCall) {
      try {
        // Apply filter if present
        if (listener.filter && !listener.filter(message)) {
          continue;
        }

        // Transform message if transform function present
        const data = listener.transform ? listener.transform(message) : message;

        // Call handler
        listener.handler(data);

        // Mark once listeners for removal
        if (listener.once) {
          toRemove.push(listener.id);
        }
      } catch (error) {
        // Don't let one listener break others
        console.error(`Error in SSE event listener [${event}]:`, error);
      }
    }

    // Remove once listeners
    for (const id of toRemove) {
      this.off(id);
    }
  }

  /**
   * Get listener count for an event
   * @param event Event name
   * @returns Number of listeners
   */
  listenerCount(event: string): number {
    const eventListeners = this.listeners.get(event);
    return eventListeners?.length ?? 0;
  }

  /**
   * Get total listener count
   * @returns Total number of listeners
   */
  get totalListenerCount(): number {
    let count = 0;
    for (const listeners of this.listeners.values()) {
      count += listeners.length;
    }
    return count;
  }

  /**
   * Check if there are any listeners for an event
   * @param event Event name
   * @returns True if there are listeners
   */
  hasListeners(event: string): boolean {
    return this.listenerCount(event) > 0;
  }

  /**
   * Get all event names with listeners
   * @returns Array of event names
   */
  get events(): string[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * Get listeners for an event
   * @param event Event name
   * @returns Array of listeners (copy)
   */
  getListeners(event: string): EventListener[] {
    const eventListeners = this.listeners.get(event);
    return eventListeners ? [...eventListeners] : [];
  }

  /**
   * Add a listener for all events (wildcard)
   * @param handler Handler function
   * @param priority Listener priority
   * @returns Listener ID
   */
  onAny(
    handler: (event: string, message: SSEMessage) => void,
    priority = 0
  ): string {
    const listenerId = this.generateListenerId();

    // Create a wildcard listener
    const wildcardListener: EventListener = {
      id,
      handler: handler as (...args: unknown[]) => void,
      event: "*",
      once: false,
      priority,
    };

    // Store in special wildcard key
    let wildcardListeners = this.listeners.get("*");
    if (!wildcardListeners) {
      wildcardListeners = [];
      this.listeners.set("*", wildcardListeners);
    }

    wildcardListeners.push(wildcardListener);
    this.sortListenersByPriority(wildcardListeners);

    return listenerId;
  }

  /**
   * Emit to wildcard listeners
   * @param event Event name
   * @param message SSE message
   */
  private emitWildcard(event: string, message: SSEMessage): void {
    const wildcardListeners = this.listeners.get("*");
    if (!wildcardListeners || wildcardListeners.length === 0) {
      return;
    }

    const listenersToCall = [...wildcardListeners];

    for (const listener of listenersToCall) {
      try {
        (listener.handler as (event: string, message: SSEMessage) => void)(
          event,
          message
        );
      } catch (error) {
        console.error("Error in wildcard SSE listener:", error);
      }
    }
  }

  /**
   * Full emit including wildcard listeners
   * @param event Event name
   * @param message SSE message
   */
  emitAll(event: string, message: SSEMessage): void {
    this.emitWildcard(event, message);
    this.emit(event, message);
  }

  /**
   * Sort listeners by priority (descending)
   * @param listeners Listeners to sort
   */
  private sortListenersByPriority(listeners: EventListener[]): void {
    listeners.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Generate unique listener ID
   * @returns Unique ID
   */
  private generateListenerId(): string {
    return `listener_${++this.listenerIdCounter}_${Date.now()}`;
  }

  /**
   * Get statistics about listeners
   * @returns Statistics object
   */
  getStats(): {
    totalListeners: number;
    events: string[];
    listenerCounts: Record<string, number>;
    onceListeners: number;
    prioritySum: number;
  } {
    const listenerCounts: Record<string, number> = {};
    let onceListeners = 0;
    let prioritySum = 0;

    for (const [event, listeners] of this.listeners.entries()) {
      listenerCounts[event] = listeners.length;
      onceListeners += listeners.filter(l => l.once).length;
      prioritySum += listeners.reduce((sum, l) => sum + l.priority, 0);
    }

    return {
      totalListeners: this.totalListenerCount,
      events: this.events,
      listenerCounts,
      onceListeners,
      prioritySum,
    };
  }
}

/**
 * Default singleton instance
 */
export const defaultEventBus = new EventBus();

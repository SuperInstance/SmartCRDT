/**
 * EventStore - Stores and retrieves analytics events
 */

import type { Event, Filter, DateRange, QueryOptions } from "../types.js";

export class EventStore {
  private events: Map<string, Event> = new Map();
  private eventIndex: Map<EventType, Set<string>> = new Map();
  private categoryIndex: Map<string, Set<string>> = new Map();
  private userIndex: Map<string, Set<string>> = new Map();
  private sessionIndex: Map<string, Set<string>> = new Map();

  /**
   * Store an event
   */
  store(event: Event): void {
    this.events.set(event.id, event);

    // Index by type
    if (!this.eventIndex.has(event.type)) {
      this.eventIndex.set(event.type, new Set());
    }
    this.eventIndex.get(event.type)!.add(event.id);

    // Index by category
    if (!this.categoryIndex.has(event.category)) {
      this.categoryIndex.set(event.category, new Set());
    }
    this.categoryIndex.get(event.category)!.add(event.id);

    // Index by user
    if (!this.userIndex.has(event.userId)) {
      this.userIndex.set(event.userId, new Set());
    }
    this.userIndex.get(event.userId)!.add(event.id);

    // Index by session
    if (!this.sessionIndex.has(event.sessionId)) {
      this.sessionIndex.set(event.sessionId, new Set());
    }
    this.sessionIndex.get(event.sessionId)!.add(event.id);
  }

  /**
   * Store multiple events
   */
  storeBatch(events: Event[]): void {
    for (const event of events) {
      this.store(event);
    }
  }

  /**
   * Get an event by ID
   */
  get(eventId: string): Event | undefined {
    return this.events.get(eventId);
  }

  /**
   * Query events
   */
  query(options: QueryOptions = {}): Event[] {
    let results = Array.from(this.events.values());

    // Apply filters
    if (options.filters) {
      results = this.applyFilters(results, options.filters);
    }

    // Apply date range
    if (options.dateRange) {
      const { start, end } = options.dateRange;
      results = results.filter(
        e => e.timestamp >= start.getTime() && e.timestamp <= end.getTime()
      );
    }

    // Apply sorting
    if (options.sort) {
      results.sort((a, b) => {
        const aVal = a.properties[options.sort!.field] as number;
        const bVal = b.properties[options.sort!.field] as number;
        return options.sort!.direction === "asc" ? aVal - bVal : bVal - aVal;
      });
    }

    // Apply pagination
    if (options.pagination) {
      const { page, pageSize } = options.pagination;
      const startIdx = (page - 1) * pageSize;
      const endIdx = startIdx + pageSize;
      results = results.slice(startIdx, endIdx);
    }

    return results;
  }

  /**
   * Get events by type
   */
  getByType(type: EventType): Event[] {
    const ids = this.eventIndex.get(type);
    if (!ids) return [];
    return Array.from(ids).map(id => this.events.get(id)!);
  }

  /**
   * Get events by user
   */
  getByUser(userId: string): Event[] {
    const ids = this.userIndex.get(userId);
    if (!ids) return [];
    return Array.from(ids).map(id => this.events.get(id)!);
  }

  /**
   * Get events by session
   */
  getBySession(sessionId: string): Event[] {
    const ids = this.sessionIndex.get(sessionId);
    if (!ids) return [];
    return Array.from(ids).map(id => this.events.get(id)!);
  }

  /**
   * Get events in date range
   */
  getByDateRange(range: DateRange): Event[] {
    const { start, end } = range;
    return Array.from(this.events.values()).filter(
      e => e.timestamp >= start.getTime() && e.timestamp <= end.getTime()
    );
  }

  /**
   * Count events
   */
  count(): number {
    return this.events.size;
  }

  /**
   * Count by type
   */
  countByType(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const [type, ids] of this.eventIndex) {
      counts[type] = ids.size;
    }
    return counts;
  }

  /**
   * Delete an event
   */
  delete(eventId: string): boolean {
    const event = this.events.get(eventId);
    if (!event) return false;

    this.events.delete(eventId);
    this.eventIndex.get(event.type)?.delete(eventId);
    this.categoryIndex.get(event.category)?.delete(eventId);
    this.userIndex.get(event.userId)?.delete(eventId);
    this.sessionIndex.get(event.sessionId)?.delete(eventId);

    return true;
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.events.clear();
    this.eventIndex.clear();
    this.categoryIndex.clear();
    this.userIndex.clear();
    this.sessionIndex.clear();
  }

  /**
   * Apply filters to events
   */
  private applyFilters(events: Event[], filters: Filter[]): Event[] {
    return events.filter(event => {
      return filters.every(filter => {
        const value = event.properties[filter.field];

        switch (filter.operator) {
          case "equals":
            return value === filter.value;
          case "contains":
            return (
              typeof value === "string" && value.includes(String(filter.value))
            );
          case "startsWith":
            return (
              typeof value === "string" &&
              value.startsWith(String(filter.value))
            );
          case "endsWith":
            return (
              typeof value === "string" && value.endsWith(String(filter.value))
            );
          case "gt":
            return (
              typeof value === "number" && value > (filter.value as number)
            );
          case "lt":
            return (
              typeof value === "number" && value < (filter.value as number)
            );
          case "gte":
            return (
              typeof value === "number" && value >= (filter.value as number)
            );
          case "lte":
            return (
              typeof value === "number" && value <= (filter.value as number)
            );
          case "in":
            return Array.isArray(filter.value) && filter.value.includes(value);
          default:
            return true;
        }
      });
    });
  }
}

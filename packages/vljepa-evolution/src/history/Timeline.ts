/**
 * Timeline - Event timeline for UI evolution
 */

import type { UIVersion, EvolutionEvent } from "../types.js";

export interface TimelineEvent {
  id: string;
  timestamp: number;
  type: "version" | "event" | "merge" | "branch";
  version?: UIVersion;
  event?: EvolutionEvent;
  metadata?: TimelineMetadata;
}

export interface TimelineMetadata {
  branch?: string;
  author?: string;
  message?: string;
  tags?: string[];
}

export class Timeline {
  private events: TimelineEvent[];
  private indexed: boolean;

  constructor() {
    this.events = [];
    this.indexed = false;
  }

  /**
   * Add a version to the timeline
   */
  addVersion(version: UIVersion, metadata?: Partial<TimelineMetadata>): void {
    const event: TimelineEvent = {
      id: this.generateEventId(),
      timestamp: version.timestamp,
      type: "version",
      version,
      metadata: {
        branch: version.branch,
        author: version.author,
        message: version.message,
        ...metadata,
      },
    };

    this.events.push(event);
    this.indexed = false;
  }

  /**
   * Add an evolution event to the timeline
   */
  addEvent(event: EvolutionEvent): void {
    const timelineEvent: TimelineEvent = {
      id: this.generateEventId(),
      timestamp: event.timestamp,
      type: "event",
      event,
      metadata: {
        branch: event.metadata.branch,
        author: event.author,
        message: event.metadata.message,
        tags: event.metadata.tags,
      },
    };

    this.events.push(timelineEvent);
    this.indexed = false;
  }

  /**
   * Add a branch event to the timeline
   */
  addBranchEvent(
    timestamp: number,
    branch: string,
    action: "create" | "delete" | "switch"
  ): void {
    const event: TimelineEvent = {
      id: this.generateEventId(),
      timestamp,
      type: "branch",
      metadata: {
        branch,
        message: `Branch ${action}: ${branch}`,
      },
    };

    this.events.push(event);
    this.indexed = false;
  }

  /**
   * Get all events
   */
  getAllEvents(): TimelineEvent[] {
    this.ensureIndexed();
    return [...this.events];
  }

  /**
   * Get events in time range
   */
  getEventsInRange(start: number, end: number): TimelineEvent[] {
    this.ensureIndexed();
    return this.events.filter(e => e.timestamp >= start && e.timestamp <= end);
  }

  /**
   * Get events for a specific branch
   */
  getEventsForBranch(branch: string): TimelineEvent[] {
    this.ensureIndexed();
    return this.events.filter(e => e.metadata?.branch === branch);
  }

  /**
   * Get events by author
   */
  getEventsByAuthor(author: string): TimelineEvent[] {
    this.ensureIndexed();
    return this.events.filter(e => e.metadata?.author === author);
  }

  /**
   * Get events by type
   */
  getEventsByType(type: TimelineEvent["type"]): TimelineEvent[] {
    this.ensureIndexed();
    return this.events.filter(e => e.type === type);
  }

  /**
   * Get recent events
   */
  getRecentEvents(count: number = 10): TimelineEvent[] {
    this.ensureIndexed();
    return this.events.slice(-count);
  }

  /**
   * Get event density (events per time period)
   */
  getDensity(intervalMs: number = 86400000): DensityEntry[] {
    this.ensureIndexed();

    if (this.events.length === 0) {
      return [];
    }

    const start =
      Math.floor(this.events[0].timestamp / intervalMs) * intervalMs;
    const end = this.events[this.events.length - 1].timestamp;

    const densities: Map<number, number> = new Map();

    for (const event of this.events) {
      const bucket = Math.floor(event.timestamp / intervalMs) * intervalMs;
      densities.set(bucket, (densities.get(bucket) || 0) + 1);
    }

    const entries: DensityEntry[] = [];
    for (let t = start; t <= end; t += intervalMs) {
      entries.push({
        timestamp: t,
        count: densities.get(t) || 0,
      });
    }

    return entries;
  }

  /**
   * Find gaps in timeline (periods with no events)
   */
  findGaps(thresholdMs: number): Gap[] {
    this.ensureIndexed();

    const gaps: Gap[] = [];

    for (let i = 1; i < this.events.length; i++) {
      const diff = this.events[i].timestamp - this.events[i - 1].timestamp;

      if (diff >= thresholdMs) {
        gaps.push({
          start: this.events[i - 1].timestamp,
          end: this.events[i].timestamp,
          duration: diff,
        });
      }
    }

    return gaps;
  }

  /**
   * Get event statistics
   */
  getStatistics(): TimelineStatistics {
    this.ensureIndexed();

    const stats: TimelineStatistics = {
      totalEvents: this.events.length,
      firstEvent: this.events[0]?.timestamp,
      lastEvent: this.events[this.events.length - 1]?.timestamp,
      eventsByType: this.groupByType(),
      eventsByBranch: this.groupByBranch(),
      eventsByAuthor: this.groupByAuthor(),
      averageInterval: this.calculateAverageInterval(),
    };

    return stats;
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.events = [];
    this.indexed = false;
  }

  /**
   * Export timeline to JSON
   */
  export(): string {
    return JSON.stringify(this.events, null, 2);
  }

  /**
   * Import timeline from JSON
   */
  import(json: string): void {
    this.events = JSON.parse(json);
    this.indexed = false;
  }

  // Private methods

  private ensureIndexed(): void {
    if (this.indexed) {
      return;
    }

    this.events.sort((a, b) => a.timestamp - b.timestamp);
    this.indexed = true;
  }

  private groupByType(): Record<string, number> {
    return this.events.reduce(
      (acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  private groupByBranch(): Record<string, number> {
    return this.events.reduce(
      (acc, event) => {
        const branch = event.metadata?.branch ?? "unknown";
        acc[branch] = (acc[branch] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  private groupByAuthor(): Record<string, number> {
    return this.events.reduce(
      (acc, event) => {
        const author = event.metadata?.author ?? "unknown";
        acc[author] = (acc[author] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  private calculateAverageInterval(): number {
    if (this.events.length < 2) {
      return 0;
    }

    let total = 0;
    for (let i = 1; i < this.events.length; i++) {
      total += this.events[i].timestamp - this.events[i - 1].timestamp;
    }

    return total / (this.events.length - 1);
  }

  private generateEventId(): string {
    return `tle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export interface DensityEntry {
  timestamp: number;
  count: number;
}

export interface Gap {
  start: number;
  end: number;
  duration: number;
}

export interface TimelineStatistics {
  totalEvents: number;
  firstEvent?: number;
  lastEvent?: number;
  eventsByType: Record<string, number>;
  eventsByBranch: Record<string, number>;
  eventsByAuthor: Record<string, number>;
  averageInterval: number;
}

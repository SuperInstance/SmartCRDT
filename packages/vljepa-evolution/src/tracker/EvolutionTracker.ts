/**
 * EvolutionTracker - Tracks UI evolution across all changes
 */

import type {
  UIState,
  EvolutionEvent,
  EvolutionHistory,
  UIVersion,
  Change,
  EventMetadata,
  HistoryMetadata,
} from "../types.js";

export class EvolutionTracker {
  private histories: Map<string, EvolutionHistory>;
  private eventQueue: EvolutionEvent[];
  private autoCommit: boolean;
  private maxHistorySize: number;

  constructor(config: TrackerConfig = {}) {
    this.histories = new Map();
    this.eventQueue = [];
    this.autoCommit = config.autoCommit ?? true;
    this.maxHistorySize = config.maxHistorySize ?? 10000;
  }

  /**
   * Start tracking a UI
   */
  async startTracking(uiId: string, initialState: UIState): Promise<void> {
    const history: EvolutionHistory = {
      uiId,
      events: [],
      versions: [],
      currentVersion: this.generateVersionId(),
      branches: ["main"],
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        totalEvents: 0,
        totalVersions: 0,
      },
    };

    // Create initial version
    const initialVersion: UIVersion = {
      id: history.currentVersion,
      version: "1.0.0",
      hash: this.hashState(initialState),
      parent: null,
      branch: "main",
      timestamp: Date.now(),
      author: "system",
      message: "Initial commit",
      changes: [],
      state: initialState,
    };

    history.versions.push(initialVersion);
    this.histories.set(uiId, history);
  }

  /**
   * Stop tracking a UI
   */
  async stopTracking(uiId: string): Promise<void> {
    const history = this.histories.get(uiId);
    if (!history) {
      throw new Error(`UI ${uiId} is not being tracked`);
    }

    // Flush event queue
    await this.flushQueue(uiId);
    this.histories.delete(uiId);
  }

  /**
   * Track a UI change
   */
  async trackChange(
    uiId: string,
    before: UIState,
    after: UIState,
    metadata: Partial<EventMetadata>
  ): Promise<string> {
    const history = this.histories.get(uiId);
    if (!history) {
      throw new Error(`UI ${uiId} is not being tracked`);
    }

    const event: EvolutionEvent = {
      id: this.generateEventId(),
      type: this.determineChangeType(before, after),
      timestamp: Date.now(),
      author: metadata.author ?? "unknown",
      uiBefore: before,
      uiAfter: after,
      codeDiff: this.computeDiff(before, after),
      metadata: {
        commit: this.generateCommitHash(),
        branch: metadata.branch ?? "main",
        message: metadata.message ?? "",
        tags: metadata.tags ?? [],
        automated: metadata.automated ?? false,
      },
    };

    if (this.autoCommit) {
      await this.commitEvent(uiId, event);
    } else {
      this.eventQueue.push(event);
    }

    return event.id;
  }

  /**
   * Commit an event to history
   */
  async commitEvent(uiId: string, event: EvolutionEvent): Promise<void> {
    const history = this.histories.get(uiId);
    if (!history) {
      throw new Error(`UI ${uiId} is not being tracked`);
    }

    // Add event to history
    history.events.push(event);
    history.metadata.totalEvents++;

    // Create new version
    const newVersion = this.createVersion(event, history);
    history.versions.push(newVersion);
    history.currentVersion = newVersion.id;
    history.metadata.totalVersions++;
    history.metadata.updatedAt = Date.now();

    // Enforce max history size
    if (history.events.length > this.maxHistorySize) {
      history.events.shift();
      history.versions.shift();
    }
  }

  /**
   * Flush queued events
   */
  async flushQueue(uiId: string): Promise<void> {
    const history = this.histories.get(uiId);
    if (!history) {
      return;
    }

    for (const event of this.eventQueue) {
      await this.commitEvent(uiId, event);
    }

    this.eventQueue = [];
  }

  /**
   * Get evolution history for a UI
   */
  getHistory(uiId: string): EvolutionHistory | undefined {
    return this.histories.get(uiId);
  }

  /**
   * Get events for a UI
   */
  getEvents(uiId: string, options: EventQueryOptions = {}): EvolutionEvent[] {
    const history = this.histories.get(uiId);
    if (!history) {
      return [];
    }

    let events = history.events;

    // Filter by type
    if (options.type) {
      events = events.filter(e => e.type === options.type);
    }

    // Filter by author
    if (options.author) {
      events = events.filter(e => e.author === options.author);
    }

    // Filter by branch
    if (options.branch) {
      events = events.filter(e => e.metadata.branch === options.branch);
    }

    // Filter by time range
    if (options.startTime) {
      events = events.filter(e => e.timestamp >= options.startTime!);
    }
    if (options.endTime) {
      events = events.filter(e => e.timestamp <= options.endTime!);
    }

    // Sort
    events.sort((a, b) => {
      const order = options.order ?? "desc";
      return order === "asc"
        ? a.timestamp - b.timestamp
        : b.timestamp - a.timestamp;
    });

    // Limit
    if (options.limit) {
      events = events.slice(0, options.limit);
    }

    return events;
  }

  /**
   * Get statistics for a UI
   */
  getStatistics(uiId: string): EvolutionStatistics | undefined {
    const history = this.histories.get(uiId);
    if (!history) {
      return undefined;
    }

    const events = history.events;
    const stats: EvolutionStatistics = {
      totalEvents: events.length,
      totalVersions: history.versions.length,
      totalBranches: history.branches.length,
      eventsByType: this.groupByType(events),
      eventsByAuthor: this.groupByAuthor(events),
      eventsByBranch: this.groupByBranch(events),
      firstEvent: events[0]?.timestamp,
      lastEvent: events[events.length - 1]?.timestamp,
      averageEventInterval: this.calculateAverageInterval(events),
    };

    return stats;
  }

  /**
   * Export history to JSON
   */
  exportHistory(uiId: string): string {
    const history = this.histories.get(uiId);
    if (!history) {
      throw new Error(`UI ${uiId} is not being tracked`);
    }

    return JSON.stringify(history, null, 2);
  }

  /**
   * Import history from JSON
   */
  importHistory(json: string): void {
    const history: EvolutionHistory = JSON.parse(json);
    this.histories.set(history.uiId, history);
  }

  // Private methods

  private createVersion(
    event: EvolutionEvent,
    history: EvolutionHistory
  ): UIVersion {
    const previousVersion = history.versions[history.versions.length - 1];
    const changes = this.extractChanges(event);

    return {
      id: this.generateVersionId(),
      version: this.incrementVersion(
        previousVersion?.version ?? "0.0.0",
        changes
      ),
      hash: this.hashState(event.uiAfter),
      parent: previousVersion?.id ?? null,
      branch: event.metadata.branch,
      timestamp: event.timestamp,
      author: event.author,
      message: event.metadata.message,
      changes,
      state: event.uiAfter,
    };
  }

  private extractChanges(event: EvolutionEvent): Change[] {
    const changes: Change[] = [];

    // Detect visual changes
    if (this.hasVisualChanges(event.uiBefore, event.uiAfter)) {
      changes.push({
        type: "visual",
        path: "root",
        severity: "minor",
        description: "Visual changes detected",
        before: event.uiBefore,
        after: event.uiAfter,
      });
    }

    // Detect structural changes
    if (this.hasStructuralChanges(event.uiBefore, event.uiAfter)) {
      changes.push({
        type: "structural",
        path: "root",
        severity: "major",
        description: "Structural changes detected",
        before: event.uiBefore,
        after: event.uiAfter,
      });
    }

    // Detect behavioral changes
    if (this.hasBehavioralChanges(event.uiBefore, event.uiAfter)) {
      changes.push({
        type: "behavioral",
        path: "root",
        severity: "major",
        description: "Behavioral changes detected",
        before: event.uiBefore.behavior,
        after: event.uiAfter.behavior,
      });
    }

    return changes;
  }

  private hasVisualChanges(before: UIState, after: UIState): boolean {
    return JSON.stringify(before.styles) !== JSON.stringify(after.styles);
  }

  private hasStructuralChanges(before: UIState, after: UIState): boolean {
    return JSON.stringify(before.layout) !== JSON.stringify(after.layout);
  }

  private hasBehavioralChanges(before: UIState, after: UIState): boolean {
    return JSON.stringify(before.behavior) !== JSON.stringify(after.behavior);
  }

  private determineChangeType(
    before: UIState,
    after: UIState
  ): EvolutionEvent["type"] {
    const beforeComponents = before.components.length;
    const afterComponents = after.components.length;

    if (beforeComponents === 0 && afterComponents > 0) {
      return "create";
    }
    if (beforeComponents > 0 && afterComponents === 0) {
      return "delete";
    }
    if (beforeComponents !== afterComponents) {
      return "modify";
    }

    return "modify";
  }

  private computeDiff(before: UIState, after: UIState): any {
    // Simplified diff computation
    return {
      additions: 0,
      deletions: 0,
      hunks: [],
    };
  }

  private hashState(state: UIState): string {
    const str = JSON.stringify(state);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  private incrementVersion(version: string, changes: Change[]): string {
    const [major, minor, patch] = version.split(".").map(Number);

    const hasBreaking = changes.some(c => c.severity === "breaking");
    const hasMajor = changes.some(c => c.severity === "major");

    if (hasBreaking) {
      return `${major + 1}.0.0`;
    }
    if (hasMajor) {
      return `${major}.${minor + 1}.0`;
    }
    return `${major}.${minor}.${patch + 1}`;
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateVersionId(): string {
    return `ver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCommitHash(): string {
    return Math.random().toString(36).substr(2, 40);
  }

  private groupByType(events: EvolutionEvent[]): Record<string, number> {
    return events.reduce(
      (acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  private groupByAuthor(events: EvolutionEvent[]): Record<string, number> {
    return events.reduce(
      (acc, event) => {
        acc[event.author] = (acc[event.author] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  private groupByBranch(events: EvolutionEvent[]): Record<string, number> {
    return events.reduce(
      (acc, event) => {
        acc[event.metadata.branch] = (acc[event.metadata.branch] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  private calculateAverageInterval(events: EvolutionEvent[]): number {
    if (events.length < 2) {
      return 0;
    }

    const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
    let total = 0;

    for (let i = 1; i < sorted.length; i++) {
      total += sorted[i].timestamp - sorted[i - 1].timestamp;
    }

    return total / (sorted.length - 1);
  }
}

// Supporting types

export interface TrackerConfig {
  autoCommit?: boolean;
  maxHistorySize?: number;
}

export interface EventQueryOptions {
  type?: "create" | "modify" | "delete" | "rename";
  author?: string;
  branch?: string;
  startTime?: number;
  endTime?: number;
  order?: "asc" | "desc";
  limit?: number;
}

export interface EvolutionStatistics {
  totalEvents: number;
  totalVersions: number;
  totalBranches: number;
  eventsByType: Record<string, number>;
  eventsByAuthor: Record<string, number>;
  eventsByBranch: Record<string, number>;
  firstEvent?: number;
  lastEvent?: number;
  averageEventInterval: number;
}

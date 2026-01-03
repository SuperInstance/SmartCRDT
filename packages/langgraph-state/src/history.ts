/**
 * @lsi/langgraph-state - State History
 *
 * Track all state changes for time-travel debugging, state branching,
 * and state comparison capabilities.
 */

import type {
  StateVersion,
  StateSnapshot,
  StateTransition,
  StateDiff,
  StateScope,
} from "./types.js";
import { generateStateId, generateChecksum } from "./types.js";

/**
 * History entry with context
 */
export interface HistoryEntry {
  /** Entry identifier */
  id: string;
  /** Transition data */
  transition: StateTransition;
  /** State after transition */
  state: unknown;
  /** Snapshot at this point (optional, for key points) */
  snapshot?: StateSnapshot;
  /** Parent entry ID */
  parentId?: string;
  /** Child entry IDs */
  childIds: string[];
  /** Branch name if on non-main branch */
  branch?: string;
}

/**
 * State timeline visualization data
 */
export interface StateTimeline {
  /** Timeline identifier */
  id: string;
  /** All transitions in order */
  transitions: StateTransition[];
  /** Key snapshots */
  snapshots: StateSnapshot[];
  /** Branches in timeline */
  branches: string[];
  /** Timeline start time */
  startTime: Date;
  /** Timeline end time */
  endTime: Date;
}

/**
 * Time-travel session
 */
export interface TimeTravelSession {
  /** Session identifier */
  id: string;
  /** Current position in history */
  currentPosition: number;
  /** History entries */
  entries: HistoryEntry[];
  /** Bookmarked positions */
  bookmarks: Map<string, number>;
  /** Active filters */
  filters: HistoryFilter[];
}

/**
 * History filter for querying
 */
export interface HistoryFilter {
  /** Filter by scope */
  scope?: StateScope;
  /** Filter by time range */
  timeRange?: { start: Date; end: Date };
  /** Filter by trigger */
  trigger?: string | RegExp;
  /** Filter by actor */
  actor?: string;
  /** Filter by change path */
  path?: string;
  /** Filter by change type */
  changeType?: "add" | "update" | "delete" | "move" | "copy";
}

/**
 * State comparison result
 */
export interface StateComparison {
  /** Version A */
  versionA: StateVersion;
  /** Version B */
  versionB: StateVersion;
  /** Diff between versions */
  diff: StateDiff;
  /** Number of changes */
  changeCount: number;
  /** Changed paths */
  changedPaths: string[];
  /** Similarity percentage (0-100) */
  similarity: number;
}

/**
 * History manager for tracking state changes
 */
export class StateHistoryManager {
  private entries: Map<string, HistoryEntry>;
  private transitions: StateTransition[];
  private snapshots: Map<string, StateSnapshot>;
  private entriesByScope: Map<StateScope, string[]>;
  private entriesByTime: Map<number, string[]>;
  private currentIndex: number;
  private maxEntries: number;

  constructor(maxEntries: number = 10000) {
    this.entries = new Map();
    this.transitions = [];
    this.snapshots = new Map();
    this.entriesByScope = new Map();
    this.entriesByTime = new Map();
    this.currentIndex = -1;
    this.maxEntries = maxEntries;
  }

  /**
   * Add transition to history
   */
  public async addTransition(
    transition: StateTransition,
    state: unknown,
    createSnapshot?: boolean
  ): Promise<string> {
    const entryId = generateStateId();

    const entry: HistoryEntry = {
      id: entryId,
      transition,
      state: JSON.parse(JSON.stringify(state)),
      childIds: [],
    };

    // Set parent as current entry
    if (this.currentIndex >= 0) {
      const currentEntries = this.getEntriesAtIndex(this.currentIndex);
      if (currentEntries.length > 0) {
        const parentEntry = currentEntries[0];
        entry.parentId = parentEntry.id;
        parentEntry.childIds.push(entryId);
      }
    }

    // Create snapshot if requested
    if (createSnapshot) {
      entry.snapshot = await this.createSnapshotFromState(
        state,
        transition.toState
      );
      this.snapshots.set(entry.snapshot.id, entry.snapshot);
    }

    // Store entry
    this.entries.set(entryId, entry);
    this.transitions.push(transition);
    this.currentIndex++;

    // Index by scope
    const scopeEntries = this.entriesByScope.get(transition.scope) || [];
    scopeEntries.push(entryId);
    this.entriesByScope.set(transition.scope, scopeEntries);

    // Index by time
    const timestamp = transition.timestamp.getTime();
    const timeEntries = this.entriesByTime.get(timestamp) || [];
    timeEntries.push(entryId);
    this.entriesByTime.set(timestamp, timeEntries);

    // Enforce max entries limit
    if (this.entries.size > this.maxEntries) {
      this.pruneOldestEntries();
    }

    return entryId;
  }

  /**
   * Get state at a specific index
   */
  public getStateAtIndex(index: number): unknown | null {
    const entries = this.getEntriesAtIndex(index);
    return entries.length > 0 ? entries[0].state : null;
  }

  /**
   * Get entries at a specific index
   */
  public getEntriesAtIndex(index: number): HistoryEntry[] {
    if (index < 0 || index >= this.transitions.length) {
      return [];
    }

    const transition = this.transitions[index];
    const entry = Array.from(this.entries.values()).find(
      e => e.transition.id === transition.id
    );

    return entry ? [entry] : [];
  }

  /**
   * Get state at a specific time
   */
  public getStateAtTime(timestamp: Date): unknown | null {
    const targetTime = timestamp.getTime();

    // Find closest entry before or at target time
    let closestEntry: HistoryEntry | null = null;

    for (const entry of this.entries.values()) {
      const entryTime = entry.transition.timestamp.getTime();
      if (entryTime <= targetTime) {
        if (
          !closestEntry ||
          entryTime > closestEntry.transition.timestamp.getTime()
        ) {
          closestEntry = entry;
        }
      }
    }

    return closestEntry?.state || null;
  }

  /**
   * Get state at a specific version
   */
  public getStateAtVersion(version: StateVersion): unknown | null {
    const entry = Array.from(this.entries.values()).find(
      e => e.transition.toState.compare(version) === 0
    );

    return entry?.state || null;
  }

  /**
   * Get history for a specific scope
   */
  public getHistoryByScope(scope: StateScope, limit?: number): HistoryEntry[] {
    const entryIds = this.entriesByScope.get(scope) || [];
    const entries = entryIds.map(id => this.entries.get(id)!).filter(Boolean);

    // Sort by timestamp
    entries.sort(
      (a, b) =>
        a.transition.timestamp.getTime() - b.transition.timestamp.getTime()
    );

    return limit ? entries.slice(-limit) : entries;
  }

  /**
   * Get history within time range
   */
  public getHistoryInTimeRange(start: Date, end: Date): HistoryEntry[] {
    const startTime = start.getTime();
    const endTime = end.getTime();

    return Array.from(this.entries.values()).filter(entry => {
      const time = entry.transition.timestamp.getTime();
      return time >= startTime && time <= endTime;
    });
  }

  /**
   * Filter history based on criteria
   */
  public filterHistory(filters: HistoryFilter[]): HistoryEntry[] {
    let entries = Array.from(this.entries.values());

    for (const filter of filters) {
      entries = entries.filter(entry => this.matchesFilter(entry, filter));
    }

    return entries;
  }

  /**
   * Search history by trigger pattern
   */
  public searchByTrigger(pattern: string | RegExp): HistoryEntry[] {
    const regex =
      typeof pattern === "string" ? new RegExp(pattern, "i") : pattern;

    return Array.from(this.entries.values()).filter(entry =>
      regex.test(entry.transition.trigger)
    );
  }

  /**
   * Search history by actor
   */
  public searchByActor(actor: string): HistoryEntry[] {
    return Array.from(this.entries.values()).filter(
      entry => entry.transition.actor === actor
    );
  }

  /**
   * Search history by changed path
   */
  public searchByPath(path: string): HistoryEntry[] {
    return Array.from(this.entries.values()).filter(entry =>
      entry.transition.changes.some(change => change.path === path)
    );
  }

  /**
   * Compare two states
   */
  public compareStates(
    versionOrIndexA: StateVersion | number,
    versionOrIndexB: StateVersion | number
  ): StateComparison {
    const stateA = this.getStateByVersionOrIndex(versionOrIndexA);
    const stateB = this.getStateByVersionOrIndex(versionOrIndexB);

    if (!stateA || !stateB) {
      throw new Error("One or both versions not found in history");
    }

    const versionA = this.getVersionByVersionOrIndex(versionOrIndexA);
    const versionB = this.getVersionByVersionOrIndex(versionOrIndexB);

    const diff = this.computeDiff(stateA, stateB);
    const changedPaths = Array.from(
      new Set([
        ...Array.from(diff.added.keys()),
        ...Array.from(diff.updated.keys()),
        ...Array.from(diff.deleted.keys()),
      ])
    );

    const changeCount = changedPaths.length;
    const totalKeys = this.countKeys(stateA) + this.countKeys(stateB);
    const similarity =
      totalKeys > 0 ? ((totalKeys - changeCount) / totalKeys) * 100 : 100;

    return {
      versionA,
      versionB,
      diff,
      changeCount,
      changedPaths,
      similarity,
    };
  }

  /**
   * Create timeline visualization
   */
  public createTimeline(startTime?: Date, endTime?: Date): StateTimeline {
    let transitions = this.transitions;

    if (startTime || endTime) {
      transitions = transitions.filter(t => {
        const time = t.timestamp.getTime();
        return (
          (!startTime || time >= startTime.getTime()) &&
          (!endTime || time <= endTime.getTime())
        );
      });
    }

    const snapshots = Array.from(this.snapshots.values());
    const branches = new Set<string>();

    for (const entry of this.entries.values()) {
      if (entry.branch) {
        branches.add(entry.branch);
      }
    }

    return {
      id: generateStateId(),
      transitions,
      snapshots,
      branches: Array.from(branches),
      startTime: transitions[0]?.timestamp || new Date(),
      endTime: transitions[transitions.length - 1]?.timestamp || new Date(),
    };
  }

  /**
   * Create time-travel session
   */
  public createTimeTravelSession(startIndex?: number): TimeTravelSession {
    const session: TimeTravelSession = {
      id: generateStateId(),
      currentPosition: startIndex ?? this.currentIndex,
      entries: Array.from(this.entries.values()),
      bookmarks: new Map(),
      filters: [],
    };

    return session;
  }

  /**
   * Navigate time-travel session
   */
  public navigateSession(
    session: TimeTravelSession,
    direction: "forward" | "backward" | "goto",
    target?: number
  ): unknown | null {
    switch (direction) {
      case "forward":
        session.currentPosition = Math.min(
          session.currentPosition + 1,
          this.transitions.length - 1
        );
        break;
      case "backward":
        session.currentPosition = Math.max(session.currentPosition - 1, 0);
        break;
      case "goto":
        if (target !== undefined) {
          session.currentPosition = Math.max(
            0,
            Math.min(target, this.transitions.length - 1)
          );
        }
        break;
    }

    return this.getStateAtIndex(session.currentPosition);
  }

  /**
   * Add bookmark to time-travel session
   */
  public addBookmark(
    session: TimeTravelSession,
    name: string,
    index?: number
  ): void {
    const position = index ?? session.currentPosition;
    session.bookmarks.set(name, position);
  }

  /**
   * Jump to bookmark in time-travel session
   */
  public jumpToBookmark(
    session: TimeTravelSession,
    name: string
  ): unknown | null {
    const position = session.bookmarks.get(name);
    if (position === undefined) {
      return null;
    }

    session.currentPosition = position;
    return this.getStateAtIndex(position);
  }

  /**
   * Export history to JSON
   */
  public exportHistory(): string {
    return JSON.stringify(
      {
        entries: Array.from(this.entries.values()),
        transitions: this.transitions,
        snapshots: Array.from(this.snapshots.values()),
      },
      this.dateReplacer
    );
  }

  /**
   * Import history from JSON
   */
  public importHistory(json: string): void {
    const data = JSON.parse(json, this.dateReviver);

    this.entries.clear();
    this.transitions.length = 0;
    this.snapshots.clear();
    this.entriesByScope.clear();
    this.entriesByTime.clear();

    for (const entry of data.entries) {
      this.entries.set(entry.id, entry);
    }

    this.transitions.push(...data.transitions);

    for (const snapshot of data.snapshots) {
      this.snapshots.set(snapshot.id, snapshot);
    }

    this.currentIndex = this.transitions.length - 1;

    // Rebuild indexes
    this.rebuildIndexes();
  }

  /**
   * Get statistics
   */
  public getStatistics(): {
    totalEntries: number;
    totalTransitions: number;
    totalSnapshots: number;
    entriesByScope: Record<string, number>;
    timeSpan: { start: Date; end: Date };
  } {
    const entriesByScope: Record<string, number> = {};

    for (const [scope, entryIds] of this.entriesByScope.entries()) {
      entriesByScope[scope] = entryIds.length;
    }

    return {
      totalEntries: this.entries.size,
      totalTransitions: this.transitions.length,
      totalSnapshots: this.snapshots.size,
      entriesByScope,
      timeSpan: {
        start: this.transitions[0]?.timestamp || new Date(),
        end:
          this.transitions[this.transitions.length - 1]?.timestamp ||
          new Date(),
      },
    };
  }

  /**
   * Clear all history
   */
  public clear(): void {
    this.entries.clear();
    this.transitions.length = 0;
    this.snapshots.clear();
    this.entriesByScope.clear();
    this.entriesByTime.clear();
    this.currentIndex = -1;
  }

  // Private helper methods

  private matchesFilter(entry: HistoryEntry, filter: HistoryFilter): boolean {
    if (filter.scope && entry.transition.scope !== filter.scope) {
      return false;
    }

    if (filter.timeRange) {
      const time = entry.transition.timestamp.getTime();
      if (
        time < filter.timeRange.start.getTime() ||
        time > filter.timeRange.end.getTime()
      ) {
        return false;
      }
    }

    if (filter.trigger) {
      const regex =
        typeof filter.trigger === "string"
          ? new RegExp(filter.trigger, "i")
          : filter.trigger;
      if (!regex.test(entry.transition.trigger)) {
        return false;
      }
    }

    if (filter.actor && entry.transition.actor !== filter.actor) {
      return false;
    }

    if (filter.path) {
      if (
        !entry.transition.changes.some(change =>
          change.path.startsWith(filter.path!)
        )
      ) {
        return false;
      }
    }

    if (filter.changeType) {
      if (
        !entry.transition.changes.some(
          change => change.type === filter.changeType
        )
      ) {
        return false;
      }
    }

    return true;
  }

  private computeDiff(stateA: unknown, stateB: unknown): StateDiff {
    const diff: StateDiff = {
      identical: JSON.stringify(stateA) === JSON.stringify(stateB),
      added: new Map(),
      updated: new Map(),
      deleted: new Map(),
      moved: new Map(),
    };

    if (
      typeof stateA !== "object" ||
      typeof stateB !== "object" ||
      !stateA ||
      !stateB
    ) {
      return diff;
    }

    const keysA = Object.keys(stateA);
    const keysB = Object.keys(stateB);

    // Find added keys
    for (const key of keysB) {
      if (!(key in stateA)) {
        diff.added.set(key, (stateB as Record<string, unknown>)[key]);
      }
    }

    // Find deleted keys
    for (const key of keysA) {
      if (!(key in stateB)) {
        diff.deleted.set(key, (stateA as Record<string, unknown>)[key]);
      }
    }

    // Find updated keys
    for (const key of keysB) {
      if (key in stateA) {
        const valueA = (stateA as Record<string, unknown>)[key];
        const valueB = (stateB as Record<string, unknown>)[key];

        if (JSON.stringify(valueA) !== JSON.stringify(valueB)) {
          diff.updated.set(key, { oldValue: valueA, newValue: valueB });
        }
      }
    }

    return diff;
  }

  private countKeys(state: unknown): number {
    if (typeof state !== "object" || !state) {
      return 0;
    }

    let count = 0;
    const countKeys = (obj: unknown): void => {
      if (typeof obj !== "object" || !obj || Array.isArray(obj)) {
        return;
      }

      count += Object.keys(obj).length;

      for (const value of Object.values(obj)) {
        countKeys(value);
      }
    };

    countKeys(state);
    return count;
  }

  private getStateByVersionOrIndex(
    versionOrIndex: StateVersion | number
  ): unknown | null {
    return typeof versionOrIndex === "number"
      ? this.getStateAtIndex(versionOrIndex)
      : this.getStateAtVersion(versionOrIndex);
  }

  private getVersionByVersionOrIndex(
    versionOrIndex: StateVersion | number
  ): StateVersion {
    return typeof versionOrIndex === "number"
      ? this.transitions[versionOrIndex]?.toState || {
          major: 0,
          minor: 0,
          patch: 0,
          toString: () => "0.0.0",
          compare: () => 0,
        }
      : versionOrIndex;
  }

  private async createSnapshotFromState(
    state: unknown,
    version: StateVersion
  ): Promise<StateSnapshot> {
    return {
      id: generateStateId(),
      version,
      timestamp: new Date(),
      scope: "global",
      data: JSON.parse(JSON.stringify(state)),
      checksum: await generateChecksum(state),
    };
  }

  private pruneOldestEntries(): void {
    // Remove oldest entries while maintaining structure
    const entriesArray = Array.from(this.entries.values()).sort(
      (a, b) =>
        a.transition.timestamp.getTime() - b.transition.timestamp.getTime()
    );

    const toRemove = entriesArray.slice(
      0,
      entriesArray.length - this.maxEntries
    );

    for (const entry of toRemove) {
      this.entries.delete(entry.id);

      // Remove from scope index
      for (const [scope, entryIds] of this.entriesByScope.entries()) {
        const index = entryIds.indexOf(entry.id);
        if (index >= 0) {
          entryIds.splice(index, 1);
        }
      }

      // Remove from time index
      const timestamp = entry.transition.timestamp.getTime();
      const timeEntries = this.entriesByTime.get(timestamp);
      if (timeEntries) {
        const index = timeEntries.indexOf(entry.id);
        if (index >= 0) {
          timeEntries.splice(index, 1);
        }
      }
    }

    // Remove orphaned transitions
    this.transitions = this.transitions.filter(t =>
      Array.from(this.entries.values()).some(e => e.transition.id === t.id)
    );
  }

  private rebuildIndexes(): void {
    this.entriesByScope.clear();
    this.entriesByTime.clear();

    for (const entry of this.entries.values()) {
      // Scope index
      const scopeEntries =
        this.entriesByScope.get(entry.transition.scope) || [];
      scopeEntries.push(entry.id);
      this.entriesByScope.set(entry.transition.scope, scopeEntries);

      // Time index
      const timestamp = entry.transition.timestamp.getTime();
      const timeEntries = this.entriesByTime.get(timestamp) || [];
      timeEntries.push(entry.id);
      this.entriesByTime.set(timestamp, timeEntries);
    }
  }

  private dateReplacer(key: string, value: unknown): unknown {
    if (value instanceof Date) {
      return { __type__: "Date", value: value.toISOString() };
    }
    return value;
  }

  private dateReviver(key: string, value: unknown): unknown {
    if (
      typeof value === "object" &&
      value !== null &&
      "__type__" in value &&
      (value as Record<string, unknown>).__type__ === "Date"
    ) {
      return new Date((value as Record<string, unknown>).value as string);
    }
    return value;
  }
}

/**
 * Factory function to create history manager
 */
export function createHistoryManager(maxEntries?: number): StateHistoryManager {
  return new StateHistoryManager(maxEntries);
}

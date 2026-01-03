/**
 * @lsi/state - StateHistory
 *
 * Undo/redo functionality and time-travel debugging
 */

import type { StateSnapshot } from "../core/types.js";
import { deepClone } from "../utils/index.js";

/**
 * History entry
 */
export interface HistoryEntry<T> {
  /** Entry ID */
  id: string;
  /** State at this point */
  state: T;
  /** Timestamp */
  timestamp: number;
  /** Action that caused this state */
  action?: string;
  /** Optional label */
  label?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * History statistics
 */
export interface HistoryStatistics {
  /** Total entries */
  totalEntries: number;
  /** Current position */
  currentPosition: number;
  /** Can undo */
  canUndo: boolean;
  /** Can redo */
  canRedo: boolean;
  /** Memory usage estimate (bytes) */
  memoryUsage: number;
}

/**
 * State History Manager
 *
 * Tracks state changes for undo/redo and time-travel debugging.
 *
 * @example
 * ```typescript
 * const history = new StateHistory<MyState>(50);
 * history.record(currentState, 'user-action');
 * history.undo(); // Returns previous state
 * history.redo(); // Returns next state
 * ```
 */
export class StateHistory<T> {
  protected past: HistoryEntry<T>[];
  protected future: HistoryEntry<T>[];
  protected maxHistory: number;
  protected currentEntry?: HistoryEntry<T>;
  protected snapshots: Map<string, StateSnapshot<T>>;

  /**
   * Create a new StateHistory
   * @param maxHistory Maximum number of history entries to keep
   */
  constructor(maxHistory: number = 50) {
    this.past = [];
    this.future = [];
    this.maxHistory = maxHistory;
    this.snapshots = new Map();
  }

  /**
   * Record a new state
   */
  record(
    state: T,
    action?: string,
    label?: string,
    metadata?: Record<string, unknown>
  ): string {
    // If we have a current state, add it to past
    if (this.currentEntry) {
      this.past.push(deepClone(this.currentEntry));
    }

    // Create new entry
    const entry: HistoryEntry<T> = {
      id: this.generateId(),
      state: deepClone(state),
      timestamp: Date.now(),
      action,
      label,
      metadata,
    };

    this.currentEntry = entry;
    this.future = []; // Clear future on new action

    // Enforce max history size
    this.pruneHistory();

    return entry.id;
  }

  /**
   * Undo to previous state
   */
  undo(currentState: T): T | null {
    if (this.past.length === 0) {
      return null;
    }

    // Push current state to future
    if (this.currentEntry) {
      this.future.push(deepClone(this.currentEntry));
    }

    // Get previous state
    const previous = this.past.pop()!;
    this.currentEntry = previous;

    return deepClone(previous.state);
  }

  /**
   * Redo to next state
   */
  redo(currentState: T): T | null {
    if (this.future.length === 0) {
      return null;
    }

    // Push current state to past
    if (this.currentEntry) {
      this.past.push(deepClone(this.currentEntry));
    }

    // Get next state
    const next = this.future.pop()!;
    this.currentEntry = next;

    return deepClone(next.state);
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.past.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.future.length > 0;
  }

  /**
   * Get state at a specific index
   */
  getStateAtIndex(index: number): T | null {
    if (index < 0 || index >= this.past.length) {
      return null;
    }
    return deepClone(this.past[index].state);
  }

  /**
   * Get all history entries
   */
  getHistory(): HistoryEntry<T>[] {
    return [...this.past, this.currentEntry, ...this.future].filter(
      Boolean
    ) as HistoryEntry<T>[];
  }

  /**
   * Get past entries
   */
  getPast(): HistoryEntry<T>[] {
    return [...this.past];
  }

  /**
   * Get future entries
   */
  getFuture(): HistoryEntry<T>[] {
    return [...this.future];
  }

  /**
   * Get current entry
   */
  getCurrent(): HistoryEntry<T> | undefined {
    return this.currentEntry;
  }

  /**
   * Create a named snapshot
   */
  createSnapshot(
    state: T,
    label: string,
    metadata?: Record<string, unknown>
  ): StateSnapshot<T> {
    const snapshot: StateSnapshot<T> = {
      id: this.generateId(),
      state: deepClone(state),
      timestamp: Date.now(),
      label,
      metadata,
    };

    this.snapshots.set(snapshot.id, snapshot);
    return snapshot;
  }

  /**
   * Get a snapshot by ID
   */
  getSnapshot(id: string): StateSnapshot<T> | undefined {
    return this.snapshots.get(id);
  }

  /**
   * Get all snapshots
   */
  getSnapshots(): StateSnapshot<T>[] {
    return Array.from(this.snapshots.values());
  }

  /**
   * Delete a snapshot
   */
  deleteSnapshot(id: string): boolean {
    return this.snapshots.delete(id);
  }

  /**
   * Jump to a specific snapshot
   */
  jumpToSnapshot(id: string): T | null {
    const snapshot = this.snapshots.get(id);
    if (!snapshot) {
      return null;
    }

    // Save current state to past
    if (this.currentEntry) {
      this.past.push(deepClone(this.currentEntry));
    }

    // Create new entry from snapshot
    this.currentEntry = {
      id: this.generateId(),
      state: deepClone(snapshot.state),
      timestamp: Date.now(),
      action: "snapshot",
      label: `Jump to: ${snapshot.label || id}`,
    };

    this.future = [];

    return deepClone(snapshot.state);
  }

  /**
   * Get history statistics
   */
  getStatistics(): HistoryStatistics {
    const totalEntries =
      this.past.length + this.future.length + (this.currentEntry ? 1 : 0);

    return {
      totalEntries,
      currentPosition: this.past.length,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.past = [];
    this.future = [];
    this.currentEntry = undefined;
  }

  /**
   * Clear snapshots
   */
  clearSnapshots(): void {
    this.snapshots.clear();
  }

  /**
   * Set max history size
   */
  setMaxHistory(max: number): void {
    this.maxHistory = max;
    this.pruneHistory();
  }

  /**
   * Export history to JSON
   */
  export(): string {
    const data = {
      past: this.past,
      current: this.currentEntry,
      future: this.future,
      snapshots: Array.from(this.snapshots.entries()),
    };
    return JSON.stringify(data);
  }

  /**
   * Import history from JSON
   */
  import(json: string): void {
    const data = JSON.parse(json);
    this.past = data.past || [];
    this.currentEntry = data.current;
    this.future = data.future || [];
    this.snapshots = new Map(data.snapshots || []);
  }

  /**
   * Search history by label
   */
  searchByLabel(query: string): HistoryEntry<T>[] {
    const lowerQuery = query.toLowerCase();
    return this.getHistory().filter(entry =>
      entry.label?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Search history by action
   */
  searchByAction(query: string): HistoryEntry<T>[] {
    const lowerQuery = query.toLowerCase();
    return this.getHistory().filter(entry =>
      entry.action?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get entries in time range
   */
  getEntriesInTimeRange(startTime: number, endTime: number): HistoryEntry<T>[] {
    return this.getHistory().filter(
      entry => entry.timestamp >= startTime && entry.timestamp <= endTime
    );
  }

  // Protected methods

  /**
   * Prune history to max size
   */
  protected pruneHistory(): void {
    while (this.past.length > this.maxHistory) {
      this.past.shift();
    }

    while (this.future.length > this.maxHistory) {
      this.future.shift();
    }
  }

  /**
   * Estimate memory usage
   */
  protected estimateMemoryUsage(): number {
    const estimateSize = (obj: unknown): number => {
      if (obj === null || obj === undefined) return 0;
      if (typeof obj !== "object") return String(obj).length;

      if (Array.isArray(obj)) {
        return obj.reduce((sum, item) => sum + estimateSize(item), 0);
      }

      return Object.entries(obj).reduce((sum, [key, value]) => {
        return sum + key.length + estimateSize(value);
      }, 0);
    };

    let total = 0;
    for (const entry of this.past) {
      total += estimateSize(entry);
    }
    for (const entry of this.future) {
      total += estimateSize(entry);
    }
    if (this.currentEntry) {
      total += estimateSize(this.currentEntry);
    }

    return total;
  }

  /**
   * Generate unique ID
   */
  protected generateId(): string {
    return `hist_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }
}

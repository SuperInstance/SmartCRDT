/**
 * State Inspector for LangGraph
 *
 * Provides tools for viewing, comparing, searching, and analyzing
 * state changes during agent workflow execution.
 */

import type {
  StateSnapshot,
  StateComparison,
  ExecutionTrace,
  DebugSession,
} from "./types.js";

/**
 * State change record
 */
interface StateChange {
  key: string;
  timestamp: number;
  oldValue: unknown;
  newValue: unknown;
  changeType: "added" | "removed" | "modified";
}

/**
 * Search result for state queries
 */
interface StateSearchResult {
  snapshot_id: string;
  timestamp: number;
  key: string;
  value: unknown;
  path: string;
}

/**
 * State Inspector Class
 *
 * Provides inspection capabilities for graph execution state.
 */
export class StateInspector {
  private stateHistory: Map<string, StateSnapshot[]> = new Map();
  private changeHistory: Map<string, StateChange[]> = new Map();

  /**
   * Add a state snapshot to the history
   */
  addSnapshot(sessionId: string, snapshot: StateSnapshot): void {
    const history = this.stateHistory.get(sessionId) ?? [];
    history.push(snapshot);
    this.stateHistory.set(sessionId, history);

    // Track changes
    this.trackChanges(sessionId, snapshot);
  }

  /**
   * Track state changes from a snapshot
   */
  private trackChanges(sessionId: string, snapshot: StateSnapshot): void {
    const history = this.stateHistory.get(sessionId) ?? [];
    const changes = this.changeHistory.get(sessionId) ?? [];

    if (history.length > 1) {
      const prevSnapshot = history[history.length - 2];
      const comparison = this.compareSnapshots(prevSnapshot, snapshot);

      for (const key of comparison.added_keys) {
        changes.push({
          key,
          timestamp: snapshot.timestamp,
          oldValue: undefined,
          newValue: this.getNestedValue(snapshot.state, key),
          changeType: "added",
        });
      }

      for (const key of comparison.removed_keys) {
        changes.push({
          key,
          timestamp: snapshot.timestamp,
          oldValue: this.getNestedValue(prevSnapshot.state, key),
          newValue: undefined,
          changeType: "removed",
        });
      }

      for (const [key, diff] of Object.entries(comparison.changed_keys)) {
        changes.push({
          key,
          timestamp: snapshot.timestamp,
          oldValue: diff.old,
          newValue: diff.new,
          changeType: "modified",
        });
      }
    }

    this.changeHistory.set(sessionId, changes);
  }

  /**
   * Get current state for a session
   */
  getCurrentState(sessionId: string): Record<string, unknown> | null {
    const history = this.stateHistory.get(sessionId);
    if (!history || history.length === 0) {
      return null;
    }
    return history[history.length - 1].state;
  }

  /**
   * Get state at a specific timestamp
   */
  getStateAt(
    sessionId: string,
    timestamp: number
  ): Record<string, unknown> | null {
    const history = this.stateHistory.get(sessionId);
    if (!history) {
      return null;
    }

    // Find the snapshot closest to the timestamp
    let closest: StateSnapshot | null = null;
    let minDiff = Infinity;

    for (const snapshot of history) {
      const diff = Math.abs(snapshot.timestamp - timestamp);
      if (diff < minDiff) {
        minDiff = diff;
        closest = snapshot;
      }
    }

    return closest?.state ?? null;
  }

  /**
   * Get state at a specific snapshot
   */
  getStateAtSnapshot(
    sessionId: string,
    snapshotId: string
  ): Record<string, unknown> | null {
    const history = this.stateHistory.get(sessionId);
    if (!history) {
      return null;
    }

    const snapshot = history.find(s => s.snapshot_id === snapshotId);
    return snapshot?.state ?? null;
  }

  /**
   * Get state history for a session
   */
  getStateHistory(sessionId: string): StateSnapshot[] {
    return this.stateHistory.get(sessionId) ?? [];
  }

  /**
   * Get state change history for a session
   */
  getChangeHistory(sessionId: string): StateChange[] {
    return this.changeHistory.get(sessionId) ?? [];
  }

  /**
   * Get changes for a specific key
   */
  getChangesForKey(sessionId: string, key: string): StateChange[] {
    const changes = this.changeHistory.get(sessionId) ?? [];
    return changes.filter(c => c.key === key || c.key.startsWith(`${key}.`));
  }

  /**
   * Compare two state snapshots
   */
  compareSnapshots(
    snapshot1: StateSnapshot,
    snapshot2: StateSnapshot
  ): StateComparison {
    const state1 = snapshot1.state;
    const state2 = snapshot2.state;

    const keys1 = this.getAllKeys(state1);
    const keys2 = this.getAllKeys(state2);

    const allKeys = new Set([...keys1, ...keys2]);
    const added_keys: string[] = [];
    const removed_keys: string[] = [];
    const changed_keys: Record<string, { old: unknown; new: unknown }> = {};
    const unchanged_keys: string[] = [];

    for (const key of allKeys) {
      const value1 = this.getNestedValue(state1, key);
      const value2 = this.getNestedValue(state2, key);

      if (value1 === undefined && value2 !== undefined) {
        added_keys.push(key);
      } else if (value1 !== undefined && value2 === undefined) {
        removed_keys.push(key);
      } else if (!this.deepEqual(value1, value2)) {
        changed_keys[key] = { old: value1, new: value2 };
      } else {
        unchanged_keys.push(key);
      }
    }

    return {
      comparison_id: `comp_${Date.now()}`,
      state1: snapshot1,
      state2: snapshot2,
      added_keys,
      removed_keys,
      changed_keys,
      unchanged_keys,
    };
  }

  /**
   * Get all nested keys from an object
   */
  private getAllKeys(obj: Record<string, unknown>, prefix = ""): string[] {
    const keys: string[] = [];

    for (const key of Object.keys(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      keys.push(fullKey);

      const value = obj[key];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        keys.push(
          ...this.getAllKeys(value as Record<string, unknown>, fullKey)
        );
      }
    }

    return keys;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split(".");
    let value: unknown = obj;

    for (const part of parts) {
      if (value && typeof value === "object") {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Deep equality check for two values
   */
  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) {
      return true;
    }

    if (a === null || b === null || a === undefined || b === undefined) {
      return false;
    }

    if (typeof a !== typeof b) {
      return false;
    }

    if (typeof a !== "object") {
      return false;
    }

    if (Array.isArray(a) !== Array.isArray(b)) {
      return false;
    }

    if (Array.isArray(a)) {
      if (a.length !== b.length) {
        return false;
      }
      for (let i = 0; i < a.length; i++) {
        if (!this.deepEqual(a[i], (b as unknown[])[i])) {
          return false;
        }
      }
      return true;
    }

    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;

    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);

    if (keysA.length !== keysB.length) {
      return false;
    }

    for (const key of keysA) {
      if (!keysB.includes(key)) {
        return false;
      }
      if (!this.deepEqual(objA[key], objB[key])) {
        return false;
      }
    }

    return true;
  }

  /**
   * Search state values by key pattern or value
   */
  searchState(
    sessionId: string,
    query: {
      keyPattern?: string;
      value?: unknown;
      valueType?: string;
      timeRange?: { start: number; end: number };
    }
  ): StateSearchResult[] {
    const history = this.stateHistory.get(sessionId) ?? [];
    const results: StateSearchResult[] = [];

    for (const snapshot of history) {
      // Filter by time range
      if (
        query.timeRange &&
        (snapshot.timestamp < query.timeRange.start ||
          snapshot.timestamp > query.timeRange.end)
      ) {
        continue;
      }

      const keys = this.getAllKeys(snapshot.state);

      for (const key of keys) {
        // Filter by key pattern
        if (query.keyPattern && !this.matchPattern(key, query.keyPattern)) {
          continue;
        }

        const value = this.getNestedValue(snapshot.state, key);

        // Filter by value
        if (query.value !== undefined && !this.deepEqual(value, query.value)) {
          continue;
        }

        // Filter by value type
        if (query.valueType && typeof value !== query.valueType) {
          continue;
        }

        results.push({
          snapshot_id: snapshot.snapshot_id,
          timestamp: snapshot.timestamp,
          key,
          value,
          path: key,
        });
      }
    }

    return results;
  }

  /**
   * Match key against a pattern (supports wildcards)
   */
  private matchPattern(key: string, pattern: string): boolean {
    const regex = new RegExp(
      "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$"
    );
    return regex.test(key);
  }

  /**
   * Get state value at a path
   */
  getValue(
    sessionId: string,
    path: string,
    snapshotId?: string
  ): unknown | null {
    const history = this.stateHistory.get(sessionId);
    if (!history) {
      return null;
    }

    let snapshot: StateSnapshot | undefined;

    if (snapshotId) {
      snapshot = history.find(s => s.snapshot_id === snapshotId);
    } else {
      snapshot = history[history.length - 1];
    }

    if (!snapshot) {
      return null;
    }

    return this.getNestedValue(snapshot.state, path);
  }

  /**
   * Set a state value (for debugging purposes)
   */
  setValue(sessionId: string, path: string, value: unknown): boolean {
    const history = this.stateHistory.get(sessionId);
    if (!history || history.length === 0) {
      return false;
    }

    const snapshot = history[history.length - 1];
    const parts = path.split(".");
    let obj: Record<string, unknown> = snapshot.state;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in obj)) {
        obj[part] = {};
      }
      obj = obj[part] as Record<string, unknown>;
    }

    obj[parts[parts.length - 1]] = value;
    snapshot.changed_keys.push(path);

    return true;
  }

  /**
   * Get state diff as a readable string
   */
  diffToString(comparison: StateComparison): string {
    const lines: string[] = [];

    lines.push(
      `Comparison: ${comparison.state1.snapshot_id} -> ${comparison.state2.snapshot_id}`
    );
    lines.push("");

    if (comparison.added_keys.length > 0) {
      lines.push("Added keys:");
      for (const key of comparison.added_keys) {
        lines.push(
          `  + ${key}: ${JSON.stringify(this.getNestedValue(comparison.state2.state, key))}`
        );
      }
      lines.push("");
    }

    if (comparison.removed_keys.length > 0) {
      lines.push("Removed keys:");
      for (const key of comparison.removed_keys) {
        lines.push(
          `  - ${key}: ${JSON.stringify(this.getNestedValue(comparison.state1.state, key))}`
        );
      }
      lines.push("");
    }

    if (Object.keys(comparison.changed_keys).length > 0) {
      lines.push("Changed keys:");
      for (const [key, diff] of Object.entries(comparison.changed_keys)) {
        lines.push(`  ~ ${key}:`);
        lines.push(`      old: ${JSON.stringify(diff.old)}`);
        lines.push(`      new: ${JSON.stringify(diff.new)}`);
      }
      lines.push("");
    }

    if (comparison.unchanged_keys.length > 0) {
      lines.push(`Unchanged keys: ${comparison.unchanged_keys.length}`);
    }

    return lines.join("\n");
  }

  /**
   * Export state history as JSON
   */
  exportStateHistory(sessionId: string): string {
    const history = this.stateHistory.get(sessionId) ?? [];
    return JSON.stringify(history, null, 2);
  }

  /**
   * Export change history as JSON
   */
  exportChangeHistory(sessionId: string): string {
    const changes = this.changeHistory.get(sessionId) ?? [];
    return JSON.stringify(changes, null, 2);
  }

  /**
   * Get state statistics for a session
   */
  getStateStatistics(sessionId: string): {
    snapshotCount: number;
    changeCount: number;
    keyCount: number;
    mostChangedKeys: Array<{ key: string; count: number }>;
  } | null {
    const history = this.stateHistory.get(sessionId);
    const changes = this.changeHistory.get(sessionId);

    if (!history || !changes) {
      return null;
    }

    const keyChangeCounts = new Map<string, number>();
    for (const change of changes) {
      const count = keyChangeCounts.get(change.key) ?? 0;
      keyChangeCounts.set(change.key, count + 1);
    }

    const mostChangedKeys = Array.from(keyChangeCounts.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const keyCount =
      history.length > 0 ? this.getAllKeys(history[0].state).length : 0;

    return {
      snapshotCount: history.length,
      changeCount: changes.length,
      keyCount,
      mostChangedKeys,
    };
  }

  /**
   * Clear history for a session
   */
  clearHistory(sessionId: string): void {
    this.stateHistory.delete(sessionId);
    this.changeHistory.delete(sessionId);
  }

  /**
   * Get state transitions as a timeline
   */
  getStateTransitions(sessionId: string): Array<{
    timestamp: number;
    key: string;
    oldValue: unknown;
    newValue: unknown;
  }> {
    const changes = this.changeHistory.get(sessionId) ?? [];

    return changes
      .filter(c => c.changeType !== "removed")
      .map(c => ({
        timestamp: c.timestamp,
        key: c.key,
        oldValue: c.oldValue,
        newValue: c.newValue,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Restore state from a snapshot
   */
  restoreState(
    sessionId: string,
    snapshotId: string
  ): Record<string, unknown> | null {
    const history = this.stateHistory.get(sessionId);
    if (!history) {
      return null;
    }

    const snapshot = history.find(s => s.snapshot_id === snapshotId);
    return snapshot ? { ...snapshot.state } : null;
  }

  /**
   * Watch a state key for changes
   */
  watchKey(
    sessionId: string,
    key: string,
    callback: (change: StateChange) => void
  ): () => void {
    const changes = this.changeHistory.get(sessionId) ?? [];

    const checkChanges = () => {
      const currentChanges = this.changeHistory.get(sessionId) ?? [];
      const newChanges = currentChanges.slice(changes.length);

      for (const change of newChanges) {
        if (change.key === key || change.key.startsWith(`${key}.`)) {
          callback(change);
        }
      }

      changes.length = 0;
      changes.push(...currentChanges);
    };

    // Set up interval to check for changes
    const intervalId = setInterval(checkChanges, 100);

    // Return unsubscribe function
    return () => clearInterval(intervalId);
  }

  /**
   * Get state value history over time
   */
  getValueHistory(
    sessionId: string,
    key: string
  ): Array<{
    timestamp: number;
    value: unknown;
  }> {
    const history = this.stateHistory.get(sessionId) ?? [];
    const valueHistory: Array<{ timestamp: number; value: unknown }> = [];

    for (const snapshot of history) {
      const value = this.getNestedValue(snapshot.state, key);
      if (value !== undefined) {
        valueHistory.push({
          timestamp: snapshot.timestamp,
          value,
        });
      }
    }

    return valueHistory;
  }

  /**
   * Validate state against a schema
   */
  validateState(
    state: Record<string, unknown>,
    schema: Record<string, { type: string; required?: boolean }>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [key, def] of Object.entries(schema)) {
      const value = state[key];

      if (def.required && value === undefined) {
        errors.push(`Required key '${key}' is missing`);
        continue;
      }

      if (value !== undefined && typeof value !== def.type) {
        errors.push(
          `Key '${key}' should be type '${def.type}' but is '${typeof value}'`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Clone state for snapshot
   */
  cloneState(state: Record<string, unknown>): Record<string, unknown> {
    return JSON.parse(JSON.stringify(state));
  }

  /**
   * Merge two states
   */
  mergeStates(
    base: Record<string, unknown>,
    overlay: Record<string, unknown>
  ): Record<string, unknown> {
    return {
      ...base,
      ...overlay,
    };
  }
}

/**
 * Variable Watcher for LangGraph Debugging
 *
 * Monitors state variables for changes and provides notification
 * when watched values are modified.
 */

import type { VariableWatch, StateSnapshot, DebugSession } from "./types.js";

/**
 * Variable change notification
 */
interface VariableChange {
  watchId: string;
  variablePath: string;
  timestamp: number;
  oldValue: unknown;
  newValue: unknown;
  snapshotId: string;
}

/**
 * Watch callback function type
 */
type WatchCallback = (change: VariableChange) => void | Promise<void>;

/**
 * Evaluation context for expressions
 */
interface EvaluationContext {
  state: Record<string, unknown>;
  timestamp: number;
  traceId: string;
  nodeName: string | undefined;
}

/**
 * Variable Watcher Class
 *
 * Monitors state variables and triggers callbacks on changes.
 */
export class VariableWatcher {
  private watches: Map<string, VariableWatch> = new Map();
  private watchCounter = 0;
  private callbacks: Map<string, WatchCallback[]> = new Map();
  private previousState: Map<string, Record<string, unknown>> = new Map();
  private changeHistory: Map<string, VariableChange[]> = new Map();

  /**
   * Add a watch for a variable
   */
  addWatch(options: {
    variablePath: string;
    condition?: string;
    notifyOnChange?: boolean;
  }): VariableWatch {
    const watch: VariableWatch = {
      watch_id: `watch_${++this.watchCounter}`,
      variable_path: options.variablePath,
      condition: options.condition,
      enabled: true,
      notify_on_change: options.notifyOnChange ?? true,
      value_history: [],
      created_at: Date.now(),
    };

    this.watches.set(watch.watch_id, watch);
    return watch;
  }

  /**
   * Remove a watch
   */
  removeWatch(watchId: string): boolean {
    this.callbacks.delete(watchId);
    return this.watches.delete(watchId);
  }

  /**
   * Enable a watch
   */
  enableWatch(watchId: string): boolean {
    const watch = this.watches.get(watchId);
    if (watch) {
      watch.enabled = true;
      return true;
    }
    return false;
  }

  /**
   * Disable a watch
   */
  disableWatch(watchId: string): boolean {
    const watch = this.watches.get(watchId);
    if (watch) {
      watch.enabled = false;
      return true;
    }
    return false;
  }

  /**
   * Get a watch by ID
   */
  getWatch(watchId: string): VariableWatch | undefined {
    return this.watches.get(watchId);
  }

  /**
   * Get all watches
   */
  getAllWatches(): VariableWatch[] {
    return Array.from(this.watches.values());
  }

  /**
   * Get watches for a variable path
   */
  getWatchesForPath(variablePath: string): VariableWatch[] {
    return Array.from(this.watches.values()).filter(
      w => w.variable_path === variablePath && w.enabled
    );
  }

  /**
   * Register a callback for a watch
   */
  onWatchChanged(watchId: string, callback: WatchCallback): void {
    const callbacks = this.callbacks.get(watchId) ?? [];
    callbacks.push(callback);
    this.callbacks.set(watchId, callbacks);
  }

  /**
   * Check state for watched variable changes
   */
  async checkWatches(
    sessionId: string,
    currentState: Record<string, unknown>,
    snapshot: StateSnapshot
  ): Promise<VariableChange[]> {
    const previousState = this.previousState.get(sessionId) ?? {};
    const changes: VariableChange[] = [];

    for (const watch of this.watches.values()) {
      if (!watch.enabled) {
        continue;
      }

      const newValue = this.getNestedValue(currentState, watch.variable_path);
      const oldValue = this.getNestedValue(previousState, watch.variable_path);

      // Check for change
      const hasChanged = !this.deepEqual(oldValue, newValue);

      if (hasChanged && watch.notify_on_change) {
        // Check condition if present
        let shouldNotify = true;
        if (watch.condition) {
          shouldNotify = this.evaluateCondition(
            watch.condition,
            {
              state: currentState,
              timestamp: snapshot.timestamp,
              traceId: snapshot.graph_id,
              nodeName: undefined,
            },
            newValue
          );
        }

        if (shouldNotify) {
          // Update value history
          watch.value_history.push({
            timestamp: snapshot.timestamp,
            value: newValue,
          });

          // Limit history size
          if (watch.value_history.length > 1000) {
            watch.value_history.shift();
          }

          const change: VariableChange = {
            watchId: watch.watch_id,
            variablePath: watch.variable_path,
            timestamp: snapshot.timestamp,
            oldValue,
            newValue,
            snapshotId: snapshot.snapshot_id,
          };

          changes.push(change);

          // Record change in history
          const history = this.changeHistory.get(sessionId) ?? [];
          history.push(change);
          this.changeHistory.set(sessionId, history);

          // Trigger callbacks
          const callbacks = this.callbacks.get(watch.watch_id) ?? [];
          for (const callback of callbacks) {
            await callback(change);
          }
        }
      }
    }

    // Update previous state
    this.previousState.set(sessionId, { ...currentState });

    return changes;
  }

  /**
   * Evaluate a watch condition
   */
  private evaluateCondition(
    condition: string,
    context: EvaluationContext,
    currentValue: unknown
  ): boolean {
    try {
      const func = new Function(
        "state",
        "timestamp",
        "traceId",
        "nodeName",
        "value",
        `return ${condition}`
      );

      return func(
        context.state,
        context.timestamp,
        context.traceId,
        context.nodeName,
        currentValue
      );
    } catch (error) {
      console.error(`Error evaluating watch condition: ${condition}`, error);
      return false;
    }
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
   * Deep equality check
   */
  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;

    if (typeof a === "object") {
      const objA = a as Record<string, unknown>;
      const objB = b as Record<string, unknown>;
      const keysA = Object.keys(objA);
      const keysB = Object.keys(objB);

      if (keysA.length !== keysB.length) return false;

      for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!this.deepEqual(objA[key], objB[key])) return false;
      }

      return true;
    }

    return false;
  }

  /**
   * Get value history for a watch
   */
  getValueHistory(
    watchId: string
  ): Array<{ timestamp: number; value: unknown }> {
    const watch = this.watches.get(watchId);
    return watch?.value_history ?? [];
  }

  /**
   * Get current value for a watched variable
   */
  getCurrentValue(sessionId: string, variablePath: string): unknown {
    const state = this.previousState.get(sessionId);
    if (!state) {
      return undefined;
    }
    return this.getNestedValue(state, variablePath);
  }

  /**
   * Get change history for a session
   */
  getChangeHistory(sessionId: string): VariableChange[] {
    return this.changeHistory.get(sessionId) ?? [];
  }

  /**
   * Get changes for a specific watch
   */
  getChangesForWatch(watchId: string, sessionId?: string): VariableChange[] {
    if (sessionId) {
      const history = this.changeHistory.get(sessionId) ?? [];
      return history.filter(c => c.watchId === watchId);
    }

    const allChanges: VariableChange[] = [];
    for (const history of this.changeHistory.values()) {
      allChanges.push(...history.filter(c => c.watchId === watchId));
    }
    return allChanges;
  }

  /**
   * Watch an expression
   */
  watchExpression(
    expression: string,
    evaluateFn: (state: Record<string, unknown>) => unknown
  ): VariableWatch {
    // Create a special watch that evaluates an expression
    const watch = this.addWatch({
      variablePath: expression,
      notifyOnChange: true,
    });

    // The expression evaluation is handled by the caller
    return watch;
  }

  /**
   * Evaluate and update all watches
   */
  async evaluateAllWatches(
    sessionId: string,
    state: Record<string, unknown>,
    snapshot: StateSnapshot
  ): Promise<Map<string, unknown>> {
    const values = new Map<string, unknown>();

    for (const watch of this.watches.values()) {
      if (!watch.enabled) {
        continue;
      }

      const value = this.getNestedValue(state, watch.variable_path);
      values.set(watch.watch_id, value);

      // Check if value changed
      const lastEntry = watch.value_history[watch.value_history.length - 1];
      if (lastEntry && !this.deepEqual(lastEntry.value, value)) {
        await this.checkWatches(sessionId, state, snapshot);
      }
    }

    return values;
  }

  /**
   * Find watches that match a pattern
   */
  findWatchesByPattern(pattern: string): VariableWatch[] {
    const regex = new RegExp(pattern.replace(/\*/g, ".*"));
    return Array.from(this.watches.values()).filter(w =>
      regex.test(w.variable_path)
    );
  }

  /**
   * Clear all watches
   */
  clearAllWatches(): void {
    this.watches.clear();
    this.callbacks.clear();
    this.watchCounter = 0;
  }

  /**
   * Clear change history
   */
  clearChangeHistory(sessionId?: string): void {
    if (sessionId) {
      this.changeHistory.delete(sessionId);
    } else {
      this.changeHistory.clear();
    }
  }

  /**
   * Clear value history for a watch
   */
  clearValueHistory(watchId: string): boolean {
    const watch = this.watches.get(watchId);
    if (watch) {
      watch.value_history = [];
      return true;
    }
    return false;
  }

  /**
   * Disable all watches
   */
  disableAllWatches(): void {
    for (const watch of this.watches.values()) {
      watch.enabled = false;
    }
  }

  /**
   * Enable all watches
   */
  enableAllWatches(): void {
    for (const watch of this.watches.values()) {
      watch.enabled = true;
    }
  }

  /**
   * Get watch statistics
   */
  getStatistics(): {
    total: number;
    enabled: number;
    disabled: number;
    totalChanges: number;
    avgHistorySize: number;
  } {
    const watches = Array.from(this.watches.values());
    const totalChanges = Array.from(this.changeHistory.values()).reduce(
      (sum, history) => sum + history.length,
      0
    );
    const avgHistorySize =
      watches.length > 0
        ? watches.reduce((sum, w) => sum + w.value_history.length, 0) /
          watches.length
        : 0;

    return {
      total: watches.length,
      enabled: watches.filter(w => w.enabled).length,
      disabled: watches.filter(w => !w.enabled).length,
      totalChanges,
      avgHistorySize,
    };
  }

  /**
   * Export watches as JSON
   */
  exportWatches(): string {
    return JSON.stringify(Array.from(this.watches.values()), null, 2);
  }

  /**
   * Import watches from JSON
   */
  importWatches(jsonData: string): VariableWatch[] {
    const imported = JSON.parse(jsonData) as VariableWatch[];
    const watches: VariableWatch[] = [];

    for (const watch of imported) {
      const newWatch: VariableWatch = {
        ...watch,
        watch_id: `watch_${++this.watchCounter}`,
        value_history: [],
        created_at: Date.now(),
      };
      this.watches.set(newWatch.watch_id, newWatch);
      watches.push(newWatch);
    }

    return watches;
  }

  /**
   * Validate watch configuration
   */
  validateWatch(watch: VariableWatch): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!watch.variable_path || watch.variable_path.trim() === "") {
      errors.push("Variable path cannot be empty");
    }

    if (watch.condition) {
      try {
        new Function("return " + watch.condition);
      } catch (error) {
        errors.push(`Invalid condition: ${watch.condition}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create watch from expression
   */
  createWatchFromExpression(expression: string): VariableWatch | null {
    // Parse expressions like "watch state.variable" or "watch state.variable when condition"
    const match = expression.match(/watch\s+(\S+)(?:\s+when\s+(.+))?/i);

    if (!match) {
      return null;
    }

    const variablePath = match[1];
    const condition = match[2];

    return this.addWatch({
      variablePath,
      condition,
    });
  }

  /**
   * Remove callback for a watch
   */
  removeCallback(watchId: string, callback: WatchCallback): boolean {
    const callbacks = this.callbacks.get(watchId);
    if (!callbacks) {
      return false;
    }

    const index = callbacks.indexOf(callback);
    if (index >= 0) {
      callbacks.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Remove all callbacks for a watch
   */
  clearCallbacks(watchId: string): boolean {
    return this.callbacks.delete(watchId);
  }

  /**
   * Get watch trend over time
   */
  getWatchTrend(
    watchId: string,
    bucketSizeMs = 1000
  ): Array<{
    timestamp: number;
    value: unknown;
    changeCount: number;
  }> {
    const watch = this.watches.get(watchId);
    if (!watch || watch.value_history.length === 0) {
      return [];
    }

    const trends: Array<{
      timestamp: number;
      value: unknown;
      changeCount: number;
    }> = [];

    const history = watch.value_history;
    let currentBucket =
      Math.floor(history[0].timestamp / bucketSizeMs) * bucketSizeMs;
    let bucketChanges = 0;
    let lastValue: unknown = null;

    for (const entry of history) {
      const bucket = Math.floor(entry.timestamp / bucketSizeMs) * bucketSizeMs;

      if (bucket !== currentBucket) {
        trends.push({
          timestamp: currentBucket,
          value: lastValue,
          changeCount: bucketChanges,
        });
        currentBucket = bucket;
        bucketChanges = 0;
      }

      bucketChanges++;
      lastValue = entry.value;
    }

    // Add last bucket
    trends.push({
      timestamp: currentBucket,
      value: lastValue,
      changeCount: bucketChanges,
    });

    return trends;
  }

  /**
   * Clone a watch
   */
  cloneWatch(watchId: string): VariableWatch | null {
    const original = this.watches.get(watchId);
    if (!original) {
      return null;
    }

    const cloned: VariableWatch = {
      ...original,
      watch_id: `watch_${++this.watchCounter}`,
      value_history: [],
      created_at: Date.now(),
    };

    this.watches.set(cloned.watch_id, cloned);
    return cloned;
  }

  /**
   * Get watches that haven't been triggered
   */
  findIdleWatches(): VariableWatch[] {
    return Array.from(this.watches.values()).filter(
      w => w.value_history.length === 0 && w.enabled
    );
  }

  /**
   * Get frequently changing watches
   */
  findFrequentlyChangingWatches(threshold = 10): VariableWatch[] {
    return Array.from(this.watches.values()).filter(
      w => w.value_history.length >= threshold
    );
  }
}

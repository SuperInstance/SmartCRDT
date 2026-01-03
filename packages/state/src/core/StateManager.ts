/**
 * @lsi/state - StateManager
 *
 * Generic state manager with immutable updates and change events
 * Base class for all state management in Aequor Platform
 */

import { EventEmitter } from "eventemitter3";
import type {
  StateChangeEvent,
  StateListener,
  Unsubscribe,
  StateManagerConfig,
  StateSnapshot,
} from "./types.js";
import { deepClone, deepEqual } from "../utils/index.js";

/**
 * Generic State Manager
 *
 * Provides immutable state management with change events.
 * Can be extended by any class that needs state management.
 *
 * @example
 * ```typescript
 * interface MyState {
 *   count: number;
 *   name: string;
 * }
 *
 * class MyManager extends StateManager<MyState> {
 *   constructor(initialState: MyState) {
 *     super(initialState);
 *   }
 * }
 *
 * const manager = new MyManager({ count: 0, name: 'test' });
 * manager.subscribe((event) => {
 *   console.log('State changed:', event.current);
 * });
 * manager.set('count', 1); // Triggers event
 * ```
 */
export class StateManager<T extends Record<string, unknown>> {
  protected state: T;
  protected config: Required<StateManagerConfig>;
  protected emitter: EventEmitter;
  protected listeners: Map<string, Set<StateListener<T>>>;
  protected initialState: T;
  protected changeHistory: StateChangeEvent<T>[];

  /**
   * Create a new StateManager
   */
  constructor(initialState: T, config: StateManagerConfig = {}) {
    this.initialState = deepClone(initialState);
    this.state = deepClone(initialState);
    this.config = {
      debug: config.debug ?? false,
      enableFreezing: config.enableFreezing ?? false,
      maxHistory: config.maxHistory ?? 100,
      persistenceKey: config.persistenceKey ?? "state",
    };
    this.emitter = new EventEmitter();
    this.listeners = new Map();
    this.changeHistory = [];

    if (this.config.debug) {
      this.log("StateManager created", { initialState, config: this.config });
    }
  }

  /**
   * Get current state (immutable copy)
   */
  getState(): T {
    return deepClone(this.state);
  }

  /**
   * Get a specific key from state
   */
  get<K extends keyof T>(key: K): T[K] {
    const value = this.state[key];
    return deepClone(value);
  }

  /**
   * Get a value by path (dot notation)
   */
  getByPath(path: string): unknown {
    return this.getNestedValue(this.state, path);
  }

  /**
   * Update entire state (immutable)
   */
  set(newState: T): void;

  /**
   * Update a specific key (immutable)
   */
  set<K extends keyof T>(key: K, value: T[K]): void;

  /**
   * Update by path (dot notation)
   */
  set(path: string, value: unknown): void;

  set(arg1: any, arg2?: any): void {
    const previous = this.getState();
    let newState: T;

    if (typeof arg1 === "string" && arg1.includes(".")) {
      // Path-based update
      newState = this.setNestedValue(this.state, arg1, arg2);
      this.updateState(newState, previous, arg1);
    } else if (arg2 !== undefined) {
      // Single key update
      newState = { ...this.state, [arg1]: deepClone(arg2) };
      this.updateState(newState, previous, arg1 as string);
    } else {
      // Full state replace
      newState = deepClone(arg1);
      this.updateState(newState, previous);
    }
  }

  /**
   * Batch update state (single event)
   */
  batch(updater: (state: T) => T): void {
    const previous = this.getState();
    const newState = deepClone(updater(this.getState()));

    if (!deepEqual(previous, newState)) {
      this.updateState(newState, previous);
    }
  }

  /**
   * Update a value using a function
   */
  update<K extends keyof T>(key: K, updater: (current: T[K]) => T[K]): void {
    const current = this.get(key);
    const newValue = updater(current);
    this.set(key, newValue);
  }

  /**
   * Merge partial state into current state
   */
  merge(partial: Partial<T>): void {
    const previous = this.getState();
    const newState = this.deepMerge(this.state, partial);
    this.updateState(newState, previous);
  }

  /**
   * Subscribe to all state changes
   */
  subscribe(listener: StateListener<T>): Unsubscribe;

  /**
   * Subscribe to a specific key
   */
  subscribe<K extends keyof T>(
    key: K,
    listener: StateListener<T[K]>
  ): Unsubscribe;

  /**
   * Subscribe to a path
   */
  subscribe(path: string, listener: StateListener<unknown>): Unsubscribe;

  subscribe(arg1: any, arg2?: any): Unsubscribe {
    const key = typeof arg1 === "function" ? "*" : arg1;
    const listener = typeof arg1 === "function" ? arg1 : arg2;

    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(key);
      if (listeners) {
        listeners.delete(listener);
        if (listeners.size === 0) {
          this.listeners.delete(key);
        }
      }
    };
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.updateState(deepClone(this.initialState), this.getState());
  }

  /**
   * Create a snapshot of current state
   */
  createSnapshot(
    label?: string,
    metadata?: Record<string, unknown>
  ): StateSnapshot<T> {
    return {
      id: this.generateId(),
      state: this.getState(),
      timestamp: Date.now(),
      label,
      metadata,
    };
  }

  /**
   * Get change history
   */
  getHistory(): StateChangeEvent<T>[] {
    return [...this.changeHistory];
  }

  /**
   * Clear change history
   */
  clearHistory(): void {
    this.changeHistory = [];
  }

  /**
   * Check if state has changed from initial
   */
  isDirty(): boolean {
    return !deepEqual(this.state, this.initialState);
  }

  /**
   * Get configuration
   */
  getConfig(): Required<StateManagerConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<StateManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Destroy state manager and cleanup
   */
  destroy(): void {
    this.listeners.clear();
    this.emitter.removeAllListeners();
    this.changeHistory = [];
  }

  // Protected methods

  /**
   * Update state and emit events
   */
  protected updateState(newState: T, previous: T, path?: string): void {
    if (deepEqual(previous, newState)) {
      return; // No actual change
    }

    this.state = this.config.enableFreezing
      ? this.deepFreeze(newState)
      : newState;

    const event: StateChangeEvent<T> = {
      previous,
      current: this.getState(),
      path,
      timestamp: Date.now(),
    };

    // Add to history
    this.changeHistory.push(event);
    if (this.changeHistory.length > this.config.maxHistory) {
      this.changeHistory.shift();
    }

    // Emit change event
    this.emit(event);

    if (this.config.debug) {
      this.log("State updated", { path, previous, current: newState });
    }
  }

  /**
   * Emit event to listeners
   */
  protected emit(event: StateChangeEvent<T>): void {
    // Notify global listeners
    for (const listener of this.listeners.get("*") || []) {
      try {
        listener(event);
      } catch (error) {
        this.handleError(error, "listener");
      }
    }

    // Notify specific key/path listeners
    for (const [key, listeners] of this.listeners) {
      if (key !== "*") {
        const prevValue =
          event.path === key
            ? this.getNestedValue(event.previous, key)
            : this.getNestedValue(event.previous, key);
        const currValue =
          event.path === key
            ? this.getNestedValue(event.current, key)
            : this.getNestedValue(event.current, key);

        if (!deepEqual(prevValue, currValue)) {
          for (const listener of listeners) {
            try {
              listener(event);
            } catch (error) {
              this.handleError(error, "listener");
            }
          }
        }
      }
    }

    // Also emit via EventEmitter
    this.emitter.emit("change", event);
  }

  /**
   * Get nested value by path
   */
  protected getNestedValue(
    obj: Record<string, unknown>,
    path: string
  ): unknown {
    return path.split(".").reduce((current, key) => {
      return current && typeof current === "object"
        ? (current as Record<string, unknown>)[key]
        : undefined;
    }, obj as unknown);
  }

  /**
   * Set nested value by path (immutable)
   */
  protected setNestedValue(obj: T, path: string, value: unknown): T {
    const keys = path.split(".");
    const lastKey = keys.pop()!;

    const result = deepClone(obj) as T;
    let current: Record<string, unknown> = result as Record<string, unknown>;

    for (const key of keys) {
      if (!(key in current) || typeof current[key] !== "object") {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    current[lastKey] = value;

    return result;
  }

  /**
   * Deep merge two objects
   */
  protected deepMerge(base: T, update: Partial<T>): T {
    const result = { ...base };

    for (const [key, value] of Object.entries(update)) {
      const baseValue = result[key];

      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        baseValue &&
        typeof baseValue === "object" &&
        !Array.isArray(baseValue)
      ) {
        result[key] = this.deepMerge(
          baseValue as Record<string, unknown>,
          value as Partial<Record<string, unknown>>
        ) as T[Extract<keyof T, string>];
      } else {
        result[key] = deepClone(value) as T[Extract<keyof T, string>];
      }
    }

    return result;
  }

  /**
   * Deep freeze an object
   */
  protected deepFreeze(obj: T): T {
    if (obj === null || obj === undefined) {
      return obj;
    }

    const type = typeof obj;
    if (type !== "object") {
      return obj;
    }

    Object.freeze(obj);

    for (const value of Object.values(obj)) {
      if (value && typeof value === "object" && !Object.isFrozen(value)) {
        this.deepFreeze(value);
      }
    }

    return obj;
  }

  /**
   * Generate unique ID
   */
  protected generateId(): string {
    return `${this.config.persistenceKey}_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Log debug message
   */
  protected log(message: string, data?: unknown): void {
    if (this.config.debug) {
      console.log(
        `[StateManager:${this.config.persistenceKey}] ${message}`,
        data || ""
      );
    }
  }

  /**
   * Handle error
   */
  protected handleError(error: unknown, context: string): void {
    if (this.config.debug) {
      console.error(
        `[StateManager:${this.config.persistenceKey}] Error in ${context}:`,
        error
      );
    }
  }
}

/**
 * @lsi/langgraph-state - Reducer System
 *
 * Built-in and custom reducers for state updates with composition support.
 */

import type { StateReducer, BuiltInReducer, StateStrategy } from "./types.js";

/**
 * Merge reducer - deep merges partial state into current state
 */
export function mergeReducer<T extends Record<string, unknown>>(
  state: T,
  payload: Partial<T>
): T {
  const result = { ...state };

  for (const [key, value] of Object.entries(payload)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      key in result &&
      result[key] &&
      typeof result[key] === "object" &&
      !Array.isArray(result[key])
    ) {
      (result as Record<string, unknown>)[key] = mergeReducer(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      (result as Record<string, unknown>)[key] = value;
    }
  }

  return result;
}

/**
 * Replace reducer - replaces entire state with new state
 */
export function replaceReducer<T>(state: T, payload: T): T {
  return payload;
}

/**
 * Append reducer - appends values to array fields
 */
export function appendReducer<T extends Record<string, unknown>>(
  state: T,
  payload: { key: string; value: unknown }
): T {
  const result = { ...state };
  const currentValue = (result as Record<string, unknown>)[payload.key];

  if (Array.isArray(currentValue)) {
    (result as Record<string, unknown>)[payload.key] = [
      ...currentValue,
      payload.value,
    ];
  } else if (currentValue === undefined) {
    (result as Record<string, unknown>)[payload.key] = [payload.value];
  } else {
    (result as Record<string, unknown>)[payload.key] = [
      currentValue,
      payload.value,
    ];
  }

  return result;
}

/**
 * Prepend reducer - prepends values to array fields
 */
export function prependReducer<T extends Record<string, unknown>>(
  state: T,
  payload: { key: string; value: unknown }
): T {
  const result = { ...state };
  const currentValue = (result as Record<string, unknown>)[payload.key];

  if (Array.isArray(currentValue)) {
    (result as Record<string, unknown>)[payload.key] = [
      payload.value,
      ...currentValue,
    ];
  } else if (currentValue === undefined) {
    (result as Record<string, unknown>)[payload.key] = [payload.value];
  } else {
    (result as Record<string, unknown>)[payload.key] = [
      payload.value,
      currentValue,
    ];
  }

  return result;
}

/**
 * Delete reducer - removes keys from state
 */
export function deleteReducer<T extends Record<string, unknown>>(
  state: T,
  payload: string | string[]
): T {
  const result = { ...state };
  const keysToDelete = Array.isArray(payload) ? payload : [payload];

  for (const key of keysToDelete) {
    delete (result as Record<string, unknown>)[key];
  }

  return result;
}

/**
 * Update reducer - updates nested property
 */
export function updateReducer<T extends Record<string, unknown>>(
  state: T,
  payload: { path: string; value: unknown }
): T {
  const result = { ...state };
  const keys = payload.path.split(".");
  const lastKey = keys.pop()!;
  const target = keys.reduce(
    (current: Record<string, unknown>, key: string) => {
      if (!(key in current) || typeof current[key] !== "object") {
        current[key] = {};
      }
      return current[key] as Record<string, unknown>;
    },
    result as Record<string, unknown>
  );

  target[lastKey] = payload.value;
  return result;
}

/**
 * Toggle reducer - toggles boolean values
 */
export function toggleReducer<T extends Record<string, unknown>>(
  state: T,
  payload: string
): T {
  const result = { ...state };
  const currentValue = (result as Record<string, unknown>)[payload];

  if (typeof currentValue === "boolean") {
    (result as Record<string, unknown>)[payload] = !currentValue;
  }

  return result;
}

/**
 * Increment reducer - increments numeric values
 */
export function incrementReducer<T extends Record<string, unknown>>(
  state: T,
  payload: { key: string; amount?: number }
): T {
  const result = { ...state };
  const currentValue = (result as Record<string, unknown>)[payload.key];

  if (typeof currentValue === "number") {
    (result as Record<string, unknown>)[payload.key] =
      currentValue + (payload.amount || 1);
  }

  return result;
}

/**
 * Decrement reducer - decrements numeric values
 */
export function decrementReducer<T extends Record<string, unknown>>(
  state: T,
  payload: { key: string; amount?: number }
): T {
  const result = { ...state };
  const currentValue = (result as Record<string, unknown>)[payload.key];

  if (typeof currentValue === "number") {
    (result as Record<string, unknown>)[payload.key] =
      currentValue - (payload.amount || 1);
  }

  return result;
}

/**
 * Filter reducer - filters array based on predicate
 */
export function filterReducer<T extends Record<string, unknown>>(
  state: T,
  payload: { key: string; predicate: (item: unknown, index: number) => boolean }
): T {
  const result = { ...state };
  const currentValue = (result as Record<string, unknown>)[payload.key];

  if (Array.isArray(currentValue)) {
    (result as Record<string, unknown>)[payload.key] = currentValue.filter(
      payload.predicate
    );
  }

  return result;
}

/**
 * Map reducer - transforms array elements
 */
export function mapReducer<T extends Record<string, unknown>>(
  state: T,
  payload: { key: string; transform: (item: unknown, index: number) => unknown }
): T {
  const result = { ...state };
  const currentValue = (result as Record<string, unknown>)[payload.key];

  if (Array.isArray(currentValue)) {
    (result as Record<string, unknown>)[payload.key] = currentValue.map(
      payload.transform
    );
  }

  return result;
}

/**
 * Set reducer - sets value in array (like array.splice)
 */
export function setReducer<T extends Record<string, unknown>>(
  state: T,
  payload: { key: string; index: number; value: unknown }
): T {
  const result = { ...state };
  const currentValue = (result as Record<string, unknown>)[payload.key];

  if (Array.isArray(currentValue)) {
    const newArray = [...currentValue];
    newArray[payload.index] = payload.value;
    (result as Record<string, unknown>)[payload.key] = newArray;
  }

  return result;
}

/**
 * Remove reducer - removes element from array by index
 */
export function removeReducer<T extends Record<string, unknown>>(
  state: T,
  payload: { key: string; index: number }
): T {
  const result = { ...state };
  const currentValue = (result as Record<string, unknown>)[payload.key];

  if (Array.isArray(currentValue)) {
    (result as Record<string, unknown>)[payload.key] = currentValue.filter(
      (_, i) => i !== payload.index
    );
  }

  return result;
}

/**
 * Union reducer - combines arrays without duplicates
 */
export function unionReducer<T extends Record<string, unknown>>(
  state: T,
  payload: { key: string; values: unknown[] }
): T {
  const result = { ...state };
  const currentValue = (result as Record<string, unknown>)[payload.key];

  if (Array.isArray(currentValue)) {
    const combined = [...currentValue, ...payload.values];
    const unique = Array.from(new Set(combined));
    (result as Record<string, unknown>)[payload.key] = unique;
  }

  return result;
}

/**
 * Intersection reducer - keeps only common elements
 */
export function intersectionReducer<T extends Record<string, unknown>>(
  state: T,
  payload: { key: string; values: unknown[] }
): T {
  const result = { ...state };
  const currentValue = (result as Record<string, unknown>)[payload.key];

  if (Array.isArray(currentValue)) {
    const valueSet = new Set(payload.values);
    (result as Record<string, unknown>)[payload.key] = currentValue.filter(
      item => valueSet.has(item)
    );
  }

  return result;
}

/**
 * Difference reducer - removes specified elements
 */
export function differenceReducer<T extends Record<string, unknown>>(
  state: T,
  payload: { key: string; values: unknown[] }
): T {
  const result = { ...state };
  const currentValue = (result as Record<string, unknown>)[payload.key];

  if (Array.isArray(currentValue)) {
    const valueSet = new Set(payload.values);
    (result as Record<string, unknown>)[payload.key] = currentValue.filter(
      item => !valueSet.has(item)
    );
  }

  return result;
}

/**
 * Batch reducer - applies multiple reducers in sequence
 */
export function batchReducer<T extends Record<string, unknown>>(
  state: T,
  payload: Array<{ reducer: StateReducer; args: unknown }>
): T {
  return payload.reduce((currentState, { reducer, args }) => {
    return reducer(currentState, args) as T;
  }, state);
}

/**
 * Conditional reducer - applies reducer only if condition is met
 */
export function conditionalReducer<T extends Record<string, unknown>>(
  state: T,
  payload: {
    condition: (state: T) => boolean;
    reducer: StateReducer;
    args: unknown;
  }
): T {
  if (payload.condition(state)) {
    return payload.reducer(state, payload.args) as T;
  }
  return state;
}

/**
 * Compose multiple reducers into one
 */
export function composeReducers<T>(
  ...reducers: StateReducer<T, unknown>[]
): StateReducer<T, unknown> {
  return (state: T, payload: unknown) => {
    return reducers.reduce((currentState, reducer) => {
      return reducer(currentState, payload) as T;
    }, state);
  };
}

/**
 * Create reducer that applies different reducers based on action type
 */
export function createReducerMap<T, P extends { type: string }>(
  initialState: T,
  reducerMap: Record<string, StateReducer<T, P>>
): StateReducer<T, P> {
  return (state: T = initialState, action: P): T => {
    const reducer = reducerMap[action.type];
    if (reducer) {
      return reducer(state, action) as T;
    }
    return state;
  };
}

/**
 * Reducer registry for managing custom reducers
 */
export class ReducerRegistry<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  private reducers: Map<string, BuiltInReducer<T>>;

  constructor() {
    this.reducers = new Map();

    // Register built-in reducers
    this.register(
      "merge",
      mergeReducer,
      "Deep merge partial state into current state"
    );
    this.register(
      "replace",
      replaceReducer,
      "Replace entire state with new state"
    );
    this.register(
      "append",
      appendReducer as StateReducer<T>,
      "Append value to array field"
    );
    this.register(
      "prepend",
      prependReducer as StateReducer<T>,
      "Prepend value to array field"
    );
    this.register(
      "delete",
      deleteReducer as StateReducer<T>,
      "Delete keys from state"
    );
    this.register(
      "update",
      updateReducer as StateReducer<T>,
      "Update nested property"
    );
    this.register(
      "toggle",
      toggleReducer as StateReducer<T>,
      "Toggle boolean value"
    );
    this.register(
      "increment",
      incrementReducer as StateReducer<T>,
      "Increment numeric value"
    );
    this.register(
      "decrement",
      decrementReducer as StateReducer<T>,
      "Decrement numeric value"
    );
    this.register(
      "filter",
      filterReducer as StateReducer<T>,
      "Filter array by predicate"
    );
    this.register(
      "map",
      mapReducer as StateReducer<T>,
      "Transform array elements"
    );
    this.register(
      "set",
      setReducer as StateReducer<T>,
      "Set array element by index"
    );
    this.register(
      "remove",
      removeReducer as StateReducer<T>,
      "Remove array element by index"
    );
    this.register(
      "union",
      unionReducer as StateReducer<T>,
      "Combine arrays without duplicates"
    );
    this.register(
      "intersection",
      intersectionReducer as StateReducer<T>,
      "Keep common array elements"
    );
    this.register(
      "difference",
      differenceReducer as StateReducer<T>,
      "Remove array elements"
    );
    this.register(
      "batch",
      batchReducer as StateReducer<T>,
      "Apply multiple reducers in sequence"
    );
    this.register(
      "conditional",
      conditionalReducer as StateReducer<T>,
      "Apply reducer conditionally"
    );
  }

  /**
   * Register a custom reducer
   */
  register(name: string, reducer: StateReducer<T>, description?: string): void {
    this.reducers.set(name, {
      name,
      reducer,
      description,
    });
  }

  /**
   * Unregister a reducer
   */
  unregister(name: string): void {
    this.reducers.delete(name);
  }

  /**
   * Get a reducer by name
   */
  get(name: string): BuiltInReducer<T> | undefined {
    return this.reducers.get(name);
  }

  /**
   * Check if reducer exists
   */
  has(name: string): boolean {
    return this.reducers.has(name);
  }

  /**
   * Get all registered reducer names
   */
  names(): string[] {
    return Array.from(this.reducers.keys());
  }

  /**
   * Apply reducer by name
   */
  apply(name: string, state: T, payload: unknown): T {
    const builtIn = this.reducers.get(name);
    if (!builtIn) {
      throw new Error(`Reducer not found: ${name}`);
    }
    return builtIn.reducer(state, payload) as T;
  }

  /**
   * Get reducer execution order
   */
  getExecutionOrder(): string[] {
    return [
      "conditional",
      "batch",
      "replace",
      "merge",
      "update",
      "delete",
      "toggle",
      "increment",
      "decrement",
      "append",
      "prepend",
      "filter",
      "map",
      "set",
      "remove",
      "union",
      "intersection",
      "difference",
    ];
  }
}

/**
 * Create a reducer from a strategy string
 */
export function reducerFromStrategy<T extends Record<string, unknown>>(
  strategy: StateStrategy
): StateReducer<T, unknown> {
  switch (strategy) {
    case "merge":
      return mergeReducer as StateReducer<T, unknown>;
    case "replace":
      return replaceReducer as StateReducer<T, unknown>;
    case "append":
      return appendReducer as StateReducer<T, unknown>;
    case "custom":
      throw new Error('Custom reducer must be provided for "custom" strategy');
    default:
      throw new Error(`Unknown strategy: ${strategy}`);
  }
}

/**
 * Apply reducer with execution context
 */
export function applyReducerWithContext<
  T extends Record<string, unknown>,
  P = unknown,
>(
  state: T,
  reducer: StateReducer<T, P>,
  payload: P,
  context?: Map<unknown, unknown>
): T | Promise<T> {
  const result = reducer(state, payload);

  if (result instanceof Promise) {
    return result.then(r => {
      if (context) {
        context.set("lastReducerResult", r);
        context.set("lastReducerTimestamp", new Date());
      }
      return r;
    });
  }

  if (context) {
    context.set("lastReducerResult", result);
    context.set("lastReducerTimestamp", new Date());
  }

  return result;
}

/**
 * Global reducer registry instance
 */
export const globalReducerRegistry = new ReducerRegistry();

/**
 * @lsi/state - Core Types
 *
 * Type definitions for state management
 */

/**
 * State change event
 */
export interface StateChangeEvent<T> {
  /** Previous state */
  previous: T;
  /** New state */
  current: T;
  /** Path that changed (if specific) */
  path?: string;
  /** Timestamp of change */
  timestamp: number;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * State change listener
 */
export type StateListener<T> = (event: StateChangeEvent<T>) => void;

/**
 * Unsubscribe function
 */
export type Unsubscribe = () => void;

/**
 * State update function (reducer)
 */
export type StateUpdater<T> = (state: T) => T;

/**
 * Async state update function
 */
export type AsyncStateUpdater<T> = (state: T) => Promise<T>;

/**
 * Batch update function
 */
export type BatchUpdateFunction<T> = (state: T) => T;

/**
 * State manager configuration
 */
export interface StateManagerConfig {
  /** Enable debug mode */
  debug?: boolean;
  /** Enable state freezing for immutability enforcement */
  enableFreezing?: boolean;
  /** Maximum history entries */
  maxHistory?: number;
  /** Persistence key */
  persistenceKey?: string;
}

/**
 * State snapshot
 */
export interface StateSnapshot<T> {
  /** Snapshot ID */
  id: string;
  /** State at snapshot time */
  state: T;
  /** Timestamp */
  timestamp: number;
  /** Optional label */
  label?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * State diff result
 */
export interface StateDiff<T = unknown> {
  /** Paths that were added */
  added: string[];
  /** Paths that were updated */
  updated: Array<{ path: string; oldValue: unknown; newValue: unknown }>;
  /** Paths that were deleted */
  deleted: string[];
  /** Whether states are identical */
  identical: boolean;
}

/**
 * @lsi/state - Unified State Management for Aequor Platform
 *
 * Provides base classes for state management across all Aequor packages.
 * Eliminates ~800 lines of duplicate state management code.
 *
 * @example
 * ```typescript
 * import { StateManager } from '@lsi/state';
 *
 * interface MyState {
 *   count: number;
 *   name: string;
 * }
 *
 * class MyManager extends StateManager<MyState> {
 *   constructor() {
 *     super({ count: 0, name: 'test' });
 *   }
 *
 *   increment() {
 *     this.update('count', c => c + 1);
 *   }
 * }
 *
 * const manager = new MyManager();
 * manager.increment();
 * console.log(manager.getState()); // { count: 1, name: 'test' }
 * ```
 */

// Core exports
export {
  StateManager,
  StateStore,
  combineReducers,
  createAction,
  createActionType,
} from "./core/index.js";

// History exports
export { StateHistory } from "./history/index.js";

// Persistence exports
export {
  StatePersistence,
  LocalStorageBackend,
  MemoryBackend,
  JSONSerializer,
} from "./persistence/index.js";

// Utils exports
export {
  deepClone,
  deepMerge,
  deepMergeMany,
  deepEqual,
  getByPath,
  setByPath,
  updateByPath,
  deleteByPath,
  hasPath,
  getPaths,
} from "./utils/index.js";

// Type exports
export type {
  // Core types
  StateChangeEvent,
  StateListener,
  Unsubscribe,
  StateUpdater,
  AsyncStateUpdater,
  BatchUpdateFunction,
  StateManagerConfig,
  StateSnapshot,
  StateDiff,
  // Store types
  Action,
  Reducer,
  Middleware,
  // History types
  HistoryEntry,
  HistoryStatistics,
  // Persistence types
  StorageBackend,
  PersistenceConfig,
  StateSerializer,
} from "./core/index.js";

export type {
  HistoryEntry as HistoryEntryType,
  HistoryStatistics as HistoryStatisticsType,
} from "./history/index.js";

export type {
  StorageBackend as StorageBackendType,
  PersistenceConfig as PersistenceConfigType,
  StateSerializer as StateSerializerType,
} from "./persistence/index.js";

/**
 * @lsi/state - Core Module
 *
 * Core state management classes
 */

export { StateManager } from "./StateManager.js";
export {
  StateStore,
  combineReducers,
  createAction,
  createActionType,
} from "./StateStore.js";
export type {
  StateChangeEvent,
  StateListener,
  Unsubscribe,
  StateUpdater,
  AsyncStateUpdater,
  BatchUpdateFunction,
  StateManagerConfig,
  StateSnapshot,
  StateDiff,
} from "./types.js";
export type { Action, Reducer, Middleware } from "./StateStore.js";

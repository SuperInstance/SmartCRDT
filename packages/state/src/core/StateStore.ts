/**
 * @lsi/state - StateStore
 *
 * Redux-style store with actions and reducers
 */

import type { StateChangeEvent, StateListener, Unsubscribe } from "./types.js";
import { StateManager } from "./StateManager.js";
import { deepClone, deepEqual } from "../utils/index.js";

/**
 * Action type with optional payload
 */
export interface Action<T = string, P = unknown> {
  type: T;
  payload?: P;
  metadata?: Record<string, unknown>;
}

/**
 * Reducer function
 */
export type Reducer<S, A extends Action = Action> = (state: S, action: A) => S;

/**
 * Middleware function
 */
export type Middleware<S, A extends Action = Action> = (
  store: StateStore<S, A>,
  next: (action: A) => void
) => (action: A) => void;

/**
 * Redux-style State Store
 *
 * Provides predictable state updates using actions and reducers.
 *
 * @example
 * ```typescript
 * interface MyState {
 *   count: number;
 * }
 *
 * type MyAction =
 *   | { type: 'INCREMENT' }
 *   | { type: 'DECREMENT' }
 *   | { type: 'SET'; payload: number };
 *
 * const reducer: Reducer<MyState, MyAction> = (state, action) => {
 *   switch (action.type) {
 *     case 'INCREMENT': return { ...state, count: state.count + 1 };
 *     case 'DECREMENT': return { ...state, count: state.count - 1 };
 *     case 'SET': return { ...state, count: action.payload };
 *     default: return state;
 *   }
 * };
 *
 * const store = new StateStore({ count: 0 }, reducer);
 * store.dispatch({ type: 'INCREMENT' });
 * ```
 */
export class StateStore<
  S extends Record<string, unknown>,
  A extends Action = Action,
> {
  protected manager: StateManager<S>;
  protected reducer: Reducer<S, A>;
  protected middleware: Middleware<S, A>[];
  protected isDispatching: boolean = false;

  /**
   * Create a new StateStore
   */
  constructor(
    initialState: S,
    reducer: Reducer<S, A>,
    config?: {
      middleware?: Middleware<S, A>[];
      debug?: boolean;
      enableFreezing?: boolean;
    }
  ) {
    this.reducer = reducer;
    this.manager = new StateManager<S>(initialState, {
      debug: config?.debug ?? false,
      enableFreezing: config?.enableFreezing ?? false,
      persistenceKey: "store",
    });
    this.middleware = config?.middleware ?? [];
  }

  /**
   * Dispatch an action to update state
   */
  dispatch(action: A): void {
    if (this.isDispatching) {
      throw new Error("Reducers may not dispatch actions");
    }

    try {
      this.isDispatching = true;

      // Apply middleware
      let dispatch = (action: A) => this.dispatchInternal(action);
      for (const mw of this.middleware) {
        dispatch = mw(this, dispatch);
      }

      dispatch(action);
    } finally {
      this.isDispatching = false;
    }
  }

  /**
   * Get current state
   */
  getState(): S {
    return this.manager.getState();
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: StateListener<S>): Unsubscribe {
    return this.manager.subscribe(listener);
  }

  /**
   * Replace the reducer
   */
  replaceReducer(nextReducer: Reducer<S, A>): void {
    this.reducer = nextReducer;
    this.dispatch({ type: "@@INIT" } as A);
  }

  /**
   * Get the current reducer
   */
  getReducer(): Reducer<S, A> {
    return this.reducer;
  }

  /**
   * Check if currently dispatching
   */
  isDispatchingAction(): boolean {
    return this.isDispatching;
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.manager.reset();
  }

  /**
   * Destroy store
   */
  destroy(): void {
    this.manager.destroy();
    this.middleware = [];
  }

  /**
   * Internal dispatch without middleware recursion guard
   */
  protected dispatchInternal(action: A): void {
    const previousState = this.getState();
    const newState = this.reducer(previousState, action);

    if (!deepEqual(previousState, newState)) {
      this.manager.batch(() => newState);
    }
  }
}

/**
 * Combine multiple reducers
 */
export function combineReducers<
  S extends Record<string, unknown>,
  A extends Action = Action,
>(reducers: { [K in keyof S]: Reducer<S[K], A> }): Reducer<S, A> {
  return (state: S, action: A): S => {
    const nextState = {} as S;
    let hasChanged = false;

    for (const key in reducers) {
      const reducer = reducers[key];
      const previousStateForKey = state[key];
      const nextStateForKey = reducer(previousStateForKey, action);

      if (!deepEqual(previousStateForKey, nextStateForKey)) {
        hasChanged = true;
      }

      nextState[key] = nextStateForKey;
    }

    return hasChanged ? nextState : state;
  };
}

/**
 * Create action creator
 */
export function createAction<T extends string, P = unknown>(type: T) {
  return (payload?: P, metadata?: Record<string, unknown>): Action<T, P> => ({
    type,
    payload,
    metadata,
  });
}

/**
 * Create action type constant
 */
export function createActionType<T extends string>(type: T): T {
  return type;
}

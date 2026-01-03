/**
 * @lsi/state - StateStore Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateStore, combineReducers, createAction, createActionType } from '../src/core/StateStore.js';

interface CounterState {
  count: number;
  step: number;
}

type CounterAction =
  | { type: 'INCREMENT' }
  | { type: 'DECREMENT' }
  | { type: 'SET_STEP'; payload: number }
  | { type: 'SET_COUNT'; payload: number };

describe('StateStore', () => {
  let store: StateStore<CounterState, CounterAction>;

  const reducer = (state: CounterState, action: CounterAction): CounterState => {
    switch (action.type) {
      case 'INCREMENT':
        return { ...state, count: state.count + state.step };
      case 'DECREMENT':
        return { ...state, count: state.count - state.step };
      case 'SET_STEP':
        return { ...state, step: action.payload };
      case 'SET_COUNT':
        return { ...state, count: action.payload };
      default:
        return state;
    }
  };

  beforeEach(() => {
    store = new StateStore<CounterState, CounterAction>(
      { count: 0, step: 1 },
      reducer
    );
  });

  describe('getState', () => {
    it('should return initial state', () => {
      expect(store.getState()).toEqual({ count: 0, step: 1 });
    });
  });

  describe('dispatch', () => {
    it('should update state with action', () => {
      store.dispatch({ type: 'INCREMENT' });
      expect(store.getState().count).toBe(1);

      store.dispatch({ type: 'INCREMENT' });
      expect(store.getState().count).toBe(2);
    });

    it('should handle different action types', () => {
      store.dispatch({ type: 'SET_STEP', payload: 5 });
      store.dispatch({ type: 'INCREMENT' });

      expect(store.getState().count).toBe(5);
    });

    it('should notify subscribers', () => {
      const listener = vi.fn();
      store.subscribe(listener);

      store.dispatch({ type: 'INCREMENT' });

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('subscribe', () => {
    it('should subscribe to changes', () => {
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);

      store.dispatch({ type: 'INCREMENT' });

      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      store.dispatch({ type: 'INCREMENT' });

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('replaceReducer', () => {
    it('should replace reducer', () => {
      const newReducer = (state: CounterState, action: CounterAction): CounterState => {
        switch (action.type) {
          case 'INCREMENT':
            return { ...state, count: state.count + 10 };
          default:
            return state;
        }
      };

      store.replaceReducer(newReducer);
      store.dispatch({ type: 'INCREMENT' });

      expect(store.getState().count).toBe(10);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      store.dispatch({ type: 'SET_COUNT', payload: 5 });
      expect(store.getState().count).toBe(5);

      store.reset();
      expect(store.getState()).toEqual({ count: 0, step: 1 });
    });
  });
});

describe('combineReducers', () => {
  interface RootState {
    counter: { value: number };
    todos: { items: string[] };
  }

  type RootAction =
    | { type: 'INCREMENT' }
    | { type: 'ADD_TODO'; payload: string };

  it('should combine multiple reducers', () => {
    const counterReducer = (state: { value: number }, action: RootAction) => {
      if (action.type === 'INCREMENT') {
        return { value: state.value + 1 };
      }
      return state;
    };

    const todosReducer = (state: { items: string[] }, action: RootAction) => {
      if (action.type === 'ADD_TODO') {
        return { items: [...state.items, action.payload] };
      }
      return state;
    };

    const rootReducer = combineReducers<RootState, RootAction>({
      counter: counterReducer,
      todos: todosReducer
    });

    const initialState: RootState = {
      counter: { value: 0 },
      todos: { items: [] }
    };

    const store = new StateStore(initialState, rootReducer);

    store.dispatch({ type: 'INCREMENT' });
    expect(store.getState().counter.value).toBe(1);

    store.dispatch({ type: 'ADD_TODO', payload: 'Buy milk' });
    expect(store.getState().todos.items).toEqual(['Buy milk']);
  });
});

describe('createAction', () => {
  it('should create action with payload', () => {
    const increment = createAction('INCREMENT');

    expect(increment()).toEqual({ type: 'INCREMENT' });
    expect(increment(5)).toEqual({ type: 'INCREMENT', payload: 5 });
    expect(increment(10, { source: 'test' })).toEqual({
      type: 'INCREMENT',
      payload: 10,
      metadata: { source: 'test' }
    });
  });
});

describe('createActionType', () => {
  it('should create action type constant', () => {
    const INCREMENT = createActionType('INCREMENT');

    expect(INCREMENT).toBe('INCREMENT');

    // Type checking works
    const action: { type: typeof INCREMENT } = { type: INCREMENT };
    expect(action.type).toBe('INCREMENT');
  });
});

describe('middleware', () => {
  it('should apply middleware', () => {
    const logger = vi.fn((store, next) => (action) => {
      logger(action.type);
      next(action);
    });

    const store = new StateStore(
      { count: 0, step: 1 },
      (state: CounterState, action: CounterAction) => {
        if (action.type === 'INCREMENT') {
          return { ...state, count: state.count + state.step };
        }
        return state;
      },
      { middleware: [logger] }
    );

    store.dispatch({ type: 'INCREMENT' });

    expect(logger).toHaveBeenCalledWith('INCREMENT');
    expect(store.getState().count).toBe(1);
  });
});

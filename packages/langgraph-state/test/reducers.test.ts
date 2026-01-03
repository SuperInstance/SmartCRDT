/**
 * @lsi/langgraph-state - Reducer Tests
 */

import { describe, it, expect } from 'vitest';
import {
  mergeReducer,
  replaceReducer,
  appendReducer,
  prependReducer,
  deleteReducer,
  updateReducer,
  toggleReducer,
  incrementReducer,
  decrementReducer,
  filterReducer,
  mapReducer,
  setReducer,
  removeReducer,
  unionReducer,
  intersectionReducer,
  differenceReducer,
  batchReducer,
  conditionalReducer,
  composeReducers,
  ReducerRegistry
} from '../src/reducers.js';

describe('mergeReducer', () => {
  it('should merge partial state', () => {
    const state = { foo: 'bar', baz: 1 };
    const result = mergeReducer(state, { qux: 'new' });
    expect(result).toEqual({ foo: 'bar', baz: 1, qux: 'new' });
  });

  it('should deep merge nested objects', () => {
    const state = { foo: { bar: { baz: 1 } } };
    const result = mergeReducer(state, { foo: { bar: { qux: 2 } } });
    expect(result).toEqual({ foo: { bar: { baz: 1, qux: 2 } } });
  });

  it('should overwrite existing keys', () => {
    const state = { foo: 'bar' };
    const result = mergeReducer(state, { foo: 'baz' });
    expect(result).toEqual({ foo: 'baz' });
  });

  it('should handle empty update', () => {
    const state = { foo: 'bar' };
    const result = mergeReducer(state, {});
    expect(result).toEqual({ foo: 'bar' });
  });
});

describe('replaceReducer', () => {
  it('should replace entire state', () => {
    const state = { foo: 'bar', baz: 1 };
    const result = replaceReducer(state, { new: 'state' });
    expect(result).toEqual({ new: 'state' });
  });

  it('should handle empty replacement', () => {
    const state = { foo: 'bar' };
    const result = replaceReducer(state, {});
    expect(result).toEqual({});
  });
});

describe('appendReducer', () => {
  it('should append to array', () => {
    const state = { items: [1, 2, 3] };
    const result = appendReducer(state, { key: 'items', value: 4 });
    expect(result).toEqual({ items: [1, 2, 3, 4] });
  });

  it('should create array if not exists', () => {
    const state = {};
    const result = appendReducer(state, { key: 'items', value: 1 });
    expect(result).toEqual({ items: [1] });
  });

  it('should append to non-array value', () => {
    const state = { items: 'single' };
    const result = appendReducer(state, { key: 'items', value: 2 });
    expect(result).toEqual({ items: ['single', 2] });
  });
});

describe('prependReducer', () => {
  it('should prepend to array', () => {
    const state = { items: [2, 3, 4] };
    const result = prependReducer(state, { key: 'items', value: 1 });
    expect(result).toEqual({ items: [1, 2, 3, 4] });
  });

  it('should create array if not exists', () => {
    const state = {};
    const result = prependReducer(state, { key: 'items', value: 1 });
    expect(result).toEqual({ items: [1] });
  });
});

describe('deleteReducer', () => {
  it('should delete single key', () => {
    const state = { foo: 'bar', baz: 1, qux: 2 };
    const result = deleteReducer(state, 'baz');
    expect(result).toEqual({ foo: 'bar', qux: 2 });
  });

  it('should delete multiple keys', () => {
    const state = { foo: 'bar', baz: 1, qux: 2 };
    const result = deleteReducer(state, ['baz', 'qux']);
    expect(result).toEqual({ foo: 'bar' });
  });

  it('should handle non-existent keys', () => {
    const state = { foo: 'bar' };
    const result = deleteReducer(state, 'baz');
    expect(result).toEqual({ foo: 'bar' });
  });
});

describe('updateReducer', () => {
  it('should update nested property', () => {
    const state = { foo: { bar: { baz: 1 } } };
    const result = updateReducer(state, { path: 'foo.bar.baz', value: 2 });
    expect(result).toEqual({ foo: { bar: { baz: 2 } } });
  });

  it('should create intermediate objects', () => {
    const state = {};
    const result = updateReducer(state, { path: 'foo.bar.baz', value: 1 });
    expect(result).toEqual({ foo: { bar: { baz: 1 } } });
  });
});

describe('toggleReducer', () => {
  it('should toggle boolean from true to false', () => {
    const state = { active: true };
    const result = toggleReducer(state, 'active');
    expect(result).toEqual({ active: false });
  });

  it('should toggle boolean from false to true', () => {
    const state = { active: false };
    const result = toggleReducer(state, 'active');
    expect(result).toEqual({ active: true });
  });

  it('should ignore non-boolean values', () => {
    const state = { active: 'yes' };
    const result = toggleReducer(state, 'active');
    expect(result).toEqual({ active: 'yes' });
  });

  it('should ignore non-existent keys', () => {
    const state = {};
    const result = toggleReducer(state, 'active');
    expect(result).toEqual({});
  });
});

describe('incrementReducer', () => {
  it('should increment numeric value', () => {
    const state = { count: 5 };
    const result = incrementReducer(state, { key: 'count' });
    expect(result).toEqual({ count: 6 });
  });

  it('should increment by custom amount', () => {
    const state = { count: 5 };
    const result = incrementReducer(state, { key: 'count', amount: 5 });
    expect(result).toEqual({ count: 10 });
  });

  it('should handle negative amounts', () => {
    const state = { count: 5 };
    const result = incrementReducer(state, { key: 'count', amount: -2 });
    expect(result).toEqual({ count: 3 });
  });

  it('should ignore non-numeric values', () => {
    const state = { count: 'five' };
    const result = incrementReducer(state, { key: 'count' });
    expect(result).toEqual({ count: 'five' });
  });
});

describe('decrementReducer', () => {
  it('should decrement numeric value', () => {
    const state = { count: 5 };
    const result = decrementReducer(state, { key: 'count' });
    expect(result).toEqual({ count: 4 });
  });

  it('should decrement by custom amount', () => {
    const state = { count: 10 };
    const result = decrementReducer(state, { key: 'count', amount: 5 });
    expect(result).toEqual({ count: 5 });
  });

  it('should ignore non-numeric values', () => {
    const state = { count: 'five' };
    const result = decrementReducer(state, { key: 'count' });
    expect(result).toEqual({ count: 'five' });
  });
});

describe('filterReducer', () => {
  it('should filter array by predicate', () => {
    const state = { items: [1, 2, 3, 4, 5] };
    const result = filterReducer(state, {
      key: 'items',
      predicate: (item: unknown) => (item as number) % 2 === 0
    });
    expect(result).toEqual({ items: [2, 4] });
  });

  it('should handle empty arrays', () => {
    const state = { items: [] };
    const result = filterReducer(state, {
      key: 'items',
      predicate: () => true
    });
    expect(result).toEqual({ items: [] });
  });

  it('should ignore non-array values', () => {
    const state = { items: 'not an array' };
    const result = filterReducer(state, {
      key: 'items',
      predicate: () => true
    });
    expect(result).toEqual({ items: 'not an array' });
  });
});

describe('mapReducer', () => {
  it('should transform array elements', () => {
    const state = { items: [1, 2, 3] };
    const result = mapReducer(state, {
      key: 'items',
      transform: (item: unknown) => (item as number) * 2
    });
    expect(result).toEqual({ items: [2, 4, 6] });
  });

  it('should handle empty arrays', () => {
    const state = { items: [] };
    const result = mapReducer(state, {
      key: 'items',
      transform: (item: unknown) => item
    });
    expect(result).toEqual({ items: [] });
  });
});

describe('setReducer', () => {
  it('should set element at index', () => {
    const state = { items: [1, 2, 3] };
    const result = setReducer(state, { key: 'items', index: 1, value: 99 });
    expect(result).toEqual({ items: [1, 99, 3] });
  });

  it('should handle out of bounds index', () => {
    const state = { items: [1, 2, 3] };
    const result = setReducer(state, { key: 'items', index: 5, value: 99 });
    expect(result.items[5]).toBe(99);
  });
});

describe('removeReducer', () => {
  it('should remove element at index', () => {
    const state = { items: [1, 2, 3, 4] };
    const result = removeReducer(state, { key: 'items', index: 1 });
    expect(result).toEqual({ items: [1, 3, 4] });
  });

  it('should handle out of bounds index', () => {
    const state = { items: [1, 2, 3] };
    const result = removeReducer(state, { key: 'items', index: 5 });
    expect(result).toEqual({ items: [1, 2, 3] });
  });
});

describe('unionReducer', () => {
  it('should combine arrays without duplicates', () => {
    const state = { items: [1, 2, 3] };
    const result = unionReducer(state, { key: 'items', values: [2, 3, 4] });
    expect(result).toEqual({ items: [1, 2, 3, 4] });
  });

  it('should preserve order', () => {
    const state = { items: [1, 2] };
    const result = unionReducer(state, { key: 'items', values: [3, 4] });
    expect(result).toEqual({ items: [1, 2, 3, 4] });
  });
});

describe('intersectionReducer', () => {
  it('should keep common elements', () => {
    const state = { items: [1, 2, 3, 4] };
    const result = intersectionReducer(state, { key: 'items', values: [2, 3, 5] });
    expect(result).toEqual({ items: [2, 3] });
  });

  it('should handle no common elements', () => {
    const state = { items: [1, 2, 3] };
    const result = intersectionReducer(state, { key: 'items', values: [4, 5, 6] });
    expect(result).toEqual({ items: [] });
  });
});

describe('differenceReducer', () => {
  it('should remove specified elements', () => {
    const state = { items: [1, 2, 3, 4, 5] };
    const result = differenceReducer(state, { key: 'items', values: [2, 4] });
    expect(result).toEqual({ items: [1, 3, 5] });
  });

  it('should handle non-existent elements', () => {
    const state = { items: [1, 2, 3] };
    const result = differenceReducer(state, { key: 'items', values: [4, 5, 6] });
    expect(result).toEqual({ items: [1, 2, 3] });
  });
});

describe('batchReducer', () => {
  it('should apply multiple reducers in sequence', () => {
    const state = { count: 5, items: [1] };
    const result = batchReducer(state, [
      { reducer: incrementReducer, args: { key: 'count' } },
      { reducer: appendReducer, args: { key: 'items', value: 2 } },
      { reducer: incrementReducer, args: { key: 'count' } }
    ]);
    expect(result).toEqual({ count: 7, items: [1, 2] });
  });

  it('should handle empty batch', () => {
    const state = { count: 5 };
    const result = batchReducer(state, []);
    expect(result).toEqual({ count: 5 });
  });
});

describe('conditionalReducer', () => {
  it('should apply reducer if condition is true', () => {
    const state = { count: 5 };
    const result = conditionalReducer(state, {
      condition: (s) => (s as { count: number }).count > 3,
      reducer: incrementReducer,
      args: { key: 'count' }
    });
    expect(result).toEqual({ count: 6 });
  });

  it('should skip reducer if condition is false', () => {
    const state = { count: 5 };
    const result = conditionalReducer(state, {
      condition: (s) => (s as { count: number }).count > 10,
      reducer: incrementReducer,
      args: { key: 'count' }
    });
    expect(result).toEqual({ count: 5 });
  });
});

describe('composeReducers', () => {
  it('should compose multiple reducers', () => {
    const state = { count: 5 };
    const composed = composeReducers(
      incrementReducer,
      incrementReducer,
      incrementReducer
    );
    const result = composed(state, { key: 'count' });
    expect(result).toEqual({ count: 8 });
  });

  it('should handle single reducer', () => {
    const state = { count: 5 };
    const composed = composeReducers(incrementReducer);
    const result = composed(state, { key: 'count' });
    expect(result).toEqual({ count: 6 });
  });

  it('should handle empty composition', () => {
    const state = { count: 5 };
    const composed = composeReducers();
    const result = composed(state, {});
    expect(result).toEqual({ count: 5 });
  });
});

describe('ReducerRegistry', () => {
  it('should register custom reducer', () => {
    const registry = new ReducerRegistry();
    const customReducer = (state: unknown) => state;
    registry.register('custom', customReducer, 'Custom reducer');
    expect(registry.has('custom')).toBe(true);
  });

  it('should unregister reducer', () => {
    const registry = new ReducerRegistry();
    const customReducer = (state: unknown) => state;
    registry.register('custom', customReducer);
    registry.unregister('custom');
    expect(registry.has('custom')).toBe(false);
  });

  it('should get reducer by name', () => {
    const registry = new ReducerRegistry();
    const reducer = registry.get('merge');
    expect(reducer).toBeDefined();
    expect(reducer?.name).toBe('merge');
  });

  it('should apply reducer by name', () => {
    const registry = new ReducerRegistry();
    const state = { foo: 'bar' };
    const result = registry.apply('replace', state, { new: 'state' });
    expect(result).toEqual({ new: 'state' });
  });

  it('should throw for unknown reducer', () => {
    const registry = new ReducerRegistry();
    const state = { foo: 'bar' };
    expect(() => registry.apply('unknown', state, {})).toThrow();
  });

  it('should list all reducer names', () => {
    const registry = new ReducerRegistry();
    const names = registry.names();
    expect(names).toContain('merge');
    expect(names).toContain('replace');
    expect(names).toContain('append');
  });

  it('should get execution order', () => {
    const registry = new ReducerRegistry();
    const order = registry.getExecutionOrder();
    expect(Array.isArray(order)).toBe(true);
    expect(order.length).toBeGreaterThan(0);
  });
});

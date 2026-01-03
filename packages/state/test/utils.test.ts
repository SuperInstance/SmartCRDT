/**
 * @lsi/state - Utility Tests
 */

import { describe, it, expect } from 'vitest';
import {
  deepClone,
  deepMerge,
  deepMergeMany,
  deepEqual,
  getByPath,
  setByPath,
  updateByPath,
  deleteByPath,
  hasPath,
  getPaths
} from '../src/utils/index.js';

describe('deepClone', () => {
  it('should clone primitives', () => {
    expect(deepClone(null)).toBe(null);
    expect(deepClone(undefined)).toBe(undefined);
    expect(deepClone(42)).toBe(42);
    expect(deepClone('hello')).toBe('hello');
    expect(deepClone(true)).toBe(true);
  });

  it('should clone arrays', () => {
    const arr = [1, 2, { a: 3 }];
    const cloned = deepClone(arr);
    expect(cloned).toEqual(arr);
    expect(cloned).not.toBe(arr);
    expect(cloned[2]).not.toBe(arr[2]);
  });

  it('should clone objects', () => {
    const obj = { a: 1, b: { c: 2 } };
    const cloned = deepClone(obj);
    expect(cloned).toEqual(obj);
    expect(cloned).not.toBe(obj);
    expect(cloned.b).not.toBe(obj.b);
  });

  it('should clone nested structures', () => {
    const nested = {
      users: [
        { id: 1, name: 'Alice', profile: { age: 30 } },
        { id: 2, name: 'Bob', profile: { age: 25 } }
      ],
      metadata: { count: 2 }
    };
    const cloned = deepClone(nested);
    expect(cloned).toEqual(nested);
    expect(cloned.users).not.toBe(nested.users);
    expect(cloned.users[0].profile).not.toBe(nested.users[0].profile);
  });
});

describe('deepMerge', () => {
  it('should merge simple objects', () => {
    const base = { a: 1, b: 2 };
    const update = { b: 3, c: 4 };
    expect(deepMerge(base, update)).toEqual({ a: 1, b: 3, c: 4 });
  });

  it('should merge nested objects', () => {
    const base = { a: { x: 1, y: 2 } };
    const update = { a: { y: 3, z: 4 } };
    expect(deepMerge(base, update)).toEqual({ a: { x: 1, y: 3, z: 4 } });
  });

  it('should replace arrays', () => {
    const base = { items: [1, 2, 3] };
    const update = { items: [4, 5] };
    expect(deepMerge(base, update)).toEqual({ items: [4, 5] });
  });

  it('should handle null values', () => {
    const base = { a: { x: 1 } };
    const update = { a: null };
    expect(deepMerge(base, update)).toEqual({ a: null });
  });

  it('should merge multiple updates', () => {
    const base = { a: 1, b: 2 };
    const update1 = { b: 3, c: 4 };
    const update2 = { c: 5, d: 6 };
    expect(deepMergeMany(base, update1, update2)).toEqual({ a: 1, b: 3, c: 5, d: 6 });
  });
});

describe('deepEqual', () => {
  it('should return true for equal primitives', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual('test', 'test')).toBe(true);
    expect(deepEqual(true, true)).toBe(true);
  });

  it('should return false for unequal primitives', () => {
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual('test', 'other')).toBe(false);
    expect(deepEqual(true, false)).toBe(false);
  });

  it('should compare arrays', () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    expect(deepEqual([1, 2, 3], [1, 2])).toBe(false);
  });

  it('should compare objects', () => {
    expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false);
    expect(deepEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });

  it('should compare nested structures', () => {
    const a = { users: [{ id: 1, name: 'Alice' }] };
    const b = { users: [{ id: 1, name: 'Alice' }] };
    const c = { users: [{ id: 1, name: 'Bob' }] };
    expect(deepEqual(a, b)).toBe(true);
    expect(deepEqual(a, c)).toBe(false);
  });
});

describe('getByPath', () => {
  const obj = {
    user: {
      name: 'Alice',
      profile: {
        age: 30,
        city: 'NYC'
      }
    },
    count: 42
  };

  it('should get top-level values', () => {
    expect(getByPath(obj, 'count')).toBe(42);
  });

  it('should get nested values', () => {
    expect(getByPath(obj, 'user.name')).toBe('Alice');
    expect(getByPath(obj, 'user.profile.age')).toBe(30);
  });

  it('should return undefined for missing paths', () => {
    expect(getByPath(obj, 'user.missing')).toBe(undefined);
    expect(getByPath(obj, 'missing.path')).toBe(undefined);
  });
});

describe('setByPath', () => {
  it('should set top-level values', () => {
    const obj = { a: 1 };
    const result = setByPath(obj, 'a', 2);
    expect(result).toEqual({ a: 2 });
    expect(result).not.toBe(obj);
  });

  it('should set nested values', () => {
    const obj = { user: { name: 'Alice' } };
    const result = setByPath(obj, 'user.name', 'Bob');
    expect(result).toEqual({ user: { name: 'Bob' } });
    expect(result).not.toBe(obj);
    expect(result.user).not.toBe(obj.user);
  });

  it('should create missing intermediate objects', () => {
    const obj = {} as Record<string, unknown>;
    const result = setByPath(obj, 'a.b.c', 42);
    expect(result).toEqual({ a: { b: { c: 42 } } });
  });
});

describe('updateByPath', () => {
  it('should update value using function', () => {
    const obj = { count: 5 };
    const result = updateByPath(obj, 'count', (x: unknown) => (x as number) + 1);
    expect(result).toEqual({ count: 6 });
  });

  it('should update nested values', () => {
    const obj = { user: { age: 30 } };
    const result = updateByPath(obj, 'user.age', (x: unknown) => (x as number) + 5);
    expect(result).toEqual({ user: { age: 35 } });
  });
});

describe('deleteByPath', () => {
  it('should delete top-level keys', () => {
    const obj = { a: 1, b: 2 };
    const result = deleteByPath(obj, 'a');
    expect(result).toEqual({ b: 2 });
    expect('a' in result).toBe(false);
  });

  it('should delete nested keys', () => {
    const obj = { user: { name: 'Alice', age: 30 } };
    const result = deleteByPath(obj, 'user.age');
    expect(result).toEqual({ user: { name: 'Alice' } });
    expect('age' in result.user).toBe(false);
  });
});

describe('hasPath', () => {
  const obj = {
    user: {
      name: 'Alice',
      profile: {
        age: 30
      }
    }
  };

  it('should return true for existing paths', () => {
    expect(hasPath(obj, 'user')).toBe(true);
    expect(hasPath(obj, 'user.name')).toBe(true);
    expect(hasPath(obj, 'user.profile.age')).toBe(true);
  });

  it('should return false for missing paths', () => {
    expect(hasPath(obj, 'user.missing')).toBe(false);
    expect(hasPath(obj, 'missing.path')).toBe(false);
  });
});

describe('getPaths', () => {
  it('should get all paths from flat object', () => {
    const obj = { a: 1, b: 2 };
    expect(getPaths(obj)).toEqual(['a', 'b']);
  });

  it('should get all paths from nested object', () => {
    const obj = {
      user: {
        name: 'Alice',
        profile: { age: 30 }
      },
      count: 42
    };
    const paths = getPaths(obj);
    expect(paths).toContain('user.name');
    expect(paths).toContain('user.profile.age');
    expect(paths).toContain('count');
  });
});

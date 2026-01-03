/**
 * @lsi/langgraph-state - Conflict Resolution Tests
 */

import { describe, it, expect } from 'vitest';
import {
  ConflictResolver,
  LastWriteWinsStrategy,
  FirstWriteWinsStrategy,
  OperationalTransformStrategy,
  CRDTStrategy,
  VectorClock,
  threeWayMerge,
  createConflictResolver
} from '../src/conflict.js';

describe('ConflictResolver', () => {
  let resolver: ConflictResolver;

  beforeEach(() => {
    resolver = new ConflictResolver();
  });

  describe('detectConflicts', () => {
    it('should detect no conflicts in identical states', () => {
      const stateA = { foo: 'bar', baz: 1 };
      const stateB = { foo: 'bar', baz: 1 };
      const versionA = { major: 1, minor: 0, patch: 0, toString: () => '1.0.0', compare: () => 0 };
      const versionB = { major: 1, minor: 0, patch: 1, toString: () => '1.0.1', compare: () => 1 };

      const conflicts = resolver.detectConflicts(stateA, versionA, stateB, versionB);
      expect(conflicts).toHaveLength(0);
    });

    it('should detect conflicts in different values', () => {
      const stateA = { foo: 'bar' };
      const stateB = { foo: 'baz' };
      const versionA = { major: 1, minor: 0, patch: 0, toString: () => '1.0.0', compare: () => 0 };
      const versionB = { major: 1, minor: 0, patch: 1, toString: () => '1.0.1', compare: () => 1 };

      const conflicts = resolver.detectConflicts(stateA, versionA, stateB, versionB);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].path).toBe('foo');
    });

    it('should detect conflicts in nested objects', () => {
      const stateA = { foo: { bar: { baz: 1 } } };
      const stateB = { foo: { bar: { baz: 2 } } };
      const versionA = { major: 1, minor: 0, patch: 0, toString: () => '1.0.0', compare: () => 0 };
      const versionB = { major: 1, minor: 0, patch: 1, toString: () => '1.0.1', compare: () => 1 };

      const conflicts = resolver.detectConflicts(stateA, versionA, stateB, versionB);
      expect(conflicts.length).toBeGreaterThan(0);
    });
  });

  describe('resolve', () => {
    it('should resolve conflicts with last-write-wins', async () => {
      const conflicts = [
        {
          path: 'foo',
          valueA: 'bar',
          valueB: 'baz',
          type: 'concurrent' as const,
          timestamps: { a: new Date(1000), b: new Date(2000) }
        }
      ];

      const result = await resolver.resolve(conflicts, 'last-write-wins');
      expect(result.resolved).toBe(true);
      expect(result.state).toEqual({ foo: 'baz' });
    });

    it('should resolve conflicts with first-write-wins', async () => {
      const conflicts = [
        {
          path: 'foo',
          valueA: 'bar',
          valueB: 'baz',
          type: 'concurrent' as const,
          timestamps: { a: new Date(1000), b: new Date(2000) }
        }
      ];

      const result = await resolver.resolve(conflicts, 'first-write-wins');
      expect(result.resolved).toBe(true);
      expect(result.state).toEqual({ foo: 'bar' });
    });
  });

  describe('merge', () => {
    it('should merge without conflicts', async () => {
      const base = { foo: 'bar' };
      const left = { foo: 'bar', baz: 1 };
      const right = { foo: 'bar', qux: 2 };

      const result = await resolver.merge(base, left, right);
      expect(result.conflicts).toHaveLength(0);
      expect(result.state).toEqual({ foo: 'bar', baz: 1, qux: 2 });
    });

    it('should merge with conflicts', async () => {
      const base = { foo: 'bar' };
      const left = { foo: 'baz' };
      const right = { foo: 'qux' };

      const result = await resolver.merge(base, left, right);
      expect(result.conflicts.length).toBeGreaterThan(0);
    });
  });
});

describe('LastWriteWinsStrategy', () => {
  it('should prefer valueB', async () => {
    const strategy = new LastWriteWinsStrategy();
    const conflicts = [
      {
        path: 'foo',
        valueA: 'bar',
        valueB: 'baz',
        type: 'concurrent' as const,
        timestamps: { a: new Date(), b: new Date() }
      }
    ];

    const result = await strategy.resolve(conflicts);
    expect(result.state).toEqual({ foo: 'baz' });
  });
});

describe('FirstWriteWinsStrategy', () => {
  it('should prefer valueA', async () => {
    const strategy = new FirstWriteWinsStrategy();
    const conflicts = [
      {
        path: 'foo',
        valueA: 'bar',
        valueB: 'baz',
        type: 'concurrent' as const,
        timestamps: { a: new Date(), b: new Date() }
      }
    ];

    const result = await strategy.resolve(conflicts);
    expect(result.state).toEqual({ foo: 'bar' });
  });
});

describe('OperationalTransformStrategy', () => {
  it('should merge concurrent array updates', async () => {
    const strategy = new OperationalTransformStrategy();
    const conflicts = [
      {
        path: 'items',
        valueA: [1, 2, 3],
        valueB: [4, 5],
        type: 'concurrent' as const,
        timestamps: { a: new Date(), b: new Date() }
      }
    ];

    const result = await strategy.resolve(conflicts);
    expect(Array.isArray(result.state.items)).toBe(true);
  });

  it('should merge concurrent object updates', async () => {
    const strategy = new OperationalTransformStrategy();
    const conflicts = [
      {
        path: 'user',
        valueA: { name: 'John' },
        valueB: { age: 30 },
        type: 'concurrent' as const,
        timestamps: { a: new Date(), b: new Date() }
      }
    ];

    const result = await strategy.resolve(conflicts);
    expect(result.state).toEqual({ user: { name: 'John', age: 30 } });
  });
});

describe('CRDTStrategy', () => {
  it('should use max for counters', async () => {
    const strategy = new CRDTStrategy();
    const conflicts = [
      {
        path: 'counter',
        valueA: 5,
        valueB: 10,
        type: 'concurrent' as const,
        timestamps: { a: new Date(), b: new Date() }
      }
    ];

    const result = await strategy.resolve(conflicts);
    expect(result.state).toEqual({ counter: 10 });
  });

  it('should merge arrays with LWW', async () => {
    const strategy = new CRDTStrategy();
    const conflicts = [
      {
        path: 'items',
        valueA: [1, 2],
        valueB: [2, 3],
        type: 'concurrent' as const,
        timestamps: { a: new Date(1000), b: new Date(2000) }
      }
    ];

    const result = await strategy.resolve(conflicts);
    expect(Array.isArray(result.state.items)).toBe(true);
  });
});

describe('VectorClock', () => {
  it('should increment clock for node', () => {
    const clock = new VectorClock();
    clock.increment('node1');

    const obj = clock.toObject();
    expect(obj.node1).toBe(1);
  });

  it('should merge vector clocks', () => {
    const clock1 = new VectorClock();
    const clock2 = new VectorClock();

    clock1.increment('node1');
    clock2.increment('node2');

    clock1.merge(clock2);

    const obj = clock1.toObject();
    expect(obj.node1).toBe(1);
    expect(obj.node2).toBe(1);
  });

  it('should compare clocks - before', () => {
    const clock1 = new VectorClock();
    const clock2 = new VectorClock();

    clock1.increment('node1');

    expect(clock1.compare(clock2)).toBe('after');
    expect(clock2.compare(clock1)).toBe('before');
  });

  it('should compare clocks - concurrent', () => {
    const clock1 = new VectorClock();
    const clock2 = new VectorClock();

    clock1.increment('node1');
    clock2.increment('node2');

    expect(clock1.compare(clock2)).toBe('concurrent');
  });

  it('should compare clocks - equal', () => {
    const clock1 = new VectorClock();
    const clock2 = new VectorClock();

    expect(clock1.compare(clock2)).toBe('equal');
  });

  it('should create clock from object', () => {
    const obj = { node1: 5, node2: 3 };
    const clock = VectorClock.fromObject(obj);

    expect(clock.toObject()).toEqual(obj);
  });
});

describe('threeWayMerge', () => {
  it('should merge without conflicts', () => {
    const base = { foo: 'bar', baz: 1 };
    const left = { foo: 'bar', baz: 1, qux: 2 };
    const right = { foo: 'bar', baz: 1, new: 3 };

    const result = threeWayMerge(base, left, right);
    expect(result.conflicts).toHaveLength(0);
    expect(result.merged).toEqual({ foo: 'bar', baz: 1, qux: 2, new: 3 });
  });

  it('should handle keys only in left', () => {
    const base = { foo: 'bar' };
    const left = { foo: 'bar', onlyLeft: 1 };
    const right = { foo: 'bar' };

    const result = threeWayMerge(base, left, right);
    expect(result.merged).toEqual({ foo: 'bar', onlyLeft: 1 });
  });

  it('should handle keys only in right', () => {
    const base = { foo: 'bar' };
    const left = { foo: 'bar' };
    const right = { foo: 'bar', onlyRight: 2 };

    const result = threeWayMerge(base, left, right);
    expect(result.merged).toEqual({ foo: 'bar', onlyRight: 2 });
  });

  it('should handle keys modified in one branch', () => {
    const base = { foo: 'bar', baz: 1 };
    const left = { foo: 'bar', baz: 1 };
    const right = { foo: 'bar', baz: 2 };

    const result = threeWayMerge(base, left, right);
    expect(result.merged).toEqual({ foo: 'bar', baz: 2 });
  });

  it('should detect concurrent modifications', () => {
    const base = { foo: 'bar' };
    const left = { foo: 'baz' };
    const right = { foo: 'qux' };

    const result = threeWayMerge(base, left, right);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].path).toBe('foo');
  });

  it('should handle nested objects', () => {
    const base = { user: { name: 'John', age: 30 } };
    const left = { user: { name: 'John', age: 30, city: 'NYC' } };
    const right = { user: { name: 'John', age: 31 } };

    const result = threeWayMerge(base, left, right);
    expect(result.merged).toEqual({ user: { name: 'John', age: 31, city: 'NYC' } });
  });
});

describe('createConflictResolver', () => {
  it('should create conflict resolver', () => {
    const resolver = createConflictResolver();
    expect(resolver).toBeInstanceOf(ConflictResolver);
  });
});

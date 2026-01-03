/**
 * @lsi/langgraph-state - Type Tests
 */

import { describe, it, expect } from 'vitest';
import {
  createStateVersion,
  parseStateVersion,
  isVersionCompatible,
  generateStateId,
  generateChecksum,
  calculateStateSize,
  cloneState,
  deepMerge
} from '../src/types.js';

describe('StateVersion', () => {
  describe('createStateVersion', () => {
    it('should create version without branch', () => {
      const version = createStateVersion(1, 2, 3);
      expect(version.major).toBe(1);
      expect(version.minor).toBe(2);
      expect(version.patch).toBe(3);
      expect(version.branch).toBeUndefined();
      expect(version.toString()).toBe('1.2.3');
    });

    it('should create version with branch', () => {
      const version = createStateVersion(1, 2, 3, 'feature');
      expect(version.branch).toBe('feature');
      expect(version.toString()).toBe('1.2.3+feature');
    });

    it('should compare versions correctly', () => {
      const v1 = createStateVersion(1, 0, 0);
      const v2 = createStateVersion(1, 0, 1);
      const v3 = createStateVersion(2, 0, 0);

      expect(v1.compare(v2)).toBeLessThan(0);
      expect(v2.compare(v1)).toBeGreaterThan(0);
      expect(v1.compare(v1)).toBe(0);
      expect(v3.compare(v1)).toBeGreaterThan(0);
    });

    it('should compare versions with branches', () => {
      const v1 = createStateVersion(1, 0, 0, 'main');
      const v2 = createStateVersion(1, 0, 0, 'feature');

      expect(v1.compare(v2)).toBeLessThan(0);
      expect(v2.compare(v1)).toBeGreaterThan(0);
    });
  });

  describe('parseStateVersion', () => {
    it('should parse version without branch', () => {
      const version = parseStateVersion('1.2.3');
      expect(version.major).toBe(1);
      expect(version.minor).toBe(2);
      expect(version.patch).toBe(3);
      expect(version.branch).toBeUndefined();
    });

    it('should parse version with branch', () => {
      const version = parseStateVersion('1.2.3+feature');
      expect(version.major).toBe(1);
      expect(version.minor).toBe(2);
      expect(version.patch).toBe(3);
      expect(version.branch).toBe('feature');
    });

    it('should throw on invalid version', () => {
      expect(() => parseStateVersion('invalid')).toThrow();
      expect(() => parseStateVersion('1.2')).toThrow();
    });
  });

  describe('isVersionCompatible', () => {
    it('should check major version compatibility', () => {
      const v1 = createStateVersion(1, 0, 0);
      const v2 = createStateVersion(1, 2, 0);
      const v3 = createStateVersion(2, 0, 0);

      expect(isVersionCompatible(v1, v1)).toBe(true);
      expect(isVersionCompatible(v2, v1)).toBe(true);
      expect(isVersionCompatible(v3, v1)).toBe(false);
    });

    it('should check minor version compatibility', () => {
      const v1 = createStateVersion(1, 0, 0);
      const v2 = createStateVersion(1, 1, 0);
      const v3 = createStateVersion(1, 0, 1);

      expect(isVersionCompatible(v1, v1)).toBe(true);
      expect(isVersionCompatible(v2, v1)).toBe(true);
      expect(isVersionCompatible(v3, v1)).toBe(false);
    });
  });
});

describe('generateStateId', () => {
  it('should generate unique IDs', () => {
    const id1 = generateStateId();
    const id2 = generateStateId();

    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^state_\d+_[a-z0-9]+$/);
  });

  it('should generate IDs with correct prefix', () => {
    const id = generateStateId();
    expect(id.startsWith('state_')).toBe(true);
  });
});

describe('generateChecksum', () => {
  it('should generate consistent checksums', async () => {
    const data = { foo: 'bar' };
    const checksum1 = await generateChecksum(data);
    const checksum2 = await generateChecksum(data);

    expect(checksum1).toBe(checksum2);
  });

  it('should generate different checksums for different data', async () => {
    const checksum1 = await generateChecksum({ foo: 'bar' });
    const checksum2 = await generateChecksum({ foo: 'baz' });

    expect(checksum1).not.toBe(checksum2);
  });

  it('should handle nested objects', async () => {
    const data = { foo: { bar: { baz: 'qux' } } };
    const checksum = await generateChecksum(data);

    expect(checksum).toBeTruthy();
    expect(typeof checksum).toBe('string');
  });

  it('should handle arrays', async () => {
    const data = [1, 2, 3, { foo: 'bar' }];
    const checksum = await generateChecksum(data);

    expect(checksum).toBeTruthy();
  });
});

describe('calculateStateSize', () => {
  it('should calculate size of simple object', () => {
    const size = calculateStateSize({ foo: 'bar' });
    expect(size).toBeGreaterThan(0);
  });

  it('should calculate size of nested object', () => {
    const size = calculateStateSize({ foo: { bar: { baz: 'qux' } } });
    expect(size).toBeGreaterThan(0);
  });

  it('should calculate size of array', () => {
    const size = calculateStateSize([1, 2, 3]);
    expect(size).toBeGreaterThan(0);
  });

  it('should calculate size of string', () => {
    const size1 = calculateStateSize('short');
    const size2 = calculateStateSize('a much longer string');

    expect(size2).toBeGreaterThan(size1);
  });
});

describe('cloneState', () => {
  it('should clone simple object', () => {
    const original = { foo: 'bar', baz: 42 };
    const cloned = cloneState(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
  });

  it('should clone nested object', () => {
    const original = { foo: { bar: { baz: 'qux' } } };
    const cloned = cloneState(original);

    expect(cloned).toEqual(original);
    expect(cloned.foo).not.toBe(original.foo);
    expect(cloned.foo.bar).not.toBe(original.foo.bar);
  });

  it('should clone arrays', () => {
    const original = [1, 2, 3, { foo: 'bar' }];
    const cloned = cloneState(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned[3]).not.toBe(original[3]);
  });

  it('should create independent copy', () => {
    const original = { foo: 'bar' };
    const cloned = cloneState(original);

    cloned.foo = 'baz';

    expect(original.foo).toBe('bar');
    expect(cloned.foo).toBe('baz');
  });
});

describe('deepMerge', () => {
  it('should merge simple objects', () => {
    const base = { foo: 'bar' };
    const update = { baz: 'qux' };
    const result = deepMerge(base, update);

    expect(result).toEqual({ foo: 'bar', baz: 'qux' });
  });

  it('should merge nested objects', () => {
    const base = { foo: { bar: 'baz' } };
    const update = { foo: { qux: 'quux' } };
    const result = deepMerge(base, update);

    expect(result).toEqual({ foo: { bar: 'baz', qux: 'quux' } });
  });

  it('should overwrite values', () => {
    const base = { foo: 'bar' };
    const update = { foo: 'baz' };
    const result = deepMerge(base, update);

    expect(result).toEqual({ foo: 'baz' });
  });

  it('should handle arrays by replacing', () => {
    const base = { foo: [1, 2, 3] };
    const update = { foo: [4, 5] };
    const result = deepMerge(base, update);

    expect(result).toEqual({ foo: [4, 5] });
  });

  it('should handle null values', () => {
    const base = { foo: null };
    const update = { bar: 'baz' };
    const result = deepMerge(base, update);

    expect(result).toEqual({ foo: null, bar: 'baz' });
  });

  it('should handle undefined values', () => {
    const base = { foo: 'bar' };
    const update = { foo: undefined };
    const result = deepMerge(base, update);

    expect(result.foo).toBeUndefined();
  });

  it('should not modify original objects', () => {
    const base = { foo: 'bar' };
    const update = { baz: 'qux' };
    const result = deepMerge(base, update);

    expect(base).toEqual({ foo: 'bar' });
    expect(update).toEqual({ baz: 'qux' });
    expect(result).toEqual({ foo: 'bar', baz: 'qux' });
  });
});

describe('State Scope Types', () => {
  it('should have correct scope values', () => {
    const scopes = ['global', 'agent', 'session', 'thread'] as const;

    for (const scope of scopes) {
      expect(scope).toBeTruthy();
    }
  });
});

describe('State Strategy Types', () => {
  it('should have correct strategy values', () => {
    const strategies = ['merge', 'replace', 'append', 'custom'] as const;

    for (const strategy of strategies) {
      expect(strategy).toBeTruthy();
    }
  });
});

describe('StateDiff', () => {
  it('should create diff structure', () => {
    const diff = {
      identical: false,
      added: new Map([['foo', 'bar']]),
      updated: new Map([['baz', { oldValue: 1, newValue: 2 }]]),
      deleted: new Map([['qux', 'removed']]),
      moved: new Map()
    };

    expect(diff.identical).toBe(false);
    expect(diff.added.size).toBe(1);
    expect(diff.updated.size).toBe(1);
    expect(diff.deleted.size).toBe(1);
  });
});

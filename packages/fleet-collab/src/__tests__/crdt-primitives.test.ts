/**
 * Tests for CRDT primitives: GCounter, PNCounter, LWWRegister, ORSet, LWWMap
 */
import { describe, it, expect } from 'vitest';
import { GCounter, PNCounter, LWWRegister, ORSet, LWWMap } from '../crdt-primitives.js';

// ============================================================================
// G-COUNTER TESTS
// ============================================================================

describe('GCounter', () => {
  it('should start at zero', () => {
    const c = new GCounter();
    expect(c.value()).toBe(0);
  });

  it('should increment by a single node', () => {
    const c = new GCounter();
    c.increment('node1');
    expect(c.value()).toBe(1);
  });

  it('should accumulate multiple increments', () => {
    const c = new GCounter();
    c.increment('node1', 5);
    c.increment('node1', 3);
    expect(c.value()).toBe(8);
  });

  it('should sum across multiple nodes', () => {
    const c = new GCounter();
    c.increment('node1', 5);
    c.increment('node2', 10);
    c.increment('node3', 3);
    expect(c.value()).toBe(18);
  });

  it('should merge correctly taking max per node', () => {
    const c1 = new GCounter();
    c1.increment('node1', 5);
    c1.increment('node2', 3);

    const c2 = new GCounter();
    c2.increment('node2', 7);
    c2.increment('node3', 4);

    c1.merge(c2);
    expect(c1.value()).toBe(5 + 7 + 4); // 16
  });

  it('should reject negative increments', () => {
    const c = new GCounter();
    expect(() => c.increment('node1', -1)).toThrow('GCounter can only increment');
  });

  it('should serialize and deserialize correctly', () => {
    const c = new GCounter();
    c.increment('node1', 5);
    c.increment('node2', 10);
    const json = c.toJSON();
    const restored = GCounter.fromJSON(json);
    expect(restored.value()).toBe(15);
  });

  it('should clone correctly', () => {
    const c = new GCounter();
    c.increment('node1', 42);
    const clone = c.clone();
    expect(clone.value()).toBe(42);
    clone.increment('node1', 1);
    expect(c.value()).toBe(42); // original unchanged
  });
});

// ============================================================================
// PN-COUNTER TESTS
// ============================================================================

describe('PNCounter', () => {
  it('should start at zero', () => {
    const c = new PNCounter();
    expect(c.value()).toBe(0);
  });

  it('should increment and decrement correctly', () => {
    const c = new PNCounter();
    c.increment('node1', 10);
    c.decrement('node1', 3);
    expect(c.value()).toBe(7);
  });

  it('should provide positive/negative breakdown', () => {
    const c = new PNCounter();
    c.increment('node1', 10);
    c.decrement('node1', 3);
    expect(c.positiveValue()).toBe(10);
    expect(c.negativeValue()).toBe(3);
  });

  it('should merge correctly', () => {
    const c1 = new PNCounter();
    c1.increment('node1', 10);
    c1.decrement('node1', 3);

    const c2 = new PNCounter();
    c2.increment('node2', 5);
    c2.decrement('node2', 8);

    c1.merge(c2);
    expect(c1.value()).toBe(7 + (5 - 8)); // 4
  });

  it('should serialize and deserialize correctly', () => {
    const c = new PNCounter();
    c.increment('node1', 10);
    c.decrement('node1', 3);
    const json = c.toJSON();
    const restored = PNCounter.fromJSON(json);
    expect(restored.value()).toBe(7);
  });
});

// ============================================================================
// LWW-REGISTER TESTS
// ============================================================================

describe('LWWRegister', () => {
  it('should store and return a value', () => {
    const r = new LWWRegister('hello');
    expect(r.value).toBe('hello');
  });

  it('should update value', () => {
    const r = new LWWRegister('hello');
    r.set('world');
    expect(r.value).toBe('world');
    expect(r.timestamp).toBeGreaterThan(0);
  });

  it('should merge with later timestamp winning', () => {
    const r1 = new LWWRegister('old');
    const r2 = new LWWRegister('new');
    // r2 was created later, so it has a later timestamp
    // But we need to ensure the timestamps differ
    r1.setWithTimestamp('old-v2', 100, 'node1');
    r2.setWithTimestamp('new-v2', 200, 'node2');

    r1.merge(r2);
    expect(r1.value).toBe('new-v2');
  });

  it('should merge with earlier timestamp losing', () => {
    const r1 = new LWWRegister('new');
    const r2 = new LWWRegister('old');
    r1.setWithTimestamp('new-v2', 200, 'node1');
    r2.setWithTimestamp('old-v2', 100, 'node2');

    r1.merge(r2);
    expect(r1.value).toBe('new-v2');
  });

  it('should break ties by node ID', () => {
    const r1 = new LWWRegister('a');
    const r2 = new LWWRegister('b');
    r1.setWithTimestamp('a', 100, 'nodeA');
    r2.setWithTimestamp('b', 100, 'nodeB');

    r1.merge(r2);
    // nodeB > nodeA lexicographically, so 'b' wins
    expect(r1.value).toBe('b');
  });

  it('should serialize and deserialize correctly', () => {
    const r = new LWWRegister(42);
    r.setWithTimestamp(42, 100, 'node1');
    const json = r.toJSON();
    const restored = LWWRegister.fromJSON(json);
    expect(restored.value).toBe(42);
    expect(restored.timestamp).toBe(100);
  });
});

// ============================================================================
// OR-SET TESTS
// ============================================================================

describe('ORSet', () => {
  it('should start empty', () => {
    const s = new ORSet();
    expect(s.size()).toBe(0);
    expect(s.isEmpty()).toBe(true);
  });

  it('should add elements', () => {
    const s = new ORSet<string>();
    s.add('a', 'node1');
    s.add('b', 'node1');
    expect(s.size()).toBe(2);
    expect(s.has('a')).toBe(true);
    expect(s.has('b')).toBe(true);
  });

  it('should remove elements', () => {
    const s = new ORSet<string>();
    s.add('a', 'node1');
    s.add('b', 'node1');
    s.remove('a');
    expect(s.has('a')).toBe(false);
    expect(s.size()).toBe(1);
  });

  it('should handle concurrent add-remove (add wins)', () => {
    const s1 = new ORSet<string>();
    const s2 = new ORSet<string>();

    s1.add('item', 'node1');
    s1.remove('item');

    s2.add('item', 'node2');

    s1.merge(s2);
    // node2 added after node1 removed, so item should be present
    expect(s1.has('item')).toBe(true);
  });

  it('should merge correctly - union of elements', () => {
    const s1 = new ORSet<string>();
    const s2 = new ORSet<string>();

    s1.add('a', 'node1');
    s1.add('b', 'node1');
    s2.add('b', 'node2');
    s2.add('c', 'node2');

    s1.merge(s2);
    expect(s1.size()).toBe(3);
    expect(s1.has('a')).toBe(true);
    expect(s1.has('b')).toBe(true);
    expect(s1.has('c')).toBe(true);
  });

  it('should handle duplicate adds', () => {
    const s = new ORSet<string>();
    s.add('a', 'node1');
    s.add('a', 'node1');
    expect(s.size()).toBe(1);
  });

  it('should return values', () => {
    const s = new ORSet<string>();
    s.add('x', 'node1');
    s.add('y', 'node1');
    const vals = s.values();
    expect(vals).toContain('x');
    expect(vals).toContain('y');
  });

  it('should serialize and deserialize correctly', () => {
    const s = new ORSet<string>();
    s.add('a', 'node1');
    s.add('b', 'node2');
    const json = s.toJSON();
    const restored = ORSet.fromJSON<string>(json);
    expect(restored.size()).toBe(2);
    expect(restored.has('a')).toBe(true);
    expect(restored.has('b')).toBe(true);
  });
});

// ============================================================================
// LWW-MAP TESTS
// ============================================================================

describe('LWWMap', () => {
  it('should start empty', () => {
    const m = new LWWMap();
    expect(m.size()).toBe(0);
  });

  it('should set and get values', () => {
    const m = new LWWMap();
    m.set('key1', 'value1', 'node1');
    expect(m.get('key1')).toBe('value1');
    expect(m.size()).toBe(1);
  });

  it('should overwrite with later write', () => {
    const m = new LWWMap();
    m.set('key1', 'old', 'node1');
    m.set('key1', 'new', 'node2');
    // Second set happens later in time
    expect(m.get('key1')).toBe('new');
  });

  it('should delete keys', () => {
    const m = new LWWMap();
    m.set('key1', 'value', 'node1');
    m.delete('key1', 'node1');
    expect(m.has('key1')).toBe(false);
  });

  it('should merge correctly', () => {
    const m1 = new LWWMap();
    m1.set('a', 1, 'node1');
    m1.set('b', 2, 'node1');

    const m2 = new LWWMap();
    m2.set('b', 20, 'node2'); // later write wins
    m2.set('c', 3, 'node2');

    m1.merge(m2);
    expect(m1.get('a')).toBe(1);
    expect(m1.get('b')).toBe(20);
    expect(m1.get('c')).toBe(3);
  });

  it('should list keys and entries', () => {
    const m = new LWWMap();
    m.set('a', 1, 'node1');
    m.set('b', 2, 'node1');
    expect(m.keys().sort()).toEqual(['a', 'b']);
    expect(m.entries_list().length).toBe(2);
  });

  it('should serialize and deserialize correctly', () => {
    const m = new LWWMap();
    m.set('a', 1, 'node1');
    const json = m.toJSON();
    const restored = LWWMap.fromJSON(json);
    expect(restored.get('a')).toBe(1);
  });
});

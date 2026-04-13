/**
 * @file crdt-primitives.ts - Pure TypeScript CRDT primitives for fleet collaboration
 * @module @lsi/fleet-collab/crdt-primitives
 *
 * Lightweight CRDT implementations that do NOT depend on native modules or Buffer.
 * These are self-contained, testable, and merge-safe data types for multi-agent coordination.
 */

import { AgentId } from './types.js';

// ============================================================================
// G-COUNTER (Grow-only Counter)
// ============================================================================

/**
 * G-Counter: a grow-only counter where each replica tracks its own increments.
 * Merging takes the maximum per-replica value, guaranteeing convergence.
 *
 * Use case: counting total tasks completed, messages sent, etc.
 */
export class GCounter {
  private counts: Map<string, number> = new Map();

  increment(node: string, amount: number = 1): void {
    if (amount < 0) throw new Error('GCounter can only increment (amount must be >= 0)');
    const current = this.counts.get(node) || 0;
    this.counts.set(node, current + amount);
  }

  value(): number {
    let sum = 0;
    for (const v of this.counts.values()) sum += v;
    return sum;
  }

  /** Per-node count */
  getNodeCount(node: string): number {
    return this.counts.get(node) || 0;
  }

  getNodes(): string[] {
    return Array.from(this.counts.keys());
  }

  /** Merge takes max per node — commutative, associative, idempotent */
  merge(other: GCounter): void {
    for (const [node, count] of other.counts) {
      const current = this.counts.get(node) || 0;
      this.counts.set(node, Math.max(current, count));
    }
  }

  /** Returns a serializable plain object */
  toJSON(): Record<string, number> {
    return Object.fromEntries(this.counts);
  }

  static fromJSON(data: Record<string, number>): GCounter {
    const c = new GCounter();
    for (const [k, v] of Object.entries(data)) {
      c.counts.set(k, v);
    }
    return c;
  }

  clone(): GCounter {
    return GCounter.fromJSON(this.toJSON());
  }
}

// ============================================================================
// PN-COUNTER (Positive-Negative Counter)
// ============================================================================

/**
 * PN-Counter: supports both increments and decrements by internally
 * maintaining a G-Counter for positive and a G-Counter for negative.
 *
 * Use case: task queue depth, error counts that can be corrected.
 */
export class PNCounter {
  private p: Map<string, number> = new Map();
  private n: Map<string, number> = new Map();

  increment(node: string, amount: number = 1): void {
    if (amount < 0) throw new Error('Increment amount must be >= 0');
    const current = this.p.get(node) || 0;
    this.p.set(node, current + amount);
  }

  decrement(node: string, amount: number = 1): void {
    if (amount < 0) throw new Error('Decrement amount must be >= 0');
    const current = this.n.get(node) || 0;
    this.n.set(node, current + amount);
  }

  value(): number {
    let pSum = 0;
    for (const v of this.p.values()) pSum += v;
    let nSum = 0;
    for (const v of this.n.values()) nSum += v;
    return pSum - nSum;
  }

  positiveValue(): number {
    let s = 0;
    for (const v of this.p.values()) s += v;
    return s;
  }

  negativeValue(): number {
    let s = 0;
    for (const v of this.n.values()) s += v;
    return s;
  }

  /** Merge takes max for both positive and negative counters per node */
  merge(other: PNCounter): void {
    for (const [node, count] of other.p) {
      this.p.set(node, Math.max(this.p.get(node) || 0, count));
    }
    for (const [node, count] of other.n) {
      this.n.set(node, Math.max(this.n.get(node) || 0, count));
    }
  }

  toJSON(): { p: Record<string, number>; n: Record<string, number> } {
    return {
      p: Object.fromEntries(this.p),
      n: Object.fromEntries(this.n),
    };
  }

  static fromJSON(data: { p: Record<string, number>; n: Record<string, number> }): PNCounter {
    const c = new PNCounter();
    for (const [k, v] of Object.entries(data.p)) c.p.set(k, v);
    for (const [k, v] of Object.entries(data.n)) c.n.set(k, v);
    return c;
  }

  clone(): PNCounter {
    return PNCounter.fromJSON(this.toJSON());
  }
}

// ============================================================================
// LWW-REGISTER (Last-Writer-Wins Register)
// ============================================================================

/**
 * LWW-Register: stores a single value that is updated with a timestamp.
 * On merge, the value with the latest timestamp wins.
 * Ties are broken by comparing node IDs for deterministic resolution.
 *
 * Use case: configuration values, current fleet coordinator, agent status.
 */
export class LWWRegister<T = unknown> {
  private _value: T;
  private _timestamp: number;
  private _node: string;

  constructor(initialValue: T, node?: string) {
    this._value = initialValue;
    this._timestamp = Date.now();
    this._node = node || '';
  }

  get value(): T {
    return this._value;
  }

  get timestamp(): number {
    return this._timestamp;
  }

  set(value: T, node?: string): void {
    this._value = value;
    this._timestamp = Date.now();
    this._node = node || this._node;
  }

  /** Set with explicit timestamp (useful for testing) */
  setWithTimestamp(value: T, timestamp: number, node: string): void {
    this._value = value;
    this._timestamp = timestamp;
    this._node = node;
  }

  merge(other: LWWRegister<T>): void {
    // LWW: later timestamp wins; ties broken by node ID comparison
    if (other._timestamp > this._timestamp) {
      this._value = other._value;
      this._timestamp = other._timestamp;
      this._node = other._node;
    } else if (other._timestamp === this._timestamp && other._node > this._node) {
      this._value = other._value;
      this._timestamp = other._timestamp;
      this._node = other._node;
    }
  }

  toJSON(): { value: T; timestamp: number; node: string } {
    return { value: this._value, timestamp: this._timestamp, node: this._node };
  }

  static fromJSON<T>(data: { value: T; timestamp: number; node: string }): LWWRegister<T> {
    const r = new LWWRegister<T>(data.value);
    r._timestamp = data.timestamp;
    r._node = data.node;
    return r;
  }

  clone(): LWWRegister<T> {
    return LWWRegister.fromJSON(this.toJSON());
  }
}

// ============================================================================
// OR-SET (Observed-Remove Set)
// ============================================================================

/**
 * OR-Set: a CRDT set supporting add and remove with proper semantics.
 * Each element is tagged with a unique (node, uniqueId) pair.
 * Remove adds the observed tags to a tombstone set; merge union's tags
 * but respects tombstones, so a concurrent add after remove wins.
 *
 * Use case: fleet membership, task tags, capability sets.
 */
export class ORSet<T = string> {
  // element -> Set of unique tags
  private elements: Map<string, { raw: T; tags: Set<string> }> = new Map();
  private tombstones: Set<string> = new Set();

  private static _tagCounter = 0;

  private static nextTag(node: string): string {
    return `${node}:${Date.now()}:${++ORSet._tagCounter}`;
  }

  add(element: T, node: string): void {
    const key = this._key(element);
    const entry = this.elements.get(key);
    const tag = ORSet.nextTag(node);

    if (entry) {
      // If all existing tags are tombstoned, treat as fresh add
      const allDead = entry.tags.size > 0 &&
        Array.from(entry.tags).every(t => this.tombstones.has(t));
      if (allDead) {
        entry.tags.clear();
      }
      entry.tags.add(tag);
    } else {
      this.elements.set(key, { raw: element, tags: new Set([tag]) });
    }
  }

  remove(element: T): void {
    const key = this._key(element);
    const entry = this.elements.get(key);
    if (entry) {
      for (const tag of entry.tags) {
        this.tombstones.add(tag);
      }
      this.elements.delete(key);
    }
  }

  has(element: T): boolean {
    const key = this._key(element);
    const entry = this.elements.get(key);
    if (!entry) return false;
    // Element exists if at least one live (non-tombstoned) tag
    return Array.from(entry.tags).some(t => !this.tombstones.has(t));
  }

  values(): T[] {
    const result: T[] = [];
    for (const [, entry] of this.elements) {
      if (Array.from(entry.tags).some(t => !this.tombstones.has(t))) {
        result.push(entry.raw);
      }
    }
    return result;
  }

  size(): number {
    return this.values().length;
  }

  isEmpty(): boolean {
    return this.size() === 0;
  }

  /** Merge: union tags and tombstones */
  merge(other: ORSet<T>): void {
    for (const [key, otherEntry] of other.elements) {
      const myEntry = this.elements.get(key);
      if (myEntry) {
        // Merge tags
        for (const tag of otherEntry.tags) {
          myEntry.tags.add(tag);
        }
      } else {
        // Clone entry
        this.elements.set(key, {
          raw: otherEntry.raw,
          tags: new Set(otherEntry.tags),
        });
      }
    }
    // Merge tombstones
    for (const tag of other.tombstones) {
      this.tombstones.add(tag);
    }
    // Cleanup: remove elements whose all tags are tombstoned
    for (const [key, entry] of this.elements) {
      if (Array.from(entry.tags).every(t => this.tombstones.has(t))) {
        this.elements.delete(key);
      }
    }
  }

  private _key(element: T): string {
    return JSON.stringify(element);
  }

  toJSON(): { elements: Array<[string, T, string[]]>; tombstones: string[] } {
    const els: Array<[string, T, string[]]> = [];
    for (const [key, entry] of this.elements) {
      els.push([key, entry.raw, Array.from(entry.tags)]);
    }
    return { elements: els, tombstones: Array.from(this.tombstones) };
  }

  static fromJSON<T>(data: { elements: Array<[string, T, string[]]>; tombstones: string[] }): ORSet<T> {
    const s = new ORSet<T>();
    for (const [key, raw, tags] of data.elements) {
      s.elements.set(key, { raw, tags: new Set(tags) });
    }
    s.tombstones = new Set(data.tombstones);
    return s;
  }

  clone(): ORSet<T> {
    return ORSet.fromJSON(this.toJSON());
  }
}

// ============================================================================
// LWW-MAP (Last-Writer-Wins Map)
// ============================================================================

/**
 * LWW-Map: a map of string keys to LWW-Registers.
 * Each key's value is independently resolved by LWW semantics.
 *
 * Use case: configuration store, fleet metadata.
 */
export class LWWMap {
  private entries: Map<string, LWWRegister> = new Map();

  set(key: string, value: unknown, node: string): void {
    let reg = this.entries.get(key);
    if (!reg) {
      reg = new LWWRegister(value, node);
      this.entries.set(key, reg);
    } else {
      reg.set(value, node);
    }
  }

  get(key: string): unknown | undefined {
    const reg = this.entries.get(key);
    return reg?.value;
  }

  has(key: string): boolean {
    const reg = this.entries.get(key);
    if (!reg) return false;
    // A deleted (tombstoned) entry has undefined value
    return reg.value !== undefined;
  }

  delete(key: string, node: string): void {
    // LWW-Map deletion: set a tombstone register
    const reg = this.entries.get(key);
    const ts = (reg?.timestamp || 0) + 1;
    const tombstone = new LWWRegister(undefined, node);
    tombstone.setWithTimestamp(undefined, ts, node + ':delete');
    this.entries.set(key, tombstone);
  }

  keys(): string[] {
    const result: string[] = [];
    for (const [key, reg] of this.entries) {
      if (reg.value !== undefined) {
        result.push(key);
      }
    }
    return result;
  }

  entries_list(): Array<[string, unknown]> {
    const result: Array<[string, unknown]> = [];
    for (const [key, reg] of this.entries) {
      if (reg.value !== undefined) {
        result.push([key, reg.value]);
      }
    }
    return result;
  }

  size(): number {
    return this.keys().length;
  }

  merge(other: LWWMap): void {
    for (const [key, otherReg] of other.entries) {
      const myReg = this.entries.get(key);
      if (myReg) {
        myReg.merge(otherReg);
      } else {
        this.entries.set(key, otherReg.clone());
      }
    }
  }

  toJSON(): Record<string, { value: unknown; timestamp: number; node: string }> {
    const result: Record<string, { value: unknown; timestamp: number; node: string }> = {};
    for (const [key, reg] of this.entries) {
      result[key] = reg.toJSON() as { value: unknown; timestamp: number; node: string };
    }
    return result;
  }

  static fromJSON(data: Record<string, { value: unknown; timestamp: number; node: string }>): LWWMap {
    const m = new LWWMap();
    for (const [key, val] of Object.entries(data)) {
      const reg = LWWRegister.fromJSON(val);
      m.entries.set(key, reg);
    }
    return m;
  }

  clone(): LWWMap {
    return LWWMap.fromJSON(this.toJSON());
  }
}

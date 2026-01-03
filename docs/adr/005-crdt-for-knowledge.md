# ADR 005: CRDT for Knowledge Storage

**Status:** Accepted
**Date:** 2025-02-05
**Deciders:** Aequor Core Team
**Related:** ADR-002 (Three-Plane Separation), ADR-001 (Protocol-First Design)

---

## Context

The Aequor Cognitive Orchestration Platform requires a distributed knowledge storage system that supports:

1. **Multi-device synchronization** - Users have multiple devices (phone, laptop, desktop)
2. **Multi-agent collaboration** - Multiple AI agents work on shared knowledge
3. **Offline-first operation** - Users can work without internet
4. **Conflict resolution** - Concurrent updates from multiple sources
5. **Eventual consistency** - All devices converge to same state

### Conventional Approaches (Insufficient)

| Approach | Description | Problem |
|----------|-------------|---------|
| **Centralized DB** | Single source of truth | No offline, single point of failure |
| **Last-Write-Wins** | Most recent update wins | Data loss, no merge |
| **Lock-based** | Lock records during update | No offline, poor UX |
| **Manual Sync** | Custom conflict resolution | Complex, error-prone |

### The Opportunity

**Conflict-free Replicated Data Types (CRDTs)** provide:

1. **Strong Eventual Consistency** - All replicas converge without coordination
2. **Offline-First** - Updates work without network
3. **Automatic Merging** - No conflict resolution needed
4. **Mathematical Guarantees** - Proven correctness
5. **Scalability** - P2P synchronization possible

---

## Decision

**Use CRDTs (Conflict-free Replicated Data Types) for distributed knowledge storage in ContextPlane.**

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CRDT-Based Knowledge Storage                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Device A (Laptop)          Device B (Phone)         Cloud       │
│  ┌──────────────┐          ┌──────────────┐       ┌──────────┐  │
│  │ ContextPlane │          │ ContextPlane │       │  Sync    │  │
│  │              │          │              │       │ Service  │  │
│  │  CRDTStore   │          │  CRDTStore   │       │          │  │
│  └──────┬───────┘          └──────┬───────┘       └─────┬────┘  │
│         │                        │                     │        │
│         │ 1. Offline update      │ 2. Offline update  │        │
│         ▼                        ▼                     │        │
│  ┌──────────────┐          ┌──────────────┐            │        │
│  │ G-Counter    │          │ G-Counter    │            │        │
│  │ value: 5     │          │ value: 3     │            │        │
│  └──────────────┘          └──────────────┘            │        │
│         │                        │                     │        │
│         │ 3. Sync to cloud       │ 4. Sync to cloud    │        │
│         └────────────┬───────────┘─────┘               │        │
│                      ▼                                 │        │
│              ┌──────────────┐                          │        │
│              │ Cloud Merge  │                          │        │
│              │              │                          │        │
│              │ max(5, 3)    │                          │        │
│              │ = 5         │                          │        │
│              └──────┬───────┘                          │        │
│                     │                                  │        │
│                     │ 5. Broadcast merge               │        │
│                     ▼                                  │        │
│         ┌──────────────────────┐                       │        │
│         │  All devices: 5      │                       │        │
│         └──────────────────────┘                       │        │
│                                                           │        │
│  Key Properties:                                          │        │
│  • No conflicts (automatic merge)                         │        │
│  • Offline-first (works without network)                 │        │
│  • Eventual consistency (all converge)                    │        │
│  • Mathematical guarantees (proven correct)              │        │
│                                                           │        │
└─────────────────────────────────────────────────────────────────┘
```

### CRDT Types Implemented

#### 1. G-Counter (Grow-only Counter)

**Use case:** Count queries, cache hits, metrics

```typescript
// packages/swarm/src/crdt/GCounter.ts

export interface GCounter {
  /**
   * Increment counter for this replica
   */
  increment(): void;

  /**
   * Get current value
   */
  value(): number;

  /**
   * Merge with another G-Counter
   */
  merge(other: GCounter): void;

  /**
   * Serialize for transmission
   */
  serialize(): SerializedGCounter;
}

export interface SerializedGCounter {
  replicaId: string;
  counts: Map<string, number>;  // replicaId -> count
}

export class GCounterImpl implements GCounter {
  private replicaId: string;
  private counts: Map<string, number> = new Map();

  constructor(replicaId: string) {
    this.replicaId = replicaId;
    this.counts.set(replicaId, 0);
  }

  increment(): void {
    const currentCount = this.counts.get(this.replicaId) || 0;
    this.counts.set(this.replicaId, currentCount + 1);
  }

  value(): number {
    let total = 0;
    for (const count of this.counts.values()) {
      total += count;
    }
    return total;
  }

  merge(other: GCounter): void {
    const otherCounts = (other as GCounterImpl).counts;

    for (const [replicaId, count] of otherCounts.entries()) {
      const currentCount = this.counts.get(replicaId) || 0;
      this.counts.set(replicaId, Math.max(currentCount, count));
    }
  }

  serialize(): SerializedGCounter {
    return {
      replicaId: this.replicaId,
      counts: new Map(this.counts)
    };
  }

  static deserialize(data: SerializedGCounter): GCounter {
    const counter = new GCounterImpl(data.replicaId);
    counter.counts = new Map(data.counts);
    return counter;
  }
}

// Example usage
const deviceA = new GCounterImpl('device-a');
const deviceB = new GCounterImpl('device-b');

// Device A increments 5 times (offline)
deviceA.increment();
deviceA.increment();
deviceA.increment();
deviceA.increment();
deviceA.increment();
console.log(deviceA.value());  // 5

// Device B increments 3 times (offline)
deviceB.increment();
deviceB.increment();
deviceB.increment();
console.log(deviceB.value());  // 3

// Merge (when online)
deviceA.merge(deviceB);
deviceB.merge(deviceA);

// Both devices show 8 (no data loss!)
console.log(deviceA.value());  // 8
console.log(deviceB.value());  // 8
```

#### 2. PN-Counter (Positive-Negative Counter)

**Use case:** Track net changes (can go up or down)

```typescript
// packages/swarm/src/crdt/PNCounter.ts

export interface PNCounter {
  /**
   * Increment counter
   */
  increment(): void;

  /**
   * Decrement counter
   */
  decrement(): void;

  /**
   * Get current value
   */
  value(): number;

  /**
   * Merge with another PN-Counter
   */
  merge(other: PNCounter): void;
}

export class PNCounterImpl implements PNCounter {
  private replicaId: string;
  private pCounter: GCounter;  // Positive increments
  private nCounter: GCounter;  // Negative increments (as positive)

  constructor(replicaId: string) {
    this.replicaId = replicaId;
    this.pCounter = new GCounterImpl(replicaId + '-p');
    this.nCounter = new GCounterImpl(replicaId + '-n');
  }

  increment(): void {
    this.pCounter.increment();
  }

  decrement(): void {
    this.nCounter.increment();
  }

  value(): number {
    return this.pCounter.value() - this.nCounter.value();
  }

  merge(other: PNCounter): void {
    const otherImpl = other as PNCounterImpl;
    this.pCounter.merge(otherImpl.pCounter);
    this.nCounter.merge(otherImpl.nCounter);
  }
}

// Example usage
const counterA = new PNCounterImpl('device-a');
const counterB = new PNCounterImpl('device-b');

// Device A: +5, -2 (offline)
counterA.increment();
counterA.increment();
counterA.increment();
counterA.increment();
counterA.increment();
counterA.decrement();
counterA.decrement();
console.log(counterA.value());  // 3

// Device B: +2, -1 (offline)
counterB.increment();
counterB.increment();
counterB.decrement();
console.log(counterB.value());  // 1

// Merge
counterA.merge(counterB);
counterB.merge(counterA);

// Both show +7, -3 = 4
console.log(counterA.value());  // 4
console.log(counterB.value());  // 4
```

#### 3. OR-Set (Observed-Remove Set)

**Use case:** Knowledge fragments, tags, unique items

```typescript
// packages/swarm/src/crdt/ORSet.ts

export interface ORSet<T> {
  /**
   * Add element to set
   */
  add(element: T): void;

  /**
   * Remove element from set
   */
  remove(element: T): void;

  /**
   * Check if element exists
   */
  has(element: T): boolean;

  /**
   * Get all elements
   */
  elements(): T[];

  /**
   * Merge with another OR-Set
   */
  merge(other: ORSet<T>): void;
}

export class ORSetImpl<T> implements ORSet<T> {
  private replicaId: string;
  private elements: Map<T, Set<string>> = new Map();  // element -> set of unique tags
  private tombstones: Set<string> = new Set();  // removed tags

  constructor(replicaId: string) {
    this.replicaId = replicaId;
  }

  private generateTag(): string {
    return `${this.replicaId}-${Date.now()}-${Math.random()}`;
  }

  add(element: T): void {
    if (!this.elements.has(element)) {
      this.elements.set(element, new Set());
    }
    const tag = this.generateTag();
    this.elements.get(element)!.add(tag);
  }

  remove(element: T): void {
    const tags = this.elements.get(element);
    if (tags) {
      for (const tag of tags) {
        this.tombstones.add(tag);
      }
      this.elements.delete(element);
    }
  }

  has(element: T): boolean {
    return this.elements.has(element);
  }

  elements(): T[] {
    return Array.from(this.elements.keys());
  }

  merge(other: ORSet<T>): void {
    const otherImpl = other as ORSetImpl<T>;

    // Merge elements
    for (const [element, otherTags] of otherImpl.elements.entries()) {
      const myTags = this.elements.get(element);

      if (!myTags) {
        // Don't have this element, add it
        this.elements.set(element, new Set(otherTags));
      } else {
        // Have this element, merge tags
        for (const tag of otherTags) {
          if (!this.tombstones.has(tag)) {
            myTags.add(tag);
          }
        }
      }
    }

    // Merge tombstones
    for (const tombstone of otherImpl.tombstones) {
      this.tombstones.add(tombstone);
    }

    // Remove elements with no live tags
    for (const [element, tags] of this.elements.entries()) {
      const liveTags = Array.from(tags).filter(tag => !this.tombstones.has(tag));
      if (liveTags.length === 0) {
        this.elements.delete(element);
      } else {
        this.elements.set(element, new Set(liveTags));
      }
    }
  }
}

// Example usage
const setA = new ORSetImpl<string>('device-a');
const setB = new ORSetImpl<string>('device-b');

// Device A adds elements (offline)
setA.add('apple');
setA.add('banana');
console.log(setA.elements());  // ['apple', 'banana']

// Device B adds elements (offline)
setB.add('banana');
setB.add('cherry');
console.log(setB.elements());  // ['banana', 'cherry']

// Device A removes 'apple' (offline)
setA.remove('apple');
console.log(setA.elements());  // ['banana']

// Merge
setA.merge(setB);
setB.merge(setA);

// Both show ['banana', 'cherry']
// ('apple' was removed, 'cherry' was added by B)
console.log(setA.elements());  // ['banana', 'cherry']
console.log(setB.elements());  // ['banana', 'cherry']
```

#### 4. LWW-Register (Last-Write-Wins Register)

**Use case:** Single value with latest write wins

```typescript
// packages/swarm/src/crdt/LWWRegister.ts

export interface LWWRegister<T> {
  /**
   * Set value
   */
  set(value: T): void;

  /**
   * Get current value
   */
  get(): T | undefined;

  /**
   * Merge with another LWW-Register
   */
  merge(other: LWWRegister<T>): void;
}

export class LWWRegisterImpl<T> implements LWWRegister<T> {
  private replicaId: string;
  private value?: T;
  private timestamp: number = 0;

  constructor(replicaId: string) {
    this.replicaId = replicaId;
  }

  set(value: T): void {
    this.value = value;
    this.timestamp = Date.now();
  }

  get(): T | undefined {
    return this.value;
  }

  merge(other: LWWRegister<T>): void {
    const otherImpl = other as LWWRegisterImpl<T>;

    if (otherImpl.timestamp > this.timestamp) {
      this.value = otherImpl.value;
      this.timestamp = otherImpl.timestamp;
    } else if (otherImpl.timestamp === this.timestamp) {
      // Tie-breaker: higher replica ID wins
      if (otherImpl.replicaId > this.replicaId) {
        this.value = otherImpl.value;
      }
    }
  }
}

// Example usage
const regA = new LWWRegisterImpl<string>('device-a');
const regB = new LWWRegisterImpl<string>('device-b');

// Device A sets value (offline)
regA.set('hello');
console.log(regA.get());  // 'hello'

// Device B sets value (offline, later timestamp)
setTimeout(() => {
  regB.set('world');
  console.log(regB.get());  // 'world'

  // Merge
  regA.merge(regB);
  regB.merge(regA);

  // Both show 'world' (later write wins)
  console.log(regA.get());  // 'world'
  console.log(regB.get());  // 'world'
}, 100);
```

### CRDTStore Integration

```typescript
// packages/swarm/src/crdt/CRDTStore.ts

export interface CRDTStore {
  /**
   * Get or create G-Counter
   */
  getCounter(key: string): GCounter;

  /**
   * Get or create PN-Counter
   */
  getPNCounter(key: string): PNCounter;

  /**
   * Get or create OR-Set
   */
  getSet<T>(key: string): ORSet<T>;

  /**
   * Get or create LWW-Register
   */
  getRegister<T>(key: string): LWWRegister<T>;

  /**
   * Serialize all CRDTs
   */
  serialize(): SerializedStore;

  /**
   * Merge with another store
   */
  merge(other: CRDTStore): void;
}

export class CRDTStoreImpl implements CRDTStore {
  private replicaId: string;
  private counters: Map<string, GCounter> = new Map();
  private pnCounters: Map<string, PNCounter> = new Map();
  private sets: Map<string, ORSet<any>> = new Map();
  private registers: Map<string, LWWRegister<any>> = new Map();

  constructor(replicaId: string) {
    this.replicaId = replicaId;
  }

  getCounter(key: string): GCounter {
    if (!this.counters.has(key)) {
      this.counters.set(key, new GCounterImpl(this.replicaId));
    }
    return this.counters.get(key)!;
  }

  getPNCounter(key: string): PNCounter {
    if (!this.pnCounters.has(key)) {
      this.pnCounters.set(key, new PNCounterImpl(this.replicaId));
    }
    return this.pnCounters.get(key)!;
  }

  getSet<T>(key: string): ORSet<T> {
    if (!this.sets.has(key)) {
      this.sets.set(key, new ORSetImpl<T>(this.replicaId));
    }
    return this.sets.get(key) as ORSet<T>;
  }

  getRegister<T>(key: string): LWWRegister<T> {
    if (!this.registers.has(key)) {
      this.registers.set(key, new LWWRegisterImpl<T>(this.replicaId));
    }
    return this.registers.get(key) as LWWRegister<T>;
  }

  serialize(): SerializedStore {
    return {
      replicaId: this.replicaId,
      counters: Array.from(this.counters.entries()).map(([k, v]) => [k, v.serialize()]),
      // ... serialize other CRDTs
    };
  }

  merge(other: CRDTStore): void {
    const otherImpl = other as CRDTStoreImpl;

    // Merge all CRDTs
    for (const [key, counter] of otherImpl.counters.entries()) {
      this.getCounter(key).merge(counter);
    }

    for (const [key, pnCounter] of otherImpl.pnCounters.entries()) {
      this.getPNCounter(key).merge(pnCounter);
    }

    for (const [key, set] of otherImpl.sets.entries()) {
      (this.getSet(key) as ORSet<any>).merge(set);
    }

    for (const [key, register] of otherImpl.registers.entries()) {
      (this.getRegister(key) as LWWRegister<any>).merge(register);
    }
  }
}
```

---

## Consequences

### Positive Consequences

**1. Strong Eventual Consistency**
- Mathematical guarantee of convergence
- No conflicts, ever
- Proven correct

**2. Offline-First**
- Works without network
- Seamless sync when online
- Better UX

**3. Automatic Merging**
- No manual conflict resolution
- No data loss
- Transparent to user

**4. Scalability**
- P2P sync possible
- No central coordinator
- Linear scalability

**5. Multi-Agent Support**
- Agents can collaborate
- Shared knowledge base
- Concurrent updates safe

**6. Fault Tolerance**
- No single point of failure
- Partition tolerance
- Always available

### Negative Consequences

**1. Overhead**
- Metadata stored per replica
- Larger memory footprint
- More network traffic

**2. Complexity**
- Harder to understand
- Harder to debug
- Steep learning curve

**3. Garbage Collection**
- Old replicas accumulate
- Need periodic cleanup
- Complex to implement

**4. Limited Operations**
- Not all data structures supported
- Some operations not possible (e.g., compare-and-swap)
- Need to design around limitations

### Neutral Consequences

**1. Eventual Consistency**
- Not immediately consistent
- Tradeoff: Availability vs. consistency
- Acceptable for most use cases

**2. Metadata Overhead**
- More storage required
- Tradeoff: Correctness vs. storage
- Acceptable for modern systems

---

## Bug Documentation

### G-Counter Bug (Fixed)

**Issue:** Initial implementation had incorrect merge logic

```typescript
// ❌ Wrong merge
merge(other: GCounter): void {
  const otherImpl = other as GCounterImpl;
  for (const [replicaId, count] of otherImpl.counts.entries()) {
    this.counts.set(replicaId, count);  // Overwrites!
  }
}

// ✅ Correct merge
merge(other: GCounter): void {
  const otherImpl = other as GCounterImpl;
  for (const [replicaId, count] of otherImpl.counts.entries()) {
    const currentCount = this.counts.get(replicaId) || 0;
    this.counts.set(replicaId, Math.max(currentCount, count));  // Max!
  }
}
```

**Fix:** Use `Math.max()` to take maximum count per replica

**Status:** ✅ Fixed

---

## Use Cases in Aequor

### 1. Knowledge Sync

```typescript
// ContextPlane uses OR-Set for knowledge fragments
const knowledgeSet = crdtStore.getSet<KnowledgeFragment>('knowledge');

// Add knowledge on device A
knowledgeSet.add({
  id: 'frag-1',
  query: 'What is AI?',
  answer: 'Artificial Intelligence...',
  timestamp: Date.now()
});

// Sync to device B
// Device B automatically has the knowledge fragment
```

### 2. Metrics Collection

```typescript
// Use G-Counter for metrics
const queryCounter = crdtStore.getCounter('queries');
queryCounter.increment();

// Use PN-Counter for net changes
const budgetCounter = crdtStore.getPNCounter('budget');
budgetCounter.increment();  // Add budget
budgetCounter.decrement();  // Spend budget

// Merge with other devices
// All devices have accurate metrics
```

### 3. Multi-Agent Collaboration

```typescript
// Agent A adds knowledge
const knowledgeA = crdtStore.getSet<KnowledgeFragment>('knowledge');
knowledgeA.add(frag1);

// Agent B adds knowledge (concurrently)
const knowledgeB = crdtStore.getSet<KnowledgeFragment>('knowledge');
knowledgeB.add(frag2);

// Merge
knowledgeA.merge(knowledgeB);

// Both agents have both fragments
// No conflicts!
```

---

## Implementation Status

### Completed

- ✅ G-Counter (grow-only counter)
- ✅ PN-Counter (positive-negative counter)
- ✅ OR-Set (observed-remove set)
- ✅ LWW-Register (last-write-wins register)
- ✅ CRDTStore (unified interface)
- ✅ Bug fix (G-Counter merge logic)

### Testing

- ✅ Unit tests for all CRDTs
- ✅ Merge correctness tests
- ✅ Concurrency tests
- ✅ Serialization tests

---

## References

1. [CRDTs: An Introduction](https://www.youtube.com/watch?v=OOjPAobh3BM) - Martin Kleppmann
2. [A comprehensive study of Convergent and Commutative Replicated Data Types](https://hal.inria.fr/inria-00555588/) - Shapiro et al.
3. [Conflict-free Replicated Data Types](https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type) - Wikipedia
4. [Strong Eventual Consistency](https://www.youtube.com/watch?v=18xEvOyQJhY) - Martin Kleppmann

---

## Related ADRs

- **ADR-002:** Three-Plane Separation (ContextPlane uses CRDTs)
- **ADR-001:** Protocol-First Design (CRDT protocol definitions)

---

**Status:** Accepted
**Last Updated:** 2025-02-05
**Maintained by:** Aequor Core Team

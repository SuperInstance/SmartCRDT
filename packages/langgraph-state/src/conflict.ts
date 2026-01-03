/**
 * @lsi/langgraph-state - Conflict Resolution
 *
 * Strategies for resolving state conflicts including last-write-wins,
 * operational transformation, and CRDT-based resolution.
 */

import type {
  ConflictResolution,
  ConflictResolutionStrategy,
  StateConflict,
  StateVersion,
  StateDiff,
} from "./types.js";
import { deepMerge } from "./types.js";

/**
 * Conflict resolver
 */
export class ConflictResolver {
  private strategies: Map<ConflictResolutionStrategy, ConflictStrategy>;

  constructor() {
    this.strategies = new Map();

    // Register built-in strategies
    this.strategies.set("last-write-wins", new LastWriteWinsStrategy());
    this.strategies.set("first-write-wins", new FirstWriteWinsStrategy());
    this.strategies.set(
      "operational-transform",
      new OperationalTransformStrategy()
    );
    this.strategies.set("crdt", new CRDTStrategy());
  }

  /**
   * Resolve conflicts using specified strategy
   */
  public async resolve(
    conflicts: StateConflict[],
    strategy: ConflictResolutionStrategy = "last-write-wins"
  ): Promise<ConflictResolution> {
    const conflictStrategy = this.strategies.get(strategy);

    if (!conflictStrategy) {
      return {
        resolved: false,
        strategy,
        state: null,
        conflicts,
        requiresManualIntervention: true,
        metadata: { error: `Unknown strategy: ${strategy}` },
      };
    }

    try {
      const result = await conflictStrategy.resolve(conflicts);
      return {
        resolved: true,
        strategy,
        state: result.state,
        conflicts,
        metadata: result.metadata,
      } as ConflictResolution;
    } catch (error) {
      return {
        resolved: false,
        strategy,
        state: null,
        conflicts,
        requiresManualIntervention: true,
        metadata: { error: String(error) },
      };
    }
  }

  /**
   * Register custom strategy
   */
  public registerStrategy(
    name: ConflictResolutionStrategy,
    strategy: ConflictStrategy
  ): void {
    this.strategies.set(name, strategy);
  }

  /**
   * Detect conflicts between two state versions
   */
  public detectConflicts(
    stateA: unknown,
    versionA: StateVersion,
    stateB: unknown,
    versionB: StateVersion
  ): StateConflict[] {
    const conflicts: StateConflict[] = [];

    if (
      typeof stateA !== "object" ||
      stateA === null ||
      typeof stateB !== "object" ||
      stateB === null
    ) {
      // Primitive types - simple conflict
      if (JSON.stringify(stateA) !== JSON.stringify(stateB)) {
        conflicts.push({
          path: "",
          valueA: stateA,
          valueB: stateB,
          type: "divergence",
          timestamps: { a: new Date(), b: new Date() },
        });
      }
      return conflicts;
    }

    // Compare object properties
    const allKeys = new Set([...Object.keys(stateA), ...Object.keys(stateB)]);

    for (const key of allKeys) {
      const valueA = (stateA as Record<string, unknown>)[key];
      const valueB = (stateB as Record<string, unknown>)[key];

      if (!this.deepEqual(valueA, valueB)) {
        // Determine conflict type based on presence in both states
        const conflictType: StateConflict["type"] =
          key in stateA && key in stateB
            ? "concurrent"
            : key in stateA && !(key in stateB)
              ? "divergence"
              : "divergence";

        conflicts.push({
          path: key,
          valueA,
          valueB,
          type: conflictType,
          timestamps: { a: new Date(), b: new Date() },
        });

        // Recursively check nested objects
        if (
          typeof valueA === "object" &&
          valueA !== null &&
          typeof valueB === "object" &&
          valueB !== null
        ) {
          const nestedConflicts = this.detectNestedConflicts(
            valueA,
            valueB,
            key
          );
          conflicts.push(...nestedConflicts);
        }
      }
    }

    return conflicts;
  }

  /**
   * Merge two states with conflict resolution
   */
  public async merge(
    base: unknown,
    stateA: unknown,
    stateB: unknown,
    strategy: ConflictResolutionStrategy = "last-write-wins"
  ): Promise<{ state: unknown; conflicts: StateConflict[] }> {
    // Detect conflicts
    const conflicts = this.detectConflicts(
      stateA,
      {
        major: 1,
        minor: 0,
        patch: 0,
        toString: () => "1.0.0",
        compare: () => 0,
      },
      stateB,
      {
        major: 1,
        minor: 0,
        patch: 0,
        toString: () => "1.0.0",
        compare: () => 0,
      }
    );

    if (conflicts.length === 0) {
      // No conflicts - simple merge
      return {
        state: deepMerge(
          base as Record<string, unknown>,
          stateB as Record<string, unknown>
        ),
        conflicts: [],
      };
    }

    // Resolve conflicts
    const resolution = await this.resolve(conflicts, strategy);

    if (!resolution.resolved || resolution.state === null) {
      return {
        state: null,
        conflicts,
      };
    }

    return {
      state: resolution.state,
      conflicts,
    };
  }

  // Private helper methods

  private deepEqual(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private detectNestedConflicts(
    objA: Record<string, unknown>,
    objB: Record<string, unknown>,
    basePath: string
  ): StateConflict[] {
    const conflicts: StateConflict[] = [];

    const allKeys = new Set([...Object.keys(objA), ...Object.keys(objB)]);

    for (const key of allKeys) {
      const valueA = objA[key];
      const valueB = objB[key];

      if (!this.deepEqual(valueA, valueB)) {
        conflicts.push({
          path: `${basePath}.${key}`,
          valueA,
          valueB,
          type: "concurrent",
          timestamps: { a: new Date(), b: new Date() },
        });
      }
    }

    return conflicts;
  }
}

/**
 * Conflict strategy interface
 */
export interface ConflictStrategy {
  /**
   * Resolve conflicts and return merged state
   */
  resolve(conflicts: StateConflict[]): Promise<{
    state: unknown;
    metadata?: Record<string, unknown>;
  }>;
}

/**
 * Last-write-wins strategy
 */
export class LastWriteWinsStrategy implements ConflictStrategy {
  public async resolve(conflicts: StateConflict[]): Promise<{
    state: unknown;
    metadata?: Record<string, unknown>;
  }> {
    const result: Record<string, unknown> = {};

    for (const conflict of conflicts) {
      // Use value from B (later write)
      this.setNestedValue(result, conflict.path, conflict.valueB);
    }

    return {
      state: result,
      metadata: {
        strategy: "last-write-wins",
        resolvedConflicts: conflicts.length,
      },
    };
  }

  private setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown
  ): void {
    const keys = path.split(".");
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!(key in current) || typeof current[key] !== "object") {
        current[key] = {};
      }
      return current[key] as Record<string, unknown>;
    }, obj);
    target[lastKey] = value;
  }
}

/**
 * First-write-wins strategy
 */
export class FirstWriteWinsStrategy implements ConflictStrategy {
  public async resolve(conflicts: StateConflict[]): Promise<{
    state: unknown;
    metadata?: Record<string, unknown>;
  }> {
    const result: Record<string, unknown> = {};

    for (const conflict of conflicts) {
      // Use value from A (earlier write)
      this.setNestedValue(result, conflict.path, conflict.valueA);
    }

    return {
      state: result,
      metadata: {
        strategy: "first-write-wins",
        resolvedConflicts: conflicts.length,
      },
    };
  }

  private setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown
  ): void {
    const keys = path.split(".");
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!(key in current) || typeof current[key] !== "object") {
        current[key] = {};
      }
      return current[key] as Record<string, unknown>;
    }, obj);
    target[lastKey] = value;
  }
}

/**
 * Operational transformation strategy
 */
export class OperationalTransformStrategy implements ConflictStrategy {
  public async resolve(conflicts: StateConflict[]): Promise<{
    state: unknown;
    metadata?: Record<string, unknown>;
  }> {
    const result: Record<string, unknown> = {};

    for (const conflict of conflicts) {
      // Transform operations based on conflict type
      if (conflict.type === "concurrent") {
        // For concurrent updates, try to merge if possible
        const merged = this.mergeConcurrent(conflict.valueA, conflict.valueB);
        this.setNestedValue(result, conflict.path, merged);
      } else {
        // For divergent changes, prefer B (like last-write-wins)
        this.setNestedValue(result, conflict.path, conflict.valueB);
      }
    }

    return {
      state: result,
      metadata: {
        strategy: "operational-transform",
        resolvedConflicts: conflicts.length,
      },
    };
  }

  private mergeConcurrent(valueA: unknown, valueB: unknown): unknown {
    // If both are arrays, concatenate
    if (Array.isArray(valueA) && Array.isArray(valueB)) {
      return [...new Set([...valueA, ...valueB])];
    }

    // If both are objects, deep merge
    if (
      typeof valueA === "object" &&
      valueA !== null &&
      typeof valueB === "object" &&
      valueB !== null &&
      !Array.isArray(valueB)
    ) {
      return deepMerge(
        valueA as Record<string, unknown>,
        valueB as Record<string, unknown>
      );
    }

    // Otherwise, use valueB
    return valueB;
  }

  private setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown
  ): void {
    const keys = path.split(".");
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!(key in current) || typeof current[key] !== "object") {
        current[key] = {};
      }
      return current[key] as Record<string, unknown>;
    }, obj);
    target[lastKey] = value;
  }
}

/**
 * CRDT-based strategy (using G-Counter and LWW-Element-Set)
 */
export class CRDTStrategy implements ConflictStrategy {
  public async resolve(conflicts: StateConflict[]): Promise<{
    state: unknown;
    metadata?: Record<string, unknown>;
  }> {
    const result: Record<string, unknown> = {};

    for (const conflict of conflicts) {
      // Use CRDT semantics based on value types
      const resolved = this.resolveWithCRDT(conflict);
      this.setNestedValue(result, conflict.path, resolved);
    }

    return {
      state: result,
      metadata: {
        strategy: "crdt",
        resolvedConflicts: conflicts.length,
        crdtTypes: this.detectCRDTTypes(conflicts),
      },
    };
  }

  private resolveWithCRDT(conflict: StateConflict): unknown {
    const typeA = this.getCRDTType(conflict.valueA);
    const typeB = this.getCRDTType(conflict.valueB);

    // Numeric values - use G-Counter (max)
    if (typeA === "counter" && typeB === "counter") {
      return Math.max(
        Number(conflict.valueA || 0),
        Number(conflict.valueB || 0)
      );
    }

    // Array values - use LWW-Element-Set
    if (Array.isArray(conflict.valueA) && Array.isArray(conflict.valueB)) {
      return this.mergeArraysWithLWW(
        conflict.valueA,
        conflict.valueB,
        conflict.timestamps
      );
    }

    // Object values - recursive merge
    if (
      typeof conflict.valueA === "object" &&
      conflict.valueA !== null &&
      typeof conflict.valueB === "object" &&
      conflict.valueB !== null &&
      !Array.isArray(conflict.valueB)
    ) {
      return deepMerge(
        conflict.valueA as Record<string, unknown>,
        conflict.valueB as Record<string, unknown>
      );
    }

    // Default: last-write-wins based on timestamp
    return conflict.timestamps.b > conflict.timestamps.a
      ? conflict.valueB
      : conflict.valueA;
  }

  private getCRDTType(value: unknown): "counter" | "set" | "map" | "other" {
    if (typeof value === "number") return "counter";
    if (Array.isArray(value)) return "set";
    if (typeof value === "object" && value !== null) return "map";
    return "other";
  }

  private mergeArraysWithLWW(
    arrayA: unknown[],
    arrayB: unknown[],
    timestamps: { a: Date; b: Date }
  ): unknown[] {
    const bIsLater = timestamps.b > timestamps.a;

    // Use the array from the later timestamp
    const base = bIsLater ? [...arrayB] : [...arrayA];
    const other = bIsLater ? arrayA : arrayB;

    // Add unique elements from the other array
    const set = new Set(base);
    for (const item of other) {
      set.add(item);
    }

    return Array.from(set);
  }

  private detectCRDTTypes(conflicts: StateConflict[]): Record<string, string> {
    const types: Record<string, string> = {};

    for (const conflict of conflicts) {
      const typeA = this.getCRDTType(conflict.valueA);
      const typeB = this.getCRDTType(conflict.valueB);
      types[conflict.path] = typeA === typeB ? typeA : "mixed";
    }

    return types;
  }

  private setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown
  ): void {
    const keys = path.split(".");
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!(key in current) || typeof current[key] !== "object") {
        current[key] = {};
      }
      return current[key] as Record<string, unknown>;
    }, obj);
    target[lastKey] = value;
  }
}

/**
 * Vector clock for causal ordering
 */
export class VectorClock {
  private clock: Map<string, number>;

  constructor() {
    this.clock = new Map();
  }

  /**
   * Increment clock for node
   */
  public increment(nodeId: string): void {
    const current = this.clock.get(nodeId) || 0;
    this.clock.set(nodeId, current + 1);
  }

  /**
   * Merge with another vector clock
   */
  public merge(other: VectorClock): void {
    for (const [node, count] of other.clock.entries()) {
      const current = this.clock.get(node) || 0;
      this.clock.set(node, Math.max(current, count));
    }
  }

  /**
   * Compare clocks for ordering
   */
  public compare(
    other: VectorClock
  ): "before" | "after" | "concurrent" | "equal" {
    let aBeforeB = false;
    let bBeforeA = false;

    const allNodes = new Set([...this.clock.keys(), ...other.clock.keys()]);

    for (const node of allNodes) {
      const aCount = this.clock.get(node) || 0;
      const bCount = other.clock.get(node) || 0;

      if (aCount < bCount) aBeforeB = true;
      if (aCount > bCount) bBeforeA = true;
    }

    if (aBeforeB && !bBeforeA) return "before";
    if (bBeforeA && !aBeforeB) return "after";
    if (!aBeforeB && !bBeforeA) return "equal";
    return "concurrent";
  }

  /**
   * Get clock as object
   */
  public toObject(): Record<string, number> {
    return Object.fromEntries(this.clock);
  }

  /**
   * Create clock from object
   */
  public static fromObject(obj: Record<string, number>): VectorClock {
    const clock = new VectorClock();
    for (const [node, count] of Object.entries(obj)) {
      clock.clock.set(node, count);
    }
    return clock;
  }
}

/**
 * Three-way merge using diff3 algorithm
 */
export function threeWayMerge(
  base: unknown,
  left: unknown,
  right: unknown
): { merged: unknown; conflicts: StateConflict[] } {
  const conflicts: StateConflict[] = [];
  const result: Record<string, unknown> = {};

  if (
    typeof base !== "object" ||
    base === null ||
    typeof left !== "object" ||
    left === null ||
    typeof right !== "object" ||
    right === null
  ) {
    // Primitive types - conflict if different
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      conflicts.push({
        path: "",
        valueA: left,
        valueB: right,
        type: "concurrent",
        timestamps: { a: new Date(), b: new Date() },
      });
    }
    return { merged: right, conflicts };
  }

  const allKeys = new Set([
    ...Object.keys(base),
    ...Object.keys(left),
    ...Object.keys(right),
  ]);

  for (const key of allKeys) {
    const baseValue = (base as Record<string, unknown>)[key];
    const leftValue = (left as Record<string, unknown>)[key];
    const rightValue = (right as Record<string, unknown>)[key];

    // Keys only in left
    if (!(key in base) && key in left && !(key in right)) {
      result[key] = leftValue;
      continue;
    }

    // Keys only in right
    if (!(key in base) && key in right && !(key in left)) {
      result[key] = rightValue;
      continue;
    }

    // Keys in both left and right but not in base - potential conflict
    if (!(key in base) && key in left && key in right) {
      if (!deepEqual(leftValue, rightValue)) {
        conflicts.push({
          path: key,
          valueA: leftValue,
          valueB: rightValue,
          type: "concurrent",
          timestamps: { a: new Date(), b: new Date() },
        });
        result[key] = rightValue; // Default to right
      } else {
        result[key] = leftValue;
      }
      continue;
    }

    // Keys modified in one branch only
    if (deepEqual(baseValue, leftValue) && !deepEqual(baseValue, rightValue)) {
      result[key] = rightValue;
      continue;
    }

    if (deepEqual(baseValue, rightValue) && !deepEqual(baseValue, leftValue)) {
      result[key] = leftValue;
      continue;
    }

    // Keys modified in both branches - conflict if different
    if (!deepEqual(leftValue, rightValue)) {
      conflicts.push({
        path: key,
        valueA: leftValue,
        valueB: rightValue,
        type: "concurrent",
        timestamps: { a: new Date(), b: new Date() },
      });
      result[key] = rightValue; // Default to right
    } else {
      result[key] = leftValue;
    }
  }

  return { merged: result, conflicts };
}

// Helper function for deep equality
function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Factory function to create conflict resolver
 */
export function createConflictResolver(): ConflictResolver {
  return new ConflictResolver();
}

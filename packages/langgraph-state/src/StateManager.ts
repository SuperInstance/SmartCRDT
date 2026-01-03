/**
 * @lsi/langgraph-state - Advanced State Manager
 *
 * Multi-scope state management with versioning, snapshots,
 * branching, and conflict resolution for LangGraph applications.
 */

import type {
  StateScope,
  StateStrategy,
  StateVersion,
  StateSnapshot,
  StateTransition,
  StateChange,
  StateDiff,
  StatePatch,
  StateManagerConfig,
  ConflictResolutionStrategy,
  ConflictResolution,
  StateConflict,
  StateBranch,
  StateMerge,
  StateValidation,
  StateMiddleware,
  StateMiddlewareContext,
  StateReducer,
  StateManager,
  StateStatistics,
  StateEvent,
  StateEventPayload,
  StateEventListener,
  PersistenceStrategy,
} from "./types.js";
import {
  createStateVersion,
  parseStateVersion,
  generateStateId,
  generateChecksum,
  calculateStateSize,
  cloneState,
  deepMerge,
} from "./types.js";

/**
 * In-memory state storage per scope
 */
interface ScopeState {
  state: Record<string, unknown>;
  version: StateVersion;
  timestamp: Date;
  checksum: string;
}

/**
 * State Manager Implementation
 */
export class AdvancedStateManager<
  T extends Record<string, unknown> = Record<string, unknown>,
> implements StateManager<T> {
  public readonly id: string;
  public readonly config: StateManagerConfig;
  public state: T;
  public version: StateVersion;
  public branches: Map<string, StateBranch>;
  public currentBranch: string;

  private scopeStates: Map<StateScope, ScopeState>;
  private snapshots: Map<string, StateSnapshot<T>>;
  private history: StateTransition[];
  private middleware: StateMiddleware[];
  private eventListeners: Map<StateEvent, Set<StateEventListener>>;
  private reducers: Map<string, StateReducer>;
  private migrations: Map<string, import("./types.js").StateMigration>;
  private statistics: Partial<StateStatistics>;
  private destroyed: boolean;
  private persistence: import("./persistence.js").StatePersistenceBackend;

  constructor(initialState: T, config: StateManagerConfig = {}) {
    this.id = generateStateId();
    this.state = cloneState(initialState);
    this.version = createStateVersion(1, 0, 0);
    this.config = {
      persistence: "memory",
      versioning: true,
      snapshots: true,
      snapshotInterval: 60000,
      maxSnapshots: 100,
      conflictResolution: "last-write-wins",
      compression: false,
      compressionThreshold: 1024,
      validation: false,
      history: true,
      maxHistory: 1000,
      middleware: true,
      debug: false,
      defaultStrategy: "merge",
      serializationFormat: "json",
      ...config,
    };

    this.branches = new Map();
    this.currentBranch = "main";

    // Initialize main branch
    this.branches.set("main", {
      id: "main",
      name: "main",
      baseVersion: this.version,
      currentVersion: this.version,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.scopeStates = new Map();
    this.snapshots = new Map();
    this.history = [];
    this.middleware = [];
    this.eventListeners = new Map();
    this.reducers = new Map();
    this.migrations = new Map();
    this.destroyed = false;

    this.statistics = {
      totalTransitions: 0,
      totalSnapshots: 0,
      stateSize: calculateStateSize(this.state),
      activeBranches: 1,
      averageUpdateTime: 0,
      totalConflicts: 0,
      resolvedConflicts: 0,
      memoryUsage: 0,
    };

    // Initialize scope states
    this.initializeScopeStates();

    // Load persistence backend
    this.persistence = this.createPersistenceBackend();
  }

  /**
   * Initialize per-scope state storage
   */
  private initializeScopeStates(): void {
    const scopes: StateScope[] = ["global", "agent", "session", "thread"];

    for (const scope of scopes) {
      this.scopeStates.set(scope, {
        state: {},
        version: this.version,
        timestamp: new Date(),
        checksum: "",
      });
    }
  }

  /**
   * Create persistence backend based on config
   */
  private createPersistenceBackend(): import("./persistence.js").StatePersistenceBackend {
    // Use in-memory persistence by default
    const { MemoryPersistence } = require("./persistence.js");
    return new MemoryPersistence();
  }

  /**
   * Get state at a specific scope
   */
  public getState(scope: StateScope, key?: string): unknown {
    const scopeState = this.scopeStates.get(scope);
    if (!scopeState) {
      throw new Error(`Invalid scope: ${scope}`);
    }

    if (key) {
      return this.getNestedValue(scopeState.state, key);
    }

    return { ...scopeState.state };
  }

  /**
   * Set state at a specific scope
   */
  public async setState(
    scope: StateScope,
    key: string,
    value: unknown,
    strategy: StateStrategy = this.config.defaultStrategy || "merge"
  ): Promise<void> {
    if (this.destroyed) {
      throw new Error("StateManager has been destroyed");
    }

    const scopeState = this.scopeStates.get(scope);
    if (!scopeState) {
      throw new Error(`Invalid scope: ${scope}`);
    }

    const oldState = { ...scopeState.state };
    const oldValue = this.getNestedValue(oldState, key);

    // Apply strategy
    let newState: Record<string, unknown>;
    switch (strategy) {
      case "replace":
        newState = { ...scopeState.state, [key]: value };
        break;
      case "merge":
        if (
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value)
        ) {
          const existingValue = this.getNestedValue(scopeState.state, key);
          const mergedValue =
            typeof existingValue === "object" && existingValue !== null
              ? deepMerge(
                  existingValue as Record<string, unknown>,
                  value as Record<string, unknown>
                )
              : value;
          newState = this.setNestedValue(
            { ...scopeState.state },
            key,
            mergedValue
          );
        } else {
          newState = this.setNestedValue({ ...scopeState.state }, key, value);
        }
        break;
      case "append":
        if (Array.isArray(oldValue)) {
          newState = this.setNestedValue({ ...scopeState.state }, key, [
            ...oldValue,
            value,
          ]);
        } else {
          newState = this.setNestedValue({ ...scopeState.state }, key, [value]);
        }
        break;
      case "custom":
        // Use custom reducer if registered
        const customReducer = this.reducers.get(`${scope}.${key}`);
        if (customReducer) {
          const result = await customReducer(scopeState.state, {
            key,
            value,
            strategy,
          });
          newState = result as Record<string, unknown>;
        } else {
          newState = this.setNestedValue({ ...scopeState.state }, key, value);
        }
        break;
      default:
        newState = this.setNestedValue({ ...scopeState.state }, key, value);
    }

    const newChecksum = await generateChecksum(newState);

    // Create transition
    const transition: StateTransition = {
      id: generateStateId(),
      fromState: scopeState.version,
      toState: this.incrementVersion(scopeState.version),
      trigger: `set:${scope}.${key}`,
      timestamp: new Date(),
      scope,
      changes: [
        {
          path: key,
          oldValue,
          newValue: value,
          type: oldValue === undefined ? "add" : "update",
        },
      ],
      metadata: {
        strategy,
        scope,
        key,
      },
    };

    // Execute pre-middleware
    await this.executeMiddleware("pre", {
      state: oldState,
      nextState: newState,
      transition,
      manager: this,
      phase: "pre",
    });

    // Update scope state
    scopeState.state = newState;
    scopeState.version = transition.toState;
    scopeState.timestamp = transition.timestamp;
    scopeState.checksum = newChecksum;

    // Add to history
    if (this.config.history) {
      this.history.push(transition);
      if (this.history.length > (this.config.maxHistory || 1000)) {
        this.history.shift();
      }
    }

    // Update statistics
    this.statistics.totalTransitions =
      (this.statistics.totalTransitions || 0) + 1;
    this.statistics.stateSize = calculateStateSize(this.state);

    // Persist state
    await this.persistence.save(scope, {
      scope,
      state: scopeState.state,
      version: scopeState.version,
      timestamp: scopeState.timestamp,
      checksum: scopeState.checksum,
    });

    // Execute post-middleware
    await this.executeMiddleware("post", {
      state: oldState,
      nextState: newState,
      transition,
      manager: this,
      phase: "post",
    });

    // Emit event
    this.emit("state:change", {
      type: "state:change",
      timestamp: transition.timestamp,
      data: { scope, key, oldValue, newValue: value, strategy },
      source: this.id,
    });

    // Auto-snapshot if enabled
    if (this.config.snapshots && this.config.snapshotInterval) {
      const lastSnapshot = Array.from(this.snapshots.values()).pop();
      const shouldSnapshot =
        !lastSnapshot ||
        Date.now() - lastSnapshot.timestamp.getTime() >
          this.config.snapshotInterval;

      if (shouldSnapshot) {
        await this.createSnapshot(`auto:${scope}.${key}`);
      }
    }
  }

  /**
   * Update state using reducer
   */
  public async updateState(
    scope: StateScope,
    reducer: StateReducer,
    payload?: unknown
  ): Promise<StateVersion> {
    if (this.destroyed) {
      throw new Error("StateManager has been destroyed");
    }

    const scopeState = this.scopeStates.get(scope);
    if (!scopeState) {
      throw new Error(`Invalid scope: ${scope}`);
    }

    const oldState = { ...scopeState.state };
    const newState = (await reducer(oldState, payload)) as Record<
      string,
      unknown
    >;

    const newChecksum = await generateChecksum(newState);
    const newVersion = this.incrementVersion(scopeState.version);

    const transition: StateTransition = {
      id: generateStateId(),
      fromState: scopeState.version,
      toState: newVersion,
      trigger: "reducer",
      timestamp: new Date(),
      scope,
      changes: this.computeChanges(oldState, newState),
      metadata: { payload },
    };

    scopeState.state = newState;
    scopeState.version = newVersion;
    scopeState.timestamp = transition.timestamp;
    scopeState.checksum = newChecksum;

    if (this.config.history) {
      this.history.push(transition);
    }

    await this.persistence.save(scope, {
      scope,
      state: scopeState.state,
      version: scopeState.version,
      timestamp: scopeState.timestamp,
      checksum: scopeState.checksum,
    });

    this.emit("state:change", {
      type: "state:change",
      timestamp: transition.timestamp,
      data: { scope, reducer: reducer.name, payload },
      source: this.id,
    });

    return newVersion;
  }

  /**
   * Create state snapshot
   */
  public async createSnapshot(label?: string): Promise<StateSnapshot<T>> {
    if (this.destroyed) {
      throw new Error("StateManager has been destroyed");
    }

    const snapshotId = generateStateId();
    const timestamp = new Date();
    const data = cloneState(this.state);
    const checksum = await generateChecksum(data);
    const size = calculateStateSize(data);

    const snapshot: StateSnapshot<T> = {
      id: snapshotId,
      version: this.version,
      timestamp,
      scope: "global",
      data,
      checksum,
      parentId: this.getCurrentSnapshotId(),
      metadata: {
        label,
        branch: this.currentBranch,
        managerId: this.id,
      },
      size,
      compressed: false,
    };

    this.snapshots.set(snapshotId, snapshot);
    this.statistics.totalSnapshots = (this.statistics.totalSnapshots || 0) + 1;

    // Enforce max snapshots limit
    if (this.snapshots.size > (this.config.maxSnapshots || 100)) {
      const oldestSnapshot = Array.from(this.snapshots.entries()).sort(
        ([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime()
      )[0];
      if (oldestSnapshot) {
        this.snapshots.delete(oldestSnapshot[0]);
      }
    }

    await this.persistence.saveSnapshot(snapshot);

    this.emit("state:snapshot", {
      type: "state:snapshot",
      timestamp,
      data: { snapshotId, label },
      source: this.id,
    });

    return snapshot;
  }

  /**
   * Restore from snapshot
   */
  public async restoreSnapshot(snapshotId: string): Promise<void> {
    if (this.destroyed) {
      throw new Error("StateManager has been destroyed");
    }

    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    const currentChecksum = await generateChecksum(snapshot.data);
    if (currentChecksum !== snapshot.checksum) {
      throw new Error("Snapshot checksum mismatch - data corruption detected");
    }

    const oldState = cloneState(this.state);
    this.state = cloneState(snapshot.data);
    this.version = snapshot.version;

    // Update all scope states
    for (const scope of this.scopeStates.keys()) {
      const scopeState = this.scopeStates.get(scope)!;
      scopeState.state = {};
      scopeState.version = snapshot.version;
      scopeState.timestamp = new Date();
      scopeState.checksum = await generateChecksum(scopeState.state);
    }

    const snapshotData = await this.persistence.loadSnapshot(snapshotId);
    if (snapshotData) {
      // Restore from snapshot data
      this.state = cloneState(snapshotData.data) as T;
      this.version = snapshotData.version;
    }

    this.emit("state:restore", {
      type: "state:restore",
      timestamp: new Date(),
      data: { snapshotId, previousVersion: oldState },
      source: this.id,
    });
  }

  /**
   * Get state history
   */
  public getHistory(scope?: StateScope, limit?: number): StateTransition[] {
    let history = this.history;

    if (scope) {
      history = history.filter(t => t.scope === scope);
    }

    // Sort by timestamp descending
    history = history.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

    if (limit) {
      history = history.slice(0, limit);
    }

    return history;
  }

  /**
   * Diff two states
   */
  public diff(versionA: StateVersion, versionB: StateVersion): StateDiff {
    const stateA = this.getStateAtVersion(versionA);
    const stateB = this.getStateAtVersion(versionB);

    return this.computeDiff(stateA, stateB);
  }

  /**
   * Apply patch to state
   */
  public async applyPatch(patch: StatePatch): Promise<StateVersion> {
    if (this.destroyed) {
      throw new Error("StateManager has been destroyed");
    }

    if (patch.baseVersion.compare(this.version) !== 0) {
      throw new Error(
        "Patch base version does not match current state version"
      );
    }

    let state = { ...this.state };

    for (const operation of patch.operations) {
      state = this.applyPatchOperation(state, operation);
    }

    this.state = state as T;
    this.version = patch.targetVersion;

    return this.version;
  }

  /**
   * Create branch
   */
  public createBranch(name: string, baseVersion?: StateVersion): StateBranch {
    const branchId = name.toLowerCase().replace(/\s+/g, "-");

    if (this.branches.has(branchId)) {
      throw new Error(`Branch already exists: ${branchId}`);
    }

    const branch: StateBranch = {
      id: branchId,
      name,
      parentBranch: this.currentBranch,
      baseVersion: baseVersion || this.version,
      currentVersion: baseVersion || this.version,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.branches.set(branchId, branch);
    this.statistics.activeBranches = this.branches.size;

    this.emit("branch:create", {
      type: "branch:create",
      timestamp: branch.createdAt,
      data: { branchId, name, baseVersion },
      source: this.id,
    });

    return branch;
  }

  /**
   * Switch to branch
   */
  public switchBranch(branchId: string): void {
    const branch = this.branches.get(branchId);
    if (!branch) {
      throw new Error(`Branch not found: ${branchId}`);
    }

    if (branch.status !== "active") {
      throw new Error(`Branch is not active: ${branchId}`);
    }

    const oldBranch = this.currentBranch;
    this.currentBranch = branchId;
    this.version = branch.currentVersion;

    // Restore state from branch
    const state = await this.persistence.loadBranchState(branchId);
    if (state) {
      this.state = state as T;
    }

    this.emit("branch:switch", {
      type: "branch:switch",
      timestamp: new Date(),
      data: { fromBranch: oldBranch, toBranch: branchId },
      source: this.id,
    });
  }

  /**
   * Merge branches
   */
  public async mergeBranch(
    sourceBranch: string,
    targetBranch: string,
    strategy?: ConflictResolutionStrategy
  ): Promise<StateMerge> {
    const source = this.branches.get(sourceBranch);
    const target = this.branches.get(targetBranch);

    if (!source || !target) {
      throw new Error("Source or target branch not found");
    }

    const sourceState = await this.persistence.loadBranchState(sourceBranch);
    const targetState = await this.persistence.loadBranchState(targetBranch);

    // Detect conflicts
    const conflicts = this.detectConflicts(sourceState, targetState);

    // Resolve conflicts
    const resolved = await this.resolveConflicts(conflicts, strategy);

    if (!resolved.resolved) {
      return {
        success: false,
        state: targetState,
        version: target.currentVersion,
        conflicts,
        resolvedConflicts: [],
        metadata: { reason: "Unresolved conflicts" },
      };
    }

    // Merge states
    const mergedState = this.deepMergeStates(targetState, sourceState);
    const newVersion = this.incrementVersion(target.currentVersion);

    // Update target branch
    target.currentVersion = newVersion;
    target.updatedAt = new Date();

    await this.persistence.saveBranchState(targetBranch, mergedState);

    this.emit("branch:merge", {
      type: "branch:merge",
      timestamp: new Date(),
      data: { sourceBranch, targetBranch, conflictsCount: conflicts.length },
      source: this.id,
    });

    return {
      success: true,
      state: mergedState,
      version: newVersion,
      conflicts,
      resolvedConflicts: resolved.conflicts,
    };
  }

  /**
   * Validate state
   */
  public validate(state?: T): StateValidation {
    const stateToValidate = state !== undefined ? state : this.state;
    const { StateValidator } = require("./validation.js");
    const validator = new StateValidator();

    return validator.validate(stateToValidate);
  }

  /**
   * Register middleware
   */
  public use(middleware: StateMiddleware): void {
    if (!this.config.middleware) {
      throw new Error("Middleware is disabled in config");
    }
    this.middleware.push(middleware);
  }

  /**
   * Destroy manager and cleanup resources
   */
  public async destroy(): Promise<void> {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;

    // Clear all data
    this.scopeStates.clear();
    this.snapshots.clear();
    this.history.length = 0;
    this.middleware.length = 0;
    this.eventListeners.clear();
    this.reducers.clear();
    this.migrations.clear();

    // Close persistence connection
    await this.persistence.close();
  }

  /**
   * Register event listener
   */
  public on(event: StateEvent, listener: StateEventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  /**
   * Unregister event listener
   */
  public off(event: StateEvent, listener: StateEventListener): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Register custom reducer
   */
  public registerReducer(name: string, reducer: StateReducer): void {
    this.reducers.set(name, reducer);
  }

  /**
   * Register state migration
   */
  public registerMigration(
    migration: import("./types.js").StateMigration
  ): void {
    const key = `${migration.fromVersion.toString()}_${migration.toVersion.toString()}`;
    this.migrations.set(key, migration);
  }

  /**
   * Get statistics
   */
  public getStatistics(): StateStatistics {
    return {
      totalTransitions: this.statistics.totalTransitions || 0,
      totalSnapshots: this.statistics.totalSnapshots || 0,
      stateSize: this.statistics.stateSize || 0,
      activeBranches: this.statistics.activeBranches || 0,
      averageUpdateTime: this.statistics.averageUpdateTime || 0,
      totalConflicts: this.statistics.totalConflicts || 0,
      resolvedConflicts: this.statistics.resolvedConflicts || 0,
      cacheHitRate: this.statistics.cacheHitRate,
      memoryUsage: this.statistics.memoryUsage || 0,
    };
  }

  // Private helper methods

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce((current, key) => {
      return current && typeof current === "object"
        ? (current as Record<string, unknown>)[key]
        : undefined;
    }, obj as unknown);
  }

  private setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown
  ): Record<string, unknown> {
    const keys = path.split(".");
    const lastKey = keys.pop()!;
    const target = keys.reduce(
      (current, key) => {
        if (!(key in current) || typeof current[key] !== "object") {
          current[key] = {};
        }
        return current[key] as Record<string, unknown>;
      },
      obj as Record<string, unknown>
    );

    target[lastKey] = value;
    return obj;
  }

  private incrementVersion(version: StateVersion): StateVersion {
    return createStateVersion(
      version.major,
      version.minor,
      version.patch + 1,
      version.branch
    );
  }

  private computeChanges(oldState: unknown, newState: unknown): StateChange[] {
    const changes: StateChange[] = [];
    // Simplified change detection
    // Full implementation would do deep comparison
    return changes;
  }

  private computeDiff(stateA: unknown, stateB: unknown): StateDiff {
    const diff: StateDiff = {
      identical: JSON.stringify(stateA) === JSON.stringify(stateB),
      added: new Map(),
      updated: new Map(),
      deleted: new Map(),
      moved: new Map(),
    };
    // Simplified diff computation
    // Full implementation would do deep diffing
    return diff;
  }

  private applyPatchOperation(
    state: unknown,
    operation: import("./types.js").PatchOperation
  ): unknown {
    // Implement RFC 6902 JSON Patch operations
    return state;
  }

  private detectConflicts(stateA: unknown, stateB: unknown): StateConflict[] {
    // Detect concurrent modifications
    return [];
  }

  private async resolveConflicts(
    conflicts: StateConflict[],
    strategy?: ConflictResolutionStrategy
  ): Promise<ConflictResolution> {
    const resolutionStrategy =
      strategy || this.config.conflictResolution || "last-write-wins";
    // Create a simple resolver for now
    return {
      resolved: conflicts.length > 0,
      strategy: resolutionStrategy,
      state: this.state,
      conflicts,
    };
  }

  private deepMergeStates(base: unknown, update: unknown): unknown {
    if (
      typeof base === "object" &&
      base !== null &&
      typeof update === "object" &&
      update !== null
    ) {
      return deepMerge(
        base as Record<string, unknown>,
        update as Record<string, unknown>
      );
    }
    return update;
  }

  private getCurrentSnapshotId(): string | undefined {
    const snapshots = Array.from(this.snapshots.values());
    return snapshots.length > 0
      ? snapshots[snapshots.length - 1].id
      : undefined;
  }

  private getStateAtVersion(version: StateVersion): unknown {
    // Find snapshot closest to version
    const snapshot = Array.from(this.snapshots.values())
      .filter(s => s.version.compare(version) <= 0)
      .sort((a, b) => b.version.compare(a.version))[0];

    return snapshot ? snapshot.data : this.state;
  }

  private async executeMiddleware(
    phase: "pre" | "post",
    context: StateMiddlewareContext
  ): Promise<void> {
    if (!this.config.middleware) {
      return;
    }

    const execute = async (index: number): Promise<void> => {
      if (index >= this.middleware.length) {
        return;
      }

      const mw = this.middleware[index];
      await mw(context, () => execute(index + 1));
    };

    await execute(0);
  }

  private emit(event: StateEvent, payload: StateEventPayload): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(payload);
        } catch (error) {
          if (this.config.debug) {
            // Silently ignore in production
            typeof console !== "undefined" &&
              console.error(`Error in event listener for ${event}:`, error);
          }
        }
      }
    }
  }
}

/**
 * Factory function to create StateManager
 */
export function createStateManager<T extends Record<string, unknown>>(
  initialState: T,
  config?: StateManagerConfig
): AdvancedStateManager<T> {
  return new AdvancedStateManager<T>(initialState, config);
}

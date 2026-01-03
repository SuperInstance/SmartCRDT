/**
 * @lsi/langgraph-state - Advanced State Management Types
 *
 * Type definitions for multi-scope, versioned, persistent state management
 * with conflict resolution for LangGraph applications.
 */

/**
 * State scope determines visibility and lifecycle of state data
 */
export type StateScope = "global" | "agent" | "session" | "thread";

/**
 * State strategy defines how state updates are applied
 */
export type StateStrategy = "merge" | "replace" | "append" | "custom";

/**
 * State version information
 */
export interface StateVersion {
  /** Major version - incompatible changes */
  major: number;
  /** Minor version - backward compatible additions */
  minor: number;
  /** Patch version - backward compatible fixes */
  patch: number;
  /** Branch identifier for parallel state development */
  branch?: string;
  /** Full version string */
  toString(): string;
  /** Compare versions */
  compare(other: StateVersion): number;
}

/**
 * State snapshot for rollback and time-travel debugging
 */
export interface StateSnapshot<T = unknown> {
  /** Unique snapshot identifier */
  id: string;
  /** State version at snapshot time */
  version: StateVersion;
  /** Timestamp when snapshot was created */
  timestamp: Date;
  /** Scope of the snapshot */
  scope: StateScope;
  /** State data at snapshot time */
  data: T;
  /** Checksum for data integrity verification */
  checksum: string;
  /** Parent snapshot ID for version chain */
  parentId?: string;
  /** Metadata about the snapshot */
  metadata?: Record<string, unknown>;
  /** Size of snapshot in bytes */
  size?: number;
  /** Whether snapshot is compressed */
  compressed?: boolean;
}

/**
 * State transition record
 */
export interface StateTransition {
  /** Unique transition identifier */
  id: string;
  /** Previous state version */
  fromState: StateVersion;
  /** New state version */
  toState: StateVersion;
  /** What triggered the transition */
  trigger: string;
  /** Timestamp of transition */
  timestamp: Date;
  /** Scope of the transition */
  scope: StateScope;
  /** Changes made in this transition */
  changes: StateChange[];
  /** Who/what made the change */
  actor?: string;
  /** Transition metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Individual state change within a transition
 */
export interface StateChange {
  /** Path to changed property (dot notation) */
  path: string;
  /** Previous value */
  oldValue: unknown;
  /** New value */
  newValue: unknown;
  /** Type of change */
  type: "add" | "update" | "delete" | "move" | "copy";
}

/**
 * State diff for comparing two states
 */
export interface StateDiff {
  /** Whether states are identical */
  identical: boolean;
  /** Added properties */
  added: Map<string, unknown>;
  /** Updated properties */
  updated: Map<string, { oldValue: unknown; newValue: unknown }>;
  /** Deleted properties */
  deleted: Map<string, unknown>;
  /** Moved properties */
  moved: Map<string, { fromPath: string; toPath: string }>;
}

/**
 * State patch for applying diffs
 */
export interface StatePatch {
  /** Patches to apply */
  operations: PatchOperation[];
  /** Base version this patch applies to */
  baseVersion: StateVersion;
  /** Expected result version */
  targetVersion: StateVersion;
}

/**
 * Individual patch operation (RFC 6902 JSON Patch format)
 */
export interface PatchOperation {
  /** Operation type */
  op: "add" | "remove" | "replace" | "move" | "copy" | "test";
  /** JSON Pointer path */
  path: string;
  /** Source path for move/copy */
  from?: string;
  /** Value for add/replace/test */
  value?: unknown;
}

/**
 * State manager configuration
 */
export interface StateManagerConfig {
  /** Default persistence strategy */
  persistence?: PersistenceStrategy;
  /** Enable state versioning */
  versioning?: boolean;
  /** Enable state snapshots */
  snapshots?: boolean;
  /** Snapshot interval (ms) */
  snapshotInterval?: number;
  /** Maximum snapshots to keep per scope */
  maxSnapshots?: number;
  /** Conflict resolution strategy */
  conflictResolution?: ConflictResolutionStrategy;
  /** Enable state compression */
  compression?: boolean;
  /** Compression threshold (bytes) */
  compressionThreshold?: number;
  /** Enable state validation */
  validation?: boolean;
  /** Validation schema (Zod) */
  validationSchema?: unknown;
  /** Enable state history */
  history?: boolean;
  /** Maximum history entries */
  maxHistory?: number;
  /** Enable state middleware */
  middleware?: boolean;
  /** Enable state debugging */
  debug?: boolean;
  /** Default state strategy */
  defaultStrategy?: StateStrategy;
  /** State serialization format */
  serializationFormat?: "json" | "msgpack" | "binary";
}

/**
 * Persistence strategy for state storage
 */
export type PersistenceStrategy =
  | "memory"
  | "file"
  | "postgresql"
  | "redis"
  | "sqlite"
  | "custom";

/**
 * Conflict resolution strategy
 */
export type ConflictResolutionStrategy =
  | "last-write-wins"
  | "first-write-wins"
  | "operational-transform"
  | "crdt"
  | "manual"
  | "custom";

/**
 * Conflict resolution result
 */
export interface ConflictResolution {
  /** Whether conflict was resolved */
  resolved: boolean;
  /** Strategy used */
  strategy: ConflictResolutionStrategy;
  /** Resolved state */
  state: unknown;
  /** Conflicts that were resolved */
  conflicts: StateConflict[];
  /** Manual intervention required */
  requiresManualIntervention?: boolean;
  /** Resolution metadata */
  metadata?: Record<string, unknown>;
}

/**
 * State conflict between two versions
 */
export interface StateConflict {
  /** Path to conflicted property */
  path: string;
  /** Value in version A */
  valueA: unknown;
  /** Value in version B */
  valueB: unknown;
  /** Conflict type */
  type: "divergence" | "concurrent" | "causal";
  /** Timestamps of conflicting changes */
  timestamps: { a: Date; b: Date };
  /** Actors who made conflicting changes */
  actors?: { a: string; b: string };
  /** Resolution if already applied */
  resolution?: { value: unknown; strategy: ConflictResolutionStrategy };
}

/**
 * State branch for parallel development
 */
export interface StateBranch {
  /** Unique branch identifier */
  id: string;
  /** Branch name */
  name: string;
  /** Parent branch */
  parentBranch?: string;
  /** Base version this branch forked from */
  baseVersion: StateVersion;
  /** Current version on this branch */
  currentVersion: StateVersion;
  /** Branch status */
  status: "active" | "merged" | "abandoned" | "stale";
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Branch metadata */
  metadata?: Record<string, unknown>;
}

/**
 * State merge result
 */
export interface StateMerge {
  /** Whether merge was successful */
  success: boolean;
  /** Merged state */
  state: unknown;
  /** Result version */
  version: StateVersion;
  /** Conflicts during merge */
  conflicts: StateConflict[];
  /** Resolved conflicts */
  resolvedConflicts: StateConflict[];
  /** Merge metadata */
  metadata?: Record<string, unknown>;
}

/**
 * State validation result
 */
export interface StateValidation {
  /** Whether state is valid */
  valid: boolean;
  /** Validation errors */
  errors: ValidationError[];
  /** Validation warnings */
  warnings: ValidationWarning[];
  /** Validated schema version */
  schemaVersion?: string;
}

/**
 * Validation error details
 */
export interface ValidationError {
  /** Error code */
  code: string;
  /** Path to invalid property */
  path: string;
  /** Error message */
  message: string;
  /** Expected value/type */
  expected?: unknown;
  /** Actual value */
  actual?: unknown;
  /** Severity */
  severity: "error" | "critical";
}

/**
 * Validation warning details
 */
export interface ValidationWarning {
  /** Warning code */
  code: string;
  /** Path to property */
  path: string;
  /** Warning message */
  message: string;
  /** Suggested fix */
  suggestion?: string;
}

/**
 * State middleware context
 */
export interface StateMiddlewareContext {
  /** Current state */
  state: unknown;
  /** Next state (for pre hooks) or previous state (for post hooks) */
  nextState?: unknown;
  /** State transition */
  transition: StateTransition;
  /** Manager invoking middleware */
  manager: StateManager;
  /** Middleware execution phase */
  phase: "pre" | "post";
  /** Additional context */
  context?: Map<unknown, unknown>;
}

/**
 * State middleware function
 */
export type StateMiddleware = (
  context: StateMiddlewareContext,
  next: () => Promise<void>
) => Promise<void>;

/**
 * State manager interface
 */
export interface StateManager<T = unknown> {
  /** Manager identifier */
  id: string;
  /** Manager configuration */
  config: StateManagerConfig;
  /** Current state */
  state: T;
  /** Current state version */
  version: StateVersion;
  /** Active branches */
  branches: Map<string, StateBranch>;
  /** Current branch */
  currentBranch: string;

  /**
   * Get state at a specific scope
   */
  getState(scope: StateScope, key?: string): unknown;

  /**
   * Set state at a specific scope
   */
  setState(
    scope: StateScope,
    key: string,
    value: unknown,
    strategy?: StateStrategy
  ): Promise<void>;

  /**
   * Update state using reducer
   */
  updateState(
    scope: StateScope,
    reducer: StateReducer,
    payload?: unknown
  ): Promise<StateVersion>;

  /**
   * Create state snapshot
   */
  createSnapshot(label?: string): Promise<StateSnapshot<T>>;

  /**
   * Restore from snapshot
   */
  restoreSnapshot(snapshotId: string): Promise<void>;

  /**
   * Get state history
   */
  getHistory(scope?: StateScope, limit?: number): StateTransition[];

  /**
   * Diff two states
   */
  diff(versionA: StateVersion, versionB: StateVersion): StateDiff;

  /**
   * Apply patch to state
   */
  applyPatch(patch: StatePatch): Promise<StateVersion>;

  /**
   * Create branch
   */
  createBranch(name: string, baseVersion?: StateVersion): StateBranch;

  /**
   * Switch to branch
   */
  switchBranch(branchId: string): void;

  /**
   * Merge branches
   */
  mergeBranch(
    sourceBranch: string,
    targetBranch: string,
    strategy?: ConflictResolutionStrategy
  ): Promise<StateMerge>;

  /**
   * Validate state
   */
  validate(state?: T): StateValidation;

  /**
   * Register middleware
   */
  use(middleware: StateMiddleware): void;

  /**
   * Destroy manager and cleanup resources
   */
  destroy(): Promise<void>;
}

/**
 * State reducer function
 */
export type StateReducer<T = unknown, P = unknown> = (
  state: T,
  payload: P
) => T | Promise<T>;

/**
 * Built-in reducer types
 */
export interface BuiltInReducer<T = unknown> {
  /** Reducer name */
  name: string;
  /** Reducer function */
  reducer: StateReducer<T, unknown>;
  /** Reducer description */
  description?: string;
}

/**
 * State serialization options
 */
export interface SerializationOptions {
  /** Format to use */
  format?: "json" | "msgpack" | "binary";
  /** Enable compression */
  compress?: boolean;
  /** Compression level (0-9) */
  compressionLevel?: number;
  /** Include metadata */
  includeMetadata?: boolean;
  /** Include version */
  includeVersion?: boolean;
}

/**
 * State deserialization options
 */
export interface DeserializationOptions {
  /** Validate state after deserialization */
  validate?: boolean;
  /** Verify checksum */
  verifyChecksum?: boolean;
  /** Apply migrations if needed */
  migrate?: boolean;
  /** Target version for migration */
  targetVersion?: StateVersion;
}

/**
 * State migration for version upgrades
 */
export interface StateMigration {
  /** Source version */
  fromVersion: StateVersion;
  /** Target version */
  toVersion: StateVersion;
  /** Migration function */
  migrate: (state: unknown) => unknown | Promise<unknown>;
  /** Whether migration is reversible */
  reversible?: boolean;
  /** Rollback function */
  rollback?: (state: unknown) => unknown | Promise<unknown>;
  /** Migration metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Statistics about state manager
 */
export interface StateStatistics {
  /** Total state transitions */
  totalTransitions: number;
  /** Total snapshots created */
  totalSnapshots: number;
  /** Current state size in bytes */
  stateSize: number;
  /** Number of active branches */
  activeBranches: number;
  /** Average state update time in ms */
  averageUpdateTime: number;
  /** Total conflicts encountered */
  totalConflicts: number;
  /** Total conflicts resolved */
  resolvedConflicts: number;
  /** Cache hit rate (if applicable) */
  cacheHitRate?: number;
  /** Memory usage in bytes */
  memoryUsage: number;
}

/**
 * Event types for state manager
 */
export type StateEvent =
  | "state:change"
  | "state:snapshot"
  | "state:restore"
  | "branch:create"
  | "branch:switch"
  | "branch:merge"
  | "conflict:detect"
  | "conflict:resolve"
  | "migration:start"
  | "migration:complete"
  | "validation:error";

/**
 * State event payload
 */
export interface StateEventPayload<T = unknown> {
  /** Event type */
  type: StateEvent;
  /** Timestamp */
  timestamp: Date;
  /** Event data */
  data: T;
  /** Event source */
  source: string;
}

/**
 * State manager event listener
 */
export type StateEventListener<T = unknown> = (
  event: StateEventPayload<T>
) => void | Promise<void>;

/**
 * LangGraph state channel integration
 */
export interface LangGraphStateChannel<T = unknown> {
  /** Channel name */
  name: string;
  /** Channel value */
  value: T;
  /** Channel reducer */
  reducer?: StateReducer<T, unknown>;
  /** Channel default value */
  default?: T;
  /** Channel metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Annotation for LangGraph state
 */
export interface LangGraphStateAnnotation<T = unknown> {
  /** State channels */
  channels: Record<string, LangGraphStateChannel<T>>;
  /** Reducer for entire state */
  reducer?: StateReducer<T, unknown>;
}

/**
 * Create state version from components
 */
export function createStateVersion(
  major: number,
  minor: number,
  patch: number,
  branch?: string
): StateVersion {
  return {
    major,
    minor,
    patch,
    branch,
    toString() {
      const base = `${major}.${minor}.${patch}`;
      return branch ? `${base}+${branch}` : base;
    },
    compare(other: StateVersion): number {
      if (this.major !== other.major) return this.major - other.major;
      if (this.minor !== other.minor) return this.minor - other.minor;
      if (this.patch !== other.patch) return this.patch - other.patch;
      const thisBranch = this.branch || "";
      const otherBranch = other.branch || "";
      return thisBranch.localeCompare(otherBranch);
    },
  };
}

/**
 * Parse version string into StateVersion
 */
export function parseStateVersion(versionString: string): StateVersion {
  const [main, branch] = versionString.split("+");
  const [major, minor, patch] = main.split(".").map(Number);

  if (
    typeof major !== "number" ||
    typeof minor !== "number" ||
    typeof patch !== "number" ||
    isNaN(major) ||
    isNaN(minor) ||
    isNaN(patch)
  ) {
    throw new Error(`Invalid version string: ${versionString}`);
  }

  return createStateVersion(major, minor, patch, branch);
}

/**
 * Check if state version is compatible with another
 */
export function isVersionCompatible(
  version: StateVersion,
  baseline: StateVersion
): boolean {
  return version.major === baseline.major && version.minor >= baseline.minor;
}

/**
 * Generate unique state ID
 */
export function generateStateId(): string {
  return `state_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Generate checksum for state data
 */
export async function generateChecksum(data: unknown): Promise<string> {
  const str = JSON.stringify(data, Object.keys(data as object).sort());
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Calculate size of state data in bytes
 */
export function calculateStateSize(data: unknown): number {
  return new Blob([JSON.stringify(data)]).size;
}

/**
 * Deep clone state data
 */
export function cloneState<T>(state: T): T {
  return structuredClone(state);
}

/**
 * Deep merge two state objects
 */
export function deepMerge<T extends Record<string, unknown>>(
  base: T,
  update: Partial<T>
): T {
  const result = { ...base };

  for (const [key, value] of Object.entries(update)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      key in result &&
      result[key] &&
      typeof result[key] === "object" &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        value as Partial<Record<string, unknown>>
      ) as T[Extract<keyof T, string>];
    } else {
      result[key] = value as T[Extract<keyof T, string>];
    }
  }

  return result;
}

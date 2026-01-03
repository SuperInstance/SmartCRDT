/**
 * StateSync - Multi-modal state synchronization
 *
 * Manages synchronization of state across multiple sources
 * with conflict detection and resolution strategies.
 */

import type {
  SyncConfig,
  SyncResult,
  SyncStrategy,
  ConflictResolution,
  Conflict,
  Resolution,
  MultiModalState,
} from "../types.js";
import { ConflictResolver } from "./ConflictResolver.js";
import { ConsistencyChecker } from "./ConsistencyChecker.js";

/**
 * State synchronization manager
 */
export class StateSync {
  private config: SyncConfig;
  private conflictResolver: ConflictResolver;
  private consistencyChecker: ConsistencyChecker;
  private syncCallbacks: Set<(result: SyncResult) => void> = new Set();

  constructor(config?: Partial<SyncConfig>) {
    this.config = {
      strategy: "event",
      conflictResolution: "last_write_wins",
      timeout: 5000,
      maxRetries: 3,
      ...config,
    };

    this.conflictResolver = new ConflictResolver(
      this.config.conflictResolution
    );
    this.consistencyChecker = new ConsistencyChecker();

    if (this.config.strategy === "polling") {
      this.startPolling();
    }
  }

  /**
   * Synchronize local state with remote
   */
  async sync(
    local: MultiModalState,
    remote: MultiModalState
  ): Promise<SyncResult> {
    const startTime = performance.now();

    try {
      // Check for conflicts
      const conflicts = this.detectConflicts(local, remote);

      // Resolve conflicts
      const resolutions: Resolution[] = [];
      for (const conflict of conflicts) {
        const resolution = this.conflictResolver.resolve(
          conflict,
          local,
          remote
        );
        resolutions.push(resolution);
      }

      // Apply resolutions
      let synced = true;
      let syncedState = local;

      for (const resolution of resolutions) {
        syncedState = this.applyResolution(syncedState, resolution);
      }

      // Check consistency
      const consistency = this.consistencyChecker.check(syncedState);

      const duration = performance.now() - startTime;
      const result: SyncResult = {
        synced: synced && consistency.consistent,
        conflicts,
        resolution: resolutions,
        duration,
        error: consistency.consistent
          ? undefined
          : consistency.errors.join(", "),
      };

      // Notify callbacks
      this.notifyCallbacks(result);

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      const syncResult: SyncResult = {
        synced: false,
        conflicts: [],
        resolution: [],
        duration,
        error: error instanceof Error ? error.message : String(error),
      };

      this.notifyCallbacks(syncResult);
      return syncResult;
    }
  }

  /**
   * Detect conflicts between local and remote states
   */
  private detectConflicts(
    local: MultiModalState,
    remote: MultiModalState
  ): Conflict[] {
    const conflicts: Conflict[] = [];
    const timestamp = Date.now();

    // Check text conflicts
    if (
      local.text.input !== remote.text.input &&
      local.version > 0 &&
      remote.version > 0
    ) {
      conflicts.push({
        id: `text_input_${timestamp}`,
        field: "text.input",
        localValue: local.text.input,
        remoteValue: remote.text.input,
        timestamp,
        severity: "medium",
      });
    }

    // Check confidence conflicts
    if (Math.abs(local.confidence - remote.confidence) > 0.2) {
      conflicts.push({
        id: `confidence_${timestamp}`,
        field: "confidence",
        localValue: local.confidence,
        remoteValue: remote.confidence,
        timestamp,
        severity: "low",
      });
    }

    // Check embedding conflicts (high severity)
    if (
      !this.embeddingsEqual(local.embedding.vector, remote.embedding.vector)
    ) {
      conflicts.push({
        id: `embedding_vector_${timestamp}`,
        field: "embedding.vector",
        localValue: "<embedding>",
        remoteValue: "<embedding>",
        timestamp,
        severity: "high",
      });
    }

    // Check version conflicts
    if (local.version === remote.version && local.id !== remote.id) {
      conflicts.push({
        id: `version_${timestamp}`,
        field: "version",
        localValue: local.version,
        remoteValue: remote.version,
        timestamp,
        severity: "high",
      });
    }

    return conflicts;
  }

  /**
   * Check if embeddings are equal
   */
  private embeddingsEqual(a: Float32Array, b: Float32Array): boolean {
    if (a.length !== b.length) {
      return false;
    }

    for (let i = 0; i < a.length; i++) {
      if (Math.abs(a[i] - b[i]) > 1e-6) {
        return false;
      }
    }

    return true;
  }

  /**
   * Apply resolution to state
   */
  private applyResolution(
    state: MultiModalState,
    resolution: Resolution
  ): MultiModalState {
    const result = { ...state };

    if (resolution.field === "text.input") {
      result.text = { ...result.text, input: resolution.value as string };
    } else if (resolution.field === "confidence") {
      result.confidence = resolution.value as number;
    } else if (resolution.field === "embedding.vector") {
      result.embedding = {
        ...result.embedding,
        vector: resolution.value as Float32Array,
      };
    }

    return result;
  }

  /**
   * Start polling for sync
   */
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  private startPolling(): void {
    if (this.config.strategy === "polling" && this.config.pollInterval) {
      this.pollTimer = setInterval(() => {
        this.onPoll();
      }, this.config.pollInterval);
    }
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Handle polling event
   */
  private onPoll(): void {
    // Override in subclass for actual polling implementation
    // This is a hook for subclasses to implement
  }

  /**
   * Register sync callback
   */
  onSync(callback: (result: SyncResult) => void): () => void {
    this.syncCallbacks.add(callback);
    return () => {
      this.syncCallbacks.delete(callback);
    };
  }

  /**
   * Notify all callbacks
   */
  private notifyCallbacks(result: SyncResult): void {
    for (const callback of this.syncCallbacks) {
      try {
        callback(result);
      } catch (error) {
        console.error("Error in sync callback:", error);
      }
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SyncConfig>): void {
    const wasPolling = this.config.strategy === "polling" && this.pollTimer;

    if (wasPolling) {
      this.stopPolling();
    }

    Object.assign(this.config, config);

    if (this.config.strategy === "polling" && !this.pollTimer) {
      this.startPolling();
    }

    this.conflictResolver = new ConflictResolver(
      this.config.conflictResolution
    );
  }

  /**
   * Get current configuration
   */
  getConfig(): SyncConfig {
    return { ...this.config };
  }

  /**
   * Destroy sync manager
   */
  destroy(): void {
    this.stopPolling();
    this.syncCallbacks.clear();
  }
}

export { ConflictResolver } from "./ConflictResolver.js";
export { ConsistencyChecker } from "./ConsistencyChecker.js";

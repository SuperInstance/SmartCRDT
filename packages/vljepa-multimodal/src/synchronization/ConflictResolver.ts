/**
 * ConflictResolver - Resolve state conflicts
 *
 * Implements various strategies for resolving conflicts
 * between local and remote state updates.
 */

import type {
  Conflict,
  ConflictResolution,
  Resolution,
  MultiModalState,
} from "../types.js";

/**
 * Conflict resolution strategies
 */
export class ConflictResolver {
  private strategy: ConflictResolution;

  constructor(strategy: ConflictResolution = "last_write_wins") {
    this.strategy = strategy;
  }

  /**
   * Resolve a conflict using configured strategy
   */
  resolve(
    conflict: Conflict,
    local: MultiModalState,
    remote: MultiModalState
  ): Resolution {
    switch (this.strategy) {
      case "last_write_wins":
        return this.lastWriteWins(conflict, local, remote);
      case "merge":
        return this.merge(conflict, local, remote);
      case "manual":
        return this.manual(conflict);
      default:
        return this.lastWriteWins(conflict, local, remote);
    }
  }

  /**
   * Last write wins: choose the more recently updated state
   */
  private lastWriteWins(
    conflict: Conflict,
    local: MultiModalState,
    remote: MultiModalState
  ): Resolution {
    const value =
      local.modified >= remote.modified
        ? conflict.localValue
        : conflict.remoteValue;

    return {
      conflictId: conflict.id,
      strategy: "last_write_wins",
      value,
      timestamp: Date.now(),
      resolvedBy: "system",
    };
  }

  /**
   * Merge: combine values intelligently
   */
  private merge(
    conflict: Conflict,
    local: MultiModalState,
    remote: MultiModalState
  ): Resolution {
    let value: unknown;

    switch (conflict.field) {
      case "confidence":
        // Average confidence values
        value =
          (((conflict.localValue as number) + conflict.remoteValue) as number) /
          2;
        break;

      case "text.input":
        // Concatenate with separator
        const localText = conflict.localValue as string;
        const remoteText = conflict.remoteValue as string;
        value = localText.length > remoteText.length ? localText : remoteText;
        break;

      case "embedding.vector":
        // Average embeddings
        const localEmb = local.embedding.vector;
        const remoteEmb = remote.embedding.vector;
        const mergedEmb = new Float32Array(localEmb.length);
        for (let i = 0; i < localEmb.length; i++) {
          mergedEmb[i] = (localEmb[i] + remoteEmb[i]) / 2;
        }
        value = mergedEmb;
        break;

      case "metadata.tags":
        // Union of tags
        const localTags = new Set(local.metadata.tags);
        const remoteTags = new Set(remote.metadata.tags);
        value = Array.from(new Set([...localTags, ...remoteTags]));
        break;

      default:
        // Default to local
        value = conflict.localValue;
    }

    return {
      conflictId: conflict.id,
      strategy: "merge",
      value,
      timestamp: Date.now(),
      resolvedBy: "system",
    };
  }

  /**
   * Manual: mark for manual resolution
   */
  private manual(conflict: Conflict): Resolution {
    return {
      conflictId: conflict.id,
      strategy: "manual",
      value: conflict.localValue, // Keep local until manual resolution
      timestamp: Date.now(),
      resolvedBy: "user",
    };
  }

  /**
   * Resolve multiple conflicts
   */
  resolveAll(
    conflicts: Conflict[],
    local: MultiModalState,
    remote: MultiModalState
  ): Resolution[] {
    return conflicts.map(conflict => this.resolve(conflict, local, remote));
  }

  /**
   * Update resolution strategy
   */
  setStrategy(strategy: ConflictResolution): void {
    this.strategy = strategy;
  }

  /**
   * Get current strategy
   */
  getStrategy(): ConflictResolution {
    return this.strategy;
  }

  /**
   * Batch resolve with automatic retries for failures
   */
  async resolveBatch(
    conflicts: Conflict[],
    local: MultiModalState,
    remote: MultiModalState,
    maxRetries: number = 3
  ): Promise<{ resolutions: Resolution[]; failures: Conflict[] }> {
    const resolutions: Resolution[] = [];
    const failures: Conflict[] = [];

    for (const conflict of conflicts) {
      let attempts = 0;
      let resolved = false;

      while (attempts < maxRetries && !resolved) {
        try {
          const resolution = this.resolve(conflict, local, remote);
          resolutions.push(resolution);
          resolved = true;
        } catch (error) {
          attempts++;
          if (attempts >= maxRetries) {
            failures.push(conflict);
          }
        }
      }
    }

    return { resolutions, failures };
  }

  /**
   * Create manual resolution for user input
   */
  createManualResolution(conflictId: string, value: unknown): Resolution {
    return {
      conflictId,
      strategy: "manual",
      value,
      timestamp: Date.now(),
      resolvedBy: "user",
    };
  }

  /**
   * Validate resolution
   */
  validateResolution(resolution: Resolution, conflict: Conflict): boolean {
    // Check if resolution matches conflict
    if (resolution.conflictId !== conflict.id) {
      return false;
    }

    // Check if value type matches
    const localType = typeof conflict.localValue;
    const resolvedType = typeof resolution.value;

    if (localType !== resolvedType && localType !== "object") {
      return false;
    }

    return true;
  }
}

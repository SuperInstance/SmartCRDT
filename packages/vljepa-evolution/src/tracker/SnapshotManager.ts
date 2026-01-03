/**
 * SnapshotManager - Manages UI state snapshots
 */

import type { UIState, UIVersion } from "../types.js";

export interface Snapshot {
  id: string;
  version: string;
  timestamp: number;
  state: UIState;
  compressed: boolean;
  size: number;
}

export class SnapshotManager {
  private snapshots: Map<string, Snapshot>;
  private maxSnapshots: number;
  private compressionEnabled: boolean;

  constructor(config: SnapshotConfig = {}) {
    this.snapshots = new Map();
    this.maxSnapshots = config.maxSnapshots ?? 100;
    this.compressionEnabled = config.compression ?? true;
  }

  /**
   * Create a snapshot from UI state
   */
  async createSnapshot(version: string, state: UIState): Promise<Snapshot> {
    const snapshot: Snapshot = {
      id: this.generateSnapshotId(),
      version,
      timestamp: Date.now(),
      state: this.compressionEnabled ? this.compress(state) : state,
      compressed: this.compressionEnabled,
      size: this.calculateSize(state),
    };

    this.snapshots.set(snapshot.id, snapshot);

    // Enforce max snapshots
    if (this.snapshots.size > this.maxSnapshots) {
      const oldest = this.findOldestSnapshot();
      if (oldest) {
        this.snapshots.delete(oldest.id);
      }
    }

    return snapshot;
  }

  /**
   * Get a snapshot by ID
   */
  getSnapshot(id: string): Snapshot | undefined {
    return this.snapshots.get(id);
  }

  /**
   * Get snapshots for a version
   */
  getSnapshotsForVersion(version: string): Snapshot[] {
    return Array.from(this.snapshots.values()).filter(
      s => s.version === version
    );
  }

  /**
   * Get latest snapshot
   */
  getLatestSnapshot(): Snapshot | undefined {
    const snapshots = Array.from(this.snapshots.values());
    if (snapshots.length === 0) {
      return undefined;
    }

    return snapshots.sort((a, b) => b.timestamp - a.timestamp)[0];
  }

  /**
   * Delete a snapshot
   */
  deleteSnapshot(id: string): boolean {
    return this.snapshots.delete(id);
  }

  /**
   * Delete all snapshots for a version
   */
  deleteSnapshotsForVersion(version: string): number {
    let count = 0;

    for (const [id, snapshot] of this.snapshots) {
      if (snapshot.version === version) {
        this.snapshots.delete(id);
        count++;
      }
    }

    return count;
  }

  /**
   * Get all snapshots
   */
  getAllSnapshots(): Snapshot[] {
    return Array.from(this.snapshots.values());
  }

  /**
   * Get snapshot statistics
   */
  getStatistics(): SnapshotStatistics {
    const snapshots = Array.from(this.snapshots.values());

    return {
      totalSnapshots: snapshots.length,
      totalSize: snapshots.reduce((sum, s) => sum + s.size, 0),
      oldest:
        snapshots.length > 0
          ? Math.min(...snapshots.map(s => s.timestamp))
          : undefined,
      newest:
        snapshots.length > 0
          ? Math.max(...snapshots.map(s => s.timestamp))
          : undefined,
      compressedCount: snapshots.filter(s => s.compressed).length,
      versions: [...new Set(snapshots.map(s => s.version))],
    };
  }

  /**
   * Clear all snapshots
   */
  clear(): void {
    this.snapshots.clear();
  }

  // Private methods

  private compress(state: UIState): UIState {
    // Simple compression - in production would use actual compression
    return JSON.parse(JSON.stringify(state));
  }

  private decompress(state: UIState): UIState {
    return JSON.parse(JSON.stringify(state));
  }

  private calculateSize(state: UIState): number {
    return JSON.stringify(state).length;
  }

  private findOldestSnapshot(): Snapshot | undefined {
    const snapshots = Array.from(this.snapshots.values());
    if (snapshots.length === 0) {
      return undefined;
    }

    return snapshots.sort((a, b) => a.timestamp - b.timestamp)[0];
  }

  private generateSnapshotId(): string {
    return `snap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export interface SnapshotConfig {
  maxSnapshots?: number;
  compression?: boolean;
}

export interface SnapshotStatistics {
  totalSnapshots: number;
  totalSize: number;
  oldest?: number;
  newest?: number;
  compressedCount: number;
  versions: string[];
}

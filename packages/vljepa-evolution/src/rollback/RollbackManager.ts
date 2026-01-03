/**
 * RollbackManager - Manage UI rollbacks
 */

import type {
  UIState,
  UIVersion,
  RollbackConfig,
  RollbackResult,
  Change,
  Backup,
} from "../types.js";
import {
  SnapshotManager,
  type SnapshotConfig,
} from "../tracker/SnapshotManager.js";

export class RollbackManager {
  private snapshotManager: SnapshotManager;
  private rollbackHistory: RollbackRecord[];
  private maxHistory: number;

  constructor(config: RollbackManagerConfig = {}) {
    this.snapshotManager = new SnapshotManager(config.snapshot);
    this.rollbackHistory = [];
    this.maxHistory = config.maxHistory ?? 100;
  }

  /**
   * Create backup before making changes
   */
  async createBackup(
    version: string,
    state: UIState,
    metadata?: BackupMetadata
  ): Promise<Backup> {
    const snapshot = await this.snapshotManager.createSnapshot(version, state);

    return {
      id: snapshot.id,
      version: snapshot.version,
      timestamp: snapshot.timestamp,
      state: snapshot.state,
      metadata: {
        size: snapshot.size,
        compressed: snapshot.compressed,
        checksum: this.calculateChecksum(snapshot.state),
        ...metadata,
      },
    };
  }

  /**
   * Rollback to a specific version
   */
  async rollbackToVersion(
    currentVersion: string,
    targetVersion: string,
    currentState: UIState,
    targetState: UIState,
    config: Partial<RollbackConfig> = {}
  ): Promise<RollbackResult> {
    const finalConfig: RollbackConfig = {
      preserveState: config.preserveState ?? true,
      backupBefore: config.backupBefore ?? true,
      confirm: config.confirm ?? false,
    };

    // Create backup if requested
    let backup: Backup | undefined;
    if (finalConfig.backupBefore) {
      backup = await this.createBackup(currentVersion, currentState);
    }

    // Calculate changes
    const changes = this.extractChanges(currentState, targetState);

    // Perform rollback
    const result: RollbackResult = {
      success: true,
      previousVersion: currentVersion,
      newVersion: targetVersion,
      changes,
      statePreserved: finalConfig.preserveState,
    };

    // Record rollback
    this.recordRollback({
      timestamp: Date.now(),
      fromVersion: currentVersion,
      toVersion: targetVersion,
      backupId: backup?.id,
      changes: changes.length,
      success: result.success,
    });

    return result;
  }

  /**
   * Undo last change
   */
  async undo(
    currentState: UIState,
    previousStates: UIState[],
    config: Partial<RollbackConfig> = {}
  ): Promise<RollbackResult> {
    if (previousStates.length === 0) {
      throw new Error("No previous states to undo to");
    }

    const previousState = previousStates[previousStates.length - 1];
    const currentVersion = "current";
    const previousVersion = `undo-${Date.now()}`;

    return this.rollbackToVersion(
      currentVersion,
      previousVersion,
      currentState,
      previousState,
      config
    );
  }

  /**
   * Redo undone change
   */
  async redo(
    currentState: UIState,
    futureStates: UIState[],
    config: Partial<RollbackConfig> = {}
  ): Promise<RollbackResult> {
    if (futureStates.length === 0) {
      throw new Error("No future states to redo to");
    }

    const futureState = futureStates[0];
    const currentVersion = "current";
    const futureVersion = `redo-${Date.now()}`;

    return this.rollbackToVersion(
      currentVersion,
      futureVersion,
      currentState,
      futureState,
      config
    );
  }

  /**
   * Get backup by ID
   */
  getBackup(id: string): Backup | undefined {
    const snapshot = this.snapshotManager.getSnapshot(id);
    if (!snapshot) {
      return undefined;
    }

    return {
      id: snapshot.id,
      version: snapshot.version,
      timestamp: snapshot.timestamp,
      state: snapshot.state,
      metadata: {
        size: snapshot.size,
        compressed: snapshot.compressed,
        checksum: this.calculateChecksum(snapshot.state),
      },
    };
  }

  /**
   * Get all backups
   */
  getAllBackups(): Backup[] {
    return this.snapshotManager.getAllSnapshots().map(s => ({
      id: s.id,
      version: s.version,
      timestamp: s.timestamp,
      state: s.state,
      metadata: {
        size: s.size,
        compressed: s.compressed,
        checksum: this.calculateChecksum(s.state),
      },
    }));
  }

  /**
   * Get backups for a version
   */
  getBackupsForVersion(version: string): Backup[] {
    return this.snapshotManager.getSnapshotsForVersion(version).map(s => ({
      id: s.id,
      version: s.version,
      timestamp: s.timestamp,
      state: s.state,
      metadata: {
        size: s.size,
        compressed: s.compressed,
        checksum: this.calculateChecksum(s.state),
      },
    }));
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backupId: string): Promise<UIState> {
    const backup = this.getBackup(backupId);
    if (!backup) {
      throw new Error(`Backup ${backupId} not found`);
    }

    return backup.state;
  }

  /**
   * Delete a backup
   */
  deleteBackup(backupId: string): boolean {
    return this.snapshotManager.deleteSnapshot(backupId);
  }

  /**
   * Get rollback history
   */
  getRollbackHistory(): RollbackRecord[] {
    return [...this.rollbackHistory];
  }

  /**
   * Get rollback statistics
   */
  getStatistics(): RollbackStatistics {
    const successful = this.rollbackHistory.filter(r => r.success).length;
    const failed = this.rollbackHistory.length - successful;

    return {
      totalRollbacks: this.rollbackHistory.length,
      successful,
      failed,
      averageChangesPerRollback: this.calculateAverageChanges(),
      totalBackups: this.snapshotManager.getAllSnapshots().length,
    };
  }

  /**
   * Clear rollback history
   */
  clearHistory(): void {
    this.rollbackHistory = [];
  }

  /**
   * Clear all backups
   */
  clearBackups(): void {
    this.snapshotManager.clear();
  }

  /**
   * Verify backup integrity
   */
  verifyBackup(backupId: string): boolean {
    const backup = this.getBackup(backupId);
    if (!backup) {
      return false;
    }

    const calculatedChecksum = this.calculateChecksum(backup.state);
    return calculatedChecksum === backup.metadata.checksum;
  }

  /**
   * Verify all backups
   */
  verifyAllBackups(): { valid: string[]; invalid: string[] } {
    const backups = this.getAllBackups();
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const backup of backups) {
      if (this.verifyBackup(backup.id)) {
        valid.push(backup.id);
      } else {
        invalid.push(backup.id);
      }
    }

    return { valid, invalid };
  }

  // Private methods

  private extractChanges(from: UIState, to: UIState): Change[] {
    const changes: Change[] = [];

    // Extract visual changes
    if (JSON.stringify(from.styles) !== JSON.stringify(to.styles)) {
      changes.push({
        type: "visual",
        path: "styles",
        severity: "minor",
        description: "Styles changed",
        before: from.styles,
        after: to.styles,
      });
    }

    // Extract structural changes
    if (JSON.stringify(from.layout) !== JSON.stringify(to.layout)) {
      changes.push({
        type: "structural",
        path: "layout",
        severity: "major",
        description: "Layout changed",
        before: from.layout,
        after: to.layout,
      });
    }

    // Extract behavioral changes
    if (JSON.stringify(from.behavior) !== JSON.stringify(to.behavior)) {
      changes.push({
        type: "behavioral",
        path: "behavior",
        severity: "major",
        description: "Behavior changed",
        before: from.behavior,
        after: to.behavior,
      });
    }

    return changes;
  }

  private calculateChecksum(state: UIState): string {
    const str = JSON.stringify(state);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  private recordRollback(record: RollbackRecord): void {
    this.rollbackHistory.push(record);

    // Enforce max history
    if (this.rollbackHistory.length > this.maxHistory) {
      this.rollbackHistory.shift();
    }
  }

  private calculateAverageChanges(): number {
    if (this.rollbackHistory.length === 0) {
      return 0;
    }

    const total = this.rollbackHistory.reduce((sum, r) => sum + r.changes, 0);
    return total / this.rollbackHistory.length;
  }
}

export interface RollbackManagerConfig {
  snapshot?: SnapshotConfig;
  maxHistory?: number;
}

export interface RollbackRecord {
  timestamp: number;
  fromVersion: string;
  toVersion: string;
  backupId?: string;
  changes: number;
  success: boolean;
}

export interface RollbackStatistics {
  totalRollbacks: number;
  successful: number;
  failed: number;
  averageChangesPerRollback: number;
  totalBackups: number;
}

export interface BackupMetadata {
  size?: number;
  compressed?: boolean;
  checksum?: string;
  description?: string;
  author?: string;
}

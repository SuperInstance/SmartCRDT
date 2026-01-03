/**
 * BackupManager - Manage UI state backups with compression and encryption
 */

import type { UIState, Backup, BackupMetadata } from "../types.js";

export interface BackupPolicy {
  maxBackups: number;
  retentionDays: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  autoBackup: boolean;
  backupInterval: number; // minutes
}

export interface BackupSchedule {
  version: string;
  timestamp: number;
  priority: "low" | "medium" | "high";
}

export class BackupManager {
  private backups: Map<string, Backup>;
  private schedules: BackupSchedule[];
  private policy: BackupPolicy;

  constructor(policy: Partial<BackupPolicy> = {}) {
    this.backups = new Map();
    this.schedules = [];
    this.policy = {
      maxBackups: policy.maxBackups ?? 50,
      retentionDays: policy.retentionDays ?? 30,
      compressionEnabled: policy.compressionEnabled ?? true,
      encryptionEnabled: policy.encryptionEnabled ?? false,
      autoBackup: policy.autoBackup ?? false,
      backupInterval: policy.backupInterval ?? 60,
    };
  }

  /**
   * Create a backup
   */
  async createBackup(
    version: string,
    state: UIState,
    metadata?: Partial<BackupMetadata>
  ): Promise<Backup> {
    const startTime = Date.now();

    // Process state
    let processedState = state;

    if (this.policy.compressionEnabled) {
      processedState = this.compress(state);
    }

    if (this.policy.encryptionEnabled) {
      processedState = await this.encrypt(processedState);
    }

    const backup: Backup = {
      id: this.generateBackupId(),
      version,
      timestamp: startTime,
      state: processedState,
      metadata: {
        size: this.calculateSize(state),
        compressed: this.policy.compressionEnabled,
        checksum: this.calculateChecksum(state),
        ...metadata,
      },
    };

    this.backups.set(backup.id, backup);

    // Enforce retention policy
    await this.enforceRetentionPolicy();

    return backup;
  }

  /**
   * Get a backup
   */
  getBackup(id: string): Backup | undefined {
    return this.backups.get(id);
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(id: string): Promise<UIState> {
    const backup = this.backups.get(id);
    if (!backup) {
      throw new Error(`Backup ${id} not found`);
    }

    let state = backup.state;

    if (this.policy.encryptionEnabled) {
      state = await this.decrypt(state);
    }

    if (backup.metadata.compressed) {
      state = this.decompress(state);
    }

    return state;
  }

  /**
   * Delete a backup
   */
  deleteBackup(id: string): boolean {
    return this.backups.delete(id);
  }

  /**
   * Get all backups
   */
  getAllBackups(): Backup[] {
    return Array.from(this.backups.values()).sort(
      (a, b) => b.timestamp - a.timestamp
    );
  }

  /**
   * Get backups for a version
   */
  getBackupsForVersion(version: string): Backup[] {
    return this.getAllBackups().filter(b => b.version === version);
  }

  /**
   * Get latest backup
   */
  getLatestBackup(): Backup | undefined {
    const backups = this.getAllBackups();
    return backups.length > 0 ? backups[0] : undefined;
  }

  /**
   * Schedule a backup
   */
  scheduleBackup(
    version: string,
    priority: BackupSchedule["priority"] = "medium"
  ): void {
    this.schedules.push({
      version,
      timestamp: Date.now(),
      priority,
    });
  }

  /**
   * Get pending backups
   */
  getPendingBackups(): BackupSchedule[] {
    return [...this.schedules];
  }

  /**
   * Process scheduled backups
   */
  async processScheduledBackups(
    getStateForVersion: (version: string) => Promise<UIState>
  ): Promise<Backup[]> {
    const backups: Backup[] = [];

    // Sort by priority
    const sorted = [...this.schedules].sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    for (const schedule of sorted) {
      try {
        const state = await getStateForVersion(schedule.version);
        const backup = await this.createBackup(schedule.version, state);
        backups.push(backup);
      } catch (error) {
        console.error(
          `Failed to create backup for version ${schedule.version}:`,
          error
        );
      }
    }

    // Clear processed schedules
    this.schedules = [];

    return backups;
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(id: string): Promise<boolean> {
    const backup = this.backups.get(id);
    if (!backup) {
      return false;
    }

    const calculatedChecksum = this.calculateChecksum(
      await this.restoreFromBackup(id)
    );

    return calculatedChecksum === backup.metadata.checksum;
  }

  /**
   * Verify all backups
   */
  async verifyAllBackups(): Promise<{
    valid: string[];
    invalid: string[];
    corrupted: string[];
  }> {
    const valid: string[] = [];
    const invalid: string[] = [];
    const corrupted: string[] = [];

    for (const [id, backup] of this.backups) {
      try {
        const isIntact = await this.verifyBackup(id);
        if (isIntact) {
          valid.push(id);
        } else {
          corrupted.push(id);
        }
      } catch (error) {
        invalid.push(id);
      }
    }

    return { valid, invalid, corrupted };
  }

  /**
   * Get backup statistics
   */
  getStatistics(): BackupStatistics {
    const backups = this.getAllBackups();

    const totalSize = backups.reduce(
      (sum, b) => sum + (b.metadata.size ?? 0),
      0
    );
    const compressedCount = backups.filter(b => b.metadata.compressed).length;

    const now = Date.now();
    const retentionCutoff =
      now - this.policy.retentionDays * 24 * 60 * 60 * 1000;

    const expired = backups.filter(b => b.timestamp < retentionCutoff).length;

    return {
      totalBackups: backups.length,
      totalSize,
      compressedCount,
      uncompressedCount: backups.length - compressedCount,
      oldestBackup: backups[backups.length - 1]?.timestamp,
      newestBackup: backups[0]?.timestamp,
      expiredBackups: expired,
      scheduledBackups: this.schedules.length,
    };
  }

  /**
   * Clean expired backups
   */
  async cleanExpiredBackups(): Promise<number> {
    const now = Date.now();
    const retentionCutoff =
      now - this.policy.retentionDays * 24 * 60 * 60 * 1000;

    let cleaned = 0;

    for (const [id, backup] of this.backups) {
      if (backup.timestamp < retentionCutoff) {
        this.backups.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Export backups metadata
   */
  exportMetadata(): string {
    const metadata = Array.from(this.backups.values()).map(b => ({
      id: b.id,
      version: b.version,
      timestamp: b.timestamp,
      metadata: b.metadata,
    }));

    return JSON.stringify(metadata, null, 2);
  }

  /**
   * Clear all backups
   */
  clear(): void {
    this.backups.clear();
    this.schedules = [];
  }

  // Private methods

  private async enforceRetentionPolicy(): Promise<void> {
    // Enforce max backups
    while (this.backups.size > this.policy.maxBackups) {
      const oldest = this.findOldestBackup();
      if (oldest) {
        this.backups.delete(oldest.id);
      }
    }

    // Clean expired backups
    await this.cleanExpiredBackups();
  }

  private findOldestBackup(): Backup | undefined {
    const backups = Array.from(this.backups.values());
    if (backups.length === 0) {
      return undefined;
    }

    return backups.sort((a, b) => a.timestamp - b.timestamp)[0];
  }

  private compress(state: UIState): UIState {
    // Simple compression - in production would use actual compression
    return JSON.parse(JSON.stringify(state));
  }

  private decompress(state: UIState): UIState {
    return JSON.parse(JSON.stringify(state));
  }

  private async encrypt(state: UIState): Promise<UIState> {
    // Placeholder for encryption
    return state;
  }

  private async decrypt(state: UIState): Promise<UIState> {
    // Placeholder for decryption
    return state;
  }

  private calculateSize(state: UIState): number {
    return JSON.stringify(state).length;
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

  private generateBackupId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export interface BackupStatistics {
  totalBackups: number;
  totalSize: number;
  compressedCount: number;
  uncompressedCount: number;
  oldestBackup?: number;
  newestBackup?: number;
  expiredBackups: number;
  scheduledBackups: number;
}

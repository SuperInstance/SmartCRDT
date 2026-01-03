/**
 * RollbackManager Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RollbackManager } from '../src/rollback/RollbackManager.js';
import type { UIState } from '../src/types.js';

describe('RollbackManager', () => {
  let manager: RollbackManager;
  let mockState: UIState;

  beforeEach(() => {
    manager = new RollbackManager({
      snapshot: {
        maxSnapshots: 50,
        compression: true
      },
      maxHistory: 100
    });

    mockState = {
      components: [
        {
          id: 'comp1',
          type: 'button',
          props: { label: 'Click' },
          children: [],
          styles: { backgroundColor: 'blue' }
        }
      ],
      styles: {
        css: { color: 'white' },
        theme: 'dark',
        variables: {}
      },
      layout: {
        type: 'flex',
        dimensions: { width: 100 },
        position: {},
        children: []
      },
      behavior: {
        events: [],
        actions: []
      },
      metadata: {
        version: '1.0.0',
        timestamp: Date.now(),
        hash: 'abc123',
        author: 'test'
      }
    };
  });

  describe('initialization', () => {
    it('should create manager with default config', () => {
      const defaultManager = new RollbackManager();
      expect(defaultManager).toBeDefined();
    });

    it('should create manager with custom config', () => {
      const customManager = new RollbackManager({
        maxHistory: 50
      });
      expect(customManager).toBeDefined();
    });
  });

  describe('createBackup', () => {
    it('should create backup', async () => {
      const backup = await manager.createBackup('1.0.0', mockState);

      expect(backup).toBeDefined();
      expect(backup.version).toBe('1.0.0');
      expect(backup.state).toEqual(mockState);
      expect(backup.metadata.size).toBeGreaterThan(0);
      expect(backup.metadata.checksum).toBeDefined();
    });

    it('should include custom metadata', async () => {
      const backup = await manager.createBackup('1.0.0', mockState, {
        description: 'Test backup',
        author: 'alice'
      });

      expect(backup.metadata.description).toBe('Test backup');
      expect(backup.metadata.author).toBe('alice');
    });

    it('should calculate checksum', async () => {
      const backup = await manager.createBackup('1.0.0', mockState);

      expect(backup.metadata.checksum).toBeTruthy();
      expect(backup.metadata.checksum.length).toBeGreaterThan(0);
    });
  });

  describe('rollbackToVersion', () => {
    it('should rollback to target version', async () => {
      const currentState = { ...mockState };
      currentState.styles.css.color = 'red';

      const result = await manager.rollbackToVersion(
        '1.0.0',
        '0.9.0',
        currentState,
        mockState
      );

      expect(result.success).toBe(true);
      expect(result.previousVersion).toBe('1.0.0');
      expect(result.newVersion).toBe('0.9.0');
      expect(result.changes).toBeDefined();
    });

    it('should create backup when configured', async () => {
      const result = await manager.rollbackToVersion(
        '1.0.0',
        '0.9.0',
        mockState,
        mockState,
        { backupBefore: true }
      );

      expect(result.success).toBe(true);
      expect(manager.getAllBackups().length).toBeGreaterThan(0);
    });

    it('should preserve state when configured', async () => {
      const result = await manager.rollbackToVersion(
        '1.0.0',
        '0.9.0',
        mockState,
        mockState,
        { preserveState: true }
      );

      expect(result.statePreserved).toBe(true);
    });

    it('should extract changes', async () => {
      const modifiedState = { ...mockState };
      modifiedState.styles.theme = 'light';

      const result = await manager.rollbackToVersion(
        '1.0.0',
        '0.9.0',
        modifiedState,
        mockState
      );

      expect(result.changes.length).toBeGreaterThan(0);
    });
  });

  describe('undo', () => {
    it('should undo to previous state', async () => {
      const previousStates = [{ ...mockState }];

      const result = await manager.undo(mockState, previousStates);

      expect(result.success).toBe(true);
      expect(result.changes).toBeDefined();
    });

    it('should throw error when no previous states', async () => {
      await expect(manager.undo(mockState, [])).rejects.toThrow();
    });
  });

  describe('redo', () => {
    it('should redo to future state', async () => {
      const futureStates = [{ ...mockState }];

      const result = await manager.redo(mockState, futureStates);

      expect(result.success).toBe(true);
      expect(result.changes).toBeDefined();
    });

    it('should throw error when no future states', async () => {
      await expect(manager.redo(mockState, [])).rejects.toThrow();
    });
  });

  describe('getBackup', () => {
    it('should get backup by ID', async () => {
      const backup = await manager.createBackup('1.0.0', mockState);

      const retrieved = manager.getBackup(backup.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(backup.id);
      expect(retrieved?.version).toBe('1.0.0');
    });

    it('should return undefined for non-existent backup', () => {
      const retrieved = manager.getBackup('nonexistent');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('getAllBackups', () => {
    it('should get all backups', async () => {
      await manager.createBackup('1.0.0', mockState);
      await manager.createBackup('1.0.1', mockState);

      const backups = manager.getAllBackups();

      expect(backups.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty array when no backups', () => {
      const backups = manager.getAllBackups();

      expect(backups).toEqual([]);
    });
  });

  describe('getBackupsForVersion', () => {
    it('should get backups for version', async () => {
      await manager.createBackup('1.0.0', mockState);
      await manager.createBackup('1.0.0', mockState);

      const backups = manager.getBackupsForVersion('1.0.0');

      expect(backups.length).toBeGreaterThanOrEqual(2);
      expect(backups.every(b => b.version === '1.0.0')).toBe(true);
    });
  });

  describe('restoreFromBackup', () => {
    it('should restore state from backup', async () => {
      const backup = await manager.createBackup('1.0.0', mockState);

      const restored = await manager.restoreFromBackup(backup.id);

      expect(restored).toEqual(mockState);
    });

    it('should throw error for non-existent backup', async () => {
      await expect(manager.restoreFromBackup('nonexistent')).rejects.toThrow();
    });
  });

  describe('deleteBackup', () => {
    it('should delete backup', async () => {
      const backup = await manager.createBackup('1.0.0', mockState);

      const deleted = manager.deleteBackup(backup.id);

      expect(deleted).toBe(true);
      expect(manager.getBackup(backup.id)).toBeUndefined();
    });

    it('should return false for non-existent backup', () => {
      const deleted = manager.deleteBackup('nonexistent');

      expect(deleted).toBe(false);
    });
  });

  describe('getRollbackHistory', () => {
    it('should get rollback history', async () => {
      await manager.rollbackToVersion('1.0.0', '0.9.0', mockState, mockState);

      const history = manager.getRollbackHistory();

      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0].success).toBe(true);
    });

    it('should return empty array initially', () => {
      const history = manager.getRollbackHistory();

      expect(history).toEqual([]);
    });
  });

  describe('getStatistics', () => {
    it('should get rollback statistics', async () => {
      await manager.rollbackToVersion('1.0.0', '0.9.0', mockState, mockState);

      const stats = manager.getStatistics();

      expect(stats.totalRollbacks).toBeGreaterThanOrEqual(1);
      expect(stats.successful).toBeGreaterThanOrEqual(1);
      expect(stats.totalBackups).toBeGreaterThanOrEqual(1);
    });
  });

  describe('clearHistory', () => {
    it('should clear rollback history', async () => {
      await manager.rollbackToVersion('1.0.0', '0.9.0', mockState, mockState);

      manager.clearHistory();

      expect(manager.getRollbackHistory()).toEqual([]);
    });
  });

  describe('clearBackups', () => {
    it('should clear all backups', async () => {
      await manager.createBackup('1.0.0', mockState);

      manager.clearBackups();

      expect(manager.getAllBackups()).toEqual([]);
    });
  });

  describe('verifyBackup', () => {
    it('should verify backup integrity', async () => {
      const backup = await manager.createBackup('1.0.0', mockState);

      const isValid = manager.verifyBackup(backup.id);

      expect(isValid).toBe(true);
    });

    it('should return false for invalid backup', async () => {
      const backup = await manager.createBackup('1.0.0', mockState);

      // Corrupt the backup
      backup.state.styles.theme = 'corrupted';

      const isValid = manager.verifyBackup(backup.id);

      expect(isValid).toBe(false);
    });
  });

  describe('verifyAllBackups', () => {
    it('should verify all backups', async () => {
      await manager.createBackup('1.0.0', mockState);
      await manager.createBackup('1.0.1', mockState);

      const result = manager.verifyAllBackups();

      expect(result.valid.length).toBeGreaterThanOrEqual(2);
      expect(result.invalid).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle multiple rollbacks', async () => {
      for (let i = 0; i < 5; i++) {
        await manager.rollbackToVersion(`1.0.${i}`, `1.0.${i - 1}`, mockState, mockState);
      }

      const history = manager.getRollbackHistory();
      expect(history.length).toBe(5);
    });

    it('should handle backup limits', async () => {
      const smallManager = new RollbackManager({
        snapshot: { maxSnapshots: 3 }
      });

      for (let i = 0; i < 10; i++) {
        await smallManager.createBackup(`1.0.${i}`, mockState);
      }

      const backups = smallManager.getAllBackups();
      expect(backups.length).toBeLessThanOrEqual(3);
    });
  });
});

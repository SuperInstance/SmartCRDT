/**
 * @lsi/webgpu-multi - Sync Manager Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SyncManager } from '../src/SyncManager';
import type { GPUDevice, SyncPoint } from '../src/types';

function createMockDevice(id: string): GPUDevice {
  return {
    device_id: id,
    adapter: {} as any,
    device: {
      createFence: vi.fn(() => ({ getCompletedValue: vi.fn(() => 1) })),
      queue: {
        onSubmittedWorkDone: vi.fn(() => Promise.resolve()),
      },
    } as any,
    queue: {} as any,
    features: [],
    limits: {} as any,
    type: 'discrete',
    vendor: 'test',
    architecture: 'test',
    memorySize: 4294967296,
    busy: false,
    utilization: 0,
  };
}

describe('SyncManager', () => {
  let syncManager: SyncManager;
  let devices: GPUDevice[];

  beforeEach(() => {
    syncManager = new SyncManager();
    devices = [createMockDevice('device-0'), createMockDevice('device-1')];
  });

  describe('createSyncPoint', () => {
    it('should create a sync point', () => {
      const sync = syncManager.createSyncPoint(devices, ['task-0', 'task-1'], 'barrier');

      expect(sync.syncId).toMatch(/^sync-\d+$/);
      expect(sync.devices).toBe(devices);
      expect(sync.taskIds).toEqual(['task-0', 'task-1']);
      expect(sync.strategy).toBe('barrier');
      expect(sync.complete).toBe(false);
    });

    it('should increment sync ID counter', () => {
      const sync1 = syncManager.createSyncPoint(devices, [], 'barrier');
      const sync2 = syncManager.createSyncPoint(devices, [], 'barrier');

      expect(sync2.syncId).not.toBe(sync1.syncId);
    });
  });

  describe('waitForSync', () => {
    it('should resolve when sync completes', async () => {
      const sync = syncManager.createSyncPoint(devices, [], 'barrier');

      // Complete the sync
      setTimeout(() => syncManager.completeSync(sync.syncId), 10);

      const result = await syncManager.waitForSync(sync.syncId);
      expect(result).toBe(true);
    });

    it('should timeout when sync does not complete', async () => {
      const sync = syncManager.createSyncPoint(devices, [], 'barrier');

      const result = await syncManager.waitForSync(sync.syncId, 50);
      expect(result).toBe(false);
    });

    it('should throw error for unknown sync ID', async () => {
      await expect(syncManager.waitForSync('unknown')).rejects.toThrow();
    });
  });

  describe('completeSync', () => {
    it('should mark sync as complete', () => {
      const sync = syncManager.createSyncPoint(devices, [], 'barrier');

      syncManager.completeSync(sync.syncId);

      expect(sync.complete).toBe(true);
      expect(sync.completedAt).toBeGreaterThan(0);
    });
  });

  describe('barrier', () => {
    it('should create barrier synchronization', async () => {
      const tasks = ['task-0', 'task-1'];

      const sync = await syncManager.barrier(devices, tasks);

      expect(sync.strategy).toBe('barrier');
      expect(sync.complete).toBe(true);
    });
  });

  describe('eventSync', () => {
    it('should create event-based synchronization', async () => {
      const sync = await syncManager.eventSync(devices, ['task-0'], devices[0]);

      expect(sync.strategy).toBe('event');
      expect(sync.complete).toBe(true);
    });
  });

  describe('fenceSync', () => {
    it('should create fence-based synchronization', async () => {
      const sync = await syncManager.fenceSync(devices, ['task-0']);

      expect(sync.strategy).toBe('fence');
      expect(sync.complete).toBe(true);
    });
  });

  describe('timelineSync', () => {
    it('should create timeline synchronization', async () => {
      const sync = await syncManager.timelineSync(devices, ['task-0'], [1, 2]);

      expect(sync.strategy).toBe('timeline');
      expect(sync.complete).toBe(true);
    });
  });

  describe('callbackSync', () => {
    it('should call callback when sync completes', (done) => {
      const callback = vi.fn((syncId: string) => {
        expect(callback).toHaveBeenCalled();
        done();
      });

      syncManager.callbackSync(devices, [], callback);
    });
  });

  describe('synchronizeAll', () => {
    it('should execute all operations', async () => {
      const operations = new Map<GPUDevice, Promise<void>>();
      operations.set(devices[0], Promise.resolve());
      operations.set(devices[1], Promise.resolve());

      await expect(syncManager.synchronizeAll(operations)).resolves.not.toThrow();
    });

    it('should handle errors in operations', async () => {
      const operations = new Map<GPUDevice, Promise<void>>();
      operations.set(devices[0], Promise.reject(new Error('Test error')));

      await expect(syncManager.synchronizeAll(operations)).rejects.toThrow();
    });
  });

  describe('getSyncPoint', () => {
    it('should return sync point by ID', () => {
      const sync = syncManager.createSyncPoint(devices, [], 'barrier');

      const retrieved = syncManager.getSyncPoint(sync.syncId);

      expect(retrieved).toBe(sync);
    });

    it('should return undefined for unknown ID', () => {
      const retrieved = syncManager.getSyncPoint('unknown');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('getActiveSyncs', () => {
    it('should return active sync points', () => {
      const sync1 = syncManager.createSyncPoint(devices, [], 'barrier');
      const sync2 = syncManager.createSyncPoint(devices, [], 'event');

      const active = syncManager.getActiveSyncs();

      expect(active.length).toBe(2);
      expect(active).toContain(sync1);
      expect(active).toContain(sync2);
    });

    it('should not include completed syncs', () => {
      const sync = syncManager.createSyncPoint(devices, [], 'barrier');
      syncManager.completeSync(sync.syncId);

      const active = syncManager.getActiveSyncs();

      expect(active).not.toContain(sync);
    });
  });

  describe('cancelSync', () => {
    it('should cancel an active sync', () => {
      const sync = syncManager.createSyncPoint(devices, [], 'barrier');

      syncManager.cancelSync(sync.syncId);

      expect(syncManager.getActiveSyncs()).not.toContain(sync);
      expect(syncManager.getSyncPoint(sync.syncId)).toBeUndefined();
    });

    it('should not cancel completed syncs', () => {
      const sync = syncManager.createSyncPoint(devices, [], 'barrier');
      syncManager.completeSync(sync.syncId);

      syncManager.cancelSync(sync.syncId);

      // Should still have the sync point (completed)
      expect(syncManager.getSyncPoint(sync.syncId)).toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('should remove old completed syncs', () => {
      const oldSync = syncManager.createSyncPoint(devices, [], 'barrier');
      oldSync.completedAt = Date.now() - 120000; // 2 minutes ago

      syncManager.cleanup();

      expect(syncManager.getSyncPoint(oldSync.syncId)).toBeUndefined();
    });

    it('should keep recent completed syncs', () => {
      const recentSync = syncManager.createSyncPoint(devices, [], 'barrier');
      recentSync.completedAt = Date.now() - 10000; // 10 seconds ago

      syncManager.cleanup();

      expect(syncManager.getSyncPoint(recentSync.syncId)).toBeDefined();
    });
  });

  describe('getStats', () => {
    it('should return statistics', () => {
      syncManager.createSyncPoint(devices, [], 'barrier');
      const completed = syncManager.createSyncPoint(devices, [], 'event');
      syncManager.completeSync(completed.syncId);

      const stats = syncManager.getStats();

      expect(stats.totalSyncs).toBe(2);
      expect(stats.activeSyncs).toBe(1);
      expect(stats.completedSyncs).toBe(1);
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      syncManager.createSyncPoint(devices, [], 'barrier');
      syncManager.reset();

      expect(syncManager.getActiveSyncs()).toHaveLength(0);
      expect(syncManager.getStats().totalSyncs).toBe(0);
    });
  });
});

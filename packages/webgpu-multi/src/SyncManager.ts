/**
 * @lsi/webgpu-multi - Sync Manager
 *
 * Manages synchronization across multiple GPU devices using various strategies.
 */

import type { GPUDevice, SyncPoint, SyncStrategy, WorkTask } from "./types.js";

/**
 * Sync Manager for multi-GPU synchronization
 */
export class SyncManager {
  private syncPoints: Map<string, SyncPoint> = new Map();
  private activeSyncs: Set<string> = new Set();
  private syncIdCounter: number = 0;

  /**
   * Create a synchronization point
   */
  createSyncPoint(
    devices: GPUDevice[],
    taskIds: string[],
    strategy: SyncStrategy = "barrier"
  ): SyncPoint {
    const syncId = `sync-${this.syncIdCounter++}`;

    const syncPoint: SyncPoint = {
      syncId,
      devices,
      taskIds,
      strategy,
      complete: false,
      createdAt: Date.now(),
    };

    this.syncPoints.set(syncId, syncPoint);
    this.activeSyncs.add(syncId);

    return syncPoint;
  }

  /**
   * Wait for a synchronization point to complete
   */
  async waitForSync(syncId: string, timeout?: number): Promise<boolean> {
    const syncPoint = this.syncPoints.get(syncId);
    if (!syncPoint) {
      throw new Error(`Sync point ${syncId} not found`);
    }

    const startTime = Date.now();
    const timeoutMs = timeout ?? 10000;

    return new Promise<boolean>(resolve => {
      const checkSync = () => {
        if (syncPoint.complete) {
          this.activeSyncs.delete(syncId);
          resolve(true);
          return;
        }

        if (Date.now() - startTime > timeoutMs) {
          this.activeSyncs.delete(syncId);
          resolve(false);
          return;
        }

        // Check again in 10ms
        setTimeout(checkSync, 10);
      };

      checkSync();
    });
  }

  /**
   * Mark a synchronization point as complete
   */
  completeSync(syncId: string): void {
    const syncPoint = this.syncPoints.get(syncId);
    if (syncPoint) {
      syncPoint.complete = true;
      syncPoint.completedAt = Date.now();
    }
  }

  /**
   * Create a barrier synchronization
   */
  async barrier(devices: GPUDevice[], taskIds: string[]): Promise<SyncPoint> {
    const syncPoint = this.createSyncPoint(devices, taskIds, "barrier");

    // Wait for all devices to complete their tasks
    const promises = devices.map(device => this.waitForDevice(device, taskIds));

    try {
      await Promise.all(promises);
      this.completeSync(syncPoint.syncId);
    } catch (error) {
      console.error("Barrier synchronization failed:", error);
    }

    return syncPoint;
  }

  /**
   * Create an event-based synchronization
   */
  async eventSync(
    devices: GPUDevice[],
    taskIds: string[],
    signalDevice: GPUDevice
  ): Promise<SyncPoint> {
    const syncPoint = this.createSyncPoint(devices, taskIds, "event");

    // Set up signal on specified device
    const signal = await this.createSignal(signalDevice);
    syncPoint.signal = signal;

    // Wait for signal
    await this.waitForSignal(signal);

    this.completeSync(syncPoint.syncId);
    return syncPoint;
  }

  /**
   * Create a fence-based synchronization
   */
  async fenceSync(devices: GPUDevice[], taskIds: string[]): Promise<SyncPoint> {
    const syncPoint = this.createSyncPoint(devices, taskIds, "fence");

    // Create fences for each device
    const fences = await Promise.all(
      devices.map(device => this.createFence(device))
    );

    // Wait for all fences
    await Promise.all(fences.map(fence => this.waitForFence(fence)));

    this.completeSync(syncPoint.syncId);
    return syncPoint;
  }

  /**
   * Create a timeline-based synchronization
   */
  async timelineSync(
    devices: GPUDevice[],
    taskIds: string[],
    timelineValues: number[]
  ): Promise<SyncPoint> {
    const syncPoint = this.createSyncPoint(devices, taskIds, "timeline");

    // Set up timeline semaphores
    const timelines = await Promise.all(
      devices.map((device, i) =>
        this.createTimeline(device, timelineValues[i] || 0)
      )
    );

    // Wait for all timelines to reach their values
    await Promise.all(
      timelines.map((timeline, i) =>
        this.waitForTimeline(timeline, timelineValues[i] || 0)
      )
    );

    this.completeSync(syncPoint.syncId);
    return syncPoint;
  }

  /**
   * Callback-based synchronization
   */
  callbackSync(
    devices: GPUDevice[],
    taskIds: string[],
    callback: (syncId: string) => void
  ): SyncPoint {
    const syncPoint = this.createSyncPoint(devices, taskIds, "callback");

    // Set up completion callback
    const checkCompletion = () => {
      const allComplete = taskIds.every(taskId => this.isTaskComplete(taskId));

      if (allComplete) {
        this.completeSync(syncPoint.syncId);
        callback(syncPoint.syncId);
      } else {
        setTimeout(checkCompletion, 10);
      }
    };

    checkCompletion();
    return syncPoint;
  }

  /**
   * Synchronize multiple operations across devices
   */
  async synchronizeAll(
    operations: Map<GPUDevice, Promise<void>>
  ): Promise<void> {
    // Execute all operations in parallel
    const promises = Array.from(operations.entries()).map(
      ([device, operation]) => {
        return operation.catch(error => {
          console.error(
            `Operation failed on device ${device.device_id}:`,
            error
          );
          throw error;
        });
      }
    );

    await Promise.all(promises);
  }

  /**
   * Wait for specific tasks to complete on a device
   */
  async waitForDevice(device: GPUDevice, taskIds: string[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const checkTasks = () => {
        const allComplete = taskIds.every(taskId =>
          this.isTaskComplete(taskId)
        );

        if (allComplete) {
          resolve();
        } else {
          setTimeout(checkTasks, 10);
        }
      };

      checkTasks();
    });
  }

  /**
   * Create a signal for event synchronization
   */
  private async createSignal(device: GPUDevice): Promise<GPUEvent> {
    // WebGPU doesn't have native events - simulate with fences
    return device.device.createFence(0) as unknown as GPUEvent;
  }

  /**
   * Wait for a signal
   */
  private async waitForSignal(signal: GPUEvent): Promise<void> {
    // Simulated signal wait
    return new Promise<void>(resolve => {
      setTimeout(resolve, 1);
    });
  }

  /**
   * Create a fence for synchronization
   */
  private async createFence(device: GPUDevice): Promise<GPUFence> {
    return device.device.createFence(0);
  }

  /**
   * Wait for a fence
   */
  private async waitForFence(
    fence: GPUFence,
    value: number = 1
  ): Promise<void> {
    // WebGPU fence wait
    return new Promise<void>((resolve, reject) => {
      const checkFence = () => {
        if (fence.getCompletedValue() >= value) {
          resolve();
        } else {
          device.device.queue
            .onSubmittedWorkDone()
            .then(() => resolve())
            .catch(() => setTimeout(checkFence, 1));
        }
      };
      checkFence();
    });
  }

  /**
   * Create a timeline semaphore
   */
  private async createTimeline(
    device: GPUDevice,
    value: number
  ): Promise<GPUFence> {
    // WebGPU uses fences for timeline-like behavior
    return device.device.createFence(value);
  }

  /**
   * Wait for timeline to reach value
   */
  private async waitForTimeline(
    timeline: GPUFence,
    value: number
  ): Promise<void> {
    return this.waitForFence(timeline, value);
  }

  /**
   * Check if a task is complete
   */
  private isTaskComplete(taskId: string): boolean {
    // This would be integrated with actual task tracking
    // For now, assume tasks complete quickly
    return true;
  }

  /**
   * Get a sync point by ID
   */
  getSyncPoint(syncId: string): SyncPoint | undefined {
    return this.syncPoints.get(syncId);
  }

  /**
   * Get all active sync points
   */
  getActiveSyncs(): SyncPoint[] {
    return Array.from(this.activeSyncs).map(id => this.syncPoints.get(id)!);
  }

  /**
   * Cancel a sync point
   */
  cancelSync(syncId: string): void {
    const syncPoint = this.syncPoints.get(syncId);
    if (syncPoint && !syncPoint.complete) {
      this.activeSyncs.delete(syncId);
      this.syncPoints.delete(syncId);
    }
  }

  /**
   * Clean up completed sync points
   */
  cleanup(): void {
    const now = Date.now();
    for (const [syncId, syncPoint] of this.syncPoints) {
      // Remove completed syncs older than 1 minute
      if (syncPoint.complete && now - (syncPoint.completedAt || now) > 60000) {
        this.syncPoints.delete(syncId);
        this.activeSyncs.delete(syncId);
      }
    }
  }

  /**
   * Get synchronization statistics
   */
  getStats(): {
    totalSyncs: number;
    activeSyncs: number;
    completedSyncs: number;
    avgSyncTime: number;
  } {
    const syncs = Array.from(this.syncPoints.values());
    const completed = syncs.filter(s => s.complete);

    const avgSyncTime =
      completed.length > 0
        ? completed.reduce(
            (sum, s) => sum + ((s.completedAt || 0) - s.createdAt),
            0
          ) / completed.length
        : 0;

    return {
      totalSyncs: syncs.length,
      activeSyncs: this.activeSyncs.size,
      completedSyncs: completed.length,
      avgSyncTime,
    };
  }

  /**
   * Reset the sync manager
   */
  reset(): void {
    this.syncPoints.clear();
    this.activeSyncs.clear();
    this.syncIdCounter = 0;
  }
}

/**
 * Default sync manager instance
 */
export const defaultSyncManager = new SyncManager();

/**
 * @lsi/vljepa-video/sync/TimestampSync
 *
 * Timestamp synchronization for multi-stream video processing.
 *
 * @version 1.0.0
 */

import type { TimestampSyncConfig } from "../types.js";

/**
 * Timestamp sync
 *
 * Synchronizes timestamps across multiple video streams.
 */
export class TimestampSync {
  private config: TimestampSyncConfig;
  private clockOffset: number = 0;
  private lastSyncTime: number = 0;
  private syncCount: number = 0;

  constructor(config: TimestampSyncConfig) {
    this.config = config;
  }

  /**
   * Synchronize timestamp
   */
  sync(timestamp: number): number {
    const now = performance.now();

    // Check if we need to sync
    if (this.config.enableDriftCorrection && this.shouldSync(now)) {
      this.performSync(now);
    }

    // Apply clock offset
    return timestamp + this.clockOffset;
  }

  /**
   * Check if should sync
   */
  private shouldSync(now: number): boolean {
    const timeSinceLastSync = now - this.lastSyncTime;
    return timeSinceLastSync >= this.config.syncInterval;
  }

  /**
   * Perform synchronization
   */
  private performSync(now: number): void {
    // Get current time based on clock source
    const referenceTime = this.getReferenceTime();

    // Calculate drift
    const drift = now - referenceTime;

    // Apply drift correction if within threshold
    if (Math.abs(drift) <= this.config.maxDrift) {
      this.clockOffset = -drift;
    }

    this.lastSyncTime = now;
    this.syncCount++;
  }

  /**
   * Get reference time based on clock source
   */
  private getReferenceTime(): number {
    switch (this.config.clockSource) {
      case "system":
        return Date.now();

      case "monotonic":
        return performance.now();

      case "ptp":
        // Precision Time Protocol (placeholder)
        return Date.now();

      default:
        return Date.now();
    }
  }

  /**
   * Get sync statistics
   */
  getStats(): {
    clockOffset: number;
    lastSyncTime: number;
    syncCount: number;
  } {
    return {
      clockOffset: this.clockOffset,
      lastSyncTime: this.lastSyncTime,
      syncCount: this.syncCount,
    };
  }

  /**
   * Reset sync state
   */
  reset(): void {
    this.clockOffset = 0;
    this.lastSyncTime = 0;
    this.syncCount = 0;
  }
}

/**
 * Frame alignment
 *
 * Aligns frames from multiple streams based on timestamps.
 */
export class FrameAlignment {
  private maxSkew: number;
  private interpolate: boolean;

  constructor(maxSkew: number = 33.33, interpolate: boolean = false) {
    this.maxSkew = maxSkew;
    this.interpolate = interpolate;
  }

  /**
   * Align frames from multiple streams
   */
  align(frames: Array<{ frameId: number; timestamp: number }>): Array<{
    frameId: number;
    timestamp: number;
    skew: number;
  }> {
    if (frames.length === 0) {
      return [];
    }

    // Calculate reference timestamp (average)
    const avgTimestamp =
      frames.reduce((sum, f) => sum + f.timestamp, 0) / frames.length;

    // Calculate skew for each frame
    const aligned = frames.map(f => ({
      frameId: f.frameId,
      timestamp: f.timestamp,
      skew: f.timestamp - avgTimestamp,
    }));

    // Filter out frames with too much skew
    const valid = aligned.filter(f => Math.abs(f.skew) <= this.maxSkew);

    return valid;
  }

  /**
   * Interpolate missing frames
   */
  interpolateFrames(
    frames: Array<{ frameId: number; timestamp: number }>,
    targetTimestamp: number
  ): Array<{ frameId: number; timestamp: number; interpolated: boolean }> {
    // Find frames before and after target
    const before = frames
      .filter(f => f.timestamp <= targetTimestamp)
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    const after = frames
      .filter(f => f.timestamp >= targetTimestamp)
      .sort((a, b) => a.timestamp - b.timestamp)[0];

    if (before && after) {
      // Interpolate between frames
      return [
        {
          frameId: before.frameId,
          timestamp: before.timestamp,
          interpolated: false,
        },
        {
          frameId: this.interpolateFrameId(
            before.frameId,
            after.frameId,
            targetTimestamp
          ),
          timestamp: targetTimestamp,
          interpolated: true,
        },
        {
          frameId: after.frameId,
          timestamp: after.timestamp,
          interpolated: false,
        },
      ];
    }

    return frames.map(f => ({ ...f, interpolated: false }));
  }

  /**
   * Interpolate frame ID
   */
  private interpolateFrameId(
    beforeId: number,
    afterId: number,
    targetTimestamp: number
  ): number {
    // Simple ID interpolation
    return Math.floor((beforeId + afterId) / 2);
  }

  /**
   * Get alignment statistics
   */
  getStats(alignedFrames: Array<{ skew: number }>): {
    avgSkew: number;
    maxSkew: number;
    minSkew: number;
    stdDevSkew: number;
  } {
    if (alignedFrames.length === 0) {
      return {
        avgSkew: 0,
        maxSkew: 0,
        minSkew: 0,
        stdDevSkew: 0,
      };
    }

    const skews = alignedFrames.map(f => f.skew);
    const avgSkew = skews.reduce((a, b) => a + b, 0) / skews.length;
    const maxSkew = Math.max(...skews);
    const minSkew = Math.min(...skews);

    const variance =
      skews.reduce((sum, s) => sum + (s - avgSkew) ** 2, 0) / skews.length;
    const stdDevSkew = Math.sqrt(variance);

    return {
      avgSkew,
      maxSkew,
      minSkew,
      stdDevSkew,
    };
  }
}

/**
 * Multi-stream sync
 *
 * Synchronizes multiple video streams.
 */
export class MultiStreamSync {
  private streams: Map<string, number[]> = new Map();
  private syncWindow: number = 100; // ms

  /**
   * Add stream
   */
  addStream(streamId: string): void {
    this.streams.set(streamId, []);
  }

  /**
   * Remove stream
   */
  removeStream(streamId: string): void {
    this.streams.delete(streamId);
  }

  /**
   * Add frame timestamp to stream
   */
  addTimestamp(streamId: string, timestamp: number): void {
    const timestamps = this.streams.get(streamId);
    if (timestamps) {
      timestamps.push(timestamp);

      // Keep only recent timestamps
      const cutoff = timestamp - this.syncWindow;
      const recent = timestamps.filter(t => t >= cutoff);
      this.streams.set(streamId, recent);
    }
  }

  /**
   * Get synchronized timestamps
   */
  getSyncedTimestamps(): Array<{ streamId: string; timestamp: number }> {
    const synced: Array<{ streamId: string; timestamp: number }> = [];

    for (const [streamId, timestamps] of this.streams.entries()) {
      if (timestamps.length > 0) {
        // Use most recent timestamp
        const latest = timestamps[timestamps.length - 1];
        synced.push({ streamId, timestamp: latest });
      }
    }

    return synced;
  }

  /**
   * Check if streams are synchronized
   */
  isSynced(): boolean {
    const synced = this.getSyncedTimestamps();

    if (synced.length < 2) {
      return true;
    }

    const timestamps = synced.map(s => s.timestamp);
    const min = Math.min(...timestamps);
    const max = Math.max(...timestamps);

    return max - min < this.syncWindow;
  }

  /**
   * Get sync statistics
   */
  getStats(): {
    streamCount: number;
    isSynced: boolean;
    maxSkew: number;
    avgSkew: number;
  } {
    const synced = this.getSyncedTimestamps();

    if (synced.length < 2) {
      return {
        streamCount: this.streams.size,
        isSynced: true,
        maxSkew: 0,
        avgSkew: 0,
      };
    }

    const timestamps = synced.map(s => s.timestamp);
    const min = Math.min(...timestamps);
    const max = Math.max(...timestamps);
    const avg = timestamps.reduce((a, b) => a + b, 0) / timestamps.length;

    const skews = timestamps.map(t => t - avg);

    return {
      streamCount: this.streams.size,
      isSynced: this.isSynced(),
      maxSkew: max - min,
      avgSkew: skews.reduce((sum, s) => sum + Math.abs(s), 0) / skews.length,
    };
  }

  /**
   * Clear all streams
   */
  clear(): void {
    this.streams.clear();
  }

  /**
   * Set sync window
   */
  setSyncWindow(window: number): void {
    this.syncWindow = window;
  }
}

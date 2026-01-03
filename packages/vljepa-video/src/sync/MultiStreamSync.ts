/**
 * @lsi/vljepa-video/sync/MultiStreamSync
 *
 * Multi-stream synchronization for multiple video sources.
 *
 * @version 1.0.0
 */

import type { VideoFrame } from "../types.js";

/**
 * Stream entry
 */
interface StreamEntry {
  /** Stream ID */
  streamId: string;

  /** Frame buffer */
  frames: VideoFrame[];

  /** Current timestamp */
  currentTimestamp: number;
}

/**
 * Multi-stream sync configuration
 */
export interface MultiStreamSyncConfig {
  /** Synchronization window (ms) */
  syncWindow: number;

  /** Maximum allowed skew (ms) */
  maxSkew: number;

  /** Whether to enable drift correction */
  enableDriftCorrection: boolean;

  /** Sync method */
  syncMethod: "timestamp" | "sequence" | "adaptive";
}

/**
 * Multi-stream sync
 *
 * Synchronizes multiple video streams.
 */
export class MultiStreamSync {
  private config: MultiStreamSyncConfig;
  private streams: Map<string, StreamEntry> = new Map();
  private clockOffsets: Map<string, number> = new Map();

  constructor(config: MultiStreamSyncConfig) {
    this.config = {
      syncWindow: config.syncWindow || 100,
      maxSkew: config.maxSkew || 33.33,
      enableDriftCorrection: config.enableDriftCorrection !== false,
      syncMethod: config.syncMethod || "timestamp",
    };
  }

  /**
   * Add stream
   */
  addStream(streamId: string): void {
    this.streams.set(streamId, {
      streamId,
      frames: [],
      currentTimestamp: 0,
    });

    this.clockOffsets.set(streamId, 0);
  }

  /**
   * Remove stream
   */
  removeStream(streamId: string): void {
    this.streams.delete(streamId);
    this.clockOffsets.delete(streamId);
  }

  /**
   * Add frame to stream
   */
  addFrame(streamId: string, frame: VideoFrame): void {
    const stream = this.streams.get(streamId);

    if (!stream) {
      return;
    }

    // Apply clock offset
    const adjustedTimestamp =
      frame.timestamp + (this.clockOffsets.get(streamId) || 0);

    const adjustedFrame = {
      ...frame,
      timestamp: adjustedTimestamp,
    };

    stream.frames.push(adjustedFrame);

    // Keep only recent frames (within sync window)
    const cutoff = adjustedTimestamp - this.config.syncWindow;
    stream.frames = stream.frames.filter(f => f.timestamp >= cutoff);

    stream.currentTimestamp = adjustedTimestamp;
  }

  /**
   * Get synchronized frames
   */
  getSyncedFrames(): Array<{
    streamId: string;
    frame: VideoFrame;
    skew: number;
  }> {
    const synced: Array<{ streamId: string; frame: VideoFrame; skew: number }> =
      [];

    if (this.streams.size === 0) {
      return synced;
    }

    // Calculate reference timestamp (average)
    const timestamps = Array.from(this.streams.values()).map(
      s => s.currentTimestamp
    );
    const referenceTimestamp =
      timestamps.reduce((a, b) => a + b, 0) / timestamps.length;

    // Get frames for each stream
    for (const [streamId, stream] of this.streams.entries()) {
      if (stream.frames.length === 0) {
        continue;
      }

      // Find closest frame
      const closest = this.findClosestFrame(stream.frames, referenceTimestamp);

      if (closest) {
        const skew = closest.timestamp - referenceTimestamp;

        if (Math.abs(skew) <= this.config.maxSkew) {
          synced.push({
            streamId,
            frame: closest,
            skew,
          });
        }
      }
    }

    return synced;
  }

  /**
   * Find closest frame to timestamp
   */
  private findClosestFrame(
    frames: VideoFrame[],
    timestamp: number
  ): VideoFrame | null {
    if (frames.length === 0) {
      return null;
    }

    let closest = frames[0];
    let minDiff = Math.abs(frames[0].timestamp - timestamp);

    for (const frame of frames) {
      const diff = Math.abs(frame.timestamp - timestamp);

      if (diff < minDiff) {
        minDiff = diff;
        closest = frame;
      }
    }

    return closest;
  }

  /**
   * Perform drift correction
   */
  correctDrift(): void {
    if (!this.config.enableDriftCorrection) {
      return;
    }

    const synced = this.getSyncedFrames();

    if (synced.length < 2) {
      return;
    }

    // Calculate average skew
    const avgSkew = synced.reduce((sum, s) => sum + s.skew, 0) / synced.length;

    // Adjust clock offsets
    for (const [streamId, entry] of this.streams.entries()) {
      const syncedEntry = synced.find(s => s.streamId === streamId);

      if (syncedEntry) {
        const correction = syncedEntry.skew - avgSkew;
        const currentOffset = this.clockOffsets.get(streamId) || 0;
        this.clockOffsets.set(streamId, currentOffset - correction * 0.1);
      }
    }
  }

  /**
   * Check if streams are synchronized
   */
  isSynced(): boolean {
    const synced = this.getSyncedFrames();

    if (synced.length < 2) {
      return true;
    }

    const maxSkew = Math.max(...synced.map(s => Math.abs(s.skew)));

    return maxSkew <= this.config.maxSkew;
  }

  /**
   * Get sync statistics
   */
  getStats(): {
    streamCount: number;
    isSynced: number;
    avgSkew: number;
    maxSkew: number;
    clockOffsets: Map<string, number>;
  } {
    const synced = this.getSyncedFrames();

    const avgSkew =
      synced.length > 0
        ? synced.reduce((sum, s) => sum + Math.abs(s.skew), 0) / synced.length
        : 0;

    const maxSkew =
      synced.length > 0 ? Math.max(...synced.map(s => Math.abs(s.skew))) : 0;

    return {
      streamCount: this.streams.size,
      isSynced: this.isSynced() ? 1 : 0,
      avgSkew,
      maxSkew,
      clockOffsets: new Map(this.clockOffsets),
    };
  }

  /**
   * Clear all streams
   */
  clear(): void {
    this.streams.clear();
    this.clockOffsets.clear();
  }

  /**
   * Reset stream buffers
   */
  resetBuffers(): void {
    for (const stream of this.streams.values()) {
      stream.frames = [];
      stream.currentTimestamp = 0;
    }
  }

  /**
   * Get stream IDs
   */
  getStreamIds(): string[] {
    return Array.from(this.streams.keys());
  }

  /**
   * Get frame count for stream
   */
  getFrameCount(streamId: string): number {
    const stream = this.streams.get(streamId);
    return stream ? stream.frames.length : 0;
  }
}

/**
 * @lsi/vljepa-video/sync/FrameAlignment
 *
 * Frame alignment for synchronizing frames from multiple streams.
 *
 * @version 1.0.0
 */

import type { VideoFrame } from "../types.js";

/**
 * Frame alignment options
 */
export interface FrameAlignmentOptions {
  /** Maximum allowed skew (ms) */
  maxSkew: number;

  /** Whether to interpolate missing frames */
  interpolate: boolean;

  /** Alignment method */
  method: "timestamp" | "sequence" | "marker";

  /** Interpolation method */
  interpolationMethod: "linear" | "nearest";
}

/**
 * Aligned frame group
 */
export interface AlignedFrameGroup {
  /** Frame ID */
  id: number;

  /** Frames from each stream */
  frames: Map<string, VideoFrame>;

  /** Alignment timestamp */
  timestamp: number;

  /** Skew information */
  skews: Map<string, number>;

  /** Whether any frames are interpolated */
  hasInterpolated: boolean;
}

/**
 * Frame alignment
 *
 * Aligns frames from multiple video streams.
 */
export class FrameAlignment {
  private options: FrameAlignmentOptions;

  constructor(options: FrameAlignmentOptions) {
    this.options = {
      maxSkew: options.maxSkew || 33.33,
      interpolate: options.interpolate !== false,
      method: options.method || "timestamp",
      interpolationMethod: options.interpolationMethod || "linear",
    };
  }

  /**
   * Align frames from multiple streams
   */
  align(frames: Map<string, VideoFrame[]>): AlignedFrameGroup[] {
    switch (this.options.method) {
      case "timestamp":
        return this.alignByTimestamp(frames);
      case "sequence":
        return this.alignBySequence(frames);
      case "marker":
        return this.alignByMarker(frames);
      default:
        return this.alignByTimestamp(frames);
    }
  }

  /**
   * Align by timestamp
   */
  private alignByTimestamp(
    frames: Map<string, VideoFrame[]>
  ): AlignedFrameGroup[] {
    const groups: AlignedFrameGroup[] = [];

    // Collect all unique timestamps
    const allTimestamps = new Set<number>();

    for (const streamFrames of frames.values()) {
      for (const frame of streamFrames) {
        allTimestamps.add(frame.timestamp);
      }
    }

    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

    // Create aligned groups
    for (const timestamp of sortedTimestamps) {
      const groupFrames = new Map<string, VideoFrame>();
      const skews = new Map<string, number>();
      let hasInterpolated = false;

      for (const [streamId, streamFrames] of frames.entries()) {
        // Find closest frame
        const closest = this.findClosestFrame(streamFrames, timestamp);

        if (closest) {
          const skew = closest.frame.timestamp - timestamp;

          if (Math.abs(skew) <= this.options.maxSkew) {
            groupFrames.set(streamId, closest.frame);
            skews.set(streamId, skew);

            if (closest.interpolated) {
              hasInterpolated = true;
            }
          } else if (this.options.interpolate) {
            // Interpolate frame
            const interpolated = this.interpolateFrame(streamFrames, timestamp);

            if (interpolated) {
              groupFrames.set(streamId, interpolated);
              skews.set(streamId, 0);
              hasInterpolated = true;
            }
          }
        }
      }

      if (groupFrames.size > 0) {
        groups.push({
          id: groups.length,
          frames: groupFrames,
          timestamp,
          skews,
          hasInterpolated,
        });
      }
    }

    return groups;
  }

  /**
   * Align by sequence number
   */
  private alignBySequence(
    frames: Map<string, VideoFrame[]>
  ): AlignedFrameGroup[] {
    const groups: AlignedFrameGroup[] = [];

    // Find maximum length
    const maxLength = Math.max(
      ...Array.from(frames.values()).map(f => f.length)
    );

    // Create aligned groups by index
    for (let i = 0; i < maxLength; i++) {
      const groupFrames = new Map<string, VideoFrame>();
      const skews = new Map<string, number>();
      let hasInterpolated = false;

      for (const [streamId, streamFrames] of frames.entries()) {
        if (i < streamFrames.length) {
          groupFrames.set(streamId, streamFrames[i]);
          skews.set(streamId, 0);
        } else if (this.options.interpolate && i > 0) {
          // Interpolate previous frame
          groupFrames.set(streamId, streamFrames[streamFrames.length - 1]);
          skews.set(streamId, 0);
          hasInterpolated = true;
        }
      }

      if (groupFrames.size > 0) {
        const avgTimestamp =
          Array.from(groupFrames.values())
            .map(f => f.timestamp)
            .reduce((a, b) => a + b, 0) / groupFrames.size;

        groups.push({
          id: groups.length,
          frames: groupFrames,
          timestamp: avgTimestamp,
          skews,
          hasInterpolated,
        });
      }
    }

    return groups;
  }

  /**
   * Align by marker
   */
  private alignByMarker(
    frames: Map<string, VideoFrame[]>
  ): AlignedFrameGroup[] {
    // Find markers in frames (keyframes with specific metadata)
    const markers = new Map<string, number[]>();

    for (const [streamId, streamFrames] of frames.entries()) {
      const streamMarkers: number[] = [];

      for (let i = 0; i < streamFrames.length; i++) {
        const frame = streamFrames[i];
        // Check for marker metadata
        if (frame.metadata && frame.metadata.extras) {
          const extras = frame.metadata.extras as Record<string, unknown>;
          if (extras.marker === true) {
            streamMarkers.push(i);
          }
        }
      }

      markers.set(streamId, streamMarkers);
    }

    // Align on markers
    const groups: AlignedFrameGroup[] = [];

    // Find common markers
    const allMarkers = Array.from(markers.values());
    if (allMarkers.length === 0) {
      return groups;
    }

    const minMarkers = Math.min(...allMarkers.map(m => m.length));

    for (let i = 0; i < minMarkers; i++) {
      const groupFrames = new Map<string, VideoFrame>();
      const skews = new Map<string, number>();

      for (const [streamId, streamFrames] of frames.entries()) {
        const streamMarkers = markers.get(streamId)!;

        if (i < streamMarkers.length) {
          const markerIndex = streamMarkers[i];
          groupFrames.set(streamId, streamFrames[markerIndex]);
          skews.set(streamId, 0);
        }
      }

      if (groupFrames.size > 0) {
        const avgTimestamp =
          Array.from(groupFrames.values())
            .map(f => f.timestamp)
            .reduce((a, b) => a + b, 0) / groupFrames.size;

        groups.push({
          id: groups.length,
          frames: groupFrames,
          timestamp: avgTimestamp,
          skews,
          hasInterpolated: false,
        });
      }
    }

    return groups;
  }

  /**
   * Find closest frame to timestamp
   */
  private findClosestFrame(
    frames: VideoFrame[],
    timestamp: number
  ): { frame: VideoFrame; interpolated: boolean } | null {
    if (frames.length === 0) {
      return null;
    }

    // Binary search for closest
    let left = 0;
    let right = frames.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);

      if (frames[mid].timestamp < timestamp) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    // Check neighbors
    const candidates: number[] = [];
    if (left > 0) candidates.push(left - 1);
    if (left < frames.length) candidates.push(left);
    if (left + 1 < frames.length) candidates.push(left + 1);

    let closest = candidates[0];
    let minDiff = Math.abs(frames[candidates[0]].timestamp - timestamp);

    for (const idx of candidates) {
      const diff = Math.abs(frames[idx].timestamp - timestamp);
      if (diff < minDiff) {
        minDiff = diff;
        closest = idx;
      }
    }

    return {
      frame: frames[closest],
      interpolated: false,
    };
  }

  /**
   * Interpolate frame at timestamp
   */
  private interpolateFrame(
    frames: VideoFrame[],
    timestamp: number
  ): VideoFrame | null {
    // Find frames before and after
    const before = frames.filter(f => f.timestamp <= timestamp);
    const after = frames.filter(f => f.timestamp >= timestamp);

    if (before.length === 0 || after.length === 0) {
      return null;
    }

    const beforeFrame = before[before.length - 1];
    const afterFrame = after[0];

    if (beforeFrame === afterFrame) {
      return beforeFrame;
    }

    // Linear interpolation
    const t =
      (timestamp - beforeFrame.timestamp) /
      (afterFrame.timestamp - beforeFrame.timestamp);

    // Interpolate frame data
    const interpolatedData = new Uint8ClampedArray(beforeFrame.data.length);

    for (let i = 0; i < beforeFrame.data.length; i++) {
      interpolatedData[i] =
        beforeFrame.data[i] + (afterFrame.data[i] - beforeFrame.data[i]) * t;
    }

    return {
      ...beforeFrame,
      data: interpolatedData,
      timestamp,
    };
  }

  /**
   * Get alignment statistics
   */
  getStats(groups: AlignedFrameGroup[]): {
    groupCount: number;
    avgSkew: number;
    maxSkew: number;
    minSkew: number;
    interpolatedGroupCount: number;
  } {
    if (groups.length === 0) {
      return {
        groupCount: 0,
        avgSkew: 0,
        maxSkew: 0,
        minSkew: 0,
        interpolatedGroupCount: 0,
      };
    }

    const allSkews: number[] = [];

    for (const group of groups) {
      for (const skew of group.skews.values()) {
        allSkews.push(skew);
      }
    }

    const avgSkew = allSkews.reduce((a, b) => a + b, 0) / allSkews.length;
    const maxSkew = Math.max(...allSkews);
    const minSkew = Math.min(...allSkews);
    const interpolatedGroupCount = groups.filter(g => g.hasInterpolated).length;

    return {
      groupCount: groups.length,
      avgSkew,
      maxSkew,
      minSkew,
      interpolatedGroupCount,
    };
  }
}

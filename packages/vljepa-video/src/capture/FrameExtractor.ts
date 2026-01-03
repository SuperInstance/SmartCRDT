/**
 * @lsi/vljepa-video/capture/FrameExtractor
 *
 * Frame extraction utility for extracting individual frames from video streams.
 *
 * @version 1.0.0
 */

import type { VideoFrame } from "../types.js";

/**
 * Frame extraction options
 */
export interface FrameExtractorOptions {
  /** Extract at specific FPS (0 = all frames) */
  targetFPS: number;

  /** Whether to deinterlace */
  deinterlace: boolean;

  /** Whether to extract keyframes only */
  keyframesOnly: boolean;

  /** Starting time offset (ms) */
  startTimeOffset: number;

  /** Maximum duration (ms, 0 = unlimited) */
  maxDuration: number;
}

/**
 * Frame extractor
 *
 * Extracts frames from video sources at specified intervals.
 */
export class FrameExtractor {
  private options: FrameExtractorOptions;
  private lastExtractTime: number = 0;
  private frameInterval: number;
  private extractedCount: number = 0;

  constructor(
    options: FrameExtractorOptions = {
      targetFPS: 30,
      deinterlace: false,
      keyframesOnly: false,
      startTimeOffset: 0,
      maxDuration: 0,
    }
  ) {
    this.options = options;
    this.frameInterval = options.targetFPS > 0 ? 1000 / options.targetFPS : 0;
  }

  /**
   * Extract frame if it's time
   */
  shouldExtractFrame(timestamp: number): boolean {
    // Check start time offset
    if (timestamp < this.options.startTimeOffset) {
      return false;
    }

    // Check max duration
    if (
      this.options.maxDuration > 0 &&
      timestamp > this.options.startTimeOffset + this.options.maxDuration
    ) {
      return false;
    }

    // Check frame interval
    if (this.frameInterval > 0) {
      const timeSinceLastExtract = timestamp - this.lastExtractTime;
      if (timeSinceLastExtract < this.frameInterval) {
        return false;
      }
    }

    this.lastExtractTime = timestamp;
    return true;
  }

  /**
   * Extract and process frame
   */
  extractFrame(frame: VideoFrame): VideoFrame | null {
    if (!this.shouldExtractFrame(frame.timestamp)) {
      return null;
    }

    let extractedFrame = frame;

    // Deinterlace if enabled
    if (this.options.deinterlace) {
      extractedFrame = this.deinterlace(extractedFrame);
    }

    this.extractedCount++;
    return extractedFrame;
  }

  /**
   * Deinterlace frame
   */
  private deinterlace(frame: VideoFrame): VideoFrame {
    // Simple bob deinterlacing (alternating lines)
    const deinterlaced = new Uint8ClampedArray(frame.data.length);

    for (let y = 0; y < frame.height; y++) {
      for (let x = 0; x < frame.width; x++) {
        const srcIdx = (y * frame.width + x) * 4;
        let dstIdx = srcIdx;

        // Interpolate missing lines
        if (y % 2 === 1 && y < frame.height - 1) {
          const aboveIdx = ((y - 1) * frame.width + x) * 4;
          const belowIdx = ((y + 1) * frame.width + x) * 4;

          deinterlaced[dstIdx] =
            (frame.data[aboveIdx] + frame.data[belowIdx]) / 2;
          deinterlaced[dstIdx + 1] =
            (frame.data[aboveIdx + 1] + frame.data[belowIdx + 1]) / 2;
          deinterlaced[dstIdx + 2] =
            (frame.data[aboveIdx + 2] + frame.data[belowIdx + 2]) / 2;
          deinterlaced[dstIdx + 3] =
            (frame.data[aboveIdx + 3] + frame.data[belowIdx + 3]) / 2;
        } else {
          deinterlaced[dstIdx] = frame.data[srcIdx];
          deinterlaced[dstIdx + 1] = frame.data[srcIdx + 1];
          deinterlaced[dstIdx + 2] = frame.data[srcIdx + 2];
          deinterlaced[dstIdx + 3] = frame.data[srcIdx + 3];
        }
      }
    }

    return {
      ...frame,
      data: deinterlaced,
    };
  }

  /**
   * Get extraction statistics
   */
  getStats(): {
    extractedCount: number;
    targetFPS: number;
    frameInterval: number;
  } {
    return {
      extractedCount: this.extractedCount,
      targetFPS: this.options.targetFPS,
      frameInterval: this.frameInterval,
    };
  }

  /**
   * Reset extractor state
   */
  reset(): void {
    this.lastExtractTime = 0;
    this.extractedCount = 0;
  }
}

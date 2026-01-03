/**
 * @lsi/vljepa-video/tracking/MotionTracker
 *
 * Motion tracker for tracking motion patterns across video frames.
 *
 * @version 1.0.0
 */

import type { MotionResult, MotionPattern, DetectedObject } from "../types.js";

/**
 * Motion tracking result
 */
export interface MotionTrackingResult {
  /** Frame identifier */
  frameId: number;

  /** Global motion vector */
  globalMotion: {
    vx: number;
    vy: number;
  };

  /** Motion magnitude */
  motionMagnitude: number;

  /** Motion patterns detected */
  patterns: MotionPattern[];

  /** Tracked objects with motion */
  tracks: DetectedObject[];
}

/**
 * Motion vector
 */
export interface MotionVector {
  /** X component */
  vx: number;

  /** Y component */
  vy: number;

  /** Magnitude */
  magnitude: number;

  /** Angle (radians) */
  angle: number;
}

/**
 * Optical flow result
 */
export interface OpticalFlowResult {
  /** Flow vectors for each pixel/region */
  vectors: MotionVector[][];

  /** Average flow */
  average: MotionVector;

  /** Flow magnitude heatmap */
  magnitudeHeatmap: number[][];
}

/**
 * Motion tracker
 *
 * Tracks motion patterns using optical flow and embedding differences.
 */
export class MotionTracker {
  private prevEmbedding: Float32Array | null = null;
  private prevFrameData: ImageData | null = null;
  private motionHistory: MotionTrackingResult[] = [];
  private maxHistory: number = 30;

  /**
   * Track motion in current frame
   */
  track(
    frameId: number,
    currentEmbedding: Float32Array,
    tracks: DetectedObject[] = []
  ): MotionTrackingResult {
    const timestamp = performance.now();

    // Calculate global motion
    const globalMotion = this.calculateGlobalMotion(currentEmbedding);

    // Calculate motion magnitude
    const motionMagnitude = Math.sqrt(
      globalMotion.vx * globalMotion.vx + globalMotion.vy * globalMotion.vy
    );

    // Detect motion patterns
    const patterns = this.detectMotionPatterns(motionMagnitude, tracks);

    const result: MotionTrackingResult = {
      frameId,
      globalMotion,
      motionMagnitude,
      patterns,
      tracks,
    };

    // Update history
    this.motionHistory.push(result);
    if (this.motionHistory.length > this.maxHistory) {
      this.motionHistory.shift();
    }

    // Update previous embedding
    this.prevEmbedding = currentEmbedding;

    return result;
  }

  /**
   * Calculate global motion between embeddings
   */
  private calculateGlobalMotion(currentEmbedding: Float32Array): {
    vx: number;
    vy: number;
  } {
    if (!this.prevEmbedding) {
      return { vx: 0, vy: 0 };
    }

    // Calculate difference as motion proxy
    let diff = 0;
    const len = Math.min(currentEmbedding.length, this.prevEmbedding.length);

    for (let i = 0; i < len; i++) {
      diff += currentEmbedding[i] - this.prevEmbedding[i];
    }

    // Normalize to motion vector
    const magnitude = Math.abs(diff) / len;

    // Simple motion decomposition
    return {
      vx: magnitude * (diff >= 0 ? 1 : -1),
      vy: magnitude * 0.5, // Simplified
    };
  }

  /**
   * Detect motion patterns
   */
  private detectMotionPatterns(
    magnitude: number,
    tracks: DetectedObject[]
  ): MotionPattern[] {
    const patterns: MotionPattern[] = [];

    // Classify motion type
    const motionType = this.classifyMotionType(magnitude);
    if (motionType !== "static") {
      patterns.push({
        type: motionType,
        confidence: Math.min(1, magnitude),
        region: { x: 0, y: 0, width: 1, height: 1 },
        duration: 1,
      });
    }

    // Analyze track motion
    for (const track of tracks) {
      if (
        track.trajectory.velocity.vx !== 0 ||
        track.trajectory.velocity.vy !== 0
      ) {
        const trackMagnitude = Math.sqrt(
          track.trajectory.velocity.vx ** 2 + track.trajectory.velocity.vy ** 2
        );

        if (trackMagnitude > 0.01) {
          patterns.push({
            type: this.classifyMotionType(trackMagnitude),
            confidence: track.confidence,
            region: track.boundingBox,
            duration: track.age,
          });
        }
      }
    }

    return patterns;
  }

  /**
   * Classify motion type
   */
  private classifyMotionType(magnitude: number): MotionPattern["type"] {
    if (magnitude < 0.01) {
      return "static";
    } else if (magnitude < 0.1) {
      return "linear";
    } else if (magnitude < 0.3) {
      return "oscillating";
    } else {
      return "circular";
    }
  }

  /**
   * Calculate optical flow between frames
   */
  calculateOpticalFlow(
    currentFrame: ImageData,
    prevFrame: ImageData
  ): OpticalFlowResult {
    // This is a simplified optical flow calculation
    // In production, use proper algorithms like Farneback or Lucas-Kanade

    const width = currentFrame.width;
    const height = currentFrame.height;
    const blockSize = 8;

    const flowVectors: MotionVector[][] = [];
    const magnitudeHeatmap: number[][] = [];

    for (let y = 0; y < height; y += blockSize) {
      const row: MotionVector[] = [];
      const magRow: number[] = [];

      for (let x = 0; x < width; x += blockSize) {
        // Calculate flow for this block
        const flow = this.calculateBlockFlow(
          currentFrame,
          prevFrame,
          x,
          y,
          blockSize
        );

        row.push(flow);
        magRow.push(flow.magnitude);
      }

      flowVectors.push(row);
      magnitudeHeatmap.push(magRow);
    }

    // Calculate average flow
    let avgVx = 0;
    let avgVy = 0;
    let count = 0;

    for (const row of flowVectors) {
      for (const flow of row) {
        avgVx += flow.vx;
        avgVy += flow.vy;
        count++;
      }
    }

    const average: MotionVector = {
      vx: avgVx / count,
      vy: avgVy / count,
      magnitude: Math.sqrt((avgVx / count) ** 2 + (avgVy / count) ** 2),
      angle: Math.atan2(avgVy / count, avgVx / count),
    };

    return {
      vectors: flowVectors,
      average,
      magnitudeHeatmap,
    };
  }

  /**
   * Calculate flow for a block
   */
  private calculateBlockFlow(
    currentFrame: ImageData,
    prevFrame: ImageData,
    startX: number,
    startY: number,
    blockSize: number
  ): MotionVector {
    // Simple block matching
    let bestDx = 0;
    let bestDy = 0;
    let bestDiff = Infinity;

    const searchRadius = 4;

    for (let dy = -searchRadius; dy <= searchRadius; dy++) {
      for (let dx = -searchRadius; dx <= searchRadius; dx++) {
        const diff = this.calculateBlockDifference(
          currentFrame,
          prevFrame,
          startX,
          startY,
          dx,
          dy,
          blockSize
        );

        if (diff < bestDiff) {
          bestDiff = diff;
          bestDx = dx;
          bestDy = dy;
        }
      }
    }

    const magnitude = Math.sqrt(bestDx ** 2 + bestDy ** 2);
    const angle = Math.atan2(bestDy, bestDx);

    return {
      vx: bestDx,
      vy: bestDy,
      magnitude,
      angle,
    };
  }

  /**
   * Calculate difference between blocks
   */
  private calculateBlockDifference(
    currentFrame: ImageData,
    prevFrame: ImageData,
    startX: number,
    startY: number,
    dx: number,
    dy: number,
    blockSize: number
  ): number {
    let diff = 0;
    let count = 0;

    for (let y = 0; y < blockSize; y++) {
      for (let x = 0; x < blockSize; x++) {
        const curX = startX + x;
        const curY = startY + y;
        const prevX = curX + dx;
        const prevY = curY + dy;

        if (
          curX < currentFrame.width &&
          curY < currentFrame.height &&
          prevX >= 0 &&
          prevX < prevFrame.width &&
          prevY >= 0 &&
          prevY < prevFrame.height
        ) {
          const curIdx = (curY * currentFrame.width + curX) * 4;
          const prevIdx = (prevY * prevFrame.width + prevX) * 4;

          const curGray =
            (currentFrame.data[curIdx] +
              currentFrame.data[curIdx + 1] +
              currentFrame.data[curIdx + 2]) /
            3;
          const prevGray =
            (prevFrame.data[prevIdx] +
              prevFrame.data[prevIdx + 1] +
              prevFrame.data[prevIdx + 2]) /
            3;

          diff += Math.abs(curGray - prevGray);
          count++;
        }
      }
    }

    return count > 0 ? diff / count : 0;
  }

  /**
   * Get motion statistics
   */
  getStats(): {
    avgMotion: number;
    maxMotion: number;
    minMotion: number;
    motionPercentiles: { p50: number; p95: number; p99: number };
    dominantPattern: string;
  } {
    if (this.motionHistory.length === 0) {
      return {
        avgMotion: 0,
        maxMotion: 0,
        minMotion: 0,
        motionPercentiles: { p50: 0, p95: 0, p99: 0 },
        dominantPattern: "static",
      };
    }

    const magnitudes = this.motionHistory.map(h => h.motionMagnitude);
    const avg = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
    const max = Math.max(...magnitudes);
    const min = Math.min(...magnitudes);

    const sorted = [...magnitudes].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    // Find dominant pattern
    const patternCounts = new Map<string, number>();
    for (const result of this.motionHistory) {
      for (const pattern of result.patterns) {
        const count = patternCounts.get(pattern.type) || 0;
        patternCounts.set(pattern.type, count + 1);
      }
    }

    let dominantPattern = "static";
    let maxCount = 0;
    for (const [pattern, count] of patternCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        dominantPattern = pattern;
      }
    }

    return {
      avgMotion: avg,
      maxMotion: max,
      minMotion: min,
      motionPercentiles: { p50, p95, p99 },
      dominantPattern,
    };
  }

  /**
   * Reset tracker
   */
  reset(): void {
    this.prevEmbedding = null;
    this.prevFrameData = null;
    this.motionHistory = [];
  }
}

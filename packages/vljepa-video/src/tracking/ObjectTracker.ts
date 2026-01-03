/**
 * @lsi/vljepa-video/tracking/ObjectTracker
 *
 * Object tracker for tracking objects across video frames.
 *
 * @version 1.0.0
 */

import type {
  DetectedObject,
  TrackingConfig,
  BoundingBox,
  Trajectory,
  MotionResult,
  MotionPattern,
} from "../types.js";

/**
 * Object tracker
 *
 * Tracks objects across frames using various algorithms.
 */
export class ObjectTracker {
  private config: TrackingConfig;
  private tracks: Map<string, DetectedObject> = new Map();
  private nextTrackId: number = 1;
  private frameCount: number = 0;

  constructor(config: TrackingConfig) {
    this.config = config;
  }

  /**
   * Update tracks with new detections
   */
  update(detections: DetectedObject[]): DetectedObject[] {
    this.frameCount++;

    // Age all existing tracks
    for (const track of this.tracks.values()) {
      track.age++;
    }

    // Match detections to existing tracks
    const matches = this.matchDetections(detections);

    // Update matched tracks
    for (const [detection, trackId] of matches) {
      const track = this.tracks.get(trackId);
      if (track) {
        this.updateTrack(track, detection);
      }
    }

    // Create new tracks for unmatched detections
    const matchedDetectionIds = new Set(matches.map(m => m[0].id));
    for (const detection of detections) {
      if (!matchedDetectionIds.has(detection.id)) {
        this.createTrack(detection);
      }
    }

    // Remove old or deleted tracks
    this.cleanupTracks();

    return Array.from(this.tracks.values());
  }

  /**
   * Match detections to existing tracks
   */
  private matchDetections(
    detections: DetectedObject[]
  ): Array<[DetectedObject, string]> {
    const matches: Array<[DetectedObject, string]> = [];
    const usedTrackIds = new Set<string>();
    const usedDetectionIds = new Set<string>();

    // Sort by confidence
    const sortedDetections = [...detections].sort(
      (a, b) => b.confidence - a.confidence
    );

    // Greedy matching based on IoU
    for (const detection of sortedDetections) {
      let bestMatch: { trackId: string; iou: number } | null = null;

      for (const [trackId, track] of this.tracks.entries()) {
        if (usedTrackIds.has(trackId)) {
          continue;
        }

        if (track.state === "deleted") {
          continue;
        }

        // Check class match
        if (track.class !== detection.class) {
          continue;
        }

        // Calculate IoU
        const iou = this.calculateIoU(track.boundingBox, detection.boundingBox);

        if (iou >= this.config.iouThreshold) {
          if (!bestMatch || iou > bestMatch.iou) {
            bestMatch = { trackId, iou };
          }
        }
      }

      if (bestMatch) {
        matches.push([detection, bestMatch.trackId]);
        usedTrackIds.add(bestMatch.trackId);
        usedDetectionIds.add(detection.id);
      }
    }

    return matches;
  }

  /**
   * Calculate Intersection over Union (IoU)
   */
  private calculateIoU(box1: BoundingBox, box2: BoundingBox): number {
    const x1 = Math.max(box1.x, box2.x);
    const y1 = Math.max(box1.y, box2.y);
    const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
    const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

    const intersectionArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    const box1Area = box1.width * box1.height;
    const box2Area = box2.width * box2.height;
    const unionArea = box1Area + box2Area - intersectionArea;

    if (unionArea === 0) {
      return 0;
    }

    return intersectionArea / unionArea;
  }

  /**
   * Update existing track
   */
  private updateTrack(track: DetectedObject, detection: DetectedObject): void {
    // Update bounding box
    track.boundingBox = detection.boundingBox;

    // Update confidence
    track.confidence = detection.confidence;

    // Reset age
    track.age = 0;

    // Increment hits
    track.hits++;

    // Update trajectory
    this.updateTrajectory(track, detection.boundingBox);

    // Update state
    if (track.state === "tentative" && track.hits >= this.config.minHits) {
      track.state = "confirmed";
    }

    // Update features if available
    if (detection.features) {
      track.features = detection.features;
    }
  }

  /**
   * Create new track
   */
  private createTrack(detection: DetectedObject): void {
    const trackId = `track_${this.nextTrackId++}`;
    const track: DetectedObject = {
      id: trackId,
      class: detection.class,
      boundingBox: detection.boundingBox,
      confidence: detection.confidence,
      age: 0,
      hits: 1,
      state: this.config.minHits > 1 ? "tentative" : "confirmed",
      trajectory: {
        positions: [
          {
            x: detection.boundingBox.x + detection.boundingBox.width / 2,
            y: detection.boundingBox.y + detection.boundingBox.height / 2,
            timestamp: performance.now(),
          },
        ],
        velocity: { vx: 0, vy: 0 },
      },
      features: detection.features,
    };

    this.tracks.set(trackId, track);

    // Check max tracks limit
    if (this.tracks.size > this.config.maxTracks) {
      // Remove oldest track
      let oldestTrackId: string | null = null;
      let oldestAge = -1;

      for (const [id, t] of this.tracks.entries()) {
        if (t.age > oldestAge) {
          oldestAge = t.age;
          oldestTrackId = id;
        }
      }

      if (oldestTrackId) {
        this.tracks.delete(oldestTrackId);
      }
    }
  }

  /**
   * Update trajectory for track
   */
  private updateTrajectory(track: DetectedObject, box: BoundingBox): void {
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    const timestamp = performance.now();

    // Add position to trajectory
    track.trajectory.positions.push({ x: centerX, y: centerY, timestamp });

    // Keep only recent positions (last 30)
    if (track.trajectory.positions.length > 30) {
      track.trajectory.positions.shift();
    }

    // Calculate velocity
    if (track.trajectory.positions.length >= 2) {
      const prev =
        track.trajectory.positions[track.trajectory.positions.length - 2];
      const curr =
        track.trajectory.positions[track.trajectory.positions.length - 1];
      const dt = curr.timestamp - prev.timestamp;

      if (dt > 0) {
        track.trajectory.velocity = {
          vx: (curr.x - prev.x) / dt,
          vy: (curr.y - prev.y) / dt,
        };
      }
    }

    // Predict next position
    if (track.trajectory.positions.length >= 3) {
      // Simple linear prediction
      const last =
        track.trajectory.positions[track.trajectory.positions.length - 1];
      track.trajectory.predicted = {
        x: last.x + track.trajectory.velocity.vx * 33.33, // Predict 30fps ahead
        y: last.y + track.trajectory.velocity.vy * 33.33,
      };
    }
  }

  /**
   * Clean up old tracks
   */
  private cleanupTracks(): void {
    const toDelete: string[] = [];

    for (const [id, track] of this.tracks.entries()) {
      if (track.age > this.config.maxAge) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.tracks.delete(id);
    }
  }

  /**
   * Get all tracks
   */
  getTracks(): DetectedObject[] {
    return Array.from(this.tracks.values());
  }

  /**
   * Get confirmed tracks only
   */
  getConfirmedTracks(): DetectedObject[] {
    return Array.from(this.tracks.values()).filter(
      t => t.state === "confirmed"
    );
  }

  /**
   * Reset tracker
   */
  reset(): void {
    this.tracks.clear();
    this.nextTrackId = 1;
    this.frameCount = 0;
  }

  /**
   * Get tracker statistics
   */
  getStats(): {
    totalTracks: number;
    confirmedTracks: number;
    tentativeTracks: number;
    frameCount: number;
  } {
    const tracks = this.getTracks();

    return {
      totalTracks: tracks.length,
      confirmedTracks: tracks.filter(t => t.state === "confirmed").length,
      tentativeTracks: tracks.filter(t => t.state === "tentative").length,
      frameCount: this.frameCount,
    };
  }
}

/**
 * Motion tracker
 *
 * Tracks motion patterns across frames.
 */
export class MotionTracker {
  private prevFrame: Float32Array | null = null;
  private motionHistory: Array<{ magnitude: number; timestamp: number }> = [];

  /**
   * Track motion between frames
   */
  track(
    currentEmbedding: Float32Array,
    prevEmbedding: Float32Array | null
  ): MotionResult {
    const timestamp = performance.now();

    let globalMotion = { vx: 0, vy: 0 };
    let motionMagnitude = 0;
    const patterns: MotionPattern[] = [];

    if (prevEmbedding) {
      // Calculate motion between embeddings
      motionMagnitude = this.calculateMotionMagnitude(
        currentEmbedding,
        prevEmbedding
      );

      // Analyze motion patterns
      const motionType = this.classifyMotion(motionMagnitude);

      if (motionType !== "static") {
        patterns.push({
          type: motionType,
          confidence: Math.min(1, motionMagnitude / 0.5),
          region: { x: 0, y: 0, width: 1, height: 1 },
          duration: 1,
        });
      }
    }

    // Update history
    this.motionHistory.push({ magnitude: motionMagnitude, timestamp });
    if (this.motionHistory.length > 30) {
      this.motionHistory.shift();
    }

    return {
      frameId: timestamp,
      tracks: [],
      globalMotion,
      motionMagnitude,
      patterns,
    };
  }

  /**
   * Calculate motion magnitude between embeddings
   */
  private calculateMotionMagnitude(
    current: Float32Array,
    prev: Float32Array
  ): number {
    let diff = 0;
    const len = Math.min(current.length, prev.length);

    for (let i = 0; i < len; i++) {
      diff += Math.abs(current[i] - prev[i]);
    }

    return diff / len;
  }

  /**
   * Classify motion type
   */
  private classifyMotion(magnitude: number): MotionPattern["type"] {
    if (magnitude < 0.01) {
      return "static";
    } else if (magnitude < 0.1) {
      return "linear";
    } else {
      return "oscillating";
    }
  }

  /**
   * Get motion statistics
   */
  getStats(): {
    avgMotion: number;
    maxMotion: number;
    motionPercentiles: { p50: number; p95: number; p99: number };
  } {
    if (this.motionHistory.length === 0) {
      return {
        avgMotion: 0,
        maxMotion: 0,
        motionPercentiles: { p50: 0, p95: 0, p99: 0 },
      };
    }

    const magnitudes = this.motionHistory.map(h => h.magnitude);
    const avg = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
    const max = Math.max(...magnitudes);

    const sorted = [...magnitudes].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return {
      avgMotion: avg,
      maxMotion: max,
      motionPercentiles: { p50, p95, p99 },
    };
  }
}

/**
 * Temporal tracker
 *
 * Tracks temporal patterns in video streams.
 */
export class TemporalTracker {
  private embeddingHistory: Float32Array[] = [];
  private maxHistory: number = 30;

  /**
   * Update with new embedding
   */
  update(embedding: Float32Array): void {
    this.embeddingHistory.push(embedding);

    if (this.embeddingHistory.length > this.maxHistory) {
      this.embeddingHistory.shift();
    }
  }

  /**
   * Get temporal context
   */
  getContext(windowSize: number = 5): Float32Array[] {
    const start = Math.max(0, this.embeddingHistory.length - windowSize);
    return this.embeddingHistory.slice(start);
  }

  /**
   * Predict next embedding
   */
  predictNext(): Float32Array | null {
    if (this.embeddingHistory.length < 2) {
      return null;
    }

    // Simple linear prediction
    const prev = this.embeddingHistory[this.embeddingHistory.length - 2];
    const curr = this.embeddingHistory[this.embeddingHistory.length - 1];
    const predicted = new Float32Array(curr.length);

    for (let i = 0; i < curr.length; i++) {
      // Extrapolate based on difference
      const diff = curr[i] - prev[i];
      predicted[i] = curr[i] + diff;
    }

    return predicted;
  }

  /**
   * Detect anomaly in temporal pattern
   */
  detectAnomaly(embedding: Float32Array, threshold: number = 0.5): boolean {
    if (this.embeddingHistory.length === 0) {
      return false;
    }

    const avg =
      this.embeddingHistory.reduce((sum, emb) => {
        let s = 0;
        for (let i = 0; i < Math.min(emb.length, embedding.length); i++) {
          s += Math.abs(emb[i] - embedding[i]);
        }
        return sum + s / emb.length;
      }, 0) / this.embeddingHistory.length;

    return avg > threshold;
  }

  /**
   * Clear history
   */
  clear(): void {
    this.embeddingHistory = [];
  }
}

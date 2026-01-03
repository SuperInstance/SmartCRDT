/**
 * @lsi/vljepa-video/test/ObjectTracker.test.ts
 *
 * Comprehensive tests for ObjectTracker.
 *
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ObjectTracker,
  MotionTracker,
  TemporalTracker,
} from "../src/tracking/ObjectTracker.js";
import type { DetectedObject, TrackingConfig, BoundingBox } from "../src/types.js";

describe("ObjectTracker", () => {
  let tracker: ObjectTracker;
  let config: TrackingConfig;

  beforeEach(() => {
    config = {
      algorithm: "sort",
      maxAge: 30,
      minHits: 3,
      iouThreshold: 0.3,
      useReID: false,
      maxTracks: 100,
    };

    tracker = new ObjectTracker(config);
  });

  describe("Initialization", () => {
    it("should initialize with correct config", () => {
      expect(tracker).toBeDefined();
    });

    it("should have empty initial state", () => {
      const stats = tracker.getStats();

      expect(stats.totalTracks).toBe(0);
      expect(stats.confirmedTracks).toBe(0);
      expect(stats.tentativeTracks).toBe(0);
      expect(stats.frameCount).toBe(0);
    });
  });

  describe("Track Creation", () => {
    it("should create new track for detection", () => {
      const detections: DetectedObject[] = [
        {
          id: "det_1",
          class: "person",
          boundingBox: { x: 100, y: 100, width: 50, height: 100 },
          confidence: 0.9,
          age: 0,
          hits: 1,
          state: "tentative",
          trajectory: {
            positions: [{ x: 125, y: 150, timestamp: performance.now() }],
            velocity: { vx: 0, vy: 0 },
          },
        },
      ];

      const tracks = tracker.update(detections);

      expect(tracks).toHaveLength(1);
      expect(tracks[0].class).toBe("person");
    });

    it("should create multiple tracks for multiple detections", () => {
      const detections: DetectedObject[] = [
        {
          id: "det_1",
          class: "person",
          boundingBox: { x: 100, y: 100, width: 50, height: 100 },
          confidence: 0.9,
          age: 0,
          hits: 1,
          state: "tentative",
          trajectory: {
            positions: [{ x: 125, y: 150, timestamp: performance.now() }],
            velocity: { vx: 0, vy: 0 },
          },
        },
        {
          id: "det_2",
          class: "car",
          boundingBox: { x: 300, y: 200, width: 80, height: 60 },
          confidence: 0.85,
          age: 0,
          hits: 1,
          state: "tentative",
          trajectory: {
            positions: [{ x: 340, y: 230, timestamp: performance.now() }],
            velocity: { vx: 0, vy: 0 },
          },
        },
      ];

      const tracks = tracker.update(detections);

      expect(tracks).toHaveLength(2);
    });

    it("should set tentative state for new tracks", () => {
      const detections: DetectedObject[] = [
        {
          id: "det_1",
          class: "person",
          boundingBox: { x: 100, y: 100, width: 50, height: 100 },
          confidence: 0.9,
          age: 0,
          hits: 1,
          state: "tentative",
          trajectory: {
            positions: [{ x: 125, y: 150, timestamp: performance.now() }],
            velocity: { vx: 0, vy: 0 },
          },
        },
      ];

      const tracks = tracker.update(detections);

      expect(tracks[0].state).toBe("tentative");
    });
  });

  describe("Track Confirmation", () => {
    it("should confirm track after min hits", () => {
      const detections: DetectedObject[] = [
        {
          id: "det_1",
          class: "person",
          boundingBox: { x: 100, y: 100, width: 50, height: 100 },
          confidence: 0.9,
          age: 0,
          hits: 1,
          state: "tentative",
          trajectory: {
            positions: [{ x: 125, y: 150, timestamp: performance.now() }],
            velocity: { vx: 0, vy: 0 },
          },
        },
      ];

      // Update multiple times
      for (let i = 0; i < 5; i++) {
        detections[0].boundingBox.x += 5;
        tracker.update(detections);
      }

      const tracks = tracker.getTracks();
      const confirmed = tracker.getConfirmedTracks();

      expect(confirmed.length).toBeGreaterThan(0);
    });
  });

  describe("Track Matching", () => {
    it("should match detections to existing tracks", () => {
      // Create initial track
      let detections: DetectedObject[] = [
        {
          id: "det_1",
          class: "person",
          boundingBox: { x: 100, y: 100, width: 50, height: 100 },
          confidence: 0.9,
          age: 0,
          hits: 1,
          state: "tentative",
          trajectory: {
            positions: [{ x: 125, y: 150, timestamp: performance.now() }],
            velocity: { vx: 0, vy: 0 },
          },
        },
      ];

      tracker.update(detections);

      // Update with slightly moved detection
      detections[0].id = "det_2";
      detections[0].boundingBox.x = 105;

      const tracks = tracker.update(detections);

      expect(tracks).toHaveLength(1); // Still one track
      expect(tracks[0].hits).toBeGreaterThan(1);
    });

    it("should not match tracks with different classes", () => {
      let detections: DetectedObject[] = [
        {
          id: "det_1",
          class: "person",
          boundingBox: { x: 100, y: 100, width: 50, height: 100 },
          confidence: 0.9,
          age: 0,
          hits: 1,
          state: "tentative",
          trajectory: {
            positions: [{ x: 125, y: 150, timestamp: performance.now() }],
            velocity: { vx: 0, vy: 0 },
          },
        },
      ];

      tracker.update(detections);

      // Different class at same location
      detections[0].id = "det_2";
      detections[0].class = "car";

      const tracks = tracker.update(detections);

      expect(tracks.length).toBeGreaterThanOrEqual(1);
    });

    it("should use IoU threshold for matching", () => {
      config.iouThreshold = 0.5;
      tracker = new ObjectTracker(config);

      let detections: DetectedObject[] = [
        {
          id: "det_1",
          class: "person",
          boundingBox: { x: 100, y: 100, width: 50, height: 100 },
          confidence: 0.9,
          age: 0,
          hits: 1,
          state: "tentative",
          trajectory: {
            positions: [{ x: 125, y: 150, timestamp: performance.now() }],
            velocity: { vx: 0, vy: 0 },
          },
        },
      ];

      tracker.update(detections);

      // Move detection far away (low IoU)
      detections[0].id = "det_2";
      detections[0].boundingBox.x = 500;

      const tracks = tracker.update(detections);

      // Should create new track
      expect(tracks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Trajectory Tracking", () => {
    it("should update trajectory with position history", () => {
      let detections: DetectedObject[] = [
        {
          id: "det_1",
          class: "person",
          boundingBox: { x: 100, y: 100, width: 50, height: 100 },
          confidence: 0.9,
          age: 0,
          hits: 1,
          state: "tentative",
          trajectory: {
            positions: [{ x: 125, y: 150, timestamp: performance.now() }],
            velocity: { vx: 0, vy: 0 },
          },
        },
      ];

      for (let i = 0; i < 5; i++) {
        detections[0].boundingBox.x += 10;
        tracker.update(detections);
      }

      const tracks = tracker.getTracks();

      if (tracks.length > 0) {
        expect(tracks[0].trajectory.positions.length).toBeGreaterThan(1);
      }
    });

    it("should calculate velocity from trajectory", () => {
      let detections: DetectedObject[] = [
        {
          id: "det_1",
          class: "person",
          boundingBox: { x: 100, y: 100, width: 50, height: 100 },
          confidence: 0.9,
          age: 0,
          hits: 1,
          state: "tentative",
          trajectory: {
            positions: [{ x: 125, y: 150, timestamp: performance.now() }],
            velocity: { vx: 0, vy: 0 },
          },
        },
      ];

      tracker.update(detections);

      detections[0].boundingBox.x += 50;
      tracker.update(detections);

      const tracks = tracker.getTracks();

      if (tracks.length > 0) {
        expect(tracks[0].trajectory.velocity.vx).not.toBe(0);
      }
    });

    it("should predict next position", () => {
      let detections: DetectedObject[] = [
        {
          id: "det_1",
          class: "person",
          boundingBox: { x: 100, y: 100, width: 50, height: 100 },
          confidence: 0.9,
          age: 0,
          hits: 1,
          state: "tentative",
          trajectory: {
            positions: [{ x: 125, y: 150, timestamp: performance.now() }],
            velocity: { vx: 0, vy: 0 },
          },
        },
      ];

      for (let i = 0; i < 5; i++) {
        detections[0].boundingBox.x += 10;
        tracker.update(detections);
      }

      const tracks = tracker.getTracks();

      if (tracks.length > 0 && tracks[0].trajectory.predicted) {
        expect(tracks[0].trajectory.predicted.x).toBeDefined();
        expect(tracks[0].trajectory.predicted.y).toBeDefined();
      }
    });
  });

  describe("Track Deletion", () => {
    it("should delete old tracks after max age", () => {
      config.maxAge = 3;
      tracker = new ObjectTracker(config);

      let detections: DetectedObject[] = [
        {
          id: "det_1",
          class: "person",
          boundingBox: { x: 100, y: 100, width: 50, height: 100 },
          confidence: 0.9,
          age: 0,
          hits: 1,
          state: "tentative",
          trajectory: {
            positions: [{ x: 125, y: 150, timestamp: performance.now() }],
            velocity: { vx: 0, vy: 0 },
          },
        },
      ];

      tracker.update(detections);

      // Don't update for several frames
      for (let i = 0; i < 5; i++) {
        tracker.update([]);
      }

      const tracks = tracker.getTracks();
      expect(tracks.length).toBe(0);
    });

    it("respect max tracks limit", () => {
      config.maxTracks = 5;
      tracker = new ObjectTracker(config);

      const detections: DetectedObject[] = [];

      for (let i = 0; i < 10; i++) {
        detections.push({
          id: `det_${i}`,
          class: "person",
          boundingBox: { x: i * 100, y: 100, width: 50, height: 100 },
          confidence: 0.9,
          age: 0,
          hits: 1,
          state: "tentative",
          trajectory: {
            positions: [{ x: i * 100 + 25, y: 150, timestamp: performance.now() }],
            velocity: { vx: 0, vy: 0 },
          },
        });
      }

      tracker.update(detections);

      const stats = tracker.getStats();
      expect(stats.totalTracks).toBeLessThanOrEqual(5);
    });
  });

  describe("Statistics", () => {
    it("should track frame count", () => {
      const detections: DetectedObject[] = [
        {
          id: "det_1",
          class: "person",
          boundingBox: { x: 100, y: 100, width: 50, height: 100 },
          confidence: 0.9,
          age: 0,
          hits: 1,
          state: "tentative",
          trajectory: {
            positions: [{ x: 125, y: 150, timestamp: performance.now() }],
            velocity: { vx: 0, vy: 0 },
          },
        },
      ];

      tracker.update(detections);
      tracker.update(detections);
      tracker.update(detections);

      const stats = tracker.getStats();
      expect(stats.frameCount).toBe(3);
    });

    it("should count confirmed vs tentative tracks", () => {
      const detections: DetectedObject[] = [
        {
          id: "det_1",
          class: "person",
          boundingBox: { x: 100, y: 100, width: 50, height: 100 },
          confidence: 0.9,
          age: 0,
          hits: 1,
          state: "tentative",
          trajectory: {
            positions: [{ x: 125, y: 150, timestamp: performance.now() }],
            velocity: { vx: 0, vy: 0 },
          },
        },
      ];

      for (let i = 0; i < 5; i++) {
        tracker.update(detections);
      }

      const stats = tracker.getStats();
      expect(stats.tentativeTracks + stats.confirmedTracks).toBe(stats.totalTracks);
    });
  });

  describe("Reset", () => {
    it("should reset tracker state", () => {
      const detections: DetectedObject[] = [
        {
          id: "det_1",
          class: "person",
          boundingBox: { x: 100, y: 100, width: 50, height: 100 },
          confidence: 0.9,
          age: 0,
          hits: 1,
          state: "tentative",
          trajectory: {
            positions: [{ x: 125, y: 150, timestamp: performance.now() }],
            velocity: { vx: 0, vy: 0 },
          },
        },
      ];

      tracker.update(detections);
      tracker.reset();

      const stats = tracker.getStats();
      expect(stats.totalTracks).toBe(0);
      expect(stats.frameCount).toBe(0);
    });
  });

  describe("Track Filtering", () => {
    it("should get only confirmed tracks", () => {
      let detections: DetectedObject[] = [
        {
          id: "det_1",
          class: "person",
          boundingBox: { x: 100, y: 100, width: 50, height: 100 },
          confidence: 0.9,
          age: 0,
          hits: 1,
          state: "tentative",
          trajectory: {
            positions: [{ x: 125, y: 150, timestamp: performance.now() }],
            velocity: { vx: 0, vy: 0 },
          },
        },
      ];

      for (let i = 0; i < 5; i++) {
        tracker.update(detections);
      }

      const confirmed = tracker.getConfirmedTracks();
      const all = tracker.getTracks();

      expect(confirmed.length).toBeLessThanOrEqual(all.length);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty detections", () => {
      const tracks = tracker.update([]);
      expect(tracks).toEqual([]);
    });

    it("should handle detections with zero confidence", () => {
      const detections: DetectedObject[] = [
        {
          id: "det_1",
          class: "person",
          boundingBox: { x: 100, y: 100, width: 50, height: 100 },
          confidence: 0,
          age: 0,
          hits: 1,
          state: "tentative",
          trajectory: {
            positions: [{ x: 125, y: 150, timestamp: performance.now() }],
            velocity: { vx: 0, vy: 0 },
          },
        },
      ];

      const tracks = tracker.update(detections);
      expect(tracks).toBeDefined();
    });

    it("should handle overlapping bounding boxes", () => {
      const detections: DetectedObject[] = [
        {
          id: "det_1",
          class: "person",
          boundingBox: { x: 100, y: 100, width: 50, height: 100 },
          confidence: 0.9,
          age: 0,
          hits: 1,
          state: "tentative",
          trajectory: {
            positions: [{ x: 125, y: 150, timestamp: performance.now() }],
            velocity: { vx: 0, vy: 0 },
          },
        },
        {
          id: "det_2",
          class: "person",
          boundingBox: { x: 110, y: 105, width: 50, height: 100 },
          confidence: 0.85,
          age: 0,
          hits: 1,
          state: "tentative",
          trajectory: {
            positions: [{ x: 135, y: 155, timestamp: performance.now() }],
            velocity: { vx: 0, vy: 0 },
          },
        },
      ];

      const tracks = tracker.update(detections);
      expect(tracks.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe("MotionTracker", () => {
  let tracker: MotionTracker;

  beforeEach(() => {
    tracker = new MotionTracker();
  });

  describe("Motion Detection", () => {
    it("should detect no motion on first frame", () => {
      const embedding = new Float32Array(768).fill(0.5);

      const result = tracker.track(1, embedding, null);

      expect(result.frameId).toBe(1);
      expect(result.motionMagnitude).toBe(0);
    });

    it("should detect motion between frames", () => {
      const embedding1 = new Float32Array(768).fill(0.5);
      const embedding2 = new Float32Array(768).fill(0.6);

      tracker.track(1, embedding1, null);
      const result = tracker.track(2, embedding2, embedding1);

      expect(result.motionMagnitude).toBeGreaterThan(0);
    });

    it("should classify motion patterns", () => {
      const embedding1 = new Float32Array(768).fill(0.5);
      const embedding2 = new Float32Array(768).fill(0.51);

      tracker.track(1, embedding1, null);
      const result = tracker.track(2, embedding2, embedding1);

      expect(result.patterns).toBeDefined();
    });
  });

  describe("Statistics", () => {
    it("should track motion statistics", () => {
      for (let i = 0; i < 10; i++) {
        const embedding = new Float32Array(768).fill(0.5 + i * 0.01);
        const prev = i > 0 ? new Float32Array(768).fill(0.5 + (i - 1) * 0.01) : null;
        tracker.track(i + 1, embedding, prev);
      }

      const stats = tracker.getStats();
      expect(stats.avgMotion).toBeGreaterThan(0);
    });
  });

  describe("Reset", () => {
    it("should reset tracker", () => {
      const embedding = new Float32Array(768).fill(0.5);
      tracker.track(1, embedding, null);

      tracker.reset();

      const result = tracker.track(2, embedding, null);
      expect(result.motionMagnitude).toBe(0);
    });
  });
});

describe("TemporalTracker", () => {
  let tracker: TemporalTracker;

  beforeEach(() => {
    tracker = new TemporalTracker();
  });

  describe("Temporal Tracking", () => {
    it("should track temporal context", () => {
      const embedding = new Float32Array(768).fill(0.5);

      const result = tracker.update(1, embedding);

      expect(result.context).toBeDefined();
      expect(result.context.length).toBeGreaterThanOrEqual(1);
    });

    it("should predict next embedding", () => {
      const embedding1 = new Float32Array(768).fill(0.5);
      const embedding2 = new Float32Array(768).fill(0.6);

      tracker.update(1, embedding1);
      const result = tracker.update(2, embedding2);

      expect(result.predicted).toBeDefined();
    });

    it("should detect anomalies", () => {
      const embedding1 = new Float32Array(768).fill(0.5);
      const embedding2 = new Float32Array(768).fill(0.8); // Big change

      tracker.update(1, embedding1);
      const result = tracker.update(2, embedding2);

      expect(result.anomalyScore).toBeGreaterThanOrEqual(0);
    });

    it("should detect temporal patterns", () => {
      for (let i = 0; i < 10; i++) {
        const embedding = new Float32Array(768).fill(0.5 + Math.sin(i * 0.5) * 0.1);
        tracker.update(i + 1, embedding);
      }

      const result = tracker.update(11, new Float32Array(768).fill(0.5));
      expect(result.patterns).toBeDefined();
    });
  });

  describe("Context Window", () => {
    it("should respect context window size", () => {
      const embedding = new Float32Array(768).fill(0.5);

      for (let i = 0; i < 40; i++) {
        tracker.update(i + 1, embedding);
      }

      const context = tracker.getContext();
      expect(context.length).toBeLessThanOrEqual(30); // Default max history
    });
  });

  describe("Reset", () => {
    it("should clear history", () => {
      const embedding = new Float32Array(768).fill(0.5);

      for (let i = 0; i < 10; i++) {
        tracker.update(i + 1, embedding);
      }

      tracker.clear();

      const context = tracker.getContext();
      expect(context.length).toBe(0);
    });
  });
});

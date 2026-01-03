/**
 * Tests for ObjectPermanence
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ObjectPermanence } from '../src/physics/ObjectPermanence.js';
import type { StateSnapshot } from '../src/types.js';

describe('ObjectPermanence', () => {
  let permanence: ObjectPermanence;

  beforeEach(() => {
    permanence = new ObjectPermanence();
  });

  const createSnapshot = (position: { x: number; y: number; z: number }): StateSnapshot => ({
    timestamp: Date.now(),
    position: { ...position },
    velocity: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    appearance: {
      color: 'red',
      size: { x: 1, y: 1, z: 1 },
      shape: 'box',
      features: []
    }
  });

  describe('Constructor', () => {
    it('should create with default config', () => {
      expect(permanence).toBeDefined();
    });

    it('should create with custom config', () => {
      const custom = new ObjectPermanence({
        maxOcclusionTime: 10000,
        predictionUncertainty: 0.2
      });
      expect(custom).toBeDefined();
    });
  });

  describe('Tracking Objects', () => {
    it('should start tracking new object', () => {
      const snapshot = createSnapshot({ x: 0, y: 0, z: 0 });
      const tracking = permanence.updateObject('obj1', snapshot, true);

      expect(tracking).toBeDefined();
      expect(tracking?.objectId).toBe('obj1');
      expect(tracking?.visible).toBe(true);
    });

    it('should track object as visible', () => {
      const snapshot = createSnapshot({ x: 1, y: 2, z: 3 });
      permanence.updateObject('obj1', snapshot, true);

      const tracking = permanence.getTracking('obj1');
      expect(tracking?.visible).toBe(true);
      expect(tracking?.predictedPosition).toEqual({ x: 1, y: 2, z: 3 });
    });

    it('should track object as occluded', () => {
      const snapshot = createSnapshot({ x: 0, y: 0, z: 0 });
      permanence.updateObject('obj1', snapshot, true);

      // Mark as occluded
      permanence.updateObject('obj1', snapshot, false);

      const tracking = permanence.getTracking('obj1');
      expect(tracking?.visible).toBe(false);
    });
  });

  describe('Object Permanence', () => {
    it('should remember position after occlusion', () => {
      const snapshot = createSnapshot({ x: 5, y: 5, z: 5 });
      permanence.updateObject('obj1', snapshot, true);

      // Object disappears
      const hiddenSnapshot = createSnapshot({ x: 5, y: 5, z: 5 });
      permanence.updateObject('obj1', hiddenSnapshot, false);

      const tracking = permanence.getTracking('obj1');
      expect(tracking?.predictedPosition).toEqual({ x: 5, y: 5, z: 5 });
    });

    it('should predict position during occlusion', () => {
      const snapshot = createSnapshot({ x: 0, y: 0, z: 0 });
      snapshot.velocity = { x: 1, y: 0, z: 0 }; // Moving right

      permanence.updateObject('obj1', snapshot, true);

      // Object occluded
      const hiddenSnapshot = createSnapshot({ x: 1, y: 0, z: 0 });
      hiddenSnapshot.velocity = { x: 1, y: 0, z: 0 };
      hiddenSnapshot.timestamp = Date.now() + 1000;

      permanence.updateObject('obj1', hiddenSnapshot, false);

      const predicted = permanence.predictReappearance('obj1');
      expect(predicted?.x).toBeGreaterThan(1); // Should have moved
    });

    it('should increase uncertainty over time', () => {
      const snapshot = createSnapshot({ x: 0, y: 0, z: 0 });
      permanence.updateObject('obj1', snapshot, true);

      permanence.updateObject('obj1', snapshot, false);

      const tracking1 = permanence.getTracking('obj1');
      const uncertainty1 = tracking1!.uncertainty;

      // Simulate time passing
      const laterSnapshot = createSnapshot({ x: 0, y: 0, z: 0 });
      laterSnapshot.timestamp = Date.now() + 2000;
      permanence.updateObject('obj1', laterSnapshot, false);

      const tracking2 = permanence.getTracking('obj1');
      const uncertainty2 = tracking2!.uncertainty;

      expect(uncertainty2).toBeGreaterThan(uncertainty1);
    });
  });

  describe('Prediction', () => {
    it('should predict reappearance position', () => {
      const snapshot = createSnapshot({ x: 10, y: 10, z: 10 });
      permanence.updateObject('obj1', snapshot, true);

      const predicted = permanence.predictReappearance('obj1');
      expect(predicted).toEqual({ x: 10, y: 10, z: 10 });
    });

    it('should return null for non-existent object', () => {
      const predicted = permanence.predictReappearance('nonexistent');
      expect(predicted).toBeNull();
    });

    it('should predict trajectory', () => {
      const snapshot = createSnapshot({ x: 0, y: 0, z: 0 });
      snapshot.velocity = { x: 1, y: 0, z: 0 };

      permanence.updateObject('obj1', snapshot, true);

      const trajectory = permanence.predictTrajectory('obj1', 1000);

      expect(trajectory).not.toBeNull();
      expect(trajectory!.length).toBeGreaterThan(1);

      // Last point should be to the right of first point
      expect(trajectory![trajectory!.length - 1].x).toBeGreaterThan(trajectory![0].x);
    });
  });

  describe('Reappearance', () => {
    it('should handle reappearance near prediction', () => {
      const snapshot = createSnapshot({ x: 0, y: 0, z: 0 });
      permanence.updateObject('obj1', snapshot, true);

      // Occlude
      permanence.updateObject('obj1', snapshot, false);

      // Reappear near predicted location
      const reappearance = permanence.handleReappearance(
        'obj1',
        { x: 5, y: 0, z: 0 },
        Date.now()
      );

      expect(reappearance).not.toBeNull();
    });

    it('should reject reappearance far from prediction', () => {
      const snapshot = createSnapshot({ x: 0, y: 0, z: 0 });
      permanence.updateObject('obj1', snapshot, true);

      // Occlude
      permanence.updateObject('obj1', snapshot, false);

      // Reappear far from predicted location
      const reappearance = permanence.handleReappearance(
        'obj1',
        { x: 200, y: 200, z: 200 },
        Date.now()
      );

      expect(reappearance).toBeNull();
    });
  });

  describe('Velocity Estimation', () => {
    it('should estimate velocity from trajectory', () => {
      // Add multiple positions
      let timestamp = Date.now();
      for (let i = 0; i < 5; i++) {
        const snapshot = createSnapshot({ x: i, y: 0, z: 0 });
        snapshot.timestamp = timestamp + i * 100;
        permanence.updateObject('obj1', snapshot, true);
      }

      const velocity = permanence.estimateVelocity('obj1');

      expect(velocity).not.toBeNull();
      expect(velocity!.x).toBeGreaterThan(0); // Moving right
    });

    it('should return null for insufficient data', () => {
      const snapshot = createSnapshot({ x: 0, y: 0, z: 0 });
      permanence.updateObject('obj1', snapshot, true);

      const velocity = permanence.estimateVelocity('obj1');
      expect(velocity).toBeNull();
    });
  });

  describe('Query Methods', () => {
    beforeEach(() => {
      const snapshot1 = createSnapshot({ x: 0, y: 0, z: 0 });
      const snapshot2 = createSnapshot({ x: 1, y: 1, z: 1 });

      permanence.updateObject('obj1', snapshot1, true);
      permanence.updateObject('obj2', snapshot2, false);
    });

    it('should get all tracked objects', () => {
      const all = permanence.getAllTracking();
      expect(all).toHaveLength(2);
    });

    it('should get only occluded objects', () => {
      const occluded = permanence.getOccludedObjects();
      expect(occluded).toHaveLength(1);
      expect(occluded[0].objectId).toBe('obj2');
    });

    it('should get only visible objects', () => {
      const visible = permanence.getVisibleObjects();
      expect(visible).toHaveLength(1);
      expect(visible[0].objectId).toBe('obj1');
    });

    it('should check if tracking object', () => {
      expect(permanence.isTracking('obj1')).toBe(true);
      expect(permanence.isTracking('nonexistent')).toBe(false);
    });
  });

  describe('Removal', () => {
    it('should remove tracked object', () => {
      const snapshot = createSnapshot({ x: 0, y: 0, z: 0 });
      permanence.updateObject('obj1', snapshot, true);

      const removed = permanence.removeObject('obj1');

      expect(removed).toBe(true);
      expect(permanence.isTracking('obj1')).toBe(false);
    });

    it('should return false when removing non-existent', () => {
      const removed = permanence.removeObject('nonexistent');
      expect(removed).toBe(false);
    });

    it('should auto-remove after max occlusion time', () => {
      const shortLived = new ObjectPermanence({
        maxOcclusionTime: 100 // 100ms
      });

      const snapshot = createSnapshot({ x: 0, y: 0, z: 0 });
      shortLived.updateObject('obj1', snapshot, true);

      // Mark as occluded
      shortLived.updateObject('obj1', snapshot, false);

      // Wait longer than max occlusion time
      const laterSnapshot = createSnapshot({ x: 0, y: 0, z: 0 });
      laterSnapshot.timestamp = Date.now() + 200;
      shortLived.updateObject('obj1', laterSnapshot, false);

      expect(shortLived.isTracking('obj1')).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should return stats', () => {
      const snapshot1 = createSnapshot({ x: 0, y: 0, z: 0 });
      const snapshot2 = createSnapshot({ x: 1, y: 1, z: 1 });

      permanence.updateObject('obj1', snapshot1, true);
      permanence.updateObject('obj2', snapshot2, false);

      const stats = permanence.getStats();

      expect(stats.totalTracked).toBe(2);
      expect(stats.visibleCount).toBe(1);
      expect(stats.occludedCount).toBe(1);
    });
  });

  describe('Reset', () => {
    it('should clear all tracking', () => {
      const snapshot = createSnapshot({ x: 0, y: 0, z: 0 });
      permanence.updateObject('obj1', snapshot, true);

      permanence.reset();

      expect(permanence.isTracking('obj1')).toBe(false);
      expect(permanence.getAllTracking()).toHaveLength(0);
    });
  });

  describe('Trajectory Update', () => {
    it('should update trajectory on each observation', () => {
      let timestamp = Date.now();
      for (let i = 0; i < 3; i++) {
        const snapshot = createSnapshot({ x: i, y: 0, z: 0 });
        snapshot.timestamp = timestamp + i * 100;
        permanence.updateObject('obj1', snapshot, true);
      }

      const tracking = permanence.getTracking('obj1');
      expect(tracking?.trajectory.positions.length).toBe(3);
    });

    it('should limit trajectory history', () => {
      let timestamp = Date.now();

      // Add 150 positions (more than max of 100)
      for (let i = 0; i < 150; i++) {
        const snapshot = createSnapshot({ x: i, y: 0, z: 0 });
        snapshot.timestamp = timestamp + i * 10;
        permanence.updateObject('obj1', snapshot, true);
      }

      const tracking = permanence.getTracking('obj1');
      expect(tracking?.trajectory.positions.length).toBeLessThanOrEqual(100);
    });
  });
});

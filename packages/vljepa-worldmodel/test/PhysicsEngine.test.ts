/**
 * Tests for PhysicsEngine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PhysicsEngine } from '../src/physics/PhysicsEngine.js';

describe('PhysicsEngine', () => {
  let engine: PhysicsEngine;

  beforeEach(() => {
    engine = new PhysicsEngine();
  });

  describe('Constructor', () => {
    it('should create engine with default config', () => {
      expect(engine).toBeDefined();
    });

    it('should create engine with custom config', () => {
      const customEngine = new PhysicsEngine({
        gravity: 5.0,
        friction: 0.5
      });
      expect(customEngine).toBeDefined();
    });
  });

  describe('Object Management', () => {
    it('should add object', () => {
      const obj = engine.createObject({
        id: 'test-obj',
        position: { x: 0, y: 5, z: 0 }
      });

      engine.addObject(obj);
      const retrieved = engine.getObject('test-obj');

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('test-obj');
    });

    it('should remove object', () => {
      const obj = engine.createObject({
        id: 'test-obj',
        position: { x: 0, y: 5, z: 0 }
      });

      engine.addObject(obj);
      const removed = engine.removeObject('test-obj');

      expect(removed).toBe(true);
      expect(engine.getObject('test-obj')).toBeUndefined();
    });

    it('should get object by id', () => {
      const obj = engine.createObject({
        id: 'test-obj',
        position: { x: 1, y: 2, z: 3 }
      });

      engine.addObject(obj);
      const retrieved = engine.getObject('test-obj');

      expect(retrieved?.position.x).toBe(1);
      expect(retrieved?.position.y).toBe(2);
      expect(retrieved?.position.z).toBe(3);
    });
  });

  describe('Gravity', () => {
    it('should apply gravity to objects', () => {
      const obj = engine.createObject({
        id: 'falling-obj',
        position: { x: 0, y: 5, z: 0 },
        mass: 1
      });

      engine.addObject(obj);

      const initialState = engine.getState();
      const initialY = initialState.objects[0].position.y;

      engine.step(0.1);

      const afterState = engine.getState();
      const afterY = afterState.objects[0].position.y;

      expect(afterY).toBeLessThan(initialY);
    });

    it('should not move static objects', () => {
      const obj = engine.createObject({
        id: 'static-obj',
        position: { x: 0, y: 5, z: 0 },
        isStatic: true
      });

      engine.addObject(obj);

      const initialY = obj.position.y;
      engine.step(0.1);

      const afterObj = engine.getObject('static-obj');
      expect(afterObj?.position.y).toBe(initialY);
    });
  });

  describe('Ground Collision', () => {
    it('should stop at ground (y = 0)', () => {
      const obj = engine.createObject({
        id: 'ground-obj',
        position: { x: 0, y: 1, z: 0 },
        mass: 1
      });

      engine.addObject(obj);

      // Step until hitting ground
      for (let i = 0; i < 100; i++) {
        engine.step(0.016);
      }

      const finalObj = engine.getObject('ground-obj');
      expect(finalObj?.position.y).toBeGreaterThanOrEqual(0);
      expect(finalObj?.position.y).toBeLessThanOrEqual(0.6);
    });

    it('should bounce when hitting ground', () => {
      const obj = engine.createObject({
        id: 'bounce-obj',
        position: { x: 0, y: 2, z: 0 },
        mass: 1
      });

      engine.addObject(obj);

      const beforeImpact = engine.getState();
      const velocityBefore = beforeImpact.objects[0].velocity.y;

      // Step until hitting ground
      for (let i = 0; i < 100; i++) {
        engine.step(0.016);
      }

      const afterImpact = engine.getState();
      const velocityAfter = afterImpact.objects[0].velocity.y;

      // Velocity should reverse (bounce)
      expect(velocityBefore).toBeLessThan(0); // Falling
      expect(velocityAfter).toBeGreaterThanOrEqual(0); // Bouncing up or stopped
    });
  });

  describe('Object Collision', () => {
    it('should detect collision between objects', () => {
      const obj1 = engine.createObject({
        id: 'obj1',
        position: { x: 0, y: 0.5, z: 0 },
        size: { x: 1, y: 1, z: 1 },
        mass: 1
      });

      const obj2 = engine.createObject({
        id: 'obj2',
        position: { x: 0.8, y: 0.5, z: 0 },
        size: { x: 1, y: 1, z: 1 },
        mass: 1
      });

      engine.addObject(obj1);
      engine.addObject(obj2);

      // Give obj2 velocity toward obj1
      obj2.velocity.x = -1;

      engine.step(0.016);

      // Objects should have bounced
      const obj1After = engine.getObject('obj1');
      const obj2After = engine.getObject('obj2');

      expect(obj1After?.velocity.x).not.toBe(0);
      expect(obj2After?.velocity.x).not.toBe(-1);
    });
  });

  describe('Forces', () => {
    it('should apply force to object', () => {
      const obj = engine.createObject({
        id: 'force-obj',
        position: { x: 0, y: 0, z: 0 },
        mass: 1
      });

      engine.addObject(obj);
      engine.applyForce({
        id: 'push',
        objectId: 'force-obj',
        vector: { x: 10, y: 0, z: 0 },
        type: 'applied'
      });

      engine.step(0.1);

      const afterObj = engine.getObject('force-obj');
      expect(afterObj?.velocity.x).toBeGreaterThan(0);
    });

    it('should respect mass (F = ma)', () => {
      const lightObj = engine.createObject({
        id: 'light',
        position: { x: 0, y: 0, z: 0 },
        mass: 1
      });

      const heavyObj = engine.createObject({
        id: 'heavy',
        position: { x: 0, y: 0, z: 2 },
        mass: 10
      });

      engine.addObject(lightObj);
      engine.addObject(heavyObj);

      const force = { x: 10, y: 0, z: 0 };

      engine.applyForce({
        id: 'push-light',
        objectId: 'light',
        vector: force,
        type: 'applied'
      });

      engine.applyForce({
        id: 'push-heavy',
        objectId: 'heavy',
        vector: force,
        type: 'applied'
      });

      engine.step(0.1);

      const lightAfter = engine.getObject('light');
      const heavyAfter = engine.getObject('heavy');

      expect(lightAfter!.velocity.x).toBeGreaterThan(heavyAfter!.velocity.x);
    });
  });

  describe('Constraints', () => {
    it('should fix object at position', () => {
      const obj = engine.createObject({
        id: 'fixed-obj',
        position: { x: 0, y: 5, z: 0 },
        mass: 1
      });

      engine.addObject(obj);

      engine.addConstraint({
        id: 'fix',
        type: 'fixed',
        objectA: 'fixed-obj',
        position: { x: 0, y: 5, z: 0 },
        strength: 1
      });

      engine.step(0.1);

      const afterObj = engine.getObject('fixed-obj');
      expect(afterObj?.position.x).toBe(0);
      expect(afterObj?.position.y).toBe(5);
      expect(afterObj?.position.z).toBe(0);
    });
  });

  describe('Prediction', () => {
    it('should predict future states', () => {
      const obj = engine.createObject({
        id: 'predict-obj',
        position: { x: 0, y: 2, z: 0 },
        mass: 1
      });

      engine.addObject(obj);

      const predictions = engine.predict(10);

      expect(predictions).toHaveLength(10);

      // Object should fall
      const lastY = predictions[predictions.length - 1].objects[0].position.y;
      expect(lastY).toBeLessThan(2);
    });

    it('should not modify current state when predicting', () => {
      const obj = engine.createObject({
        id: 'predict-obj',
        position: { x: 0, y: 2, z: 0 },
        mass: 1
      });

      engine.addObject(obj);

      const initialY = obj.position.y;
      engine.predict(10);

      const currentObj = engine.getObject('predict-obj');
      expect(currentObj?.position.y).toBe(initialY);
    });
  });

  describe('State Management', () => {
    it('should get current state', () => {
      const obj = engine.createObject({
        id: 'state-obj',
        position: { x: 1, y: 2, z: 3 }
      });

      engine.addObject(obj);
      const state = engine.getState();

      expect(state.objects).toHaveLength(1);
      expect(state.objects[0].id).toBe('state-obj');
    });

    it('should reset simulation', () => {
      const obj = engine.createObject({
        id: 'reset-obj',
        position: { x: 0, y: 5, z: 0 }
      });

      engine.addObject(obj);
      engine.reset();

      const state = engine.getState();
      expect(state.objects).toHaveLength(0);
    });
  });

  describe('createObject', () => {
    it('should create object with default values', () => {
      const obj = engine.createObject({});

      expect(obj.id).toBeDefined();
      expect(obj.position.y).toBe(5); // Default height
      expect(obj.mass).toBe(1);
      expect(obj.isStatic).toBe(false);
    });

    it('should create object with custom values', () => {
      const obj = engine.createObject({
        id: 'custom-obj',
        position: { x: 1, y: 2, z: 3 },
        mass: 5,
        shape: 'sphere'
      });

      expect(obj.id).toBe('custom-obj');
      expect(obj.position.x).toBe(1);
      expect(obj.mass).toBe(5);
      expect(obj.shape).toBe('sphere');
    });
  });

  describe('Friction', () => {
    it('should apply friction to sliding object', () => {
      const obj = engine.createObject({
        id: 'slide-obj',
        position: { x: 0, y: 0.1, z: 0 },
        mass: 1
      });

      engine.addObject(obj);
      obj.velocity.x = 10;

      const initialVelX = obj.velocity.x;

      // Step multiple times
      for (let i = 0; i < 10; i++) {
        engine.step(0.016);
      }

      const finalObj = engine.getObject('slide-obj');
      expect(finalObj!.velocity.x).toBeLessThan(initialVelX);
    });
  });

  describe('Frame Counting', () => {
    it('should increment frame count', () => {
      const state1 = engine.getState();
      const frame1 = state1.frame;

      engine.step();

      const state2 = engine.getState();
      const frame2 = state2.frame;

      expect(frame2).toBe(frame1 + 1);
    });
  });

  describe('Integration', () => {
    it('should simulate falling and bouncing', () => {
      const obj = engine.createObject({
        id: 'bounce-test',
        position: { x: 0, y: 5, z: 0 },
        mass: 1
      });

      engine.addObject(obj);

      // Let it fall and bounce
      for (let i = 0; i < 200; i++) {
        engine.step(0.016);
      }

      const finalObj = engine.getObject('bounce-test');

      // Should be near ground
      expect(finalObj!.position.y).toBeLessThan(1);

      // Should have small velocity (settled)
      expect(Math.abs(finalObj!.velocity.y)).toBeLessThan(0.5);
    });
  });
});

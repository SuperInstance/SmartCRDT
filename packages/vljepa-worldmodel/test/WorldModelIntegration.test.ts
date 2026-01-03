/**
 * Integration Tests for VL-JEPA World Model
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PhysicsEngine } from '../src/physics/PhysicsEngine.js';
import { ObjectPermanence } from '../src/physics/ObjectPermanence.js';
import { CausalReasoning } from '../src/reasoning/CausalReasoning.js';
import { AffordanceDetector } from '../src/interaction/AffordanceDetector.js';
import { CounterfactualReasoner } from '../src/reasoning/Counterfactual.js';
import { WorldRenderer } from '../src/world/WorldRenderer.js';
import { TemporalModel } from '../src/temporal/TemporalModel.js';
import { SpatialReasoner } from '../src/spatial/SpatialReasoning.js';
import { IntuitivePhysics } from '../src/reasoning/IntuitivePhysics.js';
import type { WorldState, UIElement } from '../src/types.js';

describe('World Model Integration', () => {
  describe('Physics + Object Permanence', () => {
    it('should track falling object through occlusion', () => {
      const physics = new PhysicsEngine();
      const permanence = new ObjectPermanence();

      const obj = physics.createObject({
        id: 'falling-obj',
        position: { x: 0, y: 5, z: 0 },
        mass: 1
      });

      physics.addObject(obj);

      // Observe falling
      for (let i = 0; i < 10; i++) {
        const state = physics.step();
        const physObj = state.objects.find(o => o.id === 'falling-obj');

        permanence.updateObject('falling-obj', {
          timestamp: Date.now() + i * 16,
          position: physObj!.position,
          velocity: physObj!.velocity,
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          appearance: { color: 'red', size: { x: 1, y: 1, z: 1 }, shape: 'box', features: [] }
        }, true);
      }

      // Object becomes occluded
      const lastState = physics.getState();
      const lastObj = lastState.objects.find(o => o.id === 'falling-obj')!;

      permanence.updateObject('falling-obj', {
        timestamp: Date.now() + 200,
        position: lastObj.position,
        velocity: lastObj.velocity,
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        appearance: { color: 'red', size: { x: 1, y: 1, z: 1 }, shape: 'box', features: [] }
      }, false);

      // Should still be tracked
      expect(permanence.isTracking('falling-obj')).toBe(true);

      // Should predict position
      const predicted = permanence.predictReappearance('falling-obj');
      expect(predicted).toBeDefined();
    });

    it('should predict motion after object disappears', () => {
      const physics = new PhysicsEngine();
      const permanence = new ObjectPermanence();

      const obj = physics.createObject({
        id: 'moving-obj',
        position: { x: 0, y: 0.1, z: 0 },
        mass: 1
      });

      obj.velocity.x = 2;
      physics.addObject(obj);

      // Track motion
      const snapshots: any[] = [];
      for (let i = 0; i < 5; i++) {
        const state = physics.step(0.01);
        const physObj = state.objects.find(o => o.id === 'moving-obj')!;

        const snapshot = {
          timestamp: Date.now() + i * 10,
          position: physObj.position,
          velocity: physObj.velocity,
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          appearance: { color: 'red', size: { x: 1, y: 1, z: 1 }, shape: 'box', features: [] }
        };

        snapshots.push(snapshot);
        permanence.updateObject('moving-obj', snapshot, true);
      }

      // Object disappears
      permanence.updateObject('moving-obj', {
        ...snapshots[snapshots.length - 1],
        timestamp: Date.now() + 100
      }, false);

      // Predict trajectory
      const trajectory = permanence.predictTrajectory('moving-obj', 500);
      expect(trajectory).not.toBeNull();
      expect(trajectory!.length).toBeGreaterThan(1);
    });
  });

  describe('Physics + Causal Reasoning', () => {
    it('should learn causal relationships from collisions', () => {
      const physics = new PhysicsEngine();
      const causal = new CausalReasoning();

      const obj1 = physics.createObject({ id: 'A', position: { x: 0, y: 0.5, z: 0 }, mass: 1 });
      const obj2 = physics.createObject({ id: 'B', position: { x: 2, y: 0.5, z: 0 }, mass: 1 });

      physics.addObject(obj1);
      physics.addObject(obj2);

      const beforeState = physics.getState();

      // Push A toward B
      obj1.velocity.x = 5;

      for (let i = 0; i < 10; i++) {
        physics.step(0.01);
      }

      const afterState = physics.getState();

      // Learn from interaction
      causal.learnFromObservations(
        beforeState as any,
        afterState as any,
        { type: 'push', target: 'A', parameters: {}, timestamp: Date.now() }
      );

      const model = causal.getModel();
      expect(model.relationships.length).toBeGreaterThan(0);
    });
  });

  describe('Spatial + Temporal', () => {
    it('should track spatial relations over time', () => {
      const spatial = new SpatialReasoner();
      const temporal = new TemporalModel();

      const worldState: WorldState = {
        objects: [
          { id: 'obj1', type: 'box', position: { x: 0, y: 1, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, properties: {}, visible: true, occluded: false },
          { id: 'obj2', type: 'box', position: { x: 2, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, properties: {}, visible: true, occluded: false }
        ],
        relations: [],
        events: [],
        timestamp: Date.now(),
        confidence: 1
      };

      temporal.addState(worldState);

      // Determine spatial relation
      const obj1 = worldState.objects[0];
      const obj2 = worldState.objects[1];

      const relation = spatial.determineRelation(obj1, obj2);
      expect(relation).not.toBeNull();
    });

    it('should predict motion from history', () => {
      const temporal = new TemporalModel();

      for (let i = 0; i < 5; i++) {
        const state: WorldState = {
          objects: [{
            id: 'obj1',
            type: 'box',
            position: { x: i * 0.5, y: 1, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            properties: {},
            visible: true,
            occluded: false
          }],
          relations: [],
          events: [],
          timestamp: Date.now() + i * 100,
          confidence: 1
        };

        temporal.addState(state);
      }

      const prediction = temporal.predictMotion('obj1', 1000);
      expect(prediction).not.toBeNull();
      expect(prediction!.positions.length).toBeGreaterThan(1);
    });
  });

  describe('Intuitive Physics + World Model', () => {
    it('should judge object stability', () => {
      const intuitive = new IntuitivePhysics();

      const worldState: WorldState = {
        objects: [
          { id: 'stable', type: 'box', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, properties: {}, visible: true, occluded: false },
          { id: 'unstable', type: 'box', position: { x: 0, y: 5, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, properties: {}, visible: true, occluded: false }
        ],
        relations: [],
        events: [],
        timestamp: Date.now(),
        confidence: 1
      };

      const stableJudgment = intuitive.judgeStability(worldState.objects[0], worldState.objects);
      const unstableJudgment = intuitive.judgeStability(worldState.objects[1], worldState.objects);

      expect(stableJudgment.type).toBe('stable');
      expect(unstableJudgment.type).toBe('falling');
    });

    it('should predict landing position', () => {
      const intuitive = new IntuitivePhysics();

      const fallingObject: any = {
        id: 'falling',
        type: 'box',
        position: { x: 2, y: 5, z: 3 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        properties: {},
        visible: true,
        occluded: false
      };

      const worldState: WorldState = {
        objects: [fallingObject],
        relations: [],
        events: [],
        timestamp: Date.now(),
        confidence: 1
      };

      const landing = intuitive.predictLanding(fallingObject, worldState.objects);
      expect(landing).toBeDefined();
      expect(landing!.y).toBe(0); // Should land on ground
    });
  });

  describe('Affordance + Counterfactual', () => {
    it('should predict interaction outcomes', () => {
      const affordance = new AffordanceDetector();
      const counterfactual = new CounterfactualReasoner();

      const buttonElement = affordance.createElement({
        semantic: 'submit button',
        id: 'btn1'
      });

      const detected = affordance.detectAffordances(buttonElement);
      expect(detected.length).toBeGreaterThan(0);

      // Create world state with button
      const worldState: WorldState = {
        objects: [{
          id: 'btn1',
          type: 'button',
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          properties: {},
          visible: true,
          occluded: false
        }],
        relations: [],
        events: [],
        timestamp: Date.now(),
        confidence: 1
      };

      // Predict click outcome
      const outcome = counterfactual.whatIf(worldState, {
        type: 'click',
        target: 'btn1',
        parameters: {},
        timestamp: Date.now()
      });

      expect(outcome).toBeDefined();
    });
  });

  describe('Complete Pipeline', () => {
    it('should process observation through entire pipeline', () => {
      // Initialize components
      const physics = new PhysicsEngine();
      const permanence = new ObjectPermanence();
      const causal = new CausalReasoning();
      const spatial = new SpatialReasoner();
      const temporal = new TemporalModel();
      const intuitive = new IntuitivePhysics();
      const renderer = new WorldRenderer();

      // Create objects
      const obj1 = physics.createObject({ id: 'box1', position: { x: 0, y: 5, z: 0 }, mass: 1 });
      const obj2 = physics.createObject({ id: 'box2', position: { x: 2, y: 0, z: 0 }, mass: 2, isStatic: true });

      physics.addObject(obj1);
      physics.addObject(obj2);

      // Simulate
      const state = physics.step();

      // Track with permanence
      for (const obj of state.objects) {
        permanence.updateObject(obj.id, {
          timestamp: Date.now(),
          position: obj.position,
          velocity: obj.velocity,
          rotation: obj.rotation,
          appearance: { color: 'red', size: { x: 1, y: 1, z: 1 }, shape: 'box', features: [] }
        }, true);
      }

      // Determine spatial relations
      const worldObjs = state.objects.map(o => ({
        id: o.id,
        type: 'object',
        position: o.position,
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        properties: {},
        visible: true,
        occluded: false
      }));

      for (let i = 0; i < worldObjs.length; i++) {
        for (let j = i + 1; j < worldObjs.length; j++) {
          const relation = spatial.determineRelation(worldObjs[i], worldObjs[j]);
          if (relation) {
            causal.addVariable({
              id: worldObjs[i].id,
              name: worldObjs[i].id,
              type: 'continuous',
              value: worldObjs[i].position.y,
              parents: [],
              children: []
            });
          }
        }
      }

      // Judge stability
      for (const obj of worldObjs) {
        const judgment = intuitive.judgeStability(obj, worldObjs);
        expect(judgment).toBeDefined();
      }

      // Create world state
      const worldState: WorldState = {
        objects: worldObjs,
        relations: [],
        events: [],
        timestamp: Date.now(),
        confidence: 0.9
      };

      temporal.addState(worldState);

      // Render
      const rendered = renderer.render(worldState);
      expect(rendered.currentState.objects.length).toBe(2);
    });
  });

  describe('Multi-Object Scenarios', () => {
    it('should handle stack of objects', () => {
      const physics = new PhysicsEngine();
      const intuitive = new IntuitivePhysics();

      // Create stack
      const objects: any[] = [];
      for (let i = 0; i < 3; i++) {
        const obj = physics.createObject({
          id: `stack-${i}`,
          position: { x: 0, y: i * 1.1, z: 0 },
          mass: 1
        });
        physics.addObject(obj);
        objects.push({
          id: obj.id,
          type: 'box',
          position: obj.position,
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          properties: {},
          visible: true,
          occluded: false
        });
      }

      // Judge stack stability
      const judgment = intuitive.judgeStackStability(objects);
      expect(judgment.stable).toBe(true);
    });

    it('should predict collision outcome', () => {
      const physics = new PhysicsEngine();
      const counterfactual = new CounterfactualReasoner();

      const obj1 = physics.createObject({ id: 'ball1', position: { x: -2, y: 0.5, z: 0 }, mass: 1 });
      const obj2 = physics.createObject({ id: 'ball2', position: { x: 2, y: 0.5, z: 0 }, mass: 1 });

      obj1.velocity.x = 3;

      physics.addObject(obj1);
      physics.addObject(obj2);

      const beforeState: WorldState = {
        objects: [
          { id: 'ball1', type: 'sphere', position: obj1.position, rotation: { x: 0, y: 0, z: 0, w: 1 }, properties: {}, visible: true, occluded: false },
          { id: 'ball2', type: 'sphere', position: obj2.position, rotation: { x: 0, y: 0, z: 0, w: 1 }, properties: {}, visible: true, occluded: false }
        ],
        relations: [],
        events: [],
        timestamp: Date.now(),
        confidence: 1
      };

      // Predict collision outcome
      const outcome = counterfactual.whatIf(beforeState, {
        type: 'move',
        target: 'ball1',
        parameters: { delta: { x: 1, y: 0, z: 0 } },
        timestamp: Date.now()
      }, 2000);

      expect(outcome).toBeDefined();
    });
  });

  describe('Occlusion Handling', () => {
    it('should maintain object tracking through occlusion', () => {
      const permanence = new ObjectPermanence();
      const spatial = new SpatialReasoner();

      const objectId = 'occluded-obj';
      const position = { x: 1, y: 1, z: 1 };

      // Object visible
      permanence.updateObject(objectId, {
        timestamp: Date.now(),
        position,
        velocity: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        appearance: { color: 'red', size: { x: 1, y: 1, z: 1 }, shape: 'box', features: [] }
      }, true);

      // Object occluded
      permanence.updateObject(objectId, {
        timestamp: Date.now() + 1000,
        position,
        velocity: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        appearance: { color: 'red', size: { x: 1, y: 1, z: 1 }, shape: 'box', features: [] }
      }, false);

      // Still tracked
      expect(permanence.isTracking(objectId)).toBe(true);

      // Can predict position
      const predicted = permanence.predictReappearance(objectId);
      expect(predicted).toEqual(position);
    });
  });

  describe('Performance', () => {
    it('should handle multiple objects efficiently', () => {
      const physics = new PhysicsEngine();
      const permanence = new ObjectPermanence();

      // Add many objects
      for (let i = 0; i < 20; i++) {
        const obj = physics.createObject({
          id: `obj-${i}`,
          position: { x: Math.random() * 10, y: Math.random() * 5, z: 0 },
          mass: 1
        });
        physics.addObject(obj);
      }

      // Simulate multiple steps
      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        physics.step(0.016);
      }
      const endTime = Date.now();

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing objects gracefully', () => {
      const physics = new PhysicsEngine();
      const obj = physics.getObject('nonexistent');
      expect(obj).toBeUndefined();
    });

    it('should handle invalid affordances', () => {
      const detector = new AffordanceDetector();
      const element = detector.createElement({ semantic: 'invalid affordance test' });

      const affordances = detector.detectAffordances(element);
      // Should not crash, return empty or minimal affordances
      expect(Array.isArray(affordances)).toBe(true);
    });
  });
});

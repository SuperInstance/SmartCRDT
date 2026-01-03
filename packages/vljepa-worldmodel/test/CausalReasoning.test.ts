/**
 * Tests for CausalReasoning
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CausalReasoning } from '../src/reasoning/CausalReasoning.js';
import type { CausalVariable, WorldState, Action } from '../src/types.js';

describe('CausalReasoning', () => {
  let reasoning: CausalReasoning;

  beforeEach(() => {
    reasoning = new CausalReasoning();
  });

  describe('Constructor', () => {
    it('should create empty model', () => {
      const model = reasoning.getModel();
      expect(model.variables).toHaveLength(0);
      expect(model.relationships).toHaveLength(0);
    });
  });

  describe('Variables', () => {
    it('should add variable', () => {
      const variable: CausalVariable = {
        id: 'var1',
        name: 'Variable 1',
        type: 'continuous',
        value: 5,
        parents: [],
        children: []
      };

      reasoning.addVariable(variable);
      const model = reasoning.getModel();

      expect(model.variables).toHaveLength(1);
      expect(model.variables[0].id).toBe('var1');
    });

    it('should update existing variable', () => {
      const variable: CausalVariable = {
        id: 'var1',
        name: 'Variable 1',
        type: 'continuous',
        value: 5,
        parents: [],
        children: []
      };

      reasoning.addVariable(variable);

      variable.value = 10;
      reasoning.addVariable(variable);

      const model = reasoning.getModel();
      expect(model.variables[0].value).toBe(10);
    });
  });

  describe('Relationships', () => {
    it('should add relationship', () => {
      reasoning.addRelationship({
        id: 'rel1',
        cause: 'A',
        effect: 'B',
        strength: 0.8,
        delay: 100,
        type: 'probabilistic'
      });

      const model = reasoning.getModel();
      expect(model.relationships).toHaveLength(1);
      expect(model.relationships[0].cause).toBe('A');
    });

    it('should update existing relationship', () => {
      reasoning.addRelationship({
        id: 'rel1',
        cause: 'A',
        effect: 'B',
        strength: 0.5,
        delay: 100,
        type: 'probabilistic'
      });

      reasoning.addRelationship({
        id: 'rel2',
        cause: 'A',
        effect: 'B',
        strength: 0.9,
        delay: 200,
        type: 'deterministic'
      });

      const model = reasoning.getModel();
      expect(model.relationships).toHaveLength(1);
      expect(model.relationships[0].strength).toBe(0.9);
    });

    it('should update variable parents/children', () => {
      const varA: CausalVariable = {
        id: 'A',
        name: 'A',
        type: 'continuous',
        value: 0,
        parents: [],
        children: []
      };

      const varB: CausalVariable = {
        id: 'B',
        name: 'B',
        type: 'continuous',
        value: 0,
        parents: [],
        children: []
      };

      reasoning.addVariable(varA);
      reasoning.addVariable(varB);

      reasoning.addRelationship({
        id: 'rel1',
        cause: 'A',
        effect: 'B',
        strength: 0.8,
        delay: 100,
        type: 'probabilistic'
      });

      const model = reasoning.getModel();
      expect(model.variables[0].children).toContain('B');
      expect(model.variables[1].parents).toContain('A');
    });
  });

  describe('Effect Prediction', () => {
    beforeEach(() => {
      reasoning.addRelationship({
        id: 'rel1',
        cause: 'push',
        effect: 'move',
        strength: 0.9,
        delay: 50,
        type: 'deterministic'
      });

      reasoning.addRelationship({
        id: 'rel2',
        cause: 'push',
        effect: 'fall',
        strength: 0.3,
        delay: 100,
        type: 'probabilistic'
      });
    });

    it('should predict effects of cause', () => {
      const predictions = reasoning.predictEffect('push');

      expect(predictions).toHaveLength(2);
      expect(predictions[0].effect).toBe('move');
      expect(predictions[0].probability).toBeGreaterThan(predictions[1].probability);
    });

    it('should return empty array for unknown cause', () => {
      const predictions = reasoning.predictEffect('unknown');
      expect(predictions).toHaveLength(0);
    });
  });

  describe('Cause Attribution', () => {
    beforeEach(() => {
      reasoning.addRelationship({
        id: 'rel1',
        cause: 'gravity',
        effect: 'fall',
        strength: 0.95,
        delay: 0,
        type: 'deterministic'
      });

      reasoning.addRelationship({
        id: 'rel2',
        cause: 'push',
        effect: 'fall',
        strength: 0.3,
        delay: 100,
        type: 'probabilistic'
      });
    });

    it('should attribute causes to effect', () => {
      const attributions = reasoning.attributeCause('fall');

      expect(attributions).toHaveLength(2);
      expect(attributions[0].cause).toBe('gravity');
      expect(attributions[0].probability).toBeGreaterThan(attributions[1].probability);
    });

    it('should return empty array for unknown effect', () => {
      const attributions = reasoning.attributeCause('unknown');
      expect(attributions).toHaveLength(0);
    });
  });

  describe('Root Cause Analysis', () => {
    beforeEach(() => {
      // A -> B -> C chain
      reasoning.addRelationship({
        id: 'rel1',
        cause: 'A',
        effect: 'B',
        strength: 1,
        delay: 100,
        type: 'deterministic'
      });

      reasoning.addRelationship({
        id: 'rel2',
        cause: 'B',
        effect: 'C',
        strength: 1,
        delay: 100,
        type: 'deterministic'
      });

      // D -> C (another cause of C)
      reasoning.addRelationship({
        id: 'rel3',
        cause: 'D',
        effect: 'C',
        strength: 1,
        delay: 100,
        type: 'deterministic'
      });
    });

    it('should find root causes', () => {
      const rootCauses = reasoning.findRootCauses(['C']);
      expect(rootCauses).toContain('A');
      expect(rootCauses).toContain('D');
    });

    it('should handle chain', () => {
      const rootCauses = reasoning.findRootCauses(['B']);
      expect(rootCauses).toEqual(['A']);
    });
  });

  describe('Effect Propagation', () => {
    beforeEach(() => {
      // A -> B -> C
      reasoning.addRelationship({
        id: 'rel1',
        cause: 'A',
        effect: 'B',
        strength: 1,
        delay: 100,
        type: 'deterministic'
      });

      reasoning.addRelationship({
        id: 'rel2',
        cause: 'B',
        effect: 'C',
        strength: 1,
        delay: 100,
        type: 'deterministic'
      });

      // A -> D (branch)
      reasoning.addRelationship({
        id: 'rel3',
        cause: 'A',
        effect: 'D',
        strength: 1,
        delay: 100,
        type: 'deterministic'
      });
    });

    it('should find all effects of cause', () => {
      const effects = reasoning.findAllEffects('A');
      expect(effects).toContain('B');
      expect(effects).toContain('C');
      expect(effects).toContain('D');
    });
  });

  describe('Causal Path', () => {
    beforeEach(() => {
      reasoning.addRelationship({
        id: 'rel1',
        cause: 'A',
        effect: 'B',
        strength: 1,
        delay: 100,
        type: 'deterministic'
      });

      reasoning.addRelationship({
        id: 'rel2',
        cause: 'B',
        effect: 'C',
        strength: 1,
        delay: 100,
        type: 'deterministic'
      });
    });

    it('should find path between variables', () => {
      const path = reasoning.getCausalPath('A', 'C');
      expect(path).toEqual(['A', 'B', 'C']);
    });

    it('should return null for disconnected variables', () => {
      const path = reasoning.getCausalPath('A', 'D');
      expect(path).toBeNull();
    });
  });

  describe('Delay Estimation', () => {
    beforeEach(() => {
      reasoning.addRelationship({
        id: 'rel1',
        cause: 'push',
        effect: 'move',
        strength: 0.8,
        delay: 150,
        type: 'deterministic'
      });
    });

    it('should estimate effect delay', () => {
      const delay = reasoning.estimateDelay('push', 'move');
      expect(delay).toBe(150);
    });

    it('should return null for non-existent relationship', () => {
      const delay = reasoning.estimateDelay('push', 'unknown');
      expect(delay).toBeNull();
    });
  });

  describe('Relationship Strength Update', () => {
    beforeEach(() => {
      reasoning.addRelationship({
        id: 'rel1',
        cause: 'A',
        effect: 'B',
        strength: 0.5,
        delay: 100,
        type: 'probabilistic'
      });
    });

    it('should increase strength on correct prediction', () => {
      reasoning.updateRelationshipStrength('A', 'B', true, true);

      const model = reasoning.getModel();
      expect(model.relationships[0].strength).toBeGreaterThan(0.5);
    });

    it('should decrease strength on incorrect prediction', () => {
      reasoning.updateRelationshipStrength('A', 'B', true, false);

      const model = reasoning.getModel();
      expect(model.relationships[0].strength).toBeLessThan(0.5);
    });
  });

  describe('Learning from Observations', () => {
    it('should learn from action-based changes', () => {
      const beforeState: WorldState = {
        objects: [{ id: 'obj1', type: 'box', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, properties: {}, visible: true, occluded: false }],
        relations: [],
        events: [],
        timestamp: Date.now(),
        confidence: 1
      };

      const afterState: WorldState = {
        objects: [{ id: 'obj1', type: 'box', position: { x: 1, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, properties: {}, visible: true, occluded: false }],
        relations: [],
        events: [],
        timestamp: Date.now() + 100,
        confidence: 1
      };

      const action: Action = {
        type: 'move',
        target: 'obj1',
        parameters: {},
        timestamp: Date.now()
      };

      reasoning.learnFromObservations(beforeState, afterState, action);

      const model = reasoning.getModel();
      expect(model.relationships.length).toBeGreaterThan(0);
    });
  });

  describe('Export', () => {
    it('should export causal graph as DOT', () => {
      reasoning.addVariable({
        id: 'A',
        name: 'Variable A',
        type: 'continuous',
        value: 0,
        parents: [],
        children: []
      });

      reasoning.addVariable({
        id: 'B',
        name: 'Variable B',
        type: 'continuous',
        value: 0,
        parents: [],
        children: []
      });

      reasoning.addRelationship({
        id: 'rel1',
        cause: 'A',
        effect: 'B',
        strength: 0.8,
        delay: 100,
        type: 'deterministic'
      });

      const dot = reasoning.exportCausalGraph();

      expect(dot).toContain('digraph');
      expect(dot).toContain('A');
      expect(dot).toContain('B');
      expect(dot).toContain('->');
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      reasoning.addVariable({
        id: 'A',
        name: 'A',
        type: 'continuous',
        value: 0,
        parents: [],
        children: []
      });

      reasoning.addRelationship({
        id: 'rel1',
        cause: 'A',
        effect: 'B',
        strength: 0.5,
        delay: 100,
        type: 'probabilistic'
      });

      reasoning.addRelationship({
        id: 'rel2',
        cause: 'A',
        effect: 'C',
        strength: 0.8,
        delay: 100,
        type: 'probabilistic'
      });
    });

    it('should return statistics', () => {
      const stats = reasoning.getStats();

      expect(stats.variableCount).toBe(1);
      expect(stats.relationshipCount).toBe(2);
      expect(stats.avgRelationshipStrength).toBe(0.65);
    });
  });

  describe('Reset', () => {
    it('should clear model', () => {
      reasoning.addVariable({
        id: 'A',
        name: 'A',
        type: 'continuous',
        value: 0,
        parents: [],
        children: []
      });

      reasoning.reset();

      const model = reasoning.getModel();
      expect(model.variables).toHaveLength(0);
      expect(model.relationships).toHaveLength(0);
    });
  });
});

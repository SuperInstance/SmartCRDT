/**
 * Tests for CounterfactualReasoner
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CounterfactualReasoner } from '../src/reasoning/Counterfactual.js';
import type { WorldState, Action, CounterfactualQuery } from '../src/types.js';

describe('CounterfactualReasoner', () => {
  let reasoner: CounterfactualReasoner;

  beforeEach(() => {
    reasoner = new CounterfactualReasoner();
  });

  const createWorldState = (objects: any[] = []): WorldState => ({
    objects: objects.length > 0 ? objects : [{
      id: 'obj1',
      type: 'box',
      position: { x: 0, y: 1, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      properties: {},
      visible: true,
      occluded: false
    }],
    relations: [],
    events: [],
    timestamp: Date.now(),
    confidence: 1
  });

  const createAction = (type: Action['type'], target: string, params: any = {}): Action => ({
    type,
    target,
    parameters: params,
    timestamp: Date.now()
  });

  describe('Constructor', () => {
    it('should create reasoner', () => {
      expect(reasoner).toBeDefined();
    });
  });

  describe('What-If Scenarios', () => {
    it('should predict outcome of action', async () => {
      const state = createWorldState();
      const action = createAction('move', 'obj1', { delta: { x: 1, y: 0, z: 0 } });

      const outcome = await reasoner.whatIf(state, action);

      expect(outcome).toBeDefined();
      expect(outcome.objects.length).toBe(1);
    });

    it('should move object', async () => {
      const state = createWorldState();
      const action = createAction('move', 'obj1', { delta: { x: 5, y: 0, z: 0 } });

      const outcome = await reasoner.whatIf(state, action);

      const obj = outcome.objects.find(o => o.id === 'obj1');
      expect(obj!.position.x).toBeGreaterThan(0);
    });

    it('should remove object', async () => {
      const state = createWorldState([{ id: 'obj1', type: 'box', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, properties: {}, visible: true, occluded: false }]);
      const action = createAction('remove', 'obj1');

      const outcome = await reasoner.whatIf(state, action);

      expect(outcome.objects.find(o => o.id === 'obj1')).toBeUndefined();
    });

    it('should add object', async () => {
      const state = createWorldState();
      const action = createAction('add', 'obj2', {
        position: { x: 1, y: 1, z: 1 }
      });

      const outcome = await reasoner.whatIf(state, action);

      expect(outcome.objects.find(o => o.id === 'obj2')).toBeDefined();
    });

    it('should hide object', async () => {
      const state = createWorldState();
      const action = createAction('hide', 'obj1');

      const outcome = await reasoner.whatIf(state, action);

      const obj = outcome.objects.find(o => o.id === 'obj1');
      expect(obj!.visible).toBe(false);
    });

    it('should show object', async () => {
      const state = createWorldState([{ id: 'obj1', type: 'box', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, properties: {}, visible: false, occluded: true }]);
      const action = createAction('show', 'obj1');

      const outcome = await reasoner.whatIf(state, action);

      const obj = outcome.objects.find(o => o.id === 'obj1');
      expect(obj!.visible).toBe(true);
    });
  });

  describe('Action Comparison', () => {
    it('should compare two actions', async () => {
      const state = createWorldState();
      const actionA = createAction('move', 'obj1', { delta: { x: 1, y: 0, z: 0 } });
      const actionB = createAction('move', 'obj1', { delta: { x: -1, y: 0, z: 0 } });

      const comparison = await reasoner.compareActions(state, actionA, actionB);

      expect(comparison.outcomeA).toBeDefined();
      expect(comparison.outcomeB).toBeDefined();
      expect(comparison.difference).toBeDefined();
    });

    it('should detect differences in outcomes', async () => {
      const state = createWorldState();
      const actionA = createAction('move', 'obj1', { delta: { x: 1, y: 0, z: 0 } });
      const actionB = createAction('move', 'obj1', { delta: { x: 2, y: 0, z: 0 } });

      const comparison = await reasoner.compareActions(state, actionA, actionB);

      expect(comparison.difference.modified.size).toBeGreaterThan(0);
    });
  });

  describe('Counterfactual Generation', () => {
    it('should generate counterfactual', async () => {
      const state = createWorldState();
      const query: CounterfactualQuery = {
        currentState: state,
        action: createAction('move', 'obj1', { delta: { x: 1, y: 0, z: 0 } }),
        counterfactualAction: createAction('move', 'obj1', { delta: { x: -1, y: 0, z: 0 } }),
        horizon: 1000,
        granularity: 100
      };

      const counterfactual = await reasoner.generateCounterfactual(query);

      expect(counterfactual.actual).toBeDefined();
      expect(counterfactual.predictedOutcome).toBeDefined();
      expect(counterfactual.difference).toBeDefined();
      expect(counterfactual.confidence).toBeGreaterThanOrEqual(0);
      expect(counterfactual.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Goal Achievement', () => {
    it('should find action to achieve goal', async () => {
      const state = createWorldState();
      const goalState = createWorldState([{
        id: 'obj1',
        type: 'box',
        position: { x: 5, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        properties: {},
        visible: true,
        occluded: false
      }]);

      const possibleActions = [
        createAction('move', 'obj1', { delta: { x: 1, y: 0, z: 0 } }),
        createAction('move', 'obj1', { delta: { x: 5, y: 0, z: 0 } }),
        createAction('move', 'obj1', { delta: { x: -1, y: 0, z: 0 } })
      ];

      const bestAction = await reasoner.findActionForGoal(state, goalState, possibleActions);

      expect(bestAction).toBeDefined();
    });
  });

  describe('State Similarity', () => {
    it('should compute similarity between states', async () => {
      const state1 = createWorldState([{ id: 'obj1', type: 'box', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, properties: {}, visible: true, occluded: false }]);
      const state2 = createWorldState([{ id: 'obj1', type: 'box', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, properties: {}, visible: true, occluded: false }]);

      // Similar states should have higher similarity
      const action = createAction('noop', '', {});
      const query: CounterfactualQuery = {
        currentState: state1,
        action,
        counterfactualAction: action,
        horizon: 100,
        granularity: 100
      };

      const counterfactual = await reasoner.generateCounterfactual(query);
      expect(counterfactual.confidence).toBeGreaterThan(0);
    });
  });

  describe('History', () => {
    it('should record actions', () => {
      const state = createWorldState();
      const action = createAction('move', 'obj1');

      reasoner.recordAction(action, state);

      const history = reasoner.getActionHistory();
      expect(history).toHaveLength(1);
    });

    it('should limit history size', () => {
      const state = createWorldState();

      for (let i = 0; i < 1100; i++) {
        const action = createAction('move', `obj${i}`);
        reasoner.recordAction(action, state);
      }

      const history = reasoner.getActionHistory();
      expect(history.length).toBeLessThanOrEqual(1000);
    });

    it('should clear history', () => {
      const state = createWorldState();
      const action = createAction('move', 'obj1');

      reasoner.recordAction(action, state);
      reasoner.clearHistory();

      expect(reasoner.getActionHistory()).toHaveLength(0);
    });
  });

  describe('Action Creation', () => {
    it('should create action', () => {
      const action = reasoner.createAction({
        type: 'move',
        target: 'obj1',
        parameters: { delta: { x: 1, y: 0, z: 0 } }
      });

      expect(action.type).toBe('move');
      expect(action.target).toBe('obj1');
      expect(action.parameters.delta).toBeDefined();
    });
  });

  describe('Physics Simulation', () => {
    it('should simulate falling', async () => {
      const state = createWorldState([{
        id: 'obj1',
        type: 'box',
        position: { x: 0, y: 5, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        properties: {},
        visible: true,
        occluded: false
      }]);

      const action = createAction('noop', '');
      const outcome = await reasoner.whatIf(state, action, 2000);

      const obj = outcome.objects.find(o => o.id === 'obj1');
      expect(obj!.position.y).toBeLessThan(5);
    });

    it('should stop at ground', async () => {
      const state = createWorldState([{
        id: 'obj1',
        type: 'box',
        position: { x: 0, y: 10, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        properties: {},
        visible: true,
        occluded: false
      }]);

      const action = createAction('noop', '');
      const outcome = await reasoner.whatIf(state, action, 5000);

      const obj = outcome.objects.find(o => o.id === 'obj1');
      expect(obj!.position.y).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Statistics', () => {
    it('should return statistics', () => {
      const state = createWorldState();
      const action = createAction('move', 'obj1');

      reasoner.recordAction(action, state);

      const stats = reasoner.getStats();
      expect(stats.totalActions).toBe(1);
      expect(stats.totalStates).toBe(1);
    });
  });

  describe('State Delta', () => {
    it('should detect added objects', async () => {
      const state = createWorldState();
      const action = createAction('add', 'obj2', { position: { x: 1, y: 1, z: 1 } });

      const query: CounterfactualQuery = {
        currentState: state,
        action: createAction('noop', ''),
        counterfactualAction: action,
        horizon: 100,
        granularity: 100
      };

      const counterfactual = await reasoner.generateCounterfactual(query);
      expect(counterfactual.difference.added).toContain('obj2');
    });

    it('should detect removed objects', async () => {
      const state = createWorldState([{
        id: 'obj1',
        type: 'box',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        properties: {},
        visible: true,
        occluded: false
      }]);

      const action = createAction('remove', 'obj1');

      const query: CounterfactualQuery = {
        currentState: state,
        action: createAction('noop', ''),
        counterfactualAction: action,
        horizon: 100,
        granularity: 100
      };

      const counterfactual = await reasoner.generateCounterfactual(query);
      expect(counterfactual.difference.removed).toContain('obj1');
    });
  });
});

/**
 * Tests for WorldRenderer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorldRenderer } from '../src/world/WorldRenderer.js';
import type { WorldState, MotionPrediction, CausalRelationship } from '../src/types.js';

describe('WorldRenderer', () => {
  let renderer: WorldRenderer;

  beforeEach(() => {
    renderer = new WorldRenderer();
  });

  const createWorldState = (): WorldState => ({
    objects: [
      {
        id: 'obj1',
        type: 'box',
        position: { x: 0, y: 1, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        properties: { color: 'red' },
        visible: true,
        occluded: false
      },
      {
        id: 'obj2',
        type: 'sphere',
        position: { x: 2, y: 0.5, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        properties: { color: 'blue' },
        visible: true,
        occluded: false
      }
    ],
    relations: [
      {
        id: 'rel1',
        subject: 'obj1',
        object: 'obj2',
        relation: 'above',
        confidence: 0.9
      }
    ],
    events: [],
    timestamp: Date.now(),
    confidence: 0.8
  });

  describe('Constructor', () => {
    it('should create with default config', () => {
      expect(renderer).toBeDefined();
      const config = renderer.getConfig();
      expect(config.format).toBe('json');
    });

    it('should create with custom config', () => {
      const custom = new WorldRenderer({
        format: 'html',
        showPredictions: false,
        detailLevel: 'minimal'
      });

      const config = custom.getConfig();
      expect(config.format).toBe('html');
      expect(config.showPredictions).toBe(false);
    });
  });

  describe('Rendering', () => {
    it('should render world state', () => {
      const state = createWorldState();
      const rendered = renderer.render(state);

      expect(rendered.currentState).toBeDefined();
      expect(rendered.currentState.objects).toHaveLength(2);
      expect(rendered.currentState.relations).toHaveLength(1);
    });

    it('should render with predictions', () => {
      const state = createWorldState();
      const predictions: MotionPrediction[] = [{
        objectId: 'obj1',
        positions: [{ x: 0, y: 1, z: 0 }, { x: 0, y: 0.5, z: 0 }],
        velocities: [{ x: 0, y: -0.5, z: 0 }, { x: 0, y: -0.5, z: 0 }],
        timestamps: [Date.now(), Date.now() + 100],
        confidence: 0.9
      }];

      const rendered = renderer.render(state, predictions);

      expect(rendered.predictions).toHaveLength(1);
    });

    it('should render with causal chains', () => {
      const state = createWorldState();
      const chains: CausalRelationship[] = [{
        id: 'chain1',
        cause: 'push',
        effect: 'move',
        strength: 0.8,
        delay: 100,
        type: 'deterministic'
      }];

      const rendered = renderer.render(state, [], chains);

      expect(rendered.causalChains).toHaveLength(1);
    });

    it('should include metadata', () => {
      const state = createWorldState();
      const rendered = renderer.render(state);

      expect(rendered.metadata.version).toBeDefined();
      expect(rendered.metadata.timestamp).toBeDefined();
      expect(rendered.metadata.confidence).toBe(state.confidence);
    });
  });

  describe('Object Rendering', () => {
    it('should render object properties', () => {
      const state = createWorldState();
      const rendered = renderer.render(state);

      const obj1 = rendered.currentState.objects.find(o => o.id === 'obj1');
      expect(obj1!.id).toBe('obj1');
      expect(obj1!.type).toBe('box');
      expect(obj1!.position.x).toBe(0);
      expect(obj1!.position.y).toBe(1);
    });

    it('should include uncertainty when enabled', () => {
      const state = createWorldState();
      state.objects[0].uncertainty = 0.3;

      const rendererWithUncertainty = new WorldRenderer({
        showUncertainty: true
      });

      const rendered = rendererWithUncertainty.render(state);
      const obj1 = rendered.currentState.objects.find(o => o.id === 'obj1');

      expect(obj1!.uncertainty).toBe(0.3);
    });

    it('should not include uncertainty when disabled', () => {
      const rendererNoUncertainty = new WorldRenderer({
        showUncertainty: false
      });

      const state = createWorldState();
      state.objects[0].uncertainty = 0.3;

      const rendered = rendererNoUncertainty.render(state);
      const obj1 = rendered.currentState.objects.find(o => o.id === 'obj1');

      expect(obj1!.uncertainty).toBeUndefined();
    });
  });

  describe('Relation Rendering', () => {
    it('should render spatial relations', () => {
      const state = createWorldState();
      const rendered = renderer.render(state);

      const rel = rendered.currentState.relations[0];
      expect(rel.subject).toBe('obj1');
      expect(rel.object).toBe('obj2');
      expect(rel.relation).toBe('above');
      expect(rel.confidence).toBe(0.9);
    });
  });

  describe('Format: JSON', () => {
    it('should format as JSON', () => {
      const state = createWorldState();
      const rendered = renderer.render(state);

      renderer.setConfig({ format: 'json' });
      const formatted = renderer.format(rendered);

      const parsed = JSON.parse(formatted);
      expect(parsed.currentState).toBeDefined();
    });
  });

  describe('Format: Graphviz', () => {
    it('should format as Graphviz DOT', () => {
      const state = createWorldState();
      const rendered = renderer.render(state);

      renderer.setConfig({ format: 'graphviz' });
      const formatted = renderer.format(rendered);

      expect(formatted).toContain('digraph');
      expect(formatted).toContain('obj1');
      expect(formatted).toContain('obj2');
      expect(formatted).toContain('->');
    });

    it('should include relation in DOT', () => {
      const state = createWorldState();
      const rendered = renderer.render(state);

      renderer.setConfig({ format: 'graphviz' });
      const formatted = renderer.format(rendered);

      expect(formatted).toContain('above');
    });
  });

  describe('Format: HTML', () => {
    it('should format as HTML', () => {
      const state = createWorldState();
      const rendered = renderer.render(state);

      renderer.setConfig({ format: 'html' });
      const formatted = renderer.format(rendered);

      expect(formatted).toContain('<!DOCTYPE html>');
      expect(formatted).toContain('<html>');
      expect(formatted).toContain('<body>');
    });

    it('should include objects in HTML', () => {
      const state = createWorldState();
      const rendered = renderer.render(state);

      renderer.setConfig({ format: 'html' });
      const formatted = renderer.format(rendered);

      expect(formatted).toContain('obj1');
      expect(formatted).toContain('box');
    });
  });

  describe('Format: Canvas', () => {
    it('should format as Canvas code', () => {
      const state = createWorldState();
      const rendered = renderer.render(state);

      renderer.setConfig({ format: 'canvas' });
      const formatted = renderer.format(rendered);

      expect(formatted).toContain('canvas');
      expect(formatted).toContain('getContext');
      expect(formatted).toContain('fillRect');
    });

    it('should draw objects in canvas', () => {
      const state = createWorldState();
      const rendered = renderer.render(state);

      renderer.setConfig({ format: 'canvas' });
      const formatted = renderer.format(rendered);

      expect(formatted).toContain('obj1');
    });
  });

  describe('Convenience Methods', () => {
    it('should render to string', () => {
      const state = createWorldState();
      const str = renderer.renderToString(state);

      expect(typeof str).toBe('string');
      expect(str).toContain('currentState');
    });
  });

  describe('Configuration', () => {
    it('should update config', () => {
      renderer.setConfig({
        format: 'html',
        detailLevel: 'detailed'
      });

      const config = renderer.getConfig();
      expect(config.format).toBe('html');
      expect(config.detailLevel).toBe('detailed');
    });

    it('should respect showPredictions config', () => {
      const state = createWorldState();
      const predictions: MotionPrediction[] = [{
        objectId: 'obj1',
        positions: [{ x: 0, y: 1, z: 0 }],
        velocities: [{ x: 0, y: 0, z: 0 }],
        timestamps: [Date.now()],
        confidence: 0.9
      }];

      renderer.setConfig({ showPredictions: false });
      const rendered = renderer.render(state, predictions);

      expect(rendered.predictions).toHaveLength(0);
    });

    it('should respect showCausality config', () => {
      const state = createWorldState();
      const chains: CausalRelationship[] = [{
        id: 'chain1',
        cause: 'A',
        effect: 'B',
        strength: 0.8,
        delay: 100,
        type: 'deterministic'
      }];

      renderer.setConfig({ showCausality: false });
      const rendered = renderer.render(state, [], chains);

      expect(rendered.causalChains).toHaveLength(0);
    });
  });

  describe('Detail Level', () => {
    it('should render minimal detail', () => {
      renderer.setConfig({ detailLevel: 'minimal' });
      renderer.setConfig({ format: 'graphviz' });

      const state = createWorldState();
      const rendered = renderer.render(state);
      const formatted = renderer.format(rendered);

      // Should not include detailed position info
      expect(formatted).toContain('obj1');
    });

    it('should render detailed info', () => {
      renderer.setConfig({ detailLevel: 'detailed' });

      const state = createWorldState();
      const rendered = renderer.render(state);

      const obj1 = rendered.currentState.objects.find(o => o.id === 'obj1');
      expect(obj1!.properties.rotation).toBeDefined();
    });
  });

  describe('Test State', () => {
    it('should create test state', () => {
      const testState = renderer.createTestState();

      expect(testState.objects).toHaveLength(2);
      expect(testState.relations).toHaveLength(1);
      expect(testState.confidence).toBeDefined();
    });
  });

  describe('Prediction Rendering', () => {
    it('should render prediction with probability', () => {
      const state = createWorldState();
      const predictions: MotionPrediction[] = [{
        objectId: 'obj1',
        positions: [
          { x: 0, y: 1, z: 0 },
          { x: 0, y: 0.5, z: 0 },
          { x: 0, y: 0, z: 0 }
        ],
        velocities: [
          { x: 0, y: -0.5, z: 0 },
          { x: 0, y: -0.5, z: 0 },
          { x: 0, y: 0, z: 0 }
        ],
        timestamps: [Date.now(), Date.now() + 100, Date.now() + 200],
        confidence: 0.85
      }];

      const rendered = renderer.render(state, predictions);

      expect(rendered.predictions).toHaveLength(1);
      expect(rendered.predictions[0].probability).toBe(0.85);
    });
  });

  describe('Causal Chain Rendering', () => {
    it('should render causal chain', () => {
      const state = createWorldState();
      const chains: CausalRelationship[] = [{
        id: 'chain1',
        cause: 'push',
        effect: 'fall',
        strength: 0.95,
        delay: 200,
        type: 'deterministic'
      }];

      const rendered = renderer.render(state, [], chains);

      const chain = rendered.causalChains[0];
      expect(chain.cause).toBe('push');
      expect(chain.effect).toBe('fall');
      expect(chain.strength).toBe(0.95);
      expect(chain.path).toEqual(['push', 'fall']);
    });
  });

  describe('Integration', () => {
    it('should render complete world', () => {
      const state = createWorldState();
      const predictions: MotionPrediction[] = [{
        objectId: 'obj1',
        positions: [{ x: 0, y: 0, z: 0 }],
        velocities: [{ x: 0, y: 0, z: 0 }],
        timestamps: [Date.now()],
        confidence: 0.9
      }];

      const chains: CausalRelationship[] = [{
        id: 'chain1',
        cause: 'A',
        effect: 'B',
        strength: 0.8,
        delay: 100,
        type: 'deterministic'
      }];

      const rendered = renderer.render(state, predictions, chains);

      expect(rendered.currentState.objects).toHaveLength(2);
      expect(rendered.predictions).toHaveLength(1);
      expect(rendered.causalChains).toHaveLength(1);
      expect(rendered.metadata).toBeDefined();
    });
  });
});

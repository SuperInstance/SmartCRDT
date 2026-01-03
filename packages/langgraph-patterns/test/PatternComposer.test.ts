/**
 * @fileoverview Tests for Pattern Composer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PatternComposer,
  createPatternComposer,
  composeAndExecute,
  type GraphPatternInstance,
  type EdgeConnection,
  type AgentNode,
} from '../src/patterns/PatternComposer.js';
import { DEFAULT_GRAPH_CONFIG } from '../src/types.js';

describe('PatternComposer', () => {
  let composer: PatternComposer;
  let testPatternInstance: GraphPatternInstance;
  let testNodes: AgentNode[];

  beforeEach(() => {
    composer = new PatternComposer();

    testNodes = [
      {
        agent_id: 'agent1',
        node_type: 'agent',
        inputs: {},
        outputs: {},
        config: { model: 'gpt-4', timeout: 5000 },
      },
      {
        agent_id: 'agent2',
        node_type: 'agent',
        inputs: {},
        outputs: {},
        config: { model: 'gpt-4', timeout: 5000 },
      },
    ];

    testPatternInstance = {
      type: 'sequential',
      config: DEFAULT_GRAPH_CONFIG,
      nodes: testNodes,
      edges: [
        { from_node: 'agent1', to_node: 'agent2' },
      ],
    };
  });

  describe('Constructor', () => {
    it('should create composer with default config', () => {
      const composer = new PatternComposer();
      expect(composer).toBeDefined();
      const composition = composer.getComposition();
      expect(composition.patterns).toHaveLength(0);
      expect(composition.config.validate).toBe(true);
    });

    it('should create composer with custom config', () => {
      const composer = new PatternComposer({
        validate: false,
        enable_visualization: false,
        max_depth: 3,
      });
      const config = composer.getComposition().config;
      expect(config.validate).toBe(false);
      expect(config.enable_visualization).toBe(false);
      expect(config.max_depth).toBe(3);
    });
  });

  describe('Pattern Management', () => {
    it('should add pattern to composition', () => {
      composer.addPattern(testPatternInstance, { x: 0, y: 0, layer: 0 }, true, false);
      const composition = composer.getComposition();
      expect(composition.patterns).toHaveLength(1);
      expect(composition.patterns[0].is_entry).toBe(true);
      expect(composition.patterns[0].is_exit).toBe(false);
    });

    it('should add pattern with custom position', () => {
      composer.addPattern(testPatternInstance, { x: 100, y: 200, layer: 2 });
      const pattern = composer.getComposition().patterns[0];
      expect(pattern.position.x).toBe(100);
      expect(pattern.position.y).toBe(200);
      expect(pattern.position.layer).toBe(2);
    });

    it('should add pattern as exit point', () => {
      composer.addPattern(testPatternInstance, undefined, false, true);
      const pattern = composer.getComposition().patterns[0];
      expect(pattern.is_exit).toBe(true);
    });

    it('should connect two patterns', () => {
      composer.addPattern(testPatternInstance);
      const pattern2: GraphPatternInstance = {
        ...testPatternInstance,
        nodes: [...testNodes],
      };
      composer.addPattern(pattern2);
      composer.connect('sequential_agent1_agent2', 'sequential_agent1_agent2');
      const composition = composer.getComposition();
      expect(composition.connections).toHaveLength(1);
    });

    it('should connect patterns with condition', () => {
      composer.addPattern(testPatternInstance);
      const pattern2: GraphPatternInstance = {
        ...testPatternInstance,
        nodes: [...testNodes],
      };
      composer.addPattern(pattern2);
      
      const condition = {
        type: 'boolean' as const,
        expression: 'status',
        value: 'active',
      };
      
      composer.connect('sequential_agent1_agent2', 'sequential_agent1_agent2', condition);
      const connection = composer.getComposition().connections[0];
      expect(connection.condition).toEqual(condition);
    });

    it('should remove pattern from composition', () => {
      composer.addPattern(testPatternInstance);
      const key = 'sequential_agent1_agent2';
      composer.removePattern(key);
      const composition = composer.getComposition();
      expect(composition.patterns).toHaveLength(0);
    });
  });

  describe('Execution', () => {
    it('should execute single pattern composition', async () => {
      composer.addPattern(testPatternInstance, undefined, true, true);
      const result = await composer.execute({ test: 'input' });
      expect(result.status).toBe('completed');
    });

    it('should execute multi-pattern composition', async () => {
      composer.addPattern(testPatternInstance, { x: 0, y: 0, layer: 0 }, true, false);
      
      const pattern2: GraphPatternInstance = {
        ...testPatternInstance,
        nodes: [...testNodes],
      };
      composer.addPattern(pattern2, { x: 100, y: 0, layer: 1 }, false, true);
      
      composer.connect('sequential_agent1_agent2', 'sequential_agent1_agent2');
      
      const result = await composer.execute({ test: 'input' });
      expect(result.status).toBe('completed');
    });

    it('should aggregate pattern outputs', async () => {
      composer.addPattern(testPatternInstance, undefined, true, true);
      const result = await composer.execute({ test: 'input' });
      expect(result.outputs.pattern_count).toBeGreaterThan(0);
    });
  });

  describe('Validation', () => {
    it('should validate correct composition', () => {
      composer.addPattern(testPatternInstance, undefined, true, true);
      const validation = composer.validate();
      expect(validation.valid).toBe(true);
    });

    it('should reject empty composition', () => {
      const validation = composer.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Composition must have at least one pattern');
    });

    it('should warn about missing entry points', () => {
      composer.addPattern(testPatternInstance, undefined, false, false);
      const validation = composer.validate();
      expect(validation.warnings).toContain('No entry points defined');
    });

    it('should warn about missing exit points', () => {
      composer.addPattern(testPatternInstance, undefined, true, false);
      const validation = composer.validate();
      expect(validation.warnings).toContain('No exit points defined');
    });

    it('should detect circular references', () => {
      const pattern1: GraphPatternInstance = {
        ...testPatternInstance,
        nodes: [testNodes[0]],
      };
      const pattern2: GraphPatternInstance = {
        ...testPatternInstance,
        nodes: [testNodes[1]],
      };
      
      composer.addPattern(pattern1);
      composer.addPattern(pattern2);
      
      // Create circular connection
      const key1 = 'sequential_agent1';
      const key2 = 'sequential_agent2';
      composer.connect(key1, key2);
      composer.connect(key2, key1);
      
      const validation = composer.validate();
      expect(validation.valid).toBe(false);
    });

    it('should warn about exceeding max depth', () => {
      const composer = new PatternComposer({ max_depth: 1 });
      
      const pattern1: GraphPatternInstance = {
        ...testPatternInstance,
        nodes: [testNodes[0]],
      };
      const pattern2: GraphPatternInstance = {
        ...testPatternInstance,
        nodes: [testNodes[1]],
      };
      
      composer.addPattern(pattern1, { layer: 0 });
      composer.addPattern(pattern2, { layer: 2 });
      composer.connect('sequential_agent1', 'sequential_agent2');
      
      const validation = composer.validate();
      expect(validation.warnings.some(w => w.includes('depth'))).toBe(true);
    });
  });

  describe('Configuration Management', () => {
    it('should update pattern configuration', () => {
      composer.addPattern(testPatternInstance);
      const key = 'sequential_agent1_agent2';
      const newConfig = { updated: true };
      composer.updatePatternConfig(key, newConfig);
      // Should not throw
      expect(true).toBe(true);
    });

    it('should clear composition', () => {
      composer.addPattern(testPatternInstance);
      composer.clear();
      const composition = composer.getComposition();
      expect(composition.patterns).toHaveLength(0);
      expect(composition.connections).toHaveLength(0);
    });
  });

  describe('Visualization', () => {
    it('should generate visualization data', () => {
      composer.addPattern(testPatternInstance, { x: 10, y: 20, layer: 1 }, true, true);
      const viz = composer.getVisualization();
      expect(viz.composition).toBeDefined();
      expect(viz.graph).toBeDefined();
      expect(viz.graph.nodes).toHaveLength(1);
      expect(viz.graph.nodes[0].position).toEqual({ x: 10, y: 20, layer: 1 });
    });

    it('should include entry/exit flags in visualization', () => {
      composer.addPattern(testPatternInstance, undefined, true, true);
      const viz = composer.getVisualization();
      expect(viz.graph.nodes[0].isEntry).toBe(true);
      expect(viz.graph.nodes[0].isExit).toBe(true);
    });

    it('should include edges in visualization', () => {
      composer.addPattern(testPatternInstance);
      const pattern2: GraphPatternInstance = {
        ...testPatternInstance,
        nodes: [...testNodes],
      };
      composer.addPattern(pattern2);
      composer.connect('sequential_agent1_agent2', 'sequential_agent1_agent2');
      
      const viz = composer.getVisualization();
      expect(viz.graph.edges).toHaveLength(1);
    });
  });

  describe('JSON Import/Export', () => {
    it('should export composition as JSON', () => {
      composer.addPattern(testPatternInstance);
      const json = composer.exportJSON();
      expect(json).toBeDefined();
      const data = JSON.parse(json);
      expect(data.composition).toBeDefined();
      expect(data.visualization).toBeDefined();
    });

    it('should import composition from JSON', () => {
      composer.addPattern(testPatternInstance);
      const json = composer.exportJSON();
      
      const newComposer = new PatternComposer();
      newComposer.importJSON(json);
      
      const composition = newComposer.getComposition();
      expect(composition.patterns).toHaveLength(1);
    });
  });
});

describe('createPatternComposer', () => {
  it('should create composer with default config', () => {
    const composer = createPatternComposer();
    expect(composer).toBeInstanceOf(PatternComposer);
  });

  it('should create composer with custom config', () => {
    const composer = createPatternComposer({
      validate: false,
      max_depth: 10,
    });
    expect(composer.getConfig().validate).toBe(false);
    expect(composer.getConfig().max_depth).toBe(10);
  });
});

describe('composeAndExecute', () => {
  it('should compose and execute patterns', async () => {
    const patterns: GraphPatternInstance[] = [
      {
        type: 'sequential',
        config: DEFAULT_GRAPH_CONFIG,
        nodes: [
          {
            agent_id: 'agent1',
            node_type: 'agent',
            inputs: {},
            outputs: {},
            config: { model: 'gpt-4', timeout: 5000 },
          },
        ],
        edges: [],
      },
    ];

    const connections: EdgeConnection[] = [];

    const result = await composeAndExecute(patterns, connections, { test: 'input' });
    expect(result.status).toBe('completed');
  });
});

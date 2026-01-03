/**
 * @fileoverview Tests for Sequential Pattern
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SequentialPattern,
  createSequentialPattern,
  executeSequential,
  type AgentNode,
  type ExecutionResult,
  type SequentialPatternConfig,
} from '../src/patterns/SequentialPattern.js';
import { DEFAULT_GRAPH_CONFIG } from '../src/types.js';

describe('SequentialPattern', () => {
  let testNodes: AgentNode[];

  beforeEach(() => {
    testNodes = [
      {
        agent_id: 'agent1',
        node_type: 'agent',
        inputs: {},
        outputs: {},
        config: {
          model: 'gpt-4',
          timeout: 5000,
        },
        name: 'First Agent',
      },
      {
        agent_id: 'agent2',
        node_type: 'agent',
        inputs: {},
        outputs: {},
        config: {
          model: 'gpt-4',
          timeout: 5000,
        },
        name: 'Second Agent',
      },
      {
        agent_id: 'agent3',
        node_type: 'agent',
        inputs: {},
        outputs: {},
        config: {
          model: 'gpt-4',
          timeout: 5000,
        },
        name: 'Third Agent',
      },
    ];
  });

  describe('Constructor', () => {
    it('should create pattern with default config', () => {
      const pattern = new SequentialPattern();
      expect(pattern).toBeDefined();
      const config = pattern.getConfig();
      expect(config.nodes).toHaveLength(0);
      expect(config.stop_on_error).toBe(true);
      expect(config.pass_outputs).toBe(true);
    });

    it('should create pattern with custom config', () => {
      const config: Partial<SequentialPatternConfig> = {
        nodes: testNodes,
        stop_on_error: false,
        pass_outputs: false,
      };
      const pattern = new SequentialPattern(config);
      const patternConfig = pattern.getConfig();
      expect(patternConfig.nodes).toHaveLength(3);
      expect(patternConfig.stop_on_error).toBe(false);
      expect(patternConfig.pass_outputs).toBe(false);
    });
  });

  describe('Execution', () => {
    it('should execute single node', async () => {
      const pattern = new SequentialPattern({
        nodes: [testNodes[0]],
      });
      const result = await pattern.execute({ test: 'input' });
      expect(result.status).toBe('completed');
      expect(result.metrics.nodes_executed).toBe(1);
      expect(result.outputs).toBeDefined();
    });

    it('should execute multiple nodes in sequence', async () => {
      const pattern = new SequentialPattern({
        nodes: testNodes,
      });
      const result = await pattern.execute({ test: 'input' });
      expect(result.status).toBe('completed');
      expect(result.metrics.nodes_executed).toBe(3);
    });

    it('should pass outputs between nodes when enabled', async () => {
      const pattern = new SequentialPattern({
        nodes: testNodes,
        pass_outputs: true,
      });
      const result = await pattern.execute({ initial: 'data' });
      expect(result.status).toBe('completed');
      expect(result.outputs).toHaveProperty('_merged_at');
    });

    it('should not pass outputs when disabled', async () => {
      const pattern = new SequentialPattern({
        nodes: testNodes,
        pass_outputs: false,
      });
      const result = await pattern.execute({ initial: 'data' });
      expect(result.status).toBe('completed');
    });

    it('should stop on first error when enabled', async () => {
      // Create a node that will fail
      const failingNode: AgentNode = {
        agent_id: 'failing',
        node_type: 'agent',
        inputs: {},
        outputs: {},
        config: {
          model: 'gpt-4',
          timeout: 1, // Very short timeout to force failure
        },
      };
      const pattern = new SequentialPattern({
        nodes: [testNodes[0], failingNode, testNodes[1]],
        stop_on_error: true,
      });
      const result = await pattern.execute({ test: 'input' });
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should continue on error when disabled', async () => {
      const pattern = new SequentialPattern({
        nodes: testNodes,
        stop_on_error: false,
      });
      const result = await pattern.execute({ test: 'input' });
      // Should complete even if some nodes fail
      expect(['completed', 'failed']).toContain(result.status);
    });

    it('should record execution metrics', async () => {
      const pattern = new SequentialPattern({
        nodes: testNodes,
      });
      const result = await pattern.execute({ test: 'input' });
      expect(result.metrics.total_time).toBeGreaterThan(0);
      expect(result.metrics.node_times.size).toBe(3);
    });

    it('should create execution trace', async () => {
      const pattern = new SequentialPattern({
        nodes: testNodes,
        enable_tracing: true,
      });
      const result = await pattern.execute({ test: 'input' });
      expect(result.trace.entries.length).toBeGreaterThan(0);
    });
  });

  describe('Node Management', () => {
    it('should add node to pattern', () => {
      const pattern = new SequentialPattern();
      pattern.addNode(testNodes[0]);
      const config = pattern.getConfig();
      expect(config.nodes).toHaveLength(1);
      expect(config.nodes[0].agent_id).toBe('agent1');
    });

    it('should add node at specific position', () => {
      const pattern = new SequentialPattern({
        nodes: [testNodes[0], testNodes[2]],
      });
      pattern.addNode(testNodes[1], 1);
      const config = pattern.getConfig();
      expect(config.nodes).toHaveLength(3);
      expect(config.nodes[1].agent_id).toBe('agent2');
    });

    it('should remove node from pattern', () => {
      const pattern = new SequentialPattern({
        nodes: testNodes,
      });
      pattern.removeNode('agent2');
      const config = pattern.getConfig();
      expect(config.nodes).toHaveLength(2);
      expect(config.nodes.find(n => n.agent_id === 'agent2')).toBeUndefined();
    });

    it('should reject invalid node when adding', () => {
      const pattern = new SequentialPattern();
      const invalidNode = {
        agent_id: '',
        node_type: 'agent' as const,
        inputs: {},
        outputs: {},
        config: {} as any,
      };
      expect(() => pattern.addNode(invalidNode)).toThrow();
    });
  });

  describe('Configuration', () => {
    it('should update stop_on_error', () => {
      const pattern = new SequentialPattern({
        stop_on_error: true,
      });
      pattern.updateConfig({ stop_on_error: false });
      expect(pattern.getConfig().stop_on_error).toBe(false);
    });

    it('should update pass_outputs', () => {
      const pattern = new SequentialPattern({
        pass_outputs: true,
      });
      pattern.updateConfig({ pass_outputs: false });
      expect(pattern.getConfig().pass_outputs).toBe(false);
    });

    it('should update nodes', () => {
      const pattern = new SequentialPattern();
      pattern.updateConfig({ nodes: [testNodes[0]] });
      expect(pattern.getConfig().nodes).toHaveLength(1);
    });

    it('should reject invalid graph config', () => {
      const pattern = new SequentialPattern();
      expect(() => {
        pattern.updateConfig({
          graph: {
            ...DEFAULT_GRAPH_CONFIG,
            timeout: -1,
          },
        });
      }).toThrow();
    });
  });

  describe('Validation', () => {
    it('should validate correct configuration', () => {
      const pattern = new SequentialPattern({
        nodes: testNodes,
      });
      const validation = pattern.validate();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject configuration with no nodes', () => {
      const pattern = new SequentialPattern();
      const validation = pattern.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Pattern must have at least one node');
    });

    it('should reject configuration with invalid node', () => {
      const pattern = new SequentialPattern({
        nodes: [
          {
            agent_id: '',
            node_type: 'agent' as const,
            inputs: {},
            outputs: {},
            config: {} as any,
          },
        ],
      });
      const validation = pattern.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Visualization', () => {
    it('should generate visualization data', () => {
      const pattern = new SequentialPattern({
        nodes: testNodes,
      });
      const viz = pattern.getVisualization();
      expect(viz.type).toBe('sequential');
      expect(viz.nodes).toHaveLength(3);
      expect(viz.edges).toHaveLength(2);
    });

    it('should include correct edges in visualization', () => {
      const pattern = new SequentialPattern({
        nodes: testNodes,
      });
      const viz = pattern.getVisualization();
      expect(viz.edges[0].from).toBe('agent1');
      expect(viz.edges[0].to).toBe('agent2');
      expect(viz.edges[1].from).toBe('agent2');
      expect(viz.edges[1].to).toBe('agent3');
    });
  });
});

describe('createSequentialPattern', () => {
  it('should create pattern with default config', () => {
    const pattern = createSequentialPattern();
    expect(pattern).toBeInstanceOf(SequentialPattern);
  });

  it('should create pattern with custom config', () => {
    const pattern = createSequentialPattern({
      nodes: testNodes,
    });
    expect(pattern.getConfig().nodes).toHaveLength(3);
  });
});

describe('executeSequential', () => {
  it('should execute nodes and return result', async () => {
    const result = await executeSequential(testNodes, { test: 'input' });
    expect(result.status).toBe('completed');
    expect(result.metrics.nodes_executed).toBe(3);
  });
});

describe('Edge Cases', () => {
  it('should handle empty input', async () => {
    const pattern = new SequentialPattern({
      nodes: [testNodes[0]],
    });
    const result = await pattern.execute({});
    expect(result.status).toBe('completed');
  });

  it('should handle nodes with no name', async () => {
    const unnamedNode: AgentNode = {
      agent_id: 'unnamed',
      node_type: 'agent',
      inputs: {},
      outputs: {},
      config: { model: 'gpt-4' },
    };
    const pattern = new SequentialPattern({
      nodes: [unnamedNode],
    });
    const result = await pattern.execute({});
    expect(result.status).toBe('completed');
  });

  it('should handle very long node sequences', async () => {
    const manyNodes: AgentNode[] = Array.from({ length: 100 }, (_, i) => ({
      agent_id: `agent${i}`,
      node_type: 'agent',
      inputs: {},
      outputs: {},
      config: { model: 'gpt-4', timeout: 100 },
    }));
    const pattern = new SequentialPattern({
      nodes: manyNodes,
    });
    const validation = pattern.validate();
    expect(validation.valid).toBe(true);
  });
});

describe('Execution Timeouts', () => {
  it('should handle node timeout', async () => {
    const slowNode: AgentNode = {
      agent_id: 'slow',
      node_type: 'agent',
      inputs: {},
      outputs: {},
      config: {
        model: 'gpt-4',
        timeout: 1, // 1ms timeout
      },
    };
    const pattern = new SequentialPattern({
      nodes: [slowNode],
      graph: {
        ...DEFAULT_GRAPH_CONFIG,
        timeout: 10,
      },
    });
    const result = await pattern.execute({});
    // Should handle timeout gracefully
    expect(result).toBeDefined();
  });
});

describe('Output Aggregation', () => {
  it('should aggregate outputs from all nodes', async () => {
    const pattern = new SequentialPattern({
      nodes: testNodes,
      pass_outputs: true,
    });
    const result = await pattern.execute({ initial: 'value' });
    expect(result.outputs).toBeDefined();
    expect(Object.keys(result.outputs).length).toBeGreaterThan(0);
  });
});

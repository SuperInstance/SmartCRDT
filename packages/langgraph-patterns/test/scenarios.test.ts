/**
 * @fileoverview Scenario tests for complex real-world workflows
 */

import { describe, it, expect } from 'vitest';
import {
  SequentialPattern,
  ParallelPattern,
  ConditionalPattern,
  RecursivePattern,
  HierarchicalPattern,
  DynamicPattern,
  PatternComposer,
  type AgentNode,
  type ConditionalRoute,
  type EdgeCondition,
  type HierarchyRelationship,
  type ModificationRule,
} from '../src/index.js';
import { DEFAULT_GRAPH_CONFIG } from '../src/types.js';

describe('Real-World Scenarios', () => {
  describe('Customer Support Workflow', () => {
    it('should handle sequential support ticket processing', async () => {
      const nodes: AgentNode[] = [
        {
          agent_id: 'classify',
          node_type: 'agent',
          inputs: {},
          outputs: {},
          config: { model: 'gpt-4', timeout: 5000 },
          name: 'Ticket Classification',
        },
        {
          agent_id: 'route',
          node_type: 'agent',
          inputs: {},
          outputs: {},
          config: { model: 'gpt-4', timeout: 5000 },
          name: 'Routing',
        },
        {
          agent_id: 'respond',
          node_type: 'agent',
          inputs: {},
          outputs: {},
          config: { model: 'gpt-4', timeout: 5000 },
          name: 'Response Generation',
        },
      ];

      const pattern = new SequentialPattern({ nodes });
      const result = await pattern.execute({ ticket: 'Issue description' });
      expect(result.status).toBe('completed');
      expect(result.metrics.nodes_executed).toBe(3);
    });

    it('should handle parallel sentiment analysis', async () => {
      const nodes: AgentNode[] = [
        {
          agent_id: 'sentiment',
          node_type: 'agent',
          inputs: {},
          outputs: {},
          config: { model: 'sentiment-model', timeout: 3000 },
          name: 'Sentiment Analysis',
        },
        {
          agent_id: 'urgency',
          node_type: 'agent',
          inputs: {},
          outputs: {},
          config: { model: 'urgency-model', timeout: 3000 },
          name: 'Urgency Detection',
        },
        {
          agent_id: 'category',
          node_type: 'agent',
          inputs: {},
          outputs: {},
          config: { model: 'category-model', timeout: 3000 },
          name: 'Category Classification',
        },
      ];

      const pattern = new ParallelPattern({
        nodes,
        merge_strategy: 'merge',
      });
      const result = await pattern.execute({ message: 'Customer message' });
      expect(result.status).toBe('completed');
    });
  });

  describe('Content Generation Pipeline', () => {
    it('should handle conditional content routing', async () => {
      const nodes: AgentNode[] = [
        {
          agent_id: 'blog_writer',
          node_type: 'agent',
          inputs: {},
          outputs: {},
          config: { model: 'gpt-4', timeout: 10000 },
          name: 'Blog Writer',
        },
        {
          agent_id: 'social_writer',
          node_type: 'agent',
          inputs: {},
          outputs: {},
          config: { model: 'gpt-4', timeout: 5000 },
          name: 'Social Post Writer',
        },
        {
          agent_id: 'email_writer',
          node_type: 'agent',
          inputs: {},
          outputs: {},
          config: { model: 'gpt-4', timeout: 5000 },
          name: 'Email Writer',
        },
      ];

      const routes: ConditionalRoute[] = [
        {
          node: nodes[0],
          condition: { type: 'boolean', expression: 'contentType', value: 'blog' },
          priority: 3,
        },
        {
          node: nodes[1],
          condition: { type: 'boolean', expression: 'contentType', value: 'social' },
          priority: 2,
        },
        {
          node: nodes[2],
          condition: { type: 'boolean', expression: 'contentType', value: 'email' },
          priority: 1,
        },
      ];

      const pattern = new ConditionalPattern({
        routes,
        default_route: 'blog_writer',
      });

      const result = await pattern.execute({ contentType: 'blog', topic: 'AI' });
      expect(result.status).toBe('completed');
    });
  });

  describe('Research Assistant', () => {
    it('should handle recursive document analysis', async () => {
      const node: AgentNode = {
        agent_id: 'analyzer',
        node_type: 'agent',
        inputs: {},
        outputs: {},
        config: { model: 'gpt-4', timeout: 5000 },
        name: 'Document Analyzer',
      };

      const baseCase: EdgeCondition = {
        type: 'expression',
        expression: 'done',
      };

      const pattern = new RecursivePattern({
        node,
        base_case: baseCase,
        max_depth: 5,
        accumulate_results: true,
      });

      const result = await pattern.execute({ document: 'Research content' });
      expect(result.status).toBe('completed');
      expect(result.outputs.iterations).toBeGreaterThan(0);
    });
  });

  describe('Multi-Department Approval', () => {
    it('should handle hierarchical approval flow', async () => {
      const subgraphs = new Map<string, 'sequential' | 'parallel'>([
        ['manager', 'sequential'],
        ['director', 'sequential'],
        ['vp', 'sequential'],
      ]);

      const hierarchy: HierarchyRelationship[] = [
        { parent: 'manager', child: 'director', scope: 'sequential' },
        { parent: 'director', child: 'vp', scope: 'sequential' },
      ];

      const pattern = new HierarchicalPattern({
        subgraphs,
        hierarchy,
        bubble_strategy: 'immediate',
      });

      const result = await pattern.execute({ request: 'Budget approval' });
      expect(result.status).toBe('completed');
    });
  });

  describe('Adaptive Workflow', () => {
    it('should handle dynamic workflow modification', async () => {
      const nodes: AgentNode[] = [
        {
          agent_id: 'step1',
          node_type: 'agent',
          inputs: {},
          outputs: {},
          config: { model: 'gpt-4', timeout: 5000 },
        },
      ];

      const modificationRules: ModificationRule[] = [
        {
          trigger: 'on_success',
          action: 'add_node',
          conditions: [],
        },
      ];

      const pattern = new DynamicPattern({
        initial_nodes: nodes,
        modification_rules,
        allow_addition: true,
      });

      const result = await pattern.execute({ task: 'Complex task' });
      expect(result.status).toBe('completed');
    });
  });
});

describe('Error Handling Scenarios', () => {
  it('should handle timeout in sequential pattern', async () => {
    const slowNode: AgentNode = {
      agent_id: 'slow',
      node_type: 'agent',
      inputs: {},
      outputs: {},
      config: { model: 'gpt-4', timeout: 1 },
    };

    const pattern = new SequentialPattern({
      nodes: [slowNode],
      stop_on_error: true,
    });

    const result = await pattern.execute({});
    expect(result).toBeDefined();
    expect(['completed', 'failed']).toContain(result.status);
  });

  it('should handle partial failures in parallel pattern', async () => {
    const nodes: AgentNode[] = [
      {
        agent_id: 'fast',
        node_type: 'agent',
        inputs: {},
        outputs: {},
        config: { model: 'gpt-4', timeout: 5000 },
      },
      {
        agent_id: 'slow',
        node_type: 'agent',
        inputs: {},
        outputs: {},
        config: { model: 'gpt-4', timeout: 1 },
      },
    ];

    const pattern = new ParallelPattern({
      nodes,
      wait_for_all: false,
      min_required: 1,
    });

    const result = await pattern.execute({});
    expect(result).toBeDefined();
  });

  it('should handle no matching conditions', async () => {
    const nodes: AgentNode[] = [
      {
        agent_id: 'handler',
        node_type: 'agent',
        inputs: {},
        outputs: {},
        config: { model: 'gpt-4', timeout: 5000 },
      },
    ];

    const routes: ConditionalRoute[] = [
      {
        node: nodes[0],
        condition: { type: 'boolean', expression: 'match', value: true },
        priority: 1,
      },
    ];

    const pattern = new ConditionalPattern({
      routes,
      default_route: 'handler',
    });

    const result = await pattern.execute({ match: false });
    expect(result.status).toBe('completed');
  });
});

describe('Performance Scenarios', () => {
  it('should handle large node count in sequential pattern', async () => {
    const nodes: AgentNode[] = Array.from({ length: 50 }, (_, i) => ({
      agent_id: `agent${i}`,
      node_type: 'agent',
      inputs: {},
      outputs: {},
      config: { model: 'gpt-4', timeout: 100 },
    }));

    const pattern = new SequentialPattern({ nodes });
    const validation = pattern.validate();
    expect(validation.valid).toBe(true);
  });

  it('should handle many parallel nodes', async () => {
    const nodes: AgentNode[] = Array.from({ length: 20 }, (_, i) => ({
      agent_id: `agent${i}`,
      node_type: 'agent',
      inputs: {},
      outputs: {},
      config: { model: 'gpt-4', timeout: 5000 },
    }));

    const pattern = new ParallelPattern({
      nodes,
      graph: { ...DEFAULT_GRAPH_CONFIG, max_parallelism: 10 },
    });

    const result = await pattern.execute({ test: 'input' });
    expect(result.status).toBe('completed');
  });
});

describe('Complex Composed Scenarios', () => {
  it('should compose sequential + parallel patterns', async () => {
    const composer = new PatternComposer({
      validate: true,
      max_depth: 3,
    });

    const sequentialPattern = {
      type: 'sequential' as const,
      config: DEFAULT_GRAPH_CONFIG,
      nodes: [
        {
          agent_id: 'step1',
          node_type: 'agent' as const,
          inputs: {},
          outputs: {},
          config: { model: 'gpt-4', timeout: 5000 },
        },
      ],
      edges: [],
    };

    const parallelPattern = {
      type: 'parallel' as const,
      config: DEFAULT_GRAPH_CONFIG,
      nodes: [
        {
          agent_id: 'parallel1',
          node_type: 'agent' as const,
          inputs: {},
          outputs: {},
          config: { model: 'gpt-4', timeout: 5000 },
        },
        {
          agent_id: 'parallel2',
          node_type: 'agent' as const,
          inputs: {},
          outputs: {},
          config: { model: 'gpt-4', timeout: 5000 },
        },
      ],
      edges: [],
    };

    composer.addPattern(sequentialPattern, { x: 0, y: 0, layer: 0 }, true, false);
    composer.addPattern(parallelPattern, { x: 100, y: 0, layer: 1 }, false, true);

    const result = await composer.execute({ input: 'test' });
    expect(result.status).toBe('completed');
  });

  it('should compose conditional + recursive patterns', async () => {
    const composer = new PatternComposer();

    const conditionalPattern = {
      type: 'conditional' as const,
      config: DEFAULT_GRAPH_CONFIG,
      nodes: [
        {
          agent_id: 'option_a',
          node_type: 'agent' as const,
          inputs: {},
          outputs: {},
          config: { model: 'gpt-4', timeout: 5000 },
        },
      ],
      edges: [],
    };

    composer.addPattern(conditionalPattern, undefined, true, true);
    const result = await composer.execute({ choice: 'a' });
    expect(result.status).toBe('completed');
  });
});

describe('Edge Cases', () => {
  it('should handle empty input', async () => {
    const pattern = new SequentialPattern({
      nodes: [
        {
          agent_id: 'test',
          node_type: 'agent',
          inputs: {},
          outputs: {},
          config: { model: 'gpt-4', timeout: 5000 },
        },
      ],
    });
    const result = await pattern.execute({});
    expect(result.status).toBe('completed');
  });

  it('should handle single node patterns', async () => {
    const pattern = new SequentialPattern({
      nodes: [
        {
          agent_id: 'single',
          node_type: 'agent',
          inputs: {},
          outputs: {},
          config: { model: 'gpt-4', timeout: 5000 },
        },
      ],
    });
    const result = await pattern.execute({ test: 'input' });
    expect(result.metrics.nodes_executed).toBe(1);
  });

  it('should handle very deep recursion', async () => {
    const node: AgentNode = {
      agent_id: 'recursive',
      node_type: 'agent',
      inputs: {},
      outputs: {},
      config: { model: 'gpt-4', timeout: 100 },
    };

    const pattern = new RecursivePattern({
      node,
      base_case: { type: 'expression', expression: 'never' },
      max_depth: 10,
    });

    const result = await pattern.execute({});
    expect(result.outputs.final_iteration).toBeLessThan(10);
  });
});

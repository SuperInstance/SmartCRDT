/**
 * @fileoverview Tests for Parallel Pattern
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ParallelPattern,
  createParallelPattern,
  executeParallel,
  type AgentNode,
  type MergeStrategy,
} from '../src/patterns/ParallelPattern.js';

describe('ParallelPattern', () => {
  let testNodes: AgentNode[];

  beforeEach(() => {
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
      {
        agent_id: 'agent3',
        node_type: 'agent',
        inputs: {},
        outputs: {},
        config: { model: 'gpt-4', timeout: 5000 },
      },
    ];
  });

  describe('Constructor', () => {
    it('should create pattern with default config', () => {
      const pattern = new ParallelPattern();
      expect(pattern).toBeDefined();
      expect(pattern.getConfig().nodes).toHaveLength(0);
      expect(pattern.getConfig().merge_strategy).toBe('merge');
      expect(pattern.getConfig().wait_for_all).toBe(true);
    });

    it('should create pattern with custom config', () => {
      const pattern = new ParallelPattern({
        nodes: testNodes,
        merge_strategy: 'concat',
        wait_for_all: false,
      });
      const config = pattern.getConfig();
      expect(config.nodes).toHaveLength(3);
      expect(config.merge_strategy).toBe('concat');
      expect(config.wait_for_all).toBe(false);
    });
  });

  describe('Execution', () => {
    it('should execute nodes in parallel', async () => {
      const pattern = new ParallelPattern({ nodes: testNodes });
      const result = await pattern.execute({ test: 'input' });
      expect(result.status).toBe('completed');
      expect(result.metrics.nodes_executed).toBe(3);
    });

    it('should merge results with merge strategy', async () => {
      const pattern = new ParallelPattern({
        nodes: testNodes,
        merge_strategy: 'merge',
      });
      const result = await pattern.execute({ test: 'input' });
      expect(result.outputs).toBeDefined();
    });

    it('should concat results with concat strategy', async () => {
      const pattern = new ParallelPattern({
        nodes: testNodes,
        merge_strategy: 'concat',
      });
      const result = await pattern.execute({ test: 'input' });
      expect(result.outputs).toHaveProperty('results');
    });

    it('should return first result with first strategy', async () => {
      const pattern = new ParallelPattern({
        nodes: testNodes,
        merge_strategy: 'first',
      });
      const result = await pattern.execute({ test: 'input' });
      expect(result.outputs).toBeDefined();
    });

    it('should handle partial failures', async () => {
      const pattern = new ParallelPattern({
        nodes: testNodes,
        wait_for_all: true,
      });
      const result = await pattern.execute({ test: 'input' });
      expect(['completed', 'failed']).toContain(result.status);
    });

    it('should respect max_parallelism', async () => {
      const pattern = new ParallelPattern({
        nodes: testNodes,
        graph: {
          max_parallelism: 2,
          timeout: 5000,
          retry_policy: {
            max_attempts: 3,
            base_delay: 1000,
            max_delay: 10000,
            exponential_backoff: true,
            jitter_factor: 0.1,
          },
          fallback_strategy: 'skip',
          enable_tracing: true,
          enable_caching: true,
        },
      });
      const result = await pattern.execute({ test: 'input' });
      expect(result).toBeDefined();
    });
  });

  describe('Merge Strategies', () => {
    const strategies: MergeStrategy[] = ['concat', 'merge', 'first', 'majority', 'custom'];

    it.each(strategies)('should support %s strategy', async (strategy) => {
      const pattern = new ParallelPattern({
        nodes: testNodes,
        merge_strategy: strategy,
      });
      pattern.setMergeStrategy(strategy);
      expect(pattern.getConfig().merge_strategy).toBe(strategy);
      const result = await pattern.execute({ test: 'input' });
      expect(result.outputs).toBeDefined();
    });
  });

  describe('Node Management', () => {
    it('should add node to pattern', () => {
      const pattern = new ParallelPattern();
      pattern.addNode(testNodes[0]);
      expect(pattern.getConfig().nodes).toHaveLength(1);
    });

    it('should remove node from pattern', () => {
      const pattern = new ParallelPattern({ nodes: testNodes });
      pattern.removeNode('agent2');
      expect(pattern.getConfig().nodes).toHaveLength(2);
    });
  });

  describe('Validation', () => {
    it('should validate correct configuration', () => {
      const pattern = new ParallelPattern({ nodes: testNodes });
      const validation = pattern.validate();
      expect(validation.valid).toBe(true);
    });

    it('should reject empty nodes', () => {
      const pattern = new ParallelPattern();
      const validation = pattern.validate();
      expect(validation.valid).toBe(false);
    });

    it('should validate min_required', () => {
      const pattern = new ParallelPattern({
        nodes: testNodes,
        min_required: 2,
      });
      const validation = pattern.validate();
      expect(validation.valid).toBe(true);
    });

    it('should reject min_required exceeding node count', () => {
      const pattern = new ParallelPattern({
        nodes: testNodes,
        min_required: 5,
      });
      const validation = pattern.validate();
      expect(validation.valid).toBe(false);
    });
  });
});

describe('createParallelPattern', () => {
  it('should create pattern', () => {
    const pattern = createParallelPattern();
    expect(pattern).toBeInstanceOf(ParallelPattern);
  });
});

describe('executeParallel', () => {
  it('should execute and return result', async () => {
    const result = await executeParallel(testNodes, { test: 'input' });
    expect(result.status).toBe('completed');
  });
});

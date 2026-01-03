/**
 * @fileoverview Tests for Hierarchical Pattern
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  HierarchicalPattern,
  createHierarchicalPattern,
  executeHierarchical,
  type HierarchyRelationship,
  type BubbleStrategy,
  type GraphPattern,
} from '../src/patterns/HierarchicalPattern.js';

describe('HierarchicalPattern', () => {
  let subgraphs: Map<string, GraphPattern>;
  let hierarchy: HierarchyRelationship[];

  beforeEach(() => {
    subgraphs = new Map([
      ['root', 'sequential'],
      ['child1', 'parallel'],
      ['child2', 'conditional'],
    ]);

    hierarchy = [
      { parent: 'root', child: 'child1', scope: 'nested' },
      { parent: 'root', child: 'child2', scope: 'nested' },
      { parent: 'child1', child: 'grandchild', scope: 'parallel' },
    ];
  });

  describe('Constructor', () => {
    it('should create pattern with subgraphs', () => {
      const pattern = new HierarchicalPattern({
        subgraphs,
        hierarchy,
      });
      expect(pattern).toBeDefined();
      expect(pattern.getConfig().subgraphs.size).toBe(3);
    });

    it('should set default bubble strategy', () => {
      const pattern = new HierarchicalPattern({
        subgraphs,
        hierarchy,
      });
      expect(pattern.getConfig().bubble_strategy).toBe('immediate');
    });
  });

  describe('Execution', () => {
    it('should execute hierarchical pattern', async () => {
      const pattern = new HierarchicalPattern({
        subgraphs,
        hierarchy,
      });
      const result = await pattern.execute({ test: 'input' });
      expect(result.status).toBe('completed');
      expect(result.outputs.subgraph_count).toBeGreaterThan(0);
    });

    it('should calculate hierarchy depth', async () => {
      const pattern = new HierarchicalPattern({
        subgraphs,
        hierarchy,
      });
      const result = await pattern.execute({ test: 'input' });
      expect(result.outputs.hierarchy_depth).toBeGreaterThan(0);
    });
  });

  describe('Bubble Strategies', () => {
    const strategies: BubbleStrategy[] = ['immediate', 'deferred', 'selective', 'aggregated'];

    it.each(strategies)('should support %s strategy', async (strategy) => {
      const pattern = new HierarchicalPattern({
        subgraphs,
        hierarchy,
        bubble_strategy: strategy,
      });
      expect(pattern.getConfig().bubble_strategy).toBe(strategy);
    });
  });

  describe('Subgraph Management', () => {
    it('should add subgraph', () => {
      const pattern = new HierarchicalPattern();
      pattern.addSubGraph('new_subgraph', 'sequential');
      expect(pattern.getConfig().subgraphs.has('new_subgraph')).toBe(true);
    });

    it('should add hierarchy relationship', () => {
      const pattern = new HierarchicalPattern({ subgraphs });
      pattern.addHierarchy({ parent: 'root', child: 'new_child', scope: 'nested' });
      expect(pattern.getConfig().hierarchy.length).toBeGreaterThan(0);
    });

    it('should set bubble strategy', () => {
      const pattern = new HierarchicalPattern({ subgraphs, hierarchy });
      pattern.setBubbleStrategy('deferred');
      expect(pattern.getConfig().bubble_strategy).toBe('deferred');
    });
  });

  describe('Validation', () => {
    it('should validate correct configuration', () => {
      const pattern = new HierarchicalPattern({
        subgraphs,
        hierarchy,
      });
      const validation = pattern.validate();
      expect(validation.valid).toBe(true);
    });

    it('should reject empty subgraphs', () => {
      const pattern = new HierarchicalPattern();
      const validation = pattern.validate();
      expect(validation.valid).toBe(false);
    });

    it('should detect circular references', () => {
      const circularHierarchy: HierarchyRelationship[] = [
        { parent: 'a', child: 'b', scope: 'nested' },
        { parent: 'b', child: 'c', scope: 'nested' },
        { parent: 'c', child: 'a', scope: 'nested' },
      ];
      const circularSubgraphs = new Map([
        ['a', 'sequential'],
        ['b', 'parallel'],
        ['c', 'conditional'],
      ]);
      const pattern = new HierarchicalPattern({
        subgraphs: circularSubgraphs,
        hierarchy: circularHierarchy,
      });
      const validation = pattern.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('circular'))).toBe(true);
    });
  });
});

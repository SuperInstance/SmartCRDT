/**
 * @fileoverview Tests for Recursive Pattern
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  RecursivePattern,
  createRecursivePattern,
  executeRecursive,
  type AgentNode,
  type EdgeCondition,
} from '../src/patterns/RecursivePattern.js';

describe('RecursivePattern', () => {
  let testNode: AgentNode;
  let baseCaseCondition: EdgeCondition;

  beforeEach(() => {
    testNode = {
      agent_id: 'recursive_agent',
      node_type: 'agent',
      inputs: {},
      outputs: {},
      config: { model: 'gpt-4', timeout: 5000 },
      name: 'Recursive Agent',
    };

    baseCaseCondition = {
      type: 'expression',
      expression: 'done',
    };
  });

  describe('Constructor', () => {
    it('should create pattern with required config', () => {
      const pattern = new RecursivePattern({
        node: testNode,
        base_case: baseCaseCondition,
      });
      expect(pattern).toBeDefined();
      expect(pattern.getConfig().max_depth).toBe(10);
      expect(pattern.getConfig().accumulate_results).toBe(true);
    });

    it('should create pattern with custom max_depth', () => {
      const pattern = new RecursivePattern({
        node: testNode,
        base_case: baseCaseCondition,
        max_depth: 5,
      });
      expect(pattern.getConfig().max_depth).toBe(5);
    });
  });

  describe('Execution', () => {
    it('should execute recursive pattern', async () => {
      const pattern = new RecursivePattern({
        node: testNode,
        base_case: baseCaseCondition,
        max_depth: 3,
      });
      const result = await pattern.execute({ test: 'input' });
      expect(result.status).toBe('completed');
      expect(result.outputs.iterations).toBeGreaterThan(0);
    });

    it('should accumulate results when enabled', async () => {
      const pattern = new RecursivePattern({
        node: testNode,
        base_case: baseCaseCondition,
        accumulate_results: true,
      });
      const result = await pattern.execute({ test: 'input' });
      expect(result.outputs.iteration_results).toBeDefined();
      expect(Array.isArray(result.outputs.iteration_results)).toBe(true);
    });

    it('should respect max_depth limit', async () => {
      const pattern = new RecursivePattern({
        node: testNode,
        base_case: {
          type: 'expression',
          expression: 'never_true',
        },
        max_depth: 3,
      });
      const result = await pattern.execute({ test: 'input' });
      expect(result.outputs.final_iteration).toBeLessThan(3);
    });
  });

  describe('Configuration', () => {
    it('should set max depth', () => {
      const pattern = new RecursivePattern({
        node: testNode,
        base_case: baseCaseCondition,
      });
      pattern.setMaxDepth(20);
      expect(pattern.getConfig().max_depth).toBe(20);
    });

    it('should reject non-positive max depth', () => {
      const pattern = new RecursivePattern({
        node: testNode,
        base_case: baseCaseCondition,
      });
      expect(() => pattern.setMaxDepth(0)).toThrow();
      expect(() => pattern.setMaxDepth(-1)).toThrow();
    });

    it('should reject excessive max depth', () => {
      const pattern = new RecursivePattern({
        node: testNode,
        base_case: baseCaseCondition,
      });
      expect(() => pattern.setMaxDepth(101)).toThrow();
    });

    it('should set base case condition', () => {
      const pattern = new RecursivePattern({
        node: testNode,
        base_case: baseCaseCondition,
      });
      const newCondition: EdgeCondition = {
        type: 'boolean',
        expression: 'complete',
        value: true,
      };
      pattern.setBaseCase(newCondition);
      expect(pattern.getConfig().base_case).toEqual(newCondition);
    });
  });

  describe('Validation', () => {
    it('should validate correct configuration', () => {
      const pattern = new RecursivePattern({
        node: testNode,
        base_case: baseCaseCondition,
      });
      const validation = pattern.validate();
      expect(validation.valid).toBe(true);
    });

    it('should reject invalid max_depth', () => {
      const pattern = new RecursivePattern({
        node: testNode,
        base_case: baseCaseCondition,
        max_depth: 0,
      });
      const validation = pattern.validate();
      expect(validation.valid).toBe(false);
    });
  });
});

describe('createRecursivePattern', () => {
  it('should create pattern', () => {
    const pattern = createRecursivePattern({
      node: testNode,
      base_case: baseCaseCondition,
    });
    expect(pattern).toBeInstanceOf(RecursivePattern);
  });
});

describe('executeRecursive', () => {
  it('should execute and return result', async () => {
    const result = await executeRecursive(
      testNode,
      baseCaseCondition,
      { test: 'input' },
      3
    );
    expect(result.status).toBe('completed');
  });
});

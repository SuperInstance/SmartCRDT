/**
 * @fileoverview Tests for Conditional Pattern
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ConditionalPattern,
  createConditionalPattern,
  executeConditional,
  type AgentNode,
  type ConditionalRoute,
  type EdgeCondition,
} from '../src/patterns/ConditionalPattern.js';

describe('ConditionalPattern', () => {
  let testRoutes: ConditionalRoute[];
  let testNodes: AgentNode[];

  beforeEach(() => {
    testNodes = [
      {
        agent_id: 'route_a',
        node_type: 'agent',
        inputs: {},
        outputs: {},
        config: { model: 'gpt-4', timeout: 5000 },
      },
      {
        agent_id: 'route_b',
        node_type: 'agent',
        inputs: {},
        outputs: {},
        config: { model: 'gpt-4', timeout: 5000 },
      },
      {
        agent_id: 'route_c',
        node_type: 'agent',
        inputs: {},
        outputs: {},
        config: { model: 'gpt-4', timeout: 5000 },
      },
    ];

    testRoutes = [
      {
        node: testNodes[0],
        condition: {
          type: 'boolean',
          expression: 'status',
          value: 'active',
        },
        priority: 3,
      },
      {
        node: testNodes[1],
        condition: {
          type: 'expression',
          expression: 'value > 10',
        },
        priority: 2,
      },
      {
        node: testNodes[2],
        condition: {
          type: 'pattern',
          expression: 'message',
          value: '.*error.*',
        },
        priority: 1,
      },
    ];
  });

  describe('Constructor', () => {
    it('should create pattern with routes', () => {
      const pattern = new ConditionalPattern({ routes: testRoutes });
      expect(pattern).toBeDefined();
      expect(pattern.getConfig().routes).toHaveLength(3);
    });

    it('should sort routes by priority', () => {
      const pattern = new ConditionalPattern({ routes: testRoutes });
      const routes = pattern.getConfig().routes;
      expect(routes[0].priority).toBeGreaterThanOrEqual(routes[1].priority);
    });
  });

  describe('Execution', () => {
    it('should match boolean condition', async () => {
      const pattern = new ConditionalPattern({ routes: testRoutes });
      const result = await pattern.execute({ status: 'active' });
      expect(result.status).toBe('completed');
    });

    it('should match expression condition', async () => {
      const pattern = new ConditionalPattern({ routes: testRoutes });
      const result = await pattern.execute({ value: 15 });
      expect(result.status).toBe('completed');
    });

    it('should use default route when no match', async () => {
      const pattern = new ConditionalPattern({
        routes: testRoutes,
        default_route: 'route_a',
      });
      const result = await pattern.execute({ unmatched: true });
      expect(result.status).toBe('completed');
    });

    it('should evaluate all routes when enabled', async () => {
      const pattern = new ConditionalPattern({
        routes: testRoutes,
        evaluate_all: true,
      });
      const result = await pattern.execute({ status: 'active', value: 15 });
      expect(result).toBeDefined();
    });
  });

  describe('Route Management', () => {
    it('should add route', () => {
      const pattern = new ConditionalPattern();
      pattern.addRoute(testRoutes[0]);
      expect(pattern.getConfig().routes).toHaveLength(1);
    });

    it('should remove route', () => {
      const pattern = new ConditionalPattern({ routes: testRoutes });
      pattern.removeRoute('route_a');
      expect(pattern.getConfig().routes).toHaveLength(2);
    });

    it('should set default route', () => {
      const pattern = new ConditionalPattern({ routes: testRoutes });
      pattern.setDefaultRoute('route_b');
      expect(pattern.getConfig().default_route).toBe('route_b');
    });
  });

  describe('Validation', () => {
    it('should validate correct configuration', () => {
      const pattern = new ConditionalPattern({ routes: testRoutes });
      const validation = pattern.validate();
      expect(validation.valid).toBe(true);
    });

    it('should reject empty routes', () => {
      const pattern = new ConditionalPattern();
      const validation = pattern.validate();
      expect(validation.valid).toBe(false);
    });

    it('should reject negative priority', () => {
      const invalidRoute = {
        node: testNodes[0],
        condition: { type: 'boolean' as const, expression: 'test' },
        priority: -1,
      };
      const pattern = new ConditionalPattern({ routes: [invalidRoute] });
      const validation = pattern.validate();
      expect(validation.valid).toBe(false);
    });

    it('should validate default route exists', () => {
      const pattern = new ConditionalPattern({
        routes: testRoutes,
        default_route: 'nonexistent',
      });
      const validation = pattern.validate();
      expect(validation.valid).toBe(false);
    });
  });
});

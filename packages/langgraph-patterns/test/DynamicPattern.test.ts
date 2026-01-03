/**
 * @fileoverview Tests for Dynamic Pattern
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DynamicPattern,
  createDynamicPattern,
  executeDynamic,
  type AgentNode,
  type ModificationRule,
  type ModificationAction,
  type ModificationTrigger,
} from '../src/patterns/DynamicPattern.js';

describe('DynamicPattern', () => {
  let testNodes: AgentNode[];
  let modificationRules: ModificationRule[];

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
    ];

    modificationRules = [
      {
        trigger: 'on_success' as ModificationTrigger,
        action: 'add_node' as ModificationAction,
        conditions: [],
      },
      {
        trigger: 'on_failure' as ModificationTrigger,
        action: 'remove_node' as ModificationAction,
        conditions: [],
      },
    ];
  });

  describe('Constructor', () => {
    it('should create pattern with initial nodes', () => {
      const pattern = new DynamicPattern({
        initial_nodes: testNodes,
        modification_rules: modificationRules,
      });
      expect(pattern).toBeDefined();
      const state = pattern.getCurrentGraphState();
      expect(state.nodes).toHaveLength(2);
    });

    it('should set all modification permissions by default', () => {
      const pattern = new DynamicPattern({
        initial_nodes: testNodes,
      });
      const config = pattern.getConfig();
      expect(config.allow_addition).toBe(true);
      expect(config.allow_removal).toBe(true);
      expect(config.allow_reconfiguration).toBe(true);
    });
  });

  describe('Execution', () => {
    it('should execute dynamic pattern', async () => {
      const pattern = new DynamicPattern({
        initial_nodes: testNodes,
        modification_rules: modificationRules,
      });
      const result = await pattern.execute({ test: 'input' });
      expect(result.status).toBe('completed');
      expect(result.outputs.modifications_applied).toBeGreaterThanOrEqual(0);
    });

    it('should track final node count', async () => {
      const pattern = new DynamicPattern({
        initial_nodes: testNodes,
        modification_rules: modificationRules,
      });
      const result = await pattern.execute({ test: 'input' });
      expect(result.outputs.final_node_count).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Runtime Modifications', () => {
    it('should add node at runtime', () => {
      const pattern = new DynamicPattern({
        initial_nodes: [testNodes[0]],
        allow_addition: true,
      });
      const newNode: AgentNode = {
        agent_id: 'dynamic_node',
        node_type: 'agent',
        inputs: {},
        outputs: {},
        config: { model: 'gpt-4', timeout: 5000 },
      };
      pattern.addNode(newNode);
      const state = pattern.getCurrentGraphState();
      expect(state.nodes).toHaveLength(2);
    });

    it('should reject node addition when disabled', () => {
      const pattern = new DynamicPattern({
        initial_nodes: testNodes,
        allow_addition: false,
      });
      const newNode: AgentNode = {
        agent_id: 'dynamic_node',
        node_type: 'agent',
        inputs: {},
        outputs: {},
        config: { model: 'gpt-4', timeout: 5000 },
      };
      expect(() => pattern.addNode(newNode)).toThrow();
    });

    it('should remove node at runtime', () => {
      const pattern = new DynamicPattern({
        initial_nodes: testNodes,
        allow_removal: true,
      });
      pattern.removeNode('agent1');
      const state = pattern.getCurrentGraphState();
      expect(state.nodes).toHaveLength(1);
    });

    it('should reject node removal when disabled', () => {
      const pattern = new DynamicPattern({
        initial_nodes: testNodes,
        allow_removal: false,
      });
      expect(() => pattern.removeNode('agent1')).toThrow();
    });

    it('should add modification rule', () => {
      const pattern = new DynamicPattern({
        initial_nodes: testNodes,
      });
      pattern.addModificationRule(modificationRules[0]);
      const config = pattern.getConfig();
      expect(config.modification_rules).toHaveLength(1);
    });

    it('should trigger manual modification', async () => {
      const pattern = new DynamicPattern({
        initial_nodes: testNodes,
      });
      await pattern.triggerManualModification(modificationRules[0]);
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Graph State', () => {
    it('should return current graph state', () => {
      const pattern = new DynamicPattern({
        initial_nodes: testNodes,
      });
      const state = pattern.getCurrentGraphState();
      expect(state.nodes).toHaveLength(2);
      expect(state.edges).toBeDefined();
    });
  });

  describe('Validation', () => {
    it('should validate correct configuration', () => {
      const pattern = new DynamicPattern({
        initial_nodes: testNodes,
      });
      const validation = pattern.validate();
      expect(validation.valid).toBe(true);
    });

    it('should reject invalid nodes', () => {
      const pattern = new DynamicPattern({
        initial_nodes: [
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
    });
  });
});

describe('createDynamicPattern', () => {
  it('should create pattern', () => {
    const pattern = createDynamicPattern({
      initial_nodes: testNodes,
    });
    expect(pattern).toBeInstanceOf(DynamicPattern);
  });
});

describe('executeDynamic', () => {
  it('should execute and return result', async () => {
    const result = await executeDynamic(
      testNodes,
      modificationRules,
      { test: 'input' }
    );
    expect(result.status).toBe('completed');
  });
});

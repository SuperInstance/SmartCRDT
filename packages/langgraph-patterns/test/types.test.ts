/**
 * @fileoverview Tests for core types and validation
 */

import { describe, it, expect } from 'vitest';
import {
  validateAgentNode,
  validateEdgeConnection,
  validateGraphConfig,
  validateExecutionResult,
  DEFAULT_GRAPH_CONFIG,
  PRODUCTION_GRAPH_CONFIG,
  MINIMAL_GRAPH_CONFIG,
  DEFAULT_RETRY_POLICY,
  type AgentNode,
  type EdgeConnection,
  type GraphConfig,
  type ExecutionResult,
  type ExecutionStatus,
  type GraphPattern,
  type MergeStrategy,
  type FallbackStrategy,
  type BubbleStrategy,
  type ModificationAction,
  type ModificationTrigger,
} from '../src/types.js';

describe('Type Definitions', () => {
  describe('GraphPattern Types', () => {
    it('should accept valid graph pattern types', () => {
      const patterns: GraphPattern[] = [
        'sequential',
        'parallel',
        'conditional',
        'recursive',
        'hierarchical',
        'dynamic',
      ];
      expect(patterns).toHaveLength(6);
    });
  });

  describe('ExecutionStatus Types', () => {
    it('should accept valid execution status types', () => {
      const statuses: ExecutionStatus[] = [
        'pending',
        'running',
        'paused',
        'completed',
        'failed',
        'cancelled',
      ];
      expect(statuses).toHaveLength(6);
    });
  });

  describe('MergeStrategy Types', () => {
    it('should accept valid merge strategy types', () => {
      const strategies: MergeStrategy[] = [
        'concat',
        'merge',
        'first',
        'majority',
        'custom',
      ];
      expect(strategies).toHaveLength(5);
    });
  });

  describe('FallbackStrategy Types', () => {
    it('should accept valid fallback strategy types', () => {
      const strategies: FallbackStrategy[] = [
        'skip',
        'terminate',
        'fallback',
        'retry',
        'partial',
      ];
      expect(strategies).toHaveLength(5);
    });
  });

  describe('BubbleStrategy Types', () => {
    it('should accept valid bubble strategy types', () => {
      const strategies: BubbleStrategy[] = [
        'immediate',
        'deferred',
        'selective',
        'aggregated',
      ];
      expect(strategies).toHaveLength(4);
    });
  });

  describe('ModificationAction Types', () => {
    it('should accept valid modification action types', () => {
      const actions: ModificationAction[] = [
        'add_node',
        'remove_node',
        'add_edge',
        'remove_edge',
        'reconfigure',
        'replace',
      ];
      expect(actions).toHaveLength(6);
    });
  });

  describe('ModificationTrigger Types', () => {
    it('should accept valid modification trigger types', () => {
      const triggers: ModificationTrigger[] = [
        'on_success',
        'on_failure',
        'on_timeout',
        'on_condition',
        'manual',
      ];
      expect(triggers).toHaveLength(5);
    });
  });
});

describe('Default Configurations', () => {
  describe('DEFAULT_GRAPH_CONFIG', () => {
    it('should have valid default values', () => {
      expect(DEFAULT_GRAPH_CONFIG.max_parallelism).toBeGreaterThan(0);
      expect(DEFAULT_GRAPH_CONFIG.timeout).toBeGreaterThan(0);
      expect(DEFAULT_GRAPH_CONFIG.enable_tracing).toBe(true);
      expect(DEFAULT_GRAPH_CONFIG.enable_caching).toBe(true);
    });

    it('should have valid retry policy', () => {
      expect(DEFAULT_GRAPH_CONFIG.retry_policy.max_attempts).toBeGreaterThan(0);
      expect(DEFAULT_GRAPH_CONFIG.retry_policy.base_delay).toBeGreaterThan(0);
      expect(DEFAULT_GRAPH_CONFIG.retry_policy.exponential_backoff).toBe(true);
    });
  });

  describe('PRODUCTION_GRAPH_CONFIG', () => {
    it('should have production-appropriate values', () => {
      expect(PRODUCTION_GRAPH_CONFIG.max_parallelism).toBeGreaterThanOrEqual(
        DEFAULT_GRAPH_CONFIG.max_parallelism
      );
      expect(PRODUCTION_GRAPH_CONFIG.timeout).toBeGreaterThanOrEqual(
        DEFAULT_GRAPH_CONFIG.timeout
      );
      expect(PRODUCTION_GRAPH_CONFIG.checkpoint?.enabled).toBe(true);
    });
  });

  describe('MINIMAL_GRAPH_CONFIG', () => {
    it('should have minimal values for testing', () => {
      expect(MINIMAL_GRAPH_CONFIG.max_parallelism).toBeLessThan(10);
      expect(MINIMAL_GRAPH_CONFIG.enable_tracing).toBe(false);
      expect(MINIMAL_GRAPH_CONFIG.enable_caching).toBe(false);
    });
  });

  describe('DEFAULT_RETRY_POLICY', () => {
    it('should have valid retry values', () => {
      expect(DEFAULT_RETRY_POLICY.max_attempts).toBe(3);
      expect(DEFAULT_RETRY_POLICY.base_delay).toBe(1000);
      expect(DEFAULT_RETRY_POLICY.exponential_backoff).toBe(true);
    });
  });
});

describe('Validation Functions', () => {
  describe('validateAgentNode', () => {
    it('should validate a correct agent node', () => {
      const node: AgentNode = {
        agent_id: 'test-agent',
        node_type: 'agent',
        inputs: {},
        outputs: {},
        config: {
          model: 'gpt-4',
          timeout: 5000,
        },
      };
      const result = validateAgentNode(node);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject node without agent_id', () => {
      const node = {
        agent_id: '',
        node_type: 'agent' as const,
        inputs: {},
        outputs: {},
        config: { model: 'gpt-4' },
      };
      const result = validateAgentNode(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('agent_id is required');
    });

    it('should reject node without model config', () => {
      const node = {
        agent_id: 'test',
        node_type: 'agent' as const,
        inputs: {},
        outputs: {},
        config: {} as any,
      };
      const result = validateAgentNode(node);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('model'))).toBe(true);
    });

    it('should reject node with negative timeout', () => {
      const node: AgentNode = {
        agent_id: 'test',
        node_type: 'agent',
        inputs: {},
        outputs: {},
        config: {
          model: 'gpt-4',
          timeout: -100,
        },
      };
      const result = validateAgentNode(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('config.timeout must be positive');
    });
  });

  describe('validateEdgeConnection', () => {
    it('should validate a correct edge connection', () => {
      const edge: EdgeConnection = {
        from_node: 'node1',
        to_node: 'node2',
        priority: 1,
      };
      const result = validateEdgeConnection(edge);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject edge without from_node', () => {
      const edge = {
        from_node: '',
        to_node: 'node2',
      };
      const result = validateEdgeConnection(edge);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('from_node is required');
    });

    it('should reject edge without to_node', () => {
      const edge = {
        from_node: 'node1',
        to_node: '',
      };
      const result = validateEdgeConnection(edge);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('to_node is required');
    });

    it('should reject self-referential edge', () => {
      const edge = {
        from_node: 'node1',
        to_node: 'node1',
      };
      const result = validateEdgeConnection(edge);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('cannot be the same'))).toBe(true);
    });

    it('should reject edge with negative priority', () => {
      const edge: EdgeConnection = {
        from_node: 'node1',
        to_node: 'node2',
        priority: -1,
      };
      const result = validateEdgeConnection(edge);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('priority must be non-negative');
    });
  });

  describe('validateGraphConfig', () => {
    it('should validate correct graph config', () => {
      const config: GraphConfig = {
        ...DEFAULT_GRAPH_CONFIG,
      };
      const result = validateGraphConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject config with non-positive max_parallelism', () => {
      const config: GraphConfig = {
        ...DEFAULT_GRAPH_CONFIG,
        max_parallelism: 0,
      };
      const result = validateGraphConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('max_parallelism must be positive');
    });

    it('should reject config with non-positive timeout', () => {
      const config: GraphConfig = {
        ...DEFAULT_GRAPH_CONFIG,
        timeout: 0,
      };
      const result = validateGraphConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('timeout must be positive');
    });

    it('should reject config with negative max_attempts', () => {
      const config: GraphConfig = {
        ...DEFAULT_GRAPH_CONFIG,
        retry_policy: {
          ...DEFAULT_GRAPH_CONFIG.retry_policy,
          max_attempts: -1,
        },
      };
      const result = validateGraphConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('retry_policy.max_attempts cannot be negative');
    });

    it('should warn about checkpoint without connection_string', () => {
      const config: GraphConfig = {
        ...DEFAULT_GRAPH_CONFIG,
        checkpoint: {
          enabled: true,
          interval: 5,
          storage: 'postgres',
          max_checkpoints: 10,
        },
      };
      const result = validateGraphConfig(config);
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('connection_string'))).toBe(true);
    });
  });

  describe('validateExecutionResult', () => {
    it('should validate correct execution result', () => {
      const result: ExecutionResult = {
        status: 'completed',
        outputs: { test: 'data' },
        metrics: {
          total_time: 1000,
          node_times: new Map(),
          nodes_executed: 1,
          nodes_failed: 0,
          nodes_retried: 0,
          tokens_used: 100,
          memory_used: 0,
          cache_hit_rate: 0,
        },
        errors: [],
        trace: {
          entries: [],
          initial_topology: {
            nodes: new Map(),
            edges: [],
            entry_points: [],
            exit_points: [],
          },
          checkpoint_snapshots: [],
        },
      };
      const validation = validateExecutionResult(result);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject result with negative total_time', () => {
      const result: ExecutionResult = {
        status: 'completed',
        outputs: {},
        metrics: {
          total_time: -100,
          node_times: new Map(),
          nodes_executed: 0,
          nodes_failed: 0,
          nodes_retried: 0,
          tokens_used: 0,
          memory_used: 0,
          cache_hit_rate: 0,
        },
        errors: [],
        trace: {
          entries: [],
          initial_topology: {
            nodes: new Map(),
            edges: [],
            entry_points: [],
            exit_points: [],
          },
          checkpoint_snapshots: [],
        },
      };
      const validation = validateExecutionResult(result);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('metrics.total_time cannot be negative');
    });

    it('should reject completed status with errors', () => {
      const result: ExecutionResult = {
        status: 'completed',
        outputs: {},
        metrics: {
          total_time: 100,
          node_times: new Map(),
          nodes_executed: 1,
          nodes_failed: 0,
          nodes_retried: 0,
          tokens_used: 0,
          memory_used: 0,
          cache_hit_rate: 0,
        },
        errors: [
          {
            node_id: 'test',
            message: 'Test error',
            timestamp: Date.now(),
            recoverable: true,
          },
        ],
        trace: {
          entries: [],
          initial_topology: {
            nodes: new Map(),
            edges: [],
            entry_points: [],
            exit_points: [],
          },
          checkpoint_snapshots: [],
        },
      };
      const validation = validateExecutionResult(result);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('completed status cannot have errors');
    });
  });
});

describe('Type Compatibility', () => {
  it('should allow GraphConfig in pattern constructors', () => {
    const config: GraphConfig = DEFAULT_GRAPH_CONFIG;
    expect(config).toBeDefined();
    expect(config.max_parallelism).toBeTypeOf('number');
  });

  it('should allow AgentNode arrays in patterns', () => {
    const nodes: AgentNode[] = [
      {
        agent_id: 'agent1',
        node_type: 'agent',
        inputs: {},
        outputs: {},
        config: { model: 'gpt-4' },
      },
      {
        agent_id: 'agent2',
        node_type: 'agent',
        inputs: {},
        outputs: {},
        config: { model: 'gpt-4' },
      },
    ];
    expect(nodes).toHaveLength(2);
  });
});

describe('Edge Cases', () => {
  it('should handle empty agent node inputs/outputs', () => {
    const node: AgentNode = {
      agent_id: 'test',
      node_type: 'agent',
      inputs: {},
      outputs: {},
      config: { model: 'gpt-4' },
    };
    const result = validateAgentNode(node);
    expect(result.valid).toBe(true);
  });

  it('should handle edge connection without condition', () => {
    const edge: EdgeConnection = {
      from_node: 'node1',
      to_node: 'node2',
    };
    const result = validateEdgeConnection(edge);
    expect(result.valid).toBe(true);
  });

  it('should handle graph config without checkpoint', () => {
    const config: GraphConfig = {
      ...DEFAULT_GRAPH_CONFIG,
      checkpoint: undefined,
    };
    const result = validateGraphConfig(config);
    expect(result.valid).toBe(true);
  });
});

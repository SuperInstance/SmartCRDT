/**
 * @fileoverview Tests for Integration Layer
 */

import { describe, it, expect } from 'vitest';
import {
  LangGraphPatternIntegration,
  CoAgentsPatternIntegration,
  VLJEPAPatternIntegration,
  A2UIPatternIntegration,
  UnifiedPatternIntegration,
  createLangGraphPattern,
  createCoAgentsPattern,
  createVisualNode,
  createUINode,
  createMultiModalPattern,
  executeMultiModalPattern,
  type AgentNode,
  type GraphPattern,
} from '../src/integration.js';

describe('LangGraphPatternIntegration', () => {
  let integration: LangGraphPatternIntegration;
  let testNodes: AgentNode[];

  beforeEach(() => {
    integration = new LangGraphPatternIntegration();
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
  });

  describe('StateGraph Creation', () => {
    it('should create sequential state graph', () => {
      const stateGraph = integration.createStateGraph('sequential', testNodes);
      expect(stateGraph).toBeDefined();
    });

    it('should create parallel state graph', () => {
      const stateGraph = integration.createStateGraph('parallel', testNodes);
      expect(stateGraph).toBeDefined();
    });

    it('should create conditional state graph', () => {
      const stateGraph = integration.createStateGraph('conditional', testNodes);
      expect(stateGraph).toBeDefined();
    });
  });

  describe('Node Mappings', () => {
    it('should track node mappings', () => {
      integration.createStateGraph('sequential', testNodes);
      const langgraphIntegration = integration.getIntegration();
      expect(langgraphIntegration.node_mappings.size).toBe(2);
    });
  });
});

describe('CoAgentsPatternIntegration', () => {
  let integration: CoAgentsPatternIntegration;
  let testNodes: AgentNode[];

  beforeEach(() => {
    integration = new CoAgentsPatternIntegration();
    testNodes = [
      {
        agent_id: 'agent1',
        node_type: 'agent',
        inputs: {},
        outputs: {},
        config: { model: 'gpt-4', timeout: 5000 },
      },
    ];
  });

  describe('Pattern Creation', () => {
    it('should create CoAgents pattern', () => {
      const pattern = integration.createCoAgentsPattern('sequential', testNodes);
      expect(pattern).toBeDefined();
      expect(pattern.type).toBe('sequential');
    });
  });

  describe('State Mapping', () => {
    it('should map pattern state to CoAgents state', () => {
      integration.createCoAgentsPattern('sequential', testNodes);
      const graphState = {
        execution_id: 'test',
        current_path: [],
        outputs: new Map([['agent1', { result: 'test' }]]),
        errors: [],
        metadata: {
          started_at: Date.now(),
          nodes_executed: 1,
          nodes_remaining: 0,
          status: 'completed' as const,
        },
        state: {},
      };
      const coagentsState = integration.mapToCoAgentsState(graphState);
      expect(coagentsState).toBeDefined();
    });
  });

  describe('Checkpointing', () => {
    it('should enable checkpointing', () => {
      integration.enableCheckpointing({
        enabled: true,
        interval: 10,
        storage: 'redis',
        max_checkpoints: 50,
      });
      const config = integration.getIntegration().checkpoint_config;
      expect(config.enabled).toBe(true);
      expect(config.interval).toBe(10);
    });
  });
});

describe('VLJEPAPatternIntegration', () => {
  let integration: VLJEPAPatternIntegration;

  beforeEach(() => {
    integration = new VLJEPAPatternIntegration();
  });

  describe('Visual Node Creation', () => {
    it('should create visual node for image', () => {
      const node = integration.createVisualNode('visual1', {
        type: 'image',
        data: new Uint8Array([1, 2, 3]),
      });
      expect(node.agent_id).toBe('visual1');
      expect(node.inputs.visual_input).toBeDefined();
    });

    it('should create visual node for UI frame', () => {
      const node = integration.createVisualNode('visual2', {
        type: 'ui_frame',
        data: { width: 1920, height: 1080 },
      });
      expect(node.agent_id).toBe('visual2');
    });

    it('should create visual node for video', () => {
      const node = integration.createVisualNode('visual3', {
        type: 'video',
        data: { frames: [] },
      });
      expect(node.agent_id).toBe('visual3');
    });
  });

  describe('Visual Processing', () => {
    it('should process visual input', async () => {
      const result = await integration.processVisualInput('test', {
        type: 'image',
        data: new Uint8Array([1, 2, 3]),
      });
      expect(result.embedding).toBeInstanceOf(Float32Array);
      expect(result.embedding.length).toBe(768);
      expect(result.prediction).toBeDefined();
    });
  });

  describe('Visual Mappings', () => {
    it('should track visual mappings', () => {
      integration.createVisualNode('visual1', { type: 'image', data: new Uint8Array() });
      const vljepaIntegration = integration.getIntegration();
      expect(vljepaIntegration.visual_mappings.has('visual1')).toBe(true);
    });
  });
});

describe('A2UIPatternIntegration', () => {
  let integration: A2UIPatternIntegration;

  beforeEach(() => {
    integration = new A2UIPatternIntegration();
  });

  describe('UI Node Creation', () => {
    it('should create UI node', () => {
      const node = integration.createUINode('ui1');
      expect(node.agent_id).toBe('ui1');
      expect(node.outputs.a2ui_response).toBeDefined();
    });
  });

  describe('Component Catalog', () => {
    it('should list available components', () => {
      const components = integration.listComponents();
      expect(components.length).toBeGreaterThan(0);
      expect(components).toContain('Button');
      expect(components).toContain('Input');
    });

    it('should get component from catalog', () => {
      const button = integration.getComponent('Button');
      expect(button).toBeDefined();
      expect(button?.type).toBe('Button');
    });

    it('should register custom component', () => {
      integration.registerComponent('CustomComponent', {
        type: 'CustomComponent',
        props: { customProp: 'value' },
      });
      const component = integration.getComponent('CustomComponent');
      expect(component).toBeDefined();
    });
  });

  describe('A2UI Response Generation', () => {
    it('should generate A2UI response from execution result', () => {
      const executionResult = {
        status: 'completed' as const,
        outputs: {
          field1: 'value1',
          field2: { nested: 'value2' },
        },
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
      const response = integration.generateA2UIResponse(executionResult);
      expect(response.components).toBeDefined();
      expect(response.layout).toBeDefined();
      expect(response.components.length).toBeGreaterThan(0);
    });
  });
});

describe('UnifiedPatternIntegration', () => {
  let integration: UnifiedPatternIntegration;

  beforeEach(() => {
    integration = new UnifiedPatternIntegration();
  });

  describe('Multi-Modal Pattern Creation', () => {
    it('should create pattern with text and visual nodes', () => {
      const textNodes: AgentNode[] = [
        {
          agent_id: 'text1',
          node_type: 'agent',
          inputs: {},
          outputs: {},
          config: { model: 'gpt-4', timeout: 5000 },
        },
      ];

      const visualNodes = [
        { id: 'visual1', visualInput: { type: 'image', data: new Uint8Array() } },
      ];

      const pattern = integration.createMultiModalPattern({
        textNodes,
        visualNodes,
        uiNodeId: 'ui1',
        patternType: 'sequential',
      });
      expect(pattern).toBeDefined();
    });
  });

  describe('Integration Accessors', () => {
    it('should provide LangGraph integration', () => {
      const langgraph = integration.langgraphIntegration();
      expect(langgraph).toBeInstanceOf(LangGraphPatternIntegration);
    });

    it('should provide CoAgents integration', () => {
      const coagents = integration.coagentsIntegration();
      expect(coagents).toBeInstanceOf(CoAgentsPatternIntegration);
    });

    it('should provide VL-JEPA integration', () => {
      const vljepa = integration.vljepaIntegration();
      expect(vljepa).toBeInstanceOf(VLJEPAPatternIntegration);
    });

    it('should provide A2UI integration', () => {
      const a2ui = integration.a2uiIntegration();
      expect(a2ui).toBeInstanceOf(A2UIPatternIntegration);
    });
  });
});

describe('Convenience Functions', () => {
  describe('createLangGraphPattern', () => {
    it('should create LangGraph pattern', () => {
      const nodes: AgentNode[] = [
        {
          agent_id: 'agent1',
          node_type: 'agent',
          inputs: {},
          outputs: {},
          config: { model: 'gpt-4', timeout: 5000 },
        },
      ];
      const pattern = createLangGraphPattern('sequential', nodes);
      expect(pattern).toBeDefined();
    });
  });

  describe('createCoAgentsPattern', () => {
    it('should create CoAgents pattern', () => {
      const nodes: AgentNode[] = [
        {
          agent_id: 'agent1',
          node_type: 'agent',
          inputs: {},
          outputs: {},
          config: { model: 'gpt-4', timeout: 5000 },
        },
      ];
      const pattern = createCoAgentsPattern('sequential', nodes);
      expect(pattern).toBeDefined();
    });
  });

  describe('createVisualNode', () => {
    it('should create visual node', () => {
      const node = createVisualNode('visual1', {
        type: 'image',
        data: new Uint8Array(),
      });
      expect(node.agent_id).toBe('visual1');
    });
  });

  describe('createUINode', () => {
    it('should create UI node', () => {
      const node = createUINode('ui1');
      expect(node.agent_id).toBe('ui1');
    });
  });

  describe('createMultiModalPattern', () => {
    it('should create multi-modal pattern', () => {
      const textNodes: AgentNode[] = [
        {
          agent_id: 'text1',
          node_type: 'agent',
          inputs: {},
          outputs: {},
          config: { model: 'gpt-4', timeout: 5000 },
        },
      ];
      const pattern = createMultiModalPattern({
        textNodes,
        patternType: 'sequential',
      });
      expect(pattern).toBeDefined();
    });
  });
});

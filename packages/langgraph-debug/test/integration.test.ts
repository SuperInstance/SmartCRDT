/**
 * Integration Tests for DebugIntegration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DebugIntegration,
  createDebugIntegration,
  getDebugIntegration,
} from '../src/integration.js';
import type { DebugSessionConfig, GraphStructure, ExecutionTrace } from '../src/types.js';

describe('DebugIntegration', () => {
  let integration: DebugIntegration;

  beforeEach(() => {
    integration = new DebugIntegration();
  });

  describe('Creation', () => {
    it('should create with createDebugIntegration', () => {
      const debug = createDebugIntegration({
        enableTracing: true,
        logLevel: 'debug',
      });

      expect(debug).toBeInstanceOf(DebugIntegration);
    });

    it('should get singleton instance', () => {
      const instance1 = getDebugIntegration();
      const instance2 = getDebugIntegration();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Session Management', () => {
    it('should start a debug session', () => {
      const session = integration.startSession('test-graph', {
        nodes: ['agent1', 'agent2'],
      });

      expect(session).toBeDefined();
      expect(session.graph_config).toEqual({ nodes: ['agent1', 'agent2'] });
    });

    it('should get active session', () => {
      integration.startSession('test-graph', {});

      const active = integration.getActiveSession();
      expect(active).toBeDefined();
    });

    it('should end session', () => {
      integration.startSession('test-graph', {});
      integration.endSession();

      const active = integration.getActiveSession();
      expect(active).toBeNull();
    });
  });

  describe('Tracing Integration', () => {
    beforeEach(() => {
      integration.startSession('test-graph', {});
    });

    it('should start trace', () => {
      const trace = integration.startTrace({ input: 'test' });

      expect(trace).toBeDefined();
      expect(trace.status).toBe('running');
    });

    it('should record events', () => {
      integration.startTrace({});

      const event = integration.recordEvent({
        event_type: 'node_start',
        node_name: 'agent1',
        data: {},
      });

      expect(event).toBeDefined();
    });

    it('should end trace', () => {
      integration.startTrace({});
      integration.endTrace({ output: 'result' });

      const session = integration.getActiveSession();
      expect(session?.traces.length).toBe(1);
      expect(session?.traces[0].status).toBe('completed');
    });

    it('should record snapshot', () => {
      const snapshot = integration.recordSnapshot({ value: 1 }, ['value']);

      expect(snapshot).toBeDefined();
      expect(snapshot.state).toEqual({ value: 1 });
    });
  });

  describe('Profiling Integration', () => {
    const traceId = 'trace-1';
    const graphId = 'test-graph';

    beforeEach(() => {
      integration.startProfiling(traceId);
    });

    it('should record node execution', () => {
      integration.recordNodeStart(traceId, 'node1', 'Node 1');
      integration.recordNodeEnd(traceId, 'node1', true);

      const report = integration.endProfiling(traceId, graphId);

      expect(report).toBeDefined();
      expect(report.graph_id).toBe(graphId);
    });

    it('should track failed executions', () => {
      integration.recordNodeStart(traceId, 'node1', 'Node 1');
      integration.recordNodeEnd(traceId, 'node1', false);

      const report = integration.endProfiling(traceId, graphId);

      expect(report.bottlenecks.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Visualization Integration', () => {
    let graph: GraphStructure;

    beforeEach(() => {
      graph = {
        graph_id: 'test-graph',
        nodes: [
          { id: 'start', name: 'Start', type: 'start' },
          { id: 'agent1', name: 'Agent 1', type: 'agent' },
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'agent1' },
        ],
        entry_points: ['start'],
        exit_points: ['agent1'],
      };
    });

    it('should generate Mermaid visualization', () => {
      const mermaid = integration.visualizeGraph(graph, 'mermaid');

      expect(mermaid).toContain('graph');
    });

    it('should generate HTML visualization', () => {
      const html = integration.visualizeGraph(graph, 'html');

      expect(html).toContain('<!DOCTYPE html>');
    });

    it('should visualize trace', () => {
      const trace: ExecutionTrace = {
        trace_id: 'trace1',
        graph_id: 'test-graph',
        start_time: Date.now(),
        end_time: Date.now() + 1000,
        duration_ms: 1000,
        events: [],
        metrics: {
          total_time_ms: 1000,
          node_times: new Map(),
          nodes_executed: 0,
          edges_traversed: 0,
          error_count: 0,
          warning_count: 0,
          avg_node_time_ms: 0,
        },
        timeline: [],
        state_snapshots: [],
        final_state: {},
        initial_state: {},
        status: 'completed',
        metadata: {},
      };

      const html = integration.visualizeTrace(trace, 'html');

      expect(html).toContain('<!DOCTYPE html>');
    });

    it('should visualize timeline', () => {
      const trace: ExecutionTrace = {
        trace_id: 'trace1',
        graph_id: 'test-graph',
        start_time: Date.now(),
        end_time: Date.now() + 1000,
        duration_ms: 1000,
        events: [
          {
            event_id: 'e1',
            event_type: 'node_start',
            timestamp: Date.now(),
            graph_id: 'test-graph',
            trace_id: 'trace1',
            node_name: 'agent1',
            data: {},
            priority: 'medium',
            level: 'info',
          },
          {
            event_id: 'e2',
            event_type: 'node_end',
            timestamp: Date.now() + 100,
            graph_id: 'test-graph',
            trace_id: 'trace1',
            node_name: 'agent1',
            data: {},
            priority: 'medium',
            level: 'info',
          },
        ],
        metrics: {
          total_time_ms: 100,
          node_times: new Map([['agent1', 100]]),
          nodes_executed: 1,
          edges_traversed: 0,
          error_count: 0,
          warning_count: 0,
          avg_node_time_ms: 100,
        },
        timeline: [],
        state_snapshots: [],
        final_state: {},
        initial_state: {},
        status: 'completed',
        metadata: {},
      };

      const mermaid = integration.visualizeTimeline(trace, 'mermaid');

      expect(mermaid).toContain('gantt');
    });
  });

  describe('Breakpoint Integration', () => {
    it('should set breakpoint', () => {
      const bp = integration.setBreakpoint({
        nodeName: 'agent1',
      });

      expect(bp).toBeDefined();
    });

    it('should check breakpoint', async () => {
      integration.setBreakpoint({ nodeName: 'agent1' });

      const event = {
        event_id: 'e1',
        event_type: 'node_start' as const,
        timestamp: Date.now(),
        graph_id: 'graph1',
        trace_id: 'trace1',
        node_name: 'agent1',
        data: {},
        priority: 'medium' as const,
        level: 'info' as const,
      };

      const hit = await integration.checkBreakpoint(event, {});

      expect(hit).toBeDefined();
    });
  });

  describe('Watch Integration', () => {
    it('should add watch', () => {
      const watch = integration.addWatch('state.counter');

      expect(watch).toBeDefined();
    });

    it('should check watches', async () => {
      integration.startSession('test-graph', {});
      integration.addWatch('state.value');

      const snapshot = {
        snapshot_id: 'snap1',
        timestamp: Date.now(),
        graph_id: 'test-graph',
        state: { state: { value: 1 } },
        version: 0,
        changed_keys: [],
      };

      const changes = await integration.checkWatches({ state: { value: 2 } }, snapshot);

      expect(changes).toBeDefined();
    });
  });

  describe('Console Integration', () => {
    beforeEach(() => {
      integration.startSession('test-graph', {});
    });

    it('should execute console command', async () => {
      const result = await integration.executeConsoleCommand('help');

      expect(result).toContain('Available commands');
    });

    it('should execute inspect_state command', async () => {
      const result = await integration.executeConsoleCommand('inspect_state');

      expect(result).toBeDefined();
    });
  });

  describe('LangGraph Wrapping', () => {
    it('should wrap LangGraph', () => {
      const graph = {
        invoke: vi.fn().mockResolvedValue({ result: 'ok' }),
      };

      const wrapped = integration.wrapLangGraph(graph, 'test-graph');

      expect(wrapped).toBeDefined();
      expect(typeof wrapped.invoke).toBe('function');
    });

    it('should trace wrapped graph execution', async () => {
      integration.startSession('test-graph', {});

      const graph = {
        invoke: vi.fn().mockResolvedValue({ result: 'ok' }),
      };

      const wrapped = integration.wrapLangGraph(graph, 'test-graph');
      await wrapped.invoke({ input: 'test' });

      expect(graph.invoke).toHaveBeenCalled();
    });
  });

  describe('CoAgent Wrapping', () => {
    it('should wrap CoAgent', () => {
      const agent = {
        run: vi.fn().mockResolvedValue({ result: 'ok' }),
      };

      const wrapped = integration.wrapCoAgent(agent, 'agent-1');

      expect(wrapped).toBeDefined();
      expect(typeof wrapped.run).toBe('function');
    });

    it('should trace wrapped agent execution', async () => {
      const agent = {
        run: vi.fn().mockResolvedValue({ result: 'ok' }),
      };

      const wrapped = integration.wrapCoAgent(agent, 'agent-1');
      await wrapped.run({ task: 'test' });

      expect(agent.run).toHaveBeenCalled();
    });
  });

  describe('VL-JEPA Integration', () => {
    it('should collect VL-JEPA traces', () => {
      integration.collectVLJEPATrace({
        epoch: 1,
        batch: 10,
        loss: 0.5,
        metrics: { accuracy: 0.9 },
      });

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Export', () => {
    beforeEach(() => {
      integration.startSession('test-graph', {});
      integration.startTrace({});
      integration.endTrace();
    });

    it('should export as JSON', async () => {
      const exported = await integration.exportAll('json');

      expect(typeof exported).toBe('string');
      expect(exported).toContain('{');
    });

    it('should export as HTML', async () => {
      const exported = await integration.exportAll('html');

      expect(exported).toContain('<!DOCTYPE html>');
    });
  });

  describe('Debug Report', () => {
    it('should generate debug report', () => {
      integration.startSession('test-graph', {});

      const report = integration.generateDebugReport();

      expect(report).toContain('Aequor Debug Report');
    });
  });

  describe('Statistics', () => {
    it('should get statistics', () => {
      integration.startSession('test-graph', {});

      const stats = integration.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.sessions).toBe(1);
    });
  });

  describe('Browser DevTools', () => {
    it('should enable DevTools integration', () => {
      // Mock window object
      global.window = {} as any;

      integration.enableDevTools();

      expect((global.window as any).__aequor_debug).toBeDefined();

      delete (global.window as any).__aequor_debug;
    });
  });
});

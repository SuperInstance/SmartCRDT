/**
 * Tests for GraphVisualizer
 */

import { describe, it, expect } from 'vitest';
import { GraphVisualizer } from '../src/GraphVisualizer.js';
import type { GraphStructure, ExecutionTrace, TraceEvent } from '../src/types.js';

describe('GraphVisualizer', () => {
  let visualizer: GraphVisualizer;
  let graph: GraphStructure;

  beforeEach(() => {
    visualizer = new GraphVisualizer();
    graph = {
      graph_id: 'test-graph',
      nodes: [
        { id: 'start', name: 'Start', type: 'start' },
        { id: 'agent1', name: 'Agent 1', type: 'agent' },
        { id: 'router', name: 'Router', type: 'router' },
        { id: 'agent2', name: 'Agent 2', type: 'agent' },
        { id: 'end', name: 'End', type: 'end' },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'agent1' },
        { id: 'e2', source: 'agent1', target: 'router' },
        { id: 'e3', source: 'router', target: 'agent2', condition: 'value > 10' },
        { id: 'e4', source: 'agent2', target: 'end' },
      ],
      entry_points: ['start'],
      exit_points: ['end'],
    };
  });

  describe('Mermaid Generation', () => {
    it('should generate Mermaid diagram', () => {
      const mermaid = visualizer.generateVisualization(graph, {
        format: 'mermaid',
      });

      expect(mermaid).toContain('graph');
      expect(mermaid).toContain('start');
      expect(mermaid).toContain('agent1');
      expect(mermaid).toContain('router');
      expect(mermaid).toContain('-->');
    });

    it('should include edge conditions', () => {
      const mermaid = visualizer.generateVisualization(graph, {
        format: 'mermaid',
        show_edge_labels: true,
      });

      expect(mermaid).toContain('value > 10');
    });

    it('should support left-right layout', () => {
      const mermaid = visualizer.generateVisualization(graph, {
        format: 'mermaid',
        layout: 'left-right',
      });

      expect(mermaid).toContain('LR');
    });

    it('should highlight execution path', () => {
      const mermaid = visualizer.generateVisualization(graph, {
        format: 'mermaid',
        highlight_path: ['start', 'agent1', 'router', 'agent2', 'end'],
      });

      expect(mermaid).toContain('highlighted');
    });
  });

  describe('Graphviz Generation', () => {
    it('should generate Graphviz DOT file', () => {
      const dot = visualizer.generateVisualization(graph, {
        format: 'graphviz',
      });

      expect(dot).toContain('digraph');
      expect(dot).toContain('rankdir');
      expect(dot).toContain('->');
    });

    it('should include node shapes', () => {
      const dot = visualizer.generateVisualization(graph, {
        format: 'graphviz',
      });

      expect(dot).toContain('shape=');
      expect(dot).toContain('fillcolor=');
    });

    it('should support different layouts', () => {
      const dot = visualizer.generateVisualization(graph, {
        format: 'graphviz',
        layout: 'left-right',
      });

      expect(dot).toContain('rankdir=LR');
    });
  });

  describe('JSON Generation', () => {
    it('should generate JSON representation', () => {
      const json = visualizer.generateVisualization(graph, {
        format: 'json',
      });

      const parsed = JSON.parse(json);
      expect(parsed.graph_id).toBe('test-graph');
      expect(Array.isArray(parsed.nodes)).toBe(true);
      expect(Array.isArray(parsed.edges)).toBe(true);
    });

    it('should include highlight information', () => {
      const json = visualizer.generateVisualization(graph, {
        format: 'json',
        highlight_path: ['start', 'agent1'],
      });

      const parsed = JSON.parse(json);
      const startNode = parsed.nodes.find((n: any) => n.id === 'start');
      expect(startNode.highlighted).toBe(true);
    });
  });

  describe('HTML Generation', () => {
    it('should generate HTML visualization', () => {
      const html = visualizer.generateVisualization(graph, {
        format: 'html',
      });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<svg');
      expect(html).toContain('test-graph');
    });

    it('should include CSS styles', () => {
      const html = visualizer.generateVisualization(graph, {
        format: 'html',
      });

      expect(html).toContain('<style>');
      expect(html).toContain('.node');
    });

    it('should include legend', () => {
      const html = visualizer.generateVisualization(graph, {
        format: 'html',
      });

      expect(html).toContain('legend');
    });
  });

  describe('SVG Generation', () => {
    it('should generate SVG visualization', () => {
      const svg = visualizer.generateVisualization(graph, {
        format: 'svg',
      });

      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
      expect(svg).toContain('xmlns=');
    });

    it('should include node rectangles', () => {
      const svg = visualizer.generateVisualization(graph, {
        format: 'svg',
      });

      expect(svg).toContain('<rect');
    });

    it('should include edge lines', () => {
      const svg = visualizer.generateVisualization(graph, {
        format: 'svg',
      });

      expect(svg).toContain('<line');
    });
  });

  describe('Trace Visualization', () => {
    let trace: ExecutionTrace;

    beforeEach(() => {
      const events: TraceEvent[] = [
        {
          event_id: 'e1',
          event_type: 'graph_start',
          timestamp: 1000,
          graph_id: 'test-graph',
          trace_id: 'trace1',
          data: {},
          priority: 'medium',
          level: 'info',
        },
        {
          event_id: 'e2',
          event_type: 'node_start',
          timestamp: 1100,
          graph_id: 'test-graph',
          trace_id: 'trace1',
          node_name: 'agent1',
          data: {},
          priority: 'medium',
          level: 'info',
        },
        {
          event_id: 'e3',
          event_type: 'node_end',
          timestamp: 1200,
          graph_id: 'test-graph',
          trace_id: 'trace1',
          node_name: 'agent1',
          data: {},
          priority: 'medium',
          level: 'info',
        },
        {
          event_id: 'e4',
          event_type: 'graph_end',
          timestamp: 1300,
          graph_id: 'test-graph',
          trace_id: 'trace1',
          data: {},
          priority: 'medium',
          level: 'info',
        },
      ];

      trace = {
        trace_id: 'trace1',
        graph_id: 'test-graph',
        start_time: 1000,
        end_time: 1300,
        duration_ms: 300,
        events,
        metrics: {
          total_time_ms: 300,
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
    });

    it('should extract graph from trace', () => {
      const extractedGraph = visualizer.graphFromTrace(trace);

      expect(extractedGraph.graph_id).toBe('test-graph');
      expect(extractedGraph.nodes.length).toBeGreaterThan(0);
      expect(extractedGraph.edges.length).toBeGreaterThanOrEqual(0);
    });

    it('should highlight execution path', () => {
      const extractedGraph = visualizer.graphFromTrace(trace);
      const path = visualizer.highlightExecutionPath(extractedGraph, trace);

      expect(Array.isArray(path)).toBe(true);
      expect(path.length).toBeGreaterThan(0);
    });

    it('should get node statistics', () => {
      const stats = visualizer.getNodeStatistics(trace);

      expect(stats).toBeDefined();
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe('Color Schemes', () => {
    it('should use default color scheme', () => {
      const html = visualizer.generateVisualization(graph, {
        format: 'html',
        color_scheme: 'default',
      });

      expect(html).toContain('#4299e1'); // Agent color
    });

    it('should use pastel color scheme', () => {
      const html = visualizer.generateVisualization(graph, {
        format: 'html',
        color_scheme: 'pastel',
      });

      expect(html).toContain('#bee3f8');
    });

    it('should use vibrant color scheme', () => {
      const html = visualizer.generateVisualization(graph, {
        format: 'html',
        color_scheme: 'vibrant',
      });

      expect(html).toContain('#0066cc');
    });

    it('should use monochrome color scheme', () => {
      const html = visualizer.generateVisualization(graph, {
        format: 'html',
        color_scheme: 'monochrome',
      });

      expect(html).toContain('#4a5568');
    });
  });

  describe('Visualization Options', () => {
    it('should show timing information', () => {
      const graphWithTiming: GraphStructure = {
        ...graph,
        nodes: [
          { ...graph.nodes[0], total_time_ms: 100, execution_count: 5 },
        ],
      };

      const html = visualizer.generateVisualization(graphWithTiming, {
        format: 'html',
        show_timing: true,
      });

      expect(html).toContain('100ms');
    });

    it('should show labels', () => {
      const mermaid = visualizer.generateVisualization(graph, {
        format: 'mermaid',
        show_labels: true,
      });

      expect(mermaid).toContain('Start');
      expect(mermaid).toContain('Agent 1');
    });

    it('should hide labels', () => {
      const mermaid = visualizer.generateVisualization(graph, {
        format: 'mermaid',
        show_labels: false,
      });

      expect(mermaid).toContain('start');
      expect(mermaid).toContain('agent1');
    });
  });
});

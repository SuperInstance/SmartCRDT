/**
 * Tests for TimelineView
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TimelineView } from '../src/TimelineView.js';
import type { ExecutionTrace, TimelineEntry } from '../src/types.js';

describe('TimelineView', () => {
  let timeline: TimelineView;
  let trace: ExecutionTrace;

  beforeEach(() => {
    timeline = new TimelineView();

    const now = Date.now();
    trace = {
      trace_id: 'trace1',
      graph_id: 'graph1',
      start_time: now,
      end_time: now + 1000,
      duration_ms: 1000,
      events: [
        {
          event_id: 'e1',
          event_type: 'node_start',
          timestamp: now,
          graph_id: 'graph1',
          trace_id: 'trace1',
          node_name: 'agent1',
          agent_id: 'agent1',
          data: {},
          priority: 'medium',
          level: 'info',
        },
        {
          event_id: 'e2',
          event_type: 'node_end',
          timestamp: now + 200,
          graph_id: 'graph1',
          trace_id: 'trace1',
          node_name: 'agent1',
          agent_id: 'agent1',
          data: {},
          priority: 'medium',
          level: 'info',
        },
        {
          event_id: 'e3',
          event_type: 'node_start',
          timestamp: now + 300,
          graph_id: 'graph1',
          trace_id: 'trace1',
          node_name: 'agent2',
          agent_id: 'agent2',
          data: {},
          priority: 'medium',
          level: 'info',
        },
        {
          event_id: 'e4',
          event_type: 'node_end',
          timestamp: now + 700,
          graph_id: 'graph1',
          trace_id: 'trace1',
          node_name: 'agent2',
          agent_id: 'agent2',
          data: {},
          priority: 'medium',
          level: 'info',
        },
      ],
      metrics: {
        total_time_ms: 1000,
        node_times: new Map([['agent1', 200], ['agent2', 400]]),
        nodes_executed: 2,
        edges_traversed: 1,
        error_count: 0,
        warning_count: 0,
        avg_node_time_ms: 300,
      },
      timeline: [],
      state_snapshots: [],
      final_state: {},
      initial_state: {},
      status: 'completed',
      metadata: {},
    };
  });

  describe('Timeline Generation', () => {
    it('should generate timeline entries', () => {
      const entries = timeline.generateTimeline(trace);

      expect(entries.length).toBe(2);
      expect(entries[0].node_name).toBe('agent1');
      expect(entries[1].node_name).toBe('agent2');
    });

    it('should calculate entry durations', () => {
      const entries = timeline.generateTimeline(trace);

      expect(entries[0].duration_ms).toBe(200);
      expect(entries[1].duration_ms).toBe(400);
    });

    it('should mark entries as completed', () => {
      const entries = timeline.generateTimeline(trace);

      expect(entries.every(e => e.status === 'completed')).toBe(true);
    });

    it('should handle errors', () => {
      const errorTrace = { ...trace };
      errorTrace.events.push({
        event_id: 'e5',
        event_type: 'error',
        timestamp: Date.now(),
        graph_id: 'graph1',
        trace_id: 'trace1',
        data: {},
        priority: 'critical',
        level: 'error',
      });

      const entries = timeline.generateTimeline(errorTrace);

      expect(entries.some(e => e.status === 'failed')).toBe(true);
    });
  });

  describe('Segment Calculation', () => {
    it('should calculate timeline segments', () => {
      const entries = timeline.generateTimeline(trace);
      const segments = timeline.calculateSegments(entries);

      expect(segments.length).toBe(2);
    });

    it('should assign levels to segments', () => {
      const entries = timeline.generateTimeline(trace);
      const segments = timeline.calculateSegments(entries);

      expect(segments.every(s => typeof s.level === 'number')).toBe(true);
    });

    it('should prevent overlapping segments on same level', () => {
      // Create parallel execution
      const now = Date.now();
      const parallelTrace = { ...trace };
      parallelTrace.events = [
        {
          event_id: 'e1',
          event_type: 'node_start',
          timestamp: now,
          graph_id: 'graph1',
          trace_id: 'trace1',
          node_name: 'agent1',
          agent_id: 'agent1',
          data: {},
          priority: 'medium',
          level: 'info',
        },
        {
          event_id: 'e2',
          event_type: 'node_start',
          timestamp: now,
          graph_id: 'graph1',
          trace_id: 'trace1',
          node_name: 'agent2',
          agent_id: 'agent2',
          data: {},
          priority: 'medium',
          level: 'info',
        },
        {
          event_id: 'e3',
          event_type: 'node_end',
          timestamp: now + 200,
          graph_id: 'graph1',
          trace_id: 'trace1',
          node_name: 'agent1',
          agent_id: 'agent1',
          data: {},
          priority: 'medium',
          level: 'info',
        },
        {
          event_id: 'e4',
          event_type: 'node_end',
          timestamp: now + 200,
          graph_id: 'graph1',
          trace_id: 'trace1',
          node_name: 'agent2',
          agent_id: 'agent2',
          data: {},
          priority: 'medium',
          level: 'info',
        },
      ];

      const entries = timeline.generateTimeline(parallelTrace);
      const segments = timeline.calculateSegments(entries);

      // Segments with overlapping time should be on different levels
      const overlappingSegments = segments.filter(s =>
        segments.some(other =>
          other.id !== s.id &&
          other.level === s.level &&
          !(s.endTime <= other.startTime || s.startTime >= other.endTime)
        )
      );

      expect(overlappingSegments.length).toBe(0);
    });
  });

  describe('Parallel Execution Detection', () => {
    it('should detect parallel execution', () => {
      const now = Date.now();
      const parallelTrace = { ...trace };
      parallelTrace.events = [
        {
          event_id: 'e1',
          event_type: 'node_start',
          timestamp: now,
          graph_id: 'graph1',
          trace_id: 'trace1',
          node_name: 'agent1',
          agent_id: 'agent1',
          data: {},
          priority: 'medium',
          level: 'info',
        },
        {
          event_id: 'e2',
          event_type: 'node_start',
          timestamp: now + 50,
          graph_id: 'graph1',
          trace_id: 'trace1',
          node_name: 'agent2',
          agent_id: 'agent2',
          data: {},
          priority: 'medium',
          level: 'info',
        },
        {
          event_id: 'e3',
          event_type: 'node_end',
          timestamp: now + 200,
          graph_id: 'graph1',
          trace_id: 'trace1',
          node_name: 'agent1',
          agent_id: 'agent1',
          data: {},
          priority: 'medium',
          level: 'info',
        },
        {
          event_id: 'e4',
          event_type: 'node_end',
          timestamp: now + 200,
          graph_id: 'graph1',
          trace_id: 'trace1',
          node_name: 'agent2',
          agent_id: 'agent2',
          data: {},
          priority: 'medium',
          level: 'info',
        },
      ];

      const entries = timeline.generateTimeline(parallelTrace);
      const parallelGroups = timeline.detectParallelExecution(entries);

      expect(parallelGroups.size).toBeGreaterThan(0);
    });
  });

  describe('Interaction Extraction', () => {
    it('should extract agent interactions', () => {
      const entries = timeline.generateTimeline(trace);
      const interactions = timeline.extractInteractions(entries, trace);

      expect(interactions).toBeDefined();
      expect(Array.isArray(interactions)).toBe(true);
    });

    it('should detect sequential interactions', () => {
      const entries = timeline.generateTimeline(trace);
      const interactions = timeline.extractInteractions(entries, trace);

      const sequential = interactions.filter(i => i.type === 'sequential');
      expect(sequential.length).toBeGreaterThan(0);
    });
  });

  describe('Mermaid Generation', () => {
    it('should generate Mermaid Gantt chart', () => {
      const entries = timeline.generateTimeline(trace);
      const mermaid = timeline.generateMermaidTimeline(entries);

      expect(mermaid).toContain('gantt');
      expect(mermaid).toContain('agent1');
      expect(mermaid).toContain('agent2');
    });

    it('should include title', () => {
      const entries = timeline.generateTimeline(trace);
      const mermaid = timeline.generateMermaidTimeline(entries, 'My Timeline');

      expect(mermaid).toContain('My Timeline');
    });
  });

  describe('HTML Generation', () => {
    it('should generate HTML timeline', () => {
      const entries = timeline.generateTimeline(trace);
      const html = timeline.generateHTMLTimeline(entries);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<svg');
    });

    it('should include segments in HTML', () => {
      const entries = timeline.generateTimeline(trace);
      const html = timeline.generateHTMLTimeline(entries);

      expect(html).toContain('<rect');
    });

    it('should include legend in HTML', () => {
      const entries = timeline.generateTimeline(trace);
      const html = timeline.generateHTMLTimeline(entries);

      expect(html).toContain('legend');
    });

    it('should respect custom dimensions', () => {
      const entries = timeline.generateTimeline(trace);
      const html = timeline.generateHTMLTimeline(entries, 800, 200);

      expect(html).toContain('width="800"');
    });
  });

  describe('Statistics Calculation', () => {
    it('should calculate timeline statistics', () => {
      const entries = timeline.generateTimeline(trace);
      const stats = timeline.calculateStatistics(entries, trace);

      expect(stats.totalDuration).toBeGreaterThan(0);
      expect(stats.parallelism).toBeGreaterThan(0);
      expect(Array.isArray(stats.bottleneckNodes)).toBe(true);
    });

    it('should detect bottleneck nodes', () => {
      const entries = timeline.generateTimeline(trace);
      const stats = timeline.calculateStatistics(entries, trace);

      expect(stats.bottleneckNodes.length).toBeGreaterThan(0);
    });

    it('should calculate idle time', () => {
      const entries = timeline.generateTimeline(trace);
      const stats = timeline.calculateStatistics(entries, trace);

      expect(stats.idleTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Report Generation', () => {
    it('should generate timeline report', () => {
      const entries = timeline.generateTimeline(trace);
      const report = timeline.generateReport(entries, trace);

      expect(report).toContain('Execution Timeline Report');
      expect(report).toContain('Statistics');
      expect(report).toContain('Bottleneck Nodes');
    });

    it('should include statistics in report', () => {
      const entries = timeline.generateTimeline(trace);
      const report = timeline.generateReport(entries, trace);

      expect(report).toContain('Total Duration');
      expect(report).toContain('Max Parallelism');
    });
  });

  describe('Timeline Compression', () => {
    it('should compress timeline entries', () => {
      const now = Date.now();
      const entries: TimelineEntry[] = [
        {
          id: 'e1',
          start_time: now,
          end_time: now + 100,
          duration_ms: 100,
          agent_id: 'agent1',
          node_name: 'agent1',
          type: 'execution',
          status: 'completed',
        },
        {
          id: 'e2',
          start_time: now + 100,
          end_time: now + 200,
          duration_ms: 100,
          agent_id: 'agent1',
          node_name: 'agent1',
          type: 'execution',
          status: 'completed',
        },
      ];

      const compressed = timeline.compressTimeline(entries);

      expect(compressed.length).toBeLessThan(entries.length);
      expect(compressed[0].duration_ms).toBeGreaterThan(entries[0].duration_ms);
    });
  });

  describe('Animation', () => {
    it('should animate timeline', () => {
      const entries = timeline.generateTimeline(trace);
      const generator = timeline.animateTimeline(entries, 100);

      const frame1 = generator.next();
      expect(frame1.value).toBeDefined();
      expect(frame1.value.time).toBeDefined();

      const frame2 = generator.next();
      expect(frame2.value).toBeDefined();
    });

    it('should provide active and completed entries', () => {
      const entries = timeline.generateTimeline(trace);
      const generator = timeline.animateTimeline(entries, 100);

      const frame = generator.next();
      expect(frame.value.active).toBeDefined();
      expect(frame.value.completed).toBeDefined();
    });
  });

  describe('Agent Timeline', () => {
    it('should get timeline for specific agent', () => {
      const entries = timeline.generateTimeline(trace);
      const agent1Timeline = timeline.getAgentTimeline(entries, 'agent1');

      expect(agent1Timeline.length).toBe(1);
      expect(agent1Timeline[0].agent_id).toBe('agent1');
    });

    it('should return empty for non-existent agent', () => {
      const entries = timeline.generateTimeline(trace);
      const agent3Timeline = timeline.getAgentTimeline(entries, 'agent3');

      expect(agent3Timeline.length).toBe(0);
    });
  });

  describe('Overlapping Segments', () => {
    it('should find overlapping segments', () => {
      const entries = timeline.generateTimeline(trace);
      const overlapping = timeline.getOverlappingSegments(entries[0], entries);

      expect(Array.isArray(overlapping)).toBe(true);
    });
  });

  describe('Export/Import', () => {
    it('should export timeline', () => {
      const entries = timeline.generateTimeline(trace);
      const exported = timeline.exportTimeline(entries);

      expect(typeof exported).toBe('string');
    });

    it('should import timeline', () => {
      const entries = timeline.generateTimeline(trace);
      const exported = timeline.exportTimeline(entries);
      const imported = timeline.importTimeline(exported);

      expect(imported.length).toBe(entries.length);
    });
  });

  describe('Cleanup', () => {
    it('should clear cached data', () => {
      timeline.calculateSegments(timeline.generateTimeline(trace));
      timeline.clear();

      expect(timeline.getSegments().length).toBe(0);
    });
  });

  describe('State Changes at Time', () => {
    it('should get state changes at time', () => {
      const snapshots = [
        {
          snapshot_id: 'snap1',
          timestamp: 1000,
          graph_id: 'graph1',
          state: { value: 1 },
          version: 0,
          changed_keys: [],
        },
        {
          snapshot_id: 'snap2',
          timestamp: 2000,
          graph_id: 'graph1',
          state: { value: 2 },
          version: 1,
          changed_keys: ['value'],
        },
      ];

      const state = timeline.getStateChangesAtTime(snapshots, 1500);

      expect(state).toBeDefined();
      expect(state?.snapshot_id).toBe('snap1');
    });

    it('should return null if no snapshot before time', () => {
      const snapshots = [
        {
          snapshot_id: 'snap1',
          timestamp: 1000,
          graph_id: 'graph1',
          state: { value: 1 },
          version: 0,
          changed_keys: [],
        },
      ];

      const state = timeline.getStateChangesAtTime(snapshots, 500);

      expect(state).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty trace', () => {
      const emptyTrace = { ...trace, events: [] };
      const entries = timeline.generateTimeline(emptyTrace);

      expect(entries.length).toBe(0);
    });

    it('should handle trace with only start events', () => {
      const incompleteTrace = { ...trace };
      incompleteTrace.events = incompleteTrace.events.filter(e => e.event_type === 'node_start');

      const entries = timeline.generateTimeline(incompleteTrace);

      expect(entries.length).toBe(2);
      expect(entries.every(e => e.status === 'running')).toBe(true);
    });

    it('should handle single entry timeline', () => {
      const entries: TimelineEntry[] = [
        {
          id: 'e1',
          start_time: Date.now(),
          end_time: Date.now() + 100,
          duration_ms: 100,
          agent_id: 'agent1',
          node_name: 'agent1',
          type: 'execution',
          status: 'completed',
        },
      ];

      const segments = timeline.calculateSegments(entries);

      expect(segments.length).toBe(1);
    });
  });
});

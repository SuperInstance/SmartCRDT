/**
 * Tests for TraceCollector
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TraceCollector } from '../src/TraceCollector.js';

describe('TraceCollector', () => {
  let collector: TraceCollector;
  let sessionId: string;
  let traceId: string;

  beforeEach(() => {
    collector = new TraceCollector();
    const session = collector.createSession('test-graph', {
      nodes: ['agent1', 'agent2'],
    });
    sessionId = session.session_id;

    const trace = collector.startTrace(sessionId, { input: 'test' });
    traceId = trace.trace_id;
  });

  describe('Session Management', () => {
    it('should create a new debug session', () => {
      const session = collector.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.session_id).toBe(sessionId);
      expect(session?.config.enable_tracing).toBe(true);
    });

    it('should get the active session', () => {
      const active = collector.getActiveSession();
      expect(active).toBeDefined();
      expect(active?.session_id).toBe(sessionId);
    });

    it('should delete a session', () => {
      const deleted = collector.deleteSession(sessionId);
      expect(deleted).toBe(true);

      const session = collector.getSession(sessionId);
      expect(session).toBeUndefined();
    });

    it('should get all sessions', () => {
      collector.createSession('test-graph-2', {});
      const sessions = collector.getAllSessions();
      expect(sessions.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Trace Management', () => {
    it('should start a new trace', () => {
      const trace = collector.getTrace(sessionId, traceId);
      expect(trace).toBeDefined();
      expect(trace?.trace_id).toBe(traceId);
      expect(trace?.status).toBe('running');
    });

    it('should record events', () => {
      const event = collector.recordEvent(sessionId, {
        event_type: 'node_start',
        node_name: 'agent1',
        data: { input: 'value' },
      });

      expect(event).toBeDefined();
      expect(event?.event_type).toBe('node_start');
      expect(event?.node_name).toBe('agent1');
    });

    it('should end a trace', () => {
      collector.endTrace(sessionId, { output: 'result' });

      const trace = collector.getTrace(sessionId, traceId);
      expect(trace?.status).toBe('completed');
      expect(trace?.duration_ms).toBeGreaterThan(0);
    });

    it('should get traces for a session', () => {
      const traces = collector.getTraces(sessionId);
      expect(traces.length).toBe(1);
      expect(traces[0].trace_id).toBe(traceId);
    });
  });

  describe('Event Recording', () => {
    it('should record node_start events', () => {
      const event = collector.recordEvent(sessionId, {
        event_type: 'node_start',
        node_name: 'agent1',
        data: {},
      });

      expect(event?.event_type).toBe('node_start');
      expect(event?.level).toBe('info');
      expect(event?.priority).toBe('medium');
    });

    it('should record node_end events', () => {
      const event = collector.recordEvent(sessionId, {
        event_type: 'node_end',
        node_name: 'agent1',
        data: {},
      });

      expect(event?.event_type).toBe('node_end');
    });

    it('should record error events', () => {
      const event = collector.recordEvent(sessionId, {
        event_type: 'error',
        data: { error: 'Test error' },
      });

      expect(event?.event_type).toBe('error');
      expect(event?.level).toBe('error');
      expect(event?.priority).toBe('critical');
    });

    it('should record edge_traversal events', () => {
      const event = collector.recordEvent(sessionId, {
        event_type: 'edge_traversal',
        data: { from: 'agent1', to: 'agent2' },
      });

      expect(event?.event_type).toBe('edge_traversal');
    });
  });

  describe('Event Filtering', () => {
    it('should filter events by log level', () => {
      const session = collector.getSession(sessionId);
      session!.config.log_level = 'warn';

      const debugEvent = collector.recordEvent(sessionId, {
        event_type: 'node_start',
        data: {},
      });

      const errorEvent = collector.recordEvent(sessionId, {
        event_type: 'error',
        data: {},
      });

      expect(debugEvent).toBeNull(); // Filtered out
      expect(errorEvent).toBeDefined();
    });

    it('should filter events by custom filter', () => {
      const session = collector.getSession(sessionId);
      session!.config.event_filters = [
        {
          node_names: ['agent1'],
        },
      ];

      const event1 = collector.recordEvent(sessionId, {
        event_type: 'node_start',
        node_name: 'agent1',
        data: {},
      });

      const event2 = collector.recordEvent(sessionId, {
        event_type: 'node_start',
        node_name: 'agent2',
        data: {},
      });

      expect(event1).toBeDefined();
      expect(event2).toBeNull();
    });
  });

  describe('Event Sampling', () => {
    it('should respect sampling rate', () => {
      const session = collector.getSession(sessionId);
      session!.config.sampling_rate = 0.5;

      let includedCount = 0;
      for (let i = 0; i < 100; i++) {
        const event = collector.recordEvent(sessionId, {
          event_type: 'node_start',
          node_name: `agent${i}`,
          data: {},
        });
        if (event) includedCount++;
      }

      // Should be around 50% (with some variance)
      expect(includedCount).toBeGreaterThan(30);
      expect(includedCount).toBeLessThan(70);
    });
  });

  describe('State Snapshots', () => {
    it('should record state snapshots', () => {
      const snapshot = collector.recordSnapshot(
        sessionId,
        { value: 1, nested: { key: 'test' } },
        ['value']
      );

      expect(snapshot).toBeDefined();
      expect(snapshot?.state).toEqual({ value: 1, nested: { key: 'test' } });
      expect(snapshot?.changed_keys).toEqual(['value']);
    });

    it('should include snapshots in trace', () => {
      collector.recordSnapshot(sessionId, { value: 1 }, []);
      collector.recordSnapshot(sessionId, { value: 2 }, ['value']);

      const trace = collector.getTrace(sessionId, traceId);
      expect(trace?.state_snapshots.length).toBe(2);
    });
  });

  describe('Event Aggregation', () => {
    beforeEach(() => {
      // Record some events
      collector.recordEvent(sessionId, {
        event_type: 'node_start',
        node_name: 'agent1',
        data: {},
      });
      collector.recordEvent(sessionId, {
        event_type: 'node_start',
        node_name: 'agent2',
        data: {},
      });
      collector.recordEvent(sessionId, {
        event_type: 'error',
        data: {},
      });
    });

    it('should aggregate events by type', () => {
      const counts = collector.aggregateEventsByType(sessionId);
      expect(counts.get('node_start')).toBe(2);
      expect(counts.get('error')).toBe(1);
    });

    it('should aggregate events by agent', () => {
      const counts = collector.aggregateEventsByAgent(sessionId);
      expect(counts.get('agent1')).toBeGreaterThanOrEqual(1);
      expect(counts.get('agent2')).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Metrics Calculation', () => {
    it('should calculate metrics from events', () => {
      collector.recordEvent(sessionId, {
        event_type: 'node_start',
        node_name: 'agent1',
        data: {},
      });
      collector.recordEvent(sessionId, {
        event_type: 'node_start',
        node_name: 'agent2',
        data: {},
      });
      collector.recordEvent(sessionId, {
        event_type: 'edge_traversal',
        data: {},
      });
      collector.recordEvent(sessionId, {
        event_type: 'error',
        data: {},
      });

      collector.endTrace(sessionId);

      const trace = collector.getTrace(sessionId, traceId);
      expect(trace?.metrics.nodes_executed).toBe(2);
      expect(trace?.metrics.edges_traversed).toBe(1);
      expect(trace?.metrics.error_count).toBe(1);
    });
  });

  describe('Export', () => {
    it('should export traces as JSON', async () => {
      collector.endTrace(sessionId);

      const result = await collector.exportTraces(sessionId, {
        format: 'json',
      });

      expect(result.format).toBe('json');
      expect(result.trace_count).toBe(1);

      const parsed = JSON.parse(result.output as string);
      expect(Array.isArray(parsed)).toBe(true);
    });

    it('should export traces as CSV', async () => {
      collector.recordEvent(sessionId, {
        event_type: 'node_start',
        node_name: 'agent1',
        data: {},
      });

      const result = await collector.exportTraces(sessionId, {
        format: 'csv',
      });

      expect(result.format).toBe('csv');
      expect(result.output).toContain('trace_id,event_type');
    });

    it('should export traces as HTML', async () => {
      const result = await collector.exportTraces(sessionId, {
        format: 'html',
      });

      expect(result.format).toBe('html');
      expect(result.output).toContain('<!DOCTYPE html>');
    });

    it('should respect time range filter', async () => {
      const result = await collector.exportTraces(sessionId, {
        format: 'json',
        time_range: { start: 0, end: Date.now() },
      });

      expect(result.trace_count).toBeLessThanOrEqual(1);
    });
  });

  describe('Session Cleanup', () => {
    it('should clear session data', () => {
      collector.recordEvent(sessionId, {
        event_type: 'node_start',
        data: {},
      });

      collector.clearSession(sessionId);

      const events = collector.getEvents(sessionId);
      expect(events.length).toBe(0);
    });
  });
});

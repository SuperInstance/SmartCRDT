/**
 * Tests for Profiler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Profiler } from '../src/Profiler.js';
import type { ExecutionTrace, TraceEvent } from '../src/types.js';

describe('Profiler', () => {
  let profiler: Profiler;
  let traceId: string;
  let graphId: string;

  beforeEach(() => {
    profiler = new Profiler();
    traceId = 'trace-1';
    graphId = 'test-graph';
  });

  describe('Profiling Lifecycle', () => {
    it('should start profiling', () => {
      profiler.startProfiling(traceId);
      // Should not throw
      expect(true).toBe(true);
    });

    it('should end profiling and generate report', () => {
      profiler.startProfiling(traceId);
      profiler.recordNodeStart(traceId, 'node1', 'Node 1');
      profiler.recordNodeEnd(traceId, 'node1', true);

      const report = profiler.endProfiling(traceId, graphId);

      expect(report).toBeDefined();
      expect(report.graph_id).toBe(graphId);
      expect(report.report_id).toContain('report_');
    });

    it('should throw error when ending non-existent profiling', () => {
      expect(() => {
        profiler.endProfiling('non-existent', graphId);
      }).toThrow();
    });
  });

  describe('Node Timing', () => {
    beforeEach(() => {
      profiler.startProfiling(traceId);
    });

    it('should record node start', () => {
      profiler.recordNodeStart(traceId, 'node1', 'Node 1');
      // Should not throw
      expect(true).toBe(true);
    });

    it('should record node end', () => {
      profiler.recordNodeStart(traceId, 'node1', 'Node 1');
      profiler.recordNodeEnd(traceId, 'node1', true);

      const profile = profiler.getProfile('node1');
      expect(profile).toBeDefined();
      expect(profile?.execution_count).toBe(1);
    });

    it('should calculate execution time', async () => {
      profiler.recordNodeStart(traceId, 'node1', 'Node 1');
      await new Promise(resolve => setTimeout(resolve, 10));
      profiler.recordNodeEnd(traceId, 'node1', true);

      const profile = profiler.getProfile('node1');
      expect(profile?.total_time_ms).toBeGreaterThan(0);
      expect(profile?.avg_time_ms).toBeGreaterThan(0);
    });

    it('should track multiple executions', () => {
      profiler.recordNodeStart(traceId, 'node1', 'Node 1');
      profiler.recordNodeEnd(traceId, 'node1', true);

      profiler.recordNodeStart(traceId, 'node1', 'Node 1');
      profiler.recordNodeEnd(traceId, 'node1', true);

      const profile = profiler.getProfile('node1');
      expect(profile?.execution_count).toBe(2);
    });

    it('should track errors', () => {
      profiler.recordNodeStart(traceId, 'node1', 'Node 1');
      profiler.recordNodeEnd(traceId, 'node1', false);

      const profile = profiler.getProfile('node1');
      expect(profile?.error_count).toBe(1);
      expect(profile?.success_rate).toBeLessThan(1);
    });
  });

  describe('Node Profiles', () => {
    beforeEach(() => {
      profiler.startProfiling(traceId);

      // Record some data
      const timings = [10, 20, 30, 40, 50];
      for (const timing of timings) {
        profiler.recordNodeStart(traceId, 'node1', 'Node 1');
        // Simulate timing by manually setting
        profiler['contexts'].get(traceId)!.activeTimings.set('node1', {
          nodeId: 'node1',
          startTime: Date.now() - timing,
        });
        profiler.recordNodeEnd(traceId, 'node1', true);
      }
    });

    it('should calculate statistics', () => {
      const profile = profiler.getProfile('node1');

      expect(profile?.execution_count).toBe(5);
      expect(profile?.total_time_ms).toBeGreaterThan(0);
      expect(profile?.min_time_ms).toBeLessThan(profile?.max_time_ms ?? 0);
    });

    it('should calculate average time', () => {
      const profile = profiler.getProfile('node1');
      expect(profile?.avg_time_ms).toBeGreaterThan(0);
    });

    it('should calculate standard deviation', () => {
      const profile = profiler.getProfile('node1');
      expect(profile?.std_dev_ms).toBeGreaterThan(0);
    });

    it('should get all profiles', () => {
      profiler.recordNodeStart(traceId, 'node2', 'Node 2');
      profiler.recordNodeEnd(traceId, 'node2', true);

      const profiles = profiler.getAllProfiles();
      expect(profiles.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Bottleneck Detection', () => {
    beforeEach(() => {
      profiler.startProfiling(traceId);

      // Create fast node
      profiler.recordNodeStart(traceId, 'fast', 'Fast Node');
      profiler['contexts'].get(traceId)!.activeTimings.set('fast', {
        nodeId: 'fast',
        startTime: Date.now() - 5,
      });
      profiler.recordNodeEnd(traceId, 'fast', true);

      // Create slow node
      profiler.recordNodeStart(traceId, 'slow', 'Slow Node');
      profiler['contexts'].get(traceId)!.activeTimings.set('slow', {
        nodeId: 'slow',
        startTime: Date.now() - 500,
      });
      profiler.recordNodeEnd(traceId, 'slow', true);
    });

    it('should detect slow nodes', () => {
      const report = profiler.endProfiling(traceId, graphId);

      const slowBottlenecks = report.bottlenecks.filter(b => b.type === 'slow_node');
      expect(slowBottlenecks.length).toBeGreaterThan(0);
      expect(slowBottlenecks[0].node_id).toContain('slow');
    });

    it('should provide recommendations', () => {
      const report = profiler.endProfiling(traceId, graphId);

      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(typeof report.recommendations[0]).toBe('string');
    });

    it('should calculate overall metrics', () => {
      const report = profiler.endProfiling(traceId, graphId);

      expect(report.overall_metrics.total_executions).toBe(2);
      expect(report.overall_metrics.total_time_ms).toBeGreaterThan(0);
      expect(report.overall_metrics.avg_time_ms).toBeGreaterThan(0);
    });
  });

  describe('Error Detection', () => {
    beforeEach(() => {
      profiler.startProfiling(traceId);

      // Create error-prone node
      for (let i = 0; i < 10; i++) {
        profiler.recordNodeStart(traceId, 'unstable', 'Unstable Node');
        profiler['contexts'].get(traceId)!.activeTimings.set('unstable', {
          nodeId: 'unstable',
          startTime: Date.now() - 10,
        });
        profiler.recordNodeEnd(traceId, 'unstable', i < 2); // 2 successes, 8 errors
      }
    });

    it('should detect frequent errors', () => {
      const report = profiler.endProfiling(traceId, graphId);

      const errorBottlenecks = report.bottlenecks.filter(b => b.type === 'frequent_error');
      expect(errorBottlenecks.length).toBeGreaterThan(0);
    });

    it('should calculate error rate', () => {
      const report = profiler.endProfiling(traceId, graphId);

      expect(report.overall_metrics.error_rate).toBeGreaterThan(0);
    });
  });

  describe('Metrics from Events', () => {
    it('should calculate metrics from trace events', () => {
      const events: TraceEvent[] = [
        {
          event_id: 'e1',
          event_type: 'node_start',
          timestamp: 1000,
          graph_id: 'graph1',
          trace_id: 'trace1',
          node_name: 'node1',
          data: {},
          priority: 'medium',
          level: 'info',
        },
        {
          event_id: 'e2',
          event_type: 'node_end',
          timestamp: 1100,
          graph_id: 'graph1',
          trace_id: 'trace1',
          node_name: 'node1',
          data: {},
          priority: 'medium',
          level: 'info',
        },
        {
          event_id: 'e3',
          event_type: 'edge_traversal',
          timestamp: 1150,
          graph_id: 'graph1',
          trace_id: 'trace1',
          data: {},
          priority: 'low',
          level: 'debug',
        },
        {
          event_id: 'e4',
          event_type: 'error',
          timestamp: 1200,
          graph_id: 'graph1',
          trace_id: 'trace1',
          data: {},
          priority: 'critical',
          level: 'error',
        },
      ];

      const metrics = profiler.calculateMetricsFromEvents(events);

      expect(metrics.nodes_executed).toBe(1);
      expect(metrics.edges_traversed).toBe(1);
      expect(metrics.error_count).toBe(1);
      expect(metrics.node_times.get('node1')).toBe(100);
    });
  });

  describe('Trace Analysis', () => {
    it('should analyze execution trace', () => {
      const trace: ExecutionTrace = {
        trace_id: 'trace1',
        graph_id: 'graph1',
        start_time: 1000,
        end_time: 2000,
        duration_ms: 1000,
        events: [],
        metrics: {
          total_time_ms: 1000,
          node_times: new Map([
            ['node1', 200],
            ['node2', 600],
            ['node3', 200],
          ]),
          nodes_executed: 3,
          edges_traversed: 2,
          error_count: 1,
          warning_count: 0,
          avg_node_time_ms: 333.33,
          slowest_node: { name: 'node2', time_ms: 600 },
          fastest_node: { name: 'node1', time_ms: 200 },
        },
        timeline: [],
        state_snapshots: [],
        final_state: {},
        initial_state: {},
        status: 'completed',
        metadata: {},
      };

      const analysis = profiler.analyzeTrace(trace);

      expect(analysis.executionTime).toBe(1000);
      expect(analysis.bottleneckNodes).toContain('node2');
      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Profile Comparison', () => {
    it('should compare two profiles', () => {
      const profile1 = {
        id: 'node1',
        name: 'Node 1',
        execution_count: 10,
        total_time_ms: 1000,
        avg_time_ms: 100,
        min_time_ms: 50,
        max_time_ms: 200,
        std_dev_ms: 30,
        error_count: 0,
        success_rate: 1,
      };

      const profile2 = {
        ...profile1,
        total_time_ms: 500,
        avg_time_ms: 50,
      };

      const comparison = profiler.compareProfiles(profile1, profile2);

      expect(comparison.timeDiff).toBeLessThan(0);
      expect(comparison.timeDiffPercent).toBeLessThan(0);
      expect(comparison.verdict).toBe('improved');
    });

    it('should detect degradation', () => {
      const profile1 = {
        id: 'node1',
        name: 'Node 1',
        execution_count: 10,
        total_time_ms: 500,
        avg_time_ms: 50,
        min_time_ms: 30,
        max_time_ms: 100,
        std_dev_ms: 20,
        error_count: 0,
        success_rate: 1,
      };

      const profile2 = {
        ...profile1,
        total_time_ms: 1000,
        avg_time_ms: 100,
        error_count: 1,
        success_rate: 0.9,
      };

      const comparison = profiler.compareProfiles(profile1, profile2);

      expect(comparison.verdict).toBe('degraded');
    });
  });

  describe('Performance Snapshot', () => {
    it('should get real-time snapshot', () => {
      profiler.startProfiling(traceId);
      profiler.recordNodeStart(traceId, 'node1', 'Node 1');

      const snapshot = profiler.getPerformanceSnapshot(traceId);

      expect(snapshot.activeNodes).toContain('node1');
      expect(snapshot.currentMemory).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Profile Export/Import', () => {
    it('should export profiles as JSON', () => {
      profiler.startProfiling(traceId);
      profiler.recordNodeStart(traceId, 'node1', 'Node 1');
      profiler.recordNodeEnd(traceId, 'node1', true);

      const json = profiler.exportProfiles();
      const parsed = JSON.parse(json);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
    });

    it('should import profiles from JSON', () => {
      const profiles = [
        {
          id: 'node1',
          name: 'Node 1',
          execution_count: 5,
          total_time_ms: 500,
          avg_time_ms: 100,
          min_time_ms: 50,
          max_time_ms: 200,
          std_dev_ms: 30,
          error_count: 0,
          success_rate: 1,
        },
      ];

      profiler.importProfiles(JSON.stringify(profiles));

      const profile = profiler.getProfile('node1');
      expect(profile).toBeDefined();
      expect(profile?.execution_count).toBe(5);
    });
  });

  describe('Cleanup', () => {
    it('should reset profiles', () => {
      profiler.startProfiling(traceId);
      profiler.recordNodeStart(traceId, 'node1', 'Node 1');
      profiler.recordNodeEnd(traceId, 'node1', true);

      profiler.resetProfiles();

      const profile = profiler.getProfile('node1');
      expect(profile).toBeUndefined();
    });
  });
});

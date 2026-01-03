/**
 * Tests for StatsTracker
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StatsTracker, createStatsTracker, createStandardTracker } from '../src/stats/StatsTracker.js';

interface TestStats {
  requests: number;
  errors: number;
  totalLatency: number;
}

describe('StatsTracker', () => {
  let tracker: StatsTracker<TestStats>;

  beforeEach(() => {
    tracker = new StatsTracker({
      requests: 0,
      errors: 0,
      totalLatency: 0,
    });
  });

  describe('Basic operations', () => {
    it('should initialize with stats', () => {
      expect(tracker.getStats().requests).toBe(0);
      expect(tracker.getStats().errors).toBe(0);
    });

    it('should set stat value', () => {
      tracker.set('requests', 10);
      expect(tracker.getStats().requests).toBe(10);
    });

    it('should increment stat', () => {
      tracker.increment('requests');
      expect(tracker.getStats().requests).toBe(1);

      tracker.increment('requests', 5);
      expect(tracker.getStats().requests).toBe(6);
    });

    it('should decrement stat', () => {
      tracker.set('requests', 10);
      tracker.decrement('requests');
      expect(tracker.getStats().requests).toBe(9);

      tracker.decrement('requests', 5);
      expect(tracker.getStats().requests).toBe(4);
    });

    it('should get specific stat', () => {
      tracker.set('requests', 42);
      expect(tracker.get('requests')).toBe(42);
    });

    it('should return readonly stats', () => {
      const stats = tracker.getStats();
      stats.requests = 999;
      expect(tracker.getStats().requests).toBe(0);
    });
  });

  describe('Aggregations', () => {
    it('should calculate average', () => {
      tracker.set('totalLatency', 100);
      tracker.set('totalLatency', 200);
      tracker.set('totalLatency', 300);

      // Average is tracked internally
      const metadata = tracker.getMetadata('totalLatency');
      expect(metadata?.count).toBe(3);
      expect(metadata?.sum).toBe(600);
    });

    it('should get average', () => {
      tracker.set('totalLatency', 100);
      tracker.set('totalLatency', 200);

      expect(tracker.getAverage('totalLatency')).toBe(150);
    });

    it('should return 0 for average with no updates', () => {
      expect(tracker.getAverage('requests')).toBe(0);
    });

    it('should calculate rate', () => {
      tracker.set('requests', 100);

      const rate = tracker.getRate('requests');
      expect(typeof rate).toBe('number');
    });

    it('should track min', () => {
      tracker.set('requests', 10);
      tracker.set('requests', 5);
      tracker.set('requests', 15);

      expect(tracker.getMin('requests')).toBe(5);
    });

    it('should track max', () => {
      tracker.set('requests', 10);
      tracker.set('requests', 5);
      tracker.set('requests', 15);

      expect(tracker.getMax('requests')).toBe(15);
    });

    it('should track count', () => {
      tracker.set('requests', 10);
      tracker.set('requests', 20);

      expect(tracker.getCount('requests')).toBe(2);
    });
  });

  describe('Time series', () => {
    let timeSeriesTracker: StatsTracker<TestStats>;

    beforeEach(() => {
      timeSeriesTracker = new StatsTracker(
        { requests: 0, errors: 0, totalLatency: 0 },
        { enableTimeSeries: true }
      );
    });

    it('should track time series', () => {
      timeSeriesTracker.set('requests', 10);
      timeSeriesTracker.set('requests', 20);

      const series = timeSeriesTracker.getTimeSeries('requests');
      expect(series.length).toBe(2);
    });

    it('should include timestamps', () => {
      timeSeriesTracker.set('requests', 10);

      const series = timeSeriesTracker.getTimeSeries('requests');
      expect(series[0].timestamp).toBeGreaterThan(0);
      expect(series[0].value).toBe(10);
    });

    it('should get time series range', () => {
      const now = Date.now();
      timeSeriesTracker.set('requests', 10);

      const series = timeSeriesTracker.getTimeSeriesRange('requests', now - 1000, now + 1000);
      expect(series.length).toBe(1);
    });

    it('should calculate percentile', () => {
      for (let i = 0; i < 100; i++) {
        timeSeriesTracker.set('requests', i);
      }

      const p50 = timeSeriesTracker.getPercentile('requests', 50);
      expect(p50).toBeGreaterThan(40);
      expect(p50).toBeLessThan(60);
    });

    it('should get median', () => {
      for (let i = 0; i < 10; i++) {
        timeSeriesTracker.set('requests', i);
      }

      const median = timeSeriesTracker.getMedian('requests');
      expect(median).toBeGreaterThanOrEqual(0);
      expect(median).toBeLessThanOrEqual(9);
    });

    it('should get p95', () => {
      for (let i = 0; i < 100; i++) {
        timeSeriesTracker.set('requests', i);
      }

      const p95 = timeSeriesTracker.getP95('requests');
      expect(p95).toBeGreaterThan(90);
    });

    it('should get p99', () => {
      for (let i = 0; i < 100; i++) {
        timeSeriesTracker.set('requests', i);
      }

      const p99 = timeSeriesTracker.getP99('requests');
      expect(p99).toBeGreaterThan(95);
    });

    it('should enforce max points', () => {
      const tracker = new StatsTracker(
        { requests: 0, errors: 0, totalLatency: 0 },
        {
          enableTimeSeries: true,
          timeWindow: { duration: 60000, maxPoints: 5 }
        }
      );

      for (let i = 0; i < 10; i++) {
        tracker.set('requests', i);
      }

      const series = tracker.getTimeSeries('requests');
      expect(series.length).toBeLessThanOrEqual(5);
    });

    it('should cleanup old data', () => {
      vi.useFakeTimers();

      const tracker = new StatsTracker(
        { requests: 0, errors: 0, totalLatency: 0 },
        {
          enableTimeSeries: true,
          timeWindow: { duration: 1000 },
          autoCleanup: true,
          cleanupInterval: 500,
        }
      );

      tracker.set('requests', 10);

      // Advance time past window
      vi.advanceTimersByTime(2000);

      const series = tracker.getTimeSeries('requests');
      // Old data should be cleaned up
      expect(series.length).toBe(0);

      tracker.dispose();
      vi.useRealTimers();
    });
  });

  describe('Reset and snapshot', () => {
    it('should reset all stats', () => {
      tracker.set('requests', 100);
      tracker.set('errors', 5);

      tracker.reset();

      expect(tracker.getStats().requests).toBe(0);
      expect(tracker.getStats().errors).toBe(0);
    });

    it('should reset specific stat', () => {
      tracker.set('requests', 100);
      tracker.set('errors', 5);

      tracker.resetStat('requests');

      expect(tracker.getStats().requests).toBe(0);
      expect(tracker.getStats().errors).toBe(5);
    });

    it('should create snapshot', () => {
      tracker.set('requests', 100);

      const snapshot = tracker.snapshot();

      expect(snapshot.stats.requests).toBe(100);
      expect(snapshot.timestamp).toBeGreaterThan(0);
    });

    it('should restore from snapshot', () => {
      tracker.set('requests', 100);
      const snapshot = tracker.snapshot();

      tracker.set('requests', 200);
      expect(tracker.getStats().requests).toBe(200);

      tracker.restore(snapshot);
      expect(tracker.getStats().requests).toBe(100);
    });

    it('should calculate diff from snapshot', () => {
      tracker.set('requests', 100);
      const snapshot = tracker.snapshot();

      tracker.set('requests', 150);

      const diff = tracker.diffFrom(snapshot);
      expect(diff.requests).toBe(50);
    });
  });

  describe('Summary and export', () => {
    it('should get summary', () => {
      tracker.set('requests', 100);
      tracker.set('requests', 200);

      const summary = tracker.getSummary();

      expect(summary.requests.value).toBe(200);
      expect(summary.requests.count).toBe(2);
    });

    it('should export as JSON', () => {
      tracker.set('requests', 100);

      const json = tracker.toJSON();

      expect(json.stats.requests).toBe(100);
      expect(json.summary).toBeDefined();
      expect(json.timestamp).toBeGreaterThan(0);
    });
  });

  describe('Merge', () => {
    it('should merge stats from another tracker', () => {
      const tracker1 = new StatsTracker({ requests: 0, errors: 0, totalLatency: 0 });
      const tracker2 = new StatsTracker({ requests: 0, errors: 0, totalLatency: 0 });

      tracker1.set('requests', 100);
      tracker2.set('requests', 200);

      tracker1.merge(tracker2);

      expect(tracker1.getStats().requests).toBe(200);
    });
  });

  describe('Convenience functions', () => {
    it('should create tracker with createStatsTracker', () => {
      const t = createStatsTracker({ requests: 0, errors: 0, totalLatency: 0 });

      expect(t).toBeInstanceOf(StatsTracker);
    });

    it('should create standard tracker', () => {
      const t = createStandardTracker();

      expect(t.getStats().requests).toBe(0);
      expect(t.getStats().totalLatency).toBe(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle infinity min', () => {
      expect(tracker.getMin('requests')).toBe(0);
    });

    it('should handle negative infinity max', () => {
      expect(tracker.getMax('requests')).toBe(0);
    });

    it('should handle disposal', () => {
      const trackerWithCleanup = new StatsTracker(
        { requests: 0, errors: 0, totalLatency: 0 },
        { enableTimeSeries: true, autoCleanup: true }
      );

      expect(() => trackerWithCleanup.dispose()).not.toThrow();
    });
  });
});

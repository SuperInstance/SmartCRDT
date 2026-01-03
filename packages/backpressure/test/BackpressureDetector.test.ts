/**
 * Tests for BackpressureDetector
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BackpressureDetector } from '../src/BackpressureDetector.js';
import type { SSEEvent } from '../src/types.js';

describe('BackpressureDetector', () => {
  let detector: BackpressureDetector;

  beforeEach(() => {
    detector = new BackpressureDetector();
  });

  describe('Client Monitoring', () => {
    it('should start monitoring a client', () => {
      detector.monitorClient('client-1');
      expect(detector.isMonitoring('client-1')).toBe(true);
    });

    it('should not monitor same client twice', () => {
      detector.monitorClient('client-1');
      detector.monitorClient('client-1');
      expect(detector.getMonitoredClientCount()).toBe(1);
    });

    it('should stop monitoring a client', () => {
      detector.monitorClient('client-1');
      detector.stopMonitoring('client-1');
      expect(detector.isMonitoring('client-1')).toBe(false);
    });

    it('should handle stopping non-existent client', () => {
      expect(() => detector.stopMonitoring('non-existent')).not.toThrow();
    });

    it('should stop all monitoring', () => {
      detector.monitorClient('client-1');
      detector.monitorClient('client-2');
      detector.monitorClient('client-3');
      detector.stopAllMonitoring();
      expect(detector.getMonitoredClientCount()).toBe(0);
    });

    it('should get all monitored client IDs', () => {
      detector.monitorClient('client-1');
      detector.monitorClient('client-2');
      detector.monitorClient('client-3');
      const ids = detector.getMonitoredClients();
      expect(ids).toHaveLength(3);
      expect(ids).toContain('client-1');
      expect(ids).toContain('client-2');
      expect(ids).toContain('client-3');
    });

    it('should get monitored client count', () => {
      expect(detector.getMonitoredClientCount()).toBe(0);
      detector.monitorClient('client-1');
      expect(detector.getMonitoredClientCount()).toBe(1);
      detector.monitorClient('client-2');
      expect(detector.getMonitoredClientCount()).toBe(2);
    });
  });

  describe('Pressure Level Detection', () => {
    it('should start with none pressure level', () => {
      detector.monitorClient('client-1');
      expect(detector.getPressureLevel('client-1')).toBe('none');
    });

    it('should detect low pressure level', () => {
      detector.monitorClient('client-1', { buffer_size: 1000 });

      // Add events to reach low threshold
      for (let i = 0; i < 30; i++) {
        const event: SSEEvent = { data: `event-${i}` };
        detector.recordEventAdd('client-1', event);
      }

      const pressure = detector.getPressureLevel('client-1');
      expect(['none', 'low']).toContain(pressure);
    });

    it('should return none for non-existent client', () => {
      expect(detector.getPressureLevel('non-existent')).toBe('none');
    });

    it('should get clients by pressure level', () => {
      detector.monitorClient('client-1');
      detector.monitorClient('client-2');

      const noneClients = detector.getClientsByPressureLevel('none');
      expect(noneClients).toHaveLength(2);
      expect(noneClients).toContain('client-1');
      expect(noneClients).toContain('client-2');
    });
  });

  describe('Client Metrics', () => {
    it('should return null for non-existent client metrics', () => {
      expect(detector.getClientMetrics('non-existent')).toBeNull();
    });

    it('should get client metrics', () => {
      detector.monitorClient('client-1', {
        buffer_size: 10000,
        bandwidth: 1000000,
        processing_time: 100,
        max_concurrent: 10
      });

      const metrics = detector.getClientMetrics('client-1');
      expect(metrics).not.toBeNull();
      expect(metrics?.client_id).toBe('client-1');
      expect(metrics?.buffer_stats.max_size).toBe(10000);
    });

    it('should get all client metrics', () => {
      detector.monitorClient('client-1');
      detector.monitorClient('client-2');

      const allMetrics = detector.getAllClientMetrics();
      expect(allMetrics).toHaveLength(2);
    });

    it('should track bandwidth', () => {
      detector.monitorClient('client-1');
      const bandwidth = detector.estimateBandwidth('client-1');
      expect(bandwidth).toBeGreaterThan(0);
    });

    it('should get buffer usage', () => {
      detector.monitorClient('client-1', { buffer_size: 1000 });
      const usage = detector.getBufferUsage('client-1');
      expect(usage).toBeGreaterThanOrEqual(0);
      expect(usage).toBeLessThanOrEqual(100);
    });
  });

  describe('Event Recording', () => {
    it('should record event send', () => {
      detector.monitorClient('client-1');
      const event: SSEEvent = { data: 'test' };

      expect(() => detector.recordEventSend('client-1', event)).not.toThrow();
    });

    it('should record event with latency', () => {
      detector.monitorClient('client-1');
      const event: SSEEvent = { data: 'test' };

      detector.recordEventSend('client-1', event, 150);
      const metrics = detector.getClientMetrics('client-1');
      expect(metrics?.latency).toBe(150);
    });

    it('should record event add', () => {
      detector.monitorClient('client-1');
      const event: SSEEvent = { data: 'test' };

      detector.recordEventAdd('client-1', event);
      const stats = detector.getClientMetrics('client-1')?.buffer_stats;
      expect(stats?.event_count).toBe(1);
    });

    it('should record multiple events', () => {
      detector.monitorClient('client-1');

      for (let i = 0; i < 10; i++) {
        const event: SSEEvent = { data: `event-${i}` };
        detector.recordEventAdd('client-1', event);
      }

      const stats = detector.getClientMetrics('client-1')?.buffer_stats;
      expect(stats?.event_count).toBe(10);
    });

    it('should record events dropped', () => {
      detector.monitorClient('client-1');
      detector.recordEventsDropped('client-1', 5, 1000);

      const stats = detector.getClientMetrics('client-1')?.buffer_stats;
      expect(stats?.events_dropped).toBe(5);
      expect(stats?.total_dropped).toBe(1000);
    });
  });

  describe('Latency Recording', () => {
    it('should record latency', () => {
      detector.monitorClient('client-1');
      detector.recordLatency('client-1', 200);

      const metrics = detector.getClientMetrics('client-1');
      expect(metrics?.latency).toBe(200);
    });

    it('should average multiple latency samples', () => {
      detector.monitorClient('client-1');
      detector.recordLatency('client-1', 100);
      detector.recordLatency('client-1', 200);
      detector.recordLatency('client-1', 300);

      const metrics = detector.getClientMetrics('client-1');
      expect(metrics?.latency).toBe(200);
    });

    it('should detect slow client based on latency', () => {
      const slowDetector = new BackpressureDetector({
        slow_latency_threshold: 100,
        slow_detection_count: 2
      });

      slowDetector.monitorClient('client-1');
      slowDetector.recordLatency('client-1', 150);
      expect(slowDetector.detectSlowdown('client-1')).toBe(false);

      slowDetector.recordLatency('client-1', 150);
      expect(slowDetector.detectSlowdown('client-1')).toBe(true);
    });

    it('should reset slow detection on good latency', () => {
      const slowDetector = new BackpressureDetector({
        slow_latency_threshold: 100,
        slow_detection_count: 2
      });

      slowDetector.monitorClient('client-1');
      slowDetector.recordLatency('client-1', 150);
      slowDetector.recordLatency('client-1', 150);
      expect(slowDetector.detectSlowdown('client-1')).toBe(true);

      slowDetector.recordLatency('client-1', 50);
      slowDetector.recordLatency('client-1', 50);
      expect(slowDetector.detectSlowdown('client-1')).toBe(false);
    });
  });

  describe('Bandwidth Recording', () => {
    it('should record bandwidth sample', () => {
      detector.monitorClient('client-1');
      detector.recordBandwidthSample('client-1', 10000, 100);

      const bandwidth = detector.estimateBandwidth('client-1');
      expect(bandwidth).toBeGreaterThan(0);
    });

    it('should estimate bandwidth from samples', () => {
      detector.monitorClient('client-1');
      detector.recordBandwidthSample('client-1', 100000, 1000);
      detector.recordBandwidthSample('client-1', 200000, 1000);

      const bandwidth = detector.estimateBandwidth('client-1');
      expect(bandwidth).toBeCloseTo(150000, -1); // ~150KB/s
    });
  });

  describe('Throughput Recording', () => {
    it('should record throughput sample', () => {
      detector.monitorClient('client-1');
      detector.recordThroughputSample('client-1', 100, 1000);

      const metrics = detector.getClientMetrics('client-1');
      expect(metrics?.throughput).toBe(100); // 100 events/sec
    });

    it('should calculate throughput correctly', () => {
      detector.monitorClient('client-1');
      detector.recordThroughputSample('client-1', 50, 500);
      detector.recordThroughputSample('client-1', 50, 500);

      const metrics = detector.getClientMetrics('client-1');
      expect(metrics?.throughput).toBe(100); // 100 events/sec
    });
  });

  describe('Slow Client Detection', () => {
    it('should get slow clients', () => {
      detector.monitorClient('client-1');
      detector.monitorClient('client-2');

      const slowClients = detector.getSlowClients();
      expect(slowClients).toHaveLength(0);
    });
  });

  describe('Event Handlers', () => {
    it('should call backpressure event handlers', () => {
      const handler = vi.fn();
      detector.onBackpressureEvent(handler);

      detector.monitorClient('client-1');
      expect(handler).toHaveBeenCalled();
    });

    it('should remove event handler', () => {
      const handler = vi.fn();
      detector.onBackpressureEvent(handler);
      detector.offBackpressureEvent(handler);

      detector.monitorClient('client-1');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle handler errors gracefully', () => {
      const badHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const goodHandler = vi.fn();

      detector.onBackpressureEvent(badHandler);
      detector.onBackpressureEvent(goodHandler);

      expect(() => detector.monitorClient('client-1')).not.toThrow();
      expect(goodHandler).toHaveBeenCalled();
    });
  });

  describe('Global Statistics', () => {
    it('should get global stats', () => {
      detector.monitorClient('client-1');
      detector.monitorClient('client-2');

      const stats = detector.getGlobalStats();
      expect(stats.totalClients).toBe(2);
      expect(stats.slowClients).toBe(0);
      expect(stats.noPressure).toBe(2);
    });

    it('should track events sent and dropped', () => {
      detector.monitorClient('client-1');

      for (let i = 0; i < 10; i++) {
        const event: SSEEvent = { data: `event-${i}` };
        detector.recordEventSend('client-1', event);
      }

      detector.recordEventsDropped('client-1', 5, 500);

      const stats = detector.getGlobalStats();
      expect(stats.totalEventsSent).toBe(10);
      expect(stats.totalEventsDropped).toBe(5);
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      detector.updateConfig({
        monitor_interval: 200,
        slow_latency_threshold: 2000
      });

      const config = detector.getConfig();
      expect(config.monitor_interval).toBe(200);
      expect(config.slow_latency_threshold).toBe(2000);
    });

    it('should get current configuration', () => {
      const config = detector.getConfig();
      expect(config).toHaveProperty('monitor_interval');
      expect(config).toHaveProperty('low_threshold');
      expect(config).toHaveProperty('medium_threshold');
    });
  });

  describe('Force Detection', () => {
    it('should force detection cycle', () => {
      detector.monitorClient('client-1');

      const results = detector.forceDetectionCycle();
      expect(results).toHaveLength(1);
      expect(results[0].clientId).toBe('client-1');
    });

    it('should return empty array for no clients', () => {
      const results = detector.forceDetectionCycle();
      expect(results).toHaveLength(0);
    });
  });

  describe('Cleanup', () => {
    it('should clear all data', () => {
      detector.monitorClient('client-1');
      detector.monitorClient('client-2');

      detector.clear();
      expect(detector.getMonitoredClientCount()).toBe(0);
    });

    it('should stop global monitoring', () => {
      detector.monitorClient('client-1');
      detector.stopGlobalMonitoring();

      // Should not throw
      detector.monitorClient('client-2');
    });
  });
});

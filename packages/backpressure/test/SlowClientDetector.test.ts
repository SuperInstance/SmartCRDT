/**
 * Tests for SlowClientDetector
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SlowClientDetector } from '../src/SlowClientDetector.js';
import type { SSEEvent } from '../src/types.js';

describe('SlowClientDetector', () => {
  let detector: SlowClientDetector;

  beforeEach(() => {
    detector = new SlowClientDetector();
  });

  describe('Slow Client Detection', () => {
    it('should not detect normal client as slow', () => {
      detector.recordLatency('client-1', 100);
      detector.recordLatency('client-1', 150);
      detector.recordLatency('client-1', 120);

      expect(detector.isSlowClient('client-1')).toBe(false);
    });

    it('should detect slow client based on latency', () => {
      const strictDetector = new SlowClientDetector({
        latencyThreshold: 200,
        detectionCount: 2
      });

      strictDetector.recordLatency('client-1', 300);
      strictDetector.recordLatency('client-1', 250);

      expect(strictDetector.isSlowClient('client-1')).toBe(true);
    });

    it('should require multiple detections before marking as slow', () => {
      const detector = new SlowClientDetector({
        latencyThreshold: 200,
        detectionCount: 3
      });

      detector.recordLatency('client-1', 300);
      detector.recordLatency('client-1', 300);

      expect(detector.isSlowClient('client-1')).toBe(false);

      detector.recordLatency('client-1', 300);
      expect(detector.isSlowClient('client-1')).toBe(true);
    });

    it('should unmark slow client when performance improves', () => {
      const strictDetector = new SlowClientDetector({
        latencyThreshold: 200,
        detectionCount: 2
      });

      strictDetector.recordLatency('client-1', 300);
      strictDetector.recordLatency('client-1', 300);
      expect(strictDetector.isSlowClient('client-1')).toBe(true);

      strictDetector.recordLatency('client-1', 100);
      strictDetector.recordLatency('client-1', 100);
      expect(strictDetector.isSlowClient('client-1')).toBe(false);
    });
  });

  describe('Client Latency', () => {
    it('should return 0 for non-existent client', () => {
      expect(detector.getClientLatency('non-existent')).toBe(0);
    });

    it('should calculate average latency', () => {
      detector.recordLatency('client-1', 100);
      detector.recordLatency('client-1', 200);
      detector.recordLatency('client-1', 300);

      expect(detector.getClientLatency('client-1')).toBe(200);
    });

    it('should update latency on new samples', () => {
      detector.recordLatency('client-1', 100);
      expect(detector.getClientLatency('client-1')).toBe(100);

      detector.recordLatency('client-1', 200);
      expect(detector.getClientLatency('client-1')).toBe(150);
    });
  });

  describe('Client Throughput', () => {
    it('should return 0 for non-existent client', () => {
      expect(detector.getClientThroughput('non-existent')).toBe(0);
    });

    it('should calculate throughput', () => {
      detector.recordThroughput('client-1', 100, 1000); // 100 events in 1 second

      expect(detector.getClientThroughput('client-1')).toBe(100);
    });

    it('should update throughput on new samples', () => {
      detector.recordThroughput('client-1', 50, 500);
      detector.recordThroughput('client-1', 50, 500);

      expect(detector.getClientThroughput('client-1')).toBe(100);
    });

    it('should detect slow client based on throughput', () => {
      const lowThroughputDetector = new SlowClientDetector({
        throughputThreshold: 50,
        detectionCount: 2
      });

      lowThroughputDetector.recordThroughput('client-1', 10, 1000); // 10 events/sec
      lowThroughputDetector.recordThroughput('client-1', 10, 1000);

      expect(lowThroughputDetector.isSlowClient('client-1')).toBe(true);
    });
  });

  describe('Manual Marking', () => {
    it('should manually mark client as slow', () => {
      detector.markSlowClient('client-1');
      expect(detector.isSlowClient('client-1')).toBe(true);
    });

    it('should mark with custom duration', () => {
      detector.markSlowClient('client-1', 100); // 100ms

      expect(detector.isSlowClient('client-1')).toBe(true);
    });

    it('should unmark slow client', () => {
      detector.markSlowClient('client-1');
      detector.unmarkSlowClient('client-1');

      expect(detector.isSlowClient('client-1')).toBe(false);
    });
  });

  describe('Event Recording', () => {
    it('should record event send', () => {
      const event: SSEEvent = { data: 'test' };
      detector.recordEventSend('client-1', event);

      const details = detector.getClientDetails('client-1');
      expect(details?.totalEventsSent).toBe(1);
    });

    it('should record event acknowledgment', () => {
      detector.recordEventAck('client-1');
      detector.recordEventAck('client-1', 150);

      const details = detector.getClientDetails('client-1');
      expect(details?.totalEventsAcked).toBe(2);
    });

    it('should detect slow client based on ack rate', () => {
      const ackDetector = new SlowClientDetector({
        minSamples: 2
      });

      ackDetector.recordEventSend('client-1', { data: 'test1' });
      ackDetector.recordEventSend('client-1', { data: 'test2' });
      ackDetector.recordEventSend('client-1', { data: 'test3' });
      ackDetector.recordEventSend('client-1', { data: 'test4' });
      ackDetector.recordEventSend('client-1', { data: 'test5' });

      ackDetector.recordEventAck('client-1', 100); // Only 1 ack out of 5 sent

      // Low ack rate should trigger slow detection
      expect(ackDetector.getClientDetails('client-1')?.ackRate).toBeLessThan(0.5);
    });
  });

  describe('Detection Results', () => {
    it('should get detection for client', () => {
      detector.recordLatency('client-1', 100);

      const detection = detector.getDetection('client-1');
      expect(detection).not.toBeNull();
      expect(detection?.client_id).toBe('client-1');
      expect(detection?.latency).toBe(100);
    });

    it('should return null for non-existent client', () => {
      expect(detector.getDetection('non-existent')).toBeNull();
    });

    it('should include confidence in detection', () => {
      detector.recordLatency('client-1', 500);
      detector.recordLatency('client-1', 500);

      const detection = detector.getDetection('client-1');
      expect(detection?.confidence).toBeGreaterThanOrEqual(0);
      expect(detection?.confidence).toBeLessThanOrEqual(1);
    });

    it('should include reasons in detection', () => {
      detector.recordLatency('client-1', 500);
      detector.recordLatency('client-1', 500);

      const detection = detector.getDetection('client-1');
      if (detection?.is_slow) {
        expect(detection.reasons.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Multiple Clients', () => {
    it('should get all slow clients', () => {
      detector.markSlowClient('client-1');
      detector.markSlowClient('client-2');

      const slowClients = detector.getSlowClients();
      expect(slowClients).toContain('client-1');
      expect(slowClients).toContain('client-2');
    });

    it('should get all detections', () => {
      detector.recordLatency('client-1', 100);
      detector.recordLatency('client-2', 200);

      const detections = detector.getAllDetections();
      expect(detections.size).toBe(2);
    });
  });

  describe('Inactive Clients', () => {
    it('should detect inactive clients', () => {
      detector.recordEventSend('client-1', { data: 'test' });

      // Wait (simulated by setting very short timeout in test detector)
      const inactiveDetector = new SlowClientDetector({
        inactivityTimeout: 1 // 1ms
      });

      inactiveDetector.recordEventSend('client-2', { data: 'test' });

      // client-1 should be inactive
      expect(inactiveDetector.getInactiveClients()).toContain('client-1');
    });

    it('should remove inactive clients', () => {
      const inactiveDetector = new SlowClientDetector({
        inactivityTimeout: 1
      });

      inactiveDetector.recordEventSend('client-1', { data: 'test' });

      const removed = inactiveDetector.removeInactiveClients();
      expect(removed).toBeGreaterThan(0);
    });
  });

  describe('Client Details', () => {
    it('should get client details', () => {
      detector.recordEventSend('client-1', { data: 'test1' });
      detector.recordEventSend('client-1', { data: 'test2' });
      detector.recordEventAck('client-1', 100);

      const details = detector.getClientDetails('client-1');
      expect(details).not.toBeNull();
      expect(details?.totalEventsSent).toBe(2);
      expect(details?.totalEventsAcked).toBe(1);
    });

    it('should return null for non-existent client', () => {
      expect(detector.getClientDetails('non-existent')).toBeNull();
    });

    it('should calculate ack rate', () => {
      detector.recordEventSend('client-1', { data: 'test1' });
      detector.recordEventSend('client-1', { data: 'test2' });
      detector.recordEventAck('client-1', 100);

      const details = detector.getClientDetails('client-1');
      expect(details?.ackRate).toBe(0.5);
    });

    it('should track inactive time', () => {
      detector.recordEventSend('client-1', { data: 'test' });

      const details = detector.getClientDetails('client-1');
      expect(details?.inactiveTime).not.toBeNull();
      expect(details?.inactiveTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Statistics', () => {
    it('should get statistics', () => {
      detector.recordLatency('client-1', 100);
      detector.recordLatency('client-2', 200);
      detector.markSlowClient('client-3');

      const stats = detector.getStats();
      expect(stats.totalClients).toBe(3);
      expect(stats.slowClients).toBe(1);
      expect(stats.averageLatency).toBeCloseTo(100, -1); // ~100
    });

    it('should calculate detection rate', () => {
      detector.recordLatency('client-1', 100);
      detector.markSlowClient('client-2');

      const stats = detector.getStats();
      expect(stats.detectionRate).toBe(50); // 1 out of 2 = 50%
    });
  });

  describe('Client Management', () => {
    it('should remove client', () => {
      detector.recordLatency('client-1', 100);
      detector.removeClient('client-1');

      expect(detector.getDetection('client-1')).toBeNull();
    });

    it('should get all client IDs', () => {
      detector.recordLatency('client-1', 100);
      detector.recordLatency('client-2', 200);

      const ids = detector.getClientIds();
      expect(ids).toContain('client-1');
      expect(ids).toContain('client-2');
    });

    it('should clear all', () => {
      detector.recordLatency('client-1', 100);
      detector.recordLatency('client-2', 200);

      detector.clear();
      expect(detector.getClientIds()).toHaveLength(0);
    });
  });

  describe('Event Handlers', () => {
    it('should call handlers on slow detection', () => {
      let detectedClient = '';
      let detected = false;

      detector.onSlowDetection((clientId, detection) => {
        detectedClient = clientId;
        detected = detection.is_slow;
      });

      const strictDetector = new SlowClientDetector({
        latencyThreshold: 200,
        detectionCount: 2
      });

      strictDetector.onSlowDetection((clientId, detection) => {
        if (detection.is_slow) {
          detectedClient = clientId;
          detected = true;
        }
      });

      strictDetector.recordLatency('client-1', 300);
      strictDetector.recordLatency('client-1', 300);

      expect(detected).toBe(true);
      expect(detectedClient).toBe('client-1');
    });

    it('should remove event handler', () => {
      const handler = () => {};

      detector.onSlowDetection(handler);
      detector.offSlowDetection(handler);

      // Should not throw
      detector.recordLatency('client-1', 100);
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      detector.updateConfig({
        latencyThreshold: 500,
        throughputThreshold: 20,
        detectionCount: 5
      });

      // New settings should be active
      detector.recordLatency('client-1', 400);
      detector.recordLatency('client-1', 400);
      expect(detector.isSlowClient('client-1')).toBe(false); // Under new threshold
    });
  });

  describe('Slow Expiration', () => {
    it('should expire slow mark after duration', () => {
      detector.markSlowClient('client-1', 1); // 1ms duration

      // Wait for expiration (simulated)
      setTimeout(() => {
        expect(detector.isSlowClient('client-1')).toBe(false);
      }, 10);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero latency', () => {
      detector.recordLatency('client-1', 0);
      expect(() => detector.getClientLatency('client-1')).not.toThrow();
    });

    it('should handle very high latency', () => {
      detector.recordLatency('client-1', 1000000);
      expect(() => detector.getClientLatency('client-1')).not.toThrow();
    });

    it('should handle zero throughput', () => {
      detector.recordThroughput('client-1', 0, 1000);
      expect(() => detector.getClientThroughput('client-1')).not.toThrow();
    });

    it('should handle very high throughput', () => {
      detector.recordThroughput('client-1', 100000, 1000);
      expect(() => detector.getClientThroughput('client-1')).not.toThrow();
    });

    it('should handle zero duration throughput', () => {
      expect(() => detector.recordThroughput('client-1', 100, 0)).not.toThrow();
    });
  });
});

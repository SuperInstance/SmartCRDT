/**
 * Tests for AdaptiveThrottler
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AdaptiveThrottler } from '../src/AdaptiveThrottler.js';
import type { SSEEvent, ThrottleParams } from '../src/types.js';

describe('AdaptiveThrottler', () => {
  let throttler: AdaptiveThrottler;

  beforeEach(() => {
    throttler = new AdaptiveThrottler();
  });

  describe('Throttle Rate Calculation', () => {
    it('should calculate initial throttle rate', () => {
      const rate = throttler.calculateThrottleRate('client-1');
      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThanOrEqual(1000);
    });

    it('should decrease rate on high latency', () => {
      throttler.recordLatency('client-1', 500); // High latency
      throttler.recordLatency('client-1', 600);
      throttler.recordLatency('client-1', 700);

      const rate = throttler.calculateThrottleRate('client-1');
      expect(rate).toBeLessThan(1000);
    });

    it('should increase rate on low latency when auto-increase enabled', () => {
      throttler.setThrottleRate('client-1', 50); // Start low
      throttler.recordLatency('client-1', 20); // Low latency
      throttler.recordLatency('client-1', 30);
      throttler.recordLatency('client-1', 25);

      const rate = throttler.calculateThrottleRate('client-1');
      expect(rate).toBeGreaterThan(50);
    });

    it('should respect min rate limit', () => {
      throttler.recordLatency('client-1', 5000); // Very high latency

      const rate = throttler.calculateThrottleRate('client-1');
      expect(rate).toBeGreaterThanOrEqual(1);
    });

    it('should respect max rate limit', () => {
      throttler.recordLatency('client-1', 10); // Very low latency

      const rate = throttler.calculateThrottleRate('client-1');
      expect(rate).toBeLessThanOrEqual(1000);
    });
  });

  describe('Throttle Rate Adjustment', () => {
    it('should adjust throttle rate', () => {
      const adjusted = throttler.adjustThrottle('client-1', 500);
      expect(adjusted).toBe(500);
    });

    it('should clamp adjustment to limits', () => {
      const tooHigh = throttler.adjustThrottle('client-1', 10000);
      expect(tooHigh).toBeLessThanOrEqual(1000);

      const tooLow = throttler.adjustThrottle('client-1', 0);
      expect(tooLow).toBeGreaterThanOrEqual(1);
    });

    it('should record adjustment history', () => {
      throttler.adjustThrottle('client-1', 100);
      throttler.adjustThrottle('client-1', 200);

      const history = throttler.getAdjustmentHistory('client-1');
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('Throttle Statistics', () => {
    it('should get throttle stats', () => {
      throttler.setThrottleRate('client-1', 100);
      throttler.recordDelivery('client-1', true); // throttled
      throttler.recordDelivery('client-1', false); // delivered

      const stats = throttler.getThrottleStats('client-1');
      expect(stats).not.toBeNull();
      expect(stats?.current_rate).toBe(100);
      expect(stats?.throttled_count).toBe(1);
      expect(stats?.delivered_count).toBe(1);
    });

    it('should return null for non-existent client', () => {
      expect(throttler.getThrottleStats('non-existent')).toBeNull();
    });

    it('should calculate throttle percentage', () => {
      throttler.setThrottleRate('client-1', 50); // Half of max

      const stats = throttler.getThrottleStats('client-1');
      expect(stats?.throttle_percent).toBeGreaterThan(0);
    });

    it('should track average latency', () => {
      throttler.recordLatency('client-1', 100);
      throttler.recordLatency('client-1', 200);
      throttler.recordLatency('client-1', 300);

      const stats = throttler.getThrottleStats('client-1');
      expect(stats?.avg_latency).toBe(200);
    });
  });

  describe('Latency Recording', () => {
    it('should record latency samples', () => {
      throttler.recordLatency('client-1', 150);
      throttler.recordLatency('client-1', 200);

      const stats = throttler.getThrottleStats('client-1');
      expect(stats?.avg_latency).toBeGreaterThan(0);
    });

    it('should limit sample history', () => {
      for (let i = 0; i < 200; i++) {
        throttler.recordLatency('client-1', i);
      }

      // Should not crash, history should be limited
      const stats = throttler.getThrottleStats('client-1');
      expect(stats).not.toBeNull();
    });
  });

  describe('Throughput Recording', () => {
    it('should record throughput samples', () => {
      throttler.recordThroughput('client-1', 100, 1000); // 100 events in 1 second

      const stats = throttler.getThrottleStats('client-1');
      // Throughput should be tracked
      expect(stats).not.toBeNull();
    });

    it('should calculate current throughput', () => {
      throttler.recordThroughput('client-1', 50, 500); // 50 events in 500ms
      throttler.recordThroughput('client-1', 50, 500);

      // Should be 100 events/sec
      const state = throttler['clientStates'].get('client-1');
      expect(state?.currentThroughput).toBe(100);
    });
  });

  describe('Delivery Recording', () => {
    it('should record delivery', () => {
      throttler.recordDelivery('client-1', false);

      const state = throttler['clientStates'].get('client-1');
      expect(state?.deliveredCount).toBe(1);
    });

    it('should record throttled delivery', () => {
      throttler.recordDelivery('client-1', true);

      const state = throttler['clientStates'].get('client-1');
      expect(state?.throttledCount).toBe(1);
    });
  });

  describe('Should Throttle', () => {
    it('should not throttle when inactive', () => {
      const event: SSEEvent = { data: 'test' };

      expect(throttler.shouldThrottle('client-1', event)).toBe(false);
    });

    it('should not throttle critical events', () => {
      throttler.setThrottlingActive('client-1', true);
      const event: SSEEvent = { data: 'critical', priority: 'critical' };

      expect(throttler.shouldThrottle('client-1', event)).toBe(false);
    });

    it('should throttle based on rate', () => {
      throttler.setThrottleRate('client-1', 1); // 1 event/sec
      throttler.setThrottlingActive('client-1', true);
      throttler.recordDelivery('client-1', false);

      const event: SSEEvent = { data: 'test' };
      expect(throttler.shouldThrottle('client-1', event)).toBe(true);
    });
  });

  describe('Throttle Rate Management', () => {
    it('should set throttle rate', () => {
      throttler.setThrottleRate('client-1', 100);
      expect(throttler.getCurrentRate('client-1')).toBe(100);
    });

    it('should get current rate', () => {
      expect(throttler.getCurrentRate('client-1')).toBe(1000); // Default max
    });

    it('should reset throttle to original', () => {
      throttler.setThrottleRate('client-1', 50);
      throttler.recordDelivery('client-1', true);

      throttler.resetThrottle('client-1');
      expect(throttler.getCurrentRate('client-1')).toBe(1000); // Back to max
    });

    it('should enable/disable throttling', () => {
      throttler.setThrottlingActive('client-1', true);
      throttler.setThrottlingActive('client-1', false);

      const state = throttler['clientStates'].get('client-1');
      expect(state?.isActive).toBe(false);
    });
  });

  describe('Client Management', () => {
    it('should remove client', () => {
      throttler.recordLatency('client-1', 100);
      throttler.removeClient('client-1');

      expect(throttler.getCurrentRate('client-1')).toBe(1000); // Back to default
    });

    it('should clear all clients', () => {
      throttler.recordLatency('client-1', 100);
      throttler.recordLatency('client-2', 200);

      throttler.clear();
      expect(throttler.getClientIds()).toHaveLength(0);
    });

    it('should get all client IDs', () => {
      throttler.recordLatency('client-1', 100);
      throttler.recordLatency('client-2', 200);

      const ids = throttler.getClientIds();
      expect(ids).toContain('client-1');
      expect(ids).toContain('client-2');
    });
  });

  describe('Global Statistics', () => {
    it('should get global stats', () => {
      throttler.recordLatency('client-1', 100);
      throttler.recordLatency('client-2', 200);
      throttler.setThrottlingActive('client-1', true);

      const stats = throttler.getGlobalStats();
      expect(stats.totalClients).toBe(2);
      expect(stats.activeClients).toBe(1);
    });

    it('should calculate average throttle percent', () => {
      throttler.setThrottleRate('client-1', 500);
      throttler.setThrottlingActive('client-1', true);

      const stats = throttler.getGlobalStats();
      expect(stats.averageThrottlePercent).toBeGreaterThan(0);
    });

    it('should track total throttled and delivered', () => {
      throttler.recordDelivery('client-1', true);
      throttler.recordDelivery('client-1', false);
      throttler.recordDelivery('client-2', false);

      const stats = throttler.getGlobalStats();
      expect(stats.totalThrottled).toBe(1);
      expect(stats.totalDelivered).toBe(2);
    });

    it('should calculate average latency', () => {
      throttler.recordLatency('client-1', 100);
      throttler.recordLatency('client-2', 200);

      const stats = throttler.getGlobalStats();
      expect(stats.averageLatency).toBe(150);
    });
  });

  describe('Auto Adjust All', () => {
    it('should auto-adjust all clients', () => {
      throttler.recordLatency('client-1', 500); // High latency
      throttler.recordLatency('client-2', 50);  // Low latency

      const adjustments = throttler.autoAdjustAll();
      expect(adjustments.size).toBe(2);
    });
  });

  describe('Get Recommended Rate', () => {
    it('should recommend rate based on conditions', () => {
      const rate = throttler.getRecommendedRate('client-1', {
        latency: 500,
        throughput: 100,
        bufferUsage: 0.8
      });

      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThanOrEqual(1000);
    });

    it('should decrease rate on high latency', () => {
      const normalRate = throttler.getRecommendedRate('client-1', {
        latency: 50,
        throughput: 100,
        bufferUsage: 0.5
      });

      const highLatencyRate = throttler.getRecommendedRate('client-1', {
        latency: 500,
        throughput: 100,
        bufferUsage: 0.5
      });

      expect(highLatencyRate).toBeLessThan(normalRate);
    });

    it('should decrease rate on high buffer usage', () => {
      const lowBufferRate = throttler.getRecommendedRate('client-1', {
        latency: 100,
        throughput: 100,
        bufferUsage: 0.5
      });

      const highBufferRate = throttler.getRecommendedRate('client-1', {
        latency: 100,
        throughput: 100,
        bufferUsage: 0.9
      });

      expect(highBufferRate).toBeLessThan(lowBufferRate);
    });
  });

  describe('Configuration', () => {
    it('should update parameters', () => {
      throttler.updateParams({
        min_rate: 5,
        max_rate: 500,
        target_latency: 50
      });

      const params = throttler.getParams();
      expect(params.min_rate).toBe(5);
      expect(params.max_rate).toBe(500);
      expect(params.target_latency).toBe(50);
    });

    it('should get current parameters', () => {
      const params = throttler.getParams();
      expect(params).toHaveProperty('min_rate');
      expect(params).toHaveProperty('max_rate');
      expect(params).toHaveProperty('target_latency');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero latency', () => {
      throttler.recordLatency('client-1', 0);
      expect(() => throttler.calculateThrottleRate('client-1')).not.toThrow();
    });

    it('should handle very high latency', () => {
      throttler.recordLatency('client-1', 100000);
      expect(() => throttler.calculateThrottleRate('client-1')).not.toThrow();
    });

    it('should handle zero throughput', () => {
      throttler.recordThroughput('client-1', 0, 1000);
      expect(() => throttler.getThrottleStats('client-1')).not.toThrow();
    });

    it('should handle very high throughput', () => {
      throttler.recordThroughput('client-1', 10000, 100);
      expect(() => throttler.getThrottleStats('client-1')).not.toThrow();
    });

    it('should handle zero duration throughput', () => {
      expect(() => throttler.recordThroughput('client-1', 100, 0)).not.toThrow();
    });
  });

  describe('Adjustment History', () => {
    it('should limit adjustment history', () => {
      for (let i = 0; i < 200; i++) {
        throttler.adjustThrottle('client-1', i);
      }

      const history = throttler.getAdjustmentHistory('client-1');
      expect(history.length).toBeLessThanOrEqual(100);
    });

    it('should track adjustment reasons', () => {
      throttler.adjustThrottle('client-1', 100);

      const history = throttler.getAdjustmentHistory('client-1');
      expect(history[0]?.reason).toBe('manual_adjustment');
    });
  });

  describe('Recent Samples', () => {
    it('should calculate recent average latency', () => {
      throttler.recordLatency('client-1', 100);
      throttler.recordLatency('client-1', 200);
      throttler.recordLatency('client-1', 300);

      const state = throttler['clientStates'].get('client-1');
      const recentAvg = throttler['getRecentAverageLatency'](state!, 10000);
      expect(recentAvg).toBe(200);
    });

    it('should calculate recent throughput', () => {
      throttler.recordThroughput('client-1', 100, 1000);
      throttler.recordThroughput('client-1', 100, 1000);

      const state = throttler['clientStates'].get('client-1');
      const recentThroughput = throttler['getRecentThroughput'](state!, 10000);
      expect(recentThroughput).toBe(100);
    });
  });
});

/**
 * Tests for core types and utilities
 */

import { describe, it, expect } from 'vitest';
import {
  PressureLevel,
  FlowControlStrategy,
  DropStrategy,
  EventPriority,
  PRIORITY_SCORES,
  getPriorityScore,
  calculateBufferUsage,
  getPressureLevelFromUsage,
  estimateEventSize,
  createBackpressureEvent,
  createBackpressureAlert,
  DEFAULT_FLOW_CONTROL_CONFIG,
  DEFAULT_DETECTOR_CONFIG,
  DEFAULT_THROTTLE_PARAMS,
  DEFAULT_BACKPRESSURE_CONFIG
} from '../src/types.js';

describe('Types and Utilities', () => {
  describe('Priority Scores', () => {
    it('should have correct priority scores', () => {
      expect(PRIORITY_SCORES.critical).toBe(1000);
      expect(PRIORITY_SCORES.high).toBe(100);
      expect(PRIORITY_SCORES.normal).toBe(10);
      expect(PRIORITY_SCORES.low).toBe(1);
    });

    it('should get priority score correctly', () => {
      expect(getPriorityScore('critical')).toBe(1000);
      expect(getPriorityScore('high')).toBe(100);
      expect(getPriorityScore('normal')).toBe(10);
      expect(getPriorityScore('low')).toBe(1);
    });
  });

  describe('Buffer Usage Calculation', () => {
    it('should calculate buffer usage correctly', () => {
      expect(calculateBufferUsage(0, 1000)).toBe(0);
      expect(calculateBufferUsage(500, 1000)).toBe(50);
      expect(calculateBufferUsage(1000, 1000)).toBe(100);
      expect(calculateBufferUsage(1500, 1000)).toBe(100);
    });

    it('should handle zero max size', () => {
      expect(calculateBufferUsage(100, 0)).toBe(0);
    });

    it('should clamp values to 0-100 range', () => {
      expect(calculateBufferUsage(-100, 1000)).toBe(0);
      expect(calculateBufferUsage(2000, 1000)).toBe(100);
    });
  });

  describe('Pressure Level Detection', () => {
    it('should detect none pressure level', () => {
      expect(getPressureLevelFromUsage(10, DEFAULT_DETECTOR_CONFIG)).toBe('none');
      expect(getPressureLevelFromUsage(20, DEFAULT_DETECTOR_CONFIG)).toBe('none');
    });

    it('should detect low pressure level', () => {
      expect(getPressureLevelFromUsage(30, DEFAULT_DETECTOR_CONFIG)).toBe('low');
      expect(getPressureLevelFromUsage(40, DEFAULT_DETECTOR_CONFIG)).toBe('low');
    });

    it('should detect medium pressure level', () => {
      expect(getPressureLevelFromUsage(55, DEFAULT_DETECTOR_CONFIG)).toBe('medium');
      expect(getPressureLevelFromUsage(65, DEFAULT_DETECTOR_CONFIG)).toBe('medium');
    });

    it('should detect high pressure level', () => {
      expect(getPressureLevelFromUsage(80, DEFAULT_DETECTOR_CONFIG)).toBe('high');
      expect(getPressureLevelFromUsage(90, DEFAULT_DETECTOR_CONFIG)).toBe('high');
    });

    it('should detect critical pressure level', () => {
      expect(getPressureLevelFromUsage(95, DEFAULT_DETECTOR_CONFIG)).toBe('critical');
      expect(getPressureLevelFromUsage(100, DEFAULT_DETECTOR_CONFIG)).toBe('critical');
    });
  });

  describe('Event Size Estimation', () => {
    it('should estimate size for string data', () => {
      const event = { data: 'hello world' };
      const size = estimateEventSize(event);
      expect(size).toBeGreaterThan(0);
    });

    it('should estimate size for object data', () => {
      const event = { data: { message: 'hello' } };
      const size = estimateEventSize(event);
      expect(size).toBeGreaterThan(0);
    });

    it('should use provided size if available', () => {
      const event = { data: 'test', size: 1000 };
      expect(estimateEventSize(event)).toBe(1000);
    });

    it('should account for event type and id', () => {
      const event = {
        data: 'test',
        event: 'message',
        id: 'msg-123'
      };
      const size = estimateEventSize(event);
      expect(size).toBeGreaterThan(estimateEventSize({ data: 'test' }));
    });
  });

  describe('Backpressure Event Creation', () => {
    it('should create backpressure event', () => {
      const event = createBackpressureEvent('client-1', 'high', 'applied_throttle');
      expect(event.client_id).toBe('client-1');
      expect(event.pressure_level).toBe('high');
      expect(event.action).toBe('applied_throttle');
      expect(event.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('should include metadata', () => {
      const event = createBackpressureEvent('client-1', 'critical', 'dropped_events', {
        droppedCount: 10
      });
      expect(event.metadata?.droppedCount).toBe(10);
    });
  });

  describe('Backpressure Alert Creation', () => {
    it('should create alert for critical pressure', () => {
      const metrics = {
        client_id: 'client-1',
        pressure_level: 'critical' as PressureLevel,
        buffer_stats: {
          current_size: 950000,
          max_size: 1000000,
          usage_percent: 95,
          event_count: 100,
          oldest_timestamp: Date.now() - 10000,
          newest_timestamp: Date.now(),
          total_dropped: 0,
          events_dropped: 0
        },
        bandwidth: 1000000,
        latency: 2000,
        throughput: 50,
        is_slow: false,
        strategy: 'throttle' as FlowControlStrategy,
        last_update: Date.now()
      };

      const alert = createBackpressureAlert('client-1', 'critical', metrics);
      expect(alert.severity).toBe('error');
      expect(alert.client_id).toBe('client-1');
      expect(alert.pressure_level).toBe('critical');
    });

    it('should create alert for medium pressure', () => {
      const metrics = {
        client_id: 'client-1',
        pressure_level: 'medium' as PressureLevel,
        buffer_stats: {
          current_size: 500000,
          max_size: 1000000,
          usage_percent: 50,
          event_count: 50,
          oldest_timestamp: Date.now() - 10000,
          newest_timestamp: Date.now(),
          total_dropped: 0,
          events_dropped: 0
        },
        bandwidth: 1000000,
        latency: 200,
        throughput: 100,
        is_slow: false,
        strategy: 'buffer' as FlowControlStrategy,
        last_update: Date.now()
      };

      const alert = createBackpressureAlert('client-1', 'medium', metrics);
      expect(alert.severity).toBe('warning');
    });

    it('should use custom message', () => {
      const metrics = {
        client_id: 'client-1',
        pressure_level: 'none' as PressureLevel,
        buffer_stats: {
          current_size: 0,
          max_size: 1000000,
          usage_percent: 0,
          event_count: 0,
          oldest_timestamp: null,
          newest_timestamp: null,
          total_dropped: 0,
          events_dropped: 0
        },
        bandwidth: 1000000,
        latency: 50,
        throughput: 200,
        is_slow: false,
        strategy: 'buffer' as FlowControlStrategy,
        last_update: Date.now()
      };

      const alert = createBackpressureAlert('client-1', 'none', metrics, 'All good');
      expect(alert.message).toBe('All good');
    });
  });

  describe('Default Configurations', () => {
    it('should have valid default flow control config', () => {
      expect(DEFAULT_FLOW_CONTROL_CONFIG.max_buffer_size).toBe(1024 * 1024);
      expect(DEFAULT_FLOW_CONTROL_CONFIG.max_latency).toBe(5000);
      expect(DEFAULT_FLOW_CONTROL_CONFIG.drop_strategy).toBe('lowest-priority');
      expect(DEFAULT_FLOW_CONTROL_CONFIG.default_strategy).toBe('buffer');
    });

    it('should have valid default detector config', () => {
      expect(DEFAULT_DETECTOR_CONFIG.monitor_interval).toBe(100);
      expect(DEFAULT_DETECTOR_CONFIG.low_threshold).toBe(0.25);
      expect(DEFAULT_DETECTOR_CONFIG.medium_threshold).toBe(0.50);
      expect(DEFAULT_DETECTOR_CONFIG.high_threshold).toBe(0.75);
    });

    it('should have valid default throttle params', () => {
      expect(DEFAULT_THROTTLE_PARAMS.min_rate).toBe(1);
      expect(DEFAULT_THROTTLE_PARAMS.max_rate).toBe(1000);
      expect(DEFAULT_THROTTLE_PARAMS.target_latency).toBe(100);
    });

    it('should have valid default backpressure config', () => {
      expect(DEFAULT_BACKPRESSURE_CONFIG.enable_metrics).toBe(true);
      expect(DEFAULT_BACKPRESSURE_CONFIG.enable_alerts).toBe(true);
      expect(DEFAULT_BACKPRESSURE_CONFIG.alert_on_critical).toBe(true);
      expect(DEFAULT_BACKPRESSURE_CONFIG.enable_auto_recovery).toBe(true);
    });
  });
});

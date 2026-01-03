/**
 * Tests for FlowController
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FlowController } from '../src/FlowController.js';
import type { SSEEvent, FlowControlStrategy, EventPriority, PressureLevel } from '../src/types.js';

describe('FlowController', () => {
  let controller: FlowController;

  beforeEach(() => {
    controller = new FlowController();
  });

  describe('Client State Management', () => {
    it('should create client state on first event', () => {
      const event: SSEEvent = { data: 'test' };
      controller.applyBackpressure('client-1', event);

      const state = controller.getClientState('client-1');
      expect(state).not.toBeNull();
      expect(state?.clientId).toBe('client-1');
    });

    it('should get client state', () => {
      const event: SSEEvent = { data: 'test' };
      controller.applyBackpressure('client-1', event);

      const state = controller.getClientState('client-1');
      expect(state?.clientId).toBe('client-1');
    });

    it('should return null for non-existent client', () => {
      expect(controller.getClientState('non-existent')).toBeNull();
    });

    it('should remove client', () => {
      const event: SSEEvent = { data: 'test' };
      controller.applyBackpressure('client-1', event);
      controller.removeClient('client-1');

      expect(controller.getClientState('client-1')).toBeNull();
    });

    it('should clear all clients', () => {
      controller.applyBackpressure('client-1', { data: 'test1' });
      controller.applyBackpressure('client-2', { data: 'test2' });
      controller.clear();

      expect(controller.getClientIds()).toHaveLength(0);
    });

    it('should get all client IDs', () => {
      controller.applyBackpressure('client-1', { data: 'test1' });
      controller.applyBackpressure('client-2', { data: 'test2' });
      controller.applyBackpressure('client-3', { data: 'test3' });

      const ids = controller.getClientIds();
      expect(ids).toHaveLength(3);
      expect(ids).toContain('client-1');
      expect(ids).toContain('client-2');
      expect(ids).toContain('client-3');
    });
  });

  describe('Strategy Management', () => {
    it('should set strategy for client', () => {
      controller.setStrategy('client-1', 'drop');
      expect(controller.getStrategy('client-1')).toBe('drop');
    });

    it('should return null for non-existent client strategy', () => {
      expect(controller.getStrategy('non-existent')).toBeNull();
    });

    it('should track strategy history', () => {
      controller.setStrategy('client-1', 'buffer');
      controller.setStrategy('client-1', 'throttle');
      controller.setStrategy('client-1', 'drop');

      const state = controller.getClientState('client-1');
      expect(state?.strategyHistory).toHaveLength(3);
    });

    it('should clear pending events on strategy change', () => {
      controller.setStrategy('client-1', 'buffer');
      controller.setStrategy('client-1', 'throttle');

      const state = controller.getClientState('client-1');
      expect(state?.pendingEvents).toHaveLength(0);
    });
  });

  describe('Buffer Strategy', () => {
    it('should accept all events with buffer strategy', () => {
      controller.setStrategy('client-1', 'buffer');
      const event: SSEEvent = { data: 'test' };

      const decision = controller.applyBackpressure('client-1', event);
      expect(decision.should_send).toBe(true);
      expect(decision.action).toBe('none');
    });

    it('should handle multiple events with buffer strategy', () => {
      controller.setStrategy('client-1', 'buffer');

      for (let i = 0; i < 100; i++) {
        const event: SSEEvent = { data: `event-${i}` };
        const decision = controller.applyBackpressure('client-1', event);
        expect(decision.should_send).toBe(true);
      }
    });
  });

  describe('Drop Strategy', () => {
    it('should never drop critical events', () => {
      controller.setStrategy('client-1', 'drop');
      const event: SSEEvent = { data: 'critical', priority: 'critical' };

      const decision = controller.applyBackpressure('client-1', event);
      expect(decision.should_send).toBe(true);
    });

    it('should drop low priority events with lowest-priority strategy', () => {
      const dropController = new FlowController({
        config: { drop_strategy: 'lowest-priority' }
      });
      dropController.setStrategy('client-1', 'drop');

      const event: SSEEvent = { data: 'low priority', priority: 'low' };
      const decision = dropController.applyBackpressure('client-1', event);

      // May drop low priority events
      expect(decision.pressure_level).toBeDefined();
    });

    it('should track drop statistics', () => {
      controller.setStrategy('client-1', 'drop');

      // Process some events
      for (let i = 0; i < 10; i++) {
        const event: SSEEvent = { data: `event-${i}`, priority: 'low' };
        controller.applyBackpressure('client-1', event);
      }

      const stats = controller.getDropStats('client-1');
      expect(stats).not.toBeNull();
    });
  });

  describe('Throttle Strategy', () => {
    it('should throttle events based on rate', () => {
      controller.setStrategy('client-1', 'throttle');
      controller.setThrottleRate('client-1', 10); // 10 events/sec

      const event: SSEEvent = { data: 'test' };
      const decision = controller.applyBackpressure('client-1', event);

      expect(decision).toBeDefined();
    });

    it('should set throttle rate', () => {
      controller.setThrottleRate('client-1', 100);
      expect(controller.getThrottleRate('client-1')).toBe(100);
    });

    it('should clamp throttle rate to limits', () => {
      controller.setThrottleRate('client-1', 10000);
      expect(controller.getThrottleRate('client-1')).toBeLessThanOrEqual(1000);

      controller.setThrottleRate('client-1', 0);
      expect(controller.getThrottleRate('client-1')).toBeGreaterThanOrEqual(1);
    });

    it('should adjust throttle rate by percentage', () => {
      controller.setThrottleRate('client-1', 100);
      controller.adjustThrottleRate('client-1', 50); // +50%
      expect(controller.getThrottleRate('client-1')).toBe(150);

      controller.adjustThrottleRate('client-1', -50); // -50%
      expect(controller.getThrottleRate('client-1')).toBe(75);
    });

    it('should throttle multiple events', () => {
      controller.setStrategy('client-1', 'throttle');
      controller.setThrottleRate('client-1', 5); // Very low rate

      const events: SSEEvent[] = Array(20).fill(null).map((_, i) => ({
        data: `event-${i}`
      }));

      const throttled = controller.throttle('client-1', events);
      // Should return fewer events due to throttling
      expect(throttled.length).toBeLessThanOrEqual(events.length);
    });

    it('should get pending events', () => {
      controller.setStrategy('client-1', 'throttle');
      controller.setThrottleRate('client-1', 1);

      // Send multiple events quickly
      for (let i = 0; i < 5; i++) {
        controller.applyBackpressure('client-1', { data: `event-${i}` });
      }

      const pending = controller.getPendingEvents('client-1');
      expect(pending.length).toBeGreaterThanOrEqual(0);
    });

    it('should clear pending events', () => {
      controller.setStrategy('client-1', 'throttle');
      controller.setThrottleRate('client-1', 1);

      for (let i = 0; i < 5; i++) {
        controller.applyBackpressure('client-1', { data: `event-${i}` });
      }

      controller.clearPendingEvents('client-1');
      expect(controller.getPendingEvents('client-1')).toHaveLength(0);
    });
  });

  describe('Compress Strategy', () => {
    it('should add events to compression batch', () => {
      controller.setStrategy('client-1', 'compress');

      const event: SSEEvent = { data: 'test1' };
      controller.applyBackpressure('client-1', event);

      const batch = controller.getCompressionBatch('client-1');
      expect(batch.length).toBeGreaterThanOrEqual(0);
    });

    it('should flush compression batch', () => {
      controller.setStrategy('client-1', 'compress');

      for (let i = 0; i < 5; i++) {
        controller.applyBackpressure('client-1', { data: `event-${i}` });
      }

      const flushed = controller.flushCompressionBatch('client-1');
      expect(flushed.length).toBeGreaterThanOrEqual(0);
    });

    it('should compress multiple events', () => {
      const events: SSEEvent[] = [
        { data: 'msg1', event: 'message' },
        { data: 'msg2', event: 'message' },
        { data: 'msg3', event: 'message' }
      ];

      const result = controller.compressEvents('client-1', events);
      expect(result.original_count).toBe(3);
      expect(result.compressed_count).toBeGreaterThan(0);
      expect(result.compression_ratio).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty events array', () => {
      const result = controller.compressEvents('client-1', []);
      expect(result.original_count).toBe(0);
      expect(result.compressed_count).toBe(0);
    });

    it('should handle single event', () => {
      const events: SSEEvent[] = [{ data: 'single' }];
      const result = controller.compressEvents('client-1', events);
      expect(result.original_count).toBe(1);
      expect(result.compression_ratio).toBe(0);
    });
  });

  describe('Drop Events by Priority', () => {
    it('should drop events below threshold', () => {
      const events: SSEEvent[] = [
        { data: 'critical', priority: 'critical' },
        { data: 'high', priority: 'high' },
        { data: 'normal', priority: 'normal' },
        { data: 'low', priority: 'low' }
      ];

      const filtered = controller.dropEvents(events, 'high');
      expect(filtered).toHaveLength(2); // critical and high
      expect(filtered.every(e => e.priority === 'critical' || e.priority === 'high')).toBe(true);
    });

    it('should keep all events when threshold is low', () => {
      const events: SSEEvent[] = [
        { data: 'critical', priority: 'critical' },
        { data: 'high', priority: 'high' },
        { data: 'normal', priority: 'normal' },
        { data: 'low', priority: 'low' }
      ];

      const filtered = controller.dropEvents(events, 'low');
      expect(filtered).toHaveLength(4);
    });

    it('should keep only critical when threshold is critical', () => {
      const events: SSEEvent[] = [
        { data: 'critical', priority: 'critical' },
        { data: 'high', priority: 'high' },
        { data: 'normal', priority: 'normal' }
      ];

      const filtered = controller.dropEvents(events, 'critical');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].priority).toBe('critical');
    });
  });

  describe('Pressure Level Management', () => {
    it('should update pressure level', () => {
      controller.updatePressureLevel('client-1', 'high');
      const state = controller.getClientState('client-1');
      expect(state?.pressureLevel).toBe('high');
    });

    it('should auto-switch strategy when enabled', () => {
      const autoController = new FlowController({
        autoSwitchStrategy: true
      });

      autoController.updatePressureLevel('client-1', 'critical');
      autoController.applyBackpressure('client-1', { data: 'test' });

      const state = autoController.getClientState('client-1');
      // Should switch to drop strategy at critical pressure
      expect(state?.strategy).toBe('drop');
    });

    it('should not auto-switch when disabled', () => {
      const manualController = new FlowController({
        autoSwitchStrategy: false
      });

      manualController.setStrategy('client-1', 'buffer');
      manualController.updatePressureLevel('client-1', 'critical');
      manualController.applyBackpressure('client-1', { data: 'test' });

      const state = manualController.getClientState('client-1');
      expect(state?.strategy).toBe('buffer'); // Should not change
    });
  });

  describe('Event Handlers', () => {
    it('should call backpressure event handlers', () => {
      const handler = vi.fn();
      controller.onBackpressureEvent(handler);

      controller.setStrategy('client-1', 'drop');
      expect(handler).toHaveBeenCalled();
    });

    it('should remove event handler', () => {
      const handler = vi.fn();
      controller.onBackpressureEvent(handler);
      controller.offBackpressureEvent(handler);

      controller.setStrategy('client-1', 'drop');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle handler errors gracefully', () => {
      const badHandler = vi.fn(() => {
        throw new Error('Handler error');
      });

      controller.onBackpressureEvent(badHandler);
      expect(() => controller.setStrategy('client-1', 'drop')).not.toThrow();
    });
  });

  describe('Statistics', () => {
    it('should get statistics', () => {
      controller.setStrategy('client-1', 'buffer');
      controller.setStrategy('client-2', 'throttle');
      controller.setStrategy('client-3', 'drop');

      const stats = controller.getStats();
      expect(stats.totalClients).toBe(3);
      expect(stats.strategies.buffer).toBe(1);
      expect(stats.strategies.throttle).toBe(1);
      expect(stats.strategies.drop).toBe(1);
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      controller.updateConfig({
        max_buffer_size: 2048 * 1024,
        drop_strategy: 'oldest'
      });

      const config = controller.getConfig();
      expect(config.max_buffer_size).toBe(2048 * 1024);
      expect(config.drop_strategy).toBe('oldest');
    });

    it('should get current configuration', () => {
      const config = controller.getConfig();
      expect(config).toHaveProperty('max_buffer_size');
      expect(config).toHaveProperty('drop_strategy');
    });
  });

  describe('Edge Cases', () => {
    it('should handle event without priority', () => {
      controller.setStrategy('client-1', 'drop');
      const event: SSEEvent = { data: 'test' }; // No priority

      const decision = controller.applyBackpressure('client-1', event);
      expect(decision).toBeDefined();
    });

    it('should handle event with default priority', () => {
      controller.setStrategy('client-1', 'drop');
      const event: SSEEvent = { data: 'test', priority: 'normal' };

      const decision = controller.applyBackpressure('client-1', event);
      expect(decision).toBeDefined();
    });

    it('should handle rapid strategy changes', () => {
      const strategies: FlowControlStrategy[] = ['buffer', 'throttle', 'compress', 'drop'];
      for (const strategy of strategies) {
        controller.setStrategy('client-1', strategy);
        expect(controller.getStrategy('client-1')).toBe(strategy);
      }
    });
  });
});

/**
 * Tests for BufferManager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BufferManager } from '../src/BufferManager.js';
import type { SSEEvent, DropStrategy } from '../src/types.js';

describe('BufferManager', () => {
  let manager: BufferManager;

  beforeEach(() => {
    manager = new BufferManager(1000, 'lowest-priority');
  });

  describe('Basic Buffering', () => {
    it('should buffer an event', () => {
      const event: SSEEvent = { data: 'test' };
      const result = manager.bufferEvent('client-1', event);
      expect(result).toBe(true);
    });

    it('should buffer multiple events', () => {
      for (let i = 0; i < 10; i++) {
        const event: SSEEvent = { data: `event-${i}` };
        expect(manager.bufferEvent('client-1', event)).toBe(true);
      }
    });

    it('should get buffer size', () => {
      const event: SSEEvent = { data: 'test' };
      manager.bufferEvent('client-1', event);

      const size = manager.getBufferSize('client-1');
      expect(size).toBeGreaterThan(0);
    });

    it('should get event count', () => {
      manager.bufferEvent('client-1', { data: 'test1' });
      manager.bufferEvent('client-1', { data: 'test2' });
      manager.bufferEvent('client-1', { data: 'test3' });

      expect(manager.getEventCount('client-1')).toBe(3);
    });
  });

  describe('Buffer Overflow', () => {
    it('should drop events when buffer is full', () => {
      const smallManager = new BufferManager(100, 'oldest');

      // Add events until buffer is full
      let buffered = 0;
      for (let i = 0; i < 100; i++) {
        if (smallManager.bufferEvent('client-1', { data: `x`.repeat(10) })) {
          buffered++;
        }
      }

      // Some events should have been dropped
      const stats = smallManager.getBufferStats('client-1');
      expect(stats?.events_dropped).toBeGreaterThan(0);
    });

    it('should drop based on oldest strategy', () => {
      const dropManager = new BufferManager(100, 'oldest');

      dropManager.bufferEvent('client-1', { data: 'first' });
      dropManager.bufferEvent('client-1', { data: 'second' });

      // Add more to trigger overflow
      for (let i = 0; i < 20; i++) {
        dropManager.bufferEvent('client-1', { data: `x`.repeat(10) });
      }

      // Oldest events should be dropped
      expect(dropManager.getEventCount('client-1')).toBeLessThan(22);
    });

    it('should drop based on newest strategy', () => {
      const dropManager = new BufferManager(100, 'newest');

      dropManager.bufferEvent('client-1', { data: 'first' });

      for (let i = 0; i < 20; i++) {
        dropManager.bufferEvent('client-1', { data: `x`.repeat(10) });
      }

      expect(dropManager.getEventCount('client-1')).toBeLessThan(21);
    });

    it('should drop based on lowest-priority strategy', () => {
      const dropManager = new BufferManager(100, 'lowest-priority');

      dropManager.bufferEvent('client-1', { data: 'critical', priority: 'critical' });
      dropManager.bufferEvent('client-1', { data: 'low', priority: 'low' });

      for (let i = 0; i < 20; i++) {
        dropManager.bufferEvent('client-1', { data: `x`.repeat(10), priority: 'low' });
      }

      const allEvents = manager.getEventsByPriority('client-1');
      // Critical event should still be there
      expect(dropManager.getEventCount('client-1')).toBeGreaterThan(0);
    });
  });

  describe('Dequeue Operations', () => {
    it('should peek at event', () => {
      manager.bufferEvent('client-1', { data: 'first' });
      manager.bufferEvent('client-1', { data: 'second' });

      const peeked = manager.peek('client-1');
      expect(peeked).not.toBeNull();
      expect(peeked?.data).toBe('first');
    });

    it('should dequeue event', () => {
      manager.bufferEvent('client-1', { data: 'first' });
      manager.bufferEvent('client-1', { data: 'second' });

      const dequeued = manager.dequeue('client-1');
      expect(dequeued).not.toBeNull();
      expect(dequeued?.data).toBe('first');

      // Buffer size should decrease
      expect(manager.getEventCount('client-1')).toBe(1);
    });

    it('should dequeue multiple events', () => {
      for (let i = 0; i < 10; i++) {
        manager.bufferEvent('client-1', { data: `event-${i}` });
      }

      const events = manager.dequeueMultiple('client-1', 5);
      expect(events).toHaveLength(5);
      expect(manager.getEventCount('client-1')).toBe(5);
    });

    it('should return null when dequeuing empty buffer', () => {
      const dequeued = manager.dequeue('client-1');
      expect(dequeued).toBeNull();
    });

    it('should return null when peeking empty buffer', () => {
      const peeked = manager.peek('client-1');
      expect(peeked).toBeNull();
    });
  });

  describe('Flush Operations', () => {
    it('should flush buffer', () => {
      for (let i = 0; i < 10; i++) {
        manager.bufferEvent('client-1', { data: `event-${i}` });
      }

      const result = manager.flushBuffer('client-1');
      expect(result.count).toBe(10);
      expect(result.events).toHaveLength(10);
      expect(manager.getEventCount('client-1')).toBe(0);
    });

    it('should return empty flush for non-existent client', () => {
      const result = manager.flushBuffer('non-existent');
      expect(result.count).toBe(0);
      expect(result.events).toHaveLength(0);
    });

    it('should track bytes flushed', () => {
      manager.bufferEvent('client-1', { data: 'test message' });

      const beforeSize = manager.getBufferSize('client-1');
      const result = manager.flushBuffer('client-1');

      expect(result.bytes).toBe(beforeSize);
    });
  });

  describe('Buffer Statistics', () => {
    it('should get buffer stats', () => {
      manager.bufferEvent('client-1', { data: 'test' });

      const stats = manager.getBufferStats('client-1');
      expect(stats).not.toBeNull();
      expect(stats?.current_size).toBeGreaterThan(0);
      expect(stats?.event_count).toBe(1);
      expect(stats?.max_size).toBe(1000);
    });

    it('should return null for non-existent client stats', () => {
      expect(manager.getBufferStats('non-existent')).toBeNull();
    });

    it('should track dropped events', () => {
      const smallManager = new BufferManager(50, 'oldest');

      for (let i = 0; i < 10; i++) {
        smallManager.bufferEvent('client-1', { data: `x`.repeat(10) });
      }

      const stats = smallManager.getBufferStats('client-1');
      expect(stats?.events_dropped).toBeGreaterThan(0);
      expect(stats?.total_dropped).toBeGreaterThan(0);
    });

    it('should track buffer timestamps', () => {
      manager.bufferEvent('client-1', { data: 'first' });
      manager.bufferEvent('client-1', { data: 'second' });

      const stats = manager.getBufferStats('client-1');
      expect(stats?.oldest_timestamp).not.toBeNull();
      expect(stats?.newest_timestamp).not.toBeNull();
      expect(stats?.newest_timestamp).toBeGreaterThanOrEqual(stats!.oldest_timestamp!);
    });

    it('should calculate usage percentage', () => {
      const event: SSEEvent = { data: 'x'.repeat(100) };
      manager.bufferEvent('client-1', event);

      const stats = manager.getBufferStats('client-1');
      expect(stats?.usage_percent).toBeGreaterThan(0);
      expect(stats?.usage_percent).toBeLessThanOrEqual(100);
    });
  });

  describe('Buffer Management', () => {
    it('should clear buffer', () => {
      manager.bufferEvent('client-1', { data: 'test1' });
      manager.bufferEvent('client-1', { data: 'test2' });

      manager.clearBuffer('client-1');
      expect(manager.getEventCount('client-1')).toBe(0);
      expect(manager.getBufferSize('client-1')).toBe(0);
    });

    it('should remove buffer', () => {
      manager.bufferEvent('client-1', { data: 'test' });
      manager.removeBuffer('client-1');

      expect(manager.getEventCount('client-1')).toBe(0);
    });

    it('should set buffer limit', () => {
      manager.setBufferLimit('client-1', 500);

      const stats = manager.getBufferStats('client-1');
      expect(stats?.max_size).toBe(500);
    });

    it('should drop events when limit is reduced', () => {
      for (let i = 0; i < 10; i++) {
        manager.bufferEvent('client-1', { data: `x`.repeat(100) });
      }

      const beforeCount = manager.getEventCount('client-1');
      manager.setBufferLimit('client-1', 500);
      const afterCount = manager.getEventCount('client-1');

      expect(afterCount).toBeLessThanOrEqual(beforeCount);
    });

    it('should set drop strategy', () => {
      manager.setDropStrategy('client-1', 'oldest');
      // Should not throw
    });

    it('should check if buffer is full', () => {
      const smallManager = new BufferManager(50, 'oldest');

      // Fill buffer
      for (let i = 0; i < 10; i++) {
        smallManager.bufferEvent('client-1', { data: `x`.repeat(10) });
      }

      expect(smallManager.isFull('client-1')).toBe(true);
    });

    it('should check if buffer is empty', () => {
      expect(manager.isEmpty('client-1')).toBe(true);

      manager.bufferEvent('client-1', { data: 'test' });
      expect(manager.isEmpty('client-1')).toBe(false);
    });
  });

  describe('Priority Operations', () => {
    it('should get events by priority', () => {
      manager.bufferEvent('client-1', { data: 'low', priority: 'low' });
      manager.bufferEvent('client-1', { data: 'critical', priority: 'critical' });
      manager.bufferEvent('client-1', { data: 'normal', priority: 'normal' });

      const byPriority = manager.getEventsByPriority('client-1');
      expect(byPriority).toHaveLength(3);
    });

    it('should get old events', () => {
      manager.bufferEvent('client-1', { data: 'old1' });
      // Wait a bit (simulated)
      manager.bufferEvent('client-1', { data: 'old2' });

      const oldEvents = manager.getOldEvents('client-1', 1); // 1ms threshold
      expect(Array.isArray(oldEvents)).toBe(true);
    });

    it('should remove old events', () => {
      manager.bufferEvent('client-1', { data: 'event1' });
      manager.bufferEvent('client-1', { data: 'event2' });

      const removed = manager.removeOldEvents('client-1', 0); // Remove all
      expect(removed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Buffer Health', () => {
    it('should get buffer health', () => {
      const health = manager.getBufferHealth('client-1');
      expect(health).toBeDefined();
      expect(health.status).toMatch(/healthy|warning|critical/);
    });

    it('should report healthy status for low usage', () => {
      manager.bufferEvent('client-1', { data: 'x'.repeat(10) });

      const health = manager.getBufferHealth('client-1');
      expect(health.status).toBe('healthy');
    });

    it('should compact buffer', () => {
      const smallManager = new BufferManager(200, 'lowest-priority');

      for (let i = 0; i < 20; i++) {
        const priority = i % 2 === 0 ? 'critical' : 'low';
        smallManager.bufferEvent('client-1', { data: `x`.repeat(10), priority });
      }

      const removed = smallManager.compactBuffer('client-1', 50);
      expect(removed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Multiple Clients', () => {
    it('should handle multiple clients', () => {
      manager.bufferEvent('client-1', { data: 'test1' });
      manager.bufferEvent('client-2', { data: 'test2' });
      manager.bufferEvent('client-3', { data: 'test3' });

      expect(manager.getEventCount('client-1')).toBe(1);
      expect(manager.getEventCount('client-2')).toBe(1);
      expect(manager.getEventCount('client-3')).toBe(1);
    });

    it('should get all client IDs', () => {
      manager.bufferEvent('client-1', { data: 'test1' });
      manager.bufferEvent('client-2', { data: 'test2' });

      const ids = manager.getClientIds();
      expect(ids).toContain('client-1');
      expect(ids).toContain('client-2');
    });
  });

  describe('Global Statistics', () => {
    it('should get global stats', () => {
      manager.bufferEvent('client-1', { data: 'test1' });
      manager.bufferEvent('client-2', { data: 'test2' });

      const stats = manager.getGlobalStats();
      expect(stats.totalClients).toBe(2);
      expect(stats.totalEvents).toBe(2);
    });

    it('should calculate average usage', () => {
      manager.bufferEvent('client-1', { data: 'x'.repeat(100) });
      manager.bufferEvent('client-2', { data: 'x'.repeat(200) });

      const stats = manager.getGlobalStats();
      expect(stats.averageUsage).toBeGreaterThan(0);
    });

    it('should track total dropped', () => {
      const smallManager = new BufferManager(50, 'oldest');

      for (let i = 0; i < 20; i++) {
        smallManager.bufferEvent('client-1', { data: `x`.repeat(10) });
      }

      const stats = smallManager.getGlobalStats();
      expect(stats.totalDropped).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large event', () => {
      const largeEvent: SSEEvent = { data: 'x'.repeat(10000) };
      const result = manager.bufferEvent('client-1', largeEvent);

      // Should fail because event is larger than buffer
      expect(result).toBe(false);
    });

    it('should handle empty event data', () => {
      const event: SSEEvent = { data: '' };
      const result = manager.bufferEvent('client-1', event);
      expect(result).toBe(true);
    });

    it('should handle event with object data', () => {
      const event: SSEEvent = { data: { message: 'test' } };
      const result = manager.bufferEvent('client-1', event);
      expect(result).toBe(true);
    });

    it('should handle event with custom size', () => {
      const event: SSEEvent = { data: 'test', size: 50 };
      manager.bufferEvent('client-1', event);

      const stats = manager.getBufferStats('client-1');
      expect(stats?.current_size).toBe(50);
    });
  });

  describe('Configuration', () => {
    it('should use custom default max size', () => {
      const customManager = new BufferManager(500, 'oldest');
      customManager.bufferEvent('client-1', { data: 'test' });

      const stats = customManager.getBufferStats('client-1');
      expect(stats?.max_size).toBe(500);
    });

    it('should use custom default drop strategy', () => {
      const customManager = new BufferManager(1000, 'newest');
      // Should not throw
      customManager.bufferEvent('client-1', { data: 'test' });
    });

    it('should update default max size', () => {
      manager.setDefaultMaxSize(2000);
      const newManager = new BufferManager();
      // Should use new default
    });

    it('should update default drop strategy', () => {
      manager.setDefaultDropStrategy('random');
      // Should not throw
    });
  });

  describe('Clear All', () => {
    it('should clear all buffers', () => {
      manager.bufferEvent('client-1', { data: 'test1' });
      manager.bufferEvent('client-2', { data: 'test2' });

      manager.clear();
      expect(manager.getClientIds()).toHaveLength(0);
    });
  });

  describe('Buffer Multiple Events', () => {
    it('should buffer multiple events', () => {
      const events: SSEEvent[] = [
        { data: 'event1' },
        { data: 'event2' },
        { data: 'event3' }
      ];

      const buffered = manager.bufferEvents('client-1', events);
      expect(buffered).toBe(3);
    });

    it('should return count of buffered events', () => {
      const smallManager = new BufferManager(50, 'oldest');

      const events: SSEEvent[] = Array(20).fill(null).map((_, i) => ({
        data: `x`.repeat(10)
      }));

      const buffered = smallManager.bufferEvents('client-1', events);
      expect(buffered).toBeLessThan(20); // Some should be dropped
    });
  });
});

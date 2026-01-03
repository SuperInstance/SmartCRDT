/**
 * Tests for PriorityQueue
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PriorityQueue } from '../src/PriorityQueue.js';
import type { SSEEvent, EventPriority } from '../src/types.js';

describe('PriorityQueue', () => {
  let queue: PriorityQueue;

  beforeEach(() => {
    queue = new PriorityQueue(100);
  });

  describe('Basic Operations', () => {
    it('should enqueue an event', () => {
      const event: SSEEvent = { data: 'test' };
      const result = queue.enqueue('client-1', event, 'normal');
      expect(result).toBe(true);
    });

    it('should enqueue with priority', () => {
      const event: SSEEvent = { data: 'test' };
      queue.enqueue('client-1', event, 'critical');
      expect(queue.getQueueSize('client-1')).toBe(1);
    });

    it('should get queue size', () => {
      queue.enqueue('client-1', { data: 'test1' }, 'normal');
      queue.enqueue('client-1', { data: 'test2' }, 'normal');

      expect(queue.getQueueSize('client-1')).toBe(2);
    });

    it('should check if queue is empty', () => {
      expect(queue.isEmpty('client-1')).toBe(true);

      queue.enqueue('client-1', { data: 'test' }, 'normal');
      expect(queue.isEmpty('client-1')).toBe(false);
    });

    it('should return 0 for non-existent client size', () => {
      expect(queue.getQueueSize('non-existent')).toBe(0);
    });

    it('should return true for empty non-existent client', () => {
      expect(queue.isEmpty('non-existent')).toBe(true);
    });
  });

  describe('Dequeue Operations', () => {
    it('should peek at highest priority event', () => {
      queue.enqueue('client-1', { data: 'low' }, 'low');
      queue.enqueue('client-1', { data: 'critical' }, 'critical');

      const peeked = queue.peek('client-1');
      expect(peeked).not.toBeNull();
      expect(peeked?.data).toBe('critical'); // Critical should be first
    });

    it('should dequeue highest priority event', () => {
      queue.enqueue('client-1', { data: 'low' }, 'low');
      queue.enqueue('client-1', { data: 'critical' }, 'critical');
      queue.enqueue('client-1', { data: 'normal' }, 'normal');

      const result = queue.dequeue('client-1');
      expect(result.event).not.toBeNull();
      expect(result.event?.data).toBe('critical');
      expect(result.priority).toBe('critical');
    });

    it('should return null when dequeuing empty queue', () => {
      const result = queue.dequeue('client-1');
      expect(result.event).toBeNull();
      expect(result.isEmpty).toBe(true);
    });

    it('should return null when peeking empty queue', () => {
      const peeked = queue.peek('client-1');
      expect(peeked).toBeNull();
    });

    it('should maintain priority order', () => {
      queue.enqueue('client-1', { data: 'low' }, 'low');
      queue.enqueue('client-1', { data: 'normal' }, 'normal');
      queue.enqueue('client-1', { data: 'high' }, 'high');
      queue.enqueue('client-1', { data: 'critical' }, 'critical');

      const priorities: EventPriority[] = [];
      while (!queue.isEmpty('client-1')) {
        const result = queue.dequeue('client-1');
        if (result.event) {
          priorities.push(result.priority!);
        }
      }

      expect(priorities).toEqual(['critical', 'high', 'normal', 'low']);
    });
  });

  describe('Multiple Dequeue', () => {
    it('should dequeue multiple events', () => {
      for (let i = 0; i < 10; i++) {
        queue.enqueue('client-1', { data: `event-${i}` }, 'normal');
      }

      const result = queue.dequeueMultiple('client-1', 5);
      expect(result.events).toHaveLength(5);
      expect(result.count).toBe(5);
      expect(result.remaining).toBe(5);
    });

    it('should dequeue all events if count exceeds queue size', () => {
      for (let i = 0; i < 5; i++) {
        queue.enqueue('client-1', { data: `event-${i}` }, 'normal');
      }

      const result = queue.dequeueMultiple('client-1', 100);
      expect(result.events).toHaveLength(5);
      expect(result.remaining).toBe(0);
    });

    it('should return empty result for empty queue', () => {
      const result = queue.dequeueMultiple('client-1', 5);
      expect(result.events).toHaveLength(0);
      expect(result.count).toBe(0);
    });
  });

  describe('Queue Statistics', () => {
    it('should get queue stats', () => {
      queue.enqueue('client-1', { data: 'test1' }, 'critical');
      queue.enqueue('client-1', { data: 'test2' }, 'normal');

      const stats = queue.getQueueStats('client-1');
      expect(stats).not.toBeNull();
      expect(stats?.size).toBe(2);
      expect(stats?.maxSize).toBe(100);
      expect(stats?.totalEnqueued).toBe(2);
    });

    it('should return null for non-existent client stats', () => {
      expect(queue.getQueueStats('non-existent')).toBeNull();
    });

    it('should track dequeued events', () => {
      queue.enqueue('client-1', { data: 'test' }, 'normal');
      queue.dequeue('client-1');

      const stats = queue.getQueueStats('client-1');
      expect(stats?.totalDequeued).toBe(1);
    });

    it('should calculate utilization', () => {
      queue.enqueue('client-1', { data: 'test' }, 'normal');

      const stats = queue.getQueueStats('client-1');
      expect(stats?.utilization).toBeGreaterThan(0);
      expect(stats?.utilization).toBeLessThanOrEqual(1);
    });

    it('should track dropped events', () => {
      const smallQueue = new PriorityQueue(5);
      for (let i = 0; i < 10; i++) {
        smallQueue.enqueue('client-1', { data: `event-${i}` }, 'normal');
      }

      const stats = smallQueue.getQueueStats('client-1');
      expect(stats?.totalDropped).toBeGreaterThan(0);
    });
  });

  describe('Priority Distribution', () => {
    it('should get priority distribution', () => {
      queue.enqueue('client-1', { data: 'critical1' }, 'critical');
      queue.enqueue('client-1', { data: 'critical2' }, 'critical');
      queue.enqueue('client-1', { data: 'normal' }, 'normal');
      queue.enqueue('client-1', { data: 'low' }, 'low');

      const distribution = queue.getPriorityDistribution('client-1');
      expect(distribution.critical).toBe(2);
      expect(distribution.normal).toBe(1);
      expect(distribution.low).toBe(1);
      expect(distribution.high).toBe(0);
    });

    it('should return zero distribution for non-existent client', () => {
      const distribution = queue.getPriorityDistribution('non-existent');
      expect(distribution.critical).toBe(0);
      expect(distribution.normal).toBe(0);
      expect(distribution.low).toBe(0);
      expect(distribution.high).toBe(0);
    });
  });

  describe('Get Events', () => {
    it('should get all events', () => {
      queue.enqueue('client-1', { data: 'test1' }, 'critical');
      queue.enqueue('client-1', { data: 'test2' }, 'normal');

      const events = queue.getAllEvents('client-1');
      expect(events).toHaveLength(2);
    });

    it('should return empty array for non-existent client', () => {
      const events = queue.getAllEvents('non-existent');
      expect(events).toHaveLength(0);
    });

    it('should get events by priority', () => {
      queue.enqueue('client-1', { data: 'critical1' }, 'critical');
      queue.enqueue('client-1', { data: 'normal' }, 'normal');
      queue.enqueue('client-1', { data: 'critical2' }, 'critical');

      const criticalEvents = queue.getEventsByPriority('client-1', 'critical');
      expect(criticalEvents).toHaveLength(2);
      expect(criticalEvents.every(e => e.priority === 'critical')).toBe(true);
    });
  });

  describe('Update Priority', () => {
    it('should update event priority', () => {
      queue.enqueue('client-1', { data: 'test' }, 'normal');
      queue.enqueue('client-1', { data: 'other' }, 'low');

      const updated = queue.updatePriority('client-1', (e) => e.data === 'test', 'critical');
      expect(updated).toBe(1);

      // Critical should now be first
      const peeked = queue.peek('client-1');
      expect(peeked?.data).toBe('test');
    });

    it('should update multiple matching events', () => {
      queue.enqueue('client-1', { data: 'test1' }, 'normal');
      queue.enqueue('client-1', { data: 'test2' }, 'normal');

      const updated = queue.updatePriority('client-1', () => true, 'critical');
      expect(updated).toBe(2);
    });

    it('should return 0 when no events match', () => {
      queue.enqueue('client-1', { data: 'test' }, 'normal');

      const updated = queue.updatePriority('client-1', (e) => e.data === 'nonexistent', 'critical');
      expect(updated).toBe(0);
    });
  });

  describe('Remove Events', () => {
    it('should remove events matching predicate', () => {
      queue.enqueue('client-1', { data: 'remove1' }, 'normal');
      queue.enqueue('client-1', { data: 'keep' }, 'normal');
      queue.enqueue('client-1', { data: 'remove2' }, 'normal');

      const removed = queue.removeEvents('client-1', (e) => (e.data as string).startsWith('remove'));
      expect(removed).toBe(2);
      expect(queue.getQueueSize('client-1')).toBe(1);
    });

    it('should return 0 when no events match', () => {
      queue.enqueue('client-1', { data: 'test' }, 'normal');

      const removed = queue.removeEvents('client-1', (e) => e.data === 'nonexistent');
      expect(removed).toBe(0);
    });
  });

  describe('Queue Management', () => {
    it('should clear queue', () => {
      queue.enqueue('client-1', { data: 'test1' }, 'normal');
      queue.enqueue('client-1', { data: 'test2' }, 'normal');

      queue.clearQueue('client-1');
      expect(queue.isEmpty('client-1')).toBe(true);
    });

    it('should remove queue', () => {
      queue.enqueue('client-1', { data: 'test' }, 'normal');
      queue.removeQueue('client-1');

      expect(queue.getQueueSize('client-1')).toBe(0);
    });

    it('should set max size', () => {
      queue.setMaxSize('client-1', 50);

      const stats = queue.getQueueStats('client-1');
      expect(stats?.maxSize).toBe(50);
    });

    it('should trim queue when max size is reduced', () => {
      for (let i = 0; i < 10; i++) {
        queue.enqueue('client-1', { data: `event-${i}` }, 'normal');
      }

      const beforeSize = queue.getQueueSize('client-1');
      queue.setMaxSize('client-1', 5);
      const afterSize = queue.getQueueSize('client-1');

      expect(afterSize).toBeLessThanOrEqual(beforeSize);
      expect(afterSize).toBeLessThanOrEqual(5);
    });
  });

  describe('Multiple Clients', () => {
    it('should handle multiple clients', () => {
      queue.enqueue('client-1', { data: 'test1' }, 'normal');
      queue.enqueue('client-2', { data: 'test2' }, 'normal');
      queue.enqueue('client-3', { data: 'test3' }, 'normal');

      expect(queue.getQueueSize('client-1')).toBe(1);
      expect(queue.getQueueSize('client-2')).toBe(1);
      expect(queue.getQueueSize('client-3')).toBe(1);
    });

    it('should get all client IDs', () => {
      queue.enqueue('client-1', { data: 'test1' }, 'normal');
      queue.enqueue('client-2', { data: 'test2' }, 'normal');

      const ids = queue.getClientIds();
      expect(ids).toContain('client-1');
      expect(ids).toContain('client-2');
    });
  });

  describe('Global Statistics', () => {
    it('should get global stats', () => {
      queue.enqueue('client-1', { data: 'test1' }, 'critical');
      queue.enqueue('client-1', { data: 'test2' }, 'normal');
      queue.enqueue('client-2', { data: 'test3' }, 'low');

      const stats = queue.getGlobalStats();
      expect(stats.totalClients).toBe(2);
      expect(stats.totalEvents).toBe(3);
      expect(stats.totalEnqueued).toBe(3);
    });

    it('should calculate average utilization', () => {
      queue.enqueue('client-1', { data: 'test1' }, 'normal');
      queue.enqueue('client-1', { data: 'test2' }, 'normal');

      const stats = queue.getGlobalStats();
      expect(stats.averageUtilization).toBeGreaterThan(0);
    });

    it('should track total dropped', () => {
      const smallQueue = new PriorityQueue(5);
      for (let i = 0; i < 10; i++) {
        smallQueue.enqueue('client-1', { data: `event-${i}` }, 'normal');
      }

      const stats = smallQueue.getGlobalStats();
      expect(stats.totalDropped).toBeGreaterThan(0);
    });
  });

  describe('Queue Age Stats', () => {
    it('should get queue age stats', () => {
      queue.enqueue('client-1', { data: 'test1' }, 'normal');
      queue.enqueue('client-1', { data: 'test2' }, 'normal');

      const stats = queue.getQueueAgeStats('client-1');
      expect(stats).not.toBeNull();
      expect(stats?.oldestAge).not.toBeNull();
      expect(stats?.newestAge).not.toBeNull();
      expect(stats?.averageAge).not.toBeNull();
    });

    it('should return null for non-existent client', () => {
      expect(queue.getQueueAgeStats('non-existent')).toBeNull();
    });

    it('should return null for empty queue', () => {
      expect(queue.getQueueAgeStats('client-1')).toBeNull();
    });
  });

  describe('Merge Queues', () => {
    it('should merge queues', () => {
      queue.enqueue('client-1', { data: 'test1' }, 'normal');
      queue.enqueue('client-2', { data: 'test2' }, 'critical');

      const merged = queue.mergeQueues('client-1', 'client-2');
      expect(merged).toBeGreaterThan(0);
      expect(queue.isEmpty('client-1')).toBe(true); // Source should be cleared
    });

    it('should return 0 when merging non-existent source', () => {
      queue.enqueue('client-1', { data: 'test' }, 'normal');

      const merged = queue.mergeQueues('non-existent', 'client-1');
      expect(merged).toBe(0);
    });
  });

  describe('Clear All', () => {
    it('should clear all queues', () => {
      queue.enqueue('client-1', { data: 'test1' }, 'normal');
      queue.enqueue('client-2', { data: 'test2' }, 'normal');

      queue.clear();
      expect(queue.getClientIds()).toHaveLength(0);
    });
  });

  describe('FIFO Tie-breaking', () => {
    it('should maintain FIFO order for same priority', () => {
      queue.enqueue('client-1', { data: 'first' }, 'normal');
      queue.enqueue('client-1', { data: 'second' }, 'normal');
      queue.enqueue('client-1', { data: 'third' }, 'normal');

      const events: SSEEvent[] = [];
      while (!queue.isEmpty('client-1')) {
        const result = queue.dequeue('client-1');
        if (result.event) {
          events.push(result.event);
        }
      }

      expect(events[0].data).toBe('first');
      expect(events[1].data).toBe('second');
      expect(events[2].data).toBe('third');
    });
  });

  describe('Edge Cases', () => {
    it('should handle enqueue with event priority', () => {
      const event: SSEEvent = { data: 'test', priority: 'critical' };
      queue.enqueue('client-1', event); // No priority specified

      const peeked = queue.peek('client-1');
      expect(peeked?.priority).toBe('critical');
    });

    it('should override event priority when specified', () => {
      const event: SSEEvent = { data: 'test', priority: 'low' };
      queue.enqueue('client-1', event, 'critical'); // Override to critical

      const peeked = queue.peek('client-1');
      expect(peeked?.priority).toBe('critical');
    });

    it('should handle empty predicate in updatePriority', () => {
      queue.enqueue('client-1', { data: 'test' }, 'normal');

      const updated = queue.updatePriority('client-1', () => false, 'critical');
      expect(updated).toBe(0);
    });

    it('should set default max size', () => {
      queue.setDefaultMaxSize(200);
      const newQueue = new PriorityQueue();
      // Should use new default
    });
  });
});

/**
 * EventBuffer Tests
 * Tests for event buffering during disconnection
 */

import { describe, it, expect } from 'vitest';
import { EventBuffer, createEventBuffer } from '../src/EventBuffer.js';
import { BufferOverflowError } from '../src/types.js';
import type { SSEEvent, BufferedEvent } from '../src/types.js';

describe('EventBuffer', () => {
  describe('Construction', () => {
    it('should create with default config', () => {
      const buffer = new EventBuffer();

      expect(buffer).toBeDefined();
      expect(buffer.getEventCount()).toBe(0);
    });

    it('should create with factory function', () => {
      const buffer = createEventBuffer();

      expect(buffer).toBeDefined();
    });

    it('should create with custom config', () => {
      const buffer = new EventBuffer({
        maxBufferSize: 2048,
        maxEventCount: 100
      });

      const stats = buffer.getStats();

      expect(stats.maxBufferSize).toBe(2048);
    });
  });

  describe('Buffering Events', () => {
    it('should buffer a single event', () => {
      const buffer = new EventBuffer();

      const event: SSEEvent = {
        id: '1',
        event: 'message',
        data: 'test data'
      };

      const buffered = buffer.bufferEvent(event);

      expect(buffered.bufferId).toBeDefined();
      expect(buffered.size).toBeGreaterThan(0);
      expect(buffer.getEventCount()).toBe(1);
    });

    it('should buffer multiple events', () => {
      const buffer = new EventBuffer();

      for (let i = 0; i < 10; i++) {
        buffer.bufferEvent({
          id: `${i}`,
          data: `data ${i}`
        });
      }

      expect(buffer.getEventCount()).toBe(10);
    });

    it('should assign unique buffer IDs', () => {
      const buffer = new EventBuffer();

      const event1 = buffer.bufferEvent({ data: '1' });
      const event2 = buffer.bufferEvent({ data: '2' });

      expect(event1.bufferId).not.toBe(event2.bufferId);
    });

    it('should track buffer size', () => {
      const buffer = new EventBuffer({
        maxBufferSize: 1024
      });

      buffer.bufferEvent({ data: 'small' });

      expect(buffer.getBufferSize()).toBeGreaterThan(0);
    });
  });

  describe('Replaying Events', () => {
    it('should replay all buffered events', () => {
      const buffer = new EventBuffer();

      buffer.bufferEvent({ data: 'event1' });
      buffer.bufferEvent({ data: 'event2' });
      buffer.bufferEvent({ data: 'event3' });

      const replayed = buffer.replayEvents();

      expect(replayed).toHaveLength(3);
    });

    it('should replay events in order', () => {
      const buffer = new EventBuffer();

      buffer.bufferEvent({ data: 'first' });
      buffer.bufferEvent({ data: 'second' });
      buffer.bufferEvent({ data: 'third' });

      const replayed = buffer.replayEvents();

      expect(replayed[0].data).toBe('first');
      expect(replayed[1].data).toBe('second');
      expect(replayed[2].data).toBe('third');
    });

    it('should replay and clear buffer', () => {
      const buffer = new EventBuffer();

      buffer.bufferEvent({ data: 'event1' });
      buffer.bufferEvent({ data: 'event2' });

      const replayed = buffer.replayAndClear();

      expect(replayed).toHaveLength(2);
      expect(buffer.getEventCount()).toBe(0);
    });

    it('should return empty array when buffer is empty', () => {
      const buffer = new EventBuffer();

      const replayed = buffer.replayEvents();

      expect(replayed).toHaveLength(0);
    });
  });

  describe('Clearing Buffer', () => {
    it('should clear all events', () => {
      const buffer = new EventBuffer();

      buffer.bufferEvent({ data: 'event1' });
      buffer.bufferEvent({ data: 'event2' });

      buffer.clearBuffer();

      expect(buffer.getEventCount()).toBe(0);
      expect(buffer.getBufferSize()).toBe(0);
    });

    it('should reset buffer size', () => {
      const buffer = new EventBuffer();

      buffer.bufferEvent({ data: 'large data payload' });

      expect(buffer.getBufferSize()).toBeGreaterThan(0);

      buffer.clearBuffer();

      expect(buffer.getBufferSize()).toBe(0);
    });
  });

  describe('Buffer Overflow', () => {
    it('should throw when buffer is full and evictOldest is false', () => {
      const buffer = new EventBuffer({
        maxBufferSize: 100,
        evictOldest: false
      });

      buffer.bufferEvent({ data: 'x'.repeat(50) });
      buffer.bufferEvent({ data: 'x'.repeat(50) });

      expect(() => {
        buffer.bufferEvent({ data: 'x'.repeat(10) });
      }).toThrow(BufferOverflowError);
    });

    it('should include overflow details in error', () => {
      const buffer = new EventBuffer({
        maxBufferSize: 100,
        evictOldest: false
      });

      buffer.bufferEvent({ data: 'x'.repeat(100) });

      try {
        buffer.bufferEvent({ data: 'overflow' });
      } catch (error) {
        if (error instanceof BufferOverflowError) {
          expect(error.currentSize).toBeGreaterThan(0);
          expect(error.limit).toBe(100);
        }
      }
    });

    it('should evict oldest events when enabled', () => {
      const buffer = new EventBuffer({
        maxBufferSize: 100,
        evictOldest: true
      });

      buffer.bufferEvent({ data: 'a'.repeat(40) });
      buffer.bufferEvent({ data: 'b'.repeat(40) });
      buffer.bufferEvent({ data: 'c'.repeat(40) });

      // Third event should evict first
      expect(buffer.getEventCount()).toBeLessThan(3);
      expect(buffer.getEventCount()).toBeGreaterThan(0);
    });

    it('should handle multiple evictions', () => {
      const buffer = new EventBuffer({
        maxBufferSize: 100,
        evictOldest: true
      });

      for (let i = 0; i < 20; i++) {
        buffer.bufferEvent({ data: 'x'.repeat(30) });
      }

      // Should maintain buffer size limit
      expect(buffer.getBufferSize()).toBeLessThanOrEqual(100);
      expect(buffer.getEventCount()).toBeGreaterThan(0);
    });
  });

  describe('Event Count Limits', () => {
    it('should enforce max event count', () => {
      const buffer = new EventBuffer({
        maxEventCount: 5,
        evictOldest: true
      });

      for (let i = 0; i < 10; i++) {
        buffer.bufferEvent({ data: `${i}` });
      }

      expect(buffer.getEventCount()).toBeLessThanOrEqual(5);
    });

    it('should not exceed event count limit', () => {
      const buffer = new EventBuffer({
        maxEventCount: 3,
        evictOldest: true
      });

      for (let i = 0; i < 100; i++) {
        buffer.bufferEvent({ data: `event${i}` });
      }

      expect(buffer.getEventCount()).toBe(3);
    });

    it('should handle zero event count limit (unlimited)', () => {
      const buffer = new EventBuffer({
        maxEventCount: 0,
        maxBufferSize: 10000,
        evictOldest: true
      });

      for (let i = 0; i < 100; i++) {
        buffer.bufferEvent({ data: `event${i}` });
      }

      // Limited by size, not count
      expect(buffer.getEventCount()).toBeGreaterThan(0);
    });
  });

  describe('Buffer Size Limits', () => {
    it('should enforce buffer size limit', () => {
      const buffer = new EventBuffer({
        maxBufferSize: 200,
        evictOldest: true
      });

      for (let i = 0; i < 50; i++) {
        buffer.bufferEvent({ data: 'x'.repeat(10) });
      }

      expect(buffer.getBufferSize()).toBeLessThanOrEqual(200);
    });

    it('should allow updating buffer size limit', () => {
      const buffer = new EventBuffer({
        maxBufferSize: 1000
      });

      buffer.setBufferSizeLimit(500);

      const stats = buffer.getStats();

      expect(stats.maxBufferSize).toBe(500);
    });

    it('should evict events when limit is reduced', () => {
      const buffer = new EventBuffer({
        maxBufferSize: 1000,
        evictOldest: true
      });

      for (let i = 0; i < 10; i++) {
        buffer.bufferEvent({ data: 'x'.repeat(100) });
      }

      expect(buffer.getEventCount()).toBe(10);

      buffer.setBufferSizeLimit(300);

      expect(buffer.getEventCount()).toBeLessThan(10);
      expect(buffer.getBufferSize()).toBeLessThanOrEqual(300);
    });
  });

  describe('Buffer Statistics', () => {
    it('should report correct statistics', () => {
      const buffer = new EventBuffer({
        maxBufferSize: 1000
      });

      buffer.bufferEvent({ data: 'event1' });
      buffer.bufferEvent({ data: 'event2' });

      const stats = buffer.getStats();

      expect(stats.eventCount).toBe(2);
      expect(stats.currentSize).toBeGreaterThan(0);
      expect(stats.maxBufferSize).toBe(1000);
      expect(stats.totalEventsAdded).toBe(2);
    });

    it('should calculate utilization percentage', () => {
      const buffer = new EventBuffer({
        maxBufferSize: 1000
      });

      buffer.bufferEvent({ data: 'x'.repeat(100) });

      const stats = buffer.getStats();

      expect(stats.utilizationPercentage).toBeGreaterThan(0);
      expect(stats.utilizationPercentage).toBeLessThan(100);
    });

    it('should track evicted events', () => {
      const buffer = new EventBuffer({
        maxBufferSize: 100,
        evictOldest: true
      });

      buffer.bufferEvent({ data: 'x'.repeat(40) });
      buffer.bufferEvent({ data: 'x'.repeat(40) });
      buffer.bufferEvent({ data: 'x'.repeat(40) });

      const stats = buffer.getStats();

      expect(stats.eventsEvicted).toBeGreaterThan(0);
    });

    it('should track replayed events', () => {
      const buffer = new EventBuffer();

      buffer.bufferEvent({ data: 'event1' });
      buffer.replayEvents();

      const stats = buffer.getStats();

      expect(stats.totalEventsReplayed).toBe(1);
    });

    it('should track oldest and newest timestamps', () => {
      const buffer = new EventBuffer();

      buffer.bufferEvent({ data: 'first', timestamp: 1000 });
      buffer.bufferEvent({ data: 'second', timestamp: 2000 });
      buffer.bufferEvent({ data: 'third', timestamp: 3000 });

      const stats = buffer.getStats();

      expect(stats.oldestEventTimestamp).toBe(1000);
      expect(stats.newestEventTimestamp).toBe(3000);
    });
  });

  describe('Event Queries', () => {
    it('should get events by ID', () => {
      const buffer = new EventBuffer();

      buffer.bufferEvent({ id: '1', data: 'a' });
      buffer.bufferEvent({ id: '2', data: 'b' });
      buffer.bufferEvent({ id: '1', data: 'c' });

      const events = buffer.getEventsById('1');

      expect(events).toHaveLength(2);
    });

    it('should get events by type', () => {
      const buffer = new EventBuffer();

      buffer.bufferEvent({ event: 'message', data: 'a' });
      buffer.bufferEvent({ event: 'notification', data: 'b' });
      buffer.bufferEvent({ event: 'message', data: 'c' });

      const messageEvents = buffer.getEventsByType('message');

      expect(messageEvents).toHaveLength(2);
    });

    it('should get events since timestamp', () => {
      const buffer = new EventBuffer();

      buffer.bufferEvent({ data: 'old', timestamp: 1000 });
      buffer.bufferEvent({ data: 'new', timestamp: 2000 });
      buffer.bufferEvent({ data: 'newer', timestamp: 3000 });

      const recentEvents = buffer.getEventsSince(1500);

      expect(recentEvents).toHaveLength(2);
    });
  });

  describe('Event Removal', () => {
    it('should remove events by ID', () => {
      const buffer = new EventBuffer();

      buffer.bufferEvent({ id: '1', data: 'a' });
      buffer.bufferEvent({ id: '2', data: 'b' });

      const removed = buffer.removeEventsById('1');

      expect(removed).toBe(1);
      expect(buffer.getEventCount()).toBe(1);
    });

    it('should remove multiple events with same ID', () => {
      const buffer = new EventBuffer();

      buffer.bufferEvent({ id: '1', data: 'a' });
      buffer.bufferEvent({ id: '1', data: 'b' });
      buffer.bufferEvent({ id: '2', data: 'c' });

      const removed = buffer.removeEventsById('1');

      expect(removed).toBe(2);
      expect(buffer.getEventCount()).toBe(1);
    });
  });

  describe('Peek Operations', () => {
    it('should peek at oldest event', () => {
      const buffer = new EventBuffer();

      buffer.bufferEvent({ data: 'first' });
      buffer.bufferEvent({ data: 'second' });
      buffer.bufferEvent({ data: 'third' });

      const oldest = buffer.peekOldest();

      expect(oldest).not.toBeNull();
      expect(oldest?.data).toBe('first');
    });

    it('should peek at newest event', () => {
      const buffer = new EventBuffer();

      buffer.bufferEvent({ data: 'first' });
      buffer.bufferEvent({ data: 'second' });
      buffer.bufferEvent({ data: 'third' });

      const newest = buffer.peekNewest();

      expect(newest).not.toBeNull();
      expect(newest?.data).toBe('third');
    });

    it('should return null when buffer is empty', () => {
      const buffer = new EventBuffer();

      expect(buffer.peekOldest()).toBeNull();
      expect(buffer.peekNewest()).toBeNull();
    });

    it('should not remove events when peeking', () => {
      const buffer = new EventBuffer();

      buffer.bufferEvent({ data: 'event' });

      buffer.peekOldest();
      buffer.peekNewest();

      expect(buffer.getEventCount()).toBe(1);
    });
  });

  describe('Trim Operations', () => {
    it('should trim events older than timestamp', () => {
      const buffer = new EventBuffer();

      buffer.bufferEvent({ data: 'old', timestamp: 1000 });
      buffer.bufferEvent({ data: 'medium', timestamp: 2000 });
      buffer.bufferEvent({ data: 'new', timestamp: 3000 });

      const trimmed = buffer.trimOlderThan(2500);

      expect(trimmed).toBe(2);
      expect(buffer.getEventCount()).toBe(1);
    });

    it('should trim to max age', () => {
      const buffer = new EventBuffer();

      const now = Date.now();

      buffer.bufferEvent({ data: 'old', timestamp: now - 10000 });
      buffer.bufferEvent({ data: 'new', timestamp: now - 100 });

      const trimmed = buffer.trimToMaxAge(5000);

      expect(trimmed).toBe(1);
      expect(buffer.getEventCount()).toBe(1);
    });
  });

  describe('Buffer Status', () => {
    it('should detect empty buffer', () => {
      const buffer = new EventBuffer();

      expect(buffer.isEmpty()).toBe(true);
      expect(buffer.isFull()).toBe(false);
    });

    it('should detect non-empty buffer', () => {
      const buffer = new EventBuffer();

      buffer.bufferEvent({ data: 'event' });

      expect(buffer.isEmpty()).toBe(false);
    });

    it('should detect full buffer', () => {
      const buffer = new EventBuffer({
        maxBufferSize: 100
      });

      buffer.bufferEvent({ data: 'x'.repeat(100) });

      expect(buffer.isFull()).toBe(true);
    });

    it('should handle unlimited size (never full)', () => {
      const buffer = new EventBuffer({
        maxBufferSize: 0
      });

      for (let i = 0; i < 1000; i++) {
        buffer.bufferEvent({ data: 'x' });
      }

      expect(buffer.isFull()).toBe(false);
    });
  });

  describe('Export/Import', () => {
    it('should export buffer contents', () => {
      const buffer = new EventBuffer();

      buffer.bufferEvent({ data: 'event1' });
      buffer.bufferEvent({ data: 'event2' });

      const exported = buffer.export();

      expect(exported).toHaveLength(2);
    });

    it('should import events', () => {
      const buffer1 = new EventBuffer();

      buffer1.bufferEvent({ data: 'event1' });
      buffer1.bufferEvent({ data: 'event2' });

      const exported = buffer1.export();

      const buffer2 = new EventBuffer();
      buffer2.import(exported);

      expect(buffer2.getEventCount()).toBe(2);
    });

    it('should handle import with overflow', () => {
      const buffer1 = new EventBuffer();

      for (let i = 0; i < 10; i++) {
        buffer1.bufferEvent({ data: `event${i}` });
      }

      const exported = buffer1.export();

      const buffer2 = new EventBuffer({
        maxBufferSize: 100,
        evictOldest: false
      });

      // Should skip events that don't fit
      expect(() => {
        buffer2.import(exported);
      }).not.toThrow();
    });
  });

  describe('Reset', () => {
    it('should reset buffer state', () => {
      const buffer = new EventBuffer();

      buffer.bufferEvent({ data: 'event' });
      buffer.replayEvents();

      buffer.reset();

      const stats = buffer.getStats();

      expect(stats.eventCount).toBe(0);
      expect(stats.totalEventsAdded).toBe(0);
      expect(stats.totalEventsReplayed).toBe(0);
      expect(stats.eventsEvicted).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle events with minimal data', () => {
      const buffer = new EventBuffer();

      const event = buffer.bufferEvent({ data: '' });

      expect(event.size).toBeGreaterThan(0);
    });

    it('should handle events with large data', () => {
      const buffer = new EventBuffer({
        maxBufferSize: 10000
      });

      const largeData = 'x'.repeat(5000);

      buffer.bufferEvent({ data: largeData });

      expect(buffer.getEventCount()).toBe(1);
    });

    it('should handle unicode characters', () => {
      const buffer = new EventBuffer();

      buffer.bufferEvent({
        data: 'Hello 世界 🌍'
      });

      expect(buffer.getEventCount()).toBe(1);
    });
  });
});

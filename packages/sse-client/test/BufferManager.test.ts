/**
 * BufferManager Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BufferManager } from '../src/BufferManager.js';
import type { SSEMessage } from '../src/types.js';

describe('BufferManager', () => {
  let bufferManager: BufferManager;
  let mockMessage: SSEMessage;

  beforeEach(() => {
    bufferManager = new BufferManager({
      maxSize: 10,
      enabled: true
    });
    mockMessage = {
      id: '1',
      event: 'test',
      data: 'test data',
      origin: 'https://example.com',
      timestamp: Date.now()
    };
  });

  describe('add', () => {
    it('should add message to buffer', () => {
      expect(bufferManager.size).toBe(0);
      bufferManager.add(mockMessage, 'normal');
      expect(bufferManager.size).toBe(1);
    });

    it('should return true when added', () => {
      const result = bufferManager.add(mockMessage, 'normal');
      expect(result).toBe(true);
    });

    it('should return false when disabled', () => {
      bufferManager.setEnabled(false);
      const result = bufferManager.add(mockMessage, 'normal');
      expect(result).toBe(false);
    });

    it('should maintain priority order', () => {
      bufferManager.add(mockMessage, 'normal');
      bufferManager.add({ ...mockMessage, id: '2' }, 'critical');
      bufferManager.add({ ...mockMessage, id: '3' }, 'normal');
      const all = bufferManager.getAll();
      expect(all[0].priority).toBe('critical');
      expect(all[1].priority).toBe('normal');
      expect(all[2].priority).toBe('normal');
    });

    it('should evict oldest normal when full', () => {
      for (let i = 0; i < 15; i++) {
        bufferManager.add({ ...mockMessage, id: i.toString() }, 'normal');
      }
      expect(bufferManager.size).toBe(10);
    });

    it('should prefer evicting normal over critical', () => {
      // Fill with critical
      for (let i = 0; i < 5; i++) {
        bufferManager.add({ ...mockMessage, id: `c${i}` }, 'critical');
      }
      // Fill with normal
      for (let i = 0; i < 5; i++) {
        bufferManager.add({ ...mockMessage, id: `n${i}` }, 'normal');
      }
      // Add one more - should evict oldest normal
      bufferManager.add({ ...mockMessage, id: 'new' }, 'normal');
      const all = bufferManager.getAll();
      expect(all.length).toBe(10);
      // Should still have all critical
      const criticalCount = all.filter(m => m.priority === 'critical').length;
      expect(criticalCount).toBe(5);
    });

    it('should set timestamp', () => {
      const beforeTime = Date.now();
      bufferManager.add(mockMessage, 'normal');
      const afterTime = Date.now();
      const buffered = bufferManager.peekOldest();
      expect(buffered?.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(buffered?.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('getAll', () => {
    it('should return empty array initially', () => {
      const all = bufferManager.getAll();
      expect(all).toEqual([]);
    });

    it('should return all buffered messages', () => {
      bufferManager.add(mockMessage, 'normal');
      bufferManager.add({ ...mockMessage, id: '2' }, 'critical');
      const all = bufferManager.getAll();
      expect(all).toHaveLength(2);
    });

    it('should return copy not reference', () => {
      bufferManager.add(mockMessage, 'normal');
      const all1 = bufferManager.getAll();
      const all2 = bufferManager.getAll();
      expect(all1).not.toBe(all2);
    });
  });

  describe('getByPriority', () => {
    it('should filter by critical priority', () => {
      bufferManager.add(mockMessage, 'normal');
      bufferManager.add({ ...mockMessage, id: '2' }, 'critical');
      bufferManager.add({ ...mockMessage, id: '3' }, 'normal');
      const critical = bufferManager.getByPriority('critical');
      expect(critical).toHaveLength(1);
      expect(critical[0].priority).toBe('critical');
    });

    it('should filter by normal priority', () => {
      bufferManager.add(mockMessage, 'critical');
      bufferManager.add({ ...mockMessage, id: '2' }, 'normal');
      bufferManager.add({ ...mockMessage, id: '3' }, 'normal');
      const normal = bufferManager.getByPriority('normal');
      expect(normal).toHaveLength(2);
      normal.forEach(m => expect(m.priority).toBe('normal'));
    });
  });

  describe('clear', () => {
    it('should clear all messages', () => {
      bufferManager.add(mockMessage, 'normal');
      bufferManager.add({ ...mockMessage, id: '2' }, 'normal');
      expect(bufferManager.size).toBe(2);
      bufferManager.clear();
      expect(bufferManager.size).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return empty stats', () => {
      const stats = bufferManager.getStats();
      expect(stats.size).toBe(0);
      expect(stats.criticalCount).toBe(0);
      expect(stats.normalCount).toBe(0);
      expect(stats.oldestTimestamp).toBeNull();
      expect(stats.newestTimestamp).toBeNull();
    });

    it('should return stats with messages', () => {
      bufferManager.add(mockMessage, 'critical');
      bufferManager.add({ ...mockMessage, id: '2' }, 'normal');
      bufferManager.add({ ...mockMessage, id: '3' }, 'normal');
      const stats = bufferManager.getStats();
      expect(stats.size).toBe(3);
      expect(stats.criticalCount).toBe(1);
      expect(stats.normalCount).toBe(2);
      expect(stats.oldestTimestamp).toBeTruthy();
      expect(stats.newestTimestamp).toBeTruthy();
    });
  });

  describe('size', () => {
    it('should return 0 initially', () => {
      expect(bufferManager.size).toBe(0);
    });

    it('should increment with each add', () => {
      bufferManager.add(mockMessage, 'normal');
      expect(bufferManager.size).toBe(1);
      bufferManager.add({ ...mockMessage, id: '2' }, 'normal');
      expect(bufferManager.size).toBe(2);
    });
  });

  describe('isEmpty', () => {
    it('should return true initially', () => {
      expect(bufferManager.isEmpty()).toBe(true);
    });

    it('should return false with messages', () => {
      bufferManager.add(mockMessage, 'normal');
      expect(bufferManager.isEmpty()).toBe(false);
    });

    it('should return true after clear', () => {
      bufferManager.add(mockMessage, 'normal');
      bufferManager.clear();
      expect(bufferManager.isEmpty()).toBe(true);
    });
  });

  describe('isFull', () => {
    it('should return false when empty', () => {
      expect(bufferManager.isFull()).toBe(false);
    });

    it('should return false when not full', () => {
      bufferManager.add(mockMessage, 'normal');
      expect(bufferManager.isFull()).toBe(false);
    });

    it('should return true when at capacity', () => {
      for (let i = 0; i < 10; i++) {
        bufferManager.add({ ...mockMessage, id: i.toString() }, 'normal');
      }
      expect(bufferManager.isFull()).toBe(true);
    });
  });

  describe('removeOlderThan', () => {
    it('should remove messages older than timestamp', () => {
      const now = Date.now();
      bufferManager.add({ ...mockMessage, timestamp: now - 5000 }, 'normal');
      bufferManager.add({ ...mockMessage, timestamp: now - 3000 }, 'normal');
      bufferManager.add({ ...mockMessage, timestamp: now - 1000 }, 'normal');
      expect(bufferManager.size).toBe(3);
      const removed = bufferManager.removeOlderThan(now - 2000);
      expect(removed).toBe(2);
      expect(bufferManager.size).toBe(1);
    });
  });

  describe('removeNewerThan', () => {
    it('should remove messages newer than timestamp', () => {
      const now = Date.now();
      bufferManager.add({ ...mockMessage, timestamp: now - 3000 }, 'normal');
      bufferManager.add({ ...mockMessage, timestamp: now - 2000 }, 'normal');
      bufferManager.add({ ...mockMessage, timestamp: now - 1000 }, 'normal');
      const removed = bufferManager.removeNewerThan(now - 2500);
      expect(removed).toBe(2);
      expect(bufferManager.size).toBe(1);
    });
  });

  describe('getCapacity', () => {
    it('should return 0 when empty', () => {
      expect(bufferManager.getCapacity()).toBe(0);
    });

    it('should return percentage of capacity', () => {
      for (let i = 0; i < 5; i++) {
        bufferManager.add({ ...mockMessage, id: i.toString() }, 'normal');
      }
      expect(bufferManager.getCapacity()).toBe(50);
    });

    it('should return 100 when full', () => {
      for (let i = 0; i < 10; i++) {
        bufferManager.add({ ...mockMessage, id: i.toString() }, 'normal');
      }
      expect(bufferManager.getCapacity()).toBe(100);
    });
  });

  describe('setEnabled', () => {
    it('should disable buffering', () => {
      bufferManager.setEnabled(false);
      const result = bufferManager.add(mockMessage, 'normal');
      expect(result).toBe(false);
      expect(bufferManager.size).toBe(0);
    });

    it('should clear buffer when disabled', () => {
      bufferManager.add(mockMessage, 'normal');
      bufferManager.setEnabled(false);
      expect(bufferManager.size).toBe(0);
    });
  });

  describe('setMaxSize', () => {
    it('should update max size', () => {
      bufferManager.setMaxSize(5);
      for (let i = 0; i < 10; i++) {
        bufferManager.add({ ...mockMessage, id: i.toString() }, 'normal');
      }
      expect(bufferManager.size).toBe(5);
    });

    it('should trim existing buffer', () => {
      for (let i = 0; i < 10; i++) {
        bufferManager.add({ ...mockMessage, id: i.toString() }, 'normal');
      }
      expect(bufferManager.size).toBe(10);
      bufferManager.setMaxSize(5);
      expect(bufferManager.size).toBe(5);
    });
  });

  describe('peekOldest', () => {
    it('should return oldest message', () => {
      bufferManager.add({ ...mockMessage, id: '1', timestamp: 1000 }, 'normal');
      bufferManager.add({ ...mockMessage, id: '2', timestamp: 2000 }, 'normal');
      bufferManager.add({ ...mockMessage, id: '3', timestamp: 3000 }, 'normal');
      const oldest = bufferManager.peekOldest();
      expect(oldest?.message.id).toBe('1');
      expect(bufferManager.size).toBe(3); // Not removed
    });

    it('should return null when empty', () => {
      expect(bufferManager.peekOldest()).toBeNull();
    });
  });

  describe('peekNewest', () => {
    it('should return newest message', () => {
      bufferManager.add({ ...mockMessage, id: '1', timestamp: 1000 }, 'normal');
      bufferManager.add({ ...mockMessage, id: '2', timestamp: 2000 }, 'normal');
      bufferManager.add({ ...mockMessage, id: '3', timestamp: 3000 }, 'normal');
      const newest = bufferManager.peekNewest();
      expect(newest?.message.id).toBe('3');
      expect(bufferManager.size).toBe(3); // Not removed
    });

    it('should return null when empty', () => {
      expect(bufferManager.peekNewest()).toBeNull();
    });
  });

  describe('dequeueOldest', () => {
    it('should remove and return oldest', () => {
      bufferManager.add({ ...mockMessage, id: '1' }, 'normal');
      bufferManager.add({ ...mockMessage, id: '2' }, 'normal');
      const oldest = bufferManager.dequeueOldest();
      expect(oldest?.message.id).toBe('1');
      expect(bufferManager.size).toBe(1);
    });

    it('should return null when empty', () => {
      expect(bufferManager.dequeueOldest()).toBeNull();
    });
  });

  describe('dequeueNewest', () => {
    it('should remove and return newest', () => {
      bufferManager.add({ ...mockMessage, id: '1' }, 'normal');
      bufferManager.add({ ...mockMessage, id: '2' }, 'normal');
      const newest = bufferManager.dequeueNewest();
      expect(newest?.message.id).toBe('2');
      expect(bufferManager.size).toBe(1);
    });

    it('should return null when empty', () => {
      expect(bufferManager.dequeueNewest()).toBeNull();
    });
  });

  describe('filter', () => {
    it('should filter by predicate', () => {
      bufferManager.add({ ...mockMessage, id: '1', data: 'apple' }, 'normal');
      bufferManager.add({ ...mockMessage, id: '2', data: 'banana' }, 'normal');
      bufferManager.add({ ...mockMessage, id: '3', data: 'cherry' }, 'normal');
      const filtered = bufferManager.filter(m => m.data.includes('a'));
      expect(filtered).toHaveLength(2);
    });
  });

  describe('find', () => {
    it('should find first matching message', () => {
      bufferManager.add({ ...mockMessage, id: '1', data: 'apple' }, 'normal');
      bufferManager.add({ ...mockMessage, id: '2', data: 'banana' }, 'normal');
      const found = bufferManager.find(m => m.data === 'banana');
      expect(found?.message.id).toBe('2');
    });

    it('should return null if not found', () => {
      bufferManager.add({ ...mockMessage, id: '1', data: 'apple' }, 'normal');
      const found = bufferManager.find(m => m.data === 'orange');
      expect(found).toBeNull();
    });
  });

  describe('getInTimeRange', () => {
    it('should get messages in range', () => {
      const now = Date.now();
      bufferManager.add({ ...mockMessage, id: '1', timestamp: now - 5000 }, 'normal');
      bufferManager.add({ ...mockMessage, id: '2', timestamp: now - 3000 }, 'normal');
      bufferManager.add({ ...mockMessage, id: '3', timestamp: now - 1000 }, 'normal');
      const inRange = bufferManager.getInTimeRange(now - 4000, now - 2000);
      expect(inRange).toHaveLength(1);
      expect(inRange[0].message.id).toBe('2');
    });
  });

  describe('getAge', () => {
    it('should return null when empty', () => {
      expect(bufferManager.getAge()).toBeNull();
    });

    it('should return age of oldest message', () => {
      const now = Date.now();
      bufferManager.add({ ...mockMessage, timestamp: now - 5000 }, 'normal');
      const age = bufferManager.getAge();
      expect(age).toBeGreaterThanOrEqual(5000);
      expect(age).toBeLessThan(6000);
    });
  });

  describe('trim', () => {
    it('should trim to size', () => {
      for (let i = 0; i < 10; i++) {
        bufferManager.add({ ...mockMessage, id: i.toString() }, 'normal');
      }
      const removed = bufferManager.trim(5);
      expect(removed).toBe(5);
      expect(bufferManager.size).toBe(5);
    });
  });

  describe('clone', () => {
    it('should clone buffer', () => {
      bufferManager.add(mockMessage, 'critical');
      const clone = bufferManager.clone();
      expect(clone).toHaveLength(1);
      expect(clone).not.toBe(bufferManager.getAll());
    });
  });

  describe('toJSON', () => {
    it('should serialize to JSON', () => {
      bufferManager.add(mockMessage, 'critical');
      const json = bufferManager.toJSON();
      expect(json).toHaveProperty('size');
      expect(json).toHaveProperty('maxSize');
      expect(json).toHaveProperty('enabled');
      expect(json).toHaveProperty('messages');
    });
  });

  describe('reset', () => {
    it('should reset state', () => {
      bufferManager.add(mockMessage, 'normal');
      bufferManager.setEnabled(false);
      bufferManager.reset();
      expect(bufferManager.size).toBe(0);
      expect(bufferManager.isEnabled()).toBe(true);
    });
  });
});

/**
 * PriorityQueue Tests
 *
 * Tests for priority queue functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PriorityQueue } from '../src/PriorityQueue.js';
import type { QueuedRequest, Priority } from '../src/types.js';

describe('PriorityQueue', () => {
  let queue: PriorityQueue;

  beforeEach(() => {
    queue = new PriorityQueue(100, 60000);
  });

  describe('enqueue', () => {
    it('should enqueue a request', () => {
      const request = createMockRequest('req-1', 'normal', 1);
      const result = queue.enqueue(request);

      expect(result).toBe(true);
      expect(queue.getTotalDepth()).toBe(1);
    });

    it('should reject when queue is full', () => {
      const smallQueue = new PriorityQueue(2, 60000);

      expect(smallQueue.enqueue(createMockRequest('req-1', 'normal', 1))).toBe(true);
      expect(smallQueue.enqueue(createMockRequest('req-2', 'normal', 1))).toBe(true);
      expect(smallQueue.enqueue(createMockRequest('req-3', 'normal', 1))).toBe(false);
    });

    it('should maintain separate queues per priority', () => {
      queue.enqueue(createMockRequest('req-1', 'critical', 1));
      queue.enqueue(createMockRequest('req-2', 'high', 1));
      queue.enqueue(createMockRequest('req-3', 'normal', 1));
      queue.enqueue(createMockRequest('req-4', 'low', 1));

      expect(queue.getDepth('critical')).toBe(1);
      expect(queue.getDepth('high')).toBe(1);
      expect(queue.getDepth('normal')).toBe(1);
      expect(queue.getDepth('low')).toBe(1);
    });
  });

  describe('dequeue', () => {
    it('should dequeue highest priority request first', () => {
      queue.enqueue(createMockRequest('req-1', 'low', 1));
      queue.enqueue(createMockRequest('req-2', 'critical', 1));
      queue.enqueue(createMockRequest('req-3', 'normal', 1));
      queue.enqueue(createMockRequest('req-4', 'high', 1));

      const request1 = queue.dequeue();
      const request2 = queue.dequeue();
      const request3 = queue.dequeue();
      const request4 = queue.dequeue();

      expect(request1?.priority).toBe('critical');
      expect(request2?.priority).toBe('high');
      expect(request3?.priority).toBe('normal');
      expect(request4?.priority).toBe('low');
    });

    it('should return null when queue is empty', () => {
      const request = queue.dequeue();
      expect(request).toBeNull();
    });

    it('should maintain FIFO within priority level', () => {
      queue.enqueue(createMockRequest('req-1', 'normal', 1));
      queue.enqueue(createMockRequest('req-2', 'normal', 1));
      queue.enqueue(createMockRequest('req-3', 'normal', 1));

      expect(queue.dequeue()?.requestId).toBe('req-1');
      expect(queue.dequeue()?.requestId).toBe('req-2');
      expect(queue.dequeue()?.requestId).toBe('req-3');
    });
  });

  describe('dequeueFromPriority', () => {
    it('should dequeue from specific priority', () => {
      queue.enqueue(createMockRequest('req-1', 'normal', 1));
      queue.enqueue(createMockRequest('req-2', 'high', 1));
      queue.enqueue(createMockRequest('req-3', 'normal', 1));

      const request = queue.dequeueFromPriority('normal');

      expect(request?.priority).toBe('normal');
      expect(queue.getDepth('normal')).toBe(1);
      expect(queue.getDepth('high')).toBe(1);
    });

    it('should return null when priority queue is empty', () => {
      const request = queue.dequeueFromPriority('critical');
      expect(request).toBeNull();
    });
  });

  describe('getTotalDepth', () => {
    it('should return total depth across all priorities', () => {
      queue.enqueue(createMockRequest('req-1', 'critical', 1));
      queue.enqueue(createMockRequest('req-2', 'high', 1));
      queue.enqueue(createMockRequest('req-3', 'normal', 1));

      expect(queue.getTotalDepth()).toBe(3);
    });

    it('should return zero when empty', () => {
      expect(queue.getTotalDepth()).toBe(0);
    });
  });

  describe('getDepth', () => {
    it('should return depth for specific priority', () => {
      queue.enqueue(createMockRequest('req-1', 'normal', 1));
      queue.enqueue(createMockRequest('req-2', 'normal', 1));
      queue.enqueue(createMockRequest('req-3', 'high', 1));

      expect(queue.getDepth('normal')).toBe(2);
      expect(queue.getDepth('high')).toBe(1);
      expect(queue.getDepth('critical')).toBe(0);
    });
  });

  describe('getAllDepths', () => {
    it('should return depths for all priorities', () => {
      queue.enqueue(createMockRequest('req-1', 'critical', 1));
      queue.enqueue(createMockRequest('req-2', 'high', 1));
      queue.enqueue(createMockRequest('req-3', 'high', 1));
      queue.enqueue(createMockRequest('req-4', 'normal', 1));

      const depths = queue.getAllDepths();

      expect(depths.critical).toBe(1);
      expect(depths.high).toBe(2);
      expect(depths.normal).toBe(1);
      expect(depths.low).toBe(0);
    });
  });

  describe('remove', () => {
    it('should remove request by ID', () => {
      queue.enqueue(createMockRequest('req-1', 'normal', 1));
      queue.enqueue(createMockRequest('req-2', 'normal', 1));

      const removed = queue.remove('req-1');

      expect(removed).toBe(true);
      expect(queue.getTotalDepth()).toBe(1);
      expect(queue.dequeue()?.requestId).toBe('req-2');
    });

    it('should return false for non-existent request', () => {
      const removed = queue.remove('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all requests', () => {
      queue.enqueue(createMockRequest('req-1', 'normal', 1));
      queue.enqueue(createMockRequest('req-2', 'high', 1));
      queue.enqueue(createMockRequest('req-3', 'critical', 1));

      const count = queue.clear();

      expect(count).toBe(3);
      expect(queue.getTotalDepth()).toBe(0);
    });
  });

  describe('peek', () => {
    it('should return next request without removing', () => {
      queue.enqueue(createMockRequest('req-1', 'normal', 1));
      queue.enqueue(createMockRequest('req-2', 'critical', 1));

      const peeked = queue.peek();

      expect(peeked?.requestId).toBe('req-2');
      expect(queue.getTotalDepth()).toBe(2);
    });

    it('should return null when empty', () => {
      const peeked = queue.peek();
      expect(peeked).toBeNull();
    });
  });

  describe('getAllRequests', () => {
    it('should return all queued requests', () => {
      queue.enqueue(createMockRequest('req-1', 'normal', 1));
      queue.enqueue(createMockRequest('req-2', 'high', 1));
      queue.enqueue(createMockRequest('req-3', 'normal', 1));

      const requests = queue.getAllRequests();

      expect(requests).toHaveLength(3);
      expect(requests.some(r => r.requestId === 'req-1')).toBe(true);
      expect(requests.some(r => r.requestId === 'req-2')).toBe(true);
      expect(requests.some(r => r.requestId === 'req-3')).toBe(true);
    });
  });

  describe('getExpiredRequests', () => {
    it('should identify expired requests', () => {
      const shortQueue = new PriorityQueue(100, 100);

      shortQueue.enqueue(createMockRequest('req-1', 'normal', 1));

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      const expired = shortQueue.getExpiredRequests();

      expect(expired).toHaveLength(1);
      expect(expired[0].requestId).toBe('req-1');
    });
  });

  describe('cleanExpiredRequests', () => {
    it('should clean and reject expired requests', async () => {
      const shortQueue = new PriorityQueue(100, 100);
      const rejectSpy = vi.fn();

      shortQueue.enqueue({
        ...createMockRequest('req-1', 'normal', 1),
        reject: rejectSpy
      });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      const cleaned = shortQueue.cleanExpiredRequests();

      expect(cleaned).toBe(1);
      expect(rejectSpy).toHaveBeenCalledTimes(1);
      expect(shortQueue.getTotalDepth()).toBe(0);
    });
  });

  describe('setMaxDepth', () => {
    it('should update max depth', () => {
      queue.setMaxDepth(5);

      for (let i = 0; i < 5; i++) {
        expect(queue.enqueue(createMockRequest(`req-${i}`, 'normal', 1))).toBe(true);
      }

      expect(queue.enqueue(createMockRequest('req-6', 'normal', 1))).toBe(false);
    });
  });

  describe('setMaxWaitTime', () => {
    it('should update max wait time', () => {
      queue.setMaxWaitTime(30000);
      // Would need to test expiration with new time
    });
  });

  describe('getStats', () => {
    it('should return queue statistics', () => {
      queue.enqueue(createMockRequest('req-1', 'normal', 1));
      queue.enqueue(createMockRequest('req-2', 'high', 1));

      const stats = queue.getStats();

      expect(stats.totalDepth).toBe(2);
      expect(stats.depths.normal).toBe(1);
      expect(stats.depths.high).toBe(1);
      expect(stats.totalEnqueued).toBeGreaterThanOrEqual(2);
      expect(stats.maxDepth).toBe(100);
      expect(stats.maxWaitTime).toBe(60000);
      expect(stats.oldestRequestAge).toBeGreaterThanOrEqual(0);
    });
  });

  describe('createRequest', () => {
    it('should create request with defaults', () => {
      const request = PriorityQueue.createRequest(1, 'normal');

      expect(request.priority).toBe('normal');
      expect(request.workerCount).toBe(1);
      expect(request.timeout).toBe(60000);
      expect(request.requestId).toMatch(/^req-/);
    });

    it('should create request with custom timeout', () => {
      const request = PriorityQueue.createRequest(2, 'high', 30000);

      expect(request.workerCount).toBe(2);
      expect(request.timeout).toBe(30000);
    });
  });
});

/**
 * Helper to create mock queued request
 */
function createMockRequest(
  requestId: string,
  priority: Priority,
  workerCount: number
): QueuedRequest {
  return {
    requestId,
    priority,
    queuedAt: Date.now(),
    resolve: () => {},
    reject: () => {},
    workerCount,
    timeout: 60000
  };
}

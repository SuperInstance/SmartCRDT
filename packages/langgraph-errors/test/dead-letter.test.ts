/**
 * @file dead-letter.test.ts - Tests for dead letter queue
 * @package @lsi/langgraph-errors
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DeadLetterQueue } from '../src/dead-letter.js';
import type { DeadLetterEntry, AgentError } from '../src/types.js';

describe('DeadLetterQueue', () => {
  let queue: DeadLetterQueue;
  let mockError: AgentError;

  beforeEach(() => {
    queue = new DeadLetterQueue(10);
    mockError = {
      error_id: 'err_test',
      agent_id: 'test-agent',
      severity: 'error',
      category: 'execution',
      message: 'Test error',
      context: {},
      timestamp: Date.now(),
     
      retry_count: 0,
    };
  });

  describe('add', () => {
    it('should add entry to queue', () => {
      const task = { data: 'test' };
      const id = queue.add(task, mockError);

      expect(id).toBeDefined();
      expect(queue.getAll()).toHaveLength(1);
    });

    it('should enforce max size', () => {
      const smallQueue = new DeadLetterQueue(3);

      for (let i = 0; i < 5; i++) {
        smallQueue.add({ data: i }, mockError);
      }

      expect(smallQueue.getAll()).toHaveLength(3);
    });

    it('should remove oldest entry when full', () => {
      const smallQueue = new DeadLetterQueue(2);

      const id1 = smallQueue.add({ data: 1 }, mockError);
      const id2 = smallQueue.add({ data: 2 }, mockError);
      const id3 = smallQueue.add({ data: 3 }, mockError);

      expect(smallQueue.getAll()).toHaveLength(2);
      expect(smallQueue.get(id1)).toBeUndefined();
      expect(smallQueue.get(id2)).toBeDefined();
      expect(smallQueue.get(id3)).toBeDefined();
    });
  });

  describe('get', () => {
    it('should get entry by ID', () => {
      const task = { data: 'test' };
      const id = queue.add(task, mockError);

      const entry = queue.get(id);

      expect(entry).toBeDefined();
      expect(entry?.task).toEqual(task);
    });

    it('should return undefined for non-existent ID', () => {
      const entry = queue.get('non-existent');

      expect(entry).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return all entries', () => {
      queue.add({ data: 1 }, mockError);
      queue.add({ data: 2 }, mockError);
      queue.add({ data: 3 }, mockError);

      const all = queue.getAll();

      expect(all).toHaveLength(3);
    });

    it('should return empty array when queue is empty', () => {
      const all = queue.getAll();

      expect(all).toEqual([]);
    });
  });

  describe('getByAgent', () => {
    it('should filter entries by agent ID', () => {
      const error1 = { ...mockError, agent_id: 'agent-1' };
      const error2 = { ...mockError, agent_id: 'agent-2' };
      const error3 = { ...mockError, agent_id: 'agent-1' };

      queue.add({ data: 1 }, error1);
      queue.add({ data: 2 }, error2);
      queue.add({ data: 3 }, error3);

      const agent1Entries = queue.getByAgent('agent-1');
      const agent2Entries = queue.getByAgent('agent-2');

      expect(agent1Entries).toHaveLength(2);
      expect(agent2Entries).toHaveLength(1);
    });

    it('should return empty array for agent with no entries', () => {
      const entries = queue.getByAgent('non-existent');

      expect(entries).toEqual([]);
    });
  });

  describe('getByCategory', () => {
    it('should filter entries by category', () => {
      const error1 = { ...mockError, category: 'timeout' as const };
      const error2 = { ...mockError, category: 'network' as const };
      const error3 = { ...mockError, category: 'timeout' as const };

      queue.add({ data: 1 }, error1);
      queue.add({ data: 2 }, error2);
      queue.add({ data: 3 }, error3);

      const timeoutEntries = queue.getByCategory('timeout');
      const networkEntries = queue.getByCategory('network');

      expect(timeoutEntries).toHaveLength(2);
      expect(networkEntries).toHaveLength(1);
    });
  });

  describe('getByTimeRange', () => {
    it('should filter entries by time range', () => {
      const now = Date.now();

      queue.add({ data: 1 }, { ...mockError, timestamp: now - 5000 });
      queue.add({ data: 2 }, { ...mockError, timestamp: now - 3000 });
      queue.add({ data: 3 }, { ...mockError, timestamp: now - 1000 });

      const entries = queue.getByTimeRange(now - 4000, now);

      expect(entries).toHaveLength(2);
    });
  });

  describe('retry', () => {
    it('should retry entry successfully', async () => {
      const task = { data: 'test' };
      const id = queue.add(task, mockError);

      const retryFn = vi.fn().mockResolvedValue('success');
      const result = await queue.retry(id, retryFn);

      expect(result.success).toBe(true);
      expect(retryFn).toHaveBeenCalledWith(task);
      expect(queue.get(id)).toBeUndefined();
    });

    it('should not retry if max retries exceeded', async () => {
      const task = { data: 'test' };
      const id = queue.add(task, mockError, 1);

      // First retry fails
      const retryFn = vi.fn().mockRejectedValue(new Error('fail'));
      await queue.retry(id, retryFn);

      // Second attempt should not retry
      const result = await queue.retry(id, retryFn);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should archive entry after max retries', async () => {
      const task = { data: 'test' };
      const id = queue.add(task, mockError, 1);

      const retryFn = vi.fn().mockRejectedValue(new Error('fail'));
      await queue.retry(id, retryFn);

      expect(queue.get(id)).toBeUndefined();
      expect(queue.getArchived()).toHaveLength(1);
    });
  });

  describe('retryAll', () => {
    it('should retry all entries', async () => {
      queue.add({ data: 1 }, mockError);
      queue.add({ data: 2 }, mockError);
      queue.add({ data: 3 }, mockError);

      const retryFn = vi.fn().mockResolvedValue('success');
      const result = await queue.retryAll(retryFn);

      expect(result.total).toBe(3);
      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
      expect(queue.getAll()).toHaveLength(0);
    });

    it('should handle partial failures', async () => {
      queue.add({ data: 1 }, mockError);
      queue.add({ data: 2 }, mockError);
      queue.add({ data: 3 }, mockError);

      const retryFn = vi.fn()
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');

      const result = await queue.retryAll(retryFn);

      expect(result.total).toBe(3);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);
    });
  });

  describe('archive', () => {
    it('should archive entry', () => {
      const id = queue.add({ data: 'test' }, mockError);

      queue.archive(id);

      expect(queue.get(id)).toBeUndefined();
      expect(queue.getArchived()).toHaveLength(1);
      expect(queue.getArchived()[0].id).toBe(id);
      expect(queue.getArchived()[0].archived).toBe(true);
    });
  });

  describe('remove', () => {
    it('should remove entry from queue', () => {
      const id = queue.add({ data: 'test' }, mockError);

      const removed = queue.remove(id);

      expect(removed).toBe(true);
      expect(queue.get(id)).toBeUndefined();
    });

    it('should return false for non-existent entry', () => {
      const removed = queue.remove('non-existent');

      expect(removed).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      queue.add({ data: 1 }, mockError);
      queue.add({ data: 2 }, mockError);
      queue.add({ data: 3 }, mockError);

      queue.clear();

      expect(queue.getAll()).toHaveLength(0);
    });
  });

  describe('clearArchived', () => {
    it('should clear archived entries', () => {
      const id = queue.add({ data: 'test' }, mockError);
      queue.archive(id);

      queue.clearArchived();

      expect(queue.getArchived()).toHaveLength(0);
    });
  });

  describe('getStatistics', () => {
    it('should return queue statistics', () => {
      queue.add({ data: 1 }, mockError);
      queue.add({ data: 2 }, mockError);

      const stats = queue.getStatistics();

      expect(stats.queueSize).toBe(2);
      expect(stats.archivedSize).toBe(0);
      expect(stats.maxSize).toBe(10);
      expect(stats.byAgent).toEqual({ 'test-agent': 2 });
    });
  });

  describe('setMaxSize', () => {
    it('should set max size and trim queue', () => {
      for (let i = 0; i < 5; i++) {
        queue.add({ data: i }, mockError);
      }

      queue.setMaxSize(2);

      expect(queue.getAll()).toHaveLength(2);
    });
  });

  describe('export/import', () => {
    it('should export and import entries', () => {
      queue.add({ data: 1 }, mockError);
      queue.add({ data: 2 }, mockError);

      const exported = queue.export();
      const newQueue = new DeadLetterQueue();
      newQueue.import(exported);

      expect(newQueue.getAll()).toHaveLength(2);
    });
  });

  describe('createReport', () => {
    it('should create text report', () => {
      queue.add({ data: 1 }, mockError);
      queue.add({ data: 2 }, mockError);

      const report = queue.createReport();

      expect(report).toContain('Dead Letter Queue Report');
      expect(report).toContain('Queue Size: 2');
      expect(report).toContain('test-agent');
    });
  });
});

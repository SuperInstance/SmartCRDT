/**
 * ChunkScheduler Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChunkScheduler } from '../src/ChunkScheduler.js';
import type { ProgressiveChunk, RenderStrategy } from '../src/types.js';

describe('ChunkScheduler', () => {
  let scheduler: ChunkScheduler;

  beforeEach(() => {
    scheduler = new ChunkScheduler();
  });

  afterEach(() => {
    scheduler.clear();
  });

  describe('Scheduling', () => {
    it('should schedule a chunk', () => {
      const chunk: ProgressiveChunk = {
        chunk_id: 'test-chunk',
        phase: 'content',
        content: { type: 'text', data: 'Test' },
        priority: 50,
        created_at: new Date(),
        updated_at: new Date(),
        critical: false,
        component_id: 'test-component',
        metadata: { source: 'agent', strategy: 'streaming' }
      };

      const scheduled = scheduler.schedule(chunk);

      expect(scheduled.chunk).toEqual(chunk);
      expect(scheduled.priority_score).toBeGreaterThan(0);
      expect(scheduled.scheduled_at).toBeDefined();
      expect(scheduled.expected_render_time).toBeDefined();
    });

    it('should schedule multiple chunks', () => {
      const chunks: ProgressiveChunk[] = [
        {
          chunk_id: 'chunk-1',
          phase: 'content',
          content: { type: 'text', data: 'Test 1' },
          priority: 30,
          created_at: new Date(),
          updated_at: new Date(),
          critical: false,
          component_id: 'test-component',
          metadata: { source: 'agent', strategy: 'streaming' }
        },
        {
          chunk_id: 'chunk-2',
          phase: 'content',
          content: { type: 'text', data: 'Test 2' },
          priority: 70,
          created_at: new Date(),
          updated_at: new Date(),
          critical: false,
          component_id: 'test-component',
          metadata: { source: 'agent', strategy: 'streaming' }
        }
      ];

      const scheduled = scheduler.scheduleBatch(chunks);

      expect(scheduled).toHaveLength(2);
      expect(scheduled[1].priority_score).toBeGreaterThan(scheduled[0].priority_score);
    });
  });

  describe('Chunk Retrieval', () => {
    it('should get next chunk from queue', () => {
      const chunk: ProgressiveChunk = {
        chunk_id: 'test-chunk',
        phase: 'content',
        content: { type: 'text', data: 'Test' },
        priority: 50,
        created_at: new Date(),
        updated_at: new Date(),
        critical: false,
        component_id: 'test-component',
        metadata: { source: 'agent', strategy: 'streaming' }
      };

      scheduler.schedule(chunk);

      const next = scheduler.getNext();

      expect(next).toEqual(chunk);
    });

    it('should return null when queue is empty', () => {
      const next = scheduler.getNext();
      expect(next).toBeNull();
    });

    it('should respect concurrent limit', () => {
      const options = { max_concurrent: 2 };
      const limitedScheduler = new ChunkScheduler(options);

      const chunks: ProgressiveChunk[] = [
        {
          chunk_id: 'chunk-1',
          phase: 'content',
          content: { type: 'text', data: 'Test 1' },
          priority: 50,
          created_at: new Date(),
          updated_at: new Date(),
          critical: false,
          component_id: 'test-component',
          metadata: { source: 'agent', strategy: 'streaming' }
        },
        {
          chunk_id: 'chunk-2',
          phase: 'content',
          content: { type: 'text', data: 'Test 2' },
          priority: 50,
          created_at: new Date(),
          updated_at: new Date(),
          critical: false,
          component_id: 'test-component',
          metadata: { source: 'agent', strategy: 'streaming' }
        },
        {
          chunk_id: 'chunk-3',
          phase: 'content',
          content: { type: 'text', data: 'Test 3' },
          priority: 50,
          created_at: new Date(),
          updated_at: new Date(),
          critical: false,
          component_id: 'test-component',
          metadata: { source: 'agent', strategy: 'streaming' }
        }
      ];

      chunks.forEach(c => limitedScheduler.schedule(c));

      const chunk1 = limitedScheduler.getNext();
      const chunk2 = limitedScheduler.getNext();
      const chunk3 = limitedScheduler.getNext(); // Should be null due to limit

      expect(chunk1).toBeDefined();
      expect(chunk2).toBeDefined();
      expect(chunk3).toBeNull();
    });
  });

  describe('Chunk Completion', () => {
    it('should mark chunk as completed', () => {
      const chunk: ProgressiveChunk = {
        chunk_id: 'test-chunk',
        phase: 'content',
        content: { type: 'text', data: 'Test' },
        priority: 50,
        created_at: new Date(),
        updated_at: new Date(),
        critical: false,
        component_id: 'test-component',
        metadata: { source: 'agent', strategy: 'streaming' }
      };

      scheduler.schedule(chunk);
      scheduler.getNext();
      scheduler.complete('test-chunk');

      expect(scheduler.isCompleted('test-chunk')).toBe(true);
      expect(scheduler.isRendering('test-chunk')).toBe(false);
    });
  });

  describe('Priority Calculation', () => {
    it('should give higher priority to critical chunks', () => {
      const criticalChunk: ProgressiveChunk = {
        chunk_id: 'critical',
        phase: 'content',
        content: { type: 'text', data: 'Critical' },
        priority: 50,
        created_at: new Date(),
        updated_at: new Date(),
        critical: true,
        component_id: 'test-component',
        metadata: { source: 'agent', strategy: 'streaming' }
      };

      const normalChunk: ProgressiveChunk = {
        chunk_id: 'normal',
        phase: 'content',
        content: { type: 'text', data: 'Normal' },
        priority: 50,
        created_at: new Date(),
        updated_at: new Date(),
        critical: false,
        component_id: 'test-component',
        metadata: { source: 'agent', strategy: 'streaming' }
      };

      const criticalScheduled = scheduler.schedule(criticalChunk);
      const normalScheduled = scheduler.schedule(normalChunk);

      expect(criticalScheduled.priority_score).toBeGreaterThan(normalScheduled.priority_score);
    });

    it('should prioritize skeleton phase', () => {
      const skeletonChunk: ProgressiveChunk = {
        chunk_id: 'skeleton',
        phase: 'skeleton',
        content: { type: 'skeleton', data: { type: 'rect' } },
        priority: 30,
        created_at: new Date(),
        updated_at: new Date(),
        critical: false,
        component_id: 'test-component',
        metadata: { source: 'generated', strategy: 'critical-first' }
      };

      const contentChunk: ProgressiveChunk = {
        chunk_id: 'content',
        phase: 'content',
        content: { type: 'text', data: 'Content' },
        priority: 30,
        created_at: new Date(),
        updated_at: new Date(),
        critical: false,
        component_id: 'test-component',
        metadata: { source: 'agent', strategy: 'streaming' }
      };

      const skeletonScheduled = scheduler.schedule(skeletonChunk);
      const contentScheduled = scheduler.schedule(contentChunk);

      expect(skeletonScheduled.priority_score).toBeGreaterThan(contentScheduled.priority_score);
    });
  });

  describe('Critical Path', () => {
    it('should identify critical path chunks', () => {
      const chunks: ProgressiveChunk[] = [
        {
          chunk_id: 'chunk-1',
          phase: 'skeleton',
          content: { type: 'skeleton', data: { type: 'rect' } },
          priority: 50,
          created_at: new Date(),
          updated_at: new Date(),
          critical: true,
          component_id: 'test-component',
          metadata: { source: 'generated', strategy: 'critical-first' }
        },
        {
          chunk_id: 'chunk-2',
          phase: 'content',
          content: { type: 'text', data: 'Content' },
          priority: 50,
          created_at: new Date(),
          updated_at: new Date(),
          critical: false,
          component_id: 'test-component',
          metadata: { source: 'agent', strategy: 'streaming' }
        }
      ];

      const critical = scheduler.getCriticalPath(chunks);
      const lazy = scheduler.getLazyChunks(chunks);

      expect(critical).toHaveLength(1);
      expect(critical[0].chunk_id).toBe('chunk-1');
      expect(lazy).toHaveLength(1);
      expect(lazy[0].chunk_id).toBe('chunk-2');
    });
  });

  describe('Predictive Pre-rendering', () => {
    it('should predict next chunks', () => {
      const parentChunk: ProgressiveChunk = {
        chunk_id: 'parent',
        phase: 'content',
        content: { type: 'component', data: {} as any },
        priority: 50,
        created_at: new Date(),
        updated_at: new Date(),
        critical: false,
        component_id: 'test-component',
        child_ids: ['child-1', 'child-2'],
        metadata: { source: 'agent', strategy: 'streaming' }
      };

      const allChunks: ProgressiveChunk[] = [
        parentChunk,
        {
          chunk_id: 'child-1',
          phase: 'content',
          content: { type: 'text', data: 'Child 1' },
          priority: 40,
          created_at: new Date(),
          updated_at: new Date(),
          critical: false,
          component_id: 'test-component',
          metadata: { source: 'agent', strategy: 'streaming' }
        },
        {
          chunk_id: 'child-2',
          phase: 'content',
          content: { type: 'text', data: 'Child 2' },
          priority: 40,
          created_at: new Date(),
          updated_at: new Date(),
          critical: false,
          component_id: 'test-component',
          metadata: { source: 'agent', strategy: 'streaming' }
        }
      ];

      const predictions = scheduler.predictNextChunks(parentChunk, allChunks);

      expect(predictions.length).toBeGreaterThan(0);
      expect(predictions.some(p => p.chunk_id === 'child-1' || p.chunk_id === 'child-2')).toBe(true);
    });

    it('should cache predictive chunks', () => {
      const chunk: ProgressiveChunk = {
        chunk_id: 'predictive',
        phase: 'content',
        content: { type: 'text', data: 'Predictive' },
        priority: 50,
        created_at: new Date(),
        updated_at: new Date(),
        critical: false,
        component_id: 'test-component',
        metadata: { source: 'agent', strategy: 'streaming' }
      };

      scheduler.cachePredictive(chunk);

      const cached = scheduler.getCached('predictive');

      expect(cached).toEqual(chunk);
    });

    it('should clear predictive cache', () => {
      const chunk: ProgressiveChunk = {
        chunk_id: 'predictive',
        phase: 'content',
        content: { type: 'text', data: 'Predictive' },
        priority: 50,
        created_at: new Date(),
        updated_at: new Date(),
        critical: false,
        component_id: 'test-component',
        metadata: { source: 'agent', strategy: 'streaming' }
      };

      scheduler.cachePredictive(chunk);
      scheduler.clearPredictiveCache();

      const cached = scheduler.getCached('predictive');

      expect(cached).toBeNull();
    });
  });

  describe('Queue Management', () => {
    it('should provide queue statistics', () => {
      const chunk: ProgressiveChunk = {
        chunk_id: 'test-chunk',
        phase: 'content',
        content: { type: 'text', data: 'Test' },
        priority: 50,
        created_at: new Date(),
        updated_at: new Date(),
        critical: false,
        component_id: 'test-component',
        metadata: { source: 'agent', strategy: 'streaming' }
      };

      scheduler.schedule(chunk);

      const stats = scheduler.getStats();

      expect(stats.queued).toBe(1);
      expect(stats.scheduled).toBe(1);
      expect(stats.rendering).toBe(0);
      expect(stats.completed).toBe(0);
    });

    it('should check if queue is empty', () => {
      expect(scheduler.isEmpty()).toBe(true);

      const chunk: ProgressiveChunk = {
        chunk_id: 'test-chunk',
        phase: 'content',
        content: { type: 'text', data: 'Test' },
        priority: 50,
        created_at: new Date(),
        updated_at: new Date(),
        critical: false,
        component_id: 'test-component',
        metadata: { source: 'agent', strategy: 'streaming' }
      };

      scheduler.schedule(chunk);
      expect(scheduler.isEmpty()).toBe(false);
    });

    it('should clear all state', () => {
      const chunk: ProgressiveChunk = {
        chunk_id: 'test-chunk',
        phase: 'content',
        content: { type: 'text', data: 'Test' },
        priority: 50,
        created_at: new Date(),
        updated_at: new Date(),
        critical: false,
        component_id: 'test-component',
        metadata: { source: 'agent', strategy: 'streaming' }
      };

      scheduler.schedule(chunk);
      scheduler.clear();

      expect(scheduler.isEmpty()).toBe(true);
      expect(scheduler.getStats().cache_size).toBe(0);
    });
  });

  describe('Bandwidth Estimation', () => {
    it('should record bandwidth samples', () => {
      scheduler.recordBandwidth(1024 * 1024, 1000); // 1MB in 1 second = 1 MBps

      const bandwidth = scheduler.getBandwidth();

      expect(bandwidth).toBe(1024 * 1024);
    });

    it('should estimate render time based on bandwidth', () => {
      scheduler.recordBandwidth(1024 * 1024, 1000); // 1 MBps

      const chunk: ProgressiveChunk = {
        chunk_id: 'test-chunk',
        phase: 'content',
        content: { type: 'text', data: 'x'.repeat(512 * 1024) }, // 512KB
        priority: 50,
        size_bytes: 512 * 1024,
        created_at: new Date(),
        updated_at: new Date(),
        critical: false,
        component_id: 'test-component',
        metadata: { source: 'agent', strategy: 'streaming' }
      };

      const scheduled = scheduler.schedule(chunk);

      // Transfer time (512KB at 1MBps) + base render time
      const expectedTime = scheduled.expected_render_time.getTime() - scheduled.scheduled_at.getTime();

      expect(expectedTime).toBeGreaterThan(500); // At least 500ms
      expect(expectedTime).toBeLessThan(1000); // Less than 1 second
    });
  });

  describe('Render Strategies', () => {
    const strategies: RenderStrategy[] = ['top-down', 'critical-first', 'lazy', 'streaming'];

    it.each(strategies)('should support %s strategy', (strategy) => {
      const strategyScheduler = new ChunkScheduler({ strategy });

      const chunk: ProgressiveChunk = {
        chunk_id: 'test-chunk',
        phase: 'content',
        content: { type: 'text', data: 'Test' },
        priority: 50,
        created_at: new Date(),
        updated_at: new Date(),
        critical: false,
        component_id: 'test-component',
        metadata: { source: 'agent', strategy }
      };

      const scheduled = strategyScheduler.schedule(chunk);

      expect(scheduled).toBeDefined();
    });
  });
});

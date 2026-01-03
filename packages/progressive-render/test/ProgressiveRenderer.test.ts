/**
 * ProgressiveRenderer Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProgressiveRenderer } from '../src/ProgressiveRenderer.js';
import type { ProgressiveChunk, RenderStrategy, RenderPhase } from '../src/types.js';

describe('ProgressiveRenderer', () => {
  let renderer: ProgressiveRenderer;

  beforeEach(() => {
    renderer = new ProgressiveRenderer();
  });

  afterEach(() => {
    renderer.destroy();
  });

  describe('Stream Management', () => {
    it('should start a new render stream', () => {
      const streamId = renderer.startStream('test-component', 'critical-first');
      expect(streamId).toBeDefined();
      expect(streamId).toContain('test-component');
    });

    it('should create render stats on stream start', () => {
      renderer.startStream('test-component');
      const stats = renderer.getRenderStats('test-component');
      expect(stats).toBeDefined();
      expect(stats?.component_id).toBe('test-component');
      expect(stats?.current_phase).toBe('skeleton');
      expect(stats?.progress).toBe(0);
    });

    it('should complete a render stream', () => {
      renderer.startStream('test-component');
      renderer.completeStream('test-component');

      const stats = renderer.getRenderStats('test-component');
      expect(stats?.end_time).toBeDefined();
      expect(stats?.current_phase).toBe('complete');
      expect(stats?.progress).toBe(100);
    });

    it('should abort a render stream', () => {
      renderer.startStream('test-component');
      renderer.abortStream('test-component', 'Test abort');

      const stats = renderer.getRenderStats('test-component');
      expect(stats?.end_time).toBeDefined();
    });

    it('should handle multiple concurrent streams', () => {
      const stream1 = renderer.startStream('component-1');
      const stream2 = renderer.startStream('component-2');
      const stream3 = renderer.startStream('component-3');

      expect(stream1).not.toBe(stream2);
      expect(stream2).not.toBe(stream3);
      expect(stream3).not.toBe(stream1);
    });
  });

  describe('Chunk Management', () => {
    it('should send chunk successfully', () => {
      renderer.startStream('test-component');

      const chunk: ProgressiveChunk = {
        chunk_id: 'test-chunk-1',
        phase: 'content',
        content: { type: 'text', data: 'Test content' },
        priority: 50,
        created_at: new Date(),
        updated_at: new Date(),
        critical: false,
        component_id: 'test-component',
        metadata: { source: 'agent', strategy: 'streaming' }
      };

      const sent = renderer.sendChunk(chunk);
      expect(sent).toBe(true);

      const retrieved = renderer.getChunk('test-chunk-1');
      expect(retrieved).toEqual(chunk);
    });

    it('should update existing chunk', () => {
      renderer.startStream('test-component');

      const chunk: ProgressiveChunk = {
        chunk_id: 'test-chunk-1',
        phase: 'skeleton',
        content: { type: 'skeleton', data: { type: 'rect' } },
        priority: 50,
        created_at: new Date(),
        updated_at: new Date(),
        critical: false,
        component_id: 'test-component',
        metadata: { source: 'agent', strategy: 'streaming' }
      };

      renderer.sendChunk(chunk);

      const updated = renderer.updateChunk('test-chunk-1', {
        phase: 'content',
        content: { type: 'text', data: 'Updated content' }
      });

      expect(updated).toBe(true);

      const retrieved = renderer.getChunk('test-chunk-1');
      expect(retrieved?.phase).toBe('content');
    });

    it('should get chunks for component', () => {
      renderer.startStream('test-component');

      const chunk1: ProgressiveChunk = {
        chunk_id: 'chunk-1',
        phase: 'skeleton',
        content: { type: 'skeleton', data: { type: 'rect' } },
        priority: 100,
        created_at: new Date(),
        updated_at: new Date(),
        critical: true,
        component_id: 'test-component',
        metadata: { source: 'generated', strategy: 'critical-first' }
      };

      const chunk2: ProgressiveChunk = {
        chunk_id: 'chunk-2',
        phase: 'content',
        content: { type: 'text', data: 'Content' },
        priority: 50,
        created_at: new Date(),
        updated_at: new Date(),
        critical: false,
        component_id: 'test-component',
        metadata: { source: 'agent', strategy: 'streaming' }
      };

      renderer.sendChunk(chunk1);
      renderer.sendChunk(chunk2);

      const chunks = renderer.getChunksForComponent('test-component');
      expect(chunks).toHaveLength(2);
      expect(chunks[0].priority).toBeGreaterThan(chunks[1].priority); // Sorted by priority
    });
  });

  describe('Phase Management', () => {
    it('should advance render phase', () => {
      renderer.startStream('test-component');

      renderer.advancePhase('test-component', 'content');

      const stats = renderer.getRenderStats('test-component');
      expect(stats?.current_phase).toBe('content');
      expect(stats?.phases_completed).toContain('content');
    });

    it('should calculate TTI when reaching interactive phase', () => {
      renderer.startStream('test-component');

      // Simulate some time passing
      vi.advanceTimersByTime(500);

      renderer.advancePhase('test-component', 'interactive');

      const stats = renderer.getRenderStats('test-component');
      expect(stats?.tti).toBeGreaterThan(0);
    });

    it('should not allow phase regression', () => {
      renderer.startStream('test-component');
      renderer.advancePhase('test-component', 'content');

      renderer.advancePhase('test-component', 'skeleton');

      const stats = renderer.getRenderStats('test-component');
      expect(stats?.current_phase).toBe('content'); // Should not regress
    });
  });

  describe('Flow Control', () => {
    it('should pause streaming', () => {
      renderer.pause();

      const state = renderer.getFlowControlState();
      expect(state.paused).toBe(true);
    });

    it('should resume streaming', () => {
      renderer.pause();
      renderer.resume();

      const state = renderer.getFlowControlState();
      expect(state.paused).toBe(false);
    });

    it('should apply backpressure when buffer is full', () => {
      renderer.startStream('test-component');

      // Create large chunk to trigger backpressure
      const largeChunk: ProgressiveChunk = {
        chunk_id: 'large-chunk',
        phase: 'content',
        content: { type: 'text', data: 'x'.repeat(2 * 1024 * 1024) }, // 2MB
        priority: 50,
        size_bytes: 2 * 1024 * 1024,
        created_at: new Date(),
        updated_at: new Date(),
        critical: false,
        component_id: 'test-component',
        metadata: { source: 'agent', strategy: 'streaming' }
      };

      renderer.sendChunk(largeChunk);

      const state = renderer.getFlowControlState();
      expect(state.backpressure).toBeGreaterThan(0);
    });
  });

  describe('Event Handling', () => {
    it('should emit stream:start event', () => {
      const handler = vi.fn();
      renderer.on('stream:start', handler);

      renderer.startStream('test-component');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          componentId: 'test-component',
          strategy: 'critical-first'
        })
      );
    });

    it('should emit chunk:send event', () => {
      const handler = vi.fn();
      renderer.on('chunk:send', handler);

      renderer.startStream('test-component');

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

      renderer.sendChunk(chunk);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          chunk: expect.objectContaining({ chunk_id: 'test-chunk' })
        })
      );
    });

    it('should unregister event handler', () => {
      const handler = vi.fn();
      renderer.on('stream:start', handler);
      renderer.off('stream:start', handler);

      renderer.startStream('test-component');

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Skeleton Creation', () => {
    it('should create skeleton chunk', () => {
      renderer.startStream('test-component');

      const skeleton = renderer.createSkeletonChunk('test-component', {
        type: 'text',
        lines: 3,
        animation: 'shimmer'
      });

      expect(skeleton.chunk_id).toContain('skeleton-');
      expect(skeleton.phase).toBe('skeleton');
      expect(skeleton.content.type).toBe('skeleton');
      expect(skeleton.critical).toBe(true);
      expect(skeleton.priority).toBe(100);
    });

    it('should create content chunk', () => {
      renderer.startStream('test-component');

      const content = renderer.createContentChunk('test-component', {
        type: 'text',
        data: 'Test content'
      }, 75);

      expect(content.chunk_id).toContain('chunk-');
      expect(content.phase).toBe('content');
      expect(content.content.type).toBe('text');
      expect(content.priority).toBe(75);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup old streams', () => {
      renderer.startStream('old-component');
      vi.advanceTimersByTime(6 * 60 * 1000); // 6 minutes

      renderer.cleanup(5 * 60 * 1000); // 5 minute max age

      const stats = renderer.getRenderStats('old-component');
      expect(stats).toBeNull();
    });

    it('should destroy renderer and cleanup resources', () => {
      renderer.startStream('component-1');
      renderer.startStream('component-2');

      renderer.destroy();

      const stats1 = renderer.getRenderStats('component-1');
      const stats2 = renderer.getRenderStats('component-2');

      expect(stats1).toBeNull();
      expect(stats2).toBeNull();
    });
  });

  describe('Render Strategies', () => {
    const strategies: RenderStrategy[] = ['top-down', 'critical-first', 'lazy', 'streaming'];

    it.each(strategies)('should support %s strategy', (strategy) => {
      const streamId = renderer.startStream('test-component', strategy);

      expect(streamId).toBeDefined();

      const stats = renderer.getRenderStats('test-component');
      expect(stats?.strategy).toBe(strategy);
    });
  });
});

// Type export for vi
declare const vi: any;

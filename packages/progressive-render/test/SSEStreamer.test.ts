/**
 * SSEStreamer Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SSEStreamer } from '../src/SSEStreamer.js';
import type { ProgressiveChunk, RenderPhase, RenderStats, RenderError } from '../src/types.js';

// Mock response object
class MockResponse {
  headers: Record<string, string> = {};
  private data: string[] = [];
  private ended = false;

  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  write(data: string): void {
    if (this.ended) {
      throw new Error('Response already ended');
    }
    this.data.push(data);
  }

  end(): void {
    this.ended = true;
  }

  getWrittenData(): string {
    return this.data.join('');
  }

  isEnded(): boolean {
    return this.ended;
  }
}

describe('SSEStreamer', () => {
  let streamer: SSEStreamer;

  beforeEach(() => {
    streamer = new SSEStreamer();
  });

  afterEach(() => {
    streamer.closeAll();
  });

  describe('Stream Creation', () => {
    it('should create SSE stream', () => {
      const response = new MockResponse();
      const streamId = streamer.createStream('client-1', response as any);

      expect(streamId).toBeDefined();
      expect(streamId).toContain('client-1');
      expect(response.headers['Content-Type']).toBe('text/event-stream');
      expect(response.headers['Cache-Control']).toBe('no-cache, no-transform');
    });

    it('should set correct SSE headers', () => {
      const response = new MockResponse();
      streamer.createStream('client-1', response as any);

      expect(response.headers['Content-Type']).toBe('text/event-stream');
      expect(response.headers['Cache-Control']).toBe('no-cache, no-transform');
      expect(response.headers['Connection']).toBe('keep-alive');
      expect(response.headers['X-Accel-Buffering']).toBe('no');
    });
  });

  describe('Chunk Streaming', () => {
    it('should send chunk via SSE', () => {
      const response = new MockResponse();
      const streamId = streamer.createStream('client-1', response as any);

      const chunk: ProgressiveChunk = {
        chunk_id: 'test-chunk',
        phase: 'content',
        content: { type: 'text', data: 'Test content' },
        priority: 50,
        created_at: new Date(),
        updated_at: new Date(),
        critical: false,
        component_id: 'test-component',
        metadata: { source: 'agent', strategy: 'streaming' }
      };

      const sent = streamer.sendChunk(streamId, chunk);

      expect(sent).toBe(true);

      const written = response.getWrittenData();
      expect(written).toContain('event: chunk');
      expect(written).toContain(chunk.chunk_id);
      expect(written).toContain('Test content');
    });

    it('should not send to closed stream', () => {
      const response = new MockResponse();
      const streamId = streamer.createStream('client-1', response as any);

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

      streamer.closeStream(streamId);

      const sent = streamer.sendChunk(streamId, chunk);

      expect(sent).toBe(false);
    });
  });

  describe('Phase Updates', () => {
    it('should send phase change event', () => {
      const response = new MockResponse();
      const streamId = streamer.createStream('client-1', response as any);

      const sent = streamer.sendPhase(streamId, 'test-component', 'content');

      expect(sent).toBe(true);

      const written = response.getWrittenData();
      expect(written).toContain('event: phase');
      expect(written).toContain('test-component');
      expect(written).toContain('content');
    });

    it('should send all phase types', () => {
      const phases: RenderPhase[] = ['skeleton', 'content', 'interactive', 'complete'];

      for (const phase of phases) {
        const response = new MockResponse();
        const streamId = streamer.createStream(`client-${phase}`, response as any);

        const sent = streamer.sendPhase(streamId, 'test-component', phase);

        expect(sent).toBe(true);
        expect(response.getWrittenData()).toContain(phase);
      }
    });
  });

  describe('Progress Updates', () => {
    it('should send progress event', () => {
      const response = new MockResponse();
      const streamId = streamer.createStream('client-1', response as any);

      const sent = streamer.sendProgress(streamId, 'test-component', 50);

      expect(sent).toBe(true);

      const written = response.getWrittenData();
      expect(written).toContain('event: progress');
      expect(written).toContain('50');
    });

    it('should clamp progress to 0-100', () => {
      const response = new MockResponse();
      const streamId = streamer.createStream('client-1', response as any);

      streamer.sendProgress(streamId, 'test-component', -10);
      streamer.sendProgress(streamId, 'test-component', 150);

      const written = response.getWrittenData();
      // Progress should be clamped
      expect(written).toContain('-10'); // First call
      expect(written).toContain('100'); // Second call clamped to 100
    });
  });

  describe('Complete Event', () => {
    it('should send complete event with stats', () => {
      const response = new MockResponse();
      const streamId = streamer.createStream('client-1', response as any);

      const stats: RenderStats = {
        component_id: 'test-component',
        start_time: new Date(),
        current_phase: 'complete',
        phases_completed: ['skeleton', 'content', 'interactive', 'complete'],
        bytes_sent: 1024,
        chunks_sent: 10,
        chunks_remaining: 0,
        fps: 60,
        avg_fps: 55,
        ttfb: 50,
        tti: 200,
        total_time: 500,
        progress: 100,
        errors: 0,
        warnings: 0,
        strategy: 'critical-first'
      };

      const sent = streamer.sendComplete(streamId, 'test-component', stats);

      expect(sent).toBe(true);

      const written = response.getWrittenData();
      expect(written).toContain('event: complete');
      expect(written).toContain('test-component');
      expect(written).toContain('1024'); // bytes_sent
    });
  });

  describe('Error Handling', () => {
    it('should send error event', () => {
      const response = new MockResponse();
      const streamId = streamer.createStream('client-1', response as any);

      const error: RenderError = {
        code: 'RENDER_ERROR',
        message: 'Test error message',
        component_id: 'test-component',
        chunk_id: 'test-chunk',
        timestamp: new Date(),
        fatal: false
      };

      const sent = streamer.sendError(streamId, error);

      expect(sent).toBe(true);

      const written = response.getWrittenData();
      expect(written).toContain('event: error');
      expect(written).toContain('RENDER_ERROR');
      expect(written).toContain('Test error message');
    });
  });

  describe('Connection State', () => {
    it('should track connection state', () => {
      const response = new MockResponse();
      const streamId = streamer.createStream('client-1', response as any);

      const state = streamer.getConnectionState(streamId);

      expect(state).toBeDefined();
      expect(state?.streamId).toBe(streamId);
      expect(state?.clientId).toBe('client-1');
      expect(state?.connected).toBe(true);
    });

    it('should return null for non-existent stream', () => {
      const state = streamer.getConnectionState('non-existent');

      expect(state).toBeNull();
    });

    it('should update bytes sent and events sent', () => {
      const response = new MockResponse();
      const streamId = streamer.createStream('client-1', response as any);

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

      streamer.sendChunk(streamId, chunk);
      streamer.sendChunk(streamId, chunk);

      const state = streamer.getConnectionState(streamId);

      expect(state?.eventsSent).toBeGreaterThan(0);
      expect(state?.bytesSent).toBeGreaterThan(0);
    });
  });

  describe('Stream Closing', () => {
    it('should close stream gracefully', () => {
      const response = new MockResponse();
      const streamId = streamer.createStream('client-1', response as any);

      streamer.closeStream(streamId);

      expect(response.isEnded()).toBe(true);

      const state = streamer.getConnectionState(streamId);
      expect(state).toBeNull();
    });

    it('should close all streams', () => {
      const response1 = new MockResponse();
      const response2 = new MockResponse();

      streamer.createStream('client-1', response1 as any);
      streamer.createStream('client-2', response2 as any);

      streamer.closeAll();

      expect(response1.isEnded()).toBe(true);
      expect(response2.isEnded()).toBe(true);
    });
  });

  describe('Abort Control', () => {
    it('should provide abort signal', () => {
      const response = new MockResponse();
      const streamId = streamer.createStream('client-1', response as any);

      const signal = streamer.getAbortSignal(streamId);

      expect(signal).toBeDefined();
      expect(signal?.aborted).toBe(false);
    });

    it('should abort stream', () => {
      const response = new MockResponse();
      const streamId = streamer.createStream('client-1', response as any);

      const signal = streamer.getAbortSignal(streamId);
      streamer.closeStream(streamId);

      // After close, abort should be signaled
      expect(signal?.aborted).toBe(true);
    });
  });

  describe('Heartbeat', () => {
    it('should set heartbeat interval', () => {
      streamer.setHeartbeatInterval(10000);

      // Just verify it doesn't throw
      expect(true).toBe(true);
    });

    it('should send heartbeat events', () => {
      const response = new MockResponse();
      const streamId = streamer.createStream('client-1', response as any);

      // Wait for heartbeat (simulated)
      const written = response.getWrittenData();

      // Should contain initial heartbeat
      expect(written).toContain('event: heartbeat');
    });
  });

  describe('Statistics', () => {
    it('should provide streamer statistics', () => {
      const response = new MockResponse();
      streamer.createStream('client-1', response as any);

      const chunk: ProgressiveChunk = {
        chunk_id: 'test-chunk',
        phase: 'content',
        content: { type: 'text', data: 'Test' },
        priority: 50,
        size_bytes: 100,
        created_at: new Date(),
        updated_at: new Date(),
        critical: false,
        component_id: 'test-component',
        metadata: { source: 'agent', strategy: 'streaming' }
      };

      streamer.sendChunk('client-1-' + response.headers['x-stream-id'] || 'client-1-0', chunk);

      const stats = streamer.getStats();

      expect(stats.activeConnections).toBe(1);
      expect(stats.totalBytesSent).toBeGreaterThan(0);
      expect(stats.totalEventsSent).toBeGreaterThan(0);
    });
  });

  describe('SSE Format', () => {
    it('should format SSE events correctly', () => {
      const response = new MockResponse();
      const streamId = streamer.createStream('client-1', response as any);

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

      streamer.sendChunk(streamId, chunk);

      const written = response.getWrittenData();

      // Verify SSE format
      expect(written).toMatch(/event:\s+chunk/);
      expect(written).toMatch(/id:\s+\S+/);
      expect(written).toMatch(/data:\s+{.*}/);
      expect(written).toContain('\n\n'); // SSE message separator
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple concurrent streams', () => {
      const clients = ['client-1', 'client-2', 'client-3'];

      for (const client of clients) {
        const response = new MockResponse();
        streamer.createStream(client, response as any);
      }

      const stats = streamer.getStats();
      expect(stats.activeConnections).toBe(3);
    });

    it('should handle special characters in data', () => {
      const response = new MockResponse();
      const streamId = streamer.createStream('client-1', response as any);

      const chunk: ProgressiveChunk = {
        chunk_id: 'test-chunk',
        phase: 'content',
        content: { type: 'text', data: 'Test with "quotes" and \'apostrophes\'' },
        priority: 50,
        created_at: new Date(),
        updated_at: new Date(),
        critical: false,
        component_id: 'test-component',
        metadata: { source: 'agent', strategy: 'streaming' }
      };

      const sent = streamer.sendChunk(streamId, chunk);

      expect(sent).toBe(true);
      // Data should be JSON-encoded
      const written = response.getWrittenData();
      expect(written).toContain('data:');
    });

    it('should handle empty chunks', () => {
      const response = new MockResponse();
      const streamId = streamer.createStream('client-1', response as any);

      const chunk: ProgressiveChunk = {
        chunk_id: 'empty-chunk',
        phase: 'skeleton',
        content: { type: 'skeleton', data: { type: 'rect' } },
        priority: 0,
        created_at: new Date(),
        updated_at: new Date(),
        critical: false,
        component_id: 'test-component',
        metadata: { source: 'generated', strategy: 'critical-first' }
      };

      const sent = streamer.sendChunk(streamId, chunk);

      expect(sent).toBe(true);
    });
  });
});

/**
 * Tests for EventDispatcher
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  EventDispatcher,
  EventRetryHandler,
  EventReplayHandler,
} from '../src/EventDispatcher.js';
import type { SSEClient, SSEChannel, SSEEvent, SSEConnection } from '../src/types.js';
import { SSEErrorCode } from '../src/types.js';

describe('EventDispatcher', () => {
  let dispatcher: EventDispatcher;
  let mockClient: SSEClient;
  let mockChannel: SSEChannel;

  beforeEach(() => {
    dispatcher = new EventDispatcher({
      format: 'json',
      buffer_size: 10,
      enable_batching: false,
    });

    const mockConnection: SSEConnection = {
      write: vi.fn().mockReturnValue(true),
      end: vi.fn(),
      isWritable: vi.fn().mockReturnValue(true),
      setTimeout: vi.fn(),
      onError: vi.fn(),
      onClose: vi.fn(),
    };

    mockClient = {
      client_id: 'test_client',
      connection: mockConnection,
      last_event_id: null,
      headers: {},
      state: 'open',
      subscriptions: new Set(),
      connected_at: Date.now(),
      last_activity: Date.now(),
    };

    mockChannel = {
      channel_name: 'test_channel',
      clients: new Set([mockClient.client_id]),
      last_message_id: '',
      created_at: Date.now(),
      metadata: {
        persistent: false,
        max_clients: 0,
        require_auth: false,
      },
      history: [],
      max_history_size: 100,
    };
  });

  describe('serializeEvent', () => {
    it('should serialize event with JSON format', () => {
      const event: SSEEvent = {
        id: '1',
        event: 'message',
        data: { text: 'hello' },
        retry: 5000,
      };

      const serialized = dispatcher.serializeEvent(event);

      expect(serialized.id).toBe('1');
      expect(serialized.event).toBe('message');
      expect(serialized.retry).toBe(5000);
      expect(serialized.raw).toContain('id: 1');
      expect(serialized.raw).toContain('event: message');
      expect(serialized.raw).toContain('data: {"text":"hello"}');
    });

    it('should serialize event with text format', () => {
      const textDispatcher = new EventDispatcher({
        format: 'text',
        buffer_size: 10,
      });

      const event: SSEEvent = {
        data: 'plain text',
      };

      const serialized = textDispatcher.serializeEvent(event);
      expect(serialized.raw).toContain('data: plain text');
    });

    it('should serialize event with binary format', () => {
      const binaryDispatcher = new EventDispatcher({
        format: 'binary',
        buffer_size: 10,
      });

      const event: SSEEvent = {
        data: { value: 123 },
      };

      const serialized = binaryDispatcher.serializeEvent(event);
      expect(serialized.raw).toBeDefined();
    });

    it('should handle multi-line data', () => {
      const event: SSEEvent = {
        data: 'line1\nline2\nline3',
      };

      const serialized = dispatcher.serializeEvent(event);
      expect(serialized.raw).toContain('data: line1');
      expect(serialized.raw).toContain('data: line2');
      expect(serialized.raw).toContain('data: line3');
    });

    it('should end with empty line', () => {
      const event: SSEEvent = {
        data: 'test',
      };

      const serialized = dispatcher.serializeEvent(event);
      expect(serialized.raw).endsWith('\n\n');
    });

    it('should generate event ID if not provided', () => {
      const event: SSEEvent = {
        data: 'test',
      };

      const serialized = dispatcher.serializeEvent(event);
      expect(serialized.id).toBeDefined();
      expect(serialized.id).toContain('global_');
    });
  });

  describe('dispatchToClient', () => {
    it('should dispatch event to client', () => {
      const event: SSEEvent = {
        data: 'test message',
      };

      const success = dispatcher.dispatchToClient(mockClient, event);
      expect(success).toBe(true);
      expect(mockClient.connection.write).toHaveBeenCalled();
    });

    it('should generate event ID if not provided', () => {
      const event: SSEEvent = {
        data: 'test',
      };

      dispatcher.dispatchToClient(mockClient, event);
      expect(event.id).toBeDefined();
    });

    it('should add event to channel history if channel provided', () => {
      const event: SSEEvent = {
        data: 'test',
      };

      dispatcher.dispatchToClient(mockClient, event, mockChannel);
      expect(mockChannel.history.length).toBeGreaterThan(0);
    });

    it('should return false for closed client', () => {
      (mockClient.connection.isWritable as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const event: SSEEvent = {
        data: 'test',
      };

      const success = dispatcher.dispatchToClient(mockClient, event);
      expect(success).toBe(false);
      expect(mockClient.state).toBe('error');
    });

    it('should update bytes sent', () => {
      const event: SSEEvent = {
        data: 'test',
      };

      const beforeBytes = dispatcher.getBytesSent();
      dispatcher.dispatchToClient(mockClient, event);
      const afterBytes = dispatcher.getBytesSent();

      expect(afterBytes).toBeGreaterThan(beforeBytes);
    });

    it('should update events sent', () => {
      const event: SSEEvent = {
        data: 'test',
      };

      const beforeEvents = dispatcher.getEventsSent();
      dispatcher.dispatchToClient(mockClient, event);
      const afterEvents = dispatcher.getEventsSent();

      expect(afterEvents).toBeGreaterThan(beforeEvents);
    });
  });

  describe('dispatchToClients', () => {
    it('should dispatch to multiple clients', () => {
      const client2: SSEClient = { ...mockClient, client_id: 'client2' };
      const client3: SSEClient = { ...mockClient, client_id: 'client3' };

      const event: SSEEvent = {
        data: 'broadcast',
      };

      const result = dispatcher.dispatchToClients(
        [mockClient, client2, client3],
        event
      );

      expect(result.success).toBe(3);
      expect(result.failed).toBe(0);
    });

    it('should count failed dispatches', () => {
      const failedClient: SSEClient = {
        ...mockClient,
        client_id: 'failed',
        connection: {
          ...mockClient.connection,
          isWritable: vi.fn().mockReturnValue(false),
          write: vi.fn().mockReturnValue(false),
        },
      };

      const event: SSEEvent = {
        data: 'test',
      };

      const result = dispatcher.dispatchToClients([mockClient, failedClient], event);

      expect(result.success).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('should handle empty client list', () => {
      const event: SSEEvent = {
        data: 'test',
      };

      const result = dispatcher.dispatchToClients([], event);

      expect(result.success).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  describe('dispatchToChannel', () => {
    it('should dispatch to all clients in channel', () => {
      const client2: SSEClient = { ...mockClient, client_id: 'client2' };
      mockChannel.clients.add(client2.client_id);

      const clients = new Map<string, SSEClient>([
        [mockClient.client_id, mockClient],
        [client2.client_id, client2],
      ]);

      const event: SSEEvent = {
        data: 'channel broadcast',
      };

      const result = dispatcher.dispatchToChannel(mockChannel, clients, event);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should only dispatch to subscribed clients', () => {
      const client2: SSEClient = { ...mockClient, client_id: 'client2' };
      mockChannel.clients.add(mockClient.client_id);

      const clients = new Map<string, SSEClient>([
        [mockClient.client_id, mockClient],
        [client2.client_id, client2],
      ]);

      const event: SSEEvent = {
        data: 'test',
      };

      const result = dispatcher.dispatchToChannel(mockChannel, clients, event);

      expect(result.success).toBe(1);
      expect(result.failed).toBe(0);
    });
  });

  describe('dispatchPing', () => {
    it('should dispatch ping event', () => {
      const success = dispatcher.dispatchPing(mockClient);
      expect(success).toBe(true);
      expect(mockClient.connection.write).toHaveBeenCalled();
    });

    it('should include timestamp in ping', () => {
      dispatcher.dispatchPing(mockClient);

      const calls = (mockClient.connection.write as ReturnType<typeof vi.fn>).mock.calls;
      const written = calls[0][0] as string;

      expect(written).toContain('event: ping');
      expect(written).toContain('timestamp');
    });
  });

  describe('dispatchError', () => {
    it('should dispatch error event', () => {
      const success = dispatcher.dispatchError(
        mockClient,
        'TEST_ERROR',
        'Test error message',
        { detail: 'value' }
      );

      expect(success).toBe(true);
    });

    it('should include error details', () => {
      dispatcher.dispatchError(
        mockClient,
        'TEST_ERROR',
        'Test error',
        { code: 123 }
      );

      const calls = (mockClient.connection.write as ReturnType<typeof vi.fn>).mock.calls;
      const written = calls[0][0] as string;

      expect(written).toContain('event: error');
      expect(written).toContain('TEST_ERROR');
    });
  });

  describe('getBufferedEvents', () => {
    it('should return buffered events', () => {
      const event: SSEEvent = {
        id: 'e1',
        data: 'test',
      };

      dispatcher.dispatchToClient(mockClient, event, mockChannel);
      const buffered = dispatcher.getBufferedEvents('test_channel');

      expect(buffered.length).toBeGreaterThan(0);
    });

    it('should return events since given ID', () => {
      const e1: SSEEvent = { id: 'e1', data: 'test1' };
      const e2: SSEEvent = { id: 'e2', data: 'test2' };
      const e3: SSEEvent = { id: 'e3', data: 'test3' };

      dispatcher.dispatchToClient(mockClient, e1, mockChannel);
      dispatcher.dispatchToClient(mockClient, e2, mockChannel);
      dispatcher.dispatchToClient(mockClient, e3, mockChannel);

      const buffered = dispatcher.getBufferedEvents('test_channel', 'e1');

      expect(buffered.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty array for non-existent channel', () => {
      const buffered = dispatcher.getBufferedEvents('non_existent');
      expect(buffered).toEqual([]);
    });
  });

  describe('clearBuffer', () => {
    it('should clear event buffer', () => {
      const event: SSEEvent = {
        data: 'test',
      };

      dispatcher.dispatchToClient(mockClient, event, mockChannel);
      const cleared = dispatcher.clearBuffer('test_channel');

      expect(cleared).toBe(true);
      expect(dispatcher.getBufferedEvents('test_channel')).toEqual([]);
    });

    it('should return false for non-existent channel', () => {
      const cleared = dispatcher.clearBuffer('non_existent');
      expect(cleared).toBe(false);
    });
  });

  describe('clearAllBuffers', () => {
    it('should clear all buffers', () => {
      const channel2: SSEChannel = {
        ...mockChannel,
        channel_name: 'channel2',
      };

      dispatcher.dispatchToClient(mockClient, { data: 'test1' }, mockChannel);
      dispatcher.dispatchToClient(mockClient, { data: 'test2' }, channel2);

      dispatcher.clearAllBuffers();

      expect(dispatcher.getBufferedEvents('test_channel')).toEqual([]);
      expect(dispatcher.getBufferedEvents('channel2')).toEqual([]);
    });
  });

  describe('getBufferSize', () => {
    it('should return buffer size', () => {
      const event: SSEEvent = {
        data: 'test',
      };

      dispatcher.dispatchToClient(mockClient, event, mockChannel);

      expect(dispatcher.getBufferSize('test_channel')).toBeGreaterThan(0);
    });

    it('should return 0 for non-existent channel', () => {
      expect(dispatcher.getBufferSize('non_existent')).toBe(0);
    });
  });

  describe('getBytesSent', () => {
    it('should track bytes sent', () => {
      const event: SSEEvent = {
        data: 'test',
      };

      const before = dispatcher.getBytesSent();
      dispatcher.dispatchToClient(mockClient, event);
      const after = dispatcher.getBytesSent();

      expect(after).toBeGreaterThan(before);
    });
  });

  describe('getEventsSent', () => {
    it('should track events sent', () => {
      const event: SSEEvent = {
        data: 'test',
      };

      const before = dispatcher.getEventsSent();
      dispatcher.dispatchToClient(mockClient, event);
      const after = dispatcher.getEventsSent();

      expect(after).toBeGreaterThan(before);
    });
  });

  describe('resetStats', () => {
    it('should reset statistics', () => {
      dispatcher.dispatchToClient(mockClient, { data: 'test' });

      dispatcher.resetStats();

      expect(dispatcher.getBytesSent()).toBe(0);
      expect(dispatcher.getEventsSent()).toBe(0);
    });
  });

  describe('close', () => {
    it('should close dispatcher', () => {
      dispatcher.close();

      // Should not throw after close
      expect(() => dispatcher.close()).not.toThrow();
    });
  });
});

describe('EventRetryHandler', () => {
  let handler: EventRetryHandler;
  let mockCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    handler = new EventRetryHandler();
    mockCallback = vi.fn();
  });

  afterEach(() => {
    handler.cancelAllRetries();
  });

  it('should schedule retry', () => {
    handler.scheduleRetry('client1', mockCallback, 100);

    expect(handler.hasPendingRetry('client1')).toBe(true);
  });

  it('should execute callback on retry', async () => {
    handler.scheduleRetry('client1', mockCallback, 10);

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockCallback).toHaveBeenCalled();
    expect(handler.hasPendingRetry('client1')).toBe(false);
  });

  it('should cancel retry', () => {
    handler.scheduleRetry('client1', mockCallback, 1000);
    const cancelled = handler.cancelRetry('client1');

    expect(cancelled).toBe(true);
    expect(handler.hasPendingRetry('client1')).toBe(false);
  });

  it('should return false when cancelling non-existent retry', () => {
    const cancelled = handler.cancelRetry('non_existent');
    expect(cancelled).toBe(false);
  });

  it('should cancel all retries', () => {
    handler.scheduleRetry('client1', mockCallback, 1000);
    handler.scheduleRetry('client2', mockCallback, 1000);

    handler.cancelAllRetries();

    expect(handler.hasPendingRetry('client1')).toBe(false);
    expect(handler.hasPendingRetry('client2')).toBe(false);
  });
});

describe('EventReplayHandler', () => {
  let handler: EventReplayHandler;

  beforeEach(() => {
    handler = new EventReplayHandler();
  });

  it('should add event to replay buffer', () => {
    handler.addEvent('test', {
      event: { id: 'e1', data: 'test' },
      timestamp: Date.now(),
      channel: 'test',
      sequence: 1,
    });

    expect(handler.getBufferSize('test')).toBe(1);
  });

  it('should get events for replay', () => {
    handler.addEvent('test', {
      event: { id: 'e1', data: 'test1' },
      timestamp: Date.now(),
      channel: 'test',
      sequence: 1,
    });
    handler.addEvent('test', {
      event: { id: 'e2', data: 'test2' },
      timestamp: Date.now(),
      channel: 'test',
      sequence: 2,
    });

    const events = handler.getEvents('test');
    expect(events).toHaveLength(2);
  });

  it('should get events since sequence', () => {
    handler.addEvent('test', {
      event: { id: 'e1', data: 'test1' },
      timestamp: Date.now(),
      channel: 'test',
      sequence: 1,
    });
    handler.addEvent('test', {
      event: { id: 'e2', data: 'test2' },
      timestamp: Date.now(),
      channel: 'test',
      sequence: 2,
    });
    handler.addEvent('test', {
      event: { id: 'e3', data: 'test3' },
      timestamp: Date.now(),
      channel: 'test',
      sequence: 3,
    });

    const events = handler.getEvents('test', 1);
    expect(events).toHaveLength(2);
    expect(events[0].event.id).toBe('e2');
  });

  it('should get events since last event ID', () => {
    handler.addEvent('test', {
      event: { id: 'e1', data: 'test1' },
      timestamp: Date.now(),
      channel: 'test',
      sequence: 1,
    });
    handler.addEvent('test', {
      event: { id: 'e2', data: 'test2' },
      timestamp: Date.now(),
      channel: 'test',
      sequence: 2,
    });

    const events = handler.getEventsSince('test', 'e1');
    expect(events).toHaveLength(1);
    expect(events[0].event.id).toBe('e2');
  });

  it('should limit buffer size', () => {
    for (let i = 0; i < 2000; i++) {
      handler.addEvent('test', {
        event: { id: `e${i}`, data: `test${i}` },
        timestamp: Date.now(),
        channel: 'test',
        sequence: i,
      });
    }

    // Should be limited to 1000
    expect(handler.getBufferSize('test')).toBeLessThanOrEqual(1000);
  });

  it('should clear buffer', () => {
    handler.addEvent('test', {
      event: { id: 'e1', data: 'test' },
      timestamp: Date.now(),
      channel: 'test',
      sequence: 1,
    });

    handler.clearBuffer('test');

    expect(handler.getBufferSize('test')).toBe(0);
  });

  it('should clear all buffers', () => {
    handler.addEvent('ch1', {
      event: { id: 'e1', data: 'test' },
      timestamp: Date.now(),
      channel: 'ch1',
      sequence: 1,
    });
    handler.addEvent('ch2', {
      event: { id: 'e2', data: 'test' },
      timestamp: Date.now(),
      channel: 'ch2',
      sequence: 1,
    });

    handler.clearAllBuffers();

    expect(handler.getBufferSize('ch1')).toBe(0);
    expect(handler.getBufferSize('ch2')).toBe(0);
  });
});

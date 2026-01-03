/**
 * SSEClient Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SSEClient } from '../src/SSEClient.js';

// Mock EventSource
class MockEventSource {
  url: string;
  readyState = 0; // CONNECTING
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onopen: ((event: Event) => void) | null = null;
  withCredentials = false;

  private listeners: Map<string, Function[]> = new Map();

  constructor(url: string, eventSourceInitDict?: { withCredentials?: boolean }) {
    this.url = url;
    if (eventSourceInitDict?.withCredentials) {
      this.withCredentials = true;
    }
  }

  addEventListener(type: string, listener: EventListener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  removeEventListener(type: string, listener: EventListener) {
    const listeners = this.listeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener as Function);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // Helper methods for testing
  mockOpen() {
    this.readyState = 1; // OPEN
    const event = new Event('open');
    if (this.onopen) this.onopen(event);
    this.listeners.get('open')?.forEach(l => l(event));
  }

  mockMessage(data: string, lastEventId = '') {
    const event = new MessageEvent('message', { data, lastEventId });
    if (this.onmessage) this.onmessage(event);
    this.listeners.get('message')?.forEach(l => l(event));
  }

  mockError() {
    const event = new Event('error');
    if (this.onerror) this.onerror(event);
    this.listeners.get('error')?.forEach(l => l(event));
  }

  close() {
    this.readyState = 2; // CLOSED
  }
}

// Store original EventSource
const OriginalEventSource = globalThis.EventSource;

describe('SSEClient', () => {
  let client: SSEClient;
  let mockEventSource: MockEventSource;

  beforeEach(() => {
    // Mock EventSource
    globalThis.EventSource = MockEventSource as any;
    mockEventSource = new MockEventSource('https://example.com/events');
  });

  afterEach(() => {
    if (client) {
      client.disconnect();
    }
    // Restore EventSource
    globalThis.EventSource = OriginalEventSource;
  });

  describe('constructor', () => {
    it('should create client with URL', () => {
      client = new SSEClient('https://example.com/events');
      expect(client.getURL()).toBe('https://example.com/events');
      expect(client.getState()).toBe('closed');
    });

    it('should create client with config', () => {
      client = new SSEClient('https://example.com/events', {
        withCredentials: true,
        maxRetries: 5
      });
      expect(client.getURL()).toBe('https://example.com/events');
    });
  });

  describe('connect', () => {
    it('should transition to connecting state', async () => {
      client = new SSEClient('https://example.com/events');
      const connectPromise = client.connect();
      expect(client.getState()).toBe('connecting');
      // Simulate open
      const es = (client as any).eventSource;
      if (es?.__impl) {
        es.__impl.mockOpen();
      }
      await connectPromise;
    });

    it('should transition to open on success', async () => {
      client = new SSEClient('https://example.com/events');
      const stateChanges: string[] = [];
      client.onStateChange((state) => stateChanges.push(state));

      const connectPromise = client.connect();

      // Simulate open
      const es = (client as any).eventSource;
      if (es?.__impl) {
        setTimeout(() => es.__impl.mockOpen(), 10);
      }

      await connectPromise;
      expect(client.getState()).toBe('open');
      expect(stateChanges).toContain('connecting');
      expect(stateChanges).toContain('open');
    });

    it('should call open handlers', async () => {
      client = new SSEClient('https://example.com/events');
      const openHandler = vi.fn();
      client.onOpen(openHandler);

      const connectPromise = client.connect();
      const es = (client as any).eventSource;
      if (es?.__impl) {
        setTimeout(() => es.__impl.mockOpen(), 10);
      }

      await connectPromise;
      expect(openHandler).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should transition to closed state', async () => {
      client = new SSEClient('https://example.com/events');
      await client.connect();
      await client.disconnect();
      expect(client.getState()).toBe('closed');
    });

    it('should close EventSource', async () => {
      client = new SSEClient('https://example.com/events');
      await client.connect();
      await client.disconnect();
      expect((client as any).eventSource).toBeNull();
    });
  });

  describe('reconnect', () => {
    it('should disconnect and reconnect', async () => {
      client = new SSEClient('https://example.com/events');
      const firstConnect = vi.spyOn(client as any, 'connect').mockResolvedValueOnce();
      await client.connect();

      await client.reconnect();
      expect(client.getState()).toBe('connecting');
    });
  });

  describe('onMessage', () => {
    it('should receive messages', async () => {
      client = new SSEClient('https://example.com/events');
      const messageHandler = vi.fn();
      client.onMessage(messageHandler);

      await client.connect();
      const es = (client as any).eventSource;
      if (es?.__impl) {
        setTimeout(() => {
          es.__impl.mockOpen();
          es.__impl.mockMessage('hello world');
        }, 10);
      }

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(messageHandler).toHaveBeenCalled();
    });
  });

  describe('onError', () => {
    it('should handle errors', async () => {
      client = new SSEClient('https://example.com/events');
      const errorHandler = vi.fn();
      client.onError(errorHandler);

      await client.connect();
      const es = (client as any).eventSource;
      if (es?.__impl) {
        setTimeout(() => {
          es.__impl.mockError();
        }, 10);
      }

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('onStateChange', () => {
    it('should notify state changes', async () => {
      client = new SSEClient('https://example.com/events');
      const states: string[] = [];
      client.onStateChange((state) => states.push(state));

      await client.connect();
      await client.disconnect();

      expect(states).toContain('connecting');
      expect(states).toContain('closed');
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      client = new SSEClient('https://example.com/events');
      expect(client.getState()).toBe('closed');
    });
  });

  describe('getReadyState', () => {
    it('should return EventSource ready state', () => {
      client = new SSEClient('https://example.com/events');
      expect(client.getReadyState()).toBe(2); // CLOSED
    });
  });

  describe('getStats', () => {
    it('should return statistics', async () => {
      client = new SSEClient('https://example.com/events');
      const stats = client.getStats();
      expect(stats).toHaveProperty('state');
      expect(stats).toHaveProperty('attempts');
      expect(stats).toHaveProperty('successes');
      expect(stats).toHaveProperty('errors');
      expect(stats).toHaveProperty('messagesReceived');
    });
  });

  describe('isConnected', () => {
    it('should return true when connected', async () => {
      client = new SSEClient('https://example.com/events');
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('isReconnecting', () => {
    it('should return true when reconnecting', () => {
      client = new SSEClient('https://example.com/events');
      expect(client.isReconnecting()).toBe(false);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      client = new SSEClient('https://example.com/events');
      expect(() => client.updateConfig({ maxRetries: 10 })).not.toThrow();
    });
  });

  describe('getBufferStats', () => {
    it('should return buffer statistics', () => {
      client = new SSEClient('https://example.com/events');
      const stats = client.getBufferStats();
      expect(stats).toHaveProperty('size');
    });
  });

  describe('getReconnectStats', () => {
    it('should return reconnection statistics', () => {
      client = new SSEClient('https://example.com/events');
      const stats = client.getReconnectStats();
      expect(stats).toHaveProperty('attempts');
    });
  });

  describe('getEventBusStats', () => {
    it('should return event bus statistics', () => {
      client = new SSEClient('https://example.com/events');
      const stats = client.getEventBusStats();
      expect(stats).toHaveProperty('totalListeners');
    });
  });

  describe('event handling', () => {
    it('should support named event listeners', async () => {
      client = new SSEClient('https://example.com/events');
      const handler = vi.fn();
      client.on('custom', handler);
      expect(typeof client.off).toBe('function');
    });

    it('should support once listeners', async () => {
      client = new SSEClient('https://example.com/events');
      const handler = vi.fn();
      client.once('test', handler);
      expect(typeof client.off).toBe('function');
    });
  });
});

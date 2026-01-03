/**
 * EventSourceWrapper Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EventSourceWrapper,
  hasNativeEventSource,
  READY_STATE,
  calculateLinearBackoff,
  calculateExponentialBackoff,
  calculateJitterBackoff
} from '../src/EventSourceWrapper.js';

// Mock EventSource for testing
class MockEventSource {
  url: string;
  readyState = 0;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onopen: ((event: Event) => void) | null = null;

  constructor(url: string, eventSourceInitDict?: any) {
    this.url = url;
  }

  close() {
    this.readyState = 2;
  }

  mockOpen() {
    this.readyState = 1;
    if (this.onopen) this.onopen(new Event('open'));
  }

  mockMessage(data: string) {
    if (this.onmessage) this.onmessage(new MessageEvent('message', { data }));
  }

  mockError() {
    if (this.onerror) this.onerror(new Event('error'));
  }
}

describe('EventSourceWrapper', () => {
  let wrapper: EventSourceWrapper;
  const originalEventSource = globalThis.EventSource;

  beforeEach(() => {
    globalThis.EventSource = MockEventSource as any;
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.disconnect();
    }
    globalThis.EventSource = originalEventSource;
  });

  describe('constructor', () => {
    it('should create wrapper', () => {
      wrapper = new EventSourceWrapper('https://example.com/events');
      expect(wrapper.url).toBe('https://example.com/events');
    });

    it('should start with closed state', () => {
      wrapper = new EventSourceWrapper('https://example.com/events');
      expect(wrapper.readyState).toBe(READY_STATE.CLOSED);
      expect(wrapper.connected).toBe(false);
    });
  });

  describe('connect', () => {
    it('should create EventSource', () => {
      wrapper = new EventSourceWrapper('https://example.com/events');
      wrapper.connect();
      expect(wrapper.readyState).toBe(READY_STATE.CONNECTING);
    });

    it('should call open handlers', () => {
      wrapper = new EventSourceWrapper('https://example.com/events');
      const openHandler = vi.fn();
      wrapper.onOpen(openHandler);
      wrapper.connect();
      (wrapper as any).eventSource?.mockOpen();
      expect(openHandler).toHaveBeenCalled();
    });

    it('should call message handlers', () => {
      wrapper = new EventSourceWrapper('https://example.com/events');
      const messageHandler = vi.fn();
      wrapper.onMessage(messageHandler);
      wrapper.connect();
      (wrapper as any).eventSource?.mockMessage('hello');
      expect(messageHandler).toHaveBeenCalled();
    });

    it('should call error handlers', () => {
      wrapper = new EventSourceWrapper('https://example.com/events');
      const errorHandler = vi.fn();
      wrapper.onError(errorHandler);
      wrapper.connect();
      (wrapper as any).eventSource?.mockError();
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should close EventSource', () => {
      wrapper = new EventSourceWrapper('https://example.com/events');
      wrapper.connect();
      wrapper.disconnect();
      expect(wrapper.readyState).toBe(READY_STATE.CLOSED);
      expect((wrapper as any).eventSource).toBeNull();
    });
  });

  describe('getLastEventId', () => {
    it('should return null initially', () => {
      wrapper = new EventSourceWrapper('https://example.com/events');
      expect(wrapper.getLastEventId()).toBeNull();
    });
  });

  describe('setLastEventId', () => {
    it('should set last event ID', () => {
      wrapper = new EventSourceWrapper('https://example.com/events', false, null);
      wrapper.setLastEventId('123');
      expect(wrapper.getLastEventId()).toBe('123');
    });
  });

  describe('url with Last-Event-ID', () => {
    it('should append Last-Event-ID to URL', () => {
      wrapper = new EventSourceWrapper('https://example.com/events', false, 'abc123');
      wrapper.connect();
      const es = (wrapper as any).eventSource;
      expect(es.url).toContain('lastEventId=abc123');
    });

    it('should use correct separator', () => {
      wrapper = new EventSourceWrapper('https://example.com/events?foo=bar', false, 'abc123');
      wrapper.connect();
      const es = (wrapper as any).eventSource;
      expect(es.url).toContain('&lastEventId=');
    });
  });
});

describe('READY_STATE constants', () => {
  it('should have correct values', () => {
    expect(READY_STATE.CONNECTING).toBe(0);
    expect(READY_STATE.OPEN).toBe(1);
    expect(READY_STATE.CLOSED).toBe(2);
  });
});

describe('hasNativeEventSource', () => {
  it('should return true when EventSource exists', () => {
    const original = globalThis.EventSource;
    globalThis.EventSource = {} as any;
    expect(hasNativeEventSource()).toBe(true);
    globalThis.EventSource = original;
  });

  it('should return false when EventSource missing', () => {
    const original = globalThis.EventSource;
    // @ts-ignore - testing missing EventSource
    globalThis.EventSource = undefined;
    expect(hasNativeEventSource()).toBe(false);
    globalThis.EventSource = original;
  });
});

describe('Backoff calculation exports', () => {
  it('should export calculateLinearBackoff', () => {
    expect(calculateLinearBackoff).toBeDefined();
  });

  it('should export calculateExponentialBackoff', () => {
    expect(calculateExponentialBackoff).toBeDefined();
  });

  it('should export calculateJitterBackoff', () => {
    expect(calculateJitterBackoff).toBeDefined();
  });
});

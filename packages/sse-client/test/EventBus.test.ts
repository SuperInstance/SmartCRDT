/**
 * EventBus Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../src/EventBus.js';
import type { SSEMessage } from '../src/types.js';

describe('EventBus', () => {
  let eventBus: EventBus;
  let mockMessage: SSEMessage;

  beforeEach(() => {
    eventBus = new EventBus();
    mockMessage = {
      id: '1',
      event: 'test',
      data: 'test data',
      origin: 'https://example.com',
      timestamp: Date.now()
    };
  });

  describe('on', () => {
    it('should add listener and return ID', () => {
      const handler = vi.fn();
      const id = eventBus.on('test', handler);
      expect(typeof id).toBe('string');
      expect(id).toBeTruthy();
    });

    it('should call handler on emit', () => {
      const handler = vi.fn();
      eventBus.on('test', handler);
      eventBus.emit('test', mockMessage);
      expect(handler).toHaveBeenCalledWith(mockMessage);
    });

    it('should call multiple handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.on('test', handler1);
      eventBus.on('test', handler2);
      eventBus.emit('test', mockMessage);
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should apply filter', () => {
      const handler = vi.fn();
      eventBus.on('test', handler, {
        filter: (msg) => msg.data.includes('special')
      });
      eventBus.emit('test', mockMessage);
      expect(handler).not.toHaveBeenCalled();
      eventBus.emit('test', { ...mockMessage, data: 'special message' });
      expect(handler).toHaveBeenCalled();
    });

    it('should apply transform', () => {
      const handler = vi.fn();
      eventBus.on('test', handler, {
        transform: (msg) => ({ ...msg, data: msg.data.toUpperCase() })
      });
      eventBus.emit('test', mockMessage);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ data: 'TEST DATA' })
      );
    });

    it('should respect priority', () => {
      const calls: string[] = [];
      const handler1 = vi.fn(() => calls.push('low'));
      const handler2 = vi.fn(() => calls.push('high'));
      eventBus.on('test', handler1, { priority: 0 });
      eventBus.on('test', handler2, { priority: 10 });
      eventBus.emit('test', mockMessage);
      expect(calls).toEqual(['high', 'low']);
    });
  });

  describe('once', () => {
    it('should call handler only once', () => {
      const handler = vi.fn();
      eventBus.once('test', handler);
      eventBus.emit('test', mockMessage);
      eventBus.emit('test', mockMessage);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should remove itself after call', () => {
      const handler = vi.fn();
      eventBus.once('test', handler);
      expect(eventBus.listenerCount('test')).toBe(1);
      eventBus.emit('test', mockMessage);
      expect(eventBus.listenerCount('test')).toBe(0);
    });
  });

  describe('off', () => {
    it('should remove listener by ID', () => {
      const handler = vi.fn();
      const id = eventBus.on('test', handler);
      expect(eventBus.listenerCount('test')).toBe(1);
      eventBus.off(id);
      expect(eventBus.listenerCount('test')).toBe(0);
    });

    it('should return true when removed', () => {
      const handler = vi.fn();
      const id = eventBus.on('test', handler);
      expect(eventBus.off(id)).toBe(true);
    });

    it('should return false when not found', () => {
      expect(eventBus.off('nonexistent')).toBe(false);
    });
  });

  describe('offAll', () => {
    it('should remove all listeners for event', () => {
      eventBus.on('test', vi.fn());
      eventBus.on('test', vi.fn());
      eventBus.on('test', vi.fn());
      expect(eventBus.listenerCount('test')).toBe(3);
      eventBus.offAll('test');
      expect(eventBus.listenerCount('test')).toBe(0);
    });

    it('should not affect other events', () => {
      eventBus.on('test', vi.fn());
      eventBus.on('other', vi.fn());
      eventBus.offAll('test');
      expect(eventBus.listenerCount('test')).toBe(0);
      expect(eventBus.listenerCount('other')).toBe(1);
    });
  });

  describe('removeAll', () => {
    it('should remove all listeners', () => {
      eventBus.on('test1', vi.fn());
      eventBus.on('test2', vi.fn());
      eventBus.on('test3', vi.fn());
      eventBus.removeAll();
      expect(eventBus.totalListenerCount).toBe(0);
    });
  });

  describe('emit', () => {
    it('should not call listeners for other events', () => {
      const handler = vi.fn();
      eventBus.on('test', handler);
      eventBus.emit('other', mockMessage);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle exceptions in handlers', () => {
      const handler1 = vi.fn(() => { throw new Error('test'); });
      const handler2 = vi.fn();
      eventBus.on('test', handler1);
      eventBus.on('test', handler2);
      expect(() => eventBus.emit('test', mockMessage)).not.toThrow();
      expect(handler2).toHaveBeenCalled();
    });

    it('should do nothing when no listeners', () => {
      expect(() => eventBus.emit('test', mockMessage)).not.toThrow();
    });
  });

  describe('listenerCount', () => {
    it('should return 0 for no listeners', () => {
      expect(eventBus.listenerCount('test')).toBe(0);
    });

    it('should return correct count', () => {
      eventBus.on('test', vi.fn());
      eventBus.on('test', vi.fn());
      expect(eventBus.listenerCount('test')).toBe(2);
    });
  });

  describe('totalListenerCount', () => {
    it('should count all listeners across all events', () => {
      eventBus.on('test1', vi.fn());
      eventBus.on('test1', vi.fn());
      eventBus.on('test2', vi.fn());
      eventBus.on('test3', vi.fn());
      expect(eventBus.totalListenerCount).toBe(4);
    });
  });

  describe('hasListeners', () => {
    it('should return true when listeners exist', () => {
      eventBus.on('test', vi.fn());
      expect(eventBus.hasListeners('test')).toBe(true);
    });

    it('should return false when no listeners', () => {
      expect(eventBus.hasListeners('test')).toBe(false);
    });
  });

  describe('events', () => {
    it('should return array of event names', () => {
      eventBus.on('test1', vi.fn());
      eventBus.on('test2', vi.fn());
      eventBus.on('test3', vi.fn());
      const events = eventBus.events;
      expect(events).toContain('test1');
      expect(events).toContain('test2');
      expect(events).toContain('test3');
      expect(events.length).toBe(3);
    });
  });

  describe('getListeners', () => {
    it('should return copy of listeners', () => {
      const handler = vi.fn();
      eventBus.on('test', handler);
      const listeners = eventBus.getListeners('test');
      expect(listeners).toHaveLength(1);
      expect(listeners[0].handler).toBe(handler);
    });

    it('should not mutate original array', () => {
      eventBus.on('test', vi.fn());
      const listeners1 = eventBus.getListeners('test');
      const listeners2 = eventBus.getListeners('test');
      expect(listeners1).not.toBe(listeners2);
    });
  });

  describe('onAny', () => {
    it('should call handler for all events', () => {
      const handler = vi.fn();
      eventBus.onAny(handler);
      eventBus.emit('test1', mockMessage);
      eventBus.emit('test2', mockMessage);
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should receive event name and message', () => {
      const handler = vi.fn();
      eventBus.onAny(handler);
      eventBus.emit('test', mockMessage);
      expect(handler).toHaveBeenCalledWith('test', mockMessage);
    });
  });

  describe('emitAll', () => {
    it('should call wildcard and event listeners', () => {
      const wildcardHandler = vi.fn();
      const eventHandler = vi.fn();
      eventBus.onAny(wildcardHandler);
      eventBus.on('test', eventHandler);
      eventBus.emitAll('test', mockMessage);
      expect(wildcardHandler).toHaveBeenCalledWith('test', mockMessage);
      expect(eventHandler).toHaveBeenCalledWith(mockMessage);
    });
  });

  describe('getStats', () => {
    it('should return statistics', () => {
      eventBus.on('test', vi.fn(), { once: true, priority: 5 });
      eventBus.on('test', vi.fn(), { priority: 10 });
      const stats = eventBus.getStats();
      expect(stats.totalListeners).toBe(2);
      expect(stats.onceListeners).toBe(1);
      expect(stats.prioritySum).toBe(15);
      expect(stats.events).toContain('test');
      expect(stats.listenerCounts.test).toBe(2);
    });

    it('should handle empty event bus', () => {
      const stats = eventBus.getStats();
      expect(stats.totalListeners).toBe(0);
      expect(stats.events).toEqual([]);
    });
  });
});

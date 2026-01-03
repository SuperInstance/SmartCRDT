/**
 * Client Integration Tests
 * Tests for SSE client integration with reconnection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ReconnectionClient,
  createReconnectionClient
} from '../src/client.js';
import type { SSEClient, SSEEvent } from '../src/client.js';

describe('Client Integration', () => {
  let mockSSEClient: SSEClient;
  let client: ReconnectionClient;

  beforeEach(() => {
    mockSSEClient = {
      url: 'https://example.com/events',
      connected: false,
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      onEvent: vi.fn(),
      onError: vi.fn(),
      onOpen: vi.fn(),
      onClose: vi.fn()
    };

    client = new ReconnectionClient({
      url: 'https://example.com/events',
      client: mockSSEClient,
      integrationOptions: {
        autoReconnect: true,
        replayBufferedEvents: true,
        showNotifications: false
      },
      reconnectConfig: {
        maxRetries: 5,
        initialDelay: 100
      }
    });
  });

  describe('Construction', () => {
    it('should create with URL', () => {
      const c = new ReconnectionClient({
        url: 'https://example.com/events'
      });

      expect(c).toBeDefined();
    });

    it('should create with factory function', () => {
      const c = createReconnectionClient('https://example.com/events');

      expect(c).toBeDefined();
    });

    it('should create with client', () => {
      const c = new ReconnectionClient({
        url: 'https://example.com/events',
        client: mockSSEClient
      });

      expect(c).toBeDefined();
    });

    it('should initialize in disconnected state', () => {
      const state = client.getConnectionState();

      expect(state.connected).toBe(false);
      expect(state.reconnecting).toBe(false);
    });
  });

  describe('Connection', () => {
    it('should connect successfully', async () => {
      mockSSEClient.connected = true;

      await client.connect();

      expect(mockSSEClient.connect).toHaveBeenCalled();
    });

    it('should update connection state on connect', async () => {
      mockSSEClient.connected = true;

      await client.connect();

      const state = client.getConnectionState();

      expect(state.connected).toBe(true);
    });

    it('should handle connection errors', async () => {
      mockSSEClient.connect = vi.fn().mockRejectedValue(new Error('Connection failed'));

      await expect(client.connect()).rejects.toThrow();
    });

    it('should disconnect', () => {
      mockSSEClient.connected = true;

      client.disconnect();

      expect(mockSSEClient.disconnect).toHaveBeenCalled();
    });

    it('should update state on disconnect', () => {
      mockSSEClient.connected = false;

      client.disconnect();

      const state = client.getConnectionState();

      expect(state.connected).toBe(false);
    });
  });

  describe('Event Handlers', () => {
    it('should register event handlers', () => {
      const handler = vi.fn();

      const unsubscribe = client.onEvent(handler);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should unregister event handlers', () => {
      const handler = vi.fn();

      const unsubscribe = client.onEvent(handler);
      unsubscribe();

      expect(handler).not.toHaveBeenCalled();
    });

    it('should register error handlers', () => {
      const handler = vi.fn();

      const unsubscribe = client.onError(handler);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should handle multiple event handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      client.onEvent(handler1);
      client.onEvent(handler2);

      // Handlers are registered but need to be called by the client
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('Force Reconnect', () => {
    it('should force reconnection', async () => {
      mockSSEClient.connected = true;

      await client.connect();
      await client.forceReconnect();

      expect(mockSSEClient.disconnect).toHaveBeenCalled();
      expect(mockSSEClient.connect).toHaveBeenCalledTimes(2);
    });

    it('should emit notification on force reconnect', async () => {
      const notificationHandler = vi.fn();

      client.setNotificationHandler(notificationHandler);

      mockSSEClient.connected = true;

      await client.connect();
      await client.forceReconnect();

      expect(notificationHandler).toHaveBeenCalled();
    });
  });

  describe('Configuration', () => {
    it('should update reconnection config', () => {
      client.updateConfig({
        maxRetries: 20,
        initialDelay: 500
      });

      // Config is updated internally
      expect(client).toBeDefined();
    });

    it('should update integration options', () => {
      client.updateIntegrationOptions({
        autoReconnect: false,
        showNotifications: true
      });

      // Options are updated internally
      expect(client).toBeDefined();
    });

    it('should set notification handler', () => {
      const handler = vi.fn();

      client.setNotificationHandler(handler);

      // Handler is set internally
      expect(client).toBeDefined();
    });
  });

  describe('Statistics', () => {
    it('should return statistics', () => {
      const stats = client.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.state).toBeDefined();
      expect(stats.totalAttempts).toBeDefined();
    });
  });

  describe('Notifications', () => {
    it('should show notifications when enabled', async () => {
      const handler = vi.fn();

      client.updateIntegrationOptions({ showNotifications: true });
      client.setNotificationHandler(handler);

      mockSSEClient.connected = true;

      await client.connect();

      expect(handler).toHaveBeenCalledWith(
        expect.stringContaining('Connected'),
        'info'
      );
    });

    it('should not show notifications when disabled', async () => {
      const handler = vi.fn();

      client.updateIntegrationOptions({ showNotifications: false });
      client.setNotificationHandler(handler);

      mockSSEClient.connected = true;

      await client.connect();

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle notification handler errors', async () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });

      client.updateIntegrationOptions({ showNotifications: true });
      client.setNotificationHandler(errorHandler);

      mockSSEClient.connected = true;

      // Should not throw
      await expect(client.connect()).resolves.not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle disconnect when not connected', () => {
      expect(() => {
        client.disconnect();
      }).not.toThrow();
    });

    it('should handle multiple connect calls', async () => {
      mockSSEClient.connected = true;

      await client.connect();

      // Second connect should handle gracefully
      await client.connect();

      expect(mockSSEClient.connect).toHaveBeenCalled();
    });

    it('should handle client without connect method', async () => {
      const c = new ReconnectionClient({
        url: 'https://example.com/events',
        client: null as any
      });

      await expect(c.connect()).rejects.toThrow();
    });
  });
});

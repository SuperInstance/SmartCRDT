/**
 * Tests for ConnectionManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectionManager } from '../src/ConnectionManager.js';
import type { SSEConnection, SSEEvent } from '../src/types.js';
import { SSEErrorCode } from '../src/types.js';

describe('ConnectionManager', () => {
  let manager: ConnectionManager;
  let mockConnection: SSEConnection;

  beforeEach(() => {
    manager = new ConnectionManager({
      heartbeat_interval: 100,
      connection_timeout: 5000,
      max_reconnect_attempts: 5,
    });

    mockConnection = {
      write: vi.fn().mockReturnValue(true),
      end: vi.fn(),
      isWritable: vi.fn().mockReturnValue(true),
      setTimeout: vi.fn(),
      onError: vi.fn(),
      onClose: vi.fn(),
    };
  });

  describe('addClient', () => {
    it('should add a new client', () => {
      const client = manager.addClient(mockConnection, {}, null);
      expect(client).toBeDefined();
      expect(client.client_id).toContain('client_');
      expect(client.state).toBe('open');
      expect(manager.getClientCount()).toBe(1);
    });

    it('should assign unique client IDs', () => {
      const client1 = manager.addClient(mockConnection, {}, null);
      const client2 = manager.addClient(mockConnection, {}, null);
      expect(client1.client_id).not.toBe(client2.client_id);
    });

    it('should store client headers', () => {
      const headers = {
        'user-agent': 'test',
        'x-forwarded-for': '127.0.0.1',
      };
      const client = manager.addClient(mockConnection, headers, null);
      expect(client.headers).toEqual(headers);
    });

    it('should store last event ID', () => {
      const client = manager.addClient(mockConnection, {}, 'event_123');
      expect(client.last_event_id).toBe('event_123');
    });

    it('should throw error when connection limit reached', () => {
      const limitedManager = new ConnectionManager({
        max_reconnect_attempts: 2,
      });

      limitedManager.addClient(mockConnection, {}, null);
      limitedManager.addClient(mockConnection, {}, null);

      expect(() => {
        limitedManager.addClient(mockConnection, {}, null);
      }).toThrow();
    });

    it('should initialize empty subscriptions', () => {
      const client = manager.addClient(mockConnection, {}, null);
      expect(client.subscriptions).toBeInstanceOf(Set);
      expect(client.subscriptions.size).toBe(0);
    });

    it('should set connected_at timestamp', () => {
      const before = Date.now();
      const client = manager.addClient(mockConnection, {}, null);
      const after = Date.now();
      expect(client.connected_at).toBeGreaterThanOrEqual(before);
      expect(client.connected_at).toBeLessThanOrEqual(after);
    });
  });

  describe('removeClient', () => {
    it('should remove existing client', () => {
      const client = manager.addClient(mockConnection, {}, null);
      const removed = manager.removeClient(client.client_id);
      expect(removed).toBe(true);
      expect(manager.getClientCount()).toBe(0);
    });

    it('should return false for non-existent client', () => {
      const removed = manager.removeClient('non_existent');
      expect(removed).toBe(false);
    });

    it('should close connection on removal', () => {
      const client = manager.addClient(mockConnection, {}, null);
      manager.removeClient(client.client_id);
      expect(mockConnection.end).toHaveBeenCalled();
    });

    it('should update client state to closed', () => {
      const client = manager.addClient(mockConnection, {}, null);
      manager.removeClient(client.client_id);
      expect(client.state).toBe('closed');
    });
  });

  describe('getClient', () => {
    it('should return existing client', () => {
      const added = manager.addClient(mockConnection, {}, null);
      const retrieved = manager.getClient(added.client_id);
      expect(retrieved).toBe(added);
    });

    it('should return undefined for non-existent client', () => {
      const retrieved = manager.getClient('non_existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getAllClients', () => {
    it('should return all clients', () => {
      manager.addClient(mockConnection, {}, null);
      manager.addClient(mockConnection, {}, null);
      manager.addClient(mockConnection, {}, null);

      const clients = manager.getAllClients();
      expect(clients).toHaveLength(3);
    });

    it('should return empty array when no clients', () => {
      const clients = manager.getAllClients();
      expect(clients).toEqual([]);
    });
  });

  describe('subscribeToChannel', () => {
    it('should subscribe client to channel', () => {
      const client = manager.addClient(mockConnection, {}, null);
      const subscribed = manager.subscribeToChannel(client.client_id, 'channel1');
      expect(subscribed).toBe(true);
      expect(client.subscriptions.has('channel1')).toBe(true);
    });

    it('should return false for non-existent client', () => {
      const subscribed = manager.subscribeToChannel('non_existent', 'channel1');
      expect(subscribed).toBe(false);
    });

    it('should allow multiple channel subscriptions', () => {
      const client = manager.addClient(mockConnection, {}, null);
      manager.subscribeToChannel(client.client_id, 'channel1');
      manager.subscribeToChannel(client.client_id, 'channel2');
      expect(client.subscriptions.size).toBe(2);
    });
  });

  describe('unsubscribeFromChannel', () => {
    it('should unsubscribe client from channel', () => {
      const client = manager.addClient(mockConnection, {}, null);
      manager.subscribeToChannel(client.client_id, 'channel1');
      const unsubscribed = manager.unsubscribeFromChannel(client.client_id, 'channel1');
      expect(unsubscribed).toBe(true);
      expect(client.subscriptions.has('channel1')).toBe(false);
    });

    it('should return false for non-existent client', () => {
      const unsubscribed = manager.unsubscribeFromChannel('non_existent', 'channel1');
      expect(unsubscribed).toBe(false);
    });

    it('should return false when not subscribed', () => {
      const client = manager.addClient(mockConnection, {}, null);
      const unsubscribed = manager.unsubscribeFromChannel(client.client_id, 'channel1');
      expect(unsubscribed).toBe(false);
    });
  });

  describe('getClientsByChannel', () => {
    it('should return clients subscribed to channel', () => {
      const client1 = manager.addClient(mockConnection, {}, null);
      const client2 = manager.addClient(mockConnection, {}, null);
      const client3 = manager.addClient(mockConnection, {}, null);

      manager.subscribeToChannel(client1.client_id, 'channel1');
      manager.subscribeToChannel(client2.client_id, 'channel1');
      manager.subscribeToChannel(client3.client_id, 'channel2');

      const channel1Clients = manager.getClientsByChannel('channel1');
      expect(channel1Clients).toHaveLength(2);
      expect(channel1Clients.map(c => c.client_id)).toContain(client1.client_id);
      expect(channel1Clients.map(c => c.client_id)).toContain(client2.client_id);
    });

    it('should return empty array for channel with no subscribers', () => {
      const clients = manager.getClientsByChannel('non_existent');
      expect(clients).toEqual([]);
    });
  });

  describe('updateActivity', () => {
    it('should update client activity timestamp', () => {
      const client = manager.addClient(mockConnection, {}, null);
      const before = Date.now();
      manager.updateActivity(client.client_id);
      const after = Date.now();

      expect(client.last_activity).toBeGreaterThanOrEqual(before);
      expect(client.last_activity).toBeLessThanOrEqual(after);
    });

    it('should return false for non-existent client', () => {
      const updated = manager.updateActivity('non_existent');
      expect(updated).toBe(false);
    });
  });

  describe('isAlive', () => {
    it('should return true for active client', () => {
      const client = manager.addClient(mockConnection, {}, null);
      expect(manager.isAlive(client.client_id)).toBe(true);
    });

    it('should return false for non-existent client', () => {
      expect(manager.isAlive('non_existent')).toBe(false);
    });

    it('should return false when connection not writable', () => {
      const notWritableConnection: SSEConnection = {
        write: vi.fn().mockReturnValue(false),
        end: vi.fn(),
        isWritable: vi.fn().mockReturnValue(false),
        setTimeout: vi.fn(),
        onError: vi.fn(),
        onClose: vi.fn(),
      };

      const client = manager.addClient(notWritableConnection, {}, null);
      expect(manager.isAlive(client.client_id)).toBe(false);
    });

    it('should return false for stale connection', () => {
      const oldManager = new ConnectionManager({
        connection_timeout: 100,
      });

      const client = oldManager.addClient(mockConnection, {}, null);
      // Manually set last_activity to past
      client.last_activity = Date.now() - 1000;
      expect(oldManager.isAlive(client.client_id)).toBe(false);
    });
  });

  describe('sendToClient', () => {
    it('should update activity on send', async () => {
      const client = manager.addClient(mockConnection, {}, null);
      const event: SSEEvent = { data: 'test' };

      await manager.sendToClient(client.client_id, event);
      expect(client.last_activity).toBeGreaterThan(0);
    });

    it('should return false for non-existent client', async () => {
      const event: SSEEvent = { data: 'test' };

      const result = await manager.sendToClient('non_existent', event);
      expect(result).toBe(false);
    });
  });

  describe('getClientInfo', () => {
    it('should return client info', () => {
      const headers = {
        'x-forwarded-for': '192.168.1.1',
        'user-agent': 'Mozilla/5.0',
      };
      const client = manager.addClient(mockConnection, headers, null);
      manager.subscribeToChannel(client.client_id, 'channel1');

      const info = manager.getClientInfo(client.client_id);
      expect(info).toBeDefined();
      expect(info?.client_id).toBe(client.client_id);
      expect(info?.channels).toEqual(['channel1']);
      expect(info?.ip).toBe('192.168.1.1');
      expect(info?.user_agent).toBe('Mozilla/5.0');
    });

    it('should return null for non-existent client', () => {
      const info = manager.getClientInfo('non_existent');
      expect(info).toBeNull();
    });
  });

  describe('getAllClientInfo', () => {
    it('should return info for all clients', () => {
      manager.addClient(mockConnection, {}, null);
      manager.addClient(mockConnection, {}, null);

      const infos = manager.getAllClientInfo();
      expect(infos).toHaveLength(2);
    });
  });

  describe('getTotalConnections', () => {
    it('should count total connections', () => {
      manager.addClient(mockConnection, {}, null);
      manager.addClient(mockConnection, {}, null);
      manager.removeClient(manager.getAllClients()[0].client_id);
      manager.addClient(mockConnection, {}, null);

      expect(manager.getTotalConnections()).toBe(3);
    });
  });

  describe('cleanupStaleConnections', () => {
    it('should remove stale connections', () => {
      const staleConnection: SSEConnection = {
        write: vi.fn().mockReturnValue(false),
        end: vi.fn(),
        isWritable: vi.fn().mockReturnValue(false),
        setTimeout: vi.fn(),
        onError: vi.fn(),
        onClose: vi.fn(),
      };

      manager.addClient(mockConnection, {}, null);
      const staleClient = manager.addClient(staleConnection, {}, null);

      const cleaned = manager.cleanupStaleConnections();
      expect(cleaned).toBe(1);
      expect(manager.getClient(staleClient.client_id)).toBeUndefined();
    });
  });

  describe('closeAll', () => {
    it('should close all clients', () => {
      manager.addClient(mockConnection, {}, null);
      manager.addClient(mockConnection, {}, null);
      manager.addClient(mockConnection, {}, null);

      manager.closeAll();
      expect(manager.getClientCount()).toBe(0);
      expect(mockConnection.end).toHaveBeenCalledTimes(3);
    });
  });

  describe('rate limiting', () => {
    it('should enforce rate limit when enabled', async () => {
      const rateLimitedManager = new ConnectionManager({
        enable_rate_limiting: true,
        rate_limit_events_per_second: 2,
      });

      const client = rateLimitedManager.addClient(mockConnection, {}, null);
      const event: SSEEvent = { data: 'test' };

      // Should be allowed
      await rateLimitedManager.sendToClient(client.client_id, event);
      await rateLimitedManager.sendToClient(client.client_id, event);

      // Should throw rate limit error
      await expect(
        rateLimitedManager.sendToClient(client.client_id, event)
      ).rejects.toThrow();
    });
  });
});

/**
 * Tests for SSEServer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SSEServer, createSSEServer, createDefaultSSEServer } from '../src/SSEServer.js';
import type { SSEEvent, ServerConfig } from '../src/types.js';
import { SSEErrorCode } from '../src/types.js';

describe('SSEServer', () => {
  let server: SSEServer;

  beforeEach(() => {
    server = new SSEServer({
      port: 3000,
      host: 'localhost',
      ping_interval: 30000,
      retry_timeout: 5000,
      max_connections: 100,
    });
  });

  describe('constructor', () => {
    it('should create server with default config', () => {
      const defaultServer = new SSEServer();
      expect(defaultServer).toBeDefined();
      expect(defaultServer.isRunning()).toBe(false);
    });

    it('should create server with custom config', () => {
      const customServer = new SSEServer({
        port: 8080,
        host: '0.0.0.0',
        ping_interval: 60000,
      });
      expect(customServer).toBeDefined();
      const config = customServer.getConfig();
      expect(config.port).toBe(8080);
      expect(config.host).toBe('0.0.0.0');
    });

    it('should initialize components', () => {
      expect(server.getConnectionManager()).toBeDefined();
      expect(server.getChannelManager()).toBeDefined();
      expect(server.getEventDispatcher()).toBeDefined();
      expect(server.getHttpHandler()).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start server', async () => {
      await server.start();
      expect(server.isRunning()).toBe(true);
    });

    it('should throw error when already started', async () => {
      await server.start();

      await expect(server.start()).rejects.toThrow();
    });

    it('should create default channel', async () => {
      await server.start();
      expect(server.hasChannel('default')).toBe(true);
    });

    it('should set start time', async () => {
      const before = Date.now();
      await server.start();
      const after = Date.now();

      const stats = server.getStats();
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('stop', () => {
    it('should stop running server', async () => {
      await server.start();
      await server.stop();

      expect(server.isRunning()).toBe(false);
    });

    it('should throw error when not running', async () => {
      await expect(server.stop()).rejects.toThrow();
    });

    it('should disconnect all clients', async () => {
      await server.start();

      const mockConnection = {
        write: vi.fn().mockReturnValue(true),
        end: vi.fn(),
        isWritable: vi.fn().mockReturnValue(true),
        setTimeout: vi.fn(),
        onError: vi.fn(),
        onClose: vi.fn(),
      };

      await server.handleConnection(
        {
          method: 'GET',
          url: '/events',
          headers: {},
          query: { channel: 'default' },
        },
        mockConnection,
        mockConnection.write,
        mockConnection.end,
        () => {}
      );

      await server.stop();

      expect(mockConnection.end).toHaveBeenCalled();
    });

    it('should close all channels', async () => {
      await server.start();
      server.createChannel('test1');
      server.createChannel('test2');

      await server.stop();

      // Channel manager should be closed after stop
      expect(server.getAllChannels().length).toBe(0);
    });
  });

  describe('createChannel', () => {
    it('should create a new channel', () => {
      const channel = server.createChannel('test-channel');
      expect(channel).toBeDefined();
      expect(channel.channel_name).toBe('test-channel');
    });

    it('should add channel to server', () => {
      server.createChannel('test');
      expect(server.hasChannel('test')).toBe(true);
    });

    it('should set custom metadata', () => {
      const channel = server.createChannel('test', {
        description: 'Test channel',
        persistent: true,
        max_clients: 50,
      });

      expect(channel.metadata.description).toBe('Test channel');
      expect(channel.metadata.persistent).toBe(true);
      expect(channel.metadata.max_clients).toBe(50);
    });
  });

  describe('deleteChannel', () => {
    it('should delete existing channel', () => {
      server.createChannel('to-delete');
      const deleted = server.deleteChannel('to-delete');

      expect(deleted).toBe(true);
      expect(server.hasChannel('to-delete')).toBe(false);
    });

    it('should return false for non-existent channel', () => {
      const deleted = server.deleteChannel('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('forceDeleteChannel', () => {
    it('should force delete channel', () => {
      const channel = server.createChannel('test');
      channel.clients.add('client1');

      const deleted = server.forceDeleteChannel('test');
      expect(deleted).toBe(true);
      expect(server.hasChannel('test')).toBe(false);
    });
  });

  describe('getChannel', () => {
    it('should return existing channel', () => {
      const created = server.createChannel('test');
      const retrieved = server.getChannel('test');

      expect(retrieved).toBe(created);
    });

    it('should return null for non-existent channel', () => {
      const retrieved = server.getChannel('non-existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('getAllChannels', () => {
    it('should return all channels', () => {
      server.createChannel('ch1');
      server.createChannel('ch2');
      server.createChannel('ch3');

      const channels = server.getAllChannels();
      expect(channels).toHaveLength(3);
    });
  });

  describe('hasChannel', () => {
    it('should return true for existing channel', () => {
      server.createChannel('test');
      expect(server.hasChannel('test')).toBe(true);
    });

    it('should return false for non-existent channel', () => {
      expect(server.hasChannel('non-existent')).toBe(false);
    });
  });

  describe('broadcast', () => {
    it('should broadcast event to channel', async () => {
      await server.start();

      const mockConnection = {
        write: vi.fn().mockReturnValue(true),
        end: vi.fn(),
        isWritable: vi.fn().mockReturnValue(true),
        setTimeout: vi.fn(),
        onError: vi.fn(),
        onClose: vi.fn(),
      };

      const client = await server.handleConnection(
        {
          method: 'GET',
          url: '/events',
          headers: {},
          query: { channel: 'default' },
        },
        mockConnection,
        mockConnection.write,
        () => {},
        () => {}
      );

      const event: SSEEvent = {
        data: 'test broadcast',
      };

      server.broadcast('default', event);

      expect(mockConnection.write).toHaveBeenCalled();
    });

    it('should throw error for non-existent channel', () => {
      const event: SSEEvent = {
        data: 'test',
      };

      expect(() => {
        server.broadcast('non-existent', event);
      }).toThrow();
    });
  });

  describe('sendToClient', () => {
    it('should send event to specific client', async () => {
      await server.start();

      const mockConnection = {
        write: vi.fn().mockReturnValue(true),
        end: vi.fn(),
        isWritable: vi.fn().mockReturnValue(true),
        setTimeout: vi.fn(),
        onError: vi.fn(),
        onClose: vi.fn(),
      };

      const client = await server.handleConnection(
        {
          method: 'GET',
          url: '/events',
          headers: {},
          query: { channel: 'default' },
        },
        mockConnection,
        mockConnection.write,
        () => {},
        () => {}
      );

      const event: SSEEvent = {
        data: 'test message',
      };

      server.sendToClient(client.client_id, event);

      expect(mockConnection.write).toHaveBeenCalled();
    });

    it('should throw error for non-existent client', () => {
      const event: SSEEvent = {
        data: 'test',
      };

      expect(() => {
        server.sendToClient('non-existent', event);
      }).toThrow();
    });
  });

  describe('sendToClients', () => {
    it('should send to multiple clients', async () => {
      await server.start();

      const mockConnection1 = {
        write: vi.fn().mockReturnValue(true),
        end: vi.fn(),
        isWritable: vi.fn().mockReturnValue(true),
        setTimeout: vi.fn(),
        onError: vi.fn(),
        onClose: vi.fn(),
      };

      const mockConnection2 = {
        write: vi.fn().mockReturnValue(true),
        end: vi.fn(),
        isWritable: vi.fn().mockReturnValue(true),
        setTimeout: vi.fn(),
        onError: vi.fn(),
        onClose: vi.fn(),
      };

      const client1 = await server.handleConnection(
        {
          method: 'GET',
          url: '/events',
          headers: {},
          query: { channel: 'default' },
        },
        mockConnection1,
        mockConnection1.write,
        () => {},
        () => {}
      );

      const client2 = await server.handleConnection(
        {
          method: 'GET',
          url: '/events',
          headers: {},
          query: { channel: 'default' },
        },
        mockConnection2,
        mockConnection2.write,
        () => {},
        () => {}
      );

      const event: SSEEvent = {
        data: 'multi-client message',
      };

      const result = server.sendToClients([client1.client_id, client2.client_id], event);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
    });
  });

  describe('getClientCount', () => {
    it('should return client count', async () => {
      await server.start();

      const mockConnection = {
        write: vi.fn().mockReturnValue(true),
        end: vi.fn(),
        isWritable: vi.fn().mockReturnValue(true),
        setTimeout: vi.fn(),
        onError: vi.fn(),
        onClose: vi.fn(),
      };

      await server.handleConnection(
        {
          method: 'GET',
          url: '/events',
          headers: {},
          query: { channel: 'default' },
        },
        mockConnection,
        mockConnection.write,
        () => {},
        () => {}
      );

      await server.handleConnection(
        {
          method: 'GET',
          url: '/events',
          headers: {},
          query: { channel: 'default' },
        },
        mockConnection,
        mockConnection.write,
        () => {},
        () => {}
      );

      expect(server.getClientCount()).toBe(2);
    });
  });

  describe('getClient', () => {
    it('should return client by ID', async () => {
      await server.start();

      const mockConnection = {
        write: vi.fn().mockReturnValue(true),
        end: vi.fn(),
        isWritable: vi.fn().mockReturnValue(true),
        setTimeout: vi.fn(),
        onError: vi.fn(),
        onClose: vi.fn(),
      };

      const client = await server.handleConnection(
        {
          method: 'GET',
          url: '/events',
          headers: {},
          query: { channel: 'default' },
        },
        mockConnection,
        mockConnection.write,
        () => {},
        () => {}
      );

      const retrieved = server.getClient(client.client_id);
      expect(retrieved).toBe(client);
    });

    it('should return null for non-existent client', () => {
      const retrieved = server.getClient('non-existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('getAllClients', () => {
    it('should return all clients', async () => {
      await server.start();

      const mockConnection = {
        write: vi.fn().mockReturnValue(true),
        end: vi.fn(),
        isWritable: vi.fn().mockReturnValue(true),
        setTimeout: vi.fn(),
        onError: vi.fn(),
        onClose: vi.fn(),
      };

      await server.handleConnection(
        {
          method: 'GET',
          url: '/events',
          headers: {},
          query: { channel: 'default' },
        },
        mockConnection,
        mockConnection.write,
        () => {},
        () => {}
      );

      await server.handleConnection(
        {
          method: 'GET',
          url: '/events',
          headers: {},
          query: { channel: 'default' },
        },
        mockConnection,
        mockConnection.write,
        () => {},
        () => {}
      );

      const clients = server.getAllClients();
      expect(clients).toHaveLength(2);
    });
  });

  describe('getChannelStats', () => {
    it('should return channel statistics', () => {
      server.createChannel('test');

      const stats = server.getChannelStats();
      expect(stats).toBeDefined();
      expect(stats['test']).toBeDefined();
    });
  });

  describe('getChannelClientCount', () => {
    it('should return channel client count', () => {
      server.createChannel('test');

      expect(server.getChannelClientCount('test')).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return server statistics', async () => {
      await server.start();

      const stats = server.getStats();

      expect(stats).toBeDefined();
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
      expect(stats.active_connections).toBe(0);
      expect(stats.active_channels).toBeGreaterThan(0);
    });

    it('should track total connections', async () => {
      await server.start();

      const mockConnection = {
        write: vi.fn().mockReturnValue(true),
        end: vi.fn(),
        isWritable: vi.fn().mockReturnValue(true),
        setTimeout: vi.fn(),
        onError: vi.fn(),
        onClose: vi.fn(),
      };

      await server.handleConnection(
        {
          method: 'GET',
          url: '/events',
          headers: {},
          query: { channel: 'default' },
        },
        mockConnection,
        mockConnection.write,
        () => {},
        () => {}
      );

      const stats = server.getStats();
      expect(stats.total_connections).toBeGreaterThan(0);
    });
  });

  describe('getStatus', () => {
    it('should return server status', async () => {
      await server.start();

      const status = server.getStatus();

      expect(status.running).toBe(true);
      expect(status.port).toBe(3000);
      expect(status.host).toBe('localhost');
      expect(status.stats).toBeDefined();
    });

    it('should show not running when stopped', () => {
      const status = server.getStatus();

      expect(status.running).toBe(false);
    });
  });

  describe('subscribe', () => {
    it('should subscribe client to channel', async () => {
      await server.start();
      server.createChannel('test');

      const mockConnection = {
        write: vi.fn().mockReturnValue(true),
        end: vi.fn(),
        isWritable: vi.fn().mockReturnValue(true),
        setTimeout: vi.fn(),
        onError: vi.fn(),
        onClose: vi.fn(),
      };

      const client = await server.handleConnection(
        {
          method: 'GET',
          url: '/events',
          headers: {},
          query: { channel: 'default' },
        },
        mockConnection,
        mockConnection.write,
        () => {},
        () => {}
      );

      const subscribed = server.subscribe(client.client_id, 'test');

      expect(subscribed).toBe(true);
    });

    it('should return false for non-existent client', () => {
      const subscribed = server.subscribe('non-existent', 'test');
      expect(subscribed).toBe(false);
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe client from channel', async () => {
      await server.start();
      server.createChannel('test');

      const mockConnection = {
        write: vi.fn().mockReturnValue(true),
        end: vi.fn(),
        isWritable: vi.fn().mockReturnValue(true),
        setTimeout: vi.fn(),
        onError: vi.fn(),
        onClose: vi.fn(),
      };

      const client = await server.handleConnection(
        {
          method: 'GET',
          url: '/events',
          headers: {},
          query: { channel: 'default' },
        },
        mockConnection,
        mockConnection.write,
        () => {},
        () => {}
      );

      server.subscribe(client.client_id, 'test');
      const unsubscribed = server.unsubscribe(client.client_id, 'test');

      expect(unsubscribed).toBe(true);
    });
  });

  describe('getConfig', () => {
    it('should return configuration', () => {
      const config = server.getConfig();

      expect(config.port).toBe(3000);
      expect(config.host).toBe('localhost');
      expect(config.ping_interval).toBe(30000);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      server.updateConfig({
        port: 8080,
        ping_interval: 60000,
      });

      const config = server.getConfig();
      expect(config.port).toBe(8080);
      expect(config.ping_interval).toBe(60000);
    });
  });

  describe('isRunning', () => {
    it('should return false initially', () => {
      expect(server.isRunning()).toBe(false);
    });

    it('should return true when started', async () => {
      await server.start();
      expect(server.isRunning()).toBe(true);
    });

    it('should return false when stopped', async () => {
      await server.start();
      await server.stop();
      expect(server.isRunning()).toBe(false);
    });
  });
});

describe('createSSEServer', () => {
  it('should create SSE server with config', () => {
    const server = createSSEServer({
      port: 8080,
      host: '0.0.0.0',
    });

    expect(server).toBeDefined();
    const config = server.getConfig();
    expect(config.port).toBe(8080);
    expect(config.host).toBe('0.0.0.0');
  });
});

describe('createDefaultSSEServer', () => {
  it('should create SSE server with default config', () => {
    const server = createDefaultSSEServer();

    expect(server).toBeDefined();
    const config = server.getConfig();
    expect(config.port).toBe(3000);
    expect(config.host).toBe('localhost');
  });
});

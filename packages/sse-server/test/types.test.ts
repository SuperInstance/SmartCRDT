/**
 * Tests for SSE types
 */

import { describe, it, expect } from 'vitest';
import type {
  SSEEvent,
  SSEClient,
  SSEChannel,
  ConnectionState,
  ServerConfig,
  SSEConnection,
  ChannelMetadata,
  EventSerializationFormat,
  SerializedEvent,
  MiddlewareContext,
  SSEMiddleware,
  IncomingRequest,
  AequorStreamEvent,
  CoAgentsStreamEvent,
  A2UIStreamEvent,
  VLJEPATreamEvent,
  IntegrationConfig,
  ServerStats,
  ServerStatus,
} from '../src/types.js';
import {
  DEFAULT_SERVER_CONFIG,
  SSEErrorCode,
  SSEError,
} from '../src/types.js';

describe('SSE Types', () => {
  describe('ConnectionState', () => {
    it('should have valid connection states', () => {
      const states: ConnectionState[] = ['connecting', 'open', 'closed', 'error'];
      expect(states).toHaveLength(4);
      expect(states).toContain('open');
      expect(states).toContain('closed');
    });

    it('should accept valid connection state values', () => {
      const state: ConnectionState = 'open';
      expect(state).toBe('open');
    });
  });

  describe('SSEEvent', () => {
    it('should create valid SSE event', () => {
      const event: SSEEvent = {
        id: '1',
        event: 'message',
        data: { text: 'hello' },
        retry: 5000,
      };
      expect(event.id).toBe('1');
      expect(event.event).toBe('message');
      expect(event.data).toEqual({ text: 'hello' });
      expect(event.retry).toBe(5000);
    });

    it('should create minimal SSE event', () => {
      const event: SSEEvent = {
        data: 'test',
      };
      expect(event.data).toBe('test');
      expect(event.id).toBeUndefined();
      expect(event.event).toBeUndefined();
    });

    it('should accept complex data', () => {
      const event: SSEEvent = {
        data: {
          nested: {
            value: 123,
            array: [1, 2, 3],
          },
        },
      };
      expect(event.data).toEqual({
        nested: {
          value: 123,
          array: [1, 2, 3],
        },
      });
    });
  });

  describe('SSEConnection', () => {
    it('should implement SSEConnection interface', () => {
      const connection: SSEConnection = {
        write: (data: string) => true,
        end: () => {},
        isWritable: () => true,
        setTimeout: (ms: number) => {},
        onError: (error: Error) => {},
        onClose: () => {},
      };
      expect(connection.write('test')).toBe(true);
      expect(connection.isWritable()).toBe(true);
    });

    it('should handle write failure', () => {
      const connection: SSEConnection = {
        write: (data: string) => false,
        end: () => {},
        isWritable: () => false,
        setTimeout: (ms: number) => {},
        onError: (error: Error) => {},
        onClose: () => {},
      };
      expect(connection.write('test')).toBe(false);
      expect(connection.isWritable()).toBe(false);
    });
  });

  describe('SSEClient', () => {
    it('should create valid SSE client', () => {
      const connection: SSEConnection = {
        write: () => true,
        end: () => {},
        isWritable: () => true,
        setTimeout: () => {},
        onError: () => {},
        onClose: () => {},
      };

      const client: SSEClient = {
        client_id: 'client_1',
        connection,
        last_event_id: null,
        headers: {},
        state: 'open',
        subscriptions: new Set(['channel1', 'channel2']),
        connected_at: Date.now(),
        last_activity: Date.now(),
      };

      expect(client.client_id).toBe('client_1');
      expect(client.state).toBe('open');
      expect(client.subscriptions.size).toBe(2);
    });

    it('should handle client with last event ID', () => {
      const connection: SSEConnection = {
        write: () => true,
        end: () => {},
        isWritable: () => true,
        setTimeout: () => {},
        onError: () => {},
        onClose: () => {},
      };

      const client: SSEClient = {
        client_id: 'client_2',
        connection,
        last_event_id: 'event_123',
        headers: { 'last-event-id': 'event_123' },
        state: 'open',
        subscriptions: new Set(),
        connected_at: Date.now(),
        last_activity: Date.now(),
      };

      expect(client.last_event_id).toBe('event_123');
    });
  });

  describe('SSEChannel', () => {
    it('should create valid SSE channel', () => {
      const channel: SSEChannel = {
        channel_name: 'test-channel',
        clients: new Set(['client1', 'client2']),
        last_message_id: 'msg_1',
        created_at: Date.now(),
        metadata: {
          persistent: true,
          max_clients: 100,
          require_auth: false,
        },
        history: [],
        max_history_size: 100,
      };

      expect(channel.channel_name).toBe('test-channel');
      expect(channel.clients.size).toBe(2);
      expect(channel.metadata.persistent).toBe(true);
      expect(channel.metadata.max_clients).toBe(100);
    });

    it('should create ephemeral channel', () => {
      const channel: SSEChannel = {
        channel_name: 'ephemeral',
        clients: new Set(),
        last_message_id: '',
        created_at: Date.now(),
        metadata: {
          persistent: false,
          max_clients: 0,
          require_auth: false,
        },
        history: [],
        max_history_size: 50,
      };

      expect(channel.metadata.persistent).toBe(false);
      expect(channel.metadata.max_clients).toBe(0);
    });

    it('should handle channel with custom attributes', () => {
      const channel: SSEChannel = {
        channel_name: 'custom',
        clients: new Set(),
        last_message_id: '',
        created_at: Date.now(),
        metadata: {
          persistent: true,
          max_clients: 50,
          require_auth: true,
          attributes: {
            description: 'Custom channel',
            owner: 'user1',
          },
        },
        history: [],
        max_history_size: 100,
      };

      expect(channel.metadata.attributes?.description).toBe('Custom channel');
    });
  });

  describe('ChannelMetadata', () => {
    it('should have required fields', () => {
      const metadata: ChannelMetadata = {
        persistent: true,
        max_clients: 100,
        require_auth: false,
      };
      expect(metadata.persistent).toBe(true);
      expect(metadata.max_clients).toBe(100);
      expect(metadata.require_auth).toBe(false);
    });

    it('should allow optional fields', () => {
      const metadata: ChannelMetadata = {
        persistent: false,
        max_clients: 0,
        require_auth: false,
        description: 'Test channel',
        allowed_events: ['message', 'update'],
        attributes: { key: 'value' },
      };
      expect(metadata.description).toBe('Test channel');
      expect(metadata.allowed_events).toEqual(['message', 'update']);
    });
  });

  describe('ServerConfig', () => {
    it('should use default config', () => {
      const config: ServerConfig = DEFAULT_SERVER_CONFIG;
      expect(config.port).toBe(3000);
      expect(config.host).toBe('localhost');
      expect(config.ping_interval).toBe(30000);
      expect(config.retry_timeout).toBe(5000);
      expect(config.max_connections).toBe(1000);
    });

    it('should allow custom config', () => {
      const config: ServerConfig = {
        port: 8080,
        host: '0.0.0.0',
        ping_interval: 60000,
        retry_timeout: 10000,
        max_connections: 500,
        connection_timeout: 120000,
        enable_cors: true,
        cors_origin: 'https://example.com',
        enable_compression: true,
        history_size: 200,
        enable_replay: true,
      };
      expect(config.port).toBe(8080);
      expect(config.host).toBe('0.0.0.0');
      expect(config.ping_interval).toBe(60000);
    });
  });

  describe('EventSerializationFormat', () => {
    it('should have valid formats', () => {
      const formats: EventSerializationFormat[] = ['json', 'text', 'binary', 'raw'];
      expect(formats).toHaveLength(4);
      expect(formats).toContain('json');
      expect(formats).toContain('binary');
    });
  });

  describe('SerializedEvent', () => {
    it('should create serialized event', () => {
      const event: SerializedEvent = {
        raw: 'data: test\n\n',
        id: '1',
        event: 'message',
        retry: 5000,
      };
      expect(event.raw).toBe('data: test\n\n');
      expect(event.id).toBe('1');
    });
  });

  describe('MiddlewareContext', () => {
    it('should create middleware context', () => {
      const req: IncomingRequest = {
        method: 'GET',
        url: '/events',
        headers: {},
        query: { channel: 'test' },
      };

      const res: SSEConnection = {
        write: () => true,
        end: () => {},
        isWritable: () => true,
        setTimeout: () => {},
        onError: () => {},
        onClose: () => {},
      };

      const ctx: MiddlewareContext = {
        req,
        res,
        clientId: 'client_1',
        channel: 'test',
        metadata: new Map([['key', 'value']]),
      };

      expect(ctx.clientId).toBe('client_1');
      expect(ctx.channel).toBe('test');
      expect(ctx.metadata.get('key')).toBe('value');
    });
  });

  describe('SSEMiddleware', () => {
    it('should implement middleware interface', async () => {
      const middleware: SSEMiddleware = {
        name: 'test',
        priority: 50,
        execute: async (ctx, next) => {
          await next();
        },
      };

      expect(middleware.name).toBe('test');
      expect(middleware.priority).toBe(50);
    });
  });

  describe('Integration types', () => {
    it('should create Aequor stream event', () => {
      const event: AequorStreamEvent = {
        event: 'aequor-response',
        data: {
          content: 'Hello world',
          backend: 'local',
          model: 'llama2',
          is_final: true,
          chunk_index: 0,
          total_chunks: 1,
        },
      };
      expect(event.event).toBe('aequor-response');
      expect(event.data.content).toBe('Hello world');
    });

    it('should create CoAgents stream event', () => {
      const event: CoAgentsStreamEvent = {
        event: 'coagents-state',
        data: {
          agent_id: 'agent_1',
          state: { thinking: true },
          status: 'thinking',
          progress: 0.5,
          timestamp: Date.now(),
        },
      };
      expect(event.event).toBe('coagents-state');
      expect(event.data.status).toBe('thinking');
    });

    it('should create A2UI stream event', () => {
      const event: A2UIStreamEvent = {
        event: 'a2ui-update',
        data: {
          type: 'create',
          component: {
            type: 'Button',
            props: { label: 'Click me' },
          },
          priority: 'high',
        },
      };
      expect(event.event).toBe('a2ui-update');
      expect(event.data.type).toBe('create');
    });

    it('should create VL-JEPA stream event', () => {
      const embedding = new Array(768).fill(0.1);
      const event: VLJEPATreamEvent = {
        event: 'vljepa-embedding',
        data: {
          type: 'vision',
          embedding,
          confidence: 0.95,
          processing_time_ms: 50,
        },
      };
      expect(event.event).toBe('vljepa-embedding');
      expect(event.data.type).toBe('vision');
      expect(event.data.embedding).toHaveLength(768);
    });
  });

  describe('IntegrationConfig', () => {
    it('should create integration config', () => {
      const config: IntegrationConfig = {
        enable_aequor: true,
        enable_coagents: true,
        enable_a2ui: true,
        enable_vljepa: true,
        channels: {
          aequor: 'aequor',
          coagents: 'coagents',
          a2ui: 'a2ui',
          vljepa: 'vljepa',
        },
      };
      expect(config.enable_aequor).toBe(true);
      expect(config.channels.aequor).toBe('aequor');
    });
  });

  describe('SSEErrorCode', () => {
    it('should have all error codes', () => {
      expect(SSEErrorCode.SERVER_START_FAILED).toBe('SERVER_START_FAILED');
      expect(SSEErrorCode.CHANNEL_NOT_FOUND).toBe('CHANNEL_NOT_FOUND');
      expect(SSEErrorCode.CHANNEL_EXISTS).toBe('CHANNEL_EXISTS');
      expect(SSEErrorCode.CLIENT_NOT_FOUND).toBe('CLIENT_NOT_FOUND');
      expect(SSEErrorCode.CONNECTION_LIMIT).toBe('CONNECTION_LIMIT');
      expect(SSEErrorCode.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('SSEError', () => {
    it('should create SSE error', () => {
      const error = new SSEError(
        SSEErrorCode.CHANNEL_NOT_FOUND,
        'Channel not found'
      );
      expect(error.code).toBe(SSEErrorCode.CHANNEL_NOT_FOUND);
      expect(error.message).toBe('Channel not found');
      expect(error.name).toBe('SSEError');
    });

    it('should include error details', () => {
      const error = new SSEError(
        SSEErrorCode.CONNECTION_LIMIT,
        'Too many connections',
        { limit: 100 }
      );
      expect(error.details).toEqual({ limit: 100 });
    });
  });

  describe('ServerStats', () => {
    it('should create server stats', () => {
      const stats: ServerStats = {
        uptime: 100,
        total_connections: 50,
        active_connections: 10,
        total_channels: 5,
        active_channels: 3,
        total_events: 1000,
        events_per_second: 10,
        total_bytes: 50000,
        bytes_per_second: 500,
        avg_latency_ms: 50,
        error_count: 2,
        channel_stats: {
          channel1: {
            channel: 'channel1',
            clients: 5,
            messages_sent: 100,
            messages_per_second: 1,
            avg_message_size: 200,
            uptime: 50,
          },
        },
      };
      expect(stats.active_connections).toBe(10);
      expect(stats.channel_stats.channel1.clients).toBe(5);
    });
  });

  describe('ServerStatus', () => {
    it('should create server status', () => {
      const stats: ServerStats = {
        uptime: 100,
        total_connections: 50,
        active_connections: 10,
        total_channels: 5,
        active_channels: 3,
        total_events: 1000,
        events_per_second: 10,
        total_bytes: 50000,
        bytes_per_second: 500,
        avg_latency_ms: 50,
        error_count: 0,
        channel_stats: {},
      };

      const status: ServerStatus = {
        running: true,
        port: 3000,
        host: 'localhost',
        stats,
      };

      expect(status.running).toBe(true);
      expect(status.port).toBe(3000);
    });
  });
});

/**
 * Tests for SSE Integration layer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AequorStreamer,
  CoAgentsStreamer,
  A2UIStreamer,
  VLJEPATreamer,
  SSEIntegration,
  createSSEIntegration,
} from '../src/integration.js';
import { SSEServer } from '../src/SSEServer.js';
import type { AequorResponse, SSEConnection } from '../src/types.js';

describe('AequorStreamer', () => {
  let server: SSEServer;
  let streamer: AequorStreamer;
  let mockConnection: SSEConnection;

  beforeEach(async () => {
    server = new SSEServer({ port: 3000 });
    await server.start();

    mockConnection = {
      write: vi.fn().mockReturnValue(true),
      end: vi.fn(),
      isWritable: vi.fn().mockReturnValue(true),
      setTimeout: vi.fn(),
      onError: vi.fn(),
      onClose: vi.fn(),
    };

    streamer = new AequorStreamer({
      server,
      channel: 'aequor',
      enable_streaming: true,
      chunk_size: 10,
    });
  });

  it('should create aequor channel', () => {
    expect(server.hasChannel('aequor')).toBe(true);
  });

  it('should stream response progressively', async () => {
    const client = await server.handleConnection(
      {
        method: 'GET',
        url: '/events',
        headers: {},
        query: { channel: 'aequor' },
      },
      mockConnection,
      mockConnection.write,
      () => {},
      () => {}
    );

    const response: AequorResponse = {
      content: 'This is a test response that will be chunked',
      backend: 'local',
      model: 'llama2',
      metadata: {},
    };

    await streamer.streamResponse(client.client_id, response);

    expect(mockConnection.write).toHaveBeenCalled();
  });

  it('should broadcast response to channel', async () => {
    const response: AequorResponse = {
      content: 'Broadcast message',
      backend: 'cloud',
      model: 'gpt-4',
      metadata: {},
    };

    await streamer.broadcastResponse(response);

    // Should not throw
    expect(() => streamer.broadcastResponse(response)).not.toThrow();
  });

  it('should stream error', async () => {
    const client = await server.handleConnection(
      {
        method: 'GET',
        url: '/events',
        headers: {},
        query: { channel: 'aequor' },
      },
      mockConnection,
      mockConnection.write,
      () => {},
      () => {}
    );

    streamer.streamError(client.client_id, new Error('Test error'));

    expect(mockConnection.write).toHaveBeenCalled();
  });

  it('should handle streaming disabled', () => {
    const disabledStreamer = new AequorStreamer({
      server,
      channel: 'aequor-off',
      enable_streaming: false,
      chunk_size: 10,
    });

    expect(disabledStreamer).toBeDefined();
  });
});

describe('CoAgentsStreamer', () => {
  let server: SSEServer;
  let streamer: CoAgentsStreamer;
  let mockConnection: SSEConnection;

  beforeEach(async () => {
    server = new SSEServer({ port: 3001 });
    await server.start();

    mockConnection = {
      write: vi.fn().mockReturnValue(true),
      end: vi.fn(),
      isWritable: vi.fn().mockReturnValue(true),
      setTimeout: vi.fn(),
      onError: vi.fn(),
      onClose: vi.fn(),
    };

    streamer = new CoAgentsStreamer({
      server,
      channel: 'coagents',
      enable_state_streaming: true,
    });
  });

  it('should create coagents channel', () => {
    expect(server.hasChannel('coagents')).toBe(true);
  });

  it('should stream agent state', async () => {
    await server.handleConnection(
      {
        method: 'GET',
        url: '/events',
        headers: {},
        query: { channel: 'coagents' },
      },
      mockConnection,
      mockConnection.write,
      () => {},
      () => {}
    );

    streamer.streamAgentState('agent1', { thinking: true }, 'thinking', 0.5);

    expect(mockConnection.write).toHaveBeenCalled();
  });

  it('should stream thinking state', async () => {
    await server.handleConnection(
      {
        method: 'GET',
        url: '/events',
        headers: {},
        query: { channel: 'coagents' },
      },
      mockConnection,
      mockConnection.write,
      () => {},
      () => {}
    );

    streamer.streamThinking('agent1', 'What is the meaning of life?');

    expect(mockConnection.write).toHaveBeenCalled();
  });

  it('should stream action', async () => {
    await server.handleConnection(
      {
        method: 'GET',
        url: '/events',
        headers: {},
        query: { channel: 'coagents' },
      },
      mockConnection,
      mockConnection.write,
      () => {},
      () => {}
    );

    streamer.streamAction('agent1', 'search', { query: 'test' });

    expect(mockConnection.write).toHaveBeenCalled();
  });

  it('should stream error', async () => {
    await server.handleConnection(
      {
        method: 'GET',
        url: '/events',
        headers: {},
        query: { channel: 'coagents' },
      },
      mockConnection,
      mockConnection.write,
      () => {},
      () => {}
    );

    streamer.streamError('agent1', new Error('Agent error'));

    expect(mockConnection.write).toHaveBeenCalled();
  });

  it('should stream completion', async () => {
    await server.handleConnection(
      {
        method: 'GET',
        url: '/events',
        headers: {},
        query: { channel: 'coagents' },
      },
      mockConnection,
      mockConnection.write,
      () => {},
      () => {}
    );

    streamer.streamCompletion('agent1', { result: 'success' });

    expect(mockConnection.write).toHaveBeenCalled();
  });
});

describe('A2UIStreamer', () => {
  let server: SSEServer;
  let streamer: A2UIStreamer;
  let mockConnection: SSEConnection;

  beforeEach(async () => {
    server = new SSEServer({ port: 3002 });
    await server.start();

    mockConnection = {
      write: vi.fn().mockReturnValue(true),
      end: vi.fn(),
      isWritable: vi.fn().mockReturnValue(true),
      setTimeout: vi.fn(),
      onError: vi.fn(),
      onClose: vi.fn(),
    };

    streamer = new A2UIStreamer({
      server,
      channel: 'a2ui',
      enable_progressive: true,
    });
  });

  it('should create a2ui channel', () => {
    expect(server.hasChannel('a2ui')).toBe(true);
  });

  it('should stream component creation', async () => {
    await server.handleConnection(
      {
        method: 'GET',
        url: '/events',
        headers: {},
        query: { channel: 'a2ui' },
      },
      mockConnection,
      mockConnection.write,
      () => {},
      () => {}
    );

    streamer.streamCreate('Button', { label: 'Click me', variant: 'primary' });

    expect(mockConnection.write).toHaveBeenCalled();
  });

  it('should stream component update', async () => {
    await server.handleConnection(
      {
        method: 'GET',
        url: '/events',
        headers: {},
        query: { channel: 'a2ui' },
      },
      mockConnection,
      mockConnection.write,
      () => {},
      () => {}
    );

    streamer.streamUpdate('btn_123', { label: 'Updated label' });

    expect(mockConnection.write).toHaveBeenCalled();
  });

  it('should stream component deletion', async () => {
    await server.handleConnection(
      {
        method: 'GET',
        url: '/events',
        headers: {},
        query: { channel: 'a2ui' },
      },
      mockConnection,
      mockConnection.write,
      () => {},
      () => {}
    );

    streamer.streamDelete('btn_123');

    expect(mockConnection.write).toHaveBeenCalled();
  });

  it('should stream layout update', async () => {
    await server.handleConnection(
      {
        method: 'GET',
        url: '/events',
        headers: {},
        query: { channel: 'a2ui' },
      },
      mockConnection,
      mockConnection.write,
      () => {},
      () => {}
    );

    streamer.streamLayout('Flex', { direction: 'row', gap: 4 });

    expect(mockConnection.write).toHaveBeenCalled();
  });

  it('should respect priority levels', async () => {
    await server.handleConnection(
      {
        method: 'GET',
        url: '/events',
        headers: {},
        query: { channel: 'a2ui' },
      },
      mockConnection,
      mockConnection.write,
      () => {},
      () => {}
    );

    streamer.streamCreate('Button', {}, 'critical');

    expect(mockConnection.write).toHaveBeenCalled();
  });
});

describe('VLJEPATreamer', () => {
  let server: SSEServer;
  let streamer: VLJEPATreamer;
  let mockConnection: SSEConnection;

  beforeEach(async () => {
    server = new SSEServer({ port: 3003 });
    await server.start();

    mockConnection = {
      write: vi.fn().mockReturnValue(true),
      end: vi.fn(),
      isWritable: vi.fn().mockReturnValue(true),
      setTimeout: vi.fn(),
      onError: vi.fn(),
      onClose: vi.fn(),
    };

    streamer = new VLJEPATreamer({
      server,
      channel: 'vljepa',
      enable_embedding_stream: true,
    });
  });

  it('should create vljepa channel', () => {
    expect(server.hasChannel('vljepa')).toBe(true);
  });

  it('should stream vision embedding', async () => {
    await server.handleConnection(
      {
        method: 'GET',
        url: '/events',
        headers: {},
        query: { channel: 'vljepa' },
      },
      mockConnection,
      mockConnection.write,
      () => {},
      () => {}
    );

    const embedding = new Array(768).fill(0.1);

    streamer.streamVisionEmbedding(embedding, 0.95, 50, {
      input_shape: [224, 224, 3],
      model_version: '1.0',
      gpu_enabled: true,
    });

    expect(mockConnection.write).toHaveBeenCalled();
  });

  it('should stream language embedding', async () => {
    await server.handleConnection(
      {
        method: 'GET',
        url: '/events',
        headers: {},
        query: { channel: 'vljepa' },
      },
      mockConnection,
      mockConnection.write,
      () => {},
      () => {}
    );

    const embedding = new Array(768).fill(0.2);

    streamer.streamLanguageEmbedding(embedding, 0.88, 30);

    expect(mockConnection.write).toHaveBeenCalled();
  });

  it('should stream prediction embedding', async () => {
    await server.handleConnection(
      {
        method: 'GET',
        url: '/events',
        headers: {},
        query: { channel: 'vljepa' },
      },
      mockConnection,
      mockConnection.write,
      () => {},
      () => {}
    );

    const embedding = new Array(768).fill(0.3);

    streamer.streamPredictionEmbedding(embedding, 0.92, 40);

    expect(mockConnection.write).toHaveBeenCalled();
  });

  it('should handle 768-dim embeddings', async () => {
    await server.handleConnection(
      {
        method: 'GET',
        url: '/events',
        headers: {},
        query: { channel: 'vljepa' },
      },
      mockConnection,
      mockConnection.write,
      () => {},
      () => {}
    );

    const embedding = new Array(768).fill(0).map((_, i) => i / 768);

    streamer.streamVisionEmbedding(embedding, 0.9, 50);

    expect(mockConnection.write).toHaveBeenCalled();
  });
});

describe('SSEIntegration', () => {
  let server: SSEServer;
  let integration: SSEIntegration;

  beforeEach(async () => {
    server = new SSEServer({ port: 3004 });
    await server.start();

    integration = new SSEIntegration({
      server,
      config: {
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
      },
    });
  });

  it('should create all integration channels', () => {
    expect(server.hasChannel('aequor')).toBe(true);
    expect(server.hasChannel('coagents')).toBe(true);
    expect(server.hasChannel('a2ui')).toBe(true);
    expect(server.hasChannel('vljepa')).toBe(true);
  });

  it('should provide Aequor streamer', () => {
    const aequor = integration.getAequor();
    expect(aequor).toBeInstanceOf(AequorStreamer);
  });

  it('should provide CoAgents streamer', () => {
    const coagents = integration.getCoAgents();
    expect(coagents).toBeInstanceOf(CoAgentsStreamer);
  });

  it('should provide A2UI streamer', () => {
    const a2ui = integration.getA2UI();
    expect(a2ui).toBeInstanceOf(A2UIStreamer);
  });

  it('should provide VL-JEPA streamer', () => {
    const vljepa = integration.getVLJEPA();
    expect(vljepa).toBeInstanceOf(VLJEPATreamer);
  });

  it('should return configuration', () => {
    const config = integration.getConfig();

    expect(config.enable_aequor).toBe(true);
    expect(config.enable_coagents).toBe(true);
    expect(config.enable_a2ui).toBe(true);
    expect(config.enable_vljepa).toBe(true);
    expect(config.channels.aequor).toBe('aequor');
  });

  it('should support selective integration', () => {
    const selectiveIntegration = new SSEIntegration({
      server,
      config: {
        enable_aequor: true,
        enable_coagents: false,
        enable_a2ui: true,
        enable_vljepa: false,
        channels: {
          aequor: 'aequor',
          coagents: 'coagents',
          a2ui: 'a2ui',
          vljepa: 'vljepa',
        },
      },
    });

    const config = selectiveIntegration.getConfig();
    expect(config.enable_aequor).toBe(true);
    expect(config.enable_coagents).toBe(false);
    expect(config.enable_a2ui).toBe(true);
    expect(config.enable_vljepa).toBe(false);
  });
});

describe('createSSEIntegration', () => {
  it('should create SSE integration', async () => {
    const server = new SSEServer({ port: 3005 });
    await server.start();

    const integration = createSSEIntegration(server, {
      enable_aequor: true,
      enable_coagents: false,
      enable_a2ui: false,
      enable_vljepa: false,
    });

    expect(integration).toBeInstanceOf(SSEIntegration);
    expect(server.hasChannel('aequor')).toBe(true);
  });

  it('should use default channels', async () => {
    const server = new SSEServer({ port: 3006 });
    await server.start();

    const integration = createSSEIntegration(server);

    const config = integration.getConfig();
    expect(config.channels.aequor).toBe('aequor');
    expect(config.channels.coagents).toBe('coagents');
    expect(config.channels.a2ui).toBe('a2ui');
    expect(config.channels.vljepa).toBe('vljepa');
  });
});

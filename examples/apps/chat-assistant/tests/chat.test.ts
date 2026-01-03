/**
 * Tests for Chat Assistant
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatService } from '../src/chat.js';
import { CascadeRouter } from '@lsi/cascade';
import { SemanticCache } from '@lsi/cascade';
import { RAGPipeline } from '../src/rag.js';
import { ChatAssistantConfig } from '../src/config.js';

describe('ChatService', () => {
  let chatService: ChatService;
  let mockRouter: CascadeRouter;
  let mockCache: SemanticCache;
  let mockRAG: RAGPipeline;
  let config: ChatAssistantConfig;

  beforeEach(() => {
    // Mock config
    config = {
      model: 'llama3.2',
      temperature: 0.7,
      max_tokens: 2000,
      cache_enabled: true,
      cache_ttl: 3600,
      rag_enabled: true,
      knowledge_base_path: './knowledge',
      privacy_enabled: false,
      context_window: 10,
      router: {
        complexity_threshold: 0.7,
        local_model: 'llama3.2',
        cloud_model: 'gpt-4',
      },
      cache: {
        size_mb: 100,
        similarity_threshold: 0.9,
        ttl_seconds: 3600,
      },
      embeddings: {
        model: 'text-embedding-3-small',
        dimensions: 1536,
        batch_size: 100,
      },
      rag: {
        chunk_size: 512,
        chunk_overlap: 50,
        top_k: 5,
      },
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
    };

    // Create mock instances
    mockRouter = {
      route: vi.fn().mockResolvedValue({
        model: 'llama3.2',
        confidence: 0.85,
        backend: 'local',
      }),
    } as unknown as CascadeRouter;

    mockCache = {} as SemanticCache;
    mockRAG = {
      retrieve: vi.fn().mockResolvedValue({
        chunks: [],
        scores: [],
        context: '',
      }),
    } as unknown as RAGPipeline;

    chatService = new ChatService(mockRouter, mockCache, config, mockRAG);
  });

  describe('chat()', () => {
    it('should process a simple chat message', async () => {
      const response = await chatService.chat('Hello!');

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(response.model).toBe('llama3.2');
      expect(response.latency).toBeGreaterThan(0);
    });

    it('should maintain conversation history', async () => {
      await chatService.chat('First message');
      await chatService.chat('Second message');

      const history = chatService.getHistory();
      expect(history).toHaveLength(4); // 2 user + 2 assistant
    });

    it('should respect context window limit', async () => {
      const smallConfig = { ...config, context_window: 2 };

      const smallChatService = new ChatService(
        mockRouter,
        mockCache,
        smallConfig,
        mockRAG
      );

      // Send 5 messages
      for (let i = 0; i < 5; i++) {
        await smallChatService.chat(`Message ${i}`);
      }

      const history = smallChatService.getHistory();
      // Should trim to context_window * 2 (user+assistant) * 2 (buffer)
      expect(history.length).toBeLessThanOrEqual(8);
    });

    it('should clear history when requested', async () => {
      await chatService.chat('Test message');
      chatService.clearHistory();

      const history = chatService.getHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('getHistory()', () => {
    it('should return copy of history', async () => {
      await chatService.chat('Test');

      const history1 = chatService.getHistory();
      const history2 = chatService.getHistory();

      expect(history1).toEqual(history2);
      expect(history1).not.toBe(history2); // Different references
    });
  });

  describe('chatStream()', () => {
    it('should stream response chunks', async () => {
      const chunks: string[] = [];

      for await (const chunk of chatService.chatStream('Hello')) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});

describe('RAGPipeline', () => {
  let rag: RAGPipeline;
  let mockVectorDB: any;

  beforeEach(() => {
    mockVectorDB = {
      upsertBatch: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({
        matches: [
          {
            id: 'chunk_1',
            score: 0.95,
            metadata: {
              chunk_content: 'Test content 1',
            },
          },
        ],
      }),
    };

    rag = new RAGPipeline(mockVectorDB, 512, 50, 5);
  });

  describe('chunkDocument()', () => {
    it('should split document into chunks', () => {
      const text = 'word '.repeat(1000); // 1000 words
      const chunks = (rag as any).chunkDocument(text);

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].content.split(/\s+/).length).toBeLessThanOrEqual(512);
    });

    it('should add overlap between chunks', () => {
      const text = 'word '.repeat(1000);
      const chunks = (rag as any).chunkDocument(text);

      if (chunks.length > 1) {
        const firstChunk = chunks[0].content;
        const secondChunk = chunks[1].content;

        // Check for overlap
        const firstWords = firstChunk.split(/\s+/);
        const secondWords = secondChunk.split(/\s+/);

        // Some words from first chunk should appear in second
        const overlap = firstWords.filter((w: string) => secondWords.includes(w));
        expect(overlap.length).toBeGreaterThan(0);
      }
    });
  });

  describe('indexDocument()', () => {
    it('should index a document', async () => {
      await rag.indexDocument('doc1', 'Test content', { source: 'test' });

      expect(mockVectorDB.upsertBatch).toHaveBeenCalled();
    });
  });

  describe('retrieve()', () => {
    it('should retrieve relevant chunks', async () => {
      const result = await rag.retrieve('Test query');

      expect(result.chunks).toBeDefined();
      expect(result.scores).toBeDefined();
      expect(result.context).toBeDefined();
    });
  });

  describe('updateConfig()', () => {
    it('should update configuration', () => {
      rag.updateConfig({ chunkSize: 1024, topK: 10 });

      expect((rag as any).chunkSize).toBe(1024);
      expect((rag as any).topK).toBe(10);
    });
  });
});

describe('ConfigManager', () => {
  it.todo('should load config from file');
  it.todo('should override with environment variables');
  it.todo('should validate config values');
  it.todo('should save config to file');
});

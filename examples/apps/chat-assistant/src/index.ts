/**
 * Chat Assistant App - Main Entry Point
 *
 * RAG-powered AI chat assistant with semantic caching and context management
 */

import express from 'express';
import { SuperInstance } from '@lsi/superinstance';
import { CascadeRouter } from '@lsi/cascade';
import { SemanticCache } from '@lsi/cascade';
import { ConfigManager, ChatAssistantConfig } from './config.js';
import { ChatService } from './chat.js';
import { RAGPipeline } from './rag.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export class ChatAssistantApp {
  private config: ConfigManager;
  private superinstance: SuperInstance;
  private router: CascadeRouter;
  private cache: SemanticCache;
  private chatService: ChatService;
  private rag?: RAGPipeline;
  private app: express.Application;
  private server?: ReturnType<typeof app.listen>;

  constructor(configPath?: string) {
    this.config = new ConfigManager(configPath);
    this.app = express();
    this.setupMiddleware();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  async initialize(): Promise<void> {
    console.log('Initializing Chat Assistant...');

    // Load configuration
    await this.config.load();
    const config = this.config.get();

    // Initialize SuperInstance
    this.superinstance = new SuperInstance(config);
    await this.superinstance.initialize();

    // Initialize components
    this.router = new CascadeRouter(config.router);
    this.cache = new SemanticCache(config.cache);

    // Initialize RAG if enabled
    if (config.rag_enabled) {
      // Note: In production, you'd use a real vector DB adapter
      // this.rag = new RAGPipeline(vectorDB, ...);
      console.log('RAG pipeline enabled (placeholder)');
    }

    // Initialize chat service
    this.chatService = new ChatService(
      this.router,
      this.cache,
      config,
      this.rag
    );

    // Setup routes
    this.setupRoutes();

    console.log('Chat Assistant initialized successfully');
  }

  private setupRoutes(): void {
    const config = this.config.get();

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: Date.now(),
        version: '1.0.0',
      });
    });

    // Chat endpoint
    this.app.post('/api/chat', async (req, res) => {
      try {
        const { message } = req.body;

        if (!message || typeof message !== 'string') {
          return res.status(400).json({
            error: 'Invalid message. Expected string.',
          });
        }

        const response = await this.chatService.chat(message);

        res.json({
          success: true,
          response: response.content,
          metadata: {
            from_cache: response.fromCache,
            rag_used: response.ragUsed,
            model: response.model,
            latency_ms: response.latency,
            confidence: response.confidence,
          },
        });
      } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Stream chat endpoint
    this.app.post('/api/chat/stream', async (req, res) => {
      try {
        const { message } = req.body;

        if (!message || typeof message !== 'string') {
          return res.status(400).json({
            error: 'Invalid message. Expected string.',
          });
        }

        // Set headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Stream response
        for await (const chunk of this.chatService.chatStream(message)) {
          res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        }

        res.write('data: [DONE]\n\n');
        res.end();
      } catch (error) {
        console.error('Stream chat error:', error);
        res.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
        res.end();
      }
    });

    // History endpoint
    this.app.get('/api/history', (req, res) => {
      const history = this.chatService.getHistory();
      res.json({
        success: true,
        history,
        count: history.length,
      });
    });

    // Clear history endpoint
    this.app.post('/api/history/clear', (req, res) => {
      this.chatService.clearHistory();
      res.json({
        success: true,
        message: 'Conversation history cleared',
      });
    });

    // Config endpoint
    this.app.get('/api/config', (req, res) => {
      const config = this.config.get();
      // Don't expose sensitive information
      const safeConfig = {
        model: config.model,
        temperature: config.temperature,
        max_tokens: config.max_tokens,
        cache_enabled: config.cache_enabled,
        rag_enabled: config.rag_enabled,
        context_window: config.context_window,
      };
      res.json(safeConfig);
    });

    // Update config endpoint
    this.app.put('/api/config', (req, res) => {
      try {
        const updates = req.body;

        // Apply safe updates only
        const allowedUpdates = [
          'temperature',
          'max_tokens',
          'cache_enabled',
          'rag_enabled',
          'context_window',
        ];

        for (const key of allowedUpdates) {
          if (key in updates) {
            this.config.set(key as keyof ChatAssistantConfig, updates[key]);
          }
        }

        res.json({
          success: true,
          message: 'Configuration updated',
        });
      } catch (error) {
        console.error('Config update error:', error);
        res.status(500).json({
          error: 'Failed to update configuration',
        });
      }
    });
  }

  async start(): Promise<void> {
    const config = this.config.get();

    return new Promise((resolve) => {
      this.server = this.app.listen(config.server.port, config.server.host, () => {
        console.log(`Chat Assistant server listening on http://${config.server.host}:${config.server.port}`);
        console.log(`Health check: http://${config.server.host}:${config.server.port}/health`);
        console.log(`API endpoint: http://${config.server.host}:${config.server.port}/api/chat`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          console.log('Chat Assistant server stopped');
          resolve();
        });
      });
    }
  }
}

// Main entry point
async function main() {
  const app = new ChatAssistantApp();

  try {
    await app.initialize();
    await app.start();

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM, shutting down gracefully...');
      await app.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('Received SIGINT, shutting down gracefully...');
      await app.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start Chat Assistant:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { ChatService, RAGPipeline, ConfigManager };
export type { ChatMessage, ChatResponse } from './chat.js';
export type { DocumentChunk, RAGResult } from './rag.js';
export type { ChatAssistantConfig } from './config.js';

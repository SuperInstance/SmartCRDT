/**
 * Adapter Interface Type Tests
 *
 * Tests for ModelAdapter, ModelAdapterResponse, and AdapterCapabilities interfaces.
 * These are type-only tests to ensure TypeScript interfaces are properly defined.
 */

import { describe, it, expect } from 'vitest';
import {
  type ModelAdapter,
  type ModelAdapterResponse,
  type AdapterCapabilities,
} from '../index.js';

describe('ModelAdapter Interface', () => {
  it('should accept valid ModelAdapter structure', () => {
    // This is a compile-time type check
    const capabilities: AdapterCapabilities = {
      maxInputTokens: 4096,
      maxOutputTokens: 2048,
      supportedIntents: ['query', 'conversation'],
      supportsStreaming: true,
      costPer1KTokens: 0.001,
      averageLatency: 100,
      quality: 0.9,
    };

    const adapter: ModelAdapter = {
      id: 'ollama-llama3.2',
      model: 'llama3.2',
      backend: 'local',
      async query(query: string, options?: Record<string, unknown>) {
        return {
          content: `Response to: ${query}`,
          confidence: 0.9,
          latency: 100,
          metadata: options,
        };
      },
      async isAvailable() {
        return true;
      },
      getCapabilities() {
        return capabilities;
      },
    };

    expect(adapter.id).toBe('ollama-llama3.2');
    expect(adapter.backend).toBe('local');
  });

  it('should accept cloud backend type', () => {
    const adapter: Partial<ModelAdapter> = {
      id: 'openai-gpt4',
      model: 'gpt-4',
      backend: 'cloud',
    };

    expect(adapter.backend).toBe('cloud');
  });

  it('should accept hybrid backend type (if extended)', () => {
    // Note: Current interface only allows 'local' | 'cloud'
    // This test documents the current constraint
    const backendLocal: 'local' | 'cloud' = 'local';
    const backendCloud: 'local' | 'cloud' = 'cloud';

    expect(backendLocal).toBeDefined();
    expect(backendCloud).toBeDefined();
  });

  it('should require query method to return Promise<ModelAdapterResponse>', async () => {
    // Type check: verify async method signature
    const mockQuery = async (query: string, options?: Record<string, unknown>): Promise<ModelAdapterResponse> => {
      return {
        content: 'Mock response',
        confidence: 0.8,
        latency: 50,
      };
    };

    const response = await mockQuery('test');
    expect(response).toHaveProperty('content');
  });

  it('should require isAvailable method to return Promise<boolean>', async () => {
    const mockIsAvailable = async (): Promise<boolean> => {
      return true;
    };

    const result = await mockIsAvailable();
    expect(result).toBe(true);
  });

  it('should require getCapabilities method to return AdapterCapabilities', () => {
    const mockGetCapabilities = (): AdapterCapabilities => {
      return {
        maxInputTokens: 8192,
        maxOutputTokens: 4096,
        supportedIntents: ['query', 'conversation', 'code-generation'],
        supportsStreaming: false,
        costPer1KTokens: 0.002,
        averageLatency: 150,
        quality: 0.95,
      };
    };

    const caps = mockGetCapabilities();
    expect(caps.maxInputTokens).toBe(8192);
    expect(caps.supportsStreaming).toBe(false);
  });
});

describe('ModelAdapterResponse Interface', () => {
  it('should accept valid response with all required fields', () => {
    const response: ModelAdapterResponse = {
      content: 'Generated response text',
      confidence: 0.92,
      latency: 125,
    };

    expect(response.content).toBe('Generated response text');
    expect(response.confidence).toBe(0.92);
    expect(response.latency).toBe(125);
  });

  it('should accept response with optional tokensUsed', () => {
    const response: ModelAdapterResponse = {
      content: 'Response',
      confidence: 0.9,
      latency: 100,
      tokensUsed: 42,
    };

    expect(response.tokensUsed).toBe(42);
  });

  it('should accept response with optional metadata', () => {
    const response: ModelAdapterResponse = {
      content: 'Response',
      confidence: 0.9,
      latency: 100,
      metadata: {
        model: 'llama3.2',
        temperature: 0.7,
        topP: 0.9,
      },
    };

    expect(response.metadata).toBeDefined();
    expect(response.metadata?.model).toBe('llama3.2');
  });

  it('should accept response with all optional fields', () => {
    const response: ModelAdapterResponse = {
      content: 'Full response',
      confidence: 0.95,
      latency: 150,
      tokensUsed: 100,
      metadata: {
        timestamp: Date.now(),
        backend: 'local',
      },
    };

    expect(response.tokensUsed).toBeDefined();
    expect(response.metadata).toBeDefined();
  });

  it('should accept minimum confidence (0)', () => {
    const response: ModelAdapterResponse = {
      content: 'Low confidence response',
      confidence: 0,
      latency: 100,
    };

    expect(response.confidence).toBe(0);
  });

  it('should accept maximum confidence (1)', () => {
    const response: ModelAdapterResponse = {
      content: 'High confidence response',
      confidence: 1,
      latency: 100,
    };

    expect(response.confidence).toBe(1);
  });

  it('should accept zero latency', () => {
    const response: ModelAdapterResponse = {
      content: 'Instant response',
      confidence: 0.9,
      latency: 0,
    };

    expect(response.latency).toBe(0);
  });

  it('should accept empty content string', () => {
    const response: ModelAdapterResponse = {
      content: '',
      confidence: 0.5,
      latency: 100,
    };

    expect(response.content).toBe('');
  });

  it('should accept very long content', () => {
    const longContent = 'a'.repeat(10000);
    const response: ModelAdapterResponse = {
      content: longContent,
      confidence: 0.9,
      latency: 500,
    };

    expect(response.content.length).toBe(10000);
  });

  it('should accept complex metadata object', () => {
    const response: ModelAdapterResponse = {
      content: 'Response with complex metadata',
      confidence: 0.88,
      latency: 200,
      metadata: {
        model: 'gpt-4',
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 2048,
        features: ['streaming', 'function-calling'],
        usage: {
          prompt: 50,
          completion: 100,
          total: 150,
        },
      },
    };

    expect(response.metadata?.features).toEqual(['streaming', 'function-calling']);
    expect(response.metadata?.usage?.total).toBe(150);
  });
});

describe('AdapterCapabilities Interface', () => {
  it('should accept valid capabilities with all required fields', () => {
    const capabilities: AdapterCapabilities = {
      maxInputTokens: 4096,
      maxOutputTokens: 2048,
      supportedIntents: ['query', 'conversation'],
      supportsStreaming: true,
      costPer1KTokens: 0.001,
      averageLatency: 100,
      quality: 0.9,
    };

    expect(capabilities.maxInputTokens).toBe(4096);
    expect(capabilities.supportsStreaming).toBe(true);
  });

  it('should accept capabilities for high-capability model', () => {
    const capabilities: AdapterCapabilities = {
      maxInputTokens: 32000,
      maxOutputTokens: 16000,
      supportedIntents: ['query', 'conversation', 'code-generation', 'analysis', 'creative'],
      supportsStreaming: true,
      costPer1KTokens: 0.03,
      averageLatency: 500,
      quality: 0.98,
    };

    expect(capabilities.maxInputTokens).toBe(32000);
    expect(capabilities.quality).toBe(0.98);
  });

  it('should accept capabilities for low-cost model', () => {
    const capabilities: AdapterCapabilities = {
      maxInputTokens: 2048,
      maxOutputTokens: 1024,
      supportedIntents: ['query'],
      supportsStreaming: false,
      costPer1KTokens: 0.0001,
      averageLatency: 50,
      quality: 0.7,
    };

    expect(capabilities.costPer1KTokens).toBe(0.0001);
    expect(capabilities.supportsStreaming).toBe(false);
  });

  it('should accept zero cost (free model)', () => {
    const capabilities: AdapterCapabilities = {
      maxInputTokens: 4096,
      maxOutputTokens: 2048,
      supportedIntents: ['query'],
      supportsStreaming: false,
      costPer1KTokens: 0,
      averageLatency: 100,
      quality: 0.8,
    };

    expect(capabilities.costPer1KTokens).toBe(0);
  });

  it('should accept very high cost (premium model)', () => {
    const capabilities: AdapterCapabilities = {
      maxInputTokens: 100000,
      maxOutputTokens: 50000,
      supportedIntents: ['query', 'conversation', 'analysis'],
      supportsStreaming: true,
      costPer1KTokens: 0.1,
      averageLatency: 1000,
      quality: 0.99,
    };

    expect(capabilities.costPer1KTokens).toBe(0.1);
  });

  it('should accept zero latency (instant response)', () => {
    const capabilities: AdapterCapabilities = {
      maxInputTokens: 4096,
      maxOutputTokens: 2048,
      supportedIntents: ['query'],
      supportsStreaming: false,
      costPer1KTokens: 0.001,
      averageLatency: 0,
      quality: 0.8,
    };

    expect(capabilities.averageLatency).toBe(0);
  });

  it('should accept very high latency (slow model)', () => {
    const capabilities: AdapterCapabilities = {
      maxInputTokens: 4096,
      maxOutputTokens: 2048,
      supportedIntents: ['query'],
      supportsStreaming: false,
      costPer1KTokens: 0.001,
      averageLatency: 10000,
      quality: 0.85,
    };

    expect(capabilities.averageLatency).toBe(10000);
  });

  it('should accept minimum quality (0)', () => {
    const capabilities: AdapterCapabilities = {
      maxInputTokens: 1024,
      maxOutputTokens: 512,
      supportedIntents: ['query'],
      supportsStreaming: false,
      costPer1KTokens: 0.0001,
      averageLatency: 50,
      quality: 0,
    };

    expect(capabilities.quality).toBe(0);
  });

  it('should accept maximum quality (1)', () => {
    const capabilities: AdapterCapabilities = {
      maxInputTokens: 32000,
      maxOutputTokens: 16000,
      supportedIntents: ['query', 'conversation', 'analysis'],
      supportsStreaming: true,
      costPer1KTokens: 0.05,
      averageLatency: 500,
      quality: 1,
    };

    expect(capabilities.quality).toBe(1);
  });

  it('should accept single supported intent', () => {
    const capabilities: AdapterCapabilities = {
      maxInputTokens: 2048,
      maxOutputTokens: 1024,
      supportedIntents: ['query'],
      supportsStreaming: false,
      costPer1KTokens: 0.001,
      averageLatency: 100,
      quality: 0.8,
    };

    expect(capabilities.supportedIntents.length).toBe(1);
  });

  it('should accept many supported intents', () => {
    const capabilities: AdapterCapabilities = {
      maxInputTokens: 16000,
      maxOutputTokens: 8000,
      supportedIntents: [
        'query',
        'conversation',
        'code-generation',
        'analysis',
        'creative',
        'debugging',
        'system',
        'summarization',
      ],
      supportsStreaming: true,
      costPer1KTokens: 0.02,
      averageLatency: 300,
      quality: 0.92,
    };

    expect(capabilities.supportedIntents.length).toBe(8);
  });

  it('should accept large token limits', () => {
    const capabilities: AdapterCapabilities = {
      maxInputTokens: 1000000,
      maxOutputTokens: 500000,
      supportedIntents: ['query'],
      supportsStreaming: true,
      costPer1KTokens: 0.01,
      averageLatency: 200,
      quality: 0.9,
    };

    expect(capabilities.maxInputTokens).toBe(1000000);
    expect(capabilities.maxOutputTokens).toBe(500000);
  });

  it('should accept small token limits', () => {
    const capabilities: AdapterCapabilities = {
      maxInputTokens: 512,
      maxOutputTokens: 256,
      supportedIntents: ['query'],
      supportsStreaming: false,
      costPer1KTokens: 0.0001,
      averageLatency: 25,
      quality: 0.6,
    };

    expect(capabilities.maxInputTokens).toBe(512);
    expect(capabilities.maxOutputTokens).toBe(256);
  });

  it('should support streaming enabled', () => {
    const capabilities: AdapterCapabilities = {
      maxInputTokens: 4096,
      maxOutputTokens: 2048,
      supportedIntents: ['query', 'conversation'],
      supportsStreaming: true,
      costPer1KTokens: 0.001,
      averageLatency: 100,
      quality: 0.9,
    };

    expect(capabilities.supportsStreaming).toBe(true);
  });

  it('should support streaming disabled', () => {
    const capabilities: AdapterCapabilities = {
      maxInputTokens: 2048,
      maxOutputTokens: 1024,
      supportedIntents: ['query'],
      supportsStreaming: false,
      costPer1KTokens: 0.0005,
      averageLatency: 75,
      quality: 0.85,
    };

    expect(capabilities.supportsStreaming).toBe(false);
  });
});

describe('Adapter Integration Examples', () => {
  it('should support Ollama-like adapter capabilities', () => {
    const ollamaCapabilities: AdapterCapabilities = {
      maxInputTokens: 4096,
      maxOutputTokens: 2048,
      supportedIntents: ['query', 'conversation', 'code-generation'],
      supportsStreaming: true,
      costPer1KTokens: 0, // Free (local)
      averageLatency: 150,
      quality: 0.85,
    };

    expect(ollamaCapabilities.costPer1KTokens).toBe(0);
    expect(ollamaCapabilities.supportsStreaming).toBe(true);
  });

  it('should support OpenAI-like adapter capabilities', () => {
    const openaiCapabilities: AdapterCapabilities = {
      maxInputTokens: 8192,
      maxOutputTokens: 4096,
      supportedIntents: ['query', 'conversation', 'code-generation', 'analysis', 'creative'],
      supportsStreaming: true,
      costPer1KTokens: 0.03, // GPT-4 pricing
      averageLatency: 500,
      quality: 0.95,
    };

    expect(openaiCapabilities.quality).toBeGreaterThan(0.9);
    expect(openaiCapabilities.costPer1KTokens).toBe(0.03);
  });

  it('should support Mistral-like adapter capabilities', () => {
    const mistralCapabilities: AdapterCapabilities = {
      maxInputTokens: 32000,
      maxOutputTokens: 16000,
      supportedIntents: ['query', 'conversation', 'code-generation'],
      supportsStreaming: true,
      costPer1KTokens: 0.002,
      averageLatency: 200,
      quality: 0.9,
    };

    expect(mistralCapabilities.maxInputTokens).toBe(32000);
    expect(mistralCapabilities.costPer1KTokens).toBeLessThan(0.01);
  });

  it('should support Code Llama-like adapter capabilities', () => {
    const codeLlamaCapabilities: AdapterCapabilities = {
      maxInputTokens: 16000,
      maxOutputTokens: 8000,
      supportedIntents: ['code-generation', 'debugging', 'query'],
      supportsStreaming: true,
      costPer1KTokens: 0.001,
      averageLatency: 180,
      quality: 0.88,
    };

    expect(codeLlamaCapabilities.supportedIntents).toContain('code-generation');
    expect(codeLlamaCapabilities.supportedIntents).toContain('debugging');
  });

  it('should support lightweight model capabilities', () => {
    const lightweightCapabilities: AdapterCapabilities = {
      maxInputTokens: 1024,
      maxOutputTokens: 512,
      supportedIntents: ['query'],
      supportsStreaming: false,
      costPer1KTokens: 0.0001,
      averageLatency: 30,
      quality: 0.7,
    };

    expect(lightweightCapabilities.averageLatency).toBeLessThan(50);
    expect(lightweightCapabilities.quality).toBeLessThan(0.8);
  });

  it('should support premium model capabilities', () => {
    const premiumCapabilities: AdapterCapabilities = {
      maxInputTokens: 100000,
      maxOutputTokens: 50000,
      supportedIntents: ['query', 'conversation', 'code-generation', 'analysis', 'creative', 'debugging', 'system'],
      supportsStreaming: true,
      costPer1KTokens: 0.1,
      averageLatency: 1000,
      quality: 0.99,
    };

    expect(premiumCapabilities.quality).toBe(0.99);
    expect(premiumCapabilities.maxInputTokens).toBeGreaterThan(50000);
  });
});

/**
 * Mock Ollama Server for Testing
 *
 * Provides a mock HTTP server that simulates Ollama API responses.
 * This allows tests to run without requiring actual Ollama installation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type {
  RoutingDecision,
  ProcessResult,
  OllamaGenerateRequest,
  OllamaGenerateResponse,
  OllamaTagsResponse,
} from "@lsi/protocol";

/**
 * Mock Ollama API responses
 */
export const mockOllamaResponses = {
  /**
   * Simple query responses
   */
  simpleQueries: {
    "What is 2+2?": {
      response: "4",
      model: "qwen2.5:3b",
      done: true,
      eval_count: 10,
      prompt_eval_count: 5,
      total_duration: 1000000,
    },
    "What is the capital of France?": {
      response: "The capital of France is Paris.",
      model: "qwen2.5:3b",
      done: true,
      eval_count: 15,
      prompt_eval_count: 8,
      total_duration: 1500000,
    },
    "Hello": {
      response: "Hello! How can I help you today?",
      model: "qwen2.5:3b",
      done: true,
      eval_count: 8,
      prompt_eval_count: 3,
      total_duration: 800000,
    },
  },

  /**
   * Code generation responses
   */
  codeGeneration: {
    "Write a function to add two numbers in JavaScript": {
      response: `function add(a, b) {
  return a + b;
}

// Example usage:
console.log(add(2, 3)); // Output: 5`,
      model: "qwen2.5:3b",
      done: true,
      eval_count: 25,
      prompt_eval_count: 12,
      total_duration: 2500000,
    },
  },

  /**
   * Complex query responses
   */
  complexQueries: {
    "Explain quantum computing": {
      response: "Quantum computing is a type of computation that harnesses quantum mechanical phenomena such as superposition and entanglement...",
      model: "qwen2.5:3b",
      done: true,
      eval_count: 100,
      prompt_eval_count: 20,
      total_duration: 10000000,
    },
  },

  /**
   * Model list
   */
  models: {
    models: [
      { name: "qwen2.5:3b", size: 1900000000, modified_at: "2024-01-01T00:00:00Z" },
      { name: "llama2:13b", size: 7300000000, modified_at: "2024-01-01T00:00:00Z" },
      { name: "mistral:7b", size: 4100000000, modified_at: "2024-01-01T00:00:00Z" },
    ],
  },
};

/**
 * Mock Ollama adapter class
 */
export class MockOllamaAdapter {
  private latency: number;
  private errorRate: number;
  private callCount: number;

  constructor(latency: number = 100, errorRate: number = 0) {
    this.latency = latency;
    this.errorRate = errorRate;
    this.callCount = 0;
  }

  /**
   * Simulate latency
   */
  private async delay(): Promise<void> {
    if (this.latency > 0) {
      await new Promise(resolve => setTimeout(resolve, this.latency));
    }
  }

  /**
   * Get response for a query
   */
  private getResponse(query: string): OllamaGenerateResponse {
    // Check simple queries
    if (mockOllamaResponses.simpleQueries[query]) {
      return mockOllamaResponses.simpleQueries[query];
    }

    // Check code generation
    if (mockOllamaResponses.codeGeneration[query]) {
      return mockOllamaResponses.codeGeneration[query];
    }

    // Check complex queries
    if (mockOllamaResponses.complexQueries[query]) {
      return mockOllamaResponses.complexQueries[query];
    }

    // Default response
    return {
      response: `Mock response for: ${query}`,
      model: "qwen2.5:3b",
      done: true,
      eval_count: 10,
      prompt_eval_count: 5,
      total_duration: 1000000,
    };
  }

  /**
   * Execute a request
   */
  async execute(decision: RoutingDecision, input: string): Promise<ProcessResult> {
    this.callCount++;

    // Simulate error
    if (this.errorRate > 0 && Math.random() < this.errorRate) {
      throw new Error("Mock Ollama error");
    }

    await this.delay();

    const response = this.getResponse(input);

    return {
      content: response.response,
      backend: decision.backend,
      model: decision.model, // Use model from decision
      tokensUsed: response.eval_count || 0,
      latency: this.latency,
      metadata: {
        model: decision.model, // Use model from decision
        tokensUsed: response.eval_count || 0,
        latency: this.latency,
        backend: decision.backend,
      },
    };
  }

  /**
   * Process a prompt
   */
  async process(prompt: string, model?: string): Promise<ProcessResult> {
    const decision: RoutingDecision = {
      backend: "local",
      model: model || "qwen2.5:3b",
      confidence: 1.0,
      reason: "Mock processing",
      appliedPrinciples: [],
      cacheResponse: false,
    };

    return this.execute(decision, prompt);
  }

  /**
   * Check health
   */
  async checkHealth() {
    return {
      healthy: true,
      models: mockOllamaResponses.models.models.map((m) => m.name),
      currentModel: "qwen2.5:3b",
      status: "ok" as const,
    };
  }

  /**
   * Get call count
   */
  getCallCount(): number {
    return this.callCount;
  }

  /**
   * Reset call count
   */
  resetCallCount(): void {
    this.callCount = 0;
  }

  /**
   * Set latency
   */
  setLatency(latency: number): void {
    this.latency = latency;
  }

  /**
   * Set error rate
   */
  setErrorRate(rate: number): void {
    this.errorRate = rate;
  }
}

/**
 * Create mock Ollama adapter
 */
export function createMockOllamaAdapter(
  latency: number = 100,
  errorRate: number = 0
): MockOllamaAdapter {
  return new MockOllamaAdapter(latency, errorRate);
}

/**
 * Mock HTTP server using Express
 *
 * Note: This is a simplified mock. In a real implementation,
 * you would use nock or msw to mock HTTP requests.
 */
export class MockOllamaServer {
  private responses: Map<string, any>;

  constructor() {
    this.responses = new Map();
    this.setupDefaultResponses();
  }

  /**
   * Setup default responses
   */
  private setupDefaultResponses(): void {
    // GET /api/tags
    this.responses.set("/api/tags", {
      method: "GET",
      response: mockOllamaResponses.models,
    });

    // POST /api/generate
    this.responses.set("/api/generate", {
      method: "POST",
      response: (request: OllamaGenerateRequest) => {
        const mockAdapter = new MockOllamaAdapter();
        return mockAdapter.getResponse(request.prompt);
      },
    });
  }

  /**
   * Get response for a request
   */
  getResponse(path: string, method: string, body?: any): any {
    const key = `${method}:${path}`;
    const mock = this.responses.get(key) || this.responses.get(path);

    if (!mock) {
      throw new Error(`No mock response for ${path}`);
    }

    if (typeof mock.response === "function") {
      return mock.response(body);
    }

    return mock.response;
  }

  /**
   * Set custom response
   */
  setResponse(path: string, method: string, response: any): void {
    this.responses.set(`${method}:${path}`, { method, response });
  }

  /**
   * Clear all responses
   */
  clearResponses(): void {
    this.responses.clear();
    this.setupDefaultResponses();
  }
}

/**
 * Vitest mock utilities
 */
export function mockOllamaAdapter() {
  return {
    execute: vi.fn().mockImplementation(async (decision: RoutingDecision, input: string) => {
      const mockAdapter = new MockOllamaAdapter();
      return mockAdapter.execute(decision, input);
    }),
    process: vi.fn().mockImplementation(async (prompt: string) => {
      const mockAdapter = new MockOllamaAdapter();
      return mockAdapter.process(prompt);
    }),
    checkHealth: vi.fn().mockResolvedValue({
      healthy: true,
      models: ["qwen2.5:3b", "llama2:13b", "mistral:7b"],
      currentModel: "qwen2.5:3b",
      status: "ok",
    }),
    getConfig: vi.fn().mockReturnValue({
      baseURL: "http://localhost:11434",
      defaultModel: "qwen2.5:3b",
      timeout: 30000,
      maxRetries: 3,
      stream: false,
    }),
    updateConfig: vi.fn(),
  };
}

/**
 * Test data for mock tests
 */
export const mockTestData = {
  simpleQueries: [
    "What is 2+2?",
    "What is the capital of France?",
    "Hello",
    "How are you?",
  ],

  complexQueries: [
    "Explain the implications of quantum computing on modern cryptography",
    "What is the meaning of life?",
    "Describe the history of the Roman Empire",
  ],

  codeQueries: [
    "Write a function to add two numbers in JavaScript",
    "Create a class for a binary search tree",
    "Implement a sorting algorithm",
  ],

  batchQueries: Array.from({ length: 10 }, (_, i) => `Query ${i + 1}`),
};

/**
 * Mock performance data
 */
export const mockPerformanceData = {
  latencies: [100, 150, 120, 130, 110, 140, 125, 135, 115, 145],

  throughput: {
    requests: 50,
    duration: 10000, // 10 seconds
    reqPerSec: 5.0,
  },

  memory: {
    used: 500000000, // 500MB
    total: 8000000000, // 8GB
    percentage: 6.25,
  },
};

/**
 * Mock error scenarios
 */
export const mockErrorScenarios = {
  connectionRefused: {
    code: "ECONNREFUSED",
    message: "connect ECONNREFUSED 127.0.0.1:11434",
  },

  timeout: {
    code: "ETIMEDOUT",
    message: "timeout of 30000ms exceeded",
  },

  modelNotFound: {
    response: { status: 404 },
    message: "Model not found",
  },

  internalError: {
    response: { status: 500 },
    message: "Internal server error",
  },
};

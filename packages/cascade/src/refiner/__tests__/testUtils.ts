/**
 * Test utilities for embedding service tests
 *
 * Provides mock implementations, helpers, and fixtures for testing
 * the embedding pipeline.
 *
 * @packageDocumentation
 */

import { EmbeddingResult, EmbeddingServiceConfig } from "../OpenAIEmbeddingService";

/**
 * Mock OpenAI API response structure
 */
export interface MockOpenAIResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * Mock configuration for testing
 */
export interface MockConfig {
  /** Latency to simulate (ms) */
  latency?: number;

  /** Error rate (0-1) */
  errorRate?: number;

  /** Specific error to throw */
  error?: Error;

  /** Whether to return invalid data */
  invalidData?: boolean;

  /** Maximum number of calls before throwing errors */
  maxCalls?: number;

  /** Custom response generator */
  customResponse?: (texts: string[]) => MockOpenAIResponse;
}

/**
 * Generate a realistic-looking embedding vector
 *
 * @param dimensions - Number of dimensions
 * @param seed - Seed for deterministic generation
 * @returns Float32Array of embedding values
 */
export function generateMockEmbedding(
  dimensions: number = 1536,
  seed: string = "test"
): Float32Array {
  const embedding = new Float32Array(dimensions);

  // Generate deterministic values based on seed
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash = hash | 0; // Convert to 32-bit integer
  }

  // Generate values that look like real embeddings (normalized, roughly)
  for (let i = 0; i < dimensions; i++) {
    const value = ((hash * (i + 1) * 7919) % 10000) / 10000;
    embedding[i] = value * 2 - 1; // Scale to [-1, 1]
  }

  // Normalize to unit length (like real embeddings)
  const magnitude = Math.sqrt(
    embedding.reduce((sum, val) => sum + val * val, 0)
  );
  for (let i = 0; i < dimensions; i++) {
    embedding[i] /= magnitude;
  }

  return embedding;
}

/**
 * Generate mock embeddings for multiple texts
 *
 * @param texts - Input texts
 * @param dimensions - Embedding dimensions
 * @returns Array of embedding vectors
 */
export function generateMockEmbeddings(
  texts: string[],
  dimensions: number = 1536
): Float32Array[] {
  return texts.map((text, index) =>
    generateMockEmbedding(dimensions, `${text}-${index}`)
  );
}

/**
 * Create a mock OpenAI API response
 *
 * @param texts - Input texts
 * @param model - Model name
 * @returns Mock OpenAI response
 */
export function createMockOpenAIResponse(
  texts: string[],
  model: string = "text-embedding-3-small"
): MockOpenAIResponse {
  const dimensions = model.includes("large") ? 3072 : 1536;

  return {
    data: texts.map((text, index) => ({
      embedding: Array.from(generateMockEmbedding(dimensions, text)),
      index,
    })),
    model,
    usage: {
      prompt_tokens: texts.reduce((sum, text) => sum + text.length / 4, 0),
      total_tokens: texts.reduce((sum, text) => sum + text.length / 4, 0),
    },
  };
}

/**
 * Mock fetch implementation for OpenAI API
 */
export class MockOpenAIAPI {
  private callCount = 0;
  private config: MockConfig;

  constructor(config: MockConfig = {}) {
    this.config = config;
  }

  /**
   * Simulate OpenAI API call
   */
  async fetch(url: string, options: RequestInit): Promise<Response> {
    this.callCount++;

    // Simulate latency
    if (this.config.latency) {
      await new Promise(resolve => setTimeout(resolve, this.config.latency));
    }

    // Check if max calls exceeded
    if (this.config.maxCalls && this.callCount > this.config.maxCalls) {
      throw new Error("Maximum API calls exceeded");
    }

    // Check for custom error
    if (this.config.error) {
      throw this.config.error;
    }

    // Check error rate
    if (this.config.errorRate && Math.random() < this.config.errorRate) {
      throw new Error("Simulated API error");
    }

    // Parse request body
    const body = JSON.parse(options.body as string);
    const texts = body.input || [body.prompt];

    // Generate response
    let responseData: MockOpenAIResponse;
    if (this.config.customResponse) {
      responseData = this.config.customResponse(texts);
    } else {
      responseData = createMockOpenAIResponse(texts, body.model);
    }

    // Check for invalid data flag
    if (this.config.invalidData) {
      responseData = {
        data: [{ embedding: [], index: 0 }],
        model: body.model,
        usage: { prompt_tokens: 0, total_tokens: 0 },
      };
    }

    // Create mock response
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => responseData,
      text: async () => JSON.stringify(responseData),
    } as Response;
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
  reset(): void {
    this.callCount = 0;
  }

  /**
   * Update config
   */
  setConfig(config: Partial<MockConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Create a mock embedding service config
 *
 * @param overrides - Config overrides
 * @returns EmbeddingServiceConfig
 */
export function createMockEmbeddingConfig(
  overrides: Partial<EmbeddingServiceConfig> = {}
): EmbeddingServiceConfig {
  return {
    apiKey: "test-api-key",
    baseURL: "https://api.openai.com/v1",
    model: "text-embedding-3-small",
    dimensions: 1536,
    timeout: 30000,
    maxRetries: 3,
    enableFallback: true,
    ...overrides,
  };
}

/**
 * Test fixtures for embedding tests
 */
export const EMBEDDING_TEST_FIXTURES = {
  /** Simple text */
  simple: "Hello, world!",

  /** Long text */
  long: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(100),

  /** Empty text (should fail) */
  empty: "",

  /** Whitespace only (should fail) */
  whitespace: "   \n\t  ",

  /** Multiple texts */
  multiple: [
    "The quick brown fox",
    "jumps over the lazy dog",
    "Pack my box with five dozen liquor jugs",
  ],

  /** Unicode text */
  unicode: "你好世界 🌍 Привет мир",

  /** Special characters */
  special: "!@#$%^&*()_+-=[]{}|;':\",./<>?",

  /** Code snippet */
  code: `
    function fibonacci(n: number): number {
      if (n <= 1) return n;
      return fibonacci(n - 1) + fibonacci(n - 2);
    }
  `,
};

/**
 * Assert that two embeddings are similar
 *
 * @param actual - Actual embedding
 * @param expected - Expected embedding
 * @param threshold - Similarity threshold (cosine similarity)
 */
export function assertEmbeddingSimilar(
  actual: Float32Array,
  expected: Float32Array,
  threshold: number = 0.99
): void {
  if (actual.length !== expected.length) {
    throw new Error(
      `Embedding dimensions mismatch: ${actual.length} != ${expected.length}`
    );
  }

  const similarity = cosineSimilarity(actual, expected);

  if (similarity < threshold) {
    throw new Error(
      `Embeddings not similar enough: ${similarity.toFixed(4)} < ${threshold}`
    );
  }
}

/**
 * Calculate cosine similarity between two embeddings
 *
 * @param a - First embedding
 * @param b - Second embedding
 * @returns Cosine similarity (-1 to 1)
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error("Embeddings must have same dimensions");
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);

  if (magnitude === 0) {
    return 0;
  }

  return dotProduct / magnitude;
}

/**
 * Assert embedding result structure
 *
 * @param result - Result to validate
 */
export function assertEmbeddingResult(result: EmbeddingResult): void {
  if (!result.embedding || !(result.embedding instanceof Float32Array)) {
    throw new Error("Invalid embedding: must be Float32Array");
  }

  if (result.embedding.length === 0) {
    throw new Error("Invalid embedding: empty array");
  }

  if (typeof result.model !== "string" || result.model.length === 0) {
    throw new Error("Invalid model: must be non-empty string");
  }

  if (typeof result.latency !== "number" || result.latency < 0) {
    throw new Error("Invalid latency: must be non-negative number");
  }

  if (typeof result.usedFallback !== "boolean") {
    throw new Error("Invalid usedFallback: must be boolean");
  }
}

/**
 * Wait for async operations with timeout
 *
 * @param ms - Milliseconds to wait
 * @param timeout - Maximum timeout
 */
export async function waitWithTimeout(
  ms: number,
  timeout: number = 5000
): Promise<void> {
  await Promise.race([
    new Promise(resolve => setTimeout(resolve, ms)),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), timeout)
    ),
  ]);
}

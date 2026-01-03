/**
 * Mock Adapter for Performance Testing
 *
 * Simulates adapter behavior without real API calls.
 */

import type { Adapter, ProcessResult } from "@lsi/cascade";

export class MockAdapter implements Adapter {
  name: string;
  backend: "local" | "cloud";
  costPerToken: number;
  processTimeMs: number;
  confidence: number;

  constructor(
    name: string,
    backend: "local" | "cloud",
    costPerToken: number,
    processTimeMs: number = 50,
    confidence: number = 0.85
  ) {
    this.name = name;
    this.backend = backend;
    this.costPerToken = costPerToken;
    this.processTimeMs = processTimeMs;
    this.confidence = confidence;
  }

  async initialize(): Promise<void> {
    // Simulate initialization delay
    await this.delay(1);
  }

  async process(input: string): Promise<ProcessResult> {
    // Simulate processing time
    await this.delay(this.processTimeMs);

    const inputTokens = Math.ceil(input.length / 4);
    const outputTokens = Math.ceil(inputTokens * 1.5);

    return {
      content: `Mock response for: ${input.substring(0, 50)}...`,
      backend: this.backend,
      model: this.name,
      tokensUsed: {
        prompt: inputTokens,
        completion: outputTokens,
        total: inputTokens + outputTokens,
      },
      latency: this.processTimeMs,
      avgLogprob: -2.5 + Math.random() * 0.5,
      perplexity: 15 + Math.random() * 5,
      confidence: this.confidence,
    };
  }

  estimateCost(input: string): number {
    const tokens = Math.ceil(input.length / 4);
    return tokens * this.costPerToken;
  }

  async dispose(): Promise<void> {
    // Cleanup
    await this.delay(1);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

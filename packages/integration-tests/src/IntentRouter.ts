/**
 * Temporary IntentRouter implementation for integration tests
 */

import { ModelCapabilities } from "@lsi/protocol";

export interface IntentRouter {
  route: (query: string, intent: string) => Promise<any>;
  removeAdapter: (name: string) => void;
  listAdapters: () => string[];
  addAdapter: (adapter: any) => void;
  capabilities: ModelCapabilities;
}

export class MockIntentRouter implements IntentRouter {
  private adapters: Map<string, any> = new Map();

  constructor(config?: any) {
    // Initialize with default adapters if provided
  }

  async route(query: string, intent: string): Promise<any> {
    // Simple mock implementation
    return {
      response: `Mock response for: ${query}`,
      confidence: 0.8,
      adapter: "mock"
    };
  }

  removeAdapter(name: string): void {
    this.adapters.delete(name);
  }

  listAdapters(): string[] {
    return Array.from(this.adapters.keys());
  }

  addAdapter(adapter: any): void {
    this.adapters.set(adapter.name, adapter);
  }

  get capabilities(): ModelCapabilities {
    return {
      maxTokens: 2048,
      supportedModes: ["text"],
      streaming: false
    };
  }
}
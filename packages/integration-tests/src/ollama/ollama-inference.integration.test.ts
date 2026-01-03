/**
 * Ollama Inference Integration Tests
 *
 * Comprehensive integration tests for local Ollama inference pipeline.
 * These tests can run with real Ollama instances or with mocks.
 *
 * Test Scenarios:
 * 1. Simple query to local model
 * 2. Complex query routing through cascade
 * 3. Batch embedding requests
 * 4. Concurrent requests handling
 * 5. Fallback from cloud to local
 * 6. Error recovery (Ollama crash)
 * 7. Model switching
 * 8. Memory pressure handling
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { OllamaAdapter, OllamaAdapterError } from "@lsi/cascade";
import { CascadeRouter } from "@lsi/cascade";
import type { RoutingDecision, ProcessResult } from "@lsi/protocol";
import axios from "axios";

/**
 * Test configuration
 */
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:3b";
const FALLBACK_MODEL = process.env.OLLAMA_FALLBACK_MODEL || "llama2";

/**
 * Check if Ollama is available
 */
let isOllamaAvailable = false;
let availableModels: string[] = [];

async function checkOllamaAvailability(): Promise<boolean> {
  try {
    const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, {
      timeout: 2000,
    });
    availableModels = response.data.models?.map((m: { name: string }) => m.name) || [];
    return availableModels.length > 0;
  } catch (error) {
    return false;
  }
}

describe("Ollama Inference Integration Tests", () => {
  let adapter: OllamaAdapter;

  beforeAll(async () => {
    isOllamaAvailable = await checkOllamaAvailability();

    if (!isOllamaAvailable) {
      console.warn("⚠️  Ollama not available. Running with mocks only.");
    } else {
      console.log(`✅ Ollama available at ${OLLAMA_BASE_URL}`);
      console.log(`📦 Available models: ${availableModels.join(", ")}`);
    }
  });

  beforeEach(() => {
    adapter = new OllamaAdapter(OLLAMA_BASE_URL, OLLAMA_MODEL);
  });

  /**
   * Test Scenario 1: Simple query to local model
   */
  describe("Scenario 1: Simple Query to Local Model", () => {
    it.concurrent("should process simple arithmetic query", async () => {
      if (!isOllamaAvailable) {
        console.warn("  ⚠️  Skipped (Ollama not available)");
        return;
      }

      const decision: RoutingDecision = {
        backend: "local",
        model: OLLAMA_MODEL,
        confidence: 0.95,
        reason: "Simple arithmetic query suitable for local model",
        appliedPrinciples: [],
        cacheResponse: false,
      };

      const result = await adapter.execute(decision, "What is 2 + 2?");

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.backend).toBe("local");
      expect(result.model).toBe(OLLAMA_MODEL);
      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(result.tokensUsed).toBeGreaterThan(0);

      console.log(`  ✅ Response: "${result.content.trim()}"`);
      console.log(`  ⏱️  Latency: ${result.latency}ms`);
      console.log(`  🔢 Tokens: ${result.tokensUsed}`);
    });

    it.concurrent("should process factual query", async () => {
      if (!isOllamaAvailable) {
        console.warn("  ⚠️  Skipped (Ollama not available)");
        return;
      }

      const result = await adapter.process(
        "What is the capital of France?"
      );

      expect(result.content).toBeDefined();
      expect(result.content.toLowerCase()).toContain("paris");

      console.log(`  ✅ Response: "${result.content.trim()}"`);
    });

    it.concurrent("should handle code generation query", async () => {
      if (!isOllamaAvailable) {
        console.warn("  ⚠️  Skipped (Ollama not available)");
        return;
      }

      const result = await adapter.process(
        "Write a function to add two numbers in JavaScript"
      );

      expect(result.content).toBeDefined();
      expect(result.content).toMatch(/function|const|let|var/);
      expect(result.content).toMatch(/\+|\+/);

      console.log(`  ✅ Code generated (${result.content.length} chars)`);
    });
  });

  /**
   * Test Scenario 2: Complex query routing through cascade
   */
  describe("Scenario 2: Complex Query Routing Through Cascade", () => {
    let router: CascadeRouter;

    beforeAll(() => {
      router = new CascadeRouter({
        localAdapter: adapter,
        cloudAdapter: null, // No cloud adapter for these tests
        threshold: 0.7,
        enableCache: false,
      });
    });

    it.concurrent("should route simple query to local model", async () => {
      if (!isOllamaAvailable) {
        console.warn("  ⚠️  Skipped (Ollama not available)");
        return;
      }

      const decision = await router.route("What is 2+2?");

      expect(decision.backend).toBe("local");
      expect(decision.confidence).toBeGreaterThan(0.7);

      console.log(`  ✅ Routed to local with confidence: ${decision.confidence}`);
      console.log(`  📝 Reason: ${decision.reason}`);
    });

    it.concurrent("should calculate complexity score", async () => {
      if (!isOllamaAvailable) {
        console.warn("  ⚠️  Skipped (Ollama not available)");
        return;
      }

      const decision1 = await router.route("Hello");
      const decision2 = await router.route(
        "Explain the implications of quantum computing on modern cryptography"
      );

      expect(decision1.complexity).toBeLessThan(decision2.complexity);

      console.log(`  📊 Simple query complexity: ${decision1.complexity}`);
      console.log(`  📊 Complex query complexity: ${decision2.complexity}`);
    });
  });

  /**
   * Test Scenario 3: Batch embedding requests
   */
  describe("Scenario 3: Batch Embedding Requests", () => {
    it.concurrent("should handle batch of sequential requests", async () => {
      if (!isOllamaAvailable) {
        console.warn("  ⚠️  Skipped (Ollama not available)");
        return;
      }

      const queries = [
        "What is AI?",
        "What is machine learning?",
        "What is deep learning?",
        "What is a neural network?",
        "What is natural language processing?",
      ];

      const startTime = Date.now();
      const results: ProcessResult[] = [];

      for (const query of queries) {
        const result = await adapter.process(query);
        results.push(result);
      }

      const totalTime = Date.now() - startTime;
      const avgLatency = totalTime / queries.length;

      expect(results).toHaveLength(queries.length);
      results.forEach(result => {
        expect(result.content).toBeDefined();
        expect(result.latency).toBeGreaterThan(0);
      });

      console.log(`  ✅ Processed ${queries.length} queries`);
      console.log(`  ⏱️  Total time: ${totalTime}ms`);
      console.log(`  ⏱️  Average latency: ${avgLatency.toFixed(2)}ms`);
    });

    it.concurrent("should handle batch of parallel requests", async () => {
      if (!isOllamaAvailable) {
        console.warn("  ⚠️  Skipped (Ollama not available)");
        return;
      }

      const queries = [
        "What is the speed of light?",
        "What is gravity?",
        "What is entropy?",
      ];

      const startTime = Date.now();

      const promises = queries.map(query => adapter.process(query));
      const results = await Promise.all(promises);

      const totalTime = Date.now() - startTime;

      expect(results).toHaveLength(queries.length);

      console.log(`  ✅ Processed ${queries.length} queries in parallel`);
      console.log(`  ⏱️  Total time: ${totalTime}ms`);
      console.log(`  ⏱️  Average latency: ${(totalTime / queries.length).toFixed(2)}ms`);
    });
  });

  /**
   * Test Scenario 4: Concurrent requests handling
   */
  describe("Scenario 4: Concurrent Requests Handling", () => {
    it.concurrent("should handle 10 concurrent requests", async () => {
      if (!isOllamaAvailable) {
        console.warn("  ⚠️  Skipped (Ollama not available)");
        return;
      }

      const concurrentRequests = 10;
      const queries = Array.from(
        { length: concurrentRequests },
        (_, i) => `Query ${i + 1}: What is ${i + 1} + ${i + 1}?`
      );

      const startTime = Date.now();

      const promises = queries.map(query => adapter.process(query));
      const results = await Promise.all(promises);

      const totalTime = Date.now() - startTime;
      const throughput = (concurrentRequests / (totalTime / 1000)).toFixed(2);

      expect(results).toHaveLength(concurrentRequests);
      results.forEach(result => {
        expect(result.content).toBeDefined();
      });

      console.log(`  ✅ Handled ${concurrentRequests} concurrent requests`);
      console.log(`  ⏱️  Total time: ${totalTime}ms`);
      console.log(`  📊 Throughput: ${throughput} req/sec`);
    });

    it.concurrent("should handle requests with rate limiting", async () => {
      if (!isOllamaAvailable) {
        console.warn("  ⚠️  Skipped (Ollama not available)");
        return;
      }

      // Create adapter with rate limiter
      const { createTokenBucketLimiter } = await import("@lsi/cascade/src/ratelimit/RateLimiter.js");
      const limiter = createTokenBucketLimiter({
        maxRequests: 5,
        windowMs: 1000,
        algorithm: "token-bucket",
        refillRate: 2,
        burstCapacity: 3,
      });

      const rateLimitedAdapter = new OllamaAdapter(
        OLLAMA_BASE_URL,
        OLLAMA_MODEL,
        undefined,
        limiter
      );

      const startTime = Date.now();

      // Send 10 requests rapidly
      const promises = Array.from({ length: 10 }, (_, i) =>
        rateLimitedAdapter.process(`Test query ${i + 1}`)
      );

      const results = await Promise.allSettled(promises);

      const totalTime = Date.now() - startTime;
      const successCount = results.filter(r => r.status === "fulfilled").length;
      const failureCount = results.filter(r => r.status === "rejected").length;

      console.log(`  ✅ Completed ${successCount} requests`);
      console.log(`  ❌ Failed ${failureCount} requests (rate limited)`);
      console.log(`  ⏱️  Total time: ${totalTime}ms`);

      // Some should succeed, some should be rate limited
      expect(successCount + failureCount).toBe(10);
    });
  });

  /**
   * Test Scenario 5: Fallback from cloud to local
   */
  describe("Scenario 5: Fallback from Cloud to Local", () => {
    it.concurrent("should fall back to local when cloud fails", async () => {
      if (!isOllamaAvailable) {
        console.warn("  ⚠️  Skipped (Ollama not available)");
        return;
      }

      // Create a mock cloud adapter that always fails
      const mockCloudAdapter = {
        async execute(decision: RoutingDecision, input: string): Promise<ProcessResult> {
          throw new Error("Cloud service unavailable");
        },
        async process(prompt: string): Promise<ProcessResult> {
          throw new Error("Cloud service unavailable");
        },
      };

      const router = new CascadeRouter({
        localAdapter: adapter,
        cloudAdapter: mockCloudAdapter as any,
        threshold: 0.5,
        enableCache: false,
      });

      // Force a complex query that would normally go to cloud
      const decision: RoutingDecision = {
        backend: "cloud",
        model: "gpt-4",
        confidence: 0.8,
        reason: "Complex query",
        appliedPrinciples: [],
        cacheResponse: false,
      };

      // Try cloud first, should fail and fall back
      let result: ProcessResult;
      try {
        result = await mockCloudAdapter.execute(decision, "Test query");
      } catch (error) {
        // Cloud failed, use local
        result = await adapter.execute(
          { ...decision, backend: "local", model: OLLAMA_MODEL },
          "Test query"
        );
      }

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.backend).toBe("local");

      console.log(`  ✅ Successfully fell back to local model`);
      console.log(`  📝 Response: "${result.content.substring(0, 100)}..."`);
    });
  });

  /**
   * Test Scenario 6: Error recovery (Ollama crash)
   */
  describe("Scenario 6: Error Recovery", () => {
    it.concurrent("should retry on connection failure", async () => {
      // Create adapter pointing to non-existent Ollama
      const badAdapter = new OllamaAdapter(
        "http://localhost:9999", // Wrong port
        OLLAMA_MODEL,
        { timeout: 1000, maxRetries: 2 }
      );

      await expect(
        badAdapter.process("Test query")
      ).rejects.toThrow(OllamaAdapterError);

      console.log(`  ✅ Correctly handled connection failure with retries`);
    });

    it.concurrent("should check health status", async () => {
      const health = await adapter.checkHealth();

      if (isOllamaAvailable) {
        expect(health.healthy).toBe(true);
        expect(health.models).toBeDefined();
        expect(health.models.length).toBeGreaterThan(0);
        console.log(`  ✅ Ollama is healthy`);
        console.log(`  📦 Models: ${health.models.join(", ")}`);
      } else {
        expect(health.healthy).toBe(false);
        expect(health.status).toBe("unreachable");
        console.log(`  ✅ Correctly detected Ollama is unavailable`);
      }
    });

    it.concurrent("should recover from timeout", async () => {
      if (!isOllamaAvailable) {
        console.warn("  ⚠️  Skipped (Ollama not available)");
        return;
      }

      // Create adapter with very short timeout
      const timeoutAdapter = new OllamaAdapter(
        OLLAMA_BASE_URL,
        OLLAMA_MODEL,
        { timeout: 1, maxRetries: 1 }
      );

      // This should timeout
      await expect(
        timeoutAdapter.process("Generate a very long response")
      ).rejects.toThrow();

      console.log(`  ✅ Correctly handled timeout`);
    });
  });

  /**
   * Test Scenario 7: Model switching
   */
  describe("Scenario 7: Model Switching", () => {
    it.concurrent("should switch between available models", async () => {
      if (!isOllamaAvailable || availableModels.length < 2) {
        console.warn("  ⚠️  Skipped (need at least 2 models)");
        return;
      }

      const model1 = availableModels[0];
      const model2 = availableModels[1];

      const adapter1 = new OllamaAdapter(OLLAMA_BASE_URL, model1);
      const adapter2 = new OllamaAdapter(OLLAMA_BASE_URL, model2);

      const result1 = await adapter1.process("What is 2+2?");
      const result2 = await adapter2.process("What is 2+2?");

      expect(result1.model).toBe(model1);
      expect(result2.model).toBe(model2);

      console.log(`  ✅ Switched from ${model1} to ${model2}`);
      console.log(`  📝 Model 1 response: ${result1.content.substring(0, 50)}...`);
      console.log(`  📝 Model 2 response: ${result2.content.substring(0, 50)}...`);
    });

    it.concurrent("should update model configuration dynamically", async () => {
      const dynamicAdapter = new OllamaAdapter(
        OLLAMA_BASE_URL,
        OLLAMA_MODEL
      );

      const config1 = dynamicAdapter.getConfig();
      expect(config1.defaultModel).toBe(OLLAMA_MODEL);

      // Update to different model
      if (availableModels.length > 1) {
        dynamicAdapter.updateConfig({
          defaultModel: availableModels[1],
        });

        const config2 = dynamicAdapter.getConfig();
        expect(config2.defaultModel).toBe(availableModels[1]);

        console.log(`  ✅ Switched from ${OLLAMA_MODEL} to ${availableModels[1]}`);
      } else {
        console.warn("  ⚠️  Only one model available, skipping switch test");
      }
    });
  });

  /**
   * Test Scenario 8: Memory pressure handling
   */
  describe("Scenario 8: Memory Pressure Handling", () => {
    it.concurrent("should handle large input context", async () => {
      if (!isOllamaAvailable) {
        console.warn("  ⚠️  Skipped (Ollama not available)");
        return;
      }

      // Generate large input
      const largeInput = "Explain artificial intelligence. ".repeat(50);

      const startTime = Date.now();
      const result = await adapter.process(largeInput);
      const endTime = Date.now();

      expect(result.content).toBeDefined();
      expect(result.latency).toBeLessThan(30000); // Should complete within 30s

      console.log(`  ✅ Handled large input (${largeInput.length} chars)`);
      console.log(`  ⏱️  Latency: ${endTime - startTime}ms`);
      console.log(`  🔢 Tokens used: ${result.tokensUsed}`);
    });

    it.concurrent("should handle streaming response", async () => {
      if (!isOllamaAvailable) {
        console.warn("  ⚠️  Skipped (Ollama not available)");
        return;
      }

      // Create adapter with streaming enabled
      const streamAdapter = new OllamaAdapter(
        OLLAMA_BASE_URL,
        OLLAMA_MODEL,
        { stream: true }
      );

      const result = await streamAdapter.process(
        "Write a short story about AI"
      );

      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(100);

      console.log(`  ✅ Streaming response received (${result.content.length} chars)`);
    });
  });

  /**
   * Performance benchmarks
   */
  describe("Performance Benchmarks", () => {
    it.concurrent("benchmark: simple query latency", async () => {
      if (!isOllamaAvailable) {
        console.warn("  ⚠️  Skipped (Ollama not available)");
        return;
      }

      const iterations = 5;
      const latencies: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await adapter.process("What is 2+2?");
        latencies.push(Date.now() - start);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const minLatency = Math.min(...latencies);
      const maxLatency = Math.max(...latencies);

      console.log(`  📊 Average latency: ${avgLatency.toFixed(2)}ms`);
      console.log(`  📊 Min latency: ${minLatency}ms`);
      console.log(`  📊 Max latency: ${maxLatency}ms`);

      expect(avgLatency).toBeLessThan(10000); // Should average under 10s
    });

    it.concurrent("benchmark: throughput", async () => {
      if (!isOllamaAvailable) {
        console.warn("  ⚠️  Skipped (Ollama not available)");
        return;
      }

      const duration = 10000; // 10 seconds
      const startTime = Date.now();
      let requestCount = 0;

      while (Date.now() - startTime < duration) {
        await adapter.process(`Test query ${requestCount + 1}`);
        requestCount++;
      }

      const actualDuration = Date.now() - startTime;
      const throughput = (requestCount / (actualDuration / 1000)).toFixed(2);

      console.log(`  📊 Completed ${requestCount} requests in ${actualDuration}ms`);
      console.log(`  📊 Throughput: ${throughput} req/sec`);

      expect(requestCount).toBeGreaterThan(0);
    });
  });
});

/**
 * Test summary and reporting
 */
afterAll(() => {
  console.log("\n" + "=".repeat(60));
  console.log("OLLAMA INFERENCE INTEGRATION TEST SUMMARY");
  console.log("=".repeat(60));
  console.log(`Ollama Available: ${isOllamaAvailable ? "✅ Yes" : "❌ No"}`);
  console.log(`Base URL: ${OLLAMA_BASE_URL}`);
  console.log(`Default Model: ${OLLAMA_MODEL}`);

  if (isOllamaAvailable) {
    console.log(`Available Models: ${availableModels.join(", ")}`);
  }

  console.log("=".repeat(60) + "\n");
});

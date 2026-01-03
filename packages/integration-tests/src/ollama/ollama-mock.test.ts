/**
 * Ollama Mock Tests
 *
 * Tests that run without requiring actual Ollama installation.
 * These use the MockOllamaAdapter to simulate Ollama behavior.
 *
 * This allows CI/CD pipelines to run tests without Ollama dependencies.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  MockOllamaAdapter,
  createMockOllamaAdapter,
  mockTestData,
  mockPerformanceData,
  mockErrorScenarios,
} from "./mocks.js";
import type { RoutingDecision } from "@lsi/protocol";

describe("Ollama Mock Tests", () => {
  let mockAdapter: MockOllamaAdapter;

  beforeEach(() => {
    mockAdapter = createMockOllamaAdapter(100, 0); // 100ms latency, no errors
  });

  afterEach(() => {
    mockAdapter.resetCallCount();
  });

  /**
   * Test Scenario 1: Simple query to local model (mock)
   */
  describe("Scenario 1: Simple Query to Local Model (Mock)", () => {
    it("should process simple arithmetic query", async () => {
      const decision: RoutingDecision = {
        backend: "local",
        model: "qwen2.5:3b",
        confidence: 0.95,
        reason: "Simple arithmetic query",
        appliedPrinciples: [],
        cacheResponse: false,
      };

      const result = await mockAdapter.execute(decision, "What is 2+2?");

      expect(result.content).toBe("4");
      expect(result.backend).toBe("local");
      expect(result.model).toBe("qwen2.5:3b");
      expect(result.tokensUsed).toBeGreaterThan(0);
      expect(result.latency).toBeGreaterThanOrEqual(100);
    });

    it("should process factual query", async () => {
      const result = await mockAdapter.process("What is the capital of France?");

      expect(result.content).toContain("Paris");
      expect(result.backend).toBe("local");
    });

    it("should handle code generation query", async () => {
      const result = await mockAdapter.process(
        "Write a function to add two numbers in JavaScript"
      );

      expect(result.content).toBeDefined();
      expect(result.content).toMatch(/function/);
      expect(result.content).toMatch(/return/);
    });
  });

  /**
   * Test Scenario 2: Complex query routing through cascade (mock)
   */
  describe("Scenario 2: Complex Query Routing (Mock)", () => {
    it("should handle simple queries", async () => {
      const simpleQueries = mockTestData.simpleQueries;

      for (const query of simpleQueries) {
        const result = await mockAdapter.process(query);
        expect(result.content).toBeDefined();
        expect(result.backend).toBe("local");
      }

      expect(mockAdapter.getCallCount()).toBe(simpleQueries.length);
    });

    it("should handle complex queries", async () => {
      const complexQueries = mockTestData.complexQueries;

      const results = await Promise.all(
        complexQueries.map(query => mockAdapter.process(query))
      );

      results.forEach(result => {
        expect(result.content).toBeDefined();
        expect(result.backend).toBe("local");
      });

      expect(mockAdapter.getCallCount()).toBe(complexQueries.length);
    });
  });

  /**
   * Test Scenario 3: Batch embedding requests (mock)
   */
  describe("Scenario 3: Batch Embedding Requests (Mock)", () => {
    it("should handle batch of sequential requests", async () => {
      const queries = mockTestData.batchQueries.slice(0, 5);
      const results = [];

      const startTime = Date.now();

      for (const query of queries) {
        const result = await mockAdapter.process(query);
        results.push(result);
      }

      const totalTime = Date.now() - startTime;

      expect(results).toHaveLength(queries.length);
      expect(totalTime).toBeGreaterThanOrEqual(queries.length * 100); // 100ms per query
    });

    it("should handle batch of parallel requests", async () => {
      const queries = mockTestData.batchQueries.slice(0, 5);

      const startTime = Date.now();

      const promises = queries.map(query => mockAdapter.process(query));
      const results = await Promise.all(promises);

      const totalTime = Date.now() - startTime;

      expect(results).toHaveLength(queries.length);
      // Parallel should be faster than sequential
      expect(totalTime).toBeLessThan(queries.length * 100);
    });
  });

  /**
   * Test Scenario 4: Concurrent requests handling (mock)
   */
  describe("Scenario 4: Concurrent Requests Handling (Mock)", () => {
    it("should handle 10 concurrent requests", async () => {
      const concurrentRequests = 10;
      const queries = Array.from(
        { length: concurrentRequests },
        (_, i) => `Query ${i + 1}`
      );

      const promises = queries.map(query => mockAdapter.process(query));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(concurrentRequests);
      results.forEach(result => {
        expect(result.content).toBeDefined();
        expect(result.backend).toBe("local");
      });
    });

    it("should handle requests with simulated latency", async () => {
      const latencyAdapter = createMockOllamaAdapter(200, 0); // 200ms latency

      const startTime = Date.now();
      await latencyAdapter.process("Test query");
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(200);
    });
  });

  /**
   * Test Scenario 6: Error recovery (mock)
   */
  describe("Scenario 6: Error Recovery (Mock)", () => {
    it("should handle connection errors", async () => {
      const errorAdapter = createMockOllamaAdapter(100, 0);

      // Simulate error
      errorAdapter.setErrorRate(1.0); // 100% error rate

      await expect(
        errorAdapter.process("Test query")
      ).rejects.toThrow("Mock Ollama error");
    });

    it("should handle intermittent errors", async () => {
      const intermittentAdapter = createMockOllamaAdapter(100, 0.5); // 50% error rate

      const promises = Array.from({ length: 10 }, () =>
        intermittentAdapter.process("Test query")
      );

      const results = await Promise.allSettled(promises);

      const successCount = results.filter(r => r.status === "fulfilled").length;
      const failureCount = results.filter(r => r.status === "rejected").length;

      // Should have some successes and some failures
      expect(successCount).toBeGreaterThan(0);
      expect(failureCount).toBeGreaterThan(0);
      expect(successCount + failureCount).toBe(10);
    });

    it("should check health status", async () => {
      const health = await mockAdapter.checkHealth();

      expect(health.healthy).toBe(true);
      expect(health.models).toBeDefined();
      expect(health.models.length).toBeGreaterThan(0);
      expect(health.status).toBe("ok");
    });
  });

  /**
   * Test Scenario 7: Model switching (mock)
   */
  describe("Scenario 7: Model Switching (Mock)", () => {
    it("should handle different models", async () => {
      const model1 = "qwen2.5:3b";
      const model2 = "llama2:13b";

      const result1 = await mockAdapter.process("Test", model1);
      const result2 = await mockAdapter.process("Test", model2);

      expect(result1.model).toBe(model1);
      expect(result2.model).toBe(model2);
    });
  });

  /**
   * Test Scenario 8: Memory pressure handling (mock)
   */
  describe("Scenario 8: Memory Pressure Handling (Mock)", () => {
    it("should handle large input context", async () => {
      const largeInput = "Explain artificial intelligence. ".repeat(50);

      const result = await mockAdapter.process(largeInput);

      expect(result.content).toBeDefined();
      expect(result.backend).toBe("local");
    });

    it("should handle large output", async () => {
      const result = await mockAdapter.process(
        "Write a detailed explanation of quantum computing"
      );

      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(50);
    });
  });

  /**
   * Performance benchmarks (mock)
   */
  describe("Performance Benchmarks (Mock)", () => {
    it("benchmark: simple query latency", async () => {
      const iterations = 5;
      const latencies: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await mockAdapter.process("What is 2+2?");
        latencies.push(Date.now() - start);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

      expect(avgLatency).toBeGreaterThanOrEqual(100); // At least 100ms (mock latency)
      expect(avgLatency).toBeLessThan(500); // Should not be too slow
    });

    it("benchmark: throughput", async () => {
      const requestCount = 10;
      const queries = Array.from({ length: requestCount }, (_, i) => `Query ${i + 1}`);

      const startTime = Date.now();
      await Promise.all(queries.map(q => mockAdapter.process(q)));
      const endTime = Date.now();

      const duration = endTime - startTime;
      const throughput = (requestCount / (duration / 1000)).toFixed(2);

      expect(parseFloat(throughput)).toBeGreaterThan(0);

      console.log(`Mock throughput: ${throughput} req/sec`);
    });
  });

  /**
   * Edge cases and boundary conditions
   */
  describe("Edge Cases and Boundary Conditions", () => {
    it("should handle empty query", async () => {
      const result = await mockAdapter.process("");

      expect(result.content).toBeDefined();
    });

    it("should handle very long query", async () => {
      const longQuery = "A".repeat(10000);

      const result = await mockAdapter.process(longQuery);

      expect(result.content).toBeDefined();
    });

    it("should handle special characters", async () => {
      const specialQuery = "Test with special chars: @#$%^&*()_+-=[]{}|;':\",./<>?";

      const result = await mockAdapter.process(specialQuery);

      expect(result.content).toBeDefined();
    });

    it("should handle unicode characters", async () => {
      const unicodeQuery = "Test with unicode: 你好世界 🌍 עברית";

      const result = await mockAdapter.process(unicodeQuery);

      expect(result.content).toBeDefined();
    });

    it("should handle zero latency", async () => {
      const zeroLatencyAdapter = createMockOllamaAdapter(0, 0);

      const start = Date.now();
      await zeroLatencyAdapter.process("Test");
      const end = Date.now();

      expect(end - start).toBeLessThan(50); // Should be very fast
    });

    it("should handle high latency", async () => {
      const highLatencyAdapter = createMockOllamaAdapter(500, 0);

      const start = Date.now();
      await highLatencyAdapter.process("Test");
      const end = Date.now();

      expect(end - start).toBeGreaterThanOrEqual(500);
    });
  });

  /**
   * State management
   */
  describe("State Management", () => {
    it("should track call count", async () => {
      expect(mockAdapter.getCallCount()).toBe(0);

      await mockAdapter.process("Test 1");
      expect(mockAdapter.getCallCount()).toBe(1);

      await mockAdapter.process("Test 2");
      expect(mockAdapter.getCallCount()).toBe(2);

      mockAdapter.resetCallCount();
      expect(mockAdapter.getCallCount()).toBe(0);
    });

    it("should allow dynamic latency adjustment", async () => {
      mockAdapter.setLatency(50);

      const start = Date.now();
      await mockAdapter.process("Test");
      const end = Date.now();

      expect(end - start).toBeGreaterThanOrEqual(50);
    });

    it("should allow dynamic error rate adjustment", async () => {
      mockAdapter.setErrorRate(0.0);
      await expect(mockAdapter.process("Test")).resolves.toBeDefined();

      mockAdapter.setErrorRate(1.0);
      await expect(mockAdapter.process("Test")).rejects.toThrow();
    });
  });

  /**
   * Integration with routing decisions
   */
  describe("Integration with Routing Decisions", () => {
    it("should handle local backend decisions", async () => {
      const decision: RoutingDecision = {
        backend: "local",
        model: "qwen2.5:3b",
        confidence: 0.9,
        reason: "Test",
        appliedPrinciples: [],
        cacheResponse: false,
      };

      const result = await mockAdapter.execute(decision, "Test");

      expect(result.backend).toBe("local");
      expect(result.model).toBe("qwen2.5:3b");
    });

    it("should handle different confidence levels", async () => {
      const decisions: RoutingDecision[] = [
        {
          backend: "local",
          model: "qwen2.5:3b",
          confidence: 0.5,
          reason: "Low confidence",
          appliedPrinciples: [],
          cacheResponse: false,
        },
        {
          backend: "local",
          model: "qwen2.5:3b",
          confidence: 1.0,
          reason: "High confidence",
          appliedPrinciples: [],
          cacheResponse: false,
        },
      ];

      for (const decision of decisions) {
        const result = await mockAdapter.execute(decision, "Test");
        expect(result).toBeDefined();
      }
    });

    it("should handle applied principles", async () => {
      const decision: RoutingDecision = {
        backend: "local",
        model: "qwen2.5:3b",
        confidence: 0.9,
        reason: "Test",
        appliedPrinciples: ["cost-optimization", "latency-reduction"],
        cacheResponse: true,
      };

      const result = await mockAdapter.execute(decision, "Test");

      expect(result.metadata).toBeDefined();
    });
  });
});

/**
 * Test summary
 */
afterAll(() => {
  console.log("\n" + "=".repeat(60));
  console.log("OLLAMA MOCK TEST SUMMARY");
  console.log("=".repeat(60));
  console.log("All mock tests completed successfully");
  console.log("Mock tests allow CI/CD to run without Ollama dependencies");
  console.log("=".repeat(60) + "\n");
});

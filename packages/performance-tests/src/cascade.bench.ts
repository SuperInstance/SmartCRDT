/**
 * @lsi/performance-tests
 *
 * Performance benchmarks for @lsi/cascade package.
 *
 * Tests:
 * - Complexity assessment
 * - Routing decision speed
 * - Adapter selection
 * - Cascade execution flow
 */

import { describe, bench, beforeEach } from "vitest";
import { CascadeRouter } from "@lsi/cascade";
import { MockAdapter } from "./mocks/MockAdapter";

describe("@lsi/cascade Benchmarks", () => {
  let router: CascadeRouter;
  let localAdapter: MockAdapter;
  let cloudAdapter: MockAdapter;

  beforeEach(() => {
    localAdapter = new MockAdapter("ollama/llama2", "local", 0.001);
    cloudAdapter = new MockAdapter("openai/gpt-4", "cloud", 0.01);

    router = new CascadeRouter({
      localAdapter,
      cloudAdapter,
      thresholds: {
        complexityThreshold: 0.7,
        confidenceThreshold: 0.6,
        maxLocalTime: 5000,
      },
      enableAdaptiveThresholds: false,
      enableCaching: false,
      enableShadowLogging: false,
    });
  });

  describe("Complexity Assessment", () => {
    const simpleQuery = "What is AI?";
    const moderateQuery =
      "Can you explain the difference between supervised and unsupervised learning in machine learning?";
    const complexQuery = `Analyze the following scenario: A distributed system uses a combination of CRDTs and eventual consistency.
      Compare and contrast this approach with strong consistency models. Consider the implications for:
      1. Network partitions
      2. Conflict resolution
      3. Latency requirements
      4. Data integrity guarantees
      Provide a detailed technical analysis with recommendations.`;

    bench("assessComplexity - simple query", () => {
      return router.assessComplexity(simpleQuery);
    });

    bench("assessComplexity - moderate query", () => {
      return router.assessComplexity(moderateQuery);
    });

    bench("assessComplexity - complex query", () => {
      return router.assessComplexity(complexQuery);
    });
  });

  describe("Routing Decision", () => {
    bench("decide - simple query (should route local)", () => {
      return router.decide("What is the capital of France?");
    });

    bench("decide - complex query (should route cloud)", () => {
      return router.decide(
        "Analyze the economic implications of cryptocurrency adoption on traditional banking systems"
      );
    });

    bench("decide - with privacy override", () => {
      return router.decide("Process my personal data", "general", {
        level: "sovereign",
        score: 0.9,
      });
    });
  });

  describe("Adaptive Thresholds", () => {
    bench("getAdaptiveThresholds - cold start (< 10 routes)", () => {
      // No prior routing history
      return router.decide("Test query");
    });

    bench("getAdaptiveThresholds - warm (100+ routes)", async () => {
      // Simulate 100 routing operations
      for (let i = 0; i < 100; i++) {
        await router.execute(`Test query ${i}`);
      }
      return router.decide("Test query");
    });
  });

  describe("Statistics Operations", () => {
    bench("getStats - after 1000 routes", async () => {
      for (let i = 0; i < 1000; i++) {
        await router.execute(`Query ${i}`);
      }
      return router.getStats();
    });

    bench("resetStats", async () => {
      for (let i = 0; i < 100; i++) {
        await router.execute(`Query ${i}`);
      }
      return router.resetStats();
    });
  });

  describe("Factor Analysis", () => {
    const testCases = [
      { name: "short", text: "Hi" },
      {
        name: "medium",
        text: "This is a medium-length query with some structure.",
      },
      {
        name: "long",
        text: 'This is a much longer query that contains multiple sentences, complex structures, technical vocabulary like "algorithm" and "API", and requires reasoning to understand. It has clauses, questions, and even some quotes: "important text". How would you analyze this?',
      },
    ];

    testCases.forEach(({ name, text }) => {
      bench(`analyzeFactors - ${name} query`, () => {
        return router.assessComplexity(text);
      });
    });
  });

  describe("Technical Terms Detection", () => {
    const technicalText = `The backend uses a REST API with JSON responses. The router queries a database
      using HTTP requests. The algorithm processes arrays of objects. Authentication is handled via
      tokens. The protocol defines the interface between services.`;

    bench("technical terms detection (20+ terms)", () => {
      return router.assessComplexity(technicalText);
    });
  });
});

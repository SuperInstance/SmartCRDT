/**
 * @lsi/performance-tests
 *
 * Performance benchmarks for @lsi/protocol package.
 *
 * Tests:
 * - Type creation and manipulation
 * - Data structure operations
 * - Serialization/deserialization
 * - Memory allocation patterns
 */

import { describe, bench } from "vitest";
import type {
  ComplexityScore,
  ConfidenceScore,
  RoutingDecision,
  ExecutionResult,
  CascadeRouterConfig,
  ComplexityFactors,
  IntentCategory,
  Backend,
} from "@lsi/protocol";

describe("@lsi/protocol Benchmarks", () => {
  describe("Type Creation", () => {
    bench("ComplexityScore creation", () => {
      const score: ComplexityScore = {
        score: 0.75,
        factors: {
          length: 0.5,
          structure: 0.6,
          vocabulary: 0.7,
          reasoning: 0.8,
        },
        reasoning: "Test reasoning",
      };
      return score;
    });

    bench("ConfidenceScore creation", () => {
      const confidence: ConfidenceScore = {
        score: 0.85,
        shouldEscalate: false,
        reasoning: "High confidence",
      };
      return confidence;
    });

    bench("RoutingDecision creation", () => {
      const decision: RoutingDecision = {
        backend: "local",
        model: "ollama/llama2",
        reason: "Simple query",
        confidence: 0.9,
        appliedPrinciples: [],
        cacheResponse: true,
        cacheTtl: 3600000,
        complexityScore: 0.3,
      };
      return decision;
    });

    bench("ExecutionResult creation", () => {
      const result: ExecutionResult = {
        content: "Test response content",
        backend: "local",
        model: "ollama/llama2",
        tokensUsed: { prompt: 10, completion: 20, total: 30 },
        latency: 150,
        escalated: false,
        confidence: 0.95,
      };
      return result;
    });
  });

  describe("Object Operations", () => {
    bench("Object spread (copy)", () => {
      const original: ComplexityFactors = {
        length: 0.5,
        structure: 0.6,
        vocabulary: 0.7,
        reasoning: 0.8,
      };
      return { ...original };
    });

    bench("Object deep copy (JSON)", () => {
      const original: CascadeRouterConfig = {
        localAdapter: "ollama",
        cloudAdapter: "openai",
        complexityThreshold: 0.7,
        confidenceThreshold: 0.6,
        enableShadowLogging: true,
      };
      return JSON.parse(JSON.stringify(original));
    });

    bench("Array map (transform)", () => {
      const backends: Backend[] = ["local", "cloud", "local", "cloud"];
      return backends.map(b => b.toUpperCase());
    });

    bench("Array filter (reduce)", () => {
      const decisions: RoutingDecision[] = Array.from(
        { length: 100 },
        (_, i) => ({
          backend: i % 2 === 0 ? "local" : "cloud",
          model: "test",
          reason: "test",
          confidence: 0.5,
          appliedPrinciples: [],
          cacheResponse: true,
          cacheTtl: 3600000,
          complexityScore: 0.5,
        })
      );
      return decisions.filter(d => d.backend === "local");
    });
  });

  describe("Serialization", () => {
    const complexObject = {
      score: 0.75,
      factors: { length: 0.5, structure: 0.6, vocabulary: 0.7, reasoning: 0.8 },
      reasoning: "Complex query with multiple factors",
      metadata: {
        timestamp: Date.now(),
        version: "1.0.0",
        source: "benchmark",
      },
    };

    bench("JSON.stringify (complex object)", () => {
      return JSON.stringify(complexObject);
    });

    bench("JSON.parse (complex object)", () => {
      const json = JSON.stringify(complexObject);
      return JSON.parse(json);
    });
  });

  describe("Memory Patterns", () => {
    bench("Large array creation (1000 items)", () => {
      return Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        score: Math.random(),
        timestamp: Date.now(),
      }));
    });

    bench("Map operations (1000 entries)", () => {
      const map = new Map<string, number>();
      for (let i = 0; i < 1000; i++) {
        map.set(`key-${i}`, i);
      }
      return map;
    });

    bench("Set operations (1000 entries)", () => {
      const set = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        set.add(`item-${i}`);
      }
      return set;
    });
  });
});

/**
 * @fileoverview Integration tests for @lsi/langchain
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AequorLLM,
  AequorEmbeddings,
  AequorMemory,
  createAequorTools,
  AequorQueryTool,
} from "./index.js";
import { CascadeRouter } from "@lsi/cascade";

describe("@lsi/langchain", () => {
  describe("AequorLLM", () => {
    let llm: AequorLLM;
    let mockRouter: any;

    beforeEach(() => {
      // Create mock router
      mockRouter = {
        route: vi.fn().mockResolvedValue({
          route: "local",
          confidence: 0.8,
          estimatedLatency: 50,
          estimatedCost: 0,
          notes: ["Test route"],
        }),
        routeWithIntelligentCache: vi.fn().mockResolvedValue({
          route: "local",
          confidence: 0.8,
          estimatedLatency: 50,
          estimatedCost: 0,
          notes: ["Test route"],
          cacheStatus: { hit: false, similarity: 0 },
        }),
        getCacheStatistics: vi.fn().mockReturnValue({
          size: 100,
          hitRate: 0.85,
          totalHits: 85,
          totalMisses: 15,
        }),
        clearCache: vi.fn(),
        resetSession: vi.fn(),
        getBudgetSummary: vi.fn().mockReturnValue({
          budget: 10.0,
          spent: 1.5,
          remaining: 8.5,
        }),
      };

      llm = new AequorLLM({ router: mockRouter });
    });

    it("should create instance with default config", () => {
      expect(llm).toBeDefined();
      expect(llm._llmType()).toBe("aequor");
    });

    it("should get routing stats", () => {
      const stats = llm.getRoutingStats();

      expect(stats).toBeDefined();
      expect(stats.cacheStats).toBeDefined();
      expect(stats.budgetSummary).toBeDefined();
    });

    it("should clear cache", () => {
      llm.clearCache();
      expect(mockRouter.clearCache).toHaveBeenCalled();
    });

    it("should reset session", () => {
      llm.resetSession();
      expect(mockRouter.resetSession).toHaveBeenCalled();
    });

    it("should get router instance", () => {
      const router = llm.getRouter();
      expect(router).toBeDefined();
    });

    it("should update configuration", () => {
      llm.updateConfig({
        complexityThreshold: 0.7,
        enableCache: false,
      });

      const config = (llm as any).config;
      expect(config.complexityThreshold).toBe(0.7);
      expect(config.enableCache).toBe(false);
    });
  });

  describe("AequorEmbeddings", () => {
    let embeddings: AequorEmbeddings;

    beforeEach(() => {
      embeddings = new AequorEmbeddings({
        enableCache: true,
        dimensions: 1536,
      });
    });

    it("should create instance with default config", () => {
      expect(embeddings).toBeDefined();
      expect(embeddings.dimensions).toBe(1536);
    });

    it("should have correct dimensions", () => {
      expect(embeddings.dimensions).toBe(1536);
    });

    it("should get cache stats", () => {
      const stats = embeddings.getCacheStats();
      expect(stats).toBeDefined();
    });

    it("should clear cache", () => {
      embeddings.clearCache();
      // No error should be thrown
    });

    it("should get configuration", () => {
      const config = embeddings.getConfig();
      expect(config).toBeDefined();
      expect(config.model).toBe("text-embedding-ada-002");
      expect(config.dimensions).toBe(1536);
    });

    it("should update configuration", () => {
      embeddings.updateConfig({
        model: "text-embedding-3-small",
        dimensions: 768,
      });

      const config = embeddings.getConfig();
      expect(config.model).toBe("text-embedding-3-small");
      expect(config.dimensions).toBe(768);
    });
  });

  describe("AequorMemory", () => {
    let memory: AequorMemory;

    beforeEach(() => {
      memory = new AequorMemory({
        maxTurns: 5,
        maxTokens: 1000,
      });
    });

    it("should create instance with default config", () => {
      expect(memory).toBeDefined();
      expect(memory.memoryKeys).toContain("history");
    });

    it("should have correct memory keys", () => {
      expect(memory.memoryKeys).toEqual(["history"]);
    });

    it("should save and load context", async () => {
      await memory.saveContext(
        { input: "Hello" },
        { output: "Hi there!" }
      );

      const vars = await memory.loadMemoryVariables({ input: "Hello" });
      expect(vars).toBeDefined();
      expect(vars.history).toBeDefined();
    });

    it("should clear memory", async () => {
      await memory.saveContext(
        { input: "Hello" },
        { output: "Hi there!" }
      );

      await memory.clear();

      const history = memory.getHistory();
      expect(history).toHaveLength(0);
    });

    it("should get history", async () => {
      await memory.saveContext(
        { input: "Hello" },
        { output: "Hi there!" }
      );

      const history = memory.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].input).toBe("Hello");
      expect(history[0].output).toBe("Hi there!");
    });

    it("should get stats", async () => {
      await memory.saveContext(
        { input: "Hello" },
        { output: "Hi there!" }
      );

      const stats = memory.getStats();
      expect(stats.totalTurns).toBe(1);
      expect(stats.totalTokens).toBeGreaterThan(0);
    });

    it("should limit history to maxTurns", async () => {
      const memory = new AequorMemory({ maxTurns: 3 });

      // Add 5 turns
      for (let i = 0; i < 5; i++) {
        await memory.saveContext(
          { input: `Message ${i}` },
          { output: `Response ${i}` }
        );
      }

      const history = memory.getHistory();
      expect(history).toHaveLength(3); // Should only keep last 3
    });

    it("should update configuration", () => {
      memory.updateConfig({
        maxTurns: 10,
        maxTokens: 2000,
      });

      const config = (memory as any).config;
      expect(config.maxTurns).toBe(10);
      expect(config.maxTokens).toBe(2000);
    });
  });

  describe("Aequor Tools", () => {
    let mockRouter: any;
    let mockPrivacyClassifier: any;

    beforeEach(() => {
      mockRouter = {
        route: vi.fn().mockResolvedValue({
          route: "local",
          confidence: 0.8,
          estimatedLatency: 50,
          estimatedCost: 0,
          notes: ["Test route"],
        }),
        getCacheStatistics: vi.fn().mockReturnValue({
          size: 100,
          hitRate: 0.85,
          totalHits: 85,
          totalMisses: 15,
        }),
      };

      mockPrivacyClassifier = {
        classify: vi.fn().mockResolvedValue({
          level: "PUBLIC",
          confidence: 0.9,
          categories: ["general"],
          detectedPII: [],
        }),
      };
    });

    it("should create AequorQueryTool", () => {
      const tool = new AequorQueryTool({
        router: mockRouter,
      });

      expect(tool).toBeDefined();
      expect(tool.name).toBe("aequor_query");
      expect(tool.description).toBeDefined();
    });

    it("should invoke AequorQueryTool", async () => {
      const tool = new AequorQueryTool({
        router: mockRouter,
      });

      const result = await tool.invoke({
        query: "Test query",
      });

      expect(result).toBeDefined();
      const parsed = JSON.parse(result);
      expect(parsed.route).toBe("local");
      expect(parsed.confidence).toBe(0.8);
    });

    it("should create all tools", () => {
      const tools = createAequorTools({
        router: mockRouter,
        privacyClassifier: mockPrivacyClassifier,
      });

      expect(tools.query).toBeInstanceOf(AequorQueryTool);
      expect(tools.semanticSearch).toBeDefined();
      expect(tools.privacy).toBeDefined();
      expect(tools.intent).toBeDefined();
      expect(tools.cacheStats).toBeDefined();
      expect(tools.complexity).toBeDefined();
    });
  });

  describe("Utils", () => {
    it("should estimate token count", async () => {
      const { estimateTokenCount } = await import("./utils/index.js");

      const tokens = estimateTokenCount("Hello world");
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(10);
    });

    it("should calculate complexity", async () => {
      const { calculateComplexity } = await import("./utils/index.js");

      const simpleText = "Hi there";
      const complexText =
        "The quantum mechanical phenomenon of entanglement occurs when pairs or groups of particles interact in ways such that the quantum state of each particle cannot be described independently.";

      const simpleScore = calculateComplexity(simpleText);
      const complexScore = calculateComplexity(complexText);

      expect(complexScore).toBeGreaterThan(simpleScore);
      expect(complexScore).toBeGreaterThan(0);
      expect(complexScore).toBeLessThanOrEqual(1);
    });

    it("should format routing result", async () => {
      const { formatRoutingResult } = await import("./utils/index.js");

      const result = formatRoutingResult({
        route: "local",
        confidence: 0.85,
        estimatedLatency: 50,
        estimatedCost: 0,
        cacheHit: true,
        cacheSimilarity: 0.92,
        complexity: 0.5,
      });

      expect(result.route).toBe("LOCAL");
      expect(result.confidence).toBe("85.0%");
      expect(result.latency).toBe("50ms");
      expect(result.cost).toBe("FREE");
      expect(result.cacheStatus).toContain("HIT");
    });
  });
});

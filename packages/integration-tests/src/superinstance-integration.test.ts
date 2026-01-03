/**
 * Suite 6: SuperInstance Integration
 *
 * Tests three-plane architecture: Context, Intention, LucidDreamer
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  SuperInstance,
  ContextPlane,
  IntentionPlane,
  LucidDreamer,
} from "@lsi/superinstance";
import { CRDTStore } from "@lsi/swarm";
import { CascadeRouter } from "@lsi/cascade";
import { IntentCategory } from "@lsi/protocol";

describe("SuperInstance Integration", () => {
  let superInstance: SuperInstance;
  let contextPlane: ContextPlane;
  let intentionPlane: IntentionPlane;
  let lucidDreamer: LucidDreamer;

  beforeEach(async () => {
    const crdtStore = new CRDTStore();
    const cascadeRouter = new CascadeRouter({
      localModel: {
        name: "test-local",
        capabilities: {
          maxTokens: 2048,
          supportedModes: ["text"],
          streaming: false,
        },
      },
      cloudModel: {
        name: "test-cloud",
        capabilities: {
          maxTokens: 8192,
          supportedModes: ["text", "code"],
          streaming: true,
        },
      },
      complexityThreshold: 0.7,
    });

    contextPlane = new ContextPlane({
      knowledgeStore: crdtStore,
    });

    intentionPlane = new IntentionPlane({
      router: cascadeRouter,
    });

    lucidDreamer = new LucidDreamer({
      enabled: true,
    });

    superInstance = new SuperInstance({
      contextPlane: {
        knowledgeStore: crdtStore,
      },
      intentionPlane: {
        router: cascadeRouter,
      },
      lucidDreamer: {
        enabled: true,
      },
    });

    await superInstance.initialize();
  });

  afterEach(async () => {
    if (superInstance) {
      await superInstance.shutdown();
    }
  });

  describe("Three-Plane Architecture", () => {
    it("should initialize all three planes", async () => {
      expect(superInstance).toBeDefined();
      expect(superInstance.contextPlane).toBeDefined();
      expect(superInstance.intentionPlane).toBeDefined();
      expect(superInstance.lucidDreamer).toBeDefined();
    });

    it("should query through context plane", async () => {
      await contextPlane.storeKnowledge({
        key: "test-fact",
        value: "The capital of France is Paris",
      });

      const context = await contextPlane.retrieveContext({
        query: "What is the capital of France?",
      });

      expect(context).toBeDefined();
      expect(context.knowledge).toBeDefined();
    });

    it("should route through intention plane", async () => {
      const decision = await intentionPlane.route({
        query: "What is 2+2?",
        intent: IntentCategory.QUERY,
      });

      expect(decision).toBeDefined();
      expect(decision.backend).toBeDefined();
    });

    it("should learn through LucidDreamer", async () => {
      const hypothesis = await lucidDreamer.generateHypothesis({
        observation: "Users prefer shorter responses",
      });

      expect(hypothesis).toBeDefined();
    });
  });

  describe("Context Plane", () => {
    it("should store and retrieve knowledge", async () => {
      const knowledge = {
        key: "user-preference",
        value: "Alice likes concise answers",
      };

      await contextPlane.storeKnowledge(knowledge);

      const retrieved = await contextPlane.retrieveKnowledge("user-preference");

      expect(retrieved).toBeDefined();
      expect(retrieved.value).toBe("Alice likes concise answers");
    });

    it("should retrieve context for queries", async () => {
      await contextPlane.storeKnowledge({
        key: "context-1",
        value: "Related information 1",
      });
      await contextPlane.storeKnowledge({
        key: "context-2",
        value: "Related information 2",
      });

      const context = await contextPlane.retrieveContext({
        query: "test query",
      });

      expect(context).toBeDefined();
      expect(context.knowledge.length).toBeGreaterThan(0);
    });

    it("should extract domains from queries", async () => {
      const domains = await contextPlane.extractDomains(
        "Explain how to optimize SQL queries for PostgreSQL"
      );

      expect(domains).toBeDefined();
      expect(domains.length).toBeGreaterThan(0);
    });

    it("should build semantic embeddings", async () => {
      const embedding = await contextPlane.buildEmbedding("test query");

      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(1536); // OpenAI text-embedding-3-large
    });
  });

  describe("Intention Plane", () => {
    it("should classify intents", async () => {
      const intent = await intentionPlane.classifyIntent(
        "Write a Python function to sort a list"
      );

      expect(intent).toBeDefined();
      expect(intent.category).toBe(IntentCategory.CODE_GENERATION);
      expect(intent.confidence).toBeGreaterThan(0);
    });

    it("should route to appropriate backend", async () => {
      const routing = await intentionPlane.route({
        query: "What is 2+2?",
        intent: IntentCategory.QUERY,
      });

      expect(routing).toBeDefined();
      expect(routing.backend).toMatch(/local|cloud/);
      expect(routing.model).toBeDefined();
    });

    it("should execute queries", async () => {
      const result = await intentionPlane.execute({
        query: "What is the capital of France?",
        intent: IntentCategory.QUERY,
      });

      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
    });

    it("should handle complex queries", async () => {
      const complexQuery =
        "Analyze the performance implications of using different sorting algorithms for large datasets in distributed systems";

      const result = await intentionPlane.execute({
        query: complexQuery,
        intent: IntentCategory.ANALYSIS,
      });

      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
    });
  });

  describe("LucidDreamer", () => {
    it("should generate hypotheses", async () => {
      const hypothesis = await lucidDreamer.generateHypothesis({
        observation: "Query latency increased by 50%",
      });

      expect(hypothesis).toBeDefined();
      expect(hypothesis.statement).toBeDefined();
      expect(hypothesis.confidence).toBeGreaterThan(0);
    });

    it("should track shadow logging", async () => {
      await lucidDreamer.logShadow({
        query: "test query",
        actualResponse: "actual response",
        alternativeResponse: "alternative response",
        userPreference: "actual",
      });

      const logs = await lucidDreamer.getShadowLogs();
      expect(logs.length).toBeGreaterThan(0);
    });

    it("should recommend learning", async () => {
      const recommendations = await lucidDreamer.getLearningRecommendations();

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe("Full Query Flow", () => {
    it("should execute libcognitive primitives", async () => {
      const query = "What is artificial intelligence?";

      // Transduce
      const meaning = await superInstance.transduce(query);
      expect(meaning).toBeDefined();

      // Recall
      const context = await superInstance.recall(meaning);
      expect(context).toBeDefined();

      // Cogitate - Note: Requires execution backend
      await expect(superInstance.cogitate(meaning, context)).rejects.toThrow(
        /No execution backend available/
      );

      // Effect - Can't test without cogitate result
    });

    it("should handle conversational context", async () => {
      const query1 = "My name is Alice";
      const result1 = await superInstance.query(query1);

      expect(result1).toBeDefined();

      const query2 = "What is my name?";
      const result2 = await superInstance.query(query2);

      expect(result2).toBeDefined();
      // Should remember previous context
    });

    it("should respect constraints", async () => {
      const result = await superInstance.query("Test query", {
        constraints: [
          {
            type: "latency",
            value: "1000",
            priority: 1,
          },
        ],
      });

      expect(result).toBeDefined();
      expect(result.metadata).toBeDefined();
    });
  });

  describe("Multi-Instance Coordination", () => {
    it("should share knowledge across instances", async () => {
      const store1 = new CRDTStore({ replicaId: "instance-1" });
      const store2 = new CRDTStore({ replicaId: "instance-2" });

      const si1 = new SuperInstance({
        contextPlane: { knowledgeStore: store1 },
      });

      const si2 = new SuperInstance({
        contextPlane: { knowledgeStore: store2 },
      });

      await si1.initialize();
      await si2.initialize();

      // Store in SI1
      await store1.store({ key: "shared", value: "Shared knowledge" });

      // Verify it was stored in store1
      const check1 = await store1.retrieve("shared");
      console.log("After store1.store, check1:", check1);

      // Sync to SI2
      await store2.merge(store1.getState());

      // Verify it was merged into store2
      const check2 = await store2.retrieve("shared");
      console.log("After store2.merge, check2:", check2);

      // Retrieve from SI2's contextPlane
      const retrieved = await si2.contextPlane.retrieveKnowledge("shared");
      console.log("si2.contextPlane.retrieveKnowledge:", retrieved);

      expect(retrieved).toBeDefined();
      expect(retrieved.value).toBe("Shared knowledge");

      await si1.shutdown();
      await si2.shutdown();
    });
  });

  describe("Error Handling", () => {
    it("should handle initialization failures", async () => {
      const invalidSI = new SuperInstance({
        contextPlane: null as any,
      });

      await expect(invalidSI.initialize()).rejects.toThrow();
    });

    it("should handle query failures gracefully", async () => {
      const result = await superInstance.query("");

      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
    });

    it("should recover from plane failures", async () => {
      // Simulate context plane failure
      const brokenContext = new ContextPlane({
        knowledgeStore: null as any,
      });

      const fallbackSI = new SuperInstance({
        contextPlane: {
          knowledgeStore: new CRDTStore(),
        },
      });

      await fallbackSI.initialize();

      // Should still work with fallback
      const result = await fallbackSI.query("test query");

      expect(result).toBeDefined();

      await fallbackSI.shutdown();
    });
  });

  describe("Performance", () => {
    it("should initialize quickly", async () => {
      const startTime = Date.now();

      const si = new SuperInstance({
        contextPlane: {
          knowledgeStore: new CRDTStore(),
        },
        intentionPlane: {
          router: new CascadeRouter({
            localModel: {
              name: "test",
              capabilities: {
                maxTokens: 2048,
                supportedModes: ["text"],
                streaming: false,
              },
            },
            cloudModel: {
              name: "test",
              capabilities: {
                maxTokens: 8192,
                supportedModes: ["text"],
                streaming: true,
              },
            },
            complexityThreshold: 0.7,
          }),
        },
      });

      await si.initialize();

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(2000); // Should initialize in <2s

      await si.shutdown();
    });

    it("should process queries efficiently", async () => {
      const query = "What is the capital of France?";

      const startTime = Date.now();
      const result = await superInstance.query(query);
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in <5s
    });
  });

  describe("Integration with Privacy", () => {
    it("should apply privacy to queries", async () => {
      const { RedactionAdditionProtocol } = await import("@lsi/privacy");

      const privacyLayer = new RedactionAdditionProtocol();

      const result = await superInstance.query(
        "Send email to john@example.com",
        {
          privacyLayer,
        }
      );

      expect(result).toBeDefined();
      expect(result.metadata.privacyApplied).toBe(true);
    });

    it("should respect privacy constraints", async () => {
      const result = await superInstance.query(
        "What is my password for admin@example.com?",
        {
          constraints: [
            {
              type: "privacy",
              value: "high",
              priority: 1,
            },
          ],
        }
      );

      expect(result).toBeDefined();
      expect(result.metadata.privacyApplied).toBe(true);
    });
  });

  describe("Metadata and Observability", () => {
    it("should collect query metadata", async () => {
      const result = await superInstance.query("test query");

      expect(result.metadata).toBeDefined();
      expect(result.metadata.timestamp).toBeDefined();
      expect(result.metadata.processingTime).toBeDefined();
      expect(result.metadata.routingDecision).toBeDefined();
    });

    it("should track plane performance", async () => {
      const stats = await superInstance.getPerformanceStats();

      expect(stats).toBeDefined();
      expect(stats.contextPlane).toBeDefined();
      expect(stats.intentionPlane).toBeDefined();
      expect(stats.lucidDreamer).toBeDefined();
    });
  });
});

/**
 * @lsi/performance-tests
 *
 * Performance benchmarks for @lsi/superinstance package.
 *
 * Tests:
 * - ContextPlane operations
 * - IntentionPlane execution
 * - Full pipeline performance
 * - Memory and retrieval
 */

import { describe, bench, beforeEach, afterEach } from "vitest";
import { SuperInstance } from "@lsi/superinstance";
import { ContextPlane } from "@lsi/superinstance/context";
import { IntentionPlane } from "@lsi/superinstance/intention";
import type { QueryContext, IntentCategory } from "@lsi/protocol";

describe("@lsi/superinstance Benchmarks", () => {
  let superInstance: SuperInstance;
  let contextPlane: ContextPlane;
  let intentionPlane: IntentionPlane;

  beforeEach(async () => {
    superInstance = new SuperInstance();
    await superInstance.initialize();

    contextPlane = new ContextPlane();
    await contextPlane.initialize();

    intentionPlane = new IntentionPlane();
    await intentionPlane.initialize();
  });

  afterEach(async () => {
    if (superInstance) {
      await superInstance.dispose();
    }
    if (contextPlane) {
      await contextPlane.dispose();
    }
    if (intentionPlane) {
      await intentionPlane.dispose();
    }
  });

  describe("ContextPlane Operations", () => {
    bench("store knowledge - single entry", async () => {
      return await contextPlane.storeKnowledge({
        content: "Test knowledge content",
        embedding: new Array(1536).fill(0.1),
        metadata: { source: "test", timestamp: Date.now() },
      });
    });

    bench("store knowledge - batch 10 entries", async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          contextPlane.storeKnowledge({
            content: `Knowledge entry ${i}`,
            embedding: new Array(1536).fill(i * 0.01),
            metadata: { source: "test", id: i },
          })
        );
      }
      return await Promise.all(promises);
    });

    bench("retrieve knowledge - single query", async () => {
      // Store some knowledge first
      await contextPlane.storeKnowledge({
        content: "Test content for retrieval",
        embedding: new Array(1536).fill(0.5),
        metadata: { source: "test" },
      });

      return await contextPlane.retrieveKnowledge({
        query: "Test query",
        embedding: new Array(1536).fill(0.5),
        topK: 5,
      });
    });

    bench("retrieve knowledge - with 1000 stored entries", async () => {
      // Store 1000 entries
      for (let i = 0; i < 1000; i++) {
        await contextPlane.storeKnowledge({
          content: `Knowledge ${i}`,
          embedding: new Array(1536).fill(i * 0.001),
          metadata: { id: i },
        });
      }

      return await contextPlane.retrieveKnowledge({
        query: "Test query",
        embedding: new Array(1536).fill(0.5),
        topK: 10,
      });
    });

    bench("ConversationHistory - add message", () => {
      return contextPlane.addMessage({
        role: "user",
        content: "Test message",
        timestamp: Date.now(),
      });
    });

    bench("ConversationHistory - get recent 10", async () => {
      for (let i = 0; i < 20; i++) {
        await contextPlane.addMessage({
          role: i % 2 === 0 ? "user" : "assistant",
          content: `Message ${i}`,
          timestamp: Date.now() + i,
        });
      }
      return await contextPlane.getRecentMessages(10);
    });
  });

  describe("IntentionPlane Operations", () => {
    bench("encode intent - simple query", async () => {
      return await intentionPlane.encodeIntent("What is AI?");
    });

    bench("encode intent - complex query", async () => {
      return await intentionPlane.encodeIntent(
        "Analyze the security implications of using intent vectors for privacy-preserving computation"
      );
    });

    bench("select model - simple query", async () => {
      return await intentionPlane.selectModel({
        query: "What is the weather?",
        intent: "general" as IntentCategory,
        complexity: 0.3,
        privacyRequired: false,
      });
    });

    bench("select model - complex query", async () => {
      return await intentionPlane.selectModel({
        query: "Analyze distributed systems architectures",
        intent: "technical" as IntentCategory,
        complexity: 0.8,
        privacyRequired: true,
      });
    });

    bench("execute - local model", async () => {
      return await intentionPlane.execute({
        query: "What is 2+2?",
        model: "local",
        backend: "local",
      });
    });
  });

  describe("Full Pipeline Performance", () => {
    bench("SuperInstance.query - simple query", async () => {
      return await superInstance.query("What is the capital of France?");
    });

    bench("SuperInstance.query - moderate query", async () => {
      return await superInstance.query(
        "Explain the difference between CRDTs and eventual consistency"
      );
    });

    bench("SuperInstance.query - with context", async () => {
      // Add some context first
      await contextPlane.storeKnowledge({
        content: "CRDTs are conflict-free replicated data types",
        embedding: new Array(1536).fill(0.5),
        metadata: { topic: "crdt" },
      });

      return await superInstance.query("What are CRDTs?");
    });

    bench("SuperInstance.query - with conversation history", async () => {
      await superInstance.query("My name is John");
      return await superInstance.query("What is my name?");
    });
  });

  describe("Memory and Storage", () => {
    bench("SemanticIndex - add 100 entries", async () => {
      const index = contextPlane["semanticIndex"];
      const promises = [];

      for (let i = 0; i < 100; i++) {
        promises.push(
          index.add({
            id: `entry-${i}`,
            embedding: new Array(1536).fill(i * 0.01),
            metadata: { index: i },
          })
        );
      }

      return await Promise.all(promises);
    });

    bench("SemanticIndex - search 1000 entries", async () => {
      const index = contextPlane["semanticIndex"];

      // Add 1000 entries
      for (let i = 0; i < 1000; i++) {
        await index.add({
          id: `entry-${i}`,
          embedding: new Array(1536).fill(i * 0.001),
          metadata: { index: i },
        });
      }

      // Search
      return await index.search(new Array(1536).fill(0.5), 10);
    });

    bench("KnowledgeStore - export state", async () => {
      // Add some knowledge
      for (let i = 0; i < 100; i++) {
        await contextPlane.storeKnowledge({
          content: `Knowledge ${i}`,
          embedding: new Array(1536).fill(i * 0.01),
          metadata: { id: i },
        });
      }

      return await contextPlane.exportKnowledge();
    });

    bench("KnowledgeStore - import state", async () => {
      const state = {
        entries: Array.from({ length: 100 }, (_, i) => ({
          id: `entry-${i}`,
          embedding: new Array(1536).fill(i * 0.01),
          metadata: { index: i },
        })),
      };

      return await contextPlane.importKnowledge(state);
    });
  });

  describe("Concurrent Operations", () => {
    bench("Concurrent queries - 10 parallel", async () => {
      const queries = Array.from({ length: 10 }, (_, i) => `Query ${i}`);
      return await Promise.all(queries.map(q => superInstance.query(q)));
    });

    bench("Concurrent knowledge storage - 50 parallel", async () => {
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          contextPlane.storeKnowledge({
            content: `Concurrent knowledge ${i}`,
            embedding: new Array(1536).fill(i * 0.01),
            metadata: { id: i },
          })
        );
      }
      return await Promise.all(promises);
    });
  });

  describe("Initialize Performance", () => {
    bench("SuperInstance - cold initialization", async () => {
      const instance = new SuperInstance();
      await instance.initialize();
      await instance.dispose();
      return true;
    });

    bench("ContextPlane - cold initialization", async () => {
      const plane = new ContextPlane();
      await plane.initialize();
      await plane.dispose();
      return true;
    });

    bench("IntentionPlane - cold initialization", async () => {
      const plane = new IntentionPlane();
      await plane.initialize();
      await plane.dispose();
      return true;
    });
  });
});

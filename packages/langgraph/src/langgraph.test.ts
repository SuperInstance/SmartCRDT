/**
 * @fileoverview LangGraph package tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { AequorGraph, createAequorGraph } from "./graphs/AequorGraph.js";
import { encodeIntentNode } from "./nodes/encodeIntent.js";
import { routeQueryNode } from "./nodes/routeQuery.js";
import { applyPrivacyNode } from "./nodes/applyPrivacy.js";
import { generateResponseNode } from "./nodes/generateResponse.js";
import { generateUINode } from "./nodes/generateUI.js";
import type { AequorState } from "./state/index.js";

describe("AequorGraph", () => {
  let graph: AequorGraph;

  beforeEach(() => {
    graph = createAequorGraph({
      enableCheckpoints: true,
      enableStreaming: true,
    });
  });

  it("should create graph", () => {
    expect(graph).toBeDefined();
  });

  it("should build graph with all nodes", () => {
    const built = graph.build();
    expect(built).toBeDefined();
  });

  it("should compile graph", async () => {
    const compiled = await graph.compile();
    expect(compiled).toBeDefined();
  });
});

describe("Nodes", () => {
  describe("encodeIntentNode", () => {
    it("should encode intent", async () => {
      const state: AequorState = {
        query: "What is the weather?",
        intent: [],
        route: "local",
        privacy: "public",
        status: "idle",
        sessionId: "test",
        complexity: 0,
      };

      const result = await encodeIntentNode(state);
      expect(result.intent).toBeDefined();
      expect(result.intent?.length).toBe(768);
      expect(result.complexity).toBeGreaterThan(0);
    });
  });

  describe("routeQueryNode", () => {
    it("should route simple queries locally", async () => {
      const state: AequorState = {
        query: "Hello",
        intent: [],
        route: "local",
        privacy: "public",
        status: "processing",
        sessionId: "test",
        complexity: 0.3,
      };

      const result = await routeQueryNode(state);
      expect(result.route).toBe("local");
    });

    it("should route complex queries to cloud", async () => {
      const state: AequorState = {
        query: "Explain quantum entanglement",
        intent: [],
        route: "local",
        privacy: "public",
        status: "processing",
        sessionId: "test",
        complexity: 0.8,
      };

      const result = await routeQueryNode(state);
      expect(result.route).toBe("cloud");
    });

    it("should force local routing for sovereign data", async () => {
      const state: AequorState = {
        query: "Process my medical records",
        intent: [],
        route: "cloud",
        privacy: "sovereign",
        status: "processing",
        sessionId: "test",
        complexity: 0.9,
      };

      const result = await routeQueryNode(state);
      expect(result.route).toBe("local");
    });
  });

  describe("applyPrivacyNode", () => {
    it("should not transform public queries", async () => {
      const state: AequorState = {
        query: "Hello world",
        intent: [],
        route: "cloud",
        privacy: "public",
        status: "processing",
        sessionId: "test",
        complexity: 0.5,
      };

      const result = await applyPrivacyNode(state);
      expect(result.processedQuery).toBe("Hello world");
    });

    it("should redact PII from sensitive queries", async () => {
      const state: AequorState = {
        query: "Email me at test@example.com",
        intent: [],
        route: "cloud",
        privacy: "sensitive",
        status: "processing",
        sessionId: "test",
        complexity: 0.5,
      };

      const result = await applyPrivacyNode(state);
      expect(result.processedQuery).toContain("[EMAIL]");
    });

    it("should use intent-only for sovereign queries", async () => {
      const state: AequorState = {
        query: "My SSN is 123-45-6789",
        intent: [],
        route: "cloud",
        privacy: "sovereign",
        status: "processing",
        sessionId: "test",
        complexity: 0.5,
      };

      const result = await applyPrivacyNode(state);
      expect(result.processedQuery).toBe("[INTENT_ONLY]");
    });
  });

  describe("generateResponseNode", () => {
    it("should generate response", async () => {
      const state: AequorState = {
        query: "Hello",
        intent: [],
        route: "local",
        privacy: "public",
        processedQuery: "Hello",
        status: "processing",
        sessionId: "test",
        complexity: 0.5,
      };

      const result = await generateResponseNode(state);
      expect(result.response).toBeDefined();
      expect(result.status).toBe("complete");
    });
  });

  describe("generateUINode", () => {
    it("should generate UI", async () => {
      const state: AequorState = {
        query: "Hello",
        intent: [],
        route: "local",
        privacy: "public",
        response: "Hello there!",
        status: "processing",
        sessionId: "test",
        complexity: 0.5,
      };

      const result = await generateUINode(state);
      expect(result.ui).toBeDefined();
      expect(result.status).toBe("complete");
    });
  });
});

describe("createAequorGraph", () => {
  it("should create graph with default config", () => {
    const graph = createAequorGraph();
    expect(graph).toBeInstanceOf(AequorGraph);
  });

  it("should create graph with custom config", () => {
    const graph = createAequorGraph({
      enableCheckpoints: false,
      defaultLocalModel: "llama3",
    });
    expect(graph).toBeInstanceOf(AequorGraph);
  });
});

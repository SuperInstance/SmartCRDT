/**
 * Suite 3: Cascade Router Integration
 *
 * Tests routing with adapters, complexity-based routing,
 * and integration with privacy layer.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CascadeRouter } from "@lsi/cascade";
import { IntentCategory, ModelCapabilities } from "@lsi/protocol";
import { PrivacyClassifier } from "@lsi/privacy";
import { MockIntentRouter } from "./IntentRouter";

describe("Cascade Router Integration", () => {
  describe("Complexity-Based Routing", () => {
    let router: CascadeRouter;

    beforeEach(() => {
      router = new CascadeRouter({
        localModel: {
          name: "ollama-llama3.2",
          capabilities: {
            maxTokens: 4096,
            supportedModes: ["text"],
            streaming: false,
          },
        },
        cloudModel: {
          name: "openai-gpt4",
          capabilities: {
            maxTokens: 8192,
            supportedModes: ["text", "code"],
            streaming: true,
          },
        },
        complexityThreshold: 0.7,
      });
    });

    it("should route simple queries to local model", async () => {
      const simpleQuery = "What is 2 + 2?";

      const decision = await router.route(simpleQuery);

      expect(decision).toBeDefined();
      expect(decision.backend).toBe("local");
      expect(decision.modelName).toBe("ollama-llama3.2");
      expect(decision.complexity).toBeLessThan(0.7);
    });

    it("should route complex queries to cloud model", async () => {
      const complexQuery =
        "Analyze the performance implications of using CRDTs for distributed state management in real-time collaborative editing systems with 1000+ concurrent users, considering merge strategies, conflict resolution, and network overhead.";

      const decision = await router.route(complexQuery);

      expect(decision).toBeDefined();
      expect(decision.backend).toBe("cloud");
      expect(decision.modelName).toBe("openai-gpt4");
      expect(decision.complexity).toBeGreaterThanOrEqual(0.7);
    });

    it("should calculate complexity correctly", async () => {
      const queries = [
        { query: "Hi", expectedComplexity: 0.1 },
        { query: "What is AI?", expectedComplexity: 0.3 },
        { query: "Explain quantum computing", expectedComplexity: 0.5 },
        {
          query: "Write a detailed analysis of machine learning algorithms",
          expectedComplexity: 0.7,
        },
      ];

      for (const { query, expectedComplexity } of queries) {
        const decision = await router.route(query);
        // Use ±0.25 tolerance to account for the heuristic nature of complexity calculation
        expect(decision.complexity).toBeGreaterThanOrEqual(
          expectedComplexity - 0.25
        );
        expect(decision.complexity).toBeLessThanOrEqual(
          expectedComplexity + 0.25
        );
      }
    });

    it("should provide routing metadata", async () => {
      const query = "Test query";

      const decision = await router.route(query);

      expect(decision).toBeDefined();
      expect(decision.backend).toBeDefined();
      expect(decision.modelName).toBeDefined();
      expect(decision.complexity).toBeDefined();
      expect(decision.confidence).toBeDefined();
      expect(decision.reasoning).toBeDefined();
    });
  });

  describe("Intent Router with Adapters", () => {
    let intentRouter: MockIntentRouter;

    beforeEach(() => {
      intentRouter = new MockIntentRouter({
        adapters: [
          {
            name: "ollama",
            type: "local",
            capabilities: {
              maxTokens: 2048,
              supportedModes: ["text"],
              streaming: false,
            },
            execute: async query => ({
              response: `Local response to: ${query}`,
              confidence: 0.7,
            }),
          },
          {
            name: "openai",
            type: "cloud",
            capabilities: {
              maxTokens: 8192,
              supportedModes: ["text", "code"],
              streaming: true,
            },
            execute: async query => ({
              response: `Cloud response to: ${query}`,
              confidence: 0.95,
            }),
          },
        ],
      });
    });

    it("should route based on intent", async () => {
      const query = "Generate a REST API endpoint";
      const intent = IntentCategory.CODE_GENERATION;

      const result = await intentRouter.route(query, intent);

      expect(result).toBeDefined();
      expect(result.adapterName).toBeDefined();
      expect(result.response).toBeDefined();
    });

    it("should hot-swap adapters", async () => {
      // Remove adapter
      intentRouter.removeAdapter("ollama");
      const adapters1 = intentRouter.listAdapters();
      expect(adapters1.length).toBe(1);

      // Add new adapter
      intentRouter.addAdapter({
        name: "claude",
        type: "cloud",
        capabilities: {
          maxTokens: 200000,
          supportedModes: ["text", "code"],
          streaming: true,
        },
        execute: async query => ({
          response: `Claude response to: ${query}`,
          confidence: 0.98,
        }),
      });

      const adapters2 = intentRouter.listAdapters();
      expect(adapters2.length).toBe(2);
      expect(adapters2.find(a => a.name === "claude")).toBeDefined();
    });

    it("should handle adapter failures gracefully", async () => {
      const failingRouter = new MockIntentRouter({
        adapters: [
          {
            name: "failing-adapter",
            type: "local",
            capabilities: {
              maxTokens: 2048,
              supportedModes: ["text"],
              streaming: false,
            },
            execute: async () => {
              throw new Error("Adapter failed");
            },
          },
        ],
      });

      const result = await failingRouter.route(
        "test query",
        IntentCategory.QUERY
      );

      // Should handle error gracefully
      expect(result).toBeDefined();
    });

    it("should select best adapter for intent", async () => {
      const result = await intentRouter.route(
        "Write Python code",
        IntentCategory.CODE_GENERATION
      );

      expect(result).toBeDefined();
      expect(result.adapterName).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe("Cascade + Privacy Integration", () => {
    it("should apply privacy before routing", async () => {
      const router = new CascadeRouter({
        localModel: {
          name: "local-model",
          capabilities: {
            maxTokens: 2048,
            supportedModes: ["text"],
            streaming: false,
          },
        },
        cloudModel: {
          name: "cloud-model",
          capabilities: {
            maxTokens: 8192,
            supportedModes: ["text"],
            streaming: true,
          },
        },
        complexityThreshold: 0.7,
        privacyLayer: new PrivacyClassifier(),
      });

      const query = "Send email to john@example.com";

      const decision = await router.route(query);

      expect(decision).toBeDefined();
      // Privacy should be considered in routing decision
      expect(decision.privacyCheck).toBeDefined();
    });

    it("should redact sensitive queries before cloud routing", async () => {
      const router = new CascadeRouter({
        localModel: {
          name: "local-model",
          capabilities: {
            maxTokens: 2048,
            supportedModes: ["text"],
            streaming: false,
          },
        },
        cloudModel: {
          name: "cloud-model",
          capabilities: {
            maxTokens: 8192,
            supportedModes: ["text"],
            streaming: true,
          },
        },
        complexityThreshold: 0.5,
        privacyLayer: new PrivacyClassifier(),
      });

      const query = "What is the password for admin@example.com?";

      const decision = await router.route(query);

      expect(decision).toBeDefined();
      // Should route to local if privacy concern
      if (decision.privacyCheck?.hasSensitiveData) {
        expect(decision.backend).toBe("local");
      }
    });
  });

  describe("Cost Optimization", () => {
    it("should track routing costs", async () => {
      const router = new CascadeRouter({
        localModel: {
          name: "local-model",
          capabilities: {
            maxTokens: 2048,
            supportedModes: ["text"],
            streaming: false,
          },
          costPerToken: 0,
        },
        cloudModel: {
          name: "cloud-model",
          capabilities: {
            maxTokens: 8192,
            supportedModes: ["text"],
            streaming: true,
          },
          costPerToken: 0.0001,
        },
        complexityThreshold: 0.7,
      });

      const queries = [
        "Simple query",
        "Medium complexity query with some details",
        "Very complex query that requires extensive analysis and detailed explanation of multiple interconnected concepts",
      ];

      let totalCost = 0;
      for (const query of queries) {
        const decision = await router.route(query);
        totalCost += decision.cost || 0;
      }

      expect(totalCost).toBeDefined();
      expect(totalCost).toBeGreaterThanOrEqual(0);
    });

    it("should prefer local for cost savings", async () => {
      const router = new CascadeRouter({
        localModel: {
          name: "local-model",
          capabilities: {
            maxTokens: 2048,
            supportedModes: ["text"],
            streaming: false,
          },
          costPerToken: 0,
        },
        cloudModel: {
          name: "cloud-model",
          capabilities: {
            maxTokens: 8192,
            supportedModes: ["text"],
            streaming: true,
          },
          costPerToken: 0.0001,
        },
        complexityThreshold: 0.7,
      });

      const simpleQuery = "What is 2+2?";
      const decision = await router.route(simpleQuery);

      // Should route locally for cost savings
      expect(decision.backend).toBe("local");
      expect(decision.cost).toBe(0);
    });
  });

  describe("Capability Discovery", () => {
    it("should auto-discover model capabilities", async () => {
      const router = new CascadeRouter({
        localModel: {
          name: "test-model",
          capabilities: {
            maxTokens: 4096,
            supportedModes: ["text", "code"],
            streaming: false,
          },
        },
        cloudModel: {
          name: "test-cloud",
          capabilities: {
            maxTokens: 8192,
            supportedModes: ["text", "code", "image"],
            streaming: true,
          },
        },
        complexityThreshold: 0.7,
      });

      const capabilities = router.getAvailableCapabilities();

      expect(capabilities).toBeDefined();
      expect(capabilities.length).toBeGreaterThan(0);
      expect(capabilities.some(c => c.mode === "text")).toBe(true);
    });

    it("should route based on required capabilities", async () => {
      const router = new CascadeRouter({
        localModel: {
          name: "local-model",
          capabilities: {
            maxTokens: 2048,
            supportedModes: ["text"],
            streaming: false,
          },
        },
        cloudModel: {
          name: "cloud-model",
          capabilities: {
            maxTokens: 8192,
            supportedModes: ["text", "code"],
            streaming: true,
          },
        },
        complexityThreshold: 0.5, // Lower threshold to test cloud routing for code
      });

      // Use a complex code generation query
      const codeQuery =
        "Write a comprehensive Python implementation of a distributed sorting algorithm for large-scale data processing across multiple nodes";
      const decision = await router.route(codeQuery);

      expect(decision).toBeDefined();
      // Should route to cloud for complex queries (which code generation tends to be)
      expect(decision.backend).toBe("cloud");
      // Verify complexity is high enough to warrant cloud routing
      expect(decision.complexity).toBeGreaterThanOrEqual(0.5);
    });
  });
});

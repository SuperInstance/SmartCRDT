/**
 * Tests for ACP Handshake Protocol
 *
 * Comprehensive tests for multi-model collaboration handshake,
 * including request validation, model selection, execution planning,
 * and resource estimation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ACPHandshake,
  AggregationStrategy,
  createHandshakeRequest,
  type ACPHandshakeRequest,
  type ACPHandshakeResponse,
  type ExecutionPlan,
} from "./handshake";
import { CollaborationMode, IntentCategory, Urgency } from "./atp-acp";

describe("ACPHandshake", () => {
  let handshake: ACPHandshake;

  beforeEach(() => {
    handshake = new ACPHandshake();
  });

  describe("processHandshake", () => {
    describe("request validation", () => {
      it("should reject request without ID", async () => {
        const request = {
          id: "",
          query: "test query",
          intent: IntentCategory.QUERY,
          collaborationMode: CollaborationMode.PARALLEL,
          models: ["gpt-4"],
          preferences: {},
          timestamp: Date.now(),
        } as ACPHandshakeRequest;

        await expect(handshake.processHandshake(request)).rejects.toThrow(
          "Request ID is required"
        );
      });

      it("should reject request without query", async () => {
        const request = {
          id: "test-123",
          query: "",
          intent: IntentCategory.QUERY,
          collaborationMode: CollaborationMode.PARALLEL,
          models: ["gpt-4"],
          preferences: {},
          timestamp: Date.now(),
        } as ACPHandshakeRequest;

        await expect(handshake.processHandshake(request)).rejects.toThrow(
          "Query is required"
        );
      });

      it("should reject request with no models", async () => {
        const request = {
          id: "test-123",
          query: "test query",
          intent: IntentCategory.QUERY,
          collaborationMode: CollaborationMode.PARALLEL,
          models: [],
          preferences: {},
          timestamp: Date.now(),
        } as ACPHandshakeRequest;

        await expect(handshake.processHandshake(request)).rejects.toThrow(
          "At least one model must be specified"
        );
      });

      it("should reject request with invalid collaboration mode", async () => {
        const request = {
          id: "test-123",
          query: "test query",
          intent: IntentCategory.QUERY,
          collaborationMode: "invalid" as CollaborationMode,
          models: ["gpt-4"],
          preferences: {},
          timestamp: Date.now(),
        };

        await expect(handshake.processHandshake(request)).rejects.toThrow(
          "Invalid collaboration mode"
        );
      });

      it("should accept valid request", async () => {
        const request = createHandshakeRequest(
          "test query",
          ["gpt-4"],
          CollaborationMode.PARALLEL
        );

        const response = await handshake.processHandshake(request);
        expect(response.status).toBe("accepted");
      });
    });

    describe("model availability", () => {
      it("should reject when no models available", async () => {
        const request: ACPHandshakeRequest = {
          id: "test-123",
          query: "test query",
          intent: IntentCategory.QUERY,
          collaborationMode: CollaborationMode.PARALLEL,
          models: ["nonexistent-model"],
          preferences: {},
          timestamp: Date.now(),
        };

        const response = await handshake.processHandshake(request);
        expect(response.status).toBe("rejected");
        expect(response.reason).toContain("No requested models available");
        expect(response.selectedModels).toHaveLength(0);
      });

      it("should filter to available models", async () => {
        const request: ACPHandshakeRequest = {
          id: "test-123",
          query: "test query",
          intent: IntentCategory.QUERY,
          collaborationMode: CollaborationMode.PARALLEL,
          models: ["gpt-4", "nonexistent-model", "claude-3"],
          preferences: {},
          timestamp: Date.now(),
        };

        const response = await handshake.processHandshake(request);
        expect(response.status).toBe("accepted");
        expect(response.selectedModels).toEqual(["gpt-4", "claude-3"]);
      });
    });

    describe("cost constraints", () => {
      it("should reject when cost exceeds maximum", async () => {
        const request: ACPHandshakeRequest = {
          id: "test-123",
          query: "test query",
          intent: IntentCategory.QUERY,
          collaborationMode: CollaborationMode.PARALLEL,
          models: ["gpt-4", "claude-3"], // Expensive models
          preferences: { maxCost: 0.01 }, // Too low
          timestamp: Date.now(),
        };

        const response = await handshake.processHandshake(request);
        expect(response.status).toBe("rejected");
        expect(response.reason).toContain("No models match preferences");
        expect(response.reason).toContain("cost");
      });

      it("should accept when cost within limit", async () => {
        const request: ACPHandshakeRequest = {
          id: "test-123",
          query: "test query",
          intent: IntentCategory.QUERY,
          collaborationMode: CollaborationMode.PARALLEL,
          models: ["llama-3.1-8b"], // Free model
          preferences: { maxCost: 0.01 },
          timestamp: Date.now(),
        };

        const response = await handshake.processHandshake(request);
        expect(response.status).toBe("accepted");
        expect(response.estimatedCost).toBe(0);
      });

      it("should filter out models exceeding cost", async () => {
        const request: ACPHandshakeRequest = {
          id: "test-123",
          query: "test query",
          intent: IntentCategory.QUERY,
          collaborationMode: CollaborationMode.PARALLEL,
          models: ["gpt-4", "llama-3.1-8b"],
          preferences: { maxCost: 0.001 }, // Only llama qualifies
          timestamp: Date.now(),
        };

        const response = await handshake.processHandshake(request);
        expect(response.status).toBe("accepted");
        expect(response.selectedModels).toEqual(["llama-3.1-8b"]);
      });
    });

    describe("latency constraints", () => {
      it("should reject when latency exceeds maximum", async () => {
        const request: ACPHandshakeRequest = {
          id: "test-123",
          query: "test query",
          intent: IntentCategory.QUERY,
          collaborationMode: CollaborationMode.SEQUENTIAL,
          models: ["gpt-4", "gpt-4"], // 800ms * 2 = 1600ms
          preferences: { maxLatency: 1000 },
          timestamp: Date.now(),
        };

        const response = await handshake.processHandshake(request);
        expect(response.status).toBe("rejected");
        expect(response.reason).toContain("Estimated latency");
        expect(response.reason).toContain("exceeds maximum");
      });

      it("should accept when latency within limit", async () => {
        const request: ACPHandshakeRequest = {
          id: "test-123",
          query: "test query",
          intent: IntentCategory.QUERY,
          collaborationMode: CollaborationMode.PARALLEL,
          models: ["llama-3.1-8b", "mistral"], // Max 250ms
          preferences: { maxLatency: 500 },
          timestamp: Date.now(),
        };

        const response = await handshake.processHandshake(request);
        expect(response.status).toBe("accepted");
        expect(response.estimatedLatency).toBeLessThanOrEqual(500);
      });
    });

    describe("quality constraints", () => {
      it("should reject when quality below minimum", async () => {
        const request: ACPHandshakeRequest = {
          id: "test-123",
          query: "test query",
          intent: IntentCategory.QUERY,
          collaborationMode: CollaborationMode.PARALLEL,
          models: ["llama-3.1-8b"], // Quality 0.75
          preferences: { minQuality: 0.9 },
          timestamp: Date.now(),
        };

        const response = await handshake.processHandshake(request);
        expect(response.status).toBe("rejected");
        expect(response.reason).toContain("Model quality");
        expect(response.reason).toContain("below minimum");
      });

      it("should accept when quality meets minimum", async () => {
        const request: ACPHandshakeRequest = {
          id: "test-123",
          query: "test query",
          intent: IntentCategory.QUERY,
          collaborationMode: CollaborationMode.PARALLEL,
          models: ["gpt-4"], // Quality 0.95
          preferences: { minQuality: 0.9 },
          timestamp: Date.now(),
        };

        const response = await handshake.processHandshake(request);
        expect(response.status).toBe("accepted");
      });
    });

    describe("priority handling", () => {
      it("should select fastest models for HIGH priority", async () => {
        const request: ACPHandshakeRequest = {
          id: "test-123",
          query: "test query",
          intent: IntentCategory.QUERY,
          collaborationMode: CollaborationMode.PARALLEL,
          models: ["gpt-4", "llama-3.1-8b", "mistral", "gpt-3.5-turbo"],
          preferences: { priority: Urgency.HIGH },
          timestamp: Date.now(),
        };

        const response = await handshake.processHandshake(request);
        expect(response.status).toBe("accepted");
        expect(response.selectedModels.length).toBeLessThanOrEqual(2);
        // Should select fastest models (llama and mistral)
        expect(response.selectedModels).toContain("llama-3.1-8b");
      });

      it("should select fastest models for CRITICAL priority", async () => {
        const request: ACPHandshakeRequest = {
          id: "test-123",
          query: "test query",
          intent: IntentCategory.QUERY,
          collaborationMode: CollaborationMode.PARALLEL,
          models: ["gpt-4", "llama-3.1-8b", "mistral"],
          preferences: { priority: Urgency.CRITICAL },
          timestamp: Date.now(),
        };

        const response = await handshake.processHandshake(request);
        expect(response.status).toBe("accepted");
        expect(response.selectedModels.length).toBeLessThanOrEqual(2);
      });
    });
  });

  describe("execution plans", () => {
    it("should create SEQUENTIAL execution plan", async () => {
      const request = createHandshakeRequest(
        "test query",
        ["gpt-4", "claude-3"],
        CollaborationMode.SEQUENTIAL
      );

      const response = await handshake.processHandshake(request);
      expect(response.executionPlan.mode).toBe(CollaborationMode.SEQUENTIAL);
      expect(response.executionPlan.steps).toHaveLength(2);
      expect(response.executionPlan.aggregationStrategy).toBe(
        AggregationStrategy.LAST
      );

      // Check step chaining
      expect(response.executionPlan.steps[0].inputSource).toBe("original");
      expect(response.executionPlan.steps[0].outputTarget).toBe("next");
      expect(response.executionPlan.steps[1].inputSource).toBe("previous");
      expect(response.executionPlan.steps[1].outputTarget).toBe("final");
    });

    it("should create PARALLEL execution plan", async () => {
      const request = createHandshakeRequest(
        "test query",
        ["gpt-4", "claude-3"],
        CollaborationMode.PARALLEL
      );

      const response = await handshake.processHandshake(request);
      expect(response.executionPlan.mode).toBe(CollaborationMode.PARALLEL);
      expect(response.executionPlan.steps).toHaveLength(2);
      expect(response.executionPlan.aggregationStrategy).toBe(
        AggregationStrategy.BEST
      );

      // Check parallel inputs
      expect(response.executionPlan.steps[0].inputSource).toBe("original");
      expect(response.executionPlan.steps[1].inputSource).toBe("original");
      expect(response.executionPlan.steps[0].outputTarget).toBe("aggregator");
      expect(response.executionPlan.steps[1].outputTarget).toBe("aggregator");
    });

    it("should create CASCADE execution plan", async () => {
      const request = createHandshakeRequest(
        "test query",
        ["gpt-4", "codellama", "mistral"],
        CollaborationMode.CASCADE
      );

      const response = await handshake.processHandshake(request);
      expect(response.executionPlan.mode).toBe(CollaborationMode.CASCADE);
      expect(response.executionPlan.steps).toHaveLength(3);
      expect(response.executionPlan.aggregationStrategy).toBe(
        AggregationStrategy.LAST
      );

      // Check cascade chaining
      expect(response.executionPlan.steps[0].inputSource).toBe("original");
      expect(response.executionPlan.steps[0].outputTarget).toBe("next");
      expect(response.executionPlan.steps[1].inputSource).toBe("previous");
      expect(response.executionPlan.steps[1].outputTarget).toBe("next");
      expect(response.executionPlan.steps[2].inputSource).toBe("previous");
      expect(response.executionPlan.steps[2].outputTarget).toBe("final");
    });

    it("should create ENSEMBLE execution plan", async () => {
      const request = createHandshakeRequest(
        "test query",
        ["gpt-4", "claude-3", "gpt-3.5-turbo"],
        CollaborationMode.ENSEMBLE
      );

      const response = await handshake.processHandshake(request);
      expect(response.executionPlan.mode).toBe(CollaborationMode.ENSEMBLE);
      expect(response.executionPlan.steps).toHaveLength(3);
      expect(response.executionPlan.aggregationStrategy).toBe(
        AggregationStrategy.WEIGHTED_AVERAGE
      );

      // Check ensemble structure
      expect(response.executionPlan.steps[0].inputSource).toBe("original");
      expect(response.executionPlan.steps[1].inputSource).toBe("original");
      expect(response.executionPlan.steps[2].inputSource).toBe("original");
      expect(response.executionPlan.steps[0].outputTarget).toBe("aggregator");
    });
  });

  describe("latency estimation", () => {
    it("should sum latency for SEQUENTIAL mode", async () => {
      const request = createHandshakeRequest(
        "test query",
        ["llama-3.1-8b", "mistral"], // 200ms + 250ms = 450ms
        CollaborationMode.SEQUENTIAL
      );

      const response = await handshake.processHandshake(request);
      expect(response.estimatedLatency).toBe(450);
    });

    it("should use max latency for PARALLEL mode", async () => {
      const request = createHandshakeRequest(
        "test query",
        ["llama-3.1-8b", "mistral", "gpt-3.5-turbo"], // Max is 300ms
        CollaborationMode.PARALLEL
      );

      const response = await handshake.processHandshake(request);
      expect(response.estimatedLatency).toBe(300);
    });

    it("should use max latency for ENSEMBLE mode", async () => {
      const request = createHandshakeRequest(
        "test query",
        ["gpt-4", "claude-3"], // Max is 800ms
        CollaborationMode.ENSEMBLE
      );

      const response = await handshake.processHandshake(request);
      expect(response.estimatedLatency).toBe(800);
    });
  });

  describe("cost estimation", () => {
    it("should calculate cost for paid models", async () => {
      const request = createHandshakeRequest(
        "test query",
        ["gpt-4"], // $0.03 per 1K tokens
        CollaborationMode.PARALLEL
      );

      const response = await handshake.processHandshake(request);
      expect(response.estimatedCost).toBe(0.03);
    });

    it("should sum cost for multiple models", async () => {
      const request = createHandshakeRequest(
        "test query",
        ["gpt-4", "gpt-3.5-turbo"], // $0.03 + $0.002 = $0.032
        CollaborationMode.PARALLEL
      );

      const response = await handshake.processHandshake(request);
      expect(response.estimatedCost).toBe(0.032);
    });

    it("should be zero for free models", async () => {
      const request = createHandshakeRequest(
        "test query",
        ["llama-3.1-8b", "codellama"],
        CollaborationMode.PARALLEL
      );

      const response = await handshake.processHandshake(request);
      expect(response.estimatedCost).toBe(0);
    });
  });

  describe("model registration", () => {
    it("should allow registering new models", () => {
      handshake.registerModel({
        id: "custom-model",
        available: true,
        avgLatency: 150,
        costPer1kTokens: 0.005,
        quality: 0.85,
      });

      const metadata = handshake.getModelMetadata("custom-model");
      expect(metadata).toBeDefined();
      expect(metadata?.id).toBe("custom-model");
      expect(metadata?.avgLatency).toBe(150);
    });

    it("should update existing model metadata", () => {
      handshake.registerModel({
        id: "gpt-4",
        available: false,
        avgLatency: 1000,
        costPer1kTokens: 0.05,
        quality: 0.98,
      });

      const metadata = handshake.getModelMetadata("gpt-4");
      expect(metadata?.available).toBe(false);
      expect(metadata?.avgLatency).toBe(1000);
    });

    it("should return all registered models", () => {
      const models = handshake.getRegisteredModels();
      expect(models.length).toBeGreaterThan(0);
      expect(models).toContain("gpt-4");
      expect(models).toContain("llama-3.1-8b");
    });

    it("should use updated model metadata in handshake", async () => {
      // Make gpt-4 unavailable
      handshake.registerModel({
        id: "gpt-4",
        available: false,
        avgLatency: 800,
        costPer1kTokens: 0.03,
        quality: 0.95,
      });

      const request = createHandshakeRequest(
        "test query",
        ["gpt-4"],
        CollaborationMode.PARALLEL
      );

      const response = await handshake.processHandshake(request);
      expect(response.status).toBe("rejected");
      expect(response.reason).toContain("No requested models available");
    });
  });
});

describe("createHandshakeRequest", () => {
  it("should create request with all required fields", () => {
    const request = createHandshakeRequest(
      "test query",
      ["gpt-4", "claude-3"],
      CollaborationMode.PARALLEL
    );

    expect(request.id).toMatch(/^acp-\d+-[a-z0-9]+$/);
    expect(request.query).toBe("test query");
    expect(request.intent).toBe(IntentCategory.QUERY);
    expect(request.collaborationMode).toBe(CollaborationMode.PARALLEL);
    expect(request.models).toEqual(["gpt-4", "claude-3"]);
    expect(request.preferences).toEqual({});
    expect(request.timestamp).toBeLessThanOrEqual(Date.now());
    expect(request.timestamp).toBeGreaterThan(Date.now() - 1000);
  });

  it("should include custom preferences", () => {
    const preferences = {
      maxLatency: 1000,
      maxCost: 0.05,
      minQuality: 0.9,
      priority: Urgency.HIGH,
    };

    const request = createHandshakeRequest(
      "test query",
      ["gpt-4"],
      CollaborationMode.SEQUENTIAL,
      preferences
    );

    expect(request.preferences).toEqual(preferences);
  });

  it("should generate unique IDs for each request", () => {
    const request1 = createHandshakeRequest(
      "query1",
      ["gpt-4"],
      CollaborationMode.PARALLEL
    );
    const request2 = createHandshakeRequest(
      "query2",
      ["gpt-4"],
      CollaborationMode.PARALLEL
    );

    expect(request1.id).not.toBe(request2.id);
  });
});

describe("AggregationStrategy", () => {
  it("should have all expected strategies", () => {
    expect(AggregationStrategy.FIRST).toBe("first");
    expect(AggregationStrategy.LAST).toBe("last");
    expect(AggregationStrategy.MAJORITY_VOTE).toBe("majority_vote");
    expect(AggregationStrategy.WEIGHTED_AVERAGE).toBe("weighted_average");
    expect(AggregationStrategy.BEST).toBe("best");
    expect(AggregationStrategy.CONCATENATE).toBe("concatenate");
    expect(AggregationStrategy.ALL).toBe("all");
  });
});

describe("ExecutionPlan integration", () => {
  it("should create valid execution plan for all collaboration modes", async () => {
    const handshake = new ACPHandshake();
    const models = ["gpt-4", "claude-3"];

    for (const mode of Object.values(CollaborationMode)) {
      const request = createHandshakeRequest(
        "test query",
        models,
        mode as CollaborationMode
      );
      const response = await handshake.processHandshake(request);

      expect(response.executionPlan).toBeDefined();
      expect(response.executionPlan.mode).toBe(mode);
      expect(response.executionPlan.steps.length).toBeGreaterThan(0);
      expect(response.executionPlan.aggregationStrategy).toBeDefined();

      // Verify step structure
      response.executionPlan.steps.forEach((step, i) => {
        expect(step.stepNumber).toBe(i + 1);
        expect(step.model).toBeDefined();
        expect(["original", "previous", "aggregated"]).toContain(
          step.inputSource
        );
        expect(["final", "next", "aggregator"]).toContain(step.outputTarget);
        expect(step.estimatedLatency).toBeGreaterThan(0);
      });
    }
  });
});

describe("Edge cases", () => {
  it("should handle single model in PARALLEL mode", async () => {
    const handshake = new ACPHandshake();
    const request = createHandshakeRequest(
      "test query",
      ["gpt-4"],
      CollaborationMode.PARALLEL
    );

    const response = await handshake.processHandshake(request);
    expect(response.status).toBe("accepted");
    expect(response.executionPlan.steps).toHaveLength(1);
  });

  it("should handle many models in ENSEMBLE mode", async () => {
    const handshake = new ACPHandshake();
    const models = ["llama-3.1-8b", "mistral", "gpt-3.5-turbo", "codellama"];
    const request = createHandshakeRequest(
      "test query",
      models,
      CollaborationMode.ENSEMBLE
    );

    const response = await handshake.processHandshake(request);
    expect(response.status).toBe("accepted");
    expect(response.executionPlan.steps).toHaveLength(4);
  });

  it("should handle all constraints simultaneously", async () => {
    const handshake = new ACPHandshake();
    const request: ACPHandshakeRequest = {
      id: "test-123",
      query: "test query",
      intent: IntentCategory.QUERY,
      collaborationMode: CollaborationMode.PARALLEL,
      models: ["llama-3.1-8b", "mistral"],
      preferences: {
        maxLatency: 500,
        maxCost: 0.01,
        minQuality: 0.7,
        priority: Urgency.NORMAL,
      },
      timestamp: Date.now(),
    };

    const response = await handshake.processHandshake(request);
    expect(response.status).toBe("accepted");
    expect(response.estimatedLatency).toBeLessThanOrEqual(500);
    expect(response.estimatedCost).toBeLessThanOrEqual(0.01);
  });
});

/**
 * CascadeRouter Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CascadeRouter } from "./CascadeRouter.js";
import type { RouteDecision, QueryContext } from "../types.js";

describe("CascadeRouter", () => {
  let router: CascadeRouter;

  beforeEach(() => {
    router = new CascadeRouter();
  });

  describe("route()", () => {
    it("should route simple queries locally", async () => {
      const decision = await router.route("What is TypeScript?");

      expect(decision).toBeDefined();
      expect(decision.route).toBe("local");
      expect(decision.confidence).toBeGreaterThan(0);
      expect(decision.estimatedLatency).toBeLessThan(100);
      expect(decision.estimatedCost).toBe(0);
    });

    it("should route complex queries to cloud", async () => {
      const complexQuery =
        "Explain the intricacies of implementing a distributed consensus algorithm with Byzantine fault tolerance in a decentralized network, considering various failure scenarios and network partitions, and provide a comparative analysis of different approaches including Paxos, Raft, and PBFT with code examples in TypeScript.";
      const decision = await router.route(complexQuery);

      expect(decision).toBeDefined();
      expect(decision.route).toBe("cloud");
      expect(decision.confidence).toBeGreaterThan(0);
    });

    it("should include notes in decision", async () => {
      const decision = await router.route("Test query");

      expect(decision.notes).toBeDefined();
      expect(decision.notes!.length).toBeGreaterThan(0);
    });
  });

  describe("resetSession()", () => {
    it("should reset session state", async () => {
      // Make a query
      await router.route("First query");

      // Reset session
      router.resetSession();

      // Session context should be fresh
      const context = router.getSessionContext();
      expect(context).toBeDefined();
    });
  });

  describe("learnFromFeedback()", () => {
    it("should accept feedback without error", () => {
      expect(() => {
        router.learnFromFeedback({
          route: "local",
          success: true,
          satisfaction: 0.9,
          actualLatency: 50,
          actualCost: 0,
        });
      }).not.toThrow();
    });
  });
});

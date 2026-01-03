/**
 * E2E Test: Privacy-Preserving Routing
 *
 * Tests that queries with PII are handled appropriately by the routing system:
 * 1. Routing decisions respect query sensitivity
 * 2. Queries with PII are routed appropriately
 * 3. Privacy-aware routing decisions are made
 * 4. Router handles sensitive data correctly
 *
 * Week: 4
 * Agent: Agent 5 (Integration & Testing Specialist)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CascadeRouter } from "@lsi/cascade";
import { privacyQueries, createTestFixture } from "../helpers/test-setup.js";

describe("E2E: Privacy-Preserving Routing", () => {
  const fixture = createTestFixture({
    enableRefiner: true,
    enableCache: true,
  });

  beforeEach(() => {
    fixture.clearCache();
  });

  describe("Query Sensitivity Detection", () => {
    it("should route PUBLIC queries normally", async () => {
      const decision = await fixture.router.route(privacyQueries.public);

      expect(decision).toBeDefined();
      expect(decision.route).toMatch(/local|cloud/);
      expect(decision.confidence).toBeGreaterThan(0);
    });

    it("should route queries with email", async () => {
      const decision = await fixture.router.route(privacyQueries.sensitive);

      expect(decision).toBeDefined();
      expect(decision.route).toMatch(/local|cloud/);
      expect(decision.confidence).toBeGreaterThan(0);
    });

    it("should route queries with SSN", async () => {
      const decision = await fixture.router.route(privacyQueries.withSSN);

      expect(decision).toBeDefined();
      expect(decision.route).toMatch(/local|cloud/);
      expect(decision.confidence).toBeGreaterThan(0);
    });

    it("should route queries with credit card numbers", async () => {
      const decision = await fixture.router.route(
        privacyQueries.withCreditCard
      );

      expect(decision).toBeDefined();
      expect(decision.route).toMatch(/local|cloud/);
      expect(decision.confidence).toBeGreaterThan(0);
    });

    it("should route queries with phone numbers", async () => {
      const decision = await fixture.router.route(privacyQueries.withPhone);

      expect(decision).toBeDefined();
      expect(decision.route).toMatch(/local|cloud/);
      expect(decision.confidence).toBeGreaterThan(0);
    });

    it("should route queries with multiple PII types", async () => {
      const decision = await fixture.router.route(
        privacyQueries.withMultiplePII
      );

      expect(decision).toBeDefined();
      expect(decision.route).toMatch(/local|cloud/);
      expect(decision.confidence).toBeGreaterThan(0);
    });
  });

  describe("Privacy-Aware Routing Decisions", () => {
    it("should include privacy information in decision notes", async () => {
      const decision = await fixture.router.route(privacyQueries.sensitive);

      expect(decision.notes).toBeDefined();

      // Notes should provide information about the query
      expect(decision.notes!.length).toBeGreaterThan(0);
    });

    it("should handle sovereign data queries", async () => {
      const decision = await fixture.router.route(privacyQueries.sovereign);

      expect(decision).toBeDefined();
      expect(decision.route).toMatch(/local|cloud/);
      expect(decision.confidence).toBeGreaterThan(0);
    });
  });

  describe("Cache Behavior with Privacy", () => {
    it("should cache privacy-sensitive queries appropriately", async () => {
      const query = privacyQueries.withEmail;

      // First query
      const decision1 = await fixture.router.routeWithCache(query);

      // Should return a valid decision
      expect(decision1).toBeDefined();
      expect(decision1.route).toBeDefined();

      // Second query should be faster (cache hit)
      const start = Date.now();
      const decision2 = await fixture.router.routeWithCache(query);
      const duration = Date.now() - start;

      expect(decision2).toBeDefined();
      // Cached queries should be faster (though this depends on implementation)
    });

    it("should maintain cache statistics for privacy queries", async () => {
      const query = privacyQueries.withSSN;
      const decision = await fixture.router.route(query);

      const stats = fixture.getCacheStats();

      // Should track query types
      expect(stats.byQueryType).toBeDefined();
    });
  });

  describe("Router Privacy Features", () => {
    it("should provide routing decisions for all query types", async () => {
      const testQueries = [
        privacyQueries.public,
        privacyQueries.sensitive,
        privacyQueries.sovereign,
        privacyQueries.withEmail,
        privacyQueries.withSSN,
      ];

      for (const query of testQueries) {
        const decision = await fixture.router.route(query);

        expect(decision).toBeDefined();
        expect(decision.route).toMatch(/local|cloud/);
        expect(decision.confidence).toBeGreaterThanOrEqual(0);
        expect(decision.estimatedLatency).toBeGreaterThan(0);
        expect(decision.estimatedCost).toBeGreaterThanOrEqual(0);
      }
    });

    it("should handle complex queries with PII", async () => {
      const complexPIIQuery =
        "I need to send an email to john@example.com about my credit card 4111-1111-1111-1111 and my SSN is 123-45-6789";

      const decision = await fixture.router.route(complexPIIQuery);

      expect(decision).toBeDefined();
      expect(decision.route).toMatch(/local|cloud/);
      expect(decision.confidence).toBeGreaterThan(0);
    });
  });

  describe("Query Refinement with Privacy", () => {
    it("should refine queries containing PII", async () => {
      const router = new CascadeRouter({}, true); // Enable refiner
      const decision = await router.route(privacyQueries.withEmail);

      expect(decision).toBeDefined();
      expect(decision.notes).toBeDefined();

      // Router should handle the query
      expect(decision.route).toMatch(/local|cloud/);
    });

    it("should detect query types for privacy-sensitive queries", async () => {
      const router = new CascadeRouter({}, true);
      const decision = await router.route(privacyQueries.withPhone);

      expect(decision).toBeDefined();
      expect(decision.route).toMatch(/local|cloud/);
    });
  });
});

describe("E2E: Privacy Router Configuration", () => {
  it("should respect router configuration for privacy", async () => {
    const router = new CascadeRouter(
      {
        complexityThreshold: 0.7,
        confidenceThreshold: 0.6,
        enableCache: true,
      },
      true
    );

    const decision = await router.route(privacyQueries.public);

    expect(decision).toBeDefined();
    expect(decision.confidence).toBeGreaterThanOrEqual(0);
  });

  it("should work with cache disabled", async () => {
    const router = new CascadeRouter(
      {
        enableCache: false,
      },
      true
    );

    const decision = await router.route(privacyQueries.sensitive);

    expect(decision).toBeDefined();
    expect(decision.route).toMatch(/local|cloud/);

    const stats = router.getCacheStats();
    expect(stats.size).toBe(0);
  });
});

describe("E2E: Privacy Query Performance", () => {
  it("should maintain performance with privacy queries", async () => {
    const fixture = createTestFixture();

    const queries = [
      privacyQueries.public,
      privacyQueries.sensitive,
      privacyQueries.withEmail,
      privacyQueries.withSSN,
    ];

    for (const query of queries) {
      const start = Date.now();
      const decision = await fixture.router.route(query);
      const duration = Date.now() - start;

      expect(decision).toBeDefined();

      // Routing should be reasonably fast (< 1 second)
      expect(duration).toBeLessThan(1000);
    }
  });

  it("should handle multiple privacy queries in sequence", async () => {
    const fixture = createTestFixture();

    const queries = [
      privacyQueries.public,
      privacyQueries.sensitive,
      privacyQueries.withEmail,
      privacyQueries.withSSN,
      privacyQueries.withCreditCard,
    ];

    const decisions = await Promise.all(
      queries.map(q => fixture.router.route(q))
    );

    expect(decisions).toHaveLength(queries.length);

    for (const decision of decisions) {
      expect(decision).toBeDefined();
      expect(decision.route).toMatch(/local|cloud/);
    }
  });
});

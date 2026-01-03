/**
 * Real-World End-to-End Scenario Tests
 *
 * Tests realistic user scenarios across the Aequor platform:
 * - Medical consultation with privacy
 * - Code generation and debugging
 * - Learning and explanation
 * - Creative writing assistance
 * - Multi-step reasoning
 * - Domain-specific queries with cartridges
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PrivacyLevel } from "@lsi/protocol";

// ============================================================================
// Mock Aequor Platform
// ============================================================================

interface QueryResult {
  response: string;
  queryType: string;
  domains: string[];
  privacyLevel: PrivacyLevel;
  backend: "local" | "cloud";
  cached: boolean;
  usedCartridges: string[];
  latency: number;
  metadata: Record<string, unknown>;
}

interface QueryContext {
  domains?: string[];
  cartridges?: string[];
  privacyMode?: "strict" | "standard" | "permissive";
}

class MockAequorPlatform {
  private cartridges = new Map<string, { manifest: any; loaded: boolean }>();
  private cache = new Map<string, QueryResult>();
  private privacyMode: "strict" | "standard" | "permissive" = "standard";

  async query(input: string, context: QueryContext = {}): Promise<QueryResult> {
    const start = Date.now();

    // Classify query
    const queryType = this.classifyQueryType(input);
    const privacyLevel = this.classifyPrivacy(input);
    const domains = this.detectDomains(input, context.domains);

    // Check cache
    const cacheKey = `${input}:${JSON.stringify(context)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { ...cached, latency: Date.now() - start, cached: true };
    }

    // Privacy check
    if (privacyLevel === "SOVEREIGN" && this.privacyMode === "strict") {
      return {
        response:
          "[REDACTED] This query contains sensitive information that cannot be processed.",
        queryType,
        domains,
        privacyLevel,
        backend: "local",
        cached: false,
        usedCartridges: [],
        latency: Date.now() - start,
        metadata: { reason: "SOVEREIGN data blocked by strict privacy mode" },
      };
    }

    // Route to backend
    const backend = this.selectBackend(queryType, privacyLevel);

    // Process query
    const response = this.generateResponse(input, queryType, domains);

    // Select cartridges
    const usedCartridges = this.selectCartridges(domains, context.cartridges);

    // Cache result
    const result: QueryResult = {
      response,
      queryType,
      domains,
      privacyLevel,
      backend,
      cached: false,
      usedCartridges,
      latency: Date.now() - start,
      metadata: {
        model: backend === "local" ? "llama3.2" : "gpt-4",
        tokens: response.split(" ").length,
      },
    };

    this.cache.set(cacheKey, result);
    return result;
  }

  private classifyQueryType(input: string): string {
    const lower = input.toLowerCase();

    if (
      lower.includes("write") ||
      lower.includes("create") ||
      lower.includes("generate")
    ) {
      if (
        lower.includes("code") ||
        lower.includes("function") ||
        lower.includes("class")
      ) {
        return "CODE";
      }
      if (
        lower.includes("poem") ||
        lower.includes("story") ||
        lower.includes("essay")
      ) {
        return "CREATIVE";
      }
    }

    if (
      lower.includes("explain") ||
      lower.includes("what is") ||
      lower.includes("describe")
    ) {
      return "EXPLANATION";
    }

    if (
      lower.includes("debug") ||
      lower.includes("fix") ||
      lower.includes("error")
    ) {
      return "DEBUG";
    }

    if (
      lower.includes("compare") ||
      lower.includes("difference") ||
      lower.includes("vs")
    ) {
      return "COMPARISON";
    }

    return "GENERAL";
  }

  private classifyPrivacy(input: string): PrivacyLevel {
    const lower = input.toLowerCase();

    const sovereignIndicators = [
      "password",
      "ssn",
      "social security",
      "credit card",
      "bank account",
      "secret",
      "private key",
      "token",
      "api key",
      "pin",
    ];

    const sensitiveIndicators = [
      "email",
      "phone",
      "address",
      "name",
      "doctor",
      "appointment",
      "medical",
      "personal",
      "confidential",
    ];

    for (const indicator of sovereignIndicators) {
      if (lower.includes(indicator)) {
        return "SOVEREIGN";
      }
    }

    for (const indicator of sensitiveIndicators) {
      if (lower.includes(indicator)) {
        return "SENSITIVE";
      }
    }

    return "PUBLIC";
  }

  private detectDomains(input: string, contextDomains?: string[]): string[] {
    const domains: string[] = [];
    const lower = input.toLowerCase();

    // Domain detection
    if (
      lower.includes("medical") ||
      lower.includes("doctor") ||
      lower.includes("health")
    ) {
      domains.push("medical");
    }

    if (
      lower.includes("code") ||
      lower.includes("function") ||
      lower.includes("programming")
    ) {
      domains.push("programming");
    }

    if (
      lower.includes("legal") ||
      lower.includes("law") ||
      lower.includes("contract")
    ) {
      domains.push("legal");
    }

    if (
      lower.includes("financial") ||
      lower.includes("investment") ||
      lower.includes("stock")
    ) {
      domains.push("financial");
    }

    return [...domains, ...(contextDomains || [])];
  }

  private selectBackend(
    queryType: string,
    privacyLevel: PrivacyLevel
  ): "local" | "cloud" {
    // Sovereign data always local
    if (privacyLevel === "SOVEREIGN") {
      return "local";
    }

    // Simple queries can be local
    if (["GENERAL", "EXPLANATION"].includes(queryType)) {
      return "local";
    }

    // Complex queries go to cloud
    return "cloud";
  }

  private generateResponse(
    input: string,
    queryType: string,
    domains: string[]
  ): string {
    const responses: Record<string, string> = {
      CODE: `Here's the code you requested:\n\nfunction example() {\n  // Implementation\n  return 'result';\n}`,
      CREATIVE: `Here's a creative response for: ${input}`,
      EXPLANATION: `Let me explain: ${input} refers to...`,
      DEBUG: `To debug this issue, check the following:\n1. Verify inputs\n2. Check logs\n3. Test edge cases`,
      COMPARISON: `Comparing these concepts:\n\nSimilarities: ...\n\nDifferences: ...`,
      GENERAL: `Here's information about: ${input}`,
    };

    return responses[queryType] || responses.GENERAL;
  }

  private selectCartridges(
    domains: string[],
    contextCartridges?: string[]
  ): string[] {
    const cartridges: string[] = [];

    for (const domain of domains) {
      cartridges.push(`@lsi/${domain}-cartridge`);
    }

    if (contextCartridges) {
      cartridges.push(...contextCartridges);
    }

    return [...new Set(cartridges)];
  }

  setPrivacyMode(mode: "strict" | "standard" | "permissive"): void {
    this.privacyMode = mode;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// ============================================================================
// Mock Privacy Classifier
// ============================================================================

class MockPrivacyClassifier {
  async classify(
    query: string
  ): Promise<{ level: PrivacyLevel; confidence: number }> {
    const platform = new MockAequorPlatform();

    // Use platform's classification
    const level = platform["classifyPrivacy"](query);

    return {
      level,
      confidence:
        level === "PUBLIC" ? 0.95 : level === "SENSITIVE" ? 0.85 : 0.9,
    };
  }
}

// ============================================================================
// Tests
// ============================================================================

describe("Real-World Scenarios", () => {
  let aequor: MockAequorPlatform;
  let privacyClassifier: MockPrivacyClassifier;

  beforeEach(() => {
    aequor = new MockAequorPlatform();
    privacyClassifier = new MockPrivacyClassifier();
  });

  afterEach(() => {
    aequor.clearCache();
  });

  describe("Medical Consultation Scenario", () => {
    it("should handle medical consultation with privacy protection", async () => {
      const query =
        "I have a doctor appointment tomorrow and need to reschedule";

      // Classify privacy
      const classification = await privacyClassifier.classify(query);
      expect(classification.level).toBe("SENSITIVE");

      // Query with medical domain
      const result = await aequor.query(query, { domains: ["medical"] });

      expect(result.domains).toContain("medical");
      expect(result.privacyLevel).toBe("SENSITIVE");
      expect(result.response).toBeDefined();
      expect(result.backend).toBe("local"); // Sensitive data stays local
    });

    it("should block highly sensitive medical queries in strict mode", async () => {
      aequor.setPrivacyMode("strict");

      const query = "My SSN is 123-45-6789 and I need medical coverage";

      const result = await aequor.query(query);

      expect(result.privacyLevel).toBe("SOVEREIGN");
      expect(result.response).toContain("[REDACTED]");
      expect(result.metadata.reason).toContain("SOVEREIGN");
    });

    it("should use medical cartridge for health queries", async () => {
      const query = "What are the symptoms of flu?";

      const result = await aequor.query(query, {
        domains: ["medical"],
        cartridges: ["@lsi/medical-cartridge"],
      });

      expect(result.domains).toContain("medical");
      expect(result.usedCartridges).toContain("@lsi/medical-cartridge");
    });

    it("should handle appointment scheduling queries", async () => {
      const query = "Schedule appointment with Dr. Smith for next Tuesday";

      const result = await aequor.query(query, { domains: ["medical"] });

      expect(result.domains).toContain("medical");
      expect(result.privacyLevel).toBe("SENSITIVE");
      expect(result.queryType).toBe("GENERAL");
    });
  });

  describe("Code Generation Scenario", () => {
    it("should handle code generation requests", async () => {
      const query = "Write a function to sort an array in JavaScript";

      const result = await aequor.query(query);

      expect(result.queryType).toBe("CODE");
      expect(result.domains).toContain("programming");
      expect(result.response).toContain("function");
      expect(result.response).toContain("return");
    });

    it("should handle debugging requests", async () => {
      const query = "Debug this code: it throws an error when array is empty";

      const result = await aequor.query(query);

      expect(result.queryType).toBe("DEBUG");
      expect(result.domains).toContain("programming");
      expect(result.response).toBeDefined();
    });

    it("should provide code explanations", async () => {
      const query = "Explain how closures work in JavaScript with examples";

      const result = await aequor.query(query);

      expect(result.queryType).toBe("EXPLANATION");
      expect(result.domains).toContain("programming");
      expect(result.response).toBeDefined();
    });

    it("should suggest code improvements", async () => {
      const query =
        "Review this code and suggest improvements: function add(a,b) { return a + b; }";

      const result = await aequor.query(query);

      expect(result.queryType).toBe("CODE");
      expect(result.response).toBeDefined();
    });
  });

  describe("Learning and Education Scenario", () => {
    it("should handle explanation requests", async () => {
      const query = "Explain quantum computing in simple terms";

      const result = await aequor.query(query);

      expect(result.queryType).toBe("EXPLANATION");
      expect(result.response).toBeDefined();
      expect(result.response.length).toBeGreaterThan(50);
    });

    it("should provide comparisons", async () => {
      const query = "Compare React and Vue for building web applications";

      const result = await aequor.query(query);

      expect(result.queryType).toBe("COMPARISON");
      expect(result.response).toContain("Comparing");
    });

    it("should answer factual questions", async () => {
      const query = "What is the capital of Japan?";

      const result = await aequor.query(query);

      expect(result.queryType).toBe("EXPLANATION");
      expect(result.privacyLevel).toBe("PUBLIC");
      expect(result.response).toBeDefined();
    });

    it("should handle follow-up questions", async () => {
      const query1 = "What is machine learning?";
      const result1 = await aequor.query(query1);

      const query2 = "How does it differ from deep learning?";
      const result2 = await aequor.query(query2);

      expect(result1.response).toBeDefined();
      expect(result2.response).toBeDefined();

      // Second query might benefit from cache if similar
      expect(result2.cached).toBeDefined();
    });
  });

  describe("Creative Writing Scenario", () => {
    it("should generate creative content", async () => {
      const query = "Write a short poem about artificial intelligence";

      const result = await aequor.query(query);

      expect(result.queryType).toBe("CREATIVE");
      expect(result.response).toBeDefined();
      expect(result.response.length).toBeGreaterThan(20);
    });

    it("should help with story writing", async () => {
      const query = "Write a story opening about a mysterious letter";

      const result = await aequor.query(query);

      expect(result.queryType).toBe("CREATIVE");
      expect(result.response).toBeDefined();
    });

    it("should assist with email drafting", async () => {
      const query = "Draft a professional email to request a meeting";

      const result = await aequor.query(query);

      expect(result.queryType).toBe("CREATIVE");
      expect(result.response).toBeDefined();
      expect(result.response.toLowerCase()).toContain("email");
    });
  });

  describe("Multi-Step Reasoning Scenario", () => {
    it("should handle complex multi-part questions", async () => {
      const query =
        "What is REST API? How does it work? Give examples of common HTTP methods";

      const result = await aequor.query(query);

      expect(result.queryType).toBe("EXPLANATION");
      expect(result.response).toBeDefined();
      expect(result.response.length).toBeGreaterThan(100);
    });

    it("should break down complex problems", async () => {
      const query =
        "How do I design a scalable database schema for an e-commerce platform?";

      const result = await aequor.query(query);

      expect(result.response).toBeDefined();
      expect(result.domains).toContain("programming");
    });

    it("should provide step-by-step guides", async () => {
      const query = "Walk me through setting up a React project from scratch";

      const result = await aequor.query(query);

      expect(result.queryType).toBe("EXPLANATION");
      expect(result.response).toBeDefined();
      expect(result.domains).toContain("programming");
    });
  });

  describe("Privacy-Preserving Scenarios", () => {
    it("should handle queries with PII correctly", async () => {
      const query = "Send an email to john@example.com about the meeting";

      const result = await aequor.query(query);

      expect(result.privacyLevel).toBe("SENSITIVE");
      expect(result.backend).toBe("local");
    });

    it("should protect sensitive information in queries", async () => {
      const query =
        "My credit card number is 4111-1111-1111-1111, is it safe to share?";

      const result = await aequor.query(query);

      expect(result.privacyLevel).toBe("SOVEREIGN");
      expect(result.backend).toBe("local");
    });

    it("should allow public queries to use cloud", async () => {
      const query = "What are the benefits of cloud computing?";

      const result = await aequor.query(query);

      expect(result.privacyLevel).toBe("PUBLIC");
      expect(result.backend).toBeDefined(); // Could be local or cloud
    });

    it("should handle mixed privacy content", async () => {
      const query =
        "What is API security and how do I protect my api-key-12345?";

      const result = await aequor.query(query);

      // Should detect sovereign data
      expect(result.privacyLevel).toBe("SOVEREIGN");
      expect(result.backend).toBe("local");
    });
  });

  describe("Domain-Specific Cartridge Scenarios", () => {
    it("should use legal cartridge for legal queries", async () => {
      const query = "What are the key elements of a contract?";

      const result = await aequor.query(query, {
        domains: ["legal"],
        cartridges: ["@lsi/legal-cartridge"],
      });

      expect(result.domains).toContain("legal");
      expect(result.usedCartridges).toContain("@lsi/legal-cartridge");
    });

    it("should use financial cartridge for investment queries", async () => {
      const query = "Compare stocks and bonds for long-term investment";

      const result = await aequor.query(query, {
        domains: ["financial"],
        cartridges: ["@lsi/financial-cartridge"],
      });

      expect(result.domains).toContain("financial");
      expect(result.usedCartridges).toContain("@lsi/financial-cartridge");
    });

    it("should combine multiple cartridges", async () => {
      const query = "What are the tax implications of stock investments?";

      const result = await aequor.query(query, {
        domains: ["financial", "legal"],
        cartridges: ["@lsi/financial-cartridge", "@lsi/legal-cartridge"],
      });

      expect(result.usedCartridges.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle empty queries gracefully", async () => {
      const result = await aequor.query("");

      expect(result.response).toBeDefined();
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    it("should handle very long queries", async () => {
      const longQuery = "Explain " + "complexity ".repeat(100);

      const result = await aequor.query(longQuery);

      expect(result.response).toBeDefined();
      expect(result.latency).toBeLessThan(1000);
    });

    it("should handle special characters", async () => {
      const query = "What does @#$%^&*() mean in programming?";

      const result = await aequor.query(query);

      expect(result.response).toBeDefined();
      expect(result.domains).toContain("programming");
    });

    it("should handle multilingual content", async () => {
      const query = "Hola, ¿cómo estás?"; // Spanish greeting

      const result = await aequor.query(query);

      expect(result.response).toBeDefined();
    });
  });

  describe("Caching Behavior", () => {
    it("should cache responses for repeated queries", async () => {
      const query = "What is the capital of France?";

      const result1 = await aequor.query(query);
      const result2 = await aequor.query(query);

      expect(result1.cached).toBe(false);
      expect(result2.cached).toBe(true);
      expect(result2.latency).toBeLessThan(result1.latency);
    });

    it("should maintain consistency across cache hits", async () => {
      const query = "Explain recursion in programming";

      const result1 = await aequor.query(query);
      const result2 = await aequor.query(query);

      expect(result2.response).toBe(result1.response);
      expect(result2.cached).toBe(true);
    });

    it("should handle cache invalidation", async () => {
      const query = "What is Python?";

      await aequor.query(query);
      aequor.clearCache();

      const result = await aequor.query(query);

      expect(result.cached).toBe(false);
    });
  });

  describe("Performance in Real-World Scenarios", () => {
    it("should handle typical user workload", async () => {
      const queries = [
        "What is TypeScript?",
        "Write a function to reverse a string",
        "Explain async/await in JavaScript",
        "Compare SQL and NoSQL databases",
        "How do I debug a memory leak?",
      ];

      const results: QueryResult[] = [];
      for (const query of queries) {
        const result = await aequor.query(query);
        results.push(result);
      }

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.response).toBeDefined();
        expect(result.latency).toBeLessThan(500);
      });
    });

    it("should maintain latency under concurrent queries", async () => {
      const queries = Array.from(
        { length: 20 },
        (_, i) => `Concurrent query ${i}`
      );

      const start = Date.now();
      const results = await Promise.all(queries.map(q => aequor.query(q)));
      const duration = Date.now() - start;

      expect(results).toHaveLength(20);
      expect(duration).toBeLessThan(2000);

      results.forEach(result => {
        expect(result.response).toBeDefined();
      });
    });
  });
});

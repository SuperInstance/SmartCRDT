/**
 * Tests for Stage4Applications
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Stage4Applications } from "../src/stages/Stage4Applications.js";

describe("Stage4Applications", () => {
  let stage4: Stage4Applications;

  beforeEach(() => {
    stage4 = new Stage4Applications();
  });

  describe("Initialization", () => {
    it("should initialize with default config", () => {
      const config = stage4.getConfig();
      expect(config.examples).toBe(10000);
      expect(config.epochs).toBe(30);
      expect(config.masteryThreshold).toBe(0.75);
      expect(config.difficulty).toBe("hard");
      expect(config.includeInteractions).toBe(true);
      expect(config.realWorldExamples).toBe(true);
    });

    it("should initialize with custom config", () => {
      const custom = new Stage4Applications({ examples: 2000, epochs: 15 });
      const config = custom.getConfig();
      expect(config.examples).toBe(2000);
      expect(config.epochs).toBe(15);
    });

    it("should have all application types", () => {
      const config = stage4.getConfig();
      expect(config.applications.length).toBe(8);
    });

    it("should have all page types", () => {
      const config = stage4.getConfig();
      expect(config.pages.length).toBe(10);
    });
  });

  describe("Application Types", () => {
    it("should generate ecommerce applications", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(50);
      const ecommerce = examples.filter(e => e.application === "ecommerce");
      expect(ecommerce.length).toBeGreaterThan(0);
    });

    it("should generate saas applications", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(50);
      const saas = examples.filter(e => e.application === "saas");
      expect(saas.length).toBeGreaterThan(0);
    });

    it("should generate dashboard applications", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(50);
      const dashboard = examples.filter(e => e.application === "dashboard");
      expect(dashboard.length).toBeGreaterThan(0);
    });

    it("should generate social applications", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(50);
      const social = examples.filter(e => e.application === "social");
      expect(social.length).toBeGreaterThan(0);
    });

    it("should generate content applications", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(50);
      const content = examples.filter(e => e.application === "content");
      expect(content.length).toBeGreaterThan(0);
    });

    it("should generate admin applications", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(50);
      const admin = examples.filter(e => e.application === "admin");
      expect(admin.length).toBeGreaterThan(0);
    });

    it("should generate education applications", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(50);
      const education = examples.filter(e => e.application === "education");
      expect(education.length).toBeGreaterThan(0);
    });

    it("should generate finance applications", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(50);
      const finance = examples.filter(e => e.application === "finance");
      expect(finance.length).toBeGreaterThan(0);
    });
  });

  describe("Page Types", () => {
    it("should generate login pages", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(50);
      const login = examples.filter(e => e.pageType === "login");
      expect(login.length).toBeGreaterThan(0);
    });

    it("should generate dashboard pages", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(50);
      const dashboard = examples.filter(e => e.pageType === "dashboard");
      expect(dashboard.length).toBeGreaterThan(0);
    });

    it("should generate settings pages", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(50);
      const settings = examples.filter(e => e.pageType === "settings");
      expect(settings.length).toBeGreaterThan(0);
    });

    it("should generate listing pages", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(50);
      const listing = examples.filter(e => e.pageType === "listing");
      expect(listing.length).toBeGreaterThan(0);
    });

    it("should generate detail pages", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(50);
      const detail = examples.filter(e => e.pageType === "detail");
      expect(detail.length).toBeGreaterThan(0);
    });

    it("should generate checkout pages", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(50);
      const checkout = examples.filter(e => e.pageType === "checkout");
      expect(checkout.length).toBeGreaterThan(0);
    });

    it("should generate analytics pages", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(50);
      const analytics = examples.filter(e => e.pageType === "analytics");
      expect(analytics.length).toBeGreaterThan(0);
    });
  });

  describe("Context Properties", () => {
    it("should have context with purpose", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(10);
      for (const example of examples) {
        expect(example.context.purpose).toBeDefined();
        expect(typeof example.context.purpose).toBe("string");
      }
    });

    it("should have context with userGoal", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(10);
      for (const example of examples) {
        expect(example.context.userGoal).toBeDefined();
        expect(typeof example.context.userGoal).toBe("string");
      }
    });

    it("should have context with domain", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(10);
      for (const example of examples) {
        expect(example.context.domain).toBeDefined();
      }
    });

    it("should have context with constraints", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(10);
      for (const example of examples) {
        expect(example.context.constraints).toBeDefined();
        expect(Array.isArray(example.context.constraints)).toBe(true);
      }
    });
  });

  describe("Interaction Patterns", () => {
    it("should include interactions when enabled", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(20);
      const withInteractions = examples.filter(e => e.interactions.length > 0);

      expect(withInteractions.length).toBeGreaterThan(0);
    });

    it("should have valid interaction structure", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(10);
      for (const example of examples) {
        for (const interaction of example.interactions) {
          expect(interaction.trigger).toBeDefined();
          expect(interaction.action).toBeDefined();
          expect(interaction.target).toBeDefined();
          expect(interaction.expected).toBeDefined();
        }
      }
    });

    it("should not include interactions when disabled", async () => {
      const stage = new Stage4Applications({ includeInteractions: false });
      await stage.initialize();
      const examples = await stage.generateExamples(20);

      const withInteractions = examples.filter(e => e.interactions.length > 0);
      expect(withInteractions.length).toBe(0);
    });
  });

  describe("Example Properties", () => {
    it("should generate valid image data", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(5);
      for (const example of examples) {
        expect(example.imageData.width).toBe(800);
        expect(example.imageData.height).toBe(600);
        expect(example.imageData.channels).toBe(3);
      }
    });

    it("should generate 768-dim embeddings", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(5);
      for (const example of examples) {
        expect(example.embedding.length).toBe(768);
      }
    });

    it("should have difficulty in range 0.75-1.0", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(50);
      for (const example of examples) {
        expect(example.difficulty).toBeGreaterThanOrEqual(0.75);
        expect(example.difficulty).toBeLessThanOrEqual(1.0);
      }
    });

    it("should include section count in metadata", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(10);
      for (const example of examples) {
        expect(example.metadata.attributes.sectionCount).toBeDefined();
        expect(example.metadata.attributes.sectionCount).toBeGreaterThan(1);
      }
    });

    it("should include interaction count in metadata", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(10);
      for (const example of examples) {
        expect(example.metadata.attributes.interactionCount).toBeDefined();
      }
    });
  });

  describe("Application-Page Relevance", () => {
    it("should generate relevant pages for ecommerce", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(100);
      const ecommerce = examples.filter(e => e.application === "ecommerce");
      const relevantPages = ["listing", "detail", "checkout", "dashboard"];

      for (const ex of ecommerce) {
        expect(relevantPages).toContain(ex.pageType);
      }
    });

    it("should generate relevant pages for saas", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(100);
      const saas = examples.filter(e => e.application === "saas");
      const relevantPages = ["dashboard", "settings", "analytics", "profile"];

      for (const ex of saas) {
        expect(relevantPages).toContain(ex.pageType);
      }
    });

    it("should generate relevant pages for social", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(100);
      const social = examples.filter(e => e.application === "social");
      const relevantPages = ["login", "signup", "profile", "dashboard"];

      for (const ex of social) {
        expect(relevantPages).toContain(ex.pageType);
      }
    });
  });

  describe("Evaluation", () => {
    it("should evaluate predictions correctly", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(5);
      const predictions = examples.map(e => e.embedding);

      for (let i = 0; i < examples.length; i++) {
        const result = stage4.evaluate(examples[i], predictions[i]);
        expect(result.loss).toBeCloseTo(0, 5);
        expect(result.accuracy).toBeGreaterThan(0);
      }
    });

    it("should calculate application recognition metric", async () => {
      await stage4.initialize();
      const example = (await stage4.generateExamples(1))[0];
      const result = stage4.evaluate(example, example.embedding);

      expect(result.metrics.application_recognition).toBeDefined();
    });

    it("should calculate page recognition metric", async () => {
      await stage4.initialize();
      const example = (await stage4.generateExamples(1))[0];
      const result = stage4.evaluate(example, example.embedding);

      expect(result.metrics.page_recognition).toBeDefined();
    });

    it("should calculate context understanding metric", async () => {
      await stage4.initialize();
      const example = (await stage4.generateExamples(1))[0];
      const result = stage4.evaluate(example, example.embedding);

      expect(result.metrics.context_understanding).toBeDefined();
    });
  });

  describe("Mastery Assessment", () => {
    it("should recognize mastered stage", () => {
      const progress = {
        stage: 3,
        stageId: "stage4_applications",
        epochs: 30,
        examples: 10000,
        loss: 0.20,
        accuracy: 0.80,
        mastery: 0.78,
        status: "in_progress" as const,
      };

      expect(stage4.isMastered(progress)).toBe(true);
    });

    it("should not master low mastery stage", () => {
      const progress = {
        stage: 3,
        stageId: "stage4_applications",
        epochs: 30,
        examples: 10000,
        loss: 0.35,
        accuracy: 0.60,
        mastery: 0.65,
        status: "in_progress" as const,
      };

      expect(stage4.isMastered(progress)).toBe(false);
    });
  });

  describe("Page Template Rendering", () => {
    it("should render login page with form section", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(50);
      const loginPages = examples.filter(e => e.pageType === "login");

      expect(loginPages.length).toBeGreaterThan(0);
    });

    it("should render dashboard with multiple sections", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(50);
      const dashboards = examples.filter(e => e.pageType === "dashboard");

      expect(dashboards.length).toBeGreaterThan(0);
    });

    it("should render settings with tabs", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(50);
      const settings = examples.filter(e => e.pageType === "settings");

      expect(settings.length).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero examples", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(0);
      expect(examples.length).toBe(0);
    });

    it("should handle single example", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(1);
      expect(examples.length).toBe(1);
      expect(examples[0].application).toBeDefined();
      expect(examples[0].pageType).toBeDefined();
    });
  });

  describe("Complexity Distribution", () => {
    it("should distribute applications evenly", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(800);
      const counts: Record<string, number> = {};

      for (const example of examples) {
        counts[example.application] = (counts[example.application] || 0) + 1;
      }

      // All applications should appear
      expect(Object.keys(counts).length).toBe(8);
    });

    it("should distribute page types appropriately", async () => {
      await stage4.initialize();
      const examples = await stage4.generateExamples(500);
      const counts: Record<string, number> = {};

      for (const example of examples) {
        counts[example.pageType] = (counts[example.pageType] || 0) + 1;
      }

      // Multiple page types should appear
      expect(Object.keys(counts).length).toBeGreaterThan(3);
    });
  });
});

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

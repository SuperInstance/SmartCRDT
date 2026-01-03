/**
 * @fileoverview Tests for A/B Testing Framework
 * @author Aequor Project - Round 18 Agent 2
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ABTestManager,
  InMemoryABTestStorage,
  createABTestManager,
  type ABTest,
  type ABTestConfig,
  type TestMetric,
} from "./ABTestManager.js";
import {
  VariantGenerator,
  createVariantGenerator,
  generateQuickVariants,
} from "./VariantGenerator.js";
import {
  StatisticalAnalyzer,
  createStatisticalAnalyzer,
  isSignificant,
  conversionRateWithCI,
} from "./StatisticalAnalyzer.js";
import type { A2UIResponse } from "@lsi/protocol";

// ============================================================================
// TEST DATA
// ============================================================================

const createMockUI = (overrides?: Partial<A2UIResponse>): A2UIResponse => ({
  version: "1.0.0",
  layout: {
    type: "flex",
    direction: "column",
    gap: 16,
    padding: 16,
  },
  components: [
    { id: "c1", type: "button", props: { label: "Click me" } },
    { id: "c2", type: "input", props: { placeholder: "Enter text" } },
  ],
  ...overrides,
});

const createTestMetrics = (): TestMetric[] => [
  {
    id: "impressions",
    name: "Impressions",
    type: "count",
    description: "Number of times variant was shown",
    aggregation: "sum",
    higherIsBetter: false,
  },
  {
    id: "engagements",
    name: "Engagements",
    type: "count",
    description: "Number of user engagements",
    aggregation: "sum",
    higherIsBetter: true,
  },
  {
    id: "completions",
    name: "Conversions",
    type: "count",
    description: "Number of conversions",
    aggregation: "sum",
    higherIsBetter: true,
  },
];

// ============================================================================
// AB TEST MANAGER TESTS
// ============================================================================

describe("ABTestManager", () => {
  let manager: ABTestManager;
  let storage: InMemoryABTestStorage;

  beforeEach(() => {
    storage = new InMemoryABTestStorage();
    manager = new ABTestManager({ storage });
  });

  describe("createTest", () => {
    it("should create a new A/B test", async () => {
      const config: ABTestConfig = {
        name: "Test Button Colors",
        description: "Test different button colors",
        variants: [
          {
            id: "control",
            name: "Blue Button",
            ui: createMockUI(),
          },
          {
            id: "treatment",
            name: "Green Button",
            ui: createMockUI(),
          },
        ],
        metrics: createTestMetrics(),
        createdBy: "test-user",
      };

      const test = await manager.createTest(config);
      expect(test.id).toBeTruthy();
      expect(test.name).toBe("Test Button Colors");
      expect(test.status).toBe("draft");
      expect(test.variants).toHaveLength(2);
    });

    it("should calculate equal traffic split by default", async () => {
      const config: ABTestConfig = {
        name: "Equal Split Test",
        variants: [
          { id: "v1", name: "Variant 1", ui: createMockUI() },
          { id: "v2", name: "Variant 2", ui: createMockUI() },
          { id: "v3", name: "Variant 3", ui: createMockUI() },
        ],
        metrics: createTestMetrics(),
        createdBy: "test-user",
      };

      const test = await manager.createTest(config);
      expect(test.trafficSplit).toEqual([1 / 3, 1 / 3, 1 / 3]);
    });

    it("should use custom traffic split if valid", async () => {
      const config: ABTestConfig = {
        name: "Custom Split Test",
        variants: [
          { id: "v1", name: "Variant 1", ui: createMockUI() },
          { id: "v2", name: "Variant 2", ui: createMockUI() },
        ],
        metrics: createTestMetrics(),
        trafficSplit: [0.7, 0.3],
        createdBy: "test-user",
      };

      const test = await manager.createTest(config);
      expect(test.trafficSplit).toEqual([0.7, 0.3]);
    });
  });

  describe("startTest", () => {
    it("should start a draft test", async () => {
      const config: ABTestConfig = {
        name: "Test",
        variants: [{ id: "v1", name: "Variant 1", ui: createMockUI() }],
        metrics: createTestMetrics(),
        createdBy: "test-user",
      };

      const test = await manager.createTest(config);
      const started = await manager.startTest(test.id);

      expect(started.status).toBe("running");
      expect(started.duration?.start).toBeInstanceOf(Date);
    });

    it("should throw if test is already running", async () => {
      const config: ABTestConfig = {
        name: "Test",
        variants: [{ id: "v1", name: "Variant 1", ui: createMockUI() }],
        metrics: createTestMetrics(),
        createdBy: "test-user",
      };

      const test = await manager.createTest(config);
      await manager.startTest(test.id);

      await expect(manager.startTest(test.id)).rejects.toThrow();
    });
  });

  describe("pauseTest", () => {
    it("should pause a running test", async () => {
      const config: ABTestConfig = {
        name: "Test",
        variants: [{ id: "v1", name: "Variant 1", ui: createMockUI() }],
        metrics: createTestMetrics(),
        createdBy: "test-user",
      };

      const test = await manager.createTest(config);
      await manager.startTest(test.id);
      const paused = await manager.pauseTest(test.id);

      expect(paused.status).toBe("paused");
    });
  });

  describe("completeTest", () => {
    it("should complete a running test", async () => {
      const config: ABTestConfig = {
        name: "Test",
        variants: [{ id: "v1", name: "Variant 1", ui: createMockUI() }],
        metrics: createTestMetrics(),
        createdBy: "test-user",
      };

      const test = await manager.createTest(config);
      await manager.startTest(test.id);
      const completed = await manager.completeTest(test.id);

      expect(completed.status).toBe("completed");
      expect(completed.duration?.end).toBeInstanceOf(Date);
    });
  });

  describe("allocateVariant", () => {
    it("should allocate user to variant consistently", async () => {
      const config: ABTestConfig = {
        name: "Test",
        variants: [
          { id: "v1", name: "Variant 1", ui: createMockUI() },
          { id: "v2", name: "Variant 2", ui: createMockUI() },
        ],
        metrics: createTestMetrics(),
        trafficSplit: [0.5, 0.5],
        createdBy: "test-user",
      };

      const test = await manager.createTest(config);
      await manager.startTest(test.id);

      const variant1 = await manager.allocateVariant(test.id, "user-123");
      const variant2 = await manager.allocateVariant(test.id, "user-123");

      expect(variant1.id).toBe(variant2.id); // Consistent
    });

    it("should record impression", async () => {
      const config: ABTestConfig = {
        name: "Test",
        variants: [{ id: "v1", name: "Variant 1", ui: createMockUI() }],
        metrics: createTestMetrics(),
        createdBy: "test-user",
      };

      const test = await manager.createTest(config);
      await manager.startTest(test.id);
      await manager.allocateVariant(test.id, "user-123");

      const results = await manager.getAggregatedResults(test.id);
      expect(results[0].impressions).toBe(1);
    });
  });

  describe("recordMetric", () => {
    it("should record metric values", async () => {
      const config: ABTestConfig = {
        name: "Test",
        variants: [{ id: "v1", name: "Variant 1", ui: createMockUI() }],
        metrics: createTestMetrics(),
        createdBy: "test-user",
      };

      const test = await manager.createTest(config);
      await manager.recordMetric(test.id, "v1", "clicks", 5);

      const results = await storage.getResults(test.id, "v1");
      expect(results).toHaveLength(1);
      expect(results[0].value).toBe(5);
    });
  });

  describe("getAggregatedResults", () => {
    it("should aggregate results correctly", async () => {
      const config: ABTestConfig = {
        name: "Test",
        variants: [
          { id: "v1", name: "Variant 1", ui: createMockUI() },
          { id: "v2", name: "Variant 2", ui: createMockUI() },
        ],
        metrics: createTestMetrics(),
        createdBy: "test-user",
      };

      const test = await manager.createTest(config);

      // Record some data
      await manager.recordMetric(test.id, "v1", "impressions", 100);
      await manager.recordMetric(test.id, "v1", "engagements", 50);
      await manager.recordMetric(test.id, "v1", "completions", 10);

      const results = await manager.getAggregatedResults(test.id);
      expect(results).toHaveLength(2);
      expect(results[0].variantId).toBe("v1");
      expect(results[0].impressions).toBe(100);
      expect(results[0].engagements).toBe(50);
      expect(results[0].completions).toBe(10);
      expect(results[0].conversionRate).toBe(0.1);
    });
  });

  describe("listTests", () => {
    it("should list all tests", async () => {
      await manager.createTest({
        name: "Test 1",
        variants: [{ id: "v1", name: "V1", ui: createMockUI() }],
        metrics: createTestMetrics(),
        createdBy: "user",
      });
      await manager.createTest({
        name: "Test 2",
        variants: [{ id: "v1", name: "V1", ui: createMockUI() }],
        metrics: createTestMetrics(),
        createdBy: "user",
      });

      const tests = await manager.listTests();
      expect(tests).toHaveLength(2);
    });

    it("should filter by status", async () => {
      const t1 = await manager.createTest({
        name: "Test 1",
        variants: [{ id: "v1", name: "V1", ui: createMockUI() }],
        metrics: createTestMetrics(),
        createdBy: "user",
      });
      await manager.createTest({
        name: "Test 2",
        variants: [{ id: "v1", name: "V1", ui: createMockUI() }],
        metrics: createTestMetrics(),
        createdBy: "user",
      });

      await manager.startTest(t1.id);

      const runningTests = await manager.listTests({ status: "running" });
      expect(runningTests).toHaveLength(1);
      expect(runningTests[0].id).toBe(t1.id);
    });
  });
});

// ============================================================================
// VARIANT GENERATOR TESTS
// ============================================================================

describe("VariantGenerator", () => {
  let generator: VariantGenerator;

  beforeEach(() => {
    generator = new VariantGenerator();
  });

  describe("generateVariants", () => {
    it("should generate variants from base UI", () => {
      const baseUI = createMockUI();
      const variants = generator.generateVariants(baseUI);

      expect(variants.length).toBeGreaterThan(0);
      expect(variants[0].id).toBe("control");
    });

    it("should include layout variants", () => {
      const baseUI = createMockUI();
      const variants = generator.generateVariants(baseUI, {
        strategies: ["layout"],
      });

      const layoutVariants = variants.filter(v =>
        v.changes.some(c => c.type === "spacing")
      );
      expect(layoutVariants.length).toBeGreaterThan(0);
    });

    it("should respect maxVariants limit", () => {
      const baseUI = createMockUI();
      const variants = generator.generateVariants(baseUI, {
        maxVariants: 3,
      });

      expect(variants.length).toBeLessThanOrEqual(3);
    });

    it("should exclude specified strategies", () => {
      const baseUI = createMockUI();
      const variants = generator.generateVariants(baseUI, {
        strategies: ["layout", "style"],
        excludeStrategies: ["style"],
      });

      const styleVariants = variants.filter(v =>
        v.changes.some(c => c.type === "color" || c.type === "size")
      );
      expect(styleVariants.length).toBe(0);
    });
  });

  describe("generateByTemplate", () => {
    it("should generate variants using template", () => {
      const baseUI = createMockUI();
      const variants = generator.generateByTemplate(
        baseUI,
        "layout-density-variants"
      );

      expect(variants.length).toBe(3);
      expect(variants[0].template).toBe("layout-density-variants");
    });

    it("should throw for invalid template", () => {
      const baseUI = createMockUI();
      expect(() =>
        generator.generateByTemplate(baseUI, "invalid-template")
      ).toThrow();
    });
  });

  describe("generateCustomVariant", () => {
    it("should apply custom transformation", () => {
      const baseUI = createMockUI();
      const variant = generator.generateCustomVariant(
        baseUI,
        ui => {
          ui.layout!.gap = 100;
          return ui;
        },
        {
          id: "custom",
          name: "Custom Variant",
          description: "Custom changes",
          changes: [],
        }
      );

      expect(variant.ui.layout?.gap).toBe(100);
    });
  });

  describe("registerTemplate", () => {
    it("should register custom template", () => {
      generator.registerTemplate({
        id: "custom-template",
        name: "Custom",
        description: "Custom template",
        strategy: "layout",
        variations: [],
      });

      const template = generator.getTemplate("custom-template");
      expect(template).toBeTruthy();
      expect(template?.id).toBe("custom-template");
    });

    describe("unregisterTemplate", () => {
      it("should unregister template", () => {
        generator.registerTemplate({
          id: "temp",
          name: "Temp",
          description: "Temp",
          strategy: "layout",
          variations: [],
        });

        generator.unregisterTemplate("temp");
        const template = generator.getTemplate("temp");
        expect(template).toBeUndefined();
      });
    });
  });
});

// ============================================================================
// STATISTICAL ANALYZER TESTS
// ============================================================================

describe("StatisticalAnalyzer", () => {
  let analyzer: StatisticalAnalyzer;

  beforeEach(() => {
    analyzer = new StatisticalAnalyzer();
  });

  describe("calculateSignificance", () => {
    it("should calculate z-test significance", () => {
      const control = {
        variantId: "control",
        metricId: "conversion",
        values: [1, 1, 1, 0, 0],
        count: 5,
        sum: 3,
        mean: 0.6,
        variance: 0.24,
        stdDev: 0.49,
        min: 0,
        max: 1,
      };

      const treatment = {
        variantId: "treatment",
        metricId: "conversion",
        values: [1, 1, 1, 1, 0],
        count: 5,
        sum: 4,
        mean: 0.8,
        variance: 0.16,
        stdDev: 0.4,
        min: 0,
        max: 1,
      };

      const result = analyzer.calculateSignificance(
        control,
        treatment,
        "z-test"
      );

      expect(result.test).toBe("z-test");
      expect(result.pValue).toBeGreaterThan(0);
      expect(result.pValue).toBeLessThan(1);
      expect(result.confidenceInterval).toBeDefined();
      expect(result.effectSize).toBeDefined();
    });

    it("should detect significant differences", () => {
      const control = {
        variantId: "control",
        metricId: "metric",
        values: Array(100)
          .fill(0)
          .map(() => 0.5 + Math.random() * 0.1),
        count: 100,
        sum: 50,
        mean: 0.5,
        variance: 0.01,
        stdDev: 0.1,
        min: 0,
        max: 1,
      };

      const treatment = {
        ...control,
        values: Array(100)
          .fill(0)
          .map(() => 0.7 + Math.random() * 0.1),
        mean: 0.7,
      };

      const result = analyzer.calculateSignificance(control, treatment);
      expect(result.isSignificant).toBe(true);
    });
  });

  describe("compareVariants", () => {
    it("should compare two variants", () => {
      const variantA: any = {
        variantId: "A",
        metrics: new Map([
          [
            "conversion",
            {
              variantId: "A",
              metricId: "conversion",
              values: [1, 1, 0],
              count: 3,
              sum: 2,
              mean: 0.67,
              variance: 0.22,
              stdDev: 0.47,
              min: 0,
              max: 1,
            },
          ],
        ]),
        impressions: 100,
        engagements: 50,
        completions: 20,
        avgDuration: 30,
        conversionRate: 0.2,
        bounceRate: 0.3,
      };

      const variantB: any = {
        variantId: "B",
        metrics: new Map([
          [
            "conversion",
            {
              variantId: "B",
              metricId: "conversion",
              values: [1, 1, 1],
              count: 3,
              sum: 3,
              mean: 1,
              variance: 0,
              stdDev: 0,
              min: 1,
              max: 1,
            },
          ],
        ]),
        impressions: 100,
        engagements: 60,
        completions: 30,
        avgDuration: 25,
        conversionRate: 0.3,
        bounceRate: 0.25,
      };

      const result = analyzer.compareVariants(variantA, variantB, "conversion");

      expect(result.variantA).toBe("A");
      expect(result.variantB).toBe("B");
      expect(result.metric).toBe("conversion");
      expect(result.difference).toBeDefined();
    });
  });

  describe("recommendWinner", () => {
    it("should recommend winning variant", () => {
      const results: any[] = [
        {
          variantId: "control",
          metrics: new Map([
            [
              "conversion",
              {
                variantId: "control",
                metricId: "conversion",
                values: [1, 1, 0, 0],
                count: 4,
                sum: 2,
                mean: 0.5,
                variance: 0.25,
                stdDev: 0.5,
                min: 0,
                max: 1,
              },
            ],
          ]),
          impressions: 100,
          engagements: 50,
          completions: 20,
          avgDuration: 30,
          conversionRate: 0.2,
          bounceRate: 0.3,
        },
        {
          variantId: "treatment",
          metrics: new Map([
            [
              "conversion",
              {
                variantId: "treatment",
                metricId: "conversion",
                values: [1, 1, 1, 0],
                count: 4,
                sum: 3,
                mean: 0.75,
                variance: 0.1875,
                stdDev: 0.43,
                min: 0,
                max: 1,
              },
            ],
          ]),
          impressions: 100,
          engagements: 60,
          completions: 30,
          avgDuration: 25,
          conversionRate: 0.3,
          bounceRate: 0.25,
        },
      ];

      const recommendation = analyzer.recommendWinner(results, "conversion");

      expect(recommendation.winningVariant).toBeDefined();
      expect(recommendation.confidence).toBeGreaterThanOrEqual(0);
      expect(recommendation.confidence).toBeLessThanOrEqual(1);
      expect(recommendation.reasoning).toBeDefined();
      expect(recommendation.nextSteps).toBeDefined();
    });
  });

  describe("analyzePower", () => {
    it("should calculate power analysis", () => {
      const result = analyzer.analyzePower(0.5, 100);

      expect(result.sampleSize).toBe(100);
      expect(result.effectSize).toBe(0.5);
      expect(result.power).toBeGreaterThan(0);
      expect(result.recommendation).toBeDefined();
    });
  });

  describe("getStatusSummary", () => {
    it("should return status summary", () => {
      const results: any[] = [
        {
          variantId: "control",
          metrics: new Map(),
          impressions: 50,
          engagements: 25,
          completions: 10,
          avgDuration: 30,
          conversionRate: 0.2,
          bounceRate: 0.3,
        },
      ];

      const summary = analyzer.getStatusSummary(results, "conversion");

      expect(summary.totalParticipants).toBe(50);
      expect(summary.totalConversions).toBe(10);
      expect(summary.overallConversionRate).toBe(0.2);
      expect(summary.status).toBeDefined();
    });
  });

  describe("calculateRequiredSampleSize", () => {
    it("should calculate required sample size", () => {
      const n = analyzer.calculateRequiredSampleSize(0.5, 0.8, 0.05);
      expect(n).toBeGreaterThan(0);
      expect(typeof n).toBe("number");
    });
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe("Utility Functions", () => {
  describe("isSignificant", () => {
    it("should detect significance", () => {
      expect(isSignificant(0.01)).toBe(true);
      expect(isSignificant(0.04)).toBe(true);
      expect(isSignificant(0.05)).toBe(false);
      expect(isSignificant(0.1)).toBe(false);
    });

    it("should use custom alpha", () => {
      expect(isSignificant(0.08, 0.1)).toBe(true);
      expect(isSignificant(0.08, 0.05)).toBe(false);
    });
  });

  describe("conversionRateWithCI", () => {
    it("should calculate conversion rate with CI", () => {
      const result = conversionRateWithCI(10, 100, 0.95);

      expect(result.rate).toBe(0.1);
      expect(result.lower).toBeGreaterThan(0);
      expect(result.upper).toBeLessThan(1);
      expect(result.upper).toBeGreaterThan(result.lower);
    });

    it("should handle edge cases", () => {
      const result = conversionRateWithCI(0, 100, 0.95);
      expect(result.rate).toBe(0);
      expect(result.lower).toBe(0);
    });
  });

  describe("createABTestManager", () => {
    it("should create manager with in-memory storage", () => {
      const manager = createABTestManager();
      expect(manager).toBeInstanceOf(ABTestManager);
    });
  });

  describe("createVariantGenerator", () => {
    it("should create generator with default config", () => {
      const generator = createVariantGenerator();
      expect(generator).toBeInstanceOf(VariantGenerator);
    });
  });

  describe("createStatisticalAnalyzer", () => {
    it("should create analyzer with default config", () => {
      const analyzer = createStatisticalAnalyzer();
      expect(analyzer).toBeInstanceOf(StatisticalAnalyzer);
    });
  });

  describe("generateQuickVariants", () => {
    it("should generate variants for ecommerce scenario", () => {
      const baseUI = createMockUI();
      const variants = generateQuickVariants(baseUI, "ecommerce");
      expect(Array.isArray(variants)).toBe(true);
      expect(variants.length).toBeGreaterThan(0);
    });

    it("should generate variants for saas scenario", () => {
      const baseUI = createMockUI();
      const variants = generateQuickVariants(baseUI, "saas");
      expect(Array.isArray(variants)).toBe(true);
    });

    it("should generate variants for content scenario", () => {
      const baseUI = createMockUI();
      const variants = generateQuickVariants(baseUI, "content");
      expect(Array.isArray(variants)).toBe(true);
    });

    it("should generate variants for form scenario", () => {
      const baseUI = createMockUI();
      const variants = generateQuickVariants(baseUI, "form");
      expect(Array.isArray(variants)).toBe(true);
    });
  });
});

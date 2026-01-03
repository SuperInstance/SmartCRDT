/**
 * @lsi/vljepa-synthetic - Generation Pipeline
 *
 * Orchestrates the complete synthetic UI data generation pipeline.
 *
 * @module pipelines
 */

import type {
  PipelineConfig,
  PipelineResult,
  PipelineStats,
  GeneratedSample,
  GeneratedComponent,
  GeneratedLayout,
  ComponentType,
} from "../types.js";
import { ComponentGenerator } from "../generators/ComponentGenerator.js";
import { LayoutGenerator } from "../generators/LayoutGenerator.js";
import {
  ColorMutator,
  LayoutMutator,
  StyleMutator,
  ContentMutator,
} from "../mutators/index.js";
import { ScreenshotRenderer } from "../renderers/ScreenshotRenderer.js";
import {
  AccessibilityValidator,
  DesignValidator,
  DiversityValidator,
} from "../validators/index.js";
import { generateId, chunk } from "../utils.js";

export class GenerationPipeline {
  private config: PipelineConfig;
  private componentGenerator: ComponentGenerator;
  private layoutGenerator: LayoutGenerator;
  private colorMutator: ColorMutator;
  private layoutMutator: LayoutMutator;
  private styleMutator: StyleMutator;
  private contentMutator: ContentMutator;
  private screenshotRenderer: ScreenshotRenderer;
  private accessibilityValidator: AccessibilityValidator;
  private designValidator: DesignValidator;
  private diversityValidator: DiversityValidator;

  constructor(config: PipelineConfig) {
    this.config = config;

    // Initialize generators
    this.componentGenerator = new ComponentGenerator(config.componentGen);
    this.layoutGenerator = new LayoutGenerator(config.layoutGen);

    // Initialize mutators
    this.colorMutator = new ColorMutator(config.mutation);
    this.layoutMutator = new LayoutMutator(config.mutation);
    this.styleMutator = new StyleMutator(config.mutation);
    this.contentMutator = new ContentMutator(config.mutation);

    // Initialize renderer
    this.screenshotRenderer = new ScreenshotRenderer(config.renderer);

    // Initialize validators
    this.accessibilityValidator = new AccessibilityValidator();
    this.designValidator = new DesignValidator();
    this.diversityValidator = new DiversityValidator();
  }

  /**
   * Run the complete generation pipeline
   */
  async run(count: number): Promise<PipelineResult> {
    const startTime = Date.now();
    const id = generateId("pipeline");

    const stats: PipelineStats = {
      generated: 0,
      passedValidation: 0,
      failed: 0,
      diversity: 0,
      avgValidationScore: 0,
      totalDuration: 0,
      avgDuration: 0,
      stageBreakdown: {
        generate: { duration: 0, success: 0, failed: 0 },
        mutate: { duration: 0, success: 0, failed: 0 },
        validate: { duration: 0, success: 0, failed: 0 },
        render: { duration: 0, success: 0, failed: 0 },
        package: { duration: 0, success: 0, failed: 0 },
      },
    };

    const samples: GeneratedSample[] = [];
    let success = true;
    let error: string | undefined;

    try {
      // Process in batches
      const batches = chunk(
        Array.from({ length: count }, (_, i) => i),
        this.config.batchSize
      );

      for (const batch of batches) {
        const batchResults = await this.processBatch(batch.length);
        samples.push(...batchResults);
        stats.generated += batchResults.length;
      }

      // Calculate final stats
      stats.passedValidation = samples.filter(
        s =>
          s.validation &&
          s.validation.overall >= this.config.validation.minScore
      ).length;
      stats.failed = stats.generated - stats.passedValidation;
      stats.totalDuration = Date.now() - startTime;
      stats.avgDuration = stats.totalDuration / stats.generated;

      // Calculate diversity
      const allComponents = samples.map(s => s.component);
      const diversityReport =
        this.diversityValidator.analyzeComponents(allComponents);
      stats.diversity = diversityReport.overallScore;
      stats.avgValidationScore =
        samples.reduce((sum, s) => sum + (s.validation?.overall ?? 0), 0) /
        samples.length;
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : String(err);
    }

    return {
      id,
      startTime,
      endTime: Date.now(),
      stats,
      samples,
      outputDir: this.config.output.directory,
      success,
      error,
    };
  }

  /**
   * Process a batch of samples
   */
  private async processBatch(batchSize: number): Promise<GeneratedSample[]> {
    const samples: GeneratedSample[] = [];

    for (let i = 0; i < batchSize; i++) {
      const sample = await this.processSample();
      if (sample) {
        samples.push(sample);
      }
    }

    return samples;
  }

  /**
   * Process a single sample through the pipeline
   */
  private async processSample(): Promise<GeneratedSample | null> {
    const seed = Date.now() + Math.random();

    // Stage 1: Generate
    const componentType = this.rng.pick<ComponentType>(
      this.config.componentGen.componentTypes
    );
    const component = this.componentGenerator.generate(componentType);

    // Stage 2: Mutate
    const mutations: any[] = [];
    if (this.config.stages.includes("mutate")) {
      const colorResult = this.colorMutator.mutate({
        components: [component],
        globalStyles: {},
        theme: this.getDefaultTheme(),
      });
      mutations.push(...colorResult.mutations);
    }

    // Stage 3: Validate
    let validation: GeneratedSample["validation"] = undefined;
    if (this.config.stages.includes("validate")) {
      const a11yResult = this.accessibilityValidator.validate(component);
      const designResult = this.designValidator.validate(component);

      validation = {
        accessibility: a11yResult,
        design: designResult,
        overall: (a11yResult.score + designResult.score) / 2,
      };
    }

    // Stage 4: Render
    let render: GeneratedSample["render"] = undefined;
    if (
      this.config.stages.includes("render") &&
      (!validation || validation.overall >= this.config.validation.minScore)
    ) {
      render = await this.screenshotRenderer.renderComponent(component);
    }

    // Determine dataset split
    const split = this.determineSplit();

    return {
      id: generateId("sample"),
      component,
      mutations: mutations.length > 0 ? mutations : undefined,
      render,
      validation,
      metadata: {
        timestamp: Date.now(),
        seed,
        tags: [componentType, component.metadata.styleSystem],
        split,
      },
    };
  }

  /**
   * Determine dataset split based on ratios
   */
  private determineSplit(): "train" | "validation" | "test" {
    const rand = Math.random();
    if (rand < this.config.output.split.train) return "train";
    if (
      rand <
      this.config.output.split.train + this.config.output.split.validation
    )
      return "validation";
    return "test";
  }

  /**
   * Get default theme colors
   */
  private getDefaultTheme() {
    return {
      primary: "#3b82f6",
      secondary: "#64748b",
      accent: "#8b5cf6",
      background: "#ffffff",
      text: "#1e293b",
      error: "#ef4444",
      warning: "#f59e0b",
      success: "#22c55e",
    };
  }

  // Mock RNG
  private rng = {
    pick: <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)],
  };
}

/**
 * @lsi/vljepa-synthetic - Synthetic UI Data Generation Engine
 *
 * Main entry point for the synthetic UI data generation package.
 * Generates 50K+ synthetic UI variations for VL-JEPA training.
 *
 * @packageDocumentation
 */

// ============================================================================
// GENERATORS
// ============================================================================

export { ComponentGenerator } from "./generators/ComponentGenerator.js";
export type { ComponentGeneratorConfig } from "./types.js";

export { LayoutGenerator } from "./generators/LayoutGenerator.js";
export type { LayoutGeneratorConfig } from "./types.js";

export {
  PageGenerator,
  type PageGeneratorConfig,
  type GeneratedPage,
} from "./generators/PageGenerator.js";

export {
  StyleGenerator,
  type StyleGeneratorConfig,
} from "./generators/StyleGenerator.js";

// ============================================================================
// MUTATORS
// ============================================================================

export { ColorMutator } from "./mutators/ColorMutator.js";
export { LayoutMutator } from "./mutators/LayoutMutator.js";
export { StyleMutator } from "./mutators/StyleMutator.js";
export { ContentMutator } from "./mutators/ContentMutator.js";

// ============================================================================
// RENDERERS
// ============================================================================

export { ScreenshotRenderer } from "./renderers/ScreenshotRenderer.js";
export { HTMLRenderer } from "./renderers/HTMLRenderer.js";
export {
  ReactRenderer,
  type ReactComponentOptions,
} from "./renderers/ReactRenderer.js";

// ============================================================================
// VALIDATORS
// ============================================================================

export { AccessibilityValidator } from "./validators/AccessibilityValidator.js";
export { DesignValidator } from "./validators/DesignValidator.js";
export { DiversityValidator } from "./validators/DiversityValidator.js";

// ============================================================================
// PIPELINES
// ============================================================================

export { GenerationPipeline } from "./pipelines/GenerationPipeline.js";
export type { PipelineConfig, PipelineResult, PipelineStats } from "./types.js";

export { BatchProcessor } from "./pipelines/BatchProcessor.js";
export type {
  BatchProcessorConfig,
  BatchProgress,
  ProgressCallback,
} from "./types.js";

// ============================================================================
// TYPES
// ============================================================================

export * from "./types.js";

// ============================================================================
// UTILITIES
// ============================================================================

export {
  createSeededRandom,
  createColorUtils,
  generateId,
  camelToKebab,
  kebabToCamel,
  escapeHtml,
  chunk,
  flatten,
  unique,
  groupBy,
} from "./utils.js";

// ============================================================================
// DEFAULT EXPORTS
// ============================================================================

export { ComponentGenerator as default } from "./generators/ComponentGenerator.js";

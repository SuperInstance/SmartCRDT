/**
 * VL-JEPA Transfer Learning Package
 * Transfer VL-JEPA models to other UI frameworks
 */

// ============================================================================
// Adapters
// ============================================================================

export {
  FrameworkAdapter,
  BaseFrameworkAdapter,
  AdapterRegistry,
  type FrameworkAdapter as FrameworkAdapterInterface,
} from "./adapters/FrameworkAdapter.js";

export { ReactAdapter } from "./adapters/ReactAdapter.js";
export { VueAdapter, type VueAdapterConfig } from "./adapters/VueAdapter.js";
export {
  AngularAdapter,
  type AngularAdapterConfig,
} from "./adapters/AngularAdapter.js";
export {
  FlutterAdapter,
  type FlutterAdapterConfig,
} from "./adapters/FlutterAdapter.js";
export {
  SvelteAdapter,
  type SvelteAdapterConfig,
} from "./adapters/SvelteAdapter.js";
export {
  SwiftUIAdapter,
  type SwiftUIAdapterConfig,
} from "./adapters/SwiftUIAdapter.js";

// ============================================================================
// Converters
// ============================================================================

export { DOMConverter } from "./converters/DOMConverter.js";
export { ComponentConverter } from "./converters/ComponentConverter.js";
export { StyleConverter } from "./converters/StyleConverter.js";

// ============================================================================
// Training
// ============================================================================

export {
  TransferTrainer,
  LearningRateScheduler,
  createOptimizer,
  type TransferLearningConfig,
  type OptimizerConfig,
  type FreezeStrategy,
  getFreezeLayers,
} from "./training/TransferTrainer.js";

export { FineTuner } from "./training/FineTuner.js";
export { DomainAdapter } from "./training/DomainAdapter.js";

// ============================================================================
// Evaluation
// ============================================================================

export {
  TransferEvaluator,
  type TransferEvaluation,
  type ClassMetrics,
} from "./evaluation/TransferEvaluator.js";

export {
  FrameworkEvaluator,
  type FrameworkMetrics,
} from "./evaluation/FrameworkEvaluator.js";

export {
  CompatibilityChecker,
  type CompatibilityReport,
  type CompatibilityIssue,
} from "./evaluation/CompatibilityChecker.js";

// ============================================================================
// Datasets
// ============================================================================

export {
  FrameworkDataset,
  ComponentDataset,
  StyleDataset,
  PatternDataset,
  type DatasetConfig,
  type DatasetSplit,
} from "./datasets/FrameworkDataset.js";

// ============================================================================
// Mapping
// ============================================================================

export {
  ComponentMapper,
  ComponentMappingRegistry,
  ReactToVueMapping,
  ReactToAngularMapping,
  ReactToFlutterMapping,
  ReactToSvelteMapping,
  ReactToSwiftUIMapping,
} from "./mapping/ComponentMapping.js";

export {
  StyleMapping,
  PatternMapping,
  getStyleMapping,
  getPatternMapping,
} from "./mapping/StyleMapping.js";

// ============================================================================
// Generation
// ============================================================================

export {
  CodeGenerator,
  type GeneratorConfig,
  type GeneratedFile,
} from "./generation/CodeGenerator.js";

export {
  UIGenerator,
  type UIConfig,
  type GeneratedUI,
} from "./generation/UIGenerator.js";

export {
  TestGenerator,
  type TestConfig,
  type GeneratedTest,
} from "./generation/TestGenerator.js";

// ============================================================================
// Types
// ============================================================================

export type {
  // Framework types
  UIFramework,
  ScriptType,
  StyleType,

  // Parsed types
  ParsedUI,
  ParsedComponent,
  ParsedStyle,
  ParsedImport,
  ParsedExport,
  UIMetadata,

  // Generated code types
  ReactCode,
  VueCode,
  AngularCode,
  SvelteCode,
  FlutterCode,
  SwiftUICode,
  GeneratedCode,
  GeneratedStyle,

  // Spec types
  ComponentSpec,
  StyleSpec,

  // Definition types
  PropDefinition,
  StateDefinition,
  EventDefinition,

  // Mapping types
  ComponentMapping,
  PropMapping,
  EventMapping,
  StyleMapping,

  // Transfer learning types
  TransferConfig,
  VLJEPAModel,
  ModelLayer,
  TransferResult,
  TransferMetrics,
  TrainingProgress,
  TrainingCallback,

  // Dataset types
  FrameworkDataset,
  ComponentSample,
  StyleSample,
  PatternSample,

  // Evaluation types
  TransferEvaluation,
  ClassMetrics,
  CompatibilityReport,
  CompatibilityIssue,

  // Configuration types
  VueAdapterConfig,
  AngularAdapterConfig,
  FlutterAdapterConfig,
  SvelteAdapterConfig,
  SwiftUIAdapterConfig,

  // Conversion result types
  ConversionResult,
  ConversionMetadata,
} from "./types.js";

// ============================================================================
// Utilities
// ============================================================================

export { kebabCase, camelCase, pascalCase, snakeCase } from "./utils/case.js";

export { inferType, mapType, validateType } from "./utils/types.js";

export {
  parseJSX,
  parseVueTemplate,
  parseAngularTemplate,
  parseFlutterWidget,
  parseSwiftUIView,
} from "./utils/parsers.js";

// ============================================================================
// Constants
// ============================================================================

export const VERSION = "1.0.0";

export const SUPPORTED_FRAMEWORKS: UIFramework[] = [
  "react",
  "vue",
  "angular",
  "svelte",
  "flutter",
  "swiftui",
];

export const DEFAULT_ADAPTER_CONFIGS = {
  vue: {
    version: "vue3" as const,
    script: "composition" as const,
    style: "scoped" as const,
    typescript: true,
  },
  angular: {
    version: "17" as const,
    standalone: true,
    signals: true,
    typescript: true,
  },
  flutter: {
    version: "3.x" as const,
    nullSafety: true,
    material: true,
  },
  svelte: {
    version: "4" as const,
    typescript: true,
  },
  swiftui: {
    version: "5.0",
    iosTarget: "15.0",
    macosTarget: "12.0",
    swiftui: true,
  },
};

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an adapter for a specific framework
 */
export function createAdapter(
  framework: UIFramework,
  config?: any
): InstanceType<
  typeof import("./adapters/FrameworkAdapter.js").FrameworkAdapter
> {
  switch (framework) {
    case "react":
      const { ReactAdapter } = require("./adapters/ReactAdapter.js");
      return new ReactAdapter();
    case "vue":
      const { VueAdapter } = require("./adapters/VueAdapter.js");
      return new VueAdapter(config);
    case "angular":
      const { AngularAdapter } = require("./adapters/AngularAdapter.js");
      return new AngularAdapter(config);
    case "flutter":
      const { FlutterAdapter } = require("./adapters/FlutterAdapter.js");
      return new FlutterAdapter(config);
    case "svelte":
      const { SvelteAdapter } = require("./adapters/SvelteAdapter.js");
      return new SvelteAdapter(config);
    case "swiftui":
      const { SwiftUIAdapter } = require("./adapters/SwiftUIAdapter.js");
      return new SwiftUIAdapter(config);
    default:
      throw new Error(`Unsupported framework: ${framework}`);
  }
}

/**
 * Create a transfer trainer
 */
export function createTransferTrainer(
  config?: Partial<import("./types.js").TransferLearningConfig>
): import("./training/TransferTrainer.js").TransferTrainer {
  const { TransferTrainer } = require("./training/TransferTrainer.js");
  return new TransferTrainer(config);
}

/**
 * Create a component mapper
 */
export function createComponentMapper(): typeof import("./mapping/ComponentMapping.js").ComponentMapper {
  const { ComponentMapper } = require("./mapping/ComponentMapping.js");
  return ComponentMapper;
}

/**
 * Check if a framework is supported
 */
export function isFrameworkSupported(
  framework: string
): framework is UIFramework {
  return SUPPORTED_FRAMEWORKS.includes(framework as UIFramework);
}

/**
 * Get all supported frameworks
 */
export function getSupportedFrameworks(): UIFramework[] {
  return [...SUPPORTED_FRAMEWORKS];
}

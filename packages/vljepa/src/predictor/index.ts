/**
 * @lsi/vljepa/predictor - VL-JEPA Predictor Module
 *
 * Core prediction component that combines X-Encoder (vision) and Y-Encoder (language)
 * outputs to predict goal state embeddings.
 *
 * @version 1.0.0
 */

// Main predictor
export { Predictor } from "./Predictor.js";
export type { ExtendedPredictorConfig, PredictorMetrics } from "./Predictor.js";

// Embedding combiner
export { EmbeddingCombiner } from "./EmbeddingCombiner.js";
export type {
  EmbeddingCombinerConfig,
  CombinationStrategy,
} from "./EmbeddingCombiner.js";

// Prediction head
export { PredictionHead } from "./PredictionHead.js";
export type {
  PredictionHeadConfig,
  LayerConfig,
  ActivationFunction,
} from "./PredictionHead.js";

// Confidence scorer
export { ConfidenceScorer } from "./ConfidenceScorer.js";
export type {
  ConfidenceScorerConfig,
  ConfidenceMethod,
  ConfidenceResult,
} from "./ConfidenceScorer.js";

// Action generator
export { ActionGenerator } from "./ActionGenerator.js";
export type {
  ActionGeneratorConfig,
  ActionStrategy,
  SemanticDelta,
  ActionResult,
  DeltaCategory,
} from "./ActionGenerator.js";

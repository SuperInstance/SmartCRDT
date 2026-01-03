/**
 * @vljepa/curriculum - Curriculum Learning System for VL-JEPA
 *
 * A progressive training system that implements 4-stage curriculum learning
 * for Vision-Language Joint Embedding Predictive Architecture.
 */

// Core types
export * from "./types.js";

// Stages
export { Stage1Basic } from "./stages/Stage1Basic.js";
export { Stage2Components } from "./stages/Stage2Components.js";
export { Stage3Layouts } from "./stages/Stage3Layouts.js";
export { Stage4Applications } from "./stages/Stage4Applications.js";

// Schedulers
export { CurriculumScheduler } from "./schedulers/CurriculumScheduler.js";
export { ProgressMonitor } from "./schedulers/ProgressMonitor.js";
export { AdaptiveController } from "./schedulers/AdaptiveController.js";

// Samplers
export { DifficultySampler } from "./samplers/DifficultySampler.js";
export { StageSampler } from "./samplers/StageSampler.js";
export { ReplayBuffer } from "./samplers/ReplayBuffer.js";

// Evaluators
export { StageEvaluator } from "./evaluators/StageEvaluator.js";
export { MetricsTracker } from "./evaluators/MetricsTracker.js";
export { TransitionDecider } from "./evaluators/TransitionDecider.js";

// Trainers
export { JEPATrainer } from "./trainers/JEPATrainer.js";
export { LossFunctions } from "./trainers/LossFunctions.js";
export { OptimizerConfig } from "./trainers/OptimizerConfig.js";

// Utilities
export { CurriculumBuilder } from "./utils/CurriculumBuilder.js";
export { DataAugmentation } from "./utils/DataAugmentation.js";

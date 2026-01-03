/**
 * @lsi/vljepa-quantization - INT8 Quantization for VL-JEPA Models
 *
 * Main entry point for the quantization package.
 *
 * Provides:
 * - INT8 quantization (2x speedup, 4x size reduction)
 * - Multiple calibration strategies (MinMax, KLD, Percentile)
 * - Layer fusion for performance
 * - Accuracy validation
 * - WebGPU optimization
 * - Edge deployment packaging
 *
 * @packageDocumentation
 */

// ============================================================================
// QUANTIZERS
// ============================================================================

export {
  INT8Quantizer,
  type INT8QuantizerConfig,
  type QuantizationParams,
  DEFAULT_QUANTIZER_CONFIG,
  createINT8Quantizer,
} from "./quantizers/INT8Quantizer.js";

export {
  PostTrainingQuant,
  type PostTrainingQuantConfig,
  DEFAULT_PTQ_CONFIG,
  createPostTrainingQuant,
} from "./quantizers/PostTrainingQuant.js";

export {
  QuantAwareTraining,
  FakeQuantize,
  type FakeQuantizeParams,
  type QuantAwareTrainingConfig,
  DEFAULT_QAT_CONFIG,
  createQuantAwareTraining,
} from "./quantizers/QuantAwareTraining.js";

export {
  HybridQuantizer,
  type HybridQuantizerConfig,
  type LayerPrecision,
  type LayerSensitivity,
  DEFAULT_HYBRID_CONFIG,
  createHybridQuantizer,
} from "./quantizers/HybridQuantizer.js";

// ============================================================================
// CALIBRATORS
// ============================================================================

export {
  MinMaxCalibrator,
  createMinMaxCalibrator,
} from "./calibrators/MinMaxCalibrator.js";

export {
  KLDCalibrator,
  type Histogram,
  type KLDCalibratorConfig,
  DEFAULT_KLD_CONFIG,
  createKLDCalibrator,
} from "./calibrators/KLDCalibrator.js";

export {
  PercentileCalibrator,
  type PercentileCalibratorConfig,
  DEFAULT_PERCENTILE_CONFIG,
  createPercentileCalibrator,
} from "./calibrators/PercentileCalibrator.js";

export {
  CalibrationDataset,
  type CalibrationDatasetConfig,
  type CalibrationSample,
  DEFAULT_CALIBRATION_DATASET_CONFIG,
  createCalibrationDataset,
} from "./calibrators/CalibrationDataset.js";

// ============================================================================
// CONVERTERS
// ============================================================================

export {
  ModelConverter,
  type ModelFormat,
  type ModelConversionConfig,
  createModelConverter,
} from "./converters/ModelConverter.js";

// ============================================================================
// OPTIMIZERS
// ============================================================================

export {
  LayerFusionOptimizer,
  type FusedLayerInfo,
  type FusionConfig,
  type FusionPattern,
  type FusionResult,
  DEFAULT_FUSION_CONFIG,
  DEFAULT_FUSION_PATTERNS,
  createLayerFusionOptimizer,
} from "./optimizers/LayerFusion.js";

export {
  OperatorFusionOptimizer,
  type FusedOperator,
  type OperatorFusionResult,
  createOperatorFusionOptimizer,
} from "./optimizers/OperatorFusion.js";

export {
  ConstantFoldingOptimizer,
  type ConstantFoldingResult,
  createConstantFoldingOptimizer,
} from "./optimizers/ConstantFolding.js";

// ============================================================================
// VALIDATORS
// ============================================================================

export {
  AccuracyValidator,
  type ValidationConfig,
  type ValidationResult,
  createAccuracyValidator,
  DEFAULT_VALIDATION_CONFIG,
} from "./validators/AccuracyValidator.js";

export {
  PerformanceValidator,
  type PerformanceValidationResult,
  createPerformanceValidator,
} from "./validators/PerformanceValidator.js";

export {
  SizeValidator,
  type SizeValidationResult,
  createSizeValidator,
} from "./validators/SizeValidator.js";

// ============================================================================
// DEPLOYMENT
// ============================================================================

export {
  WebGPUOptimizer,
  type WebGPUConfig,
  type WebGPUResult,
  DEFAULT_WEBGPU_CONFIG,
  createWebGPUOptimizer,
} from "./deployment/WebGPUOptimizer.js";

export {
  EdgePackager,
  type EdgePackageConfig,
  type EdgePackage,
  DEFAULT_EDGE_PACKAGE_CONFIG,
  createEdgePackager,
} from "./deployment/EdgePackager.js";

// ============================================================================
// TYPES
// ============================================================================

export * from "./types.js";

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick quantize: Quantize model with default settings
 *
 * @param model - FP32 model to quantize
 * @returns Quantization result
 */
export async function quickQuantize(model: any): Promise<any> {
  const { createINT8Quantizer } = await import("./quantizers/INT8Quantizer.js");
  const quantizer = createINT8Quantizer();
  return await quantizer.quantize(model);
}

/**
 * Quick validate: Validate quantized model accuracy
 *
 * @param originalModel - Original FP32 model
 * @param quantizedModel - Quantized model
 * @returns Validation result
 */
export async function quickValidate(
  originalModel: any,
  quantizedModel: any
): Promise<any> {
  const { createAccuracyValidator } =
    await import("./validators/AccuracyValidator.js");
  const validator = createAccuracyValidator();
  return await validator.validate(originalModel, quantizedModel);
}

/**
 * Quick package: Package quantized model for deployment
 *
 * @param quantizationResult - Quantization result
 * @param modelConfig - Model configuration
 * @returns Edge package
 */
export async function quickPackage(
  quantizationResult: any,
  modelConfig: any
): Promise<any> {
  const { createEdgePackager } = await import("./deployment/EdgePackager.js");
  const packager = createEdgePackager();
  return await packager.package(quantizationResult, modelConfig);
}

// ============================================================================
// VERSION
// ============================================================================

export const VERSION = "1.0.0";
export const PACKAGE_NAME = "@lsi/vljepa-quantization";

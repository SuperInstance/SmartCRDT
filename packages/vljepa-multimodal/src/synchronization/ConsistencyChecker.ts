/**
 * ConsistencyChecker - Check state consistency
 *
 * Validates multi-modal state for consistency across
 * modalities and detects anomalies.
 */

import type { MultiModalState } from "../types.js";

/**
 * Consistency check result
 */
export interface ConsistencyResult {
  /** Whether state is consistent */
  consistent: boolean;
  /** Consistency errors found */
  errors: string[];
  /** Warnings (non-critical issues) */
  warnings: string[];
  /** Checked aspects */
  checked: string[];
}

/**
 * State consistency checker
 */
export class ConsistencyChecker {
  private tolerance: number = 1e-6;

  /**
   * Check state consistency
   */
  check(state: MultiModalState): ConsistencyResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const checked: string[] = [];

    // Check embedding dimensions
    checked.push("embedding_dimensions");
    const dimCheck = this.checkEmbeddingDimensions(state);
    if (!dimCheck.pass) {
      errors.push(...dimCheck.errors);
    }

    // Check confidence range
    checked.push("confidence_range");
    const confCheck = this.checkConfidenceRange(state);
    if (!confCheck.pass) {
      errors.push(...confCheck.errors);
    }

    // Check timestamp consistency
    checked.push("timestamp_consistency");
    const timeCheck = this.checkTimestampConsistency(state);
    if (!timeCheck.pass) {
      warnings.push(...timeCheck.warnings);
    }

    // Check version monotonicity
    checked.push("version_monotonicity");
    const versionCheck = this.checkVersionMonotonicity(state);
    if (!versionCheck.pass) {
      errors.push(...versionCheck.errors);
    }

    // Check embedding normalization
    checked.push("embedding_normalization");
    const normCheck = this.checkEmbeddingNormalization(state);
    if (!normCheck.pass) {
      warnings.push(...normCheck.warnings);
    }

    // Check text-visual alignment
    checked.push("text_visual_alignment");
    const alignCheck = this.checkTextVisualAlignment(state);
    if (!alignCheck.pass) {
      warnings.push(...alignCheck.warnings);
    }

    return {
      consistent: errors.length === 0,
      errors,
      warnings,
      checked,
    };
  }

  /**
   * Check embedding dimensions
   */
  private checkEmbeddingDimensions(state: MultiModalState): {
    pass: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const expectedDim = 768;

    if (state.text.embedding.length !== expectedDim) {
      errors.push(
        `Text embedding dimension ${state.text.embedding.length} != expected ${expectedDim}`
      );
    }

    if (state.visual.embedding.length !== expectedDim) {
      errors.push(
        `Visual embedding dimension ${state.visual.embedding.length} != expected ${expectedDim}`
      );
    }

    if (state.embedding.vector.length !== expectedDim) {
      errors.push(
        `Combined embedding dimension ${state.embedding.vector.length} != expected ${expectedDim}`
      );
    }

    if (state.fused.embedding.length !== expectedDim) {
      errors.push(
        `Fused embedding dimension ${state.fused.embedding.length} != expected ${expectedDim}`
      );
    }

    return { pass: errors.length === 0, errors };
  }

  /**
   * Check confidence range
   */
  private checkConfidenceRange(state: MultiModalState): {
    pass: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (state.confidence < 0 || state.confidence > 1) {
      errors.push(`Confidence ${state.confidence} outside valid range [0, 1]`);
    }

    if (state.fused.confidence < 0 || state.fused.confidence > 1) {
      errors.push(
        `Fused confidence ${state.fused.confidence} outside valid range [0, 1]`
      );
    }

    return { pass: errors.length === 0, errors };
  }

  /**
   * Check timestamp consistency
   */
  private checkTimestampConsistency(state: MultiModalState): {
    pass: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];

    const { text, visual, embedding, fused, timestamp, modified } = state;

    // Check if modality timestamps are within reasonable range of state timestamp
    const maxDelta = 10000; // 10 seconds

    if (Math.abs(text.timestamp - timestamp) > maxDelta) {
      warnings.push(
        `Text timestamp ${text.timestamp} far from state timestamp ${timestamp}`
      );
    }

    if (Math.abs(visual.timestamp - timestamp) > maxDelta) {
      warnings.push(
        `Visual timestamp ${visual.timestamp} far from state timestamp ${timestamp}`
      );
    }

    if (Math.abs(embedding.timestamp - timestamp) > maxDelta) {
      warnings.push(
        `Embedding timestamp ${embedding.timestamp} far from state timestamp ${timestamp}`
      );
    }

    if (Math.abs(fused.timestamp - timestamp) > maxDelta) {
      warnings.push(
        `Fused timestamp ${fused.timestamp} far from state timestamp ${timestamp}`
      );
    }

    // Check if modified >= timestamp
    if (modified < timestamp) {
      warnings.push(
        `Modified timestamp ${modified} before creation timestamp ${timestamp}`
      );
    }

    return { pass: true, warnings };
  }

  /**
   * Check version monotonicity
   */
  private checkVersionMonotonicity(state: MultiModalState): {
    pass: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (state.version < 0) {
      errors.push(`Version ${state.version} is negative`);
    }

    // Metadata version should match state version
    if (state.metadata.version !== state.version) {
      errors.push(
        `Metadata version ${state.metadata.version} != state version ${state.version}`
      );
    }

    return { pass: errors.length === 0, errors };
  }

  /**
   * Check embedding normalization
   */
  private checkEmbeddingNormalization(state: MultiModalState): {
    pass: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];

    const textNorm = this.l2Norm(state.text.embedding);
    const visualNorm = this.l2Norm(state.visual.embedding);
    const fusedNorm = this.l2Norm(state.fused.embedding);

    // Warn if embeddings are not normalized (norm != 1)
    if (Math.abs(textNorm - 1) > 0.1) {
      warnings.push(
        `Text embedding not normalized (norm: ${textNorm.toFixed(4)})`
      );
    }

    if (Math.abs(visualNorm - 1) > 0.1) {
      warnings.push(
        `Visual embedding not normalized (norm: ${visualNorm.toFixed(4)})`
      );
    }

    if (Math.abs(fusedNorm - 1) > 0.1) {
      warnings.push(
        `Fused embedding not normalized (norm: ${fusedNorm.toFixed(4)})`
      );
    }

    return { pass: true, warnings };
  }

  /**
   * Check text-visual alignment
   */
  private checkTextVisualAlignment(state: MultiModalState): {
    pass: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];

    // Calculate cosine similarity between text and visual embeddings
    const similarity = this.cosineSimilarity(
      state.text.embedding,
      state.visual.embedding
    );

    // Warn if similarity is very low (potential misalignment)
    if (similarity < 0.1) {
      warnings.push(
        `Low text-visual similarity (${similarity.toFixed(4)}) - possible misalignment`
      );
    }

    // Check if fused confidence is reasonable
    if (state.fused.confidence < 0.3) {
      warnings.push(
        `Low fusion confidence (${state.fused.confidence.toFixed(4)})`
      );
    }

    return { pass: true, warnings };
  }

  /**
   * Calculate L2 norm
   */
  private l2Norm(vec: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < vec.length; i++) {
      sum += vec[i] * vec[i];
    }
    return Math.sqrt(sum);
  }

  /**
   * Calculate cosine similarity
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator > 0 ? dotProduct / denominator : 0;
  }

  /**
   * Batch check multiple states
   */
  checkBatch(states: MultiModalState[]): ConsistencyResult[] {
    return states.map(state => this.check(state));
  }

  /**
   * Get consistency statistics
   */
  getStatistics(results: ConsistencyResult[]): {
    total: number;
    consistent: number;
    inconsistent: number;
    errorRate: number;
    commonErrors: Map<string, number>;
  } {
    const total = results.length;
    const consistent = results.filter(r => r.consistent).length;
    const inconsistent = total - consistent;
    const errorRate = total > 0 ? inconsistent / total : 0;

    const commonErrors = new Map<string, number>();
    for (const result of results) {
      for (const error of result.errors) {
        commonErrors.set(error, (commonErrors.get(error) || 0) + 1);
      }
    }

    return {
      total,
      consistent,
      inconsistent,
      errorRate,
      commonErrors,
    };
  }

  /**
   * Set tolerance for floating point comparisons
   */
  setTolerance(tolerance: number): void {
    this.tolerance = tolerance;
  }

  /**
   * Get current tolerance
   */
  getTolerance(): number {
    return this.tolerance;
  }
}

/**
 * EmbeddingState - Combined embedding state
 *
 * Manages unified embeddings combining text and visual
 * modalities with contribution tracking.
 */

import type { EmbeddingState as EmbeddingStateType } from "../types.js";

/**
 * Embedding state manager
 */
export class EmbeddingStateManager {
  private state: EmbeddingStateType;
  private readonly dimension: number = 768;

  constructor(initialState?: Partial<EmbeddingStateType>) {
    this.state = {
      vector: initialState?.vector || new Float32Array(this.dimension),
      textContribution:
        initialState?.textContribution || new Float32Array(this.dimension),
      visualContribution:
        initialState?.visualContribution || new Float32Array(this.dimension),
      timestamp: initialState?.timestamp || Date.now(),
    };
  }

  /**
   * Get current state
   */
  getState(): EmbeddingStateType {
    return { ...this.state };
  }

  /**
   * Update combined embedding vector
   */
  updateVector(vector: Float32Array): void {
    if (vector.length !== this.dimension) {
      throw new Error(
        `Embedding vector must be ${this.dimension}-dimensional, got ${vector.length}`
      );
    }
    this.state.vector = vector;
    this.state.timestamp = Date.now();
  }

  /**
   * Update text contribution
   */
  updateTextContribution(contribution: Float32Array): void {
    if (contribution.length !== this.dimension) {
      throw new Error(
        `Text contribution must be ${this.dimension}-dimensional, got ${contribution.length}`
      );
    }
    this.state.textContribution = contribution;
    this.state.timestamp = Date.now();
  }

  /**
   * Update visual contribution
   */
  updateVisualContribution(contribution: Float32Array): void {
    if (contribution.length !== this.dimension) {
      throw new Error(
        `Visual contribution must be ${this.dimension}-dimensional, got ${contribution.length}`
      );
    }
    this.state.visualContribution = contribution;
    this.state.timestamp = Date.now();
  }

  /**
   * Combine text and visual embeddings
   */
  combine(
    textEmbedding: Float32Array,
    visualEmbedding: Float32Array,
    textWeight: number = 0.5,
    visualWeight: number = 0.5
  ): void {
    if (
      textEmbedding.length !== this.dimension ||
      visualEmbedding.length !== this.dimension
    ) {
      throw new Error(`Embeddings must be ${this.dimension}-dimensional`);
    }

    // Normalize weights
    const totalWeight = textWeight + visualWeight;
    const normalizedTextWeight = textWeight / totalWeight;
    const normalizedVisualWeight = visualWeight / totalWeight;

    // Store contributions
    this.state.textContribution = new Float32Array(textEmbedding);
    this.state.visualContribution = new Float32Array(visualEmbedding);

    // Combine embeddings
    this.state.vector = new Float32Array(this.dimension);
    for (let i = 0; i < this.dimension; i++) {
      this.state.vector[i] =
        textEmbedding[i] * normalizedTextWeight +
        visualEmbedding[i] * normalizedVisualWeight;
    }

    this.state.timestamp = Date.now();
  }

  /**
   * Get combined vector
   */
  getVector(): Float32Array {
    return this.state.vector;
  }

  /**
   * Get text contribution
   */
  getTextContribution(): Float32Array {
    return this.state.textContribution;
  }

  /**
   * Get visual contribution
   */
  getVisualContribution(): Float32Array {
    return this.state.visualContribution;
  }

  /**
   * Calculate contribution ratio
   */
  getContributionRatio(): { text: number; visual: number } {
    const textNorm = this.norm(this.state.textContribution);
    const visualNorm = this.norm(this.state.visualContribution);
    const total = textNorm + visualNorm;

    if (total === 0) {
      return { text: 0.5, visual: 0.5 };
    }

    return {
      text: textNorm / total,
      visual: visualNorm / total,
    };
  }

  /**
   * Calculate L2 norm
   */
  private norm(vec: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < vec.length; i++) {
      sum += vec[i] * vec[i];
    }
    return Math.sqrt(sum);
  }

  /**
   * Normalize vector
   */
  normalize(): void {
    const norm = this.norm(this.state.vector);
    if (norm > 0) {
      const normalized = new Float32Array(this.dimension);
      for (let i = 0; i < this.dimension; i++) {
        normalized[i] = this.state.vector[i] / norm;
      }
      this.state.vector = normalized;
      this.state.timestamp = Date.now();
    }
  }

  /**
   * Calculate cosine similarity with another embedding
   */
  cosineSimilarity(other: Float32Array): number {
    if (other.length !== this.dimension) {
      throw new Error(`Other embedding must be ${this.dimension}-dimensional`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < this.dimension; i++) {
      dotProduct += this.state.vector[i] * other[i];
      normA += this.state.vector[i] * this.state.vector[i];
      normB += other[i] * other[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator > 0 ? dotProduct / denominator : 0;
  }

  /**
   * Clone state
   */
  clone(): EmbeddingStateManager {
    return new EmbeddingStateManager({
      vector: new Float32Array(this.state.vector),
      textContribution: new Float32Array(this.state.textContribution),
      visualContribution: new Float32Array(this.state.visualContribution),
      timestamp: this.state.timestamp,
    });
  }

  /**
   * Serialize to JSON
   */
  toJSON(): Record<string, unknown> {
    return {
      vector: Array.from(this.state.vector),
      textContribution: Array.from(this.state.textContribution),
      visualContribution: Array.from(this.state.visualContribution),
      timestamp: this.state.timestamp,
    };
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(data: Record<string, unknown>): EmbeddingStateManager {
    const vector = data.vector as number[];
    const textContribution = data.textContribution as number[];
    const visualContribution = data.visualContribution as number[];

    return new EmbeddingStateManager({
      vector: new Float32Array(vector),
      textContribution: new Float32Array(textContribution),
      visualContribution: new Float32Array(visualContribution),
      timestamp: data.timestamp as number,
    });
  }
}

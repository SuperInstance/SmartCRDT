/**
 * FusedState - Fused multi-modal state
 *
 * Manages the fusion of text and visual modalities
 * with attention weights and reasoning.
 */

import type { FusedState as FusedStateType, AttentionMap } from "../types.js";

/**
 * Fused state manager
 */
export class FusedStateManager {
  private state: FusedStateType;
  private readonly dimension: number = 768;

  constructor(initialState?: Partial<FusedStateType>) {
    this.state = {
      embedding: initialState?.embedding || new Float32Array(this.dimension),
      attention: initialState?.attention || this.createEmptyAttention(),
      confidence: initialState?.confidence || 0.0,
      reasoning: initialState?.reasoning || "",
      timestamp: initialState?.timestamp || Date.now(),
    };
  }

  /**
   * Create empty attention map
   */
  private createEmptyAttention(): AttentionMap {
    return {
      text: new Map(),
      visual: new Map(),
      crossModal: new Map(),
    };
  }

  /**
   * Get current state
   */
  getState(): FusedStateType {
    return {
      ...this.state,
      attention: this.cloneAttentionMap(this.state.attention),
    };
  }

  /**
   * Update fused embedding
   */
  updateEmbedding(embedding: Float32Array): void {
    if (embedding.length !== this.dimension) {
      throw new Error(
        `Fused embedding must be ${this.dimension}-dimensional, got ${embedding.length}`
      );
    }
    this.state.embedding = embedding;
    this.state.timestamp = Date.now();
  }

  /**
   * Update confidence
   */
  updateConfidence(confidence: number): void {
    if (confidence < 0 || confidence > 1) {
      throw new Error(`Confidence must be between 0 and 1, got ${confidence}`);
    }
    this.state.confidence = confidence;
    this.state.timestamp = Date.now();
  }

  /**
   * Update reasoning
   */
  updateReasoning(reasoning: string): void {
    this.state.reasoning = reasoning;
    this.state.timestamp = Date.now();
  }

  /**
   * Set text attention weight
   */
  setTextAttention(key: string, weight: number): void {
    if (weight < 0 || weight > 1) {
      throw new Error(
        `Attention weight must be between 0 and 1, got ${weight}`
      );
    }
    this.state.attention.text.set(key, weight);
    this.state.timestamp = Date.now();
  }

  /**
   * Set visual attention weight
   */
  setVisualAttention(key: string, weight: number): void {
    if (weight < 0 || weight > 1) {
      throw new Error(
        `Attention weight must be between 0 and 1, got ${weight}`
      );
    }
    this.state.attention.visual.set(key, weight);
    this.state.timestamp = Date.now();
  }

  /**
   * Set cross-modal attention weight
   */
  setCrossModalAttention(fromKey: string, toKey: string, weight: number): void {
    if (weight < 0 || weight > 1) {
      throw new Error(
        `Attention weight must be between 0 and 1, got ${weight}`
      );
    }

    if (!this.state.attention.crossModal.has(fromKey)) {
      this.state.attention.crossModal.set(fromKey, new Map());
    }

    const fromMap = this.state.attention.crossModal.get(fromKey)!;
    fromMap.set(toKey, weight);
    this.state.timestamp = Date.now();
  }

  /**
   * Get text attention weight
   */
  getTextAttention(key: string): number {
    return this.state.attention.text.get(key) || 0;
  }

  /**
   * Get visual attention weight
   */
  getVisualAttention(key: string): number {
    return this.state.attention.visual.get(key) || 0;
  }

  /**
   * Get cross-modal attention weight
   */
  getCrossModalAttention(fromKey: string, toKey: string): number {
    const fromMap = this.state.attention.crossModal.get(fromKey);
    return fromMap?.get(toKey) || 0;
  }

  /**
   * Get all text attention weights
   */
  getAllTextAttention(): Map<string, number> {
    return new Map(this.state.attention.text);
  }

  /**
   * Get all visual attention weights
   */
  getAllVisualAttention(): Map<string, number> {
    return new Map(this.state.attention.visual);
  }

  /**
   * Get fused embedding
   */
  getEmbedding(): Float32Array {
    return this.state.embedding;
  }

  /**
   * Get confidence
   */
  getConfidence(): number {
    return this.state.confidence;
  }

  /**
   * Get reasoning
   */
  getReasoning(): string {
    return this.state.reasoning;
  }

  /**
   * Calculate attention entropy
   */
  getAttentionEntropy(modality: "text" | "visual"): number {
    const attention =
      modality === "text"
        ? this.state.attention.text
        : this.state.attention.visual;
    const weights = Array.from(attention.values());

    if (weights.length === 0) {
      return 0;
    }

    let entropy = 0;
    for (const weight of weights) {
      if (weight > 0) {
        entropy -= weight * Math.log2(weight);
      }
    }

    return entropy;
  }

  /**
   * Normalize attention weights
   */
  normalizeAttention(modality: "text" | "visual"): void {
    const attention =
      modality === "text"
        ? this.state.attention.text
        : this.state.attention.visual;
    const weights = Array.from(attention.entries());

    const sum = weights.reduce((acc, [, w]) => acc + w, 0);

    if (sum > 0) {
      attention.clear();
      for (const [key, weight] of weights) {
        attention.set(key, weight / sum);
      }
      this.state.timestamp = Date.now();
    }
  }

  /**
   * Clear all attention weights
   */
  clearAttention(): void {
    this.state.attention = this.createEmptyAttention();
    this.state.timestamp = Date.now();
  }

  /**
   * Clone attention map
   */
  private cloneAttentionMap(attention: AttentionMap): AttentionMap {
    const crossModalClone = new Map<string, Map<string, number>>();
    for (const [fromKey, toMap] of attention.crossModal) {
      crossModalClone.set(fromKey, new Map(toMap));
    }

    return {
      text: new Map(attention.text),
      visual: new Map(attention.visual),
      crossModal: crossModalClone,
    };
  }

  /**
   * Clone state
   */
  clone(): FusedStateManager {
    return new FusedStateManager({
      embedding: new Float32Array(this.state.embedding),
      attention: this.cloneAttentionMap(this.state.attention),
      confidence: this.state.confidence,
      reasoning: this.state.reasoning,
      timestamp: this.state.timestamp,
    });
  }

  /**
   * Serialize to JSON
   */
  toJSON(): Record<string, unknown> {
    const crossModalObject: Record<string, Record<string, number>> = {};
    for (const [fromKey, toMap] of this.state.attention.crossModal) {
      crossModalObject[fromKey] = Object.fromEntries(toMap);
    }

    return {
      embedding: Array.from(this.state.embedding),
      attention: {
        text: Object.fromEntries(this.state.attention.text),
        visual: Object.fromEntries(this.state.attention.visual),
        crossModal: crossModalObject,
      },
      confidence: this.state.confidence,
      reasoning: this.state.reasoning,
      timestamp: this.state.timestamp,
    };
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(data: Record<string, unknown>): FusedStateManager {
    const embedding = data.embedding as number[];
    const attentionData = data.attention as {
      text: Record<string, number>;
      visual: Record<string, number>;
      crossModal: Record<string, Record<string, number>>;
    };

    const attention: AttentionMap = {
      text: new Map(Object.entries(attentionData.text)),
      visual: new Map(Object.entries(attentionData.visual)),
      crossModal: new Map(),
    };

    for (const [fromKey, toObj] of Object.entries(attentionData.crossModal)) {
      attention.crossModal.set(fromKey, new Map(Object.entries(toObj)));
    }

    return new FusedStateManager({
      embedding: new Float32Array(embedding),
      attention,
      confidence: data.confidence as number,
      reasoning: data.reasoning as string,
      timestamp: data.timestamp as number,
    });
  }
}

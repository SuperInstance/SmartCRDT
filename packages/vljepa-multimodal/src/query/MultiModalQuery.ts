/**
 * MultiModalQuery - Cross-modal query system
 *
 * Enables searching across text, visual, and embedding
 * modalities with semantic similarity matching.
 */

import type {
  QueryConfig,
  QueryResult,
  Match,
  QueryMetadata,
  ModalityType,
  SimilarityMetric,
  MultiModalState,
} from "../types.js";
import { StateQuery } from "./StateQuery.js";
import { SemanticQuery } from "./SemanticQuery.js";
import { HybridIndex } from "../indexing/HybridIndex.js";

/**
 * Multi-modal query manager
 */
export class MultiModalQuery {
  private stateQuery: StateQuery;
  private semanticQuery: SemanticQuery;
  private hybridIndex: HybridIndex;
  private defaultConfig: QueryConfig;

  constructor(defaultConfig?: Partial<QueryConfig>) {
    this.defaultConfig = {
      modalities: ["text", "visual", "embedding"],
      similarity: "cosine",
      threshold: 0.5,
      limit: 10,
      hybrid: true,
      textWeight: 0.5,
      visualWeight: 0.5,
      ...defaultConfig,
    };

    this.stateQuery = new StateQuery();
    this.semanticQuery = new SemanticQuery();
    this.hybridIndex = new HybridIndex();
  }

  /**
   * Query states by text
   */
  async queryByText(
    states: MultiModalState[],
    query: string,
    config?: Partial<QueryConfig>
  ): Promise<QueryResult> {
    const startTime = performance.now();
    const queryConfig = { ...this.defaultConfig, ...config };

    // Use state query for text search
    const textMatches = this.stateQuery.queryByText(states, query, queryConfig);

    // Use semantic query for embedding similarity
    const semanticMatches = await this.semanticQuery.queryByText(
      states,
      query,
      queryConfig
    );

    // Combine results
    const matches = this.combineMatches(
      [textMatches, semanticMatches],
      queryConfig
    );

    const duration = performance.now() - startTime;

    return {
      matches,
      similarity: matches.map(m => m.similarity),
      metadata: {
        duration,
        searched: states.length,
        results: matches.length,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Query states by visual similarity
   */
  async queryByVisual(
    states: MultiModalState[],
    queryEmbedding: Float32Array,
    config?: Partial<QueryConfig>
  ): Promise<QueryResult> {
    const startTime = performance.now();
    const queryConfig = { ...this.defaultConfig, ...config };

    // Use semantic query for visual embedding similarity
    const matches = await this.semanticQuery.queryByVisual(
      states,
      queryEmbedding,
      queryConfig
    );

    const duration = performance.now() - startTime;

    return {
      matches,
      similarity: matches.map(m => m.similarity),
      metadata: {
        duration,
        searched: states.length,
        results: matches.length,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Query by combined multi-modal input
   */
  async queryByMultiModal(
    states: MultiModalState[],
    textQuery?: string,
    visualEmbedding?: Float32Array,
    config?: Partial<QueryConfig>
  ): Promise<QueryResult> {
    const startTime = performance.now();
    const queryConfig = { ...this.defaultConfig, ...config };

    const allMatches: Match[][] = [];

    // Text query
    if (textQuery && queryConfig.modalities.includes("text")) {
      const textMatches = this.stateQuery.queryByText(
        states,
        textQuery,
        queryConfig
      );
      allMatches.push(textMatches);
    }

    // Visual query
    if (visualEmbedding && queryConfig.modalities.includes("visual")) {
      const visualMatches = await this.semanticQuery.queryByVisual(
        states,
        visualEmbedding,
        queryConfig
      );
      allMatches.push(visualMatches);
    }

    // Embedding query
    if (queryConfig.modalities.includes("embedding")) {
      const queryEmb = visualEmbedding || states[0]?.embedding.vector;
      if (queryEmb) {
        const embeddingMatches = await this.semanticQuery.queryByEmbedding(
          states,
          queryEmb,
          queryConfig
        );
        allMatches.push(embeddingMatches);
      }
    }

    // Combine and rank matches
    const matches = this.combineMatches(allMatches, queryConfig);

    const duration = performance.now() - startTime;

    return {
      matches,
      similarity: matches.map(m => m.similarity),
      metadata: {
        duration,
        searched: states.length,
        results: matches.length,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Cross-modal query: text to visual
   */
  async queryTextToVisual(
    states: MultiModalState[],
    textQuery: string,
    config?: Partial<QueryConfig>
  ): Promise<QueryResult> {
    const startTime = performance.now();
    const queryConfig = { ...this.defaultConfig, ...config };

    const matches: Match[] = [];

    for (const state of states) {
      // Compare text query with text embedding
      const textSimilarity = this.computeTextSimilarity(
        textQuery,
        state.text.input
      );

      // Compare text query with visual embedding (cross-modal)
      const crossModalSimilarity = await this.computeCrossModalSimilarity(
        textQuery,
        state.visual.embedding
      );

      // Average similarities
      const similarity = (textSimilarity + crossModalSimilarity) / 2;

      if (similarity >= queryConfig.threshold) {
        matches.push({
          state,
          similarity,
          modality: "visual",
          highlights: this.extractHighlights(textQuery, state.text.input),
        });
      }
    }

    // Sort by similarity
    matches.sort((a, b) => b.similarity - a.similarity);

    // Limit results
    const limited = matches.slice(0, queryConfig.limit);

    const duration = performance.now() - startTime;

    return {
      matches: limited,
      similarity: limited.map(m => m.similarity),
      metadata: {
        duration,
        searched: states.length,
        results: limited.length,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Cross-modal query: visual to text
   */
  async queryVisualToText(
    states: MultiModalState[],
    visualEmbedding: Float32Array,
    config?: Partial<QueryConfig>
  ): Promise<QueryResult> {
    const startTime = performance.now();
    const queryConfig = { ...this.defaultConfig, ...config };

    const matches: Match[] = [];

    for (const state of states) {
      // Compare visual embedding with text embedding (cross-modal)
      const crossModalSimilarity = this.cosineSimilarity(
        visualEmbedding,
        state.text.embedding
      );

      // Compare with visual embedding directly
      const visualSimilarity = this.cosineSimilarity(
        visualEmbedding,
        state.visual.embedding
      );

      // Average similarities
      const similarity = (crossModalSimilarity + visualSimilarity) / 2;

      if (similarity >= queryConfig.threshold) {
        matches.push({
          state,
          similarity,
          modality: "text",
          highlights: [state.text.input.substring(0, 100)],
        });
      }
    }

    // Sort by similarity
    matches.sort((a, b) => b.similarity - a.similarity);

    // Limit results
    const limited = matches.slice(0, queryConfig.limit);

    const duration = performance.now() - startTime;

    return {
      matches: limited,
      similarity: limited.map(m => m.similarity),
      metadata: {
        duration,
        searched: states.length,
        results: limited.length,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Combine matches from multiple sources
   */
  private combineMatches(matchGroups: Match[][], config: QueryConfig): Match[] {
    const combined = new Map<string, Match>();

    for (const matches of matchGroups) {
      for (const match of matches) {
        const key = match.state.id;

        if (combined.has(key)) {
          // Average similarities
          const existing = combined.get(key)!;
          existing.similarity = (existing.similarity + match.similarity) / 2;
        } else {
          combined.set(key, { ...match });
        }
      }
    }

    // Convert to array and filter by threshold
    let results = Array.from(combined.values()).filter(
      m => m.similarity >= config.threshold
    );

    // Sort by similarity
    results.sort((a, b) => b.similarity - a.similarity);

    // Limit results
    return results.slice(0, config.limit);
  }

  /**
   * Compute text similarity
   */
  private computeTextSimilarity(query: string, text: string): number {
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    const textWords = new Set(text.toLowerCase().split(/\s+/));

    let intersection = 0;
    for (const word of queryWords) {
      if (textWords.has(word)) {
        intersection++;
      }
    }

    const union = new Set([...queryWords, ...textWords]).size;
    return union > 0 ? intersection / union : 0;
  }

  /**
   * Compute cross-modal similarity (text to visual embedding)
   */
  private async computeCrossModalSimilarity(
    text: string,
    visualEmbedding: Float32Array
  ): Promise<number> {
    // Simplified: use hash of text as pseudo embedding
    const hash = this.hashText(text);
    const textEmbedding = new Float32Array(768);

    // Fill with hash-based values
    for (let i = 0; i < 768; i++) {
      textEmbedding[i] = ((hash * (i + 1)) % 1000) / 1000;
    }

    return this.cosineSimilarity(textEmbedding, visualEmbedding);
  }

  /**
   * Hash text for pseudo embedding
   */
  private hashText(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Extract highlights from text
   */
  private extractHighlights(query: string, text: string): string[] {
    const queryWords = query.toLowerCase().split(/\s+/);
    const highlights: string[] = [];

    for (const word of queryWords) {
      const index = text.toLowerCase().indexOf(word);
      if (index >= 0) {
        const start = Math.max(0, index - 20);
        const end = Math.min(text.length, index + word.length + 20);
        highlights.push(text.substring(start, end));
      }
    }

    return highlights;
  }

  /**
   * Calculate cosine similarity
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      return 0;
    }

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
   * Index states for faster querying
   */
  indexStates(states: MultiModalState[]): void {
    this.hybridIndex.indexStates(states);
  }

  /**
   * Get index statistics
   */
  getIndexStats(): {
    totalStates: number;
    indexedModalities: ModalityType[];
    indexSize: number;
  } {
    return this.hybridIndex.getStats();
  }

  /**
   * Clear index
   */
  clearIndex(): void {
    this.hybridIndex.clear();
  }

  /**
   * Update default config
   */
  updateConfig(config: Partial<QueryConfig>): void {
    Object.assign(this.defaultConfig, config);
  }

  /**
   * Get current config
   */
  getConfig(): QueryConfig {
    return { ...this.defaultConfig };
  }
}

export { StateQuery } from "./StateQuery.js";
export { SemanticQuery } from "./SemanticQuery.js";

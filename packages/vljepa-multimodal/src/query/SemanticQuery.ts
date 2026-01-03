/**
 * SemanticQuery - Semantic similarity querying
 *
 * Query states by embedding similarity using various
 * distance metrics.
 */

import type {
  QueryConfig,
  Match,
  SimilarityMetric,
  MultiModalState,
} from "../types.js";

/**
 * Semantic query manager
 */
export class SemanticQuery {
  /**
   * Query by text embedding
   */
  async queryByText(
    states: MultiModalState[],
    query: string,
    config: QueryConfig
  ): Promise<Match[]> {
    // For semantic query, we need to compute query embedding
    // Simplified: use hash-based pseudo embedding
    const queryEmbedding = this.computeQueryEmbedding(query);

    return this.queryByEmbedding(states, queryEmbedding, config);
  }

  /**
   * Query by visual embedding
   */
  async queryByVisual(
    states: MultiModalState[],
    queryEmbedding: Float32Array,
    config: QueryConfig
  ): Promise<Match[]> {
    const matches: Match[] = [];

    for (const state of states) {
      const similarity = this.computeSimilarity(
        queryEmbedding,
        state.visual.embedding,
        config.similarity
      );

      if (similarity >= config.threshold) {
        matches.push({
          state,
          similarity,
          modality: "visual",
        });
      }
    }

    // Sort by similarity
    matches.sort((a, b) => b.similarity - a.similarity);

    return matches.slice(0, config.limit);
  }

  /**
   * Query by combined embedding
   */
  async queryByEmbedding(
    states: MultiModalState[],
    queryEmbedding: Float32Array,
    config: QueryConfig
  ): Promise<Match[]> {
    const matches: Match[] = [];

    for (const state of states) {
      // Try multiple modalities
      const similarities: {
        similarity: number;
        modality: "text" | "visual" | "embedding";
      }[] = [];

      if (config.modalities.includes("text")) {
        similarities.push({
          similarity: this.computeSimilarity(
            queryEmbedding,
            state.text.embedding,
            config.similarity
          ),
          modality: "text",
        });
      }

      if (config.modalities.includes("visual")) {
        similarities.push({
          similarity: this.computeSimilarity(
            queryEmbedding,
            state.visual.embedding,
            config.similarity
          ),
          modality: "visual",
        });
      }

      if (config.modalities.includes("embedding")) {
        similarities.push({
          similarity: this.computeSimilarity(
            queryEmbedding,
            state.embedding.vector,
            config.similarity
          ),
          modality: "embedding",
        });
      }

      // Use best similarity
      const best = similarities.reduce(
        (a, b) => (a.similarity > b.similarity ? a : b),
        {
          similarity: 0,
          modality: "embedding",
        }
      );

      if (best.similarity >= config.threshold) {
        matches.push({
          state,
          similarity: best.similarity,
          modality: best.modality,
        });
      }
    }

    // Sort by similarity
    matches.sort((a, b) => b.similarity - a.similarity);

    return matches.slice(0, config.limit);
  }

  /**
   * Query by fused embedding
   */
  async queryByFused(
    states: MultiModalState[],
    queryEmbedding: Float32Array,
    config: QueryConfig
  ): Promise<Match[]> {
    const matches: Match[] = [];

    for (const state of states) {
      const similarity = this.computeSimilarity(
        queryEmbedding,
        state.fused.embedding,
        config.similarity
      );

      if (similarity >= config.threshold) {
        matches.push({
          state,
          similarity,
          modality: "embedding",
        });
      }
    }

    // Sort by similarity
    matches.sort((a, b) => b.similarity - a.similarity);

    return matches.slice(0, config.limit);
  }

  /**
   * Batch query multiple embeddings
   */
  async queryBatch(
    states: MultiModalState[],
    queryEmbeddings: Float32Array[],
    config: QueryConfig
  ): Promise<Map<number, Match[]>> {
    const results = new Map<number, Match[]>();

    for (let i = 0; i < queryEmbeddings.length; i++) {
      const matches = await this.queryByEmbedding(
        states,
        queryEmbeddings[i],
        config
      );
      results.set(i, matches);
    }

    return results;
  }

  /**
   * Find nearest neighbors
   */
  async findNearestNeighbors(
    states: MultiModalState[],
    queryEmbedding: Float32Array,
    k: number,
    config?: Partial<QueryConfig>
  ): Promise<Match[]> {
    const fullConfig = { ...config, limit: k, threshold: 0 } as QueryConfig;
    return this.queryByEmbedding(states, queryEmbedding, fullConfig);
  }

  /**
   * Compute query embedding from text (simplified)
   */
  private computeQueryEmbedding(query: string): Float32Array {
    const embedding = new Float32Array(768);
    const hash = this.hashString(query);

    // Fill with deterministic values based on hash
    for (let i = 0; i < 768; i++) {
      embedding[i] = ((hash * (i + 1) * 2654435761) % 1000) / 1000;
    }

    return embedding;
  }

  /**
   * Hash string to number
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Compute similarity between two embeddings
   */
  private computeSimilarity(
    a: Float32Array,
    b: Float32Array,
    metric: SimilarityMetric
  ): number {
    if (a.length !== b.length) {
      return 0;
    }

    switch (metric) {
      case "cosine":
        return this.cosineSimilarity(a, b);
      case "euclidean":
        return this.euclideanSimilarity(a, b);
      case "dot":
        return this.dotProduct(a, b);
      default:
        return this.cosineSimilarity(a, b);
    }
  }

  /**
   * Cosine similarity
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
   * Euclidean similarity (inverse of distance)
   */
  private euclideanSimilarity(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    const distance = Math.sqrt(sum);
    return 1 / (1 + distance); // Convert to similarity
  }

  /**
   * Dot product similarity
   */
  private dotProduct(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }

  /**
   * Compute similarity matrix between states
   */
  computeSimilarityMatrix(
    states: MultiModalState[],
    metric: SimilarityMetric = "cosine"
  ): number[][] {
    const matrix: number[][] = [];

    for (let i = 0; i < states.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < states.length; j++) {
        const similarity = this.computeSimilarity(
          states[i].embedding.vector,
          states[j].embedding.vector,
          metric
        );
        matrix[i][j] = similarity;
      }
    }

    return matrix;
  }

  /**
   * Cluster states by similarity
   */
  clusterStates(
    states: MultiModalState[],
    threshold: number = 0.8,
    metric: SimilarityMetric = "cosine"
  ): Map<string, MultiModalState[]> {
    const clusters = new Map<string, MultiModalState[]>();
    const visited = new Set<string>();

    for (const state of states) {
      if (visited.has(state.id)) {
        continue;
      }

      const cluster: MultiModalState[] = [state];
      visited.add(state.id);

      // Find similar states
      for (const other of states) {
        if (visited.has(other.id)) {
          continue;
        }

        const similarity = this.computeSimilarity(
          state.embedding.vector,
          other.embedding.vector,
          metric
        );

        if (similarity >= threshold) {
          cluster.push(other);
          visited.add(other.id);
        }
      }

      const clusterId = `cluster_${clusters.size}`;
      clusters.set(clusterId, cluster);
    }

    return clusters;
  }
}

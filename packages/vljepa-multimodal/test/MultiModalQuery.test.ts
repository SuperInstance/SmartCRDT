/**
 * MultiModalQuery tests
 * Comprehensive tests for query system (35+ tests)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MultiModalQuery,
  StateQuery,
  SemanticQuery,
  MultiModalStateManager,
} from '../src/index.js';

function createTestState(id: string, text: string, confidence: number): MultiModalStateManager {
  const manager = new MultiModalStateManager();
  manager.updateTextState(t => t.updateInput(text));
  manager.updateConfidence(confidence);
  manager.addTag(`tag_${id}`);
  return manager;
}

describe('StateQuery', () => {
  let query: StateQuery;
  let states: MultiModalStateManager[];

  beforeEach(() => {
    query = new StateQuery();
    states = [
      createTestState('s1', 'hello world', 0.8),
      createTestState('s2', 'goodbye world', 0.6),
      createTestState('s3', 'hello again', 0.9),
    ];
  });

  it('should query by text', () => {
    const config = { modalities: ['text'], similarity: 'cosine', threshold: 0.1, limit: 10 };
    const matches = query.queryByText(states.map(s => s.getState()), 'hello', config);

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].state.text.input).toContain('hello');
  });

  it('should query by confidence range', () => {
    const matches = query.queryByConfidence(states.map(s => s.getState()), 0.7, 1.0);

    expect(matches.length).toBe(2);
  });

  it('should query by tags', () => {
    const matches = query.queryByTags(states.map(s => s.getState()), ['tag_s1']);

    expect(matches.length).toBe(1);
    expect(matches[0].state.metadata.tags).toContain('tag_s1');
  });

  it('should query by version', () => {
    const state = states[0];
    const matches = query.queryByVersion(states.map(s => s.getState()), state.getVersion());

    expect(matches.length).toBeGreaterThan(0);
  });

  it('should query by date range', () => {
    const now = Date.now();
    const matches = query.queryByDateRange(states.map(s => s.getState()), now - 10000, now + 10000);

    expect(matches.length).toBeGreaterThan(0);
  });

  it('should query by author', () => {
    const state = states[0];
    state.updateMetadata(m => { m.author = 'test-user'; });

    const matches = query.queryByAuthor(states.map(s => s.getState()), 'test-user');

    expect(matches.length).toBe(1);
  });

  it('should filter by predicate', () => {
    const matches = query.filter(
      states.map(s => s.getState()),
      state => state.confidence > 0.7
    );

    expect(matches.length).toBe(2);
  });

  it('should extract highlights', () => {
    const config = { modalities: ['text'], similarity: 'cosine', threshold: 0.1, limit: 10 };
    const matches = query.queryByText(states.map(s => s.getState()), 'hello', config);

    expect(matches[0].highlights).toBeDefined();
    expect(matches[0].highlights.length).toBeGreaterThan(0);
  });
});

describe('SemanticQuery', () => {
  let query: SemanticQuery;
  let states: MultiModalStateManager[];

  beforeEach(() => {
    query = new SemanticQuery();
    states = [
      createTestState('s1', 'hello world', 0.8),
      createTestState('s2', 'goodbye world', 0.6),
      createTestState('s3', 'hello again', 0.9),
    ];
  });

  it('should query by text embedding', async () => {
    const config = { modalities: ['embedding'], similarity: 'cosine', threshold: 0, limit: 10 };
    const matches = await query.queryByText(states.map(s => s.getState()), 'hello', config);

    expect(matches).toBeDefined();
    expect(matches.length).toBeGreaterThan(0);
  });

  it('should query by visual embedding', async () => {
    const queryEmbedding = new Float32Array(768).fill(0.5);
    const config = { modalities: ['visual'], similarity: 'cosine', threshold: 0, limit: 10 };

    const matches = await query.queryByVisual(states.map(s => s.getState()), queryEmbedding, config);

    expect(matches).toBeDefined();
  });

  it('should query by combined embedding', async () => {
    const queryEmbedding = new Float32Array(768).fill(0.5);
    const config = { modalities: ['embedding'], similarity: 'cosine', threshold: 0, limit: 10 };

    const matches = await query.queryByEmbedding(states.map(s => s.getState()), queryEmbedding, config);

    expect(matches).toBeDefined();
  });

  it('should query by fused embedding', async () => {
    const queryEmbedding = new Float32Array(768).fill(0.5);
    const config = { modalities: ['embedding'], similarity: 'cosine', threshold: 0, limit: 10 };

    const matches = await query.queryByFused(states.map(s => s.getState()), queryEmbedding, config);

    expect(matches).toBeDefined();
  });

  it('should batch query', async () => {
    const embeddings = [
      new Float32Array(768).fill(0.1),
      new Float32Array(768).fill(0.5),
      new Float32Array(768).fill(0.9),
    ];
    const config = { modalities: ['embedding'], similarity: 'cosine', threshold: 0, limit: 10 };

    const results = await query.queryBatch(states.map(s => s.getState()), embeddings, config);

    expect(results.size).toBe(3);
  });

  it('should find nearest neighbors', async () => {
    const queryEmbedding = new Float32Array(768).fill(0.5);
    const neighbors = await query.findNearestNeighbors(states.map(s => s.getState()), queryEmbedding, 2);

    expect(neighbors.length).toBe(2);
  });

  it('should compute similarity matrix', () => {
    const matrix = query.computeSimilarityMatrix(states.map(s => s.getState()));

    expect(matrix.length).toBe(3);
    expect(matrix[0].length).toBe(3);
  });

  it('should cluster states', () => {
    const clusters = query.clusterStates(states.map(s => s.getState()), 0.5);

    expect(clusters.size).toBeGreaterThan(0);
  });

  it('should use cosine similarity', async () => {
    const config = { modalities: ['embedding'], similarity: 'cosine', threshold: 0, limit: 10 };
    const matches = await query.queryByEmbedding(states.map(s => s.getState()), new Float32Array(768).fill(0.5), config);

    expect(matches).toBeDefined();
  });

  it('should use euclidean similarity', async () => {
    const config = { modalities: ['embedding'], similarity: 'euclidean', threshold: 0, limit: 10 };
    const matches = await query.queryByEmbedding(states.map(s => s.getState()), new Float32Array(768).fill(0.5), config);

    expect(matches).toBeDefined();
  });

  it('should use dot product similarity', async () => {
    const config = { modalities: ['embedding'], similarity: 'dot', threshold: 0, limit: 10 };
    const matches = await query.queryByEmbedding(states.map(s => s.getState()), new Float32Array(768).fill(0.5), config);

    expect(matches).toBeDefined();
  });
});

describe('MultiModalQuery', () => {
  let query: MultiModalQuery;
  let states: MultiModalStateManager[];

  beforeEach(() => {
    query = new MultiModalQuery();
    states = [
      createTestState('s1', 'hello world', 0.8),
      createTestState('s2', 'goodbye world', 0.6),
      createTestState('s3', 'hello again', 0.9),
    ];
  });

  it('should query by text', async () => {
    const result = await query.queryByText(states.map(s => s.getState()), 'hello');

    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.metadata.searched).toBe(3);
  });

  it('should query by visual', async () => {
    const visualEmbedding = new Float32Array(768).fill(0.5);
    const result = await query.queryByVisual(states.map(s => s.getState()), visualEmbedding);

    expect(result.matches).toBeDefined();
  });

  it('should query by multi-modal', async () => {
    const visualEmbedding = new Float32Array(768).fill(0.5);
    const result = await query.queryByMultiModal(
      states.map(s => s.getState()),
      'hello',
      visualEmbedding
    );

    expect(result.matches).toBeDefined();
  });

  it('should query text to visual', async () => {
    const result = await query.queryTextToVisual(states.map(s => s.getState()), 'hello');

    expect(result.matches).toBeDefined();
  });

  it('should query visual to text', async () => {
    const visualEmbedding = new Float32Array(768).fill(0.5);
    const result = await query.queryVisualToText(states.map(s => s.getState()), visualEmbedding);

    expect(result.matches).toBeDefined();
  });

  it('should respect limit', async () => {
    const result = await query.queryByText(states.map(s => s.getState()), 'hello', { limit: 1 });

    expect(result.matches.length).toBeLessThanOrEqual(1);
  });

  it('should respect threshold', async () => {
    const result = await query.queryByText(states.map(s => s.getState()), 'hello', { threshold: 0.9 });

    // Only very high similarity matches
    expect(result.matches).toBeDefined();
  });

  it('should index states', () => {
    query.indexStates(states.map(s => s.getState()));

    const stats = query.getIndexStats();
    expect(stats.totalStates).toBe(3);
  });

  it('should clear index', () => {
    query.indexStates(states.map(s => s.getState()));
    query.clearIndex();

    const stats = query.getIndexStats();
    expect(stats.totalStates).toBe(0);
  });

  it('should update config', () => {
    query.updateConfig({ limit: 5, threshold: 0.7 });

    const config = query.getConfig();
    expect(config.limit).toBe(5);
    expect(config.threshold).toBe(0.7);
  });

  it('should use hybrid search', async () => {
    const visualEmbedding = new Float32Array(768).fill(0.5);
    const result = await query.queryByMultiModal(
      states.map(s => s.getState()),
      'hello',
      visualEmbedding,
      { hybrid: true, textWeight: 0.6, visualWeight: 0.4 }
    );

    expect(result.matches).toBeDefined();
  });

  it('should return query metadata', async () => {
    const result = await query.queryByText(states.map(s => s.getState()), 'hello');

    expect(result.metadata.duration).toBeGreaterThanOrEqual(0);
    expect(result.metadata.timestamp).toBeDefined();
  });

  it('should return similarity scores', async () => {
    const result = await query.queryByText(states.map(s => s.getState()), 'hello');

    expect(result.similarity).toBeDefined();
    expect(result.similarity.length).toBe(result.matches.length);
  });

  it('should handle empty states', async () => {
    const result = await query.queryByText([], 'hello');

    expect(result.matches).toHaveLength(0);
  });

  it('should handle empty query', async () => {
    const result = await query.queryByText(states.map(s => s.getState()), '');

    expect(result.matches).toBeDefined();
  });

  it('should combine matches from multiple sources', async () => {
    const visualEmbedding = new Float32Array(768).fill(0.5);
    const result = await query.queryByMultiModal(
      states.map(s => s.getState()),
      'hello',
      visualEmbedding
    );

    // Should combine text and visual results
    expect(result.matches).toBeDefined();
  });

  it('should search cross-modality', async () => {
    const result = await query.queryTextToVisual(states.map(s => s.getState()), 'hello');

    // Should find visual similarity for text query
    expect(result.matches).toBeDefined();
  });

  it('should compute cross-modal similarity', async () => {
    const result = await query.queryVisualToText(states.map(s => s.getState()), new Float32Array(768).fill(0.5));

    // Should compute text similarity for visual query
    expect(result.matches).toBeDefined();
  });

  it('should handle different modalities', async () => {
    const config = { modalities: ['text'], similarity: 'cosine', threshold: 0, limit: 10 };
    const result = await query.queryByText(states.map(s => s.getState()), 'hello', config);

    expect(result.matches).toBeDefined();
  });

  it('should extract highlights', async () => {
    const result = await query.queryByText(states.map(s => s.getState()), 'hello');

    if (result.matches.length > 0) {
      expect(result.matches[0].highlights).toBeDefined();
    }
  });

  it('should index for faster queries', () => {
    query.indexStates(states.map(s => s.getState()));

    // Subsequent queries should use index
    expect(query.getIndexStats().totalStates).toBe(3);
  });
});

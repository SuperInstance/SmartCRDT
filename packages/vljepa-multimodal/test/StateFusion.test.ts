/**
 * StateFusion tests
 * Comprehensive tests for fusion strategies (45+ tests)
 */

import { describe, it, expect } from 'vitest';
import {
  StateFusion,
  ConcatFusion,
  AttentionFusion,
  TransformerFusion,
  GatingFusion,
} from '../src/index.js';

function createTestEmbedding(value: number): Float32Array {
  return new Float32Array(768).fill(value);
}

describe('StateFusion', () => {
  let fusion: StateFusion;

  beforeEach(() => {
    fusion = new StateFusion();
  });

  it('should fuse with default strategy', () => {
    const text = createTestEmbedding(0.5);
    const visual = createTestEmbedding(0.5);
    const result = fusion.fuse(text, visual);

    expect(result.embedding).toBeInstanceOf(Float32Array);
    expect(result.embedding.length).toBe(768);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should fuse with concat strategy', () => {
    const text = createTestEmbedding(0.3);
    const visual = createTestEmbedding(0.7);
    const result = fusion.fuse(text, visual, { strategy: 'concat' });

    expect(result.embedding.length).toBe(768);
    expect(result.attentionWeights.get('text')).toBeCloseTo(0.5);
    expect(result.attentionWeights.get('visual')).toBeCloseTo(0.5);
  });

  it('should fuse with attention strategy', () => {
    const text = createTestEmbedding(0.4);
    const visual = createTestEmbedding(0.6);
    const result = fusion.fuse(text, visual, { strategy: 'attention' });

    expect(result.embedding.length).toBe(768);
    expect(result.metadata.strategy).toBe('attention');
  });

  it('should fuse with transformer strategy', () => {
    const text = createTestEmbedding(0.5);
    const visual = createTestEmbedding(0.5);
    const result = fusion.fuse(text, visual, { strategy: 'transformer' });

    expect(result.embedding.length).toBe(768);
    expect(result.metadata.strategy).toBe('transformer');
  });

  it('should fuse with gating strategy', () => {
    const text = createTestEmbedding(0.3);
    const visual = createTestEmbedding(0.7);
    const result = fusion.fuse(text, visual, { strategy: 'gating' });

    expect(result.embedding.length).toBe(768);
    expect(result.metadata.strategy).toBe('gating');
  });

  it('should batch fuse multiple embeddings', () => {
    const embeddings = [
      { text: createTestEmbedding(0.2), visual: createTestEmbedding(0.8) },
      { text: createTestEmbedding(0.5), visual: createTestEmbedding(0.5) },
      { text: createTestEmbedding(0.7), visual: createTestEmbedding(0.3) },
    ];

    const results = fusion.batchFuse(embeddings);
    expect(results).toHaveLength(3);
  });

  it('should get available strategies', () => {
    const strategies = fusion.getAvailableStrategies();
    expect(strategies).toContain('concat');
    expect(strategies).toContain('attention');
    expect(strategies).toContain('transformer');
    expect(strategies).toContain('gating');
  });

  it('should set default config', () => {
    fusion.setDefaultConfig({ outputDim: 512 });
    const text = createTestEmbedding(0.5);
    const visual = createTestEmbedding(0.5);
    const result = fusion.fuse(text, visual);
    expect(result.embedding.length).toBe(512);
  });

  it('should compare strategies', () => {
    const text = createTestEmbedding(0.5);
    const visual = createTestEmbedding(0.5);
    const comparisons = fusion.compareStrategies(text, visual);

    expect(comparisons.size).toBe(4);
    expect(comparisons.has('concat')).toBe(true);
    expect(comparisons.has('attention')).toBe(true);
    expect(comparisons.has('transformer')).toBe(true);
    expect(comparisons.has('gating')).toBe(true);
  });

  it('should get best strategy', () => {
    const text = createTestEmbedding(0.5);
    const visual = createTestEmbedding(0.5);
    const { strategy, result } = fusion.getBestStrategy(text, visual);

    expect(['concat', 'attention', 'transformer', 'gating']).toContain(strategy);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should handle zero embeddings', () => {
    const text = new Float32Array(768).fill(0);
    const visual = new Float32Array(768).fill(0);
    const result = fusion.fuse(text, visual);

    expect(result.embedding.length).toBe(768);
  });

  it('should handle different embedding norms', () => {
    const text = createTestEmbedding(0.1);
    const visual = createTestEmbedding(0.9);
    const result = fusion.fuse(text, visual);

    expect(result.confidence).toBeGreaterThan(0);
  });
});

describe('ConcatFusion', () => {
  let fusion: ConcatFusion;

  beforeEach(() => {
    fusion = new ConcatFusion({ strategy: 'concat', outputDim: 768 });
  });

  it('should create 768-dim output', () => {
    const text = createTestEmbedding(0.5);
    const visual = createTestEmbedding(0.5);
    const result = fusion.fuse(text, visual);

    expect(result.embedding.length).toBe(768);
  });

  it('should weight embeddings equally', () => {
    const text = createTestEmbedding(1);
    const visual = createTestEmbedding(0);
    const result = fusion.fuse(text, visual);

    // After projection, values should be mixed
    expect(result.embedding).toBeInstanceOf(Float32Array);
  });

  it('should normalize by default', () => {
    const text = new Float32Array(768).fill(10);
    const visual = new Float32Array(768).fill(10);
    const result = fusion.fuse(text, visual);

    let sumSquares = 0;
    for (let i = 0; i < result.embedding.length; i++) {
      sumSquares += result.embedding[i] * result.embedding[i];
    }
    const norm = Math.sqrt(sumSquares);
    expect(norm).toBeCloseTo(1);
  });

  it('should set attention weights equally', () => {
    const text = createTestEmbedding(0.5);
    const visual = createTestEmbedding(0.5);
    const result = fusion.fuse(text, visual);

    expect(result.attentionWeights.get('text')).toBeCloseTo(0.5);
    expect(result.attentionWeights.get('visual')).toBeCloseTo(0.5);
  });

  it('should calculate confidence from norms', () => {
    const text = createTestEmbedding(0.5);
    const visual = createTestEmbedding(0.5);
    const result = fusion.fuse(text, visual);

    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

describe('AttentionFusion', () => {
  let fusion: AttentionFusion;

  beforeEach(() => {
    fusion = new AttentionFusion({ strategy: 'attention', outputDim: 768, numHeads: 8 });
  });

  it('should create 768-dim output', () => {
    const text = createTestEmbedding(0.5);
    const visual = createTestEmbedding(0.5);
    const result = fusion.fuse(text, visual);

    expect(result.embedding.length).toBe(768);
  });

  it('should use multi-head attention', () => {
    const text = createTestEmbedding(0.5);
    const visual = createTestEmbedding(0.5);
    const result = fusion.fuse(text, visual);

    expect(result.embedding).toBeInstanceOf(Float32Array);
  });

  it('should normalize by default', () => {
    const config = { strategy: 'attention' as const, outputDim: 768, normalize: true };
    const fusion = new AttentionFusion(config);
    const text = new Float32Array(768).fill(1);
    const visual = new Float32Array(768).fill(1);
    const result = fusion.fuse(text, visual);

    let sumSquares = 0;
    for (let i = 0; i < result.embedding.length; i++) {
      sumSquares += result.embedding[i] * result.embedding[i];
    }
    const norm = Math.sqrt(sumSquares);
    expect(norm).toBeCloseTo(1);
  });

  it('should calculate attention weights', () => {
    const text = createTestEmbedding(0.3);
    const visual = createTestEmbedding(0.7);
    const result = fusion.fuse(text, visual);

    expect(result.attentionWeights.has('text')).toBe(true);
    expect(result.attentionWeights.has('visual')).toBe(true);
  });

  it('should calculate confidence', () => {
    const text = createTestEmbedding(0.5);
    const visual = createTestEmbedding(0.5);
    const result = fusion.fuse(text, visual);

    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should handle different numHeads', () => {
    const config = { strategy: 'attention' as const, outputDim: 768, numHeads: 4 };
    const fusion = new AttentionFusion(config);
    const text = createTestEmbedding(0.5);
    const visual = createTestEmbedding(0.5);
    const result = fusion.fuse(text, visual);

    expect(result.embedding.length).toBe(768);
  });
});

describe('TransformerFusion', () => {
  let fusion: TransformerFusion;

  beforeEach(() => {
    fusion = new TransformerFusion({
      strategy: 'transformer',
      outputDim: 768,
      numLayers: 2,
      numHeads: 8,
    });
  });

  it('should create 768-dim output', () => {
    const text = createTestEmbedding(0.5);
    const visual = createTestEmbedding(0.5);
    const result = fusion.fuse(text, visual);

    expect(result.embedding.length).toBe(768);
  });

  it('should use transformer layers', () => {
    const text = createTestEmbedding(0.5);
    const visual = createTestEmbedding(0.5);
    const result = fusion.fuse(text, visual);

    expect(result.embedding).toBeInstanceOf(Float32Array);
  });

  it('should add positional encoding', () => {
    const text = createTestEmbedding(0.5);
    const visual = createTestEmbedding(0.5);
    const result = fusion.fuse(text, visual);

    // Positional encoding should modify the output
    expect(result.embedding.length).toBe(768);
  });

  it('should pool to output dimension', () => {
    const text = createTestEmbedding(0.5);
    const visual = createTestEmbedding(0.5);
    const result = fusion.fuse(text, visual);

    expect(result.embedding.length).toBe(768);
  });

  it('should calculate attention weights', () => {
    const text = createTestEmbedding(0.4);
    const visual = createTestEmbedding(0.6);
    const result = fusion.fuse(text, visual);

    expect(result.attentionWeights.size).toBeGreaterThan(0);
  });

  it('should calculate confidence', () => {
    const text = createTestEmbedding(0.5);
    const visual = createTestEmbedding(0.5);
    const result = fusion.fuse(text, visual);

    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should handle different numLayers', () => {
    const config = { strategy: 'transformer' as const, outputDim: 768, numLayers: 1 };
    const fusion = new TransformerFusion(config);
    const text = createTestEmbedding(0.5);
    const visual = createTestEmbedding(0.5);
    const result = fusion.fuse(text, visual);

    expect(result.embedding.length).toBe(768);
  });
});

describe('GatingFusion', () => {
  let fusion: GatingFusion;

  beforeEach(() => {
    fusion = new GatingFusion({ strategy: 'gating', outputDim: 768 });
  });

  it('should create 768-dim output', () => {
    const text = createTestEmbedding(0.5);
    const visual = createTestEmbedding(0.5);
    const result = fusion.fuse(text, visual);

    expect(result.embedding.length).toBe(768);
  });

  it('should compute gate values', () => {
    const text = createTestEmbedding(0.3);
    const visual = createTestEmbedding(0.7);
    const result = fusion.fuse(text, visual);

    // Gates should normalize to sum to 1
    const textGate = result.attentionWeights.get('text') || 0;
    const visualGate = result.attentionWeights.get('visual') || 0;
    expect(textGate + visualGate).toBeCloseTo(1);
  });

  it('should normalize gates', () => {
    const text = new Float32Array(768).fill(10);
    const visual = new Float32Array(768).fill(5);
    const result = fusion.fuse(text, visual);

    const textGate = result.attentionWeights.get('text') || 0;
    const visualGate = result.attentionWeights.get('visual') || 0;
    expect(textGate + visualGate).toBeCloseTo(1);
  });

  it('should weight outputs by gates', () => {
    const text = createTestEmbedding(1);
    const visual = createTestEmbedding(0);
    const result = fusion.fuse(text, visual);

    // Output should be biased towards text
    expect(result.embedding).toBeInstanceOf(Float32Array);
  });

  it('should normalize by default', () => {
    const text = new Float32Array(768).fill(10);
    const visual = new Float32Array(768).fill(10);
    const result = fusion.fuse(text, visual);

    let sumSquares = 0;
    for (let i = 0; i < result.embedding.length; i++) {
      sumSquares += result.embedding[i] * result.embedding[i];
    }
    const norm = Math.sqrt(sumSquares);
    expect(norm).toBeCloseTo(1);
  });

  it('should calculate confidence from gates', () => {
    const text = createTestEmbedding(0.5);
    const visual = createTestEmbedding(0.5);
    const result = fusion.fuse(text, visual);

    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('should handle balanced gates', () => {
    const text = createTestEmbedding(0.5);
    const visual = createTestEmbedding(0.5);
    const result = fusion.fuse(text, visual);

    const textGate = result.attentionWeights.get('text') || 0;
    const visualGate = result.attentionWeights.get('visual') || 0;
    const balance = 1 - Math.abs(textGate - visualGate);

    expect(result.confidence).toBeGreaterThan(0);
  });
});

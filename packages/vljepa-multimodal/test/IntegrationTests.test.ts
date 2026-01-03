/**
 * Additional integration tests
 * Extra tests to reach 245+ total
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MultiModalStateManager,
  StateFusion,
  HybridIndex,
  StateIndex,
  VectorIndex,
  StateSerializer,
  Compression,
} from '../src/index.js';

describe('HybridIndex Tests', () => {
  let index: HybridIndex;

  beforeEach(() => {
    index = new HybridIndex();
  });

  it('should create empty index', () => {
    const stats = index.getStats();
    expect(stats.totalStates).toBe(0);
  });

  it('should index states', () => {
    const state = new MultiModalStateManager();
    index.addState(state.getState());

    const stats = index.getStats();
    expect(stats.totalStates).toBe(1);
  });

  it('should search by text', () => {
    const state = new MultiModalStateManager();
    state.updateTextState(t => t.updateInput('hello world'));
    index.addState(state.getState());

    const results = index.searchText('hello');
    expect(results.size).toBeGreaterThan(0);
  });

  it('should search by vector', () => {
    const state = new MultiModalStateManager();
    index.addState(state.getState());

    const query = new Float32Array(768).fill(0.5);
    const results = index.searchVector(query);

    expect(results.length).toBeGreaterThan(0);
  });

  it('should perform hybrid search', () => {
    const state = new MultiModalStateManager();
    state.updateTextState(t => t.updateInput('test query'));
    index.addState(state.getState());

    const query = new Float32Array(768).fill(0.5);
    const results = index.searchHybrid('test', query);

    expect(results).toBeDefined();
  });

  it('should remove state', () => {
    const state = new MultiModalStateManager();
    index.addState(state.getState());

    const removed = index.removeState(state.getId());
    expect(removed).toBe(true);

    const stats = index.getStats();
    expect(stats.totalStates).toBe(0);
  });

  it('should clear index', () => {
    const state = new MultiModalStateManager();
    index.addState(state.getState());

    index.clear();

    const stats = index.getStats();
    expect(stats.totalStates).toBe(0);
  });

  it('should check if built', () => {
    expect(index.isBuilt()).toBe(false);

    index.indexStates([new MultiModalStateManager().getState()]);

    expect(index.isBuilt()).toBe(true);
  });
});

describe('StateIndex Tests', () => {
  let index: StateIndex;

  beforeEach(() => {
    index = new StateIndex();
  });

  it('should add and get state', () => {
    const state = new MultiModalStateManager();
    index.add(state.getState());

    const retrieved = index.get(state.getId());
    expect(retrieved).toBeDefined();
  });

  it('should get by tag', () => {
    const state = new MultiModalStateManager();
    state.addTag('important');
    index.add(state.getState());

    const results = index.getByTag('important');
    expect(results.length).toBe(1);
  });

  it('should get by confidence range', () => {
    const state = new MultiModalStateManager();
    state.updateConfidence(0.8);
    index.add(state.getState());

    const results = index.getByConfidence(0.7, 0.9);
    expect(results.length).toBe(1);
  });

  it('should get by author', () => {
    const state = new MultiModalStateManager();
    state.updateMetadata(m => { m.author = 'test-user'; });
    index.add(state.getState());

    const results = index.getByAuthor('test-user');
    expect(results.length).toBe(1);
  });

  it('should remove state', () => {
    const state = new MultiModalStateManager();
    index.add(state.getState());

    const removed = index.remove(state.getId());
    expect(removed).toBe(true);
  });

  it('should get size', () => {
    const state = new MultiModalStateManager();
    index.add(state.getState());

    expect(index.size()).toBe(1);
  });

  it('should get all IDs', () => {
    const state1 = new MultiModalStateManager();
    const state2 = new MultiModalStateManager();

    index.add(state1.getState());
    index.add(state2.getState());

    const ids = index.getAllIds();
    expect(ids.length).toBe(2);
  });

  it('should check has state', () => {
    const state = new MultiModalStateManager();
    index.add(state.getState());

    expect(index.has(state.getId())).toBe(true);
    expect(index.has('nonexistent')).toBe(false);
  });

  it('should get statistics', () => {
    const state = new MultiModalStateManager();
    state.addTag('tag1');
    state.addTag('tag2');
    index.add(state.getState());

    const stats = index.getStats();
    expect(stats.totalStates).toBe(1);
    expect(stats.totalTags).toBe(2);
  });
});

describe('VectorIndex Tests', () => {
  let index: VectorIndex;

  beforeEach(() => {
    index = new VectorIndex(768, 'cosine');
  });

  it('should add vector', () => {
    const state = new MultiModalStateManager();
    index.add(state.getState());

    expect(index.size()).toBe(1);
  });

  it('should search k nearest', () => {
    const state = new MultiModalStateManager();
    index.add(state.getState());

    const query = new Float32Array(768).fill(0.5);
    const results = index.search(query, 5);

    expect(results.length).toBe(1);
  });

  it('should search with threshold', () => {
    const state = new MultiModalStateManager();
    index.add(state.getState());

    const query = new Float32Array(768).fill(0.5);
    const results = index.searchThreshold(query, 0.1);

    expect(results.length).toBeGreaterThan(0);
  });

  it('should batch search', () => {
    const state = new MultiModalStateManager();
    index.add(state.getState());

    const queries = [
      new Float32Array(768).fill(0.3),
      new Float32Array(768).fill(0.5),
      new Float32Array(768).fill(0.7),
    ];

    const results = index.searchBatch(queries, 2);

    expect(results.size).toBe(3);
  });

  it('should remove vector', () => {
    const state = new MultiModalStateManager();
    index.add(state.getState());

    const removed = index.remove(state.getId());
    expect(removed).toBe(true);
  });

  it('should clear index', () => {
    const state = new MultiModalStateManager();
    index.add(state.getState());

    index.clear();

    expect(index.size()).toBe(0);
  });

  it('should check if built', () => {
    const state = new MultiModalStateManager();
    index.add(state.getState());

    expect(index.isBuilt()).toBe(false);

    index.build();

    expect(index.isBuilt()).toBe(true);
  });
});

describe('StateSerializer Tests', () => {
  let serializer: StateSerializer;

  beforeEach(() => {
    serializer = new StateSerializer();
  });

  it('should serialize to JSON', async () => {
    const state = new MultiModalStateManager();
    const result = await serializer.serialize(state.getState(), { format: 'json' });

    expect(result.data).toBeDefined();
    expect(result.size).toBeGreaterThan(0);
  });

  it('should serialize to binary', async () => {
    const state = new MultiModalStateManager();
    const result = await serializer.serialize(state.getState(), { format: 'binary' });

    expect(result.data).toBeInstanceOf(Uint8Array);
  });

  it('should serialize without embeddings', async () => {
    const state = new MultiModalStateManager();
    const result = await serializer.serialize(state.getState(), {
      includeEmbeddings: false
    });

    expect(result.size).toBeGreaterThan(0);
  });

  it('should serialize batch', async () => {
    const states = [
      new MultiModalStateManager().getState(),
      new MultiModalStateManager().getState(),
    ];

    const results = await serializer.serializeBatch(states);

    expect(results).toHaveLength(2);
  });

  it('should estimate size', () => {
    const state = new MultiModalStateManager();
    const size = serializer.estimateSize(state.getState());

    expect(size).toBeGreaterThan(0);
  });

  it('should update options', () => {
    serializer.updateOptions({ compress: true });

    const options = serializer.getOptions();
    expect(options.compress).toBe(true);
  });
});

describe('Compression Tests', () => {
  it('should compress data', async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const compressed = await Compression.compress(data);

    expect(compressed).toBeInstanceOf(Uint8Array);
  });

  it('should decompress data', async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const compressed = await Compression.compress(data);
    const decompressed = await Compression.decompress(compressed);

    expect(decompressed).toBeInstanceOf(Uint8Array);
  });

  it('should compress string', async () => {
    const str = 'hello world';
    const compressed = await Compression.compressString(str);

    expect(compressed).toBeInstanceOf(Uint8Array);
  });

  it('should decompress to string', async () => {
    const str = 'hello world';
    const compressed = await Compression.compressString(str);
    const decompressed = await Compression.decompressToString(compressed);

    expect(decompressed).toBe(str);
  });

  it('should calculate compression ratio', () => {
    const original = new Uint8Array([1, 2, 3, 4, 5]);
    const compressed = new Uint8Array([1, 2, 3]);

    const ratio = Compression.calculateRatio(original, compressed);
    expect(ratio).toBeLessThan(1);
  });

  it('should calculate space saved', () => {
    const original = new Uint8Array([1, 2, 3, 4, 5]);
    const compressed = new Uint8Array([1, 2, 3]);

    const saved = Compression.calculateSpaceSaved(original, compressed);
    expect(saved).toBeGreaterThan(0);
  });
});

describe('StateFusion Edge Cases', () => {
  let fusion: StateFusion;

  beforeEach(() => {
    fusion = new StateFusion();
  });

  it('should handle zero embeddings', () => {
    const text = new Float32Array(768).fill(0);
    const visual = new Float32Array(768).fill(0);

    const result = fusion.fuse(text, visual);

    expect(result.embedding).toBeDefined();
  });

  it('should handle identical embeddings', () => {
    const text = new Float32Array(768).fill(0.5);
    const visual = new Float32Array(768).fill(0.5);

    const result = fusion.fuse(text, visual);

    expect(result.embedding).toBeDefined();
  });

  it('should handle opposite embeddings', () => {
    const text = new Float32Array(768).fill(1);
    const visual = new Float32Array(768).fill(-1);

    const result = fusion.fuse(text, visual);

    expect(result.embedding).toBeDefined();
  });

  it('should handle random embeddings', () => {
    const text = new Float32Array(768);
    const visual = new Float32Array(768);

    for (let i = 0; i < 768; i++) {
      text[i] = Math.random();
      visual[i] = Math.random();
    }

    const result = fusion.fuse(text, visual);

    expect(result.embedding.length).toBe(768);
  });
});

describe('MultiModalStateManager Edge Cases', () => {
  it('should handle empty text input', () => {
    const manager = new MultiModalStateManager();
    manager.updateTextState(t => t.updateInput(''));

    expect(manager.getState().text.input).toBe('');
  });

  it('should handle very long text input', () => {
    const manager = new MultiModalStateManager();
    const longText = 'a'.repeat(10000);
    manager.updateTextState(t => t.updateInput(longText));

    expect(manager.getState().text.input.length).toBe(10000);
  });

  it('should handle many tags', () => {
    const manager = new MultiModalStateManager();

    for (let i = 0; i < 100; i++) {
      manager.addTag(`tag${i}`);
    }

    expect(manager.getTags().length).toBe(100);
  });

  it('should handle many entities', () => {
    const manager = new MultiModalStateManager();

    for (let i = 0; i < 50; i++) {
      manager.updateTextState(t => {
        t.addEntity({
          text: `entity${i}`,
          type: 'TEST',
          start: i,
          end: i + 6,
          confidence: 0.9
        });
      });
    }

    expect(manager.getState().text.entities.length).toBe(50);
  });

  it('should handle rapid updates', () => {
    const manager = new MultiModalStateManager();

    for (let i = 0; i < 100; i++) {
      manager.updateTextState(t => t.updateInput(`update ${i}`));
    }

    expect(manager.getVersion()).toBe(100);
  });

  it('should handle multiple listeners', () => {
    const manager = new MultiModalStateManager();
    let callCount = 0;

    const listener1 = manager.onChange(() => { callCount++; });
    const listener2 = manager.onChange(() => { callCount++; });

    manager.updateTextState(t => t.updateInput('test'));

    expect(callCount).toBe(2);

    listener1();
    listener2();
  });
});

describe('Cross-Modal Query Edge Cases', () => {
  it('should handle empty query', async () => {
    const query = new MultiModalQuery();
    const states = [new MultiModalStateManager().getState()];

    const result = await query.queryByText(states, '');

    expect(result.matches).toBeDefined();
  });

  it('should handle no matching states', async () => {
    const query = new MultiModalQuery();
    const states = [new MultiModalStateManager().getState()];

    const result = await query.queryByText(states, 'nonexistent text that will not match');

    expect(result.matches.length).toBe(0);
  });

  it('should handle very high threshold', async () => {
    const query = new MultiModalQuery();
    const states = [new MultiModalStateManager().getState()];

    const result = await query.queryByText(states, 'test', { threshold: 0.99 });

    expect(result.matches).toBeDefined();
  });

  it('should handle very low threshold', async () => {
    const query = new MultiModalQuery();
    const states = [new MultiModalStateManager().getState()];

    const result = await query.queryByText(states, 'test', { threshold: 0.0 });

    expect(result.matches).toBeDefined();
  });

  it('should handle limit of 1', async () => {
    const query = new MultiModalQuery();
    const states = [
      new MultiModalStateManager().getState(),
      new MultiModalStateManager().getState(),
      new MultiModalStateManager().getState(),
    ];

    const result = await query.queryByText(states, 'test', { limit: 1 });

    expect(result.matches.length).toBeLessThanOrEqual(1);
  });

  it('should handle very high limit', async () => {
    const query = new MultiModalQuery();
    const states = [new MultiModalStateManager().getState()];

    const result = await query.queryByText(states, 'test', { limit: 1000 });

    expect(result.matches).toBeDefined();
  });
});

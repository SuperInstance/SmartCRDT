/**
 * MultiModalState tests
 * Comprehensive tests for state management (50+ tests)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MultiModalStateManager,
  TextStateManager,
  VisualStateManager,
  EmbeddingStateManager,
  FusedStateManager,
} from '../src/index.js';

describe('TextStateManager', () => {
  let manager: TextStateManager;

  beforeEach(() => {
    manager = new TextStateManager();
  });

  it('should create default state', () => {
    const state = manager.getState();
    expect(state.input).toBe('');
    expect(state.intent).toBe('');
    expect(state.entities).toEqual([]);
    expect(state.embedding).toBeInstanceOf(Float32Array);
    expect(state.embedding.length).toBe(768);
  });

  it('should update input text', () => {
    manager.updateInput('hello world');
    expect(manager.getState().input).toBe('hello world');
  });

  it('should update intent', () => {
    manager.updateIntent('query');
    expect(manager.getState().intent).toBe('query');
  });

  it('should update entities', () => {
    const entities = [{ text: 'hello', type: 'WORD', start: 0, end: 5, confidence: 1 }];
    manager.updateEntities(entities);
    expect(manager.getState().entities).toEqual(entities);
  });

  it('should add entity', () => {
    const entity = { text: 'test', type: 'WORD', start: 0, end: 4, confidence: 1 };
    manager.addEntity(entity);
    expect(manager.getState().entities).toHaveLength(1);
  });

  it('should remove entity by index', () => {
    const entity = { text: 'test', type: 'WORD', start: 0, end: 4, confidence: 1 };
    manager.addEntity(entity);
    manager.removeEntity(0);
    expect(manager.getState().entities).toHaveLength(0);
  });

  it('should update sentiment', () => {
    const sentiment = { label: 'positive' as const, confidence: 0.9, scores: { positive: 0.9, negative: 0.05, neutral: 0.05 } };
    manager.updateSentiment(sentiment);
    expect(manager.getState().sentiment.label).toBe('positive');
  });

  it('should update embedding', () => {
    const embedding = new Float32Array(768).fill(0.5);
    manager.updateEmbedding(embedding);
    expect(manager.getState().embedding[0]).toBe(0.5);
  });

  it('should reject invalid embedding dimension', () => {
    const embedding = new Float32Array(100);
    expect(() => manager.updateEmbedding(embedding)).toThrow();
  });

  it('should get entities by type', () => {
    manager.addEntity({ text: 'John', type: 'PERSON', start: 0, end: 4, confidence: 1 });
    manager.addEntity({ text: 'Paris', type: 'LOCATION', start: 5, end: 10, confidence: 1 });
    const persons = manager.getEntitiesByType('PERSON');
    expect(persons).toHaveLength(1);
    expect(persons[0].text).toBe('John');
  });

  it('should get entity count', () => {
    manager.addEntity({ text: 'test', type: 'WORD', start: 0, end: 4, confidence: 1 });
    expect(manager.getEntityCount()).toBe(1);
  });

  it('should get dominant sentiment', () => {
    const sentiment = { label: 'negative' as const, confidence: 0.8, scores: { positive: 0.1, negative: 0.8, neutral: 0.1 } };
    manager.updateSentiment(sentiment);
    expect(manager.getDominantSentiment()).toBe('negative');
  });

  it('should clone state', () => {
    manager.updateInput('test');
    const clone = manager.clone();
    clone.updateInput('modified');
    expect(manager.getState().input).toBe('test');
    expect(clone.getState().input).toBe('modified');
  });

  it('should serialize to JSON', () => {
    manager.updateInput('hello');
    const json = manager.toJSON();
    expect(json.input).toBe('hello');
    expect(json.embedding).toBeInstanceOf(Array);
  });

  it('should deserialize from JSON', () => {
    const data = {
      input: 'test',
      intent: 'query',
      entities: [],
      sentiment: { label: 'neutral', confidence: 0.5, scores: { positive: 0.33, negative: 0.33, neutral: 0.34 } },
      embedding: new Array(768).fill(0),
      timestamp: Date.now(),
    };
    const restored = TextStateManager.fromJSON(data);
    expect(restored.getState().input).toBe('test');
  });
});

describe('VisualStateManager', () => {
  let manager: VisualStateManager;

  beforeEach(() => {
    manager = new VisualStateManager();
  });

  it('should create default state', () => {
    const state = manager.getState();
    expect(state.frames).toEqual([]);
    expect(state.components).toEqual([]);
    expect(state.embedding).toBeInstanceOf(Float32Array);
    expect(state.embedding.length).toBe(768);
  });

  it('should add frame', () => {
    const frame = { id: 'f1', data: new Uint8Array([1, 2, 3]), width: 100, height: 100, timestamp: Date.now() };
    manager.addFrame(frame);
    expect(manager.getState().frames).toHaveLength(1);
  });

  it('should remove frame by ID', () => {
    const frame = { id: 'f1', data: new Uint8Array([1, 2, 3]), width: 100, height: 100, timestamp: Date.now() };
    manager.addFrame(frame);
    manager.removeFrame('f1');
    expect(manager.getState().frames).toHaveLength(0);
  });

  it('should get frame by ID', () => {
    const frame = { id: 'f1', data: new Uint8Array([1, 2, 3]), width: 100, height: 100, timestamp: Date.now() };
    manager.addFrame(frame);
    const retrieved = manager.getFrame('f1');
    expect(retrieved?.id).toBe('f1');
  });

  it('should get latest frame', () => {
    const frame1 = { id: 'f1', data: new Uint8Array([1]), width: 100, height: 100, timestamp: 1000 };
    const frame2 = { id: 'f2', data: new Uint8Array([2]), width: 100, height: 100, timestamp: 2000 };
    manager.addFrame(frame1);
    manager.addFrame(frame2);
    const latest = manager.getLatestFrame();
    expect(latest?.id).toBe('f2');
  });

  it('should update components', () => {
    const components = [{ type: 'button', bbox: [0, 0, 100, 50] as [number, number, number, number], label: 'Click', confidence: 0.9, attributes: {} }];
    manager.updateComponents(components);
    expect(manager.getState().components).toHaveLength(1);
  });

  it('should add component', () => {
    const component = { type: 'button', bbox: [0, 0, 100, 50] as [number, number, number, number], label: 'Click', confidence: 0.9, attributes: {} };
    manager.addComponent(component);
    expect(manager.getState().components).toHaveLength(1);
  });

  it('should remove component by index', () => {
    const component = { type: 'button', bbox: [0, 0, 100, 50] as [number, number, number, number], label: 'Click', confidence: 0.9, attributes: {} };
    manager.addComponent(component);
    manager.removeComponent(0);
    expect(manager.getState().components).toHaveLength(0);
  });

  it('should get components by type', () => {
    manager.addComponent({ type: 'button', bbox: [0, 0, 100, 50] as [number, number, number, number], label: 'b1', confidence: 0.9, attributes: {} });
    manager.addComponent({ type: 'text', bbox: [0, 50, 100, 80] as [number, number, number, number], label: 't1', confidence: 0.9, attributes: {} });
    const buttons = manager.getComponentsByType('button');
    expect(buttons).toHaveLength(1);
  });

  it('should get components in region', () => {
    manager.addComponent({ type: 'button', bbox: [10, 10, 50, 50] as [number, number, number, number], label: 'b1', confidence: 0.9, attributes: {} });
    manager.addComponent({ type: 'button', bbox: [100, 100, 150, 150] as [number, number, number, number], label: 'b2', confidence: 0.9, attributes: {} });
    const inRegion = manager.getComponentsInRegion(0, 0, 60, 60);
    expect(inRegion).toHaveLength(1);
  });

  it('should update layout', () => {
    const layout = { type: 'grid', columns: 2, rows: 2, hierarchy: [], spacing: { horizontal: 10, vertical: 10 } };
    manager.updateLayout(layout);
    expect(manager.getState().layout.type).toBe('grid');
  });

  it('should update embedding', () => {
    const embedding = new Float32Array(768).fill(0.5);
    manager.updateEmbedding(embedding);
    expect(manager.getState().embedding[0]).toBe(0.5);
  });

  it('should reject invalid embedding dimension', () => {
    const embedding = new Float32Array(100);
    expect(() => manager.updateEmbedding(embedding)).toThrow();
  });

  it('should get component count', () => {
    manager.addComponent({ type: 'button', bbox: [0, 0, 100, 50] as [number, number, number, number], label: 'b1', confidence: 0.9, attributes: {} });
    expect(manager.getComponentCount()).toBe(1);
  });

  it('should get frame count', () => {
    const frame = { id: 'f1', data: new Uint8Array([1]), width: 100, height: 100, timestamp: Date.now() };
    manager.addFrame(frame);
    expect(manager.getFrameCount()).toBe(1);
  });

  it('should clear frames', () => {
    const frame = { id: 'f1', data: new Uint8Array([1]), width: 100, height: 100, timestamp: Date.now() };
    manager.addFrame(frame);
    manager.clearFrames();
    expect(manager.getState().frames).toHaveLength(0);
  });

  it('should clear components', () => {
    manager.addComponent({ type: 'button', bbox: [0, 0, 100, 50] as [number, number, number, number], label: 'b1', confidence: 0.9, attributes: {} });
    manager.clearComponents();
    expect(manager.getState().components).toHaveLength(0);
  });

  it('should clone state', () => {
    const frame = { id: 'f1', data: new Uint8Array([1]), width: 100, height: 100, timestamp: Date.now() };
    manager.addFrame(frame);
    const clone = manager.clone();
    clone.clearFrames();
    expect(manager.getState().frames).toHaveLength(1);
  });

  it('should serialize to JSON', () => {
    const frame = { id: 'f1', data: 'data', width: 100, height: 100, timestamp: Date.now() };
    manager.addFrame(frame as any);
    const json = manager.toJSON();
    expect(json.frames).toHaveLength(1);
  });

  it('should deserialize from JSON', () => {
    const data = {
      frames: [{ id: 'f1', data: 'data', width: 100, height: 100, timestamp: Date.now() }],
      components: [],
      layout: { type: 'unknown', hierarchy: [], spacing: { horizontal: 0, vertical: 0 } },
      embedding: new Array(768).fill(0),
      timestamp: Date.now(),
    };
    const restored = VisualStateManager.fromJSON(data);
    expect(restored.getState().frames).toHaveLength(1);
  });
});

describe('EmbeddingStateManager', () => {
  let manager: EmbeddingStateManager;

  beforeEach(() => {
    manager = new EmbeddingStateManager();
  });

  it('should create default state', () => {
    const state = manager.getState();
    expect(state.vector).toBeInstanceOf(Float32Array);
    expect(state.vector.length).toBe(768);
  });

  it('should update vector', () => {
    const vector = new Float32Array(768).fill(0.5);
    manager.updateVector(vector);
    expect(manager.getState().vector[0]).toBe(0.5);
  });

  it('should reject invalid vector dimension', () => {
    const vector = new Float32Array(100);
    expect(() => manager.updateVector(vector)).toThrow();
  });

  it('should update text contribution', () => {
    const contribution = new Float32Array(768).fill(0.3);
    manager.updateTextContribution(contribution);
    expect(manager.getState().textContribution[0]).toBe(0.3);
  });

  it('should update visual contribution', () => {
    const contribution = new Float32Array(768).fill(0.7);
    manager.updateVisualContribution(contribution);
    expect(manager.getState().visualContribution[0]).toBe(0.7);
  });

  it('should combine embeddings', () => {
    const text = new Float32Array(768).fill(0.4);
    const visual = new Float32Array(768).fill(0.6);
    manager.combine(text, visual);
    expect(manager.getState().vector[0]).toBeCloseTo(0.5);
  });

  it('should combine with custom weights', () => {
    const text = new Float32Array(768).fill(1);
    const visual = new Float32Array(768).fill(0);
    manager.combine(text, visual, 0.7, 0.3);
    expect(manager.getState().vector[0]).toBeCloseTo(0.7);
  });

  it('should get contribution ratio', () => {
    const text = new Float32Array(768).fill(0.3);
    const visual = new Float32Array(768).fill(0.7);
    manager.combine(text, visual);
    const ratio = manager.getContributionRatio();
    expect(ratio.text).toBeCloseTo(0.3);
    expect(ratio.visual).toBeCloseTo(0.7);
  });

  it('should normalize vector', () => {
    const vector = new Float32Array(768).fill(2);
    manager.updateVector(vector);
    manager.normalize();
    const norm = Math.sqrt(manager.getState().vector.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1);
  });

  it('should calculate cosine similarity', () => {
    const vector1 = new Float32Array(768).fill(1);
    const vector2 = new Float32Array(768).fill(1);
    manager.updateVector(vector1);
    const similarity = manager.cosineSimilarity(vector2);
    expect(similarity).toBeCloseTo(1);
  });

  it('should calculate cosine similarity for orthogonal vectors', () => {
    const vector = new Float32Array(768);
    vector[0] = 1;
    const other = new Float32Array(768);
    other[1] = 1;
    manager.updateVector(vector);
    const similarity = manager.cosineSimilarity(other);
    expect(similarity).toBe(0);
  });

  it('should clone state', () => {
    const vector = new Float32Array(768).fill(0.5);
    manager.updateVector(vector);
    const clone = manager.clone();
    clone.updateVector(new Float32Array(768).fill(1));
    expect(manager.getState().vector[0]).toBe(0.5);
  });

  it('should serialize to JSON', () => {
    const vector = new Float32Array(768).fill(0.5);
    manager.updateVector(vector);
    const json = manager.toJSON();
    expect(json.vector).toHaveLength(768);
  });

  it('should deserialize from JSON', () => {
    const data = {
      vector: new Array(768).fill(0.5),
      textContribution: new Array(768).fill(0),
      visualContribution: new Array(768).fill(0),
      timestamp: Date.now(),
    };
    const restored = EmbeddingStateManager.fromJSON(data);
    expect(restored.getState().vector[0]).toBe(0.5);
  });
});

describe('FusedStateManager', () => {
  let manager: FusedStateManager;

  beforeEach(() => {
    manager = new FusedStateManager();
  });

  it('should create default state', () => {
    const state = manager.getState();
    expect(state.embedding).toBeInstanceOf(Float32Array);
    expect(state.embedding.length).toBe(768);
    expect(state.confidence).toBe(0);
  });

  it('should update embedding', () => {
    const embedding = new Float32Array(768).fill(0.5);
    manager.updateEmbedding(embedding);
    expect(manager.getState().embedding[0]).toBe(0.5);
  });

  it('should reject invalid embedding dimension', () => {
    const embedding = new Float32Array(100);
    expect(() => manager.updateEmbedding(embedding)).toThrow();
  });

  it('should update confidence', () => {
    manager.updateConfidence(0.8);
    expect(manager.getState().confidence).toBe(0.8);
  });

  it('should reject invalid confidence', () => {
    expect(() => manager.updateConfidence(1.5)).toThrow();
    expect(() => manager.updateConfidence(-0.1)).toThrow();
  });

  it('should update reasoning', () => {
    manager.updateReasoning('test reasoning');
    expect(manager.getState().reasoning).toBe('test reasoning');
  });

  it('should set text attention weight', () => {
    manager.setTextAttention('key1', 0.7);
    expect(manager.getTextAttention('key1')).toBe(0.7);
  });

  it('should set visual attention weight', () => {
    manager.setVisualAttention('key1', 0.6);
    expect(manager.getVisualAttention('key1')).toBe(0.6);
  });

  it('should set cross-modal attention weight', () => {
    manager.setCrossModalAttention('text1', 'visual1', 0.5);
    expect(manager.getCrossModalAttention('text1', 'visual1')).toBe(0.5);
  });

  it('should return 0 for missing attention key', () => {
    expect(manager.getTextAttention('missing')).toBe(0);
    expect(manager.getVisualAttention('missing')).toBe(0);
  });

  it('should get all text attention', () => {
    manager.setTextAttention('key1', 0.5);
    manager.setTextAttention('key2', 0.3);
    const all = manager.getAllTextAttention();
    expect(all.size).toBe(2);
  });

  it('should get all visual attention', () => {
    manager.setVisualAttention('key1', 0.4);
    manager.setVisualAttention('key2', 0.6);
    const all = manager.getAllVisualAttention();
    expect(all.size).toBe(2);
  });

  it('should get confidence', () => {
    manager.updateConfidence(0.9);
    expect(manager.getConfidence()).toBe(0.9);
  });

  it('should get reasoning', () => {
    manager.updateReasoning('test');
    expect(manager.getReasoning()).toBe('test');
  });

  it('should calculate attention entropy', () => {
    manager.setTextAttention('a', 0.5);
    manager.setTextAttention('b', 0.5);
    const entropy = manager.getAttentionEntropy('text');
    expect(entropy).toBeGreaterThan(0);
  });

  it('should normalize attention weights', () => {
    manager.setTextAttention('a', 2);
    manager.setTextAttention('b', 1);
    manager.normalizeAttention('text');
    const a = manager.getTextAttention('a');
    const b = manager.getTextAttention('b');
    expect(a + b).toBeCloseTo(1);
  });

  it('should clear attention', () => {
    manager.setTextAttention('key', 0.5);
    manager.clearAttention();
    expect(manager.getAllTextAttention().size).toBe(0);
  });

  it('should clone state', () => {
    manager.updateConfidence(0.7);
    const clone = manager.clone();
    clone.updateConfidence(0.3);
    expect(manager.getState().confidence).toBe(0.7);
  });

  it('should serialize to JSON', () => {
    manager.updateConfidence(0.8);
    const json = manager.toJSON();
    expect(json.confidence).toBe(0.8);
  });

  it('should deserialize from JSON', () => {
    const data = {
      embedding: new Array(768).fill(0),
      attention: {
        text: { key1: 0.5 },
        visual: {},
        crossModal: {},
      },
      confidence: 0.7,
      reasoning: 'test',
      timestamp: Date.now(),
    };
    const restored = FusedStateManager.fromJSON(data);
    expect(restored.getState().confidence).toBe(0.7);
  });
});

describe('MultiModalStateManager', () => {
  let manager: MultiModalStateManager;

  beforeEach(() => {
    manager = new MultiModalStateManager();
  });

  it('should create default state', () => {
    const state = manager.getState();
    expect(state.id).toBeDefined();
    expect(state.version).toBe(0);
    expect(state.confidence).toBe(0);
  });

  it('should get unique ID', () => {
    const id1 = manager.getId();
    const id2 = new MultiModalStateManager().getId();
    expect(id1).not.toBe(id2);
  });

  it('should get version', () => {
    expect(manager.getVersion()).toBe(0);
  });

  it('should update text state', () => {
    manager.updateTextState(text => {
      text.updateInput('hello');
    });
    expect(manager.getState().text.input).toBe('hello');
  });

  it('should increment version on update', () => {
    const v1 = manager.getVersion();
    manager.updateTextState(text => text.updateInput('test'));
    expect(manager.getVersion()).toBe(v1 + 1);
  });

  it('should update visual state', () => {
    manager.updateVisualState(visual => {
      visual.updateLayout({ type: 'flex', hierarchy: [], spacing: { horizontal: 0, vertical: 0 } });
    });
    expect(manager.getState().visual.layout.type).toBe('flex');
  });

  it('should update embedding state', () => {
    manager.updateEmbeddingState(embedding => {
      embedding.updateVector(new Float32Array(768).fill(0.5));
    });
    expect(manager.getState().embedding.vector[0]).toBe(0.5);
  });

  it('should update fused state', () => {
    manager.updateFusedState(fused => {
      fused.updateConfidence(0.9);
    });
    expect(manager.getState().fused.confidence).toBe(0.9);
  });

  it('should update confidence', () => {
    manager.updateConfidence(0.8);
    expect(manager.getState().confidence).toBe(0.8);
  });

  it('should reject invalid confidence', () => {
    expect(() => manager.updateConfidence(1.5)).toThrow();
  });

  it('should update metadata', () => {
    manager.updateMetadata(metadata => {
      metadata.author = 'test-user';
    });
    expect(manager.getState().metadata.author).toBe('test-user');
  });

  it('should add tag', () => {
    manager.addTag('important');
    expect(manager.getTags()).toContain('important');
  });

  it('should not add duplicate tag', () => {
    manager.addTag('tag');
    manager.addTag('tag');
    expect(manager.getTags().filter(t => t === 'tag')).toHaveLength(1);
  });

  it('should remove tag', () => {
    manager.addTag('tag');
    manager.removeTag('tag');
    expect(manager.getTags()).not.toContain('tag');
  });

  it('should check has tag', () => {
    manager.addTag('tag');
    expect(manager.hasTag('tag')).toBe(true);
    expect(manager.hasTag('missing')).toBe(false);
  });

  it('should set and get property', () => {
    manager.setProperty('key', 'value');
    expect(manager.getProperty('key')).toBe('value');
  });

  it('should apply partial update', () => {
    manager.applyUpdate({
      text: { input: 'updated' },
      confidence: 0.7,
    });
    expect(manager.getState().text.input).toBe('updated');
    expect(manager.getState().confidence).toBe(0.7);
  });

  it('should diff states', () => {
    manager.updateTextState(text => text.updateInput('original'));
    const other = manager.clone();
    other.updateTextState(text => text.updateInput('modified'));

    const diff = manager.diff(other.getState());
    expect(diff.modified).toContain('text.input');
  });

  it('should merge states', () => {
    manager.updateTextState(text => text.updateInput('text1'));
    const other = manager.clone();
    other.updateTextState(text => text.updateInput('text2'));
    other.addTag('tag2');

    manager.merge(other.getState());
    expect(manager.getTags()).toContain('tag2');
  });

  it('should clone state', () => {
    manager.updateTextState(text => text.updateInput('original'));
    const clone = manager.clone();
    clone.updateTextState(text => text.updateInput('cloned'));

    expect(manager.getState().text.input).toBe('original');
    expect(clone.getState().text.input).toBe('cloned');
    expect(clone.getId()).not.toBe(manager.getId());
  });

  it('should register change listener', () => {
    let called = false;
    const unsubscribe = manager.onChange(() => {
      called = true;
    });

    manager.updateTextState(text => text.updateInput('test'));
    expect(called).toBe(true);

    unsubscribe();
  });

  it('should unregister change listener', () => {
    let callCount = 0;
    const unsubscribe = manager.onChange(() => {
      callCount++;
    });

    unsubscribe();
    manager.updateTextState(text => text.updateInput('test'));
    expect(callCount).toBe(0);
  });

  it('should serialize to JSON', () => {
    manager.updateTextState(text => text.updateInput('test'));
    const json = manager.toJSON();
    expect(json.text.input).toBe('test');
  });

  it('should deserialize from JSON', () => {
    const data = {
      id: 'test-id',
      version: 1,
      timestamp: Date.now(),
      modified: Date.now(),
      text: {
        input: 'test',
        intent: '',
        entities: [],
        sentiment: { label: 'neutral', confidence: 0.5, scores: { positive: 0.33, negative: 0.33, neutral: 0.34 } },
        embedding: new Array(768).fill(0),
        timestamp: Date.now(),
      },
      visual: {
        frames: [],
        components: [],
        layout: { type: 'unknown', hierarchy: [], spacing: { horizontal: 0, vertical: 0 } },
        embedding: new Array(768).fill(0),
        timestamp: Date.now(),
      },
      embedding: {
        vector: new Array(768).fill(0),
        textContribution: new Array(768).fill(0),
        visualContribution: new Array(768).fill(0),
        timestamp: Date.now(),
      },
      fused: {
        embedding: new Array(768).fill(0),
        confidence: 0,
        reasoning: '',
        timestamp: Date.now(),
      },
      metadata: {
        id: 'test-id',
        version: 1,
        timestamp: Date.now(),
        author: 'system',
        tags: [],
        properties: {},
      },
      confidence: 0.5,
    };
    const restored = MultiModalStateManager.fromJSON(data);
    expect(restored.getState().text.input).toBe('test');
  });
});

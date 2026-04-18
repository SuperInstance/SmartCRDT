/**
 * Tests for KnowledgeBase - CRDT-based shared knowledge
 */
import { describe, it, expect, vi } from 'vitest';
import { KnowledgeBase } from '../knowledge-base.js';
import { CollabEventType } from '../types.js';

describe('KnowledgeBase', () => {
  it('should contribute a knowledge entry', () => {
    const kb = new KnowledgeBase('agent-1');
    const entry = kb.contribute({
      title: 'Optimization trick',
      content: 'Use memoization for expensive computations',
      category: 'performance',
      createdBy: 'agent-1',
      tags: ['optimization', 'memoization'],
      confidence: 0.9,
    });
    expect(entry.id).toBeDefined();
    expect(entry.title).toBe('Optimization trick');
    expect(entry.category).toBe('performance');
    expect(entry.confidence).toBe(0.9);
  });

  it('should retrieve an entry by ID', () => {
    const kb = new KnowledgeBase('agent-1');
    const entry = kb.contribute({
      title: 'Test entry',
      content: 'Content',
      category: 'test',
      createdBy: 'agent-1',
      tags: [],
      confidence: 0.5,
    });
    const retrieved = kb.getEntry(entry.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.title).toBe('Test entry');
  });

  it('should return null for non-existent entry', () => {
    const kb = new KnowledgeBase('agent-1');
    expect(kb.getEntry('nonexistent')).toBeNull();
  });

  it('should update an existing entry (creator only)', () => {
    const kb = new KnowledgeBase('agent-1');
    const entry = kb.contribute({
      title: 'Original',
      content: 'Original content',
      category: 'test',
      createdBy: 'agent-1',
      tags: [],
      confidence: 0.5,
    });

    const updated = kb.update(entry.id, { title: 'Updated', confidence: 0.8 });
    expect(updated).not.toBeNull();
    expect(updated!.title).toBe('Updated');
    expect(updated!.confidence).toBe(0.8);
    expect(updated!.content).toBe('Original content'); // unchanged
  });

  it('should not allow non-creator to update', () => {
    const kb = new KnowledgeBase('agent-1');
    const entry = kb.contribute({
      title: 'Original',
      content: 'Content',
      category: 'test',
      createdBy: 'agent-1',
      tags: [],
      confidence: 0.5,
    });

    // Import state into a different replica's KnowledgeBase
    const kb2 = new KnowledgeBase('agent-2');
    kb2.importState(kb.exportState());

    // kb2 has replicaId 'agent-2', so it can't update an entry created by 'agent-1'
    const result = kb2.update(entry.id, { title: 'Hacked!' });
    expect(result).toBeNull();
  });

  it('should not update a non-existent entry', () => {
    const kb = new KnowledgeBase('agent-1');
    const result = kb.update('nonexistent', { title: 'Nope' });
    expect(result).toBeNull();
  });

  it('should list all entries', () => {
    const kb = new KnowledgeBase('agent-1');
    kb.contribute({ title: 'Entry 1', content: 'C1', category: 'a', createdBy: 'agent-1', tags: [], confidence: 0.5 });
    kb.contribute({ title: 'Entry 2', content: 'C2', category: 'b', createdBy: 'agent-1', tags: [], confidence: 0.5 });
    expect(kb.getAllEntries().length).toBe(2);
  });

  it('should filter by category', () => {
    const kb = new KnowledgeBase('agent-1');
    kb.contribute({ title: 'Entry 1', content: 'C1', category: 'performance', createdBy: 'agent-1', tags: [], confidence: 0.5 });
    kb.contribute({ title: 'Entry 2', content: 'C2', category: 'security', createdBy: 'agent-1', tags: [], confidence: 0.5 });
    kb.contribute({ title: 'Entry 3', content: 'C3', category: 'performance', createdBy: 'agent-1', tags: [], confidence: 0.5 });
    const perf = kb.getByCategory('performance');
    expect(perf.length).toBe(2);
  });

  it('should filter by tag', () => {
    const kb = new KnowledgeBase('agent-1');
    kb.contribute({ title: 'Entry 1', content: 'C1', category: 'a', createdBy: 'agent-1', tags: ['rust', 'fast'], confidence: 0.5 });
    kb.contribute({ title: 'Entry 2', content: 'C2', category: 'b', createdBy: 'agent-1', tags: ['typescript'], confidence: 0.5 });
    kb.contribute({ title: 'Entry 3', content: 'C3', category: 'c', createdBy: 'agent-1', tags: ['rust', 'safe'], confidence: 0.5 });
    const rustEntries = kb.getByTag('rust');
    expect(rustEntries.length).toBe(2);
  });

  it('should filter by agent', () => {
    const kb = new KnowledgeBase('agent-1');
    kb.contribute({ title: 'E1', content: 'C1', category: 'a', createdBy: 'agent-1', tags: [], confidence: 0.5 });
    kb.contribute({ title: 'E2', content: 'C2', category: 'b', createdBy: 'agent-2', tags: [], confidence: 0.5 });
    kb.contribute({ title: 'E3', content: 'C3', category: 'c', createdBy: 'agent-1', tags: [], confidence: 0.5 });
    expect(kb.getByAgent('agent-1').length).toBe(2);
    expect(kb.getByAgent('agent-2').length).toBe(1);
  });

  it('should search by text', () => {
    const kb = new KnowledgeBase('agent-1');
    kb.contribute({ title: 'Rust optimization', content: 'Use iterators instead of loops', category: 'perf', createdBy: 'agent-1', tags: [], confidence: 0.9 });
    kb.contribute({ title: 'TypeScript patterns', content: 'Use generics for type safety', category: 'patterns', createdBy: 'agent-1', tags: [], confidence: 0.7 });
    kb.contribute({ title: 'Debug tips', content: 'Use logging effectively', category: 'debug', createdBy: 'agent-1', tags: [], confidence: 0.5 });
    const results = kb.search('optimization');
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Rust optimization');
  });

  it('should filter by minimum confidence', () => {
    const kb = new KnowledgeBase('agent-1');
    kb.contribute({ title: 'E1', content: 'C1', category: 'a', createdBy: 'agent-1', tags: [], confidence: 0.3 });
    kb.contribute({ title: 'E2', content: 'C2', category: 'b', createdBy: 'agent-1', tags: [], confidence: 0.7 });
    kb.contribute({ title: 'E3', content: 'C3', category: 'c', createdBy: 'agent-1', tags: [], confidence: 0.9 });
    const high = kb.getByConfidence(0.7);
    expect(high.length).toBe(2);
  });

  it('should get all categories', () => {
    const kb = new KnowledgeBase('agent-1');
    kb.contribute({ title: 'E1', content: 'C1', category: 'perf', createdBy: 'agent-1', tags: [], confidence: 0.5 });
    kb.contribute({ title: 'E2', content: 'C2', category: 'security', createdBy: 'agent-1', tags: [], confidence: 0.5 });
    const cats = kb.getCategories();
    expect(cats).toContain('perf');
    expect(cats).toContain('security');
  });

  it('should get all tags', () => {
    const kb = new KnowledgeBase('agent-1');
    kb.contribute({ title: 'E1', content: 'C1', category: 'a', createdBy: 'agent-1', tags: ['rust', 'fast'], confidence: 0.5 });
    kb.contribute({ title: 'E2', content: 'C2', category: 'b', createdBy: 'agent-1', tags: ['ts', 'fast'], confidence: 0.5 });
    const tags = kb.getAllTags();
    expect(tags).toContain('rust');
    expect(tags).toContain('ts');
    expect(tags).toContain('fast');
  });

  it('should report size correctly', () => {
    const kb = new KnowledgeBase('agent-1');
    expect(kb.size()).toBe(0);
    kb.contribute({ title: 'E1', content: 'C1', category: 'a', createdBy: 'agent-1', tags: [], confidence: 0.5 });
    kb.contribute({ title: 'E2', content: 'C2', category: 'b', createdBy: 'agent-1', tags: [], confidence: 0.5 });
    expect(kb.size()).toBe(2);
  });

  it('should emit events on contribute and update', () => {
    const kb = new KnowledgeBase('agent-1');
    const listener = vi.fn();
    kb.on(listener);
    const entry = kb.contribute({ title: 'E1', content: 'C', category: 'a', createdBy: 'agent-1', tags: [], confidence: 0.5 });
    kb.update(entry.id, { title: 'E1 updated' });
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[0][0].type).toBe(CollabEventType.KNOWLEDGE_CONTRIBUTED);
    expect(listener.mock.calls[1][0].type).toBe(CollabEventType.KNOWLEDGE_UPDATED);
  });

  it('should merge two knowledge bases', () => {
    const kb1 = new KnowledgeBase('agent-1');
    const kb2 = new KnowledgeBase('agent-2');

    const e1 = kb1.contribute({ title: 'Finding 1', content: 'From agent-1', category: 'a', createdBy: 'agent-1', tags: [], confidence: 0.8 });
    const e2 = kb2.contribute({ title: 'Finding 2', content: 'From agent-2', category: 'b', createdBy: 'agent-2', tags: [], confidence: 0.9 });

    kb1.merge(kb2);
    expect(kb1.getEntry(e1.id)).not.toBeNull();
    expect(kb1.getEntry(e2.id)).not.toBeNull();
    expect(kb1.size()).toBe(2);
  });

  it('should export and import state', () => {
    const kb = new KnowledgeBase('agent-1');
    kb.contribute({ title: 'E1', content: 'C', category: 'a', createdBy: 'agent-1', tags: ['tag1'], confidence: 0.7 });
    const state = kb.exportState();

    const kb2 = new KnowledgeBase('agent-2');
    kb2.importState(state);
    expect(kb2.size()).toBe(1);
  });
});

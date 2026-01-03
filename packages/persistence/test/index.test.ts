import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SQLitePersistence } from '../src/database/SQLitePersistence';
import { VectorUtils } from '../src/utils/VectorUtils';
import { DatabaseError, EntryNotFoundError } from '../src/utils/DatabaseError';

describe('SQLitePersistence Integration Tests', () => {
  let persistence: SQLitePersistence;

  beforeAll(async () => {
    persistence = new SQLitePersistence({
      dbPath: ':memory:',
      enableVectorSearch: false
    });
    await persistence.initialize();
  });

  afterAll(async () => {
    await persistence.close();
  });

  it('should save and retrieve an entry', async () => {
    const entry = {
      id: 'test-entry-1',
      content: 'Test content for persistence',
      embedding: VectorUtils.generateRandomVector(1536),
      domain: 'test',
      source: 'test-source',
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    await expect(persistence.saveEntry(entry)).resolves.not.toThrow();

    const retrieved = await persistence.getEntry('test-entry-1');
    expect(retrieved).toBeTruthy();
    expect(retrieved!.id).toBe('test-entry-1');
    expect(retrieved!.content).toBe('Test content for persistence');
    expect(retrieved!.embedding).toEqual(entry.embedding);
  });

  it('should update an entry', async () => {
    const entry = {
      id: 'test-entry-2',
      content: 'Original content',
      embedding: VectorUtils.generateRandomVector(1536),
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    await persistence.saveEntry(entry);

    await expect(
      persistence.updateEntry('test-entry-2', { content: 'Updated content' })
    ).resolves.not.toThrow();

    const updated = await persistence.getEntry('test-entry-2');
    expect(updated!.content).toBe('Updated content');
  });

  it('should delete an entry', async () => {
    const entry = {
      id: 'test-entry-3',
      content: 'Content to delete',
      embedding: VectorUtils.generateRandomVector(1536),
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    await persistence.saveEntry(entry);
    expect(await persistence.getEntry('test-entry-3')).toBeTruthy();

    await expect(persistence.deleteEntry('test-entry-3')).resolves.not.toThrow();
    expect(await persistence.getEntry('test-entry-3')).toBeNull();
  });

  it('should handle non-existent entries gracefully', async () => {
    await expect(persistence.getEntry('non-existent')).resolves.toBeNull();
    await expect(persistence.deleteEntry('non-existent')).rejects.toThrow(EntryNotFoundError);
  });

  it('should search for similar entries', async () => {
    const embedding = VectorUtils.generateRandomVector(1536);

    // Create entries with similar embeddings
    const entry1 = {
      id: 'similar-1',
      content: 'Similar content 1',
      embedding: new Float32Array(embedding),
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    const entry2 = {
      id: 'similar-2',
      content: 'Similar content 2',
      embedding: new Float32Array(embedding),
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    const entry3 = {
      id: 'different-1',
      content: 'Different content',
      embedding: VectorUtils.generateRandomVector(1536),
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    await persistence.saveEntry(entry1);
    await persistence.saveEntry(entry2);
    await persistence.saveEntry(entry3);

    const results = await persistence.searchSimilar(embedding, 10, 0.0);
    expect(results.length).toBe(2);
    expect(results[0].id).toBe('similar-1' || 'similar-2');
    expect(results[0].similarity).toBeGreaterThan(0.9);
  });

  it('should count entries correctly', async () => {
    expect(await persistence.countEntries()).toBeGreaterThan(0);

    await persistence.clearAll();
    expect(await persistence.countEntries()).toBe(0);
  });
});
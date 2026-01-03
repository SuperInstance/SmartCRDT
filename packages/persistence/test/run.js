const { test, expect, beforeAll, afterAll } = require('vitest');

// Import the modules we want to test
const { SQLitePersistence } = require('../src/database/SQLitePersistence');
const { VectorUtils } = require('../src/utils/VectorUtils');
const { DatabaseError, EntryNotFoundError } = require('../src/utils/DatabaseError');

describe('SQLitePersistence Integration Tests', () => {
  let persistence;

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

  test('should save and retrieve an entry', async () => {
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
    expect(retrieved.id).toBe('test-entry-1');
    expect(retrieved.content).toBe('Test content for persistence');
    expect(retrieved.embedding).toEqual(entry.embedding);
  });

  test('should update an entry', async () => {
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
    expect(updated.content).toBe('Updated content');
  });

  test('should delete an entry', async () => {
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

  test('should handle non-existent entries gracefully', async () => {
    await expect(persistence.getEntry('non-existent')).resolves.toBeNull();
    await expect(persistence.deleteEntry('non-existent')).rejects.toThrow(EntryNotFoundError);
  });

  test('should count entries correctly', async () => {
    expect(await persistence.countEntries()).toBeGreaterThan(0);

    await persistence.clearAll();
    expect(await persistence.countEntries()).toBe(0);
  });
});

describe('VectorUtils Tests', () => {
  test('should calculate dot product correctly', () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([4, 5, 6]);

    const result = VectorUtils.dotProduct(a, b);
    expect(result).toBe(32); // 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
  });

  test('should calculate cosine similarity for identical vectors', () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array(a);

    const result = VectorUtils.cosineSimilarity(a, b);
    expect(result).toBeCloseTo(1.0, 6);
  });

  test('should convert vector to buffer and back correctly', () => {
    const original = new Float32Array([1.1, 2.2, 3.3, -4.4]);
    const buffer = VectorUtils.vectorToBuffer(original);
    const converted = VectorUtils.bufferToVector(buffer);

    expect(converted).toEqual(original);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  test('should generate random vector with correct dimensions', () => {
    const dimensions = 100;
    const vector = VectorUtils.generateRandomVector(dimensions);

    expect(vector instanceof Float32Array).toBe(true);
    expect(vector.length).toBe(dimensions);
  });
});
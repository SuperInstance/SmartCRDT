import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { open } from 'better-sqlite3';
import { SQLitePersistence } from './SQLitePersistence';
import { VectorUtils } from '../utils/VectorUtils';
import { DatabaseError, EntryNotFoundError } from '../utils/DatabaseError';
import fs from 'fs';
import path from 'path';

describe('SQLitePersistence', () => {
  let persistence: SQLitePersistence;
  let testDbPath: string;

  beforeEach(() => {
    testDbPath = path.join(__dirname, 'test.db');
    persistence = new SQLitePersistence({ dbPath: testDbPath });
  });

  afterEach(async () => {
    await persistence.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('initialization', () => {
    it('should initialize database successfully', async () => {
      await expect(persistence.initialize()).resolves.not.toThrow();
    });

    it('should throw error when database path is invalid', async () => {
      const invalidPersistence = new SQLitePersistence({ dbPath: '/invalid/path/db.db' });
      await expect(invalidPersistence.initialize()).rejects.toThrow(DatabaseError);
    });
  });

  describe('saveEntry', () => {
    beforeEach(async () => {
      await persistence.initialize();
    });

    it('should save an entry successfully', async () => {
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
    });

    it('should update existing entry', async () => {
      const entry = {
        id: 'test-entry-1',
        content: 'Original content',
        embedding: VectorUtils.generateRandomVector(1536),
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      await persistence.saveEntry(entry);

      const updatedEntry = {
        ...entry,
        content: 'Updated content',
        embedding: VectorUtils.generateRandomVector(1536),
        updated_at: Date.now(),
      };

      await expect(persistence.saveEntry(updatedEntry)).resolves.not.toThrow();
    });

    it('should throw error for invalid embedding', async () => {
      const entry = {
        id: 'test-entry-1',
        content: 'Test content',
        embedding: new Float32Array(100), // Wrong dimensions
      };

      await expect(persistence.saveEntry(entry)).rejects.toThrow(DatabaseError);
    });
  });

  describe('getEntry', () => {
    beforeEach(async () => {
      await persistence.initialize();
    });

    it('should retrieve saved entry', async () => {
      const originalEntry = {
        id: 'test-entry-1',
        content: 'Test content',
        embedding: VectorUtils.generateRandomVector(1536),
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      await persistence.saveEntry(originalEntry);

      const retrievedEntry = await persistence.getEntry('test-entry-1');

      expect(retrievedEntry).toBeTruthy();
      expect(retrievedEntry!.id).toBe('test-entry-1');
      expect(retrievedEntry!.content).toBe('Test content');
      expect(retrievedEntry!.embedding).toEqual(originalEntry.embedding);
    });

    it('should return null for non-existent entry', async () => {
      const retrievedEntry = await persistence.getEntry('non-existent');
      expect(retrievedEntry).toBeNull();
    });
  });

  describe('updateEntry', () => {
    beforeEach(async () => {
      await persistence.initialize();
    });

    it('should update existing entry', async () => {
      const originalEntry = {
        id: 'test-entry-1',
        content: 'Original content',
        embedding: VectorUtils.generateRandomVector(1536),
        domain: 'test',
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      await persistence.saveEntry(originalEntry);

      await expect(
        persistence.updateEntry('test-entry-1', { content: 'Updated content' })
      ).resolves.not.toThrow();

      const updatedEntry = await persistence.getEntry('test-entry-1');
      expect(updatedEntry!.content).toBe('Updated content');
    });

    it('should throw error for non-existent entry', async () => {
      await expect(
        persistence.updateEntry('non-existent', { content: 'Updated content' })
      ).rejects.toThrow(EntryNotFoundError);
    });

    it('should update timestamp when updating entry', async () => {
      const originalEntry = {
        id: 'test-entry-1',
        content: 'Original content',
        embedding: VectorUtils.generateRandomVector(1536),
        created_at: Date.now() - 1000,
        updated_at: Date.now() - 1000,
      };

      await persistence.saveEntry(originalEntry);

      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamp
      await persistence.updateEntry('test-entry-1', { content: 'Updated content' });

      const updatedEntry = await persistence.getEntry('test-entry-1');
      expect(updatedEntry!.updated_at).toBeGreaterThan(originalEntry.updated_at);
    });
  });

  describe('deleteEntry', () => {
    beforeEach(async () => {
      await persistence.initialize();
    });

    it('should delete existing entry', async () => {
      const entry = {
        id: 'test-entry-1',
        content: 'Test content',
        embedding: VectorUtils.generateRandomVector(1536),
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      await persistence.saveEntry(entry);
      await expect(persistence.deleteEntry('test-entry-1')).resolves.not.toThrow();

      const deletedEntry = await persistence.getEntry('test-entry-1');
      expect(deletedEntry).toBeNull();
    });

    it('should throw error for non-existent entry', async () => {
      await expect(persistence.deleteEntry('non-existent')).rejects.toThrow(EntryNotFoundError);
    });
  });

  describe('searchSimilar', () => {
    beforeEach(async () => {
      await persistence.initialize();
    });

    it('should find similar entries', async () => {
      const similarEmbedding = VectorUtils.generateRandomVector(1536);
      const exactEmbedding = new Float32Array(similarEmbedding);

      // Create entries with similar embeddings
      const entry1 = {
        id: 'entry1',
        content: 'Similar content',
        embedding: similarEmbedding,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      const entry2 = {
        id: 'entry2',
        content: 'Different content',
        embedding: VectorUtils.generateRandomVector(1536),
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      await persistence.saveEntry(entry1);
      await persistence.saveEntry(entry2);

      const results = await persistence.searchSimilar(exactEmbedding, 10, 0.0);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('entry1');
      expect(results[0].similarity).toBeGreaterThan(0.9);
    });

    it('should respect similarity threshold', async () => {
      const embedding1 = VectorUtils.generateRandomVector(1536);
      const embedding2 = VectorUtils.generateRandomVector(1536);

      const entry1 = {
        id: 'entry1',
        content: 'Test content',
        embedding: embedding1,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      await persistence.saveEntry(entry1);

      // Search with high threshold that won't match
      const results = await persistence.searchSimilar(embedding2, 10, 0.99);
      expect(results.length).toBe(0);

      // Search with low threshold that will match
      const lowThresholdResults = await persistence.searchSimilar(embedding1, 10, 0.0);
      expect(lowThresholdResults.length).toBeGreaterThan(0);
    });

    it('should respect result limit', async () => {
      const embedding = VectorUtils.generateRandomVector(1536);

      // Create 5 entries
      for (let i = 0; i < 5; i++) {
        const entry = {
          id: `entry${i}`,
          content: `Content ${i}`,
          embedding: new Float32Array(embedding),
          created_at: Date.now(),
          updated_at: Date.now(),
        };
        await persistence.saveEntry(entry);
      }

      const results = await persistence.searchSimilar(embedding, 3, 0.0);
      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  describe('utility methods', () => {
    beforeEach(async () => {
      await persistence.initialize();
    });

    it('should count entries correctly', async () => {
      expect(await persistence.countEntries()).toBe(0);

      const entry = {
        id: 'test-entry-1',
        content: 'Test content',
        embedding: VectorUtils.generateRandomVector(1536),
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      await persistence.saveEntry(entry);
      expect(await persistence.countEntries()).toBe(1);

      await persistence.deleteEntry('test-entry-1');
      expect(await persistence.countEntries()).toBe(0);
    });

    it('should clear all entries', async () => {
      for (let i = 0; i < 5; i++) {
        const entry = {
          id: `entry${i}`,
          content: `Content ${i}`,
          embedding: VectorUtils.generateRandomVector(1536),
          created_at: Date.now(),
          updated_at: Date.now(),
        };
        await persistence.saveEntry(entry);
      }

      expect(await persistence.countEntries()).toBe(5);
      await persistence.clearAll();
      expect(await persistence.countEntries()).toBe(0);
    });
  });

  describe('transaction support', () => {
    beforeEach(async () => {
      await persistence.initialize();
    });

    it('should maintain data consistency during multiple operations', async () => {
      const entries = Array.from({ length: 10 }, (_, i) => ({
        id: `entry${i}`,
        content: `Content ${i}`,
        embedding: VectorUtils.generateRandomVector(1536),
        created_at: Date.now(),
        updated_at: Date.now(),
      }));

      // Save all entries
      for (const entry of entries) {
        await persistence.saveEntry(entry);
      }

      // Verify all entries are saved
      expect(await persistence.countEntries()).toBe(10);

      // Update first 5 entries
      for (let i = 0; i < 5; i++) {
        await persistence.updateEntry(`entry${i}`, {
          content: `Updated content ${i}`,
          embedding: VectorUtils.generateRandomVector(1536),
        });
      }

      // Delete last 2 entries
      await persistence.deleteEntry('entry8');
      await persistence.deleteEntry('entry9');

      // Verify final count
      expect(await persistence.countEntries()).toBe(8);
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      await persistence.initialize();

      // Create an entry with invalid data to test error handling
      const invalidEntry = {
        id: '',
        content: '',
        embedding: new Float32Array(0),
      };

      await expect(persistence.saveEntry(invalidEntry as any)).rejects.toThrow(DatabaseError);
    });
  });
});
import { open, Database, RunResult } from 'better-sqlite3';
import { KnowledgeEntry, SearchResult } from '../types/KnowledgeEntry';
import { VectorUtils } from '../utils/VectorUtils';
import { DatabaseError, EntryNotFoundError } from '../utils/DatabaseError';
import { DatabaseMigrations } from './DatabaseMigrations';
import type { VectorSearchResult } from '@lsi/protocol';

export interface PersistenceOptions {
  dbPath?: string;
  enableVectorSearch?: boolean;
  embeddingDimensions?: number;
}

export class SQLitePersistence {
  private db: Database;
  private options: Required<PersistenceOptions>;
  private migrations: DatabaseMigrations;
  private embeddingDimensions: number;

  constructor(options: PersistenceOptions = {}) {
    this.options = {
      dbPath: options.dbPath || ':memory:',
      enableVectorSearch: options.enableVectorSearch ?? false,
      embeddingDimensions: options.embeddingDimensions ?? 1536,
    };
    this.embeddingDimensions = this.options.embeddingDimensions;

    try {
      this.db = open(this.options.dbPath);
      this.migrations = new DatabaseMigrations(this.options.dbPath);
    } catch (error) {
      throw new DatabaseError('Failed to initialize database', 'INIT_ERROR', error as Error);
    }
  }

  async initialize(): Promise<void> {
    try {
      await this.migrations.runMigrations();
      console.log(`Database initialized at ${this.options.dbPath}`);
    } catch (error) {
      throw new DatabaseError('Failed to initialize database', 'INIT_ERROR', error as Error);
    }
  }

  async saveEntry(entry: KnowledgeEntry): Promise<void> {
    const now = Date.now();
    const updatedAt = entry.updated_at || now;

    try {
      const insert = this.db.prepare(`
        INSERT OR REPLACE INTO entries (
          id, content, embedding, domain, source, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const buffer = VectorUtils.vectorToBuffer(entry.embedding);
      insert.run(
        entry.id,
        entry.content,
        buffer,
        entry.domain,
        entry.source,
        entry.created_at || now,
        updatedAt
      );

      // Update vector search index if enabled
      if (this.options.enableVectorSearch) {
        await this.updateVectorIndex(entry);
      }
    } catch (error) {
      throw new DatabaseError(`Failed to save entry ${entry.id}`, 'SAVE_ERROR', error as Error);
    }
  }

  async getEntry(id: string): Promise<KnowledgeEntry | null> {
    try {
      const query = this.db.prepare('SELECT * FROM entries WHERE id = ?');
      const row = query.get(id) as any;

      if (!row) {
        return null;
      }

      return this.mapRowToEntry(row);
    } catch (error) {
      throw new DatabaseError(`Failed to get entry ${id}`, 'GET_ERROR', error as Error);
    }
  }

  async getAllEntries(): Promise<KnowledgeEntry[]> {
    try {
      const query = this.db.prepare('SELECT * FROM entries ORDER BY created_at DESC');
      const rows = query.all() as any[];
      return rows.map(this.mapRowToEntry);
    } catch (error) {
      throw new DatabaseError('Failed to get all entries', 'GET_ALL_ERROR', error as Error);
    }
  }

  async updateEntry(id: string, updates: Partial<KnowledgeEntry>): Promise<void> {
    const now = Date.now();

    try {
      const updatesArray: any[] = [];
      const values: any[] = [];

      // Build dynamic update query
      if (updates.content) {
        updatesArray.push('content = ?');
        values.push(updates.content);
      }

      if (updates.embedding) {
        const buffer = VectorUtils.vectorToBuffer(updates.embedding);
        updatesArray.push('embedding = ?');
        values.push(buffer);
      }

      if (updates.domain !== undefined) {
        updatesArray.push('domain = ?');
        values.push(updates.domain);
      }

      if (updates.source !== undefined) {
        updatesArray.push('source = ?');
        values.push(updates.source);
      }

      if (updatesArray.length === 0) {
        return; // No updates to perform
      }

      // Add id and timestamp
      values.push(id, now);

      const update = this.db.prepare(`
        UPDATE entries
        SET ${updatesArray.join(', ')}, updated_at = ?
        WHERE id = ?
      `);

      const result = update.run(...values) as RunResult;

      if (result.changes === 0) {
        throw new EntryNotFoundError(id);
      }

      // Update vector search index if enabled
      if (this.options.enableVectorSearch) {
        const updatedEntry = await this.getEntry(id);
        if (updatedEntry) {
          await this.updateVectorIndex(updatedEntry);
        }
      }
    } catch (error) {
      if (error instanceof EntryNotFoundError) {
        throw error;
      }
      throw new DatabaseError(`Failed to update entry ${id}`, 'UPDATE_ERROR', error as Error);
    }
  }

  async deleteEntry(id: string): Promise<void> {
    try {
      const deleteStmt = this.db.prepare('DELETE FROM entries WHERE id = ?');
      const result = deleteStmt.run(id) as RunResult;

      if (result.changes === 0) {
        throw new EntryNotFoundError(id);
      }

      // Delete from vector search index if enabled
      if (this.options.enableVectorSearch) {
        this.db.prepare('DELETE FROM entries_vec WHERE id = ?').run(id);
      }
    } catch (error) {
      if (error instanceof EntryNotFoundError) {
        throw error;
      }
      throw new DatabaseError(`Failed to delete entry ${id}`, 'DELETE_ERROR', error as Error);
    }
  }

  async searchSimilar(embedding: Float32Array, limit: number = 10, threshold: number = 0.5): Promise<SearchResult[]> {
    VectorUtils.validateDimensions(embedding, this.embeddingDimensions);

    try {
      if (!this.options.enableVectorSearch) {
        // Fall back to brute-force cosine similarity search
        return await this.bruteForceSearch(embedding, limit, threshold);
      }

      // Try vector extension first
      try {
        return await this.vectorSearch(embedding, limit, threshold);
      } catch (error) {
        console.warn('Vector search failed, falling back to brute force:', error);
        return await this.bruteForceSearch(embedding, limit, threshold);
      }
    } catch (error) {
      throw new DatabaseError('Failed to perform similarity search', 'SEARCH_ERROR', error as Error);
    }
  }

  private async bruteForceSearch(embedding: Float32Array, limit: number, threshold: number): Promise<SearchResult[]> {
    const query = this.db.prepare('SELECT * FROM entries');
    const entries = query.all() as any[];

    const results = entries
      .map(row => {
        const entry = this.mapRowToEntry(row);
        const similarity = VectorUtils.cosineSimilarity(embedding, entry.embedding);
        return { entry, similarity };
      })
      .filter(({ similarity }) => similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(({ entry, similarity }) => ({
        id: entry.id,
        content: entry.content,
        domain: entry.domain,
        source: entry.source,
        similarity,
        created_at: entry.created_at,
      }));

    return results;
  }

  private async vectorSearch(embedding: Float32Array, limit: number, threshold: number): Promise<SearchResult[]> {
    const buffer = VectorUtils.vectorToBuffer(embedding);

    const query = this.db.prepare(`
      SELECT e.id, e.content, e.domain, e.source, e.created_at, ev.distance as similarity
      FROM entries e
      JOIN entries_vec ev ON e.id = ev.id
      WHERE ev.distance >= ?
      ORDER BY ev.distance
      LIMIT ?
    `);

    const rows = query.all(1 - threshold, limit) as any[];

    return rows.map(row => ({
      id: row.id,
      content: row.content,
      domain: row.domain,
      source: row.source,
      similarity: row.similarity,
      created_at: row.created_at,
    }));
  }

  private async updateVectorIndex(entry: KnowledgeEntry): Promise<void> {
    try {
      // Delete existing entry if it exists
      this.db.prepare('DELETE FROM entries_vec WHERE id = ?').run(entry.id);

      // Insert new vector
      const insert = this.db.prepare(`
        INSERT INTO entries_vec (id, dimensions, vector)
        VALUES (?, ?, ?)
      `);

      const buffer = VectorUtils.vectorToBuffer(entry.embedding);
      insert.run(entry.id, this.embeddingDimensions, buffer);
    } catch (error) {
      console.warn('Failed to update vector index:', error);
    }
  }

  private mapRowToEntry(row: any): KnowledgeEntry {
    return {
      id: row.id,
      content: row.content,
      embedding: VectorUtils.bufferToVector(row.embedding),
      domain: row.domain,
      source: row.source,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async countEntries(): Promise<number> {
    try {
      const query = this.db.prepare('SELECT COUNT(*) as count FROM entries');
      const result = query.get() as { count: number };
      return result.count;
    } catch (error) {
      throw new DatabaseError('Failed to count entries', 'COUNT_ERROR', error as Error);
    }
  }

  async clearAll(): Promise<void> {
    try {
      this.db.exec('DELETE FROM entries');
      if (this.options.enableVectorSearch) {
        this.db.exec('DELETE FROM entries_vec');
      }
    } catch (error) {
      throw new DatabaseError('Failed to clear all entries', 'CLEAR_ERROR', error as Error);
    }
  }

  close(): void {
    try {
      this.db.close();
      this.migrations.close();
    } catch (error) {
      throw new DatabaseError('Failed to close database', 'CLOSE_ERROR', error as Error);
    }
  }
}
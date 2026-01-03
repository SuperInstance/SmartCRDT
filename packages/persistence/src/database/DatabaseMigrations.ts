import { open, Database } from 'better-sqlite3';
import { DatabaseError } from '../utils/DatabaseError';

export interface Migration {
  version: number;
  up: (db: Database) => void;
  down?: (db: Database) => void;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up: (db) => {
      // Enable Write-Ahead Logging for better performance
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
      db.pragma('cache_size = 10000');

      // Create entries table
      db.exec(`
        CREATE TABLE IF NOT EXISTS entries (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          embedding BLOB NOT NULL,
          domain TEXT,
          source TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          UNIQUE(id)
        );
      `);

      // Create indexes for better performance
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_entries_domain ON entries(domain);
        CREATE INDEX IF NOT EXISTS idx_entries_source ON entries(source);
        CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at);
      `);
    },
    down: (db) => {
      db.exec('DROP TABLE IF EXISTS entries;');
    }
  },
  {
    version: 2,
    up: (db) => {
      // Add vector search virtual table (requires sqlite-vss extension)
      try {
        db.exec(`
          CREATE VIRTUAL TABLE IF NOT EXISTS entries_vec
          USING vectorsim(
            id,
            dimensions=1536,
            distance_metric=cosine
          );
        `);
      } catch (error) {
        // If vectorsim is not available, log a warning but continue
        console.warn('SQLite vector extension not found. Vector search will not be available.');
      }

      // Add metadata table for tracking
      db.exec(`
        CREATE TABLE IF NOT EXISTS metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);

      // Insert initial metadata
      const insert = db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)');
      insert.run('schema_version', '2');
    },
    down: (db) => {
      db.exec('DROP TABLE IF EXISTS metadata;');
    }
  }
];

export class DatabaseMigrations {
  private db: Database;

  constructor(dbPath: string) {
    try {
      this.db = open(dbPath);
    } catch (error) {
      throw new DatabaseError('Failed to open database', 'DB_OPEN_ERROR', error as Error);
    }
  }

  async runMigrations(): Promise<void> {
    let currentVersion = 0;

    // Get current schema version
    const getVersionStmt = this.db.prepare('SELECT value FROM metadata WHERE key = ?');
    const versionResult = getVersionStmt.get('schema_version') as { value: string };

    if (versionResult) {
      currentVersion = parseInt(versionResult.value, 10);
    }

    // Run migrations if needed
    for (const migration of MIGRATIONS) {
      if (migration.version > currentVersion) {
        try {
          console.log(`Running migration ${migration.version}...`);
          migration.up(this.db);

          // Update version
          const updateVersion = this.db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)');
          updateVersion.run('schema_version', migration.version.toString());

          console.log(`Migration ${migration.version} completed successfully`);
        } catch (error) {
          throw new DatabaseError(
            `Failed to run migration ${migration.version}`,
            'MIGRATION_ERROR',
            error as Error
          );
        }
      }
    }
  }

  close(): void {
    this.db.close();
  }
}
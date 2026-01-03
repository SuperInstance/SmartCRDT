import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseMigrations } from './DatabaseMigrations';
import { open } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

describe('DatabaseMigrations', () => {
  let testDbPath: string;
  let migrations: DatabaseMigrations;

  beforeEach(() => {
    testDbPath = path.join(__dirname, 'test-migrations.db');
    migrations = new DatabaseMigrations(testDbPath);
  });

  afterEach(() => {
    migrations.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('migration initialization', () => {
    it('should create database with initial migrations', async () => {
      await migrations.runMigrations();

      const db = open(testDbPath);
      const entriesTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='entries'");
      const metadataTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='metadata'");

      expect(entriesTable.get()).toBeTruthy();
      expect(metadataTable.get()).toBeTruthy();

      // Check version
      const versionResult = db.prepare('SELECT value FROM metadata WHERE key = ?').get('schema_version');
      expect(versionResult.value).toBe('2');

      db.close();
    });

    it('should run incremental migrations', async () => {
      // Create database with version 0
      const db = open(testDbPath);
      db.exec('CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
      db.prepare('INSERT INTO metadata (key, value) VALUES (?, ?)').run('schema_version', '0');
      db.close();

      await migrations.runMigrations();

      const checkDb = open(testDbPath);
      const versionResult = checkDb.prepare('SELECT value FROM metadata WHERE key = ?').get('schema_version');
      expect(versionResult.value).toBe('2');

      checkDb.close();
    });

    it('should skip already applied migrations', async () => {
      // Create database with version 1
      const db = open(testDbPath);
      db.exec('CREATE TABLE entries (id TEXT PRIMARY KEY, content TEXT NOT NULL, embedding BLOB NOT NULL)');
      db.prepare('INSERT INTO metadata (key, value) VALUES (?, ?)').run('schema_version', '1');
      db.close();

      await migrations.runMigrations();

      const checkDb = open(testDbPath);
      const versionResult = checkDb.prepare('SELECT value FROM metadata WHERE key = ?').get('schema_version');
      expect(versionResult.value).toBe('2');

      checkDb.close();
    });
  });

  describe('error handling', () => {
    it('should throw error when database path is invalid', () => {
      const invalidMigrations = new DatabaseMigrations('/invalid/path/db.db');
      expect(() => invalidMigrations.runMigrations()).toThrow();
    });

    it('should handle migration failures gracefully', async () => {
      // Corrupt the database to cause migration failure
      const db = open(testDbPath);
      db.exec('CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
      db.prepare('INSERT INTO metadata (key, value) VALUES (?, ?)').run('schema_version', '0');
      db.exec('CREATE TABLE entries (id TEXT PRIMARY KEY);'); // Invalid schema to cause issues
      db.close();

      // This should throw an error due to the invalid schema
      await expect(migrations.runMigrations()).rejects.toThrow();
    });
  });
});
/**
 * @lsi/langgraph-state - State Persistence
 *
 * In-memory, file, and database persistence backends for state management.
 */

import type {
  StateScope,
  StateSnapshot,
  StateVersion,
  PersistenceStrategy,
  SerializationOptions,
  DeserializationOptions,
} from "./types.js";
import { generateChecksum, calculateStateSize } from "./types.js";
import { promises as fs } from "fs";
import { join } from "path";

/**
 * Persisted state data
 */
export interface PersistedState {
  scope: StateScope;
  state: Record<string, unknown>;
  version: StateVersion;
  timestamp: Date;
  checksum: string;
  metadata?: Record<string, unknown>;
}

/**
 * Persistence backend interface
 */
export interface StatePersistenceBackend {
  /**
   * Save state for a scope
   */
  save(scope: StateScope, data: PersistedState): Promise<void>;

  /**
   * Load state for a scope
   */
  load(scope: StateScope): Promise<PersistedState | null>;

  /**
   * Delete state for a scope
   */
  delete(scope: StateScope): Promise<void>;

  /**
   * Save snapshot
   */
  saveSnapshot<T>(snapshot: StateSnapshot<T>): Promise<void>;

  /**
   * Load snapshot
   */
  loadSnapshot<T>(snapshotId: string): Promise<StateSnapshot<T> | null>;

  /**
   * List all snapshots
   */
  listSnapshots(): Promise<StateSnapshot[]>;

  /**
   * Delete snapshot
   */
  deleteSnapshot(snapshotId: string): Promise<void>;

  /**
   * Save branch state
   */
  saveBranchState(branchId: string, state: unknown): Promise<void>;

  /**
   * Load branch state
   */
  loadBranchState(branchId: string): Promise<unknown>;

  /**
   * List all branches
   */
  listBranches(): Promise<string[]>;

  /**
   * Delete branch
   */
  deleteBranch(branchId: string): Promise<void>;

  /**
   * Clear all persisted data
   */
  clear(): Promise<void>;

  /**
   * Close connection and cleanup
   */
  close(): Promise<void>;
}

/**
 * In-memory persistence (default, for testing)
 */
export class MemoryPersistence implements StatePersistenceBackend {
  private states: Map<StateScope, PersistedState>;
  private snapshots: Map<string, StateSnapshot>;
  private branchStates: Map<string, unknown>;

  constructor() {
    this.states = new Map();
    this.snapshots = new Map();
    this.branchStates = new Map();
  }

  public async save(scope: StateScope, data: PersistedState): Promise<void> {
    this.states.set(scope, data);
  }

  public async load(scope: StateScope): Promise<PersistedState | null> {
    return this.states.get(scope) || null;
  }

  public async delete(scope: StateScope): Promise<void> {
    this.states.delete(scope);
  }

  public async saveSnapshot<T>(snapshot: StateSnapshot<T>): Promise<void> {
    this.snapshots.set(snapshot.id, snapshot);
  }

  public async loadSnapshot<T>(
    snapshotId: string
  ): Promise<StateSnapshot<T> | null> {
    return (this.snapshots.get(snapshotId) as StateSnapshot<T>) || null;
  }

  public async listSnapshots(): Promise<StateSnapshot[]> {
    return Array.from(this.snapshots.values());
  }

  public async deleteSnapshot(snapshotId: string): Promise<void> {
    this.snapshots.delete(snapshotId);
  }

  public async saveBranchState(
    branchId: string,
    state: unknown
  ): Promise<void> {
    this.branchStates.set(branchId, state);
  }

  public async loadBranchState(branchId: string): Promise<unknown> {
    return this.branchStates.get(branchId);
  }

  public async listBranches(): Promise<string[]> {
    return Array.from(this.branchStates.keys());
  }

  public async deleteBranch(branchId: string): Promise<void> {
    this.branchStates.delete(branchId);
  }

  public async clear(): Promise<void> {
    this.states.clear();
    this.snapshots.clear();
    this.branchStates.clear();
  }

  public async close(): Promise<void> {
    this.states.clear();
    this.snapshots.clear();
    this.branchStates.clear();
  }
}

/**
 * File-based persistence
 */
export class FilePersistence implements StatePersistenceBackend {
  private basePath: string;
  private encoder: TextEncoder;
  private decoder: TextDecoder;

  constructor(config: { basePath: string }) {
    this.basePath = config.basePath;
    this.encoder = new TextEncoder();
    this.decoder = new TextDecoder();

    // Ensure base directory exists
    fs.mkdir(this.basePath, { recursive: true }).catch(() => {});
  }

  private getScopePath(scope: StateScope): string {
    return join(this.basePath, `${scope}.json`);
  }

  private getSnapshotPath(snapshotId: string): string {
    return join(this.basePath, "snapshots", `${snapshotId}.json`);
  }

  private getBranchPath(branchId: string): string {
    return join(this.basePath, "branches", `${branchId}.json`);
  }

  public async save(scope: StateScope, data: PersistedState): Promise<void> {
    const path = this.getScopePath(scope);
    const serialized = JSON.stringify(data, null, 2);
    await fs.writeFile(path, serialized, "utf-8");
  }

  public async load(scope: StateScope): Promise<PersistedState | null> {
    try {
      const path = this.getScopePath(scope);
      const data = await fs.readFile(path, "utf-8");
      return JSON.parse(data) as PersistedState;
    } catch {
      return null;
    }
  }

  public async delete(scope: StateScope): Promise<void> {
    try {
      const path = this.getScopePath(scope);
      await fs.unlink(path);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  public async saveSnapshot<T>(snapshot: StateSnapshot<T>): Promise<void> {
    const snapshotDir = join(this.basePath, "snapshots");
    await fs.mkdir(snapshotDir, { recursive: true });

    const path = this.getSnapshotPath(snapshot.id);
    const serialized = JSON.stringify(snapshot, null, 2);
    await fs.writeFile(path, serialized, "utf-8");
  }

  public async loadSnapshot<T>(
    snapshotId: string
  ): Promise<StateSnapshot<T> | null> {
    try {
      const path = this.getSnapshotPath(snapshotId);
      const data = await fs.readFile(path, "utf-8");
      return JSON.parse(data) as StateSnapshot<T>;
    } catch {
      return null;
    }
  }

  public async listSnapshots(): Promise<StateSnapshot[]> {
    const snapshotDir = join(this.basePath, "snapshots");

    try {
      const files = await fs.readdir(snapshotDir);
      const snapshots: StateSnapshot[] = [];

      for (const file of files) {
        if (file.endsWith(".json")) {
          const path = join(snapshotDir, file);
          const data = await fs.readFile(path, "utf-8");
          snapshots.push(JSON.parse(data));
        }
      }

      return snapshots.sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );
    } catch {
      return [];
    }
  }

  public async deleteSnapshot(snapshotId: string): Promise<void> {
    try {
      const path = this.getSnapshotPath(snapshotId);
      await fs.unlink(path);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  public async saveBranchState(
    branchId: string,
    state: unknown
  ): Promise<void> {
    const branchDir = join(this.basePath, "branches");
    await fs.mkdir(branchDir, { recursive: true });

    const path = this.getBranchPath(branchId);
    const serialized = JSON.stringify(state, null, 2);
    await fs.writeFile(path, serialized, "utf-8");
  }

  public async loadBranchState(branchId: string): Promise<unknown> {
    try {
      const path = this.getBranchPath(branchId);
      const data = await fs.readFile(path, "utf-8");
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  public async listBranches(): Promise<string[]> {
    const branchDir = join(this.basePath, "branches");

    try {
      const files = await fs.readdir(branchDir);
      return files
        .filter(f => f.endsWith(".json"))
        .map(f => f.replace(".json", ""));
    } catch {
      return [];
    }
  }

  public async deleteBranch(branchId: string): Promise<void> {
    try {
      const path = this.getBranchPath(branchId);
      await fs.unlink(path);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  public async clear(): Promise<void> {
    // Delete all files in base directory
    try {
      const files = await fs.readdir(this.basePath);
      for (const file of files) {
        const path = join(this.basePath, file);
        await fs.unlink(path);
      }
    } catch {
      // Ignore errors
    }
  }

  public async close(): Promise<void> {
    // Nothing to close for file persistence
  }
}

/**
 * PostgreSQL persistence (requires pg package)
 */
export class PostgreSQLPersistence implements StatePersistenceBackend {
  private connectionString: string;
  private pool: any;
  private connected: boolean;

  constructor(config: { connectionString: string }) {
    this.connectionString = config.connectionString;
    this.pool = null;
    this.connected = false;
  }

  private async ensureConnected(): Promise<void> {
    if (this.connected) return;

    try {
      // Dynamic import to avoid hard dependency
      const pg = await import("pg");
      this.pool = new pg.Pool({ connectionString: this.connectionString });

      // Create tables if not exist
      await this.createTables();
      this.connected = true;
    } catch (error) {
      throw new Error(`Failed to connect to PostgreSQL: ${error}`);
    }
  }

  private async createTables(): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS state_store (
          scope VARCHAR(50) PRIMARY KEY,
          state JSONB NOT NULL,
          version VARCHAR(100) NOT NULL,
          timestamp TIMESTAMP NOT NULL,
          checksum VARCHAR(64) NOT NULL,
          metadata JSONB
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS state_snapshots (
          id VARCHAR(100) PRIMARY KEY,
          version VARCHAR(100) NOT NULL,
          timestamp TIMESTAMP NOT NULL,
          scope VARCHAR(50) NOT NULL,
          data JSONB NOT NULL,
          checksum VARCHAR(64) NOT NULL,
          parent_id VARCHAR(100),
          metadata JSONB,
          size INTEGER,
          compressed BOOLEAN
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS branch_states (
          branch_id VARCHAR(100) PRIMARY KEY,
          state JSONB NOT NULL,
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    } finally {
      client.release();
    }
  }

  public async save(scope: StateScope, data: PersistedState): Promise<void> {
    await this.ensureConnected();

    const client = await this.pool.connect();

    try {
      await client.query(
        `INSERT INTO state_store (scope, state, version, timestamp, checksum, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (scope) DO UPDATE
         SET state = $2, version = $3, timestamp = $4, checksum = $5, metadata = $6`,
        [
          scope,
          JSON.stringify(data.state),
          data.version.toString(),
          data.timestamp,
          data.checksum,
          data.metadata ? JSON.stringify(data.metadata) : null,
        ]
      );
    } finally {
      client.release();
    }
  }

  public async load(scope: StateScope): Promise<PersistedState | null> {
    await this.ensureConnected();

    const client = await this.pool.connect();

    try {
      const result = await client.query(
        "SELECT * FROM state_store WHERE scope = $1",
        [scope]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        scope: row.scope,
        state: row.state,
        version: this.parseVersion(row.version),
        timestamp: new Date(row.timestamp),
        checksum: row.checksum,
        metadata: row.metadata,
      };
    } finally {
      client.release();
    }
  }

  public async delete(scope: StateScope): Promise<void> {
    await this.ensureConnected();

    const client = await this.pool.connect();

    try {
      await client.query("DELETE FROM state_store WHERE scope = $1", [scope]);
    } finally {
      client.release();
    }
  }

  public async saveSnapshot<T>(snapshot: StateSnapshot<T>): Promise<void> {
    await this.ensureConnected();

    const client = await this.pool.connect();

    try {
      await client.query(
        `INSERT INTO state_snapshots (id, version, timestamp, scope, data, checksum, parent_id, metadata, size, compressed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          snapshot.id,
          snapshot.version.toString(),
          snapshot.timestamp,
          snapshot.scope,
          JSON.stringify(snapshot.data),
          snapshot.checksum,
          snapshot.parentId || null,
          snapshot.metadata ? JSON.stringify(snapshot.metadata) : null,
          snapshot.size || null,
          snapshot.compressed || false,
        ]
      );
    } finally {
      client.release();
    }
  }

  public async loadSnapshot<T>(
    snapshotId: string
  ): Promise<StateSnapshot<T> | null> {
    await this.ensureConnected();

    const client = await this.pool.connect();

    try {
      const result = await client.query(
        "SELECT * FROM state_snapshots WHERE id = $1",
        [snapshotId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        version: this.parseVersion(row.version),
        timestamp: new Date(row.timestamp),
        scope: row.scope,
        data: row.data,
        checksum: row.checksum,
        parentId: row.parent_id,
        metadata: row.metadata,
        size: row.size,
        compressed: row.compressed,
      };
    } finally {
      client.release();
    }
  }

  public async listSnapshots(): Promise<StateSnapshot[]> {
    await this.ensureConnected();

    const client = await this.pool.connect();

    try {
      const result = await client.query(
        "SELECT * FROM state_snapshots ORDER BY timestamp ASC"
      );
      return result.rows.map((row: any) => ({
        id: row.id,
        version: this.parseVersion(row.version),
        timestamp: new Date(row.timestamp),
        scope: row.scope,
        data: row.data,
        checksum: row.checksum,
        parentId: row.parent_id,
        metadata: row.metadata,
        size: row.size,
        compressed: row.compressed,
      }));
    } finally {
      client.release();
    }
  }

  public async deleteSnapshot(snapshotId: string): Promise<void> {
    await this.ensureConnected();

    const client = await this.pool.connect();

    try {
      await client.query("DELETE FROM state_snapshots WHERE id = $1", [
        snapshotId,
      ]);
    } finally {
      client.release();
    }
  }

  public async saveBranchState(
    branchId: string,
    state: unknown
  ): Promise<void> {
    await this.ensureConnected();

    const client = await this.pool.connect();

    try {
      await client.query(
        `INSERT INTO branch_states (branch_id, state)
         VALUES ($1, $2)
         ON CONFLICT (branch_id) DO UPDATE
         SET state = $2, updated_at = NOW()`,
        [branchId, JSON.stringify(state)]
      );
    } finally {
      client.release();
    }
  }

  public async loadBranchState(branchId: string): Promise<unknown> {
    await this.ensureConnected();

    const client = await this.pool.connect();

    try {
      const result = await client.query(
        "SELECT state FROM branch_states WHERE branch_id = $1",
        [branchId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0].state;
    } finally {
      client.release();
    }
  }

  public async listBranches(): Promise<string[]> {
    await this.ensureConnected();

    const client = await this.pool.connect();

    try {
      const result = await client.query(
        "SELECT branch_id FROM branch_states ORDER BY branch_id"
      );
      return result.rows.map((row: any) => row.branch_id);
    } finally {
      client.release();
    }
  }

  public async deleteBranch(branchId: string): Promise<void> {
    await this.ensureConnected();

    const client = await this.pool.connect();

    try {
      await client.query("DELETE FROM branch_states WHERE branch_id = $1", [
        branchId,
      ]);
    } finally {
      client.release();
    }
  }

  public async clear(): Promise<void> {
    await this.ensureConnected();

    const client = await this.pool.connect();

    try {
      await client.query("DELETE FROM state_store");
      await client.query("DELETE FROM state_snapshots");
      await client.query("DELETE FROM branch_states");
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.connected = false;
    }
  }

  private parseVersion(versionString: string): StateVersion {
    const [main, branch] = versionString.split("+");
    const [major, minor, patch] = main.split(".").map(Number);

    return {
      major,
      minor,
      patch,
      branch,
      toString() {
        const base = `${major}.${minor}.${patch}`;
        return branch ? `${base}+${branch}` : base;
      },
      compare(other: StateVersion): number {
        if (this.major !== other.major) return this.major - other.major;
        if (this.minor !== other.minor) return this.minor - other.minor;
        if (this.patch !== other.patch) return this.patch - other.patch;
        const thisBranch = this.branch || "";
        const otherBranch = other.branch || "";
        return thisBranch.localeCompare(otherBranch);
      },
    };
  }
}

/**
 * Redis persistence (requires ioredis package)
 */
export class RedisPersistence implements StatePersistenceBackend {
  private url: string;
  private client: any;
  private connected: boolean;
  private keyPrefix: string;

  constructor(config: { url: string; keyPrefix?: string }) {
    this.url = config.url;
    this.keyPrefix = config.keyPrefix || "langgraph-state:";
    this.client = null;
    this.connected = false;
  }

  private async ensureConnected(): Promise<void> {
    if (this.connected) return;

    try {
      const Redis = (await import("ioredis")).default;
      this.client = new Redis(this.url);
      this.connected = true;
    } catch (error) {
      throw new Error(`Failed to connect to Redis: ${error}`);
    }
  }

  private scopeKey(scope: StateScope): string {
    return `${this.keyPrefix}scope:${scope}`;
  }

  private snapshotKey(snapshotId: string): string {
    return `${this.keyPrefix}snapshot:${snapshotId}`;
  }

  private branchKey(branchId: string): string {
    return `${this.keyPrefix}branch:${branchId}`;
  }

  public async save(scope: StateScope, data: PersistedState): Promise<void> {
    await this.ensureConnected();

    const key = this.scopeKey(scope);
    const serialized = JSON.stringify(data);

    await this.client.set(key, serialized);
  }

  public async load(scope: StateScope): Promise<PersistedState | null> {
    await this.ensureConnected();

    const key = this.scopeKey(scope);
    const data = await this.client.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data) as PersistedState;
  }

  public async delete(scope: StateScope): Promise<void> {
    await this.ensureConnected();

    const key = this.scopeKey(scope);
    await this.client.del(key);
  }

  public async saveSnapshot<T>(snapshot: StateSnapshot<T>): Promise<void> {
    await this.ensureConnected();

    const key = this.snapshotKey(snapshot.id);
    const serialized = JSON.stringify(snapshot);

    await this.client.set(key, serialized);

    // Add to snapshots list
    await this.client.zadd(
      `${this.keyPrefix}snapshots`,
      snapshot.timestamp.getTime(),
      snapshot.id
    );
  }

  public async loadSnapshot<T>(
    snapshotId: string
  ): Promise<StateSnapshot<T> | null> {
    await this.ensureConnected();

    const key = this.snapshotKey(snapshotId);
    const data = await this.client.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data) as StateSnapshot<T>;
  }

  public async listSnapshots(): Promise<StateSnapshot[]> {
    await this.ensureConnected();

    const snapshotIds = await this.client.zrange(
      `${this.keyPrefix}snapshots`,
      0,
      -1
    );
    const snapshots: StateSnapshot[] = [];

    for (const id of snapshotIds) {
      const snapshot = await this.loadSnapshot(id);
      if (snapshot) {
        snapshots.push(snapshot);
      }
    }

    return snapshots;
  }

  public async deleteSnapshot(snapshotId: string): Promise<void> {
    await this.ensureConnected();

    const key = this.snapshotKey(snapshotId);
    await this.client.del(key);
    await this.client.zrem(`${this.keyPrefix}snapshots`, snapshotId);
  }

  public async saveBranchState(
    branchId: string,
    state: unknown
  ): Promise<void> {
    await this.ensureConnected();

    const key = this.branchKey(branchId);
    const serialized = JSON.stringify(state);

    await this.client.set(key, serialized);
  }

  public async loadBranchState(branchId: string): Promise<unknown> {
    await this.ensureConnected();

    const key = this.branchKey(branchId);
    const data = await this.client.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data);
  }

  public async listBranches(): Promise<string[]> {
    await this.ensureConnected();

    const pattern = `${this.keyPrefix}branch:*`;
    const keys = await this.client.keys(pattern);

    return keys.map((key: string) =>
      key.replace(this.branchKey(""), "").replace(this.keyPrefix, "")
    );
  }

  public async deleteBranch(branchId: string): Promise<void> {
    await this.ensureConnected();

    const key = this.branchKey(branchId);
    await this.client.del(key);
  }

  public async clear(): Promise<void> {
    await this.ensureConnected();

    const pattern = `${this.keyPrefix}*`;
    const keys = await this.client.keys(pattern);

    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  public async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.connected = false;
    }
  }
}

/**
 * Serialization utilities
 */
export class StateSerializer {
  static async serialize<T>(
    data: T,
    options: SerializationOptions = {}
  ): Promise<Uint8Array | string> {
    const { format = "json", compress = false } = options;

    let result: string;

    switch (format) {
      case "json":
        result = JSON.stringify(data, this.dateReplacer);
        break;

      case "msgpack":
        // Requires msgpack-lite package
        try {
          const msgpack = await import("msgpack-lite");
          return msgpack.encode(data);
        } catch {
          throw new Error(
            "msgpack-lite package is required for msgpack serialization"
          );
        }

      case "binary":
        // Convert JSON to binary
        const jsonStr = JSON.stringify(data, this.dateReplacer);
        return new TextEncoder().encode(jsonStr);

      default:
        throw new Error(`Unsupported serialization format: ${format}`);
    }

    if (compress) {
      return this.compress(result);
    }

    return result;
  }

  static async deserialize<T>(
    data: string | Uint8Array,
    options: DeserializationOptions = {}
  ): Promise<T> {
    const { validate = false, verifyChecksum = false } = options;

    // Handle compressed data
    if (this.isCompressed(data)) {
      data = await this.decompress(data);
    }

    // Detect format from data type
    let result: T;

    if (data instanceof Uint8Array) {
      // Try binary decoding
      const jsonStr = new TextDecoder().decode(data);
      result = JSON.parse(jsonStr, this.dateReviver) as T;
    } else {
      result = JSON.parse(data as string, this.dateReviver) as T;
    }

    // Validate if requested
    if (validate) {
      // Validation would use StateValidator from validation.ts
    }

    // Verify checksum if requested and available
    if (verifyChecksum && typeof result === "object" && result !== null) {
      const state = result as Record<string, unknown>;
      if ("checksum" in state && "data" in state) {
        const expectedChecksum = await generateChecksum(state.data);
        if (state.checksum !== expectedChecksum) {
          throw new Error("Checksum verification failed");
        }
      }
    }

    return result;
  }

  private static dateReplacer(key: string, value: unknown): unknown {
    if (value instanceof Date) {
      return { __type__: "Date", value: value.toISOString() };
    }
    return value;
  }

  private static dateReviver(key: string, value: unknown): unknown {
    if (
      typeof value === "object" &&
      value !== null &&
      "__type__" in value &&
      (value as Record<string, unknown>).__type__ === "Date"
    ) {
      return new Date((value as Record<string, unknown>).value as string);
    }
    return value;
  }

  private static async compress(data: string): Promise<string> {
    try {
      // Requires fflate or pako package for compression
      // For now, return uncompressed
      return data;
    } catch {
      return data;
    }
  }

  private static async decompress(data: string | Uint8Array): Promise<string> {
    try {
      // Requires fflate or pako package for decompression
      return typeof data === "string" ? data : new TextDecoder().decode(data);
    } catch {
      return typeof data === "string" ? data : new TextDecoder().decode(data);
    }
  }

  private static isCompressed(data: string | Uint8Array): boolean {
    // Simple heuristic - compressed data usually has specific magic bytes
    if (data instanceof Uint8Array) {
      // Check for gzip magic bytes
      return data[0] === 0x1f && data[1] === 0x8b;
    }
    return false;
  }
}

/**
 * Factory function to create persistence backend
 */
export function createPersistenceBackend(
  strategy: PersistenceStrategy,
  config?: Record<string, unknown>
): StatePersistenceBackend {
  switch (strategy) {
    case "memory":
      return new MemoryPersistence();

    case "file":
      return new FilePersistence(config as { basePath: string });

    case "postgresql":
      return new PostgreSQLPersistence(config as { connectionString: string });

    case "redis":
      return new RedisPersistence(
        config as { url: string; keyPrefix?: string }
      );

    default:
      throw new Error(`Unsupported persistence strategy: ${strategy}`);
  }
}

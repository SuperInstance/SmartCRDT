/**
 * @lsi/state - StatePersistence
 *
 * Save and load state from various storage backends
 */

import type { StateSnapshot } from "../core/types.js";
import { deepClone } from "../utils/index.js";

/**
 * Storage backend interface
 */
export interface StorageBackend {
  /** Get a value by key */
  get(key: string): Promise<string | null>;
  /** Set a value by key */
  set(key: string, value: string): Promise<void>;
  /** Delete a value by key */
  delete(key: string): Promise<void>;
  /** Check if key exists */
  has(key: string): Promise<boolean>;
  /** Clear all values */
  clear(): Promise<void>;
}

/**
 * Persistence configuration
 */
export interface PersistenceConfig {
  /** Storage key prefix */
  keyPrefix?: string;
  /** Enable automatic persistence */
  autoSave?: boolean;
  /** Auto-save interval in milliseconds */
  autoSaveInterval?: number;
  /** Enable compression */
  compression?: boolean;
  /** Storage backend */
  storage?: StorageBackend;
}

/**
 * State serializer
 */
export interface StateSerializer<T> {
  serialize(state: T): string;
  deserialize(json: string): T;
}

/**
 * Default JSON serializer
 */
export class JSONSerializer<T> implements StateSerializer<T> {
  serialize(state: T): string {
    return JSON.stringify(state);
  }

  deserialize(json: string): T {
    return JSON.parse(json);
  }
}

/**
 * LocalStorage backend
 */
export class LocalStorageBackend implements StorageBackend {
  async get(key: string): Promise<string | null> {
    if (typeof localStorage === "undefined") {
      throw new Error("localStorage is not available");
    }
    return localStorage.getItem(key);
  }

  async set(key: string, value: string): Promise<void> {
    if (typeof localStorage === "undefined") {
      throw new Error("localStorage is not available");
    }
    localStorage.setItem(key, value);
  }

  async delete(key: string): Promise<void> {
    if (typeof localStorage === "undefined") {
      throw new Error("localStorage is not available");
    }
    localStorage.removeItem(key);
  }

  async has(key: string): Promise<boolean> {
    if (typeof localStorage === "undefined") {
      return false;
    }
    return localStorage.getItem(key) !== null;
  }

  async clear(): Promise<void> {
    if (typeof localStorage === "undefined") {
      return;
    }
    localStorage.clear();
  }
}

/**
 * Memory backend (for testing)
 */
export class MemoryBackend implements StorageBackend {
  private store: Map<string, string>;

  constructor() {
    this.store = new Map();
  }

  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

/**
 * State Persistence Manager
 *
 * Handles saving and loading state from storage.
 *
 * @example
 * ```typescript
 * const persistence = new StatePersistence<MyState>({
 *   keyPrefix: 'myapp',
 *   storage: new LocalStorageBackend()
 * });
 *
 * await persistence.save(state);
 * const loaded = await persistence.load();
 * ```
 */
export class StatePersistence<T> {
  protected config: Required<PersistenceConfig>;
  protected serializer: StateSerializer<T>;
  protected autoSaveTimer?: ReturnType<typeof setInterval>;
  protected pendingState?: T;

  /**
   * Create a new StatePersistence
   */
  constructor(serializer?: StateSerializer<T>, config: PersistenceConfig = {}) {
    this.config = {
      keyPrefix: config.keyPrefix ?? "state",
      autoSave: config.autoSave ?? false,
      autoSaveInterval: config.autoSaveInterval ?? 1000,
      compression: config.compression ?? false,
      storage: config.storage ?? new MemoryBackend(),
    };
    this.serializer = serializer ?? new JSONSerializer<T>();

    if (this.config.autoSave) {
      this.startAutoSave();
    }
  }

  /**
   * Save state
   */
  async save(state: T, key?: string): Promise<void> {
    const storageKey = this.getStorageKey(key);
    const serialized = this.serializer.serialize(deepClone(state));

    if (this.config.compression) {
      // Compression would be implemented here
      // For now, just store as-is
    }

    await this.config.storage.set(storageKey, serialized);
  }

  /**
   * Load state
   */
  async load(key?: string): Promise<T | null> {
    const storageKey = this.getStorageKey(key);
    const serialized = await this.config.storage.get(storageKey);

    if (!serialized) {
      return null;
    }

    if (this.config.compression) {
      // Decompression would be implemented here
    }

    try {
      return this.serializer.deserialize(serialized);
    } catch (error) {
      console.error("Failed to deserialize state:", error);
      return null;
    }
  }

  /**
   * Delete state
   */
  async delete(key?: string): Promise<void> {
    const storageKey = this.getStorageKey(key);
    await this.config.storage.delete(storageKey);
  }

  /**
   * Check if state exists
   */
  async has(key?: string): Promise<boolean> {
    const storageKey = this.getStorageKey(key);
    return await this.config.storage.has(storageKey);
  }

  /**
   * Clear all state
   */
  async clear(): Promise<void> {
    await this.config.storage.clear();
  }

  /**
   * Save a snapshot
   */
  async saveSnapshot(snapshot: StateSnapshot<T>): Promise<void> {
    const key = `${this.config.keyPrefix}:snapshot:${snapshot.id}`;
    const serialized = JSON.stringify(snapshot);
    await this.config.storage.set(key, serialized);
  }

  /**
   * Load a snapshot
   */
  async loadSnapshot(snapshotId: string): Promise<StateSnapshot<T> | null> {
    const key = `${this.config.keyPrefix}:snapshot:${snapshotId}`;
    const serialized = await this.config.storage.get(key);

    if (!serialized) {
      return null;
    }

    try {
      return JSON.parse(serialized) as StateSnapshot<T>;
    } catch (error) {
      console.error("Failed to deserialize snapshot:", error);
      return null;
    }
  }

  /**
   * List all snapshots
   */
  async listSnapshots(): Promise<StateSnapshot<T>[]> {
    const snapshots: StateSnapshot<T>[] = [];

    // This implementation depends on the storage backend
    // For a complete implementation, we'd need a way to list all keys
    // that match the pattern "keyPrefix:snapshot:*"

    return snapshots;
  }

  /**
   * Delete a snapshot
   */
  async deleteSnapshot(snapshotId: string): Promise<void> {
    const key = `${this.config.keyPrefix}:snapshot:${snapshotId}`;
    await this.config.storage.delete(key);
  }

  /**
   * Queue state for auto-save
   */
  queueAutoSave(state: T): void {
    this.pendingState = deepClone(state);
  }

  /**
   * Force immediate save of pending state
   */
  async flushAutoSave(): Promise<void> {
    if (this.pendingState) {
      await this.save(this.pendingState);
      this.pendingState = undefined;
    }
  }

  /**
   * Destroy persistence manager
   */
  async destroy(): Promise<void> {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }

    if (this.pendingState) {
      await this.flushAutoSave();
    }
  }

  /**
   * Get storage key
   */
  protected getStorageKey(key?: string): string {
    return key ? `${this.config.keyPrefix}:${key}` : this.config.keyPrefix;
  }

  /**
   * Start auto-save timer
   */
  protected startAutoSave(): void {
    this.autoSaveTimer = setInterval(async () => {
      if (this.pendingState) {
        await this.save(this.pendingState);
        this.pendingState = undefined;
      }
    }, this.config.autoSaveInterval);
  }

  /**
   * Get storage backend
   */
  getStorage(): StorageBackend {
    return this.config.storage;
  }

  /**
   * Set storage backend
   */
  setStorage(storage: StorageBackend): void {
    this.config.storage = storage;
  }

  /**
   * Get serializer
   */
  getSerializer(): StateSerializer<T> {
    return this.serializer;
  }

  /**
   * Set serializer
   */
  setSerializer(serializer: StateSerializer<T>): void {
    this.serializer = serializer;
  }
}

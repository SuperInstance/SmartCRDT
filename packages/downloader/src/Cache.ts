import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { CacheEntry, CacheStats } from './types.js';

/**
 * Cache options
 */
export interface CacheOptions {
  /** Cache directory path */
  cacheDir?: string;
  /** Maximum cache age in milliseconds */
  maxAge?: number;
  /** Maximum cache size in bytes */
  maxSize?: number;
  /** Index file name */
  indexFile?: string;
}

/**
 * Default cache options
 */
const DEFAULT_CACHE_OPTIONS: CacheOptions = {
  cacheDir: join(process.env.HOME || process.env.USERPROFILE || '~', '.aequor', 'cache'),
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  maxSize: 5 * 1024 * 1024 * 1024, // 5 GB
  indexFile: 'cache-index.json',
};

/**
 * Download cache for storing downloaded components
 */
export class DownloadCache {
  private cacheDir: string;
  private indexFile: string;
  private maxAge: number;
  private maxSize: number;
  private cacheEntries: Map<string, CacheEntry> = new Map();
  private cacheStats: CacheStats = {
    count: 0,
    totalSize: 0,
    oldestEntry: 0,
    newestEntry: 0,
    hitRate: 0,
    hits: 0,
    misses: 0,
  };

  constructor(options: CacheOptions = {}) {
    const opts = { ...DEFAULT_CACHE_OPTIONS, ...options };
    this.cacheDir = opts.cacheDir!;
    this.indexFile = join(this.cacheDir, opts.indexFile!);
    this.maxAge = opts.maxAge!;
    this.maxSize = opts.maxSize!;
  }

  /**
   * Initialize cache (load index from disk)
   */
  async initialize(): Promise<void> {
    mkdirSync(this.cacheDir, { recursive: true });
    await this.loadIndex();
  }

  /**
   * Check if component is cached
   */
  has(component: string, version: string): boolean {
    const key = this.makeKey(component, version);
    const entry = this.cacheEntries.get(key);

    if (!entry) {
      return false;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.cachedAt > this.maxAge) {
      // Entry expired, remove it
      this.cacheEntries.delete(key);
      return false;
    }

    // Check if file still exists
    if (!existsSync(entry.path)) {
      this.cacheEntries.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get cached component path
   */
  get(component: string, version: string): string | null {
    const key = this.makeKey(component, version);
    const entry = this.cacheEntries.get(key);

    if (!entry || !this.has(component, version)) {
      this.cacheStats.misses++;
      return null;
    }

    this.cacheStats.hits++;
    this.updateHitRate();

    // Update access time
    entry.accessedAt = Date.now();
    entry.accessCount++;

    return entry.path;
  }

  /**
   * Add component to cache
   */
  async set(component: string, version: string, path: string): Promise<void> {
    // Get file stats
    const fileStats = await fs.stat(path);
    const checksum = await this.calculateChecksum(path);

    const entry: CacheEntry = {
      component,
      version,
      path,
      size: fileStats.size,
      checksum,
      cachedAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 1,
    };

    const key = this.makeKey(component, version);
    this.cacheEntries.set(key, entry);

    // Update cache stats
    this.updateStats();

    // Check if we need to clean up
    await this.enforceMaxSize();

    // Save index
    await this.saveIndex();
  }

  /**
   * Remove component from cache
   */
  async remove(component: string, version: string): Promise<void> {
    const key = this.makeKey(component, version);
    const entry = this.cacheEntries.get(key);

    if (entry) {
      // Delete file
      try {
        await fs.unlink(entry.path);
      } catch (error) {
        console.warn(`Failed to delete cached file: ${entry.path}`, error);
      }

      // Remove from index
      this.cacheEntries.delete(key);

      // Update stats
      this.updateStats();

      // Save index
      await this.saveIndex();
    }
  }

  /**
   * Clean old cache entries
   */
  async clean(maxAge?: number): Promise<number> {
    const age = maxAge || this.maxAge;
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cacheEntries.entries()) {
      if (now - entry.cachedAt > age) {
        await this.remove(entry.component, entry.version);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    // Delete all files
    for (const entry of this.cacheEntries.values()) {
      try {
        await fs.unlink(entry.path);
      } catch (error) {
        console.warn(`Failed to delete cached file: ${entry.path}`, error);
      }
    }

    // Clear index
    this.cacheEntries.clear();

    // Reset stats
    this.cacheStats = {
      count: 0,
      totalSize: 0,
      oldestEntry: 0,
      newestEntry: 0,
      hitRate: 0,
      hits: 0,
      misses: 0,
    };

    // Save index
    await this.saveIndex();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.cacheStats };
  }

  /**
   * Get all cache entries
   */
  getEntries(): CacheEntry[] {
    return Array.from(this.cacheEntries.values());
  }

  /**
   * Load cache index from disk
   */
  private async loadIndex(): Promise<void> {
    try {
      const data = await fs.readFile(this.indexFile, 'utf-8');
      const index = JSON.parse(data);

      this.cacheEntries.clear();
      for (const entry of index) {
        const key = this.makeKey(entry.component, entry.version);
        this.cacheEntries.set(key, entry);
      }

      await this.updateStats();
    } catch (error) {
      // Index doesn't exist or is corrupt, start fresh
      this.cacheEntries.clear();
      await this.updateStats();
    }
  }

  /**
   * Save cache index to disk
   */
  private async saveIndex(): Promise<void> {
    const index = Array.from(this.cacheEntries.values());
    const data = JSON.stringify(index, null, 2);

    await fs.writeFile(this.indexFile, data, 'utf-8');
  }

  /**
   * Update cache statistics
   */
  private async updateStats(): Promise<void> {
    this.cacheStats.count = this.cacheEntries.size;
    this.cacheStats.totalSize = 0;
    this.cacheStats.oldestEntry = Date.now();
    this.cacheStats.newestEntry = 0;

    for (const entry of this.cacheEntries.values()) {
      this.cacheStats.totalSize += entry.size;

      if (entry.cachedAt < this.cacheStats.oldestEntry) {
        this.cacheStats.oldestEntry = entry.cachedAt;
      }

      if (entry.cachedAt > this.cacheStats.newestEntry) {
        this.cacheStats.newestEntry = entry.cachedAt;
      }
    }

    this.updateHitRate();
  }

  /**
   * Update cache hit rate
   */
  private updateHitRate(): void {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    this.cacheStats.hitRate = total > 0 ? this.cacheStats.hits / total : 0;
  }

  /**
   * Enforce maximum cache size
   */
  private async enforceMaxSize(): Promise<void> {
    if (this.cacheStats.totalSize <= this.maxSize) {
      return;
    }

    // Sort entries by last accessed time
    const sortedEntries = Array.from(this.cacheEntries.values()).sort(
      (a, b) => a.accessedAt - b.accessedAt
    );

    // Remove least recently used entries until we're under the limit
    for (const entry of sortedEntries) {
      if (this.cacheStats.totalSize <= this.maxSize * 0.8) {
        // Stop when we're at 80% of max size
        break;
      }

      await this.remove(entry.component, entry.version);
    }
  }

  /**
   * Make cache key from component and version
   */
  private makeKey(component: string, version: string): string {
    return `${component}@${version}`;
  }

  /**
   * Calculate checksum for file
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256');

    const stream = await fs.readFile(filePath);
    hash.update(stream);

    return hash.digest('hex');
  }

  /**
   * Validate cache entry (check if file exists and matches checksum)
   */
  async validate(component: string, version: string): Promise<boolean> {
    const key = this.makeKey(component, version);
    const entry = this.cacheEntries.get(key);

    if (!entry) {
      return false;
    }

    // Check if file exists
    if (!existsSync(entry.path)) {
      return false;
    }

    // Verify checksum
    const actualChecksum = await this.calculateChecksum(entry.path);
    return actualChecksum === entry.checksum;
  }

  /**
   * Repair cache (remove invalid entries)
   */
  async repair(): Promise<number> {
    let repaired = 0;

    for (const [key, entry] of this.cacheEntries.entries()) {
      const valid = await this.validate(entry.component, entry.version);
      if (!valid) {
        await this.remove(entry.component, entry.version);
        repaired++;
      }
    }

    return repaired;
  }

  /**
   * Get cache size in human-readable format
   */
  getSize(): string {
    const bytes = this.cacheStats.totalSize;
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Get cache usage percentage
   */
  getUsage(): number {
    return (this.cacheStats.totalSize / this.maxSize) * 100;
  }
}

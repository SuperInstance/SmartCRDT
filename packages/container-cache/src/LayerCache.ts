import { createHash } from "crypto";
import { mkdir, readFile, writeFile, unlink, readdir, stat } from "fs/promises";
import { join, dirname } from "path";
import { LayerCache, ImageLayer } from "./types.js";
import { existsSync } from "fs";

/**
 * Layer cache manager for deduplicating and storing container image layers
 */
export class LayerCacheManager {
  private cache: Map<string, LayerCache> = new Map();
  private config: {
    cacheDir: string;
    maxLayers: number;
    maxSize: number;
    compress: boolean;
    verify: boolean;
  };

  constructor(config: {
    cacheDir: string;
    maxLayers?: number;
    maxSize?: number;
    compress?: boolean;
    verify?: boolean;
  }) {
    this.config = {
      cacheDir: config.cacheDir,
      maxLayers: config.maxLayers ?? 1000,
      maxSize: config.maxSize ?? 100 * 1024 * 1024 * 1024, // 100GB
      compress: config.compress ?? true,
      verify: config.verify ?? true,
    };
  }

  /**
   * Initialize the layer cache
   */
  async initialize(): Promise<void> {
    await mkdir(this.config.cacheDir, { recursive: true });
    await this.loadCacheIndex();
  }

  /**
   * Add a layer to the cache
   */
  async addLayer(layer: ImageLayer, data: Buffer): Promise<void> {
    const digest = layer.digest;
    const location = join(
      this.config.cacheDir,
      `${digest.replace("sha256:", "")}.layer`
    );

    // Verify layer hash if enabled
    if (this.config.verify) {
      const hash = createHash("sha256").update(data).digest("hex");
      if (hash !== digest.replace("sha256:", "")) {
        throw new Error(`Layer hash mismatch: expected ${digest}, got ${hash}`);
      }
    }

    // Compress if enabled
    let finalData = data;
    let compressedSize = layer.compressed_size;

    if (this.config.compress && !this.isCompressed(layer.media_type)) {
      // In real implementation, use zlib
      finalData = data;
    }

    // Write layer data
    await writeFile(location, finalData);

    // Add to cache index
    const entry: LayerCache = {
      digest,
      compressed_size: compressedSize,
      uncompressed_size: layer.uncompressed_size,
      cache_hits: 0,
      referenced_by: [],
      cached_at: new Date(),
      last_used: new Date(),
      location,
      verified: this.config.verify,
    };

    this.cache.set(digest, entry);
    await this.saveCacheIndex();

    // Check if we need to evict
    await this.checkEviction();
  }

  /**
   * Get a layer from cache
   */
  async getLayer(digest: string): Promise<Buffer | null> {
    const entry = this.cache.get(digest);
    if (!entry) {
      return null;
    }

    try {
      const data = await readFile(entry.location);
      entry.cache_hits++;
      entry.last_used = new Date();
      await this.saveCacheIndex();
      return data;
    } catch (error) {
      // Layer file missing, remove from index
      this.cache.delete(digest);
      await this.saveCacheIndex();
      return null;
    }
  }

  /**
   * Check if a layer exists in cache
   */
  hasLayer(digest: string): boolean {
    return this.cache.has(digest);
  }

  /**
   * Add reference to a layer
   */
  addReference(digest: string, imageRef: string): void {
    const entry = this.cache.get(digest);
    if (entry && !entry.referenced_by.includes(imageRef)) {
      entry.referenced_by.push(imageRef);
    }
  }

  /**
   * Remove reference from a layer
   */
  removeReference(digest: string, imageRef: string): void {
    const entry = this.cache.get(digest);
    if (entry) {
      entry.referenced_by = entry.referenced_by.filter(ref => ref !== imageRef);
    }
  }

  /**
   * Get all unreferenced layers
   */
  getUnreferencedLayers(): string[] {
    const unreferenced: string[] = [];
    for (const [digest, entry] of this.cache.entries()) {
      if (entry.referenced_by.length === 0) {
        unreferenced.push(digest);
      }
    }
    return unreferenced;
  }

  /**
   * Evict least recently used layers
   */
  async evictLRU(count: number): Promise<string[]> {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].last_used.getTime() - b[1].last_used.getTime())
      .slice(0, count);

    const evicted: string[] = [];
    for (const [digest, entry] of entries) {
      await this.removeLayer(digest);
      evicted.push(digest);
    }

    return evicted;
  }

  /**
   * Evict layers by size to free space
   */
  async evictBySize(
    bytes: number
  ): Promise<{ layers: string[]; freed: number }> {
    const entries = Array.from(this.cache.entries()).sort(
      (a, b) => a[1].last_used.getTime() - b[1].last_used.getTime()
    );

    let freed = 0;
    const evicted: string[] = [];

    for (const [digest, entry] of entries) {
      if (freed >= bytes) break;
      await this.removeLayer(digest);
      evicted.push(digest);
      freed += entry.compressed_size;
    }

    return { layers: evicted, freed };
  }

  /**
   * Remove a layer from cache
   */
  async removeLayer(digest: string): Promise<void> {
    const entry = this.cache.get(digest);
    if (entry) {
      try {
        await unlink(entry.location);
      } catch (error) {
        // Ignore errors if file doesn't exist
      }
      this.cache.delete(digest);
      await this.saveCacheIndex();
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    layerCount: number;
    totalSize: number;
    totalHits: number;
    avgHitsPerLayer: number;
    deduplicationSavings: number;
  } {
    let totalSize = 0;
    let totalHits = 0;

    for (const entry of this.cache.values()) {
      totalSize += entry.compressed_size;
      totalHits += entry.cache_hits;
    }

    // Calculate deduplication savings
    let totalUncompressed = 0;
    for (const entry of this.cache.values()) {
      totalUncompressed += entry.uncompressed_size;
    }

    const deduplicationSavings =
      totalUncompressed > 0 ? (1 - totalSize / totalUncompressed) * 100 : 0;

    return {
      layerCount: this.cache.size,
      totalSize,
      totalHits,
      avgHitsPerLayer: this.cache.size > 0 ? totalHits / this.cache.size : 0,
      deduplicationSavings,
    };
  }

  /**
   * Get all cached layer digests
   */
  getCachedLayers(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get layer information
   */
  getLayerInfo(digest: string): LayerCache | undefined {
    return this.cache.get(digest);
  }

  /**
   * Verify layer integrity
   */
  async verifyLayer(digest: string): Promise<boolean> {
    const entry = this.cache.get(digest);
    if (!entry) {
      return false;
    }

    try {
      const data = await readFile(entry.location);
      const hash = createHash("sha256").update(data).digest("hex");
      const isValid = hash === digest.replace("sha256:", "");
      entry.verified = isValid;
      return isValid;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear all cached layers
   */
  async clearCache(): Promise<void> {
    for (const digest of this.cache.keys()) {
      await this.removeLayer(digest);
    }
  }

  /**
   * Load cache index from disk
   */
  private async loadCacheIndex(): Promise<void> {
    const indexFile = join(this.config.cacheDir, "layer-index.json");

    if (!existsSync(indexFile)) {
      return;
    }

    try {
      const data = await readFile(indexFile, "utf-8");
      const entries = JSON.parse(data) as LayerCache[];

      for (const entry of entries) {
        entry.cached_at = new Date(entry.cached_at);
        entry.last_used = new Date(entry.last_used);
        this.cache.set(entry.digest, entry);
      }
    } catch (error) {
      console.error("Failed to load layer cache index:", error);
    }
  }

  /**
   * Save cache index to disk
   */
  private async saveCacheIndex(): Promise<void> {
    const indexFile = join(this.config.cacheDir, "layer-index.json");
    const entries = Array.from(this.cache.values());
    await writeFile(indexFile, JSON.stringify(entries, null, 2));
  }

  /**
   * Check if eviction is needed
   */
  private async checkEviction(): Promise<void> {
    const stats = this.getStats();

    // Check layer count
    if (stats.layerCount > this.config.maxLayers) {
      const excess = stats.layerCount - this.config.maxLayers;
      await this.evictLRU(excess);
    }

    // Check total size
    if (stats.totalSize > this.config.maxSize) {
      await this.evictBySize(stats.totalSize - this.config.maxSize);
    }
  }

  /**
   * Check if media type is already compressed
   */
  private isCompressed(mediaType: string): boolean {
    const compressedTypes = [
      "application/vnd.docker.image.rootfs.diff.tar.gzip",
      "application/vnd.oci.image.layer.v1.tar+gzip",
      "application/vnd.docker.image.rootfs.diff.tar.zstd",
      "application/vnd.oci.image.layer.v1.tar+zstd",
    ];
    return compressedTypes.some(type => mediaType.includes(type));
  }

  /**
   * Get layers shared between images
   */
  getSharedLayers(): Map<string, string[]> {
    const shared = new Map<string, string[]>();
    for (const [digest, entry] of this.cache.entries()) {
      if (entry.referenced_by.length > 1) {
        shared.set(digest, [...entry.referenced_by]);
      }
    }
    return shared;
  }

  /**
   * Calculate potential savings from layer sharing
   */
  calculateSharingSavings(): {
    sharedLayers: number;
    savedBytes: number;
    savingPercentage: number;
  } {
    let sharedLayers = 0;
    let savedBytes = 0;
    let totalBytes = 0;

    for (const entry of this.cache.values()) {
      totalBytes += entry.uncompressed_size;
      if (entry.referenced_by.length > 1) {
        sharedLayers++;
        // Calculate saved bytes: (refs - 1) * size
        savedBytes +=
          (entry.referenced_by.length - 1) * entry.uncompressed_size;
      }
    }

    const savingPercentage =
      totalBytes > 0 ? (savedBytes / totalBytes) * 100 : 0;

    return {
      sharedLayers,
      savedBytes,
      savingPercentage,
    };
  }

  /**
   * Export cache metadata
   */
  exportMetadata(): LayerCache[] {
    return Array.from(this.cache.values());
  }

  /**
   * Import cache metadata (for migration)
   */
  async importMetadata(entries: LayerCache[]): Promise<void> {
    for (const entry of entries) {
      entry.cached_at = new Date(entry.cached_at);
      entry.last_used = new Date(entry.last_used);
      this.cache.set(entry.digest, entry);
    }
    await this.saveCacheIndex();
  }
}

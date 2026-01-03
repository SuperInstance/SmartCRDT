import { mkdir, readFile, writeFile, unlink, stat } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import {
  ContainerImage,
  CacheEntry,
  CacheMetrics,
  CacheStrategy,
  CacheConfig,
  WarmupResult,
  EvictionResult,
  PullProgress,
} from "./types.js";
import { LayerCacheManager } from "./LayerCache.js";
import { PredictiveLoader } from "./PredictiveLoader.js";
import { DockerClient } from "./docker.js";

/**
 * Container image cache manager
 * Provides efficient caching, preloading, and management of container images
 */
export class ContainerCache {
  private cache: Map<string, CacheEntry> = new Map();
  private layerCache: LayerCacheManager;
  private predictiveLoader: PredictiveLoader;
  private docker: DockerClient;
  private config: CacheConfig;
  private metrics: CacheMetrics;
  private accessTimes: Map<string, number[]> = new Map();

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      max_size: config.max_size ?? 50 * 1024 * 1024 * 1024, // 50GB
      max_images: config.max_images ?? 100,
      default_strategy: config.default_strategy ?? "lazy",
      lru_eviction: config.lru_eviction ?? true,
      size_eviction: config.size_eviction ?? true,
      layer_deduplication: config.layer_deduplication ?? true,
      cache_dir: config.cache_dir ?? "/var/lib/container-cache",
      verify_integrity: config.verify_integrity ?? true,
      compress_layers: config.compress_layers ?? true,
      predictive_preloading: config.predictive_preloading ?? true,
      prediction_window: config.prediction_window ?? 24,
      min_preload_probability: config.min_preload_probability ?? 0.6,
      preload_check_interval: config.preload_check_interval ?? 300000, // 5 min
    };

    this.layerCache = new LayerCacheManager({
      cacheDir: join(this.config.cache_dir, "layers"),
      maxSize: this.config.max_size,
      compress: this.config.compress_layers,
      verify: this.config.verify_integrity,
    });

    this.predictiveLoader = new PredictiveLoader({
      predictionWindow: this.config.prediction_window,
      minProbability: this.config.min_preload_probability,
    });

    this.docker = new DockerClient();

    this.metrics = this.initializeMetrics();
  }

  /**
   * Initialize the cache
   */
  async initialize(): Promise<void> {
    await mkdir(this.config.cache_dir, { recursive: true });
    await this.layerCache.initialize();
    await this.loadCacheIndex();

    if (this.config.predictive_preloading) {
      this.startPredictivePreloading();
    }
  }

  /**
   * Preload a container image
   */
  async preloadImage(
    imageRef: string,
    strategy: CacheStrategy = this.config.default_strategy,
    onProgress?: (progress: PullProgress) => void
  ): Promise<void> {
    // Check if already cached
    if (this.cache.has(imageRef)) {
      const entry = this.cache.get(imageRef)!;
      entry.last_used = new Date();
      entry.access_count++;
      await this.saveCacheIndex();
      return;
    }

    // Pull the image
    const startTime = Date.now();
    const image = await this.docker.pullImage(imageRef, onProgress);
    const accessTime = Date.now() - startTime;

    // Cache layers if deduplication is enabled
    if (this.config.layer_deduplication) {
      for (const layer of image.layers) {
        const layerData = await this.fetchLayerData(imageRef, layer.digest);
        if (layerData) {
          try {
            await this.layerCache.addLayer(layer, layerData);
            this.layerCache.addReference(layer.digest, imageRef);
          } catch (error) {
            console.error(`Failed to cache layer ${layer.digest}:`, error);
          }
        }
      }
    }

    // Create cache entry
    const entry: CacheEntry = {
      id: this.generateId(),
      image_ref: imageRef,
      image,
      cached_at: new Date(),
      last_used: new Date(),
      access_count: 1,
      size_bytes: image.size,
      strategy,
      priority: this.predictiveLoader.getPreloadPriority(imageRef),
      verified: !this.config.verify_integrity,
    };

    this.cache.set(imageRef, entry);
    this.updateMetrics(true, accessTime);
    this.predictiveLoader.recordUsage(imageRef);
    await this.saveCacheIndex();

    // Check if eviction is needed
    await this.checkEviction();
  }

  /**
   * Get an image from cache
   */
  async getImage(imageRef: string): Promise<ContainerImage | null> {
    const startTime = Date.now();

    const entry = this.cache.get(imageRef);
    if (!entry) {
      this.updateMetrics(false, Date.now() - startTime);
      return null;
    }

    entry.last_used = new Date();
    entry.access_count++;

    // Track access time
    const accessTime = Date.now() - startTime;
    this.trackAccessTime(imageRef, accessTime);

    await this.saveCacheIndex();
    return entry.image;
  }

  /**
   * Check if image is cached
   */
  hasImage(imageRef: string): boolean {
    return this.cache.has(imageRef);
  }

  /**
   * Evict least recently used images
   */
  async evictLRU(count: number): Promise<void> {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].last_used.getTime() - b[1].last_used.getTime())
      .slice(0, count);

    for (const [imageRef, entry] of entries) {
      await this.removeImage(imageRef);
    }
  }

  /**
   * Evict images by size to free space
   */
  async evictBySize(bytes: number): Promise<EvictionResult> {
    const entries = Array.from(this.cache.entries()).sort(
      (a, b) => a[1].last_used.getTime() - b[1].last_used.getTime()
    );

    let freed = 0;
    const evictedImages: string[] = [];
    const evictedLayers: string[] = [];

    for (const [imageRef, entry] of entries) {
      if (freed >= bytes) break;

      // Remove layer references
      for (const layer of entry.image.layers) {
        this.layerCache.removeReference(layer.digest, imageRef);

        // If layer is no longer referenced, consider evicting it
        const layerInfo = this.layerCache.getLayerInfo(layer.digest);
        if (layerInfo && layerInfo.referenced_by.length === 0) {
          await this.layerCache.removeLayer(layer.digest);
          evictedLayers.push(layer.digest);
          freed += layerInfo.compressed_size;
        }
      }

      await this.removeImage(imageRef);
      evictedImages.push(imageRef);
      freed += entry.size_bytes;
    }

    return {
      evicted_images: evictedImages,
      evicted_layers: evictedLayers,
      bytes_freed: freed,
      duration_ms: 0,
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheMetrics {
    const layerStats = this.layerCache.getStats();

    return {
      ...this.metrics,
      total_size: this.calculateTotalSize(),
      image_count: this.cache.size,
      layer_count: layerStats.layerCount,
      avg_access_time: this.calculateAverageAccessTime(),
      compression_ratio: layerStats.deduplicationSavings / 100,
    };
  }

  /**
   * Warm up cache with multiple images
   */
  async warmupCache(images: string[]): Promise<WarmupResult> {
    const result: WarmupResult = {
      warmed: [],
      failed: [],
      cached: [],
      duration_ms: Date.now(),
      bytes_downloaded: 0,
    };

    for (const image of images) {
      if (this.cache.has(image)) {
        result.cached.push(image);
        continue;
      }

      try {
        await this.preloadImage(image);
        const entry = this.cache.get(image);
        if (entry) {
          result.warmed.push(image);
          result.bytes_downloaded += entry.size_bytes;
        }
      } catch (error: any) {
        result.failed.push({ image, error: error.message });
      }
    }

    result.duration_ms = Date.now() - result.duration_ms;
    return result;
  }

  /**
   * Verify cache integrity
   */
  async verifyCache(imageRef: string): Promise<boolean> {
    const entry = this.cache.get(imageRef);
    if (!entry) {
      return false;
    }

    try {
      // Verify image exists in Docker
      const exists = await this.docker.imageExists(imageRef);
      if (!exists) {
        return false;
      }

      // Verify layers
      for (const layer of entry.image.layers) {
        const verified = await this.layerCache.verifyLayer(layer.digest);
        if (!verified) {
          entry.verified = false;
          await this.saveCacheIndex();
          return false;
        }
      }

      entry.verified = true;
      await this.saveCacheIndex();
      return true;
    } catch (error) {
      entry.verified = false;
      await this.saveCacheIndex();
      return false;
    }
  }

  /**
   * Clear all cached images
   */
  async clearCache(): Promise<void> {
    for (const imageRef of this.cache.keys()) {
      await this.removeImage(imageRef);
    }
    await this.layerCache.clearCache();
  }

  /**
   * Get all cached image references
   */
  getCachedImages(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache entry for an image
   */
  getCacheEntry(imageRef: string): CacheEntry | undefined {
    return this.cache.get(imageRef);
  }

  /**
   * Update cache entry priority
   */
  setPriority(imageRef: string, priority: number): void {
    const entry = this.cache.get(imageRef);
    if (entry) {
      entry.priority = Math.max(0, Math.min(100, priority));
    }
  }

  /**
   * Get recommended preload images
   */
  getRecommendedPreloads(): string[] {
    const predictions = this.predictiveLoader.predictPreloads();
    return predictions
      .filter(p => !this.cache.has(p.image_ref))
      .slice(0, 10)
      .map(p => p.image_ref);
  }

  /**
   * Remove an image from cache
   */
  private async removeImage(imageRef: string): Promise<void> {
    const entry = this.cache.get(imageRef);
    if (!entry) {
      return;
    }

    // Remove layer references
    if (this.config.layer_deduplication) {
      for (const layer of entry.image.layers) {
        this.layerCache.removeReference(layer.digest, imageRef);
      }
    }

    // Remove from Docker
    try {
      await this.docker.removeImage(imageRef);
    } catch (error) {
      // Ignore errors
    }

    this.cache.delete(imageRef);
    await this.saveCacheIndex();
  }

  /**
   * Load cache index from disk
   */
  private async loadCacheIndex(): Promise<void> {
    const indexFile = join(this.config.cache_dir, "cache-index.json");

    if (!existsSync(indexFile)) {
      return;
    }

    try {
      const data = await readFile(indexFile, "utf-8");
      const entries = JSON.parse(data) as CacheEntry[];

      for (const entry of entries) {
        entry.cached_at = new Date(entry.cached_at);
        entry.last_used = new Date(entry.last_used);
        entry.image.created_at = new Date(entry.image.created_at);

        // Verify image still exists
        const exists = await this.docker.imageExists(entry.image_ref);
        if (exists) {
          this.cache.set(entry.image_ref, entry);
        }
      }
    } catch (error) {
      console.error("Failed to load cache index:", error);
    }
  }

  /**
   * Save cache index to disk
   */
  private async saveCacheIndex(): Promise<void> {
    const indexFile = join(this.config.cache_dir, "cache-index.json");
    const entries = Array.from(this.cache.values());
    await writeFile(indexFile, JSON.stringify(entries, null, 2));
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): CacheMetrics {
    return {
      hit_rate: 0,
      miss_rate: 0,
      total_hits: 0,
      total_misses: 0,
      total_size: 0,
      max_size: this.config.max_size,
      image_count: 0,
      layer_count: 0,
      eviction_rate: 0,
      total_evictions: 0,
      avg_access_time: 0,
      compression_ratio: 0,
    };
  }

  /**
   * Update metrics
   */
  private updateMetrics(hit: boolean, accessTime: number): void {
    if (hit) {
      this.metrics.total_hits++;
    } else {
      this.metrics.total_misses++;
    }

    const total = this.metrics.total_hits + this.metrics.total_misses;
    this.metrics.hit_rate = this.metrics.total_hits / total;
    this.metrics.miss_rate = this.metrics.total_misses / total;
  }

  /**
   * Calculate total cache size
   */
  private calculateTotalSize(): number {
    let total = 0;
    for (const entry of this.cache.values()) {
      total += entry.size_bytes;
    }
    return total;
  }

  /**
   * Track access time for averaging
   */
  private trackAccessTime(imageRef: string, accessTime: number): void {
    if (!this.accessTimes.has(imageRef)) {
      this.accessTimes.set(imageRef, []);
    }
    const times = this.accessTimes.get(imageRef)!;
    times.push(accessTime);
    // Keep only last 100 access times
    if (times.length > 100) {
      times.shift();
    }
  }

  /**
   * Calculate average access time
   */
  private calculateAverageAccessTime(): number {
    let totalTime = 0;
    let count = 0;
    for (const times of this.accessTimes.values()) {
      for (const time of times) {
        totalTime += time;
        count++;
      }
    }
    return count > 0 ? totalTime / count : 0;
  }

  /**
   * Check if eviction is needed
   */
  private async checkEviction(): Promise<void> {
    const stats = this.getCacheStats();

    // Check image count
    if (this.config.max_images && stats.image_count > this.config.max_images) {
      if (this.config.lru_eviction) {
        const excess = stats.image_count - this.config.max_images;
        await this.evictLRU(excess);
      }
    }

    // Check total size
    if (stats.total_size > this.config.max_size) {
      if (this.config.size_eviction) {
        await this.evictBySize(stats.total_size - this.config.max_size);
      }
    }
  }

  /**
   * Fetch layer data from image
   */
  private async fetchLayerData(
    imageRef: string,
    digest: string
  ): Promise<Buffer | null> {
    // In a real implementation, we would extract the layer data from the image
    // For now, return null (layers will be cached by Docker)
    return null;
  }

  /**
   * Start predictive preloading
   */
  private startPredictivePreloading(): void {
    setInterval(async () => {
      const recommended = this.getRecommendedPreloads();
      for (const image of recommended) {
        try {
          await this.preloadImage(image, "predictive");
        } catch (error) {
          console.error(`Failed to preload ${image}:`, error);
        }
      }
    }, this.config.preload_check_interval);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export cache state
   */
  exportState(): {
    entries: CacheEntry[];
    metrics: CacheMetrics;
    usagePatterns: ReturnType<PredictiveLoader["exportData"]>;
  } {
    return {
      entries: Array.from(this.cache.values()),
      metrics: this.getCacheStats(),
      usagePatterns: this.predictiveLoader.exportData(),
    };
  }

  /**
   * Import cache state
   */
  async importState(state: {
    entries?: CacheEntry[];
    usagePatterns?: ReturnType<PredictiveLoader["importData"]>;
  }): Promise<void> {
    if (state.entries) {
      for (const entry of state.entries) {
        entry.cached_at = new Date(entry.cached_at);
        entry.last_used = new Date(entry.last_used);
        entry.image.created_at = new Date(entry.image.created_at);
        this.cache.set(entry.image_ref, entry);
      }
      await this.saveCacheIndex();
    }

    if (state.usagePatterns) {
      this.predictiveLoader.importData(state.usagePatterns);
    }
  }
}

/**
 * Create a container cache instance
 */
export function createContainerCache(
  config?: Partial<CacheConfig>
): ContainerCache {
  return new ContainerCache(config);
}

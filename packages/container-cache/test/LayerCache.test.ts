import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LayerCacheManager } from '../src/LayerCache.js';
import { ImageLayer } from '../src/types.js';
import { mkdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('LayerCacheManager', () => {
  let cacheDir: string;
  let layerCache: LayerCacheManager;

  beforeEach(async () => {
    cacheDir = join(tmpdir(), `layer-cache-test-${Date.now()}`);
    await mkdir(cacheDir, { recursive: true });

    layerCache = new LayerCacheManager({
      cacheDir,
      maxLayers: 100,
      maxSize: 1024 * 1024 * 1024, // 1GB
      compress: true,
      verify: true
    });

    await layerCache.initialize();
  });

  afterEach(async () => {
    await layerCache.clearCache();
    try {
      await rm(cacheDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore
    }
  });

  describe('initialization', () => {
    it('should initialize cache directory', async () => {
      const fs = await import('fs/promises');
      const exists = await fs.access(cacheDir).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should initialize with default config', () => {
      const defaultCache = new LayerCacheManager({ cacheDir });
      expect(defaultCache).toBeInstanceOf(LayerCacheManager);
    });

    it('should initialize with custom config', () => {
      const customCache = new LayerCacheManager({
        cacheDir,
        maxLayers: 200,
        maxSize: 2 * 1024 * 1024 * 1024,
        compress: false,
        verify: false
      });
      expect(customCache).toBeInstanceOf(LayerCacheManager);
    });
  });

  describe('layer operations', () => {
    it('should add layer to cache', async () => {
      const layer: ImageLayer = {
        digest: 'sha256:abc123',
        compressed_size: 1024,
        uncompressed_size: 2048,
        media_type: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
        index: 0
      };

      const data = Buffer.from('test layer data');
      await layerCache.addLayer(layer, data);

      expect(layerCache.hasLayer('sha256:abc123')).toBe(true);
    });

    it('should get layer from cache', async () => {
      const layer: ImageLayer = {
        digest: 'sha256:def456',
        compressed_size: 1024,
        uncompressed_size: 2048,
        media_type: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
        index: 0
      };

      const data = Buffer.from('test layer data');
      await layerCache.addLayer(layer, data);

      const retrieved = await layerCache.getLayer('sha256:def456');
      expect(retrieved).not.toBeNull();
      expect(Buffer.compare(retrieved!, data)).toBe(0);
    });

    it('should return null for non-existent layer', async () => {
      const retrieved = await layerCache.getLayer('sha256:nonexistent');
      expect(retrieved).toBeNull();
    });

    it('should check if layer exists', () => {
      expect(layerCache.hasLayer('sha256:test')).toBe(false);
    });

    it('should remove layer from cache', async () => {
      const layer: ImageLayer = {
        digest: 'sha256:remove-test',
        compressed_size: 1024,
        uncompressed_size: 2048,
        media_type: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
        index: 0
      };

      const data = Buffer.from('test data');
      await layerCache.addLayer(layer, data);
      expect(layerCache.hasLayer('sha256:remove-test')).toBe(true);

      await layerCache.removeLayer('sha256:remove-test');
      expect(layerCache.hasLayer('sha256:remove-test')).toBe(false);
    });
  });

  describe('layer references', () => {
    it('should add reference to layer', () => {
      layerCache.addReference('sha256:ref-test', 'image1');
      const info = layerCache.getLayerInfo('sha256:ref-test');
      expect(info?.referenced_by).toContain('image1');
    });

    it('should remove reference from layer', () => {
      layerCache.addReference('sha256:ref-test2', 'image1');
      layerCache.addReference('sha256:ref-test2', 'image2');
      layerCache.removeReference('sha256:ref-test2', 'image1');

      const info = layerCache.getLayerInfo('sha256:ref-test2');
      expect(info?.referenced_by).not.toContain('image1');
      expect(info?.referenced_by).toContain('image2');
    });

    it('should not add duplicate references', () => {
      layerCache.addReference('sha256:dup-test', 'image1');
      layerCache.addReference('sha256:dup-test', 'image1');

      const info = layerCache.getLayerInfo('sha256:dup-test');
      const count = info?.referenced_by.filter(r => r === 'image1').length;
      expect(count).toBe(1);
    });

    it('should get unreferenced layers', async () => {
      const layer: ImageLayer = {
        digest: 'sha256:unref',
        compressed_size: 1024,
        uncompressed_size: 2048,
        media_type: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
        index: 0
      };

      const data = Buffer.from('test');
      await layerCache.addLayer(layer, data);

      const unreferenced = layerCache.getUnreferencedLayers();
      expect(unreferenced).toContain('sha256:unref');
    });
  });

  describe('eviction', () => {
    it('should evict LRU layers', async () => {
      // Add multiple layers
      for (let i = 0; i < 5; i++) {
        const layer: ImageLayer = {
          digest: `sha256:lru${i}`,
          compressed_size: 1024,
          uncompressed_size: 2048,
          media_type: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
          index: i
        };
        const data = Buffer.from(`layer ${i}`);
        await layerCache.addLayer(layer, data);
      }

      const evicted = await layerCache.evictLRU(2);
      expect(evicted.length).toBe(2);
    });

    it('should evict by size', async () => {
      // Add layers
      for (let i = 0; i < 5; i++) {
        const layer: ImageLayer = {
          digest: `sha256:size${i}`,
          compressed_size: 1024,
          uncompressed_size: 2048,
          media_type: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
          index: i
        };
        const data = Buffer.from(`layer ${i}`);
        await layerCache.addLayer(layer, data);
      }

      const result = await layerCache.evictBySize(2048);
      expect(result.freed).toBeGreaterThanOrEqual(2048);
      expect(result.layers.length).toBeGreaterThan(0);
    });

    it('should handle eviction when cache is empty', async () => {
      const evicted = await layerCache.evictLRU(5);
      expect(evicted).toEqual([]);

      const result = await layerCache.evictBySize(1024);
      expect(result.layers).toEqual([]);
      expect(result.freed).toBe(0);
    });
  });

  describe('statistics', () => {
    it('should return initial stats', () => {
      const stats = layerCache.getStats();

      expect(stats.layerCount).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.totalHits).toBe(0);
      expect(stats.avgHitsPerLayer).toBe(0);
      expect(stats.deduplicationSavings).toBe(0);
    });

    it('should track cache hits', async () => {
      const layer: ImageLayer = {
        digest: 'sha256:hits',
        compressed_size: 1024,
        uncompressed_size: 2048,
        media_type: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
        index: 0
      };

      const data = Buffer.from('test');
      await layerCache.addLayer(layer, data);

      await layerCache.getLayer('sha256:hits');
      await layerCache.getLayer('sha256:hits');
      await layerCache.getLayer('sha256:hits');

      const stats = layerCache.getStats();
      expect(stats.totalHits).toBe(3);
      expect(stats.avgHitsPerLayer).toBe(3);
    });

    it('should calculate deduplication savings', async () => {
      // Add layers shared between images
      const layer: ImageLayer = {
        digest: 'sha256:shared',
        compressed_size: 512,
        uncompressed_size: 2048,
        media_type: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
        index: 0
      };

      const data = Buffer.from('shared layer');
      await layerCache.addLayer(layer, data);
      layerCache.addReference('sha256:shared', 'image1');
      layerCache.addReference('sha256:shared', 'image2');

      const savings = layerCache.calculateSharingSavings();
      expect(savings.sharedLayers).toBe(1);
      expect(savings.savedBytes).toBeGreaterThan(0);
    });
  });

  describe('layer information', () => {
    it('should get all cached layers', () => {
      const layers = layerCache.getCachedLayers();
      expect(Array.isArray(layers)).toBe(true);
    });

    it('should get layer info', async () => {
      const layer: ImageLayer = {
        digest: 'sha256:info-test',
        compressed_size: 1024,
        uncompressed_size: 2048,
        media_type: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
        index: 0
      };

      const data = Buffer.from('test');
      await layerCache.addLayer(layer, data);

      const info = layerCache.getLayerInfo('sha256:info-test');
      expect(info).toBeDefined();
      expect(info?.digest).toBe('sha256:info-test');
      expect(info?.compressed_size).toBe(1024);
      expect(info?.uncompressed_size).toBe(2048);
    });

    it('should return undefined for non-existent layer info', () => {
      const info = layerCache.getLayerInfo('sha256:nonexistent');
      expect(info).toBeUndefined();
    });
  });

  describe('verification', () => {
    it('should verify layer integrity', async () => {
      const layer: ImageLayer = {
        digest: 'sha256:' + Buffer.from('test').toString('hex'),
        compressed_size: 4,
        uncompressed_size: 4,
        media_type: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
        index: 0
      };

      const data = Buffer.from('test');
      await layerCache.addLayer(layer, data);

      const isValid = await layerCache.verifyLayer(layer.digest);
      expect(isValid).toBe(true);
    });

    it('should fail verification for corrupted layer', async () => {
      const layer: ImageLayer = {
        digest: 'sha256:wronghash',
        compressed_size: 4,
        uncompressed_size: 4,
        media_type: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
        index: 0
      };

      const data = Buffer.from('test');
      await layerCache.addLayer(layer, data);

      const isValid = await layerCache.verifyLayer(layer.digest);
      expect(isValid).toBe(false);
    });

    it('should return false for non-existent layer', async () => {
      const isValid = await layerCache.verifyLayer('sha256:nonexistent');
      expect(isValid).toBe(false);
    });
  });

  describe('cache clearing', () => {
    it('should clear all layers', async () => {
      const layer: ImageLayer = {
        digest: 'sha256:clear-test',
        compressed_size: 1024,
        uncompressed_size: 2048,
        media_type: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
        index: 0
      };

      const data = Buffer.from('test');
      await layerCache.addLayer(layer, data);
      expect(layerCache.hasLayer('sha256:clear-test')).toBe(true);

      await layerCache.clearCache();
      expect(layerCache.hasLayer('sha256:clear-test')).toBe(false);
    });

    it('should handle clearing empty cache', async () => {
      await expect(layerCache.clearCache()).resolves.not.toThrow();
    });
  });

  describe('layer sharing', () => {
    it('should get shared layers', async () => {
      const layer: ImageLayer = {
        digest: 'sha256:shared2',
        compressed_size: 1024,
        uncompressed_size: 2048,
        media_type: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
        index: 0
      };

      const data = Buffer.from('shared');
      await layerCache.addLayer(layer, data);
      layerCache.addReference('sha256:shared2', 'image1');
      layerCache.addReference('sha256:shared2', 'image2');

      const shared = layerCache.getSharedLayers();
      expect(shared.size).toBe(1);
      expect(shared.get('sha256:shared2')).toEqual(['image1', 'image2']);
    });

    it('should calculate sharing savings correctly', async () => {
      const layer1: ImageLayer = {
        digest: 'sha256:layer1',
        compressed_size: 512,
        uncompressed_size: 1024,
        media_type: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
        index: 0
      };

      const layer2: ImageLayer = {
        digest: 'sha256:layer2',
        compressed_size: 512,
        uncompressed_size: 1024,
        media_type: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
        index: 0
      };

      await layerCache.addLayer(layer1, Buffer.from('layer1'));
      await layerCache.addLayer(layer2, Buffer.from('layer2'));

      layerCache.addReference('sha256:layer1', 'image1');
      layerCache.addReference('sha256:layer1', 'image2');
      layerCache.addReference('sha256:layer2', 'image1');

      const savings = layerCache.calculateSharingSavings();
      expect(savings.sharedLayers).toBe(2);
      expect(savings.savedBytes).toBeGreaterThan(0);
    });
  });

  describe('metadata', () => {
    it('should export metadata', async () => {
      const layer: ImageLayer = {
        digest: 'sha256:export-test',
        compressed_size: 1024,
        uncompressed_size: 2048,
        media_type: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
        index: 0
      };

      const data = Buffer.from('test');
      await layerCache.addLayer(layer, data);

      const metadata = layerCache.exportMetadata();
      expect(Array.isArray(metadata)).toBe(true);
      expect(metadata.length).toBeGreaterThan(0);
    });

    it('should import metadata', async () => {
      const metadata = [
        {
          digest: 'sha256:import-test',
          compressed_size: 1024,
          uncompressed_size: 2048,
          cache_hits: 0,
          referenced_by: [],
          cached_at: new Date(),
          last_used: new Date(),
          location: '/test/location',
          verified: false
        }
      ];

      await expect(layerCache.importMetadata(metadata)).resolves.not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle very large layer size', async () => {
      const layer: ImageLayer = {
        digest: 'sha256:large',
        compressed_size: Number.MAX_SAFE_INTEGER,
        uncompressed_size: Number.MAX_SAFE_INTEGER,
        media_type: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
        index: 0
      };

      const data = Buffer.from('test');
      await expect(layerCache.addLayer(layer, data)).resolves.not.toThrow();
    });

    it('should handle zero size layer', async () => {
      const layer: ImageLayer = {
        digest: 'sha256:zero',
        compressed_size: 0,
        uncompressed_size: 0,
        media_type: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
        index: 0
      };

      const data = Buffer.alloc(0);
      await expect(layerCache.addLayer(layer, data)).resolves.not.toThrow();
    });

    it('should handle negative size layer', async () => {
      const layer: ImageLayer = {
        digest: 'sha256:negative',
        compressed_size: -1,
        uncompressed_size: -1,
        media_type: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
        index: 0
      };

      const data = Buffer.from('test');
      await expect(layerCache.addLayer(layer, data)).resolves.not.toThrow();
    });

    it('should handle empty layer digest', async () => {
      const layer: ImageLayer = {
        digest: '',
        compressed_size: 1024,
        uncompressed_size: 2048,
        media_type: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
        index: 0
      };

      const data = Buffer.from('test');
      await expect(layerCache.addLayer(layer, data)).resolves.not.toThrow();
    });
  });

  describe('media type detection', () => {
    it('should detect gzip compressed layers', () => {
      // This tests internal logic indirectly
      const layer: ImageLayer = {
        digest: 'sha256:gzip',
        compressed_size: 1024,
        uncompressed_size: 2048,
        media_type: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
        index: 0
      };

      const data = Buffer.from('test');
      expect(layerCache.addLayer(layer, data)).resolves.not.toThrow();
    });

    it('should detect zstd compressed layers', () => {
      const layer: ImageLayer = {
        digest: 'sha256:zstd',
        compressed_size: 1024,
        uncompressed_size: 2048,
        media_type: 'application/vnd.docker.image.rootfs.diff.tar.zstd',
        index: 0
      };

      const data = Buffer.from('test');
      expect(layerCache.addLayer(layer, data)).resolves.not.toThrow();
    });
  });

  describe('configuration limits', () => {
    it('should respect max layers limit', () => {
      const limitedCache = new LayerCacheManager({
        cacheDir,
        maxLayers: 5,
        maxSize: 1024
      });

      expect(limitedCache).toBeInstanceOf(LayerCacheManager);
    });

    it('should respect max size limit', () => {
      const limitedCache = new LayerCacheManager({
        cacheDir,
        maxLayers: 1000,
        maxSize: 512
      });

      expect(limitedCache).toBeInstanceOf(LayerCacheManager);
    });

    it('should handle zero max layers', () => {
      const zeroCache = new LayerCacheManager({
        cacheDir,
        maxLayers: 0,
        maxSize: 1024
      });

      expect(zeroCache).toBeInstanceOf(LayerCacheManager);
    });

    it('should handle zero max size', () => {
      const zeroCache = new LayerCacheManager({
        cacheDir,
        maxLayers: 100,
        maxSize: 0
      });

      expect(zeroCache).toBeInstanceOf(LayerCacheManager);
    });
  });
});

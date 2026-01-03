import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ContainerCache,
  LayerCacheManager,
  PredictiveLoader,
  DockerClient,
  KubernetesClient,
  createContainerCache,
  createDockerClient,
  createKubernetesClient
} from '../src/index.js';
import { mkdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Integration Tests', () => {
  let cacheDir: string;

  beforeEach(async () => {
    cacheDir = join(tmpdir(), `container-cache-integration-${Date.now()}`);
    await mkdir(cacheDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(cacheDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore
    }
  });

  describe('Module exports', () => {
    it('should export ContainerCache', () => {
      expect(ContainerCache).toBeDefined();
      expect(typeof ContainerCache).toBe('function');
    });

    it('should export createContainerCache', () => {
      expect(createContainerCache).toBeDefined();
      expect(typeof createContainerCache).toBe('function');
    });

    it('should export LayerCacheManager', () => {
      expect(LayerCacheManager).toBeDefined();
      expect(typeof LayerCacheManager).toBe('function');
    });

    it('should export PredictiveLoader', () => {
      expect(PredictiveLoader).toBeDefined();
      expect(typeof PredictiveLoader).toBe('function');
    });

    it('should export DockerClient', () => {
      expect(DockerClient).toBeDefined();
      expect(typeof DockerClient).toBe('function');
    });

    it('should export createDockerClient', () => {
      expect(createDockerClient).toBeDefined();
      expect(typeof createDockerClient).toBe('function');
    });

    it('should export KubernetesClient', () => {
      expect(KubernetesClient).toBeDefined();
      expect(typeof KubernetesClient).toBe('function');
    });

    it('should export createKubernetesClient', () => {
      expect(createKubernetesClient).toBeDefined();
      expect(typeof createKubernetesClient).toBe('function');
    });

    it('should export all types', async () => {
      const module = await import('../src/index.js');

      // Check for type exports
      expect(module).toHaveProperty('createContainerCache');
      expect(module).toHaveProperty('ContainerCache');
      expect(module).toHaveProperty('LayerCacheManager');
      expect(module).toHaveProperty('PredictiveLoader');
      expect(module).toHaveProperty('DockerClient');
      expect(module).toHaveProperty('KubernetesClient');
    });
  });

  describe('Container cache integration', () => {
    it('should create and initialize cache', async () => {
      const cache = createContainerCache({
        cache_dir: cacheDir,
        max_size: 1024 * 1024 * 1024,
        predictive_preloading: false
      });

      await cache.initialize();

      const stats = cache.getCacheStats();
      expect(stats.image_count).toBe(0);
      expect(stats.total_hits).toBe(0);
    });

    it('should export and import cache state', async () => {
      const cache = createContainerCache({
        cache_dir: cacheDir,
        predictive_preloading: false
      });

      await cache.initialize();

      // Record some usage
      const loader = new PredictiveLoader();
      loader.recordUsage('python:3.11-slim');
      loader.recordUsage('node:20-alpine');

      // Export state
      const state = cache.exportState();
      expect(state).toBeDefined();
      expect(state.entries).toBeDefined();
      expect(state.metrics).toBeDefined();

      // Import state
      const cache2 = createContainerCache({ cache_dir: join(cacheDir, 'cache2') });
      await cache2.importState({
        entries: state.entries,
        usagePatterns: loader.exportData()
      });

      expect(cache2).toBeDefined();
    });
  });

  describe('Layer cache integration', () => {
    it('should create and initialize layer cache', async () => {
      const layerCache = new LayerCacheManager({
        cacheDir: join(cacheDir, 'layers')
      });

      await layerCache.initialize();

      const stats = layerCache.getStats();
      expect(stats.layerCount).toBe(0);
      expect(stats.totalSize).toBe(0);
    });

    it('should add and retrieve layers', async () => {
      const layerCache = new LayerCacheManager({
        cacheDir: join(cacheDir, 'layers2'),
        verify: false
      });

      await layerCache.initialize();

      const layer = {
        digest: 'sha256:test123',
        compressed_size: 1024,
        uncompressed_size: 2048,
        media_type: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
        index: 0
      };

      const data = Buffer.from('test layer data');

      await layerCache.addLayer(layer, data);
      expect(layerCache.hasLayer('sha256:test123')).toBe(true);

      const retrieved = await layerCache.getLayer('sha256:test123');
      expect(retrieved).not.toBeNull();
    });

    it('should track layer references', async () => {
      const layerCache = new LayerCacheManager({
        cacheDir: join(cacheDir, 'layers3'),
        verify: false
      });

      await layerCache.initialize();

      const layer = {
        digest: 'sha256:ref-test',
        compressed_size: 1024,
        uncompressed_size: 2048,
        media_type: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
        index: 0
      };

      const data = Buffer.from('test');

      await layerCache.addLayer(layer, data);
      layerCache.addReference('sha256:ref-test', 'image1');
      layerCache.addReference('sha256:ref-test', 'image2');

      const info = layerCache.getLayerInfo('sha256:ref-test');
      expect(info?.referenced_by).toContain('image1');
      expect(info?.referenced_by).toContain('image2');
    });
  });

  describe('Predictive loader integration', () => {
    it('should record usage and make predictions', () => {
      const loader = new PredictiveLoader();

      // Record usage
      for (let i = 0; i < 10; i++) {
        loader.recordUsage('python:3.11-slim');
      }

      const stats = loader.getStats();
      expect(stats.totalPatterns).toBe(1);
      expect(stats.totalUsages).toBe(10);

      const pattern = loader.getPattern('python:3.11-slim');
      expect(pattern?.usage_count).toBe(10);

      // Get predictions
      const predictions = loader.predictPreloads();
      expect(Array.isArray(predictions)).toBe(true);
    });

    it('should export and import data', () => {
      const loader1 = new PredictiveLoader();

      loader1.recordUsage('image1');
      loader1.recordUsage('image2');

      const data = loader1.exportData();
      expect(data.patterns).toBeDefined();
      expect(data.usageHistory).toBeDefined();

      const loader2 = new PredictiveLoader();
      loader2.importData(data);

      const stats = loader2.getStats();
      expect(stats.totalPatterns).toBe(2);
    });

    it('should get recommended strategy', () => {
      const loader = new PredictiveLoader();

      for (let i = 0; i < 20; i++) {
        loader.recordUsage('frequently-used');
      }

      const strategy = loader.getRecommendedStrategy('frequently-used');
      expect(['eager', 'predictive', 'lazy', 'on-demand']).toContain(strategy);
    });

    it('should calculate preload priority', () => {
      const loader = new PredictiveLoader();

      for (let i = 0; i < 10; i++) {
        loader.recordUsage('test-image');
      }

      const priority = loader.getPreloadPriority('test-image');
      expect(priority).toBeGreaterThanOrEqual(0);
      expect(priority).toBeLessThanOrEqual(100);
    });
  });

  describe('Docker client integration', () => {
    it('should create Docker client', () => {
      const docker = createDockerClient({
        socketPath: '/var/run/docker.sock'
      });

      expect(docker).toBeInstanceOf(DockerClient);
    });

    it('should have all required methods', () => {
      const docker = createDockerClient();

      expect(typeof docker.pullImage).toBe('function');
      expect(typeof docker.inspectImage).toBe('function');
      expect(typeof docker.createContainer).toBe('function');
      expect(typeof docker.startContainer).toBe('function');
      expect(typeof docker.stopContainer).toBe('function');
      expect(typeof docker.removeContainer).toBe('function');
    });
  });

  describe('Kubernetes client integration', () => {
    it('should create Kubernetes client', () => {
      const k8s = createKubernetesClient({
        namespace: 'default'
      });

      expect(k8s).toBeInstanceOf(KubernetesClient);
    });

    it('should have all required methods', () => {
      const k8s = createKubernetesClient();

      expect(typeof k8s.listPods).toBe('function');
      expect(typeof k8s.getPod).toBe('function');
      expect(typeof k8s.createPod).toBe('function');
      expect(typeof k8s.deletePod).toBe('function');
      expect(typeof k8s.createDeployment).toBe('function');
      expect(typeof k8s.scaleDeployment).toBe('function');
    });
  });

  describe('End-to-end workflow', () => {
    it('should simulate complete caching workflow', async () => {
      // Create cache
      const cache = createContainerCache({
        cache_dir: cacheDir,
        max_size: 1024 * 1024 * 1024,
        predictive_preloading: false
      });

      await cache.initialize();

      // Create predictive loader
      const loader = new PredictiveLoader();

      // Record usage patterns
      loader.recordUsage('python:3.11-slim');
      loader.recordUsage('python:3.11-slim');
      loader.recordUsage('node:20-alpine');

      // Get predictions
      const predictions = loader.predictPreloads();
      expect(Array.isArray(predictions)).toBe(true);

      // Check cache stats
      const stats = cache.getCacheStats();
      expect(stats.image_count).toBe(0);
      expect(stats.hit_rate).toBe(0);

      // Create layer cache
      const layerCache = new LayerCacheManager({
        cacheDir: join(cacheDir, 'layers'),
        verify: false
      });

      await layerCache.initialize();

      // Add a test layer
      const layer = {
        digest: 'sha256:e2e-test',
        compressed_size: 512,
        uncompressed_size: 1024,
        media_type: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
        index: 0
      };

      await layerCache.addLayer(layer, Buffer.from('test'));
      expect(layerCache.hasLayer('sha256:e2e-test')).toBe(true);

      // Get layer stats
      const layerStats = layerCache.getStats();
      expect(layerStats.layerCount).toBe(1);

      // Export and import state
      const state = cache.exportState();
      expect(state).toBeDefined();

      await cache.clearCache();
      await layerCache.clearCache();
    });

    it('should simulate layer sharing workflow', async () => {
      const layerCache = new LayerCacheManager({
        cacheDir: join(cacheDir, 'shared-layers'),
        verify: false
      });

      await layerCache.initialize();

      // Add shared layer
      const sharedLayer = {
        digest: 'sha256:shared-base',
        compressed_size: 1024,
        uncompressed_size: 2048,
        media_type: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
        index: 0
      };

      await layerCache.addLayer(sharedLayer, Buffer.from('shared base layer'));

      // Add references from multiple images
      layerCache.addReference('sha256:shared-base', 'python:3.11-slim');
      layerCache.addReference('sha256:shared-base', 'python:3.12-slim');
      layerCache.addReference('sha256:shared-base', 'python:3.13-rc');

      // Calculate savings
      const savings = layerCache.calculateSharingSavings();
      expect(savings.sharedLayers).toBe(1);
      expect(savings.savedBytes).toBeGreaterThan(0);
    });
  });

  describe('Error handling integration', () => {
    it('should handle missing cache directory gracefully', async () => {
      const cache = createContainerCache({
        cache_dir: join(cacheDir, 'nonexistent', 'subdir'),
        predictive_preloading: false
      });

      // Should create directory during initialization
      await expect(cache.initialize()).resolves.not.toThrow();
    });

    it('should handle invalid cache state import', async () => {
      const cache = createContainerCache({
        cache_dir: cacheDir,
        predictive_preloading: false
      });

      await cache.initialize();

      // Import invalid state
      await expect(cache.importState({})).resolves.not.toThrow();
    });

    it('should handle layer cache errors gracefully', async () => {
      const layerCache = new LayerCacheManager({
        cacheDir: join(cacheDir, 'error-test')
      });

      await layerCache.initialize();

      // Try to get non-existent layer
      const result = await layerCache.getLayer('sha256:nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('Performance integration', () => {
    it('should handle many layers efficiently', async () => {
      const layerCache = new LayerCacheManager({
        cacheDir: join(cacheDir, 'perf-test'),
        verify: false
      });

      await layerCache.initialize();

      const startTime = Date.now();

      // Add many layers
      for (let i = 0; i < 100; i++) {
        const layer = {
          digest: `sha256:layer${i}`,
          compressed_size: 1024,
          uncompressed_size: 2048,
          media_type: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
          index: i
        };

        await layerCache.addLayer(layer, Buffer.from(`layer data ${i}`));
      }

      const duration = Date.now() - startTime;

      // Should complete in reasonable time (< 5 seconds for 100 layers)
      expect(duration).toBeLessThan(5000);

      const stats = layerCache.getStats();
      expect(stats.layerCount).toBe(100);
    });

    it('should handle many usage records efficiently', () => {
      const loader = new PredictiveLoader({
        maxHistorySize: 10000
      });

      const startTime = Date.now();

      // Record many usages
      for (let i = 0; i < 1000; i++) {
        loader.recordUsage(`image${i % 10}`);
      }

      const duration = Date.now() - startTime;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(1000);

      const stats = loader.getStats();
      expect(stats.totalUsages).toBe(1000);
    });
  });

  describe('Configuration integration', () => {
    it('should respect custom configuration', async () => {
      const cache = createContainerCache({
        cache_dir: cacheDir,
        max_size: 512 * 1024 * 1024,
        max_images: 50,
        default_strategy: 'eager',
        lru_eviction: false,
        size_eviction: true,
        layer_deduplication: false,
        predictive_preloading: false
      });

      await cache.initialize();

      const stats = cache.getCacheStats();
      expect(stats.max_size).toBe(512 * 1024 * 1024);
    });

    it('should use default configuration when not specified', async () => {
      const cache = createContainerCache({
        cache_dir: cacheDir,
        predictive_preloading: false
      });

      await cache.initialize();

      const stats = cache.getCacheStats();
      expect(stats.max_size).toBeGreaterThan(0);
    });
  });

  describe('Type consistency', () => {
    it('should maintain type consistency across modules', async () => {
      const cache = createContainerCache({
        cache_dir: cacheDir,
        predictive_preloading: false
      });

      await cache.initialize();

      // Get stats - should return proper CacheMetrics type
      const stats = cache.getCacheStats();
      expect(typeof stats.hit_rate).toBe('number');
      expect(typeof stats.image_count).toBe('number');
      expect(typeof stats.total_size).toBe('number');

      // Get cached images - should return string array
      const images = cache.getCachedImages();
      expect(Array.isArray(images)).toBe(true);
    });
  });

  describe('Memory management', () => {
    it('should properly clear all resources', async () => {
      const cache = createContainerCache({
        cache_dir: cacheDir,
        predictive_preloading: false
      });

      await cache.initialize();

      const layerCache = new LayerCacheManager({
        cacheDir: join(cacheDir, 'layers'),
        verify: false
      });

      await layerCache.initialize();

      // Add some data
      const layer = {
        digest: 'sha256:mem-test',
        compressed_size: 1024,
        uncompressed_size: 2048,
        media_type: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
        index: 0
      };

      await layerCache.addLayer(layer, Buffer.from('test'));

      // Clear everything
      await cache.clearCache();
      await layerCache.clearCache();

      // Verify empty
      const cacheStats = cache.getCacheStats();
      const layerStats = layerCache.getStats();

      expect(cacheStats.image_count).toBe(0);
      expect(layerStats.layerCount).toBe(0);
    });
  });
});

import { describe, it, expect } from 'vitest';
import type {
  ContainerImage,
  ImageLayer,
  CacheStrategy,
  CacheEntry,
  LayerCache,
  CacheMetrics,
  PreloadPrediction,
  UsagePattern,
  CacheConfig,
  PullProgress,
  DockerOptions,
  KubernetesOptions,
  PodTemplate,
  ContainerSpec,
  ResourceRequirements,
  WarmupResult,
  EvictionResult
} from '../src/types.js';

describe('Types', () => {
  describe('ContainerImage', () => {
    it('should have correct properties', () => {
      const image: ContainerImage = {
        repository: 'library/python',
        tag: '3.11-slim',
        digest: 'sha256:abc123',
        size: 100000000,
        layers: [],
        ref: 'python:3.11-slim',
        created_at: new Date(),
        architecture: 'amd64',
        os: 'linux'
      };

      expect(image.repository).toBe('library/python');
      expect(image.tag).toBe('3.11-slim');
      expect(image.size).toBe(100000000);
      expect(image.layers).toEqual([]);
      expect(image.ref).toBe('python:3.11-slim');
      expect(image.architecture).toBe('amd64');
      expect(image.os).toBe('linux');
    });

    it('should accept optional properties', () => {
      const image: ContainerImage = {
        repository: 'library/node',
        tag: '20-alpine',
        digest: 'sha256:def456',
        size: 50000000,
        layers: [],
        ref: 'node:20-alpine',
        created_at: new Date(),
        architecture: 'arm64',
        os: 'linux',
        env: { NODE_ENV: 'production' },
        cmd: ['node'],
        entrypoint: ['npm', 'start']
      };

      expect(image.env).toBeDefined();
      expect(image.cmd).toBeDefined();
      expect(image.entrypoint).toBeDefined();
    });
  });

  describe('ImageLayer', () => {
    it('should have correct properties', () => {
      const layer: ImageLayer = {
        digest: 'sha256:layer123',
        compressed_size: 1024000,
        uncompressed_size: 2048000,
        media_type: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
        index: 0
      };

      expect(layer.digest).toBe('sha256:layer123');
      expect(layer.compressed_size).toBe(1024000);
      expect(layer.uncompressed_size).toBe(2048000);
      expect(layer.media_type).toContain('gzip');
      expect(layer.index).toBe(0);
    });
  });

  describe('CacheStrategy', () => {
    it('should accept all strategy values', () => {
      const strategies: CacheStrategy[] = ['eager', 'lazy', 'predictive', 'on-demand'];

      strategies.forEach(strategy => {
        expect(['eager', 'lazy', 'predictive', 'on-demand']).toContain(strategy);
      });
    });
  });

  describe('CacheEntry', () => {
    it('should have correct properties', () => {
      const image: ContainerImage = {
        repository: 'test',
        tag: 'latest',
        digest: 'sha256:test',
        size: 1000,
        layers: [],
        ref: 'test:latest',
        created_at: new Date(),
        architecture: 'amd64',
        os: 'linux'
      };

      const entry: CacheEntry = {
        id: 'entry-123',
        image_ref: 'test:latest',
        image,
        cached_at: new Date(),
        last_used: new Date(),
        access_count: 5,
        size_bytes: 1000,
        strategy: 'eager',
        priority: 80,
        verified: true
      };

      expect(entry.id).toBe('entry-123');
      expect(entry.image_ref).toBe('test:latest');
      expect(entry.access_count).toBe(5);
      expect(entry.strategy).toBe('eager');
      expect(entry.priority).toBe(80);
      expect(entry.verified).toBe(true);
    });
  });

  describe('LayerCache', () => {
    it('should have correct properties', () => {
      const cache: LayerCache = {
        digest: 'sha256:layer',
        compressed_size: 1000,
        uncompressed_size: 2000,
        cache_hits: 10,
        referenced_by: ['image1', 'image2'],
        cached_at: new Date(),
        last_used: new Date(),
        location: '/path/to/layer',
        verified: true
      };

      expect(cache.digest).toBe('sha256:layer');
      expect(cache.cache_hits).toBe(10);
      expect(cache.referenced_by).toHaveLength(2);
      expect(cache.verified).toBe(true);
    });
  });

  describe('CacheMetrics', () => {
    it('should have correct properties', () => {
      const metrics: CacheMetrics = {
        hit_rate: 0.8,
        miss_rate: 0.2,
        total_hits: 800,
        total_misses: 200,
        total_size: 1000000000,
        max_size: 50000000000,
        image_count: 10,
        layer_count: 50,
        eviction_rate: 0.1,
        total_evictions: 5,
        avg_access_time: 50,
        compression_ratio: 0.4
      };

      expect(metrics.hit_rate + metrics.miss_rate).toBeCloseTo(1.0);
      expect(metrics.total_hits + metrics.total_misses).toBe(1000);
      expect(metrics.image_count).toBe(10);
      expect(metrics.layer_count).toBe(50);
      expect(metrics.compression_ratio).toBeLessThanOrEqual(1);
    });
  });

  describe('PreloadPrediction', () => {
    it('should have correct properties', () => {
      const prediction: PreloadPrediction = {
        image_ref: 'python:3.11-slim',
        probability: 0.85,
        predicted_time: new Date(),
        confidence: 0.9,
        reason: 'high usage frequency'
      };

      expect(prediction.image_ref).toBe('python:3.11-slim');
      expect(prediction.probability).toBeGreaterThan(0);
      expect(prediction.probability).toBeLessThanOrEqual(1);
      expect(prediction.confidence).toBeGreaterThan(0);
      expect(prediction.confidence).toBeLessThanOrEqual(1);
      expect(prediction.reason).toBeDefined();
    });
  });

  describe('UsagePattern', () => {
    it('should have correct properties', () => {
      const pattern: UsagePattern = {
        image_ref: 'node:20-alpine',
        usage_count: 100,
        window_start: new Date('2025-01-01'),
        window_end: new Date('2025-01-31'),
        avg_interval: 3600000,
        interval_stddev: 600000,
        peak_hours: new Array(24).fill(0),
        day_patterns: new Array(7).fill(0)
      };

      expect(pattern.image_ref).toBe('node:20-alpine');
      expect(pattern.usage_count).toBe(100);
      expect(pattern.avg_interval).toBe(3600000);
      expect(pattern.peak_hours).toHaveLength(24);
      expect(pattern.day_patterns).toHaveLength(7);
    });
  });

  describe('CacheConfig', () => {
    it('should have correct properties', () => {
      const config: CacheConfig = {
        max_size: 50000000000,
        max_images: 100,
        default_strategy: 'lazy',
        lru_eviction: true,
        size_eviction: true,
        layer_deduplication: true,
        cache_dir: '/var/lib/cache',
        verify_integrity: true,
        compress_layers: true,
        predictive_preloading: true,
        prediction_window: 24,
        min_preload_probability: 0.6,
        preload_check_interval: 300000
      };

      expect(config.max_size).toBe(50000000000);
      expect(config.max_images).toBe(100);
      expect(config.default_strategy).toBe('lazy');
      expect(config.lru_eviction).toBe(true);
      expect(config.size_eviction).toBe(true);
    });
  });

  describe('PullProgress', () => {
    it('should have correct properties', () => {
      const progress: PullProgress = {
        image_ref: 'python:3.11-slim',
        current_layer: 'sha256:layer123',
        layers_completed: 5,
        total_layers: 10,
        bytes_downloaded: 50000000,
        total_bytes: 100000000,
        progress: 50,
        status: 'pulling'
      };

      expect(progress.image_ref).toBe('python:3.11-slim');
      expect(progress.progress).toBe(50);
      expect(progress.status).toBe('pulling');
      expect(progress.layers_completed).toBeLessThanOrEqual(progress.total_layers);
    });

    it('should support all status values', () => {
      const statuses: PullProgress['status'][] = [
        'pulling',
        'verifying',
        'extracting',
        'complete',
        'failed'
      ];

      statuses.forEach(status => {
        const progress: PullProgress = {
          image_ref: 'test:latest',
          layers_completed: 0,
          total_layers: 0,
          bytes_downloaded: 0,
          total_bytes: 0,
          progress: 0,
          status
        };
        expect(progress.status).toBe(status);
      });
    });

    it('should accept optional error property', () => {
      const progress: PullProgress = {
        image_ref: 'test:latest',
        layers_completed: 0,
        total_layers: 0,
        bytes_downloaded: 0,
        total_bytes: 0,
        progress: 0,
        status: 'failed',
        error: 'Network error'
      };

      expect(progress.error).toBeDefined();
    });
  });

  describe('DockerOptions', () => {
    it('should accept all optional properties', () => {
      const options: DockerOptions = {
        socketPath: '/var/run/docker.sock',
        host: 'http://localhost:2375',
        version: 'v1.43',
        timeout: 120000,
        tls: {}
      };

      expect(options.socketPath).toBeDefined();
      expect(options.host).toBeDefined();
      expect(options.version).toBeDefined();
      expect(options.timeout).toBeDefined();
      expect(options.tls).toBeDefined();
    });

    it('should accept empty options', () => {
      const options: DockerOptions = {};
      expect(Object.keys(options)).toHaveLength(0);
    });
  });

  describe('KubernetesOptions', () => {
    it('should accept all optional properties', () => {
      const options: KubernetesOptions = {
        kubeconfig: '/path/to/kubeconfig',
        context: 'minikube',
        cluster: 'my-cluster',
        namespace: 'default',
        timeout: 60000
      };

      expect(options.kubeconfig).toBeDefined();
      expect(options.context).toBeDefined();
      expect(options.cluster).toBeDefined();
      expect(options.namespace).toBeDefined();
      expect(options.timeout).toBeDefined();
    });

    it('should accept empty options', () => {
      const options: KubernetesOptions = {};
      expect(Object.keys(options)).toHaveLength(0);
    });
  });

  describe('PodTemplate', () => {
    it('should have correct properties', () => {
      const template: PodTemplate = {
        name: 'test-pod',
        namespace: 'default',
        containers: [
          {
            name: 'test-container',
            image: 'nginx:latest'
          }
        ]
      };

      expect(template.name).toBe('test-pod');
      expect(template.namespace).toBe('default');
      expect(template.containers).toHaveLength(1);
    });

    it('should accept optional properties', () => {
      const template: PodTemplate = {
        name: 'test-pod',
        namespace: 'default',
        containers: [
          {
            name: 'test-container',
            image: 'nginx:latest'
          }
        ],
        node_selector: { 'node-type': 'worker' },
        resources: {
          cpu_request: '100m',
          memory_request: '128Mi'
        }
      };

      expect(template.node_selector).toBeDefined();
      expect(template.resources).toBeDefined();
    });
  });

  describe('ContainerSpec', () => {
    it('should have required properties', () => {
      const spec: ContainerSpec = {
        name: 'test',
        image: 'nginx:latest'
      };

      expect(spec.name).toBe('test');
      expect(spec.image).toBe('nginx:latest');
    });

    it('should accept optional properties', () => {
      const spec: ContainerSpec = {
        name: 'test',
        image: 'nginx:latest',
        command: ['/bin/sh'],
        args: ['-c', 'echo hello'],
        env: [{ name: 'TEST', value: 'value' }],
        resources: {
          cpu_request: '100m',
          cpu_limit: '500m'
        },
        volume_mounts: [
          {
            name: 'data',
            mountPath: '/data'
          }
        ]
      };

      expect(spec.command).toBeDefined();
      expect(spec.args).toBeDefined();
      expect(spec.env).toBeDefined();
      expect(spec.resources).toBeDefined();
      expect(spec.volume_mounts).toBeDefined();
    });
  });

  describe('ResourceRequirements', () => {
    it('should accept CPU requirements', () => {
      const resources: ResourceRequirements = {
        cpu_request: '100m',
        cpu_limit: '500m'
      };

      expect(resources.cpu_request).toBe('100m');
      expect(resources.cpu_limit).toBe('500m');
    });

    it('should accept memory requirements', () => {
      const resources: ResourceRequirements = {
        memory_request: '128Mi',
        memory_limit: '512Mi'
      };

      expect(resources.memory_request).toBe('128Mi');
      expect(resources.memory_limit).toBe('512Mi');
    });

    it('should accept all resource types', () => {
      const resources: ResourceRequirements = {
        cpu_request: '100m',
        cpu_limit: '500m',
        memory_request: '128Mi',
        memory_limit: '512Mi'
      };

      expect(resources.cpu_request).toBeDefined();
      expect(resources.memory_limit).toBeDefined();
    });
  });

  describe('WarmupResult', () => {
    it('should have correct properties', () => {
      const result: WarmupResult = {
        warmed: ['image1', 'image2'],
        failed: [{ image: 'image3', error: 'Network error' }],
        cached: ['image4'],
        duration_ms: 5000,
        bytes_downloaded: 50000000
      };

      expect(result.warmed).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.cached).toHaveLength(1);
      expect(result.duration_ms).toBe(5000);
      expect(result.bytes_downloaded).toBe(50000000);
    });

    it('should handle empty results', () => {
      const result: WarmupResult = {
        warmed: [],
        failed: [],
        cached: [],
        duration_ms: 0,
        bytes_downloaded: 0
      };

      expect(result.warmed).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
      expect(result.cached).toHaveLength(0);
    });
  });

  describe('EvictionResult', () => {
    it('should have correct properties', () => {
      const result: EvictionResult = {
        evicted_images: ['image1', 'image2'],
        evicted_layers: ['sha256:layer1', 'sha256:layer2'],
        bytes_freed: 100000000,
        duration_ms: 1000
      };

      expect(result.evicted_images).toHaveLength(2);
      expect(result.evicted_layers).toHaveLength(2);
      expect(result.bytes_freed).toBe(100000000);
      expect(result.duration_ms).toBe(1000);
    });

    it('should handle empty eviction', () => {
      const result: EvictionResult = {
        evicted_images: [],
        evicted_layers: [],
        bytes_freed: 0,
        duration_ms: 0
      };

      expect(result.evicted_images).toHaveLength(0);
      expect(result.bytes_freed).toBe(0);
    });
  });

  describe('type constraints', () => {
    it('should enforce number ranges', () => {
      const metrics: CacheMetrics = {
        hit_rate: 0.5,
        miss_rate: 0.5,
        total_hits: 100,
        total_misses: 100,
        total_size: 1000,
        max_size: 10000,
        image_count: 10,
        layer_count: 50,
        eviction_rate: 0.1,
        total_evictions: 5,
        avg_access_time: 100,
        compression_ratio: 0.3
      };

      expect(metrics.hit_rate).toBeGreaterThanOrEqual(0);
      expect(metrics.hit_rate).toBeLessThanOrEqual(1);
      expect(metrics.miss_rate).toBeGreaterThanOrEqual(0);
      expect(metrics.miss_rate).toBeLessThanOrEqual(1);
      expect(metrics.compression_ratio).toBeGreaterThanOrEqual(0);
      expect(metrics.compression_ratio).toBeLessThanOrEqual(1);
    });

    it('should enforce array lengths', () => {
      const pattern: UsagePattern = {
        image_ref: 'test',
        usage_count: 10,
        window_start: new Date(),
        window_end: new Date(),
        avg_interval: 1000,
        interval_stddev: 100,
        peak_hours: new Array(24).fill(0),
        day_patterns: new Array(7).fill(0)
      };

      expect(pattern.peak_hours).toHaveLength(24);
      expect(pattern.day_patterns).toHaveLength(7);
    });

    it('should enforce priority range', () => {
      const entry: CacheEntry = {
        id: 'test',
        image_ref: 'test:latest',
        image: {
          repository: 'test',
          tag: 'latest',
          digest: 'sha256:test',
          size: 1000,
          layers: [],
          ref: 'test:latest',
          created_at: new Date(),
          architecture: 'amd64',
          os: 'linux'
        },
        cached_at: new Date(),
        last_used: new Date(),
        access_count: 1,
        size_bytes: 1000,
        strategy: 'lazy',
        priority: 75,
        verified: true
      };

      expect(entry.priority).toBeGreaterThanOrEqual(0);
      expect(entry.priority).toBeLessThanOrEqual(100);
    });
  });

  describe('edge cases', () => {
    it('should handle zero values', () => {
      const metrics: CacheMetrics = {
        hit_rate: 0,
        miss_rate: 0,
        total_hits: 0,
        total_misses: 0,
        total_size: 0,
        max_size: 0,
        image_count: 0,
        layer_count: 0,
        eviction_rate: 0,
        total_evictions: 0,
        avg_access_time: 0,
        compression_ratio: 0
      };

      expect(metrics.hit_rate).toBe(0);
      expect(metrics.total_hits).toBe(0);
    });

    it('should handle maximum values', () => {
      const config: CacheConfig = {
        max_size: Number.MAX_SAFE_INTEGER,
        max_images: Number.MAX_SAFE_INTEGER,
        default_strategy: 'lazy',
        lru_eviction: true,
        size_eviction: true,
        layer_deduplication: true,
        cache_dir: '/var/lib/cache',
        verify_integrity: true,
        compress_layers: true,
        predictive_preloading: true,
        prediction_window: 24,
        min_preload_probability: 1.0,
        preload_check_interval: Number.MAX_SAFE_INTEGER
      };

      expect(config.max_size).toBe(Number.MAX_SAFE_INTEGER);
      expect(config.max_images).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle negative values where applicable', () => {
      const progress: PullProgress = {
        image_ref: 'test:latest',
        layers_completed: 0,
        total_layers: 0,
        bytes_downloaded: 0,
        total_bytes: 0,
        progress: 0,
        status: 'pulling'
      };

      // Progress should be non-negative
      expect(progress.progress).toBeGreaterThanOrEqual(0);
      expect(progress.bytes_downloaded).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Date objects', () => {
    it('should accept Date instances', () => {
      const now = new Date();

      const entry: CacheEntry = {
        id: 'test',
        image_ref: 'test:latest',
        image: {
          repository: 'test',
          tag: 'latest',
          digest: 'sha256:test',
          size: 1000,
          layers: [],
          ref: 'test:latest',
          created_at: now,
          architecture: 'amd64',
          os: 'linux'
        },
        cached_at: now,
        last_used: now,
        access_count: 1,
        size_bytes: 1000,
        strategy: 'lazy',
        priority: 50,
        verified: true
      };

      expect(entry.image.created_at).toBeInstanceOf(Date);
      expect(entry.cached_at).toBeInstanceOf(Date);
      expect(entry.last_used).toBeInstanceOf(Date);
    });
  });
});

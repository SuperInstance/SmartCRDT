/**
 * @lsi/container-cache
 *
 * Container image caching and preloading for zero cold start worker pools.
 *
 * @example
 * ```typescript
 * import { createContainerCache } from '@lsi/container-cache';
 *
 * const cache = createContainerCache({
 *   max_size: 50 * 1024 * 1024 * 1024, // 50GB
 *   cache_dir: '/var/lib/container-cache',
 *   predictive_preloading: true
 * });
 *
 * await cache.initialize();
 * await cache.preloadImage('python:3.11-slim');
 *
 * const image = await cache.getImage('python:3.11-slim');
 * console.log('Image cached:', image?.ref);
 * ```
 */

// Types
export type {
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
  EvictionResult,
} from "./types.js";

// Container Cache
export { ContainerCache, createContainerCache } from "./ContainerCache.js";

// Layer Cache
export { LayerCacheManager } from "./LayerCache.js";

// Predictive Loader
export { PredictiveLoader } from "./PredictiveLoader.js";

// Docker Integration
export { DockerClient, createDockerClient } from "./docker.js";

// Kubernetes Integration
export { KubernetesClient, createKubernetesClient } from "./kubernetes.js";

/**
 * VectorDBFactory - Factory for creating vector database adapters
 *
 * Provides a unified interface for instantiating different vector database backends.
 * Supports automatic fallback, health checking, and configuration management.
 *
 * @packageDocumentation
 */

import type {
  IVectorDatabaseAdapter,
  VectorDatabaseConfig,
  VectorDatabaseFactoryConfig,
  AdapterSelection,
  PineconeConfig,
  WeaviateConfig,
  QdrantConfig,
  MilvusConfig,
  MemoryConfig,
} from "@lsi/protocol";

import { PineconeAdapter } from "./adapters/PineconeAdapter.js";
import { WeaviateAdapter } from "./adapters/WeaviateAdapter.js";

/**
 * Vector database factory
 *
 * Manages creation and selection of vector database adapters.
 */
export class VectorDBFactory {
  private configs: Map<string, VectorDatabaseConfig> = new Map();
  private adapters: Map<string, IVectorDatabaseAdapter> = new Map();
  private defaultBackend: VectorDatabaseConfig["backend"];

  constructor(factoryConfig: VectorDatabaseFactoryConfig) {
    // Store configurations
    for (const config of factoryConfig.adapters) {
      const fullConfig: VectorDatabaseConfig = {
        ...config,
        credentials: config.credentials ?? {},
        connection: config.connection ?? {},
      };
      this.configs.set(config.name, fullConfig);
    }

    this.defaultBackend = factoryConfig.defaultAdapter ?? "memory";
  }

  /**
   * Create an adapter by name
   */
  async createAdapter(name: string): Promise<IVectorDatabaseAdapter> {
    const config = this.configs.get(name);

    if (!config) {
      throw new Error(`Unknown adapter configuration: ${name}`);
    }

    return this.createAdapterFromConfig(config);
  }

  /**
   * Create adapter from configuration
   */
  async createAdapterFromConfig(config: VectorDatabaseConfig): Promise<IVectorDatabaseAdapter> {
    const cacheKey = this.getCacheKey(config);

    // Check if adapter already exists
    if (this.adapters.has(cacheKey)) {
      return this.adapters.get(cacheKey)!;
    }

    // Create new adapter
    let adapter: IVectorDatabaseAdapter;

    switch (config.backend) {
      case "pinecone":
        adapter = new PineconeAdapter(config as PineconeConfig);
        break;
      case "weaviate":
        adapter = new WeaviateAdapter(config as WeaviateConfig);
        break;
      case "qdrant":
        // QdrantAdapter not yet implemented
        throw new Error("Qdrant adapter not yet implemented");
      case "milvus":
        // MilvusAdapter not yet implemented
        throw new Error("Milvus adapter not yet implemented");
      case "memory":
      case "hnsw":
        // Use in-memory adapter from VectorDatabase class
        const { VectorDatabase } = await import("./VectorDatabase.js");
        adapter = this.wrapVectorDatabase(
          new VectorDatabase({ dimension: config.dimension })
        );
        break;
      default:
        throw new Error(`Unknown backend type: ${config.backend}`);
    }

    // Initialize adapter
    await adapter.initialize();

    // Cache adapter
    this.adapters.set(cacheKey, adapter);

    return adapter;
  }

  /**
   * Select best adapter based on health and performance
   */
  async selectAdapter(): Promise<AdapterSelection> {
    const availableBackends = Array.from(this.configs.values());

    if (availableBackends.length === 0) {
      throw new Error("No adapter configurations available");
    }

    // If only one backend, use it
    if (availableBackends.length === 1) {
      const config = availableBackends[0];
      const adapter = await this.createAdapterFromConfig(config);
      return {
        adapter,
        name: this.getConfigName(config),
        reason: "Only available backend",
        confidence: 1.0,
      };
    }

    // Check health of all backends
    const healthChecks = await Promise.all(
      availableBackends.map(async (config) => {
        try {
          const adapter = await this.createAdapterFromConfig(config);
          const health = await adapter.healthCheck();
          return {
            config,
            health,
            name: this.getConfigName(config),
          };
        } catch (error) {
          return {
            config,
            health: {
              healthy: false,
              latency: -1,
              error: error instanceof Error ? error.message : "Unknown error",
            },
            name: this.getConfigName(config),
          };
        }
      })
    );

    // Filter healthy backends
    const healthyBackends = healthChecks.filter((hc) => hc.health.healthy);

    if (healthyBackends.length === 0) {
      // Fall back to unhealthy backend with lowest latency
      const sortedByLatency = healthChecks.sort(
        (a, b) => a.health.latency - b.health.latency
      );
      const selected = sortedByLatency[0];

      const adapter = await this.createAdapterFromConfig(selected.config);

      return {
        adapter,
        name: selected.name,
        reason: `Fallback (all backends unhealthy, selected ${selected.name})`,
        confidence: 0.3,
      };
    }

    // Select healthy backend with lowest latency
    const sortedHealthy = healthyBackends.sort(
      (a, b) => a.health.latency - b.health.latency
    );
    const selected = sortedHealthy[0];

    const adapter = await this.createAdapterFromConfig(selected.config);

    return {
      adapter,
      name: selected.name,
      reason: `Selected ${selected.name} (healthy, latency: ${selected.health.latency}ms)`,
      confidence: 0.9,
    };
  }

  /**
   * Create adapter with automatic fallback
   */
  async createAdapterWithFallback(
    preferredBackends?: VectorDatabaseConfig["backend"][]
  ): Promise<IVectorDatabaseAdapter> {
    const backendsToTry = preferredBackends ?? [this.defaultBackend];

    for (const backend of backendsToTry) {
      try {
        // Find config for this backend
        const config = Array.from(this.configs.values()).find((c) => c.backend === backend);

        if (!config) {
          continue;
        }

        const adapter = await this.createAdapterFromConfig(config);
        const health = await adapter.healthCheck();

        if (health.healthy) {
          return adapter;
        }
      } catch (error) {
        // Try next backend
        continue;
      }
    }

    // All backends failed, throw error
    throw new Error(
      `Failed to create adapter with fallback. Tried: ${backendsToTry.join(", ")}`
    );
  }

  /**
   * Get all available configurations
   */
  getConfigs(): Array<Omit<VectorDatabaseConfig, "credentials">> {
    return Array.from(this.configs.values()).map(({ credentials, ...config }) => config);
  }

  /**
   * Get configuration by name
   */
  getConfig(name: string): Omit<VectorDatabaseConfig, "credentials"> | null {
    const config = this.configs.get(name);
    if (!config) {
      return null;
    }
    const { credentials, ...safeConfig } = config;
    return safeConfig;
  }

  /**
   * Check health of all adapters
   */
  async checkAllHealth(): Promise<
    Array<{ name: string; backend: string; healthy: boolean; latency: number }>
  > {
    const results = await Promise.all(
      Array.from(this.configs.entries()).map(async ([name, config]) => {
        try {
          const adapter = await this.createAdapter(name);
          const health = await adapter.healthCheck();
          return {
            name,
            backend: config.backend,
            healthy: health.healthy,
            latency: health.latency,
          };
        } catch (error) {
          return {
            name,
            backend: config.backend,
            healthy: false,
            latency: -1,
          };
        }
      })
    );

    return results;
  }

  /**
   * Close all adapters
   */
  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.adapters.values()).map((adapter) =>
      adapter.close().catch(() => {})
    );

    await Promise.all(closePromises);
    this.adapters.clear();
  }

  /**
   * Get cache key for configuration
   */
  private getCacheKey(config: VectorDatabaseConfig): string {
    return `${config.backend}:${config.dimension}`;
  }

  /**
   * Get configuration name
   */
  private getConfigName(config: VectorDatabaseConfig): string {
    for (const [name, cfg] of this.configs.entries()) {
      if (cfg === config) {
        return name;
      }
    }
    return config.backend;
  }

  /**
   * Wrap in-memory VectorDatabase as IVectorDatabaseAdapter
   */
  private wrapVectorDatabase(vectorDb: any): IVectorDatabaseAdapter {
    return {
      async initialize() {
        // No-op for in-memory
      },
      async healthCheck() {
        return {
          healthy: true,
          latency: 0,
          status: "in-memory",
        };
      },
      async getStats() {
        return {
          totalVectors: vectorDb.size(),
          totalNamespaces: 0,
          dimension: vectorDb.getStats().dimension,
          indexType: "hnsw",
        };
      },
      async createNamespace() {
        // No-op for in-memory
      },
      async deleteNamespace() {
        // No-op for in-memory
      },
      async listNamespaces() {
        return [];
      },
      async namespaceExists() {
        return false;
      },
      async upsert(record: any) {
        vectorDb.add(record.id, record.vector, record.metadata);
      },
      async upsertBatch(records: any[]) {
        for (const record of records) {
          vectorDb.add(record.id, record.vector, record.metadata);
        }
        return { succeeded: records.length, failed: 0, errors: [] };
      },
      async get(id: string) {
        const vector = vectorDb.get(id);
        if (!vector) return null;
        return {
          id,
          vector,
          metadata: vectorDb.getMetadata(id),
        };
      },
      async getBatch(ids: string[]) {
        const results = [];
        for (const id of ids) {
          const vector = vectorDb.get(id);
          if (vector) {
            results.push({
              id,
              vector,
              metadata: vectorDb.getMetadata(id),
            });
          }
        }
        return results;
      },
      async delete(id: string) {
        return vectorDb.delete(id);
      },
      async deleteBatch(ids: string[]) {
        let succeeded = 0;
        let failed = 0;
        const errors: any[] = [];

        for (const id of ids) {
          if (vectorDb.delete(id)) {
            succeeded++;
          } else {
            failed++;
          }
        }

        return { succeeded, failed, errors };
      },
      async search(query: Float32Array, options: any) {
        const results = await vectorDb.search(query, options.topK);
        return results.map((r: any) => ({
          id: r.id,
          score: r.score,
          metadata: r.metadata,
        }));
      },
      async searchBatch(queries: Float32Array[], options: any) {
        return await vectorDb.searchBatch(queries, options.topK);
      },
      async clearNamespace() {
        // No-op
      },
      async close() {
        vectorDb.clear();
      },
      getConfig() {
        return {
          backend: "memory",
          dimension: vectorDb.getStats().dimension,
        };
      },
    };
  }
}

/**
 * Create vector database factory from configuration
 */
export function createVectorDBFactory(
  config: VectorDatabaseFactoryConfig
): VectorDBFactory {
  return new VectorDBFactory(config);
}

/**
 * Create adapter from single configuration
 */
export async function createAdapter(
  config: VectorDatabaseConfig
): Promise<IVectorDatabaseAdapter> {
  const factory = new VectorDBFactory({
    adapters: [{ name: "default", ...config }],
    defaultAdapter: config.backend,
  });

  return factory.createAdapter("default");
}

/**
 * Create adapter with environment variable configuration
 */
export async function createAdapterFromEnv(): Promise<IVectorDatabaseAdapter> {
  const backend = (process.env.VECTOR_DB_BACKEND ?? "memory") as VectorDatabaseConfig["backend"];
  const dimension = parseInt(process.env.VECTOR_DB_DIMENSION ?? "768", 10);

  const config: VectorDatabaseConfig = {
    backend,
    dimension,
    credentials: {
      apiKey: process.env.VECTOR_DB_API_KEY,
      endpoint: process.env.VECTOR_DB_ENDPOINT,
      username: process.env.VECTOR_DB_USERNAME,
      password: process.env.VECTOR_DB_PASSWORD,
    },
    connection: {
      timeout: parseInt(process.env.VECTOR_DB_TIMEOUT ?? "30000", 10),
      maxRetries: parseInt(process.env.VECTOR_DB_MAX_RETRIES ?? "3", 10),
    },
  };

  return createAdapter(config);
}

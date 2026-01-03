/**
 * PineconeAdapter - Pinecone vector database adapter
 *
 * Implements the IVectorDatabaseAdapter interface for Pinecone.
 * Provides high-performance vector search with automatic scaling.
 *
 * @packageDocumentation
 */

import type {
  IVectorDatabaseAdapter,
  PineconeConfig,
  VectorId,
  NamespaceId,
  VectorRecord,
  VectorMatch,
  VectorQueryOptions,
  BatchOperationResult,
  VectorDatabaseStats,
  VectorDatabaseHealth,
  DistanceMetric,
  MetadataFilter,
} from "@lsi/protocol";

/**
 * PineconeAdapter implementation
 */
export class PineconeAdapter implements IVectorDatabaseAdapter {
  private config: PineconeConfig;
  private client: any; // Pinecone client (loaded dynamically)
  private index: any; // Pinecone index
  private initialized = false;
  private namespaceCache = new Set<string>();

  constructor(config: PineconeConfig) {
    this.config = config;
  }

  /**
   * Initialize Pinecone client and connect to index
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Dynamically import Pinecone client to avoid hard dependency
      const { Pinecone } = await import("@pinecone-database/pinecone");

      // Initialize Pinecone client
      this.client = new Pinecone({
        apiKey: this.config.credentials.apiKey,
      });

      // Get index reference
      const indexName = this.config.indexName;

      // Support both new and old Pinecone SDK versions
      if (typeof this.client.index === "function") {
        this.index = this.client.index(indexName);
      } else if (this.client.Index) {
        this.index = this.client.Index(indexName);
      } else {
        throw new Error("Unsupported Pinecone SDK version");
      }

      // Verify index is ready
      await this.ensureIndexReady();

      this.initialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize Pinecone adapter: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Ensure index is ready and initialized
   */
  private async ensureIndexReady(): Promise<void> {
    const maxRetries = this.config.connection?.maxRetries ?? 10;
    const retryDelay = this.config.connection?.retryDelay ?? 2000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Check index status (method depends on SDK version)
        if (this.index.describeIndexStats) {
          await this.index.describeIndexStats();
        } else if (this.client.describeIndex) {
          await this.client.describeIndex(this.config.indexName);
        }
        return;
      } catch (error) {
        if (attempt === maxRetries - 1) {
          throw error;
        }
        await this.sleep(retryDelay);
      }
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<VectorDatabaseHealth> {
    const startTime = Date.now();

    try {
      await this.initialize();

      // Query index stats to check connectivity
      if (this.index.describeIndexStats) {
        await this.index.describeIndexStats();
      }

      const latency = Date.now() - startTime;

      return {
        healthy: true,
        latency,
        status: "connected",
      };
    } catch (error) {
      const latency = Date.now() - startTime;

      return {
        healthy: false,
        latency,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<VectorDatabaseStats> {
    await this.initialize();

    try {
      const stats: any = this.index.describeIndexStats
        ? await this.index.describeIndexStats()
        : {};

      return {
        totalVectors: stats.totalVectorCount ?? 0,
        totalNamespaces: Object.keys(stats.namespaces ?? {}).length,
        dimension: this.config.dimension,
        indexType: "pinecone-hnsw",
        sizeBytes: stats.indexSizeBytes,
        backendStats: stats,
      };
    } catch (error) {
      throw new Error(
        `Failed to get Pinecone stats: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Create namespace (Pinecone creates namespaces implicitly)
   */
  async createNamespace(namespace: NamespaceId): Promise<void> {
    await this.initialize();
    // Pinecone creates namespaces implicitly on first upsert
    this.namespaceCache.add(namespace);
  }

  /**
   * Delete namespace and all vectors
   */
  async deleteNamespace(namespace: NamespaceId): Promise<void> {
    await this.initialize();

    try {
      // Pinecone SDK v1+
      if (this.index.delete) {
        await this.index.delete({
          deleteAll: true,
          namespace,
        });
      }

      this.namespaceCache.delete(namespace);
    } catch (error) {
      throw new Error(
        `Failed to delete namespace ${namespace}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * List all namespaces
   */
  async listNamespaces(): Promise<NamespaceId[]> {
    await this.initialize();

    try {
      const stats: any = this.index.describeIndexStats
        ? await this.index.describeIndexStats()
        : {};

      return Object.keys(stats.namespaces ?? {}) as NamespaceId[];
    } catch (error) {
      return [];
    }
  }

  /**
   * Check if namespace exists
   */
  async namespaceExists(namespace: NamespaceId): Promise<boolean> {
    const namespaces = await this.listNamespaces();
    return namespaces.includes(namespace);
  }

  /**
   * Upsert a single vector
   */
  async upsert(record: VectorRecord): Promise<void> {
    await this.initialize();

    const namespace = record.namespace ?? this.config.defaultNamespace ?? "";

    try {
      const vector = {
        id: record.id,
        values: Array.from(record.vector), // Pinecone expects Array, not Float32Array
        metadata: record.metadata,
        namespace,
      };

      // Pinecone SDK v1+
      if (this.index.upsert) {
        await this.index.upsert([vector]);
      } else {
        throw new Error("Unsupported Pinecone SDK version");
      }
    } catch (error) {
      throw new Error(
        `Failed to upsert vector ${record.id}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Upsert multiple vectors
   */
  async upsertBatch(records: VectorRecord[]): Promise<BatchOperationResult> {
    await this.initialize();

    let succeeded = 0;
    let failed = 0;
    const errors: Array<{ id: VectorId; error: string }> = [];

    // Pinecone supports up to 100 vectors per request
    const batchSize = 100;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      try {
        const vectors = batch.map((record) => ({
          id: record.id,
          values: Array.from(record.vector),
          metadata: record.metadata,
          namespace: record.namespace ?? this.config.defaultNamespace ?? "",
        }));

        if (this.index.upsert) {
          await this.index.upsert(vectors);
        }

        succeeded += batch.length;
      } catch (error) {
        failed += batch.length;
        for (const record of batch) {
          errors.push({
            id: record.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    }

    return { succeeded, failed, errors };
  }

  /**
   * Get vector by ID
   */
  async get(id: VectorId, namespace?: NamespaceId): Promise<VectorRecord | null> {
    await this.initialize();

    const ns = namespace ?? this.config.defaultNamespace ?? "";

    try {
      // Pinecone SDK v1+ fetch method
      let result;
      if (this.index.fetch) {
        result = await this.index.fetch([id], { namespace: ns });
      }

      if (!result || !result.records || !result.records[id]) {
        return null;
      }

      const record = result.records[id];
      return {
        id,
        vector: Float32Array.from(record.values ?? record.vector ?? []),
        metadata: record.metadata,
        namespace: ns,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Get multiple vectors by IDs
   */
  async getBatch(ids: VectorId[], namespace?: NamespaceId): Promise<VectorRecord[]> {
    await this.initialize();

    const ns = namespace ?? this.config.defaultNamespace ?? "";

    try {
      // Pinecone supports fetching up to 100 vectors at once
      const results: VectorRecord[] = [];

      for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100);

        let result;
        if (this.index.fetch) {
          result = await this.index.fetch(batch, { namespace: ns });
        }

        if (result && result.records) {
          for (const [id, record]: [string, any] of Object.entries(result.records)) {
            results.push({
              id: id as VectorId,
              vector: Float32Array.from(record.values ?? record.vector ?? []),
              metadata: record.metadata,
              namespace: ns,
            });
          }
        }
      }

      return results;
    } catch (error) {
      throw new Error(
        `Failed to get batch vectors: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Delete vector by ID
   */
  async delete(id: VectorId, namespace?: NamespaceId): Promise<boolean> {
    await this.initialize();

    const ns = namespace ?? this.config.defaultNamespace ?? "";

    try {
      if (this.index.deleteOne) {
        await this.index.deleteOne(id, { namespace: ns });
      } else if (this.index.delete) {
        await this.index.delete({ ids: [id], namespace: ns });
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Delete multiple vectors
   */
  async deleteBatch(ids: VectorId[], namespace?: NamespaceId): Promise<BatchOperationResult> {
    await this.initialize();

    const ns = namespace ?? this.config.defaultNamespace ?? "";

    let succeeded = 0;
    let failed = 0;
    const errors: Array<{ id: VectorId; error: string }> = [];

    try {
      // Pinecone supports deleting up to 1000 vectors at once
      for (let i = 0; i < ids.length; i += 1000) {
        const batch = ids.slice(i, i + 1000);

        if (this.index.delete) {
          await this.index.delete({ ids: batch, namespace: ns });
        }

        succeeded += batch.length;
      }
    } catch (error) {
      failed = ids.length;
      for (const id of ids) {
        errors.push({
          id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return { succeeded, failed, errors };
  }

  /**
   * Search for similar vectors
   */
  async search(
    query: Float32Array,
    options: VectorQueryOptions
  ): Promise<VectorMatch[]> {
    await this.initialize();

    const namespace = options.namespace ?? this.config.defaultNamespace ?? "";

    try {
      const queryRequest: any = {
        vector: Array.from(query),
        topK: options.topK,
        namespace,
        includeMetadata: options.includeMetadata ?? true,
        includeValues: options.includeVectors ?? false,
      };

      // Add metadata filter if specified
      if (options.filter) {
        queryRequest.filter = this.convertFilter(options.filter);
      }

      // Query the index
      const response = this.index.query
        ? await this.index.query(queryRequest)
        : { matches: [] };

      // Convert results
      const matches: VectorMatch[] = (response.matches ?? []).map((match: any) => ({
        id: match.id,
        score: match.score ?? match.scores?.[0] ?? 0,
        distance: 1 - (match.score ?? 0), // Convert similarity to distance
        metadata: match.metadata,
      }));

      return matches;
    } catch (error) {
      throw new Error(
        `Failed to search vectors: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Batch search for multiple queries
   */
  async searchBatch(
    queries: Float32Array[],
    options: VectorQueryOptions
  ): Promise<VectorMatch[][]> {
    const results: VectorMatch[][] = [];

    // Pinecone doesn't support native batch search, so we parallelize
    const searchPromises = queries.map((query) => this.search(query, options));
    const searchResults = await Promise.all(searchPromises);

    results.push(...searchResults);

    return results;
  }

  /**
   * Clear all vectors in namespace
   */
  async clearNamespace(namespace: NamespaceId): Promise<void> {
    await this.initialize();

    try {
      if (this.index.delete) {
        await this.index.delete({
          deleteAll: true,
          namespace,
        });
      }
    } catch (error) {
      throw new Error(
        `Failed to clear namespace ${namespace}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Close the adapter
   */
  async close(): Promise<void> {
    this.initialized = false;
    this.client = null;
    this.index = null;
    this.namespaceCache.clear();
  }

  /**
   * Get adapter configuration (without credentials)
   */
  getConfig(): Omit<PineconeConfig, "credentials"> {
    const { credentials, ...safeConfig } = this.config;
    return safeConfig;
  }

  /**
   * Convert metadata filter to Pinecone format
   */
  private convertFilter(filter: MetadataFilter | MetadataFilter[]): any {
    if (Array.isArray(filter)) {
      if (filter.length === 0) {
        return {};
      }
      // Combine multiple filters with AND
      return {
        filter: {
          operator: "and",
          operands: filter.map((f) => this.convertSingleFilter(f)),
        },
      };
    }
    return this.convertSingleFilter(filter);
  }

  /**
   * Convert single metadata filter
   */
  private convertSingleFilter(filter: MetadataFilter): any {
    const operators: Record<string, string> = {
      eq: "$eq",
      ne: "$ne",
      gt: "$gt",
      gte: "$gte",
      lt: "$lt",
      lte: "$lte",
      in: "$in",
      nin: "$nin",
    };

    return {
      [filter.field]: {
        [operators[filter.operator]]: filter.value,
      },
    };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create PineconeAdapter
 */
export function createPineconeAdapter(config: PineconeConfig): PineconeAdapter {
  return new PineconeAdapter(config);
}

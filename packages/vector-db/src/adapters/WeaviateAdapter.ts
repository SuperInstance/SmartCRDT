/**
 * WeaviateAdapter - Weaviate vector database adapter
 *
 * Implements the IVectorDatabaseAdapter interface for Weaviate.
 * Provides flexible schema management and hybrid search capabilities.
 *
 * @packageDocumentation
 */

import type {
  IVectorDatabaseAdapter,
  WeaviateConfig,
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
 * Weaviate object structure
 */
interface WeaviateObject {
  id: string;
  vector?: number[];
  properties?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Weaviate query response
 */
interface WeaviateResponse {
  data?: {
    Get?: Record<string, WeaviateObject[]>;
  };
  errors?: Array<{ message: string }>;
}

/**
 * WeaviateAdapter implementation
 */
export class WeaviateAdapter implements IVectorDatabaseAdapter {
  private config: WeaviateConfig;
  private client: any; // Weaviate client (loaded dynamically)
  private initialized = false;
  private className: string;

  constructor(config: WeaviateConfig) {
    this.config = config;
    this.className = config.className;
  }

  /**
   * Initialize Weaviate client
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Dynamically import Weaviate client
      const weaviate = await import("weaviate-ts-client");

      // Create client configuration
      const clientConfig: any = {
        scheme: this.config.credentials.endpoint.startsWith("https") ? "https" : "http",
        host: this.config.credentials.endpoint.replace(/^https?:\/\//, ""),
      };

      // Add API key if provided
      if (this.config.credentials.apiKey) {
        clientConfig.apiKey = new weaviate.ApiKey(this.config.credentials.apiKey);
      }

      // Initialize client
      this.client = weaviate.default.client(clientConfig);

      // Ensure class exists
      await this.ensureClassExists();

      this.initialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize Weaviate adapter: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Ensure the class/collection exists
   */
  private async ensureClassExists(): Promise<void> {
    try {
      // Check if class exists
      const classes = await this.client.schema.getter().do();

      const classExists = classes?.classes?.some(
        (c: any) => c.class === this.className
      );

      if (!classExists) {
        // Create class
        await this.createClass();
      }
    } catch (error) {
      // If class doesn't exist, create it
      await this.createClass();
    }
  }

  /**
   * Create class/collection
   */
  private async createClass(): Promise<void> {
    const classObj = {
      class: this.className,
      vectorizer: this.config.vectorizer ?? "none",
      vectorConfig: {
        dimension: this.config.dimension,
        distance: this.convertDistanceMetric(this.config.metric),
      },
      properties: this.generatePropertyDefinitions(),
      replicationConfig: {
        factor: this.config.replicationFactor ?? 1,
      },
      moduleConfig: this.config.moduleConfig ?? {},
    };

    await this.client.schema.classCreator().withClass(classObj).do();
  }

  /**
   * Generate property definitions based on metadata schema
   */
  private generatePropertyDefinitions(): any[] {
    // Default property for storing ID
    return [
      {
        name: "vectorId",
        dataType: ["string"],
        indexFilterable: true,
        indexSearchable: true,
      },
      {
        name: "namespace",
        dataType: ["string"],
        indexFilterable: true,
        indexSearchable: true,
      },
    ];
  }

  /**
   * Convert distance metric to Weaviate format
   */
  private convertDistanceMetric(metric?: DistanceMetric): string {
    switch (metric) {
      case "cosine":
        return "cosine";
      case "euclidean":
        return "l2-squared";
      case "dotproduct":
        return "dot";
      case "manhattan":
        return "manhattan";
      default:
        return "cosine";
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<VectorDatabaseHealth> {
    const startTime = Date.now();

    try {
      await this.initialize();

      // Simple health check - try to get the schema
      await this.client.schema.getter().do();

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
      // Get class statistics
      const classObj = await this.client.schema
        .classGetter()
        .withClassName(this.className)
        .do();

      return {
        totalVectors: classObj?.vectorCount ?? 0,
        totalNamespaces: 1, // Weaviate uses properties for namespacing
        dimension: this.config.dimension,
        indexType: "weaviate-hnsw",
        backendStats: classObj,
      };
    } catch (error) {
      throw new Error(
        `Failed to get Weaviate stats: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Create namespace (Weaviate uses properties for namespacing)
   */
  async createNamespace(namespace: NamespaceId): Promise<void> {
    await this.initialize();
    // Namespaces in Weaviate are implemented as properties
    // No special creation needed
  }

  /**
   * Delete namespace (delete all vectors with namespace property)
   */
  async deleteNamespace(namespace: NamespaceId): Promise<void> {
    await this.initialize();

    try {
      // Delete all objects with the specified namespace
      await this.client.data
        .deleter()
        .withClassName(this.className)
        .withWhere({
          operator: "Equal",
          path: ["namespace"],
          valueText: namespace,
        })
        .do();
    } catch (error) {
      throw new Error(
        `Failed to delete namespace ${namespace}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * List all namespaces (scan all objects)
   */
  async listNamespaces(): Promise<NamespaceId[]> {
    await this.initialize();

    try {
      // Query for unique namespace values
      const response = await this.client.graphql
        .get()
        .withClassName(this.className)
        .withFields("namespace")
        .withLimit(10000)
        .do();

      const objects = response?.data?.Get?.[this.className] ?? [];
      const namespaces = new Set<string>();

      for (const obj of objects) {
        if (obj.namespace) {
          namespaces.add(obj.namespace as string);
        }
      }

      return Array.from(namespaces) as NamespaceId[];
    } catch (error) {
      return [];
    }
  }

  /**
   * Check if namespace exists
   */
  async namespaceExists(namespace: NamespaceId): Promise<boolean> {
    try {
      const result = await this.client.graphql
        .get()
        .withClassName(this.className)
        .withWhere({
          operator: "Equal",
          path: ["namespace"],
          valueText: namespace,
        })
        .withLimit(1)
        .do();

      const objects = result?.data?.Get?.[this.className] ?? [];
      return objects.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Upsert a single vector
   */
  async upsert(record: VectorRecord): Promise<void> {
    await this.initialize();

    const namespace = record.namespace ?? this.config.defaultNamespace ?? "default";

    try {
      const properties = {
        vectorId: record.id,
        namespace,
        ...record.metadata,
      };

      // Weaviate batch API
      await this.client.data
        .creator()
        .withClassName(this.className)
        .withId(record.id)
        .withVector(Array.from(record.vector))
        .withProperties(properties)
        .do();
    } catch (error) {
      // If object exists, update it
      try {
        const properties = {
          vectorId: record.id,
          namespace,
          ...record.metadata,
        };

        await this.client.data
          .merger()
          .withClassName(this.className)
          .withId(record.id)
          .withVector(Array.from(record.vector))
          .withProperties(properties)
          .do();
      } catch (updateError) {
        throw new Error(
          `Failed to upsert vector ${record.id}: ${updateError instanceof Error ? updateError.message : "Unknown error"}`
        );
      }
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

    // Weaviate supports batch operations
    const batchSize = 100;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      try {
        const objects = batch.map((record) => ({
          id: record.id,
          class: this.className,
          vector: Array.from(record.vector),
          properties: {
            vectorId: record.id,
            namespace: record.namespace ?? this.config.defaultNamespace ?? "default",
            ...record.metadata,
          },
        }));

        // Use batch API
        await this.client.batch().withObjects(objects).do();

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

    const ns = namespace ?? this.config.defaultNamespace ?? "default";

    try {
      const response = await this.client.data
        .getterById()
        .withClassName(this.className)
        .withId(id)
        .do();

      if (!response || !response.properties) {
        return null;
      }

      // Extract vector (if included)
      const vector = response.vector
        ? Float32Array.from(response.vector)
        : new Float32Array(this.config.dimension);

      // Remove reserved properties from metadata
      const { vectorId, namespace: nsProp, ...metadata } = response.properties as any;

      return {
        id,
        vector,
        metadata,
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

    const results: VectorRecord[] = [];

    for (const id of ids) {
      const record = await this.get(id, namespace);
      if (record) {
        results.push(record);
      }
    }

    return results;
  }

  /**
   * Delete vector by ID
   */
  async delete(id: VectorId, namespace?: NamespaceId): Promise<boolean> {
    await this.initialize();

    try {
      await this.client.data
        .deleter()
        .withClassName(this.className)
        .withId(id)
        .do();

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

    let succeeded = 0;
    let failed = 0;
    const errors: Array<{ id: VectorId; error: string }> = [];

    for (const id of ids) {
      try {
        await this.delete(id, namespace);
        succeeded++;
      } catch (error) {
        failed++;
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

    const namespace = options.namespace ?? this.config.defaultNamespace ?? "default";

    try {
      // Build GraphQL query
      let graphqlQuery = this.client.graphql
        .get()
        .withClassName(this.className)
        .withNearVector({
          vector: Array.from(query),
          distance: options.metric ? this.convertDistanceMetric(options.metric) : undefined,
        })
        .withLimit(options.topK)
        .withFields(["_additional { id distance }", "vectorId", "_additional { vector }"])
        .withSort([{ path: ["_additional"], order: "asc" }]);

      // Add namespace filter
      if (options.namespace) {
        graphqlQuery = graphqlQuery.withWhere({
          operator: "Equal",
          path: ["namespace"],
          valueText: namespace,
        });
      }

      // Add metadata filter
      if (options.filter) {
        graphqlQuery = graphqlQuery.withWhere(this.convertFilter(options.filter));
      }

      const response = await graphqlQuery.do();

      // Convert results
      const objects = response?.data?.Get?.[this.className] ?? [];
      const matches: VectorMatch[] = objects.map((obj: any) => ({
        id: obj.vectorId,
        score: 1 - (obj._additional?.distance ?? 0), // Convert distance to similarity
        distance: obj._additional?.distance,
        metadata: obj,
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

    // Parallelize searches
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
      await this.client.data
        .deleter()
        .withClassName(this.className)
        .withWhere({
          operator: "Equal",
          path: ["namespace"],
          valueText: namespace,
        })
        .do();
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
  }

  /**
   * Get adapter configuration (without credentials)
   */
  getConfig(): Omit<WeaviateConfig, "credentials"> {
    const { credentials, ...safeConfig } = this.config;
    return safeConfig;
  }

  /**
   * Convert metadata filter to Weaviate format
   */
  private convertFilter(filter: MetadataFilter | MetadataFilter[]): any {
    if (Array.isArray(filter)) {
      // Combine multiple filters with AND
      return {
        operator: "And",
        operands: filter.map((f) => this.convertSingleFilter(f)),
      };
    }
    return this.convertSingleFilter(filter);
  }

  /**
   * Convert single metadata filter to Weaviate format
   */
  private convertSingleFilter(filter: MetadataFilter): any {
    const operators: Record<string, string> = {
      eq: "Equal",
      ne: "NotEqual",
      gt: "GreaterThan",
      gte: "GreaterThanEqual",
      lt: "LessThan",
      lte: "LessThanEqual",
      in: "Or",
      nin: "And",
    };

    if (filter.operator === "in") {
      return {
        operator: "Or",
        operands: (filter.value as string[]).map((v) => ({
          operator: "Equal",
          path: [filter.field],
          valueText: v,
        })),
      };
    }

    if (filter.operator === "nin") {
      return {
        operator: "And",
        operands: (filter.value as string[]).map((v) => ({
          operator: "NotEqual",
          path: [filter.field],
          valueText: v,
        })),
      };
    }

    // Determine value type
    const value = filter.value;
    const valueType = typeof value;

    let valueField = "valueText";
    if (valueType === "number") {
      valueField = "valueNumber";
    } else if (valueType === "boolean") {
      valueField = "valueBoolean";
    }

    return {
      operator: operators[filter.operator],
      path: [filter.field],
      [valueField]: value,
    };
  }
}

/**
 * Factory function to create WeaviateAdapter
 */
export function createWeaviateAdapter(config: WeaviateConfig): WeaviateAdapter {
  return new WeaviateAdapter(config);
}

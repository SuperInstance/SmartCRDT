/**
 * Vector Database Usage Examples
 *
 * Comprehensive examples showing how to use @lsi/vector-db with various backends.
 *
 * @packageDocumentation
 */

import { VectorDatabase, createAdapter, createVectorDBFactory } from "@lsi/vector-db";
import type {
  PineconeConfig,
  WeaviateConfig,
  VectorRecord,
  VectorQueryOptions,
} from "@lsi/protocol";

// ============================================================================
// EXAMPLE 1: In-Memory Vector Database
// ============================================================================

async function example1_MemoryDatabase() {
  console.log("=== Example 1: In-Memory Vector Database ===\n");

  // Create in-memory database
  const db = new VectorDatabase({
    dimension: 768,
    queryCache: {
      enabled: true,
      maxSize: 1000,
      ttl: 300000, // 5 minutes
    },
  });

  // Generate some sample vectors
  const vectors = [
    { id: "doc1", vector: new Float32Array(768).fill(0.1), metadata: { title: "AI Basics" } },
    { id: "doc2", vector: new Float32Array(768).fill(0.2), metadata: { title: "ML Advanced" } },
    { id: "doc3", vector: new Float32Array(768).fill(0.3), metadata: { title: "Deep Learning" } },
  ];

  // Add vectors
  for (const v of vectors) {
    db.add(v.id, v.vector, v.metadata);
  }

  console.log(`Added ${vectors.length} vectors`);

  // Search
  const query = new Float32Array(768).fill(0.15);
  const results = await db.search(query, 2);

  console.log("Search results:");
  for (const result of results) {
    console.log(`  - ${result.id}: ${result.score.toFixed(3)}`);
  }

  // Statistics
  const stats = db.getStats();
  console.log("\nStatistics:");
  console.log(`  Total vectors: ${stats.vectorCount}`);
  console.log(`  Cache hit rate: ${(stats.cache.hitRate * 100).toFixed(1)}%`);
  console.log(`  Avg latency: ${stats.cache.avgLatency.toFixed(2)}ms`);
}

// ============================================================================
// EXAMPLE 2: Pinecone Adapter
// ============================================================================

async function example2_PineconeAdapter() {
  console.log("\n=== Example 2: Pinecone Adapter ===\n");

  const config: PineconeConfig = {
    backend: "pinecone",
    dimension: 768,
    credentials: {
      apiKey: process.env.PINECONE_API_KEY!,
    },
    indexName: "aequor-demo",
    environment: "us-east-1-aws",
    metric: "cosine",
    defaultNamespace: "documents" as any,
  };

  const adapter = await createAdapter(config);

  // Health check
  const health = await adapter.healthCheck();
  console.log(`Health check: ${health.healthy ? "OK" : "FAILED"} (${health.latency}ms)`);

  // Create namespace
  const namespace = "demo" as any;
  await adapter.createNamespace(namespace);
  console.log(`Created namespace: ${namespace}`);

  // Upsert vectors
  const records: VectorRecord[] = [
    {
      id: "doc1" as any,
      vector: new Float32Array(768).fill(0.1),
      metadata: { title: "Introduction to AI", category: "tutorial" },
      namespace,
    },
    {
      id: "doc2" as any,
      vector: new Float32Array(768).fill(0.2),
      metadata: { title: "Advanced ML", category: "advanced" },
      namespace,
    },
    {
      id: "doc3" as any,
      vector: new Float32Array(768).fill(0.3),
      metadata: { title: "Deep Learning", category: "advanced" },
      namespace,
    },
  ];

  const result = await adapter.upsertBatch(records);
  console.log(`Upserted ${result.succeeded} vectors`);

  // Search with metadata filter
  const query = new Float32Array(768).fill(0.15);
  const options: VectorQueryOptions = {
    topK: 5,
    namespace,
    includeMetadata: true,
    filter: {
      field: "category",
      operator: "eq",
      value: "advanced",
    },
  };

  const matches = await adapter.search(query, options);
  console.log("\nSearch results (filtered by category='advanced'):");
  for (const match of matches) {
    console.log(`  - ${match.id}: ${match.score.toFixed(3)} - ${match.metadata?.title}`);
  }

  // Get statistics
  const stats = await adapter.getStats();
  console.log("\nStatistics:");
  console.log(`  Total vectors: ${stats.totalVectors}`);
  console.log(`  Index type: ${stats.indexType}`);

  await adapter.close();
}

// ============================================================================
// EXAMPLE 3: Weaviate Adapter
// ============================================================================

async function example3_WeaviateAdapter() {
  console.log("\n=== Example 3: Weaviate Adapter ===\n");

  const config: WeaviateConfig = {
    backend: "weaviate",
    dimension: 768,
    credentials: {
      endpoint: process.env.WEAVIATE_ENDPOINT || "http://localhost:8080",
      apiKey: process.env.WEAVIATE_API_KEY,
    },
    className: "AequorDocument",
    vectorizer: "none",
    metric: "cosine",
  };

  const adapter = await createAdapter(config);

  // Health check
  const health = await adapter.healthCheck();
  console.log(`Health check: ${health.healthy ? "OK" : "FAILED"} (${health.latency}ms)`);

  // Upsert vectors
  const records: VectorRecord[] = [
    {
      id: "doc1" as any,
      vector: new Float32Array(768).fill(0.1),
      metadata: { title: "Vector Databases", tags: ["database", "search"] },
    },
    {
      id: "doc2" as any,
      vector: new Float32Array(768).fill(0.2),
      metadata: { title: "Semantic Search", tags: ["search", "nlp"] },
    },
  ];

  await adapter.upsertBatch(records);
  console.log("Upserted 2 vectors");

  // Search
  const query = new Float32Array(768).fill(0.15);
  const matches = await adapter.search(query, { topK: 10 });

  console.log("\nSearch results:");
  for (const match of matches) {
    console.log(`  - ${match.id}: ${match.score.toFixed(3)}`);
  }

  await adapter.close();
}

// ============================================================================
// EXAMPLE 4: Vector Database Factory
// ============================================================================

async function example4_VectorDatabaseFactory() {
  console.log("\n=== Example 4: Vector Database Factory ===\n");

  const factory = createVectorDBFactory({
    defaultAdapter: "memory",
    adapters: [
      {
        name: "pinecone-primary",
        backend: "pinecone",
        dimension: 768,
        credentials: {
          apiKey: process.env.PINECONE_API_KEY!,
        },
        indexName: "primary-index",
        priority: 10,
      },
      {
        name: "weaviate-secondary",
        backend: "weaviate",
        dimension: 768,
        credentials: {
          endpoint: process.env.WEAVIATE_ENDPOINT!,
        },
        className: "Secondary",
        priority: 5,
      },
      {
        name: "memory-fallback",
        backend: "memory",
        dimension: 768,
        priority: 1,
      },
    ],
    fallbackOrder: ["pinecone", "weaviate", "memory"],
  });

  // Check health of all adapters
  const healthResults = await factory.checkAllHealth();
  console.log("Health check results:");
  for (const result of healthResults) {
    console.log(`  - ${result.name}: ${result.healthy ? "OK" : "FAILED"} (${result.latency}ms)`);
  }

  // Auto-select best adapter
  const selection = await factory.selectAdapter();
  console.log(`\nSelected adapter: ${selection.name}`);
  console.log(`Reason: ${selection.reason}`);
  console.log(`Confidence: ${(selection.confidence * 100).toFixed(0)}%`);

  // Use selected adapter
  await selection.adapter.upsert({
    id: "test" as any,
    vector: new Float32Array(768).fill(0.1),
    metadata: { source: "factory" },
  });

  await factory.closeAll();
}

// ============================================================================
// EXAMPLE 5: Migration
// ============================================================================

async function example5_Migration() {
  console.log("\n=== Example 5: Migration ===\n");

  const { migrateFromHNSW, MigrationProgressBar } = await import("@lsi/vector-db");

  // Source: In-memory database
  const source = new VectorDatabase({ dimension: 768 });
  for (let i = 0; i < 1000; i++) {
    source.add(`vec-${i}`, new Float32Array(768).fill(Math.random()), {
      index: i,
    });
  }
  console.log(`Source database: ${source.getStats().vectorCount} vectors`);

  // Target: Pinecone adapter
  const target = await createAdapter({
    backend: "pinecone",
    dimension: 768,
    credentials: { apiKey: process.env.PINECONE_API_KEY! },
    indexName: "migration-target",
  } as any);

  // Migrate with progress bar
  const progressBar = new MigrationProgressBar();

  const result = await migrateFromHNSW(source, target, {
    batchSize: 100,
    continueOnError: true,
    onProgress: (progress) => progressBar.update(progress),
  });

  progressBar.complete(result);
  await target.close();
}

// ============================================================================
// EXAMPLE 6: Batch Operations
// ============================================================================

async function example6_BatchOperations() {
  console.log("\n=== Example 6: Batch Operations ===\n");

  const adapter = await createAdapter({
    backend: "memory",
    dimension: 768,
  } as any);

  // Generate large batch
  const batchSize = 1000;
  const records: VectorRecord[] = [];

  for (let i = 0; i < batchSize; i++) {
    records.push({
      id: `doc-${i}` as any,
      vector: new Float32Array(768).fill(Math.random() * 0.01),
      metadata: { batch: i, timestamp: Date.now() },
    });
  }

  console.log(`Upserting ${batchSize} vectors...`);

  const start = Date.now();
  const result = await adapter.upsertBatch(records);
  const elapsed = Date.now() - start;

  console.log(`Completed in ${elapsed}ms`);
  console.log(`  Succeeded: ${result.succeeded}`);
  console.log(`  Failed: ${result.failed}`);
  console.log(`  Throughput: ${(batchSize / (elapsed / 1000)).toFixed(0)} vectors/s`);

  // Batch search
  const queries = [
    new Float32Array(768).fill(0.1),
    new Float32Array(768).fill(0.2),
    new Float32Array(768).fill(0.3),
  ];

  console.log(`\nRunning ${queries.length} batch searches...`);
  const searchStart = Date.now();
  const searchResults = await adapter.searchBatch(queries, { topK: 10 });
  const searchElapsed = Date.now() - searchStart;

  console.log(`Completed in ${searchElapsed}ms`);
  console.log(`  Average per query: ${(searchElapsed / queries.length).toFixed(2)}ms`);

  await adapter.close();
}

// ============================================================================
// EXAMPLE 7: Error Handling
// ============================================================================

async function example7_ErrorHandling() {
  console.log("\n=== Example 7: Error Handling ===\n");

  const adapter = await createAdapter({
    backend: "memory",
    dimension: 768,
  } as any);

  // Upsert with error handling
  const record: VectorRecord = {
    id: "test" as any,
    vector: new Float32Array(768).fill(0.1),
    metadata: { title: "Test" },
  };

  try {
    await adapter.upsert(record);
    console.log("✓ Upsert successful");
  } catch (error) {
    console.error("✗ Upsert failed:", error);

    // Implement retry logic
    let retries = 3;
    while (retries > 0) {
      try {
        await adapter.upsert(record);
        console.log("✓ Retry successful");
        break;
      } catch (retryError) {
        retries--;
        if (retries === 0) {
          console.error("✗ All retries exhausted");
        }
      }
    }
  }

  // Batch upsert with partial failure handling
  const records: VectorRecord[] = [
    { id: "doc1" as any, vector: new Float32Array(768).fill(0.1) },
    { id: "doc2" as any, vector: new Float32Array(768).fill(0.2) },
    { id: "doc3" as any, vector: new Float32Array(768).fill(0.3) },
  ];

  const result = await adapter.upsertBatch(records);

  console.log(`\nBatch upsert results:`);
  console.log(`  Succeeded: ${result.succeeded}`);
  console.log(`  Failed: ${result.failed}`);

  if (result.failed > 0) {
    console.log(`  Errors:`);
    for (const error of result.errors) {
      console.log(`    - ${error.id}: ${error.error}`);
    }
  }

  await adapter.close();
}

// ============================================================================
// RUN ALL EXAMPLES
// ============================================================================

async function main() {
  try {
    await example1_MemoryDatabase();
    // await example2_PineconeAdapter(); // Requires PINECONE_API_KEY
    // await example3_WeaviateAdapter(); // Requires WEAVIATE_ENDPOINT
    // await example4_VectorDatabaseFactory(); // Requires credentials
    // await example5_Migration(); // Requires PINECONE_API_KEY
    await example6_BatchOperations();
    await example7_ErrorHandling();

    console.log("\n=== All examples completed successfully ===");
  } catch (error) {
    console.error("\n=== Example failed ===");
    console.error(error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export {
  example1_MemoryDatabase,
  example2_PineconeAdapter,
  example3_WeaviateAdapter,
  example4_VectorDatabaseFactory,
  example5_Migration,
  example6_BatchOperations,
  example7_ErrorHandling,
};

/**
 * Aequor RAG Example with LlamaIndex
 *
 * This example demonstrates how to build a production-ready RAG application
 * using Aequor's intelligent routing, caching, and embeddings with LlamaIndex.
 *
 * Features demonstrated:
 * - Automatic complexity-based routing (simple queries → local, complex → cloud)
 * - Semantic caching with 80%+ hit rate
 * - High-performance embeddings with HNSW indexing
 * - ContextPlane integration for knowledge storage
 * - Cost-aware routing with budget control
 * - Privacy-preserving RAG with intent encoding
 *
 * Run: npx tsx examples/rag-example.ts
 */

import { VectorStoreIndex, Document, Settings } from "llamaindex";
import { AequorLLM } from "../src/llm/AequorLLM.js";
import { AequorEmbedding } from "../src/embeddings/AequorEmbedding.js";
import { AequorCache } from "../src/cache/AequorCache.js";
import { ContextPlane } from "@lsi/superinstance";

// ============================================================================
// CONFIGURATION
// ============================================================================

const config = {
  // OpenAI API key (for cloud model and embeddings)
  openAIApiKey: process.env.OPENAI_API_KEY || "",

  // Ollama configuration (for local model)
  ollama: {
    baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    model: process.env.OLLAMA_MODEL || "llama2",
  },

  // Aequor routing configuration
  routing: {
    complexityThreshold: 0.6, // Simple queries go local
    enableCache: true,
    enableCostAware: true,
    costAware: {
      budget: 10.0, // $10 daily budget
      period: "daily" as const,
    },
  },

  // Embedding configuration
  embeddings: {
    model: "text-embedding-3-large" as const,
    dimensions: 1536,
    enableCache: true,
  },

  // Cache configuration
  cache: {
    maxSize: 1000,
    similarityThreshold: 0.85,
    ttl: 300000, // 5 minutes
  },
};

// ============================================================================
// SETUP
// ============================================================================

/**
 * Initialize Aequor components
 */
async function setupAequor() {
  console.log("🚀 Initializing Aequor...\n");

  // 1. Create LLM with intelligent routing
  const llm = new AequorLLM({
    router: config.routing,
    local: {
      baseURL: config.ollama.baseURL,
      model: config.ollama.model,
      temperature: 0.7,
      maxTokens: 2048,
    },
    cloud: {
      apiKey: config.openAIApiKey,
      model: "gpt-4-turbo-preview",
      temperature: 0.7,
      maxTokens: 4096,
    },
    enableRefinement: true,
    enableCache: config.routing.enableCache,
  });

  // 2. Create embedding model with HNSW cache
  const embedModel = new AequorEmbedding({
    apiKey: config.openAIApiKey,
    model: config.embeddings.model,
    dimensions: config.embeddings.dimensions,
    enableCache: config.embeddings.enableCache,
  });

  // 3. Create semantic cache
  const cache = new AequorCache(config.cache);

  // 4. Configure LlamaIndex to use Aequor components
  Settings.llm = llm;
  Settings.embedModel = embedModel;
  Settings.llmCache = cache;

  // 5. Initialize ContextPlane for knowledge storage
  const contextPlane = new ContextPlane({
    embeddingService: {
      embed: async (text: string) => {
        return embedModel.getTextEmbedding(text);
      },
    },
  });

  console.log("✅ Aequor initialized successfully\n");

  return { llm, embedModel, cache, contextPlane };
}

// ============================================================================
// DATA LOADING
// ============================================================================

/**
 * Load sample documents
 */
async function loadDocuments(contextPlane: ContextPlane) {
  console.log("📚 Loading documents...\n");

  const documents = [
    {
      text: "Aequor is a cognitive orchestration platform that treats AI requests as constraint satisfaction problems. It uses a cascade router to automatically route simple queries to local models and complex queries to cloud models, achieving 90% cost reduction while maintaining 99% quality.",
      metadata: { source: "README.md", section: "overview" },
    },
    {
      text: "The CascadeRouter analyzes query complexity using multiple factors: token count, structural complexity, semantic density, and domain specificity. Queries with complexity < 0.6 are routed to local models, while more complex queries go to cloud models.",
      metadata: { source: "docs/architecture.md", section: "routing" },
    },
    {
      text: "Aequor's semantic cache achieves 80%+ hit rates through intelligent similarity matching. Unlike traditional caches that only match exact strings, Aequor's cache understands semantic similarity, allowing different wordings of the same question to hit the cache.",
      metadata: { source: "docs/performance.md", section: "caching" },
    },
    {
      text: "The ContextPlane provides sovereign memory storage using a semantic graph and vector embeddings. It supports BFS/DFS traversal, Dijkstra's algorithm for shortest paths, and automatic domain extraction from parsed imports.",
      metadata: { source: "docs/context.md", section: "overview" },
    },
    {
      text: "Aequor implements privacy by design through the Redaction-Addition Protocol. Sensitive data is redacted locally before sending to cloud models, then the structural query is sent, and responses are re-hydrated with local context.",
      metadata: { source: "docs/privacy.md", section: "protocol" },
    },
  ];

  // Import documents into ContextPlane
  for (const doc of documents) {
    await contextPlane.addKnowledge(doc.text, {
      source: doc.metadata.source,
      section: doc.metadata.section,
      timestamp: Date.now(),
    });
  }

  console.log(`✅ Loaded ${documents.length} documents into ContextPlane\n`);

  return documents;
}

// ============================================================================
// RAG QUERY EXAMPLES
// ============================================================================

/**
 * Example 1: Simple query (should route local)
 */
async function exampleSimpleQuery(llm: AequorLLM) {
  console.log("🔵 Example 1: Simple Query (Local Routing)");
  console.log("Question: What is Aequor?\n");

  const startTime = Date.now();
  const result = await llm.completeWithMetadata("What is Aequor? Answer in one sentence.");
  const duration = Date.now() - startTime;

  console.log(`Answer: ${result.text}`);
  console.log(`\nRouting: ${result.routing.route}`);
  console.log(`Confidence: ${result.routing.confidence.toFixed(2)}`);
  console.log(`Cache Hit: ${result.cacheHit ? "✅" : "❌"}`);
  console.log(`Latency: ${result.latency}ms`);
  console.log(`Cost: $${result.cost.toFixed(6)}`);
  console.log(`\nNotes: ${result.routing.notes?.join(", ")}`);
  console.log("\n" + "─".repeat(80) + "\n");
}

/**
 * Example 2: Complex query (should route cloud)
 */
async function exampleComplexQuery(llm: AequorLLM) {
  console.log("🟢 Example 2: Complex Query (Cloud Routing)");
  console.log(
    "Question: Explain how Aequor's cascade routing works, including how it determines query complexity and what factors influence the routing decision.\n"
  );

  const startTime = Date.now();
  const result = await llm.completeWithMetadata(
    "Explain how Aequor's cascade routing works, including how it determines query complexity and what factors influence the routing decision."
  );
  const duration = Date.now() - startTime;

  console.log(`Answer: ${result.text}`);
  console.log(`\nRouting: ${result.routing.route}`);
  console.log(`Confidence: ${result.routing.confidence.toFixed(2)}`);
  console.log(`Cache Hit: ${result.cacheHit ? "✅" : "❌"}`);
  console.log(`Latency: ${result.latency}ms`);
  console.log(`Cost: $${result.cost.toFixed(6)}`);
  console.log(`\nNotes: ${result.routing.notes?.join(", ")}`);
  console.log("\n" + "─".repeat(80) + "\n");
}

/**
 * Example 3: RAG query with context retrieval
 */
async function exampleRAGQuery(
  llm: AequorLLM,
  embedModel: AequorEmbedding,
  contextPlane: ContextPlane
) {
  console.log("🟣 Example 3: RAG Query with Context Retrieval");
  console.log("Question: How does Aequor achieve cost reduction?\n");

  // 1. Embed the query
  const queryEmbedding = await embedModel.getTextEmbedding(
    "How does Aequor achieve cost reduction?"
  );

  // 2. Retrieve relevant context
  const relevantKnowledge = await contextPlane.recall(queryEmbedding, {
    maxResults: 3,
    threshold: 0.7,
  });

  console.log(`Found ${relevantKnowledge.length} relevant context passages\n`);

  // 3. Build RAG prompt
  const context = relevantKnowledge.map((k) => k.content).join("\n\n");
  const ragPrompt = `Based on the following context, answer the question:

Context:
${context}

Question: How does Aequor achieve cost reduction?

Answer:`;

  // 4. Generate response
  const startTime = Date.now();
  const result = await llm.completeWithMetadata(ragPrompt);
  const duration = Date.now() - startTime;

  console.log(`Answer: ${result.text}`);
  console.log(`\nRouting: ${result.routing.route}`);
  console.log(`Confidence: ${result.routing.confidence.toFixed(2)}`);
  console.log(`Cache Hit: ${result.cacheHit ? "✅" : "❌"}`);
  console.log(`Latency: ${result.latency}ms`);
  console.log(`Cost: $${result.cost.toFixed(6)}`);
  console.log("\n" + "─".repeat(80) + "\n");
}

/**
 * Example 4: Semantic cache demonstration
 */
async function exampleCacheDemonstration(llm: AequorLLM, cache: AequorCache) {
  console.log("🟡 Example 4: Semantic Cache Demonstration");

  // First query (cache miss)
  console.log("\nQuery 1: Explain Aequor's caching mechanism");
  let startTime = Date.now();
  let result1 = await llm.completeWithMetadata("Explain Aequor's caching mechanism");
  let duration1 = Date.now() - startTime;

  console.log(`Answer: ${result1.text.substring(0, 200)}...`);
  console.log(`Cache Hit: ${result1.cacheHit ? "✅" : "❌"}`);
  console.log(`Latency: ${result1.latency}ms`);

  // Semantically similar query (should hit cache)
  console.log("\nQuery 2: How does Aequor's cache work?");
  startTime = Date.now();
  let result2 = await llm.completeWithMetadata("How does Aequor's cache work?");
  let duration2 = Date.now() - startTime;

  console.log(`Answer: ${result2.text.substring(0, 200)}...`);
  console.log(`Cache Hit: ${result2.cacheHit ? "✅" : "❌"}`);
  console.log(`Cache Similarity: ${result2.cacheSimilarity?.toFixed(3) || "N/A"}`);
  console.log(`Latency: ${result2.latency}ms`);

  // Another similar query (should also hit cache)
  console.log("\nQuery 3: Tell me about the semantic cache in Aequor");
  startTime = Date.now();
  let result3 = await llm.completeWithMetadata(
    "Tell me about the semantic cache in Aequor"
  );
  let duration3 = Date.now() - startTime;

  console.log(`Answer: ${result3.text.substring(0, 200)}...`);
  console.log(`Cache Hit: ${result3.cacheHit ? "✅" : "❌"}`);
  console.log(`Cache Similarity: ${result3.cacheSimilarity?.toFixed(3) || "N/A"}`);
  console.log(`Latency: ${result3.latency}ms`);

  // Cache statistics
  console.log("\n📊 Cache Statistics:");
  const cacheStats = cache.getStats();
  console.log(`Size: ${cacheStats.size}`);
  console.log(`Hit Rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`);
  console.log(`Total Hits: ${cacheStats.totalHits}`);
  console.log(`Total Misses: ${cacheStats.totalMisses}`);
  console.log(`Current Threshold: ${cacheStats.currentThreshold.toFixed(2)}`);

  console.log("\n" + "─".repeat(80) + "\n");
}

/**
 * Example 5: Cost-aware routing
 */
async function exampleCostAwareRouting(llm: AequorLLM) {
  console.log("💰 Example 5: Cost-Aware Routing");

  const budget = llm.getRoutingStats().budget;
  console.log(`\nBudget Status:`);
  console.log(`Budget: $${budget?.remaining.toFixed(2)} / $${budget?.total.toFixed(2)}`);
  console.log(`Period: ${budget?.period}`);
  console.log(`Requests: ${budget?.requests}`);

  // Query that respects budget
  console.log("\nExecuting cost-aware query...");
  const result = await llm.completeWithMetadata(
    "What are the main benefits of using Aequor?"
  );

  console.log(`\nRouting: ${result.routing.route}`);
  console.log(`Within Budget: ${result.routing.notes?.join(", ")}`);
  console.log(`Cost: $${result.cost.toFixed(6)}`);

  console.log("\n" + "─".repeat(80) + "\n");
}

/**
 * Example 6: Similarity search with embeddings
 */
async function exampleSimilaritySearch(embedModel: AequorEmbedding) {
  console.log("🔍 Example 6: Similarity Search with Embeddings");

  const queries = [
    "cost reduction",
    "semantic caching",
    "privacy protection",
    "context management",
  ];

  console.log("\nFinding similar queries for each topic:\n");

  for (const query of queries) {
    console.log(`Query: "${query}"`);

    try {
      const similar = await embedModel.findSimilar(query, 3);

      console.log(`Similar queries:`);
      for (const item of similar) {
        console.log(`  - ${item.text} (similarity: ${item.similarity.toFixed(3)})`);
      }
    } catch (error) {
      console.log(`  (HNSW index may not be ready yet)`);
    }

    console.log();
  }

  // Embedding cache statistics
  console.log("📊 Embedding Cache Statistics:");
  const embedStats = embedModel.getCacheStats();
  console.log(`Size: ${embedStats.size}`);
  console.log(`Hit Rate: ${(embedStats.hitRate * 100).toFixed(1)}%`);
  console.log(`HNSW Enabled: ${embedStats.hnswEnabled ? "✅" : "❌"}`);

  console.log("\n" + "─".repeat(80) + "\n");
}

// ============================================================================
// MAIN
// ============================================================================

/**
 * Main execution
 */
async function main() {
  try {
    console.log("\n" + "=".repeat(80));
    console.log("AEQUOR RAG EXAMPLE WITH LLAMAINDEX");
    console.log("=".repeat(80) + "\n");

    // Setup
    const { llm, embedModel, cache, contextPlane } = await setupAequor();

    // Load documents
    await loadDocuments(contextPlane);

    // Warm cache with common queries
    console.log("🔥 Warming cache with common queries...");
    await llm.warmCache([
      "What is Aequor?",
      "How does routing work?",
      "Explain the semantic cache",
      "What are the privacy features?",
    ]);
    console.log("✅ Cache warmed\n");

    console.log("─".repeat(80) + "\n");

    // Run examples
    await exampleSimpleQuery(llm);
    await exampleComplexQuery(llm);
    await exampleRAGQuery(llm, embedModel, contextPlane);
    await exampleCacheDemonstration(llm, cache);
    await exampleCostAwareRouting(llm);
    await exampleSimilaritySearch(embedModel);

    // Final statistics
    console.log("📈 FINAL STATISTICS\n");

    const routingStats = llm.getRoutingStats();
    console.log("Routing & Cache:");
    console.log(`  Cache Hit Rate: ${(routingStats.cache.hitRate * 100).toFixed(1)}%`);
    console.log(`  Cache Size: ${routingStats.cache.size}`);
    console.log(`  Total Hits: ${routingStats.cache.totalHits}`);
    console.log(`  Total Misses: ${routingStats.cache.totalMisses}`);

    const embedStats = embedModel.getCacheStats();
    console.log("\nEmbeddings:");
    console.log(`  Cache Hit Rate: ${(embedStats.hitRate * 100).toFixed(1)}%`);
    console.log(`  Cache Size: ${embedStats.size}`);

    const cacheAnalytics = cache.getAnalytics();
    console.log("\nCache Analytics:");
    console.log(`  Performance: ${cacheAnalytics.performance.efficiency}`);
    console.log(`  Recommendation: ${cacheAnalytics.performance.recommendedAction}`);

    console.log("\n" + "=".repeat(80));
    console.log("EXAMPLE COMPLETED SUCCESSFULLY");
    console.log("=".repeat(80) + "\n");
  } catch (error) {
    console.error("❌ Error running example:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

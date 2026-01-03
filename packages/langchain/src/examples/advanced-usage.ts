/**
 * @fileoverview Advanced usage examples for @lsi/langchain
 *
 * This file demonstrates advanced patterns including chains, agents,
 * and custom integrations.
 */

import {
  AequorLLM,
  AequorEmbeddings,
  createAequorTools,
  AequorMemory,
} from "../index.js";
import { CascadeRouter } from "@lsi/cascade";
import { PrivacyClassifier } from "@lsi/privacy";

/**
 * Example 1: Using Aequor tools with LangChain agents
 *
 * Shows how to integrate Aequor tools into a LangChain agent workflow.
 */
export async function example1_agentWithTools() {
  console.log("=== Example 1: Agent with Aequor Tools ===\n");

  // Create router and privacy classifier
  const router = new CascadeRouter({
    enableCache: true,
    complexityThreshold: 0.6,
  });

  const privacyClassifier = new PrivacyClassifier({
    modelType: "ensemble",
    enablePIIDetection: true,
  });

  // Create Aequor tools
  const tools = createAequorTools({
    router,
    privacyClassifier,
    enableCache: true,
    maxSearchResults: 5,
  });

  console.log("Available tools:");
  console.log("  - aequor_query: Analyze and route queries");
  console.log("  - aequor_semantic_search: Search for similar queries");
  console.log("  - aequor_privacy_classify: Classify privacy level");
  console.log("  - aequor_intent_encode: Encode intent as vector");
  console.log("  - aequor_cache_stats: Get cache statistics");
  console.log("  - aequor_complexity_analyze: Analyze complexity");

  // Use the query tool
  const queryTool = tools.query;
  const result = await queryTool.invoke({
    query: "What is the capital of France?",
  });

  console.log("\nQuery Analysis Result:");
  console.log(result);
}

/**
 * Example 2: Privacy-preserving query processing
 *
 * Shows how to use privacy classification and intent encoding together.
 */
export async function example2_privacyPreserving() {
  console.log("=== Example 2: Privacy-Preserving Processing ===\n");

  // Create components
  const privacyClassifier = new PrivacyClassifier();
  const tools = createAequorTools({ privacyClassifier });

  // Test different queries
  const queries = [
    "What is the weather today?", // Public
    "My email is john@example.com", // Contains PII
    "My SSN is 123-45-6789", // Sensitive PII
  ];

  for (const query of queries) {
    console.log(`\nQuery: "${query}"`);

    // Classify privacy
    const privacyResult = await tools.privacy.invoke({ query });
    const privacyData = JSON.parse(privacyResult);

    console.log(`Privacy Level: ${privacyData.privacyLevel}`);
    console.log(`Confidence: ${(privacyData.confidence * 100).toFixed(1)}%`);
    console.log(`Detected PII: ${privacyData.detectedPII.join(", ") || "None"}`);
    console.log(`Recommendations:`);
    console.log(`  - Encrypt: ${privacyData.recommendations.encrypt}`);
    console.log(`  - Redact: ${privacyData.recommendations.redact}`);
    console.log(`  - Local Only: ${privacyData.recommendations.localOnly}`);
    console.log(`  - Can Share: ${privacyData.recommendations.canShare}`);
  }
}

/**
 * Example 3: Semantic search and caching
 *
 * Shows how to leverage semantic caching for performance.
 */
export async function example3_semanticCaching() {
  console.log("=== Example 3: Semantic Caching ===\n");

  // Create router with caching enabled
  const router = new CascadeRouter({
    enableCache: true,
    cacheSimilarityThreshold: 0.85,
  });

  const tools = createAequorTools({ router });

  // Similar queries that should hit cache
  const queries = [
    "What is the capital of France?",
    "Tell me about France's capital",
    "What's the capital city of France?",
  ];

  console.log("Testing semantic cache with similar queries:\n");

  for (const query of queries) {
    console.log(`Query: "${query}"`);

    // Get cache stats before
    const statsBefore = tools.cacheStats;

    // Process query
    await tools.query.invoke({ query });

    // Get cache stats after
    const statsAfter = await tools.cacheStats.invoke({});

    console.log(`Cache hits: ${statsAfter.totalHits}`);
    console.log(`Cache misses: ${statsAfter.totalMisses}`);
    console.log(`Hit rate: ${(statsAfter.hitRate * 100).toFixed(1)}%`);
    console.log();
  }

  // Final cache statistics
  const finalStats = await tools.cacheStats.invoke({});
  console.log("Final Cache Statistics:");
  console.log(finalStats);
}

/**
 * Example 4: Complexity-based routing
 *
 * Shows how queries are routed based on complexity.
 */
export async function example4_complexityRouting() {
  console.log("=== Example 4: Complexity-Based Routing ===\n");

  const router = new CascadeRouter({
    complexityThreshold: 0.6,
    confidenceThreshold: 0.6,
  });

  const tools = createAequorTools({ router });

  // Queries with varying complexity
  const queries = [
    { query: "Hi", description: "Simple greeting" },
    { query: "What is 2+2?", description: "Simple math" },
    { query: "Explain quantum entanglement", description: "Complex concept" },
    {
      query: "Compare and contrast the economic policies of the US and China during the 20th century",
      description: "Complex, multi-part question",
    },
  ];

  for (const { query, description } of queries) {
    console.log(`\n${description}`);
    console.log(`Query: "${query}"`);

    const result = await tools.complexity.invoke({ query });
    const data = JSON.parse(result);

    console.log(`\nStatic Analysis:`);
    console.log(`  Words: ${data.staticAnalysis.wordCount}`);
    console.log(`  Characters: ${data.staticAnalysis.charCount}`);
    console.log(`  Avg words/sentence: ${data.staticAnalysis.avgWordsPerSentence}`);

    console.log(`\nRouting Decision:`);
    console.log(`  Route: ${data.routing.route}`);
    console.log(`  Confidence: ${(data.routing.confidence * 100).toFixed(1)}%`);
    console.log(`  Recommended: ${data.routing.recommended}`);

    console.log(`\nNotes:`);
    for (const note of data.notes) {
      console.log(`  - ${note}`);
    }
  }
}

/**
 * Example 5: Memory with semantic context
 *
 * Shows how to use AequorMemory with context-aware retrieval.
 */
export async function example5_semanticMemory() {
  console.log("=== Example 5: Semantic Memory ===\n");

  // Create memory
  const memory = new AequorMemory({
    maxTurns: 10,
    maxTokens: 2000,
    enableCompression: true,
    minRelevance: 0.7,
  });

  // Simulate a conversation about machine learning
  const conversation = [
    { input: "I'm learning about machine learning", output: "That's great! ML is a fascinating field." },
    {
      input: "What's the difference between supervised and unsupervised learning?",
      output: "Supervised learning uses labeled data, while unsupervised learning finds patterns in unlabeled data.",
    },
    {
      input: "Can you give me an example of supervised learning?",
      output: "Image classification is a common example - you train a model with labeled images.",
    },
    {
      input: "What about unsupervised?",
      output: "Clustering is a good example - grouping similar data points without labels.",
    },
  ];

  // Save conversation to memory
  for (const turn of conversation) {
    await memory.saveContext(turn, { output: turn.output });
  }

  console.log("Conversation saved to memory.\n");

  // Query with semantic context
  const query = "Tell me more about clustering";
  console.log(`Query: "${query}"`);

  const context = await memory.loadMemoryVariables({ input: query });

  console.log("\nRelevant context retrieved:");
  console.log(context.history || context.semantic_context);

  // Get memory statistics
  const stats = memory.getStats();
  console.log("\nMemory Statistics:");
  console.log(`  Total turns: ${stats.totalTurns}`);
  console.log(`  Total tokens: ${stats.totalTokens}`);
  console.log(`  Average turn length: ${stats.avgTurnLength.toFixed(0)} tokens`);
  console.log(`  Routing distribution:`);
  console.log(`    Local: ${stats.routingDistribution.local}`);
  console.log(`    Cloud: ${stats.routingDistribution.cloud}`);
  console.log(`    Hybrid: ${stats.routingDistribution.hybrid}`);
}

/**
 * Example 6: Advanced configuration
 *
 * Shows how to configure Aequor components for specific use cases.
 */
export async function example6_advancedConfig() {
  console.log("=== Example 6: Advanced Configuration ===\n");

  // Cost-optimized configuration
  const costOptimizedLLM = new AequorLLM({
    aequorConfig: {
      complexityThreshold: 0.7, // Higher threshold = more local
      enableCache: true,
      enableCostAware: true,
      costAware: {
        budget: 10.0,
        period: "daily",
        preferLocalWhenBudget: true,
      },
    },
  });

  console.log("Cost-Optimized Configuration:");
  console.log("  Higher complexity threshold (0.7) for more local routing");
  console.log("  Cost-aware routing enabled with $10 daily budget");
  console.log("  Prefer local when budget is constrained");

  // Performance-optimized configuration
  const performanceOptimized = new AequorEmbeddings({
    enableCache: true,
    cacheSimilarityThreshold: 0.85,
    maxCacheSize: 2000,
    batchSize: 20,
  });

  console.log("\nPerformance-Optimized Configuration:");
  console.log("  Semantic caching with 0.85 similarity threshold");
  console.log("  Large cache size (2000 entries)");
  console.log("  Batch processing (20 at a time)");

  // Privacy-focused configuration
  const privacyMemory = new AequorMemory({
    maxTurns: 5,
    maxTokens: 1000,
    enableCompression: true,
    minRelevance: 0.8, // Higher relevance = more selective
  });

  console.log("\nPrivacy-Focused Configuration:");
  console.log("  Limited memory (5 turns, 1000 tokens)");
  console.log("  Context compression enabled");
  console.log("  High relevance threshold (0.8) for retrieval");
}

/**
 * Run all advanced examples
 */
export async function runAllAdvancedExamples() {
  try {
    await example1_agentWithTools();
    console.log("\n" + "=".repeat(50) + "\n");

    await example2_privacyPreserving();
    console.log("\n" + "=".repeat(50) + "\n");

    await example3_semanticCaching();
    console.log("\n" + "=".repeat(50) + "\n");

    await example4_complexityRouting();
    console.log("\n" + "=".repeat(50) + "\n");

    await example5_semanticMemory();
    console.log("\n" + "=".repeat(50) + "\n");

    await example6_advancedConfig();
  } catch (error) {
    console.error("Advanced example failed:", error);
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllAdvancedExamples();
}

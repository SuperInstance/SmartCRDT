/**
 * @fileoverview Basic usage examples for @lsi/langchain
 *
 * This file demonstrates common patterns for using Aequor with LangChain.
 */

import { AequorLLM, AequorEmbeddings, AequorMemory } from "../index.js";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

/**
 * Example 1: Basic LLM usage
 *
 * Shows how to use AequorLLM for simple text generation.
 */
export async function example1_basicLLM() {
  console.log("=== Example 1: Basic LLM Usage ===\n");

  // Create Aequor LLM
  const llm = new AequorLLM({
    aequorConfig: {
      complexityThreshold: 0.6,
      enableCache: true,
    },
  });

  // Generate response
  const response = await llm.invoke("What is the capital of France?");
  console.log("Response:", response);

  // Get routing stats
  const stats = llm.getRoutingStats();
  console.log("\nCache Stats:", stats.cacheStats);
}

/**
 * Example 2: Embeddings usage
 *
 * Shows how to use AequorEmbeddings for text embedding.
 */
export async function example2_embeddings() {
  console.log("=== Example 2: Embeddings Usage ===\n");

  // Create embeddings instance
  const embeddings = new AequorEmbeddings({
    enableCache: true,
  });

  // Embed a query
  const query = "What is machine learning?";
  const queryVector = await embeddings.embedQuery(query);

  console.log(`Query: "${query}"`);
  console.log(`Embedding dimensions: ${queryVector.length}`);
  console.log(`First 5 values: ${queryVector.slice(0, 5).map(v => v.toFixed(4)).join(", ")}`);

  // Embed multiple documents
  const documents = [
    "Machine learning is a subset of AI.",
    "Deep learning uses neural networks.",
    "Python is popular for ML.",
  ];

  const docVectors = await embeddings.embedDocuments(documents);

  console.log("\nDocument embeddings:");
  for (let i = 0; i < documents.length; i++) {
    console.log(`  ${i + 1}. "${documents[i]}"`);
    console.log(`     Dimensions: ${docVectors[i].length}`);
  }

  // Find similar documents
  const similarities = await embeddings.similaritySearch(queryVector, docVectors, 3);

  console.log("\nMost similar documents:");
  for (const [docIndex, similarity] of similarities) {
    console.log(`  ${docIndex + 1}. "${documents[docIndex]}" (${(similarity * 100).toFixed(1)}% similar)`);
  }
}

/**
 * Example 3: Memory usage
 *
 * Shows how to use AequorMemory for conversation history.
 */
export async function example3_memory() {
  console.log("=== Example 3: Memory Usage ===\n");

  // Create memory instance
  const memory = new AequorMemory({
    maxTurns: 5,
    maxTokens: 1000,
    enableCompression: true,
  });

  // Save conversation turns
  await memory.saveContext(
    { input: "Hi, I'm learning about AI." },
    { output: "That's great! AI is a fascinating field." }
  );

  await memory.saveContext(
    { input: "What's the difference between AI and ML?" },
    { output: "AI is the broader field, while ML is a specific approach within AI that uses data to learn patterns." }
  );

  // Load memory variables
  const memoryVars = await memory.loadMemoryVariables({
    input: "Tell me more about ML",
  });

  console.log("Conversation history:\n", memoryVars.history);

  // Get statistics
  const stats = memory.getStats();
  console.log("\nMemory stats:");
  console.log(`  Total turns: ${stats.totalTurns}`);
  console.log(`  Total tokens: ${stats.totalTokens}`);
  console.log(`  Avg turn length: ${stats.avgTurnLength.toFixed(0)} tokens`);
}

/**
 * Example 4: Combining LLM, embeddings, and memory
 *
 * Shows how to use all three components together.
 */
export async function example4_combined() {
  console.log("=== Example 4: Combined Usage ===\n");

  // Create components
  const llm = new AequorLLM();
  const embeddings = new AequorEmbeddings();
  const memory = new AequorMemory();

  // Conversation loop
  const queries = [
    "What is machine learning?",
    "How does it work?",
    "Give me an example",
  ];

  for (const query of queries) {
    console.log(`\nHuman: ${query}`);

    // Get context from memory
    const context = await memory.loadMemoryVariables({ input: query });

    // Generate response
    const response = await llm.invoke(
      `${context.history}\n\nHuman: ${query}\nAI:`
    );

    console.log(`AI: ${response}`);

    // Save to memory
    await memory.saveContext({ input: query }, { output: response });

    // Get embedding for the query
    const embedding = await embeddings.embedQuery(query);
    console.log(`[Query embedded: ${embedding.length} dimensions]`);
  }

  // Get final statistics
  const cacheStats = embeddings.getCacheStats();
  console.log("\nEmbedding cache stats:");
  console.log(`  Hit rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`);
  console.log(`  Total hits: ${cacheStats.totalHits}`);
}

/**
 * Example 5: Streaming responses
 *
 * Shows how to stream responses from AequorLLM.
 */
export async function example5_streaming() {
  console.log("=== Example 5: Streaming Responses ===\n");

  // Create LLM with streaming enabled
  const llm = new AequorLLM({
    aequorConfig: {
      streaming: true,
    },
  });

  // Stream response (this is a placeholder - actual streaming depends on adapter)
  console.log("Streaming: ");

  const query = "Explain quantum computing in simple terms";
  const response = await llm.invoke(query);

  console.log(response);
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  try {
    await example1_basicLLM();
    console.log("\n" + "=".repeat(50) + "\n");

    await example2_embeddings();
    console.log("\n" + "=".repeat(50) + "\n");

    await example3_memory();
    console.log("\n" + "=".repeat(50) + "\n");

    await example4_combined();
    console.log("\n" + "=".repeat(50) + "\n");

    await example5_streaming();
  } catch (error) {
    console.error("Example failed:", error);
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples();
}

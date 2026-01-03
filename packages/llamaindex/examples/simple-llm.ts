/**
 * Simple Aequor LLM Example
 *
 * Demonstrates basic usage of AequorLLM with LlamaIndex.
 *
 * Run: npx tsx examples/simple-llm.ts
 */

import { AequorLLM } from "../src/llm/AequorLLM.js";

async function main() {
  console.log("=== Aequor LLM Simple Example ===\n");

  // Create Aequor LLM
  const llm = new AequorLLM({
    router: {
      complexityThreshold: 0.6,
      enableCache: true,
    },
    local: {
      baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
      model: process.env.OLLAMA_MODEL || "llama2",
    },
    cloud: {
      apiKey: process.env.OPENAI_API_KEY || "",
      model: "gpt-4-turbo-preview",
    },
  });

  // Simple query (should route local)
  console.log("🔵 Simple Query (Local Routing)");
  console.log("Question: What is TypeScript?\n");

  try {
    const result = await llm.completeWithMetadata(
      "What is TypeScript? Answer in one sentence."
    );

    console.log(`Answer: ${result.text}\n`);
    console.log(`Routing: ${result.routing.route}`);
    console.log(`Confidence: ${result.routing.confidence.toFixed(2)}`);
    console.log(`Cache Hit: ${result.cacheHit ? "✅" : "❌"}`);
    console.log(`Latency: ${result.latency}ms`);
    console.log(`Cost: $${result.cost.toFixed(6)}`);
  } catch (error) {
    console.error("Error:", error);
    console.log("\nNote: Make sure Ollama is running at http://localhost:11434");
  }

  console.log("\n" + "=".repeat(50) + "\n");

  // Cache statistics
  console.log("📊 Cache Statistics:");
  const cacheStats = llm.getCacheStats();
  console.log(`Hit Rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`);
  console.log(`Total Hits: ${cacheStats.totalHits}`);
  console.log(`Total Misses: ${cacheStats.totalMisses}`);
  console.log(`Cache Size: ${cacheStats.size}`);
}

main().catch(console.error);

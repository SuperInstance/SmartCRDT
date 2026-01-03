/**
 * Hello World - The Simplest ActiveLedger Example
 *
 * This is the "Hello World" of ActiveLedger. It demonstrates:
 * 1. Creating an ActiveLedger instance
 * 2. Running your first query
 * 3. Getting a result with metadata
 *
 * Run: npx tsx hello-world.ts
 */

import { ActiveLedger } from '@lsi/core';

async function main() {
  console.log('=== ActiveLedger Hello World ===\n');

  // Step 1: Create an ActiveLedger instance
  // No configuration needed - works out of the box
  const ledger = new ActiveLedger();
  console.log('✓ ActiveLedger created');

  // Step 2: Run a simple query
  // This uses intelligent routing to find the best way to answer
  console.log('\n--- Query 1: Simple Math ---');
  const result1 = await ledger.query('What is 2 + 2?');
  console.log(`Question: What is 2 + 2?`);
  console.log(`Answer: ${result1.output}`);
  console.log(`Confidence: ${(result1.confidence! * 100).toFixed(0)}%`);
  console.log(`Latency: ${result1.metadata?.latency}ms`);

  // Step 3: Ask a more complex question
  console.log('\n--- Query 2: Explanation ---');
  const result2 = await ledger.query('What is ActiveLedger in one sentence?');
  console.log(`Question: What is ActiveLedger in one sentence?`);
  console.log(`Answer: ${result2.output}`);
  console.log(`Model: ${result2.metadata?.model}`);

  // Step 4: Create a specialized component
  console.log('\n--- Query 3: Sentiment Analysis ---');
  const analyzer = await ledger.create('sentiment analyzer');
  const sentiment = await analyzer('ActiveLedger is amazing!');
  console.log(`Input: "ActiveLedger is amazing!"`);
  console.log(`Sentiment: ${sentiment.output}`);
  console.log(`Confidence: ${(sentiment.confidence! * 100).toFixed(0)}%`);

  console.log('\n=== All Done! ===');
}

// Run the example
main().catch(console.error);

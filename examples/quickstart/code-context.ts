/**
 * Code Context Example
 *
 * This example demonstrates how ActiveLedger uses YOUR codebase
 * to provide context-aware answers. Unlike ChatGPT which needs
 * you to paste code every time, ActiveLedger already knows
 * your project.
 *
 * Run: npx tsx code-context.ts
 */

import { createLibCognitive } from '@lsi/core';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log('=== ActiveLedger Code Context Example ===\n');

  // Step 1: Create libcognitive with project context
  // This tells ActiveLedger to learn about your codebase
  const lsi = createLibCognitive({
    project: {
      root: join(__dirname, '../../..'), // Go to project root
      name: 'lsi-demo',
      language: 'typescript',
    },
    debug: true,
  });

  console.log('✓ LibCognitive created with project context');
  console.log('✓ Project root: packages/core/src');

  // Step 2: Transduce - Convert question to semantic signal
  console.log('\n--- Step 1: TRANSDUCE ---');
  const signal = await lsi.transduce('What does ActiveLedger do?');
  console.log(`Summary: ${signal.summary}`);
  console.log(`Category: ${signal.category}`);
  console.log(`Confidence: ${(signal.confidence * 100).toFixed(0)}%`);
  console.log(`Complexity: ${signal.complexity}`);

  // Step 3: Recall - Retrieve relevant code context
  console.log('\n--- Step 2: RECALL ---');
  const context = await lsi.recall(signal, {
    maxChunks: 5,
    threshold: 0.5,
    domains: ['code'],
  });

  console.log(`Found ${context.chunks.length} relevant code chunks`);
  console.log(`Total examined: ${context.totalConsidered}`);
  console.log(`Confidence: ${(context.confidence * 100).toFixed(0)}%`);

  if (context.chunks.length > 0) {
    console.log('\nTop context chunk:');
    const chunk = context.chunks[0];
    console.log(`  Source: ${chunk.metadata.source}`);
    console.log(`  Lines: ${chunk.metadata.lineStart}-${chunk.metadata.lineEnd}`);
    console.log(`  Similarity: ${(chunk.similarity * 100).toFixed(0)}%`);
    console.log(`  Preview: ${chunk.content.substring(0, 100)}...`);
  }

  // Step 4: Cogitate - Generate response using context
  console.log('\n--- Step 3: COGITATE ---');
  const thought = await lsi.cogitate(signal, context, {
    temperature: 0.7,
    maxTokens: 200,
  });

  console.log(`Response: ${thought.content}`);
  console.log(`Confidence: ${(thought.confidence * 100).toFixed(0)}%`);
  console.log(`Backend: ${thought.backend}`);
  console.log(`Latency: ${thought.latency}ms`);

  // Step 5: Effect - Return the result
  console.log('\n--- Step 4: EFFECT ---');
  const result = await lsi.effect(thought);
  console.log(`Success: ${result.success}`);
  console.log(`Output: ${result.output || thought.content}`);

  // Alternative: Use process() for the full pipeline in one call
  console.log('\n--- Using process() (Full Pipeline) ---');
  const quickResult = await lsi.process('Explain the 4-primitive API', {
    maxChunks: 3,
    temperature: 0.5,
  });

  console.log(`Response: ${quickResult.content}`);
  console.log(`Total latency: ${quickResult.latency}ms`);
  console.log(`Tokens used: ${quickResult.tokensUsed}`);
  console.log(`Cost: $${quickResult.cost.toFixed(6)}`);

  // Show metadata
  console.log('\n--- Metadata ---');
  console.log(`Intent category: ${quickResult.metadata.intentCategory}`);
  console.log(`Context sources: ${quickResult.metadata.contextSources.length}`);

  console.log('\n=== All Done! ===');
}

// Run the example
main().catch(console.error);

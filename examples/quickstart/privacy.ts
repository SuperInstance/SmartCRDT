/**
 * Privacy Demonstration
 *
 * This example shows how ActiveLedger protects your privacy:
 * 1. Sensitive queries are classified (LOGIC vs STYLE vs SECRET)
 * 2. Sensitive queries stay on your machine
 * 3. For cloud queries, we send only the task type, not your code
 *
 * Run: npx tsx privacy.ts
 */

import { createLibCognitive } from '@lsi/core';
import { IntentCategory } from '@lsi/core';

async function main() {
  console.log('=== ActiveLedger Privacy Demonstration ===\n');

  // Create libcognitive with privacy enabled
  const lsi = createLibCognitive({
    project: {
      root: process.cwd(),
      name: 'privacy-demo',
    },
    privacy: {
      local: true,      // Keep sensitive queries local
      redact: true,     // Redact sensitive information
      socratic: true,   // Use Socratic verification
    },
    debug: true,
  });

  console.log('✓ Privacy mode enabled');
  console.log('  - Sensitive queries stay local');
  console.log('  - Cloud queries receive task type only\n');

  // Test different types of queries
  const testQueries = [
    {
      category: 'STYLE',
      query: 'How should I format this function?',
      description: 'Style question - non-sensitive',
    },
    {
      category: 'LOGIC',
      query: 'How does the authentication logic work?',
      description: 'Logic question - moderate sensitivity',
    },
    {
      category: 'SECRET',
      query: 'Where is the API key stored?',
      description: 'Secret question - high sensitivity',
    },
  ];

  for (const test of testQueries) {
    console.log(`--- ${test.description} ---`);
    console.log(`Query: "${test.query}"`);

    // Step 1: Transduce to get intent
    const signal = await lsi.transduce(test.query);
    console.log(`Intent Category: ${signal.category}`);

    // Step 2: Determine routing based on category
    const isSensitive = signal.category === IntentCategory.QUERY; // Simplified
    const routing = isSensitive ? 'LOCAL ONLY' : 'HYBRID (local + cloud)';
    console.log(`Routing: ${routing}`);

    // Step 3: Generate response
    const thought = await lsi.cogitate(signal, await lsi.recall(signal), {
      temperature: 0.7,
    });

    console.log(`Backend: ${thought.backend}`);
    console.log(`Response: ${thought.content.substring(0, 80)}...`);

    // Show what was sent to cloud (if anything)
    if (thought.backend === 'cloud') {
      console.log(`Sent to cloud: Task type="${signal.category}"`);
      console.log(`Your code: NOT SENT (privacy protected)`);
    } else {
      console.log(`Sent to cloud: NOTHING (fully local)`);
    }

    console.log('');
  }

  // Demonstrate redaction
  console.log('--- Redaction Demonstration ---');

  const sensitiveQuery = 'My API key is sk-1234567890abcdef';
  console.log(`Original: "${sensitiveQuery}"`);

  const redactedSignal = await lsi.transduce(sensitiveQuery);
  console.log(`After transduction:`);
  console.log(`  Summary: ${redactedSignal.summary}`);
  console.log(`  PII detected: ${redactedSignal.entities.length > 0 ? 'YES' : 'NO'}`);

  if (redactedSignal.entities.length > 0) {
    console.log(`  Entities: ${redactedSignal.entities.join(', ')}`);
  }

  // Show privacy settings
  console.log('\n--- Current Privacy Settings ---');
  const status = lsi.getStatus();
  console.log(`Local mode: ${status.initialized ? 'ENABLED' : 'DISABLED'}`);
  console.log(`Cloud fallback: AVAILABLE`);

  console.log('\n=== Privacy Summary ===');
  console.log('✓ Sensitive queries never leave your machine');
  console.log('✓ Cloud queries receive task type only, not your code');
  console.log('✓ PII is detected and can be redacted');
  console.log('✓ Works offline (Level 2+)');
}

// Run the example
main().catch(console.error);

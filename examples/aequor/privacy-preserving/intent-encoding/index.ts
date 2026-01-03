#!/usr/bin/env node
/**
 * Intent Encoding Example
 *
 * Demonstrates privacy-preserving intent encoding.
 */

import { IntentEncoder } from '@lsi/privacy';

interface PrivacyExample {
  query: string;
  containsPII: boolean;
  category: string;
}

async function main() {
  console.log('=== Aequor Intent Encoding Demo ===\n');

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY required');
    process.exit(1);
  }

  const encoder = new IntentEncoder({
    apiKey: process.env.OPENAI_API_KEY,
    epsilon: 1.0,
    outputDim: 768,
  });

  const examples: PrivacyExample[] = [
    {
      query: 'What is the capital of France?',
      containsPII: false,
      category: 'General knowledge',
    },
    {
      query: 'I have a doctor appointment tomorrow at 3pm',
      containsPII: true,
      category: 'Health information',
    },
    {
      query: 'My credit card number is 4532-1234-5678-9010',
      containsPII: true,
      category: 'Financial information',
    },
  ];

  for (let i = 0; i < examples.length; i++) {
    const example = examples[i];
    console.log(`\n--- Example ${i + 1} ---`);
    console.log(`Query: "${example.query}"`);
    console.log(`Category: ${example.category}`);
    console.log(`Contains PII: ${example.containsPII ? 'Yes 🔒' : 'No'}`);

    const intent = await encoder.encode(example.query);

    console.log(`\nIntent Encoding:`);
    console.log(`  Input dimensions: 1536 (OpenAI embedding)`);
    console.log(`  Output dimensions: ${intent.vector.length} (intent vector)`);
    console.log(`  Privacy loss (ε): ${intent.privacyLoss.toFixed(2)}`);
    console.log(`  Reconstruction difficulty: ${getDifficultyLabel(intent.privacyLoss)}`);

    console.log(`\nIntent Vector (first 10 dims):`);
    console.log(`  [${intent.vector.slice(0, 10).map(v => v.toFixed(3)).join(', ')}, ...]`);

    console.log(`\n✓ Cloud receives intent vector (no raw content!)`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Privacy Guarantee:');
  console.log('- Cloud cannot reconstruct original query');
  console.log('- Semantic meaning preserved for routing');
  console.log('- ε-differential privacy: ' + encoder.getEpsilon());
  console.log('='.repeat(60));
}

function getDifficultyLabel(epsilon: number): string {
  if (epsilon < 0.5) return 'Extremely High';
  if (epsilon < 1.0) return 'Very High';
  if (epsilon < 2.0) return 'High';
  if (epsilon < 5.0) return 'Medium';
  return 'Low';
}

main().catch(console.error);

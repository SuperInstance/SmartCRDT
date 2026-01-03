#!/usr/bin/env node
/**
 * Context Management Example
 *
 * Demonstrates context handling in Aequor.
 */

import { SuperInstance } from '@lsi/superinstance';

async function main() {
  console.log('=== Aequor Context Management Demo ===\n');

  const aequor = new SuperInstance({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Query 1: No context
  console.log('Query 1 (no context):');
  console.log('Q: What is REST?');
  const r1 = await aequor.query('What is REST?');
  console.log(`A: ${r1.response?.substring(0, 100)}...\n`);

  // Query 2: Uses context from Query 1
  console.log('Query 2 (with context from Q1):');
  console.log('Q: How does it differ from SOAP?');
  const r2 = await aequor.query('How does it differ from SOAP?');
  console.log(`A: ${r2.response?.substring(0, 100)}...\n`);

  // Clear context
  console.log('Clearing context...');
  await aequor.clearContext();

  // Query 3: Context cleared
  console.log('Query 3 (context cleared):');
  console.log('Q: What did we just discuss?');
  const r3 = await aequor.query('What did we just discuss?');
  console.log(`A: ${r3.response?.substring(0, 100)}...`);

  console.log('\n✓ Context management demonstrated');
}

main().catch(console.error);

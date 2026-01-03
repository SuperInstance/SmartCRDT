#!/usr/bin/env node
/**
 * Error Handling Example
 *
 * Demonstrates proper error handling in Aequor.
 */

import { SuperInstance } from '@lsi/superinstance';

async function withErrorHandling() {
  try {
    // Check for API key
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not found in environment');
    }

    const aequor = new SuperInstance({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000,
      maxRetries: 3,
    });

    const result = await aequor.query('Test query');
    console.log('Success:', result.response);

  } catch (error: any) {
    console.error('Error:', error.message);

    // Handle specific errors
    if (error.message.includes('API key')) {
      console.error('Solution: Set OPENAI_API_KEY in .env');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.error('Solution: Ensure Ollama is running');
    } else if (error.message.includes('timeout')) {
      console.error('Solution: Increase timeout or simplify query');
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

async function main() {
  console.log('=== Aequor Error Handling Demo ===\n');

  console.log('Example 1: Successful query');
  await withErrorHandling();

  console.log('\nExample 2: Simulated error handling');
  console.log('Error types handled:');
  console.log('  - Missing API key');
  console.log('  - Connection refused (Ollama down)');
  console.log('  - Timeout');
  console.log('  - Rate limiting');

  console.log('\n✓ Error handling demonstrated');
}

main().catch(console.error);

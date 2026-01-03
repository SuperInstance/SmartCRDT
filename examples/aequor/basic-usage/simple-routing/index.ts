#!/usr/bin/env node
/**
 * Simple Routing Example
 *
 * Demonstrates basic query routing with Aequor.
 * Shows automatic routing between local and cloud models.
 */

import { SuperInstance } from '@lsi/superinstance';
import { QueryResult } from '@lsi/protocol';

interface ExampleQuery {
  text: string;
  expectedRoute: 'local' | 'cloud';
  reason: string;
}

async function main() {
  console.log('=== Aequor Simple Routing Example ===\n');

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Error: OPENAI_API_KEY not found in environment');
    console.error('Please set OPENAI_API_KEY in your .env file');
    process.exit(1);
  }

  // Initialize Aequor
  console.log('Initializing Aequor...');
  const aequor = new SuperInstance({
    apiKey: process.env.OPENAI_API_KEY,
    localModel: 'llama2',
    cloudModel: 'gpt-4',
    complexityThreshold: 0.7,
    confidenceThreshold: 0.6,
  });

  // Example queries with expected routes
  const queries: ExampleQuery[] = [
    {
      text: 'What is the capital of France?',
      expectedRoute: 'local',
      reason: 'Simple factual query',
    },
    {
      text: 'Explain quantum entanglement and its implications for modern cryptography in detail',
      expectedRoute: 'cloud',
      reason: 'Complex technical explanation',
    },
    {
      text: '2 + 2 = ?',
      expectedRoute: 'local',
      reason: 'Very simple arithmetic',
    },
    {
      text: 'What are the differences between REST and GraphQL APIs?',
      expectedRoute: 'local',
      reason: 'Moderate complexity, can be handled locally',
    },
    {
      text: 'Design a fault-tolerant distributed system for a global banking platform with 99.999% availability requirements',
      expectedRoute: 'cloud',
      reason: 'Very complex architectural design',
    },
  ];

  let localCount = 0;
  let cloudCount = 0;
  let totalCost = 0;

  // Process each query
  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    console.log(`\nQuery ${i + 1}: "${query.text}"`);
    console.log(`Expected: ${query.expectedRoute.toUpperCase()} (${query.reason})`);
    console.log('-'.repeat(60));

    try {
      const startTime = Date.now();
      const result = await aequor.query(query.text);
      const latency = Date.now() - startTime;

      const route = result.destination?.toUpperCase() || 'UNKNOWN';
      const isCorrect = route === query.expectedRoute.toUpperCase();

      if (result.destination === 'local') {
        localCount++;
      } else {
        cloudCount++;
        totalCost += result.cost || 0;
      }

      console.log(`✅ Route: ${route} ${isCorrect ? '✓' : '✗ (mismatch)'}`);
      console.log(`   Complexity: ${result.complexity?.toFixed(2)} (${getComplexityLabel(result.complexity)})`);
      console.log(`   Confidence: ${result.confidence?.toFixed(2)} (${getConfidenceLabel(result.confidence)})`);
      console.log(`   Latency: ${latency}ms`);
      console.log(`   Cost: $${(result.cost || 0).toFixed(4)} ${result.destination === 'local' ? '(local)' : '(cloud)'}`);
      console.log(`   Response: ${(result.response || '').substring(0, 100)}...`);

    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('=== Summary ===');
  console.log(`Total queries: ${queries.length}`);
  console.log(`Local: ${localCount} (${((localCount / queries.length) * 100).toFixed(0)}%)`);
  console.log(`Cloud: ${cloudCount} (${((cloudCount / queries.length) * 100).toFixed(0)}%)`);
  console.log(`Total cost: $${totalCost.toFixed(4)}`);
  console.log(`Local routing saved: ~$${(cloudCount * 0.003).toFixed(4)} vs cloud-only`);
  console.log('='.repeat(60));

  // Shutdown
  await aequor.shutdown();
  console.log('\n✓ Example complete');
}

function getComplexityLabel(score?: number): string {
  if (score === undefined) return 'unknown';
  if (score < 0.3) return 'very simple';
  if (score < 0.5) return 'simple';
  if (score < 0.7) return 'moderate';
  if (score < 0.9) return 'complex';
  return 'very complex';
}

function getConfidenceLabel(score?: number): string {
  if (score === undefined) return 'unknown';
  if (score < 0.4) return 'low';
  if (score < 0.7) return 'medium';
  if (score < 0.9) return 'high';
  return 'very high';
}

// Run the example
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

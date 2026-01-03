#!/usr/bin/env node
/**
 * Complexity Scoring Example
 *
 * Demonstrates how Aequor scores query complexity.
 */

import { ComplexityScorer } from '@lsi/cascade';

interface ComplexityExample {
  query: string;
  expectedComplexity: number;
  description: string;
}

const examples: ComplexityExample[] = [
  {
    query: '2 + 2 = ?',
    expectedComplexity: 0.15,
    description: 'Very simple arithmetic',
  },
  {
    query: 'What is the capital of France?',
    expectedComplexity: 0.25,
    description: 'Simple factual query',
  },
  {
    query: 'Explain the theory of relativity',
    expectedComplexity: 0.55,
    description: 'Moderate explanation',
  },
  {
    query: 'Compare and contrast REST and GraphQL APIs',
    expectedComplexity: 0.70,
    description: 'Complex comparison',
  },
  {
    query: 'Design a fault-tolerant distributed system for global banking',
    expectedComplexity: 0.85,
    description: 'Very complex architectural design',
  },
];

async function main() {
  console.log('=== Aequor Complexity Scoring Demo ===\n');

  const scorer = new ComplexityScorer();

  for (let i = 0; i < examples.length; i++) {
    const example = examples[i];
    console.log(`Query ${i + 1}: "${example.query}"`);
    console.log(`Description: ${example.description}`);
    console.log(`Expected: ~${example.expectedComplexity.toFixed(2)}`);

    const result = await scorer.score(example.query);

    console.log(`Actual: ${result.score.toFixed(2)} (${getLabel(result.score)})`);
    console.log(`Factors:`);
    console.log(`  - Query length: ${example.query.length} chars`);
    console.log(`  - Word count: ${example.query.split(/\s+/).length}`);
    console.log(`  - Unique words: ${new Set(example.query.toLowerCase().split(/\s+/)).size}`);
    console.log(`  → Route: ${result.score < 0.7 ? 'LOCAL' : 'CLOUD'}`);
    console.log('-'.repeat(60));
  }
}

function getLabel(score: number): string {
  if (score < 0.3) return 'Very Simple';
  if (score < 0.5) return 'Simple';
  if (score < 0.7) return 'Moderate';
  if (score < 0.9) return 'Complex';
  return 'Very Complex';
}

main().catch(console.error);

#!/usr/bin/env node
/**
 * Configuration Example
 *
 * Demonstrates different Aequor configurations.
 */

import { SuperInstance } from '@lsi/superinstance';

async function main() {
  console.log('=== Aequor Configuration Demo ===\n');

  // Default configuration
  console.log('1. Default Configuration:');
  const defaultConfig = new SuperInstance({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Cost-optimized
  console.log('2. Cost-Optimized Configuration:');
  const costOptimized = new SuperInstance({
    apiKey: process.env.OPENAI_API_KEY,
    complexityThreshold: 0.8,
    confidenceThreshold: 0.5,
    routingStrategy: 'cost',
  });

  // Quality-optimized
  console.log('3. Quality-Optimized Configuration:');
  const qualityOptimized = new SuperInstance({
    apiKey: process.env.OPENAI_API_KEY,
    complexityThreshold: 0.5,
    confidenceThreshold: 0.8,
    routingStrategy: 'quality',
  });

  // Privacy-first
  console.log('4. Privacy-First Configuration:');
  const privacyFirst = new SuperInstance({
    apiKey: process.env.OPENAI_API_KEY,
    privacyMode: true,
    redactPII: true,
    intentEncoding: true,
    localModel: 'llama2',
  });

  console.log('\n✓ Configurations demonstrated');
  console.log('\nTip: Use cost-optimized for development,');
  console.log('     quality-optimized for production.');
}

main().catch(console.error);

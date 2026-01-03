#!/usr/bin/env node

/**
 * Federated Learning Demo
 *
 * End-to-end demonstration of privacy-preserving distributed machine learning
 * using CRDTs and the Aequor platform.
 */

import { FederatedLearningDemo } from './src/demo.js';

async function runDemo() {
  console.log('============================================================');
  console.log('  Federated Learning Demo - LSI');
  console.log('============================================================\n');

  const demo = new FederatedLearningDemo();

  try {
    await demo.run();
    console.log('\n============================================================');
    console.log('  Demo Complete!');
    console.log('============================================================');
  } catch (error) {
    console.error('Demo failed:', error);
    process.exit(1);
  }
}

// Run demo
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo();
}

export { runDemo };
export default runDemo;
#!/usr/bin/env node

/**
 * Privacy Mode Example - LSI
 *
 * Offline-first privacy demonstration.
 * Shows privacy-first capabilities with complete offline functionality.
 */

import { PrivacyDemo } from './src/privacy-demo.js';
import { PrivacyManager } from './src/privacy-manager.js';
import { ComplianceReporter } from './src/compliance-reporter.js';

async function runDemo() {
  console.log('🔒 LSI Privacy Mode Demo');
  console.log('==================================================\n');

  const args = process.argv.slice(2);
  const privacyManager = new PrivacyManager();
  const reporter = new ComplianceReporter();

  if (args.includes('--audit')) {
    // Run audit and compliance check
    console.log('📋 Running Privacy Audit...\n');
    await reporter.runAudit();
  } else if (args.includes('--test')) {
    // Run privacy tests
    console.log('🧪 Running Privacy Tests...\n');
    await privacyManager.runPrivacyTests();
  } else {
    // Run main privacy demo
    console.log('🚀 Starting Privacy Mode Demo...\n');

    const demo = new PrivacyDemo();
    await demo.run();

    console.log('\n🔐 Try these commands:');
    console.log('  npm run audit - Run privacy compliance audit');
    console.log('  npm run test - Run privacy mode tests');
    console.log('  lsi query "How does encryption work?" - Test privacy mode');
  }
}

// Run demo
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch(console.error);
}

export { runDemo };
export default runDemo;
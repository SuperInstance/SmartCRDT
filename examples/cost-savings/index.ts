#!/usr/bin/env node

/**
 * Cost Savings Example - LSI
 *
 * Real caching demo with metrics & cost analysis.
 * Demonstrates semantic caching capabilities with real-time metrics.
 */

import { CostSavingsDemo } from './src/cost-demo.js';
import { MetricsAnalyzer } from './src/metrics/metrics.js';

async function runDemo() {
  console.log('💰 LSI Cost Savings Demo');
  console.log('==================================================\n');

  const args = process.argv.slice(2);
  const analyzer = new MetricsAnalyzer();

  if (args.includes('--metrics')) {
    // Run metrics analysis
    console.log('📊 Running Metrics Analysis...\n');
    const metrics = analyzer.loadMetrics();
    const patterns = analyzer.analyzeQueryPatterns(metrics.queries);
    analyzer.generateReport(metrics, patterns);
  } else {
    // Run main demo
    console.log('🚀 Starting Cost Savings Demo...\n');

    const demo = new CostSavingsDemo();
    await demo.run();

    console.log('\n💡 Try these commands:');
    console.log('  npm run metrics - View detailed analytics');
    console.log('  npm run demo --metrics - Run metrics analysis');
  }
}

// Run demo
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch(console.error);
}

export { runDemo };
export default runDemo;
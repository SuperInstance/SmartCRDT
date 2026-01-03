#!/usr/bin/env node
/**
 * A/B Testing Example
 *
 * This example demonstrates A/B testing for model adapters.
 * Compare different model configurations and measure performance.
 *
 * Run: npx tsx index.ts
 */

interface ABTestResult {
  variant: string;
  query: string;
  response: string;
  latency: number;
  userRating?: number;
  timestamp: number;
}

class ABTestRunner {
  private results: Map<string, ABTestResult[]> = new Map();

  async testVariant(variant: string, query: string): Promise<ABTestResult> {
    const startTime = Date.now();

    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50));

    const response = `[${variant}] Response to: ${query}`;
    const latency = Date.now() - startTime;

    const result: ABTestResult = {
      variant,
      query,
      response,
      latency,
      timestamp: Date.now(),
    };

    if (!this.results.has(variant)) {
      this.results.set(variant, []);
    }
    this.results.get(variant)!.push(result);

    return result;
  }

  getStats(variant: string) {
    const results = this.results.get(variant) || [];
    const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;
    const avgRating = results
      .filter(r => r.userRating)
      .reduce((sum, r) => sum + (r.userRating || 0), 0) / results.filter(r => r.userRating).length;

    return {
      count: results.length,
      avgLatency,
      avgRating: avgRating || 0,
    };
  }

  compare(variants: string[]) {
    console.log('\n📊 A/B Test Results:');
    console.log('='.repeat(70));

    for (const variant of variants) {
      const stats = this.getStats(variant);
      console.log(`\n${variant}:`);
      console.log(`  Tests: ${stats.count}`);
      console.log(`  Avg Latency: ${stats.avgLatency.toFixed(1)}ms`);
      console.log(`  Avg Rating: ${stats.avgRating.toFixed(2)}/5`);
    }

    // Determine winner
    let winner = variants[0];
    let bestScore = 0;

    for (const variant of variants) {
      const stats = this.getStats(variant);
      const score = stats.avgRating / stats.avgLatency * 1000;
      if (score > bestScore) {
        bestScore = score;
        winner = variant;
      }
    }

    console.log(`\n🏆 Winner: ${winner} (score: ${bestScore.toFixed(2)})`);

    return winner;
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║        Aequor A/B Testing Example                                    ║');
  console.log('║        Comparing Model Adapter Performance                           ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const runner = new ABTestRunner();
  const variants = ['baseline-model', 'experimental-model-v1', 'experimental-model-v2'];

  const testQueries = [
    'What is JavaScript?',
    'How do I parse JSON?',
    'Explain async/await',
    'What is a closure?',
    'How do I create a class?',
  ];

  console.log('\n🧪 Running A/B tests...');
  console.log(`Variants: ${variants.join(', ')}`);
  console.log(`Queries: ${testQueries.length}`);

  // Test each variant
  for (const variant of variants) {
    console.log(`\nTesting ${variant}...`);

    for (const query of testQueries) {
      const result = await runner.testVariant(variant, query);
      result.userRating = Math.random() * 2 + 3; // Random 3-5 rating

      console.log(`  ✓ "${query.substring(0, 30)}..." - ${result.latency}ms - ${result.userRating?.toFixed(1)}/5`);
    }
  }

  // Compare results
  const winner = runner.compare(variants);

  console.log('\n' + '='.repeat(70));
  console.log('📋 A/B TESTING SUMMARY');
  console.log('='.repeat(70));

  console.log('\n✅ Key Metrics:');
  console.log('   • Latency (lower is better)');
  console.log('   • User rating (higher is better)');
  console.log('   • Overall score (rating/latency ratio)');

  console.log('\n💡 Best Practices:');
  console.log('   1. Run tests long enough for statistical significance');
  console.log('   2. Randomize query order');
  console.log('   3. Monitor real user feedback');
  console.log('   4. Consider business metrics (cost, quality)');
  console.log('   5. Gradual rollout for winning variant');

  console.log('\n✨ Example complete!');
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});

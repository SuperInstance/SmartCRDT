#!/usr/bin/env node
/**
 * Shadow Logging Example
 *
 * This example demonstrates shadow logging - collecting training data
 * by logging queries and responses without affecting production behavior.
 *
 * Key Concepts:
 * - Shadow mode: Run new models alongside production without user impact
 * - Data collection: Gather queries, responses, and feedback
 * - Privacy: Ensure logged data is properly anonymized
 * - Quality: Filter and validate collected data
 *
 * Run: npx tsx index.ts
 */

interface ShadowLogEntry {
  query: string;
  productionResponse: string;
  shadowResponse?: string;
  timestamp: number;
  latency: number;
  userFeedback?: 'positive' | 'negative' | 'neutral';
  metadata: Record<string, any>;
}

/**
 * Shadow Logger
 */
class ShadowLogger {
  private logs: ShadowLogEntry[] = [];
  private enabled = true;

  constructor(
    private maxSize: number = 10000,
    private anonymize: boolean = true
  ) {}

  /**
   * Log a query-response pair
   */
  log(entry: ShadowLogEntry): void {
    if (!this.enabled) return;

    // Anonymize if enabled
    if (this.anonymize) {
      entry = this.anonymizeEntry(entry);
    }

    // Evict oldest if at capacity
    if (this.logs.length >= this.maxSize) {
      this.logs.shift();
    }

    this.logs.push(entry);
  }

  /**
   * Anonymize sensitive data in log entry
   */
  private anonymizeEntry(entry: ShadowLogEntry): ShadowLogEntry {
    // Simple PII redaction
    const redact = (text: string): string => {
      return text
        .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi, '[EMAIL]')
        .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
        .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CREDIT_CARD]')
        .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');
    };

    return {
      ...entry,
      query: redact(entry.query),
      productionResponse: redact(entry.productionResponse),
      shadowResponse: entry.shadowResponse ? redact(entry.shadowResponse) : undefined,
      metadata: entry.metadata,
    };
  }

  /**
   * Get training data
   */
  getTrainingData(): ShadowLogEntry[] {
    return [...this.logs];
  }

  /**
   * Get filtered training data
   */
  getFilteredData(filter: (entry: ShadowLogEntry) => boolean): ShadowLogEntry[] {
    return this.logs.filter(filter);
  }

  /**
   * Get statistics
   */
  getStats() {
    const total = this.logs.length;
    const withFeedback = this.logs.filter(l => l.userFeedback).length;
    const positive = this.logs.filter(l => l.userFeedback === 'positive').length;
    const negative = this.logs.filter(l => l.userFeedback === 'negative').length;

    const avgLatency = total > 0
      ? this.logs.reduce((sum, l) => sum + l.latency, 0) / total
      : 0;

    return {
      total,
      withFeedback,
      positive,
      negative,
      feedbackRate: total > 0 ? withFeedback / total : 0,
      satisfactionRate: withFeedback > 0 ? positive / withFeedback : 0,
      avgLatency,
    };
  }

  /**
   * Export training data for fine-tuning
   */
  exportForTraining(): string {
    const trainingData = this.logs
      .filter(l => l.userFeedback === 'positive')
      .map(l => ({
        prompt: l.query,
        response: l.productionResponse,
      }));

    return JSON.stringify(trainingData, null, 2);
  }

  /**
   * Clear logs
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * Enable/disable logging
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}

/**
 * Main example execution
 */
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║        Aequor Shadow Logging Example                                  ║');
  console.log('║        Collecting Training Data Without User Impact                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const logger = new ShadowLogger(1000, true);

  console.log('\n📝 Shadow Logger Initialized');
  console.log(`   Max Size: ${logger['maxSize']} entries`);
  console.log(`   Anonymization: ${logger['anonymize'] ? 'enabled' : 'disabled'}`);

  // Phase 1: Simulate shadow logging
  console.log('\n' + '='.repeat(70));
  console.log('🔄 Phase 1: Simulating Shadow Logging');
  console.log('='.repeat(70));

  const mockQueries = [
    { query: 'What is JavaScript?', response: 'JavaScript is a programming language.', feedback: 'positive' as const },
    { query: 'How do I parse JSON?', response: 'Use JSON.parse() to parse JSON strings.', feedback: 'positive' as const },
    { query: 'My email is john@example.com', response: 'I received your email: [EMAIL]', feedback: 'neutral' as const },
    { query: 'Explain async/await', response: 'Async/await is syntax for handling async operations.', feedback: 'positive' as const },
    { query: 'What is a closure?', response: 'A closure is a function with access to outer scope.', feedback: 'negative' as const },
    { query: 'How do I fix memory leaks?', response: 'Use profiling tools to identify leaks.', feedback: 'positive' as const },
    { query: 'What is React?', response: 'React is a UI library for building user interfaces.', feedback: 'positive' as const },
    { query: 'My SSN is 123-45-6789', response: 'Your SSN [SSN] has been redacted.', feedback: 'neutral' as const },
  ];

  for (const mock of mockQueries) {
    const latency = Math.random() * 500 + 100;

    logger.log({
      query: mock.query,
      productionResponse: mock.response,
      timestamp: Date.now(),
      latency,
      userFeedback: mock.feedback,
      metadata: {
        model: 'production-v1',
        version: '1.0.0',
      },
    });

    const emoji = mock.feedback === 'positive' ? '👍' : mock.feedback === 'negative' ? '👎' : '😐';
    console.log(`  ${emoji} Logged: "${mock.query.substring(0, 40)}..." (${feedbackLabel(mock.feedback)})`);
  }

  // Phase 2: Statistics
  console.log('\n' + '='.repeat(70));
  console.log('📊 Phase 2: Logging Statistics');
  console.log('='.repeat(70));

  const stats = logger.getStats();

  console.log('\n📈 Collection Stats:');
  console.log(`  Total Entries: ${stats.total}`);
  console.log(`  With Feedback: ${stats.withFeedback} (${(stats.feedbackRate * 100).toFixed(1)}%)`);
  console.log(`  Positive: ${stats.positive}`);
  console.log(`  Negative: ${stats.negative}`);
  console.log(`  Satisfaction Rate: ${(stats.satisfactionRate * 100).toFixed(1)}%`);
  console.log(`  Avg Latency: ${stats.avgLatency.toFixed(0)}ms`);

  // Phase 3: Filter data
  console.log('\n' + '='.repeat(70));
  console.log('🔍 Phase 3: Filtered Data');
  console.log('='.repeat(70));

  const positiveData = logger.getFilteredData(l => l.userFeedback === 'positive');
  console.log(`\nPositive Feedback Entries: ${positiveData.length}`);

  const negativeData = logger.getFilteredData(l => l.userFeedback === 'negative');
  console.log(`Negative Feedback Entries: ${negativeData.length}`);

  const highLatencyData = logger.getFilteredData(l => l.latency > 400);
  console.log(`High Latency Entries (>400ms): ${highLatencyData.length}`);

  // Phase 4: Export for training
  console.log('\n' + '='.repeat(70));
  console.log('💾 Phase 4: Export Training Data');
  console.log('='.repeat(70));

  const trainingJson = logger.exportForTraining();
  const trainingData = JSON.parse(trainingJson);

  console.log(`\nExported ${trainingData.length} high-quality entries for training`);
  console.log('\nSample Entry:');
  if (trainingData.length > 0) {
    console.log(JSON.stringify(trainingData[0], null, 2));
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📋 SHADOW LOGGING SUMMARY');
  console.log('='.repeat(70));

  console.log('\n✅ Benefits:');
  console.log('   • Collect training data without user impact');
  console.log('   • Compare model versions safely');
  console.log('   • Gather real-world query patterns');
  console.log('   • Improve model quality over time');

  console.log('\n🎯 Use Cases:');
  console.log('   1. New model testing (shadow mode)');
  console.log('   2. Data collection for fine-tuning');
  console.log('   3. Performance benchmarking');
  console.log('   4. Quality assurance');

  console.log('\n💡 Best Practices:');
  console.log('   1. Always anonymize PII before logging');
  console.log('   2. Monitor storage limits');
  console.log('   3. Filter low-quality data');
  console.log('   4. Use feedback to prioritize data');
  console.log('   5. Regular data export and cleanup');

  console.log('\n⚠️  Considerations:');
  console.log('   • Storage costs (log data grows quickly)');
  console.log('   • Privacy compliance (GDPR, CCPA)');
  console.log('   • Data quality (garbage in, garbage out)');
  console.log('   • Retention policies (don\'t keep data forever)');

  console.log('\n✨ Example complete!');
}

function feedbackLabel(feedback: string): string {
  switch (feedback) {
    case 'positive': return 'good';
    case 'negative': return 'bad';
    case 'neutral': return 'ok';
    default: return 'unknown';
  }
}

// Run the example
main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});

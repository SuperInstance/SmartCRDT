#!/usr/bin/env node
/**
 * Privacy Classifier Example
 *
 * This example demonstrates automatic privacy sensitivity classification
 * for user queries before processing.
 *
 * Privacy Levels:
 * - PUBLIC: Safe to process anywhere
 * - LOGIC: Contains business logic, safe for cloud
 * - STYLE: Writing style/preferences, rewrite for privacy
 * - SECRET: Sensitive data, require redaction or local-only processing
 *
 * Features demonstrated:
 * - Pattern-based PII detection
 * - Keyword-based classification
 * - Confidence scoring
 * - Multi-category classification
 * - Privacy policy enforcement
 *
 * Run: npx tsx index.ts
 */

type PrivacyLevel = 'PUBLIC' | 'LOGIC' | 'STYLE' | 'SECRET';

interface ClassificationResult {
  level: PrivacyLevel;
  confidence: number;
  categories: string[];
  detectedPatterns: string[];
  recommendation: string;
}

/**
 * Privacy Classifier
 */
class PrivacyClassifier {
  // PII patterns
  private readonly patterns = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
    phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b|\b\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/g,
    ssn: /\b\d{3}-\d{2}-\d{4}\b|\b\d{3}\s\d{2}\s\d{4}\b/g,
    creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    ipAddress: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    url: /\bhttps?:\/\/[^\s]+/gi,
  };

  // Sensitive keywords
  private readonly secretKeywords = [
    'password', 'ssn', 'social security', 'credit card', 'api key',
    'secret', 'token', 'private key', 'pin', 'bank account',
    'medical record', 'health', 'diagnosis', 'prescription',
    'salary', 'income', 'tax return', 'social security number',
  ];

  // Style-related keywords
  private readonly styleKeywords = [
    'i think', 'i believe', 'in my opinion', 'i prefer',
    'my style', 'i like', 'i usually', 'my approach',
    'personally', 'from my perspective',
  ];

  // Business logic keywords
  private readonly logicKeywords = [
    'how to', 'explain', 'what is', 'how does', 'algorithm',
    'function', 'method', 'class', 'implement', 'code',
    'debug', 'error', 'fix', 'optimize', 'refactor',
  ];

  /**
   * Classify query privacy level
   */
  classify(query: string): ClassificationResult {
    const lowerQuery = query.toLowerCase();
    const detectedPatterns: string[] = [];
    const categories: string[] = [];
    let confidence = 0;
    let level: PrivacyLevel = 'PUBLIC';

    // Check for PII patterns
    for (const [name, pattern] of Object.entries(this.patterns)) {
      if (pattern.test(query)) {
        detectedPatterns.push(name);
        categories.push(`pii:${name}`);
      }
    }

    // Check for secret keywords
    const secretMatches = this.secretKeywords.filter(keyword =>
      lowerQuery.includes(keyword)
    );

    if (secretMatches.length > 0) {
      categories.push('sensitive-data');
      detectedPatterns.push(...secretMatches);
    }

    // Check for style keywords
    const styleMatches = this.styleKeywords.filter(keyword =>
      lowerQuery.includes(keyword)
    );

    if (styleMatches.length > 0) {
      categories.push('personal-style');
    }

    // Check for logic keywords
    const logicMatches = this.logicKeywords.filter(keyword =>
      lowerQuery.includes(keyword)
    );

    if (logicMatches.length > 0) {
      categories.push('business-logic');
    }

    // Determine privacy level
    if (detectedPatterns.some(p => ['email', 'phone', 'ssn', 'creditCard', 'ipAddress'].includes(p))) {
      level = 'SECRET';
      confidence = 0.95;
    } else if (secretMatches.length > 0) {
      level = 'SECRET';
      confidence = Math.min(0.9, 0.6 + secretMatches.length * 0.1);
    } else if (styleMatches.length > 2) {
      level = 'STYLE';
      confidence = Math.min(0.8, 0.5 + styleMatches.length * 0.1);
    } else if (logicMatches.length > 0) {
      level = 'LOGIC';
      confidence = 0.7;
    } else {
      level = 'PUBLIC';
      confidence = 0.8;
    }

    // Generate recommendation
    const recommendation = this.getRecommendation(level, categories);

    return {
      level,
      confidence,
      categories,
      detectedPatterns,
      recommendation,
    };
  }

  /**
   * Get privacy recommendation
   */
  private getRecommendation(level: PrivacyLevel, categories: string[]): string {
    switch (level) {
      case 'SECRET':
        return 'Block or redact sensitive data. Process locally only.';
      case 'STYLE':
        return 'Rewrite query to remove personal style before sending to cloud.';
      case 'LOGIC':
        return 'Safe to process in cloud. Contains business logic only.';
      case 'PUBLIC':
        return 'Safe to process anywhere. No sensitive information detected.';
      default:
        return 'Manual review required.';
    }
  }

  /**
   * Batch classify multiple queries
   */
  classifyBatch(queries: string[]): ClassificationResult[] {
    return queries.map(q => this.classify(q));
  }
}

/**
 * Display classification result
 */
function displayClassification(query: string, result: ClassificationResult) {
  const levelEmoji: Record<PrivacyLevel, string> = {
    PUBLIC: '🟢',
    LOGIC: '🔵',
    STYLE: '🟡',
    SECRET: '🔴',
  };

  console.log(`\n${levelEmoji[result.level]} ${result.level}`);
  console.log(`Query: "${query}"`);
  console.log(`Confidence: ${(result.confidence * 100).toFixed(0)}%`);
  console.log(`Categories: ${result.categories.length > 0 ? result.categories.join(', ') : 'none'}`);

  if (result.detectedPatterns.length > 0) {
    console.log(`Detected: ${result.detectedPatterns.join(', ')}`);
  }

  console.log(`Recommendation: ${result.recommendation}`);
}

/**
 * Main example execution
 */
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║        Aequor Privacy Classifier Example                             ║');
  console.log('║        Automatic Privacy Sensitivity Classification                  ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const classifier = new PrivacyClassifier();

  console.log('\n🔍 Privacy Levels:');
  console.log('   🟢 PUBLIC     - Safe to process anywhere');
  console.log('   🔵 LOGIC      - Business logic, safe for cloud');
  console.log('   🟡 STYLE      - Personal style, rewrite for privacy');
  console.log('   🔴 SECRET     - Sensitive data, local-only or redact');

  // Phase 1: Classify various query types
  console.log('\n' + '='.repeat(70));
  console.log('📊 Phase 1: Query Classification Examples');
  console.log('='.repeat(70));

  const testQueries = [
    {
      query: 'What is the capital of France?',
      expected: 'PUBLIC',
    },
    {
      query: 'How do I implement a binary search tree?',
      expected: 'LOGIC',
    },
    {
      query: 'I think the best approach is to start with the user story',
      expected: 'STYLE',
    },
    {
      query: 'My email is john@example.com',
      expected: 'SECRET',
    },
    {
      query: 'I forgot my password and need to reset it',
      expected: 'SECRET',
    },
    {
      query: 'What is async/await in JavaScript?',
      expected: 'LOGIC',
    },
    {
      query: 'Personally, I prefer using functional programming patterns',
      expected: 'STYLE',
    },
    {
      query: 'Call me at 555-123-4567 for details',
      expected: 'SECRET',
    },
    {
      query: 'My SSN is 123-45-6789',
      expected: 'SECRET',
    },
    {
      query: 'Explain the difference between REST and GraphQL',
      expected: 'LOGIC',
    },
  ];

  let correct = 0;

  for (const test of testQueries) {
    const result = classifier.classify(test.query);
    displayClassification(test.query, result);

    if (result.level === test.expected) {
      correct++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 Classification Accuracy');
  console.log('='.repeat(70));
  console.log(`Correct: ${correct}/${testQueries.length} (${((correct / testQueries.length) * 100).toFixed(0)}%)`);

  // Phase 2: Batch classification
  console.log('\n' + '='.repeat(70));
  console.log('📋 Phase 2: Batch Classification');
  console.log('='.repeat(70));

  const batchQueries = [
    'How do I parse JSON in Python?',
    'My credit card number is 1234-5678-9012-3456',
    'In my opinion, React is better than Angular',
    'What is a REST API?',
    'My API key is sk-1234567890abcdef',
  ];

  const batchResults = classifier.classifyBatch(batchQueries);

  console.log('\nBatch Classification Results:');
  for (let i = 0; i < batchQueries.length; i++) {
    const result = batchResults[i];
    const emoji = result.level === 'SECRET' ? '🔴' : result.level === 'STYLE' ? '🟡' : result.level === 'LOGIC' ? '🔵' : '🟢';
    console.log(`${emoji} ${result.level.padEnd(7)} - "${batchQueries[i]}"`);
  }

  // Phase 3: Statistics
  console.log('\n' + '='.repeat(70));
  console.log('📈 Phase 3: Classification Statistics');
  console.log('='.repeat(70));

  const levelCounts = batchResults.reduce((acc, r) => {
    acc[r.level] = (acc[r.level] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\nDistribution:');
  for (const [level, count] of Object.entries(levelCounts)) {
    const emoji = level === 'SECRET' ? '🔴' : level === 'STYLE' ? '🟡' : level === 'LOGIC' ? '🔵' : '🟢';
    console.log(`  ${emoji} ${level}: ${count} (${((count / batchResults.length) * 100).toFixed(0)}%)`);
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📋 PRIVACY CLASSIFIER SUMMARY');
  console.log('='.repeat(70));

  console.log('\n✅ Detection Capabilities:');
  console.log('   • PII patterns (email, phone, SSN, credit card, IP address)');
  console.log('   • Sensitive keywords (passwords, API keys, medical data)');
  console.log('   • Personal style indicators (opinions, preferences)');
  console.log('   • Business logic queries (technical questions)');

  console.log('\n🎯 Privacy Levels Explained:');
  console.log('');
  console.log('   PUBLIC:');
  console.log('   • No sensitive information');
  console.log('   • Safe to process anywhere');
  console.log('   • Example: "What is the capital of France?"');
  console.log('');
  console.log('   LOGIC:');
  console.log('   • Business/technical content only');
  console.log('   • Safe for cloud processing');
  console.log('   • Example: "How do I implement binary search?"');
  console.log('');
  console.log('   STYLE:');
  console.log('   • Contains personal writing style');
  console.log('   • Rewrite before sending to cloud');
  console.log('   • Example: "I prefer functional programming"');
  console.log('');
  console.log('   SECRET:');
  console.log('   • Contains sensitive PII or data');
  console.log('   • Process locally only or redact');
  console.log('   • Example: "My email is john@example.com"');

  console.log('\n💡 Use Cases:');
  console.log('   1. Pre-processing query routing');
  console.log('   2. Privacy policy enforcement');
  console.log('   3. Automated redaction decisions');
  console.log('   4. Compliance monitoring (GDPR, HIPAA)');
  console.log('   5. User privacy controls');

  console.log('\n🔧 Integration Points:');
  console.log('   • Query router (before routing decision)');
  console.log('   • Intent encoder (before encoding)');
  console.log('   • Redaction service (what to redact)');
  console.log('   • Audit logging (track sensitive queries)');

  console.log('\n⚠️  Limitations:');
  console.log('   • Pattern-based (may miss obfuscated PII)');
  console.log('   • Context-dependent (may have false positives)');
  console.log('   • Language-specific (primarily English)');
  console.log('   • Not a substitute for human review');

  console.log('\n🚀 Next Steps:');
  console.log('   1. Add ML-based classification for better accuracy');
  console.log('   2. Support for custom pattern definitions');
  console.log('   3. Multi-language support');
  console.log('   4. Context-aware classification');
  console.log('   5. User feedback integration');

  console.log('\n✨ Example complete!');
}

// Run the example
main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});

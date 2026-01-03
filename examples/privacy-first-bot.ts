/**
 * Privacy-First Bot Example
 *
 * This example demonstrates how to build a privacy-first AI bot that:
 * 1. Encodes queries as intent vectors (no plaintext sent to cloud)
 * 2. Redacts PII before processing
 * 3. Applies differential privacy for noise injection
 * 4. Validates privacy guarantees
 *
 * @package @lsi/privacy
 * @example
 */

import {
  IntentEncoder,
  PrivacyClassifier,
  RedactionAdditionProtocol,
  type PrivacyLevel,
  type PrivacyClassification,
  type RedactionResult,
} from '@lsi/privacy';

/**
 * Example 1: Intent Encoding
 *
 * Encode queries as 768-dimensional vectors before cloud transmission.
 * The cloud model sees only the intent, not the actual text.
 */
async function intentEncodingExample() {
  console.log('=== Example 1: Intent Encoding ===\n');

  const encoder = new IntentEncoder({
    embeddingDimension: 768,
    enableDifferentialPrivacy: true,
    epsilon: 1.0, // Privacy budget
  });

  // Original query with PII
  const originalQuery = 'My email is user@example.com and my phone is 555-1234';

  try {
    // Encode query as intent vector
    const intentVector = await encoder.encode(originalQuery);

    console.log(`Original: "${originalQuery}"`);
    console.log(`Intent Vector Dimensions: ${intentVector.length}`);
    console.log(`First 5 values: [${intentVector.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
    console.log(`Vector norm: ${Math.sqrt(intentVector.reduce((sum, v) => sum + v * v, 0)).toFixed(4)}`);

    // The intent vector can be sent to cloud without exposing original text
    console.log('\n✓ Intent encoded successfully');
    console.log('  Cloud receives: [768-dim vector only]');
    console.log('  Original text: Never leaves device');
  } catch (error) {
    console.error('✗ Encoding failed:', error);
  }
}

/**
 * Example 2: Privacy Classification
 *
 * Classify query sensitivity before routing.
 */
async function privacyClassificationExample() {
  console.log('\n=== Example 2: Privacy Classification ===\n');

  const classifier = new PrivacyClassifier();

  const queries = [
    'What is the capital of France?',
    'My SSN is 123-45-6789',
    'Reset my password',
    'How do I optimize database queries?',
    'My credit card number is 4111-1111-1111-1111',
  ];

  for (const query of queries) {
    const classification: PrivacyClassification = await classifier.classify(query);

    console.log(`Query: "${query}"`);
    console.log(`  Level: ${classification.level}`);
    console.log(`  Confidence: ${(classification.confidence * 100).toFixed(1)}%`);
    console.log(`  PII Detected: ${classification.piiTypes.length > 0 ? classification.piiTypes.join(', ') : 'None'}`);
    console.log(`  Recommendation: ${classification.recommendedAction}`);
    console.log();
  }
}

/**
 * Example 3: Redaction-Addition Protocol (R-A)
 *
 * Redact sensitive information locally, send structural query,
 * and re-hydrate response with original context.
 */
async function redactionAdditionExample() {
  console.log('\n=== Example 3: Redaction-Addition Protocol ===\n');

  const rap = new RedactionAdditionProtocol({
    redactionToken: '[REDACTED]',
    preserveStructure: true,
    enableContextualRedaction: true,
  });

  const originalQuery = 'My email is john.doe@example.com and my SSN is 123-45-6789. Please help me reset my password.';

  try {
    // Step 1: Redact locally
    const redactionResult: RedactionResult = await rap.redact(originalQuery);

    console.log('Step 1: Local Redaction');
    console.log(`  Original: "${originalQuery}"`);
    console.log(`  Redacted: "${redactionResult.redactedQuery}"`);
    console.log(`  PII Found: ${redactionResult.detectedPII.map(p => p.type).join(', ')}`);

    // Step 2: Send structural query to cloud
    const structuralQuery = redactionResult.redactedQuery;
    console.log('\nStep 2: Send to Cloud');
    console.log(`  Structural Query: "${structuralQuery}"`);
    console.log('  Cloud sees: Query structure without PII');

    // Step 3: Simulate cloud response
    const cloudResponse = 'To reset your password for [REDACTED], please verify your identity using [REDACTED].';

    // Step 4: Re-hydrate response locally
    const rehydratedResponse = rap.rehydrate(cloudResponse, redactionResult);

    console.log('\nStep 3: Re-hydrate Response');
    console.log(`  Cloud Response: "${cloudResponse}"`);
    console.log(`  Re-hydrated: "${rehydratedResponse}"`);
    console.log('\n✓ Privacy preserved while maintaining functionality');
  } catch (error) {
    console.error('✗ R-A Protocol failed:', error);
  }
}

/**
 * Example 4: Differential Privacy
 *
 * Add calibrated noise to embeddings for ε-differential privacy.
 */
async function differentialPrivacyExample() {
  console.log('\n=== Example 4: Differential Privacy ===\n');

  const encoder = new IntentEncoder({
    embeddingDimension: 768,
    enableDifferentialPrivacy: true,
    epsilon: 1.0, // Privacy parameter
    delta: 1e-5, // Failure probability
    mechanism: 'gaussian', // Noise mechanism
  });

  const query = 'What is machine learning?';

  // Encode multiple times to see noise variation
  const encodings = await Promise.all([
    encoder.encode(query),
    encoder.encode(query),
    encoder.encode(query),
  ]);

  console.log(`Query: "${query}"`);
  console.log('\nEncoding with ε=1.0 (Differential Privacy):');
  console.log('  Encoding 1 [0-5]:', encodings[0].slice(0, 5).map(v => v.toFixed(4)));
  console.log('  Encoding 2 [0-5]:', encodings[1].slice(0, 5).map(v => v.toFixed(4)));
  console.log('  Encoding 3 [0-5]:', encodings[2].slice(0, 5).map(v => v.toFixed(4)));

  // Calculate variance
  const meanFirst = encodings.reduce((sum, enc) => sum + enc[0], 0) / encodings.length;
  const variance = encodings.reduce((sum, enc) => sum + Math.pow(enc[0] - meanFirst, 2), 0) / encodings.length;

  console.log(`\nVariance (first dimension): ${variance.toFixed(6)}`);
  console.log('✓ Noise injected successfully prevents exact reconstruction');
}

/**
 * Example 5: Privacy Budget Tracking
 *
 * Track privacy consumption over multiple queries.
 */
async function privacyBudgetExample() {
  console.log('\n=== Example 5: Privacy Budget Tracking ===\n');

  const encoder = new IntentEncoder({
    embeddingDimension: 768,
    enableDifferentialPrivacy: true,
    epsilon: 1.0,
    delta: 1e-5,
  });

  const queries = [
    'What is AI?',
    'How does ML work?',
    'Explain neural networks',
    'What is deep learning?',
  ];

  console.log('Privacy Budget: ε = 1.0');
  console.log('Consuming budget per query:\n');

  for (let i = 0; i < queries.length; i++) {
    const beforeBudget = encoder.getRemainingBudget();
    await encoder.encode(queries[i]);
    const afterBudget = encoder.getRemainingBudget();

    const consumed = beforeBudget.epsilon - afterBudget.epsilon;

    console.log(`Query ${i + 1}: "${queries[i]}"`);
    console.log(`  Consumed: ε = ${consumed.toFixed(3)}`);
    console.log(`  Remaining: ε = ${afterBudget.epsilon.toFixed(3)}`);

    if (afterBudget.epsilon < 0.1) {
      console.log('  ⚠️  WARNING: Privacy budget nearly exhausted!');
    }
  }

  console.log('\n✓ Budget tracking prevents privacy leakage');
}

/**
 * Example 6: Privacy-First Bot Architecture
 *
 * Complete example showing end-to-end privacy-preserving bot.
 */
class PrivacyFirstBot {
  private encoder: IntentEncoder;
  private classifier: PrivacyClassifier;
  private rap: RedactionAdditionProtocol;

  constructor() {
    this.encoder = new IntentEncoder({
      embeddingDimension: 768,
      enableDifferentialPrivacy: true,
      epsilon: 1.0,
    });

    this.classifier = new PrivacyClassifier();

    this.rap = new RedactionAdditionProtocol({
      redactionToken: '[REDACTED]',
      preserveStructure: true,
    });
  }

  async processQuery(query: string): Promise<{
    originalLevel: PrivacyLevel;
    route: 'local' | 'cloud';
    response: string;
  }> {
    try {
      // Step 1: Classify privacy level
      const classification = await this.classifier.classify(query);

      console.log(`\nProcessing: "${query}"`);
      console.log(`  Privacy Level: ${classification.level}`);

      // Step 2: Decide routing based on privacy
      if (classification.level === 'SECRET' || classification.level === 'CONFIDENTIAL') {
        // High-sensitivity queries stay local
        console.log('  Route: LOCAL (privacy-sensitive)');
        return {
          originalLevel: classification.level,
          route: 'local',
          response: 'Processed locally with full privacy',
        };
      }

      // Step 3: For cloud queries, apply R-A protocol
      const redacted = await this.rap.redact(query);
      console.log(`  Route: CLOUD (privacy-safe)`);
      console.log(`  Redacted: "${redacted.redactedQuery}"`);

      // Step 4: Encode as intent vector
      const intent = await this.encoder.encode(redacted.redactedQuery);
      console.log(`  Intent Vector: [${intent.length} dimensions]`);

      return {
        originalLevel: classification.level,
        route: 'cloud',
        response: 'Processed via cloud with privacy protection',
      };
    } catch (error) {
      console.error('Bot processing failed:', error);
      throw error;
    }
  }
}

async function privacyBotExample() {
  console.log('\n=== Example 6: Privacy-First Bot ===\n');

  const bot = new PrivacyFirstBot();

  const testQueries = [
    'What is the weather today?',
    'My SSN is 123-45-6789, help me with taxes',
    'How do I write a for loop?',
    'My credit card is 4111-1111-1111-1111, reset my account',
  ];

  for (const query of testQueries) {
    const result = await bot.processQuery(query);
    console.log(`  Result: ${result.response}\n`);
  }

  console.log('✓ All queries processed with appropriate privacy measures');
}

/**
 * Run all examples
 */
async function main() {
  try {
    await intentEncodingExample();
    await privacyClassificationExample();
    await redactionAdditionExample();
    await differentialPrivacyExample();
    await privacyBudgetExample();
    await privacyBotExample();

    console.log('\n=== All Privacy Examples Completed ===');
  } catch (error) {
    console.error('Example failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

export {
  intentEncodingExample,
  privacyClassificationExample,
  redactionAdditionExample,
  differentialPrivacyExample,
  privacyBudgetExample,
  privacyBotExample,
  PrivacyFirstBot,
};

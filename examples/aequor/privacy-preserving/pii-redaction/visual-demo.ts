#!/usr/bin/env node
/**
 * Visual PII Redaction Demo
 *
 * Demonstrates automatic PII detection and redaction with visual before/after
 * comparisons and detailed statistics.
 */

import { SemanticPIIRedactor, RedactionStrategy, PIIType } from '@lsi/privacy';

interface RedactionExample {
  original: string;
  description: string;
  expectedPII: string[];
}

interface RedactionResult {
  original: string;
  redacted: string;
  piiDetected: number;
  piiTypes: string[];
  strategy: RedactionStrategy;
  diff: string;
}

/**
 * Create a visual diff showing redactions
 */
function createDiff(original: string, redacted: string): string {
  const lines: string[] = [];

  // Simple word-by-word comparison
  const origWords = original.split(/(\s+)/);
  const redWords = redacted.split(/(\s+)/);

  let i = 0;
  let j = 0;

  while (i < origWords.length || j < redWords.length) {
    if (i >= origWords.length) {
      lines.push(`\x1b[32m+ ${redWords[j]}\x1b[0m`);
      j++;
    } else if (j >= redWords.length) {
      lines.push(`\x1b[31m- ${origWords[i]}\x1b[0m`);
      i++;
    } else if (origWords[i] === redWords[j]) {
      lines.push(`  ${origWords[i]}`);
      i++;
      j++;
    } else {
      // Word changed (redacted)
      lines.push(`\x1b[31m- ${origWords[i]}\x1b[0m`);
      lines.push(`\x1b[32m+ ${redWords[j]}\x1b[0m`);
      i++;
      j++;
    }
  }

  return lines.join('');
}

/**
 * Display redaction statistics
 */
function displayStats(results: RedactionResult[]): void {
  console.log('\n📊 REDACTION STATISTICS:\n');

  const totalPII = results.reduce((sum, r) => sum + r.piiDetected, 0);
  const piiTypeCount = new Map<string, number>();

  for (const result of results) {
    for (const type of result.piiTypes) {
      piiTypeCount.set(type, (piiTypeCount.get(type) || 0) + 1);
    }
  }

  console.log(`  Total Redactions: ${totalPII}`);
  console.log(`  Queries Processed: ${results.length}`);
  console.log(`  Average per Query: ${(totalPII / results.length).toFixed(1)}`);

  console.log('\n  PII Types Detected:');
  for (const [type, count] of Array.from(piiTypeCount.entries()).sort((a, b) => b[1] - a[1])) {
    const bar = '█'.repeat(Math.round((count / totalPII) * 20));
    console.log(`    ${type.padEnd(20)} ${bar} ${count}`);
  }
}

/**
 * Display a single redaction result with visual formatting
 */
function displayResult(result: RedactionResult): void {
  console.log('\n' + '─'.repeat(70));

  // Original text
  console.log('\n❌ ORIGINAL (UNSAFE):');
  console.log(`  "${result.original}"`);

  // Redacted text
  console.log('\n✅ REDACTED (SAFE):');
  console.log(`  "${result.redacted}"`);

  // Statistics
  console.log('\n📈 ANALYSIS:');
  console.log(`  PII Detected: ${result.piiDetected} instance(s)`);
  console.log(`  PII Types: ${result.piiTypes.join(', ') || 'None'}`);
  console.log(`  Strategy: ${result.strategy.toUpperCase()}`);

  // Visual diff
  console.log('\n🔍 DIFF:');
  console.log('  ' + '─'.repeat(66));
  console.log('  ' + createDiff(result.original, result.redacted).split('\n').join('\n  '));
  console.log('  ' + '─'.repeat(66));
}

/**
 * Create strategy comparison table
 */
function compareStrategies(text: string, strategies: RedactionStrategy[]): void {
  console.log('\n📋 STRATEGY COMPARISON:');
  console.log('  ' + '─'.repeat(66));

  for (const strategy of strategies) {
    const redactor = new SemanticPIIRedactor({ defaultStrategy: strategy });
    const result = redactor.redact(text);

    console.log(`  \n  ${strategy.toUpperCase()}:`);
    console.log(`    "${result.redacted}"`);
  }

  console.log('\n  ' + '─'.repeat(66));
}

async function main() {
  console.clear();
  console.log('╔' + '═'.repeat(68) + '╗');
  console.log('║' + '  AEQUOR PII REDACTION - VISUAL DEMO  '.padEnd(68) + '║');
  console.log('╚' + '═'.repeat(68) + '╝');
  console.log('\nDemonstrating automatic PII detection and redaction with visual comparisons\n');

  const examples: RedactionExample[] = [
    {
      original: 'My email is john.doe@example.com and my phone is 555-123-4567.',
      description: 'Contact Information',
      expectedPII: ['EMAIL', 'PHONE'],
    },
    {
      original: 'My SSN is 123-45-6789 and I live at 123 Main St, Springfield, IL 62701.',
      description: 'Identity Information',
      expectedPII: ['SSN', 'ADDRESS'],
    },
    {
      original: 'Please charge my credit card 4532-1234-5678-9010 for the purchase.',
      description: 'Financial Information',
      expectedPII: ['CREDIT_CARD'],
    },
    {
      original: 'My date of birth is 01/15/1980 and my passport number is P1234567.',
      description: 'Personal Documents',
      expectedPII: ['DATE_OF_BIRTH', 'PASSPORT'],
    },
    {
      original: 'Connect to the server at 192.168.1.1 using admin:secret123.',
      description: 'Technical Information',
      expectedPII: ['IP_ADDRESS'],
    },
    {
      original: 'Dr. Smith prescribed medication for patient John Doe.',
      description: 'Healthcare Information',
      expectedPII: ['NAME'],
    },
  ];

  const results: RedactionResult[] = [];

  // Test each redaction strategy
  const strategies = [
    RedactionStrategy.FULL,
    RedactionStrategy.PARTIAL,
    RedactionStrategy.TOKEN,
  ];

  console.log('⏳ Processing examples with different redaction strategies...\n');

  // Process with FULL strategy (default)
  const redactor = new SemanticPIIRedactor({
    defaultStrategy: RedactionStrategy.FULL,
    confidenceThreshold: 0.7,
  });

  for (let i = 0; i < examples.length; i++) {
    const example = examples[i];
    console.log(`[${i + 1}/${examples.length}] Processing: ${example.description}`);

    const redacted = redactor.redact(example.original, RedactionStrategy.FULL);

    results.push({
      original: example.original,
      redacted: redacted.redacted,
      piiDetected: redacted.redactionCount,
      piiTypes: redacted.piiInstances.map(p => p.type),
      strategy: RedactionStrategy.FULL,
      diff: createDiff(example.original, redacted.redacted),
    });
  }

  console.log('\n✅ Processing complete!\n');

  // Display results
  for (const result of results) {
    displayResult(result);
  }

  // Display statistics
  displayStats(results);

  // Strategy comparison example
  console.log('\n' + '╔' + '═'.repeat(68) + '╗');
  console.log('║' + '  REDACTION STRATEGY COMPARISON  '.padEnd(68) + '║');
  console.log('╚' + '═'.repeat(68) + '╝');

  const comparisonText = 'Contact me at john@example.com or call 555-123-4567.';
  console.log(`\nOriginal: "${comparisonText}"\n`);

  compareStrategies(comparisonText, strategies);

  // PII types reference
  console.log('\n' + '╔' + '═'.repeat(68) + '╗');
  console.log('║' + '  SUPPORTED PII TYPES  '.padEnd(68) + '║');
  console.log('╚' + '═'.repeat(68) + '╝');

  console.log(`
┌────────────────────┬────────────────────────────────────────┐
│ PII Type           │ Example Pattern                        │
├────────────────────┼────────────────────────────────────────┤
│ EMAIL              │ user@domain.tld                        │
│ PHONE              │ (123) 456-7890, 123-456-7890           │
│ SSN                │ 123-45-6789                            │
│ CREDIT_CARD        │ 4532-1234-5678-9010                    │
│ IP_ADDRESS         │ 192.168.1.1                            │
│ ADDRESS            │ 123 Main St, City, ST 12345            │
│ NAME               │ John Smith                             │
│ DATE_OF_BIRTH      │ DOB: 01/15/1980                        │
│ PASSPORT           │ Passport # AB1234567                   │
│ DRIVERS_LICENSE    │ DL# 12345678                           │
│ BANK_ACCOUNT       │ Account# 123456789                     │
│ MEDICAL_RECORD     │ MRN 12345678                           │
└────────────────────┴────────────────────────────────────────┘
`);

  // Feature highlights
  console.log('╔' + '═'.repeat(68) + '╗');
  console.log('║' + '  KEY FEATURES  '.padEnd(68) + '║');
  console.log('╚' + '═'.repeat(68) + '╝');

  console.log(`
✅ AUTOMATIC DETECTION
   • 12 PII types with regex + context-aware patterns
   • Configurable confidence threshold (default: 0.7)
   • Overlap resolution for multi-type PII

✅ MULTIPLE STRATEGIES
   • FULL: Complete replacement with [REDACTED_TYPE]
   • PARTIAL: Mask sensitive characters (j***@example.com)
   • TOKEN: Unique token markers [TYPE:id] for re-hydration

✅ CONTEXT-AWARE
   • Distinguishes "email me at..." from "email the report"
   • Confidence scoring for each detection
   • Reduces false positives with semantic analysis

✅ ROUNDTRIP SUPPORT
   • Redact locally → Process remotely → Re-hydrate locally
   • Token mapping never leaves device
   • Perfect restoration guarantee
`);

  console.log('═'.repeat(70));
  console.log('Demo complete! Your PII is protected with Aequor.');
  console.log('═'.repeat(70));
}

main().catch(console.error);

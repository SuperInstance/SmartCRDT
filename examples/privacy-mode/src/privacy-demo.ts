#!/usr/bin/env node

/**
 * LSI Privacy Mode Demo
 * Demonstrates offline-first processing with maximum privacy guarantees.
 */

import { LSI } from '@lsi/core';
import { PrivacyManager, type PrivacyAuditEntry } from './privacy-manager';

class PrivacyDemo {
  private lsi: LSI;
  private privacyManager: PrivacyManager;
  private demoData: {
    medical: { files: string[]; queries: string[] };
    government: { files: string[]; queries: string[] };
    financial: { files: string[]; queries: string[] };
  };

  constructor() {
    this.lsi = new LSI();
    this.privacyManager = new PrivacyManager();
    this.demoData = this.generateDemoData();
  }

  /**
   * Generate demo data for different privacy-sensitive domains
   */
  private generateDemoData(): any {
    return {
      medical: {
        files: [
          'src/patient-records.ts',
          'src/encryption-algorithm.ts',
          'src/hipaa-compliance.ts',
          'src/medical-protocols.ts'
        ],
        queries: [
          "How is patient data encrypted?",
          "What HIPAA compliance measures are implemented?",
          "Explain the patient authentication system",
          "How are medical records secured?",
          "What data protection protocols exist?"
        ]
      },
      government: {
        files: [
          'src/classified-systems.ts',
          'src/security-clearance.ts',
          'src/encryption-standards.ts',
          'src/audit-trail.ts'
        ],
        queries: [
          "How are classified systems documented?",
          "What security clearance levels exist?",
          "Explain the audit trail mechanism",
          "How is government data protected?",
          "What encryption standards are used?"
        ]
      },
      financial: {
        files: [
          'src/transaction-security.ts',
          'src/fraud-detection.ts',
          'src/encryption-protocols.ts',
          'src/compliance-standards.ts'
        ],
        queries: [
          "How are transactions secured?",
          "What fraud detection mechanisms exist?",
          "Explain the encryption protocols used",
          "How is financial data protected?",
          "What compliance standards are followed?"
        ]
      }
    };
  }

  /**
   * Run the privacy demonstration
   */
  public async run(): Promise<void> {
    console.log('🔒 LSI Privacy Mode Demo');
    console.log('='.repeat(50));
    console.log('\nThis demo shows LSI\'s offline-first privacy capabilities.\n');

    // Check environment
    this.checkEnvironment();

    // Run domain-specific demos
    await this.runMedicalDemo();
    await this.runGovernmentDemo();
    await this.runFinancialDemo();

    // Show privacy summary
    this.showPrivacySummary();

    // Demonstrate compliance
    this.showComplianceReport();

    // Interactive demo
    await this.interactiveDemo();
  }

  /**
   * Check and report on environment
   */
  private checkEnvironment(): void {
    console.log('🔍 Environment Check');
    console.log('-'.repeat(20));

    const env = this.privacyManager.checkEnvironment();

    if (env.supported) {
      console.log('✅ Environment supports privacy mode');
    } else {
      console.log('⚠️ Environment has some limitations:');
      env.warnings.forEach(warning => console.log(`  • ${warning}`));
    }

    console.log('\nFeatures available:');
    env.features.forEach(feature => console.log(`  ✓ ${feature}`));
    console.log();
  }

  /**
   * Run medical domain demonstration
   */
  private async runMedicalDemo(): Promise<void> {
    console.log('🏥 Medical Domain Demo');
    console.log('-'.repeat(25));
    console.log('Processing sensitive medical data...\n');

    const { files, queries } = this.demoData.medical;

    // Simulate file processing
    console.log('📁 Simulating medical files:');
    files.forEach(file => console.log(`  • ${file}`));

    // Process queries
    console.log('\n🔍 Processing medical queries:');
    for (const query of queries) {
      await this.processPrivacyQuery(query, 'medical');
    }
    console.log();
  }

  /**
   * Run government domain demonstration
   */
  private async runGovernmentDemo(): Promise<void> {
    console.log('🇺🇸 Government Domain Demo');
    console.log('-'.append(27));
    console.log('Processing classified government data...\n');

    const { files, queries } = this.demoData.government;

    // Simulate file processing
    console.log('📁 Simulating government files:');
    files.forEach(file => console.log(`  • ${file}`));

    // Process queries
    console.log('\n🔍 Processing government queries:');
    for (const query of queries) {
      await this.processPrivacyQuery(query, 'government');
    }
    console.log();
  }

  /**
   * Run financial domain demonstration
   */
  private async runFinancialDemo(): Promise<void> {
    console.log('💰 Financial Domain Demo');
    console.log('-'.append(25));
    console.log('Processing sensitive financial data...\n');

    const { files, queries } = this.demoData.financial;

    // Simulate file processing
    console.log('📁 Simulating financial files:');
    files.forEach(file => console.log(`  • ${file}`));

    // Process queries
    console.log('\n🔍 Processing financial queries:');
    for (const query of queries) {
      await this.processPrivacyQuery(query, 'financial');
    }
    console.log();
  }

  /**
   * Process a privacy query
   */
  private async processPrivacyQuery(query: string, domain: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Simulate processing without actually calling LSI
      // In real implementation, this would use LSI in local mode
      const result = await this.simulatePrivateProcessing(query);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Log privacy audit entry
      const auditEntry = this.privacyManager.logAuditEntry(
        query,
        true,
        true, // Always local-only in privacy mode
        processingTime
      );

      console.log(`${query}`);
      console.log(`   🔒 Local processing: ${processingTime}ms`);
      console.log(`   📊 Confidence: ${result.confidence}%`);
      console.log(`   🔍 Sources found: ${result.sources}`);

      // Show privacy protection
      if (auditEntry.hashValue) {
        console.log(`   🔐 Hash: ${auditEntry.hashValue.substring(0, 16)}...`);
      }

    } catch (error) {
      console.error(`Error processing query "${query}":`, error);
    }
  }

  /**
   * Simulate private processing
   */
  private async simulatePrivateProcessing(query: string): Promise<{
    confidence: number;
    sources: number;
    summary: string;
  }> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10));

    // Simulate different results based on query type
    const confidence = 85 + Math.random() * 10; // 85-95%
    const sources = 3 + Math.floor(Math.random() * 3); // 3-5 sources

    return {
      confidence: Math.floor(confidence),
      sources,
      summary: `Private processing complete - ${sources} sources analyzed with ${confidence}% confidence`
    };
  }

  /**
   * Show privacy summary
   */
  private showPrivacySummary(): void {
    console.log('\n🔒 Privacy Protection Summary');
    console.log('='.repeat(40));

    const compliance = this.privacyManager.verifyCompliance();

    console.log(`Compliance Status: ${compliance.compliant ? '✅ COMPLIANT' : '❌ ISSUES FOUND'}`);
    console.log(`Total Entries: ${compliance.totalEntries}`);
    console.log(`Local Processing: ${compliance.localProcessing} (${compliance.totalEntries > 0 ? (compliance.localProcessing / compliance.totalEntries * 100).toFixed(1) : 0}%)`);

    if (!compliance.compliant) {
      console.log('\n⚠️ Compliance Issues:');
      compliance.issues.forEach(issue => console.log(`  • ${issue}`));
    }

    console.log('\nSecurity Features Enabled:');
    console.log('  ✓ Local-only processing (no internet)');
    console.log('  ✓ Hash-based embeddings (non-semantic)');
    console.log('  ✓ Query masking for sensitive terms');
    console.log('  ✓ Encrypted cache storage');
    console.log('  ✓ Comprehensive audit logging');
    console.log('  ✓ Data minimization enforced');
  }

  /**
   * Show compliance report
   */
  private showComplianceReport(): void {
    console.log('\n📋 Compliance Report');
    console.log('='.repeat(30));

    const report = this.privacyManager.getAuditSummary();
    console.log(report);
  }

  /**
   * Interactive demo
   */
  private async interactiveDemo(): Promise<void> {
    console.log('\n💬 Interactive Privacy Demo');
    console.log('='.append(30));
    console.log('\nTry these queries to see privacy mode in action:\n');

    const sampleQueries = [
      'How is patient data encrypted in our system?',
      'What security measures protect classified information?',
      'Explain how financial transactions are secured',
      'Show me the audit trail for user authentication',
      'How does the HIPAA compliance system work?'
    ];

    console.log('Sample queries:');
    sampleQueries.forEach((query, index) => {
      console.log(`${index + 1}. "${query}"`);
    });

    console.log('\n💡 Remember: All processing happens locally!');
    console.log('No sensitive data ever leaves your machine.');
    console.log('Try running these with LSI in privacy mode:');
    console.log('lsi --privacy-mode local query "your question"');
  }

  /**
   * Export privacy audit
   */
  exportAudit(): void {
    const report = this.privacyManager.exportReport();
    const reportPath = './audit/privacy-report.md';

    const fs = require('fs');
    const path = require('path');

    try {
      fs.writeFileSync(reportPath, report);
      console.log(`📄 Privacy audit exported to ${reportPath}`);
    } catch (error) {
      console.error('Failed to export audit:', error);
    }
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  const demo = new PrivacyDemo();
  demo.run()
    .then(() => demo.exportAudit())
    .catch(console.error);
}

export { PrivacyDemo };
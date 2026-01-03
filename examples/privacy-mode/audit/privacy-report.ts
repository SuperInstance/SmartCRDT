/**
 * Privacy Report Generator
 * Creates comprehensive privacy compliance reports
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PrivacyManager } from '../src/privacy-manager';

export class PrivacyReportGenerator {
  private privacyManager: PrivacyManager;

  constructor() {
    this.privacyManager = new PrivacyManager();
  }

  /**
   * Generate comprehensive privacy report
   */
  generateReport(): void {
    const report = this.privacyManager.exportReport();
    const reportPath = join('./audit', 'privacy-comprehensive-report.md');

    writeFileSync(reportPath, report);
    console.log(`📄 Comprehensive privacy report generated at: ${reportPath}`);
  }

  /**
   * Generate executive summary
   */
  generateExecutiveSummary(): void {
    const compliance = this.privacyManager.verifyCompliance();
    const auditLog = this.privacyManager.getAuditLog();

    const summary = `
# Privacy Executive Summary

## Overview
LSI Privacy Mode has processed ${auditLog.length} queries with complete local processing.

## Compliance Status
- **Status**: ${compliance.compliant ? '✅ COMPLIANT' : '❌ NON-COMPLIANT'}
- **Local Processing**: ${compliance.localProcessing}/${compliance.totalEntries} queries
- **Compliance Score**: ${compliance.totalEntries > 0 ? (compliance.localProcessing / compliance.totalEntries * 100).toFixed(1) : 100}%

## Security Metrics
- **Total Data Processed**: ${(auditLog.reduce((sum, entry) => sum + entry.dataSize, 0) / 1024).toFixed(2)} KB
- **Average Processing Time**: ${auditLog.length > 0 ? (auditLog.reduce((sum, entry) => sum + entry.processingTime, 0) / auditLog.length).toFixed(0) : 0}ms
- **Audit Entries**: ${auditLog.length}

## Key Findings
${compliance.issues.length > 0 ?
  compliance.issues.map(issue => `- ⚠️ ${issue}`).join('\n') :
  '- ✅ No privacy violations detected'
}

## Recommendations
${compliance.compliant ?
  '- Continue monitoring privacy compliance' :
  '- Address identified compliance issues immediately'
}

---
*Generated on ${new Date().toLocaleString()}*
`.trim();

    writeFileSync('./audit/privacy-executive-summary.md', summary);
    console.log('📄 Executive summary generated');
  }
}

// Run generator
if (require.main === module) {
  const generator = new PrivacyReportGenerator();
  generator.generateReport();
  generator.generateExecutiveSummary();
}
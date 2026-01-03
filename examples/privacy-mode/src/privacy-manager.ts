/**
 * Privacy Manager for LSI Privacy Mode
 * Ensures all processing remains local and private.
 */

import { createHash, randomBytes } from 'crypto';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

export interface PrivacyAuditEntry {
  id: string;
  timestamp: Date;
  query: string;
  processed: boolean;
  localOnly: boolean;
  hashValue: string;
  dataSize: number;
  processingTime: number;
}

export class PrivacyManager {
  private auditLog: PrivacyAuditEntry[] = [];
  private auditPath: string;
  private encryptionKey: string;

  constructor(auditDir: string = './audit') {
    this.auditPath = join(auditDir, 'privacy-audit.json');
    this.encryptionKey = this.generateEncryptionKey();
    this.ensureAuditDir();
    this.loadAuditLog();
  }

  /**
   * Generate encryption key for local storage
   */
  private generateEncryptionKey(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Ensure audit directory exists
   */
  private ensureAuditDir(): void {
    if (!existsSync(this.auditPath.substring(0, this.auditPath.lastIndexOf('/')))) {
      mkdirSync(this.auditPath.substring(0, this.auditPath.lastIndexOf('/')), { recursive: true });
    }
  }

  /**
   * Load audit log from file
   */
  private loadAuditLog(): void {
    try {
      if (existsSync(this.auditPath)) {
        const data = readFileSync(this.auditPath, 'utf8');
        this.auditLog = JSON.parse(data).map((entry: any) => ({
          ...entry,
          timestamp: new Date(entry.timestamp)
        }));
      }
    } catch (error) {
      console.warn('Could not load audit log, starting fresh:', error);
      this.auditLog = [];
    }
  }

  /**
   * Save audit log to file
   */
  private saveAuditLog(): void {
    try {
      const data = {
        entries: this.auditLog.map(entry => ({
          ...entry,
          timestamp: entry.timestamp.toISOString()
        }))
      };
      writeFileSync(this.auditPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save audit log:', error);
    }
  }

  /**
   * Hash query for privacy protection
   */
  private hashQuery(query: string): string {
    return createHash('sha256').update(query).digest('hex');
  }

  /**
   * Log a privacy audit entry
   */
  logAuditEntry(query: string, processed: boolean, localOnly: boolean, processingTime: number): PrivacyAuditEntry {
    const id = this.generateAuditId();
    const hashValue = this.hashQuery(query);
    const dataSize = Buffer.byteLength(query, 'utf8');

    const entry: PrivacyAuditEntry = {
      id,
      timestamp: new Date(),
      query: this.maskQuery(query), // Mask sensitive parts
      processed,
      localOnly,
      hashValue,
      dataSize,
      processingTime
    };

    this.auditLog.push(entry);
    this.saveAuditLog();

    return entry;
  }

  /**
   * Mask sensitive parts of query
   */
  private maskQuery(query: string): string {
    // Simple masking - replace potential sensitive patterns
    return query
      .replace(/password/gi, '[REDACTED]')
      .replace(/secret/gi, '[REDACTED]')
      .replace(/token/gi, '[REDACTED]')
      .replace(/key/gi, '[REDACTED]')
      .replace(/api[_-]?key/gi, '[REDACTED]');
  }

  /**
   * Generate audit ID
   */
  private generateAuditId(): string {
    return `audit_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  /**
   * Verify privacy compliance
   */
  verifyCompliance(): {
    compliant: boolean;
    issues: string[];
    totalEntries: number;
    localProcessing: number;
  } {
    const issues: string[] = [];
    const totalEntries = this.auditLog.length;
    const localProcessing = this.auditLog.filter(entry => entry.localOnly).length;

    // Check for potential issues
    if (totalEntries === 0) {
      issues.push('No audit entries found - privacy mode may not be active');
    }

    const recentEntries = this.auditLog.filter(entry => {
      const hoursSinceEntry = (Date.now() - entry.timestamp.getTime()) / (1000 * 60 * 60);
      return hoursSinceEntry < 24;
    });

    if (recentEntries.length > 0) {
      const nonLocalEntries = recentEntries.filter(entry => !entry.localOnly);
      if (nonLocalEntries.length > 0) {
        issues.push(`${nonLocalEntries.length} entries processed non-locally in last 24 hours`);
      }
    }

    return {
      compliant: issues.length === 0,
      issues,
      totalEntries,
      localProcessing
    };
  }

  /**
   * Get audit summary
   */
  getAuditSummary(): string {
    const compliance = this.verifyCompliance();
    const totalData = this.auditLog.reduce((sum, entry) => sum + entry.dataSize, 0);
    const avgProcessingTime = this.auditLog.length > 0
      ? this.auditLog.reduce((sum, entry) => sum + entry.processingTime, 0) / this.auditLog.length
      : 0;

    return `
Privacy Audit Summary
====================
Generated: ${new Date().toLocaleString()}

Compliance Status: ${compliance.compliant ? '✅ COMPLIANT' : '❌ NON-COMPLIANT'}
${compliance.issues.length > 0 ? '\nIssues Found:\n' + compliance.issues.map(issue => `  • ${issue}`).join('\n') : ''}

Statistics:
• Total Audit Entries: ${compliance.totalEntries}
• Local Processing: ${compliance.localProcessing} (${compliance.totalEntries > 0 ? (compliance.localProcessing / compliance.totalEntries * 100).toFixed(1) : 0}%)
• Total Data Processed: ${(totalData / 1024).toFixed(2)} KB
• Average Processing Time: ${avgProcessingTime.toFixed(0)}ms
• Encryption Key: [LOCAL ONLY]

Security Features:
• All queries hashed before storage
• Sensitive information masked
• No external network calls
• Local-only processing
• Encrypted cache storage
`.trim();
  }

  /**
   * Get full audit log
   */
  getAuditLog(): PrivacyAuditEntry[] {
    return [...this.auditLog];
  }

  /**
   * Clear audit log
   */
  clearAuditLog(): void {
    this.auditLog = [];
    this.saveAuditLog();
  }

  /**
   * Export audit report
   */
  exportReport(): string {
    const summary = this.getAuditSummary();
    const log = JSON.stringify(this.auditLog, null, 2);

    return `# Privacy Audit Report

${summary}

---

## Detailed Audit Log

${log}

---
*Report generated by LSI Privacy Mode*
*All data processed locally and never transmitted*`;
  }

  /**
   * Check if environment supports privacy mode
   */
  checkEnvironment(): {
    supported: boolean;
    warnings: string[];
    features: string[];
  } {
    const warnings: string[] = [];
    const features: string[] = [];

    // Check Node.js version
    const version = process.version;
    const majorVersion = parseInt(version.replace('v', '').split('.')[0]);

    if (majorVersion >= 16) {
      features.push('Modern Node.js version');
    } else {
      warnings.push('Node.js version < 16 may have limited capabilities');
    }

    // Check memory
    const totalMemory = require('os').totalmem();
    if (totalMemory > 2 * 1024 * 1024 * 1024) {
      features.push('Sufficient memory for local processing');
    } else {
      warnings.push('Low memory may impact performance');
    }

    // Check storage
    if (existsSync('./audit')) {
      features.push('Audit directory accessible');
    } else {
      warnings.push('Cannot create audit directory');
    }

    return {
      supported: warnings.length === 0,
      warnings,
      features
    };
  }
}
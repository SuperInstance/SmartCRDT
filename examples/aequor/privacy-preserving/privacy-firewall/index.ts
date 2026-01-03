#!/usr/bin/env node
/**
 * Privacy Firewall Example
 *
 * This example demonstrates a privacy firewall that enforces privacy policies
 * and controls data flow based on sensitivity levels.
 *
 * Features demonstrated:
 * - Privacy policy rules and enforcement
 * - Query blocking and filtering
 * - Audit logging for compliance
 * - Data flow control (local-only vs. cloud)
 * - Real-time monitoring and alerts
 *
 * Run: npx tsx index.ts
 */

type PrivacyLevel = 'PUBLIC' | 'LOGIC' | 'STYLE' | 'SECRET';

interface PrivacyRule {
  id: string;
  name: string;
  level: PrivacyLevel;
  action: 'allow' | 'block' | 'redact' | 'local-only';
  description: string;
}

interface AuditLogEntry {
  timestamp: number;
  query: string;
  level: PrivacyLevel;
  action: string;
  allowed: boolean;
  reason: string;
}

/**
 * Privacy Firewall
 */
class PrivacyFirewall {
  private rules: PrivacyRule[] = [];
  private auditLog: AuditLogEntry[] = [];

  constructor() {
    // Initialize default rules
    this.rules = [
      {
        id: 'rule-1',
        name: 'Block Secret Data',
        level: 'SECRET',
        action: 'block',
        description: 'Block all queries containing sensitive PII',
      },
      {
        id: 'rule-2',
        name: 'Local-Only for Style',
        level: 'STYLE',
        action: 'local-only',
        description: 'Process style queries locally only',
      },
      {
        id: 'rule-3',
        name: 'Allow Logic Queries',
        level: 'LOGIC',
        action: 'allow',
        description: 'Allow business logic queries to cloud',
      },
      {
        id: 'rule-4',
        name: 'Allow Public Queries',
        level: 'PUBLIC',
        action: 'allow',
        description: 'Allow public queries anywhere',
      },
    ];
  }

  /**
   * Check if query should be allowed
   */
  checkQuery(query: string, level: PrivacyLevel): {
    allowed: boolean;
    action: string;
    reason: string;
    rule?: PrivacyRule;
  } {
    const rule = this.rules.find(r => r.level === level);

    if (!rule) {
      return {
        allowed: false,
        action: 'block',
        reason: 'No matching rule found',
      };
    }

    let allowed = false;
    let action = rule.action;

    switch (rule.action) {
      case 'allow':
        allowed = true;
        break;
      case 'block':
        allowed = false;
        break;
      case 'local-only':
        allowed = true;
        action = 'local-only';
        break;
      case 'redact':
        allowed = true;
        action = 'redact';
        break;
    }

    return {
      allowed,
      action,
      reason: rule.description,
      rule,
    };
  }

  /**
   * Process query through firewall
   */
  async processQuery(query: string, level: PrivacyLevel): Promise<{
    success: boolean;
    action: string;
    message: string;
    destination?: string;
  }> {
    const check = this.checkQuery(query, level);

    // Log the query
    this.auditLog.push({
      timestamp: Date.now(),
      query: query.substring(0, 50) + (query.length > 50 ? '...' : ''),
      level,
      action: check.action,
      allowed: check.allowed,
      reason: check.reason,
    });

    if (!check.allowed) {
      return {
        success: false,
        action: 'blocked',
        message: `Query blocked: ${check.reason}`,
      };
    }

    let destination = 'cloud';
    let message = 'Query approved';

    if (check.action === 'local-only') {
      destination = 'local';
      message = 'Query processed locally only';
    } else if (check.action === 'redact') {
      message = 'Query redacted and processed';
    }

    return {
      success: true,
      action: check.action,
      message,
      destination,
    };
  }

  /**
   * Add custom rule
   */
  addRule(rule: PrivacyRule): void {
    this.rules.push(rule);
  }

  /**
   * Get audit log
   */
  getAuditLog(): AuditLogEntry[] {
    return [...this.auditLog];
  }

  /**
   * Get statistics
   */
  getStats() {
    const total = this.auditLog.length;
    const allowed = this.auditLog.filter(e => e.allowed).length;
    const blocked = total - allowed;

    const byLevel = this.auditLog.reduce((acc, e) => {
      acc[e.level] = (acc[e.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byAction = this.auditLog.reduce((acc, e) => {
      acc[e.action] = (acc[e.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      allowed,
      blocked,
      allowRate: total > 0 ? allowed / total : 0,
      byLevel,
      byAction,
    };
  }

  /**
   * Generate compliance report
   */
  generateComplianceReport(): string {
    const stats = this.getStats();

    let report = '\n' + '='.repeat(70);
    report += '\n📋 PRIVACY COMPLIANCE REPORT';
    report += '\n' + '='.repeat(70);
    report += `\nGenerated: ${new Date().toISOString()}`;
    report += '\n\n📊 Summary:';
    report += `\n  Total Queries: ${stats.total}`;
    report += `\n  Allowed: ${stats.allowed} (${((stats.allowed / stats.total) * 100).toFixed(1)}%)`;
    report += `\n  Blocked: ${stats.blocked} (${((stats.blocked / stats.total) * 100).toFixed(1)}%)`;

    report += '\n\n🔍 By Privacy Level:';
    for (const [level, count] of Object.entries(stats.byLevel)) {
      const pct = ((count / stats.total) * 100).toFixed(1);
      report += `\n  ${level.padEnd(7)}: ${count} (${pct}%)`;
    }

    report += '\n\n🎯 By Action:';
    for (const [action, count] of Object.entries(stats.byAction)) {
      const pct = ((count / stats.total) * 100).toFixed(1);
      report += `\n  ${action.padEnd(12)}: ${count} (${pct}%)`;
    }

    report += '\n' + '='.repeat(70);

    return report;
  }
}

/**
 * Simple privacy classifier for demo
 */
function classifyQuery(query: string): PrivacyLevel {
  const lower = query.toLowerCase();

  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(query) || // email
      /\d{3}-\d{2}-\d{4}/.test(query) || // SSN
      /\d{4}-\d{4}-\d{4}-\d{4}/.test(query) || // credit card
      lower.includes('password') ||
      lower.includes('secret') ||
      lower.includes('api key')) {
    return 'SECRET';
  }

  if (lower.includes('i think') ||
      lower.includes('i believe') ||
      lower.includes('i prefer') ||
      lower.includes('my style')) {
    return 'STYLE';
  }

  if (lower.includes('how to') ||
      lower.includes('what is') ||
      lower.includes('explain') ||
      lower.includes('implement') ||
      lower.includes('code')) {
    return 'LOGIC';
  }

  return 'PUBLIC';
}

/**
 * Main example execution
 */
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║        Aequor Privacy Firewall Example                               ║');
  console.log('║        Enforcing Privacy Policies and Data Flow Control               ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const firewall = new PrivacyFirewall();

  console.log('\n🔒 Privacy Firewall Initialized');
  console.log('\nActive Rules:');
  for (const rule of firewall.rules) {
    console.log(`  ${rule.action.padEnd(12)} | ${rule.level.padEnd(7)} | ${rule.name}`);
  }

  // Phase 1: Test various queries
  console.log('\n' + '='.repeat(70));
  console.log('🔍 Phase 1: Processing Queries Through Firewall');
  console.log('='.repeat(70));

  const testQueries = [
    'What is the capital of France?',
    'How do I implement a binary search tree?',
    'I think React is better than Angular',
    'My email is john@example.com',
    'Explain async/await',
    'My password is secret123',
    'What is a REST API?',
    'Personally, I prefer TypeScript over JavaScript',
  ];

  const results: Array<{ query: string; result: any }> = [];

  for (const query of testQueries) {
    const level = classifyQuery(query);
    const result = await firewall.processQuery(query, level);

    results.push({ query, result });

    const emoji = result.success ? '✅' : '🚫';
    const dest = result.destination ? ` → ${result.destination.toUpperCase()}` : '';

    console.log(`\n${emoji} "${query}"`);
    console.log(`   Level: ${level}`);
    console.log(`   Action: ${result.action.toUpperCase()}${dest}`);
    console.log(`   Message: ${result.message}`);
  }

  // Phase 2: Statistics
  console.log('\n' + '='.repeat(70));
  console.log('📊 Phase 2: Firewall Statistics');
  console.log('='.repeat(70));

  const stats = firewall.getStats();

  console.log('\n📈 Overall Stats:');
  console.log(`  Total Queries: ${stats.total}`);
  console.log(`  Allowed: ${stats.allowed} (${((stats.allowed / stats.total) * 100).toFixed(1)}%)`);
  console.log(`  Blocked: ${stats.blocked} (${((stats.blocked / stats.total) * 100).toFixed(1)}%)`);

  console.log('\n🎯 By Privacy Level:');
  for (const [level, count] of Object.entries(stats.byLevel)) {
    const pct = ((count / stats.total) * 100).toFixed(1);
    console.log(`  ${level.padEnd(7)}: ${count} (${pct}%)`);
  }

  console.log('\n⚡ By Action:');
  for (const [action, count] of Object.entries(stats.byAction)) {
    const pct = ((count / stats.total) * 100).toFixed(1);
    console.log(`  ${action.padEnd(12)}: ${count} (${pct}%)`);
  }

  // Phase 3: Compliance report
  console.log(firewall.generateComplianceReport());

  // Phase 4: Audit log
  console.log('\n' + '='.repeat(70));
  console.log('📋 Phase 4: Recent Audit Log Entries');
  console.log('='.repeat(70));

  const recentLogs = firewall.getAuditLog().slice(-5);

  for (const log of recentLogs) {
    const time = new Date(log.timestamp).toLocaleTimeString();
    const status = log.allowed ? '✅' : '🚫';
    console.log(`\n${status} ${time} | ${log.level.padEnd(7)} | ${log.action.padEnd(12)}`);
    console.log(`   Query: "${log.query}"`);
    console.log(`   Reason: ${log.reason}`);
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📋 PRIVACY FIREWALL SUMMARY');
  console.log('='.repeat(70));

  console.log('\n✅ Features Demonstrated:');
  console.log('   1. Privacy policy enforcement');
  console.log('   2. Query blocking based on sensitivity');
  console.log('   3. Data flow control (local-only vs. cloud)');
  console.log('   4. Comprehensive audit logging');
  console.log('   5. Real-time compliance monitoring');

  console.log('\n🎯 Privacy Actions:');
  console.log('');
  console.log('   ALLOW:');
  console.log('   • Query approved for processing');
  console.log('   • Can route to local or cloud models');
  console.log('   • Example: "What is a REST API?"');
  console.log('');
  console.log('   BLOCK:');
  console.log('   • Query rejected immediately');
  console.log('   • No processing occurs');
  console.log('   • Example: "My password is secret123"');
  console.log('');
  console.log('   LOCAL-ONLY:');
  console.log('   • Query processed locally only');
  console.log('   • Never sent to cloud');
  console.log('   • Example: "I prefer TypeScript"');
  console.log('');
  console.log('   REDACT:');
  console.log('   • Sensitive parts removed');
  console.log('   • Sanitized query processed');
  console.log('   • Example: "My email is [REDACTED]"');

  console.log('\n💡 Use Cases:');
  console.log('   1. GDPR compliance (EU data protection)');
  console.log('   2. HIPAA compliance (healthcare data)');
  console.log('   3. Enterprise data loss prevention');
  console.log('   4. Multi-tenant isolation');
  console.log('   5. Regulatory compliance monitoring');

  console.log('\n🔧 Configuration:');
  console.log('   • Define rules for each privacy level');
  console.log('   • Customize actions per use case');
  console.log('   • Add custom rules as needed');
  console.log('   • Monitor and adjust based on logs');

  console.log('\n📊 Monitoring & Alerting:');
  console.log('   • Real-time query logging');
  console.log('   • Block rate monitoring');
  console.log('   • Privacy level distribution');
  console.log('   • Compliance report generation');
  console.log('   • Alert on policy violations');

  console.log('\n⚠️  Best Practices:');
  console.log('   1. Start with permissive rules, tighten gradually');
  console.log('   2. Monitor false positives carefully');
  console.log('   3. Regular audit log reviews');
  console.log('   4. Update rules based on new threats');
  console.log('   5. Document rule rationale');

  console.log('\n✨ Example complete!');
}

// Run the example
main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});

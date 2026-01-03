#!/usr/bin/env tsx
/**
 * Automated Security Audit Script
 * Scans codebase for security issues and generates report
 *
 * Usage:
 *   npx tsx scripts/security-audit.ts
 *   npx tsx scripts/security-audit.ts --output report.json
 *   npx tsx scripts/security-audit.ts --severity high
 *
 * @version 1.0.0
 * @license MIT
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname, relative } from 'path';
import { execSync } from 'child_process';

/**
 * Security issue severity levels
 */
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Security issue types
 */
type IssueType =
  | 'hardcoded-secret'
  | 'sql-injection'
  | 'xss-vulnerability'
  | 'weak-cryptography'
  | 'insecure-random'
  | 'eval-usage'
  | 'command-injection'
  | 'dependency-vulnerability'
  | 'missing-authentication'
  | 'information-disclosure'
  | 'code-quality'
  | 'best-practice';

/**
 * Security issue interface
 */
interface SecurityIssue {
  type: IssueType;
  severity: Severity;
  file: string;
  line: number;
  column?: number;
  description: string;
  recommendation: string;
  cwe?: string; // MITRE CWE identifier
  owasp?: string; // OWASP category
  code?: string; // Relevant code snippet
}

/**
 * Security report interface
 */
interface SecurityReport {
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    timestamp: string;
    duration: number;
  };
  issues: SecurityIssue[];
  dependencies: DependencyReport;
  codeMetrics: CodeMetrics;
  recommendations: string[];
}

/**
 * Dependency vulnerability report
 */
interface DependencyReport {
  total: number;
  vulnerable: number;
  vulnerabilities: Vulnerability[];
}

/**
 * Vulnerability interface
 */
interface Vulnerability {
  package: string;
  version: string;
  severity: Severity;
  title: string;
  url: string;
}

/**
 * Code metrics
 */
interface CodeMetrics {
  totalFiles: number;
  totalLines: number;
  typescriptFiles: number;
  javascriptFiles: number;
  testFiles: number;
  testCoverage: number;
}

/**
 * Security audit configuration
 */
interface AuditConfig {
  includePatterns: string[];
  excludePatterns: string[];
  excludeDirectories: string[];
  maxFileLines: number;
  enableDependencyScan: boolean;
  enableSecretScan: boolean;
  enablePatternScan: boolean;
  outputFormat: 'markdown' | 'json' | 'html';
}

/**
 * Security auditor class
 */
class SecurityAuditor {
  private issues: SecurityIssue[] = [];
  private config: AuditConfig;
  private startTime: number = 0;

  constructor(config: Partial<AuditConfig> = {}) {
    this.config = {
      includePatterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      excludePatterns: ['*.test.ts', '*.test.js', '*.spec.ts', '*.spec.js'],
      excludeDirectories: [
        'node_modules',
        'dist',
        'build',
        '.git',
        'coverage',
        'archives',
        'backup'
      ],
      maxFileLines: 5000,
      enableDependencyScan: true,
      enableSecretScan: true,
      enablePatternScan: true,
      outputFormat: 'markdown',
      ...config
    };
  }

  /**
   * Run complete security audit
   */
  async runAudit(): Promise<SecurityReport> {
    this.startTime = Date.now();

    console.log('🔒 Starting Security Audit...\n');

    // Scan for hardcoded secrets
    if (this.config.enableSecretScan) {
      console.log('🔍 Scanning for hardcoded secrets...');
      await this.scanSecrets();
    }

    // Scan for vulnerable dependencies
    if (this.config.enableDependencyScan) {
      console.log('🔍 Scanning dependencies for vulnerabilities...');
      await this.scanDependencies();
    }

    // Scan for security patterns
    if (this.config.enablePatternScan) {
      console.log('🔍 Scanning for security patterns...');
      await this.scanSecurityPatterns();
    }

    // Scan for code quality issues
    console.log('🔍 Scanning for code quality issues...');
    await this.scanCodeQuality();

    // Calculate metrics
    const metrics = await this.calculateMetrics();

    // Generate recommendations
    const recommendations = this.generateRecommendations();

    const duration = Date.now() - this.startTime;

    return {
      summary: {
        total: this.issues.length,
        critical: this.issues.filter(i => i.severity === 'critical').length,
        high: this.issues.filter(i => i.severity === 'high').length,
        medium: this.issues.filter(i => i.severity === 'medium').length,
        low: this.issues.filter(i => i.severity === 'low').length,
        info: this.issues.filter(i => i.severity === 'info').length,
        timestamp: new Date().toISOString(),
        duration
      },
      issues: this.issues,
      dependencies: await this.getDependencyReport(),
      codeMetrics: metrics,
      recommendations
    };
  }

  /**
   * Scan for hardcoded secrets
   */
  private async scanSecrets(): Promise<void> {
    const secretPatterns = [
      {
        pattern: /(?:password|passwd|pwd|secret|api[_-]?key|token|private[_-]?key|access[_-]?token)\s*[:=]\s*['"]([^'"]{8,})['"]/gi,
        type: 'hardcoded-secret' as IssueType,
        severity: 'critical' as Severity,
        description: 'Hardcoded secret detected',
        recommendation: 'Move secret to environment variables or secure secret manager',
        cwe: 'CWE-798',
        owasp: 'A07:2021 – Identification and Authentication Failures'
      },
      {
        pattern: /(?:aws[_-]?access[_-]?key[_-]?id|aws[_-]?secret[_-]?access[_-]?key)\s*[:=]\s*['"]([^'"]+)['"]/gi,
        type: 'hardcoded-secret' as IssueType,
        severity: 'critical' as Severity,
        description: 'AWS credentials detected',
        recommendation: 'Use IAM roles or environment variables for AWS credentials',
        cwe: 'CWE-798'
      },
      {
        pattern: /bearer\s+([a-zA-Z0-9._~+/=]{20,})/gi,
        type: 'hardcoded-secret' as IssueType,
        severity: 'critical' as Severity,
        description: 'Bearer token detected',
        recommendation: 'Move bearer token to secure storage',
        cwe: 'CWE-798'
      },
      {
        pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/g,
        type: 'hardcoded-secret' as IssueType,
        severity: 'critical' as Severity,
        description: 'Private key detected',
        recommendation: 'Move private key to secure storage (KMS, vault)',
        cwe: 'CWE-798'
      },
      {
        pattern: /sk-[a-zA-Z0-9]{48}/g, // OpenAI API key format
        type: 'hardcoded-secret' as IssueType,
        severity: 'critical' as Severity,
        description: 'OpenAI API key detected',
        recommendation: 'Move API key to environment variables',
        cwe: 'CWE-798'
      }
    ];

    await this.scanPatterns(secretPatterns);
  }

  /**
   * Scan for security patterns
   */
  private async scanSecurityPatterns(): Promise<void> {
    const securityPatterns = [
      {
        pattern: /eval\s*\(/g,
        type: 'eval-usage' as IssueType,
        severity: 'high' as Severity,
        description: 'Use of eval() function detected',
        recommendation: 'Avoid eval() - use safer alternatives like JSON.parse() or Function constructor with caution',
        cwe: 'CWE-95',
        owasp: 'A03:2021 – Injection'
      },
      {
        pattern: /new\s+Function\s*\(/g,
        type: 'eval-usage' as IssueType,
        severity: 'high' as Severity,
        description: 'Use of Function constructor detected',
        recommendation: 'Avoid Function constructor - use safer alternatives',
        cwe: 'CWE-95'
      },
      {
        pattern: /innerHTML\s*=/g,
        type: 'xss-vulnerability' as IssueType,
        severity: 'high' as Severity,
        description: 'innerHTML assignment detected (XSS risk)',
        recommendation: 'Use textContent or sanitize HTML before assignment',
        cwe: 'CWE-79',
        owasp: 'A03:2021 – Injection'
      },
      {
        pattern: /dangerouslySetInnerHTML/g,
        type: 'xss-vulnerability' as IssueType,
        severity: 'high' as Severity,
        description: 'React dangerouslySetInnerHTML detected (XSS risk)',
        recommendation: 'Avoid dangerouslySetInnerHTML or use DOMPurify for sanitization',
        cwe: 'CWE-79'
      },
      {
        pattern: /exec\s*\(/g,
        type: 'command-injection' as IssueType,
        severity: 'high' as Severity,
        description: 'Use of exec() detected (command injection risk)',
        recommendation: 'Use parameterized commands or whitelist allowed commands',
        cwe: 'CWE-78',
        owasp: 'A03:2021 – Injection'
      },
      {
        pattern: /spawn\s*\(/g,
        type: 'command-injection' as IssueType,
        severity: 'medium' as Severity,
        description: 'Use of spawn() detected (command injection risk)',
        recommendation: 'Validate and sanitize all input to spawn()',
        cwe: 'CWE-78'
      },
      {
        pattern: /Math\.random\(\)/g,
        type: 'insecure-random' as IssueType,
        severity: 'medium' as Severity,
        description: 'Insecure random number generation detected',
        recommendation: 'Use crypto.randomBytes() or crypto.getRandomValues() for security-critical operations',
        cwe: 'CWE-338',
        owasp: 'A02:2021 – Cryptographic Failures'
      },
      {
        pattern: /md5\s*\(/g,
        type: 'weak-cryptography' as IssueType,
        severity: 'medium' as Severity,
        description: 'MD5 hash function detected (weak cryptography)',
        recommendation: 'Use SHA-256 or stronger hash functions',
        cwe: 'CWE-327',
        owasp: 'A02:2021 – Cryptographic Failures'
      },
      {
        pattern: /sha1\s*\(/g,
        type: 'weak-cryptography' as IssueType,
        severity: 'medium' as Severity,
        description: 'SHA-1 hash function detected (weak cryptography)',
        recommendation: 'Use SHA-256 or stronger hash functions',
        cwe: 'CWE-327'
      },
      {
        pattern: /SELECT\s+.*\s+FROM\s+.*WHERE\s+[^;]+\$/gi,
        type: 'sql-injection' as IssueType,
        severity: 'high' as Severity,
        description: 'Potential SQL injection (query concatenation)',
        recommendation: 'Use parameterized queries or prepared statements',
        cwe: 'CWE-89',
        owasp: 'A03:2021 – Injection'
      }
    ];

    await this.scanPatterns(securityPatterns);
  }

  /**
   * Scan files for patterns
   */
  private async scanPatterns(
    patterns: Array<{
      pattern: RegExp;
      type: IssueType;
      severity: Severity;
      description: string;
      recommendation: string;
      cwe?: string;
      owasp?: string;
    }>
  ): Promise<void> {
    const files = this.getFiles();

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        const lineNumber = lineIndex + 1;

        for (const pattern of patterns) {
          const matches = line.matchAll(pattern.pattern);

          for (const match of matches) {
            this.issues.push({
              type: pattern.type,
              severity: pattern.severity,
              file: relative(process.cwd(), file),
              line: lineNumber,
              column: match.index ? match.index + 1 : undefined,
              description: pattern.description,
              recommendation: pattern.recommendation,
              cwe: pattern.cwe,
              owasp: pattern.owasp,
              code: line.trim()
            });
          }
        }
      }
    }
  }

  /**
   * Scan dependencies for vulnerabilities
   */
  private async scanDependencies(): Promise<void> {
    try {
      // Run npm audit
      const auditOutput = execSync('npm audit --json', {
        encoding: 'utf-8',
        cwd: process.cwd()
      });

      const auditData = JSON.parse(auditOutput);

      if (auditData.vulnerabilities) {
        for (const [packageName, vulnData] of Object.entries(auditData.vulnerabilities)) {
          const vuln = vulnData as any;

          this.issues.push({
            type: 'dependency-vulnerability',
            severity: this.mapNpmAuditSeverity(vuln.severity),
            file: 'package.json',
            line: 0,
            description: `Vulnerability in ${packageName}@${vuln.via[0].range || vuln.via[0]}`,
            recommendation: `Update ${packageName} to ${vuln.fixAvailable?.version || 'latest version'}`,
            owasp: 'A05:2021 – Security Misconfiguration'
          });
        }
      }
    } catch (error: any) {
      // npm audit returns non-zero exit code if vulnerabilities found
      if (error.stdout) {
        try {
          const auditData = JSON.parse(error.stdout);
          if (auditData.vulnerabilities) {
            for (const [packageName, vulnData] of Object.entries(auditData.vulnerabilities)) {
              const vuln = vulnData as any;

              this.issues.push({
                type: 'dependency-vulnerability',
                severity: this.mapNpmAuditSeverity(vuln.severity),
                file: 'package.json',
                line: 0,
                description: `Vulnerability in ${packageName}@${vuln.via[0]?.range || vuln.via[0]}`,
                recommendation: `Update ${packageName} to ${vuln.fixAvailable?.version || 'latest version'}`,
                owasp: 'A05:2021 – Security Misconfiguration'
              });
            }
          }
        } catch {
          // Failed to parse, continue
        }
      }
    }
  }

  /**
   * Scan for code quality issues
   */
  private async scanCodeQuality(): Promise<void> {
    const files = this.getFiles();

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      // Check for console.log in production code
      if (!file.includes('.test.') && !file.includes('.spec.')) {
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
          const line = lines[lineIndex];

          if (line.includes('console.log') && !line.includes('//')) {
            this.issues.push({
              type: 'code-quality',
              severity: 'info',
              file: relative(process.cwd(), file),
              line: lineIndex + 1,
              description: 'Console.log statement found in production code',
              recommendation: 'Remove console.log or use proper logging library',
              code: line.trim()
            });
          }
        }
      }

      // Check for TODO/FIXME comments
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];

        if (line.match(/\/\/\s*(TODO|FIXME|XXX|HACK)/i)) {
          this.issues.push({
            type: 'code-quality',
            severity: 'info',
            file: relative(process.cwd(), file),
            line: lineIndex + 1,
            description: 'TODO/FIXME comment detected',
            recommendation: 'Address or create issue ticket',
            code: line.trim()
          });
        }
      }

      // Check for unused imports (simple heuristic)
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        const importMatches = content.matchAll(/^import\s+.*from\s+['"](.+?)['"];?$/gm);
        const imports: string[] = [];

        for (const match of importMatches) {
          imports.push(match[1]);
        }

        // This is a basic check - real analysis would require TypeScript compiler
        if (imports.length > 10) {
          this.issues.push({
            type: 'code-quality',
            severity: 'low',
            file: relative(process.cwd(), file),
            line: 1,
            description: 'Many imports detected - may indicate need for refactoring',
            recommendation: 'Consider barrel exports or reorganizing modules'
          });
        }
      }
    }
  }

  /**
   * Get all files to scan
   */
  private getFiles(): string[] {
    const files: string[] = [];

    const scanDirectory = (dir: string) => {
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        // Skip excluded directories
        if (entry.isDirectory() && this.config.excludeDirectories.includes(entry.name)) {
          continue;
        }

        if (entry.isDirectory()) {
          scanDirectory(fullPath);
        } else if (entry.isFile()) {
          const relativePath = relative(process.cwd(), fullPath);

          // Check include patterns
          const included = this.config.includePatterns.some(pattern =>
            this.matchPattern(relativePath, pattern)
          );

          // Check exclude patterns
          const excluded = this.config.excludePatterns.some(pattern =>
            this.matchPattern(relativePath, pattern)
          );

          if (included && !excluded) {
            files.push(fullPath);
          }
        }
      }
    };

    scanDirectory(process.cwd());
    return files;
  }

  /**
   * Match glob pattern (simplified)
   */
  private matchPattern(path: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    const regex = new RegExp(regexPattern);
    return regex.test(path);
  }

  /**
   * Map npm audit severity to our severity
   */
  private mapNpmAuditSeverity(severity: string): Severity {
    switch (severity) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'high';
      case 'moderate':
        return 'medium';
      case 'low':
      default:
        return 'low';
    }
  }

  /**
   * Calculate code metrics
   */
  private async calculateMetrics(): Promise<CodeMetrics> {
    const files = this.getFiles();
    let totalLines = 0;
    let typescriptFiles = 0;
    let javascriptFiles = 0;
    let testFiles = 0;

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      totalLines += content.split('\n').length;

      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        typescriptFiles++;
      } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
        javascriptFiles++;
      }

      if (file.includes('.test.') || file.includes('.spec.')) {
        testFiles++;
      }
    }

    return {
      totalFiles: files.length,
      totalLines,
      typescriptFiles,
      javascriptFiles,
      testFiles,
      testCoverage: 0 // Would need to run actual tests
    };
  }

  /**
   * Get dependency report
   */
  private async getDependencyReport(): Promise<DependencyReport> {
    try {
      const packageJsonPath = join(process.cwd(), 'package.json');
      if (!existsSync(packageJsonPath)) {
        return {
          total: 0,
          vulnerable: 0,
          vulnerabilities: []
        };
      }

      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      const vulnerableIssues = this.issues.filter(i => i.type === 'dependency-vulnerability');

      return {
        total: Object.keys(dependencies).length,
        vulnerable: vulnerableIssues.length,
        vulnerabilities: vulnerableIssues.map(v => ({
          package: v.description.split('@')[0].split(' ')[1] || 'unknown',
          version: 'latest',
          severity: v.severity,
          title: v.description,
          url: ''
        }))
      };
    } catch {
      return {
        total: 0,
        vulnerable: 0,
        vulnerabilities: []
      };
    }
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Count issues by severity
    const critical = this.issues.filter(i => i.severity === 'critical').length;
    const high = this.issues.filter(i => i.severity === 'high').length;
    const medium = this.issues.filter(i => i.severity === 'medium').length;

    if (critical > 0) {
      recommendations.push(`🔴 CRITICAL: Address ${critical} critical security issues immediately`);
    }

    if (high > 0) {
      recommendations.push(`🟠 HIGH: Address ${high} high-severity issues within 7 days`);
    }

    if (medium > 0) {
      recommendations.push(`🟡 MEDIUM: Address ${medium} medium-severity issues within 30 days`);
    }

    // Specific recommendations
    const hasSecrets = this.issues.some(i => i.type === 'hardcoded-secret');
    if (hasSecrets) {
      recommendations.push('Move all hardcoded secrets to environment variables or secret manager');
    }

    const hasVulnDeps = this.issues.some(i => i.type === 'dependency-vulnerability');
    if (hasVulnDeps) {
      recommendations.push('Update vulnerable dependencies to latest secure versions');
    }

    const hasEval = this.issues.some(i => i.type === 'eval-usage');
    if (hasEval) {
      recommendations.push('Remove all eval() and Function constructor usage');
    }

    const hasXSS = this.issues.some(i => i.type === 'xss-vulnerability');
    if (hasXSS) {
      recommendations.push('Review all innerHTML usage and implement proper sanitization');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ No critical security issues found - maintain good practices!');
    }

    return recommendations;
  }

  /**
   * Generate markdown report
   */
  async generateMarkdownReport(report: SecurityReport): Promise<string> {
    let markdown = '# Security Audit Report\n\n';
    markdown += `**Generated:** ${new Date(report.summary.timestamp).toLocaleString()}\n`;
    markdown += `**Duration:** ${report.summary.duration}ms\n\n`;

    // Summary
    markdown += '## Summary\n\n';
    markdown += '| Severity | Count |\n';
    markdown += '|----------|-------|\n';
    markdown += `| 🔴 Critical | ${report.summary.critical} |\n`;
    markdown += `| 🟠 High | ${report.summary.high} |\n`;
    markdown += `| 🟡 Medium | ${report.summary.medium} |\n`;
    markdown += `| 🔵 Low | ${report.summary.low} |\n`;
    markdown += `| ⚪ Info | ${report.summary.info} |\n`;
    markdown += `| **Total** | **${report.summary.total}** |\n\n`;

    // Recommendations
    markdown += '## Recommendations\n\n';
    for (const rec of report.recommendations) {
      markdown += `- ${rec}\n`;
    }
    markdown += '\n';

    // Dependency vulnerabilities
    if (report.dependencies.vulnerable > 0) {
      markdown += '## Dependency Vulnerabilities\n\n';
      markdown += `Found ${report.dependencies.vulnerable} vulnerable dependencies:\n\n`;
      for (const vuln of report.dependencies.vulnerabilities) {
        markdown += `- **${vuln.package}** (${vuln.severity}): ${vuln.title}\n`;
      }
      markdown += '\n';
    }

    // Security issues
    if (report.issues.length > 0) {
      markdown += '## Security Issues\n\n';

      // Group by severity
      for (const severity of ['critical', 'high', 'medium', 'low', 'info'] as Severity[]) {
        const issues = report.issues.filter(i => i.severity === severity);
        if (issues.length === 0) continue;

        const emoji = severity === 'critical' ? '🔴' :
                     severity === 'high' ? '🟠' :
                     severity === 'medium' ? '🟡' :
                     severity === 'low' ? '🔵' : '⚪';

        markdown += `### ${emoji.toUpperCase()} ${severity.toUpperCase()} (${issues.length})\n\n`;

        for (const issue of issues) {
          markdown += `#### ${issue.description}\n\n`;
          markdown += `- **File:** \`${issue.file}:${issue.line}\`\n`;
          if (issue.cwe) markdown += `- **CWE:** ${issue.cwe}\n`;
          if (issue.owasp) markdown += `- **OWASP:** ${issue.owasp}\n`;
          if (issue.code) markdown += `- **Code:** \`${issue.code.substring(0, 100)}\`\n`;
          markdown += `- **Recommendation:** ${issue.recommendation}\n\n`;
        }
      }
    } else {
      markdown += '## ✅ No Security Issues Found\n\n';
    }

    // Code metrics
    markdown += '## Code Metrics\n\n';
    markdown += `- **Total Files:** ${report.codeMetrics.totalFiles}\n`;
    markdown += `- **Total Lines:** ${report.codeMetrics.totalLines}\n`;
    markdown += `- **TypeScript Files:** ${report.codeMetrics.typescriptFiles}\n`;
    markdown += `- **JavaScript Files:** ${report.codeMetrics.javascriptFiles}\n`;
    markdown += `- **Test Files:** ${report.codeMetrics.testFiles}\n\n`;

    return markdown;
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const outputPath = args.find(arg => arg.startsWith('--output='))?.split('=')[1];
  const severityFilter = args.find(arg => arg.startsWith('--severity='))?.split('=')[1];

  const auditor = new SecurityAuditor();
  const report = await auditor.runAudit();

  // Filter by severity if specified
  if (severityFilter) {
    report.issues = report.issues.filter(i => i.severity === severityFilter);
    report.summary.total = report.issues.length;
  }

  // Generate markdown report
  const markdown = await auditor.generateMarkdownReport(report);

  // Output report
  if (outputPath) {
    writeFileSync(outputPath, markdown, 'utf-8');
    console.log(`\n✅ Report saved to ${outputPath}`);
  } else {
    console.log('\n' + markdown);
  }

  // Exit with appropriate code
  const hasCriticalOrHigh = report.issues.some(i =>
    i.severity === 'critical' || i.severity === 'high'
  );

  process.exit(hasCriticalOrHigh ? 1 : 0);
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Error running security audit:', error);
    process.exit(1);
  });
}

export { SecurityAuditor, SecurityReport, SecurityIssue };

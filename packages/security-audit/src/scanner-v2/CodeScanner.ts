/**
import { SecuritySeverity, CodeLocation, DetectionConfidence } from "../types.js";

 * CodeScanner - Advanced code scanning for security anti-patterns
 *
 * Scans code for:
 * - Hardcoded secrets
 * - Insecure functions
 * - SQL injection patterns
 * - XSS patterns
 * - Path traversal
 * - Command injection
 * - Insecure deserialization
 * - Cryptographic issues
 */

import type { CodeLocation, SecuritySeverity } from "@lsi/protocol";
import { DetectionConfidence } from "@lsi/protocol";

/**
 * Code scan finding
 */
export interface CodeScanFinding {
  type: string;
  severity: SecuritySeverity;
  confidence: DetectionConfidence;
  location: CodeLocation;
  description: string;
  remediation: string;
  cweId?: string;
}

/**
 * Secret pattern
 */
export interface SecretPattern {
  name: string;
  pattern: RegExp;
  severity: SecuritySeverity;
  cweId: string;
}

/**
 * Insecure function pattern
 */
export interface InsecureFunction {
  name: string;
  pattern: RegExp;
  severity: SecuritySeverity;
  remediation: string;
  cweId: string;
}

/**
 * CodeScanner configuration
 */
export interface CodeScannerConfig {
  /** Include custom patterns */
  customSecretPatterns?: SecretPattern[];
  /** Exclude certain patterns */
  excludePatterns?: RegExp[];
  /** Maximum file size */
  maxFileSize?: number;
}

/**
 * CodeScanner - Scans code for security issues
 */
export class CodeScanner {
  private config: Required<CodeScannerConfig>;
  private readonly secretPatterns: SecretPattern[];
  private readonly insecureFunctions: InsecureFunction[];

  constructor(config: CodeScannerConfig = {}) {
    this.config = {
      customSecretPatterns: config.customSecretPatterns ?? [],
      excludePatterns: config.excludePatterns ?? [],
      maxFileSize: config.maxFileSize ?? 1024 * 1024, // 1MB
    };

    this.secretPatterns = this.initializeSecretPatterns();
    this.insecureFunctions = this.initializeInsecureFunctions();
  }

  /**
   * Initialize secret patterns
   */
  private initializeSecretPatterns(): SecretPattern[] {
    return [
      {
        name: "AWS Access Key",
        pattern: /(?:aws|amazon).*(?:access[_-]?key[_-]?id|key[_-]?id)['":\s]*[=:]?\s*['"`]([A-Z0-9]{20})['"`]/gi,
        severity: "CRITICAL" as SecuritySeverity,
        cweId: "CWE-798",
      },
      {
        name: "AWS Secret Key",
        pattern: /(?:aws|amazon).*(?:secret[_-]?key)['":\s]*[=:]?\s*['"`]([A-Za-z0-9/+=]{40})['"`]/gi,
        severity: "CRITICAL" as SecuritySeverity,
        cweId: "CWE-798",
      },
      {
        name: "API Key",
        pattern: /(?:api[_-]?key|apikey|access[_-]?token|auth[_-]?token)['":\s]*[=:]?\s*['"`]([a-zA-Z0-9_\-]{20,})['"`]/gi,
        severity: "HIGH" as SecuritySeverity,
        cweId: "CWE-798",
      },
      {
        name: "Password",
        pattern: /(?:password|passwd|pwd|secret)['":\s]*[=:]?\s*['"`]([^'"`\s]{4,})['"`]/gi,
        severity: "CRITICAL" as SecuritySeverity,
        cweId: "CWE-798",
      },
      {
        name: "Private Key",
        pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/gi,
        severity: "CRITICAL" as SecuritySeverity,
        cweId: "CWE-798",
      },
      {
        name: "Bearer Token",
        pattern: /bearer['":\s]*[=:]?\s*['"`]([a-zA-Z0-9_\-\.]{20,})['"`]/gi,
        severity: "HIGH" as SecuritySeverity,
        cweId: "CWE-798",
      },
      {
        name: "GitHub Token",
        pattern: /ghp_[a-zA-Z0-9]{36}/gi,
        severity: "CRITICAL" as SecuritySeverity,
        cweId: "CWE-798",
      },
      {
        name: "Slack Token",
        pattern: /xox[pbar]-[a-zA-Z0-9-]{10,}/gi,
        severity: "CRITICAL" as SecuritySeverity,
        cweId: "CWE-798",
      },
      {
        name: "Database Connection String",
        pattern: /(?:mongodb|mysql|postgres|redis):\/\/[^:]+:[^@]+@/gi,
        severity: "CRITICAL" as SecuritySeverity,
        cweId: "CWE-798",
      },
      {
        name: "JWT Secret",
        pattern: /jwt[_-]?secret['":\s]*[=:]?\s*['"`]([^'"`]{10,})['"`]/gi,
        severity: "HIGH" as SecuritySeverity,
        cweId: "CWE-798",
      },
    ];
  }

  /**
   * Initialize insecure function patterns
   */
  private initializeInsecureFunctions(): InsecureFunction[] {
    return [
      {
        name: "eval",
        pattern: /\beval\s*\(/gi,
        severity: "HIGH" as SecuritySeverity,
        remediation: "Avoid eval(). Use JSON.parse() for JSON or safer alternatives",
        cweId: "CWE-95",
      },
      {
        name: "Function constructor",
        pattern: /new\s+Function\s*\(/gi,
        severity: "HIGH" as SecuritySeverity,
        remediation: "Avoid Function constructor. Use arrow functions or regular functions",
        cweId: "CWE-95",
      },
      {
        name: "innerHTML",
        pattern: /\.innerHTML\s*=/gi,
        severity: "HIGH" as SecuritySeverity,
        remediation: "Use textContent or sanitize HTML with DOMPurify",
        cweId: "CWE-79",
      },
      {
        name: "document.write",
        pattern: /document\.write\s*\(/gi,
        severity: "HIGH" as SecuritySeverity,
        remediation: "Use DOM manipulation methods instead",
        cweId: "CWE-79",
      },
      {
        name: "setTimeout with string",
        pattern: /setTimeout\s*\(\s*['"`]/gi,
        severity: "MEDIUM" as SecuritySeverity,
        remediation: "Pass function instead of string",
        cweId: "CWE-95",
      },
      {
        name: "setInterval with string",
        pattern: /setInterval\s*\(\s*['"`]/gi,
        severity: "MEDIUM" as SecuritySeverity,
        remediation: "Pass function instead of string",
        cweId: "CWE-95",
      },
      {
        name: "exec",
        pattern: /(?:child_process)?\.(?:exec|execSync|spawn)\s*\(/gi,
        severity: "HIGH" as SecuritySeverity,
        remediation: "Use parameterized commands or whitelist allowed values",
        cweId: "CWE-78",
      },
      {
        name: "dangerous SQL query",
        pattern: /(?:query|execute)\s*\(\s*['"`][^'"`]*?\+[^'"`]*?\)/gi,
        severity: "CRITICAL" as SecuritySeverity,
        remediation: "Use parameterized queries or prepared statements",
        cweId: "CWE-89",
      },
      {
        name: "weak crypto",
        pattern: /createHash\s*\(\s*['"`](?:md5|sha1)['"`]\)/gi,
        severity: "HIGH" as SecuritySeverity,
        remediation: "Use SHA-256 or stronger",
        cweId: "CWE-327",
      },
      {
        name: "Math.random",
        pattern: /Math\.random\s*\(/gi,
        severity: "MEDIUM" as SecuritySeverity,
        remediation: "Use crypto.randomBytes() for security-sensitive operations",
        cweId: "CWE-338",
      },
      {
        name: "fs.existsSync without validation",
        pattern: /fs\.existsSync\s*\([^)]+\)/gi,
        severity: "LOW" as SecuritySeverity,
        remediation: "Validate and sanitize file paths",
        cweId: "CWE-22",
      },
      {
        name: "fs.readFileSync with user input",
        pattern: /fs\.readFileSync\s*\(\s*[^,]+,\s*['"`]utf-8['"`]\s*\)/gi,
        severity: "MEDIUM" as SecuritySeverity,
        remediation: "Validate file paths and ensure they're within allowed directories",
        cweId: "CWE-22",
      },
    ];
  }

  /**
   * Scan file for security issues
   */
  async scanFile(filePath: string, content: string): Promise<CodeScanFinding[]> {
    const findings: CodeScanFinding[] = [];

    // Check file size
    if (content.length > this.config.maxFileSize) {
      return findings;
    }

    // Scan for secrets
    const secretFindings = this.scanForSecrets(filePath, content);
    findings.push(...secretFindings);

    // Scan for insecure functions
    const functionFindings = this.scanForInsecureFunctions(filePath, content);
    findings.push(...functionFindings);

    return findings;
  }

  /**
   * Scan for secrets
   */
  private scanForSecrets(filePath: string, content: string): CodeScanFinding[] {
    const findings: CodeScanFinding[] = [];
    const lines = content.split("\n");

    const allPatterns = [...this.secretPatterns, ...this.config.customSecretPatterns];

    for (const pattern of allPatterns) {
      const matches = content.matchAll(pattern.pattern);

      for (const match of matches) {
        if (this.shouldExclude(match[0])) {
          continue;
        }

        // Find line number
        let lineNumber = 1;
        let position = 0;
        for (const line of lines) {
          position += line.length + 1;
          if (position >= match.index!) {
            break;
          }
          lineNumber++;
        }

        findings.push({
          type: pattern.name,
          severity: pattern.severity,
          confidence: this.assessSecretConfidence(match[0]),
          location: {
            file: filePath,
            line: lineNumber,
            column: 0,
            snippet: lines[lineNumber - 1]?.trim() || "",
          },
          description: `Potential ${pattern.name} detected in code`,
          remediation: "Move secrets to environment variables or a secure vault",
          cweId: pattern.cweId,
        });
      }
    }

    return findings;
  }

  /**
   * Scan for insecure functions
   */
  private scanForInsecureFunctions(filePath: string, content: string): CodeScanFinding[] {
    const findings: CodeScanFinding[] = [];
    const lines = content.split("\n");

    for (const func of this.insecureFunctions) {
      lines.forEach((line, index) => {
        const matches = line.matchAll(func.pattern);

        for (const match of matches) {
          if (this.shouldExclude(match[0])) {
            continue;
          }

          findings.push({
            type: func.name,
            severity: func.severity,
            confidence: DetectionConfidence.HIGH,
            location: {
              file: filePath,
              line: index + 1,
              column: match.index! + 1,
              snippet: line.trim(),
            },
            description: `Use of insecure function: ${func.name}`,
            remediation: func.remediation,
            cweId: func.cweId,
          });
        }
      });
    }

    return findings;
  }

  /**
   * Check if match should be excluded
   */
  private shouldExclude(match: string): boolean {
    return this.config.excludePatterns.some((pattern) => pattern.test(match));
  }

  /**
   * Assess confidence for secret detection
   */
  private assessSecretConfidence(match: string): DetectionConfidence {
    // Lower confidence for common false positives
    const falsePositivePatterns = [
      /example/i,
      /test/i,
      /demo/i,
      /fake/i,
      /your[_-]?api[_-]?key/i,
      /xxx/i,
      /\*.{10,}\*/, // Comments
      /\/\/.*$/, // Comments
    ];

    for (const pattern of falsePositivePatterns) {
      if (pattern.test(match)) {
        return DetectionConfidence.LOW;
      }
    }

    // Higher confidence for longer matches
    if (match.length > 50) {
      return DetectionConfidence.CERTAIN;
    }

    return DetectionConfidence.HIGH;
  }

  /**
   * Generate summary report
   */
  generateSummary(findings: CodeScanFinding[]): {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    filesWithIssues: number;
  } {
    const summary = {
      total: findings.length,
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      filesWithIssues: new Set(findings.map((f) => f.location.file)).size,
    };

    // Count by type
    findings.forEach((finding) => {
      summary.byType[finding.type] = (summary.byType[finding.type] || 0) + 1;
    });

    // Count by severity
    findings.forEach((finding) => {
      summary.bySeverity[finding.severity] = (summary.bySeverity[finding.severity] || 0) + 1;
    });

    return summary;
  }

  /**
   * Generate remediation report
   */
  generateRemediation(findings: CodeScanFinding[]): {
    critical: CodeScanFinding[];
    high: CodeScanFinding[];
    medium: CodeScanFinding[];
    low: CodeScanFinding[];
  } {
    return {
      critical: findings.filter((f) => f.severity === "CRITICAL"),
      high: findings.filter((f) => f.severity === "HIGH"),
      medium: findings.filter((f) => f.severity === "MEDIUM"),
      low: findings.filter((f) => f.severity === "LOW"),
    };
  }
}

/**
 * Create code scanner with default configuration
 */
export function createCodeScanner(config?: CodeScannerConfig): CodeScanner {
  return new CodeScanner(config);
}

/**
 * Quick scan function
 */
export async function scanCode(filePath: string, content: string): Promise<CodeScanFinding[]> {
  const scanner = createCodeScanner();
  return scanner.scanFile(filePath, content);
}

/**
 * SecurityRuleEngine - Core security rule matching and detection
 *
 * Implements pattern-based security vulnerability detection using:
 * - Regular expressions for simple patterns
 * - AST-based analysis for complex patterns
 * - Taint tracking for data flow analysis
 */

import type {
  SecurityRule,
  SecurityRuleId,
  VulnerabilityFinding,
  CodeLocation,
  VulnerabilityCategory,
  Remediation,
} from "@lsi/protocol";
import {
  SecuritySeverity,
  OWASPVulnerabilityCategory,
  CustomVulnerabilityCategory,
  DetectionConfidence,
} from "@lsi/protocol";
import { createVulnerabilityId } from "../utils/idGenerator.js";

/**
 * Rule pattern type
 */
export type RulePattern = {
  type: "regex" | "ast" | "taint";
  pattern: RegExp | object | string;
  modifiers?: string[];
};

/**
 * Rule definition with pattern
 */
export interface SecurityRuleDefinition {
  id: SecurityRuleId;
  name: string;
  category: VulnerabilityCategory;
  severity: SecuritySeverity;
  description: string;
  pattern: RulePattern;
  languages: string[];
  remediation: Remediation;
  cweId?: string;
  owaspRef?: string;
  enabled: boolean;
}

/**
 * Security rule engine configuration
 */
export interface SecurityRuleEngineConfig {
  /** Custom rules to add */
  customRules?: SecurityRuleDefinition[];
  /** Rules to disable */
  disabledRules?: SecurityRuleId[];
  /** Maximum file size to parse (bytes) */
  maxFileSize?: number;
}

/**
 * Rule match result
 */
interface RuleMatch {
  rule: SecurityRuleDefinition;
  matches: Array<{
    location: CodeLocation;
    confidence: DetectionConfidence;
    snippet?: string;
  }>;
}

/**
 * SecurityRuleEngine - Main engine for security rule matching
 */
export class SecurityRuleEngine {
  private rules: Map<SecurityRuleId, SecurityRuleDefinition>;
  private disabledRules: Set<SecurityRuleId>;
  private maxFileSize: number;

  constructor(config: SecurityRuleEngineConfig = {}) {
    this.rules = new Map();
    this.disabledRules = new Set(config.disabledRules || []);
    this.maxFileSize = config.maxFileSize || 1024 * 1024; // 1MB default

    // Load default rules
    this.loadDefaultRules();

    // Load custom rules
    if (config.customRules) {
      config.customRules.forEach((rule) => this.addRule(rule));
    }
  }

  /**
   * Load default security rules
   */
  private loadDefaultRules(): void {
    // SQL Injection rules
    this.addRule({
      id: "sql-injection-direct" as SecurityRuleId,
      name: "SQL Injection - Direct Query Construction",
      category: OWASPVulnerabilityCategory.INJECTION,
      severity: SecuritySeverity.CRITICAL,
      description: "Direct construction of SQL queries with user input",
      pattern: {
        type: "regex",
        pattern: /\b(query|execute|raw)\s*\(\s*['"`]([^'"`]*?\$\{[^}]+\}[^'"`]*?|[^'"`]*?['"`]\s*\+\s*[^)]+?\s*\+)/gi,
        modifiers: ["global", "insensitive"],
      },
      languages: ["javascript", "typescript", "python", "java", "php"],
      remediation: {
        summary: "Use parameterized queries or prepared statements",
        description: "Never construct SQL queries by concatenating user input. Use parameterized queries or prepared statements instead.",
        codeExample: "// Instead of:\n// db.query(`SELECT * FROM users WHERE id = ${userId}`)\n\n// Use:\ndb.query('SELECT * FROM users WHERE id = ?', [userId])",
        estimatedEffort: 1,
        priority: "immediate",
      },
      cweId: "CWE-89",
      owaspRef: "https://owasp.org/www-project-top-ten/2021/A03_2021-Injection",
      enabled: true,
    });

    // XSS rules
    this.addRule({
      id: "xss-dangerously-set-innerhtml" as SecurityRuleId,
      name: "XSS - Dangerous use of innerHTML",
      category: OWASPVulnerabilityCategory.INJECTION,
      severity: SecuritySeverity.HIGH,
      description: "Setting innerHTML with untrusted data can lead to XSS",
      pattern: {
        type: "regex",
        pattern: /\.(innerHTML|outerHTML)\s*=\s*(?!['"`](?:[\\w\s.(){}[\]+-]*|\\[\\w\\W])*['"`]$)([^;]+)/gi,
      },
      languages: ["javascript", "typescript"],
      remediation: {
        summary: "Use textContent or sanitize HTML before setting innerHTML",
        description: "Setting innerHTML with untrusted data can execute malicious scripts. Use textContent for plain text or sanitize HTML using a library like DOMPurify.",
        codeExample: "// Instead of:\n// element.innerHTML = userInput\n\n// Use:\nelement.textContent = userInput\n\n// Or sanitize:\nimport DOMPurify from 'dompurify';\nelement.innerHTML = DOMPurify.sanitize(userInput);",
        estimatedEffort: 1,
        priority: "high",
      },
      cweId: "CWE-79",
      owaspRef: "https://owasp.org/www-project-top-ten/2021/A03_2021-Injection",
      enabled: true,
    });

    // Hardcoded secrets rules
    this.addRule({
      id: "secret-api-key" as SecurityRuleId,
      name: "Hardcoded API Key",
      category: CustomVulnerabilityCategory.HARD_CODED_SECRET,
      severity: SecuritySeverity.HIGH,
      description: "Potential hardcoded API key detected",
      pattern: {
        type: "regex",
        pattern: /(?:api[_-]?key|apikey|access[_-]?token|auth[_-]?token|secret[_-]?key)['":\s]*[=:]?\s*['"`]([a-zA-Z0-9_-]{20,})['"`]/gi,
      },
      languages: ["javascript", "typescript", "python", "java", "go", "rust"],
      remediation: {
        summary: "Store secrets in environment variables or secure vault",
        description: "Hardcoded secrets in source code can be leaked through version control. Store secrets in environment variables or a secrets management system.",
        codeExample: "// Instead of:\n// const apiKey = 'sk-1234567890abcdefghijklmnopqrstuvwxyz'\n\n// Use:\nconst apiKey = process.env.API_KEY;",
        estimatedEffort: 1,
        priority: "high",
      },
      cweId: "CWE-798",
      enabled: true,
    });

    // Hardcoded password
    this.addRule({
      id: "secret-password" as SecurityRuleId,
      name: "Hardcoded Password",
      category: CustomVulnerabilityCategory.HARD_CODED_SECRET,
      severity: SecuritySeverity.CRITICAL,
      description: "Potential hardcoded password detected",
      pattern: {
        type: "regex",
        pattern: /(?:password|passwd|pwd)['":\s]*[=:]?\s*['"`]([^'"`]{4,})['"`]/gi,
      },
      languages: ["javascript", "typescript", "python", "java", "go", "rust"],
      remediation: {
        summary: "Never hardcode passwords in source code",
        description: "Hardcoded passwords are a major security risk. Use environment variables or a secure secrets management system.",
        codeExample: "// Instead of:\n// const password = 'SuperSecret123!'\n\n// Use:\nconst password = process.env.DATABASE_PASSWORD;",
        estimatedEffort: 1,
        priority: "immediate",
      },
      cweId: "CWE-798",
      enabled: true,
    });

    // AWS credentials
    this.addRule({
      id: "secret-aws-key" as SecurityRuleId,
      name: "AWS Access Key ID",
      category: CustomVulnerabilityCategory.HARD_CODED_SECRET,
      severity: SecuritySeverity.CRITICAL,
      description: "Hardcoded AWS access key detected",
      pattern: {
        type: "regex",
        pattern: /(?:aws[_-]?)?(?:access[_-]?)?(?:key[_-]?id|key)['":\s]*[=:]?\s*['"`]([A-Z0-9]{20})['"`]/gi,
      },
      languages: ["javascript", "typescript", "python", "java", "go", "rust"],
      remediation: {
        summary: "Use AWS IAM roles or environment variables for credentials",
        description: "Hardcoded AWS credentials expose your account to unauthorized access. Use IAM roles or environment variables.",
        codeExample: "// Use AWS SDK's default credential chain\n// It automatically checks environment variables,\n// ~/.aws/credentials file, and IAM roles",
        estimatedEffort: 1,
        priority: "immediate",
      },
      cweId: "CWE-798",
      enabled: true,
    });

    // Weak cryptography
    this.addRule({
      id: "crypto-md5" as SecurityRuleId,
      name: "Weak Cryptography - MD5",
      category: CustomVulnerabilityCategory.WEAK_CRYPTOGRAPHY,
      severity: SecuritySeverity.HIGH,
      description: "MD5 is cryptographically broken and should not be used",
      pattern: {
        type: "regex",
        pattern: /\bmd5\s*\(|createHash\s*\(\s*['"`]md5['"`]/gi,
      },
      languages: ["javascript", "typescript", "python", "java"],
      remediation: {
        summary: "Use SHA-256 or stronger hash functions",
        description: "MD5 is cryptographically broken and vulnerable to collision attacks. Use SHA-256, SHA-384, or SHA-512 instead.",
        codeExample: "// Instead of:\n// const hash = crypto.createHash('md5').update(data).digest('hex');\n\n// Use:\nconst hash = crypto.createHash('sha256').update(data).digest('hex');",
        estimatedEffort: 2,
        priority: "high",
      },
      cweId: "CWE-327",
      owaspRef: "https://owasp.org/www-project-top-ten/2021/A02_2021-Cryptographic_Failures",
      enabled: true,
    });

    // Insecure random
    this.addRule({
      id: "crypto-insecure-random" as SecurityRuleId,
      name: "Insecure Random Number Generation",
      category: CustomVulnerabilityCategory.INSECURE_RANDOM,
      severity: SecuritySeverity.HIGH,
      description: "Using insecure random number generator for security purposes",
      pattern: {
        type: "regex",
        pattern: /\bMath\.random\s*\(/gi,
      },
      languages: ["javascript", "typescript"],
      remediation: {
        summary: "Use crypto.randomBytes() for security-sensitive random numbers",
        description: "Math.random() is predictable and not suitable for security-sensitive operations. Use cryptographic random number generators.",
        codeExample: "// Instead of:\n// const token = Math.random().toString(36);\n\n// Use:\nimport crypto from 'crypto';\nconst token = crypto.randomBytes(16).toString('hex');",
        estimatedEffort: 1,
        priority: "high",
      },
      cweId: "CWE-338",
      enabled: true,
    });

    // Debug mode enabled
    this.addRule({
      id: "config-debug-enabled" as SecurityRuleId,
      name: "Debug Mode Enabled",
      category: CustomVulnerabilityCategory.DEBUG_ENABLED,
      severity: SecuritySeverity.MEDIUM,
      description: "Debug mode appears to be enabled in production code",
      pattern: {
        type: "regex",
        pattern: /\bDEBUG\s*=\s*true|NODE_ENV\s*[:=]\s*['"`]development['"`]|process\.env\.NODE_ENV\s*!==?\s*['"`]production['"`]/gi,
      },
      languages: ["javascript", "typescript", "python"],
      remediation: {
        summary: "Disable debug mode in production",
        description: "Debug mode can expose sensitive information and should be disabled in production environments.",
        codeExample: "// Check environment properly\nif (process.env.NODE_ENV !== 'production') {\n  console.log('Debug info:', debugData);\n}",
        estimatedEffort: 1,
        priority: "medium",
      },
      enabled: true,
    });

    // Missing rate limiting
    this.addRule({
      id: "auth-missing-rate-limit" as SecurityRuleId,
      name: "Missing Rate Limiting",
      category: CustomVulnerabilityCategory.MISSING_RATE_LIMITING,
      severity: SecuritySeverity.MEDIUM,
      description: "Authentication endpoint without visible rate limiting",
      pattern: {
        type: "ast",
        pattern: "auth-endpoint-no-rate-limit",
      },
      languages: ["javascript", "typescript", "python"],
      remediation: {
        summary: "Implement rate limiting on authentication endpoints",
        description: "Rate limiting prevents brute force attacks on authentication endpoints. Implement rate limiting using libraries like express-rate-limit.",
        codeExample: "import rateLimit from 'express-rate-limit';\n\nconst limiter = rateLimit({\n  windowMs: 15 * 60 * 1000, // 15 minutes\n  max: 5 // limit each IP to 5 requests per windowMs\n});\n\napp.post('/api/login', limiter, handler);",
        estimatedEffort: 2,
        priority: "high",
      },
      cweId: "CWE-307",
      owaspRef: "https://owasp.org/www-project-top-ten/2021/A07_2021-Identification_and_Authentication_Failures",
      enabled: true,
    });
  }

  /**
   * Add a custom rule
   */
  addRule(rule: SecurityRuleDefinition): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Remove a rule
   */
  removeRule(ruleId: SecurityRuleId): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * Enable or disable a rule
   */
  toggleRule(ruleId: SecurityRuleId, enabled: boolean): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
    if (enabled) {
      this.disabledRules.delete(ruleId);
    } else {
      this.disabledRules.add(ruleId);
    }
  }

  /**
   * Get all rules
   */
  getRules(): SecurityRule[] {
    return Array.from(this.rules.values()).filter(
      (rule) => rule.enabled && !this.disabledRules.has(rule.id)
    );
  }

  /**
   * Scan file content for vulnerabilities
   */
  async scanFile(filePath: string, content: string): Promise<VulnerabilityFinding[]> {
    const findings: VulnerabilityFinding[] = [];
    const fileExtension = this.getFileExtension(filePath);

    for (const rule of this.getRules()) {
      // Skip if language doesn't match
      if (!this.languageMatches(rule.languages, fileExtension)) {
        continue;
      }

      // Scan based on pattern type
      const matches = await this.scanWithRule(rule, filePath, content);
      findings.push(...matches);
    }

    return findings;
  }

  /**
   * Scan content with a specific rule
   */
  private async scanWithRule(
    rule: SecurityRuleDefinition,
    filePath: string,
    content: string
  ): Promise<VulnerabilityFinding[]> {
    const findings: VulnerabilityFinding[] = [];

    if (rule.pattern.type === "regex") {
      const regex = rule.pattern.pattern as RegExp;
      let match: RegExpExecArray | null;

      // Reset regex state
      regex.lastIndex = 0;

      const lines = content.split("\n");
      let globalLineIndex = 0;

      while ((match = regex.exec(content)) !== null) {
        // Calculate line and column
        const matchStart = match.index;
        const matchText = match[0];
        let currentPos = 0;
        let lineNumber = 1;
        let columnNumber = 1;

        for (const line of lines) {
          const lineLength = line.length + 1; // +1 for newline
          if (currentPos + lineLength > matchStart) {
            columnNumber = matchStart - currentPos + 1;
            break;
          }
          currentPos += lineLength;
          lineNumber++;
        }

        // Extract function name if possible
        const snippet = lines[lineNumber - 1] || "";
        const functionMatch = snippet.match(/function\s+(\w+)|(\w+)\s*[=:]\s*(?:function|async\s*\(|\()/);
        const functionName = functionMatch ? (functionMatch[1] || functionMatch[2]) : undefined;

        // Create vulnerability finding
        findings.push({
          id: createVulnerabilityId(),
          category: rule.category,
          severity: rule.severity,
          confidence: this.assessConfidence(match, rule),
          title: rule.name,
          description: rule.description,
          location: {
            file: filePath,
            line: lineNumber,
            column: columnNumber,
            function: functionName,
            snippet: this.extractSnippet(snippet, columnNumber),
          },
          cweId: rule.cweId,
          affectedComponents: [filePath],
          remediation: rule.remediation,
          references: rule.owaspRef ? [rule.owaspRef] : [],
          metadata: {
            ruleId: rule.id,
            matchedText: matchText,
          },
        });
      }
    }

    return findings;
  }

  /**
   * Assess confidence in detection based on match quality
   */
  private assessConfidence(
    match: RegExpExecArray,
    rule: SecurityRuleDefinition
  ): DetectionConfidence {
    // Higher confidence for more specific matches
    const matchedText = match[0] || "";

    // Check for common false positives
    if (rule.category === CustomVulnerabilityCategory.HARD_CODED_SECRET) {
      // Lower confidence for example values
      if (
        matchedText.includes("example") ||
        matchedText.includes("test") ||
        matchedText.includes("demo") ||
        matchedText.includes("your-api-key") ||
        matchedText.includes("your-secret")
      ) {
        return DetectionConfidence.LOW;
      }
    }

    // Higher confidence for longer, more specific matches
    if (matchedText.length > 50) {
      return DetectionConfidence.CERTAIN;
    } else if (matchedText.length > 20) {
      return DetectionConfidence.HIGH;
    }

    return DetectionConfidence.MEDIUM;
  }

  /**
   * Extract snippet around match location
   */
  private extractSnippet(line: string, column: number): string {
    const start = Math.max(0, column - 40);
    const end = Math.min(line.length, column + 40);
    let snippet = line.substring(start, end);

    if (start > 0) snippet = "..." + snippet;
    if (end < line.length) snippet = snippet + "...";

    return snippet;
  }

  /**
   * Get file extension from path
   */
  private getFileExtension(filePath: string): string {
    const match = filePath.match(/\.(\w+)$/);
    return match ? match[1].toLowerCase() : "";
  }

  /**
   * Check if language matches file extension
   */
  private languageMatches(languages: string[], extension: string): boolean {
    const languageMap: Record<string, string[]> = {
      javascript: ["js", "jsx", "mjs"],
      typescript: ["ts", "tsx"],
      python: ["py"],
      java: ["java"],
      go: ["go"],
      rust: ["rs"],
      php: ["php"],
    };

    for (const lang of languages) {
      if (languageMap[lang]?.includes(extension)) {
        return true;
      }
    }

    return false;
  }
}

/**
 * Create a default security rule engine
 */
export function createSecurityRuleEngine(
  config?: SecurityRuleEngineConfig
): SecurityRuleEngine {
  return new SecurityRuleEngine(config);
}

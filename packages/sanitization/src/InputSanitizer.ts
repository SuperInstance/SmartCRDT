/**
 * @lsi/sanitization - Input Sanitizer Implementation
 *
 * Comprehensive input sanitization to prevent injection attacks:
 * - SQL Injection
 * - XSS (Cross-Site Scripting)
 * - Command Injection
 * - LDAP Injection
 * - Path Traversal
 * - SSRF (Server-Side Request Forgery)
 * - NoSQL Injection
 * - Template Injection
 */

import {
  type SanitizationResult,
  type SanitizationOptions,
  type DetectedThreat,
  SanitizationMethod,
  InjectionType,
  ThreatSeverity,
  type InputContext,
  type IInputSanitizer,
  type CustomSanitizationRule,
} from "@lsi/protocol";

// ============================================================================
// INJECTION PATTERNS
// ============================================================================

/**
 * SQL Injection patterns
 */
const SQL_PATTERNS = [
  // Basic SQL injection
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|UNION|EXECUTE)\b)/gi,
  // Comments
  /(--[^-]|\/\*|\*\/|;)/g,
  // Conditional operators
  /\b(OR|AND)\s+\d+\s*=\s*\d+/gi,
  // Hex encoding
  /0x[0-9a-f]+/gi,
  // Char encoding
  /char\(\s*\d+/gi,
  // Waitfor delay
  /\bwaitfor\s+delay\b/gi,
  // Stack queries
  /;\s*(SELECT|INSERT|UPDATE|DELETE|DROP)/gi,
];

/**
 * XSS patterns
 */
const XSS_PATTERNS = [
  // Script tags
  /<\s*script[^>]*>.*?<\s*\/\s*script\s*>/gsi,
  // On* event handlers
  /\bon\w+\s*=\s*["'][^"']["']/gi,
  // Javascript protocol
  /javascript:\s*[^\s]/gi,
  // iframe tags
  /<\s*iframe[^>]*>/gi,
  // Object tags
  /<\s*object[^>]*>/gi,
  // Embed tags
  /<\s*embed[^>]*>/gi,
  // Expression (IE)
  /expression\s*\(/gi,
  // Style with expression
  /<\s*style[^>]*>.*?expression\s*\(/gsi,
  // vbscript protocol
  /vbscript:\s*[^\s]/gi,
  // Data URIs with scripts
  /data:\s*text\/html[^,]*,/gi,
];

/**
 * Command injection patterns
 */
const COMMAND_PATTERNS = [
  // Shell metacharacters
  /[;&|`$()]/g,
  // Command substitution
  /\$\([^)]*\)/g,
  // Backtick substitution
  /`[^`]*`/g,
  // Pipe chains
  /\|\s*\w+/g,
  // Redirection
  /[<>]{1,2}\s*\S+/g,
  // Background execution
  /&\s*\w+/g,
];

/**
 * LDAP injection patterns
 */
const LDAP_PATTERNS = [
  // LDAP filters
  /\([$$\*][\w=]*/g,
  // Boolean operators
  /([&|!])\([^)]*\)/g,
  // Wildcards
  /\*[\w]*\*/g,
  // Escape sequences
  /\\[0-9a-f]{2}/gi,
];

/**
 * Path traversal patterns
 */
const PATH_TRAVERSAL_PATTERNS = [
  // ../ patterns
  /\.\.[\/\\]/g,
  // Encoded ../
  /%2e%2e[\/\\%]/gi,
  // Double encoded
  /%252e%252e/gi,
  // Unicode encoding
  /%c0%ae%c0%ae/gi,
  // Null bytes
  /\x00/g,
  // Alternative path separators
  /[\/\\]{2,}/g,
];

/**
 * SSRF patterns
 */
const SSRF_PATTERNS = [
  // Localhost variants
  /\b(localhost|127\.0\.0\.1|0\.0\.0\.0|::1|localhost\.localdomain)\b/gi,
  // Local network ranges
  /\b(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g,
  // Internal domains
  /\.(internal|local|corp|priv|intranet)\b/gi,
  // File protocol
  /file:\/\/\//gi,
  // Custom internal headers
  /@internal\.|@private\./gi,
];

/**
 * NoSQL injection patterns
 */
const NOSQL_PATTERNS = [
  // MongoDB operators
  /\$[a-z]+(\s*:\s*)/gi,
  // Regex operators
  /\$regex\b/gi,
  // Where clause
  /\$where\b/gi,
  // Ne operator
  /\$ne\b/gi,
  // In operator
  /\$in\b/gi,
  // Eval-like expressions
  /\$expr\b/gi,
];

/**
 * Template injection patterns
 */
const TEMPLATE_PATTERNS = [
  // Jinja2
  /\{\{[^}]*\}\}/g,
  // Twig
  /\{\{[^}]*\}\}/g,
  // FreeMarker
  /\${[^}]*}/g,
  // Velocity
  /#[^#\s]*\(/g,
  // Smarty
  /\{[^}]*\}/g,
  // Moustache
  /\{\{[^}]*\}\}/g,
];

/**
 * Header injection patterns
 */
const HEADER_PATTERNS = [
  // CRLF injection
  /\r\n|\n|\r/g,
  // Header continuation
  /\n\s+/g,
  // Multiple headers
  /:\s*\r\n/g,
];

/**
 * XML injection patterns
 */
const XML_PATTERNS = [
  // Entity declarations
  /<!ENTITY[^>]+>/g,
  // DTD
  /<!DOCTYPE[^>]+>/g,
  // CDATA sections
  /<!\[CDATA\[.*?\]\]>/gs,
  // Processing instructions
  /<\?xml[^>]*\?>?/gi,
];

// ============================================================================
// INPUT SANITIZER IMPLEMENTATION
// ============================================================================

export class InputSanitizer implements IInputSanitizer {
  private stats = {
    totalInputs: 0,
    threatDetectedCount: 0,
    blockedCount: 0,
    threatsByType: {} as Record<InjectionType, number>,
    processingTimes: [] as number[],
  };

  /**
   * Sanitize a string input
   */
  sanitize(input: string, options: Partial<SanitizationOptions> = {}): SanitizationResult {
    const startTime = performance.now();

    this.stats.totalInputs++;

    // Merge with defaults
    const opts: SanitizationOptions = {
      checkFor: [
        InjectionType.SQL_INJECTION,
        InjectionType.XSS,
        InjectionType.COMMAND_INJECTION,
      ],
      methods: [
        SanitizationMethod.HTML_ENCODE,
        SanitizationMethod.NULL_BYTE_STRIP,
      ],
      preserveUnicode: true,
      preserveWhitespace: false,
      encoding: "utf8",
      throwOnError: false,
      ...options,
    };

    const threats: DetectedThreat[] = [];
    let sanitized = input;
    const methodsApplied: SanitizationMethod[] = [];

    // Check for threats
    if (opts.checkFor && opts.checkFor.length > 0) {
      for (const injectionType of opts.checkFor) {
        const detected = this.detectThreats(input, injectionType);
        threats.push(...detected);
      }

      // Update stats
      if (threats.length > 0) {
        this.stats.threatDetectedCount++;
        for (const threat of threats) {
          this.stats.threatsByType[threat.type] =
            (this.stats.threatsByType[threat.type] || 0) + 1;
        }
      }
    }

    // Apply sanitization methods
    if (opts.methods && opts.methods.length > 0) {
      for (const method of opts.methods) {
        const result = this.applyMethod(sanitized, method, opts);
        if (result !== sanitized) {
          methodsApplied.push(method);
          sanitized = result;
        }
      }
    }

    // Apply custom rules
    if (opts.customRules) {
      for (const rule of opts.customRules) {
        const pattern = typeof rule.pattern === "string" ? new RegExp(rule.pattern, "gi") : rule.pattern;
        const replacement = typeof rule.replacement === "function"
          ? rule.replacement
          : rule.replacement;

        sanitized = sanitized.replace(pattern, replacement as string);
        methodsApplied.push(SanitizationMethod.UNICODE_NORMALIZE); // Marker
      }
    }

    // Apply length constraint
    if (opts.maxLength && sanitized.length > opts.maxLength) {
      sanitized = sanitized.substring(0, opts.maxLength);
    }

    // Normalize whitespace if not preserving
    if (!opts.preserveWhitespace) {
      sanitized = sanitized.replace(/\s+/g, " ").trim();
    }

    const endTime = performance.now();
    this.stats.processingTimes.push(endTime - startTime);

    return {
      sanitized,
      wasModified: sanitized !== input,
      threats,
      methodsApplied,
    };
  }

  /**
   * Sanitize with context
   */
  sanitizeWithContext(
    input: string,
    context: InputContext,
    options?: Partial<SanitizationOptions>
  ): SanitizationResult {
    // Apply context-aware defaults
    const contextualDefaults = this.getContextualOptions(context.source);
    const mergedOptions = { ...contextualDefaults, ...options };

    return this.sanitize(input, mergedOptions);
  }

  /**
   * Sanitize multiple inputs
   */
  sanitizeBatch(
    inputs: Record<string, string>,
    options?: Partial<SanitizationOptions>
  ): Record<string, SanitizationResult> {
    const results: Record<string, SanitizationResult> = {};

    for (const [key, value] of Object.entries(inputs)) {
      results[key] = this.sanitize(value, options);
    }

    return results;
  }

  /**
   * Get sanitization statistics
   */
  getStatistics() {
    const avgProcessingTime =
      this.stats.processingTimes.length > 0
        ? this.stats.processingTimes.reduce((a, b) => a + b, 0) / this.stats.processingTimes.length
        : 0;

    const topThreatTypes = Object.entries(this.stats.threatsByType)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({ type: type as InjectionType, count }));

    return {
      totalInputs: this.stats.totalInputs,
      threatDetectedCount: this.stats.threatDetectedCount,
      blockedCount: this.stats.blockedCount,
      threatsByType: { ...this.stats.threatsByType },
      topThreatTypes,
      avgProcessingTime,
    };
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    this.stats = {
      totalInputs: 0,
      threatDetectedCount: 0,
      blockedCount: 0,
      threatsByType: {},
      processingTimes: [],
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Detect threats of a specific type
   */
  private detectThreats(input: string, type: InjectionType): DetectedThreat[] {
    const threats: DetectedThreat[] = [];
    const patterns = this.getPatternsForType(type);

    for (const pattern of patterns) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;

      // Reset regex state
      pattern.lastIndex = 0;

      while ((match = regex.exec(input)) !== null) {
        threats.push({
          type,
          severity: this.getSeverityForType(type),
          position: {
            start: match.index,
            end: match.index + match[0].length,
          },
          content: match[0],
          description: this.getDescriptionForType(type),
          remediation: this.getRemediationForType(type),
        });
      }
    }

    return threats;
  }

  /**
   * Get patterns for an injection type
   */
  private getPatternsForType(type: InjectionType): RegExp[] {
    switch (type) {
      case InjectionType.SQL_INJECTION:
        return SQL_PATTERNS;
      case InjectionType.XSS:
        return XSS_PATTERNS;
      case InjectionType.COMMAND_INJECTION:
        return COMMAND_PATTERNS;
      case InjectionType.LDAP_INJECTION:
        return LDAP_PATTERNS;
      case InjectionType.PATH_TRAVERSAL:
        return PATH_TRAVERSAL_PATTERNS;
      case InjectionType.SSRF:
        return SSRF_PATTERNS;
      case InjectionType.NOSQL_INJECTION:
        return NOSQL_PATTERNS;
      case InjectionType.TEMPLATE_INJECTION:
        return TEMPLATE_PATTERNS;
      case InjectionType.HEADER_INJECTION:
        return HEADER_PATTERNS;
      case InjectionType.XML_INJECTION:
        return XML_PATTERNS;
      default:
        return [];
    }
  }

  /**
   * Get severity for an injection type
   */
  private getSeverityForType(type: InjectionType): ThreatSeverity {
    switch (type) {
      case InjectionType.SQL_INJECTION:
      case InjectionType.COMMAND_INJECTION:
      case InjectionType.SSRF:
        return ThreatSeverity.CRITICAL;
      case InjectionType.XSS:
      case InjectionType.PATH_TRAVERSAL:
        return ThreatSeverity.HIGH;
      case InjectionType.LDAP_INJECTION:
      case InjectionType.NOSQL_INJECTION:
      case InjectionType.TEMPLATE_INJECTION:
        return ThreatSeverity.MEDIUM;
      default:
        return ThreatSeverity.LOW;
    }
  }

  /**
   * Get description for an injection type
   */
  private getDescriptionForType(type: InjectionType): string {
    const descriptions: Record<InjectionType, string> = {
      [InjectionType.SQL_INJECTION]: "Potential SQL injection attack detected",
      [InjectionType.XSS]: "Potential cross-site scripting (XSS) attack detected",
      [InjectionType.COMMAND_INJECTION]: "Potential command injection attack detected",
      [InjectionType.LDAP_INJECTION]: "Potential LDAP injection attack detected",
      [InjectionType.PATH_TRAVERSAL]: "Potential path traversal attack detected",
      [InjectionType.SSRF]: "Potential server-side request forgery (SSRF) detected",
      [InjectionType.NOSQL_INJECTION]: "Potential NoSQL injection attack detected",
      [InjectionType.TEMPLATE_INJECTION]: "Potential template injection attack detected",
      [InjectionType.HEADER_INJECTION]: "Potential header injection attack detected",
      [InjectionType.XML_INJECTION]: "Potential XML injection attack detected",
    };
    return descriptions[type] || "Potential security threat detected";
  }

  /**
   * Get remediation for an injection type
   */
  private getRemediationForType(type: InjectionType): string {
    const remediations: Record<InjectionType, string> = {
      [InjectionType.SQL_INJECTION]:
        "Use parameterized queries or prepared statements instead of string concatenation",
      [InjectionType.XSS]:
        "HTML-encode user input before displaying in web pages and use Content Security Policy",
      [InjectionType.COMMAND_INJECTION]:
        "Avoid passing user input to shell commands; use safer alternatives",
      [InjectionType.LDAP_INJECTION]:
        "Use LDAP escaping functions and parameterized queries",
      [InjectionType.PATH_TRAVERSAL]:
        "Validate file paths and use a whitelist of allowed directories",
      [InjectionType.SSRF]:
        "Validate and whitelist allowed URLs; avoid sending requests to user-provided URLs",
      [InjectionType.NOSQL_INJECTION]:
        "Use parameterized queries and input validation for NoSQL databases",
      [InjectionType.TEMPLATE_INJECTION]:
        "Avoid including user input in template expressions; use auto-escaping",
      [InjectionType.HEADER_INJECTION]:
        "Validate and sanitize header values; remove CRLF characters",
      [InjectionType.XML_INJECTION]:
        "Use XML parsers with security features enabled; validate input against schema",
    };
    return remediations[type] || "Remove or sanitize the suspicious input";
  }

  /**
   * Apply a sanitization method
   */
  private applyMethod(input: string, method: SanitizationMethod, options: SanitizationOptions): string {
    switch (method) {
      case SanitizationMethod.HTML_ENCODE:
        return this.htmlEncode(input);

      case SanitizationMethod.HTML_STRIP:
        return this.htmlStrip(input);

      case SanitizationMethod.URL_ENCODE:
        return this.urlEncode(input);

      case SanitizationMethod.SQL_ESCAPE:
        return this.sqlEscape(input);

      case SanitizationMethod.COMMAND_ESCAPE:
        return this.commandEscape(input);

      case SanitizationMethod.LDAP_ESCAPE:
        return this.ldapEscape(input);

      case SanitizationMethod.PATH_NORMALIZE:
        return this.pathNormalize(input);

      case SanitizationMethod.XML_ENCODE:
        return this.xmlEncode(input);

      case SanitizationMethod.UNICODE_NORMALIZE:
        return this.unicodeNormalize(input, options.preserveUnicode ?? true);

      case SanitizationMethod.NULL_BYTE_STRIP:
        return this.nullByteStrip(input);

      case SanitizationMethod.CONTROL_CHAR_STRIP:
        return this.controlCharStrip(input);

      case SanitizationMethod.WHITESPACE_NORMALIZE:
        return input.replace(/\s+/g, " ").trim();

      default:
        return input;
    }
  }

  /**
   * HTML entity encoding
   */
  private htmlEncode(input: string): string {
    const htmlEntities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#x27;",
      "/": "&#x2F;",
    };
    return input.replace(/[&<>"'/]/g, (char) => htmlEntities[char]);
  }

  /**
   * HTML tag removal
   */
  private htmlStrip(input: string): string {
    return input.replace(/<[^>]*>/g, "");
  }

  /**
   * URL encoding
   */
  private urlEncode(input: string): string {
    return encodeURIComponent(input);
  }

  /**
   * SQL escaping
   */
  private sqlEscape(input: string): string {
    return input.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, (char) => {
      switch (char) {
        case "\0":
          return "\\0";
        case "\x08":
          return "\\b";
        case "\x09":
          return "\\t";
        case "\x1a":
          return "\\z";
        case "\n":
          return "\\n";
        case "\r":
          return "\\r";
        case '"':
        case "'":
        case "\\":
        case "%":
          return "\\" + char;
        default:
          return char;
      }
    });
  }

  /**
   * Command escaping
   */
  private commandEscape(input: string): string {
    // Escape shell metacharacters
    return input.replace(/[;&|`$()]/g, "\\$&");
  }

  /**
   * LDAP escaping
   */
  private ldapEscape(input: string): string {
    // Escape special LDAP characters
    return input.replace(/[\\=*()<>~&|!]/g, "\\$&");
  }

  /**
   * Path normalization
   */
  private pathNormalize(input: string): string {
    // Remove directory traversal attempts
    let normalized = input.replace(/\.\.[\/\\]/g, "");
    // Remove encoded traversal
    normalized = normalized.replace(/%2e%2e[\/\\%]/gi, "");
    // Remove null bytes
    normalized = normalized.replace(/\x00/g, "");
    // Normalize path separators
    normalized = normalized.replace(/[\/\\]+/g, "/");
    // Remove leading/trailing separators
    normalized = normalized.replace(/^\/+|\/+$/g, "");
    return normalized;
  }

  /**
   * XML encoding
   */
  private xmlEncode(input: string): string {
    const xmlEntities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&apos;",
    };
    return input.replace(/[&<>"']/g, (char) => xmlEntities[char]);
  }

  /**
   * Unicode normalization
   */
  private unicodeNormalize(input: string, preserveUnicode: boolean): string {
    if (!preserveUnicode) {
      // Strip non-ASCII characters
      return input.replace(/[^\x00-\x7F]/g, "");
    }
    // Normalize to NFC form
    return input.normalize("NFC");
  }

  /**
   * Null byte removal
   */
  private nullByteStrip(input: string): string {
    return input.replace(/\x00/g, "");
  }

  /**
   * Control character removal
   */
  private controlCharStrip(input: string): string {
    // Remove control characters except whitespace
    return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  }

  /**
   * Get contextual options for input source
   */
  private getContextualOptions(source: string): Partial<SanitizationOptions> {
    const sourceLower = source.toLowerCase();

    if (sourceLower.includes("web") || sourceLower.includes("form")) {
      return {
        checkFor: [InjectionType.XSS, InjectionType.SQL_INJECTION],
        methods: [SanitizationMethod.HTML_ENCODE],
      };
    }

    if (sourceLower.includes("api")) {
      return {
        checkFor: [InjectionType.SQL_INJECTION, InjectionType.COMMAND_INJECTION],
        methods: [SanitizationMethod.NULL_BYTE_STRIP],
      };
    }

    if (sourceLower.includes("cli") || sourceLower.includes("command")) {
      return {
        checkFor: [InjectionType.COMMAND_INJECTION],
        methods: [SanitizationMethod.COMMAND_ESCAPE],
      };
    }

    if (sourceLower.includes("file") || sourceLower.includes("path")) {
      return {
        checkFor: [InjectionType.PATH_TRAVERSAL],
        methods: [SanitizationMethod.PATH_NORMALIZE],
      };
    }

    if (sourceLower.includes("database") || sourceLower.includes("sql")) {
      return {
        checkFor: [InjectionType.SQL_INJECTION],
        methods: [SanitizationMethod.SQL_ESCAPE],
      };
    }

    return {};
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Global input sanitizer instance
 */
export const globalInputSanitizer = new InputSanitizer();

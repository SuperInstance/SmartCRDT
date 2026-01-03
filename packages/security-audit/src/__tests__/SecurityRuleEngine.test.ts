/**
 * Tests for SecurityRuleEngine
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SecurityRuleEngine } from "../rules/SecurityRuleEngine";
import { SecuritySeverity, OWASPVulnerabilityCategory, CustomVulnerabilityCategory, DetectionConfidence } from "@lsi/protocol";

describe("SecurityRuleEngine", () => {
  let engine: SecurityRuleEngine;

  beforeEach(() => {
    engine = new SecurityRuleEngine();
  });

  describe("Rule Loading", () => {
    it("should load default rules", () => {
      const rules = engine.getRules();
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.every((r) => r.enabled)).toBe(true);
    });

    it("should allow custom rules", () => {
      const customRule = {
        id: "test-rule" as const,
        name: "Test Rule",
        category: CustomVulnerabilityCategory.HARD_CODED_SECRET,
        severity: SecuritySeverity.HIGH,
        description: "Test rule for custom patterns",
        pattern: {
          type: "regex" as const,
          pattern: /TEST_PATTERN/g,
        },
        languages: ["javascript"],
        remediation: {
          summary: "Fix the pattern",
          description: "Remove the test pattern",
          priority: "medium" as const,
        },
        enabled: true,
      };

      engine.addRule(customRule);
      const rules = engine.getRules();
      expect(rules.some((r) => r.id === "test-rule")).toBe(true);
    });

    it("should allow disabling rules", () => {
      engine.toggleRule("sql-injection-direct" as any, false);
      const rules = engine.getRules();
      expect(rules.every((r) => r.id !== "sql-injection-direct")).toBe(true);
    });
  });

  describe("SQL Injection Detection", () => {
    it("should detect SQL injection via string concatenation", async () => {
      const code = `
        const userId = req.params.id;
        const query = "SELECT * FROM users WHERE id = " + userId;
        db.query(query);
      `;

      const findings = await engine.scanFile("test.js", code);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].category).toBe(OWASPVulnerabilityCategory.INJECTION);
      expect(findings[0].severity).toBe(SecuritySeverity.CRITICAL);
    });

    it("should detect SQL injection via template literals", async () => {
      const code = `
        const userId = req.params.id;
        const query = \`SELECT * FROM users WHERE id = ${userId}\`;
        db.query(query);
      `;

      const findings = await engine.scanFile("test.js", code);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].category).toBe(OWASPVulnerabilityCategory.INJECTION);
    });

    it("should not flag parameterized queries", async () => {
      const code = `
        const userId = req.params.id;
        const query = "SELECT * FROM users WHERE id = ?";
        db.query(query, [userId]);
      `;

      const findings = await engine.scanFile("test.js", code);
      const sqlFindings = findings.filter(
        (f) => f.category === OWASPVulnerabilityCategory.INJECTION
      );
      expect(sqlFindings.length).toBe(0);
    });
  });

  describe("XSS Detection", () => {
    it("should detect dangerous innerHTML usage", async () => {
      const code = `
        const userInput = req.query.name;
        element.innerHTML = userInput;
      `;

      const findings = await engine.scanFile("test.js", code);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].category).toBe(OWASPVulnerabilityCategory.INJECTION);
      expect(findings[0].severity).toBe(SecuritySeverity.HIGH);
    });

    it("should not flag safe string literals", async () => {
      const code = `
        element.innerHTML = "<div>Safe content</div>";
      `;

      const findings = await engine.scanFile("test.js", code);
      const xssFindings = findings.filter((f) => f.title.includes("innerHTML"));
      expect(xssFindings.length).toBe(0);
    });
  });

  describe("Hardcoded Secrets Detection", () => {
    it("should detect hardcoded API keys", async () => {
      const code = `
        const apiKey = "sk-1234567890abcdefghijklmnopqrstuvwxyz";
        api.call(apiKey);
      `;

      const findings = await engine.scanFile("test.js", code);
      const secretFindings = findings.filter(
        (f) => f.category === CustomVulnerabilityCategory.HARD_CODED_SECRET
      );
      expect(secretFindings.length).toBeGreaterThan(0);
    });

    it("should detect hardcoded passwords", async () => {
      const code = `
        const password = "SuperSecret123!";
        db.connect(password);
      `;

      const findings = await engine.scanFile("test.js", code);
      const passwordFindings = findings.filter(
        (f) => f.title.includes("Password")
      );
      expect(passwordFindings.length).toBeGreaterThan(0);
      expect(passwordFindings[0].severity).toBe(SecuritySeverity.CRITICAL);
    });

    it("should detect AWS access keys", async () => {
      const code = `
        const accessKey = "AKIAIOSFODNN7EXAMPLE";
        const secretKey = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
        s3.configure(accessKey, secretKey);
      `;

      const findings = await engine.scanFile("test.js", code);
      const awsFindings = findings.filter(
        (f) => f.title.includes("AWS")
      );
      expect(awsFindings.length).toBeGreaterThan(0);
    });

    it("should have lower confidence for example values", async () => {
      const code = `
        const apiKey = "your-api-key-here";
        api.call(apiKey);
      `;

      const findings = await engine.scanFile("test.js", code);
      const secretFindings = findings.filter(
        (f) => f.category === CustomVulnerabilityCategory.HARD_CODED_SECRET
      );
      expect(secretFindings.length).toBeGreaterThan(0);
      expect(secretFindings[0].confidence).toBe(DetectionConfidence.LOW);
    });
  });

  describe("Weak Cryptography Detection", () => {
    it("should detect MD5 usage", async () => {
      const code = `
        const hash = crypto.createHash('md5').update(data).digest('hex');
      `;

      const findings = await engine.scanFile("test.js", code);
      const cryptoFindings = findings.filter(
        (f) => f.category === CustomVulnerabilityCategory.WEAK_CRYPTOGRAPHY
      );
      expect(cryptoFindings.length).toBeGreaterThan(0);
      expect(cryptoFindings[0].severity).toBe(SecuritySeverity.HIGH);
    });

    it("should recommend stronger hash functions", async () => {
      const code = `
        const hash = crypto.createHash('md5').update(data).digest('hex');
      `;

      const findings = await engine.scanFile("test.js", code);
      const cryptoFindings = findings.filter(
        (f) => f.category === CustomVulnerabilityCategory.WEAK_CRYPTOGRAPHY
      );
      expect(cryptoFindings[0].remediation.description).toContain("SHA-256");
    });
  });

  describe("Insecure Random Detection", () => {
    it("should detect Math.random() for security", async () => {
      const code = `
        const token = Math.random().toString(36);
      `;

      const findings = await engine.scanFile("test.js", code);
      const randomFindings = findings.filter(
        (f) => f.category === CustomVulnerabilityCategory.INSECURE_RANDOM
      );
      expect(randomFindings.length).toBeGreaterThan(0);
    });

    it("should recommend crypto.randomBytes()", async () => {
      const code = `
        const token = Math.random().toString(36);
      `;

      const findings = await engine.scanFile("test.js", code);
      const randomFindings = findings.filter(
        (f) => f.category === CustomVulnerabilityCategory.INSECURE_RANDOM
      );
      expect(randomFindings[0].remediation.codeExample).toContain("crypto.randomBytes");
    });
  });

  describe("Debug Mode Detection", () => {
    it("should detect debug mode enabled", async () => {
      const code = `
        const DEBUG = true;
        console.log('Debug info', sensitiveData);
      `;

      const findings = await engine.scanFile("test.js", code);
      const debugFindings = findings.filter(
        (f) => f.category === CustomVulnerabilityCategory.DEBUG_ENABLED
      );
      expect(debugFindings.length).toBeGreaterThan(0);
    });

    it("should detect NODE_ENV development", async () => {
      const code = `
        if (process.env.NODE_ENV !== 'production') {
          console.log(data);
        }
      `;

      const findings = await engine.scanFile("test.js", code);
      const debugFindings = findings.filter(
        (f) => f.category === CustomVulnerabilityCategory.DEBUG_ENABLED
      );
      expect(debugFindings.length).toBeGreaterThan(0);
    });
  });

  describe("Multi-language Support", () => {
    it("should scan Python files", async () => {
      const code = `
        user_id = request.args.get('id')
        query = "SELECT * FROM users WHERE id = " + user_id
        db.execute(query)
      `;

      const findings = await engine.scanFile("test.py", code);
      expect(findings.length).toBeGreaterThan(0);
    });

    it("should scan Java files", async () => {
      const code = `
        String userId = request.getParameter("id");
        String query = "SELECT * FROM users WHERE id = " + userId;
        statement.execute(query);
      `;

      const findings = await engine.scanFile("test.java", code);
      expect(findings.length).toBeGreaterThan(0);
    });
  });

  describe("Finding Structure", () => {
    it("should include proper location information", async () => {
      const code = `
        const apiKey = "sk-1234567890abcdefghijklmnopqrstuvwxyz";
      `;

      const findings = await engine.scanFile("test.js", code);
      expect(findings[0].location).toHaveProperty("file");
      expect(findings[0].location).toHaveProperty("line");
      expect(findings[0].location).toHaveProperty("column");
    });

    it("should include remediation guidance", async () => {
      const code = `
        const password = "hardcoded-password";
      `;

      const findings = await engine.scanFile("test.js", code);
      expect(findings[0].remediation).toHaveProperty("summary");
      expect(findings[0].remediation).toHaveProperty("description");
      expect(findings[0].remediation).toHaveProperty("priority");
    });

    it("should include CWE reference when applicable", async () => {
      const code = `
        const query = "SELECT * FROM users WHERE id = " + userInput;
      `;

      const findings = await engine.scanFile("test.js", code);
      const sqlFindings = findings.filter(
        (f) => f.category === OWASPVulnerabilityCategory.INJECTION
      );
      expect(sqlFindings[0].cweId).toBe("CWE-89");
    });
  });
});

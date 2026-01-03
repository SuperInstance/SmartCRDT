/**
 * Tests for InputSanitizer
 */

import { describe, it, expect, beforeEach } from "vitest";
import { InputSanitizer } from "./InputSanitizer.js";
import type { InjectionType, SanitizationMethod, InputSource, InputContext } from "@lsi/protocol";

describe("InputSanitizer", () => {
  let sanitizer: InputSanitizer;

  beforeEach(() => {
    sanitizer = new InputSanitizer();
  });

  describe("SQL Injection Detection", () => {
    it("should detect basic SQL injection", () => {
      const input = "admin' OR '1'='1";
      const result = sanitizer.sanitize(input, {
        checkFor: ["SQL_INJECTION" as never],
      });

      expect(result.threats.length).toBeGreaterThan(0);
      expect(result.threats[0].type).toBe("SQL_INJECTION");
    });

    it("should detect UNION-based SQL injection", () => {
      const input = "1' UNION SELECT * FROM users--";
      const result = sanitizer.sanitize(input, {
        checkFor: ["SQL_INJECTION" as never],
      });

      expect(result.threats.length).toBeGreaterThan(0);
      expect(result.threats.some((t) => t.type === "SQL_INJECTION")).toBe(true);
    });

    it("should detect comment-based SQL injection", () => {
      const input = "admin'--";
      const result = sanitizer.sanitize(input, {
        checkFor: ["SQL_INJECTION" as never],
      });

      expect(result.threats.length).toBeGreaterThan(0);
    });

    it("should detect hex-encoded SQL injection", () => {
      const input = "0x27 OR 1=1--";
      const result = sanitizer.sanitize(input, {
        checkFor: ["SQL_INJECTION" as never],
      });

      expect(result.threats.length).toBeGreaterThan(0);
    });
  });

  describe("XSS Detection", () => {
    it("should detect script tag XSS", () => {
      const input = "<script>alert('XSS')</script>";
      const result = sanitizer.sanitize(input, {
        checkFor: ["XSS" as never],
      });

      expect(result.threats.length).toBeGreaterThan(0);
      expect(result.threats[0].type).toBe("XSS");
    });

    it("should detect on* event handler XSS", () => {
      const input = '<img src=x onerror="alert(1)">';
      const result = sanitizer.sanitize(input, {
        checkFor: ["XSS" as never],
      });

      expect(result.threats.length).toBeGreaterThan(0);
    });

    it("should detect javascript protocol XSS", () => {
      const input = '<a href="javascript:alert(1)">click</a>';
      const result = sanitizer.sanitize(input, {
        checkFor: ["XSS" as never],
      });

      expect(result.threats.length).toBeGreaterThan(0);
    });

    it("should detect iframe XSS", () => {
      const input = '<iframe src="javascript:alert(1)"></iframe>';
      const result = sanitizer.sanitize(input, {
        checkFor: ["XSS" as never],
      });

      expect(result.threats.length).toBeGreaterThan(0);
    });
  });

  describe("Command Injection Detection", () => {
    it("should detect pipe command injection", () => {
      const input = "file.txt | cat /etc/passwd";
      const result = sanitizer.sanitize(input, {
        checkFor: ["COMMAND_INJECTION" as never],
      });

      expect(result.threats.length).toBeGreaterThan(0);
      expect(result.threats[0].type).toBe("COMMAND_INJECTION");
    });

    it("should detect command substitution", () => {
      const input = "file$(whoami).txt";
      const result = sanitizer.sanitize(input, {
        checkFor: ["COMMAND_INJECTION" as never],
      });

      expect(result.threats.length).toBeGreaterThan(0);
    });

    it("should detect backtick substitution", () => {
      const input = "file`whoami`.txt";
      const result = sanitizer.sanitize(input, {
        checkFor: ["COMMAND_INJECTION" as never],
      });

      expect(result.threats.length).toBeGreaterThan(0);
    });
  });

  describe("Path Traversal Detection", () => {
    it("should detect ../ traversal", () => {
      const input = "../../../etc/passwd";
      const result = sanitizer.sanitize(input, {
        checkFor: ["PATH_TRAVERSAL" as never],
      });

      expect(result.threats.length).toBeGreaterThan(0);
      expect(result.threats[0].type).toBe("PATH_TRAVERSAL");
    });

    it("should detect URL-encoded traversal", () => {
      const input = "%2e%2e%2fetc%2fpasswd";
      const result = sanitizer.sanitize(input, {
        checkFor: ["PATH_TRAVERSAL" as never],
      });

      expect(result.threats.length).toBeGreaterThan(0);
    });
  });

  describe("SSRF Detection", () => {
    it("should detect localhost in URL", () => {
      const input = "http://localhost:8080/admin";
      const result = sanitizer.sanitize(input, {
        checkFor: ["SSRF" as never],
      });

      expect(result.threats.length).toBeGreaterThan(0);
      expect(result.threats[0].type).toBe("SSRF");
    });

    it("should detect 127.0.0.1 in URL", () => {
      const input = "http://127.0.0.1/admin";
      const result = sanitizer.sanitize(input, {
        checkFor: ["SSRF" as never],
      });

      expect(result.threats.length).toBeGreaterThan(0);
    });

    it("should detect private IP ranges", () => {
      const input = "http://192.168.1.1/admin";
      const result = sanitizer.sanitize(input, {
        checkFor: ["SSRF" as never],
      });

      expect(result.threats.length).toBeGreaterThan(0);
    });
  });

  describe("NoSQL Injection Detection", () => {
    it("should detect MongoDB operators", () => {
      const input = '{"$ne": null}';
      const result = sanitizer.sanitize(input, {
        checkFor: ["NOSQL_INJECTION" as never],
      });

      expect(result.threats.length).toBeGreaterThan(0);
      expect(result.threats[0].type).toBe("NOSQL_INJECTION");
    });

    it("should detect $where operator", () => {
      const input = '{$where: "this.password == \'12345\'"}';
      const result = sanitizer.sanitize(input, {
        checkFor: ["NOSQL_INJECTION" as never],
      });

      expect(result.threats.length).toBeGreaterThan(0);
    });
  });

  describe("Template Injection Detection", () => {
    it("should detect Jinja2 template injection", () => {
      const input = "{{config.items()}}";
      const result = sanitizer.sanitize(input, {
        checkFor: ["TEMPLATE_INJECTION" as never],
      });

      expect(result.threats.length).toBeGreaterThan(0);
      expect(result.threats[0].type).toBe("TEMPLATE_INJECTION");
    });

    it("should detect FreeMarker template injection", () => {
      const input = "${'freemarker.template.utility.Execute'?new()('id')}";
      const result = sanitizer.sanitize(input, {
        checkFor: ["TEMPLATE_INJECTION" as never],
      });

      expect(result.threats.length).toBeGreaterThan(0);
    });
  });

  describe("Sanitization Methods", () => {
    it("should HTML encode dangerous characters", () => {
      const input = '<script>alert("XSS")</script>';
      const result = sanitizer.sanitize(input, {
        methods: ["HTML_ENCODE" as never],
      });

      expect(result.sanitized).toContain("&lt;");
      expect(result.sanitized).toContain("&gt;");
      expect(result.sanitized).not.toContain("<script>");
    });

    it("should strip HTML tags", () => {
      const input = "<p>Hello <b>World</b></p>";
      const result = sanitizer.sanitize(input, {
        methods: ["HTML_STRIP" as never],
      });

      expect(result.sanitized).toBe("Hello World");
    });

    it("should escape SQL characters", () => {
      const input = "admin' OR '1'='1";
      const result = sanitizer.sanitize(input, {
        methods: ["SQL_ESCAPE" as never],
      });

      expect(result.sanitized).toContain("\\'");
    });

    it("should escape command characters", () => {
      const input = "file | cat /etc/passwd";
      const result = sanitizer.sanitize(input, {
        methods: ["COMMAND_ESCAPE" as never],
      });

      expect(result.sanitized).toContain("\\|");
    });

    it("should normalize paths", () => {
      const input = "../../../etc/passwd";
      const result = sanitizer.sanitize(input, {
        methods: ["PATH_NORMALIZE" as never],
      });

      expect(result.sanitized).not.toContain("..");
    });

    it("should strip null bytes", () => {
      const input = "file\x00.txt";
      const result = sanitizer.sanitize(input, {
        methods: ["NULL_BYTE_STRIP" as never],
      });

      expect(result.sanitized).not.toContain("\x00");
    });

    it("should strip control characters", () => {
      const input = "test\x00\x1btext";
      const result = sanitizer.sanitize(input, {
        methods: ["CONTROL_CHAR_STRIP" as never],
      });

      expect(result.sanitized).not.toContain("\x00");
      expect(result.sanitized).not.toContain("\x1b");
    });
  });

  describe("Context-Aware Sanitization", () => {
    it("should apply web form context", () => {
      const context: InputContext = {
        source: InputSource.WEB_FORM,
        timestamp: new Date(),
      };

      const input = '<script>alert("XSS")</script>';
      const result = sanitizer.sanitizeWithContext(input, context);

      expect(result.methodsApplied).toContain("HTML_ENCODE");
    });

    it("should apply CLI context", () => {
      const context: InputContext = {
        source: InputSource.CLI_ARG,
        timestamp: new Date(),
      };

      const input = "file | cat /etc/passwd";
      const result = sanitizer.sanitizeWithContext(input, context);

      expect(result.methodsApplied).toContain("COMMAND_ESCAPE");
    });
  });

  describe("Batch Sanitization", () => {
    it("should sanitize multiple inputs", () => {
      const inputs = {
        username: "admin' OR '1'='1",
        email: "<script>alert(1)</script>@example.com",
        comment: "test || rm -rf /",
      };

      const results = sanitizer.sanitizeBatch(inputs, {
        checkFor: [
          "SQL_INJECTION" as never,
          "XSS" as never,
          "COMMAND_INJECTION" as never,
        ],
      });

      expect(Object.keys(results).length).toBe(3);
      expect(results.username.threats.length).toBeGreaterThan(0);
      expect(results.email.threats.length).toBeGreaterThan(0);
      expect(results.comment.threats.length).toBeGreaterThan(0);
    });
  });

  describe("Statistics", () => {
    it("should track sanitization statistics", () => {
      sanitizer.sanitize("normal input");
      sanitizer.sanitize("<script>alert(1)</script>", {
        checkFor: ["XSS" as never],
      });

      const stats = sanitizer.getStatistics();

      expect(stats.totalInputs).toBe(2);
      expect(stats.threatDetectedCount).toBe(1);
    });

    it("should reset statistics", () => {
      sanitizer.sanitize("<script>alert(1)</script>", {
        checkFor: ["XSS" as never],
      });

      sanitizer.resetStatistics();

      const stats = sanitizer.getStatistics();

      expect(stats.totalInputs).toBe(0);
      expect(stats.threatDetectedCount).toBe(0);
    });
  });

  describe("Length Constraints", () => {
    it("should enforce maximum length", () => {
      const input = "a".repeat(1000);
      const result = sanitizer.sanitize(input, {
        maxLength: 100,
      });

      expect(result.sanitized.length).toBe(100);
    });
  });

  describe("Custom Rules", () => {
    it("should apply custom sanitization rules", () => {
      const input = "Replace THIS text";

      const result = sanitizer.sanitize(input, {
        customRules: [
          {
            name: "replace-this",
            pattern: "THIS",
            replacement: "THAT",
            description: "Replace THIS with THAT",
          },
        ],
      });

      expect(result.sanitized).toContain("THAT");
      expect(result.sanitized).not.toContain("THIS");
    });
  });
});

/**
 * Tests for security hardening modules
 */

import { describe, it, expect } from "vitest";
import {
  SecurityHeaders,
  createSecurityHeaders,
  SecurityHeaderType,
} from "../../hardening/SecurityHeaders.js";
import {
  InputValidator,
  createInputValidator,
  ValidationSchemas,
} from "../../hardening/InputValidation.js";
import { OutputEncoder, EncodingUtils } from "../../hardening/OutputEncoding.js";
import {
  CryptoHardening,
  createCryptoHardening,
  CryptoUtils,
  HashAlgorithm,
} from "../../hardening/CryptoHardening.js";

describe("SecurityHeaders", () => {
  it("should create headers", () => {
    const headers = createSecurityHeaders();
    expect(headers).toBeInstanceOf(SecurityHeaders);
  });

  it("should validate headers", () => {
    const headers = createSecurityHeaders();
    const results = headers.validateHeaders({
      "content-security-policy": "default-src 'self'",
      "strict-transport-security": "max-age=31536000",
    });
    expect(results.length).toBeGreaterThan(0);
  });

  it("should generate recommended headers", () => {
    const headers = createSecurityHeaders();
    const generated = headers.generateHeaders();
    expect(generated).toHaveProperty("Content-Security-Policy");
    expect(generated).toHaveProperty("Strict-Transport-Security");
  });

  it("should validate CSP", () => {
    const headers = createSecurityHeaders();
    const result = headers.validateCSP("default-src 'self'");
    expect(result.present).toBe(true);
  });
});

describe("InputValidator", () => {
  it("should create validator", () => {
    const validator = createInputValidator({
      username: { type: "string", required: true, minLength: 3 },
    });
    expect(validator).toBeInstanceOf(InputValidator);
  });

  it("should validate valid input", () => {
    const validator = createInputValidator({
      username: { type: "string", required: true, minLength: 3 },
    });
    const result = validator.validate({ username: "testuser" });
    expect(result.valid).toBe(true);
  });

  it("should validate invalid input", () => {
    const validator = createInputValidator({
      username: { type: "string", required: true, minLength: 3 },
    });
    const result = validator.validate({ username: "ab" });
    expect(result.valid).toBe(false);
  });

  it("should sanitize input", () => {
    const validator = createInputValidator({
      username: {
        type: "string",
        required: true,
        sanitize: (v) => v.trim().toLowerCase(),
      },
    });
    const result = validator.validate({ username: "  TESTUSER  " });
    expect(result.sanitized?.username).toBe("testuser");
  });
});

describe("OutputEncoder", () => {
  it("should encode HTML", () => {
    const encoded = OutputEncoder.encodeHTML("<script>alert('xss')</script>");
    expect(encoded).not.toContain("<script>");
    expect(encoded).toContain("&lt;");
  });

  it("should encode URL", () => {
    const encoded = OutputEncoder.encodeURL("test@example.com");
    expect(encoded).toContain("%");
  });

  it("should encode JavaScript", () => {
    const encoded = OutputEncoder.encodeJavaScript("'; alert('xss');//");
    expect(encoded).toContain("\\x");
  });

  it("should sanitize HTML", () => {
    const sanitized = OutputEncoder.sanitizeHTML("<script>alert('xss')</script>");
    expect(sanitized).not.toContain("<script>");
  });

  it("should strip dangerous tags", () => {
    const sanitized = OutputEncoder.stripDangerousTags(
      "<script>alert('xss')</script><p>safe</p>"
    );
    expect(sanitized).not.toContain("<script>");
    expect(sanitized).toContain("<p>safe</p>");
  });
});

describe("CryptoHardening", () => {
  it("should create hardening utils", () => {
    const crypto = createCryptoHardening();
    expect(crypto).toBeInstanceOf(CryptoHardening);
  });

  it("should validate weak algorithm", () => {
    const crypto = createCryptoHardening();
    const result = crypto.validateAlgorithm("md5");
    expect(result.secure).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("should validate strong algorithm", () => {
    const crypto = createCryptoHardening();
    const result = crypto.validateAlgorithm("aes-256-gcm");
    expect(result.secure).toBe(true);
  });

  it("should validate random generation", () => {
    const crypto = createCryptoHardening();
    const result = crypto.validateRandomGeneration("Math.random()");
    expect(result.secure).toBe(false);
  });

  it("should generate random bytes", () => {
    const bytes = CryptoUtils.randomBytes(16);
    expect(bytes.length).toBe(16);
  });

  it("should generate random string", () => {
    const str = CryptoUtils.randomString(32);
    expect(str.length).toBe(32);
  });

  it("should generate UUID", () => {
    const uuid = CryptoUtils.generateUUID();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("should hash data", () => {
    const hash = CryptoUtils.hash("test", HashAlgorithm.SHA256);
    expect(hash).toHaveLength(64);
  });

  it("should hash password", () => {
    const result = CryptoUtils.hashPassword("password123");
    expect(result.hash).toBeTruthy();
    expect(result.salt).toBeTruthy();
  });

  it("should verify password", () => {
    const result = CryptoUtils.hashPassword("password123");
    const verified = CryptoUtils.verifyPassword("password123", result.hash, result.salt);
    expect(verified).toBe(true);
  });
});

/**
import { SecuritySeverity, CodeLocation, DetectionConfidence } from "../types.js";

 * SecurityHeaders - Security hardening through HTTP headers
 *
 * Provides security header recommendations and validation:
 * - Content Security Policy (CSP)
 * - HTTP Strict Transport Security (HSTS)
 * - X-Frame-Options (clickjacking protection)
 * - X-Content-Type-Options (MIME sniffing)
 * - X-XSS-Protection
 * - Referrer-Policy
 * - Permissions-Policy
 * - Cross-Origin Resource Sharing (CORS)
 */

import type { SecuritySeverity } from "@lsi/protocol";
import { DetectionConfidence } from "@lsi/protocol";

/**
 * Security header type
 */
export enum SecurityHeaderType {
  CSP = "content-security-policy",
  HSTS = "strict-transport-security",
  X_FRAME_OPTIONS = "x-frame-options",
  X_CONTENT_TYPE_OPTIONS = "x-content-type-options",
  X_XSS_PROTECTION = "x-xss-protection",
  REFERRER_POLICY = "referrer-policy",
  PERMISSIONS_POLICY = "permissions-policy",
  CORS = "cross-origin-resource-sharing",
}

/**
 * Security header validation result
 */
export interface SecurityHeaderResult {
  header: SecurityHeaderType;
  present: boolean;
  value?: string;
  secure: boolean;
  severity: SecuritySeverity;
  confidence: DetectionConfidence;
  issues: string[];
  recommendations: string[];
}

/**
 * Security header configuration
 */
export interface SecurityHeaderConfig {
  /** Enable HSTS with max-age */
  hstsMaxAge?: number;
  /** Include subdomains in HSTS */
  hstsIncludeSubdomains?: boolean;
  /** Enable HSTS preload */
  hstsPreload?: boolean;
  /** CSP policy template */
  cspPolicy?: CSPPolicy;
  /** Referrer policy */
  referrerPolicy?: ReferrerPolicy;
  /** CORS policy */
  corsPolicy?: CORSPolicy;
}

/**
 * CSP policy configuration
 */
export interface CSPPolicy {
  /** Default source for content */
  defaultSrc?: string[];
  /** Script sources */
  scriptSrc?: string[];
  /** Style sources */
  styleSrc?: string[];
  /** Image sources */
  imgSrc?: string[];
  /** Font sources */
  fontSrc?: string[];
  /** Connect sources */
  connectSrc?: string[];
  /** Media sources */
  mediaSrc?: string[];
  /** Object sources */
  objectSrc?: string[];
  /** Frame sources */
  frameSrc?: string[];
  /** Base URI */
  baseUri?: string[];
  /** Form action */
  formAction?: string[];
  /** Frame ancestors */
  frameAncestors?: string[];
  /** Report URI for violations */
  reportUri?: string;
  /** Report-to endpoint */
  reportTo?: string;
}

/**
 * Referrer policy values
 */
export type ReferrerPolicy =
  | "no-referrer"
  | "no-referrer-when-downgrade"
  | "same-origin"
  | "strict-origin"
  | "strict-origin-when-cross-origin"
  | "origin-when-cross-origin"
  | "unsafe-url";

/**
 * CORS policy configuration
 */
export interface CORSPolicy {
  /** Allowed origins */
  origins?: string[];
  /** Allowed methods */
  methods?: string[];
  /** Allowed headers */
  headers?: string[];
  /** Allow credentials */
  credentials?: boolean;
  /** Max age for preflight */
  maxAge?: number;
  /** Exposed headers */
  exposedHeaders?: string[];
}

/**
 * SecurityHeaders - Provides security header recommendations
 */
export class SecurityHeaders {
  private config: Required<SecurityHeaderConfig>;

  constructor(config: SecurityHeaderConfig = {}) {
    this.config = {
      hstsMaxAge: config.hstsMaxAge ?? 31536000, // 1 year
      hstsIncludeSubdomains: config.hstsIncludeSubdomains ?? true,
      hstsPreload: config.hstsPreload ?? true,
      cspPolicy: config.cspPolicy ?? this.getDefaultCSP(),
      referrerPolicy: config.referrerPolicy ?? "strict-origin-when-cross-origin",
      corsPolicy: config.corsPolicy ?? this.getDefaultCORS(),
    };
  }

  /**
   * Get default CSP policy
   */
  private getDefaultCSP(): CSPPolicy {
    return {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    };
  }

  /**
   * Get default CORS policy
   */
  private getDefaultCORS(): CORSPolicy {
    return {
      origins: ["https://yourdomain.com"],
      methods: ["GET", "POST", "PUT", "DELETE"],
      headers: ["Content-Type", "Authorization"],
      credentials: false,
      maxAge: 86400,
    };
  }

  /**
   * Validate existing security headers
   */
  validateHeaders(headers: Record<string, string>): SecurityHeaderResult[] {
    const results: SecurityHeaderResult[] = [];

    // Validate CSP
    results.push(this.validateCSP(headers["content-security-policy"]));

    // Validate HSTS
    results.push(this.validateHSTS(headers["strict-transport-security"]));

    // Validate X-Frame-Options
    results.push(this.validateXFrameOptions(headers["x-frame-options"]));

    // Validate X-Content-Type-Options
    results.push(this.validateXContentTypeOptions(headers["x-content-type-options"]));

    // Validate X-XSS-Protection
    results.push(this.validateXXSSProtection(headers["x-xss-protection"]));

    // Validate Referrer-Policy
    results.push(this.validateReferrerPolicy(headers["referrer-policy"]));

    // Validate Permissions-Policy
    results.push(this.validatePermissionsPolicy(headers["permissions-policy"]));

    return results;
  }

  /**
   * Validate Content Security Policy
   */
  private validateCSP(cspHeader?: string): SecurityHeaderResult {
    const issues: string[] = [];
    const recommendations: string[] = [];

    if (!cspHeader) {
      return {
        header: SecurityHeaderType.CSP,
        present: false,
        secure: false,
        severity: "HIGH" as SecuritySeverity,
        confidence: DetectionConfidence.CERTAIN,
        issues: ["Content-Security-Policy header is missing"],
        recommendations: [
          "Implement a strict Content-Security-Policy",
          "Use 'self' for default sources",
          "Avoid 'unsafe-inline' and 'unsafe-eval'",
          "Use nonce or hash for inline scripts",
        ],
      };
    }

    // Check for unsafe directives
    if (/unsafe-inline/i.test(cspHeader)) {
      issues.push("CSP allows 'unsafe-inline' (enables XSS attacks)");
      recommendations.push("Remove 'unsafe-inline' and use nonce or hash");
    }

    if (/unsafe-eval/i.test(cspHeader)) {
      issues.push("CSP allows 'unsafe-eval' (enables code injection)");
      recommendations.push("Remove 'unsafe-eval' from script-src");
    }

    if (/\*/i.test(cspHeader) && !/data:/i.test(cspHeader)) {
      issues.push("CSP allows wildcard sources (very permissive)");
      recommendations.push("Replace wildcards with specific origins");
    }

    // Check for important directives
    if (!/default-src/i.test(cspHeader)) {
      issues.push("Missing default-src directive");
      recommendations.push("Add default-src directive");
    }

    if (!/script-src/i.test(cspHeader)) {
      recommendations.push("Consider adding explicit script-src directive");
    }

    if (!/object-src\s+['"]none['"]|object-src\s+['"]none['"]/i.test(cspHeader)) {
      recommendations.push("Set object-src to 'none' to prevent plugin execution");
    }

    return {
      header: SecurityHeaderType.CSP,
      present: true,
      value: cspHeader,
      secure: issues.length === 0,
      severity: issues.length > 0 ? ("HIGH" as SecuritySeverity) : ("NONE" as SecuritySeverity),
      confidence: DetectionConfidence.HIGH,
      issues,
      recommendations,
    };
  }

  /**
   * Validate HTTP Strict Transport Security
   */
  private validateHSTS(hstsHeader?: string): SecurityHeaderResult {
    const issues: string[] = [];
    const recommendations: string[] = [];

    if (!hstsHeader) {
      return {
        header: SecurityHeaderType.HSTS,
        present: false,
        secure: false,
        severity: "HIGH" as SecuritySeverity,
        confidence: DetectionConfidence.CERTAIN,
        issues: ["Strict-Transport-Security header is missing"],
        recommendations: [
          "Enable HSTS with max-age of at least 31536000 (1 year)",
          "Include 'includeSubDomains' directive",
          "Consider adding 'preload' for browser preload list",
        ],
      };
    }

    // Parse max-age
    const maxAgeMatch = hstsHeader.match(/max-age=(\d+)/i);
    if (maxAgeMatch) {
      const maxAge = parseInt(maxAgeMatch[1], 10);
      if (maxAge < 31536000) {
        issues.push(`HSTS max-age is less than 1 year (${maxAge}s)`);
        recommendations.push("Increase max-age to 31536000 (1 year) or more");
      }
    } else {
      issues.push("HSTS missing max-age directive");
      recommendations.push("Add max-age directive");
    }

    // Check for includeSubDomains
    if (!/includeSubDomains/i.test(hstsHeader)) {
      issues.push("HSTS missing 'includeSubDomains' directive");
      recommendations.push("Add 'includeSubDomains' to protect all subdomains");
    }

    // Check for preload
    if (!/preload/i.test(hstsHeader)) {
      recommendations.push("Consider adding 'preload' for browser preload list inclusion");
    }

    return {
      header: SecurityHeaderType.HSTS,
      present: true,
      value: hstsHeader,
      secure: issues.length === 0,
      severity: issues.length > 0 ? ("MEDIUM" as SecuritySeverity) : ("NONE" as SecuritySeverity),
      confidence: DetectionConfidence.CERTAIN,
      issues,
      recommendations,
    };
  }

  /**
   * Validate X-Frame-Options
   */
  private validateXFrameOptions(frameOptions?: string): SecurityHeaderResult {
    const issues: string[] = [];
    const recommendations: string[] = [];

    if (!frameOptions) {
      return {
        header: SecurityHeaderType.X_FRAME_OPTIONS,
        present: false,
        secure: false,
        severity: "MEDIUM" as SecuritySeverity,
        confidence: DetectionConfidence.HIGH,
        issues: ["X-Frame-Options header is missing"],
        recommendations: [
          "Add X-Frame-Options header",
          "Use 'DENY' or 'SAMEORIGIN'",
          "Note: CSP frame-ancestors is preferred over X-Frame-Options",
        ],
      };
    }

    const value = frameOptions.trim().toUpperCase();

    if (value === "DENY") {
      // Most secure
    } else if (value === "SAMEORIGIN") {
      recommendations.push("Consider using 'DENY' for maximum protection");
    } else if (value.startsWith("ALLOW-FROM")) {
      issues.push("ALLOW-FROM is deprecated and not supported in modern browsers");
      recommendations.push("Use CSP frame-ancestors instead");
    } else {
      issues.push("Invalid X-Frame-Options value");
      recommendations.push("Use 'DENY' or 'SAMEORIGIN'");
    }

    return {
      header: SecurityHeaderType.X_FRAME_OPTIONS,
      present: true,
      value: frameOptions,
      secure: issues.length === 0,
      severity: issues.length > 0 ? ("LOW" as SecuritySeverity) : ("NONE" as SecuritySeverity),
      confidence: DetectionConfidence.HIGH,
      issues,
      recommendations,
    };
  }

  /**
   * Validate X-Content-Type-Options
   */
  private validateXContentTypeOptions(contentTypeOptions?: string): SecurityHeaderResult {
    const issues: string[] = [];
    const recommendations: string[] = [];

    if (!contentTypeOptions) {
      return {
        header: SecurityHeaderType.X_CONTENT_TYPE_OPTIONS,
        present: false,
        secure: false,
        severity: "LOW" as SecuritySeverity,
        confidence: DetectionConfidence.MEDIUM,
        issues: ["X-Content-Type-Options header is missing"],
        recommendations: [
          "Add X-Content-Type-Options: nosniff",
          "Prevents MIME type sniffing",
        ],
      };
    }

    if (contentTypeOptions.trim().toLowerCase() !== "nosniff") {
      issues.push("X-Content-Type-Options should be set to 'nosniff'");
    }

    return {
      header: SecurityHeaderType.X_CONTENT_TYPE_OPTIONS,
      present: true,
      value: contentTypeOptions,
      secure: contentTypeOptions.trim().toLowerCase() === "nosniff",
      severity: issues.length > 0 ? ("LOW" as SecuritySeverity) : ("NONE" as SecuritySeverity),
      confidence: DetectionConfidence.HIGH,
      issues,
      recommendations,
    };
  }

  /**
   * Validate X-XSS-Protection
   */
  private validateXXSSProtection(xssProtection?: string): SecurityHeaderResult {
    const issues: string[] = [];
    const recommendations: string[] = [];

    if (!xssProtection) {
      recommendations.push(
        "Note: X-XSS-Protection is deprecated in favor of CSP. " +
        "Consider omitting this header if CSP is properly configured."
      );
    } else if (/1;\s*mode=block/i.test(xssProtection)) {
      // Best configuration
    } else if (/^0$/i.test(xssProtection)) {
      issues.push("X-XSS-Protection is disabled");
      recommendations.push("Enable X-XSS-Protection or rely on CSP");
    } else if (/^1(;|$)/i.test(xssProtection)) {
      recommendations.push("Consider adding 'mode=block' for better protection");
    }

    return {
      header: SecurityHeaderType.X_XSS_PROTECTION,
      present: !!xssProtection,
      value: xssProtection,
      secure: !issues.length,
      severity: issues.length > 0 ? ("LOW" as SecuritySeverity) : ("NONE" as SecuritySeverity),
      confidence: DetectionConfidence.LOW,
      issues,
      recommendations,
    };
  }

  /**
   * Validate Referrer-Policy
   */
  private validateReferrerPolicy(referrerPolicy?: string): SecurityHeaderResult {
    const issues: string[] = [];
    const recommendations: string[] = [];

    if (!referrerPolicy) {
      return {
        header: SecurityHeaderType.REFERRER_POLICY,
        present: false,
        secure: false,
        severity: "LOW" as SecuritySeverity,
        confidence: DetectionConfidence.MEDIUM,
        issues: ["Referrer-Policy header is missing"],
        recommendations: [
          "Add Referrer-Policy header",
          "Use 'strict-origin-when-cross-origin' or 'no-referrer'",
          "Prevents leaking sensitive URLs in Referer header",
        ],
      };
    }

    const value = referrerPolicy.trim().toLowerCase();

    if (value === "unsafe-url") {
      issues.push("Referrer-Policy is set to 'unsafe-url' (leaks full URL)");
      recommendations.push("Use 'strict-origin-when-cross-origin' instead");
    } else if (value === "no-referrer-when-downgrade") {
      recommendations.push("Consider 'strict-origin-when-cross-origin' for better privacy");
    }

    return {
      header: SecurityHeaderType.REFERRER_POLICY,
      present: true,
      value: referrerPolicy,
      secure: value !== "unsafe-url",
      severity: issues.length > 0 ? ("MEDIUM" as SecuritySeverity) : ("NONE" as SecuritySeverity),
      confidence: DetectionConfidence.HIGH,
      issues,
      recommendations,
    };
  }

  /**
   * Validate Permissions-Policy
   */
  private validatePermissionsPolicy(permissionsPolicy?: string): SecurityHeaderResult {
    const issues: string[] = [];
    const recommendations: string[] = [];

    if (!permissionsPolicy) {
      return {
        header: SecurityHeaderType.PERMISSIONS_POLICY,
        present: false,
        secure: false,
        severity: "LOW" as SecuritySeverity,
        confidence: DetectionConfidence.MEDIUM,
        issues: ["Permissions-Policy header is missing"],
        recommendations: [
          "Add Permissions-Policy header",
          "Disable unused browser features",
          "Reduce attack surface by limiting permissions",
        ],
      };
    }

    // Check for overly permissive policies
    if (/\*/.test(permissionsPolicy)) {
      issues.push("Permissions-Policy allows all origins for some features");
      recommendations.push("Specify explicit origins instead of wildcards");
    }

    return {
      header: SecurityHeaderType.PERMISSIONS_POLICY,
      present: true,
      value: permissionsPolicy,
      secure: !issues.length,
      severity: issues.length > 0 ? ("LOW" as SecuritySeverity) : ("NONE" as SecuritySeverity),
      confidence: DetectionConfidence.MEDIUM,
      issues,
      recommendations,
    };
  }

  /**
   * Generate recommended security headers
   */
  generateHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    // CSP
    headers["Content-Security-Policy"] = this.generateCSP();

    // HSTS
    const hstsDirectives = [`max-age=${this.config.hstsMaxAge}`];
    if (this.config.hstsIncludeSubdomains) {
      hstsDirectives.push("includeSubDomains");
    }
    if (this.config.hstsPreload) {
      hstsDirectives.push("preload");
    }
    headers["Strict-Transport-Security"] = hstsDirectives.join("; ");

    // X-Frame-Options
    headers["X-Frame-Options"] = "DENY";

    // X-Content-Type-Options
    headers["X-Content-Type-Options"] = "nosniff";

    // X-XSS-Protection (optional, CSP is better)
    // headers["X-XSS-Protection"] = "1; mode=block";

    // Referrer-Policy
    headers["Referrer-Policy"] = this.config.referrerPolicy;

    // Permissions-Policy
    headers["Permissions-Policy"] =
      "geolocation=(), " +
      "microphone=(), " +
      "camera=(), " +
      "magnetometer=(), " +
      "gyroscope=(), " +
      "speaker=()";

    return headers;
  }

  /**
   * Generate CSP header
   */
  private generateCSP(): string {
    const csp = this.config.cspPolicy;
    const directives: string[] = [];

    if (csp.defaultSrc) {
      directives.push(`default-src ${csp.defaultSrc.join(" ")}`);
    }

    if (csp.scriptSrc) {
      directives.push(`script-src ${csp.scriptSrc.join(" ")}`);
    }

    if (csp.styleSrc) {
      directives.push(`style-src ${csp.styleSrc.join(" ")}`);
    }

    if (csp.imgSrc) {
      directives.push(`img-src ${csp.imgSrc.join(" ")}`);
    }

    if (csp.fontSrc) {
      directives.push(`font-src ${csp.fontSrc.join(" ")}`);
    }

    if (csp.connectSrc) {
      directives.push(`connect-src ${csp.connectSrc.join(" ")}`);
    }

    if (csp.mediaSrc) {
      directives.push(`media-src ${csp.mediaSrc.join(" ")}`);
    }

    if (csp.objectSrc) {
      directives.push(`object-src ${csp.objectSrc.join(" ")}`);
    }

    if (csp.frameSrc) {
      directives.push(`frame-src ${csp.frameSrc.join(" ")}`);
    }

    if (csp.baseUri) {
      directives.push(`base-uri ${csp.baseUri.join(" ")}`);
    }

    if (csp.formAction) {
      directives.push(`form-action ${csp.formAction.join(" ")}`);
    }

    if (csp.frameAncestors) {
      directives.push(`frame-ancestors ${csp.frameAncestors.join(" ")}`);
    }

    if (csp.reportUri) {
      directives.push(`report-uri ${csp.reportUri}`);
    }

    if (csp.reportTo) {
      directives.push(`report-to ${csp.reportTo}`);
    }

    return directives.join("; ");
  }

  /**
   * Generate CORS headers
   */
  generateCORSHeaders(origin: string): Record<string, string> {
    const cors = this.config.corsPolicy;
    const headers: Record<string, string> = {};

    if (cors.origins && cors.origins.includes(origin)) {
      headers["Access-Control-Allow-Origin"] = origin;
    }

    if (cors.methods) {
      headers["Access-Control-Allow-Methods"] = cors.methods.join(", ");
    }

    if (cors.headers) {
      headers["Access-Control-Allow-Headers"] = cors.headers.join(", ");
    }

    if (cors.credentials) {
      headers["Access-Control-Allow-Credentials"] = "true";
    }

    if (cors.maxAge) {
      headers["Access-Control-Max-Age"] = cors.maxAge.toString();
    }

    if (cors.exposedHeaders) {
      headers["Access-Control-Expose-Headers"] = cors.exposedHeaders.join(", ");
    }

    return headers;
  }

  /**
   * Generate summary report
   */
  generateSummary(results: SecurityHeaderResult[]): {
    total: number;
    present: number;
    secure: number;
    insecure: number;
    missing: number;
    bySeverity: Record<string, number>;
  } {
    const summary = {
      total: results.length,
      present: results.filter((r) => r.present).length,
      secure: results.filter((r) => r.secure).length,
      insecure: results.filter((r) => r.present && !r.secure).length,
      missing: results.filter((r) => !r.present).length,
      bySeverity: {} as Record<string, number>,
    };

    results.forEach((result) => {
      summary.bySeverity[result.severity] = (summary.bySeverity[result.severity] || 0) + 1;
    });

    return summary;
  }
}

/**
 * Create security headers generator with default configuration
 */
export function createSecurityHeaders(config?: SecurityHeaderConfig): SecurityHeaders {
  return new SecurityHeaders(config);
}

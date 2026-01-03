/**
import { SecuritySeverity, CodeLocation, DetectionConfidence } from "../types.js";

 * OutputEncoding - Security hardening through output encoding
 *
 * Provides output encoding utilities to prevent XSS and injection:
 * - HTML encoding
 * - HTML attribute encoding
 * - JavaScript encoding
 * - URL encoding
 * - CSS encoding
 * - JSON encoding
 */

/**
 * OutputEncoder - Encodes output for safe rendering
 */
export class OutputEncoder {
  /**
   * Encode for HTML content
   */
  static encodeHTML(input: string): string {
    const htmlEntities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#x27;",
      "/": "&#x2F;",
      "`": "&#x60;",
      "=": "&#x3D;",
    };

    return input.replace(/[&<>"'\/`=]/g, (char) => htmlEntities[char]);
  }

  /**
   * Encode for HTML attribute
   */
  static encodeHTMLAttribute(input: string): string {
    // HTML attributes need additional escaping
    let encoded = this.encodeHTML(input);
    encoded = encoded.replace(/\n/g, "&#x0A;");
    encoded = encoded.replace(/\r/g, "&#x0D;");
    encoded = encoded.replace(/\t/g, "&#x09;");
    return encoded;
  }

  /**
   * Encode for JavaScript context
   */
  static encodeJavaScript(input: string): string {
    // Escape JavaScript special characters
    return input.replace(
      /[\x00-\x1F"'\\]/g,
      (char) =>
        "\\x" +
        char
          .charCodeAt(0)
          .toString(16)
          .padStart(2, "0")
    );
  }

  /**
   * Encode for URL parameter
   */
  static encodeURL(input: string): string {
    return encodeURIComponent(input);
  }

  /**
   * Encode for CSS context
   */
  static encodeCSS(input: string): string {
    // Escape CSS special characters
    return input.replace(/[^a-zA-Z0-9]/g, (char) => `\\${char.charCodeAt(0).toString(16)} `);
  }

  /**
   * Encode JSON value
   */
  static encodeJSON(input: any): string {
    return JSON.stringify(input);
  }

  /**
   * Sanitize HTML (remove tags)
   */
  static sanitizeHTML(input: string): string {
    return input.replace(/<[^>]*>/g, "");
  }

  /**
   * Strip dangerous HTML tags
   */
  static stripDangerousTags(input: string): string {
    const dangerousTags = [
      "script",
      "iframe",
      "object",
      "embed",
      "form",
      "input",
      "button",
      "link",
      "style",
      "meta",
    ];

    let sanitized = input;
    dangerousTags.forEach((tag) => {
      const regex = new RegExp(`<${tag}[^>]*>.*?</${tag}>`, "gis");
      sanitized = sanitized.replace(regex, "");
      const selfClosingRegex = new RegExp(`<${tag}[^>]*\\s*/>`, "gis");
      sanitized = sanitized.replace(selfClosingRegex, "");
    });

    return sanitized;
  }

  /**
   * Strip dangerous HTML attributes
   */
  static stripDangerousAttributes(input: string): string {
    const dangerousAttributes = [
      "on\\w+", // Event handlers
      "javascript:",
      "vbscript:",
      "data:",
      "xlink:href",
    ];

    let sanitized = input;
    dangerousAttributes.forEach((attr) => {
      const regex = new RegExp(`\\s${attr}\\s*=\\s*(["'][^"']*["']|[^\\s>]*)`, "gis");
      sanitized = sanitized.replace(regex, "");
    });

    return sanitized;
  }

  /**
   * Encode based on context
   */
  static encodeForContext(input: string, context: string): string {
    switch (context.toLowerCase()) {
      case "html":
        return this.encodeHTML(input);
      case "htmlattribute":
      case "attribute":
        return this.encodeHTMLAttribute(input);
      case "javascript":
      case "js":
        return this.encodeJavaScript(input);
      case "url":
        return this.encodeURL(input);
      case "css":
        return this.encodeCSS(input);
      case "json":
        return this.encodeJSON(input);
      default:
        return input;
    }
  }

  /**
   * Safe template literal replacement
   */
  static safeTemplate(template: string, values: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = values[key];
      if (value === undefined || value === null) {
        return "";
      }
      return this.encodeHTML(String(value));
    });
  }

  /**
   * Create content security policy nonce
   */
  static generateNonce(): string {
    const crypto = require("crypto");
    return crypto.randomBytes(16).toString("base64");
  }

  /**
   * Validate and sanitize HTML (whitelist approach)
   */
  static sanitizeHTMLWithWhitelist(
    input: string,
    allowedTags: string[] = ["p", "br", "strong", "em", "u", "a"],
    allowedAttributes: Record<string, string[]> = { a: ["href"] }
  ): string {
    // This is a simplified implementation
    // For production, use a library like DOMPurify
    let sanitized = input;

    // Remove all tags except allowed ones
    const allTags = /<(\w+)[^>]*>/gi;
    sanitized = sanitized.replace(allTags, (match, tag) => {
      if (allowedTags.includes(tag.toLowerCase())) {
        return match;
      }
      return "";
    });

    // Remove dangerous attributes from allowed tags
    allowedTags.forEach((tag) => {
      const tagRegex = new RegExp(`<${tag}([^>]*)>`, "gi");
      sanitized = sanitized.replace(tagRegex, (match, attrs) => {
        const allowed = allowedAttributes[tag] || [];
        let sanitizedAttrs = attrs;

        // Remove dangerous attributes
        const dangerous = [
          /on\w+\s*=/gi,
          /javascript:/gi,
          /vbscript:/gi,
          /data:/gi,
        ];
        dangerous.forEach((pattern) => {
          sanitizedAttrs = sanitizedAttrs.replace(pattern, "");
        });

        // Keep only allowed attributes
        if (allowed.length > 0) {
          const attrList = sanitizedAttrs.match(/\w+\s*=\s*["'][^"']*["']/gi) || [];
          const keptAttrs = attrList.filter((attr) => {
            const attrName = attr.match(/^\w+/i)![0];
            return allowed.includes(attrName.toLowerCase());
          });
          return `<${tag}${keptAttrs.join(" ")}>`;
        }

        return `<${tag}${sanitizedAttrs}>`;
      });
    });

    return sanitized;
  }
}

/**
 * Encoding utilities for common use cases
 */
export const EncodingUtils = {
  /**
   * Encode user input for display in HTML
   */
  encodeUserInput: (input: string): string => OutputEncoder.encodeHTML(input),

  /**
   * Encode URL parameter
   */
  encodeURLParam: (input: string): string => OutputEncoder.encodeURL(input),

  /**
   * Encode JSON response
   */
  encodeJSONResponse: (data: any): string => OutputEncoder.encodeJSON(data),

  /**
   * Sanitize user-generated HTML content
   */
  sanitizeUserHTML: (input: string): string =>
    OutputEncoder.stripDangerousTags(OutputEncoder.stripDangerousAttributes(input)),

  /**
   * Create safe HTML attribute
   */
  safeAttribute: (name: string, value: string): string =>
    `${name}="${OutputEncoder.encodeHTMLAttribute(value)}"`,
};

/**
 * Legacy aliases for compatibility
 */
export const HTMLEncoder = {
  encode: OutputEncoder.encodeHTML,
  decode: (input: string): string =>
    input
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, "/"),
};

export const URLEncoder = {
  encode: OutputEncoder.encodeURL,
  decode: decodeURIComponent,
};

export const JSEncoder = {
  encode: OutputEncoder.encodeJavaScript,
  decode: (input: string): string => {
    // Basic decoding for Unicode escape sequences
    return input.replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
  },
};

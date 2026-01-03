/**
 * ComplexityScorer - Analyzes query complexity for routing decisions
 *
 * Uses multiple heuristics to determine query complexity:
 * - Text length
 * - Technical term density
 * - Nested concepts
 * - Code presence
 * - Domain specificity
 */

import type { QueryContext, SystemState } from "../types.js";

export interface ComplexityScore {
  /** Overall complexity (0-1) */
  overall: number;
  /** Text length contribution */
  textLength: number;
  /** Technical term contribution */
  technicalTerms: number;
  /** Code presence contribution */
  codePresence: number;
  /** Domain specificity contribution */
  domainSpecificity: number;
}

/**
 * ComplexityScorer - Analyzes query complexity
 */
export class ComplexityScorer {
  private technicalTerms = [
    "algorithm",
    "api",
    "async",
    "await",
    "authentication",
    "authorization",
    "backend",
    "bandwidth",
    "binary",
    "buffer",
    "cache",
    "class",
    "client",
    "compile",
    "component",
    "concurrent",
    "config",
    "container",
    "crdt",
    "database",
    "debug",
    "deploy",
    "dependency",
    "docker",
    "endpoint",
    "encryption",
    "framework",
    "function",
    "git",
    "graphql",
    "http",
    "interface",
    "json",
    "kubernetes",
    "latency",
    "library",
    "memory",
    "microservice",
    "middleware",
    "module",
    "mutex",
    "network",
    "oauth",
    "object",
    "package",
    "parameter",
    "performance",
    "pipeline",
    "promise",
    "protocol",
    "query",
    "queue",
    "react",
    "redis",
    "request",
    "response",
    "rest",
    "routing",
    "runtime",
    "schema",
    "server",
    "service",
    "session",
    "sql",
    "stream",
    "synchronous",
    "tcp",
    "thread",
    "timeout",
    "token",
    "type",
    "typescript",
    "unit",
    "variable",
    "vector",
    "websocket",
    "xml",
    "yaml",
  ];

  /**
   * Calculate complexity score for a query
   * @param query - The query text
   * @param context - Additional query context
   * @returns ComplexityScore with detailed breakdown
   */
  score(query: string, context?: QueryContext): ComplexityScore {
    const lowerQuery = query.toLowerCase();

    // Text length contribution (0-0.3)
    const wordCount = query.split(/\s+/).length;
    const textLength = Math.min(wordCount / 50, 0.3);

    // Technical term density (0-0.3)
    const termCount = this.technicalTerms.filter(term =>
      lowerQuery.includes(term)
    ).length;
    const technicalTerms = Math.min(termCount / 10, 0.3);

    // Code presence (0-0.2)
    const codePresence = this.detectCode(query) ? 0.2 : 0;

    // Domain specificity (0-0.2)
    const domainSpecificity = this.detectDomainSpecificity(query);

    // Calculate overall
    const overall = Math.min(
      textLength + technicalTerms + codePresence + domainSpecificity,
      1
    );

    return {
      overall,
      textLength,
      technicalTerms,
      codePresence,
      domainSpecificity,
    };
  }

  /**
   * Detect if query contains code
   */
  private detectCode(query: string): boolean {
    // Check for common code patterns
    const codePatterns = [
      /function\s+\w+\s*\(/,
      /const\s+\w+\s*=\s*\(/,
      /=>\s*{/,
      /import\s+.*from/,
      /class\s+\w+/,
      /if\s*\(/,
      /for\s*\(/,
      /while\s*\(/,
      /return\s+/,
      /;\s*$/,
      /\.then\(/,
      /async\s+/,
    ];

    return codePatterns.some(pattern => pattern.test(query));
  }

  /**
   * Detect domain-specific language
   */
  private detectDomainSpecificity(query: string): number {
    const domains = {
      database: /sql|database|table|query|select|insert|update|delete/i,
      security: /encrypt|decrypt|auth|token|certificate|ssl|tls|hash/i,
      devops: /deploy|docker|kubernetes|ci\/cd|pipeline|container|server/i,
      ml: /machine learning|model|training|dataset|neural|feature/i,
      frontend: /component|render|props|state|hook|dom|css|html/i,
      backend: /server|endpoint|middleware|controller|service|api/i,
    };

    let matchCount = 0;
    for (const pattern of Object.values(domains)) {
      if (pattern.test(query)) {
        matchCount++;
      }
    }

    return Math.min(matchCount * 0.1, 0.2);
  }
}

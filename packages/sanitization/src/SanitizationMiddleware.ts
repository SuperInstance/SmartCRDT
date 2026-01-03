/**
 * @lsi/sanitization - Sanitization Middleware Implementation
 *
 * Middleware for automatic input sanitization:
 * - Request body sanitization
 * - Query parameter sanitization
 * - Path parameter sanitization
 * - Header sanitization
 * - Context-aware sanitization based on input source
 * - Configurable security thresholds
 * - Request/response interception
 */

import {
  type SanitizationOptions,
  type SanitizationResult,
  type InputContext,
  InputSource,
  type SecurityThresholds,
  type DetectedThreat,
  ThreatSeverity,
  type ISanitizationMiddleware,
  type SanitizationStatistics,
} from "@lsi/protocol";
import { InputSanitizer } from "./InputSanitizer.js";

// ============================================================================
// THREAT ANALYZER
// ============================================================================

/**
 * Analyze threats and determine if input should be blocked
 */
class ThreatAnalyzer {
  /**
   * Calculate threat score from detected threats
   */
  static calculateScore(threats: DetectedThreat[]): number {
    return threats.reduce((score, threat) => {
      const severityScore = this.getSeverityScore(threat.severity);
      return score + severityScore;
    }, 0);
  }

  /**
   * Get numeric score for severity
   */
  static getSeverityScore(severity: ThreatSeverity): number {
    switch (severity) {
      case ThreatSeverity.CRITICAL:
        return 100;
      case ThreatSeverity.HIGH:
        return 50;
      case ThreatSeverity.MEDIUM:
        return 20;
      case ThreatSeverity.LOW:
        return 5;
      case ThreatSeverity.INFO:
        return 1;
      default:
        return 0;
    }
  }

  /**
   * Check if input should be blocked based on thresholds
   */
  static shouldBlock(
    threats: DetectedThreat[],
    thresholds: SecurityThresholds
  ): { block: boolean; reason?: string } {
    // Block on critical if configured
    if (thresholds.blockOnCritical) {
      const hasCritical = threats.some((t) => t.severity === ThreatSeverity.CRITICAL);
      if (hasCritical) {
        return { block: true, reason: "Critical severity threat detected" };
      }
    }

    // Check threat count
    if (threats.length > thresholds.maxThreatCount) {
      return {
        block: true,
        reason: `Threat count ${threats.length} exceeds threshold ${thresholds.maxThreatCount}`,
      };
    }

    // Check threat score
    const score = this.calculateScore(threats);
    if (score > thresholds.maxThreatScore) {
      return {
        block: true,
        reason: `Threat score ${score} exceeds threshold ${thresholds.maxThreatScore}`,
      };
    }

    // Check if any threat exceeds max allowed severity
    const maxSeverity = this.getMaxSeverity(threats);
    const severityOrder = [
      ThreatSeverity.INFO,
      ThreatSeverity.LOW,
      ThreatSeverity.MEDIUM,
      ThreatSeverity.HIGH,
      ThreatSeverity.CRITICAL,
    ];
    const maxAllowedIndex = severityOrder.indexOf(thresholds.maxAllowedSeverity);
    const actualIndex = severityOrder.indexOf(maxSeverity);

    if (actualIndex > maxAllowedIndex) {
      return {
        block: true,
        reason: `Threat severity ${maxSeverity} exceeds allowed ${thresholds.maxAllowedSeverity}`,
      };
    }

    return { block: false };
  }

  /**
   * Get maximum severity from threats
   */
  static getMaxSeverity(threats: DetectedThreat[]): ThreatSeverity {
    if (threats.length === 0) {
      return ThreatSeverity.INFO;
    }

    const severityOrder = [
      ThreatSeverity.INFO,
      ThreatSeverity.LOW,
      ThreatSeverity.MEDIUM,
      ThreatSeverity.HIGH,
      ThreatSeverity.CRITICAL,
    ];

    let maxIndex = 0;
    for (const threat of threats) {
      const index = severityOrder.indexOf(threat.severity);
      if (index > maxIndex) {
        maxIndex = index;
      }
    }

    return severityOrder[maxIndex];
  }
}

// ============================================================================
// SANITIZATION MIDDLEWARE
// ============================================================================

export class SanitizationMiddleware implements ISanitizationMiddleware {
  private sanitizer: InputSanitizer;
  private options: SanitizationOptions;
  private thresholds: SecurityThresholds;
  private onThreatDetected?: (threat: DetectedThreat, context: InputContext) => void;
  private onBlocked?: (reason: string, context: InputContext) => void;

  constructor(
    options?: Partial<SanitizationOptions>,
    thresholds?: Partial<SecurityThresholds>
  ) {
    this.sanitizer = new InputSanitizer();

    this.options = {
      checkFor: [
        "SQL_INJECTION" as never,
        "XSS" as never,
        "COMMAND_INJECTION" as never,
      ],
      methods: [
        "HTML_ENCODE" as never,
        "NULL_BYTE_STRIP" as never,
      ],
      preserveUnicode: true,
      preserveWhitespace: false,
      encoding: "utf8",
      throwOnError: false,
      ...options,
    };

    this.thresholds = {
      maxAllowedSeverity: ThreatSeverity.MEDIUM,
      maxThreatCount: 5,
      maxThreatScore: 50,
      blockOnCritical: true,
      logAllThreats: true,
      quarantineSuspicious: false,
      ...thresholds,
    };
  }

  /**
   * Middleware function for request/response processing
   */
  async handle(
    input: unknown,
    context: InputContext,
    next: () => Promise<unknown>
  ): Promise<unknown> {
    // Sanitize input based on type
    const sanitized = this.sanitizeInput(input, context);

    // Check if should be blocked
    if (sanitized.threats.length > 0) {
      const blockDecision = ThreatAnalyzer.shouldBlock(sanitized.threats, this.thresholds);

      if (blockDecision.block) {
        // Notify blocked callback
        if (this.onBlocked) {
          this.onBlocked(blockDecision.reason || "Threat detected", context);
        }

        throw new Error(
          `Request blocked: ${blockDecision.reason || "Security threat detected"}`
        );
      }

      // Notify threat detected callbacks
      if (this.onThreatDetected) {
        for (const threat of sanitized.threats) {
          this.onThreatDetected(threat, context);
        }
      }
    }

    // Continue to next middleware/handler
    return next();
  }

  /**
   * Configure the middleware
   */
  configure(options: Partial<SanitizationOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Set security thresholds
   */
  setThresholds(thresholds: Partial<SecurityThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Set threat detected callback
   */
  onThreat(callback: (threat: DetectedThreat, context: InputContext) => void): void {
    this.onThreatDetected = callback;
  }

  /**
   * Set blocked callback
   */
  onBlock(callback: (reason: string, context: InputContext) => void): void {
    this.onBlocked = callback;
  }

  /**
   * Get sanitization statistics
   */
  getStatistics(): SanitizationStatistics {
    return this.sanitizer.getStatistics();
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    this.sanitizer.resetStatistics();
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Sanitize input based on type
   */
  private sanitizeInput(input: unknown, context: InputContext): SanitizationResult {
    // Get contextual options
    const contextualOptions = this.getContextualOptions(context.source);

    // Handle different input types
    if (typeof input === "string") {
      return this.sanitizer.sanitizeWithContext(input, context, {
        ...this.options,
        ...contextualOptions,
      });
    }

    if (typeof input === "object" && input !== null) {
      // Sanitize object properties recursively
      return this.sanitizeObject(input as Record<string, unknown>, context);
    }

    if (Array.isArray(input)) {
      // Sanitize array items
      return this.sanitizeArray(input, context);
    }

    // Return empty result for unsupported types
    return {
      sanitized: String(input),
      wasModified: false,
      threats: [],
      methodsApplied: [],
    };
  }

  /**
   * Sanitize object properties
   */
  private sanitizeObject(
    obj: Record<string, unknown>,
    context: InputContext
  ): SanitizationResult {
    const allThreats: DetectedThreat[] = [];
    const allMethods: string[] = [];
    let wasModified = false;

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        const result = this.sanitizer.sanitizeWithContext(value, context, this.options);
        allThreats.push(...result.threats);
        allMethods.push(...result.methodsApplied);

        if (result.wasModified) {
          obj[key] = result.sanitized;
          wasModified = true;
        }
      } else if (typeof value === "object" && value !== null) {
        const result = this.sanitizeObject(value as Record<string, unknown>, context);
        allThreats.push(...result.threats);
        allMethods.push(...result.methodsApplied);
        if (result.wasModified) {
          wasModified = true;
        }
      }
    }

    return {
      sanitized: JSON.stringify(obj),
      wasModified,
      threats: allThreats,
      methodsApplied: allMethods as never[],
    };
  }

  /**
   * Sanitize array items
   */
  private sanitizeArray(arr: unknown[], context: InputContext): SanitizationResult {
    const allThreats: DetectedThreat[] = [];
    const allMethods: string[] = [];
    let wasModified = false;

    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];

      if (typeof item === "string") {
        const result = this.sanitizer.sanitizeWithContext(item, context, this.options);
        allThreats.push(...result.threats);
        allMethods.push(...result.methodsApplied);

        if (result.wasModified) {
          arr[i] = result.sanitized;
          wasModified = true;
        }
      } else if (typeof item === "object" && item !== null) {
        const result = this.sanitizeObject(item as Record<string, unknown>, context);
        allThreats.push(...result.threats);
        allMethods.push(...result.methodsApplied);
        if (result.wasModified) {
          wasModified = true;
        }
      }
    }

    return {
      sanitized: JSON.stringify(arr),
      wasModified,
      threats: allThreats,
      methodsApplied: allMethods as never[],
    };
  }

  /**
   * Get contextual options for input source
   */
  private getContextualOptions(source: string): Partial<SanitizationOptions> {
    const sourceLower = source.toLowerCase();

    if (sourceLower.includes("web") || sourceLower.includes("form")) {
      return {
        checkFor: [
          "XSS" as never,
          "SQL_INJECTION" as never,
          "HEADER_INJECTION" as never,
        ],
        methods: [
          "HTML_ENCODE" as never,
          "CONTROL_CHAR_STRIP" as never,
        ],
      };
    }

    if (sourceLower.includes("api")) {
      return {
        checkFor: [
          "SQL_INJECTION" as never,
          "NOSQL_INJECTION" as never,
          "COMMAND_INJECTION" as never,
        ],
        methods: [
          "NULL_BYTE_STRIP" as never,
        ],
      };
    }

    if (sourceLower.includes("cli") || sourceLower.includes("command")) {
      return {
        checkFor: [
          "COMMAND_INJECTION" as never,
        ],
        methods: [
          "COMMAND_ESCAPE" as never,
        ],
      };
    }

    if (sourceLower.includes("file") || sourceLower.includes("path")) {
      return {
        checkFor: [
          "PATH_TRAVERSAL" as never,
        ],
        methods: [
          "PATH_NORMALIZE" as never,
        ],
      };
    }

    return {};
  }
}

// ============================================================================
// EXPRESS/HTTP MIDDLEWARE FACTORIES
// ============================================================================

/**
 * Create Express middleware for request body sanitization
 */
export function createBodySanitizerMiddleware(
  options?: Partial<SanitizationOptions>,
  thresholds?: Partial<SecurityThresholds>
) {
  const middleware = new SanitizationMiddleware(options, thresholds);

  return async (req: unknown, res: unknown, next: () => void) => {
    const context: InputContext = {
      source: InputSource.API_BODY,
      timestamp: new Date(),
      // @ts-expect-error - Express request types
      ipAddress: req?.ip,
      // @ts-expect-error - Express request types
      userAgent: req?.get?.("user-agent"),
    };

    try {
      // @ts-expect-error - Express request types
      await middleware.handle(req?.body, context, async () => {
        next();
      });
    } catch (error) {
      // @ts-expect-error - Express response types
      res?.status(400).json({
        error: "Invalid input",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

/**
 * Create Express middleware for query parameter sanitization
 */
export function createQuerySanitizerMiddleware(
  options?: Partial<SanitizationOptions>,
  thresholds?: Partial<SecurityThresholds>
) {
  const middleware = new SanitizationMiddleware(options, thresholds);

  return async (req: unknown, res: unknown, next: () => void) => {
    const context: InputContext = {
      source: InputSource.API_QUERY,
      timestamp: new Date(),
      // @ts-expect-error - Express request types
      ipAddress: req?.ip,
      // @ts-expect-error - Express request types
      userAgent: req?.get?.("user-agent"),
    };

    try {
      // @ts-expect-error - Express request types
      await middleware.handle(req?.query, context, async () => {
        next();
      });
    } catch (error) {
      // @ts-expect-error - Express response types
      res?.status(400).json({
        error: "Invalid input",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

/**
 * Create Express middleware for path parameter sanitization
 */
export function createParamSanitizerMiddleware(
  options?: Partial<SanitizationOptions>,
  thresholds?: Partial<SecurityThresholds>
) {
  const middleware = new SanitizationMiddleware(options, thresholds);

  return async (req: unknown, res: unknown, next: () => void) => {
    const context: InputContext = {
      source: InputSource.API_PATH,
      timestamp: new Date(),
      // @ts-expect-error - Express request types
      ipAddress: req?.ip,
      // @ts-expect-error - Express request types
      userAgent: req?.get?.("user-agent"),
    };

    try {
      // @ts-expect-error - Express request types
      await middleware.handle(req?.params, context, async () => {
        next();
      });
    } catch (error) {
      // @ts-expect-error - Express response types
      res?.status(400).json({
        error: "Invalid input",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

/**
 * Create Express middleware for header sanitization
 */
export function createHeaderSanitizerMiddleware(
  options?: Partial<SanitizationOptions>,
  thresholds?: Partial<SecurityThresholds>
) {
  const middleware = new SanitizationMiddleware(options, thresholds);

  return async (req: unknown, res: unknown, next: () => void) => {
    const context: InputContext = {
      source: InputSource.API_HEADER,
      timestamp: new Date(),
      // @ts-expect-error - Express request types
      ipAddress: req?.ip,
      // @ts-expect-error - Express request types
      userAgent: req?.get?.("user-agent"),
    };

    try {
      // @ts-expect-error - Express request types
      await middleware.handle(req?.headers, context, async () => {
        next();
      });
    } catch (error) {
      // @ts-expect-error - Express response types
      res?.status(400).json({
        error: "Invalid input",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

/**
 * Create combined Express middleware (body, query, params, headers)
 */
export function createSanitizationMiddleware(
  options?: Partial<SanitizationOptions>,
  thresholds?: Partial<SecurityThresholds>
) {
  const bodyMiddleware = createBodySanitizerMiddleware(options, thresholds);
  const queryMiddleware = createQuerySanitizerMiddleware(options, thresholds);
  const paramMiddleware = createParamSanitizerMiddleware(options, thresholds);
  const headerMiddleware = createHeaderSanitizerMiddleware(options, thresholds);

  return async (req: unknown, res: unknown, next: () => void) => {
    // Apply all sanitization middleware in sequence
    await bodyMiddleware(req, res, () => {});
    await queryMiddleware(req, res, () => {});
    await paramMiddleware(req, res, () => {});
    await headerMiddleware(req, res, () => {});
    next();
  };
}

// ============================================================================
// CLI MIDDLEWARE
// ============================================================================

/**
 * Sanitize CLI arguments
 */
export function sanitizeCliArgs(args: string[]): string[] {
  const sanitizer = new InputSanitizer();
  const context: InputContext = {
    source: InputSource.CLI_ARG,
    timestamp: new Date(),
  };

  return args.map((arg) => {
    const result = sanitizer.sanitizeWithContext(arg, context, {
      checkFor: ["COMMAND_INJECTION" as never],
      methods: ["COMMAND_ESCAPE" as never],
    });
    return result.sanitized;
  });
}

/**
 * Sanitize environment variables
 */
export function sanitizeEnvVars(env: Record<string, string>): Record<string, string> {
  const sanitizer = new InputSanitizer();
  const context: InputContext = {
    source: InputSource.ENV_VAR,
    timestamp: new Date(),
  };

  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    const result = sanitizer.sanitizeWithContext(value, context, {
      checkFor: ["COMMAND_INJECTION" as never],
      methods: ["COMMAND_ESCAPE" as never],
    });
    sanitized[key] = result.sanitized;
  }

  return sanitized;
}

// ============================================================================
// EXPORTS
// ============================================================================

export { ThreatAnalyzer };

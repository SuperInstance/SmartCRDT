/**
 * Middleware system for SSE Server
 *
 * Provides authentication, rate limiting, logging, compression middleware
 */

import type {
  MiddlewareContext,
  MiddlewareFunction,
  SSEMiddleware,
  MiddlewareConfig,
} from "../types.js";
import { SSEError, SSEErrorCode, SSEError as SSEErrorClass } from "../types.js";

// Re-export for convenience
export { SSEError, SSEErrorCode } from "../types.js";

/**
 * Base middleware class
 */
export abstract class BaseMiddleware implements SSEMiddleware {
  abstract name: string;
  priority: number = 100;
  abstract execute(
    ctx: MiddlewareContext,
    next: () => Promise<void>
  ): Promise<void> | void;
}

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

export interface AuthMiddlewareOptions {
  /** Validate token function */
  validateToken: (token: string) => Promise<boolean> | boolean;
  /** Extract token from request */
  extractToken: (req: MiddlewareContext["req"]) => string | null;
  /** On auth failed */
  onAuthFailed?: (ctx: MiddlewareContext) => void;
}

/**
 * Authentication middleware
 */
export class AuthMiddleware extends BaseMiddleware {
  name = "auth";
  priority = 10;

  constructor(private options: AuthMiddlewareOptions) {
    super();
  }

  async execute(
    ctx: MiddlewareContext,
    next: () => Promise<void>
  ): Promise<void> {
    const token = this.options.extractToken(ctx.req);

    if (!token) {
      if (this.options.onAuthFailed) {
        this.options.onAuthFailed(ctx);
      }
      throw new SSEError(
        SSEErrorCode.AUTH_FAILED,
        "Authentication required: no token provided"
      );
    }

    const valid = await this.options.validateToken(token);
    if (!valid) {
      if (this.options.onAuthFailed) {
        this.options.onAuthFailed(ctx);
      }
      throw new SSEError(
        SSEErrorCode.AUTH_FAILED,
        "Authentication failed: invalid token"
      );
    }

    // Store auth result in metadata
    ctx.metadata.set("authenticated", true);
    ctx.metadata.set("token", token);

    await next();
  }
}

// ============================================================================
// RATE LIMITING MIDDLEWARE
// ============================================================================

export interface RateLimitData {
  count: number;
  reset_time: number;
}

export interface RateLimitMiddlewareOptions {
  /** Max requests per window */
  max_requests: number;
  /** Window duration in milliseconds */
  window_duration: number;
  /** Rate limit storage (for distributed systems) */
  storage?: Map<string, RateLimitData>;
  /** Extract client identifier */
  getClientId: (req: MiddlewareContext["req"]) => string;
  /** On rate limit exceeded */
  onRateLimitExceeded?: (ctx: MiddlewareContext) => void;
}

/**
 * Rate limiting middleware
 */
export class RateLimitMiddleware extends BaseMiddleware {
  name = "rate-limit";
  priority = 20;

  private storage: Map<string, RateLimitData>;

  constructor(private options: RateLimitMiddlewareOptions) {
    super();
    this.storage = options.storage || new Map();
  }

  async execute(
    ctx: MiddlewareContext,
    next: () => Promise<void>
  ): Promise<void> {
    const clientId = this.options.getClientId(ctx.req);
    const now = Date.now();

    // Get or create rate limit data
    let data = this.storage.get(clientId);

    if (!data || now > data.reset_time) {
      // Reset window
      data = {
        count: 0,
        reset_time: now + this.options.window_duration,
      };
      this.storage.set(clientId, data);
    }

    // Check limit
    if (data.count >= this.options.max_requests) {
      if (this.options.onRateLimitExceeded) {
        this.options.onRateLimitExceeded(ctx);
      }
      throw new SSEError(
        SSEErrorCode.RATE_LIMIT_EXCEEDED,
        "Rate limit exceeded",
        {
          limit: this.options.max_requests,
          window: this.options.window_duration,
          reset_time: data.reset_time,
        }
      );
    }

    // Increment counter
    data.count++;
    this.storage.set(clientId, data);

    // Store rate limit info in metadata
    ctx.metadata.set("rateLimit", {
      remaining: this.options.max_requests - data.count,
      reset_time: data.reset_time,
    });

    await next();
  }

  /**
   * Clear rate limit data for client
   */
  clearClientLimit(clientId: string): void {
    this.storage.delete(clientId);
  }

  /**
   * Get rate limit data for client
   */
  getClientLimit(clientId: string): RateLimitData | undefined {
    return this.storage.get(clientId);
  }

  /**
   * Clear all rate limit data
   */
  clearAllLimits(): void {
    this.storage.clear();
  }
}

// ============================================================================
// LOGGING MIDDLEWARE
// ============================================================================

export interface LogLevel {
  level: "debug" | "info" | "warn" | "error";
  timestamp: number;
  message: string;
  data?: Record<string, unknown>;
}

export interface LoggingMiddlewareOptions {
  /** Log level */
  level: "debug" | "info" | "warn" | "error" | "none";
  /** Custom logger function */
  logger?: (log: LogLevel) => void;
  /** Include request details */
  include_request?: boolean;
  /** Include response details */
  include_response?: boolean;
}

/**
 * Logging middleware
 */
export class LoggingMiddleware extends BaseMiddleware {
  name = "logging";
  priority = 100; // Run last

  private logs: LogLevel[] = [];

  constructor(private options: LoggingMiddlewareOptions = {}) {
    super();
    this.options = {
      level: options.level || "info",
      include_request: options.include_request !== false,
      include_response: options.include_request !== false,
    };
  }

  async execute(
    ctx: MiddlewareContext,
    next: () => Promise<void>
  ): Promise<void> {
    const startTime = Date.now();

    // Log request
    if (this.options.level !== "none") {
      this.log({
        level: "info",
        timestamp: startTime,
        message: `SSE connection: ${ctx.clientId}`,
        data: this.options.include_request
          ? {
              method: ctx.req.method,
              url: ctx.req.url,
              channel: ctx.channel,
            }
          : undefined,
      });
    }

    try {
      await next();

      // Log success
      const duration = Date.now() - startTime;
      if (this.options.level !== "none") {
        this.log({
          level: "info",
          timestamp: Date.now(),
          message: `SSE connection established: ${ctx.clientId}`,
          data: {
            duration_ms: duration,
          },
        });
      }
    } catch (error) {
      // Log error
      if (this.options.level !== "none") {
        this.log({
          level: "error",
          timestamp: Date.now(),
          message: `SSE connection error: ${ctx.clientId}`,
          data: {
            error: error instanceof Error ? error.message : String(error),
            duration_ms: Date.now() - startTime,
          },
        });
      }
      throw error;
    }
  }

  /**
   * Log message
   */
  private log(log: LogLevel): void {
    if (this.shouldLog(log.level)) {
      if (this.options.logger) {
        this.options.logger(log);
      } else {
        // Default logger
        console.log(`[${log.level.toUpperCase()}] ${log.message}`);
        if (log.data) {
          console.log(JSON.stringify(log.data, null, 2));
        }
      }
      this.logs.push(log);
    }
  }

  /**
   * Check if should log based on level
   */
  private shouldLog(level: string): boolean {
    const levels = ["debug", "info", "warn", "error", "none"];
    const currentLevelIndex = levels.indexOf(this.options.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * Get all logs
   */
  getLogs(): LogLevel[] {
    return [...this.logs];
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
  }
}

// ============================================================================
// COMPRESSION MIDDLEWARE
// ============================================================================

export interface CompressionMiddlewareOptions {
  /** Minimum size to compress (bytes) */
  threshold: number;
  /** Compression level (0-9) */
  level: number;
  /** Enable compression */
  enabled: boolean;
}

/**
 * Compression middleware
 */
export class CompressionMiddleware extends BaseMiddleware {
  name = "compression";
  priority = 50;

  constructor(private options: CompressionMiddlewareOptions = {}) {
    super();
    this.options = {
      threshold: options.threshold || 1024,
      level: options.level || 6,
      enabled: options.enabled !== false,
    };
  }

  async execute(
    ctx: MiddlewareContext,
    next: () => Promise<void>
  ): Promise<void> {
    // Store compression info in metadata
    ctx.metadata.set("compression", {
      enabled: this.options.enabled,
      threshold: this.options.threshold,
      level: this.options.level,
    });

    await next();
  }
}

// ============================================================================
// CORS MIDDLEWARE
// ============================================================================

export interface CORSMiddlewareOptions {
  /** Allowed origins */
  origin: string | string[] | ((origin: string) => boolean);
  /** Allowed methods */
  methods: string[];
  /** Allowed headers */
  headers: string[];
  /** Credentials */
  credentials: boolean;
  /** Max age */
  max_age: number;
}

/**
 * CORS middleware
 */
export class CORSMiddleware extends BaseMiddleware {
  name = "cors";
  priority = 5; // Run very early

  constructor(private options: CORSMiddlewareOptions = {}) {
    super();
    this.options = {
      origin: options.origin || "*",
      methods: options.methods || ["GET", "OPTIONS"],
      headers: options.headers || ["Content-Type", "Last-Event-ID"],
      credentials: options.credentials || false,
      max_age: options.max_age || 86400,
    };
  }

  async execute(
    ctx: MiddlewareContext,
    next: () => Promise<void>
  ): Promise<void> {
    const origin = ctx.req.headers["origin"] || "";

    // Check origin
    let allowedOrigin = "*";
    if (typeof this.options.origin === "string") {
      allowedOrigin = this.options.origin;
    } else if (Array.isArray(this.options.origin)) {
      if (this.options.origin.includes(origin)) {
        allowedOrigin = origin;
      }
    } else if (typeof this.options.origin === "function") {
      if (this.options.origin(origin)) {
        allowedOrigin = origin;
      }
    }

    // Store CORS info in metadata
    ctx.metadata.set("cors", {
      origin: allowedOrigin,
      methods: this.options.methods.join(", "),
      headers: this.options.headers.join(", "),
      credentials: this.options.credentials,
      max_age: this.options.max_age,
    });

    await next();
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create authentication middleware with Bearer token
 */
export function createBearerAuthMiddleware(
  validateToken: (token: string) => Promise<boolean> | boolean
): AuthMiddleware {
  return new AuthMiddleware({
    validateToken,
    extractToken: req => {
      const authHeader = req.headers["authorization"];
      if (authHeader?.startsWith("Bearer ")) {
        return authHeader.substring(7);
      }
      return null;
    },
  });
}

/**
 * Create rate limiting middleware by IP
 */
export function createIPRateLimitMiddleware(
  maxRequests: number,
  windowDuration: number
): RateLimitMiddleware {
  return new RateLimitMiddleware({
    max_requests: maxRequests,
    window_duration: windowDuration,
    getClientId: req => {
      return (
        req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "unknown"
      );
    },
  });
}

/**
 * Create logging middleware
 */
export function createLoggingMiddleware(
  level: "debug" | "info" | "warn" | "error" | "none" = "info"
): LoggingMiddleware {
  return new LoggingMiddleware({ level });
}

/**
 * Create CORS middleware
 */
export function createCORSMiddleware(
  origin: string | string[] = "*"
): CORSMiddleware {
  return new CORSMiddleware({ origin });
}

// Export all middleware
export const middleware = {
  Auth: AuthMiddleware,
  RateLimit: RateLimitMiddleware,
  Logging: LoggingMiddleware,
  Compression: CompressionMiddleware,
  CORS: CORSMiddleware,
};

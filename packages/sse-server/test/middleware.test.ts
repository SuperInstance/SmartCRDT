/**
 * Tests for Middleware system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AuthMiddleware,
  RateLimitMiddleware,
  LoggingMiddleware,
  CompressionMiddleware,
  CORSMiddleware,
  createBearerAuthMiddleware,
  createIPRateLimitMiddleware,
  createLoggingMiddleware,
  createCORSMiddleware,
  middleware,
} from '../src/middleware/index.js';
import type { MiddlewareContext } from '../src/types.js';
import { SSEErrorCode, SSEError } from '../src/types.js';

describe('AuthMiddleware', () => {
  let auth: AuthMiddleware;

  beforeEach(() => {
    auth = new AuthMiddleware({
      validateToken: async (token: string) => token === 'valid_token',
      extractToken: (req) => req.headers['authorization']?.substring(7) || null,
    });
  });

  it('should have name and priority', () => {
    expect(auth.name).toBe('auth');
    expect(auth.priority).toBe(10);
  });

  it('should pass with valid token', async () => {
    const ctx: MiddlewareContext = {
      req: {
        method: 'GET',
        url: '/events',
        headers: { authorization: 'Bearer valid_token' },
        query: {},
      },
      res: {
        write: () => true,
        end: () => {},
        isWritable: () => true,
        setTimeout: () => {},
        onError: () => {},
        onClose: () => {},
      },
      clientId: 'test',
      channel: 'test',
      metadata: new Map(),
    };

    const next = vi.fn().mockResolvedValue(undefined);

    await auth.execute(ctx, next);

    expect(ctx.metadata.get('authenticated')).toBe(true);
    expect(ctx.metadata.get('token')).toBe('valid_token');
    expect(next).toHaveBeenCalled();
  });

  it('should fail with invalid token', async () => {
    const ctx: MiddlewareContext = {
      req: {
        method: 'GET',
        url: '/events',
        headers: { authorization: 'Bearer invalid_token' },
        query: {},
      },
      res: {
        write: () => true,
        end: () => {},
        isWritable: () => true,
        setTimeout: () => {},
        onError: () => {},
        onClose: () => {},
      },
      clientId: 'test',
      channel: 'test',
      metadata: new Map(),
    };

    const next = vi.fn().mockResolvedValue(undefined);

    await expect(auth.execute(ctx, next)).rejects.toThrow();
    expect(next).not.toHaveBeenCalled();
  });

  it('should fail with no token', async () => {
    const ctx: MiddlewareContext = {
      req: {
        method: 'GET',
        url: '/events',
        headers: {},
        query: {},
      },
      res: {
        write: () => true,
        end: () => {},
        isWritable: () => true,
        setTimeout: () => {},
        onError: () => {},
        onClose: () => {},
      },
      clientId: 'test',
      channel: 'test',
      metadata: new Map(),
    };

    const next = vi.fn().mockResolvedValue(undefined);

    await expect(auth.execute(ctx, next)).rejects.toThrow();
  });

  it('should call onAuthFailed callback', async () => {
    const onFailed = vi.fn();

    const authWithCallback = new AuthMiddleware({
      validateToken: async () => false,
      extractToken: () => 'token',
      onAuthFailed: onFailed,
    });

    const ctx: MiddlewareContext = {
      req: {
        method: 'GET',
        url: '/events',
        headers: {},
        query: {},
      },
      res: {
        write: () => true,
        end: () => {},
        isWritable: () => true,
        setTimeout: () => {},
        onError: () => {},
        onClose: () => {},
      },
      clientId: 'test',
      channel: 'test',
      metadata: new Map(),
    };

    const next = vi.fn().mockResolvedValue(undefined);

    await expect(authWithCallback.execute(ctx, next)).rejects.toThrow();
    expect(onFailed).toHaveBeenCalledWith(ctx);
  });
});

describe('RateLimitMiddleware', () => {
  let rateLimit: RateLimitMiddleware;

  beforeEach(() => {
    rateLimit = new RateLimitMiddleware({
      max_requests: 5,
      window_duration: 1000,
      getClientId: (req) => req.headers['x-forwarded-for'] || 'unknown',
    });
  });

  it('should have name and priority', () => {
    expect(rateLimit.name).toBe('rate-limit');
    expect(rateLimit.priority).toBe(20);
  });

  it('should allow requests within limit', async () => {
    const ctx: MiddlewareContext = {
      req: {
        method: 'GET',
        url: '/events',
        headers: { 'x-forwarded-for': '192.168.1.1' },
        query: {},
      },
      res: {
        write: () => true,
        end: () => {},
        isWritable: () => true,
        setTimeout: () => {},
        onError: () => {},
        onClose: () => {},
      },
      clientId: 'test',
      channel: 'test',
      metadata: new Map(),
    };

    const next = vi.fn().mockResolvedValue(undefined);

    // Make 5 requests (at limit)
    for (let i = 0; i < 5; i++) {
      await rateLimit.execute(ctx, next);
    }

    expect(next).toHaveBeenCalledTimes(5);
  });

  it('should block requests over limit', async () => {
    const ctx: MiddlewareContext = {
      req: {
        method: 'GET',
        url: '/events',
        headers: { 'x-forwarded-for': '192.168.1.1' },
        query: {},
      },
      res: {
        write: () => true,
        end: () => {},
        isWritable: () => true,
        setTimeout: () => {},
        onError: () => {},
        onClose: () => {},
      },
      clientId: 'test',
      channel: 'test',
      metadata: new Map(),
    };

    const next = vi.fn().mockResolvedValue(undefined);

    // Make 6 requests (over limit)
    for (let i = 0; i < 6; i++) {
      if (i < 5) {
        await rateLimit.execute(ctx, next);
      } else {
        await expect(rateLimit.execute(ctx, next)).rejects.toThrow();
      }
    }

    expect(next).toHaveBeenCalledTimes(5);
  });

  it('should reset window after duration', async () => {
    const shortWindowLimit = new RateLimitMiddleware({
      max_requests: 2,
      window_duration: 100,
      getClientId: (req) => req.headers['x-forwarded-for'] || 'unknown',
    });

    const ctx: MiddlewareContext = {
      req: {
        method: 'GET',
        url: '/events',
        headers: { 'x-forwarded-for': '192.168.1.1' },
        query: {},
      },
      res: {
        write: () => true,
        end: () => {},
        isWritable: () => true,
        setTimeout: () => {},
        onError: () => {},
        onClose: () => {},
      },
      clientId: 'test',
      channel: 'test',
      metadata: new Map(),
    };

    const next = vi.fn().mockResolvedValue(undefined);

    // Use up limit
    await shortWindowLimit.execute(ctx, next);
    await shortWindowLimit.execute(ctx, next);

    // Wait for window to reset
    await new Promise(resolve => setTimeout(resolve, 150));

    // Should be allowed again
    await shortWindowLimit.execute(ctx, next);

    expect(next).toHaveBeenCalledTimes(3);
  });

  it('should track different clients separately', async () => {
    const ctx1: MiddlewareContext = {
      req: {
        method: 'GET',
        url: '/events',
        headers: { 'x-forwarded-for': '192.168.1.1' },
        query: {},
      },
      res: {
        write: () => true,
        end: () => {},
        isWritable: () => true,
        setTimeout: () => {},
        onError: () => {},
        onClose: () => {},
      },
      clientId: 'test',
      channel: 'test',
      metadata: new Map(),
    };

    const ctx2: MiddlewareContext = {
      req: {
        method: 'GET',
        url: '/events',
        headers: { 'x-forwarded-for': '192.168.1.2' },
        query: {},
      },
      res: {
        write: () => true,
        end: () => {},
        isWritable: () => true,
        setTimeout: () => {},
        onError: () => {},
        onClose: () => {},
      },
      clientId: 'test',
      channel: 'test',
      metadata: new Map(),
    };

    const next = vi.fn().mockResolvedValue(undefined);

    // Use up limit for client 1
    for (let i = 0; i < 5; i++) {
      await rateLimit.execute(ctx1, next);
    }

    // Client 2 should still be allowed
    await rateLimit.execute(ctx2, next);

    expect(next).toHaveBeenCalledTimes(6);
  });

  it('should clear client limit', () => {
    rateLimit.clearClientLimit('192.168.1.1');
    const data = rateLimit.getClientLimit('192.168.1.1');
    expect(data).toBeUndefined();
  });

  it('should clear all limits', () => {
    rateLimit.clearAllLimits();
    // Should not throw
    expect(() => rateLimit.clearAllLimits()).not.toThrow();
  });
});

describe('LoggingMiddleware', () => {
  let logging: LoggingMiddleware;

  beforeEach(() => {
    logging = new LoggingMiddleware({
      level: 'info',
    });
  });

  it('should have name and priority', () => {
    expect(logging.name).toBe('logging');
    expect(logging.priority).toBe(100);
  });

  it('should log requests', async () => {
    const ctx: MiddlewareContext = {
      req: {
        method: 'GET',
        url: '/events',
        headers: {},
        query: { channel: 'test' },
      },
      res: {
        write: () => true,
        end: () => {},
        isWritable: () => true,
        setTimeout: () => {},
        onError: () => {},
        onClose: () => {},
      },
      clientId: 'client_1',
      channel: 'test',
      metadata: new Map(),
    };

    const next = vi.fn().mockResolvedValue(undefined);

    await logging.execute(ctx, next);

    const logs = logging.getLogs();
    expect(logs.length).toBeGreaterThan(0);
  });

  it('should log errors', async () => {
    const ctx: MiddlewareContext = {
      req: {
        method: 'GET',
        url: '/events',
        headers: {},
        query: {},
      },
      res: {
        write: () => true,
        end: () => {},
        isWritable: () => true,
        setTimeout: () => {},
        onError: () => {},
        onClose: () => {},
      },
      clientId: 'test',
      channel: 'test',
      metadata: new Map(),
    };

    const next = vi.fn().mockRejectedValue(new Error('Test error'));

    await expect(logging.execute(ctx, next)).rejects.toThrow();

    const logs = logging.getLogs();
    const errorLog = logs.find(l => l.level === 'error');
    expect(errorLog).toBeDefined();
  });

  it('should respect log level', async () => {
    const debugLogging = new LoggingMiddleware({
      level: 'error',
    });

    const ctx: MiddlewareContext = {
      req: {
        method: 'GET',
        url: '/events',
        headers: {},
        query: {},
      },
      res: {
        write: () => true,
        end: () => {},
        isWritable: () => true,
        setTimeout: () => {},
        onError: () => {},
        onClose: () => {},
      },
      clientId: 'test',
      channel: 'test',
      metadata: new Map(),
    };

    const next = vi.fn().mockResolvedValue(undefined);

    await debugLogging.execute(ctx, next);

    const logs = debugLogging.getLogs();
    expect(logs).toHaveLength(0);
  });

  it('should clear logs', () => {
    logging.getLogs(); // Create some logs
    logging.clearLogs();
    expect(logging.getLogs()).toEqual([]);
  });
});

describe('CompressionMiddleware', () => {
  let compression: CompressionMiddleware;

  beforeEach(() => {
    compression = new CompressionMiddleware({
      enabled: true,
      threshold: 1024,
      level: 6,
    });
  });

  it('should have name and priority', () => {
    expect(compression.name).toBe('compression');
    expect(compression.priority).toBe(50);
  });

  it('should store compression info in metadata', async () => {
    const ctx: MiddlewareContext = {
      req: {
        method: 'GET',
        url: '/events',
        headers: {},
        query: {},
      },
      res: {
        write: () => true,
        end: () => {},
        isWritable: () => true,
        setTimeout: () => {},
        onError: () => {},
        onClose: () => {},
      },
      clientId: 'test',
      channel: 'test',
      metadata: new Map(),
    };

    const next = vi.fn().mockResolvedValue(undefined);

    await compression.execute(ctx, next);

    const compressionInfo = ctx.metadata.get('compression');
    expect(compressionInfo).toBeDefined();
    expect(compressionInfo).toMatchObject({
      enabled: true,
      threshold: 1024,
      level: 6,
    });
  });
});

describe('CORSMiddleware', () => {
  let cors: CORSMiddleware;

  beforeEach(() => {
    cors = new CORSMiddleware({
      origin: '*',
      methods: ['GET', 'OPTIONS'],
      headers: ['Content-Type', 'Last-Event-ID'],
      credentials: false,
      max_age: 86400,
    });
  });

  it('should have name and priority', () => {
    expect(cors.name).toBe('cors');
    expect(cors.priority).toBe(5);
  });

  it('should store CORS info in metadata', async () => {
    const ctx: MiddlewareContext = {
      req: {
        method: 'GET',
        url: '/events',
        headers: { origin: 'https://example.com' },
        query: {},
      },
      res: {
        write: () => true,
        end: () => {},
        isWritable: () => true,
        setTimeout: () => {},
        onError: () => {},
        onClose: () => {},
      },
      clientId: 'test',
      channel: 'test',
      metadata: new Map(),
    };

    const next = vi.fn().mockResolvedValue(undefined);

    await cors.execute(ctx, next);

    const corsInfo = ctx.metadata.get('cors');
    expect(corsInfo).toBeDefined();
    expect(corsInfo).toMatchObject({
      origin: '*',
      methods: 'GET, OPTIONS',
    });
  });

  it('should validate origin', async () => {
    const restrictedCORS = new CORSMiddleware({
      origin: ['https://example.com', 'https://trusted.com'],
      methods: ['GET'],
      headers: ['Content-Type'],
      credentials: false,
      max_age: 86400,
    });

    const ctx: MiddlewareContext = {
      req: {
        method: 'GET',
        url: '/events',
        headers: { origin: 'https://example.com' },
        query: {},
      },
      res: {
        write: () => true,
        end: () => {},
        isWritable: () => true,
        setTimeout: () => {},
        onError: () => {},
        onClose: () => {},
      },
      clientId: 'test',
      channel: 'test',
      metadata: new Map(),
    };

    const next = vi.fn().mockResolvedValue(undefined);

    await restrictedCORS.execute(ctx, next);

    const corsInfo = ctx.metadata.get('cors');
    expect(corsInfo).toBeDefined();
    expect(corsInfo.origin).toBe('https://example.com');
  });
});

describe('Helper functions', () => {
  it('should create Bearer auth middleware', () => {
    const auth = createBearerAuthMiddleware(async (token) => token === 'valid');
    expect(auth).toBeInstanceOf(AuthMiddleware);
  });

  it('should create IP rate limit middleware', () => {
    const rateLimit = createIPRateLimitMiddleware(100, 60000);
    expect(rateLimit).toBeInstanceOf(RateLimitMiddleware);
  });

  it('should create logging middleware', () => {
    const logging = createLoggingMiddleware('debug');
    expect(logging).toBeInstanceOf(LoggingMiddleware);
  });

  it('should create CORS middleware', () => {
    const cors = createCORSMiddleware('https://example.com');
    expect(cors).toBeInstanceOf(CORSMiddleware);
  });
});

describe('middleware export', () => {
  it('should export all middleware classes', () => {
    expect(middleware.Auth).toBe(AuthMiddleware);
    expect(middleware.RateLimit).toBe(RateLimitMiddleware);
    expect(middleware.Logging).toBe(LoggingMiddleware);
    expect(middleware.Compression).toBe(CompressionMiddleware);
    expect(middleware.CORS).toBe(CORSMiddleware);
  });
});

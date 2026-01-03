/**
 * @lsi/langgraph-state - Middleware Tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
  StateMiddlewareManager,
  LoggingMiddleware,
  AnalyticsMiddleware,
  ValidationMiddleware,
  TransformationMiddleware,
  RateLimitMiddleware,
  ErrorHandlingMiddleware,
  CacheMiddleware,
  EventEmitterMiddleware,
  createLoggingMiddleware,
  createAnalyticsMiddleware,
  createValidationMiddleware,
  createTransformationMiddleware,
  createRateLimitMiddleware,
  createErrorHandlingMiddleware,
  createCacheMiddleware,
  createEventEmitterMiddleware,
  composeMiddleware
} from '../src/middleware.js';

describe('StateMiddlewareManager', () => {
  it('should add and execute pre-middleware', async () => {
    const manager = new StateMiddlewareManager();
    const preMiddleware = vi.fn(async (_ctx, next) => await next());

    manager.usePre(preMiddleware);

    const context = {
      state: { foo: 'bar' },
      transition: {} as any,
      manager: {} as any,
      phase: 'pre'
    };

    await manager.executePre(context as any);

    expect(preMiddleware).toHaveBeenCalled();
  });

  it('should add and execute post-middleware', async () => {
    const manager = new StateMiddlewareManager();
    const postMiddleware = vi.fn(async (_ctx, next) => await next());

    manager.usePost(postMiddleware);

    const context = {
      state: { foo: 'bar' },
      transition: {} as any,
      manager: {} as any,
      phase: 'post'
    };

    await manager.executePost(context as any);

    expect(postMiddleware).toHaveBeenCalled();
  });

  it('should execute middleware in order', async () => {
    const manager = new StateMiddlewareManager();
    const order: string[] = [];

    const mw1 = async (_ctx: any, next: () => Promise<void>) => {
      order.push('mw1-start');
      await next();
      order.push('mw1-end');
    };

    const mw2 = async (_ctx: any, next: () => Promise<void>) => {
      order.push('mw2-start');
      await next();
      order.push('mw2-end');
    };

    manager.use(mw1);
    manager.use(mw2);

    const context = {
      state: { foo: 'bar' },
      transition: {} as any,
      manager: {} as any,
      phase: 'pre'
    };

    await manager.executePre(context as any);

    expect(order).toEqual(['mw1-start', 'mw2-start', 'mw2-end', 'mw1-end']);
  });

  it('should clear all middleware', async () => {
    const manager = new StateMiddlewareManager();
    const middleware = vi.fn(async (_ctx, next) => await next());

    manager.usePre(middleware);
    manager.usePost(middleware);
    manager.clear();

    expect((manager as any).preMiddleware).toHaveLength(0);
    expect((manager as any).postMiddleware).toHaveLength(0);
  });

  it('should remove specific middleware', async () => {
    const manager = new StateMiddlewareManager();
    const middleware = async (_ctx: any, next: () => Promise<void>) => await next();

    manager.use(middleware);
    manager.remove(middleware);

    expect((manager as any).middleware).toHaveLength(0);
  });
});

describe('LoggingMiddleware', () => {
  it('should log state changes', () => {
    const logger = vi.fn();
    const logging = new LoggingMiddleware(logger);

    const middleware = logging.middleware();
    expect(typeof middleware).toBe('function');
  });

  it('should include state when configured', () => {
    const logging = new LoggingMiddleware(undefined, true);
    const middleware = logging.middleware();
    expect(typeof middleware).toBe('function');
  });
});

describe('AnalyticsMiddleware', () => {
  it('should track metrics', async () => {
    const analytics = new AnalyticsMiddleware();
    const middleware = analytics.middleware();

    const context = {
      state: { foo: 'bar' },
      nextState: { foo: 'baz' },
      transition: { id: 'test', scope: 'global' as const, trigger: 'test', changes: [], toState: {} as any, fromState: {} as any, timestamp: new Date() },
      manager: {} as any,
      phase: 'post' as const
    };

    await middleware(context as any, async () => {});

    const metrics = analytics.getMetrics();
    expect(metrics).toHaveLength(1);
  });

  it('should get metrics by scope', async () => {
    const analytics = new AnalyticsMiddleware();
    const middleware = analytics.middleware();

    const context = {
      state: { foo: 'bar' },
      nextState: { foo: 'baz' },
      transition: { id: 'test', scope: 'global' as const, trigger: 'test', changes: [], toState: {} as any, fromState: {} as any, timestamp: new Date() },
      manager: {} as any,
      phase: 'post' as const
    };

    await middleware(context as any, async () => {});

    const globalMetrics = analytics.getMetricsByScope('global');
    expect(globalMetrics).toHaveLength(1);
  });

  it('should calculate average duration', async () => {
    const analytics = new AnalyticsMiddleware();

    const context = {
      state: { foo: 'bar' },
      nextState: { foo: 'baz' },
      transition: { id: 'test', scope: 'global' as const, trigger: 'test', changes: [], toState: {} as any, fromState: {} as any, timestamp: new Date() },
      manager: {} as any,
      phase: 'post' as const
    };

    const middleware = analytics.middleware();
    await middleware(context as any, async () => {});
    await middleware(context as any, async () => {});

    const avg = analytics.getAverageDuration();
    expect(typeof avg).toBe('number');
  });

  it('should clear metrics', () => {
    const analytics = new AnalyticsMiddleware();
    analytics.clearMetrics();
    expect(analytics.getMetrics()).toHaveLength(0);
  });
});

describe('ValidationMiddleware', () => {
  it('should validate state', async () => {
    const validator = vi.fn(() => ({ valid: true, errors: [] }));
    const validation = new ValidationMiddleware(validator, false);
    const middleware = validation.middleware();

    const context = {
      state: { foo: 'bar' },
      transition: {} as any,
      manager: {} as any,
      phase: 'pre' as const
    };

    await middleware(context as any, async () => {});

    expect(validator).toHaveBeenCalled();
  });

  it('should not throw when configured', async () => {
    const validator = () => ({ valid: false, errors: ['error'] });
    const validation = new ValidationMiddleware(validator, false);
    const middleware = validation.middleware();

    const context = {
      state: { foo: 'bar' },
      transition: {} as any,
      manager: {} as any,
      phase: 'pre' as const
    };

    await expect(middleware(context as any, async () => {})).resolves.not.toThrow();
  });

  it('should throw when configured', async () => {
    const validator = () => ({ valid: false, errors: ['error'] });
    const validation = new ValidationMiddleware(validator, true);
    const middleware = validation.middleware();

    const context = {
      state: { foo: 'bar' },
      transition: {} as any,
      manager: {} as any,
      phase: 'pre' as const
    };

    await expect(middleware(context as any, async () => {})).rejects.toThrow();
  });
});

describe('TransformationMiddleware', () => {
  it('should register and apply transformers', async () => {
    const transform = new TransformationMiddleware();
    const transformer = vi.fn((value) => `transformed-${value}`);

    transform.register('foo', transformer);

    const context = {
      state: { foo: 'bar' },
      nextState: { foo: 'bar' },
      transition: {} as any,
      manager: {} as any,
      phase: 'pre' as const
    };

    const middleware = transform.middleware();
    await middleware(context as any, async () => {});

    expect(transformer).toHaveBeenCalledWith('bar');
  });

  it('should unregister transformers', () => {
    const transform = new TransformationMiddleware();
    const transformer = (value: unknown) => value;

    transform.register('foo', transformer);
    transform.unregister('foo');

    expect((transform as any).transformers.has('foo')).toBe(false);
  });
});

describe('RateLimitMiddleware', () => {
  it('should allow requests under limit', async () => {
    const rateLimit = new RateLimitMiddleware(1000, 10);
    const middleware = rateLimit.middleware();

    const context = {
      state: { foo: 'bar' },
      transition: { id: 'test', scope: 'global' as const, trigger: 'test', changes: [], toState: {} as any, fromState: {} as any, timestamp: new Date() },
      manager: {} as any,
      phase: 'pre' as const
    };

    await expect(middleware(context as any, async () => {})).resolves.not.toThrow();
  });

  it('should throw when limit exceeded', async () => {
    const rateLimit = new RateLimitMiddleware(1000, 1);
    const middleware = rateLimit.middleware();

    const context = {
      state: { foo: 'bar' },
      transition: { id: 'test', scope: 'global' as const, trigger: 'test', changes: [], toState: {} as any, fromState: {} as any, timestamp: new Date() },
      manager: {} as any,
      phase: 'pre' as const
    };

    await middleware(context as any, async () => {});
    await expect(middleware(context as any, async () => {})).rejects.toThrow();
  });
});

describe('ErrorHandlingMiddleware', () => {
  it('should catch errors', async () => {
    const errorHandling = new ErrorHandlingMiddleware(false);
    const errorHandler = vi.fn();

    errorHandling.onError(errorHandler);

    const middleware = errorHandling.middleware();

    const context = {
      state: { foo: 'bar' },
      transition: {} as any,
      manager: {} as any,
      phase: 'pre' as const
    };

    const next = async () => { throw new Error('Test error'); };

    await expect(middleware(context as any, next)).resolves.not.toThrow();
    expect(errorHandler).toHaveBeenCalled();
  });

  it('should rethrow when configured', async () => {
    const errorHandling = new ErrorHandlingMiddleware(true);
    const middleware = errorHandling.middleware();

    const context = {
      state: { foo: 'bar' },
      transition: {} as any,
      manager: {} as any,
      phase: 'pre' as const
    };

    const next = async () => { throw new Error('Test error'); };

    await expect(middleware(context as any, next)).rejects.toThrow('Test error');
  });
});

describe('CacheMiddleware', () => {
  it('should cache state', async () => {
    const cache = new CacheMiddleware(1000);
    const middleware = cache.middleware();

    const context = {
      state: { foo: 'bar' },
      nextState: { foo: 'baz' },
      transition: { id: 'test', scope: 'global' as const, trigger: 'test', changes: [], toState: {} as any, fromState: {} as any, timestamp: new Date() },
      manager: {} as any,
      phase: 'pre' as const
    };

    let callCount = 0;
    const next = async () => { callCount++; };

    // First call - not cached
    await middleware(context as any, next);
    expect(callCount).toBe(1);

    // Second call - should be cached
    await middleware(context as any, next);
    expect(callCount).toBe(1);
  });

  it('should clear cache', () => {
    const cache = new CacheMiddleware();
    cache.clearCache();
    expect((cache as any).cache.size).toBe(0);
  });
});

describe('EventEmitterMiddleware', () => {
  it('should emit events', async () => {
    const emitter = new EventEmitterMiddleware();
    const middleware = emitter.middleware();
    const listener = vi.fn();

    emitter.on('state:change', listener);

    const context = {
      state: { foo: 'bar' },
      nextState: { foo: 'baz' },
      transition: { id: 'test', scope: 'global' as const, trigger: 'test', changes: [], toState: {} as any, fromState: {} as any, timestamp: new Date() },
      manager: {} as any,
      phase: 'pre' as const
    };

    await middleware(context as any, async () => {});

    expect(listener).toHaveBeenCalled();
  });

  it('should remove listeners', () => {
    const emitter = new EventEmitterMiddleware();
    const listener = vi.fn();

    emitter.on('state:change', listener);
    emitter.off('state:change', listener);

    const listeners = (emitter as any).listeners.get('state:change');
    expect(listeners?.size).toBe(0);
  });
});

describe('Factory Functions', () => {
  it('should create logging middleware', () => {
    const middleware = createLoggingMiddleware();
    expect(typeof middleware).toBe('function');
  });

  it('should create analytics middleware', () => {
    const middleware = createAnalyticsMiddleware();
    expect(middleware).toBeInstanceOf(AnalyticsMiddleware);
  });

  it('should create validation middleware', () => {
    const validator = () => ({ valid: true, errors: [] });
    const middleware = createValidationMiddleware(validator);
    expect(typeof middleware).toBe('function');
  });

  it('should create transformation middleware', () => {
    const middleware = createTransformationMiddleware();
    expect(middleware).toBeInstanceOf(TransformationMiddleware);
  });

  it('should create rate limit middleware', () => {
    const middleware = createRateLimitMiddleware();
    expect(typeof middleware).toBe('function');
  });

  it('should create error handling middleware', () => {
    const middleware = createErrorHandlingMiddleware();
    expect(typeof middleware).toBe('function');
  });

  it('should create cache middleware', () => {
    const middleware = createCacheMiddleware();
    expect(typeof middleware).toBe('function');
  });

  it('should create event emitter middleware', () => {
    const middleware = createEventEmitterMiddleware();
    expect(middleware).toBeInstanceOf(EventEmitterMiddleware);
  });
});

describe('composeMiddleware', () => {
  it('should compose multiple middleware', async () => {
    const order: string[] = [];

    const mw1 = async (ctx: any, next: () => Promise<void>) => {
      order.push('1-start');
      await next();
      order.push('1-end');
    };

    const mw2 = async (ctx: any, next: () => Promise<void>) => {
      order.push('2-start');
      await next();
      order.push('2-end');
    };

    const composed = composeMiddleware(mw1, mw2);

    const context = {
      state: { foo: 'bar' },
      transition: {} as any,
      manager: {} as any,
      phase: 'pre' as const
    };

    await composed(context as any, async () => {
      order.push('next');
    });

    expect(order).toEqual(['1-start', '2-start', 'next', '2-end', '1-end']);
  });

  it('should handle empty composition', async () => {
    const composed = composeMiddleware();

    const context = {
      state: { foo: 'bar' },
      transition: {} as any,
      manager: {} as any,
      phase: 'pre' as const
    };

    const next = vi.fn(async () => {});

    await composed(context as any, next);
    expect(next).toHaveBeenCalled();
  });
});

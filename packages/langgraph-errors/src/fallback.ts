/**
 * @file fallback.ts - Fallback mechanisms and management
 * @package @lsi/langgraph-errors
 */

import type {
  AgentError,
  FallbackConfig,
  RecoveryResult,
  ErrorPolicy,
} from "./types.js";

/**
 * Cached fallback result
 */
interface CachedResult {
  result: unknown;
  timestamp: number;
  ttl: number;
}

/**
 * Fallback manager
 */
export class FallbackManager {
  private cache: Map<string, CachedResult>;
  private fallbackHandlers: Map<
    string,
    (error: AgentError) => Promise<unknown>
  >;

  constructor() {
    this.cache = new Map();
    this.fallbackHandlers = new Map();
  }

  /**
   * Execute fallback strategy
   */
  async fallback(
    error: AgentError,
    policy: ErrorPolicy,
    context?: Record<string, unknown>
  ): Promise<RecoveryResult> {
    const config = this.buildConfig(policy, context);
    const startTime = Date.now();

    // Try fallback chain
    for (const agentId of config.fallback_chain) {
      try {
        const result = await this.executeFallback(agentId, error, context);
        const valid = !config.validate_result || config.validate_result(result);

        if (valid) {
          return {
            success: true,
            strategy: "fallback",
            result,
            recovery_time: Date.now() - startTime,
            attempts: 1,
          };
        }
      } catch (e) {
        // Continue to next fallback
        continue;
      }
    }

    // Try cached result if enabled
    if (config.use_cache) {
      const cacheKey = this.getCacheKey(error);
      const cached = this.cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        return {
          success: true,
          strategy: "fallback",
          result: cached.result,
          recovery_time: Date.now() - startTime,
          attempts: 1,
        };
      }
    }

    // Return default result if available
    if (config.default_result !== undefined) {
      return {
        success: true,
        strategy: "fallback",
        result: config.default_result,
        recovery_time: Date.now() - startTime,
        attempts: 1,
      };
    }

    // No fallback available
    return {
      success: false,
      strategy: "fallback",
      error,
      recovery_time: Date.now() - startTime,
      attempts: 1,
    };
  }

  /**
   * Execute fallback for a specific agent
   */
  private async executeFallback(
    agentId: string,
    error: AgentError,
    context?: Record<string, unknown>
  ): Promise<unknown> {
    const handler = this.fallbackHandlers.get(agentId);

    if (handler) {
      return handler(error);
    }

    // Default fallback behavior
    throw new Error(`No fallback handler for agent: ${agentId}`);
  }

  /**
   * Register fallback handler for an agent
   */
  registerFallbackHandler(
    agentId: string,
    handler: (error: AgentError) => Promise<unknown>
  ): void {
    this.fallbackHandlers.set(agentId, handler);
  }

  /**
   * Unregister fallback handler
   */
  unregisterFallbackHandler(agentId: string): void {
    this.fallbackHandlers.delete(agentId);
  }

  /**
   * Cache a result for fallback
   */
  cacheResult(key: string, result: unknown, ttl: number = 60000): void {
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Get cached result
   */
  getCachedResult(key: string): unknown | undefined {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.result;
    }
    return undefined;
  }

  /**
   * Clear cache
   */
  clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Clean expired cache entries
   */
  cleanCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp >= cached.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Build fallback config from policy
   */
  private buildConfig(
    policy: ErrorPolicy,
    context?: Record<string, unknown>
  ): FallbackConfig {
    return {
      fallback_chain: policy.fallback_agent ? [policy.fallback_agent] : [],
      default_result: undefined,
      use_cache: true,
      cache_ttl: 60000,
      validate_result: undefined,
    };
  }

  /**
   * Generate cache key from error
   */
  private getCacheKey(error: AgentError): string {
    return `${error.agent_id}_${error.category}_${error.message.substring(0, 50)}`;
  }

  /**
   * Create fallback chain
   */
  createFallbackChain(...agentIds: string[]): string[] {
    return agentIds;
  }

  /**
   * Validate fallback result
   */
  static validateResult(result: unknown): boolean {
    return result !== undefined && result !== null;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    keys: string[];
    hitRate: number;
  } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      hitRate: 0, // Would need to track hits/misses
    };
  }
}

/**
 * Singleton instance
 */
export const fallbackManager = new FallbackManager();

/**
 * Convenience function to execute fallback
 */
export async function fallback(
  error: AgentError,
  policy: ErrorPolicy,
  context?: Record<string, unknown>
): Promise<RecoveryResult> {
  return fallbackManager.fallback(error, policy, context);
}

/**
 * Convenience function to register fallback handler
 */
export function registerFallbackHandler(
  agentId: string,
  handler: (error: AgentError) => Promise<unknown>
): void {
  fallbackManager.registerFallbackHandler(agentId, handler);
}

/**
 * Chain multiple fallbacks
 */
export function chainFallbacks(
  ...handlers: Array<(error: AgentError) => Promise<unknown>>
): (error: AgentError) => Promise<unknown> {
  return async (error: AgentError) => {
    for (const handler of handlers) {
      try {
        return await handler(error);
      } catch (e) {
        continue;
      }
    }
    throw error;
  };
}

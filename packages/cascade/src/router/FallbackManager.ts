/**
 * FallbackManager - Intelligent fallback logic for routing failures
 *
 * Manages fallback strategies when cloud models fail or are unavailable.
 * Implements circuit breaker pattern, adaptive learning, and multi-strategy fallback.
 *
 * @example
 * ```typescript
 * const fallbackManager = new FallbackManager({
 *   defaultStrategy: createCircuitBreakerFallbackStrategy('local')
 * });
 *
 * const decision = await fallbackManager.shouldFallback(
 *   'cloud',
 *   new Error('Request timeout')
 * );
 *
 * if (decision.shouldFallback) {
 *   // Route to decision.targetRoute instead
 * }
 * ```
 */

import type {
  FallbackStrategy,
  FallbackDecision,
  FallbackResult,
  FallbackMetrics,
  FallbackState,
  FallbackManagerConfig,
  FallbackTrigger,
  RouteDecisionWithFallback,
  classifyError,
  createDefaultFallbackStrategy,
} from "@lsi/protocol";
import {
  CircuitBreaker,
  createCircuitBreaker,
  type CircuitBreakerStats,
} from "@lsi/utils";

/**
 * FallbackManager - Manages intelligent fallback strategies
 */
export class FallbackManager {
  private config: FallbackManagerConfig;
  private state: FallbackState;
  private metrics: FallbackMetrics;
  private circuitBreakers: Map<"local" | "cloud" | "hybrid", CircuitBreaker>;
  private performanceHistory: Array<{
    route: "local" | "cloud" | "hybrid";
    success: boolean;
    latency: number;
    cost: number;
    timestamp: number;
  }> = [];

  constructor(config: FallbackManagerConfig) {
    this.config = {
      ...config,
      maxFallbackDepth: config.maxFallbackDepth ?? 3,
    };

    // Initialize state
    this.state = {
      currentRoute: "cloud",
      originalRoute: "cloud",
      fallbackDepth: 0,
      activeStrategy: config.defaultStrategy,
      circuitOpen: false,
      performanceHistory: [],
    };

    // Initialize metrics
    this.metrics = {
      totalTriggers: 0,
      triggersByType: {},
      successfulFallbacks: 0,
      failedFallbacks: 0,
      averageFallbackTime: 0,
      successRate: 1.0,
      recentFallbacks: [],
    };

    // Initialize circuit breakers for each route
    this.circuitBreakers = new Map();
    this.initializeCircuitBreakers();
  }

  /**
   * Determine if fallback should be triggered based on error
   * @param currentRoute - Current route that failed
   * @param error - Error that occurred
   * @returns Fallback decision
   */
  async shouldFallback(
    currentRoute: "local" | "cloud" | "hybrid",
    error: Error
  ): Promise<FallbackDecision> {
    const startTime = Date.now();

    // Classify the error
    const classification = this.classifyErrorInternal(error);

    // Get the appropriate strategy for this route
    const strategy =
      this.config.routeStrategies?.[currentRoute] ||
      this.config.defaultStrategy;

    // Check if strategy triggers fallback for this error type
    if (!classification.shouldFallback) {
      return {
        shouldFallback: false,
        targetRoute: currentRoute,
        reason: classification.trigger,
        confidence: 1.0,
        estimatedSuccessRate: 0.0,
      };
    }

    // Check if fallback is enabled for this trigger type
    if (!this.isFallbackEnabled(strategy, classification.trigger)) {
      return {
        shouldFallback: false,
        targetRoute: currentRoute,
        reason: classification.trigger,
        confidence: 1.0,
        estimatedSuccessRate: 0.0,
      };
    }

    // Check circuit breaker if using circuit breaker strategy
    if (strategy.type === "circuit_breaker") {
      const breaker = this.circuitBreakers.get(currentRoute);
      if (breaker?.isOpen()) {
        // Circuit is open, definitely fallback
        return {
          shouldFallback: true,
          targetRoute: strategy.targetBackend,
          reason: classification.trigger,
          confidence: 0.95,
          estimatedSuccessRate: this.estimateSuccessRate(strategy.targetBackend),
          recommendedDelay: breaker.getTimeUntilRecovery(),
        };
      }
    }

    // Check adaptive strategy
    if (strategy.type === "adaptive") {
      const adaptiveDecision = this.evaluateAdaptiveStrategy(
        strategy,
        currentRoute
      );
      if (!adaptiveDecision.shouldFallback) {
        return adaptiveDecision;
      }
    }

    // Check max fallback depth
    if (this.state.fallbackDepth >= (this.config.maxFallbackDepth ?? 3)) {
      return {
        shouldFallback: false,
        targetRoute: currentRoute,
        reason: "max_depth_exceeded",
        confidence: 0.0,
        estimatedSuccessRate: 0.0,
      };
    }

    // Calculate fallback delay based on strategy
    let recommendedDelay: number | undefined;
    if (strategy.type === "delayed") {
      recommendedDelay = strategy.fallbackDelay;
    } else if (classification.retry && classification.retryDelay) {
      recommendedDelay = classification.retryDelay;
    }

    // Estimate success rate based on historical performance
    const estimatedSuccessRate = this.estimateSuccessRate(
      strategy.targetBackend
    );

    const fallbackTime = Date.now() - startTime;

    return {
      shouldFallback: true,
      targetRoute: strategy.targetBackend,
      reason: classification.trigger,
      confidence: this.calculateFallbackConfidence(classification, strategy),
      estimatedSuccessRate,
      recommendedDelay,
    };
  }

  /**
   * Execute a fallback operation
   * @param originalRoute - Original route that failed
   * @param targetRoute - Target route for fallback
   * @param trigger - Fallback trigger reason
   * @param fn - Function to execute with fallback
   * @returns Fallback result
   */
  async executeFallback<T>(
    originalRoute: "local" | "cloud" | "hybrid",
    targetRoute: "local" | "cloud" | "hybrid",
    trigger: FallbackTrigger,
    fn: () => Promise<T>
  ): Promise<FallbackResult & { result?: T }> {
    const startTime = Date.now();
    const attempts = this.state.fallbackDepth + 1;

    try {
      // Update state
      this.state.currentRoute = targetRoute;
      this.state.fallbackDepth = attempts;

      // Execute through circuit breaker if available
      const breaker = this.circuitBreakers.get(targetRoute);
      let result: T;

      if (breaker) {
        result = await breaker.execute(fn);
      } else {
        result = await fn();
      }

      const fallbackTime = Date.now() - startTime;

      // Record successful fallback
      this.recordFallback({
        triggered: true,
        originalRoute,
        finalRoute: targetRoute,
        trigger,
        attempts,
        fallbackTime,
        success: true,
      });

      // Update performance history
      this.recordPerformance(targetRoute, true, fallbackTime, 0);

      return {
        triggered: true,
        originalRoute,
        finalRoute: targetRoute,
        trigger,
        attempts,
        fallbackTime,
        success: true,
        result,
      };
    } catch (error) {
      const fallbackTime = Date.now() - startTime;

      // Record failed fallback
      this.recordFallback({
        triggered: true,
        originalRoute,
        finalRoute: targetRoute,
        trigger,
        attempts,
        fallbackTime,
        success: false,
        error: error as Error,
      });

      // Update performance history
      this.recordPerformance(targetRoute, false, fallbackTime, 0);

      return {
        triggered: true,
        originalRoute,
        finalRoute: targetRoute,
        trigger,
        attempts,
        fallbackTime,
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * Record a fallback operation in metrics
   */
  private recordFallback(result: FallbackResult): void {
    this.metrics.totalTriggers++;

    if (result.trigger) {
      this.metrics.triggersByType[result.trigger] =
        (this.metrics.triggersByType[result.trigger] || 0) + 1;
    }

    if (result.success) {
      this.metrics.successfulFallbacks++;
    } else {
      this.metrics.failedFallbacks++;
    }

    // Update average fallback time
    const totalFallbacks =
      this.metrics.successfulFallbacks + this.metrics.failedFallbacks;
    this.metrics.averageFallbackTime =
      (this.metrics.averageFallbackTime * (totalFallbacks - 1) +
        result.fallbackTime) /
      totalFallbacks;

    // Update success rate
    this.metrics.successRate =
      this.metrics.successfulFallbacks / totalFallbacks;

    // Update recent fallbacks (keep last 100)
    this.metrics.recentFallbacks.push(result);
    if (this.metrics.recentFallbacks.length > 100) {
      this.metrics.recentFallbacks.shift();
    }

    this.metrics.lastFallbackTime = Date.now();
  }

  /**
   * Record performance data for adaptive learning
   */
  recordPerformance(
    route: "local" | "cloud" | "hybrid",
    success: boolean,
    latency: number,
    cost: number
  ): void {
    const record = {
      route,
      success,
      latency,
      cost,
      timestamp: Date.now(),
    };

    this.performanceHistory.push(record);
    this.state.performanceHistory.push(record);

    // Keep performance history bounded
    const maxHistory = 1000;
    if (this.performanceHistory.length > maxHistory) {
      this.performanceHistory.shift();
      this.state.performanceHistory.shift();
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): FallbackMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current state
   */
  getState(): FallbackState {
    return { ...this.state };
  }

  /**
   * Reset fallback state and metrics
   */
  reset(): void {
    this.state = {
      currentRoute: "cloud",
      originalRoute: "cloud",
      fallbackDepth: 0,
      activeStrategy: this.config.defaultStrategy,
      circuitOpen: false,
      performanceHistory: [],
    };

    this.metrics = {
      totalTriggers: 0,
      triggersByType: {},
      successfulFallbacks: 0,
      failedFallbacks: 0,
      averageFallbackTime: 0,
      successRate: 1.0,
      recentFallbacks: [],
    };

    // Reset circuit breakers
    this.initializeCircuitBreakers();
  }

  /**
   * Enhance route decision with fallback information
   */
  enhanceRouteDecision(
    decision: RouteDecisionWithFallback
  ): RouteDecisionWithFallback {
    const strategy =
      this.config.routeStrategies?.[decision.route] ||
      this.config.defaultStrategy;

    return {
      ...decision,
      fallbackStrategy: strategy,
      fallbackAvailable: strategy.targetBackend !== decision.route,
      fallbackTriggers: this.getEnabledTriggers(strategy),
    };
  }

  /**
   * Get circuit breaker stats for a route
   */
  getCircuitBreakerStats(
    route: "local" | "cloud" | "hybrid"
  ): CircuitBreakerStats | undefined {
    return this.circuitBreakers.get(route)?.getStats();
  }

  /**
   * Manually open circuit for a route
   */
  openCircuit(route: "local" | "cloud" | "hybrid"): void {
    this.circuitBreakers.get(route)?.open();
  }

  /**
   * Manually close circuit for a route
   */
  closeCircuit(route: "local" | "cloud" | "hybrid"): void {
    this.circuitBreakers.get(route)?.close();
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Initialize circuit breakers for each route
   */
  private initializeCircuitBreakers(): void {
    const routes: Array<"local" | "cloud" | "hybrid"> = [
      "local",
      "cloud",
      "hybrid",
    ];

    for (const route of routes) {
      const strategy =
        this.config.routeStrategies?.[route] || this.config.defaultStrategy;

      if (strategy.type === "circuit_breaker") {
        const breaker = createCircuitBreaker({
          failureThreshold: strategy.circuitBreaker.failureThreshold,
          recoveryTimeout: strategy.circuitBreaker.recoveryTimeout,
          halfOpenAttempts: strategy.circuitBreaker.halfOpenAttempts,
          executionTimeout: 30000,
          autoRecover: true,
          successThreshold: strategy.circuitBreaker.successThreshold,
        });
        this.circuitBreakers.set(route, breaker);
      } else {
        // Default circuit breaker for non-circuit-breaker strategies
        const breaker = createCircuitBreaker();
        this.circuitBreakers.set(route, breaker);
      }
    }
  }

  /**
   * Classify error internally
   */
  private classifyErrorInternal(error: Error): {
    shouldFallback: boolean;
    trigger: FallbackTrigger;
    retry: boolean;
    retryDelay?: number;
  } {
    // Import classifyError dynamically to avoid circular dependency
    const { classifyError } = require("@lsi/protocol");
    return classifyError(error);
  }

  /**
   * Check if fallback is enabled for a trigger type
   */
  private isFallbackEnabled(
    strategy: FallbackStrategy,
    trigger: FallbackTrigger
  ): boolean {
    switch (trigger) {
      case "timeout":
        return strategy.onTimeout ?? false;
      case "rate_limit":
        return strategy.onRateLimit ?? false;
      case "server_error":
        return strategy.onServerError ?? false;
      case "client_error":
        return strategy.onClientError ?? false;
      case "network_error":
        return strategy.onNetworkError ?? false;
      case "cost_threshold":
        return strategy.onCostThreshold ?? false;
      default:
        return false;
    }
  }

  /**
   * Get enabled trigger types for a strategy
   */
  private getEnabledTriggers(strategy: FallbackStrategy): FallbackTrigger[] {
    const triggers: FallbackTrigger[] = [];

    if (strategy.onTimeout) triggers.push("timeout");
    if (strategy.onRateLimit) triggers.push("rate_limit");
    if (strategy.onServerError) triggers.push("server_error");
    if (strategy.onClientError) triggers.push("client_error");
    if (strategy.onNetworkError) triggers.push("network_error");
    if (strategy.onCostThreshold) triggers.push("cost_threshold");

    return triggers;
  }

  /**
   * Evaluate adaptive fallback strategy
   */
  private evaluateAdaptiveStrategy(
    strategy: Extract<FallbackStrategy, { type: "adaptive" }>,
    currentRoute: "local" | "cloud" | "hybrid"
  ): FallbackDecision {
    const history = this.performanceHistory.slice(-strategy.learningWindow);
    const currentRouteHistory = history.filter(h => h.route === currentRoute);

    // Check if we have enough samples
    if (currentRouteHistory.length < strategy.minSamples) {
      // Not enough data, use default behavior
      return {
        shouldFallback: true,
        targetRoute: strategy.targetBackend,
        reason: "unknown",
        confidence: 0.5,
        estimatedSuccessRate: 0.5,
      };
    }

    // Calculate success rate for current route
    const currentSuccessRate =
      currentRouteHistory.filter(h => h.success).length /
      currentRouteHistory.length;

    // If current route is performing well, don't fallback
    if (currentSuccessRate >= strategy.successRateThreshold) {
      return {
        shouldFallback: false,
        targetRoute: currentRoute,
        reason: "none",
        confidence: currentSuccessRate,
        estimatedSuccessRate: 0.0,
      };
    }

    return {
      shouldFallback: true,
      targetRoute: strategy.targetBackend,
      reason: "unknown",
      confidence: 1 - currentSuccessRate,
      estimatedSuccessRate: this.estimateSuccessRate(strategy.targetBackend),
    };
  }

  /**
   * Estimate success rate for a route based on historical performance
   */
  private estimateSuccessRate(route: "local" | "cloud" | "hybrid"): number {
    const history = this.performanceHistory.slice(-100); // Last 100 requests
    const routeHistory = history.filter(h => h.route === route);

    if (routeHistory.length === 0) {
      // No historical data, return neutral estimate
      return 0.5;
    }

    return routeHistory.filter(h => h.success).length / routeHistory.length;
  }

  /**
   * Calculate fallback confidence based on classification and strategy
   */
  private calculateFallbackConfidence(
    classification: { shouldFallback: boolean; trigger: FallbackTrigger },
    strategy: FallbackStrategy
  ): number {
    // Base confidence
    let confidence = 0.7;

    // Increase confidence for certain triggers
    if (
      classification.trigger === "timeout" ||
      classification.trigger === "network_error" ||
      classification.trigger === "server_error"
    ) {
      confidence = 0.9;
    }

    // Adjust based on strategy type
    if (strategy.type === "circuit_breaker") {
      confidence = 0.95;
    } else if (strategy.type === "adaptive") {
      // Adaptive strategy confidence is based on historical performance
      confidence = this.estimateSuccessRate(strategy.targetBackend);
    }

    return confidence;
  }
}

/**
 * Create a fallback manager with default configuration
 */
export function createFallbackManager(
  config?: Partial<FallbackManagerConfig>
): FallbackManager {
  const { createDefaultFallbackStrategy } = require("@lsi/protocol");

  return new FallbackManager({
    defaultStrategy: createDefaultFallbackStrategy(),
    enableAdaptive: true,
    enableMetrics: true,
    maxFallbackDepth: 3,
    ...config,
  });
}

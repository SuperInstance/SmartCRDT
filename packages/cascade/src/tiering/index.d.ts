/**
 * Scale-Adaptive Tiers
 *
 * Automatic tier detection and routing based on request volume:
 *
 * - Quick Flow Tier (< 10 RPM): Fast-path routing, minimal overhead
 * - Standard Tier (10-100 RPM): Full CascadeRouter functionality
 * - Enterprise Tier (> 100 RPM): Advanced features with queuing
 *
 * @example
 * ```ts
 * import { TierManager, QuickFlowRouter, EnterpriseRouter } from '@lsi/cascade/tiering';
 *
 * const tierManager = new TierManager({ mode: 'auto' });
 * const quickRouter = new QuickFlowRouter();
 * const enterpriseRouter = new EnterpriseRouter(cascadeRouter);
 *
 * // Record requests for tier detection
 * tierManager.recordRequest(Date.now());
 *
 * // Route based on current tier
 * const tier = tierManager.getCurrentTier();
 * const decision = await routeByTier(request, tier);
 * ```
 */
export type { Tier, TierConfig, TierLimits, TierFeature, TierStats, PriorityLevel, PriorityRequest, QueueStats, RequestRateMetrics, TierRouter, RoutingDecision, } from "./types";
export { DEFAULT_TIER_LIMITS, DEFAULT_TIER_CONFIG } from "./types";
export { TierManager } from "./TierManager";
export { RequestRateMonitor } from "./RequestRateMonitor";
export { QuickFlowRouter } from "./QuickFlowRouter";
export { EnterpriseRouter, DEFAULT_ENTERPRISE_CONFIG, } from "./EnterpriseRouter";
export { RequestQueue } from "./RequestQueue";
export declare function routeByTier(request: string, tier: import("./types.js").Tier, routers: {
    quick: import("./QuickFlowRouter.js").QuickFlowRouter;
    standard: import("../router/CascadeRouter.js").CascadeRouter;
    enterprise: import("./EnterpriseRouter.js").EnterpriseRouter;
}, context?: import("../types.js").QueryContext): Promise<import("./types.js").RoutingDecision>;
//# sourceMappingURL=index.d.ts.map
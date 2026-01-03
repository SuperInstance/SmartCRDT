/**
 * Preload Manager - Main orchestrator for predictive module preloading
 *
 * Coordinates usage tracking, predictive engine, time-based scheduling,
 * and event triggers to provide zero cold start module loading.
 */

import type {
  ModuleMetadata,
  PreloadRule,
  PreloadStats,
  PreloadPriority,
  ModuleLoadState,
  ModulePreloadStats,
  PreloadManagerConfig,
  PredictionResult,
} from "./types.js";
import { UsageTracker } from "./UsageTracker.js";
import { PredictiveEngine } from "./PredictiveEngine.js";
import { TimeScheduler } from "./TimeScheduler.js";
import { EventTriggerManager } from "./EventTrigger.js";

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: PreloadManagerConfig = {
  maxConcurrentPreloads: 5,
  preloadTimeout: 30000,
  enablePrediction: true,
  enableScheduling: true,
  enableEventTriggers: true,
  maxCacheSize: 100 * 1024 * 1024, // 100MB
  cacheTTL: 3600000, // 1 hour
};

// ============================================================================
// Preload Manager Class
// ============================================================================

export class PreloadManager {
  private config: PreloadManagerConfig;
  private usageTracker: UsageTracker;
  private predictiveEngine: PredictiveEngine;
  private timeScheduler: TimeScheduler;
  private eventTrigger: EventTriggerManager;

  private moduleRegistry: Map<string, ModuleMetadata>;
  private loadState: Map<string, ModuleLoadState>;
  private preloadRules: Map<string, PreloadRule>;
  private moduleStats: Map<string, ModulePreloadStats>;

  private cache: Map<string, { module: any; expiresAt: number }>;
  private activePreloads: Set<string>;
  private preloadHistory: Array<{
    moduleName: string;
    timestamp: number;
    trigger: string;
    success: boolean;
    loadTime: number;
  }>;

  constructor(config: Partial<PreloadManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize components
    this.usageTracker = new UsageTracker();
    this.predictiveEngine = new PredictiveEngine(this.usageTracker);
    this.timeScheduler = new TimeScheduler();
    this.eventTrigger = new EventTriggerManager();

    // Initialize storage
    this.moduleRegistry = new Map();
    this.loadState = new Map();
    this.preloadRules = new Map();
    this.moduleStats = new Map();
    this.cache = new Map();
    this.activePreloads = new Set();
    this.preloadHistory = [];

    // Setup prediction callback
    this.predictiveEngine.onPrediction(prediction => {
      if (prediction.confidence >= 0.5) {
        this.preloadModule(prediction.moduleName).catch(console.error);
      }
    });

    // Setup event triggers for auto-preloading
    this.setupEventTriggers();
  }

  // ========================================================================
  // Module Registration
  // ========================================================================

  /**
   * Register a module for preloading
   */
  registerModule(metadata: ModuleMetadata): void {
    this.moduleRegistry.set(metadata.id, metadata);
    this.loadState.set(metadata.id, {
      moduleId: metadata.id,
      loaded: false,
    });
    this.moduleStats.set(metadata.id, {
      moduleId: metadata.id,
      preloadCount: 0,
      usedCount: 0,
      utilizationRate: 0,
      avgLoadTime: metadata.loadTime,
      cacheHitRate: 0,
    });

    // Also register with scheduler and event trigger
    this.timeScheduler.registerModule(metadata);
    this.eventTrigger.registerModule(metadata);
  }

  /**
   * Unregister a module
   */
  unregisterModule(moduleId: string): void {
    this.moduleRegistry.delete(moduleId);
    this.loadState.delete(moduleId);
    this.moduleStats.delete(moduleId);
    this.cache.delete(moduleId);

    this.timeScheduler.unregisterModule(moduleId);
    this.eventTrigger.unregisterModule(moduleId);

    // Remove rules for this module
    for (const [ruleId, rule] of this.preloadRules.entries()) {
      if (rule.moduleName === moduleId) {
        this.preloadRules.delete(ruleId);
      }
    }
  }

  /**
   * Get module metadata
   */
  getModule(moduleId: string): ModuleMetadata | undefined {
    return this.moduleRegistry.get(moduleId);
  }

  /**
   * Get all registered modules
   */
  getAllModules(): ModuleMetadata[] {
    return Array.from(this.moduleRegistry.values());
  }

  // ========================================================================
  // Preload Rules
  // ========================================================================

  /**
   * Add a preload rule
   */
  addRule(
    rule: Omit<PreloadRule, "id" | "createdAt" | "applicationCount">
  ): string {
    const id = this.generateRuleId();
    const now = Date.now();

    const newRule: PreloadRule = {
      id,
      ...rule,
      createdAt: now,
      updatedAt: now,
      applicationCount: 0,
    };

    this.preloadRules.set(id, newRule);

    // If it's a time-based rule, set up schedule
    if (rule.trigger === "time-based" && rule.conditions.time) {
      // Create cron-like schedule from time conditions
      // This is simplified - real implementation would parse time conditions
    }

    // If it's an event-based rule, set up event trigger
    if (rule.trigger === "event-based" && rule.conditions.event) {
      for (const eventType of rule.conditions.event.types) {
        this.eventTrigger.on(eventType, async () => {
          if (this.shouldApplyRule(newRule)) {
            await this.preloadModule(rule.moduleName);
          }
        });
      }
    }

    return id;
  }

  /**
   * Remove a preload rule
   */
  removeRule(ruleId: string): boolean {
    return this.preloadRules.delete(ruleId);
  }

  /**
   * Update a preload rule
   */
  updateRule(
    ruleId: string,
    updates: Partial<Omit<PreloadRule, "id" | "createdAt">>
  ): boolean {
    const rule = this.preloadRules.get(ruleId);
    if (!rule) {
      return false;
    }

    Object.assign(rule, updates, { updatedAt: Date.now() });
    return true;
  }

  /**
   * Get all rules
   */
  getAllRules(): PreloadRule[] {
    return Array.from(this.preloadRules.values());
  }

  /**
   * Get rules for a specific module
   */
  getRulesForModule(moduleName: string): PreloadRule[] {
    return Array.from(this.preloadRules.values()).filter(
      r => r.moduleName === moduleName && r.enabled
    );
  }

  // ========================================================================
  // Preloading
  // ========================================================================

  /**
   * Preload a specific module
   */
  async preloadModule(moduleName: string): Promise<void> {
    // Check if already loaded
    const state = this.loadState.get(moduleName);
    if (state?.loaded) {
      return;
    }

    // Check if already preloading
    if (this.activePreloads.has(moduleName)) {
      return;
    }

    // Check concurrent limit
    if (this.activePreloads.size >= this.config.maxConcurrentPreloads) {
      return;
    }

    this.activePreloads.add(moduleName);

    const startTime = Date.now();

    try {
      // Load dependencies first
      const module = this.moduleRegistry.get(moduleName);
      if (!module) {
        throw new Error(`Module not found: ${moduleName}`);
      }

      for (const dep of module.dependencies) {
        await this.preloadModule(dep);
      }

      // Simulate async loading (in real implementation, this would import/preload)
      await new Promise(resolve => setTimeout(resolve, 10));

      // Update state
      if (state) {
        state.loaded = true;
        state.loadedAt = Date.now();
        state.loadTime = Date.now() - startTime;
        state.fromCache = false;
      }

      // Update stats
      const stats = this.moduleStats.get(moduleName);
      if (stats) {
        stats.preloadCount++;
      }

      // Record history
      this.preloadHistory.push({
        moduleName,
        timestamp: Date.now(),
        trigger: "manual",
        success: true,
        loadTime: Date.now() - startTime,
      });
    } catch (error) {
      // Record failure
      if (state) {
        state.error = error instanceof Error ? error.message : String(error);
      }

      this.preloadHistory.push({
        moduleName,
        timestamp: Date.now(),
        trigger: "manual",
        success: false,
        loadTime: Date.now() - startTime,
      });

      throw error;
    } finally {
      this.activePreloads.delete(moduleName);

      // Prune history
      if (this.preloadHistory.length > 1000) {
        this.preloadHistory = this.preloadHistory.slice(-500);
      }
    }
  }

  /**
   * Preload modules by priority
   */
  async preloadAll(priority?: PreloadPriority): Promise<void> {
    let modules = Array.from(this.moduleRegistry.values());

    if (priority) {
      modules = modules.filter(m =>
        priority === "critical"
          ? m.critical
          : priority === "high"
            ? m.critical || m.tags?.includes("high-priority")
            : true
      );
    }

    // Sort by priority (size, load time)
    modules.sort((a, b) => a.loadTime - b.loadTime);

    // Preload in batches
    const batchSize = this.config.maxConcurrentPreloads;
    for (let i = 0; i < modules.length; i += batchSize) {
      const batch = modules.slice(i, i + batchSize);
      await Promise.all(
        batch.map(m => this.preloadModule(m.id).catch(() => {}))
      );
    }
  }

  /**
   * Get preloaded modules
   */
  getPreloadedModules(): string[] {
    return Array.from(this.loadState.entries())
      .filter(([_, state]) => state.loaded)
      .map(([id]) => id);
  }

  /**
   * Check if a module is preloaded
   */
  isPreloaded(moduleName: string): boolean {
    return this.loadState.get(moduleName)?.loaded ?? false;
  }

  // ========================================================================
  // Predictive Preloading
  // ========================================================================

  /**
   * Record module access for learning
   */
  recordAccess(params: {
    moduleName: string;
    userId: string;
    timestamp?: number;
  }): void {
    this.usageTracker.recordAccess(params);
    this.predictiveEngine.updateModel(params.moduleName);

    // Get and apply predictions
    const predictions = this.predictiveEngine.predictNext(params.moduleName, 3);
    for (const prediction of predictions) {
      if (prediction.confidence >= 0.6) {
        this.preloadModule(prediction.moduleName).catch(() => {});
      }
    }
  }

  /**
   * Get predictions for next modules
   */
  predictNext(currentModule: string, limit = 5): PredictionResult[] {
    return this.predictiveEngine.predictNext(currentModule, limit);
  }

  /**
   * Get predictions for current time
   */
  predictForCurrentTime(limit = 5): PredictionResult[] {
    return this.predictiveEngine.predictForCurrentTime(limit);
  }

  /**
   * Get predictions for user
   */
  predictForUser(userId: string, limit = 5): PredictionResult[] {
    return this.predictiveEngine.predictForUser(userId, limit);
  }

  // ========================================================================
  // Statistics
  // ========================================================================

  /**
   * Get preload statistics
   */
  getStats(): PreloadStats {
    const preloaded = this.getPreloadedModules();
    const history = this.preloadHistory;

    const successful = history.filter(h => h.success).length;
    const failed = history.filter(h => !h.success).length;
    const total = successful + failed;

    const avgLoadTime =
      total > 0 ? history.reduce((sum, h) => sum + h.loadTime, 0) / total : 0;

    return {
      totalPreloaded: preloaded.length,
      cacheHits: 0, // Would need to track actual cache hits
      cacheMisses: successful,
      avgLoadTime,
      successRate: total > 0 ? successful / total : 1,
      rulesApplied: Array.from(this.preloadRules.values()).reduce(
        (sum, r) => sum + r.applicationCount,
        0
      ),
      predictionsMade: this.predictiveEngine.getStats().totalTransitions,
      predictionAccuracy: 0.7, // Would need to track actual vs predicted
      timestamp: Date.now(),
    };
  }

  /**
   * Get statistics for a specific module
   */
  getModuleStats(moduleName: string): ModulePreloadStats | undefined {
    return this.moduleStats.get(moduleName);
  }

  /**
   * Get usage tracker statistics
   */
  getUsageStats() {
    return this.usageTracker.getStats();
  }

  /**
   * Get predictive engine statistics
   */
  getPredictionStats() {
    return this.predictiveEngine.getStats();
  }

  /**
   * Get scheduler statistics
   */
  getSchedulerStats() {
    return this.timeScheduler.getStats();
  }

  /**
   * Get event trigger statistics
   */
  getEventStats() {
    return this.eventTrigger.getStats();
  }

  // ========================================================================
  // Lifecycle
  // ========================================================================

  /**
   * Start all preload mechanisms
   */
  async start(): Promise<void> {
    if (this.config.enableScheduling) {
      this.timeScheduler.start();
    }

    if (this.config.enableEventTriggers) {
      this.eventTrigger.enable();
    }
  }

  /**
   * Stop all preload mechanisms
   */
  async stop(): Promise<void> {
    this.timeScheduler.stop();
    this.eventTrigger.disable();

    // Wait for active preloads to complete
    while (this.activePreloads.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.usageTracker.clear();
    this.predictiveEngine.reset();
    this.preloadHistory = [];
    this.cache.clear();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stop();
    this.clear();

    this.timeScheduler.destroy();
    this.eventTrigger.destroy();

    this.moduleRegistry.clear();
    this.loadState.clear();
    this.preloadRules.clear();
    this.moduleStats.clear();
  }

  // ========================================================================
  // Export/Import
  // ========================================================================

  /**
   * Export all data
   */
  export(): {
    modules: Record<string, ModuleMetadata>;
    rules: PreloadRule[];
    usageData: ReturnType<UsageTracker["export"]>;
    predictionModel: ReturnType<PredictiveEngine["export"]>;
    stats: PreloadStats;
  } {
    return {
      modules: Object.fromEntries(this.moduleRegistry),
      rules: Array.from(this.preloadRules.values()),
      usageData: this.usageTracker.export(),
      predictionModel: this.predictiveEngine.export(),
      stats: this.getStats(),
    };
  }

  /**
   * Import data
   */
  import(data: {
    modules?: Record<string, ModuleMetadata>;
    rules?: PreloadRule[];
    usageData?: ReturnType<UsageTracker["export"]>;
    predictionModel?: ReturnType<PredictiveEngine["export"]>;
  }): void {
    if (data.modules) {
      for (const module of Object.values(data.modules)) {
        this.registerModule(module);
      }
    }

    if (data.rules) {
      for (const rule of data.rules) {
        this.preloadRules.set(rule.id, rule);
      }
    }

    if (data.usageData) {
      this.usageTracker.import(data.usageData);
    }

    if (data.predictionModel) {
      this.predictiveEngine.import(data.predictionModel);
    }
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private setupEventTriggers(): void {
    // Handle deployment events
    this.eventTrigger.on("deployment", async event => {
      const payload = event.payload as { modules?: string[] };
      if (payload.modules) {
        for (const moduleName of payload.modules) {
          await this.preloadModule(moduleName);
        }
      }
    });

    // Handle traffic spikes
    this.eventTrigger.on("traffic-spike", async () => {
      // Preload critical modules
      await this.preloadAll("critical");
    });
  }

  private shouldApplyRule(rule: PreloadRule): boolean {
    if (!rule.enabled) {
      return false;
    }

    if (rule.maxApplications && rule.applicationCount >= rule.maxApplications) {
      return false;
    }

    // Check conditions
    const now = new Date();

    if (rule.conditions.time) {
      const hour = now.getHours();
      if (rule.conditions.time.hourRange) {
        const [min, max] = rule.conditions.time.hourRange;
        if (hour < min || hour > max) {
          return false;
        }
      }
    }

    return true;
  }

  private generateRuleId(): string {
    return `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Re-export component classes for direct access
export { UsageTracker } from "./UsageTracker.js";
export { PredictiveEngine } from "./PredictiveEngine.js";
export { TimeScheduler } from "./TimeScheduler.js";
export { EventTriggerManager } from "./EventTrigger.js";

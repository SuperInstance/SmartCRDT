/**
 * Event Trigger - Event-based module preloading
 *
 * Listens for events (deployment, traffic spike, etc.) and triggers
 * module preloading based on configured event handlers.
 */

import type {
  PreloadEvent,
  EventTriggerConfig,
  EventTriggerResult,
  EventTriggerManagerConfig,
  EventListener,
  ModuleMetadata,
} from "./types.js";

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_MANAGER_CONFIG: EventTriggerManagerConfig = {
  enabled: true,
  maxConcurrentHandlers: 5,
  eventTimeout: 10000, // 10 seconds
  defaultDebounceTime: 1000,
  defaultThrottleTime: 5000,
};

// ============================================================================
// Event Trigger Manager Class
// ============================================================================

export class EventTriggerManager {
  private config: EventTriggerManagerConfig;
  private triggers: Map<string, EventTriggerConfig>;
  private moduleRegistry: Map<string, ModuleMetadata>;
  private listeners: Map<string, Set<EventListener>>;
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>>;
  private throttleTimestamps: Map<string, number>;
  private triggerCounts: Map<string, number>;
  private runningHandlers: Set<string>;
  private eventHistory: PreloadEvent[];
  private executionHistory: EventTriggerResult[];

  constructor(config: Partial<EventTriggerManagerConfig> = {}) {
    this.config = { ...DEFAULT_MANAGER_CONFIG, ...config };
    this.triggers = new Map();
    this.moduleRegistry = new Map();
    this.listeners = new Map();
    this.debounceTimers = new Map();
    this.throttleTimestamps = new Map();
    this.triggerCounts = new Map();
    this.runningHandlers = new Set();
    this.eventHistory = [];
    this.executionHistory = [];
  }

  // ========================================================================
  // Module Management
  // ========================================================================

  /**
   * Register a module for event-based preloading
   */
  registerModule(metadata: ModuleMetadata): void {
    this.moduleRegistry.set(metadata.id, metadata);
  }

  /**
   * Unregister a module
   */
  unregisterModule(moduleId: string): void {
    this.moduleRegistry.delete(moduleId);
  }

  /**
   * Get all registered modules
   */
  getAllModules(): ModuleMetadata[] {
    return Array.from(this.moduleRegistry.values());
  }

  // ========================================================================
  // Trigger Management
  // ========================================================================

  /**
   * Add an event trigger
   */
  addTrigger(config: EventTriggerConfig): string {
    const triggerId = this.generateTriggerId(config.eventType);

    const trigger: EventTriggerConfig = {
      ...config,
      id: triggerId,
      enabled: config.enabled ?? true,
    };

    this.triggers.set(triggerId, trigger);
    this.triggerCounts.set(triggerId, 0);

    return triggerId;
  }

  /**
   * Remove an event trigger
   */
  removeTrigger(triggerId: string): boolean {
    return this.triggers.delete(triggerId);
  }

  /**
   * Update an event trigger
   */
  updateTrigger(
    triggerId: string,
    updates: Partial<EventTriggerConfig>
  ): boolean {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) {
      return false;
    }

    Object.assign(trigger, updates);
    return true;
  }

  /**
   * Get an event trigger
   */
  getTrigger(triggerId: string): EventTriggerConfig | undefined {
    return this.triggers.get(triggerId);
  }

  /**
   * Get all triggers for an event type
   */
  getTriggersForEvent(eventType: string): EventTriggerConfig[] {
    return Array.from(this.triggers.values()).filter(
      t => t.eventType === eventType && t.enabled
    );
  }

  /**
   * Get all triggers
   */
  getAllTriggers(): EventTriggerConfig[] {
    return Array.from(this.triggers.values());
  }

  // ========================================================================
  // Event Handling
  // ========================================================================

  /**
   * Register an event listener
   */
  on(eventType: string, listener: EventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    this.listeners.get(eventType)!.add(listener);

    // Return unsubscribe function
    return () => this.off(eventType, listener);
  }

  /**
   * Unregister an event listener
   */
  off(eventType: string, listener: EventListener): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Emit an event
   */
  async emit(event: PreloadEvent): Promise<EventTriggerResult[]> {
    if (!this.config.enabled) {
      return [];
    }

    // Record event history
    this.eventHistory.push(event);
    if (this.eventHistory.length > 1000) {
      this.eventHistory = this.eventHistory.slice(-500);
    }

    // Notify listeners
    await this.notifyListeners(event);

    // Process triggers
    return await this.processTriggers(event);
  }

  /**
   * Emit a simple event (convenience method)
   */
  async emitSimple(
    type: string,
    payload: Record<string, any> = {},
    source = "system"
  ): Promise<EventTriggerResult[]> {
    return this.emit({
      type,
      timestamp: Date.now(),
      payload,
      source,
    });
  }

  // ========================================================================
  // Built-in Event Handlers
  // ========================================================================

  /**
   * Handle deployment event
   */
  async onDeployment(deployment: {
    service: string;
    version: string;
    modules?: string[];
  }): Promise<EventTriggerResult[]> {
    return this.emitSimple("deployment", deployment, "deployment-system");
  }

  /**
   * Handle traffic spike event
   */
  async onTrafficSpike(spike: {
    currentRPS: number;
    baselineRPS: number;
    threshold: number;
  }): Promise<EventTriggerResult[]> {
    return this.emitSimple("traffic-spike", spike, "monitoring-system");
  }

  /**
   * Handle user activity event
   */
  async onUserActivity(activity: {
    userId: string;
    action: string;
    module?: string;
  }): Promise<EventTriggerResult[]> {
    return this.emitSimple("user-activity", activity, "user-tracker");
  }

  /**
   * Handle time-based event
   */
  async onTimeEvent(timeEvent: {
    hour: number;
    dayOfWeek: number;
    timeZone?: string;
  }): Promise<EventTriggerResult[]> {
    return this.emitSimple("time-event", timeEvent, "scheduler");
  }

  // ========================================================================
  // Statistics & History
  // ========================================================================

  /**
   * Get event history
   */
  getEventHistory(limit = 100, eventType?: string): PreloadEvent[] {
    let history = this.eventHistory;

    if (eventType) {
      history = history.filter(e => e.type === eventType);
    }

    return history.slice(-limit);
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit = 100): EventTriggerResult[] {
    return this.executionHistory.slice(-limit);
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalTriggers: number;
    activeTriggers: number;
    totalEvents: number;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    avgProcessingTime: number;
    topEventTypes: Array<{ type: string; count: number }>;
  } {
    const eventTypeCounts = new Map<string, number>();
    for (const event of this.eventHistory) {
      const count = eventTypeCounts.get(event.type) || 0;
      eventTypeCounts.set(event.type, count + 1);
    }

    const successful = this.executionHistory.filter(r => r.success).length;
    const failed = this.executionHistory.filter(r => !r.success).length;

    const avgProcessingTime =
      this.executionHistory.length > 0
        ? this.executionHistory.reduce((sum, r) => sum + r.processingTime, 0) /
          this.executionHistory.length
        : 0;

    const topEventTypes = Array.from(eventTypeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalTriggers: this.triggers.size,
      activeTriggers: Array.from(this.triggers.values()).filter(t => t.enabled)
        .length,
      totalEvents: this.eventHistory.length,
      totalExecutions: this.executionHistory.length,
      successfulExecutions: successful,
      failedExecutions: failed,
      avgProcessingTime,
      topEventTypes,
    };
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.eventHistory = [];
    this.executionHistory = [];
  }

  // ========================================================================
  // Lifecycle
  // ========================================================================

  /**
   * Enable the event trigger manager
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * Disable the event trigger manager
   */
  disable(): void {
    this.config.enabled = false;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Clear all timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Clear all state
    this.triggers.clear();
    this.listeners.clear();
    this.throttleTimestamps.clear();
    this.triggerCounts.clear();
    this.eventHistory = [];
    this.executionHistory = [];
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private async notifyListeners(event: PreloadEvent): Promise<void> {
    const listeners = this.listeners.get(event.type);
    if (!listeners) {
      return;
    }

    const promises = Array.from(listeners).map(async listener => {
      try {
        await listener(event);
      } catch (error) {
        console.error(`Error in event listener for ${event.type}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  private async processTriggers(
    event: PreloadEvent
  ): Promise<EventTriggerResult[]> {
    const triggers = this.getTriggersForEvent(event.type);
    if (triggers.length === 0) {
      return [];
    }

    const results: EventTriggerResult[] = [];

    for (const trigger of triggers) {
      // Check filter conditions
      if (
        trigger.filter &&
        !this.matchesFilter(event.payload, trigger.filter)
      ) {
        continue;
      }

      // Check debounce
      if (!this.canExecuteDebounced(trigger)) {
        continue;
      }

      // Check throttle
      if (!this.canExecuteThrottled(trigger)) {
        continue;
      }

      // Check max triggers
      if (trigger.maxTriggers !== undefined) {
        const count = this.triggerCounts.get(trigger.id!) || 0;
        if (count >= trigger.maxTriggers) {
          continue;
        }
      }

      // Execute trigger
      const result = await this.executeTrigger(trigger, event);
      results.push(result);
    }

    return results;
  }

  private matchesFilter(
    payload: Record<string, any>,
    filter: Record<string, any>
  ): boolean {
    for (const [key, value] of Object.entries(filter)) {
      if (payload[key] !== value) {
        return false;
      }
    }
    return true;
  }

  private canExecuteDebounced(trigger: EventTriggerConfig): boolean {
    const triggerId = trigger.id!;

    // Clear existing timer
    const existingTimer = this.debounceTimers.get(triggerId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // If debounce is set, we need to wait
    // For simplicity, we'll execute immediately and let debouncing be handled at the trigger level
    return true;
  }

  private canExecuteThrottled(trigger: EventTriggerConfig): boolean {
    const triggerId = trigger.id!;
    const throttleTime =
      trigger.throttleTime ?? this.config.defaultThrottleTime;
    const lastExecution = this.throttleTimestamps.get(triggerId) || 0;
    const now = Date.now();

    if (now - lastExecution < throttleTime) {
      return false;
    }

    this.throttleTimestamps.set(triggerId, now);
    return true;
  }

  private async executeTrigger(
    trigger: EventTriggerConfig,
    event: PreloadEvent
  ): Promise<EventTriggerResult> {
    const triggerId = trigger.id!;
    const startTime = Date.now();

    // Check concurrent limit
    if (this.runningHandlers.size >= this.config.maxConcurrentHandlers) {
      return {
        triggerId,
        event,
        modulesPreloaded: [],
        success: false,
        processingTime: Date.now() - startTime,
      };
    }

    this.runningHandlers.add(triggerId);

    try {
      // Execute with timeout
      const modulesPreloaded = await this.executeWithTimeout(trigger, event);

      // Update trigger count
      const count = (this.triggerCounts.get(triggerId) || 0) + 1;
      this.triggerCounts.set(triggerId, count);

      const result: EventTriggerResult = {
        triggerId,
        event,
        modulesPreloaded,
        success: true,
        processingTime: Date.now() - startTime,
      };

      this.executionHistory.push(result);
      return result;
    } catch (error) {
      const result: EventTriggerResult = {
        triggerId,
        event,
        modulesPreloaded: [],
        success: false,
        processingTime: Date.now() - startTime,
      };

      this.executionHistory.push(result);
      return result;
    } finally {
      this.runningHandlers.delete(triggerId);
    }
  }

  private async executeWithTimeout(
    trigger: EventTriggerConfig,
    event: PreloadEvent
  ): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Event handler timeout"));
      }, this.config.eventTimeout);

      this.doExecuteTrigger(trigger, event)
        .then(modules => {
          clearTimeout(timer);
          resolve(modules);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private async doExecuteTrigger(
    trigger: EventTriggerConfig,
    event: PreloadEvent
  ): Promise<string[]> {
    // In a real implementation, this would:
    // 1. Determine which modules to preload based on the event
    // 2. Actually preload those modules
    // 3. Return the list of preloaded modules

    // For now, return a placeholder list
    // In practice, you'd have a mapping from event types to modules
    const modulesToPreload = this.determineModulesForEvent(event);

    const preloaded: string[] = [];
    for (const moduleId of modulesToPreload) {
      const module = this.moduleRegistry.get(moduleId);
      if (module) {
        // Simulate preloading
        await this.preloadModule(module);
        preloaded.push(moduleId);
      }
    }

    return preloaded;
  }

  private determineModulesForEvent(event: PreloadEvent): string[] {
    // Determine which modules to preload based on event type and payload
    // This is a placeholder - in practice, you'd have configuration for this

    switch (event.type) {
      case "deployment":
        const deployment = event.payload as {
          service: string;
          modules?: string[];
        };
        return deployment.modules || [];

      case "traffic-spike":
        // Preload high-demand modules during traffic spikes
        return Array.from(this.moduleRegistry.keys())
          .filter(id => this.moduleRegistry.get(id)?.critical)
          .slice(0, 5);

      case "user-activity":
        const activity = event.payload as { module?: string };
        if (activity.module) {
          return [activity.module];
        }
        return [];

      default:
        return [];
    }
  }

  private async preloadModule(module: ModuleMetadata): Promise<void> {
    // Simulate async preload
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  private generateTriggerId(eventType: string): string {
    return `trigger-${eventType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

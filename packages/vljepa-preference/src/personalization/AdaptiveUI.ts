/**
 * AdaptiveUI - Dynamically adapts UI based on real-time user behavior
 */

import type {
  UserPreferences,
  UIState,
  UIContext,
  Interaction,
} from "../types.js";

export interface AdaptiveRule {
  id: string;
  name: string;
  condition: (
    context: UIContext,
    state: UIState,
    recentInteractions: Interaction[]
  ) => boolean;
  action: (state: UIState) => UIState;
  priority: number;
  cooldown: number; // ms
  lastTriggered?: number;
}

export interface AdaptiveConfig {
  enabled: boolean;
  responseDelay: number; // ms to wait before applying changes
  minConfidence: number;
  maxChangesPerSession: number;
}

export class AdaptiveUI {
  private rules: AdaptiveRule[] = [];
  private config: AdaptiveConfig;
  private activeAdaptations: Map<string, AdaptationRecord[]> = new Map();
  private interactionBuffer: Map<string, Interaction[]> = new Map();
  private sessionChangeCounts: Map<string, number> = new Map();

  constructor(config: Partial<AdaptiveConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      responseDelay: config.responseDelay ?? 1000,
      minConfidence: config.minConfidence ?? 0.6,
      maxChangesPerSession: config.maxChangesPerSession ?? 10,
    };

    this.initializeDefaultRules();
  }

  /**
   * Process interaction and potentially trigger adaptations
   */
  processInteraction(
    userId: string,
    interaction: Interaction,
    currentState: UIState,
    preferences: UserPreferences | undefined
  ): UIState | null {
    if (!this.config.enabled) {
      return null;
    }

    // Add to buffer
    if (!this.interactionBuffer.has(userId)) {
      this.interactionBuffer.set(userId, []);
    }

    const buffer = this.interactionBuffer.get(userId)!;
    buffer.push(interaction);

    // Keep buffer size manageable
    if (buffer.length > 100) {
      buffer.splice(0, buffer.length - 100);
    }

    // Check if any rules should trigger
    const applicableRules = this.findApplicableRules(
      interaction.context,
      currentState,
      buffer,
      preferences
    );

    if (applicableRules.length === 0) {
      return null;
    }

    // Sort by priority and apply highest priority rule
    applicableRules.sort((a, b) => b.priority - a.priority);
    const rule = applicableRules[0]!;

    // Check cooldown
    if (rule.lastTriggered && Date.now() - rule.lastTriggered < rule.cooldown) {
      return null;
    }

    // Check session change limit
    const changeCount = this.sessionChangeCounts.get(userId) ?? 0;
    if (changeCount >= this.config.maxChangesPerSession) {
      return null;
    }

    // Apply rule with delay
    setTimeout(() => {
      const newState = rule.action(currentState);

      // Record adaptation
      this.recordAdaptation(userId, rule, currentState, newState);

      // Update change count
      this.sessionChangeCounts.set(userId, changeCount + 1);

      // Update rule last triggered
      rule.lastTriggered = Date.now();

      return newState;
    }, this.config.responseDelay);

    return null;
  }

  /**
   * Find applicable rules
   */
  private findApplicableRules(
    context: UIContext,
    state: UIState,
    recentInteractions: Interaction[],
    preferences: UserPreferences | undefined
  ): AdaptiveRule[] {
    const applicable: AdaptiveRule[] = [];

    for (const rule of this.rules) {
      try {
        if (rule.condition(context, state, recentInteractions)) {
          applicable.push(rule);
        }
      } catch (error) {
        console.error(`Error evaluating rule ${rule.id}:`, error);
      }
    }

    return applicable;
  }

  /**
   * Record adaptation
   */
  private recordAdaptation(
    userId: string,
    rule: AdaptiveRule,
    oldState: UIState,
    newState: UIState
  ): void {
    const record: AdaptationRecord = {
      userId,
      ruleId: rule.id,
      ruleName: rule.name,
      oldState,
      newState,
      timestamp: Date.now(),
    };

    if (!this.activeAdaptations.has(userId)) {
      this.activeAdaptations.set(userId, []);
    }

    this.activeAdaptations.get(userId)!.push(record);
  }

  /**
   * Initialize default adaptive rules
   */
  private initializeDefaultRules(): void {
    // Rage click detection -> simplify UI
    this.addRule({
      id: "rage-click-simplify",
      name: "Simplify UI on rage clicks",
      condition: (_context, _state, recentInteractions) => {
        const recentClicks = recentInteractions.filter(
          i => i.type === "click" && Date.now() - i.timestamp < 5000
        );

        // Rage click: 3+ clicks on similar elements
        const elementClicks = new Map<string, number>();
        for (const click of recentClicks) {
          const id = click.element.id;
          elementClicks.set(id, (elementClicks.get(id) ?? 0) + 1);
        }

        for (const count of elementClicks.values()) {
          if (count >= 3) return true;
        }

        return false;
      },
      action: state => ({
        ...state,
        layout: "stacked" as const,
        components: state.components.slice(0, 5),
      }),
      priority: 10,
      cooldown: 60000,
    });

    // Small screen detected -> switch to mobile layout
    this.addRule({
      id: "small-screen-mobile",
      name: "Switch to mobile layout on small screen",
      condition: (context, _state, _interactions) => {
        return context.viewport.width < 768;
      },
      action: state => ({
        ...state,
        layout: "stacked" as const,
      }),
      priority: 9,
      cooldown: 30000,
    });

    // Rapid scrolling -> increase spacing
    this.addRule({
      id: "rapid-scroll-spacing",
      name: "Increase spacing on rapid scroll",
      condition: (_context, _state, recentInteractions) => {
        const recentScrolls = recentInteractions.filter(
          i => i.type === "scroll" && Date.now() - i.timestamp < 3000
        );

        if (recentScrolls.length < 5) return false;

        // Check scroll velocity
        let totalDistance = 0;
        for (const scroll of recentScrolls) {
          if (scroll.duration) {
            totalDistance += scroll.duration;
          }
        }

        return totalDistance > 5000; // Scrolled 5000+px in 3s
      },
      action: state => ({
        ...state,
        styles: {
          ...state.styles,
          spacing: "spacious",
        },
      }),
      priority: 7,
      cooldown: 30000,
    });

    // Long dwell time on specific element -> show more info
    this.addRule({
      id: "long-dwell-detail",
      name: "Show details on long dwell",
      condition: (_context, _state, recentInteractions) => {
        const recentHovers = recentInteractions.filter(
          i => i.type === "hover" && Date.now() - i.timestamp < 10000
        );

        for (const hover of recentHovers) {
          if (hover.duration && hover.duration > 3000) {
            return true;
          }
        }

        return false;
      },
      action: state => ({
        ...state,
        components: [...state.components, "detail-panel"],
      }),
      priority: 6,
      cooldown: 15000,
    });

    // High error rate -> simplify form
    this.addRule({
      id: "error-simplify-form",
      name: "Simplify form on errors",
      condition: (_context, _state, recentInteractions) => {
        const recentInputs = recentInteractions.filter(
          i => i.type === "input" && Date.now() - i.timestamp < 10000
        );

        // Check for error indicators in metadata
        let errorCount = 0;
        for (const input of recentInputs) {
          if (input.metadata?.["error"]) {
            errorCount++;
          }
        }

        return errorCount >= 3;
      },
      action: state => ({
        ...state,
        layout: "stacked" as const,
        styles: {
          ...state.styles,
          spacing: "spacious",
        },
      }),
      priority: 8,
      cooldown: 45000,
    });
  }

  /**
   * Add a custom adaptive rule
   */
  addRule(rule: AdaptiveRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove a rule by ID
   */
  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex(r => r.id === ruleId);
    if (index >= 0) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all rules
   */
  getRules(): AdaptiveRule[] {
    return [...this.rules];
  }

  /**
   * Get adaptation history for user
   */
  getAdaptationHistory(userId: string): AdaptationRecord[] {
    return this.activeAdaptations.get(userId) ?? [];
  }

  /**
   * Clear interaction buffer for user
   */
  clearBuffer(userId: string): void {
    this.interactionBuffer.delete(userId);
  }

  /**
   * Reset session change count for user
   */
  resetSessionCount(userId: string): void {
    this.sessionChangeCounts.delete(userId);
  }

  /**
   * Set configuration
   */
  setConfig(config: Partial<AdaptiveConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get configuration
   */
  getConfig(): AdaptiveConfig {
    return { ...this.config };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.activeAdaptations.clear();
    this.interactionBuffer.clear();
    this.sessionChangeCounts.clear();
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalAdaptations: number;
    totalUsers: number;
    avgAdaptationsPerUser: number;
    activeRules: number;
  } {
    let totalAdaptations = 0;

    for (const adaptations of this.activeAdaptations.values()) {
      totalAdaptations += adaptations.length;
    }

    return {
      totalAdaptations,
      totalUsers: this.activeAdaptations.size,
      avgAdaptationsPerUser:
        this.activeAdaptations.size > 0
          ? totalAdaptations / this.activeAdaptations.size
          : 0,
      activeRules: this.rules.length,
    };
  }
}

export interface AdaptationRecord {
  userId: string;
  ruleId: string;
  ruleName: string;
  oldState: UIState;
  newState: UIState;
  timestamp: number;
}

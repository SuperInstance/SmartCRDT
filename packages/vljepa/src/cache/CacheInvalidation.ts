/**
 * CacheInvalidation - Intelligent cache invalidation strategies
 *
 * Manages cache invalidation based on multiple triggers:
 * - UI Structure Change: DOM modification invalidates cache
 * - Visual Change: Significant pixel difference
 * - User Interaction: Click, input, navigation
 * - Time-Based: TTL expiration
 * - Explicit: User clears cache
 *
 * Invalidation Rules:
 * - Structure changes: Invalidate single entry or related entries
 * - Visual changes: Use similarity threshold to determine scope
 * - Interactions: Invalidate based on interaction type
 * - Time: Automatic expiration based on TTL
 *
 * @version 1.0.0
 */

// ============================================================================
// INVALIDATION TYPES
// ============================================================================

/**
 * Invalidation trigger types
 */
export type InvalidationTrigger =
  | "structure"
  | "visual"
  | "interaction"
  | "time"
  | "explicit";

/**
 * Invalidation scope
 */
export type InvalidationScope = "single" | "related" | "all";

/**
 * Invalidation rule configuration
 */
export interface InvalidationRule {
  /** Trigger type */
  trigger: InvalidationTrigger;
  /** Sensitivity threshold (0-1, lower = more sensitive) */
  threshold: number;
  /** Scope of invalidation */
  scope: InvalidationScope;
  /** Additional trigger-specific options */
  options?: {
    /** For visual triggers: minimum pixel difference */
    minPixelDiff?: number;
    /** For interaction triggers: specific interaction types */
    interactionTypes?: string[];
    /** For structure triggers: specific element types */
    elementTypes?: string[];
  };
}

/**
 * Invalidation event
 */
export interface InvalidationEvent {
  /** Event type */
  type: string;
  /** Timestamp of invalidation */
  timestamp: number;
  /** Keys affected by this invalidation */
  keysAffected: string[];
  /** Reason for invalidation */
  reason: string;
  /** Scope of invalidation */
  scope: InvalidationScope;
  /** Trigger that caused this invalidation */
  trigger: InvalidationTrigger;
}

/**
 * Cache invalidation configuration
 */
export interface CacheInvalidationConfig {
  /** Invalidation rules for each trigger type */
  rules: Partial<Record<InvalidationTrigger, InvalidationRule>>;
  /** Enable automatic invalidation */
  automatic: boolean;
  /** Enable logging of invalidation events */
  logging: boolean;
  /** Maximum event history size */
  maxEventHistory: number;
}

// ============================================================================
// INVALIDATION TRIGGER HANDLERS
// ============================================================================

/**
 * Structure change detector
 *
 * Detects DOM structure changes that should invalidate cache.
 */
class StructureChangeDetector {
  private observer: MutationObserver | null = null;
  private lastStructure: string = "";

  /**
   * Start observing DOM changes
   */
  observe(
    root: Element,
    callback: (mutations: MutationRecord[]) => void
  ): void {
    this.observer = new MutationObserver(mutations => {
      const significantMutations = mutations.filter(m => this.isSignificant(m));
      if (significantMutations.length > 0) {
        callback(significantMutations);
      }
    });

    this.observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true,
    });

    this.lastStructure = this.getStructureHash(root);
  }

  /**
   * Stop observing
   */
  disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  /**
   * Check if mutation is significant enough to invalidate cache
   */
  private isSignificant(mutation: MutationRecord): boolean {
    // Type-specific checks
    switch (mutation.type) {
      case "childList":
        // Adding/removing elements is significant
        return (
          mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0
        );

      case "attributes":
        // Only certain attributes are significant
        const significantAttrs = ["class", "style", "id", "hidden"];
        return significantAttrs.includes(mutation.attributeName || "");

      default:
        return false;
    }
  }

  /**
   * Get structure hash for comparison
   */
  private getStructureHash(element: Element): string {
    const parts: string[] = [];
    parts.push(element.tagName.toLowerCase());

    for (const child of Array.from(element.children)) {
      parts.push(this.getStructureHash(child));
    }

    return parts.join("|");
  }

  /**
   * Calculate structural difference (0-1, higher = more different)
   */
  structuralDifference(oldStructure: string, newStructure: string): number {
    if (oldStructure === newStructure) return 0;

    // Simple Levenshtein-based distance
    const distance = this.levenshteinDistance(oldStructure, newStructure);
    const maxLen = Math.max(oldStructure.length, newStructure.length);
    return maxLen > 0 ? distance / maxLen : 0;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
    }

    return dp[m][n];
  }
}

/**
 * Visual change detector
 *
 * Detects significant visual changes using pixel comparison.
 */
class VisualChangeDetector {
  /**
   * Calculate visual difference between two image data (0-1, higher = more different)
   */
  visualDifference(oldImage: ImageData, newImage: ImageData): number {
    if (
      oldImage.width !== newImage.width ||
      oldImage.height !== newImage.height
    ) {
      return 1.0; // Complete difference if size differs
    }

    const { data: oldData } = oldImage;
    const { data: newData } = newImage;
    let totalDiff = 0;
    const pixelCount = oldImage.width * oldImage.height;

    for (let i = 0; i < oldData.length; i += 4) {
      const rDiff = Math.abs(oldData[i] - newData[i]);
      const gDiff = Math.abs(oldData[i + 1] - newData[i + 1]);
      const bDiff = Math.abs(oldData[i + 2] - newData[i + 2]);
      const aDiff = Math.abs(oldData[i + 3] - newData[i + 3]);

      // Perceived difference
      totalDiff += (0.299 * rDiff + 0.587 * gDiff + 0.114 * bDiff + aDiff) / 4;
    }

    const maxDiff = 255 * pixelCount;
    return maxDiff > 0 ? totalDiff / maxDiff : 0;
  }

  /**
   * Determine if visual difference exceeds threshold
   */
  shouldInvalidate(
    oldImage: ImageData,
    newImage: ImageData,
    threshold: number
  ): boolean {
    const diff = this.visualDifference(oldImage, newImage);
    return diff >= threshold;
  }
}

/**
 * User interaction detector
 *
 * Detects user interactions that should invalidate cache.
 */
class UserInteractionDetector {
  private listeners: Array<() => void> = [];
  private interactionHistory: Array<{
    type: string;
    timestamp: number;
    target: string;
  }> = [];

  /**
   * Start listening for user interactions
   */
  listen(
    root: Element,
    callback: (interaction: { type: string; target: string }) => void
  ): void {
    const interactions = ["click", "input", "change", "submit", "keydown"];

    for (const interaction of interactions) {
      const handler = (event: Event) => {
        const target = this.eventToSelector(event);
        this.recordInteraction(interaction, target);

        // Check if this interaction should invalidate cache
        if (this.shouldInvalidate(interaction, target)) {
          callback({ type: interaction, target });
        }
      };

      root.addEventListener(interaction, handler as EventListener);
      this.listeners.push(() =>
        root.removeEventListener(interaction, handler as EventListener)
      );
    }
  }

  /**
   * Stop listening
   */
  disconnect(): void {
    for (const listener of this.listeners) {
      listener();
    }
    this.listeners = [];
  }

  /**
   * Record interaction for analysis
   */
  private recordInteraction(type: string, target: string): void {
    this.interactionHistory.push({
      type,
      timestamp: Date.now(),
      target,
    });

    // Keep only recent history (last 100 interactions)
    if (this.interactionHistory.length > 100) {
      this.interactionHistory.shift();
    }
  }

  /**
   * Determine if interaction should invalidate cache
   */
  private shouldInvalidate(type: string, target: string): boolean {
    // Invalidate on form interactions
    if (type === "submit" || type === "input" || type === "change") {
      return true;
    }

    // Invalidate on clicks on interactive elements
    if (type === "click") {
      const interactiveSelectors = [
        "button",
        "a",
        "input",
        "select",
        "textarea",
      ];
      return interactiveSelectors.some(sel => target.includes(sel));
    }

    return false;
  }

  /**
   * Convert event to CSS selector
   */
  private eventToSelector(event: Event): string {
    const target = event.target as HTMLElement;
    if (!target) return "";

    // Generate simple selector
    if (target.id) {
      return `#${target.id}`;
    }

    if (target.className) {
      const classes = target.className
        .split(" ")
        .filter(c => c)
        .join(".");
      if (classes) {
        return `${target.tagName.toLowerCase()}.${classes}`;
      }
    }

    return target.tagName.toLowerCase();
  }

  /**
   * Get interaction history
   */
  getHistory(): Array<{ type: string; timestamp: number; target: string }> {
    return [...this.interactionHistory];
  }
}

// ============================================================================
// CACHE INVALIDATION (Main Class)
// ============================================================================

/**
 * Cache Invalidation Manager
 *
 * Coordinates all invalidation triggers and manages cache entry removal.
 */
export class CacheInvalidation {
  private config: CacheInvalidationConfig;
  private eventHistory: InvalidationEvent[] = [];
  private structureDetector: StructureChangeDetector;
  private visualDetector: VisualChangeDetector;
  private interactionDetector: UserInteractionDetector;
  private keys: Map<
    string,
    { timestamp: number; structure: string; image?: ImageData }
  > = new Map();

  constructor(config?: Partial<CacheInvalidationConfig>) {
    this.config = {
      rules: {
        structure: {
          trigger: "structure",
          threshold: 0.1,
          scope: "related",
        },
        visual: {
          trigger: "visual",
          threshold: 0.05,
          scope: "single",
        },
        interaction: {
          trigger: "interaction",
          threshold: 0.5,
          scope: "single",
          options: {
            interactionTypes: ["click", "input", "submit"],
          },
        },
        time: {
          trigger: "time",
          threshold: 0,
          scope: "single",
        },
        explicit: {
          trigger: "explicit",
          threshold: 0,
          scope: "all",
        },
      },
      automatic: false,
      logging: false,
      maxEventHistory: 1000,
      ...config,
    };

    this.structureDetector = new StructureChangeDetector();
    this.visualDetector = new VisualChangeDetector();
    this.interactionDetector = new UserInteractionDetector();
  }

  /**
   * Get all triggers managed by this invalidator
   */
  get triggers(): InvalidationTrigger[] {
    return Object.keys(this.config.rules) as InvalidationTrigger[];
  }

  /**
   * Invalidate cache entries based on trigger
   */
  async invalidate(
    trigger: InvalidationTrigger,
    context?: {
      key?: string;
      element?: Element;
      oldImage?: ImageData;
      newImage?: ImageData;
      interaction?: { type: string; target: string };
    }
  ): Promise<InvalidationEvent[]> {
    const rule = this.config.rules[trigger];
    if (!rule) {
      return [];
    }

    const events: InvalidationEvent[] = [];

    switch (trigger) {
      case "structure":
        events.push(
          ...(await this.invalidateStructure(rule, context?.element))
        );
        break;

      case "visual":
        events.push(...(await this.invalidateVisual(rule, context)));
        break;

      case "interaction":
        events.push(
          ...(await this.invalidateInteraction(rule, context?.interaction))
        );
        break;

      case "time":
        events.push(...(await this.invalidateTime(rule)));
        break;

      case "explicit":
        events.push(...(await this.invalidateExplicit(rule)));
        break;
    }

    // Add to history
    for (const event of events) {
      this.addEventToHistory(event);
    }

    return events;
  }

  /**
   * Invalidate based on structure change
   */
  private async invalidateStructure(
    rule: InvalidationRule,
    element?: Element
  ): Promise<InvalidationEvent[]> {
    if (!element) {
      return [];
    }

    const events: InvalidationEvent[] = [];

    // Get all keys that might be affected
    const affectedKeys = this.findAffectedKeys(rule.scope, element);

    if (affectedKeys.length > 0) {
      events.push({
        type: "structure_change",
        timestamp: Date.now(),
        keysAffected: affectedKeys,
        reason: "DOM structure changed",
        scope: rule.scope,
        trigger: "structure",
      });
    }

    return events;
  }

  /**
   * Invalidate based on visual change
   */
  private async invalidateVisual(
    rule: InvalidationRule,
    context?: {
      key?: string;
      oldImage?: ImageData;
      newImage?: ImageData;
    }
  ): Promise<InvalidationEvent[]> {
    if (!context?.oldImage || !context?.newImage) {
      return [];
    }

    const events: InvalidationEvent[] = [];

    const shouldInvalidate = this.visualDetector.shouldInvalidate(
      context.oldImage,
      context.newImage,
      rule.threshold
    );

    if (shouldInvalidate) {
      const affectedKeys = context.key
        ? [context.key]
        : this.findSimilarVisualKeys(
            context.oldImage,
            context.newImage,
            rule.threshold
          );

      events.push({
        type: "visual_change",
        timestamp: Date.now(),
        keysAffected: affectedKeys,
        reason: `Visual difference exceeded threshold (${rule.threshold})`,
        scope: rule.scope,
        trigger: "visual",
      });
    }

    return events;
  }

  /**
   * Invalidate based on user interaction
   */
  private async invalidateInteraction(
    rule: InvalidationRule,
    interaction?: { type: string; target: string }
  ): Promise<InvalidationEvent[]> {
    if (!interaction) {
      return [];
    }

    const events: InvalidationEvent[] = [];

    // Find keys affected by this interaction
    const affectedKeys = this.findKeysByTarget(interaction.target, rule.scope);

    if (affectedKeys.length > 0) {
      events.push({
        type: "user_interaction",
        timestamp: Date.now(),
        keysAffected: affectedKeys,
        reason: `User interaction: ${interaction.type} on ${interaction.target}`,
        scope: rule.scope,
        trigger: "interaction",
      });
    }

    return events;
  }

  /**
   * Invalidate based on time (TTL expiration)
   */
  private async invalidateTime(
    rule: InvalidationRule
  ): Promise<InvalidationEvent[]> {
    const events: InvalidationEvent[] = [];
    const now = Date.now();

    // Find expired entries
    const expiredKeys: string[] = [];
    for (const [key, data] of this.keys) {
      const age = (now - data.timestamp) / 1000;
      // Assume 1 hour TTL if not specified
      if (age > 3600) {
        expiredKeys.push(key);
      }
    }

    if (expiredKeys.length > 0) {
      events.push({
        type: "ttl_expiration",
        timestamp: now,
        keysAffected: expiredKeys,
        reason: "TTL expired",
        scope: rule.scope,
        trigger: "time",
      });

      // Remove expired keys
      for (const key of expiredKeys) {
        this.keys.delete(key);
      }
    }

    return events;
  }

  /**
   * Explicit invalidation (user requested)
   */
  private async invalidateExplicit(
    rule: InvalidationRule
  ): Promise<InvalidationEvent[]> {
    const events: InvalidationEvent[] = [];

    events.push({
      type: "explicit_clear",
      timestamp: Date.now(),
      keysAffected: Array.from(this.keys.keys()),
      reason: "User requested cache clear",
      scope: rule.scope,
      trigger: "explicit",
    });

    // Clear all keys
    this.keys.clear();

    return events;
  }

  /**
   * Find keys affected by structure change
   */
  private findAffectedKeys(
    scope: InvalidationScope,
    element: Element
  ): string[] {
    if (scope === "all") {
      return Array.from(this.keys.keys());
    }

    if (scope === "related") {
      // Find keys related to this element
      const selector = this.elementToSelector(element);
      return Array.from(this.keys.keys()).filter(
        key =>
          key.includes(selector) ||
          this.keys.get(key)?.structure.includes(selector)
      );
    }

    // scope === 'single'
    const selector = this.elementToSelector(element);
    return Array.from(this.keys.keys()).filter(key => key === selector);
  }

  /**
   * Find keys with similar visual content
   */
  private findSimilarVisualKeys(
    oldImage: ImageData,
    newImage: ImageData,
    threshold: number
  ): string[] {
    const similar: string[] = [];

    for (const [key, data] of this.keys) {
      if (data.image) {
        const diff = this.visualDetector.visualDifference(data.image, newImage);
        if (diff >= threshold) {
          similar.push(key);
        }
      }
    }

    return similar;
  }

  /**
   * Find keys by target selector
   */
  private findKeysByTarget(target: string, scope: InvalidationScope): string[] {
    if (scope === "all") {
      return Array.from(this.keys.keys());
    }

    if (scope === "related") {
      return Array.from(this.keys.keys()).filter(key => key.includes(target));
    }

    return [target];
  }

  /**
   * Convert element to CSS selector
   */
  private elementToSelector(element: Element): string {
    if (element.id) {
      return `#${element.id}`;
    }

    if (element.className) {
      const classes = element.className
        .split(" ")
        .filter(c => c)
        .join(".");
      return `${element.tagName.toLowerCase()}.${classes}`;
    }

    return element.tagName.toLowerCase();
  }

  /**
   * Add event to history
   */
  private addEventToHistory(event: InvalidationEvent): void {
    this.eventHistory.push(event);

    // Trim history if needed
    if (this.eventHistory.length > this.config.maxEventHistory) {
      this.eventHistory.shift();
    }

    // Log if enabled
    if (this.config.logging) {
      console.log("[CacheInvalidation]", event);
    }
  }

  /**
   * Register a cache key
   */
  registerKey(
    key: string,
    data: { structure: string; image?: ImageData }
  ): void {
    this.keys.set(key, {
      timestamp: Date.now(),
      structure: data.structure,
      image: data.image,
    });
  }

  /**
   * Unregister a cache key
   */
  unregisterKey(key: string): void {
    this.keys.delete(key);
  }

  /**
   * Get event history
   */
  getEventHistory(): InvalidationEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Get configuration
   */
  getConfig(): CacheInvalidationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<CacheInvalidationConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
      rules: {
        ...this.config.rules,
        ...updates.rules,
      },
    };
  }
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

/**
 * Default cache invalidation configuration
 */
export const DEFAULT_CACHE_INVALIDATION_CONFIG: CacheInvalidationConfig = {
  rules: {
    structure: {
      trigger: "structure",
      threshold: 0.1,
      scope: "related",
    },
    visual: {
      trigger: "visual",
      threshold: 0.05,
      scope: "single",
    },
    interaction: {
      trigger: "interaction",
      threshold: 0.5,
      scope: "single",
    },
    time: {
      trigger: "time",
      threshold: 0,
      scope: "single",
    },
    explicit: {
      trigger: "explicit",
      threshold: 0,
      scope: "all",
    },
  },
  automatic: false,
  logging: false,
  maxEventHistory: 1000,
};

/**
 * Aggressive cache invalidation configuration (invalidates more often)
 */
export const AGGRESSIVE_CACHE_INVALIDATION_CONFIG: CacheInvalidationConfig = {
  rules: {
    structure: {
      trigger: "structure",
      threshold: 0.05,
      scope: "related",
    },
    visual: {
      trigger: "visual",
      threshold: 0.02,
      scope: "related",
    },
    interaction: {
      trigger: "interaction",
      threshold: 0.3,
      scope: "related",
    },
    time: {
      trigger: "time",
      threshold: 0,
      scope: "single",
    },
    explicit: {
      trigger: "explicit",
      threshold: 0,
      scope: "all",
    },
  },
  automatic: true,
  logging: true,
  maxEventHistory: 500,
};

/**
 * Conservative cache invalidation configuration (invalidates less often)
 */
export const CONSERVATIVE_CACHE_INVALIDATION_CONFIG: CacheInvalidationConfig = {
  rules: {
    structure: {
      trigger: "structure",
      threshold: 0.2,
      scope: "single",
    },
    visual: {
      trigger: "visual",
      threshold: 0.1,
      scope: "single",
    },
    interaction: {
      trigger: "interaction",
      threshold: 0.8,
      scope: "single",
    },
    time: {
      trigger: "time",
      threshold: 0,
      scope: "single",
    },
    explicit: {
      trigger: "explicit",
      threshold: 0,
      scope: "all",
    },
  },
  automatic: false,
  logging: false,
  maxEventHistory: 2000,
};

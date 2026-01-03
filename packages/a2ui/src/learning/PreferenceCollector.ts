/**
 * @fileoverview Preference Collector - Track and store user UI interactions and preferences
 * @author Aequor Project - Round 18 Agent 1
 * @version 1.0.0
 */

import type { A2UIResponse, A2UIComponent } from "@lsi/protocol";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Types of user interactions that can be tracked
 */
export type InteractionType =
  | "click"
  | "hover"
  | "scroll"
  | "input"
  | "submit"
  | "cancel"
  | "navigate"
  | "resize"
  | "theme_change"
  | "layout_change"
  | "component_usage";

/**
 * Layout density preferences
 */
export type LayoutDensity = "compact" | "comfortable" | "spacious";

/**
 * Theme preferences
 */
export type ThemePreference = "light" | "dark" | "auto" | "high_contrast";

/**
 * Component usage statistics
 */
export interface ComponentUsageStats {
  componentId: string;
  componentType: string;
  viewCount: number;
  interactionCount: number;
  avgDwellTime: number; // milliseconds
  lastUsed: Date;
  firstUsed: Date;
  successRate: number; // 0-1
}

/**
 * A single user interaction event
 */
export interface UIInteraction {
  id: string;
  userId: string;
  sessionId: string;
  timestamp: Date;
  type: InteractionType;
  componentId?: string;
  componentType?: string;
  properties: Record<string, unknown>;
  context: {
    viewport: { width: number; height: number };
    url?: string;
    uiState: string; // Hash of current UI state
  };
  dwellTime?: number; // milliseconds
  metadata?: Record<string, unknown>;
}

/**
 * User preference profile
 */
export interface UserPreference {
  userId: string;
  sessionId: string;
  lastUpdated: Date;

  // Explicit preferences
  explicitPreferences: {
    layoutDensity: LayoutDensity;
    theme: ThemePreference;
    fontSize: number; // pixels
    language: string;
    timezone: string;
  };

  // Implicit preferences (learned)
  implicitPreferences: {
    preferredComponentTypes: string[]; // Most used
    avoidedComponentTypes: string[]; // Least used or failed
    preferredLayout: string; // Layout pattern that works best
    navigationStyle: "sidebar" | "topbar" | "tabs" | "drawer";
    informationDensity: number; // 0-1, how much info at once
    interactionStyle: "mouse" | "keyboard" | "touch" | "mixed";
  };

  // Component usage statistics
  componentUsage: Map<string, ComponentUsageStats>;

  // Interaction patterns
  interactionPatterns: InteractionPattern[];

  // Session statistics
  sessionStats: {
    totalInteractions: number;
    avgSessionDuration: number;
    lastSession: Date;
    totalSessions: number;
  };
}

/**
 * Temporal interaction pattern
 */
export interface InteractionPattern {
  type: InteractionType;
  frequency: number; // interactions per session
  avgTimeOfDay: number; // 0-24 hour
  dayOfWeek: number; // 0-6
  sequence: string[]; // Component interaction sequence
  confidence: number; // 0-1
}

/**
 * Storage backend for preferences
 */
export interface PreferenceStorage {
  get(userId: string): Promise<UserPreference | null>;
  set(preference: UserPreference): Promise<void>;
  delete(userId: string): Promise<void>;
  list(): Promise<string[]>; // List all user IDs
}

/**
 * Configuration for PreferenceCollector
 */
export interface PreferenceCollectorConfig {
  storage: PreferenceStorage;
  maxInteractionsPerSession?: number;
  maxSessionHistory?: number;
  anonymizeData?: boolean;
  retentionDays?: number;
  samplingRate?: number; // 0-1, for performance
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_COLLECTOR_CONFIG: Required<PreferenceCollectorConfig> = {
  storage: null as unknown as PreferenceStorage, // Must be provided
  maxInteractionsPerSession: 1000,
  maxSessionHistory: 100,
  anonymizeData: true,
  retentionDays: 90,
  samplingRate: 1.0,
};

// ============================================================================
// IN-MEMORY STORAGE (Default implementation)
// ============================================================================

/**
 * In-memory storage for preferences (for development/testing)
 */
export class InMemoryPreferenceStorage implements PreferenceStorage {
  private store: Map<string, UserPreference> = new Map();

  async get(userId: string): Promise<UserPreference | null> {
    return this.store.get(userId) || null;
  }

  async set(preference: UserPreference): Promise<void> {
    this.store.set(preference.userId, preference);
  }

  async delete(userId: string): Promise<void> {
    this.store.delete(userId);
  }

  async list(): Promise<string[]> {
    return Array.from(this.store.keys());
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

// ============================================================================
// PREFERENCE COLLECTOR
// ============================================================================

/**
 * PreferenceCollector - Track and store user UI interactions
 *
 * Collects both explicit preferences (user settings) and implicit preferences
 * (learned from behavior). Maintains privacy by anonymizing data by default.
 */
export class PreferenceCollector {
  private config: Required<PreferenceCollectorConfig>;
  private sessionCache: Map<string, UIInteraction[]> = new Map();

  constructor(config: PreferenceCollectorConfig) {
    this.config = {
      ...DEFAULT_COLLECTOR_CONFIG,
      ...config,
      storage: config.storage, // Don't merge storage
    };
  }

  /**
   * Record a user interaction
   */
  async recordInteraction(
    interaction: Omit<UIInteraction, "id" | "timestamp">
  ): Promise<string> {
    // Apply sampling rate for performance
    if (Math.random() > this.config.samplingRate) {
      return "";
    }

    const fullInteraction: UIInteraction = {
      ...interaction,
      id: this.generateId(),
      timestamp: new Date(),
    };

    // Cache in session
    const sessionKey = `${interaction.userId}:${interaction.sessionId}`;
    if (!this.sessionCache.has(sessionKey)) {
      this.sessionCache.set(sessionKey, []);
    }
    const session = this.sessionCache.get(sessionKey)!;
    session.push(fullInteraction);

    // Enforce max interactions per session
    if (session.length > this.config.maxInteractionsPerSession) {
      session.shift(); // Remove oldest
    }

    // Periodically flush to storage
    if (session.length % 10 === 0) {
      await this.flushSession(interaction.userId, interaction.sessionId);
    }

    return fullInteraction.id;
  }

  /**
   * Record explicit user preferences
   */
  async recordExplicitPreference(
    userId: string,
    sessionId: string,
    preference: Partial<UserPreference["explicitPreferences"]>
  ): Promise<void> {
    const userPref = await this.getUserPreference(userId);
    if (!userPref) {
      return;
    }

    // Update explicit preferences
    Object.assign(userPref.explicitPreferences, preference);
    userPref.lastUpdated = new Date();

    await this.config.storage.set(userPref);
  }

  /**
   * Get user preference profile
   */
  async getUserPreference(userId: string): Promise<UserPreference | null> {
    return await this.config.storage.get(userId);
  }

  /**
   * Get or create user preference profile
   */
  async getOrCreateUserPreference(
    userId: string,
    sessionId: string
  ): Promise<UserPreference> {
    let pref = await this.config.storage.get(userId);
    if (!pref) {
      pref = this.createDefaultPreference(userId, sessionId);
      await this.config.storage.set(pref);
    }
    return pref;
  }

  /**
   * Flush session interactions to storage
   */
  async flushSession(userId: string, sessionId: string): Promise<void> {
    const sessionKey = `${userId}:${sessionId}`;
    const interactions = this.sessionCache.get(sessionKey);
    if (!interactions || interactions.length === 0) {
      return;
    }

    const pref = await this.getOrCreateUserPreference(userId, sessionId);

    // Process interactions into preference data
    for (const interaction of interactions) {
      this.processInteraction(pref, interaction);
    }

    pref.lastUpdated = new Date();
    await this.config.storage.set(pref);

    // Clear session cache
    this.sessionCache.delete(sessionKey);
  }

  /**
   * Get recent interactions for a user
   */
  async getRecentInteractions(
    userId: string,
    limit: number = 100
  ): Promise<UIInteraction[]> {
    const pref = await this.config.storage.get(userId);
    if (!pref) {
      return [];
    }

    return pref.interactionPatterns.slice(-limit).map(pattern => ({
      id: this.generateId(),
      userId,
      sessionId: pref.sessionId,
      timestamp: new Date(),
      type: pattern.type,
      componentType: pattern.sequence[0],
      properties: {},
      context: {
        viewport: { width: 0, height: 0 },
        uiState: "",
      },
    }));
  }

  /**
   * Get component usage statistics
   */
  async getComponentUsage(userId: string): Promise<ComponentUsageStats[]> {
    const pref = await this.config.storage.get(userId);
    if (!pref) {
      return [];
    }

    return Array.from(pref.componentUsage.values()).sort(
      (a, b) => b.viewCount - a.viewCount
    );
  }

  /**
   * Clean up old data based on retention policy
   */
  async cleanupOldData(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    const userIds = await this.config.storage.list();
    let cleaned = 0;

    for (const userId of userIds) {
      const pref = await this.config.storage.get(userId);
      if (!pref) {
        continue;
      }

      // Filter out old interaction patterns
      const originalCount = pref.interactionPatterns.length;
      pref.interactionPatterns = pref.interactionPatterns.filter(p => {
        const patternDate = new Date(p.avgTimeOfDay);
        return patternDate > cutoffDate;
      });

      if (pref.interactionPatterns.length < originalCount) {
        await this.config.storage.set(pref);
        cleaned++;
      }
    }

    return cleaned;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Process a single interaction and update preference data
   */
  private processInteraction(
    pref: UserPreference,
    interaction: UIInteraction
  ): void {
    // Update component usage
    if (interaction.componentId && interaction.componentType) {
      let usage = pref.componentUsage.get(interaction.componentId);
      if (!usage) {
        usage = {
          componentId: interaction.componentId,
          componentType: interaction.componentType,
          viewCount: 0,
          interactionCount: 0,
          avgDwellTime: 0,
          lastUsed: interaction.timestamp,
          firstUsed: interaction.timestamp,
          successRate: 1.0,
        };
        pref.componentUsage.set(interaction.componentId, usage);
      }

      usage.viewCount++;
      usage.interactionCount++;
      usage.lastUsed = interaction.timestamp;

      if (interaction.dwellTime) {
        // Update average dwell time using exponential moving average
        usage.avgDwellTime =
          usage.avgDwellTime * 0.9 + interaction.dwellTime * 0.1;
      }
    }

    // Update interaction patterns
    const existingPattern = pref.interactionPatterns.find(
      p => p.type === interaction.type
    );
    if (existingPattern) {
      existingPattern.frequency++;
      existingPattern.confidence = Math.min(
        1,
        existingPattern.confidence + 0.01
      );
    } else {
      pref.interactionPatterns.push({
        type: interaction.type,
        frequency: 1,
        avgTimeOfDay: interaction.timestamp.getHours(),
        dayOfWeek: interaction.timestamp.getDay(),
        sequence: interaction.componentType ? [interaction.componentType] : [],
        confidence: 0.1,
      });
    }

    // Update session stats
    pref.sessionStats.totalInteractions++;
  }

  /**
   * Create default preference profile
   */
  private createDefaultPreference(
    userId: string,
    sessionId: string
  ): UserPreference {
    return {
      userId,
      sessionId,
      lastUpdated: new Date(),
      explicitPreferences: {
        layoutDensity: "comfortable",
        theme: "auto",
        fontSize: 16,
        language: "en",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      implicitPreferences: {
        preferredComponentTypes: [],
        avoidedComponentTypes: [],
        preferredLayout: "default",
        navigationStyle: "sidebar",
        informationDensity: 0.5,
        interactionStyle: "mixed",
      },
      componentUsage: new Map(),
      interactionPatterns: [],
      sessionStats: {
        totalInteractions: 0,
        avgSessionDuration: 0,
        lastSession: new Date(),
        totalSessions: 1,
      },
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `pref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a preference collector with default in-memory storage
 */
export function createPreferenceCollector(
  config?: Partial<PreferenceCollectorConfig>
): PreferenceCollector {
  const storage = new InMemoryPreferenceStorage();
  return new PreferenceCollector({
    ...config,
    storage,
  });
}

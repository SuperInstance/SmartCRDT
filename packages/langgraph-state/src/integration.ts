/**
 * @lsi/langgraph-state - Integration Layer
 *
 * Integration with LangGraph state channels, CoAgents state sync,
 * VL-JEPA embedding state, and A2UI component state.
 */

import type {
  LangGraphStateChannel,
  LangGraphStateAnnotation,
  StateScope,
} from "./types.js";
import { AdvancedStateManager } from "./StateManager.js";
import { generateStateId } from "./types.js";

// ============================================================================
// LangGraph State Channel Integration
// ============================================================================

/**
 * LangGraph state manager wrapper
 */
export class LangGraphStateManager<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  private manager: AdvancedStateManager<T>;

  constructor(initialState: T) {
    this.manager = new AdvancedStateManager<T>(initialState, {
      defaultStrategy: "replace",
      versioning: true,
      snapshots: true,
      history: true,
    });
  }

  /**
   * Get current state
   */
  public getState(): T {
    return this.manager.state;
  }

  /**
   * Update state using reducer
   */
  public async update(reducer: (state: T) => T | Promise<T>): Promise<void> {
    await this.manager.updateState("global", async state => {
      return await reducer(state as T);
    });
  }

  /**
   * Create state channel for LangGraph
   */
  public createChannel<K extends keyof T>(key: K): LangGraphStateChannel<T[K]> {
    return {
      name: String(key),
      value: this.manager.state[key],
      reducer: async (state: any, payload: unknown) => {
        return {
          ...state,
          [key]: payload,
        };
      },
      default: this.manager.state[key],
      metadata: {
        key: String(key),
        managerId: this.manager.id,
      },
    };
  }

  /**
   * Create state annotation for LangGraph
   */
  public createAnnotation(): LangGraphStateAnnotation<T> {
    const channels: Record<string, LangGraphStateChannel<unknown>> = {};

    for (const key of Object.keys(this.manager.state)) {
      channels[key] = {
        name: key,
        value: (this.manager.state as Record<string, unknown>)[key],
        reducer: async (state: T, payload: unknown) => {
          return {
            ...state,
            [key]: payload,
          };
        },
      };
    }

    return {
      channels: channels as Record<string, LangGraphStateChannel<T>>,
      reducer: undefined,
    };
  }

  /**
   * Subscribe to state changes
   */
  public onChange(callback: (state: T, oldState: T) => void): void {
    this.manager.on("state:change", ({ data }: any) => {
      callback(this.manager.state, data.oldState);
    });
  }

  /**
   * Create snapshot
   */
  public async createSnapshot(label?: string): Promise<string> {
    const snapshot = await this.manager.createSnapshot(label);
    return snapshot.id;
  }

  /**
   * Restore snapshot
   */
  public async restoreSnapshot(snapshotId: string): Promise<void> {
    await this.manager.restoreSnapshot(snapshotId);
  }

  /**
   * Get history
   */
  public getHistory(): Array<{ state: T; timestamp: Date }> {
    return this.manager.getHistory("global").map(transition => ({
      state: this.manager.state,
      timestamp: transition.timestamp,
    }));
  }

  /**
   * Destroy manager
   */
  public async destroy(): Promise<void> {
    await this.manager.destroy();
  }
}

/**
 * Create LangGraph state manager
 */
export function createLangGraphStateManager<T extends Record<string, unknown>>(
  initialState: T
): LangGraphStateManager<T> {
  return new LangGraphStateManager<T>(initialState);
}

// ============================================================================
// CoAgents State Synchronization
// ============================================================================

/**
 * CoAgents state sync configuration
 */
export interface CoAgentsStateSyncConfig {
  /** Sync interval in milliseconds */
  syncInterval?: number;
  /** Sync only specific scopes */
  scopes?: StateScope[];
  /** Transform state before syncing */
  transform?: (state: unknown) => unknown;
  /** Validate state after sync */
  validate?: (state: unknown) => boolean;
}

/**
 * CoAgents state synchronizer
 */
export class CoAgentsStateSynchronizer {
  private stateManager: AdvancedStateManager;
  private syncIntervals: Map<string, NodeJS.Timeout>;
  private config: CoAgentsStateSyncConfig;

  constructor(
    stateManager: AdvancedStateManager,
    config: CoAgentsStateSyncConfig = {}
  ) {
    this.stateManager = stateManager;
    this.config = {
      syncInterval: 1000,
      scopes: ["global", "agent", "session"],
      ...config,
    };
    this.syncIntervals = new Map();
  }

  /**
   * Start syncing state with CoAgents
   */
  public start(coAgentsState: Record<string, unknown>): void {
    const intervalId = setInterval(async () => {
      await this.sync(coAgentsState);
    }, this.config.syncInterval);

    this.syncIntervals.set("main", intervalId);
  }

  /**
   * Stop syncing
   */
  public stop(): void {
    for (const [name, intervalId] of this.syncIntervals) {
      clearInterval(intervalId);
    }
    this.syncIntervals.clear();
  }

  /**
   * Manual sync
   */
  public async sync(coAgentsState: Record<string, unknown>): Promise<void> {
    const scopes = this.config.scopes || ["global", "agent", "session"];

    for (const scope of scopes) {
      const scopeState = this.stateManager.getState(scope);

      // Transform if needed
      const transformedState = this.config.transform
        ? this.config.transform(scopeState)
        : scopeState;

      // Validate if needed
      if (this.config.validate) {
        const valid = this.config.validate(transformedState);
        if (!valid) {
          console.warn(`State validation failed for scope: ${scope}`);
          continue;
        }
      }

      // Sync to CoAgents
      Object.assign(coAgentsState, transformedState);
    }
  }

  /**
   * Sync from CoAgents to state manager
   */
  public async syncFrom(coAgentsState: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(coAgentsState)) {
      await this.stateManager.setState("global", key, value, "merge");
    }
  }

  /**
   * Destroy synchronizer
   */
  public destroy(): void {
    this.stop();
  }
}

/**
 * Create CoAgents state synchronizer
 */
export function createCoAgentsStateSynchronizer(
  stateManager: AdvancedStateManager,
  config?: CoAgentsStateSyncConfig
): CoAgentsStateSynchronizer {
  return new CoAgentsStateSynchronizer(stateManager, config);
}

// ============================================================================
// VL-JEPA Embedding State Integration
// ============================================================================

/**
 * VL-JEPA embedding state
 */
export interface VLJEPAEmbeddingState {
  /** Current embedding vector */
  embedding: number[];
  /** Embedding version */
  version: number;
  /** Timestamp of embedding */
  timestamp: Date;
  /** Goal state embedding */
  goalEmbedding?: number[];
  /** UI frame embedding */
  uiFrameEmbedding?: number[];
  /** User intent embedding */
  userIntentEmbedding?: number[];
}

/**
 * VL-JEPA state manager
 */
export class VLJEPAStateManager {
  private stateManager: AdvancedStateManager;

  constructor(stateManager: AdvancedStateManager) {
    this.stateManager = stateManager;
  }

  /**
   * Set current embedding
   */
  public async setEmbedding(
    embedding: number[],
    version: number
  ): Promise<void> {
    const state: VLJEPAEmbeddingState = {
      embedding,
      version,
      timestamp: new Date(),
    };

    await this.stateManager.setState("global", "vljepa", state, "replace");
  }

  /**
   * Get current embedding
   */
  public getEmbedding(): VLJEPAEmbeddingState | undefined {
    const state = this.stateManager.getState("global", "vljepa");
    return state as VLJEPAEmbeddingState | undefined;
  }

  /**
   * Set goal embedding
   */
  public async setGoalEmbedding(goalEmbedding: number[]): Promise<void> {
    const current = this.getEmbedding();
    if (current) {
      await this.stateManager.setState(
        "global",
        "vljepa",
        {
          ...current,
          goalEmbedding,
        },
        "replace"
      );
    }
  }

  /**
   * Set UI frame embedding
   */
  public async setUIFrameEmbedding(uiFrameEmbedding: number[]): Promise<void> {
    const current = this.getEmbedding();
    if (current) {
      await this.stateManager.setState(
        "global",
        "vljepa",
        {
          ...current,
          uiFrameEmbedding,
        },
        "replace"
      );
    }
  }

  /**
   * Set user intent embedding
   */
  public async setUserIntentEmbedding(
    userIntentEmbedding: number[]
  ): Promise<void> {
    const current = this.getEmbedding();
    if (current) {
      await this.stateManager.setState(
        "global",
        "vljepa",
        {
          ...current,
          userIntentEmbedding,
        },
        "replace"
      );
    }
  }

  /**
   * Compare embeddings for similarity
   */
  public cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Embedding dimensions must match");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Find most similar embedding in history
   */
  public findMostSimilar(embedding: number[]): {
    state: VLJEPAEmbeddingState;
    similarity: number;
  } | null {
    const history = this.stateManager.getHistory("global");
    let mostSimilar: {
      state: VLJEPAEmbeddingState;
      similarity: number;
    } | null = null;

    for (const transition of history) {
      const state = this.stateManager.getState("global", "vljepa") as
        | VLJEPAEmbeddingState
        | undefined;
      if (state && state.embedding) {
        const similarity = this.cosineSimilarity(embedding, state.embedding);
        if (!mostSimilar || similarity > mostSimilar.similarity) {
          mostSimilar = { state, similarity };
        }
      }
    }

    return mostSimilar;
  }
}

/**
 * Create VL-JEPA state manager
 */
export function createVLJEPAStateManager(
  stateManager: AdvancedStateManager
): VLJEPAStateManager {
  return new VLJEPAStateManager(stateManager);
}

// ============================================================================
// A2UI Component State Integration
// ============================================================================

/**
 * A2UI component state
 */
export interface A2UIComponentState {
  /** Component ID */
  id: string;
  /** Component type */
  type: string;
  /** Component props */
  props: Record<string, unknown>;
  /** Component state */
  state: Record<string, unknown>;
  /** Layout information */
  layout?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Children component IDs */
  children?: string[];
}

/**
 * A2UI state manager
 */
export class A2UIStateManager {
  private stateManager: AdvancedStateManager;

  constructor(stateManager: AdvancedStateManager) {
    this.stateManager = stateManager;
  }

  /**
   * Register component
   */
  public async registerComponent(component: A2UIComponentState): Promise<void> {
    await this.stateManager.setState(
      "global",
      `a2ui.components.${component.id}`,
      component,
      "replace"
    );
  }

  /**
   * Update component props
   */
  public async updateComponentProps(
    componentId: string,
    props: Record<string, unknown>
  ): Promise<void> {
    const current = this.getComponent(componentId);
    if (current) {
      await this.stateManager.setState(
        "global",
        `a2ui.components.${componentId}`,
        {
          ...current,
          props: { ...current.props, ...props },
        },
        "merge"
      );
    }
  }

  /**
   * Update component state
   */
  public async updateComponentState(
    componentId: string,
    state: Record<string, unknown>
  ): Promise<void> {
    const current = this.getComponent(componentId);
    if (current) {
      await this.stateManager.setState(
        "global",
        `a2ui.components.${componentId}`,
        {
          ...current,
          state: { ...current.state, ...state },
        },
        "merge"
      );
    }
  }

  /**
   * Get component
   */
  public getComponent(componentId: string): A2UIComponentState | undefined {
    return this.stateManager.getState(
      "global",
      `a2ui.components.${componentId}`
    ) as A2UIComponentState | undefined;
  }

  /**
   * Get all components
   */
  public getAllComponents(): A2UIComponentState[] {
    const components = this.stateManager.getState("global", "a2ui.components");
    return components
      ? Object.values(components as Record<string, A2UIComponentState>)
      : [];
  }

  /**
   * Remove component
   */
  public async removeComponent(componentId: string): Promise<void> {
    const current = this.stateManager.getState("global", "a2ui.components") as
      | Record<string, unknown>
      | undefined;
    if (current && componentId in current) {
      delete current[componentId];
      await this.stateManager.setState(
        "global",
        "a2ui.components",
        current,
        "replace"
      );
    }
  }

  /**
   * Set component layout
   */
  public async setComponentLayout(
    componentId: string,
    layout: A2UIComponentState["layout"]
  ): Promise<void> {
    const current = this.getComponent(componentId);
    if (current) {
      await this.stateManager.setState(
        "global",
        `a2ui.components.${componentId}`,
        {
          ...current,
          layout,
        },
        "merge"
      );
    }
  }

  /**
   * Batch update multiple components
   */
  public async batchUpdateComponents(
    updates: Array<{
      componentId: string;
      props?: Record<string, unknown>;
      state?: Record<string, unknown>;
      layout?: A2UIComponentState["layout"];
    }>
  ): Promise<void> {
    for (const update of updates) {
      const current = this.getComponent(update.componentId);
      if (current) {
        await this.stateManager.setState(
          "global",
          `a2ui.components.${update.componentId}`,
          {
            ...current,
            ...(update.props && {
              props: { ...current.props, ...update.props },
            }),
            ...(update.state && {
              state: { ...current.state, ...update.state },
            }),
            ...(update.layout && { layout: update.layout }),
          },
          "merge"
        );
      }
    }
  }

  /**
   * Create snapshot of UI state
   */
  public async createUISnapshot(label?: string): Promise<string> {
    const snapshot = await this.stateManager.createSnapshot(label);
    return snapshot.id;
  }

  /**
   * Restore UI snapshot
   */
  public async restoreUISnapshot(snapshotId: string): Promise<void> {
    await this.stateManager.restoreSnapshot(snapshotId);
  }

  /**
   * Get UI state history
   */
  public getUIHistory(): Array<{
    components: A2UIComponentState[];
    timestamp: Date;
  }> {
    return this.stateManager
      .getHistory("global")
      .filter(t => t.trigger.startsWith("a2ui"))
      .map(t => ({
        components: this.getAllComponents(),
        timestamp: t.timestamp,
      }));
  }
}

/**
 * Create A2UI state manager
 */
export function createA2UIStateManager(
  stateManager: AdvancedStateManager
): A2UIStateManager {
  return new A2UIStateManager(stateManager);
}

// ============================================================================
// Multi-Integration State Manager
// ============================================================================

/**
 * Integrated state manager combining all integrations
 */
export class IntegratedStateManager {
  private baseManager: AdvancedStateManager;
  public langgraph: LangGraphStateManager;
  public coagents: CoAgentsStateSynchronizer;
  public vljepa: VLJEPAStateManager;
  public a2ui: A2UIStateManager;

  constructor(initialState: Record<string, unknown> = {}) {
    this.baseManager = new AdvancedStateManager(initialState);
    this.langgraph = new LangGraphStateManager(initialState);
    this.coagents = createCoAgentsStateSynchronizer(this.baseManager);
    this.vljepa = createVLJEPAStateManager(this.baseManager);
    this.a2ui = createA2UIStateManager(this.baseManager);
  }

  /**
   * Initialize all integrations
   */
  public async initialize(
    coAgentsState?: Record<string, unknown>
  ): Promise<void> {
    if (coAgentsState) {
      this.coagents.start(coAgentsState);
    }
  }

  /**
   * Shutdown all integrations
   */
  public async shutdown(): Promise<void> {
    this.coagents.stop();
    await this.langgraph.destroy();
    await this.baseManager.destroy();
  }

  /**
   * Get unified state
   */
  public getUnifiedState(): Record<string, unknown> {
    return {
      langgraph: this.langgraph.getState(),
      vljepa: this.vljepa.getEmbedding(),
      a2ui: {
        components: this.a2ui.getAllComponents(),
      },
    };
  }
}

/**
 * Create integrated state manager
 */
export function createIntegratedStateManager(
  initialState?: Record<string, unknown>
): IntegratedStateManager {
  return new IntegratedStateManager(initialState);
}

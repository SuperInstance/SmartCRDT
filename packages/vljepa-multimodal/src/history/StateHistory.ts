/**
 * StateHistory - Track state changes with time travel
 *
 * Manages state history with undo/redo, branching,
 * and diff capabilities.
 */

import type {
  MultiModalState,
  StateHistory as StateHistoryType,
  StateSnapshot,
  Branch,
  StateDiff,
} from "../types.js";
import { TimeTravel } from "./TimeTravel.js";
import { BranchManager } from "./BranchManager.js";

/**
 * State history manager
 */
export class StateHistory {
  private history: StateHistoryType;
  private maxHistorySize: number = 100;
  private autoSave: boolean = true;
  private timeTravel: TimeTravel;
  private branchManager: BranchManager;

  constructor(maxHistorySize: number = 100, autoSave: boolean = true) {
    this.maxHistorySize = maxHistorySize;
    this.autoSave = autoSave;

    // Initialize with empty current state
    this.history = {
      current: this.createEmptyState(),
      past: [],
      future: [],
      branches: [],
      currentBranch: "main",
    };

    this.timeTravel = new TimeTravel(this.history);
    this.branchManager = new BranchManager(this.history);

    // Create main branch
    this.branchManager.createBranch("main", null);
  }

  /**
   * Create empty state
   */
  private createEmptyState(): MultiModalState {
    return {
      id: "empty",
      version: 0,
      timestamp: Date.now(),
      modified: Date.now(),
      text: {
        input: "",
        intent: "",
        entities: [],
        sentiment: {
          label: "neutral",
          confidence: 0.5,
          scores: { positive: 0.33, negative: 0.33, neutral: 0.34 },
        },
        embedding: new Float32Array(768),
        timestamp: Date.now(),
      },
      visual: {
        frames: [],
        components: [],
        layout: {
          type: "unknown",
          hierarchy: [],
          spacing: { horizontal: 0, vertical: 0 },
        },
        embedding: new Float32Array(768),
        timestamp: Date.now(),
      },
      embedding: {
        vector: new Float32Array(768),
        textContribution: new Float32Array(768),
        visualContribution: new Float32Array(768),
        timestamp: Date.now(),
      },
      fused: {
        embedding: new Float32Array(768),
        attention: {
          text: new Map(),
          visual: new Map(),
          crossModal: new Map(),
        },
        confidence: 0,
        reasoning: "",
        timestamp: Date.now(),
      },
      metadata: {
        id: "empty",
        version: 0,
        timestamp: Date.now(),
        author: "system",
        tags: [],
        properties: {},
      },
      confidence: 0,
    };
  }

  /**
   * Get current state
   */
  getCurrentState(): MultiModalState {
    return this.history.current;
  }

  /**
   * Save snapshot of current state
   */
  saveSnapshot(
    description: string = "",
    author: string = "user"
  ): StateSnapshot {
    const snapshot: StateSnapshot = {
      state: this.cloneState(this.history.current),
      timestamp: Date.now(),
      author,
      description,
      id: `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    // Add to past
    this.history.past.push(snapshot);

    // Add to current branch
    const currentBranch = this.branchManager.getBranch(
      this.history.currentBranch
    );
    if (currentBranch) {
      currentBranch.snapshots.push(snapshot);
      currentBranch.modified = snapshot.timestamp;
    }

    // Clear future (new action invalidates redo history)
    this.history.future = [];

    // Limit history size
    this.limitHistorySize();

    return snapshot;
  }

  /**
   * Limit history size
   */
  private limitHistorySize(): void {
    if (this.history.past.length > this.maxHistorySize) {
      const removed = this.history.past.splice(
        0,
        this.history.past.length - this.maxHistorySize
      );

      // Also remove from branches
      for (const branch of this.history.branches) {
        for (const snapshot of removed) {
          const index = branch.snapshots.findIndex(s => s.id === snapshot.id);
          if (index >= 0) {
            branch.snapshots.splice(index, 1);
          }
        }
      }
    }
  }

  /**
   * Update current state
   */
  updateCurrentState(
    state: MultiModalState,
    autoSaveSnapshot: boolean = true
  ): void {
    // Auto-save snapshot if enabled
    if (this.autoSave && autoSaveSnapshot) {
      this.saveSnapshot(`Before update to v${state.version}`);
    }

    this.history.current = state;
  }

  /**
   * Undo last change
   */
  undo(): MultiModalState | null {
    return this.timeTravel.undo();
  }

  /**
   * Redo last undone change
   */
  redo(): MultiModalState | null {
    return this.timeTravel.redo();
  }

  /**
   * Jump to specific snapshot
   */
  jumpTo(snapshotId: string): MultiModalState | null {
    const snapshot = this.findSnapshot(snapshotId);
    if (!snapshot) {
      return null;
    }

    // Save current state to future before jumping
    this.history.future.push({
      state: this.cloneState(this.history.current),
      timestamp: Date.now(),
      author: "system",
      description: `Before jump to ${snapshotId}`,
      id: `snapshot_${Date.now()}_future`,
    });

    this.history.current = snapshot.state;
    return snapshot.state;
  }

  /**
   * Find snapshot by ID
   */
  private findSnapshot(snapshotId: string): StateSnapshot | null {
    // Search in past
    for (const snapshot of this.history.past) {
      if (snapshot.id === snapshotId) {
        return snapshot;
      }
    }

    // Search in future
    for (const snapshot of this.history.future) {
      if (snapshot.id === snapshotId) {
        return snapshot;
      }
    }

    // Search in branches
    for (const branch of this.history.branches) {
      for (const snapshot of branch.snapshots) {
        if (snapshot.id === snapshotId) {
          return snapshot;
        }
      }
    }

    return null;
  }

  /**
   * Get all snapshots
   */
  getAllSnapshots(): StateSnapshot[] {
    const allSnapshots = [...this.history.past, ...this.history.future];

    for (const branch of this.history.branches) {
      allSnapshots.push(...branch.snapshots);
    }

    // Sort by timestamp
    return allSnapshots.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get snapshots for current branch
   */
  getBranchSnapshots(): StateSnapshot[] {
    const branch = this.branchManager.getBranch(this.history.currentBranch);
    return branch ? [...branch.snapshots] : [];
  }

  /**
   * Diff two states
   */
  diff(state1?: MultiModalState, state2?: MultiModalState): StateDiff {
    const s1 = state1 || this.history.current;
    const s2 = state2 || this.history.past[this.history.past.length - 1]?.state;

    if (!s2) {
      return { added: [], removed: [], modified: [], changes: new Map() };
    }

    const changes = new Map<string, { oldValue: unknown; newValue: unknown }>();
    const added: string[] = [];
    const removed: string[] = [];
    const modified: string[] = [];

    // Compare text input
    if (s1.text.input !== s2.text.input) {
      changes.set("text.input", {
        oldValue: s2.text.input,
        newValue: s1.text.input,
      });
      modified.push("text.input");
    }

    // Compare confidence
    if (s1.confidence !== s2.confidence) {
      changes.set("confidence", {
        oldValue: s2.confidence,
        newValue: s1.confidence,
      });
      modified.push("confidence");
    }

    // Compare tags
    const s1Tags = new Set(s1.metadata.tags);
    const s2Tags = new Set(s2.metadata.tags);

    for (const tag of s2Tags) {
      if (!s1Tags.has(tag)) {
        removed.push(`metadata.tags.${tag}`);
      }
    }

    for (const tag of s1Tags) {
      if (!s2Tags.has(tag)) {
        added.push(`metadata.tags.${tag}`);
      }
    }

    // Compare version
    if (s1.version !== s2.version) {
      changes.set("version", { oldValue: s2.version, newValue: s1.version });
      modified.push("version");
    }

    return { added, removed, modified, changes };
  }

  /**
   * Get history statistics
   */
  getStatistics(): {
    totalSnapshots: number;
    pastSnapshots: number;
    futureSnapshots: number;
    branchCount: number;
    currentBranch: string;
  } {
    return {
      totalSnapshots: this.history.past.length + this.history.future.length,
      pastSnapshots: this.history.past.length,
      futureSnapshots: this.history.future.length,
      branchCount: this.history.branches.length,
      currentBranch: this.history.currentBranch,
    };
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history.past = [];
    this.history.future = [];

    for (const branch of this.history.branches) {
      branch.snapshots = [];
    }
  }

  /**
   * Clone state
   */
  private cloneState(state: MultiModalState): MultiModalState {
    return {
      id: state.id,
      version: state.version,
      timestamp: state.timestamp,
      modified: state.modified,
      text: {
        ...state.text,
        embedding: new Float32Array(state.text.embedding),
      },
      visual: {
        ...state.visual,
        embedding: new Float32Array(state.visual.embedding),
        frames: state.visual.frames.map(f => ({ ...f })),
        components: state.visual.components.map(c => ({
          ...c,
          attributes: { ...c.attributes },
        })),
      },
      embedding: {
        ...state.embedding,
        vector: new Float32Array(state.embedding.vector),
        textContribution: new Float32Array(state.embedding.textContribution),
        visualContribution: new Float32Array(
          state.embedding.visualContribution
        ),
      },
      fused: {
        ...state.fused,
        embedding: new Float32Array(state.fused.embedding),
        attention: {
          text: new Map(state.fused.attention.text),
          visual: new Map(state.fused.attention.visual),
          crossModal: new Map(),
        },
      },
      metadata: {
        ...state.metadata,
        tags: [...state.metadata.tags],
        properties: { ...state.metadata.properties },
      },
      confidence: state.confidence,
    };
  }

  /**
   * Export history
   */
  export(): StateHistoryType {
    return JSON.parse(
      JSON.stringify({
        ...this.history,
        current: this.cloneState(this.history.current),
        past: this.history.past.map(s => ({
          ...s,
          state: this.cloneState(s.state),
        })),
        future: this.history.future.map(s => ({
          ...s,
          state: this.cloneState(s.state),
        })),
      })
    );
  }

  /**
   * Get time travel manager
   */
  getTimeTravel(): TimeTravel {
    return this.timeTravel;
  }

  /**
   * Get branch manager
   */
  getBranchManager(): BranchManager {
    return this.branchManager;
  }

  /**
   * Set max history size
   */
  setMaxHistorySize(size: number): void {
    this.maxHistorySize = size;
    this.limitHistorySize();
  }

  /**
   * Enable/disable auto-save
   */
  setAutoSave(enabled: boolean): void {
    this.autoSave = enabled;
  }
}

export { TimeTravel } from "./TimeTravel.js";
export { BranchManager } from "./BranchManager.js";

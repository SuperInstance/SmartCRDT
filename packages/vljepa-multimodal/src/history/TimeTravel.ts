/**
 * TimeTravel - Undo/redo functionality
 *
 * Provides time travel capabilities for state history
 * with undo/redo operations.
 */

import type {
  MultiModalState,
  StateHistory as StateHistoryType,
} from "../types.js";

/**
 * Time travel manager
 */
export class TimeTravel {
  private history: StateHistoryType;
  private maxUndoDepth: number = 50;

  constructor(history: StateHistoryType) {
    this.history = history;
  }

  /**
   * Undo last change
   */
  undo(): MultiModalState | null {
    if (this.history.past.length === 0) {
      return null;
    }

    // Move current to future
    const currentSnapshot = {
      state: this.cloneState(this.history.current),
      timestamp: Date.now(),
      author: "system",
      description: "Undo operation",
      id: `undo_${Date.now()}`,
    };
    this.history.future.unshift(currentSnapshot);

    // Get last state from past
    const previousSnapshot = this.history.past.pop()!;
    this.history.current = previousSnapshot.state;

    return previousSnapshot.state;
  }

  /**
   * Redo last undone change
   */
  redo(): MultiModalState | null {
    if (this.history.future.length === 0) {
      return null;
    }

    // Move current to past
    const currentSnapshot = {
      state: this.cloneState(this.history.current),
      timestamp: Date.now(),
      author: "system",
      description: "Redo operation",
      id: `redo_${Date.now()}`,
    };
    this.history.past.push(currentSnapshot);

    // Get first state from future
    const nextSnapshot = this.history.future.shift()!;
    this.history.current = nextSnapshot.state;

    return nextSnapshot.state;
  }

  /**
   * Can undo?
   */
  canUndo(): boolean {
    return this.history.past.length > 0;
  }

  /**
   * Can redo?
   */
  canRedo(): boolean {
    return this.history.future.length > 0;
  }

  /**
   * Get undo stack size
   */
  getUndoStackSize(): number {
    return this.history.past.length;
  }

  /**
   * Get redo stack size
   */
  getRedoStackSize(): number {
    return this.history.future.length;
  }

  /**
   * Jump to specific point in history
   */
  jumpToPast(index: number): MultiModalState | null {
    if (index < 0 || index >= this.history.past.length) {
      return null;
    }

    // Save current state and all states after index to future
    const statesToFuture = this.history.past.slice(index + 1);
    this.history.future = [
      {
        state: this.cloneState(this.history.current),
        timestamp: Date.now(),
        author: "system",
        description: "Before jump",
        id: `jump_${Date.now()}`,
      },
      ...statesToFuture.map(s => ({
        ...s,
        state: this.cloneState(s.state),
      })),
    ];

    // Set current to target state
    const targetSnapshot = this.history.past[index];
    this.history.current = targetSnapshot.state;

    // Remove jumped states from past
    this.history.past = this.history.past.slice(0, index);

    return targetSnapshot.state;
  }

  /**
   * Jump to specific point in future
   */
  jumpToFuture(index: number): MultiModalState | null {
    if (index < 0 || index >= this.history.future.length) {
      return null;
    }

    // Save current state and all states before index to past
    const currentSnapshot = {
      state: this.cloneState(this.history.current),
      timestamp: Date.now(),
      author: "system",
      description: "Before jump to future",
      id: `jump_future_${Date.now()}`,
    };
    this.history.past.push(currentSnapshot);

    for (let i = 0; i < index; i++) {
      this.history.past.push({
        ...this.history.future[i],
        state: this.cloneState(this.history.future[i].state),
      });
    }

    // Set current to target state
    const targetSnapshot = this.history.future[index];
    this.history.current = targetSnapshot.state;

    // Remove jumped states from future
    this.history.future = this.history.future.slice(index + 1);

    return targetSnapshot.state;
  }

  /**
   * Clear undo stack
   */
  clearUndo(): void {
    this.history.past = [];
  }

  /**
   * Clear redo stack
   */
  clearRedo(): void {
    this.history.future = [];
  }

  /**
   * Clear both stacks
   */
  clearAll(): void {
    this.history.past = [];
    this.history.future = [];
  }

  /**
   * Set max undo depth
   */
  setMaxUndoDepth(depth: number): void {
    this.maxUndoDepth = depth;

    // Trim past if necessary
    while (this.history.past.length > this.maxUndoDepth) {
      this.history.past.shift();
    }
  }

  /**
   * Get max undo depth
   */
  getMaxUndoDepth(): number {
    return this.maxUndoDepth;
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
}

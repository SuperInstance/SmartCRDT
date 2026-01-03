/**
 * MultiModalState - Unified multi-modal state manager
 *
 * Combines text, visual, embedding, and fused states into
 * a single unified state with versioning and metadata tracking.
 */

import type {
  MultiModalState as MultiModalStateType,
  StateMetadata,
  StateUpdate,
  StateDiff,
  StateChangeEvent,
  StateChangeListener,
} from "../types.js";
import { TextStateManager } from "./TextState.js";
import { VisualStateManager } from "./VisualState.js";
import { EmbeddingStateManager } from "./EmbeddingState.js";
import { FusedStateManager } from "./FusedState.js";

/**
 * Multi-modal state manager
 */
export class MultiModalStateManager {
  private state: MultiModalStateType;
  private listeners: Set<StateChangeListener> = new Set();
  private versionCounter: number = 0;

  constructor(initialState?: Partial<MultiModalStateType>) {
    const id = initialState?.id || this.generateId();
    const timestamp = initialState?.timestamp || Date.now();

    this.state = {
      id,
      version: initialState?.version || 0,
      timestamp,
      modified: initialState?.modified || timestamp,
      text: initialState?.text || this.createDefaultTextState(),
      visual: initialState?.visual || this.createDefaultVisualState(),
      embedding: initialState?.embedding || this.createDefaultEmbeddingState(),
      fused: initialState?.fused || this.createDefaultFusedState(),
      metadata: initialState?.metadata || this.createDefaultMetadata(id),
      confidence: initialState?.confidence || 0.0,
    };

    this.versionCounter = this.state.version;
  }

  /**
   * Generate unique state ID
   */
  private generateId(): string {
    return `state_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create default text state
   */
  private createDefaultTextState() {
    return new TextStateManager().getState();
  }

  /**
   * Create default visual state
   */
  private createDefaultVisualState() {
    return new VisualStateManager().getState();
  }

  /**
   * Create default embedding state
   */
  private createDefaultEmbeddingState() {
    return new EmbeddingStateManager().getState();
  }

  /**
   * Create default fused state
   */
  private createDefaultFusedState() {
    return new FusedStateManager().getState();
  }

  /**
   * Create default metadata
   */
  private createDefaultMetadata(id: string): StateMetadata {
    return {
      id,
      version: 0,
      timestamp: Date.now(),
      author: "system",
      tags: [],
      properties: {},
    };
  }

  /**
   * Get current state
   */
  getState(): MultiModalStateType {
    return { ...this.state };
  }

  /**
   * Get state ID
   */
  getId(): string {
    return this.state.id;
  }

  /**
   * Get state version
   */
  getVersion(): number {
    return this.state.version;
  }

  /**
   * Get text state manager
   */
  getTextState(): TextStateManager {
    return new TextStateManager(this.state.text);
  }

  /**
   * Get visual state manager
   */
  getVisualState(): VisualStateManager {
    return new VisualStateManager(this.state.visual);
  }

  /**
   * Get embedding state manager
   */
  getEmbeddingState(): EmbeddingStateManager {
    return new EmbeddingStateManager(this.state.embedding);
  }

  /**
   * Get fused state manager
   */
  getFusedState(): FusedStateManager {
    return new FusedStateManager(this.state.fused);
  }

  /**
   * Update text state
   */
  updateTextState(updater: (manager: TextStateManager) => void): void {
    const previous = { ...this.state.text };
    const manager = new TextStateManager(this.state.text);
    updater(manager);

    this.state.text = manager.getState();
    this.incrementVersion();

    this.emit({
      type: "update",
      stateId: this.state.id,
      previous: { ...this.state, text: previous },
      current: this.getState(),
      changedFields: ["text"],
      timestamp: Date.now(),
    });
  }

  /**
   * Update visual state
   */
  updateVisualState(updater: (manager: VisualStateManager) => void): void {
    const previous = { ...this.state.visual };
    const manager = new VisualStateManager(this.state.visual);
    updater(manager);

    this.state.visual = manager.getState();
    this.incrementVersion();

    this.emit({
      type: "update",
      stateId: this.state.id,
      previous: { ...this.state, visual: previous },
      current: this.getState(),
      changedFields: ["visual"],
      timestamp: Date.now(),
    });
  }

  /**
   * Update embedding state
   */
  updateEmbeddingState(
    updater: (manager: EmbeddingStateManager) => void
  ): void {
    const previous = { ...this.state.embedding };
    const manager = new EmbeddingStateManager(this.state.embedding);
    updater(manager);

    this.state.embedding = manager.getState();
    this.incrementVersion();

    this.emit({
      type: "update",
      stateId: this.state.id,
      previous: { ...this.state, embedding: previous },
      current: this.getState(),
      changedFields: ["embedding"],
      timestamp: Date.now(),
    });
  }

  /**
   * Update fused state
   */
  updateFusedState(updater: (manager: FusedStateManager) => void): void {
    const previous = { ...this.state.fused };
    const manager = new FusedStateManager(this.state.fused);
    updater(manager);

    this.state.fused = manager.getState();
    this.incrementVersion();

    this.emit({
      type: "update",
      stateId: this.state.id,
      previous: { ...this.state, fused: previous },
      current: this.getState(),
      changedFields: ["fused"],
      timestamp: Date.now(),
    });
  }

  /**
   * Update overall confidence
   */
  updateConfidence(confidence: number): void {
    if (confidence < 0 || confidence > 1) {
      throw new Error(`Confidence must be between 0 and 1, got ${confidence}`);
    }

    const previous = this.state.confidence;
    this.state.confidence = confidence;
    this.incrementVersion();

    this.emit({
      type: "update",
      stateId: this.state.id,
      previous: { ...this.state, confidence: previous },
      current: this.getState(),
      changedFields: ["confidence"],
      timestamp: Date.now(),
    });
  }

  /**
   * Update metadata
   */
  updateMetadata(updater: (metadata: StateMetadata) => void): void {
    const previous = { ...this.state.metadata };
    updater(this.state.metadata);
    this.state.modified = Date.now();
    this.incrementVersion();

    this.emit({
      type: "update",
      stateId: this.state.id,
      previous: { ...this.state, metadata: previous },
      current: this.getState(),
      changedFields: ["metadata"],
      timestamp: Date.now(),
    });
  }

  /**
   * Add tag to metadata
   */
  addTag(tag: string): void {
    if (!this.state.metadata.tags.includes(tag)) {
      this.state.metadata.tags.push(tag);
      this.state.modified = Date.now();
      this.incrementVersion();
    }
  }

  /**
   * Remove tag from metadata
   */
  removeTag(tag: string): void {
    const index = this.state.metadata.tags.indexOf(tag);
    if (index >= 0) {
      this.state.metadata.tags.splice(index, 1);
      this.state.modified = Date.now();
      this.incrementVersion();
    }
  }

  /**
   * Get tags
   */
  getTags(): string[] {
    return [...this.state.metadata.tags];
  }

  /**
   * Check if has tag
   */
  hasTag(tag: string): boolean {
    return this.state.metadata.tags.includes(tag);
  }

  /**
   * Set metadata property
   */
  setProperty(key: string, value: unknown): void {
    this.state.metadata.properties[key] = value;
    this.state.modified = Date.now();
    this.incrementVersion();
  }

  /**
   * Get metadata property
   */
  getProperty(key: string): unknown {
    return this.state.metadata.properties[key];
  }

  /**
   * Apply partial update
   */
  applyUpdate(update: StateUpdate): void {
    const previous = { ...this.state };

    if (update.text) {
      Object.assign(this.state.text, update.text);
    }
    if (update.visual) {
      Object.assign(this.state.visual, update.visual);
    }
    if (update.embedding) {
      Object.assign(this.state.embedding, update.embedding);
    }
    if (update.fused) {
      Object.assign(this.state.fused, update.fused);
    }
    if (update.metadata) {
      Object.assign(this.state.metadata, update.metadata);
    }
    if (update.confidence !== undefined) {
      this.state.confidence = update.confidence;
    }

    this.incrementVersion();

    const changedFields = this.calculateChangedFields(previous, this.state);
    this.emit({
      type: "update",
      stateId: this.state.id,
      previous,
      current: this.getState(),
      changedFields,
      timestamp: Date.now(),
    });
  }

  /**
   * Calculate changed fields
   */
  private calculateChangedFields(
    previous: MultiModalStateType,
    current: MultiModalStateType
  ): string[] {
    const fields: string[] = [];

    if (previous.text.input !== current.text.input) fields.push("text.input");
    if (previous.text.intent !== current.text.intent)
      fields.push("text.intent");
    if (
      previous.visual.components.length !== current.visual.components.length
    ) {
      fields.push("visual.components");
    }
    if (previous.confidence !== current.confidence) fields.push("confidence");

    return fields;
  }

  /**
   * Diff with another state
   */
  diff(other: MultiModalStateType): StateDiff {
    const changes = new Map<string, { oldValue: unknown; newValue: unknown }>();
    const added: string[] = [];
    const removed: string[] = [];
    const modified: string[] = [];

    // Compare text input
    if (this.state.text.input !== other.text.input) {
      changes.set("text.input", {
        oldValue: this.state.text.input,
        newValue: other.text.input,
      });
      modified.push("text.input");
    }

    // Compare confidence
    if (this.state.confidence !== other.confidence) {
      changes.set("confidence", {
        oldValue: this.state.confidence,
        newValue: other.confidence,
      });
      modified.push("confidence");
    }

    // Compare tags
    for (const tag of this.state.metadata.tags) {
      if (!other.metadata.tags.includes(tag)) {
        removed.push(`metadata.tags.${tag}`);
      }
    }
    for (const tag of other.metadata.tags) {
      if (!this.state.metadata.tags.includes(tag)) {
        added.push(`metadata.tags.${tag}`);
      }
    }

    return { added, removed, modified, changes };
  }

  /**
   * Merge with another state
   */
  merge(other: MultiModalStateType): void {
    const previous = { ...this.state };

    // Merge text (prefer other)
    if (other.text.input) {
      this.state.text.input = other.text.input;
    }
    if (other.text.intent) {
      this.state.text.intent = other.text.intent;
    }

    // Merge visual components
    for (const component of other.visual.components) {
      const exists = this.state.visual.components.some(
        c =>
          c.type === component.type &&
          c.bbox[0] === component.bbox[0] &&
          c.bbox[1] === component.bbox[1]
      );
      if (!exists) {
        this.state.visual.components.push(component);
      }
    }

    // Merge tags
    for (const tag of other.metadata.tags) {
      if (!this.state.metadata.tags.includes(tag)) {
        this.state.metadata.tags.push(tag);
      }
    }

    // Merge properties
    Object.assign(this.state.metadata.properties, other.metadata.properties);

    // Use higher confidence
    if (other.confidence > this.state.confidence) {
      this.state.confidence = other.confidence;
    }

    this.incrementVersion();

    const changedFields = this.calculateChangedFields(previous, this.state);
    this.emit({
      type: "merge",
      stateId: this.state.id,
      previous,
      current: this.getState(),
      changedFields,
      timestamp: Date.now(),
    });
  }

  /**
   * Clone state
   */
  clone(): MultiModalStateManager {
    return new MultiModalStateManager({
      id: this.generateId(),
      version: 0,
      timestamp: Date.now(),
      modified: Date.now(),
      text: { ...this.state.text },
      visual: { ...this.state.visual },
      embedding: { ...this.state.embedding },
      fused: { ...this.state.fused },
      metadata: {
        ...this.state.metadata,
        tags: [...this.state.metadata.tags],
        properties: { ...this.state.metadata.properties },
      },
      confidence: this.state.confidence,
    });
  }

  /**
   * Add state change listener
   */
  onChange(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Emit state change event
   */
  private emit(event: StateChangeEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("Error in state change listener:", error);
      }
    }
  }

  /**
   * Increment version
   */
  private incrementVersion(): void {
    this.versionCounter++;
    this.state.version = this.versionCounter;
    this.state.modified = Date.now();
  }

  /**
   * Serialize to JSON
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.state.id,
      version: this.state.version,
      timestamp: this.state.timestamp,
      modified: this.state.modified,
      text: {
        input: this.state.text.input,
        intent: this.state.text.intent,
        entities: this.state.text.entities,
        sentiment: this.state.text.sentiment,
        embedding: Array.from(this.state.text.embedding),
        timestamp: this.state.text.timestamp,
      },
      visual: {
        frames: this.state.visual.frames,
        components: this.state.visual.components,
        layout: this.state.visual.layout,
        embedding: Array.from(this.state.visual.embedding),
        timestamp: this.state.visual.timestamp,
      },
      embedding: {
        vector: Array.from(this.state.embedding.vector),
        textContribution: Array.from(this.state.embedding.textContribution),
        visualContribution: Array.from(this.state.embedding.visualContribution),
        timestamp: this.state.embedding.timestamp,
      },
      fused: {
        embedding: Array.from(this.state.fused.embedding),
        confidence: this.state.fused.confidence,
        reasoning: this.state.fused.reasoning,
        timestamp: this.state.fused.timestamp,
      },
      metadata: this.state.metadata,
      confidence: this.state.confidence,
    };
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(data: Record<string, unknown>): MultiModalStateManager {
    const textData = data.text as {
      input: string;
      intent: string;
      entities: unknown[];
      sentiment: unknown;
      embedding: number[];
      timestamp: number;
    };

    const visualData = data.visual as {
      frames: unknown[];
      components: unknown[];
      layout: unknown;
      embedding: number[];
      timestamp: number;
    };

    const embeddingData = data.embedding as {
      vector: number[];
      textContribution: number[];
      visualContribution: number[];
      timestamp: number;
    };

    const fusedData = data.fused as {
      embedding: number[];
      confidence: number;
      reasoning: string;
      timestamp: number;
    };

    return new MultiModalStateManager({
      id: data.id as string,
      version: data.version as number,
      timestamp: data.timestamp as number,
      modified: data.modified as number,
      text: {
        ...textData,
        embedding: new Float32Array(textData.embedding),
      },
      visual: {
        ...visualData,
        embedding: new Float32Array(visualData.embedding),
      },
      embedding: {
        ...embeddingData,
        vector: new Float32Array(embeddingData.vector),
        textContribution: new Float32Array(embeddingData.textContribution),
        visualContribution: new Float32Array(embeddingData.visualContribution),
      },
      fused: {
        ...fusedData,
        embedding: new Float32Array(fusedData.embedding),
      },
      metadata: data.metadata as StateMetadata,
      confidence: data.confidence as number,
    });
  }
}

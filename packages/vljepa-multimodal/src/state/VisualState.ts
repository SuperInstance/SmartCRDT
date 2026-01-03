/**
 * VisualState - Visual/image state component
 *
 * Manages image frames, UI components detection,
 * layout extraction, and visual embeddings.
 */

import type {
  ImageFrame,
  UIComponent,
  LayoutInfo,
  VisualState as VisualStateType,
} from "../types.js";

/**
 * Visual state manager
 */
export class VisualStateManager {
  private state: VisualStateType;

  constructor(initialState?: Partial<VisualStateType>) {
    this.state = {
      frames: initialState?.frames || [],
      components: initialState?.components || [],
      layout: initialState?.layout || this.createDefaultLayout(),
      embedding: initialState?.embedding || new Float32Array(768),
      timestamp: initialState?.timestamp || Date.now(),
    };
  }

  /**
   * Create default layout
   */
  private createDefaultLayout(): LayoutInfo {
    return {
      type: "unknown",
      hierarchy: [],
      spacing: {
        horizontal: 0,
        vertical: 0,
      },
    };
  }

  /**
   * Get current state
   */
  getState(): VisualStateType {
    return { ...this.state };
  }

  /**
   * Add image frame
   */
  addFrame(frame: ImageFrame): void {
    this.state.frames.push(frame);
    this.state.timestamp = Date.now();
  }

  /**
   * Remove frame by ID
   */
  removeFrame(frameId: string): void {
    this.state.frames = this.state.frames.filter(f => f.id !== frameId);
    this.state.timestamp = Date.now();
  }

  /**
   * Get frame by ID
   */
  getFrame(frameId: string): ImageFrame | undefined {
    return this.state.frames.find(f => f.id === frameId);
  }

  /**
   * Get latest frame
   */
  getLatestFrame(): ImageFrame | undefined {
    if (this.state.frames.length === 0) {
      return undefined;
    }
    return this.state.frames[this.state.frames.length - 1];
  }

  /**
   * Update UI components
   */
  updateComponents(components: UIComponent[]): void {
    this.state.components = components;
    this.state.timestamp = Date.now();
  }

  /**
   * Add UI component
   */
  addComponent(component: UIComponent): void {
    this.state.components.push(component);
    this.state.timestamp = Date.now();
  }

  /**
   * Remove UI component by index
   */
  removeComponent(index: number): void {
    if (index >= 0 && index < this.state.components.length) {
      this.state.components.splice(index, 1);
      this.state.timestamp = Date.now();
    }
  }

  /**
   * Get components by type
   */
  getComponentsByType(type: string): UIComponent[] {
    return this.state.components.filter(c => c.type === type);
  }

  /**
   * Get components in region
   */
  getComponentsInRegion(
    x: number,
    y: number,
    width: number,
    height: number
  ): UIComponent[] {
    return this.state.components.filter(c => {
      const [cx, cy, cw, ch] = c.bbox;
      return cx < x + width && cx + cw > x && cy < y + height && cy + ch > y;
    });
  }

  /**
   * Update layout
   */
  updateLayout(layout: LayoutInfo): void {
    this.state.layout = layout;
    this.state.timestamp = Date.now();
  }

  /**
   * Update visual embedding
   */
  updateEmbedding(embedding: Float32Array): void {
    if (embedding.length !== 768) {
      throw new Error(
        `Visual embedding must be 768-dimensional, got ${embedding.length}`
      );
    }
    this.state.embedding = embedding;
    this.state.timestamp = Date.now();
  }

  /**
   * Get component count
   */
  getComponentCount(): number {
    return this.state.components.length;
  }

  /**
   * Get frame count
   */
  getFrameCount(): number {
    return this.state.frames.length;
  }

  /**
   * Clear all frames
   */
  clearFrames(): void {
    this.state.frames = [];
    this.state.timestamp = Date.now();
  }

  /**
   * Clear all components
   */
  clearComponents(): void {
    this.state.components = [];
    this.state.timestamp = Date.now();
  }

  /**
   * Clone state
   */
  clone(): VisualStateManager {
    return new VisualStateManager({
      ...this.state,
      embedding: new Float32Array(this.state.embedding),
      frames: this.state.frames.map(f => ({ ...f })),
      components: this.state.components.map(c => ({
        ...c,
        attributes: { ...c.attributes },
      })),
      layout: {
        ...this.state.layout,
        hierarchy: this.state.layout.hierarchy.map(h => ({
          ...h,
          attributes: { ...h.attributes },
        })),
        spacing: { ...this.state.layout.spacing },
      },
    });
  }

  /**
   * Serialize to JSON
   */
  toJSON(): Record<string, unknown> {
    return {
      frames: this.state.frames.map(f => ({
        ...f,
        data: typeof f.data === "string" ? f.data : "Uint8Array",
      })),
      components: this.state.components,
      layout: this.state.layout,
      embedding: Array.from(this.state.embedding),
      timestamp: this.state.timestamp,
    };
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(data: Record<string, unknown>): VisualStateManager {
    const embedding = data.embedding as number[];
    const frames = data.frames as ImageFrame[];
    const components = data.components as UIComponent[];
    const layout = data.layout as LayoutInfo;

    return new VisualStateManager({
      frames: frames.map(f => ({ ...f, data: f.data as string | Uint8Array })),
      components,
      layout,
      embedding: new Float32Array(embedding),
      timestamp: data.timestamp as number,
    });
  }
}

/**
 * TextState - Text/language state component
 *
 * Manages text input, intent classification, entity extraction,
 * sentiment analysis, and text embeddings.
 */

import type {
  Entity,
  Sentiment,
  TextState as TextStateType,
} from "../types.js";

/**
 * Text state manager
 */
export class TextStateManager {
  private state: TextStateType;

  constructor(initialState?: Partial<TextStateType>) {
    this.state = {
      input: initialState?.input || "",
      intent: initialState?.intent || "",
      entities: initialState?.entities || [],
      sentiment: initialState?.sentiment || this.createNeutralSentiment(),
      embedding: initialState?.embedding || new Float32Array(768),
      timestamp: initialState?.timestamp || Date.now(),
    };
  }

  /**
   * Create neutral sentiment
   */
  private createNeutralSentiment(): Sentiment {
    return {
      label: "neutral",
      confidence: 0.5,
      scores: {
        positive: 0.33,
        negative: 0.33,
        neutral: 0.34,
      },
    };
  }

  /**
   * Get current state
   */
  getState(): TextStateType {
    return { ...this.state };
  }

  /**
   * Update input text
   */
  updateInput(input: string): void {
    this.state.input = input;
    this.state.timestamp = Date.now();
  }

  /**
   * Update intent classification
   */
  updateIntent(intent: string): void {
    this.state.intent = intent;
    this.state.timestamp = Date.now();
  }

  /**
   * Update entities
   */
  updateEntities(entities: Entity[]): void {
    this.state.entities = entities;
    this.state.timestamp = Date.now();
  }

  /**
   * Add entity
   */
  addEntity(entity: Entity): void {
    this.state.entities.push(entity);
    this.state.timestamp = Date.now();
  }

  /**
   * Remove entity by index
   */
  removeEntity(index: number): void {
    if (index >= 0 && index < this.state.entities.length) {
      this.state.entities.splice(index, 1);
      this.state.timestamp = Date.now();
    }
  }

  /**
   * Update sentiment
   */
  updateSentiment(sentiment: Sentiment): void {
    this.state.sentiment = sentiment;
    this.state.timestamp = Date.now();
  }

  /**
   * Update text embedding
   */
  updateEmbedding(embedding: Float32Array): void {
    if (embedding.length !== 768) {
      throw new Error(
        `Text embedding must be 768-dimensional, got ${embedding.length}`
      );
    }
    this.state.embedding = embedding;
    this.state.timestamp = Date.now();
  }

  /**
   * Get entities by type
   */
  getEntitiesByType(type: string): Entity[] {
    return this.state.entities.filter(e => e.type === type);
  }

  /**
   * Get entity count
   */
  getEntityCount(): number {
    return this.state.entities.length;
  }

  /**
   * Get dominant sentiment
   */
  getDominantSentiment(): string {
    return this.state.sentiment.label;
  }

  /**
   * Clone state
   */
  clone(): TextStateManager {
    return new TextStateManager({
      ...this.state,
      embedding: new Float32Array(this.state.embedding),
      entities: this.state.entities.map(e => ({ ...e })),
      sentiment: { ...this.state.sentiment },
    });
  }

  /**
   * Serialize to JSON
   */
  toJSON(): Record<string, unknown> {
    return {
      input: this.state.input,
      intent: this.state.intent,
      entities: this.state.entities,
      sentiment: this.state.sentiment,
      embedding: Array.from(this.state.embedding),
      timestamp: this.state.timestamp,
    };
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(data: Record<string, unknown>): TextStateManager {
    const embedding = data.embedding as number[];
    return new TextStateManager({
      input: data.input as string,
      intent: data.intent as string,
      entities: data.entities as Entity[],
      sentiment: data.sentiment as Sentiment,
      embedding: new Float32Array(embedding),
      timestamp: data.timestamp as number,
    });
  }
}

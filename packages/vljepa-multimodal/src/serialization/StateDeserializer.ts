/**
 * StateDeserializer - Deserialize multi-modal states
 *
 * Deserialize states from various formats.
 */

import type { MultiModalState, SerializationFormat } from "../types.js";

/**
 * State deserializer
 */
export class StateDeserializer {
  /**
   * Deserialize state
   */
  async deserialize(
    data: Uint8Array | string,
    format: SerializationFormat = "json"
  ): Promise<MultiModalState> {
    switch (format) {
      case "json":
        return this.fromJSON(data);
      case "binary":
        return this.fromBinary(data);
      case "messagepack":
        return this.fromMessagePack(data);
      default:
        throw new Error(`Unknown format: ${format}`);
    }
  }

  /**
   * Deserialize from JSON
   */
  private fromJSON(data: Uint8Array | string): MultiModalState {
    const json =
      typeof data === "string" ? data : new TextDecoder().decode(data);
    const obj = JSON.parse(json);

    return this.parseState(obj);
  }

  /**
   * Deserialize from binary
   */
  private fromBinary(data: Uint8Array): MultiModalState {
    const json = new TextDecoder().decode(data);
    const obj = JSON.parse(json);

    return this.parseState(obj);
  }

  /**
   * Deserialize from MessagePack
   */
  private fromMessagePack(data: Uint8Array): MultiModalState {
    // Simplified MessagePack parsing
    const json = new TextDecoder().decode(data.slice(1)); // Skip prefix
    const obj = JSON.parse(json);

    return this.parseState(obj);
  }

  /**
   * Parse state object
   */
  private parseState(obj: any): MultiModalState {
    return {
      id: obj.id,
      version: obj.version,
      timestamp: obj.timestamp,
      modified: obj.modified,
      text: {
        input: obj.text.input,
        intent: obj.text.intent,
        entities: obj.text.entities,
        sentiment: obj.text.sentiment,
        embedding: new Float32Array(obj.text.embedding || []),
        timestamp: obj.text.timestamp,
      },
      visual: {
        frames: obj.visual.frames || [],
        components: obj.visual.components,
        layout: obj.visual.layout,
        embedding: new Float32Array(obj.visual.embedding || []),
        timestamp: obj.visual.timestamp,
      },
      embedding: {
        vector: new Float32Array(obj.embedding.vector || []),
        textContribution: new Float32Array(
          obj.embedding.textContribution || []
        ),
        visualContribution: new Float32Array(
          obj.embedding.visualContribution || []
        ),
        timestamp: obj.embedding.timestamp,
      },
      fused: {
        embedding: new Float32Array(obj.fused.embedding || []),
        attention: {
          text: new Map(Object.entries(obj.fused.attention?.text || {})),
          visual: new Map(Object.entries(obj.fused.attention?.visual || {})),
          crossModal: new Map(),
        },
        confidence: obj.fused.confidence,
        reasoning: obj.fused.reasoning,
        timestamp: obj.fused.timestamp,
      },
      metadata: obj.metadata,
      confidence: obj.confidence,
    };
  }

  /**
   * Deserialize batch of states
   */
  async deserializeBatch(
    dataArray: Array<Uint8Array | string>,
    format: SerializationFormat = "json"
  ): Promise<MultiModalState[]> {
    const states: MultiModalState[] = [];

    for (const data of dataArray) {
      const state = await this.deserialize(data, format);
      states.push(state);
    }

    return states;
  }

  /**
   * Validate serialized data
   */
  validate(
    data: Uint8Array | string,
    format: SerializationFormat = "json"
  ): boolean {
    try {
      const state = this.deserialize(data, format);

      // Check required fields
      if (!state.id || typeof state.id !== "string") return false;
      if (typeof state.version !== "number") return false;
      if (typeof state.timestamp !== "number") return false;
      if (typeof state.confidence !== "number") return false;

      // Check embeddings
      if (state.text.embedding.length !== 768) return false;
      if (state.visual.embedding.length !== 768) return false;
      if (state.embedding.vector.length !== 768) return false;
      if (state.fused.embedding.length !== 768) return false;

      return true;
    } catch {
      return false;
    }
  }
}

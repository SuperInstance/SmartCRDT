/**
 * StateSerializer - Serialize multi-modal states
 *
 * Serialize states to various formats for storage
 * and transmission.
 */

import type {
  MultiModalState,
  SerializationOptions,
  SerializationResult,
  SerializationFormat,
} from "../types.js";

/**
 * State serializer
 */
export class StateSerializer {
  private defaultOptions: SerializationOptions = {
    format: "json",
    compress: false,
    compressionLevel: 6,
    includeEmbeddings: true,
    includeMetadata: true,
  };

  /**
   * Serialize state
   */
  async serialize(
    state: MultiModalState,
    options?: Partial<SerializationOptions>
  ): Promise<SerializationResult> {
    const opts = { ...this.defaultOptions, ...options };
    const startTime = performance.now();

    // Convert to serializable format
    const serializable = this.toSerializable(state, opts);

    let data: Uint8Array | string;
    let size = 0;

    switch (opts.format) {
      case "json":
        data = this.toJSON(serializable);
        size = data.length;
        break;

      case "binary":
        data = this.toBinary(serializable);
        size = data.byteLength;
        break;

      case "messagepack":
        data = this.toMessagePack(serializable);
        size = data.byteLength;
        break;

      default:
        throw new Error(`Unknown format: ${opts.format}`);
    }

    // Compress if requested
    let compressionRatio: number | undefined;
    if (opts.compress) {
      const uncompressedSize = size;
      data = await this.compress(data, opts.compressionLevel || 6);
      size = data.byteLength;
      compressionRatio = size / uncompressedSize;
    }

    const duration = performance.now() - startTime;

    return {
      data,
      size,
      compressionRatio,
      duration,
    };
  }

  /**
   * Serialize batch of states
   */
  async serializeBatch(
    states: MultiModalState[],
    options?: Partial<SerializationOptions>
  ): Promise<SerializationResult[]> {
    const results: SerializationResult[] = [];

    for (const state of states) {
      const result = await this.serialize(state, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Convert state to serializable object
   */
  private toSerializable(
    state: MultiModalState,
    options: SerializationOptions
  ): Record<string, unknown> {
    const serializable: Record<string, unknown> = {
      id: state.id,
      version: state.version,
      timestamp: state.timestamp,
      modified: state.modified,
      confidence: state.confidence,
    };

    // Text state
    serializable.text = {
      input: state.text.input,
      intent: state.text.intent,
      entities: state.text.entities,
      sentiment: state.text.sentiment,
      embedding: options.includeEmbeddings
        ? Array.from(state.text.embedding)
        : [],
      timestamp: state.text.timestamp,
    };

    // Visual state
    serializable.visual = {
      frames: state.visual.frames.map(f => ({
        id: f.id,
        width: f.width,
        height: f.height,
        timestamp: f.timestamp,
        dataSize:
          typeof f.data === "string" ? f.data.length : f.data.byteLength,
      })),
      components: state.visual.components,
      layout: state.visual.layout,
      embedding: options.includeEmbeddings
        ? Array.from(state.visual.embedding)
        : [],
      timestamp: state.visual.timestamp,
    };

    // Embedding state
    serializable.embedding = options.includeEmbeddings
      ? {
          vector: Array.from(state.embedding.vector),
          textContribution: Array.from(state.embedding.textContribution),
          visualContribution: Array.from(state.embedding.visualContribution),
          timestamp: state.embedding.timestamp,
        }
      : { timestamp: state.embedding.timestamp };

    // Fused state
    serializable.fused = options.includeEmbeddings
      ? {
          embedding: Array.from(state.fused.embedding),
          confidence: state.fused.confidence,
          reasoning: state.fused.reasoning,
          timestamp: state.fused.timestamp,
        }
      : {
          confidence: state.fused.confidence,
          reasoning: state.fused.reasoning,
          timestamp: state.fused.timestamp,
        };

    // Metadata
    if (options.includeMetadata) {
      serializable.metadata = state.metadata;
    }

    return serializable;
  }

  /**
   * Convert to JSON
   */
  private toJSON(obj: Record<string, unknown>): string {
    return JSON.stringify(obj);
  }

  /**
   * Convert to binary format
   */
  private toBinary(obj: Record<string, unknown>): Uint8Array {
    const json = JSON.stringify(obj);
    const encoder = new TextEncoder();
    return encoder.encode(json);
  }

  /**
   * Convert to MessagePack format
   */
  private toMessagePack(obj: Record<string, unknown>): Uint8Array {
    // Simplified MessagePack encoding
    // In production, use a proper MessagePack library
    const json = JSON.stringify(obj);
    const encoder = new TextEncoder();
    const data = encoder.encode(json);

    // Add MessagePack prefix (simplified)
    const buffer = new Uint8Array(data.length + 1);
    buffer[0] = 0xdc; // array16 marker
    buffer.set(data, 1);

    return buffer;
  }

  /**
   * Compress data (simplified - would use compression library in production)
   */
  private async compress(
    data: Uint8Array | string,
    level: number
  ): Promise<Uint8Array> {
    // Simplified compression - in production use zlib, brotli, etc.
    if (typeof data === "string") {
      const encoder = new TextEncoder();
      data = encoder.encode(data);
    }

    // Just return the data for now (no actual compression)
    return data;
  }

  /**
   * Get serialization size estimate
   */
  estimateSize(
    state: MultiModalState,
    options?: Partial<SerializationOptions>
  ): number {
    const opts = { ...this.defaultOptions, ...options };

    let size = 0;

    // Base fields
    size += state.id.length * 2; // UTF-16
    size += 8; // version
    size += 8; // timestamp
    size += 8; // modified
    size += 8; // confidence

    // Text
    size += state.text.input.length * 2;
    size += state.text.intent.length * 2;
    size += state.text.entities.length * 100; // rough estimate
    if (opts.includeEmbeddings) {
      size += state.text.embedding.length * 4;
    }

    // Visual
    size += state.visual.components.length * 200;
    if (opts.includeEmbeddings) {
      size += state.visual.embedding.length * 4;
    }

    // Embedding
    if (opts.includeEmbeddings) {
      size += state.embedding.vector.length * 4;
      size += state.embedding.textContribution.length * 4;
      size += state.embedding.visualContribution.length * 4;
    }

    // Fused
    if (opts.includeEmbeddings) {
      size += state.fused.embedding.length * 4;
    }
    size += state.fused.reasoning.length * 2;

    // Metadata
    if (opts.includeMetadata) {
      size += state.metadata.tags.reduce((sum, tag) => sum + tag.length * 2, 0);
    }

    return size;
  }

  /**
   * Update default options
   */
  updateOptions(options: Partial<SerializationOptions>): void {
    Object.assign(this.defaultOptions, options);
  }

  /**
   * Get current options
   */
  getOptions(): SerializationOptions {
    return { ...this.defaultOptions };
  }
}

export { StateDeserializer } from "./StateDeserializer.js";
export { Compression } from "./Compression.js";

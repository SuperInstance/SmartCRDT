/**
 * @lsi/vljepa-video/output/EmbeddingStream
 *
 * Embedding stream for streaming video embeddings to clients.
 *
 * @version 1.0.0
 */

import type {
  StreamConfig,
  StreamResult,
  StreamMetadata,
  PredictedAction,
  ActionStreamResult,
} from "../types.js";

/**
 * Embedding stream
 *
 * Streams embeddings from processed video frames.
 */
export class EmbeddingStream {
  private config: StreamConfig;
  private buffer: Float32Array[] = [];
  private frameIds: number[] = [];
  private isStreaming: boolean = false;
  private streamId: string;
  private sequenceNumber: number = 0;
  private clientCallbacks: Array<(result: StreamResult) => void> = [];

  constructor(config: StreamConfig) {
    this.config = config;
    this.streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start streaming
   */
  async start(): Promise<void> {
    if (this.isStreaming) {
      throw new Error("Already streaming");
    }

    this.isStreaming = true;

    // Connect to endpoint if specified
    if (this.config.endpoint) {
      await this.connectToEndpoint();
    }
  }

  /**
   * Stop streaming
   */
  async stop(): Promise<void> {
    this.isStreaming = false;

    // Flush remaining buffer
    if (this.buffer.length > 0) {
      await this.flush();
    }
  }

  /**
   * Add embedding to stream
   */
  async add(embedding: Float32Array, frameId: number): Promise<void> {
    this.buffer.push(embedding);
    this.frameIds.push(frameId);

    // Check if batch is ready
    if (this.buffer.length >= this.config.batchSize) {
      await this.flush();
    }
  }

  /**
   * Flush current buffer
   */
  async flush(): Promise<StreamResult | null> {
    if (this.buffer.length === 0) {
      return null;
    }

    const result = this.createStreamResult();

    // Notify clients
    for (const callback of this.clientCallbacks) {
      try {
        callback(result);
      } catch (error) {
        console.error("Error in client callback:", error);
      }
    }

    // Clear buffer
    this.buffer = [];
    this.frameIds = [];

    return result;
  }

  /**
   * Create stream result
   */
  private createStreamResult(): StreamResult {
    const embeddings = [...this.buffer];
    const frameIds = [...this.frameIds];

    let data: Uint8Array;

    switch (this.config.format) {
      case "json":
        data = this.encodeJSON(embeddings);
        break;
      case "binary":
        data = this.encodeBinary(embeddings);
        break;
      case "protobuf":
        data = this.encodeProtobuf(embeddings);
        break;
      default:
        data = this.encodeBinary(embeddings);
    }

    // Apply compression if enabled
    if (this.config.compression) {
      data = this.compress(data);
    }

    const metadata: StreamMetadata = {
      streamId: this.streamId,
      frameIds,
      encoding: this.config.format,
      compression: this.config.compression ? "gzip" : undefined,
    };

    return {
      embeddings,
      metadata,
      timestamp: performance.now(),
      sequence: this.sequenceNumber++,
    };
  }

  /**
   * Encode embeddings as JSON
   */
  private encodeJSON(embeddings: Float32Array[]): Uint8Array {
    const obj = {
      embeddings: embeddings.map(e => Array.from(e)),
    };

    const json = JSON.stringify(obj);
    return new TextEncoder().encode(json);
  }

  /**
   * Encode embeddings as binary
   */
  private encodeBinary(embeddings: Float32Array[]): Uint8Array {
    // Format: [count][dim][embedding1][embedding2]...
    const count = embeddings.length;
    const dim = embeddings[0]?.length || 768;

    const buffer = new ArrayBuffer(4 + 4 + count * dim * 4);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // Write count
    view.setUint32(0, count, true);

    // Write dimension
    view.setUint32(4, dim, true);

    // Write embeddings
    let offset = 8;
    for (const embedding of embeddings) {
      for (let i = 0; i < embedding.length; i++) {
        view.setFloat32(offset, embedding[i], true);
        offset += 4;
      }
    }

    return bytes;
  }

  /**
   * Encode embeddings as protobuf
   */
  private encodeProtobuf(embeddings: Float32Array[]): Uint8Array {
    // Simplified protobuf encoding
    // In production, use proper protobuf library
    return this.encodeBinary(embeddings);
  }

  /**
   * Compress data
   */
  private compress(data: Uint8Array): Uint8Array {
    // Placeholder for compression
    // In production, use CompressionStream or similar
    return data;
  }

  /**
   * Connect to WebSocket endpoint
   */
  private async connectToEndpoint(): Promise<void> {
    // Placeholder for WebSocket connection
    // In production, establish WebSocket connection
  }

  /**
   * Register client callback
   */
  onStream(callback: (result: StreamResult) => void): void {
    this.clientCallbacks.push(callback);
  }

  /**
   * Remove client callback
   */
  offStream(callback: (result: StreamResult) => void): void {
    const index = this.clientCallbacks.indexOf(callback);
    if (index >= 0) {
      this.clientCallbacks.splice(index, 1);
    }
  }

  /**
   * Get stream statistics
   */
  getStats(): {
    streamId: string;
    isStreaming: boolean;
    bufferSize: number;
    sequenceNumber: number;
    clientCount: number;
  } {
    return {
      streamId: this.streamId,
      isStreaming: this.isStreaming,
      bufferSize: this.buffer.length,
      sequenceNumber: this.sequenceNumber,
      clientCount: this.clientCallbacks.length,
    };
  }

  /**
   * Clear buffer
   */
  clearBuffer(): void {
    this.buffer = [];
    this.frameIds = [];
  }
}

/**
 * Action stream
 *
 * Streams predicted actions from video understanding.
 */
export class ActionStream {
  private config: StreamConfig;
  private buffer: Array<{
    actions: PredictedAction[];
    confidences: number[];
    frameId: number;
  }> = [];
  private isStreaming: boolean = false;
  private streamId: string;
  private sequenceNumber: number = 0;
  private clientCallbacks: Array<(result: ActionStreamResult) => void> = [];

  constructor(config: StreamConfig) {
    this.config = config;
    this.streamId = `action_stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start streaming
   */
  async start(): Promise<void> {
    if (this.isStreaming) {
      throw new Error("Already streaming");
    }

    this.isStreaming = true;
  }

  /**
   * Stop streaming
   */
  async stop(): Promise<void> {
    this.isStreaming = false;

    if (this.buffer.length > 0) {
      await this.flush();
    }
  }

  /**
   * Add actions to stream
   */
  async add(
    actions: PredictedAction[],
    confidences: number[],
    frameId: number
  ): Promise<void> {
    this.buffer.push({ actions, confidences, frameId });

    if (this.buffer.length >= this.config.batchSize) {
      await this.flush();
    }
  }

  /**
   * Flush current buffer
   */
  async flush(): Promise<ActionStreamResult | null> {
    if (this.buffer.length === 0) {
      return null;
    }

    const allActions = this.buffer.flatMap(b => b.actions);
    const allConfidences = this.buffer.flatMap(b => b.confidences);
    const frameIds = this.buffer.map(b => b.frameId);

    const metadata: StreamMetadata = {
      streamId: this.streamId,
      frameIds,
      encoding: this.config.format,
      compression: this.config.compression ? "gzip" : undefined,
    };

    const result: ActionStreamResult = {
      actions: allActions,
      confidences: allConfidences,
      metadata,
      timestamp: performance.now(),
    };

    // Notify clients
    for (const callback of this.clientCallbacks) {
      try {
        callback(result);
      } catch (error) {
        console.error("Error in client callback:", error);
      }
    }

    this.buffer = [];
    this.sequenceNumber++;

    return result;
  }

  /**
   * Register client callback
   */
  onStream(callback: (result: ActionStreamResult) => void): void {
    this.clientCallbacks.push(callback);
  }

  /**
   * Remove client callback
   */
  offStream(callback: (result: ActionStreamResult) => void): void {
    const index = this.clientCallbacks.indexOf(callback);
    if (index >= 0) {
      this.clientCallbacks.splice(index, 1);
    }
  }

  /**
   * Get stream statistics
   */
  getStats(): {
    streamId: string;
    isStreaming: boolean;
    bufferSize: number;
    sequenceNumber: number;
    clientCount: number;
  } {
    return {
      streamId: this.streamId,
      isStreaming: this.isStreaming,
      bufferSize: this.buffer.length,
      sequenceNumber: this.sequenceNumber,
      clientCount: this.clientCallbacks.length,
    };
  }
}

/**
 * Metadata stream
 *
 * Streams metadata about processed frames.
 */
export class MetadataStream {
  private config: StreamConfig;
  private buffer: Array<{
    frameId: number;
    timestamp: number;
    metadata: Record<string, unknown>;
  }> = [];
  private isStreaming: boolean = false;
  private streamId: string;
  private sequenceNumber: number = 0;

  constructor(config: StreamConfig) {
    this.config = config;
    this.streamId = `metadata_stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start streaming
   */
  async start(): Promise<void> {
    this.isStreaming = true;
  }

  /**
   * Stop streaming
   */
  async stop(): Promise<void> {
    this.isStreaming = false;

    if (this.buffer.length > 0) {
      await this.flush();
    }
  }

  /**
   * Add metadata to stream
   */
  async add(
    frameId: number,
    timestamp: number,
    metadata: Record<string, unknown>
  ): Promise<void> {
    this.buffer.push({ frameId, timestamp, metadata });

    if (this.buffer.length >= this.config.batchSize) {
      await this.flush();
    }
  }

  /**
   * Flush current buffer
   */
  async flush(): Promise<{
    metadata: typeof this.buffer;
    timestamp: number;
    sequence: number;
  } | null> {
    if (this.buffer.length === 0) {
      return null;
    }

    const result = {
      metadata: [...this.buffer],
      timestamp: performance.now(),
      sequence: this.sequenceNumber++,
    };

    this.buffer = [];

    return result;
  }

  /**
   * Get stream statistics
   */
  getStats(): {
    streamId: string;
    isStreaming: boolean;
    bufferSize: number;
    sequenceNumber: number;
  } {
    return {
      streamId: this.streamId,
      isStreaming: this.isStreaming,
      bufferSize: this.buffer.length,
      sequenceNumber: this.sequenceNumber,
    };
  }
}

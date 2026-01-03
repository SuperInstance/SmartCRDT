/**
 * @lsi/vljepa-video/output/MetadataStream
 *
 * Metadata stream for streaming frame metadata.
 *
 * @version 1.0.0
 */

import type { StreamConfig } from "../types.js";

/**
 * Frame metadata entry
 */
export interface MetadataEntry {
  /** Frame identifier */
  frameId: number;

  /** Timestamp */
  timestamp: number;

  /** Metadata */
  metadata: Record<string, unknown>;

  /** Additional flags */
  flags?: {
    /** Is keyframe */
    keyframe?: boolean;

    /** Is dropped */
    dropped?: boolean;

    /** Has motion */
    hasMotion?: boolean;
  };
}

/**
 * Metadata stream
 *
 * Streams metadata about processed frames.
 */
export class MetadataStream {
  private config: StreamConfig;
  private buffer: MetadataEntry[] = [];
  private isStreaming: boolean = false;
  private streamId: string;
  private sequenceNumber: number = 0;
  private clientCallbacks: Array<(result: MetadataStreamResult) => void> = [];
  private metadataHistory: MetadataEntry[] = [];
  private maxHistory: number = 1000;

  constructor(config: StreamConfig) {
    this.config = config;
    this.streamId = `metadata_stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
   * Add metadata to stream
   */
  async add(
    frameId: number,
    timestamp: number,
    metadata: Record<string, unknown>,
    flags?: MetadataEntry["flags"]
  ): Promise<void> {
    const entry: MetadataEntry = {
      frameId,
      timestamp,
      metadata,
      flags,
    };

    this.buffer.push(entry);
    this.metadataHistory.push(entry);

    // Trim history
    if (this.metadataHistory.length > this.maxHistory) {
      this.metadataHistory.shift();
    }

    // Check if batch is ready
    if (this.buffer.length >= this.config.batchSize) {
      await this.flush();
    }
  }

  /**
   * Flush current buffer
   */
  async flush(): Promise<MetadataStreamResult | null> {
    if (this.buffer.length === 0) {
      return null;
    }

    const result: MetadataStreamResult = {
      metadata: [...this.buffer],
      timestamp: performance.now(),
      sequence: this.sequenceNumber++,
      streamId: this.streamId,
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

    return result;
  }

  /**
   * Register client callback
   */
  onStream(callback: (result: MetadataStreamResult) => void): void {
    this.clientCallbacks.push(callback);
  }

  /**
   * Remove client callback
   */
  offStream(callback: (result: MetadataStreamResult) => void): void {
    const index = this.clientCallbacks.indexOf(callback);
    if (index >= 0) {
      this.clientCallbacks.splice(index, 1);
    }
  }

  /**
   * Get metadata history
   */
  getHistory(count?: number): MetadataEntry[] {
    if (count) {
      return this.metadataHistory.slice(-count);
    }
    return [...this.metadataHistory];
  }

  /**
   * Get metadata by frame ID
   */
  getByFrameId(frameId: number): MetadataEntry | null {
    return this.metadataHistory.find(m => m.frameId === frameId) || null;
  }

  /**
   * Get metadata in time range
   */
  getInTimeRange(startTime: number, endTime: number): MetadataEntry[] {
    return this.metadataHistory.filter(
      m => m.timestamp >= startTime && m.timestamp <= endTime
    );
  }

  /**
   * Get keyframes
   */
  getKeyframes(): MetadataEntry[] {
    return this.metadataHistory.filter(m => m.flags?.keyframe);
  }

  /**
   * Get dropped frames
   */
  getDroppedFrames(): MetadataEntry[] {
    return this.metadataHistory.filter(m => m.flags?.dropped);
  }

  /**
   * Get frames with motion
   */
  getFramesWithMotion(): MetadataEntry[] {
    return this.metadataHistory.filter(m => m.flags?.hasMotion);
  }

  /**
   * Get stream statistics
   */
  getStats(): {
    streamId: string;
    isStreaming: boolean;
    bufferSize: number;
    sequenceNumber: number;
    historySize: number;
    keyframeCount: number;
    droppedFrameCount: number;
    motionFrameCount: number;
  } {
    return {
      streamId: this.streamId,
      isStreaming: this.isStreaming,
      bufferSize: this.buffer.length,
      sequenceNumber: this.sequenceNumber,
      historySize: this.metadataHistory.length,
      keyframeCount: this.getKeyframes().length,
      droppedFrameCount: this.getDroppedFrames().length,
      motionFrameCount: this.getFramesWithMotion().length,
    };
  }

  /**
   * Clear buffer
   */
  clearBuffer(): void {
    this.buffer = [];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.metadataHistory = [];
  }

  /**
   * Reset stream
   */
  reset(): void {
    this.buffer = [];
    this.metadataHistory = [];
    this.sequenceNumber = 0;
  }
}

/**
 * Metadata stream result
 */
export interface MetadataStreamResult {
  /** Metadata entries */
  metadata: MetadataEntry[];

  /** Timestamp */
  timestamp: number;

  /** Sequence number */
  sequence: number;

  /** Stream ID */
  streamId: string;
}

/**
 * Metadata filter
 *
 * Filters metadata based on criteria.
 */
export class MetadataFilter {
  /**
   * Filter by time range
   */
  static byTimeRange(
    metadata: MetadataEntry[],
    startTime: number,
    endTime: number
  ): MetadataEntry[] {
    return metadata.filter(
      m => m.timestamp >= startTime && m.timestamp <= endTime
    );
  }

  /**
   * Filter by flags
   */
  static byFlags(
    metadata: MetadataEntry[],
    flags: Partial<MetadataEntry["flags"]>
  ): MetadataEntry[] {
    return metadata.filter(m => {
      if (!m.flags) {
        return false;
      }

      for (const [key, value] of Object.entries(flags)) {
        if (m.flags[key as keyof MetadataEntry["flags"]] !== value) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Filter by metadata key-value
   */
  static byMetadata(
    metadata: MetadataEntry[],
    key: string,
    value: unknown
  ): MetadataEntry[] {
    return metadata.filter(m => m.metadata[key] === value);
  }

  /**
   * Filter by frame IDs
   */
  static byFrameIds(
    metadata: MetadataEntry[],
    frameIds: number[]
  ): MetadataEntry[] {
    const frameIdSet = new Set(frameIds);
    return metadata.filter(m => frameIdSet.has(m.frameId));
  }
}

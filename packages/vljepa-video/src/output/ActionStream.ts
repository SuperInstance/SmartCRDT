/**
 * @lsi/vljepa-video/output/ActionStream
 *
 * Action stream for streaming predicted actions from video understanding.
 *
 * @version 1.0.0
 */

import type {
  StreamConfig,
  StreamMetadata,
  PredictedAction,
  ActionStreamResult,
} from "../types.js";

/**
 * Action prediction
 */
export interface ActionPrediction {
  /** Action type */
  type: "create" | "modify" | "delete" | "navigate" | "input";

  /** Target element */
  target: string;

  /** Action parameters */
  parameters: Record<string, unknown>;

  /** Confidence score */
  confidence: number;

  /** Frame ID */
  frameId: number;

  /** Timestamp */
  timestamp: number;
}

/**
 * Action stream
 *
 * Streams predicted actions from VL-JEPA video understanding.
 */
export class ActionStream {
  private config: StreamConfig;
  private buffer: ActionPrediction[] = [];
  private isStreaming: boolean = false;
  private streamId: string;
  private sequenceNumber: number = 0;
  private clientCallbacks: Array<(result: ActionStreamResult) => void> = [];
  private actionHistory: ActionPrediction[] = [];
  private maxHistory: number = 100;

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
   * Add action to stream
   */
  async addAction(
    type: ActionPrediction["type"],
    target: string,
    parameters: Record<string, unknown>,
    confidence: number,
    frameId: number
  ): Promise<void> {
    const prediction: ActionPrediction = {
      type,
      target,
      parameters,
      confidence,
      frameId,
      timestamp: performance.now(),
    };

    this.buffer.push(prediction);
    this.actionHistory.push(prediction);

    // Trim history
    if (this.actionHistory.length > this.maxHistory) {
      this.actionHistory.shift();
    }

    // Check if batch is ready
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

    const actions = this.buffer.map(p => ({
      type: p.type,
      target: p.target,
      parameters: p.parameters,
      confidence: p.confidence,
    }));

    const confidences = this.buffer.map(p => p.confidence);
    const frameIds = this.buffer.map(p => p.frameId);

    const metadata: StreamMetadata = {
      streamId: this.streamId,
      frameIds,
      encoding: this.config.format,
      compression: this.config.compression ? "gzip" : undefined,
    };

    const result: ActionStreamResult = {
      actions,
      confidences,
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
   * Get action history
   */
  getHistory(count?: number): ActionPrediction[] {
    if (count) {
      return this.actionHistory.slice(-count);
    }
    return [...this.actionHistory];
  }

  /**
   * Get actions by type
   */
  getActionsByType(type: ActionPrediction["type"]): ActionPrediction[] {
    return this.actionHistory.filter(a => a.type === type);
  }

  /**
   * Get actions by target
   */
  getActionsByTarget(target: string): ActionPrediction[] {
    return this.actionHistory.filter(a => a.target === target);
  }

  /**
   * Get actions by confidence threshold
   */
  getActionsByConfidence(minConfidence: number): ActionPrediction[] {
    return this.actionHistory.filter(a => a.confidence >= minConfidence);
  }

  /**
   * Get action statistics
   */
  getStats(): {
    totalActions: number;
    actionsByType: Record<string, number>;
    avgConfidence: number;
    highConfidenceActions: number;
    lowConfidenceActions: number;
    streamId: string;
    isStreaming: boolean;
    bufferSize: number;
    sequenceNumber: number;
  } {
    const totalActions = this.actionHistory.length;

    const actionsByType: Record<string, number> = {};
    let totalConfidence = 0;
    let highConfidence = 0;
    let lowConfidence = 0;

    for (const action of this.actionHistory) {
      actionsByType[action.type] = (actionsByType[action.type] || 0) + 1;
      totalConfidence += action.confidence;

      if (action.confidence >= 0.7) {
        highConfidence++;
      } else if (action.confidence < 0.4) {
        lowConfidence++;
      }
    }

    const avgConfidence = totalActions > 0 ? totalConfidence / totalActions : 0;

    return {
      totalActions,
      actionsByType,
      avgConfidence,
      highConfidenceActions: highConfidence,
      lowConfidenceActions: lowConfidence,
      streamId: this.streamId,
      isStreaming: this.isStreaming,
      bufferSize: this.buffer.length,
      sequenceNumber: this.sequenceNumber,
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
    this.actionHistory = [];
  }

  /**
   * Reset stream
   */
  reset(): void {
    this.buffer = [];
    this.actionHistory = [];
    this.sequenceNumber = 0;
  }
}

/**
 * Action aggregator
 *
 * Aggregates similar actions to reduce noise.
 */
export class ActionAggregator {
  private similarityThreshold: number;
  private timeWindowMs: number;
  private aggregatedActions: Map<string, ActionPrediction[]> = new Map();

  constructor(similarityThreshold: number = 0.8, timeWindowMs: number = 500) {
    this.similarityThreshold = similarityThreshold;
    this.timeWindowMs = timeWindowMs;
  }

  /**
   * Add action for aggregation
   */
  addAction(action: ActionPrediction): ActionPrediction | null {
    const key = this.getActionKey(action);

    if (!this.aggregatedActions.has(key)) {
      this.aggregatedActions.set(key, []);
    }

    const actions = this.aggregatedActions.get(key)!;
    actions.push(action);

    // Filter by time window
    const now = performance.now();
    const recent = actions.filter(a => now - a.timestamp < this.timeWindowMs);
    this.aggregatedActions.set(key, recent);

    // Check if we have enough similar actions
    if (recent.length >= 3) {
      // Aggregate actions
      return this.aggregateActions(recent);
    }

    return null;
  }

  /**
   * Get action key for grouping
   */
  private getActionKey(action: ActionPrediction): string {
    return `${action.type}:${action.target}`;
  }

  /**
   * Aggregate similar actions
   */
  private aggregateActions(actions: ActionPrediction[]): ActionPrediction {
    const avgConfidence =
      actions.reduce((sum, a) => sum + a.confidence, 0) / actions.length;

    // Use most recent timestamp
    const timestamp = Math.max(...actions.map(a => a.timestamp));

    // Use parameters from highest confidence action
    const bestAction = actions.reduce((best, a) =>
      a.confidence > best.confidence ? a : best
    );

    return {
      ...bestAction,
      confidence: avgConfidence,
      timestamp,
    };
  }

  /**
   * Clear aggregated actions
   */
  clear(): void {
    this.aggregatedActions.clear();
  }

  /**
   * Get aggregation statistics
   */
  getStats(): {
    uniqueActionTypes: number;
    totalActions: number;
    avgActionsPerType: number;
  } {
    const totalActions = Array.from(this.aggregatedActions.values()).reduce(
      (sum, actions) => sum + actions.length,
      0
    );

    return {
      uniqueActionTypes: this.aggregatedActions.size,
      totalActions,
      avgActionsPerType:
        this.aggregatedActions.size > 0
          ? totalActions / this.aggregatedActions.size
          : 0,
    };
  }
}

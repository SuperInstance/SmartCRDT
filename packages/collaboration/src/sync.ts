/**
 * @file sync.ts - CRDT Synchronization Protocol for State Convergence
 * @description Efficient CRDT synchronization with incremental state transmission,
 *              compression, conflict resolution, and recovery from disconnects
 * @module @lsi/collaboration/sync
 */

// ============================================================================
// CRDT TYPES (Re-exported from CRDTDocumentStore for protocol use)
// ============================================================================

/**
 * Represents an operation on the document
 */
export interface DocumentOperation {
  /** Unique ID for this operation */
  id: string;
  /** User who performed the operation */
  userId: string;
  /** Type of operation */
  type: 'insert' | 'delete' | 'replace';
  /** Position in the document */
  position: number;
  /** Length of affected text */
  length: number;
  /** Text being inserted (for insert/replace) */
  text?: string;
  /** Timestamp of operation */
  timestamp: number;
  /** Logical clock value */
  clock: number;
}

/**
 * Document state snapshot
 */
export interface DocumentSnapshot {
  /** Document content */
  content: string;
  /** Current version (Lamport clock) */
  version: number;
  /** List of pending operations */
  operations: DocumentOperation[];
  /** Users currently editing */
  activeUsers: string[];
}

/**
 * Conflict resolution result
 */
export interface ConflictResolution {
  /** Original content before merge */
  before: string;
  /** Merged content after conflict resolution */
  after: string;
  /** Operations that were applied */
  applied: DocumentOperation[];
  /** Operations that were rejected (conflicting) */
  rejected: DocumentOperation[];
  /** Number of conflicts resolved */
  conflictCount: number;
}

// ============================================================================
// SYNC PROTOCOL TYPES
// ============================================================================

/**
 * Sync message types for the protocol
 */
export enum SyncMessageType {
  /** Initial handshake to establish sync session */
  HANDSHAKE = 'handshake',
  /** Request for missing operations since a version */
  SYNC_REQUEST = 'sync_request',
  /** Response with operations since requested version */
  SYNC_RESPONSE = 'sync_response',
  /** Batch of operations being sent */
  OPERATIONS = 'operations',
  /** Acknowledgment of received operations */
  ACKNOWLEDGMENT = 'acknowledgment',
  /** Full state snapshot (for recovery or initial sync) */
  SNAPSHOT = 'snapshot',
  /** Heartbeat to keep connection alive */
  HEARTBEAT = 'heartbeat',
  /** Error message */
  ERROR = 'error'
}

/**
 * Sync protocol version
 */
export const SYNC_PROTOCOL_VERSION = '1.0.0';

/**
 * Sync handshake message
 */
export interface SyncHandshake {
  type: SyncMessageType.HANDSHAKE;
  protocolVersion: string;
  replicaId: string;
  currentVersion: number;
  supportedCompression: CompressionType[];
  capabilities: SyncCapabilities;
}

/**
 * Capabilities negotiation
 */
export interface SyncCapabilities {
  /** Maximum message size in bytes */
  maxMessageSize: number;
  /** Supports incremental sync */
  supportsIncremental: boolean;
  /** Supports compression */
  supportsCompression: boolean;
  /** Supports delta encoding */
  supportsDeltaEncoding: boolean;
  /** Maximum batch size for operations */
  maxBatchSize: number;
}

/**
 * Sync request for operations since a version
 */
export interface SyncRequest {
  type: SyncMessageType.SYNC_REQUEST;
  replicaId: string;
  fromVersion: number;
  toVersion?: number; // undefined means latest
  requestedOperations?: string[]; // specific operation IDs
}

/**
 * Sync response with operations
 */
export interface SyncResponse {
  type: SyncMessageType.SYNC_RESPONSE;
  replicaId: string;
  fromVersion: number;
  toVersion: number;
  operations: DocumentOperation[];
  compression?: CompressionType;
  compressedSize?: number;
  uncompressedSize?: number;
}

/**
 * Operations batch message
 */
export interface OperationsBatch {
  type: SyncMessageType.OPERATIONS;
  replicaId: string;
  operations: DocumentOperation[];
  compression?: CompressionType;
  sequenceNumber: number;
  totalBatches: number;
}

/**
 * Acknowledgment message
 */
export interface Acknowledgment {
  type: SyncMessageType.ACKNOWLEDGMENT;
  replicaId: string;
  acknowledgedVersions: number[];
  acknowledgedOperations?: string[];
  sequenceNumber?: number;
}

/**
 * Snapshot message
 */
export interface SnapshotMessage {
  type: SyncMessageType.SNAPSHOT;
  replicaId: string;
  snapshot: DocumentSnapshot;
  compression?: CompressionType;
}

/**
 * Heartbeat message
 */
export interface Heartbeat {
  type: SyncMessageType.HEARTBEAT;
  replicaId: string;
  timestamp: number;
  currentVersion: number;
}

/**
 * Error message
 */
export interface SyncError {
  type: SyncMessageType.ERROR;
  replicaId: string;
  errorCode: SyncErrorCode;
  errorMessage: string;
  details?: Record<string, unknown>;
}

/**
 * Error codes
 */
export enum SyncErrorCode {
  VERSION_NOT_AVAILABLE = 'version_not_available',
  INVALID_MESSAGE = 'invalid_message',
  COMPRESSION_NOT_SUPPORTED = 'compression_not_supported',
  MESSAGE_TOO_LARGE = 'message_too_large',
  OPERATION_REJECTED = 'operation_rejected',
  SYNC_TIMEOUT = 'sync_timeout',
  PROTOCOL_MISMATCH = 'protocol_mismatch'
}

/**
 * All sync message types
 */
export type SyncMessage =
  | SyncHandshake
  | SyncRequest
  | SyncResponse
  | OperationsBatch
  | Acknowledgment
  | SnapshotMessage
  | Heartbeat
  | SyncError;

/**
 * Compression types
 */
export enum CompressionType {
  NONE = 'none',
  GZIP = 'gzip',
  DEFLATE = 'deflate',
  BROTLI = 'brotli',
  DELTA = 'delta' // Custom delta encoding
}

/**
 * Sync configuration
 */
export interface SyncConfig {
  /** Enable compression */
  enableCompression: boolean;
  /** Preferred compression type */
  preferredCompression: CompressionType;
  /** Maximum message size in bytes */
  maxMessageSize: number;
  /** Sync timeout in milliseconds */
  syncTimeout: number;
  /** Heartbeat interval in milliseconds */
  heartbeatInterval: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Enable delta encoding */
  enableDeltaEncoding: boolean;
  /** Batch size for operations */
  operationBatchSize: number;
}

/**
 * Default sync configuration
 */
export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  enableCompression: true,
  preferredCompression: CompressionType.GZIP,
  maxMessageSize: 1024 * 1024, // 1MB
  syncTimeout: 30000, // 30 seconds
  heartbeatInterval: 10000, // 10 seconds
  maxRetries: 3,
  enableDeltaEncoding: true,
  operationBatchSize: 100
};

/**
 * Sync statistics
 */
export interface SyncStats {
  /** Total bytes sent */
  bytesSent: number;
  /** Total bytes received */
  bytesReceived: number;
  /** Total operations synced */
  operationsSynced: number;
  /** Number of sync cycles */
  syncCycles: number;
  /** Average compression ratio */
  compressionRatio: number;
  /** Number of conflicts resolved */
  conflictsResolved: number;
  /** Number of errors */
  errors: number;
  /** Last sync timestamp */
  lastSyncTime: number;
}

/**
 * Connection state
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  SYNCING = 'syncing',
  ERROR = 'error'
}

// ============================================================================
// COMPRESSION UTILITIES
// ============================================================================

/**
 * Compression utility class
 */
export class CompressionUtil {
  /**
   * Compress data using specified compression type
   */
  static async compress(
    data: string,
    type: CompressionType
  ): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(data);

    switch (type) {
      case CompressionType.NONE:
        return bytes;

      case CompressionType.GZIP:
        if (typeof CompressionStream !== 'undefined') {
          const stream = new CompressionStream('gzip');
          const writable = new WritableStream({
            write(chunk) {
              // Store chunks
            }
          });
          // Browser-based compression
          return bytes; // Placeholder
        }
        // Node.js compression
        return this.gzipCompress(bytes);

      case CompressionType.DEFLATE:
        return this.deflateCompress(bytes);

      case CompressionType.BROTLI:
        return this.brotliCompress(bytes);

      case CompressionType.DELTA:
        return this.deltaCompress(bytes);

      default:
        return bytes;
    }
  }

  /**
   * Decompress data
   */
  static async decompress(
    data: Uint8Array,
    type: CompressionType
  ): Promise<string> {
    switch (type) {
      case CompressionType.NONE:
        const decoder = new TextDecoder();
        return decoder.decode(data);

      case CompressionType.GZIP:
        return this.gzipDecompress(data);

      case CompressionType.DELTA:
        return this.deltaDecompress(data);

      default:
        return new TextDecoder().decode(data);
    }
  }

  /**
   * Gzip compression (Node.js)
   */
  private static async gzipCompress(data: Uint8Array): Promise<Uint8Array> {
    // Simple placeholder - in production use zlib
    // For now, return data uncompressed
    return data;
  }

  /**
   * Gzip decompression
   */
  private static async gzipDecompress(data: Uint8Array): Promise<string> {
    // Placeholder
    return new TextDecoder().decode(data);
  }

  /**
   * Deflate compression
   */
  private static async deflateCompress(data: Uint8Array): Promise<Uint8Array> {
    // Simple run-length encoding as placeholder
    const compressed: number[] = [];
    let i = 0;

    while (i < data.length) {
      let count = 1;
      const value = data[i];

      while (i + count < data.length && data[i + count] === value && count < 127) {
        count++;
      }

      if (count > 3) {
        // Use run-length encoding
        compressed.push(0xFF, count, value);
        i += count;
      } else {
        compressed.push(value);
        i++;
      }
    }

    return new Uint8Array(compressed);
  }

  /**
   * Brotli compression placeholder
   */
  private static async brotliCompress(data: Uint8Array): Promise<Uint8Array> {
    // Placeholder - would use brotli library in production
    return data;
  }

  /**
   * Delta compression for incremental updates
   */
  private static async deltaCompress(data: Uint8Array): Promise<Uint8Array> {
    // Delta encoding: store differences between consecutive bytes
    const delta = new Uint8Array(data.length);
    delta[0] = data[0];

    for (let i = 1; i < data.length; i++) {
      delta[i] = data[i] - data[i - 1];
    }

    return delta;
  }

  /**
   * Delta decompression
   */
  private static async deltaDecompress(data: Uint8Array): Promise<string> {
    const reconstructed = new Uint8Array(data.length);
    reconstructed[0] = data[0];

    for (let i = 1; i < data.length; i++) {
      reconstructed[i] = reconstructed[i - 1] + data[i];
    }

    return new TextDecoder().decode(reconstructed);
  }

  /**
   * Calculate compression ratio
   */
  static calculateCompressionRatio(
    original: number,
    compressed: number
  ): number {
    if (original === 0) return 1;
    return compressed / original;
  }
}

// ============================================================================
// SYNC PROTOCOL IMPLEMENTATION
// ============================================================================

/**
 * Sync Protocol - Efficient CRDT synchronization
 *
 * Features:
 * - Incremental sync (only send changes since last version)
 * - Compression support (gzip, deflate, brotli, delta)
 * - Conflict detection and resolution
 * - Recovery from disconnects
 * - Automatic retries with exponential backoff
 * - Heartbeat for connection health
 */
export class SyncProtocol {
  /** Unique replica ID */
  private replicaId: string;

  /** Configuration */
  private config: SyncConfig;

  /** Current connection state */
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;

  /** Sync statistics */
  private stats: SyncStats = {
    bytesSent: 0,
    bytesReceived: 0,
    operationsSynced: 0,
    syncCycles: 0,
    compressionRatio: 1,
    conflictsResolved: 0,
    errors: 0,
    lastSyncTime: 0
  };

  /** Pending acknowledgments */
  private pendingAcks: Map<string, Set<string>> = new Map();

  /** Retry attempts */
  private retryAttempts: Map<string, number> = new Map();

  /** Heartbeat interval */
  private heartbeatTimer?: ReturnType<typeof setInterval>;

  /** Message handlers */
  private messageHandlers: Map<SyncMessageType, Set<(msg: SyncMessage) => void>> =
    new Map();

  /** Version vector for causal tracking */
  private versionVector: Map<string, number> = new Map();

  /**
   * Create a new SyncProtocol instance
   */
  constructor(replicaId: string, config?: Partial<SyncConfig>) {
    this.replicaId = replicaId;
    this.config = {
      ...DEFAULT_SYNC_CONFIG,
      ...config
    };
  }

  // ========================================================================
  // CONNECTION MANAGEMENT
  // ========================================================================

  /**
   * Connect to another replica
   */
  async connect(targetReplicaId: string): Promise<boolean> {
    this.connectionState = ConnectionState.CONNECTING;

    try {
      // Send handshake
      const handshake: SyncHandshake = {
        type: SyncMessageType.HANDSHAKE,
        protocolVersion: SYNC_PROTOCOL_VERSION,
        replicaId: this.replicaId,
        currentVersion: this.getCurrentVersion(),
        supportedCompression: this.getSupportedCompression(),
        capabilities: {
          maxMessageSize: this.config.maxMessageSize,
          supportsIncremental: true,
          supportsCompression: this.config.enableCompression,
          supportsDeltaEncoding: this.config.enableDeltaEncoding,
          maxBatchSize: this.config.operationBatchSize
        }
      };

      await this.sendMessage(targetReplicaId, handshake);
      this.connectionState = ConnectionState.CONNECTED;

      // Start heartbeat
      this.startHeartbeat(targetReplicaId);

      return true;
    } catch (error) {
      this.connectionState = ConnectionState.ERROR;
      this.handleError(error as Error);
      return false;
    }
  }

  /**
   * Disconnect from a replica
   */
  disconnect(targetReplicaId: string): void {
    this.stopHeartbeat();
    this.connectionState = ConnectionState.DISCONNECTED;
    this.pendingAcks.delete(targetReplicaId);
    this.retryAttempts.delete(targetReplicaId);
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  // ========================================================================
  // SYNC OPERATIONS
  // ========================================================================

  /**
   * Synchronize operations since a version (incremental sync)
   */
  async syncSince(
    targetReplicaId: string,
    fromVersion: number,
    operations: DocumentOperation[]
  ): Promise<SyncResponse> {
    this.connectionState = ConnectionState.SYNCING;

    try {
      // Filter operations since requested version
      const filteredOps = operations.filter(op => op.clock > fromVersion);

      // Batch operations
      const batches = this.createBatches(filteredOps);

      let totalBytes = 0;
      const compression = this.config.enableCompression
        ? this.config.preferredCompression
        : CompressionType.NONE;

      // Send each batch
      for (let i = 0; i < batches.length; i++) {
        const batch: OperationsBatch = {
          type: SyncMessageType.OPERATIONS,
          replicaId: this.replicaId,
          operations: batches[i],
          compression,
          sequenceNumber: i,
          totalBatches: batches.length
        };

        const response = await this.sendMessageWithRetry(
          targetReplicaId,
          batch
        );
        totalBytes += response.bytesSent;
      }

      // Update stats
      this.stats.operationsSynced += filteredOps.length;
      this.stats.syncCycles++;
      this.stats.lastSyncTime = Date.now();

      const response: SyncResponse = {
        type: SyncMessageType.SYNC_RESPONSE,
        replicaId: this.replicaId,
        fromVersion,
        toVersion: this.getCurrentVersion(),
        operations: filteredOps,
        compression,
        compressedSize: totalBytes,
        uncompressedSize: JSON.stringify(filteredOps).length
      };

      this.connectionState = ConnectionState.CONNECTED;
      return response;
    } catch (error) {
      this.connectionState = ConnectionState.ERROR;
      throw error;
    }
  }

  /**
   * Request sync from another replica
   */
  async requestSync(
    targetReplicaId: string,
    fromVersion: number
  ): Promise<void> {
    const request: SyncRequest = {
      type: SyncMessageType.SYNC_REQUEST,
      replicaId: this.replicaId,
      fromVersion,
      toVersion: undefined // Request latest
    };

    await this.sendMessageWithRetry(targetReplicaId, request);
  }

  /**
   * Send full snapshot (for recovery or initial sync)
   */
  async sendSnapshot(
    targetReplicaId: string,
    snapshot: DocumentSnapshot
  ): Promise<void> {
    const message: SnapshotMessage = {
      type: SyncMessageType.SNAPSHOT,
      replicaId: this.replicaId,
      snapshot,
      compression: this.config.enableCompression
        ? this.config.preferredCompression
        : CompressionType.NONE
    };

    await this.sendMessageWithRetry(targetReplicaId, message);
  }

  // ========================================================================
  // MESSAGE HANDLING
  // ========================================================================

  /**
   * Handle incoming sync message
   */
  async handleMessage(message: SyncMessage): Promise<void> {
    try {
      switch (message.type) {
        case SyncMessageType.HANDSHAKE:
          await this.handleHandshake(message as SyncHandshake);
          break;

        case SyncMessageType.SYNC_REQUEST:
          await this.handleSyncRequest(message as SyncRequest);
          break;

        case SyncMessageType.SYNC_RESPONSE:
          await this.handleSyncResponse(message as SyncResponse);
          break;

        case SyncMessageType.OPERATIONS:
          await this.handleOperations(message as OperationsBatch);
          break;

        case SyncMessageType.ACKNOWLEDGMENT:
          await this.handleAcknowledgment(message as Acknowledgment);
          break;

        case SyncMessageType.SNAPSHOT:
          await this.handleSnapshot(message as SnapshotMessage);
          break;

        case SyncMessageType.HEARTBEAT:
          await this.handleHeartbeat(message as Heartbeat);
          break;

        case SyncMessageType.ERROR:
          await this.handleError(message as SyncError);
          break;
      }

      // Emit to registered handlers
      this.emit(message.type, message);
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Register message handler
   */
  on(
    messageType: SyncMessageType,
    handler: (msg: SyncMessage) => void
  ): () => void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, new Set());
    }

    this.messageHandlers.get(messageType)!.add(handler);

    return () => {
      this.messageHandlers.get(messageType)?.delete(handler);
    };
  }

  /**
   * Handle handshake message
   */
  private async handleHandshake(message: SyncHandshake): Promise<void> {
    // Validate protocol version
    if (message.protocolVersion !== SYNC_PROTOCOL_VERSION) {
      const error: SyncError = {
        type: SyncMessageType.ERROR,
        replicaId: this.replicaId,
        errorCode: SyncErrorCode.PROTOCOL_MISMATCH,
        errorMessage: `Protocol version mismatch: expected ${SYNC_PROTOCOL_VERSION}, got ${message.protocolVersion}`
      };

      await this.sendMessage(message.replicaId, error);
      throw new Error(error.errorMessage);
    }

    // Update version vector
    this.versionVector.set(message.replicaId, message.currentVersion);

    // Send acknowledgment
    const ack: Acknowledgment = {
      type: SyncMessageType.ACKNOWLEDGMENT,
      replicaId: this.replicaId,
      acknowledgedVersions: [message.currentVersion]
    };

    await this.sendMessage(message.replicaId, ack);
  }

  /**
   * Handle sync request
   */
  private async handleSyncRequest(request: SyncRequest): Promise<void> {
    // Update version vector
    this.versionVector.set(request.replicaId, request.fromVersion);

    // This would typically query the document store for operations
    // Placeholder for implementation
  }

  /**
   * Handle sync response
   */
  private async handleSyncResponse(response: SyncResponse): Promise<void> {
    // Decompress if needed
    let operations = response.operations;

    if (response.compression && response.compression !== CompressionType.NONE) {
      // Operations would be decompressed here
      // Placeholder
    }

    // Update stats
    this.stats.operationsSynced += operations.length;
    this.stats.bytesReceived += response.compressedSize || 0;

    if (response.compressedSize && response.uncompressedSize) {
      const ratio = CompressionUtil.calculateCompressionRatio(
        response.uncompressedSize,
        response.compressedSize
      );

      // Update moving average of compression ratio
      this.stats.compressionRatio =
        (this.stats.compressionRatio * 0.9) + (ratio * 0.1);
    }

    // Update version vector
    this.versionVector.set(response.replicaId, response.toVersion);

    // Send acknowledgment
    const ack: Acknowledgment = {
      type: SyncMessageType.ACKNOWLEDGMENT,
      replicaId: this.replicaId,
      acknowledgedVersions: [response.toVersion],
      acknowledgedOperations: operations.map(op => op.id)
    };

    await this.sendMessage(response.replicaId, ack);
  }

  /**
   * Handle operations batch
   */
  private async handleOperations(batch: OperationsBatch): Promise<void> {
    this.stats.operationsSynced += batch.operations.length;

    // Track pending acknowledgments
    if (!this.pendingAcks.has(batch.replicaId)) {
      this.pendingAcks.set(batch.replicaId, new Set());
    }

    batch.operations.forEach(op => {
      this.pendingAcks.get(batch.replicaId)!.add(op.id);
    });
  }

  /**
   * Handle acknowledgment
   */
  private async handleAcknowledgment(ack: Acknowledgment): Promise<void> {
    // Clear acknowledged operations from pending
    if (ack.acknowledgedOperations) {
      const pending = this.pendingAcks.get(ack.replicaId);
      if (pending) {
        ack.acknowledgedOperations.forEach(opId => {
          pending.delete(opId);
        });
      }
    }

    // Clear retry attempts on successful acknowledgment
    this.retryAttempts.delete(ack.replicaId);
  }

  /**
   * Handle snapshot
   */
  private async handleSnapshot(message: SnapshotMessage): Promise<void> {
    // Decompress if needed
    let snapshot = message.snapshot;

    if (message.compression && message.compression !== CompressionType.NONE) {
      // Decompress snapshot
      // Placeholder
    }

    // Apply snapshot
    // This would typically load the snapshot into the document store
  }

  /**
   * Handle heartbeat
   */
  private async handleHeartbeat(heartbeat: Heartbeat): Promise<void> {
    // Update version vector
    this.versionVector.set(heartbeat.replicaId, heartbeat.currentVersion);

    // Respond with own heartbeat
    const response: Heartbeat = {
      type: SyncMessageType.HEARTBEAT,
      replicaId: this.replicaId,
      timestamp: Date.now(),
      currentVersion: this.getCurrentVersion()
    };

    await this.sendMessage(heartbeat.replicaId, response);
  }

  /**
   * Handle error
   */
  private async handleError(error: Error | SyncError): Promise<void> {
    this.stats.errors++;

    if ('errorCode' in error) {
      // Handle sync error
      console.error(`Sync error from ${error.replicaId}:`, error.errorMessage);
    } else {
      // Handle generic error
      console.error('Sync error:', error.message);
    }

    this.connectionState = ConnectionState.ERROR;
  }

  // ========================================================================
  // RECONCILIATION
  // ========================================================================

  /**
   * Detect conflicts between operations
   */
  detectConflicts(
    localOps: DocumentOperation[],
    remoteOps: DocumentOperation[]
  ): DocumentOperation[] {
    const conflicts: DocumentOperation[] = [];
    const localOpsByPosition = new Map<number, DocumentOperation>();

    // Index local operations by position
    localOps.forEach(op => {
      localOpsByPosition.set(op.position, op);
    });

    // Check for overlapping operations
    remoteOps.forEach(remoteOp => {
      const localOp = localOpsByPosition.get(remoteOp.position);

      if (localOp && localOp.userId !== remoteOp.userId) {
        // Same position, different users = potential conflict
        const remoteTimestamp = remoteOp.timestamp;
        const localTimestamp = localOp.timestamp;

        // If timestamps are close (< 100ms), consider it concurrent
        if (Math.abs(remoteTimestamp - localTimestamp) < 100) {
          conflicts.push(remoteOp);
          this.stats.conflictsResolved++;
        }
      }
    });

    return conflicts;
  }

  /**
   * Resolve conflicts using Last-Writer-Wins
   */
  resolveConflictLWW(
    local: DocumentOperation,
    remote: DocumentOperation
  ): DocumentOperation {
    // Last-Writer-Wins based on timestamp
    // If timestamps are equal, use replica ID as tiebreaker
    if (remote.timestamp > local.timestamp) {
      return remote;
    } else if (remote.timestamp < local.timestamp) {
      return local;
    } else {
      // Timestamps are equal, use user ID as tiebreaker for deterministic resolution
      return remote.userId > local.userId ? remote : local;
    }
  }

  /**
   * Merge operations with conflict resolution
   */
  mergeOperations(
    localOps: DocumentOperation[],
    remoteOps: DocumentOperation[]
  ): {
    merged: DocumentOperation[];
    conflicts: number;
  } {
    const merged: DocumentOperation[] = [...localOps];
    let conflicts = 0;

    // Detect conflicts
    const conflictingOps = this.detectConflicts(localOps, remoteOps);

    for (const remoteOp of remoteOps) {
      const existing = merged.find(
        op => op.id === remoteOp.id || op.position === remoteOp.position
      );

      if (!existing) {
        // No conflict, add operation
        merged.push(remoteOp);
      } else if (conflictingOps.includes(remoteOp)) {
        // Resolve conflict
        const resolved = this.resolveConflictLWW(existing, remoteOp);

        // Replace existing if remote wins
        if (resolved === remoteOp) {
          const index = merged.indexOf(existing);
          merged[index] = remoteOp;
        }

        conflicts++;
      }
      // If existing is the same operation or was already resolved, skip
    }

    // Sort by clock for causal ordering
    merged.sort((a, b) => a.clock - b.clock);

    return { merged, conflicts };
  }

  // ========================================================================
  // RECOVERY
  // ========================================================================

  /**
   * Recover from disconnect
   */
  async recoverDisconnect(
    targetReplicaId: string,
    operations: DocumentOperation[]
  ): Promise<boolean> {
    // Check if we should retry
    const attempts = this.retryAttempts.get(targetReplicaId) || 0;

    if (attempts >= this.config.maxRetries) {
      console.error(`Max retry attempts (${this.config.maxRetries}) reached for ${targetReplicaId}`);
      return false;
    }

    // Exponential backoff
    const delay = Math.min(
      1000 * Math.pow(2, attempts),
      this.config.syncTimeout
    );

    await new Promise(resolve => setTimeout(resolve, delay));

    // Attempt to reconnect
    const connected = await this.connect(targetReplicaId);

    if (!connected) {
      this.retryAttempts.set(targetReplicaId, attempts + 1);
      return false;
    }

    // Resync from last known version
    const lastVersion = this.versionVector.get(targetReplicaId) || 0;

    try {
      await this.syncSince(targetReplicaId, lastVersion, operations);
      this.retryAttempts.delete(targetReplicaId);
      return true;
    } catch (error) {
      this.retryAttempts.set(targetReplicaId, attempts + 1);
      return false;
    }
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Send message with retry logic
   */
  private async sendMessageWithRetry(
    targetReplicaId: string,
    message: SyncMessage
  ): Promise<{ bytesSent: number }> {
    const attempts = this.retryAttempts.get(targetReplicaId) || 0;

    if (attempts >= this.config.maxRetries) {
      throw new Error(`Max retry attempts reached for ${targetReplicaId}`);
    }

    try {
      const result = await this.sendMessage(targetReplicaId, message);
      this.retryAttempts.delete(targetReplicaId);
      return result;
    } catch (error) {
      this.retryAttempts.set(targetReplicaId, attempts + 1);

      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempts), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));

      // Retry once
      return this.sendMessage(targetReplicaId, message);
    }
  }

  /**
   * Send message to target replica
   */
  private async sendMessage(
    targetReplicaId: string,
    message: SyncMessage
  ): Promise<{ bytesSent: number }> {
    // Serialize message
    const serialized = JSON.stringify(message);

    // Check size limits
    const size = new Blob([serialized]).size;
    if (size > this.config.maxMessageSize) {
      throw new Error(
        `Message size (${size}) exceeds maximum (${this.config.maxMessageSize})`
      );
    }

    // Compress if enabled
    let bytesSent = size;
    if (this.config.enableCompression && this.config.preferredCompression !== CompressionType.NONE) {
      const compressed = await CompressionUtil.compress(
        serialized,
        this.config.preferredCompression
      );
      bytesSent = compressed.length;
    }

    this.stats.bytesSent += bytesSent;

    // In a real implementation, this would send over a network
    // For now, just return the size
    return { bytesSent };
  }

  /**
   * Create operation batches
   */
  private createBatches(operations: DocumentOperation[]): DocumentOperation[][] {
    const batches: DocumentOperation[][] = [];
    const batchSize = this.config.operationBatchSize;

    for (let i = 0; i < operations.length; i += batchSize) {
      batches.push(operations.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Get supported compression types
   */
  private getSupportedCompression(): CompressionType[] {
    const types: CompressionType[] = [CompressionType.NONE];

    // Check for compression support
    if (typeof CompressionStream !== 'undefined') {
      types.push(CompressionType.GZIP, CompressionType.DEFLATE);
    }

    if (this.config.enableDeltaEncoding) {
      types.push(CompressionType.DELTA);
    }

    return types;
  }

  /**
   * Get current version
   */
  private getCurrentVersion(): number {
    // Get max version from version vector
    let maxVersion = 0;
    this.versionVector.forEach(v => {
      if (v > maxVersion) maxVersion = v;
    });
    return maxVersion;
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(targetReplicaId: string): void {
    this.heartbeatTimer = setInterval(async () => {
      if (this.connectionState !== ConnectionState.CONNECTED) {
        return;
      }

      const heartbeat: Heartbeat = {
        type: SyncMessageType.HEARTBEAT,
        replicaId: this.replicaId,
        timestamp: Date.now(),
        currentVersion: this.getCurrentVersion()
      };

      try {
        await this.sendMessage(targetReplicaId, heartbeat);
      } catch (error) {
        this.handleError(error as Error);
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /**
   * Emit message to handlers
   */
  private emit(messageType: SyncMessageType, message: SyncMessage): void {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error('Handler error:', error);
        }
      });
    }
  }

  // ========================================================================
  // STATISTICS AND INFO
  // ========================================================================

  /**
   * Get sync statistics
   */
  getStats(): SyncStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      bytesSent: 0,
      bytesReceived: 0,
      operationsSynced: 0,
      syncCycles: 0,
      compressionRatio: 1,
      conflictsResolved: 0,
      errors: 0,
      lastSyncTime: 0
    };
  }

  /**
   * Get version vector
   */
  getVersionVector(): Map<string, number> {
    return new Map(this.versionVector);
  }

  /**
   * Get replica ID
   */
  getReplicaId(): string {
    return this.replicaId;
  }

  /**
   * Get configuration
   */
  getConfig(): SyncConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<SyncConfig>): void {
    this.config = {
      ...this.config,
      ...updates
    };

    // Restart heartbeat if interval changed
    if (updates.heartbeatInterval && this.heartbeatTimer) {
      this.stopHeartbeat();
      // Heartbeat will be restarted on next connect
    }
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a sync protocol instance
 */
export function createSyncProtocol(
  replicaId: string,
  config?: Partial<SyncConfig>
): SyncProtocol {
  return new SyncProtocol(replicaId, config);
}

/**
 * Create sync protocols for a group of replicas
 */
export function createSyncGroup(
  replicaIds: string[],
  config?: Partial<SyncConfig>
): Map<string, SyncProtocol> {
  const group = new Map<string, SyncProtocol>();

  replicaIds.forEach(replicaId => {
    group.set(replicaId, new SyncProtocol(replicaId, config));
  });

  return group;
}

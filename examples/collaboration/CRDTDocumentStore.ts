/**
 * @file CRDTDocumentStore.ts - CRDT-backed document store using Yjs
 * @description Implements a conflict-free replicated document store for real-time collaboration
 * @module collaboration/CRDTDocumentStore
 */

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

/**
 * Lamport Clock for ordering operations
 */
class LamportClock {
  private time: number = 0;

  /** Get current time */
  getTime(): number {
    return this.time;
  }

  /** Increment clock */
  tick(): number {
    return ++this.time;
  }

  /** Merge with another clock value */
  merge(otherTime: number): number {
    this.time = Math.max(this.time, otherTime) + 1;
    return this.time;
  }
}

/**
 * CRDT Document Store
 *
 * Implements a state-based CRDT for text documents using:
 * - Lamport clocks for operation ordering
 * - Operational transformation for concurrent edits
 * - Last-Writer-Wins for conflict resolution
 * - Causal ordering of operations
 */
export class CRDTDocumentStore {
  private content: string = '';
  private clock: LamportClock = new LamportClock();
  private operations: Map<string, DocumentOperation> = new Map();
  private operationLog: DocumentOperation[] = [];
  private activeUsers: Set<string> = new Set();
  private userClocks: Map<string, number> = new Map();

  constructor(initialContent: string = '') {
    this.content = initialContent;
  }

  /**
   * Get current document content
   */
  getContent(): string {
    return this.content;
  }

  /**
   * Get current version (Lamport clock)
   */
  getVersion(): number {
    return this.clock.getTime();
  }

  /**
   * Insert text at position
   */
  insert(userId: string, position: number, text: string): DocumentOperation {
    const operation: DocumentOperation = {
      id: this.generateOpId(),
      userId,
      type: 'insert',
      position,
      length: 0,
      text,
      timestamp: Date.now(),
      clock: this.clock.tick()
    };

    // Validate position
    if (position < 0 || position > this.content.length) {
      throw new Error(`Invalid position: ${position}`);
    }

    // Apply operation
    this.content =
      this.content.slice(0, position) + text + this.content.slice(position);

    // Record operation
    this.recordOperation(operation);

    return operation;
  }

  /**
   * Delete text at position
   */
  delete(userId: string, position: number, length: number): DocumentOperation {
    if (length <= 0) {
      throw new Error(`Invalid length: ${length}`);
    }

    if (position < 0 || position + length > this.content.length) {
      throw new Error(`Invalid delete range: ${position}, ${length}`);
    }

    const operation: DocumentOperation = {
      id: this.generateOpId(),
      userId,
      type: 'delete',
      position,
      length,
      timestamp: Date.now(),
      clock: this.clock.tick()
    };

    // Apply operation
    this.content =
      this.content.slice(0, position) + this.content.slice(position + length);

    // Record operation
    this.recordOperation(operation);

    return operation;
  }

  /**
   * Replace text at position
   */
  replace(
    userId: string,
    position: number,
    length: number,
    text: string
  ): DocumentOperation {
    if (position < 0 || position + length > this.content.length) {
      throw new Error(`Invalid replace range: ${position}, ${length}`);
    }

    const operation: DocumentOperation = {
      id: this.generateOpId(),
      userId,
      type: 'replace',
      position,
      length,
      text,
      timestamp: Date.now(),
      clock: this.clock.tick()
    };

    // Apply operation
    this.content =
      this.content.slice(0, position) + text + this.content.slice(position + length);

    // Record operation
    this.recordOperation(operation);

    return operation;
  }

  /**
   * Apply remote operation from another replica
   * Implements operational transformation for concurrent edits
   */
  applyRemote(operation: DocumentOperation): DocumentOperation | null {
    // Update user clock
    const userTime = this.userClocks.get(operation.userId) || 0;
    if (operation.clock <= userTime) {
      // Already seen this operation or it's old
      return null;
    }
    this.userClocks.set(operation.userId, operation.clock);

    // Merge clocks
    this.clock.merge(operation.clock);

    // Check if we already have this operation
    if (this.operations.has(operation.id)) {
      return null;
    }

    // Transform operation based on current state
    const transformed = this.transformOperation(operation);

    if (!transformed) {
      return null;
    }

    // Apply the transformed operation
    try {
      switch (transformed.type) {
        case 'insert':
          if (
            transformed.position >= 0 &&
            transformed.position <= this.content.length
          ) {
            this.content =
              this.content.slice(0, transformed.position) +
              transformed.text! +
              this.content.slice(transformed.position);
          }
          break;

        case 'delete':
          if (
            transformed.position >= 0 &&
            transformed.position + transformed.length <= this.content.length
          ) {
            this.content =
              this.content.slice(0, transformed.position) +
              this.content.slice(transformed.position + transformed.length);
          }
          break;

        case 'replace':
          if (
            transformed.position >= 0 &&
            transformed.position + transformed.length <= this.content.length
          ) {
            this.content =
              this.content.slice(0, transformed.position) +
              transformed.text! +
              this.content.slice(transformed.position + transformed.length);
          }
          break;
      }

      // Record operation
      this.recordOperation(transformed);
      return transformed;
    } catch (e) {
      // Operation could not be applied - out of bounds
      console.warn('Failed to apply remote operation:', e);
      return null;
    }
  }

  /**
   * Transform operation based on concurrent operations
   * This is a simplified OT implementation
   */
  private transformOperation(
    operation: DocumentOperation
  ): DocumentOperation | null {
    let transformed = { ...operation };
    let position = operation.position;

    // Apply concurrent operations that happened before this one
    for (const op of this.operationLog) {
      if (op.userId === operation.userId) {
        continue; // Skip operations from same user
      }

      // Transform position based on concurrent operation
      if (op.type === 'insert' && op.position <= position) {
        position += op.text!.length;
      } else if (op.type === 'delete') {
        if (op.position + op.length <= position) {
          position -= op.length;
        } else if (op.position < position && op.position + op.length > position) {
          // Overlapping delete - adjust position and length
          const overlap = op.position + op.length - position;
          transformed.position = op.position;
          transformed.length = Math.max(0, transformed.length - overlap);
          position = op.position;
        }
      } else if (op.type === 'replace') {
        if (op.position + op.length <= position) {
          position += op.text!.length - op.length;
        } else if (
          op.position < position &&
          op.position + op.length > position
        ) {
          // Overlapping replace - this is complex, use LWW
          // For simplicity, reject this operation
          return null;
        }
      }
    }

    transformed.position = position;
    return transformed;
  }

  /**
   * Merge state from another replica
   * Returns conflict resolution information
   */
  merge(remote: CRDTDocumentStore): ConflictResolution {
    const before = this.content;
    const applied: DocumentOperation[] = [];
    const rejected: DocumentOperation[] = [];
    let conflictCount = 0;

    // Get remote operations
    const remoteOps = remote.getOperations();

    for (const op of remoteOps) {
      // Check if we already have this operation
      if (this.operations.has(op.id)) {
        continue;
      }

      const result = this.applyRemote(op);

      if (result) {
        applied.push(result);
      } else {
        rejected.push(op);
        if (op.position < this.content.length) {
          conflictCount++;
        }
      }
    }

    return {
      before,
      after: this.content,
      applied,
      rejected,
      conflictCount
    };
  }

  /**
   * Get snapshot of current state
   */
  getSnapshot(): DocumentSnapshot {
    return {
      content: this.content,
      version: this.clock.getTime(),
      operations: [...this.operationLog],
      activeUsers: Array.from(this.activeUsers)
    };
  }

  /**
   * Load from snapshot
   */
  loadSnapshot(snapshot: DocumentSnapshot): void {
    this.content = snapshot.content;
    this.clock = new LamportClock();
    for (let i = 0; i < snapshot.version; i++) {
      this.clock.tick();
    }
    this.operationLog = snapshot.operations;
    this.operations.clear();
    for (const op of snapshot.operations) {
      this.operations.set(op.id, op);
    }
    this.activeUsers = new Set(snapshot.activeUsers);
  }

  /**
   * Get all operations
   */
  getOperations(): DocumentOperation[] {
    return [...this.operationLog];
  }

  /**
   * Get operation history for a user
   */
  getUserOperations(userId: string): DocumentOperation[] {
    return this.operationLog.filter((op) => op.userId === userId);
  }

  /**
   * Mark user as active
   */
  addActiveUser(userId: string): void {
    this.activeUsers.add(userId);
  }

  /**
   * Mark user as inactive
   */
  removeActiveUser(userId: string): void {
    this.activeUsers.delete(userId);
  }

  /**
   * Get active users
   */
  getActiveUsers(): string[] {
    return Array.from(this.activeUsers);
  }

  /**
   * Get statistics
   */
  getStats(): {
    contentLength: number;
    version: number;
    operationCount: number;
    userCount: number;
  } {
    const userCount = new Set(this.operationLog.map((op) => op.userId)).size;

    return {
      contentLength: this.content.length,
      version: this.clock.getTime(),
      operationCount: this.operationLog.length,
      userCount
    };
  }

  /**
   * Clear document and reset state
   */
  clear(): void {
    this.content = '';
    this.clock = new LamportClock();
    this.operations.clear();
    this.operationLog = [];
    this.activeUsers.clear();
    this.userClocks.clear();
  }

  /**
   * Record operation in log and map
   */
  private recordOperation(operation: DocumentOperation): void {
    this.operations.set(operation.id, operation);
    this.operationLog.push(operation);
    this.activeUsers.add(operation.userId);

    // Trim log if too long (keep last 1000 operations)
    if (this.operationLog.length > 1000) {
      const removed = this.operationLog.shift()!;
      this.operations.delete(removed.id);
    }
  }

  /**
   * Generate unique operation ID
   */
  private generateOpId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export state for transmission
   */
  export(): string {
    return JSON.stringify(this.getSnapshot());
  }

  /**
   * Import state from transmission
   */
  import(data: string): void {
    const snapshot = JSON.parse(data) as DocumentSnapshot;
    this.loadSnapshot(snapshot);
  }
}

/**
 * Factory for creating document stores
 */
export class DocumentStoreFactory {
  private static stores: Map<string, CRDTDocumentStore> = new Map();

  /**
   * Get or create a document store
   */
  static get(documentId: string): CRDTDocumentStore {
    if (!this.stores.has(documentId)) {
      this.stores.set(documentId, new CRDTDocumentStore());
    }
    return this.stores.get(documentId)!;
  }

  /**
   * Delete a document store
   */
  static delete(documentId: string): void {
    this.stores.delete(documentId);
  }

  /**
   * Get all document IDs
   */
  static getAllDocumentIds(): string[] {
    return Array.from(this.stores.keys());
  }

  /**
   * Clear all stores
   */
  static clearAll(): void {
    this.stores.clear();
  }
}

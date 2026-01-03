/**
 * @file CollaborationClient.ts - Client library for CRDT collaboration
 * @description WebSocket client with automatic reconnection and state synchronization
 * @module collaboration/CollaborationClient
 */

import WebSocket from 'ws';
import { CRDTDocumentStore, DocumentOperation } from './CRDTDocumentStore.js';

/**
 * User presence information
 */
export interface UserPresence {
  userId: string;
  userName: string;
  color: string;
  cursor: { line: number; column: number };
}

/**
 * Client configuration
 */
export interface CollaborationClientConfig {
  /** Server URL */
  serverUrl: string;
  /** User ID */
  userId: string;
  /** User display name */
  userName: string;
  /** Document ID to join */
  documentId: string;
  /** Auto-reconnect interval */
  reconnectInterval?: number;
  /** Maximum reconnect attempts */
  maxReconnectAttempts?: number;
}

/**
 * Client event types
 */
export enum ClientEventType {
  /** Connected to server */
  CONNECTED = 'connected',
  /** Disconnected from server */
  DISCONNECTED = 'disconnected',
  /** Received operation from server */
  OPERATION = 'operation',
  /** Received document state */
  STATE = 'state',
  /** User joined */
  USER_JOINED = 'user_joined',
  /** User left */
  USER_LEFT = 'user_left',
  /** User list updated */
  USER_LIST = 'user_list',
  /** Cursor updated */
  CURSOR = 'cursor',
  /** Error occurred */
  ERROR = 'error'
}

/**
 * Client event
 */
export interface ClientEvent {
  type: ClientEventType;
  payload: unknown;
  timestamp: number;
}

/**
 * Event callback type
 */
export type EventCallback = (event: ClientEvent) => void;

/**
 * Collaboration Client
 *
 * Client-side library for real-time collaboration:
 * - Automatic reconnection
 * - Local CRDT state management
 * - Operation queue for offline mode
 * - Presence tracking
 */
export class CollaborationClient {
  private config: Required<CollaborationClientConfig>;
  private socket: WebSocket | null = null;
  private documentStore: CRDTDocumentStore;
  private connected: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private eventCallbacks: Map<ClientEventType, EventCallback[]> = new Map();
  private pendingOperations: DocumentOperation[] = [];
  private users: Map<string, UserPresence> = new Map();

  constructor(config: CollaborationClientConfig) {
    this.config = {
      reconnectInterval: config.reconnectInterval || 3000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      ...config
    };

    this.documentStore = new CRDTDocumentStore();
  }

  /**
   * Connect to server
   */
  connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      console.warn('Already connected');
      return;
    }

    console.log(`Connecting to ${this.config.serverUrl}...`);

    this.socket = new WebSocket(this.config.serverUrl);

    this.socket.on('open', () => {
      this.handleOpen();
    });

    this.socket.on('message', (data: Buffer) => {
      this.handleMessage(data);
    });

    this.socket.on('close', () => {
      this.handleClose();
    });

    this.socket.on('error', (error) => {
      this.handleError(error);
    });
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.connected = false;
  }

  /**
   * Insert text at position
   */
  insert(position: number, text: string): DocumentOperation {
    const operation = this.documentStore.insert(
      this.config.userId,
      position,
      text
    );

    this.sendOperation(operation);

    return operation;
  }

  /**
   * Delete text at position
   */
  delete(position: number, length: number): DocumentOperation {
    const operation = this.documentStore.delete(
      this.config.userId,
      position,
      length
    );

    this.sendOperation(operation);

    return operation;
  }

  /**
   * Replace text at position
   */
  replace(position: number, length: number, text: string): DocumentOperation {
    const operation = this.documentStore.replace(
      this.config.userId,
      position,
      length,
      text
    );

    this.sendOperation(operation);

    return operation;
  }

  /**
   * Update cursor position
   */
  updateCursor(line: number, column: number): void {
    if (!this.connected || !this.socket) {
      return;
    }

    this.socket.send(
      JSON.stringify({
        type: 'cursor',
        documentId: this.config.documentId,
        payload: { line, column }
      })
    );
  }

  /**
   * Get current document content
   */
  getContent(): string {
    return this.documentStore.getContent();
  }

  /**
   * Get document version
   */
  getVersion(): number {
    return this.documentStore.getVersion();
  }

  /**
   * Get active users
   */
  getUsers(): UserPresence[] {
    return Array.from(this.users.values());
  }

  /**
   * Register event callback
   */
  on(eventType: ClientEventType, callback: EventCallback): void {
    if (!this.eventCallbacks.has(eventType)) {
      this.eventCallbacks.set(eventType, []);
    }
    this.eventCallbacks.get(eventType)!.push(callback);
  }

  /**
   * Unregister event callback
   */
  off(eventType: ClientEventType, callback: EventCallback): void {
    const callbacks = this.eventCallbacks.get(eventType);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index >= 0) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to all registered callbacks
   */
  private emit(event: ClientEvent): void {
    const callbacks = this.eventCallbacks.get(event.type);
    if (callbacks) {
      for (const callback of callbacks) {
        callback(event);
      }
    }
  }

  /**
   * Handle connection open
   */
  private handleOpen(): void {
    console.log('Connected to server');

    this.connected = true;
    this.reconnectAttempts = 0;

    // Join document
    this.socket!.send(
      JSON.stringify({
        type: 'join',
        payload: {
          userId: this.config.userId,
          userName: this.config.userName,
          documentId: this.config.documentId
        }
      })
    );

    // Emit connected event
    this.emit({
      type: ClientEventType.CONNECTED,
      payload: null,
      timestamp: Date.now()
    });

    // Send pending operations
    this.flushPendingOperations();
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'operation':
          this.handleRemoteOperation(message.payload);
          break;

        case 'state':
          this.handleState(message.payload);
          break;

        case 'user_joined':
          this.handleUserJoined(message.payload);
          break;

        case 'user_left':
          this.handleUserLeft(message.payload);
          break;

        case 'user_list':
          this.handleUserList(message.payload);
          break;

        case 'cursor':
          this.handleCursor(message.payload);
          break;

        case 'error':
          this.handleError(message.payload);
          break;

        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  /**
   * Handle remote operation
   */
  private handleRemoteOperation(operation: DocumentOperation): void {
    // Don't apply own operations
    if (operation.userId === this.config.userId) {
      return;
    }

    const result = this.documentStore.applyRemote(operation);

    if (result) {
      this.emit({
        type: ClientEventType.OPERATION,
        payload: result,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle document state
   */
  private handleState(payload: {
    content: string;
    version: number;
    operations: DocumentOperation[];
  }): void {
    // Load state into document store
    this.documentStore.clear();
    for (const op of payload.operations) {
      this.documentStore.applyRemote(op);
    }

    this.emit({
      type: ClientEventType.STATE,
      payload,
      timestamp: Date.now()
    });
  }

  /**
   * Handle user joined
   */
  private handleUserJoined(payload: {
    userId: string;
    userName: string;
    color: string;
  }): void {
    const presence: UserPresence = {
      userId: payload.userId,
      userName: payload.userName,
      color: payload.color,
      cursor: { line: 0, column: 0 }
    };

    this.users.set(payload.userId, presence);

    this.emit({
      type: ClientEventType.USER_JOINED,
      payload: presence,
      timestamp: Date.now()
    });
  }

  /**
   * Handle user left
   */
  private handleUserLeft(payload: { userId: string }): void {
    this.users.delete(payload.userId);

    this.emit({
      type: ClientEventType.USER_LEFT,
      payload,
      timestamp: Date.now()
    });
  }

  /**
   * Handle user list
   */
  private handleUserList(users: UserPresence[]): void {
    this.users.clear();
    for (const user of users) {
      // Don't add self
      if (user.userId !== this.config.userId) {
        this.users.set(user.userId, user);
      }
    }

    this.emit({
      type: ClientEventType.USER_LIST,
      payload: users,
      timestamp: Date.now()
    });
  }

  /**
   * Handle cursor update
   */
  private handleCursor(payload: {
    userId: string;
    userName: string;
    color: string;
    cursor: { line: number; column: number };
  }): void {
    const user = this.users.get(payload.userId);
    if (user) {
      user.cursor = payload.cursor;
    }

    this.emit({
      type: ClientEventType.CURSOR,
      payload,
      timestamp: Date.now()
    });
  }

  /**
   * Handle connection close
   */
  private handleClose(): void {
    console.log('Disconnected from server');

    this.connected = false;
    this.socket = null;

    this.emit({
      type: ClientEventType.DISCONNECTED,
      payload: null,
      timestamp: Date.now()
    });

    // Auto-reconnect
    if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(
        `Reconnecting in ${this.config.reconnectInterval}ms (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`
      );

      this.reconnectTimeout = setTimeout(() => {
        this.connect();
      }, this.config.reconnectInterval);
    }
  }

  /**
   * Handle error
   */
  private handleError(error: unknown): void {
    console.error('WebSocket error:', error);

    this.emit({
      type: ClientEventType.ERROR,
      payload: error,
      timestamp: Date.now()
    });
  }

  /**
   * Send operation to server
   */
  private sendOperation(operation: DocumentOperation): void {
    if (this.connected && this.socket) {
      this.socket.send(
        JSON.stringify({
          type: 'operation',
          documentId: this.config.documentId,
          payload: operation
        })
      );
    } else {
      // Queue for later
      this.pendingOperations.push(operation);
    }
  }

  /**
   * Flush pending operations
   */
  private flushPendingOperations(): void {
    for (const operation of this.pendingOperations) {
      this.sendOperation(operation);
    }
    this.pendingOperations = [];
  }

  /**
   * Get document statistics
   */
  getStats(): {
    contentLength: number;
    version: number;
    operationCount: number;
    userCount: number;
    connected: boolean;
  } {
    const storeStats = this.documentStore.getStats();

    return {
      ...storeStats,
      userCount: this.users.size,
      connected: this.connected
    };
  }
}

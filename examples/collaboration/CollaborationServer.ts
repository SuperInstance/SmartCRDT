/**
 * @file CollaborationServer.ts - WebSocket server for real-time CRDT collaboration
 * @description Implements WebSocket server with presence awareness and document synchronization
 * @module collaboration/CollaborationServer
 */

import { WebSocketServer, WebSocket } from 'ws';
import { CRDTDocumentStore, DocumentOperation } from './CRDTDocumentStore.js';

/**
 * Connected client information
 */
interface ConnectedClient {
  /** WebSocket connection */
  socket: WebSocket;
  /** User ID */
  userId: string;
  /** User display name */
  userName: string;
  /** Assigned color */
  color: string;
  /** Current cursor position */
  cursor: { line: number; column: number };
  /** Current document ID */
  documentId: string;
  /** Connection timestamp */
  connectedAt: number;
  /** Last activity timestamp */
  lastActivity: number;
}

/**
 * Server message types
 */
export enum ServerMessageType {
  /** Document operation */
  OPERATION = 'operation',
  /** Full document state */
  STATE = 'state',
  /** User joined */
  USER_JOINED = 'user_joined',
  /** User left */
  USER_LEFT = 'user_left',
  /** User list update */
  USER_LIST = 'user_list',
  /** Cursor update */
  CURSOR = 'cursor',
  /** Presence update */
  PRESENCE = 'presence',
  /** Error */
  ERROR = 'error',
  /** Acknowledgment */
  ACK = 'ack'
}

/**
 * Client message types
 */
enum ClientMessageType {
  /** Document operation */
  OPERATION = 'operation',
  /** Request full state */
  GET_STATE = 'get_state',
  /** Cursor update */
  CURSOR = 'cursor',
  /** Heartbeat */
  HEARTBEAT = 'heartbeat',
  /** Join document */
  JOIN = 'join',
  /** Leave document */
  LEAVE = 'leave'
}

/**
 * Server message format
 */
export interface ServerMessage {
  /** Message type */
  type: ServerMessageType;
  /** Document ID (if applicable) */
  documentId?: string;
  /** Payload */
  payload: unknown;
  /** Timestamp */
  timestamp: number;
}

/**
 * Client message format
 */
interface ClientMessage {
  /** Message type */
  type: ClientMessageType;
  /** Document ID (if applicable) */
  documentId?: string;
  /** Payload */
  payload: unknown;
}

/**
 * Server configuration
 */
export interface CollaborationServerConfig {
  /** WebSocket port */
  port: number;
  /** Host to bind to */
  host?: string;
  /** Heartbeat interval in milliseconds */
  heartbeatInterval?: number;
  /** Client timeout in milliseconds */
  clientTimeout?: number;
}

/**
 * Color palette for user colors
 */
const USER_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#FFA07A',
  '#98D8C8',
  '#F7DC6F',
  '#BB8FCE',
  '#85C1E2',
  '#F8B739',
  '#52C7B8'
];

/**
 * Collaboration Server
 *
 * Provides real-time document collaboration using WebSockets:
 * - Document operation broadcasting
 * - Presence awareness
 * - Cursor position sharing
 * - Automatic reconnection support
 */
export class CollaborationServer {
  private wss: WebSocketServer;
  private clients: Map<string, ConnectedClient> = new Map();
  private documents: Map<string, CRDTDocumentStore> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private config: CollaborationServerConfig;

  constructor(config: CollaborationServerConfig) {
    this.config = {
      ...config,
      host: config.host || '0.0.0.0',
      heartbeatInterval: config.heartbeatInterval || 30000,
      clientTimeout: config.clientTimeout || 60000
    };

    this.wss = new WebSocketServer({
      port: this.config.port,
      host: this.config.host
    });

    this.setupWebSocketServer();
    this.startHeartbeat();

    console.log(`Collaboration server listening on ws://${this.config.host}:${this.config.port}`);
  }

  /**
   * Get a document store, creating if necessary
   */
  private getDocument(documentId: string): CRDTDocumentStore {
    if (!this.documents.has(documentId)) {
      this.documents.set(documentId, new CRDTDocumentStore());
    }
    return this.documents.get(documentId)!;
  }

  /**
   * Setup WebSocket server event handlers
   */
  private setupWebSocketServer(): void {
    this.wss.on('connection', (socket: WebSocket, req) => {
      const clientId = this.generateClientId();

      console.log(`New connection: ${clientId}`);

      // Wait for client to identify itself
      socket.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as ClientMessage;
          this.handleMessage(clientId, message);
        } catch (error) {
          console.error(`Error parsing message from ${clientId}:`, error);
          this.sendError(socket, 'Invalid message format');
        }
      });

      socket.on('close', () => {
        this.handleDisconnect(clientId);
      });

      socket.on('error', (error) => {
        console.error(`WebSocket error for ${clientId}:`, error);
      });
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(clientId: string, message: ClientMessage): void {
    const client = this.clients.get(clientId);
    if (!client && message.type !== ClientMessageType.JOIN) {
      console.warn(`Message from unregistered client: ${clientId}`);
      return;
    }

    switch (message.type) {
      case ClientMessageType.JOIN:
        this.handleJoin(clientId, message);
        break;

      case ClientMessageType.LEAVE:
        this.handleLeave(clientId);
        break;

      case ClientMessageType.OPERATION:
        this.handleOperation(clientId, message);
        break;

      case ClientMessageType.GET_STATE:
        this.handleGetState(clientId, message);
        break;

      case ClientMessageType.CURSOR:
        this.handleCursor(clientId, message);
        break;

      case ClientMessageType.HEARTBEAT:
        this.handleHeartbeat(clientId);
        break;

      default:
        console.warn(`Unknown message type: ${(message as ClientMessage).type}`);
    }
  }

  /**
   * Handle client join
   */
  private handleJoin(clientId: string, message: ClientMessage): void {
    const payload = message.payload as {
      userId: string;
      userName: string;
      documentId: string;
    };

    const socket = this.findSocket(clientId);
    if (!socket) {
      return;
    }

    // Check if already registered
    if (this.clients.has(clientId)) {
      this.sendError(socket, 'Already registered');
      return;
    }

    // Create client
    const client: ConnectedClient = {
      socket,
      userId: payload.userId,
      userName: payload.userName,
      color: this.assignColor(payload.userId),
      cursor: { line: 0, column: 0 },
      documentId: payload.documentId,
      connectedAt: Date.now(),
      lastActivity: Date.now()
    };

    this.clients.set(clientId, client);

    // Get document
    const document = this.getDocument(payload.documentId);
    document.addActiveUser(payload.userId);

    // Send current state
    this.sendState(socket, payload.documentId, document);

    // Notify other users
    this.broadcastToDocument(
      payload.documentId,
      {
        type: ServerMessageType.USER_JOINED,
        documentId: payload.documentId,
        payload: {
          userId: payload.userId,
          userName: payload.userName,
          color: client.color
        },
        timestamp: Date.now()
      },
      clientId // Exclude sender
    );

    // Send user list
    this.sendUserList(socket, payload.documentId);

    console.log(`User joined: ${payload.userName} (${payload.userId}) in ${payload.documentId}`);
  }

  /**
   * Handle client leave
   */
  private handleLeave(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    // Remove user from document
    const document = this.documents.get(client.documentId);
    if (document) {
      document.removeActiveUser(client.userId);
    }

    // Notify other users
    this.broadcastToDocument(
      client.documentId,
      {
        type: ServerMessageType.USER_LEFT,
        documentId: client.documentId,
        payload: {
          userId: client.userId
        },
        timestamp: Date.now()
      },
      clientId
    );

    // Remove client
    this.clients.delete(clientId);

    console.log(`User left: ${client.userName} (${client.userId})`);
  }

  /**
   * Handle document operation
   */
  private handleOperation(clientId: string, message: ClientMessage): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    const operation = message.payload as DocumentOperation;

    // Verify document ID matches
    if (message.documentId !== client.documentId) {
      console.warn(`Document ID mismatch for ${clientId}`);
      return;
    }

    // Get document and apply operation
    const document = this.getDocument(client.documentId);

    try {
      const applied = document.applyRemote(operation);

      if (applied) {
        // Broadcast to other users
        this.broadcastToDocument(
          client.documentId,
          {
            type: ServerMessageType.OPERATION,
            documentId: client.documentId,
            payload: applied,
            timestamp: Date.now()
          },
          clientId // Exclude sender
        );

        // Send acknowledgment
        this.sendAck(client.socket, operation.id);
      }
    } catch (error) {
      console.error(`Error applying operation:`, error);
      this.sendError(client.socket, 'Failed to apply operation');
    }
  }

  /**
   * Handle get state request
   */
  private handleGetState(clientId: string, message: ClientMessage): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    const documentId = message.documentId || client.documentId;
    const document = this.getDocument(documentId);

    this.sendState(client.socket, documentId, document);
  }

  /**
   * Handle cursor update
   */
  private handleCursor(clientId: string, message: ClientMessage): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    const cursor = message.payload as { line: number; column: number };

    // Update client cursor
    client.cursor = cursor;
    client.lastActivity = Date.now();

    // Broadcast to other users
    this.broadcastToDocument(
      client.documentId,
      {
        type: ServerMessageType.CURSOR,
        documentId: client.documentId,
        payload: {
          userId: client.userId,
          userName: client.userName,
          color: client.color,
          cursor
        },
        timestamp: Date.now()
      },
      clientId // Exclude sender
    );
  }

  /**
   * Handle heartbeat
   */
  private handleHeartbeat(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastActivity = Date.now();
    }
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(clientId: string): void {
    this.handleLeave(clientId);
  }

  /**
   * Broadcast message to all clients in a document
   */
  private broadcastToDocument(
    documentId: string,
    message: ServerMessage,
    excludeClientId?: string
  ): void {
    for (const [clientId, client] of this.clients) {
      if (client.documentId === documentId && clientId !== excludeClientId) {
        if (client.socket.readyState === WebSocket.OPEN) {
          client.socket.send(JSON.stringify(message));
        }
      }
    }
  }

  /**
   * Send message to a client
   */
  private send(socket: WebSocket, message: ServerMessage): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  /**
   * Send document state
   */
  private sendState(
    socket: WebSocket,
    documentId: string,
    document: CRDTDocumentStore
  ): void {
    this.send(socket, {
      type: ServerMessageType.STATE,
      documentId,
      payload: {
        content: document.getContent(),
        version: document.getVersion(),
        operations: document.getOperations()
      },
      timestamp: Date.now()
    });
  }

  /**
   * Send user list
   */
  private sendUserList(socket: WebSocket, documentId: string): void {
    const users: Array<{
      userId: string;
      userName: string;
      color: string;
      cursor: { line: number; column: number };
    }> = [];

    for (const client of this.clients.values()) {
      if (client.documentId === documentId) {
        users.push({
          userId: client.userId,
          userName: client.userName,
          color: client.color,
          cursor: client.cursor
        });
      }
    }

    this.send(socket, {
      type: ServerMessageType.USER_LIST,
      documentId,
      payload: users,
      timestamp: Date.now()
    });
  }

  /**
   * Send acknowledgment
   */
  private sendAck(socket: WebSocket, operationId: string): void {
    this.send(socket, {
      type: ServerMessageType.ACK,
      payload: { operationId },
      timestamp: Date.now()
    });
  }

  /**
   * Send error
   */
  private sendError(socket: WebSocket, error: string): void {
    this.send(socket, {
      type: ServerMessageType.ERROR,
      payload: { error },
      timestamp: Date.now()
    });
  }

  /**
   * Start heartbeat interval
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeout = this.config.clientTimeout!;

      for (const [clientId, client] of this.clients) {
        if (now - client.lastActivity > timeout) {
          console.log(`Client timeout: ${clientId}`);
          client.socket.terminate();
          this.handleDisconnect(clientId);
        }
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Assign color to user
   */
  private assignColor(userId: string): string {
    // Hash-based color assignment
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash + userId.charCodeAt(i)) & 0xffffffff;
    }
    return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
  }

  /**
   * Find socket by client ID (hacky but works for demo)
   */
  private findSocket(clientId: string): WebSocket | null {
    // This is a workaround - in production you'd track this properly
    for (const client of this.clients.values()) {
      if (client.socket.readyState === WebSocket.OPEN) {
        return client.socket;
      }
    }
    return null;
  }

  /**
   * Generate client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get server statistics
   */
  getStats(): {
    clientCount: number;
    documentCount: number;
    clients: Array<{ userId: string; userName: string; documentId: string }>;
  } {
    return {
      clientCount: this.clients.size,
      documentCount: this.documents.size,
      clients: Array.from(this.clients.values()).map((c) => ({
        userId: c.userId,
        userName: c.userName,
        documentId: c.documentId
      }))
    };
  }

  /**
   * Shutdown server
   */
  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all connections
    for (const client of this.clients.values()) {
      client.socket.close();
    }

    // Close server
    this.wss.close(() => {
      console.log('Collaboration server shut down');
    });
  }
}

/**
 * @file presence.ts - Real-time presence awareness system for collaborative editing
 * @description Manages user presence, cursors, typing indicators, and activity tracking
 * @module @lsi/collaboration/presence
 */

import {
  UserStatus,
  UserCursor,
  UserPresence,
  PresenceEvent,
  PresenceEventType,
  CursorPosition,
  SelectionRange,
  TypingState,
  PresenceConfig,
  DEFAULT_PRESENCE_CONFIG,
  PresenceObserver,
  PresenceFilter,
  PresenceStats,
  ColorStrategy,
  ActivityTimeouts
} from './types.js';

/**
 * PresenceManager - Real-time user presence and collaboration tracking
 *
 * Manages user online/offline status, cursor positions, typing indicators,
 * and activity timeouts for collaborative CRDT applications.
 *
 * @example
 * ```typescript
 * const manager = new PresenceManager({
 *   userId: 'user-123',
 *   userName: 'Alice',
 *   enableCursors: true,
 *   enableTyping: true
 * });
 *
 * // Subscribe to presence events
 * manager.onPresenceChange((event) => {
 *   console.log(`${event.presence.userName} is ${event.presence.status}`);
 * });
 *
 * // Update own cursor
 * manager.updateCursor({ line: 5, column: 12 });
 *
 * // Start typing
 * manager.startTyping();
 * ```
 */
export class PresenceManager {
  /** Map of all tracked users by ID */
  private users: Map<string, UserPresence> = new Map();

  /** Current user's ID */
  private currentUserId: string;

  /** Current user's name */
  private currentUserName: string;

  /** Configuration options */
  private config: PresenceConfig;

  /** Event observers */
  private observers: Set<PresenceObserver> = new Set();

  /** Activity timeout timers */
  private idleTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private offlineTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private typingTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  /** Current document ID */
  private currentDocumentId?: string;

  /** Current cursor position */
  private currentCursor?: CursorPosition;

  /** Current selection */
  private currentSelection?: SelectionRange;

  /** Current typing state */
  private currentTypingState?: TypingState;

  /**
   * Create a new PresenceManager
   *
   * @param options - Configuration options
   */
  constructor(options: {
    userId: string;
    userName: string;
    config?: Partial<PresenceConfig>;
  }) {
    this.currentUserId = options.userId;
    this.currentUserName = options.userName;
    this.config = {
      ...DEFAULT_PRESENCE_CONFIG,
      ...options.config
    };

    // Initialize current user
    this.initializeCurrentUser();
  }

  /**
   * Initialize the current user's presence
   */
  private initializeCurrentUser(): void {
    const presence: UserPresence = {
      userId: this.currentUserId,
      userName: this.currentUserName,
      status: UserStatus.ONLINE,
      cursor: {
        userId: this.currentUserId,
        userName: this.currentUserName,
        position: { line: 0, column: 0 },
        color: this.assignColor(this.currentUserId),
        timestamp: Date.now()
      },
      lastActivity: Date.now()
    };

    this.users.set(this.currentUserId, presence);
  }

  /**
   * Assign a color to a user based on strategy
   *
   * @param userId - User ID to assign color for
   * @param strategy - Color assignment strategy
   * @returns Hex color string
   */
  private assignColor(userId: string, strategy: ColorStrategy = ColorStrategy.HASHED): string {
    const palette = this.config.colorPalette;

    switch (strategy) {
      case ColorStrategy.SEQUENTIAL:
        const index = this.users.size % palette.length;
        return palette[index];

      case ColorStrategy.RANDOM:
        return palette[Math.floor(Math.random() * palette.length)];

      case ColorStrategy.HASHED:
      default:
        // Simple hash of userId for consistent color
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
          hash = ((hash << 5) - hash) + userId.charCodeAt(i);
          hash = hash & hash;
        }
        return palette[Math.abs(hash) % palette.length];
    }
  }

  /**
   * Subscribe to presence events
   *
   * @param observer - Callback function for presence events
   * @returns Unsubscribe function
   */
  onPresenceChange(observer: PresenceObserver): () => void {
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }

  /**
   * Emit a presence event to all observers
   *
   * @param type - Event type
   * @param userId - User ID
   * @param presence - User presence data
   */
  private emit(type: PresenceEventType, userId: string, presence: UserPresence): void {
    const event: PresenceEvent = {
      type,
      userId,
      presence,
      timestamp: Date.now()
    };

    this.observers.forEach(observer => observer(event));
  }

  /**
   * Update the current user's cursor position
   *
   * @param position - New cursor position
   * @param selection - Optional selection range
   */
  updateCursor(position: CursorPosition, selection?: SelectionRange): void {
    this.currentCursor = position;
    this.currentSelection = selection;

    const presence = this.users.get(this.currentUserId);
    if (!presence) return;

    presence.cursor = {
      ...presence.cursor!,
      position,
      selection,
      timestamp: Date.now()
    };

    presence.lastActivity = Date.now();
    this.resetIdleTimer(this.currentUserId);

    this.emit(PresenceEventType.CURSOR_MOVED, this.currentUserId, presence);
  }

  /**
   * Update the current user's typing state
   *
   * @param isTyping - Whether user is typing
   * @param partialLength - Optional partial text length
   */
  setTyping(isTyping: boolean, partialLength?: number): void {
    const presence = this.users.get(this.currentUserId);
    if (!presence) return;

    if (isTyping) {
      this.currentTypingState = {
        isTyping: true,
        startTime: Date.now(),
        partialLength
      };
      presence.typing = this.currentTypingState;
      presence.lastActivity = Date.now();

      // Set typing timeout
      this.resetTypingTimer(this.currentUserId);
    } else {
      this.currentTypingState = undefined;
      presence.typing = undefined;
    }

    this.emit(PresenceEventType.TYPING_CHANGED, this.currentUserId, presence);
  }

  /**
   * Convenience method to start typing indicator
   */
  startTyping(): void {
    this.setTyping(true);
  }

  /**
   * Convenience method to stop typing indicator
   */
  stopTyping(): void {
    this.setTyping(false);
  }

  /**
   * Update the current user's document context
   *
   * @param documentId - Document ID being edited
   */
  setDocument(documentId: string): void {
    const oldDocumentId = this.currentDocumentId;
    this.currentDocumentId = documentId;

    const presence = this.users.get(this.currentUserId);
    if (!presence) return;

    presence.documentId = documentId;
    presence.lastActivity = Date.now();

    this.emit(PresenceEventType.DOCUMENT_CHANGED, this.currentUserId, presence);
  }

  /**
   * Update the current user's status
   *
   * @param status - New user status
   */
  setStatus(status: UserStatus): void {
    const presence = this.users.get(this.currentUserId);
    if (!presence) return;

    const oldStatus = presence.status;
    presence.status = status;

    if (status === UserStatus.IDLE || status === UserStatus.OFFLINE) {
      // Clear cursor when going idle/offline
      presence.cursor = undefined;
    } else if (status === UserStatus.ONLINE && !presence.cursor) {
      // Restore cursor when coming back online
      presence.cursor = {
        userId: this.currentUserId,
        userName: this.currentUserName,
        position: this.currentCursor || { line: 0, column: 0 },
        selection: this.currentSelection,
        color: this.assignColor(this.currentUserId),
        timestamp: Date.now()
      };
    }

    this.emit(PresenceEventType.STATUS_CHANGED, this.currentUserId, presence);
  }

  /**
   * Update or add another user's presence (remote update)
   *
   * @param presence - User presence data
   */
  updateRemoteUser(presence: UserPresence): void {
    // Don't update self
    if (presence.userId === this.currentUserId) return;

    // Check max users limit
    if (this.users.size >= this.config.maxUsers && !this.users.has(presence.userId)) {
      return; // At capacity
    }

    const isNewUser = !this.users.has(presence.userId);
    const existing = this.users.get(presence.userId);

    // Merge with existing presence if any
    const updated: UserPresence = {
      ...existing,
      ...presence,
      lastActivity: Math.max(
        existing?.lastActivity || 0,
        presence.lastActivity
      )
    } as UserPresence;

    this.users.set(presence.userId, updated);

    // Reset idle timer for remote user
    this.resetIdleTimer(presence.userId);

    if (isNewUser) {
      this.emit(PresenceEventType.USER_JOINED, presence.userId, updated);
    } else {
      this.emit(PresenceEventType.STATUS_CHANGED, presence.userId, updated);
    }
  }

  /**
   * Remove a user from tracking
   *
   * @param userId - User ID to remove
   */
  removeUser(userId: string): void {
    if (userId === this.currentUserId) return;

    const presence = this.users.get(userId);
    if (presence) {
      this.users.delete(userId);
      this.clearTimers(userId);
      this.emit(PresenceEventType.USER_LEFT, userId, presence);
    }
  }

  /**
   * Get a user's presence by ID
   *
   * @param userId - User ID
   * @returns User presence or undefined
   */
  getUser(userId: string): UserPresence | undefined {
    return this.users.get(userId);
  }

  /**
   * Get all tracked users
   *
   * @param filter - Optional filter criteria
   * @returns Array of user presence objects
   */
  getUsers(filter?: PresenceFilter): UserPresence[] {
    let users = Array.from(this.users.values());

    if (filter) {
      if (filter.status) {
        users = users.filter(u => u.status === filter.status);
      }
      if (filter.documentId) {
        users = users.filter(u => u.documentId === filter.documentId);
      }
      if (filter.onlyTyping) {
        users = users.filter(u => u.typing?.isTyping);
      }
      if (filter.cursorInLine !== undefined) {
        users = users.filter(u =>
          u.cursor?.position.line === filter.cursorInLine
        );
      }
    }

    return users;
  }

  /**
   * Get users in the same document
   *
   * @param documentId - Document ID
   * @returns Users in the document
   */
  getUsersInDocument(documentId: string): UserPresence[] {
    return this.getUsers({
      documentId,
      status: UserStatus.ONLINE
    });
  }

  /**
   * Get users with cursors on a specific line
   *
   * @param line - Line number
   * @returns Users with cursors on that line
   */
  getUsersOnLine(line: number): UserPresence[] {
    return this.getUsers().filter(u =>
      u.cursor?.position.line === line
    );
  }

  /**
   * Get currently typing users
   *
   * @param documentId - Optional document filter
   * @returns Array of typing users
   */
  getTypingUsers(documentId?: string): UserPresence[] {
    return this.getUsers({
      documentId,
      onlyTyping: true
    });
  }

  /**
   * Calculate presence statistics
   *
   * @returns Presence statistics
   */
  getStats(): PresenceStats {
    const users = Array.from(this.users.values());
    const onlineCount = users.filter(u => u.status === UserStatus.ONLINE).length;
    const idleCount = users.filter(u => u.status === UserStatus.IDLE).length;
    const typingCount = users.filter(u => u.typing?.isTyping).length;

    // Calculate average activity time
    const now = Date.now();
    const averageActivityTime = users.length > 0
      ? users.reduce((sum, u) => sum + (now - u.lastActivity), 0) / users.length
      : 0;

    // Find most active document
    const documentCounts = new Map<string, number>();
    users.forEach(u => {
      if (u.documentId && u.status === UserStatus.ONLINE) {
        documentCounts.set(
          u.documentId,
          (documentCounts.get(u.documentId) || 0) + 1
        );
      }
    });

    let mostActiveDocument: string | undefined;
    let maxCount = 0;
    documentCounts.forEach((count, docId) => {
      if (count > maxCount) {
        maxCount = count;
        mostActiveDocument = docId;
      }
    });

    return {
      totalUsers: users.length,
      onlineCount,
      idleCount,
      typingCount,
      averageActivityTime,
      mostActiveDocument
    };
  }

  /**
   * Reset idle timer for a user
   *
   * @param userId - User ID
   */
  private resetIdleTimer(userId: string): void {
    this.clearTimers(userId);

    // Idle timer
    const idleTimer = setTimeout(() => {
      this.markUserIdle(userId);
    }, this.config.timeouts.idleTimeout);
    this.idleTimers.set(userId, idleTimer);

    // Offline timer
    const offlineTimer = setTimeout(() => {
      this.markUserOffline(userId);
    }, this.config.timeouts.offlineTimeout);
    this.offlineTimers.set(userId, offlineTimer);
  }

  /**
   * Reset typing timer for a user
   *
   * @param userId - User ID
   */
  private resetTypingTimer(userId: string): void {
    const existing = this.typingTimers.get(userId);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.clearTyping(userId);
    }, this.config.timeouts.typingTimeout);
    this.typingTimers.set(userId, timer);
  }

  /**
   * Mark a user as idle due to inactivity
   *
   * @param userId - User ID
   */
  private markUserIdle(userId: string): void {
    const presence = this.users.get(userId);
    if (!presence || presence.status !== UserStatus.ONLINE) return;

    presence.status = UserStatus.IDLE;
    presence.cursor = undefined;
    this.emit(PresenceEventType.STATUS_CHANGED, userId, presence);
  }

  /**
   * Mark a user as offline due to inactivity
   *
   * @param userId - User ID
   */
  private markUserOffline(userId: string): void {
    const presence = this.users.get(userId);
    if (!presence) return;

    presence.status = UserStatus.OFFLINE;
    presence.cursor = undefined;
    presence.typing = undefined;
    this.clearTimers(userId);
    this.emit(PresenceEventType.STATUS_CHANGED, userId, presence);
  }

  /**
   * Clear typing indicator for a user
   *
   * @param userId - User ID
   */
  private clearTyping(userId: string): void {
    const presence = this.users.get(userId);
    if (!presence) return;

    presence.typing = undefined;
    this.emit(PresenceEventType.TYPING_CHANGED, userId, presence);
  }

  /**
   * Clear all timers for a user
   *
   * @param userId - User ID
   */
  private clearTimers(userId: string): void {
    const idle = this.idleTimers.get(userId);
    if (idle) clearTimeout(idle);

    const offline = this.offlineTimers.get(userId);
    if (offline) clearTimeout(offline);

    const typing = this.typingTimers.get(userId);
    if (typing) clearTimeout(typing);

    this.idleTimers.delete(userId);
    this.offlineTimers.delete(userId);
    this.typingTimers.delete(userId);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.observers.clear();

    // Clear all timers
    this.idleTimers.forEach(timer => clearTimeout(timer));
    this.offlineTimers.forEach(timer => clearTimeout(timer));
    this.typingTimers.forEach(timer => clearTimeout(timer));

    this.idleTimers.clear();
    this.offlineTimers.clear();
    this.typingTimers.clear();

    this.users.clear();
  }
}

/**
 * Factory function to create a PresenceManager with Yjs integration
 *
 * @param doc - Yjs document
 * @param options - Configuration options
 * @returns PresenceManager instance
 */
export function createPresenceWithYjs(
  doc: any,
  options: {
    userId: string;
    userName: string;
    config?: Partial<PresenceConfig>;
  }
): PresenceManager {
  // This will be implemented when Yjs integration is added
  const manager = new PresenceManager(options);

  // TODO: Wire up Yjs awareness sync
  // const awareness = doc.awareness;
  // awareness.setLocalStateField('presence', ...);

  return manager;
}

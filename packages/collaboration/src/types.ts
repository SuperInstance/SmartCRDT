/**
 * @file types.ts - Type definitions for CRDT collaboration features
 * @description Core types for presence awareness, cursor tracking, and collaboration
 * @module @lsi/collaboration/types
 */

/**
 * User connection status
 */
export enum UserStatus {
  /** User is actively connected and working */
  ONLINE = 'online',
  /** User is connected but inactive for a period */
  IDLE = 'idle',
  /** User has disconnected */
  OFFLINE = 'offline',
  /** User is in a do-not-disturb mode */
  BUSY = 'busy'
}

/**
 * Typing state for collaborative editing
 */
export interface TypingState {
  /** Whether the user is currently typing */
  isTyping: boolean;
  /** Timestamp when typing started */
  startTime: number;
  /** Optional: partial text being typed (not shared for privacy) */
  partialLength?: number;
}

/**
 * Cursor position in a document
 */
export interface CursorPosition {
  /** Zero-based line number */
  line: number;
  /** Zero-based column character offset */
  column: number;
}

/**
 * Text selection range
 */
export interface SelectionRange {
  /** Start position of selection */
  start: CursorPosition;
  /** End position of selection */
  end: CursorPosition;
}

/**
 * User cursor information
 */
export interface UserCursor {
  /** User's unique identifier */
  userId: string;
  /** User's display name */
  userName: string;
  /** Current cursor position */
  position: CursorPosition;
  /** Optional selection range */
  selection?: SelectionRange;
  /** Color for cursor highlighting (hex format) */
  color: string;
  /** Timestamp of last cursor update */
  timestamp: number;
}

/**
 * Presence information for a user
 */
export interface UserPresence {
  /** User's unique identifier */
  userId: string;
  /** User's display name */
  userName: string;
  /** Current connection status */
  status: UserStatus;
  /** User's current cursor (if online/idle) */
  cursor?: UserCursor;
  /** Typing state */
  typing?: TypingState;
  /** Current document/room being edited */
  documentId?: string;
  /** Timestamp of last activity */
  lastActivity: number;
  /** User's avatar URL (optional) */
  avatar?: string;
}

/**
 * Presence event types
 */
export enum PresenceEventType {
  /** User came online */
  USER_JOINED = 'user_joined',
  /** User went offline */
  USER_LEFT = 'user_left',
  /** User status changed */
  STATUS_CHANGED = 'status_changed',
  /** User cursor moved */
  CURSOR_MOVED = 'cursor_moved',
  /** User selection changed */
  SELECTION_CHANGED = 'selection_changed',
  /** User started/stopped typing */
  TYPING_CHANGED = 'typing_changed',
  /** User switched documents */
  DOCUMENT_CHANGED = 'document_changed'
}

/**
 * Presence update event
 */
export interface PresenceEvent {
  /** Event type */
  type: PresenceEventType;
  /** User ID for whom event occurred */
  userId: string;
  /** Updated presence information */
  presence: UserPresence;
  /** Event timestamp */
  timestamp: number;
}

/**
 * Activity timeout configuration
 */
export interface ActivityTimeouts {
  /** Milliseconds of inactivity before marking user as idle (default: 2 minutes) */
  idleTimeout: number;
  /** Milliseconds of inactivity before marking user as offline (default: 5 minutes) */
  offlineTimeout: number;
  /** Milliseconds to clear typing indicator after inactivity (default: 3 seconds) */
  typingTimeout: number;
}

/**
 * Default timeout values
 */
export const DEFAULT_TIMEOUTS: ActivityTimeouts = {
  idleTimeout: 2 * 60 * 1000,      // 2 minutes
  offlineTimeout: 5 * 60 * 1000,   // 5 minutes
  typingTimeout: 3 * 1000          // 3 seconds
};

/**
 * Presence manager configuration
 */
export interface PresenceConfig {
  /** Activity timeout thresholds */
  timeouts: ActivityTimeouts;
  /** Whether to broadcast cursor updates */
  enableCursors: boolean;
  /** Whether to broadcast typing indicators */
  enableTyping: boolean;
  /** Maximum number of users to track */
  maxUsers: number;
  /** Color palette for automatic cursor color assignment */
  colorPalette: string[];
}

/**
 * Default presence configuration
 */
export const DEFAULT_PRESENCE_CONFIG: PresenceConfig = {
  timeouts: DEFAULT_TIMEOUTS,
  enableCursors: true,
  enableTyping: true,
  maxUsers: 100,
  colorPalette: [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
    '#F8B739', '#52C7B8', '#FF7675', '#74B9FF'
  ]
};

/**
 * Presence observer callback type
 */
export type PresenceObserver = (event: PresenceEvent) => void;

/**
 * Filter options for querying presence
 */
export interface PresenceFilter {
  /** Filter by user status */
  status?: UserStatus;
  /** Filter by document ID */
  documentId?: string;
  /** Include only users with cursors in specified range */
  cursorInLine?: number;
  /** Include only typing users */
  onlyTyping?: boolean;
}

/**
 * Presence statistics
 */
export interface PresenceStats {
  /** Total number of tracked users */
  totalUsers: number;
  /** Number of users currently online */
  onlineCount: number;
  /** Number of users currently idle */
  idleCount: number;
  /** Number of users currently typing */
  typingCount: number;
  /** Average activity time (milliseconds) */
  averageActivityTime: number;
  /** Most active document ID */
  mostActiveDocument?: string;
}

/**
 * Color assignment strategy
 */
export enum ColorStrategy {
  /** Assign colors sequentially from palette */
  SEQUENTIAL = 'sequential',
  /** Assign colors randomly */
  RANDOM = 'random',
  /** Hash-based consistent assignment */
  HASHED = 'hashed'
}

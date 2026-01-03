/**
 * @file index.ts - Main entry point for @lsi/collaboration package
 * @description Real-time collaboration features for CRDT-based applications
 * @module @lsi/collaboration
 *
 * Features:
 * - User presence tracking (online/offline/idle/busy)
 * - Real-time cursor positions
 * - Selection highlighting
 * - Typing indicators
 * - Activity timeout management
 * - UI components for collaboration
 * - CRDT synchronization protocol
 * - Incremental state sync
 * - Compression support
 * - Conflict resolution
 * - Recovery from disconnects
 *
 * @example
 * ```typescript
 * import { PresenceManager, SyncProtocol } from '@lsi/collaboration';
 *
 * // Presence tracking
 * const presence = new PresenceManager({
 *   userId: 'user-123',
 *   userName: 'Alice'
 * });
 *
 * // Sync protocol
 * const sync = new SyncProtocol('replica-1', {
 *   enableCompression: true,
 *   preferredCompression: CompressionType.GZIP
 * });
 *
 * await sync.connect('replica-2');
 * ```
 */

// Core types
export * from './types.js';

// Presence management
export { PresenceManager, createPresenceWithYjs } from './presence.js';

// Cursor tracking
export {
  CursorTracker,
  detectCursorCollisions,
  formatTypingIndicator
} from './cursor.js';

// Sync protocol
export {
  SyncProtocol,
  CompressionUtil,
  createSyncProtocol,
  createSyncGroup,
  type SyncHandshake,
  type SyncRequest,
  type SyncResponse,
  type OperationsBatch,
  type Acknowledgment,
  type SnapshotMessage,
  type Heartbeat,
  type SyncError,
  type SyncMessage,
  type SyncCapabilities,
  type SyncConfig,
  type SyncStats,
  type DocumentOperation,
  type DocumentSnapshot,
  type ConflictResolution
} from './sync.js';

// Re-export sync enums
export {
  SyncMessageType,
  CompressionType,
  SyncErrorCode,
  ConnectionState,
  SYNC_PROTOCOL_VERSION,
  DEFAULT_SYNC_CONFIG
} from './sync.js';

// UI components
export {
  UI,
  renderPresenceIndicator,
  renderPresenceList,
  renderStatusBadge,
  renderPresenceStatsCard,
  renderCollaborationPanel,
  renderCursor,
  renderSelectionHighlights,
  TYPING_DOTS_CSS,
  PRESENCE_CSS
} from './ui.js';

// Re-export cursor UI types
export type {
  CursorRenderProps,
  SelectionHighlightProps,
  PresenceIndicatorProps,
  PresenceListProps,
  StatusBadgeProps,
  PresenceStatsCardProps,
  CollaborationPanelProps
} from './ui.js';

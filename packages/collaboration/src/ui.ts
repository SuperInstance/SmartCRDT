/**
 * @file ui.ts - UI components for presence awareness and collaboration
 * @description React/Vue-compatible components for displaying user presence
 * @module @lsi/collaboration/ui
 */

import {
  UserPresence,
  UserStatus,
  PresenceStats
} from './types.js';
import {
  detectCursorCollisions,
  formatTypingIndicator
} from './cursor.js';

/**
 * Presence indicator props
 */
export interface PresenceIndicatorProps {
  /** User presence data */
  presence: UserPresence;
  /** Show status indicator */
  showStatus?: boolean;
  /** Show cursor indicator */
  showCursor?: boolean;
  /** Size of indicator (small, medium, large) */
  size?: 'small' | 'medium' | 'large';
}

/**
 * Generate HTML for presence indicator
 *
 * @param props - Presence indicator props
 * @returns HTML string
 */
export function renderPresenceIndicator(props: PresenceIndicatorProps): string {
  const { presence, showStatus = true, showCursor = false, size = 'medium' } = props;

  const sizeClasses = {
    small: 'w-6 h-6 text-xs',
    medium: 'w-8 h-8 text-sm',
    large: 'w-10 h-10 text-base'
  };

  const statusColors = {
    [UserStatus.ONLINE]: 'bg-green-500',
    [UserStatus.IDLE]: 'bg-yellow-500',
    [UserStatus.OFFLINE]: 'bg-gray-400',
    [UserStatus.BUSY]: 'bg-red-500'
  };

  const statusColor = statusColors[presence.status];
  const sizeClass = sizeClasses[size];

  let avatar = presence.avatar
    ? `<img src="${presence.avatar}" class="${sizeClass} rounded-full object-cover" />`
    : `<div class="${sizeClass} rounded-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-blue-500 text-white font-semibold">${presence.userName.charAt(0).toUpperCase()}</div>`;

  if (showStatus) {
    avatar = `
      <div class="relative inline-block">
        ${avatar}
        <span class="absolute bottom-0 right-0 ${sizeClass === sizeClasses.small ? 'w-2 h-2' : sizeClass === sizeClasses.medium ? 'w-3 h-3' : 'w-4 h-4'} ${statusColor} border-2 border-white rounded-full"></span>
      </div>
    `;
  }

  return avatar;
}

/**
 * Presence list props
 */
export interface PresenceListProps {
  /** Array of user presence data */
  users: UserPresence[];
  /** Filter by status */
  filterStatus?: UserStatus;
  /** Maximum users to display */
  maxUsers?: number;
  /** Show typing indicator */
  showTyping?: boolean;
}

/**
 * Generate HTML for presence list
 *
 * @param props - Presence list props
 * @returns HTML string
 */
export function renderPresenceList(props: PresenceListProps): string {
  const { users, filterStatus, maxUsers, showTyping = true } = props;

  let filteredUsers = filterStatus
    ? users.filter(u => u.status === filterStatus)
    : users;

  if (maxUsers && filteredUsers.length > maxUsers) {
    filteredUsers = filteredUsers.slice(0, maxUsers);
  }

  const typingUsers = showTyping
    ? users.filter(u => u.typing?.isTyping)
    : [];

  const typingIndicator = typingUsers.length > 0
    ? `<div class="text-sm text-gray-500 mb-2">${formatTypingIndicator(typingUsers)}</div>`
    : '';

  const items = filteredUsers.map(user => {
    const indicator = renderPresenceIndicator({ presence: user, size: 'small' });
    return `
      <div class="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg transition-colors">
        ${indicator}
        <div class="flex-1">
          <div class="text-sm font-medium text-gray-900">${user.userName}</div>
          ${user.documentId ? `<div class="text-xs text-gray-500">Editing: ${user.documentId}</div>` : ''}
        </div>
        ${user.typing?.isTyping ? '<span class="text-xs text-blue-500">Typing...</span>' : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="presence-list">
      ${typingIndicator}
      <div class="space-y-1">
        ${items}
      </div>
      ${maxUsers && users.length > maxUsers ? `<div class="text-xs text-gray-500 mt-2">+${users.length - maxUsers} more</div>` : ''}
    </div>
  `;
}

/**
 * Status badge props
 */
export interface StatusBadgeProps {
  /** User status */
  status: UserStatus;
  /** Custom class names */
  className?: string;
}

/**
 * Generate HTML for status badge
 *
 * @param props - Status badge props
 * @returns HTML string
 */
export function renderStatusBadge(props: StatusBadgeProps): string {
  const { status, className = '' } = props;

  const statusConfig = {
    [UserStatus.ONLINE]: {
      label: 'Online',
      bgColor: 'bg-green-100',
      textColor: 'text-green-800',
      dotColor: 'bg-green-500'
    },
    [UserStatus.IDLE]: {
      label: 'Idle',
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-800',
      dotColor: 'bg-yellow-500'
    },
    [UserStatus.OFFLINE]: {
      label: 'Offline',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-800',
      dotColor: 'bg-gray-400'
    },
    [UserStatus.BUSY]: {
      label: 'Busy',
      bgColor: 'bg-red-100',
      textColor: 'text-red-800',
      dotColor: 'bg-red-500'
    }
  };

  const config = statusConfig[status];

  return `
    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor} ${className}">
      <span class="w-1.5 h-1.5 rounded-full ${config.dotColor}"></span>
      ${config.label}
    </span>
  `;
}

/**
 * Stats card props
 */
export interface PresenceStatsCardProps {
  /** Presence statistics */
  stats: PresenceStats;
  /** Custom class names */
  className?: string;
}

/**
 * Generate HTML for presence stats card
 *
 * @param props - Stats card props
 * @returns HTML string
 */
export function renderPresenceStatsCard(props: PresenceStatsCardProps): string {
  const { stats, className = '' } = props;

  return `
    <div class="presence-stats-card bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}">
      <h3 class="text-sm font-semibold text-gray-900 mb-3">Collaboration Stats</h3>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <div class="text-2xl font-bold text-gray-900">${stats.onlineCount}</div>
          <div class="text-xs text-gray-500">Online Now</div>
        </div>
        <div>
          <div class="text-2xl font-bold text-gray-900">${stats.typingCount}</div>
          <div class="text-xs text-gray-500">Typing</div>
        </div>
        <div>
          <div class="text-2xl font-bold text-gray-900">${stats.idleCount}</div>
          <div class="text-xs text-gray-500">Idle</div>
        </div>
        <div>
          <div class="text-2xl font-bold text-gray-900">${stats.totalUsers}</div>
          <div class="text-xs text-gray-500">Total Users</div>
        </div>
      </div>
      ${stats.mostActiveDocument ? `
        <div class="mt-3 pt-3 border-t border-gray-100">
          <div class="text-xs text-gray-500">Most Active Document</div>
          <div class="text-sm font-medium text-gray-900 truncate">${stats.mostActiveDocument}</div>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Collaboration panel props
 */
export interface CollaborationPanelProps {
  /** Array of user presence data */
  users: UserPresence[];
  /** Presence statistics */
  stats: PresenceStats;
  /** Current user ID */
  currentUserId: string;
  /** On click handler */
  onClick?: () => void;
}

/**
 * Generate HTML for collaboration panel
 *
 * @param props - Collaboration panel props
 * @returns HTML string
 */
export function renderCollaborationPanel(props: CollaborationPanelProps): string {
  const { users, stats, currentUserId } = props;

  const onlineUsers = users.filter(u => u.status === UserStatus.ONLINE);
  const currentUser = users.find(u => u.userId === currentUserId);

  return `
    <div class="collaboration-panel bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
      <!-- Header -->
      <div class="px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-gray-900">Collaborators</h2>
          ${renderStatusBadge({ status: currentUser?.status || UserStatus.ONLINE })}
        </div>
      </div>

      <!-- Stats -->
      <div class="px-4 py-3 border-b border-gray-100">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-1">
            <div class="w-2 h-2 rounded-full bg-green-500"></div>
            <span class="text-sm text-gray-600">${stats.onlineCount} online</span>
          </div>
          <div class="flex items-center gap-1">
            <div class="w-2 h-2 rounded-full bg-blue-500"></div>
            <span class="text-sm text-gray-600">${stats.typingCount} typing</span>
          </div>
        </div>
      </div>

      <!-- User List -->
      <div class="max-h-64 overflow-y-auto">
        ${renderPresenceList({
          users,
          filterStatus: UserStatus.ONLINE,
          showTyping: true
        })}
      </div>

      <!-- Footer -->
      <div class="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 text-center">
        ${stats.totalUsers} total users
      </div>
    </div>
  `;
}

/**
 * Cursor render props
 */
export interface CursorRenderProps {
  /** User cursor data */
  cursor: {
    userId: string;
    userName: string;
    color: string;
  };
  /** Position in pixels */
  position: { x: number; y: number };
  /** Show label */
  showLabel?: boolean;
  /** Label opacity */
  labelOpacity?: number;
}

/**
 * Generate HTML/CSS for cursor element
 *
 * @param props - Cursor render props
 * @returns Object with HTML and styles
 */
export function renderCursor(props: CursorRenderProps): {
  html: string;
  styles: Record<string, string>;
} {
  const { cursor, position, showLabel = true, labelOpacity = 1 } = props;

  const styles: Record<string, string> = {
    '--cursor-x': `${position.x}px`,
    '--cursor-y': `${position.y}px`,
    '--cursor-color': cursor.color,
    '--label-opacity': labelOpacity.toString()
  };

  const html = `
    <div class="remote-cursor" style="position: absolute; left: var(--cursor-x); top: var(--cursor-y); pointer-events: none;">
      <!-- Cursor line -->
      <div style="
        width: 2px;
        height: 20px;
        background-color: var(--cursor-color);
        animation: cursor-blink 1s step-end infinite;
      "></div>

      <!-- Label -->
      ${showLabel ? `
        <div class="cursor-label" style="
          position: absolute;
          left: 4px;
          top: -4px;
          padding: 2px 6px;
          background-color: var(--cursor-color);
          color: white;
          font-size: 11px;
          border-radius: 3px;
          white-space: nowrap;
          opacity: var(--label-opacity);
          transition: opacity 0.2s;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        ">${cursor.userName}</div>
      ` : ''}
    </div>
  `;

  return { html, styles };
}

/**
 * Selection highlight render props
 */
export interface SelectionHighlightProps {
  /** Selection rectangles */
  highlights: Array<{
    rect: { x: number; y: number; width: number; height: number };
    backgroundColor: string;
  }>;
}

/**
 * Generate HTML for selection highlights
 *
 * @param props - Selection highlight props
 * @returns HTML string
 */
export function renderSelectionHighlights(props: SelectionHighlightProps): string {
  const { highlights } = props;

  return highlights.map(h => `
    <div style="
      position: absolute;
      left: ${h.rect.x}px;
      top: ${h.rect.y}px;
      width: ${h.rect.width}px;
      height: ${h.rect.height}px;
      background-color: ${h.backgroundColor};
      pointer-events: none;
    "></div>
  `).join('');
}

/**
 * Typing indicator animation
 */
export const TYPING_DOTS_CSS = `
  @keyframes typing {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-4px); }
  }

  .typing-dot {
    animation: typing 1.4s infinite ease-in-out;
  }

  .typing-dot:nth-child(1) { animation-delay: 0s; }
  .typing-dot:nth-child(2) { animation-delay: 0.2s; }
  .typing-dot:nth-child(3) { animation-delay: 0.4s; }
`;

/**
 * CSS animations for cursor and presence
 */
export const PRESENCE_CSS = `
  @keyframes cursor-blink {
    0%, 49% { opacity: 1; }
    50%, 100% { opacity: 0; }
  }

  @keyframes pulse-ring {
    0% { transform: scale(0.8); opacity: 1; }
    100% { transform: scale(1.4); opacity: 0; }
  }

  .remote-cursor {
    transition: left 0.15s ease-out, top 0.15s ease-out;
    z-index: 1000;
  }

  .presence-indicator-online .status-dot::after {
    content: '';
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background-color: inherit;
    animation: pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
  }
`;

/**
 * Export all UI rendering functions
 */
export const UI = {
  renderPresenceIndicator,
  renderPresenceList,
  renderStatusBadge,
  renderPresenceStatsCard,
  renderCollaborationPanel,
  renderCursor,
  renderSelectionHighlights,
  TYPING_DOTS_CSS,
  PRESENCE_CSS
};

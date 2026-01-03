/**
 * @file cursor.ts - Cursor tracking and rendering for collaborative editing
 * @description Manages remote cursor positions, rendering, and selection highlighting
 * @module @lsi/collaboration/cursor
 */

import {
  UserCursor,
  CursorPosition,
  SelectionRange,
  UserPresence,
  UserStatus
} from './types.js';

/**
 * Cursor renderer configuration
 */
export interface CursorRendererConfig {
  /** Show user name label on cursor */
  showLabel: boolean;
  /** Label display duration (ms) */
  labelDuration: number;
  /** Animation duration for cursor movement (ms) */
  animationDuration: number;
  /** Minimum distance to trigger cursor animation (pixels) */
  animationThreshold: number;
  /** Enable selection highlighting */
  enableSelection: boolean;
}

/**
 * Default cursor renderer configuration
 */
export const DEFAULT_CURSOR_CONFIG: CursorRendererConfig = {
  showLabel: true,
  labelDuration: 3000,
  animationDuration: 200,
  animationThreshold: 10,
  enableSelection: true
};

/**
 * Cursor position in pixel coordinates
 */
export interface PixelPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Cursor render data
 */
export interface CursorRenderData {
  /** Cursor to render */
  cursor: UserCursor;
  /** Screen position in pixels */
  position: PixelPosition;
  /** Selection highlight positions (if any) */
  selectionHighlights?: SelectionHighlight[];
  /** Whether to show label */
  showLabel: boolean;
  /** Label opacity (0-1) */
  labelOpacity: number;
}

/**
 * Selection highlight rectangle
 */
export interface SelectionHighlight {
  /** Rectangle position */
  rect: PixelPosition;
  /** Background color (rgba) */
  backgroundColor: string;
}

/**
 * CursorTracker - Manages cursor position tracking and rendering
 *
 * Handles conversion from document positions to screen coordinates,
 * animation of cursor movements, and rendering of multi-user cursors.
 *
 * @example
 * ```typescript
 * const tracker = new CursorTracker({
 *   showLabel: true,
 *   enableSelection: true
 * });
 *
 * // Update cursor positions from presence data
 * tracker.updateCursors(presenceData.getUsersInDocument('doc-123'));
 *
 * // Get render data for all cursors
 * const renderData = tracker.getRenderData();
 * ```
 */
export class CursorTracker {
  /** Tracked cursors by user ID */
  private cursors: Map<string, UserCursor> = new Map();

  /** Last known positions for animation */
  private lastPositions: Map<string, PixelPosition> = new Map();

  /** Configuration */
  private config: CursorRendererConfig;

  /** Label visibility timers */
  private labelTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  /** Document metrics for position calculation */
  private metrics: DocumentMetrics = {
    lineHeight: 24,
    charWidth: 9,
    lineHeightPixels: 24,
    tabSize: 4
  };

  /**
   * Create a new CursorTracker
   *
   * @param config - Renderer configuration
   */
  constructor(config: Partial<CursorRendererConfig> = {}) {
    this.config = {
      ...DEFAULT_CURSOR_CONFIG,
      ...config
    };
  }

  /**
   * Update document metrics for position calculation
   *
   * @param metrics - Document metrics
   */
  setDocumentMetrics(metrics: Partial<DocumentMetrics>): void {
    this.metrics = {
      ...this.metrics,
      ...metrics
    };
  }

  /**
   * Update tracked cursors from presence data
   *
   * @param users - User presence array
   */
  updateCursors(users: UserPresence[]): void {
    const now = Date.now();

    users.forEach(user => {
      // Skip offline/idle users without cursors
      if (user.status !== UserStatus.ONLINE || !user.cursor) return;

      const existing = this.cursors.get(user.userId);

      // Update last position for animation if cursor exists
      if (existing) {
        const lastPos = this.calculatePixelPosition(existing.position);
        this.lastPositions.set(user.userId, lastPos);
      }

      this.cursors.set(user.userId, user.cursor);

      // Reset label timer
      this.resetLabelTimer(user.userId);
    });

    // Remove cursors for users not in the list
    const currentIds = new Set(users.map(u => u.userId));
    this.cursors.forEach((cursor, userId) => {
      if (!currentIds.has(userId)) {
        this.cursors.delete(userId);
        this.lastPositions.delete(userId);
        this.clearLabelTimer(userId);
      }
    });
  }

  /**
   * Update a single cursor
   *
   * @param cursor - User cursor data
   */
  updateCursor(cursor: UserCursor): void {
    const existing = this.cursors.get(cursor.userId);

    if (existing) {
      const lastPos = this.calculatePixelPosition(existing.position);
      this.lastPositions.set(cursor.userId, lastPos);
    }

    this.cursors.set(cursor.userId, cursor);
    this.resetLabelTimer(cursor.userId);
  }

  /**
   * Remove a cursor
   *
   * @param userId - User ID
   */
  removeCursor(userId: string): void {
    this.cursors.delete(userId);
    this.lastPositions.delete(userId);
    this.clearLabelTimer(userId);
  }

  /**
   * Get all tracked cursors
   *
   * @returns Map of cursors by user ID
   */
  getCursors(): Map<string, UserCursor> {
    return this.cursors;
  }

  /**
   * Get cursor for a specific user
   *
   * @param userId - User ID
   * @returns Cursor or undefined
   */
  getCursor(userId: string): UserCursor | undefined {
    return this.cursors.get(userId);
  }

  /**
   * Get cursors on a specific line
   *
   * @param line - Line number
   * @returns Array of cursors on that line
   */
  getCursorsOnLine(line: number): UserCursor[] {
    return Array.from(this.cursors.values()).filter(
      c => c.position.line === line
    );
  }

  /**
   * Get render data for all cursors
   *
   * @returns Array of cursor render data
   */
  getRenderData(): CursorRenderData[] {
    const renderData: CursorRenderData[] = [];
    const now = Date.now();

    this.cursors.forEach(cursor => {
      const position = this.calculatePixelPosition(cursor.position);
      const lastPosition = this.lastPositions.get(cursor.userId);

      // Check if should show label
      const timeSinceUpdate = now - cursor.timestamp;
      const showLabel = this.config.showLabel && timeSinceUpdate < this.config.labelDuration;

      // Calculate label opacity based on time
      const labelOpacity = Math.max(
        0,
        1 - timeSinceUpdate / this.config.labelDuration
      );

      const data: CursorRenderData = {
        cursor,
        position,
        showLabel,
        labelOpacity
      };

      // Add selection highlights if enabled
      if (this.config.enableSelection && cursor.selection) {
        data.selectionHighlights = this.calculateSelectionHighlights(
          cursor.selection,
          cursor.color
        );
      }

      renderData.push(data);
    });

    return renderData;
  }

  /**
   * Calculate screen position from document position
   *
   * @param docPosition - Document position (line, column)
   * @returns Pixel position
   */
  calculatePixelPosition(docPosition: CursorPosition): PixelPosition {
    const x = docPosition.column * this.metrics.charWidth;
    const y = docPosition.line * this.metrics.lineHeightPixels;

    return {
      x,
      y,
      width: 2, // Cursor width
      height: this.metrics.lineHeight
    };
  }

  /**
   * Calculate selection highlight rectangles
   *
   * @param selection - Selection range
   * @param color - Selection color (hex)
   * @returns Array of highlight rectangles
   */
  private calculateSelectionHighlights(
    selection: SelectionRange,
    color: string
  ): SelectionHighlight[] {
    const highlights: SelectionHighlight[] = [];
    const backgroundColor = this.hexToRgba(color, 0.3);

    // Single line selection
    if (selection.start.line === selection.end.line) {
      const start = this.calculatePixelPosition(selection.start);
      const end = this.calculatePixelPosition(selection.end);

      highlights.push({
        rect: {
          x: start.x,
          y: start.y,
          width: end.x - start.x,
          height: this.metrics.lineHeight
        },
        backgroundColor
      });
    } else {
      // Multi-line selection
      const firstLine = this.calculatePixelPosition(selection.start);
      const lastLine = this.calculatePixelPosition(selection.end);

      // First line partial selection
      highlights.push({
        rect: {
          x: firstLine.x,
          y: firstLine.y,
          width: 1000, // Extend to end of line
          height: this.metrics.lineHeight
        },
        backgroundColor
      });

      // Full lines between start and end
      for (let line = selection.start.line + 1; line < selection.end.line; line++) {
        const linePos = this.calculatePixelPosition({ line, column: 0 });
        highlights.push({
          rect: {
            x: linePos.x,
            y: linePos.y,
            width: 1000,
            height: this.metrics.lineHeight
          },
          backgroundColor
        });
      }

      // Last line partial selection
      highlights.push({
        rect: {
          x: lastLine.x - lastLine.width,
          y: lastLine.y,
          width: lastLine.x,
          height: this.metrics.lineHeight
        },
        backgroundColor
      });
    }

    return highlights;
  }

  /**
   * Convert hex color to rgba
   *
   * @param hex - Hex color string
   * @param alpha - Alpha value (0-1)
   * @returns RGBA color string
   */
  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * Reset label visibility timer for a user
   *
   * @param userId - User ID
   */
  private resetLabelTimer(userId: string): void {
    this.clearLabelTimer(userId);

    const timer = setTimeout(() => {
      // Label will be hidden automatically based on timestamp check
    }, this.config.labelDuration);

    this.labelTimers.set(userId, timer);
  }

  /**
   * Clear label timer for a user
   *
   * @param userId - User ID
   */
  private clearLabelTimer(userId: string): void {
    const timer = this.labelTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.labelTimers.delete(userId);
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.cursors.clear();
    this.lastPositions.clear();
    this.labelTimers.forEach(timer => clearTimeout(timer));
    this.labelTimers.clear();
  }
}

/**
 * Document metrics for position calculation
 */
export interface DocumentMetrics {
  /** Line height in characters */
  lineHeight: number;
  /** Character width in pixels (monospace) */
  charWidth: number;
  /** Line height in pixels */
  lineHeightPixels: number;
  /** Tab size in spaces */
  tabSize: number;
}

/**
 * Cursor collision detection result
 */
export interface CursorCollision {
  /** User IDs with colliding cursors */
  userIds: string[];
  /** Collision position */
  position: CursorPosition;
}

/**
 * Detect cursor collisions (users editing same area)
 *
 * @param cursors - Map of cursors to check
 * @param proximityThreshold - Line/column proximity threshold
 * @returns Array of detected collisions
 */
export function detectCursorCollisions(
  cursors: Map<string, UserCursor>,
  proximityThreshold: number = 2
): CursorCollision[] {
  const collisions: CursorCollision[] = [];
  const cursorArray = Array.from(cursors.values());

  for (let i = 0; i < cursorArray.length; i++) {
    for (let j = i + 1; j < cursorArray.length; j++) {
      const a = cursorArray[i];
      const b = cursorArray[j];

      const lineDiff = Math.abs(a.position.line - b.position.line);
      const colDiff = Math.abs(a.position.column - b.position.column);

      if (lineDiff <= proximityThreshold && colDiff <= proximityThreshold * 10) {
        collisions.push({
          userIds: [a.userId, b.userId],
          position: a.position
        });
      }
    }
  }

  return collisions;
}

/**
 * Calculate typing indicator message
 *
 * @param typingUsers - Array of typing users
 * @param maxUsers - Maximum number of users to display
 * @returns Typing indicator message
 */
export function formatTypingIndicator(
  typingUsers: UserPresence[],
  maxUsers: number = 3
): string {
  if (typingUsers.length === 0) {
    return '';
  }

  if (typingUsers.length === 1) {
    return `${typingUsers[0].userName} is typing...`;
  }

  if (typingUsers.length === 2) {
    return `${typingUsers[0].userName} and ${typingUsers[1].userName} are typing...`;
  }

  if (typingUsers.length <= maxUsers) {
    const names = typingUsers.map(u => u.userName).join(', ');
    const last = typingUsers[typingUsers.length - 1].userName;
    return `${names}, and ${last} are typing...`;
  }

  return `${typingUsers.length} people are typing...`;
}

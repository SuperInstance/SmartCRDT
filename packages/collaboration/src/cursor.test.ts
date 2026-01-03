/**
 * @file cursor.test.ts - Tests for cursor tracking system
 * @description Comprehensive test suite for CursorTracker
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  CursorTracker,
  detectCursorCollisions,
  formatTypingIndicator
} from './cursor.js';
import {
  UserCursor,
  UserPresence,
  UserStatus
} from './types.js';

describe('CursorTracker', () => {
  let tracker: CursorTracker;

  beforeEach(() => {
    tracker = new CursorTracker({
      showLabel: true,
      enableSelection: true
    });
  });

  afterEach(() => {
    tracker.destroy();
  });

  describe('Initialization', () => {
    it('should create a cursor tracker', () => {
      expect(tracker).toBeDefined();
    });

    it('should use default config when none provided', () => {
      const defaultTracker = new CursorTracker();
      expect(defaultTracker).toBeDefined();
      defaultTracker.destroy();
    });
  });

  describe('Cursor Updates', () => {
    it('should update cursor from user presence', () => {
      const users: UserPresence[] = [
        {
          userId: 'user-1',
          userName: 'Alice',
          status: UserStatus.ONLINE,
          cursor: {
            userId: 'user-1',
            userName: 'Alice',
            position: { line: 5, column: 10 },
            color: '#FF0000',
            timestamp: Date.now()
          },
          lastActivity: Date.now()
        }
      ];

      tracker.updateCursors(users);

      const cursor = tracker.getCursor('user-1');
      expect(cursor).toBeDefined();
      expect(cursor?.position).toEqual({ line: 5, column: 10 });
    });

    it('should track multiple users', () => {
      const users: UserPresence[] = [
        {
          userId: 'user-1',
          userName: 'Alice',
          status: UserStatus.ONLINE,
          cursor: {
            userId: 'user-1',
            userName: 'Alice',
            position: { line: 1, column: 1 },
            color: '#FF0000',
            timestamp: Date.now()
          },
          lastActivity: Date.now()
        },
        {
          userId: 'user-2',
          userName: 'Bob',
          status: UserStatus.ONLINE,
          cursor: {
            userId: 'user-2',
            userName: 'Bob',
            position: { line: 3, column: 5 },
            color: '#00FF00',
            timestamp: Date.now()
          },
          lastActivity: Date.now()
        }
      ];

      tracker.updateCursors(users);

      expect(tracker.getCursors().size).toBe(2);
    });

    it('should skip users without cursors', () => {
      const users: UserPresence[] = [
        {
          userId: 'user-1',
          userName: 'Alice',
          status: UserStatus.OFFLINE,
          lastActivity: Date.now()
        }
      ];

      tracker.updateCursors(users);

      expect(tracker.getCursors().size).toBe(0);
    });

    it('should skip idle users', () => {
      const users: UserPresence[] = [
        {
          userId: 'user-1',
          userName: 'Alice',
          status: UserStatus.IDLE,
          cursor: {
            userId: 'user-1',
            userName: 'Alice',
            position: { line: 1, column: 1 },
            color: '#FF0000',
            timestamp: Date.now()
          },
          lastActivity: Date.now()
        }
      ];

      tracker.updateCursors(users);

      expect(tracker.getCursors().size).toBe(0);
    });

    it('should remove cursors for users not in update', () => {
      const users1: UserPresence[] = [
        {
          userId: 'user-1',
          userName: 'Alice',
          status: UserStatus.ONLINE,
          cursor: {
            userId: 'user-1',
            userName: 'Alice',
            position: { line: 1, column: 1 },
            color: '#FF0000',
            timestamp: Date.now()
          },
          lastActivity: Date.now()
        }
      ];

      tracker.updateCursors(users1);
      expect(tracker.getCursors().size).toBe(1);

      // Update with empty list
      tracker.updateCursors([]);
      expect(tracker.getCursors().size).toBe(0);
    });

    it('should update single cursor', () => {
      const cursor: UserCursor = {
        userId: 'user-1',
        userName: 'Alice',
        position: { line: 2, column: 3 },
        color: '#FF0000',
        timestamp: Date.now()
      };

      tracker.updateCursor(cursor);

      const retrieved = tracker.getCursor('user-1');
      expect(retrieved?.position).toEqual({ line: 2, column: 3 });
    });

    it('should remove cursor', () => {
      const cursor: UserCursor = {
        userId: 'user-1',
        userName: 'Alice',
        position: { line: 1, column: 1 },
        color: '#FF0000',
        timestamp: Date.now()
      };

      tracker.updateCursor(cursor);
      expect(tracker.getCursor('user-1')).toBeDefined();

      tracker.removeCursor('user-1');
      expect(tracker.getCursor('user-1')).toBeUndefined();
    });
  });

  describe('Position Calculation', () => {
    it('should calculate pixel position from document position', () => {
      const position = tracker.calculatePixelPosition({ line: 0, column: 0 });

      expect(position.x).toBe(0);
      expect(position.y).toBe(0);
      expect(position.width).toBe(2);
      expect(position.height).toBe(24); // Default line height
    });

    it('should calculate position with line offset', () => {
      const position = tracker.calculatePixelPosition({ line: 2, column: 0 });

      expect(position.y).toBe(48); // 2 * 24
    });

    it('should calculate position with column offset', () => {
      const position = tracker.calculatePixelPosition({ line: 0, column: 10 });

      expect(position.x).toBe(90); // 10 * 9
    });

    it('should use custom document metrics', () => {
      tracker.setDocumentMetrics({
        charWidth: 10,
        lineHeightPixels: 30
      });

      const position = tracker.calculatePixelPosition({ line: 2, column: 5 });

      expect(position.x).toBe(50); // 5 * 10
      expect(position.y).toBe(60); // 2 * 30
    });
  });

  describe('Cursors on Line', () => {
    beforeEach(() => {
      const users: UserPresence[] = [
        {
          userId: 'user-1',
          userName: 'Alice',
          status: UserStatus.ONLINE,
          cursor: {
            userId: 'user-1',
            userName: 'Alice',
            position: { line: 5, column: 10 },
            color: '#FF0000',
            timestamp: Date.now()
          },
          lastActivity: Date.now()
        },
        {
          userId: 'user-2',
          userName: 'Bob',
          status: UserStatus.ONLINE,
          cursor: {
            userId: 'user-2',
            userName: 'Bob',
            position: { line: 5, column: 15 },
            color: '#00FF00',
            timestamp: Date.now()
          },
          lastActivity: Date.now()
        },
        {
          userId: 'user-3',
          userName: 'Charlie',
          status: UserStatus.ONLINE,
          cursor: {
            userId: 'user-3',
            userName: 'Charlie',
            position: { line: 10, column: 5 },
            color: '#0000FF',
            timestamp: Date.now()
          },
          lastActivity: Date.now()
        }
      ];

      tracker.updateCursors(users);
    });

    it('should get cursors on specific line', () => {
      const cursors = tracker.getCursorsOnLine(5);
      expect(cursors).toHaveLength(2);
    });

    it('should return empty array for line with no cursors', () => {
      const cursors = tracker.getCursorsOnLine(99);
      expect(cursors).toHaveLength(0);
    });
  });

  describe('Render Data', () => {
    beforeEach(() => {
      const users: UserPresence[] = [
        {
          userId: 'user-1',
          userName: 'Alice',
          status: UserStatus.ONLINE,
          cursor: {
            userId: 'user-1',
            userName: 'Alice',
            position: { line: 5, column: 10 },
            color: '#FF0000',
            timestamp: Date.now()
          },
          lastActivity: Date.now()
        }
      ];

      tracker.updateCursors(users);
    });

    it('should generate render data for all cursors', () => {
      const renderData = tracker.getRenderData();

      expect(renderData).toHaveLength(1);
      expect(renderData[0].cursor.userId).toBe('user-1');
      expect(renderData[0].position).toBeDefined();
    });

    it('should include label visibility status', () => {
      const renderData = tracker.getRenderData();

      expect(renderData[0].showLabel).toBe(true);
    });

    it('should calculate label opacity based on time', () => {
      const renderData = tracker.getRenderData();

      expect(renderData[0].labelOpacity).toBeGreaterThan(0);
      expect(renderData[0].labelOpacity).toBeLessThanOrEqual(1);
    });

    it('should include selection highlights when enabled', () => {
      const users: UserPresence[] = [
        {
          userId: 'user-1',
          userName: 'Alice',
          status: UserStatus.ONLINE,
          cursor: {
            userId: 'user-1',
            userName: 'Alice',
            position: { line: 5, column: 10 },
            selection: {
              start: { line: 5, column: 5 },
              end: { line: 5, column: 15 }
            },
            color: '#FF0000',
            timestamp: Date.now()
          },
          lastActivity: Date.now()
        }
      ];

      tracker.updateCursors(users);
      const renderData = tracker.getRenderData();

      expect(renderData[0].selectionHighlights).toBeDefined();
      expect(renderData[0].selectionHighlights?.length).toBeGreaterThan(0);
    });
  });

  describe('Collision Detection', () => {
    it('should detect colliding cursors', () => {
      const cursors = new Map<string, UserCursor>([
        ['user-1', {
          userId: 'user-1',
          userName: 'Alice',
          position: { line: 5, column: 10 },
          color: '#FF0000',
          timestamp: Date.now()
        }],
        ['user-2', {
          userId: 'user-2',
          userName: 'Bob',
          position: { line: 5, column: 12 },
          color: '#00FF00',
          timestamp: Date.now()
        }]
      ]);

      const collisions = detectCursorCollisions(cursors, 2);

      expect(collisions).toHaveLength(1);
      expect(collisions[0].userIds).toContain('user-1');
      expect(collisions[0].userIds).toContain('user-2');
    });

    it('should not detect distant cursors as collision', () => {
      const cursors = new Map<string, UserCursor>([
        ['user-1', {
          userId: 'user-1',
          userName: 'Alice',
          position: { line: 5, column: 10 },
          color: '#FF0000',
          timestamp: Date.now()
        }],
        ['user-2', {
          userId: 'user-2',
          userName: 'Bob',
          position: { line: 50, column: 100 },
          color: '#00FF00',
          timestamp: Date.now()
        }]
      ]);

      const collisions = detectCursorCollisions(cursors, 2);

      expect(collisions).toHaveLength(0);
    });

    it('should detect multiple collision groups', () => {
      const cursors = new Map<string, UserCursor>([
        ['user-1', {
          userId: 'user-1',
          userName: 'Alice',
          position: { line: 5, column: 10 },
          color: '#FF0000',
          timestamp: Date.now()
        }],
        ['user-2', {
          userId: 'user-2',
          userName: 'Bob',
          position: { line: 5, column: 12 },
          color: '#00FF00',
          timestamp: Date.now()
        }],
        ['user-3', {
          userId: 'user-3',
          userName: 'Charlie',
          position: { line: 10, column: 10 },
          color: '#0000FF',
          timestamp: Date.now()
        }],
        ['user-4', {
          userId: 'user-4',
          userName: 'Diana',
          position: { line: 10, column: 11 },
          color: '#FFFF00',
          timestamp: Date.now()
        }]
      ]);

      const collisions = detectCursorCollisions(cursors, 2);

      expect(collisions.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Typing Indicator Formatting', () => {
    it('should format single typing user', () => {
      const users: UserPresence[] = [
        {
          userId: 'user-1',
          userName: 'Alice',
          status: UserStatus.ONLINE,
          typing: { isTyping: true, startTime: Date.now() },
          lastActivity: Date.now()
        }
      ];

      const message = formatTypingIndicator(users);
      expect(message).toBe('Alice is typing...');
    });

    it('should format two typing users', () => {
      const users: UserPresence[] = [
        {
          userId: 'user-1',
          userName: 'Alice',
          status: UserStatus.ONLINE,
          typing: { isTyping: true, startTime: Date.now() },
          lastActivity: Date.now()
        },
        {
          userId: 'user-2',
          userName: 'Bob',
          status: UserStatus.ONLINE,
          typing: { isTyping: true, startTime: Date.now() },
          lastActivity: Date.now()
        }
      ];

      const message = formatTypingIndicator(users);
      expect(message).toBe('Alice and Bob are typing...');
    });

    it('should format three typing users', () => {
      const users: UserPresence[] = [
        {
          userId: 'user-1',
          userName: 'Alice',
          status: UserStatus.ONLINE,
          typing: { isTyping: true, startTime: Date.now() },
          lastActivity: Date.now()
        },
        {
          userId: 'user-2',
          userName: 'Bob',
          status: UserStatus.ONLINE,
          typing: { isTyping: true, startTime: Date.now() },
          lastActivity: Date.now()
        },
        {
          userId: 'user-3',
          userName: 'Charlie',
          status: UserStatus.ONLINE,
          typing: { isTyping: true, startTime: Date.now() },
          lastActivity: Date.now()
        }
      ];

      const message = formatTypingIndicator(users);
      expect(message).toContain('are typing...');
    });

    it('should format many typing users as count', () => {
      const users: UserPresence[] = Array.from({ length: 5 }, (_, i) => ({
        userId: `user-${i}`,
        userName: `User${i}`,
        status: UserStatus.ONLINE as UserStatus,
        typing: { isTyping: true, startTime: Date.now() },
        lastActivity: Date.now()
      }));

      const message = formatTypingIndicator(users);
      expect(message).toBe('5 people are typing...');
    });

    it('should return empty string for no typing users', () => {
      const message = formatTypingIndicator([]);
      expect(message).toBe('');
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', () => {
      const users: UserPresence[] = [
        {
          userId: 'user-1',
          userName: 'Alice',
          status: UserStatus.ONLINE,
          cursor: {
            userId: 'user-1',
            userName: 'Alice',
            position: { line: 1, column: 1 },
            color: '#FF0000',
            timestamp: Date.now()
          },
          lastActivity: Date.now()
        }
      ];

      tracker.updateCursors(users);
      expect(tracker.getCursors().size).toBe(1);

      tracker.destroy();
      expect(tracker.getCursors().size).toBe(0);
    });
  });
});

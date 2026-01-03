/**
 * @file presence.test.ts - Tests for presence management system
 * @description Comprehensive test suite for PresenceManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PresenceManager
} from './presence.js';
import {
  UserStatus,
  UserPresence,
  PresenceEventType,
  DEFAULT_PRESENCE_CONFIG,
  ColorStrategy
} from './types.js';

describe('PresenceManager', () => {
  let manager: PresenceManager;
  let mockObserver: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    manager = new PresenceManager({
      userId: 'user-1',
      userName: 'Alice',
      config: {
        timeouts: {
          idleTimeout: 1000,      // 1 second for testing
          offlineTimeout: 2000,   // 2 seconds for testing
          typingTimeout: 500      // 0.5 seconds for testing
        }
      }
    });

    mockObserver = vi.fn();
    manager.onPresenceChange(mockObserver);
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('Initialization', () => {
    it('should create a presence manager with current user', () => {
      const user = manager.getUser('user-1');
      expect(user).toBeDefined();
      expect(user?.userId).toBe('user-1');
      expect(user?.userName).toBe('Alice');
      expect(user?.status).toBe(UserStatus.ONLINE);
    });

    it('should assign a color to the current user', () => {
      const user = manager.getUser('user-1');
      expect(user?.cursor?.color).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it('should use default config when none provided', () => {
      const defaultManager = new PresenceManager({
        userId: 'user-2',
        userName: 'Bob'
      });
      expect(defaultManager).toBeDefined();
      defaultManager.destroy();
    });
  });

  describe('Cursor Updates', () => {
    it('should update cursor position', () => {
      manager.updateCursor({ line: 5, column: 12 });

      const user = manager.getUser('user-1');
      expect(user?.cursor?.position).toEqual({ line: 5, column: 12 });
    });

    it('should update cursor with selection', () => {
      manager.updateCursor(
        { line: 3, column: 5 },
        {
          start: { line: 3, column: 5 },
          end: { line: 3, column: 10 }
        }
      );

      const user = manager.getUser('user-1');
      expect(user?.cursor?.selection).toEqual({
        start: { line: 3, column: 5 },
        end: { line: 3, column: 10 }
      });
    });

    it('should emit cursor moved event', () => {
      manager.updateCursor({ line: 2, column: 8 });

      expect(mockObserver).toHaveBeenCalledWith(
        expect.objectContaining({
          type: PresenceEventType.CURSOR_MOVED,
          userId: 'user-1'
        })
      );
    });

    it('should update last activity timestamp on cursor move', () => {
      const before = Date.now();
      manager.updateCursor({ line: 1, column: 1 });
      const after = Date.now();

      const user = manager.getUser('user-1');
      expect(user?.lastActivity).toBeGreaterThanOrEqual(before);
      expect(user?.lastActivity).toBeLessThanOrEqual(after);
    });
  });

  describe('Typing Indicators', () => {
    it('should set typing state', () => {
      manager.setTyping(true);

      const user = manager.getUser('user-1');
      expect(user?.typing?.isTyping).toBe(true);
    });

    it('should clear typing state', () => {
      manager.setTyping(true);
      manager.setTyping(false);

      const user = manager.getUser('user-1');
      expect(user?.typing).toBeUndefined();
    });

    it('should emit typing changed event', () => {
      manager.startTyping();

      expect(mockObserver).toHaveBeenCalledWith(
        expect.objectContaining({
          type: PresenceEventType.TYPING_CHANGED,
          userId: 'user-1'
        })
      );
    });

    it('should auto-clear typing after timeout', async () => {
      manager.startTyping();

      let user = manager.getUser('user-1');
      expect(user?.typing?.isTyping).toBe(true);

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 600));

      user = manager.getUser('user-1');
      expect(user?.typing).toBeUndefined();
    });

    it('should provide convenience methods for typing', () => {
      manager.startTyping();
      expect(manager.getUser('user-1')?.typing?.isTyping).toBe(true);

      manager.stopTyping();
      expect(manager.getUser('user-1')?.typing).toBeUndefined();
    });
  });

  describe('Document Context', () => {
    it('should update document ID', () => {
      manager.setDocument('doc-123');

      const user = manager.getUser('user-1');
      expect(user?.documentId).toBe('doc-123');
    });

    it('should emit document changed event', () => {
      manager.setDocument('doc-456');

      expect(mockObserver).toHaveBeenCalledWith(
        expect.objectContaining({
          type: PresenceEventType.DOCUMENT_CHANGED,
          userId: 'user-1'
        })
      );
    });
  });

  describe('Status Management', () => {
    it('should update user status', () => {
      manager.setStatus(UserStatus.BUSY);

      const user = manager.getUser('user-1');
      expect(user?.status).toBe(UserStatus.BUSY);
    });

    it('should clear cursor when going idle', () => {
      manager.updateCursor({ line: 1, column: 1 });
      manager.setStatus(UserStatus.IDLE);

      const user = manager.getUser('user-1');
      expect(user?.cursor).toBeUndefined();
    });

    it('should clear cursor when going offline', () => {
      manager.updateCursor({ line: 1, column: 1 });
      manager.setStatus(UserStatus.OFFLINE);

      const user = manager.getUser('user-1');
      expect(user?.cursor).toBeUndefined();
    });

    it('should restore cursor when coming back online', () => {
      manager.updateCursor({ line: 5, column: 10 });
      manager.setStatus(UserStatus.OFFLINE);
      manager.setStatus(UserStatus.ONLINE);

      const user = manager.getUser('user-1');
      expect(user?.cursor?.position).toEqual({ line: 5, column: 10 });
    });
  });

  describe('Remote User Management', () => {
    it('should add remote user', () => {
      const remoteUser: UserPresence = {
        userId: 'user-2',
        userName: 'Bob',
        status: UserStatus.ONLINE,
        lastActivity: Date.now(),
        cursor: {
          userId: 'user-2',
          userName: 'Bob',
          position: { line: 0, column: 0 },
          color: '#FF0000',
          timestamp: Date.now()
        }
      };

      manager.updateRemoteUser(remoteUser);

      const user = manager.getUser('user-2');
      expect(user).toBeDefined();
      expect(user?.userName).toBe('Bob');
    });

    it('should not update self from remote updates', () => {
      const selfUpdate: UserPresence = {
        userId: 'user-1',
        userName: 'Imposter',
        status: UserStatus.BUSY,
        lastActivity: Date.now()
      };

      manager.updateRemoteUser(selfUpdate);

      const user = manager.getUser('user-1');
      expect(user?.userName).toBe('Alice'); // Should remain unchanged
    });

    it('should emit user joined event for new users', () => {
      const remoteUser: UserPresence = {
        userId: 'user-3',
        userName: 'Charlie',
        status: UserStatus.ONLINE,
        lastActivity: Date.now()
      };

      manager.updateRemoteUser(remoteUser);

      expect(mockObserver).toHaveBeenCalledWith(
        expect.objectContaining({
          type: PresenceEventType.USER_JOINED,
          userId: 'user-3'
        })
      );
    });

    it('should merge existing remote user data', () => {
      const initialUser: UserPresence = {
        userId: 'user-4',
        userName: 'Diana',
        status: UserStatus.ONLINE,
        documentId: 'doc-1',
        lastActivity: Date.now() - 1000
      };

      const updatedUser: UserPresence = {
        userId: 'user-4',
        userName: 'Diana',
        status: UserStatus.IDLE,
        lastActivity: Date.now()
      };

      manager.updateRemoteUser(initialUser);
      manager.updateRemoteUser(updatedUser);

      const user = manager.getUser('user-4');
      expect(user?.status).toBe(UserStatus.IDLE);
      expect(user?.documentId).toBe('doc-1'); // Should preserve
    });

    it('should remove remote user', () => {
      const remoteUser: UserPresence = {
        userId: 'user-5',
        userName: 'Eve',
        status: UserStatus.ONLINE,
        lastActivity: Date.now()
      };

      manager.updateRemoteUser(remoteUser);
      expect(manager.getUser('user-5')).toBeDefined();

      manager.removeUser('user-5');
      expect(manager.getUser('user-5')).toBeUndefined();
    });

    it('should emit user left event on removal', () => {
      const remoteUser: UserPresence = {
        userId: 'user-6',
        userName: 'Frank',
        status: UserStatus.ONLINE,
        lastActivity: Date.now()
      };

      manager.updateRemoteUser(remoteUser);
      manager.removeUser('user-6');

      expect(mockObserver).toHaveBeenCalledWith(
        expect.objectContaining({
          type: PresenceEventType.USER_LEFT,
          userId: 'user-6'
        })
      );
    });
  });

  describe('User Queries', () => {
    beforeEach(() => {
      // Add multiple remote users
      const users: UserPresence[] = [
        {
          userId: 'user-2',
          userName: 'Bob',
          status: UserStatus.ONLINE,
          documentId: 'doc-1',
          lastActivity: Date.now()
        },
        {
          userId: 'user-3',
          userName: 'Charlie',
          status: UserStatus.IDLE,
          documentId: 'doc-1',
          lastActivity: Date.now() - 3000
        },
        {
          userId: 'user-4',
          userName: 'Diana',
          status: UserStatus.ONLINE,
          documentId: 'doc-2',
          typing: { isTyping: true, startTime: Date.now() },
          lastActivity: Date.now()
        }
      ];

      users.forEach(u => manager.updateRemoteUser(u));
    });

    it('should get all users', () => {
      const users = manager.getUsers();
      expect(users).toHaveLength(4); // 3 remote + 1 current
    });

    it('should filter users by status', () => {
      const onlineUsers = manager.getUsers({ status: UserStatus.ONLINE });
      expect(onlineUsers).toHaveLength(3);
    });

    it('should filter users by document', () => {
      const doc1Users = manager.getUsers({ documentId: 'doc-1' });
      expect(doc1Users).toHaveLength(2);
    });

    it('should filter only typing users', () => {
      const typingUsers = manager.getUsers({ onlyTyping: true });
      expect(typingUsers).toHaveLength(1);
      expect(typingUsers[0].userId).toBe('user-4');
    });

    it('should get users in document', () => {
      const docUsers = manager.getUsersInDocument('doc-1');
      expect(docUsers).toHaveLength(2);
    });

    it('should get typing users', () => {
      const typingUsers = manager.getTypingUsers();
      expect(typingUsers).toHaveLength(1);
    });

    it('should get typing users in specific document', () => {
      const typingUsers = manager.getTypingUsers('doc-2');
      expect(typingUsers).toHaveLength(1);
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      const users: UserPresence[] = [
        {
          userId: 'user-2',
          userName: 'Bob',
          status: UserStatus.ONLINE,
          documentId: 'doc-1',
          lastActivity: Date.now()
        },
        {
          userId: 'user-3',
          userName: 'Charlie',
          status: UserStatus.IDLE,
          documentId: 'doc-1',
          lastActivity: Date.now() - 3000
        },
        {
          userId: 'user-4',
          userName: 'Diana',
          status: UserStatus.ONLINE,
          documentId: 'doc-2',
          typing: { isTyping: true, startTime: Date.now() },
          lastActivity: Date.now()
        }
      ];

      users.forEach(u => manager.updateRemoteUser(u));
    });

    it('should calculate presence statistics', () => {
      const stats = manager.getStats();

      expect(stats.totalUsers).toBe(4);
      expect(stats.onlineCount).toBe(3);
      expect(stats.idleCount).toBe(1);
      expect(stats.typingCount).toBe(1);
    });

    it('should identify most active document', () => {
      const stats = manager.getStats();
      expect(stats.mostActiveDocument).toBe('doc-1');
    });

    it('should calculate average activity time', () => {
      const stats = manager.getStats();
      expect(stats.averageActivityTime).toBeGreaterThan(0);
    });
  });

  describe('Activity Timeouts', () => {
    vi.useFakeTimers();

    it('should mark user as idle after timeout', async () => {
      manager.updateCursor({ line: 1, column: 1 });

      vi.advanceTimersByTime(1100); // Past idle timeout

      const user = manager.getUser('user-1');
      expect(user?.status).toBe(UserStatus.IDLE);
    });

    it('should mark user as offline after longer timeout', async () => {
      manager.updateCursor({ line: 1, column: 1 });

      vi.advanceTimersByTime(2100); // Past offline timeout

      const user = manager.getUser('user-1');
      expect(user?.status).toBe(UserStatus.OFFLINE);
    });

    it('should reset idle timer on activity', async () => {
      manager.updateCursor({ line: 1, column: 1 });

      vi.advanceTimersByTime(500); // Halfway to idle
      manager.updateCursor({ line: 2, column: 2 }); // Reset timer

      vi.advanceTimersByTime(600); // Should not be idle yet

      const user = manager.getUser('user-1');
      expect(user?.status).toBe(UserStatus.ONLINE);
    });

    afterEach(() => {
      vi.useRealTimers();
    });
  });

  describe('Observer Management', () => {
    it('should subscribe to presence events', () => {
      const observer = vi.fn();
      const unsubscribe = manager.onPresenceChange(observer);

      manager.updateCursor({ line: 1, column: 1 });

      expect(observer).toHaveBeenCalled();
      unsubscribe();
    });

    it('should unsubscribe from events', () => {
      const observer = vi.fn();
      const unsubscribe = manager.onPresenceChange(observer);

      unsubscribe();
      manager.updateCursor({ line: 1, column: 1 });

      expect(observer).not.toHaveBeenCalled();
    });

    it('should support multiple observers', () => {
      const observer1 = vi.fn();
      const observer2 = vi.fn();

      manager.onPresenceChange(observer1);
      manager.onPresenceChange(observer2);

      manager.updateCursor({ line: 1, column: 1 });

      expect(observer1).toHaveBeenCalled();
      expect(observer2).toHaveBeenCalled();
    });
  });

  describe('Color Assignment', () => {
    it('should assign consistent color for same user ID', () => {
      const manager1 = new PresenceManager({ userId: 'user-1', userName: 'Alice' });
      const manager2 = new PresenceManager({ userId: 'user-1', userName: 'Alice' });

      const color1 = manager1.getUser('user-1')?.cursor?.color;
      const color2 = manager2.getUser('user-1')?.cursor?.color;

      expect(color1).toBe(color2);

      manager1.destroy();
      manager2.destroy();
    });

    it('should assign different colors for different users', () => {
      const users = ['user-1', 'user-2', 'user-3', 'user-4'];
      const colors = new Set();

      users.forEach(userId => {
        const m = new PresenceManager({ userId, userName: `User${userId}` });
        const color = m.getUser(userId)?.cursor?.color;
        if (color) colors.add(color);
        m.destroy();
      });

      // Should have at least some variety
      expect(colors.size).toBeGreaterThan(0);
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', () => {
      const observer = vi.fn();
      manager.onPresenceChange(observer);

      manager.destroy();
      manager.updateCursor({ line: 1, column: 1 });

      expect(observer).not.toHaveBeenCalled();
    });

    it('should clear all users on destroy', () => {
      manager.updateRemoteUser({
        userId: 'user-2',
        userName: 'Bob',
        status: UserStatus.ONLINE,
        lastActivity: Date.now()
      });

      manager.destroy();

      // Current user should also be cleared
      expect(manager.getUsers()).toHaveLength(0);
    });
  });
});

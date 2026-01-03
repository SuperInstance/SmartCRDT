/**
 * Server Integration Tests
 * Tests for server-side session management and missed event delivery
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SessionManager,
  SSEResponseHelper,
  createSessionManager,
  createSSEResponseHelper
} from '../src/server.js';
import type { SSEEvent, ReconnectAck, ServerSession } from '../src/types.js';

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager({
      sessionTimeout: 5000,
      persistMissedEvents: true,
      maxMissedEvents: 10
    });
  });

  afterEach(() => {
    manager.clearAllSessions();
  });

  describe('Construction', () => {
    it('should create with default config', () => {
      const m = new SessionManager();

      expect(m).toBeDefined();
    });

    it('should create with factory function', () => {
      const m = createSessionManager();

      expect(m).toBeDefined();
    });

    it('should create with custom config', () => {
      const m = new SessionManager({
        sessionTimeout: 10000,
        maxMissedEvents: 100
      });

      const count = m.getSessionCount();

      expect(count).toBeDefined();
    });
  });

  describe('Session Creation', () => {
    it('should create a session', () => {
      const session = manager.createSession('client1', '/events');

      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(session.clientId).toBe('client1');
      expect(session.state).toBe('active');
    });

    it('should generate unique session IDs', () => {
      const session1 = manager.createSession('client1', '/events');
      const session2 = manager.createSession('client2', '/events');

      expect(session1.sessionId).not.toBe(session2.sessionId);
    });

    it('should set creation timestamp', () => {
      const before = Date.now();
      const session = manager.createSession('client1', '/events');
      const after = Date.now();

      expect(session.createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(session.createdAt.getTime()).toBeLessThanOrEqual(after);
    });
  });

  describe('Session Retrieval', () => {
    it('should get session by ID', () => {
      const created = manager.createSession('client1', '/events');

      const retrieved = manager.getSession(created.sessionId);

      expect(retrieved).toEqual(created);
    });

    it('should return null for non-existent session', () => {
      const session = manager.getSession('non-existent');

      expect(session).toBeNull();
    });

    it('should get session by client ID', () => {
      manager.createSession('client1', '/events');

      const session = manager.getSessionByClientId('client1');

      expect(session).not.toBeNull();
      expect(session?.clientId).toBe('client1');
    });

    it('should return null for non-existent client', () => {
      const session = manager.getSessionByClientId('non-existent');

      expect(session).toBeNull();
    });
  });

  describe('Reconnection Handling', () => {
    it('should handle reconnection acknowledgment', () => {
      const session = manager.createSession('client1', '/events');

      const ack: ReconnectAck = {
        sessionId: session.sessionId,
        lastEventId: 'event-123',
        timestamp: Date.now()
      };

      const delivery = manager.handleReconnectAck(ack);

      expect(delivery).not.toBeNull();
      expect(delivery?.sessionId).toBe(session.sessionId);
    });

    it('should return null for invalid session ID', () => {
      const ack: ReconnectAck = {
        sessionId: 'non-existent',
        lastEventId: null,
        timestamp: Date.now()
      };

      const delivery = manager.handleReconnectAck(ack);

      expect(delivery).toBeNull();
    });

    it('should update session activity on reconnect', () => {
      const session = manager.createSession('client1', '/events');
      const originalActivity = session.lastActivityAt;

      // Wait a bit
      setTimeout(() => {
        const ack: ReconnectAck = {
          sessionId: session.sessionId,
          lastEventId: null,
          timestamp: Date.now()
        };

        manager.handleReconnectAck(ack);

        const updated = manager.getSession(session.sessionId);

        expect(updated?.lastActivityAt.getTime()).toBeGreaterThan(
          originalActivity.getTime()
        );
      }, 100);
    });

    it('should filter missed events by last received ID', () => {
      const session = manager.createSession('client1', '/events');

      // Record some missed events
      manager.recordMissedEvent(session.sessionId, {
        id: 'event-1',
        data: 'data1'
      });

      manager.recordMissedEvent(session.sessionId, {
        id: 'event-2',
        data: 'data2'
      });

      manager.recordMissedEvent(session.sessionId, {
        id: 'event-3',
        data: 'data3'
      });

      const ack: ReconnectAck = {
        sessionId: session.sessionId,
        lastEventId: 'event-2',
        timestamp: Date.now()
      };

      const delivery = manager.handleReconnectAck(ack);

      expect(delivery?.events).toHaveLength(1);
      expect(delivery?.events[0].id).toBe('event-3');
    });
  });

  describe('Missed Event Recording', () => {
    it('should record missed events', () => {
      const session = manager.createSession('client1', '/events');

      manager.recordMissedEvent(session.sessionId, {
        id: 'event-1',
        data: 'test data',
        timestamp: Date.now()
      });

      const missed = manager.getMissedEvents(session.sessionId);

      expect(missed).toHaveLength(1);
      expect(missed[0].data).toBe('test data');
    });

    it('should limit missed events', () => {
      const session = manager.createSession('client1', '/events');

      for (let i = 0; i < 20; i++) {
        manager.recordMissedEvent(session.sessionId, {
          id: `event-${i}`,
          data: `data${i}`
        });
      }

      const missed = manager.getMissedEvents(session.sessionId);

      expect(missed.length).toBeLessThanOrEqual(10);
    });

    it('should clear missed events', () => {
      const session = manager.createSession('client1', '/events');

      manager.recordMissedEvent(session.sessionId, {
        id: 'event-1',
        data: 'data1'
      });

      manager.clearMissedEvents(session.sessionId);

      const missed = manager.getMissedEvents(session.sessionId);

      expect(missed).toHaveLength(0);
    });
  });

  describe('Session State Management', () => {
    it('should mark session as disconnected', () => {
      const session = manager.createSession('client1', '/events');

      manager.markSessionDisconnected(session.sessionId);

      const updated = manager.getSession(session.sessionId);

      expect(updated?.state).toBe('disconnected');
    });

    it('should expire session', () => {
      const session = manager.createSession('client1', '/events');

      manager.expireSession(session.sessionId);

      const retrieved = manager.getSession(session.sessionId);

      expect(retrieved).toBeNull();
    });

    it('should update session activity', () => {
      const session = manager.createSession('client1', '/events');
      const originalActivity = session.lastActivityAt;

      setTimeout(() => {
        manager.updateSessionActivity(session.sessionId);

        const updated = manager.getSession(session.sessionId);

        expect(updated?.lastActivityAt.getTime()).toBeGreaterThan(
          originalActivity.getTime()
        );
      }, 100);
    });
  });

  describe('Session Statistics', () => {
    it('should count sessions by state', () => {
      manager.createSession('client1', '/events');
      manager.createSession('client2', '/events');

      const session1 = manager.getSessionByClientId('client1');
      manager.markSessionDisconnected(session1!.sessionId);

      const counts = manager.getSessionCount();

      expect(counts.total).toBe(2);
      expect(counts.active).toBe(1);
      expect(counts.disconnected).toBe(1);
    });

    it('should get active sessions', () => {
      manager.createSession('client1', '/events');
      manager.createSession('client2', '/events');

      const active = manager.getActiveSessions();

      expect(active).toHaveLength(2);
    });
  });

  describe('Session Transfer', () => {
    it('should transfer session to another server', () => {
      const session = manager.createSession('client1', '/events');

      const transferred = manager.transferSession(session.sessionId, 'server2');

      expect(transferred).toBe(true);

      // Session should be expired locally
      const retrieved = manager.getSession(session.sessionId);

      expect(retrieved?.state).toBe('expired');
    });

    it('should not transfer when disabled', () => {
      const m = new SessionManager({
        enableSessionTransfer: false
      });

      const session = m.createSession('client1', '/events');

      const transferred = m.transferSession(session.sessionId, 'server2');

      expect(transferred).toBe(false);
    });
  });

  describe('Session Cleanup', () => {
    it('should cleanup expired sessions', async () => {
      const m = new SessionManager({
        sessionTimeout: 100
      });

      m.createSession('client1', '/events');

      await new Promise(resolve => setTimeout(resolve, 150));

      const cleaned = m.cleanupExpiredSessions();

      expect(cleaned).toBe(1);
    });

    it('should not expire active sessions', () => {
      const session = manager.createSession('client1', '/events');

      manager.updateSessionActivity(session.sessionId);

      const cleaned = manager.cleanupExpiredSessions();

      expect(cleaned).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      manager.updateOptions({
        maxMissedEvents: 50,
        sessionTimeout: 10000
      });

      const options = manager.getConfig();

      expect(options.maxMissedEvents).toBe(50);
      expect(options.sessionTimeout).toBe(10000);
    });
  });

  describe('Clear All Sessions', () => {
    it('should clear all sessions', () => {
      manager.createSession('client1', '/events');
      manager.createSession('client2', '/events');
      manager.createSession('client3', '/events');

      manager.clearAllSessions();

      const counts = manager.getSessionCount();

      expect(counts.total).toBe(0);
    });
  });
});

describe('SSEResponseHelper', () => {
  let sessionManager: SessionManager;
  let helper: SSEResponseHelper;

  beforeEach(() => {
    sessionManager = new SessionManager();
    helper = new SSEResponseHelper(sessionManager);
  });

  afterEach(() => {
    sessionManager.clearAllSessions();
  });

  describe('Initialization', () => {
    it('should initialize connection', () => {
      const sessionId = helper.initializeConnection('client1', '/events');

      expect(sessionId).toBeDefined();
      expect(helper.getSessionId()).toBe(sessionId);
    });

    it('should create session on initialize', () => {
      const sessionId = helper.initializeConnection('client1', '/events');

      const session = sessionManager.getSession(sessionId);

      expect(session).not.toBeNull();
      expect(session?.clientId).toBe('client1');
    });
  });

  describe('Event Sending', () => {
    it('should send event and return ID', () => {
      helper.initializeConnection('client1', '/events');

      const eventId = helper.sendEvent({
        data: 'test data'
      });

      expect(eventId).not.toBeNull();
    });

    it('should generate event ID if not provided', () => {
      helper.initializeConnection('client1', '/events');

      const eventId = helper.sendEvent({
        data: 'test'
      });

      expect(eventId).toBeDefined();
      expect(eventId).toContain('event-');
    });

    it('should record event as potentially missed', () => {
      const sessionId = helper.initializeConnection('client1', '/events');

      helper.sendEvent({
        id: 'event-1',
        data: 'data1'
      });

      const missed = sessionManager.getMissedEvents(sessionId);

      expect(missed).toHaveLength(1);
      expect(missed[0].id).toBe('event-1');
    });

    it('should update session activity on send', () => {
      helper.initializeConnection('client1', '/events');

      const before = Date.now();
      helper.sendEvent({ data: 'test' });

      const session = sessionManager.getSession(helper.getSessionId()!);

      expect(session?.lastActivityAt.getTime()).toBeGreaterThanOrEqual(before);
    });
  });

  describe('Reconnection Handling', () => {
    it('should handle reconnect with missed events', () => {
      const sessionId = helper.initializeConnection('client1', '/events');

      helper.sendEvent({ id: 'event-1', data: 'data1' });
      helper.sendEvent({ id: 'event-2', data: 'data2' });

      const ack: ReconnectAck = {
        sessionId,
        lastEventId: 'event-1',
        timestamp: Date.now()
      };

      const delivery = helper.handleReconnect(ack);

      expect(delivery).not.toBeNull();
      expect(delivery?.events).toHaveLength(1);
      expect(delivery?.events[0].id).toBe('event-2');
    });
  });

  describe('Disconnect Handling', () => {
    it('should mark session as disconnected on disconnect', () => {
      const sessionId = helper.initializeConnection('client1', '/events');

      helper.handleDisconnect();

      const session = sessionManager.getSession(sessionId);

      expect(session?.state).toBe('disconnected');
    });
  });

  describe('Session ID Retrieval', () => {
    it('should return null before initialization', () => {
      expect(helper.getSessionId()).toBeNull();
    });

    it('should return session ID after initialization', () => {
      const sessionId = helper.initializeConnection('client1', '/events');

      expect(helper.getSessionId()).toBe(sessionId);
    });
  });

  describe('Factory Function', () => {
    it('should create helper with factory', () => {
      const m = createSessionManager();
      const h = createSSEResponseHelper(m);

      expect(h).toBeDefined();
    });
  });
});

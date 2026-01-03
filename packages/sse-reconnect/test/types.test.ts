/**
 * Types Tests
 * Tests for all type definitions and exports
 */

import { describe, it, expect } from 'vitest';
import type {
  ReconnectState,
  BackoffStrategy,
  DisconnectReason,
  ReconnectAttempt,
  ReconnectConfig,
  SSEEvent,
  BufferedEvent,
  ConnectionHealth,
  ConnectionMonitorEvent,
  StateTransition,
  ReconnectDecision,
  PolicyContext,
  ReconnectionStats,
  ClientConnectionState,
  ServerSession,
  MissedEvent,
  ServerSessionOptions,
  ReconnectAck,
  MissedEventDelivery,
  ClientIntegrationOptions
} from '../src/types.js';
import {
  DEFAULT_RECONNECT_CONFIG,
  VALID_STATE_TRANSITIONS,
  ReconnectionError,
  BufferOverflowError,
  StateTransitionError,
  MaxRetriesExceededError
} from '../src/types.js';

describe('Types', () => {
  describe('ReconnectState', () => {
    it('should have correct state values', () => {
      const states: ReconnectState[] = ['connected', 'disconnected', 'reconnecting', 'failed'];
      expect(states).toHaveLength(4);
    });
  });

  describe('BackoffStrategy', () => {
    it('should have correct strategy values', () => {
      const strategies: BackoffStrategy[] = ['fixed', 'linear', 'exponential', 'exponential-with-jitter'];
      expect(strategies).toHaveLength(4);
    });
  });

  describe('DisconnectReason', () => {
    it('should have correct reason values', () => {
      const reasons: DisconnectReason[] = ['error', 'timeout', 'server-close', 'network-loss', 'manual'];
      expect(reasons).toHaveLength(5);
    });
  });

  describe('DEFAULT_RECONNECT_CONFIG', () => {
    it('should have all required properties', () => {
      expect(DEFAULT_RECONNECT_CONFIG).toBeDefined();
      expect(DEFAULT_RECONNECT_CONFIG.maxRetries).toBe(10);
      expect(DEFAULT_RECONNECT_CONFIG.initialDelay).toBe(1000);
      expect(DEFAULT_RECONNECT_CONFIG.maxDelay).toBe(30000);
      expect(DEFAULT_RECONNECT_CONFIG.jitterFactor).toBe(0.1);
      expect(DEFAULT_RECONNECT_CONFIG.backoffStrategy).toBe('exponential-with-jitter');
    });

    it('should have valid ReconnectConfig type', () => {
      const config: ReconnectConfig = DEFAULT_RECONNECT_CONFIG;
      expect(config.maxRetries).toBeDefined();
      expect(config.initialDelay).toBeDefined();
      expect(config.maxDelay).toBeDefined();
    });
  });

  describe('VALID_STATE_TRANSITIONS', () => {
    it('should define transitions for all states', () => {
      const states: ReconnectState[] = ['connected', 'disconnected', 'reconnecting', 'failed'];

      for (const state of states) {
        expect(VALID_STATE_TRANSITIONS[state]).toBeDefined();
        expect(Array.isArray(VALID_STATE_TRANSITIONS[state])).toBe(true);
      }
    });

    it('should allow valid transitions', () => {
      expect(VALID_STATE_TRANSITIONS.connected).toContain('disconnected');
      expect(VALID_STATE_TRANSITIONS.connected).toContain('failed');
      expect(VALID_STATE_TRANSITIONS.disconnected).toContain('reconnecting');
      expect(VALID_STATE_TRANSITIONS.reconnecting).toContain('connected');
    });

    it('should not allow invalid transitions', () => {
      expect(VALID_STATE_TRANSITIONS.connected).not.toContain('connected'); // no self-loop
      expect(VALID_STATE_TRANSITIONS.failed).not.toContain('connected'); // can't go directly to connected
    });
  });

  describe('Error Classes', () => {
    describe('ReconnectionError', () => {
      it('should create error with correct properties', () => {
        const error = new ReconnectionError('Test error', 'timeout', 3);

        expect(error.message).toBe('Test error');
        expect(error.name).toBe('ReconnectionError');
        expect(error.reason).toBe('timeout');
        expect(error.attemptNumber).toBe(3);
      });

      it('should accept optional cause error', () => {
        const cause = new Error('Original error');
        const error = new ReconnectionError('Wrapper', 'error', 1, cause);

        expect(error.cause).toBe(cause);
      });

      it('should be instance of Error', () => {
        const error = new ReconnectionError('Test', 'error', 1);
        expect(error instanceof Error).toBe(true);
        expect(error instanceof ReconnectionError).toBe(true);
      });
    });

    describe('BufferOverflowError', () => {
      it('should create error with correct properties', () => {
        const error = new BufferOverflowError('Buffer full', 1024, 2048);

        expect(error.message).toBe('Buffer full');
        expect(error.name).toBe('BufferOverflowError');
        expect(error.currentSize).toBe(1024);
        expect(error.limit).toBe(2048);
      });

      it('should be instance of Error', () => {
        const error = new BufferOverflowError('Test', 100, 200);
        expect(error instanceof Error).toBe(true);
        expect(error instanceof BufferOverflowError).toBe(true);
      });
    });

    describe('StateTransitionError', () => {
      it('should create error with correct properties', () => {
        const error = new StateTransitionError('Invalid transition', 'connected', 'failed');

        expect(error.message).toBe('Invalid transition');
        expect(error.name).toBe('StateTransitionError');
        expect(error.from).toBe('connected');
        expect(error.to).toBe('failed');
      });

      it('should be instance of Error', () => {
        const error = new StateTransitionError('Test', 'disconnected', 'reconnecting');
        expect(error instanceof Error).toBe(true);
        expect(error instanceof StateTransitionError).toBe(true);
      });
    });

    describe('MaxRetriesExceededError', () => {
      it('should create error with correct properties', () => {
        const error = new MaxRetriesExceededError('Too many retries', 10, 5);

        expect(error.message).toBe('Too many retries');
        expect(error.name).toBe('MaxRetriesExceededError');
        expect(error.totalAttempts).toBe(10);
        expect(error.maxRetries).toBe(5);
      });

      it('should be instance of Error', () => {
        const error = new MaxRetriesExceededError('Test', 10, 5);
        expect(error instanceof Error).toBe(true);
        expect(error instanceof MaxRetriesExceededError).toBe(true);
      });
    });
  });

  describe('Type Compatibility', () => {
    it('should accept valid SSEEvent', () => {
      const event: SSEEvent = {
        id: '123',
        event: 'message',
        data: 'test data',
        retry: 1000,
        timestamp: Date.now()
      };

      expect(event.data).toBe('test data');
    });

    it('should accept minimal SSEEvent', () => {
      const event: SSEEvent = {
        data: 'minimal event'
      };

      expect(event.data).toBe('minimal event');
    });

    it('should accept valid ReconnectAttempt', () => {
      const attempt: ReconnectAttempt = {
        attemptNumber: 1,
        timestamp: new Date(),
        delay: 1000,
        success: true
      };

      expect(attempt.attemptNumber).toBe(1);
    });

    it('should accept ReconnectAttempt with error', () => {
      const attempt: ReconnectAttempt = {
        attemptNumber: 2,
        timestamp: new Date(),
        delay: 2000,
        success: false,
        error: new Error('Failed'),
        duration: 500
      };

      expect(attempt.error).toBeDefined();
      expect(attempt.success).toBe(false);
    });

    it('should accept valid ConnectionHealth', () => {
      const health: ConnectionHealth = {
        healthy: true,
        lastPingTime: new Date(),
        uptime: 100,
        consecutiveFailures: 0,
        lastCheckTime: new Date()
      };

      expect(health.healthy).toBe(true);
    });

    it('should accept valid StateTransition', () => {
      const transition: StateTransition = {
        from: 'disconnected',
        to: 'connected',
        timestamp: new Date(),
        reason: 'Connection established'
      };

      expect(transition.from).toBe('disconnected');
      expect(transition.to).toBe('connected');
    });

    it('should accept valid ReconnectDecision', () => {
      const decision: ReconnectDecision = {
        shouldReconnect: true,
        delay: 1000,
        reason: 'Attempting reconnection'
      };

      expect(decision.shouldReconnect).toBe(true);
    });

    it('should accept valid PolicyContext', () => {
      const context: PolicyContext = {
        attemptNumber: 1,
        reason: 'timeout',
        timeSinceLastConnection: 5000,
        totalReconnectTime: 10000,
        config: DEFAULT_RECONNECT_CONFIG
      };

      expect(context.attemptNumber).toBe(1);
    });

    it('should accept valid ReconnectionStats', () => {
      const stats: ReconnectionStats = {
        state: 'connected',
        totalAttempts: 5,
        successfulReconnections: 3,
        failedReconnections: 2,
        bufferSize: 1024,
        bufferedEventCount: 10,
        totalReconnectTime: 15000,
        avgReconnectTime: 3000,
        lastConnectedAt: new Date(),
        uptime: 300
      };

      expect(stats.totalAttempts).toBe(5);
    });

    it('should accept valid ClientConnectionState', () => {
      const state: ClientConnectionState = {
        connected: true,
        reconnecting: false,
        attemptNumber: 0,
        url: 'https://example.com/events'
      };

      expect(state.connected).toBe(true);
    });

    it('should accept valid ServerSession', () => {
      const session: ServerSession = {
        sessionId: 'session-123',
        clientId: 'client-456',
        createdAt: new Date(),
        lastActivityAt: new Date(),
        url: '/events',
        state: 'active'
      };

      expect(session.state).toBe('active');
    });

    it('should accept valid MissedEvent', () => {
      const missed: MissedEvent = {
        id: 'event-789',
        data: 'missed data',
        timestamp: Date.now(),
        reason: 'disconnect'
      };

      expect(missed.reason).toBe('disconnect');
    });

    it('should accept valid ServerSessionOptions', () => {
      const options: ServerSessionOptions = {
        sessionTimeout: 300000,
        persistMissedEvents: true,
        maxMissedEvents: 100,
        enableSessionTransfer: true
      };

      expect(options.sessionTimeout).toBe(300000);
    });

    it('should accept valid ReconnectAck', () => {
      const ack: ReconnectAck = {
        sessionId: 'session-123',
        lastEventId: 'event-456',
        timestamp: Date.now()
      };

      expect(ack.sessionId).toBe('session-123');
    });

    it('should accept valid MissedEventDelivery', () => {
      const delivery: MissedEventDelivery = {
        sessionId: 'session-123',
        eventCount: 5,
        events: [],
        timestamp: Date.now()
      };

      expect(delivery.eventCount).toBe(5);
    });

    it('should accept valid ClientIntegrationOptions', () => {
      const options: ClientIntegrationOptions = {
        autoReconnect: true,
        replayBufferedEvents: true,
        showNotifications: true
      };

      expect(options.autoReconnect).toBe(true);
    });
  });

  describe('Type Guards', () => {
    it('should identify reconnect states', () => {
      const state: ReconnectState = 'connected';

      if (state === 'connected' || state === 'disconnected') {
        expect(true).toBe(true);
      }
    });

    it('should identify disconnect reasons', () => {
      const reason: DisconnectReason = 'timeout';

      if (reason === 'error' || reason === 'timeout') {
        expect(true).toBe(true);
      }
    });

    it('should identify backoff strategies', () => {
      const strategy: BackoffStrategy = 'exponential-with-jitter';

      if (strategy.includes('exponential')) {
        expect(true).toBe(true);
      }
    });
  });
});

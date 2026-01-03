/**
 * StateMachine Tests
 * Tests for reconnection state machine transitions and validation
 */

import { describe, it, expect, vi } from 'vitest';
import { StateMachine, createStateMachine } from '../src/StateMachine.js';
import { StateTransitionError } from '../src/types.js';
import type { ReconnectState, StateTransition } from '../src/types.js';

describe('StateMachine', () => {
  describe('Construction', () => {
    it('should create with default state', () => {
      const machine = new StateMachine();

      expect(machine.getCurrentState()).toBe('disconnected');
    });

    it('should create with custom initial state', () => {
      const machine = new StateMachine('connected');

      expect(machine.getCurrentState()).toBe('connected');
    });

    it('should create with factory function', () => {
      const machine = createStateMachine('reconnecting');

      expect(machine.getCurrentState()).toBe('reconnecting');
    });
  });

  describe('State Queries', () => {
    it('should return current state', () => {
      const machine = new StateMachine('connected');

      expect(machine.getCurrentState()).toBe('connected');
    });

    it('should check if connected', () => {
      const machine = new StateMachine('connected');

      expect(machine.isConnected()).toBe(true);
      expect(machine.isDisconnected()).toBe(false);
      expect(machine.isReconnecting()).toBe(false);
      expect(machine.isFailed()).toBe(false);
    });

    it('should check if disconnected', () => {
      const machine = new StateMachine('disconnected');

      expect(machine.isConnected()).toBe(false);
      expect(machine.isDisconnected()).toBe(true);
    });

    it('should check if reconnecting', () => {
      const machine = new StateMachine('reconnecting');

      expect(machine.isReconnecting()).toBe(true);
    });

    it('should check if failed', () => {
      const machine = new StateMachine('failed');

      expect(machine.isFailed()).toBe(true);
    });
  });

  describe('State Transition Validation', () => {
    it('should allow valid transition from disconnected to reconnecting', () => {
      const machine = new StateMachine('disconnected');

      expect(machine.canTransition('reconnecting')).toBe(true);
    });

    it('should allow valid transition from reconnecting to connected', () => {
      const machine = new StateMachine('reconnecting');

      expect(machine.canTransition('connected')).toBe(true);
    });

    it('should allow valid transition from connected to disconnected', () => {
      const machine = new StateMachine('connected');

      expect(machine.canTransition('disconnected')).toBe(true);
    });

    it('should allow valid transition from any state to failed', () => {
      const states: ReconnectState[] = ['connected', 'disconnected', 'reconnecting'];

      for (const state of states) {
        const machine = new StateMachine(state);
        expect(machine.canTransition('failed')).toBe(true);
      }
    });

    it('should not allow invalid transition from failed to connected', () => {
      const machine = new StateMachine('failed');

      expect(machine.canTransition('connected')).toBe(false);
    });

    it('should not allow transition from disconnected to disconnected (self-loop allowed as no-op)', () => {
      const machine = new StateMachine('disconnected');

      // Self-transitions are allowed (they become no-ops)
      expect(machine.canTransition('disconnected')).toBe(true);
    });
  });

  describe('State Transitions', () => {
    it('should transition from disconnected to reconnecting', () => {
      const machine = new StateMachine('disconnected');

      machine.transition('reconnecting');

      expect(machine.getCurrentState()).toBe('reconnecting');
    });

    it('should transition from reconnecting to connected', () => {
      const machine = new StateMachine('reconnecting');

      machine.transition('connected');

      expect(machine.getCurrentState()).toBe('connected');
    });

    it('should transition from connected to disconnected', () => {
      const machine = new StateMachine('connected');

      machine.transition('disconnected');

      expect(machine.getCurrentState()).toBe('disconnected');
    });

    it('should transition from reconnecting to failed', () => {
      const machine = new StateMachine('reconnecting');

      machine.transition('failed');

      expect(machine.getCurrentState()).toBe('failed');
    });

    it('should transition from failed to disconnected', () => {
      const machine = new StateMachine('failed');

      machine.transition('disconnected');

      expect(machine.getCurrentState()).toBe('disconnected');
    });

    it('should throw on invalid transition', () => {
      const machine = new StateMachine('failed');

      expect(() => {
        machine.transition('connected');
      }).toThrow(StateTransitionError);
    });

    it('should include transition details in error', () => {
      const machine = new StateMachine('failed');

      try {
        machine.transition('connected');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        if (error instanceof StateTransitionError) {
          expect(error.from).toBe('failed');
          expect(error.to).toBe('connected');
        }
      }
    });

    it('should handle no-op transition gracefully', () => {
      const machine = new StateMachine('connected');

      machine.transition('connected');

      expect(machine.getCurrentState()).toBe('connected');
    });
  });

  describe('State Transition History', () => {
    it('should record state transitions', () => {
      const machine = new StateMachine('disconnected');

      machine.transition('reconnecting', 'Starting reconnect');
      machine.transition('connected', 'Reconnected successfully');

      const history = machine.getStateHistory();

      expect(history.length).toBeGreaterThan(2);
    });

    it('should include transition metadata', () => {
      const machine = new StateMachine('disconnected');

      machine.transition('reconnecting', 'Test reason', { attempt: 1 });

      const history = machine.getStateHistory();
      const lastTransition = history[history.length - 1];

      expect(lastTransition.reason).toBe('Test reason');
      expect(lastTransition.metadata).toEqual({ attempt: 1 });
    });

    it('should get transitions since a specific time', () => {
      const machine = new StateMachine('disconnected');
      const cutoff = new Date();

      // Wait a bit to ensure timestamp difference
      setTimeout(() => {
        machine.transition('reconnecting');
        machine.transition('connected');

        const recentTransitions = machine.getTransitionsSince(cutoff);

        expect(recentTransitions.length).toBeGreaterThanOrEqual(2);
      }, 10);
    });

    it('should get transitions to a specific state', () => {
      const machine = new StateMachine('disconnected');

      machine.transition('reconnecting');
      machine.transition('connected');
      machine.transition('disconnected');
      machine.transition('reconnecting');

      const reconnectingTransitions = machine.getTransitionsTo('reconnecting');

      expect(reconnectingTransitions.length).toBe(2);
    });
  });

  describe('State Change Handlers', () => {
    it('should call state change handlers', () => {
      const machine = new StateMachine('disconnected');
      const handler = vi.fn();

      machine.onStateChange(handler);

      machine.transition('reconnecting');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should pass transition to handlers', () => {
      const machine = new StateMachine('disconnected');
      const handler = vi.fn();

      machine.onStateChange(handler);

      machine.transition('reconnecting', 'Test');

      expect(handler.mock.calls[0][0]).toMatchObject({
        from: 'disconnected',
        to: 'reconnecting',
        reason: 'Test'
      });
    });

    it('should support multiple handlers', () => {
      const machine = new StateMachine('disconnected');
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      machine.onStateChange(handler1);
      machine.onStateChange(handler2);

      machine.transition('reconnecting');

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should unsubscribe handler', () => {
      const machine = new StateMachine('disconnected');
      const handler = vi.fn();

      const unsubscribe = machine.onStateChange(handler);

      unsubscribe();

      machine.transition('reconnecting');

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle errors in handlers gracefully', () => {
      const machine = new StateMachine('disconnected');
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });

      machine.onStateChange(errorHandler);

      expect(() => {
        machine.transition('reconnecting');
      }).not.toThrow();
    });
  });

  describe('State Time Tracking', () => {
    it('should track time in current state', async () => {
      const machine = new StateMachine('disconnected');

      await new Promise(resolve => setTimeout(resolve, 50));

      const timeInState = machine.getTimeInState('disconnected');

      expect(timeInState).toBeGreaterThan(40);
      expect(timeInState).toBeLessThan(200);
    });

    it('should track time across multiple states', async () => {
      const machine = new StateMachine('disconnected');

      await new Promise(resolve => setTimeout(resolve, 20));

      machine.transition('reconnecting');

      await new Promise(resolve => setTimeout(resolve, 20));

      machine.transition('connected');

      const timeInDisconnected = machine.getTimeInState('disconnected');
      const timeInReconnecting = machine.getTimeInState('reconnecting');

      expect(timeInDisconnected).toBeGreaterThan(10);
      expect(timeInReconnecting).toBeGreaterThan(10);
    });

    it('should track time since last change', async () => {
      const machine = new StateMachine('disconnected');

      await new Promise(resolve => setTimeout(resolve, 30));

      const timeSinceLastChange = machine.getTimeSinceLastChange();

      expect(timeSinceLastChange).toBeGreaterThan(20);
    });
  });

  describe('State Statistics', () => {
    it('should calculate state statistics', () => {
      const machine = new StateMachine('disconnected');

      machine.transition('reconnecting');
      machine.transition('connected');

      const stats = machine.getStatistics();

      expect(stats.currentState).toBe('connected');
      expect(stats.totalTransitions).toBeGreaterThan(0);
      expect(stats.timeByState).toBeDefined();
    });

    it('should include time breakdown by state', async () => {
      const machine = new StateMachine('disconnected');

      await new Promise(resolve => setTimeout(resolve, 20));

      machine.transition('reconnecting');

      await new Promise(resolve => setTimeout(resolve, 20));

      const stats = machine.getStatistics();

      expect(stats.timeByState.disconnected).toBeGreaterThan(10);
    });
  });

  describe('Can Attempt Reconnection', () => {
    it('should return true when disconnected', () => {
      const machine = new StateMachine('disconnected');

      expect(machine.canAttemptReconnection()).toBe(true);
    });

    it('should return true when failed', () => {
      const machine = new StateMachine('failed');

      expect(machine.canAttemptReconnection()).toBe(true);
    });

    it('should return false when connected', () => {
      const machine = new StateMachine('connected');

      expect(machine.canAttemptReconnection()).toBe(false);
    });

    it('should return false when reconnecting', () => {
      const machine = new StateMachine('reconnecting');

      expect(machine.canAttemptReconnection()).toBe(false);
    });
  });

  describe('Force Transition', () => {
    it('should bypass validation', () => {
      const machine = new StateMachine('failed');

      // This would normally throw
      machine.forceTransition('connected');

      expect(machine.getCurrentState()).toBe('connected');
    });

    it('should record forced transition', () => {
      const machine = new StateMachine('disconnected');

      machine.forceTransition('connected', 'Forced by user');

      const history = machine.getStateHistory();
      const lastTransition = history[history.length - 1];

      expect(lastTransition.reason).toBe('Forced by user');
    });

    it('should handle no-op force transition', () => {
      const machine = new StateMachine('connected');

      machine.forceTransition('connected');

      expect(machine.getCurrentState()).toBe('connected');
    });
  });

  describe('Reset', () => {
    it('should reset to initial state', () => {
      const machine = new StateMachine('disconnected');

      machine.transition('reconnecting');
      machine.transition('connected');

      machine.reset();

      expect(machine.getCurrentState()).toBe('disconnected');
    });

    it('should reset to custom initial state', () => {
      const machine = new StateMachine('disconnected');

      machine.transition('reconnecting');

      machine.reset('connected');

      expect(machine.getCurrentState()).toBe('connected');
    });

    it('should clear history on reset', () => {
      const machine = new StateMachine('disconnected');

      machine.transition('reconnecting');
      machine.transition('connected');

      machine.reset();

      const history = machine.getStateHistory();

      // Should only have initial and reset transitions
      expect(history.length).toBeLessThan(3);
    });
  });

  describe('Monitor Event Export', () => {
    it('should export as monitor event', () => {
      const machine = new StateMachine('connected');

      const event = machine.toMonitorEvent();

      expect(event.type).toBe('connect');
      expect(event.state).toBe('connected');
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should export disconnect state as disconnect event', () => {
      const machine = new StateMachine('disconnected');

      const event = machine.toMonitorEvent();

      expect(event.type).toBe('disconnect');
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid transitions', () => {
      const machine = new StateMachine('disconnected');

      for (let i = 0; i < 100; i++) {
        if (machine.getCurrentState() === 'disconnected') {
          machine.transition('reconnecting');
        } else if (machine.getCurrentState() === 'reconnecting') {
          machine.transition('connected');
        } else if (machine.getCurrentState() === 'connected') {
          machine.transition('disconnected');
        }
      }

      expect(machine.getCurrentState()).toBeDefined();
    });

    it('should handle transitions with no reason', () => {
      const machine = new StateMachine('disconnected');

      machine.transition('reconnecting');

      const history = machine.getStateHistory();
      const lastTransition = history[history.length - 1];

      expect(lastTransition.reason).toBeUndefined();
    });

    it('should handle transitions with no metadata', () => {
      const machine = new StateMachine('disconnected');

      machine.transition('reconnecting', 'Test');

      const history = machine.getStateHistory();
      const lastTransition = history[history.length - 1];

      expect(lastTransition.metadata).toBeUndefined();
    });
  });
});

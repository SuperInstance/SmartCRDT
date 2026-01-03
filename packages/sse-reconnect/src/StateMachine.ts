/**
 * State Machine
 *
 * Manages reconnection state transitions with validation and history tracking.
 * Ensures only valid state transitions are allowed.
 */

import type {
  ReconnectState,
  StateTransition,
  ConnectionMonitorEvent,
} from "./types.js";
import { VALID_STATE_TRANSITIONS } from "./types.js";
import { StateTransitionError } from "./types.js";

/**
 * State change event handler
 */
export type StateChangeHandler = (transition: StateTransition) => void;

/**
 * State machine for managing reconnection states
 */
export class StateMachine {
  private currentState: ReconnectState;
  private stateHistory: StateTransition[];
  private stateChangeHandlers: Set<StateChangeHandler>;
  private createdAt: Date;

  constructor(initialState: ReconnectState = "disconnected") {
    this.currentState = initialState;
    this.stateHistory = [];
    this.stateChangeHandlers = new Set();
    this.createdAt = new Date();

    // Record initial state
    this.recordTransition(null, initialState, "initial");
  }

  /**
   * Get current state
   */
  getCurrentState(): ReconnectState {
    return this.currentState;
  }

  /**
   * Check if a transition is valid
   */
  canTransition(to: ReconnectState): boolean {
    if (to === this.currentState) {
      return true; // No-op transitions are allowed
    }

    const validTargets = VALID_STATE_TRANSITIONS[this.currentState];
    return validTargets.includes(to);
  }

  /**
   * Transition to a new state
   * @throws StateTransitionError if transition is invalid
   */
  transition(
    to: ReconnectState,
    reason?: string,
    metadata?: Record<string, unknown>
  ): void {
    const from = this.currentState;

    if (to === from) {
      // No-op transition, just return
      return;
    }

    if (!this.canTransition(to)) {
      throw new StateTransitionError(
        `Invalid state transition from '${from}' to '${to}'`,
        from,
        to
      );
    }

    // Perform transition
    const transition: StateTransition = {
      from,
      to,
      timestamp: new Date(),
      reason,
      metadata,
    };

    this.currentState = to;
    this.recordTransition(from, to, reason, metadata);

    // Notify handlers
    this.notifyStateChange(transition);
  }

  /**
   * Force transition to a state (bypasses validation)
   * Use only for error recovery or manual override
   */
  forceTransition(
    to: ReconnectState,
    reason?: string,
    metadata?: Record<string, unknown>
  ): void {
    const from = this.currentState;

    if (to === from) {
      return;
    }

    const transition: StateTransition = {
      from,
      to,
      timestamp: new Date(),
      reason: reason || "forced transition",
      metadata,
    };

    this.currentState = to;
    this.stateHistory.push(transition);

    this.notifyStateChange(transition);
  }

  /**
   * Reset state to initial state
   */
  reset(initialState: ReconnectState = "disconnected"): void {
    this.currentState = initialState;
    this.stateHistory = [];
    this.createdAt = new Date();

    this.recordTransition(null, initialState, "reset");
  }

  /**
   * Get state transition history
   */
  getStateHistory(): StateTransition[] {
    return [...this.stateHistory];
  }

  /**
   * Get transitions since a specific time
   */
  getTransitionsSince(since: Date): StateTransition[] {
    return this.stateHistory.filter(t => t.timestamp >= since);
  }

  /**
   * Get transitions of a specific type
   */
  getTransitionsTo(state: ReconnectState): StateTransition[] {
    return this.stateHistory.filter(t => t.to === state);
  }

  /**
   * Get time spent in a state
   */
  getTimeInState(state: ReconnectState): number {
    let total = 0;
    let entryTime: Date | null = null;

    for (const transition of this.stateHistory) {
      if (transition.to === state && entryTime === null) {
        // Entered the state
        entryTime = transition.timestamp;
      } else if (transition.from === state && entryTime !== null) {
        // Exited the state
        total += transition.timestamp.getTime() - entryTime.getTime();
        entryTime = null;
      }
    }

    // If currently in this state, add time until now
    if (this.currentState === state && entryTime !== null) {
      total += Date.now() - entryTime.getTime();
    }

    return total;
  }

  /**
   * Get time since last state change
   */
  getTimeSinceLastChange(): number {
    if (this.stateHistory.length === 0) {
      return Date.now() - this.createdAt.getTime();
    }

    const lastChange = this.stateHistory[this.stateHistory.length - 1];
    return Date.now() - lastChange.timestamp.getTime();
  }

  /**
   * Check if currently in a specific state
   */
  is(state: ReconnectState): boolean {
    return this.currentState === state;
  }

  /**
   * Check if connected (in connected state)
   */
  isConnected(): boolean {
    return this.currentState === "connected";
  }

  /**
   * Check if disconnected (in disconnected state)
   */
  isDisconnected(): boolean {
    return this.currentState === "disconnected";
  }

  /**
   * Check if reconnecting (in reconnecting state)
   */
  isReconnecting(): boolean {
    return this.currentState === "reconnecting";
  }

  /**
   * Check if failed (in failed state)
   */
  isFailed(): boolean {
    return this.currentState === "failed";
  }

  /**
   * Check if can attempt reconnection
   */
  canAttemptReconnection(): boolean {
    return (
      this.currentState === "disconnected" || this.currentState === "failed"
    );
  }

  /**
   * Register a state change handler
   */
  onStateChange(handler: StateChangeHandler): () => void {
    this.stateChangeHandlers.add(handler);

    // Return unsubscribe function
    return () => {
      this.stateChangeHandlers.delete(handler);
    };
  }

  /**
   * Remove a state change handler
   */
  offStateChange(handler: StateChangeHandler): void {
    this.stateChangeHandlers.delete(handler);
  }

  /**
   * Get state statistics
   */
  getStatistics(): {
    currentState: ReconnectState;
    timeSinceLastChange: number;
    timeInCurrentState: number;
    totalTransitions: number;
    timeByState: Record<ReconnectState, number>;
  } {
    const states: ReconnectState[] = [
      "connected",
      "disconnected",
      "reconnecting",
      "failed",
    ];

    return {
      currentState: this.currentState,
      timeSinceLastChange: this.getTimeSinceLastChange(),
      timeInCurrentState: this.getTimeInState(this.currentState),
      totalTransitions: this.stateHistory.length,
      timeByState: states.reduce(
        (acc, state) => {
          acc[state] = this.getTimeInState(state);
          return acc;
        },
        {} as Record<ReconnectState, number>
      ),
    };
  }

  /**
   * Export state to monitor event
   */
  toMonitorEvent(): ConnectionMonitorEvent {
    return {
      type: this.currentState === "connected" ? "connect" : "disconnect",
      timestamp: new Date(),
      state: this.currentState,
      data: {
        timeSinceLastChange: this.getTimeSinceLastChange(),
        totalTransitions: this.stateHistory.length,
      },
    };
  }

  /**
   * Record a state transition
   */
  private recordTransition(
    from: ReconnectState | null,
    to: ReconnectState,
    reason?: string,
    metadata?: Record<string, unknown>
  ): void {
    const transition: StateTransition = {
      from: from || to, // For initial state, use 'to' as both
      to,
      timestamp: new Date(),
      reason,
      metadata,
    };

    this.stateHistory.push(transition);
  }

  /**
   * Notify all state change handlers
   */
  private notifyStateChange(transition: StateTransition): void {
    for (const handler of this.stateChangeHandlers) {
      try {
        handler(transition);
      } catch (error) {
        console.error("Error in state change handler:", error);
      }
    }
  }
}

/**
 * Create a state machine with initial state
 */
export function createStateMachine(
  initialState?: ReconnectState
): StateMachine {
  return new StateMachine(initialState);
}

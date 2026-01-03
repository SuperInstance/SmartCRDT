/**
 * Counterfactual Reasoning for VL-JEPA World Model
 * Answers "what if" questions by simulating alternative scenarios
 */

import type {
  Counterfactual,
  CounterfactualQuery,
  WorldState,
  Action,
  StateDelta,
  Vector3,
} from "../types.js";

export class CounterfactualReasoner {
  private actionHistory: Action[] = [];
  private stateHistory: WorldState[] = [];

  /**
   * Generate a counterfactual scenario
   */
  async generateCounterfactual(
    query: CounterfactualQuery
  ): Promise<Counterfactual> {
    // Simulate actual outcome
    const actualOutcome = await this.simulateAction(
      query.currentState,
      query.action,
      query.horizon,
      query.granularity
    );

    // Simulate counterfactual outcome
    const counterfactualOutcome = await this.simulateAction(
      query.currentState,
      query.counterfactualAction,
      query.horizon,
      query.granularity
    );

    // Compute difference
    const difference = this.computeStateDelta(
      actualOutcome,
      counterfactualOutcome
    );

    // Estimate confidence
    const confidence = this.estimateConfidence(query, difference);

    return {
      actual: actualOutcome,
      action: query.action,
      counterfactualAction: query.counterfactualAction,
      predictedOutcome: counterfactualOutcome,
      difference,
      confidence,
    };
  }

  /**
   * Simulate an action on a world state
   */
  private async simulateAction(
    initialState: WorldState,
    action: Action,
    horizon: number,
    granularity: number
  ): Promise<WorldState> {
    let currentState = { ...initialState };
    currentState.objects = currentState.objects.map(o => ({ ...o }));
    currentState.relations = currentState.relations.map(r => ({ ...r }));
    currentState.events = [...currentState.events];

    const steps = Math.ceil(horizon / granularity);

    for (let i = 0; i < steps; i++) {
      // Apply action at first step
      if (i === 0) {
        currentState = this.applyAction(currentState, action);
      }

      // Simulate physics/state evolution
      currentState = this.evolveState(currentState, granularity);
    }

    return currentState;
  }

  /**
   * Apply an action to a world state
   */
  private applyAction(state: WorldState, action: Action): WorldState {
    const newState = { ...state };
    newState.objects = newState.objects.map(o => ({ ...o }));

    switch (action.type) {
      case "move":
        newState.objects = this.applyMove(newState.objects, action);
        break;

      case "remove":
        newState.objects = newState.objects.filter(o => o.id !== action.target);
        break;

      case "add":
        newState.objects.push({
          id: action.target,
          type: "object",
          position: action.parameters.position || { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          properties: action.parameters.properties || {},
          visible: true,
          occluded: false,
        });
        break;

      case "modify":
        newState.objects = newState.objects.map(o => {
          if (o.id === action.target) {
            return {
              ...o,
              properties: { ...o.properties, ...action.parameters.properties },
            };
          }
          return o;
        });
        break;

      case "hide":
        newState.objects = newState.objects.map(o => {
          if (o.id === action.target) {
            return { ...o, visible: false, occluded: true };
          }
          return o;
        });
        break;

      case "show":
        newState.objects = newState.objects.map(o => {
          if (o.id === action.target) {
            return { ...o, visible: true, occluded: false };
          }
          return o;
        });
        break;
    }

    // Record event
    newState.events.push({
      id: `event-${Date.now()}-${Math.random()}`,
      type: action.type,
      timestamp: newState.timestamp,
      participants: [action.target],
      properties: action.parameters,
    });

    return newState;
  }

  /**
   * Apply move action to objects
   */
  private applyMove(objects: any[], action: Action): any[] {
    const delta = (action.parameters.delta as Vector3) || { x: 0, y: 0, z: 0 };
    const target = (action.parameters.target as string) || action.target;

    return objects.map(o => {
      if (o.id === target) {
        return {
          ...o,
          position: {
            x: o.position.x + delta.x,
            y: o.position.y + delta.y,
            z: o.position.z + delta.z,
          },
        };
      }
      return o;
    });
  }

  /**
   * Evolve state over time (simple physics)
   */
  private evolveState(state: WorldState, dt: number): WorldState {
    const newState = { ...state };
    newState.objects = newState.objects.map(o => {
      const newObj = { ...o };

      // Apply gravity if not on ground
      if (newObj.position.y > 0) {
        newObj.position.y = Math.max(
          0,
          newObj.position.y - 9.8 * dt * dt * 0.5
        );
      }

      return newObj;
    });

    newState.timestamp += dt;

    return newState;
  }

  /**
   * Compute the difference between two states
   */
  private computeStateDelta(
    actual: WorldState,
    counterfactual: WorldState
  ): StateDelta {
    const actualIds = new Set(actual.objects.map(o => o.id));
    const counterfactualIds = new Set(counterfactual.objects.map(o => o.id));

    const added: string[] = [];
    const removed: string[] = [];
    const modified = new Map<string, any>();

    // Find added objects
    for (const id of counterfactualIds) {
      if (!actualIds.has(id)) {
        added.push(id);
      }
    }

    // Find removed objects
    for (const id of actualIds) {
      if (!counterfactualIds.has(id)) {
        removed.push(id);
      }
    }

    // Find modified objects
    for (const id of actualIds) {
      if (counterfactualIds.has(id)) {
        const actualObj = actual.objects.find(o => o.id === id);
        const counterfactualObj = counterfactual.objects.find(o => o.id === id);

        if (actualObj && counterfactualObj) {
          const changes = this.getObjectChanges(actualObj, counterfactualObj);
          if (Object.keys(changes).length > 0) {
            modified.set(id, changes);
          }
        }
      }
    }

    const unchanged = new Set(
      Array.from(actualIds).filter(
        id => counterfactualIds.has(id) && !modified.has(id)
      )
    );

    return { added, removed, modified, unchanged };
  }

  /**
   * Get changes between two objects
   */
  private getObjectChanges(actual: any, counterfactual: any): any {
    const changes: any = {};

    if (
      actual.position.x !== counterfactual.position.x ||
      actual.position.y !== counterfactual.position.y ||
      actual.position.z !== counterfactual.position.z
    ) {
      changes.position = {
        from: actual.position,
        to: counterfactual.position,
      };
    }

    if (actual.visible !== counterfactual.visible) {
      changes.visible = {
        from: actual.visible,
        to: counterfactual.visible,
      };
    }

    return changes;
  }

  /**
   * Estimate confidence in counterfactual prediction
   */
  private estimateConfidence(
    query: CounterfactualQuery,
    delta: StateDelta
  ): number {
    let confidence = 0.5; // Base confidence

    // More changes = less confidence
    const totalChanges =
      delta.added.length + delta.removed.length + delta.modified.size;
    confidence -= Math.min(0.3, totalChanges * 0.05);

    // Similar actions = more confidence
    if (query.action.type === query.counterfactualAction.type) {
      confidence += 0.2;
    }

    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Answer "what would happen if I did X?"
   */
  async whatIf(
    currentState: WorldState,
    action: Action,
    horizon: number = 1000
  ): Promise<WorldState> {
    const query: CounterfactualQuery = {
      currentState,
      action: {
        type: "noop",
        target: "",
        parameters: {},
        timestamp: Date.now(),
      },
      counterfactualAction: action,
      horizon,
      granularity: 100,
    };

    const counterfactual = await this.generateCounterfactual(query);
    return counterfactual.predictedOutcome;
  }

  /**
   * Compare two actions
   */
  async compareActions(
    currentState: WorldState,
    actionA: Action,
    actionB: Action,
    horizon: number = 1000
  ): Promise<{
    outcomeA: WorldState;
    outcomeB: WorldState;
    difference: StateDelta;
  }> {
    const query: CounterfactualQuery = {
      currentState,
      action: actionA,
      counterfactualAction: actionB,
      horizon,
      granularity: 100,
    };

    const counterfactual = await this.generateCounterfactual(query);

    return {
      outcomeA: counterfactual.actual,
      outcomeB: counterfactual.predictedOutcome,
      difference: counterfactual.difference,
    };
  }

  /**
   * Find the action that would achieve a goal state
   */
  async findActionForGoal(
    currentState: WorldState,
    goalState: WorldState,
    possibleActions: Action[]
  ): Promise<Action | null> {
    let bestAction: Action | null = null;
    let bestSimilarity = 0;

    for (const action of possibleActions) {
      const outcome = await this.whatIf(currentState, action);
      const similarity = this.computeSimilarity(outcome, goalState);

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestAction = action;
      }
    }

    return bestAction;
  }

  /**
   * Compute similarity between two states
   */
  private computeSimilarity(stateA: WorldState, stateB: WorldState): number {
    const idsA = new Set(stateA.objects.map(o => o.id));
    const idsB = new Set(stateB.objects.map(o => o.id));

    // Jaccard similarity
    const intersection = new Set([...idsA].filter(id => idsB.has(id)));
    const union = new Set([...idsA, ...idsB]);

    let similarity = intersection.size / union.size;

    // Consider position similarity for common objects
    let positionSimilarity = 0;
    let commonCount = 0;

    for (const id of intersection) {
      const objA = stateA.objects.find(o => o.id === id);
      const objB = stateB.objects.find(o => o.id === id);

      if (objA && objB) {
        const distance = Math.sqrt(
          (objA.position.x - objB.position.x) ** 2 +
            (objA.position.y - objB.position.y) ** 2 +
            (objA.position.z - objB.position.z) ** 2
        );

        positionSimilarity += Math.max(0, 1 - distance / 100);
        commonCount++;
      }
    }

    if (commonCount > 0) {
      positionSimilarity /= commonCount;
      similarity = similarity * 0.5 + positionSimilarity * 0.5;
    }

    return similarity;
  }

  /**
   * Record action for learning
   */
  recordAction(action: Action, resultingState: WorldState): void {
    this.actionHistory.push(action);
    this.stateHistory.push(resultingState);

    // Keep only last 1000 entries
    if (this.actionHistory.length > 1000) {
      this.actionHistory.shift();
      this.stateHistory.shift();
    }
  }

  /**
   * Get action history
   */
  getActionHistory(): Action[] {
    return [...this.actionHistory];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.actionHistory = [];
    this.stateHistory = [];
  }

  /**
   * Create an action
   */
  createAction(config: {
    type: Action["type"];
    target: string;
    parameters?: Record<string, any>;
  }): Action {
    return {
      type: config.type,
      target: config.target,
      parameters: config.parameters || {},
      timestamp: Date.now(),
    };
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalActions: number;
    totalStates: number;
    avgConfidence: number;
  } {
    return {
      totalActions: this.actionHistory.length,
      totalStates: this.stateHistory.length,
      avgConfidence: 0.7, // Placeholder
    };
  }
}
